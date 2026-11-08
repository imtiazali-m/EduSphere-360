# EduSphere 360 — Stage 1 source and deployment foundation report

Date: 8 November 2026

## Selected source baseline

- `EduSphere360_Finance_Receivables_Update(1).zip` is the selected source baseline.
- Finance ZIP copies `(1)` and `(2)` are byte-identical.
- Compared with `EduSphere360_Latest_Source(1).zip`, the finance source differs in `src/components/RecordModule.tsx`.
- The Product Fix Patch files compared during inspection match the corresponding files already present in the Finance ZIP.
- The older Supabase Integrated ZIP was not overlaid because doing so would replace newer source components and risk regressions.

## Stage 1 changes applied

1. Enforced a fixed cloud-only `AppMode` in the active application.
2. Removed local account creation, local sign-in, browser-local session handling and local-mode restoration from `AuthContext`.
3. Removed local CRUD and local fee-payment paths from the data layer; cloud writes continue to validate the Supabase user and active institution membership.
4. Reworked institution file operations to use Supabase Storage only.
5. Kept student photograph upload and retrieval in Supabase Storage only.
6. Removed the active Dexie/IndexedDB local database implementation and the unused Dexie dependency from `package.json` and `package-lock.json`.
7. Updated authentication/privacy wording to describe online-only operation.
8. Added an internet-connection required screen using the browser network state.
9. Updated the project verification script for the online-only architecture.
10. Preserved the existing Finance/Receivables `RecordModule.tsx` update.

## Source verification

`node scripts/verify-project.mjs` passed:

- Vite scripts and project files present.
- Navigation destinations and routes validated.
- Seven role workspaces validated.
- Owner registration and role-specific login source checks passed.
- Online-only source checks passed.
- Module definitions and CRUD allowlist checked.
- Database safeguards and Cloudflare SPA redirect checked.
- 18 active TypeScript/TSX files parsed without syntax diagnostics.

The source currently has 12 configured data modules. The full 29-area master specification remains future implementation work and is not represented as complete by this Stage 1 report.

## Supabase read-only checks

The connected project was reported as `ACTIVE_HEALTHY`. The remote migration history contained six entries. No database schema, migration history, policies, user records or storage objects were modified during Stage 1.

## Build and deployment blocker

The npm registry could not be reached reliably in this execution environment. `npm ci --offline` failed because required packages were not cached, and online dependency installation timed out. Therefore:

- Full TypeScript typecheck: not completed.
- Vite production build: not completed.
- Fresh `dist/` directory: not generated.
- Cloudflare Direct Upload ZIP: not generated.
- Live deployment: not performed.

The original `CLOUDFLARE_UPLOAD_THIS_FOLDER` bundle was stale relative to the Finance source and is intentionally not included in this package as a deployable asset set.

## Safe next action

Install dependencies in a reachable build environment, run `npm run build`, verify the output in `dist/`, then create one ZIP containing the contents of `dist/` (including `index.html`, `_redirects` and `assets/`) for the user's existing Cloudflare Pages Direct Upload process. Set the two public Supabase build variables at build time. Do not replay database migrations without reconciliation.
