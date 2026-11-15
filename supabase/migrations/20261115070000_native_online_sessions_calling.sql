-- EduSphere 360 native online classes and in-app voice/video calling.
-- Media is routed through EduSphere's self-hosted WebRTC SFU. No meeting provider is required.
create extension if not exists pgcrypto;

create table if not exists public.online_sessions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  session_type text not null check (session_type in ('classroom','direct_call','group_call')),
  title text not null check (length(btrim(title)) between 2 and 180),
  class_id uuid references public.classes(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  academic_session_id uuid references public.academic_sessions(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  room_name text not null unique,
  media_mode text not null default 'video' check (media_mode in ('audio','video')),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','ringing','live','ended','cancelled')),
  recording_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint online_sessions_class_required check (
    (session_type = 'classroom' and class_id is not null)
    or (session_type <> 'classroom' and class_id is null)
  )
);

create table if not exists public.online_session_participants (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  session_id uuid not null references public.online_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_role text not null,
  status text not null default 'invited' check (status in ('invited','joined','left','declined')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  left_at timestamptz,
  attendance_minutes integer not null default 0 check (attendance_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id,user_id),
  unique(id,session_id)
);

create table if not exists public.online_session_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  session_id uuid not null references public.online_sessions(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('created','invited','joined','left','ended','cancelled','declined')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists online_sessions_institution_start_idx
  on public.online_sessions(institution_id, starts_at desc);
create index if not exists online_sessions_class_start_idx
  on public.online_sessions(institution_id, class_id, starts_at desc);
create index if not exists online_sessions_status_idx
  on public.online_sessions(institution_id, status, starts_at);
create index if not exists online_session_participants_user_idx
  on public.online_session_participants(institution_id, user_id, status);
create index if not exists online_session_events_session_idx
  on public.online_session_events(session_id, created_at desc);

alter table public.online_sessions enable row level security;
alter table public.online_session_participants enable row level security;
alter table public.online_session_events enable row level security;

grant select on public.online_sessions to authenticated;
grant select on public.online_session_participants to authenticated;
grant select on public.online_session_events to authenticated;

drop policy if exists online_sessions_scoped_read on public.online_sessions;
create policy online_sessions_scoped_read on public.online_sessions
for select to authenticated
using (
  public.has_institution_role(institution_id, array['owner','admin','exam_officer'])
  or (
    class_id is not null
    and public.has_institution_role(institution_id, array['teacher'])
    and public.can_teach_class(institution_id, class_id)
  )
  or (
    class_id is not null
    and exists (
      select 1
      from public.student_placements sp
      join public.students s on s.id = sp.student_id and s.institution_id = sp.institution_id
      where sp.institution_id = online_sessions.institution_id
        and sp.class_id = online_sessions.class_id
        and sp.status = 'active'
        and sp.effective_from <= current_date
        and (sp.effective_to is null or sp.effective_to >= current_date)
        and s.user_id = (select auth.uid())
    )
  )
  or exists (
    select 1 from public.online_session_participants osp
    where osp.session_id = online_sessions.id
      and osp.institution_id = online_sessions.institution_id
      and osp.user_id = (select auth.uid())
  )
);

drop policy if exists online_session_participants_scoped_read on public.online_session_participants;
create policy online_session_participants_scoped_read on public.online_session_participants
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.has_institution_role(institution_id, array['owner','admin'])
  or exists (
    select 1 from public.online_sessions os
    where os.id = online_session_participants.session_id
      and os.institution_id = online_session_participants.institution_id
      and os.class_id is not null
      and public.has_institution_role(os.institution_id, array['teacher'])
      and public.can_teach_class(os.institution_id, os.class_id)
  )
);

drop policy if exists online_session_events_scoped_read on public.online_session_events;
create policy online_session_events_scoped_read on public.online_session_events
for select to authenticated
using (
  public.has_institution_role(institution_id, array['owner','admin'])
  or exists (
    select 1 from public.online_sessions os
    where os.id = online_session_events.session_id
      and os.created_by = (select auth.uid())
  )
);

-- No direct client-side writes: creation, invitations, joining, leaving and ending
-- are performed through the audited functions below.
revoke insert, update, delete on public.online_sessions from anon, authenticated;
revoke insert, update, delete on public.online_session_participants from anon, authenticated;
revoke insert, update, delete on public.online_session_events from anon, authenticated;

create or replace function public.list_online_session_contacts(p_institution_id uuid)
returns table(user_id uuid, display_name text, role text)
language plpgsql
stable
security definer
set search_path = public, private
as $function$
declare
  v_actor_role text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to view calling contacts.';
  end if;

  select m.role into v_actor_role
  from public.memberships m
  where m.institution_id = p_institution_id
    and m.user_id = auth.uid()
    and m.status = 'active';

  if v_actor_role is null then
    raise exception 'You do not have an active membership in this institution.';
  end if;

  return query
  select distinct on (m.user_id)
    m.user_id,
    coalesce(nullif(btrim(p.full_name),''), nullif(btrim(t.full_name),''), nullif(btrim(s.full_name),''), 'Institution member')::text,
    m.role::text
  from public.memberships m
  left join public.profiles p on p.id = m.user_id
  left join public.teachers t on t.user_id = m.user_id and t.institution_id = m.institution_id
  left join public.students s on s.user_id = m.user_id and s.institution_id = m.institution_id
  where m.institution_id = p_institution_id
    and m.status = 'active'
    and m.user_id <> auth.uid()
    and m.role in ('owner','admin','teacher','student')
    and (
      v_actor_role in ('owner','admin')
      or (v_actor_role = 'teacher' and (
        m.role in ('owner','admin','teacher')
        or exists (
          select 1
          from public.teachers actor
          join public.teacher_assignments ta on ta.teacher_id = actor.id and ta.institution_id = actor.institution_id and ta.status = 'active'
          join public.student_placements sp on sp.class_id = ta.class_id and sp.institution_id = ta.institution_id and sp.status = 'active'
          join public.students target on target.id = sp.student_id and target.institution_id = sp.institution_id
          where actor.user_id = auth.uid()
            and actor.institution_id = p_institution_id
            and target.user_id = m.user_id
            and sp.effective_from <= current_date
            and (sp.effective_to is null or sp.effective_to >= current_date)
        )
      ))
      or (v_actor_role = 'student' and m.role in ('owner','admin','teacher'))
    )
  order by m.user_id, p.updated_at desc nulls last;
end;
$function$;

create or replace function public.create_online_session(
  p_institution_id uuid,
  p_session_type text,
  p_title text,
  p_class_id uuid default null,
  p_subject_id uuid default null,
  p_academic_session_id uuid default null,
  p_starts_at timestamptz default now(),
  p_media_mode text default 'video',
  p_target_user_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  v_actor_role text;
  v_session_id uuid := gen_random_uuid();
  v_room_name text;
  v_target uuid;
  v_target_role text;
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Sign in to create a session.'; end if;
  if p_session_type not in ('classroom','direct_call','group_call') then raise exception 'Invalid session type.'; end if;
  if p_media_mode not in ('audio','video') then raise exception 'Invalid call type.'; end if;
  if length(btrim(coalesce(p_title,''))) < 2 or length(btrim(p_title)) > 180 then raise exception 'Enter a session title between 2 and 180 characters.'; end if;

  select m.role into v_actor_role
  from public.memberships m
  where m.institution_id = p_institution_id and m.user_id = auth.uid() and m.status = 'active';
  if v_actor_role is null then raise exception 'Your institution membership is not active.'; end if;

  if p_session_type = 'classroom' then
    if v_actor_role not in ('owner','admin','teacher') or p_class_id is null then
      raise exception 'Only authorised staff can schedule a class for a valid class group.';
    end if;
    if not exists(select 1 from public.classes c where c.id=p_class_id and c.institution_id=p_institution_id and c.is_active) then
      raise exception 'The selected class is not active in this institution.';
    end if;
    if v_actor_role='teacher' and not public.can_teach_class(p_institution_id,p_class_id) then
      raise exception 'You are not assigned to teach this class.';
    end if;
    if p_subject_id is not null and not exists(select 1 from public.subjects sub where sub.id=p_subject_id and sub.institution_id=p_institution_id) then
      raise exception 'The selected subject does not belong to this institution.';
    end if;
    if coalesce(array_length(p_target_user_ids,1),0) > 0 then
      raise exception 'Class participants are admitted from the verified class roster.';
    end if;
  else
    if v_actor_role not in ('owner','admin','teacher','student') then
      raise exception 'Your role cannot start an in-app call.';
    end if;
    select count(distinct x) into v_count from unnest(coalesce(p_target_user_ids,'{}'::uuid[])) x where x is not null and x <> auth.uid();
    if p_session_type='direct_call' and v_count <> 1 then raise exception 'Choose one person for a direct call.'; end if;
    if p_session_type='group_call' and (v_count < 2 or v_count > 10) then raise exception 'A group call needs between two and ten other people.'; end if;

    if exists (
      select 1 from unnest(coalesce(p_target_user_ids,'{}'::uuid[])) x
      left join public.memberships m on m.user_id=x and m.institution_id=p_institution_id and m.status='active'
      where x is null or x=auth.uid() or m.user_id is null or m.role not in ('owner','admin','teacher','student')
    ) then
      raise exception 'One or more selected contacts are not active members of this institution.';
    end if;

    if v_actor_role='student' and exists (
      select 1 from unnest(coalesce(p_target_user_ids,'{}'::uuid[])) x
      join public.memberships m on m.user_id=x and m.institution_id=p_institution_id and m.status='active'
      where m.role not in ('owner','admin','teacher')
    ) then
      raise exception 'Student accounts may place calls only to authorised institution staff.';
    end if;

    if v_actor_role='teacher' and exists (
      select 1
      from unnest(coalesce(p_target_user_ids,'{}'::uuid[])) x
      join public.memberships m on m.user_id=x and m.institution_id=p_institution_id and m.status='active'
      where m.role='student'
        and not exists (
          select 1
          from public.teachers actor
          join public.teacher_assignments ta on ta.teacher_id=actor.id and ta.institution_id=actor.institution_id and ta.status='active'
          join public.student_placements sp on sp.class_id=ta.class_id and sp.institution_id=ta.institution_id and sp.status='active'
          join public.students target on target.id=sp.student_id and target.institution_id=sp.institution_id
          where actor.user_id=auth.uid() and actor.institution_id=p_institution_id
            and target.user_id=x and sp.effective_from <= current_date
            and (sp.effective_to is null or sp.effective_to >= current_date)
        )
    ) then
      raise exception 'You may call only students in your assigned classes.';
    end if;
  end if;

  v_room_name := 'ed360-' || replace(v_session_id::text,'-','');
  insert into public.online_sessions(
    id,institution_id,session_type,title,class_id,subject_id,academic_session_id,
    created_by,room_name,media_mode,starts_at,status,recording_enabled
  ) values (
    v_session_id,p_institution_id,p_session_type,btrim(p_title),p_class_id,p_subject_id,
    p_academic_session_id,auth.uid(),v_room_name,p_media_mode,
    coalesce(p_starts_at,now()),case when p_session_type='classroom' then 'scheduled' else 'ringing' end,false
  );

  insert into public.online_session_participants(institution_id,session_id,user_id,participant_role,status,invited_by)
  values(p_institution_id,v_session_id,auth.uid(),v_actor_role,'invited',auth.uid());

  if p_session_type <> 'classroom' then
    foreach v_target in array coalesce(p_target_user_ids,'{}'::uuid[]) loop
      select m.role into v_target_role from public.memberships m
      where m.institution_id=p_institution_id and m.user_id=v_target and m.status='active';
      insert into public.online_session_participants(institution_id,session_id,user_id,participant_role,status,invited_by)
      values(p_institution_id,v_session_id,v_target,v_target_role,'invited',auth.uid())
      on conflict(session_id,user_id) do nothing;
      insert into public.online_session_events(institution_id,session_id,actor_user_id,event_type,detail)
      values(p_institution_id,v_session_id,auth.uid(),'invited',jsonb_build_object('participant_user_id',v_target));
    end loop;
  end if;

  insert into public.online_session_events(institution_id,session_id,actor_user_id,event_type,detail)
  values(p_institution_id,v_session_id,auth.uid(),'created',jsonb_build_object('session_type',p_session_type,'media_mode',p_media_mode));

  return v_session_id;
end;
$function$;

create or replace function public.join_online_session(p_session_id uuid)
returns table(
  id uuid,
  institution_id uuid,
  session_type text,
  title text,
  room_name text,
  starts_at timestamptz,
  media_mode text,
  participant_role text
)
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  v_session public.online_sessions%rowtype;
  v_actor_role text;
  v_participant_role text;
begin
  if auth.uid() is null then raise exception 'Sign in to join this session.'; end if;
  select * into v_session from public.online_sessions os where os.id=p_session_id;
  if not found then raise exception 'Session not found.'; end if;
  if v_session.status in ('ended','cancelled') then raise exception 'This session has ended or was cancelled.'; end if;
  if v_session.starts_at > now() + interval '30 minutes' and v_session.session_type='classroom' then
    raise exception 'This class opens 30 minutes before its scheduled start.';
  end if;

  select m.role into v_actor_role
  from public.memberships m
  where m.institution_id=v_session.institution_id and m.user_id=auth.uid() and m.status='active';
  if v_actor_role is null then raise exception 'Your institution membership is not active.'; end if;

  if v_session.session_type='classroom' then
    if v_actor_role in ('owner','admin','exam_officer') then
      null;
    elsif v_actor_role='teacher' and public.can_teach_class(v_session.institution_id,v_session.class_id) then
      null;
    elsif v_actor_role='student' and exists (
      select 1 from public.student_placements sp
      join public.students s on s.id=sp.student_id and s.institution_id=sp.institution_id
      where sp.institution_id=v_session.institution_id and sp.class_id=v_session.class_id
        and sp.status='active' and sp.effective_from<=current_date
        and (sp.effective_to is null or sp.effective_to>=current_date)
        and s.user_id=auth.uid()
    ) then
      null;
    else
      raise exception 'You are not enrolled or assigned to this class.';
    end if;
  else
    if not exists (
      select 1 from public.online_session_participants osp
      where osp.session_id=v_session.id and osp.institution_id=v_session.institution_id and osp.user_id=auth.uid()
    ) then
      raise exception 'You are not invited to this call.';
    end if;
  end if;

  v_participant_role := case when v_session.created_by=auth.uid() then 'host' else v_actor_role end;
  insert into public.online_session_participants(institution_id,session_id,user_id,participant_role,status,invited_by,joined_at,left_at)
  values(v_session.institution_id,v_session.id,auth.uid(),v_participant_role,'joined',v_session.created_by,now(),null)
  on conflict(session_id,user_id) do update
    set status='joined',joined_at=coalesce(public.online_session_participants.joined_at,now()),left_at=null,updated_at=now();

  update public.online_sessions set status='live',updated_at=now()
  where online_sessions.id=v_session.id and online_sessions.status in ('scheduled','ringing');

  insert into public.online_session_events(institution_id,session_id,actor_user_id,event_type)
  values(v_session.institution_id,v_session.id,auth.uid(),'joined');

  return query select v_session.id,v_session.institution_id,v_session.session_type,v_session.title,
    v_session.room_name,v_session.starts_at,v_session.media_mode,v_participant_role;
end;
$function$;

create or replace function public.leave_online_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $function$
begin
  if auth.uid() is null then raise exception 'Sign in to leave this session.'; end if;
  update public.online_session_participants
  set status='left',left_at=now(),
      attendance_minutes=case when joined_at is null then attendance_minutes
        else greatest(attendance_minutes,ceil(extract(epoch from (now()-joined_at))/60.0)::integer) end,
      updated_at=now()
  where session_id=p_session_id and user_id=auth.uid() and status='joined';

  if not found then raise exception 'No active participant session was found.'; end if;

  insert into public.online_session_events(institution_id,session_id,actor_user_id,event_type)
  select institution_id,id,auth.uid(),'left' from public.online_sessions where id=p_session_id;
end;
$function$;

create or replace function public.end_online_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $function$
declare
  v_session public.online_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to end this session.'; end if;
  select * into v_session from public.online_sessions where id=p_session_id;
  if not found then raise exception 'Session not found.'; end if;
  if v_session.created_by <> auth.uid()
     and not public.has_institution_role(v_session.institution_id,array['owner','admin']) then
    raise exception 'Only the session host or an institution administrator can end this session.';
  end if;

  update public.online_sessions set status='ended',ends_at=coalesce(ends_at,now()),updated_at=now()
  where id=p_session_id and status not in ('ended','cancelled');

  update public.online_session_participants
  set status='left',left_at=coalesce(left_at,now()),
      attendance_minutes=case when joined_at is null then attendance_minutes
        else greatest(attendance_minutes,ceil(extract(epoch from (coalesce(left_at,now())-joined_at))/60.0)::integer) end,
      updated_at=now()
  where session_id=p_session_id and status='joined';

  insert into public.online_session_events(institution_id,session_id,actor_user_id,event_type)
  values(v_session.institution_id,v_session.id,auth.uid(),'ended');
end;
$function$;

revoke all on function public.list_online_session_contacts(uuid) from public, anon;
revoke all on function public.create_online_session(uuid,text,text,uuid,uuid,uuid,timestamptz,text,uuid[]) from public, anon;
revoke all on function public.join_online_session(uuid) from public, anon;
revoke all on function public.leave_online_session(uuid) from public, anon;
revoke all on function public.end_online_session(uuid) from public, anon;
grant execute on function public.list_online_session_contacts(uuid) to authenticated;
grant execute on function public.create_online_session(uuid,text,text,uuid,uuid,uuid,timestamptz,text,uuid[]) to authenticated;
grant execute on function public.join_online_session(uuid) to authenticated;
grant execute on function public.leave_online_session(uuid) to authenticated;
grant execute on function public.end_online_session(uuid) to authenticated;


-- Definer helpers keep RLS policies from recursively querying each other's tables.
create or replace function private.is_online_session_participant(p_session_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1 from public.online_session_participants osp
    where osp.session_id=p_session_id and osp.user_id=p_user_id
  );
$function$;

create or replace function private.can_manage_online_session(p_session_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $function$
  select exists (
    select 1
    from public.online_sessions os
    join public.memberships m
      on m.institution_id=os.institution_id
     and m.user_id=p_user_id
     and m.status='active'
    where os.id=p_session_id
      and (
        os.created_by=p_user_id
        or m.role in ('owner','admin')
        or (m.role='teacher' and os.class_id is not null and public.can_teach_class(os.institution_id,os.class_id))
      )
  );
$function$;

revoke all on function private.is_online_session_participant(uuid,uuid) from public, anon;
revoke all on function private.can_manage_online_session(uuid,uuid) from public, anon;
grant execute on function private.is_online_session_participant(uuid,uuid) to authenticated;
grant execute on function private.can_manage_online_session(uuid,uuid) to authenticated;

drop policy if exists online_sessions_scoped_read on public.online_sessions;
create policy online_sessions_scoped_read on public.online_sessions
for select to authenticated
using (
  public.has_institution_role(institution_id, array['owner','admin','exam_officer'])
  or (
    class_id is not null
    and public.has_institution_role(institution_id, array['teacher'])
    and public.can_teach_class(institution_id, class_id)
  )
  or (
    class_id is not null
    and exists (
      select 1
      from public.student_placements sp
      join public.students s on s.id = sp.student_id and s.institution_id = sp.institution_id
      where sp.institution_id = online_sessions.institution_id
        and sp.class_id = online_sessions.class_id
        and sp.status = 'active'
        and sp.effective_from <= current_date
        and (sp.effective_to is null or sp.effective_to >= current_date)
        and s.user_id = (select auth.uid())
    )
  )
  or private.is_online_session_participant(id,(select auth.uid()))
);

drop policy if exists online_session_participants_scoped_read on public.online_session_participants;
create policy online_session_participants_scoped_read on public.online_session_participants
for select to authenticated
using (
  user_id = (select auth.uid())
  or private.can_manage_online_session(session_id,(select auth.uid()))
);

drop policy if exists online_session_events_scoped_read on public.online_session_events;
create policy online_session_events_scoped_read on public.online_session_events
for select to authenticated
using (private.can_manage_online_session(session_id,(select auth.uid())));
