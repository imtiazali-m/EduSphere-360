begin;

-- Keep one SELECT policy per guardian table by combining staff and linked
-- family access; retain separate write policies for staff.
drop policy if exists "Institution staff manage guardian students" on public.guardian_students;
drop policy if exists guardian_students_linked_student_read on public.guardian_students;

create policy guardian_students_select_scoped on public.guardian_students
for select to authenticated
using (
  public.has_institution_role(institution_id, array['owner','admin','teacher'])
  or exists (
    select 1 from public.students s
    where s.id = guardian_students.student_id
      and s.institution_id = guardian_students.institution_id
      and (
        s.user_id = (select auth.uid())
        or exists (
          select 1 from public.student_guardians sg
          where sg.student_id = s.id
            and sg.institution_id = s.institution_id
            and sg.parent_user_id = (select auth.uid())
        )
      )
  )
);

create policy guardian_students_staff_insert on public.guardian_students
for insert to authenticated
with check (public.has_institution_role(institution_id, array['owner','admin','teacher']));
create policy guardian_students_staff_update on public.guardian_students
for update to authenticated
using (public.has_institution_role(institution_id, array['owner','admin','teacher']))
with check (public.has_institution_role(institution_id, array['owner','admin','teacher']));
create policy guardian_students_staff_delete on public.guardian_students
for delete to authenticated
using (public.has_institution_role(institution_id, array['owner','admin','teacher']));

drop policy if exists "Institution staff manage guardians" on public.parent_guardians;
drop policy if exists parent_guardians_linked_student_read on public.parent_guardians;

create policy parent_guardians_select_scoped on public.parent_guardians
for select to authenticated
using (
  public.has_institution_role(institution_id, array['owner','admin','teacher'])
  or exists (
    select 1
    from public.guardian_students gs
    join public.students s
      on s.id = gs.student_id and s.institution_id = gs.institution_id
    where gs.guardian_id = parent_guardians.id
      and gs.institution_id = parent_guardians.institution_id
      and (
        s.user_id = (select auth.uid())
        or exists (
          select 1 from public.student_guardians sg
          where sg.student_id = s.id
            and sg.institution_id = s.institution_id
            and sg.parent_user_id = (select auth.uid())
        )
      )
  )
);

create policy parent_guardians_staff_insert on public.parent_guardians
for insert to authenticated
with check (public.has_institution_role(institution_id, array['owner','admin','teacher']));
create policy parent_guardians_staff_update on public.parent_guardians
for update to authenticated
using (public.has_institution_role(institution_id, array['owner','admin','teacher']))
with check (public.has_institution_role(institution_id, array['owner','admin','teacher']));
create policy parent_guardians_staff_delete on public.parent_guardians
for delete to authenticated
using (public.has_institution_role(institution_id, array['owner','admin','teacher']));

create index if not exists attendance_student_institution_activity_idx
  on public.attendance (student_id, institution_id, attendance_date desc);
create index if not exists exam_results_student_institution_activity_idx
  on public.exam_results (student_id, institution_id, created_at desc);
create index if not exists assignment_submissions_student_institution_activity_idx
  on public.assignment_submissions (student_id, institution_id, submitted_at desc);
create index if not exists student_history_student_institution_fk_idx
  on public.student_history (student_id, institution_id);
create index if not exists student_guardians_student_institution_idx
  on public.student_guardians (student_id, institution_id);
create index if not exists student_guardians_parent_institution_idx
  on public.student_guardians (parent_user_id, institution_id, student_id);

commit;
