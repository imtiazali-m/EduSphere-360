-- EduSphere 360 institutional platform expansion.
-- Additive migration: preserves the existing student, faculty, fee and assessment records.
begin;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;

create table public.campuses(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 campus_code text,name text not null,address text,phone text,email text,is_headquarters boolean not null default false,
 is_active boolean not null default true,created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index campuses_id_institution_uq on public.campuses(id,institution_id);
create unique index campuses_name_institution_uq on public.campuses(institution_id,lower(btrim(name)));
create unique index campuses_code_institution_uq on public.campuses(institution_id,lower(btrim(campus_code))) where campus_code is not null and btrim(campus_code)<>'';

create unique index students_id_institution_uq on public.students(id,institution_id);
create unique index teachers_id_institution_uq on public.teachers(id,institution_id);
create unique index academic_sessions_id_institution_uq on public.academic_sessions(id,institution_id);
create unique index timetable_entries_id_institution_uq on public.timetable_entries(id,institution_id);

create table public.institutional_records(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 campus_id uuid,academic_session_id uuid,student_id uuid,teacher_id uuid,parent_record_id uuid,
 module_key text not null check(module_key in('ai','administration','academic_setup','students','employees','finance','fees','receivables','payments','receipts','payroll','attendance','timetable','teaching','behaviour','communication','question_bank','examinations','tests','reports','certificates','curriculum','library','transport','inventory','facilities','visitors','institution_config','reconciliation','backup')),
 record_type text not null,title text not null,reference_code text,description text,status text not null default 'draft',
 approval_status text not null default 'not_required' check(approval_status in('not_required','draft','pending','approved','rejected','withdrawn')),
 visibility text not null default 'staff_only' check(visibility in('staff_only','student_portal','parent_portal','institution_portal')),
 class_name text,record_date date,effective_date date,due_date date,completed_at timestamptz,
 amount numeric(14,2) check(amount is null or amount>=0),quantity numeric(14,3) check(quantity is null or quantity>=0),
 payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),
 created_by uuid references auth.users(id) on delete set null,updated_by uuid references auth.users(id) on delete set null,
 reviewed_by uuid references auth.users(id) on delete set null,reviewed_at timestamptz,review_notes text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint institutional_record_campus_fk foreign key(campus_id,institution_id) references public.campuses(id,institution_id) on delete restrict,
 constraint institutional_record_session_fk foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete restrict,
 constraint institutional_record_student_fk foreign key(student_id,institution_id) references public.students(id,institution_id) on delete restrict,
 constraint institutional_record_teacher_fk foreign key(teacher_id,institution_id) references public.teachers(id,institution_id) on delete restrict
);
create unique index institutional_records_id_institution_uq on public.institutional_records(id,institution_id);
alter table public.institutional_records add constraint institutional_records_parent_institution_fk foreign key(parent_record_id,institution_id) references public.institutional_records(id,institution_id) on delete restrict;
create unique index institutional_records_reference_uq on public.institutional_records(institution_id,module_key,record_type,lower(btrim(reference_code))) where reference_code is not null and btrim(reference_code)<>'';
create index institutional_records_module_activity_idx on public.institutional_records(institution_id,module_key,record_type,created_at desc);
create index institutional_records_status_due_idx on public.institutional_records(institution_id,module_key,status,due_date);
create index institutional_records_student_idx on public.institutional_records(institution_id,student_id,created_at desc) where student_id is not null;
create index institutional_records_teacher_idx on public.institutional_records(institution_id,teacher_id,created_at desc) where teacher_id is not null;

create table public.institutional_audit_events(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 record_id uuid not null,module_key text not null,record_type text not null,
 action text not null check(action in('insert','update','delete')),old_values jsonb,new_values jsonb,
 actor_id uuid references auth.users(id) on delete set null,occurred_at timestamptz not null default now()
);
create index institutional_audit_record_idx on public.institutional_audit_events(institution_id,record_id,occurred_at desc);
create index institutional_audit_module_idx on public.institutional_audit_events(institution_id,module_key,occurred_at desc);

create function private.audit_institutional_record() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_row public.institutional_records; v_old jsonb; v_new jsonb;
begin
 if tg_op='DELETE' then v_row:=old;v_old:=to_jsonb(old);v_new:=null;
 elsif tg_op='UPDATE' then v_row:=new;v_old:=to_jsonb(old);v_new:=to_jsonb(new);
 else v_row:=new;v_old:=null;v_new:=to_jsonb(new);end if;
 insert into public.institutional_audit_events(institution_id,record_id,module_key,record_type,action,old_values,new_values,actor_id)
 values(v_row.institution_id,v_row.id,v_row.module_key,v_row.record_type,lower(tg_op),v_old,v_new,auth.uid());
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.audit_institutional_record() from public,anon,authenticated;
create trigger institutional_records_audit after insert or update or delete on public.institutional_records for each row execute function private.audit_institutional_record();

create table public.attendance_registers(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 campus_id uuid,academic_session_id uuid,population text not null check(population in('student','staff')),
 class_name text,section_name text,attendance_date date not null,period_label text not null default 'Daily',
 method text not null default 'manual' check(method in('manual','csv_import','qr','rfid','biometric','api')),
 status text not null default 'draft' check(status in('draft','saved','published','locked')),
 total_count integer not null default 0 check(total_count>=0),present_count integer not null default 0 check(present_count>=0),
 absent_count integer not null default 0 check(absent_count>=0),late_count integer not null default 0 check(late_count>=0),
 notes text,created_by uuid references auth.users(id) on delete set null,published_by uuid references auth.users(id) on delete set null,
 published_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint attendance_register_campus_fk foreign key(campus_id,institution_id) references public.campuses(id,institution_id) on delete restrict,
 constraint attendance_register_session_fk foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete restrict,
 constraint attendance_register_student_class_check check(population<>'student' or nullif(btrim(class_name),'') is not null)
);
create unique index attendance_register_scope_uq on public.attendance_registers(institution_id,population,coalesce(class_name,''),attendance_date,period_label,coalesce(academic_session_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index attendance_register_date_idx on public.attendance_registers(institution_id,attendance_date desc,population);

alter table public.attendance add column period_label text not null default 'Daily';
alter table public.attendance add column register_id uuid;
alter table public.attendance add column campus_id uuid;
alter table public.attendance add column academic_session_id uuid;
alter table public.attendance add column source text not null default 'manual';
alter table public.attendance add column recorded_at timestamptz not null default now();
alter table public.attendance add constraint attendance_register_fk foreign key(register_id) references public.attendance_registers(id) on delete set null;
alter table public.attendance add constraint attendance_campus_institution_fk foreign key(campus_id,institution_id) references public.campuses(id,institution_id) on delete restrict;
alter table public.attendance add constraint attendance_session_institution_fk foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete restrict;
drop index public.attendance_one_student_per_day_compat_uidx;
create unique index attendance_unique_student_period_uq on public.attendance(institution_id,student_id,attendance_date,period_label) where student_id is not null;
create index attendance_register_idx on public.attendance(institution_id,register_id) where register_id is not null;
alter table public.employee_attendance add column register_id uuid;
alter table public.employee_attendance add column source text not null default 'manual';
alter table public.employee_attendance add constraint employee_attendance_register_fk foreign key(register_id) references public.attendance_registers(id) on delete set null;

create table public.attendance_device_sources(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 name text not null,provider_type text not null check(provider_type in('qr','rfid','biometric','third_party','csv')),
 status text not null default 'not_configured' check(status in('not_configured','active','paused','error')),
 external_device_id text,public_settings jsonb not null default '{}'::jsonb check(jsonb_typeof(public_settings)='object'),
 last_synced_at timestamptz,last_error text,created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.attendance_device_events(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 source_id uuid not null references public.attendance_device_sources(id) on delete cascade,external_event_id text not null,
 student_id uuid,teacher_id uuid,occurred_at timestamptz not null,event_kind text not null default 'check_in',
 processing_status text not null default 'received' check(processing_status in('received','matched','processed','duplicate','rejected','error')),
 raw_payload jsonb not null default '{}'::jsonb check(jsonb_typeof(raw_payload)='object'),processed_at timestamptz,error_message text,
 created_at timestamptz not null default now(),
 constraint attendance_device_student_fk foreign key(student_id,institution_id) references public.students(id,institution_id) on delete restrict,
 constraint attendance_device_teacher_fk foreign key(teacher_id,institution_id) references public.teachers(id,institution_id) on delete restrict,
 constraint attendance_device_one_person check(num_nonnulls(student_id,teacher_id)=1),
 constraint attendance_device_event_uq unique(institution_id,source_id,external_event_id)
);
create index attendance_device_queue_idx on public.attendance_device_events(institution_id,processing_status,occurred_at);

create table public.class_coverage_assignments(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 leave_request_id uuid,timetable_entry_id uuid not null,original_teacher_id uuid not null,substitute_teacher_id uuid,
 coverage_date date not null,period_label text not null,class_name text not null,subject text,
 status text not null default 'unassigned' check(status in('unassigned','assigned','published','completed','cancelled')),
 notes text,assigned_by uuid references auth.users(id) on delete set null,published_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint class_coverage_timetable_fk foreign key(timetable_entry_id,institution_id) references public.timetable_entries(id,institution_id) on delete restrict,
 constraint class_coverage_original_teacher_fk foreign key(original_teacher_id,institution_id) references public.teachers(id,institution_id) on delete restrict,
 constraint class_coverage_sub_teacher_fk foreign key(substitute_teacher_id,institution_id) references public.teachers(id,institution_id) on delete restrict
);
create unique index class_coverage_period_uq on public.class_coverage_assignments(institution_id,timetable_entry_id,coverage_date,period_label);
create index class_coverage_substitute_idx on public.class_coverage_assignments(institution_id,substitute_teacher_id,coverage_date);

create table public.library_loans(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 book_record_id uuid not null,student_id uuid,issued_at date not null default current_date,due_at date not null,returned_at date,
 status text not null default 'issued' check(status in('reserved','issued','returned','overdue','lost','cancelled')),
 fine_amount numeric(12,2) not null default 0 check(fine_amount>=0),notes text,
 issued_by uuid references auth.users(id) on delete set null,received_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint library_loan_book_fk foreign key(book_record_id,institution_id) references public.institutional_records(id,institution_id) on delete restrict,
 constraint library_loan_student_fk foreign key(student_id,institution_id) references public.students(id,institution_id) on delete restrict,
 constraint library_loan_due_check check(due_at>=issued_at),constraint library_loan_return_check check(returned_at is null or returned_at>=issued_at)
);
create index library_loans_student_idx on public.library_loans(institution_id,student_id,status,due_at);

create table public.inventory_movements(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 item_record_id uuid not null,movement_type text not null check(movement_type in('stock_in','stock_out','allocation','return','adjustment','write_off')),
 quantity numeric(14,3) not null check(quantity>0),unit_cost numeric(14,2) check(unit_cost is null or unit_cost>=0),
 movement_date date not null default current_date,reference_code text,notes text,
 recorded_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 constraint inventory_item_fk foreign key(item_record_id,institution_id) references public.institutional_records(id,institution_id) on delete restrict
);
create index inventory_movements_item_date_idx on public.inventory_movements(institution_id,item_record_id,movement_date desc);

create table public.student_transport_allocations(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 student_id uuid not null,route_record_id uuid not null,stop_record_id uuid,vehicle_record_id uuid,
 effective_from date not null default current_date,effective_to date,transport_fee numeric(12,2) not null default 0 check(transport_fee>=0),
 status text not null default 'active' check(status in('pending','active','suspended','completed','cancelled')),
 notes text,created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint transport_student_fk foreign key(student_id,institution_id) references public.students(id,institution_id) on delete restrict,
 constraint transport_route_fk foreign key(route_record_id,institution_id) references public.institutional_records(id,institution_id) on delete restrict,
 constraint transport_stop_fk foreign key(stop_record_id,institution_id) references public.institutional_records(id,institution_id) on delete restrict,
 constraint transport_vehicle_fk foreign key(vehicle_record_id,institution_id) references public.institutional_records(id,institution_id) on delete restrict,
 constraint transport_dates_check check(effective_to is null or effective_to>=effective_from)
);
create index transport_student_status_idx on public.student_transport_allocations(institution_id,student_id,status,effective_from desc);

create table public.workflow_approvals(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 workflow_key text not null,target_type text not null,target_id uuid not null,requested_by uuid references auth.users(id) on delete set null,
 requested_at timestamptz not null default now(),status text not null default 'pending' check(status in('pending','approved','rejected','withdrawn')),
 reviewed_by uuid references auth.users(id) on delete set null,reviewed_at timestamptz,decision_notes text,
 payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index workflow_approval_queue_idx on public.workflow_approvals(institution_id,status,requested_at desc);

create table public.data_transfer_jobs(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 job_type text not null check(job_type in('import','export','backup_request','restore_request','validation')),
 module_key text,file_name text,file_format text,
 status text not null default 'queued' check(status in('queued','validating','processing','completed','failed','cancelled','requires_platform_action')),
 total_rows integer not null default 0 check(total_rows>=0),successful_rows integer not null default 0 check(successful_rows>=0),
 rejected_rows integer not null default 0 check(rejected_rows>=0),storage_path text,error_summary text,
 details jsonb not null default '{}'::jsonb check(jsonb_typeof(details)='object'),
 requested_by uuid references auth.users(id) on delete set null,completed_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index data_transfer_history_idx on public.data_transfer_jobs(institution_id,job_type,created_at desc);

create table public.payroll_runs(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 period_start date not null,period_end date not null,pay_date date,
 status text not null default 'draft' check(status in('draft','review','approved','paid','cancelled')),
 notes text,created_by uuid references auth.users(id) on delete set null,approved_by uuid references auth.users(id) on delete set null,
 approved_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint payroll_run_period_check check(period_end>=period_start),constraint payroll_run_period_unique unique(institution_id,period_start,period_end)
);
create unique index payroll_runs_id_institution_uq on public.payroll_runs(id,institution_id);
create table public.payroll_items(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 payroll_run_id uuid not null,teacher_id uuid not null,base_salary numeric(14,2) not null default 0 check(base_salary>=0),
 allowances numeric(14,2) not null default 0 check(allowances>=0),deductions numeric(14,2) not null default 0 check(deductions>=0),
 advance_recovery numeric(14,2) not null default 0 check(advance_recovery>=0),gross_pay numeric(14,2) not null default 0 check(gross_pay>=0),
 net_pay numeric(14,2) not null default 0 check(net_pay>=0),payment_status text not null default 'unpaid' check(payment_status in('unpaid','pending','paid','held')),
 payslip_reference text,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint payroll_item_run_fk foreign key(payroll_run_id,institution_id) references public.payroll_runs(id,institution_id) on delete cascade,
 constraint payroll_item_employee_fk foreign key(teacher_id,institution_id) references public.teachers(id,institution_id) on delete restrict,
 constraint payroll_item_employee_uq unique(institution_id,payroll_run_id,teacher_id)
);
create index payroll_items_employee_idx on public.payroll_items(institution_id,teacher_id,created_at desc);

create table public.institution_settings(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,campus_id uuid,
 category text not null,setting_key text not null,setting_value jsonb not null default '{}'::jsonb,is_public boolean not null default false,
 updated_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint institution_setting_campus_fk foreign key(campus_id,institution_id) references public.campuses(id,institution_id) on delete cascade
);
create unique index institution_settings_global_uq on public.institution_settings(institution_id,category,setting_key) where campus_id is null;
create unique index institution_settings_campus_uq on public.institution_settings(institution_id,campus_id,category,setting_key) where campus_id is not null;

do $$ declare t text; begin
 foreach t in array array['campuses','institutional_records','institutional_audit_events','attendance_registers','attendance_device_sources','attendance_device_events','class_coverage_assignments','library_loans','inventory_movements','student_transport_allocations','workflow_approvals','data_transfer_jobs','payroll_runs','payroll_items','institution_settings'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;

create policy campuses_member_select on public.campuses for select to authenticated using(public.has_institution_role(institution_id,array['owner','admin','teacher','student','parent','accountant','exam_officer']));
create policy campuses_admin_write on public.campuses for all to authenticated using(public.has_institution_role(institution_id,array['owner','admin'])) with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy institutional_records_select on public.institutional_records for select to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin'])
 or (public.has_institution_role(institution_id,array['teacher']) and module_key=any(array['academic_setup','employees','attendance','timetable','teaching','behaviour','communication','question_bank','examinations','tests','reports','certificates','curriculum','library','transport','facilities','visitors']))
 or (public.has_institution_role(institution_id,array['accountant']) and module_key=any(array['finance','fees','receivables','payments','receipts','payroll','reconciliation','reports','inventory']))
 or (public.has_institution_role(institution_id,array['exam_officer']) and module_key=any(array['question_bank','examinations','tests','reports','communication']))
 or (public.has_institution_role(institution_id,array['student']) and visibility='student_portal' and (student_id is null or public.can_view_student(student_id)) and module_key=any(array['teaching','curriculum','library','certificates','communication']))
 or (public.has_institution_role(institution_id,array['parent']) and visibility in('student_portal','parent_portal') and (student_id is null or public.can_view_student(student_id)) and module_key=any(array['teaching','curriculum','library','transport','certificates','communication']))
);
create policy institutional_records_insert on public.institutional_records for insert to authenticated with check(
 created_by=(select auth.uid()) and (
 public.has_institution_role(institution_id,array['owner','admin'])
 or (public.has_institution_role(institution_id,array['teacher']) and module_key=any(array['academic_setup','attendance','timetable','teaching','behaviour','communication','question_bank','examinations','tests','curriculum','library','transport','facilities']))
 or (public.has_institution_role(institution_id,array['accountant']) and module_key=any(array['finance','fees','receivables','payments','receipts','payroll','reconciliation','inventory']))
 or (public.has_institution_role(institution_id,array['exam_officer']) and module_key=any(array['question_bank','examinations','tests','reports']))
));
create policy institutional_records_update on public.institutional_records for update to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin'])
 or (public.has_institution_role(institution_id,array['teacher']) and module_key=any(array['academic_setup','attendance','timetable','teaching','behaviour','communication','question_bank','examinations','tests','curriculum','library','transport','facilities']))
 or (public.has_institution_role(institution_id,array['accountant']) and module_key=any(array['finance','fees','receivables','payments','receipts','payroll','reconciliation','inventory']))
 or (public.has_institution_role(institution_id,array['exam_officer']) and module_key=any(array['question_bank','examinations','tests','reports']))
) with check(updated_by=(select auth.uid()) and (
 public.has_institution_role(institution_id,array['owner','admin'])
 or (public.has_institution_role(institution_id,array['teacher']) and module_key=any(array['academic_setup','attendance','timetable','teaching','behaviour','communication','question_bank','examinations','tests','curriculum','library','transport','facilities']))
 or (public.has_institution_role(institution_id,array['accountant']) and module_key=any(array['finance','fees','receivables','payments','receipts','payroll','reconciliation','inventory']))
 or (public.has_institution_role(institution_id,array['exam_officer']) and module_key=any(array['question_bank','examinations','tests','reports']))
));
create policy institutional_records_delete on public.institutional_records for delete to authenticated using(public.has_institution_role(institution_id,array['owner','admin']));
create policy institutional_audit_admin_read on public.institutional_audit_events for select to authenticated using(public.has_institution_role(institution_id,array['owner','admin']));
create policy attendance_register_read on public.attendance_registers for select to authenticated using(public.has_institution_role(institution_id,array['owner','admin','teacher','accountant','exam_officer']));
create policy attendance_register_write on public.attendance_registers for all to authenticated using(public.has_institution_role(institution_id,array['owner','admin','teacher'])) with check(public.has_institution_role(institution_id,array['owner','admin','teacher']));
create policy attendance_device_source_admin on public.attendance_device_sources for all to authenticated using(public.has_institution_role(institution_id,array['owner','admin'])) with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy attendance_device_events_admin_read on public.attendance_device_events for select to authenticated using(public.has_institution_role(institution_id,array['owner','admin','teacher']));
create policy class_coverage_staff_read on public.class_coverage_assignments for select to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin'])
 or exists(select 1 from public.teachers t where t.id=class_coverage_assignments.original_teacher_id and t.institution_id=class_coverage_assignments.institution_id and t.user_id=(select auth.uid()))
 or exists(select 1 from public.teachers t where t.id=class_coverage_assignments.substitute_teacher_id and t.institution_id=class_coverage_assignments.institution_id and t.user_id=(select auth.uid()))
);
create policy class_coverage_admin_write on public.class_coverage_assignments for all to authenticated using(public.has_institution_role(institution_id,array['owner','admin'])) with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy library_loans_read on public.library_loans for select to authenticated using(public.has_institution_role(institution_id,array['owner','admin','teacher']) or (student_id is not null and public.can_view_student(student_id)));
create policy library_loans_staff_write on public.library_loans for all to authenticated using(public.has_institution_role(institution_id,array['owner','admin','teacher'])) with check(public.has_institution_role(institution_id,array['owner','admin','teacher']));
create policy inventory_movements_read on public.inventory_movements for select to authenticated using(public.has_institution_role(institution_id,array['owner','admin','accountant']));
create policy inventory_movements_admin_write on public.inventory_movements for all to authenticated using(public.has_institution_role(institution_id,array['owner','admin'])) with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy transport_allocations_read on public.student_transport_allocations for select to authenticated using(public.has_institution_role(institution_id,array['owner','admin','teacher']) or public.can_view_student(student_id));
create policy transport_allocations_admin_write on public.student_transport_allocations for all to authenticated using(public.has_institution_role(institution_id,array['owner','admin'])) with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy workflow_approvals_read on public.workflow_approvals for select to authenticated using(public.has_institution_role(institution_id,array['owner','admin']) or requested_by=(select auth.uid()));
create policy workflow_approvals_insert on public.workflow_approvals for insert to authenticated with check(requested_by=(select auth.uid()) and public.has_institution_role(institution_id,array['owner','admin','teacher','accountant','exam_officer']));
create policy workflow_approvals_admin_update on public.workflow_approvals for update to authenticated using(public.has_institution_role(institution_id,array['owner','admin'])) with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy transfer_jobs_admin on public.data_transfer_jobs for all to authenticated using(public.has_institution_role(institution_id,array['owner','admin'])) with check(public.has_institution_role(institution_id,array['owner','admin']));
create policy payroll_runs_finance on public.payroll_runs for all to authenticated using(public.has_institution_role(institution_id,array['owner','admin','accountant'])) with check(public.has_institution_role(institution_id,array['owner','admin','accountant']));
create policy payroll_items_read on public.payroll_items for select to authenticated using(public.has_institution_role(institution_id,array['owner','admin','accountant']) or exists(select 1 from public.teachers t where t.id=payroll_items.teacher_id and t.institution_id=payroll_items.institution_id and t.user_id=(select auth.uid())));
create policy payroll_items_write on public.payroll_items for all to authenticated using(public.has_institution_role(institution_id,array['owner','admin','accountant'])) with check(public.has_institution_role(institution_id,array['owner','admin','accountant']));
create policy institution_settings_admin on public.institution_settings for all to authenticated using(public.has_institution_role(institution_id,array['owner','admin'])) with check(public.has_institution_role(institution_id,array['owner','admin']));
commit;