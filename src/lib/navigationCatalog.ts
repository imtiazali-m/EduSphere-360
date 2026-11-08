export interface NavigationCatalogGroup { key: string; label: string; icon: string; items: string[] }

// Only show destinations that are connected to a real React/Supabase workflow.
// Additional modules are added here only after their data screens and permissions are implemented.
export const navigationCatalog: NavigationCatalogGroup[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', items: [] },
  { key: 'administration', label: 'Administration', icon: 'Building2', items: ['Departments', 'Programs', 'Classes & Sections', 'Academic Sessions', 'Subjects', 'Rooms & Facilities'] },
  { key: 'students', label: 'Students', icon: 'GraduationCap', items: ['Student Records'] },
  { key: 'employees', label: 'Faculty & Staff', icon: 'Users', items: ['Faculty & Staff'] },
  { key: 'attendance', label: 'Attendance', icon: 'CalendarCheck', items: ['Attendance Register'] },
  { key: 'examinations', label: 'Examinations', icon: 'ClipboardCheck', items: ['Examinations', 'Exam Results'] },
  { key: 'fees', label: 'Fees & Payments', icon: 'Wallet', items: ['Fee Invoices'] },
  { key: 'teaching', label: 'Teaching & Learning', icon: 'BookOpen', items: ['Assignments', 'Assignment Submissions'] },
  { key: 'timetable', label: 'Timetable', icon: 'CalendarDays', items: ['Timetable'] },
  { key: 'communication', label: 'Communication', icon: 'Megaphone', items: ['Announcements'] },
  { key: 'accounts', label: 'User Accounts', icon: 'Users', items: ['User Accounts'] },
  { key: 'files', label: 'Files & Documents', icon: 'FileText', items: ['Files & Documents'] },
  { key: 'work', label: 'Work Management', icon: 'ClipboardList', items: ['Work Management'] },
  { key: 'reports', label: 'Reports', icon: 'BarChart3', items: ['Reports'] },
  { key: 'profile', label: 'My Profile', icon: 'UserRound', items: ['My Profile'] },
]
