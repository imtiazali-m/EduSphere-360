import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarCheck, ClipboardCheck, Download, Users, Wallet } from 'lucide-react'
import '../styles/reports.css'
import '../styles/module-workspaces.css'
import { useAuth } from '../context/AuthContext'
import { listRecords } from '../lib/data'
import { supabase } from '../lib/supabase'
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
  const [sortKey,setSortKey] = useState(columns[0]?.key ?? '')
  const [sortDirection,setSortDirection] = useState<'asc'|'desc'>('asc')
  const [page,setPage] = useState(1)
  const pageSize = 10
  const orderedRows = useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a,b) => {
      const left=a[sortKey],right=b[sortKey]
      const leftEmpty=left===null||left===undefined||left===''
      const rightEmpty=right===null||right===undefined||right===''
      if(leftEmpty||rightEmpty)return leftEmpty===rightEmpty?0:leftEmpty?1:-1
      const leftNumber=Number(left),rightNumber=Number(right)
      const numeric=String(left).trim()!==''&&String(right).trim()!==''&&Number.isFinite(leftNumber)&&Number.isFinite(rightNumber)
      const comparison=numeric?leftNumber-rightNumber:String(left).localeCompare(String(right),undefined,{numeric:true,sensitivity:'base'})
      return sortDirection==='asc'?comparison:-comparison
    })
  },[rows,sortKey,sortDirection])
  const pageCount=Math.max(1,Math.ceil(orderedRows.length/pageSize))
  const currentPage=Math.min(page,pageCount)
  const pageRows=orderedRows.slice((currentPage-1)*pageSize,currentPage*pageSize)
  function toggleSort(key:string){
    if(sortKey===key)setSortDirection(value=>value==='asc'?'desc':'asc')
    else{setSortKey(key);setSortDirection('asc')}
    setPage(1)
  }
  if (!rows.length) return <div className="report-empty">No records to show.</div>
  return <>
    <div className="table-scroll"><table><thead><tr>{columns.map(column=><th key={column.key} aria-sort={sortKey===column.key?(sortDirection==='asc'?'ascending':'descending'):'none'}><button type="button" className="report-sort-header" onClick={()=>toggleSort(column.key)}>{column.label}<span aria-hidden="true">{sortKey===column.key?(sortDirection==='asc'?'↑':'↓'):'↕'}</span></button></th>)}</tr></thead>
      <tbody>{pageRows.map((row,index)=><tr key={String(row.id??index)}>{columns.map(column=><td key={column.key}>{String(row[column.key]??'')}</td>)}</tr>)}</tbody>
    </table></div>
    {orderedRows.length>pageSize&&<div className="report-table-pagination"><span>Showing <b>{(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize,orderedRows.length)}</b> of <b>{orderedRows.length}</b> rows</span><div><button type="button" className="button button-outline" disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}>Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" className="button button-outline" disabled={currentPage>=pageCount} onClick={()=>setPage(currentPage+1)}>Next</button></div></div>}
  </>
}

export function ReportsModule({ onToast, initialWindow }: { onToast: (message: string, error?: boolean) => void; initialWindow?: string }) {
  const { user, mode } = useAuth()
  const role = user!.role
  const reportTabs = ['overview','finance','attendance','academics','students','employees','payroll'] as const
  type ReportTab = typeof reportTabs[number]
  const [reportTab,setReportTab] = useState<ReportTab>(() => (reportTabs.includes(initialWindow as ReportTab) ? initialWindow as ReportTab : 'overview'))
  const wantsFees = ['owner', 'admin', 'accountant'].includes(role)
  const wantsPeople = ['owner', 'admin', 'teacher'].includes(role)
  const wantsEmployees = ['owner', 'admin'].includes(role)
  const wantsPayroll = ['owner', 'admin', 'accountant'].includes(role)
  const wantsResults = ['owner', 'admin', 'teacher', 'exam_officer'].includes(role)
  const [loading, setLoading] = useState(true)
  const [fees, setFees] = useState<Loaded>(empty)
  const [students, setStudents] = useState<Loaded>(empty)
  const [attendance, setAttendance] = useState<Loaded>(empty)
  const [results, setResults] = useState<Loaded>(empty)
  const [employees, setEmployees] = useState<Loaded>(empty)
  const [payroll, setPayroll] = useState<Loaded>(empty)

  useEffect(() => {
    let alive = true
    async function load(table: string, enabled: boolean, set: (value: Loaded) => void) {
      if (!enabled) return
      try { const rows = await listRecords(mode, user!, table); if (alive) set({ rows, error: '' }) }
      catch (error) { if (alive) set({ rows: [], error: userFacingError(error, `Unable to load ${table.replace('_', ' ')}.`) }) }
    }
    async function loadPayroll() {
      if (!wantsPayroll) return
      try {
        if (!supabase) throw new Error('The cloud database is not configured.')
        const [runResult, itemResult] = await Promise.all([
          supabase.from('payroll_runs').select('*').eq('institution_id', user!.institutionId).order('period_start', { ascending: false }).limit(250),
          supabase.from('payroll_items').select('*').eq('institution_id', user!.institutionId).order('created_at', { ascending: false }).limit(2000),
        ])
        if (runResult.error) throw runResult.error
        if (itemResult.error) throw itemResult.error
        const runMap = new Map((runResult.data ?? []).map(run => [String(run.id), run]))
        const employeeMap = new Map<string, RecordRow>()
        if (wantsEmployees) {
          try {
            const rows = await listRecords(mode, user!, 'teachers')
            rows.forEach(row => employeeMap.set(row.id, row))
          } catch {
            // Employee identities remain hidden when the current role cannot read the staff directory.
          }
        }
        const rows = (itemResult.data ?? []).map(item => {
          const employee = employeeMap.get(String(item.teacher_id))
          const run = runMap.get(String(item.payroll_run_id))
          return {
            ...item,
            employee_name: employee ? String(employee.full_name ?? 'Employee') : 'Restricted employee record',
            employee_no: employee ? String(employee.employee_no ?? '') : '',
            period_start: run?.period_start ?? '',
            period_end: run?.period_end ?? '',
            run_status: run?.status ?? 'unknown',
          } as RecordRow
        })
        if (alive) setPayroll({ rows, error: '' })
      } catch (error) {
        if (alive) setPayroll({ rows: [], error: userFacingError(error, 'Payroll report data could not be loaded.') })
      }
    }
    void Promise.all([
      load('fee_invoices', wantsFees, setFees), load('students', wantsPeople, setStudents),
      load('attendance', wantsPeople, setAttendance), load('exam_results', wantsResults, setResults),
      load('teachers', wantsEmployees, setEmployees), loadPayroll(),
    ]).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [mode, user, wantsFees, wantsPeople, wantsEmployees, wantsPayroll, wantsResults])

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

  const employeeColumns: CsvColumn[] = [
    { key: 'employee_no', label: 'Employee ID' }, { key: 'full_name', label: 'Employee' },
    { key: 'department', label: 'Department' }, { key: 'employment_type', label: 'Employment type' },
    { key: 'employment_status', label: 'Status' }, { key: 'joining_date', label: 'Joining date' },
  ]
  const payrollColumns: CsvColumn[] = [
    { key: 'employee_no', label: 'Employee ID' }, { key: 'employee_name', label: 'Employee' },
    { key: 'period_start', label: 'Period start' }, { key: 'period_end', label: 'Period end' },
    { key: 'base_salary', label: 'Base salary (PKR)' }, { key: 'gross_pay', label: 'Gross pay (PKR)' },
    { key: 'net_pay', label: 'Net pay (PKR)' }, { key: 'payment_status', label: 'Payment status' },
  ]
  const payrollTotal = payroll.rows.reduce((sum, row) => sum + Number(row.net_pay ?? 0), 0)
  const payrollPaid = payroll.rows.filter(row => row.payment_status === 'paid').reduce((sum, row) => sum + Number(row.net_pay ?? 0), 0)

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
    ...(wantsEmployees ? [
      { label: 'Employees', value: String(employees.rows.length), note: 'Visible HR records', icon: Users, tone: 'blue' },
      { label: 'Active employees', value: String(employees.rows.filter(row => row.employment_status === 'active').length), note: 'Current workforce', icon: Users, tone: 'green' },
    ] : []),
    ...(wantsPayroll ? [
      { label: 'Net payroll', value: money(payrollTotal), note: 'Generated payroll item snapshots', icon: Wallet, tone: 'violet' },
      { label: 'Paid payroll', value: money(payrollPaid), note: 'Items marked paid', icon: Wallet, tone: 'green' },
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
    {key:'employees',label:'Employee Reports',visible:wantsEmployees},
    {key:'payroll',label:'Payroll Reports',visible:wantsPayroll},
  ].filter(item=>item.visible)

  return <div className="report-stage page-content ed360-module-page">
    <header className="ed360-module-insights-heading">
      <div><span>INSTITUTION ANALYTICS</span><h2>Reports overview</h2><p>Live report totals from the records your role is permitted to view.</p></div>
      <small>Live institutional records</small>
    </header>
    <nav className="ed360-operations-window-nav" aria-label="Reports workspace windows">{reportWindows.map(item=><button type="button" key={item.key} className={reportTab===item.key?'active':''} aria-current={reportTab===item.key?'page':undefined} onClick={()=>setReportTab(item.key as typeof reportTab)}>{item.label}</button>)}</nav>
    <section className="ed360-operations-context-window"><div><span>REPORTS / ANALYTICS WORKSPACE</span><h2>{reportWindows.find(item=>item.key===reportTab)?.label??'Analytics Overview'}</h2><p>{reportTab==='overview'?'Institution-wide indicators from the live records your role can access.':reportTab==='finance'?'Collections, receivables and invoice balances from Finance & Payments.':reportTab==='attendance'?'Attendance patterns and status distribution across available registers.':reportTab==='academics'?'Published examination performance and result publication statistics.':reportTab==='students'?'Student enrolment totals and class distribution.':reportTab==='employees'?'Employee headcount, department allocation and employment status from HR records.':'Payroll snapshots, net pay and payment status from approved payroll runs.'}</p></div><div><strong>{reportMetrics.length}</strong><small>available report indicators</small></div></section>
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
    {wantsEmployees && reportTab==='employees' && <Section title="Employee directory and workforce" note="HR records currently visible to the owner and administration roles." onExport={() => exportRows('employees', employees.rows, employeeColumns)}>
      {employees.error ? <div className="report-error" role="alert">{employees.error}</div> : employees.rows.length === 0 ? <div className="report-empty">No employee records are available yet.</div> : <>
        <div className="report-stats">
          <Stat label="Total employees" value={String(employees.rows.length)}/>
          <Stat label="Active" value={String(employees.rows.filter(row => row.employment_status === 'active').length)}/>
          <Stat label="On leave" value={String(employees.rows.filter(row => row.employment_status === 'on_leave').length)}/>
          <Stat label="Departments" value={String(new Set(employees.rows.map(row => String(row.department ?? '').trim()).filter(Boolean)).size)}/>
        </div>
        <SimpleTable columns={employeeColumns} rows={employees.rows}/>
      </>}
    </Section>}
    {wantsPayroll && reportTab==='payroll' && <Section title="Payroll and salary payments" note="Payroll is shown from generated payroll snapshots; this report does not create or approve salary payments." onExport={() => exportRows('payroll', payroll.rows, payrollColumns)}>
      {payroll.error ? <div className="report-error" role="alert">{payroll.error}</div> : payroll.rows.length === 0 ? <div className="report-empty">No payroll runs have been generated yet.</div> : <>
        <div className="report-stats">
          <Stat label="Payroll entries" value={String(payroll.rows.length)}/>
          <Stat label="Net payroll" value={money(payrollTotal)}/>
          <Stat label="Paid" value={money(payrollPaid)}/>
          <Stat label="Remaining" value={money(Math.max(0, payrollTotal - payrollPaid))}/>
        </div>
        <SimpleTable columns={payrollColumns} rows={payroll.rows}/>
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
