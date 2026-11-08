-- Administration compatibility for the existing EduSphere 360 live schema.
begin;

alter table public.departments
  add column if not exists code text,
  add column if not exists description text,
  add column if not exists is_active boolean not null default true;
update public.departments
set code=coalesce(nullif(btrim(code),''),department_code), is_active=(status='active')
where code is null or is_active is null;
create unique index if not exists departments_institution_code_compat_uidx
  on public.departments(institution_id,code) where code is not null;

create or replace function public.sync_department_compat_columns()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.department_code is null or btrim(new.department_code)='' then
    new.department_code:=coalesce(nullif(btrim(new.code),''),'DEP-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
  end if;
  if new.code is null or btrim(new.code)='' then new.code:=new.department_code; end if;
  if tg_op='UPDATE' then
    if new.is_active is distinct from old.is_active then new.status:=case when new.is_active then 'active' else 'inactive' end;
    elsif new.status is distinct from old.status then new.is_active:=(new.status='active'); end if;
  else new.status:=case when new.is_active then 'active' else 'inactive' end;
  end if;
  return new;
end $$;
drop trigger if exists sync_department_compat_columns on public.departments;
create trigger sync_department_compat_columns before insert or update on public.departments
for each row execute function public.sync_department_compat_columns();

alter table public.academic_sessions
  add column if not exists name text,
  add column if not exists code text,
  add column if not exists description text,
  add column if not exists is_current boolean not null default false,
  add column if not exists is_active boolean not null default true;
alter table public.academic_sessions alter column start_date drop not null;
alter table public.academic_sessions alter column end_date drop not null;
update public.academic_sessions
set name=coalesce(nullif(btrim(name),''),session_name),
    is_current=(status='active'), is_active=(status<>'completed')
where name is null or is_current is null or is_active is null;
create unique index if not exists academic_sessions_institution_code_compat_uidx
  on public.academic_sessions(institution_id,code) where code is not null;

create or replace function public.sync_academic_session_compat_columns()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.session_name is null or btrim(new.session_name)='' then new.session_name:=new.name; end if;
  if new.name is null or btrim(new.name)='' then new.name:=new.session_name; end if;
  if tg_op='UPDATE' then
    if new.is_current is distinct from old.is_current then
      new.status:=case when new.is_current then 'active' else case when new.is_active then 'planned' else 'completed' end end;
    elsif new.is_active is distinct from old.is_active then
      new.status:=case when new.is_active then 'planned' else 'completed' end;
      if new.is_current then new.status:='active'; end if;
    elsif new.status is distinct from old.status then
      new.is_current:=(new.status='active'); new.is_active:=(new.status<>'completed');
    end if;
  else
    if new.is_current then new.status:='active';
    elsif not new.is_active then new.status:='completed';
    elsif new.status is null then new.status:='planned'; end if;
  end if;
  return new;
end $$;
drop trigger if exists sync_academic_session_compat_columns on public.academic_sessions;
create trigger sync_academic_session_compat_columns before insert or update on public.academic_sessions
for each row execute function public.sync_academic_session_compat_columns();

alter table public.subjects
  add column if not exists code text,
  add column if not exists description text,
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists subject_type text,
  add column if not exists credit_hours numeric(5,2),
  add column if not exists is_active boolean not null default true;
update public.subjects set code=coalesce(nullif(btrim(code),''),subject_code),is_active=(status='active')
where code is null or is_active is null;
create unique index if not exists subjects_institution_code_compat_uidx
  on public.subjects(institution_id,code) where code is not null;

create or replace function public.sync_subject_compat_columns()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.subject_code is null or btrim(new.subject_code)='' then
    new.subject_code:=coalesce(nullif(btrim(new.code),''),'SUB-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
  end if;
  if new.code is null or btrim(new.code)='' then new.code:=new.subject_code; end if;
  if tg_op='UPDATE' then
    if new.is_active is distinct from old.is_active then new.status:=case when new.is_active then 'active' else 'inactive' end;
    elsif new.status is distinct from old.status then new.is_active:=(new.status='active'); end if;
  else new.status:=case when new.is_active then 'active' else 'inactive' end;
  end if;
  return new;
end $$;
drop trigger if exists sync_subject_compat_columns on public.subjects;
create trigger sync_subject_compat_columns before insert or update on public.subjects
for each row execute function public.sync_subject_compat_columns();

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  name text not null, code text, description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(institution_id,code)
);
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  academic_session_id uuid references public.academic_sessions(id) on delete set null,
  name text not null, code text, description text, section text, grade_level text,
  capacity integer check(capacity is null or capacity>=0), is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(institution_id,code)
);
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null, code text, description text, room_type text,
  capacity integer check(capacity is null or capacity>=0), is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(institution_id,code)
);
create index if not exists programs_institution_idx on public.programs(institution_id);
create index if not exists classes_institution_idx on public.classes(institution_id);
create index if not exists rooms_institution_idx on public.rooms(institution_id);
grant select,insert,update,delete on public.programs,public.classes,public.rooms to authenticated;
alter table public.programs enable row level security;
alter table public.classes enable row level security;
alter table public.rooms enable row level security;
do $$ declare t text; begin
  foreach t in array array['programs','classes','rooms'] loop
    execute format('drop policy if exists %I on public.%I',t||'_admin_select',t);
    execute format('create policy %I on public.%I for select to authenticated using (public.has_institution_role(institution_id,array[''owner'',''admin'']))',t||'_admin_select',t);
    execute format('drop policy if exists %I on public.%I',t||'_admin_insert',t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_institution_role(institution_id,array[''owner'',''admin'']))',t||'_admin_insert',t);
    execute format('drop policy if exists %I on public.%I',t||'_admin_update',t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_institution_role(institution_id,array[''owner'',''admin''])) with check (public.has_institution_role(institution_id,array[''owner'',''admin'']))',t||'_admin_update',t);
    execute format('drop policy if exists %I on public.%I',t||'_admin_delete',t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_institution_role(institution_id,array[''owner'',''admin'']))',t||'_admin_delete',t);
  end loop;
end $$;

create or replace function public.enforce_academic_reference_tenant()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_institution uuid;
begin
  if tg_table_name='programs' then
    if new.department_id is not null then
      select institution_id into v_institution from public.departments where id=new.department_id;
      if v_institution is distinct from new.institution_id then raise exception 'The selected department must belong to this institution.'; end if;
    end if;
  elsif tg_table_name='classes' then
    if new.program_id is not null then
      select institution_id into v_institution from public.programs where id=new.program_id;
      if v_institution is distinct from new.institution_id then raise exception 'The selected program must belong to this institution.'; end if;
    end if;
    if new.academic_session_id is not null then
      select institution_id into v_institution from public.academic_sessions where id=new.academic_session_id;
      if v_institution is distinct from new.institution_id then raise exception 'The selected academic session must belong to this institution.'; end if;
    end if;
  elsif tg_table_name='subjects' then
    if new.department_id is not null then
      select institution_id into v_institution from public.departments where id=new.department_id;
      if v_institution is distinct from new.institution_id then raise exception 'The selected department must belong to this institution.'; end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists programs_reference_tenant_check on public.programs;
create trigger programs_reference_tenant_check before insert or update on public.programs for each row execute function public.enforce_academic_reference_tenant();
drop trigger if exists classes_reference_tenant_check on public.classes;
create trigger classes_reference_tenant_check before insert or update on public.classes for each row execute function public.enforce_academic_reference_tenant();
drop trigger if exists subjects_reference_tenant_check on public.subjects;
create trigger subjects_reference_tenant_check before insert or update on public.subjects for each row execute function public.enforce_academic_reference_tenant();

revoke all on function public.sync_department_compat_columns() from public,anon,authenticated;
revoke all on function public.sync_academic_session_compat_columns() from public,anon,authenticated;
revoke all on function public.sync_subject_compat_columns() from public,anon,authenticated;
revoke all on function public.enforce_academic_reference_tenant() from public,anon,authenticated;
commit;
