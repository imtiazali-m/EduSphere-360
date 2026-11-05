import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowRight, Bell, BookOpen, CalendarCheck, CalendarClock, CalendarDays,
  ChevronDown, ClipboardCheck, ClipboardList, Command, FileText,
  GraduationCap, LayoutDashboard, LogOut, Menu, Megaphone, Plus, Search,
  ShieldCheck, Sparkles, Users, Wallet, X, TrendingUp, UserRound,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { modulesForRole, roleLabels } from '../lib/modules'
import { listRecords } from '../lib/data'
import type { AppRole, ModuleConfig, RecordRow } from '../lib/types'
import { RecordModule } from './RecordModule'
import { AccountsModule } from './AccountsModule'
import { FilesModule } from './FilesModule'

interface Props { onToast: (message: string, error?: boolean) => void }
type Dataset = Record<string, RecordRow[]>

const moduleIcons: Record<string, typeof LayoutDashboard> = {
  overview: LayoutDashboard, students: GraduationCap, teachers: Users, attendance: CalendarCheck, faculty_attendance: CalendarCheck,
  exams: ClipboardCheck, exam_results: ClipboardList, fees: Wallet, assignments: BookOpen,
  timetable: CalendarDays, announcements: Megaphone, accounts: Users, files: FileText,
}
const moduleGroups = [
  { label: 'WORKSPACE', keys: ['overview'] },
  { label: 'PEOPLE', keys: ['students', 'teachers', 'faculty_attendance'] },
  { label: 'ACADEMICS', keys: ['attendance', 'exams', 'exam_results', 'assignments', 'timetable'] },
  { label: 'OPERATIONS', keys: ['fees', 'announcements', 'accounts', 'files'] },
]
const tableLabels: Record<string, string> = {
  students: 'Student', teachers: 'Faculty member', attendance: 'Attendance entry', faculty_attendance: 'Faculty attendance entry', exams: 'Examination',
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
  return rows.reduce((total, row) => total + Math.max(0, Number(row.amount ?? 0) - Number(row.paid_amount ?? 0)), 0)
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
          const message = error instanceof Error ? error.message : 'Some dashboard data could not be loaded.'
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
  const recent = useMemo(() => {
    return Object.entries(data).flatMap(([table, rows]) => rows.map(row => ({ table, row })))
      .sort((a, b) => String(b.row.created_at ?? '').localeCompare(String(a.row.created_at ?? '')))
      .slice(0, 5)
  }, [data])
  const welcome = user!.role === 'owner' || user!.role === 'admin'
    ? 'Your institution at a glance.'
    : user!.role === 'teacher'
      ? 'Your teaching workspace, in one place.'
      : user!.role === 'parent'
        ? 'A clear view of your learner’s school life.'
        : user!.role === 'student'
          ? 'Your learning, organised in one place.'
          : user!.role === 'accountant'
            ? 'A clear view of fees and collections.'
            : 'Your examination workspace.'
  const primaryAction = actions[0]
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return <div className="page-content dashboard-page">
    <section className={`dashboard-hero role-${user!.role}`}>
      <div className="dashboard-hero-copy">
        <div className="dashboard-role-chip"><Sparkles size={14}/>{roleLabels[user!.role]}</div>
        <h1>Welcome back, {user!.fullName.split(' ')[0]}.</h1>
        <p>{welcome} You’re viewing <strong>{user!.institutionName}</strong>.</p>
        <div className="dashboard-hero-actions">
          {primaryAction && <button className="dashboard-primary-action" onClick={() => onNavigate(primaryAction.key)}><Plus size={16}/>{primaryAction.label}<ArrowRight size={15}/></button>}
          <span className="dashboard-date"><CalendarClock size={15}/>{today}</span>
        </div>
      </div>
      <div className="dashboard-hero-art" aria-hidden="true">
        <div className="hero-art-orbit orbit-one"/><div className="hero-art-orbit orbit-two"/>
        <div className="hero-art-core"><GraduationCap size={52}/><span>360</span></div>
        <div className="hero-art-float float-top"><Activity size={16}/><span>Connected learning</span></div>
        <div className="hero-art-float float-bottom"><ShieldCheck size={16}/><span>Role-aware access</span></div>
      </div>
    </section>

    <div className="dashboard-section-heading"><div><span className="eyebrow">YOUR OVERVIEW</span><h2>Key indicators</h2></div><span className={`dashboard-data-tag ${mode}`}>{mode === 'cloud' ? 'CLOUD WORKSPACE' : 'OFFLINE WORKSPACE'}</span></div>
    <section className="dashboard-stat-grid">
      {stats.map(stat => <button className="dashboard-stat-card" key={stat.label} onClick={() => onNavigate(stat.route)}>
        <div className={`dashboard-stat-icon ${stat.tone}`}><stat.icon size={20}/></div>
        <span className="dashboard-stat-label">{stat.label}</span>
        <strong>{loading ? '—' : stat.value}</strong>
        <small>{stat.hint}</small><ArrowRight className="dashboard-stat-arrow" size={16}/>
      </button>)}
    </section>

    <section className="dashboard-content-grid">
      <div className="dashboard-panel dashboard-recent-panel">
        <div className="dashboard-panel-heading"><div><span className="eyebrow">LATEST UPDATES</span><h2>Recent records</h2><p>Recently created items available to your account.</p></div><button className="dashboard-text-link" onClick={() => onNavigate(available[0]?.key ?? 'overview')}>Open workspace <ArrowRight size={15}/></button></div>
        {loading ? <div className="dashboard-empty"><span className="dashboard-loading-dot"/>Loading your records…</div> : recent.length ? <div className="dashboard-recent-list">{recent.map(({ table, row }) => {
          const title = firstText(row, ['full_name', 'title', 'fee_title', 'student_name', 'exam_title', 'admission_no'], tableLabels[table] ?? 'Record')
          const subtitle = firstText(row, ['class_name', 'subject', 'department', 'admission_no', 'audience'], tableLabels[table] ?? 'Institution record')
          const route = tableToModule[table] ?? table
          const Icon = moduleIcons[route] ?? FileText
          return <button className="dashboard-recent-row" key={`${table}-${row.id}`} onClick={() => onNavigate(route)}><span className="dashboard-recent-icon"><Icon size={17}/></span><span className="dashboard-recent-copy"><strong>{title}</strong><small>{tableLabels[table] ?? 'Record'} · {subtitle}</small></span><span className="dashboard-recent-date">{shortDate(row.created_at)}</span><ArrowRight size={15}/></button>
        })}</div> : <div className="dashboard-empty"><span className="dashboard-empty-icon"><FileText size={22}/></span><strong>No records yet</strong><span>Items you add to your permitted modules will appear here.</span></div>}
        {loadNote && <div className="dashboard-load-note"><Activity size={15}/><span>Some information could not be loaded: {loadNote}</span></div>}
      </div>

      <aside className="dashboard-panel dashboard-actions-panel">
        <div className="dashboard-panel-heading"><div><span className="eyebrow">SHORTCUTS</span><h2>Quick actions</h2><p>Go directly to common tasks.</p></div></div>
        <div className="dashboard-action-list">{actions.map(action => <button key={action.key} className="dashboard-action-row" onClick={() => onNavigate(action.key)}><span className="dashboard-action-icon"><action.icon size={18}/></span><span><strong>{action.label}</strong><small>{action.detail}</small></span><ArrowRight size={16}/></button>)}</div>
        {['student', 'parent'].includes(user!.role) && <div className="dashboard-linked-card"><div className="dashboard-linked-avatar"><UserRound size={19}/></div><div><small>LINKED LEARNER</small><strong>{studentProfile ? firstText(studentProfile, ['full_name'], 'Student profile') : 'No student linked yet'}</strong><span>{studentProfile ? firstText(studentProfile, ['class_name'], 'Class not set') : 'Ask the institution administrator to link your account.'}</span></div></div>}
      </aside>
    </section>

    <div className="dashboard-footnote"><ShieldCheck size={17}/><span><strong>Your information stays within its permitted workspace.</strong> Dashboard totals and recent records are based on information available to your signed-in role.</span></div>
  </div>
}

export function Dashboard({ onToast }: Props) {
  const { user, mode, signOut } = useAuth()
  const [active, setActive] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const available = useMemo(() => modulesForRole(user!.role), [user?.role])
  const activeModule = available.find(module => module.key === active)
  const extraItems = user && ['owner', 'admin'].includes(user.role)
    ? [{ key: 'accounts', title: 'User accounts' }, { key: 'files', title: 'Files & documents' }]
    : []
  const allMenuItems = [{ key: 'overview', title: 'Overview' }, ...available.map(m => ({ key: m.key, title: m.title })), ...extraItems]
  const filteredMenuItems = searchText.trim()
    ? allMenuItems.filter(item => item.title.toLowerCase().includes(searchText.toLowerCase()))
    : allMenuItems
  const navGroups = moduleGroups.map(group => ({ ...group, items: filteredMenuItems.filter(item => group.keys.includes(item.key)) })).filter(group => group.items.length)

  function navigate(key: string) { setActive(key); setSidebarOpen(false); setSearchText('') }
  async function logout() { await signOut(); setProfileOpen(false) }
  const pageTitle = active === 'overview' ? 'Overview' : active === 'accounts' ? 'User accounts' : active === 'files' ? 'Files & documents' : activeModule?.title ?? 'Workspace'

  return <div className="app-shell dashboard-app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><div className="brand-mark"><GraduationCap size={22}/></div><div><strong>EduSphere <span>360</span></strong><small>EDUCATION MANAGEMENT</small></div><button className="mobile-close icon-button" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="institution-switch"><div className="institution-avatar"><GraduationCap size={18}/></div><div><strong>{user?.institutionName}</strong><small>{user?.role === 'owner' ? 'Institution owner' : roleLabels[user!.role]}</small></div><ChevronDown size={15}/></div>
      <div className="sidebar-search"><Search size={15}/><input aria-label="Find a module" placeholder="Find a module…" value={searchText} onChange={event => setSearchText(event.target.value)}/><kbd>/</kbd></div>
      <nav className="sidebar-nav dashboard-sidebar-nav">{navGroups.map(group => <div className="sidebar-group" key={group.label}><span className="sidebar-label">{group.label}</span>{group.items.map(item => {
        const Icon = moduleIcons[item.key] ?? FileText
        return <button key={item.key} className={active === item.key ? 'active' : ''} onClick={() => navigate(item.key)}><Icon size={18}/><span>{item.title}</span>{active === item.key && <i/>}</button>
      })}</div>)}{filteredMenuItems.length === 0 && <p className="sidebar-no-results">No modules found.</p>}</nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><div className="help-icon"><Command size={17}/></div><div><strong>EduSphere 360</strong><small>{mode === 'local' ? 'Offline workspace' : 'Cloud-connected'}</small></div></div><button className="sidebar-nav-button" onClick={() => navigate('announcements')}><Bell size={17}/><span>Notifications</span></button><button className="sidebar-nav-button" onClick={() => void logout()}><LogOut size={17}/><span>Sign out</span></button></div>
    </aside>
    {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)}/>}
    <main className="main-shell dashboard-main-shell">
      <header className="app-topbar dashboard-topbar"><button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20}/></button><div className="breadcrumbs"><span>EduSphere 360</span><span>/</span><strong>{pageTitle}</strong></div><div className="topbar-right"><span className={`workspace-mode ${mode}`}><i/>{mode === 'local' ? 'Offline mode' : 'Cloud mode'}</span><button className="topbar-icon icon-button" onClick={() => navigate('announcements')} title="Announcements"><Bell size={18}/></button><div className="profile-wrap"><button className="profile-button" onClick={() => setProfileOpen(!profileOpen)}><span className="user-avatar">{user?.fullName.slice(0, 1).toUpperCase()}</span><span className="profile-meta"><strong>{user?.fullName}</strong><small>{roleLabels[user!.role]}</small></span><ChevronDown size={15}/></button>{profileOpen && <div className="profile-menu"><div><strong>{user?.email}</strong><small>{user?.institutionName}</small></div><button onClick={() => void logout()}><LogOut size={15}/> Sign out</button></div>}</div></div></header>
      {active === 'overview' ? <Overview onNavigate={navigate}/> : active === 'accounts' ? <AccountsModule onToast={onToast}/> : active === 'files' ? <FilesModule onToast={onToast}/> : activeModule ? <RecordModule module={activeModule as ModuleConfig} onToast={onToast}/> : <Overview onNavigate={navigate}/>}
    </main>
  </div>
}
