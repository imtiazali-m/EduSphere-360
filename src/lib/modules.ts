
import type { AppRole, ModuleConfig } from './types'

const allStaff: AppRole[] = ['owner', 'admin', 'teacher', 'accountant', 'exam_officer']
const admins: AppRole[] = ['owner', 'admin']
const everyone: AppRole[] = ['owner', 'admin', 'teacher', 'student', 'parent', 'accountant', 'exam_officer']

export const modules: ModuleConfig[] = [
  {
    key: 'students', title: 'Students', description: 'Admissions, profiles, class placement and learner records.', table: 'students', icon: 'GraduationCap', roles: ['owner', 'admin', 'teacher', 'student', 'parent'],
    fields: [
      { name: 'admission_no', label: 'Admission number', required: true },
      { name: 'full_name', label: 'Student full name', required: true },
      { name: 'email', label: 'Student email', type: 'email' },
      { name: 'class_name', label: 'Class / program', required: true },
      { name: 'guardian_name', label: 'Parent / guardian name' },
      { name: 'guardian_email', label: 'Parent / guardian email', type: 'email' },
      { name: 'date_of_birth', label: 'Date of birth', type: 'date' },
      { name: 'status', label: 'Status', type: 'select', options: [
        { label: 'Active', value: 'active' }, { label: 'Pending', value: 'pending' },
        { label: 'Graduated', value: 'graduated' }, { label: 'Inactive', value: 'inactive' },
      ] },
    ],
    columns: [
      { key: 'admission_no', label: 'Admission ID' }, { key: 'full_name', label: 'Student' },
      { key: 'class_name', label: 'Class / program' }, { key: 'guardian_name', label: 'Guardian' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'teachers', title: 'Faculty & staff', description: 'Teacher profiles, departments, subjects and employment records.', table: 'teachers', icon: 'Users', roles: admins,
    fields: [
      { name: 'employee_no', label: 'Employee ID', required: true },
      { name: 'full_name', label: 'Full name', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'department', label: 'Department' },
      { name: 'subject', label: 'Subject / specialization' },
      { name: 'phone', label: 'Phone' },
      { name: 'employment_status', label: 'Employment status', type: 'select', options: [
        { label: 'Active', value: 'active' }, { label: 'On leave', value: 'on_leave' }, { label: 'Inactive', value: 'inactive' },
      ] },
    ],
    columns: [
      { key: 'employee_no', label: 'Employee ID' }, { key: 'full_name', label: 'Faculty member' },
      { key: 'department', label: 'Department' }, { key: 'subject', label: 'Specialization' },
      { key: 'employment_status', label: 'Status' },
    ],
  },
  {
    key: 'attendance', title: 'Attendance', description: 'Daily student attendance with absence and lateness tracking.', table: 'attendance', icon: 'CalendarCheck', roles: allStaff.concat(['student', 'parent']),
    fields: [
      { name: 'student_id', label: 'Student', type: 'select', required: true },
      { name: 'attendance_date', label: 'Attendance date', type: 'date', required: true },
      { name: 'status', label: 'Attendance status', type: 'select', options: [
        { label: 'Present', value: 'present' }, { label: 'Absent', value: 'absent' },
        { label: 'Late', value: 'late' }, { label: 'Excused', value: 'excused' },
      ] },
      { name: 'notes', label: 'Notes' },
    ],
    columns: [
      { key: 'student_name', label: 'Student' }, { key: 'class_name', label: 'Class' },
      { key: 'attendance_date', label: 'Date' }, { key: 'status', label: 'Status' },
      { key: 'notes', label: 'Notes' },
    ],
  },
  {
    key: 'exams', title: 'Examinations', description: 'Tests, examination schedules, marks and result publication.', table: 'exams', icon: 'ClipboardCheck', roles: ['owner', 'admin', 'teacher', 'exam_officer', 'student', 'parent'],
    fields: [
      { name: 'title', label: 'Examination / test name', required: true },
      { name: 'exam_type', label: 'Examination type', type: 'select', options: [
        { label: 'Midterm', value: 'midterm' }, { label: 'Final', value: 'final' },
        { label: 'Quiz', value: 'quiz' }, { label: 'Monthly test', value: 'monthly' },
        { label: 'Practical', value: 'practical' }, { label: 'Other', value: 'other' },
      ] },
      { name: 'academic_session', label: 'Academic session' },
      { name: 'term', label: 'Term / semester' },
      { name: 'class_name', label: 'Class / program', required: true },
      { name: 'subject', label: 'Subject', required: true },
      { name: 'exam_date', label: 'Examination date', type: 'date', required: true },
      { name: 'start_time', label: 'Start time', type: 'time' },
      { name: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
      { name: 'room', label: 'Room / venue' },
      { name: 'invigilator', label: 'Invigilator' },
      { name: 'total_marks', label: 'Total marks', type: 'number', required: true },
      { name: 'instructions', label: 'Candidate instructions', type: 'textarea' },
      { name: 'status', label: 'Status', type: 'select', options: [
        { label: 'Planned', value: 'planned' }, { label: 'Completed', value: 'completed' },
        { label: 'Results published', value: 'published' },
      ] },
    ],
    columns: [
      { key: 'title', label: 'Examination' }, { key: 'exam_type', label: 'Type' },
      { key: 'class_name', label: 'Class' }, { key: 'subject', label: 'Subject' },
      { key: 'exam_date', label: 'Date' }, { key: 'start_time', label: 'Start' },
      { key: 'room', label: 'Room' }, { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'exam_results', title: 'Exam results', description: 'Enter student marks and publish graded examination results.', table: 'exam_results', icon: 'ClipboardCheck', roles: ['owner', 'admin', 'teacher', 'exam_officer', 'student', 'parent'],
    fields: [
      { name: 'student_id', label: 'Student', type: 'select', required: true },
      { name: 'exam_id', label: 'Examination', type: 'select', required: true },
      { name: 'marks_obtained', label: 'Marks obtained', type: 'number', required: true },
      { name: 'remarks', label: 'Teacher remarks', type: 'textarea' },
      { name: 'result_status', label: 'Result status', type: 'select', options: [
        { label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' },
      ] },
    ],
    columns: [
      { key: 'student_name', label: 'Student' }, { key: 'exam_title', label: 'Examination' },
      { key: 'subject', label: 'Subject' }, { key: 'marks_obtained', label: 'Marks' },
      { key: 'total_marks', label: 'Out of' }, { key: 'grade', label: 'Grade' },
      { key: 'result_status', label: 'Publication' },
    ],
  },
  {
    key: 'fees', title: 'Fees & invoices', description: 'Fee schedules, invoices, collections and outstanding balances.', table: 'fee_invoices', icon: 'Wallet', roles: ['owner', 'admin', 'accountant', 'student', 'parent'],
    fields: [
      { name: 'student_id', label: 'Student', type: 'select', required: true },
      { name: 'invoice_no', label: 'Invoice / voucher number', placeholder: 'Generated automatically when blank' },
      { name: 'fee_title', label: 'Fee description', required: true },
      { name: 'fee_category', label: 'Fee category', type: 'select', options: [
        { label: 'Tuition fee', value: 'tuition' }, { label: 'Admission fee', value: 'admission' },
        { label: 'Examination fee', value: 'examination' }, { label: 'Transport', value: 'transport' },
        { label: 'Library', value: 'library' }, { label: 'Other', value: 'other' },
      ] },
      { name: 'academic_session', label: 'Academic session' },
      { name: 'amount', label: 'Invoice amount (PKR)', type: 'number', required: true },
      { name: 'discount_amount', label: 'Discount (PKR)', type: 'number' },
      { name: 'due_date', label: 'Payment due date', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    columns: [
      { key: 'invoice_no', label: 'Invoice #' }, { key: 'student_name', label: 'Student' },
      { key: 'fee_title', label: 'Description' }, { key: 'fee_category', label: 'Category' },
      { key: 'amount', label: 'Amount (PKR)' }, { key: 'paid_amount', label: 'Received (PKR)' },
      { key: 'balance', label: 'Balance (PKR)' }, { key: 'due_date', label: 'Due date' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'assignments', title: 'Assignments', description: 'Create coursework, set deadlines, allocate classes and track student submissions.', table: 'assignments', icon: 'NotebookPen', roles: ['owner', 'admin', 'teacher', 'student', 'parent'],
    fields: [
      { name: 'title', label: 'Assignment title', required: true },
      { name: 'class_name', label: 'Class / program', required: true },
      { name: 'section_name', label: 'Section' },
      { name: 'subject', label: 'Subject', required: true },
      { name: 'academic_session', label: 'Academic session' },
      { name: 'description', label: 'Instructions', type: 'textarea', required: true },
      { name: 'due_date', label: 'Submission deadline', type: 'date', required: true },
      { name: 'points', label: 'Maximum marks', type: 'number' },
      { name: 'attachment_url', label: 'Learning material / attachment URL' },
      { name: 'status', label: 'Status', type: 'select', options: [
        { label: 'Open', value: 'open' }, { label: 'Closed', value: 'closed' },
      ] },
    ],
    columns: [
      { key: 'title', label: 'Assignment' }, { key: 'class_name', label: 'Class' },
      { key: 'section_name', label: 'Section' }, { key: 'subject', label: 'Subject' },
      { key: 'due_date', label: 'Deadline' }, { key: 'points', label: 'Marks' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'assignment_submissions', title: 'Assignment Submissions', description: 'Submit coursework, review student work, award marks and provide feedback.', table: 'assignment_submissions', icon: 'FileCheck2', roles: ['owner', 'admin', 'teacher', 'student', 'parent'],
    fields: [
      { name: 'assignment_id', label: 'Assignment', type: 'select', required: true },
      { name: 'student_id', label: 'Student', type: 'select', required: true },
      { name: 'submission_text', label: 'Student work / response', type: 'textarea', required: true },
      { name: 'attachment_url', label: 'Submission attachment URL' },
      { name: 'marks_obtained', label: 'Marks awarded', type: 'number' },
      { name: 'feedback', label: 'Teacher feedback', type: 'textarea' },
      { name: 'status', label: 'Submission status', type: 'select', options: [
        { label: 'Submitted', value: 'submitted' }, { label: 'Late', value: 'late' },
        { label: 'Graded', value: 'graded' }, { label: 'Returned for revision', value: 'returned' },
      ] },
    ],
    columns: [
      { key: 'assignment_title', label: 'Assignment' }, { key: 'student_name', label: 'Student' },
      { key: 'submitted_at', label: 'Submitted' }, { key: 'marks_obtained', label: 'Marks' },
      { key: 'status', label: 'Status' }, { key: 'feedback', label: 'Feedback' },
    ],
  },
  {
    key: 'work_tasks', title: 'Work Management', description: 'Allocate institutional work, set priorities, track staff progress and monitor deadlines.', table: 'work_tasks', icon: 'ClipboardList', roles: allStaff,
    fields: [
      { name: 'title', label: 'Task title', required: true },
      { name: 'task_type', label: 'Work category', type: 'select', options: [
        { label: 'Academic', value: 'academic' }, { label: 'Administration', value: 'administration' },
        { label: 'Operations', value: 'operations' }, { label: 'Student support', value: 'student_support' },
        { label: 'Other', value: 'other' },
      ] },
      { name: 'description', label: 'Task details', type: 'textarea', required: true },
      { name: 'assigned_to_name', label: 'Assigned staff member', required: true },
      { name: 'assigned_to_email', label: 'Staff account email', type: 'email', required: true },
      { name: 'priority', label: 'Priority', type: 'select', options: [
        { label: 'Normal', value: 'normal' }, { label: 'Low', value: 'low' },
        { label: 'High', value: 'high' }, { label: 'Urgent', value: 'urgent' },
      ] },
      { name: 'due_date', label: 'Deadline', type: 'date', required: true },
      { name: 'status', label: 'Progress status', type: 'select', options: [
        { label: 'Pending', value: 'pending' }, { label: 'In progress', value: 'in_progress' },
        { label: 'Blocked', value: 'blocked' }, { label: 'Completed', value: 'completed' },
      ] },
      { name: 'progress_percent', label: 'Progress (%)', type: 'number' },
      { name: 'completion_notes', label: 'Progress update / completion notes', type: 'textarea' },
    ],
    columns: [
      { key: 'title', label: 'Task' }, { key: 'task_type', label: 'Category' },
      { key: 'assigned_to_name', label: 'Assigned to' }, { key: 'priority', label: 'Priority' },
      { key: 'due_date', label: 'Deadline' }, { key: 'progress_percent', label: 'Progress %' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    key: 'timetable', title: 'Timetable', description: 'Class, course, room and teacher schedules.', table: 'timetable_entries', icon: 'CalendarDays', roles: everyone,
    fields: [
      { name: 'class_name', label: 'Class / program', required: true },
      { name: 'weekday', label: 'Day', type: 'select', required: true, options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(x => ({ label: x, value: x })) },
      { name: 'start_time', label: 'Start time', type: 'time', required: true },
      { name: 'end_time', label: 'End time', type: 'time', required: true },
      { name: 'subject', label: 'Subject / course' },
      { name: 'teacher_name', label: 'Teacher' },
      { name: 'room', label: 'Room' },
    ],
    columns: [
      { key: 'weekday', label: 'Day' }, { key: 'start_time', label: 'Start' },
      { key: 'end_time', label: 'End' }, { key: 'class_name', label: 'Class' },
      { key: 'subject', label: 'Subject' }, { key: 'room', label: 'Room' },
    ],
  },
  {
    key: 'announcements', title: 'Announcements', description: 'Institution-wide updates for staff, students and parents.', table: 'announcements', icon: 'Megaphone', roles: everyone,
    fields: [
      { name: 'title', label: 'Announcement title', required: true },
      { name: 'body', label: 'Message', type: 'textarea', required: true },
      { name: 'audience', label: 'Audience', type: 'select', options: [
        { label: 'Everyone', value: 'all' }, { label: 'Teachers', value: 'teachers' },
        { label: 'Students', value: 'students' }, { label: 'Parents', value: 'parents' },
      ] },
    ],
    columns: [
      { key: 'title', label: 'Announcement' }, { key: 'audience', label: 'Audience' },
      { key: 'created_at', label: 'Published' },
    ],
  },
]

export interface NavigationGroup {
  key: string
  label: string
  description: string
  moduleKeys: string[]
}

export const navigationGroups: NavigationGroup[] = [
  {
    key: 'overview',
    label: 'OVERVIEW',
    description: 'Institution dashboard',
    moduleKeys: [],
  },
  {
    key: 'academics',
    label: 'TEACHING & LEARNING',
    description: 'Academic activities and assessments',
    moduleKeys: ['attendance', 'exams', 'exam_results', 'assignments', 'assignment_submissions', 'timetable'],
  },
  {
    key: 'operations',
    label: 'INSTITUTION OPERATIONS',
    description: 'Institutional work management',
    moduleKeys: ['work_tasks', 'announcements'],
  },
  {
    key: 'finance',
    label: 'FINANCE & PAYMENTS',
    description: 'Fees and collections',
    moduleKeys: ['fees'],
  },
]

export function modulesForRole(role: AppRole) {
  return modules.filter(module => module.roles.includes(role))
}

export const roleLabels: Record<AppRole, string> = {
  owner: 'Institution owner',
  admin: 'Administrator',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent / guardian',
  accountant: 'Accountant',
  exam_officer: 'Examination officer',
}
