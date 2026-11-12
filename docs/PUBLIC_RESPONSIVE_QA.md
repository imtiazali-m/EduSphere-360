# Public onboarding responsive browser acceptance

This workflow runs the built Vite production bundle in Chromium. It verifies:
- public welcome headline and public navigation behaviour;
- welcome, role-specific login, password-reset and owner setup viewport overflow at 1440×900, 768×1024 and 390×844;
- role-specific login-category selection while navigating between role hashes in one mounted application;
- no uncaught browser page errors during the tested public journeys;
- screenshot artifacts for visual inspection.

The role loop checks route-derived login categories for owner, administrator, employee/teacher, student, parent, accountant and examination officer. It does not submit credentials, create an Auth account, send a reset email, create an institution, or write Supabase data.

This is public/onboarding responsive coverage. It is not authenticated seven-role workspace QA, not a full accessibility audit, and not a screenshot or smoke test of the live Cloudflare production URL. Release acceptance still requires signed-in tests for each role and critical business lifecycle, plus cross-institution denial checks.
