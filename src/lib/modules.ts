import type { AppRole, ModuleConfig } from './types'

const allStaff: AppRole[] = ['owner', 'admin', 'teacher', 'accountant', 'exam_officer']
const admins: AppRole[] = ['owner', 'admin']
const everyone: AppRole[] = ['owner', 'admin', 'teacher', 'student', 'parent', 'accountant', 'exam_officer']

export const modules: ModuleConfig[] = [
  {
    key: 'students', title: 'Students', description: 'Admissions, profiles, class placement and learner records.', table: 'students', icon: 'GraduationCap', roles: ['owner', 'admin', 'teacher', 'student', 'parent'],
    fields: [
      { name: 'admission_no', label: 'Admission number', required: true }, { name: 'full_name', label: 'Student full name', required: true },
      { name: 'email', label: 'Student email', type: 'email' }, { name: 'class_name', label: 'Class / program', required: true },
      { name: 'guardian_name', label: 'Parent / guardian name' }, { name: 'guardian_email', label: 'Parent / guardian email', type: 'email' },
      { name: 'date_of_birth', label: 'Date of birth', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Pending', value: 'pending' }, { label: 'Graduated', value: 'graduated' }, { label: 'Inactive', value: 'inactive' }] },
    ], columns: [{ key: 'admission_no', label: 'Admission ID' }, { key: 'full_name', label: 'Student' }, { key: 'class_name', label: 'Class / program' }, { key: 'guardian_name', label: 'Guardian' }, { key: 'status', label: 'Status' }],
  },
  {
    key: 'teachers', title: 'Faculty & staff', description: 'Teacher profiles, departments, subjects and employment records.', table: 'teachers', icon: 'Users', roles: admins,
    fields: [
      { name: 'employee_no', label: 'Employee ID', required: true }, { name: 'full_name', label: 'Full name', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'department', label: 'Department' }, { name: 'subject', label: 'Subject / specialization' },
      { name: 'phone', label: 'Phone' }, { name: 'employment_status', label: 'Employment status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'On leave', value: 'on_leave' }, { label: 'Inactive', value: 'inactive' }] },
    ], columns: [{ key: 'employee_no', label: 'Employee ID' }, { key: 'full_name', label: 'Faculty member' }, { key: 'department', label: 'Department' }, { key: 'subject', label: 'Specialization' }, { key: 'employment_status', label: 'Status' }],
  },
  {
    key: 'attendance', title: 'Attendance', description: 'Daily student attendance with absence and lateness tracking.', table: 'attendance', icon: 'CalendarCheck', roles: allStaff.concat(['student', 'parent']),
    fields: [
      { name: 'student_name', label: 'Student name', required: true }, { name: 'class_name', label: 'Class / program', required: true },
      { name: 'attendance_date', label: 'Attendance date', type: 'date', required: true },
      { name: 'status', label: 'Attendance status', type: 'select', options: [{ label: 'Present', value: 'present' }, { label: 'Absent', value: 'absent' }, { label: 'Late', value: 'late' }, { label: 'Excused', value: 'excused' }] },
      { name: 'notes', label: 'Notes' },
    ], columns: [{ key: 'student_name', label: 'Student' }, { key: 'class_name', label: 'Class' }, { key: 'attendance_date', label: 'Date' }, { key: 'status', label: 'Status' }, { key: 'notes', label: 'Notes' }],
  },
  {
    key: 'faculty_attendance', title: 'Faculty Attendance', description: 'Daily staff attendance, check-in and check-out times, and monthly attendance history.', table: 'faculty_attendance', icon: 'CalendarCheck', roles: admins,
    fields: [
      { name: 'employee_no', label: 'Employee ID', required: true }, { name: 'faculty_name', label: 'Faculty member name', required: true },
      { name: 'department', label: 'Department' }, { name: 'attendance_date', label: 'Attendance date', type: 'date', required: true },
      { name: 'status', label: 'Attendance status', type: 'select', options: [{ label: 'Present', value: 'present' }, { label: 'Absent', value: 'absent' }, { label: 'Late', value: 'late' }, { label: 'Half day', value: 'half_day' }, { label: 'Leave', value: 'leave' }] },
      { name: 'check_in', label: 'Check-in time', type: 'time' }, { name: 'check_out', label: 'Check-out time', type: 'time' }, { name: 'notes', label: 'Notes', type: 'textarea' },
    ], columns: [{ key: 'employee_no', label: 'Employee ID' }, { key: 'faculty_name', label: 'Faculty member' }, { key: 'department', label: 'Department' }, { key: 'attendance_date', label: 'Date' }, { key: 'status', label: 'Status' }, { key: 'check_in', label: 'Check-in' }, { key: 'check_out', label: 'Check-out' }],
  },
  {
    key: 'exams', title: 'Examinations', description: 'Tests, examination schedules, marks and result publication.', table: 'exams', icon: 'ClipboardCheck', roles: ['owner', 'admin', 'teacher', 'exam_officer', 'student', 'parent'],
    fields: [
      { name: 'title', label: 'Examination / test name', required: true }, { name: 'class_name', label: 'Class / program', required: true },
      { name: 'subject', label: 'Subject', required: true }, { name: 'exam_date', label: 'Examination date', type: 'date', required: true },
      { name: 'total_marks', label: 'Total marks', type: 'number', required: true }, { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Planned', value: 'planned' }, { label: 'Completed', value: 'completed' }, { label: 'Results published', value: 'published' }] },
    ], columns: [{ key: 'title', label: 'Examination' }, { key: 'class_name', label: 'Class' }, { key: 'subject', label: 'Subject' }, { key: 'exam_date', label: 'Date' }, { key: 'status', label: 'Status' }],
  },
  {
    key: 'exam_results', title: 'Exam results', description: 'Enter student marks and publish graded examination results.', table: 'exam_results', icon: 'ClipboardCheck', roles: ['owner', 'admin', 'teacher', 'exam_officer', 'student', 'parent'],
    fields: [
      { name: 'student_name', label: 'Student full name', required: true }, { name: 'exam_title', label: 'Examination name', required: true },
      { name: 'subject', label: 'Subject', required: true }, { name: 'marks_obtained', label: 'Marks obtained', type: 'number', required: true },
      { name: 'total_marks', label: 'Total marks', type: 'number', required: true }, { name: 'grade', label: 'Grade' },
    ], columns: [{ key: 'student_name', label: 'Student' }, { key: 'exam_title', label: 'Examination' }, { key: 'subject', label: 'Subject' }, { key: 'marks_obtained', label: 'Marks' }, { key: 'total_marks', label: 'Out of' }, { key: 'grade', label: 'Grade' }],
  },
  {
    key: 'fees', title: 'Fees & invoices', description: 'Fee schedules, invoices, collections and outstanding balances.', table: 'fee_invoices', icon: 'Wallet', roles: ['owner', 'admin', 'accountant', 'student', 'parent'],
    fields: [
      { name: 'student_name', label: 'Student name', required: true }, { name: 'fee_title', label: 'Fee description', required: true },
      { name: 'amount', label: 'Invoice amount (PKR)', type: 'number', required: true }, { name: 'paid_amount', label: 'Paid amount (PKR)', type: 'number' },
      { name: 'due_date', label: 'Due date', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Unpaid', value: 'unpaid' }, { label: 'Partially paid', value: 'partial' }, { label: 'Paid', value: 'paid' }, { label: 'Overdue', value: 'overdue' }] },
    ], columns: [{ key: 'student_name', label: 'Student' }, { key: 'fee_title', label: 'Description' }, { key: 'amount', label: 'Amount (PKR)' }, { key: 'paid_amount', label: 'Paid (PKR)' }, { key: 'balance', label: 'Balance (PKR)' }, { key: 'due_date', label: 'Due date' }, { key: 'status', label: 'Status' }],
  },
  {
    key: 'assignments', title: 'Assignments', description: 'Homework, coursework, submission dates and teacher feedback.', table: 'assignments', icon: 'NotebookPen', roles: ['owner', 'admin', 'teacher', 'student', 'parent'],
    fields: [
      { name: 'title', label: 'Assignment title', required: true }, { name: 'class_name', label: 'Class / program', required: true },
      { name: 'subject', label: 'Subject' }, { name: 'description', label: 'Instructions', type: 'textarea' },
      { name: 'due_date', label: 'Due date', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Open', value: 'open' }, { label: 'Closed', value: 'closed' }] },
    ], columns: [{ key: 'title', label: 'Assignment' }, { key: 'class_name', label: 'Class' }, { key: 'subject', label: 'Subject' }, { key: 'due_date', label: 'Due date' }, { key: 'status', label: 'Status' }],
  },
  {
    key: 'timetable', title: 'Timetable', description: 'Class, course, room and teacher schedules.', table: 'timetable_entries', icon: 'CalendarDays', roles: everyone,
    fields: [
      { name: 'class_name', label: 'Class / program', required: true }, { name: 'weekday', label: 'Day', type: 'select', options: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((x) => ({ label: x, value: x })) },
      { name: 'start_time', label: 'Start time', type: 'time' }, { name: 'end_time', label: 'End time', type: 'time' },
      { name: 'subject', label: 'Subject / course' }, { name: 'teacher_name', label: 'Teacher' }, { name: 'room', label: 'Room' },
    ], columns: [{ key: 'weekday', label: 'Day' }, { key: 'start_time', label: 'Start' }, { key: 'end_time', label: 'End' }, { key: 'class_name', label: 'Class' }, { key: 'subject', label: 'Subject' }, { key: 'room', label: 'Room' }],
  },
  {
    key: 'departments', title: 'Departments', description: 'Manage academic and administrative departments.', table: 'departments', icon: 'Building2', roles: admins,
    fields: [
      { name: 'department_code', label: 'Department code', required: true }, { name: 'name', label: 'Department name', required: true },
      { name: 'head_name', label: 'Department head' }, { name: 'email', label: 'Department email', type: 'email' },
      { name: 'phone', label: 'Contact number' }, { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }] },
    ], columns: [{ key: 'department_code', label: 'Code' }, { key: 'name', label: 'Department' }, { key: 'head_name', label: 'Department head' }, { key: 'email', label: 'Email' }, { key: 'status', label: 'Status' }],
  },
  {
    key: 'classes', title: 'Classes & sections', description: 'Configure grade levels, sections, class teachers and capacity.', table: 'institution_classes', icon: 'School', roles: admins,
    fields: [
      { name: 'class_name', label: 'Class / grade', required: true }, { name: 'section', label: 'Section' },
      { name: 'class_teacher', label: 'Class teacher' }, { name: 'room', label: 'Room' },
      { name: 'capacity', label: 'Student capacity', type: 'number' }, { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }] },
    ], columns: [{ key: 'class_name', label: 'Class' }, { key: 'section', label: 'Section' }, { key: 'class_teacher', label: 'Class teacher' }, { key: 'room', label: 'Room' }, { key: 'capacity', label: 'Capacity' }, { key: 'status', label: 'Status' }],
  },
  {
    key: 'academic_sessions', title: 'Academic sessions', description: 'Set academic years, start and end dates, and the active session.', table: 'academic_sessions', icon: 'CalendarRange', roles: admins,
    fields: [
      { name: 'session_name', label: 'Session name', required: true }, { name: 'start_date', label: 'Start date', type: 'date', required: true },
      { name: 'end_date', label: 'End date', type: 'date', required: true },
      { name: 'status', label: 'Session status', type: 'select', options: [{ label: 'Planned', value: 'planned' }, { label: 'Active', value: 'active' }, { label: 'Completed', value: 'completed' }] },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ], columns: [{ key: 'session_name', label: 'Academic session' }, { key: 'start_date', label: 'Starts' }, { key: 'end_date', label: 'Ends' }, { key: 'status', label: 'Status' }],
  },
  {
    key: 'subjects', title: 'Subjects', description: 'Maintain subject catalogue and department ownership.', table: 'subjects', icon: 'BookOpen', roles: admins,
    fields: [
      { name: 'subject_code', label: 'Subject code', required: true }, { name: 'name', label: 'Subject name', required: true },
      { name: 'department', label: 'Department' }, { name: 'level', label: 'Grade / level' },
      { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }] },
    ], columns: [{ key: 'subject_code', label: 'Code' }, { key: 'name', label: 'Subject' }, { key: 'department', label: 'Department' }, { key: 'level', label: 'Grade / level' }, { key: 'status', label: 'Status' }],
  },
  {
    key: 'rooms', title: 'Rooms & facilities', description: 'Track classrooms, labs, halls and their availability.', table: 'institution_rooms', icon: 'DoorOpen', roles: admins,
    fields: [
      { name: 'room_code', label: 'Room code', required: true }, { name: 'name', label: 'Room / facility name', required: true },
      { name: 'room_type', label: 'Type', type: 'select', options: [{ label: 'Classroom', value: 'classroom' }, { label: 'Laboratory', value: 'laboratory' }, { label: 'Library', value: 'library' }, { label: 'Hall', value: 'hall' }, { label: 'Office', value: 'office' }] },
      { name: 'capacity', label: 'Capacity', type: 'number' }, { name: 'location', label: 'Building / location' },
      { name: 'status', label: 'Status', type: 'select', options: [{ label: 'Available', value: 'available' }, { label: 'Maintenance', value: 'maintenance' }, { label: 'Unavailable', value: 'unavailable' }] },
    ], columns: [{ key: 'room_code', label: 'Room code' }, { key: 'name', label: 'Facility' }, { key: 'room_type', label: 'Type' }, { key: 'capacity', label: 'Capacity' }, { key: 'location', label: 'Location' }, { key: 'status', label: 'Status' }],
  },
  {
    key: 'announcements', title: 'Announcements', description: 'Institution-wide updates for staff, students and parents.', table: 'announcements', icon: 'Megaphone', roles: everyone,
    fields: [
      { name: 'title', label: 'Announcement title', required: true }, { name: 'body', label: 'Message', type: 'textarea', required: true },
      { name: 'audience', label: 'Audience', type: 'select', options: [{ label: 'Everyone', value: 'all' }, { label: 'Teachers', value: 'teachers' }, { label: 'Students', value: 'students' }, { label: 'Parents', value: 'parents' }] },
    ], columns: [{ key: 'title', label: 'Announcement' }, { key: 'audience', label: 'Audience' }, { key: 'created_at', label: 'Published' }],
  },
]

export function modulesForRole(role: AppRole) {
  return modules.filter((module) => module.roles.includes(role))
}

export const roleLabels: Record<AppRole, string> = {
  owner: 'Institution owner', admin: 'Administrator', teacher: 'Teacher', student: 'Student', parent: 'Parent / guardian', accountant: 'Accountant', exam_officer: 'Examination officer',
}
