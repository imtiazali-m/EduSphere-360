-- Atomic transport allocation workflows. Serialize allocation attempts on the
-- student and vehicle records so active dates and vehicle capacity remain consistent.
begin;

create or replace function public.create_student_transport_allocation(
  p_institution_id uuid,
  p_student_id uuid,
  p_route_record_id uuid,
  p_stop_record_id uuid default null,
  p_vehicle_record_id uuid default null,
  p_effective_from date default current_date,
  p_effective_to date default null,
  p_transport_fee numeric default 0,
  p_notes text default null
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_student public.students%rowtype;
  v_route public.institutional_records%rowtype;
  v_stop public.institutional_records%rowtype;
  v_vehicle public.institutional_records%rowtype;
  v_vehicle_capacity_raw text;
  v_vehicle_capacity numeric;
  v_occupied integer := 0;
  v_allocation_id uuid;
  v_route_code text;
  v_stop_route_code text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.has_institution_role(p_institution_id, array['owner','admin']) then
    raise exception 'Only institution owners and administrators can allocate student transport';
  end if;
  if p_effective_from is null then raise exception 'An allocation start date is required'; end if;
  if p_effective_to is not null and p_effective_to < p_effective_from then
    raise exception 'The allocation end date cannot precede its start date';
  end if;
  if p_transport_fee is null or p_transport_fee < 0 then
    raise exception 'Transport fee must be a non-negative amount';
  end if;

  -- Lock the student first to serialize all date-overlap checks for that learner.
  select * into v_student
  from public.students
  where id = p_student_id
    and institution_id = p_institution_id
    and status = 'active'
  for update;
  if not found then raise exception 'The selected learner is not an active student in this institution'; end if;

  select * into v_route
  from public.institutional_records
  where id = p_route_record_id
    and institution_id = p_institution_id
    and module_key = 'transport'
    and record_type = 'transport-routes'
  for key share;
  if not found then raise exception 'The selected transport route is not registered in this institution'; end if;
  if lower(v_route.status) in ('inactive','cancelled','closed','archived') then
    raise exception 'The selected transport route is not available for allocation';
  end if;

  if p_stop_record_id is not null then
    select * into v_stop
    from public.institutional_records
    where id = p_stop_record_id
      and institution_id = p_institution_id
      and module_key = 'transport'
      and record_type = 'route-stops';
    if not found then raise exception 'The selected route stop is not registered in this institution'; end if;

    v_route_code := lower(btrim(coalesce(v_route.payload->>'route_code', v_route.reference_code, '')));
    v_stop_route_code := lower(btrim(coalesce(v_stop.payload->>'route_code', '')));
    if v_stop.parent_record_id is not null and v_stop.parent_record_id <> p_route_record_id then
      raise exception 'The selected stop belongs to a different route';
    end if;
    if v_stop_route_code <> '' and v_route_code <> '' and v_stop_route_code <> v_route_code then
      raise exception 'The selected stop route code does not match the selected route';
    end if;
  end if;

  if p_vehicle_record_id is not null then
    -- Lock a vehicle before counting occupied seats to serialize capacity checks.
    select * into v_vehicle
    from public.institutional_records
    where id = p_vehicle_record_id
      and institution_id = p_institution_id
      and module_key = 'transport'
      and record_type = 'vehicle-management'
    for update;
    if not found then raise exception 'The selected vehicle is not registered in this institution'; end if;
    if lower(v_vehicle.status) in ('inactive','cancelled','closed','archived') then
      raise exception 'The selected vehicle is not available for allocation';
    end if;

    v_vehicle_capacity_raw := nullif(btrim(coalesce(
      v_vehicle.payload->>'seat_capacity',
      v_vehicle.payload->>'capacity',
      v_vehicle.payload->>'seating_capacity',
      ''
    )), '');
    if v_vehicle_capacity_raw is not null then
      if v_vehicle_capacity_raw !~ '^[0-9]+([.][0-9]+)?$' then
        raise exception 'The selected vehicle has an invalid seat capacity in its catalogue record';
      end if;
      v_vehicle_capacity := v_vehicle_capacity_raw::numeric;
      if v_vehicle_capacity <= 0 or v_vehicle_capacity <> trunc(v_vehicle_capacity) then
        raise exception 'The selected vehicle must have a positive whole-number seat capacity';
      end if;

      select count(*) into v_occupied
      from public.student_transport_allocations
      where institution_id = p_institution_id
        and vehicle_record_id = p_vehicle_record_id
        and status = 'active'
        and effective_from <= coalesce(p_effective_to, 'infinity'::date)
        and coalesce(effective_to, 'infinity'::date) >= p_effective_from;

      if v_occupied >= v_vehicle_capacity then
        raise exception 'The selected vehicle is at capacity for at least part of this allocation period';
      end if;
    end if;
  end if;

  if exists (
    select 1
    from public.student_transport_allocations
    where institution_id = p_institution_id
      and student_id = p_student_id
      and status = 'active'
      and effective_from <= coalesce(p_effective_to, 'infinity'::date)
      and coalesce(effective_to, 'infinity'::date) >= p_effective_from
  ) then
    raise exception 'This student already has an active transport allocation covering part of these dates';
  end if;

  insert into public.student_transport_allocations (
    institution_id,student_id,route_record_id,stop_record_id,vehicle_record_id,
    effective_from,effective_to,transport_fee,status,notes,created_by
  ) values (
    p_institution_id,p_student_id,p_route_record_id,p_stop_record_id,p_vehicle_record_id,
    p_effective_from,p_effective_to,p_transport_fee,'active',nullif(btrim(p_notes),''),v_user
  )
  returning id into v_allocation_id;

  return jsonb_build_object(
    'allocation_id',v_allocation_id,
    'student_id',p_student_id,
    'route_record_id',p_route_record_id,
    'vehicle_record_id',p_vehicle_record_id,
    'vehicle_occupied',v_occupied + case when p_vehicle_record_id is null then 0 else 1 end
  );
end;
$$;

create or replace function public.end_student_transport_allocation(
  p_institution_id uuid,
  p_allocation_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := auth.uid();
  v_allocation public.student_transport_allocations%rowtype;
  v_end_date date;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.has_institution_role(p_institution_id, array['owner','admin']) then
    raise exception 'Only institution owners and administrators can end transport allocations';
  end if;

  select * into v_allocation
  from public.student_transport_allocations
  where id = p_allocation_id
    and institution_id = p_institution_id
  for update;

  if not found then raise exception 'The transport allocation was not found in this institution'; end if;
  if v_allocation.status <> 'active' then raise exception 'This transport allocation is no longer active'; end if;

  v_end_date := greatest(current_date, v_allocation.effective_from);
  update public.student_transport_allocations
  set status = 'cancelled',
      effective_to = v_end_date,
      updated_at = now()
  where id = p_allocation_id
    and institution_id = p_institution_id
    and status = 'active';

  return jsonb_build_object('allocation_id',p_allocation_id,'status','cancelled','effective_to',v_end_date);
end;
$$;

revoke all on function public.create_student_transport_allocation(uuid,uuid,uuid,uuid,uuid,date,date,numeric,text) from public, anon;
revoke all on function public.end_student_transport_allocation(uuid,uuid) from public, anon;
grant execute on function public.create_student_transport_allocation(uuid,uuid,uuid,uuid,uuid,date,date,numeric,text) to authenticated;
grant execute on function public.end_student_transport_allocation(uuid,uuid) to authenticated;

commit;
