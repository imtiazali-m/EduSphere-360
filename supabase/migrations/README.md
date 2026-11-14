# Migration history

The fifty-seven timestamped migration files in this folder match the remote migration history recorded by the linked Supabase project. Keep each 14-digit timestamp unchanged so local and remote migration histories remain aligned.

The current online application includes the reviewed schema changes for the existing live schema, Faculty & Employee Management, and Student Management operations (admission lifecycle, linked guardian contacts, class placements, private student documents and audit history for attendance, published results, assignment submissions, guardian policy consolidation and activity indexes). The Student Management and Faculty/Employee migrations have already been applied to the linked project; do not replay them manually.

The older numbered SQL files are preserved as legacy project material. Do not execute them blindly against the existing production database: parts of their schema are already present with different legacy column names. Reconcile the remote migration history before any future schema deployment.


The institutional platform expansion adds campuses, a typed institution-scoped operational record layer with immutable audit events, approval and data-transfer queues, bulk attendance registers, device-source registry, class coverage, library circulation, inventory movements, student transport allocations, payroll runs/items and institution settings. The bulk attendance RPC is invoker-security and uses the active member's institution plus existing row-level security. Device-based attendance is registered as not configured until a real provider feed is connected.

The institutional policy refinement consolidates permissive SELECT policies, limits teacher-visible employee records to the signed-in employee, adds institution-scoped leave-to-class-cover references, and adds foreign-key indexes for the new institutional tables.

The campus-scope migration adds an institution-scoped campus reference to the existing student, faculty, academic, finance, assessment, communication and operations tables, preserves existing unassigned records, and adds an atomic stock-movement function that prevents negative stock. A follow-up fixes the row-count check in that function.


The announcement read-receipts migration adds per-user read state for published institution announcements. Its row-level security only permits an authenticated user with an active institution membership to read or update their own receipt; there is no client DELETE grant. The Notification Centre uses those receipts to display unread totals and mark individual or all visible announcements as read.


A follow-up performance migration adds the missing lookup index for announcement receipt user IDs and removes the redundant fee-payment SELECT policy. The surviving fee-payment policy includes the same owner/admin/accountant grant and additionally permits linked student/guardian visibility through the student-access check, so the redundant policy was a strict subset.


The finance/accounting workflow migration adds a tenant-scoped chart of accounts, balanced journal headers and lines, and employee salary profiles. Posting a journal is database-validated: at least two lines are required and total debits must equal total credits. Payroll runs snapshot the active salary profiles effective during the selected period; only an owner or administrator can approve a run, and the finance close operation requires every employee payment to be marked paid. New finance tables have RLS enabled and explicit authenticated grants.

The salary profile lifecycle uses an atomic database function to close the previous active profile and save the new effective version in one transaction. Employees can read only their own salary profiles and payroll item records; a separate RLS policy allows them to read only the payroll run headers containing their own payroll entries.

Institution setting change requests are stored in the workflow approval queue. Owner/admin approval applies the requested setting and records the decision in one database function, so an approved request cannot be left unapplied because a separate client-side update failed.


The transport accountant read migration preserves the consolidated institution-scoped record policy while allowing finance staff to inspect transport allocation records and related transport register entries. Parent/student portal visibility and teacher employee-record isolation remain explicit in the policy.


Stage 9 adds institution-scoped examination grade bands and assessment weights, online assessments/questions/attempts, rechecking requests, immutable mark correction history and reusable rubrics. Results move through a database-guarded submission, checking, approval and publication lifecycle. Online attempts enforce server-side timing and attempt limits, save question order, omit answer keys from student delivery, auto-score objective items and route written answers to authorised manual review. Grade ranges cannot overlap, component weights are capped per session/class/subject, and post-submission mark corrections are role-restricted and audited. QTI XML exchange currently covers basic standalone assessment-item files; it does not claim full package or certification conformance.


The academic, student-care and campus-operations migration adds institution-scoped question bank items, assessment papers and paper-question relationships; curriculum unit plans; confidential student behaviour events with explicit family visibility; student certificates with institution-unique numbers and verification codes; visitor entry records; facility assets; and maintenance requests. Every new table has row-level security enabled, explicit authenticated grants and institution-safe foreign keys where records relate to other institution data. Linked learners and guardians can read only published curriculum units, explicitly family-visible behaviour events, and issued certificates permitted by the student-link policy.

Question-paper approval is a separate guarded database function. It requires an owner, administrator or exam officer, at least one question, published question-bank entries and a question-mark total matching the paper maximum. Draft question lines can be removed while the paper remains in draft.


The institutional catalogue permission migration aligns the generic catalogue write policy with the role-specific UI: only owners and administrators can create or edit institution-wide library, transport and facilities master records. Teachers retain the dedicated library circulation workflow and teaching/academic operations; accountants retain inventory and finance access subject to their existing policies. Read access and portal visibility are unchanged.


The atomic library circulation migration adds invoker-security issue and return functions. A transaction-scoped advisory lock keyed to the institution and registered book serializes concurrent checkouts against the stored copy count without requiring teachers to update the admin-managed book catalogue; active duplicate loans are rejected. Return processing locks the loan, prevents duplicate returns, and calculates the overdue fine from the book's configured per-day rate. Both functions require an active owner, administrator or teacher role and continue to execute under the caller's row-level security permissions.


The atomic transport allocation migration adds database-side creation and end-allocation functions. It validates institution-scoped active students and registered route/stop/vehicle records, locks the student to serialize overlapping allocation checks, locks the vehicle for seat-capacity checks, and records lifecycle changes with the authenticated administrator. The UI calls these functions rather than issuing direct inserts or status updates.


The Stage 5 administration, Stage 6 people/HR, Stage 7 attendance/leave/wellbeing, Stage 8 academic-management, and Stage 9 assessment-weight migrations have been restored from the linked Supabase project's recorded migration statements. Filenames use the exact remote migration versions; these files document already-applied schema changes and must not be replayed manually against the linked production database.


## Government Islamia Degree College Badin — custom role permissions

The college redesign adds three migrations to the linked Supabase project:

- `20261113173320_college_custom_role_profiles_and_scope_policies.sql` creates tenant-scoped job role profiles and user assignments, stores module/action grants, supports optional campus and department scope, and intersects existing row-level policies on core student, employee, academic, attendance, exam, fee, HR, payroll, library, certificate and visitor records.
- `20261113173552_college_private_permission_guards.sql` moves permission evaluators into the non-API `private` schema and guards examination result approval/publication and approval-queue decisions.
- `20261113174054_college_approval_profile_action_alignment.sql` allows an explicitly delegated approval profile to perform an approval decision without granting general edit access.

The seven existing membership roles remain the authentication ceiling. Profiles such as Principal, Vice Principal, HOD, Registrar, Admissions Officer, Examination Controller, Invigilator, Accounts Officer, Cashier, HR Manager, Librarian and Receptionist are job/access profiles assigned to a matching active membership role. A profile cannot elevate an account to owner or administrator. An account with any custom assignment is restricted to its active profiles; an account with no custom assignment retains its prior role-based access. Do not seed or assign profiles automatically; the institution owner/authorised administrator must review the employee and scope before assignment.

The current permission guard covers direct RLS-backed access to the listed tables and has explicit database triggers for result and approval status decisions. Review existing SECURITY DEFINER RPCs separately before claiming every RPC-based action has full custom-profile enforcement. The existing project security advisor still reports pre-existing SECURITY DEFINER functions exposed to authenticated users and recommends reviewing them individually.


- `20261113175058_college_custom_role_high_impact_rpc_guards.sql` adds the custom-profile checks to question-paper approval, payroll approval and adjustments, transport fee charge creation, and institutional setting approval RPCs. These checks run in addition to the original base membership-role checks.


The admission-stage guard migration adds a database trigger to the existing student admission lifecycle. It rejects invalid status jumps, restricts stage changes to institution owners and administrators with the relevant student edit scope, and assigns reviewer identity and review timestamps from the authenticated database session. It also synchronises the student's active, pending or inactive record status with the admission outcome. The trigger is invoker-security and runs under the existing students row-level policies.
