-- Allow staff/members to remove only records they personally created.
-- Financial postings, published results, exams with results and assignments
-- with submissions remain protected from destructive deletion.

begin;

drop policy if exists creator_can_delete_own_attendance on public.attendance;
create policy creator_can_delete_own_attendance
on public.attendance for delete to authenticated
using (
  created_by = (select auth.uid())
  and public.is_institution_member(institution_id)
);

drop policy if exists creator_can_delete_own_planned_exams on public.exams;
create policy creator_can_delete_own_planned_exams
on public.exams for delete to authenticated
using (
  created_by = (select auth.uid())
  and public.is_institution_member(institution_id)
  and status = 'planned'
  and not exists (
    select 1 from public.exam_results r
    where r.exam_id = exams.id and r.institution_id = exams.institution_id
  )
);

drop policy if exists creator_can_delete_own_draft_exam_results on public.exam_results;
create policy creator_can_delete_own_draft_exam_results
on public.exam_results for delete to authenticated
using (
  created_by = (select auth.uid())
  and public.is_institution_member(institution_id)
  and coalesce(result_status, 'draft') = 'draft'
);

drop policy if exists creator_can_delete_own_unpaid_invoices on public.fee_invoices;
create policy creator_can_delete_own_unpaid_invoices
on public.fee_invoices for delete to authenticated
using (
  created_by = (select auth.uid())
  and public.is_institution_member(institution_id)
  and coalesce(paid_amount, 0) = 0
  and not exists (
    select 1 from public.fee_payments p
    where p.invoice_id = fee_invoices.id
      and p.institution_id = fee_invoices.institution_id
  )
);

drop policy if exists creator_can_delete_own_unsubmitted_assignments on public.assignments;
create policy creator_can_delete_own_unsubmitted_assignments
on public.assignments for delete to authenticated
using (
  created_by = (select auth.uid())
  and public.is_institution_member(institution_id)
  and not exists (
    select 1 from public.assignment_submissions s
    where s.assignment_id = assignments.id
      and s.institution_id = assignments.institution_id
  )
);

drop policy if exists creator_can_delete_own_ungraded_submissions on public.assignment_submissions;
create policy creator_can_delete_own_ungraded_submissions
on public.assignment_submissions for delete to authenticated
using (
  created_by = (select auth.uid())
  and public.is_institution_member(institution_id)
  and status in ('submitted', 'late')
  and marks_obtained is null
);

drop policy if exists creator_can_delete_own_timetable_entries on public.timetable_entries;
create policy creator_can_delete_own_timetable_entries
on public.timetable_entries for delete to authenticated
using (
  created_by = (select auth.uid())
  and public.is_institution_member(institution_id)
);

drop policy if exists creator_can_delete_own_announcements on public.announcements;
create policy creator_can_delete_own_announcements
on public.announcements for delete to authenticated
using (
  created_by = (select auth.uid())
  and public.is_institution_member(institution_id)
);

commit;
