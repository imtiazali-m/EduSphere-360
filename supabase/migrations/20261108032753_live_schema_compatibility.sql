-- EduSphere 360 live-schema compatibility migration.
-- Additive only: preserves all existing institution, membership and business records.
-- Keeps legacy fee column names while providing aliases expected by the current app.
begin;

-- Application fields missing from the existing live database.
alter table public.students add column if not exists photo_path text;

alter table public.assignments
  add column if not exists section_name text,
  add column if not exists academic_session text,
  add column if not exists points numeric(8,2) not null default 100,
  add column if not exists attachment_url text,
  add column if not exists published_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='assignments_points_nonnegative_check' and conrelid='public.assignments'::regclass) then
    alter table public.assignments add constraint assignments_points_nonnegative_check check(points >= 0);
  end if;
end $$;
create index if not exists assignments_institution_due_idx on public.assignments(institution_id,due_date);

alter table public.exams
  add column if not exists exam_type text not null default 'other',
  add column if not exists academic_session text,
  add column if not exists term text,
  add column if not exists start_time time,
  add column if not exists duration_minutes integer,
  add column if not exists room text,
  add column if not exists invigilator text,
  add column if not exists instructions text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='exams_duration_minutes_positive_check' and conrelid='public.exams'::regclass) then
    alter table public.exams add constraint exams_duration_minutes_positive_check check(duration_minutes is null or duration_minutes > 0);
  end if;
end $$;

alter table public.exam_results
  add column if not exists exam_id uuid references public.exams(id) on delete set null,
  add column if not exists remarks text,
  add column if not exists result_status text not null default 'draft';
do $$ begin
  if not exists (select 1 from pg_constraint where conname='exam_results_result_status_check' and conrelid='public.exam_results'::regclass) then
    alter table public.exam_results add constraint exam_results_result_status_check check(result_status in ('draft','published'));
  end if;
end $$;
create index if not exists exams_institution_class_date_idx on public.exams(institution_id,class_name,exam_date);
create index if not exists exam_results_exam_student_idx on public.exam_results(exam_id,student_id);
create index if not exists exam_results_student_visibility_idx on public.exam_results(institution_id,student_id,result_status);

-- Add compatibility aliases; do not rename or drop existing live fee fields.
alter table public.fee_invoices add column if not exists invoice_no text;
alter table public.fee_payments
  add column if not exists receipt_no text,
  add column if not exists payment_reference text,
  add column if not exists notes text;
update public.fee_invoices
set invoice_no=coalesce(nullif(btrim(invoice_no),''),nullif(btrim(invoice_number),''),'INV-'||to_char(created_at,'YYYY')||'-'||upper(substr(replace(id::text,'-',''),1,8)))
where invoice_no is null or btrim(invoice_no)='';
update public.fee_invoices set invoice_number=invoice_no where invoice_number is null or btrim(invoice_number)='';
update public.fee_payments
set receipt_no=coalesce(nullif(btrim(receipt_no),''),nullif(btrim(receipt_number),'')),
    payment_reference=coalesce(payment_reference,transaction_reference),
    notes=coalesce(notes,remarks)
where receipt_no is null or btrim(receipt_no)='' or payment_reference is null or notes is null;
update public.fee_payments set receipt_number=receipt_no where receipt_number is null or btrim(receipt_number)='';
create unique index if not exists fee_invoices_institution_invoice_no_compat_uidx on public.fee_invoices(institution_id,invoice_no) where invoice_no is not null;
create unique index if not exists fee_payments_institution_receipt_no_compat_uidx on public.fee_payments(institution_id,receipt_no) where receipt_no is not null;
create index if not exists fee_payments_invoice_date_compat_idx on public.fee_payments(invoice_id,payment_date desc);

create or replace function public.sync_fee_invoice_compat_columns()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.invoice_no is null or btrim(new.invoice_no)='' then new.invoice_no:=nullif(btrim(new.invoice_number),''); end if;
  if new.invoice_no is null or btrim(new.invoice_no)='' then
    new.invoice_no:='INV-'||to_char(coalesce(new.created_at,now()),'YYYY')||'-'||upper(substr(replace(coalesce(new.id,gen_random_uuid())::text,'-',''),1,8));
  end if;
  new.invoice_number:=new.invoice_no;
  new.balance:=coalesce(new.amount,0)+coalesce(new.fine_amount,0)-coalesce(new.discount_amount,0)-coalesce(new.paid_amount,0);
  return new;
end $$;
drop trigger if exists sync_fee_invoice_compat_columns on public.fee_invoices;
create trigger sync_fee_invoice_compat_columns before insert or update on public.fee_invoices
for each row execute function public.sync_fee_invoice_compat_columns();

create or replace function public.sync_fee_payment_compat_columns()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.receipt_no is null or btrim(new.receipt_no)='' then new.receipt_no:=nullif(btrim(new.receipt_number),''); end if;
  if new.receipt_no is null or btrim(new.receipt_no)='' then
    new.receipt_no:='RCP-'||to_char(coalesce(new.payment_date,now()) at time zone 'Asia/Karachi','YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  end if;
  new.receipt_number:=new.receipt_no;
  new.payment_reference:=coalesce(nullif(btrim(new.payment_reference),''),nullif(btrim(new.transaction_reference),''));
  new.transaction_reference:=new.payment_reference;
  new.notes:=coalesce(nullif(btrim(new.notes),''),nullif(btrim(new.remarks),''));
  new.remarks:=new.notes;
  return new;
end $$;
drop trigger if exists sync_fee_payment_compat_columns on public.fee_payments;
create trigger sync_fee_payment_compat_columns before insert or update on public.fee_payments
for each row execute function public.sync_fee_payment_compat_columns();

-- Add the missing assignment-submission workflow with institution-scoped access.
create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  assignment_title text not null,
  student_name text not null,
  submission_text text not null,
  attachment_url text,
  submitted_at timestamptz not null default now(),
  status text not null default 'submitted' check(status in ('submitted','late','graded','returned')),
  marks_obtained numeric(8,2) check(marks_obtained is null or marks_obtained>=0),
  feedback text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(assignment_id,student_id),
  check(status<>'graded' or marks_obtained is not null)
);
create index if not exists assignment_submissions_institution_idx on public.assignment_submissions(institution_id,submitted_at desc);
create index if not exists assignment_submissions_student_idx on public.assignment_submissions(student_id,submitted_at desc);
create index if not exists assignment_submissions_assignment_idx on public.assignment_submissions(assignment_id,submitted_at desc);
grant select,insert,update,delete on public.assignment_submissions to authenticated;
alter table public.assignment_submissions enable row level security;
drop policy if exists "edu assignment submissions select" on public.assignment_submissions;
create policy "edu assignment submissions select" on public.assignment_submissions for select to authenticated
using(public.has_institution_role(institution_id,array['owner','admin','teacher']) or public.can_view_student(student_id));
drop policy if exists "edu assignment submissions insert" on public.assignment_submissions;
create policy "edu assignment submissions insert" on public.assignment_submissions for insert to authenticated
with check(
  public.has_institution_role(institution_id,array['owner','admin','teacher'])
  or exists(select 1 from public.students s where s.id=student_id and s.institution_id=assignment_submissions.institution_id and s.user_id=(select auth.uid()))
);
drop policy if exists "edu assignment submissions update" on public.assignment_submissions;
create policy "edu assignment submissions update" on public.assignment_submissions for update to authenticated
using(
  public.has_institution_role(institution_id,array['owner','admin','teacher'])
  or exists(select 1 from public.students s where s.id=student_id and s.institution_id=assignment_submissions.institution_id and s.user_id=(select auth.uid()))
)
with check(
  public.has_institution_role(institution_id,array['owner','admin','teacher'])
  or exists(select 1 from public.students s where s.id=student_id and s.institution_id=assignment_submissions.institution_id and s.user_id=(select auth.uid()))
);
drop policy if exists "edu assignment submissions delete" on public.assignment_submissions;
create policy "edu assignment submissions delete" on public.assignment_submissions for delete to authenticated
using(public.has_institution_role(institution_id,array['owner','admin']));

create or replace function public.guard_student_assignment_submission()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_ai uuid; v_ac text; v_as text; v_points numeric; v_title text; v_sc text; v_student_name text; v_staff boolean;
begin
  select institution_id,class_name,status,points,title into v_ai,v_ac,v_as,v_points,v_title from public.assignments where id=new.assignment_id;
  if v_ai is null or v_ai<>new.institution_id then raise exception 'The selected assignment must belong to this institution.'; end if;
  select class_name,full_name into v_sc,v_student_name from public.students where id=new.student_id and institution_id=new.institution_id;
  if v_sc is null then raise exception 'The selected student must belong to this institution.'; end if;
  if v_sc is distinct from v_ac then raise exception 'The selected student is not enrolled in the assignment class.'; end if;
  new.assignment_title:=v_title; new.student_name:=v_student_name;
  v_staff:=public.has_institution_role(new.institution_id,array['owner','admin','teacher']);
  if not v_staff then
    if auth.uid() is null or not exists(select 1 from public.students s where s.id=new.student_id and s.institution_id=new.institution_id and s.user_id=(select auth.uid())) then
      raise exception 'You may submit work only for your own linked student account.';
    end if;
    if v_as<>'open' then raise exception 'This assignment is closed and is no longer accepting submissions.'; end if;
    if tg_op='UPDATE' and (new.institution_id is distinct from old.institution_id or new.assignment_id is distinct from old.assignment_id or new.student_id is distinct from old.student_id or new.marks_obtained is distinct from old.marks_obtained or new.feedback is distinct from old.feedback or new.status not in ('submitted','late')) then
      raise exception 'Students may update submission content only; grading is reserved for teaching staff.';
    end if;
    if new.marks_obtained is not null or new.feedback is not null or new.status not in ('submitted','late') then
      raise exception 'Only teaching staff may grade or return an assignment.';
    end if;
  end if;
  if new.marks_obtained is not null and v_points is not null and new.marks_obtained>v_points then raise exception 'Marks awarded cannot exceed the assignment maximum.'; end if;
  if new.status='graded' and new.marks_obtained is null then raise exception 'Enter marks before marking this assignment as graded.'; end if;
  return new;
end $$;
drop trigger if exists guard_student_assignment_submission on public.assignment_submissions;
create trigger guard_student_assignment_submission before insert or update on public.assignment_submissions
for each row execute function public.guard_student_assignment_submission();

-- Attendance: unique student/day and trusted student/class display fields.
do $$ begin
  if exists(select 1 from public.attendance where student_id is not null group by institution_id,student_id,attendance_date having count(*)>1) then
    raise exception 'Cannot add daily attendance uniqueness: duplicate student/date rows already exist.';
  end if;
end $$;
create unique index if not exists attendance_one_student_per_day_compat_uidx
on public.attendance(institution_id,student_id,attendance_date) where student_id is not null;
create or replace function public.sync_attendance_student_snapshot()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_institution uuid; v_name text; v_class text;
begin
  if new.student_id is null then
    if tg_op='INSERT' then raise exception 'Choose a student before recording attendance.'; end if;
    return new;
  end if;
  select institution_id,full_name,class_name into v_institution,v_name,v_class from public.students where id=new.student_id;
  if v_institution is null or v_institution<>new.institution_id then raise exception 'The attendance student must belong to this institution.'; end if;
  new.student_name:=v_name; new.class_name:=v_class;
  return new;
end $$;
drop trigger if exists sync_attendance_student_snapshot on public.attendance;
create trigger sync_attendance_student_snapshot before insert or update on public.attendance
for each row execute function public.sync_attendance_student_snapshot();

-- Results: enforce exam/student/class consistency and prevent duplicate results.
do $$ begin
  if exists(select 1 from public.exam_results where exam_id is not null group by institution_id,exam_id,student_id having count(*)>1) then
    raise exception 'Cannot add exam result uniqueness: duplicate exam/student results already exist.';
  end if;
end $$;
create unique index if not exists exam_results_one_student_per_exam_compat_uidx
on public.exam_results(institution_id,exam_id,student_id) where exam_id is not null;
create or replace function public.enforce_exam_result_relationships()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_ei uuid; v_ec text; v_et text; v_es text; v_total numeric; v_si uuid; v_sc text; v_sn text;
begin
  if new.exam_id is null then
    if tg_op='INSERT' then raise exception 'Select an examination before saving a new result.'; end if;
    return new;
  end if;
  select institution_id,class_name,title,subject,total_marks into v_ei,v_ec,v_et,v_es,v_total from public.exams where id=new.exam_id;
  if v_ei is null or v_ei<>new.institution_id then raise exception 'The selected examination must belong to this institution.'; end if;
  select institution_id,class_name,full_name into v_si,v_sc,v_sn from public.students where id=new.student_id;
  if v_si is null or v_si<>new.institution_id then raise exception 'The selected student must belong to this institution.'; end if;
  if v_sc is distinct from v_ec then raise exception 'The student is not enrolled in the class scheduled for this examination.'; end if;
  if v_total is null or v_total<=0 or new.marks_obtained<0 or new.marks_obtained>v_total then raise exception 'Marks must be between zero and the examination total.'; end if;
  new.student_name:=v_sn; new.exam_title:=v_et; new.subject:=v_es; new.total_marks:=v_total;
  return new;
end $$;
drop trigger if exists exam_result_relationship_guard on public.exam_results;
create trigger exam_result_relationship_guard before insert or update on public.exam_results
for each row execute function public.enforce_exam_result_relationships();
drop policy if exists "authorized users can view exam results" on public.exam_results;
create policy "authorized users can view exam results" on public.exam_results for select to authenticated
using(public.has_institution_role(institution_id,array['owner','admin','teacher','exam_officer']) or (result_status='published' and public.can_view_student(student_id)));

-- Timetable conflicts are blocked at database level, including concurrent writes.
create or replace function public.guard_timetable_overlap()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.start_time is null or new.end_time is null or new.end_time<=new.start_time then
    raise exception 'A timetable entry requires a valid start and end time.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('edusphere-timetable:'||new.institution_id::text,0));
  if exists(select 1 from public.timetable_entries t where t.institution_id=new.institution_id and t.id<>new.id and t.weekday=new.weekday and t.start_time<new.end_time and t.end_time>new.start_time and (t.class_name=new.class_name or (nullif(btrim(new.teacher_name),'') is not null and t.teacher_name=new.teacher_name) or (nullif(btrim(new.room),'') is not null and t.room=new.room))) then
    raise exception 'This timetable slot overlaps an existing class, teacher or room booking.';
  end if;
  return new;
end $$;
drop trigger if exists timetable_overlap_guard on public.timetable_entries;
create trigger timetable_overlap_guard before insert or update on public.timetable_entries
for each row execute function public.guard_timetable_overlap();

-- Reconcile the app's payment RPC with the live fee_payments column names.
create or replace function public.record_fee_payment(
  p_invoice_id uuid,p_amount numeric,p_payment_method text,
  p_payment_reference text default null,p_payment_date date default current_date,p_notes text default null
)
returns table(payment_id uuid,receipt_no text,invoice_id uuid,paid_amount numeric,balance numeric,invoice_status text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_invoice public.fee_invoices%rowtype; v_payment_id uuid; v_receipt text; v_paid numeric(12,2); v_total numeric(12,2); v_balance numeric(12,2); v_status text; v_date date; v_today date;
begin
  if auth.uid() is null then raise exception 'Authentication is required to record a payment.'; end if;
  if p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount then raise exception 'Enter a positive payment amount with at most two decimal places.'; end if;
  if p_payment_method not in ('cash','bank_transfer','card','online','cheque','other') then raise exception 'Select a valid payment method.'; end if;
  v_today:=(now() at time zone 'Asia/Karachi')::date; v_date:=coalesce(p_payment_date,v_today);
  if v_date>v_today then raise exception 'A fee payment date cannot be in the future.'; end if;
  select * into v_invoice from public.fee_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Invoice not found.'; end if;
  if not public.has_institution_role(v_invoice.institution_id,array['owner','admin','accountant']) then raise exception 'You do not have permission to record fee payments.'; end if;
  v_total:=coalesce(v_invoice.amount,0)+coalesce(v_invoice.fine_amount,0)-coalesce(v_invoice.discount_amount,0);
  v_balance:=v_total-coalesce(v_invoice.paid_amount,0);
  if v_balance<0 then raise exception 'This invoice has an invalid negative balance. Review it before collecting another payment.'; end if;
  if p_amount>v_balance then raise exception 'Payment exceeds the outstanding balance of %.',v_balance; end if;
  v_paid:=coalesce(v_invoice.paid_amount,0)+p_amount; v_balance:=v_total-v_paid;
  if v_balance<=0 then v_status:='paid'; elsif v_invoice.due_date is not null and v_invoice.due_date<v_today then v_status:='overdue'; elsif v_paid>0 then v_status:='partial'; else v_status:='unpaid'; end if;
  v_receipt:='RCP-'||to_char(v_date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.fee_payments(institution_id,invoice_id,receipt_number,receipt_no,payment_date,amount,payment_method,transaction_reference,payment_reference,status,remarks,notes,received_by)
  values(v_invoice.institution_id,v_invoice.id,v_receipt,v_receipt,v_date::timestamp at time zone 'Asia/Karachi',p_amount,p_payment_method,nullif(btrim(p_payment_reference),''),nullif(btrim(p_payment_reference),''),'completed',nullif(btrim(p_notes),''),nullif(btrim(p_notes),''),auth.uid())
  returning id into v_payment_id;
  insert into public.fee_payment_allocations(institution_id,payment_id,invoice_id,amount) values(v_invoice.institution_id,v_payment_id,v_invoice.id,p_amount);
  insert into public.fee_audit_logs(institution_id,record_type,record_id,action,details,performed_by)
  values(v_invoice.institution_id,'payment',v_payment_id,'payment_recorded',jsonb_build_object('invoice_id',v_invoice.id,'amount',p_amount,'receipt',v_receipt),auth.uid());
  update public.fee_invoices set paid_amount=v_paid,status=v_status,updated_at=now() where id=v_invoice.id;
  return query select v_payment_id,v_receipt,v_invoice.id,v_paid,v_balance,v_status;
end $$;

-- Restrict payments to the atomic RPC; RLS remains enabled for reads.
revoke all on public.fee_payments from anon;
revoke insert,update,delete on public.fee_payments from authenticated;
grant select on public.fee_payments to authenticated;

-- Helper functions used by RLS remain available only to signed-in users.
revoke all on function public.can_view_class(uuid,text) from public,anon;
revoke all on function public.can_view_student(uuid) from public,anon;
revoke all on function public.has_institution_role(uuid,text[]) from public,anon;
revoke all on function public.is_admin_for_user(uuid) from public,anon;
revoke all on function public.is_institution_member(uuid) from public,anon;
grant execute on function public.can_view_class(uuid,text) to authenticated;
grant execute on function public.can_view_student(uuid) to authenticated;
grant execute on function public.has_institution_role(uuid,text[]) to authenticated;
grant execute on function public.is_admin_for_user(uuid) to authenticated;
grant execute on function public.is_institution_member(uuid) to authenticated;

-- Trigger functions are callable only through their attached triggers.
revoke all on function public.enforce_student_institution() from public,anon,authenticated;
revoke all on function public.guard_work_task_assignment() from public,anon,authenticated;
revoke all on function public.sync_fee_invoice_compat_columns() from public,anon,authenticated;
revoke all on function public.sync_fee_payment_compat_columns() from public,anon,authenticated;
revoke all on function public.guard_student_assignment_submission() from public,anon,authenticated;
revoke all on function public.sync_attendance_student_snapshot() from public,anon,authenticated;
revoke all on function public.enforce_exam_result_relationships() from public,anon,authenticated;
revoke all on function public.guard_timetable_overlap() from public,anon,authenticated;

-- Payment collection RPC is restricted to authenticated finance roles by its own checks.
revoke all on function public.record_fee_payment(uuid,numeric,text,text,date,text) from public,anon;
grant execute on function public.record_fee_payment(uuid,numeric,text,text,date,text) to authenticated;
revoke all on function public.record_fee_payment(uuid,numeric,text,text,text,text,text) from public,anon;
grant execute on function public.record_fee_payment(uuid,numeric,text,text,text,text,text) to authenticated;

commit;
