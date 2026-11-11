do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.rooms'::regclass and conname='rooms_id_institution_unique') then
  alter table public.rooms add constraint rooms_id_institution_unique unique(id,institution_id);
 end if;
end $$;

alter table public.timetable_entries
 add column class_id uuid,
 add column subject_id uuid,
 add column teacher_id uuid,
 add column room_id uuid,
 add column academic_session_id uuid,
 add column period_label text,
 add column period_order integer,
 add column notes text,
 add column status text not null default 'published';

alter table public.timetable_entries
 add constraint timetable_class_rel_fk foreign key(class_id,institution_id) references public.classes(id,institution_id) on delete restrict,
 add constraint timetable_subject_rel_fk foreign key(subject_id,institution_id) references public.subjects(id,institution_id) on delete restrict,
 add constraint timetable_teacher_rel_fk foreign key(teacher_id,institution_id) references public.teachers(id,institution_id) on delete restrict,
 add constraint timetable_room_rel_fk foreign key(room_id,institution_id) references public.rooms(id,institution_id) on delete restrict,
 add constraint timetable_session_rel_fk foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete restrict;

create index timetable_class_rel_idx on public.timetable_entries(class_id,institution_id);
create index timetable_subject_rel_idx on public.timetable_entries(subject_id,institution_id);
create index timetable_teacher_rel_idx on public.timetable_entries(teacher_id,institution_id);
create index timetable_room_rel_idx on public.timetable_entries(room_id,institution_id);
create index timetable_session_rel_idx on public.timetable_entries(academic_session_id,institution_id);

alter table public.assignments
 add column class_id uuid,
 add column subject_id uuid,
 add column teacher_id uuid,
 add column academic_session_id uuid;

alter table public.assignments
 add constraint assignments_class_rel_fk foreign key(class_id,institution_id) references public.classes(id,institution_id) on delete restrict,
 add constraint assignments_subject_rel_fk foreign key(subject_id,institution_id) references public.subjects(id,institution_id) on delete restrict,
 add constraint assignments_teacher_rel_fk foreign key(teacher_id,institution_id) references public.teachers(id,institution_id) on delete restrict,
 add constraint assignments_session_rel_fk foreign key(academic_session_id,institution_id) references public.academic_sessions(id,institution_id) on delete restrict;

create index assignments_class_rel_idx on public.assignments(class_id,institution_id);
create index assignments_subject_rel_idx on public.assignments(subject_id,institution_id);
create index assignments_teacher_rel_idx on public.assignments(teacher_id,institution_id);
create index assignments_session_rel_idx on public.assignments(academic_session_id,institution_id);
