create table if not exists public.employee_qualifications (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null references public.institutions(id) on delete cascade,
 teacher_id uuid not null,
 qualification_name text not null,
 field_of_study text,
 awarding_institution text not null,
 date_awarded date,
 expiry_date date,
 grade_or_result text,
 verification_status text not null default 'pending' check(verification_status in ('pending','verified','rejected','expired')),
 verified_by uuid references auth.users(id),
 verified_at timestamptz,
 notes text,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint employee_qualifications_dates_ck check(expiry_date is null or date_awarded is null or expiry_date>=date_awarded),
 constraint employee_qualifications_employee_fk foreign key(teacher_id,institution_id) references public.teachers(id,institution_id)
);
create index if not exists employee_qualifications_employee_idx on public.employee_qualifications(institution_id,teacher_id,date_awarded desc);
alter table public.employee_qualifications enable row level security;
create policy employee_qualifications_admin_all on public.employee_qualifications for all to authenticated
 using(public.has_institution_role(institution_id,array['owner','admin']::text[]))
 with check(public.has_institution_role(institution_id,array['owner','admin']::text[]));
create policy employee_qualifications_own_read on public.employee_qualifications for select to authenticated
 using(exists(select 1 from public.teachers t where t.id=employee_qualifications.teacher_id and t.institution_id=employee_qualifications.institution_id and t.user_id=auth.uid()));
grant select,insert,update,delete on public.employee_qualifications to authenticated;
revoke all on public.employee_qualifications from anon;
