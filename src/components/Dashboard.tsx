import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowRight, Bell, BookOpen, Building2, CalendarCheck, CalendarClock, CalendarDays,
  ChevronDown, ChevronRight, ClipboardCheck, ClipboardList, DoorOpen, FileText,
  GraduationCap, LayoutDashboard, LogOut, Menu, Megaphone, Search, School, Settings,
  Users, Wallet, X, TrendingUp, UserRound, BrainCircuit, Calculator, Banknote,
  BookOpenCheck, HeartHandshake, MessageSquare, FileQuestion, ListChecks, BarChart3, PieChart,
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
  const collected = invoices.reduce((total, row) => total + Number(row.paid_amount ?? 0), 0)
  const attendanceRate = attendance.length ? Math.round(present / attendance.length * 100) + '%' : '—'
  if (role === 'owner' || role === 'admin') return [
    { label: 'Total Students', value: students.length.toLocaleString(), hint: 'Registered learner profiles', icon: GraduationCap, tone: 'blue', route: 'students' },
    { label: 'Faculty & Staff', value: teachers.length.toLocaleString(), hint: 'Institution team records', icon: Users, tone: 'green', route: 'teachers' },
    { label: 'Attendance Rate', value: attendanceRate, hint: present.toLocaleString() + ' present of ' + attendance.length.toLocaleString(), icon: CalendarCheck, tone: 'purple', route: 'attendance' },
    { label: 'Fees Collected', value: money(collected), hint: invoices.length.toLocaleString() + ' invoices on record', icon: Wallet, tone: 'amber', route: 'fees' },
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

type DashboardRange = 'month' | 'term' | 'year'

type ChartBucket = { start: Date; end: Date; label: string }
type TrendSeries = { label: string; color: string; values: number[] }

function parseRecordDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value.length === 10 ? value + 'T00:00:00' : value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function buildChartBuckets(range: DashboardRange, now: Date): ChartBucket[] {
  if (range === 'month') {
    const year = now.getFullYear()
    const month = now.getMonth()
    const lastDay = new Date(year, month + 1, 0).getDate()
    return [0, 1, 2, 3].map(index => {
      const firstDay = index * 7 + 1
      const finalDay = Math.min(firstDay + 6, lastDay)
      return {
        start: new Date(year, month, firstDay),
        end: new Date(year, month, finalDay, 23, 59, 59, 999),
        label: firstDay + '–' + finalDay,
      }
    })
  }
  const monthCount = range === 'term' ? 3 : 12
  return Array.from({ length: monthCount }, (_, index) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - monthCount + index, 1)
    const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999)
    return { start: monthDate, end, label: monthDate.toLocaleDateString(undefined, { month: 'short' }) }
  })
}

function countRowsInBuckets(rows: RecordRow[], field: string, buckets: ChartBucket[]) {
  const counts = buckets.map(() => 0)
  for (const row of rows) {
    const date = parseRecordDate(row[field] ?? row.created_at)
    if (!date) continue
    const bucketIndex = buckets.findIndex(bucket => date >= bucket.start && date <= bucket.end)
    if (bucketIndex >= 0) counts[bucketIndex] += 1
  }
  return counts
}

function buildAcademicTrend(data: Dataset, range: DashboardRange, now: Date) {
  const buckets = buildChartBuckets(range, now)
  const series: TrendSeries[] = [
    { label: 'Students', color: '#216fe8', values: countRowsInBuckets(getRows(data, 'students'), 'created_at', buckets) },
    { label: 'Attendance', color: '#19a65f', values: countRowsInBuckets(getRows(data, 'attendance'), 'attendance_date', buckets) },
    { label: 'Fees', color: '#f28b25', values: countRowsInBuckets(getRows(data, 'fee_invoices'), 'created_at', buckets) },
  ]
  return { buckets, series }
}

const groupTables: Record<string, string[]> = {
  students: ['students'],
  people: ['teachers'],
  institution: ['departments', 'programs', 'classes', 'academic_sessions', 'subjects', 'rooms'],
  academics: ['attendance', 'exams', 'exam_results', 'assignments', 'assignment_submissions', 'timetable_entries'],
  finance: ['fee_invoices'],
  communication: ['announcements'],
  operations: ['work_tasks'],
}

const groupColors: Record<string, string> = {
  students: '#2478ee',
  people: '#f18b24',
  institution: '#16a56a',
  academics: '#287e9c',
  finance: '#8b62e8',
  communication: '#16b8ae',
  operations: '#405bdc',
}

function buildModuleBreakdown(role: AppRole, data: Dataset) {
  return roleNavigationGroups(role)
    .filter(group => group.key !== 'dashboard')
    .map(group => ({
      key: group.key,
      label: group.label,
      value: (groupTables[group.key] ?? []).reduce((total, table) => total + getRows(data, table).length, 0),
      color: groupColors[group.key] ?? '#8093aa',
    }))
}

type UpcomingEvent = { title: string; detail: string; date: Date; route: string; kind: string }

function buildUpcomingEvents(data: Dataset): UpcomingEvent[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const events: UpcomingEvent[] = []
  const addRows = (table: string, field: string, route: string, kind: string, titleKeys: string[], detailKeys: string[]) => {
    for (const row of getRows(data, table)) {
      const date = parseRecordDate(row[field])
      if (!date || date < today) continue
      if (table === 'fee_invoices' && outstandingInvoiceBalance(row) <= 0) continue
      events.push({
        title: firstText(row, titleKeys, kind),
        detail: firstText(row, detailKeys, 'Institution schedule'),
        date,
        route,
        kind,
      })
    }
  }
  addRows('exams', 'exam_date', 'exams', 'Examination', ['title'], ['class_name', 'subject'])
  addRows('assignments', 'due_date', 'assignments', 'Assignment deadline', ['title'], ['class_name', 'subject'])
  addRows('fee_invoices', 'due_date', 'fees', 'Fee payment deadline', ['fee_title', 'invoice_no'], ['student_name'])
  return events.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 3)
}

function monthCount(rows: RecordRow[], now: Date) {
  return rows.filter(row => {
    const date = parseRecordDate(row.created_at)
    return !!date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  }).length
}

function buildQuickStats(role: AppRole, data: Dataset, upcomingCount: number, now: Date) {
  if (role === 'owner' || role === 'admin') return [
    { label: 'New Admissions', value: monthCount(getRows(data, 'students'), now), icon: GraduationCap, tone: 'blue' },
    { label: 'Total Subjects', value: getRows(data, 'subjects').length, icon: BookOpen, tone: 'purple' },
    { label: 'Departments', value: getRows(data, 'departments').length, icon: Building2, tone: 'green' },
    { label: 'Class Sections', value: getRows(data, 'classes').length, icon: School, tone: 'orange' },
  ]
  if (role === 'accountant') return [
    { label: 'Invoices', value: getRows(data, 'fee_invoices').length, icon: FileText, tone: 'blue' },
    { label: 'Collected', value: money(getRows(data, 'fee_invoices').reduce((total, row) => total + Number(row.paid_amount ?? 0), 0)), icon: Wallet, tone: 'green' },
    { label: 'Outstanding', value: money(sumOutstanding(getRows(data, 'fee_invoices'))), icon: TrendingUp, tone: 'orange' },
    { label: 'Students', value: getRows(data, 'students').length, icon: GraduationCap, tone: 'purple' },
  ]
  if (role === 'student' || role === 'parent') return [
    { label: 'Attendance Records', value: getRows(data, 'attendance').length, icon: CalendarCheck, tone: 'blue' },
    { label: 'Assignments', value: getRows(data, 'assignments').length, icon: BookOpen, tone: 'purple' },
    { label: 'Exam Results', value: getRows(data, 'exam_results').length, icon: ClipboardList, tone: 'green' },
    { label: 'Upcoming Items', value: upcomingCount, icon: CalendarDays, tone: 'orange' },
  ]
  return [
    { label: 'Students', value: getRows(data, 'students').length, icon: GraduationCap, tone: 'blue' },
    { label: 'Examinations', value: getRows(data, 'exams').length, icon: ClipboardCheck, tone: 'purple' },
    { label: 'Assignments', value: getRows(data, 'assignments').length, icon: BookOpen, tone: 'green' },
    { label: 'Upcoming Items', value: upcomingCount, icon: CalendarDays, tone: 'orange' },
  ]
}

function Overview({ onNavigate }: { onNavigate: (key: string) => void }) {
  const { user, mode } = useAuth()
  const [data, setData] = useState<Dataset>({})
  const [loading, setLoading] = useState(true)
  const [loadNote, setLoadNote] = useState('')
  const [range, setRange] = useState<DashboardRange>('year')
  const available = useMemo(() => modulesForRole(user!.role), [user?.role])

  useEffect(() => {
    let live = true
    async function load() {
      setLoading(true)
      setLoadNote('')
      const administrativeTables = ['owner', 'admin'].includes(user!.role)
        ? ['departments', 'programs', 'classes', 'academic_sessions', 'subjects', 'rooms']
        : []
      const uniqueTables = [...new Set([...available.map(module => module.table), ...administrativeTables])]
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
  }, [mode, user?.id, user?.institutionId, available, user?.role])

  const stats = useMemo(() => buildStats(user!.role, data), [user?.role, data])
  const recent = useMemo(() => Object.entries(data).flatMap(([table, rows]) => rows.map(row => ({ table, row })))
    .sort((a, b) => String(b.row.created_at ?? '').localeCompare(String(a.row.created_at ?? ''))).slice(0, 4), [data])
  const now = new Date()
  const trend = useMemo(() => buildAcademicTrend(data, range, now), [data, range])
  const maxTrendValue = Math.max(4, ...trend.series.flatMap(series => series.values))
  const trendStep = Math.max(1, Math.ceil(maxTrendValue / 4))
  const trendMax = trendStep * 4
  const chartWidth = 650
  const chartHeight = 230
  const chartLeft = 45
  const chartRight = 632
  const chartTop = 20
  const chartBottom = 192
  const chartX = (index: number) => chartLeft + (trend.buckets.length <= 1 ? 0 : index * (chartRight - chartLeft) / (trend.buckets.length - 1))
  const chartY = (value: number) => chartBottom - (value / trendMax) * (chartBottom - chartTop)
  const chartTicks = [0, 1, 2, 3, 4].map(index => trendStep * index)
  const breakdown = useMemo(() => buildModuleBreakdown(user!.role, data), [user?.role, data])
  const breakdownTotal = breakdown.reduce((total, item) => total + item.value, 0)
  let gradientStart = 0
  const donutStops = breakdown.map(item => {
    const end = breakdownTotal > 0 ? gradientStart + item.value / breakdownTotal * 100 : gradientStart
    const segment = item.color + ' ' + gradientStart.toFixed(2) + '% ' + end.toFixed(2) + '%'
    gradientStart = end
    return segment
  })
  const donutGradient = breakdownTotal > 0 ? 'conic-gradient(' + donutStops.join(',') + ')' : 'conic-gradient(#e8eef7 0 100%)'
  const upcoming = useMemo(() => buildUpcomingEvents(data), [data])
  const quickStats = useMemo(() => buildQuickStats(user!.role, data, upcoming.length, now), [user?.role, data, upcoming.length])
  const recentRoutes: Record<string, string> = {
    fee_invoices: 'fees',
    timetable_entries: 'timetable',
    departments: 'admin:departments',
    programs: 'admin:programs',
    classes: 'admin:classes',
    academic_sessions: 'admin:academic_sessions',
    subjects: 'admin:subjects',
    rooms: 'admin:rooms',
  }
  const currentSession = getRows(data, 'academic_sessions').find(row => row.is_current === true)
  const sessionName = currentSession ? firstText(currentSession, ['name', 'title'], 'Current session') : 'Academic Session'
  const today = now.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  const firstName = user!.fullName.split(' ')[0]
  return <div className="pro-dashboard-page">
    <header className="pro-dashboard-heading">
      <div className="pro-dashboard-title">
        <span className="pro-dashboard-title-icon"><LayoutDashboard size={23}/></span>
        <div><h1>Dashboard</h1><p>Welcome back, {firstName}! Here's your institution overview.</p></div>
      </div>
      <div className="pro-dashboard-heading-actions">
        <span className="pro-date-chip"><CalendarClock size={15}/>{today}</span>
        <span className="pro-session-chip"><CalendarDays size={15}/>{sessionName}</span>
      </div>
    </header>

    <section className="pro-metrics-grid" aria-label="Institution statistics">
      {stats.map((stat, index) => <button className={'pro-metric-card metric-' + (index + 1) + ' tone-' + stat.tone} key={stat.label} onClick={() => onNavigate(stat.route)}>
        <span className="pro-metric-icon"><stat.icon size={27}/></span>
        <span className="pro-metric-copy"><strong>{loading ? '—' : stat.value}</strong><span className="pro-metric-label">{stat.label}</span><small>{stat.hint}</small></span>
        <ArrowRight className="pro-metric-open" size={15}/>
      </button>)}
    </section>

    <section className="pro-dashboard-grid pro-dashboard-primary-grid">
      <section className="pro-dashboard-panel pro-academic-panel">
        <div className="pro-panel-heading">
          <div className="pro-panel-title"><BarChart3 size={19}/><h2>Academic Overview</h2></div>
          <div className="pro-chart-controls" role="group" aria-label="Academic overview range">
            {(['month', 'term', 'year'] as DashboardRange[]).map(option => <button type="button" key={option} className={range === option ? 'active' : ''} onClick={() => setRange(option)}>
              {option === 'month' ? 'This Month' : option === 'term' ? 'This Term' : 'This Year'}
            </button>)}
          </div>
        </div>
        <div className="pro-chart-legend">
          {trend.series.map(series => <span key={series.label}><i style={{ background: series.color }}/>{series.label}</span>)}
        </div>
        {loading ? <div className="pro-loading-state"><span/> Loading academic records…</div> : <div className="pro-academic-chart">
          <svg viewBox={'0 0 ' + chartWidth + ' ' + chartHeight} role="img" aria-label="Monthly student, attendance and fee record trends">
            {chartTicks.map(tick => <g key={tick}>
              <line x1={chartLeft} y1={chartY(tick)} x2={chartRight} y2={chartY(tick)} stroke="#e7edf5" strokeWidth="1"/>
              <text x="31" y={chartY(tick) + 4} textAnchor="end" fill="#7f90a7" fontSize="11">{tick.toLocaleString()}</text>
            </g>)}
            <line x1={chartLeft} y1={chartTop} x2={chartLeft} y2={chartBottom} stroke="#cbd7e6" strokeWidth="1"/>
            <line x1={chartLeft} y1={chartBottom} x2={chartRight} y2={chartBottom} stroke="#cbd7e6" strokeWidth="1"/>
            {trend.series.map(series => <g key={series.label}>
              <polyline points={series.values.map((value, index) => chartX(index) + ',' + chartY(value)).join(' ')} fill="none" stroke={series.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              {series.values.map((value, index) => <circle key={index} cx={chartX(index)} cy={chartY(value)} r="4" fill={series.color}/>)}
            </g>)}
            {trend.buckets.map((bucket, index) => <text key={bucket.label + index} x={chartX(index)} y="216" textAnchor="middle" fill="#637791" fontSize="11">{bucket.label}</text>)}
          </svg>
        </div>}
        <div className="pro-chart-caption">Record counts from the information available to your signed-in role.</div>
      </section>

      <section className="pro-dashboard-panel pro-module-overview-panel">
        <div className="pro-panel-heading">
          <div className="pro-panel-title"><PieChart size={19}/><h2>Module Overview</h2></div>
          <span className="pro-panel-count">{breakdown.length} areas</span>
        </div>
        <div className="pro-module-overview">
          <div className="pro-module-donut" style={{ background: donutGradient }}>
            <div><strong>{loading ? '—' : breakdownTotal.toLocaleString()}</strong><small>Records</small></div>
          </div>
          <div className="pro-module-legend">
            {breakdown.map(item => <div key={item.key}><i style={{ background: item.color }}/><span>{item.label}</span><b>{loading ? '—' : item.value.toLocaleString()}</b></div>)}
          </div>
        </div>
        {breakdownTotal === 0 && !loading && <div className="pro-chart-caption">Module activity will appear here as records are added.</div>}
      </section>
    </section>

    <section className="pro-dashboard-grid pro-dashboard-secondary-grid">
      <section className="pro-dashboard-panel pro-activity-panel">
        <div className="pro-panel-heading">
          <div className="pro-panel-title"><Activity size={18}/><h2>Recent Activity</h2></div>
          <span className="pro-panel-count">Latest records</span>
        </div>
        {loading ? <div className="pro-loading-state"><span/> Loading recent activity…</div> : recent.length ? <div className="pro-activity-list">{recent.map(({ table, row }, index) => {
          const title = firstText(row, ['full_name', 'name', 'title', 'fee_title', 'student_name', 'exam_title', 'admission_no'], tableLabels[table] ?? 'Record')
          const subtitle = firstText(row, ['class_name', 'subject', 'department', 'admission_no', 'audience'], tableLabels[table] ?? 'Institution record')
          const route = recentRoutes[table] ?? tableToModule[table] ?? table
          const Icon = moduleIcons[route] ?? FileText
          return <button className="pro-activity-row" key={table + '-' + row.id} onClick={() => onNavigate(route)}>
            <span className={'pro-activity-icon activity-' + (index % 4)}><Icon size={17}/></span>
            <span className="pro-activity-text"><b>{title}</b><small>{tableLabels[table] ?? 'Institution record'} <i/> {subtitle}</small></span>
            <span className="pro-activity-date">{shortDate(row.created_at)}</span>
            <ArrowRight size={14}/>
          </button>
        })}</div> : <div className="pro-empty-state"><span><FileText size={23}/></span><b>Your activity feed starts here</b><small>Records created in your permitted modules will appear here.</small></div>}
      </section>

      <section className="pro-dashboard-panel pro-upcoming-panel">
        <div className="pro-panel-heading">
          <div className="pro-panel-title"><CalendarDays size={18}/><h2>Upcoming Events</h2></div>
          <span className="pro-panel-count">{upcoming.length} upcoming</span>
        </div>
        {loading ? <div className="pro-loading-state"><span/> Loading upcoming items…</div> : upcoming.length ? <div className="pro-upcoming-list">{upcoming.map((event, index) => <button type="button" className="pro-upcoming-row" key={event.kind + '-' + event.date.toISOString() + '-' + index} onClick={() => onNavigate(event.route)}>
          <span className="pro-event-date"><b>{event.date.getDate()}</b><small>{event.date.toLocaleDateString(undefined, { month: 'short' })}</small></span>
          <span className="pro-event-copy"><b>{event.title}</b><small>{event.kind} · {event.detail}</small></span>
          <ArrowRight size={14}/>
        </button>)}</div> : <div className="pro-empty-state"><span><CalendarDays size={23}/></span><b>No upcoming events</b><small>Scheduled examinations, deadlines and fee due dates will appear here.</small></div>}
      </section>

      <section className="pro-dashboard-panel pro-quick-stats-panel">
        <div className="pro-panel-heading"><div className="pro-panel-title"><BarChart3 size={18}/><h2>Quick Statistics</h2></div></div>
        <div className="pro-quick-stats-grid">{quickStats.map((item, index) => <div className={'pro-quick-stat tone-' + item.tone} key={item.label}>
          <span><item.icon size={19}/></span><small>{item.label}</small><b>{loading ? '—' : item.value}</b>
        </div>)}</div>
      </section>
    </section>

    {loadNote && <div className="pro-data-note"><Activity size={15}/><span>Some dashboard information could not be loaded: {loadNote}</span></div>}
    {['student', 'parent'].includes(user!.role) && <div className="pro-dashboard-note">Your overview only includes records that your account is permitted to view.</div>}
  </div>
}

const quickAccessByRole: Record<AppRole, Array<{ title: string; key: string; icon: LucideIcon }>> = {
  owner: [
    { title: 'Attendance Registration', key: 'attendance', icon: CalendarCheck },
    { title: 'Fees Invoice', key: 'fees', icon: Wallet },
    { title: 'Files', key: 'files', icon: FileText },
  ],
  admin: [
    { title: 'Attendance Registration', key: 'attendance', icon: CalendarCheck },
    { title: 'Fees Invoice', key: 'fees', icon: Wallet },
    { title: 'Files', key: 'files', icon: FileText },
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
  const pageTitle = activePage

  return <div className={`pro-app-shell ${sidebarOpen ? 'navigation-open' : ''}`}>
    <aside className={`pro-sidebar ${sidebarOpen ? 'is-open' : ''}`} >
      <div className="pro-sidebar-brand"><div className="pro-sidebar-mark"><BookOpen size={25}/></div><div><b>EduSphere <i>360</i></b><small>INSTITUTION MANAGEMENT</small></div><button className="pro-mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={21}/></button></div>
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
          <div className="pro-topbar-institution"><span className="pro-topbar-institution-icon"><Building2 size={19}/></span><span><b>{user?.institutionName}</b><small><i/>Online</small></span></div>
          {visibleGroups.some(group => group.items.includes('Announcements')) && <button type="button" className="pro-topbar-bell" aria-label="Open announcements" onClick={() => navigate('announcements')}><Bell size={19}/></button>}
          <div className="pro-profile-wrap"><button className="pro-profile-trigger" onClick={() => setProfileOpen(open => !open)} aria-expanded={profileOpen}><span className="pro-profile-avatar">{user?.fullName.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}</span><span className="pro-profile-copy"><b>{user?.fullName}</b><small>{roleLabels[user!.role]}</small></span><ChevronDown size={14}/></button>{profileOpen && <div className="pro-profile-menu"><div className="pro-profile-details"><b>{user?.fullName}</b><small>{user?.email}</small><small>{user?.institutionName}</small>{user?.institutionType && <small>Institution type: {user.institutionType.replaceAll('_', ' ')}</small>}<small>Account role: {roleLabels[user!.role]}</small><span className={'pro-profile-mode ' + mode}>Cloud workspace</span></div>{['student', 'parent'].includes(user!.role) && <button type="button" onClick={() => navigate('profile')}><UserRound size={15}/> My Profile</button>}<button type="button" onClick={() => void logout()}><LogOut size={15}/> Sign out</button></div>}</div>
        </div>
      </header>
      <div className="pro-module-stage">{active === 'overview' ? <Overview onNavigate={navigate}/> : adminKey ? <AdministrationModule key={adminKey} initialKey={adminKey as 'departments' | 'programs' | 'classes' | 'academic_sessions' | 'subjects' | 'rooms'}/> : active === 'accounts' ? <AccountsModule onToast={onToast}/> : active === 'files' ? <FilesModule onToast={onToast}/> : active === 'reports' ? <ReportsModule onToast={onToast}/> : active === 'profile' ? <ProfileModule/> : activeModule ? <RecordModule module={activeModule as ModuleConfig} onToast={onToast}/> : <Overview onNavigate={navigate}/>}</div>
    </main>
  </div>
}
