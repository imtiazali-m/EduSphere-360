# EduSphere 360 — Stage 5 Final Rebuild Report

**Prepared:** 8 November 2026 (Pakistan time)  
**Stage status:** Release automation prepared; production launch blocked pending repository execution and successful build

## What Stage 5 adds

- GitHub Actions workflow for clean Node.js 22 dependency installation, source verification, focused test suites and production build.
- Automatic creation of a `dist/` build artifact and a separate Cloudflare Direct Upload ZIP with site files at the archive root.
- Manual-only Cloudflare production deployment through Wrangler; a workflow dispatch input and configured production branch are required.
- No deployment on ordinary pushes or pull requests.
- Release documentation for GitHub variables/secrets and an approval-protected `production` environment.
- Navigation source reconciliation so the previously reported counts are no longer confused with counts verified in an available source archive.
- Corrected the migration README from five to six timestamped 20261108 migrations, matching the six entries observed in the linked production migration history.

## Current source checks

| Check | Result |
|---|---|
| Project verifier | PASS |
| TypeScript/TSX syntax parse | 21 files parsed; PASS |
| User-facing error tests | 15/15 PASS |
| Finance calculation tests | 7/7 PASS |
| File permission tests | 16/16 PASS |
| Navigation route check | PASS for current active catalogue |
| Release workflow structural check | PASS |
| Workflow YAML syntax parse | PASS (PyYAML accepted the file; GitHub-specific schema validation still requires a workflow run) |
| Production Vite build in this workspace | BLOCKED |
| Browser E2E / visual regression | NOT RUN |
| GitHub workflow run | NOT RUN |
| Cloudflare deployment | NOT PERFORMED |

## Build blocker reproduced

`npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=1 --fetch-timeout=20000` timed out in this workspace. The subsequent `npm run build` stops in `tsc -b` because type definitions for `react`, `react-dom`, `babel__core`, `babel__generator`, `babel__template`, `babel__traverse` and `estree` are missing from the partial dependency directory. No valid `dist/` output was generated.

The new GitHub-hosted workflow is intended to perform a clean install and build in a connected runner. It has been prepared in the source package but not pushed to or executed by the connected repository in this session.

## Navigation source decision

The selected online-only source has 13 active owner/admin groups and 19 active destinations. The older integrated archive verified 22 groups and 122 pages, but contains local/IndexedDB fallback and routes many unimplemented pages to a generic placeholder workspace. The 33-group/425-destination totals in an earlier report are not reproduced by any available source archive. The selected source therefore retains only real connected destinations until the exact Stage 2 source is recovered and its workflows are verified.

## Supabase and production data safety

The connected Supabase checks were read-only. The observed project has 36 public tables, all with RLS enabled; the private institution-files bucket and role policies were inspected. Six timestamped migrations match the live migration history. The remaining eleven numbered migration files are retained legacy material and must not be blindly replayed. No live database migration, policy, user, data or storage change was made during Stage 5 preparation.

## Final release gate

The release remains open until the workflow executes successfully, a fresh `dist/` bundle and root-level Direct Upload ZIP are produced, authenticated browser tests pass for all seven roles, desktop/tablet/mobile inspection passes, the correct Cloudflare deployment succeeds, and the production URL is smoke-tested with a recorded rollback reference.

**Do not upload this source ZIP to Cloudflare Pages.** The source package and the deployable Direct Upload ZIP are different artifacts; the latter can only be produced after the GitHub-hosted build succeeds.
