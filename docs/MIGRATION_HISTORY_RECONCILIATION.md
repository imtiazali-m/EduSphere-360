# Supabase migration history reconciliation — 15 November 2026

## Current verified state

A read-only comparison of the connected Supabase project's migration versions with the repository's timestamped SQL filenames reports:

| Measure | Count |
|---|---:|
| Applied migration versions reported by Supabase | 89 |
| Timestamped migration files in this branch | 79 |
| Versions present in both | 77 |
| Remote applied versions without a local source file | 12 |
| Local timestamped migrations not reported as applied | 2 |

The 12 remote versions still missing from this branch are:

- `20261114032847`
- `20261114033406`
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

The two local-only migrations are:

- `20261114194500_reports_run_history_and_student_sections.sql`
- `20261114200000_student_development_skills_competencies_activities.sql`

## Source recovery performed in PR #85

Twenty-two migration files whose version prefixes were present in the remote applied history were recovered from the existing `feat/complete-98-unavailable-workspaces` Git branch and copied without modification into this review branch.

This is a repository-source recovery only. The recovered SQL bodies were not replayed. Supabase does not expose the original migration-file bodies through the read-only migration-history listing, so byte-for-byte equality with the SQL originally applied cannot be independently asserted.

## Release and database safety

- No Supabase migration was applied, repaired, marked as applied, reverted or replayed during this reconciliation.
- No table data, function, policy, grant or schema object was changed.
- Do not run `supabase db push` or replay the historical files while the 12 remote source files remain missing.
- Review the two local-only migrations against the live schema before deciding whether either should be applied.
- Recover the remaining 12 original SQL files from their authoritative source, or plan a separately reviewed schema-baseline process. Do not fabricate historical migration bodies or mark versions as applied merely to make the lists match.

This document is evidence of the current partial reconciliation, not a statement that migration history is fully consistent.
