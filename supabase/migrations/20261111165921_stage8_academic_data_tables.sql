do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.curriculum_units'::regclass and conname='curriculum_units_id_institution_unique') then
  alter table public.curriculum_units add constraint curriculum_units_id_institution_unique unique(id,institution_id);
 end if;
end $$;

create table if not exists public.academic_terms(
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 academic_session_id uuid not null, term_name text not null, term_code text,
 term_type text not null default 'term' check(term_type in('term','semester','quarter','trimester','module')),
 term_order int not null default 1 check(term_order>0), start_date date not null, end_date date not null,
 status text not null default 'planned' check(status in('planned','active','completed','cancelled')),
 is_current boolean not null default false, notes text, created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(end_date>=start_date), foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete cascade
);
create unique index if not exists academic_terms_session_order_uidx on public.academic_terms(institution_id,academic_session_id,term_order);
create unique index if not exists academic_terms_one_current_uidx on public.academic_terms(institution_id,academic_session_id) where is_current;

create table if not exists public.class_teacher_assignments(
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 class_id uuid not null, teacher_id uuid not null, academic_session_id uuid not null, is_primary boolean not null default true,
 start_date date, end_date date, status text not null default 'active' check(status in('active','ended','cancelled')),
 notes text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(end_date is null or start_date is null or end_date>=start_date),
 foreign key(class_id,institution_id) references public.classes(id,institution_id) on delete cascade,
 foreign key(teacher_id,institution_id) references public.teachers(id,institution_id) on delete cascade,
 foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete cascade
);
create index if not exists class_teacher_teacher_idx on public.class_teacher_assignments(institution_id,teacher_id,status);
create unique index if not exists class_teacher_primary_uidx on public.class_teacher_assignments(institution_id,class_id,academic_session_id) where is_primary and status='active';

create table if not exists public.lesson_plans(
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 class_id uuid not null, subject_id uuid not null, academic_session_id uuid, teacher_id uuid,
 title text not null, topic text not null, learning_objectives text, teaching_method text, resources text,
 planned_date date, duration_minutes int check(duration_minutes is null or duration_minutes between 1 and 600),
 status text not null default 'planned' check(status in('draft','planned','in_progress','completed','cancelled')),
 completion_notes text, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(class_id,institution_id) references public.classes(id,institution_id) on delete cascade,
 foreign key(subject_id,institution_id) references public.subjects(id,institution_id) on delete restrict,
 foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete restrict,
 foreign key(teacher_id,institution_id) references public.teachers(id,institution_id) on delete restrict
);
create index if not exists lesson_plans_class_date_idx on public.lesson_plans(institution_id,class_id,planned_date);

create table if not exists public.study_materials(
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 class_id uuid, subject_id uuid, academic_session_id uuid, title text not null, description text,
 material_type text not null default 'document' check(material_type in('document','pdf','presentation','video','audio','link','image','other')),
 storage_path text, external_url text, file_name text, mime_type text, file_size_bytes bigint check(file_size_bytes is null or file_size_bytes>=0),
 visibility text not null default 'draft' check(visibility in('draft','published','archived')),
 available_from date, available_until date, uploaded_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(storage_path is not null or external_url is not null), check(available_until is null or available_from is null or available_until>=available_from),
 foreign key(class_id,institution_id) references public.classes(id,institution_id) on delete restrict,
 foreign key(subject_id,institution_id) references public.subjects(id,institution_id) on delete restrict,
 foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete restrict
);
create index if not exists study_materials_class_idx on public.study_materials(institution_id,class_id,visibility,created_at desc);

create table if not exists public.learning_courses(
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 class_id uuid not null, subject_id uuid, academic_session_id uuid, title text not null, course_code text,
 description text, learning_outcomes text, is_optional boolean not null default true,
 status text not null default 'draft' check(status in('draft','published','archived')),
 start_date date, end_date date, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(end_date is null or start_date is null or end_date>=start_date),
 foreign key(class_id,institution_id) references public.classes(id,institution_id) on delete cascade,
 foreign key(subject_id,institution_id) references public.subjects(id,institution_id) on delete restrict,
 foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete restrict,
 unique(id,institution_id)
);
create index if not exists learning_courses_class_idx on public.learning_courses(institution_id,class_id,status);

create table if not exists public.learning_course_units(
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 course_id uuid not null, unit_order int not null default 1 check(unit_order>0), title text not null, content text, resource_url text,
 estimated_minutes int check(estimated_minutes is null or estimated_minutes>0), is_required boolean not null default true,
 status text not null default 'draft' check(status in('draft','published','archived')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(course_id,institution_id) references public.learning_courses(id,institution_id) on delete cascade,
 unique(id,institution_id), unique(course_id,unit_order)
);
create index if not exists learning_course_units_order_idx on public.learning_course_units(institution_id,course_id,unit_order);

create table if not exists public.learning_course_progress(
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 course_id uuid not null, unit_id uuid not null, student_id uuid not null,
 status text not null default 'not_started' check(status in('not_started','in_progress','completed')),
 completion_percent numeric(5,2) not null default 0 check(completion_percent between 0 and 100),
 completed_at timestamptz, last_accessed_at timestamptz not null default now(), teacher_feedback text,
 updated_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(course_id,institution_id) references public.learning_courses(id,institution_id) on delete cascade,
 foreign key(unit_id,institution_id) references public.learning_course_units(id,institution_id) on delete cascade,
 foreign key(student_id,institution_id) references public.students(id,institution_id) on delete cascade,
 unique(institution_id,course_id,unit_id,student_id)
);
create index if not exists learning_course_progress_student_idx on public.learning_course_progress(institution_id,student_id,status);

create table if not exists public.classroom_activities(
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 class_id uuid not null, subject_id uuid, academic_session_id uuid, teacher_id uuid, activity_date date not null default current_date,
 activity_type text not null default 'classwork' check(activity_type in('classwork','discussion','project','presentation','practical','group_work','participation','other')),
 title text not null, description text, participation_summary text, visibility text not null default 'staff_only' check(visibility in('staff_only','published')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(class_id,institution_id) references public.classes(id,institution_id) on delete cascade,
 foreign key(subject_id,institution_id) references public.subjects(id,institution_id) on delete restrict,
 foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete restrict,
 foreign key(teacher_id,institution_id) references public.teachers(id,institution_id) on delete restrict,
 unique(id,institution_id)
);
create index if not exists classroom_activities_class_date_idx on public.classroom_activities(institution_id,class_id,activity_date desc);

create table if not exists public.classroom_activity_participants(
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 activity_id uuid not null, student_id uuid not null,
 participation_status text not null default 'participated' check(participation_status in('participated','noted','not_participated','absent')),
 notes text, recorded_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(activity_id,institution_id) references public.classroom_activities(id,institution_id) on delete cascade,
 foreign key(student_id,institution_id) references public.students(id,institution_id) on delete cascade,
 unique(activity_id,student_id)
);
create index if not exists classroom_participant_student_idx on public.classroom_activity_participants(institution_id,student_id);

create table if not exists public.academic_calendar_events(
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 academic_session_id uuid, campus_id uuid, class_id uuid, title text not null,
 event_type text not null default 'event' check(event_type in('holiday','event','examination','assessment','milestone','deadline','meeting','other')),
 description text, start_date date not null, end_date date not null, all_day boolean not null default true,
 start_time time, end_time time, audience text not null default 'all' check(audience in('all','staff','students','parents','students_and_parents')),
 status text not null default 'draft' check(status in('draft','published','cancelled')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(end_date>=start_date), check(end_time is null or start_time is null or end_time>start_time),
 foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete restrict,
 foreign key(campus_id,institution_id) references public.campuses(id,institution_id) on delete restrict,
 foreign key(class_id,institution_id) references public.classes(id,institution_id) on delete restrict
);
create index if not exists academic_calendar_date_idx on public.academic_calendar_events(institution_id,start_date,end_date,status);

create table if not exists public.learning_progress(
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 student_id uuid not null, class_id uuid not null, subject_id uuid not null, curriculum_unit_id uuid, academic_session_id uuid,
 progress_status text not null default 'not_started' check(progress_status in('not_started','in_progress','completed','needs_support')),
 completion_percent numeric(5,2) not null default 0 check(completion_percent between 0 and 100),
 assessment_score numeric(7,2) check(assessment_score is null or assessment_score>=0),
 teacher_notes text, intervention_required boolean not null default false, intervention_notes text, assessed_on date not null default current_date,
 recorded_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(student_id,institution_id) references public.students(id,institution_id) on delete cascade,
 foreign key(class_id,institution_id) references public.classes(id,institution_id) on delete cascade,
 foreign key(subject_id,institution_id) references public.subjects(id,institution_id) on delete restrict,
 foreign key(curriculum_unit_id,institution_id) references public.curriculum_units(id,institution_id) on delete restrict,
 foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete restrict
);
create index if not exists learning_progress_student_date_idx on public.learning_progress(institution_id,student_id,assessed_on desc);
create index if not exists learning_progress_intervention_idx on public.learning_progress(institution_id,intervention_required) where intervention_required;

create table if not exists public.academic_preferences(
 institution_id uuid primary key references public.institutions(id) on delete cascade,
 online_learning_enabled boolean not null default false, updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);

create or replace function public.can_teach_class(target_institution uuid,target_class uuid)
returns boolean language sql stable security definer set search_path=public as $function$
 select exists(select 1 from public.teachers t join public.teacher_assignments ta on ta.teacher_id=t.id and ta.institution_id=t.institution_id
 where t.institution_id=target_institution and ta.class_id=target_class and t.user_id=(select auth.uid()) and ta.status='active')
 or exists(select 1 from public.class_teacher_assignments cta join public.teachers t on t.id=cta.teacher_id and t.institution_id=cta.institution_id
 where cta.institution_id=target_institution and cta.class_id=target_class and t.user_id=(select auth.uid()) and cta.status='active');
$function$;
revoke all on function public.can_teach_class(uuid,uuid) from public;
grant execute on function public.can_teach_class(uuid,uuid) to authenticated;

do $$ declare t text; begin foreach t in array array['academic_terms','class_teacher_assignments','lesson_plans','study_materials','learning_courses','learning_course_units','learning_course_progress','classroom_activities','classroom_activity_participants','academic_calendar_events','learning_progress','academic_preferences'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
end loop; end $$;

create or replace function public.prevent_academic_timetable_conflicts()
returns trigger language plpgsql security definer set search_path=public as $function$
declare conflict_reason text;
begin
 if new.start_time is null or new.end_time is null then return new; end if;
 if new.end_time<=new.start_time then raise exception 'The timetable period end must be later than its start.' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.institution_id::text||':'||lower(new.weekday),0));
 select case when e.class_name=new.class_name then 'class'
 when nullif(trim(e.teacher_name),'') is not null and lower(trim(e.teacher_name))=lower(trim(new.teacher_name)) then 'teacher'
 when nullif(trim(e.room),'') is not null and lower(trim(e.room))=lower(trim(new.room)) then 'room' end into conflict_reason
 from public.timetable_entries e where e.institution_id=new.institution_id and lower(e.weekday)=lower(new.weekday)
 and e.id is distinct from new.id and e.start_time is not null and e.end_time is not null
 and new.start_time<e.end_time and new.end_time>e.start_time
 and (e.class_name=new.class_name or (nullif(trim(e.teacher_name),'') is not null and nullif(trim(new.teacher_name),'') is not null and lower(trim(e.teacher_name))=lower(trim(new.teacher_name)))
 or (nullif(trim(e.room),'') is not null and nullif(trim(new.room),'') is not null and lower(trim(e.room))=lower(trim(new.room)))) limit 1;
 if conflict_reason is not null then raise exception 'Timetable conflict: this % is already assigned during the selected period.',conflict_reason using errcode='23P01'; end if;
 return new;
end;
$function$;
revoke all on function public.prevent_academic_timetable_conflicts() from public;
drop trigger if exists timetable_entries_prevent_conflicts on public.timetable_entries;
create trigger timetable_entries_prevent_conflicts before insert or update of institution_id,weekday,start_time,end_time,class_name,teacher_name,room
on public.timetable_entries for each row execute function public.prevent_academic_timetable_conflicts();
