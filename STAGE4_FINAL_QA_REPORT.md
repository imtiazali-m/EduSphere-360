# EduSphere 360 — Stage 4 Final QA Report

**Date:** 8 November 2026 (Pakistan time)  
**Scope:** Latest available online-only source package, including Stage 3 premium visual refinement and Stage 4 source fixes  
**Supabase project:** `edusphere360-dev` (`osqhgsqrqhollxxtwrgy`)

## 1. Release decision

| Gate | Result | Evidence |
|---|---|---|
| Source/static verification | **PASS** | `npm run verify:project`; all configured checks pass |
| User-facing error tests | **PASS** | 15 focused cases pass |
| Finance calculation tests | **PASS** | 7 focused cases pass |
| TypeScript syntax parsing | **PASS** | 20 active `.ts` / `.tsx` files parsed without syntax diagnostics |
| Strict helper type-check | **PASS (limited)** | `userErrors.ts` and `finance.ts` type-check in isolation |
| Relative imports | **PASS** | 56 relative imports checked; 0 missing |
| Premium stylesheet parse | **PASS** | 448 top-level rules; 0 CSS parser errors |
| Full project TypeScript/Vite build | **BLOCKED** | Missing type packages in incomplete `node_modules` |
| Authenticated browser / E2E QA | **NOT RUN** | No authenticated browser session available in this workspace |
| Responsive visual inspection | **NOT RUN** | Static CSS checks only; desktop/tablet/phone screenshots not inspected in a browser |
| Cloudflare deployment | **NOT PERFORMED** | No fresh `dist/` bundle exists |

**This is a source-level QA pass, not a production-release certificate. Do not upload this source ZIP to Cloudflare Pages.**

## 2. Stage 4 source fixes

### Safe user-facing errors

- Centralised provider-error translation in `src/lib/userErrors.ts`.
- Wired safe messages into record operations, authentication screens, account management, file operations, dashboards and Administration.
- Removed provider/database detail from the owner registration recovery message.
- Administration load, save, delete and related-record lookup failures now use safe messages. Failed linked dropdown lookups are shown to the user, and the Refresh records control retries them.
- Added regression checks for RLS/permission errors, duplicate and foreign-key constraints, invalid input, expired sessions, server errors, network interruptions, unsupported uploads and oversized uploads.

### Finance calculation consistency

- The live `fee_invoices.balance` field is a generated stored column. It recalculates from invoice amount + fines − discounts − paid amount when the invoice is updated.
- The earlier concern that the database balance was stale was incorrect; the database-generated value is working as designed.
- The actual UI issue was that the dashboard's outstanding-fee calculation did not include fines and did not consistently use the generated balance.
- Added `src/lib/finance.ts` and used the shared helpers in the dashboard and fee workspace. The helper prefers the generated `balance` value and uses the matching formula as a fallback.

### Module / storage safeguards

- Removed the unfinished generic Parents & Guardians module from the active generic CRUD registry. The underlying guardian tables exist, but `parent_guardians` is not in the generic CRUD table allowlist; the dedicated family/guardian workflow remains deferred rather than pretending this generic module is complete.
- Strengthened the project verifier so an active generic module cannot reference a table outside the approved data allowlist.
- File UI validation follows the private `institution-files` bucket's 10 MB limit and supported MIME types. The visible file workspace is limited to owner/admin in the current navigation; storage itself also permits teacher uploads, but no teacher Files destination is currently published.
- Added focused test scripts for error translation and finance calculations.

## 3. Source verification results

`node scripts/verify-project.mjs` passed. It verifies:

- Online-only authentication and data access; no local database or local sign-in fallback.
- Owner registration fields and role-specific sign-in paths.
- Role-aware menu filtering and route resolution for every currently published destination.
- Module/table allowlist integrity.
- Private file storage wiring and client-side size/type restrictions.
- Safe user-facing error handling, including Administration and dashboard failures.
- Required project files, environment placeholders and Cloudflare SPA redirect.
- Syntax parsing of all 20 active TypeScript/TSX files.

Current route totals in this selected source:

| Role | Menu groups | Destinations |
|---|---:|---:|
| Owner | 13 | 19 |
| Administrator | 13 | 19 |
| Teacher | 8 | 9 |
| Student | 7 | 7 |
| Parent | 7 | 6 |
| Accountant | 3 | 2 |
| Examination Officer | 4 | 4 |

The current source contains 11 configured data modules. It does not contain the 33 groups and role destination counts (425 / 244 / 139 / 128 / 152 / 156) stated in the Stage 2 progress report.

### Navigation/source discrepancy — unresolved

The current, selected online-only source verifies 13 groups and 19 Owner destinations. An older Stage 3 / Phase Two archive contains a larger navigation version, but it also reintroduces older local/offline implementation pieces and is not a safe drop-in replacement for the online-only source. The reported 33-group / 425-destination catalogue and 410 new destinations could not be reproduced from the source archives available for this QA pass.

Do not merge the older archive wholesale. The exact Stage 2 working source that contains the 33/425 catalogue is required to reconcile and preserve that navigation version safely.

## 4. Build blocker

The production command was run:

```text
npm run build
```

It stops at `tsc -b` with `TS2688` because the working `node_modules` folder has incomplete/missing type packages, including:

- `babel__core`
- `babel__generator`
- `babel__template`
- `babel__traverse`
- `estree`
- `react`
- `react-dom`

The current environment has only one file in `node_modules` (approximately 576 KB) and the npm cache contains zero cached package content. DNS lookup for `registry.npmjs.org` fails; an HTTPS request returned `curl: (6) Could not resolve host: registry.npmjs.org`.

Therefore Vite did not run, no fresh `dist/` was generated, and a Cloudflare Direct Upload ZIP does not exist. The source ZIP is deliberately not presented as deployable output.

**Next build gate:** in a network-enabled environment, from the project root, run `npm.cmd ci`, then `npm.cmd run build`. Only after a successful build should the contents of `dist/` be packaged for Cloudflare Pages.

## 5. Supabase read-only review

- Project status: `ACTIVE_HEALTHY`; PostgreSQL 17.11.
- Public tables: 36; RLS enabled on 36/36.
- `institution-files` is private, with a 10 MB limit and PDF, PNG, JPEG, WebP, TXT, Word and Excel MIME restrictions.
- Storage read policy is institution-member scoped; upload policy permits owner/admin/teacher; delete policy permits owner/admin.
- `create-user` Edge Function is active at version 7 with JWT verification enabled. It checks the signed-in caller's active membership in the target institution, restricts account creation to owner/admin, prevents an administrator appointing another administrator, and validates linked student records against the institution.
- `bootstrap-admin` is active at version 8 with JWT verification disabled but guarded by the one-time bootstrap secret and claim flow. It was not invoked or changed.
- The six-argument `record_fee_payment` RPC is the active frontend path. A legacy seven-argument overload remains callable and has weaker validation checks; its removal or permission change requires a compatibility review before any database change.
- Local source has 17 SQL migration files; the remote migration history has 6 entries. This is migration lineage drift. No migration was replayed or applied during Stage 4.
- No Supabase DDL, RLS policy, function grant, account, institution record, payment, storage object or user data was modified during this QA pass.

### Database integrity checks observed

- Unique indexes exist for one attendance row per student/day, one result per student/exam, one submission per assignment/student and institution-scoped invoice number.
- No duplicate-key groups were returned for attendance, exam results, assignment submissions or invoice numbers in the current data.
- Server-side triggers validate same-institution relationships for attendance, exam results, fee invoices and assignment submissions; timetable overlap checks include an advisory transaction lock.
- These were read-only inspections. They do not replace positive and negative tests through authenticated application sessions.

### Advisor findings retained for controlled review

- 7 callable `SECURITY DEFINER` function warnings, including role/student/class helpers and both fee-payment overloads.
- Leaked-password protection is disabled in Supabase Auth.
- 56 unindexed foreign keys, 2 RLS initialization-plan warnings, 12 unused-index notices and a duplicate/permissive `fee_payments` SELECT-policy notice.
- `platform_setup_control` has RLS enabled with no policies, and authenticated users have no table privileges; it remains inaccessible to normal client roles.

No grants, RLS policies, indexes or function definitions were changed blindly to silence advisor notices.

## 6. Release tests still required

The following require a successful production build and authenticated browser sessions:

1. Owner registration, cross-device email verification, owner login and session restoration.
2. Owner/admin/teacher/student/parent/accountant/examination-officer route and denied-action checks.
3. Student creation, photo upload, refresh persistence, edit and delete.
4. Attendance create/update, duplicate-day rejection and class/date filtering.
5. Exam creation, result entry, publication visibility and result history.
6. Fee invoice creation, partial/full payments through the six-argument RPC, generated balance, receipt history and refund workflow where enabled.
7. Assignment submission, grading permissions and class-boundary checks.
8. File upload/download/delete using a real authenticated session.
9. Cross-institution read/write denial using two test institutions.
10. Desktop, tablet and phone viewport checks, keyboard access, reduced motion and production smoke/rollback verification.

## 7. Overall status

| Stage | Current evidence-based status |
|---|---|
| Stage 1 — source and online foundation | Source prepared; fresh production build still blocked |
| Stage 2 — navigation and workspace architecture | Selected source has routed role workspaces, but the reported 33/425 catalogue is not present in the available source |
| Stage 3 — cloud integration and premium design | Source-level integration and premium CSS are present; visual browser regression tests remain pending |
| Stage 4 — QA and release readiness | Static/source QA passes with fixes; full build, authenticated E2E and deployment remain blocked |

**No production deployment was made. No database migration or live-data change was made.**
