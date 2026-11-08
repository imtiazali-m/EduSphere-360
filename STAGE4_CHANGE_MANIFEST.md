# Stage 4 change manifest

The following changes are included in this source package:

- `src/lib/userErrors.ts` — shared safe error translation.
- `src/lib/finance.ts` — shared invoice balance and net amount calculations.
- `src/components/RecordModule.tsx` — shared finance helpers for fee balances, validation and display; safe save/delete/payment messages; linked-option error feedback.
- `src/components/Dashboard.tsx` — dashboard outstanding fee totals use the shared invoice-balance helper.
- `src/components/AdministrationModule.tsx` — safe load/save/delete errors; relationship-option lookup error state and retry.
- `src/components/AccountsModule.tsx` — visible safe error state when linked student choices fail to load.
- `src/components/FilesModule.tsx` — private storage size/MIME checks and role-gated upload/delete controls.
- `src/components/AuthScreens.tsx` — safe registration/login error display.
- `src/lib/auth.ts` — owner registration recovery message no longer appends database/provider diagnostics.
- `src/lib/modules.ts` — removes the unfinished parent/guardian generic CRUD module until a dedicated linked-family workflow is completed.
- `src/styles/premium-refinement.css` — compact error-state styling consistent with the Stage 3 premium visual layer.
- `scripts/test-user-errors.mjs` — 15 user-facing error regression tests.
- `scripts/test-finance.mjs` — 7 finance calculation regression tests.
- `scripts/verify-project.mjs` — expanded source, role-route, table-allowlist, safe-error and finance checks.
- `package.json` — test scripts for the new focused checks.

No Supabase database migration, production function deployment, Cloudflare deployment or live account/data mutation is included.
