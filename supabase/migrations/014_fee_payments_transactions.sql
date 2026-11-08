-- EduSphere 360 - Fees & Payments upgrade
-- Safe to run more than once. Keeps existing fee_invoices rows and paid_amount values.
begin;

-- Extend the existing invoice table; do not replace or recreate it.
alter table public.fee_invoices
  add column if not exists invoice_no text,
  add column if not exists fee_category text,
  add column if not exists academic_session text,
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists notes text;

-- Stop safely rather than silently changing or deleting historical payment values.
do $$
begin
  if exists (
    select 1
    from public.fee_invoices
    where discount_amount < 0
       or discount_amount > amount
       or paid_amount < 0
       or paid_amount > amount - discount_amount
  ) then
    raise exception 'Fee migration preflight failed: one or more invoices have a discount or paid amount outside the post-discount invoice total. Review fee_invoices before rerunning migration 014.';
  end if;
end $$;

-- Backfill human-readable invoice numbers for existing records.
update public.fee_invoices
set invoice_no = 'INV-' || to_char(created_at, 'YYYY') || '-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where invoice_no is null or btrim(invoice_no) = '';

create unique index if not exists fee_invoices_institution_invoice_no_uidx
  on public.fee_invoices(institution_id, invoice_no);

-- Validate discounts against the invoice amount.
alter table public.fee_invoices
  drop constraint if exists fee_invoices_discount_amount_check;
alter table public.fee_invoices
  add constraint fee_invoices_discount_amount_check
  check (discount_amount >= 0 and discount_amount <= amount);

-- Existing balance was amount - paid_amount. Rebuild it so discounts reduce the amount due.
alter table public.fee_invoices drop column if exists balance;
alter table public.fee_invoices
  add column balance numeric(12,2)
  generated always as (amount - discount_amount - paid_amount) stored;

alter table public.fee_invoices
  drop constraint if exists fee_invoices_paid_amount_check;
alter table public.fee_invoices
  add constraint fee_invoices_paid_amount_check
  check (paid_amount >= 0 and paid_amount <= amount - discount_amount);

-- Individual transactions are immutable from the browser; payments are recorded through an RPC.
create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  invoice_id uuid not null references public.fee_invoices(id) on delete restrict,
  receipt_no text not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash','bank_transfer','card','online','cheque','other')),
  payment_reference text,
  payment_date date not null default current_date,
  notes text,
  received_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (institution_id, receipt_no)
);

create index if not exists fee_payments_invoice_date_idx
  on public.fee_payments(invoice_id, payment_date desc);
create index if not exists fee_payments_institution_date_idx
  on public.fee_payments(institution_id, payment_date desc);

alter table public.fee_payments enable row level security;
revoke all on public.fee_payments from anon;
grant select on public.fee_payments to authenticated;
revoke insert, update, delete on public.fee_payments from authenticated;

drop policy if exists "authorized users can view fee payments" on public.fee_payments;
create policy "authorized users can view fee payments"
on public.fee_payments for select to authenticated
using (
  public.has_institution_role(institution_id, array['owner','admin','accountant'])
  or exists (
    select 1
    from public.fee_invoices i
    where i.id = invoice_id
      and i.institution_id = fee_payments.institution_id
      and i.student_id is not null
      and public.can_view_student(i.student_id)
  )
);

-- One atomic operation: lock invoice, reject overpayment, insert receipt, update invoice balance/status.
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
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to record a payment.';
  end if;

  if p_amount is null or p_amount <= 0 or round(p_amount, 2) <> p_amount then
    raise exception 'Enter a payment amount greater than zero with no more than two decimal places.';
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
  elsif v_invoice.due_date is not null and v_invoice.due_date < coalesce(p_payment_date, current_date) then
    v_new_status := 'overdue';
  elsif v_new_paid > 0 then
    v_new_status := 'partial';
  else
    v_new_status := 'unpaid';
  end if;

  v_receipt_no := 'RCP-' || to_char(coalesce(p_payment_date, current_date), 'YYYYMMDD')
    || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.fee_payments (
    institution_id, invoice_id, receipt_no, amount, payment_method,
    payment_reference, payment_date, notes, received_by
  ) values (
    v_invoice.institution_id, v_invoice.id, v_receipt_no, p_amount, p_payment_method,
    nullif(btrim(p_payment_reference), ''), coalesce(p_payment_date, current_date),
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
