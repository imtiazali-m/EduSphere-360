import type { AppRole } from './types'
import { navigationCatalog } from './navigationCatalog'

const rolePageAccess: Record<AppRole, Record<string, string[]>> = {
  owner: {
    dashboard: [], administration: ['Departments', 'Programs', 'Classes & Sections', 'Academic Sessions', 'Subjects', 'Rooms & Facilities'],
    students: ['Student Records'], employees: ['Faculty & Staff'], attendance: ['Attendance Register'],
    examinations: ['Examinations', 'Exam Results'], fees: ['Fee Invoices'], teaching: ['Assignments', 'Assignment Submissions'],
    timetable: ['Timetable'], communication: ['Announcements'], accounts: ['User Accounts'], files: ['Files & Documents'], work: ['Work Management'],
  },
  admin: {
    dashboard: [], administration: ['Departments', 'Programs', 'Classes & Sections', 'Academic Sessions', 'Subjects', 'Rooms & Facilities'],
    students: ['Student Records'], employees: ['Faculty & Staff'], attendance: ['Attendance Register'],
    examinations: ['Examinations', 'Exam Results'], fees: ['Fee Invoices'], teaching: ['Assignments', 'Assignment Submissions'],
    timetable: ['Timetable'], communication: ['Announcements'], accounts: ['User Accounts'], files: ['Files & Documents'], work: ['Work Management'],
  },
  teacher: {
    dashboard: [], students: ['Student Records'], attendance: ['Attendance Register'], examinations: ['Examinations', 'Exam Results'],
    teaching: ['Assignments', 'Assignment Submissions'], timetable: ['Timetable'], communication: ['Announcements'], work: ['Work Management'],
  },
  student: {
    dashboard: [], attendance: ['Attendance Register'], examinations: ['Exam Results'], fees: ['Fee Invoices'],
    teaching: ['Assignments', 'Assignment Submissions'], timetable: ['Timetable'], communication: ['Announcements'],
  },
  parent: {
    dashboard: [], attendance: ['Attendance Register'], examinations: ['Exam Results'], fees: ['Fee Invoices'],
    teaching: ['Assignments'], timetable: ['Timetable'], communication: ['Announcements'],
  },
  accountant: {
    dashboard: [], fees: ['Fee Invoices'], work: ['Work Management'],
  },
  exam_officer: {
    dashboard: [], examinations: ['Examinations', 'Exam Results'],
    communication: ['Announcements'], work: ['Work Management'],
  },
}

export function roleNavigationGroups(role: AppRole) {
  const permissions = rolePageAccess[role]
  return navigationCatalog
    .map(group => ({ ...group, items: permissions[group.key] ?? [] }))
    .filter(group => group.key === 'dashboard' || group.items.length > 0)
}
