import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { Activity, AlertTriangle, Archive, ArrowDownToLine, CheckCircle2, Cloud, Database, History, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listRecords, createRecord } from '../lib/data'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/userErrors'
import { downloadCsv, toCsv } from '../lib/csv'
import { exportDocx, exportExcelXml, exportWordXml, exportXlsx, printOfficeReport, type OfficeColumn } from '../lib/officeExport'
import type { RecordRow } from '../lib/types'
import './backup-data-workspace.css'

type Props = { initialWindow: string; onToast: (message: string, error?: boolean) => void }
type ViewKey = 'dashboard'|'create'|'schedule'|'backup-history'|'recovery'|'import'|'export'|'validation'|'import-history'|'export-history'|'integrity'|'duplicates'|'integrations'
type DataRow = Record<string, unknown>
type AuditRow = RecordRow & { action?: string; module_key?: string; record_type?: string; occurred_at?: string; actor_id?: string|null }

const views: Record<string, ViewKey> = {
  'backup-dashboard':'dashboard', 'create-backup':'create',
  'scheduled-cloud-backups':'schedule', 'backup-history':'backup-history',
  'restore-data':'recovery', 'data-recovery':'recovery',
  'import-data':'import', 'bulk-data-import':'import',
  'export-data':'export', 'data-validation':'validation',
  'import-history':'import-history', 'export-history':'export-history',
  'data-integrity-reports':'integrity', 'duplicate-detection':'duplicates',
  'integration-status':'integrations',
}
const titles: Record<ViewKey,string> = {
  dashboard:'Backup Dashboard', create:'Create Backup', schedule:'Schedule Cloud Backups',
  'backup-history':'Backup History', recovery:'Data Recovery', import:'Bulk Data Import',
  export:'Data Export', validation:'Data Validation', 'import-history':'Import History',
  'export-history':'Export History', integrity:'Data Integrity Reports',
  duplicates:'Duplicate Detection', integrations:'Integration Status',
}
const dataTables = [
  { key:'students', label:'Students' }, { key:'teachers', label:'Teachers & staff' },
  { key:'attendance', label:'Student attendance' }, { key:'employee_attendance', label:'Staff attendance' },
  { key:'exams', label:'Examinations' }, { key:'exam_results', label:'Examination results' },
  { key:'fee_invoices', label:'Fee invoices' }, { key:'fee_payments', label:'Fee payments' },
  { key:'fee_structures', label:'Fee structures' }, { key:'finance_accounts', label:'Finance accounts' },
  { key:'finance_journals', label:'Finance journals' }, { key:'assignments', label:'Assignments' },
  { key:'assignment_submissions', label:'Assignment submissions' }, { key:'announcements', label:'Notices' },
  { key:'campuses', label:'Campuses / branches' }, { key:'academic_sessions', label:'Academic sessions' },
  { key:'departments', label:'Departments' }, { key:'designations', label:'Designations' },
  { key:'programs', label:'Programmes' }, { key:'classes', label:'Classes' },
  { key:'subjects', label:'Subjects' }, { key:'rooms', label:'Rooms' },
  { key:'timetable_entries', label:'Timetable entries' }, { key:'workflow_approvals', label:'Approval requests' },
  { key:'work_tasks', label:'Work tasks' }, { key:'employee_leave_requests', label:'Employee leave requests' },
  { key:'institutional_records', label:'Institutional records' },
]
const importableTables = [
  { key:'students', label:'Students', required:['full_name','admission_no'] },
  { key:'teachers', label:'Teachers & staff', required:['full_name'] },
  { key:'departments', label:'Departments', required:['name'] },
  { key:'designations', label:'Designations', required:['name'] },
  { key:'programs', label:'Programmes', required:['name'] },
  { key:'classes', label:'Classes', required:['name'] },
  { key:'subjects', label:'Subjects', required:['name'] },
  { key:'rooms', label:'Rooms', required:['name'] },
  { key:'announcements', label:'Notices', required:['title'] },
]
const tableLabel = (key:string) => dataTables.find(item=>item.key===key)?.label ?? key.replaceAll('_',' ')
const normaliseHeader = (value:string) => value.trim().replace(/([a-z])([A-Z])/g,'$1_$2').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')
const protectedFields = new Set(['id','institution_id','created_by','updated_by','created_at','updated_at'])
function parseCsv(source:string): DataRow[] {
  const matrix:string[][]=[]
  let row:string[]=[]
  let cell=''
  let quoted=false
  for(let i=0;i<source.length;i++){
    const char=source[i]
    if(char==='"'){
      if(quoted&&source[i+1]==='"'){cell+='"';i++}
      else quoted=!quoted
    } else if(char===','&&!quoted){row.push(cell);cell=''}
    else if((char==='\n'||char==='\r')&&!quoted){
      if(char==='\r'&&source[i+1]==='\n')i++
      row.push(cell);cell=''
      if(row.some(value=>value.trim()))matrix.push(row)
      row=[]
    } else cell+=char
  }
  row.push(cell)
  if(row.some(value=>value.trim()))matrix.push(row)
  if(matrix.length<2) return []
  const headers=matrix[0].map(normaliseHeader)
  return matrix.slice(1).map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??'']).filter(([key])=>Boolean(key))))
}
function parseJsonRows(source:string,table?:string):DataRow[] {
  const parsed=JSON.parse(source) as unknown
  if(Array.isArray(parsed)) return parsed.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)) as DataRow[]
  if(parsed&&typeof parsed==='object'){
    const object=parsed as Record<string,unknown>
    const datasets=object.datasets
    if(datasets&&typeof datasets==='object'&&!Array.isArray(datasets)){
      const collection=(datasets as Record<string,unknown>)[table??'']
      if(Array.isArray(collection))return collection.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)) as DataRow[]
      const entries=Object.entries(datasets as Record<string,unknown>)
      const first=entries.find(([,value])=>Array.isArray(value))
      return first ? (first[1] as unknown[]).filter(row=>row&&typeof row==='object'&&!Array.isArray(row)) as DataRow[] : []
    }
    const first=Object.values(object).find(Array.isArray)
    if(Array.isArray(first))return first.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)) as DataRow[]
  }
  return []
}
function downloadText(filename:string,content:string,mime:string){
  const blob=new Blob([content],{type:mime})
  const url=URL.createObjectURL(blob)
  const link=document.createElement('a')
  link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),1500)
}
function visibleColumns(rows:DataRow[]):OfficeColumn[]{
  const keys=[...new Set(rows.flatMap(row=>Object.keys(row)))]
  return keys.map(key=>({key,label:key.replaceAll('_',' ').replace(/\b\w/g,char=>char.toUpperCase())}))
}
function validateRows(table:string,rows:DataRow[]){
  const required=importableTables.find(item=>item.key===table)?.required??[]
  const missing=rows.reduce((count,row)=>count+(required.some(key=>row[key]===undefined||row[key]===null||String(row[key]).trim()==='')?1:0),0)
  const uniqueKey=table==='students'?'admission_no':table==='teachers'?'email':table==='departments'?'department_code':table==='designations'?'name':table==='announcements'?'title':'name'
  const seen=new Set<string>()
  let duplicates=0
  rows.forEach(row=>{
    const value=String(row[uniqueKey]??'').trim().toLowerCase()
    if(value&&seen.has(value))duplicates++
    if(value)seen.add(value)
  })
  return {missing,duplicates,uniqueKey,valid:Math.max(0,rows.length-missing-duplicates)}
}
function InfoStat({label,value,detail}:{label:string;value:string;detail:string}){
  return <article className="bdw-stat"><small>{label}</small><strong>{value}</strong><span>{detail}</span></article>
}
function PageIntro({icon:Icon,title,description,action}:{icon:typeof Database;title:string;description:string;action?:ReactNode}){
  return <header className="bdw-page-intro"><span className="bdw-intro-icon"><Icon size={22}/></span><div><h2>{title}</h2><p>{description}</p></div>{action&&<div className="bdw-intro-action">{action}</div>}</header>
}
export function BackupDataWorkspace({initialWindow,onToast}:Props){
  const {user,mode}=useAuth()
  const [view,setView]=useState<ViewKey>(views[initialWindow]??'dashboard')
  const [selectedTable,setSelectedTable]=useState('students')
  const [records,setRecords]=useState<DataRow[]>([])
  const [tableBusy,setTableBusy]=useState(false)
  const [tableError,setTableError]=useState('')
  const [snapshotBusy,setSnapshotBusy]=useState(false)
  const [snapshotCounts,setSnapshotCounts]=useState<Record<string,number>>({})
  const [auditRows,setAuditRows]=useState<AuditRow[]>([])
  const [auditBusy,setAuditBusy]=useState(false)
  const [importTable,setImportTable]=useState('students')
  const [importRows,setImportRows]=useState<DataRow[]>([])
  const [importFileName,setImportFileName]=useState('')
  const [importError,setImportError]=useState('')
  const [importBusy,setImportBusy]=useState(false)
  const [importOutcome,setImportOutcome]=useState<{saved:number;failed:number;messages:string[]}|null>(null)
  const [serviceStatus,setServiceStatus]=useState<'unknown'|'checking'|'connected'|'offline'|'error'>('unknown')
  const [validationTable,setValidationTable]=useState('students')
  const [validationRows,setValidationRows]=useState<DataRow[]>([])
  const [validationBusy,setValidationBusy]=useState(false)
  const [validationError,setValidationError]=useState('')
  const [recoveryFileName,setRecoveryFileName]=useState('')
  const [recoveryRows,setRecoveryRows]=useState<DataRow[]>([])
  const [recoveryError,setRecoveryError]=useState('')
  const admin=user?.role==='owner'||user?.role==='admin'
  const currentTitle=titles[view]
  const columns=useMemo(()=>visibleColumns(records),[records])
  const importValidation=useMemo(()=>validateRows(importTable,importRows),[importTable,importRows])
  const validationSummary=useMemo(()=>validateRows(validationTable,validationRows),[validationTable,validationRows])
  const historyRows=useMemo(()=>auditRows.filter(row=>/backup|export|import|restore|snapshot/i.test([row.action,row.module_key,row.record_type].join(' '))),[auditRows])

  async function loadTable(table=selectedTable){
    if(!user)return
    setTableBusy(true);setTableError('')
    try{const result=await listRecords(mode,user,table);setRecords(result as DataRow[])}
    catch(error){const message=userFacingError(error,'The selected dataset could not be loaded.');setTableError(message);setRecords([])}
    finally{setTableBusy(false)}
  }
  async function loadHistory(){
    if(!user)return
    setAuditBusy(true)
    try{const result=await listRecords(mode,user,'institutional_audit_events');setAuditRows(result as AuditRow[])}
    catch(error){setAuditRows([]);onToast(userFacingError(error,'Audit history could not be loaded.'),true)}
    finally{setAuditBusy(false)}
  }
  async function loadDashboardCounts(){
    if(!user)return
    const tables=['students','teachers','campuses','attendance','fee_invoices','fee_payments','exams','institutional_records']
    const entries=await Promise.all(tables.map(async table=>{
      try{return [table,(await listRecords(mode,user,table)).length] as const}
      catch{return [table,-1] as const}
    }))
    setSnapshotCounts(Object.fromEntries(entries))
  }
  useEffect(()=>{
    if(view==='export')void loadTable(selectedTable)
    if(['backup-history','import-history','export-history'].includes(view))void loadHistory()
    if(view==='dashboard')void loadDashboardCounts()
  },[view,user?.id,user?.institutionId,mode])
  useEffect(()=>{
    if(['validation','duplicates','integrity'].includes(view))void loadTable(validationTable)
  },[validationTable])
  async function makeSnapshot(){
    if(!user)return
    setSnapshotBusy(true)
    const selected=dataTables.map(item=>item.key)
    const results=await Promise.all(selected.map(async table=>{
      try{return [table,await listRecords(mode,user,table),null] as const}
      catch(error){return [table,[] as DataRow[],userFacingError(error,'Not available to this account.')] as const}
    }))
    const datasets=Object.fromEntries(results.map(([table,rows])=>[table,rows]))
    const unavailable=results.filter(([, ,error])=>Boolean(error)).map(([table,,error])=>({table,error}))
    const snapshot={
      format:'EduSphere 360 institution data export',
      version:1,
      created_at:new Date().toISOString(),
      institution:{id:user.institutionId,name:user.institutionName??'Institution'},
      scope:'Tenant-scoped rows returned by the signed-in account. This is not a Supabase physical database snapshot.',
      datasets,
      unavailable,
    }
    downloadText('edusphere-institution-data-snapshot-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(snapshot,null,2),'application/json;charset=utf-8')
    setSnapshotBusy(false)
    const count=Object.values(datasets).reduce((sum,rows)=>sum+rows.length,0)
    onToast('Institution export snapshot downloaded with '+count+' records across '+selected.length+' datasets.')
  }
  function exportSelected(format:string){
    const name='gidc-'+selectedTable+'-'+new Date().toISOString().slice(0,10)
    if(format==='csv'){downloadCsv(name+'.csv',records,columns);return}
    if(format==='xlsx'){exportXlsx(name+'.xlsx',tableLabel(selectedTable),records,columns);return}
    if(format==='xls'){exportExcelXml(name+'.xls',tableLabel(selectedTable),records,columns);return}
    if(format==='docx'){exportDocx(name+'.docx',tableLabel(selectedTable),records,columns);return}
    if(format==='doc'){exportWordXml(name+'.doc',tableLabel(selectedTable),records,columns);return}
    if(format==='pdf'){printOfficeReport(tableLabel(selectedTable),records,columns,user?.institutionName??'Institution');return}
    if(format==='json'){downloadText(name+'.json',JSON.stringify(records,null,2),'application/json;charset=utf-8');return}
    if(format==='tsv'){const text=[columns.map(column=>column.label).join('\t'),...records.map(row=>columns.map(column=>String(row[column.key]??'').replace(/[\t\r\n]/g,' ')).join('\t'))].join('\r\n');downloadText(name+'.tsv',text,'text/tab-separated-values;charset=utf-8');return}
    if(format==='copy'){
      void navigator.clipboard.writeText(toCsv(records,columns)).then(()=>onToast('Dataset copied as CSV text.')).catch(()=>onToast('Clipboard access was blocked by the browser.',true))
    }
  }
  async function readFile(event:ChangeEvent<HTMLInputElement>,kind:'import'|'recovery'){
    const file=event.target.files?.[0]
    if(!file)return
    try{
      const source=await file.text()
      const rows=file.name.toLowerCase().endsWith('.json')?parseJsonRows(source,kind==='recovery'?importTable:undefined):parseCsv(source)
      if(!rows.length)throw new Error('No data rows were found. Choose a CSV file with a header row or a JSON array.')
      if(kind==='import'){setImportRows(rows);setImportFileName(file.name);setImportError('');setImportOutcome(null)}
      else{setRecoveryRows(rows);setRecoveryFileName(file.name);setRecoveryError('')}
    }catch(error){
      const message=error instanceof Error?error.message:'The selected file could not be read.'
      if(kind==='import')setImportError(message);else setRecoveryError(message)
    }finally{event.target.value=''}
  }
  async function runImport(){
    if(!user||!importRows.length)return
    const validation=validateRows(importTable,importRows)
    if(validation.missing||validation.duplicates){onToast('Correct missing required fields and duplicate rows before importing.',true);return}
    setImportBusy(true)
    let saved=0,failed=0
    const messages:string[]=[]
    for(let index=0;index<importRows.length;index++){
      const payload=Object.fromEntries(Object.entries(importRows[index]).map(([key,value])=>[normaliseHeader(key),value]).filter(([key])=>!protectedFields.has(String(key))))
      try{await createRecord(mode,user,importTable,payload);saved++}
      catch(error){failed++;if(messages.length<8)messages.push('Row '+(index+2)+': '+userFacingError(error,'Could not be saved.'))}
    }
    setImportOutcome({saved,failed,messages})
    setImportBusy(false)
    onToast('Import finished: '+saved+' saved, '+failed+' failed.',failed>0)
    if(view==='import')setImportRows([])
  }
  async function runRecovery(){
    if(!user||!recoveryRows.length)return
    setImportBusy(true)
    let saved=0,failed=0
    for(const row of recoveryRows){
      const payload=Object.fromEntries(Object.entries(row).map(([key,value])=>[normaliseHeader(key),value]).filter(([key])=>!protectedFields.has(String(key))))
      try{await createRecord(mode,user,importTable,payload);saved++}catch{failed++}
    }
    setImportOutcome({saved,failed,messages:[]})
    setImportBusy(false)
    onToast('Record recovery finished: '+saved+' inserted, '+failed+' not inserted.',failed>0)
  }
  async function checkIntegration(){
    setServiceStatus('checking')
    if(!navigator.onLine){setServiceStatus('offline');return}
    if(!supabase){setServiceStatus('error');return}
    try{const {data,error}=await supabase.auth.getSession();if(error)throw error;setServiceStatus(data.session?'connected':'error')}
    catch{setServiceStatus('error')}
  }
  async function loadValidation(){
    if(!user)return
    setValidationBusy(true);setValidationError('')
    try{setValidationRows(await listRecords(mode,user,validationTable) as DataRow[])}
    catch(error){setValidationRows([]);setValidationError(userFacingError(error,'The dataset could not be checked.'))}
    finally{setValidationBusy(false)}
  }
  useEffect(()=>{if(view==='validation'||view==='duplicates'||view==='integrity')void loadValidation()},[view,validationTable,user?.id,user?.institutionId,mode])
  const duplicateRows=useMemo(()=>{
    const key=validationTable==='students'?'admission_no':validationTable==='teachers'?'email':validationTable==='departments'?'department_code':'name'
    const groups=new Map<string,DataRow[]>()
    validationRows.forEach(row=>{const value=String(row[key]??'').trim().toLowerCase();if(value)groups.set(value,[...(groups.get(value)??[]),row])})
    return [...groups.entries()].filter(([,items])=>items.length>1).map(([value,items])=>({value,items}))
  },[validationTable,validationRows])
  if(!admin)return <div className="bdw-page"><div className="bdw-notice warning">Backup and data management is restricted to the institution owner and authorised administrators.</div></div>

  const refreshButton=<button className="bdw-button secondary" type="button" onClick={()=>view==='dashboard'?void loadDashboardCounts():view.endsWith('history')?void loadHistory():view==='integrations'?void checkIntegration():view==='validation'||view==='duplicates'||view==='integrity'?void loadValidation():void loadTable()}><RefreshCw size={15}/> Refresh</button>
  const showRefresh=['dashboard','backup-history','import-history','export-history','export','validation','duplicates','integrity','integrations'].includes(view)
  const tableOptions=dataTables.map(item=><option key={item.key} value={item.key}>{item.label}</option>)
  const pageHeader=<PageIntro icon={Database} title={currentTitle} description="Institution-scoped data tools for Government Islamia Degree College, Badin." action={showRefresh?refreshButton:undefined}/>
  const historyView=(heading:string,detail:string)=>{
    const rows=historyRows.filter(row=>heading==='Import History'?/import/i.test(String(row.action??'')+' '+String(row.module_key??'')):heading==='Export History'?/export/i.test(String(row.action??'')+' '+String(row.module_key??'')):true)
    return <><div className="bdw-stats"><InfoStat label="Recorded events" value={String(rows.length)} detail="Matching entries in the institution audit feed"/><InfoStat label="Audit feed" value={auditBusy?'Loading':String(auditRows.length)} detail="Server-recorded institutional events"/></div><section className="bdw-panel"><h3>{heading}</h3><p>{detail}</p>{rows.length?<div className="bdw-table-wrap"><table><thead><tr><th>When</th><th>Action</th><th>Module</th><th>Record type</th><th>Actor</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.occurred_at?new Date(row.occurred_at).toLocaleString():'—'}</td><td>{String(row.action??'—')}</td><td>{String(row.module_key??'—')}</td><td>{String(row.record_type??'—')}</td><td>{String(row.actor_id??'—')}</td></tr>)}</tbody></table></div>:<div className="bdw-empty"><History size={20}/><strong>No matching events recorded</strong><span>This list only shows actions already written to the server audit feed. Browser downloads are not falsely added to cloud history.</span></div>}</section></>
  }
  return <main className="bdw-page">
    {pageHeader}
    {view==='dashboard'&&<><div className="bdw-stats">
      <InfoStat label="Student records" value={snapshotCounts.students===undefined?'—':snapshotCounts.students<0?'Unavailable':String(snapshotCounts.students)} detail="Tenant-scoped student rows"/>
      <InfoStat label="Teachers & staff" value={snapshotCounts.teachers===undefined?'—':snapshotCounts.teachers<0?'Unavailable':String(snapshotCounts.teachers)} detail="Tenant-scoped staff rows"/>
      <InfoStat label="Campuses" value={snapshotCounts.campuses===undefined?'—':snapshotCounts.campuses<0?'Unavailable':String(snapshotCounts.campuses)} detail="Registered branches"/>
      <InfoStat label="Attendance rows" value={snapshotCounts.attendance===undefined?'—':snapshotCounts.attendance<0?'Unavailable':String(snapshotCounts.attendance)} detail="Student attendance entries"/>
      <InfoStat label="Fee invoices" value={snapshotCounts.fee_invoices===undefined?'—':snapshotCounts.fee_invoices<0?'Unavailable':String(snapshotCounts.fee_invoices)} detail="Institution invoices"/>
      <InfoStat label="Examinations" value={snapshotCounts.exams===undefined?'—':snapshotCounts.exams<0?'Unavailable':String(snapshotCounts.exams)} detail="Scheduled examination records"/>
    </div><div className="bdw-two-col">
      <section className="bdw-panel"><h3>Institution data export</h3><p>Create a downloadable JSON snapshot of the tenant-scoped records your current account can read.</p><button className="bdw-button primary" type="button" onClick={()=>void makeSnapshot()} disabled={snapshotBusy}>{snapshotBusy?<RefreshCw size={15} className="bdw-spin"/>:<Archive size={15}/>} {snapshotBusy?'Preparing snapshot…':'Create export snapshot'}</button><small className="bdw-footnote">This is a logical export file, not a physical Supabase database backup.</small></section>
      <section className="bdw-panel"><h3>Backup service status</h3><div className="bdw-status-row"><span className="bdw-status-dot warning"/>Cloud backup automation <strong>Not configured</strong></div><div className="bdw-status-row"><span className="bdw-status-dot warning"/>Point-in-time restore <strong>Not connected</strong></div><p>Server-side snapshots, retention and safe restore require a secured backend job and private storage. This dashboard does not claim those services are active.</p><button className="bdw-button secondary" type="button" onClick={()=>setView('schedule')}>Review cloud backup setup</button></section>
    </div><div className="bdw-quick-grid">{(['create','export','import','validation','backup-history','integrations'] as ViewKey[]).map(key=><button className="bdw-quick-card" key={key} type="button" onClick={()=>setView(key)}><span>{titles[key]}</span><small>Open dedicated workspace</small><ArrowDownToLine size={16}/></button>)}</div></>}
    {view==='create'&&<div className="bdw-two-col"><section className="bdw-panel"><h3>Generate a tenant data snapshot</h3><p>Exports all listed datasets available to the signed-in owner or administrator into one JSON file.</p><ul><li>Institution identity and generation timestamp</li><li>One dataset entry per supported institution table</li><li>Unavailable datasets listed with their error</li><li>Rows remain scoped to your institution</li></ul><button className="bdw-button primary" type="button" onClick={()=>void makeSnapshot()} disabled={snapshotBusy}>{snapshotBusy?'Building export…':'Create and download JSON snapshot'}</button></section><section className="bdw-panel"><h3>What this file is — and is not</h3><p><strong>Included:</strong> records returned through the institution’s authorised application access.</p><p><strong>Not included:</strong> Supabase system catalogues, auth internals, storage binaries, database policies, secrets, provider snapshots or transaction logs.</p><div className="bdw-notice warning"><AlertTriangle size={17}/> Store exported files securely. They may contain confidential student, employee and finance information.</div></section></div>}
    {view==='schedule'&&<section className="bdw-panel bdw-schedule-panel"><div className="bdw-service-illustration"><Cloud size={30}/></div><h3>Cloud backup automation is not connected yet</h3><p>A real schedule needs a private storage destination, a server-side scheduled function, encryption, retention rules and an owner-approved restore procedure.</p><div className="bdw-stats"><InfoStat label="Schedule status" value="Not configured" detail="No verified scheduler is connected"/><InfoStat label="Storage destination" value="Not verified" detail="No backup bucket is assumed"/><InfoStat label="Last cloud backup" value="—" detail="No provider job is available"/></div><div className="bdw-checklist"><span><CheckCircle2 size={16}/> Dedicated schedule page ready</span><span><AlertTriangle size={16}/> Secure server-side scheduler required</span><span><AlertTriangle size={16}/> Private backup storage must be provisioned</span><span><AlertTriangle size={16}/> Retention and restore controls need approval</span></div></section>}
    {view==='backup-history'&&historyView('Backup History','Recorded backup and snapshot events, when the server audit feed contains them.')}
    {view==='export-history'&&historyView('Export History','Server-recorded export actions only. Downloads from this browser are not written to the cloud audit log.')}
    {view==='import-history'&&historyView('Import History','Server-recorded import actions only. A successful local import is shown in the result of that import operation, not fabricated here.')}
    {view==='recovery'&&<div className="bdw-two-col"><section className="bdw-panel"><h3>Recover records from a JSON export</h3><p>Select an EduSphere JSON export or an array of records. Choose the destination table, validate the file and insert records that pass current database permissions.</p><label className="bdw-field">Destination dataset<select value={importTable} onChange={e=>setImportTable(e.target.value)}>{importableTables.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label className="bdw-file-input"><Upload size={17}/><span>{recoveryFileName||'Choose a JSON or CSV file'}</span><input type="file" accept=".json,.csv,text/csv,application/json" onChange={e=>void readFile(e,'recovery')}/></label>{recoveryError&&<div className="bdw-notice error">{recoveryError}</div>}<p>{recoveryRows.length} rows ready for recovery</p><button className="bdw-button primary" type="button" disabled={!recoveryRows.length||importBusy} onClick={()=>void runRecovery()}>{importBusy?'Recovering…':'Insert recoverable records'}</button></section><section className="bdw-panel"><h3>Recovery safety</h3><div className="bdw-notice warning"><AlertTriangle size={17}/> This performs row-level inserts only. It does not replace existing data, restore deleted rows with original identifiers, or roll back a live database.</div><p>Every insert passes through the current institution role checks and database row-level security. Rows that violate a constraint are reported as failed, not silently skipped.</p>{importOutcome&&<div className="bdw-result"><strong>{importOutcome.saved} inserted · {importOutcome.failed} not inserted</strong></div>}</section></div>}
    {view==='export'&&<section className="bdw-panel bdw-export-panel"><h3>Export an institution dataset</h3><p>Choose a tenant-scoped dataset, review its rows and download the format you need.</p><div className="bdw-export-controls"><label className="bdw-field">Dataset<select value={selectedTable} onChange={e=>setSelectedTable(e.target.value)}>{tableOptions}</select></label><button className="bdw-button secondary" type="button" onClick={()=>void loadTable()} disabled={tableBusy}><RefreshCw size={14}/> Load records</button></div>{tableError&&<div className="bdw-notice error">{tableError}</div>}<div className="bdw-stats"><InfoStat label="Rows loaded" value={tableBusy?'Loading…':String(records.length)} detail={tableLabel(selectedTable)}/><InfoStat label="Columns detected" value={String(columns.length)} detail="Based on returned data fields"/></div><div className="bdw-format-grid">{[{key:'docx',label:'Word document (.docx)',icon:'Word'},{key:'pdf',label:'Print / Save as PDF',icon:'PDF'},{key:'xlsx',label:'Excel workbook (.xlsx)',icon:'Excel'},{key:'xls',label:'Excel / Sheets (.xls)',icon:'Sheet'},{key:'tsv',label:'Google Sheets (.tsv)',icon:'Sheets'},{key:'csv',label:'CSV (.csv)',icon:'CSV'},{key:'json',label:'JSON data (.json)',icon:'JSON'},{key:'copy',label:'Copy CSV to clipboard',icon:'Copy'}].map(item=><button type="button" className="bdw-format-card" key={item.key} onClick={()=>exportSelected(item.key)} disabled={!records.length||tableBusy}><span>{item.icon}</span><strong>{item.label}</strong><small>Export {records.length} rows</small></button>)}</div>{tableBusy&&<div className="bdw-empty">Loading records for export…</div>}{!tableBusy&&!records.length&&!tableError&&<div className="bdw-empty">Select Load records to prepare this dataset for export.</div>}</section>}
    {view==='import'&&<div className="bdw-two-col"><section className="bdw-panel"><h3>Import a CSV or JSON file</h3><p>Upload a CSV with a header row or a JSON array of records, then review validation before inserting.</p><label className="bdw-field">Destination dataset<select value={importTable} onChange={e=>{setImportTable(e.target.value);setImportOutcome(null)}}>{importableTables.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label className="bdw-file-input"><Upload size={17}/><span>{importFileName||'Choose a CSV or JSON file'}</span><input type="file" accept=".csv,.json,text/csv,application/json" onChange={e=>void readFile(e,'import')}/></label>{importError&&<div className="bdw-notice error">{importError}</div>}<div className="bdw-stats"><InfoStat label="Rows parsed" value={String(importRows.length)} detail="Source data rows"/><InfoStat label="Valid rows" value={String(importValidation.valid)} detail="After basic required/duplicate checks"/><InfoStat label="Rows with issues" value={String(importValidation.missing+importValidation.duplicates)} detail="Correct file issues before saving"/></div><button className="bdw-button primary" type="button" onClick={()=>void runImport()} disabled={!importRows.length||importBusy||importValidation.missing>0||importValidation.duplicates>0}>{importBusy?'Importing records…':'Import valid records'}</button></section><section className="bdw-panel"><h3>Pre-import preview</h3>{importRows.length?<div className="bdw-table-wrap"><table><thead><tr>{visibleColumns(importRows).slice(0,5).map(column=><th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{importRows.slice(0,8).map((row,index)=><tr key={index}>{visibleColumns(importRows).slice(0,5).map(column=><td key={column.key}>{String(row[column.key]??'')}</td>)}</tr>)}</tbody></table></div>:<div className="bdw-empty">Your selected file preview will appear here.</div>}{importOutcome&&<div className="bdw-result"><strong>{importOutcome.saved} saved · {importOutcome.failed} failed</strong>{importOutcome.messages.map(message=><small key={message}>{message}</small>)}</div>}</section></div>}
    {view==='validation'&&<section className="bdw-panel"><div className="bdw-export-controls"><label className="bdw-field">Dataset to validate<select value={validationTable} onChange={e=>setValidationTable(e.target.value)}>{tableOptions}</select></label><button className="bdw-button secondary" type="button" onClick={()=>void loadValidation()} disabled={validationBusy}><RefreshCw size={14}/> Validate now</button></div>{validationError&&<div className="bdw-notice error">{validationError}</div>}<div className="bdw-stats"><InfoStat label="Rows checked" value={String(validationRows.length)} detail={tableLabel(validationTable)}/><InfoStat label="Duplicate identifiers" value={String(duplicateRows.length)} detail="Repeated values in primary business field"/><InfoStat label="Rows missing required fields" value={String(validationSummary.missing)} detail="Basic checks for this dataset type"/></div><div className="bdw-notice success"><ShieldCheck size={17}/> Checks read the institution's current records. Nothing is changed by this report.</div></section>}
    {view==='duplicates'&&<section className="bdw-panel"><div className="bdw-export-controls"><label className="bdw-field">Dataset<select value={validationTable} onChange={e=>setValidationTable(e.target.value)}>{tableOptions}</select></label><button className="bdw-button secondary" type="button" onClick={()=>void loadValidation()} disabled={validationBusy}><RefreshCw size={14}/> Scan duplicates</button></div>{duplicateRows.length?<div className="bdw-table-wrap"><table><thead><tr><th>Repeated value</th><th>Matches</th><th>Record IDs</th></tr></thead><tbody>{duplicateRows.map(group=><tr key={group.value}><td>{group.value}</td><td>{group.items.length}</td><td>{group.items.map(row=>String(row.id??'—')).join(', ')}</td></tr>)}</tbody></table></div>:<div className="bdw-empty"><CheckCircle2 size={21}/><strong>No repeated {validationTable==='students'?'admission numbers':validationTable==='teachers'?'email addresses':'selected identifiers'} found in the loaded dataset.</strong></div>}</section>}
    {view==='integrity'&&<section className="bdw-panel"><h3>Institution data integrity report</h3><p>Read-only checks against the selected dataset.</p><div className="bdw-stats"><InfoStat label="Rows reviewed" value={String(validationRows.length)} detail={tableLabel(validationTable)}/><InfoStat label="Repeated key groups" value={String(duplicateRows.length)} detail="Candidate duplicates requiring human review"/><InfoStat label="Blank rows" value={String(validationRows.filter(row=>Object.values(row).every(value=>value===null||value===undefined||String(value).trim()==='')).length)} detail="No populated fields"/></div>{validationError&&<div className="bdw-notice error">{validationError}</div>}<div className="bdw-notice warning">This report flags candidate issues only. It does not auto-delete duplicates, rewrite student records or alter financial history.</div></section>}
    {view==='integrations'&&<section className="bdw-panel"><h3>Live connection checks</h3><p>Check the browser network state and the authenticated Supabase session used by this workspace.</p><div className="bdw-status-row"><span className={'bdw-status-dot '+(serviceStatus==='connected'?'good':serviceStatus==='error'||serviceStatus==='offline'?'warning':'')}/><strong>Supabase session</strong><span>{serviceStatus==='connected'?'Authenticated':serviceStatus==='checking'?'Checking…':serviceStatus==='offline'?'Browser is offline':serviceStatus==='error'?'Not authenticated / unavailable':'Not checked yet'}</span></div><div className="bdw-status-row"><span className={'bdw-status-dot '+(navigator.onLine?'good':'warning')}/><strong>Browser network</strong><span>{navigator.onLine?'Online':'Offline'}</span></div><div className="bdw-status-row"><span className="bdw-status-dot warning"/><strong>Cloud backup scheduler</strong><span>Not configured</span></div><div className="bdw-status-row"><span className="bdw-status-dot warning"/><strong>Restore service</strong><span>Not configured</span></div><button className="bdw-button secondary" type="button" onClick={()=>void checkIntegration()}><Activity size={15}/> Run connection check</button></section>}
  </main>
}
