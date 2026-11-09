create index if not exists announcement_reads_user_id_idx
  on public.announcement_reads (user_id);

-- The surviving policy already grants owner/admin/accountant access and
-- additionally grants linked learners/guardians through can_view_student.
-- The second SELECT policy is a strict subset, so removing it does not
-- reduce access and eliminates duplicate permissive-policy evaluation.
drop policy if exists "fee_payments_select_policy" on public.fee_payments;
