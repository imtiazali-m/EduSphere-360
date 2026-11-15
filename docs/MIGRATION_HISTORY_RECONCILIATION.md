# Supabase migration history reconciliation — 15 November 2026

## Current verified state

A read-only comparison of the connected Supabase project's migration versions with this branch's timestamped SQL filenames reports:

| Measure | Count |
|---|---:|
| Applied migration versions reported by Supabase | 89 |
| Timestamped migration files in this branch | 81 |
| Versions present in both | 79 |
| Remote applied versions without a matching local version prefix | 10 |
| Local timestamped migrations not reported as applied | 2 |

The 10 remote versions still missing a matching local source filename are:

- `20261114034316`
- `20261114053650`
- `20261114061138`
- `20261114064712`
- `20261114130438`
- `20261114131133`
- `20261114131223`
- `20261114133303`
- `20261114135019`
- `20261114140016`

Two additional remote-applied migration sources were recovered from the existing `integration/college-operations-2026-11-14` branch:

- `20261114032847_college_operations_custom_permission_guards.sql`
- `20261114033406_college_permission_role_variable_fix.sql`

There is also a source file named `20261114040000_college_self_service_privacy_bounds.sql` on that branch, while Supabase reports a version `20261114034316` with the matching migration name. The timestamp prefix differs, so this file is not counted as a match and has not been renamed or treated as reconciled.

The two local-only migration prefixes are:

- `20261114194500_reports_run_history_and_student_sections.sql`
- `20261114200000_student_development_skills_competencies_activities.sql`

Read-only live-schema inspection confirms that `institution_report_run_history`, `students.section_name`, `student_skill_records`, `student_cocurricular_activities`, `student_competency_records`, and `student_progress_history` already exist, and RLS is enabled on the relevant tables. Their presence does not prove these exact local migration files were applied; do not replay them or infer ledger status from object presence.

## Source recovery performed in PR #85

Twenty-four migration files whose version prefixes were present in the remote history were recovered from existing Git branches and copied without modification into this review branch. This is repository-source recovery only. The recovered SQL bodies were not replayed. Supabase's read-only migration-history listing does not expose original migration file bodies, so byte-for-byte equality to every originally applied SQL file cannot be independently asserted.

## Release and database safety

- No Supabase migration was applied, repaired, marked as applied, reverted or replayed during this reconciliation.
- No table data, function, policy, grant or schema object was changed.
- Do not run `supabase db push` or replay historical SQL while 10 remote-applied migration versions lack a matching local source prefix.
- Review the two local-only migrations against the live schema before deciding whether either should be applied.
- Recover the remaining original SQL files from their authoritative source, and reconcile the timestamp mismatch for `college_self_service_privacy_bounds`. Do not fabricate historical migration bodies or mark versions as applied merely to make the lists match.

This document records a partial reconciliation, not a fully consistent migration history.
