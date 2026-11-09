import { useEffect, useState } from 'react'
import { BarChart3, CalendarCheck, ClipboardCheck, Download, Users, Wallet } from 'lucide-react'
import '../styles/reports.css'
import '../styles/module-workspaces.css'
import { useAuth } from '../context/AuthContext'
import { listRecords } from '../lib/data'
import { userFacingError } from '../lib/userErrors'
import { netInvoiceAmount, outstandingInvoiceBalance } from '../lib/finance'
import { downloadCsv } from '../lib/csv'
import type { CsvColumn } from '../lib/csv'
import type { RecordRow } from '../lib/types'

type Loaded = { rows: RecordRow[]; error: string }
const empty: Loaded = { rows: [], error: '' }

const money = (value: number) => `PKR ${value.toLocaleString('en-PK', { maximumFractionDigits: 2 })}`
const percent = (part: number, total: number) => (total > 0 ? `${((part / total) * 100).toFixed(1)}%` : '—')
const countBy = (rows: RecordRow[], key: string) => {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const label = String(row[key] ?? '').trim() || 'Not set'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}
const today = () => new Date().toISOString().slice(0, 10)

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="report-stat"><small>{label}</small><b>{value}</b></div>
}

function Section({ title, note, onExport, children }: { title: string; note: string; onExport?: () => void; children: React.ReactNode }) {
  return <section className="report-section"><header><div><h2>{title}</h2><p>{note}</p></div>{onExport && <button type="button" className="button button-outline" onClick={onExport}><Download size={15}/> Export CSV</button>}</header>{children}</section>
}

function SimpleTable({ columns, rows }: { columns: CsvColumn[]; rows: Record<string, unknown>[] }) {
  if (!rows.length) return <div className="report-empty">No records to show.</div>
  return <div className="table-scroll"><table><thead><tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.slice(0, 200).map((row, index) => <tr key={String(row.id ?? index)}>{columns.map(column => <td key={column.key}>{String(row[column.key] ?? '')}</td>)}</tr>)}</tbody></table></div>
}

export function ReportsModule({ onToast, initialWindow }: { onToast: (message: string, error?: boolean) => void; initialWindow?: string }) {
  const { user, mode } = useAuth()
  const role = user!.role
  const [reportTab,setReportTab] = useState<'overview'|'finance'|'attendance'|'academics'|'students'>(() => (['overview','finance','attendance','academics','students'].includes(initialWindow ?? '') ? initialWindow as 'overview'|'finance'|'attendance'|'academics'|'students' : 'overview'))
  const wantsFees = ['owner', 'admin', 'accountant'].includes(role)
  const wantsPeople = ['owner', 'admin'].includes(role)
  const wantsResults = ['owner', 'admin', 'exam_officer'].includes(role)
  const [loading, setLoading] = useState(true)
  const [fees, setFees] = useState<Loaded>(empty)
  const [students, setStudents] = useState<Loaded>(empty)
  const [attendance, setAttendance] = useState<Loaded>(empty)
  const [results, setResults] = useState<Loaded>(empty)

  useEffect(() => {
    let alive = true
    async function load(table: string, enabled: boolean, set: (value: Loaded) => void) {
      if (!enabled) return
      try { const rows = await listRecords(mode, user!, table); if (alive) set({ rows, error: '' }) }
      catch (error) { if (alive) set({ rows: [], error: userFacingError(error, `Unable to load ${table.replace('_', ' ')}.`) }) }
    }
    void Promise.all([
      load('fee_invoices', wantsFees, setFees), load('students', wantsPeople, setStudents),
      load('attendance', wantsPeople, setAttendance), load('exam_results', wantsResults, setResults),
    ]).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [mode, user, wantsFees, wantsPeople, wantsResults])

  function exportRows(name: string, rows: RecordRow[], columns: CsvColumn[]) {
    if (!rows.length) { onToast('There are no records to export.', true); return }
    downloadCsv(`edusphere360-${name}-${today()}.csv`, rows, columns)
  }

  if (loading) return <div className="report-empty">Loading reports…</div>

  const invoiced = fees.rows.reduce((sum, row) => sum + netInvoiceAmount(row), 0)
  const received = fees.rows.reduce((sum, row) => sum + Number(row.paid_amount ?? 0), 0)
  const outstanding = fees.rows.reduce((sum, row) => sum + outstandingInvoiceBalance(row), 0)
  const outstandingRows = fees.rows.filter(row => outstandingInvoiceBalance(row) > 0).map(row => ({ ...row, balance: outstandingInvoiceBalance(row) }))
  const feeColumns: CsvColumn[] = [
    { key: 'invoice_no', label: 'Invoice #' }, { key: 'student_name', label: 'Student' }, { key: 'fee_title', label: 'Description' },
    { key: 'due_date', label: 'Due date' }, { key: 'balance', label: 'Outstanding (PKR)' },
  ]

  const attended = attendance.rows.filter(row => row.status === 'present' || row.status === 'late').length
  const attendanceColumns: CsvColumn[] = [
    { key: 'student_name', label: 'Student' }, { key: 'class_name', label: 'Class' }, { key: 'attendance_date', label: 'Date' },
    { key: 'status', label: 'Status' }, { key: 'notes', label: 'Notes' },
  ]

  const published = results.rows.filter(row => row.result_status === 'published')
  const scored = published.filter(row => Number(row.total_marks) > 0 && row.marks_obtained !== null && row.marks_obtained !== undefined)
  const averagePercent = scored.length ? scored.reduce((sum, row) => sum + (Number(row.marks_obtained) / Number(row.total_marks)) * 100, 0) / scored.length : null
  const resultColumns: CsvColumn[] = [
    { key: 'student_name', label: 'Student' }, { key: 'exam_title', label: 'Examination' }, { key: 'subject', label: 'Subject' },
    { key: 'marks_obtained', label: 'Marks' }, { key: 'total_marks', label: 'Out of' }, { key: 'grade', label: 'Grade' }, { key: 'result_status', label: 'Publication' },
  ]
  const studentColumns: CsvColumn[] = [
    { key: 'admission_no', label: 'Admission ID' }, { key: 'full_name', label: 'Student' }, { key: 'class_name', label: 'Class / program' },
    { key: 'guardian_name', label: 'Guardian' }, { key: 'status', label: 'Status' },
  ]

  const reportMetrics = [
    ...(wantsPeople ? [
      { label: 'Students', value: String(students.rows.length), note: 'Visible enrolment records', icon: Users, tone: 'blue' },
      { label: 'Attendance rate', value: percent(attended, attendance.rows.length), note: 'Present plus late', icon: CalendarCheck, tone: 'green' },
    ] : []),
    ...(wantsFees ? [
      { label: 'Fees collected', value: money(received), note: 'Payments recorded', icon: Wallet, tone: 'green' },
      { label: 'Outstanding fees', value: money(outstanding), note: 'Remaining receivables', icon: Wallet, tone: 'amber' },
    ] : []),
    ...(wantsResults ? [
      { label: 'Published results', value: String(published.length), note: 'Available exam results', icon: ClipboardCheck, tone: 'violet' },
      { label: 'Average result', value: averagePercent === null ? '—' : averagePercent.toFixed(1) + '%', note: 'Published graded results', icon: BarChart3, tone: 'blue' },
    ] : []),
  ]
  const attendanceBreakdown = countBy(attendance.rows, 'status')
  const gradeBreakdown = countBy(published, 'grade')
  const reportBars = (items: [string, number][], color: string) => {
    const maximum = Math.max(1, ...items.map(item => item[1]))
    return items.map(([label, value]) => ({ label, value, width: value / maximum * 100, color }))
  }

  const reportWindows = [
    {key:'overview',label:'Analytics Overview',visible:true},
    {key:'finance',label:'Finance & Collections',visible:wantsFees},
    {key:'attendance',label:'Attendance Analysis',visible:wantsPeople},
    {key:'academics',label:'Examination Results',visible:wantsResults},
    {key:'students',label:'Enrolment Reports',visible:wantsPeople},
  ].filter(item=>item.visible)

  return <div className="report-stage page-content ed360-module-page">
    <header className="ed360-module-insights-heading">
      <div><span>INSTITUTION ANALYTICS</span><h2>Reports overview</h2><p>Live report totals from the records your role is permitted to view.</p></div>
      <small>Live institutional records</small>
    </header>
    <nav className="ed360-operations-window-nav" aria-label="Reports workspace windows">{reportWindows.map(item=><button type="button" key={item.key} className={reportTab===item.key?'active':''} aria-current={reportTab===item.key?'page':undefined} onClick={()=>setReportTab(item.key as typeof reportTab)}>{item.label}</button>)}</nav>
    <section className="ed360-operations-context-window"><div><span>REPORTS / ANALYTICS WORKSPACE</span><h2>{reportWindows.find(item=>item.key===reportTab)?.label??'Analytics Overview'}</h2><p>{reportTab==='overview'?'Institution-wide indicators from the live records your role can access.':reportTab==='finance'?'Collections, receivables and invoice balances from Finance & Payments.':reportTab==='attendance'?'Attendance patterns and status distribution across available registers.':reportTab==='academics'?'Published examination performance and result publication statistics.':'Student enrolment totals and class distribution.'}</p></div><div><strong>{reportMetrics.length}</strong><small>available report indicators</small></div></section>
    <div className="ed360-workspace-metrics" hidden={reportTab!=='overview'}>{reportMetrics.map(item => {
      const Icon = item.icon
      return <div className={'ed360-workspace-metric ' + item.tone} key={item.label}><span><Icon size={19}/></span><small>{item.label}</small><strong>{item.value}</strong><em>{item.note}</em></div>
    })}</div>
    <div className="ed360-workspace-insight-grid" hidden={reportTab!=='overview'}>
      {wantsPeople && <section className="ed360-workspace-chart-card"><div><h3>Attendance distribution</h3><p>Present, late, absent and excused records.</p></div><div className="ed360-workspace-bar-list">{reportBars(attendanceBreakdown.map(([label, value]) => [label.replaceAll('_',' '), value] as [string,number]), '#16a36b').map(item=><div className="ed360-workspace-bar-row" key={item.label}><div><span>{item.label}</span><b>{item.value}</b></div><span className="ed360-workspace-bar-track"><i style={{width:item.width+'%',background:item.color}}/></span></div>)}{attendanceBreakdown.length===0&&<p className="ed360-workspace-empty">No attendance records available.</p>}</div></section>}
      {wantsResults && <section className="ed360-workspace-chart-card"><div><h3>Published grade distribution</h3><p>Grades from published exam results.</p></div><div className="ed360-workspace-bar-list">{reportBars(gradeBreakdown, '#8b62e8').map(item=><div className="ed360-workspace-bar-row" key={item.label}><div><span>{item.label}</span><b>{item.value}</b></div><span className="ed360-workspace-bar-track"><i style={{width:item.width+'%',background:item.color}}/></span></div>)}{gradeBreakdown.length===0&&<p className="ed360-workspace-empty">No published grades available.</p>}</div></section>}
      {wantsFees && <section className="ed360-workspace-chart-card"><div><h3>Fee collection progress</h3><p>Collected and outstanding against invoiced amounts.</p></div><div className="ed360-workspace-bar-list">{reportBars([['Collected',received],['Outstanding',outstanding]], '#2877ee').map(item=><div className="ed360-workspace-bar-row" key={item.label}><div><span>{item.label}</span><b>{money(item.value)}</b></div><span className="ed360-workspace-bar-track"><i style={{width:item.width+'%',background:item.label==='Collected'?'#16a36b':'#ef9226'}}/></span></div>)}</div></section>}
    </div>
    {wantsFees && reportTab==='finance' && <Section title="Fee collection" note="Invoiced, received and outstanding amounts across all invoices you can access." onExport={() => exportRows('outstanding-fees', outstandingRows, feeColumns)}>
      {fees.error ? <div className="report-error" role="alert">{fees.error}</div> : <>
        <div className="report-stats"><Stat label="Invoices" value={String(fees.rows.length)}/><Stat label="Total invoiced" value={money(invoiced)}/><Stat label="Received" value={money(received)}/><Stat label="Outstanding" value={money(outstanding)}/></div>
        <SimpleTable columns={feeColumns} rows={outstandingRows}/>
      </>}
    </Section>}
    {wantsPeople && reportTab==='attendance' && <Section title="Attendance" note="Share of attendance records by status. Attended = present plus late." onExport={() => exportRows('attendance', attendance.rows, attendanceColumns)}>
      {attendance.error ? <div className="report-error" role="alert">{attendance.error}</div> : attendance.rows.length === 0 ? <div className="report-empty">No attendance has been recorded yet.</div> : <>
        <div className="report-stats"><Stat label="Records" value={String(attendance.rows.length)}/><Stat label="Attended" value={percent(attended, attendance.rows.length)}/>
          {countBy(attendance.rows, 'status').map(([status, count]) => <Stat key={status} label={status} value={`${count} · ${percent(count, attendance.rows.length)}`}/>)}</div>
      </>}
    </Section>}
    {wantsResults && reportTab==='academics' && <Section title="Examination results" note="Only published results count towards the average." onExport={() => exportRows('exam-results', results.rows, resultColumns)}>
      {results.error ? <div className="report-error" role="alert">{results.error}</div> : results.rows.length === 0 ? <div className="report-empty">No results have been entered yet.</div> : <>
        <div className="report-stats"><Stat label="Results entered" value={String(results.rows.length)}/><Stat label="Published" value={String(published.length)}/><Stat label="Draft" value={String(results.rows.length - published.length)}/><Stat label="Average (published)" value={averagePercent === null ? '—' : `${averagePercent.toFixed(1)}%`}/></div>
        <SimpleTable columns={[{ key: 'grade', label: 'Grade' }, { key: 'count', label: 'Results' }]} rows={countBy(published, 'grade').map(([grade, count]) => ({ id: grade, grade, count }))}/>
      </>}
    </Section>}
    {wantsPeople && reportTab==='students' && <Section title="Students" note="Enrolment by class and status." onExport={() => exportRows('students', students.rows, studentColumns)}>
      {students.error ? <div className="report-error" role="alert">{students.error}</div> : students.rows.length === 0 ? <div className="report-empty">No students have been added yet.</div> : <>
        <div className="report-stats"><Stat label="Total students" value={String(students.rows.length)}/>{countBy(students.rows, 'status').map(([status, count]) => <Stat key={status} label={status} value={String(count)}/>)}</div>
        <SimpleTable columns={[{ key: 'class_name', label: 'Class / program' }, { key: 'count', label: 'Students' }]} rows={countBy(students.rows, 'class_name').map(([name, count]) => ({ id: name, class_name: name, count }))}/>
      </>}
    </Section>}
  </div>
}
