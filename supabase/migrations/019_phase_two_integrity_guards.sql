-- EduSphere 360 Phase Two integrity safeguards.
-- Prevents cross-tenant references, duplicate daily attendance/results and timetable clashes.
-- Historical data is never deleted. Duplicate preflight checks stop safely with clear errors.

begin;

do $$
begin
  if exists (
    select 1
    from public.attendance
    where student_id is not null
    group by institution_id, student_id, attendance_date
    having count(*) > 1
  ) then
    raise exception 'Migration 019 stopped: duplicate daily attendance exists. Review attendance rows with the same institution, student and date before applying this migration.';
  end if;

  if exists (
    select 1
    from public.exam_results
    where exam_id is not null
    group by institution_id, exam_id, student_id
    having count(*) > 1
  ) then
    raise exception 'Migration 019 stopped: duplicate results exist for an examination and student. Review exam_results before applying this migration.';
  end if;
end;
$$;

create unique index if not exists attendance_one_student_per_day_uidx
  on public.attendance(institution_id, student_id, attendance_date)
  where student_id is not null;

create unique index if not exists exam_results_one_student_per_exam_uidx
  on public.exam_results(institution_id, exam_id, student_id)
  where exam_id is not null;

-- Resolve attendance and invoice snapshots from their actual student records.
-- Null links remain permitted on historical rows and on FK-driven student deletion.
create or replace function public.enforce_attendance_student_relationship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  learner_institution uuid;
  learner_name text;
  learner_class text;
begin
  if new.student_id is null then
    if tg_op = 'INSERT' then
      raise exception 'Choose a student before recording attendance.';
    end if;
    return new;
  end if;

  select institution_id, full_name, class_name
    into learner_institution, learner_name, learner_class
    from public.students where id = new.student_id;
  if learner_institution is null or learner_institution <> new.institution_id then
    raise exception 'The attendance student must belong to this institution.';
  end if;
  new.student_name := learner_name;
  new.class_name := learner_class;
  return new;
end;
$$;

drop trigger if exists attendance_student_relationship_guard on public.attendance;
create trigger attendance_student_relationship_guard
before insert or update on public.attendance
for each row execute function public.enforce_attendance_student_relationship();

create or replace function public.enforce_invoice_student_relationship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  learner_institution uuid;
  learner_name text;
begin
  if new.student_id is null then
    if tg_op = 'INSERT' then
      raise exception 'Choose a student before creating a fee invoice.';
    end if;
    return new;
  end if;

  select institution_id, full_name
    into learner_institution, learner_name
    from public.students where id = new.student_id;
  if learner_institution is null or learner_institution <> new.institution_id then
    raise exception 'The invoice student must belong to this institution.';
  end if;
  new.student_name := learner_name;
  return new;
end;
$$;

drop trigger if exists invoice_student_relationship_guard on public.fee_invoices;
create trigger invoice_student_relationship_guard
before insert or update on public.fee_invoices
for each row execute function public.enforce_invoice_student_relationship();

-- Keep academic catalogue links inside the same institution.
create or replace function public.enforce_academic_reference_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_institution uuid;
begin
  if tg_table_name = 'programs' then
    if new.department_id is not null then
      select institution_id into linked_institution
        from public.departments where id = new.department_id;
      if linked_institution is distinct from new.institution_id then
        raise exception 'The selected department must belong to this institution.';
      end if;
    end if;
  elsif tg_table_name = 'classes' then
    if new.program_id is not null then
      select institution_id into linked_institution
        from public.programs where id = new.program_id;
      if linked_institution is distinct from new.institution_id then
        raise exception 'The selected program must belong to this institution.';
      end if;
    end if;
    if new.academic_session_id is not null then
      select institution_id into linked_institution
        from public.academic_sessions where id = new.academic_session_id;
      if linked_institution is distinct from new.institution_id then
        raise exception 'The selected academic session must belong to this institution.';
      end if;
    end if;
  elsif tg_table_name = 'subjects' then
    if new.department_id is not null then
      select institution_id into linked_institution
        from public.departments where id = new.department_id;
      if linked_institution is distinct from new.institution_id then
        raise exception 'The selected department must belong to this institution.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists programs_reference_tenant_check on public.programs;
create trigger programs_reference_tenant_check
before insert or update on public.programs
for each row execute function public.enforce_academic_reference_tenant();

drop trigger if exists classes_reference_tenant_check on public.classes;
create trigger classes_reference_tenant_check
before insert or update on public.classes
for each row execute function public.enforce_academic_reference_tenant();

drop trigger if exists subjects_reference_tenant_check on public.subjects;
create trigger subjects_reference_tenant_check
before insert or update on public.subjects
for each row execute function public.enforce_academic_reference_tenant();

-- Resolve results from the selected exam and student, and enforce class/tenant consistency.
create or replace function public.enforce_exam_result_relationships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  exam_institution uuid;
  exam_class text;
  exam_name text;
  exam_subject text;
  exam_total numeric;
  learner_institution uuid;
  learner_class text;
  learner_name text;
begin
  if new.exam_id is null then
    if tg_op = 'INSERT' then
      raise exception 'Select an examination before saving a new result.';
    end if;
    return new; -- Existing legacy results can be retained.
  end if;

  select institution_id, class_name, title, subject, total_marks
    into exam_institution, exam_class, exam_name, exam_subject, exam_total
    from public.exams where id = new.exam_id;
  if exam_institution is null or exam_institution <> new.institution_id then
    raise exception 'The selected examination must belong to this institution.';
  end if;

  select institution_id, class_name, full_name
    into learner_institution, learner_class, learner_name
    from public.students where id = new.student_id;
  if learner_institution is null or learner_institution <> new.institution_id then
    raise exception 'The selected student must belong to this institution.';
  end if;
  if exam_class is distinct from learner_class then
    raise exception 'The student is not enrolled in the class scheduled for this examination.';
  end if;
  if exam_total is null or exam_total <= 0 then
    raise exception 'The examination must have a positive total mark value.';
  end if;
  if new.marks_obtained < 0 or new.marks_obtained > exam_total then
    raise exception 'Marks obtained must be between zero and the examination total.';
  end if;

  new.student_name := learner_name;
  new.exam_title := exam_name;
  new.subject := exam_subject;
  new.total_marks := exam_total;
  return new;
end;
$$;

drop trigger if exists exam_result_relationship_guard on public.exam_results;
create trigger exam_result_relationship_guard
before insert or update on public.exam_results
for each row execute function public.enforce_exam_result_relationships();

-- Strengthen assignment submissions for staff as well as student accounts.
create or replace function public.guard_student_assignment_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  learner_institution uuid;
  learner_class text;
  actual_student_name text;
  assignment_institution uuid;
  assignment_class text;
  assignment_status text;
  maximum_points numeric;
  actual_assignment_title text;
  is_teaching_staff boolean;
begin
  is_teaching_staff := public.has_institution_role(new.institution_id, array['owner','admin','teacher']);

  select institution_id, class_name, title, status, points
    into assignment_institution, assignment_class, actual_assignment_title, assignment_status, maximum_points
    from public.assignments where id = new.assignment_id;
  if assignment_institution is null or assignment_institution <> new.institution_id then
    raise exception 'The selected assignment must belong to this institution.';
  end if;

  select institution_id, class_name, full_name
    into learner_institution, learner_class, actual_student_name
    from public.students where id = new.student_id;
  if learner_institution is null or learner_institution <> new.institution_id then
    raise exception 'The selected student must belong to this institution.';
  end if;
  if learner_class is distinct from assignment_class then
    raise exception 'The selected student is not enrolled in the assignment class.';
  end if;

  new.assignment_title := actual_assignment_title;
  new.student_name := actual_student_name;

  if not is_teaching_staff then
    if auth.uid() is null or not exists (
      select 1 from public.students s
      where s.id = new.student_id and s.institution_id = new.institution_id and s.user_id = auth.uid()
    ) then
      raise exception 'You may submit work only for your own linked student account.';
    end if;
    if assignment_status <> 'open' then
      raise exception 'This assignment is closed and is no longer accepting submissions.';
    end if;
    if tg_op = 'UPDATE' and (
      new.institution_id is distinct from old.institution_id
      or new.assignment_id is distinct from old.assignment_id
      or new.student_id is distinct from old.student_id
      or new.marks_obtained is distinct from old.marks_obtained
      or new.feedback is distinct from old.feedback
      or new.status not in ('submitted','late')
    ) then
      raise exception 'Students may update their submission content only; grading is reserved for teaching staff.';
    end if;
    if new.marks_obtained is not null or new.feedback is not null or new.status not in ('submitted','late') then
      raise exception 'Only teaching staff may grade or return an assignment.';
    end if;
  end if;

  if new.marks_obtained is not null and maximum_points is not null and new.marks_obtained > maximum_points then
    raise exception 'Marks awarded cannot exceed the assignment maximum.';
  end if;
  if new.status = 'graded' and new.marks_obtained is null then
    raise exception 'Enter marks before marking this assignment as graded.';
  end if;
  return new;
end;
$$;

-- Prevent timetable overlaps even when simultaneous users submit conflicting slots.
create or replace function public.guard_timetable_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.start_time is null or new.end_time is null then
    raise exception 'A timetable entry requires both a start time and an end time.';
  end if;
  if new.end_time <= new.start_time then
    raise exception 'The timetable end time must be later than the start time.';
  end if;

  -- Serialize schedule writes per institution to avoid race-condition overlaps.
  perform pg_advisory_xact_lock(hashtextextended('edusphere-timetable:' || new.institution_id::text, 0));

  if exists (
    select 1
      from public.timetable_entries t
     where t.institution_id = new.institution_id
       and t.id <> new.id
       and t.weekday = new.weekday
       and t.start_time is not null
       and t.end_time is not null
       and t.start_time < new.end_time
       and t.end_time > new.start_time
       and (
         t.class_name = new.class_name
         or (nullif(btrim(new.teacher_name), '') is not null and t.teacher_name = new.teacher_name)
         or (nullif(btrim(new.room), '') is not null and t.room = new.room)
       )
  ) then
    raise exception 'This timetable slot overlaps an existing class, teacher or room booking.';
  end if;
  return new;
end;
$$;

drop trigger if exists timetable_overlap_guard on public.timetable_entries;
create trigger timetable_overlap_guard
before insert or update on public.timetable_entries
for each row execute function public.guard_timetable_overlap();

commit;
