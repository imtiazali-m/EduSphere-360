import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BarChart3, Download, Play, Plus, RefreshCw, Save, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listRecords, createRecord } from '../lib/data'
import { downloadCsv, type CsvColumn } from '../lib/csv'
import type { RecordRow } from '../lib/types'
import '../styles/data-management.css'

type Source={key:string;label:string;fields:string[];names:Record<string,string>}
type Saved=RecordRow & {id:string;title:string;record_type:string;payload?:Record<string,unknown>;status?:string}
type ResultRow=Record<string,unknown>
const sources:Source[]=[
 {key:'students',label:'Students',fields:['admission_no','full_name','class_name','section','status','gender','created_at'],names:{admission_no:'Admission ID',full_name:'Student',class_name:'Class',section:'Section',status:'Status',gender:'Gender',created_at:'Created'}},
 {key:'teachers',label:'Faculty & staff',fields:['employee_id','full_name','department','designation','employment_status','email','created_at'],names:{employee_id:'Employee ID',full_name:'Name',department:'Department',designation:'Designation',employment_status:'Status',email:'Email',created_at:'Created'}},
 {key:'attendance',label:'Attendance',fields:['student_id','class_name','attendance_date','status','remarks','created_at'],names:{student_id:'Student ID',class_name:'Class',attendance_date:'Date',status:'Attendance',remarks:'Remarks',created_at:'Created'}},
 {key:'exam_results',label:'Examination results',fields:['student_id','exam_id','subject_name','marks_obtained','grade','result_status','created_at'],names:{student_id:'Student ID',exam_id:'Exam',subject_name:'Subject',marks_obtained:'Marks',grade:'Grade',result_status:'Publication status',created_at:'Created'}},
 {key:'fee_invoices',label:'Fee invoices',fields:['invoice_number','student_name','class_name','fee_title','amount','paid_amount','balance','due_date','status'],names:{invoice_number:'Invoice',student_name:'Student',class_name:'Class',fee_title:'Fee',amount:'Invoiced',paid_amount:'Paid',balance:'Balance',due_date:'Due date',status:'Status'}},
 {key:'fee_payments',label:'Fee payments',fields:['receipt_number','payment_date','amount','payment_method','transaction_reference','status'],names:{receipt_number:'Receipt',payment_date:'Payment date',amount:'Amount',payment_method:'Method',transaction_reference:'Reference',status:'Status'}},
 {key:'assignments',label:'Assignments',fields:['title','subject_name','class_name','due_date','status','created_at'],names:{title:'Assignment',subject_name:'Subject',class_name:'Class',due_date:'Due date',status:'Status',created_at:'Created'}},
 {key:'exams',label:'Examinations',fields:['title','exam_type','class_name','start_date','end_date','status'],names:{title:'Examination',exam_type:'Type',class_name:'Class',start_date:'Start',end_date:'End',status:'Status'}},
 {key:'institutional_records',label:'Operational records',fields:['title','module_key','record_type','status','approval_status','record_date','due_date','amount'],names:{title:'Record',module_key:'Module',record_type:'Type',status:'Status',approval_status:'Approval',record_date:'Date',due_date:'Due',amount:'Amount'}},
 {key:'announcements',label:'Announcements',fields:['title','audience','body','created_at'],names:{title:'Notice',audience:'Audience',body:'Message',created_at:'Published'}},
]
const pages:Record<string,string>={'custom-report-builder':'Custom Report Builder','scheduled-reports':'Scheduled Reports','report-templates':'Report Templates','report-history':'Report History'}
const blurbs:Record<string,string>={
 'custom-report-builder':'Choose a live institution data source, filter fields and export a saved report definition.',
 'scheduled-reports':'Save a recurring report request and its recipients. Automatic execution requires a server scheduler.',
 'report-templates':'Save reusable report column and filter layouts for your institution.',
 'report-history':'Review reports generated on demand, including their source and row totals.'
}
const toStringValue=(value:unknown)=>value===null||value===undefined?'':String(value)
function matches(row:ResultRow,key:string,operator:string,value:string){
 const actual=toStringValue(row[key]).toLowerCase(), expected=value.trim().toLowerCase()
 if(operator==='equals')return actual===expected
 if(operator==='contains')return actual.includes(expected)
 if(operator==='greater')return Number(row[key])>Number(value)
 if(operator==='less')return Number(row[key])<Number(value)
 if(operator==='not-empty')return actual!==''
 return true
}
export function CustomReportsWorkspace({workspaceKey,onToast}:{workspaceKey:string;onToast:(message:string,error?:boolean)=>void}){
 const {user,mode}=useAuth()
 const itemKey=workspaceKey.split(':').slice(1).join(':')||'custom-report-builder'
 const title=pages[itemKey]??'Custom Reports'
 const description=blurbs[itemKey]??'Build, save and review institution reports.'
 const canManage=Boolean(user&&['owner','admin'].includes(user.role))
 const [sourceKey,setSourceKey]=useState('students')
 const [selectedFields,setSelectedFields]=useState<string[]>(['admission_no','full_name','class_name','status'])
 const [reportName,setReportName]=useState('')
 const [filterField,setFilterField]=useState('')
 const [operator,setOperator]=useState('contains')
 const [filterValue,setFilterValue]=useState('')
 const [scheduleFrequency,setScheduleFrequency]=useState('weekly')
 const [recipients,setRecipients]=useState('')
 const [runRows,setRunRows]=useState<ResultRow[]>([])
 const [running,setRunning]=useState(false)
 const [saving,setSaving]=useState(false)
 const [saved,setSaved]=useState<Saved[]>([])
 const [history,setHistory]=useState<Saved[]>([])
 const [search,setSearch]=useState('')
 const [activeDefinition,setActiveDefinition]=useState<Saved|null>(null)
 const source=sources.find(x=>x.key===sourceKey)??sources[0]
 const columns:CsvColumn[]=selectedFields.map(key=>({key,label:source.names[key]??key.replaceAll('_',' ')}))
 async function loadSaved(){
  if(!user)return
  try{
   const rows=await listRecords(mode,user,'institutional_records') as Saved[]
   setSaved(rows.filter(row=>row.module_key==='reports'&&['report-templates','scheduled-reports','custom-report-builder'].includes(row.record_type)))
   setHistory(rows.filter(row=>row.module_key==='reports'&&row.record_type==='report-history'))
  }catch(error){onToast(error instanceof Error?error.message:'Saved report definitions could not be loaded.',true)}
 }
 useEffect(()=>{void loadSaved()},[user?.id,user?.institutionId,user?.role])
 useEffect(()=>{setSelectedFields(sources.find(x=>x.key===sourceKey)?.fields.slice(0,4)??[])},[sourceKey])
 const visibleSaved=useMemo(()=>saved.filter(row=>(itemKey==='scheduled-reports'?row.record_type==='scheduled-reports':itemKey==='report-templates'?row.record_type==='report-templates':row.record_type==='custom-report-builder')&&(!search||row.title.toLowerCase().includes(search.toLowerCase()))),[saved,itemKey,search])
 const visibleHistory=useMemo(()=>history.filter(row=>!search||row.title.toLowerCase().includes(search.toLowerCase())),[history,search])
 async function saveDefinition(kind:string,payload:Record<string,unknown>,status='active'){
  if(!user)throw new Error('Sign in to save report definitions.')
  if(!canManage)throw new Error('Only the owner or an administrator can save shared report definitions.')
  await createRecord(mode,user,'institutional_records',{
   module_key:'reports',record_type:kind,title:reportName.trim()||title,description:'Saved from '+title,
   status,approval_status:'not_required',visibility:'staff_only',record_date:new Date().toISOString().slice(0,10),
   payload:{...payload,created_for_role:user.role}
  })
  onToast('Saved '+(reportName.trim()||title)+'.')
  await loadSaved()
 }
 async function runReport(event?:FormEvent){
  event?.preventDefault()
  if(!user)return
  if(!selectedFields.length){onToast('Select at least one report column.',true);return}
  setRunning(true)
  try{
   const rows=await listRecords(mode,user,sourceKey) as ResultRow[]
   const output=rows.filter(row=>!filterField||matches(row,filterField,operator,filterValue))
    .map(row=>Object.fromEntries(selectedFields.map(key=>[key,row[key]??''])))
   setRunRows(output)
   if(canManage)await createRecord(mode,user,'institutional_records',{
    module_key:'reports',record_type:'report-history',title:reportName.trim()||source.label+' report',
    description:'On-demand report run',status:'completed',approval_status:'not_required',visibility:'staff_only',
    record_date:new Date().toISOString().slice(0,10),quantity:output.length,
    payload:{source_table:sourceKey,columns:selectedFields,filter_field:filterField,filter_operator:operator,filter_value:filterValue,row_count:output.length,run_at:new Date().toISOString()}
   })
   onToast('Report generated from '+rows.length+' live source record(s): '+output.length+' row(s) matched.')
   await loadSaved()
  }catch(error){onToast(error instanceof Error?error.message:'The report could not be generated.',true)}
  finally{setRunning(false)}
 }
 function exportCurrent(){
  if(!runRows.length){onToast('Run the report before exporting.',true);return}
  downloadCsv('edusphere-'+(reportName||sourceKey)+'-'+new Date().toISOString().slice(0,10)+'.csv',runRows,columns)
  onToast('CSV report downloaded.')
 }
 function loadDefinition(row:Saved){
  setActiveDefinition(row);const p=row.payload??{}
  setSourceKey(String(p.source_table??'students'))
  setReportName(row.title)
  setSelectedFields(Array.isArray(p.columns)?p.columns.map(String):['full_name'])
  setFilterField(String(p.filter_field??''));setOperator(String(p.filter_operator??'contains'));setFilterValue(String(p.filter_value??''))
 }
 async function saveTemplate(event:FormEvent){
  event.preventDefault();setSaving(true)
  try{await saveDefinition(itemKey==='scheduled-reports'?'scheduled-reports':itemKey==='report-templates'?'report-templates':'custom-report-builder',
   itemKey==='scheduled-reports'?{source_table:sourceKey,columns:selectedFields,frequency:scheduleFrequency,recipients:recipients.split(',').map(x=>x.trim()).filter(Boolean),scheduler_status:'paused_until_server_runner_connected'}:
   {source_table:sourceKey,columns:selectedFields,filter_field:filterField,filter_operator:operator,filter_value:filterValue},itemKey==='scheduled-reports'?'paused':'active')
  }catch(error){onToast(error instanceof Error?error.message:'The definition could not be saved.',true)}
  finally{setSaving(false)}
 }
 if(!user)return null
 return <main className="page-content ed360-module-page ed360-custom-reports">
  <header className="ed360-workspace-hero"><div className="ed360-workspace-hero-icon"><BarChart3 size={21}/></div><div className="ed360-workspace-hero-copy"><span>REPORTS & ANALYTICS / CUSTOM WORKSPACE</span><h1>{title}</h1><p>{description}</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Live institution data</span><button type="button" className="button button-outline" onClick={()=>void loadSaved()}><RefreshCw size={15}/> Refresh</button></div></header>
  {itemKey==='custom-report-builder'&&<section className="ed360-data-card"><header><h2>Report definition</h2><p>Select a supported data source and the fields needed for this report.</p></header><form className="ed360-data-form" onSubmit={runReport}>
   <label>Report name<input value={reportName} onChange={e=>setReportName(e.target.value)} placeholder="e.g. Grade-wise student attendance"/></label>
   <label>Data source<select value={sourceKey} onChange={e=>{setSourceKey(e.target.value);setRunRows([])}}>{sources.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
   <div className="ed360-report-field-picker"><strong>Columns</strong><div>{source.fields.map(field=><label key={field}><input type="checkbox" checked={selectedFields.includes(field)} onChange={e=>setSelectedFields(current=>e.target.checked?[...current,field]:current.filter(x=>x!==field))}/>{source.names[field]??field}</label>)}</div></div>
   <label>Filter field<select value={filterField} onChange={e=>setFilterField(e.target.value)}><option value="">No filter</option>{source.fields.map(field=><option key={field} value={field}>{source.names[field]??field}</option>)}</select></label>
   <label>Condition<select value={operator} onChange={e=>setOperator(e.target.value)}><option value="contains">Contains</option><option value="equals">Equals</option><option value="greater">Greater than (numeric)</option><option value="less">Less than (numeric)</option><option value="not-empty">Is not empty</option></select></label>
   {operator!=='not-empty'&&<label>Filter value<input value={filterValue} onChange={e=>setFilterValue(e.target.value)} placeholder="Enter a value"/></label>}
   <div className="ed360-data-action-row"><button className="button button-primary" disabled={running}><Play size={15}/>{running?'Generating…':'Run report'}</button>{canManage&&<button type="button" className="button button-outline" disabled={saving} onClick={()=>void saveTemplate({preventDefault:()=>{}} as FormEvent)}><Save size={15}/> Save definition</button>}{runRows.length>0&&<button type="button" className="button button-outline" onClick={exportCurrent}><Download size={15}/> Export CSV</button>}</div>
  </form></section>}
  {itemKey==='scheduled-reports'&&<section className="ed360-data-card"><header><h2>Schedule a report</h2><p>Save the report source and recipients for a future automated run.</p></header><form className="ed360-data-form" onSubmit={saveTemplate}><label>Schedule name<input required value={reportName} onChange={e=>setReportName(e.target.value)} placeholder="Monthly fee collection"/></label><label>Data source<select value={sourceKey} onChange={e=>setSourceKey(e.target.value)}>{sources.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></label><label>Frequency<select value={scheduleFrequency} onChange={e=>setScheduleFrequency(e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="term">Each academic term</option></select></label><label>Recipient emails (comma-separated)<textarea rows={2} value={recipients} onChange={e=>setRecipients(e.target.value)}/></label><p className="ed360-data-warning">The schedule is saved as paused. No server scheduler or email delivery provider is connected, so it will not run or send automatically.</p><button className="button button-primary" disabled={saving}>Save paused schedule</button></form></section>}
  {itemKey==='report-templates'&&<section className="ed360-data-card"><header><h2>Report template definition</h2><p>Save reusable source, columns and filter settings for the institution.</p></header><form className="ed360-data-form" onSubmit={saveTemplate}><label>Template name<input required value={reportName} onChange={e=>setReportName(e.target.value)} placeholder="Monthly attendance report"/></label><label>Source table<select value={sourceKey} onChange={e=>setSourceKey(e.target.value)}>{sources.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></label><div className="ed360-report-field-picker"><strong>Template columns</strong><div>{source.fields.map(field=><label key={field}><input type="checkbox" checked={selectedFields.includes(field)} onChange={e=>setSelectedFields(current=>e.target.checked?[...current,field]:current.filter(x=>x!==field))}/>{source.names[field]??field}</label>)}</div></div><button className="button button-primary" disabled={saving}>Save report template</button></form></section>}
  {itemKey==='report-history'&&<section className="ed360-data-card"><header><h2>Generated report history</h2><p>History is recorded after an on-demand report run.</p></header><div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search report history…" aria-label="Search report history"/></div>{visibleHistory.length?<div className="table-scroll"><table><thead><tr><th>Report</th><th>Source</th><th>Rows</th><th>Run date</th><th>Status</th></tr></thead><tbody>{visibleHistory.filter(row=>!search||row.title.toLowerCase().includes(search.toLowerCase())).map(row=><tr key={row.id}><td>{row.title}</td><td>{String(row.payload?.source_table??'—')}</td><td>{String(row.payload?.row_count??row.quantity??0)}</td><td>{String(row.payload?.run_at??row.record_date??'—')}</td><td>{row.status??'completed'}</td></tr>)}</tbody></table></div>:<div className="ed360-workspace-empty">No reports have been generated yet. Run a custom report to create the first history record.</div>}</section>}
  {['custom-report-builder','report-templates','scheduled-reports'].includes(itemKey)&&<section className="ed360-data-card"><header><h2>Saved {itemKey==='scheduled-reports'?'schedules':itemKey==='report-templates'?'templates':'report definitions'}</h2><p>Definitions are saved within this institution and remain subject to role permissions.</p></header><div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search saved items…" aria-label="Search saved report definitions"/></div>{visibleSaved.length?<div className="table-scroll"><table><thead><tr><th>Name</th><th>Source</th><th>Configuration</th><th>Status</th><th>Action</th></tr></thead><tbody>{visibleSaved.map(row=><tr key={row.id}><td>{row.title}</td><td>{String(row.payload?.source_table??'—')}</td><td>{Array.isArray(row.payload?.columns)?row.payload!.columns!.length+' columns':String(row.payload?.frequency??'—')}</td><td>{row.status??'active'}</td><td><button type="button" className="button button-outline" onClick={()=>loadDefinition(row)}>Load</button></td></tr>)}</tbody></table></div>:<div className="ed360-workspace-empty">No saved definitions in this window yet.</div>}</section>}
  {itemKey==='custom-report-builder'&&runRows.length>0&&<section className="ed360-data-card"><header><h2>Report preview</h2><p>{runRows.length} matching row(s) from {source.label}. Values are drawn from records your account can read.</p></header><div className="table-scroll"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{runRows.slice(0,100).map((row,i)=><tr key={i}>{columns.map(c=><td key={c.key}>{String(row[c.key]??'')}</td>)}</tr>)}</tbody></table></div>{runRows.length>100&&<p>Preview shows first 100 rows; the CSV export contains all matched rows.</p>}</section>}
 </main>
}
