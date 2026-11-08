-- PROPOSED (not applied): faculty attendance register.
-- Additive only: creates one new table with RLS. Does not alter or drop anything existing.
create table if not exists public.faculty_attendance (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  attendance_date date not null,
  status text not null default 'present' check (status in ('present','absent','late','leave')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, attendance_date)
);

alter table public.faculty_attendance enable row level security;

drop policy if exists "owners and admins read faculty attendance" on public.faculty_attendance;
create policy "owners and admins read faculty attendance" on public.faculty_attendance
  for select to authenticated
  using (public.has_institution_role(institution_id, array['owner','admin']));

drop policy if exists "owners and admins write faculty attendance" on public.faculty_attendance;
create policy "owners and admins write faculty attendance" on public.faculty_attendance
  for all to authenticated
  using (public.has_institution_role(institution_id, array['owner','admin']))
  with check (public.has_institution_role(institution_id, array['owner','admin']));

grant select, insert, update, delete on public.faculty_attendance to authenticated;
