-- Authorised human review and reconciliation for signed attendance-device events.
-- The device event remains immutable evidence; only its review metadata may change.

alter table public.employee_attendance
  add column if not exists correction_reason text,
  add column if not exists corrected_by uuid references auth.users(id) on delete set null,
  add column if not exists corrected_at timestamptz;

alter table public.attendance_device_events
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_action text,
  add column if not exists review_note text,
  add column if not exists correction_reason text,
  add column if not exists attendance_register_id uuid references public.attendance_registers(id) on delete set null,
  add column if not exists attendance_record_id uuid,
  add column if not exists attendance_record_type text;

alter table public.attendance_device_events
  drop constraint if exists attendance_device_events_review_action_check,
  add constraint attendance_device_events_review_action_check
    check (review_action is null or review_action in ('approved','rejected')),
  drop constraint if exists attendance_device_events_record_type_check,
  add constraint attendance_device_events_record_type_check
    check (attendance_record_type is null or attendance_record_type in ('attendance','employee_attendance')),
  drop constraint if exists attendance_device_events_review_consistency_check,
  add constraint attendance_device_events_review_consistency_check
    check (
      (review_action is null and reviewed_by is null and reviewed_at is null)
      or
      (review_action is not null and reviewed_by is not null and reviewed_at is not null and length(btrim(coalesce(review_note,''))) >= 5)
    );

create index if not exists attendance_device_events_reviewed_idx
  on public.attendance_device_events(institution_id, reviewed_at desc)
  where reviewed_at is not null;

create or replace function public.guard_attendance_device_event_review()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
    or new.institution_id is distinct from old.institution_id
    or new.source_id is distinct from old.source_id
    or new.external_event_id is distinct from old.external_event_id
    or new.student_id is distinct from old.student_id
    or new.teacher_id is distinct from old.teacher_id
    or new.occurred_at is distinct from old.occurred_at
    or new.event_kind is distinct from old.event_kind
    or new.raw_payload is distinct from old.raw_payload
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Original device event evidence is immutable.';
  end if;

  if old.processing_status <> 'received' then
    raise exception 'This device event has already been reviewed and cannot be changed.';
  end if;

  if new.processing_status not in ('processed','rejected')
    or new.review_action not in ('approved','rejected')
    or new.reviewed_by is null
    or new.reviewed_at is null
    or length(btrim(coalesce(new.review_note,''))) < 5
  then
    raise exception 'A device event must receive a valid approval or rejection with an audit note.';
  end if;

  if (new.processing_status = 'processed' and new.review_action <> 'approved')
    or (new.processing_status = 'rejected' and new.review_action <> 'rejected')
  then
    raise exception 'Device-event review action and processing status do not match.';
  end if;

  return new;
end;
$$;

drop trigger if exists attendance_device_event_review_guard on public.attendance_device_events;
create trigger attendance_device_event_review_guard
before update on public.attendance_device_events
for each row execute function public.guard_attendance_device_event_review();

-- Review is performed only through the RPC below. This prevents a browser from
-- directly changing a received event's identity, timestamp, outcome or audit fields.
revoke update on public.attendance_device_events from anon, authenticated;

drop policy if exists attendance_device_events_admin_read on public.attendance_device_events;
drop policy if exists attendance_device_events_authorised_review_read on public.attendance_device_events;
create policy attendance_device_events_authorised_review_read
  on public.attendance_device_events
  for select to authenticated
  using (
    public.has_institution_role(institution_id, array['owner','admin'])
    or (
      student_id is not null
      and public.has_institution_role(institution_id, array['teacher'])
    )
  );

create or replace function public.review_attendance_device_event(
  p_event_id uuid,
  p_action text,
  p_attendance_date date default null,
  p_period_label text default 'Daily',
  p_attendance_status text default 'present',
  p_event_time time without time zone default null,
  p_review_note text default null,
  p_correction_reason text default null,
  p_shift_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.attendance_device_events%rowtype;
  v_provider_type text;
  v_method text;
  v_review_note text := nullif(btrim(p_review_note), '');
  v_correction_reason text := nullif(btrim(p_correction_reason), '');
  v_user_id uuid := auth.uid();

  v_student public.students%rowtype;
  v_teacher public.teachers%rowtype;
  v_session_id uuid;
  v_register_id uuid;
  v_register_status text;
  v_register_campus_id uuid;
  v_register_section_name text;
  v_register_method text;
  v_record_id uuid;
  v_record_register_id uuid;
  v_record_source text;
  v_existing_check_time time;
  v_existing_other_time time;
  v_record_shift_id uuid;

  v_population_label text;
  v_shift_start time;
  v_shift_end time;
  v_grace_minutes integer := 0;
  v_minutes_late integer := 0;
  v_early_minutes integer := 0;
  v_total integer := 0;
  v_present integer := 0;
  v_absent integer := 0;
  v_late integer := 0;
begin
  if v_user_id is null then
    raise exception 'Sign in before reviewing attendance events.';
  end if;

  if p_action not in ('approve','reject') then
    raise exception 'Choose approve or reject for this attendance event.';
  end if;

  select *
    into v_event
    from public.attendance_device_events
   where id = p_event_id
   for update;

  if not found then
    raise exception 'The attendance event was not found in this institution.';
  end if;

  if v_event.processing_status <> 'received' then
    return jsonb_build_object(
      'event_id', v_event.id,
      'status', v_event.processing_status,
      'already_reviewed', true,
      'attendance_record_id', v_event.attendance_record_id,
      'attendance_register_id', v_event.attendance_register_id
    );
  end if;

  if length(coalesce(v_review_note,'')) < 5 then
    raise exception 'Enter an audit note of at least five characters.';
  end if;

  if v_event.student_id is not null then
    if not public.has_institution_role(v_event.institution_id, array['owner','admin','teacher']) then
      raise exception 'Only an authorised owner, administrator or teacher can review student attendance events.';
    end if;
  elsif v_event.teacher_id is not null then
    if not public.has_institution_role(v_event.institution_id, array['owner','admin']) then
      raise exception 'Only an institution owner or administrator can review employee attendance events.';
    end if;
  else
    raise exception 'The device event does not identify exactly one person.';
  end if;

  if p_action = 'reject' then
    update public.attendance_device_events
       set processing_status = 'rejected',
           processed_at = now(),
           reviewed_by = v_user_id,
           reviewed_at = now(),
           review_action = 'rejected',
           review_note = v_review_note,
           correction_reason = v_correction_reason,
           error_message = v_review_note
     where id = v_event.id;

    return jsonb_build_object(
      'event_id', v_event.id,
      'status', 'rejected',
      'attendance_record_created', false
    );
  end if;

  if p_attendance_date is null or p_event_time is null then
    raise exception 'Confirm the attendance date and local event time before approval.';
  end if;

  if v_event.event_kind not in ('check_in','check_out') then
    raise exception 'This device event type is not supported for attendance reconciliation.';
  end if;

  select provider_type
    into v_provider_type
    from public.attendance_device_sources
   where id = v_event.source_id
     and institution_id = v_event.institution_id;

  if not found then
    raise exception 'The original attendance device source is no longer available.';
  end if;

  v_method := case
    when v_provider_type in ('qr','rfid','biometric') then v_provider_type
    else 'api'
  end;

  if v_event.student_id is not null then
    select *
      into v_student
      from public.students
     where id = v_event.student_id
       and institution_id = v_event.institution_id
       and status = 'active';

    if not found then
      raise exception 'The linked student is no longer active in this institution.';
    end if;

    if coalesce(btrim(v_student.class_name),'') = '' then
      raise exception 'The linked student does not have a class. Correct the student placement before approval.';
    end if;

    if coalesce(btrim(p_period_label),'') = '' or length(p_period_label) > 40 then
      raise exception 'Select a valid student attendance period.';
    end if;

    if v_event.event_kind = 'check_in' and p_attendance_status not in ('present','late') then
      raise exception 'A student device check-in can be approved as Present or Late only.';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(
      v_event.institution_id::text || ':student:' || v_student.id::text || ':' ||
      p_attendance_date::text || ':' || p_period_label,
      0
    ));

    select id, source, arrival_time, departure_time, register_id
      into v_record_id, v_record_source, v_existing_check_time, v_existing_other_time, v_record_register_id
      from public.attendance
     where institution_id = v_event.institution_id
       and student_id = v_student.id
       and attendance_date = p_attendance_date
       and period_label = p_period_label
     for update;

    if v_event.event_kind = 'check_out' and v_record_id is null then
      raise exception 'No approved student check-in exists for this date and period. Review the check-in event first.';
    end if;

    if v_record_register_id is not null then
      select id, status, campus_id, section_name, method, academic_session_id
        into v_register_id, v_register_status, v_register_campus_id, v_register_section_name, v_register_method, v_session_id
        from public.attendance_registers
       where id = v_record_register_id
         and institution_id = v_event.institution_id
       for update;
    end if;

    if v_register_id is null then
      select id
        into v_session_id
        from public.academic_sessions
       where institution_id = v_event.institution_id
         and is_active = true
         and is_current = true
         and (campus_id is null or campus_id = v_student.campus_id)
       order by (campus_id is not null) desc, created_at desc
       limit 1;

      perform pg_advisory_xact_lock(hashtextextended(
        v_event.institution_id::text || ':student-register:' ||
        v_student.class_name || ':' || p_attendance_date::text || ':' ||
        p_period_label || ':' || coalesce(v_session_id::text,''),
        0
      ));

      select id, status, campus_id, section_name, method, academic_session_id
        into v_register_id, v_register_status, v_register_campus_id, v_register_section_name, v_register_method, v_session_id
        from public.attendance_registers
       where institution_id = v_event.institution_id
         and population = 'student'
         and class_name = v_student.class_name
         and attendance_date = p_attendance_date
         and period_label = p_period_label
         and academic_session_id is not distinct from v_session_id
       for update;

      if v_register_id is null then
        insert into public.attendance_registers(
          institution_id, campus_id, academic_session_id, population, class_name,
          section_name, attendance_date, period_label, method, status,
          total_count, present_count, absent_count, late_count, created_by
        ) values (
          v_event.institution_id, v_student.campus_id, v_session_id, 'student',
          v_student.class_name, v_student.section_name, p_attendance_date,
          p_period_label, v_method, 'saved', 0, 0, 0, 0, v_user_id
        )
        returning id, status, campus_id, section_name, method, academic_session_id
          into v_register_id, v_register_status, v_register_campus_id, v_register_section_name, v_register_method, v_session_id;
      end if;
    end if;

    if v_register_status = 'locked' then
      raise exception 'This student attendance register is locked. An authorised reopen approval is required before device events can be applied.';
    end if;

    if v_register_campus_id is not null and v_student.campus_id is not null
       and v_register_campus_id <> v_student.campus_id then
      raise exception 'The existing attendance register belongs to another campus. Review the campus scope before approval.';
    end if;

    if v_register_section_name is not null and v_student.section_name is not null
       and v_register_section_name <> v_student.section_name then
      update public.attendance_registers
         set section_name = null, updated_at = now()
       where id = v_register_id;
    end if;

    if v_register_status = 'published' and v_correction_reason is null then
      raise exception 'This register is already published. Enter a correction reason before adding or changing device attendance.';
    end if;

    if v_record_id is not null and (
      coalesce(v_record_source,'manual') = 'manual'
      or (v_event.event_kind = 'check_in' and v_existing_check_time is not null)
      or (v_event.event_kind = 'check_out' and v_existing_other_time is not null)
    ) and v_correction_reason is null then
      raise exception 'An attendance entry already exists. Enter a correction reason before replacing its device time or source.';
    end if;

    if v_register_method <> v_method and v_register_method is not null then
      update public.attendance_registers
         set method = 'api', updated_at = now()
       where id = v_register_id;
    end if;

    if v_event.event_kind = 'check_in' then
      if v_record_id is null then
        insert into public.attendance(
          institution_id, student_id, student_name, class_name, attendance_date,
          status, notes, created_by, period_label, register_id, campus_id,
          academic_session_id, source, recorded_at, arrival_time, departure_time,
          minutes_late, early_departure_minutes
        ) values (
          v_event.institution_id, v_student.id, v_student.full_name, v_student.class_name,
          p_attendance_date, p_attendance_status, v_review_note, v_user_id, p_period_label,
          v_register_id, v_student.campus_id, v_session_id, v_method, now(), p_event_time,
          null, 0, 0
        )
        returning id into v_record_id;
      else
        update public.attendance
           set student_name = v_student.full_name,
               class_name = v_student.class_name,
               status = p_attendance_status,
               notes = v_review_note,
               created_by = v_user_id,
               register_id = v_register_id,
               campus_id = v_student.campus_id,
               academic_session_id = v_session_id,
               source = v_method,
               recorded_at = now(),
               arrival_time = p_event_time,
               correction_reason = case when v_correction_reason is not null then v_correction_reason else correction_reason end,
               corrected_by = case when v_correction_reason is not null then v_user_id else corrected_by end,
               corrected_at = case when v_correction_reason is not null then now() else corrected_at end,
               updated_at = now()
         where id = v_record_id;
      end if;
    else
      update public.attendance
         set departure_time = p_event_time,
             notes = coalesce(v_review_note, notes),
             correction_reason = case when v_correction_reason is not null then v_correction_reason else correction_reason end,
             corrected_by = case when v_correction_reason is not null then v_user_id else corrected_by end,
             corrected_at = case when v_correction_reason is not null then now() else corrected_at end,
             updated_at = now()
       where id = v_record_id;
    end if;

    update public.attendance_registers r
       set total_count = q.total_count,
           present_count = q.present_count,
           absent_count = q.absent_count,
           late_count = q.late_count,
           updated_at = now()
      from (
        select count(*)::integer as total_count,
               count(*) filter (where status in ('present','late'))::integer as present_count,
               count(*) filter (where status = 'absent')::integer as absent_count,
               count(*) filter (where status = 'late')::integer as late_count
          from public.attendance
         where register_id = v_register_id
      ) q
     where r.id = v_register_id;

    update public.attendance_device_events
       set processing_status = 'processed',
           processed_at = now(),
           reviewed_by = v_user_id,
           reviewed_at = now(),
           review_action = 'approved',
           review_note = v_review_note,
           correction_reason = v_correction_reason,
           attendance_register_id = v_register_id,
           attendance_record_id = v_record_id,
           attendance_record_type = 'attendance',
           error_message = null
     where id = v_event.id;

    return jsonb_build_object(
      'event_id', v_event.id,
      'status', 'processed',
      'population', 'student',
      'attendance_record_id', v_record_id,
      'attendance_register_id', v_register_id
    );
  end if;

  select *
    into v_teacher
    from public.teachers
   where id = v_event.teacher_id
     and institution_id = v_event.institution_id
     and employment_status = 'active';

  if not found then
    raise exception 'The linked employee is no longer active in this institution.';
  end if;

  v_population_label := case when lower(v_teacher.employee_type) = 'teaching' then 'Teachers' else 'Staff' end;

  perform pg_advisory_xact_lock(hashtextextended(
    v_event.institution_id::text || ':employee:' || v_teacher.id::text || ':' || p_attendance_date::text,
    0
  ));

  select id, source, check_in_time, check_out_time, register_id, shift_id
    into v_record_id, v_record_source, v_existing_check_time, v_existing_other_time, v_record_register_id, v_record_shift_id
    from public.employee_attendance
   where institution_id = v_event.institution_id
     and teacher_id = v_teacher.id
     and attendance_date = p_attendance_date
   for update;

  if v_event.event_kind = 'check_out' and v_record_id is null then
    raise exception 'No employee check-in exists for this date. Review the check-in event first.';
  end if;

  if p_shift_id is not null then
    select start_time, end_time, grace_minutes
      into v_shift_start, v_shift_end, v_grace_minutes
      from public.employee_shifts
     where id = p_shift_id
       and institution_id = v_event.institution_id
       and is_active = true
       and (campus_id is null or campus_id = v_teacher.campus_id);

    if not found then
      raise exception 'The selected employee shift is not active for this institution and campus.';
    end if;
  elsif v_record_shift_id is not null then
    select start_time, end_time, grace_minutes
      into v_shift_start, v_shift_end, v_grace_minutes
      from public.employee_shifts
     where id = v_record_shift_id
       and institution_id = v_event.institution_id;
  end if;

  if v_record_register_id is not null then
    select id, status, campus_id, section_name, method
      into v_register_id, v_register_status, v_register_campus_id, v_register_section_name, v_register_method
      from public.attendance_registers
     where id = v_record_register_id
       and institution_id = v_event.institution_id
     for update;
  end if;

  if v_register_id is null then
    perform pg_advisory_xact_lock(hashtextextended(
      v_event.institution_id::text || ':employee-register:' || v_population_label || ':' || p_attendance_date::text,
      0
    ));

    select id, status, campus_id, section_name, method
      into v_register_id, v_register_status, v_register_campus_id, v_register_section_name, v_register_method
      from public.attendance_registers
     where institution_id = v_event.institution_id
       and population = 'staff'
       and class_name = v_population_label
       and attendance_date = p_attendance_date
       and period_label = 'Daily'
       and academic_session_id is null
     for update;

    if v_register_id is null then
      insert into public.attendance_registers(
        institution_id, campus_id, population, class_name, attendance_date,
        period_label, method, status, total_count, present_count, absent_count,
        late_count, created_by
      ) values (
        v_event.institution_id, v_teacher.campus_id, 'staff', v_population_label,
        p_attendance_date, 'Daily', v_method, 'saved', 0, 0, 0, 0, v_user_id
      )
      returning id, status, campus_id, section_name, method
        into v_register_id, v_register_status, v_register_campus_id, v_register_section_name, v_register_method;
    end if;
  end if;

  if v_register_status = 'locked' then
    raise exception 'This employee attendance register is locked. An authorised reopen approval is required before device events can be applied.';
  end if;

  if v_register_campus_id is not null and v_teacher.campus_id is not null
     and v_register_campus_id <> v_teacher.campus_id then
    raise exception 'The existing attendance register belongs to another campus. Review the campus scope before approval.';
  end if;

  if v_register_status = 'published' and v_correction_reason is null then
    raise exception 'This register is already published. Enter a correction reason before adding or changing device attendance.';
  end if;

  if v_record_id is not null and (
    coalesce(v_record_source,'manual') = 'manual'
    or (v_event.event_kind = 'check_in' and v_existing_check_time is not null)
    or (v_event.event_kind = 'check_out' and v_existing_other_time is not null)
  ) and v_correction_reason is null then
    raise exception 'An employee attendance entry already exists. Enter a correction reason before replacing its device time or source.';
  end if;

  if v_register_method <> v_method and v_register_method is not null then
    update public.attendance_registers
       set method = 'api', updated_at = now()
     where id = v_register_id;
  end if;

  if v_event.event_kind = 'check_in' then
    if p_attendance_status not in ('present','late','remote','half_day') then
      raise exception 'Choose a valid employee attendance status.';
    end if;

    if v_shift_start is not null and p_event_time > (v_shift_start + make_interval(mins => coalesce(v_grace_minutes,0))) then
      v_minutes_late := greatest(0, (extract(epoch from (p_event_time - v_shift_start)) / 60)::integer - coalesce(v_grace_minutes,0));
    end if;

    if v_record_id is null then
      insert into public.employee_attendance(
        institution_id, teacher_id, attendance_date, check_in_time, check_out_time,
        status, notes, recorded_by, register_id, source, campus_id, shift_id,
        minutes_late, early_departure_minutes
      ) values (
        v_event.institution_id, v_teacher.id, p_attendance_date, p_event_time, null,
        p_attendance_status, v_review_note, v_user_id, v_register_id, v_method,
        v_teacher.campus_id, p_shift_id, v_minutes_late, 0
      )
      returning id into v_record_id;
    else
      update public.employee_attendance
         set check_in_time = p_event_time,
             status = p_attendance_status,
             notes = v_review_note,
             recorded_by = v_user_id,
             register_id = v_register_id,
             source = v_method,
             campus_id = v_teacher.campus_id,
             shift_id = coalesce(p_shift_id, shift_id),
             minutes_late = v_minutes_late,
             correction_reason = case when v_correction_reason is not null then v_correction_reason else correction_reason end,
             corrected_by = case when v_correction_reason is not null then v_user_id else corrected_by end,
             corrected_at = case when v_correction_reason is not null then now() else corrected_at end,
             updated_at = now()
       where id = v_record_id;
    end if;
  else
    if v_shift_end is not null and p_event_time < v_shift_end then
      v_early_minutes := greatest(0, (extract(epoch from (v_shift_end - p_event_time)) / 60)::integer);
    end if;

    update public.employee_attendance
       set check_out_time = p_event_time,
           notes = coalesce(v_review_note, notes),
           shift_id = coalesce(p_shift_id, shift_id),
           early_departure_minutes = v_early_minutes,
           correction_reason = case when v_correction_reason is not null then v_correction_reason else correction_reason end,
           corrected_by = case when v_correction_reason is not null then v_user_id else corrected_by end,
           corrected_at = case when v_correction_reason is not null then now() else corrected_at end,
           updated_at = now()
     where id = v_record_id;
  end if;

  update public.attendance_registers r
     set total_count = q.total_count,
         present_count = q.present_count,
         absent_count = q.absent_count,
         late_count = q.late_count,
         updated_at = now()
    from (
      select count(*)::integer as total_count,
             count(*) filter (where status in ('present','late','remote'))::integer as present_count,
             count(*) filter (where status = 'absent')::integer as absent_count,
             count(*) filter (where status = 'late')::integer as late_count
        from public.employee_attendance
       where register_id = v_register_id
    ) q
   where r.id = v_register_id;

  update public.attendance_device_events
     set processing_status = 'processed',
         processed_at = now(),
         reviewed_by = v_user_id,
         reviewed_at = now(),
         review_action = 'approved',
         review_note = v_review_note,
         correction_reason = v_correction_reason,
         attendance_register_id = v_register_id,
         attendance_record_id = v_record_id,
         attendance_record_type = 'employee_attendance',
         error_message = null
   where id = v_event.id;

  return jsonb_build_object(
    'event_id', v_event.id,
    'status', 'processed',
    'population', 'employee',
    'attendance_record_id', v_record_id,
    'attendance_register_id', v_register_id
  );
end;
$$;

revoke all on function public.review_attendance_device_event(uuid,text,date,text,text,time,text,text,uuid) from public, anon;
grant execute on function public.review_attendance_device_event(uuid,text,date,text,text,time,text,text,uuid) to authenticated;
