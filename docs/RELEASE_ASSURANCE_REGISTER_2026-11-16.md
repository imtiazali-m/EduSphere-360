# EduSphere 360 — Release assurance register

**Snapshot:** 16 November 2026, Asia/Karachi  
**Repository:** [imtiazali-m/EduSphere-360](https://github.com/imtiazali-m/EduSphere-360)  
**Production branch:** `main`  
**Main SHA:** [`b3cf18201dd1b2aa4bab04e7f7713eb96bf156e0`](https://github.com/imtiazali-m/EduSphere-360/commit/b3cf18201dd1b2aa4bab04e7f7713eb96bf156e0)  
**Supabase:** `edusphere360-dev` / `osqhgsqrqhollxxtwrgy`  
**Current migration evidence:** [machine-readable 16 Nov snapshot](REMOTE_MIGRATION_LEDGER_2026-11-16.json)

> This is the current integration checkpoint. Older dated audit sections in `THIRD_AI_INTEGRATION_ASSURANCE.md`, `PHASE_1_DETAILED_AUDIT.md`, and the older migration reconciliation note are historical evidence and must not override this snapshot. The migration ledger is a read-only snapshot, not permission to apply, replay, repair or mark migrations.

## Executive status

- The existing React/TypeScript/Vite application remains the product baseline; Supabase is the existing Auth/Postgres/Storage/Edge Functions project and Cloudflare Pages is the production host.
- The application baseline is **online-only**. Offline persistence/synchronisation is not implemented and is not claimed.
- Current `main` source verification, TypeScript/Vite build, Cloudflare asset validation, public responsive checks and the main-branch Cloudflare deployment job succeeded on the exact main SHA.
- The latest observed main workflow deployed the `edusphere360` Pages project. This automation did not initiate that deployment. A separate production HTTP/browser smoke test and a rollback record are still missing; the available public fetch returned no page content and the browser smoke could not be started, so no successful production smoke is claimed.
- Ten pre-existing pull requests were open at the start of this run; this assurance work then opened PR #95, so **11 are open now**. PR #94 is the only pre-existing feature PR based on the current main SHA; the new assurance PR #95 is also based on that SHA. Several older branches overlap in shared dashboard/navigation/workflow files and need an explicit rebase/retarget sequence.
- No Supabase schema, migration history, policy, grant, function, Auth user, record, Storage object or secret was changed in this checkpoint.

## Main branch and exact CI evidence

**Main:** `b3cf18201dd1b2aa4bab04e7f7713eb96bf156e0`  
**Latest main workflow:** [Run 43729644113](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43729644113) — completed successfully on this exact SHA.

The run's source/build job passed the route and responsive audits, modal keyboard audit, project/security verifier, user-error, device-signature/review, online-session security, AI-provider, finance, private-file and teacher-provisioning tests, Vite production build, Cloudflare output validation and public welcome/login/setup browser checks. The Cloudflare deployment job also completed successfully and deployed to the `edusphere360` Pages project. The run log reported deployment URL [`a5f39f9a.edusphere360.pages.dev`](https://a5f39f9a.edusphere360.pages.dev).

**Release boundary:** the workflow success proves the build and deployment job completed. It does not prove authenticated production journeys, cross-tenant denials, a production smoke test, or a rehearsed rollback. The canonical Pages URL and authenticated application still require an independent smoke pass.

**Repository governance:** GitHub currently reports `main` as unprotected with required status checks disabled. Do not treat a green PR workflow as an enforced merge gate until branch protection is configured by an authorised repository administrator.

## Open pull-request graph

All ten pre-existing open PRs were inspected for base/head SHAs, changed paths, mergeability, exact-head Actions runs, conversation comments, review submissions and inline review threads. No submitted human reviews or inline review threads were present at the snapshot; coordination comments from this run were posted to #94, #85, #84, #72, #61 and #62 in addition to the automated Vercel status messages.

| PR | Base → exact head | State / mergeability | Exact-head Actions | Integration decision |
|---|---|---|---|---|
| [#95 Migration-ledger integrity and release register](https://github.com/imtiazali-m/EduSphere-360/pull/95) | `main@b3cf182` → code-bearing head `54a8da3a` (later report-only refresh) | Draft; mergeable | 8/8 ledger assertions passed and full project PR build passed on the code-bearing head: [ledger 43812958778](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43812958778), [project build 43812958722](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43812958722) | Isolated docs/test/CI guard only. The report-only refresh does not alter test logic; latest-head checks are rerunning. |
| [#94 Premium institutional design](https://github.com/imtiazali-m/EduSphere-360/pull/94) | `main@b3cf182` → `e4c29f3d` | Draft; mergeable | 6 runs, all success: [build 43735370339](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43735370339), [privacy 43735370354](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43735370354), [display 43735370509](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43735370509), plus matching push runs | Current-main presentation/workspace baseline. Review before merge. Vercel preview notifications report the free-tier daily deployment limit; this is separate from GitHub Actions. |
| [#85 Formal fee receipt workflow](https://github.com/imtiazali-m/EduSphere-360/pull/85) | `main@7271525c` → `c19716c5` | Ready; not mergeable | 4 runs, all success; [PR build 43690133023](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43690133023) | Stale base. Shares `.github/workflows/cloudflare-pages-release.yml` with #84. Its migration-history note must be refreshed against the 16 Nov snapshot before approval. |
| [#84 Attendance device gateway](https://github.com/imtiazali-m/EduSphere-360/pull/84) | `main@7271525c` → `779135c2` | Draft; not mergeable | 7 runs, all success; [PR build 43681019853](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43681019853), [latest push build 43691504220](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43691504220) | Stale base; shares the Cloudflare release workflow with #85. Its claimed migration `20261115060000` is not present in the current remote migration list; reconcile before any application or merge. Physical terminal testing remains pending. |
| [#82 Leave workflows and role-specific routes](https://github.com/imtiazali-m/EduSphere-360/pull/82) | `main@c7784b04` → `b5243278` | Ready; not mergeable | 6 runs, all success; [PR build 43612160261](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43612160261) | Stale base. Rebase after the current-main dashboard/navigation baseline is settled; authenticated leave journeys remain unverified. |
| [#79 AI, administration, academic and attendance workspaces](https://github.com/imtiazali-m/EduSphere-360/pull/79) | `main@c0319fe8` → `508c82a2` | Ready; not mergeable | 4 runs, all failure; [PR build 43601387267](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43601387267) | Do not integrate as-is. The verifier reports missing Administration submenus, missing AI-provider disclosure, missing Stage 8 Classes & Sections, and a TypeScript syntax error at `AcademicManagementWorkspace.tsx:795:66`. |
| [#72 College operational workspaces](https://github.com/imtiazali-m/EduSphere-360/pull/72) | `college-badin-redesign-2026-11-13@f54cadb6` → `7f423516` | Draft; not mergeable | 4 runs, all failure; [PR build 43553054057](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43553054057) | Base is the head of merged PR #70. Retarget/rebase onto current `main`; verifier fails the custom-role menu-filter assertion and expects a stale 78-migration count. |
| [#69 College public website redesign](https://github.com/imtiazali-m/EduSphere-360/pull/69) | `main@d573622c` → `092b9fc7` | Ready; not mergeable | Source, privacy and display checks passed; PR preview failed. [PR workflow 43456246311](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43456246311) | Appears superseded by merged PR #70, which uses the same college redesign direction and dedicated `gidcbadin` Pages target. Compare unique changes before closing; do not merge the stale branch directly. |
| [#65 Admin submenu workspaces](https://github.com/imtiazali-m/EduSphere-360/pull/65) | `main@3c38c6b4` → `1b46f65e` | Draft; not mergeable | 6 runs, all failure; [PR build 43448902264](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43448902264) | Verifier fails because Reading progress does not dispatch to its own student reading-history workspace. Rebase and fix the route/workflow assertion before review. |
| [#62 Work-task identity and fee RPC hardening](https://github.com/imtiazali-m/EduSphere-360/pull/62) | `security/institutional-record-review-isolation-20261112@510e823f` → `112cbe31` | Draft; mergeable on its current base | 7 runs, all success; [PR build 43145662633](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43145662633) | Stacked on PR #61. Do not retarget/merge before #61 is reviewed and the combined four-migration sequence is validated on an approved development branch. |
| [#61 Institutional review metadata isolation](https://github.com/imtiazali-m/EduSphere-360/pull/61) | `main@cb772f05` → `510e823f` | Draft; not mergeable | 7 runs, all success; [PR build 43142482692](https://github.com/imtiazali-m/EduSphere-360/actions/runs/43142482692) | High-priority confidentiality proposal, but not applied. It needs a current migration reconciliation, a separately approved Supabase development branch and authenticated seven-role API tests before it can be ready. |

### Required integration sequence

1. Review PR #94 first because it alone targets the current main SHA and its exact-head CI is green. It changes `Dashboard.tsx` and multiple workspace files also touched by #79, #72, #69 and #65; settle this baseline before rebasing those branches.
2. Retarget #72 from the already-merged PR #70 branch to current `main`, then rerun every check.
3. Reconcile #85 and #84 together because both modify the Cloudflare release workflow; independently verify their migration versions before merging either.
4. Rebase #82 and any still-needed unique changes from #79/#65/#69 onto the accepted current-main baseline. Fix verifier/build failures first. PR #69 should be treated as potentially superseded by #70 pending a unique-diff check.
5. Review #61 before #62. Keep #62 based on #61 until the dependency is intentionally integrated; validate all four staged migrations in order on the same approved development branch.
6. Do not merge any PR solely because an old exact-head workflow was green. Rebase changes the commit SHA and requires fresh exact-head Actions results.

## Supabase read-only snapshot

### Migration ledger

The linked project reports **94 applied migration versions**. Current `main` contains **85 timestamped migration SQL files** plus **11 legacy numbered SQL files**.

Exact version-prefix reconciliation:

- 8 local timestamped versions are not in the remote list.
- 17 remote applied versions have no exact local filename prefix.
- Of those, 7 migration names exist on both sides but have different version prefixes.
- 10 remote migration names have no matching local timestamped SQL source.
- 1 local migration name has no matching remote name: `attendance_device_event_review_approval` at local prefix `20261115060000`.

The 7 same-name version mismatches are:

| Migration | Local prefix | Remote applied version |
|---|---:|---:|
| `reports_run_history_and_student_sections` | `20261114194500` | `20261114135019` |
| `student_development_skills_competencies_activities` | `20261114200000` | `20261114140016` |
| `native_online_sessions_calling` | `20261115070000` | `20261115075239` |
| `native_online_sessions_realtime_and_link_guards` | `20261115080000` | `20261115080217` |
| `native_online_session_public_grants_lockdown` | `20261115100000` | `20261115080437` |
| `online_session_attendance_reconnect_fix` | `20261115110000` | `20261115080551` |
| `guardian_online_class_observer_access` | `20261115120000` | `20261115080731` |

The 10 remote migration names without a local name match are:

- `college_operations_custom_permission_guards` — `20261114032847`
- `college_permission_role_variable_fix` — `20261114033406`
- `college_self_service_privacy_bounds` — `20261114034316`
- `public_website_content_and_media` — `20261114053650`
- `public_announcement_publishing` — `20261114061138`
- `announcement_public_poster_media` — `20261114064712`
- `modern_institution_report_definitions_and_schedules` — `20261114130438`
- `student_attendance_section_and_pending_leave` — `20261114131133`
- `secure_student_qr_attendance_scans` — `20261114131223`
- `online_learning_meeting_and_video_link_fields` — `20261114133303`

**Safety decision:** do not add/replay/apply DDL or mark migrations as applied until these exact-prefix and missing-source differences are reconciled. In particular, do not infer that PR #84's `20261115060000` migration is applied to this project merely because its Edge Functions are active. No migration was applied, replayed, repaired or marked during this run.

The machine-readable snapshot and regression test are:
- [Remote migration ledger snapshot](REMOTE_MIGRATION_LEDGER_2026-11-16.json)
- [Migration ledger regression test](../scripts/test-migration-ledger.mjs)
- [Migration ledger CI workflow](../.github/workflows/migration-ledger-integrity.yml)

The new check verifies that the repository still matches the captured snapshot and fails if timestamped files or legacy SQL change without an intentional ledger update. It does not query Supabase or make migration drift safe to replay.

### Live schema and security advisors

Read-only queries returned:

- Public base tables: **166**; RLS enabled: **166**; RLS disabled: **0**. RLS being enabled does not prove every policy is correct.
- Public SECURITY DEFINER functions: **59**; authenticated-executable: **44**; anon-executable: **1**.
- Security Advisor:
  - `auth_leaked_password_protection`: warning — disabled.
  - `anon_security_definer_function_executable`: warning — `record_student_attendance_scan(uuid,text,date,text,text,text,uuid)`.
  - `authenticated_security_definer_function_executable`: warning — 44 functions need individual review.
  - `rls_enabled_no_policy`: informational — `public.platform_setup_control` has RLS enabled but no policies.
- Performance Advisor: **304** unindexed foreign keys, **26** auth RLS init-plan warnings, **156** unused-index notices, and **29** multiple-permissive-policy notices. These require workload- and predicate-aware review; do not mass-add indexes or drop policies.

The anonymous attendance-scan function has a fixed `search_path` and calls `has_institution_role`, whose implementation checks `auth.uid()` against an active institution membership. That body is designed to fail closed for an anonymous caller, but the function ACL still includes `PUBLIC` and `anon` EXECUTE. Treat this as an unnecessary exposure and review its authenticated call path; any grant change must wait for migration-ledger reconciliation and a reviewed forward migration.

### Edge Functions

Seven functions are listed ACTIVE in the linked project: `bootstrap-admin` v10, `create-user` v10, `ai-assistant` v9, `openai-live-session` v1, `attendance-device-admin` v1, `attendance-device-webhook` v2 and `online-session-control` v2.

Teacher account provisioning is materially improved in current source: `create-user` resolves exactly one institution-scoped unlinked employee before creating Auth, conditionally links that exact row, verifies the returned employee/user pair and attempts account rollback on later failure. The live `create-user` function is ACTIVE v10 with JWT verification enabled; its deployed `index.ts` matches current `main` byte-for-byte. The main workflow's teacher-provisioning guard test passed. This is **source + deployment evidence only**; authenticated disposable-account success and rollback E2E remain pending.

## Seven-role negative-authorization acceptance plan

The source-level workspace privacy regression covers owner/admin access to internal review metadata and denies that metadata to teacher, student, parent, accountant and exam_officer. It is not an authenticated API/RLS test.

| Role | Positive journey to exercise | Negative checks required |
|---|---|---|
| Owner | Institution setup, people, academic, attendance, finance, exams and governance | Cannot read another institution's records/storage; cannot bypass immutable audit or locked-register rules |
| Admin | Daily administration, admissions, staff, attendance and delegated operations | Cannot appoint another admin; cannot access another tenant; cannot elevate to owner |
| Teacher | Assigned classes/students, attendance, timetable, assessment and own employee record | Cannot view unassigned classes, internal reviewer metadata, finance-only data or another institution |
| Student | Own profile, timetable, attendance, assignments and published results | Cannot read another student, unpublished results, internal review metadata, staff/finance records or another institution |
| Parent | Linked learner's attendance, timetable, homework, published results and allowed fee view | Cannot read an unlinked learner, another guardian's private data, internal review metadata or another institution |
| Accountant | Fees, payments, receipts, finance journals and authorised payroll data | Cannot change marks/results, view unrelated student wellbeing/discipline, manage owner/admin access or cross tenants |
| Exam officer | Question bank, assessments, marks, moderation and result publication | Cannot access finance/HR or unrelated student private data, change owner/admin access or cross tenants |

For every role, test direct REST/Data API reads and writes (SELECT/INSERT/UPDATE/DELETE), RPC execution, Storage object paths, exports and deep links. Run explicit cross-institution denial probes for both rows and related foreign keys. Do not use production identities or invent credentials. Authenticated acceptance remains blocked until authorised disposable identities for all seven roles across at least two test institutions are available.

## Release acceptance gates

| Gate | Current evidence | Status / blocker |
|---|---|---|
| Seven-role authenticated acceptance and cross-institution denials | Source navigation/privacy checks only | **Pending.** Need disposable identities for all seven roles in two institutions and a safe test environment. |
| Student admission save, photo, guardian link and refresh persistence | Source alignment and build evidence only | **Pending.** Need owner/admin, student and guardian test identities plus disposable student/storage fixtures. No test records written. |
| Teacher employee-account linking and live Edge Function | Source guard tests passed; live `create-user` v10 matches main | **Partially verified.** Need authenticated disposable employee/account creation, exact link verification and rollback test. |
| Fee partial/full payment, receipt, overpayment, dates and non-finance denial | Finance source regression and PR #85 receipt workflow tests pass on their exact head | **Pending.** Need disposable invoices/payments and owner/admin/accountant plus non-finance identities; no live payment/receipt created. |
| Attendance, assessment and result publication journeys | Source checks and function inventory only | **Pending.** Need teacher/student/exam_officer and owner/admin test identities; verify draft → submit → moderate → approve → publish, corrections and locked registers. |
| Review-metadata API confidentiality migration | Draft PR #61; migration not applied | **Blocked.** Need migration ledger reconciliation, explicit approval for the separate development-branch compute cost and seven-role API tests. |
| Leaked-password protection | Security Advisor warning remains | **Pending.** Requires an authorised Supabase Auth password-security setting change and recovery/password flow validation. |
| SECURITY DEFINER review | 59 functions; 44 authenticated and one anon execution warning | **Pending.** Function-by-function caller, tenant check, search_path, grants, row-lock and transaction review. |
| Provider-backed messaging, online payments, device attendance and real backup/restore | Configuration/workspace code exists; provider evidence incomplete | **Pending.** Need institution-authorised provider credentials, webhook/callback setup, payment sandbox, physical device/vendor access and a separate restore target. |
| Responsive/accessibility/keyboard acceptance | Public responsive and modal keyboard source/browser checks passed in CI | **Partially verified.** Need authenticated desktop/tablet/phone acceptance, keyboard-only traversal, focus visibility and target-size review. |
| Production Cloudflare smoke test and rollback record | Main deployment job succeeded | **Pending.** Need independent canonical URL HTTP/browser smoke, authenticated smoke and a recorded previous deployment/rollback procedure. |

## Work completed in this checkpoint

1. Re-read the current main SHA, all ten open PRs, changed paths, base/head dependencies, mergeability, discussions, review submissions, inline review threads and exact-head Actions runs.
2. Read the live Supabase migration versions, public table/RLS counts, selected function definitions/ACLs, Edge Function inventory and security/performance advisors using read-only operations only.
3. Confirmed the current main teacher-provisioning guard source and the live `create-user` v10 deployment match at the entrypoint.
4. Added a machine-readable migration snapshot and a Node built-in regression test/workflow in isolated [PR #95](https://github.com/imtiazali-m/EduSphere-360/pull/95). The migration-ledger test passed 8/8 and the full project PR workflow passed on code-bearing head `54a8da3a`; a later docs-only refresh is being rechecked. No existing feature branch or shared application component was overwritten.\n5. Posted concise migration/shared-file sequencing notes to PRs #94, #85, #84, #72, #61 and #62.
5. Recorded the current PR integration sequence and release gates here.

**Live Supabase changes this run: none.**  
**Main-branch commits this run: none.**  
**PR merges this run: none.**  
**Production deployments initiated by this run: none.**

## Next best work item

First reconcile the 94-version remote migration ledger against the 85 timestamped source files without replaying historical SQL. Then validate PR #61 on a separately approved development branch, beginning with the institutional review-metadata confidentiality boundary. In parallel, provision authorised disposable seven-role test identities so the authenticated acceptance matrix can move beyond static/source evidence.
