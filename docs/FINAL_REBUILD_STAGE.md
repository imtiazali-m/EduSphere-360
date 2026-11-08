# EduSphere 360 — Final Rebuild & Controlled Launch Stage

**Stage:** Final rebuild / release certification  
**Baseline:** Stage 4 online-only source, including premium visual refinement and QA fixes  
**Release posture:** Build-and-release automation prepared; production release not yet certified

## Objective

Finish the integrated product without replacing working cloud workflows with prototypes or exposing unfinished menu items as production features. The final stage must end with a reproducible build, evidence-backed acceptance tests, a verified Cloudflare deployment and a rollback reference.

## Selected baseline and preserved decisions

- Keep Supabase as the source of truth for signed-in application records and private files.
- Keep the online-only authentication/data path. Do not reintroduce browser-local accounts, IndexedDB, local CRUD or offline data claims.
- Preserve the Stage 3 premium navy/cobalt design refinement.
- Preserve the Stage 4 safe user-facing error handling, finance calculations and private-file role checks.
- Preserve the current route rule: only destinations with a real screen and permitted connected module appear in the active navigation.
- Do not replay numbered legacy migrations or edit production RLS, RPC grants, users or data as part of a frontend release.

## Verified baseline from the selected source archive

- 13 active menu groups and 19 routable destinations for owner/admin.
- Role-specific active routes: owner 13/19; administrator 13/19; teacher 8/9; student 7/7; parent 7/6; accountant 3/2; examination officer 4/4.
- 11 configured record modules, backed by an explicit generic CRUD table allowlist.
- 21 TypeScript/TSX files parse without syntax diagnostics using the project verifier.
- Focused tests: 15 user-facing error cases, 7 finance calculations, and 16 file-access permission checks.
- Private `institution-files` bucket policy is reflected in the UI: owner/admin/teacher upload; owner/admin delete; institution members read.

These checks are source-level and unit-style evidence. They do not prove the live authenticated workflows, actual browser layout or production build.

## Reconciliation of earlier navigation counts

The archived integrated navigation source contains 22 groups and 122 named pages. That archive also contains local/IndexedDB fallback code and routes many not-yet-implemented destinations to a generic “workspace available / workflow will be connected later” screen. It is therefore not a safe replacement for the current online-only source.

The earlier report's 33 groups and 425 owner/admin destinations are not reproduced by the available source archives. Do not advertise those totals as delivered or rebuild them by fabricating route names. Recover and compare the exact Stage 2 source/repository history before treating the 33/425 catalogue as authoritative.

## Connected cloud facts checked read-only

- Supabase reports 36 public tables and all 36 have RLS enabled.
- `institution-files` is private, with a 10 MB maximum object size and a MIME allowlist.
- Live storage policies authorize institution-member reads, owner/admin/teacher uploads, and owner/admin deletes.
- The live migration history contains six timestamped migrations, matching the six timestamped compatibility/signup files in the selected source. The other eleven numbered files are retained legacy material; do not run them blindly.
- The `create-user` Edge Function requires a valid session and checks active owner/admin membership in the target institution before creating accounts.
- No live migration, RLS policy, account, record or storage object was modified during this final-stage preparation.

## What is not complete yet

The full education ERP vision still exceeds the currently configured record modules. Payroll, HR/leave, asset/property lifecycle, transport, inventory, visitor management, full library circulation, curriculum/lesson planning, question banks/paper generation, certificates, messaging delivery, approvals, audit/backup and institution-wide reporting need their own data models, access rules, screens, validations, persistence and tests before they should appear as operational destinations.

Live end-to-end checks still required include owner signup/email confirmation/login, account invitations for each role, student admission/photo upload/refresh persistence, fee invoice/partial/full collection/receipt/refund, attendance, examination/result publication, assignment/submission/grading, file upload/download/delete and negative cross-institution access tests. Desktop/tablet/mobile visual inspection and production smoke/rollback checks are also outstanding.

## Automated release path prepared

`.github/workflows/cloudflare-pages-release.yml` now performs:

1. `npm ci` on a GitHub-hosted Node 22 runner.
2. Project verification and all three focused test suites.
3. `npm run build` to generate `dist/`.
4. A Cloudflare Direct Upload ZIP whose archive root contains `index.html`, `_redirects` and `assets/`.
5. A downloadable `dist` artifact and Direct Upload ZIP.
6. Optional production deployment only when a maintainer manually starts `workflow_dispatch`, sets `deploy_production=true`, and runs it from the configured production branch.

The workflow does not run Supabase migrations. Pull requests and ordinary pushes only verify/build; they do not deploy production.

## Required GitHub repository configuration

Repository variables:

- `VITE_SUPABASE_URL` — the existing project's public Supabase URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the Supabase publishable key (not a service-role key).
- `CLOUDFLARE_PAGES_PROJECT` — defaults to `edusphere360` if omitted.
- `EDUSPHERE_PRODUCTION_BRANCH` — defaults to `main` if omitted.

Repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`.
- `CLOUDFLARE_API_TOKEN` with the Cloudflare Pages deployment permissions required for the target account/project.

Protect the GitHub `production` environment with required reviewers before using the manual deploy option. Never place Supabase service-role keys, Edge Function secrets or Cloudflare tokens in Vite variables or source files.

## Release acceptance gate

The release is not complete until all of these are true:

- GitHub-hosted workflow completes cleanly, including a fresh clean install and Vite production build.
- The resulting Direct Upload ZIP is downloaded and inspected; it contains site assets at its archive root, not a nested `dist/` folder.
- Authenticated browser tests pass for all seven roles and critical workflows.
- Tenant-isolation and denied-action tests pass.
- Responsive, keyboard and accessibility checks pass.
- The manually approved Cloudflare deployment succeeds and the public production URL is smoke-tested.
- A previous known-good deployment/version and rollback procedure are recorded.

Until then, label the package **source / release candidate**, not a production-ready deployment.
