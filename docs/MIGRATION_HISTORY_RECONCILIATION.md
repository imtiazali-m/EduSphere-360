# Supabase migration history reconciliation — 11 November 2026

## Finding

The connected Supabase project records 30 applied timestamped migrations. The repository also contains 30 timestamped migration files, but one employee migration had a mismatching local version prefix:

- Remote applied version: `20261109085154` — `faculty_employee_management`.
- Previous repository filename: `20261109083133_faculty_employee_management.sql`.

The migration's original integration commit states that the faculty/employee workspace was integrated using the already-applied institution-scoped migration, rather than replaying it.

## Source-only correction

The migration file was renamed to:

    supabase/migrations/20261109085154_faculty_employee_management.sql

The SQL body was copied byte-for-byte; no SQL statement, schema object, policy, function or database record was changed. The project verifier's three references were updated to the corrected filename.

## Verification

- The local migration directory has 30 timestamped migration files.
- The linked Supabase project reports 30 applied migration versions.
- Every remote migration version now has a matching local filename prefix.
- No local timestamped migration prefix remains unapplied remotely.
- The legacy numbered migrations remain preserved and must not be replayed blindly.

Several older remote migration display names differ from their local filename suffixes, but their version prefixes match. This reconciliation intentionally changes only the one incorrect version prefix; it does not rename historical migrations whose version identifiers already match.

## Release safety

This is a Git repository metadata correction only. No Supabase migration was applied, repaired, marked as applied, reverted or replayed. Before any future database deployment, inspect the current remote migration list and run a remote dry-run. If it proposes any of the historical migrations as new, stop and reconcile the history instead of applying them.

## Pull request

This correction is proposed in PR #20. It must pass the project verifier and production build before merge.