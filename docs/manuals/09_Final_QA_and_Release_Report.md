# EduSphere 360 — Final QA and Release Report (8 Nov 2026)

## Status: NOT RELEASED. Production deployment was not performed.

### Completed and verified (this session)
- Stage 5 source unpacked intact.
- `npm run verify:project` PASS; user-error tests 15/15; finance 7/7; file-access 16/16.
- Source grep: no localStorage/IndexedDB use in `src`.
- Source review: student-insert RLS fix present (016), attendance uniqueness and exam-result uniqueness (019), published-only result visibility (018), payment dialog caps amount at balance and blocks future dates.
- Manuals 01–08 written from the implemented modules.

### Completed but not independently verified
- RLS behaviour against the live database; institution isolation; per-role access.
- Payment/receipt flow, attendance and result workflows end to end.

### Blocked
- **Dependency install / `tsc` / `vite build` / `dist/`:** shell network access is off for this account.
- **Cloudflare deployment, URL smoke test, rollback reference:** no Cloudflare connection or credentials.
- **Live-site and live-source comparison:** no GitHub repository linked and no live URL provided, so the "reconcile with live" step was not done. The Stage 5 ZIP was not treated as overriding anything.
- **Supabase connectivity and test-account checks:** no Supabase connection.
- **Browser E2E / responsive inspection:** browser control not in plan.

### Stage 6 additions (branch feature/stage6-reports-fines-profile)
- Fine field on invoices (column already exists in the live schema; no database change).
- Reports page with CSV export (owner, admin, accountant, exam officer) and My Profile (student, parent).
- GitHub build, verifier and all test suites passed for this branch. Not tested in a browser or against live Supabase.
- Proposed, unapplied SQL in `supabase/proposed/`: faculty attendance table and a `leave` attendance status.

### Not implemented (found in review)
- Faculty attendance register; "Leave" status (the app has "Excused").
- Fines field on invoices (discount only).
- Dedicated report/export pages; parent notification centre; student profile page.
- Navigation exposes 19 destinations, not the larger earlier-reported count.

### Known limitations
Manuals describe current behaviour only. Teacher per-class restriction is unverified.

### Next step
Link GitHub (and give the live URL), then run the existing workflow for a real build, or enable package installs and start a new chat.
