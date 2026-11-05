# EduSphere 360 — Development Starter

A responsive education-management web application starter for schools, colleges and universities. It supports:

- **Offline/local mode:** local accounts and records stored in the browser using IndexedDB (Dexie).
- **Online/cloud mode:** Supabase Auth, PostgreSQL, Row Level Security, Edge Functions and private Storage.
- **Website hosting:** Cloudflare Pages (Vite build output: `dist`).
- **UI design workflow:** Penpot design specification in `docs/PENPOT_DESIGN_BRIEF.md`.

> This is a functional development starter, not a finished school ERP. The current build includes institution setup, role-based sign-in, admin-created and listed accounts, CRUD screens for student/faculty/attendance/exams/exam results/fees/assignments/timetable/announcements, and cloud/local file upload. More advanced workflows (marks per student, payment ledger/receipts, assignment submissions, semester/credit-hour engine, HR/payroll, transport/hostel, notification delivery, audit reporting and offline-to-cloud sync) are planned follow-on modules.

## 1. Requirements

- Windows 10/11
- Node.js 22.12+ (or Node 20.19+)
- VS Code
- An internet connection for the first dependency installation and cloud configuration
- Optional: a free Supabase project and GitHub account for online hosting

Vite's current guide lists Node.js 20.19+ or 22.12+ for supported releases. Check `node --version` before starting.

## 2. Run locally on Windows

1. Extract this project folder.
2. Open the folder in VS Code (`File → Open Folder`).
3. Open `Terminal → New Terminal`.
4. Install dependencies:

   ```powershell
   npm install
   ```

5. Start the local development website:

   ```powershell
   npm run dev
   ```

6. Open `http://localhost:5173` in Chrome or Edge.
7. Keep the terminal running while you use the site.
8. Select **Offline** mode and choose **Create your institution** to create the first local owner account.

### Offline use after initial installation

Once `npm install` has completed, the local app can run without an internet connection:

```powershell
npm run dev
```

The offline database and uploaded files are stored in this browser's IndexedDB (not encrypted at rest). Use the same browser profile and same local origin to see the saved records again. This mode is for local demonstration and development, not sensitive production records. `localhost` and `127.0.0.1` are different browser origins, so choose one and keep using it.

For a locally built static version:

```powershell
npm run build
npm run preview
```

Then open the local address shown in the terminal (usually `http://localhost:4173`).

**Offline limitation:** local and cloud records are separate at this stage. There is no automatic two-way synchronization yet. Do not enter real personal or student data into the local demo unless the device and browser profile are protected.

## 3. Design in Penpot

Open `docs/PENPOT_DESIGN_BRIEF.md` and build the components/artboards there. The current frontend uses a navy/blue and white interface as an initial design direction. Penpot is the design source; React/CSS is the working website implementation. Design changes in Penpot do not automatically change website code; export assets or implement the agreed design changes in `src/`.

## 4. Set up Supabase online mode

### A. Create a project

1. Go to <https://supabase.com/> and create a project in your own account.
2. Open **SQL Editor**.
3. Paste and run `supabase/migrations/001_initial_schema.sql`.
4. Open **Project Settings → API** (or the Connect panel) and copy:
   - Project URL
   - Publishable key (or legacy anon key if that is what your project shows)
5. Copy `.env.example` to `.env.local` in the project root and enter the values:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
   VITE_DEFAULT_MODE=cloud
   ```

6. Restart `npm run dev` after changing environment variables.

Only the publishable/anon key belongs in `VITE_` browser variables. **Never place a Supabase secret key, service-role key, database password or bootstrap secret in `.env.local`, frontend code, GitHub or Cloudflare Pages variables.**

### B. Deploy the secure account functions

The first owner is created by a server-side Edge Function. The one-time bootstrap secret must be set in Supabase, not hard-coded in the browser.

1. Install the Supabase CLI following <https://supabase.com/docs/guides/cli>.
2. In the project terminal:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Create a long random secret (at least 32 random characters). Store it safely in a password manager.
4. Set the secret in the Supabase project:

   ```powershell
   supabase secrets set EDU_BOOTSTRAP_SECRET=YOUR_LONG_RANDOM_SECRET
   ```

5. Deploy both functions:

   ```powershell
   supabase functions deploy bootstrap-admin --no-verify-jwt
   supabase functions deploy create-user
   ```

6. In the website, choose **Online** mode → **Create your institution**. Enter the same one-time setup secret. The first institution owner is created. After the first institution exists, the function refuses any further bootstrap attempts.
7. Sign in as the owner. Open **User accounts** to create teacher, student, parent, accountant and examination-officer accounts.

The `create-user` function verifies that the caller is an active owner/admin in the same institution before creating any account. The browser cannot assign itself a role. It uses Supabase's server-side admin API, and the secret key remains inside the Edge Function environment.

If you need to reset a test project, do it from the Supabase dashboard only after exporting/backing up any records. Do not expose a public reset function.

### C. Configure authentication URLs

In Supabase **Authentication → URL Configuration**, add your local development URL (for example `http://localhost:5173`) to the allowed redirect/site URLs. After publishing, add your Cloudflare Pages URL too.

## 5. Publish online with Cloudflare Pages

1. Create a private GitHub repository in your own GitHub account.
2. From this project folder, run:

   ```powershell
   git init
   git add .
   git commit -m "Initial EduSphere 360 development starter"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
   git push -u origin main
   ```

3. In Cloudflare Dashboard, open **Workers & Pages → Create → Pages → Connect to Git** and select the repository.
4. Set the build configuration:
   - Framework preset: **Vite** (or React/Vite)
   - Build command: `npm run build`
   - Build output directory: `dist`
5. Add these Pages environment variables for production (and preview if you use previews):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_DEFAULT_MODE=cloud`
6. Deploy. Cloudflare provides a `*.pages.dev` address; no purchased domain is required for the first release.
7. Add the exact Pages URL to Supabase Authentication URL Configuration.

Build command and output directory are the standard Cloudflare Pages configuration for React (Vite): `npm run build` and `dist`.

## 6. How the connected account model works

- First-time setup: one owner account creates the institution.
- After that: public administrator registration is blocked by the server function.
- Owner/admin: creates teacher, student, parent, accountant and examination-officer accounts. Only the owner can appoint another administrator.
- Teacher/student/parent/accountant/exam officer: signs in through the matching portal. Portal choice is checked against the actual database role.
- Parent/student linking: create the student record first; when creating a student or parent account, select the related student record. The cloud function links the account to that student. The first build links one learner per parent account; multi-child parent dashboards are a next-step feature.
- Online data: all users access the institution's shared database, but PostgreSQL Row Level Security checks which records each role may access. Student and parent reads are restricted to the linked learner and matching class where the starter has class-level data.

## 7. Security and production checklist

Before real institutional use:

- Review and test every Row Level Security policy with test accounts for every role.
- Enforce MFA for owners/admins where supported; use strong passwords and secure recovery procedures.
- Configure email confirmation/password reset and institutional email delivery.
- Add audit logs for important changes.
- Add explicit file-type, file-size and malware-scanning policy for uploads.
- Use verified payment gateway webhooks; do not treat a manually edited paid amount as proof of payment.
- Add proper exam results/marks tables and approval/publishing workflow.
- Add backups and test restore procedures.
- Complete privacy, consent, retention and local legal requirements before using real student information.
- Run `npm run build` and perform manual role-by-role testing before public release.

## 8. Useful commands

```powershell
npm run dev       # local development server
npm run typecheck # TypeScript check
npm run build     # production build to dist/
npm run preview   # preview production build locally
```

## 9. Current module scope

| Area | Included in this starter | Next development work |
|---|---|---|
| Welcome and login | Welcome page, portal-specific login, first owner setup | Password reset and email invitation flow |
| Accounts | Admin creates role accounts; student/parent link support | Account list, suspend/reactivate, audit trail |
| Students | Create/read/update/delete student profiles | Admission review, documents, guardian multiple links |
| Faculty | Faculty and staff record management | HR, leave, payroll, workload |
| Attendance | Daily attendance CRUD | Class roster picker, monthly summaries, attendance alerts |
| Exams | Exam schedule CRUD | Per-student marks, grading scales, results and report cards |
| Fees | Invoice CRUD and paid/partial status | Payment ledger, receipts, discounts, scholarships, gateway |
| Assignments | Assignment CRUD | Submissions, file attachments, feedback and grading |
| Timetable | Timetable entry CRUD | Conflict checks, auto-generation, rooms and calendars |
| Announcements | Institution announcements | Email, SMS, push and in-app notification centre |
| Files | Private cloud bucket and local IndexedDB upload/list/download/delete | Previews, virus scanning, file retention rules |
| Offline | Local IndexedDB accounts and records | Safe two-way sync with conflict resolution |
| College/university | Institution type and generic program/class fields | Departments, semesters, credit hours, GPA, transcripts |

## 10. Official documentation

- Vite: <https://vite.dev/guide/>
- Supabase React/Auth: <https://supabase.com/docs/guides/auth/quickstarts/react>
- Supabase Row Level Security: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase Storage policies: <https://supabase.com/docs/guides/storage/security/access-control>
- Supabase Edge Function secrets: <https://supabase.com/docs/guides/functions/secrets>
- Cloudflare Pages build configuration: <https://developers.cloudflare.com/pages/configuration/build-configuration/>
