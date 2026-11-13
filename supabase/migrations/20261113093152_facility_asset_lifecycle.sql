alter table public.facility_assets
  add column if not exists assigned_to_name text,
  add column if not exists assigned_to_department text,
  add column if not exists current_location text,
  add column if not exists warranty_provider text,
  add column if not exists warranty_start date,
  add column if not exists warranty_expiry date,
  add column if not exists disposal_date date,
  add column if not exists disposal_method text,
  add column if not exists disposal_value numeric(12,2),
  add column if not exists asset_lifecycle_status text not null default 'active';

create table if not exists public.facility_asset_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  asset_id uuid not null references public.facility_assets(id) on delete restrict,
  event_type text not null check(event_type=any(array['assigned'::text,'transferred'::text,'warranty_updated'::text,'disposed'::text])),
  event_date date not null default current_date,
  event_payload jsonb not null default '{}'::jsonb,
  performed_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists facility_asset_lifecycle_events_idx
 on public.facility_asset_lifecycle_events(institution_id,asset_id,event_date desc);

alter table public.facility_asset_lifecycle_events enable row level security;
revoke all on table public.facility_asset_lifecycle_events from public,anon,authenticated;
grant select on table public.facility_asset_lifecycle_events to authenticated;

drop policy if exists facility_asset_lifecycle_read on public.facility_asset_lifecycle_events;
create policy facility_asset_lifecycle_read on public.facility_asset_lifecycle_events for select to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'accountant'::text,'teacher'::text]));

create or replace function public.record_facility_asset_lifecycle(
 p_institution_id uuid,p_asset_id uuid,p_event_type text,p_event_date date,p_payload jsonb
)
returns public.facility_asset_lifecycle_events
language plpgsql
security definer
set search_path=public
as $$
declare asset_row public.facility_assets; event_row public.facility_asset_lifecycle_events; old_location text;
begin
 if auth.uid() is null or not has_institution_role(p_institution_id,array['owner'::text,'admin'::text]) then
  raise exception 'Only an institution owner or administrator can change asset lifecycle records';
 end if;
 if p_event_type not in ('assigned','transferred','warranty_updated','disposed') then raise exception 'Unsupported asset lifecycle event'; end if;
 select * into asset_row from public.facility_assets where id=p_asset_id and institution_id=p_institution_id for update;
 if not found then raise exception 'Asset not found in this institution'; end if;
 if asset_row.asset_lifecycle_status='disposed' then raise exception 'A disposed asset cannot be changed'; end if;
 old_location:=asset_row.current_location;

 if p_event_type='assigned' then
  if length(trim(coalesce(p_payload->>'assigned_to_name','')))<2 then raise exception 'Enter the assigned person or team'; end if;
  update public.facility_assets set
   assigned_to_name=trim(p_payload->>'assigned_to_name'),
   assigned_to_department=nullif(trim(p_payload->>'assigned_to_department'),''),
   current_location=coalesce(nullif(trim(p_payload->>'current_location'),''),current_location)
  where id=p_asset_id and institution_id=p_institution_id;
 elsif p_event_type='transferred' then
  if length(trim(coalesce(p_payload->>'to_location','')))<2 then raise exception 'Enter the destination location'; end if;
  update public.facility_assets set current_location=trim(p_payload->>'to_location')
  where id=p_asset_id and institution_id=p_institution_id;
 elsif p_event_type='warranty_updated' then
  if length(trim(coalesce(p_payload->>'warranty_provider','')))<2 then raise exception 'Enter a warranty provider'; end if;
  if nullif(p_payload->>'warranty_start','') is not null and nullif(p_payload->>'warranty_expiry','') is not null
    and (p_payload->>'warranty_expiry')::date<(p_payload->>'warranty_start')::date then
   raise exception 'Warranty expiry cannot precede its start date';
  end if;
  update public.facility_assets set
   warranty_provider=trim(p_payload->>'warranty_provider'),
   warranty_start=nullif(p_payload->>'warranty_start','')::date,
   warranty_expiry=nullif(p_payload->>'warranty_expiry','')::date
  where id=p_asset_id and institution_id=p_institution_id;
 elsif p_event_type='disposed' then
  if p_payload->>'approved' is distinct from 'true' then raise exception 'Explicit disposal approval is required'; end if;
  if length(trim(coalesce(p_payload->>'disposal_method','')))<2 then raise exception 'Enter the disposal method'; end if;
  update public.facility_assets set
   disposal_date=coalesce(nullif(p_payload->>'disposal_date','')::date,current_date),
   disposal_method=trim(p_payload->>'disposal_method'),
   disposal_value=coalesce(nullif(p_payload->>'disposal_value','')::numeric,0),
   asset_lifecycle_status='disposed'
  where id=p_asset_id and institution_id=p_institution_id;
 end if;

 insert into public.facility_asset_lifecycle_events(institution_id,asset_id,event_type,event_date,event_payload,performed_by)
 values(p_institution_id,p_asset_id,p_event_type,coalesce(p_event_date,current_date),
  coalesce(p_payload,'{}'::jsonb)||jsonb_build_object('previous_location',old_location),auth.uid())
 returning * into event_row;
 return event_row;
end;
$$;
revoke all on function public.record_facility_asset_lifecycle(uuid,uuid,text,date,jsonb) from public;
grant execute on function public.record_facility_asset_lifecycle(uuid,uuid,text,date,jsonb) to authenticated;
