-- Stage 9: secure online assessment attempt delivery and manual descriptive grading.
create or replace function public.submit_online_assessment_attempt(p_institution_id uuid,p_attempt_id uuid,p_responses jsonb)
returns public.online_assessment_attempts language plpgsql security definer set search_path=''
as $function$
declare v_attempt public.online_assessment_attempts;v_assessment public.online_assessments;v_student public.students;
 v_score numeric(10,2);v_needs_review boolean;
begin
 if auth.uid() is null then raise exception 'Authentication is required.';end if;
 select * into v_attempt from public.online_assessment_attempts a
  where a.id=p_attempt_id and a.institution_id=p_institution_id for update;
 if not found then raise exception 'Assessment attempt not found.';end if;
 select * into v_student from public.students s where s.id=v_attempt.student_id
  and s.institution_id=p_institution_id and s.user_id=auth.uid();
 if not found then raise exception 'This attempt does not belong to your student account.';end if;
 if v_attempt.status<>'in_progress' then raise exception 'This attempt has already been submitted.';end if;
 select * into v_assessment from public.online_assessments a
  where a.id=v_attempt.assessment_id and a.institution_id=p_institution_id;
 if now()>v_attempt.started_at+make_interval(mins=>v_assessment.duration_minutes) then
  raise exception 'The time limit for this attempt has expired.';
 end if;
 if jsonb_typeof(p_responses)<>'object' then raise exception 'Responses must be a question-to-answer object.';end if;
 if exists(select 1 from jsonb_object_keys(p_responses) k where not(k::uuid=any(v_attempt.question_order))) then
  raise exception 'The response contains a question that was not assigned to this attempt.';
 end if;
 select coalesce(sum(coalesce(link.marks_override,q.marks)),0) into v_score
 from public.online_assessment_questions link join public.question_bank_items q
  on q.id=link.question_id and q.institution_id=link.institution_id
 where link.institution_id=p_institution_id and link.assessment_id=v_attempt.assessment_id
  and q.question_type in ('multiple_choice','true_false','fill_blank')
  and p_responses->q.id::text=q.answer_key;
 select exists(select 1 from public.online_assessment_questions link join public.question_bank_items q
  on q.id=link.question_id and q.institution_id=link.institution_id
  where link.institution_id=p_institution_id and link.assessment_id=v_attempt.assessment_id
   and q.question_type in ('short_answer','long_answer') and p_responses?q.id::text
   and length(trim(coalesce(p_responses->>q.id::text,'')))>0) into v_needs_review;
 update public.online_assessment_attempts set response_data=p_responses,marks_obtained=v_score,
  needs_manual_review=v_needs_review,status=case when v_needs_review then 'pending_review' else 'submitted' end,
  submitted_at=now(),updated_at=now() where id=p_attempt_id and institution_id=p_institution_id
  returning * into v_attempt;
 return v_attempt;
end;
$function$;
revoke all on function public.submit_online_assessment_attempt(uuid,uuid,jsonb) from public,anon;
grant execute on function public.submit_online_assessment_attempt(uuid,uuid,jsonb) to authenticated;

create or replace function public.grade_online_assessment_attempt(
 p_institution_id uuid,p_attempt_id uuid,p_manual_marks numeric,p_review_notes text default null
)
returns public.online_assessment_attempts language plpgsql security definer set search_path=''
as $function$
declare v_attempt public.online_assessment_attempts;v_assessment public.online_assessments;
 v_max_manual numeric(10,2);v_auto_marks numeric(10,2);
begin
 if auth.uid() is null then raise exception 'Authentication is required.';end if;
 select * into v_attempt from public.online_assessment_attempts a
  where a.id=p_attempt_id and a.institution_id=p_institution_id for update;
 if not found then raise exception 'Assessment attempt not found.';end if;
 if v_attempt.status<>'pending_review' or not v_attempt.needs_manual_review then
  raise exception 'This attempt does not require manual review.';
 end if;
 select * into v_assessment from public.online_assessments a
  where a.id=v_attempt.assessment_id and a.institution_id=p_institution_id;
 if not public.has_institution_role(p_institution_id,array['owner','admin','exam_officer']::text[])
  and not ((select public.has_institution_role(p_institution_id,'teacher')) and v_assessment.created_by=(select auth.uid())) then
  raise exception 'You are not authorised to grade this assessment attempt.';
 end if;
 select coalesce(sum(coalesce(link.marks_override,q.marks)),0) into v_max_manual
 from public.online_assessment_questions link join public.question_bank_items q
  on q.id=link.question_id and q.institution_id=link.institution_id
 where link.institution_id=p_institution_id and link.assessment_id=v_attempt.assessment_id
  and q.question_type in ('short_answer','long_answer');
 if p_manual_marks is null or p_manual_marks<0 or p_manual_marks>v_max_manual then
  raise exception 'Manual marks must be between zero and %.',v_max_manual;
 end if;
 v_auto_marks:=coalesce(v_attempt.marks_obtained,0);
 update public.online_assessment_attempts set manual_marks=p_manual_marks,
  marks_obtained=v_auto_marks+p_manual_marks,needs_manual_review=false,status='graded',
  review_notes=nullif(trim(coalesce(p_review_notes,'')),''),reviewed_by=auth.uid(),reviewed_at=now(),
  graded_by=auth.uid(),graded_at=now(),updated_at=now()
  where id=p_attempt_id and institution_id=p_institution_id returning * into v_attempt;
 return v_attempt;
end;
$function$;
revoke all on function public.grade_online_assessment_attempt(uuid,uuid,numeric,text) from public,anon;
grant execute on function public.grade_online_assessment_attempt(uuid,uuid,numeric,text) to authenticated;
