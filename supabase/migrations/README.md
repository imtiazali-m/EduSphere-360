# Migration history

The sixty-eight timestamped migration files in this folder match the remote migration history recorded by the linked Supabase project. Keep each 14-digit timestamp unchanged so local and remote migration histories remain aligned.

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


The residence operations migration adds institution-scoped hostel buildings, rooms, beds, resident allocations, movement history, visitor records, accommodation fee charges and maintenance requests. Bed allocation, transfer and final check-out are transaction-guarded database functions. Student and guardian visibility follows linked student relationships; staff management and finance access remain role-restricted. Accommodation charges are tracked separately and are not automatically posted to the tuition fee ledger.


The latest timestamped migrations add institution-scoped in-app messaging, transport attendance, room reservation approval, hostel/residence management, supplier procurement, purchase orders and goods receiving, plus cafeteria menus, daily availability, meal plans and stock-aware sales. Purchase receiving and cafeteria sales update the inventory movement ledger through database transactions; provider-dependent backups, WhatsApp/email delivery and external payment settlement are not represented as completed by these migrations.


Library reading progress records are linked to institution students and, when selected, the associated library loan. Student reader cards are derived from the current student profile and actual loan activity. Fee receipt issuance is recorded in a separate tenant-scoped ledger against an existing fee payment; receipt numbers are allocated atomically, stored snapshots support later verification, and batch issuance does not create or alter fee payments.


Online payment screens read the existing fee-payment ledger and store separately reviewed gateway references. A provider review is a finance audit note only; it does not charge a card, call a gateway, or automatically change a payment to settled.


Facility asset lifecycle actions assign and transfer assets, update warranty information and record authorised disposal. Each action updates the current asset fields and appends an institution-scoped event entry for later lifecycle reports.


Receipt issuance validates the current fee-payment record at insertion time and rejects pending, failed, unpaid, void or reversed transactions. A payment snapshot is stored with the issued receipt so later verification reflects the actual record at issuance.


Scheduled report definitions can now be run immediately from the institution workspace. A CSV is generated from the selected live tenant-scoped source and the execution history records the report, row count, output filename and requesting user. Saved frequency/recipient preferences are not automatically executed or emailed until a server scheduler and delivery provider are configured.


The Helpdesk extension adds institution-scoped requester tickets, priority and status queues, ticket conversation, private staff notes, self-assignment and required resolution notes. Requesters can see only their own tickets, while owners and administrators can manage the institution queue.


Hostel accommodation charges now support separate partial/full payment entries. Each payment is recorded in a payment ledger and updates the charge balance under a row lock; overpayments and waived charges are rejected. These payments remain separate from tuition fee invoices.


Duplicate detection scans real student and teacher identifiers and stores owner/admin review decisions per institution. Possible matches are not merged or deleted automatically; administrators mark confirmed duplicates or false positives after review.
