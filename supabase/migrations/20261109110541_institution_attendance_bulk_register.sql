-- Explicit-institution bulk attendance RPC used by the P/A/L whole-class chart.
-- It is invoker-security: existing table RLS policies remain in force.
create or replace function public.save_institution_attendance_register(
 p_institution_id uuid,p_population text,p_class_name text,p_section_name text,
 p_attendance_date date,p_period_label text,p_academic_session_id uuid,p_rows jsonb
) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
 v_user uuid:=auth.uid();v_register uuid;v_total int:=0;v_present int:=0;v_absent int:=0;v_late int:=0;v_input int:=0;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 if not exists(select 1 from public.memberships m where m.institution_id=p_institution_id and m.user_id=v_user and m.status='active') then
  raise exception 'You do not have an active membership in this institution';
 end if;
 if p_population not in('student','staff') then raise exception 'Invalid register type';end if;
 if jsonb_typeof(p_rows)<>'array' then raise exception 'Attendance rows must be an array';end if;
 v_input:=jsonb_array_length(p_rows);
 if p_population='student' then
  if nullif(btrim(p_class_name),'') is null then raise exception 'Select a class first';end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin','teacher']) then raise exception 'You cannot record student attendance';end if;
 else
  if not public.has_institution_role(p_institution_id,array['owner','admin']) then raise exception 'Only institution administrators can record employee attendance';end if;
 end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) x(status text) where lower(x.status) not in('present','absent','late')) then
  raise exception 'Attendance accepts only Present, Absent or Late statuses';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text||':'||p_population||':'||coalesce(p_class_name,'')||':'||p_attendance_date::text||':'||coalesce(p_period_label,'Daily'),0));
 select ar.id into v_register from public.attendance_registers ar
 where ar.institution_id=p_institution_id and ar.population=p_population
 and coalesce(ar.class_name,'')=coalesce(p_class_name,'') and ar.attendance_date=p_attendance_date
 and ar.period_label=coalesce(p_period_label,'Daily') and ar.academic_session_id is not distinct from p_academic_session_id
 for update;
 if v_register is null then
  insert into public.attendance_registers(institution_id,population,class_name,section_name,attendance_date,period_label,academic_session_id,method,status,created_by)
  values(p_institution_id,p_population,nullif(p_class_name,''),nullif(p_section_name,''),p_attendance_date,coalesce(p_period_label,'Daily'),p_academic_session_id,'manual','saved',v_user)
  returning id into v_register;
 end if;
 if p_population='student' then
  with input_rows as(
   select distinct x.student_id,lower(x.status) status,x.notes,s.full_name from jsonb_to_recordset(p_rows) x(student_id uuid,status text,notes text)
   join public.students s on s.id=x.student_id and s.institution_id=p_institution_id and s.class_name=p_class_name and s.status='active'
  ),saved as(
   insert into public.attendance(institution_id,student_id,student_name,class_name,attendance_date,period_label,status,notes,created_by,register_id,academic_session_id,source,recorded_at)
   select p_institution_id,i.student_id,i.full_name,p_class_name,p_attendance_date,coalesce(p_period_label,'Daily'),i.status,i.notes,v_user,v_register,p_academic_session_id,'manual',now()
   from input_rows i
   on conflict(institution_id,student_id,attendance_date,period_label) where student_id is not null
   do update set status=excluded.status,notes=excluded.notes,register_id=excluded.register_id,academic_session_id=excluded.academic_session_id,source='manual',updated_at=now()
   returning status
  )
  select count(*),count(*) filter(where status='present'),count(*) filter(where status='absent'),count(*) filter(where status='late')
  into v_total,v_present,v_absent,v_late from saved;
 else
  with input_rows as(
   select distinct x.teacher_id,lower(x.status) status,x.notes from jsonb_to_recordset(p_rows) x(teacher_id uuid,status text,notes text)
   join public.teachers t on t.id=x.teacher_id and t.institution_id=p_institution_id
  ),saved as(
   insert into public.employee_attendance(institution_id,teacher_id,attendance_date,status,notes,recorded_by,register_id,source)
   select p_institution_id,i.teacher_id,p_attendance_date,i.status,i.notes,v_user,v_register,'manual'
   from input_rows i
   on conflict(institution_id,teacher_id,attendance_date)
   do update set status=excluded.status,notes=excluded.notes,register_id=excluded.register_id,source='manual',updated_at=now()
   returning status
  )
  select count(*),count(*) filter(where status='present'),count(*) filter(where status='absent'),count(*) filter(where status='late')
  into v_total,v_present,v_absent,v_late from saved;
 end if;
 if v_total<>v_input then raise exception 'One or more attendance entries do not belong to this roster. Nothing was saved.';end if;
 update public.attendance_registers set status='saved',total_count=v_total,present_count=v_present,absent_count=v_absent,late_count=v_late,updated_at=now()
 where id=v_register and institution_id=p_institution_id;
 return jsonb_build_object('register_id',v_register,'total',v_total,'present',v_present,'absent',v_absent,'late',v_late,'method','manual');
end $$;
revoke all on function public.save_institution_attendance_register(uuid,text,text,text,date,text,uuid,jsonb) from public,anon;
grant execute on function public.save_institution_attendance_register(uuid,text,text,text,date,text,uuid,jsonb) to authenticated;