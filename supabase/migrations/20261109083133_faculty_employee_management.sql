-- Stage 2: Faculty & Employee Management
-- Additive, institution-scoped HR and teaching operations.
-- Existing teachers rows and current application tables are preserved.

begin;

-- Composite unique keys allow child rows to prove that every linked record
-- belongs to the same institution, rather than relying on client filtering.
create unique index if not exists teachers_id_institution_uq
  on public.teachers (id, institution_id);
create unique index if not exists departments_id_institution_uq
  on public.departments (id, institution_id);
create unique index if not exists subjects_id_institution_uq
  on public.subjects (id, institution_id);
create unique index if not exists classes_id_institution_uq
  on public.classes (id, institution_id);
create unique index if not exists academic_sessions_id_institution_uq
  on public.academic_sessions (id, institution_id);

-- Extend the existing employee/teacher identity record; do not create a
-- second, competing employee identity table.
alter table public.teachers
  add column if not exists employee_type text not null default 'teaching',
  add column if not exists employment_type text not null default 'full_time',
  add column if not exists department_id uuid,
  add column if not exists designation_id uuid,
  add column if not exists joining_date date,
  add column if not exists contract_end_date date,
  add column if not exists work_location text,
  add column if not exists emergency_contact text,
  add column if not exists photo_path text;

alter table public.teachers
  drop constraint if exists teachers_employee_type_check;
alter table public.teachers
  add constraint teachers_employee_type_check
  check (employee_type in ('teaching', 'non_teaching'));

alter table public.teachers
  drop constraint if exists teachers_employment_type_check;
alter table public.teachers
  add constraint teachers_employment_type_check
  check (employment_type in ('full_time', 'part_time', 'contract', 'temporary'));

create unique index if not exists teachers_employee_no_institution_uq
  on public.teachers (institution_id, lower(btrim(employee_no)));
create unique index if not exists teachers_email_institution_uq
  on public.teachers (institution_id, lower(btrim(email)));

-- Departments and designations are separate concepts. Departments remain
-- managed in Institute Administration; this table records HR job titles.
create table if not exists public.designations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  department_id uuid,
  name text not null,
  code text,
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint designations_department_institution_fk
    foreign key (department_id, institution_id)
    references public.departments(id, institution_id)
    on delete restrict
);

create unique index if not exists designations_id_institution_uq
  on public.designations (id, institution_id);
create unique index if not exists designations_name_institution_uq
  on public.designations (institution_id, lower(btrim(name)));
create unique index if not exists designations_code_institution_uq
  on public.designations (institution_id, lower(btrim(code)))
  where code is not null and btrim(code) <> '';

alter table public.teachers
  drop constraint if exists teachers_department_institution_fk;
alter table public.teachers
  add constraint teachers_department_institution_fk
  foreign key (department_id, institution_id)
  references public.departments(id, institution_id)
  on delete restrict;

alter table public.teachers
  drop constraint if exists teachers_designation_institution_fk;
alter table public.teachers
  add constraint teachers_designation_institution_fk
  foreign key (designation_id, institution_id)
  references public.designations(id, institution_id)
  on delete restrict;

-- A teacher can be assigned to a subject/class/session with an explicit
-- workload, effective dates and status.
create table if not exists public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  teacher_id uuid not null,
  subject_id uuid not null,
  class_id uuid not null,
  academic_session_id uuid not null,
  weekly_periods integer not null default 0 check (weekly_periods >= 0),
  assignment_type text not null default 'teaching'
    check (assignment_type in ('teaching', 'homeroom', 'substitution', 'coordination')),
  start_date date,
  end_date date,
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_assignments_teacher_institution_fk
    foreign key (teacher_id, institution_id)
    references public.teachers(id, institution_id) on delete cascade,
  constraint teacher_assignments_subject_institution_fk
    foreign key (subject_id, institution_id)
    references public.subjects(id, institution_id) on delete restrict,
  constraint teacher_assignments_class_institution_fk
    foreign key (class_id, institution_id)
    references public.classes(id, institution_id) on delete restrict,
  constraint teacher_assignments_session_institution_fk
    foreign key (academic_session_id, institution_id)
    references public.academic_sessions(id, institution_id) on delete restrict,
  constraint teacher_assignments_date_range_check
    check (end_date is null or start_date is null or end_date >= start_date)
);

create unique index if not exists teacher_assignments_unique_scope_uq
  on public.teacher_assignments (
    institution_id, teacher_id, subject_id, class_id, academic_session_id,
    coalesce(start_date, date '0001-01-01')
  );
create index if not exists teacher_assignments_teacher_status_idx
  on public.teacher_assignments (institution_id, teacher_id, status);

-- Employee attendance is separate from learner attendance.
create table if not exists public.employee_attendance (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  teacher_id uuid not null,
  attendance_date date not null,
  check_in_time time,
  check_out_time time,
  status text not null default 'present'
    check (status in ('present', 'absent', 'late', 'excused', 'remote', 'half_day')),
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_attendance_teacher_institution_fk
    foreign key (teacher_id, institution_id)
    references public.teachers(id, institution_id) on delete cascade,
  constraint employee_attendance_time_check
    check (check_in_time is null or check_out_time is null or check_out_time > check_in_time),
  constraint employee_attendance_unique_day unique (institution_id, teacher_id, attendance_date)
);

create index if not exists employee_attendance_date_idx
  on public.employee_attendance (institution_id, attendance_date desc);

-- Staff leave request, review and approval lifecycle.
create table if not exists public.employee_leave_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  teacher_id uuid not null,
  leave_type text not null
    check (leave_type in ('annual', 'sick', 'casual', 'unpaid', 'maternity', 'paternity', 'other')),
  start_date date not null,
  end_date date not null,
  day_count numeric(6,2) not null check (day_count > 0),
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_leave_teacher_institution_fk
    foreign key (teacher_id, institution_id)
    references public.teachers(id, institution_id) on delete cascade,
  constraint employee_leave_date_range_check
    check (end_date >= start_date)
);

create index if not exists employee_leave_teacher_status_idx
  on public.employee_leave_requests (institution_id, teacher_id, status, start_date);

-- Prevent overlapping pending/approved leave for the same employee. The
-- advisory transaction lock makes the check safe when two requests arrive
-- concurrently for the same employee.
create or replace function private.check_employee_leave_overlap()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.teacher_id::text, 0));
  if new.status in ('pending', 'approved') and exists (
    select 1
    from public.employee_leave_requests r
    where r.institution_id = new.institution_id
      and r.teacher_id = new.teacher_id
      and r.id is distinct from new.id
      and r.status in ('pending', 'approved')
      and daterange(r.start_date, r.end_date, '[]') &&
          daterange(new.start_date, new.end_date, '[]')
  ) then
    raise exception 'This leave request overlaps another pending or approved request.';
  end if;
  return new;
end;
$$;

create trigger employee_leave_overlap_guard
before insert or update of teacher_id, institution_id, start_date, end_date, status
on public.employee_leave_requests
for each row execute function private.check_employee_leave_overlap();

-- Sensitive HR documents live in their own private bucket. The existing
-- institution-files bucket is intentionally not reused because its current
-- SELECT policy exposes institution files to all active institution members.
create table if not exists public.staff_documents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  teacher_id uuid not null,
  document_type text not null
    check (document_type in ('contract', 'identity', 'qualification', 'certificate', 'letter', 'other')),
  title text not null,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  issue_date date,
  expiry_date date,
  status text not null default 'active'
    check (status in ('active', 'expired', 'superseded')),
  notes text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_documents_teacher_institution_fk
    foreign key (teacher_id, institution_id)
    references public.teachers(id, institution_id) on delete cascade,
  constraint staff_documents_path_unique unique (institution_id, storage_path),
  constraint staff_documents_expiry_check
    check (expiry_date is null or issue_date is null or expiry_date >= issue_date)
);

create index if not exists staff_documents_teacher_idx
  on public.staff_documents (institution_id, teacher_id, created_at desc);

-- Immutable employee events are written by the teacher audit trigger below.
-- A deliberate absence of a cascading teacher FK preserves history if an
-- administrator eventually archives/deletes an employee record.
create table if not exists public.employee_history (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  teacher_id uuid not null,
  event_type text not null
    check (event_type in ('employee_registered', 'employee_profile_updated')),
  effective_date date not null default current_date,
  old_values jsonb,
  new_values jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists employee_history_teacher_idx
  on public.employee_history (institution_id, teacher_id, created_at desc);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.audit_teacher_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_actor uuid;
begin
  v_actor := auth.uid();
  v_new := jsonb_build_object(
    'employee_no', new.employee_no,
    'full_name', new.full_name,
    'email', new.email,
    'employee_type', new.employee_type,
    'department_id', new.department_id,
    'designation_id', new.designation_id,
    'employment_type', new.employment_type,
    'employment_status', new.employment_status,
    'joining_date', new.joining_date,
    'contract_end_date', new.contract_end_date,
    'work_location', new.work_location
  );

  if tg_op = 'INSERT' then
    insert into public.employee_history (
      institution_id, teacher_id, event_type, effective_date,
      old_values, new_values, created_by
    ) values (
      new.institution_id, new.id, 'employee_registered', current_date,
      null, v_new, v_actor
    );
    return new;
  end if;

  v_old := jsonb_build_object(
    'employee_no', old.employee_no,
    'full_name', old.full_name,
    'email', old.email,
    'employee_type', old.employee_type,
    'department_id', old.department_id,
    'designation_id', old.designation_id,
    'employment_type', old.employment_type,
    'employment_status', old.employment_status,
    'joining_date', old.joining_date,
    'contract_end_date', old.contract_end_date,
    'work_location', old.work_location
  );

  if v_old is distinct from v_new then
    insert into public.employee_history (
      institution_id, teacher_id, event_type, effective_date,
      old_values, new_values, created_by
    ) values (
      new.institution_id, new.id, 'employee_profile_updated', current_date,
      v_old, v_new, v_actor
    );
  end if;
  return new;
end;
$$;

revoke all on function private.audit_teacher_history() from public, anon, authenticated;

drop trigger if exists teachers_employee_history_audit on public.teachers;
create trigger teachers_employee_history_audit
after insert or update on public.teachers
for each row execute function private.audit_teacher_history();

-- All new records are institution-scoped; RLS remains the enforcement layer.
alter table public.designations enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.employee_attendance enable row level security;
alter table public.employee_leave_requests enable row level security;
alter table public.staff_documents enable row level security;
alter table public.employee_history enable row level security;

grant select, insert, update, delete on public.designations to authenticated;
grant select, insert, update, delete on public.teacher_assignments to authenticated;
grant select, insert, update, delete on public.employee_attendance to authenticated;
grant select, insert, update, delete on public.employee_leave_requests to authenticated;
grant select, insert, update, delete on public.staff_documents to authenticated;
grant select on public.employee_history to authenticated;

-- Designation catalogue: visible to staff, maintained by institution admins.
drop policy if exists designations_read_institution on public.designations;
create policy designations_read_institution on public.designations
for select to authenticated
using (
  public.has_institution_role(institution_id, array['owner', 'admin', 'teacher'])
);

drop policy if exists designations_admin_insert on public.designations;
create policy designations_admin_insert on public.designations
for insert to authenticated
with check (public.has_institution_role(institution_id, array['owner', 'admin']));

drop policy if exists designations_admin_update on public.designations;
create policy designations_admin_update on public.designations
for update to authenticated
using (public.has_institution_role(institution_id, array['owner', 'admin']))
with check (public.has_institution_role(institution_id, array['owner', 'admin']));

drop policy if exists designations_admin_delete on public.designations;
create policy designations_admin_delete on public.designations
for delete to authenticated
using (public.has_institution_role(institution_id, array['owner', 'admin']));

-- Teaching assignments: admins maintain allocations; assigned teachers can
-- view only the rows attached to their own employee identity.
drop policy if exists teacher_assignments_read_scoped on public.teacher_assignments;
create policy teacher_assignments_read_scoped on public.teacher_assignments
for select to authenticated
using (
  public.has_institution_role(institution_id, array['owner', 'admin'])
  or exists (
    select 1 from public.teachers t
    where t.id = teacher_assignments.teacher_id
      and t.institution_id = teacher_assignments.institution_id
      and t.user_id = (select auth.uid())
  )
);

drop policy if exists teacher_assignments_admin_insert on public.teacher_assignments;
create policy teacher_assignments_admin_insert on public.teacher_assignments
for insert to authenticated
with check (public.has_institution_role(institution_id, array['owner', 'admin']));

drop policy if exists teacher_assignments_admin_update on public.teacher_assignments;
create policy teacher_assignments_admin_update on public.teacher_assignments
for update to authenticated
using (public.has_institution_role(institution_id, array['owner', 'admin']))
with check (public.has_institution_role(institution_id, array['owner', 'admin']));

drop policy if exists teacher_assignments_admin_delete on public.teacher_assignments;
create policy teacher_assignments_admin_delete on public.teacher_assignments
for delete to authenticated
using (public.has_institution_role(institution_id, array['owner', 'admin']));

-- Employee attendance is read by the employee and administrators; only
-- authorized administrators record/correct attendance.
drop policy if exists employee_attendance_read_scoped on public.employee_attendance;
create policy employee_attendance_read_scoped on public.employee_attendance
for select to authenticated
using (
  public.has_institution_role(institution_id, array['owner', 'admin'])
  or exists (
    select 1 from public.teachers t
    where t.id = employee_attendance.teacher_id
      and t.institution_id = employee_attendance.institution_id
      and t.user_id = (select auth.uid())
  )
);

drop policy if exists employee_attendance_admin_insert on public.employee_attendance;
create policy employee_attendance_admin_insert on public.employee_attendance
for insert to authenticated
with check (public.has_institution_role(institution_id, array['owner', 'admin']));

drop policy if exists employee_attendance_admin_update on public.employee_attendance;
create policy employee_attendance_admin_update on public.employee_attendance
for update to authenticated
using (public.has_institution_role(institution_id, array['owner', 'admin']))
with check (public.has_institution_role(institution_id, array['owner', 'admin']));

drop policy if exists employee_attendance_admin_delete on public.employee_attendance;
create policy employee_attendance_admin_delete on public.employee_attendance
for delete to authenticated
using (public.has_institution_role(institution_id, array['owner', 'admin']));

-- Leave requests: employees create and view their own requests. They may edit
-- while pending or cancel; only owner/admin can approve or reject.
drop policy if exists employee_leave_read_scoped on public.employee_leave_requests;
create policy employee_leave_read_scoped on public.employee_leave_requests
for select to authenticated
using (
  public.has_institution_role(institution_id, array['owner', 'admin'])
  or exists (
    select 1 from public.teachers t
    where t.id = employee_leave_requests.teacher_id
      and t.institution_id = employee_leave_requests.institution_id
      and t.user_id = (select auth.uid())
  )
);

drop policy if exists employee_leave_insert_self_or_admin on public.employee_leave_requests;
create policy employee_leave_insert_self_or_admin on public.employee_leave_requests
for insert to authenticated
with check (
  public.has_institution_role(institution_id, array['owner', 'admin'])
  or (
    status = 'pending'
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.teachers t
      where t.id = employee_leave_requests.teacher_id
        and t.institution_id = employee_leave_requests.institution_id
        and t.user_id = (select auth.uid())
    )
  )
);

drop policy if exists employee_leave_update_self_or_admin on public.employee_leave_requests;
create policy employee_leave_update_self_or_admin on public.employee_leave_requests
for update to authenticated
using (
  public.has_institution_role(institution_id, array['owner', 'admin'])
  or (
    status = 'pending'
    and exists (
      select 1 from public.teachers t
      where t.id = employee_leave_requests.teacher_id
        and t.institution_id = employee_leave_requests.institution_id
        and t.user_id = (select auth.uid())
    )
  )
)
with check (
  public.has_institution_role(institution_id, array['owner', 'admin'])
  or (
    status in ('pending', 'cancelled')
    and exists (
      select 1 from public.teachers t
      where t.id = employee_leave_requests.teacher_id
        and t.institution_id = employee_leave_requests.institution_id
        and t.user_id = (select auth.uid())
    )
  )
);

drop policy if exists employee_leave_admin_delete on public.employee_leave_requests;
create policy employee_leave_admin_delete on public.employee_leave_requests
for delete to authenticated
using (public.has_institution_role(institution_id, array['owner', 'admin']));

-- Staff documents: admins can manage all documents; employees can upload and
-- read only their own. The corresponding Storage bucket has matching RLS.
drop policy if exists staff_documents_read_scoped on public.staff_documents;
create policy staff_documents_read_scoped on public.staff_documents
for select to authenticated
using (
  public.has_institution_role(institution_id, array['owner', 'admin'])
  or exists (
    select 1 from public.teachers t
    where t.id = staff_documents.teacher_id
      and t.institution_id = staff_documents.institution_id
      and t.user_id = (select auth.uid())
  )
);

drop policy if exists staff_documents_insert_self_or_admin on public.staff_documents;
create policy staff_documents_insert_self_or_admin on public.staff_documents
for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and (
    public.has_institution_role(institution_id, array['owner', 'admin'])
    or exists (
      select 1 from public.teachers t
      where t.id = staff_documents.teacher_id
        and t.institution_id = staff_documents.institution_id
        and t.user_id = (select auth.uid())
    )
  )
);

drop policy if exists staff_documents_admin_update on public.staff_documents;
create policy staff_documents_admin_update on public.staff_documents
for update to authenticated
using (public.has_institution_role(institution_id, array['owner', 'admin']))
with check (public.has_institution_role(institution_id, array['owner', 'admin']));

drop policy if exists staff_documents_admin_delete on public.staff_documents;
create policy staff_documents_admin_delete on public.staff_documents
for delete to authenticated
using (public.has_institution_role(institution_id, array['owner', 'admin']));

-- Employee history is immutable through the client. The audit trigger is the
-- only writer; employee/admin views are explicitly scoped.
drop policy if exists employee_history_read_scoped on public.employee_history;
create policy employee_history_read_scoped on public.employee_history
for select to authenticated
using (
  public.has_institution_role(institution_id, array['owner', 'admin'])
  or exists (
    select 1 from public.teachers t
    where t.id = employee_history.teacher_id
      and t.institution_id = employee_history.institution_id
      and t.user_id = (select auth.uid())
  )
);

-- Remove the previous institution-wide teacher directory policy: staff may
-- now see their own employee record only, while admins keep institution-wide
-- directory access.
drop policy if exists "institution staff can view teachers" on public.teachers;
drop policy if exists teachers_owner_admin_or_self_read on public.teachers;
create policy teachers_owner_admin_or_self_read on public.teachers
for select to authenticated
using (
  public.has_institution_role(institution_id, array['owner', 'admin'])
  or (
    public.has_institution_role(institution_id, array['teacher'])
    and user_id = (select auth.uid())
  )
);

-- Dedicated private HR bucket. It is deliberately not visible to all
-- institution members and accepts only the file types used by staff records.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'staff-files', 'staff-files', false, 10485760,
  array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
    'text/plain', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists staff_files_select_own_or_admin on storage.objects;
create policy staff_files_select_own_or_admin on storage.objects
for select to authenticated
using (
  bucket_id = 'staff-files'
  and array_length(storage.foldername(name), 1) = 2
  and (
    public.has_institution_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
    or exists (
      select 1 from public.teachers t
      where t.id::text = (storage.foldername(name))[2]
        and t.institution_id::text = (storage.foldername(name))[1]
        and t.user_id = (select auth.uid())
    )
  )
);

drop policy if exists staff_files_insert_own_or_admin on storage.objects;
create policy staff_files_insert_own_or_admin on storage.objects
for insert to authenticated
with check (
  bucket_id = 'staff-files'
  and array_length(storage.foldername(name), 1) = 2
  and (
    public.has_institution_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
    or exists (
      select 1 from public.teachers t
      where t.id::text = (storage.foldername(name))[2]
        and t.institution_id::text = (storage.foldername(name))[1]
        and t.user_id = (select auth.uid())
    )
  )
);

drop policy if exists staff_files_admin_delete on storage.objects;
create policy staff_files_admin_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'staff-files'
  and array_length(storage.foldername(name), 1) = 2
  and public.has_institution_role((storage.foldername(name))[1]::uuid, array['owner', 'admin'])
);

commit;
