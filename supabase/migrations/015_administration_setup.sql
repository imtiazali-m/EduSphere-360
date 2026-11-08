-- EduSphere 360 Phase One: institution setup, programs, classes, and subjects.
-- Safe to rerun. Requires the base 001_initial_schema.sql membership helper functions.

create extension if not exists pgcrypto;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  code text,
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, code)
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  name text not null,
  code text,
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, code)
);

create table if not exists public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  code text,
  description text,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, code),
  check (start_date is null or end_date is null or end_date >= start_date)
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  academic_session_id uuid references public.academic_sessions(id) on delete set null,
  name text not null,
  code text,
  description text,
  section text,
  grade_level text,
  capacity integer check (capacity is null or capacity >= 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, code)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  name text not null,
  code text,
  description text,
  subject_type text,
  credit_hours numeric(5,2) check (credit_hours is null or credit_hours >= 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, code)
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  code text,
  description text,
  room_type text,
  capacity integer check (capacity is null or capacity >= 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, code)
);

create index if not exists departments_institution_idx on public.departments(institution_id);
create index if not exists programs_institution_idx on public.programs(institution_id);
create index if not exists academic_sessions_institution_idx on public.academic_sessions(institution_id);
create index if not exists classes_institution_idx on public.classes(institution_id);
create index if not exists subjects_institution_idx on public.subjects(institution_id);
create index if not exists rooms_institution_idx on public.rooms(institution_id);

-- Use the same institution membership controls as the existing application tables.
do $$
declare t text;
begin
  foreach t in array array['departments','programs','academic_sessions','classes','subjects','rooms'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_members_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_institution_member(institution_id))', t || '_members_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admins_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_institution_role(institution_id, array[''owner'',''admin'']))', t || '_admins_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_admins_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_institution_role(institution_id, array[''owner'',''admin''])) with check (public.has_institution_role(institution_id, array[''owner'',''admin'']))', t || '_admins_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_admins_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_institution_role(institution_id, array[''owner'',''admin'']))', t || '_admins_delete', t);
  end loop;
end $$;
