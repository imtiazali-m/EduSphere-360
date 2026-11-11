-- Stage 9: weight percentages are enforced per session/class/subject, not globally.
create or replace function public.guard_examination_assessment_weight_total()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_total numeric(7,2);
begin
 select coalesce(sum(w.weight_percent),0) into v_total
 from public.examination_assessment_weights w
 where w.institution_id=new.institution_id
  and w.academic_session_id is not distinct from new.academic_session_id
  and w.class_id is not distinct from new.class_id
  and w.subject_id is not distinct from new.subject_id
  and w.id is distinct from new.id;
 if v_total+new.weight_percent>100 then
  raise exception 'Assessment component weights cannot exceed 100%% for the same session, class and subject.';
 end if;
 return new;
end;
$function$;
revoke all on function public.guard_examination_assessment_weight_total() from public,anon,authenticated;
