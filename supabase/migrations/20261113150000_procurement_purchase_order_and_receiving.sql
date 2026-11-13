create table if not exists public.supplier_directory (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  supplier_code text not null,
  name text not null check(length(trim(name)) between 1 and 180),
  contact_name text,
  email text,
  phone text,
  address text,
  tax_reference text,
  payment_terms text,
  status text not null default 'active' check(status=any(array['active'::text,'inactive'::text,'blocked'::text])),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_directory_id_institution_uq unique(id,institution_id),
  constraint supplier_directory_code_uq unique(institution_id,supplier_code)
);

create table if not exists public.procurement_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  request_number text not null,
  title text not null check(length(trim(title)) between 1 and 180),
  department text,
  justification text,
  needed_by date,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'draft' check(status=any(array['draft'::text,'submitted'::text,'approved'::text,'rejected'::text,'ordered'::text,'closed'::text,'cancelled'::text])),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint procurement_requests_id_institution_uq unique(id,institution_id),
  constraint procurement_requests_number_uq unique(institution_id,request_number)
);

create table if not exists public.procurement_request_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  request_id uuid not null,
  inventory_item_id uuid,
  item_description text not null check(length(trim(item_description)) between 1 and 500),
  quantity numeric(12,3) not null check(quantity>0),
  unit text not null default 'unit',
  estimated_unit_cost numeric(12,2) check(estimated_unit_cost is null or estimated_unit_cost>=0),
  notes text,
  created_at timestamptz not null default now(),
  constraint procurement_request_items_request_fk foreign key(request_id,institution_id)
    references public.procurement_requests(id,institution_id) on delete cascade,
  constraint procurement_request_items_inventory_fk foreign key(inventory_item_id,institution_id)
    references public.institutional_records(id,institution_id) on delete restrict
);

create table if not exists public.supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  request_id uuid not null,
  supplier_id uuid not null,
  quote_number text not null,
  quote_date date not null default current_date,
  valid_until date,
  total_amount numeric(14,2) not null check(total_amount>=0),
  currency text not null default 'PKR',
  terms text,
  status text not null default 'received' check(status=any(array['received'::text,'shortlisted'::text,'selected'::text,'rejected'::text])),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_quotes_request_fk foreign key(request_id,institution_id)
    references public.procurement_requests(id,institution_id) on delete cascade,
  constraint supplier_quotes_supplier_fk foreign key(supplier_id,institution_id)
    references public.supplier_directory(id,institution_id) on delete restrict,
  constraint supplier_quotes_quote_uq unique(institution_id,supplier_id,quote_number),
  constraint supplier_quotes_validity_check check(valid_until is null or valid_until>=quote_date)
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  order_number text not null,
  request_id uuid,
  supplier_id uuid not null,
  order_date date not null default current_date,
  expected_delivery_date date,
  status text not null default 'draft' check(status=any(array['draft'::text,'approved'::text,'sent'::text,'partially_received'::text,'received'::text,'cancelled'::text])),
  currency text not null default 'PKR',
  subtotal numeric(14,2) not null default 0 check(subtotal>=0),
  tax_amount numeric(14,2) not null default 0 check(tax_amount>=0),
  total_amount numeric(14,2) not null default 0 check(total_amount>=0),
  terms text,
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_orders_id_institution_uq unique(id,institution_id),
  constraint purchase_orders_number_uq unique(institution_id,order_number),
  constraint purchase_orders_request_fk foreign key(request_id,institution_id)
    references public.procurement_requests(id,institution_id) on delete restrict,
  constraint purchase_orders_supplier_fk foreign key(supplier_id,institution_id)
    references public.supplier_directory(id,institution_id) on delete restrict,
  constraint purchase_orders_delivery_date check(expected_delivery_date is null or expected_delivery_date>=order_date)
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  purchase_order_id uuid not null,
  request_item_id uuid,
  inventory_item_id uuid not null,
  item_description text not null,
  quantity numeric(12,3) not null check(quantity>0),
  received_quantity numeric(12,3) not null default 0 check(received_quantity>=0 and received_quantity<=quantity),
  unit text not null default 'unit',
  unit_cost numeric(14,2) not null check(unit_cost>=0),
  line_total numeric(14,2) generated always as (round(quantity*unit_cost,2)) stored,
  created_at timestamptz not null default now(),
  constraint purchase_order_items_order_fk foreign key(purchase_order_id,institution_id)
    references public.purchase_orders(id,institution_id) on delete cascade,
  constraint purchase_order_items_request_item_fk foreign key(request_item_id,institution_id)
    references public.procurement_request_items(id,institution_id) on delete restrict,
  constraint purchase_order_items_inventory_fk foreign key(inventory_item_id,institution_id)
    references public.institutional_records(id,institution_id) on delete restrict
);

create table if not exists public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  receipt_number text not null,
  purchase_order_id uuid not null,
  received_at timestamptz not null default now(),
  status text not null default 'draft' check(status=any(array['draft'::text,'posted'::text,'rejected'::text])),
  received_by uuid not null references auth.users(id) on delete restrict,
  posted_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint goods_receipts_id_institution_uq unique(id,institution_id),
  constraint goods_receipts_number_uq unique(institution_id,receipt_number),
  constraint goods_receipts_order_fk foreign key(purchase_order_id,institution_id)
    references public.purchase_orders(id,institution_id) on delete restrict
);

create table if not exists public.goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  receipt_id uuid not null,
  purchase_order_item_id uuid not null,
  received_quantity numeric(12,3) not null check(received_quantity>0),
  condition_notes text,
  created_at timestamptz not null default now(),
  constraint goods_receipt_items_receipt_fk foreign key(receipt_id,institution_id)
    references public.goods_receipts(id,institution_id) on delete cascade,
  constraint goods_receipt_items_po_item_fk foreign key(purchase_order_item_id,institution_id)
    references public.purchase_order_items(id,institution_id) on delete restrict,
  constraint goods_receipt_items_item_uq unique(receipt_id,purchase_order_item_id)
);

create table if not exists public.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  supplier_id uuid not null,
  purchase_order_id uuid,
  invoice_number text not null,
  invoice_date date not null,
  due_date date not null,
  amount numeric(14,2) not null check(amount>=0),
  status text not null default 'received' check(status=any(array['received'::text,'under_review'::text,'approved'::text,'partially_paid'::text,'paid'::text,'rejected'::text])),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_invoices_supplier_fk foreign key(supplier_id,institution_id)
    references public.supplier_directory(id,institution_id) on delete restrict,
  constraint supplier_invoices_order_fk foreign key(purchase_order_id,institution_id)
    references public.purchase_orders(id,institution_id) on delete restrict,
  constraint supplier_invoices_number_uq unique(institution_id,supplier_id,invoice_number),
  constraint supplier_invoices_dates_check check(due_date>=invoice_date)
);

create index if not exists procurement_requests_status_idx on public.procurement_requests(institution_id,status,created_at desc);
create index if not exists procurement_quotes_request_idx on public.supplier_quotes(institution_id,request_id,status,total_amount);
create index if not exists purchase_orders_status_idx on public.purchase_orders(institution_id,status,order_date desc);
create index if not exists goods_receipts_order_idx on public.goods_receipts(institution_id,purchase_order_id,received_at desc);
create index if not exists supplier_invoices_due_idx on public.supplier_invoices(institution_id,due_date,status);

do $$
declare t text;
begin
 foreach t in array array['supplier_directory','procurement_requests','procurement_request_items','supplier_quotes','purchase_orders','purchase_order_items','goods_receipts','goods_receipt_items','supplier_invoices'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on table public.%I to authenticated',t);
 end loop;
end $$;

drop policy if exists suppliers_select on public.supplier_directory;
create policy suppliers_select on public.supplier_directory for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));
drop policy if exists suppliers_manage on public.supplier_directory;
create policy suppliers_manage on public.supplier_directory for all to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check(has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists procurement_requests_select on public.procurement_requests;
create policy procurement_requests_select on public.procurement_requests for select to authenticated
using(requested_by=(select auth.uid()) or has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));
drop policy if exists procurement_requests_insert on public.procurement_requests;
create policy procurement_requests_insert on public.procurement_requests for insert to authenticated
with check(requested_by=(select auth.uid()) and has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text,'accountant'::text]));
drop policy if exists procurement_requests_update on public.procurement_requests;
create policy procurement_requests_update on public.procurement_requests for update to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check(has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists procurement_request_items_select on public.procurement_request_items;
create policy procurement_request_items_select on public.procurement_request_items for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]) or exists(
 select 1 from public.procurement_requests r where r.id=request_id and r.institution_id=procurement_request_items.institution_id and r.requested_by=(select auth.uid())
));
drop policy if exists procurement_request_items_manage on public.procurement_request_items;
create policy procurement_request_items_manage on public.procurement_request_items for all to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text]) or exists(
 select 1 from public.procurement_requests r where r.id=request_id and r.institution_id=procurement_request_items.institution_id and r.requested_by=(select auth.uid()) and r.status in ('draft','submitted')
))
with check(has_institution_role(institution_id,array['owner'::text,'admin'::text]) or exists(
 select 1 from public.procurement_requests r where r.id=request_id and r.institution_id=procurement_request_items.institution_id and r.requested_by=(select auth.uid()) and r.status in ('draft','submitted')
));

drop policy if exists supplier_quotes_select on public.supplier_quotes;
create policy supplier_quotes_select on public.supplier_quotes for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));
drop policy if exists supplier_quotes_manage on public.supplier_quotes;
create policy supplier_quotes_manage on public.supplier_quotes for all to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]))
with check(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));

drop policy if exists purchase_orders_select on public.purchase_orders;
create policy purchase_orders_select on public.purchase_orders for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));
drop policy if exists purchase_orders_manage on public.purchase_orders;
create policy purchase_orders_manage on public.purchase_orders for all to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check(has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists purchase_order_items_select on public.purchase_order_items;
create policy purchase_order_items_select on public.purchase_order_items for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));
drop policy if exists purchase_order_items_manage on public.purchase_order_items;
create policy purchase_order_items_manage on public.purchase_order_items for all to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check(has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists goods_receipts_select on public.goods_receipts;
create policy goods_receipts_select on public.goods_receipts for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));
drop policy if exists goods_receipts_manage on public.goods_receipts;
create policy goods_receipts_manage on public.goods_receipts for all to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check(has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists goods_receipt_items_select on public.goods_receipt_items;
create policy goods_receipt_items_select on public.goods_receipt_items for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));
drop policy if exists goods_receipt_items_manage on public.goods_receipt_items;
create policy goods_receipt_items_manage on public.goods_receipt_items for all to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check(has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists supplier_invoices_select on public.supplier_invoices;
create policy supplier_invoices_select on public.supplier_invoices for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));
drop policy if exists supplier_invoices_manage on public.supplier_invoices;
create policy supplier_invoices_manage on public.supplier_invoices for all to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]))
with check(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));

create or replace function public.review_procurement_request(
 p_institution_id uuid,p_request_id uuid,p_decision text,p_notes text default null
)
returns public.procurement_requests
language plpgsql
set search_path=public
as $$
declare request_row public.procurement_requests;
begin
 if not has_institution_role(p_institution_id,array['owner'::text,'admin'::text]) then raise exception 'Only an owner or administrator can review procurement requests'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Invalid procurement decision'; end if;
 select * into request_row from public.procurement_requests where id=p_request_id and institution_id=p_institution_id for update;
 if not found or request_row.status<>'submitted' then raise exception 'Only submitted procurement requests can be reviewed'; end if;
 update public.procurement_requests set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=p_notes,updated_at=now()
 where id=p_request_id and institution_id=p_institution_id returning * into request_row;
 return request_row;
end;
$$;
revoke all on function public.review_procurement_request(uuid,uuid,text,text) from public;
grant execute on function public.review_procurement_request(uuid,uuid,text,text) to authenticated;

create or replace function public.approve_purchase_order(
 p_institution_id uuid,p_purchase_order_id uuid
)
returns public.purchase_orders
language plpgsql
set search_path=public
as $$
declare order_row public.purchase_orders; subtotal_value numeric(14,2);
begin
 if not has_institution_role(p_institution_id,array['owner'::text,'admin'::text]) then raise exception 'Only an owner or administrator can approve purchase orders'; end if;
 select * into order_row from public.purchase_orders where id=p_purchase_order_id and institution_id=p_institution_id for update;
 if not found or order_row.status<>'draft' then raise exception 'Only draft purchase orders can be approved'; end if;
 if order_row.request_id is not null and not exists(select 1 from public.procurement_requests r where r.id=order_row.request_id and r.institution_id=p_institution_id and r.status='approved') then raise exception 'The linked procurement request must be approved first'; end if;
 if not exists(select 1 from public.purchase_order_items i where i.purchase_order_id=order_row.id and i.institution_id=p_institution_id) then raise exception 'Add at least one purchase order line before approval'; end if;
 select coalesce(sum(line_total),0) into subtotal_value from public.purchase_order_items where purchase_order_id=order_row.id and institution_id=p_institution_id;
 update public.purchase_orders set subtotal=subtotal_value,total_amount=subtotal_value+tax_amount,status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now()
 where id=order_row.id and institution_id=p_institution_id returning * into order_row;
 return order_row;
end;
$$;
revoke all on function public.approve_purchase_order(uuid,uuid) from public;
grant execute on function public.approve_purchase_order(uuid,uuid) to authenticated;

create or replace function public.post_goods_receipt(
 p_institution_id uuid,p_receipt_id uuid
)
returns public.goods_receipts
language plpgsql
set search_path=public
as $$
declare receipt_row public.goods_receipts; order_row public.purchase_orders; receipt_line record; current_received numeric(12,3); all_received boolean;
begin
 if not has_institution_role(p_institution_id,array['owner'::text,'admin'::text]) then raise exception 'Only an owner or administrator can post goods receipts'; end if;
 select * into receipt_row from public.goods_receipts where id=p_receipt_id and institution_id=p_institution_id for update;
 if not found or receipt_row.status<>'draft' then raise exception 'Only draft receipts can be posted'; end if;
 select * into order_row from public.purchase_orders where id=receipt_row.purchase_order_id and institution_id=p_institution_id for update;
 if not found or order_row.status not in ('approved','sent','partially_received') then raise exception 'The purchase order must be approved before receiving goods'; end if;
 if not exists(select 1 from public.goods_receipt_items where receipt_id=receipt_row.id and institution_id=p_institution_id) then raise exception 'Add at least one received quantity before posting'; end if;
 for receipt_line in
  select gri.id as receipt_line_id,gri.received_quantity,gri.purchase_order_item_id,poi.inventory_item_id,poi.unit_cost,poi.quantity,poi.received_quantity as prior_received,poi.item_description
  from public.goods_receipt_items gri
  join public.purchase_order_items poi on poi.id=gri.purchase_order_item_id and poi.institution_id=gri.institution_id
  where gri.receipt_id=receipt_row.id and gri.institution_id=p_institution_id
  for update of poi
 loop
  current_received:=receipt_line.prior_received+receipt_line.received_quantity;
  if current_received>receipt_line.quantity then raise exception 'Received quantity exceeds ordered quantity for %',receipt_line.item_description; end if;
  perform public.record_inventory_movement(p_institution_id,receipt_line.inventory_item_id,'stock_in',receipt_line.received_quantity,receipt_line.unit_cost,receipt_row.received_at::date,receipt_row.receipt_number,'Goods receipt for purchase order '||order_row.order_number);
  update public.purchase_order_items set received_quantity=current_received where id=receipt_line.purchase_order_item_id and institution_id=p_institution_id;
 end loop;
 select not exists(select 1 from public.purchase_order_items where purchase_order_id=order_row.id and institution_id=p_institution_id and received_quantity<quantity) into all_received;
 update public.goods_receipts set status='posted',posted_at=now() where id=receipt_row.id and institution_id=p_institution_id returning * into receipt_row;
 update public.purchase_orders set status=case when all_received then 'received' else 'partially_received' end,updated_at=now()
 where id=order_row.id and institution_id=p_institution_id;
 return receipt_row;
end;
$$;
revoke all on function public.post_goods_receipt(uuid,uuid) from public;
grant execute on function public.post_goods_receipt(uuid,uuid) to authenticated;
