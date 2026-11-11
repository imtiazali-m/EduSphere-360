# EduSphere 360 — Third-AI Integration & Engineering Assurance

**Audit date:** 11 November 2026 (Asia/Karachi)  
**Workstream:** Chief Integration & Engineering Assurance  
**Repository:** `imtiazali-m/EduSphere-360`  
**Baseline branch:** `main` at `323052767e1e00eb375b263d013727923dbeba32`  
**Supabase project:** `edusphere360-dev` (`osqhgsqrqhollxxtwrgy`)  
**Scope:** Read-only repository and live database review; no production source, schema, policy, user, record or deployment changes were made during this audit.

## Executive decision

Keep the existing application and the active Phase 2 work. Do not create a parallel prototype, do not replace the current UI branch, and do not replay old migrations. The live database is materially ahead of several archived QA reports, so all future decisions must use the current repository branch, the current remote migration history and live schema evidence.

The production deployment status remains **unverified**. A GitHub Actions run built the current working branch successfully and published an isolated pull-request preview, but its production deployment job was skipped.

## Verified architecture and state

- Frontend: React 19, TypeScript 5.9 and Vite 7.
- Backend: Supabase Auth, PostgreSQL 17 and Storage.
- Hosting: Cloudflare Pages workflow with a manual production-release gate.
- Live Supabase project status: ACTIVE_HEALTHY.
- Live public schema: 74 tables; RLS is enabled on all 74.
- Remote Supabase migration history: 30 timestamped entries.
- Repository migration folder: 30 timestamped SQL files plus 11 legacy numbered SQL files.
- Main-branch project verifier requires 33 menu workspaces and at least 400 submenu destinations. This is a source/navigation assertion, not proof that all destinations contain complete operational workflows.
- The current application explicitly runs online-only. When the browser is offline it displays an internet-required screen; no IndexedDB record store or offline synchronization is currently implemented.

Core live tables with existing records include institutions, profiles, memberships, students, attendance, exams, exam results, fee invoices, fee payments, timetable entries, academic sessions, student history, institutional records and audit events. Table existence and row counts do not establish full module completion.

## Release and parallel-work status

### Active parallel work

The repository has one open pull request at the time of this audit:

- PR #15 — [EduSphere 360 route reliability and full front-end visual refresh](https://github.com/imtiazali-m/EduSphere-360/pull/15)
- Working branch: `work/accelerated-12-phase-start-20261110`
- It adds a unified presentation layer, route-to-view and responsive source audits, dashboard first-run guidance and related visual refinements.
- Its PR description says the front-end refresh does not alter Supabase schema, RLS, Edge Functions, Auth configuration, Storage or existing records.

### CI evidence

- [Run 42994416940](https://github.com/imtiazali-m/EduSphere-360/actions/runs/42994416940): dependency installation, route audits, project verifier, focused user-error/finance/file-access tests, Vite production build, artifact creation and isolated PR preview all passed. Production deployment was skipped.
- Run 42995299161 on commit `8a29b2b67914cda00a4dad46b719022232f505bd` also completed successfully.
- At the last live check, newer runs for commit `91aaed671d464beaf17f9b7ece28c1bd0529b84e` were still in progress. Recheck the latest branch head and CI before accepting PR #15.
- Do not infer a production release from a successful build or PR-preview deployment.

## Parallel-work integration update — 11 November 2026, 14:39 PKT

The initial repository snapshot above predates the dedicated admission sub-PR opened by the other workstream. Current PR graph:

- [PR #15](https://github.com/imtiazali-m/EduSphere-360/pull/15) remains the presentation/navigation baseline, targeting `main`. Its current branch head at this follow-up check is `9881b1ef38edd695492ba72eacb6c770b0187156`. The latest verified build and isolated preview on this branch passed at this head; the production deployment job was skipped.
- [PR #17](https://github.com/imtiazali-m/EduSphere-360/pull/17) adds the dedicated student admission workspace. It deliberately targets PR #15's working branch, not `main`, and is therefore dependent on the visual/navigation baseline. Its three application/source changes are limited to `RecordModule.tsx`, `main.tsx` and `student-admission-workspace.css`; the fourth change adds a source-verifier assertion. Its exact head `be3bbaa63b9293d12b5b7446f2f656aecd0af510` passed the full GitHub Actions source verification, focused tests, Vite production build, artifact creation and isolated PR preview. Production deployment was skipped.
- PR #17's own description correctly states that authenticated admission save and photo persistence E2E remain untested. The diff retains the existing cloud save and storage path; it does not repair or certify the historic live admission-save issue.
- [PR #18](https://github.com/imtiazali-m/EduSphere-360/pull/18) is this assurance report, opened as a draft against `main`. It changes documentation only.

**Recommended merge order:** review and merge PR #15 into `main` first, then retarget/rebase PR #17 onto the updated `main`, rerun the complete CI and preview checks, and only then review the student admission change for merge. Do not merge PR #17's current dependent base directly into `main` without that integration step.

## Priority engineering findings

### P1 — Teacher account provisioning can create an unlinked account

**Evidence:** The active `create-user` Edge Function checks the caller's authenticated session and active owner/admin membership, then creates the Auth user, profile and institution membership. For `role === 'teacher'`, it subsequently runs an update against `public.teachers` using the institution and normalized email. The current function does not inspect the update error or returned row.

The live schema has a unique index on `(institution_id, lower(btrim(email)) )`, so the email lookup should match at most one employee record. It may match no record. In that case, the function can still return success while the new teacher login is not linked to a faculty/employee row. Teacher-specific employee views and employee workflows rely on the `teachers.user_id` relationship.

**Remediation:** Make the provisioning contract explicit. Before creating the Auth identity, require exactly one eligible employee record for the institution/email, or provide a deliberate workflow that creates the employee record and login together. Verify the update returned the expected teacher ID. If linking fails, roll back the newly created Auth user/profile/membership. Add tests for no matching employee, one matching employee, duplicate/ineligible records and rollback. Do not deploy this fix until it passes a Deno function test and a live test using a disposable account.

### P1 — Migration version mismatch reconciled in source

**Original evidence:** The live migration history contained version `20261109085154` with name `faculty_employee_management`, while the repository filename used prefix `20261109083133`. The other 29 timestamped version prefixes already aligned.

**Remediation proposed:** [PR #20 — Align faculty migration filename with applied Supabase version](https://github.com/imtiazali-m/EduSphere-360/pull/20) copies the migration SQL byte-for-byte to `20261109085154_faculty_employee_management.sql`, removes the stale filename and updates all three verifier references. A post-change comparison reports 30 local and 30 remote versions, with no local-only or remote-only versions.

**Status:** Source correction proposed; CI/PR review pending.. No database migration, SQL statement, live schema or migration-history row was changed. Do not run database push/replay as part of this filename-only correction. Keep the 11 legacy numbered migrations out of replay.

### P2 — Work task ownership is based on email text, not a stable identity

**Evidence:** `public.work_tasks` stores required `assigned_to_email` and `assigned_to_name` values. Its owner/admin and employee SELECT/UPDATE policies compare the assigned email with the email in the JWT; the frontend filters assigned work by the signed-in email.

**Risk:** Email changes, aliases, casing changes, reused addresses or stale assignment text can break ownership continuity or make assignment management ambiguous. An email address is mutable profile data, not a durable foreign key to an Auth identity.

**Remediation:** Introduce a tenant-scoped `assigned_to_user_id` relationship to the employee identity (preferably through `teachers.user_id` or a canonical institution membership/user relation). Backfill only where institution + normalized email resolves to exactly one active account. Preserve the historical email/name snapshot for display/audit, update RLS to use the stable identity and keep an explicit owner/admin override. Test cross-institution isolation and email-change behavior before switching the UI.

### P2 — Leaked-password protection is disabled

**Evidence:** Supabase Security Advisor currently reports `auth_leaked_password_protection` as a warning.

**Remediation:** Enable breached-password protection in Supabase Auth password security settings and verify the configured authentication flows still behave as expected. This is an Auth project setting, not a frontend-only change.

### P2 — Security-definer API surface needs function-by-function review

**Evidence:** Supabase Security Advisor reports 14 SECURITY DEFINER functions executable by the authenticated role. The inspected functions pin `search_path`; relevant authorization helpers use the active caller context. The `is_admin_for_user` helper has no direct `auth.uid()` reference in its body but delegates to `has_institution_role`, which resolves the current caller. No exploit was demonstrated by this audit.

**Remediation:** Inventory each RPC's callers and intended role boundary. Verify explicit caller/tenant authorization, fixed search path, row locks and transaction behavior, then restrict EXECUTE only where the function is not an intended client API. Do not mass-revoke SECURITY DEFINER functions; several are used by RLS policies and atomic fee, finance, approval and payroll workflows.

### P2 — Performance advisories should be workload-led

**Evidence:** Current advisor results include 115 unindexed foreign-key findings, two RLS initialization-plan warnings on `work_tasks`, 88 unused-index notices and one multiple-permissive-policy notice on `payroll_runs`. Health advisor returned no lints.

The payroll policy overlap is not automatically removable: the finance policy covers owner/admin/accountant access, while the separate SELECT policy permits employees to read their own payroll run through linked payroll items. Dropping either without redesign would change access.

**Remediation:** Prioritize FK indexes on frequently joined/deleted tenant-scoped relations after checking existing composite indexes and query plans. Rewrite repeated auth function calls as init-plan subqueries where appropriate. Preserve employee payroll visibility while consolidating policies carefully. Never drop an index solely because the current advisor reports it unused.

### P3 — Platform setup control intentionally has no direct RLS policy

**Evidence:** Security Advisor reports RLS enabled but no policy on `public.platform_setup_control`.

**Remediation:** Confirm all required reads/writes occur only through the intended privileged, one-time bootstrap RPC and that no frontend workflow expects direct table access. A no-policy table denies ordinary client access; do not add a broad authenticated policy merely to silence the advisory.

### P1 — Offline records and synchronization are not implemented

**Evidence:** Current README and `src/App.tsx` describe an online-only application. Offline browser state leads to an internet-required screen. No local record database or offline synchronization is in the active code path.

**Remediation:** Treat offline mode as a separate architecture milestone, not a quick localStorage fallback. Define supported offline workflows, local encrypted persistence, tenant/user scoping, queued mutations, idempotency keys, conflict resolution, expiry/revocation, storage cleanup, and a visible sync state. Start with a limited, low-risk read/write pilot (such as attendance drafts) and test reconnect, duplicate submissions, device loss and permission changes before enabling broader offline operation.

## Student admission: current code/policy alignment

The current source and live policy use the same authorization rule:

- The frontend verifies the Supabase user ID against the active app session.
- It verifies active institution membership and role.
- Student creation is restricted in the UI to owner/admin.
- The client calls `has_institution_role(institution_id, ['owner','admin'])` before insert.
- The live `students` INSERT policy enforces `has_institution_role(institution_id, ARRAY['owner','admin'])`.
- The student INSERT intentionally omits `.select()`, avoiding an unrelated SELECT-policy requirement in `RETURNING`.

This is aligned at source/policy level. A real signed-in owner create → refresh → directory visibility test and an unauthorized-role denial test are still required. Do not disable RLS or broaden the student insert policy to bypass a failed test.

## Product completeness boundaries

The current benchmark/gap review correctly distinguishes a large navigation catalogue from implemented workflows. It notes that many workspace groups currently use typed institution-scoped records in `institutional_records`, while only a subset has dedicated relational workflows. It also identifies unconfigured device attendance feeds, provider backup/restore, third-party email/WhatsApp/SMS/payment integrations and legal review as incomplete or dependent on external setup.

Use this distinction consistently:
- **Working:** backed by an implemented, tested source path and the expected database operation.
- **Partially implemented:** relevant tables/screens exist, but related operational steps, automation, permissions or end-to-end tests are missing.
- **Proposed/unconfigured:** no claim of a live integration or operational feature until provider credentials, source connection and delivery tests succeed.

## Parallel backend remediation update — 11 November 2026

A separate backend-focused change now addresses the P1 teacher account-linking defect:

- [PR #19 — Fix teacher account provisioning and employee identity linking](https://github.com/imtiazali-m/EduSphere-360/pull/19)
- Branch: `fix/teacher-account-link-integrity-20261111`
- The function resolves exactly one institution-scoped unlinked employee before creating an Auth user, links by exact employee ID with a `user_id IS NULL` guard, verifies the returned employee/user pair, and attempts Auth-user rollback on any later failure.
- The Account Management form explains that the employee record must first be saved with the same email.
- Added pure identity-guard regression coverage for normalization, ILIKE wildcard escaping, missing/ambiguous/already-linked employees and returned-row verification.
- Dedicated guard workflow passed on the PR head. The main repository verifier and production Vite build also passed on the same PR head.
- The dedicated guard tests and the full project verifier/production Vite build passed on the PR head. Production deployment was skipped. The live `create-user` Edge Function is not updated by this PR; authenticated disposable-account E2E and rollback verification remain mandatory before deploying it.

This PR is independent of PR #15's visual refresh and PR #17's student-admission workspace. It must be reviewed/merged as a backend fix without changing the latter PRs' dependency order.

## Migration ledger update — 11 November 2026

The migration version mismatch is now isolated in [PR #20](https://github.com/imtiazali-m/EduSphere-360/pull/20). The faculty migration SQL body is unchanged; only its timestamped filename prefix and verifier references changed. The local/remote version comparison now reports 30/30 with no version gaps. Supabase remained read-only. PR #20 must pass source verification and build before merge.

## Integration rules for all parallel workstreams

1. Use `imtiazali-m/EduSphere-360` as the canonical source repository and `edusphere360-dev` as the existing Supabase project. Do not create another product repository or a replacement database.
2. Do not commit directly to `main`. Work in an isolated branch and open a reviewable PR.
3. Do not overwrite or force-push the active `work/accelerated-12-phase-start-20261110` branch or other agents' feature branches.
4. Before changing shared components, route maps, role registries, schema, RLS or Edge Functions, fetch the current branch head again and inspect the in-flight PR diff.
5. One authoritative table/field/workflow definition per domain. Avoid a new generic CRUD path where a dedicated transactional workflow already exists.
6. Keep tenant ID on every institution-owned record and every join. Verify cross-tenant reads, writes, foreign keys and storage paths.
7. Never disable RLS, put service-role/secret keys in Vite variables or public code, or use user-editable metadata as an authorization source.
8. Never seed fake production records or present placeholders as completed provider integrations.
9. No destructive SQL, migration replay, policy expansion, Auth-user mutation or production deployment without a reviewed change plan and test evidence.
10. Every feature PR must include changed files, migration notes, roles tested, workflows tested, outstanding defects and whether CI, browser QA, preview or production deployment actually ran.

## Acceptance gates

- Source verification and a clean locked-dependency production build pass on the exact proposed commit.
- Automated tests cover the changed workflow, including negative permission and cross-tenant cases.
- Supabase migration history and schema diff are understood before DDL is applied.
- RLS and Storage access are tested with owner, admin, teacher/employee, student, parent, accountant and exam-officer test identities where applicable.
- Browser checks cover create, view, edit, delete/archive, search/filter/sort, validation, empty/error/loading/success states and refresh persistence.
- Responsive checks are performed in a real browser at desktop, tablet and phone widths; source CSS inspection alone is not a visual sign-off.
- Online/offline tests are performed only when a real offline implementation exists.
- Production deployment is separately authorized, verified by the provider result and followed by a production URL smoke test and rollback reference.

## Changes made during this audit

**No production changes.** Repository and Supabase inspections were read-only. An isolated Git branch was created for this assurance record. No migration, table, policy, RPC, user, record, bucket, function deployment or Cloudflare production deployment was changed.

## Immediate recommended order

1. Recheck PR #15 head, CI and preview; keep the active UI changes isolated until visual/browser checks are complete.
2. Fix and test teacher account ↔ employee linking in a separate backend-focused PR.
3. Reconcile the one migration version mismatch without replaying SQL.
4. Complete an authenticated seven-role permission and core workflow test matrix.
5. Stabilize employee work-task identity with a safe backfill and compatible RLS transition.
6. Update the archived QA/rebuild reports so they no longer describe the current live schema as 36 tables/six migrations or state that the GitHub build workflow has never run.
7. Plan offline support as a separately scoped, threat-modelled milestone.
