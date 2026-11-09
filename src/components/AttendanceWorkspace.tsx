import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Activity, CalendarCheck, Check, Download, Fingerprint, RefreshCw, Search, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { downloadCsv } from '../lib/csv'
import type { RecordRow } from '../lib/types'

type AttendanceMark='present'|'absent'|'late'
type Person={id:string;full_name:string;admission_no?:string|null;employee_no?:string|null;class_name?:string|null;employment_status?:string|null}
type AttendanceEntry={id?:string;student_id?:string;teacher_id?:string;status:string;notes?:string|null;attendance_date:string;period_label?:string}
type Props={initialWindow?:string;onToast:(message:string,error?:boolean)=>void}
const today=()=>new Date().toLocaleDateString('en-CA')
const statusLabel=(value:string)=>value==='present'?'P':value==='absent'?'A':value==='late'?'L':'—'

export function AttendanceWorkspace({initialWindow='students',onToast}:Props){
 const {user}=useAuth()
 const [population,setPopulation]=useState<'students'|'staff'>(initialWindow==='staff'?'staff':'students')
 const [date,setDate]=useState(today())
 const [period,setPeriod]=useState('Daily')
 const [className,setClassName]=useState('')
 const [search,setSearch]=useState('')
 const [students,setStudents]=useState<Person[]>([])
 const [staff,setStaff]=useState<Person[]>([])
 const [marks,setMarks]=useState<Record<string,AttendanceMark>>({})
 const [notes,setNotes]=useState<Record<string,string>>({})
 const [existing,setExisting]=useState<AttendanceEntry[]>([])
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [loadingError,setLoadingError]=useState('')
 const [lastSaved,setLastSaved]=useState('')
 const [autoTab,setAutoTab]=useState<'register'|'history'|'devices'>('register')
 const [devices,setDevices]=useState<RecordRow[]>([])
 const [deviceName,setDeviceName]=useState('')
 const [deviceType,setDeviceType]=useState('qr')
 const [deviceId,setDeviceId]=useState('')
 const [showDeviceForm,setShowDeviceForm]=useState(false)
 const canManageStudents=Boolean(user&&['owner','admin','teacher'].includes(user.role))
 const canManageStaff=Boolean(user&&['owner','admin'].includes(user.role))
 const people=population==='students'?students:staff
 const classes=useMemo(()=>[...new Set(students.map(s=>s.class_name).filter((x):x is string=>Boolean(x)))].sort(),[students])
 const visiblePeople=useMemo(()=>people.filter(p=>{
  const q=search.trim().toLowerCase()
  return !q||p.full_name.toLowerCase().includes(q)||String(p.admission_no??p.employee_no??'').toLowerCase().includes(q)
 }),[people,search])
 const stats=useMemo(()=>Object.values(marks).reduce((acc,status)=>{acc[status]+=1;return acc},{present:0,absent:0,late:0}),[marks])
 const readOnly=population==='students'?!canManageStudents:!canManageStaff

 const loadRoster=useCallback(async()=>{
  if(!supabase||!user){setLoading(false);return}
  setLoading(true);setLoadingError('')
  try{
   const [studentResult,staffResult]=await Promise.all([
    supabase.from('students').select('id,full_name,admission_no,class_name,status').eq('institution_id',user.institutionId).eq('status','active').order('class_name').order('full_name'),
    supabase.from('teachers').select('id,full_name,employee_no,employment_status').eq('institution_id',user.institutionId).eq('employment_status','active').order('full_name')
   ])
   if(studentResult.error && population==='students')throw studentResult.error
   if(staffResult.error && population==='staff' && canManageStaff)throw staffResult.error
   setStudents((studentResult.data??[]) as Person[])
   setStaff((staffResult.data??[]) as Person[])
  }catch(error){setLoadingError(error instanceof Error?error.message:'The roster could not be loaded.');setStudents([]);setStaff([])}
  finally{setLoading(false)}
 },[user?.id,user?.institutionId,population,canManageStaff])

 const loadAttendance=useCallback(async()=>{
  if(!supabase||!user)return
  const table=population==='students'?'attendance':'employee_attendance'
  try{
   let query=supabase.from(table).select('*').eq('institution_id',user.institutionId).eq('attendance_date',date)
   if(population==='students'&&className)query=query.eq('class_name',className)
   if(population==='students')query=query.eq('period_label',period)
   const {data,error}=await query.order(population==='students'?'student_name':'created_at')
   if(error)throw error
   const values=(data??[]) as AttendanceEntry[]
   setExisting(values)
   const initial:Record<string,AttendanceMark>={}
   const noteMap:Record<string,string>={}
   values.forEach(row=>{
    const id=population==='students'?row.student_id:row.teacher_id
    if(id&&['present','absent','late'].includes(row.status))initial[id]=row.status as AttendanceMark
    if(id&&row.notes)noteMap[id]=row.notes
   })
   setMarks(initial);setNotes(noteMap)
  }catch(error){setExisting([]);setMarks({});setNotes({});setLoadingError(error instanceof Error?error.message:'Attendance could not be loaded.')}
 },[user?.id,user?.institutionId,population,date,className,period])

 const loadDevices=useCallback(async()=>{
  if(!supabase||!user)return
  const {data,error}=await supabase.from('attendance_device_sources').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false})
  if(error){setLoadingError(error.message);return}
  setDevices((data??[]) as RecordRow[])
 },[user?.id,user?.institutionId])

 useEffect(()=>{void loadRoster()},[loadRoster])
 useEffect(()=>{if(!readOnly && population==='students' && !className && classes[0])setClassName(classes[0])},[readOnly,population,className,classes])
 useEffect(()=>{void loadAttendance()},[loadAttendance])
 useEffect(()=>{void loadDevices()},[loadDevices])

 const effectiveMarks=useMemo(()=>Object.fromEntries(people.map(person=>[person.id,marks[person.id]??'present'])) as Record<string,AttendanceMark>,[people,marks])
 const counts=useMemo(()=>Object.values(effectiveMarks).reduce((acc,s)=>{acc[s]+=1;return acc},{present:0,absent:0,late:0}),[effectiveMarks])
 function markOne(id:string,value:AttendanceMark){setMarks(current=>({...current,[id]:value}))}
 function markAll(value:AttendanceMark){setMarks(Object.fromEntries(people.map(person=>[person.id,value])))}

 async function saveRegister(){
  if(!supabase||!user)return
  if(population==='students'&&!canManageStudents){onToast('You do not have permission to record student attendance.',true);return}
  if(population==='staff'&&!canManageStaff){onToast('Only owner and administrators can record employee attendance.',true);return}
  if(population==='students'&&!className){onToast('Choose a class before saving attendance.',true);return}
  if(!people.length){onToast('There are no active people in this roster.',true);return}
  setSaving(true)
  const rows=people.map(person=>population==='students'
   ?{student_id:person.id,status:effectiveMarks[person.id],notes:notes[person.id]??null}
   :{teacher_id:person.id,status:effectiveMarks[person.id],notes:notes[person.id]??null})
  try{
   const {data,error}=await supabase.rpc('save_institution_attendance_register',{
    p_institution_id:user.institutionId,
    p_population:population==='students'?'student':'staff',
    p_class_name:population==='students'?className:null,
    p_section_name:null,
    p_attendance_date:date,
    p_period_label:period,
    p_academic_session_id:null,
    p_rows:rows
   })
   if(error)throw error
   const result=data as {total:number;present:number;absent:number;late:number}
   setLastSaved(new Date().toLocaleTimeString())
   onToast('Attendance saved for '+result.total+' '+(population==='students'?'students':'employees')+'.')
   await loadAttendance()
  }catch(error){onToast(error instanceof Error?error.message:'Attendance could not be saved.',true)}
  finally{setSaving(false)}
 }

 function exportRegister(){
  const rows=people.map(p=>({
   identifier:p.admission_no??p.employee_no??'',name:p.full_name,class_name:p.class_name??(population==='staff'?'Staff':''),
   date,period,status:effectiveMarks[p.id],notes:notes[p.id]??''
  }))
  downloadCsv('edusphere-attendance-'+population+'-'+date+'.csv',rows,[
   {key:'identifier',label:'ID'},{key:'name',label:'Name'},{key:'class_name',label:'Class / Department'},
   {key:'date',label:'Date'},{key:'period',label:'Period'},{key:'status',label:'Status'},{key:'notes',label:'Notes'}
  ])
 }

 async function createDevice(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user||!canManageStaff)return
  const {error}=await supabase.from('attendance_device_sources').insert({
   institution_id:user.institutionId,name:deviceName.trim(),provider_type:deviceType,
   status:'not_configured',external_device_id:deviceId.trim()||null,created_by:user.id,public_settings:{}
  })
  if(error){onToast(error.message,true);return}
  setShowDeviceForm(false);setDeviceName('');setDeviceId('');onToast('Device source profile saved. It is not connected until a provider feed is configured.');await loadDevices()
 }

 if(!user)return null
 return <main className="page-content ed360-module-page ed360-attendance-workspace">
  <header className="ed360-attendance-hero">
   <div className="ed360-attendance-icon"><CalendarCheck size={23}/></div>
   <div><span>ACADEMIC & STAFF OPERATIONS / ATTENDANCE</span><h1>Attendance Management</h1><p>Record the whole class or staff roster together. Mark P, A or L and save one validated register.</p></div>
   <div className="ed360-attendance-stats"><span><b>{people.length}</b> people in roster</span><span><b>{counts.present}</b> present · <b>{counts.absent}</b> absent · <b>{counts.late}</b> late</span></div>
  </header>
  <div className="ed360-attendance-main-tabs">
   <button className={autoTab==='register'?'active':''} onClick={()=>setAutoTab('register')}>Manual register</button>
   <button className={autoTab==='history'?'active':''} onClick={()=>setAutoTab('history')}>Attendance history</button>
   {canManageStaff&&<button className={autoTab==='devices'?'active':''} onClick={()=>{setAutoTab('devices');void loadDevices()}}>Automatic / device setup</button>}
  </div>
  {autoTab==='register'&&<>
   <section className="ed360-attendance-filter-card">
    <div className="ed360-attendance-filter">
     <label>Attendance type<select value={population} onChange={e=>{setPopulation(e.target.value as 'students'|'staff');setSearch('')}} disabled={readOnly}><option value="students">Student attendance</option>{canManageStaff&&<option value="staff">Faculty and staff attendance</option>}</select></label>
     {population==='students'&&canManageStudents&&<label>Class / section<select value={className} onChange={e=>setClassName(e.target.value)}><option value="">Select class</option>{classes.map(c=><option key={c} value={c}>{c}</option>)}</select></label>}
     <label>Date<input type="date" value={date} max={today()} onChange={e=>setDate(e.target.value)} /></label>
     {population==='students'&&<label>Attendance period<select value={period} onChange={e=>setPeriod(e.target.value)}>{['Daily','Period 1','Period 2','Period 3','Period 4','Period 5','Period 6','Morning','Afternoon'].map(p=><option key={p}>{p}</option>)}</select></label>}
     <label className="ed360-attendance-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find name or ID"/></label>
    </div>
    <div className="ed360-attendance-roster-meta"><div><strong>{population==='students'?className||'Choose a class':'Employee register'}</strong><span>{date} · {period}</span></div><div className="ed360-attendance-bulk">{!readOnly&&<><button type="button" onClick={()=>markAll('present')}><i className="mark-p">P</i> All present</button><button type="button" onClick={()=>markAll('absent')}><i className="mark-a">A</i> All absent</button><button type="button" onClick={()=>markAll('late')}><i className="mark-l">L</i> All late</button></>}</div></div>
   </section>
   <section className="ed360-attendance-board">
    <div className="ed360-attendance-board-head"><div><span>REGISTER CHART</span><h2>{population==='students'?'Class attendance register':'Employee attendance register'}</h2><p>Each row is one person. Use the status controls in the row or bulk-mark the whole roster above.</p></div><button type="button" onClick={()=>{void loadRoster();void loadAttendance()}}><RefreshCw size={14}/> Refresh roster</button></div>
    <div className="ed360-attendance-counts"><div className="count-p"><b>{counts.present}</b><span>Present</span></div><div className="count-a"><b>{counts.absent}</b><span>Absent</span></div><div className="count-l"><b>{counts.late}</b><span>Late</span></div><div><b>{people.length}</b><span>Total</span></div></div>
    {loading?<div className="ed360-attendance-empty">Loading the institution roster…</div>:loadingError?<div className="ed360-attendance-empty error">{loadingError}</div>:visiblePeople.length===0?<div className="ed360-attendance-empty">{people.length?'No matching names. Clear your search.':'No active people were found in this roster.'}</div>:
    <div className="ed360-attendance-grid-table"><div className="attendance-grid-head"><span>Roll / Employee ID</span><span>Name</span><span>Class / Department</span><span>Attendance mark</span><span>Note (optional)</span></div>
     {visiblePeople.map((person,index)=><div className="attendance-grid-row" key={person.id}><span className="attendance-grid-id">{person.admission_no??person.employee_no??String(index+1).padStart(2,'0')}</span><strong>{person.full_name}</strong><span>{person.class_name??'Employee'}</span>
      <div className="attendance-mark-options">
       {(['present','absent','late'] as AttendanceMark[]).map(s=><button type="button" disabled={readOnly} key={s} aria-pressed={effectiveMarks[person.id]===s} className={'attendance-mark-button mark-'+s.charAt(0)} onClick={()=>markOne(person.id,s)}>{statusLabel(s)}</button>)}
      </div>
      <input className="attendance-note-input" value={notes[person.id]??''} onChange={e=>setNotes(current=>({...current,[person.id]:e.target.value}))} disabled={readOnly} placeholder="Reason / note"/>
     </div>)}
    </div>}
    <div className="ed360-attendance-board-footer"><div><span className="attendance-legend"><i className="mark-p">P</i> Present</span><span className="attendance-legend"><i className="mark-a">A</i> Absent</span><span className="attendance-legend"><i className="mark-l">L</i> Late</span></div><div>{lastSaved&&<span className="ed360-last-saved"><Check size={13}/> Last saved {lastSaved}</span>}<button type="button" className="button button-outline" onClick={exportRegister}><Download size={15}/> Export register</button>{!readOnly&&<button type="button" className="button button-primary" disabled={saving||loading||!people.length||(population==='students'&&!canManageStudents)||(population==='staff'&&!canManageStaff)} onClick={()=>void saveRegister()}>{saving?'Saving whole register…':'Save whole register'}</button>}</div></div>
   </section>
   <p className="ed360-attendance-method-note">Manual mode starts with <b>P (Present)</b> selected for each roster member. Change exceptions to <b>A</b> or <b>L</b> and save the chart once; no individual student forms are required. This follows the common register-first pattern documented by established school ERP systems. <a href="https://fedena.freshdesk.com/support/solutions/articles/211464-how-can-i-mark-student-attendance-daily-" target="_blank" rel="noreferrer">Attendance register workflow reference</a>.</p>
  </>}
  {autoTab==='history'&&<section className="ed360-attendance-board"><div className="ed360-attendance-board-head"><div><span>REGISTER HISTORY</span><h2>Saved attendance for {date}</h2><p>Stored attendance records for the selected roster and date.</p></div><button onClick={()=>void loadAttendance()}><RefreshCw size={14}/> Refresh history</button></div><div className="ed360-attendance-counts"><div className="count-p"><b>{existing.filter(x=>x.status==='present').length}</b><span>Present</span></div><div className="count-a"><b>{existing.filter(x=>x.status==='absent').length}</b><span>Absent</span></div><div className="count-l"><b>{existing.filter(x=>x.status==='late').length}</b><span>Late</span></div><div><b>{existing.length}</b><span>Entries</span></div></div><div className="ed360-attendance-history-list">{existing.length?existing.map((entry,i)=><div key={entry.id??i}><span>{population==='students'?entry.student_id:entry.teacher_id}</span><b>{entry.status.toUpperCase()}</b><small>{entry.notes||'No note'}</small></div>):<p className="ed360-attendance-empty">No attendance entries were found for the current date and filters.</p>}</div></section>}
  {autoTab==='devices'&&<section className="ed360-attendance-board ed360-device-workspace"><div className="ed360-attendance-board-head"><div><span>AUTOMATIC ATTENDANCE</span><h2>Connected device and provider setup</h2><p>Register supported data sources. Actual automated marking requires a verified QR, RFID, biometric or provider feed.</p></div>{canManageStaff&&<button className="button button-primary" onClick={()=>setShowDeviceForm(true)}>+ Register device source</button>}</div><div className="ed360-device-notice"><Fingerprint size={22}/><div><strong>Automatic attendance is not yet connected to a physical device.</strong><p>These are connection profiles only. No attendance is marked automatically until a device/provider is integrated and its events pass authentication, identity matching and duplicate checks.</p></div></div><div className="ed360-device-list">{devices.length?devices.map(device=><div key={device.id}><span><Fingerprint size={18}/></span><div><b>{String(device.name??'Device source')}</b><small>{String(device.provider_type??'provider').toUpperCase()} · {String(device.external_device_id??'No device ID')}</small></div><em>{String(device.status??'not_configured').replaceAll('_',' ')}</em></div>):<p className="ed360-attendance-empty">No device sources have been registered.</p>}</div></section>}
  {showDeviceForm&&<div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-heading"><div><h2>Register attendance source</h2><p>Register a source before connecting its provider or device feed.</p></div><button type="button" className="icon-button" onClick={()=>setShowDeviceForm(false)}><X size={18}/></button></div><form className="ed360-context-form-grid" onSubmit={createDevice}><label>Device / provider name<input required value={deviceName} onChange={e=>setDeviceName(e.target.value)}/></label><label>Source type<select value={deviceType} onChange={e=>setDeviceType(e.target.value)}><option value="qr">QR</option><option value="rfid">RFID</option><option value="biometric">Biometric</option><option value="third_party">Third-party provider</option><option value="csv">CSV import</option></select></label><label>External device ID (optional)<input value={deviceId} onChange={e=>setDeviceId(e.target.value)}/></label><div className="ed360-device-notice"><Activity size={18}/><p>This profile will remain <b>Not configured</b> until a trusted feed is connected and tested.</p></div><div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowDeviceForm(false)}>Cancel</button><button type="submit" className="button button-primary">Save device profile</button></div></form></section></div>}
 </main>
}
