create or replace function public.approve_facility_room_reservation(
  p_institution_id uuid,
  p_reservation_id uuid
)
returns public.facility_room_reservations
language plpgsql
set search_path = public
as $$
declare
  reservation_row public.facility_room_reservations;
begin
  if not has_institution_role(p_institution_id, array['owner'::text,'admin'::text]) then
    raise exception 'Only an institution owner or administrator can approve room reservations';
  end if;

  select * into reservation_row
  from public.facility_room_reservations
  where id = p_reservation_id
    and institution_id = p_institution_id
  for update;

  if not found then
    raise exception 'Room reservation was not found in this institution';
  end if;
  if reservation_row.status <> 'requested' then
    raise exception 'Only requested room reservations can be approved';
  end if;

  perform 1
  from public.rooms
  where id = reservation_row.room_id
    and institution_id = p_institution_id
  for update;

  if not found then
    raise exception 'The reserved room is no longer active in this institution';
  end if;

  if exists (
    select 1
    from public.facility_room_reservations existing
    where existing.institution_id = p_institution_id
      and existing.room_id = reservation_row.room_id
      and existing.id <> reservation_row.id
      and existing.status = 'approved'
      and existing.start_at < reservation_row.end_at
      and existing.end_at > reservation_row.start_at
  ) then
    raise exception 'The selected room already has an approved booking in this time range';
  end if;

  update public.facility_room_reservations
  set status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      updated_at = now()
  where id = reservation_row.id
    and institution_id = p_institution_id
  returning * into reservation_row;

  return reservation_row;
end;
$$;

revoke all on function public.approve_facility_room_reservation(uuid,uuid) from public;
grant execute on function public.approve_facility_room_reservation(uuid,uuid) to authenticated;
