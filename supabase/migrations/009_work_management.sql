-- Institutional task allocation and staff progress tracking.
create table if not exists public.work_tasks (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  title text not null,
  task_type text not null default 'other' check (task_type in ('academic','administration','operations','student_support','other')),
  description text not null,
  assigned_to_name text not null,
  assigned_to_email text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','in_progress','blocked','completed')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  completion_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_tasks_institution_due_idx on public.work_tasks(institution_id, due_date);
create index if not exists work_tasks_assignee_idx on public.work_tasks(institution_id, lower(assigned_to_email), status);

grant select, insert, update, delete on public.work_tasks to authenticated;
alter table public.work_tasks enable row level security;

drop policy if exists "staff view assigned work and admins view all" on public.work_tasks;
create policy "staff view assigned work and admins view all" on public.work_tasks
for select to authenticated using (
  public.has_institution_role(institution_id, array['owner','admin'])
  or (
    public.has_institution_role(institution_id, array['teacher','accountant','exam_officer'])
    and lower(assigned_to_email) = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "administrators create work tasks" on public.work_tasks;
create policy "administrators create work tasks" on public.work_tasks
for insert to authenticated with check (public.has_institution_role(institution_id, array['owner','admin']));

drop policy if exists "admins and assignees update work tasks" on public.work_tasks;
create policy "admins and assignees update work tasks" on public.work_tasks
for update to authenticated using (
  public.has_institution_role(institution_id, array['owner','admin'])
  or (
    public.has_institution_role(institution_id, array['teacher','accountant','exam_officer'])
    and lower(assigned_to_email) = lower((select auth.jwt() ->> 'email'))
  )
) with check (
  public.has_institution_role(institution_id, array['owner','admin'])
  or (
    public.has_institution_role(institution_id, array['teacher','accountant','exam_officer'])
    and lower(assigned_to_email) = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "administrators delete work tasks" on public.work_tasks;
create policy "administrators delete work tasks" on public.work_tasks
for delete to authenticated using (public.has_institution_role(institution_id, array['owner','admin']));

create or replace function public.guard_work_task_assignment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  assignee_name text;
  assignee_role text;
begin
  if tg_op = 'INSERT' or new.assigned_to_email is distinct from old.assigned_to_email then
    select p.full_name, m.role into assignee_name, assignee_role
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.institution_id = new.institution_id
      and m.status = 'active'
      and lower(p.email) = lower(new.assigned_to_email)
      and m.role in ('owner','admin','teacher','accountant','exam_officer')
    limit 1;
    if assignee_role is null then
      raise exception 'The assigned email must belong to an active staff account in this institution.';
    end if;
    new.assigned_to_name := coalesce(assignee_name, new.assigned_to_name);
  end if;

  if new.status = 'completed' then
    new.progress_percent := 100;
  elsif new.progress_percent = 100 then
    new.status := 'completed';
  end if;

  if tg_op = 'UPDATE' and not public.has_institution_role(new.institution_id, array['owner','admin']) then
    if new.assigned_to_email is distinct from old.assigned_to_email
      or new.assigned_to_name is distinct from old.assigned_to_name
      or new.title is distinct from old.title
      or new.task_type is distinct from old.task_type
      or new.description is distinct from old.description
      or new.priority is distinct from old.priority
      or new.due_date is distinct from old.due_date
      or new.institution_id is distinct from old.institution_id
      or new.created_by is distinct from old.created_by then
      raise exception 'Only administrators may reassign or redefine institutional work.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_work_task_assignment on public.work_tasks;
create trigger guard_work_task_assignment
before insert or update on public.work_tasks
for each row execute function public.guard_work_task_assignment();
