export type WorkspaceRole = 'owner'|'admin'|'teacher'|'student'|'parent'|'accountant'|'exam_officer'
export interface WorkspaceMenuItem { key:string; label:string; description:string; route?:string }
export interface WorkspaceMenuGroup {
  key:string; label:string; description:string; icon:string; theme:string; dataModule:string;
  roles:WorkspaceRole[]; items:WorkspaceMenuItem[];
}
const all:WorkspaceRole[]=['owner','admin','teacher','student','parent','accountant','exam_officer']
const management:WorkspaceRole[]=['owner','admin']
const staff:WorkspaceRole[]=['owner','admin','teacher']
const academic:WorkspaceRole[]=['owner','admin','teacher','exam_officer']
const finance:WorkspaceRole[]=['owner','admin','accountant']
const family:WorkspaceRole[]=['owner','admin','teacher','student','parent']
const exams:WorkspaceRole[]=['owner','admin','teacher','exam_officer','student','parent']
const item=(label:string,description?:string,route?:string):WorkspaceMenuItem=>({
  key:label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),
  label,description:description??('Manage and review '+label.toLowerCase()+' using institution-scoped records.'),route
})
const group=(key:string,label:string,description:string,icon:string,theme:string,dataModule:string,roles:WorkspaceRole[],labels:string[])=>({
  key,label,description,icon,theme,dataModule,roles,items:labels.map(label=>item(label))
})

export const institutionalMenu:WorkspaceMenuGroup[]=[
 group('dashboard','Dashboard','Institution-wide live overview, date filters, approvals, calendar, alerts and verified KPIs.','LayoutDashboard','blue','',all,[
  'Institutional Overview','Academic Overview','Financial Overview','Attendance Overview','Student Performance','Student Behaviour','Employee Performance','Statistics and KPI Cards','Charts and Comparative Analytics','Calendar and Events','Notification Centre','Tasks and Reminders','Pending Approvals','Recent Activities','Institutional Alerts'
 ]),
 group('ai','AI Intelligence','Evidence-grounded assistance and explainable insights. Predictions must disclose source data, assumptions and uncertainty.','BrainCircuit','violet','ai',management,[
  'AI Assistant','Smart Reports','Student Performance Prediction','Student Analysis','Fee Collection Prediction','Examination Analysis','AI Timetable Suggestions','AI Question Generation','AI Document Assistant','AI Learning Recommendations','Academic Performance Insights','Attendance and Behaviour Insights','Institutional Intelligence'
 ]),
 group('administration','Administration','Governance, institutional structure, policies, approvals and access management.','Building2','slate','administration',management,[
  'Institute Profile','Campus and Branch Management','Academic Structure and Sections','Departments','Designations','Organizational Structure','System Configuration','Approval and Workflows','Policies and Rules','Administrative Audit','User Access and Invitations','Role and Permission Management','Institution Settings','Branding and Document Settings','Academic Configuration','Security and Access History'
 ]),
 group('academic-sessions','Academic Sessions','Academic years, terms, session activation, rollover and session history.','CalendarDays','blue','academic_setup',management,[
  'All Academic Sessions','Create Academic Session','Session Calendar','Session Start and End Dates','Active Session Management','Session-wise Student Records','Session-wise Examination Records','Session History','Session Reports'
 ]),
 group('classes-sections','Classes and Sections','Class structures, allocations, capacity, teacher assignment and learner progression.','School','cyan','academic_setup',management,[
  'All Classes','Add Class','Sections','Class Teachers','Class Allocation','Student Class Assignment','Class Capacity','Class Promotion History','Transfer History','Class History'
 ]),
 group('subjects','Subjects','Subject catalogue, allocation, teacher assignment, syllabus and performance.','BookOpen','teal','academic_setup',management,[
  'All Subjects','Add Subject','Subject Categories','Subject Allocation','Teacher Assignment','Class-wise Subjects','Subject Combinations','Subject Syllabus','Subject Performance','Subject-wise Reports'
 ]),
 group('students','Student Management','The central learner record, admissions, placements, connected family and longitudinal academic history.','GraduationCap','blue','students',family,[
  'Student Directory','New Admissions','Admission Applications','Student Profiles','Enrollment','Class and Section Assignments','Student Documentation','Student ID Cards','Promotion and Transfer','Student History','Alumni Records','Student Performance Charts','Student Reports','Student Data Export','Bulk Student Operations'
 ]),
 group('employees','Employees and Faculty','Teaching and non-teaching employee records, workload, leave, attendance and performance.','Users','emerald','employees',staff,[
  'Employee Directory','Add Employee','Teacher Records','Non-Teaching Staff','Employee Profiles','Department Allocation','Designations','Workload Allocation','Employee Documentation','Employee ID Cards','Employee History','Employee Performance','Employee Attendance','Employee Leave Management','Employee Reports'
 ]),
 group('accounts-finance','Accounts and Finance','General ledger, income, expenses, cash/bank books, vouchers and financial statements.','Calculator','amber','finance',finance,[
  'Accounts Dashboard','Chart of Accounts','Income','Expenses','Cash Book','Bank Book','Transactions','Vouchers','General Ledger','Financial Statements','Account Reconciliation','Financial Reports'
 ]),
 group('fees','Fees Management','Fee structures, invoices, discounts, scholarships, collection and receipts.','Wallet','amber','fees',finance.concat(['student','parent']),[
  'Fees Dashboard','Fee Structure','Fee Categories','Student Fee Assignment','Fee Invoices','Payment Collection','Online Payments','Partial Payments','Discounts','Scholarships','Outstanding Dues','Fee Refunds','Fee Receipts','Class-wise Collection Reports','Section-wise Collection Reports','Overall Collection Reports'
 ]),
 group('receivables','Accounts Receivable','Outstanding balances, ageing, follow-ups and collection forecasting from live invoice balances.','TrendingUp','orange','receivables',finance,[
  'Receivables Dashboard','Total Outstanding','Student-wise Receivables','Invoice-wise Receivables','Overdue Accounts','Ageing Analysis','Partial Payment Balances','Collection Follow-ups','Outstanding History','Receivable Reconciliation','Collection Forecasts','Receivables Reports'
 ]),
 group('payments','Payments and Collections','Cash/bank/online payment processing, verification, allocation, refunds and reconciliation.','Wallet','green','payments',finance,[
  'Payments Dashboard','Payment Collection','Online Payment Records','Cash Payments','Bank Payments','Partial Payments','Payment Verification','Payment Reconciliation','Refund Processing','Payment History','Failed and Pending Payments','Collection Reports'
 ]),
 group('receipts','Receipts','Receipt numbering, templates, generation, reprinting, verification and bulk issue.','FileText','indigo','receipts',finance,[
  'Receipt Dashboard','Generate Receipt','Fee Receipts','Payment Receipts','Receipt Templates','Receipt Numbering','Receipt Reprinting','Receipt Verification','Bulk Receipt Generation','Receipt History'
 ]),
 group('payroll','Salary and Payroll','Compensation setup, monthly payroll, allowances, deductions, advances, payslips and salary payment.','Banknote','emerald','payroll',finance,[
  'Payroll Dashboard','Salary Structure','Salary Components','Employee Salary Assignment','Monthly Payroll','Allowances','Deductions','Advances and Loans','Advance Recovery','Payslips','Salary Payments','Payroll Reports'
 ]),
 group('attendance','Attendance Management','Bulk class and staff registers, exception follow-up, leave, corrections and device-assisted attendance.','CalendarCheck','rose','attendance',staff.concat(['student','parent']),[
  'Attendance Dashboard','Student Attendance','Daily Attendance','Period-wise Attendance','Class-wise Attendance','Bulk Student Attendance','Faculty and Staff Attendance','Bulk Staff Attendance','Attendance Corrections','Leave Applications','Late Arrival','Early Departure','Attendance Calendar','Attendance Reports','Attendance History','Attendance Analytics','Attendance Alerts'
 ]),
 group('timetable','Timetable','Master and role-based schedules, teacher availability, room allocation, substitution and class coverage.','CalendarDays','cyan','timetable',academic.concat(['student','parent']),[
  'Timetable Dashboard','Master Timetable','Class Timetable','Teacher Timetable','Room Timetable','Period Timetable','Teacher Availability','Substitution Management','Timetable Conflicts','Timetable Publishing','Timetable History','Class Coverage','Engaged Classes'
 ]),
 group('teaching','Teaching, Homework and Assignments','Lesson delivery, homework, coursework, submissions, grading, teacher review and student feedback.','BookOpenCheck','violet','teaching',family,[
  'Teaching Dashboard','Homework','Create Assignment','Assignment Design and Management','Student Submissions','Teacher Review','Marks and Feedback','Teaching Materials','Lesson Plans','Homework Calendar','Pending Assignments','Pending Reviews','Assignment History','Assignment Reports','Downloadable Attachments'
 ]),
 group('behaviour','Behaviour and Skills','Positive recognition, safeguarding-aware behaviour logs, incidents, skills and competency tracking.','HeartHandshake','pink','behaviour',staff.concat(['student','parent']),[
  'Behaviour Dashboard','Behaviour Records','Positive Behaviour','Disciplinary Incidents','Rewards and Recognition','Warnings','Student Skills','Co-curricular Activities','Competency Tracking','Student Progress History','Behaviour Analytics','Downloadable Behaviour Reports'
 ]),
 group('communication','Communication and WhatsApp','Role-targeted notices, message templates, notification centre, delivery history and approved messaging integrations.','MessageSquare','sky','communication',all,[
  'Communication Dashboard','WhatsApp Integration','Individual Messages','Bulk Messages','Class-wise Messaging','Employee Notifications','Message Templates','Assignment Notifications','Email Notifications','Delivery History','Communication Logs','Notification Centre','Communication Reports'
 ]),
 group('question-bank','Question Bank and Question Papers','Structured question pools, review, paper design, randomized selection, configurable templates and version history.','FileQuestion','indigo','question_bank',exams,[
  'Question Bank Dashboard','Multiple-Choice Questions','Short Questions','Long Questions','Subject-wise Questions','Chapter-wise Questions','Difficulty Levels','Question Categories','Question Builder','Question Paper Designer','Paper Templates','Marks Distribution','Random Question Selection','Question Review','Question Bank Import and Export','Question Paper Download','Question Paper Version History'
 ]),
 group('examinations','Examinations and Results','Assessment scheduling, rooms, invigilation, marks moderation, result processing and publication.','ClipboardCheck','blue','examinations',exams,[
  'Examination Dashboard','Examination Progress','Examination Schedule','Examination Subjects','Examination Rooms','Invigilation Management','Marks Entry','Marks Verification','Grading System','Result Processing','Report Cards','Merit Lists','Result Publishing','Automatic Checking','Result Corrections','Examination History','Examination Reports'
 ]),
 group('class-tests','Class Tests','Short-cycle assessment scheduling, online/written formats, marks and performance history.','ListChecks','violet','tests',exams,[
  'Class Test Dashboard','Create Class Tests','Test Schedule','Online Tests','Written Tests','Test Questions','Marks Entry','Test Results','Performance Analysis','Test Reports','Student-wise Test History'
 ]),
 group('reports','Reports and Analytics','Role-scoped live reports, custom builders, comparisons, scheduled runs and export history.','BarChart3','blue','reports',management.concat(['teacher','accountant','exam_officer']),[
  'Reports Dashboard','Student Reports','Employee Reports','Attendance Reports','Examination Reports','Academic Reports','Fee Reports','Payroll Reports','Financial Reports','Class Reports','Comparative Analytics','Custom Report Builder','Scheduled Reports','Report Templates','Report History'
 ]),
 group('certificates','Certificates and Documentation','Template-driven institutional documents, certificates, ID cards, signatures, serial numbers and verification.','Award','gold','certificates',management.concat(['teacher','student','parent']),[
  'Certificate Dashboard','Character Certificate','Leaving Certificate','Enrollment Certificate','Bonafide Certificate','Achievement Certificate','Experience Certificate','ID Card Designer','Certificate Templates','Editable Document Templates','Bulk Certificate Generation','Certificate Verification','Certificate History'
 ]),
 group('curriculum','Curriculum and Learning Resources','Curriculum maps, syllabus, outcomes, teaching resources, chapter materials and progress analytics.','BookOpen','teal','curriculum',family,[
  'Curriculum Dashboard','Curriculum Map','Syllabus Management','Learning Outcomes','Lesson Plans','Teaching Resources','Learning Materials','Resource Downloads','Subject-wise Curriculum','Chapter-wise Learning Resources','Curriculum Coverage','Learning Progress Tracking','Curriculum Reports'
 ]),
 group('library','Digital Library','Catalogue, book inventory, member reading records, circulation, returns, fines and reports.','Library','indigo','library',family,[
  'Library Dashboard','Digital Library','Book Management','Book Catalogue','Book Categories','Book Registration','Reading Records','Reading Cards','Student Reading History','Book Issue and Returns','Learning Materials','Resource Downloads','Library Reports'
 ]),
 group('transport','Transport Management','Vehicles, drivers, route stops, student allocations, transport attendance, fees and maintenance.','Database','orange','transport',management.concat(['teacher','student','parent','accountant']),[
  'Transport Dashboard','Vehicle Management','Drivers Management','Transport Routes','Route Stops','Student Transport Allocation','Transport Fees','Transport Assignments','Vehicle Maintenance','Transport Attendance','Transport History','Transport Reports'
 ]),
 group('inventory','Inventory Management','Item catalogue, suppliers, procurement, stock-in/out, allocation, adjustments and stock audit.','Database','amber','inventory',management.concat(['accountant']),[
  'Inventory Dashboard','Items Management','Item Catalogue','Item Categories','Stock In','Stock Out','Suppliers','Purchase Records','Stock Allocation','Stock Adjustments','Inventory History','Stock Reports'
 ]),
 group('facilities','Rooms and Facilities','Classrooms, specialist rooms, availability, reservations, maintenance and facility history.','DoorOpen','cyan','facilities',management.concat(['teacher']),[
  'Facilities Dashboard','Classroom Management','Laboratories','Library Rooms','Room Allocation','Room Availability','Room Reservations','Facility Maintenance','Facility History','Facilities Reports'
 ]),
 group('visitors','Visitor Management','Visitor registration, passes, approvals, entry/exit records, notifications and history.','UserRound','slate','visitors',management.concat(['teacher']),[
  'Visitor Dashboard','Visitor Registration','Visitor Information','Visitor Passes','Entry and Exit Records','Visitor Approvals','Visit History','Visitor Notifications','Visitor Reports'
 ]),
 group('institution-config','Institutional Systems and Configuration','Education levels, institution/campus settings, invitations, role rights, module rights and security.','Settings','slate','institution_config',management,[
  'Institution Configuration','Education System Configuration','Education Levels','Grade and Academic Level Configuration','Institution Settings','Campus Settings','Academic Settings','General System Settings','Invitations and Access','User Management','Role Management','User Permissions','Module Permissions','Approval Permissions','Security Configuration'
 ]),
 group('reconciliation','Financial Reconciliation and Audit','Bank/cash/payment reconciliation, verification, immutable audit logs and access/change history.','ShieldCheck','red','reconciliation',finance,[
  'Reconciliation Dashboard','Financial Reconciliation','Bank Reconciliation','Cash Reconciliation','Payment Reconciliation','Fee Collection Reconciliation','Transaction Verification','Audit Logs','Administrative Audit','User Activity Logs','Access History','Change History','Audit Reports'
 ]),
 group('backup','Backup, Restore and Data Management','Validated import/export jobs, backup request history, restore approvals and integrity reporting.','Database','slate','backup',management,[
  'Backup Dashboard','Create Backup','Scheduled Cloud Backups','Backup History','Restore Data','Data Recovery','Import Data','Export Data','Bulk Data Import','Data Validation','Import History','Export History','Data Integrity Reports'
 ]),
]

export function getWorkspaceGroup(key:string){return institutionalMenu.find(group=>group.key===key)}
export function getWorkspaceItem(groupKey:string,itemKey:string){return getWorkspaceGroup(groupKey)?.items.find(item=>item.key===itemKey)}
export const institutionalRoute = (groupKey:string,itemKey:string) => 'institutional:'+groupKey+':'+itemKey

export const existingRouteOverrides:Record<string,string>={
 'dashboard:institutional-overview':'overview',
 'dashboard:academic-overview':'reports',
 'dashboard:financial-overview':'fees',
 'dashboard:attendance-overview':'attendance:students',
 'dashboard:student-performance':'exam_results',
 'dashboard:student-behaviour':'institutional:behaviour:behaviour-records',
 'dashboard:employee-performance':'institutional:employees:employee-performance',
 'dashboard:statistics-and-kpi-cards':'overview',
 'dashboard:charts-and-comparative-analytics':'reports',
 'dashboard:calendar-and-events':'institutional:communication:delivery-history',
 'dashboard:notification-centre':'notifications',
 'dashboard:tasks-and-reminders':'work_tasks',
 'dashboard:pending-approvals':'institutional:administration:approval-and-workflows',
 'dashboard:recent-activities':'institutional:administration:administrative-audit',
 'dashboard:institutional-alerts':'institutional:administration:security-and-access-history',
 'students:student-directory':'students:directory',
 'students:student-profiles':'students:profile',
 'students:new-admissions':'students:admissions',
 'students:admission-applications':'students:admissions',
 'students:enrollment':'students:admissions',
 'students:class-and-section-assignments':'students:classes',
 'students:student-attendance':'students:attendance',
 'students:student-exam-results':'students:results',
 'students:student-assignments':'students:assignments',
 'students:student-timetable':'students:timetable',
 'students:student-documentation':'students:documents',
 'students:student-history':'students:history',
 'employees:employee-directory':'teachers',
 'employees:teacher-records':'teachers',
 'fees:fee-invoices':'fees',
 'payments:payment-collection':'fees',
 'attendance:attendance-dashboard':'attendance:students',
 'attendance:student-attendance':'attendance:students',
 'attendance:daily-attendance':'attendance:students',
 'attendance:period-wise-attendance':'attendance:students',
 'attendance:class-wise-attendance':'attendance:students',
 'attendance:bulk-student-attendance':'attendance:students',
 'attendance:faculty-and-staff-attendance':'attendance:staff',
 'attendance:attendance-corrections':'attendance:students',
 'attendance:leave-applications':'attendance:staff',
 'attendance:late-arrival':'attendance:students',
 'attendance:early-departure':'attendance:staff',
 'attendance:attendance-calendar':'attendance:students',
 'attendance:attendance-reports':'reports',
 'attendance:attendance-history':'attendance:history',
 'attendance:attendance-analytics':'reports',
 'attendance:bulk-staff-attendance':'attendance:staff',
 'timetable:master-timetable':'timetable',
 'teaching:homework':'assignments',
 'teaching:create-assignment':'assignments',
 'teaching:student-submissions':'assignment_submissions',
 'teaching:teacher-review':'assignment_submissions',
 'communication:communication-dashboard':'announcements',
 'communication:notification-centre':'announcements',
 'examinations:examination-dashboard':'exams',
 'examinations:marks-entry':'exam_results',
 'examinations:report-cards':'exam_results',
 'reports:reports-dashboard':'reports',
 'reports:student-reports':'reports',
 'reports:attendance-reports':'reports',
}
