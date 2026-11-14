-- Move permission evaluators to the non-API private schema and guard sensitive decisions.
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
alter function public.college_department_for_student(uuid) set schema private;
alter function public.college_department_for_teacher(uuid) set schema private;
alter function public.college_department_for_class(uuid) set schema private;
alter function public.college_department_for_exam(uuid) set schema private;
alter function public.college_department_for_invoice(uuid) set schema private;
alter function public.has_institution_permission(uuid,text,text,uuid,uuid) set schema private;

create or replace function private.college_department_for_student(target_student uuid)
returns uuid language sql stable security definer set search_path=pg_catalog as $$
 select p.department_id from public.students s
 join public.classes c on c.institution_id=s.institution_id and lower(c.name)=lower(s.class_name)
 join public.programs p on p.id=c.program_id and p.institution_id=c.institution_id
 where s.id=target_student order by c.created_at desc limit 1
$$;
create or replace function private.college_department_for_teacher(target_teacher uuid)
returns uuid language sql stable security definer set search_path=pg_catalog as $$
 select t.department_id from public.teachers t where t.id=target_teacher limit 1
$$;
create or replace function private.college_department_for_class(target_class uuid)
returns uuid language sql stable security definer set search_path=pg_catalog as $$
 select p.department_id from public.classes c left join public.programs p on p.id=c.program_id and p.institution_id=c.institution_id where c.id=target_class limit 1
$$;
create or replace function private.college_department_for_exam(target_exam uuid)
returns uuid language sql stable security definer set search_path=pg_catalog as $$
 select private.college_department_for_class(e.class_id) from public.exams e where e.id=target_exam limit 1
$$;
create or replace function private.college_department_for_invoice(target_invoice uuid)
returns uuid language sql stable security definer set search_path=pg_catalog as $$
 select private.college_department_for_student(i.student_id) from public.fee_invoices i where i.id=target_invoice limit 1
$$;
create or replace function private.has_institution_permission(target_institution uuid,target_module text,target_action text,target_campus uuid default null,target_department uuid default null)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare current_role text; custom_access_configured boolean;
begin
 select m.role into current_role from public.memberships m
 where m.institution_id=target_institution and m.user_id=(select auth.uid()) and m.status='active'
 order by case when m.role='owner' then 0 else 1 end limit 1;
 if current_role is null then return false; end if;
 if current_role='owner' then return true; end if;
 select exists(select 1 from public.institution_user_role_assignments a where a.institution_id=target_institution and a.user_id=(select auth.uid())) into custom_access_configured;
 if not custom_access_configured then return true; end if;
 return exists(
  select 1 from public.institution_user_role_assignments a join public.institution_role_profiles p on p.id=a.role_profile_id and p.institution_id=a.institution_id
  where a.institution_id=target_institution and a.user_id=(select auth.uid()) and a.status='active'
   and a.starts_at<=now() and (a.ends_at is null or a.ends_at>now()) and p.is_active and p.base_role=current_role
   and jsonb_typeof(p.module_permissions->target_module)='array'
   and coalesce((p.module_permissions->target_module)?target_action,false)
   and (a.campus_id is null or a.campus_id=target_campus)
   and (a.department_id is null or a.department_id=target_department)
 );
end
$$;

revoke all on function private.college_department_for_student(uuid) from public,anon;
revoke all on function private.college_department_for_teacher(uuid) from public,anon;
revoke all on function private.college_department_for_class(uuid) from public,anon;
revoke all on function private.college_department_for_exam(uuid) from public,anon;
revoke all on function private.college_department_for_invoice(uuid) from public,anon;
revoke all on function private.has_institution_permission(uuid,text,text,uuid,uuid) from public,anon;
grant execute on function private.college_department_for_student(uuid) to authenticated;
grant execute on function private.college_department_for_teacher(uuid) to authenticated;
grant execute on function private.college_department_for_class(uuid) to authenticated;
grant execute on function private.college_department_for_exam(uuid) to authenticated;
grant execute on function private.college_department_for_invoice(uuid) to authenticated;
grant execute on function private.has_institution_permission(uuid,text,text,uuid,uuid) to authenticated;

do $policies$
declare r record; module_sql text; campus_sql text; department_sql text; policy_name text;
begin
 for r in select * from (values
  ('students','students',false,'campus_id','private.college_department_for_student(id)'),
  ('teachers','employees',false,'campus_id','department_id'),
  ('departments','departments',false,'campus_id','id'),
  ('programs','programs',false,'campus_id','department_id'),
  ('subjects','subjects',false,'campus_id','department_id'),
  ('campuses','campuses',false,'id','NULL::uuid'),
  ('institution_settings','settings',false,'campus_id','NULL::uuid'),
  ('attendance','attendance',false,'campus_id','private.college_department_for_student(student_id)'),
  ('employee_attendance','employee_attendance',false,'campus_id','private.college_department_for_teacher(teacher_id)'),
  ('assignments','assignments',false,'campus_id','private.college_department_for_class(class_id)'),
  ('assignment_submissions','assignments',false,'campus_id','private.college_department_for_student(student_id)'),
  ('exams','examinations',false,'campus_id','private.college_department_for_class(class_id)'),
  ('exam_results','examinations',false,'campus_id','private.college_department_for_exam(exam_id)'),
  ('fee_invoices','fees',false,'campus_id','private.college_department_for_student(student_id)'),
  ('fee_payments','fees',false,'campus_id','private.college_department_for_invoice(invoice_id)'),
  ('work_tasks','work_tasks',false,'campus_id','NULL::uuid'),
  ('announcements','announcements',false,'campus_id','NULL::uuid'),
  ('workflow_approvals','approvals',false,'NULL::uuid','NULL::uuid'),
  ('institutional_records','module_key',true,'campus_id','NULL::uuid'),
  ('employee_leave_requests','hr',false,'campus_id','private.college_department_for_teacher(teacher_id)'),
  ('employee_contracts','hr',false,'NULL::uuid','private.college_department_for_teacher(teacher_id)'),
  ('employee_appraisals','hr',false,'NULL::uuid','private.college_department_for_teacher(teacher_id)'),
  ('payroll_runs','payroll',false,'NULL::uuid','NULL::uuid'),
  ('payroll_items','payroll',false,'NULL::uuid','private.college_department_for_teacher(teacher_id)'),
  ('library_loans','library',false,'NULL::uuid','NULL::uuid'),
  ('student_certificates','certificates',false,'NULL::uuid','private.college_department_for_student(student_id)'),
  ('visitor_entries','visitors',false,'NULL::uuid','private.college_department_for_teacher(host_teacher_id)')
 ) as x(table_name,module_value,module_is_column,campus_column,department_expression)
 loop
  if to_regclass('public.'||r.table_name) is null then continue; end if;
  if r.module_is_column then module_sql:=format('%I',r.module_value); else module_sql:=format('%L',r.module_value); end if;
  if r.campus_column='NULL::uuid' then campus_sql:='NULL::uuid'; else campus_sql:=format('%I',r.campus_column); end if;
  department_sql:=r.department_expression;
  policy_name:='college_custom_scope_select'; execute format('drop policy if exists %I on public.%I',policy_name,r.table_name);
  execute format('create policy %I on public.%I as restrictive for select to authenticated using ((select private.has_institution_permission(institution_id,%s,%L,%s,%s)))',policy_name,r.table_name,module_sql,'view',campus_sql,department_sql);
  policy_name:='college_custom_scope_insert'; execute format('drop policy if exists %I on public.%I',policy_name,r.table_name);
  execute format('create policy %I on public.%I as restrictive for insert to authenticated with check ((select private.has_institution_permission(institution_id,%s,%L,%s,%s)))',policy_name,r.table_name,module_sql,'create',campus_sql,department_sql);
  policy_name:='college_custom_scope_update'; execute format('drop policy if exists %I on public.%I',policy_name,r.table_name);
  execute format('create policy %I on public.%I as restrictive for update to authenticated using ((select private.has_institution_permission(institution_id,%s,%L,%s,%s))) with check ((select private.has_institution_permission(institution_id,%s,%L,%s,%s)))',policy_name,r.table_name,module_sql,'edit',campus_sql,department_sql,module_sql,'edit',campus_sql,department_sql);
  policy_name:='college_custom_scope_delete'; execute format('drop policy if exists %I on public.%I',policy_name,r.table_name);
  execute format('create policy %I on public.%I as restrictive for delete to authenticated using ((select private.has_institution_permission(institution_id,%s,%L,%s,%s)))',policy_name,r.table_name,module_sql,'delete',campus_sql,department_sql);
 end loop;
end
$policies$;

create or replace function private.guard_custom_exam_result_transitions()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if (select auth.uid()) is null then return new; end if;
 if tg_op='INSERT' then
  if new.approval_status in ('approved','published') and not private.has_institution_permission(new.institution_id,'examinations','approve',new.campus_id,private.college_department_for_exam(new.exam_id)) then
   raise exception 'Your assigned college role cannot approve examination results.' using errcode='42501';
  end if;
  if new.result_status='published' and not private.has_institution_permission(new.institution_id,'examinations','publish',new.campus_id,private.college_department_for_exam(new.exam_id)) then
   raise exception 'Your assigned college role cannot publish examination results.' using errcode='42501';
  end if;
  return new;
 end if;
 if new.approval_status is distinct from old.approval_status and new.approval_status in ('approved','published')
   and not private.has_institution_permission(new.institution_id,'examinations','approve',new.campus_id,private.college_department_for_exam(new.exam_id)) then
  raise exception 'Your assigned college role cannot approve examination results.' using errcode='42501';
 end if;
 if new.approval_status is distinct from old.approval_status and new.approval_status='published'
   and not private.has_institution_permission(new.institution_id,'examinations','publish',new.campus_id,private.college_department_for_exam(new.exam_id)) then
  raise exception 'Your assigned college role cannot publish examination results.' using errcode='42501';
 end if;
 if new.result_status is distinct from old.result_status and new.result_status='published'
   and not private.has_institution_permission(new.institution_id,'examinations','publish',new.campus_id,private.college_department_for_exam(new.exam_id)) then
  raise exception 'Your assigned college role cannot publish examination results.' using errcode='42501';
 end if;
 return new;
end
$$;
create or replace function private.guard_custom_approval_decisions()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if (select auth.uid()) is null then return new; end if;
 if new.status in ('approved','rejected') and (tg_op='INSERT' or new.status is distinct from old.status)
   and not private.has_institution_permission(new.institution_id,'approvals','approve',null,null) then
  raise exception 'Your assigned college role cannot decide approval requests.' using errcode='42501';
 end if;
 return new;
end
$$;
revoke all on function private.guard_custom_exam_result_transitions() from public,anon,authenticated;
revoke all on function private.guard_custom_approval_decisions() from public,anon,authenticated;
drop trigger if exists college_custom_exam_result_transitions on public.exam_results;
create trigger college_custom_exam_result_transitions before insert or update on public.exam_results
for each row execute function private.guard_custom_exam_result_transitions();
drop trigger if exists college_custom_approval_decisions on public.workflow_approvals;
create trigger college_custom_approval_decisions before insert or update on public.workflow_approvals
for each row execute function private.guard_custom_approval_decisions();
