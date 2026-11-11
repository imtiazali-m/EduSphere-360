-- Employee self-acknowledgement for reviewed performance appraisals.
begin;
drop policy if exists employee_appraisals_own_acknowledged_read on public.employee_appraisals;
create policy employee_appraisals_own_acknowledged_read
on public.employee_appraisals
for select to authenticated
using (
  status in ('reviewed','acknowledged')
  and exists (
    select 1 from public.teachers t
    where t.id=employee_appraisals.teacher_id
      and t.institution_id=employee_appraisals.institution_id
      and t.user_id=auth.uid()
  )
);
create or replace function public.acknowledge_employee_appraisal(
  p_institution_id uuid,
  p_appraisal_id uuid,
  p_response text default null
)
returns public.employee_appraisals
language plpgsql
security definer
set search_path=''
as $function$
declare v_appraisal public.employee_appraisals;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  select a.* into v_appraisal
  from public.employee_appraisals a
  join public.teachers t on t.id=a.teacher_id and t.institution_id=a.institution_id
  where a.id=p_appraisal_id and a.institution_id=p_institution_id and t.user_id=auth.uid()
  for update of a;
  if not found then raise exception 'This performance review is not linked to your employee account.'; end if;
  if v_appraisal.status='acknowledged' then return v_appraisal; end if;
  if v_appraisal.status<>'reviewed' then raise exception 'Only a completed review can be acknowledged by the employee.'; end if;
  update public.employee_appraisals
  set status='acknowledged',acknowledged_at=now(),
      employee_response=nullif(left(btrim(coalesce(p_response,'')),4000),''),
      updated_at=now()
  where id=p_appraisal_id and institution_id=p_institution_id
  returning * into v_appraisal;
  return v_appraisal;
end;
$function$;
revoke all on function public.acknowledge_employee_appraisal(uuid,uuid,text) from public,anon;
grant execute on function public.acknowledge_employee_appraisal(uuid,uuid,text) to authenticated;
commit;
