import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Activity, ArrowUpRight, BriefcaseBusiness, CalendarCheck, CalendarDays,
  Check, Clock3, Download, Edit3, Eye, FileCheck2, FileText, GraduationCap, History, Printer,
  Plus, RefreshCw, Search, ShieldCheck, Trash2, UserRound, Users, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { createRecord, deleteRecord, listAccounts, listRecords, updateRecord } from '../lib/data'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/userErrors'
import { downloadCsv } from '../lib/csv'
import type { RecordRow } from '../lib/types'
import '../styles/faculty-workspace.css'

interface Props { onToast: (message: string, error?: boolean) => void; onNavigate: (key: string) => void; initialWindow?: string }
type Tab = 'overview'|'registration'|'directory'|'directory-teaching'|'directory-staff'|'profile'|'id-cards'|'departments'|'designations'|'assignments'|'attendance'|'leave'|'workload'|'documents'|'qualifications'|'history'|'reports'
type Kind = 'employee'|'designation'|'assignment'|'attendance'|'leave'|'leaveReview'
type Dialog = { kind: Kind; row: RecordRow|null; values: Record<string,string> }
type Account = { id: string; fullName: string; email: string; role: string }

const adminTabs: {key:Tab;label:string;icon:typeof Users}[] = [
  {key:'overview',label:'Overview',icon:Activity},
  {key:'registration',label:'Employee Registration',icon:Plus},
  {key:'directory',label:'All Employees',icon:Users},
  {key:'directory-teaching',label:'Teachers',icon:GraduationCap},
  {key:'directory-staff',label:'Faculty & Staff',icon:BriefcaseBusiness},
  {key:'profile',label:'Employee Profile',icon:UserRound},
  {key:'id-cards',label:'Employee ID Cards',icon:Printer},
  {key:'departments',label:'Departments',icon:BriefcaseBusiness},
  {key:'designations',label:'Designations',icon:ShieldCheck},
  {key:'assignments',label:'Teaching Assignments',icon:GraduationCap},
  {key:'attendance',label:'Faculty Attendance',icon:CalendarCheck},
  {key:'leave',label:'Leave Management',icon:CalendarDays},
  {key:'workload',label:'Workload & Timetable',icon:Clock3},
  {key:'documents',label:'Documents',icon:FileText},
  {key:'qualifications',label:'Qualifications',icon:FileCheck2},
  {key:'history',label:'Employment History',icon:History},
  {key:'reports',label:'Staff Reports',icon:Download},
]
const staffTabs = [
  {key:'overview',label:'Overview',icon:Activity},
  {key:'profile',label:'My Employee Profile',icon:UserRound},
  {key:'id-cards',label:'My Employee ID Card',icon:Printer},
  {key:'assignments',label:'My Teaching Assignments',icon:GraduationCap},
  {key:'attendance',label:'My Faculty Attendance',icon:CalendarCheck},
  {key:'leave',label:'My Leave Requests',icon:CalendarDays},
  {key:'workload',label:'My Workload & Timetable',icon:Clock3},
  {key:'documents',label:'My Documents',icon:FileText},
  {key:'qualifications',label:'My Qualifications',icon:FileCheck2},
  {key:'history',label:'My Employment History',icon:History},
] as {key:Tab;label:string;icon:typeof Users}[]

const statusOptions = [{label:'Active',value:'active'},{label:'On leave',value:'on_leave'},{label:'Inactive',value:'inactive'}]
const employmentTypes = [{label:'Full-time',value:'full_time'},{label:'Part-time',value:'part_time'},{label:'Contract',value:'contract'},{label:'Temporary',value:'temporary'}]
const documentTypes = [{label:'Contract',value:'contract'},{label:'Identity',value:'identity'},{label:'Qualification',value:'qualification'},{label:'Certificate',value:'certificate'},{label:'Letter',value:'letter'},{label:'Other',value:'other'}]
const days = ['annual','sick','casual','unpaid','maternity','paternity','other']

function value(raw: unknown, fallback='—') { return raw === null || raw === undefined || raw === '' ? fallback : String(raw) }
function label(raw: unknown) { return value(raw).replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase()) }
function dateLabel(raw: unknown) {
  if (!raw) return '—'
  const date = new Date(String(raw) + (String(raw).length === 10 ? 'T00:00:00' : ''))
  return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleDateString()
}
function newEmployeeNumber() { return 'EMP-' + new Date().getFullYear() + '-' + crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase() }
function getDefaults(kind: Kind, row: RecordRow|null, employeeId: string, admin: boolean): Record<string,string> {
  if (row) return Object.fromEntries(Object.entries(row).map(([k,v]) => [k, v === null || v === undefined ? '' : String(v)]))
  if (kind === 'employee') return {employee_no:newEmployeeNumber(),full_name:'',email:'',phone:'',employee_type:'teaching',employment_type:'full_time',employment_status:'active',department_id:'',designation_id:'',joining_date:new Date().toISOString().slice(0,10),contract_end_date:'',work_location:'',emergency_contact:'',user_id:''}
  if (kind === 'designation') return {name:'',code:'',department_id:'',description:'',is_active:'true'}
  if (kind === 'assignment') return {teacher_id:'',subject_id:'',class_id:'',academic_session_id:'',weekly_periods:'0',assignment_type:'teaching',start_date:'',end_date:'',status:'active',notes:''}
  if (kind === 'attendance') return {teacher_id:'',attendance_date:new Date().toISOString().slice(0,10),check_in_time:'',check_out_time:'',status:'present',notes:''}
  if (kind === 'leave') return {teacher_id:admin?'':employeeId,leave_type:'annual',start_date:'',end_date:'',day_count:'1',reason:''}
  return {status:'approved',review_notes:''}
}
function Field({label,children,wide=false}:{label:string;children:ReactNode;wide?:boolean}) {
  return <label className={'staff-field'+(wide?' staff-field-wide':'')}><span>{label}</span>{children}</label>
}
function Status({value:raw}:{value:unknown}) {
  const s=String(raw??'unknown').toLowerCase()
  return <span className={'staff-status staff-status-'+s}>{label(raw)}</span>
}

export function FacultyWorkspace({onToast,onNavigate,initialWindow}:Props) {
  const {user,mode}=useAuth()
  const admin=user!.role==='owner'||user!.role==='admin'
  const [tab,setTab]=useState<Tab>(() => (adminTabs.some(item => item.key === initialWindow) || staffTabs.some(item => item.key === initialWindow) ? initialWindow as Tab : 'overview'))
  const [data,setData]=useState<Record<string,RecordRow[]>>({})
  const [accounts,setAccounts]=useState<Account[]>([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [query,setQuery]=useState('')
  const [statusFilter,setStatusFilter]=useState('all')
  const [employeeId,setEmployeeId]=useState('')
  const [dialog,setDialog]=useState<Dialog|null>(null)
  const [docFile,setDocFile]=useState<File|null>(null)
  const [docType,setDocType]=useState('contract')
  const [docTitle,setDocTitle]=useState('')
  const [docExpiry,setDocExpiry]=useState('')
  const [docNotes,setDocNotes]=useState('')
  const [uploading,setUploading]=useState(false)

  const employees=data.teachers??[]
  const selected=employees.find(r=>r.id===employeeId)??employees[0]??null
  const designations=data.designations??[]
  const departments=data.departments??[]
  const assignments=data.teacher_assignments??[]
  const attendance=data.employee_attendance??[]
  const leaves=data.employee_leave_requests??[]
  const documents=data.staff_documents??[]
  const history=data.employee_history??[]
  const classes=data.classes??[]
  const subjects=data.subjects??[]
  const sessions=data.academic_sessions??[]
  const timetable=data.timetable_entries??[]
  const designationFor=(id:unknown)=>designations.find(r=>r.id===String(id??''))
  const departmentFor=(id:unknown)=>departments.find(r=>r.id===String(id??''))
  const tabs=admin?adminTabs:staffTabs

  async function load(silent=false) {
    if(!silent)setLoading(true)
    const tables=admin
      ? ['teachers','designations','departments','teacher_assignments','employee_attendance','employee_leave_requests','staff_documents','employee_history','classes','subjects','academic_sessions','timetable_entries']
      : ['teachers','designations','teacher_assignments','employee_attendance','employee_leave_requests','staff_documents','employee_history','timetable_entries']
    const next:Record<string,RecordRow[]>={}
    const failed:string[]=[]
    await Promise.all(tables.map(async t=>{try{next[t]=await listRecords(mode,user!,t)}catch{next[t]=[];failed.push(t)}}))
    setData(next)
    if(admin){try{const all=await listAccounts(mode,user!) as Account[];setAccounts(all.filter(a=>a.role==='teacher'))}catch{setAccounts([])}}
    if(!next.teachers?.some(r=>r.id===employeeId)&&next.teachers?.[0])setEmployeeId(next.teachers[0].id)
    if(failed.length&&!silent)onToast('Some staff sections are unavailable to this account. Review the access permissions before using those sections.',true)
    setLoading(false)
  }
  useEffect(()=>{void load()},[user?.id,user?.institutionId,mode])

  const ownRows=(table:string)=> (data[table]??[]).filter(r=>r.teacher_id===selected?.id)
  const ownDocuments=ownRows('staff_documents')
  const ownHistory=ownRows('employee_history')
  const activeAssignments=assignments.filter(r=>r.status==='active')
  const pendingLeaves=leaves.filter(r=>r.status==='pending')

  function open(kind:Kind,row:RecordRow|null=null){setDialog({kind,row,values:getDefaults(kind,row,selected?.id??'',admin)})}
  function setField(k:string,v:string){setDialog(d=>d?{...d,values:{...d.values,[k]:v}}:d)}
  async function saveDialog(e:FormEvent) {
    e.preventDefault(); if(!dialog)return
    setBusy(true)
    try{
      const v=dialog.values
      if(dialog.kind==='employee'){
        if(!v.employee_no.trim()||!v.full_name.trim()||!v.email.trim())throw new Error('Employee number, full name and email are required.')
        const duplicate=employees.find(r=>r.id!==dialog.row?.id&&(String(r.employee_no??'').trim().toLowerCase()===v.employee_no.trim().toLowerCase()||String(r.email??'').trim().toLowerCase()===v.email.trim().toLowerCase()))
        if(duplicate)throw new Error('That employee number or email is already registered in this institution.')
        const account=accounts.find(a=>a.id===v.user_id)
        if(v.user_id&&(!account||account.email.toLowerCase()!==v.email.trim().toLowerCase()))throw new Error('Choose the existing teacher account with the same employee email.')
        const department=departments.find(r=>r.id===v.department_id)
        const p={employee_no:v.employee_no.trim(),full_name:v.full_name.trim(),email:v.email.trim(),phone:v.phone.trim()||null,department:department?.name??null,department_id:v.department_id||null,designation_id:v.designation_id||null,employee_type:v.employee_type,employment_type:v.employment_type,employment_status:v.employment_status,joining_date:v.joining_date||null,contract_end_date:v.contract_end_date||null,work_location:v.work_location.trim()||null,emergency_contact:v.emergency_contact.trim()||null,user_id:v.user_id||null,updated_at:new Date().toISOString()}
        if(dialog.row)await updateRecord(mode,user!,'teachers',dialog.row.id,p);else await createRecord(mode,user!,'teachers',p)
      }else if(dialog.kind==='designation'){
        if(!v.name.trim())throw new Error('Designation name is required.')
        const p={name:v.name.trim(),code:v.code.trim()||null,department_id:v.department_id||null,description:v.description.trim()||null,is_active:v.is_active==='true',updated_at:new Date().toISOString()}
        if(dialog.row)await updateRecord(mode,user!,'designations',dialog.row.id,p);else await createRecord(mode,user!,'designations',p)
      }else if(dialog.kind==='assignment'){
        if(!v.teacher_id||!v.subject_id||!v.class_id||!v.academic_session_id)throw new Error('Select an employee, subject, class and academic session.')
        if(Number(v.weekly_periods)<0)throw new Error('Weekly periods cannot be negative.')
        if(v.start_date&&v.end_date&&v.end_date<v.start_date)throw new Error('Assignment end date cannot precede start date.')
        const p={teacher_id:v.teacher_id,subject_id:v.subject_id,class_id:v.class_id,academic_session_id:v.academic_session_id,weekly_periods:Number(v.weekly_periods),assignment_type:v.assignment_type,start_date:v.start_date||null,end_date:v.end_date||null,status:v.status,notes:v.notes.trim()||null,updated_at:new Date().toISOString()}
        if(dialog.row)await updateRecord(mode,user!,'teacher_assignments',dialog.row.id,p);else await createRecord(mode,user!,'teacher_assignments',p)
      }else if(dialog.kind==='attendance'){
        if(!v.teacher_id||!v.attendance_date)throw new Error('Select an employee and attendance date.')
        if(v.check_in_time&&v.check_out_time&&v.check_out_time<=v.check_in_time)throw new Error('Check-out must be later than check-in.')
        const duplicate=attendance.find(r=>r.id!==dialog.row?.id&&r.teacher_id===v.teacher_id&&r.attendance_date===v.attendance_date)
        if(duplicate)throw new Error('Attendance has already been recorded for this employee on this date.')
        const p={teacher_id:v.teacher_id,attendance_date:v.attendance_date,check_in_time:v.check_in_time||null,check_out_time:v.check_out_time||null,status:v.status,notes:v.notes.trim()||null,updated_at:new Date().toISOString()}
        if(dialog.row)await updateRecord(mode,user!,'employee_attendance',dialog.row.id,p);else await createRecord(mode,user!,'employee_attendance',p)
      }else if(dialog.kind==='leave'){
        if(!v.teacher_id||!v.start_date||!v.end_date||!v.reason.trim())throw new Error('Employee, dates and reason are required.')
        if(v.end_date<v.start_date)throw new Error('Leave end date cannot precede start date.')
        if(!(Number(v.day_count)>0))throw new Error('Leave duration must be greater than zero.')
        await createRecord(mode,user!,'employee_leave_requests',{teacher_id:v.teacher_id,leave_type:v.leave_type,start_date:v.start_date,end_date:v.end_date,day_count:Number(v.day_count),reason:v.reason.trim(),status:'pending',created_by:user!.id})
      }else if(dialog.kind==='leaveReview'&&dialog.row){
        if(!['approved','rejected'].includes(v.status))throw new Error('Choose approve or reject.')
        await updateRecord(mode,user!,'employee_leave_requests',dialog.row.id,{status:v.status,review_notes:v.review_notes.trim()||null,reviewed_by:user!.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()})
      }
      setDialog(null);onToast('Staff record saved successfully.');await load(true)
      if(dialog.kind==='employee'&&!dialog.row)setTab('directory')
    }catch(err){onToast(userFacingError(err,'The staff record could not be saved. Check the fields and try again.'),true)}
    finally{setBusy(false)}
  }
  async function remove(table:string,row:RecordRow){
    if(!window.confirm('Delete this record? This cannot be undone.'))return
    try{await deleteRecord(mode,user!,table,row.id);onToast('Staff record deleted.');await load(true)}
    catch(err){onToast(userFacingError(err,'The staff record could not be deleted.'),true)}
  }

  async function uploadDocument(e:FormEvent){
    e.preventDefault();if(!selected||!docFile||!supabase)return
    if(!docTitle.trim()){onToast('Enter a document title.',true);return}
    if(docFile.size<=0||docFile.size>10*1024*1024){onToast('Staff documents must be 10 MB or smaller.',true);return}
    const allowed=['application/pdf','image/png','image/jpeg','image/webp','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if(!allowed.includes(docFile.type)){onToast('Choose a PDF, image, text, Word or Excel document.',true);return}
    setUploading(true)
    const name=docFile.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)
    const path=user!.institutionId+'/'+selected.id+'/'+crypto.randomUUID()+'-'+name
    try{
      const {error}=await supabase.storage.from('staff-files').upload(path,docFile,{cacheControl:'3600',contentType:docFile.type,upsert:false})
      if(error)throw error
      try{await createRecord(mode,user!,'staff_documents',{teacher_id:selected.id,document_type:docType,title:docTitle.trim(),file_name:docFile.name,storage_path:path,mime_type:docFile.type,file_size:docFile.size,expiry_date:docExpiry||null,notes:docNotes.trim()||null,uploaded_by:user!.id})}
      catch(err){await supabase.storage.from('staff-files').remove([path]);throw err}
      setDocFile(null);setDocTitle('');setDocExpiry('');setDocNotes('');onToast('Confidential staff document uploaded.');await load(true)
    }catch(err){onToast(userFacingError(err,'The staff document could not be uploaded.'),true)}
    finally{setUploading(false)}
  }
  async function viewDocument(row:RecordRow){
    if(!supabase)return
    try{const {data,error}=await supabase.storage.from('staff-files').createSignedUrl(String(row.storage_path),600);if(error||!data?.signedUrl)throw error??new Error('Secure document link unavailable.');window.open(data.signedUrl,'_blank','noopener,noreferrer')}
    catch(err){onToast(userFacingError(err,'The document is unavailable to this account.'),true)}
  }
  async function deleteDocument(row:RecordRow){
    try{await deleteRecord(mode,user!,'staff_documents',row.id);if(supabase)await supabase.storage.from('staff-files').remove([String(row.storage_path)]);onToast('Staff document removed.');await load(true)}
    catch(err){onToast(userFacingError(err,'The staff document could not be removed.'),true)}
  }
  function exportCsv(){downloadCsv('edusphere360-staff-report.csv',employees,[{key:'employee_no',label:'Employee ID'},{key:'full_name',label:'Employee'},{key:'email',label:'Email'},{key:'employee_type',label:'Category'},{key:'department',label:'Department'},{key:'employment_status',label:'Status'},{key:'joining_date',label:'Joining date'}])}

  const table=(rows:RecordRow[],cols:{key:string;label:string}[],empty:string,actions?: (row:RecordRow)=>ReactNode)=>{
    if(!rows.length)return <div className="staff-empty"><span><BriefcaseBusiness size={21}/></span><strong>No records yet</strong><p>{empty}</p></div>
    return <div className="staff-table-wrap"><table className="staff-table"><thead><tr>{cols.map(c=><th key={c.key}>{c.label}</th>)}{actions&&<th>Actions</th>}</tr></thead><tbody>{rows.map(row=><tr key={row.id}>{cols.map(c=><td key={c.key}>{['status','employment_status'].includes(c.key)?<Status value={row[c.key]}/>:c.key.endsWith('_date')||c.key==='created_at'?dateLabel(row[c.key]):value(row[c.key])}</td>)}{actions&&<td><div className="staff-row-actions">{actions(row)}</div></td>}</tr>)}</tbody></table></div>
  }
  const header=<header className="staff-workspace-heading"><div><span className="staff-kicker">PEOPLE / HUMAN RESOURCES</span><h1>Faculty &amp; Employee Management</h1><p>{admin?'Employee records, teaching allocation, attendance, leave, confidential documents and workforce reporting.':'Your employee information, assignments, attendance, leave, documents and history.'}</p></div><div className="staff-heading-actions"><button type="button" className="staff-button staff-button-outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button>{admin&&<button type="button" className="staff-button staff-button-primary" onClick={()=>{setTab('registration');open('employee')}}><Plus size={15}/> Register employee</button>}</div></header>

  const employeeActions=(row:RecordRow)=><><button type="button" title="Open profile" onClick={()=>{setEmployeeId(row.id);setTab('profile')}}><Eye size={14}/></button>{admin&&<button type="button" title="Edit employee" onClick={()=>{setEmployeeId(row.id);open('employee',row)}}><Edit3 size={14}/></button>}{admin&&<button type="button" className="staff-action-danger" title="Delete employee" onClick={()=>void remove('teachers',row)}><Trash2 size={14}/></button>}</>
  const visibleEmployees=useMemo(()=>employees.filter(row=>{const q=query.trim().toLowerCase();const match=!q||[row.employee_no,row.full_name,row.email,row.department].some(v=>String(v??'').toLowerCase().includes(q));const typeMatch=tab==='directory-teaching'?(row.employee_type==='teaching'||!row.employee_type):tab==='directory-staff'?row.employee_type==='non_teaching':true;return match&&typeMatch&&(statusFilter==='all'||String(row.employment_status??'active')===statusFilter)}),[employees,query,statusFilter,tab])
  const ownAssignmentRows=assignments.filter(row=>row.teacher_id===selected?.id)
  const ownAttendanceRows=attendance.filter(row=>row.teacher_id===selected?.id)
  const ownLeaveRows=leaves.filter(row=>row.teacher_id===selected?.id)
  const ownDocRows=documents.filter(row=>row.teacher_id===selected?.id)
  const ownHistoryRows=history.filter(row=>row.teacher_id===selected?.id)
  const thisMonth=attendance.filter(row=>String(row.attendance_date??'').slice(0,7)===new Date().toISOString().slice(0,7))
  const activeStaff=employees.filter(row=>row.employment_status==='active')
  const pendingLeave=leaves.filter(row=>row.status==='pending')
  const activeAllocation=assignments.filter(row=>row.status==='active')

  return <main className="page-content staff-workspace">
    {header}
    <nav className="staff-window-nav" aria-label="Faculty and employee windows">{tabs.map(item=>{const Icon=item.icon;return <button type="button" key={item.key} className={tab===item.key?'active':''} onClick={()=>setTab(item.key)}><Icon size={15}/><span>{item.label}</span></button>})}</nav>
    <div className="staff-context-bar"><div><span>Current window</span><strong>{tabs.find(item=>item.key===tab)?.label??'Overview'}</strong></div><label>Employee record<select value={selected?.id??''} onChange={e=>setEmployeeId(e.target.value)} disabled={employees.length<=1}>{!employees.length&&<option value="">No linked employee record</option>}{employees.map(r=><option key={r.id} value={r.id}>{value(r.full_name)} · {value(r.employee_no)}</option>)}</select></label>{loading&&<span className="staff-loading"><RefreshCw size={13}/> Loading staff records</span>}</div>

    {tab==='overview'&&<>
      <section className="staff-metric-grid">{(admin?[['Employees',employees.length,Users],['Active',activeStaff.length,Activity],['Teaching allocations',activeAllocation.length,GraduationCap],['Pending leave',pendingLeave.length,CalendarDays],['Attendance this month',thisMonth.length,CalendarCheck]]:[['My assignments',ownAssignmentRows.length,GraduationCap],['My attendance',ownAttendanceRows.length,CalendarCheck],['Pending leave',ownLeaveRows.filter(r=>r.status==='pending').length,CalendarDays],['My documents',ownDocRows.length,FileText]]).map(([name,count,Icon])=>{const I=Icon as typeof Users;return <article key={String(name)} className="staff-metric-card"><span><I size={18}/></span><small>{String(name)}</small><strong>{Number(count).toLocaleString()}</strong></article>})}</section>
      <div className="staff-overview-grid"><section className="staff-panel"><header><div><h2>{admin?'Employment status':'My employee record'}</h2><p>{admin?'Current employee lifecycle status.':'Identity and employment summary.'}</p></div></header>{admin?<div className="staff-summary-list">{statusOptions.map(s=><div key={s.value}><span>{s.label}</span><b>{employees.filter(r=>r.employment_status===s.value).length}</b></div>)}</div>:selected?<div className="staff-profile-summary"><strong>{value(selected.full_name)}</strong><span>{value(selected.employee_no)}</span><Status value={selected.employment_status}/><small>{value(departmentFor(selected.department_id)?.name,'Department not assigned')}</small></div>:<div className="staff-empty"><strong>No linked employee record</strong><p>Ask an administrator to link this login to your employee record.</p></div>}</section>
      <section className="staff-panel"><header><div><h2>Recent employment events</h2><p>Audited profile changes from the history register.</p></div><button type="button" onClick={()=>setTab('history')}>Open history</button></header>{table((admin?history:ownHistoryRows).slice(0,5),[{key:'event_type',label:'Event'},{key:'effective_date',label:'Effective date'},{key:'created_at',label:'Recorded'}],'Employee history appears after verified registration or profile changes.')}</section>
      <section className="staff-panel staff-panel-wide"><header><div><h2>Staff operations</h2><p>Open the specific process, rather than a generic employee page.</p></div></header><div className="staff-operation-links">{(admin?[['Register employee','registration',Plus],['Manage designations','designations',ShieldCheck],['Teaching allocations','assignments',GraduationCap],['Faculty attendance','attendance',CalendarCheck],['Review leave','leave',CalendarDays],['Staff reports','reports',Download]]:[['My profile','profile',UserRound],['My assignments','assignments',GraduationCap],['Submit leave','leave',CalendarDays],['My documents','documents',FileText]]).map(([txt,key,Icon])=>{const I=Icon as typeof Users;return <button type="button" key={String(key)} onClick={()=>setTab(key as Tab)}><I size={16}/><span>{String(txt)}</span></button>})}</div></section></div>
    </>}

    {tab==='registration'&&admin&&<section className="staff-panel staff-full-panel"><header><div><h2>Employee registration</h2><p>Create a staff identity, employment details and optional link to an existing teacher account.</p></div><button type="button" className="staff-button staff-button-primary" onClick={()=>open('employee')}><Plus size={15}/> New employee</button></header><div className="staff-process-grid"><article><b>01 · Identity</b><p>Employee ID, name, email, phone and teaching/non-teaching category.</p></article><article><b>02 · Employment</b><p>Department, designation, type, joining date, contract and status.</p></article><article><b>03 · Account link</b><p>Link an existing teacher login; account creation remains in User Account.</p></article><article><b>04 · History</b><p>Registration and later profile changes are audited by the database.</p></article></div><p className="staff-note">This workspace extends the existing teachers record. It does not create a duplicate employees identity or generate a password.</p></section>}

    {['directory','directory-teaching','directory-staff'].includes(tab)&&admin&&<section className="staff-panel staff-full-panel"><header><div><h2>Employee directory</h2><p>Institution-wide employee register with status filters and profile actions.</p></div><span className="staff-record-count">{visibleEmployees.length} employees</span></header><div className="staff-toolbar"><label><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search employee ID, name, email or department…"/></label><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option>{statusOptions.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select></div>{table(visibleEmployees,[{key:'employee_no',label:'Employee ID'},{key:'full_name',label:'Employee'},{key:'employee_type',label:'Category'},{key:'department',label:'Department'},{key:'employment_status',label:'Status'},{key:'joining_date',label:'Joining date'}],'Register employees to populate the directory.',employeeActions)}</section>}

    {tab==='profile'&&<section className="staff-panel staff-full-panel"><header><div><h2>Employee profile</h2><p>Personal, employment and institutional assignment information.</p></div>{admin&&selected&&<button type="button" className="staff-button staff-button-outline" onClick={()=>open('employee',selected)}><Edit3 size={14}/> Edit profile</button>}</header>{selected?<div className="staff-profile-grid"><article><span>Employee identity</span><h3>{value(selected.full_name)}</h3><dl><div><dt>Employee number</dt><dd>{value(selected.employee_no)}</dd></div><div><dt>Email</dt><dd>{value(selected.email)}</dd></div><div><dt>Phone</dt><dd>{value(selected.phone)}</dd></div><div><dt>Category</dt><dd>{label(selected.employee_type)}</dd></div></dl></article><article><span>Employment</span><h3>{label(selected.employment_status)}</h3><dl><div><dt>Type</dt><dd>{label(selected.employment_type)}</dd></div><div><dt>Department</dt><dd>{value(departmentFor(selected.department_id)?.name??selected.department)}</dd></div><div><dt>Designation</dt><dd>{value(designationFor(selected.designation_id)?.name)}</dd></div><div><dt>Joining date</dt><dd>{dateLabel(selected.joining_date)}</dd></div><div><dt>Contract end</dt><dd>{dateLabel(selected.contract_end_date)}</dd></div><div><dt>Work location</dt><dd>{value(selected.work_location)}</dd></div></dl></article><article><span>Emergency contact</span><h3>Contact details</h3><dl><div><dt>Emergency contact</dt><dd>{value(selected.emergency_contact)}</dd></div><div><dt>Department ID</dt><dd>{value(selected.department_id)}</dd></div><div><dt>Designation ID</dt><dd>{value(selected.designation_id)}</dd></div></dl></article></div>:<div className="staff-empty"><strong>No employee record linked</strong><p>An administrator must link this teacher login to a staff record.</p></div>}</section>}

    {tab==='id-cards'&&<section className="staff-panel staff-full-panel staff-id-card-workspace"><header><div><h2>{admin?'Employee identity card':'My employee identity card'}</h2><p>Print a card from the selected verified staff record. This does not create a new account or change employment data.</p></div>{selected&&<button type="button" className="staff-button staff-button-primary" onClick={()=>window.print()}><Printer size={14}/> Print ID card</button>}</header>{selected?<div className="staff-id-card-print"><div className="staff-id-card-brand"><div><strong>{user?.institutionName??'EduSphere 360 Institution'}</strong><small>EMPLOYEE IDENTITY CARD</small></div><span>STAFF</span></div><div className="staff-id-card-body"><div className="staff-id-card-avatar">{String(selected.full_name??'E').trim().slice(0,1).toUpperCase()}</div><div><strong>{value(selected.full_name)}</strong><small>Employee No. {value(selected.employee_no)}</small><small>{value(designationFor(selected.designation_id)?.name,'Staff member')}</small><small>{value(departmentFor(selected.department_id)?.name??selected.department,'Department not assigned')}</small><small>Joined: {dateLabel(selected.joining_date)}</small></div></div><div className="staff-id-card-footer"><span>{user?.institutionName??'Institution'}</span><b>{String(selected.id).slice(0,8).toUpperCase()}</b></div></div>:<div className="staff-empty"><strong>No employee record linked</strong><p>Select an employee from the record selector or ask an administrator to link this staff account.</p></div>}<p className="staff-id-card-note">Confirm the employee name, number and department before printing. The ID card displays only the selected staff record.</p></section>}

    {tab==='departments'&&admin&&<section className="staff-panel staff-full-panel"><header><div><h2>Department staffing</h2><p>Employee distribution across the existing Institute Administration departments. Department creation remains in the canonical administration workspace.</p></div><button type="button" className="staff-button staff-button-outline" onClick={()=>onNavigate('admin:departments')}>Manage departments <ArrowUpRight size={14}/></button></header>{table(departments.map(d=>({...d,staff_count:employees.filter(e=>e.department_id===d.id).length,active_count:employees.filter(e=>e.department_id===d.id&&e.employment_status==='active').length})),[{key:'department_code',label:'Code'},{key:'name',label:'Department'},{key:'head_name',label:'Department head'},{key:'staff_count',label:'Employees'},{key:'active_count',label:'Active'}],'Create departments in Institute Administration, then assign employees here.')}</section>}

    {tab==='designations'&&admin&&<section className="staff-panel staff-full-panel"><header><div><h2>Designation register</h2><p>Job titles are managed separately from departments.</p></div><button type="button" className="staff-button staff-button-primary" onClick={()=>open('designation')}><Plus size={15}/> Add designation</button></header>{table(designations.map(d=>({...d,department_label:departmentFor(d.department_id)?.name??'—',assigned_count:employees.filter(e=>e.designation_id===d.id).length})),[{key:'code',label:'Code'},{key:'name',label:'Designation'},{key:'department_label',label:'Department'},{key:'assigned_count',label:'Employees'},{key:'is_active',label:'Active'}],'Add institution designations such as Principal, Lecturer, Lab Assistant or Accounts Officer.',row=><><button type="button" title="Edit designation" onClick={()=>open('designation',row)}><Edit3 size={14}/></button><button type="button" title="Delete designation" className="staff-action-danger" disabled={employees.some(e=>e.designation_id===row.id)} onClick={()=>void remove('designations',row)}><Trash2 size={14}/></button></>)}</section>}

    {tab==='assignments'&&<section className="staff-panel staff-full-panel"><header><div><h2>{admin?'Teaching assignments':'My teaching assignments'}</h2><p>Subject, class, academic session, effective dates and weekly workload.</p></div>{admin&&<button type="button" className="staff-button staff-button-primary" onClick={()=>open('assignment')}><Plus size={15}/> Allocate teaching</button>}</header>{table((admin?assignments:ownAssignmentRows).map(r=>({...r,teacher_label:employees.find(e=>e.id===r.teacher_id)?.full_name??'—',subject_label:subjects.find(s=>s.id===r.subject_id)?.name??'—',class_label:classes.find(c=>c.id===r.class_id)?.name??'—',session_label:sessions.find(s=>s.id===r.academic_session_id)?.session_name??sessions.find(s=>s.id===r.academic_session_id)?.name??'—'})),[{key:'teacher_label',label:'Employee'},{key:'subject_label',label:'Subject'},{key:'class_label',label:'Class'},{key:'session_label',label:'Session'},{key:'weekly_periods',label:'Periods / week'},{key:'status',label:'Status'}],'No teaching allocation has been configured.',admin?row=><><button type="button" title="Edit allocation" onClick={()=>open('assignment',row)}><Edit3 size={14}/></button><button type="button" className="staff-action-danger" title="Delete allocation" onClick={()=>void remove('teacher_assignments',row)}><Trash2 size={14}/></button></>:undefined)}</section>}

    {tab==='attendance'&&<section className="staff-panel staff-full-panel"><header><div><h2>{admin?'Faculty attendance register':'My faculty attendance'}</h2><p>Employee attendance is stored separately from student attendance.</p></div>{admin&&<button type="button" className="staff-button staff-button-primary" onClick={()=>open('attendance')}><Plus size={15}/> Record attendance</button>}</header>{table((admin?attendance:ownAttendanceRows).map(r=>({...r,employee_label:employees.find(e=>e.id===r.teacher_id)?.full_name??'—'})),[{key:'employee_label',label:'Employee'},{key:'attendance_date',label:'Date'},{key:'check_in_time',label:'Check in'},{key:'check_out_time',label:'Check out'},{key:'status',label:'Status'},{key:'notes',label:'Notes'}],'No faculty attendance has been recorded.',admin?row=><><button type="button" title="Edit attendance" onClick={()=>open('attendance',row)}><Edit3 size={14}/></button><button type="button" className="staff-action-danger" title="Delete attendance" onClick={()=>void remove('employee_attendance',row)}><Trash2 size={14}/></button></>:undefined)}</section>}

    {tab==='leave'&&<section className="staff-panel staff-full-panel"><header><div><h2>{admin?'Leave management':'My leave requests'}</h2><p>{admin?'Review requests with a recorded approval or rejection decision.':'Submit a request and monitor its institution review status.'}</p></div><button type="button" className="staff-button staff-button-primary" onClick={()=>open('leave')}><Plus size={15}/> {admin?'Create leave record':'Submit leave request'}</button></header>{table((admin?leaves:ownLeaveRows).map(r=>({...r,employee_label:employees.find(e=>e.id===r.teacher_id)?.full_name??'—'})),[{key:'employee_label',label:'Employee'},{key:'leave_type',label:'Type'},{key:'start_date',label:'From'},{key:'end_date',label:'To'},{key:'day_count',label:'Days'},{key:'status',label:'Status'},{key:'reason',label:'Reason'}],'No leave requests have been submitted.',admin?row=><><button type="button" title="Review pending request" disabled={row.status!=='pending'} onClick={()=>open('leaveReview',row)}><Check size={14}/></button><button type="button" className="staff-action-danger" title="Delete leave record" onClick={()=>void remove('employee_leave_requests',row)}><Trash2 size={14}/></button></>:row=>row.status==='pending'?<button type="button" title="Cancel pending request" onClick={()=>void updateRecord(mode,user!,'employee_leave_requests',row.id,{status:'cancelled',updated_at:new Date().toISOString()}).then(()=>load(true)).catch(e=>onToast(userFacingError(e,'The leave request could not be cancelled.'),true))}><X size={14}/></button>:null)}</section>}

    {tab==='workload'&&<section className="staff-panel staff-full-panel"><header><div><h2>{admin?'Workload & timetable':'My workload & timetable'}</h2><p>Teaching allocations show expected periods; actual class slots remain in Academic Management.</p></div><button type="button" className="staff-button staff-button-outline" onClick={()=>onNavigate('timetable')}>Open Academic Timetable <CalendarDays size={14}/></button></header>{table((admin?assignments:ownAssignmentRows).map(r=>({...r,subject_label:subjects.find(s=>s.id===r.subject_id)?.name??'—',class_label:classes.find(c=>c.id===r.class_id)?.name??'—',session_label:sessions.find(s=>s.id===r.academic_session_id)?.session_name??'—'})),[{key:'subject_label',label:'Subject'},{key:'class_label',label:'Class'},{key:'session_label',label:'Session'},{key:'weekly_periods',label:'Expected periods / week'},{key:'status',label:'Status'}],'Teaching allocations define workload for each session.')}<h3 className="staff-subheading">Timetable entries</h3>{table((admin?timetable:timetable.filter(r=>String(r.teacher_name??'').toLowerCase()===String(selected?.full_name??'').toLowerCase())),[{key:'weekday',label:'Day'},{key:'start_time',label:'Start'},{key:'end_time',label:'End'},{key:'class_name',label:'Class'},{key:'subject',label:'Subject'},{key:'room',label:'Room'}],'No timetable entries are currently linked to this employee.')}</section>}

    {tab==='qualifications'&&<EmployeeQualificationsPanel employeeId={selected?.id??''} institutionId={user!.institutionId} canManage={admin} onToast={onToast}/>}
    {tab==='documents'&&<section className="staff-panel staff-full-panel"><header><div><h2>{admin?'Confidential staff documents':'My confidential documents'}</h2><p>Stored in the separate private staff-files bucket, not the general institution file store.</p></div></header>{selected&&(admin||selected.user_id===user!.id)&&<form className="staff-document-form" onSubmit={uploadDocument}><label>Document type<select value={docType} onChange={e=>setDocType(e.target.value)}>{documentTypes.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}</select></label><label>Title<input value={docTitle} onChange={e=>setDocTitle(e.target.value)} placeholder="Employment contract, qualification certificate…" required/></label><label>Expiry date<input type="date" value={docExpiry} onChange={e=>setDocExpiry(e.target.value)}/></label><label>File<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,.xls,.xlsx" onChange={e=>setDocFile(e.target.files?.[0]??null)} required/></label><label>Notes<input value={docNotes} onChange={e=>setDocNotes(e.target.value)} placeholder="Optional notes"/></label><button className="staff-button staff-button-primary" type="submit" disabled={!docFile||uploading}>{uploading?'Uploading…':'Upload confidential document'}</button></form>}{table((admin?documents:ownDocuments).map(r=>({...r,employee_label:employees.find(e=>e.id===r.teacher_id)?.full_name??'—'})),[{key:'employee_label',label:'Employee'},{key:'document_type',label:'Type'},{key:'title',label:'Title'},{key:'file_name',label:'File'},{key:'expiry_date',label:'Expiry'},{key:'created_at',label:'Uploaded'}],'No confidential staff documents have been uploaded.',row=><><button type="button" title="Open secure document" onClick={()=>void viewDocument(row)}><Eye size={14}/></button>{admin&&<button type="button" className="staff-action-danger" title="Delete document" onClick={()=>void deleteDocument(row)}><Trash2 size={14}/></button>}</>)}</section>}

    {tab==='history'&&<section className="staff-panel staff-full-panel"><header><div><h2>{admin?'Employment history':'My employment history'}</h2><p>Database-audited employee registration and employment profile changes.</p></div></header>{table((admin?history:ownHistory).map(r=>({...r,employee_label:employees.find(e=>e.id===r.teacher_id)?.full_name??'Employee record',event_label:r.event_type==='employee_registered'?'Employee registered':'Employment profile updated'})),[{key:'employee_label',label:'Employee'},{key:'event_label',label:'Event'},{key:'effective_date',label:'Effective date'},{key:'created_at',label:'Recorded at'}],'Employment history is created by database audit triggers after registration and profile changes.')}</section>}

    {tab==='reports'&&admin&&<section className="staff-panel staff-full-panel"><header><div><h2>Staff reports</h2><p>Current institution workforce and HR operation summaries.</p></div><button type="button" className="staff-button staff-button-outline" onClick={exportCsv}><Download size={14}/> Export employee CSV</button></header><div className="staff-report-grid">{[['Teaching employees',employees.filter(r=>r.employee_type==='teaching').length],['Non-teaching employees',employees.filter(r=>r.employee_type==='non_teaching').length],['Active teaching allocations',activeAssignments.length],['Pending leave reviews',pendingLeaves.length],['Attendance this month',thisMonth.length],['Staff documents',documents.length]].map(([k,v])=><article key={String(k)}><small>{String(k)}</small><strong>{Number(v).toLocaleString()}</strong></article>)}</div><h3 className="staff-subheading">Employee distribution by department</h3>{table(departments.map(d=>({...d,staff_count:employees.filter(e=>e.department_id===d.id).length})),[{key:'name',label:'Department'},{key:'staff_count',label:'Employees'}],'No department staffing figures are available yet.')}</section>}

    {dialog&&<div className="staff-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setDialog(null)}}><form className="staff-dialog" onSubmit={saveDialog}><header><div><h2>{dialog.kind==='employee'?(dialog.row?'Edit employee':'Register employee'):dialog.kind==='designation'?(dialog.row?'Edit designation':'Add designation'):dialog.kind==='assignment'?(dialog.row?'Edit teaching allocation':'Create teaching allocation'):dialog.kind==='attendance'?(dialog.row?'Edit faculty attendance':'Record faculty attendance'):dialog.kind==='leave'?'Submit leave request':'Review leave request'}</h2><p>Validated against existing institution staff, department and academic records.</p></div><button type="button" onClick={()=>setDialog(null)}><X size={17}/></button></header><div className="staff-form-grid">
      {dialog.kind==='employee'&&<>
        <Field label="Employee number"><input value={dialog.values.employee_no??''} onChange={e=>setField('employee_no',e.target.value)} required/></Field>
        <Field label="Full name"><input value={dialog.values.full_name??''} onChange={e=>setField('full_name',e.target.value)} required/></Field>
        <Field label="Email"><input type="email" value={dialog.values.email??''} onChange={e=>setField('email',e.target.value)} required/></Field>
        <Field label="Phone"><input value={dialog.values.phone??''} onChange={e=>setField('phone',e.target.value)}/></Field>
        <Field label="Employee category"><select value={dialog.values.employee_type??'teaching'} onChange={e=>setField('employee_type',e.target.value)}><option value="teaching">Teaching</option><option value="non_teaching">Non-teaching</option></select></Field>
        <Field label="Employment type"><select value={dialog.values.employment_type??'full_time'} onChange={e=>setField('employment_type',e.target.value)}>{employmentTypes.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></Field>
        <Field label="Department"><select value={dialog.values.department_id??''} onChange={e=>setField('department_id',e.target.value)}><option value="">Not assigned</option>{departments.map(r=><option key={r.id} value={r.id}>{value(r.name)}</option>)}</select></Field>
        <Field label="Designation"><select value={dialog.values.designation_id??''} onChange={e=>setField('designation_id',e.target.value)}><option value="">Not assigned</option>{designations.filter(r=>r.is_active!==false).map(r=><option key={r.id} value={r.id}>{value(r.name)}</option>)}</select></Field>
        <Field label="Joining date"><input type="date" value={dialog.values.joining_date??''} onChange={e=>setField('joining_date',e.target.value)}/></Field>
        <Field label="Contract end date"><input type="date" value={dialog.values.contract_end_date??''} onChange={e=>setField('contract_end_date',e.target.value)}/></Field>
        <Field label="Status"><select value={dialog.values.employment_status??'active'} onChange={e=>setField('employment_status',e.target.value)}>{statusOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></Field>
        <Field label="Work location"><input value={dialog.values.work_location??''} onChange={e=>setField('work_location',e.target.value)}/></Field>
        <Field label="Emergency contact"><input value={dialog.values.emergency_contact??''} onChange={e=>setField('emergency_contact',e.target.value)}/></Field>
        <Field label="Link existing teacher account" wide><select value={dialog.values.user_id??''} onChange={e=>setField('user_id',e.target.value)}><option value="">No account linked</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.fullName} · {a.email}</option>)}</select></Field>
      </>}
      {dialog.kind==='designation'&&<>
        <Field label="Designation name"><input value={dialog.values.name??''} onChange={e=>setField('name',e.target.value)} required/></Field>
        <Field label="Code"><input value={dialog.values.code??''} onChange={e=>setField('code',e.target.value)}/></Field>
        <Field label="Department"><select value={dialog.values.department_id??''} onChange={e=>setField('department_id',e.target.value)}><option value="">All / not specified</option>{departments.map(r=><option key={r.id} value={r.id}>{value(r.name)}</option>)}</select></Field>
        <Field label="Status"><select value={dialog.values.is_active??'true'} onChange={e=>setField('is_active',e.target.value)}><option value="true">Active</option><option value="false">Inactive</option></select></Field>
        <Field label="Description" wide><textarea value={dialog.values.description??''} onChange={e=>setField('description',e.target.value)}/></Field>
      </>}
      {dialog.kind==='assignment'&&<>
        <Field label="Employee"><select value={dialog.values.teacher_id??''} onChange={e=>setField('teacher_id',e.target.value)} required><option value="">Select employee</option>{employees.filter(r=>r.employee_type==='teaching'&&r.employment_status==='active').map(r=><option key={r.id} value={r.id}>{value(r.full_name)} · {value(r.employee_no)}</option>)}</select></Field>
        <Field label="Subject"><select value={dialog.values.subject_id??''} onChange={e=>setField('subject_id',e.target.value)} required><option value="">Select subject</option>{subjects.map(r=><option key={r.id} value={r.id}>{value(r.name)}</option>)}</select></Field>
        <Field label="Class"><select value={dialog.values.class_id??''} onChange={e=>setField('class_id',e.target.value)} required><option value="">Select class</option>{classes.map(r=><option key={r.id} value={r.id}>{value(r.name)} · {value(r.section,'No section')}</option>)}</select></Field>
        <Field label="Academic session"><select value={dialog.values.academic_session_id??''} onChange={e=>setField('academic_session_id',e.target.value)} required><option value="">Select session</option>{sessions.map(r=><option key={r.id} value={r.id}>{value(r.session_name??r.name)}</option>)}</select></Field>
        <Field label="Periods per week"><input type="number" min="0" value={dialog.values.weekly_periods??'0'} onChange={e=>setField('weekly_periods',e.target.value)}/></Field>
        <Field label="Assignment type"><select value={dialog.values.assignment_type??'teaching'} onChange={e=>setField('assignment_type',e.target.value)}><option value="teaching">Teaching</option><option value="homeroom">Homeroom</option><option value="substitution">Substitution</option><option value="coordination">Coordination</option></select></Field>
        <Field label="Start date"><input type="date" value={dialog.values.start_date??''} onChange={e=>setField('start_date',e.target.value)}/></Field>
        <Field label="End date"><input type="date" value={dialog.values.end_date??''} onChange={e=>setField('end_date',e.target.value)}/></Field>
        <Field label="Status"><select value={dialog.values.status??'active'} onChange={e=>setField('status',e.target.value)}><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></Field>
        <Field label="Notes" wide><textarea value={dialog.values.notes??''} onChange={e=>setField('notes',e.target.value)}/></Field>
      </>}
      {dialog.kind==='attendance'&&<>
        <Field label="Employee"><select value={dialog.values.teacher_id??''} onChange={e=>setField('teacher_id',e.target.value)} required><option value="">Select employee</option>{employees.map(r=><option key={r.id} value={r.id}>{value(r.full_name)} · {value(r.employee_no)}</option>)}</select></Field>
        <Field label="Date"><input type="date" value={dialog.values.attendance_date??''} onChange={e=>setField('attendance_date',e.target.value)} required/></Field>
        <Field label="Check-in"><input type="time" value={dialog.values.check_in_time??''} onChange={e=>setField('check_in_time',e.target.value)}/></Field>
        <Field label="Check-out"><input type="time" value={dialog.values.check_out_time??''} onChange={e=>setField('check_out_time',e.target.value)}/></Field>
        <Field label="Status"><select value={dialog.values.status??'present'} onChange={e=>setField('status',e.target.value)}>{['present','absent','late','excused','remote','half_day'].map(v=><option key={v} value={v}>{label(v)}</option>)}</select></Field>
        <Field label="Notes" wide><textarea value={dialog.values.notes??''} onChange={e=>setField('notes',e.target.value)}/></Field>
      </>}
      {dialog.kind==='leave'&&<>
        {admin&&<Field label="Employee"><select value={dialog.values.teacher_id??''} onChange={e=>setField('teacher_id',e.target.value)} required><option value="">Select employee</option>{employees.map(r=><option key={r.id} value={r.id}>{value(r.full_name)} · {value(r.employee_no)}</option>)}</select></Field>}
        <Field label="Leave type"><select value={dialog.values.leave_type??'annual'} onChange={e=>setField('leave_type',e.target.value)}>{days.map(v=><option key={v} value={v}>{label(v)}</option>)}</select></Field>
        <Field label="Start date"><input type="date" value={dialog.values.start_date??''} onChange={e=>setField('start_date',e.target.value)} required/></Field>
        <Field label="End date"><input type="date" value={dialog.values.end_date??''} onChange={e=>setField('end_date',e.target.value)} required/></Field>
        <Field label="Leave days"><input type="number" min="0.5" step="0.5" value={dialog.values.day_count??'1'} onChange={e=>setField('day_count',e.target.value)} required/></Field>
        <Field label="Reason" wide><textarea value={dialog.values.reason??''} onChange={e=>setField('reason',e.target.value)} required/></Field>
      </>}
      {dialog.kind==='leaveReview'&&<><Field label="Decision"><select value={dialog.values.status??'approved'} onChange={e=>setField('status',e.target.value)}><option value="approved">Approve</option><option value="rejected">Reject</option></select></Field><Field label="Review notes" wide><textarea value={dialog.values.review_notes??''} onChange={e=>setField('review_notes',e.target.value)}/></Field></>}
    </div><footer><button type="button" className="staff-button staff-button-outline" onClick={()=>setDialog(null)} disabled={busy}>Cancel</button><button type="submit" className="staff-button staff-button-primary" disabled={busy}>{busy?'Saving…':'Save record'}</button></footer></form></div>}
  </main>
}
