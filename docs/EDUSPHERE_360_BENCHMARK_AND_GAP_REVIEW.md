# EduSphere 360 — benchmark and completion review

**Review date:** 9 November 2026
**Scope:** Public institution onboarding, authentication, institution workspace navigation, communication, learning and operations.

## External product benchmark

EduSphere 360 was reviewed against documented workflow patterns, not product branding or marketing claims.

| Reference platform | Documented pattern | EduSphere 360 design response |
|---|---|---|
| PowerSchool | Student, parent, teacher and administrator views with grades, assignments, attendance, fee balances and communication | Keep role-specific workspaces; expose announcements through a role-filtered notification centre and unread state |
| Skyward | Combined student information and ERP capabilities across finance, HR/payroll, assets and family engagement | Preserve distinct People, Academics, Finance, HR and Operations workspaces with role-scoped access |
| Workday Student | Student lifecycle from recruitment/admission to curriculum, registration, records, advising and student financials | Organise education workflows around the student lifecycle and link learner records to academic and finance operations |
| Oracle Student Management | Student records, curriculum, admissions, billing, receivables, collections and payments | Keep student management and fee ledger linked, but place fee collection inside Finance & Payments |
| Moodle / Canvas | Course delivery, assessments, mobile-first access and learning integrations | Use dedicated learning and teaching workflows; integrations must be clearly labelled until configured |
| Higher-education SIS market | Current SIS providers span specialist student administration and broader finance/HR platform suites | Maintain school, college and university flexibility through configuration rather than exposing irrelevant menus to every role |

## Implemented in this polish pass

- Dedicated Notification Centre route and top-bar bell with unread count.
- Per-user read receipts for institution announcements, stored in the announcement_reads table.
- Receipt row-level security binds every receipt to the authenticated user and an active institution membership; clients cannot read another user's receipt or delete receipts.
- Notification filters for all and unread, search, refresh, mark-as-read and mark-all-as-read.
- Self-service password recovery entry from login, Supabase recovery email request, recovery callback detection, password update screen and return-to-login flow.
- Public sign-up remains an institution-owner workflow. Staff, students and parents are provisioned or invited by an institution owner/administrator rather than creating unlinked public accounts.
- Existing role-based navigation, institution-specific workspaces, attendance and linked operations remain in place.

## Existing implementation boundaries found during review

These are deliberately not described as finished production integrations:

- Many of the 33 workspace groups use typed, institution-scoped records in the institutional_records table; a subset has dedicated relational workflows (for example attendance registers, library circulation, inventory movements and student transport allocations). More specialised modules still need deeper entity-specific relationships, validation and acceptance testing.
- QR/RFID/biometric attendance is only at device-source registration stage. A real provider/device feed, authentication, identity mapping, anti-duplicate handling and pilot verification are required before automatic marking can be enabled.
- Backup/restore job records do not themselves create or restore Supabase provider backups.
- Email/WhatsApp/SMS, payments and other third-party services require configured provider credentials, delivery settings and operational verification.
- Public legal terms and privacy notices are in-product notices and still need institution/provider legal review before public production adoption.

## Security and operational follow-up

The live Supabase security advisor reported leaked-password protection disabled. Enable Supabase Auth's leaked-password protection in the project's Auth password settings and verify SMTP delivery for password-recovery messages. The security advisor also reported seven callable SECURITY DEFINER functions; review each function's intended API exposure and its RLS dependencies before changing grants. Do not revoke them indiscriminately: several are used by existing authorization policies and fee-payment workflows.

The performance advisor reported 73 foreign keys without covering indexes and duplicate permissive SELECT policies on fee_payments. Review the query workload and current policy predicates before adding indexes or consolidating policies; avoid blanket index creation or removing policy coverage.

## Sources consulted

- Microsoft Learn, Student Information System examples: https://learn.microsoft.com/en-us/industry/education/education-solutions/student-information-system
- Gartner, SIS market guide / critical capabilities (2026): https://www.gartner.com/reviews/market/student-information-systems
- PowerSchool, Student and Parent portal capabilities: https://www.powerschool.com/
- Skyward, student management and school business suite: https://www.skyward.com/
- Workday, Student Management: https://www.workday.com/en-us/products/student.html
- Oracle, Student Management: https://www.oracle.com/education/higher-education/student-management/
- Moodle LMS: https://moodle.org/
- Instructure Canvas: https://www.instructure.com/canvas
- Supabase Auth password recovery API: https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- Supabase Auth password security and leaked-password protection: https://supabase.com/docs/guides/auth/password-security