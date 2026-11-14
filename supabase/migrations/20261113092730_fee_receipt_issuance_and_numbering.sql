create table if not exists public.fee_receipt_sequences (
  institution_id uuid primary key references public.institutions(id) on delete cascade,
  prefix text not null default 'RCPT',
  next_number bigint not null default 1 check(next_number>0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.fee_receipt_ledger (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  payment_id uuid not null,
  receipt_number text not null,
  template_key text not null default 'default',
  payment_snapshot jsonb not null,
  issued_by uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint fee_receipt_ledger_payment_uq unique(institution_id,payment_id),
  constraint fee_receipt_ledger_number_uq unique(institution_id,receipt_number)
);

alter table public.fee_receipt_sequences enable row level security;
alter table public.fee_receipt_ledger enable row level security;
revoke all on table public.fee_receipt_sequences from public,anon,authenticated;
revoke all on table public.fee_receipt_ledger from public,anon,authenticated;
grant select on table public.fee_receipt_sequences to authenticated;
grant select on table public.fee_receipt_ledger to authenticated;

drop policy if exists fee_receipt_sequences_read on public.fee_receipt_sequences;
create policy fee_receipt_sequences_read on public.fee_receipt_sequences for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));
drop policy if exists fee_receipt_ledger_read on public.fee_receipt_ledger;
create policy fee_receipt_ledger_read on public.fee_receipt_ledger for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));

create or replace function public.set_fee_receipt_sequence(
 p_institution_id uuid,p_prefix text,p_next_number bigint
)
returns public.fee_receipt_sequences
language plpgsql
set search_path=public
as $$
declare row_value public.fee_receipt_sequences;
begin
 if not has_institution_role(p_institution_id,array['owner'::text,'admin'::text]) then
  raise exception 'Only an owner or administrator can change receipt numbering';
 end if;
 if length(trim(p_prefix)) not between 1 and 12 or p_next_number<1 then
  raise exception 'Receipt prefix or starting number is invalid';
 end if;
 insert into public.fee_receipt_sequences(institution_id,prefix,next_number,updated_by,updated_at)
 values(p_institution_id,upper(trim(p_prefix)),p_next_number,auth.uid(),now())
 on conflict(institution_id) do update set prefix=excluded.prefix,next_number=excluded.next_number,updated_by=auth.uid(),updated_at=now()
 returning * into row_value;
 return row_value;
end;
$$;
revoke all on function public.set_fee_receipt_sequence(uuid,text,bigint) from public;
grant execute on function public.set_fee_receipt_sequence(uuid,text,bigint) to authenticated;

create or replace function public.issue_fee_receipt(
 p_institution_id uuid,p_payment_id uuid,p_template_key text default 'default'
)
returns public.fee_receipt_ledger
language plpgsql
set search_path=public
as $$
declare payment_data jsonb; existing_row public.fee_receipt_ledger; number_row public.fee_receipt_sequences; issued_row public.fee_receipt_ledger; serial bigint; receipt_prefix text;
begin
 if not has_institution_role(p_institution_id,array['owner'::text,'admin'::text,'accountant'::text]) then
  raise exception 'Owner, administrator or accountant access is required to issue receipts';
 end if;
 select * into existing_row from public.fee_receipt_ledger
 where institution_id=p_institution_id and payment_id=p_payment_id;
 if found then return existing_row; end if;

 select to_jsonb(p) into payment_data
 from public.fee_payments p
 where p.id=p_payment_id and p.institution_id=p_institution_id;
 if payment_data is null then raise exception 'The selected fee payment does not exist in this institution'; end if;

 insert into public.fee_receipt_sequences(institution_id,prefix,next_number,updated_by)
 values(p_institution_id,'RCPT',2,auth.uid())
 on conflict(institution_id) do update
 set next_number=fee_receipt_sequences.next_number+1,updated_at=now(),updated_by=auth.uid()
 returning * into number_row;
 serial:=number_row.next_number-1;
 receipt_prefix:=number_row.prefix;

 insert into public.fee_receipt_ledger(institution_id,payment_id,receipt_number,template_key,payment_snapshot,issued_by)
 values(p_institution_id,p_payment_id,receipt_prefix||'-'||lpad(serial::text,6,'0'),coalesce(nullif(trim(p_template_key),''),'default'),payment_data,auth.uid())
 on conflict(institution_id,payment_id) do nothing
 returning * into issued_row;

 if issued_row.id is null then
  select * into issued_row from public.fee_receipt_ledger where institution_id=p_institution_id and payment_id=p_payment_id;
 end if;
 return issued_row;
end;
$$;
revoke all on function public.issue_fee_receipt(uuid,uuid,text) from public;
grant execute on function public.issue_fee_receipt(uuid,uuid,text) to authenticated;

create or replace function public.issue_fee_receipts_bulk(
 p_institution_id uuid,p_payment_ids uuid[],p_template_key text default 'default'
)
returns setof public.fee_receipt_ledger
language plpgsql
set search_path=public
as $$
declare payment_id_value uuid; receipt_row public.fee_receipt_ledger;
begin
 if array_length(p_payment_ids,1) is null or array_length(p_payment_ids,1)>500 then
  raise exception 'Select between 1 and 500 payment records';
 end if;
 foreach payment_id_value in array p_payment_ids loop
  select * into receipt_row from public.issue_fee_receipt(p_institution_id,payment_id_value,p_template_key);
  return next receipt_row;
 end loop;
 return;
end;
$$;
revoke all on function public.issue_fee_receipts_bulk(uuid,uuid[],text) from public;
grant execute on function public.issue_fee_receipts_bulk(uuid,uuid[],text) to authenticated;
