# Teacher account provisioning — identity integrity

## Required workflow

Teacher login provisioning requires an existing employee identity in the same institution, with an email address that matches the requested login after trimming and case normalization.

1. An owner or administrator registers and saves the employee under Faculty & Employee Management.
2. The owner or administrator opens User Account Management and provisions the teacher login using the same email.
3. The Edge Function verifies one matching, currently unlinked employee record before creating an Auth user.
4. It creates the Auth user, profile and institution membership.
5. It links the exact employee row by ID and institution, with a condition that the employee is still unlinked.
6. It verifies the database returned exactly that employee ID and new Auth user ID before reporting success.

A missing, duplicate, ambiguous or already-linked employee record is rejected before any new Auth account is created. The function does not silently create an orphan teacher login.

## Failure and rollback

If profile, membership or employee-link creation fails after the Auth identity is created, the function deletes the new Auth user. Existing foreign keys cascade profile and membership cleanup, while the teacher-to-user relationship uses ON DELETE SET NULL. If Auth cleanup itself cannot be confirmed, the function returns a server error and instructs the administrator not to retry blindly until the account is reviewed.

No existing employee, Auth user or unrelated institution data is mutated during the preflight check.

## Verification

Run:

    node scripts/test-account-provisioning.mjs

The tests cover email normalization, escaped ILIKE metacharacters, exact employee matching, missing/ambiguous matches, existing links and verification of the conditional update response.

The GitHub workflow .github/workflows/teacher-account-provisioning.yml runs these guards whenever the Edge Function or its tests change.

## Release gate

This change is a source-level fix only. It is not live until the updated create-user Edge Function is deployed to the intended Supabase project and exercised with disposable test identities:

- Owner provisions a teacher login for one unlinked employee.
- The employee row points to the returned Auth user ID.
- The teacher can sign in and the faculty workspace loads that employee profile.
- Missing, duplicate and already-linked employee cases are rejected without creating an Auth identity.
- A simulated link failure leaves no new Auth user, profile or membership.
- Administrator restrictions and cross-institution isolation remain enforced.

Do not use real staff accounts for rollback tests. Do not deploy directly to production before the preview and live test matrix passes.