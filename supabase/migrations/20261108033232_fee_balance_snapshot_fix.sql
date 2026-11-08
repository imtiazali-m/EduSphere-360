-- Correct the stored invoice balance expression and resolve student snapshots.
begin;
alter table public.fee_invoices drop column balance;
alter table public.fee_invoices add column balance numeric(12,2)
generated always as (coalesce(amount,0)+coalesce(fine_amount,0)-coalesce(discount_amount,0)-coalesce(paid_amount,0)) stored;
create or replace function public.sync_fee_invoice_compat_columns()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.invoice_no is null or btrim(new.invoice_no)='' then new.invoice_no:=nullif(btrim(new.invoice_number),''); end if;
  if new.invoice_no is null or btrim(new.invoice_no)='' then new.invoice_no:='INV-'||to_char(coalesce(new.created_at,now()),'YYYY')||'-'||upper(substr(replace(coalesce(new.id,gen_random_uuid())::text,'-',''),1,8)); end if;
  new.invoice_number:=new.invoice_no;
  return new;
end $$;
create or replace function public.sync_fee_invoice_student_snapshot()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_institution uuid; v_name text;
begin
  if new.student_id is null then if tg_op='INSERT' then raise exception 'Choose a student before creating a fee invoice.'; end if; return new; end if;
  select institution_id,full_name into v_institution,v_name from public.students where id=new.student_id;
  if v_institution is null or v_institution<>new.institution_id then raise exception 'The invoice student must belong to this institution.'; end if;
  new.student_name:=v_name;
  return new;
end $$;
drop trigger if exists invoice_student_relationship_guard on public.fee_invoices;
create trigger invoice_student_relationship_guard before insert or update on public.fee_invoices for each row execute function public.sync_fee_invoice_student_snapshot();
revoke all on function public.sync_fee_invoice_student_snapshot() from public,anon,authenticated;
commit;
