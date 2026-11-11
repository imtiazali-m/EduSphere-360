# Phase 1 — Detailed source, navigation and workflow audit

**Audit date:** 10 November 2026  
**Repository:** `imtiazali-m/EduSphere-360`  
**Working branch:** `work/accelerated-12-phase-start-20261110`  
**Production status:** Existing Cloudflare Pages site preserved; this audit does not deploy or change production data.

## Purpose and audit boundary

Phase 1 is an evidence-led inspection of the existing product before changing its design or workflow code. It distinguishes what is present in source, what is connected to an existing workspace, what is explicitly unavailable, and what still needs an authenticated end-to-end test. A menu label, route, table, or dashboard count is not treated as proof that the complete business process works.

The audit covers the repository architecture, public screens, authentication entry points, role-filtered navigation, route resolution, workspace dispatch, existing data modules, and the known cloud/security baseline. This is a source audit, not a claim that all seven roles have passed live browser acceptance testing.

## 1. Existing application architecture

- Frontend: React 19, TypeScript 5.9 and Vite 7.
- Production hosting target: the existing Cloudflare Pages project.
- Backend: the existing Supabase project, Auth, institution-scoped PostgreSQL with RLS, private Storage and existing Edge Functions.
- Current production direction: online-only; no local database, localStorage/IndexedDB substitute, replacement Supabase project, or second prototype.
- The entry point is `src/main.tsx`; `App.tsx` selects the public welcome, owner setup, login/reset and signed-in dashboard screens.
- `Dashboard.tsx` is the signed-in application frame. It hosts the role-specific navigation, topbar/search, open-workspace tabs and workspace dispatcher.
- Core navigation sources are `institutionalCatalog.ts`, `navigationCatalog.ts`, `navigationRoutes.ts` and `navigationAccess.ts`.
- Generic record configuration lives in `modules.ts`; dedicated workspace components cover institution administration, attendance, finance, payroll, governance, reports, faculty, notifications and selected operational areas.

## 2. Seven-role access model in the source

| Role | Intended workspace emphasis | Source-level access pattern |
|---|---|---|
| Owner | Institution control, settings, people, academics, finance, operations and oversight | Included in all defined catalogue role groups; ultimate institution authority remains subject to backend authorization |
| Administrator | Daily institution administration, people, academics, governance, reports and operations | Management role; menu access is filtered separately from owner |
| Teacher / employee | Assigned learners, teaching, attendance, timetable, assessment and relevant operations | Staff/academic/family group access with role-specific item allow-lists |
| Student | Own learning, timetable, attendance, submissions, results, fees and family-facing records | Narrow student item allow-lists; must not imply institution-wide visibility |
| Parent / guardian | Linked learner progress, attendance, timetable, homework, results and fee information | Linked-family views; must be validated against guardian-to-student relationships and RLS |
| Accountant | Fees, receivables, payments, receipts, accounts, reconciliation and payroll-related finance | Finance role; dashboard items and menus are selectively filtered |
| Examination officer | Question bank, examination planning, assessment, marks, result publication and reports | Academic/examination role; financial and unrelated administrative views are restricted in navigation |

The catalogue declares role sets such as management, staff, academic, finance, family and examinations. `roleNavigationGroups(role)` filters groups and applies further role-specific item allow-lists. This proves source-level menu filtering only. It does **not** replace database RLS or prove a user cannot call an unauthorized API directly.

## 3. Exact role-aware route resolution

The release workflow executes the actual TypeScript route resolver for every submenu destination visible to each role. The complete source catalogue still contains 33 groups and 430 distinct submenu labels; the runtime role filter exposes a subset. The latest source-generated audit evaluated **1,223 role/menu combinations** across the seven role-filtered menus:

| Role | Visible groups | Visible destinations |
|---|---:|---:|
| Owner | 31 | 343 |
| Administrator | 31 | 343 |
| Teacher / employee | 18 | 152 |
| Student | 15 | 107 |
| Parent / guardian | 15 | 104 |
| Accountant | 12 | 112 |
| Examination officer | 7 | 62 |

The generated audit reports **343 explicitly unavailable role-visible entries**, **115 linked institutional route evaluations** and **1,108 other workspace route evaluations**. It found **zero unexpected route families, zero non-intentional bare module roots and zero unmapped Dashboard dispatchers**. The role-specific unavailable/linked subtotals are not separately asserted here; only the generated aggregate counts are reported.

The audit exposed old overrides that collapsed dashboard shortcuts and timetable pages to module roots. Dashboard links now preserve their typed academic report, finance overview, attendance, published results, comparison and task-queue sub-views. Timetable links now preserve class, teacher and room views as well as weekly, daily, conflict and history destinations before legacy overrides are consulted.

The 115 role-visible institutional route evaluations split into **60 specialist linked-workspace dispatches** and **55 generic institution-record dispatches**. The 55 generic entries represent 18 distinct Library, Inventory and Transport master-data destinations. They use institution-scoped `institutional_records` CRUD and group-specific fields, but are not certified as specialised transactional workflows.

A successful source route audit does not prove the rendered page, API authorization, RLS, persistence or end-to-end business transaction; those remain browser and backend acceptance gates.

## 4. Component sub-view compatibility

The release workflow now checks each role-visible destination through the shell target calculation and validates its requested sub-view against the receiving component's actual view contract and role-specific internal tabs. It writes `docs/PHASE_1_ROUTE_VIEW_AUDIT.md` and uploads the `edusphere360-route-view-audit` artifact. This catches a menu that routes to a component but requests a tab that does not exist or is hidden from that role. This remains static source-level evidence; actual rendering, API authorization and persistence still require browser acceptance.

## 5. Menu and route inventory

The current institutional catalogue contains **33 top-level menu groups** and the project verifier enforces a catalogue of at least **400 submenu destinations**. The menu is intentionally broad, covering:

1. Dashboard and AI intelligence
2. Administration, institution configuration and academic structure
3. Academic sessions, classes/sections and subjects
4. Students, employees/faculty and attendance
5. Timetable, teaching/homework and behaviour/skills
6. Communication and WhatsApp
7. Question bank, examinations and class tests
8. Reports, certificates, curriculum and digital library
9. Transport, inventory, facilities and visitors
10. Accounts/finance, fees, receivables, payments, receipts and payroll
11. Reconciliation/audit and backup/data management

Menu breadth is not the completion metric. Each destination must resolve to the correct role-scoped workspace and support the promised actions with real cloud records.

### Route resolution rules

- The authoritative route lookup uses the composite `groupKey:itemSlug`, avoiding collisions where two menu groups reuse a label.
- Explicit route mappings preserve the requested sub-view where a dedicated workspace exists.
- Selected institutional routes are dispatched to linked operations workspaces; other destinations use dedicated finance, payroll, governance, operations, attendance, faculty, administration or configured record modules.
- An explicit `unavailable:` route opens a clear unavailable-workspace state rather than silently claiming that the feature is implemented.
- A route marked as connected in the menu means that it is not tagged unavailable. It is not proof of end-to-end CRUD, authorization, provider connectivity or successful persistence.

### Explicit route gaps identified in source

The current route map intentionally identifies unavailable destinations in the following areas. These are the first Phase 1 follow-up list, not a statement that every related module is absent:

| Area | Examples of destinations currently marked unavailable |
|---|---|
| AI and backup | AI tools and backup/restore destinations pending evidence, safety and implementation |
| Student operations | Bulk student operations |
| Employee reporting | Employee performance view |
| Attendance | Attendance alerts |
| Reports | Custom report builder, scheduled reports, report templates and report history |
| Question bank | Question-bank import/export and question-paper version history |
| Curriculum | Teaching resources, learning materials, resource downloads, chapter materials and progress tracking |
| Behaviour | Student progress history, behaviour analytics and downloadable behaviour reports |
| Certificates | Experience certificates, ID-card designer, templates, editable document templates and bulk generation |
| Library | Reading records, reading cards and student reading history |
| Transport | Transport attendance |
| Facilities | Room reservations and facilities reports |
| Visitors | Visitor approvals, notifications and reports |
| Timetable | Teacher availability, substitutions, publishing, class coverage and engaged-class views |
| Examinations/tests | Invigilation, automatic checking, online/written class tests and test-question workflows |
| Fees/payments | Online payments and online payment records |
| Receipts | Receipt templates, numbering and bulk generation |
| Communication | WhatsApp integration, individual/bulk/class messages, employee notices, templates, delivery history and communication reports |

The correct next action for each gap is to inspect its schema, existing functions, authorization model, provider dependencies and adjacent workflows; then either complete the workflow or keep the route explicitly unavailable. Do not create a visual-only screen that pretends an external integration or transaction has completed.

## 6. Existing data modules and workspace coverage

The source includes configured generic data modules for core entities such as students, faculty/staff, attendance, examinations, exam results, fee invoices, assignments/submissions, timetable and announcements. Dedicated components exist for several high-value areas, including administration, student/faculty management, attendance, finance, payroll, governance, reports, notifications and selected campus operations.

The module audit must classify every destination with these separate states:

- **Dedicated workflow:** a specific workspace exists and its full record lifecycle still requires testing.
- **Configured record module:** fields, columns and roles are configured; validation, relationships and persistence still require testing.
- **Linked destination:** a menu route is mapped into a related workspace; verify the requested view and all actions.
- **Unavailable:** explicitly shown as not implemented/connected; do not describe as delivered.
- **External dependency:** provider setup and verified delivery are required before an integration can be called active.

## 7. Cloud, data and security baseline

Read-only baseline recorded before the current design work:

- Supabase project status: ACTIVE_HEALTHY; PostgreSQL 17.11.
- 71 public tables were returned by the project listing; all reported RLS enabled.
- 30 migrations were recorded as applied; two active Edge Functions were listed: `bootstrap-admin` and `create-user`.
- Advisor findings: 14 authenticated-execution warnings on SECURITY DEFINER functions; one RLS-enabled table without a policy (`platform_setup_control`); leaked-password protection disabled; 115 unindexed foreign-key findings; and one multiple-permissive-SELECT-policy finding on `payroll_runs`.
- These are review items, not permission to blindly revoke functions, loosen RLS, or apply ad hoc migrations.
- A historical student insert/save attempt returned a Supabase 403 RLS error (`new row violates row-level security policy for table "students"`). Reproduce with a real authorized owner account and inspect the full policy path before changing it.
- The latest project CI build and verifier passed on the working branch. Production Cloudflare deployment and seven-role authenticated browser E2E were not performed as part of that CI result.

## 8. Required acceptance matrix before a module can be called complete

| Test family | Required evidence |
|---|---|
| Role access | Sign in as each applicable role; verify allowed menus, denied routes, direct deep links and API/RLS behaviour |
| Tenant isolation | Confirm users cannot read, insert, update, delete, export or attach files across institutions |
| Record lifecycle | Create, view, edit, validate, archive/cancel where appropriate, and verify persistence after refresh |
| Relationships | Verify student–guardian links, class/session/subject assignments, employee allocations, invoice/payment links and exam/result links |
| Financial controls | Verify server-side amount calculation, duplicate/idempotency protection, receipt allocation, balanced journals, reversal and audit trail |
| Academic lifecycle | Verify attendance register, correction/approval, timetable publishing, assignment submission/review, exam marks/moderation and result publication |
| Security | Verify role changes, invitation/verification, RLS, storage paths, function grants and audit events |
| Responsive and accessibility | Check desktop/tablet/mobile, keyboard navigation, focus visibility, labels, empty/loading/error states and readable data tables |
| External integrations | Use test credentials and provider-confirmed delivery; never display “connected” based only on a saved configuration |

## 9. Complete role menu appendix

The detailed destination appendix is recorded in `docs/PHASE_1_ROLE_MENU_INVENTORY.md`. It lists all 430 submenu labels, declared group roles, individual role allow-lists, dashboard role exclusions, and explicit unavailable route families. It computes source-level menu visibility for each role: Owner 430; Administrator 430; Teacher/employee 202; Student 144; Parent/guardian 139; Accountant 132; Examination Officer 89. These are navigation visibility counts, not counts of working features. Every route still needs exact resolver execution and workflow acceptance.

## 10. Phase 1 disposition

**Static source and route audit: documented.** The 33-group catalogue, seven-role filtering approach, route dispatch, explicit unavailable destinations, core workspace inventory and known cloud risks have been recorded.

**Still pending:** real authenticated browser checks for all seven roles; a click-through check of every role-visible destination; reproduction and correction of the student RLS insert issue; module-by-module CRUD/relationship/negative-permission tests; and confirmation of each third-party dependency.

Phase 2 has proceeded with a presentation-only shared design layer while these functional audit items remain visible as separate release gates. GitHub Actions run `42875451852` passed the refreshed source verifier, the user-error/finance/private-file tests, the production build and Cloudflare asset packaging. Design completion must not be confused with workflow or security completion.
