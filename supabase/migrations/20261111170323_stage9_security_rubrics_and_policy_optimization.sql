-- Stage 9 security hardening, assessment rubrics, grade and mark guards.
revoke all on function public.set_exam_result_grade() from public,anon,authenticated;
revoke all on function public.audit_exam_result_marks() from public,anon,authenticated;
revoke all on function public.guard_exam_result_workflow() from public,anon,authenticated;

select set_config('app.exam_result_transition','on',true);
update public.exam_results set approval_status='published',
 published_at=coalesce(published_at,updated_at,created_at)
 where result_status='published' and approval_status='draft';

create table if not exists public.examination_assessment_rubrics(
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id) on delete cascade,
 rubric_name text not null,description text,criteria jsonb not null default '[]'::jsonb,
 maximum_marks numeric(10,2) not null check(maximum_marks>0),
 subject_id uuid references public.subjects(id) on delete set null,
 class_id uuid references public.classes(id) on delete set null,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint examination_assessment_rubrics_criteria_array check(jsonb_typeof(criteria)='array')
);
alter table public.online_assessments add column if not exists rubric_id uuid references public.examination_assessment_rubrics(id) on delete set null;
alter table public.online_assessment_attempts
 add column if not exists needs_manual_review boolean not null default false,
 add column if not exists manual_marks numeric(10,2),
 add column if not exists review_notes text,
 add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
 add column if not exists reviewed_at timestamptz;
alter table public.online_assessment_attempts drop constraint if exists online_assessment_attempts_status_check;
alter table public.online_assessment_attempts add constraint online_assessment_attempts_status_check
 check(status in ('in_progress','submitted','pending_review','graded','void'));

alter table public.examination_assessment_rubrics enable row level security;
grant select,insert,update,delete on public.examination_assessment_rubrics to authenticated;
drop policy if exists examination_rubrics_read on public.examination_assessment_rubrics;
create policy examination_rubrics_read on public.examination_assessment_rubrics for select to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','teacher','exam_officer']::text[])));
drop policy if exists examination_rubrics_insert on public.examination_assessment_rubrics;
create policy examination_rubrics_insert on public.examination_assessment_rubrics for insert to authenticated
 with check(created_by=(select auth.uid()) and (select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])));
drop policy if exists examination_rubrics_update on public.examination_assessment_rubrics;
create policy examination_rubrics_update on public.examination_assessment_rubrics for update to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])))
 with check((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])));
drop policy if exists examination_rubrics_delete on public.examination_assessment_rubrics;
create policy examination_rubrics_delete on public.examination_assessment_rubrics for delete to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])));

create or replace function public.guard_examination_grade_band_overlap()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 if exists(select 1 from public.examination_grade_bands b
  where b.institution_id=new.institution_id and b.id is distinct from new.id
   and numrange(b.min_percentage,b.max_percentage,'[]') && numrange(new.min_percentage,new.max_percentage,'[]')) then
  raise exception 'This percentage range overlaps an existing grade band.';
 end if;
 return new;
end;
$function$;
drop trigger if exists guard_examination_grade_band_overlap on public.examination_grade_bands;
create trigger guard_examination_grade_band_overlap before insert or update on public.examination_grade_bands
 for each row execute function public.guard_examination_grade_band_overlap();
revoke all on function public.guard_examination_grade_band_overlap() from public,anon,authenticated;

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
drop trigger if exists guard_examination_assessment_weight_total on public.examination_assessment_weights;
create trigger guard_examination_assessment_weight_total before insert or update on public.examination_assessment_weights
 for each row execute function public.guard_examination_assessment_weight_total();
revoke all on function public.guard_examination_assessment_weight_total() from public,anon,authenticated;

create or replace function public.guard_exam_result_mark_correction()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 if (new.marks_obtained is distinct from old.marks_obtained or new.is_absent is distinct from old.is_absent
  or new.remarks is distinct from old.remarks)
  and old.approval_status<>'draft'
  and not public.has_institution_role(new.institution_id,array['owner','admin','exam_officer']::text[]) then
  raise exception 'Submitted marks can only be corrected by an owner, administrator or examination officer.';
 end if;
 if (new.marks_obtained is distinct from old.marks_obtained or new.is_absent is distinct from old.is_absent)
  and old.approval_status='published' and length(trim(coalesce(new.correction_reason,'')))<10 then
  raise exception 'A correction reason of at least 10 characters is required for a published result.';
 end if;
 return new;
end;
$function$;
drop trigger if exists guard_exam_result_mark_correction on public.exam_results;
create trigger guard_exam_result_mark_correction before update on public.exam_results
 for each row execute function public.guard_exam_result_mark_correction();
revoke all on function public.guard_exam_result_mark_correction() from public,anon,authenticated;

drop policy if exists examination_grade_bands_manage on public.examination_grade_bands;
drop policy if exists examination_grade_bands_read on public.examination_grade_bands;
create policy examination_grade_bands_read on public.examination_grade_bands for select to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','teacher','student','parent','accountant','exam_officer']::text[])));
create policy examination_grade_bands_insert on public.examination_grade_bands for insert to authenticated
 with check((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])));
create policy examination_grade_bands_update on public.examination_grade_bands for update to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])))
 with check((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])));
create policy examination_grade_bands_delete on public.examination_grade_bands for delete to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])));

drop policy if exists examination_weights_manage on public.examination_assessment_weights;
drop policy if exists examination_weights_read on public.examination_assessment_weights;
create policy examination_weights_read on public.examination_assessment_weights for select to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','teacher','exam_officer']::text[])));
create policy examination_weights_insert on public.examination_assessment_weights for insert to authenticated
 with check((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])));
create policy examination_weights_update on public.examination_assessment_weights for update to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])))
 with check((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])));
create policy examination_weights_delete on public.examination_assessment_weights for delete to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])));

drop policy if exists online_assessments_staff_read on public.online_assessments;
drop policy if exists online_assessments_student_read on public.online_assessments;
create policy online_assessments_read on public.online_assessments for select to authenticated using(
 (select public.has_institution_role(institution_id,array['owner','admin','teacher','exam_officer']::text[]))
 or (status in ('scheduled','open','published') and (select public.has_institution_role(institution_id,'student'))
  and exists(select 1 from public.students s where s.institution_id=online_assessments.institution_id
   and s.user_id=(select auth.uid()) and s.class_name=online_assessments.class_name))
);
drop policy if exists online_assessment_attempts_staff_read on public.online_assessment_attempts;
drop policy if exists online_assessment_attempts_student_read on public.online_assessment_attempts;
create policy online_assessment_attempts_read on public.online_assessment_attempts for select to authenticated using(
 (select public.has_institution_role(institution_id,array['owner','admin','teacher','exam_officer']::text[]))
 or exists(select 1 from public.students s where s.id=student_id
  and s.institution_id=online_assessment_attempts.institution_id and s.user_id=(select auth.uid()))
);

create index if not exists examination_assessment_weights_session_fk_idx on public.examination_assessment_weights(academic_session_id);
create index if not exists examination_assessment_weights_class_fk_idx on public.examination_assessment_weights(class_id);
create index if not exists examination_assessment_weights_subject_fk_idx on public.examination_assessment_weights(subject_id);
create index if not exists examination_assessment_weights_created_by_fk_idx on public.examination_assessment_weights(created_by);
create index if not exists examination_grade_bands_created_by_fk_idx on public.examination_grade_bands(created_by);
create index if not exists examination_mark_history_actor_fk_idx on public.examination_mark_history(actor_id);
create index if not exists examination_recheck_requests_result_fk_idx on public.examination_recheck_requests(exam_result_id);
create index if not exists examination_recheck_requests_student_fk_idx on public.examination_recheck_requests(student_id);
create index if not exists examination_recheck_requests_requested_by_fk_idx on public.examination_recheck_requests(requested_by);
create index if not exists examination_recheck_requests_reviewed_by_fk_idx on public.examination_recheck_requests(reviewed_by);
create index if not exists online_assessment_attempts_student_fk_idx on public.online_assessment_attempts(student_id);
create index if not exists online_assessment_attempts_graded_by_fk_idx on public.online_assessment_attempts(graded_by);
create index if not exists online_assessment_questions_institution_fk_idx on public.online_assessment_questions(institution_id);
create index if not exists online_assessment_questions_question_fk_idx on public.online_assessment_questions(question_id);
create index if not exists online_assessments_session_fk_idx on public.online_assessments(academic_session_id);
create index if not exists online_assessments_class_fk_idx on public.online_assessments(class_id);
create index if not exists online_assessments_subject_fk_idx on public.online_assessments(subject_id);
create index if not exists online_assessments_created_by_fk_idx on public.online_assessments(created_by);
create index if not exists online_assessments_exam_fk_idx on public.online_assessments(exam_id);
create index if not exists examination_assessment_rubrics_institution_idx on public.examination_assessment_rubrics(institution_id,created_at desc);
create index if not exists examination_assessment_rubrics_subject_idx on public.examination_assessment_rubrics(subject_id);
create index if not exists examination_assessment_rubrics_class_idx on public.examination_assessment_rubrics(class_id);
