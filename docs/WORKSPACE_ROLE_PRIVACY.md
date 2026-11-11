# Institutional workspace approval-data visibility

Internal approval state is administrative workflow metadata. Owner and administrator accounts may see approval state, reviewer identity and review timestamps in the institutional workspace. Other roles must not receive these fields through the workspace presentation, exports or review metrics.

The frontend policy helper in `src/lib/workspacePrivacy.js` is a defense-in-depth presentation rule. It scopes table columns, CSV/XLSX/DOCX/print projections and dashboard metrics by role. It does **not** replace database authorization.

## Database release gate

The linked project's existing `institutional_records` SELECT policy allows student and parent memberships to read selected portal-visible rows. The current generic workspace query uses `select('*')`, while the linked project grants `SELECT` on the review metadata columns to `authenticated`. Row-level security filters rows, not columns. Therefore a family-role user with access to a permitted row may still request internal approval fields directly through the Data API unless the database/API contract is changed.

Do not describe this UI helper as complete confidentiality protection. Before production release, design and test a database-side safe projection or column-privilege/API change that:
- preserves current tenant, portal visibility and linked-student constraints;
- keeps owner/admin review access;
- prevents student/parent direct Data API reads of approval/reviewer metadata;
- updates every client call site that reads or writes `institutional_records`;
- is verified with authenticated owner, admin, teacher, student and parent identities.

No schema, RLS, grants, Auth users or production data are changed by this source-only change.
