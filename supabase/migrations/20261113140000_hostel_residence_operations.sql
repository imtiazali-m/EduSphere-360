create table if not exists public.hostel_buildings (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  building_code text not null,
  name text not null check (length(trim(name)) between 1 and 180),
  address text,
  floors integer not null default 1 check (floors > 0 and floors <= 200),
  warden_teacher_id uuid,
  status text not null default 'active' check (status=any(array['active'::text,'maintenance'::text,'inactive'::text])),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hostel_buildings_id_institution_uq unique(id,institution_id),
  constraint hostel_buildings_code_uq unique(institution_id,building_code),
  constraint hostel_buildings_warden_fk foreign key (warden_teacher_id,institution_id)
    references public.teachers(id,institution_id) on delete set null
);

create table if not exists public.hostel_rooms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  building_id uuid not null,
  room_number text not null,
  floor integer not null default 0 check (floor >= 0),
  room_type text not null default 'shared' check (room_type=any(array['single'::text,'shared'::text,'dormitory'::text])),
  capacity integer not null default 1 check (capacity > 0 and capacity <= 100),
  status text not null default 'active' check (status=any(array['active'::text,'maintenance'::text,'inactive'::text])),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hostel_rooms_id_institution_uq unique(id,institution_id),
  constraint hostel_rooms_number_uq unique(institution_id,building_id,room_number),
  constraint hostel_rooms_building_fk foreign key (building_id,institution_id)
    references public.hostel_buildings(id,institution_id) on delete restrict
);

create table if not exists public.hostel_beds (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  room_id uuid not null,
  bed_code text not null,
  status text not null default 'available' check (status=any(array['available'::text,'occupied'::text,'maintenance'::text])),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hostel_beds_id_institution_uq unique(id,institution_id),
  constraint hostel_beds_code_uq unique(institution_id,room_id,bed_code),
  constraint hostel_beds_room_fk foreign key (room_id,institution_id)
    references public.hostel_rooms(id,institution_id) on delete restrict
);

create table if not exists public.hostel_residents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  bed_id uuid not null,
  check_in_date date not null,
  expected_checkout_date date,
  actual_checkout_date date,
  status text not null default 'active' check (status=any(array['active'::text,'transferred'::text,'checked_out'::text])),
  notes text,
  approved_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hostel_residents_id_institution_uq unique(id,institution_id),
  constraint hostel_residents_student_fk foreign key (student_id,institution_id)
    references public.students(id,institution_id) on delete restrict,
  constraint hostel_residents_bed_fk foreign key (bed_id,institution_id)
    references public.hostel_beds(id,institution_id) on delete restrict,
  constraint hostel_residents_dates check (expected_checkout_date is null or expected_checkout_date >= check_in_date),
  constraint hostel_residents_checkout_date check (actual_checkout_date is null or actual_checkout_date >= check_in_date)
);

create unique index if not exists hostel_one_active_residence_per_student
  on public.hostel_residents(institution_id,student_id) where status='active';
create index if not exists hostel_residents_bed_idx on public.hostel_residents(institution_id,bed_id,status);

create table if not exists public.hostel_movements (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  resident_id uuid not null,
  movement_type text not null check (movement_type=any(array['check_in'::text,'temporary_exit'::text,'return'::text,'check_out'::text,'transfer'::text])),
  from_bed_id uuid,
  to_bed_id uuid,
  occurred_at timestamptz not null default now(),
  notes text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint hostel_movements_resident_fk foreign key (resident_id,institution_id)
    references public.hostel_residents(id,institution_id) on delete restrict,
  constraint hostel_movements_from_bed_fk foreign key (from_bed_id,institution_id)
    references public.hostel_beds(id,institution_id) on delete restrict,
  constraint hostel_movements_to_bed_fk foreign key (to_bed_id,institution_id)
    references public.hostel_beds(id,institution_id) on delete restrict
);

create index if not exists hostel_movements_timeline_idx
  on public.hostel_movements(institution_id,resident_id,occurred_at desc);

create table if not exists public.hostel_guest_visits (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  resident_id uuid not null,
  guest_name text not null check (length(trim(guest_name)) between 1 and 180),
  relationship text,
  purpose text not null,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  badge_number text,
  notes text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint hostel_guest_resident_fk foreign key (resident_id,institution_id)
    references public.hostel_residents(id,institution_id) on delete restrict,
  constraint hostel_guest_badge_uq unique(institution_id,badge_number),
  constraint hostel_guest_checkout_check check (check_out_at is null or check_out_at >= check_in_at)
);

create table if not exists public.hostel_fee_charges (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  resident_id uuid not null,
  billing_period text not null,
  amount numeric(12,2) not null check (amount >= 0),
  paid_amount numeric(12,2) not null default 0 check (paid_amount >= 0 and paid_amount <= amount),
  due_date date not null,
  payment_reference text,
  status text not null default 'pending' check (status=any(array['pending'::text,'part_paid'::text,'paid'::text,'waived'::text])),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hostel_fee_resident_fk foreign key (resident_id,institution_id)
    references public.hostel_residents(id,institution_id) on delete restrict,
  constraint hostel_fee_status_amount_check check (
    (status='waived' and paid_amount=0) or
    (status='paid' and paid_amount=amount) or
    (status='part_paid' and paid_amount>0 and paid_amount<amount) or
    status='pending'
  )
);

create table if not exists public.hostel_maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  room_id uuid not null,
  title text not null,
  description text,
  priority text not null default 'normal' check (priority=any(array['low'::text,'normal'::text,'high'::text,'urgent'::text])),
  status text not null default 'open' check (status=any(array['open'::text,'assigned'::text,'in_progress'::text,'resolved'::text,'closed'::text])),
  assigned_to uuid,
  reported_by uuid not null references auth.users(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hostel_maintenance_room_fk foreign key (room_id,institution_id)
    references public.hostel_rooms(id,institution_id) on delete restrict,
  constraint hostel_maintenance_assignee_fk foreign key (assigned_to,institution_id)
    references public.teachers(id,institution_id) on delete set null
);

create index if not exists hostel_maintenance_status_idx on public.hostel_maintenance_requests(institution_id,status,priority,created_at desc);
create index if not exists hostel_fee_due_idx on public.hostel_fee_charges(institution_id,due_date,status);

do $$
declare t text;
begin
  foreach t in array array['hostel_buildings','hostel_rooms','hostel_beds','hostel_residents','hostel_movements','hostel_guest_visits','hostel_fee_charges','hostel_maintenance_requests'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update,delete on table public.%I to authenticated',t);
  end loop;
end $$;

drop policy if exists hostel_buildings_select on public.hostel_buildings;
create policy hostel_buildings_select on public.hostel_buildings for select to authenticated
using (has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text]));
drop policy if exists hostel_buildings_manage on public.hostel_buildings;
create policy hostel_buildings_manage on public.hostel_buildings for all to authenticated
using (has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check (has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists hostel_rooms_select on public.hostel_rooms;
create policy hostel_rooms_select on public.hostel_rooms for select to authenticated
using (has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text]));
drop policy if exists hostel_rooms_manage on public.hostel_rooms;
create policy hostel_rooms_manage on public.hostel_rooms for all to authenticated
using (has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check (has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists hostel_beds_select on public.hostel_beds;
create policy hostel_beds_select on public.hostel_beds for select to authenticated
using (has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text]));
drop policy if exists hostel_beds_manage on public.hostel_beds;
create policy hostel_beds_manage on public.hostel_beds for all to authenticated
using (has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check (has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists hostel_residents_select on public.hostel_residents;
create policy hostel_residents_select on public.hostel_residents for select to authenticated
using (
  has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text])
  or exists(select 1 from public.students s where s.id=hostel_residents.student_id and s.institution_id=hostel_residents.institution_id and s.user_id=(select auth.uid()))
  or exists(select 1 from public.student_guardians g where g.student_id=hostel_residents.student_id and g.institution_id=hostel_residents.institution_id and g.parent_user_id=(select auth.uid()))
);
drop policy if exists hostel_residents_manage on public.hostel_residents;
create policy hostel_residents_manage on public.hostel_residents for all to authenticated
using (has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check (has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists hostel_movements_select on public.hostel_movements;
create policy hostel_movements_select on public.hostel_movements for select to authenticated
using (
  has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text])
  or exists(select 1 from public.hostel_residents r join public.students s on s.id=r.student_id and s.institution_id=r.institution_id where r.id=hostel_movements.resident_id and r.institution_id=hostel_movements.institution_id and s.user_id=(select auth.uid()))
  or exists(select 1 from public.hostel_residents r join public.student_guardians g on g.student_id=r.student_id and g.institution_id=r.institution_id where r.id=hostel_movements.resident_id and r.institution_id=hostel_movements.institution_id and g.parent_user_id=(select auth.uid()))
);
drop policy if exists hostel_movements_manage on public.hostel_movements;
create policy hostel_movements_manage on public.hostel_movements for all to authenticated
using (has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check (has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists hostel_guest_visits_select on public.hostel_guest_visits;
create policy hostel_guest_visits_select on public.hostel_guest_visits for select to authenticated
using (has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text]));
drop policy if exists hostel_guest_visits_manage on public.hostel_guest_visits;
create policy hostel_guest_visits_manage on public.hostel_guest_visits for all to authenticated
using (has_institution_role(institution_id,array['owner'::text,'admin'::text]))
with check (has_institution_role(institution_id,array['owner'::text,'admin'::text]));

drop policy if exists hostel_fee_charges_select on public.hostel_fee_charges;
create policy hostel_fee_charges_select on public.hostel_fee_charges for select to authenticated
using (
  has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text])
  or exists(select 1 from public.hostel_residents r join public.students s on s.id=r.student_id and s.institution_id=r.institution_id where r.id=hostel_fee_charges.resident_id and r.institution_id=hostel_fee_charges.institution_id and s.user_id=(select auth.uid()))
  or exists(select 1 from public.hostel_residents r join public.student_guardians g on g.student_id=r.student_id and g.institution_id=r.institution_id where r.id=hostel_fee_charges.resident_id and r.institution_id=hostel_fee_charges.institution_id and g.parent_user_id=(select auth.uid()))
);
drop policy if exists hostel_fee_charges_manage on public.hostel_fee_charges;
create policy hostel_fee_charges_manage on public.hostel_fee_charges for all to authenticated
using (has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]))
with check (has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text]));

drop policy if exists hostel_maintenance_select on public.hostel_maintenance_requests;
create policy hostel_maintenance_select on public.hostel_maintenance_requests for select to authenticated
using (has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text]));
drop policy if exists hostel_maintenance_manage on public.hostel_maintenance_requests;
create policy hostel_maintenance_manage on public.hostel_maintenance_requests for all to authenticated
using (has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text]))
with check (has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text]));

create or replace function public.allocate_hostel_bed(
  p_institution_id uuid,p_student_id uuid,p_bed_id uuid,p_check_in_date date,p_expected_checkout_date date,p_notes text default null
)
returns public.hostel_residents
language plpgsql
set search_path = public
as $$
declare bed_row public.hostel_beds; resident_row public.hostel_residents;
begin
  if not has_institution_role(p_institution_id,array['owner'::text,'admin'::text]) then
    raise exception 'Only an institution owner or administrator can allocate hostel beds';
  end if;
  select * into bed_row from public.hostel_beds where id=p_bed_id and institution_id=p_institution_id for update;
  if not found or bed_row.status<>'available' then raise exception 'The selected bed is not available'; end if;
  if not exists(select 1 from public.students where id=p_student_id and institution_id=p_institution_id) then raise exception 'Student does not belong to this institution'; end if;
  if exists(select 1 from public.hostel_residents where institution_id=p_institution_id and student_id=p_student_id and status='active') then raise exception 'This student already has an active hostel allocation'; end if;
  insert into public.hostel_residents(institution_id,student_id,bed_id,check_in_date,expected_checkout_date,status,notes,approved_by)
  values(p_institution_id,p_student_id,p_bed_id,p_check_in_date,p_expected_checkout_date,'active',p_notes,auth.uid())
  returning * into resident_row;
  update public.hostel_beds set status='occupied',updated_at=now() where id=p_bed_id and institution_id=p_institution_id;
  insert into public.hostel_movements(institution_id,resident_id,movement_type,to_bed_id,occurred_at,notes,recorded_by)
  values(p_institution_id,resident_row.id,'check_in',p_bed_id,now(),p_notes,auth.uid());
  return resident_row;
end;
$$;
revoke all on function public.allocate_hostel_bed(uuid,uuid,uuid,date,date,text) from public;
grant execute on function public.allocate_hostel_bed(uuid,uuid,uuid,date,date,text) to authenticated;

create or replace function public.transfer_hostel_resident(
  p_institution_id uuid,p_resident_id uuid,p_new_bed_id uuid,p_notes text default null
)
returns public.hostel_residents
language plpgsql
set search_path = public
as $$
declare resident_row public.hostel_residents; new_bed public.hostel_beds; old_bed uuid;
begin
  if not has_institution_role(p_institution_id,array['owner'::text,'admin'::text]) then raise exception 'Only an institution owner or administrator can transfer residents'; end if;
  select * into resident_row from public.hostel_residents where id=p_resident_id and institution_id=p_institution_id for update;
  if not found or resident_row.status<>'active' then raise exception 'Only an active hostel resident can be transferred'; end if;
  old_bed:=resident_row.bed_id;
  perform 1 from public.hostel_beds where institution_id=p_institution_id and id in (old_bed,p_new_bed_id) order by id for update;
  select * into new_bed from public.hostel_beds where id=p_new_bed_id and institution_id=p_institution_id;
  if not found or new_bed.status<>'available' then raise exception 'The destination bed is not available'; end if;
  update public.hostel_beds set status='available',updated_at=now() where id=old_bed and institution_id=p_institution_id;
  update public.hostel_beds set status='occupied',updated_at=now() where id=p_new_bed_id and institution_id=p_institution_id;
  update public.hostel_residents set bed_id=p_new_bed_id,updated_at=now(),notes=coalesce(p_notes,notes) where id=p_resident_id and institution_id=p_institution_id returning * into resident_row;
  insert into public.hostel_movements(institution_id,resident_id,movement_type,from_bed_id,to_bed_id,occurred_at,notes,recorded_by)
  values(p_institution_id,p_resident_id,'transfer',old_bed,p_new_bed_id,now(),p_notes,auth.uid());
  return resident_row;
end;
$$;
revoke all on function public.transfer_hostel_resident(uuid,uuid,text) from public;
grant execute on function public.transfer_hostel_resident(uuid,uuid,text) to authenticated;

create or replace function public.record_hostel_movement(
  p_institution_id uuid,p_resident_id uuid,p_movement_type text,p_notes text default null
)
returns void
language plpgsql
set search_path = public
as $$
declare resident_row public.hostel_residents;
begin
  if not has_institution_role(p_institution_id,array['owner'::text,'admin'::text]) then raise exception 'Only an institution owner or administrator can record hostel movements'; end if;
  if p_movement_type not in ('temporary_exit','return','check_out') then raise exception 'Unsupported hostel movement'; end if;
  select * into resident_row from public.hostel_residents where id=p_resident_id and institution_id=p_institution_id for update;
  if not found or resident_row.status<>'active' then raise exception 'The resident is not currently active'; end if;
  if p_movement_type='check_out' then
    update public.hostel_residents set status='checked_out',actual_checkout_date=current_date,updated_at=now()
    where id=p_resident_id and institution_id=p_institution_id;
    update public.hostel_beds set status='available',updated_at=now() where id=resident_row.bed_id and institution_id=p_institution_id;
  end if;
  insert into public.hostel_movements(institution_id,resident_id,movement_type,from_bed_id,occurred_at,notes,recorded_by)
  values(p_institution_id,p_resident_id,p_movement_type,resident_row.bed_id,now(),p_notes,auth.uid());
end;
$$;
revoke all on function public.record_hostel_movement(uuid,uuid,text,text) from public;
grant execute on function public.record_hostel_movement(uuid,uuid,text,text) to authenticated;
