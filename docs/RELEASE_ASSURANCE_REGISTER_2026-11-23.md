# EduSphere 360 — Release assurance register

**Snapshot:** 23 November 2026, 10:08 PKT  
**Repository:** [imtiazali-m/EduSphere-360](https://github.com/imtiazali-m/EduSphere-360)  
**Production branch:** `main`  
**Main SHA:** [`40c33fb20f2fe427887b18dd28e27802de559675`](https://github.com/imtiazali-m/EduSphere-360/commit/40c33fb20f2fe427887b18dd28e27802de559675)  
**Supabase:** `edusphere360-dev` / `osqhgsqrqhollxxtwrgy`  
**Authoritative migration evidence:** [23 Nov read-only ledger](REMOTE_MIGRATION_LEDGER_2026-11-23.json)

> This dated register supersedes the 16 November checkpoint. Older audit sections are historical evidence. The ledger is a read-only record of the live migration list and repository filenames; it is not permission to apply, replay, repair or mark migrations.

## Executive status

- Current main SHA is `40c33fb20f2fe427887b18dd28e27802de559675`.
- Main source/build workflow [#45028630417](https://github.com/imtiazali-m/EduSphere-360/actions/runs/45028630417) completed successfully on that exact SHA. Its source/build job passed; the EduSphere Cloudflare production deployment job was **skipped**.
- The separate GIDC Pages workflow [#45028630328](https://github.com/imtiazali-m/EduSphere-360/actions/runs/45028630328) passed its build and deployment jobs for the GIDC target. It is not an EduSphere production deployment.
- GitHub reports a successful Vercel status for the main SHA, but that is not a Cloudflare production smoke test. No authenticated production smoke test or rollback record is verified.
- Ten PRs were open at this snapshot. PR #94 and PR #70 are closed as merged; #94's merge commit is `634d78fc9c662e2cfdf549762861162970a9439f`, and #70's is `13ae86ef131aee85e009f922445803df65555305`.
- No human review submissions or inline review threads were found on the ten open PRs. Existing discussion comments are Vercel status messages and prior integration notes.
- GitHub reports `main` is unprotected; required status checks are not enforced by branch protection.
- The application baseline remains **online-only**. Offline record persistence/synchronisation is not implemented.

## Main branch and current exact CI

| Evidence | Result |
|---|---|
| Main SHA | `40c33fb20f2fe427887b18dd28e27802de559675` |
| Main GitHub Actions run | [45028630417](https://github.com/imtiazali-m/EduSphere-360/actions/runs/45028630417) — completed, success |
| Main source/build job | Passed |
| EduSphere Cloudflare production job | Skipped |
| GIDC Pages run | [45028630328](https://github.com/imtiazali-m/EduSphere-360/actions/runs/45028630328) — build and GIDC deploy passed |
| Main Vercel status | Success; not evidence of Cloudflare production smoke |
| Production authenticated smoke / rollback | Not verified |

A successful TypeScript/Vite build, source verifier, public browser check, Vercel status or PR preview does not prove authenticated E2E or production tenant isolation.

## Open PR graph

All ten open PRs were inspected for base/head SHAs, changed-file lists, mergeability, discussion comments, review submissions, inline review threads and exact-head GitHub Actions runs.

| PR | Base → head | State / mergeability | Exact-head Actions | Integration decision |
|---|---|---|---|---|
| [#95 Migration ledger + assurance](https://github.com/imtiazali-m/EduSphere-360/pull/95) | `main@b3cf182` → `48e799d9` at snapshot | Draft; mergeable | [43813790843](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43813790843) ledger success; [43813790711](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43813790711) project build success | Refreshing this existing assurance branch from current main; staged ACL-only security migration and updated ledger are in this review. No live DDL. |
| [#61 Review-metadata confidentiality](https://github.com/imtiazali-m/EduSphere-360/pull/61) | `main@cb772f05` → `510e823f` | Draft; not mergeable | 3 Actions runs passed: 43142482662, 43142482682, 43142482692; Vercel failed due free-tier daily deployment cap | High-priority confidentiality gate. The live Data API still grants anon/authenticated column privileges on internal review fields. Needs current migration reconciliation and disposable seven-role API tests. |
| [#62 Work-task identity + fee RPC](https://github.com/imtiazali-m/EduSphere-360/pull/62) | #61 branch `510e823f` → `112cbe31` | Draft; mergeable on stacked base | 6 Actions runs passed: 43145662633, 43145662646, 43145662659, 43145662639, 43145662808, 43145662622; Vercel failed due free-tier daily deployment cap | Keep stacked on #61. Do not retarget until #61 is reviewed and the four-migration sequence is validated. |
| [#72 College operational workspaces](https://github.com/imtiazali-m/EduSphere-360/pull/72) | `college-badin-redesign-2026-11-13@1d0c0c14` → `7f423516` | Draft; not mergeable | 3 Actions runs failed: 43553054167, 43553054057, 43553053985 | Base is the merged #70 redesign branch. Retarget/rebase to current main and fix custom-role/verifier failures before review. |
| [#84 Attendance device gateway](https://github.com/imtiazali-m/EduSphere-360/pull/84) | `main@7271525c` → `779135c2` | Draft; not mergeable | 3 Actions runs passed: 43681019853, 43681019849, 43681019852; Vercel failed due deployment quota | Coordinate with #85 because both change the Cloudflare release workflow. Its `20261115060000` migration is not in the remote ledger; physical terminal tests remain pending. |
| [#85 Formal fee receipts](https://github.com/imtiazali-m/EduSphere-360/pull/85) | `main@7271525c` → `c19716c5` | Ready; not mergeable | 3 Actions runs passed: 43690132955, 43690132914, 43690133023; Vercel failed due deployment quota | Rebase after #84/#85 workflow sequencing is agreed; refresh the migration note. Fee scenario E2E remains a release gate. |
| [#82 Leave workflows](https://github.com/imtiazali-m/EduSphere-360/pull/82) | `main@c7784b04` → `b5243278` | Ready; not mergeable | 3 Actions runs passed: 43612160324, 43612160286, 43612160261; Vercel failed due deployment quota | Rebase onto current main after the navigation baseline is stable; authenticated leave approval/balance tests remain pending. |
| [#79 AI/admin/academic/attendance workspaces](https://github.com/imtiazali-m/EduSphere-360/pull/79) | `main@c0319fe8` → `508c82a2` | Ready; not mergeable | 3 Actions runs failed: 43601387291, 43601387289, 43601387267 | Do not integrate as-is. Fix verifier/build defects and rebase. |
| [#69 GIDC public redesign](https://github.com/imtiazali-m/EduSphere-360/pull/69) | `main@d573622c` → `092b9fc7` | Ready; not mergeable | Source/privacy runs passed; main PR workflow 43456246311 failed at isolated preview | Compare unique changes against merged #70 before retaining; do not merge stale branch directly. |
| [#65 Admin submenu workspaces](https://github.com/imtiazali-m/EduSphere-360/pull/65) | `main@3c38c6b4` → `1b46f65e` | Draft; not mergeable | 3 Actions runs failed: 43448902306, 43448902054, 43448902264 | Fix Reading progress route/workspace dispatch, then rebase and rerun. |

### Required integration sequence

1. #94 is already merged and establishes the current dashboard/presentation baseline.
2. Keep this refreshed #95 isolated; review the staged attendance RPC ACL change and current migration ledger before any database release.
3. Review #61 before #62. #62 remains stacked on #61 and must not be independently retargeted.
4. Coordinate #84 and #85 because both modify `.github/workflows/cloudflare-pages-release.yml`; reconcile their migration versions before merge.
5. Retarget #72 from the merged #70 branch to current main. Rebase #82 after the shared navigation baseline.
6. Fix #79 and #65 verifier failures before re-review. Compare #69's unique diff against merged #70 and close only if fully superseded.
7. Re-run all checks on every new exact head; old green runs do not certify a rebased commit.

## Supabase read-only snapshot

### Migration history

The linked project currently reports **97 applied migration versions**. Current main contains **88 timestamped SQL files** and **11 legacy numbered SQL files**. This PR adds one proposed, un-applied ACL migration, so its source branch contains **89 timestamped files**.

The PR-head ledger therefore records:

- 97 remote applied versions.
- 89 local timestamped files (including the staged migration).
- 11 legacy SQL files.
- 12 local-only exact version prefixes.
- 20 remote-only exact version prefixes.
- 10 same-name version mismatches.
- 2 local-only migration names (the unresolved attendance-device migration plus this staged ACL migration).
- 10 remote-only migration names.

The remote latest version is `20261122133743`. The proposed migration uses `20261123100000`, which is later than the remote latest version. It is **not applied**. The older `20261115060000_attendance_device_event_review_approval.sql` also remains local-only and must not be assumed applied.

Do not replay, repair, mark or apply any migration while these history differences remain unresolved. The authoritative machine-readable list is [REMOTE_MIGRATION_LEDGER_2026-11-23.json](REMOTE_MIGRATION_LEDGER_2026-11-23.json).

### Security and performance

Read-only Supabase inspection returned:

- Public base tables: **166**; RLS enabled: **166**; RLS disabled: **0**.
- Public SECURITY DEFINER functions: **60**; authenticated-executable: **45**; anon-executable: **1**.
- Security Advisor: one RLS-enabled/no-policy informational finding (`platform_setup_control`); one anon-executable SECURITY DEFINER warning; 45 authenticated-executable SECURITY DEFINER warnings; leaked-password protection warning remains active.
- Performance Advisor: 304 unindexed foreign keys, 26 RLS init-plan findings, 136 unused-index notices and 39 multiple-permissive-policy findings. These require workload/predicate review; do not mass-add indexes or drop policies.

The anon-executable function is `public.record_student_attendance_scan(uuid,text,date,text,text,text,uuid)`. Its live body is SECURITY DEFINER, pins `search_path=public, private`, and calls `has_institution_role(p_institution_id, array['owner','admin','teacher'])`. The helper checks the signed-in caller's active membership in the requested institution. The current function ACL nevertheless includes PUBLIC/anon EXECUTE, even though anonymous callers cannot satisfy the membership gate.

### Staged security improvement in this PR

The proposed `20261123100000_revoke_anon_execute_record_student_attendance_scan.sql` migration:

- verifies the exact function signature and current SECURITY DEFINER/search_path settings before changing grants;
- verifies the existing active institution membership helper and its caller/institution/role predicates;
- verifies the owner/admin/teacher allowlist has not changed;
- revokes PUBLIC and anon execution;
- preserves authenticated and service-role execution;
- does not rewrite the function body or touch attendance rows.

A focused Node regression suite covers the seven application roles: owner/admin/teacher allowed by the existing membership gate; student/parent/accountant/exam_officer denied; anon denied by the ACL. This is a source/migration-contract test, not live authenticated E2E. The migration remains staged and unapplied until the ledger is reconciled and a development-branch migration test is separately approved.

### Edge Functions

Seven functions are listed ACTIVE: `attendance-device-admin` v1, `attendance-device-webhook` v2, `openai-live-session` v1, `ai-assistant` v9, `bootstrap-admin` v10, `create-user` v10 and `online-session-control` v2. No function was deployed in this run. Physical device/vendor testing and provider-backed workflows remain pending.

## Release acceptance gates

The following remain open until verified with the correct test class:

1. Seven-role authenticated acceptance and cross-institution denials for owner, admin, teacher, student, parent, accountant and exam_officer.
2. Student admission save/photo/guardian association/refresh persistence.
3. Teacher employee-account linking, rollback and live Edge Function deployment acceptance.
4. Fee partial/full payment, receipt issuance, overpayment, date handling and non-finance denials.
5. Attendance register, device-event review, assessments and result-publication journeys.
6. Institutional review-metadata Data API confidentiality migration and portal-role denial tests.
7. Supabase leaked-password protection setting.
8. Function-by-function review of all SECURITY DEFINER routines and their grants/callers.
9. Provider-backed messaging, online payments, physical device attendance and tested backup/restore.
10. Responsive desktop/tablet/mobile and keyboard/focus acceptance.
11. EduSphere Cloudflare production smoke test and a documented rollback record.

No authenticated credentials or disposable seven-role identities were available in this run. No production test data was created. Public browser checks, source tests and TypeScript/build checks are not substitutes for authenticated E2E.

## Work completed in this checkpoint

- Inspected current main SHA, all ten open PRs, base/head dependencies, changed files, comments, review submissions, inline review threads, mergeability and exact-head Actions runs.
- Re-read the live migration list, public table/RLS inventory, selected SECURITY DEFINER function bodies/ACLs, Edge Function inventory and security/performance advisors.
- Identified one unnecessary anon/PUBLIC execute grant on the attendance-scan SECURITY DEFINER RPC and staged a forward-only ACL restriction in this PR.
- Refreshed the machine-readable migration ledger and migration regression test against the 23 November read-only snapshot.
- Preserved the previous 16 November snapshot as historical evidence.
- No main-branch commit, PR merge, force-push, live Supabase change, Auth/storage/data mutation, Edge Function deployment or Cloudflare production deployment was performed.

## Next best work item

Reconcile the remote migration history against repository sources, then validate the review-metadata confidentiality migration (#61) and this attendance RPC ACL migration on an approved disposable Supabase development branch. Only after those schema/API tests should the seven-role authenticated journeys proceed.
