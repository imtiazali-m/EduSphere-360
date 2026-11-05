-- EduSphere 360 initial schema
-- Apply this migration to your own Supabase project using the SQL Editor or Supabase CLI.

create extension if not exists pgcrypto;

-- A database-backed one-time bootstrap lock prevents two first-owner requests racing.
create table if not exists public.platform_setup_control (
  singleton boolean primary key default true check (singleton = true),
  status text not null default 'available' check (status in ('available','in_progress','completed')),
  updated_at timestamptz not null default now()
);
insert into public.platform_setup_control(singleton, status)
values (true, 'available') on conflict (singleton) do nothing;

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  institution_type text not null check (institution_type in ('school','college','university','multi_institution')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.claim_edu_bootstrap()
returns boolean language plpgsql security definer set search_path = public
as $$
declare changed integer;
begin
  update public.platform_setup_control
  set status = 'in_progress', updated_at = now()
  where singleton = true
    and (status = 'available' or (status = 'in_progress' and updated_at < now() - interval '10 minutes'));
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.complete_edu_bootstrap()
returns boolean language plpgsql security definer set search_path = public
as $$
declare changed integer;
begin
  update public.platform_setup_control
  set status = 'completed', updated_at = now()
  where singleton = true and status = 'in_progress';
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.release_edu_bootstrap()
returns boolean language plpgsql security definer set search_path = public
as $$
declare changed integer;
begin
  update public.platform_setup_control
  set status = 'available', updated_at = now()
  where singleton = true and status = 'in_progress'
    and not exists (select 1 from public.institutions);
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on public.platform_setup_control from anon, authenticated;
revoke all on function public.claim_edu_bootstrap() from public, anon, authenticated;
revoke all on function public.complete_edu_bootstrap() from public, anon, authenticated;
revoke all on function public.release_edu_bootstrap() from public, anon, authenticated;
grant execute on function public.claim_edu_bootstrap() to service_role;
grant execute on function public.complete_edu_bootstrap() to service_role;
grant execute on function public.release_edu_bootstrap() to service_role;


create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','teacher','student','parent','accountant','exam_officer')),
  status text not null default 'active' check (status in ('active','suspended','invited')),
  created_at timestamptz not null default now(),
  unique (institution_id, user_id)
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  admission_no text not null,
  full_name text not null,
  email text,
  class_name text not null,
  guardian_name text,
  guardian_email text,
  date_of_birth date,
  status text not null default 'active' check (status in ('active','pending','graduated','inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, admission_no),
  unique (user_id)
);

create table if not exists public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  relationship text default 'guardian',
  created_at timestamptz not null default now(),
  unique (student_id, parent_user_id)
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  employee_no text not null,
  full_name text not null,
  email text not null,
  department text,
  subject text,
  phone text,
  employment_status text not null default 'active' check (employment_status in ('active','on_leave','inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, employee_no)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  student_name text not null,
  class_name text not null,
  attendance_date date not null,
  status text not null default 'present' check (status in ('present','absent','late','excused')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  title text not null,
  class_name text not null,
  subject text not null,
  exam_date date not null,
  total_marks numeric(10,2) not null default 100 check (total_marks >= 0),
  status text not null default 'planned' check (status in ('planned','completed','published')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_results (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  student_name text not null,
  exam_title text not null,
  subject text not null,
  marks_obtained numeric(10,2) not null check (marks_obtained >= 0),
  total_marks numeric(10,2) not null check (total_marks > 0),
  grade text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (marks_obtained <= total_marks)
);

create table if not exists public.fee_invoices (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  student_name text not null,
  fee_title text not null,
  amount numeric(12,2) not null check (amount >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0),
  balance numeric(12,2) generated always as (amount - paid_amount) stored,
  due_date date,
  status text not null default 'unpaid' check (status in ('unpaid','partial','paid','overdue')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (paid_amount <= amount)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  title text not null,
  class_name text not null,
  subject text,
  description text,
  due_date date,
  status text not null default 'open' check (status in ('open','closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  class_name text not null,
  weekday text not null,
  start_time time,
  end_time time,
  subject text,
  teacher_name text,
  room text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  title text not null,
  body text not null,
  audience text not null default 'all' check (audience in ('all','teachers','students','parents')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memberships_user_id_idx on public.memberships(user_id);
create index if not exists students_institution_id_idx on public.students(institution_id);
create index if not exists students_user_id_idx on public.students(user_id);
create index if not exists student_guardians_parent_idx on public.student_guardians(parent_user_id);
create index if not exists attendance_institution_date_idx on public.attendance(institution_id, attendance_date desc);
create index if not exists exams_institution_date_idx on public.exams(institution_id, exam_date);
create index if not exists fee_invoices_institution_due_idx on public.fee_invoices(institution_id, due_date);
create index if not exists assignments_institution_due_idx on public.assignments(institution_id, due_date);

create or replace function public.is_institution_member(target_institution uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.institution_id = target_institution and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;

create or replace function public.has_institution_role(target_institution uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.institution_id = target_institution and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role = any(allowed_roles)
  );
$$;

create or replace function public.is_admin_for_user(target_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships target_membership
    where target_membership.user_id = target_user
      and public.has_institution_role(target_membership.institution_id, array['owner','admin'])
  );
$$;

create or replace function public.can_view_student(target_student uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.id = target_student and (
      public.has_institution_role(s.institution_id, array['owner','admin','teacher','accountant','exam_officer'])
      or s.user_id = (select auth.uid())
      or exists (
        select 1 from public.student_guardians g
        where g.student_id = s.id and g.parent_user_id = (select auth.uid())
      )
    )
  );
$$;

create or replace function public.can_view_class(target_institution uuid, target_class text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.students s
    where s.institution_id = target_institution and s.class_name = target_class
      and (
        s.user_id = (select auth.uid())
        or exists (
          select 1 from public.student_guardians g
          where g.student_id = s.id and g.parent_user_id = (select auth.uid())
        )
      )
  );
$$;

-- Revoke browser access from anonymous visitors, then grant signed-in users only the operations protected below by RLS.
revoke all on public.institutions, public.profiles, public.memberships, public.students, public.student_guardians,
  public.teachers, public.attendance, public.exams, public.exam_results, public.fee_invoices, public.assignments,
  public.timetable_entries, public.announcements from anon;

grant select on public.institutions, public.profiles, public.memberships to authenticated;
grant update (full_name, email, updated_at) on public.profiles to authenticated;
grant select, insert, update, delete on public.students, public.teachers, public.attendance,
  public.exams, public.exam_results, public.fee_invoices, public.assignments, public.timetable_entries, public.announcements to authenticated;
grant select on public.student_guardians to authenticated;

alter table public.institutions enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.students enable row level security;
alter table public.student_guardians enable row level security;
alter table public.teachers enable row level security;
alter table public.attendance enable row level security;
alter table public.exams enable row level security;
alter table public.exam_results enable row level security;
alter table public.fee_invoices enable row level security;
alter table public.assignments enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.announcements enable row level security;

create policy "members can view their institutions" on public.institutions
for select to authenticated using (public.is_institution_member(id));

create policy "users can view their own profile" on public.profiles
for select to authenticated using (id = (select auth.uid()) or public.is_admin_for_user(id));
create policy "users can update their own profile" on public.profiles
for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "users can view their own memberships or admins can view institution members" on public.memberships
for select to authenticated using (
  user_id = (select auth.uid()) or public.has_institution_role(institution_id, array['owner','admin'])
);
-- Membership inserts/role changes are server-side only through the create-user Edge Function.

create policy "authorized users can view student records" on public.students
for select to authenticated using (public.can_view_student(id));
create policy "administrators can add students" on public.students
for insert to authenticated with check (public.has_institution_role(institution_id, array['owner','admin']));
create policy "administrators can update students" on public.students
for update to authenticated using (public.has_institution_role(institution_id, array['owner','admin']))
with check (public.has_institution_role(institution_id, array['owner','admin']));
create policy "administrators can delete students" on public.students
for delete to authenticated using (public.has_institution_role(institution_id, array['owner','admin']));

create policy "student guardians can view their own links" on public.student_guardians
for select to authenticated using (parent_user_id = (select auth.uid()) or public.has_institution_role(institution_id, array['owner','admin']));

create policy "institution staff can view teachers" on public.teachers
for select to authenticated using (public.has_institution_role(institution_id, array['owner','admin','teacher']));
create policy "administrators can add teachers" on public.teachers
for insert to authenticated with check (public.has_institution_role(institution_id, array['owner','admin']));
create policy "administrators can update teachers" on public.teachers
for update to authenticated using (public.has_institution_role(institution_id, array['owner','admin']))
with check (public.has_institution_role(institution_id, array['owner','admin']));
create policy "administrators can delete teachers" on public.teachers
for delete to authenticated using (public.has_institution_role(institution_id, array['owner','admin']));

create policy "authorized users can view attendance" on public.attendance
for select to authenticated using (
  public.has_institution_role(institution_id, array['owner','admin','teacher','accountant','exam_officer'])
  or (student_id is not null and public.can_view_student(student_id))
);
create policy "teachers and administrators can add attendance" on public.attendance
for insert to authenticated with check (public.has_institution_role(institution_id, array['owner','admin','teacher']));
create policy "teachers and administrators can update attendance" on public.attendance
for update to authenticated using (public.has_institution_role(institution_id, array['owner','admin','teacher']))
with check (public.has_institution_role(institution_id, array['owner','admin','teacher']));
create policy "administrators can delete attendance" on public.attendance
for delete to authenticated using (public.has_institution_role(institution_id, array['owner','admin']));

create policy "authorized users can view class examinations" on public.exams
for select to authenticated using (
  public.has_institution_role(institution_id, array['owner','admin','teacher','accountant','exam_officer'])
  or public.can_view_class(institution_id, class_name)
);
create policy "teachers and exam officers can add exams" on public.exams
for insert to authenticated with check (public.has_institution_role(institution_id, array['owner','admin','teacher','exam_officer']));
create policy "teachers and exam officers can update exams" on public.exams
for update to authenticated using (public.has_institution_role(institution_id, array['owner','admin','teacher','exam_officer']))
with check (public.has_institution_role(institution_id, array['owner','admin','teacher','exam_officer']));
create policy "administrators and exam officers can delete exams" on public.exams
for delete to authenticated using (public.has_institution_role(institution_id, array['owner','admin','exam_officer']));

create policy "authorized users can view exam results" on public.exam_results
for select to authenticated using (
  public.has_institution_role(institution_id, array['owner','admin','teacher','exam_officer'])
  or public.can_view_student(student_id)
);
create policy "teachers and exam officers can add exam results" on public.exam_results
for insert to authenticated with check (public.has_institution_role(institution_id, array['owner','admin','teacher','exam_officer']));
create policy "teachers and exam officers can update exam results" on public.exam_results
for update to authenticated using (public.has_institution_role(institution_id, array['owner','admin','teacher','exam_officer']))
with check (public.has_institution_role(institution_id, array['owner','admin','teacher','exam_officer']));
create policy "administrators and exam officers can delete exam results" on public.exam_results
for delete to authenticated using (public.has_institution_role(institution_id, array['owner','admin','exam_officer']));

create policy "authorized users can view fee invoices" on public.fee_invoices
for select to authenticated using (
  public.has_institution_role(institution_id, array['owner','admin','accountant'])
  or (student_id is not null and public.can_view_student(student_id))
);
create policy "finance staff can add fee invoices" on public.fee_invoices
for insert to authenticated with check (public.has_institution_role(institution_id, array['owner','admin','accountant']));
create policy "finance staff can update fee invoices" on public.fee_invoices
for update to authenticated using (public.has_institution_role(institution_id, array['owner','admin','accountant']))
with check (public.has_institution_role(institution_id, array['owner','admin','accountant']));
create policy "administrators can delete fee invoices" on public.fee_invoices
for delete to authenticated using (public.has_institution_role(institution_id, array['owner','admin']));

create policy "authorized users can view class assignments" on public.assignments
for select to authenticated using (
  public.has_institution_role(institution_id, array['owner','admin','teacher','accountant','exam_officer'])
  or public.can_view_class(institution_id, class_name)
);
create policy "teachers and administrators can add assignments" on public.assignments
for insert to authenticated with check (public.has_institution_role(institution_id, array['owner','admin','teacher']));
create policy "teachers and administrators can update assignments" on public.assignments
for update to authenticated using (public.has_institution_role(institution_id, array['owner','admin','teacher']))
with check (public.has_institution_role(institution_id, array['owner','admin','teacher']));
create policy "administrators can delete assignments" on public.assignments
for delete to authenticated using (public.has_institution_role(institution_id, array['owner','admin']));

create policy "authorized users can view class timetable" on public.timetable_entries
for select to authenticated using (
  public.has_institution_role(institution_id, array['owner','admin','teacher','accountant','exam_officer'])
  or public.can_view_class(institution_id, class_name)
);
create policy "teachers and administrators can add timetable entries" on public.timetable_entries
for insert to authenticated with check (public.has_institution_role(institution_id, array['owner','admin','teacher']));
create policy "teachers and administrators can update timetable entries" on public.timetable_entries
for update to authenticated using (public.has_institution_role(institution_id, array['owner','admin','teacher']))
with check (public.has_institution_role(institution_id, array['owner','admin','teacher']));
create policy "administrators can delete timetable entries" on public.timetable_entries
for delete to authenticated using (public.has_institution_role(institution_id, array['owner','admin']));

create policy "members can view announcements for their audience" on public.announcements
for select to authenticated using (
  public.has_institution_role(institution_id, array['owner','admin','teacher','accountant','exam_officer'])
  or (audience = 'all' and public.is_institution_member(institution_id))
  or (audience = 'students' and public.has_institution_role(institution_id, array['student']))
  or (audience = 'parents' and public.has_institution_role(institution_id, array['parent']))
);
create policy "teachers and administrators can publish announcements" on public.announcements
for insert to authenticated with check (public.has_institution_role(institution_id, array['owner','admin','teacher']));
create policy "teachers and administrators can update announcements" on public.announcements
for update to authenticated using (public.has_institution_role(institution_id, array['owner','admin','teacher']))
with check (public.has_institution_role(institution_id, array['owner','admin','teacher']));
create policy "administrators can delete announcements" on public.announcements
for delete to authenticated using (public.has_institution_role(institution_id, array['owner','admin']));

-- Private institution document bucket. Every object path starts with the institution UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('institution-files', 'institution-files', false, 10485760,
  array['application/pdf','image/png','image/jpeg','image/webp','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create policy "members can view institution files" on storage.objects
for select to authenticated using (
  bucket_id = 'institution-files'
  and public.is_institution_member(((storage.foldername(name))[1])::uuid)
);
create policy "members can upload institution files" on storage.objects
for insert to authenticated with check (
  bucket_id = 'institution-files'
  and public.has_institution_role(((storage.foldername(name))[1])::uuid, array['owner','admin','teacher'])
);
create policy "administrators can delete institution files" on storage.objects
for delete to authenticated using (
  bucket_id = 'institution-files'
  and public.has_institution_role(((storage.foldername(name))[1])::uuid, array['owner','admin'])
);


-- Prevent records in one institution from referencing a student in another institution.
create or replace function public.enforce_student_institution()
returns trigger language plpgsql security definer set search_path = public
as $$
declare linked_institution uuid;
begin
  if new.student_id is null then return new; end if;
  select institution_id into linked_institution from public.students where id = new.student_id;
  if linked_institution is null or linked_institution <> new.institution_id then
    raise exception 'Student record must belong to the same institution.';
  end if;
  return new;
end;
$$;
create trigger attendance_student_tenant_check before insert or update on public.attendance
for each row execute function public.enforce_student_institution();
create trigger invoice_student_tenant_check before insert or update on public.fee_invoices
for each row execute function public.enforce_student_institution();
create trigger exam_result_student_tenant_check before insert or update on public.exam_results
for each row execute function public.enforce_student_institution();
create trigger guardian_student_tenant_check before insert or update on public.student_guardians
for each row execute function public.enforce_student_institution();

-- Important: never expose Supabase secret/service-role keys in VITE_ browser environment variables.
