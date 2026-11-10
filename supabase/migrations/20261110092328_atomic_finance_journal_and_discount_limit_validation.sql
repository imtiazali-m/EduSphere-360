CREATE OR REPLACE FUNCTION public.process_fee_discount_application(p_institution_id uuid, p_application_id uuid, p_decision text, p_remarks text DEFAULT NULL::text)
 RETURNS fee_discount_applications
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_application public.fee_discount_applications;
  v_discount public.fee_discounts;
  v_invoice public.fee_invoices;
  v_today date := (now() at time zone 'Asia/Karachi')::date;
  v_new_discount numeric(12,2);
  v_new_total numeric(12,2);
  v_allowed_discount numeric(12,2);
  v_remaining numeric(12,2);
  v_status text;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Choose approve or reject.'; end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin','accountant']::text[]) then
    raise exception 'You do not have permission to review fee discounts.';
  end if;

  select * into v_application
  from public.fee_discount_applications
  where id=p_application_id and institution_id=p_institution_id
  for update;
  if not found then raise exception 'Discount application not found.'; end if;
  if v_application.approval_status <> 'pending' then
    raise exception 'Only pending discount applications can be reviewed.';
  end if;

  if p_decision='reject' then
    update public.fee_discount_applications
       set approval_status='rejected',
           approved_by=auth.uid(),
           remarks=coalesce(nullif(btrim(coalesce(p_remarks,'')),''),remarks)
     where id=p_application_id and institution_id=p_institution_id
     returning * into v_application;
    insert into public.fee_audit_logs(institution_id,record_type,record_id,action,details,performed_by)
    values(p_institution_id,'discount_application',p_application_id,'discount_rejected',
      jsonb_build_object('invoice_id',v_application.invoice_id,'amount',v_application.amount,'remarks',p_remarks),auth.uid());
    return v_application;
  end if;

  select * into v_discount
  from public.fee_discounts
  where id=v_application.discount_id and institution_id=p_institution_id;
  if not found then raise exception 'The selected discount scheme no longer exists.'; end if;
  if v_discount.status <> 'active' then raise exception 'Only active discount schemes can be applied.'; end if;
  if v_discount.start_date is not null and v_discount.start_date > v_today then
    raise exception 'This discount scheme is not active yet.';
  end if;
  if v_discount.end_date is not null and v_discount.end_date < v_today then
    raise exception 'This discount scheme has expired.';
  end if;

  select * into v_invoice
  from public.fee_invoices
  where id=v_application.invoice_id and institution_id=p_institution_id
  for update;
  if not found then raise exception 'The invoice linked to this discount application was not found.'; end if;
  if v_application.amount is null or v_application.amount <= 0 then
    raise exception 'The requested discount amount must be greater than zero.';
  end if;
  if v_discount.fee_category is not null
     and lower(v_discount.fee_category) <> lower(coalesce(v_invoice.fee_category,'')) then
    raise exception 'This discount scheme does not apply to the invoice fee category.';
  end if;

  v_allowed_discount := case
    when v_discount.discount_type='percentage'
      then round((coalesce(v_invoice.amount,0)+coalesce(v_invoice.fine_amount,0)-coalesce(v_invoice.discount_amount,0))*coalesce(v_discount.discount_value,0)/100,2)
    else round(coalesce(v_discount.discount_value,0),2)
  end;
  v_remaining := round(coalesce(v_invoice.amount,0)+coalesce(v_invoice.fine_amount,0)-coalesce(v_invoice.discount_amount,0)-coalesce(v_invoice.paid_amount,0),2);
  if v_application.amount > v_allowed_discount then
    raise exception 'The requested discount exceeds the limit allowed by this scheme (%).',v_allowed_discount;
  end if;
  if v_application.amount > v_remaining then
    raise exception 'The requested discount exceeds the invoice balance remaining after payments (%).',v_remaining;
  end if;

  v_new_discount := round(coalesce(v_invoice.discount_amount,0) + v_application.amount,2);
  v_new_total := round(coalesce(v_invoice.amount,0)+coalesce(v_invoice.fine_amount,0)-v_new_discount,2);
  if v_new_discount > coalesce(v_invoice.amount,0)+coalesce(v_invoice.fine_amount,0) then
    raise exception 'The discount exceeds the invoice total.';
  end if;
  if coalesce(v_invoice.paid_amount,0) > v_new_total then
    raise exception 'This discount would reduce the invoice below the amount already received.';
  end if;

  v_status := case
    when coalesce(v_invoice.paid_amount,0) >= v_new_total then 'paid'
    when v_invoice.due_date is not null and v_invoice.due_date < v_today then 'overdue'
    when coalesce(v_invoice.paid_amount,0) > 0 then 'partial'
    else 'unpaid'
  end;

  update public.fee_invoices
     set discount_amount=v_new_discount,status=v_status,updated_at=now()
   where id=v_invoice.id and institution_id=p_institution_id;

  update public.fee_discount_applications
     set approval_status='approved',approved_by=auth.uid(),
         remarks=coalesce(nullif(btrim(coalesce(p_remarks,'')),''),remarks)
   where id=p_application_id and institution_id=p_institution_id
   returning * into v_application;

  insert into public.fee_audit_logs(institution_id,record_type,record_id,action,details,performed_by)
  values(p_institution_id,'discount_application',p_application_id,'discount_applied',
    jsonb_build_object('invoice_id',v_invoice.id,'discount_id',v_discount.id,'amount',v_application.amount,'new_discount_total',v_new_discount),auth.uid());

  return v_application;
end;
$function$


CREATE OR REPLACE FUNCTION public.create_finance_journal(p_institution_id uuid, p_journal_no text, p_journal_date date, p_description text, p_reference text DEFAULT NULL::text, p_lines jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_journal_id uuid;
  v_line_count integer;
  v_invalid_count integer;
  v_debit numeric(14,2);
  v_credit numeric(14,2);
  v_unknown_accounts integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin','accountant']::text[]) then
    raise exception 'You do not have permission to create finance journals.';
  end if;
  if nullif(btrim(coalesce(p_journal_no,'')),'') is null
     or nullif(btrim(coalesce(p_description,'')),'') is null
     or p_journal_date is null then
    raise exception 'Journal number, date and description are required.';
  end if;
  if jsonb_typeof(coalesce(p_lines,'[]'::jsonb)) <> 'array' then
    raise exception 'Journal lines must be supplied as an array.';
  end if;

  select count(*),
         count(*) filter (
           where coalesce((line->>'debit')::numeric,0) < 0
              or coalesce((line->>'credit')::numeric,0) < 0
              or ((coalesce((line->>'debit')::numeric,0)>0) = (coalesce((line->>'credit')::numeric,0)>0))
              or nullif(line->>'account_id','') is null
         ),
         coalesce(sum(coalesce((line->>'debit')::numeric,0)),0),
         coalesce(sum(coalesce((line->>'credit')::numeric,0)),0)
    into v_line_count,v_invalid_count,v_debit,v_credit
    from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) as input(line);

  if v_line_count < 2 then raise exception 'A journal must contain at least two lines.'; end if;
  if v_invalid_count > 0 then raise exception 'Each journal line must have a valid account and either a positive debit or a positive credit, not both.'; end if;
  if v_debit <= 0 or round(v_debit,2) <> round(v_credit,2) then
    raise exception 'Journal totals must balance before saving. Debits: %, credits: %.',v_debit,v_credit;
  end if;

  select count(*) into v_unknown_accounts
  from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) as input(line)
  where not exists (
    select 1 from public.finance_accounts account
    where account.id=(input.line->>'account_id')::uuid
      and account.institution_id=p_institution_id
      and account.is_active=true
  );
  if v_unknown_accounts > 0 then
    raise exception 'One or more journal accounts are inactive or do not belong to this institution.';
  end if;

  insert into public.finance_journals(institution_id,journal_no,journal_date,description,reference,status,created_by)
  values(p_institution_id,btrim(p_journal_no),p_journal_date,btrim(p_description),
         nullif(btrim(coalesce(p_reference,'')),''),'draft',auth.uid())
  returning id into v_journal_id;

  insert into public.finance_journal_lines(institution_id,journal_id,account_id,description,debit,credit)
  select p_institution_id,v_journal_id,(line->>'account_id')::uuid,
         nullif(btrim(coalesce(line->>'description','')),''),
         coalesce((line->>'debit')::numeric,0),coalesce((line->>'credit')::numeric,0)
  from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) as input(line);

  return v_journal_id;
end;
$function$



revoke all on function public.process_fee_discount_application(uuid,uuid,text,text) from public;
revoke all on function public.process_fee_discount_application(uuid,uuid,text,text) from anon;
grant execute on function public.process_fee_discount_application(uuid,uuid,text,text) to authenticated;


revoke all on function public.create_finance_journal(uuid,text,date,text,text,jsonb) from public;
revoke all on function public.create_finance_journal(uuid,text,date,text,text,jsonb) from anon;
grant execute on function public.create_finance_journal(uuid,text,date,text,text,jsonb) to authenticated;
