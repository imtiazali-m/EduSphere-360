-- Stage 9: examinations, assessments and result workflow foundation.
create or replace function public.has_institution_role(target_institution uuid, allowed_role text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.memberships m
  where m.institution_id=target_institution and m.user_id=(select auth.uid())
   and m.status='active' and m.role=allowed_role);
$$;
revoke all on function public.has_institution_role(uuid,text) from public,anon;
grant execute on function public.has_institution_role(uuid,text) to authenticated;

alter table public.exams
 add column if not exists program_code text,
 add column if not exists class_id uuid references public.classes(id) on delete set null,
 add column if not exists subject_id uuid references public.subjects(id) on delete set null,
 add column if not exists academic_session_id uuid references public.academic_sessions(id) on delete set null,
 add column if not exists pass_marks numeric(10,2),
 add column if not exists marks_distribution jsonb not null default '{}'::jsonb,
 add column if not exists responsible_staff_id uuid references public.teachers(id) on delete set null;

alter table public.exam_results
 add column if not exists is_absent boolean not null default false,
 add column if not exists approval_status text not null default 'draft',
 add column if not exists submitted_by uuid references auth.users(id) on delete set null,
 add column if not exists submitted_at timestamptz,
 add column if not exists checked_by uuid references auth.users(id) on delete set null,
 add column if not exists checked_at timestamptz,
 add column if not exists approved_by uuid references auth.users(id) on delete set null,
 add column if not exists approved_at timestamptz,
 add column if not exists published_by uuid references auth.users(id) on delete set null,
 add column if not exists published_at timestamptz,
 add column if not exists correction_reason text;
alter table public.exam_results drop constraint if exists exam_results_approval_status_check;
alter table public.exam_results add constraint exam_results_approval_status_check
 check(approval_status in ('draft','submitted','checked','approved','published'));

create table if not exists public.examination_grade_bands(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 grade_label text not null,min_percentage numeric(5,2) not null check(min_percentage>=0 and min_percentage<=100),
 max_percentage numeric(5,2) not null check(max_percentage>=0 and max_percentage<=100),grade_point numeric(5,2),
 is_pass boolean not null default true,sort_order integer not null default 0,
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),constraint examination_grade_bands_range check(min_percentage<=max_percentage),
 constraint examination_grade_bands_point check(grade_point is null or grade_point>=0),
 constraint examination_grade_bands_unique unique(institution_id,grade_label)
);
create table if not exists public.examination_assessment_weights(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 academic_session_id uuid references public.academic_sessions(id) on delete set null,
 class_id uuid references public.classes(id) on delete set null,subject_id uuid references public.subjects(id) on delete set null,
 component_name text not null,weight_percent numeric(5,2) not null check(weight_percent>0 and weight_percent<=100),
 created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.online_assessments(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 exam_id uuid references public.exams(id) on delete set null,title text not null,instructions text,
 class_id uuid references public.classes(id) on delete set null,class_name text not null,
 subject_id uuid references public.subjects(id) on delete set null,subject_name text not null,
 academic_session_id uuid references public.academic_sessions(id) on delete set null,
 starts_at timestamptz,ends_at timestamptz,duration_minutes integer not null check(duration_minutes>0),
 maximum_marks numeric(10,2) not null check(maximum_marks>0),
 pass_marks numeric(10,2) not null default 0 check(pass_marks>=0 and pass_marks<=maximum_marks),
 randomize_questions boolean not null default false,allow_review boolean not null default false,
 attempts_allowed integer not null default 1 check(attempts_allowed between 1 and 10),
 status text not null default 'draft' check(status in ('draft','scheduled','open','closed','published','archived')),
 created_by uuid not null references auth.users(id) on delete restrict,created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),constraint online_assessment_window check(starts_at is null or ends_at is null or ends_at>starts_at)
);
create table if not exists public.online_assessment_questions(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 assessment_id uuid not null references public.online_assessments(id) on delete cascade,
 question_id uuid not null references public.question_bank_items(id) on delete restrict,
 sequence_no integer not null check(sequence_no>0),marks_override numeric(10,2) check(marks_override is null or marks_override>0),
 created_at timestamptz not null default now(),constraint online_assessment_questions_unique unique(assessment_id,question_id),
 constraint online_assessment_questions_order_unique unique(assessment_id,sequence_no)
);
create table if not exists public.online_assessment_attempts(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 assessment_id uuid not null references public.online_assessments(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,attempt_no integer not null check(attempt_no>0),
 question_order uuid[] not null default '{}',response_data jsonb not null default '{}'::jsonb,marks_obtained numeric(10,2),
 status text not null default 'in_progress' check(status in ('in_progress','submitted','graded','void')),
 started_at timestamptz not null default now(),submitted_at timestamptz,graded_by uuid references auth.users(id) on delete set null,
 graded_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint online_assessment_attempt_number_unique unique(assessment_id,student_id,attempt_no),
 constraint online_assessment_attempt_marks_nonnegative check(marks_obtained is null or marks_obtained>=0)
);
create table if not exists public.examination_recheck_requests(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 exam_result_id uuid not null references public.exam_results(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,reason text not null,
 status text not null default 'submitted' check(status in ('submitted','under_review','resolved','rejected')),
 resolution_note text,requested_by uuid not null references auth.users(id) on delete restrict,
 reviewed_by uuid references auth.users(id) on delete set null,reviewed_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.examination_mark_history(
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id) on delete cascade,
 exam_result_id uuid not null references public.exam_results(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,change_reason text,
 before_record jsonb not null,after_record jsonb not null,created_at timestamptz not null default now()
);
create index if not exists exams_institution_program_date_idx on public.exams(institution_id,title,exam_date);
create index if not exists exam_results_institution_exam_student_idx on public.exam_results(institution_id,exam_id,student_id);
create index if not exists exam_results_institution_approval_idx on public.exam_results(institution_id,approval_status,exam_id);
create index if not exists online_assessments_institution_class_status_idx on public.online_assessments(institution_id,class_id,status);
create index if not exists online_assessment_attempts_institution_assessment_idx on public.online_assessment_attempts(institution_id,assessment_id,status);
create index if not exists examination_recheck_requests_institution_status_idx on public.examination_recheck_requests(institution_id,status,created_at desc);
create index if not exists examination_mark_history_result_idx on public.examination_mark_history(institution_id,exam_result_id,created_at desc);

alter table public.examination_grade_bands enable row level security;
alter table public.examination_assessment_weights enable row level security;
alter table public.online_assessments enable row level security;
alter table public.online_assessment_questions enable row level security;
alter table public.online_assessment_attempts enable row level security;
alter table public.examination_recheck_requests enable row level security;
alter table public.examination_mark_history enable row level security;
grant select,insert,update,delete on public.examination_grade_bands to authenticated;
grant select,insert,update,delete on public.examination_assessment_weights to authenticated;
grant select,insert,update,delete on public.online_assessments to authenticated;
grant select,insert,update,delete on public.online_assessment_questions to authenticated;
grant select,insert,update,delete on public.online_assessment_attempts to authenticated;
grant select,insert,update,delete on public.examination_recheck_requests to authenticated;
grant select on public.examination_mark_history to authenticated;

drop policy if exists examination_grade_bands_read on public.examination_grade_bands;
drop policy if exists examination_grade_bands_manage on public.examination_grade_bands;
create policy examination_grade_bands_read on public.examination_grade_bands for select to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','teacher','student','parent','accountant','exam_officer']::text[])));
create policy examination_grade_bands_manage on public.examination_grade_bands for all to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])))
 with check((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])));
drop policy if exists examination_weights_read on public.examination_assessment_weights;
drop policy if exists examination_weights_manage on public.examination_assessment_weights;
create policy examination_weights_read on public.examination_assessment_weights for select to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','teacher','exam_officer']::text[])));
create policy examination_weights_manage on public.examination_assessment_weights for all to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])))
 with check((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])));

create policy online_assessments_staff_read on public.online_assessments for select to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','teacher','exam_officer']::text[])));
create policy online_assessments_student_read on public.online_assessments for select to authenticated
 using(status in ('scheduled','open','published') and (select public.has_institution_role(institution_id,'student'))
  and exists(select 1 from public.students s where s.institution_id=online_assessments.institution_id and s.user_id=(select auth.uid()) and s.class_name=online_assessments.class_name));
create policy online_assessments_staff_insert on public.online_assessments for insert to authenticated
 with check(created_by=(select auth.uid()) and (select public.has_institution_role(institution_id,array['owner','admin','teacher','exam_officer']::text[])));
create policy online_assessments_staff_update on public.online_assessments for update to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])) or ((select public.has_institution_role(institution_id,'teacher')) and created_by=(select auth.uid())))
 with check((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])) or ((select public.has_institution_role(institution_id,'teacher')) and created_by=(select auth.uid())));
create policy online_assessments_staff_delete on public.online_assessments for delete to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])));
create policy online_assessment_questions_staff on public.online_assessment_questions for all to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])) or exists(select 1 from public.online_assessments a where a.id=assessment_id and a.institution_id=online_assessment_questions.institution_id and a.created_by=(select auth.uid()) and (select public.has_institution_role(a.institution_id,'teacher'))))
 with check((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])) or exists(select 1 from public.online_assessments a where a.id=assessment_id and a.institution_id=online_assessment_questions.institution_id and a.created_by=(select auth.uid()) and (select public.has_institution_role(a.institution_id,'teacher'))));
create policy online_assessment_attempts_staff_read on public.online_assessment_attempts for select to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','teacher','exam_officer']::text[])));
create policy online_assessment_attempts_student_read on public.online_assessment_attempts for select to authenticated
 using(exists(select 1 from public.students s where s.id=student_id and s.institution_id=online_assessment_attempts.institution_id and s.user_id=(select auth.uid())));
create policy online_assessment_attempts_student_insert on public.online_assessment_attempts for insert to authenticated
 with check(status='in_progress' and (select public.has_institution_role(institution_id,'student'))
  and exists(select 1 from public.students s where s.id=student_id and s.institution_id=online_assessment_attempts.institution_id and s.user_id=(select auth.uid())));
create policy online_assessment_attempts_student_update on public.online_assessment_attempts for update to authenticated
 using(status='in_progress' and exists(select 1 from public.students s where s.id=student_id and s.institution_id=online_assessment_attempts.institution_id and s.user_id=(select auth.uid())))
 with check(status in ('in_progress','submitted') and exists(select 1 from public.students s where s.id=student_id and s.institution_id=online_assessment_attempts.institution_id and s.user_id=(select auth.uid())));
create policy examination_recheck_read on public.examination_recheck_requests for select to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','teacher','exam_officer']::text[])) or exists(select 1 from public.students s where s.id=student_id and s.institution_id=examination_recheck_requests.institution_id and s.user_id=(select auth.uid())) or (select public.can_view_student(student_id)));
create policy examination_recheck_insert on public.examination_recheck_requests for insert to authenticated
 with check(requested_by=(select auth.uid()) and (select public.has_institution_role(institution_id,'student')) and exists(select 1 from public.students s where s.id=student_id and s.institution_id=examination_recheck_requests.institution_id and s.user_id=(select auth.uid())));
create policy examination_recheck_manage on public.examination_recheck_requests for update to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])))
 with check((select public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])));
create policy examination_mark_history_read on public.examination_mark_history for select to authenticated
 using((select public.has_institution_role(institution_id,array['owner','admin','teacher','exam_officer']::text[])));
