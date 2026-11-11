alter table public.attendance
  add column if not exists arrival_time time,
  add column if not exists departure_time time,
  add column if not exists minutes_late integer not null default 0,
  add column if not exists early_departure_minutes integer not null default 0,
  add column if not exists correction_reason text,
  add column if not exists corrected_by uuid references auth.users(id) on delete set null,
  add column if not exists corrected_at timestamptz;
alter table public.attendance drop constraint if exists attendance_status_check;
alter table public.attendance add constraint attendance_status_check
  check (status = any(array['present','absent','late','excused','approved_leave']::text[]));
alter table public.attendance drop constraint if exists attendance_minutes_nonnegative;
alter table public.attendance add constraint attendance_minutes_nonnegative
  check (minutes_late >= 0 and early_departure_minutes >= 0);
create unique index if not exists attendance_record_scope_unique
  on public.attendance(institution_id,student_id,attendance_date,period_label) where student_id is not null;
create index if not exists attendance_institution_date_class_idx
  on public.attendance(institution_id,attendance_date desc,class_name);

create table if not exists public.employee_shifts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  name text not null,
  start_time time not null,
  end_time time not null,
  grace_minutes integer not null default 10 check(grace_minutes between 0 and 240),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_shifts_time_check check(end_time>start_time),
  constraint employee_shifts_name_unique unique(institution_id,name)
);
alter table public.employee_attendance
  add column if not exists shift_id uuid references public.employee_shifts(id) on delete set null,
  add column if not exists minutes_late integer not null default 0,
  add column if not exists early_departure_minutes integer not null default 0;
alter table public.employee_attendance drop constraint if exists employee_attendance_status_check;
alter table public.employee_attendance add constraint employee_attendance_status_check
  check(status=any(array['present','absent','late','excused','approved_leave','remote','half_day']::text[]));
alter table public.employee_attendance drop constraint if exists employee_attendance_minutes_nonnegative;
alter table public.employee_attendance add constraint employee_attendance_minutes_nonnegative
  check(minutes_late>=0 and early_departure_minutes>=0);
create unique index if not exists employee_attendance_scope_unique
  on public.employee_attendance(institution_id,teacher_id,attendance_date);
create index if not exists employee_attendance_institution_date_idx
  on public.employee_attendance(institution_id,attendance_date desc,teacher_id);
alter table public.employee_leave_requests add column if not exists supporting_document_path text;
create index if not exists employee_leave_institution_dates_idx
  on public.employee_leave_requests(institution_id,start_date desc,status);

create table if not exists public.student_leave_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  campus_id uuid references public.campuses(id) on delete set null,
  leave_type text not null check(leave_type=any(array['sick','family','personal','other']::text[])),
  start_date date not null,
  end_date date not null,
  day_count numeric(6,2) not null check(day_count>0),
  reason text not null,
  supporting_document_path text,
  status text not null default 'pending' check(status=any(array['pending','approved','rejected','cancelled']::text[])),
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_leave_date_range_check check(end_date>=start_date),
  constraint student_leave_student_fk foreign key(student_id,institution_id)
    references public.students(id,institution_id) on delete cascade
);
create index if not exists student_leave_institution_date_idx
  on public.student_leave_requests(institution_id,start_date desc,status);
create index if not exists student_leave_student_idx
  on public.student_leave_requests(student_id,start_date desc);

create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  person_type text not null check(person_type=any(array['student','employee']::text[])),
  person_id uuid not null,
  leave_type text not null,
  leave_year integer not null check(leave_year between 2000 and 2200),
  entitled_days numeric(7,2) not null default 0 check(entitled_days>=0),
  carried_forward_days numeric(7,2) not null default 0 check(carried_forward_days>=0),
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_balance_scope_unique unique(institution_id,person_type,person_id,leave_type,leave_year)
);
create index if not exists leave_balances_person_idx
  on public.leave_balances(institution_id,person_type,person_id,leave_year);
create or replace function public.guard_leave_balance_person()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.person_type='student' then
    if not exists(select 1 from public.students s where s.id=new.person_id and s.institution_id=new.institution_id) then
      raise exception 'The selected student does not belong to this institution.';
    end if;
  elsif new.person_type='employee' then
    if not exists(select 1 from public.teachers t where t.id=new.person_id and t.institution_id=new.institution_id) then
      raise exception 'The selected employee does not belong to this institution.';
    end if;
  end if;
  new.updated_at=now();
  return new;
end;
$$;
drop trigger if exists guard_leave_balance_person on public.leave_balances;
create trigger guard_leave_balance_person before insert or update on public.leave_balances
for each row execute function public.guard_leave_balance_person();

create table if not exists public.student_care_access (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  area text not null check(area=any(array['discipline','counselling','health']::text[])),
  can_read boolean not null default true,
  can_write boolean not null default false,
  grant_reason text not null,
  granted_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_care_access_scope_unique unique(institution_id,user_id,area),
  constraint student_care_access_write_requires_read check(not can_write or can_read)
);
create index if not exists student_care_access_user_idx
  on public.student_care_access(institution_id,user_id,area);

create table if not exists public.student_discipline_communications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  behaviour_event_id uuid references public.student_behaviour_events(id) on delete set null,
  sent_to_parent_user_id uuid not null references auth.users(id) on delete cascade,
  communication_date date not null default current_date,
  channel text not null default 'portal' check(channel=any(array['portal','email','sms','whatsapp']::text[])),
  message text not null,
  parent_visible boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint discipline_communication_student_fk foreign key(student_id,institution_id)
    references public.students(id,institution_id) on delete cascade
);
create index if not exists student_discipline_communications_parent_idx
  on public.student_discipline_communications(institution_id,sent_to_parent_user_id,communication_date desc);

create table if not exists public.student_counselling_appointments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  assigned_to uuid references auth.users(id) on delete set null,
  appointment_at timestamptz,
  appointment_type text not null default 'general' check(appointment_type=any(array['general','academic','wellbeing','family','follow_up']::text[])),
  request_notes text,
  status text not null default 'pending' check(status=any(array['pending','scheduled','completed','cancelled']::text[])),
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint counselling_appointment_student_fk foreign key(student_id,institution_id)
    references public.students(id,institution_id) on delete cascade
);
create index if not exists counselling_appointments_scope_idx
  on public.student_counselling_appointments(institution_id,appointment_at desc,status);

create table if not exists public.student_counselling_notes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  appointment_id uuid references public.student_counselling_appointments(id) on delete set null,
  note_date date not null default current_date,
  concern_summary text not null,
  confidential_notes text not null,
  support_plan text,
  follow_up_date date,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint counselling_note_student_fk foreign key(student_id,institution_id)
    references public.students(id,institution_id) on delete cascade
);
create index if not exists counselling_notes_student_idx
  on public.student_counselling_notes(institution_id,student_id,note_date desc);

create table if not exists public.student_emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  contact_name text not null,
  relationship text not null,
  phone text not null,
  alternate_phone text,
  email text,
  priority_order integer not null default 1 check(priority_order between 1 and 10),
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emergency_contact_student_fk foreign key(student_id,institution_id)
    references public.students(id,institution_id) on delete cascade
);
create index if not exists student_emergency_contacts_student_idx
  on public.student_emergency_contacts(institution_id,student_id,priority_order);

create table if not exists public.student_health_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  record_date date not null default current_date,
  record_type text not null check(record_type=any(array['allergy','condition','medication','care_plan','clinic_visit','medical_note','other']::text[])),
  summary text not null,
  details text,
  clinic_name text,
  action_taken text,
  follow_up_date date,
  attachment_path text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_record_student_fk foreign key(student_id,institution_id)
    references public.students(id,institution_id) on delete cascade
);
create index if not exists student_health_records_student_idx
  on public.student_health_records(institution_id,student_id,record_date desc);

create table if not exists public.student_health_incidents (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  occurred_at timestamptz not null default now(),
  location text,
  incident_type text not null,
  symptoms_or_description text not null,
  clinic_visit boolean not null default false,
  clinic_name text,
  action_taken text not null,
  follow_up_required boolean not null default false,
  follow_up_date date,
  status text not null default 'open' check(status=any(array['open','follow_up','resolved','closed']::text[])),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_incident_student_fk foreign key(student_id,institution_id)
    references public.students(id,institution_id) on delete cascade,
  constraint health_incident_follow_up_check check(not follow_up_required or follow_up_date is not null)
);
create index if not exists student_health_incidents_student_idx
  on public.student_health_incidents(institution_id,student_id,occurred_at desc);

grant select,insert,update,delete on public.employee_shifts,public.student_leave_requests,public.leave_balances,
  public.student_care_access,public.student_discipline_communications,public.student_counselling_appointments,
  public.student_counselling_notes,public.student_emergency_contacts,public.student_health_records,
  public.student_health_incidents to authenticated;
alter table public.employee_shifts enable row level security;
alter table public.student_leave_requests enable row level security;
alter table public.leave_balances enable row level security;
alter table public.student_care_access enable row level security;
alter table public.student_discipline_communications enable row level security;
alter table public.student_counselling_appointments enable row level security;
alter table public.student_counselling_notes enable row level security;
alter table public.student_emergency_contacts enable row level security;
alter table public.student_health_records enable row level security;
alter table public.student_health_incidents enable row level security;

drop policy if exists stage7_employee_shifts_read on public.employee_shifts;
create policy stage7_employee_shifts_read on public.employee_shifts for select to authenticated using(
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.teachers t where t.institution_id=employee_shifts.institution_id and t.user_id=(select auth.uid()))
);
drop policy if exists stage7_employee_shifts_admin_write on public.employee_shifts;
create policy stage7_employee_shifts_admin_write on public.employee_shifts for all to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']))
with check(public.has_institution_role(institution_id,array['owner','admin']));

drop policy if exists stage7_student_leave_read on public.student_leave_requests;
create policy stage7_student_leave_read on public.student_leave_requests for select to authenticated using(
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.students s where s.id=student_leave_requests.student_id and s.institution_id=student_leave_requests.institution_id and s.user_id=(select auth.uid()))
  or exists(select 1 from public.student_guardians g where g.student_id=student_leave_requests.student_id and g.institution_id=student_leave_requests.institution_id and g.parent_user_id=(select auth.uid()))
);
drop policy if exists stage7_student_leave_insert on public.student_leave_requests;
create policy stage7_student_leave_insert on public.student_leave_requests for insert to authenticated with check(
  created_by=(select auth.uid()) and status='pending' and reviewed_by is null and reviewed_at is null and (
    public.has_institution_role(institution_id,array['owner','admin'])
    or exists(select 1 from public.students s where s.id=student_leave_requests.student_id and s.institution_id=student_leave_requests.institution_id and s.user_id=(select auth.uid()))
    or exists(select 1 from public.student_guardians g where g.student_id=student_leave_requests.student_id and g.institution_id=student_leave_requests.institution_id and g.parent_user_id=(select auth.uid()))
  )
);
drop policy if exists stage7_student_leave_update on public.student_leave_requests;
create policy stage7_student_leave_update on public.student_leave_requests for update to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or (status='pending' and (
  exists(select 1 from public.students s where s.id=student_leave_requests.student_id and s.institution_id=student_leave_requests.institution_id and s.user_id=(select auth.uid()))
  or exists(select 1 from public.student_guardians g where g.student_id=student_leave_requests.student_id and g.institution_id=student_leave_requests.institution_id and g.parent_user_id=(select auth.uid()))
)))
with check(public.has_institution_role(institution_id,array['owner','admin']) or
  (status='cancelled' and created_by=(select auth.uid()) and reviewed_by is null and reviewed_at is null));
drop policy if exists stage7_student_leave_delete on public.student_leave_requests;
create policy stage7_student_leave_delete on public.student_leave_requests for delete to authenticated using(
  public.has_institution_role(institution_id,array['owner','admin'])
);

drop policy if exists stage7_leave_balances_read on public.leave_balances;
create policy stage7_leave_balances_read on public.leave_balances for select to authenticated using(
  public.has_institution_role(institution_id,array['owner','admin'])
  or (person_type='student' and (
    exists(select 1 from public.students s where s.id=leave_balances.person_id and s.institution_id=leave_balances.institution_id and s.user_id=(select auth.uid()))
    or exists(select 1 from public.student_guardians g where g.student_id=leave_balances.person_id and g.institution_id=leave_balances.institution_id and g.parent_user_id=(select auth.uid()))
  ))
  or (person_type='employee' and exists(select 1 from public.teachers t where t.id=leave_balances.person_id and t.institution_id=leave_balances.institution_id and t.user_id=(select auth.uid())))
);
drop policy if exists stage7_leave_balances_admin_write on public.leave_balances;
create policy stage7_leave_balances_admin_write on public.leave_balances for all to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']))
with check(public.has_institution_role(institution_id,array['owner','admin']));

drop policy if exists stage7_care_access_read on public.student_care_access;
create policy stage7_care_access_read on public.student_care_access for select to authenticated using(
  user_id=(select auth.uid()) or public.has_institution_role(institution_id,array['owner','admin'])
);
drop policy if exists stage7_care_access_admin_write on public.student_care_access;
create policy stage7_care_access_admin_write on public.student_care_access for all to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']))
with check(
  public.has_institution_role(institution_id,array['owner','admin'])
  and exists(select 1 from public.memberships m where m.institution_id=student_care_access.institution_id and m.user_id=student_care_access.user_id and m.status='active' and m.role in ('teacher','admin','owner'))
);

drop policy if exists student_behaviour_read on public.student_behaviour_events;
create policy stage7_student_behaviour_read on public.student_behaviour_events for select to authenticated using(
  public.has_institution_role(institution_id,array['owner','admin'])
  or created_by=(select auth.uid())
  or exists(select 1 from public.student_care_access a where a.institution_id=student_behaviour_events.institution_id and a.user_id=(select auth.uid()) and a.area='discipline' and a.can_read)
);
drop policy if exists student_behaviour_insert on public.student_behaviour_events;
create policy stage7_student_behaviour_insert on public.student_behaviour_events for insert to authenticated with check(
  created_by=(select auth.uid()) and (
    public.has_institution_role(institution_id,array['owner','admin'])
    or exists(select 1 from public.student_care_access a where a.institution_id=student_behaviour_events.institution_id and a.user_id=(select auth.uid()) and a.area='discipline' and a.can_write)
  )
);
drop policy if exists student_behaviour_update on public.student_behaviour_events;
create policy stage7_student_behaviour_update on public.student_behaviour_events for update to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_behaviour_events.institution_id and a.user_id=(select auth.uid()) and a.area='discipline' and a.can_write))
with check(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_behaviour_events.institution_id and a.user_id=(select auth.uid()) and a.area='discipline' and a.can_write));

drop policy if exists stage7_discipline_communications_read on public.student_discipline_communications;
create policy stage7_discipline_communications_read on public.student_discipline_communications for select to authenticated using(
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_discipline_communications.institution_id and a.user_id=(select auth.uid()) and a.area='discipline' and a.can_read)
  or (parent_visible and sent_to_parent_user_id=(select auth.uid()) and exists(
    select 1 from public.student_guardians g where g.student_id=student_discipline_communications.student_id and g.institution_id=student_discipline_communications.institution_id and g.parent_user_id=(select auth.uid())
  ))
);
drop policy if exists stage7_discipline_communications_write on public.student_discipline_communications;
create policy stage7_discipline_communications_write on public.student_discipline_communications for all to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_discipline_communications.institution_id and a.user_id=(select auth.uid()) and a.area='discipline' and a.can_write))
with check(created_by=(select auth.uid()) and (
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_discipline_communications.institution_id and a.user_id=(select auth.uid()) and a.area='discipline' and a.can_write)
));

drop policy if exists stage7_counselling_appointments_read on public.student_counselling_appointments;
create policy stage7_counselling_appointments_read on public.student_counselling_appointments for select to authenticated using(
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_counselling_appointments.institution_id and a.user_id=(select auth.uid()) and a.area='counselling' and a.can_read and (assigned_to is null or assigned_to=(select auth.uid())))
  or exists(select 1 from public.students s where s.id=student_counselling_appointments.student_id and s.institution_id=student_counselling_appointments.institution_id and s.user_id=(select auth.uid()))
  or exists(select 1 from public.student_guardians g where g.student_id=student_counselling_appointments.student_id and g.institution_id=student_counselling_appointments.institution_id and g.parent_user_id=(select auth.uid()))
);
drop policy if exists stage7_counselling_appointments_insert on public.student_counselling_appointments;
create policy stage7_counselling_appointments_insert on public.student_counselling_appointments for insert to authenticated with check(
  requested_by=(select auth.uid()) and status='pending' and (
    public.has_institution_role(institution_id,array['owner','admin'])
    or exists(select 1 from public.students s where s.id=student_counselling_appointments.student_id and s.institution_id=student_counselling_appointments.institution_id and s.user_id=(select auth.uid()))
    or exists(select 1 from public.student_guardians g where g.student_id=student_counselling_appointments.student_id and g.institution_id=student_counselling_appointments.institution_id and g.parent_user_id=(select auth.uid()))
    or exists(select 1 from public.student_care_access a where a.institution_id=student_counselling_appointments.institution_id and a.user_id=(select auth.uid()) and a.area='counselling' and a.can_write)
  )
);
drop policy if exists stage7_counselling_appointments_update on public.student_counselling_appointments;
create policy stage7_counselling_appointments_update on public.student_counselling_appointments for update to authenticated
using(public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_counselling_appointments.institution_id and a.user_id=(select auth.uid()) and a.area='counselling' and a.can_write)
  or (requested_by=(select auth.uid()) and status='pending'))
with check(public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_counselling_appointments.institution_id and a.user_id=(select auth.uid()) and a.area='counselling' and a.can_write)
  or (requested_by=(select auth.uid()) and status='cancelled'));

drop policy if exists stage7_counselling_notes_read on public.student_counselling_notes;
create policy stage7_counselling_notes_read on public.student_counselling_notes for select to authenticated using(
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_counselling_notes.institution_id and a.user_id=(select auth.uid()) and a.area='counselling' and a.can_read)
);
drop policy if exists stage7_counselling_notes_write on public.student_counselling_notes;
create policy stage7_counselling_notes_write on public.student_counselling_notes for all to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_counselling_notes.institution_id and a.user_id=(select auth.uid()) and a.area='counselling' and a.can_write))
with check(created_by=(select auth.uid()) and (
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_counselling_notes.institution_id and a.user_id=(select auth.uid()) and a.area='counselling' and a.can_write)
));

drop policy if exists stage7_emergency_contacts_read on public.student_emergency_contacts;
create policy stage7_emergency_contacts_read on public.student_emergency_contacts for select to authenticated using(
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_emergency_contacts.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_read)
  or exists(select 1 from public.students s where s.id=student_emergency_contacts.student_id and s.institution_id=student_emergency_contacts.institution_id and s.user_id=(select auth.uid()))
  or exists(select 1 from public.student_guardians g where g.student_id=student_emergency_contacts.student_id and g.institution_id=student_emergency_contacts.institution_id and g.parent_user_id=(select auth.uid()))
);
drop policy if exists stage7_emergency_contacts_write on public.student_emergency_contacts;
create policy stage7_emergency_contacts_write on public.student_emergency_contacts for all to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_emergency_contacts.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write))
with check(created_by=(select auth.uid()) and (
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_emergency_contacts.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write)
));

drop policy if exists stage7_health_records_read on public.student_health_records;
create policy stage7_health_records_read on public.student_health_records for select to authenticated using(
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_health_records.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_read)
);
drop policy if exists stage7_health_records_write on public.student_health_records;
create policy stage7_health_records_write on public.student_health_records for all to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_health_records.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write))
with check(created_by=(select auth.uid()) and (
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_health_records.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write)
));

drop policy if exists stage7_health_incidents_read on public.student_health_incidents;
create policy stage7_health_incidents_read on public.student_health_incidents for select to authenticated using(
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_health_incidents.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_read)
);
drop policy if exists stage7_health_incidents_write on public.student_health_incidents;
create policy stage7_health_incidents_write on public.student_health_incidents for all to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_health_incidents.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write))
with check(created_by=(select auth.uid()) and (
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_health_incidents.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write)
));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('attendance-private','attendance-private',false,10485760,array['application/pdf','image/jpeg','image/png']::text[])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf','image/jpeg','image/png']::text[];
grant select,insert,update,delete on storage.objects to authenticated;
drop policy if exists stage7_attendance_files_insert on storage.objects;
create policy stage7_attendance_files_insert on storage.objects for insert to authenticated with check(
  bucket_id='attendance-private' and array_length(storage.foldername(name),1)=3 and (
    public.has_institution_role(((storage.foldername(name))[1])::uuid,array['owner','admin'])
    or (
      (storage.foldername(name))[2]='students' and (
        exists(select 1 from public.students s where s.id=((storage.foldername(name))[3])::uuid and s.institution_id=((storage.foldername(name))[1])::uuid and s.user_id=(select auth.uid()))
        or exists(select 1 from public.student_guardians g where g.student_id=((storage.foldername(name))[3])::uuid and g.institution_id=((storage.foldername(name))[1])::uuid and g.parent_user_id=(select auth.uid()))
      )
    )
    or ((storage.foldername(name))[2]='employees' and exists(
      select 1 from public.teachers t where t.id=((storage.foldername(name))[3])::uuid and t.institution_id=((storage.foldername(name))[1])::uuid and t.user_id=(select auth.uid())
    ))
  )
);
drop policy if exists stage7_attendance_files_read on storage.objects;
create policy stage7_attendance_files_read on storage.objects for select to authenticated using(
  bucket_id='attendance-private' and array_length(storage.foldername(name),1)=3 and (
    public.has_institution_role(((storage.foldername(name))[1])::uuid,array['owner','admin'])
    or (
      (storage.foldername(name))[2]='students'
      and exists(select 1 from public.student_leave_requests l where l.institution_id=((storage.foldername(name))[1])::uuid and l.student_id=((storage.foldername(name))[3])::uuid and l.supporting_document_path=objects.name)
      and (
        exists(select 1 from public.students s where s.id=((storage.foldername(name))[3])::uuid and s.institution_id=((storage.foldername(name))[1])::uuid and s.user_id=(select auth.uid()))
        or exists(select 1 from public.student_guardians g where g.student_id=((storage.foldername(name))[3])::uuid and g.institution_id=((storage.foldername(name))[1])::uuid and g.parent_user_id=(select auth.uid()))
      )
    )
    or ((storage.foldername(name))[2]='employees' and exists(
      select 1 from public.employee_leave_requests l join public.teachers t on t.id=l.teacher_id and t.institution_id=l.institution_id
      where l.institution_id=((storage.foldername(name))[1])::uuid and l.teacher_id=((storage.foldername(name))[3])::uuid and l.supporting_document_path=objects.name and t.user_id=(select auth.uid())
    ))
  )
);
drop policy if exists stage7_attendance_files_admin_delete on storage.objects;
create policy stage7_attendance_files_admin_delete on storage.objects for delete to authenticated using(
  bucket_id='attendance-private' and array_length(storage.foldername(name),1)=3
  and public.has_institution_role(((storage.foldername(name))[1])::uuid,array['owner','admin'])
);

create or replace function public.save_student_attendance_register(
  p_institution_id uuid,p_attendance_date date,p_class_name text,p_section_name text,
  p_campus_id uuid,p_period_label text,p_rows jsonb,p_late_after time default '08:00'
)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_item jsonb; v_student_id uuid; v_status text; v_count integer:=0;
  v_present integer:=0; v_absent integer:=0; v_late integer:=0; v_register_id uuid;
  v_student_name text; v_minutes_late integer; v_early_minutes integer; v_arrival time; v_departure time;
begin
  if not public.has_institution_role(p_institution_id,array['owner','admin','teacher']) then
    raise exception 'You do not have permission to record student attendance.';
  end if;
  if coalesce(btrim(p_class_name),'')='' or coalesce(btrim(p_period_label),'')='' then
    raise exception 'Select a class and attendance period.';
  end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>500 then
    raise exception 'The attendance register must contain between 1 and 500 students.';
  end if;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_student_id:=(v_item->>'student_id')::uuid;
    v_status:=coalesce(v_item->>'status','present');
    if v_status not in ('present','absent','late','approved_leave','excused') then raise exception 'Invalid student attendance status.'; end if;
    select s.full_name into v_student_name from public.students s
      where s.id=v_student_id and s.institution_id=p_institution_id and s.class_name=p_class_name and s.status='active';
    if v_student_name is null then raise exception 'A selected student is not active in this institution and class.'; end if;
    v_count:=v_count+1;
    if v_status='present' then v_present:=v_present+1; end if;
    if v_status='absent' then v_absent:=v_absent+1; end if;
    if v_status='late' then v_late:=v_late+1; end if;
  end loop;
  if (select count(distinct(value->>'student_id')) from jsonb_array_elements(p_rows))<>v_count then
    raise exception 'A student appears more than once in this attendance register.';
  end if;
  insert into public.attendance_registers(
    institution_id,campus_id,population,class_name,section_name,attendance_date,period_label,method,status,
    total_count,present_count,absent_count,late_count,created_by,published_by,published_at
  ) values(
    p_institution_id,p_campus_id,'student',p_class_name,nullif(p_section_name,''),p_attendance_date,
    p_period_label,'manual','saved',v_count,v_present,v_absent,v_late,(select auth.uid()),(select auth.uid()),now()
  ) returning id into v_register_id;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_student_id:=(v_item->>'student_id')::uuid;
    v_status:=coalesce(v_item->>'status','present');
    v_arrival:=nullif(v_item->>'arrival_time','')::time;
    v_departure:=nullif(v_item->>'departure_time','')::time;
    v_minutes_late:=case when v_status='late' and v_arrival is not null then greatest(0,extract(epoch from(v_arrival-p_late_after))/60)::integer else 0 end;
    v_early_minutes:=greatest(0,coalesce((v_item->>'early_departure_minutes')::integer,0));
    select s.full_name into v_student_name from public.students s where s.id=v_student_id and s.institution_id=p_institution_id;
    insert into public.attendance(
      institution_id,student_id,student_name,class_name,attendance_date,status,notes,created_by,period_label,
      register_id,campus_id,source,recorded_at,arrival_time,departure_time,minutes_late,early_departure_minutes
    ) values(
      p_institution_id,v_student_id,v_student_name,p_class_name,p_attendance_date,v_status,nullif(v_item->>'notes',''),
      (select auth.uid()),p_period_label,v_register_id,p_campus_id,'manual',now(),v_arrival,v_departure,v_minutes_late,v_early_minutes
    )
    on conflict(institution_id,student_id,attendance_date,period_label) where student_id is not null
    do update set student_name=excluded.student_name,class_name=excluded.class_name,status=excluded.status,notes=excluded.notes,
      register_id=excluded.register_id,campus_id=excluded.campus_id,arrival_time=excluded.arrival_time,departure_time=excluded.departure_time,
      minutes_late=excluded.minutes_late,early_departure_minutes=excluded.early_departure_minutes,
      correction_reason=nullif(v_item->>'correction_reason',''),corrected_by=(select auth.uid()),corrected_at=now(),updated_at=now();
  end loop;
  return jsonb_build_object('register_id',v_register_id,'total',v_count,'present',v_present,'absent',v_absent,'late',v_late);
end;
$$;

create or replace function public.save_employee_attendance_register(
  p_institution_id uuid,p_attendance_date date,p_population text,p_campus_id uuid,p_shift_id uuid,p_rows jsonb
)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_item jsonb; v_teacher_id uuid; v_status text; v_employee_type text;
  v_count integer:=0; v_present integer:=0; v_absent integer:=0; v_late integer:=0; v_register_id uuid;
  v_check_in time; v_check_out time; v_shift_start time; v_shift_end time; v_grace integer;
  v_late_minutes integer; v_early_minutes integer;
begin
  if p_population not in ('teacher','staff') then raise exception 'Invalid employee group.'; end if;
  if not public.has_institution_role(p_institution_id,array['owner','admin']) then
    raise exception 'Only an owner or administrator can record employee attendance.';
  end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>500 then
    raise exception 'The attendance register must contain between 1 and 500 employees.';
  end if;
  if p_shift_id is not null then
    select start_time,end_time,grace_minutes into v_shift_start,v_shift_end,v_grace
      from public.employee_shifts where id=p_shift_id and institution_id=p_institution_id and is_active;
    if not found then raise exception 'The selected shift is not available for this institution.'; end if;
  end if;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_teacher_id:=(v_item->>'teacher_id')::uuid;
    v_status:=coalesce(v_item->>'status','present');
    if v_status not in ('present','absent','late','approved_leave','excused','remote','half_day') then raise exception 'Invalid employee attendance status.'; end if;
    select t.employee_type into v_employee_type from public.teachers t
      where t.id=v_teacher_id and t.institution_id=p_institution_id and t.employment_status='active';
    if v_employee_type is null then raise exception 'An employee is not active in this institution.'; end if;
    if p_population='teacher' and lower(v_employee_type)<>'teaching' then raise exception 'A non-teaching employee was included in teacher attendance.'; end if;
    if p_population='staff' and lower(v_employee_type)='teaching' then raise exception 'A teacher was included in staff attendance.'; end if;
    v_count:=v_count+1;
    if v_status in ('present','late','remote') then v_present:=v_present+1; end if;
    if v_status='absent' then v_absent:=v_absent+1; end if;
    if v_status='late' then v_late:=v_late+1; end if;
  end loop;
  if (select count(distinct(value->>'teacher_id')) from jsonb_array_elements(p_rows))<>v_count then
    raise exception 'An employee appears more than once in this attendance register.';
  end if;
  insert into public.attendance_registers(
    institution_id,campus_id,population,class_name,attendance_date,period_label,method,status,
    total_count,present_count,absent_count,late_count,created_by,published_by,published_at
  ) values(
    p_institution_id,p_campus_id,'staff',case when p_population='teacher' then 'Teachers' else 'Staff' end,
    p_attendance_date,'Daily','manual','saved',v_count,v_present,v_absent,v_late,(select auth.uid()),(select auth.uid()),now()
  ) returning id into v_register_id;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_teacher_id:=(v_item->>'teacher_id')::uuid;
    v_status:=coalesce(v_item->>'status','present');
    v_check_in:=nullif(v_item->>'check_in_time','')::time;
    v_check_out:=nullif(v_item->>'check_out_time','')::time;
    v_late_minutes:=case when v_shift_start is not null and v_check_in is not null and v_check_in>(v_shift_start+make_interval(mins=>coalesce(v_grace,0)))
      then greatest(0,extract(epoch from(v_check_in-v_shift_start))/60-coalesce(v_grace,0))::integer else 0 end;
    v_early_minutes:=case when v_shift_end is not null and v_check_out is not null and v_check_out<v_shift_end
      then greatest(0,extract(epoch from(v_shift_end-v_check_out))/60)::integer else 0 end;
    insert into public.employee_attendance(
      institution_id,teacher_id,attendance_date,check_in_time,check_out_time,status,notes,recorded_by,
      register_id,source,campus_id,shift_id,minutes_late,early_departure_minutes
    ) values(
      p_institution_id,v_teacher_id,p_attendance_date,v_check_in,v_check_out,v_status,nullif(v_item->>'notes',''),
      (select auth.uid()),v_register_id,'manual',p_campus_id,p_shift_id,v_late_minutes,v_early_minutes
    )
    on conflict(institution_id,teacher_id,attendance_date) do update set
      check_in_time=excluded.check_in_time,check_out_time=excluded.check_out_time,status=excluded.status,notes=excluded.notes,
      recorded_by=(select auth.uid()),register_id=excluded.register_id,source='manual',campus_id=excluded.campus_id,
      shift_id=excluded.shift_id,minutes_late=excluded.minutes_late,early_departure_minutes=excluded.early_departure_minutes,updated_at=now();
  end loop;
  return jsonb_build_object('register_id',v_register_id,'population',p_population,'total',v_count,'present',v_present,'absent',v_absent,'late',v_late);
end;
$$;
revoke all on function public.save_student_attendance_register(uuid,date,text,text,uuid,text,jsonb,time) from public;
revoke all on function public.save_employee_attendance_register(uuid,date,text,uuid,uuid,jsonb) from public;
grant execute on function public.save_student_attendance_register(uuid,date,text,text,uuid,text,jsonb,time) to authenticated;
grant execute on function public.save_employee_attendance_register(uuid,date,text,uuid,uuid,jsonb) to authenticated;
