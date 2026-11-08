# EduSphere 360 — Online-only application source

EduSphere 360 is an online education-management application for schools, colleges and universities.

## Production architecture

- **Frontend hosting:** Cloudflare Pages (Direct Upload deployment of the freshly built `dist/` folder).
- **Backend:** the existing Supabase project `edusphere360-dev` (`osqhgsqrqhollxxtwrgy`).
- **Authentication:** Supabase Auth with active institution membership and role validation.
- **Data:** Supabase PostgreSQL with Row Level Security.
- **Files and photographs:** private Supabase Storage bucket `institution-files`.
- **Runtime mode:** online only. No local account mode, IndexedDB database, offline records or offline synchronization is included in the active application.

## Important deployment distinction

This archive is a **source package**, not a Cloudflare Direct Upload package. Cloudflare Direct Upload must receive a freshly built static asset directory (Vite `dist/`), not TypeScript/React source files. The `CLOUDFLARE_UPLOAD_THIS_FOLDER` assets from the original archive were stale and have deliberately been excluded from this source package. Do not upload this source ZIP directly to Pages.

A deployable Pages archive can only be produced after dependencies are installed and the current source successfully passes `npm run build`.

## Build configuration

Build command: `npm run build`

Build output directory: `dist`

Use Node.js 22.12+ (or another version supported by the selected Vite release).

Required build-time public environment variables:

```env
VITE_SUPABASE_URL=https://osqhgsqrqhollxxtwrgy.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Only the Supabase publishable key belongs in the browser build. Never expose a Supabase secret key, service-role key, database password or private server secret in frontend code or build-time `VITE_` variables.

## Online application behaviour

- Authentication and membership context are restored from Supabase Auth.
- Application records are read and written through Supabase.
- Generic record writes verify the authenticated user, active institution membership and matching role before issuing a database write.
- Fee payments use the atomic `record_fee_payment` database RPC.
- Institution files and student photographs use the private `institution-files` Storage bucket.
- When the browser reports no network connection, the application displays an internet-required screen; local records are not used as a fallback.

## Database safety

The connected Supabase project was inspected read-only during Stage 1 and reported active/healthy. Its remote migration history contained six entries. The local repository contains additional historical SQL files; do not blindly replay them or push all migrations. Reconcile the schema baseline and migration lineage before any schema deployment.

## Stage 1 verification boundary

The repository verification script passed its source/configuration checks and parsed all active TypeScript/TSX files. This is not a full TypeScript typecheck, Vite production build, live browser test, student insert test, payment test or Cloudflare deployment confirmation. See `STAGE1_SOURCE_CHANGE_REPORT.md` for exact results and limitations.

## Stage 4 QA status (8 November 2026)

Stage 4 added safe user-facing error handling, linked-record lookup recovery in Administration, and consistent invoice balance calculations. Run the source checks with:

```bash
npm run test:user-errors
npm run test:finance
npm run test:file-access
npm run verify:project
```

The source checks pass in the QA workspace. The full production build is still blocked in that workspace because the npm registry cannot resolve and required React/Babel/Estree type packages are absent. No fresh `dist/` bundle, browser E2E sign-off or Cloudflare deployment exists yet. See `STAGE4_FINAL_QA_REPORT.md` and `STAGE4_CHANGE_MANIFEST.md`. Do not upload the source ZIP to Cloudflare Pages.


## Final rebuild stage — GitHub-hosted clean build

The repository now includes `.github/workflows/cloudflare-pages-release.yml`. Pushes and pull requests run the project verifier, the user-error/finance/file-access tests and a fresh Vite production build on a GitHub-hosted Node.js 22 runner. Successful runs publish two downloadable artifacts: the `dist/` folder and a Direct Upload ZIP with `index.html`, `_redirects` and `assets/` at the archive root.

Production deployment is **manual only**: start the workflow from the configured production branch and set `deploy_production=true`. It then deploys the already-verified `dist/` folder with Wrangler. Normal pushes and pull requests never deploy production. Configure the GitHub repository variables/secrets described in `docs/GITHUB_CLOUDFLARE_RELEASE_SETUP.md`, and protect the `production` environment with required reviewers.

The workflow has been added to this source package but has not yet been committed to a repository or executed. The local workspace still cannot complete a fresh npm dependency installation, so `npm run build` remains blocked here by missing React/Babel/Estree type declarations. Do not label this source ZIP as a deployable Cloudflare artifact.

See `docs/FINAL_REBUILD_STAGE.md` for the launch acceptance gates and `docs/NAVIGATION_RECONCILIATION.md` for the verified active-menu counts and historical-source discrepancy.
