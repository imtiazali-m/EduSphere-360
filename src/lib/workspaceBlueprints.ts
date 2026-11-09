export interface WorkspaceSubwindow {
  key: string
  label: string
  description: string
  filter: string
}
export interface WorkspaceWindow {
  key: string
  label: string
  description: string
  subwindows: WorkspaceSubwindow[]
}
export interface WorkspaceBlueprint {
  label: string
  description: string
  defaultWindow: string
  windows: WorkspaceWindow[]
}
const option = (key: string, label: string, description: string, filter = key): WorkspaceSubwindow => ({ key, label, description, filter })
const window = (key: string, label: string, description: string, subwindows: WorkspaceSubwindow[]): WorkspaceWindow => ({ key, label, description, subwindows })

export const workspaceBlueprints: Record<string, WorkspaceBlueprint> = {
  attendance: {
    label: 'Attendance Registration',
    description: 'Daily roll-call, absence follow-up and attendance quality control.',
    defaultWindow: 'daily-register',
    windows: [
      window('overview','Attendance overview','Daily participation, class coverage and attendance exceptions.',[option('all','All records','Every attendance entry.','all'),option('today','Today','Records for the current date.'),option('this-month','This month','Attendance captured in the current month.')]),
      window('daily-register','Daily register','Record and correct attendance by learner and class.',[option('all','Full register','All recorded attendance.','all'),option('present','Present','Learners marked present.'),option('late','Late arrivals','Learners arriving late.'),option('absent','Absent','Learners marked absent.')]),
      window('exceptions','Exceptions & follow-up','Focus on absence, lateness and excused attendance that needs attention.',[option('absent','Absence follow-up','Absent learners.'),option('late','Late arrivals','Late learners.'),option('excused','Excused','Approved or excused absences.'),option('unreviewed','Needs review','Records with no follow-up note.')]),
      window('class-register','Class registers','Review the roll by class and programme.',[option('all','All classes','All class attendance.','all'),option('today','Today','Today’s class registers.'),option('this-month','Monthly view','This month’s class attendance.')]),
      window('trends','Attendance trends','Compare daily and monthly participation patterns.',[option('this-month','This month','Current-month attendance.'),option('all','Full history','All available dates.','all')]),
    ],
  },
  exams: {
    label: 'Examination',
    description: 'Exam planning, schedules, assessment readiness and controlled publication.',
    defaultWindow: 'exam-calendar',
    windows: [
      window('overview','Examination overview','Upcoming assessments, readiness and outstanding exam tasks.',[option('all','All examinations','Every examination.','all'),option('upcoming','Upcoming','Scheduled assessments in the future.'),option('completed','Completed','Assessments already completed.')]),
      window('exam-calendar','Exam calendar','Plan examination dates, sessions and rooms.',[option('all','All schedules','All scheduled examinations.','all'),option('upcoming','Upcoming','Future examinations.'),option('today','Today','Examinations scheduled today.')]),
      window('assessment-design','Assessment design','Manage assessment types, subjects and class coverage.',[option('all','All assessments','All exam records.','all'),option('draft','Draft plans','Assessments being prepared.'),option('published','Published schedules','Released exam schedules.')]),
      window('readiness','Readiness & moderation','Review marks readiness and pending checks before release.',[option('pending','Pending review','Records still awaiting review.'),option('draft','Draft','Unpublished exam work.'),option('all','All records','Every examination record.','all')]),
      window('rooms','Room & session plan','Check examination rooms, session times and allocation.',[option('all','All room plans','Every exam room allocation.','all'),option('today','Today','Today’s room plan.'),option('upcoming','Upcoming','Future room plans.')]),
    ],
  },
  exam_results: {
    label: 'Exam Results',
    description: 'Marks entry, moderation, result publication and academic analysis.',
    defaultWindow: 'results-register',
    windows: [
      window('overview','Results overview','Publication status, grade outcomes and result completeness.',[option('all','All results','All result records.','all'),option('published','Published','Released results.'),option('draft','Draft results','Unpublished marks.')]),
      window('results-register','Marks register','Review subject and student marks entered for each assessment.',[option('all','All marks','All mark records.','all'),option('draft','Draft','Marks not yet published.'),option('published','Published','Released results.')]),
      window('moderation','Moderation queue','Check marks, grading and result corrections.',[option('pending','Needs moderation','Results awaiting review.'),option('draft','Draft','Unpublished marks.'),option('all','All records','Every result record.','all')]),
      window('publication','Publication centre','Release approved results and review already published results.',[option('published','Published results','Released results.'),option('draft','Awaiting publication','Draft results not yet released.'),option('all','All results','All result records.','all')]),
      window('grade-analysis','Grade analysis','Compare grades and learner performance by assessment.',[option('published','Published only','Use only released results.'),option('all','All results','All visible results.','all')]),
    ],
  },
  assignments: {
    label: 'Assignments',
    description: 'Coursework design, deadlines, class allocation and progress tracking.',
    defaultWindow: 'coursework-board',
    windows: [
      window('overview','Coursework overview','Open work, deadlines and class-level assignment coverage.',[option('all','All coursework','All assignments.','all'),option('open','Open','Accepting submissions.'),option('overdue','Past deadline','Assignments whose due date has passed.')]),
      window('coursework-board','Coursework board','Create and organise work by class, subject and due date.',[option('all','All assignments','All coursework.','all'),option('open','Open','Currently open.'),option('closed','Closed','No longer accepting work.')]),
      window('deadlines','Deadline planner','Track due dates and identify late or upcoming work.',[option('upcoming','Upcoming','Due in the future.'),option('overdue','Overdue','Past-due assignments.'),option('all','All deadlines','All assignment deadlines.','all')]),
      window('class-allocation','Class allocation','Review work assigned to each class and subject.',[option('all','All classes','All assignments.','all'),option('open','Open work','Open assignments.'),option('completed','Completed','Closed or completed work.')]),
      window('progress','Submission progress','Compare submission and marking progress for coursework.',[option('all','All assignments','All coursework.','all'),option('open','Awaiting submissions','Open work.'),option('completed','Completed','Closed assignments.')]),
    ],
  },
  assignment_submissions: {
    label: 'Assignment Submission',
    description: 'Learner submission intake, teacher review, grading and return of work.',
    defaultWindow: 'submission-inbox',
    windows: [
      window('overview','Submission overview','Inbox volume, pending marking and returned coursework.',[option('all','All submissions','Every submission.','all'),option('submitted','New submissions','Awaiting review.'),option('graded','Graded','Marked submissions.')]),
      window('submission-inbox','Submission inbox','Review all learner submissions and attached work.',[option('all','All submissions','Every submission.','all'),option('submitted','New','Awaiting review.'),option('late','Late','Submitted after the deadline.')]),
      window('review-queue','Review queue','Prioritise work awaiting marks and feedback.',[option('submitted','Awaiting marking','New submissions.'),option('late','Late submissions','Late work awaiting review.'),option('all','All open work','All submissions.','all')]),
      window('graded-work','Graded work','Review marks and grading decisions already recorded.',[option('graded','Graded','Marked work.'),option('all','All submissions','Every submission.','all')]),
      window('returned-work','Returned to learners','Track work returned for correction or resubmission.',[option('returned','Returned','Work returned to learners.'),option('all','All submissions','Every submission.','all')]),
    ],
  },
  timetable: {
    label: 'Timetable',
    description: 'Weekly teaching schedules, room usage and timetable coordination.',
    defaultWindow: 'weekly-grid',
    windows: [
      window('overview','Timetable overview','Teaching periods, class coverage and room utilisation.',[option('all','All periods','Every timetable entry.','all'),option('today','Today','Today’s schedule.'),option('this-week','This week','Current week entries.')]),
      window('weekly-grid','Weekly timetable','Read the timetable by day, class and subject.',[option('all','All classes','All timetable entries.','all'),option('today','Today','Today’s periods.'),option('morning','Morning periods','Periods before midday.'),option('afternoon','Afternoon periods','Midday and later periods.')]),
      window('class-schedule','Class schedules','View one class schedule and its subject periods.',[option('all','All class periods','All entries.','all'),option('morning','Morning','Morning periods.'),option('afternoon','Afternoon','Afternoon periods.')]),
      window('teacher-schedule','Teacher schedules','Review teacher allocations and timetable coverage.',[option('all','All teacher periods','All entries.','all'),option('today','Today','Today’s teaching periods.')]),
      window('room-allocation','Room allocation','Monitor room occupancy and room assignments.',[option('all','All rooms','All entries.','all'),option('today','Today','Today’s room bookings.')]),
      window('conflicts','Conflict review','Locate schedule entries requiring timetable correction.',[option('unassigned','Missing allocation','Entries without a room or teacher.'),option('all','All entries','All timetable entries.','all')]),
    ],
  },
  fees: {
    label: 'Fees Invoices',
    description: 'Receivables, payment collection, outstanding balances and family follow-up.',
    defaultWindow: 'receivables-overview',
    windows: [
      window('receivables-overview','Receivables overview','Invoice totals, collected amounts and outstanding balances.',[option('all','All invoices','Every invoice.','all'),option('unpaid','Unpaid','No payment received.'),option('partial','Partially paid','Invoices with a remaining balance.'),option('overdue','Overdue','Past-due balances.')]),
      window('invoice-register','Invoice register','Issue, review and maintain fee invoices.',[option('all','All invoices','Every invoice.','all'),option('unpaid','Unpaid','Awaiting payment.'),option('paid','Paid','Fully settled invoices.')]),
      window('overdue-follow-up','Overdue follow-up','Prioritise overdue accounts and outstanding family balances.',[option('overdue','Overdue','Past-due balances.'),option('partial','Partially paid','Part-settled balances.'),option('unpaid','Unpaid','No payment recorded.')]),
      window('collections','Payment collections','Record incoming payments and reconcile outstanding invoices.',[option('all','All invoices','Every invoice.','all'),option('partial','Partially paid','Part-settled balances.'),option('paid','Paid','Settled invoices.')]),
      window('concessions','Adjustments & concessions','Review invoice adjustments, fines and discounts.',[option('all','All invoices','Every invoice.','all'),option('partial','Outstanding after adjustment','Invoices that still have a balance.')]),
      window('receipts','Receipt history','Review invoices and the payment history attached to each record.',[option('paid','Settled','Fully paid invoices.'),option('partial','Part-settled','Partially paid invoices.'),option('all','All invoice history','All invoices.','all')]),
    ],
  },
  announcements: {
    label: 'Announcements',
    description: 'Institution notices, audience selection, publishing and archive management.',
    defaultWindow: 'notice-board',
    windows: [
      window('overview','Communication overview','Recent notices and the status of institution communication.',[option('all','All notices','Every announcement.','all'),option('published','Published','Visible notices.'),option('draft','Draft','Unpublished notices.')]),
      window('notice-board','Notice board','Browse notices shared with the current audience.',[option('published','Published','Released notices.'),option('all','All notices','All announcements.','all')]),
      window('compose','Compose & schedule','Create a new institutional notice or schedule its release.',[option('draft','Drafts','Unpublished notices.'),option('all','All notices','All announcements.','all')]),
      window('audience','Audience delivery','Review notices by staff, learner, guardian or institution audience.',[option('all','All audiences','All notices.','all'),option('published','Delivered notices','Published notices.')]),
      window('archive','Communication archive','Find previous notices and older institutional updates.',[option('all','Full archive','All notices.','all'),option('draft','Unpublished','Draft notices.')]),
    ],
  },
  work_tasks: {
    label: 'Work Management',
    description: 'Institution task allocation, personal work queues, progress review and completion.',
    defaultWindow: 'task-board',
    windows: [
      window('overview','Work overview','Assigned work, approaching deadlines and team progress.',[option('all','All tasks','All work tasks.','all'),option('mine','Assigned to me','Tasks assigned to your account.'),option('overdue','Overdue','Tasks past deadline.')]),
      window('task-board','Task board','Organise tasks by owner, priority and status.',[option('all','All tasks','Every task.','all'),option('open','Open','Work still in progress.'),option('completed','Completed','Finished tasks.')]),
      window('my-queue','My work queue','Prioritise tasks assigned to your account.',[option('mine','Assigned to me','Your assigned tasks.'),option('overdue','Overdue','Past-due work.'),option('all','All tasks','All permitted tasks.','all')]),
      window('review-queue','Review & approvals','Review work requiring administrator action.',[option('pending','Pending','Awaiting action.'),option('all','All tasks','All permitted tasks.','all')]),
      window('completed','Completed work','Review tasks marked complete.',[option('completed','Completed','Finished tasks.'),option('all','All tasks','All tasks.','all')]),
      window('workload','Workload analysis','Compare tasks by owner, due date and progress.',[option('all','All tasks','All permitted tasks.','all'),option('mine','My assignments','Tasks assigned to you.')]),
    ],
  },
  files: {
    label: 'Files & Documentation',
    description: 'Private institution file storage, document browsing and file activity.',
    defaultWindow: 'document-library',
    windows: [
      window('overview','Storage overview','File counts, storage usage and available document categories.',[option('all','All files','All files.','all'),option('recent','Recently added','Files uploaded recently.'),option('large','Large files','Files larger than one megabyte.')]),
      window('document-library','Document library','Browse PDFs, office documents and text records.',[option('all','All documents','All document files.','all'),option('recent','Recent documents','Recently uploaded documents.')]),
      window('image-library','Image library','Browse image records stored in institution storage.',[option('all','All images','All image files.','all'),option('recent','Recent images','Recently uploaded images.')]),
      window('shared-resources','Learning resources','Browse learning and operational files.',[option('all','All resources','All files.','all'),option('recent','Recently uploaded','New resources.')]),
      window('storage-review','Storage review','Inspect file size and storage hygiene.',[option('large','Large files','Files larger than one megabyte.'),option('all','All files','All files.','all')]),
    ],
  },
  accounts: {
    label: 'User Account',
    description: 'Institution account provisioning, learner links and role access control.',
    defaultWindow: 'account-directory',
    windows: [
      window('overview','Access overview','Account totals, active access and role distribution.',[option('all','All accounts','All accounts.','all'),option('active','Active accounts','Enabled sign-ins.'),option('inactive','Inactive accounts','Disabled accounts.')]),
      window('account-directory','Account directory','Search existing institution sign-in accounts.',[option('all','All accounts','All accounts.','all'),option('active','Active','Enabled accounts.'),option('inactive','Inactive','Disabled accounts.')]),
      window('provision','Provision account','Create an institution-managed sign-in and assign its role.',[option('all','Provisioning','Account creation workflow.','all')]),
      window('learner-links','Student & parent links','Review portal accounts linked to student records.',[option('all','All linked portals','All accounts.','all'),option('student','Student portals','Student accounts.'),option('parent','Parent portals','Parent accounts.'),option('unlinked','Unlinked','Accounts not linked to a student.')]),
      window('role-distribution','Role distribution','Review institution account coverage by role.',[option('all','All roles','All account roles.','all'),option('owner','Owners & administrators','Administrative access.'),option('teacher','Employees','Employee accounts.'),option('student','Students','Student accounts.'),option('parent','Parents','Parent accounts.')]),
    ],
  },
  reports: {
    label: 'Reports',
    description: 'Institution analytics, people reports, academic outcomes and finance reporting.',
    defaultWindow: 'institution-overview',
    windows: [
      window('institution-overview','Institution overview','A consolidated picture of institution operations.',[option('all','All permitted reports','All available report data.','all')]),
      window('people-attendance','People & attendance','Enrolment, attendance coverage and student status reports.',[option('all','All records','All permitted people reports.','all'),option('active','Active learners','Active student records.'),option('absent','Absence records','Absent attendance entries.')]),
      window('learning-outcomes','Learning outcomes','Published results, grade distribution and academic outcomes.',[option('published','Published outcomes','Published examination results.'),option('draft','Draft results','Unpublished results (staff roles only).'),option('all','All permitted results','All permitted results.','all')]),
      window('finance-collections','Finance & collections','Invoice, receipt and outstanding balance reports.',[option('all','All invoices','All invoices.','all'),option('paid','Collected','Paid invoices.'),option('overdue','Outstanding / overdue','Overdue balances.')]),
      window('export-centre','Export centre','Prepare CSV extracts for the records available to your role.',[option('all','All exportable data','All permitted report data.','all')]),
    ],
  },
  profile: {
    label: 'My Profile',
    description: 'Read-only learner and family information linked to the signed-in account.',
    defaultWindow: 'identity',
    windows: [
      window('identity','Personal identity','Read-only identity and contact information.',[option('all','Identity details','Your permitted profile details.','all')]),
      window('academic-record','Academic record','Current class, admission status and learning progress.',[option('all','Academic details','Your permitted academic record.','all')]),
      window('family-contacts','Family contacts','Linked guardian and student relationships.',[option('all','Linked contacts','Contacts linked to your account.','all')]),
    ],
  },
  'admin:departments': {
    label:'Departments',description:'Department structure, assigned programmes and staffing.',defaultWindow:'department-register',
    windows:[window('department-register','Department register','Institution-wide department records.',[option('all','All departments','All records.','all'),option('active','Active','Active departments.'),option('inactive','Inactive','Inactive departments.')]),window('programme-links','Programme relationships','Programmes connected to each department.',[option('all','All links','All department records.','all'),option('unassigned','No programmes','Departments without linked programmes.')]),window('staffing','Staffing overview','Review faculty distribution across departments.',[option('all','All departments','All department records.','all'),option('unassigned','No staff assigned','Departments without linked staff.')])],
  },
  'admin:programs': {
    label:'Programs',description:'Programme catalogue, department ownership and class coverage.',defaultWindow:'programme-register',
    windows:[window('programme-register','Programme register','Maintain the institution programme catalogue.',[option('all','All programmes','All records.','all'),option('active','Active','Active programmes.')]),window('department-map','Department map','Review department ownership and programme grouping.',[option('all','All programmes','All records.','all'),option('unassigned','Unassigned','Programmes without a department.')]),window('class-coverage','Class coverage','Review class sections linked to programmes.',[option('all','All programmes','All records.','all'),option('unassigned','No class sections','Programmes without class links.')])],
  },
  'admin:classes': {
    label:'Class Sections',description:'Class configuration, capacity and student allocation.',defaultWindow:'class-register',
    windows:[window('class-register','Class register','Configured class and section records.',[option('all','All classes','All records.','all'),option('active','Active','Active classes.')]),window('capacity','Capacity planning','Review student capacity and available seats.',[option('all','All classes','All records.','all'),option('unassigned','Capacity not set','Classes without capacity.')]),window('enrolment','Enrolment coverage','Review student records mapped to classes.',[option('all','All classes','All records.','all'),option('unassigned','No learners','Classes without enrolled learner records.')])],
  },
  'admin:academic_sessions': {
    label:'Academic Sessions',description:'Academic calendar periods, current session and class relationships.',defaultWindow:'session-register',
    windows:[window('session-register','Session register','Manage academic session dates and status.',[option('all','All sessions','All records.','all'),option('current','Current session','Sessions marked current.')]),window('calendar','Academic calendar','Review start and end dates for each session.',[option('all','All dates','All session records.','all'),option('current','Current','Current session.')]),window('class-links','Class relationships','Classes assigned to each academic session.',[option('all','All sessions','All records.','all'),option('unassigned','No classes','Sessions without linked classes.')])],
  },
  'admin:subjects': {
    label:'Subjects',description:'Subject catalogue, department links and academic classification.',defaultWindow:'subject-register',
    windows:[window('subject-register','Subject register','Maintain the subject catalogue.',[option('all','All subjects','All records.','all'),option('active','Active','Active subjects.')]),window('classification','Subject classification','Review core, elective and practical subjects.',[option('core','Core','Core subjects.'),option('elective','Elective','Elective subjects.'),option('practical','Practical','Practical subjects.'),option('all','All types','All subjects.','all')]),window('department-map','Department ownership','Review subject ownership by department.',[option('all','All subjects','All records.','all'),option('unassigned','Unassigned','Subjects without a department.')])],
  },
  'admin:rooms': {
    label:'Rooms & Facilities',description:'Facility register, room capacity and timetable utilisation.',defaultWindow:'facility-register',
    windows:[window('facility-register','Facility register','Manage rooms, labs and other facilities.',[option('all','All facilities','All records.','all'),option('active','Active','Active facilities.')]),window('capacity','Capacity planning','Review room capacity and usage readiness.',[option('all','All facilities','All records.','all'),option('unassigned','Capacity not set','Facilities without capacity.')]),window('utilisation','Timetable utilisation','Review rooms currently used by timetable entries.',[option('all','All facilities','All records.','all'),option('unassigned','Not scheduled','Rooms without timetable allocation.')])],
  },
}
const all = option('all','All records','All records visible to your account.','all')
export function getWorkspaceBlueprint(routeKey: string): WorkspaceBlueprint {
  return workspaceBlueprints[routeKey] ?? {
    label: routeKey.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()),
    description:'Institution records, daily operations and related tasks.',
    defaultWindow:'overview',
    windows:[window('overview','Overview','Review this workspace.',[all]),window('register','Register','Create and maintain records.',[all]),window('follow-up','Follow-up','Review records that need attention.',[option('pending','Pending','Pending records.'),all])],
  }
}
export function getStudentSubwindows(windowKey: string, role: string): WorkspaceSubwindow[] {
  const map: Record<string, WorkspaceSubwindow[]> = {
    overview:[option('summary','Summary','Key learner lifecycle totals.','all'),option('admissions','Admission activity','Application and enrolment activity.','pending'),option('learning','Learning activity','Attendance, results and submissions.','all'),option('family','Family connections','Guardian relationship activity.','linked')],
    admissions:[option('submitted','Submitted','Applications awaiting initial review.'),option('under_review','Under review','Applications under assessment.'),option('documents_required','Documents required','Applications awaiting documents.'),option('approved','Approved','Approved candidates awaiting enrolment.'),option('enrolled','Enrolled','Completed enrolments.'),option('rejected','Rejected','Rejected applications.')],
    directory:[option('all','All students','Full student directory.','all'),option('active','Active','Currently enrolled learners.'),option('pending','Pending','Pending registrations.'),option('graduated','Graduated','Graduated learners.'),option('inactive','Inactive','Inactive learner records.'),option('unassigned','No class','Learners without a class.')],
    profile:[option('identity','Identity','Personal and contact details.','all'),option('academic','Academic','Admission, class and session details.','all'),option('family','Family','Linked guardian contacts.','all'),option('activity','Activity','Related learner activity.','all')],
    classes:[option('current','Current placement','Current active assignment.'),option('history','Transfer history','Previous placements.','all'),option('unassigned','Unassigned','Learners without an active placement.')],
    guardians:[option('linked','Linked contacts','Guardian contacts linked to the student.'),option('available','Available contacts','Existing contacts not yet linked.','unlinked')],
    attendance:[option('all','All attendance','All attendance entries.','all'),option('present','Present','Present sessions.'),option('late','Late','Late arrivals.'),option('absent','Absent','Absence records.'),option('excused','Excused','Excused absences.')],
    results:[option('published','Published','Released examination results.'),option('draft','Draft / moderation','Unpublished staff results.'),option('by-subject','By subject','Result records grouped by subject.','all'),option('by-exam','By examination','Results grouped by examination.','all')],
    assignments:[option('open','Open work','Assignments accepting submissions.'),option('overdue','Past due','Assignments past their due date.'),option('submitted','Submitted work','Submissions awaiting review.'),option('graded','Graded work','Marked submissions.')],
    timetable:[option('all','Full week','All timetable periods.','all'),option('today','Today','Today’s scheduled periods.'),option('morning','Morning','Morning periods.'),option('afternoon','Afternoon','Afternoon periods.')],
    documents:[option('all','All documents','All linked documents.','all'),option('pending','Pending verification','Documents awaiting review.'),option('verified','Verified','Verified documents.'),option('rejected','Rejected','Rejected documents.')],
    history:[option('all','Full timeline','All audit events.','all'),option('admissions','Admissions','Admission and registration events.'),option('academic','Academic','Attendance, results and assignments.'),option('family','Family','Guardian link events.'),option('documents','Documents','Document upload and verification events.')],
  }
  const items = map[windowKey] ?? [all]
  if (['student','parent'].includes(role) && windowKey === 'results') return items.filter(item => item.key !== 'draft')
  return items
}
export function getFacultySubwindows(tab: string, admin: boolean): WorkspaceSubwindow[] {
  const map: Record<string, WorkspaceSubwindow[]> = {
    overview:[option('summary','Summary','Workforce status and key staff metrics.','all'),option('recent','Recent activity','Recently recorded staff events.','recent'),option('operations','Operations','Quick access to staff processes.','all')],
    registration:[option('new','New registration','Create a staff profile.','all'),option('linked','Account linked','Profiles linked to a sign-in account.','linked'),option('unlinked','No account link','Profiles without a linked login.','unlinked')],
    directory:[option('all','All employees','Institution employee register.','all'),option('active','Active','Active staff.'),option('on_leave','On leave','Employees currently on leave.'),option('inactive','Inactive','Inactive staff.'),option('teaching','Teaching','Teaching employees.'),option('non_teaching','Non-teaching','Non-teaching employees.')],
    profile:[option('identity','Identity','Employee identity and contacts.','all'),option('employment','Employment','Employment details and designation.','all'),option('emergency','Emergency contact','Emergency contact details.','all')],
    departments:[option('all','All departments','Department staffing.','all'),option('staffed','Staffed','Departments with assigned employees.'),option('unassigned','No staff','Departments without staff.')],
    designations:[option('all','All designations','Designation register.','all'),option('active','Active','Active designations.'),option('inactive','Inactive','Inactive designations.')],
    assignments:[option('all','All assignments','Teaching allocations.','all'),option('active','Active','Current allocations.'),option('completed','Completed','Completed allocations.'),option('cancelled','Cancelled','Cancelled allocations.')],
    attendance:[option('all','All attendance','All attendance records.','all'),option('today','Today','Today’s attendance.'),option('present','Present','Present employees.'),option('absent','Absent','Absent employees.'),option('late','Late','Late arrivals.'),option('this-month','This month','Attendance this month.')],
    leave:[option('all','All requests','All leave requests.','all'),option('pending','Pending review','Awaiting decision.'),option('approved','Approved','Approved leave.'),option('rejected','Rejected','Rejected requests.'),option('cancelled','Cancelled','Cancelled requests.')],
    workload:[option('allocations','Teaching allocations','Teaching assignments.','all'),option('timetable','Timetable periods','Actual scheduled periods.','all'),option('high-load','High workload','Employees with substantial weekly allocations.'),option('no-allocation','No allocation','Teaching staff without active allocations.')],
    documents:[option('all','All documents','Staff document register.','all'),option('recent','Recently uploaded','Documents uploaded recently.'),option('expiring','Expiring soon','Documents due to expire soon.'),option('expired','Expired','Documents past expiry.')],
    history:[option('all','All events','Full employment history.','all'),option('registration','Registration','Employee registration events.'),option('profile_updates','Profile changes','Employment profile updates.')],
    reports:[option('all','All report measures','Full HR report.','all'),option('teaching','Teaching staff','Teaching employees.'),option('non_teaching','Non-teaching','Non-teaching employees.')],
  }
  const result = map[tab] ?? [all]
  return admin ? result : result.filter(item => !['registration','departments','designations','reports'].includes(item.key))
}
export function getAdminSubwindows(key: string): WorkspaceSubwindow[] {
  return getWorkspaceBlueprint('admin:'+key).windows[0]?.subwindows ?? [all]
}
export function matchesWorkspaceFilter(filter: string, row: Record<string, unknown>, email?: string): boolean {
  if (!filter || filter === 'all' || filter === 'summary' || filter === 'operations') return true
  const status = String(row.application_status ?? row.status ?? row.employment_status ?? row.verification_status ?? '').toLowerCase()
  const today = new Date().toISOString().slice(0,10)
  const date = String(row.attendance_date ?? row.due_date ?? row.start_date ?? row.created_at ?? '').slice(0,10)
  if (filter === 'active') return status === 'active' || row.is_active === true || status === 'enrolled'
  if (filter === 'inactive') return status === 'inactive' || row.is_active === false
  if (filter === 'current') return row.is_current === true || status === 'active' && !row.effective_to
  if (filter === 'pending') return ['pending','submitted','under_review','documents_required','draft'].includes(status)
  if (filter === 'submitted' || filter === 'under_review' || filter === 'documents_required' || filter === 'approved' || filter === 'enrolled' || filter === 'rejected' || filter === 'withdrawn') return status === filter
  if (filter === 'present' || filter === 'absent' || filter === 'late' || filter === 'excused') return status === filter
  if (filter === 'published') return status === 'published'
  if (filter === 'draft') return ['draft','unpublished'].includes(status)
  if (filter === 'open') return ['open','published','active','submitted','late'].includes(status)
  if (filter === 'closed') return ['closed','completed','cancelled'].includes(status)
  if (filter === 'completed' || filter === 'graded' || filter === 'returned' || filter === 'cancelled') return status === filter
  if (filter === 'unpaid') return status === 'unpaid' || Number(row.paid_amount ?? 0) === 0 && Number(row.amount ?? 0) > 0
  if (filter === 'partial') return status === 'partial' || Number(row.paid_amount ?? 0) > 0 && Number(row.paid_amount ?? 0) < Number(row.amount ?? 0)
  if (filter === 'paid') return status === 'paid' || Number(row.balance ?? 0) <= 0 && Number(row.paid_amount ?? 0) > 0
  if (filter === 'overdue') return status === 'overdue' || Boolean(row.due_date && String(row.due_date) < today && Number(row.balance ?? row.amount ?? 0) > Number(row.paid_amount ?? 0))
  if (filter === 'today') return date === today
  if (filter === 'this-month') return date.slice(0,7) === today.slice(0,7)
  if (filter === 'this-week') { const d=new Date(); const start=new Date(d); start.setDate(d.getDate()-((d.getDay()+6)%7)); return date >= start.toISOString().slice(0,10) && date <= today }
  if (filter === 'upcoming') return Boolean(row.due_date || row.exam_date) && String(row.due_date ?? row.exam_date) >= today
  if (filter === 'morning') return String(row.start_time ?? row.check_in_time ?? '') < '12:00'
  if (filter === 'afternoon') return String(row.start_time ?? row.check_in_time ?? '') >= '12:00'
  if (filter === 'linked') return Boolean(row.user_id || row.parent_user_id || row.student_id || row.guardian_id)
  if (filter === 'unlinked') return !row.user_id && !row.parent_user_id
  if (filter === 'staffed') return Number(row.staff_count ?? 0) > 0
  if (filter === 'unassigned') return !row.department_id && !row.program_id && !row.class_id && !row.teacher_id && !row.room_id
  if (filter === 'teaching' || filter === 'non_teaching') return String(row.employee_type ?? '') === filter
  if (filter === 'core' || filter === 'elective' || filter === 'practical') return String(row.subject_type ?? '') === filter
  if (filter === 'mine') return Boolean(email && String(row.assigned_to_email ?? '').toLowerCase() === email.toLowerCase())
  if (filter === 'recent') { const created=String(row.created_at ?? '').slice(0,10); const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-30); return Boolean(created && created >= cutoff.toISOString().slice(0,10)) }
  if (filter === 'large') return Number(row.size ?? row.file_size ?? row.metadata?.size ?? 0) >= 1024*1024
  if (filter === 'expiring') { const expiry=String(row.expiry_date ?? ''); if(!expiry)return false; const cutoff=new Date(); cutoff.setDate(cutoff.getDate()+30); return expiry >= today && expiry <= cutoff.toISOString().slice(0,10) }
  if (filter === 'expired') return Boolean(row.expiry_date && String(row.expiry_date) < today)
  if (filter === 'unreviewed') return !String(row.notes ?? row.review_notes ?? '').trim()
  if (filter === 'by-subject') return Boolean(row.subject)
  if (filter === 'by-exam') return Boolean(row.exam_title || row.exam_id)
  return true
}
