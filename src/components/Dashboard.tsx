import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowRight, BookOpen, Building2, CalendarCheck, CalendarDays,
  ChevronDown, ChevronRight, ClipboardCheck, ClipboardList, DoorOpen, FileText,
  GraduationCap, LayoutDashboard, LogOut, Menu, Megaphone, PieChart, Search,
  School, Settings, ShieldCheck, Users, Wallet, X, UserRound, BrainCircuit,
  Calculator, Banknote, TrendingUp, BookOpenCheck, HeartHandshake, MessageSquare,
  FileQuestion, ListChecks, BarChart3, Award, Library, Wrench, Database,
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
  FileQuestion, ClipboardCheck, ClipboardList, ListChecks, BarChart3, Award, Library, Wrench, FileText, UserRound, Megaphone,
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
  timetable_entries: 'Timetable entry', announcements: 'Announcement', departments: 'Department', programs: 'Program', classes: 'Class section', academic_sessions: 'Academic session', subjects: 'Subject', rooms: 'Room / facility',
}
const tableToModule: Record<string, string> = {
  fee_invoices: 'fees', timetable_entries: 'timetable', departments: 'admin:departments', programs: 'admin:programs', classes: 'admin:classes', academic_sessions: 'admin:academic_sessions', subjects: 'admin:subjects', rooms: 'admin:rooms',
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
    { label: 'Total Students', value: students.length.toLocaleString(), hint: 'Registered learner profiles', icon: GraduationCap, tone: 'blue', route: 'students' },
    { label: 'Faculty & Staff', value: teachers.length.toLocaleString(), hint: 'Institution team records', icon: Users, tone: 'green', route: 'teachers' },
    { label: 'Attendance Rate', value: (attendance.length ? Math.round((present / attendance.length) * 100) : 0) + '%', hint: present + ' present of ' + attendance.length + ' records', icon: CalendarCheck, tone: 'violet', route: 'attendance' },
    { label: 'Fees Collected', value: money(invoices.reduce((total, row) => total + Number(row.paid_amount ?? 0), 0)), hint: invoices.length + ' invoices recorded', icon: Wallet, tone: 'amber', route: 'fees' },
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

function rowDate(row: RecordRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
  }
  return null
}

function Overview({ onNavigate }: { onNavigate: (key: string) => void }) {
  const { user, mode } = useAuth()
  const [data, setData] = useState<Dataset>({})
  const [loading, setLoading] = useState(true)
  const [loadNote, setLoadNote] = useState('')
  const available = useMemo(() => modulesForRole(user!.role), [user?.role])
  const visibleGroups = useMemo(() => roleNavigationGroups(user!.role), [user?.role])

  useEffect(() => {
    let live = true
    async function load() {
      setLoading(true)
      setLoadNote('')
      const adminTables = ['departments', 'programs', 'classes', 'academic_sessions', 'subjects', 'rooms']
      const dashboardTables = user!.role === 'owner' || user!.role === 'admin'
        ? [...available.map(module => module.table), ...adminTables]
        : available.map(module => module.table)
      const uniqueTables = [...new Set(dashboardTables)]
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
  }, [mode, user?.id, user?.institutionId, user?.role, available])

  const stats = useMemo(() => buildStats(user!.role, data), [user?.role, data])
  const students = getRows(data, 'students')
  const teachers = getRows(data, 'teachers')
  const attendance = getRows(data, 'attendance')
  const exams = getRows(data, 'exams')
  const results = getRows(data, 'exam_results')
  const assignments = getRows(data, 'assignments')
  const submissions = getRows(data, 'assignment_submissions')
  const invoices = getRows(data, 'fee_invoices')
  const announcements = getRows(data, 'announcements')
  const tasks = getRows(data, 'work_tasks')
  const departments = getRows(data, 'departments')
  const programs = getRows(data, 'programs')
  const classes = getRows(data, 'classes')
  const subjects = getRows(data, 'subjects')
  const rooms = getRows(data, 'rooms')
  const timetable = getRows(data, 'timetable_entries')

  const now = new Date()
  const today = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const monthStarts = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1))
  const monthLabels = monthStarts.map(month => month.toLocaleDateString(undefined, { month: 'short' }))
  const monthlyCounts = (rows: RecordRow[], dateKeys: string[]) => monthStarts.map(month =>
    rows.filter(row => {
      const date = rowDate(row, dateKeys) ?? rowDate(row, ['created_at'])
      return date && date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
    }).length,
  )
  const trendSeries = [
    { label: 'Students', values: monthlyCounts(students, ['created_at']), color: '#2877ee' },
    { label: 'Attendance', values: monthlyCounts(attendance, ['attendance_date', 'created_at']), color: '#16a36b' },
    { label: 'Fees', values: monthlyCounts(invoices, ['created_at']), color: '#f28a24' },
  ]
  const chartMaximum = Math.max(1, ...trendSeries.flatMap(series => series.values))
  const chartX = (index: number) => 58 + index * 126
  const chartY = (value: number) => 188 - (value / chartMaximum) * 148
  const chartPoints = (values: number[]) => values.map((value, index) => chartX(index) + ',' + chartY(value)).join(' ')

  const moduleBreakdown = [
    { label: 'Admission & Students', count: students.length, color: '#2877ee' },
    { label: 'People & Staff', count: teachers.length, color: '#13a36b' },
    { label: 'Institute Administration', count: departments.length + programs.length + classes.length + subjects.length + rooms.length, color: '#11a8b6' },
    { label: 'Academic Management', count: attendance.length + exams.length + results.length + assignments.length + submissions.length + timetable.length, color: '#8b62e8' },
    { label: 'Finance & Payments', count: invoices.length, color: '#f39a2e' },
    { label: 'Communication', count: announcements.length, color: '#e66e9b' },
    { label: 'Operations & Reports', count: tasks.length, color: '#4169db' },
  ]
  const moduleTotal = moduleBreakdown.reduce((total, item) => total + item.count, 0)
  let runningPercent = 0
  const donutStops = moduleBreakdown.map(item => {
    const start = runningPercent
    const share = moduleTotal ? (item.count / moduleTotal) * 100 : 0
    runningPercent += share
    return item.color + ' ' + start + '% ' + runningPercent + '%'
  })
  const donutBackground = moduleTotal ? 'conic-gradient(' + donutStops.join(',') + ')' : 'conic-gradient(#dce5f1 0 100%)'
  const modulePercent = (count: number) => moduleTotal ? Math.round((count / moduleTotal) * 100) : 0

  const recent = useMemo(() => Object.entries(data).flatMap(([table, rows]) => rows.map(row => ({ table, row })))
    .sort((a, b) => String(b.row.created_at ?? '').localeCompare(String(a.row.created_at ?? ''))).slice(0, 4), [data])

  const upcomingEvents = [
    ...exams.map(row => ({ id: 'exam-' + row.id, title: firstText(row, ['title', 'exam_title'], 'Examination'), detail: firstText(row, ['class_name', 'subject'], 'Academic examination'), date: rowDate(row, ['exam_date']), label: 'Examination', route: 'exams' })),
    ...assignments.map(row => ({ id: 'assignment-' + row.id, title: firstText(row, ['title'], 'Assignment deadline'), detail: firstText(row, ['class_name', 'subject'], 'Coursework'), date: rowDate(row, ['due_date']), label: 'Assignment', route: 'assignments' })),
    ...tasks.map(row => ({ id: 'task-' + row.id, title: firstText(row, ['title'], 'Work deadline'), detail: firstText(row, ['assigned_to_name', 'task_type'], 'Institution task'), date: rowDate(row, ['due_date']), label: 'Work task', route: 'work_tasks' })),
  ].filter(event => event.date && event.date >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0)).slice(0, 3)

  const admissionStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const newAdmissions = students.filter(row => {
    const date = rowDate(row, ['created_at'])
    return date && date >= admissionStart
  }).length
  const isAdmin = user!.role === 'owner' || user!.role === 'admin'
  const quickStats = isAdmin
    ? [
      { label: 'New Admissions', value: newAdmissions, hint: 'This month', icon: GraduationCap, route: 'students', tone: 'blue' },
      { label: 'Departments', value: departments.length, hint: 'Institution units', icon: Building2, route: 'admin:departments', tone: 'violet' },
      { label: 'Assignments', value: assignments.length, hint: 'Coursework records', icon: BookOpen, route: 'assignments', tone: 'green' },
      { label: 'Exam Schedules', value: exams.length, hint: 'Assessments recorded', icon: ClipboardCheck, route: 'exams', tone: 'amber' },
    ]
    : [
      { label: 'Attendance', value: attendance.length, hint: 'Available records', icon: CalendarCheck, route: 'attendance', tone: 'blue' },
      { label: 'Assignments', value: assignments.length, hint: 'Coursework records', icon: BookOpen, route: 'assignments', tone: 'green' },
      { label: 'Exam Results', value: results.length, hint: 'Available results', icon: ClipboardCheck, route: 'exam_results', tone: 'violet' },
      { label: 'Announcements', value: announcements.length, hint: 'Shared notices', icon: Megaphone, route: 'announcements', tone: 'amber' },
      { label: 'Fees Invoices', value: invoices.length, hint: 'Available invoices', icon: Wallet, route: 'fees', tone: 'amber' },
      { label: 'Work Management', value: tasks.length, hint: 'Assigned tasks', icon: ClipboardList, route: 'work_tasks', tone: 'blue' },
    ].filter(item => available.some(module => module.key === item.route)).slice(0, 4)

  return <div className="ed360-dashboard">
    <header className="ed360-dashboard-heading">
      <div className="ed360-heading-title">
        <span className="ed360-heading-emblem"><GraduationCap size={25}/></span>
        <div><h1>Dashboard</h1><p>Welcome back, {user!.fullName.split(' ')[0]}! Here’s your institution overview.</p></div>
      </div>
      <div className="ed360-heading-date"><CalendarDays size={16}/><span>{today}</span></div>
    </header>

    <section className="ed360-metric-grid" aria-label="Institution statistics">
      {stats.map((stat, index) => <button type="button" className={'ed360-metric-card ed360-metric-' + (index + 1)} key={stat.label} onClick={() => onNavigate(stat.route)}>
        <span className="ed360-metric-icon"><stat.icon size={25}/></span>
        <span className="ed360-metric-copy"><small>{stat.label}</small><strong>{loading ? '—' : stat.value}</strong><em>{stat.hint}</em></span>
        <span className="ed360-metric-arrow"><ArrowRight size={16}/></span>
      </button>)}
    </section>

    <div className="ed360-dashboard-row ed360-dashboard-row-primary">
      <section className="ed360-panel ed360-academic-panel">
        <div className="ed360-panel-heading">
          <div><span className="ed360-panel-icon"><BarChart3 size={18}/></span><div><h2>Academic Overview</h2><p>Monthly activity across your available institutional records.</p></div></div>
          <span className="ed360-chart-period">{monthLabels[0]} – {monthLabels[5]}</span>
        </div>
        <div className="ed360-chart-legend">{trendSeries.map(series => <span key={series.label}><i style={{ background: series.color }}/>{series.label}</span>)}</div>
        <div className="ed360-line-chart">
          <svg viewBox="0 0 720 238" role="img" aria-label="Monthly student, attendance and fee invoice counts">
            {[0, 1, 2, 3, 4].map(tick => {
              const y = 40 + tick * 37
              const value = Math.round(chartMaximum * (1 - tick / 4))
              return <g key={tick}><line x1="56" y1={y} x2="690" y2={y} stroke="#e6edf6" strokeWidth="1"/><text x="43" y={y + 4} textAnchor="end" fill="#8190a4" fontSize="10">{value.toLocaleString()}</text></g>
            })}
            {trendSeries.map(series => {
              const points = chartPoints(series.values)
              const firstX = chartX(0)
              const lastX = chartX(5)
              return <g key={series.label}>
                <polygon points={points + ' ' + lastX + ',188 ' + firstX + ',188'} fill={series.color} opacity=".065"/>
                <polyline points={points} fill="none" stroke={series.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                {series.values.map((value, index) => <circle key={series.label + '-' + index} cx={chartX(index)} cy={chartY(value)} r="4" fill={series.color} stroke="#fff" strokeWidth="2"/>)}
              </g>
            })}
            {monthLabels.map((label, index) => <text key={label + index} x={chartX(index)} y="218" textAnchor="middle" fill="#52657f" fontSize="11">{label}</text>)}
          </svg>
        </div>
      </section>

      <section className="ed360-panel ed360-module-panel">
        <div className="ed360-panel-heading"><div><span className="ed360-panel-icon"><PieChart size={18}/></span><div><h2>Module Overview</h2><p>Records across your permitted workspaces.</p></div></div></div>
        <div className="ed360-module-content">
          <div className="ed360-donut" style={{ background: donutBackground }}><div className="ed360-donut-center"><strong>{visibleGroups.length}</strong><span>Sections</span></div></div>
          <div className="ed360-module-legend">
            {moduleBreakdown.map(item => <div key={item.label}><i style={{ background: item.color }}/><span>{item.label}</span><strong>{loading ? '—' : modulePercent(item.count) + '%'}</strong></div>)}
          </div>
        </div>
      </section>
    </div>

    <div className="ed360-dashboard-row ed360-dashboard-row-secondary">
      <section className="ed360-panel ed360-recent-panel">
        <div className="ed360-panel-heading"><div><span className="ed360-panel-icon"><Activity size={18}/></span><div><h2>Recent Activity</h2><p>The latest records added to your available workspaces.</p></div></div><button type="button" className="ed360-view-link" onClick={() => onNavigate(available[0]?.key ?? 'overview')}>View all <ArrowRight size={14}/></button></div>
        {loading ? <div className="ed360-empty">Loading recent records…</div> : recent.length ? <div className="ed360-recent-list">{recent.map(({ table, row }, index) => {
          const title = firstText(row, ['full_name', 'title', 'fee_title', 'student_name', 'exam_title', 'admission_no', 'name'], tableLabels[table] ?? 'Record')
          const detail = firstText(row, ['class_name', 'subject', 'department', 'admission_no', 'audience'], tableLabels[table] ?? 'Institution record')
          const route = tableToModule[table] ?? table
          const Icon = moduleIcons[route] ?? FileText
          return <button type="button" className="ed360-recent-row" key={table + '-' + row.id} onClick={() => onNavigate(route)}><span className={'ed360-recent-icon ed360-recent-icon-' + (index + 1)}><Icon size={16}/></span><span className="ed360-recent-copy"><strong>{title}</strong><small>{tableLabels[table] ?? 'Record'} · {detail}</small></span><time>{shortDate(row.created_at)}</time></button>
        })}</div> : <div className="ed360-empty">Your recent activity will appear here as records are added.</div>}
      </section>

      <section className="ed360-panel ed360-events-panel">
        <div className="ed360-panel-heading"><div><span className="ed360-panel-icon"><CalendarDays size={18}/></span><div><h2>Upcoming Events</h2><p>Examinations, assignment deadlines and tasks.</p></div></div><button type="button" className="ed360-view-link" onClick={() => onNavigate('exams')}>View all <ArrowRight size={14}/></button></div>
        {loading ? <div className="ed360-empty">Checking your upcoming dates…</div> : upcomingEvents.length ? <div className="ed360-events-list">{upcomingEvents.map(event => <button type="button" key={event.id} className="ed360-event-row" onClick={() => onNavigate(event.route)}><span className="ed360-event-date"><b>{event.date?.getDate()}</b><small>{event.date?.toLocaleDateString(undefined, { month: 'short' })}</small></span><span className="ed360-event-copy"><strong>{event.title}</strong><small>{event.detail}</small><em>{event.label}</em></span></button>)}</div> : <div className="ed360-empty">No upcoming examinations or deadlines have been recorded.</div>}
      </section>

      <section className="ed360-panel ed360-quick-stats-panel">
        <div className="ed360-panel-heading"><div><span className="ed360-panel-icon"><BarChart3 size={18}/></span><div><h2>Quick Statistics</h2><p>Useful counts from current records.</p></div></div></div>
        <div className="ed360-quick-stats-grid">{quickStats.map(item => <button type="button" className={'ed360-quick-stat ' + item.tone} key={item.label} onClick={() => onNavigate(item.route)}><span><item.icon size={19}/></span><small>{item.label}</small><strong>{loading ? '—' : item.value.toLocaleString()}</strong><em>{item.hint}</em></button>)}</div>
      </section>
    </div>
    {loadNote && <div className="ed360-data-note"><Activity size={15}/><span>{loadNote}</span></div>}
    <div className="ed360-dashboard-footnote"><ShieldCheck size={16}/><span>Figures reflect information available to your signed-in role and institution.</span></div>
  </div>
}

const quickAccessByRole: Record<AppRole, Array<{ title: string; key: string; icon: LucideIcon }>> = {
  owner: [
    { title: 'Attendance Registration', key: 'attendance', icon: CalendarCheck },
    { title: 'Fees Invoice', key: 'fees', icon: Wallet },
    { title: 'Files & Documentation', key: 'files', icon: FileText },
  ],
  admin: [
    { title: 'Attendance Registration', key: 'attendance', icon: CalendarCheck },
    { title: 'Fees Invoice', key: 'fees', icon: Wallet },
    { title: 'Files & Documentation', key: 'files', icon: FileText },
  ],
  teacher: [
    { title: 'Attendance Registration', key: 'attendance', icon: CalendarCheck },
    { title: 'Assignments', key: 'assignments', icon: BookOpen },
    { title: 'Assignment Submission', key: 'assignment_submissions', icon: ClipboardList },
  ],
  student: [
    { title: 'Assignments', key: 'assignments', icon: BookOpen },
    { title: 'Exam Results', key: 'exam_results', icon: ClipboardCheck },
    { title: 'Timetable', key: 'timetable', icon: CalendarDays },
  ],
  parent: [
    { title: 'Attendance Registration', key: 'attendance', icon: CalendarCheck },
    { title: 'Fees Invoice', key: 'fees', icon: Wallet },
    { title: 'Exam Results', key: 'exam_results', icon: ClipboardCheck },
  ],
  accountant: [
    { title: 'Fees Invoice', key: 'fees', icon: Wallet },
  ],
  exam_officer: [
    { title: 'Examination', key: 'exams', icon: ClipboardCheck },
    { title: 'Exam Results', key: 'exam_results', icon: ClipboardList },
    { title: 'Reports', key: 'reports', icon: BarChart3 },
  ],
}

const adminModuleLabels: Record<string, string> = {
  departments: 'Departments', programs: 'Programs', classes: 'Class Sections',
  academic_sessions: 'Academic Sessions', subjects: 'Subjects', rooms: 'Rooms & Facilities',
}

export function Dashboard({ onToast }: Props) {
  const { user, mode, signOut } = useAuth()
  const [active, setActive] = useState('overview')
  const [activePage, setActivePage] = useState('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['students', 'people', 'institution', 'academics', 'finance', 'communication', 'operations'])
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
      setActivePage(key === 'accounts' ? 'User Account' : key === 'files' ? 'Files & Documentation' : key === 'reports' ? 'Reports' : key === 'profile' ? 'My Profile' : module?.title ?? key)
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
      </nav>
      <section className="pro-quick-access" aria-label="Quick access">
        <div className="pro-nav-section-label">QUICK ACCESS</div>
        {quickAccessItems.map(item => <button key={item.key} className={`pro-nav-item ${active === item.key ? 'active' : ''}`} onClick={() => navigate(item.key)}><span className="pro-nav-icon"><item.icon size={15}/></span><span className="pro-nav-title">{item.title}</span></button>)}
      </section>
    </aside>
    {sidebarOpen && <button className="pro-sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}/>}

    <main className="pro-main-shell">
      <header className="pro-topbar">
        <div className="pro-topbar-left">
          <button className="pro-mobile-menu" onClick={() => setSidebarOpen(open => !open)} aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={sidebarOpen}><Menu size={19}/></button>
          <div className="pro-search-wrap">
            <label className="pro-global-search"><Search size={17}/><input aria-label="Search workspace" placeholder="Search modules, students, or records…" value={searchText} onFocus={() => setSearchOpen(true)} onChange={event => { setSearchText(event.target.value); setSearchOpen(true) }} onKeyDown={event => { if (event.key === 'Escape') { setSearchOpen(false); setSearchText('') } else if (event.key === 'Enter' && searchResults[0]) selectSearchResult(searchResults[0]) }}/>{searchText && <button type="button" aria-label="Clear search" onClick={() => { setSearchText(''); setSearchOpen(false) }}>×</button>}</label>
            {searchOpen && searchText.trim() && <div className="pro-search-results" role="listbox" aria-label="Workspace search results">{searchResults.length ? searchResults.map(result => <button type="button" key={result.group + '-' + result.title} role="option" onClick={() => selectSearchResult(result)}><span><b>{result.title}</b><small>{result.group}</small></span><ArrowRight size={15}/></button>) : <div className="pro-search-empty">No matching workspace found.</div>}</div>}
          </div>
        </div>
        <div className="pro-topbar-right">
          <div className="ed360-topbar-institution"><Building2 size={19}/><span><b>{user?.institutionName}</b><small><i className={'ed360-status-dot ' + (mode === 'cloud' ? 'is-cloud' : 'is-local')}/>{mode === 'cloud' ? 'Online' : 'Local workspace'}</small></span></div>
          <button type="button" className="pro-topbar-bell ed360-topbar-notice" aria-label="Open announcements" title="Open announcements" onClick={() => navigate(available.some(module => module.key === 'announcements') ? 'announcements' : 'overview')}><Megaphone size={18}/></button>
          <div className="pro-profile-wrap"><button className="pro-profile-trigger" onClick={() => setProfileOpen(open => !open)} aria-expanded={profileOpen}><span className="pro-profile-avatar">{user?.fullName.slice(0, 1).toUpperCase()}</span><span className="pro-profile-copy"><b>{user?.fullName}</b><small>{roleLabels[user!.role]}</small></span><ChevronDown size={14}/></button>{profileOpen && <div className="pro-profile-menu"><div className="pro-profile-details"><b>{user?.fullName}</b><small>{user?.email}</small><small>{user?.institutionName}</small>{user?.institutionType && <small>Institution type: {user.institutionType.replaceAll('_', ' ')}</small>}<small>Account role: {roleLabels[user!.role]}</small><span className={'pro-profile-mode ' + mode}>Cloud workspace</span></div>{['student', 'parent'].includes(user!.role) && <button type="button" onClick={() => navigate('profile')}><UserRound size={15}/> My Profile</button>}<button type="button" onClick={() => void logout()}><LogOut size={15}/> Sign out</button></div>}</div>
        </div>
      </header>
      <div className="pro-module-stage">{active === 'overview' ? <Overview onNavigate={navigate}/> : adminKey ? <AdministrationModule key={adminKey} initialKey={adminKey as 'departments' | 'programs' | 'classes' | 'academic_sessions' | 'subjects' | 'rooms'}/> : active === 'accounts' ? <AccountsModule onToast={onToast}/> : active === 'files' ? <FilesModule onToast={onToast}/> : active === 'reports' ? <ReportsModule onToast={onToast}/> : active === 'profile' ? <ProfileModule/> : activeModule ? <RecordModule module={activeModule as ModuleConfig} onToast={onToast}/> : <Overview onNavigate={navigate}/>}</div>
    </main>
  </div>
}
