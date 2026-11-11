# Phase 1 — Complete role menu inventory

**Audit date:** 11 November 2026  
**Repository:** `imtiazali-m/EduSphere-360`  
**Branch:** `stage-6-people-hr`  
**Source basis:** `src/lib/institutionalCatalog.ts` and `src/lib/navigationCatalog.ts`

## What this inventory proves — and what it does not

This appendix describes the full source catalogue and the runtime role-filtered menus. The catalogue contains **31 top-level groups and 398 submenu entries**; the current role filter exposes only the subsets shown in the table below. A catalogue entry is not necessarily visible to every role, and catalogue size must not be confused with the live visible-destination count.

A visible menu entry or a value in the route index is **not** evidence that its complete workflow is implemented, that its API is authorized, or that records persist. Items listed as **Explicitly unavailable** are deliberately routed to the unavailable-workspace experience in the inspected resolver. Other items are marked **Workflow acceptance pending**; they require destination-by-destination resolver, permission, data-lifecycle and browser testing.

## Role labels

- **Owner** (`owner`)
- **Administrator** (`admin`)
- **Teacher / employee** (`teacher`)
- **Student** (`student`)
- **Parent / guardian** (`parent`)
- **Accountant** (`accountant`)
- **Examination officer** (`exam_officer`)

## Per-role menu size

| Role | Visible menu groups | Visible submenu destinations |
|---|---:|---:|
| Owner | 31 | 398 |
| Administrator | 31 | 398 |
| Teacher / employee | 17 | 198 |
| Student | 15 | 140 |
| Parent / guardian | 15 | 136 |
| Accountant | 12 | 121 |
| Examination officer | 7 | 89 |

## Full destination inventory

### 1. Dashboard (`dashboard`)

**Role visibility:** Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer  
**Visible item counts:** Owner 15 · Administrator 15 · Teacher / employee 13 · Student 10 · Parent / guardian 10 · Accountant 10 · Examination officer 11

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Institutional Overview | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Workflow acceptance pending |
| 2 | Academic Overview | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Workflow acceptance pending |
| 3 | Financial Overview | Owner, Administrator, Student, Parent / guardian, Accountant | Workflow acceptance pending |
| 4 | Attendance Overview | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 5 | Student Performance | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Workflow acceptance pending |
| 6 | Student Behaviour | Owner, Administrator, Teacher / employee, Examination officer | Role-specific route guard; verify by role |
| 7 | Employee Performance | Owner, Administrator, Teacher / employee | Explicitly unavailable |
| 8 | Statistics and KPI Cards | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Workflow acceptance pending |
| 9 | Charts and Comparative Analytics | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Workflow acceptance pending |
| 10 | Calendar and Events | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Explicitly unavailable |
| 11 | Notification Centre | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Workflow acceptance pending |
| 12 | Tasks and Reminders | Owner, Administrator, Teacher / employee, Accountant, Examination officer | Workflow acceptance pending |
| 13 | Pending Approvals | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 14 | Recent Activities | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Workflow acceptance pending |
| 15 | Institutional Alerts | Owner, Administrator | Workflow acceptance pending |

### 2. AI Intelligence (`ai`)

**Role visibility:** Owner, Administrator  
**Visible item counts:** Owner 13 · Administrator 13

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | AI Assistant | Owner, Administrator | Explicitly unavailable |
| 2 | Smart Reports | Owner, Administrator | Explicitly unavailable |
| 3 | Student Performance Prediction | Owner, Administrator | Explicitly unavailable |
| 4 | Student Analysis | Owner, Administrator | Explicitly unavailable |
| 5 | Fee Collection Prediction | Owner, Administrator | Explicitly unavailable |
| 6 | Examination Analysis | Owner, Administrator | Explicitly unavailable |
| 7 | AI Timetable Suggestions | Owner, Administrator | Explicitly unavailable |
| 8 | AI Question Generation | Owner, Administrator | Explicitly unavailable |
| 9 | AI Document Assistant | Owner, Administrator | Explicitly unavailable |
| 10 | AI Learning Recommendations | Owner, Administrator | Explicitly unavailable |
| 11 | Academic Performance Insights | Owner, Administrator | Explicitly unavailable |
| 12 | Attendance and Behaviour Insights | Owner, Administrator | Explicitly unavailable |
| 13 | Institutional Intelligence | Owner, Administrator | Explicitly unavailable |

### 3. Administration (`administration`)

**Role visibility:** Owner, Administrator  
**Visible item counts:** Owner 16 · Administrator 16

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Institute Profile | Owner, Administrator | Workflow acceptance pending |
| 2 | Campus and Branch Management | Owner, Administrator | Workflow acceptance pending |
| 3 | Academic Structure and Sections | Owner, Administrator | Workflow acceptance pending |
| 4 | Departments | Owner, Administrator | Workflow acceptance pending |
| 5 | Designations | Owner, Administrator | Workflow acceptance pending |
| 6 | Organizational Structure | Owner, Administrator | Workflow acceptance pending |
| 7 | System Configuration | Owner, Administrator | Workflow acceptance pending |
| 8 | Approval and Workflows | Owner, Administrator | Workflow acceptance pending |
| 9 | Policies and Rules | Owner, Administrator | Workflow acceptance pending |
| 10 | Administrative Audit | Owner, Administrator | Workflow acceptance pending |
| 11 | User Access and Invitations | Owner, Administrator | Workflow acceptance pending |
| 12 | Role and Permission Management | Owner, Administrator | Workflow acceptance pending |
| 13 | Institution Settings | Owner, Administrator | Workflow acceptance pending |
| 14 | Branding and Document Settings | Owner, Administrator | Workflow acceptance pending |
| 15 | Academic Configuration | Owner, Administrator | Workflow acceptance pending |
| 16 | Security and Access History | Owner, Administrator | Workflow acceptance pending |

### 4. Academic Sessions (`academic-sessions`)

**Role visibility:** Owner, Administrator  
**Visible item counts:** Owner 9 · Administrator 9

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | All Academic Sessions | Owner, Administrator | Workflow acceptance pending |
| 2 | Create Academic Session | Owner, Administrator | Workflow acceptance pending |
| 3 | Session Calendar | Owner, Administrator | Workflow acceptance pending |
| 4 | Session Start and End Dates | Owner, Administrator | Workflow acceptance pending |
| 5 | Active Session Management | Owner, Administrator | Workflow acceptance pending |
| 6 | Session-wise Student Records | Owner, Administrator | Workflow acceptance pending |
| 7 | Session-wise Examination Records | Owner, Administrator | Workflow acceptance pending |
| 8 | Session History | Owner, Administrator | Workflow acceptance pending |
| 9 | Session Reports | Owner, Administrator | Workflow acceptance pending |

### 5. Classes and Sections (`classes-sections`)

**Role visibility:** Owner, Administrator  
**Visible item counts:** Owner 10 · Administrator 10

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | All Classes | Owner, Administrator | Workflow acceptance pending |
| 2 | Add Class | Owner, Administrator | Workflow acceptance pending |
| 3 | Sections | Owner, Administrator | Workflow acceptance pending |
| 4 | Class Teachers | Owner, Administrator | Workflow acceptance pending |
| 5 | Class Allocation | Owner, Administrator | Workflow acceptance pending |
| 6 | Student Class Assignment | Owner, Administrator | Workflow acceptance pending |
| 7 | Class Capacity | Owner, Administrator | Workflow acceptance pending |
| 8 | Class Promotion History | Owner, Administrator | Workflow acceptance pending |
| 9 | Transfer History | Owner, Administrator | Workflow acceptance pending |
| 10 | Class History | Owner, Administrator | Workflow acceptance pending |

### 6. Subjects (`subjects`)

**Role visibility:** Owner, Administrator  
**Visible item counts:** Owner 10 · Administrator 10

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | All Subjects | Owner, Administrator | Workflow acceptance pending |
| 2 | Add Subject | Owner, Administrator | Workflow acceptance pending |
| 3 | Subject Categories | Owner, Administrator | Workflow acceptance pending |
| 4 | Subject Allocation | Owner, Administrator | Workflow acceptance pending |
| 5 | Teacher Assignment | Owner, Administrator | Workflow acceptance pending |
| 6 | Class-wise Subjects | Owner, Administrator | Workflow acceptance pending |
| 7 | Subject Combinations | Owner, Administrator | Workflow acceptance pending |
| 8 | Subject Syllabus | Owner, Administrator | Workflow acceptance pending |
| 9 | Subject Performance | Owner, Administrator | Workflow acceptance pending |
| 10 | Subject-wise Reports | Owner, Administrator | Workflow acceptance pending |

### 7. Student Management (`students`)

**Role visibility:** Owner, Administrator, Teacher / employee, Student, Parent / guardian  
**Visible item counts:** Owner 15 · Administrator 15 · Teacher / employee 7 · Student 7 · Parent / guardian 5

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Student Directory | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 2 | New Admissions | Owner, Administrator | Workflow acceptance pending |
| 3 | Admission Applications | Owner, Administrator | Workflow acceptance pending |
| 4 | Student Profiles | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 5 | Enrollment | Owner, Administrator | Workflow acceptance pending |
| 6 | Class and Section Assignments | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 7 | Student Documentation | Owner, Administrator | Workflow acceptance pending |
| 8 | Student ID Cards | Owner, Administrator, Student, Parent / guardian | Workflow acceptance pending |
| 9 | Promotion and Transfer | Owner, Administrator | Workflow acceptance pending |
| 10 | Student History | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 11 | Alumni Records | Owner, Administrator | Workflow acceptance pending |
| 12 | Student Performance Charts | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 13 | Student Reports | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 14 | Student Data Export | Owner, Administrator | Workflow acceptance pending |
| 15 | Bulk Student Operations | Owner, Administrator | Explicitly unavailable |

### 8. Employees and Faculty (`employees`)

**Role visibility:** Owner, Administrator, Teacher / employee  
**Visible item counts:** Owner 15 · Administrator 15 · Teacher / employee 3

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Employee Directory | Owner, Administrator | Workflow acceptance pending |
| 2 | Add Employee | Owner, Administrator | Workflow acceptance pending |
| 3 | Teacher Records | Owner, Administrator | Workflow acceptance pending |
| 4 | Non-Teaching Staff | Owner, Administrator | Workflow acceptance pending |
| 5 | Employee Profiles | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 6 | Department Allocation | Owner, Administrator | Workflow acceptance pending |
| 7 | Designations | Owner, Administrator | Workflow acceptance pending |
| 8 | Workload Allocation | Owner, Administrator | Workflow acceptance pending |
| 9 | Employee Documentation | Owner, Administrator | Workflow acceptance pending |
| 10 | Employee ID Cards | Owner, Administrator | Workflow acceptance pending |
| 11 | Employee History | Owner, Administrator | Workflow acceptance pending |
| 12 | Employee Performance | Owner, Administrator | Explicitly unavailable |
| 13 | Employee Attendance | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 14 | Employee Leave Management | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 15 | Employee Reports | Owner, Administrator | Workflow acceptance pending |

### 9. Accounts and Finance (`accounts-finance`)

**Role visibility:** Owner, Administrator, Accountant  
**Visible item counts:** Owner 12 · Administrator 12 · Accountant 12

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Accounts Dashboard | Owner, Administrator, Accountant | Workflow acceptance pending |
| 2 | Chart of Accounts | Owner, Administrator, Accountant | Workflow acceptance pending |
| 3 | Income | Owner, Administrator, Accountant | Workflow acceptance pending |
| 4 | Expenses | Owner, Administrator, Accountant | Workflow acceptance pending |
| 5 | Cash Book | Owner, Administrator, Accountant | Workflow acceptance pending |
| 6 | Bank Book | Owner, Administrator, Accountant | Workflow acceptance pending |
| 7 | Transactions | Owner, Administrator, Accountant | Workflow acceptance pending |
| 8 | Vouchers | Owner, Administrator, Accountant | Workflow acceptance pending |
| 9 | General Ledger | Owner, Administrator, Accountant | Workflow acceptance pending |
| 10 | Financial Statements | Owner, Administrator, Accountant | Workflow acceptance pending |
| 11 | Account Reconciliation | Owner, Administrator, Accountant | Workflow acceptance pending |
| 12 | Financial Reports | Owner, Administrator, Accountant | Workflow acceptance pending |

### 10. Fees Management (`fees`)

**Role visibility:** Owner, Administrator, Student, Parent / guardian, Accountant  
**Visible item counts:** Owner 16 · Administrator 16 · Student 3 · Parent / guardian 5 · Accountant 16

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Fees Dashboard | Owner, Administrator, Student, Parent / guardian, Accountant | Workflow acceptance pending |
| 2 | Fee Structure | Owner, Administrator, Accountant | Workflow acceptance pending |
| 3 | Fee Categories | Owner, Administrator, Accountant | Workflow acceptance pending |
| 4 | Student Fee Assignment | Owner, Administrator, Accountant | Workflow acceptance pending |
| 5 | Fee Invoices | Owner, Administrator, Student, Parent / guardian, Accountant | Workflow acceptance pending |
| 6 | Payment Collection | Owner, Administrator, Parent / guardian, Accountant | Workflow acceptance pending |
| 7 | Online Payments | Owner, Administrator, Accountant | Explicitly unavailable |
| 8 | Partial Payments | Owner, Administrator, Accountant | Workflow acceptance pending |
| 9 | Discounts | Owner, Administrator, Accountant | Workflow acceptance pending |
| 10 | Scholarships | Owner, Administrator, Accountant | Workflow acceptance pending |
| 11 | Outstanding Dues | Owner, Administrator, Parent / guardian, Accountant | Workflow acceptance pending |
| 12 | Fee Refunds | Owner, Administrator, Accountant | Workflow acceptance pending |
| 13 | Fee Receipts | Owner, Administrator, Student, Parent / guardian, Accountant | Workflow acceptance pending |
| 14 | Class-wise Collection Reports | Owner, Administrator, Accountant | Workflow acceptance pending |
| 15 | Section-wise Collection Reports | Owner, Administrator, Accountant | Workflow acceptance pending |
| 16 | Overall Collection Reports | Owner, Administrator, Accountant | Workflow acceptance pending |

### 11. Accounts Receivable (`receivables`)

**Role visibility:** Owner, Administrator, Accountant  
**Visible item counts:** Owner 12 · Administrator 12 · Accountant 12

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Receivables Dashboard | Owner, Administrator, Accountant | Workflow acceptance pending |
| 2 | Total Outstanding | Owner, Administrator, Accountant | Workflow acceptance pending |
| 3 | Student-wise Receivables | Owner, Administrator, Accountant | Workflow acceptance pending |
| 4 | Invoice-wise Receivables | Owner, Administrator, Accountant | Workflow acceptance pending |
| 5 | Overdue Accounts | Owner, Administrator, Accountant | Workflow acceptance pending |
| 6 | Ageing Analysis | Owner, Administrator, Accountant | Workflow acceptance pending |
| 7 | Partial Payment Balances | Owner, Administrator, Accountant | Workflow acceptance pending |
| 8 | Collection Follow-ups | Owner, Administrator, Accountant | Workflow acceptance pending |
| 9 | Outstanding History | Owner, Administrator, Accountant | Workflow acceptance pending |
| 10 | Receivable Reconciliation | Owner, Administrator, Accountant | Workflow acceptance pending |
| 11 | Collection Forecasts | Owner, Administrator, Accountant | Workflow acceptance pending |
| 12 | Receivables Reports | Owner, Administrator, Accountant | Workflow acceptance pending |

### 12. Payments and Collections (`payments`)

**Role visibility:** Owner, Administrator, Accountant  
**Visible item counts:** Owner 12 · Administrator 12 · Accountant 12

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Payments Dashboard | Owner, Administrator, Accountant | Workflow acceptance pending |
| 2 | Payment Collection | Owner, Administrator, Accountant | Workflow acceptance pending |
| 3 | Online Payment Records | Owner, Administrator, Accountant | Explicitly unavailable |
| 4 | Cash Payments | Owner, Administrator, Accountant | Workflow acceptance pending |
| 5 | Bank Payments | Owner, Administrator, Accountant | Workflow acceptance pending |
| 6 | Partial Payments | Owner, Administrator, Accountant | Workflow acceptance pending |
| 7 | Payment Verification | Owner, Administrator, Accountant | Workflow acceptance pending |
| 8 | Payment Reconciliation | Owner, Administrator, Accountant | Workflow acceptance pending |
| 9 | Refund Processing | Owner, Administrator, Accountant | Workflow acceptance pending |
| 10 | Payment History | Owner, Administrator, Accountant | Workflow acceptance pending |
| 11 | Failed and Pending Payments | Owner, Administrator, Accountant | Workflow acceptance pending |
| 12 | Collection Reports | Owner, Administrator, Accountant | Workflow acceptance pending |

### 13. Receipts (`receipts`)

**Role visibility:** Owner, Administrator, Accountant  
**Visible item counts:** Owner 10 · Administrator 10 · Accountant 10

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Receipt Dashboard | Owner, Administrator, Accountant | Workflow acceptance pending |
| 2 | Generate Receipt | Owner, Administrator, Accountant | Workflow acceptance pending |
| 3 | Fee Receipts | Owner, Administrator, Accountant | Workflow acceptance pending |
| 4 | Payment Receipts | Owner, Administrator, Accountant | Workflow acceptance pending |
| 5 | Receipt Templates | Owner, Administrator, Accountant | Explicitly unavailable |
| 6 | Receipt Numbering | Owner, Administrator, Accountant | Explicitly unavailable |
| 7 | Receipt Reprinting | Owner, Administrator, Accountant | Workflow acceptance pending |
| 8 | Receipt Verification | Owner, Administrator, Accountant | Workflow acceptance pending |
| 9 | Bulk Receipt Generation | Owner, Administrator, Accountant | Explicitly unavailable |
| 10 | Receipt History | Owner, Administrator, Accountant | Workflow acceptance pending |

### 14. Salary and Payroll (`payroll`)

**Role visibility:** Owner, Administrator, Accountant  
**Visible item counts:** Owner 12 · Administrator 12 · Accountant 12

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Payroll Dashboard | Owner, Administrator, Accountant | Workflow acceptance pending |
| 2 | Salary Structure | Owner, Administrator, Accountant | Workflow acceptance pending |
| 3 | Salary Components | Owner, Administrator, Accountant | Workflow acceptance pending |
| 4 | Employee Salary Assignment | Owner, Administrator, Accountant | Workflow acceptance pending |
| 5 | Monthly Payroll | Owner, Administrator, Accountant | Workflow acceptance pending |
| 6 | Allowances | Owner, Administrator, Accountant | Workflow acceptance pending |
| 7 | Deductions | Owner, Administrator, Accountant | Workflow acceptance pending |
| 8 | Advances and Loans | Owner, Administrator, Accountant | Workflow acceptance pending |
| 9 | Advance Recovery | Owner, Administrator, Accountant | Workflow acceptance pending |
| 10 | Payslips | Owner, Administrator, Accountant | Workflow acceptance pending |
| 11 | Salary Payments | Owner, Administrator, Accountant | Workflow acceptance pending |
| 12 | Payroll Reports | Owner, Administrator, Accountant | Workflow acceptance pending |

### 15. Attendance Management (`attendance`)

**Role visibility:** Owner, Administrator, Teacher / employee, Student, Parent / guardian  
**Visible item counts:** Owner 17 · Administrator 17 · Teacher / employee 17 · Student 7 · Parent / guardian 6

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Attendance Dashboard | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 2 | Student Attendance | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 3 | Daily Attendance | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 4 | Period-wise Attendance | Owner, Administrator, Teacher / employee, Student | Workflow acceptance pending |
| 5 | Class-wise Attendance | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 6 | Bulk Student Attendance | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 7 | Faculty and Staff Attendance | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 8 | Bulk Staff Attendance | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 9 | Attendance Corrections | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 10 | Leave Applications | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 11 | Late Arrival | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 12 | Early Departure | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 13 | Attendance Calendar | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 14 | Attendance Reports | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 15 | Attendance History | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 16 | Attendance Analytics | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 17 | Attendance Alerts | Owner, Administrator, Teacher / employee | Explicitly unavailable |

### 16. Timetable (`timetable`)

**Role visibility:** Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer  
**Visible item counts:** Owner 13 · Administrator 13 · Teacher / employee 10 · Student 4 · Parent / guardian 4 · Examination officer 13

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Timetable Dashboard | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 2 | Master Timetable | Owner, Administrator, Teacher / employee, Examination officer | Workflow acceptance pending |
| 3 | Class Timetable | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 4 | Teacher Timetable | Owner, Administrator, Teacher / employee, Examination officer | Workflow acceptance pending |
| 5 | Room Timetable | Owner, Administrator, Examination officer | Workflow acceptance pending |
| 6 | Period Timetable | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 7 | Teacher Availability | Owner, Administrator, Teacher / employee, Examination officer | Explicitly unavailable |
| 8 | Substitution Management | Owner, Administrator, Teacher / employee, Examination officer | Explicitly unavailable |
| 9 | Timetable Conflicts | Owner, Administrator, Examination officer | Workflow acceptance pending |
| 10 | Timetable Publishing | Owner, Administrator, Examination officer | Explicitly unavailable |
| 11 | Timetable History | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 12 | Class Coverage | Owner, Administrator, Teacher / employee, Examination officer | Explicitly unavailable |
| 13 | Engaged Classes | Owner, Administrator, Teacher / employee, Examination officer | Explicitly unavailable |

### 17. Teaching, Homework and Assignments (`teaching`)

**Role visibility:** Owner, Administrator, Teacher / employee, Student, Parent / guardian  
**Visible item counts:** Owner 15 · Administrator 15 · Teacher / employee 15 · Student 9 · Parent / guardian 7

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Teaching Dashboard | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 2 | Homework | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 3 | Create Assignment | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 4 | Assignment Design and Management | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 5 | Student Submissions | Owner, Administrator, Teacher / employee, Student | Workflow acceptance pending |
| 6 | Teacher Review | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 7 | Marks and Feedback | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 8 | Teaching Materials | Owner, Administrator, Teacher / employee, Student | Workflow acceptance pending |
| 9 | Lesson Plans | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 10 | Homework Calendar | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 11 | Pending Assignments | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 12 | Pending Reviews | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 13 | Assignment History | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 14 | Assignment Reports | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 15 | Downloadable Attachments | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |

### 18. Behaviour and Skills (`behaviour`)

**Role visibility:** Owner, Administrator, Teacher / employee, Student, Parent / guardian  
**Visible item counts:** Owner 12 · Administrator 12 · Teacher / employee 12 · Student 7 · Parent / guardian 6

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Behaviour Dashboard | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 2 | Behaviour Records | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 3 | Positive Behaviour | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 4 | Disciplinary Incidents | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 5 | Rewards and Recognition | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 6 | Warnings | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 7 | Student Skills | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 8 | Co-curricular Activities | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 9 | Competency Tracking | Owner, Administrator, Teacher / employee, Student | Workflow acceptance pending |
| 10 | Student Progress History | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Explicitly unavailable |
| 11 | Behaviour Analytics | Owner, Administrator, Teacher / employee | Explicitly unavailable |
| 12 | Downloadable Behaviour Reports | Owner, Administrator, Teacher / employee | Explicitly unavailable |

### 19. Communication and WhatsApp (`communication`)

**Role visibility:** Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer  
**Visible item counts:** Owner 13 · Administrator 13 · Teacher / employee 13 · Student 13 · Parent / guardian 13 · Accountant 13 · Examination officer 13

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Communication Dashboard | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Workflow acceptance pending |
| 2 | WhatsApp Integration | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Explicitly unavailable |
| 3 | Individual Messages | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Explicitly unavailable |
| 4 | Bulk Messages | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Explicitly unavailable |
| 5 | Class-wise Messaging | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Explicitly unavailable |
| 6 | Employee Notifications | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Explicitly unavailable |
| 7 | Message Templates | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Explicitly unavailable |
| 8 | Assignment Notifications | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Workflow acceptance pending |
| 9 | Email Notifications | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Explicitly unavailable |
| 10 | Delivery History | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Explicitly unavailable |
| 11 | Communication Logs | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Explicitly unavailable |
| 12 | Notification Centre | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Workflow acceptance pending |
| 13 | Communication Reports | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant, Examination officer | Explicitly unavailable |

### 20. Question Bank and Question Papers (`question-bank`)

**Role visibility:** Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer  
**Visible item counts:** Owner 17 · Administrator 17 · Teacher / employee 17 · Student 17 · Parent / guardian 17 · Examination officer 17

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Question Bank Dashboard | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 2 | Multiple-Choice Questions | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 3 | Short Questions | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 4 | Long Questions | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 5 | Subject-wise Questions | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 6 | Chapter-wise Questions | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 7 | Difficulty Levels | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 8 | Question Categories | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 9 | Question Builder | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 10 | Question Paper Designer | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 11 | Paper Templates | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 12 | Marks Distribution | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 13 | Random Question Selection | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 14 | Question Review | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 15 | Question Bank Import and Export | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Explicitly unavailable |
| 16 | Question Paper Download | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 17 | Question Paper Version History | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Explicitly unavailable |

### 21. Examinations and Results (`examinations`)

**Role visibility:** Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer  
**Visible item counts:** Owner 17 · Administrator 17 · Teacher / employee 17 · Student 17 · Parent / guardian 17 · Examination officer 17

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Examination Dashboard | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 2 | Examination Progress | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 3 | Examination Schedule | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 4 | Examination Subjects | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 5 | Examination Rooms | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 6 | Invigilation Management | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Explicitly unavailable |
| 7 | Marks Entry | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 8 | Marks Verification | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 9 | Grading System | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 10 | Result Processing | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 11 | Report Cards | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 12 | Merit Lists | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 13 | Result Publishing | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 14 | Automatic Checking | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Explicitly unavailable |
| 15 | Result Corrections | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 16 | Examination History | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 17 | Examination Reports | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |

### 22. Class Tests (`class-tests`)

**Role visibility:** Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer  
**Visible item counts:** Owner 11 · Administrator 11 · Teacher / employee 11 · Student 11 · Parent / guardian 11 · Examination officer 11

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Class Test Dashboard | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 2 | Create Class Tests | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 3 | Test Schedule | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 4 | Online Tests | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Explicitly unavailable |
| 5 | Written Tests | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Explicitly unavailable |
| 6 | Test Questions | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Explicitly unavailable |
| 7 | Marks Entry | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 8 | Test Results | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 9 | Performance Analysis | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 10 | Test Reports | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |
| 11 | Student-wise Test History | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Examination officer | Workflow acceptance pending |

### 23. Reports and Analytics (`reports`)

**Role visibility:** Owner, Administrator, Teacher / employee, Accountant, Examination officer  
**Visible item counts:** Owner 15 · Administrator 15 · Teacher / employee 9 · Accountant 7 · Examination officer 7

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Reports Dashboard | Owner, Administrator, Teacher / employee, Accountant, Examination officer | Workflow acceptance pending |
| 2 | Student Reports | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 3 | Employee Reports | Owner, Administrator | Workflow acceptance pending |
| 4 | Attendance Reports | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 5 | Examination Reports | Owner, Administrator, Teacher / employee, Examination officer | Workflow acceptance pending |
| 6 | Academic Reports | Owner, Administrator, Teacher / employee, Examination officer | Workflow acceptance pending |
| 7 | Fee Reports | Owner, Administrator, Accountant | Workflow acceptance pending |
| 8 | Payroll Reports | Owner, Administrator, Accountant | Workflow acceptance pending |
| 9 | Financial Reports | Owner, Administrator, Accountant | Workflow acceptance pending |
| 10 | Class Reports | Owner, Administrator, Teacher / employee, Examination officer | Workflow acceptance pending |
| 11 | Comparative Analytics | Owner, Administrator, Teacher / employee, Accountant, Examination officer | Workflow acceptance pending |
| 12 | Custom Report Builder | Owner, Administrator | Explicitly unavailable |
| 13 | Scheduled Reports | Owner, Administrator | Explicitly unavailable |
| 14 | Report Templates | Owner, Administrator, Teacher / employee, Accountant, Examination officer | Explicitly unavailable |
| 15 | Report History | Owner, Administrator, Teacher / employee, Accountant, Examination officer | Explicitly unavailable |

### 24. Certificates and Documentation (`certificates`)

**Role visibility:** Owner, Administrator, Teacher / employee, Student, Parent / guardian  
**Visible item counts:** Owner 13 · Administrator 13 · Teacher / employee 13 · Student 13 · Parent / guardian 13

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Certificate Dashboard | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 2 | Character Certificate | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 3 | Leaving Certificate | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 4 | Enrollment Certificate | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 5 | Bonafide Certificate | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 6 | Achievement Certificate | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 7 | Experience Certificate | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Explicitly unavailable |
| 8 | ID Card Designer | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Explicitly unavailable |
| 9 | Certificate Templates | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Explicitly unavailable |
| 10 | Editable Document Templates | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Explicitly unavailable |
| 11 | Bulk Certificate Generation | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Explicitly unavailable |
| 12 | Certificate Verification | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 13 | Certificate History | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |

### 25. Curriculum and Learning Resources (`curriculum`)

**Role visibility:** Owner, Administrator, Teacher / employee, Student, Parent / guardian  
**Visible item counts:** Owner 13 · Administrator 13 · Teacher / employee 13 · Student 13 · Parent / guardian 13

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Curriculum Dashboard | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 2 | Curriculum Map | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 3 | Syllabus Management | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 4 | Learning Outcomes | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 5 | Lesson Plans | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 6 | Teaching Resources | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Explicitly unavailable |
| 7 | Learning Materials | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Explicitly unavailable |
| 8 | Resource Downloads | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Explicitly unavailable |
| 9 | Subject-wise Curriculum | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 10 | Chapter-wise Learning Resources | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Explicitly unavailable |
| 11 | Curriculum Coverage | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 12 | Learning Progress Tracking | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Explicitly unavailable |
| 13 | Curriculum Reports | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |

### 26. Digital Library (`library`)

**Role visibility:** Owner, Administrator, Teacher / employee, Student, Parent / guardian  
**Visible item counts:** Owner 13 · Administrator 13 · Teacher / employee 9 · Student 11 · Parent / guardian 7

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Library Dashboard | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 2 | Digital Library | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 3 | Book Management | Owner, Administrator | Workflow acceptance pending |
| 4 | Book Catalogue | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 5 | Book Categories | Owner, Administrator, Teacher / employee, Student | Workflow acceptance pending |
| 6 | Book Registration | Owner, Administrator | Workflow acceptance pending |
| 7 | Reading Records | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Explicitly unavailable |
| 8 | Reading Cards | Owner, Administrator, Student | Explicitly unavailable |
| 9 | Student Reading History | Owner, Administrator, Student, Parent / guardian | Explicitly unavailable |
| 10 | Book Issue and Returns | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 11 | Learning Materials | Owner, Administrator, Teacher / employee, Student | Workflow acceptance pending |
| 12 | Resource Downloads | Owner, Administrator, Teacher / employee, Student | Workflow acceptance pending |
| 13 | Library Reports | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |

### 27. Transport Management (`transport`)

**Role visibility:** Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant  
**Visible item counts:** Owner 12 · Administrator 12 · Teacher / employee 5 · Student 4 · Parent / guardian 5 · Accountant 3

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Transport Dashboard | Owner, Administrator, Teacher / employee, Student, Parent / guardian, Accountant | Workflow acceptance pending |
| 2 | Vehicle Management | Owner, Administrator | Workflow acceptance pending |
| 3 | Drivers Management | Owner, Administrator | Workflow acceptance pending |
| 4 | Transport Routes | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 5 | Route Stops | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 6 | Student Transport Allocation | Owner, Administrator, Student, Parent / guardian | Workflow acceptance pending |
| 7 | Transport Fees | Owner, Administrator, Parent / guardian, Accountant | Workflow acceptance pending |
| 8 | Transport Assignments | Owner, Administrator | Workflow acceptance pending |
| 9 | Vehicle Maintenance | Owner, Administrator | Workflow acceptance pending |
| 10 | Transport Attendance | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Explicitly unavailable |
| 11 | Transport History | Owner, Administrator, Teacher / employee, Student, Parent / guardian | Workflow acceptance pending |
| 12 | Transport Reports | Owner, Administrator, Accountant | Workflow acceptance pending |

### 28. Inventory Management (`inventory`)

**Role visibility:** Owner, Administrator, Accountant  
**Visible item counts:** Owner 12 · Administrator 12 · Accountant 12

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Inventory Dashboard | Owner, Administrator, Accountant | Workflow acceptance pending |
| 2 | Items Management | Owner, Administrator, Accountant | Workflow acceptance pending |
| 3 | Item Catalogue | Owner, Administrator, Accountant | Workflow acceptance pending |
| 4 | Item Categories | Owner, Administrator, Accountant | Workflow acceptance pending |
| 5 | Stock In | Owner, Administrator, Accountant | Workflow acceptance pending |
| 6 | Stock Out | Owner, Administrator, Accountant | Workflow acceptance pending |
| 7 | Suppliers | Owner, Administrator, Accountant | Workflow acceptance pending |
| 8 | Purchase Records | Owner, Administrator, Accountant | Workflow acceptance pending |
| 9 | Stock Allocation | Owner, Administrator, Accountant | Workflow acceptance pending |
| 10 | Stock Adjustments | Owner, Administrator, Accountant | Workflow acceptance pending |
| 11 | Inventory History | Owner, Administrator, Accountant | Workflow acceptance pending |
| 12 | Stock Reports | Owner, Administrator, Accountant | Workflow acceptance pending |

### 29. Rooms and Facilities (`facilities`)

**Role visibility:** Owner, Administrator, Teacher / employee  
**Visible item counts:** Owner 10 · Administrator 10 · Teacher / employee 10

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Facilities Dashboard | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 2 | Classroom Management | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 3 | Laboratories | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 4 | Library Rooms | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 5 | Room Allocation | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 6 | Room Availability | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 7 | Room Reservations | Owner, Administrator, Teacher / employee | Explicitly unavailable |
| 8 | Facility Maintenance | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 9 | Facility History | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 10 | Facilities Reports | Owner, Administrator, Teacher / employee | Explicitly unavailable |

### 30. Visitor Management (`visitors`)

**Role visibility:** Owner, Administrator, Teacher / employee  
**Visible item counts:** Owner 9 · Administrator 9 · Teacher / employee 9

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Visitor Dashboard | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 2 | Visitor Registration | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 3 | Visitor Information | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 4 | Visitor Passes | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 5 | Entry and Exit Records | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 6 | Visitor Approvals | Owner, Administrator, Teacher / employee | Explicitly unavailable |
| 7 | Visit History | Owner, Administrator, Teacher / employee | Workflow acceptance pending |
| 8 | Visitor Notifications | Owner, Administrator, Teacher / employee | Explicitly unavailable |
| 9 | Visitor Reports | Owner, Administrator, Teacher / employee | Explicitly unavailable |

### 31. Institutional Systems and Configuration (`institution-config`)

**Role visibility:** Owner, Administrator  
**Visible item counts:** Owner 15 · Administrator 15

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Institution Configuration | Owner, Administrator | Workflow acceptance pending |
| 2 | Education System Configuration | Owner, Administrator | Workflow acceptance pending |
| 3 | Education Levels | Owner, Administrator | Workflow acceptance pending |
| 4 | Grade and Academic Level Configuration | Owner, Administrator | Workflow acceptance pending |
| 5 | Institution Settings | Owner, Administrator | Workflow acceptance pending |
| 6 | Campus Settings | Owner, Administrator | Workflow acceptance pending |
| 7 | Academic Settings | Owner, Administrator | Workflow acceptance pending |
| 8 | General System Settings | Owner, Administrator | Workflow acceptance pending |
| 9 | Invitations and Access | Owner, Administrator | Workflow acceptance pending |
| 10 | User Management | Owner, Administrator | Workflow acceptance pending |
| 11 | Role Management | Owner, Administrator | Workflow acceptance pending |
| 12 | User Permissions | Owner, Administrator | Workflow acceptance pending |
| 13 | Module Permissions | Owner, Administrator | Workflow acceptance pending |
| 14 | Approval Permissions | Owner, Administrator | Workflow acceptance pending |
| 15 | Security Configuration | Owner, Administrator | Workflow acceptance pending |

### 32. Financial Reconciliation and Audit (`reconciliation`)

**Role visibility:** Owner, Administrator, Accountant  
**Visible item counts:** Owner 13 · Administrator 13 · Accountant 13

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Reconciliation Dashboard | Owner, Administrator, Accountant | Workflow acceptance pending |
| 2 | Financial Reconciliation | Owner, Administrator, Accountant | Workflow acceptance pending |
| 3 | Bank Reconciliation | Owner, Administrator, Accountant | Workflow acceptance pending |
| 4 | Cash Reconciliation | Owner, Administrator, Accountant | Workflow acceptance pending |
| 5 | Payment Reconciliation | Owner, Administrator, Accountant | Workflow acceptance pending |
| 6 | Fee Collection Reconciliation | Owner, Administrator, Accountant | Workflow acceptance pending |
| 7 | Transaction Verification | Owner, Administrator, Accountant | Workflow acceptance pending |
| 8 | Audit Logs | Owner, Administrator, Accountant | Workflow acceptance pending |
| 9 | Administrative Audit | Owner, Administrator, Accountant | Workflow acceptance pending |
| 10 | User Activity Logs | Owner, Administrator, Accountant | Workflow acceptance pending |
| 11 | Access History | Owner, Administrator, Accountant | Workflow acceptance pending |
| 12 | Change History | Owner, Administrator, Accountant | Workflow acceptance pending |
| 13 | Audit Reports | Owner, Administrator, Accountant | Workflow acceptance pending |

### 33. Backup, Restore and Data Management (`backup`)

**Role visibility:** Owner, Administrator  
**Visible item counts:** Owner 13 · Administrator 13

| # | Submenu destination | Visible roles | Source audit status |
|---:|---|---|---|
| 1 | Backup Dashboard | Owner, Administrator | Explicitly unavailable |
| 2 | Create Backup | Owner, Administrator | Explicitly unavailable |
| 3 | Scheduled Cloud Backups | Owner, Administrator | Explicitly unavailable |
| 4 | Backup History | Owner, Administrator | Explicitly unavailable |
| 5 | Restore Data | Owner, Administrator | Explicitly unavailable |
| 6 | Data Recovery | Owner, Administrator | Explicitly unavailable |
| 7 | Import Data | Owner, Administrator | Explicitly unavailable |
| 8 | Export Data | Owner, Administrator | Explicitly unavailable |
| 9 | Bulk Data Import | Owner, Administrator | Explicitly unavailable |
| 10 | Data Validation | Owner, Administrator | Explicitly unavailable |
| 11 | Import History | Owner, Administrator | Explicitly unavailable |
| 12 | Export History | Owner, Administrator | Explicitly unavailable |
| 13 | Data Integrity Reports | Owner, Administrator | Explicitly unavailable |

## Route and acceptance notes

1. Composite `groupKey:itemSlug` is the authoritative route index key; this avoids collisions where menu groups reuse labels.
2. Menu visibility applies a group's declared roles, individual role allow-lists in selected groups, and role-specific dashboard exclusions.
3. Explicitly unavailable destinations are identified from resolver conditions. An item not labelled unavailable here is **not** certified as complete; it must pass an exact route-resolver test.
4. Some role-specific route guards may further restrict a destination even where a menu item is visible. Direct-link and API tests are required for each role.
5. Owner, Administrator, Teacher, Student, Parent, Accountant and Examination Officer views must be validated independently. UI filtering is not a substitute for RLS.

## Phase 1 acceptance checklist

- [ ] Execute the exact resolver for every role-visible group/item pair and record the resulting route string.
- [ ] Open every role-visible destination and identify dedicated, generic, linked, unavailable or broken workspace dispatch.
- [ ] Verify each direct URL and API call with allowed and denied roles.
- [ ] Confirm parent-to-student relationship scoping and prevent unrelated family access.
- [ ] Confirm tenant isolation for all record operations, exports and private files.
- [ ] Test create/read/update/delete or lifecycle-specific actions with refresh persistence.
- [ ] Record the evidence and unresolved issue for each destination before any module is called production-ready.
