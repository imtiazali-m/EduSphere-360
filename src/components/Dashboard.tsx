import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowRight, BookOpen, Building2, CalendarCheck, CalendarDays,
  ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList, DoorOpen, FileText,
  GraduationCap, LayoutDashboard, LogOut, Menu, Megaphone, PieChart, Search,
  School, Settings, ShieldCheck, Users, Wallet, X, UserRound, BrainCircuit,
  Calculator, Banknote, TrendingUp, BookOpenCheck, HeartHandshake, MessageSquare,
  FileQuestion, ListChecks, BarChart3, Award, Library, Wrench, Database, Bell,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { roleNavigationGroups, roleNavigationSections } from '../lib/navigationAccess'
import { getNavigationRoute } from '../lib/navigationRoutes'
import { useAuth } from '../context/AuthContext'
import { modulesForRole, roleLabels } from '../lib/modules'
import { listRecords } from '../lib/data'
import { userFacingError } from '../lib/userErrors'
import { outstandingInvoiceBalance } from '../lib/finance'
import type { AppRole, ModuleConfig, RecordRow } from '../lib/types'
import { RecordModule } from './RecordModule'
import { RoleDashboard } from './RoleDashboard'
import { AccountsModule } from './AccountsModule'
import { FilesModule } from './FilesModule'
import AdministrationModule from './AdministrationModule'
import { ReportsModule } from './ReportsModule'
import { ProfileModule } from './ProfileModule'
import { FacultyWorkspace } from './FacultyWorkspace'
import { institutionalMenu } from '../lib/institutionalCatalog'
import { InstitutionalWorkspace } from './InstitutionalWorkspace'
import { AttendanceWorkspace } from './AttendanceWorkspace'
import { LinkedOperationsWorkspace } from './LinkedOperationsWorkspace'
import { NotificationCenter } from './NotificationCenter'
import { WorkspaceUnavailable } from './WorkspaceUnavailable'
import { FinanceWorkspace } from './FinanceWorkspace'
import { PayrollWorkspace } from './PayrollWorkspace'
import { GovernanceWorkspace } from './GovernanceWorkspace'
import { InstitutionOperationsWorkspace } from './InstitutionOperationsWorkspace'
import { supabase } from '../lib/supabase'

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
  FileQuestion, ClipboardCheck, ClipboardList, ListChecks, BarChart3, Award, Library, Wrench, FileText, UserRound, Megaphone, Database, DoorOpen, Settings, ShieldCheck,
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


const tableLabels: Record<string, string> = {
  institutional_records: 'Institutional operation',
  students: 'Student', teachers: 'Faculty member', attendance: 'Attendance entry', exams: 'Examination',
  exam_results: 'Exam result', fee_invoices: 'Fee invoice', assignments: 'Assignment',
  timetable_entries: 'Timetable entry', announcements: 'Announcement', departments: 'Department', programs: 'Program', classes: 'Class section', academic_sessions: 'Academic session', subjects: 'Subject', rooms: 'Room / facility',
}
const tableToModule: Record<string, string> = {
  institutional_records: 'reports',
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
  const [dateScope, setDateScope] = useState('365')
  const [campusScope, setCampusScope] = useState('')
  const [sessionScope, setSessionScope] = useState('')
  const [classScope, setClassScope] = useState('')
  const available = useMemo(() => modulesForRole(user!.role), [user?.role])
  const visibleGroups = useMemo(() => roleNavigationGroups(user!.role), [user?.role])

  useEffect(() => {
    let live = true
    async function load() {
      setLoading(true)
      setLoadNote('')
      const adminTables = ['departments', 'programs', 'classes', 'academic_sessions', 'subjects', 'rooms', 'campuses']
      const dashboardTables = user!.role === 'owner' || user!.role === 'admin'
        ? [...available.map(module => module.table), ...adminTables, 'institutional_records']
        : [...available.map(module => module.table), 'institutional_records']
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

  const sessionOptions = getRows(data,'academic_sessions').map(row=>({id:row.id,label:firstText(row,['session_name','name','code'],row.id)}))
  const classOptions = [...new Set([
    ...getRows(data,'students').map(row=>String(row.class_name??'')),
    ...getRows(data,'classes').map(row=>String(row.name??'')),
    ...getRows(data,'classes').map(row=>String(row.class_name??''))
  ].filter(Boolean))].sort()
  const scopedData = useMemo(() => {
    const cutoff = dateScope === 'all' ? null : Date.now() - Number(dateScope) * 86400000
    return Object.fromEntries(Object.entries(data).map(([table,rows]) => [table,rows.filter(row => {
      if (campusScope && String(row.campus_id??'') !== campusScope) return false
      if (sessionScope) {
        const label = sessionOptions.find(item=>item.id===sessionScope)?.label
        const value = String(row.academic_session_id??row.academic_session??row.session_id??row.session_name??'')
        if (value !== sessionScope && value !== label) return false
      }
      if (classScope && String(row.class_name??row.grade_level??'') !== classScope) return false
      if (cutoff !== null) {
        const dateKeys:Record<string,string[]> = {
          attendance:['attendance_date'], employee_attendance:['attendance_date'], exams:['exam_date'],
          exam_results:['created_at'], fee_invoices:['invoice_date','created_at'], fee_payments:['payment_date','created_at'],
          assignments:['due_date','created_at'], assignment_submissions:['submitted_at','created_at'],
          institutional_records:['record_date','created_at'], students:['created_at'], teachers:['created_at']
        }
        const date = rowDate(row,dateKeys[table]??['record_date','created_at'])
        if (!date || date.getTime() < cutoff) return false
      }
      return true
    })]))
  },[data,dateScope,campusScope,sessionScope,classScope,sessionOptions])
  const stats = useMemo(() => buildStats(user!.role, scopedData), [user?.role, scopedData])
  const students = getRows(scopedData, 'students')
  const teachers = getRows(scopedData, 'teachers')
  const attendance = getRows(scopedData, 'attendance')
  const exams = getRows(scopedData, 'exams')
  const results = getRows(scopedData, 'exam_results')
  const assignments = getRows(scopedData, 'assignments')
  const submissions = getRows(scopedData, 'assignment_submissions')
  const invoices = getRows(scopedData, 'fee_invoices')
  const announcements = getRows(scopedData, 'announcements')
  const tasks = getRows(scopedData, 'work_tasks')
  const departments = getRows(scopedData, 'departments')
  const programs = getRows(scopedData, 'programs')
  const classes = getRows(scopedData, 'classes')
  const subjects = getRows(scopedData, 'subjects')
  const rooms = getRows(scopedData, 'rooms')
  const timetable = getRows(scopedData, 'timetable_entries')

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

  const institutionalOperations = getRows(scopedData, 'institutional_records')
  const moduleBreakdown = [
    { label: 'Institutional Workflows', count: institutionalOperations.length, color: '#687bd6' },
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

  const recent = useMemo(() => Object.entries(scopedData).flatMap(([table, rows]) => rows.map(row => ({ table, row })))
    .sort((a, b) => String(b.row.created_at ?? '').localeCompare(String(a.row.created_at ?? ''))).slice(0, 4), [scopedData])

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
  const presentEntries = attendance.filter(row => String(row.status ?? '').toLowerCase() === 'present').length
  const attendanceRate = attendance.length ? Math.round((presentEntries / attendance.length) * 100) : 0
  const feesCollected = invoices.reduce((total, row) => total + Number(row.paid_amount ?? 0), 0)
  const feesOutstanding = invoices.reduce((total, row) => total + outstandingInvoiceBalance(row), 0)
  const financeScale = Math.max(1, feesCollected, feesOutstanding)
  const peopleScale = Math.max(1, students.length, teachers.length)
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

  // First-run guidance is derived only from institution records already loaded
  // under the signed-in role and RLS policies. It never inserts sample data.
  const hasRecords = (...tables: string[]) => tables.some(table => getRows(data, table).length > 0)
  const workspaceGuide = user!.role === 'owner' || user!.role === 'admin'
    ? {
      heading: 'Build your institution workspace',
      intro: 'A practical launch path for setting up academic structure, people and everyday operations.',
      steps: [
        { title: 'Set up academic structure', detail: 'Create the academic session, classes, departments and subjects your institution uses.', route: 'admin:academic_sessions', action: 'Open administration', icon: Building2, started: hasRecords('academic_sessions', 'classes', 'departments', 'subjects') },
        { title: 'Register your learners', detail: 'Create admission records and connect each learner to the right class and family.', route: 'students:admissions', action: 'Open admissions', icon: GraduationCap, started: hasRecords('students') },
        { title: 'Build your team', detail: 'Add faculty and staff profiles and organise responsibilities across departments.', route: 'teachers', action: 'Open staff', icon: Users, started: hasRecords('teachers') },
        { title: 'Activate daily operations', detail: 'Start the attendance register and publish the first class timetable.', route: 'attendance:students', action: 'Open attendance', icon: CalendarCheck, started: hasRecords('attendance', 'timetable_entries') },
        { title: 'Set up fee administration', detail: 'Create fee invoices and review received payments and outstanding balances.', route: 'finance:fees:invoices', action: 'Open fee ledger', icon: Wallet, started: hasRecords('fee_invoices') },
        { title: 'Connect your community', detail: 'Publish an institution announcement for the relevant staff and families.', route: 'announcements', action: 'Open announcements', icon: Megaphone, started: hasRecords('announcements') },
      ],
    }
    : user!.role === 'teacher'
      ? {
        heading: 'Your teaching workbench',
        intro: 'Start with the daily teaching activities and follow the records available to your account.',
        steps: [
          { title: 'Review your learner list', detail: 'Open the permitted student directory and check your class records.', route: 'students:directory', action: 'View learners', icon: Users, started: hasRecords('students') },
          { title: 'Record attendance', detail: 'Open the class register and record the attendance session.', route: 'attendance:students', action: 'Take attendance', icon: CalendarCheck, started: hasRecords('attendance') },
          { title: 'Create or review coursework', detail: 'Manage homework, assignment deadlines and student submissions.', route: 'assignments:board', action: 'Open assignments', icon: BookOpen, started: hasRecords('assignments', 'assignment_submissions') },
          { title: 'Prepare assessments', detail: 'Review examination schedules and available result records.', route: 'exams:calendar', action: 'View examinations', icon: ClipboardCheck, started: hasRecords('exams', 'exam_results') },
        ],
      }
      : user!.role === 'student'
        ? {
          heading: 'Your learning hub',
          intro: 'Keep track of the learning information currently available in your student account.',
          steps: [
            { title: 'Check your timetable', detail: 'Review class, subject, room and period information.', route: 'timetable:week', action: 'Open timetable', icon: CalendarDays, started: hasRecords('timetable_entries') },
            { title: 'Review homework', detail: 'See coursework, instructions and upcoming submission deadlines.', route: 'assignments:open', action: 'Open homework', icon: BookOpen, started: hasRecords('assignments') },
            { title: 'Follow your attendance', detail: 'Review the attendance entries visible to your account.', route: 'attendance:students', action: 'View attendance', icon: CalendarCheck, started: hasRecords('attendance') },
            { title: 'View published results', detail: 'Check examination results released by your institution.', route: 'exam_results:published', action: 'View results', icon: Award, started: hasRecords('exam_results') },
            { title: 'Check fee balance', detail: 'Review fee information currently available in your student account.', route: 'finance:fees:invoices', action: 'View fee balance', icon: Wallet, started: hasRecords('fee_invoices') },
          ],
        }
        : user!.role === 'parent'
          ? {
            heading: 'Your family portal',
            intro: 'Follow the information shared by your institution for your linked learner.',
            steps: [
              { title: 'Review your linked learner', detail: 'Open the learner profile and confirm the information shared with your account.', route: 'students:profile', action: 'Open learner profile', icon: UserRound, started: hasRecords('students') },
              { title: 'Follow attendance', detail: 'Review attendance updates for the learner linked to your account.', route: 'attendance:students', action: 'View attendance', icon: CalendarCheck, started: hasRecords('attendance') },
              { title: 'Keep up with learning', detail: 'Review homework and available academic activities.', route: 'assignments:open', action: 'View learning', icon: BookOpen, started: hasRecords('assignments') },
              { title: 'Check academic progress', detail: 'Review examination results released by the institution.', route: 'exam_results:published', action: 'View results', icon: Award, started: hasRecords('exam_results') },
              { title: 'Check fee information', detail: 'Review the fee invoices and balances shared for your linked learner.', route: 'finance:fees:invoices', action: 'View fee information', icon: Wallet, started: hasRecords('fee_invoices') },
            ],
          }
          : user!.role === 'accountant'
            ? {
              heading: 'Your finance workbench',
              intro: 'Work from the current institution fee and finance records available to your account.',
              steps: [
                { title: 'Review fee invoices', detail: 'Check invoice values, due dates and current balances.', route: 'finance:fees:invoices', action: 'Open invoices', icon: Wallet, started: hasRecords('fee_invoices') },
                { title: 'Record collections', detail: 'Open an invoice and record a verified payment against its balance.', route: 'finance:fees:payments', action: 'Open collections', icon: Banknote, started: getRows(data, 'fee_invoices').some(row => Number(row.paid_amount ?? 0) > 0) },
                { title: 'Follow outstanding dues', detail: 'Identify unpaid and partially paid invoices for follow-up.', route: 'finance:receivables:receivables', action: 'Review dues', icon: TrendingUp, started: getRows(data, 'fee_invoices').some(row => outstandingInvoiceBalance(row) > 0) },
                { title: 'Review finance reports', detail: 'Use current institution records to review collection and balances.', route: 'reports:finance', action: 'Open reports', icon: FileText, started: hasRecords('fee_invoices') },
              ],
            }
            : {
              heading: 'Your examination workbench',
              intro: 'Organise assessments and follow the result records available to your examination role.',
              steps: [
                { title: 'Build the question bank', detail: 'Review institution question pools and prepare examination paper drafts.', route: 'operations:question-bank:pool', action: 'Open question bank', icon: FileQuestion, started: hasRecords('exams') },
                { title: 'Review the exam calendar', detail: 'Check planned and completed examination schedules.', route: 'exams:calendar', action: 'Open exam calendar', icon: CalendarDays, started: hasRecords('exams') },
                { title: 'Enter and review marks', detail: 'Work with examination marks and result records.', route: 'exam_results:all', action: 'Open marks', icon: ClipboardCheck, started: hasRecords('exam_results') },
                { title: 'Review published results', detail: 'Check the results currently released to authorised users.', route: 'exam_results:published', action: 'View published results', icon: Award, started: getRows(data, 'exam_results').some(row => row.result_status === 'published') },
                { title: 'Review academic reports', detail: 'Use the available assessment records for academic reporting.', route: 'reports:academics', action: 'Open reports', icon: BarChart3, started: hasRecords('exam_results') },
              ],
            }
  const guideStartedCount = workspaceGuide.steps.filter(step => step.started).length

  return <div className="ed360-dashboard">
    <header className="ed360-dashboard-heading">
      <div className="ed360-heading-title">
        <span className="ed360-heading-emblem"><GraduationCap size={25}/></span>
        <div><h1>Dashboard</h1><p>Welcome back, {user!.fullName.split(' ')[0]}! Here’s your institution overview.</p></div>
      </div>
      <div className="ed360-heading-date"><CalendarDays size={16}/><span>{today}</span></div>
    </header>
    <section className="ed360-dashboard-scope" aria-label="Dashboard data filters">
      <label>Date range<select value={dateScope} onChange={event=>setDateScope(event.target.value)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option><option value="all">All recorded dates</option></select></label>
      <label>Campus<select value={campusScope} onChange={event=>setCampusScope(event.target.value)}><option value="">All campuses</option>{getRows(data,'campuses').map(row=><option value={row.id} key={row.id}>{String(row.name??'Campus')}</option>)}</select></label>
      <label>Academic session<select value={sessionScope} onChange={event=>setSessionScope(event.target.value)}><option value="">All sessions</option>{sessionOptions.map(item=><option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      <label>Class / section<select value={classScope} onChange={event=>setClassScope(event.target.value)}><option value="">All classes</option>{classOptions.map(item=><option value={item} key={item}>{item}</option>)}</select></label>
    </section>

    <section className="ed360-metric-grid" aria-label="Institution statistics">
      {stats.map((stat, index) => <button type="button" className={'ed360-metric-card ed360-metric-' + (index + 1)} key={stat.label} onClick={() => onNavigate(stat.route)}>
        <span className="ed360-metric-icon"><stat.icon size={25}/></span>
        <span className="ed360-metric-copy"><small>{stat.label}</small><strong>{loading ? '—' : stat.value}</strong><em>{stat.hint}</em></span>
        <span className="ed360-metric-arrow"><ArrowRight size={16}/></span>
      </button>)}
    </section>

    <section className="ed360-start-panel" aria-labelledby="ed360-start-title">
      <header className="ed360-start-heading">
        <div>
          <span className="ed360-start-kicker">A CLEAR NEXT STEP</span>
          <h2 id="ed360-start-title">{workspaceGuide.heading}</h2>
          <p>{workspaceGuide.intro}</p>
        </div>
        <div className="ed360-start-progress" aria-live="polite">
          <strong>{loading ? '—' : guideStartedCount + '/' + workspaceGuide.steps.length}</strong>
          <span>{loading ? 'Checking records' : 'areas with saved records'}</span>
        </div>
      </header>
      <div className="ed360-start-grid">
        {workspaceGuide.steps.map((step, index) => <article className={'ed360-start-card' + (step.started ? ' is-started' : '')} key={step.title}>
          <div className="ed360-start-card-top">
            <span className="ed360-start-number">{String(index + 1).padStart(2, '0')}</span>
            <span className="ed360-start-icon"><step.icon size={19}/></span>
            <span className={'ed360-start-status' + (step.started ? ' is-started' : '')}>{loading ? 'Checking' : step.started ? 'Records found' : 'Not started'}</span>
          </div>
          <h3>{step.title}</h3>
          <p>{step.detail}</p>
          <button type="button" onClick={() => onNavigate(step.route)}>{step.action}<ArrowRight size={14}/></button>
        </article>)}
      </div>
      <p className="ed360-start-footnote">Status is based on saved records visible to your signed-in role. It does not certify that a complete business workflow has been configured.</p>
    </section>

    <div className="ed360-dashboard-row ed360-dashboard-row-primary">
      <section className="ed360-panel ed360-academic-panel">
        <div className="ed360-panel-heading">
          <div><span className="ed360-panel-icon"><BarChart3 size={18}/></span><div><h2>Academic Overview</h2><p>Monthly activity across your available institutional records.</p></div></div>
          <span className="ed360-chart-period">{dateScope === "all" ? "All recorded dates" : "Last " + dateScope + " days"} · {monthLabels[0]}–{monthLabels[5]}</span>
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
          <div className="ed360-donut" style={{ background: donutBackground }}><div className="ed360-donut-center"><strong>{visibleGroups.length}</strong><span>Modules</span></div></div>
          <div className="ed360-module-legend">
            {moduleBreakdown.map(item => <div key={item.label}><i style={{ background: item.color }}/><span>{item.label}</span><strong>{loading ? '—' : modulePercent(item.count) + '%'}</strong></div>)}
          </div>
        </div>
      </section>
    </div>

    <div className="ed360-dashboard-row ed360-analytics-row">
      <section className="ed360-panel ed360-gauge-panel">
        <div className="ed360-panel-heading"><div><span className="ed360-panel-icon"><Activity size={18}/></span><div><h2>Attendance Gauge</h2><p>Present entries in the selected date range.</p></div></div></div>
        <div className="ed360-gauge-content">
          <div className="ed360-attendance-gauge" style={{ background: `conic-gradient(#2f765d 0 ${attendanceRate}%, #e8efe7 ${attendanceRate}% 100%)` }} role="img" aria-label={attendance.length ? `${attendanceRate}% of attendance entries are marked present` : 'No attendance entries recorded'}>
            <div><strong>{loading || !attendance.length ? '—' : attendanceRate + '%'}</strong><span>{attendance.length ? 'Present' : 'No data yet'}</span></div>
          </div>
          <div className="ed360-gauge-details"><strong>{loading ? '—' : presentEntries.toLocaleString()}</strong><span>Present entries</span><strong>{loading ? '—' : Math.max(0, attendance.length - presentEntries).toLocaleString()}</strong><span>Other statuses</span></div>
        </div>
      </section>

      <section className="ed360-panel ed360-finance-compare-panel">
        <div className="ed360-panel-heading"><div><span className="ed360-panel-icon"><Wallet size={18}/></span><div><h2>Fee Collection Comparison</h2><p>Collected and outstanding invoice balances.</p></div></div></div>
        <div className="ed360-compare-bars">
          <div><div className="ed360-compare-label"><span>Collected</span><strong>{loading ? '—' : money(feesCollected)}</strong></div><div className="ed360-compare-track"><i className="is-collected" style={{ width: (feesCollected / financeScale * 100) + '%' }}/></div></div>
          <div><div className="ed360-compare-label"><span>Outstanding</span><strong>{loading ? '—' : money(feesOutstanding)}</strong></div><div className="ed360-compare-track"><i className="is-outstanding" style={{ width: (feesOutstanding / financeScale * 100) + '%' }}/></div></div>
        </div>
        <div className="ed360-chart-footnote">Amounts use the current institution fee records and generated invoice balances.</div>
      </section>

      <section className="ed360-panel ed360-people-compare-panel">
        <div className="ed360-panel-heading"><div><span className="ed360-panel-icon"><Users size={18}/></span><div><h2>People Overview</h2><p>Student and faculty record comparison.</p></div></div></div>
        <div className="ed360-column-compare">
          <div><span>Students</span><strong>{loading ? '—' : students.length.toLocaleString()}</strong><i className="is-students" style={{ height: (students.length / peopleScale * 100) + '%' }}/></div>
          <div><span>Faculty</span><strong>{loading ? '—' : teachers.length.toLocaleString()}</strong><i className="is-faculty" style={{ height: (teachers.length / peopleScale * 100) + '%' }}/></div>
        </div>
        <div className="ed360-chart-footnote">Counts reflect records visible to your signed-in role.</div>
      </section>
    </div>

    <div className="ed360-dashboard-row ed360-dashboard-row-secondary">
      <section className="ed360-panel ed360-recent-panel">
        <div className="ed360-panel-heading"><div><span className="ed360-panel-icon"><Activity size={18}/></span><div><h2>Recent Activity</h2><p>The latest records added to your available workspaces.</p></div></div><button type="button" className="ed360-view-link" onClick={() => onNavigate(available[0]?.key ?? 'overview')}>View all <ArrowRight size={14}/></button></div>
        {loading ? <div className="ed360-empty">Loading recent records…</div> : recent.length ? <div className="ed360-recent-list">{recent.map(({ table, row }, index) => {
          const title = firstText(row, ['full_name', 'title', 'fee_title', 'student_name', 'exam_title', 'admission_no', 'name'], tableLabels[table] ?? 'Record')
          const detail = firstText(row, ['class_name', 'subject', 'department', 'admission_no', 'audience'], tableLabels[table] ?? 'Institution record')
          const operationGroup = table === 'institutional_records' ? institutionalMenu.find(group => group.dataModule === String(row.module_key ?? '')) : undefined
          const route = operationGroup ? 'institutional:' + operationGroup.key + ':' + String(row.record_type ?? '') : tableToModule[table] ?? table
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

const adminModuleLabels: Record<string, string> = {
  departments: 'Departments', programs: 'Programs', classes: 'Class Sections',
  academic_sessions: 'Academic Sessions', subjects: 'Subjects', rooms: 'Rooms & Facilities',
}

type WorkspaceTab = { id: string; route: string; targetKey: string; targetWindow: string; title: string; parentId?: string; groupKey?: string; itemKey?: string }

export function Dashboard({ onToast }: Props) {
  const { user, mode, signOut } = useAuth()
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspaceTab[]>([{ id: 'overview', route: 'overview', targetKey: 'overview', targetWindow: 'overview', title: 'Dashboard' }])
  const [activeTabId, setActiveTabId] = useState('overview')
  const activeTab = workspaceTabs.find(tab => tab.id === activeTabId) ?? workspaceTabs[0]
  const activeNavigationTab = (() => {
    let current = activeTab
    while (current.parentId) {
      const parent = workspaceTabs.find(tab => tab.id === current.parentId)
      if (!parent) break
      current = parent
    }
    return current
  })()
  const active = activeTab?.targetKey ?? 'overview'
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isMobileNav, setIsMobileNav] = useState(() => window.matchMedia('(max-width: 820px)').matches)
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['dashboard'])
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0)

  // Keep the sidebar context aligned with the parent workspace for nested windows.
  useEffect(() => {
    const groupKey = activeNavigationTab.groupKey
    if (!groupKey) return
    setExpandedGroups(current => current.includes(groupKey) ? current : [...current, groupKey])
  }, [activeNavigationTab.groupKey])

  const available = useMemo(() => modulesForRole(user!.role), [user?.role])
  const visibleGroups = useMemo(() => roleNavigationGroups(user!.role), [user?.role])
  const visibleSections = useMemo(() => roleNavigationSections(user!.role), [user?.role])
  const searchResults = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    if (!query) return []
    const items = visibleGroups.flatMap(group => (group.key === 'dashboard' ? ['Dashboard'] : group.items).map(title => {
      const itemKey = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      return { title, group: group.label, groupKey: group.key, itemKey, route: getNavigationRoute(group.key, title, user!.role) }
    }))
    return items.filter(item => item.route && `${item.title} ${item.group}`.toLowerCase().includes(query)).slice(0, 8)
  }, [searchText, visibleGroups])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px)')
    const syncMobileNav = () => setIsMobileNav(media.matches)
    syncMobileNav()
    media.addEventListener('change', syncMobileNav)
    return () => media.removeEventListener('change', syncMobileNav)
  }, [])

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
        document.getElementById('ed360-workspace-search')?.focus()
      } else if (event.key === 'Escape') {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  useEffect(() => {
    const container = document.querySelector<HTMLElement>('.pro-workspace-tabs')
    if (!container) return
    const selected = Array.from(container.querySelectorAll<HTMLElement>('[data-workspace-tab]'))
      .find(element => element.dataset.workspaceTab === activeTabId)
    if (!selected) return
    const containerBounds = container.getBoundingClientRect()
    const selectedBounds = selected.getBoundingClientRect()
    const inset = 10
    let nextLeft = container.scrollLeft
    if (selectedBounds.left < containerBounds.left + inset) {
      nextLeft -= containerBounds.left + inset - selectedBounds.left
    } else if (selectedBounds.right > containerBounds.right - inset) {
      nextLeft += selectedBounds.right - (containerBounds.right - inset)
    }
    if (Math.abs(nextLeft - container.scrollLeft) > 1) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      container.scrollTo({ left: Math.max(0, nextLeft), behavior: reduceMotion ? 'auto' : 'smooth' })
    }
  }, [activeTabId, workspaceTabs.length])

  useEffect(() => {
    let live = true
    async function loadUnreadCount() {
      if (!supabase || !user) { if (live) setUnreadAnnouncementCount(0); return }
      try {
        const announcements = await listRecords(mode, user, 'announcements')
        if (!announcements.length) { if (live) setUnreadAnnouncementCount(0); return }
        const ids = announcements.map(row => String(row.id))
        const { data, error } = await supabase.from('announcement_reads')
          .select('announcement_id').eq('institution_id', user.institutionId)
          .eq('user_id', user.id).in('announcement_id', ids)
        if (error) throw error
        const read = new Set((data ?? []).map(row => String(row.announcement_id)))
        if (live) setUnreadAnnouncementCount(announcements.filter(row => !read.has(String(row.id))).length)
      } catch {
        if (live) setUnreadAnnouncementCount(0)
      }
    }
    void loadUnreadCount()
    return () => { live = false }
  }, [user?.id, user?.institutionId, active, mode])

  function navigate(key: string, options: { parentId?: string; title?: string; groupKey?: string; itemKey?: string } = {}) {
    const studentWindowRoute = key.startsWith('students:')
    const attendanceWindowRoute = key.startsWith('attendance:')
    const institutionalWindowRoute = key.startsWith('institutional:')
    const unavailableWindowRoute = key.startsWith('unavailable:')
    const employeeWindowRoute = key.startsWith('employees:')
    const reportsWindowRoute = key.startsWith('reports:')
    const financeWindowRoute = key.startsWith('finance:')
    const payrollWindowRoute = key.startsWith('payroll:')
    const governanceWindowRoute = key.startsWith('governance:')
    const operationsWindowRoute = key.startsWith('operations:')
    const routeParts = key.split(':')
    const moduleWindowRoute = routeParts.length === 2 && ['fees', 'exams', 'exam_results', 'assignments', 'assignment_submissions', 'timetable', 'announcements', 'work_tasks'].includes(routeParts[0])
    const targetKey = studentWindowRoute ? 'students'
      : attendanceWindowRoute ? 'attendance'
      : institutionalWindowRoute ? 'institutional'
      : unavailableWindowRoute ? 'unavailable'
      : employeeWindowRoute ? 'teachers'
      : reportsWindowRoute ? 'reports'
      : financeWindowRoute ? 'finance'
      : payrollWindowRoute ? 'payroll'
      : governanceWindowRoute ? 'governance'
      : operationsWindowRoute ? 'operations'
      : moduleWindowRoute ? routeParts[0]
      : key
    const targetWindow = studentWindowRoute ? key.slice('students:'.length)
      : attendanceWindowRoute ? key.slice('attendance:'.length)
      : institutionalWindowRoute ? key.slice('institutional:'.length)
      : unavailableWindowRoute ? key.slice('unavailable:'.length)
      : employeeWindowRoute ? key.slice('employees:'.length)
      : reportsWindowRoute ? key.slice('reports:'.length)
      : financeWindowRoute ? key.slice('finance:'.length)
      : payrollWindowRoute ? key.slice('payroll:'.length)
      : governanceWindowRoute ? key.slice('governance:'.length)
      : operationsWindowRoute ? key.slice('operations:'.length)
      : moduleWindowRoute ? routeParts[1]
      : 'overview'
    let title = options.title ?? 'Dashboard'

    if (!options.title) {
      if (targetKey === 'overview') title = 'Dashboard'
      else if (targetKey === 'notifications') title = 'Notification Centre'
      else if (targetKey === 'institutional') title = 'Institutional Workspace'
      else if (targetKey === 'unavailable') title = 'Workspace not connected'
      else if (targetKey === 'attendance') title = 'Attendance Management'
      else if (targetKey === 'reports') title = 'Reports'
      else if (targetKey === 'finance') title = 'Finance & Payments'
      else if (targetKey === 'payroll') title = 'Salary and Payroll'
      else if (targetKey === 'governance') title = 'Institution Governance'
      else if (targetKey === 'operations') title = 'Institution Operations'
      else if (targetKey.startsWith('admin:')) {
        const subkey = targetKey.slice(6)
        title = adminModuleLabels[subkey] ?? 'Administration'
      } else if (targetKey === 'accounts') title = 'User Accounts'
      else if (targetKey === 'files') title = 'Files & Documentation'
      else if (targetKey === 'profile') title = 'My Profile'
      else {
        const module = available.find(item => item.key === targetKey)
        if (!module && targetKey !== 'teachers') {
          onToast('This workspace is not enabled for your role.', true)
          return
        }
        title = targetKey === 'teachers' ? 'Employees and Faculty' : module?.title ?? 'Workspace'
      }
    }

    // A workspace window is identified by its canonical destination, not by the
    // menu label that happened to open it. Aliases therefore focus the same
    // window instead of creating two tabs that render the same or confusing view.
    const id = key
    const parentId = options.parentId && options.parentId !== id ? options.parentId : undefined
    const nextTab: WorkspaceTab = {
      id, route: key, targetKey, targetWindow, title,
      parentId, groupKey: options.groupKey, itemKey: options.itemKey,
    }
    setWorkspaceTabs(current => {
      const existing = current.some(tab => tab.id === id)
      return existing
        ? current.map(tab => tab.id === id ? nextTab : tab)
        : [...current, nextTab]
    })
    setActiveTabId(id)
    if (options.groupKey) {
      setExpandedGroups(current => current.includes(options.groupKey!) ? current : [...current, options.groupKey!])
    }
    setSidebarOpen(false)
    setSearchText('')
    setSearchOpen(false)
    setProfileOpen(false)
  }

  function navigateChild(key: string) {
    navigate(key, { parentId: activeTabId })
  }

  function navigateCatalogPage(groupKey: string, title: string) {
    const itemKey = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const route = getNavigationRoute(groupKey, title, user!.role)
    navigate(route, { title, groupKey, itemKey })
  }

  function selectSearchResult(result: { title: string; group: string; groupKey: string; itemKey: string; route?: string }) {
    if (!result.route) return
    navigate(result.route, { title: result.title, groupKey: result.groupKey, itemKey: result.itemKey })
  }

  function toggleGroup(key: string) {
    setExpandedGroups(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])
  }

  function closeWorkspaceTab(id: string) {
    if (id === 'overview') return
    const closing = new Set([id])
    let changed = true
    while (changed) {
      changed = false
      workspaceTabs.forEach(tab => {
        if (tab.parentId && closing.has(tab.parentId) && !closing.has(tab.id)) {
          closing.add(tab.id)
          changed = true
        }
      })
    }
    const closingTab = workspaceTabs.find(tab => tab.id === id)
    const remaining = workspaceTabs.filter(tab => !closing.has(tab.id))
    setWorkspaceTabs(remaining.length ? remaining : [{ id: 'overview', route: 'overview', targetKey: 'overview', targetWindow: 'overview', title: 'Dashboard' }])
    if (closing.has(activeTabId)) {
      const parentStillOpen = closingTab?.parentId && remaining.some(tab => tab.id === closingTab.parentId)
      setActiveTabId(parentStillOpen ? closingTab!.parentId! : remaining[remaining.length - 1]?.id ?? 'overview')
    }
  }

  async function logout() {
    await signOut()
    setProfileOpen(false)
    window.location.hash = '#/'
  }

  const compactSidebar = sidebarCollapsed && !isMobileNav
  const activeGroupLabel = activeNavigationTab.groupKey
    ? visibleGroups.find(group => group.key === activeNavigationTab.groupKey)?.label ?? 'Institution workspace'
    : activeNavigationTab.targetKey === 'overview' ? 'Overview' : 'Workspace'
  return <div className={`pro-app-shell ${sidebarOpen ? 'navigation-open' : ''} ${compactSidebar ? 'sidebar-collapsed' : ''}`}>
    <aside className={`pro-sidebar ${sidebarOpen ? 'is-open' : ''} ${compactSidebar ? 'is-collapsed' : ''}`} aria-hidden={isMobileNav && !sidebarOpen}>
      <div className="pro-sidebar-brand">
        <div className="pro-sidebar-mark"><GraduationCap size={25}/></div>
        <div className="pro-sidebar-brand-copy"><b>EduSphere <i>360</i></b><small>INSTITUTION MANAGEMENT</small></div>
        <button type="button" className="pro-sidebar-collapse" onClick={() => setSidebarCollapsed(value => !value)} aria-label={compactSidebar ? 'Expand navigation' : 'Collapse navigation'} aria-pressed={compactSidebar} title={compactSidebar ? 'Expand navigation' : 'Collapse navigation'}>
          {compactSidebar ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}
        </button>
        <button type="button" className="pro-mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={21}/></button>
      </div>
      <div className="pro-institution-card"><span className="pro-institution-symbol"><Building2 size={20}/></span><span><b>{user?.institutionName}</b><small>{roleLabels[user!.role]}</small></span></div>
      <nav className="pro-navigation" aria-label="Institution workspace">
        {visibleSections.map(section => <div className="pro-nav-section" key={section.key} aria-label={section.label}>
          <div className="pro-nav-section-label">{section.label}</div>
          {section.groups.map(group => {
            const GroupIcon = catalogIcons[group.icon] ?? LayoutDashboard
            const isExpanded = expandedGroups.includes(group.key)
            return <section className={`pro-nav-group ${isExpanded ? 'expanded' : ''}`} key={group.key}>
              <button className={`pro-nav-group-head ${group.key === "dashboard" ? "pro-nav-dashboard-link" : ""}`} aria-label={group.label} title={group.label} aria-expanded={isExpanded} onClick={() => {
                if (compactSidebar) setSidebarCollapsed(false)
                if (group.key === 'dashboard') {
                  setExpandedGroups(current => current.includes(group.key) ? current : [...current, group.key])
                  navigate('overview', { groupKey: 'dashboard', itemKey: 'institutional-overview', title: 'Dashboard' })
                } else if (compactSidebar) {
                  setExpandedGroups(current => current.includes(group.key) ? current : [...current, group.key])
                } else {
                  toggleGroup(group.key)
                }
              }}><span className="pro-nav-group-icon"><GroupIcon size={19}/></span><span className="pro-nav-group-name">{group.label}</span><ChevronRight className="pro-nav-chevron" size={17}/></button>
              {isExpanded && <div className="pro-nav-children">{group.items.map(item => {
                const itemKey = item.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                const route = getNavigationRoute(group.key, item, user!.role)
                const isActive = activeTab.route === route || (activeNavigationTab.groupKey === group.key && activeNavigationTab.itemKey === itemKey)
                const ItemIcon = pageIcon(item, GroupIcon)
                const connected = Boolean(route && !route.startsWith('unavailable:'))
                return <button key={item} className={`pro-nav-item ${isActive ? 'active' : ''}`} aria-label={item} title={item} aria-current={isActive ? 'page' : undefined} onClick={() => navigateCatalogPage(group.key, item)}><span className="pro-nav-icon"><ItemIcon size={16}/></span><span className="pro-nav-title">{item}</span>{connected && <i className="pro-nav-connected" title="Connected workspace"/>}</button>
              })}</div>}
            </section>
          })}
        </div>)}
      </nav>
      <section className="pro-quick-access" aria-label="Session">
        <button type="button" className="pro-nav-item pro-signout-item" aria-label="Sign out" title="Sign out" onClick={() => void logout()}>
          <span className="pro-nav-icon"><LogOut size={16}/></span><span className="pro-nav-title">Sign out</span>
        </button>
      </section>
    </aside>
    {sidebarOpen && <button className="pro-sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}/>}

    <main className="pro-main-shell">
      <header className="pro-topbar">
        <div className="pro-topbar-left">
          <button className="pro-mobile-menu" onClick={() => setSidebarOpen(open => !open)} aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={sidebarOpen}><Menu size={19}/></button>
          <div className="pro-search-wrap">
            <label className="pro-global-search"><Search size={17}/><input id="ed360-workspace-search" type="search" aria-label="Search available pages and tools" placeholder="Search pages and tools…" value={searchText} onFocus={() => setSearchOpen(true)} onChange={event => { setSearchText(event.target.value); setSearchOpen(true) }} onKeyDown={event => { if (event.key === 'Escape') { setSearchOpen(false); setSearchText('') } else if (event.key === 'Enter' && searchResults[0]) selectSearchResult(searchResults[0]) }}/>{searchText && <button type="button" aria-label="Clear search" onClick={() => { setSearchText(''); setSearchOpen(false) }}>×</button>}</label>
            {searchOpen && searchText.trim() && <div className="pro-search-results" role="listbox" aria-label="Workspace search results">{searchResults.length ? searchResults.map(result => <button type="button" key={result.group + '-' + result.title} role="option" onClick={() => selectSearchResult(result)}><span><b>{result.title}</b><small>{result.group}</small></span><ArrowRight size={15}/></button>) : <div className="pro-search-empty">No matching workspace found.</div>}</div>}
          </div>
        </div>
        <div className="pro-topbar-right">
          <div className="ed360-topbar-institution"><Building2 size={19}/><span><b>{user?.institutionName}</b><small><i className={'ed360-status-dot ' + (mode === 'cloud' ? 'is-cloud' : 'is-local')}/>{mode === 'cloud' ? 'Online' : 'Local workspace'}</small></span></div>
          <button type="button" className="pro-topbar-bell ed360-topbar-notice" aria-label={`Open notifications${unreadAnnouncementCount ? `, ${unreadAnnouncementCount} unread` : ''}`} title="Open notification centre" onClick={() => navigate('notifications')}><Bell size={18}/>{unreadAnnouncementCount > 0 && <span className="ed360-notification-count">{unreadAnnouncementCount > 99 ? '99+' : unreadAnnouncementCount}</span>}</button>
          <div className="pro-profile-wrap"><button className="pro-profile-trigger" onClick={() => setProfileOpen(open => !open)} aria-expanded={profileOpen}><span className="pro-profile-avatar">{user?.fullName.slice(0, 1).toUpperCase()}</span><span className="pro-profile-copy"><b>{user?.fullName}</b><small>{roleLabels[user!.role]}</small></span><ChevronDown size={14}/></button>{profileOpen && <div className="pro-profile-menu"><div className="pro-profile-details"><b>{user?.fullName}</b><small>{user?.email}</small><small>{user?.institutionName}</small>{user?.institutionType && <small>Institution type: {user.institutionType.replaceAll('_', ' ')}</small>}<small>Account role: {roleLabels[user!.role]}</small><span className={'pro-profile-mode ' + mode}>Cloud workspace</span></div>{['student', 'parent'].includes(user!.role) && <button type="button" onClick={() => navigate('profile')}><UserRound size={15}/> My Profile</button>}<button type="button" onClick={() => void logout()}><LogOut size={15}/> Sign out</button></div>}</div>
        </div>
      </header>
      <nav className="pro-workspace-tabs" aria-label="Open workspace windows">
        <div className="pro-workspace-tabs-label">OPEN WINDOWS</div>
        {workspaceTabs.map(tab => {
          const parentTab = tab.parentId ? workspaceTabs.find(parent => parent.id === tab.parentId) : undefined
          return <div className={`pro-workspace-tab ${activeTabId === tab.id ? 'is-active' : ''} ${parentTab ? 'is-child' : ''}`} key={tab.id} data-workspace-route={tab.route} data-workspace-tab={tab.id}>
            <button type="button" className="pro-workspace-tab-main" aria-label={`Open ${tab.title} workspace`} title={tab.title} aria-current={activeTabId === tab.id ? 'page' : undefined} onClick={() => setActiveTabId(tab.id)}>
              {parentTab ? <ChevronRight size={14}/> : tab.targetKey === 'overview' ? <LayoutDashboard size={15}/> : <FileText size={15}/>}
              <span>{tab.title}</span>
              {parentTab && <small title={`Opened from ${parentTab.title}`}>{parentTab.title}</small>}
            </button>
            {tab.id !== 'overview' && <button type="button" className="pro-workspace-tab-close" aria-label={`Close ${tab.title} and its sub-windows`} title={`Close ${tab.title} and its sub-windows`} onClick={() => closeWorkspaceTab(tab.id)}><X size={13}/></button>}
          </div>
        })}
        <span className="pro-workspace-tabs-help">Switch between open workspaces</span>
      </nav>
      <div className="pro-active-workspace-context" aria-live="polite" aria-atomic="true" data-active-route={activeTab.route}>
        <div><span>YOU ARE WORKING IN</span><strong>{activeTab.title}</strong><small>{activeGroupLabel} · {roleLabels[user!.role]}</small></div>
        <span className="pro-context-state"><i/> Active workspace</span>
      </div>
      <div className="pro-module-stage">
        <div className="pro-window-stack">
          {workspaceTabs.map(tab => {
            const tabModule = available.find(module => module.key === tab.targetKey)
            const tabAdminKey = tab.targetKey.startsWith('admin:') ? tab.targetKey.slice(6) : undefined
            const linkedWorkspaceKeys = ['administration:campus-and-branch-management','library:book-issue-and-returns','library:library-reports','inventory:stock-in','inventory:stock-out','inventory:stock-allocation','inventory:stock-adjustments','inventory:inventory-history','inventory:stock-reports','transport:student-transport-allocation','transport:transport-reports']
            return <section className="pro-window-panel" key={tab.id} hidden={activeTabId !== tab.id} aria-label={tab.title}>
              {tab.targetKey === 'notifications' ? <NotificationCenter onToast={onToast} onUnreadCountChange={setUnreadAnnouncementCount}/> :
                tab.targetKey === 'overview' ? <RoleDashboard onNavigate={navigateChild}/> :
                tab.targetKey === 'institutional' && linkedWorkspaceKeys.includes(tab.targetWindow) ? <LinkedOperationsWorkspace workspaceKey={tab.targetWindow} onToast={onToast} onNavigate={navigateChild}/> :
                tab.targetKey === 'institutional' ? <InstitutionalWorkspace workspaceKey={tab.targetWindow} onToast={onToast}/> :
                tab.targetKey === 'unavailable' ? <WorkspaceUnavailable groupKey={tab.targetWindow.split(':')[0]} itemKey={tab.targetWindow.split(':').slice(1).join(':')} onNavigate={navigate}/> :
                tab.targetKey === 'attendance' ? <AttendanceWorkspace initialWindow={tab.targetWindow || 'students'} onToast={onToast}/> :
                tabAdminKey ? <AdministrationModule initialKey={tabAdminKey as 'departments' | 'programs' | 'classes' | 'academic_sessions' | 'subjects' | 'rooms'}/> :
                tab.targetKey === 'accounts' ? <AccountsModule onToast={onToast}/> :
                tab.targetKey === 'files' ? <FilesModule onToast={onToast}/> :
                tab.targetKey === 'reports' ? <ReportsModule onToast={onToast} initialWindow={tab.targetWindow}/> :
                tab.targetKey === 'finance' ? <FinanceWorkspace workspaceKey={tab.targetWindow} initialWindow={tab.targetWindow.split(':')[1]} onToast={onToast}/> :
                tab.targetKey === 'payroll' ? <PayrollWorkspace initialWindow={tab.targetWindow} onToast={onToast}/> :
                tab.targetKey === 'governance' ? <GovernanceWorkspace initialWindow={tab.targetWindow} onToast={onToast} onNavigate={navigateChild}/> :
                tab.targetKey === 'operations' ? <InstitutionOperationsWorkspace workspaceKey={tab.targetWindow} initialWindow={tab.targetWindow.split(':')[1]} onToast={onToast}/> :
                tab.targetKey === 'profile' ? <ProfileModule/> :
                tab.targetKey === 'teachers' ? <FacultyWorkspace onToast={onToast} onNavigate={navigateChild} initialWindow={tab.targetWindow}/> :
                tabModule ? <RecordModule module={tabModule as ModuleConfig} onToast={onToast} initialWindow={tab.targetWindow} showWindowNavigation={tab.targetKey !== 'students'}/> :
                <Overview onNavigate={navigate}/>}
            </section>
          })}
        </div>
      </div>
    </main>
  </div>
}
