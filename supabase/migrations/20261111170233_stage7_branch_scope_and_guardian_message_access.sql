create or replace function public.guard_stage7_campus_scope()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.campus_id is not null and not exists (
    select 1 from public.campuses c where c.id=new.campus_id and c.institution_id=new.institution_id
  ) then
    raise exception 'The selected branch does not belong to this institution.';
  end if;
  return new;
end;
$$;

drop trigger if exists stage7_employee_shifts_campus_guard on public.employee_shifts;
create trigger stage7_employee_shifts_campus_guard before insert or update of campus_id,institution_id
on public.employee_shifts for each row execute function public.guard_stage7_campus_scope();

drop trigger if exists stage7_student_leave_campus_guard on public.student_leave_requests;
create trigger stage7_student_leave_campus_guard before insert or update of campus_id,institution_id
on public.student_leave_requests for each row execute function public.guard_stage7_campus_scope();

drop trigger if exists stage7_employee_leave_campus_guard on public.employee_leave_requests;
create trigger stage7_employee_leave_campus_guard before insert or update of campus_id,institution_id
on public.employee_leave_requests for each row execute function public.guard_stage7_campus_scope();

drop policy if exists stage7_discipline_staff_guardian_lookup on public.student_guardians;
create policy stage7_discipline_staff_guardian_lookup on public.student_guardians
for select to authenticated using (
  exists (
    select 1 from public.student_care_access a
    where a.institution_id=student_guardians.institution_id
      and a.user_id=(select auth.uid())
      and a.area='discipline' and a.can_write
  )
);

drop policy if exists stage7_discipline_communications_insert on public.student_discipline_communications;
create policy stage7_discipline_communications_insert on public.student_discipline_communications
for insert to authenticated with check (
  created_by=(select auth.uid())
  and exists (
    select 1 from public.student_guardians g
    where g.institution_id=student_discipline_communications.institution_id
      and g.student_id=student_discipline_communications.student_id
      and g.parent_user_id=student_discipline_communications.sent_to_parent_user_id
  )
  and (
    public.has_institution_role(institution_id,array['owner','admin'])
    or exists (
      select 1 from public.student_care_access a
      where a.institution_id=student_discipline_communications.institution_id
        and a.user_id=(select auth.uid()) and a.area='discipline' and a.can_write
    )
  )
);

create or replace function public.save_student_attendance_register(
  p_institution_id uuid,p_attendance_date date,p_class_name text,p_section_name text,
  p_campus_id uuid,p_period_label text,p_rows jsonb,p_late_after time default '08:00'
)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_item jsonb; v_student_id uuid; v_status text; v_count integer:=0;
  v_present integer:=0; v_absent integer:=0; v_late integer:=0; v_register_id uuid;
  v_student_name text; v_minutes_late integer; v_early_minutes integer; v_arrival time; v_departure time;
begin
  if not public.has_institution_role(p_institution_id,array['owner','admin','teacher']) then
    raise exception 'You do not have permission to record student attendance.';
  end if;
  if coalesce(btrim(p_class_name),'')='' or coalesce(btrim(p_period_label),'')='' then
    raise exception 'Select a class and attendance period.';
  end if;
  if p_campus_id is not null and not exists(select 1 from public.campuses c where c.id=p_campus_id and c.institution_id=p_institution_id) then
    raise exception 'The selected branch does not belong to this institution.';
  end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>500 then
    raise exception 'The attendance register must contain between 1 and 500 students.';
  end if;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_student_id:=(v_item->>'student_id')::uuid;
    v_status:=coalesce(v_item->>'status','present');
    if v_status not in ('present','absent','late','approved_leave','excused') then raise exception 'Invalid student attendance status.'; end if;
    select s.full_name into v_student_name from public.students s
      where s.id=v_student_id and s.institution_id=p_institution_id
        and s.class_name=p_class_name and s.status='active'
        and (p_campus_id is null or s.campus_id=p_campus_id);
    if v_student_name is null then raise exception 'A selected student is not active in this institution, branch and class.'; end if;
    v_count:=v_count+1;
    if v_status='present' then v_present:=v_present+1; end if;
    if v_status='absent' then v_absent:=v_absent+1; end if;
    if v_status='late' then v_late:=v_late+1; end if;
  end loop;
  if (select count(distinct(value->>'student_id')) from jsonb_array_elements(p_rows))<>v_count then
    raise exception 'A student appears more than once in this attendance register.';
  end if;
  insert into public.attendance_registers(
    institution_id,campus_id,population,class_name,section_name,attendance_date,period_label,method,status,
    total_count,present_count,absent_count,late_count,created_by,published_by,published_at
  ) values(
    p_institution_id,p_campus_id,'student',p_class_name,nullif(p_section_name,''),p_attendance_date,
    p_period_label,'manual','saved',v_count,v_present,v_absent,v_late,(select auth.uid()),(select auth.uid()),now()
  ) returning id into v_register_id;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_student_id:=(v_item->>'student_id')::uuid;
    v_status:=coalesce(v_item->>'status','present');
    v_arrival:=nullif(v_item->>'arrival_time','')::time;
    v_departure:=nullif(v_item->>'departure_time','')::time;
    v_minutes_late:=case when v_status='late' and v_arrival is not null then greatest(0,extract(epoch from(v_arrival-p_late_after))/60)::integer else 0 end;
    v_early_minutes:=greatest(0,coalesce((v_item->>'early_departure_minutes')::integer,0));
    select s.full_name into v_student_name from public.students s
      where s.id=v_student_id and s.institution_id=p_institution_id
        and s.class_name=p_class_name and s.status='active'
        and (p_campus_id is null or s.campus_id=p_campus_id);
    insert into public.attendance(
      institution_id,student_id,student_name,class_name,attendance_date,status,notes,created_by,period_label,
      register_id,campus_id,source,recorded_at,arrival_time,departure_time,minutes_late,early_departure_minutes
    ) values(
      p_institution_id,v_student_id,v_student_name,p_class_name,p_attendance_date,v_status,nullif(v_item->>'notes',''),
      (select auth.uid()),p_period_label,v_register_id,p_campus_id,'manual',now(),v_arrival,v_departure,v_minutes_late,v_early_minutes
    )
    on conflict(institution_id,student_id,attendance_date,period_label) where student_id is not null
    do update set student_name=excluded.student_name,class_name=excluded.class_name,status=excluded.status,notes=excluded.notes,
      register_id=excluded.register_id,campus_id=excluded.campus_id,arrival_time=excluded.arrival_time,departure_time=excluded.departure_time,
      minutes_late=excluded.minutes_late,early_departure_minutes=excluded.early_departure_minutes,
      correction_reason=nullif(v_item->>'correction_reason',''),corrected_by=(select auth.uid()),corrected_at=now(),updated_at=now();
  end loop;
  return jsonb_build_object('register_id',v_register_id,'total',v_count,'present',v_present,'absent',v_absent,'late',v_late);
end;
$$;

create or replace function public.save_employee_attendance_register(
  p_institution_id uuid,p_attendance_date date,p_population text,p_campus_id uuid,p_shift_id uuid,p_rows jsonb
)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_item jsonb; v_teacher_id uuid; v_status text; v_employee_type text;
  v_count integer:=0; v_present integer:=0; v_absent integer:=0; v_late integer:=0; v_register_id uuid;
  v_check_in time; v_check_out time; v_shift_start time; v_shift_end time; v_grace integer;
  v_late_minutes integer; v_early_minutes integer;
begin
  if p_population not in ('teacher','staff') then raise exception 'Invalid employee group.'; end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin']) then
    raise exception 'Only an owner or administrator can record employee attendance.';
  end if;
  if p_campus_id is not null and not exists(select 1 from public.campuses c where c.id=p_campus_id and c.institution_id=p_institution_id) then
    raise exception 'The selected branch does not belong to this institution.';
  end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>500 then
    raise exception 'The attendance register must contain between 1 and 500 employees.';
  end if;
  if p_shift_id is not null then
    select start_time,end_time,grace_minutes into v_shift_start,v_shift_end,v_grace
      from public.employee_shifts where id=p_shift_id and institution_id=p_institution_id and is_active;
    if not found then raise exception 'The selected shift is not available for this institution.'; end if;
  end if;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_teacher_id:=(v_item->>'teacher_id')::uuid;
    v_status:=coalesce(v_item->>'status','present');
    if v_status not in ('present','absent','late','approved_leave','excused','remote','half_day') then raise exception 'Invalid employee attendance status.'; end if;
    select t.employee_type into v_employee_type from public.teachers t
      where t.id=v_teacher_id and t.institution_id=p_institution_id and t.employment_status='active'
        and (p_campus_id is null or t.campus_id=p_campus_id);
    if v_employee_type is null then raise exception 'An employee is not active in this institution and branch.'; end if;
    if p_population='teacher' and lower(v_employee_type)<>'teaching' then raise exception 'A non-teaching employee was included in teacher attendance.'; end if;
    if p_population='staff' and lower(v_employee_type)='teaching' then raise exception 'A teacher was included in staff attendance.'; end if;
    v_count:=v_count+1;
    if v_status in ('present','late','remote') then v_present:=v_present+1; end if;
    if v_status='absent' then v_absent:=v_absent+1; end if;
    if v_status='late' then v_late:=v_late+1; end if;
  end loop;
  if (select count(distinct(value->>'teacher_id')) from jsonb_array_elements(p_rows))<>v_count then
    raise exception 'An employee appears more than once in this attendance register.';
  end if;
  insert into public.attendance_registers(
    institution_id,campus_id,population,class_name,attendance_date,period_label,method,status,
    total_count,present_count,absent_count,late_count,created_by,published_by,published_at
  ) values(
    p_institution_id,p_campus_id,'staff',case when p_population='teacher' then 'Teachers' else 'Staff' end,
    p_attendance_date,'Daily','manual','saved',v_count,v_present,v_absent,v_late,(select auth.uid()),(select auth.uid()),now()
  ) returning id into v_register_id;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_teacher_id:=(v_item->>'teacher_id')::uuid;
    v_status:=coalesce(v_item->>'status','present');
    v_check_in:=nullif(v_item->>'check_in_time','')::time;
    v_check_out:=nullif(v_item->>'check_out_time','')::time;
    v_late_minutes:=case when v_shift_start is not null and v_check_in is not null and v_check_in>(v_shift_start+make_interval(mins=>coalesce(v_grace,0)))
      then greatest(0,extract(epoch from(v_check_in-v_shift_start))/60-coalesce(v_grace,0))::integer else 0 end;
    v_early_minutes:=case when v_shift_end is not null and v_check_out is not null and v_check_out<v_shift_end
      then greatest(0,extract(epoch from(v_shift_end-v_check_out))/60)::integer else 0 end;
    insert into public.employee_attendance(
      institution_id,teacher_id,attendance_date,check_in_time,check_out_time,status,notes,recorded_by,
      register_id,source,campus_id,shift_id,minutes_late,early_departure_minutes
    ) values(
      p_institution_id,v_teacher_id,p_attendance_date,v_check_in,v_check_out,v_status,nullif(v_item->>'notes',''),
      (select auth.uid()),v_register_id,'manual',p_campus_id,p_shift_id,v_late_minutes,v_early_minutes
    )
    on conflict(institution_id,teacher_id,attendance_date) do update set
      check_in_time=excluded.check_in_time,check_out_time=excluded.check_out_time,status=excluded.status,notes=excluded.notes,
      recorded_by=(select auth.uid()),register_id=excluded.register_id,source='manual',campus_id=excluded.campus_id,
      shift_id=excluded.shift_id,minutes_late=excluded.minutes_late,early_departure_minutes=excluded.early_departure_minutes,updated_at=now();
  end loop;
  return jsonb_build_object('register_id',v_register_id,'population',p_population,'total',v_count,'present',v_present,'absent',v_absent,'late',v_late);
end;
$$;
