-- Extend tenant-scoped institutional record visibility to accountant transport operations.
-- Re-state the consolidated read policy so role boundaries and student/guardian portal visibility remain explicit.
begin;
drop policy if exists institutional_records_select on public.institutional_records;
create policy institutional_records_select on public.institutional_records
for select to authenticated
using (
  public.has_institution_role(institution_id,array['owner','admin']::text[])
  or (
    public.has_institution_role(institution_id,array['teacher']::text[])
    and module_key=any(array['academic_setup','employees','attendance','timetable','teaching','behaviour','communication','question_bank','examinations','tests','reports','certificates','curriculum','library','transport','facilities','visitors']::text[])
    and (
      module_key<>'employees'
      or exists (
        select 1 from public.teachers t
        where t.id=institutional_records.teacher_id
          and t.institution_id=institutional_records.institution_id
          and t.user_id=(select auth.uid())
      )
    )
  )
  or (
    public.has_institution_role(institution_id,array['accountant']::text[])
    and module_key=any(array['finance','fees','receivables','payments','receipts','payroll','reconciliation','reports','inventory','transport']::text[])
  )
  or (
    public.has_institution_role(institution_id,array['exam_officer']::text[])
    and module_key=any(array['question_bank','examinations','tests','reports','communication']::text[])
  )
  or (
    public.has_institution_role(institution_id,array['student']::text[])
    and visibility=any(array['student_portal','institution_portal']::text[])
    and (student_id is null or public.can_view_student(student_id))
    and module_key=any(array['teaching','curriculum','library','certificates','communication']::text[])
  )
  or (
    public.has_institution_role(institution_id,array['parent']::text[])
    and visibility=any(array['student_portal','parent_portal','institution_portal']::text[])
    and (student_id is null or public.can_view_student(student_id))
    and module_key=any(array['teaching','curriculum','library','transport','certificates','communication']::text[])
  )
);
commit;
