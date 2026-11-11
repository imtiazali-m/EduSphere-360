# Supabase migration history reconciliation — 11 November 2026

## Applied baseline

The connected Supabase project currently records 30 applied timestamped migration versions. The repository contains those 30 aligned migration files plus two separately reviewed migrations staged for the next approved database release:

| Version | Migration | Status |
|---|---|---|
| `20261111140500` | `work_task_stable_assignee_identity` | Staged; not applied |
| `20261111150000` | `harden_legacy_fee_payment_rpc` | Staged; not applied |

The older numbered SQL files are preserved as legacy project material. Do not execute them blindly against the existing database. Reconcile remote history before every schema deployment.

## Previously corrected version mismatch

The remote applied version `20261109085154` is `faculty_employee_management`. The previous repository filename `20261109083133_faculty_employee_management.sql` was renamed to `20261109085154_faculty_employee_management.sql`. The SQL body was copied byte-for-byte; no historical SQL, schema object, policy, function or database record was changed.

## Release ledger

- Local timestamped migration source files: **32**.
- Remote applied migration versions observed during the read-only check: **30**.
- Staged migration versions awaiting review: **2**.
- All 30 applied remote versions have matching local migration filename prefixes.
- The two staged files are deliberately not present in remote applied history; do not use `db push` or manually mark them applied until SQL review, remote dry-run, release plan and authenticated acceptance tests are approved.
- After both migrations are eventually approved and deployed, re-read the remote migration history and verify 32/32 version parity. Stop if the dry-run proposes replaying any historical migration.

## Staged migration release gates

### Stable work-task assignee identity

The task migration introduces a tenant-scoped Auth user UUID, explicit handling for reviewed legacy email assignments, fail-closed ambiguous/unmatched backfill, and an immutable institution owner guard. Cross-institution transfer must be modelled as a new task in the destination institution. Review the trigger, RLS policies, backfill counts and task assignment behaviour before deployment.

### Legacy fee-payment RPC compatibility

The legacy seven-argument payment overload delegates to the stricter six-argument payment workflow, retains optional bank/cheque metadata on the exact returned payment row and does not broaden authenticated table update grants. Test legacy named-argument compatibility and strict validation using disposable invoices before deployment.

## Safety

This is a source-only integration. No migration was applied, repaired, marked as applied, reverted or replayed. Before deployment, inspect the current remote migration history, perform a remote dry-run and review the SQL diff. If any historical migration is proposed as new, stop and reconcile instead of applying.
