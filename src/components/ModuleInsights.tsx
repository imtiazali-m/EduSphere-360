import { useMemo } from 'react'
import {
  Activity, BadgeCheck, BookOpen, Building2, CalendarCheck, CalendarDays, ClipboardCheck,
  ClipboardList, Clock3, GraduationCap, Megaphone, TrendingUp, Users, Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ModuleConfig, RecordRow } from '../lib/types'

type Props = { module: ModuleConfig; rows: RecordRow[]; loading: boolean }
type Metric = { label: string; value: string; note: string; tone: string; icon: LucideIcon }
type Breakdown = { label: string; value: number; color: string }
type WorkspaceSummary = { metrics: Metric[]; chartTitle: string; chartNote: string; breakdown: Breakdown[]; secondaryTitle: string; secondaryNote: string; secondary: string[] }

const palette = { blue: '#2877ee', green: '#16a36b', violet: '#8b62e8', amber: '#ef9226', teal: '#13a8b6', rose: '#df6c91', slate: '#8798ad' }
const textValue = (row: RecordRow, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = row[key]
    if (value !== null && value !== undefined && String(value).trim()) return String(value)
  }
  return fallback
}
const dateValue = (row: RecordRow, keys: string[]) => {
  for (const key of keys) {
    const raw = row[key]
    if (typeof raw === 'string' && raw) {
      const value = new Date(raw)
      if (!Number.isNaN(value.getTime())) return value
    }
  }
  return null
}
const countStatus = (rows: RecordRow[], key: string, value: string) =>
  rows.filter(row => String(row[key] ?? '').toLowerCase().replaceAll(' ', '_') === value).length
const money = (value: number) => 'PKR ' + value.toLocaleString('en-PK', { maximumFractionDigits: 0 })
const formatDate = (value: Date) => value.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

function makeSummary(module: ModuleConfig, rows: RecordRow[]): WorkspaceSummary {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const future = (row: RecordRow, fields: string[]) => {
    const date = dateValue(row, fields)
    return Boolean(date && date >= today)
  }
  const dueWithin = (row: RecordRow, fields: string[], days: number) => {
    const date = dateValue(row, fields)
    return Boolean(date && date >= today && date <= new Date(today.getTime() + days * 86400000))
  }
  const bar = (label: string, value: number, color: string): Breakdown => ({ label, value, color })
  const metric = (label: string, value: string, note: string, tone: string, icon: LucideIcon): Metric => ({ label, value, note, tone, icon })
  const count = (key: string, value: string) => countStatus(rows, key, value)

  switch (module.key) {
    case 'students': {
      const active = count('status', 'active')
      const pending = count('status', 'pending')
      const graduated = count('status', 'graduated')
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const newAdmissions = rows.filter(row => {
        const created = dateValue(row, ['created_at'])
        return created && created >= monthStart
      }).length
      const classes = [...new Set(rows.map(row => textValue(row, ['class_name'], 'Not assigned')))]
        .map(label => bar(label, rows.filter(row => textValue(row, ['class_name'], 'Not assigned') === label).length, palette.blue))
        .sort((a, b) => b.value - a.value).slice(0, 5)
      return {
        metrics: [
          metric('Total Students', String(rows.length), 'All admission records', 'blue', GraduationCap),
          metric('Active Students', String(active), 'Currently enrolled', 'green', BadgeCheck),
          metric('New Admissions', String(newAdmissions), 'Added this month', 'violet', Users),
          metric('Pending Applications', String(pending), 'Awaiting confirmation', 'amber', Clock3),
        ],
        chartTitle: 'Student status', chartNote: 'Current admission and enrolment status',
        breakdown: [bar('Active', active, palette.green), bar('Pending', pending, palette.amber), bar('Graduated', graduated, palette.violet), bar('Inactive', count('status', 'inactive'), palette.slate)],
        secondaryTitle: 'Students by class', secondaryNote: 'Largest class groups in this institution',
        secondary: classes.map(item => item.label + ' · ' + item.value + ' students'),
      }
    }
    case 'teachers': {
      const active = rows.filter(row => String(row.employment_status ?? 'active').toLowerCase() === 'active').length
      const onLeave = count('employment_status', 'on_leave')
      const inactive = count('employment_status', 'inactive')
      const departments = [...new Set(rows.map(row => textValue(row, ['department'], 'Not assigned')))]
        .map(label => bar(label, rows.filter(row => textValue(row, ['department'], 'Not assigned') === label).length, palette.green))
        .sort((a, b) => b.value - a.value).slice(0, 5)
      return {
        metrics: [
          metric('Faculty & Staff', String(rows.length), 'Employee profiles', 'blue', Users),
          metric('Active Staff', String(active), 'Currently employed', 'green', BadgeCheck),
          metric('On Leave', String(onLeave), 'Temporary leave records', 'amber', Clock3),
          metric('Departments', String(departments.length), 'Departments represented', 'violet', Building2),
        ],
        chartTitle: 'Staff by department', chartNote: 'Department distribution across staff records',
        breakdown: departments,
        secondaryTitle: 'Employment status', secondaryNote: 'Current staff status breakdown',
        secondary: [active + ' active', onLeave + ' on leave', inactive + ' inactive'],
      }
    }
    case 'fees': {
      const billed = rows.reduce((sum, row) => sum + Math.max(0, Number(row.amount ?? 0) + Number(row.fine_amount ?? 0) - Number(row.discount_amount ?? 0)), 0)
      const collected = rows.reduce((sum, row) => sum + Math.max(0, Number(row.paid_amount ?? 0)), 0)
      const outstanding = rows.reduce((sum, row) => sum + Math.max(0, Number(row.amount ?? 0) + Number(row.fine_amount ?? 0) - Number(row.discount_amount ?? 0) - Number(row.paid_amount ?? 0)), 0)
      const overdue = count('status', 'overdue')
      const paid = count('status', 'paid')
      const partial = count('status', 'partial')
      const unpaid = count('status', 'unpaid')
      return {
        metrics: [
          metric('Fees Invoices', String(rows.length), 'Issued invoices', 'blue', Wallet),
          metric('Fees Collected', money(collected), 'Payments recorded', 'green', TrendingUp),
          metric('Outstanding', money(outstanding), 'Remaining balances', 'amber', Clock3),
          metric('Overdue', String(overdue), 'Past-due invoices', 'violet', CalendarDays),
        ],
        chartTitle: 'Invoice status', chartNote: 'Payments and receivables at a glance',
        breakdown: [bar('Paid', paid, palette.green), bar('Partial', partial, palette.violet), bar('Unpaid', unpaid, palette.amber), bar('Overdue', overdue, palette.rose)],
        secondaryTitle: 'Collection progress', secondaryNote: 'Collected against net billed amount',
        secondary: [money(collected) + ' collected', money(billed) + ' total billed', money(outstanding) + ' remaining'],
      }
    }
    case 'attendance': {
      const present = count('status', 'present')
      const absent = count('status', 'absent')
      const late = count('status', 'late')
      const excused = count('status', 'excused')
      const marked = present + absent + late + excused
      const rate = marked ? Math.round(((present + late) / marked) * 100) : 0
      return {
        metrics: [
          metric('Attendance entries', String(rows.length), 'Recorded sessions', 'blue', CalendarCheck),
          metric('Present', String(present), 'Students marked present', 'green', BadgeCheck),
          metric('Absent', String(absent), 'Absence records', 'rose', Users),
          metric('Attendance rate', rate + '%', 'Present plus late', 'violet', TrendingUp),
        ],
        chartTitle: 'Attendance by status', chartNote: 'Distribution of recorded attendance entries',
        breakdown: [bar('Present', present, palette.green), bar('Absent', absent, palette.rose), bar('Late', late, palette.amber), bar('Excused', excused, palette.violet)],
        secondaryTitle: 'Recent attendance dates', secondaryNote: 'Latest dated attendance records',
        secondary: rows.slice(0, 4).map(row => textValue(row, ['attendance_date'], 'Date not set') + ' · ' + textValue(row, ['class_name'], 'Class not set') + ' · ' + textValue(row, ['status'], 'Unmarked')),
      }
    }
    case 'exams': {
      const planned = count('status', 'planned')
      const completed = count('status', 'completed')
      const published = count('status', 'published')
      const upcoming = rows.filter(row => future(row, ['exam_date'])).length
      const types = ['midterm', 'final', 'quiz', 'monthly', 'practical', 'other']
      return {
        metrics: [
          metric('Examinations', String(rows.length), 'Scheduled exam records', 'blue', ClipboardCheck),
          metric('Upcoming', String(upcoming), 'Today and future dates', 'violet', CalendarDays),
          metric('Completed', String(completed), 'Completed examinations', 'green', BadgeCheck),
          metric('Planned', String(planned), 'Awaiting completion', 'amber', Clock3),
        ],
        chartTitle: 'Examination status', chartNote: 'Planned, completed and published work',
        breakdown: [bar('Planned', planned, palette.amber), bar('Completed', completed, palette.green), bar('Published', published, palette.blue)],
        secondaryTitle: 'Next examination dates', secondaryNote: 'Nearest scheduled examinations',
        secondary: rows.filter(row => future(row, ['exam_date'])).sort((a, b) => String(a.exam_date).localeCompare(String(b.exam_date))).slice(0, 4)
          .map(row => textValue(row, ['exam_date'], 'Date not set') + ' · ' + textValue(row, ['title'], 'Examination') + ' · ' + textValue(row, ['class_name'], 'Class')),
      }
    }
    case 'exam_results': {
      const published = rows.filter(row => String(row.result_status ?? '').toLowerCase() === 'published')
      const graded = published.filter(row => Number(row.total_marks) > 0 && row.marks_obtained !== null && row.marks_obtained !== undefined)
      const average = graded.length ? graded.reduce((sum, row) => sum + Number(row.marks_obtained) / Number(row.total_marks) * 100, 0) / graded.length : 0
      const gradeRows = ['A+', 'A', 'B', 'C', 'D', 'F'].map(grade => bar(grade, count('grade', grade.toLowerCase()), palette.violet))
      return {
        metrics: [
          metric('Result records', String(rows.length), 'All accessible results', 'blue', ClipboardList),
          metric('Published', String(published.length), 'Visible to learners', 'green', BadgeCheck),
          metric('Draft', String(rows.length - published.length), 'Awaiting publication', 'amber', Clock3),
          metric('Average score', graded.length ? average.toFixed(1) + '%' : '—', 'Published graded results', 'violet', TrendingUp),
        ],
        chartTitle: 'Grade distribution', chartNote: 'Published marks grouped by grade',
        breakdown: gradeRows,
        secondaryTitle: 'Latest result records', secondaryNote: 'Student and examination references',
        secondary: rows.slice(0, 4).map(row => textValue(row, ['student_name'], 'Student') + ' · ' + textValue(row, ['exam_title'], 'Examination') + ' · ' + textValue(row, ['grade'], 'Not graded')),
      }
    }
    case 'assignments': {
      const open = count('status', 'open')
      const closed = count('status', 'closed')
      const overdue = rows.filter(row => {
        const due = dateValue(row, ['due_date'])
        return due && due < today && String(row.status ?? 'open').toLowerCase() === 'open'
      }).length
      const dueSoon = rows.filter(row => dueWithin(row, ['due_date'], 7)).length
      return {
        metrics: [
          metric('Assignments', String(rows.length), 'Coursework in this workspace', 'blue', BookOpen),
          metric('Open', String(open), 'Accepting submissions', 'green', BadgeCheck),
          metric('Due in 7 days', String(dueSoon), 'Upcoming deadlines', 'violet', CalendarDays),
          metric('Overdue', String(overdue), 'Past open deadlines', 'amber', Clock3),
        ],
        chartTitle: 'Coursework status', chartNote: 'Open and closed assignment records',
        breakdown: [bar('Open', open, palette.green), bar('Closed', closed, palette.slate), bar('Overdue', overdue, palette.amber), bar('Due in 7 days', dueSoon, palette.violet)],
        secondaryTitle: 'Upcoming assignment deadlines', secondaryNote: 'Nearest due dates',
        secondary: rows.filter(row => future(row, ['due_date'])).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))).slice(0, 4)
          .map(row => textValue(row, ['due_date'], 'Date not set') + ' · ' + textValue(row, ['title'], 'Assignment') + ' · ' + textValue(row, ['class_name'], 'Class')),
      }
    }
    case 'assignment_submissions': {
      const submitted = count('status', 'submitted')
      const late = count('status', 'late')
      const graded = count('status', 'graded')
      const returned = count('status', 'returned')
      const marks = rows.filter(row => row.marks_obtained !== null && row.marks_obtained !== undefined).map(row => Number(row.marks_obtained)).filter(Number.isFinite)
      const average = marks.length ? marks.reduce((sum, value) => sum + value, 0) / marks.length : null
      return {
        metrics: [
          metric('Submissions', String(rows.length), 'Submitted student work', 'blue', BookOpen),
          metric('Awaiting review', String(submitted + late), 'Submitted or late work', 'amber', Clock3),
          metric('Graded', String(graded), 'Reviewed submissions', 'green', BadgeCheck),
          metric('Average marks', average === null ? '—' : average.toFixed(1), 'Across graded records', 'violet', TrendingUp),
        ],
        chartTitle: 'Submission workflow', chartNote: 'Current review status',
        breakdown: [bar('Submitted', submitted, palette.blue), bar('Late', late, palette.amber), bar('Graded', graded, palette.green), bar('Returned', returned, palette.violet)],
        secondaryTitle: 'Latest submissions', secondaryNote: 'Student and assignment activity',
        secondary: rows.slice(0, 4).map(row => textValue(row, ['student_name'], 'Student') + ' · ' + textValue(row, ['assignment_title'], 'Assignment') + ' · ' + textValue(row, ['status'], 'Submitted')),
      }
    }
    case 'work_tasks': {
      const pending = count('status', 'pending')
      const progress = count('status', 'in_progress')
      const blocked = count('status', 'blocked')
      const completed = count('status', 'completed')
      const overdue = rows.filter(row => {
        const due = dateValue(row, ['due_date'])
        return due && due < today && String(row.status ?? '').toLowerCase() !== 'completed'
      }).length
      return {
        metrics: [
          metric('All tasks', String(rows.length), 'Institution work items', 'blue', ClipboardList),
          metric('In progress', String(progress), 'Currently being worked on', 'violet', Activity),
          metric('Completed', String(completed), 'Finished work', 'green', BadgeCheck),
          metric('Overdue', String(overdue), 'Past-due open tasks', 'amber', Clock3),
        ],
        chartTitle: 'Work progress', chartNote: 'Task counts by progress status',
        breakdown: [bar('Pending', pending, palette.slate), bar('In progress', progress, palette.blue), bar('Blocked', blocked, palette.rose), bar('Completed', completed, palette.green)],
        secondaryTitle: 'Task deadlines', secondaryNote: 'Nearest assigned work items',
        secondary: rows.filter(row => future(row, ['due_date'])).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))).slice(0, 4)
          .map(row => textValue(row, ['due_date'], 'Date not set') + ' · ' + textValue(row, ['title'], 'Task') + ' · ' + textValue(row, ['assigned_to_name'], 'Staff member')),
      }
    }
    case 'timetable': {
      const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      const byDay = weekdays.map(day => bar(day, rows.filter(row => String(row.weekday ?? '').toLowerCase() === day.toLowerCase()).length, palette.blue))
      const uniqueClasses = new Set(rows.map(row => String(row.class_name ?? '').trim()).filter(Boolean)).size
      const uniqueSubjects = new Set(rows.map(row => String(row.subject ?? '').trim()).filter(Boolean)).size
      const uniqueRooms = new Set(rows.map(row => String(row.room ?? '').trim()).filter(Boolean)).size
      return {
        metrics: [
          metric('Periods', String(rows.length), 'Scheduled timetable entries', 'blue', CalendarDays),
          metric('Classes', String(uniqueClasses), 'Classes with periods', 'green', Users),
          metric('Subjects', String(uniqueSubjects), 'Subjects scheduled', 'violet', BookOpen),
          metric('Rooms', String(uniqueRooms), 'Rooms in use', 'amber', ClipboardCheck),
        ],
        chartTitle: 'Weekly timetable load', chartNote: 'Scheduled periods grouped by day',
        breakdown: byDay,
        secondaryTitle: 'Scheduled periods', secondaryNote: 'First timetable entries in this workspace',
        secondary: rows.slice(0, 4).map(row => textValue(row, ['weekday'], 'Day not set') + ' · ' + textValue(row, ['start_time'], '') + '–' + textValue(row, ['end_time'], '') + ' · ' + textValue(row, ['class_name'], 'Class')),
      }
    }
    case 'announcements': {
      const audiences = [
        { label: 'Everyone', key: 'all', color: palette.blue },
        { label: 'Teachers', key: 'teachers', color: palette.green },
        { label: 'Students', key: 'students', color: palette.violet },
        { label: 'Parents', key: 'parents', color: palette.amber },
      ]
      const breakdown = audiences.map(item => bar(item.label, count('audience', item.key), item.color))
      return {
        metrics: [
          metric('Announcements', String(rows.length), 'Visible notices', 'blue', Megaphone),
          metric('Everyone', String(count('audience', 'all')), 'Institution-wide notices', 'green', Users),
          metric('Student notices', String(count('audience', 'students')), 'Targeted to students', 'violet', BookOpen),
          metric('Parent notices', String(count('audience', 'parents')), 'Targeted to guardians', 'amber', Users),
        ],
        chartTitle: 'Audience distribution', chartNote: 'Who can see published announcements',
        breakdown,
        secondaryTitle: 'Recent announcements', secondaryNote: 'Newest notices first',
        secondary: rows.slice(0, 4).map(row => textValue(row, ['title'], 'Untitled announcement') + ' · ' + textValue(row, ['audience'], 'Everyone')),
      }
    }
    default:
      return {
        metrics: [
          metric(module.title, String(rows.length), 'Records in this workspace', 'blue', Activity),
          metric('Active', String(rows.filter(row => row.is_active !== false && String(row.status ?? 'active').toLowerCase() === 'active').length), 'Active records', 'green', BadgeCheck),
          metric('Recently added', String(rows.filter(row => {
            const created = dateValue(row, ['created_at'])
            return created && created >= new Date(now.getTime() - 30 * 86400000)
          }).length), 'Last 30 days', 'violet', CalendarDays),
          metric('Status groups', String(new Set(rows.map(row => String(row.status ?? 'active'))).size), 'Distinct states', 'amber', ClipboardList),
        ],
        chartTitle: 'Record status', chartNote: 'Current record distribution',
        breakdown: [...new Set(rows.map(row => String(row.status ?? 'active')))].slice(0, 5).map((status, index) =>
          bar(status.replaceAll('_', ' '), count('status', status.toLowerCase()), [palette.blue, palette.green, palette.violet, palette.amber, palette.rose][index]),
        ),
        secondaryTitle: 'Latest records', secondaryNote: 'Most recently created items',
        secondary: rows.slice(0, 4).map(row => textValue(row, ['name', 'title', 'full_name'], 'Untitled record') + ' · ' + textValue(row, ['code', 'status'], '')),
      }
  }
}

function MetricCard({ item, loading }: { item: Metric; loading: boolean }) {
  const Icon = item.icon
  return <div className={'ed360-workspace-metric ' + item.tone}>
    <span><Icon size={19}/></span>
    <small>{item.label}</small>
    <strong>{loading ? '—' : item.value}</strong>
    <em>{item.note}</em>
  </div>
}

export function ModuleInsights({ module, rows, loading }: Props) {
  const summary = useMemo(() => makeSummary(module, rows), [module, rows])
  const maximum = Math.max(1, ...summary.breakdown.map(item => item.value))
  const total = summary.breakdown.reduce((sum, item) => sum + item.value, 0)
  let offset = 0
  const segments = summary.breakdown.map(item => {
    const start = offset
    const share = total ? item.value / total * 100 : 0
    offset += share
    return item.color + ' ' + start + '% ' + offset + '%'
  })
  const donut = total ? 'conic-gradient(' + segments.join(',') + ')' : 'conic-gradient(#e8eef6 0 100%)'

  return <section className="ed360-module-insights">
    <header className="ed360-module-insights-heading">
      <div><span>WORKSPACE OVERVIEW</span><h2>{module.title} summary</h2><p>{module.description}</p></div>
      <small>{loading ? 'Updating records…' : rows.length + ' records available'}</small>
    </header>
    <div className="ed360-workspace-metrics">{summary.metrics.map(item => <MetricCard key={item.label} item={item} loading={loading}/>)}</div>
    <div className="ed360-workspace-insight-grid">
      <section className="ed360-workspace-chart-card">
        <div><h3>{summary.chartTitle}</h3><p>{summary.chartNote}</p></div>
        <div className="ed360-workspace-bar-list">
          {summary.breakdown.map(item => <div className="ed360-workspace-bar-row" key={item.label}>
            <div><span>{item.label}</span><b>{loading ? '—' : item.value.toLocaleString()}</b></div>
            <span className="ed360-workspace-bar-track"><i style={{ width: (item.value / maximum * 100) + '%', background: item.color }}/></span>
          </div>)}
          {!loading && summary.breakdown.length === 0 && <p className="ed360-workspace-empty">No records are available for this chart yet.</p>}
        </div>
      </section>
      <section className="ed360-workspace-chart-card ed360-workspace-distribution-card">
        <div><h3>{summary.secondaryTitle}</h3><p>{summary.secondaryNote}</p></div>
        <div className="ed360-workspace-distribution">
          <div className="ed360-workspace-donut" style={{ background: donut }}><div><b>{loading ? '—' : total.toLocaleString()}</b><small>items</small></div></div>
          <div className="ed360-workspace-secondary-list">
            {summary.secondary.map((item, index) => <div key={index}><i style={{ background: [palette.blue, palette.green, palette.violet, palette.amber][index % 4] }}/><span>{item}</span></div>)}
            {!loading && summary.secondary.length === 0 && <p className="ed360-workspace-empty">Nothing scheduled or recorded yet.</p>}
          </div>
        </div>
      </section>
    </div>
  </section>
}
