drop index if exists public.attendance_record_scope_unique;
drop index if exists public.employee_attendance_scope_unique;

drop policy if exists stage7_employee_shifts_admin_write on public.employee_shifts;
create policy stage7_employee_shifts_admin_insert on public.employee_shifts for insert to authenticated
with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy stage7_employee_shifts_admin_update on public.employee_shifts for update to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']))
with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy stage7_employee_shifts_admin_delete on public.employee_shifts for delete to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']));

drop policy if exists stage7_leave_balances_admin_write on public.leave_balances;
create policy stage7_leave_balances_admin_insert on public.leave_balances for insert to authenticated
with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy stage7_leave_balances_admin_update on public.leave_balances for update to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']))
with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy stage7_leave_balances_admin_delete on public.leave_balances for delete to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']));

drop policy if exists stage7_care_access_admin_write on public.student_care_access;
create policy stage7_care_access_admin_insert on public.student_care_access for insert to authenticated
with check(
  public.has_institution_role(institution_id,array['owner','admin'])
  and granted_by=(select auth.uid())
  and exists(select 1 from public.memberships m where m.institution_id=student_care_access.institution_id and m.user_id=student_care_access.user_id and m.status='active' and m.role in ('teacher','admin','owner'))
);
create policy stage7_care_access_admin_update on public.student_care_access for update to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']))
with check(
  public.has_institution_role(institution_id,array['owner','admin'])
  and exists(select 1 from public.memberships m where m.institution_id=student_care_access.institution_id and m.user_id=student_care_access.user_id and m.status='active' and m.role in ('teacher','admin','owner'))
);
create policy stage7_care_access_admin_delete on public.student_care_access for delete to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']));

drop policy if exists stage7_discipline_communications_write on public.student_discipline_communications;
create policy stage7_discipline_communications_insert on public.student_discipline_communications for insert to authenticated
with check(created_by=(select auth.uid()) and (
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_discipline_communications.institution_id and a.user_id=(select auth.uid()) and a.area='discipline' and a.can_write)
));
create policy stage7_discipline_communications_update on public.student_discipline_communications for update to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_discipline_communications.institution_id and a.user_id=(select auth.uid()) and a.area='discipline' and a.can_write))
with check(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_discipline_communications.institution_id and a.user_id=(select auth.uid()) and a.area='discipline' and a.can_write));
create policy stage7_discipline_communications_delete on public.student_discipline_communications for delete to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_discipline_communications.institution_id and a.user_id=(select auth.uid()) and a.area='discipline' and a.can_write));

drop policy if exists stage7_counselling_notes_write on public.student_counselling_notes;
create policy stage7_counselling_notes_insert on public.student_counselling_notes for insert to authenticated
with check(created_by=(select auth.uid()) and (
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_counselling_notes.institution_id and a.user_id=(select auth.uid()) and a.area='counselling' and a.can_write)
));
create policy stage7_counselling_notes_update on public.student_counselling_notes for update to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_counselling_notes.institution_id and a.user_id=(select auth.uid()) and a.area='counselling' and a.can_write))
with check(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_counselling_notes.institution_id and a.user_id=(select auth.uid()) and a.area='counselling' and a.can_write));
create policy stage7_counselling_notes_delete on public.student_counselling_notes for delete to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_counselling_notes.institution_id and a.user_id=(select auth.uid()) and a.area='counselling' and a.can_write));

drop policy if exists stage7_emergency_contacts_write on public.student_emergency_contacts;
create policy stage7_emergency_contacts_insert on public.student_emergency_contacts for insert to authenticated
with check(created_by=(select auth.uid()) and (
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_emergency_contacts.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write)
));
create policy stage7_emergency_contacts_update on public.student_emergency_contacts for update to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_emergency_contacts.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write))
with check(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_emergency_contacts.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write));
create policy stage7_emergency_contacts_delete on public.student_emergency_contacts for delete to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_emergency_contacts.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write));

drop policy if exists stage7_health_records_write on public.student_health_records;
create policy stage7_health_records_insert on public.student_health_records for insert to authenticated
with check(created_by=(select auth.uid()) and (
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_health_records.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write)
));
create policy stage7_health_records_update on public.student_health_records for update to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_health_records.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write))
with check(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_health_records.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write));
create policy stage7_health_records_delete on public.student_health_records for delete to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_health_records.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write));

drop policy if exists stage7_health_incidents_write on public.student_health_incidents;
create policy stage7_health_incidents_insert on public.student_health_incidents for insert to authenticated
with check(created_by=(select auth.uid()) and (
  public.has_institution_role(institution_id,array['owner','admin'])
  or exists(select 1 from public.student_care_access a where a.institution_id=student_health_incidents.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write)
));
create policy stage7_health_incidents_update on public.student_health_incidents for update to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_health_incidents.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write))
with check(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_health_incidents.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write));
create policy stage7_health_incidents_delete on public.student_health_incidents for delete to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']) or
  exists(select 1 from public.student_care_access a where a.institution_id=student_health_incidents.institution_id and a.user_id=(select auth.uid()) and a.area='health' and a.can_write));
