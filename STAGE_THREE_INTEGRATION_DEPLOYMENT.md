# EduSphere 360 — Stage Three: Integration, QA and Deployment

This package combines the saved Phase One navigation work with Phase Two data workflows, authentication changes and database migrations. Stage Three adds a repeatable source check and a guarded Cloudflare Pages deployment script.

## 1. Preserve the working project

1. Extract this ZIP to a new folder.
2. Copy your existing `.env.local` into the new project folder. Do not upload it or commit it to Git.
3. Keep a backup of the previous project and database before applying any SQL changes.

## 2. Install and verify locally (Windows PowerShell)

Run these commands from the folder containing `package.json`:

```powershell
node --version
npm.cmd ci
npm.cmd run verify:project
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev
```

Open the exact `http://localhost:<port>` URL printed by Vite. Use the printed port if 5173 is already occupied.

`verify:project` checks the navigation catalogue, all seven role workspaces, module declarations, CRUD table allowlist, required migrations, SPA fallback and absence of packaged secrets. It does not replace TypeScript compilation, browser testing or a live database test.

## 3. Prepare the Supabase backend

Use the same Supabase project referenced by `VITE_SUPABASE_URL`. Do not link or push to a different project accidentally.

### Migration order

For a **fresh database**, apply all migrations in this order:

1. `001_initial_schema.sql`
2. `002_student_photo_path.sql`
3. `008_assignment_management_upgrade.sql`
4. `009_work_management.sql`
5. `014_fee_payments_transactions.sql`
6. `015_administration_setup.sql`
7. `016_student_write_policy_refresh.sql`
8. `017_public_institution_signup.sql`
9. `018_assessment_metadata_and_result_visibility.sql`
10. `019_phase_two_integrity_guards.sql`
11. `020_fee_payment_date_validation.sql`

For an existing database, first establish which migrations have already been applied. Do not blindly replay an already-applied migration. Migration 019 deliberately stops if the existing database contains duplicate attendance or examination results that would violate the new uniqueness rules; resolve those records before retrying. Never disable RLS to get a write through.

If Supabase CLI migration history is already synchronized, review `supabase migration list --remote` and `supabase db push --dry-run --remote` before applying pending migrations with `supabase db push --remote`. If the database was updated manually through SQL Editor, reconcile its migration history first; do not use `db push` until the dry run shows only the intended changes.

Deploy the two Edge Functions after linking/authenticating the Supabase CLI:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy bootstrap-admin --no-verify-jwt
supabase functions deploy create-user
```

`EDU_BOOTSTRAP_SECRET` must be set as a Supabase Function secret for the first institution setup flow. Never put it, a database password or a service-role key in any `VITE_` browser variable.

## 4. Prepare Cloudflare Pages

Recommended Pages settings for the Vite app:

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/` (the folder containing this `package.json`)
- Production environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_DEFAULT_MODE=cloud`

For Git-integrated Pages, configure the variables in Cloudflare Pages settings and connect the repository. For a local Direct Upload, create an ignored `.env.production` containing the three variables above, sign in to Wrangler, and run:

```powershell
.\DEPLOY_PHASE3.ps1 -ProjectName YOUR_EXISTING_CLOUDFLARE_PAGES_PROJECT
```

The script checks that both Vite and TypeScript are actually installed (not merely that a `node_modules` folder exists), runs the source checks, builds the site and only then uploads `dist`. It does not create a Pages project or apply database migrations. Confirm the Pages project name and production branch before running it. The script defaults to branch `main`; change its deploy command to your configured production branch if yours is named differently. For a project that is not yet created, create it in Cloudflare first. Cloudflare's Direct Upload and Git integration are different project setup choices; choose the intended deployment workflow before creating the Pages project.

## 5. Connect the live website to Supabase Auth

After Cloudflare provides the production URL:

1. In Supabase Authentication URL Configuration, set the production Site URL to the real deployed URL.
2. Add the production URL and required auth callback/redirect URLs to the allowed redirect list.
3. Ensure email confirmation and the intended email provider settings are enabled.
4. Confirm the Cloudflare production environment variables point to the same Supabase project where migrations and Edge Functions were deployed.

## 6. Required live smoke tests

Use test accounts and test records only:

- Owner registration, email verification, login, logout and session restoration.
- Owner versus administrator access; teacher, student, parent, accountant and examination-officer navigation.
- Create, edit, delete and refresh-persistence checks for students, faculty, attendance, exams/results, fee invoices/payments, assignments/submissions, timetable, announcements and Administration catalogue records.
- Student/parent isolation: a linked account cannot read another learner's records, and unpublished results remain hidden.
- Fee payment receipt and invoice balance consistency.
- Duplicate attendance/result and timetable collision rejection.
- Private file upload and signed download.
- Browser refresh, mobile-width layout and console/network errors.

## 7. What is not claimed as complete

This stage has not been deployed to your Cloudflare account and has not run migrations against your Supabase project. Those actions require an authenticated deployment session and verification against the exact target project. The code currently exposes 22 groups / 122 navigation sections, while the dedicated operational CRUD workflows cover the configured modules and administration tables in Phase Two; some catalog sections still display a navigation workspace and are not yet independent production workflows. Do not enter real institutional data until the role/RLS, privacy, backup and recovery tests are completed.
