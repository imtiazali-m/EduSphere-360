# EduSphere 360 — Supabase live integration

Project: `edusphere360-dev`  
Project reference: `osqhgsqrqhollxxtwrgy`  
API URL: `https://osqhgsqrqhollxxtwrgy.supabase.co`

## What has been applied to the live project

The live database was inspected before changes. Existing institution, membership, profile, teacher and other records were preserved. The following five migrations were applied successfully through the connected Supabase project integration:

| Remote version | Purpose |
|---|---|
| `20261108032753` | Student photo path, assignment submissions, assignment/exam metadata, attendance and exam guards, fee compatibility and payment RPC, timetable overlap protection |
| `20261108032948` | Administration compatibility: department/session/subject aliases, programs/classes/rooms tables and owner/admin RLS |
| `20261108033003` | Bidirectional synchronization of Administration legacy and app-facing field aliases |
| `20261108033129` | Fix for table-specific academic tenant-reference trigger logic |
| `20261108033232` | Fee balance corrected to include fine and discount; invoice student snapshot validation |

The matching timestamped SQL files in `supabase/migrations/` are the local records for those already-applied remote migrations. Do not rename them or apply them a second time.

## Docker note

Docker is **not required** to apply the migrations above; they are already applied remotely. The earlier `supabase db pull --remote` operation failed because the Windows machine has no Docker/Podman runtime. `db pull` is a separate schema-dump workflow that uses a shadow database. Do not repeat it just to deploy the five migrations listed above.

## Verify local/remote migration history

From the folder containing `package.json`, run:

```powershell
npx.cmd supabase migration list --remote
```

The five timestamps above should appear in both the Local and Remote columns. If they do, migration history is synchronized for these five changes.

Do **not** run `npx.cmd supabase db push` as a troubleshooting step. These five changes have already been applied to the remote project; the list command is the verification step.

## Verify the application locally

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Then run the local Vite server:

```powershell
npm.cmd run dev
```

Open the URL printed by Vite. Keep the existing `.env.local` file; it is intentionally excluded from the ZIP. `.env.example` contains only the project URL and a placeholder for the public publishable key. Never put a Supabase service-role or secret key in a `VITE_` variable.

## Live database test result

A rollback-only integration test was run against the live schema using temporary rows inside a transaction that ended with `ROLLBACK`. It tested Administration references and aliases, assignment submission validation, exam result relationships, attendance snapshots and duplicate rejection, timetable overlap rejection, fee invoice balance calculation, fee payment receipt aliases and the payment RPC. The test passed. Follow-up counts confirmed no test rows remained; the four existing institutions, four memberships, four profiles and one teacher were unchanged.

This database test does not replace a browser/localhost test or the frontend production build. Neither the full npm build nor Cloudflare deployment is claimed as completed here.
