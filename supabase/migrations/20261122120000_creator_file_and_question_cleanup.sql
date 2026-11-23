-- Complete author-owned deletion for private staff uploads and unused question-bank drafts.
-- Historical assessment use is protected by explicit dependency checks and FK constraints.

begin;

drop policy if exists question_bank_delete on public.question_bank_items;
create policy question_bank_delete
on public.question_bank_items
for delete to authenticated
using (
  public.has_institution_role(institution_id, array['owner','admin','exam_officer'])
  or (
    public.has_institution_role(institution_id, array['teacher'])
    and created_by = (select auth.uid())
    and status in ('draft','review')
    and not exists (
      select 1 from public.assessment_paper_items p
      where p.question_id = question_bank_items.id
        and p.institution_id = question_bank_items.institution_id
    )
    and not exists (
      select 1 from public.online_assessment_questions q
      where q.question_id = question_bank_items.id
        and q.institution_id = question_bank_items.institution_id
    )
  )
);

drop policy if exists staff_documents_delete_own on public.staff_documents;
create policy staff_documents_delete_own
on public.staff_documents
for delete to authenticated
using (
  uploaded_by = (select auth.uid())
  and public.is_institution_member(institution_id)
);

drop policy if exists staff_files_delete_own on storage.objects;
create policy staff_files_delete_own
on storage.objects
for delete to authenticated
using (
  bucket_id = 'staff-files'
  and array_length(storage.foldername(name), 1) = 2
  and exists (
    select 1
    from public.teachers t
    where t.id::text = (storage.foldername(objects.name))[2]
      and t.institution_id::text = (storage.foldername(objects.name))[1]
      and t.user_id = (select auth.uid())
  )
);

commit;
