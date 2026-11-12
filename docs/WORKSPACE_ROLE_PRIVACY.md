# Institutional workspace approval-data confidentiality

Internal approval state, reviewer identity, review timestamps and internal review notes are administrative workflow metadata. They must not be exposed through student/parent portal-visible operational records or generic Data API reads.

## Current frontend defense in depth

The merged `src/lib/workspacePrivacy.js` policy limits approval columns, review KPIs and exported review metadata to owner/admin roles. Non-admin exports recursively remove `approval_status`, `reviewed_by`, `reviewed_at` and `review_notes`, including nested payload values.

This presentation-layer protection is useful but does not by itself secure direct Data API access.

## Staged database isolation

The staged migration `supabase/migrations/20261112000100_institutional_record_review_isolation.sql`:
- creates `public.institutional_record_reviews` with institution-safe record references;
- enables RLS and restricts review-row reads/writes to active owner/admin roles;
- backfills all existing approval/reviewer metadata before dropping the legacy columns from `institutional_records`;
- stamps reviewer identity and decision time in a database trigger rather than trusting client values;
- records review changes in the existing administrator-only audit stream;
- uses an owner/admin-checked RPC for atomic operational-record and review-state saves.

The current application source has been updated in the staged branch to use an explicit safe operational-record projection, load review metadata only for owner/admin roles, and save decisions/notes through the isolated relation.

## Live migration state and safety gate

A read-only inspection of the linked Supabase project on 12 November 2026 confirmed:
- 50 migration versions are recorded as applied;
- the new migration version `20261112000100` is not applied;
- the live `institutional_records` table currently has RLS enabled and permits selected student/parent portal-visible rows;
- authenticated users currently have SELECT privileges on the legacy approval/reviewer columns;
- no existing payload records contain top-level or nested keys named `approval_status`, `reviewed_by`, `reviewed_at` or `review_notes`;
- the required `private` schema, institution-scoped composite record reference and audit table are present.

The old draft migration used version `20261111160000`, which is earlier than the latest applied migration version in the live project. The staged migration therefore uses the new version `20261112000100` so it follows the actual 50-version remote history rather than replaying or repairing older versions.

**The migration has not been applied.** The application source and migration must not be released together until a separate Supabase development branch is created, the migration applies cleanly, and role-specific API checks prove:
- owner/admin can read and update review metadata;
- teacher/student/parent/accountant/exam-officer cannot read or write the review relation;
- student/parent direct Data API requests cannot retrieve the removed approval/reviewer columns;
- operational record reads/writes, portal visibility, audit history and linked-student/guardian restrictions still work.

No live database grants, policies, functions, Auth users, records or production data have been changed.
