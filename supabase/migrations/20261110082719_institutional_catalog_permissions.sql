-- Align institutional catalogue write permissions with the role-specific workspace UI.
-- Teachers retain access to academic, teaching and assessment records, and to the
-- dedicated library circulation / visitor / facilities workflows. Master catalogues
-- (books, routes, vehicles, inventory masters and facilities assets) are admin-managed.
begin;

drop policy if exists institutional_records_insert on public.institutional_records;
create policy institutional_records_insert
on public.institutional_records
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (
    public.has_institution_role(institution_id, array['owner','admin'])
    or (
      public.has_institution_role(institution_id, array['teacher'])
      and module_key = any(array[
        'academic_setup','attendance','timetable','teaching','behaviour',
        'communication','question_bank','examinations','tests','curriculum'
      ])
    )
    or (
      public.has_institution_role(institution_id, array['accountant'])
      and module_key = any(array[
        'finance','fees','receivables','payments','receipts','payroll','reconciliation','inventory'
      ])
    )
    or (
      public.has_institution_role(institution_id, array['exam_officer'])
      and module_key = any(array['question_bank','examinations','tests','reports'])
    )
  )
);

drop policy if exists institutional_records_update on public.institutional_records;
create policy institutional_records_update
on public.institutional_records
for update
to authenticated
using (
  public.has_institution_role(institution_id, array['owner','admin'])
  or (
    public.has_institution_role(institution_id, array['teacher'])
    and module_key = any(array[
      'academic_setup','attendance','timetable','teaching','behaviour',
      'communication','question_bank','examinations','tests','curriculum'
    ])
  )
  or (
    public.has_institution_role(institution_id, array['accountant'])
    and module_key = any(array[
      'finance','fees','receivables','payments','receipts','payroll','reconciliation','inventory'
    ])
  )
  or (
    public.has_institution_role(institution_id, array['exam_officer'])
    and module_key = any(array['question_bank','examinations','tests','reports'])
  )
)
with check (
  updated_by = (select auth.uid())
  and (
    public.has_institution_role(institution_id, array['owner','admin'])
    or (
      public.has_institution_role(institution_id, array['teacher'])
      and module_key = any(array[
        'academic_setup','attendance','timetable','teaching','behaviour',
        'communication','question_bank','examinations','tests','curriculum'
      ])
    )
    or (
      public.has_institution_role(institution_id, array['accountant'])
      and module_key = any(array[
        'finance','fees','receivables','payments','receipts','payroll','reconciliation','inventory'
      ])
    )
    or (
      public.has_institution_role(institution_id, array['exam_officer'])
      and module_key = any(array['question_bank','examinations','tests','reports'])
    )
  )
);

commit;
