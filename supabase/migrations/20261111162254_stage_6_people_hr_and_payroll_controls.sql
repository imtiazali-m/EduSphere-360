
-- Stage 6: People Management & Human Resources
-- Source migration for the live schema changes applied to Supabase.

begin;

create unique index if not exists employee_salary_profiles_id_institution_uq on public.employee_salary_profiles(id,institution_id);
create unique index if not exists staff_documents_id_institution_uq on public.staff_documents(id,institution_id);

create table if not exists public.admission_enquiries (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  campus_id uuid,
  enquiry_no text not null,
  student_name text not null,
  date_of_birth date,
  class_applied_for text not null,
  academic_session text,
  guardian_name text not null,
  guardian_relationship text,
  guardian_phone text not null,
  guardian_email text,
  source text not null default 'direct',
  assigned_to uuid references auth.users(id) on delete set null,
  follow_up_date date,
  status text not null default 'new' check(status in ('new','contacted','follow_up','application_started','converted','not_interested')),
  notes text,
  converted_student_id uuid,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admission_enquiries_institution_enquiry_no_uq unique(institution_id,enquiry_no),
  constraint admission_enquiries_id_institution_uq unique(id,institution_id),
  constraint admission_enquiries_campus_fk foreign key(campus_id,institution_id) references public.campuses(id,institution_id),
  constraint admission_enquiries_student_fk foreign key(converted_student_id,institution_id) references public.students(id,institution_id)
);
create index if not exists admission_enquiries_institution_status_idx on public.admission_enquiries(institution_id,status,created_at desc);
create index if not exists admission_enquiries_follow_up_idx on public.admission_enquiries(institution_id,follow_up_date) where status not in ('converted','not_interested');

create table if not exists public.hr_job_postings (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  campus_id uuid,
  job_code text not null,
  title text not null,
  department text,
  department_id uuid,
  designation_id uuid,
  employee_type text not null default 'non_teaching' check(employee_type in ('teaching','non_teaching')),
  employment_type text not null default 'full_time' check(employment_type in ('full_time','part_time','contract','temporary')),
  openings integer not null default 1 check(openings>0 and openings<=500),
  work_location text,
  job_description text not null,
  qualifications text,
  experience_required text,
  salary_range_min numeric(14,2) check(salary_range_min is null or salary_range_min>=0),
  salary_range_max numeric(14,2) check(salary_range_max is null or salary_range_max>=0),
  closing_date date,
  status text not null default 'draft' check(status in ('draft','open','paused','closed','filled')),
  hiring_manager_id uuid references auth.users(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_job_postings_salary_range_ck check(salary_range_min is null or salary_range_max is null or salary_range_max>=salary_range_min),
  constraint hr_job_postings_institution_code_uq unique(institution_id,job_code),
  constraint hr_job_postings_id_institution_uq unique(id,institution_id),
  constraint hr_job_postings_campus_fk foreign key(campus_id,institution_id) references public.campuses(id,institution_id),
  constraint hr_job_postings_department_fk foreign key(department_id,institution_id) references public.departments(id,institution_id),
  constraint hr_job_postings_designation_fk foreign key(designation_id,institution_id) references public.designations(id,institution_id)
);
create index if not exists hr_job_postings_status_idx on public.hr_job_postings(institution_id,status,closing_date);

create table if not exists public.hr_candidates (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  job_posting_id uuid,
  full_name text not null,
  email text not null,
  phone text,
  source text not null default 'direct',
  years_experience numeric(4,1) check(years_experience is null or years_experience>=0),
  current_employer text,
  expected_salary numeric(14,2) check(expected_salary is null or expected_salary>=0),
  notice_period_days integer check(notice_period_days is null or notice_period_days>=0),
  available_from date,
  resume_storage_path text,
  stage text not null default 'new' check(stage in ('new','screening','shortlisted','interview','offer','hired','rejected','withdrawn')),
  application_date date not null default current_date,
  notes text,
  hired_employee_id uuid,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_candidates_id_institution_uq unique(id,institution_id),
  constraint hr_candidates_job_fk foreign key(job_posting_id,institution_id) references public.hr_job_postings(id,institution_id),
  constraint hr_candidates_hired_employee_fk foreign key(hired_employee_id,institution_id) references public.teachers(id,institution_id)
);
create index if not exists hr_candidates_institution_stage_idx on public.hr_candidates(institution_id,stage,application_date desc);
create index if not exists hr_candidates_email_idx on public.hr_candidates(institution_id,lower(email));

create table if not exists public.hr_interviews (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  candidate_id uuid not null,
  scheduled_at timestamptz not null,
  interview_type text not null default 'first_round' check(interview_type in ('screening','first_round','technical','final','other')),
  mode text not null default 'in_person' check(mode in ('in_person','video','phone')),
  location_or_link text,
  interviewer_id uuid references auth.users(id) on delete set null,
  interviewer_name text,
  status text not null default 'scheduled' check(status in ('scheduled','completed','rescheduled','cancelled','no_show')),
  score numeric(5,2) check(score is null or(score>=0 and score<=100)),
  feedback text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_interviews_candidate_fk foreign key(candidate_id,institution_id) references public.hr_candidates(id,institution_id) on delete cascade
);
create index if not exists hr_interviews_candidate_date_idx on public.hr_interviews(institution_id,candidate_id,scheduled_at desc);

create table if not exists public.employee_contracts (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  teacher_id uuid not null,
  contract_no text not null,
  contract_type text not null default 'employment' check(contract_type in ('employment','fixed_term','probation','part_time','consultancy','temporary','renewal')),
  start_date date not null,
  end_date date,
  probation_end_date date,
  notice_period_days integer check(notice_period_days is null or notice_period_days>=0),
  status text not null default 'draft' check(status in ('draft','pending_approval','active','expired','terminated','superseded')),
  staff_document_id uuid,
  issued_at date,
  signed_at date,
  terminated_at date,
  termination_reason text,
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_contracts_date_ck check(end_date is null or end_date>=start_date),
  constraint employee_contracts_probation_ck check(probation_end_date is null or probation_end_date>=start_date),
  constraint employee_contracts_institution_number_uq unique(institution_id,contract_no),
  constraint employee_contracts_id_institution_uq unique(id,institution_id),
  constraint employee_contracts_employee_fk foreign key(teacher_id,institution_id) references public.teachers(id,institution_id),
  constraint employee_contracts_document_fk foreign key(staff_document_id,institution_id) references public.staff_documents(id,institution_id)
);
create index if not exists employee_contracts_employee_dates_idx on public.employee_contracts(institution_id,teacher_id,start_date desc);
create unique index if not exists employee_contracts_one_active_idx on public.employee_contracts(institution_id,teacher_id) where status='active';

create table if not exists public.employee_appraisals (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  teacher_id uuid not null,
  review_period_start date not null,
  review_period_end date not null,
  reviewer_id uuid not null references auth.users(id),
  status text not null default 'draft' check(status in ('draft','submitted','reviewed','acknowledged','cancelled')),
  overall_rating numeric(3,2) check(overall_rating is null or(overall_rating>=1 and overall_rating<=5)),
  goals text,
  strengths text,
  improvement_areas text,
  development_plan text,
  reviewer_summary text,
  employee_response text,
  next_review_date date,
  acknowledged_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_appraisals_period_ck check(review_period_end>=review_period_start),
  constraint employee_appraisals_employee_fk foreign key(teacher_id,institution_id) references public.teachers(id,institution_id)
);
create index if not exists employee_appraisals_employee_period_idx on public.employee_appraisals(institution_id,teacher_id,review_period_end desc);

create table if not exists public.alumni_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  graduation_date date not null,
  graduating_class text,
  qualification_or_award text,
  final_grade text,
  contact_email text,
  contact_phone text,
  current_organization text,
  current_occupation text,
  city text,
  communication_consent boolean not null default false,
  consent_captured_at timestamptz,
  status text not null default 'active' check(status in ('active','do_not_contact','archived')),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alumni_records_student_uq unique(institution_id,student_id),
  constraint alumni_records_student_fk foreign key(student_id,institution_id) references public.students(id,institution_id)
);
create index if not exists alumni_records_graduation_idx on public.alumni_records(institution_id,graduation_date desc);

create table if not exists public.student_health_emergency (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  blood_group text,
  allergies text,
  medical_conditions text,
  current_medications text,
  care_instructions text,
  doctor_name text,
  doctor_phone text,
  emergency_contact_name text,
  emergency_contact_relationship text,
  emergency_contact_phone text,
  additional_notes text,
  updated_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_health_emergency_student_uq unique(institution_id,student_id),
  constraint student_health_emergency_student_fk foreign key(student_id,institution_id) references public.students(id,institution_id)
);
create index if not exists student_health_emergency_student_idx on public.student_health_emergency(institution_id,student_id);

create table if not exists public.employee_salary_components (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  salary_profile_id uuid not null,
  code text not null,
  label text not null,
  component_type text not null check(component_type in ('allowance','deduction')),
  amount numeric(14,2) not null check(amount>0),
  is_taxable boolean not null default false,
  effective_from date not null,
  effective_to date,
  status text not null default 'active' check(status in ('active','inactive')),
  notes text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_salary_components_dates_ck check(effective_to is null or effective_to>=effective_from),
  constraint employee_salary_components_profile_fk foreign key(salary_profile_id,institution_id) references public.employee_salary_profiles(id,institution_id) on delete cascade
);
create index if not exists employee_salary_components_profile_idx on public.employee_salary_components(institution_id,salary_profile_id,status);

create table if not exists public.payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  teacher_id uuid not null,
  period_start date not null,
  period_end date not null,
  adjustment_type text not null check(adjustment_type in ('allowance','bonus','overtime','deduction','unpaid_leave','advance_recovery')),
  amount numeric(14,2) not null check(amount>0),
  description text not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected','applied')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  payroll_run_id uuid,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_adjustments_period_ck check(period_end>=period_start),
  constraint payroll_adjustments_employee_fk foreign key(teacher_id,institution_id) references public.teachers(id,institution_id),
  constraint payroll_adjustments_run_fk foreign key(payroll_run_id,institution_id) references public.payroll_runs(id,institution_id)
);
create index if not exists payroll_adjustments_review_idx on public.payroll_adjustments(institution_id,status,period_start,period_end);
create index if not exists payroll_adjustments_employee_idx on public.payroll_adjustments(institution_id,teacher_id,period_start);

alter table public.admission_enquiries enable row level security;
alter table public.hr_job_postings enable row level security;
alter table public.hr_candidates enable row level security;
alter table public.hr_interviews enable row level security;
alter table public.employee_contracts enable row level security;
alter table public.employee_appraisals enable row level security;
alter table public.alumni_records enable row level security;
alter table public.student_health_emergency enable row level security;
alter table public.employee_salary_components enable row level security;
alter table public.payroll_adjustments enable row level security;

drop policy if exists admission_enquiries_admin_all on public.admission_enquiries;
create policy admission_enquiries_admin_all on public.admission_enquiries for all to authenticated
 using(public.has_institution_role(institution_id,array['owner','admin']::text[]))
 with check(public.has_institution_role(institution_id,array['owner','admin']::text[]));
drop policy if exists hr_job_postings_admin_all on public.hr_job_postings;
create policy hr_job_postings_admin_all on public.hr_job_postings for all to authenticated
 using(public.has_institution_role(institution_id,array['owner','admin']::text[]))
 with check(public.has_institution_role(institution_id,array['owner','admin']::text[]));
drop policy if exists hr_candidates_admin_all on public.hr_candidates;
create policy hr_candidates_admin_all on public.hr_candidates for all to authenticated
 using(public.has_institution_role(institution_id,array['owner','admin']::text[]))
 with check(public.has_institution_role(institution_id,array['owner','admin']::text[]));
drop policy if exists hr_interviews_admin_all on public.hr_interviews;
create policy hr_interviews_admin_all on public.hr_interviews for all to authenticated
 using(public.has_institution_role(institution_id,array['owner','admin']::text[]))
 with check(public.has_institution_role(institution_id,array['owner','admin']::text[]));
drop policy if exists employee_contracts_admin_all on public.employee_contracts;
create policy employee_contracts_admin_all on public.employee_contracts for all to authenticated
 using(public.has_institution_role(institution_id,array['owner','admin']::text[]))
 with check(public.has_institution_role(institution_id,array['owner','admin']::text[]));
drop policy if exists employee_contracts_own_read on public.employee_contracts;
create policy employee_contracts_own_read on public.employee_contracts for select to authenticated
 using(status in ('active','expired','terminated','superseded') and exists(select 1 from public.teachers t where t.id=employee_contracts.teacher_id and t.institution_id=employee_contracts.institution_id and t.user_id=auth.uid()));
drop policy if exists employee_appraisals_admin_all on public.employee_appraisals;
create policy employee_appraisals_admin_all on public.employee_appraisals for all to authenticated
 using(public.has_institution_role(institution_id,array['owner','admin']::text[]))
 with check(public.has_institution_role(institution_id,array['owner','admin']::text[]));
drop policy if exists employee_appraisals_own_acknowledged_read on public.employee_appraisals;
create policy employee_appraisals_own_acknowledged_read on public.employee_appraisals for select to authenticated
 using(status='acknowledged' and exists(select 1 from public.teachers t where t.id=employee_appraisals.teacher_id and t.institution_id=employee_appraisals.institution_id and t.user_id=auth.uid()));
drop policy if exists alumni_records_admin_all on public.alumni_records;
create policy alumni_records_admin_all on public.alumni_records for all to authenticated
 using(public.has_institution_role(institution_id,array['owner','admin']::text[]))
 with check(public.has_institution_role(institution_id,array['owner','admin']::text[]));
drop policy if exists alumni_records_own_read on public.alumni_records;
create policy alumni_records_own_read on public.alumni_records for select to authenticated
 using(exists(select 1 from public.students s where s.id=alumni_records.student_id and s.institution_id=alumni_records.institution_id and s.user_id=auth.uid() and s.status='graduated'));
drop policy if exists student_health_emergency_admin_all on public.student_health_emergency;
create policy student_health_emergency_admin_all on public.student_health_emergency for all to authenticated
 using(public.has_institution_role(institution_id,array['owner','admin']::text[]))
 with check(public.has_institution_role(institution_id,array['owner','admin']::text[]));
drop policy if exists employee_salary_components_finance_read on public.employee_salary_components;
create policy employee_salary_components_finance_read on public.employee_salary_components for select to authenticated
 using(public.has_institution_role(institution_id,array['owner','admin','accountant']::text[]));
drop policy if exists employee_salary_components_finance_insert on public.employee_salary_components;
create policy employee_salary_components_finance_insert on public.employee_salary_components for insert to authenticated
 with check(public.has_institution_role(institution_id,array['owner','admin','accountant']::text[]) and created_by=auth.uid());
drop policy if exists employee_salary_components_finance_update on public.employee_salary_components;
create policy employee_salary_components_finance_update on public.employee_salary_components for update to authenticated
 using(public.has_institution_role(institution_id,array['owner','admin','accountant']::text[]))
 with check(public.has_institution_role(institution_id,array['owner','admin','accountant']::text[]));
drop policy if exists employee_salary_components_admin_delete on public.employee_salary_components;
create policy employee_salary_components_admin_delete on public.employee_salary_components for delete to authenticated
 using(public.has_institution_role(institution_id,array['owner','admin']::text[]));
drop policy if exists payroll_adjustments_finance_read on public.payroll_adjustments;
create policy payroll_adjustments_finance_read on public.payroll_adjustments for select to authenticated
 using(public.has_institution_role(institution_id,array['owner','admin','accountant']::text[]) or (status in ('approved','applied') and exists(select 1 from public.teachers t where t.id=payroll_adjustments.teacher_id and t.institution_id=payroll_adjustments.institution_id and t.user_id=auth.uid())));

grant select,insert,update,delete on public.admission_enquiries,public.hr_job_postings,public.hr_candidates,public.hr_interviews,public.employee_contracts,public.employee_appraisals,public.alumni_records,public.student_health_emergency,public.employee_salary_components to authenticated;
grant select on public.payroll_adjustments to authenticated;
revoke all on public.admission_enquiries,public.hr_job_postings,public.hr_candidates,public.hr_interviews,public.employee_contracts,public.employee_appraisals,public.alumni_records,public.student_health_emergency,public.employee_salary_components,public.payroll_adjustments from anon;

create or replace function public.convert_admission_enquiry(p_institution_id uuid,p_enquiry_id uuid,p_admission_no text,p_full_name text,p_email text,p_class_name text)
returns uuid language plpgsql set search_path='' as $function$
declare v_enquiry public.admission_enquiries; v_student_id uuid;
begin
 if auth.uid() is null or not public.has_institution_role(p_institution_id,array['owner','admin']::text[]) then raise exception 'Only an institution owner or administrator can convert an admission enquiry.'; end if;
 select * into v_enquiry from public.admission_enquiries where id=p_enquiry_id and institution_id=p_institution_id for update;
 if not found then raise exception 'Admission enquiry not found.'; end if;
 if v_enquiry.status='converted' and v_enquiry.converted_student_id is not null then return v_enquiry.converted_student_id; end if;
 if v_enquiry.status='not_interested' then raise exception 'A closed enquiry cannot be converted.'; end if;
 if nullif(btrim(coalesce(p_admission_no,'')),'') is null or nullif(btrim(coalesce(p_full_name,'')),'') is null or nullif(btrim(coalesce(p_class_name,'')),'') is null then raise exception 'Admission number, student name and class/programme are required.'; end if;
 insert into public.students(institution_id,campus_id,admission_no,full_name,email,date_of_birth,class_name,guardian_name,guardian_email,status,application_status,application_submitted_at,created_by)
 values(p_institution_id,v_enquiry.campus_id,btrim(p_admission_no),btrim(p_full_name),nullif(btrim(coalesce(p_email,'')),''),v_enquiry.date_of_birth,btrim(p_class_name),v_enquiry.guardian_name,nullif(btrim(coalesce(v_enquiry.guardian_email,'')),''),'pending','submitted',now(),auth.uid()) returning id into v_student_id;
 update public.admission_enquiries set status='converted',converted_student_id=v_student_id,updated_at=now() where id=p_enquiry_id and institution_id=p_institution_id;
 return v_student_id;
end;
$function$;
revoke all on function public.convert_admission_enquiry(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.convert_admission_enquiry(uuid,uuid,text,text,text,text) to authenticated;

create or replace function public.hire_hr_candidate(p_institution_id uuid,p_candidate_id uuid,p_employee_no text,p_joining_date date)
returns uuid language plpgsql set search_path='' as $function$
declare v_candidate public.hr_candidates; v_job public.hr_job_postings; v_employee_id uuid;
begin
 if auth.uid() is null or not public.has_institution_role(p_institution_id,array['owner','admin']::text[]) then raise exception 'Only an institution owner or administrator can hire a candidate.'; end if;
 select * into v_candidate from public.hr_candidates where id=p_candidate_id and institution_id=p_institution_id for update;
 if not found then raise exception 'Candidate not found.'; end if;
 if v_candidate.stage='hired' and v_candidate.hired_employee_id is not null then return v_candidate.hired_employee_id; end if;
 if v_candidate.stage in ('rejected','withdrawn') then raise exception 'A rejected or withdrawn candidate cannot be hired.'; end if;
 if nullif(btrim(coalesce(p_employee_no,'')),'') is null or p_joining_date is null then raise exception 'Employee number and joining date are required.'; end if;
 if v_candidate.job_posting_id is null then raise exception 'Assign the candidate to a job posting before hiring.'; end if;
 select * into v_job from public.hr_job_postings where id=v_candidate.job_posting_id and institution_id=p_institution_id;
 if not found then raise exception 'The candidate job posting is no longer available.'; end if;
 insert into public.teachers(institution_id,campus_id,employee_no,full_name,email,phone,department,department_id,designation_id,employee_type,employment_type,joining_date,employment_status,created_by)
 values(p_institution_id,v_job.campus_id,btrim(p_employee_no),v_candidate.full_name,v_candidate.email,v_candidate.phone,v_job.department,v_job.department_id,v_job.designation_id,v_job.employee_type,v_job.employment_type,p_joining_date,'active',auth.uid()) returning id into v_employee_id;
 update public.hr_candidates set stage='hired',hired_employee_id=v_employee_id,updated_at=now() where id=p_candidate_id and institution_id=p_institution_id;
 update public.hr_job_postings set status=case when openings <= (select count(*) from public.hr_candidates c where c.job_posting_id=v_job.id and c.institution_id=p_institution_id and c.stage='hired') then 'filled' else status end,updated_at=now() where id=v_job.id and institution_id=p_institution_id;
 return v_employee_id;
end;
$function$;
revoke all on function public.hire_hr_candidate(uuid,uuid,text,date) from public,anon;
grant execute on function public.hire_hr_candidate(uuid,uuid,text,date) to authenticated;

create or replace function public.create_payroll_adjustment(p_institution_id uuid,p_teacher_id uuid,p_period_start date,p_period_end date,p_adjustment_type text,p_amount numeric,p_description text)
returns uuid language plpgsql security definer set search_path='' as $function$
declare v_id uuid;
begin
 if auth.uid() is null or not public.has_institution_role(p_institution_id,array['owner','admin','accountant']::text[]) then raise exception 'You do not have permission to submit payroll adjustments.'; end if;
 if p_period_start is null or p_period_end is null or p_period_end<p_period_start then raise exception 'Enter a valid adjustment period.'; end if;
 if p_amount is null or p_amount<=0 then raise exception 'Adjustment amount must be greater than zero.'; end if;
 if p_adjustment_type not in ('allowance','bonus','overtime','deduction','unpaid_leave','advance_recovery') then raise exception 'Unsupported payroll adjustment type.'; end if;
 if not exists(select 1 from public.teachers t where t.id=p_teacher_id and t.institution_id=p_institution_id) then raise exception 'Employee does not belong to this institution.'; end if;
 if exists(select 1 from public.payroll_runs r where r.institution_id=p_institution_id and r.period_start=p_period_start and r.period_end=p_period_end and r.status<>'cancelled') then raise exception 'This payroll period already exists. Adjustments must be approved before generating the draft run.'; end if;
 insert into public.payroll_adjustments(institution_id,teacher_id,period_start,period_end,adjustment_type,amount,description,status,created_by)
 values(p_institution_id,p_teacher_id,p_period_start,p_period_end,p_adjustment_type,round(p_amount,2),nullif(btrim(coalesce(p_description,'')),''),'pending',auth.uid()) returning id into v_id;
 return v_id;
end;
$function$;
revoke all on function public.create_payroll_adjustment(uuid,uuid,date,date,text,numeric,text) from public,anon;
grant execute on function public.create_payroll_adjustment(uuid,uuid,date,date,text,numeric,text) to authenticated;

create or replace function public.review_payroll_adjustment(p_institution_id uuid,p_adjustment_id uuid,p_decision text,p_review_notes text default null)
returns public.payroll_adjustments language plpgsql security definer set search_path='' as $function$
declare v_adjustment public.payroll_adjustments;
begin
 if auth.uid() is null or not public.has_institution_role(p_institution_id,array['owner','admin']::text[]) then raise exception 'Only an institution owner or administrator can approve payroll adjustments.'; end if;
 if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected.'; end if;
 select * into v_adjustment from public.payroll_adjustments where id=p_adjustment_id and institution_id=p_institution_id for update;
 if not found then raise exception 'Payroll adjustment not found.'; end if;
 if v_adjustment.status<>'pending' then raise exception 'Only pending adjustments can be reviewed.'; end if;
 if exists(select 1 from public.payroll_runs r where r.institution_id=p_institution_id and r.period_start=v_adjustment.period_start and r.period_end=v_adjustment.period_end and r.status<>'cancelled') then raise exception 'A payroll run already exists for this period; the adjustment cannot be changed.'; end if;
 update public.payroll_adjustments set status=p_decision,reviewed_by=auth.uid(),reviewed_at=now(),review_notes=nullif(btrim(coalesce(p_review_notes,'')),''),updated_at=now() where id=p_adjustment_id and institution_id=p_institution_id returning * into v_adjustment;
 return v_adjustment;
end;
$function$;
revoke all on function public.review_payroll_adjustment(uuid,uuid,text,text) from public,anon;
grant execute on function public.review_payroll_adjustment(uuid,uuid,text,text) to authenticated;

create or replace function public.generate_payroll_run(p_institution_id uuid,p_period_start date,p_period_end date,p_pay_date date,p_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $function$
declare v_run_id uuid; v_count integer;
begin
 if auth.uid() is null then raise exception 'Authentication is required.'; end if;
 if not public.has_institution_role(p_institution_id,array['owner','admin','accountant']::text[]) then raise exception 'You do not have permission to generate payroll for this institution.'; end if;
 if p_period_start is null or p_period_end is null or p_period_end<p_period_start then raise exception 'Enter a valid payroll period.'; end if;
 if p_pay_date is null then raise exception 'Enter a payroll payment date.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text||':'||p_period_start::text||':'||p_period_end::text,0));
 if exists(select 1 from public.payroll_runs r where r.institution_id=p_institution_id and r.period_start=p_period_start and r.period_end=p_period_end) then raise exception 'A payroll run already exists for this exact period. Review the existing run before generating another.'; end if;
 insert into public.payroll_runs(institution_id,period_start,period_end,pay_date,status,notes,created_by) values(p_institution_id,p_period_start,p_period_end,p_pay_date,'draft',nullif(btrim(coalesce(p_notes,'')),''),auth.uid()) returning id into v_run_id;
 insert into public.payroll_items(institution_id,payroll_run_id,teacher_id,base_salary,allowances,deductions,advance_recovery,gross_pay,net_pay,payment_status,notes)
 select p_institution_id,v_run_id,p.teacher_id,round(p.base_salary,2),
  round(p.monthly_allowances+coalesce(c.allowance_total,0)+coalesce(a.allowance_total,0),2),
  round(p.monthly_deductions+coalesce(c.deduction_total,0)+coalesce(a.deduction_total,0),2),
  round(coalesce(a.advance_recovery,0),2),
  round(p.base_salary+p.monthly_allowances+coalesce(c.allowance_total,0)+coalesce(a.allowance_total,0),2),
  round(p.base_salary+p.monthly_allowances+coalesce(c.allowance_total,0)+coalesce(a.allowance_total,0)-p.monthly_deductions-coalesce(c.deduction_total,0)-coalesce(a.deduction_total,0)-coalesce(a.advance_recovery,0),2),
  'unpaid',nullif(btrim(coalesce(p.notes,'')),'')
 from public.employee_salary_profiles p join public.teachers t on t.id=p.teacher_id and t.institution_id=p.institution_id
 left join lateral (select coalesce(sum(sc.amount) filter(where sc.component_type='allowance'),0) allowance_total,coalesce(sum(sc.amount) filter(where sc.component_type='deduction'),0) deduction_total
  from public.employee_salary_components sc where sc.institution_id=p_institution_id and sc.salary_profile_id=p.id and sc.status='active' and sc.effective_from<=p_period_end and (sc.effective_to is null or sc.effective_to>=p_period_start)) c on true
 left join lateral (select coalesce(sum(pa.amount) filter(where pa.adjustment_type in ('allowance','bonus','overtime')),0) allowance_total,coalesce(sum(pa.amount) filter(where pa.adjustment_type in ('deduction','unpaid_leave')),0) deduction_total,coalesce(sum(pa.amount) filter(where pa.adjustment_type='advance_recovery'),0) advance_recovery
  from public.payroll_adjustments pa where pa.institution_id=p_institution_id and pa.teacher_id=p.teacher_id and pa.period_start=p_period_start and pa.period_end=p_period_end and pa.status='approved') a on true
 where p.institution_id=p_institution_id and p.status='active' and p.effective_from<=p_period_end and (p.effective_to is null or p.effective_to>=p_period_start) and coalesce(t.employment_status,'active')='active';
 get diagnostics v_count=row_count;
 if v_count=0 then raise exception 'No active employees have an effective salary profile for this period. Add salary profiles before generating payroll.'; end if;
 update public.payroll_adjustments pa set status='applied',payroll_run_id=v_run_id,updated_at=now()
  where pa.institution_id=p_institution_id and pa.period_start=p_period_start and pa.period_end=p_period_end and pa.status='approved'
   and exists(select 1 from public.payroll_items pi where pi.institution_id=p_institution_id and pi.payroll_run_id=v_run_id and pi.teacher_id=pa.teacher_id);
 return v_run_id;
end;
$function$;
revoke all on function public.generate_payroll_run(uuid,date,date,date,text) from public,anon;
grant execute on function public.generate_payroll_run(uuid,date,date,date,text) to authenticated;

commit;
