-- Stage 8 RLS: tenant isolation, role-aware reference data, teacher-to-class scope,
-- published learner content, student/guardian self access, and administrative control.

create policy academic_terms_read_member on public.academic_terms for select to authenticated
using (has_institution_role(academic_terms.institution_id,array['owner','admin','teacher','student','parent','exam_officer']));
create policy academic_terms_admin_insert on public.academic_terms for insert to authenticated
with check (has_institution_role(academic_terms.institution_id,array['owner','admin']));
create policy academic_terms_admin_update on public.academic_terms for update to authenticated
using (has_institution_role(academic_terms.institution_id,array['owner','admin']))
with check (has_institution_role(academic_terms.institution_id,array['owner','admin']));
create policy academic_terms_admin_delete on public.academic_terms for delete to authenticated
using (has_institution_role(academic_terms.institution_id,array['owner','admin']));

create policy academic_preferences_read_member on public.academic_preferences for select to authenticated
using (has_institution_role(academic_preferences.institution_id,array['owner','admin','teacher','student','parent','exam_officer']));
create policy academic_preferences_admin_insert on public.academic_preferences for insert to authenticated
with check (has_institution_role(academic_preferences.institution_id,array['owner','admin']));
create policy academic_preferences_admin_update on public.academic_preferences for update to authenticated
using (has_institution_role(academic_preferences.institution_id,array['owner','admin']))
with check (has_institution_role(academic_preferences.institution_id,array['owner','admin']));
create policy academic_preferences_admin_delete on public.academic_preferences for delete to authenticated
using (has_institution_role(academic_preferences.institution_id,array['owner','admin']));

create policy class_teacher_read_scoped on public.class_teacher_assignments for select to authenticated
using (
 has_institution_role(class_teacher_assignments.institution_id,array['owner','admin','teacher','exam_officer'])
 or exists (
  select 1 from public.classes c
  where c.id=class_teacher_assignments.class_id
    and c.institution_id=class_teacher_assignments.institution_id
    and can_view_class(class_teacher_assignments.institution_id,c.name)
 )
);
create policy class_teacher_admin_insert on public.class_teacher_assignments for insert to authenticated
with check (has_institution_role(class_teacher_assignments.institution_id,array['owner','admin']));
create policy class_teacher_admin_update on public.class_teacher_assignments for update to authenticated
using (has_institution_role(class_teacher_assignments.institution_id,array['owner','admin']))
with check (has_institution_role(class_teacher_assignments.institution_id,array['owner','admin']));
create policy class_teacher_admin_delete on public.class_teacher_assignments for delete to authenticated
using (has_institution_role(class_teacher_assignments.institution_id,array['owner','admin']));

create policy lesson_plans_read_scoped on public.lesson_plans for select to authenticated
using (
 has_institution_role(lesson_plans.institution_id,array['owner','admin','teacher','exam_officer'])
 or (lesson_plans.status<>'draft' and exists (
  select 1 from public.classes c
  where c.id=lesson_plans.class_id and c.institution_id=lesson_plans.institution_id
    and can_view_class(lesson_plans.institution_id,c.name)
 ))
);
create policy lesson_plans_insert_staff on public.lesson_plans for insert to authenticated
with check (
 has_institution_role(lesson_plans.institution_id,array['owner','admin'])
 or (has_institution_role(lesson_plans.institution_id,array['teacher'])
     and lesson_plans.created_by=(select auth.uid())
     and can_teach_class(lesson_plans.institution_id,lesson_plans.class_id))
);
create policy lesson_plans_update_staff on public.lesson_plans for update to authenticated
using (has_institution_role(lesson_plans.institution_id,array['owner','admin'])
 or (has_institution_role(lesson_plans.institution_id,array['teacher']) and lesson_plans.created_by=(select auth.uid())))
with check (has_institution_role(lesson_plans.institution_id,array['owner','admin'])
 or (has_institution_role(lesson_plans.institution_id,array['teacher'])
     and lesson_plans.created_by=(select auth.uid())
     and can_teach_class(lesson_plans.institution_id,lesson_plans.class_id)));
create policy lesson_plans_delete_staff on public.lesson_plans for delete to authenticated
using (has_institution_role(lesson_plans.institution_id,array['owner','admin'])
 or (has_institution_role(lesson_plans.institution_id,array['teacher']) and lesson_plans.created_by=(select auth.uid())));

create policy study_materials_read_scoped on public.study_materials for select to authenticated
using (
 has_institution_role(study_materials.institution_id,array['owner','admin','teacher','exam_officer'])
 or (study_materials.visibility='published' and (
   study_materials.class_id is null
   or exists (
    select 1 from public.classes c
    where c.id=study_materials.class_id and c.institution_id=study_materials.institution_id
      and can_view_class(study_materials.institution_id,c.name)
   )
 ))
);
create policy study_materials_insert_staff on public.study_materials for insert to authenticated
with check (has_institution_role(study_materials.institution_id,array['owner','admin'])
 or (has_institution_role(study_materials.institution_id,array['teacher'])
     and study_materials.uploaded_by=(select auth.uid())
     and (study_materials.class_id is null or can_teach_class(study_materials.institution_id,study_materials.class_id))));
create policy study_materials_update_staff on public.study_materials for update to authenticated
using (has_institution_role(study_materials.institution_id,array['owner','admin'])
 or (has_institution_role(study_materials.institution_id,array['teacher']) and study_materials.uploaded_by=(select auth.uid())))
with check (has_institution_role(study_materials.institution_id,array['owner','admin'])
 or (has_institution_role(study_materials.institution_id,array['teacher'])
     and study_materials.uploaded_by=(select auth.uid())
     and (study_materials.class_id is null or can_teach_class(study_materials.institution_id,study_materials.class_id))));
create policy study_materials_admin_delete on public.study_materials for delete to authenticated
using (has_institution_role(study_materials.institution_id,array['owner','admin']));

create policy learning_courses_read_scoped on public.learning_courses for select to authenticated
using (
 has_institution_role(learning_courses.institution_id,array['owner','admin','teacher','exam_officer'])
 or (learning_courses.status='published'
  and exists(select 1 from public.academic_preferences p
    where p.institution_id=learning_courses.institution_id and p.online_learning_enabled)
  and exists(select 1 from public.classes c
    where c.id=learning_courses.class_id and c.institution_id=learning_courses.institution_id
      and can_view_class(learning_courses.institution_id,c.name)))
);
create policy learning_courses_insert_staff on public.learning_courses for insert to authenticated
with check (has_institution_role(learning_courses.institution_id,array['owner','admin'])
 or (has_institution_role(learning_courses.institution_id,array['teacher'])
     and learning_courses.created_by=(select auth.uid())
     and can_teach_class(learning_courses.institution_id,learning_courses.class_id)));
create policy learning_courses_update_staff on public.learning_courses for update to authenticated
using (has_institution_role(learning_courses.institution_id,array['owner','admin'])
 or (has_institution_role(learning_courses.institution_id,array['teacher']) and learning_courses.created_by=(select auth.uid())))
with check (has_institution_role(learning_courses.institution_id,array['owner','admin'])
 or (has_institution_role(learning_courses.institution_id,array['teacher'])
     and learning_courses.created_by=(select auth.uid())
     and can_teach_class(learning_courses.institution_id,learning_courses.class_id)));
create policy learning_courses_admin_delete on public.learning_courses for delete to authenticated
using (has_institution_role(learning_courses.institution_id,array['owner','admin']));

create policy learning_course_units_read_scoped on public.learning_course_units for select to authenticated
using (
 has_institution_role(learning_course_units.institution_id,array['owner','admin','teacher','exam_officer'])
 or (learning_course_units.status='published' and exists(
   select 1
   from public.learning_courses c
   join public.academic_preferences p on p.institution_id=c.institution_id and p.online_learning_enabled
   join public.classes cls on cls.id=c.class_id and cls.institution_id=c.institution_id
   where c.id=learning_course_units.course_id and c.institution_id=learning_course_units.institution_id
     and c.status='published' and can_view_class(learning_course_units.institution_id,cls.name)
 ))
);
create policy learning_course_units_insert_staff on public.learning_course_units for insert to authenticated
with check (has_institution_role(learning_course_units.institution_id,array['owner','admin'])
 or (has_institution_role(learning_course_units.institution_id,array['teacher'])
     and learning_course_units.created_by=(select auth.uid())
     and exists(select 1 from public.learning_courses c
       where c.id=learning_course_units.course_id and c.institution_id=learning_course_units.institution_id
         and can_teach_class(learning_course_units.institution_id,c.class_id))));
create policy learning_course_units_update_staff on public.learning_course_units for update to authenticated
using (has_institution_role(learning_course_units.institution_id,array['owner','admin'])
 or (has_institution_role(learning_course_units.institution_id,array['teacher']) and learning_course_units.created_by=(select auth.uid())))
with check (has_institution_role(learning_course_units.institution_id,array['owner','admin'])
 or (has_institution_role(learning_course_units.institution_id,array['teacher'])
     and learning_course_units.created_by=(select auth.uid())
     and exists(select 1 from public.learning_courses c
       where c.id=learning_course_units.course_id and c.institution_id=learning_course_units.institution_id
         and can_teach_class(learning_course_units.institution_id,c.class_id))));
create policy learning_course_units_admin_delete on public.learning_course_units for delete to authenticated
using (has_institution_role(learning_course_units.institution_id,array['owner','admin']));

create policy learning_course_progress_read on public.learning_course_progress for select to authenticated
using (can_view_student(learning_course_progress.student_id));
create policy learning_course_progress_student_insert on public.learning_course_progress for insert to authenticated
with check (
 exists(select 1 from public.students s where s.id=learning_course_progress.student_id
   and s.institution_id=learning_course_progress.institution_id and s.user_id=(select auth.uid()))
 and exists(select 1 from public.learning_courses c
   join public.academic_preferences p on p.institution_id=c.institution_id and p.online_learning_enabled
   where c.id=learning_course_progress.course_id and c.institution_id=learning_course_progress.institution_id
     and c.status='published')
);
create policy learning_course_progress_update on public.learning_course_progress for update to authenticated
using (
 exists(select 1 from public.students s where s.id=learning_course_progress.student_id
  and s.institution_id=learning_course_progress.institution_id and s.user_id=(select auth.uid()))
 or has_institution_role(learning_course_progress.institution_id,array['owner','admin'])
 or (has_institution_role(learning_course_progress.institution_id,array['teacher'])
   and exists(select 1 from public.learning_courses c where c.id=learning_course_progress.course_id
    and c.institution_id=learning_course_progress.institution_id
    and can_teach_class(learning_course_progress.institution_id,c.class_id)))
)
with check (
 exists(select 1 from public.students s where s.id=learning_course_progress.student_id
  and s.institution_id=learning_course_progress.institution_id and s.user_id=(select auth.uid()))
 or has_institution_role(learning_course_progress.institution_id,array['owner','admin'])
 or (has_institution_role(learning_course_progress.institution_id,array['teacher'])
   and exists(select 1 from public.learning_courses c where c.id=learning_course_progress.course_id
    and c.institution_id=learning_course_progress.institution_id
    and can_teach_class(learning_course_progress.institution_id,c.class_id)))
);
create policy learning_course_progress_admin_delete on public.learning_course_progress for delete to authenticated
using (has_institution_role(learning_course_progress.institution_id,array['owner','admin']));

create policy classroom_activities_read on public.classroom_activities for select to authenticated
using (has_institution_role(classroom_activities.institution_id,array['owner','admin','teacher','exam_officer'])
 or (classroom_activities.visibility='published' and exists(
  select 1 from public.classes c where c.id=classroom_activities.class_id
   and c.institution_id=classroom_activities.institution_id
   and can_view_class(classroom_activities.institution_id,c.name)
 )));
create policy classroom_activities_insert_staff on public.classroom_activities for insert to authenticated
with check (has_institution_role(classroom_activities.institution_id,array['owner','admin'])
 or (has_institution_role(classroom_activities.institution_id,array['teacher'])
  and classroom_activities.created_by=(select auth.uid())
  and can_teach_class(classroom_activities.institution_id,classroom_activities.class_id)));
create policy classroom_activities_update_staff on public.classroom_activities for update to authenticated
using (has_institution_role(classroom_activities.institution_id,array['owner','admin'])
 or (has_institution_role(classroom_activities.institution_id,array['teacher']) and classroom_activities.created_by=(select auth.uid())))
with check (has_institution_role(classroom_activities.institution_id,array['owner','admin'])
 or (has_institution_role(classroom_activities.institution_id,array['teacher'])
  and classroom_activities.created_by=(select auth.uid())
  and can_teach_class(classroom_activities.institution_id,classroom_activities.class_id)));
create policy classroom_activities_admin_delete on public.classroom_activities for delete to authenticated
using (has_institution_role(classroom_activities.institution_id,array['owner','admin']));

create policy classroom_participants_read on public.classroom_activity_participants for select to authenticated
using (can_view_student(classroom_activity_participants.student_id));
create policy classroom_participants_insert_staff on public.classroom_activity_participants for insert to authenticated
with check (
 has_institution_role(classroom_activity_participants.institution_id,array['owner','admin'])
 or (has_institution_role(classroom_activity_participants.institution_id,array['teacher'])
  and exists(select 1 from public.classroom_activities a
   where a.id=classroom_activity_participants.activity_id
    and a.institution_id=classroom_activity_participants.institution_id
    and a.created_by=(select auth.uid()) and can_teach_class(classroom_activity_participants.institution_id,a.class_id)))
);
create policy classroom_participants_update_staff on public.classroom_activity_participants for update to authenticated
using (has_institution_role(classroom_activity_participants.institution_id,array['owner','admin'])
 or (has_institution_role(classroom_activity_participants.institution_id,array['teacher'])
  and exists(select 1 from public.classroom_activities a
   where a.id=classroom_activity_participants.activity_id
    and a.institution_id=classroom_activity_participants.institution_id
    and a.created_by=(select auth.uid()))))
with check (has_institution_role(classroom_activity_participants.institution_id,array['owner','admin'])
 or (has_institution_role(classroom_activity_participants.institution_id,array['teacher'])
  and exists(select 1 from public.classroom_activities a
   where a.id=classroom_activity_participants.activity_id
    and a.institution_id=classroom_activity_participants.institution_id
    and a.created_by=(select auth.uid()) and can_teach_class(classroom_activity_participants.institution_id,a.class_id))));
create policy classroom_participants_admin_delete on public.classroom_activity_participants for delete to authenticated
using (has_institution_role(classroom_activity_participants.institution_id,array['owner','admin']));

create policy academic_calendar_read on public.academic_calendar_events for select to authenticated
using (
 has_institution_role(academic_calendar_events.institution_id,array['owner','admin','teacher','exam_officer'])
 or (academic_calendar_events.status='published' and (
  academic_calendar_events.audience='all'
  or (academic_calendar_events.audience='students' and has_institution_role(academic_calendar_events.institution_id,array['student']))
  or (academic_calendar_events.audience='parents' and has_institution_role(academic_calendar_events.institution_id,array['parent']))
  or (academic_calendar_events.audience='students_and_parents' and has_institution_role(academic_calendar_events.institution_id,array['student','parent']))
 ))
);
create policy academic_calendar_insert_staff on public.academic_calendar_events for insert to authenticated
with check (has_institution_role(academic_calendar_events.institution_id,array['owner','admin'])
 or (has_institution_role(academic_calendar_events.institution_id,array['teacher']) and academic_calendar_events.created_by=(select auth.uid())));
create policy academic_calendar_update_staff on public.academic_calendar_events for update to authenticated
using (has_institution_role(academic_calendar_events.institution_id,array['owner','admin'])
 or (has_institution_role(academic_calendar_events.institution_id,array['teacher']) and academic_calendar_events.created_by=(select auth.uid())))
with check (has_institution_role(academic_calendar_events.institution_id,array['owner','admin'])
 or (has_institution_role(academic_calendar_events.institution_id,array['teacher']) and academic_calendar_events.created_by=(select auth.uid())));
create policy academic_calendar_admin_delete on public.academic_calendar_events for delete to authenticated
using (has_institution_role(academic_calendar_events.institution_id,array['owner','admin']));

create policy learning_progress_read on public.learning_progress for select to authenticated
using (can_view_student(learning_progress.student_id));
create policy learning_progress_insert_staff on public.learning_progress for insert to authenticated
with check (has_institution_role(learning_progress.institution_id,array['owner','admin'])
 or (has_institution_role(learning_progress.institution_id,array['teacher'])
  and learning_progress.recorded_by=(select auth.uid())
  and can_teach_class(learning_progress.institution_id,learning_progress.class_id)));
create policy learning_progress_update_staff on public.learning_progress for update to authenticated
using (has_institution_role(learning_progress.institution_id,array['owner','admin'])
 or (has_institution_role(learning_progress.institution_id,array['teacher']) and learning_progress.recorded_by=(select auth.uid())))
with check (has_institution_role(learning_progress.institution_id,array['owner','admin'])
 or (has_institution_role(learning_progress.institution_id,array['teacher'])
  and learning_progress.recorded_by=(select auth.uid())
  and can_teach_class(learning_progress.institution_id,learning_progress.class_id)));
create policy learning_progress_admin_delete on public.learning_progress for delete to authenticated
using (has_institution_role(learning_progress.institution_id,array['owner','admin']));

-- Replace admin-only selectors so teaching staff and linked learners can plan and view their permitted courses.
drop policy if exists academic_sessions_admin_select on public.academic_sessions;
create policy academic_sessions_stage8_read on public.academic_sessions for select to authenticated
using (has_institution_role(academic_sessions.institution_id,array['owner','admin','teacher','student','parent','exam_officer']));
drop policy if exists classes_admin_select on public.classes;
create policy classes_stage8_read on public.classes for select to authenticated
using (
 has_institution_role(classes.institution_id,array['owner','admin','teacher','exam_officer'])
 or (has_institution_role(classes.institution_id,array['student','parent'])
  and exists(select 1 from public.students s where s.institution_id=classes.institution_id
   and s.class_name=classes.name and can_view_student(s.id)))
);
drop policy if exists subjects_admin_select on public.subjects;
create policy subjects_stage8_read on public.subjects for select to authenticated
using (has_institution_role(subjects.institution_id,array['owner','admin','teacher','student','parent','exam_officer']));
drop policy if exists rooms_admin_select on public.rooms;
create policy rooms_stage8_read on public.rooms for select to authenticated
using (has_institution_role(rooms.institution_id,array['owner','admin','teacher','exam_officer']));
