begin;

create index if not exists guardian_students_student_institution_idx
  on public.guardian_students (student_id, institution_id);
create index if not exists guardian_students_guardian_institution_idx
  on public.guardian_students (guardian_id, institution_id);
create index if not exists guardian_students_institution_idx
  on public.guardian_students (institution_id);
create index if not exists student_documents_student_institution_fk_idx
  on public.student_documents (student_id, institution_id);
create index if not exists student_documents_uploaded_by_idx
  on public.student_documents (uploaded_by);
create index if not exists student_documents_verified_by_idx
  on public.student_documents (verified_by);
create index if not exists student_placements_student_institution_fk_idx
  on public.student_placements (student_id, institution_id);
create index if not exists student_placements_class_institution_fk_idx
  on public.student_placements (class_id, institution_id);
create index if not exists student_placements_created_by_idx
  on public.student_placements (created_by);
create index if not exists student_history_created_by_idx
  on public.student_history (created_by);
create index if not exists students_application_reviewed_by_idx
  on public.students (application_reviewed_by);

drop policy if exists guardian_students_linked_student_read on public.guardian_students;
create policy guardian_students_linked_student_read on public.guardian_students
for select to authenticated
using (
  exists (
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

drop policy if exists parent_guardians_linked_student_read on public.parent_guardians;
create policy parent_guardians_linked_student_read on public.parent_guardians
for select to authenticated
using (
  exists (
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

commit;
