-- Enable server-authorised Realtime updates for in-app call invitations.
do $publication$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(
       select 1 from pg_publication_tables
       where pubname='supabase_realtime'
         and schemaname='public'
         and tablename='online_session_participants'
     ) then
    alter publication supabase_realtime add table public.online_session_participants;
  end if;
end;
$publication$;

-- Class and session references must belong to the same institution.
create or replace function private.guard_online_session_institution_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.class_id is not null and not exists (
    select 1 from public.classes c
    where c.id=new.class_id and c.institution_id=new.institution_id
  ) then
    raise exception 'The selected class does not belong to this institution.';
  end if;
  if new.subject_id is not null and not exists (
    select 1 from public.subjects s
    where s.id=new.subject_id and s.institution_id=new.institution_id
  ) then
    raise exception 'The selected subject does not belong to this institution.';
  end if;
  if new.academic_session_id is not null and not exists (
    select 1 from public.academic_sessions s
    where s.id=new.academic_session_id and s.institution_id=new.institution_id
  ) then
    raise exception 'The selected academic session does not belong to this institution.';
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_online_session_institution_links on public.online_sessions;
create trigger guard_online_session_institution_links
before insert or update of institution_id,class_id,subject_id,academic_session_id
on public.online_sessions
for each row execute function private.guard_online_session_institution_links();

revoke all on function private.guard_online_session_institution_links() from public, anon, authenticated;
