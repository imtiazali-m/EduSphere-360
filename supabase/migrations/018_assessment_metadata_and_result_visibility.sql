-- EduSphere 360 Phase Two: assessment fields required by the examination and result workflows.
-- Safe to re-run. Keeps existing exam and result records intact.

begin;

alter table public.exams
  add column if not exists exam_type text not null default 'other',
  add column if not exists academic_session text,
  add column if not exists term text,
  add column if not exists start_time time,
  add column if not exists duration_minutes integer,
  add column if not exists room text,
  add column if not exists invigilator text,
  add column if not exists instructions text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'exams_duration_minutes_positive_check'
      and conrelid = 'public.exams'::regclass
  ) then
    alter table public.exams
      add constraint exams_duration_minutes_positive_check
      check (duration_minutes is null or duration_minutes > 0);
  end if;
end $$;

alter table public.exam_results
  add column if not exists exam_id uuid references public.exams(id) on delete set null,
  add column if not exists remarks text,
  add column if not exists result_status text not null default 'draft';

alter table public.exam_results
  drop constraint if exists exam_results_result_status_check;
alter table public.exam_results
  add constraint exam_results_result_status_check
  check (result_status in ('draft', 'published'));

create index if not exists exams_institution_class_date_idx
  on public.exams(institution_id, class_name, exam_date);
create index if not exists exam_results_exam_student_idx
  on public.exam_results(exam_id, student_id);
create index if not exists exam_results_student_visibility_idx
  on public.exam_results(institution_id, student_id, result_status);

-- Student and parent portals must never receive draft marks through direct table reads.
drop policy if exists "authorized users can view exam results" on public.exam_results;
create policy "authorized users can view exam results" on public.exam_results
for select to authenticated using (
  public.has_institution_role(institution_id, array['owner','admin','teacher','exam_officer'])
  or (result_status = 'published' and public.can_view_student(student_id))
);

commit;
