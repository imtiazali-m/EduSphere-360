import type { AppRole } from './types'
import { navigationCatalog } from './navigationCatalog'

const studentOwnerWindows = [
  'Overview', 'Admissions', 'Student Directory', 'Student Profile', 'Class Placement', 'Guardians',
  'Student Attendance', 'Student Exam Results', 'Student Assignments', 'Student Timetable',
  'Student Documentation', 'Student History',
]
const studentStaffWindows = [
  'Overview', 'Student Directory', 'Student Profile', 'Class Placement', 'Student Attendance',
  'Student Exam Results', 'Student Assignments', 'Student Timetable', 'Student History',
]
const studentSelfServiceWindows = [
  'Overview', 'Student Profile', 'Class Placement', 'Guardians', 'Student Attendance',
  'Student Exam Results', 'Student Assignments', 'Student Timetable', 'Student Documentation', 'Student History',
]

const rolePageAccess: Record<AppRole, Record<string, string[]>> = {
  owner: {
    dashboard: [], students: studentOwnerWindows, people: ['Faculty & Staff', 'User Account'],
    institution: ['Departments', 'Programs', 'Class Sections', 'Academic Sessions', 'Subjects', 'Rooms & Facilities', 'Files & Documentation'],
    academics: ['Attendance Registration', 'Examination', 'Exam Results', 'Assignments', 'Assignment Submission', 'Timetable'],
    finance: ['Fees Invoices'], communication: ['Announcements'], operations: ['Work Management', 'Reports'],
  },
  admin: {
    dashboard: [], students: studentOwnerWindows, people: ['Faculty & Staff', 'User Account'],
    institution: ['Departments', 'Programs', 'Class Sections', 'Academic Sessions', 'Subjects', 'Rooms & Facilities', 'Files & Documentation'],
    academics: ['Attendance Registration', 'Examination', 'Exam Results', 'Assignments', 'Assignment Submission', 'Timetable'],
    finance: ['Fees Invoices'], communication: ['Announcements'], operations: ['Work Management', 'Reports'],
  },
  teacher: {
    dashboard: [], students: studentStaffWindows, people: ['My Staff Workspace'],
    academics: ['Attendance Registration', 'Examination', 'Exam Results', 'Assignments', 'Assignment Submission', 'Timetable'],
    communication: ['Announcements'], operations: ['Work Management'],
  },
  student: {
    dashboard: [], students: studentSelfServiceWindows,
    academics: ['Attendance Registration', 'Exam Results', 'Assignments', 'Assignment Submission', 'Timetable'],
    finance: ['Fees Invoices'], communication: ['Announcements'],
  },
  parent: {
    dashboard: [], students: studentSelfServiceWindows,
    academics: ['Attendance Registration', 'Exam Results', 'Assignments', 'Timetable'],
    finance: ['Fees Invoices'], communication: ['Announcements'],
  },
  accountant: {
    dashboard: [], finance: ['Fees Invoices'], operations: ['Work Management', 'Reports'],
  },
  exam_officer: {
    dashboard: [],
    academics: ['Examination', 'Exam Results'],
    communication: ['Announcements'], operations: ['Work Management', 'Reports'],
  },
}

export function roleNavigationGroups(role: AppRole) {
  const permissions = rolePageAccess[role]
  return navigationCatalog
    .map(group => ({ ...group, items: permissions[group.key] ?? [] }))
    .filter(group => group.key === 'dashboard' || group.items.length > 0)
}
