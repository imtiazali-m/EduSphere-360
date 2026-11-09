-- Permit employees to read only payroll run headers containing their own payroll item.
begin;
create policy payroll_runs_employee_own_read on public.payroll_runs
  for select to authenticated
  using (
    exists (
      select 1
      from public.payroll_items pi
      join public.teachers t
        on t.id=pi.teacher_id and t.institution_id=pi.institution_id
      where pi.payroll_run_id=payroll_runs.id
        and pi.institution_id=payroll_runs.institution_id
        and t.user_id=(select auth.uid())
    )
  );
commit;
