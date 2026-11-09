begin;

create or replace function private.audit_student_attendance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_student uuid;
  v_institution uuid;
  v_old jsonb;
  v_new jsonb;
  v_event text;
  v_summary text;
  v_date text;
  v_status text;
begin
  v_student := case when tg_op = 'DELETE' then old.student_id else new.student_id end;
  v_institution := case when tg_op = 'DELETE' then old.institution_id else new.institution_id end;
  if v_student is null then return case when tg_op = 'DELETE' then old else new end; end if;
  if tg_op = 'DELETE' then
    v_event := 'attendance_removed';
    v_date := coalesce(old.attendance_date::text, '');
    v_status := coalesce(old.status, 'unknown');
    v_summary := 'Attendance record removed for ' || v_date;
    v_old := jsonb_build_object('attendance_date',old.attendance_date,'status',old.status,'class_name',old.class_name,'notes',old.notes);
  elsif tg_op = 'INSERT' then
    v_event := 'attendance_recorded';
    v_date := coalesce(new.attendance_date::text, '');
    v_status := coalesce(new.status, 'unknown');
    v_summary := 'Attendance marked ' || replace(v_status,'_',' ') || ' for ' || v_date;
    v_new := jsonb_build_object('attendance_date',new.attendance_date,'status',new.status,'class_name',new.class_name,'notes',new.notes);
  else
    v_event := 'attendance_updated';
    v_date := coalesce(new.attendance_date::text, '');
    v_status := coalesce(new.status, 'unknown');
    v_summary := 'Attendance updated to ' || replace(v_status,'_',' ') || ' for ' || v_date;
    v_old := jsonb_build_object('attendance_date',old.attendance_date,'status',old.status,'class_name',old.class_name,'notes',old.notes);
    v_new := jsonb_build_object('attendance_date',new.attendance_date,'status',new.status,'class_name',new.class_name,'notes',new.notes);
  end if;
  insert into public.student_history(institution_id,student_id,event_type,summary,old_values,new_values,created_by)
  values(v_institution,v_student,v_event,v_summary,v_old,v_new,auth.uid());
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.audit_student_attendance() from public, anon, authenticated;
drop trigger if exists attendance_student_history_audit on public.attendance;
create trigger attendance_student_history_audit
after insert or update or delete on public.attendance
for each row execute function private.audit_student_attendance();

create or replace function private.audit_student_exam_result()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_student uuid;
  v_institution uuid;
  v_event text;
  v_summary text;
  v_old jsonb;
  v_new jsonb;
begin
  v_student := case when tg_op = 'DELETE' then old.student_id else new.student_id end;
  v_institution := case when tg_op = 'DELETE' then old.institution_id else new.institution_id end;
  if v_student is null then return case when tg_op = 'DELETE' then old else new end; end if;
  if tg_op = 'DELETE' then
    if coalesce(old.result_status,'draft') <> 'published' then return old; end if;
    v_event := 'published_exam_result_removed';
    v_summary := 'Published examination result removed: ' || coalesce(old.exam_title,'Examination');
    v_old := jsonb_build_object('exam_title',old.exam_title,'subject',old.subject,'marks_obtained',old.marks_obtained,'total_marks',old.total_marks,'grade',old.grade,'result_status',old.result_status);
  elsif tg_op = 'INSERT' then
    if coalesce(new.result_status,'draft') <> 'published' then return new; end if;
    v_event := 'exam_result_published';
    v_summary := 'Examination result published: ' || coalesce(new.exam_title,'Examination');
    v_new := jsonb_build_object('exam_title',new.exam_title,'subject',new.subject,'marks_obtained',new.marks_obtained,'total_marks',new.total_marks,'grade',new.grade,'result_status',new.result_status);
  else
    if coalesce(old.result_status,'draft') <> 'published' and coalesce(new.result_status,'draft') <> 'published' then return new; end if;
    if coalesce(old.result_status,'draft') <> 'published' and coalesce(new.result_status,'draft') = 'published' then
      v_event := 'exam_result_published';
      v_summary := 'Examination result published: ' || coalesce(new.exam_title,'Examination');
    elsif coalesce(old.result_status,'draft') = 'published' and coalesce(new.result_status,'draft') = 'published' then
      v_event := 'published_exam_result_updated';
      v_summary := 'Published examination result updated: ' || coalesce(new.exam_title,'Examination');
    else
      v_event := 'exam_result_unpublished';
      v_summary := 'Examination result is no longer published: ' || coalesce(old.exam_title,'Examination');
    end if;
    v_old := jsonb_build_object('exam_title',old.exam_title,'subject',old.subject,'marks_obtained',old.marks_obtained,'total_marks',old.total_marks,'grade',old.grade,'result_status',old.result_status);
    v_new := jsonb_build_object('exam_title',new.exam_title,'subject',new.subject,'marks_obtained',new.marks_obtained,'total_marks',new.total_marks,'grade',new.grade,'result_status',new.result_status);
  end if;
  insert into public.student_history(institution_id,student_id,event_type,summary,old_values,new_values,created_by)
  values(v_institution,v_student,v_event,v_summary,v_old,v_new,auth.uid());
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.audit_student_exam_result() from public, anon, authenticated;
drop trigger if exists exam_results_student_history_audit on public.exam_results;
create trigger exam_results_student_history_audit
after insert or update or delete on public.exam_results
for each row execute function private.audit_student_exam_result();

create or replace function private.audit_student_assignment_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_student uuid;
  v_institution uuid;
  v_event text;
  v_summary text;
  v_old jsonb;
  v_new jsonb;
begin
  v_student := case when tg_op = 'DELETE' then old.student_id else new.student_id end;
  v_institution := case when tg_op = 'DELETE' then old.institution_id else new.institution_id end;
  if v_student is null then return case when tg_op = 'DELETE' then old else new end; end if;
  if tg_op = 'DELETE' then
    v_event := 'assignment_submission_removed';
    v_summary := 'Assignment submission removed: ' || coalesce(old.assignment_title,'Assignment');
    v_old := jsonb_build_object('assignment_title',old.assignment_title,'submitted_at',old.submitted_at,'status',old.status,'marks_obtained',old.marks_obtained,'feedback',old.feedback);
  elsif tg_op = 'INSERT' then
    v_event := 'assignment_submitted';
    v_summary := 'Assignment submitted: ' || coalesce(new.assignment_title,'Assignment');
    v_new := jsonb_build_object('assignment_title',new.assignment_title,'submitted_at',new.submitted_at,'status',new.status);
  else
    v_event := 'assignment_submission_updated';
    v_summary := 'Assignment submission updated: ' || coalesce(new.assignment_title,'Assignment');
    v_old := jsonb_build_object('assignment_title',old.assignment_title,'submitted_at',old.submitted_at,'status',old.status,'marks_obtained',old.marks_obtained,'feedback',old.feedback);
    v_new := jsonb_build_object('assignment_title',new.assignment_title,'submitted_at',new.submitted_at,'status',new.status,'marks_obtained',new.marks_obtained,'feedback',new.feedback);
  end if;
  insert into public.student_history(institution_id,student_id,event_type,summary,old_values,new_values,created_by)
  values(v_institution,v_student,v_event,v_summary,v_old,v_new,auth.uid());
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.audit_student_assignment_submission() from public, anon, authenticated;
drop trigger if exists assignment_submissions_student_history_audit on public.assignment_submissions;
create trigger assignment_submissions_student_history_audit
after insert or update or delete on public.assignment_submissions
for each row execute function private.audit_student_assignment_submission();

commit;
