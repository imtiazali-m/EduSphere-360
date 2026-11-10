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


CREATE OR REPLACE FUNCTION public.process_fee_refund(p_institution_id uuid, p_refund_id uuid, p_decision text, p_remarks text DEFAULT NULL::text)
 RETURNS fee_refunds
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_refund public.fee_refunds;
  v_payment public.fee_payments;
  v_invoice public.fee_invoices;
  v_prior_refunds numeric(12,2);
  v_new_paid numeric(12,2);
  v_invoice_total numeric(12,2);
  v_status text;
  v_today date := (now() at time zone 'Asia/Karachi')::date;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;
  if p_decision not in ('complete','reject') then
    raise exception 'Choose complete or reject.';
  end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin','accountant']::text[]) then
    raise exception 'You do not have permission to review fee refunds.';
  end if;

  select * into v_refund
  from public.fee_refunds
  where id=p_refund_id and institution_id=p_institution_id
  for update;
  if not found then raise exception 'Refund request not found.'; end if;
  if v_refund.status <> 'pending' then
    raise exception 'Only pending refund requests can be reviewed.';
  end if;

  if p_decision='reject' then
    update public.fee_refunds
       set status='rejected',
           processed_by=auth.uid(),
           reason=concat_ws(E'\n',nullif(reason,''),nullif(btrim(coalesce(p_remarks,'')),''))
     where id=p_refund_id and institution_id=p_institution_id
     returning * into v_refund;
    insert into public.fee_audit_logs(institution_id,record_type,record_id,action,details,performed_by)
    values(p_institution_id,'refund',p_refund_id,'refund_rejected',
      jsonb_build_object('invoice_id',v_refund.invoice_id,'payment_id',v_refund.payment_id,'amount',v_refund.amount,'remarks',p_remarks),auth.uid());
    return v_refund;
  end if;

  select * into v_payment
  from public.fee_payments
  where id=v_refund.payment_id and invoice_id=v_refund.invoice_id and institution_id=p_institution_id
  for update;
  if not found then raise exception 'The payment linked to this refund could not be found.'; end if;

  select * into v_invoice
  from public.fee_invoices
  where id=v_refund.invoice_id and institution_id=p_institution_id
  for update;
  if not found then raise exception 'The invoice linked to this refund could not be found.'; end if;

  select coalesce(sum(amount),0)
    into v_prior_refunds
    from public.fee_refunds
   where institution_id=p_institution_id
     and payment_id=v_payment.id
     and status='completed'
     and id<>p_refund_id;

  if v_refund.amount is null or v_refund.amount <= 0
     or v_prior_refunds + v_refund.amount > v_payment.amount then
    raise exception 'The refund exceeds the unrefunded amount of the original payment.';
  end if;
  if v_invoice.paid_amount < v_refund.amount then
    raise exception 'The refund would reduce the invoice below zero payments. Review the invoice before continuing.';
  end if;

  v_new_paid := round(coalesce(v_invoice.paid_amount,0)-v_refund.amount,2);
  v_invoice_total := round(coalesce(v_invoice.amount,0)+coalesce(v_invoice.fine_amount,0)-coalesce(v_invoice.discount_amount,0),2);
  v_status := case
    when v_new_paid >= v_invoice_total then 'paid'
    when v_invoice.due_date is not null and v_invoice.due_date < v_today then 'overdue'
    when v_new_paid > 0 then 'partial'
    else 'unpaid'
  end;

  update public.fee_invoices
     set paid_amount=v_new_paid,status=v_status,updated_at=now()
   where id=v_invoice.id and institution_id=p_institution_id;

  update public.fee_refunds
     set status='completed',
         processed_by=auth.uid(),
         reason=concat_ws(E'\n',nullif(reason,''),nullif(btrim(coalesce(p_remarks,'')),''))
   where id=p_refund_id and institution_id=p_institution_id
   returning * into v_refund;

  insert into public.fee_audit_logs(institution_id,record_type,record_id,action,details,performed_by)
  values(p_institution_id,'refund',p_refund_id,'refund_completed',
    jsonb_build_object('invoice_id',v_invoice.id,'payment_id',v_payment.id,'amount',v_refund.amount,'new_paid_amount',v_new_paid),auth.uid());

  return v_refund;
end;
$function$



revoke all on function public.process_fee_discount_application(uuid,uuid,text,text) from public;
revoke all on function public.process_fee_discount_application(uuid,uuid,text,text) from anon;
grant execute on function public.process_fee_discount_application(uuid,uuid,text,text) to authenticated;

revoke all on function public.process_fee_refund(uuid,uuid,text,text) from public;
revoke all on function public.process_fee_refund(uuid,uuid,text,text) from anon;
grant execute on function public.process_fee_refund(uuid,uuid,text,text) to authenticated;
