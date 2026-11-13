do $
begin
 if not exists (
  select 1 from pg_constraint
  where conrelid='public.hostel_fee_charges'::regclass
    and conname='hostel_fee_charges_id_institution_uq'
 ) then
  alter table public.hostel_fee_charges
   add constraint hostel_fee_charges_id_institution_uq unique(id,institution_id);
 end if;
end $;

create table if not exists public.hostel_fee_payments (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id) on delete cascade,
 charge_id uuid not null,
 amount numeric(12,2) not null check(amount>0),
 payment_method text not null default 'cash' check(payment_method=any(array['cash'::text,'bank_transfer'::text,'card'::text,'mobile_wallet'::text,'other'::text])),
 payment_reference text,
 received_at timestamptz not null default now(),
 recorded_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 constraint hostel_fee_payments_charge_fk foreign key(charge_id,institution_id)
  references public.hostel_fee_charges(id,institution_id) on delete restrict
);
create index if not exists hostel_fee_payments_charge_idx
 on public.hostel_fee_payments(institution_id,charge_id,received_at desc);
alter table public.hostel_fee_payments enable row level security;
revoke all on table public.hostel_fee_payments from public,anon,authenticated;
grant select on table public.hostel_fee_payments to authenticated;
drop policy if exists hostel_fee_payments_read on public.hostel_fee_payments;
create policy hostel_fee_payments_read on public.hostel_fee_payments for select to authenticated
using (
 has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text])
 or exists(select 1 from public.hostel_fee_charges c join public.hostel_residents r on r.id=c.resident_id and r.institution_id=c.institution_id join public.students s on s.id=r.student_id and s.institution_id=r.institution_id where c.id=hostel_fee_payments.charge_id and c.institution_id=hostel_fee_payments.institution_id and s.user_id=(select auth.uid()))
 or exists(select 1 from public.hostel_fee_charges c join public.hostel_residents r on r.id=c.resident_id and r.institution_id=c.institution_id join public.student_guardians g on g.student_id=r.student_id and g.institution_id=r.institution_id where c.id=hostel_fee_payments.charge_id and c.institution_id=hostel_fee_payments.institution_id and g.parent_user_id=(select auth.uid()))
);
create or replace function public.record_hostel_fee_payment(
 p_institution_id uuid,p_charge_id uuid,p_amount numeric,p_payment_method text,p_payment_reference text default null
)
returns public.hostel_fee_payments
language plpgsql
security definer
set search_path=public
as $$
declare charge_row public.hostel_fee_charges; payment_row public.hostel_fee_payments; new_paid numeric(12,2); new_status text;
begin
 if auth.uid() is null or not has_institution_role(p_institution_id,array['owner'::text,'admin'::text,'accountant'::text]) then
  raise exception 'Owner, administrator or accountant access is required to record hostel fee payments';
 end if;
 if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;
 if p_payment_method not in ('cash','bank_transfer','card','mobile_wallet','other') then raise exception 'Unsupported payment method'; end if;
 select * into charge_row from public.hostel_fee_charges where id=p_charge_id and institution_id=p_institution_id for update;
 if not found or charge_row.status='waived' then raise exception 'The hostel fee charge is missing or waived'; end if;
 new_paid:=charge_row.paid_amount+p_amount;
 if new_paid>charge_row.amount then raise exception 'Payment exceeds the remaining hostel fee balance'; end if;
 new_status:=case when new_paid=charge_row.amount then 'paid' when new_paid>0 then 'part_paid' else 'pending' end;
 insert into public.hostel_fee_payments(institution_id,charge_id,amount,payment_method,payment_reference,recorded_by)
 values(p_institution_id,p_charge_id,p_amount,p_payment_method,nullif(trim(p_payment_reference),''),auth.uid())
 returning * into payment_row;
 update public.hostel_fee_charges set paid_amount=new_paid,status=new_status,updated_at=now()
 where id=p_charge_id and institution_id=p_institution_id;
 return payment_row;
end;
$$;
revoke all on function public.record_hostel_fee_payment(uuid,uuid,numeric,text,text) from public;
grant execute on function public.record_hostel_fee_payment(uuid,uuid,numeric,text,text) to authenticated;
