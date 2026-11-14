alter table public.student_transport_allocations
  add constraint student_transport_allocations_id_institution_uq unique(id,institution_id);

create table if not exists public.student_transport_fee_charges (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id) on delete cascade,
 allocation_id uuid not null,
 billing_period text not null check(billing_period ~ '^[0-9]{4}-[0-9]{2}$'),
 amount numeric(12,2) not null check(amount>0),
 paid_amount numeric(12,2) not null default 0 check(paid_amount>=0 and paid_amount<=amount),
 due_date date not null,
 status text not null default 'pending' check(status=any(array['pending'::text,'part_paid'::text,'paid'::text,'waived'::text])),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint student_transport_fee_charge_allocation_fk foreign key(allocation_id,institution_id)
  references public.student_transport_allocations(id,institution_id) on delete restrict,
 constraint student_transport_fee_charge_period_uq unique(institution_id,allocation_id,billing_period)
);
create index if not exists student_transport_fee_charges_due_idx
 on public.student_transport_fee_charges(institution_id,due_date,status);

alter table public.student_transport_fee_charges add constraint student_transport_fee_charges_id_institution_uq unique(id,institution_id);

create table if not exists public.student_transport_fee_payments (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id) on delete cascade,
 charge_id uuid not null,
 amount numeric(12,2) not null check(amount>0),
 payment_method text not null default 'cash' check(payment_method=any(array['cash'::text,'bank_transfer'::text,'card'::text,'mobile_wallet'::text,'other'::text])),
 payment_reference text,
 received_at timestamptz not null default now(),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 constraint student_transport_fee_payment_charge_fk foreign key(charge_id,institution_id)
  references public.student_transport_fee_charges(id,institution_id) on delete restrict
);
create index if not exists student_transport_fee_payments_charge_idx
 on public.student_transport_fee_payments(institution_id,charge_id,received_at desc);

alter table public.student_transport_fee_charges enable row level security;
alter table public.student_transport_fee_payments enable row level security;
revoke all on table public.student_transport_fee_charges from public,anon,authenticated;
revoke all on table public.student_transport_fee_payments from public,anon,authenticated;
grant select on table public.student_transport_fee_charges to authenticated;
grant select on table public.student_transport_fee_payments to authenticated;

drop policy if exists transport_fee_charges_read on public.student_transport_fee_charges;
create policy transport_fee_charges_read on public.student_transport_fee_charges for select to authenticated
using (
 has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text])
 or exists(select 1 from public.student_transport_allocations a join public.students s on s.id=a.student_id and s.institution_id=a.institution_id where a.id=student_transport_fee_charges.allocation_id and a.institution_id=student_transport_fee_charges.institution_id and s.user_id=(select auth.uid()))
 or exists(select 1 from public.student_transport_allocations a join public.student_guardians g on g.student_id=a.student_id and g.institution_id=a.institution_id where a.id=student_transport_fee_charges.allocation_id and a.institution_id=student_transport_fee_charges.institution_id and g.parent_user_id=(select auth.uid()))
);
drop policy if exists transport_fee_payments_read on public.student_transport_fee_payments;
create policy transport_fee_payments_read on public.student_transport_fee_payments for select to authenticated
using (
 has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text])
 or exists(select 1 from public.student_transport_fee_charges c join public.student_transport_allocations a on a.id=c.allocation_id and a.institution_id=c.institution_id join public.students s on s.id=a.student_id and s.institution_id=a.institution_id where c.id=student_transport_fee_payments.charge_id and c.institution_id=student_transport_fee_payments.institution_id and s.user_id=(select auth.uid()))
 or exists(select 1 from public.student_transport_fee_charges c join public.student_transport_allocations a on a.id=c.allocation_id and a.institution_id=c.institution_id join public.student_guardians g on g.student_id=a.student_id and g.institution_id=a.institution_id where c.id=student_transport_fee_payments.charge_id and c.institution_id=student_transport_fee_payments.institution_id and g.parent_user_id=(select auth.uid()))
);

create or replace function public.create_student_transport_fee_charge(
 p_institution_id uuid,p_allocation_id uuid,p_billing_period text,p_due_date date
)
returns public.student_transport_fee_charges
language plpgsql
security definer
set search_path=public
as $$
declare allocation_row public.student_transport_allocations; charge_row public.student_transport_fee_charges;
begin
 if auth.uid() is null or not has_institution_role(p_institution_id,array['owner'::text,'admin'::text,'accountant'::text]) then
  raise exception 'Owner, administrator or accountant access is required';
 end if;
 if p_billing_period !~ '^[0-9]{4}-[0-9]{2}$' then raise exception 'Billing period must use YYYY-MM format'; end if;
 if p_due_date is null then raise exception 'A due date is required'; end if;
 select * into allocation_row from public.student_transport_allocations
 where id=p_allocation_id and institution_id=p_institution_id for update;
 if not found or allocation_row.status<>'active' then raise exception 'Only active transport allocations can be charged'; end if;
 if allocation_row.transport_fee<=0 then raise exception 'This allocation has no transport fee to invoice'; end if;
 insert into public.student_transport_fee_charges(institution_id,allocation_id,billing_period,amount,due_date,created_by)
 values(p_institution_id,p_allocation_id,p_billing_period,allocation_row.transport_fee,p_due_date,auth.uid())
 on conflict(institution_id,allocation_id,billing_period) do update
 set due_date=excluded.due_date,updated_at=now()
 returning * into charge_row;
 return charge_row;
end;
$$;
revoke all on function public.create_student_transport_fee_charge(uuid,uuid,text,date) from public,anon;
grant execute on function public.create_student_transport_fee_charge(uuid,uuid,text,date) to authenticated,service_role;

create or replace function public.record_student_transport_fee_payment(
 p_institution_id uuid,p_charge_id uuid,p_amount numeric,p_payment_method text,p_payment_reference text default null
)
returns public.student_transport_fee_payments
language plpgsql
security definer
set search_path=public
as $$
declare charge_row public.student_transport_fee_charges; payment_row public.student_transport_fee_payments; new_paid numeric(12,2);
begin
 if auth.uid() is null or not has_institution_role(p_institution_id,array['owner'::text,'admin'::text,'accountant'::text]) then
  raise exception 'Owner, administrator or accountant access is required';
 end if;
 if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;
 if p_payment_method not in ('cash','bank_transfer','card','mobile_wallet','other') then raise exception 'Unsupported payment method'; end if;
 select * into charge_row from public.student_transport_fee_charges
 where id=p_charge_id and institution_id=p_institution_id for update;
 if not found or charge_row.status='waived' then raise exception 'The transport fee charge is missing or waived'; end if;
 new_paid:=charge_row.paid_amount+p_amount;
 if new_paid>charge_row.amount then raise exception 'Payment exceeds the outstanding transport fee balance'; end if;
 insert into public.student_transport_fee_payments(institution_id,charge_id,amount,payment_method,payment_reference,recorded_by)
 values(p_institution_id,p_charge_id,p_amount,p_payment_method,nullif(trim(p_payment_reference),''),auth.uid())
 returning * into payment_row;
 update public.student_transport_fee_charges set paid_amount=new_paid,
  status=case when new_paid=amount then 'paid' else 'part_paid' end,updated_at=now()
 where id=p_charge_id and institution_id=p_institution_id;
 return payment_row;
end;
$$;
revoke all on function public.record_student_transport_fee_payment(uuid,uuid,numeric,text,text) from public,anon;
grant execute on function public.record_student_transport_fee_payment(uuid,uuid,numeric,text,text) to authenticated,service_role;
