-- Keep online-class attendance accurate across reconnects and dropped connections.
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

create or replace function public.leave_online_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $function$
begin
  if auth.uid() is null then raise exception 'Sign in to leave this session.'; end if;
  update public.online_session_participants
  set status='left',
      left_at=now(),
      attendance_minutes=attendance_minutes + case
        when joined_at is null then 0
        else greatest(0,ceil(extract(epoch from (now()-joined_at))/60.0)::integer)
      end,
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
  set status='left',
      left_at=coalesce(left_at,now()),
      attendance_minutes=attendance_minutes + case
        when joined_at is null then 0
        else greatest(0,ceil(extract(epoch from (coalesce(left_at,now())-joined_at))/60.0)::integer)
      end,
      updated_at=now()
  where session_id=p_session_id and status='joined';

  insert into public.online_session_events(institution_id,session_id,actor_user_id,event_type)
  values(v_session.institution_id,v_session.id,auth.uid(),'ended');
end;
$function$;

revoke all on function public.join_online_session(uuid) from public, anon;
revoke all on function public.leave_online_session(uuid) from public, anon;
revoke all on function public.end_online_session(uuid) from public, anon;
grant execute on function public.join_online_session(uuid) to authenticated;
grant execute on function public.leave_online_session(uuid) to authenticated;
grant execute on function public.end_online_session(uuid) to authenticated;
