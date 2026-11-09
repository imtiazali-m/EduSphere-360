# Navigation and workspace reconciliation

The active navigation catalogue contains exactly eight approved groups. Each visible submenu maps to a dedicated connected workspace; data modules use the shared Supabase-backed CRUD engine with module-specific fields, columns and role actions. Administration, accounts, files, reports and student/parent profile use their dedicated components.

## Approved main menu

1. Dashboard
2. Admission & Students — Student Record
3. People & Staff — Faculty & Staff; User Account
4. Institute Administration — Departments; Programs; Class Sections; Academic Session; Subjects; Rooms & Facilities; Files & Documentation
5. Academic Management — Attendance Registration; Examination; Exam Results; Assignments; Assignment Submission; Timetable
6. Finance & Payments — Fees Invoice
7. Communication — Announcement
8. Operations & Reports — Work Management; Reports

## Role-specific navigation counts

| Role | Groups | Submenu destinations |
|---|---:|---:|
| Owner | 8 | 20 |
| Administrator | 8 | 20 |
| Teacher | 5 | 9 |
| Student | 5 | 8 |
| Parent / guardian | 4 | 6 |
| Accountant | 3 | 3 |
| Examination Officer | 4 | 5 |

Dashboard is a direct destination and is not counted as a submenu. Quick Access is separate from the scrollable navigation and anchored at the bottom of the sidebar. Owner and administrator shortcuts are Attendance Registration, Fees Invoice and Files & Documentation.

## Functional coverage and verification boundary

- Data modules: student records, faculty/staff, attendance, examinations, exam results, fee invoices, assignments, assignment submissions, work management, timetable and announcements.
- Dedicated workspaces: six institution-administration data screens, user accounts, institution files, reports and linked student/parent profile.
- Every menu route is checked against the actual module key or dedicated screen. Role visibility is checked against the role access map.
- The existing source verifier and unit tests validate source/configuration and selected business rules. They do not replace authenticated end-to-end tests against the live Supabase project for every role, table, CRUD action, storage operation and cross-institution security boundary.
