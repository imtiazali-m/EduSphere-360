# Institutional workspace approval-data visibility

Approval state, reviewer identity, review timestamps and internal review notes are administrative workflow metadata. Only institution owners and administrators may read or change these values. Teachers, accountants, examination officers, students and parents must not receive them through direct Data API queries, workspace presentation, exports or review metrics.

## Database design

The staged migration `20261111160000_institutional_record_review_isolation.sql` moves `approval_status`, `reviewed_by`, `reviewed_at` and `review_notes` from `institutional_records` into `institutional_record_reviews`.

- The new relation is linked by a composite `(record_id, institution_id)` foreign key with cascade deletion, preserving tenant alignment.
- Existing review metadata is copied before the original columns are dropped.
- Row-level security and explicit grants allow authenticated access only when the active membership is an owner or administrator; anonymous access is revoked.
- A database trigger stamps reviewer identity/time on approval or rejection and prevents clients from changing those audit fields independently.
- Review insert/update events are written into the existing administrator-readable institutional audit stream.
- The `save_institutional_record_with_review` RPC checks the authenticated user and active owner/admin membership, then saves the operational record and its review state in one transaction.
- The workspace reads the base record through an explicit safe-column projection. It requests the separate review relation only for owners/administrators. Non-admin writes never send review columns to the operational table.

The frontend helper in `src/lib/workspacePrivacy.js` remains defense in depth for CSV/XLSX/DOCX/print projections and dashboard metrics. It strips `approval_status`, `reviewed_by`, `reviewed_at` and `review_notes` from non-admin export rows, including nested payloads.

## Release status and acceptance

This change is **source-only and staged**. It does not apply the migration, change live RLS/grants, create Auth users, change production data or deploy Cloudflare.

Before production promotion:
1. Review the migration and run a Supabase remote dry-run after the other staged migrations are reconciled.
2. Apply the migration only once, after approval; do not replay legacy numbered migrations.
3. Use disposable authenticated owner, admin, teacher, accountant, examination-officer, student and parent identities to verify: admin review read/write, non-admin direct SELECT denial on the review table, absence of review columns on `institutional_records`, portal-visible record reads, cross-institution denial, approval/rejection timestamps and audit events, parent/student portal behaviour, and record deletion cascade.
4. Verify the save RPC rejects anonymous users, non-admins and cross-institution IDs, and that a failed review upsert rolls the record save back.
5. Run database security advisors and the full project / browser regression workflows.

Do not describe frontend column hiding or an un-applied migration as live confidentiality protection.
