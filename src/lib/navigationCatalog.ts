export interface NavigationCatalogGroup { key: string; label: string; icon: string; items: string[] }

// Keep the approved eight-group shell. Student Management is the only group
// expanded here; its submenus open distinct windows inside the existing student workspace.
export const navigationCatalog: NavigationCatalogGroup[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', items: [] },
  { key: 'students', label: 'Student Management', icon: 'GraduationCap', items: [
    'Overview', 'Admissions', 'Student Directory', 'Student Profile', 'Class Placement', 'Guardians',
    'Student Attendance', 'Student Exam Results', 'Student Assignments', 'Student Timetable',
    'Student Documentation', 'Student History',
  ] },
  { key: 'people', label: 'People & Staff', icon: 'Users', items: ['Faculty & Staff', 'User Account'] },
  { key: 'institution', label: 'Institute Administration', icon: 'Building2', items: ['Departments', 'Programs', 'Class Sections', 'Academic Sessions', 'Subjects', 'Rooms & Facilities', 'Files & Documentation'] },
  { key: 'academics', label: 'Academic Management', icon: 'BookOpen', items: ['Attendance Registration', 'Examination', 'Exam Results', 'Assignments', 'Assignment Submission', 'Timetable'] },
  { key: 'finance', label: 'Finance & Payments', icon: 'Wallet', items: ['Fees Invoices'] },
  { key: 'communication', label: 'Communication', icon: 'Megaphone', items: ['Announcements'] },
  { key: 'operations', label: 'Operations & Reports', icon: 'ClipboardList', items: ['Work Management', 'Reports'] },
]
