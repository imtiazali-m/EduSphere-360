import type { RecordRow } from './types'

export interface WorkspaceView {
  key: string
  label: string
  description: string
  matches: (row: RecordRow) => boolean
}

export interface OperationalWorkspaceConfig {
  eyebrow: string
  title: string
  description: string
  recordLabel: string
  views: WorkspaceView[]
}

const today = () => new Date().toISOString().slice(0, 10)
const status = (row: RecordRow, key = 'status') => String(row[key] ?? '').toLowerCase()
const date = (row: RecordRow, key: string) => String(row[key] ?? '').slice(0, 10)
const view = (key: string, label: string, description: string, matches: WorkspaceView['matches']): WorkspaceView =>
  ({ key, label, description, matches })

export const operationalWorkspaceConfigs: Record<string, OperationalWorkspaceConfig> = {
  attendance: {
    eyebrow: 'ACADEMIC MANAGEMENT / ATTENDANCE CONTROL',
    title: 'Attendance Operations',
    description: 'Move from the daily class register to exception follow-up and historical attendance review.',
    recordLabel: 'attendance entries',
    views: [
      view('register', 'Daily Register', 'All attendance records, ready for the current register and authorised corrections.', () => true),
      view('present', 'Present & Excused', 'Learners recorded as present or excused on the selected register.', row => ['present', 'excused'].includes(status(row))),
      view('follow-up', 'Absence Follow-up', 'Absent and late records that need review by the class or attendance team.', row => ['absent', 'late'].includes(status(row))),
      view('today', 'Today', 'Attendance entries dated today.', row => date(row, 'attendance_date') === today()),
      view('history', 'Attendance History', 'Earlier attendance entries retained for audit and reporting.', row => Boolean(date(row, 'attendance_date')) && date(row, 'attendance_date') < today()),
    ],
  },
  exams: {
    eyebrow: 'ACADEMIC MANAGEMENT / ASSESSMENT PLANNING',
    title: 'Examination Control Centre',
    description: 'Separate the assessment calendar, planned papers, completed sittings and publication-ready examinations.',
    recordLabel: 'examinations',
    views: [
      view('calendar', 'Exam Calendar', 'The full examination schedule for this institution.', () => true),
      view('planned', 'Planned Papers', 'Examinations still planned and awaiting completion.', row => status(row) === 'planned'),
      view('upcoming', 'Upcoming', 'Scheduled examinations with a date today or later.', row => Boolean(date(row, 'exam_date')) && date(row, 'exam_date') >= today()),
      view('completed', 'Completed Sittings', 'Examinations marked completed by the examination team.', row => status(row) === 'completed'),
      view('published', 'Published Results', 'Examinations whose result status has been marked published.', row => status(row) === 'published'),
    ],
  },
  exam_results: {
    eyebrow: 'ACADEMIC MANAGEMENT / RESULTS OFFICE',
    title: 'Results & Publication Office',
    description: 'Work through mark entry, moderation, publication and the released results register.',
    recordLabel: 'result records',
    views: [
      view('all', 'Results Register', 'All result records available to your role.', () => true),
      view('drafts', 'Draft Mark Entry', 'Unpublished results that remain in the working register.', row => status(row, 'result_status') === 'draft'),
      view('published', 'Published Results', 'Results released to the permitted student and parent portals.', row => status(row, 'result_status') === 'published'),
      view('review', 'Needs Review', 'Draft results with missing marks or examination references.', row => status(row, 'result_status') !== 'published' && (row.marks_obtained === null || row.marks_obtained === undefined || !row.exam_id)),
    ],
  },
  fees: {
    eyebrow: 'FINANCE & PAYMENTS / RECEIVABLES',
    title: 'Fee & Receivables Desk',
    description: 'Manage the fee ledger by collection state, outstanding balances and settled invoices.',
    recordLabel: 'fee invoices',
    views: [
      view('ledger', 'Invoice Ledger', 'All fee invoices, including paid, partial and unpaid balances.', () => true),
      view('due', 'Unpaid Invoices', 'Invoices with no recorded payment yet.', row => Number(row.paid_amount ?? 0) <= 0 && outstanding(row) > 0),
      view('partial', 'Part-paid Accounts', 'Invoices with a payment received and a remaining balance.', row => Number(row.paid_amount ?? 0) > 0 && outstanding(row) > 0),
      view('overdue', 'Overdue Follow-up', 'Invoices past their due date with an outstanding balance.', row => Boolean(date(row, 'due_date')) && date(row, 'due_date') < today() && outstanding(row) > 0),
      view('settled', 'Settled Invoices', 'Invoices with no remaining balance.', row => outstanding(row) <= 0),
    ],
  },
  assignments: {
    eyebrow: 'ACADEMIC MANAGEMENT / COURSEWORK',
    title: 'Coursework Planning Desk',
    description: 'Organise open coursework, closed activities, upcoming deadlines and overdue work.',
    recordLabel: 'assignments',
    views: [
      view('board', 'Assignment Board', 'All coursework assigned across your permitted classes.', () => true),
      view('open', 'Open for Submission', 'Assignments currently accepting student work.', row => status(row) === 'open'),
      view('upcoming', 'Upcoming Deadlines', 'Open assignments due today or later.', row => status(row) === 'open' && Boolean(date(row, 'due_date')) && date(row, 'due_date') >= today()),
      view('overdue', 'Past Due', 'Assignments whose deadline has passed.', row => Boolean(date(row, 'due_date')) && date(row, 'due_date') < today()),
      view('closed', 'Closed Coursework', 'Assignments no longer accepting submissions.', row => status(row) === 'closed'),
    ],
  },
  assignment_submissions: {
    eyebrow: 'ACADEMIC MANAGEMENT / SUBMISSION REVIEW',
    title: 'Submission Review Inbox',
    description: 'Triage incoming work, assess late submissions and review completed or returned coursework.',
    recordLabel: 'submissions',
    views: [
      view('inbox', 'Submission Inbox', 'All student submissions available to your role.', () => true),
      view('awaiting', 'Awaiting Review', 'Submitted or late work awaiting a teacher or examiner decision.', row => ['submitted', 'late'].includes(status(row))),
      view('late', 'Late Submissions', 'Work submitted after its assignment deadline.', row => status(row) === 'late'),
      view('graded', 'Graded Work', 'Submissions with marks or feedback recorded.', row => status(row) === 'graded'),
      view('returned', 'Returned for Revision', 'Work sent back to the learner for improvement.', row => status(row) === 'returned'),
    ],
  },
  timetable: {
    eyebrow: 'ACADEMIC MANAGEMENT / SCHEDULING',
    title: 'Timetable & Room Scheduler',
    description: 'Inspect the weekly teaching plan by day and keep class, teacher and room allocations together.',
    recordLabel: 'scheduled sessions',
    views: [
      view('week', 'Weekly Schedule', 'All timetable entries for the institution week.', () => true),
      view('classes', 'Class Timetables', 'Sessions organised by their assigned class or section.', row => Boolean(String(row.class_name ?? '').trim())),
      view('teachers', 'Teacher Timetables', 'Sessions with a teacher allocation, ready for workload and availability review.', row => Boolean(String(row.teacher_name ?? '').trim())),
      view('rooms', 'Room Timetables', 'Sessions with a room allocation, ready for room availability review.', row => Boolean(String(row.room ?? '').trim())),
      ...['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day =>
        view(day.toLowerCase(), day, 'Sessions scheduled for ' + day + '.', row => String(row.weekday ?? '').toLowerCase() === day.toLowerCase())),
      view('conflicts', 'Schedule Conflicts', 'Overlapping class, teacher or room bookings identified from the saved schedule.', () => true),
      view('unassigned', 'Allocation Gaps', 'Sessions where a teacher or room has not yet been specified.', row => !String(row.teacher_name ?? '').trim() || !String(row.room ?? '').trim()),
      view('history', 'Timetable History', 'Saved schedule entries retained for review and audit.', row => Boolean(row.created_at)),
    ],
  },
  announcements: {
    eyebrow: 'COMMUNICATION / INSTITUTION BULLETIN',
    title: 'Institution Bulletin Desk',
    description: 'Review notices by audience and manage the institution’s published communication record.',
    recordLabel: 'announcements',
    views: [
      view('bulletin', 'Bulletin Board', 'All announcement records visible to your role.', () => true),
      view('everyone', 'Institution-wide', 'Notices addressed to the whole institution.', row => ['all', 'everyone'].includes(status(row, 'audience'))),
      view('students', 'Student Notices', 'Notices addressed to students.', row => status(row, 'audience') === 'students'),
      view('parents', 'Parent Notices', 'Notices addressed to parents and guardians.', row => status(row, 'audience') === 'parents'),
      view('staff', 'Staff Notices', 'Notices addressed to teachers and staff.', row => status(row, 'audience') === 'teachers'),
    ],
  },
  work_tasks: {
    eyebrow: 'OPERATIONS / WORK MANAGEMENT',
    title: 'Institution Work Queue',
    description: 'Prioritise assigned work, track progress, identify blockers and review completed tasks.',
    recordLabel: 'work tasks',
    views: [
      view('queue', 'All Work', 'All work tasks available to your role.', () => true),
      view('active', 'In Progress', 'Tasks currently being worked on.', row => status(row) === 'in_progress'),
      view('pending', 'Awaiting Start', 'Tasks that have not yet been started.', row => status(row) === 'pending'),
      view('blocked', 'Blocked Work', 'Tasks flagged as blocked and requiring intervention.', row => status(row) === 'blocked'),
      view('priority', 'High Priority', 'Urgent and high-priority tasks requiring attention.', row => ['urgent', 'high'].includes(status(row, 'priority'))),
      view('completed', 'Completed', 'Tasks marked completed.', row => status(row) === 'completed'),
    ],
  },
}

function outstanding(row: RecordRow) {
  const amount = Math.max(0, Number(row.amount ?? 0) - Number(row.discount_amount ?? 0) + Number(row.fine_amount ?? 0))
  return Math.max(0, amount - Number(row.paid_amount ?? 0))
}
