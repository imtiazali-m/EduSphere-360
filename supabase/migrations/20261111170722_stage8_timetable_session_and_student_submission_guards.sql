create or replace function public.prevent_academic_timetable_conflicts()
returns trigger language plpgsql security definer set search_path=public as $function$
declare conflict_reason text;
begin
 if new.start_time is null or new.end_time is null then return new; end if;
 if new.end_time<=new.start_time then
  raise exception 'The timetable period end must be later than its start.' using errcode='23514';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(new.institution_id::text||':'||coalesce(new.academic_session_id::text,'all')||':'||lower(new.weekday),0));
 select case when e.class_name=new.class_name then 'class'
  when nullif(trim(e.teacher_name),'') is not null and lower(trim(e.teacher_name))=lower(trim(new.teacher_name)) then 'teacher'
  when nullif(trim(e.room),'') is not null and lower(trim(e.room))=lower(trim(new.room)) then 'room' end
 into conflict_reason
 from public.timetable_entries e
 where e.institution_id=new.institution_id
  and lower(e.weekday)=lower(new.weekday)
  and e.id is distinct from new.id
  and e.start_time is not null and e.end_time is not null
  and (e.academic_session_id is not distinct from new.academic_session_id
       or e.academic_session_id is null or new.academic_session_id is null)
  and new.start_time<e.end_time and new.end_time>e.start_time
  and (
    e.class_name=new.class_name
    or (nullif(trim(e.teacher_name),'') is not null and nullif(trim(new.teacher_name),'') is not null and lower(trim(e.teacher_name))=lower(trim(new.teacher_name)))
    or (nullif(trim(e.room),'') is not null and nullif(trim(new.room),'') is not null and lower(trim(e.room))=lower(trim(new.room)))
  )
 limit 1;
 if conflict_reason is not null then
  raise exception 'Timetable conflict: this % is already assigned during the selected period in this academic session.',conflict_reason using errcode='23P01';
 end if;
 return new;
end;
$function$;

create or replace function public.protect_student_assignment_submission()
returns trigger language plpgsql security invoker set search_path=public as $function$
begin
 if has_institution_role(new.institution_id,array['student']) then
  if new.student_id is distinct from old.student_id
    or new.assignment_id is distinct from old.assignment_id
    or new.assignment_title is distinct from old.assignment_title
    or new.student_name is distinct from old.student_name
    or new.created_by is distinct from old.created_by
    or new.marks_obtained is distinct from old.marks_obtained
    or new.feedback is distinct from old.feedback
    or new.status not in ('submitted','late') then
    raise exception 'Students may update their submission content only. Marks, feedback and review status are controlled by the teacher.'
      using errcode='42501';
  end if;
 end if;
 return new;
end;
$function$;

drop trigger if exists protect_student_assignment_submission on public.assignment_submissions;
create trigger protect_student_assignment_submission
before update on public.assignment_submissions
for each row execute function public.protect_student_assignment_submission();
