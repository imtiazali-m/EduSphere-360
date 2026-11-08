# EduSphere 360 — Technical and Deployment Manual
**Architecture:** React 19 + TypeScript + Vite 7; Supabase (Postgres, Auth, Storage, RLS); Cloudflare Pages hosting. Online-only: no localStorage/IndexedDB data fallback (checked by grep of src).
**Environment variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable key only; never the service-role key).
**Migrations:** six timestamped 20261108* migrations match live history. The eleven numbered files (001–020) are legacy reference; do not replay blindly. Do not reset or drop tables.
**RLS:** student insert uses `can_manage_students()` (owner/admin, active membership in the same institution) — migration 016. Result visibility: published only for students/parents (018). Attendance and exam-result uniqueness: 019.
**Storage:** private institution-files bucket; upload/delete rights by role (owner/admin both; teacher upload only).
**Edge functions:** `create-user`, `bootstrap-admin`.
**GitHub Actions:** `.github/workflows/cloudflare-pages-release.yml` runs `npm ci`, verifier, tests and `npm run build` on push/PR; production deployment only via manual workflow_dispatch with deploy_production=true and the protected `production` environment.
**Cloudflare Pages:** build `npm run build`, output `dist`, `public/_redirects` for SPA routing. Never upload the source ZIP.
**Rollback:** in Cloudflare Pages → Deployments, roll back to the previous production deployment; record its ID before releasing.
**Backup:** take a Supabase backup before any migration.
**Troubleshooting:** blank page → check env vars at build time; "permission denied" → check membership role/status; build failure → inspect `npm ci` logs.
