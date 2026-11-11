# Stable identity for institutional work assignments

## Problem

The original work queue stored the assignee's display name and email, and its staff SELECT/UPDATE policies compared the email in the current Auth JWT. An email address is a mutable contact attribute, not a durable employee identity. A later email change could make an employee lose assigned work; a reused address could also risk granting a different account access to an old task.

## Additive identity model

The staged migration adds `assigned_to_user_id`, referencing `auth.users(id)`, and an explicit `assigned_to_legacy_email_access` compatibility flag.

- New task assignments and administrator reassignments are resolved to exactly one active owner/admin/teacher/accountant/exam-officer membership within the same institution.
- The database trigger rejects missing or ambiguous accounts and stores the Auth user UUID. The current email/name columns remain as display snapshots and support the existing form contract.
- Historical rows are backfilled only when the institution-scoped, normalized profile-email lookup has exactly one active staff user.
- Unmatched or ambiguous historical rows receive the explicit legacy flag. Email fallback is allowed only when the user UUID is null and this flag is true.
- A task with a linked user UUID never falls back to email. If that Auth user is deleted, the foreign key clears the UUID but the compatibility flag remains false; an administrator must reassign the task before another account can own it.
- Non-admin staff can still update permitted progress fields, but cannot reassign, alter task definitions or change the identity fields.

The migration uses the existing institution role helper and preserves the existing task status/progress invariants. It replaces only the task SELECT/UPDATE assignment predicates and the existing assignment guard function. The existing email index remains for legacy rows; a partial tenant/user/status index supports stable identity lookups.

## Live-data assessment

The connected Supabase project was inspected read-only before this migration was designed. At that check, `work_tasks` contained zero rows and `teachers` contained zero rows. There are therefore no current task assignments to backfill in that environment. The migration still includes a conservative exact-match backfill so it remains safe if older task rows are present in another environment.

## Deployment sequence and acceptance

This PR changes repository source only. **It does not apply the migration, alter live RLS, deploy an Edge Function, or change production data.**

1. Review the SQL and CI on the PR branch.
2. Before deployment, refresh the remote migration list and run a Supabase remote dry-run. Stop if any historical migration is proposed for replay.
3. Apply this migration through the approved schema release process, then verify the new columns, FK, policies, trigger and advisors.
4. Deploy the matching frontend build only after the database schema is available.
5. Run authenticated acceptance using disposable institution test accounts: owner/admin assignment, assigned staff visibility and progress update, non-assignee denial, same email in another institution denial, email-change continuity, explicit legacy fallback, user-deletion non-reclaim, non-admin reassignment denial and status/progress consistency.
6. Remove legacy compatibility only after a separate review proves all retained tasks are identity-linked and no other supported environment needs the fallback.

## Regression coverage

`scripts/test-work-task-identity.mjs` verifies the client-side policy mirror and asserts that the migration retains tenant-scoped unique matching, stable-ID RLS, explicit legacy-only fallback, deleted-user handling and staff immutability. GitHub Actions also runs the existing project verifier and production build.
