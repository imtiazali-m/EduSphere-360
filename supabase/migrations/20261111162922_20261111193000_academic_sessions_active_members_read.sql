-- Allow active institution members to see the academic-session label used by
-- role-specific dashboards. Editing remains restricted to owner/administrator.
create policy academic_sessions_active_members_read
on public.academic_sessions
for select
to authenticated
using (public.is_institution_member(institution_id));
