-- Faculty attendance is stored separately from learner attendance.
-- This migration is additive and does not alter existing attendance records.
create table if not exists public.faculty_attendance (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  employee_no text not null,
  faculty_name text not null,
  department text,
  attendance_date date not null,
  status text not null default 'present' check (status in ('present','absent','late','half_day','leave')),
  check_in time,
  check_out time,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists faculty_attendance_institution_date_idx
  on public.faculty_attendance(institution_id, attendance_date desc);
create index if not exists faculty_attendance_employee_idx
  on public.faculty_attendance(institution_id, employee_no, attendance_date desc);

grant select, insert, update, delete on public.faculty_attendance to authenticated;
alter table public.faculty_attendance enable row level security;

create policy "administrators can view faculty attendance" on public.faculty_attendance
for select to authenticated using (public.has_institution_role(institution_id, array['owner','admin']));
create policy "administrators can add faculty attendance" on public.faculty_attendance
for insert to authenticated with check (public.has_institution_role(institution_id, array['owner','admin']));
create policy "administrators can update faculty attendance" on public.faculty_attendance
for update to authenticated using (public.has_institution_role(institution_id, array['owner','admin']))
with check (public.has_institution_role(institution_id, array['owner','admin']));
create policy "administrators can delete faculty attendance" on public.faculty_attendance
for delete to authenticated using (public.has_institution_role(institution_id, array['owner','admin']));
