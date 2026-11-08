-- EduSphere 360 Phase Two: explicit, institution-scoped student write authorization.
-- This refreshes the existing admin-only INSERT rule; it does not disable RLS.

create or replace function public.can_manage_students(target_institution uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.memberships m
    where m.institution_id = target_institution
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

revoke all on function public.can_manage_students(uuid) from public;
revoke all on function public.can_manage_students(uuid) from anon;
grant execute on function public.can_manage_students(uuid) to authenticated;

grant select, insert, update, delete on public.students to authenticated;
alter table public.students enable row level security;

drop policy if exists "administrators can add students" on public.students;
create policy "administrators can add students"
on public.students
for insert to authenticated
with check (
  public.can_manage_students(institution_id)
  and (created_by is null or created_by = (select auth.uid()))
);
