-- EduSphere 360 Phase Two: validate payment dates and calculate overdue status at collection time.
-- Additive patch for installations where migration 014 is already recorded as applied.

begin;

create or replace function public.record_fee_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_reference text default null,
  p_payment_date date default current_date,
  p_notes text default null
)
returns table (
  payment_id uuid,
  receipt_no text,
  invoice_id uuid,
  paid_amount numeric,
  balance numeric,
  invoice_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.fee_invoices%rowtype;
  v_payment_id uuid;
  v_receipt_no text;
  v_new_paid numeric(12,2);
  v_new_balance numeric(12,2);
  v_new_status text;
  v_payment_date date;
  v_today date;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to record a payment.';
  end if;

  if p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount then
    raise exception 'Enter a payment amount greater than zero with no more than two decimal places.';
  end if;

  v_today := (now() at time zone 'Asia/Karachi')::date;
  v_payment_date := coalesce(p_payment_date, v_today);
  if v_payment_date > v_today then
    raise exception 'A fee payment date cannot be in the future.';
  end if;

  if p_payment_method not in ('cash','bank_transfer','card','online','cheque','other') then
    raise exception 'Select a valid payment method.';
  end if;

  select * into v_invoice
  from public.fee_invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found.';
  end if;

  if not public.has_institution_role(v_invoice.institution_id, array['owner','admin','accountant']) then
    raise exception 'You do not have permission to record fee payments.';
  end if;

  v_new_balance := v_invoice.amount - v_invoice.discount_amount - v_invoice.paid_amount;
  if p_amount > v_new_balance then
    raise exception 'Payment exceeds the outstanding balance of %.', v_new_balance;
  end if;

  v_new_paid := v_invoice.paid_amount + p_amount;
  v_new_balance := v_invoice.amount - v_invoice.discount_amount - v_new_paid;

  if v_new_balance <= 0 then
    v_new_status := 'paid';
  elsif v_invoice.due_date is not null and v_invoice.due_date < v_today then
    v_new_status := 'overdue';
  elsif v_new_paid > 0 then
    v_new_status := 'partial';
  else
    v_new_status := 'unpaid';
  end if;

  v_receipt_no := 'RCP-' || to_char(v_payment_date, 'YYYYMMDD')
    || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.fee_payments (
    institution_id, invoice_id, receipt_no, amount, payment_method,
    payment_reference, payment_date, notes, received_by
  ) values (
    v_invoice.institution_id, v_invoice.id, v_receipt_no, p_amount, p_payment_method,
    nullif(btrim(p_payment_reference), ''), v_payment_date,
    nullif(btrim(p_notes), ''), auth.uid()
  )
  returning id into v_payment_id;

  update public.fee_invoices
  set paid_amount = v_new_paid,
      status = v_new_status,
      updated_at = now()
  where id = v_invoice.id;

  return query
  select v_payment_id, v_receipt_no, v_invoice.id, v_new_paid, v_new_balance, v_new_status;
end;
$$;

revoke all on function public.record_fee_payment(uuid,numeric,text,text,date,text) from public;
grant execute on function public.record_fee_payment(uuid,numeric,text,text,date,text) to authenticated;

commit;
