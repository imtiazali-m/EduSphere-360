-- EduSphere 360: question bank, curriculum, student care, certificates, visitor and facilities records.
-- Additive relational schema. Every domain is institution-scoped and RLS protected.
begin;

-- Composite keys allow every relationship to prove that both records belong to the same institution.
alter table public.subjects add constraint subjects_id_institution_uq unique(id,institution_id);
alter table public.classes add constraint classes_id_institution_uq unique(id,institution_id);
alter table public.academic_sessions add constraint academic_sessions_id_institution_uq unique(id,institution_id);
alter table public.teachers add constraint teachers_id_institution_uq unique(id,institution_id);
alter table public.students add constraint students_id_institution_uq unique(id,institution_id);
alter table public.institution_rooms add constraint institution_rooms_id_institution_uq unique(id,institution_id);

create table public.question_bank_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  subject_id uuid,
  class_id uuid,
  academic_session_id uuid,
  question_code text not null,
  question_type text not null check(question_type in ('multiple_choice','true_false','short_answer','long_answer','fill_blank')),
  prompt text not null,
  options jsonb not null default '[]'::jsonb check(jsonb_typeof(options)='array'),
  answer_key jsonb not null default 'null'::jsonb,
  explanation text,
  marks numeric(8,2) not null default 1 check(marks>0),
  difficulty text not null default 'medium' check(difficulty in ('easy','medium','hard')),
  topic text,
  tags text[] not null default '{}',
  status text not null default 'draft' check(status in ('draft','review','published','archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_bank_subject_fk foreign key(subject_id,institution_id) references public.subjects(id,institution_id) on delete restrict,
  constraint question_bank_class_fk foreign key(class_id,institution_id) references public.classes(id,institution_id) on delete restrict,
  constraint question_bank_session_fk foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete restrict,
  constraint question_bank_institution_code_uq unique(institution_id,question_code),
  constraint question_bank_items_id_institution_uq unique(id,institution_id)
);
create index question_bank_filter_idx on public.question_bank_items(institution_id,status,subject_id,class_id,difficulty);
create index question_bank_created_idx on public.question_bank_items(institution_id,created_by,created_at desc);

create table public.assessment_papers (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  paper_code text not null,
  title text not null,
  subject_id uuid,
  class_id uuid,
  academic_session_id uuid,
  examination_id uuid,
  duration_minutes integer not null check(duration_minutes>0),
  maximum_marks numeric(8,2) not null check(maximum_marks>0),
  instructions text,
  status text not null default 'draft' check(status in ('draft','review','approved','archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_papers_subject_fk foreign key(subject_id,institution_id) references public.subjects(id,institution_id) on delete restrict,
  constraint assessment_papers_class_fk foreign key(class_id,institution_id) references public.classes(id,institution_id) on delete restrict,
  constraint assessment_papers_session_fk foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete restrict,
  constraint assessment_papers_code_uq unique(institution_id,paper_code),
  constraint assessment_papers_id_institution_uq unique(id,institution_id)
);
create index assessment_papers_status_idx on public.assessment_papers(institution_id,status,created_at desc);

create table public.assessment_paper_items (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  paper_id uuid not null,
  question_id uuid not null,
  sequence_no integer not null check(sequence_no>0),
  marks_override numeric(8,2) check(marks_override is null or marks_override>0),
  created_at timestamptz not null default now(),
  constraint assessment_paper_items_paper_fk foreign key(paper_id,institution_id) references public.assessment_papers(id,institution_id) on delete cascade,
  constraint assessment_paper_items_question_fk foreign key(question_id,institution_id) references public.question_bank_items(id,institution_id) on delete restrict,
  constraint assessment_paper_items_sequence_uq unique(paper_id,sequence_no),
  constraint assessment_paper_items_question_uq unique(paper_id,question_id)
);
create index assessment_paper_items_question_idx on public.assessment_paper_items(institution_id,question_id);

create table public.curriculum_units (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  unit_code text,
  title text not null,
  subject_id uuid not null,
  class_id uuid not null,
  academic_session_id uuid,
  sequence_no integer not null default 1 check(sequence_no>0),
  overview text,
  learning_objectives jsonb not null default '[]'::jsonb check(jsonb_typeof(learning_objectives)='array'),
  learning_outcomes jsonb not null default '[]'::jsonb check(jsonb_typeof(learning_outcomes)='array'),
  resource_links jsonb not null default '[]'::jsonb check(jsonb_typeof(resource_links)='array'),
  planned_start date,
  planned_end date,
  status text not null default 'planned' check(status in ('planned','in_progress','completed','published','archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_units_subject_fk foreign key(subject_id,institution_id) references public.subjects(id,institution_id) on delete restrict,
  constraint curriculum_units_class_fk foreign key(class_id,institution_id) references public.classes(id,institution_id) on delete restrict,
  constraint curriculum_units_session_fk foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete restrict,
  constraint curriculum_units_dates_check check(planned_end is null or planned_start is null or planned_end>=planned_start),
  constraint curriculum_units_code_uq unique(institution_id,unit_code,class_id,academic_session_id)
);
create index curriculum_units_class_idx on public.curriculum_units(institution_id,class_id,academic_session_id,sequence_no);
create index curriculum_units_subject_idx on public.curriculum_units(institution_id,subject_id,status);

create table public.student_behaviour_events (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  event_type text not null check(event_type in ('positive','concern','incident','safeguarding')),
  category text not null,
  severity text not null default 'low' check(severity in ('low','medium','high','critical')),
  event_date date not null default current_date,
  summary text not null,
  description text,
  action_taken text,
  follow_up_required boolean not null default false,
  follow_up_date date,
  family_visible boolean not null default false,
  status text not null default 'open' check(status in ('open','follow_up','resolved','closed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_behaviour_student_fk foreign key(student_id,institution_id) references public.students(id,institution_id) on delete restrict,
  constraint student_behaviour_follow_up_check check(not follow_up_required or follow_up_date is not null)
);
create index student_behaviour_student_date_idx on public.student_behaviour_events(institution_id,student_id,event_date desc);
create index student_behaviour_follow_up_idx on public.student_behaviour_events(institution_id,status,follow_up_date) where follow_up_required;

create table public.student_certificates (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  student_id uuid not null,
  certificate_no text not null,
  verification_code text not null,
  certificate_type text not null,
  title text not null,
  achievement text,
  issue_date date,
  expiry_date date,
  signatory_name text,
  status text not null default 'draft' check(status in ('draft','issued','revoked')),
  remarks text,
  issued_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_certificates_student_fk foreign key(student_id,institution_id) references public.students(id,institution_id) on delete restrict,
  constraint student_certificates_number_uq unique(institution_id,certificate_no),
  constraint student_certificates_verification_uq unique(verification_code),
  constraint student_certificates_dates_check check(expiry_date is null or issue_date is null or expiry_date>=issue_date),
  constraint student_certificates_issue_state_check check(status<>'issued' or (issue_date is not null and issued_by is not null))
);
create index student_certificates_student_idx on public.student_certificates(institution_id,student_id,issue_date desc,status);

create table public.visitor_entries (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  visitor_name text not null,
  phone text,
  email text,
  organization text,
  purpose text not null,
  host_teacher_id uuid,
  visit_date date not null default current_date,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  badge_number text,
  status text not null default 'expected' check(status in ('expected','checked_in','checked_out','denied','cancelled')),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visitor_entries_host_fk foreign key(host_teacher_id,institution_id) references public.teachers(id,institution_id) on delete set null (host_teacher_id),
  constraint visitor_entries_checkout_check check(checked_out_at is null or checked_in_at is not null),
  constraint visitor_entries_badge_uq unique(institution_id,badge_number)
);
create index visitor_entries_date_idx on public.visitor_entries(institution_id,visit_date desc,status);
create index visitor_entries_host_idx on public.visitor_entries(institution_id,host_teacher_id,visit_date desc);

create table public.facility_assets (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  asset_code text not null,
  asset_name text not null,
  category text not null,
  room_id uuid,
  building text,
  condition text not null default 'good' check(condition in ('excellent','good','fair','poor','out_of_service')),
  status text not null default 'active' check(status in ('active','maintenance','retired','disposed')),
  acquired_on date,
  replacement_due date,
  purchase_cost numeric(14,2) check(purchase_cost is null or purchase_cost>=0),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facility_assets_room_fk foreign key(room_id,institution_id) references public.institution_rooms(id,institution_id) on delete set null (room_id),
  constraint facility_assets_code_uq unique(institution_id,asset_code),
  constraint facility_assets_id_institution_uq unique(id,institution_id)
);
create index facility_assets_category_idx on public.facility_assets(institution_id,category,status);

create table public.facility_maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  asset_id uuid,
  room_id uuid,
  title text not null,
  description text not null,
  priority text not null default 'medium' check(priority in ('low','medium','high','urgent')),
  status text not null default 'submitted' check(status in ('submitted','assigned','in_progress','on_hold','completed','cancelled')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  assigned_to uuid,
  requested_at timestamptz not null default now(),
  scheduled_for date,
  resolved_at timestamptz,
  resolution_notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facility_maintenance_asset_fk foreign key(asset_id,institution_id) references public.facility_assets(id,institution_id) on delete restrict,
  constraint facility_maintenance_room_fk foreign key(room_id,institution_id) references public.institution_rooms(id,institution_id) on delete restrict,
  constraint facility_maintenance_assignee_fk foreign key(assigned_to,institution_id) references public.teachers(id,institution_id) on delete set null (assigned_to),
  constraint facility_maintenance_resolved_check check(status<>'completed' or resolved_at is not null)
);
create index facility_maintenance_status_idx on public.facility_maintenance_requests(institution_id,status,priority,requested_at desc);
create index facility_maintenance_requester_idx on public.facility_maintenance_requests(institution_id,requested_by,requested_at desc);

-- Enable RLS and issue explicit authenticated access. No anonymous direct data access.
do $policy$
declare t text;
begin
 foreach t in array array[
  'question_bank_items','assessment_papers','assessment_paper_items','curriculum_units',
  'student_behaviour_events','student_certificates','visitor_entries','facility_assets','facility_maintenance_requests'
 ] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('revoke all on public.%I from anon',t);
 end loop;
end
$policy$;

-- Question Bank: exam officers and institution admins manage all; teachers manage only their own drafts.
create policy question_bank_read on public.question_bank_items for select to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])
 or (public.has_institution_role(institution_id,array['teacher']::text[]) and created_by=(select auth.uid()))
);
create policy question_bank_insert on public.question_bank_items for insert to authenticated with check(
 created_by=(select auth.uid()) and public.has_institution_role(institution_id,array['owner','admin','teacher','exam_officer']::text[])
);
create policy question_bank_update on public.question_bank_items for update to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])
 or (public.has_institution_role(institution_id,array['teacher']::text[]) and created_by=(select auth.uid()) and status in ('draft','review'))
) with check(
 public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])
 or (public.has_institution_role(institution_id,array['teacher']::text[]) and created_by=(select auth.uid()) and status in ('draft','review'))
);
create policy question_bank_delete on public.question_bank_items for delete to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])
 or (public.has_institution_role(institution_id,array['teacher']::text[]) and created_by=(select auth.uid()) and status='draft')
);

create policy assessment_papers_read on public.assessment_papers for select to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])
 or (public.has_institution_role(institution_id,array['teacher']::text[]) and created_by=(select auth.uid()))
);
create policy assessment_papers_insert on public.assessment_papers for insert to authenticated with check(
 created_by=(select auth.uid()) and public.has_institution_role(institution_id,array['owner','admin','teacher','exam_officer']::text[])
);
create policy assessment_papers_update on public.assessment_papers for update to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])
 or (public.has_institution_role(institution_id,array['teacher']::text[]) and created_by=(select auth.uid()) and status in ('draft','review'))
) with check(
 public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])
 or (public.has_institution_role(institution_id,array['teacher']::text[]) and created_by=(select auth.uid()) and status in ('draft','review'))
);
create policy assessment_papers_delete on public.assessment_papers for delete to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin','exam_officer']::text[])
 or (public.has_institution_role(institution_id,array['teacher']::text[]) and created_by=(select auth.uid()) and status='draft')
);
create policy assessment_paper_items_read on public.assessment_paper_items for select to authenticated using(
 exists(select 1 from public.assessment_papers p where p.id=paper_id and p.institution_id=assessment_paper_items.institution_id)
);
create policy assessment_paper_items_insert on public.assessment_paper_items for insert to authenticated with check(
 exists(select 1 from public.assessment_papers p where p.id=paper_id and p.institution_id=assessment_paper_items.institution_id and p.status='draft'
  and (public.has_institution_role(p.institution_id,array['owner','admin','exam_officer']::text[]) or (public.has_institution_role(p.institution_id,array['teacher']::text[]) and p.created_by=(select auth.uid()))))
);
create policy assessment_paper_items_update on public.assessment_paper_items for update to authenticated using(
 exists(select 1 from public.assessment_papers p where p.id=paper_id and p.institution_id=assessment_paper_items.institution_id and p.status='draft'
  and (public.has_institution_role(p.institution_id,array['owner','admin','exam_officer']::text[]) or (public.has_institution_role(p.institution_id,array['teacher']::text[]) and p.created_by=(select auth.uid()))))
) with check(
 exists(select 1 from public.assessment_papers p where p.id=paper_id and p.institution_id=assessment_paper_items.institution_id and p.status='draft'
  and (public.has_institution_role(p.institution_id,array['owner','admin','exam_officer']::text[]) or (public.has_institution_role(p.institution_id,array['teacher']::text[]) and p.created_by=(select auth.uid()))))
);
create policy assessment_paper_items_delete on public.assessment_paper_items for delete to authenticated using(
 exists(select 1 from public.assessment_papers p where p.id=paper_id and p.institution_id=assessment_paper_items.institution_id and p.status='draft'
  and (public.has_institution_role(p.institution_id,array['owner','admin','exam_officer']::text[]) or (public.has_institution_role(p.institution_id,array['teacher']::text[]) and p.created_by=(select auth.uid()))))
);

-- Curriculum: institution admin/teachers manage; linked learners/families read only published units.
create policy curriculum_units_read on public.curriculum_units for select to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin','teacher']::text[])
 or (
  status='published'
  and exists(select 1 from public.students s join public.classes c on c.institution_id=s.institution_id and c.name=s.class_name
   where s.institution_id=curriculum_units.institution_id and c.id=curriculum_units.class_id
    and (s.user_id=(select auth.uid()) or public.can_view_student(s.id)))
 )
);
create policy curriculum_units_insert on public.curriculum_units for insert to authenticated with check(
 created_by=(select auth.uid()) and public.has_institution_role(institution_id,array['owner','admin','teacher']::text[])
);
create policy curriculum_units_update on public.curriculum_units for update to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
 or (public.has_institution_role(institution_id,array['teacher']::text[]) and created_by=(select auth.uid()))
) with check(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
 or (public.has_institution_role(institution_id,array['teacher']::text[]) and created_by=(select auth.uid()))
);
create policy curriculum_units_delete on public.curriculum_units for delete to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
 or (public.has_institution_role(institution_id,array['teacher']::text[]) and created_by=(select auth.uid()))
);

-- Behaviour: staff records remain confidential; linked learners/families see only explicitly family-visible entries.
create policy student_behaviour_read on public.student_behaviour_events for select to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin','teacher']::text[])
 or (family_visible and public.can_view_student(student_id))
);
create policy student_behaviour_insert on public.student_behaviour_events for insert to authenticated with check(
 created_by=(select auth.uid()) and public.has_institution_role(institution_id,array['owner','admin','teacher']::text[])
);
create policy student_behaviour_update on public.student_behaviour_events for update to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
 or (public.has_institution_role(institution_id,array['teacher']::text[]) and created_by=(select auth.uid()))
) with check(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
 or (public.has_institution_role(institution_id,array['teacher']::text[]) and created_by=(select auth.uid()))
);
create policy student_behaviour_delete on public.student_behaviour_events for delete to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
);

-- Certificates: staff issue/revoke; learners and linked guardians can read only issued certificates.
create policy student_certificates_read on public.student_certificates for select to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin','teacher']::text[])
 or (status='issued' and public.can_view_student(student_id))
);
create policy student_certificates_insert on public.student_certificates for insert to authenticated with check(
 created_by=(select auth.uid()) and public.has_institution_role(institution_id,array['owner','admin']::text[])
);
create policy student_certificates_update on public.student_certificates for update to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
) with check(public.has_institution_role(institution_id,array['owner','admin']::text[]));
create policy student_certificates_delete on public.student_certificates for delete to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin']::text[]) and status='draft'
);

-- Visitors: administrators see all; teachers see visits hosted by their own staff profile and can register a visit.
create policy visitor_entries_read on public.visitor_entries for select to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
 or exists(select 1 from public.teachers t where t.id=host_teacher_id and t.institution_id=visitor_entries.institution_id and t.user_id=(select auth.uid()))
);
create policy visitor_entries_insert on public.visitor_entries for insert to authenticated with check(
 created_by=(select auth.uid()) and (
  public.has_institution_role(institution_id,array['owner','admin']::text[])
  or (public.has_institution_role(institution_id,array['teacher']::text[]) and exists(select 1 from public.teachers t where t.id=host_teacher_id and t.institution_id=visitor_entries.institution_id and t.user_id=(select auth.uid())))
 )
);
create policy visitor_entries_update on public.visitor_entries for update to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
 or exists(select 1 from public.teachers t where t.id=host_teacher_id and t.institution_id=visitor_entries.institution_id and t.user_id=(select auth.uid()))
) with check(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
 or exists(select 1 from public.teachers t where t.id=host_teacher_id and t.institution_id=visitor_entries.institution_id and t.user_id=(select auth.uid()))
);
create policy visitor_entries_delete on public.visitor_entries for delete to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
);

-- Facilities: admin maintains asset inventory; teachers may raise/track their own maintenance requests.
create policy facility_assets_read on public.facility_assets for select to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin','teacher']::text[])
);
create policy facility_assets_admin_insert on public.facility_assets for insert to authenticated with check(
 created_by=(select auth.uid()) and public.has_institution_role(institution_id,array['owner','admin']::text[])
);
create policy facility_assets_admin_update on public.facility_assets for update to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
) with check(public.has_institution_role(institution_id,array['owner','admin']::text[]));
create policy facility_assets_admin_delete on public.facility_assets for delete to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
);
create policy facility_maintenance_read on public.facility_maintenance_requests for select to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
 or requested_by=(select auth.uid())
);
create policy facility_maintenance_insert on public.facility_maintenance_requests for insert to authenticated with check(
 requested_by=(select auth.uid()) and public.has_institution_role(institution_id,array['owner','admin','teacher']::text[])
);
create policy facility_maintenance_admin_update on public.facility_maintenance_requests for update to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
) with check(public.has_institution_role(institution_id,array['owner','admin']::text[]));
create policy facility_maintenance_admin_delete on public.facility_maintenance_requests for delete to authenticated using(
 public.has_institution_role(institution_id,array['owner','admin']::text[])
);

commit;
