-- College custom role profiles and scoped permission policies.
-- This migration preserves the existing membership roles as the authentication ceiling.

create table if not exists public.institution_role_profiles (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  role_key text not null check (role_key ~ '^[a-z][a-z0-9_]{1,62}$'),
  name text not null check (length(btrim(name)) between 2 and 100),
  base_role text not null check (base_role in ('admin','teacher','student','parent','accountant','exam_officer')),
  description text not null default '',
  module_permissions jsonb not null default '{}'::jsonb check (jsonb_typeof(module_permissions) = 'object'),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_role_profiles_institution_role_key unique (institution_id, role_key),
  constraint institution_role_profiles_id_institution_key unique (id, institution_id)
);

create table if not exists public.institution_user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_profile_id uuid not null,
  campus_id uuid,
  department_id uuid,
  status text not null default 'active' check (status in ('active','suspended','ended')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_user_role_profile_institution_fk foreign key (role_profile_id,institution_id)
    references public.institution_role_profiles(id,institution_id) on delete restrict,
  constraint institution_user_role_assignment_dates check (ends_at is null or ends_at > starts_at)
);

create index if not exists idx_role_profiles_institution_active on public.institution_role_profiles(institution_id,is_active,base_role);
create index if not exists idx_user_role_assignments_user on public.institution_user_role_assignments(institution_id,user_id,status);
create index if not exists idx_user_role_assignments_profile on public.institution_user_role_assignments(institution_id,role_profile_id,status);

alter table public.institution_role_profiles enable row level security;
alter table public.institution_user_role_assignments enable row level security;
grant select,insert,update on public.institution_role_profiles to authenticated;
grant select,insert,update on public.institution_user_role_assignments to authenticated;

create policy college_role_profiles_member_read on public.institution_role_profiles for select to authenticated
using (public.has_institution_role(institution_id,array['owner','admin','teacher','student','parent','accountant','exam_officer']::text[]));
create policy college_role_profiles_admin_insert on public.institution_role_profiles for insert to authenticated
with check (public.has_institution_role(institution_id,array['owner','admin']::text[]));
create policy college_role_profiles_admin_update on public.institution_role_profiles for update to authenticated
using (public.has_institution_role(institution_id,array['owner','admin']::text[]))
with check (public.has_institution_role(institution_id,array['owner','admin']::text[]));

create policy college_user_role_assignments_scoped_read on public.institution_user_role_assignments for select to authenticated
using (user_id=(select auth.uid()) or public.has_institution_role(institution_id,array['owner','admin']::text[]));
create policy college_user_role_assignments_admin_insert on public.institution_user_role_assignments for insert to authenticated
with check (
  public.has_institution_role(institution_id,array['owner','admin']::text[])
  and (institution_user_role_assignments.campus_id is null or exists(select 1 from public.campuses c where c.id=institution_user_role_assignments.campus_id and c.institution_id=institution_user_role_assignments.institution_id))
  and (institution_user_role_assignments.department_id is null or exists(select 1 from public.departments d where d.id=institution_user_role_assignments.department_id and d.institution_id=institution_user_role_assignments.institution_id))
  and exists(select 1 from public.memberships m join public.institution_role_profiles p on p.id=institution_user_role_assignments.role_profile_id and p.institution_id=m.institution_id
    where m.institution_id=institution_user_role_assignments.institution_id and m.user_id=institution_user_role_assignments.user_id and m.status='active' and m.role=p.base_role)
);
create policy college_user_role_assignments_admin_update on public.institution_user_role_assignments for update to authenticated
using (public.has_institution_role(institution_id,array['owner','admin']::text[]))
with check (
  public.has_institution_role(institution_id,array['owner','admin']::text[])
  and (institution_user_role_assignments.campus_id is null or exists(select 1 from public.campuses c where c.id=institution_user_role_assignments.campus_id and c.institution_id=institution_user_role_assignments.institution_id))
  and (institution_user_role_assignments.department_id is null or exists(select 1 from public.departments d where d.id=institution_user_role_assignments.department_id and d.institution_id=institution_user_role_assignments.institution_id))
  and exists(select 1 from public.memberships m join public.institution_role_profiles p on p.id=institution_user_role_assignments.role_profile_id and p.institution_id=m.institution_id
    where m.institution_id=institution_user_role_assignments.institution_id and m.user_id=institution_user_role_assignments.user_id and m.status='active' and m.role=p.base_role)
);

create or replace function public.college_department_for_student(target_student uuid)
returns uuid language sql stable security definer set search_path=pg_catalog as $$
  select p.department_id from public.students s
  join public.classes c on c.institution_id=s.institution_id and lower(c.name)=lower(s.class_name)
  join public.programs p on p.id=c.program_id and p.institution_id=c.institution_id
  where s.id=target_student order by c.created_at desc limit 1
$$;
create or replace function public.college_department_for_teacher(target_teacher uuid)
returns uuid language sql stable security definer set search_path=pg_catalog as $$
  select t.department_id from public.teachers t where t.id=target_teacher limit 1
$$;
create or replace function public.college_department_for_class(target_class uuid)
returns uuid language sql stable security definer set search_path=pg_catalog as $$
  select p.department_id from public.classes c left join public.programs p on p.id=c.program_id and p.institution_id=c.institution_id where c.id=target_class limit 1
$$;
create or replace function public.college_department_for_exam(target_exam uuid)
returns uuid language sql stable security definer set search_path=pg_catalog as $$
  select public.college_department_for_class(e.class_id) from public.exams e where e.id=target_exam limit 1
$$;
create or replace function public.college_department_for_invoice(target_invoice uuid)
returns uuid language sql stable security definer set search_path=pg_catalog as $$
  select public.college_department_for_student(i.student_id) from public.fee_invoices i where i.id=target_invoice limit 1
$$;

create or replace function public.has_institution_permission(
 target_institution uuid,target_module text,target_action text,target_campus uuid default null,target_department uuid default null
)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare current_role text; custom_access_configured boolean;
begin
 select m.role into current_role from public.memberships m
 where m.institution_id=target_institution and m.user_id=(select auth.uid()) and m.status='active'
 order by case when m.role='owner' then 0 else 1 end limit 1;
 if current_role is null then return false; end if;
 if current_role='owner' then return true; end if;
 select exists(select 1 from public.institution_user_role_assignments a
   where a.institution_id=target_institution and a.user_id=(select auth.uid())) into custom_access_configured;
 if not custom_access_configured then return true; end if;
 return exists(
  select 1 from public.institution_user_role_assignments a
  join public.institution_role_profiles p on p.id=a.role_profile_id and p.institution_id=a.institution_id
  where a.institution_id=target_institution and a.user_id=(select auth.uid())
   and a.status='active' and a.starts_at<=now() and (a.ends_at is null or a.ends_at>now())
   and p.is_active and p.base_role=current_role
   and jsonb_typeof(p.module_permissions->target_module)='array'
   and coalesce((p.module_permissions->target_module)?target_action,false)
   and (a.campus_id is null or a.campus_id=target_campus)
   and (a.department_id is null or a.department_id=target_department)
 );
end
$$;

do $policies$
declare r record; module_sql text; campus_sql text; department_sql text; policy_name text;
begin
 for r in select * from (values
  ('students','students',false,'campus_id','public.college_department_for_student(id)'),
  ('teachers','employees',false,'campus_id','department_id'),
  ('departments','departments',false,'campus_id','id'),
  ('programs','programs',false,'campus_id','department_id'),
  ('subjects','subjects',false,'campus_id','department_id'),
  ('campuses','campuses',false,'id','NULL::uuid'),
  ('institution_settings','settings',false,'campus_id','NULL::uuid'),
  ('attendance','attendance',false,'campus_id','public.college_department_for_student(student_id)'),
  ('employee_attendance','employee_attendance',false,'campus_id','public.college_department_for_teacher(teacher_id)'),
  ('assignments','assignments',false,'campus_id','public.college_department_for_class(class_id)'),
  ('assignment_submissions','assignments',false,'campus_id','public.college_department_for_student(student_id)'),
  ('exams','examinations',false,'campus_id','public.college_department_for_class(class_id)'),
  ('exam_results','examinations',false,'campus_id','public.college_department_for_exam(exam_id)'),
  ('fee_invoices','fees',false,'campus_id','public.college_department_for_student(student_id)'),
  ('fee_payments','fees',false,'campus_id','public.college_department_for_invoice(invoice_id)'),
  ('work_tasks','work_tasks',false,'campus_id','NULL::uuid'),
  ('announcements','announcements',false,'campus_id','NULL::uuid'),
  ('workflow_approvals','approvals',false,'NULL::uuid','NULL::uuid'),
  ('institutional_records','module_key',true,'campus_id','NULL::uuid'),
  ('employee_leave_requests','hr',false,'campus_id','public.college_department_for_teacher(teacher_id)'),
  ('employee_contracts','hr',false,'NULL::uuid','public.college_department_for_teacher(teacher_id)'),
  ('employee_appraisals','hr',false,'NULL::uuid','public.college_department_for_teacher(teacher_id)'),
  ('payroll_runs','payroll',false,'NULL::uuid','NULL::uuid'),
  ('payroll_items','payroll',false,'NULL::uuid','public.college_department_for_teacher(teacher_id)'),
  ('library_loans','library',false,'NULL::uuid','NULL::uuid'),
  ('student_certificates','certificates',false,'NULL::uuid','public.college_department_for_student(student_id)'),
  ('visitor_entries','visitors',false,'NULL::uuid','public.college_department_for_teacher(host_teacher_id)')
 ) as x(table_name,module_value,module_is_column,campus_column,department_expression)
 loop
  if to_regclass('public.'||r.table_name) is null then continue; end if;
  if r.module_is_column then module_sql:=format('%I',r.module_value); else module_sql:=format('%L',r.module_value); end if;
  if r.campus_column='NULL::uuid' then campus_sql:='NULL::uuid'; else campus_sql:=format('%I',r.campus_column); end if;
  department_sql:=r.department_expression;
  policy_name:='college_custom_scope_select'; execute format('drop policy if exists %I on public.%I',policy_name,r.table_name);
  execute format('create policy %I on public.%I as restrictive for select to authenticated using ((select public.has_institution_permission(institution_id,%s,%L,%s,%s)))',policy_name,r.table_name,module_sql,'view',campus_sql,department_sql);
  policy_name:='college_custom_scope_insert'; execute format('drop policy if exists %I on public.%I',policy_name,r.table_name);
  execute format('create policy %I on public.%I as restrictive for insert to authenticated with check ((select public.has_institution_permission(institution_id,%s,%L,%s,%s)))',policy_name,r.table_name,module_sql,'create',campus_sql,department_sql);
  policy_name:='college_custom_scope_update'; execute format('drop policy if exists %I on public.%I',policy_name,r.table_name);
  execute format('create policy %I on public.%I as restrictive for update to authenticated using ((select public.has_institution_permission(institution_id,%s,%L,%s,%s))) with check ((select public.has_institution_permission(institution_id,%s,%L,%s,%s)))',policy_name,r.table_name,module_sql,'edit',campus_sql,department_sql,module_sql,'edit',campus_sql,department_sql);
  policy_name:='college_custom_scope_delete'; execute format('drop policy if exists %I on public.%I',policy_name,r.table_name);
  execute format('create policy %I on public.%I as restrictive for delete to authenticated using ((select public.has_institution_permission(institution_id,%s,%L,%s,%s)))',policy_name,r.table_name,module_sql,'delete',campus_sql,department_sql);
 end loop;
end
$policies$;
