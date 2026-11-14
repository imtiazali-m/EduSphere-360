-- Apply custom college permissions to high-impact SECURITY DEFINER workflows.
-- Existing base membership role checks remain in place; the job profile is an additional restriction.

create or replace function public.approve_assessment_paper(p_institution_id uuid, p_paper_id uuid)
returns public.assessment_papers
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_paper public.assessment_papers;
  v_count integer;
  v_unpublished integer;
  v_total numeric(10,2);
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin','exam_officer']::text[]) then
    raise exception 'Only an institution owner, administrator or examination officer can approve a question paper.';
  end if;

  select * into v_paper
    from public.assessment_papers
   where id=p_paper_id and institution_id=p_institution_id
   for update;
  if not found then raise exception 'Question paper not found.'; end if;

  if not private.has_institution_permission(
    p_institution_id,'examinations','approve',null,
    private.college_department_for_class(v_paper.class_id)
  ) then
    raise exception 'Your assigned college role cannot approve examination papers.';
  end if;

  if v_paper.status not in ('draft','review') then
    raise exception 'Only a draft or reviewed question paper can be approved.';
  end if;

  select count(*),
         count(*) filter(where q.status<>'published'),
         coalesce(sum(coalesce(pi.marks_override,q.marks)),0)
    into v_count,v_unpublished,v_total
    from public.assessment_paper_items pi
    join public.question_bank_items q
      on q.id=pi.question_id and q.institution_id=pi.institution_id
   where pi.institution_id=p_institution_id and pi.paper_id=p_paper_id;

  if v_count=0 then raise exception 'Add at least one question before approving the paper.'; end if;
  if v_unpublished>0 then raise exception 'Every question in an approved paper must be published in the question bank.'; end if;
  if round(v_total,2)<>round(v_paper.maximum_marks,2) then
    raise exception 'Selected questions total % marks, but the paper maximum is %.',v_total,v_paper.maximum_marks;
  end if;

  update public.assessment_papers
     set status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now()
   where id=p_paper_id and institution_id=p_institution_id
   returning * into v_paper;
  return v_paper;
end;
$function$;

create or replace function public.approve_payroll_run(p_institution_id uuid, p_payroll_run_id uuid)
returns public.payroll_runs
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_run public.payroll_runs;
  v_count integer;
  v_invalid integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin']::text[]) then
    raise exception 'Only an institution owner or administrator can approve payroll.';
  end if;
  if not private.has_institution_permission(p_institution_id,'payroll','approve',null,null) then
    raise exception 'Your assigned college role cannot approve payroll.';
  end if;

  select * into v_run from public.payroll_runs
   where id=p_payroll_run_id and institution_id=p_institution_id for update;
  if not found then raise exception 'Payroll run not found.'; end if;
  if v_run.status <> 'draft' and v_run.status <> 'review' then
    raise exception 'Only draft or review payroll runs can be approved.';
  end if;
  select count(*),count(*) filter (where net_pay < 0 or gross_pay < 0)
    into v_count,v_invalid
    from public.payroll_items
   where institution_id=p_institution_id and payroll_run_id=p_payroll_run_id;
  if v_count=0 then raise exception 'Payroll run has no employee entries.'; end if;
  if v_invalid>0 then raise exception 'Payroll contains an invalid negative amount.'; end if;
  update public.payroll_runs
     set status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now()
   where id=p_payroll_run_id and institution_id=p_institution_id
   returning * into v_run;
  return v_run;
end;
$function$;

create or replace function public.create_payroll_adjustment(
  p_institution_id uuid,p_teacher_id uuid,p_period_start date,p_period_end date,
  p_adjustment_type text,p_amount numeric,p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_campus_id uuid;
  v_department_id uuid;
begin
  if auth.uid() is null or not public.has_institution_role(p_institution_id,array['owner','admin','accountant']::text[]) then
    raise exception 'You do not have permission to submit payroll adjustments.';
  end if;
  select t.campus_id into v_campus_id
    from public.teachers t
   where t.id=p_teacher_id and t.institution_id=p_institution_id;
  if not found then raise exception 'Employee does not belong to this institution.'; end if;
  v_department_id:=private.college_department_for_teacher(p_teacher_id);
  if not private.has_institution_permission(p_institution_id,'payroll','create',v_campus_id,v_department_id) then
    raise exception 'Your assigned college role cannot create payroll adjustments.';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end<p_period_start then raise exception 'Enter a valid adjustment period.'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Adjustment amount must be greater than zero.'; end if;
  if p_adjustment_type not in ('allowance','bonus','overtime','deduction','unpaid_leave','advance_recovery') then raise exception 'Unsupported payroll adjustment type.'; end if;
  if exists(select 1 from public.payroll_runs r where r.institution_id=p_institution_id and r.period_start=p_period_start and r.period_end=p_period_end and r.status<>'cancelled') then
    raise exception 'This payroll period already exists. Adjustments must be approved before generating the draft run.';
  end if;
  insert into public.payroll_adjustments(institution_id,teacher_id,period_start,period_end,adjustment_type,amount,description,status,created_by)
  values(p_institution_id,p_teacher_id,p_period_start,p_period_end,p_adjustment_type,round(p_amount,2),nullif(btrim(coalesce(p_description,'')),''),'pending',auth.uid())
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.create_student_transport_fee_charge(
  p_institution_id uuid,p_allocation_id uuid,p_billing_period text,p_due_date date
)
returns public.student_transport_fee_charges
language plpgsql
security definer
set search_path = ''
as $function$
declare
  allocation_row public.student_transport_allocations;
  charge_row public.student_transport_fee_charges;
  v_campus_id uuid;
  v_department_id uuid;
begin
  if auth.uid() is null or not public.has_institution_role(p_institution_id,array['owner'::text,'admin'::text,'accountant'::text]) then
    raise exception 'Owner, administrator or accountant access is required';
  end if;
  if p_billing_period !~ '^[0-9]{4}-[0-9]{2}$' then raise exception 'Billing period must use YYYY-MM format'; end if;
  if p_due_date is null then raise exception 'A due date is required'; end if;
  select * into allocation_row from public.student_transport_allocations
   where id=p_allocation_id and institution_id=p_institution_id for update;
  if not found or allocation_row.status<>'active' then raise exception 'Only active transport allocations can be charged'; end if;
  if allocation_row.transport_fee<=0 then raise exception 'This allocation has no transport fee to invoice'; end if;

  select s.campus_id into v_campus_id
    from public.students s
   where s.id=allocation_row.student_id and s.institution_id=p_institution_id;
  v_department_id:=private.college_department_for_student(allocation_row.student_id);
  if not private.has_institution_permission(p_institution_id,'transport','create',v_campus_id,v_department_id) then
    raise exception 'Your assigned college role cannot create transport fee charges.';
  end if;

  insert into public.student_transport_fee_charges(institution_id,allocation_id,billing_period,amount,due_date,created_by)
  values(p_institution_id,p_allocation_id,p_billing_period,allocation_row.transport_fee,p_due_date,auth.uid())
  on conflict(institution_id,allocation_id,billing_period) do update
  set due_date=excluded.due_date,updated_at=now()
  returning * into charge_row;
  return charge_row;
end;
$function$;

create or replace function public.decide_institution_setting_approval(
  p_institution_id uuid,p_approval_id uuid,p_decision text,p_notes text default null
)
returns public.workflow_approvals
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.workflow_approvals;
  v_payload jsonb;
  v_updated integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Choose approve or reject.'; end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin']::text[]) then
    raise exception 'Only the institution owner or an administrator can decide settings requests.';
  end if;
  if not private.has_institution_permission(p_institution_id,'approvals','approve',null,null) then
    raise exception 'Your assigned college role cannot decide institutional approvals.';
  end if;

  select * into v_request
    from public.workflow_approvals
   where id=p_approval_id and institution_id=p_institution_id
   for update;
  if not found then raise exception 'Approval request not found.'; end if;
  if v_request.status <> 'pending' then raise exception 'Only pending requests can be decided.'; end if;

  if v_request.workflow_key='institution_setting_change' and p_decision='approved' then
    v_payload:=v_request.payload;
    if jsonb_typeof(v_payload)<>'object'
       or nullif(btrim(coalesce(v_payload->>'setting_key','')),'') is null
       or nullif(btrim(coalesce(v_payload->>'category','')),'') is null
       or not (v_payload ? 'setting_value') then
      raise exception 'The settings request is incomplete. No setting was applied.';
    end if;

    update public.institution_settings
       set category=btrim(v_payload->>'category'),
           setting_key=btrim(v_payload->>'setting_key'),
           setting_value=v_payload->'setting_value',
           is_public=coalesce((v_payload->>'is_public')::boolean,false),
           updated_by=auth.uid(),
           updated_at=now()
     where id=v_request.target_id and institution_id=p_institution_id;
    get diagnostics v_updated = row_count;
    if v_updated=0 then
      insert into public.institution_settings(
        id,institution_id,category,setting_key,setting_value,is_public,updated_by
      ) values(
        v_request.target_id,p_institution_id,btrim(v_payload->>'category'),
        btrim(v_payload->>'setting_key'),v_payload->'setting_value',
        coalesce((v_payload->>'is_public')::boolean,false),auth.uid()
      );
    end if;
  end if;

  update public.workflow_approvals
     set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),
         decision_notes=nullif(btrim(coalesce(p_notes,'')),''),
         updated_at=now()
   where id=p_approval_id and institution_id=p_institution_id
   returning * into v_request;
  return v_request;
end;
$function$;
