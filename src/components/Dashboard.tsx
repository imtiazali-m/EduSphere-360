import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowRight, BookOpen, Building2, CalendarCheck, CalendarClock, CalendarDays,
  ChevronDown, ChevronRight, ClipboardCheck, ClipboardList, DoorOpen, FileText,
  GraduationCap, LayoutDashboard, LogOut, Menu, Megaphone, Plus, Search, School, Settings,
  ShieldCheck, Users, Wallet, X, TrendingUp, UserRound, BrainCircuit, Calculator, Banknote,
  BookOpenCheck, HeartHandshake, MessageSquare, FileQuestion, ListChecks, BarChart3,
  Award, Library, Wrench, Database,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { roleNavigationGroups } from '../lib/navigationAccess'
import { navigationRoutes } from '../lib/navigationRoutes'
import { useAuth } from '../context/AuthContext'
import { modulesForRole, roleLabels } from '../lib/modules'
import { listRecords } from '../lib/data'
import { userFacingError } from '../lib/userErrors'
import { outstandingInvoiceBalance } from '../lib/finance'
import type { AppRole, ModuleConfig, RecordRow } from '../lib/types'
import { RecordModule } from './RecordModule'
import { AccountsModule } from './AccountsModule'
import { FilesModule } from './FilesModule'
import AdministrationModule from './AdministrationModule'
import { ReportsModule } from './ReportsModule'
import { ProfileModule } from './ProfileModule'

interface Props { onToast: (message: string, error?: boolean) => void }
type Dataset = Record<string, RecordRow[]>

const moduleIcons: Record<string, LucideIcon> = {
  overview: LayoutDashboard, students: GraduationCap, teachers: Users, attendance: CalendarCheck,
  faculty_attendance: CalendarCheck, exams: ClipboardCheck, exam_results: ClipboardList,
  fees: Wallet, fee_invoices: Wallet, assignments: BookOpen, timetable: CalendarDays,
  announcements: Megaphone, departments: Building2, classes: School, institution_classes: School,
  academic_sessions: CalendarDays, subjects: BookOpen, rooms: DoorOpen, institution_rooms: DoorOpen,
  administration: Settings, accounts: Calculator, files: FileText,
}

const catalogIcons: Record<string, LucideIcon> = {
  LayoutDashboard, BrainCircuit, Building2, School, BookOpen, GraduationCap, Users, Calculator,
  Wallet, Banknote, CalendarCheck, CalendarDays, BookOpenCheck, HeartHandshake, MessageSquare,
  FileQuestion, ClipboardCheck, ListChecks, BarChart3, Award, Library, Wrench,
}

function pageIcon(title: string, fallback: LucideIcon): LucideIcon {
  const t = title.toLowerCase()
  if (/student|admission|learner|family/.test(t)) return GraduationCap
  if (/employee|faculty|staff|teacher/.test(t)) return Users
  if (/fee|payment|invoice|discount/.test(t)) return Wallet
  if (/salary|payroll|payslip/.test(t)) return Banknote
  if (/attendance|leave/.test(t)) return CalendarCheck
  if (/exam|result|test|question|paper|marks/.test(t)) return ClipboardCheck
  if (/class|section|room/.test(t)) return School
  if (/subject|lesson|homework|assignment|syllabus|curriculum|learning/.test(t)) return BookOpen
  if (/report|analytics|insight/.test(t)) return BarChart3
  if (/certificate|document|id card/.test(t)) return Award
  if (/message|communication|announcement|whatsapp|notification/.test(t)) return MessageSquare
  if (/setting|permission|profile|security|audit/.test(t)) return Settings
  if (/library|book|reading/.test(t)) return Library
  if (/transport|fleet|visitor|inventory|asset|facility|backup|import|export/.test(t)) return Database
  return fallback
}

const pageRoutes = navigationRoutes

const tableLabels: Record<string, string> = {
  students: 'Student', teachers: 'Faculty member', attendance: 'Attendance entry', exams: 'Examination',
  exam_results: 'Exam result', fee_invoices: 'Fee invoice', assignments: 'Assignment',
  timetable_entries: 'Timetable entry', announcements: 'Announcement',
}
const tableToModule: Record<string, string> = {
  fee_invoices: 'fees', timetable_entries: 'timetable',
}

function firstText(row: RecordRow | undefined, keys: string[], fallback: string) {
  if (!row) return fallback
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return fallback
}
function shortDate(value: unknown) {
  if (typeof value !== 'string' || !value) return 'Recently added'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Recently added' : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
function money(value: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(value)
}
function getRows(data: Dataset, key: string) { return data[key] ?? [] }
function sumOutstanding(rows: RecordRow[]) {
  return rows.reduce((total, row) => total + outstandingInvoiceBalance(row), 0)
}

function buildStats(role: AppRole, data: Dataset) {
  const students = getRows(data, 'students')
  const teachers = getRows(data, 'teachers')
  const attendance = getRows(data, 'attendance')
  const exams = getRows(data, 'exams')
  const results = getRows(data, 'exam_results')
  const assignments = getRows(data, 'assignments')
  const invoices = getRows(data, 'fee_invoices')
  const unpaid = sumOutstanding(invoices)
  const present = attendance.filter(row => row.status === 'present').length
  if (role === 'owner' || role === 'admin') return [
    { label: 'Students', value: students.length.toLocaleString(), hint: 'Registered learner profiles', icon: GraduationCap, tone: 'blue', route: 'students' },
    { label: 'Faculty & staff', value: teachers.length.toLocaleString(), hint: 'Institution team records', icon: Users, tone: 'violet', route: 'teachers' },
    { label: 'Attendance entries', value: attendance.length.toLocaleString(), hint: `${present} marked present`, icon: CalendarCheck, tone: 'green', route: 'attendance' },
    { label: 'Outstanding fees', value: money(unpaid), hint: `${invoices.length} invoices recorded`, icon: Wallet, tone: 'amber', route: 'fees' },
  ]
  if (role === 'teacher') return [
    { label: 'Visible students', value: students.length.toLocaleString(), hint: 'Students in your permitted view', icon: GraduationCap, tone: 'blue', route: 'students' },
    { label: 'Assignments', value: assignments.length.toLocaleString(), hint: 'Coursework in your workspace', icon: BookOpen, tone: 'violet', route: 'assignments' },
    { label: 'Examinations', value: exams.length.toLocaleString(), hint: 'Schedules in your workspace', icon: ClipboardCheck, tone: 'amber', route: 'exams' },
    { label: 'Attendance entries', value: attendance.length.toLocaleString(), hint: `${present} marked present`, icon: CalendarCheck, tone: 'green', route: 'attendance' },
  ]
  if (role === 'student') return [
    { label: 'Attendance records', value: attendance.length.toLocaleString(), hint: 'Your available attendance history', icon: CalendarCheck, tone: 'green', route: 'attendance' },
    { label: 'Assignments', value: assignments.length.toLocaleString(), hint: 'Available coursework', icon: BookOpen, tone: 'violet', route: 'assignments' },
    { label: 'Exam results', value: results.length.toLocaleString(), hint: 'Published results available to you', icon: ClipboardCheck, tone: 'blue', route: 'exam_results' },
    { label: 'Fee balance', value: money(unpaid), hint: 'Outstanding amount in your records', icon: Wallet, tone: 'amber', route: 'fees' },
  ]
  if (role === 'parent') return [
    { label: 'Attendance records', value: attendance.length.toLocaleString(), hint: 'Linked learner attendance', icon: CalendarCheck, tone: 'green', route: 'attendance' },
    { label: 'Assignments', value: assignments.length.toLocaleString(), hint: 'Available coursework', icon: BookOpen, tone: 'violet', route: 'assignments' },
    { label: 'Exam results', value: results.length.toLocaleString(), hint: 'Results shared with your account', icon: ClipboardCheck, tone: 'blue', route: 'exam_results' },
    { label: 'Fee balance', value: money(unpaid), hint: 'Outstanding amount in your records', icon: Wallet, tone: 'amber', route: 'fees' },
  ]
  if (role === 'accountant') return [
    { label: 'Invoices', value: invoices.length.toLocaleString(), hint: 'Recorded fee invoices', icon: FileText, tone: 'blue', route: 'fees' },
    { label: 'Outstanding', value: money(unpaid), hint: 'Unpaid and partial balances', icon: Wallet, tone: 'amber', route: 'fees' },
    { label: 'Collected', value: money(invoices.reduce((n, r) => n + Number(r.paid_amount ?? 0), 0)), hint: 'Payments recorded', icon: TrendingUp, tone: 'green', route: 'fees' },
    { label: 'Students', value: students.length.toLocaleString(), hint: 'Visible learner records', icon: GraduationCap, tone: 'violet', route: 'students' },
  ]
  return [
    { label: 'Examinations', value: exams.length.toLocaleString(), hint: 'Exam schedules', icon: ClipboardCheck, tone: 'blue', route: 'exams' },
    { label: 'Results', value: results.length.toLocaleString(), hint: 'Result records', icon: ClipboardList, tone: 'violet', route: 'exam_results' },
    { label: 'Students', value: students.length.toLocaleString(), hint: 'Visible learner records', icon: GraduationCap, tone: 'green', route: 'students' },
    { label: 'Assignments', value: assignments.length.toLocaleString(), hint: 'Academic coursework', icon: BookOpen, tone: 'amber', route: 'assignments' },
  ]
}

function actionsForRole(role: AppRole) {
  if (role === 'owner' || role === 'admin') return [
    { key: 'students', label: 'Add a student', detail: 'Register a learner', icon: GraduationCap },
    { key: 'teachers', label: 'Add faculty', detail: 'Create a staff record', icon: Users },
    { key: 'attendance', label: 'Record attendance', detail: 'Mark a class session', icon: CalendarCheck },
    { key: 'accounts', label: 'Create an account', detail: 'Invite a portal user', icon: ShieldCheck },
  ]
  if (role === 'teacher') return [
    { key: 'attendance', label: 'Record attendance', detail: 'Update class attendance', icon: CalendarCheck },
    { key: 'assignments', label: 'Manage assignments', detail: 'Create coursework', icon: BookOpen },
    { key: 'exams', label: 'View examinations', detail: 'Check exam schedules', icon: ClipboardCheck },
    { key: 'exam_results', label: 'Enter results', detail: 'Review student results', icon: ClipboardList },
  ]
  if (role === 'student') return [
    { key: 'assignments', label: 'My assignments', detail: 'Review coursework', icon: BookOpen },
    { key: 'exam_results', label: 'My results', detail: 'View available marks', icon: ClipboardCheck },
    { key: 'timetable', label: 'My timetable', detail: 'Check class schedule', icon: CalendarDays },
    { key: 'announcements', label: 'Announcements', detail: 'Read institution updates', icon: Megaphone },
  ]
  if (role === 'parent') return [
    { key: 'attendance', label: 'Attendance', detail: 'Review linked learner records', icon: CalendarCheck },
    { key: 'exam_results', label: 'Academic progress', detail: 'View shared results', icon: ClipboardCheck },
    { key: 'fees', label: 'Fee information', detail: 'Review invoices and balance', icon: Wallet },
    { key: 'announcements', label: 'Announcements', detail: 'Read institution updates', icon: Megaphone },
  ]
  if (role === 'accountant') return [
    { key: 'fees', label: 'Fee invoices', detail: 'Review payments and balances', icon: Wallet },
    { key: 'students', label: 'Student directory', detail: 'Look up learner records', icon: GraduationCap },
  ]
  return [
    { key: 'exams', label: 'Examinations', detail: 'Manage exam schedules', icon: ClipboardCheck },
    { key: 'exam_results', label: 'Exam results', detail: 'Review published results', icon: ClipboardList },
    { key: 'students', label: 'Student directory', detail: 'View permitted students', icon: GraduationCap },
  ]
}

function Overview({ onNavigate }: { onNavigate: (key: string) => void }) {
  const { user, mode } = useAuth()
  const [data, setData] = useState<Dataset>({})
  const [loading, setLoading] = useState(true)
  const [loadNote, setLoadNote] = useState('')
  const available = useMemo(() => modulesForRole(user!.role), [user?.role])

  useEffect(() => {
    let live = true
    async function load() {
      setLoading(true)
      setLoadNote('')
      const uniqueTables = [...new Set(available.map(module => module.table))]
      const entries = await Promise.all(uniqueTables.map(async table => {
        try { return [table, await listRecords(mode, user!, table)] as const }
        catch (error) {
          const message = userFacingError(error, 'Some dashboard information could not be loaded. Refresh the workspace or try again later.')
          if (live) setLoadNote(message)
          return [table, []] as const
        }
      }))
      if (live) {
        setData(Object.fromEntries(entries))
        setLoading(false)
      }
    }
    void load()
    return () => { live = false }
  }, [mode, user?.id, user?.institutionId, available])

  const stats = useMemo(() => buildStats(user!.role, data), [user?.role, data])
  const actions = actionsForRole(user!.role).filter(action => action.key === 'accounts' || action.key === 'files' || available.some(m => m.key === action.key))
  const studentProfile = getRows(data, 'students').find(row => row.id === user?.linkedStudentId) ?? getRows(data, 'students')[0]
  const recent = useMemo(() => Object.entries(data).flatMap(([table, rows]) => rows.map(row => ({ table, row })))
    .sort((a, b) => String(b.row.created_at ?? '').localeCompare(String(a.row.created_at ?? ''))).slice(0, 6), [data])
  const welcome = user!.role === 'owner' || user!.role === 'admin'
    ? 'Your institution, brought into focus.'
    : user!.role === 'teacher' ? 'Your teaching day, organised.'
      : user!.role === 'parent' ? 'A clearer view of your learner’s progress.'
        : user!.role === 'student' ? 'Your learning journey, in one place.'
          : user!.role === 'accountant' ? 'A clear view of your institution’s finances.'
            : 'Your examination workspace, at a glance.'
  const primaryAction = actions[0]
  const now = new Date()
  const today = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const attendance = getRows(data, 'attendance')
  const presentCount = attendance.filter(row => String(row.status ?? '').toLowerCase() === 'present').length
  const absentCount = attendance.filter(row => String(row.status ?? '').toLowerCase() === 'absent').length
  const lateCount = attendance.filter(row => String(row.status ?? '').toLowerCase() === 'late').length
  const presentPercent = attendance.length ? Math.round((presentCount / attendance.length) * 100) : 0

  return <div className="pro-dashboard-page">
    <header className="pro-dashboard-heading">
      <div><div className="pro-section-kicker">INSTITUTION WORKSPACE <span /> OVERVIEW</div><h1>{greeting}, {user!.fullName.split(' ')[0]}.</h1><p>{welcome}</p></div>
      <div className="pro-dashboard-heading-actions"><span className="pro-date-chip"><CalendarClock size={15}/>{today}</span>{primaryAction && <button className="pro-create-button" onClick={() => onNavigate(primaryAction.key)}><Plus size={16}/>{primaryAction.label}</button>}</div>
    </header>

    <section className={`pro-campus-banner role-${user!.role}`}>
      <div className="pro-campus-copy"><span className="pro-campus-label">YOUR CAMPUS AT A GLANCE</span><h2>{user!.institutionName}</h2><p>{welcome} Your workspace brings the people, learning and operations of your institution together.</p><div className="pro-campus-meta"><span><i className="pro-status-dot" />Cloud workspace connected</span><span><ShieldCheck size={14}/> {roleLabels[user!.role]} access</span></div></div>
      <div className="pro-campus-emblem"><div className="pro-emblem-orbit orbit-outer"/><div className="pro-emblem-orbit orbit-inner"/><div className="pro-emblem-center"><GraduationCap size={34}/><b>360</b></div><span className="pro-emblem-caption">ONE CONNECTED CAMPUS</span></div>
    </section>

    <div className="pro-section-heading"><div><span className="pro-section-kicker">LIVE WORKSPACE SUMMARY</span><h2>Key metrics</h2></div><span className="pro-live-label"><i />{loading ? 'Updating records' : 'Based on available records'}</span></div>
    <section className="pro-metrics-grid">
      {stats.map((stat, index) => <button className={`pro-metric-card metric-${index + 1}`} key={stat.label} onClick={() => onNavigate(stat.route)}>
        <span className="pro-metric-icon"><stat.icon size={20}/></span><span className="pro-metric-label">{stat.label}</span><strong>{loading ? '—' : stat.value}</strong><small>{stat.hint}</small><span className="pro-metric-open"><ArrowRight size={16}/></span>
      </button>)}
    </section>

    <section className="pro-dashboard-grid">
      <div className="pro-dashboard-panel pro-activity-panel">
        <div className="pro-panel-heading"><div><span className="pro-section-kicker">WHAT’S HAPPENING</span><h2>Recent activity</h2><p>The latest records visible in your workspace.</p></div><button onClick={() => onNavigate(available[0]?.key ?? 'overview')}>View workspace <ArrowRight size={15}/></button></div>
        {loading ? <div className="pro-loading-state"><span /> Loading your institution records…</div> : recent.length ? <div className="pro-activity-list">{recent.map(({ table, row }, index) => {
          const title = firstText(row, ['full_name', 'title', 'fee_title', 'student_name', 'exam_title', 'admission_no'], tableLabels[table] ?? 'Record')
          const subtitle = firstText(row, ['class_name', 'subject', 'department', 'admission_no', 'audience'], tableLabels[table] ?? 'Institution record')
          const route = tableToModule[table] ?? table
          const Icon = moduleIcons[route] ?? FileText
          return <button className="pro-activity-row" key={`${table}-${row.id}`} onClick={() => onNavigate(route)}><span className={`pro-activity-icon activity-${index % 4}`}><Icon size={17}/></span><span className="pro-activity-text"><b>{title}</b><small>{tableLabels[table] ?? 'Record'} <i /> {subtitle}</small></span><span className="pro-activity-date">{shortDate(row.created_at)}</span><ArrowRight size={15}/></button>
        })}</div> : <div className="pro-empty-state"><span><FileText size={24}/></span><b>Your activity feed starts here</b><small>Records created in your permitted modules will appear here.</small></div>}
        {loadNote && <div className="pro-data-note"><Activity size={15}/><span>Some dashboard information could not be loaded: {loadNote}</span></div>}
      </div>

      <aside className="pro-dashboard-panel pro-quick-panel">
        <div className="pro-panel-heading"><div><span className="pro-section-kicker">GET THINGS DONE</span><h2>Quick actions</h2><p>Jump straight into your common tasks.</p></div></div>
        <div className="pro-quick-list">{actions.map((action, index) => <button className="pro-quick-action" key={action.key} onClick={() => onNavigate(action.key)}><span className={`pro-quick-number quick-${index + 1}`}>0{index + 1}</span><span className="pro-quick-action-icon"><action.icon size={18}/></span><span><b>{action.label}</b><small>{action.detail}</small></span><ArrowRight size={16}/></button>)}</div>
        {['student', 'parent'].includes(user!.role) && <div className="pro-linked-learner"><span><UserRound size={19}/></span><div><small>LINKED LEARNER</small><b>{studentProfile ? firstText(studentProfile, ['full_name'], 'Student profile') : 'No student linked yet'}</b><em>{studentProfile ? firstText(studentProfile, ['class_name'], 'Class not set') : 'Ask the institution administrator to link your account.'}</em></div></div>}
      </aside>

      <section className="pro-dashboard-panel pro-attendance-panel">
        <div className="pro-panel-heading"><div><span className="pro-section-kicker">ATTENDANCE SNAPSHOT</span><h2>Presence overview</h2><p>Distribution across attendance records available to you.</p></div><span className="pro-panel-count">{attendance.length} records</span></div>
        <div className="pro-attendance-content"><div className="pro-attendance-ring" style={{ background: `conic-gradient(#b4d96e 0 ${presentPercent}%, #e8b16e ${presentPercent}% ${attendance.length ? Math.min(100, presentPercent + Math.round(lateCount / attendance.length * 100)) : 0}%, #e6e9e1 0)` }}><div><b>{attendance.length ? `${presentPercent}%` : '—'}</b><small>Present</small></div></div><div className="pro-attendance-legend"><div><i className="present"/><span>Present</span><b>{loading ? '—' : presentCount}</b></div><div><i className="late"/><span>Late</span><b>{loading ? '—' : lateCount}</b></div><div><i className="absent"/><span>Absent</span><b>{loading ? '—' : absentCount}</b></div><div className="pro-attendance-total"><span>Total records</span><b>{loading ? '—' : attendance.length}</b></div></div></div>
      </section>

      <div className="pro-dashboard-note"><ShieldCheck size={17}/><span><b>Your workspace is permission-aware.</b> All figures and records shown here reflect information available to your signed-in role.</span></div>
    </section>
  </div>
}

const quickAccessByRole: Record<AppRole, Array<{ title: string; key: string; icon: LucideIcon }>> = {
  owner: [
    { title: 'Student Records', key: 'students', icon: GraduationCap },
    { title: 'Attendance Register', key: 'attendance', icon: CalendarCheck },
    { title: 'Fee Invoices', key: 'fees', icon: Wallet },
    { title: 'Files & Documents', key: 'files', icon: FileText },
  ],
  admin: [
    { title: 'Student Records', key: 'students', icon: GraduationCap },
    { title: 'Attendance Register', key: 'attendance', icon: CalendarCheck },
    { title: 'Fee Invoices', key: 'fees', icon: Wallet },
    { title: 'Files & Documents', key: 'files', icon: FileText },
  ],
  teacher: [
    { title: 'Attendance Register', key: 'attendance', icon: CalendarCheck },
    { title: 'Assignments', key: 'assignments', icon: BookOpen },
    { title: 'Assignment Submissions', key: 'assignment_submissions', icon: ClipboardList },
    { title: 'Announcements', key: 'announcements', icon: Megaphone },
  ],
  student: [
    { title: 'Assignments', key: 'assignments', icon: BookOpen },
    { title: 'Exam Results', key: 'exam_results', icon: ClipboardCheck },
    { title: 'Timetable', key: 'timetable', icon: CalendarDays },
    { title: 'Announcements', key: 'announcements', icon: Megaphone },
  ],
  parent: [
    { title: 'Attendance Register', key: 'attendance', icon: CalendarCheck },
    { title: 'Exam Results', key: 'exam_results', icon: ClipboardCheck },
    { title: 'Fee Invoices', key: 'fees', icon: Wallet },
    { title: 'Announcements', key: 'announcements', icon: Megaphone },
  ],
  accountant: [
    { title: 'Fee Invoices', key: 'fees', icon: Wallet },
    { title: 'Accounts', key: 'accounts', icon: Calculator },
  ],
  exam_officer: [
    { title: 'Examinations', key: 'exams', icon: ClipboardCheck },
    { title: 'Exam Results', key: 'exam_results', icon: ClipboardList },
    { title: 'Announcements', key: 'announcements', icon: Megaphone },
  ],
}

const adminModuleLabels: Record<string, string> = {
  departments: 'Departments', programs: 'Programs', classes: 'Classes & Sections',
  academic_sessions: 'Academic Sessions', subjects: 'Subjects', rooms: 'Rooms & Facilities',
}

export function Dashboard({ onToast }: Props) {
  const { user, mode, signOut } = useAuth()
  const [active, setActive] = useState('overview')
  const [activePage, setActivePage] = useState('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['administration'])
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const available = useMemo(() => modulesForRole(user!.role), [user?.role])
  const activeModule = available.find(module => module.key === active)
  const visibleGroups = useMemo(() => roleNavigationGroups(user!.role), [user?.role])
  const quickAccessItems = quickAccessByRole[user!.role]
  const searchResults = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    if (!query) return []
    const items = visibleGroups.flatMap(group => (group.key === 'dashboard' ? ['Dashboard'] : group.items).map(title => ({
      title, group: group.label, route: pageRoutes[title],
    })))
    return items.filter(item => item.route && `${item.title} ${item.group}`.toLowerCase().includes(query)).slice(0, 8)
  }, [searchText, visibleGroups])

  function navigate(key: string) {
    if (key === 'overview') {
      setActive('overview'); setActivePage('Dashboard')
    } else if (key.startsWith('admin:')) {
      const subkey = key.slice(6)
      setActive(key); setActivePage(adminModuleLabels[subkey] ?? 'Administration')
    } else if (key === 'accounts' || key === 'files' || key === 'reports' || key === 'profile' || available.some(module => module.key === key)) {
      const module = available.find(item => item.key === key)
      setActive(key)
      setActivePage(key === 'accounts' ? 'User Accounts' : key === 'files' ? 'Files & Documents' : key === 'reports' ? 'Reports' : key === 'profile' ? 'My Profile' : module?.title ?? key)
    } else {
      onToast('This workspace is not enabled for your role.', true)
      return
    }
    setSidebarOpen(false); setSearchText(''); setSearchOpen(false); setProfileOpen(false)
  }

  function navigateCatalogPage(title: string) {
    const route = pageRoutes[title]
    if (!route) { onToast('This menu item has no connected workflow yet.', true); return }
    navigate(route)
    setActivePage(title)
  }

  function toggleGroup(key: string) {
    setExpandedGroups(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])
  }

  function selectSearchResult(result: { title: string; group: string; route?: string }) {
    if (!result.route) return
    navigate(result.route)
    setActivePage(result.title)
  }

  async function logout() {
    await signOut()
    setProfileOpen(false)
    window.location.hash = '#/'
  }

  const adminKey = active.startsWith('admin:') ? active.slice(6) : undefined
  const pageTitle = activePage

  return <div className={`pro-app-shell ${sidebarOpen ? 'navigation-open' : ''}`}>
    <aside className={`pro-sidebar ${sidebarOpen ? 'is-open' : ''}`} aria-hidden={!sidebarOpen}>
      <div className="pro-sidebar-brand"><div className="pro-sidebar-mark"><GraduationCap size={25}/></div><div><b>EduSphere <i>360</i></b><small>INSTITUTION MANAGEMENT</small></div><button className="pro-mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={21}/></button></div>
      <div className="pro-institution-card"><span className="pro-institution-symbol"><Building2 size={20}/></span><span><b>{user?.institutionName}</b><small>{roleLabels[user!.role]}</small></span></div>
      <nav className="pro-navigation" aria-label="Institution workspace">
        {visibleGroups.map(group => {
          const GroupIcon = catalogIcons[group.icon] ?? LayoutDashboard
          if (group.key === 'dashboard') return <section className="pro-nav-group" key={group.key}>
            <button className={`pro-nav-group-head pro-nav-dashboard-link ${active === 'overview' ? 'active' : ''}`} onClick={() => navigate('overview')} aria-current={active === 'overview' ? 'page' : undefined}>
              <span className="pro-nav-group-icon"><GroupIcon size={19}/></span><span className="pro-nav-group-name">Dashboard</span>
            </button>
          </section>
          const isExpanded = expandedGroups.includes(group.key)
          return <section className={`pro-nav-group ${isExpanded ? 'expanded' : ''}`} key={group.key}>
            <button className="pro-nav-group-head" aria-expanded={isExpanded} onClick={() => toggleGroup(group.key)}><span className="pro-nav-group-icon"><GroupIcon size={19}/></span><span className="pro-nav-group-name">{group.label}</span><ChevronRight className="pro-nav-chevron" size={17}/></button>
            {isExpanded && <div className="pro-nav-children">{group.items.map(item => {
              const route = pageRoutes[item]
              const isActive = activePage === item
              const ItemIcon = pageIcon(item, GroupIcon)
              return <button key={item} className={`pro-nav-item ${isActive ? 'active' : ''}`} aria-current={isActive ? 'page' : undefined} onClick={() => navigateCatalogPage(item)}><span className="pro-nav-icon"><ItemIcon size={16}/></span><span className="pro-nav-title">{item}</span>{route && <i className="pro-nav-connected" title="Connected workspace"/>}</button>
            })}</div>}
          </section>
        })}
        <section className="pro-quick-access" aria-label="Quick access">
          <div className="pro-nav-section-label">QUICK ACCESS</div>
          {quickAccessItems.map(item => <button key={item.key} className={`pro-nav-item ${active === item.key ? 'active' : ''}`} onClick={() => navigate(item.key)}><span className="pro-nav-icon"><item.icon size={15}/></span><span className="pro-nav-title">{item.title}</span></button>)}
        </section>
      </nav>
    </aside>
    {sidebarOpen && <button className="pro-sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}/>}

    <main className="pro-main-shell">
      <header className="pro-topbar">
        <div className="pro-topbar-left"><button className="pro-mobile-menu" onClick={() => setSidebarOpen(open => !open)} aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={sidebarOpen}><Menu size={19}/><span>Menu</span></button><div className="pro-breadcrumb"><span>EduSphere 360</span><i>/</i><b>{pageTitle}</b></div></div>
        <div className="pro-topbar-right">
          <div className="pro-search-wrap">
            <label className="pro-global-search"><Search size={16}/><input aria-label="Search workspace" placeholder="Search workspace…" value={searchText} onFocus={() => setSearchOpen(true)} onChange={event => { setSearchText(event.target.value); setSearchOpen(true) }} onKeyDown={event => { if (event.key === 'Escape') { setSearchOpen(false); setSearchText('') } else if (event.key === 'Enter' && searchResults[0]) selectSearchResult(searchResults[0]) }}/>{searchText && <button type="button" aria-label="Clear search" onClick={() => { setSearchText(''); setSearchOpen(false) }}>×</button>}</label>
            {searchOpen && searchText.trim() && <div className="pro-search-results" role="listbox" aria-label="Workspace search results">{searchResults.length ? searchResults.map(result => <button type="button" key={`${result.group}-${result.title}`} role="option" onClick={() => selectSearchResult(result)}><span><b>{result.title}</b><small>{result.group}</small></span><ArrowRight size={15}/></button>) : <div className="pro-search-empty">No matching workspace found.</div>}</div>}
          </div>
          <div className="pro-profile-wrap"><button className="pro-profile-trigger" onClick={() => setProfileOpen(open => !open)} aria-expanded={profileOpen}><span className="pro-profile-avatar">{user?.fullName.slice(0, 1).toUpperCase()}</span><span className="pro-profile-copy"><b>{user?.fullName}</b><small>{roleLabels[user!.role]}</small></span><ChevronDown size={14}/></button>{profileOpen && <div className="pro-profile-menu"><div className="pro-profile-details"><b>{user?.fullName}</b><small>{user?.email}</small><small>{user?.institutionName}</small>{user?.institutionType && <small>Institution type: {user.institutionType.replaceAll('_', ' ')}</small>}<small>Account role: {roleLabels[user!.role]}</small><span className={`pro-profile-mode ${mode}`}>Cloud workspace</span></div><button type="button" onClick={() => void logout()}><LogOut size={15}/> Sign out</button></div>}</div>
        </div>
      </header>
      <div className="pro-module-stage">{active === 'overview' ? <Overview onNavigate={navigate}/> : adminKey ? <AdministrationModule key={adminKey} initialKey={adminKey as 'departments' | 'programs' | 'classes' | 'academic_sessions' | 'subjects' | 'rooms'}/> : active === 'accounts' ? <AccountsModule onToast={onToast}/> : active === 'files' ? <FilesModule onToast={onToast}/> : active === 'reports' ? <ReportsModule onToast={onToast}/> : active === 'profile' ? <ProfileModule/> : activeModule ? <RecordModule module={activeModule as ModuleConfig} onToast={onToast}/> : <Overview onNavigate={navigate}/>}</div>
    </main>
  </div>
}
