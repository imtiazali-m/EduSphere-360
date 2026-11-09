-- Atomic salary profile lifecycle for institution payroll.
begin;

revoke insert,update,delete on public.employee_salary_profiles from authenticated;

create or replace function public.save_employee_salary_profile(
  p_institution_id uuid,
  p_teacher_id uuid,
  p_base_salary numeric,
  p_monthly_allowances numeric default 0,
  p_monthly_deductions numeric default 0,
  p_effective_from date default current_date,
  p_effective_to date default null,
  p_notes text default null,
  p_profile_id uuid default null
)
returns public.employee_salary_profiles
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile public.employee_salary_profiles;
  v_teacher public.teachers;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin','accountant']::text[]) then
    raise exception 'You do not have permission to manage salary profiles for this institution.';
  end if;
  if p_base_salary is null or p_base_salary < 0
     or coalesce(p_monthly_allowances,0) < 0
     or coalesce(p_monthly_deductions,0) < 0
     or p_base_salary + coalesce(p_monthly_allowances,0) < coalesce(p_monthly_deductions,0) then
    raise exception 'Salary amounts must be non-negative and deductions cannot exceed base salary plus allowances.';
  end if;
  if p_effective_from is null or (p_effective_to is not null and p_effective_to < p_effective_from) then
    raise exception 'Enter a valid salary effective period.';
  end if;

  select * into v_teacher from public.teachers
   where id=p_teacher_id and institution_id=p_institution_id
   for update;
  if not found then raise exception 'Employee does not belong to this institution.'; end if;
  if coalesce(v_teacher.employment_status,'active') <> 'active' then
    raise exception 'Salary profiles can only be assigned to active employees.';
  end if;

  if p_profile_id is not null then
    select * into v_profile from public.employee_salary_profiles
     where id=p_profile_id and institution_id=p_institution_id and teacher_id=p_teacher_id
     for update;
    if not found then raise exception 'Salary profile not found for this employee.'; end if;
  end if;

  -- Serialize changes by employee row lock; one active profile remains after this transaction.
  update public.employee_salary_profiles
     set status='inactive',
         effective_to=case
           when effective_from < p_effective_from then least(coalesce(effective_to,p_effective_from-1),p_effective_from-1)
           else effective_to
         end,
         updated_by=auth.uid(),
         updated_at=now()
   where institution_id=p_institution_id and teacher_id=p_teacher_id and status='active'
     and (p_profile_id is null or id<>p_profile_id);

  if p_profile_id is null then
    insert into public.employee_salary_profiles(
      institution_id,teacher_id,base_salary,monthly_allowances,monthly_deductions,
      effective_from,effective_to,status,notes,created_by,updated_by
    ) values (
      p_institution_id,p_teacher_id,round(p_base_salary,2),round(coalesce(p_monthly_allowances,0),2),
      round(coalesce(p_monthly_deductions,0),2),p_effective_from,p_effective_to,'active',
      nullif(btrim(coalesce(p_notes,'')),''),auth.uid(),auth.uid()
    ) returning * into v_profile;
  else
    update public.employee_salary_profiles
       set base_salary=round(p_base_salary,2),
           monthly_allowances=round(coalesce(p_monthly_allowances,0),2),
           monthly_deductions=round(coalesce(p_monthly_deductions,0),2),
           effective_from=p_effective_from,effective_to=p_effective_to,
           status='active',notes=nullif(btrim(coalesce(p_notes,'')),''),
           updated_by=auth.uid(),updated_at=now()
     where id=p_profile_id and institution_id=p_institution_id and teacher_id=p_teacher_id
     returning * into v_profile;
  end if;
  return v_profile;
end;
$function$;
revoke all on function public.save_employee_salary_profile(uuid,uuid,numeric,numeric,numeric,date,date,text,uuid) from public,anon;
grant execute on function public.save_employee_salary_profile(uuid,uuid,numeric,numeric,numeric,date,date,text,uuid) to authenticated;

commit;
