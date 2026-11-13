create or replace function public.submit_procurement_request(
 p_institution_id uuid,p_request_id uuid
)
returns public.procurement_requests
language plpgsql
set search_path=public
as $$
declare request_row public.procurement_requests;
begin
 if not has_institution_role(p_institution_id,array['owner'::text,'admin'::text,'teacher'::text,'accountant'::text]) then
  raise exception 'An active institution member with a procurement role is required';
 end if;
 select * into request_row from public.procurement_requests
 where id=p_request_id and institution_id=p_institution_id for update;
 if not found then raise exception 'Procurement request not found'; end if;
 if request_row.requested_by<>auth.uid() and not has_institution_role(p_institution_id,array['owner'::text,'admin'::text]) then
  raise exception 'You can submit only your own procurement request';
 end if;
 if request_row.status<>'draft' then raise exception 'Only draft requests can be submitted'; end if;
 if not exists(select 1 from public.procurement_request_items where request_id=p_request_id and institution_id=p_institution_id) then
  raise exception 'Add at least one line item before submitting the request';
 end if;
 update public.procurement_requests set status='submitted',updated_at=now()
 where id=p_request_id and institution_id=p_institution_id returning * into request_row;
 return request_row;
end;
$$;
revoke all on function public.submit_procurement_request(uuid,uuid) from public;
grant execute on function public.submit_procurement_request(uuid,uuid) to authenticated;

create or replace function public.select_supplier_quote(
 p_institution_id uuid,p_quote_id uuid
)
returns public.supplier_quotes
language plpgsql
set search_path=public
as $$
declare quote_row public.supplier_quotes;
begin
 if not has_institution_role(p_institution_id,array['owner'::text,'admin'::text,'accountant'::text]) then
  raise exception 'Owner, administrator or accountant access is required to select a quote';
 end if;
 select * into quote_row from public.supplier_quotes
 where id=p_quote_id and institution_id=p_institution_id for update;
 if not found then raise exception 'Supplier quote not found'; end if;
 if not exists(select 1 from public.procurement_requests r where r.id=quote_row.request_id and r.institution_id=p_institution_id and r.status='approved') then
  raise exception 'The linked procurement request must be approved before a quote is selected';
 end if;
 update public.supplier_quotes set status='rejected',updated_at=now()
 where institution_id=p_institution_id and request_id=quote_row.request_id and id<>quote_row.id and status in ('received','shortlisted','selected');
 update public.supplier_quotes set status='selected',updated_at=now()
 where id=quote_row.id and institution_id=p_institution_id returning * into quote_row;
 return quote_row;
end;
$$;
revoke all on function public.select_supplier_quote(uuid,uuid) from public;
grant execute on function public.select_supplier_quote(uuid,uuid) to authenticated;
