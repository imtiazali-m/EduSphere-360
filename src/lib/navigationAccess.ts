import type { AppRole } from './types'
import { navigationCatalog } from './navigationCatalog'

const rolePageAccess: Record<AppRole, Record<string, string[]>> = {
  owner: {
    dashboard: [], students: ['Student Record'], people: ['Faculty & Staff', 'User Account'],
    institution: ['Departments', 'Programs', 'Class Sections', 'Academic Session', 'Subjects', 'Rooms & Facilities', 'Files & Documentation'],
    academics: ['Attendance Registration', 'Examination', 'Exam Results', 'Assignments', 'Assignment Submission', 'Timetable'],
    finance: ['Fees Invoice'], communication: ['Announcement'], operations: ['Work Management', 'Reports'],
  },
  admin: {
    dashboard: [], students: ['Student Record'], people: ['Faculty & Staff', 'User Account'],
    institution: ['Departments', 'Programs', 'Class Sections', 'Academic Session', 'Subjects', 'Rooms & Facilities', 'Files & Documentation'],
    academics: ['Attendance Registration', 'Examination', 'Exam Results', 'Assignments', 'Assignment Submission', 'Timetable'],
    finance: ['Fees Invoice'], communication: ['Announcement'], operations: ['Work Management', 'Reports'],
  },
  teacher: {
    dashboard: [], students: ['Student Record'],
    academics: ['Attendance Registration', 'Examination', 'Exam Results', 'Assignments', 'Assignment Submission', 'Timetable'],
    communication: ['Announcement'], operations: ['Work Management'],
  },
  student: {
    dashboard: [], students: ['Student Record'],
    academics: ['Attendance Registration', 'Exam Results', 'Assignments', 'Assignment Submission', 'Timetable'],
    finance: ['Fees Invoice'], communication: ['Announcement'],
  },
  parent: {
    dashboard: [],
    academics: ['Attendance Registration', 'Exam Results', 'Assignments', 'Timetable'],
    finance: ['Fees Invoice'], communication: ['Announcement'],
  },
  accountant: {
    dashboard: [], finance: ['Fees Invoice'], operations: ['Work Management', 'Reports'],
  },
  exam_officer: {
    dashboard: [],
    academics: ['Examination', 'Exam Results'],
    communication: ['Announcement'], operations: ['Work Management', 'Reports'],
  },
}

export function roleNavigationGroups(role: AppRole) {
  const permissions = rolePageAccess[role]
  return navigationCatalog
    .map(group => ({ ...group, items: permissions[group.key] ?? [] }))
    .filter(group => group.key === 'dashboard' || group.items.length > 0)
}
