begin;
drop policy if exists campuses_admin_write on public.campuses;
create policy campuses_admin_insert on public.campuses for insert to authenticated with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy campuses_admin_update on public.campuses for update to authenticated using(public.has_institution_role(institution_id,array['owner','admin'])) with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy campuses_admin_delete on public.campuses for delete to authenticated using(public.has_institution_role(institution_id,array['owner','admin']));

drop policy if exists attendance_register_write on public.attendance_registers;
create policy attendance_register_insert on public.attendance_registers for insert to authenticated with check(public.has_institution_role(institution_id,array['owner','admin','teacher']));
create policy attendance_register_update on public.attendance_registers for update to authenticated using(public.has_institution_role(institution_id,array['owner','admin','teacher'])) with check(public.has_institution_role(institution_id,array['owner','admin','teacher']));
create policy attendance_register_delete on public.attendance_registers for delete to authenticated using(public.has_institution_role(institution_id,array['owner','admin']));

drop policy if exists class_coverage_admin_write on public.class_coverage_assignments;
create policy class_coverage_admin_insert on public.class_coverage_assignments for insert to authenticated with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy class_coverage_admin_update on public.class_coverage_assignments for update to authenticated using(public.has_institution_role(institution_id,array['owner','admin'])) with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy class_coverage_admin_delete on public.class_coverage_assignments for delete to authenticated using(public.has_institution_role(institution_id,array['owner','admin']));

drop policy if exists library_loans_staff_write on public.library_loans;
create policy library_loans_staff_insert on public.library_loans for insert to authenticated with check(public.has_institution_role(institution_id,array['owner','admin','teacher']));
create policy library_loans_staff_update on public.library_loans for update to authenticated using(public.has_institution_role(institution_id,array['owner','admin','teacher'])) with check(public.has_institution_role(institution_id,array['owner','admin','teacher']));
create policy library_loans_admin_delete on public.library_loans for delete to authenticated using(public.has_institution_role(institution_id,array['owner','admin']));

drop policy if exists inventory_movements_admin_write on public.inventory_movements;
create policy inventory_movements_admin_insert on public.inventory_movements for insert to authenticated with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy inventory_movements_admin_update on public.inventory_movements for update to authenticated using(public.has_institution_role(institution_id,array['owner','admin'])) with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy inventory_movements_admin_delete on public.inventory_movements for delete to authenticated using(public.has_institution_role(institution_id,array['owner','admin']));

drop policy if exists transport_allocations_admin_write on public.student_transport_allocations;
create policy transport_allocations_admin_insert on public.student_transport_allocations for insert to authenticated with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy transport_allocations_admin_update on public.student_transport_allocations for update to authenticated using(public.has_institution_role(institution_id,array['owner','admin'])) with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy transport_allocations_admin_delete on public.student_transport_allocations for delete to authenticated using(public.has_institution_role(institution_id,array['owner','admin']));

drop policy if exists payroll_items_write on public.payroll_items;
create policy payroll_items_finance_insert on public.payroll_items for insert to authenticated with check(public.has_institution_role(institution_id,array['owner','admin','accountant']));
create policy payroll_items_finance_update on public.payroll_items for update to authenticated using(public.has_institution_role(institution_id,array['owner','admin','accountant'])) with check(public.has_institution_role(institution_id,array['owner','admin','accountant']));
create policy payroll_items_admin_delete on public.payroll_items for delete to authenticated using(public.has_institution_role(institution_id,array['owner','admin']));

drop policy if exists institutional_records_select on public.institutional_records;
create policy institutional_records_select on public.institutional_records for select to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin'])
 or (public.has_institution_role(institution_id,array['teacher']) and module_key=any(array['academic_setup','employees','attendance','timetable','teaching','behaviour','communication','question_bank','examinations','tests','reports','certificates','curriculum','library','transport','facilities','visitors'])
   and (module_key<>'employees' or exists(select 1 from public.teachers t where t.id=institutional_records.teacher_id and t.institution_id=institutional_records.institution_id and t.user_id=(select auth.uid()))))
 or (public.has_institution_role(institution_id,array['accountant']) and module_key=any(array['finance','fees','receivables','payments','receipts','payroll','reconciliation','reports','inventory']))
 or (public.has_institution_role(institution_id,array['exam_officer']) and module_key=any(array['question_bank','examinations','tests','reports','communication']))
 or (public.has_institution_role(institution_id,array['student']) and visibility='student_portal' and (student_id is null or public.can_view_student(student_id)) and module_key=any(array['teaching','curriculum','library','certificates','communication']))
 or (public.has_institution_role(institution_id,array['parent']) and visibility in('student_portal','parent_portal') and (student_id is null or public.can_view_student(student_id)) and module_key=any(array['teaching','curriculum','library','transport','certificates','communication']))
);

create unique index if not exists employee_leave_requests_id_institution_uq on public.employee_leave_requests(id,institution_id);
alter table public.class_coverage_assignments drop constraint if exists class_coverage_leave_fk;
alter table public.class_coverage_assignments add constraint class_coverage_leave_institution_fk
 foreign key(leave_request_id,institution_id) references public.employee_leave_requests(id,institution_id) on delete set null (leave_request_id);

create index if not exists campuses_created_by_idx on public.campuses(created_by);
create index if not exists institutional_records_campus_fk_idx on public.institutional_records(campus_id,institution_id);
create index if not exists institutional_records_session_fk_idx on public.institutional_records(academic_session_id,institution_id);
create index if not exists institutional_records_parent_fk_idx on public.institutional_records(parent_record_id,institution_id);
create index if not exists institutional_records_created_by_idx on public.institutional_records(created_by);
create index if not exists institutional_records_updated_by_idx on public.institutional_records(updated_by);
create index if not exists institutional_records_reviewed_by_idx on public.institutional_records(reviewed_by);
create index if not exists institutional_audit_actor_idx on public.institutional_audit_events(actor_id);
create index if not exists attendance_registers_campus_fk_idx on public.attendance_registers(campus_id,institution_id);
create index if not exists attendance_registers_session_fk_idx on public.attendance_registers(academic_session_id,institution_id);
create index if not exists attendance_registers_created_by_idx on public.attendance_registers(created_by);
create index if not exists attendance_registers_published_by_idx on public.attendance_registers(published_by);
create index if not exists attendance_registers_id_institution_uq on public.attendance_registers(id,institution_id);
create index if not exists attendance_registers_by_id_idx on public.attendance(register_id);
create index if not exists attendance_created_by_idx on public.attendance(created_by);
create index if not exists attendance_campus_fk_idx on public.attendance(campus_id,institution_id);
create index if not exists attendance_session_fk_idx on public.attendance(academic_session_id,institution_id);
create index if not exists employee_attendance_register_idx on public.employee_attendance(register_id);
create index if not exists attendance_device_sources_created_by_idx on public.attendance_device_sources(created_by);
create index if not exists attendance_device_sources_institution_idx on public.attendance_device_sources(institution_id);
create index if not exists attendance_device_events_source_idx on public.attendance_device_events(source_id);
create index if not exists attendance_device_events_student_fk_idx on public.attendance_device_events(student_id,institution_id);
create index if not exists attendance_device_events_teacher_fk_idx on public.attendance_device_events(teacher_id,institution_id);
create index if not exists class_coverage_leave_fk_idx on public.class_coverage_assignments(leave_request_id,institution_id);
create index if not exists class_coverage_timetable_fk_idx on public.class_coverage_assignments(timetable_entry_id,institution_id);
create index if not exists class_coverage_original_teacher_fk_idx on public.class_coverage_assignments(original_teacher_id,institution_id);
create index if not exists class_coverage_sub_teacher_fk_idx on public.class_coverage_assignments(substitute_teacher_id,institution_id);
create index if not exists class_coverage_assigned_by_idx on public.class_coverage_assignments(assigned_by);
create index if not exists library_loans_book_fk_idx on public.library_loans(book_record_id,institution_id);
create index if not exists library_loans_student_fk_idx on public.library_loans(student_id,institution_id);
create index if not exists library_loans_issued_by_idx on public.library_loans(issued_by);
create index if not exists library_loans_received_by_idx on public.library_loans(received_by);
create index if not exists inventory_movements_item_fk_idx on public.inventory_movements(item_record_id,institution_id);
create index if not exists inventory_movements_recorded_by_idx on public.inventory_movements(recorded_by);
create index if not exists student_transport_route_fk_idx on public.student_transport_allocations(route_record_id,institution_id);
create index if not exists student_transport_stop_fk_idx on public.student_transport_allocations(stop_record_id,institution_id);
create index if not exists student_transport_vehicle_fk_idx on public.student_transport_allocations(vehicle_record_id,institution_id);
create index if not exists student_transport_created_by_idx on public.student_transport_allocations(created_by);
create index if not exists workflow_approvals_requested_by_idx on public.workflow_approvals(requested_by);
create index if not exists workflow_approvals_reviewed_by_idx on public.workflow_approvals(reviewed_by);
create index if not exists data_transfer_jobs_requested_by_idx on public.data_transfer_jobs(requested_by);
create index if not exists payroll_runs_created_by_idx on public.payroll_runs(created_by);
create index if not exists payroll_runs_approved_by_idx on public.payroll_runs(approved_by);
create index if not exists payroll_items_run_fk_idx on public.payroll_items(payroll_run_id,institution_id);
create index if not exists payroll_items_teacher_fk_idx on public.payroll_items(teacher_id,institution_id);
create index if not exists payroll_items_teacher_created_idx on public.payroll_items(teacher_id,created_at desc);
create index if not exists institution_settings_campus_fk_idx on public.institution_settings(campus_id,institution_id);
create index if not exists institution_settings_updated_by_idx on public.institution_settings(updated_by);
commit;