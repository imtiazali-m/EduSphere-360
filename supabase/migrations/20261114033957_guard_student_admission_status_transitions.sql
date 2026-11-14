begin;

create or replace function private.guard_student_admission_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  transition_allowed boolean := false;
begin
  if new.application_status is not distinct from old.application_status then
    return new;
  end if;

  if auth.uid() is null
     or not public.has_institution_role(new.institution_id, array['owner','admin']::text[]) then
    raise exception 'Only an institution owner or administrator can change an admission stage.'
      using errcode = '42501';
  end if;

  if not private.has_institution_permission(
    new.institution_id,
    'students',
    'edit',
    new.campus_id,
    private.college_department_for_student(new.id)
  ) then
    raise exception 'Your assigned college role does not permit admission-stage changes for this student.'
      using errcode = '42501';
  end if;

  transition_allowed := case old.application_status
    when 'draft' then new.application_status in ('submitted','withdrawn')
    when 'submitted' then new.application_status in ('under_review','documents_required','rejected','withdrawn')
    when 'under_review' then new.application_status in ('documents_required','approved','rejected','withdrawn')
    when 'documents_required' then new.application_status in ('under_review','rejected','withdrawn')
    when 'approved' then new.application_status in ('enrolled','withdrawn')
    when 'enrolled' then new.application_status = 'withdrawn'
    when 'rejected' then new.application_status in ('under_review','withdrawn')
    when 'withdrawn' then new.application_status = 'submitted'
    else false
  end;

  if not coalesce(transition_allowed,false) then
    raise exception 'Admission stage transition from % to % is not allowed.',
      old.application_status, new.application_status
      using errcode = '23514';
  end if;

  -- Review identity and timestamps are assigned by the database,
  -- never trusted from client-supplied values.
  new.application_reviewed_by := auth.uid();
  new.application_reviewed_at := now();

  if new.application_status = 'submitted' then
    new.application_submitted_at := now();
  end if;

  if new.application_status = 'enrolled' then
    new.status := 'active';
    new.admission_date := coalesce(new.admission_date, current_date);
  elsif new.application_status in ('rejected','withdrawn') then
    new.status := 'inactive';
  elsif new.application_status in ('draft','submitted','under_review','documents_required','approved') then
    new.status := 'pending';
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function private.guard_student_admission_status_transition() from public, anon, authenticated;

drop trigger if exists students_guard_admission_status_transition on public.students;
create trigger students_guard_admission_status_transition
before update of application_status on public.students
for each row
execute function private.guard_student_admission_status_transition();

commit;
