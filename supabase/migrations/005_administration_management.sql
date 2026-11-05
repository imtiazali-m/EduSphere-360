-- EduSphere 360: Administration Management
-- Institution-scoped master data with administrator-only write access.

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  department_code text not null,
  name text not null,
  head_name text,
  email text,
  phone text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, department_code)
);

create table if not exists public.institution_classes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  class_name text not null,
  section text not null default '',
  class_teacher text,
  room text,
  capacity integer check (capacity is null or capacity >= 0),
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, class_name, section)
);

create table if not exists public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  session_name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'planned' check (status in ('planned','active','completed')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  unique (institution_id, session_name)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  subject_code text not null,
  name text not null,
  department text,
  level text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, subject_code)
);

create table if not exists public.institution_rooms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  room_code text not null,
  name text not null,
  room_type text not null default 'classroom' check (room_type in ('classroom','laboratory','library','hall','office')),
  capacity integer check (capacity is null or capacity >= 0),
  location text,
  status text not null default 'available' check (status in ('available','maintenance','unavailable')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, room_code)
);

create index if not exists departments_institution_idx on public.departments(institution_id);
create index if not exists institution_classes_institution_idx on public.institution_classes(institution_id);
create index if not exists academic_sessions_institution_idx on public.academic_sessions(institution_id, start_date desc);
create index if not exists subjects_institution_idx on public.subjects(institution_id);
create index if not exists institution_rooms_institution_idx on public.institution_rooms(institution_id);

revoke all on public.departments, public.institution_classes, public.academic_sessions, public.subjects, public.institution_rooms from anon;
grant select, insert, update, delete on public.departments, public.institution_classes, public.academic_sessions, public.subjects, public.institution_rooms to authenticated;

alter table public.departments enable row level security;
alter table public.institution_classes enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.subjects enable row level security;
alter table public.institution_rooms enable row level security;

do $$
declare t text;
begin
  foreach t in array array['departments','institution_classes','academic_sessions','subjects','institution_rooms'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.has_institution_role(institution_id, array[''owner'',''admin'']))', t || '_admin_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_institution_role(institution_id, array[''owner'',''admin'']))', t || '_admin_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_institution_role(institution_id, array[''owner'',''admin''])) with check (public.has_institution_role(institution_id, array[''owner'',''admin'']))', t || '_admin_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_institution_role(institution_id, array[''owner'',''admin'']))', t || '_admin_delete', t);
  end loop;
end $$;
