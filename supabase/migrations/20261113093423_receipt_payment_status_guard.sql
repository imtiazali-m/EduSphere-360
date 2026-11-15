create or replace function public.guard_fee_receipt_payment_eligibility()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare payment_data jsonb; payment_state text;
begin
 select to_jsonb(p) into payment_data
 from public.fee_payments p
 where p.id=new.payment_id and p.institution_id=new.institution_id;
 if payment_data is null then
  raise exception 'Cannot issue a receipt for a missing or cross-institution payment';
 end if;
 payment_state:=lower(coalesce(payment_data->>'payment_status',payment_data->>'status',''));
 if payment_state in ('pending','initiated','processing','awaiting','failed','failure','cancelled','canceled','void','reversed','unpaid') then
  raise exception 'Cannot issue an official receipt for a payment with status %',payment_state;
 end if;
 new.payment_snapshot:=payment_data;
 return new;
end;
$$;

drop trigger if exists fee_receipt_eligibility_guard on public.fee_receipt_ledger;
create trigger fee_receipt_eligibility_guard
before insert on public.fee_receipt_ledger
for each row execute function public.guard_fee_receipt_payment_eligibility();

revoke all on function public.guard_fee_receipt_payment_eligibility() from public,anon,authenticated;
