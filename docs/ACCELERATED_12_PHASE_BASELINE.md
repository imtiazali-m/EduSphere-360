# EduSphere 360 — Accelerated 12-phase baseline

**Audit date:** 10 November 2026  
**Source repository:** `imtiazali-m/EduSphere-360`  
**Baseline branch:** `main` at `323052767e1e00eb375b263d013727923dbeba32`  
**Working branch:** `work/accelerated-12-phase-start-20261110`  
**Live public website inspected:** https://edusphere360.pages.dev/

## 1. Product and architecture baseline

- Existing React 19, TypeScript 5.9, Vite 7 application.
- Existing Cloudflare Pages project remains the intended production host.
- Existing Supabase project `edusphere360-dev` (`osqhgsqrqhollxxtwrgy`) remains the application backend.
- Production application is online-only. Supabase Auth, institution-scoped PostgreSQL/RLS and private Supabase Storage remain authoritative.
- No replacement application, new Supabase project, local database, sample institutional records or production migration is part of this work.

## 2. Current implementation discovered

- Institutional navigation catalogue: 33 menu groups; the source verifier requires at least 400 submenu destinations.
- Seven roles: owner, administrator, teacher, student, parent/guardian, accountant and examination officer.
- Core configured generic data modules: students, teachers, attendance, examinations, results, fee invoices, assignments, assignment submissions, work tasks, timetable and announcements.
- Dedicated workspaces are present for institution administration, attendance, finance, payroll, governance, reports, student/staff management, notifications and selected campus operations.
- Some catalogue destinations intentionally resolve to `WorkspaceUnavailable`; a menu item or shared workspace route is not evidence that a complete end-to-end feature exists.
- Public welcome, owner registration and login screens were visually inspected. The public landing page has substantive sections and sample analytics that are explicitly illustrative, not institution data.

## 3. Current Supabase baseline — read-only inspection

- Project status: `ACTIVE_HEALTHY`; PostgreSQL 17.11.
- 71 public tables were returned by the project table listing; all reported RLS enabled.
- 30 migrations were returned as applied in the remote migration history.
- Two active Edge Functions were listed: `bootstrap-admin` and `create-user`.
- No database rows, policies, functions, migrations, storage objects, Auth settings or Edge Functions were changed during this inspection.

### Advisor findings to review — not blindly modify

- Security: 14 warnings for authenticated execution of SECURITY DEFINER functions, one RLS-enabled table with no policy (`platform_setup_control`), and leaked-password protection disabled.
- Performance: 115 unindexed foreign-key findings and one multiple-permissive-SELECT-policy finding on `payroll_runs`.
- Health advisor: no findings returned.
- These findings require function-body, grants, RLS, workload and intended-role review. In particular, SECURITY DEFINER functions may be deliberate for validated atomic workflows; revoking or changing them without inspecting their authorization logic could break or weaken the system.

## 4. First implementation slice on the working branch

The first code slice adds a role-specific “A Clear Next Step” panel to the signed-in dashboard:

- Owner/administrator setup path for academic structure, learners, staff, daily operations, fees and community notices.
- Teacher workbench for learners, attendance, coursework and assessments.
- Student learning hub for timetable, homework, attendance, results and fee information.
- Parent portal for linked learner information, attendance, learning, results and fee information.
- Accountant finance workbench for invoices, collections, receivables and finance reports.
- Examination officer workbench for question bank, exam calendar, marks, published results and reports.

The guidance derives its progress signals from records already loaded for the signed-in user under the existing RLS rules. It does not seed example records or certify that a complete business workflow is configured. Card destinations use dedicated routes already defined in the application.

Responsive styles and source-verification assertions were added alongside the component. A further route assertion checks representative destinations for owner, accountant, exam officer, parent, teacher and student contexts.

## 5. Twelve-phase execution register

| Phase | Scope | Baseline status |
|---|---|---|
| 1 | Inspect source, existing website, reusable work and gaps | Detailed source audit, 430 distinct menu labels, 1,566 role-aware route evaluations, 1,566 component sub-view checks; 0 route/dispatch/view mismatches; authenticated seven-role E2E remains pending |
| 2 | Welcome page, public website and visual system | Shared navy/sapphire system now spans public, auth, dashboard, specialist finance/payroll/governance/operations areas; root zoom removed and core contrast checks added; screenshot-based visual acceptance remains pending |
| 3 | Login, registration, verification and onboarding | Screens render; real signup, email verification, login and role-provisioning E2E tests remain |
| 4 | Dashboards, role menus and navigation | 33 groups, seven role allow-lists, exact component/sub-view routing and first-run role guidance are source-verified; authenticated direct-link/API permission tests remain |
| 5 | Administration, institution settings and academic structure | Dedicated partial workspaces and cloud tables exist; full CRUD/relationship/approval audit remains |
| 6 | Students, parents, employees and faculty | Student, parent and teacher menu entries are aligned with their actual internal tabs; admissions/directory/document tabs no longer appear where the role view hides them; relationship and lifecycle E2E remain |
| 7 | Attendance, timetable, teaching, homework and curriculum | Dedicated attendance/timetable/assignment areas and curriculum schema exist; full workflow and role tests remain |
| 8 | Fees, accounts, payments, receipts and payroll | Finance route views now include the reconciliation and partial-payment tabs used by the menus; dedicated workspaces and atomic RPCs remain subject to full transaction/reconciliation E2E |
| 9 | Transport, inventory, facilities, visitors and campus operations | Cloud schemas and selected workspaces exist; destination-by-destination CRUD, permissions and reports remain |
| 10 | Exams, question bank, results, reports and certificates | Exam/result and question-paper capabilities exist in part; paper approval, result lifecycle and certificates need end-to-end verification |
| 11 | AI, communication, WhatsApp and digital library | In-app notifications/library foundations exist; AI and external delivery providers must remain clearly unconfigured until connected |
| 12 | Security, integration, responsive QA, fixes and deployment | Security/performance findings require review; authenticated browser E2E, fresh Cloudflare build/deploy and smoke test remain |

## 6. Release evidence and limits

- GitHub Actions run `42982974444` completed successfully on the working branch: exact route audit, component sub-view compatibility audit, source verifier, user-error tests, finance tests, private-file tests, production Vite build, Cloudflare output validation and all four artifacts passed. The separate production deployment job was skipped by the production-branch/manual-approval guard.
- The latest working-branch Vercel status context also reports `success`; its deployment-detail URL redirects to Vercel login, so an anonymous browser preview URL was not confirmed. Neither check alone proves complete authenticated acceptance testing.
- The repository contains a Cloudflare Pages release workflow that installs the lockfile, generates/uploads the exact route matrix, runs the project verifier and focused test suites, builds `dist/`, packages a Direct Upload ZIP and keeps production deployment behind a manual workflow input.
- No Cloudflare production deployment was made during this work.
- No authenticated browser E2E test was run against all seven roles during this work.
- No live student insert, payment, payroll run, file upload, certificate issue, cross-institution denial or provider-delivery test was made during this work.
- The source package must not be uploaded directly to Cloudflare Pages. A fresh, successful Vite `dist/` build is required first.

## 7. Working rules

1. Preserve the current project, production data, approved architecture and working modules.
2. Treat unavailable routes as explicit gaps, not delivered functionality.
3. Do not invent live counts, historical trends, integrations, successful saves or release evidence.
4. Do not bypass RLS, expose service-role keys or apply legacy migrations blindly.
5. Keep source changes reviewable on the working branch until the relevant verification gates pass.
6. Distinguish source checks, CI/build checks, authenticated workflow tests and production deployment evidence in every phase report.


## 8. Expanded Phase 1 and Phase 2 work

- Phase 1 now has a detailed static source/navigation audit, seven-role inventory, composite route matrix, 33 groups and 430 distinct submenu labels. After removing Student Directory and Enrollment from student-role navigation, the menu has 1,567 role/menu evaluations: Owner 430, Administrator 430, Teacher 202, Student 144, Parent 139, Accountant 132 and Examination Officer 89. Route and component dispatch checks report zero unexpected route families, zero unintended bare roots and zero unmapped components. The new route-to-view audit further checks each requested sub-view against the actual receiving component and its role-specific tabs. The 55 generic institutional route evaluations represent 18 distinct library/inventory/transport master-data destinations and are explicitly not certified as specialised lifecycle workflows. See `docs/PHASE_1_DETAILED_AUDIT.md`, `docs/PHASE_1_ROLE_MENU_INVENTORY.md`, `docs/PHASE_1_EXACT_ROUTE_AUDIT.md` and `docs/PHASE_1_ROUTE_VIEW_AUDIT.md` in the review branch.
- Phase 2 now has a written design specification and shared token layer loaded after existing styles. The visual pass includes public welcome, authentication, dashboard, module workspaces, finance, payroll, governance and campus operations, all aligned around midnight navy and sapphire, with teal secondary accents and semantic state colours. See `docs/PHASE_2_DESIGN_SYSTEM.md`.
- Global `#root` zoom was removed from `operational-hierarchy.css`; responsive sizing is now handled at layout breakpoints rather than browser-level scaling.
- These source changes are isolated on the working branch. No production deployment or Supabase change was made. Visual browser review, screenshot acceptance and full role E2E remain release gates.
