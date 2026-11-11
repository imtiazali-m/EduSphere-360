-- Stage 9: automatic grading, mark correction audit and result approval.
create or replace function public.set_exam_result_grade()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_grade text;
begin
 if new.is_absent then new.grade:='Absent';return new;end if;
 select b.grade_label into v_grade from public.examination_grade_bands b
  where b.institution_id=new.institution_id and new.total_marks>0
   and (new.marks_obtained/new.total_marks*100) between b.min_percentage and b.max_percentage
  order by b.sort_order,b.min_percentage desc limit 1;
 if v_grade is not null then new.grade:=v_grade;end if;
 return new;
end;
$function$;
drop trigger if exists set_exam_result_grade on public.exam_results;
create trigger set_exam_result_grade before insert or update of marks_obtained,total_marks,is_absent,institution_id
 on public.exam_results for each row execute function public.set_exam_result_grade();

create or replace function public.audit_exam_result_marks()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 if old.marks_obtained is distinct from new.marks_obtained or old.is_absent is distinct from new.is_absent
  or old.remarks is distinct from new.remarks or old.grade is distinct from new.grade then
  insert into public.examination_mark_history(institution_id,exam_result_id,actor_id,change_reason,before_record,after_record)
   values(new.institution_id,new.id,auth.uid(),new.correction_reason,to_jsonb(old),to_jsonb(new));
 end if;
 return new;
end;
$function$;
drop trigger if exists audit_exam_result_marks on public.exam_results;
create trigger audit_exam_result_marks after update on public.exam_results for each row execute function public.audit_exam_result_marks();

create or replace function public.guard_exam_result_workflow()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 if (new.result_status is distinct from old.result_status or new.approval_status is distinct from old.approval_status
  or new.submitted_by is distinct from old.submitted_by or new.checked_by is distinct from old.checked_by
  or new.approved_by is distinct from old.approved_by or new.published_by is distinct from old.published_by)
  and coalesce(current_setting('app.exam_result_transition',true),'')<>'on' then
  raise exception 'Result workflow states can only be changed through the examination approval workflow.';
 end if;
 return new;
end;
$function$;
drop trigger if exists guard_exam_result_workflow on public.exam_results;
create trigger guard_exam_result_workflow before update on public.exam_results for each row execute function public.guard_exam_result_workflow();

create or replace function public.transition_exam_results(p_institution_id uuid,p_exam_id uuid,p_next_status text)
returns integer language plpgsql security definer set search_path=''
as $function$
declare v_count integer;
begin
 if auth.uid() is null then raise exception 'Authentication is required.';end if;
 if p_next_status not in ('submitted','checked','approved','published') then raise exception 'Unsupported result workflow action.';end if;
 if p_next_status='submitted' then
  if not public.has_institution_role(p_institution_id,array['owner','admin','teacher','exam_officer']::text[]) then raise exception 'You are not authorised to submit examination marks.';end if;
 else
  if not public.has_institution_role(p_institution_id,array['owner','admin','exam_officer']::text[]) then raise exception 'Only the owner, administrator or examination officer can verify, approve or publish results.';end if;
 end if;
 perform 1 from public.exams e where e.id=p_exam_id and e.institution_id=p_institution_id for update;
 if not found then raise exception 'Examination not found.';end if;
 if not exists(select 1 from public.exam_results r where r.institution_id=p_institution_id and r.exam_id=p_exam_id) then raise exception 'Enter at least one student result before submitting or reviewing.';end if;
 perform set_config('app.exam_result_transition','on',true);
 if p_next_status='submitted' then
  update public.exam_results set approval_status='submitted',submitted_by=auth.uid(),submitted_at=now(),updated_at=now()
   where institution_id=p_institution_id and exam_id=p_exam_id and approval_status='draft';
 elsif p_next_status='checked' then
  if exists(select 1 from public.exam_results r where r.institution_id=p_institution_id and r.exam_id=p_exam_id and r.approval_status not in ('submitted','checked')) then raise exception 'Submit every draft mark before verification.';end if;
  update public.exam_results set approval_status='checked',checked_by=auth.uid(),checked_at=now(),updated_at=now()
   where institution_id=p_institution_id and exam_id=p_exam_id and approval_status='submitted';
 elsif p_next_status='approved' then
  if exists(select 1 from public.exam_results r where r.institution_id=p_institution_id and r.exam_id=p_exam_id and r.approval_status not in ('checked','approved')) then raise exception 'Every result must be checked before approval.';end if;
  update public.exam_results set approval_status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now()
   where institution_id=p_institution_id and exam_id=p_exam_id and approval_status='checked';
 else
  if exists(select 1 from public.exam_results r where r.institution_id=p_institution_id and r.exam_id=p_exam_id and r.approval_status not in ('approved','published')) then raise exception 'Every result must be approved before publication.';end if;
  update public.exam_results set approval_status='published',result_status='published',published_by=auth.uid(),published_at=now(),updated_at=now()
   where institution_id=p_institution_id and exam_id=p_exam_id and approval_status='approved';
  update public.exams set status='published',updated_at=now() where id=p_exam_id and institution_id=p_institution_id;
 end if;
 select count(*) into v_count from public.exam_results where institution_id=p_institution_id and exam_id=p_exam_id;
 return v_count;
end;
$function$;
revoke all on function public.transition_exam_results(uuid,uuid,text) from public,anon;
grant execute on function public.transition_exam_results(uuid,uuid,text) to authenticated;

create or replace function public.start_online_assessment_attempt(p_institution_id uuid,p_assessment_id uuid)
returns public.online_assessment_attempts language plpgsql security definer set search_path=''
as $function$
declare v_student public.students;v_assessment public.online_assessments;v_attempt public.online_assessment_attempts;v_next integer;v_order uuid[];
begin
 if auth.uid() is null then raise exception 'Authentication is required.';end if;
 if not public.has_institution_role(p_institution_id,'student') then raise exception 'Only a student account can start an online assessment.';end if;
 select * into v_student from public.students s where s.institution_id=p_institution_id and s.user_id=auth.uid() and s.status='active' limit 1;
 if not found then raise exception 'No active student record is linked to this account.';end if;
 select * into v_assessment from public.online_assessments a where a.id=p_assessment_id and a.institution_id=p_institution_id for update;
 if not found then raise exception 'Assessment not found.';end if;
 if v_assessment.status not in ('open','scheduled') then raise exception 'This assessment is not available.';end if;
 if v_assessment.starts_at is not null and now()<v_assessment.starts_at then raise exception 'This assessment has not started yet.';end if;
 if v_assessment.ends_at is not null and now()>v_assessment.ends_at then raise exception 'The assessment submission window has closed.';end if;
 if v_student.class_name is distinct from v_assessment.class_name then raise exception 'This assessment is not assigned to your class.';end if;
 select coalesce(max(a.attempt_no),0)+1 into v_next from public.online_assessment_attempts a where a.institution_id=p_institution_id and a.assessment_id=p_assessment_id and a.student_id=v_student.id;
 if v_next>v_assessment.attempts_allowed then raise exception 'You have used all permitted attempts.';end if;
 select coalesce(array_agg(x.question_id order by x.sort_key),'{}') into v_order from (
  select q.question_id,case when v_assessment.randomize_questions then random() else q.sequence_no::double precision end sort_key
  from public.online_assessment_questions q where q.institution_id=p_institution_id and q.assessment_id=p_assessment_id
 ) x;
 if coalesce(array_length(v_order,1),0)=0 then raise exception 'This assessment does not contain any questions yet.';end if;
 insert into public.online_assessment_attempts(institution_id,assessment_id,student_id,attempt_no,question_order,status)
  values(p_institution_id,p_assessment_id,v_student.id,v_next,v_order,'in_progress') returning * into v_attempt;
 return v_attempt;
end;
$function$;
revoke all on function public.start_online_assessment_attempt(uuid,uuid) from public,anon;
grant execute on function public.start_online_assessment_attempt(uuid,uuid) to authenticated;

create or replace function public.get_online_assessment_delivery(p_institution_id uuid,p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_attempt public.online_assessment_attempts;v_student public.students;v_assessment public.online_assessments;v_questions jsonb;
begin
 select * into v_attempt from public.online_assessment_attempts a where a.id=p_attempt_id and a.institution_id=p_institution_id;
 if not found then raise exception 'Assessment attempt not found.';end if;
 select * into v_student from public.students s where s.id=v_attempt.student_id and s.institution_id=p_institution_id and s.user_id=auth.uid();
 if not found then raise exception 'This assessment attempt does not belong to your account.';end if;
 select * into v_assessment from public.online_assessments a where a.id=v_attempt.assessment_id and a.institution_id=p_institution_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'question_type',q.question_type,'prompt',q.prompt,'options',q.options,'marks',coalesce(link.marks_override,q.marks),'sequence_no',array_position(v_attempt.question_order,q.id)) order by array_position(v_attempt.question_order,q.id)),'[]'::jsonb)
 into v_questions from unnest(v_attempt.question_order) with ordinality ordered(question_id,position)
 join public.question_bank_items q on q.id=ordered.question_id and q.institution_id=p_institution_id
 join public.online_assessment_questions link on link.question_id=q.id and link.assessment_id=v_attempt.assessment_id and link.institution_id=p_institution_id;
 return jsonb_build_object('assessment',jsonb_build_object('id',v_assessment.id,'title',v_assessment.title,'instructions',v_assessment.instructions,'duration_minutes',v_assessment.duration_minutes,'maximum_marks',v_assessment.maximum_marks,'allow_review',v_assessment.allow_review),'attempt',jsonb_build_object('id',v_attempt.id,'started_at',v_attempt.started_at,'question_order',v_attempt.question_order),'questions',v_questions);
end;
$function$;
revoke all on function public.get_online_assessment_delivery(uuid,uuid) from public,anon;
grant execute on function public.get_online_assessment_delivery(uuid,uuid) to authenticated;

create or replace function public.submit_online_assessment_attempt(p_institution_id uuid,p_attempt_id uuid,p_responses jsonb)
returns public.online_assessment_attempts language plpgsql security definer set search_path=''
as $function$
declare v_attempt public.online_assessment_attempts;v_assessment public.online_assessments;v_student public.students;v_score numeric(10,2);
begin
 if auth.uid() is null then raise exception 'Authentication is required.';end if;
 select * into v_attempt from public.online_assessment_attempts a where a.id=p_attempt_id and a.institution_id=p_institution_id for update;
 if not found then raise exception 'Assessment attempt not found.';end if;
 select * into v_student from public.students s where s.id=v_attempt.student_id and s.institution_id=p_institution_id and s.user_id=auth.uid();
 if not found then raise exception 'This attempt does not belong to your student account.';end if;
 if v_attempt.status<>'in_progress' then raise exception 'This attempt has already been submitted.';end if;
 select * into v_assessment from public.online_assessments a where a.id=v_attempt.assessment_id and a.institution_id=p_institution_id;
 if now()>v_attempt.started_at+make_interval(mins=>v_assessment.duration_minutes) then raise exception 'The time limit for this attempt has expired.';end if;
 if jsonb_typeof(p_responses)<>'object' then raise exception 'Responses must be a question-to-answer object.';end if;
 if exists(select 1 from jsonb_object_keys(p_responses) k where not (k::uuid=any(v_attempt.question_order))) then raise exception 'The response contains a question that was not assigned to this attempt.';end if;
 select coalesce(sum(coalesce(link.marks_override,q.marks)),0) into v_score
 from public.online_assessment_questions link join public.question_bank_items q on q.id=link.question_id and q.institution_id=link.institution_id
 where link.institution_id=p_institution_id and link.assessment_id=v_attempt.assessment_id and q.question_type in ('multiple_choice','true_false','fill_blank') and p_responses->q.id::text=q.answer_key;
 update public.online_assessment_attempts set response_data=p_responses,marks_obtained=v_score,status='submitted',submitted_at=now(),updated_at=now()
  where id=p_attempt_id and institution_id=p_institution_id returning * into v_attempt;
 return v_attempt;
end;
$function$;
revoke all on function public.submit_online_assessment_attempt(uuid,uuid,jsonb) from public,anon;
grant execute on function public.submit_online_assessment_attempt(uuid,uuid,jsonb) to authenticated;
revoke insert,update,delete on public.online_assessment_attempts from authenticated;
revoke insert,update,delete on public.examination_mark_history from authenticated;
