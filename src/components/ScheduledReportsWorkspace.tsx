import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarClock, Download, FileClock, Pause, Play, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/data-management.css'

type Row=Record<string,any>&{id:string}
type Source='students'|'teachers'|'fee_payments'
const sources:Record<Source,string>={students:'Student records',teachers:'Employee records',fee_payments:'Fee payment records'}
const safeColumns:Record<Source,string[]>={
 students:['full_name','admission_no','class_name','section','status','gender','date_of_birth','admission_date'],
 teachers:['full_name','employee_no','department','designation','employment_status','status'],
 fee_payments:['invoice_number','payment_date','amount','paid_amount','payment_method','payment_status','transaction_reference']
}
const csvCell=(v:unknown)=>{const s=v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);return '"'+s.replaceAll('"','""')+'"'}
const safeFilename=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||'report'
const dateTime=(v:unknown)=>v?new Date(String(v)).toLocaleString():'—'
export function ScheduledReportsWorkspace({workspaceKey,onToast}:{workspaceKey:string;onToast:(message:string,error?:boolean)=>void}){
 const {user}=useAuth()
 const admin=Boolean(user&&['owner','admin'].includes(user.role))
 const finance=Boolean(user&&['owner','admin','accountant'].includes(user.role))
 const [schedules,setSchedules]=useState<Row[]>([])
 const [history,setHistory]=useState<Row[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [search,setSearch]=useState('')
 const [form,setForm]=useState({name:'',source_module:'students' as Source,fields:safeColumns.students.join(', '),frequency:'weekly',run_at:'09:00',recipient_list:''})
 async function load(){
  if(!supabase||!user){setLoading(false);return}
  setLoading(true)
  try{
   const [s,h]=await Promise.all([
    supabase.from('institutional_records').select('*').eq('institution_id',user.institutionId).eq('module_key','reports').eq('record_type','scheduled-reports').order('created_at',{ascending:false}).limit(1000),
    supabase.from('scheduled_report_execution_history').select('*').eq('institution_id',user.institutionId).order('executed_at',{ascending:false}).limit(2000)
   ])
   if(s.error)throw s.error;if(h.error)throw h.error
   setSchedules((s.data??[]) as Row[]);setHistory((h.data??[]) as Row[])
  }catch(e){onToast(e instanceof Error?e.message:'Scheduled report records could not be loaded.',true)}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[user?.id,user?.institutionId])
 const visibleSchedules=useMemo(()=>schedules.filter(s=>!search||[s.title,s.payload?.source_module,s.status,s.payload?.frequency].join(' ').toLowerCase().includes(search.toLowerCase())),[schedules,search])
 function changeSource(value:Source){setForm(x=>({...x,source_module:value,fields:safeColumns[value].join(', ')}))}
 async function saveSchedule(event:FormEvent){
  event.preventDefault();if(!supabase||!user||!admin)return
  const columns=form.fields.split(',').map(x=>x.trim()).filter(Boolean)
  const permitted=safeColumns[form.source_module]
  if(!columns.length||columns.some(x=>!permitted.includes(x))){onToast('Use only the available columns listed for the selected source.',true);return}
  setBusy(true)
  try{
   const {error}=await supabase.from('institutional_records').insert({
    institution_id:user.institutionId,module_key:'reports',record_type:'scheduled-reports',
    title:form.name.trim(),description:'User-configured scheduled report definition',
    status:'active',approval_status:'not_required',visibility:'staff_only',
    record_date:new Date().toISOString().slice(0,10),created_by:user.id,
    payload:{source_module:form.source_module,fields:columns,frequency:form.frequency,run_at:form.run_at,recipient_list:form.recipient_list,status:'enabled',execution_mode:'manual_run_and_download'}
   })
   if(error)throw error
   setForm({name:'',source_module:'students',fields:safeColumns.students.join(', '),frequency:'weekly',run_at:'09:00',recipient_list:''})
   await load();onToast('Scheduled report definition saved. Automatic execution is not enabled; use Run now to generate a report.')
  }catch(e){onToast(e instanceof Error?e.message:'Schedule could not be saved.',true)}
  finally{setBusy(false)}
 }
 async function toggleSchedule(row:Row){
  if(!supabase||!user||!admin)return
  const next=row.status==='active'?'paused':'active'
  const {error}=await supabase.from('institutional_records').update({status:next,payload:{...row.payload,status:next==='active'?'enabled':'paused'}}).eq('institution_id',user.institutionId).eq('id',row.id)
  if(error){onToast(error.message,true);return}
  await load();onToast(next==='active'?'Report definition enabled.':'Report definition paused.')
 }
 async function runNow(row:Row){
  if(!supabase||!user||!finance)return
  const source=row.payload?.source_module as Source
  if(!Object.keys(sources).includes(source)){onToast('This report has an unsupported data source.',true);return}
  const columns=Array.isArray(row.payload?.fields)?row.payload.fields.filter((x:unknown)=>typeof x==='string'&&safeColumns[source].includes(x)):safeColumns[source]
  if(!columns.length){onToast('This report has no valid columns.',true);return}
  setBusy(true)
  try{
   const result=await supabase.from(source).select('*').eq('institution_id',user.institutionId).limit(5000)
   if(result.error)throw result.error
   const rows=(result.data??[]) as Row[]
   const csv=[columns.map(csvCell).join(','),...rows.map(record=>columns.map(column=>csvCell(record[column])).join(','))].join('\r\n')
   const filename=safeFilename(String(row.title))+'-'+new Date().toISOString().slice(0,10)+'.csv'
   const {error}=await supabase.rpc('log_scheduled_report_execution',{
    p_institution_id:user.institutionId,p_report_record_id:row.id,p_report_name:String(row.title),
    p_source_module:source,p_output_filename:filename,p_row_count:rows.length,
    p_filter_snapshot:{frequency:row.payload?.frequency,fields:columns}
   })
   if(error)throw error
   const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'})
   const url=URL.createObjectURL(blob)
   const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url)
   await load();onToast('Report generated and downloaded: '+rows.length+' row(s). Execution history saved.')
  }catch(e){onToast(e instanceof Error?e.message:'Report execution failed.',true)}
  finally{setBusy(false)}
 }
 if(!user)return null
 if(!finance)return <main className="page-content ed360-module-page"><section className="ed360-workspace-empty">Report management is available to owner, administrator and accountant roles.</section></main>
 return <main className="page-content ed360-module-page ed360-scheduled-reports">
  <header className="ed360-workspace-hero"><div className="ed360-workspace-hero-icon"><CalendarClock size={21}/></div><div className="ed360-workspace-hero-copy"><span>REPORTS / EXECUTION</span><h1>Scheduled Reports</h1><p>Save report definitions, run them on demand, download the result and retain an execution record.</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Institution report definitions</span><button className="button button-outline" type="button" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div></header>
  <div className="ed360-payment-provider-note"><FileClock size={18}/><span><b>Execution mode</b> Report definitions can store daily/weekly/monthly preferences, but automatic background execution and email delivery need a server scheduler and approved delivery provider. Run now generates and downloads a CSV immediately.</span></div>
  {admin&&<section className="ed360-data-card"><header><h2>Create a report definition</h2><p>Choose a tenant-scoped source and permitted columns. Recipients are stored for future delivery configuration only.</p></header><form className="ed360-data-form" onSubmit={saveSchedule}>
   <label>Report name<input required value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))}/></label>
   <label>Data source<select value={form.source_module} onChange={e=>changeSource(e.target.value as Source)}>{Object.entries(sources).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
   <label>Columns (comma separated)<textarea rows={3} required value={form.fields} onChange={e=>setForm(x=>({...x,fields:e.target.value}))}/><small>Allowed: {safeColumns[form.source_module].join(', ')}</small></label>
   <label>Frequency preference<select value={form.frequency} onChange={e=>setForm(x=>({...x,frequency:e.target.value}))}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="term">Per term</option></select></label>
   <label>Preferred run time<input type="time" value={form.run_at} onChange={e=>setForm(x=>({...x,run_at:e.target.value}))}/></label>
   <label>Recipients (not yet auto-mailed)<textarea rows={2} value={form.recipient_list} onChange={e=>setForm(x=>({...x,recipient_list:e.target.value}))}/></label>
   <button className="button button-primary" disabled={busy}>{busy?'Saving…':'Save report definition'}</button>
  </form></section>}
  <section className="ed360-data-card"><header><h2>Saved report definitions</h2><p>Run reports manually or pause a definition.</p></header><div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search saved reports…" aria-label="Search reports"/></div><div className="table-scroll"><table><thead><tr><th>Report</th><th>Source</th><th>Frequency</th><th>Preferred time</th><th>Recipients</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleSchedules.map(row=><tr key={row.id}><td><b>{row.title}</b></td><td>{sources[row.payload?.source_module as Source]??row.payload?.source_module}</td><td>{String(row.payload?.frequency??'manual')}</td><td>{String(row.payload?.run_at??'—')}</td><td>{String(row.payload?.recipient_list??'—')}</td><td>{String(row.status)}</td><td><div className="ed360-report-actions"><button className="button button-primary" type="button" disabled={busy} onClick={()=>void runNow(row)}><Download size={14}/> Run now</button>{admin&&<button className="button button-outline" type="button" onClick={()=>void toggleSchedule(row)}>{row.status==='active'?<Pause size={14}/>:<Play size={14}/>} {row.status==='active'?'Pause':'Enable'}</button>}</div></td></tr>)}</tbody></table></div></section>
  <section className="ed360-data-card"><header><h2>Execution history</h2><p>History is recorded when a CSV is generated from an actual source query.</p></header><div className="table-scroll"><table><thead><tr><th>Executed</th><th>Report</th><th>Source</th><th>Rows</th><th>File</th><th>Executed by</th></tr></thead><tbody>{history.map(row=><tr key={row.id}><td>{dateTime(row.executed_at)}</td><td>{row.report_name}</td><td>{row.source_module}</td><td>{row.row_count}</td><td>{row.output_filename}</td><td>{String(row.executed_by).slice(0,8)}</td></tr>)}</tbody></table></div>{history.length===0&&<div className="ed360-workspace-empty">No report runs recorded yet.</div>}</section>
 </main>
}
