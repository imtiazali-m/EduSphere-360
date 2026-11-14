import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarDays, Download, FileSpreadsheet, FileText, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import '../styles/reports-analytics-workspace.css'
import { useAuth } from '../context/AuthContext'
import { listRecords } from '../lib/data'
import { userFacingError } from '../lib/userErrors'
import type { RecordRow } from '../lib/types'

type DatasetKey = 'students'|'teachers'|'attendance'|'exam_results'|'fee_invoices'|'payroll'
type ExportFormat = 'csv'|'tsv'|'json'|'xls'|'pdf'
type ReportRow = Record<string, unknown> & { id?: string }

const PAGE_META: Record<string,{title:string;description:string;dataset:DatasetKey}> = {
 overview:{title:'Reports & Analytics',description:'Institution-wide reporting based on the records your account is authorised to access.',dataset:'students'},
 students:{title:'Student Reports',description:'Enrolment, class distribution, student status and date-scoped student records.',dataset:'students'},
 employees:{title:'Employee Reports',description:'Employee register, department allocation, employment status and joining-date reports.',dataset:'teachers'},
 attendance:{title:'Attendance Reports',description:'Date-wise attendance, class and section coverage, attendance status and trends.',dataset:'attendance'},
 academics:{title:'Examination Reports',description:'Published examination results, marks, grades, class and section performance.',dataset:'exam_results'},
 examinations:{title:'Examination Reports',description:'Build a formal examination report for an individual, class, section, subject or the whole college.',dataset:'exam_results'},
 academic:{title:'Academic Reports',description:'Academic performance, subject outcomes and published result summaries.',dataset:'exam_results'},
 fees:{title:'Fee Collection Reports',description:'Invoiced amounts, received payments and outstanding fee balances.',dataset:'fee_invoices'},
 payroll:{title:'Payroll Reports',description:'Payroll item summaries and payment status from generated payroll records.',dataset:'payroll'},
 financial:{title:'Financial Reports',description:'A separate financial view of fee receivables, payroll and recorded institutional financial totals.',dataset:'fee_invoices'},
 class:{title:'Class Reports',description:'Class-wise enrolment, attendance and examination performance.',dataset:'students'},
 comparative:{title:'Comparative Analytics',description:'Compare available student, attendance, examination and fee indicators across the selected period.',dataset:'students'},
 builder:{title:'Custom Report Builder',description:'Choose a source, fields and filters to prepare a reusable report extract.',dataset:'students'},
 scheduled:{title:'Scheduled Reports',description:'Review report scheduling capability and configure a schedule when the server-side scheduler is enabled.',dataset:'students'},
 templates:{title:'Report Templates',description:'Choose a structured report layout and export it in the required document format.',dataset:'students'},
 history:{title:'Report History',description:'Exports created during this browser session. Persistent cross-device history requires a server-side report-jobs service.',dataset:'students'},
}
const COLUMNS: Record<DatasetKey,{key:string;label:string}[]> = {
 students:[{key:'admission_no',label:'Admission No.'},{key:'full_name',label:'Student'},{key:'class_name',label:'Class'},{key:'section_name',label:'Section'},{key:'guardian_name',label:'Guardian'},{key:'status',label:'Status'},{key:'admission_date',label:'Admission Date'}],
 teachers:[{key:'employee_no',label:'Employee ID'},{key:'full_name',label:'Employee'},{key:'department',label:'Department'},{key:'designation',label:'Designation'},{key:'employment_type',label:'Employment Type'},{key:'employment_status',label:'Status'},{key:'joining_date',label:'Joining Date'}],
 attendance:[{key:'student_name',label:'Student'},{key:'class_name',label:'Class'},{key:'section_name',label:'Section'},{key:'attendance_date',label:'Date'},{key:'status',label:'Status'},{key:'notes',label:'Notes'}],
 exam_results:[{key:'student_name',label:'Student'},{key:'class_name',label:'Class'},{key:'section_name',label:'Section'},{key:'exam_title',label:'Examination'},{key:'subject',label:'Subject'},{key:'marks_obtained',label:'Marks'},{key:'total_marks',label:'Total'},{key:'grade',label:'Grade'},{key:'result_status',label:'Publication'}],
 fee_invoices:[{key:'invoice_no',label:'Invoice No.'},{key:'student_name',label:'Student'},{key:'class_name',label:'Class'},{key:'fee_title',label:'Fee Head'},{key:'total_amount',label:'Invoiced (PKR)'},{key:'paid_amount',label:'Received (PKR)'},{key:'due_date',label:'Due Date'},{key:'status',label:'Status'}],
 payroll:[{key:'employee_name',label:'Employee'},{key:'employee_no',label:'Employee ID'},{key:'period_start',label:'Period Start'},{key:'period_end',label:'Period End'},{key:'gross_pay',label:'Gross Pay'},{key:'net_pay',label:'Net Pay'},{key:'payment_status',label:'Payment Status'}],
}
const today = () => new Date().toISOString().slice(0,10)
const money = (n:number) => 'PKR ' + n.toLocaleString('en-PK',{maximumFractionDigits:2})
const dateValue = (row:ReportRow) => String(row.attendance_date??row.admission_date??row.joining_date??row.created_at??row.due_date??'').slice(0,10)
function saveBlob(name:string,content:string,type:string){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
function exportData(name:string,rows:ReportRow[],columns:{key:string;label:string}[],format:ExportFormat){
 const safe=name.toLowerCase().replace(/[^a-z0-9]+/g,'-')
 const stamp=today()
 if(format==='pdf'){window.print();return}
 if(format==='json'){saveBlob(safe+'-'+stamp+'.json',JSON.stringify(rows,null,2),'application/json');return}
 const values=[columns.map(c=>c.label),...rows.map(row=>columns.map(c=>String(row[c.key]??'')))]
 const delimiter=format==='tsv'||format==='xls'?'\\t':','
 const quote=(v:string)=>format==='xls'?v:'"'+v.replace(/"/g,'""')+'"'
 const body=values.map(line=>line.map(v=>quote(v)).join(delimiter)).join('\\n')
 if(format==='xls')saveBlob(safe+'-'+stamp+'.xls','\\ufeff'+body,'application/vnd.ms-excel;charset=utf-8')
 else saveBlob(safe+'-'+stamp+'.'+format,'\\ufeff'+body,format==='tsv'?'text/tab-separated-values;charset=utf-8':'text/csv;charset=utf-8')
}
function Stat({label,value}:{label:string;value:string}){return <article className="ra-stat"><small>{label}</small><strong>{value}</strong></article>}

export function ReportsAnalyticsWorkspace({initialWindow='overview',onToast}:{initialWindow?:string;onToast:(message:string,error?:boolean)=>void}){
 const {user,mode}=useAuth()
 const pageKey=initialWindow.split(':').pop()||'overview'
 const meta=PAGE_META[pageKey]??PAGE_META.overview
 const [data,setData]=useState<Record<DatasetKey,ReportRow[]>>({students:[],teachers:[],attendance:[],exam_results:[],fee_invoices:[],payroll:[]})
 const [errors,setErrors]=useState<string[]>([])
 const [loading,setLoading]=useState(true)
 const [refresh,setRefresh]=useState(0)
 const [from,setFrom]=useState('')
 const [to,setTo]=useState(today())
 const [className,setClassName]=useState('all')
 const [section,setSection]=useState('all')
 const [query,setQuery]=useState('')
 const [exportFormat,setExportFormat]=useState<ExportFormat>('csv')
 const [examWizard,setExamWizard]=useState(pageKey==='examinations')
 const [examScope,setExamScope]=useState('college')
 const [examTemplate,setExamTemplate]=useState('whole-college-performance')
 const [customSource,setCustomSource]=useState<DatasetKey>('students')
 const [customFields,setCustomFields]=useState<string[]>(COLUMNS.students.map(c=>c.key))
 const [history,setHistory]=useState<{name:string;format:string;at:string;count:number}[]>([])
 const [scheduleFrequency,setScheduleFrequency]=useState('monthly')

 useEffect(()=>{let live=true;setLoading(true);const keys:DatasetKey[]=['students','teachers','attendance','exam_results','fee_invoices'];Promise.all(keys.map(async key=>{try{return [key,await listRecords(mode,user!,key==='fee_invoices'?'fee_invoices':key)] as const}catch(e){if(live)setErrors(v=>[...v,userFacingError(e,'Some report records could not be loaded.')]);return [key,[]] as const}})).then(async pairs=>{if(!live)return;const next={...data};pairs.forEach(([key,rows])=>{next[key]=rows as ReportRow[]});setData(next);setLoading(false)});return()=>{live=false}},[mode,user?.id,user?.institutionId,refresh])
 const dataset=pageKey==='builder'?customSource:meta.dataset
 const allRows=data[dataset]??[]
 const filtered=useMemo(()=>allRows.filter(row=>{const d=dateValue(row);if(from&&d&&d<from)return false;if(to&&d&&d>to)return false;if(className!=='all'&&String(row.class_name??'')!==className)return false;if(section!=='all'&&String(row.section_name??'')!==section)return false;if(query&&!Object.values(row).some(v=>String(v??'').toLowerCase().includes(query.toLowerCase())))return false;return true}),[allRows,from,to,className,section,query])
 const classes=[...new Set(allRows.map(r=>String(r.class_name??'').trim()).filter(Boolean))].sort()
 const sections=[...new Set(allRows.map(r=>String(r.section_name??'').trim()).filter(Boolean))].sort()
 const columns=pageKey==='builder'?COLUMNS[customSource].filter(c=>customFields.includes(c.key)):COLUMNS[dataset]
 const rows=filtered
 const totalCollected=data.fee_invoices.reduce((n,r)=>n+Number(r.paid_amount??0),0)
 const totalInvoiced=data.fee_invoices.reduce((n,r)=>n+Number(r.total_amount??r.amount??0),0)
 const attendancePresent=data.attendance.filter(r=>['present','late'].includes(String(r.status))).length
 const published=data.exam_results.filter(r=>r.result_status==='published')
 const average=published.length?published.reduce((n,r)=>n+(Number(r.total_marks)>0?Number(r.marks_obtained??0)/Number(r.total_marks)*100:0),0)/published.length:0
 function doExport(format=exportFormat){if(!rows.length){onToast('There are no matching records to export.',true);return}exportData(meta.title,rows,columns,format);setHistory(h=>[{name:meta.title,format:format.toUpperCase(),at:new Date().toLocaleString(),count:rows.length},...h].slice(0,50));onToast('Report export prepared.')}
 const templates=['Whole-college performance','Class-wise result summary','Section-wise result summary','Subject-wise result analysis','Individual student report card','Exam-wise marks register','Grade distribution report','Merit and position list','Pass/fail analysis','Attendance and result correlation','Top performers report','Improvement required report','Missing marks register','Result publication summary','Examination comparison report']
 const templateValues=['whole-college-performance','class-wise-result-summary','section-wise-result-summary','subject-wise-result-analysis','individual-student-report-card','exam-wise-marks-register','grade-distribution-report','merit-and-position-list','pass-fail-analysis','attendance-result-correlation','top-performers-report','improvement-required-report','missing-marks-register','result-publication-summary','examination-comparison-report']
 if(loading)return <div className="ra-loading">Loading authorised report records…</div>
 return <main className="ra-workspace">
  <header className="ra-heading"><div><span>GIDC BADIN · REPORTING</span><h1>{meta.title}</h1><p>{meta.description}</p></div><button className="ra-refresh" onClick={()=>{setErrors([]);setRefresh(v=>v+1)}}><RefreshCw size={15}/> Refresh records</button></header>
  {errors.length>0&&<div className="ra-warning" role="status">{errors[0]}</div>}
  {pageKey==='overview'&&<div className="ra-stats"><Stat label="Students" value={data.students.length.toLocaleString()}/><Stat label="Employees" value={data.teachers.length.toLocaleString()}/><Stat label="Attendance marked" value={data.attendance.length.toLocaleString()}/><Stat label="Published results" value={published.length.toLocaleString()}/><Stat label="Fees collected" value={money(totalCollected)}/><Stat label="Total invoiced" value={money(totalInvoiced)}/></div>}
  {pageKey==='examinations'&&<section className="ra-panel"><div className="ra-panel-head"><div><h2>Examination report setup</h2><p>Select the coverage and one of 15 report layouts before generating the report.</p></div></div><div className="ra-form-grid"><label>Report scope<select value={examScope} onChange={e=>setExamScope(e.target.value)}><option value="college">Whole college</option><option value="class">Class</option><option value="section">Section</option><option value="subject">Subject</option><option value="exam">Individual examination</option><option value="student">Individual student</option></select></label><label>Report template<select value={examTemplate} onChange={e=>setExamTemplate(e.target.value)}>{templates.map((t,i)=><option value={templateValues[i]} key={t}>{t}</option>)}</select></label></div><div className="ra-template-grid">{templates.map((t,i)=><button key={t} className={examTemplate===templateValues[i]?'selected':''} onClick={()=>setExamTemplate(templateValues[i])}><b>{String(i+1).padStart(2,'0')}</b><span>{t}</span></button>)}</div><button className="ra-primary" onClick={()=>{setExamWizard(false);onToast('Examination report template selected. Review the filtered result register below.')}}>Generate examination report</button></section>}
  {pageKey==='builder'&&<section className="ra-panel"><div className="ra-panel-head"><div><h2>Build a custom report</h2><p>Choose an authorised data source and select the fields to include.</p></div></div><div className="ra-form-grid"><label>Data source<select value={customSource} onChange={e=>{const k=e.target.value as DatasetKey;setCustomSource(k);setCustomFields(COLUMNS[k].map(c=>c.key))}}>{Object.keys(COLUMNS).map(k=><option key={k} value={k}>{k.replaceAll('_',' ')}</option>)}</select></label><label>Export format<select value={exportFormat} onChange={e=>setExportFormat(e.target.value as ExportFormat)}><option value="csv">CSV</option><option value="xls">Excel-compatible XLS</option><option value="json">JSON</option><option value="tsv">TSV</option><option value="pdf">PDF (print dialog)</option></select></label></div><div className="ra-field-picker">{COLUMNS[customSource].map(c=><label key={c.key}><input type="checkbox" checked={customFields.includes(c.key)} onChange={e=>setCustomFields(v=>e.target.checked?[...v,c.key]:v.filter(k=>k!==c.key))}/>{c.label}</label>)}</div></section>}
  {pageKey==='templates'&&<section className="ra-panel"><div className="ra-panel-head"><div><h2>Report template library</h2><p>15 examination layouts plus reusable directory, attendance and finance layouts.</p></div></div><div className="ra-template-grid">{[...templates,'Student admission register','Employee service register','Daily attendance register','Monthly attendance summary','Fee collection statement','Outstanding dues list','Payroll register','Class strength statement'].map((t,i)=><button key={t} onClick={()=>{setExamTemplate(templateValues[i]??'whole-college-performance');onToast('Template selected. Open the relevant report page to apply its scope.')}}><b>{String(i+1).padStart(2,'0')}</b><span>{t}</span></button>)}</div></section>}
  {pageKey==='scheduled'&&<section className="ra-panel"><div className="ra-panel-head"><div><h2>Schedule a report</h2><p>Scheduling requires a server-side scheduler and delivery channel. This screen does not claim a schedule is active until that service is configured.</p></div></div><div className="ra-form-grid"><label>Report<select><option>Student Reports</option><option>Attendance Reports</option><option>Examination Reports</option><option>Fee Collection Reports</option><option>Payroll Reports</option></select></label><label>Frequency<select value={scheduleFrequency} onChange={e=>setScheduleFrequency(e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="termly">Each academic term</option></select></label></div><div className="ra-warning">Scheduling is not active yet: no institution report scheduler or email delivery function is configured in the current deployment.</div></section>}
  {pageKey==='history'&&<section className="ra-panel"><div className="ra-panel-head"><div><h2>Recent exports</h2><p>Export history for this open browser session.</p></div></div>{history.length?<div className="ra-table-wrap"><table><thead><tr><th>Report</th><th>Format</th><th>Rows</th><th>Created</th></tr></thead><tbody>{history.map((h,i)=><tr key={i}><td>{h.name}</td><td>{h.format}</td><td>{h.count}</td><td>{h.at}</td></tr>)}</tbody></table></div>:<p className="ra-empty">No exports have been created in this session.</p>}</section>}
  <section className="ra-panel">
   <div className="ra-panel-head"><div><h2>{pageKey==='overview'?'Live report records':meta.title+' · records'}</h2><p>{rows.length.toLocaleString()} matching records from {allRows.length.toLocaleString()} accessible records.</p></div><div className="ra-export-tools"><select aria-label="Export format" value={exportFormat} onChange={e=>setExportFormat(e.target.value as ExportFormat)}><option value="csv">CSV</option><option value="xls">Excel-compatible XLS</option><option value="json">JSON</option><option value="tsv">TSV</option><option value="pdf">PDF / Print</option></select><button className="ra-primary" onClick={()=>doExport()}><Download size={15}/> Export</button></div></div>
   <div className="ra-filters"><label><CalendarDays size={14}/> From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><label>Class<select value={className} onChange={e=>setClassName(e.target.value)}><option value="all">All classes</option>{classes.map(c=><option key={c}>{c}</option>)}</select></label><label>Section<select value={section} onChange={e=>setSection(e.target.value)}><option value="all">All sections</option>{sections.map(s=><option key={s}>{s}</option>)}</select></label><label className="ra-search"><Search size={14}/><input placeholder="Search records…" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
   {pageKey==='students'&&<div className="ra-stats"><Stat label="Students in view" value={rows.length.toLocaleString()}/><Stat label="Classes represented" value={new Set(rows.map(r=>String(r.class_name??''))).size.toString()}/><Stat label="Active" value={rows.filter(r=>r.status==='active').length.toLocaleString()}/></div>}
   {pageKey==='employees'&&<div className="ra-stats"><Stat label="Employees" value={rows.length.toLocaleString()}/><Stat label="Active" value={rows.filter(r=>r.employment_status==='active').length.toLocaleString()}/><Stat label="Departments" value={new Set(rows.map(r=>String(r.department??''))).size.toString()}/></div>}
   {pageKey==='attendance'&&<div className="ra-stats"><Stat label="Attendance entries" value={rows.length.toLocaleString()}/><Stat label="Present / late" value={rows.filter(r=>['present','late'].includes(String(r.status))).length.toLocaleString()}/><Stat label="Attendance rate" value={rows.length?((rows.filter(r=>['present','late'].includes(String(r.status))).length/rows.length)*100).toFixed(1)+'%':'—'}/></div>}
   {['academics','examinations','academic','class'].includes(pageKey)&&<div className="ra-stats"><Stat label="Result entries" value={rows.length.toLocaleString()}/><Stat label="Published" value={rows.filter(r=>r.result_status==='published').length.toLocaleString()}/><Stat label="Average score" value={average.toFixed(1)+'%'}/></div>}
   {['fees','financial'].includes(pageKey)&&<div className="ra-stats"><Stat label="Invoices" value={data.fee_invoices.length.toLocaleString()}/><Stat label="Invoiced" value={money(totalInvoiced)}/><Stat label="Collected" value={money(totalCollected)}/><Stat label="Outstanding" value={money(Math.max(0,totalInvoiced-totalCollected))}/></div>}
   {pageKey==='comparative'&&<div className="ra-stats"><Stat label="Students" value={data.students.length.toLocaleString()}/><Stat label="Attendance entries" value={data.attendance.length.toLocaleString()}/><Stat label="Published results" value={published.length.toLocaleString()}/><Stat label="Fees collected" value={money(totalCollected)}/></div>}
   <div className="ra-table-wrap"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.slice(0,500).map((r,i)=><tr key={String(r.id??i)}>{columns.map(c=><td key={c.key}>{String(r[c.key]??'—')}</td>)}</tr>)}</tbody></table>{rows.length===0&&<p className="ra-empty">No records match the current filters.</p>}{rows.length>500&&<p className="ra-empty">Showing first 500 rows on screen. Exports include all filtered rows.</p>}</div>
  </section>
 </main>
}
