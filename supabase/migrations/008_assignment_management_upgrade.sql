-- Assignment lifecycle: richer assignment metadata and per-student submissions.
alter table public.assignments
  add column if not exists section_name text,
  add column if not exists academic_session text,
  add column if not exists points numeric(8,2) not null default 100 check (points >= 0),
  add column if not exists attachment_url text,
  add column if not exists published_at timestamptz;

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
  status text not null default 'submitted' check (status in ('submitted','late','graded','returned')),
  marks_obtained numeric(8,2) check (marks_obtained is null or marks_obtained >= 0),
  feedback text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id),
  check (status <> 'graded' or marks_obtained is not null)
);

create index if not exists assignment_submissions_institution_idx
  on public.assignment_submissions(institution_id, submitted_at desc);
create index if not exists assignment_submissions_student_idx
  on public.assignment_submissions(student_id, submitted_at desc);

grant select, insert, update, delete on public.assignment_submissions to authenticated;
alter table public.assignment_submissions enable row level security;

drop policy if exists "assignment submissions view policy" on public.assignment_submissions;
create policy "assignment submissions view policy" on public.assignment_submissions
for select to authenticated using (
  public.has_institution_role(institution_id, array['owner','admin','teacher'])
  or public.can_view_student(student_id)
);

drop policy if exists "students and teachers submit assignments" on public.assignment_submissions;
create policy "students and teachers submit assignments" on public.assignment_submissions
for insert to authenticated with check (
  public.has_institution_role(institution_id, array['owner','admin','teacher'])
  or exists (
    select 1 from public.students s
    where s.id = student_id and s.institution_id = institution_id and s.user_id = (select auth.uid())
  )
);

drop policy if exists "students and teachers update assignment submissions" on public.assignment_submissions;
create policy "students and teachers update assignment submissions" on public.assignment_submissions
for update to authenticated using (
  public.has_institution_role(institution_id, array['owner','admin','teacher'])
  or exists (
    select 1 from public.students s
    where s.id = student_id and s.institution_id = institution_id and s.user_id = (select auth.uid())
  )
) with check (
  public.has_institution_role(institution_id, array['owner','admin','teacher'])
  or exists (
    select 1 from public.students s
    where s.id = student_id and s.institution_id = institution_id and s.user_id = (select auth.uid())
  )
);

drop policy if exists "administrators delete assignment submissions" on public.assignment_submissions;
create policy "administrators delete assignment submissions" on public.assignment_submissions
for delete to authenticated using (public.has_institution_role(institution_id, array['owner','admin']));

create or replace function public.guard_student_assignment_submission()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  learner_class text;
  assignment_class text;
  assignment_status text;
  maximum_points numeric;
  actual_assignment_title text;
  actual_student_name text;
begin
  if not public.has_institution_role(new.institution_id, array['owner','admin','teacher']) then
    select s.class_name, s.full_name into learner_class, actual_student_name from public.students s where s.id = new.student_id and s.institution_id = new.institution_id and s.user_id = (select auth.uid());
    select a.class_name, a.status, a.points, a.title into assignment_class, assignment_status, maximum_points, actual_assignment_title from public.assignments a where a.id = new.assignment_id and a.institution_id = new.institution_id;
    new.assignment_title := actual_assignment_title;
    new.student_name := actual_student_name;
    if learner_class is null or assignment_class is null or learner_class <> assignment_class then
      raise exception 'You may submit only assignments published for your enrolled class.';
    end if;
    if assignment_status <> 'open' then
      raise exception 'This assignment is closed and is no longer accepting submissions.';
    end if;
    if tg_op = 'UPDATE' and (
      new.institution_id is distinct from old.institution_id
      or new.assignment_id is distinct from old.assignment_id
      or new.student_id is distinct from old.student_id
      or new.assignment_title is distinct from old.assignment_title
      or new.student_name is distinct from old.student_name
      or new.marks_obtained is distinct from old.marks_obtained
      or new.feedback is distinct from old.feedback
      or new.status not in ('submitted','late')
    ) then
      raise exception 'Students may update their submission content only; grading is reserved for teaching staff.';
    end if;
    if new.marks_obtained is not null or new.feedback is not null or new.status not in ('submitted','late') then
      raise exception 'Only teaching staff may grade or return an assignment.';
    end if;
  else
    select a.points into maximum_points from public.assignments a where a.id = new.assignment_id and a.institution_id = new.institution_id;
  end if;
  if new.marks_obtained is not null and maximum_points is not null and new.marks_obtained > maximum_points then
    raise exception 'Marks awarded cannot exceed the assignment maximum.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_student_assignment_submission on public.assignment_submissions;
create trigger guard_student_assignment_submission
before insert or update on public.assignment_submissions
for each row execute function public.guard_student_assignment_submission();
