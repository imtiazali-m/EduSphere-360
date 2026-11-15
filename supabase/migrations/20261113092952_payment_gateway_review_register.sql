create table if not exists public.payment_gateway_reviews (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  payment_id uuid not null references public.fee_payments(id) on delete cascade,
  provider_name text not null check(length(trim(provider_name)) between 1 and 120),
  transaction_reference text,
  provider_status text not null check(provider_status=any(array['awaiting_provider'::text,'verified_success'::text,'verified_failed'::text,'reference_mismatch'::text])),
  evidence_note text not null check(length(trim(evidence_note)) between 3 and 4000),
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_gateway_reviews_payment_uq unique(institution_id,payment_id)
);

create index if not exists payment_gateway_reviews_status_idx
 on public.payment_gateway_reviews(institution_id,provider_status,reviewed_at desc);

alter table public.payment_gateway_reviews enable row level security;
revoke all on table public.payment_gateway_reviews from public,anon,authenticated;
grant select on table public.payment_gateway_reviews to authenticated;

drop policy if exists payment_gateway_reviews_read on public.payment_gateway_reviews;
create policy payment_gateway_reviews_read on public.payment_gateway_reviews for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));

create or replace function public.record_payment_gateway_review(
 p_institution_id uuid,
 p_payment_id uuid,
 p_provider_name text,
 p_transaction_reference text,
 p_provider_status text,
 p_evidence_note text
)
returns public.payment_gateway_reviews
language plpgsql
security definer
set search_path=public
as $$
declare review_row public.payment_gateway_reviews;
begin
 if auth.uid() is null or not has_institution_role(p_institution_id,array['owner'::text,'admin'::text,'accountant'::text]) then
  raise exception 'Owner, administrator or accountant access is required';
 end if;
 if p_provider_status not in ('awaiting_provider','verified_success','verified_failed','reference_mismatch') then
  raise exception 'Invalid provider review status';
 end if;
 if length(trim(coalesce(p_evidence_note,'')))<3 then raise exception 'Add a meaningful verification note'; end if;
 if p_provider_status in ('verified_success','verified_failed') and length(trim(coalesce(p_transaction_reference,'')))<3 then
  raise exception 'A provider transaction reference is required for a verified result';
 end if;
 if not exists(select 1 from public.fee_payments p where p.id=p_payment_id and p.institution_id=p_institution_id) then
  raise exception 'The fee payment does not belong to this institution';
 end if;
 insert into public.payment_gateway_reviews(institution_id,payment_id,provider_name,transaction_reference,provider_status,evidence_note,reviewed_by,reviewed_at,updated_at)
 values(p_institution_id,p_payment_id,trim(p_provider_name),nullif(trim(p_transaction_reference),''),p_provider_status,trim(p_evidence_note),auth.uid(),now(),now())
 on conflict(institution_id,payment_id) do update set
 provider_name=excluded.provider_name,transaction_reference=excluded.transaction_reference,
 provider_status=excluded.provider_status,evidence_note=excluded.evidence_note,
 reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
 returning * into review_row;
 return review_row;
end;
$$;
revoke all on function public.record_payment_gateway_review(uuid,uuid,text,text,text,text) from public;
grant execute on function public.record_payment_gateway_review(uuid,uuid,text,text,text,text) to authenticated;
