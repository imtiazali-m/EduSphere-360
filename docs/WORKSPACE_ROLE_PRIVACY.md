# Institutional workspace approval-data visibility

Internal approval state is administrative workflow metadata. Owner and administrator accounts may see approval state, reviewer identity and review timestamps in the institutional workspace. Other roles must not receive these fields through workspace tables, exports or review metrics.

The frontend policy helper in `src/lib/workspacePrivacy.js` is a defense-in-depth presentation rule. It scopes table columns, CSV/XLSX/DOCX/print projections and dashboard metrics by role. It does **not** replace database authorization.

## Confirmed database release gate

A read-only inspection of the linked Supabase project on 12 November 2026 confirmed:
- `public.institutional_records` has a SELECT policy that allows students and parents to read selected portal-visible rows.
- The `authenticated` database role has SELECT privileges on `approval_status`, `reviewed_by`, `reviewed_at`, `review_notes` and other review metadata columns.
- The current generic institutional workspace query uses `.select('*')`.

Postgres RLS filters rows, not columns. Therefore, a family-role user who can read a permitted row may still request internal approval metadata directly through the Data API unless the database/API contract is changed.

Do not describe this UI helper as complete confidentiality protection. Before production release, design and test a database-side safe projection or column-privilege/API change that:
- preserves tenant scoping, portal visibility and linked-student/guardian restrictions;
- keeps owner/admin review access;
- prevents student/parent direct Data API reads of approval/reviewer metadata;
- updates every client call site that reads or writes `institutional_records`;
- is verified with authenticated owner, admin, teacher, student and parent identities.

## Safety

This source change does not alter database schema, RLS policies, grants, Auth users, records or production data. The database-side fix is tracked separately and must be tested against a development database before production migration.
