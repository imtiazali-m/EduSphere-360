import type { AppRole } from './types'
import { navigationCatalog } from './navigationCatalog'

const rolePageAccess: Record<AppRole, Record<string, string[]>> = {
  owner: {
    dashboard: [],
    admissions: ['Student Records'],
    people: ['Faculty & Staff', 'User Accounts'],
    administration: ['Departments', 'Programs', 'Classes & Sections', 'Academic Sessions', 'Subjects', 'Rooms & Facilities', 'Files & Documents'],
    academics: ['Attendance Register', 'Examinations', 'Exam Results', 'Assignments', 'Assignment Submissions', 'Timetable'],
    finance: ['Fee Invoices'],
    communication: ['Announcements'],
    operations: ['Work Management', 'Reports'],
  },
  admin: {
    dashboard: [],
    admissions: ['Student Records'],
    people: ['Faculty & Staff', 'User Accounts'],
    administration: ['Departments', 'Programs', 'Classes & Sections', 'Academic Sessions', 'Subjects', 'Rooms & Facilities', 'Files & Documents'],
    academics: ['Attendance Register', 'Examinations', 'Exam Results', 'Assignments', 'Assignment Submissions', 'Timetable'],
    finance: ['Fee Invoices'],
    communication: ['Announcements'],
    operations: ['Work Management', 'Reports'],
  },
  teacher: {
    dashboard: [],
    admissions: ['Student Records'],
    academics: ['Attendance Register', 'Examinations', 'Exam Results', 'Assignments', 'Assignment Submissions', 'Timetable'],
    communication: ['Announcements'],
    operations: ['Work Management'],
  },
  student: {
    dashboard: [],
    academics: ['Attendance Register', 'Exam Results', 'Assignments', 'Assignment Submissions', 'Timetable'],
    finance: ['Fee Invoices'],
    communication: ['Announcements'],
    profile: ['My Profile'],
  },
  parent: {
    dashboard: [],
    academics: ['Attendance Register', 'Exam Results', 'Assignments', 'Timetable'],
    finance: ['Fee Invoices'],
    communication: ['Announcements'],
    profile: ['My Profile'],
  },
  accountant: {
    dashboard: [],
    finance: ['Fee Invoices'],
    operations: ['Work Management', 'Reports'],
  },
  exam_officer: {
    dashboard: [],
    academics: ['Examinations', 'Exam Results'],
    communication: ['Announcements'],
    operations: ['Work Management', 'Reports'],
  },
}

export function roleNavigationGroups(role: AppRole) {
  const permissions = rolePageAccess[role]
  return navigationCatalog
    .map(group => ({ ...group, items: permissions[group.key] ?? [] }))
    .filter(group => group.key === 'dashboard' || group.items.length > 0)
}
