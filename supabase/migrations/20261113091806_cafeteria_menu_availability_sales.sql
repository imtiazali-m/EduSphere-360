create table if not exists public.cafeteria_menu_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  menu_code text not null,
  name text not null check(length(trim(name)) between 1 and 180),
  category text,
  meal_period text not null default 'all_day' check(meal_period=any(array['breakfast'::text,'lunch'::text,'snack'::text,'dinner'::text,'all_day'::text])),
  unit text not null default 'serving',
  unit_price numeric(12,2) not null check(unit_price>=0),
  stock_item_id uuid,
  is_active boolean not null default true,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cafeteria_menu_items_id_institution_uq unique(id,institution_id),
  constraint cafeteria_menu_items_code_uq unique(institution_id,menu_code),
  constraint cafeteria_menu_stock_item_fk foreign key(stock_item_id,institution_id)
    references public.institutional_records(id,institution_id) on delete restrict
);

create table if not exists public.cafeteria_daily_availability (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  menu_item_id uuid not null,
  availability_date date not null,
  quantity_available numeric(12,3) not null check(quantity_available>=0),
  quantity_sold numeric(12,3) not null default 0 check(quantity_sold>=0 and quantity_sold<=quantity_available),
  status text not null default 'available' check(status=any(array['available'::text,'unavailable'::text,'cancelled'::text])),
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cafeteria_daily_availability_menu_fk foreign key(menu_item_id,institution_id)
    references public.cafeteria_menu_items(id,institution_id) on delete cascade,
  constraint cafeteria_daily_availability_unique unique(institution_id,menu_item_id,availability_date)
);

create table if not exists public.cafeteria_meal_plans (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  plan_code text not null,
  name text not null,
  description text,
  audience text not null default 'all' check(audience=any(array['students'::text,'staff'::text,'all'::text])),
  meal_period text not null default 'lunch' check(meal_period=any(array['breakfast'::text,'lunch'::text,'snack'::text,'dinner'::text])),
  price numeric(12,2) not null check(price>=0),
  starts_on date,
  ends_on date,
  max_servings_per_day integer check(max_servings_per_day is null or max_servings_per_day>0),
  status text not null default 'active' check(status=any(array['active'::text,'paused'::text,'archived'::text])),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cafeteria_meal_plans_id_institution_uq unique(id,institution_id),
  constraint cafeteria_meal_plans_code_uq unique(institution_id,plan_code),
  constraint cafeteria_meal_plans_date_check check(ends_on is null or starts_on is null or ends_on>=starts_on)
);

create table if not exists public.cafeteria_sales (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  receipt_number text not null,
  sale_at timestamptz not null default now(),
  buyer_label text,
  buyer_type text not null default 'walk_in' check(buyer_type=any(array['student'::text,'staff'::text,'walk_in'::text,'meal_plan'::text])),
  payment_method text not null default 'cash' check(payment_method=any(array['cash'::text,'card'::text,'mobile_wallet'::text,'account'::text])),
  payment_status text not null default 'paid' check(payment_status=any(array['paid'::text,'unpaid'::text,'on_account'::text,'void'::text])),
  total_amount numeric(14,2) not null default 0 check(total_amount>=0),
  sold_by uuid not null references auth.users(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  constraint cafeteria_sales_id_institution_uq unique(id,institution_id),
  constraint cafeteria_sales_receipt_uq unique(institution_id,receipt_number)
);

create table if not exists public.cafeteria_sale_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  sale_id uuid not null,
  menu_item_id uuid not null,
  quantity numeric(12,3) not null check(quantity>0),
  unit_price numeric(12,2) not null check(unit_price>=0),
  line_total numeric(14,2) generated always as (round(quantity*unit_price,2)) stored,
  created_at timestamptz not null default now(),
  constraint cafeteria_sale_items_sale_fk foreign key(sale_id,institution_id)
    references public.cafeteria_sales(id,institution_id) on delete cascade,
  constraint cafeteria_sale_items_menu_fk foreign key(menu_item_id,institution_id)
    references public.cafeteria_menu_items(id,institution_id) on delete restrict
);

create index if not exists cafeteria_daily_availability_date_idx on public.cafeteria_daily_availability(institution_id,availability_date,status);
create index if not exists cafeteria_sales_date_idx on public.cafeteria_sales(institution_id,sale_at desc);
create index if not exists cafeteria_sale_items_sale_idx on public.cafeteria_sale_items(institution_id,sale_id);

do $$
declare t text;
begin
 foreach t in array array['cafeteria_menu_items','cafeteria_daily_availability','cafeteria_meal_plans','cafeteria_sales','cafeteria_sale_items'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on table public.%I to authenticated',t);
 end loop;
end $$;

drop policy if exists cafeteria_menu_select on public.cafeteria_menu_items;
create policy cafeteria_menu_select on public.cafeteria_menu_items for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));
drop policy if exists cafeteria_menu_manage on public.cafeteria_menu_items;
create policy cafeteria_menu_manage on public.cafeteria_menu_items for all to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check(has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists cafeteria_availability_select on public.cafeteria_daily_availability;
create policy cafeteria_availability_select on public.cafeteria_daily_availability for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));
drop policy if exists cafeteria_availability_manage on public.cafeteria_daily_availability;
create policy cafeteria_availability_manage on public.cafeteria_daily_availability for all to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check(has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists cafeteria_meal_plans_select on public.cafeteria_meal_plans;
create policy cafeteria_meal_plans_select on public.cafeteria_meal_plans for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));
drop policy if exists cafeteria_meal_plans_manage on public.cafeteria_meal_plans;
create policy cafeteria_meal_plans_manage on public.cafeteria_meal_plans for all to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check(has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists cafeteria_sales_select on public.cafeteria_sales;
create policy cafeteria_sales_select on public.cafeteria_sales for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));
drop policy if exists cafeteria_sales_insert on public.cafeteria_sales;
create policy cafeteria_sales_insert on public.cafeteria_sales for insert to authenticated
with check(sold_by=(select auth.uid()) and has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists cafeteria_sale_items_select on public.cafeteria_sale_items;
create policy cafeteria_sale_items_select on public.cafeteria_sale_items for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));
drop policy if exists cafeteria_sale_items_insert on public.cafeteria_sale_items;
create policy cafeteria_sale_items_insert on public.cafeteria_sale_items for insert to authenticated
with check(has_institution_role(institution_id,array['owner'::text,'admin'::text]));

create or replace function public.record_cafeteria_sale(
 p_institution_id uuid,
 p_receipt_number text,
 p_buyer_label text,
 p_buyer_type text,
 p_payment_method text,
 p_payment_status text,
 p_lines jsonb,
 p_notes text default null
)
returns public.cafeteria_sales
language plpgsql
set search_path=public
as $$
declare
 sale_row public.cafeteria_sales;
 line_row record;
 menu_row public.cafeteria_menu_items;
 avail_row public.cafeteria_daily_availability;
 total_value numeric(14,2):=0;
 sale_day date:=current_date;
begin
 if not has_institution_role(p_institution_id,array['owner'::text,'admin'::text]) then
  raise exception 'Only an owner or administrator can record cafeteria sales';
 end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then
  raise exception 'Add at least one menu item to the sale';
 end if;
 if p_buyer_type not in ('student','staff','walk_in','meal_plan') then raise exception 'Invalid buyer type'; end if;
 if p_payment_method not in ('cash','card','mobile_wallet','account') then raise exception 'Invalid payment method'; end if;
 if p_payment_status not in ('paid','unpaid','on_account','void') then raise exception 'Invalid payment status'; end if;

 insert into public.cafeteria_sales(institution_id,receipt_number,sale_at,buyer_label,buyer_type,payment_method,payment_status,total_amount,sold_by,notes)
 values(p_institution_id,p_receipt_number,now(),p_buyer_label,p_buyer_type,p_payment_method,p_payment_status,0,auth.uid(),p_notes)
 returning * into sale_row;

 for line_row in
  select * from jsonb_to_recordset(p_lines) as x(menu_item_id uuid,quantity numeric)
 loop
  if line_row.quantity is null or line_row.quantity<=0 then raise exception 'Sale quantities must be greater than zero'; end if;
  select * into menu_row from public.cafeteria_menu_items
   where id=line_row.menu_item_id and institution_id=p_institution_id and is_active
   for update;
  if not found then raise exception 'A selected menu item is inactive or belongs to another institution'; end if;

  select * into avail_row from public.cafeteria_daily_availability
   where institution_id=p_institution_id and menu_item_id=menu_row.id and availability_date=sale_day
   for update;
  if not found or avail_row.status<>'available' then raise exception 'A menu item is not available today'; end if;
  if avail_row.quantity_sold+line_row.quantity>avail_row.quantity_available then
   raise exception 'Sale exceeds the remaining daily availability for %',menu_row.name;
  end if;

  update public.cafeteria_daily_availability
   set quantity_sold=quantity_sold+line_row.quantity,
       status=case when quantity_sold+line_row.quantity>=quantity_available then 'unavailable' else 'available' end,
       updated_by=auth.uid(),updated_at=now()
   where id=avail_row.id and institution_id=p_institution_id;

  insert into public.cafeteria_sale_items(institution_id,sale_id,menu_item_id,quantity,unit_price)
   values(p_institution_id,sale_row.id,menu_row.id,line_row.quantity,menu_row.unit_price);

  if menu_row.stock_item_id is not null then
   perform public.record_inventory_movement(p_institution_id,menu_row.stock_item_id,'stock_out',line_row.quantity,menu_row.unit_price,sale_day,p_receipt_number,'Cafeteria sale');
  end if;

  total_value:=total_value+(line_row.quantity*menu_row.unit_price);
 end loop;

 update public.cafeteria_sales set total_amount=round(total_value,2)
 where id=sale_row.id and institution_id=p_institution_id returning * into sale_row;
 return sale_row;
end;
$$;
revoke all on function public.record_cafeteria_sale(uuid,text,text,text,text,text,jsonb,text) from public;
grant execute on function public.record_cafeteria_sale(uuid,text,text,text,text,text,jsonb,text) to authenticated;
