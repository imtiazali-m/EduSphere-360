-- Let a verified guardian observe only their own child's scheduled/live class.
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
      join public.students s on s.id=sp.student_id and s.institution_id=sp.institution_id
      where sp.institution_id=online_sessions.institution_id
        and sp.class_id=online_sessions.class_id
        and sp.status='active'
        and sp.effective_from<=current_date
        and (sp.effective_to is null or sp.effective_to>=current_date)
        and s.user_id=(select auth.uid())
    )
  )
  or (
    class_id is not null
    and exists (
      select 1
      from public.student_guardians sg
      join public.student_placements sp
        on sp.student_id=sg.student_id and sp.institution_id=sg.institution_id
      where sg.institution_id=online_sessions.institution_id
        and sg.parent_user_id=(select auth.uid())
        and sp.class_id=online_sessions.class_id
        and sp.status='active'
        and sp.effective_from<=current_date
        and (sp.effective_to is null or sp.effective_to>=current_date)
    )
  )
  or private.is_online_session_participant(id,(select auth.uid()))
);

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
    elsif v_actor_role='parent' and exists (
      select 1
      from public.student_guardians sg
      join public.student_placements sp
        on sp.student_id=sg.student_id and sp.institution_id=sg.institution_id
      where sg.institution_id=v_session.institution_id
        and sg.parent_user_id=auth.uid()
        and sp.class_id=v_session.class_id
        and sp.status='active'
        and sp.effective_from<=current_date
        and (sp.effective_to is null or sp.effective_to>=current_date)
    ) then
      null;
    else
      raise exception 'You are not enrolled, assigned or linked as a guardian for this class.';
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
    set status='joined',
        joined_at=case
          when public.online_session_participants.status='joined' then public.online_session_participants.joined_at
          else now()
        end,
        left_at=null,
        updated_at=now();

  update public.online_sessions set status='live',updated_at=now()
  where online_sessions.id=v_session.id and online_sessions.status in ('scheduled','ringing');

  insert into public.online_session_events(institution_id,session_id,actor_user_id,event_type)
  values(v_session.institution_id,v_session.id,auth.uid(),'joined');

  return query select v_session.id,v_session.institution_id,v_session.session_type,v_session.title,
    v_session.room_name,v_session.starts_at,v_session.media_mode,v_participant_role;
end;
$function$;

revoke all on function public.join_online_session(uuid) from public, anon;
grant execute on function public.join_online_session(uuid) to authenticated;
