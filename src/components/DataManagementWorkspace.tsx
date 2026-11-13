import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { CloudDownload, Database, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { createRecord, listRecords } from '../lib/data'
import type { RecordRow } from '../lib/types'

type Job = {id:string;job_type:string;module_key:string|null;file_name:string|null;status:string;total_rows:number;successful_rows:number;rejected_rows:number;error_summary:string|null;details:Record<string,unknown>;created_at:string}
type Row = RecordRow & {id:string;[key:string]:unknown}
type Spec = {key:string;label:string;required:string[];unique:string[]}
type Preview = {table:string;rows:Record<string,unknown>[];fileName:string}
const specs:Spec[]=[
 {key:'students',label:'Students',required:['full_name','admission_no'],unique:['admission_no']},
 {key:'teachers',label:'Faculty & staff',required:['full_name'],unique:['employee_id','email']},
 {key:'departments',label:'Departments',required:['name'],unique:['code','name']},
 {key:'programs',label:'Programs',required:['name'],unique:['code','name']},
 {key:'classes',label:'Classes & sections',required:['name'],unique:['code','name']},
 {key:'academic_sessions',label:'Academic sessions',required:['name'],unique:['session_name','name']},
 {key:'subjects',label:'Subjects',required:['name'],unique:['code','name']},
 {key:'rooms',label:'Rooms',required:['name'],unique:['code','name']},
 {key:'exams',label:'Examinations',required:['title'],unique:['exam_code','title']},
 {key:'assignments',label:'Assignments',required:['title'],unique:['title']},
 {key:'fee_invoices',label:'Fee invoices',required:['student_name','fee_title','amount'],unique:['invoice_number','invoice_no']},
 {key:'announcements',label:'Announcements',required:['title','body','audience'],unique:[]},
 {key:'institutional_records',label:'Operational records',required:['module_key','record_type','title'],unique:['reference_code']},
]
const systemFields=new Set(['id','institution_id','created_at','updated_at','created_by','updated_by','reviewed_by','reviewed_at','issued_by','received_by','posted_by','posted_at','uploaded_by'])
const labels:Record<string,string>={
 'backup-dashboard':'Backup & Data Management','create-backup':'Create Backup','scheduled-cloud-backups':'Scheduled Cloud Backups','backup-history':'Backup History','restore-data':'Restore Data','data-recovery':'Data Recovery','import-data':'Import Data','export-data':'Export Data','bulk-data-import':'Bulk Data Import','data-validation':'Data Validation','import-history':'Import History','export-history':'Export History','data-integrity-reports':'Data Integrity Reports','duplicate-detection':'Duplicate Detection','integration-status':'Integration Status'
}
const descriptions:Record<string,string>={
 'backup-dashboard':'Review transfer activity, export outcomes and platform backup readiness.',
 'create-backup':'Prepare an institution-scoped application-data export request. This is not a database snapshot.',
 'scheduled-cloud-backups':'Record a schedule request. A server-side backup runner is required before scheduled backups can execute.',
 'backup-history':'Review exports, backup requests, outcomes and responsible users.',
 'restore-data':'Restore records from an EduSphere JSON export. This does not restore the full database or private storage.',
 'data-recovery':'Review failed transfers and safely re-run validated record imports.',
 'import-data':'Import a validated EduSphere JSON export into a selected institution module.',
 'export-data':'Download institution records from a supported module as JSON.',
 'bulk-data-import':'Preview, validate and import multiple records with row-level results.',
 'data-validation':'Check required fields and duplicate identifiers before writing data.',
 'import-history':'Review import counts, rejected rows and validation errors.',
 'export-history':'Review generated exports and backup requests.',
 'data-integrity-reports':'Run read-only checks for missing required values and duplicate references.',
 'duplicate-detection':'Compare duplicate identifiers without modifying records.',
 'integration-status':'See which data services are configured and which still need a provider.'
}
function cleanObject(value:unknown):Record<string,unknown>|null{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null}
function moduleLabel(key:string){return specs.find(x=>x.key===key)?.label??key.replaceAll('_',' ')}
export function DataManagementWorkspace({workspaceKey,onToast}:{workspaceKey:string;onToast:(message:string,error?:boolean)=>void}){
 const {user,mode}=useAuth()
 const itemKey=workspaceKey.split(':').slice(1).join(':')||'backup-dashboard'
 const admin=Boolean(user&&['owner','admin'].includes(user.role))
 const [jobs,setJobs]=useState<Job[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [selectedTable,setSelectedTable]=useState('students')
 const [preview,setPreview]=useState<Preview|null>(null)
 const [fileError,setFileError]=useState('')
 const [frequency,setFrequency]=useState('daily')
 const [runTime,setRunTime]=useState('02:00')
 const [backupScope,setBackupScope]=useState('institution_records')
 const [search,setSearch]=useState('')
 const [statusFilter,setStatusFilter]=useState('all')
 const title=labels[itemKey]??'Backup & Data Management'
 const description=descriptions[itemKey]??'Manage institution data transfer and recovery operations.'
 const spec=specs.find(x=>x.key===selectedTable)??specs[0]
 async function loadJobs(){
  if(!supabase||!user||!admin){setJobs([]);setLoading(false);return}
  setLoading(true)
  const {data,error}=await supabase.from('data_transfer_jobs').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false}).limit(500)
  if(error){setJobs([]);onToast(error.message,true)}else setJobs((data??[]) as Job[])
  setLoading(false)
 }
 useEffect(()=>{void loadJobs()},[user?.id,user?.institutionId,user?.role])
 const stats=useMemo(()=>({total:jobs.length,complete:jobs.filter(j=>j.status==='completed').length,waiting:jobs.filter(j=>j.status==='requires_platform_action'||j.status==='queued'||j.status==='processing').length,failed:jobs.filter(j=>j.status==='failed').length}),[jobs])
 const visibleJobs=useMemo(()=>jobs.filter(job=>{
  const q=search.trim().toLowerCase()
  return (statusFilter==='all'||job.status===statusFilter)&&(!q||[job.file_name,job.job_type,job.module_key,job.status,job.error_summary].some(v=>String(v??'').toLowerCase().includes(q)))
 }),[jobs,statusFilter,search])
 async function createJob(jobType:string,status:string,values:Record<string,unknown>={}){
  if(!supabase||!user||!admin)throw new Error('Only an active institution owner or administrator can manage data transfers.')
  const {data,error}=await supabase.from('data_transfer_jobs').insert({
   institution_id:user.institutionId,job_type:jobType,module_key:values.module_key??null,file_name:values.file_name??null,
   file_format:values.file_format??null,status,total_rows:values.total_rows??0,successful_rows:values.successful_rows??0,
   rejected_rows:values.rejected_rows??0,error_summary:values.error_summary??null,details:values.details??{},requested_by:user.id,
   completed_at:status==='completed'?new Date().toISOString():null
  }).select('*').single()
  if(error)throw error
  return data as Job
 }
 async function finishJob(id:string,values:Record<string,unknown>){
  if(!supabase||!user)throw new Error('The cloud database is not available.')
  const {error}=await supabase.from('data_transfer_jobs').update({...values,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('institution_id',user.institutionId).eq('id',id)
  if(error)throw error
  await loadJobs()
 }
 function download(fileName:string,content:string,mime:string){
  const url=URL.createObjectURL(new Blob([content],{type:mime}))
  const anchor=document.createElement('a');anchor.href=url;anchor.download=fileName
  document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url)
 }
 async function exportModule(table:string){
  if(!user||!admin)throw new Error('Owner/administrator access is required for export.')
  const rows=await listRecords(mode,user,table)
  const fileName='edusphere-'+table+'-'+new Date().toISOString().slice(0,10)+'.json'
  const envelope={product:'EduSphere 360',format_version:1,exported_at:new Date().toISOString(),module_key:table,record_count:rows.length,records:rows}
  download(fileName,JSON.stringify(envelope,null,2),'application/json')
  await createJob('export','completed',{module_key:table,file_name:fileName,file_format:'json',total_rows:rows.length,successful_rows:rows.length,details:{scope:'current institution',downloaded_in_browser:true}})
  onToast(rows.length+' '+moduleLabel(table).toLowerCase()+' record(s) exported.')
  await loadJobs()
 }
 async function requestBackup(event:FormEvent){
  event.preventDefault();if(!user||!admin)return
  setBusy(true)
  try{
   await createJob('backup_request','requires_platform_action',{module_key:backupScope,file_format:'platform',details:{request:'cloud_backup',scope:backupScope,frequency:itemKey==='scheduled-cloud-backups'?frequency:null,run_time:itemKey==='scheduled-cloud-backups'?runTime:null,execution:'not_executed_no_backup_runner_configured'}})
   onToast('Backup request recorded. No database backup was created; a managed backup service must execute it.')
   await loadJobs()
  }catch(error){onToast(error instanceof Error?error.message:'Backup request could not be saved.',true)}
  finally{setBusy(false)}
 }
 async function readFile(event:ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];setPreview(null);setFileError('')
  if(!file)return
  try{
   const parsed=JSON.parse(await file.text());const envelope=cleanObject(parsed)
   const records=Array.isArray(parsed)?parsed:envelope&&Array.isArray(envelope.records)?envelope.records:null
   const source=String(envelope?.module_key??selectedTable)
   if(!records)throw new Error('Choose a JSON array or EduSphere export containing a records array.')
   if(source!==selectedTable)throw new Error('The export contains '+source+'. Select that module before importing.')
   if(records.length>2000)throw new Error('This import is limited to 2,000 rows per file.')
   const rows=records.map((row,index)=>{const object=cleanObject(row);if(!object)throw new Error('Row '+(index+1)+' is not a JSON object.');return object})
   setPreview({table:selectedTable,rows,fileName:file.name})
  }catch(error){setFileError(error instanceof Error?error.message:'The file could not be read.')}
 }
 function validateRows(table:string,rows:Record<string,unknown>[]){
  const config=specs.find(x=>x.key===table);const issues:{index:number;message:string}[]=[];const seen=new Map<string,number>()
  rows.forEach((row,index)=>{
   for(const required of config?.required??[])if(row[required]===undefined||row[required]===null||String(row[required]).trim()==='')issues.push({index,message:'Missing '+required})
   for(const key of config?.unique??[]){const value=String(row[key]??'').trim().toLowerCase();if(!value)continue;const token=key+':'+value;if(seen.has(token))issues.push({index,message:'Duplicate '+key+' in file (row '+(seen.get(token)!+1)+')'});else seen.set(token,index)}
  })
  return issues
 }
 const previewIssues=preview?validateRows(preview.table,preview.rows):[]
 async function importRows(restore:boolean){
  if(!preview||!user||!admin)return
  const issues=validateRows(preview.table,preview.rows)
  if(issues.length)throw new Error('Fix '+issues.length+' validation issue(s) before import. No records have been written.')
  setBusy(true);let job:Job|undefined;let successful=0;const rejected:string[]=[]
  try{
   job=await createJob(restore?'restore_request':'import','processing',{module_key:preview.table,file_name:preview.fileName,file_format:'json',total_rows:preview.rows.length,details:{source:'EduSphere JSON export',restore_mode:restore,table:preview.table}})
   for(let index=0;index<preview.rows.length;index++){
    const clean=Object.fromEntries(Object.entries(preview.rows[index]).filter(([key])=>!systemFields.has(key)))
    try{await createRecord(mode,user,preview.table,clean);successful++}
    catch(error){rejected.push('Row '+(index+1)+': '+(error instanceof Error?error.message:'Rejected by database policy'))}
   }
   await finishJob(job.id,{status:rejected.length&&successful===0?'failed':'completed',total_rows:preview.rows.length,successful_rows:successful,rejected_rows:rejected.length,error_summary:rejected.slice(0,15).join('\n'),details:{table:preview.table,restore_mode:restore,rejected_examples:rejected.slice(0,15)}})
   setPreview(null);onToast('Import finished: '+successful+' saved, '+rejected.length+' rejected.',rejected.length>0)
  }catch(error){
   if(job)await finishJob(job.id,{status:'failed',total_rows:preview.rows.length,successful_rows:successful,rejected_rows:preview.rows.length-successful,error_summary:error instanceof Error?error.message:'Import failed'})
   throw error
  }finally{setBusy(false)}
 }
 async function runValidation(){
  if(!user||!admin)return
  setBusy(true)
  try{
   const rows=preview?preview.rows:await listRecords(mode,user,selectedTable) as Row[]
   let missing=0;let duplicates=0;const seen=new Set<string>()
   rows.forEach(row=>{
    for(const key of spec.required)if(row[key]===undefined||row[key]===null||String(row[key]).trim()==='')missing++
    for(const key of spec.unique){const value=String(row[key]??'').trim().toLowerCase();if(!value)continue;const token=key+':'+value;if(seen.has(token))duplicates++;else seen.add(token)}
   })
   await createJob('validation','completed',{module_key:selectedTable,total_rows:rows.length,successful_rows:rows.length-missing,rejected_rows:missing+duplicates,details:{missing_required_values:missing,duplicate_values:duplicates,source:preview?'uploaded file':'live institution records',checked_at:new Date().toISOString()}})
   onToast('Validation complete: '+missing+' missing required value(s), '+duplicates+' duplicate value(s).',missing+duplicates>0)
   await loadJobs()
  }catch(error){onToast(error instanceof Error?error.message:'Validation failed.',true)}
  finally{setBusy(false)}
 }
 async function cancelRequest(job:Job){
  if(!supabase||!user||!admin)return
  if(!window.confirm('Cancel this external backup/restore request? This does not undo a platform operation.'))return
  const {error}=await supabase.from('data_transfer_jobs').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('institution_id',user.institutionId).eq('id',job.id)
  if(error){onToast(error.message,true);return}onToast('Request cancelled.');await loadJobs()
 }
 if(!user||!admin)return <main className="page-content ed360-module-page"><section className="ed360-workspace-empty"><strong>Owner or administrator access required</strong><span>Data transfer tools are restricted to authorised administrators.</span></section></main>
 const isRequest=itemKey==='create-backup'||itemKey==='scheduled-cloud-backups'
 const isImport=['import-data','bulk-data-import','restore-data','data-validation','duplicate-detection','data-integrity-reports'].includes(itemKey)
 const showJobs=['backup-dashboard','backup-history','data-recovery','import-history','export-history'].includes(itemKey)
 return <main className="page-content ed360-module-page ed360-data-management">
  <header className="ed360-workspace-hero"><div className="ed360-workspace-hero-icon"><Database size={21}/></div><div className="ed360-workspace-hero-copy"><span>ADMINISTRATION / BACKUP & DATA</span><h1>{title}</h1><p>{description}</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Institution-scoped records</span><button className="button button-outline" type="button" onClick={()=>void loadJobs()}><RefreshCw size={15}/> Refresh</button></div></header>
  {['backup-dashboard','backup-history','data-recovery'].includes(itemKey)&&<section className="ed360-workspace-kpis"><article><span>Transfer jobs</span><strong>{stats.total}</strong><small>All data-transfer records</small></article><article><span>Completed</span><strong>{stats.complete}</strong><small>Imports and exports</small></article><article><span>Awaiting service</span><strong>{stats.waiting}</strong><small>External platform requests</small></article><article><span>Failed</span><strong>{stats.failed}</strong><small>Requires review</small></article></section>}
  {isRequest&&<section className="ed360-data-card"><header><h2>{itemKey==='create-backup'?'Prepare a backup request':'Backup schedule request'}</h2><p>Requests are logged against your institution. A server-side database backup runner is not connected in this release.</p></header><form className="ed360-data-form" onSubmit={requestBackup}><label>Backup scope<select value={backupScope} onChange={e=>setBackupScope(e.target.value)}><option value="institution_records">Institution application records</option><option value="full_institution">Full institution, including private files (platform action required)</option></select></label>{itemKey==='scheduled-cloud-backups'&&<><label>Frequency<select value={frequency} onChange={e=>setFrequency(e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label>Preferred run time<input type="time" value={runTime} onChange={e=>setRunTime(e.target.value)}/></label></>}<p className="ed360-data-warning"><ShieldCheck size={17}/> This creates a tracked request only. It does not create or schedule a Supabase snapshot. A managed backup runner must confirm execution.</p><button className="button button-primary" disabled={busy}>{busy?'Saving…':'Record backup request'}</button></form></section>}
  {itemKey==='export-data'&&<section className="ed360-data-card"><header><h2>Export an institution module</h2><p>Downloads records visible to your signed-in account. This is an application-data export, not a full database dump.</p></header><form className="ed360-data-form" onSubmit={e=>{e.preventDefault();void exportModule(selectedTable).catch(err=>onToast(err instanceof Error?err.message:'Export failed.',true))}}><label>Data module<select value={selectedTable} onChange={e=>setSelectedTable(e.target.value)}>{specs.map(s=><option value={s.key} key={s.key}>{s.label}</option>)}</select></label><button className="button button-primary"><CloudDownload size={16}/> Download JSON export</button></form></section>}
  {isImport&&<section className="ed360-data-card"><header><h2>{itemKey==='restore-data'?'Restore an EduSphere record export':itemKey==='data-validation'?'Validate a data file':'Import institution records'}</h2><p>Only EduSphere JSON exports are accepted. Records are added through normal permission-checked APIs; existing rows are never overwritten.</p></header><div className="ed360-data-form"><label>Destination module<select value={selectedTable} onChange={e=>{setSelectedTable(e.target.value);setPreview(null)}}>{specs.map(s=><option value={s.key} key={s.key}>{s.label}</option>)}</select></label><label className="ed360-upload-field"><Upload size={17}/> Choose JSON export<input type="file" accept=".json,application/json" onChange={e=>void readFile(e)}/></label>{fileError&&<div className="ed360-data-error" role="alert">{fileError}</div>}{preview&&<><div className="ed360-data-preview-head"><strong>{preview.fileName}</strong><span>{preview.rows.length} rows · {moduleLabel(preview.table)}</span></div><div className="ed360-data-metric-row"><span>Rows ready <b>{preview.rows.length}</b></span><span>Validation issues <b className={previewIssues.length?'has-issues':''}>{previewIssues.length}</b></span></div>{previewIssues.slice(0,12).length>0&&<ul className="ed360-data-issues">{previewIssues.slice(0,12).map((issue,i)=><li key={i}>Row {issue.index+1}: {issue.message}</li>)}</ul>}{['data-validation','duplicate-detection','data-integrity-reports'].includes(itemKey)?<button className="button button-outline" disabled={busy} onClick={()=>void runValidation()} type="button">Run validation and save report</button>:<button className="button button-primary" disabled={busy||previewIssues.length>0} type="button" onClick={()=>void importRows(itemKey==='restore-data').catch(err=>onToast(err instanceof Error?err.message:'Import failed.',true))}>{busy?'Importing…':itemKey==='restore-data'?'Restore validated records':'Import validated records'}</button>}</> }<p className="ed360-data-warning">System IDs, institution IDs, audit users and timestamps in the file are ignored. Database row-level security remains in force for every inserted row.</p></div></section>}
  {itemKey==='integration-status'&&<section className="ed360-data-card"><header><h2>Connection status</h2><p>Service readiness, without treating unconfigured providers as connected.</p></header><div className="ed360-integration-list"><div><b>Supabase institution database</b><span className="state-ready">Connected to the signed-in workspace</span><small>Reads and writes remain governed by database policies.</small></div><div><b>Browser JSON import/export</b><span className="state-ready">Available</span><small>Supports the listed institution modules.</small></div><div><b>Managed cloud backup / restore</b><span className="state-pending">Not connected</span><small>Requires a server-side backup and retention service.</small></div><div><b>Automated scheduled backups</b><span className="state-pending">Not connected</span><small>A scheduler must execute and monitor backup jobs.</small></div><div><b>External data warehouse / sync</b><span className="state-pending">Not configured</span><small>No external integration credentials are present.</small></div></div></section>}
  {itemKey==='duplicate-detection'&&!preview&&<section className="ed360-data-card"><header><h2>Live duplicate scan</h2><p>Checks current institution rows against known unique identifiers.</p></header><div className="ed360-data-form"><label>Data module<select value={selectedTable} onChange={e=>setSelectedTable(e.target.value)}>{specs.map(s=><option value={s.key} key={s.key}>{s.label}</option>)}</select></label><button className="button button-primary" disabled={busy} type="button" onClick={()=>void runValidation()}>Scan live records</button></div></section>}
  {showJobs&&<section className="ed360-data-card"><header><h2>{title} register</h2><p>Transfer records scoped to this institution.</p></header><div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search filename, module, status…" aria-label="Search transfer jobs"/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} aria-label="Filter status"><option value="all">All statuses</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="requires_platform_action">Awaiting platform action</option><option value="queued">Queued</option><option value="cancelled">Cancelled</option></select></div>{loading?<p>Loading transfer history…</p>:visibleJobs.length===0?<div className="ed360-workspace-empty">No matching transfer jobs are recorded.</div>:<div className="table-scroll"><table><thead><tr><th>Requested</th><th>Type</th><th>Module</th><th>File / scope</th><th>Rows</th><th>Status</th><th>Details</th></tr></thead><tbody>{visibleJobs.map(job=><tr key={job.id}><td>{new Date(job.created_at).toLocaleString()}</td><td>{job.job_type.replaceAll('_',' ')}</td><td>{job.module_key??'—'}</td><td>{job.file_name??String(job.details?.scope??'—')}</td><td>{job.successful_rows}/{job.total_rows}{job.rejected_rows?' · '+job.rejected_rows+' rejected':''}</td><td><span className={'ed360-state-pill state-'+job.status}>{job.status.replaceAll('_',' ')}</span></td><td>{job.error_summary??String(job.details?.execution??'—')}{job.status==='requires_platform_action'&&<button type="button" className="ed360-row-action" onClick={()=>void cancelRequest(job)}>Cancel request</button>}</td></tr>)}</tbody></table></div>}</section>}
 </main>
}
