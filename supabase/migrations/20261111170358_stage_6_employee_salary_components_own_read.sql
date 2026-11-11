-- Allow an employee to read only recurring components attached to their own salary profile.
begin;
drop policy if exists employee_salary_components_own_read on public.employee_salary_components;
create policy employee_salary_components_own_read
on public.employee_salary_components
for select to authenticated
using (
  exists (
    select 1
    from public.employee_salary_profiles p
    join public.teachers t
      on t.id=p.teacher_id
     and t.institution_id=p.institution_id
    where p.id=employee_salary_components.salary_profile_id
      and p.institution_id=employee_salary_components.institution_id
      and t.user_id=auth.uid()
  )
);
