export interface NavigationCatalogGroup { key: string; label: string; icon: string; items: string[] }

// Keep the sidebar organised around the real workflows available in the application.
// Each destination below is backed by an existing route and role permission.
export const navigationCatalog: NavigationCatalogGroup[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', items: [] },
  { key: 'admissions', label: 'Admissions & Students', icon: 'GraduationCap', items: ['Student Records'] },
  { key: 'people', label: 'People & Staff', icon: 'Users', items: ['Faculty & Staff', 'User Accounts'] },
  { key: 'administration', label: 'Institution Administration', icon: 'Building2', items: ['Departments', 'Programs', 'Classes & Sections', 'Academic Sessions', 'Subjects', 'Rooms & Facilities', 'Files & Documents'] },
  { key: 'academics', label: 'Academic Management', icon: 'BookOpen', items: ['Attendance Register', 'Examinations', 'Exam Results', 'Assignments', 'Assignment Submissions', 'Timetable'] },
  { key: 'finance', label: 'Finance & Payments', icon: 'Wallet', items: ['Fee Invoices'] },
  { key: 'communication', label: 'Communication', icon: 'Megaphone', items: ['Announcements'] },
  { key: 'operations', label: 'Operations & Reports', icon: 'ClipboardList', items: ['Work Management', 'Reports'] },
  { key: 'profile', label: 'My Profile', icon: 'UserRound', items: ['My Profile'] },
]
