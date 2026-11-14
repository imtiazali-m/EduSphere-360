import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity, Award, BookOpen, CalendarCheck, CalendarDays, CheckCircle2,
  ClipboardCheck, ClipboardList, Clock3, GraduationCap, Megaphone, MessageSquare,
  School, ShieldAlert, TrendingDown, TrendingUp, Users, Wallet, Building2, ReceiptText,
  FileText, BookOpenCheck, CircleAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listRecords } from '../lib/data'
import { supabase } from '../lib/supabase'
import { outstandingInvoiceBalance } from '../lib/finance'
import { userFacingError } from '../lib/userErrors'
import { roleLabels } from '../lib/modules'
import type { AppRole, RecordRow } from '../lib/types'
import './role-dashboard.css'

type Dataset = Record<string, RecordRow[]>
type Errors = Record<string, string>
type Props = { onNavigate: (route: string) => void }

const TABLES_BY_ROLE: Record<AppRole, string[]> = {
  owner: [
    'students', 'teachers', 'campuses', 'attendance', 'employee_attendance',
    'fee_invoices', 'fee_payments', 'exams', 'exam_results', 'workflow_approvals',
    'announcements', 'institutional_audit_events', 'academic_sessions',
    'departments', 'programs', 'classes', 'subjects', 'rooms',
    'assignments', 'assignment_submissions', 'timetable_entries',
    'work_tasks', 'employee_leave_requests',
  ],
  admin: [
    'students', 'teachers', 'campuses', 'attendance', 'employee_attendance',
    'fee_invoices', 'fee_payments', 'exams', 'exam_results', 'workflow_approvals',
    'announcements', 'academic_sessions', 'work_tasks', 'employee_leave_requests',
    'departments', 'programs', 'classes', 'subjects', 'rooms',
    'assignments', 'assignment_submissions', 'timetable_entries',
  ],
  accountant: [
    'fee_invoices', 'fee_payments', 'finance_accounts', 'finance_journals',
    'finance_journal_lines', 'academic_sessions',
  ],
  teacher: [
    'teachers', 'teacher_assignments', 'timetable_entries', 'attendance',
    'assignments', 'assignment_submissions', 'exams', 'exam_results',
    'announcements', 'academic_sessions',
  ],
  student: [
    'students', 'attendance', 'timetable_entries', 'assignments',
    'assignment_submissions', 'exams', 'exam_results', 'fee_invoices',
    'announcements', 'academic_sessions',
  ],
  parent: [
    'student_guardians', 'students', 'attendance', 'timetable_entries',
    'assignments', 'assignment_submissions', 'exams', 'exam_results',
    'fee_invoices', 'announcements', 'academic_sessions',
  ],
  exam_officer: [
    'exams', 'exam_results', 'assignments', 'workflow_approvals',
    'announcements', 'academic_sessions',
  ],
}

const rows = (data: Dataset, table: string) => data[table] ?? []
const textValue = (row: RecordRow | undefined, keys: string[], fallback = '—') => {
  if (!row) return fallback
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return fallback
}
const numberValue = (value: unknown) => {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}
const formatCount = (value: number) => value.toLocaleString()
const formatMoney = (value: number) => new Intl.NumberFormat('en-PK', {
  style: 'currency', currency: 'PKR', maximumFractionDigits: 0,
}).format(value)
const localDayKey = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-')
function recordDay(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : localDayKey(parsed)
}
function recordDate(row: RecordRow, keys: string[]): Date | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value !== 'string' || !value.trim()) continue
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number)
      return new Date(year, month - 1, day)
    }
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return null
}
function dateLabel(value: unknown): string {
  if (typeof value !== 'string' || !value) return 'Date not set'
  const date = recordDate({ id: '', institution_id: '', value } as unknown as RecordRow, ['value'])
  return date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not set'
}
const isToday = (row: RecordRow, keys: string[], today: string) => keys.some(key => recordDay(row[key]) === today)
const isPaid = (row: RecordRow) => ['completed', 'paid', 'success', 'succeeded', 'settled'].includes(String(row.status ?? '').toLowerCase())
const isPending = (row: RecordRow) => ['pending', 'submitted', 'in_review', 'awaiting_approval'].includes(String(row.status ?? row.approval_status ?? '').toLowerCase())
const todayWeekday = (date: Date) => date.toLocaleDateString(undefined, { weekday: 'long' }).toLowerCase()
const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
function activeSession(data: Dataset): RecordRow | undefined {
  const sessions = rows(data, 'academic_sessions')
  return sessions.find(session => session.is_current === true || session.is_active === true)
    ?? sessions.find(session => ['active', 'current', 'in_progress'].includes(String(session.status ?? '').toLowerCase()))
}
function averageResult(results: RecordRow[]) {
  const eligible = results.filter(result => numberValue(result.total_marks) > 0)
  const maximum = eligible.reduce((sum, result) => sum + numberValue(result.total_marks), 0)
  const achieved = eligible.reduce((sum, result) => sum + numberValue(result.marks_obtained), 0)
  return { percent: maximum ? Math.round((achieved / maximum) * 100) : null, count: eligible.length }
}
function unpaidTotal(invoices: RecordRow[]) {
  return invoices.reduce((sum, invoice) => sum + outstandingInvoiceBalance(invoice), 0)
}
function lastSixMonths() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1))
}
function sameMonth(value: unknown, month: Date) {
  const date = recordDate({ id: '', institution_id: '', value } as unknown as RecordRow, ['value'])
  return !!date && date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
}
function currentMonthStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function MetricCard({ icon: Icon, label, value, hint, tone, onClick }: {
  icon: LucideIcon; label: string; value: string; hint: string; tone: string; onClick?: () => void
}) {
  const content = <>
    <span className={'rd-metric-icon ' + tone}><Icon size={19}/></span>
    <span className="rd-metric-copy"><small>{label}</small><strong>{value}</strong><em>{hint}</em></span>
    {onClick && <span className="rd-metric-arrow">↗</span>}
  </>
  return onClick
    ? <button type="button" className="rd-metric-card is-link" onClick={onClick}>{content}</button>
    : <article className="rd-metric-card">{content}</article>
}
function Panel({ title, description, icon: Icon, action, children, className = '' }: {
  title: string; description?: string; icon: LucideIcon; action?: ReactNode; children: ReactNode; className?: string
}) {
  return <section className={'rd-panel ' + className}>
    <header className="rd-panel-head">
      <span className="rd-panel-icon"><Icon size={17}/></span>
      <div className="rd-panel-title"><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {action && <div className="rd-panel-action">{action}</div>}
    </header>
    <div className="rd-panel-body">{children}</div>
  </section>
}
function EmptyState({ loading, message }: { loading: boolean; message: string }) {
  const unavailable = /unavailable|could not be loaded|not available/i.test(message)
  return (
    <div className="rd-empty">
      <span className="rd-empty-icon"><ClipboardList size={17}/></span>
      <strong>{loading ? 'Loading this area' : unavailable ? 'Data unavailable' : 'Nothing to show yet'}</strong>
      <small>{loading ? 'Checking the latest records for your account.' : message}</small>
    </div>
  )
}
function NoticeList({ items, loading }: { items: RecordRow[]; loading: boolean }) {
  if (loading || !items.length) return <EmptyState loading={loading} message="No notices have been published for your account."/>
  return <div className="rd-list">
    {items.slice(0, 4).map(item => <article className="rd-list-row" key={item.id}>
      <span className="rd-row-icon notice"><Megaphone size={15}/></span>
      <span className="rd-row-copy"><strong>{textValue(item, ['title'], 'Institution notice')}</strong><small>{textValue(item, ['body'], 'Notice details are available in the communication workspace')}</small></span>
      <time>{dateLabel(item.created_at)}</time>
    </article>)}
  </div>
}
function EventList({ items, loading, empty, onNavigate }: {
  items: Array<{ id: string; title: string; detail: string; date: unknown; route: string; kind: string }>
  loading: boolean; empty: string; onNavigate: (route: string) => void
}) {
  if (loading || !items.length) return <EmptyState loading={loading} message={empty}/>
  return <div className="rd-list">
    {items.slice(0, 5).map(item => <button type="button" className="rd-list-row rd-list-button" key={item.id} onClick={() => onNavigate(item.route)}>
      <span className="rd-row-date"><b>{dateLabel(item.date).split(' ')[0]}</b><small>{dateLabel(item.date).split(' ')[1] ?? ''}</small></span>
      <span className="rd-row-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
      <span className="rd-row-tag">{item.kind}</span>
    </button>)}
  </div>
}
function ApprovalList({ items, loading, onNavigate }: { items: RecordRow[]; loading: boolean; onNavigate: (route: string) => void }) {
  if (loading || !items.length) return <EmptyState loading={loading} message="There are no pending approvals."/>
  return <div className="rd-list">
    {items.slice(0, 5).map(item => <button type="button" className="rd-list-row rd-list-button" key={item.id} onClick={() => onNavigate('institutional:administration:approval-and-workflows')}>
      <span className="rd-row-icon approval"><ShieldAlert size={15}/></span>
      <span className="rd-row-copy"><strong>{textValue(item, ['workflow_key', 'target_type'], 'Approval request').replace(/[_-]/g, ' ')}</strong><small>Requested {dateLabel(item.requested_at ?? item.created_at)}</small></span>
      <span className="rd-row-tag pending">Pending</span>
    </button>)}
  </div>
}
function ActivityList({ items, loading, onNavigate }: { items: RecordRow[]; loading: boolean; onNavigate: (route: string) => void }) {
  if (loading || !items.length) return <EmptyState loading={loading} message="No institutional audit activity has been recorded yet."/>
  return <div className="rd-list">
    {items.slice(0, 6).map(item => <button type="button" className="rd-list-row rd-list-button" key={item.id} onClick={() => onNavigate('institutional:administration:administrative-audit')}>
      <span className="rd-row-icon activity"><Activity size={15}/></span>
      <span className="rd-row-copy"><strong>{textValue(item, ['action', 'record_type'], 'Institutional update').replace(/[_-]/g, ' ')}</strong><small>{textValue(item, ['module_key', 'record_type'], 'Institution record').replace(/[_-]/g, ' ')}</small></span>
      <time>{dateLabel(item.occurred_at)}</time>
    </button>)}
  </div>
}
function TimetableList({ items, loading }: { items: RecordRow[]; loading: boolean }) {
  if (loading || !items.length) return <EmptyState loading={loading} message="No timetable periods are scheduled for today."/>
  return <div className="rd-list">
    {items.slice().sort((a, b) => String(a.start_time ?? '').localeCompare(String(b.start_time ?? ''))).map(item => <article className="rd-list-row" key={item.id}>
      <span className="rd-row-time"><b>{textValue(item, ['start_time'], '—')}</b><small>{textValue(item, ['end_time'], '')}</small></span>
      <span className="rd-row-copy"><strong>{textValue(item, ['subject', 'class_name'], 'Class session')}</strong><small>{[textValue(item, ['class_name'], ''), textValue(item, ['room'], '')].filter(value => value && value !== '—').join(' · ')}</small></span>
      <span className="rd-row-tag">{textValue(item, ['teacher_name'], 'Class')}</span>
    </article>)}
  </div>
}
function FinanceBars({ months, collections, expenses }: { months: Date[]; collections: number[]; expenses: number[] }) {
  const maximum = Math.max(1, ...collections, ...expenses)
  return <div className="rd-finance-chart">
    {months.map((month, index) => <div className="rd-finance-month" key={month.toISOString()}>
      <div className="rd-finance-bars">
        <span className="collection" style={{ height: (collections[index] > 0 ? Math.max(2, collections[index] / maximum * 100) : 0) + '%' }} title={'Collection: ' + formatMoney(collections[index])}/>
        <span className="expense" style={{ height: (expenses[index] > 0 ? Math.max(2, expenses[index] / maximum * 100) : 0) + '%' }} title={'Expenses: ' + formatMoney(expenses[index])}/>
      </div>
      <small>{month.toLocaleDateString(undefined, { month: 'short' })}</small>
    </div>)}
  </div>
}

export function RoleDashboard({ onNavigate }: Props) {
  const { user, mode } = useAuth()
  const [data, setData] = useState<Dataset>({})
  const [errors, setErrors] = useState<Errors>({})
  const [loading, setLoading] = useState(true)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'live' | 'polling'>('connecting')
  const today = localDayKey(new Date())
  const role = user?.role ?? 'student'

  useEffect(() => {
    if (!user) return
    const activeUser = user
    let live = true
    let loadedOnce = false
    let refreshTimer: number | undefined
    let debounceTimer: number | undefined
    async function load(showLoading = false) {
      if (showLoading || !loadedOnce) setLoading(true)
      const entries = await Promise.all(TABLES_BY_ROLE[activeUser.role].map(async table => {
        try {
          return [table, await listRecords(mode, activeUser, table), null] as const
        } catch (error) {
          const message = userFacingError(error, 'This information could not be loaded.')
          return [table, [] as RecordRow[], message] as const
        }
      }))
      if (!live) return
      setData(Object.fromEntries(entries.map(([table, records]) => [table, records])))
      setErrors(Object.fromEntries(entries.filter(([, , error]) => error).map(([table, , error]) => [table, String(error)])))
      setLoading(false)
      setLastSyncedAt(new Date())
      loadedOnce = true
    }
    const refreshFromDatabaseEvent = () => {
      window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => { void load(false) }, 350)
    }
    void load(true)

    const channel = supabase?.channel('ed360-dashboard-' + activeUser.institutionId + '-' + activeUser.id)
    if (channel) {
      TABLES_BY_ROLE[activeUser.role].forEach(table => {
        channel.on('postgres_changes', {
          event: '*',
          schema: 'public',
          table,
          filter: 'institution_id=eq.' + activeUser.institutionId,
        }, refreshFromDatabaseEvent)
      })
      channel.subscribe(status => {
        if (live) setRealtimeStatus(status === 'SUBSCRIBED' ? 'live' : 'polling')
      })
    } else {
      setRealtimeStatus('polling')
    }

    // A one-minute fallback keeps the dashboard fresh if Realtime is not enabled
    // for a table in the institution's Supabase publication.
    refreshTimer = window.setInterval(() => { void load(false) }, 60000)
    return () => {
      live = false
      window.clearInterval(refreshTimer)
      window.clearTimeout(debounceTimer)
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [mode, user?.id, user?.institutionId, user?.role])

  const known = (...tables: string[]) => tables.every(table => !errors[table] && Object.prototype.hasOwnProperty.call(data, table))
  const get = (table: string) => rows(data, table)
  const knownCount = (table: string) => known(table) ? formatCount(get(table).length) : '—'
  const students = get('students')
  const teachers = get('teachers')
  const attendance = get('attendance')
  const invoices = get('fee_invoices')
  const payments = get('fee_payments').filter(isPaid)
  const exams = get('exams')
  const results = get('exam_results')
  const assignments = get('assignments')
  const submissions = get('assignment_submissions')
  const timetable = get('timetable_entries')
  const notices = get('announcements').slice().sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
  const current = activeSession(data)
  const currentSessionLabel = !known('academic_sessions') ? 'Session unavailable'
    : current ? textValue(current, ['session_name', 'name', 'code'], 'Active session')
      : 'No active academic session'
  const now = new Date()
  const monthStart = currentMonthStart()
  const trendMonths = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1))
  const monthlyRecords = (items: RecordRow[], keys: string[]) => trendMonths.map(month =>
    items.filter(item => {
      const date = recordDate(item, keys)
      return date && date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
    }).length,
  )
  const monthlyAdmissions = monthlyRecords(students, ['admission_date', 'created_at'])
  const monthlyAttendance = monthlyRecords([...attendance, ...get('employee_attendance')], ['attendance_date', 'created_at'])
  const monthlyCollections = trendMonths.map(month => payments.filter(payment => {
    const date = recordDate(payment, ['payment_date', 'created_at'])
    return date && date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
  }).reduce((sum, payment) => sum + numberValue(payment.amount), 0))
  const executiveTrends = [
    { key: 'admissions', label: 'New admissions', values: monthlyAdmissions, total: monthlyAdmissions.reduce((sum, value) => sum + value, 0), available: known('students'), display: (value: number) => formatCount(value) },
    { key: 'attendance', label: 'Attendance entries', values: monthlyAttendance, total: monthlyAttendance.reduce((sum, value) => sum + value, 0), available: known('attendance', 'employee_attendance'), display: (value: number) => formatCount(value) },
    { key: 'collections', label: 'Fee collections', values: monthlyCollections, total: monthlyCollections.reduce((sum, value) => sum + value, 0), available: known('fee_payments'), display: (value: number) => formatMoney(value) },
  ] as const
  const monthName = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const todayAttendance = attendance.filter(row => isToday(row, ['attendance_date'], today))
  const todayStaffAttendance = get('employee_attendance').filter(row => isToday(row, ['attendance_date'], today))
  const totalTodayAttendance = todayAttendance.length + todayStaffAttendance.length
  const presentToday = [...todayAttendance, ...todayStaffAttendance].filter(row => String(row.status ?? '').toLowerCase() === 'present').length
  const todayAttendancePercent = totalTodayAttendance ? Math.round(presentToday / totalTodayAttendance * 100) : null
  const todayPayments = payments.filter(row => isToday(row, ['payment_date'], today))
  const collectedToday = todayPayments.reduce((sum, payment) => sum + numberValue(payment.amount), 0)
  const outstanding = unpaidTotal(invoices)
  const outstandingCount = invoices.filter(invoice => outstandingInvoiceBalance(invoice) > 0).length
  const pendingApprovals = get('workflow_approvals').filter(isPending)
  const upcomingExams = exams
    .filter(exam => {
      const date = recordDate(exam, ['exam_date'])
      return date && localDayKey(date) >= today && !['cancelled', 'completed'].includes(String(exam.status ?? '').toLowerCase())
    })
    .sort((a, b) => String(a.exam_date ?? '').localeCompare(String(b.exam_date ?? '')))
  const publishedResults = results.filter(result => ['published', 'released'].includes(String(result.result_status ?? '').toLowerCase()))
  const performance = averageResult(publishedResults)

  const headingByRole: Record<AppRole, { eyebrow: string; title: string; subtitle: string }> = {
    owner: { eyebrow: 'GLOBAL INSTITUTION OVERSIGHT', title: 'Institution dashboard', subtitle: 'Monitor performance across campuses, review financial health and act on the work that needs attention.' },
    admin: { eyebrow: 'ADMINISTRATION WORKSPACE', title: 'Operations overview', subtitle: 'Admissions, people, attendance, approvals and the daily running of your institution.' },
    accountant: { eyebrow: 'FINANCE WORKSPACE', title: 'Finance overview', subtitle: 'Collections, receivables, receipts and the month’s posted financial activity.' },
    teacher: { eyebrow: 'TEACHING WORKSPACE', title: 'Your teaching day', subtitle: 'Your assigned classes, timetable, attendance work and learning activities.' },
    student: { eyebrow: 'STUDENT WORKSPACE', title: 'My learning dashboard', subtitle: 'Your timetable, attendance, coursework, examinations and account status.' },
    parent: { eyebrow: 'FAMILY WORKSPACE', title: 'Your children’s progress', subtitle: 'A consolidated view of attendance, learning, examination results and fee information for your linked children.' },
    exam_officer: { eyebrow: 'ASSESSMENT WORKSPACE', title: 'Examination overview', subtitle: 'Assessment schedules, result processing and publication work.' },
  }

  const heading = headingByRole[role]
  const primaryAction: Record<AppRole, { label: string; route: string }> = {
    owner: { label: 'Add student', route: 'students:admissions' },
    admin: { label: 'Add student', route: 'students:admissions' },
    accountant: { label: 'Record payment', route: 'finance:fees:payments' },
    teacher: { label: 'Mark attendance', route: 'attendance:students' },
    student: { label: 'View timetable', route: 'timetable:week' },
    parent: { label: 'View attendance', route: 'attendance:students' },
    exam_officer: { label: 'Review results', route: 'exam_results:all' },
  }
  const sessionCaption = currentSessionLabel
  const pendingDuesCaption = known('fee_invoices') ? formatCount(outstandingCount) + ' invoices with a balance' : 'Invoice data unavailable'
  const metrics: Array<{ label: string; value: string; hint: string; icon: LucideIcon; tone: string; route?: string }> = []

  if (role === 'owner') {
    metrics.push(
      { label: 'Total students', value: knownCount('students'), hint: 'Institution learner records', icon: GraduationCap, tone: 'blue', route: 'students' },
      { label: 'Teachers & staff', value: knownCount('teachers'), hint: 'Institution team records', icon: Users, tone: 'green', route: 'teachers' },
      { label: 'Branches', value: knownCount('campuses'), hint: 'Registered campuses', icon: Building2, tone: 'violet', route: 'institutional:administration:campus-and-branch-management' },
      { label: 'Today’s attendance', value: known('attendance', 'employee_attendance') ? (todayAttendancePercent === null ? '—' : todayAttendancePercent + '%') : '—', hint: known('attendance', 'employee_attendance') ? (totalTodayAttendance ? formatCount(presentToday) + ' present of ' + formatCount(totalTodayAttendance) + ' student and staff records' : 'No attendance recorded today') : 'Attendance unavailable', icon: CalendarCheck, tone: 'teal', route: 'attendance:students' },
      { label: 'Collected today', value: known('fee_payments') ? formatMoney(collectedToday) : '—', hint: known('fee_payments') ? formatCount(todayPayments.length) + ' successful receipts' : 'Payment data unavailable', icon: Wallet, tone: 'amber', route: 'finance:fees:payments' },
      { label: 'Outstanding dues', value: known('fee_invoices') ? formatMoney(outstanding) : '—', hint: pendingDuesCaption, icon: ReceiptText, tone: 'rose', route: 'finance:receivables:receivables' },
    )
  } else if (role === 'admin') {
    const admissionCount = students.filter(student => {
      const date = recordDate(student, ['admission_date', 'created_at'])
      return date && date >= monthStart
    }).length
    const activeStaff = teachers.filter(teacher => ['active', 'employed', 'on_leave'].includes(String(teacher.employment_status ?? '').toLowerCase())).length
    const operationalAlerts = get('work_tasks').filter(task => {
      const due = recordDate(task, ['due_date'])
      const status = String(task.status ?? '').toLowerCase()
      return due && due < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) && !['completed', 'cancelled'].includes(status)
    }).length + get('employee_leave_requests').filter(isPending).length
    metrics.push(
      { label: 'Admissions this month', value: known('students') ? formatCount(admissionCount) : '—', hint: monthName, icon: GraduationCap, tone: 'blue', route: 'students:admissions' },
      { label: 'Active staff', value: known('teachers') ? formatCount(activeStaff) : '—', hint: known('teachers') ? formatCount(teachers.length) + ' total team records' : 'Staff data unavailable', icon: Users, tone: 'green', route: 'teachers' },
      { label: 'Today’s attendance', value: known('attendance', 'employee_attendance') ? (todayAttendancePercent === null ? '—' : todayAttendancePercent + '%') : '—', hint: known('attendance', 'employee_attendance') ? (totalTodayAttendance ? formatCount(presentToday) + ' present of ' + formatCount(totalTodayAttendance) + ' student and staff records' : 'No attendance recorded today') : 'Attendance unavailable', icon: CalendarCheck, tone: 'teal', route: 'attendance:students' },
      { label: 'Pending approvals', value: known('workflow_approvals') ? formatCount(pendingApprovals.length) : '—', hint: 'Requests awaiting a decision', icon: ShieldAlert, tone: 'rose', route: 'institutional:administration:approval-and-workflows' },
      { label: 'Operational alerts', value: known('work_tasks', 'employee_leave_requests') ? formatCount(operationalAlerts) : '—', hint: 'Overdue tasks and pending leave', icon: CircleAlert, tone: 'amber', route: 'work_tasks' },
    )
  } else if (role === 'accountant') {
    const expensesByMonth = lastSixMonths().map(month => {
      const journalIds = new Set(get('finance_journals').filter(journal => String(journal.status ?? '').toLowerCase() === 'posted' && sameMonth(journal.journal_date, month)).map(journal => String(journal.id)))
      const expenseAccounts = new Set(get('finance_accounts').filter(account => ['expense', 'expenses'].includes(String(account.account_type ?? '').toLowerCase())).map(account => String(account.id)))
      return get('finance_journal_lines').filter(line => journalIds.has(String(line.journal_id)) && expenseAccounts.has(String(line.account_id)))
        .reduce((sum, line) => sum + Math.max(0, numberValue(line.debit) - numberValue(line.credit)), 0)
    })
    const currentExpenses = expensesByMonth[5] ?? 0
    metrics.push(
      { label: 'Today’s collection', value: known('fee_payments') ? formatMoney(collectedToday) : '—', hint: known('fee_payments') ? formatCount(todayPayments.length) + ' successful receipts today' : 'Payment data unavailable', icon: Wallet, tone: 'green', route: 'finance:fees:payments' },
      { label: 'Total fee dues', value: known('fee_invoices') ? formatMoney(outstanding) : '—', hint: pendingDuesCaption, icon: ReceiptText, tone: 'rose', route: 'finance:receivables:receivables' },
      { label: 'Outstanding invoices', value: known('fee_invoices') ? formatCount(outstandingCount) : '—', hint: 'Unpaid and partially paid', icon: FileText, tone: 'amber', route: 'finance:fees:invoices' },
      { label: 'Expenses this month', value: known('finance_accounts', 'finance_journals', 'finance_journal_lines') ? formatMoney(currentExpenses) : '—', hint: monthName + ' · posted expense journals', icon: TrendingDown, tone: 'violet', route: 'finance:accounts:expenses' },
    )
  } else if (role === 'teacher') {
    const teacher = teachers.find(row => row.user_id === user?.id)
    const assignmentsToTeacher = get('teacher_assignments').filter(item => item.teacher_id === teacher?.id && String(item.status ?? 'active').toLowerCase() === 'active')
    const classIds = new Set(assignmentsToTeacher.map(item => String(item.class_id ?? '')).filter(Boolean))
    // Class directory rows are owner/admin-only. Use the teacher-name scope in
    // the permitted timetable table rather than asking for inaccessible classes.
    const assignedClassNames = new Set(
      timetable
        .filter(entry => normalize(entry.teacher_name) === normalize(user?.fullName))
        .map(entry => normalize(entry.class_name))
        .filter(Boolean),
    )
    const todaySchedule = timetable.filter(entry =>
      normalize(entry.weekday) === todayWeekday(now)
      && normalize(entry.teacher_name) === normalize(user?.fullName),
    )
    const assignedScope = (items: RecordRow[]) => assignedClassNames.size
      ? items.filter(item => assignedClassNames.has(normalize(item.class_name)) || [...assignedClassNames].some(name => normalize(item.class_name).includes(name)))
      : items.filter(item => item.created_by === user?.id)
    const teacherAssignments = assignedScope(assignments)
    const teacherExams = assignedScope(exams)
    const todayClassNames = [...new Set(todaySchedule.map(item => String(item.class_name ?? '').trim()).filter(Boolean))]
    const attendedClasses = new Set(todayAttendance.map(item => normalize(item.class_name)))
    const attendanceTasks = todayClassNames.filter(className => ![...attendedClasses].some(attended => attended === normalize(className))).length
    const teacherAssignmentIds = new Set(teacherAssignments.map(item => String(item.id)))
    const pendingReviews = submissions.filter(item => teacherAssignmentIds.has(String(item.assignment_id)) && ['submitted', 'late', 'pending'].includes(String(item.status ?? '').toLowerCase()))
    metrics.push(
      { label: 'Assigned classes', value: known('teacher_assignments', 'teachers') ? formatCount(classIds.size) : '—', hint: assignedClassNames.size ? formatCount(assignedClassNames.size) + ' class names on your timetable' : (classIds.size ? 'Active teaching allocations' : 'No active class allocations'), icon: School, tone: 'blue', route: 'institutional:employees:workload-allocation' },
      { label: 'Today’s lessons', value: known('timetable_entries') ? formatCount(todaySchedule.length) : '—', hint: 'Periods on your timetable', icon: CalendarDays, tone: 'teal', route: 'timetable:week' },
      { label: 'Attendance tasks', value: known('attendance', 'timetable_entries') ? formatCount(attendanceTasks) : '—', hint: 'Scheduled classes without a register today', icon: CalendarCheck, tone: 'amber', route: 'attendance:students' },
      { label: 'Pending reviews', value: known('assignment_submissions') ? formatCount(pendingReviews.length) : '—', hint: 'Student submissions to review', icon: ClipboardList, tone: 'violet', route: 'assignments:submissions' },
      { label: 'Upcoming exams', value: known('exams') ? formatCount(teacherExams.filter(item => {
        const date = recordDate(item, ['exam_date']); return date && localDayKey(date) >= today
      }).length) : '—', hint: 'For your assigned classes', icon: ClipboardCheck, tone: 'rose', route: 'exams:calendar' },
    )
  } else if (role === 'student') {
    const ownAttendance = attendance
    const ownPending = assignments.filter(item => !submissions.some(submission => submission.assignment_id === item.id))
    const nextExams = upcomingExams
    const resultCount = results.filter(item => item.result_status === 'published').length
    metrics.push(
      { label: 'Attendance', value: ownAttendance.length ? Math.round(ownAttendance.filter(item => String(item.status ?? '').toLowerCase() === 'present').length / ownAttendance.length * 100) + '%' : '—', hint: ownAttendance.length ? formatCount(ownAttendance.length) + ' attendance records' : 'No attendance recorded yet', icon: CalendarCheck, tone: 'green', route: 'attendance:students' },
      { label: 'Homework to submit', value: known('assignments', 'assignment_submissions') ? formatCount(ownPending.length) : '—', hint: 'Assignments without a submission', icon: BookOpen, tone: 'violet', route: 'assignments:open' },
      { label: 'Upcoming tests', value: known('exams') ? formatCount(nextExams.length) : '—', hint: 'Scheduled on or after today', icon: ClipboardCheck, tone: 'blue', route: 'exams:calendar' },
      { label: 'Published results', value: known('exam_results') ? formatCount(resultCount) : '—', hint: 'Results released to you', icon: Award, tone: 'amber', route: 'exam_results:published' },
      { label: 'Fee balance', value: known('fee_invoices') ? formatMoney(unpaidTotal(invoices)) : '—', hint: known('fee_invoices') ? formatCount(invoices.length) + ' invoices' : 'Fee information unavailable', icon: Wallet, tone: 'rose', route: 'finance:fees:invoices' },
    )
  } else if (role === 'parent') {
    const childIds = new Set(students.map(item => String(item.id)))
    const linkedChildren = students
    const childAttendance = attendance.filter(item => childIds.has(String(item.student_id)))
    const childAssignmentsPending = assignments.filter(item => !submissions.some(submission => submission.assignment_id === item.id))
    const childResults = results.filter(item => item.result_status === 'published')
    metrics.push(
      { label: 'Linked children', value: known('students', 'student_guardians') ? formatCount(linkedChildren.length) : '—', hint: 'Learners linked to this parent account', icon: Users, tone: 'blue' },
      { label: 'Attendance', value: childAttendance.length ? Math.round(childAttendance.filter(item => String(item.status ?? '').toLowerCase() === 'present').length / childAttendance.length * 100) + '%' : '—', hint: childAttendance.length ? formatCount(childAttendance.length) + ' attendance records' : 'No attendance recorded yet', icon: CalendarCheck, tone: 'green', route: 'attendance:students' },
      { label: 'Homework to follow up', value: known('assignments', 'assignment_submissions') ? formatCount(childAssignmentsPending.length) : '—', hint: 'Open work without a linked submission', icon: BookOpen, tone: 'violet', route: 'assignments:open' },
      { label: 'Published results', value: known('exam_results') ? formatCount(childResults.length) : '—', hint: 'Results shared with your family account', icon: Award, tone: 'amber', route: 'exam_results:published' },
      { label: 'Family fee balance', value: known('fee_invoices') ? formatMoney(unpaidTotal(invoices)) : '—', hint: pendingDuesCaption, icon: Wallet, tone: 'rose', route: 'finance:fees:invoices' },
    )
  } else {
    const pendingResults = results.filter(item => !['published', 'released'].includes(String(item.result_status ?? '').toLowerCase()))
    const pendingExamApprovals = pendingApprovals.length
    metrics.push(
      { label: 'Upcoming examinations', value: known('exams') ? formatCount(upcomingExams.length) : '—', hint: 'Scheduled assessments', icon: CalendarDays, tone: 'blue', route: 'exams:calendar' },
      { label: 'Result records', value: known('exam_results') ? formatCount(results.length) : '—', hint: 'Marks and result entries', icon: ClipboardCheck, tone: 'violet', route: 'exam_results:all' },
      { label: 'Awaiting publication', value: known('exam_results') ? formatCount(pendingResults.length) : '—', hint: 'Draft or unpublished results', icon: Award, tone: 'amber', route: 'exam_results:all' },
      { label: 'Pending approvals', value: known('workflow_approvals') ? formatCount(pendingExamApprovals) : '—', hint: 'Assessment workflow requests', icon: ShieldAlert, tone: 'rose', route: 'institutional:administration:approval-and-workflows' },
    )
  }

  const managerOverviewCards = role === 'owner' || role === 'admin' ? [
    {
      title: 'People & admissions',
      description: 'Learners and your institution team',
      icon: Users,
      tone: 'blue',
      stats: [
        { label: 'Students', value: knownCount('students'), route: 'students' },
        { label: 'Faculty & staff', value: knownCount('teachers'), route: 'teachers' },
        { label: 'New this month', value: known('students') ? formatCount(students.filter(student => {
          const date = recordDate(student, ['admission_date', 'created_at'])
          return date && date >= monthStart
        }).length) : '—', route: 'students:admissions' },
      ],
    },
    {
      title: 'Academic structure',
      description: 'The institution’s academic foundation',
      icon: School,
      tone: 'violet',
      stats: [
        { label: 'Sessions', value: knownCount('academic_sessions'), route: 'admin:academic_sessions' },
        { label: 'Departments', value: knownCount('departments'), route: 'admin:departments' },
        { label: 'Classes', value: knownCount('classes'), route: 'admin:classes' },
        { label: 'Subjects', value: knownCount('subjects'), route: 'admin:subjects' },
        { label: 'Programmes', value: knownCount('programs'), route: 'admin:programs' },
      ],
    },
    {
      title: 'Teaching & learning',
      description: 'Coursework, submissions and class schedules',
      icon: BookOpen,
      tone: 'green',
      stats: [
        { label: 'Assignments', value: knownCount('assignments'), route: 'assignments' },
        { label: 'Submissions', value: knownCount('assignment_submissions'), route: 'assignments:submissions' },
        { label: 'Timetable periods', value: knownCount('timetable_entries'), route: 'timetable:week' },
      ],
    },
    {
      title: 'Attendance',
      description: 'Student and employee attendance registers',
      icon: CalendarCheck,
      tone: 'teal',
      stats: [
        { label: 'Student entries', value: knownCount('attendance'), route: 'attendance:students' },
        { label: 'Staff entries', value: knownCount('employee_attendance'), route: 'attendance:faculty' },
        { label: 'Present today', value: known('attendance', 'employee_attendance') ? formatCount(presentToday) : '—', route: 'attendance:students' },
      ],
    },
    {
      title: 'Examinations & results',
      description: 'Assessment schedules and recorded outcomes',
      icon: ClipboardCheck,
      tone: 'amber',
      stats: [
        { label: 'Examinations', value: knownCount('exams'), route: 'exams:calendar' },
        { label: 'Result records', value: knownCount('exam_results'), route: 'exam_results:all' },
        { label: 'Published results', value: known('exam_results') ? formatCount(publishedResults.length) : '—', route: 'exam_results:published' },
      ],
    },
    {
      title: 'Fees & payments',
      description: 'Invoices, collections and outstanding balances',
      icon: Wallet,
      tone: 'rose',
      stats: [
        { label: 'Invoices', value: knownCount('fee_invoices'), route: 'finance:fees:invoices' },
        { label: 'Successful payments', value: knownCount('fee_payments'), route: 'finance:fees:payments' },
        { label: 'Outstanding', value: known('fee_invoices') ? formatMoney(outstanding) : '—', route: 'finance:receivables:receivables' },
      ],
    },
    {
      title: 'Campus & operations',
      description: 'Campuses, facilities, tasks and approvals',
      icon: Building2,
      tone: 'teal',
      stats: [
        { label: 'Campuses', value: knownCount('campuses'), route: 'institutional:administration:campus-and-branch-management' },
        { label: 'Rooms & facilities', value: knownCount('rooms'), route: 'admin:rooms' },
        { label: 'Open tasks', value: known('work_tasks') ? formatCount(get('work_tasks').filter(task => !['completed', 'cancelled'].includes(String(task.status ?? '').toLowerCase())).length) : '—', route: 'work_tasks' },
        { label: 'Pending approvals', value: knownCount('workflow_approvals') === '—' ? '—' : formatCount(pendingApprovals.length), route: 'institutional:administration:approval-and-workflows' },
      ],
    },
    {
      title: 'Communication & records',
      description: 'Notices and recorded institutional activity',
      icon: Megaphone,
      tone: 'violet',
      stats: [
        { label: 'Announcements', value: knownCount('announcements'), route: 'announcements' },
        { label: 'Audit events', value: knownCount('institutional_audit_events'), route: 'institutional:administration:administrative-audit' },
      ],
    },
  ] : []

  const rolePanels: Record<AppRole, ReactNode> = {
    owner: (() => {
      const campuses = get('campuses')
      const branchRows = campuses.map(campus => {
        const branchId = String(campus.id)
        const branchStudents = students.filter(item => String(item.campus_id ?? '') === branchId).length
        const branchStaff = teachers.filter(item => String(item.campus_id ?? '') === branchId).length
        const branchStudentAttendance = todayAttendance.filter(item => String(item.campus_id ?? '') === branchId)
        const branchStaffAttendance = todayStaffAttendance.filter(item => String(item.campus_id ?? '') === branchId)
        const branchAttendance = [...branchStudentAttendance, ...branchStaffAttendance]
        const branchPayments = todayPayments.filter(item => String(item.campus_id ?? '') === branchId)
        return { id: campus.id, name: textValue(campus, ['name', 'campus_code'], 'Campus'), students: branchStudents, staff: branchStaff, attendance: branchAttendance.length, present: branchAttendance.filter(item => String(item.status ?? '').toLowerCase() === 'present').length, collection: branchPayments.reduce((sum, item) => sum + numberValue(item.amount), 0) }
      })
      const maxBranch = Math.max(1, ...branchRows.map(item => item.students))
      return <>
        <div className="rd-grid rd-grid-wide">
          <Panel title="Six-month institutional trends" description="Admissions, attendance and collected payments grouped by month from saved institutional records." icon={TrendingUp} className="rd-trend-panel">
            <div className="rd-trend-series-grid">
              {executiveTrends.map(series => {
                const maximum = Math.max(1, ...series.values)
                return <section className={'rd-trend-series ' + series.key} key={series.key} aria-label={series.label}>
                  <div className="rd-trend-series-head"><span>{series.label}</span><strong>{loading || !series.available ? '—' : series.display(series.total)}</strong></div>
                  {loading || !series.available
                    ? <div className="rd-trend-unavailable">{loading ? 'Loading saved records…' : 'This record set is unavailable to your account.'}</div>
                    : <div className="rd-trend-bars">
                      {series.values.map((value, index) => <div className="rd-trend-month" key={trendMonths[index].toISOString()} title={trendMonths[index].toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) + ': ' + series.display(value)}>
                        <span className="rd-trend-track"><i style={{ height: (value ? Math.max(5, value / maximum * 100) : 0) + '%' }}/></span>
                        <small>{trendMonths[index].toLocaleDateString(undefined, { month: 'short' })}</small>
                      </div>)}
                    </div>}
                </section>
              })}
            </div>
            <p className="rd-trend-note">Historical activity only. These figures describe recorded activity and are not AI forecasts.</p>
          </Panel>
          <Panel title="Academic performance" description="Weighted average from recorded examination marks." icon={Award}>
            <div className="rd-performance">
              <strong>{known('exam_results') ? (performance.percent === null ? '—' : performance.percent + '%') : '—'}</strong>
              <span>{known('exam_results') ? formatCount(performance.count) + ' result records included' : 'Result data unavailable'}</span>
              <div className="rd-progress"><i style={{ width: (performance.percent ?? 0) + '%' }}/></div>
              <small>{performance.percent === null ? 'Performance will appear after marks with a total score are recorded.' : 'Calculated as total marks achieved divided by total marks available.'}</small>
            </div>
          </Panel>
          <Panel title="Pending approvals" description="Requests currently awaiting an owner decision." icon={ShieldAlert} action={<button type="button" className="rd-text-action" onClick={() => onNavigate('institutional:administration:approval-and-workflows')}>Open approvals</button>}>
            <ApprovalList items={pendingApprovals} loading={loading || !known('workflow_approvals')} onNavigate={onNavigate}/>
          </Panel>
          <Panel title="Upcoming examinations" description="Next scheduled assessments." icon={CalendarDays} action={<button type="button" className="rd-text-action" onClick={() => onNavigate('exams:calendar')}>View calendar</button>}>
            <EventList items={upcomingExams.map(item => ({ id: item.id, title: textValue(item, ['title'], 'Examination'), detail: [textValue(item, ['class_name'], ''), textValue(item, ['subject'], '')].filter(value => value && value !== '—').join(' · '), date: item.exam_date, route: 'exams:calendar', kind: 'Exam' }))} loading={loading || !known('exams')} empty="No upcoming examinations are scheduled." onNavigate={onNavigate}/>
          </Panel>
          <Panel title="Branch comparison" description="Live learner, staff, attendance and collection records by campus." icon={Building2} className="rd-branch-panel">
            {!known('campuses', 'students', 'teachers', 'attendance', 'fee_payments') ? <EmptyState loading={loading} message="Branch comparison data is unavailable."/> : branchRows.length ? <div className="rd-branch-list">
              {branchRows.map(branch => <div className="rd-branch-row" key={branch.id}>
                <div className="rd-branch-top"><strong>{branch.name}</strong><span>{formatCount(branch.students)} students</span></div>
                <div className="rd-branch-bar"><i style={{ width: (branch.students / maxBranch * 100) + '%' }}/></div>
                <div className="rd-branch-meta"><span>{formatCount(branch.staff)} staff</span><span>{branch.attendance ? Math.round(branch.present / branch.attendance * 100) + '% attendance' : 'No attendance today'}</span><span>{formatMoney(branch.collection)} collected today</span></div>
              </div>)}
            </div> : <EmptyState loading={loading} message="No campuses have been registered yet."/>}
          </Panel>
          <Panel title="Recent institutional activity" description="Latest recorded audit events." icon={Activity} action={<button type="button" className="rd-text-action" onClick={() => onNavigate('institutional:administration:administrative-audit')}>Open audit</button>}>
            <ActivityList items={get('institutional_audit_events').slice().sort((a, b) => String(b.occurred_at ?? '').localeCompare(String(a.occurred_at ?? '')))} loading={loading || !known('institutional_audit_events')} onNavigate={onNavigate}/>
          </Panel>
          <Panel title="Institution notices" description="Latest announcements published to your institution." icon={Megaphone}>
            <NoticeList items={notices} loading={loading || !known('announcements')}/>
          </Panel>
        </div>
      </>
    })(),
    admin: (() => {
      const recentAdmissions = students.slice().sort((a, b) => String(b.admission_date ?? b.created_at ?? '').localeCompare(String(a.admission_date ?? a.created_at ?? ''))).slice(0, 4)
      const activeStaff = teachers.filter(teacher => ['active', 'employed', 'on_leave'].includes(String(teacher.employment_status ?? '').toLowerCase()))
      const tasks = get('work_tasks').filter(task => !['completed', 'cancelled'].includes(String(task.status ?? '').toLowerCase()))
      const leaveRequests = get('employee_leave_requests').filter(isPending)
      return <div className="rd-grid rd-grid-wide">
        <Panel title="Admissions and student records" description="Recently added learner profiles." icon={GraduationCap} action={<button type="button" className="rd-text-action" onClick={() => onNavigate('students:admissions')}>Open admissions</button>}>
          {loading || !known('students') ? <EmptyState loading={loading} message="Student admission data is unavailable."/> : recentAdmissions.length ? <div className="rd-list">
            {recentAdmissions.map(student => <button type="button" className="rd-list-row rd-list-button" key={student.id} onClick={() => onNavigate('students:directory')}>
              <span className="rd-row-icon student"><GraduationCap size={15}/></span>
              <span className="rd-row-copy"><strong>{textValue(student, ['full_name'], 'Student record')}</strong><small>{[textValue(student, ['admission_no'], ''), textValue(student, ['class_name'], '')].filter(value => value && value !== '—').join(' · ')}</small></span>
              <time>{dateLabel(student.admission_date ?? student.created_at)}</time>
            </button>)}
          </div> : <EmptyState loading={false} message="No student profiles have been added yet."/>}
        </Panel>
        <Panel title="Staff and teacher status" description="Current employee records available to administration." icon={Users} action={<button type="button" className="rd-text-action" onClick={() => onNavigate('teachers')}>Open staff</button>}>
          {!known('teachers') ? <EmptyState loading={loading} message="Staff records are unavailable."/> : <div className="rd-status-summary">
            <div><strong>{formatCount(activeStaff.length)}</strong><span>Active / on leave</span></div>
            <div><strong>{formatCount(teachers.length - activeStaff.length)}</strong><span>Other statuses</span></div>
            <div><strong>{formatCount(teachers.length)}</strong><span>Total records</span></div>
          </div>}
        </Panel>
        <Panel title="Attendance summary" description="Student and employee registers recorded today." icon={CalendarCheck}>
          {!known('attendance', 'employee_attendance') ? <EmptyState loading={loading} message="Attendance summary is unavailable."/> : <div className="rd-status-summary">
            <div><strong>{formatCount(todayAttendance.length)}</strong><span>Student entries</span></div>
            <div><strong>{formatCount(todayStaffAttendance.length)}</strong><span>Staff entries</span></div>
            <div><strong>{formatCount(presentToday)}</strong><span>Present today</span></div>
          </div>}
        </Panel>
        <Panel title="Pending approvals" description="Requests requiring administrative review." icon={ShieldAlert} action={<button type="button" className="rd-text-action" onClick={() => onNavigate('institutional:administration:approval-and-workflows')}>Review queue</button>}>
          <ApprovalList items={pendingApprovals} loading={loading || !known('workflow_approvals')} onNavigate={onNavigate}/>
        </Panel>
        <Panel title="Operational alerts" description="Overdue work and leave requests awaiting action." icon={CircleAlert}>
          {!known('work_tasks', 'employee_leave_requests') ? <EmptyState loading={loading} message="Operational alert data is unavailable."/> : <div className="rd-alert-list">
            <button type="button" onClick={() => onNavigate('work_tasks')}><span className="rd-alert-icon"><Clock3 size={16}/></span><span><strong>{formatCount(tasks.filter(task => {
              const due = recordDate(task, ['due_date'])
              return due && due < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
            }).length)} overdue tasks</strong><small>Open institutional work past its due date</small></span></button>
            <button type="button" onClick={() => onNavigate('employees:leave-management')}><span className="rd-alert-icon"><CalendarCheck size={16}/></span><span><strong>{formatCount(leaveRequests.length)} pending leave requests</strong><small>Employee requests awaiting review</small></span></button>
          </div>}
        </Panel>
        <Panel title="Institution notices" description="Latest published notices." icon={Megaphone}>
          <NoticeList items={notices} loading={loading || !known('announcements')}/>
        </Panel>
      </div>
    })(),
    accountant: (() => {
      const months = lastSixMonths()
      const collections = months.map(month => payments.filter(payment => sameMonth(payment.payment_date, month)).reduce((sum, item) => sum + numberValue(item.amount), 0))
      const expenses = months.map(month => {
        const journalIds = new Set(get('finance_journals').filter(journal => String(journal.status ?? '').toLowerCase() === 'posted' && sameMonth(journal.journal_date, month)).map(journal => String(journal.id)))
        const expenseAccounts = new Set(get('finance_accounts').filter(account => ['expense', 'expenses'].includes(String(account.account_type ?? '').toLowerCase())).map(account => String(account.id)))
        return get('finance_journal_lines').filter(line => journalIds.has(String(line.journal_id)) && expenseAccounts.has(String(line.account_id)))
          .reduce((sum, line) => sum + Math.max(0, numberValue(line.debit) - numberValue(line.credit)), 0)
      })
      const recentReceipts = payments.slice().sort((a, b) => String(b.payment_date ?? '').localeCompare(String(a.payment_date ?? ''))).slice(0, 6)
      const overdue = invoices.filter(invoice => outstandingInvoiceBalance(invoice) > 0 && recordDay(invoice.due_date) && recordDay(invoice.due_date) < today)
      return <div className="rd-grid rd-grid-wide">
        <Panel title="Monthly financial summary" description="Successful fee receipts and posted expenses from the last six months." icon={TrendingUp} className="rd-finance-panel">
          {!known('fee_payments', 'finance_accounts', 'finance_journals', 'finance_journal_lines') ? <EmptyState loading={loading} message="Financial trend data is unavailable."/> : collections.every(value => value === 0) && expenses.every(value => value === 0) ? <EmptyState loading={false} message="No successful fee receipts or posted expenses were recorded in the last six months."/> : <>
            <div className="rd-chart-legend"><span><i className="collection"/>Fee collections</span><span><i className="expense"/>Posted expenses</span></div>
            <FinanceBars months={months} collections={collections} expenses={expenses}/>
            <div className="rd-finance-totals"><span>Collected this month <strong>{formatMoney(collections[5] ?? 0)}</strong></span><span>Expenses this month <strong>{formatMoney(expenses[5] ?? 0)}</strong></span></div>
          </>}
        </Panel>
        <Panel title="Recent receipts" description="Latest successful payments and receipt references." icon={ReceiptText} action={<button type="button" className="rd-text-action" onClick={() => onNavigate('finance:fees:payments')}>View payments</button>}>
          {!known('fee_payments') ? <EmptyState loading={loading} message="Receipt data is unavailable."/> : recentReceipts.length ? <div className="rd-list">
            {recentReceipts.map(payment => <article className="rd-list-row" key={payment.id}>
              <span className="rd-row-icon receipt"><ReceiptText size={15}/></span>
              <span className="rd-row-copy"><strong>{textValue(payment, ['receipt_no', 'receipt_number', 'payment_reference'], 'Payment receipt')}</strong><small>{textValue(payment, ['payment_method'], 'Payment')} · {dateLabel(payment.payment_date)}</small></span>
              <b className="rd-row-amount">{formatMoney(numberValue(payment.amount))}</b>
            </article>)}
          </div> : <EmptyState loading={false} message="No successful payments have been recorded yet."/>}
        </Panel>
        <Panel title="Overdue invoices" description="Balances with a due date before today." icon={CircleAlert} action={<button type="button" className="rd-text-action" onClick={() => onNavigate('finance:receivables:receivables')}>Review dues</button>}>
          {!known('fee_invoices') ? <EmptyState loading={loading} message="Invoice data is unavailable."/> : overdue.length ? <div className="rd-list">
            {overdue.slice(0, 5).map(invoice => <button type="button" className="rd-list-row rd-list-button" key={invoice.id} onClick={() => onNavigate('finance:fees:invoices')}>
              <span className="rd-row-icon overdue"><FileText size={15}/></span>
              <span className="rd-row-copy"><strong>{textValue(invoice, ['student_name', 'invoice_no', 'invoice_number'], 'Outstanding invoice')}</strong><small>{textValue(invoice, ['fee_title'], 'Fee invoice')} · due {dateLabel(invoice.due_date)}</small></span>
              <b className="rd-row-amount">{formatMoney(outstandingInvoiceBalance(invoice))}</b>
            </button>)}
          </div> : <EmptyState loading={false} message="No overdue balances are recorded."/>}
        </Panel>
        <Panel title="Collection position" description="Current fee ledger position." icon={Wallet}>
          {!known('fee_invoices', 'fee_payments') ? <EmptyState loading={loading} message="Collection totals are unavailable."/> : <div className="rd-finance-position">
            <div><span>Total outstanding</span><strong>{formatMoney(outstanding)}</strong></div>
            <div><span>Collected today</span><strong>{formatMoney(collectedToday)}</strong></div>
            <div><span>Successful receipts today</span><strong>{formatCount(todayPayments.length)}</strong></div>
          </div>}
        </Panel>
      </div>
    })(),
    teacher: (() => {
      const teacher = teachers.find(row => row.user_id === user?.id)
      const assignmentsToTeacher = get('teacher_assignments').filter(item => item.teacher_id === teacher?.id && String(item.status ?? 'active').toLowerCase() === 'active')
      const classIds = new Set(assignmentsToTeacher.map(item => String(item.class_id ?? '')).filter(Boolean))
      // Class directory rows are owner/admin-only. Use only the teacher's
      // own timetable labels to scope class content in this dashboard.
      const assignedClassNames = new Set(
        timetable
          .filter(entry => normalize(entry.teacher_name) === normalize(user?.fullName))
          .map(entry => normalize(entry.class_name))
          .filter(Boolean),
      )
      const scope = (items: RecordRow[]) => assignedClassNames.size
        ? items.filter(item => assignedClassNames.has(normalize(item.class_name)))
        : items.filter(item => item.created_by === user?.id)
      const teacherAssignments = scope(assignments)
      const teacherExams = scope(exams)
      const todaySchedule = timetable.filter(entry =>
        normalize(entry.weekday) === todayWeekday(now)
        && normalize(entry.teacher_name) === normalize(user?.fullName),
      )
      const classNamesToday = [...new Set(todaySchedule.map(item => String(item.class_name ?? '').trim()).filter(Boolean))]
      const attended = new Set(todayAttendance.map(item => normalize(item.class_name)))
      const missingRegisters = classNamesToday.filter(className => !attended.has(normalize(className)))
      const assignmentIds = new Set(teacherAssignments.map(item => String(item.id)))
      const pendingReviews = submissions.filter(item => assignmentIds.has(String(item.assignment_id)) && ['submitted', 'late', 'pending'].includes(String(item.status ?? '').toLowerCase()))
      const examIds = new Set(teacherExams.map(item => String(item.id)))
      const teacherResults = results.filter(item => examIds.has(String(item.exam_id)))
      return <div className="rd-grid rd-grid-wide">
        <Panel title="Today’s timetable" description="Your scheduled teaching periods for today." icon={CalendarDays} action={<button type="button" className="rd-text-action" onClick={() => onNavigate('timetable:week')}>Full timetable</button>}>
          <TimetableList items={todaySchedule} loading={loading || !known('timetable_entries')}/>
        </Panel>
        <Panel title="Attendance tasks" description="Class sessions with no attendance register recorded today." icon={CalendarCheck}>
          {!known('attendance', 'timetable_entries') ? <EmptyState loading={loading} message="Attendance task data is unavailable."/> : missingRegisters.length ? <div className="rd-list">
            {missingRegisters.map(className => <button type="button" className="rd-list-row rd-list-button" key={className} onClick={() => onNavigate('attendance:students')}>
              <span className="rd-row-icon approval"><CircleAlert size={15}/></span><span className="rd-row-copy"><strong>{className}</strong><small>Attendance not yet recorded</small></span><span className="rd-row-tag pending">To do</span>
            </button>)}
          </div> : <EmptyState loading={false} message="No attendance sessions are waiting for you today."/>}
        </Panel>
        <Panel title="Assigned classes" description="Classes connected to your active teaching assignments." icon={School}>
          {!known('teachers', 'teacher_assignments', 'timetable_entries') ? <EmptyState loading={loading} message="Teaching assignment data is unavailable."/> : assignedClassNames.size ? <div className="rd-class-grid">
            {[...assignedClassNames].sort().map(className => <article key={className}><span><School size={15}/></span><strong>{className}</strong><small>Assigned timetable class</small></article>)}
          </div> : classIds.size ? <EmptyState loading={false} message={formatCount(classIds.size) + ' active class allocations are linked to your account. Class names will appear here when they are present in your teaching timetable.'}/> : <EmptyState loading={false} message="No active class assignments are linked to your teacher profile."/>}
        </Panel>
        <Panel title="Homework and reviews" description="Coursework deadlines and student submissions needing review." icon={BookOpenCheck} action={<button type="button" className="rd-text-action" onClick={() => onNavigate('assignments:submissions')}>Open submissions</button>}>
          {!known('assignments', 'assignment_submissions') ? <EmptyState loading={loading} message="Assignment data is unavailable."/> : pendingReviews.length ? <div className="rd-list">
            {pendingReviews.slice(0, 5).map(item => <button type="button" className="rd-list-row rd-list-button" key={item.id} onClick={() => onNavigate('assignments:submissions')}>
              <span className="rd-row-icon homework"><BookOpen size={15}/></span><span className="rd-row-copy"><strong>{textValue(item, ['assignment_title', 'student_name'], 'Student submission')}</strong><small>{textValue(item, ['student_name'], 'Submission')} · {textValue(item, ['status'], 'Submitted')}</small></span><time>{dateLabel(item.submitted_at ?? item.created_at)}</time>
            </button>)}
          </div> : <EmptyState loading={false} message="No student submissions are awaiting your review."/>}
        </Panel>
        <Panel title="Upcoming examinations" description="Assessments scheduled for your assigned classes." icon={ClipboardCheck}>
          <EventList items={teacherExams.filter(item => {
            const date = recordDate(item, ['exam_date']); return date && localDayKey(date) >= today
          }).map(item => ({ id: item.id, title: textValue(item, ['title'], 'Examination'), detail: [textValue(item, ['class_name'], ''), textValue(item, ['subject'], '')].filter(value => value && value !== '—').join(' · '), date: item.exam_date, route: 'exams:calendar', kind: 'Exam' }))} loading={loading || !known('exams')} empty="No upcoming examinations are scheduled for your classes." onNavigate={onNavigate}/>
        </Panel>
        <Panel title="Student performance" description="Weighted average from results in your assigned examinations." icon={Award}>
          {known('exam_results', 'exams') ? <div className="rd-performance">
            <strong>{averageResult(teacherResults).percent === null ? '—' : averageResult(teacherResults).percent + '%'}</strong>
            <span>{formatCount(averageResult(teacherResults).count)} result records in your assigned exams</span>
            <div className="rd-progress"><i style={{ width: (averageResult(teacherResults).percent ?? 0) + '%' }}/></div>
          </div> : <EmptyState loading={loading} message="Student result data is unavailable."/>}
        </Panel>
      </div>
    })(),
    student: (() => {
      const student = students.find(item => item.id === user?.linkedStudentId) ?? students[0]
      const pendingAssignments = assignments.filter(item => !['closed', 'completed', 'cancelled'].includes(String(item.status ?? 'open').toLowerCase()) && !submissions.some(submission => String(submission.assignment_id) === String(item.id)))
      const dayTimetable = timetable.filter(item => normalize(item.weekday) === todayWeekday(now))
      const nextTests = upcomingExams
      const performanceRate = averageResult(results)
      return <div className="rd-grid rd-grid-wide">
        <Panel title="Today’s timetable" description={student ? 'Class ' + textValue(student, ['class_name'], 'not assigned') + ' · Today’s periods' : 'Your scheduled lessons.'} icon={CalendarDays} action={<button type="button" className="rd-text-action" onClick={() => onNavigate('timetable:week')}>Full timetable</button>}>
          <TimetableList items={dayTimetable} loading={loading || !known('timetable_entries')}/>
        </Panel>
        <Panel title="Homework and assignments" description="Work with deadlines and submissions linked to your account." icon={BookOpen}>
          {!known('assignments', 'assignment_submissions') ? <EmptyState loading={loading} message="Assignment information is unavailable."/> : pendingAssignments.length ? <div className="rd-list">
            {pendingAssignments.slice(0, 5).map(item => <button type="button" className="rd-list-row rd-list-button" key={item.id} onClick={() => onNavigate('assignments:open')}>
              <span className="rd-row-icon homework"><BookOpen size={15}/></span><span className="rd-row-copy"><strong>{textValue(item, ['title'], 'Assignment')}</strong><small>{[textValue(item, ['subject'], ''), textValue(item, ['class_name'], '')].filter(value => value && value !== '—').join(' · ')}</small></span><time>{dateLabel(item.due_date)}</time>
            </button>)}
          </div> : <EmptyState loading={false} message="You have no outstanding assignment submissions."/>}
        </Panel>
        <Panel title="Upcoming tests and examinations" description="Your next scheduled assessments." icon={ClipboardCheck}>
          <EventList items={nextTests.map(item => ({ id: item.id, title: textValue(item, ['title'], 'Examination'), detail: [textValue(item, ['subject'], ''), textValue(item, ['class_name'], '')].filter(value => value && value !== '—').join(' · '), date: item.exam_date, route: 'exams:calendar', kind: 'Test' }))} loading={loading || !known('exams')} empty="No upcoming tests have been scheduled." onNavigate={onNavigate}/>
        </Panel>
        <Panel title="Academic performance" description="Published examination results available to you." icon={Award}>
          {!known('exam_results') ? <EmptyState loading={loading} message="Result information is unavailable."/> : <div className="rd-performance">
            <strong>{performanceRate.percent === null ? '—' : performanceRate.percent + '%'}</strong>
            <span>{formatCount(performanceRate.count)} published results with marks</span>
            <div className="rd-progress"><i style={{ width: (performanceRate.percent ?? 0) + '%' }}/></div>
            <button type="button" className="rd-inline-action" onClick={() => onNavigate('exam_results:published')}>View published results</button>
          </div>}
        </Panel>
        <Panel title="Fee status" description="Your current outstanding invoice balance." icon={Wallet} action={<button type="button" className="rd-text-action" onClick={() => onNavigate('finance:fees:invoices')}>View invoices</button>}>
          {!known('fee_invoices') ? <EmptyState loading={loading} message="Fee information is unavailable."/> : <div className="rd-finance-position">
            <div><span>Outstanding balance</span><strong>{formatMoney(unpaidTotal(invoices))}</strong></div>
            <div><span>Invoices</span><strong>{formatCount(invoices.length)}</strong></div>
            <div><span>Overdue</span><strong>{formatCount(invoices.filter(invoice => outstandingInvoiceBalance(invoice) > 0 && recordDay(invoice.due_date) && recordDay(invoice.due_date) < today).length)}</strong></div>
          </div>}
        </Panel>
        <Panel title="School notices" description="Notices published for students." icon={Megaphone}>
          <NoticeList items={notices} loading={loading || !known('announcements')}/>
        </Panel>
      </div>
    })(),
    parent: (() => {
      const linkedChildren = students
      const linkedIds = new Set(linkedChildren.map(child => String(child.id)))
      const parentAttendance = attendance.filter(item => linkedIds.has(String(item.student_id)))
      const attendanceForChild = (childId: string) => parentAttendance.filter(item => String(item.student_id) === childId)
      const duesForChild = (childId: string) => invoices.filter(item => String(item.student_id) === childId).reduce((sum, item) => sum + outstandingInvoiceBalance(item), 0)
      const assignmentsForChild = (child: RecordRow) => assignments.filter(item => normalize(item.class_name) === normalize(child.class_name))
      const submissionsForChild = (childId: string) => submissions.filter(item => String(item.student_id) === childId)
      const resultsForChild = (childId: string) => results.filter(item => String(item.student_id) === childId && item.result_status === 'published')
      return <div className="rd-grid rd-grid-wide">
        <Panel title="Linked children" description="Learners connected to your parent account." icon={Users} className="rd-children-panel">
          {!known('students', 'student_guardians') ? <EmptyState loading={loading} message="Linked learner information is unavailable."/> : linkedChildren.length ? <div className="rd-child-grid">
            {linkedChildren.map(child => {
              const childId = String(child.id)
              const childRecords = attendanceForChild(childId)
              const rate = childRecords.length ? Math.round(childRecords.filter(item => String(item.status ?? '').toLowerCase() === 'present').length / childRecords.length * 100) : null
              const childAssignments = assignmentsForChild(child).filter(item => !['closed', 'completed', 'cancelled'].includes(String(item.status ?? 'open').toLowerCase()))
              const submittedIds = new Set(submissionsForChild(childId).map(item => String(item.assignment_id)))
              const outstandingForChild = duesForChild(childId)
              return <article className="rd-child-card" key={child.id}>
                <header><span><GraduationCap size={18}/></span><div><strong>{textValue(child, ['full_name'], 'Linked learner')}</strong><small>{textValue(child, ['class_name'], 'Class not assigned')}</small></div></header>
                <div className="rd-child-stats">
                  <div><small>Attendance</small><b>{rate === null ? '—' : rate + '%'}</b></div>
                  <div><small>Open homework</small><b>{formatCount(childAssignments.filter(item => !submittedIds.has(String(item.id))).length)}</b></div>
                  <div><small>Published results</small><b>{formatCount(resultsForChild(childId).length)}</b></div>
                </div>
                <footer><span>Outstanding fees</span><strong>{known('fee_invoices') ? formatMoney(outstandingForChild) : '—'}</strong></footer>
              </article>
            })}
          </div> : <EmptyState loading={false} message="No children are linked to this parent login. Ask the institution to connect the learner accounts."/>}
        </Panel>
        <Panel title="Children’s timetable" description="Periods scheduled today for your linked children." icon={CalendarDays}>
          <TimetableList items={timetable.filter(item => normalize(item.weekday) === todayWeekday(now))} loading={loading || !known('timetable_entries')}/>
        </Panel>
        <Panel title="Homework and learning" description="Open coursework across your linked children." icon={BookOpen}>
          {!known('assignments', 'assignment_submissions') ? <EmptyState loading={loading} message="Homework information is unavailable."/> : assignments.length ? <div className="rd-list">
            {assignments.slice(0, 5).map(item => <article className="rd-list-row" key={item.id}>
              <span className="rd-row-icon homework"><BookOpen size={15}/></span><span className="rd-row-copy"><strong>{textValue(item, ['title'], 'Assignment')}</strong><small>{[textValue(item, ['class_name'], ''), textValue(item, ['subject'], '')].filter(value => value && value !== '—').join(' · ')}</small></span><time>{dateLabel(item.due_date)}</time>
            </article>)}
          </div> : <EmptyState loading={false} message="No homework has been assigned to your linked children."/>}
        </Panel>
        <Panel title="Examination results" description="Published results for linked children." icon={Award}>
          {!known('exam_results') ? <EmptyState loading={loading} message="Examination results are unavailable."/> : results.length ? <div className="rd-list">
            {results.filter(item => item.result_status === 'published').slice(0, 6).map(item => <article className="rd-list-row" key={item.id}>
              <span className="rd-row-icon result"><Award size={15}/></span><span className="rd-row-copy"><strong>{textValue(item, ['student_name', 'exam_title'], 'Published result')}</strong><small>{textValue(item, ['exam_title', 'subject'], 'Examination')}</small></span><b className="rd-row-amount">{numberValue(item.marks_obtained)} / {numberValue(item.total_marks)}</b>
            </article>)}
          </div> : <EmptyState loading={false} message="No examination results have been published for your linked children."/>}
        </Panel>
        <Panel title="Fee invoices and payments" description="Balances across linked learner accounts." icon={Wallet} action={<button type="button" className="rd-text-action" onClick={() => onNavigate('finance:fees:invoices')}>View invoices</button>}>
          {!known('fee_invoices') ? <EmptyState loading={loading} message="Fee information is unavailable."/> : <div className="rd-finance-position">
            <div><span>Family balance</span><strong>{formatMoney(unpaidTotal(invoices))}</strong></div>
            <div><span>Invoices</span><strong>{formatCount(invoices.length)}</strong></div>
            <div><span>Overdue invoices</span><strong>{formatCount(invoices.filter(invoice => outstandingInvoiceBalance(invoice) > 0 && recordDay(invoice.due_date) && recordDay(invoice.due_date) < today).length)}</strong></div>
          </div>}
        </Panel>
        <Panel title="School notices" description="Notices shared with parents and guardians." icon={Megaphone}>
          <NoticeList items={notices} loading={loading || !known('announcements')}/>
        </Panel>
        <Panel title="Teacher communication" description="Open the institution’s approved individual messaging workspace." icon={MessageSquare}>
          <div className="rd-communication">
            <span><MessageSquare size={20}/></span>
            <p>Use the institution communication workspace to contact your child’s teachers through the channels enabled by the school.</p>
            <button type="button" onClick={() => onNavigate('institutional:communication:individual-messages')}>Open teacher messages</button>
          </div>
        </Panel>
      </div>
    })(),
    exam_officer: (() => {
      const pendingResults = results.filter(item => !['published', 'released'].includes(String(item.result_status ?? '').toLowerCase()))
      return <div className="rd-grid rd-grid-wide">
        <Panel title="Upcoming examinations" description="Scheduled assessments requiring coordination." icon={CalendarDays}>
          <EventList items={upcomingExams.map(item => ({ id: item.id, title: textValue(item, ['title'], 'Examination'), detail: [textValue(item, ['class_name'], ''), textValue(item, ['subject'], '')].filter(value => value && value !== '—').join(' · '), date: item.exam_date, route: 'exams:calendar', kind: 'Exam' }))} loading={loading || !known('exams')} empty="No upcoming examinations are scheduled." onNavigate={onNavigate}/>
        </Panel>
        <Panel title="Results awaiting publication" description="Result records not yet released to learners." icon={ClipboardCheck} action={<button type="button" className="rd-text-action" onClick={() => onNavigate('exam_results:all')}>Open results</button>}>
          {!known('exam_results') ? <EmptyState loading={loading} message="Result data is unavailable."/> : pendingResults.length ? <div className="rd-list">
            {pendingResults.slice(0, 6).map(item => <button type="button" className="rd-list-row rd-list-button" key={item.id} onClick={() => onNavigate('exam_results:all')}>
              <span className="rd-row-icon result"><Award size={15}/></span><span className="rd-row-copy"><strong>{textValue(item, ['student_name', 'exam_title'], 'Result record')}</strong><small>{textValue(item, ['exam_title', 'subject'], 'Assessment')}</small></span><span className="rd-row-tag pending">{textValue(item, ['result_status'], 'Draft')}</span>
            </button>)}
          </div> : <EmptyState loading={false} message="All visible result records are published."/>}
        </Panel>
        <Panel title="Assessment approvals" description="Examination workflow requests awaiting a decision." icon={ShieldAlert}>
          <ApprovalList items={pendingApprovals} loading={loading || !known('workflow_approvals')} onNavigate={onNavigate}/>
        </Panel>
        <Panel title="Institution notices" description="Latest announcements for examination staff." icon={Megaphone}>
          <NoticeList items={notices} loading={loading || !known('announcements')}/>
        </Panel>
      </div>
    })(),
  }

  return <main className="ed360-role-dashboard">
    <header className="rd-page-head">
      <div className="rd-heading-main">
        <span className="rd-heading-icon"><GraduationCap size={23}/></span>
        <div><span className="rd-eyebrow">{heading.eyebrow}</span><h1>{heading.title}</h1><p>{heading.subtitle}</p></div>
      </div>
      <div className="rd-heading-meta">
        <span className="rd-role-chip">{roleLabels[role]}</span>
        <span className="rd-session-chip"><CalendarDays size={14}/>{sessionCaption}</span>
        <span className="rd-date-chip"><Clock3 size={14}/>{lastSyncedAt ? 'Updated ' + lastSyncedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        <span className="rd-live-chip" aria-live="polite"><i className={realtimeStatus === 'live' ? 'is-live' : ''}/>{realtimeStatus === 'live' ? 'Live updates' : realtimeStatus === 'connecting' ? 'Connecting' : 'Auto refresh'}</span>
        <button type="button" className="rd-header-cta" onClick={() => onNavigate(primaryAction[role].route)}>{primaryAction[role].label}</button>
      </div>
    </header>
    {errors && Object.keys(errors).length > 0 && <div className="rd-data-warning" role="status"><CircleAlert size={16}/><span>Some live sections could not be loaded. Unavailable figures are shown as a dash rather than being reported as zero.</span></div>}
    <section className="rd-metric-grid" aria-label={roleLabels[role] + ' dashboard summary'}>
      {metrics.map(metric => <MetricCard key={metric.label} icon={metric.icon} label={metric.label} value={loading ? '—' : metric.value} hint={metric.hint} tone={metric.tone} onClick={metric.route ? () => onNavigate(metric.route!) : undefined}/>)}
    </section>
    {(role === 'owner' || role === 'admin') && <section className="rd-domain-overview" aria-labelledby="rd-domain-overview-title">
      <header className="rd-domain-overview-head">
        <div>
          <span className="rd-eyebrow">INSTITUTION AT A GLANCE</span>
          <h2 id="rd-domain-overview-title">All key areas</h2>
          <p>Every core area stays visible, even before its first record is added. Figures refresh as your institution’s records are saved.</p>
        </div>
        <span className="rd-domain-live"><i className={realtimeStatus === 'live' ? 'is-live' : ''}/>{realtimeStatus === 'live' ? 'Live overview' : 'Auto-updating overview'}</span>
      </header>
      <div className="rd-domain-grid">
        {managerOverviewCards.map(card => <article className="rd-domain-card" key={card.title}>
          <header className="rd-domain-card-head">
            <span className={'rd-domain-icon ' + card.tone}><card.icon size={18}/></span>
            <div><h3>{card.title}</h3><p>{card.description}</p></div>
          </header>
          <div className="rd-domain-stats">
            {card.stats.map(stat => <button type="button" key={stat.label} onClick={() => onNavigate(stat.route)} aria-label={stat.label + ': ' + stat.value + '. Open related workspace.'}>
              <strong>{loading ? '—' : stat.value}</strong>
              <small>{stat.label}</small>
            </button>)}
          </div>
        </article>)}
      </div>
    </section>}
    {rolePanels[role]}
    <footer className="rd-dashboard-footnote"><CheckCircle2 size={15}/><span>Dashboard figures come from live institution records visible to your signed-in role. Empty states mean no matching records were returned; unavailable figures are not treated as zero.</span></footer>
  </main>
}
