# Stage 5 — Administration

## Sidebar structure
Administration is one owner/admin parent menu containing exactly 14 ordered child destinations: Institute Profile; Campus and Branch Management; Academic Structure & Sections; Departments & Designations; Organisational Structure; System Configuration; Approval Workflows; Policies & Rules; Administrative Audit; User Access & Invitations; Role & Permission Management; Institute Settings; Branding & Document Settings; Security & Access History.

The former institutional-configuration, academic-session, class/section and subject catalogues remain as internal child destinations but no longer appear as separate top-level sidebar groups.

## Connected operations
- Institute Profile updates the existing tenant identity fields and stores logos in the private `institution-files` bucket using tenant folder paths and signed URLs.
- Campus and Branch Management reuses the existing institution-scoped campus workspace.
- Academic Structure & Sections opens the existing tenant-scoped session, class, programme, subject and room registers.
- Departments & Designations presents both live directories and links to their specialist managers.
- Organisational Structure reflects current owner/admin memberships, department head names and employee department/designation assignments.
- System Configuration, Institute Settings and Branding/Document defaults use the existing `institution_settings` table with private-by-default visibility.
- Approval Workflows uses `workflow_approvals` and the existing atomic `decide_institution_setting_approval` function.
- Policies & Rules stores policy records in the tenant-scoped `institutional_records` table. The existing audit trigger captures record changes.
- Administrative Audit reads the immutable `institutional_audit_events` stream.
- User Access & Invitations displays current memberships and links to the account manager. Invitation resends and membership suspension are not supported by the current account API.
- Role & Permission Management displays current role boundaries. It does not expose front-end-only permission overrides; actual access remains governed by app checks and Supabase RLS.
- Security & Access History shows available membership and administration audit evidence. Login history, failed sign-ins and live session controls are not exposed through the current tenant API and are not fabricated.

## Security boundaries
No database migration, policy widening, service-role use, production record edit or tenant-wide permission override is included. Existing owner/admin and institution-scoped RLS policies are reused. Direct supervisor links, branch head assignment and approved vacancy data are not fully modelled in the current schema; only stored fields are shown.
