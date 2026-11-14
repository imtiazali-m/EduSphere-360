create table if not exists public.facility_room_reservations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  room_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 180),
  purpose text not null check (length(trim(purpose)) between 1 and 4000),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'requested'
    check (status = any (array['requested'::text,'approved'::text,'rejected'::text,'cancelled'::text])),
  requested_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facility_room_reservations_dates check (end_at > start_at),
  constraint facility_room_reservations_room_fk foreign key (room_id,institution_id)
    references public.rooms(id,institution_id) on delete restrict
);

create index if not exists facility_room_reservations_room_time_idx
  on public.facility_room_reservations(institution_id,room_id,start_at,end_at);
create index if not exists facility_room_reservations_requester_idx
  on public.facility_room_reservations(institution_id,requested_by,created_at desc);

alter table public.facility_room_reservations enable row level security;
revoke all on table public.facility_room_reservations from public,anon,authenticated;
grant select,insert,update on table public.facility_room_reservations to authenticated;

drop policy if exists facility_room_reservations_select on public.facility_room_reservations;
create policy facility_room_reservations_select on public.facility_room_reservations
 for select to authenticated using (
   has_institution_role(institution_id,array['owner'::text,'admin'::text])
   or requested_by=(select auth.uid())
 );

drop policy if exists facility_room_reservations_insert on public.facility_room_reservations;
create policy facility_room_reservations_insert on public.facility_room_reservations
 for insert to authenticated with check (
   requested_by=(select auth.uid())
   and has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text])
   and exists(select 1 from public.rooms r where r.id=room_id and r.institution_id=facility_room_reservations.institution_id and r.is_active)
 );

drop policy if exists facility_room_reservations_update_admin on public.facility_room_reservations;
create policy facility_room_reservations_update_admin on public.facility_room_reservations
 for update to authenticated using (
   has_institution_role(institution_id,array['owner'::text,'admin'::text])
 ) with check (
   has_institution_role(institution_id,array['owner'::text,'admin'::text])
 );

drop policy if exists facility_room_reservations_update_requester on public.facility_room_reservations;
create policy facility_room_reservations_update_requester on public.facility_room_reservations
 for update to authenticated using (
   requested_by=(select auth.uid()) and status='requested'
 ) with check (
   requested_by=(select auth.uid()) and status='cancelled'
 );

create table if not exists public.transport_attendance_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  allocation_id uuid not null,
  event_type text not null check (event_type=any(array['boarded'::text,'alighted'::text,'absent'::text])),
  occurred_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  notes text,
  source text not null default 'manual' check (source=any(array['manual'::text,'device'::text])),
  created_at timestamptz not null default now(),
  constraint transport_attendance_allocation_fk foreign key (allocation_id)
    references public.student_transport_allocations(id) on delete restrict
);

create index if not exists transport_attendance_events_institution_time_idx
  on public.transport_attendance_events(institution_id,occurred_at desc);
create index if not exists transport_attendance_events_allocation_idx
  on public.transport_attendance_events(institution_id,allocation_id,occurred_at desc);

alter table public.transport_attendance_events enable row level security;
revoke all on table public.transport_attendance_events from public,anon,authenticated;
grant select,insert on table public.transport_attendance_events to authenticated;

drop policy if exists transport_attendance_events_select on public.transport_attendance_events;
create policy transport_attendance_events_select on public.transport_attendance_events
 for select to authenticated using (
   has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text])
 );

drop policy if exists transport_attendance_events_insert on public.transport_attendance_events;
create policy transport_attendance_events_insert on public.transport_attendance_events
 for insert to authenticated with check (
   recorded_by=(select auth.uid())
   and has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text])
   and exists(select 1 from public.student_transport_allocations a
     where a.id=allocation_id and a.institution_id=transport_attendance_events.institution_id and a.status='active')
 );
