-- Permit a delegated approvals profile to make decisions without granting general record editing.
drop policy if exists college_custom_scope_update on public.workflow_approvals;
create policy college_custom_scope_update on public.workflow_approvals
as restrictive for update to authenticated
using (
  (select private.has_institution_permission(institution_id,'approvals','edit',null,null))
  or (select private.has_institution_permission(institution_id,'approvals','approve',null,null))
)
with check (
  (select private.has_institution_permission(institution_id,'approvals','edit',null,null))
  or (select private.has_institution_permission(institution_id,'approvals','approve',null,null))
);
