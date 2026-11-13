create table if not exists public.library_reading_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  library_loan_id uuid,
  book_title text not null check(length(trim(book_title)) between 1 and 240),
  reading_date date not null default current_date,
  pages_read integer not null default 0 check(pages_read>=0),
  reading_minutes integer not null default 0 check(reading_minutes>=0),
  progress_percent numeric(5,2) check(progress_percent is null or (progress_percent>=0 and progress_percent<=100)),
  rating integer check(rating is null or (rating between 1 and 5)),
  status text not null default 'in_progress' check(status=any(array['in_progress'::text,'completed'::text,'paused'::text])),
  notes text,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_reading_student_fk foreign key(student_id,institution_id)
    references public.students(id,institution_id) on delete cascade,
  constraint library_reading_loan_fk foreign key(library_loan_id)
    references public.library_loans(id) on delete set null
);

create index if not exists library_reading_student_date_idx
  on public.library_reading_records(institution_id,student_id,reading_date desc);
create index if not exists library_reading_date_idx
  on public.library_reading_records(institution_id,reading_date desc);

alter table public.library_reading_records enable row level security;
revoke all on table public.library_reading_records from public,anon,authenticated;
grant select,insert,update on table public.library_reading_records to authenticated;

drop policy if exists library_reading_records_read on public.library_reading_records;
create policy library_reading_records_read on public.library_reading_records for select to authenticated
using (
  has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text])
  or can_view_student(student_id)
);

drop policy if exists library_reading_records_insert_staff on public.library_reading_records;
create policy library_reading_records_insert_staff on public.library_reading_records for insert to authenticated
with check (
  recorded_by=(select auth.uid())
  and has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text])
  and exists(select 1 from public.students s where s.id=student_id and s.institution_id=library_reading_records.institution_id)
  and (
    library_loan_id is null
    or exists(select 1 from public.library_loans l where l.id=library_loan_id and l.institution_id=library_reading_records.institution_id and l.student_id=library_reading_records.student_id)
  )
);

drop policy if exists library_reading_records_update_staff on public.library_reading_records;
create policy library_reading_records_update_staff on public.library_reading_records for update to authenticated
using(has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text]))
with check(has_institution_role(institution_id,array['owner'::text,'admin'::text,'teacher'::text]));
