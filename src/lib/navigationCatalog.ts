export interface NavigationCatalogGroup { key: string; label: string; icon: string; items: string[] }

// Approved eight-group institution workflow. Each submenu resolves to its own
// role-authorised workspace in Dashboard.tsx.
export const navigationCatalog: NavigationCatalogGroup[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', items: [] },
  { key: 'students', label: 'Admission & Students', icon: 'GraduationCap', items: ['Student Record'] },
  { key: 'people', label: 'People & Staff', icon: 'Users', items: ['Faculty & Staff', 'User Account'] },
  { key: 'institution', label: 'Institute Administration', icon: 'Building2', items: ['Departments', 'Programs', 'Class Sections', 'Academic Sessions', 'Subjects', 'Rooms & Facilities', 'Files & Documentation'] },
  { key: 'academics', label: 'Academic Management', icon: 'BookOpen', items: ['Attendance Registration', 'Examination', 'Exam Results', 'Assignments', 'Assignment Submission', 'Timetable'] },
  { key: 'finance', label: 'Finance & Payments', icon: 'Wallet', items: ['Fees Invoices'] },
  { key: 'communication', label: 'Communication', icon: 'Megaphone', items: ['Announcements'] },
  { key: 'operations', label: 'Operations & Reports', icon: 'ClipboardList', items: ['Work Management', 'Reports'] },
]
