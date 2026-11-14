import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Activity, CalendarCheck, Check, Download, Fingerprint, RefreshCw, Search, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { downloadCsv } from '../lib/csv'
import { exportXlsx, exportDocx, exportExcelXml, exportWordXml, printOfficeReport } from '../lib/officeExport'
import type { RecordRow } from '../lib/types'

type AttendanceMark='present'|'absent'|'late'|'approved_leave'|'leave_pending'|'excused'|'unmarked'
type Person={id:string;full_name:string;admission_no?:string|null;employee_no?:string|null;class_name?:string|null;section_name?:string|null;class_id?:string|null;father_name?:string|null;guardian_name?:string|null;employment_status?:string|null;employee_type?:string|null;department?:string|null;campus_id?:string|null}
type AttendanceEntry={id?:string;student_id?:string;teacher_id?:string;status:string;notes?:string|null;attendance_date:string;period_label?:string;arrival_time?:string|null;departure_time?:string|null;check_in_time?:string|null;check_out_time?:string|null;minutes_late?:number;early_departure_minutes?:number}
type Props={initialWindow?:string;onToast:(message:string,error?:boolean)=>void}
const today=()=>new Date().toLocaleDateString('en-CA')
const statusLabel=(value:string)=>({present:'P',absent:'A',late:'L',approved_leave:'LV',leave_pending:'UL',excused:'EX',unmarked:'—'} as Record<string,string>)[value]??'—'

export function AttendanceWorkspace({initialWindow='students',onToast}:Props){
 const {user}=useAuth()
 const [population,setPopulation]=useState<'students'|'teachers'|'staff'>(initialWindow==='staff'?'staff':initialWindow==='teachers'?'teachers':'students')
 const [date,setDate]=useState(today())
 const [period,setPeriod]=useState('Daily')
 const [className,setClassName]=useState('')
 const [sectionName,setSectionName]=useState('')
 const [classRecords,setClassRecords]=useState<{id:string;name:string;section:string|null;campus_id:string|null}[]>([])
 const [scanValue,setScanValue]=useState('')
 const [scannedNames,setScannedNames]=useState<string[]>([])
 const [scanError,setScanError]=useState('')
 const [cardPopulation,setCardPopulation]=useState<'students'|'teachers'|'staff'>('students')
 const [reportFormat,setReportFormat]=useState<'csv'|'xlsx'|'xls'|'docx'|'doc'|'pdf'>('xlsx')
 const [department,setDepartment]=useState('')
 const [campusId,setCampusId]=useState('')
 const [campuses,setCampuses]=useState<{id:string;name:string}[]>([])
 const [arrivalTimes,setArrivalTimes]=useState<Record<string,string>>({})
 const [departureTimes,setDepartureTimes]=useState<Record<string,string>>({})
 const [earlyMinutes,setEarlyMinutes]=useState<Record<string,string>>({})
 const [shiftId,setShiftId]=useState('')
 const [shifts,setShifts]=useState<RecordRow[]>([])
 const [showShiftForm,setShowShiftForm]=useState(false)
 const [shiftName,setShiftName]=useState('')
 const [shiftStart,setShiftStart]=useState('08:00')
 const [shiftEnd,setShiftEnd]=useState('15:00')
 const [shiftGrace,setShiftGrace]=useState('10')
 const [search,setSearch]=useState('')
 const [historySearch,setHistorySearch]=useState('')
 const [students,setStudents]=useState<Person[]>([])
 const [staff,setStaff]=useState<Person[]>([])
 const [marks,setMarks]=useState<Record<string,AttendanceMark>>({})
 const [notes,setNotes]=useState<Record<string,string>>({})
 const [existing,setExisting]=useState<AttendanceEntry[]>([])
 const [loading,setLoading]=useState(true)
 const [historyLoading,setHistoryLoading]=useState(false)
 const [saving,setSaving]=useState(false)
 const [loadingError,setLoadingError]=useState('')
 const [lastSaved,setLastSaved]=useState('')
 const [autoTab,setAutoTab]=useState<'register'|'history'|'devices'|'cards'|'biometric'|'reports'>(['history','devices','cards','student-cards','teacher-cards','staff-cards','biometric','reports','student-reports','teacher-reports','staff-reports'].includes(initialWindow??'')?(['student-reports','teacher-reports','staff-reports'].includes(initialWindow??'')?'reports':initialWindow as any):'register')
 useEffect(()=>{if(['history','devices','cards','student-cards','teacher-cards','staff-cards','biometric','reports','student-reports','teacher-reports','staff-reports'].includes(initialWindow??'')){setAutoTab(['student-cards','teacher-cards','staff-cards'].includes(initialWindow??'')?'cards':['student-reports','teacher-reports','staff-reports'].includes(initialWindow??'')?'reports':initialWindow as any);if(initialWindow==='student-cards')setCardPopulation('students');if(initialWindow==='teacher-cards')setCardPopulation('teachers');if(initialWindow==='staff-cards')setCardPopulation('staff');if(initialWindow==='student-reports')setPopulation('students');if(initialWindow==='teacher-reports')setPopulation('teachers');if(initialWindow==='staff-reports')setPopulation('staff')}else if(['students','teachers','staff'].includes(initialWindow??'')){setPopulation(initialWindow as 'students'|'teachers'|'staff');setAutoTab('register')}},[initialWindow])
 const [devices,setDevices]=useState<RecordRow[]>([])
 const [deviceName,setDeviceName]=useState('')
 const [deviceType,setDeviceType]=useState('qr')
 const [deviceId,setDeviceId]=useState('')
 const [showDeviceForm,setShowDeviceForm]=useState(false)
 const canManageStudents=Boolean(user&&['owner','admin','teacher'].includes(user.role))
 const canManageStaff=Boolean(user&&['owner','admin'].includes(user.role))
 const isEmployeeSelf=Boolean(user?.role==='teacher')
 const people=population==='students'?students.filter(person=>(!className||person.class_name===className)&&(!sectionName||person.section_name===sectionName)&&(!campusId||person.campus_id===campusId)):staff.filter(person=>(population==='teachers'?String(person.employee_type??'').toLowerCase()==='teaching':String(person.employee_type??'').toLowerCase()!=='teaching')&&(!department||person.department===department)&&(!campusId||person.campus_id===campusId))
 const classes=useMemo(()=>[...new Set(students.map(s=>s.class_name).filter((x):x is string=>Boolean(x)))].sort(),[students])
 const sections=useMemo(()=>[...new Set(students.filter(s=>!className||s.class_name===className).map(s=>s.section_name).filter((x):x is string=>Boolean(x)))].sort(),[students,className])
 const visiblePeople=useMemo(()=>people.filter(p=>{
  const q=search.trim().toLowerCase()
  return !q||p.full_name.toLowerCase().includes(q)||String(p.admission_no??p.employee_no??'').toLowerCase().includes(q)
 }),[people,search])
 const readOnly=population==='students'?!canManageStudents:!canManageStaff
 const visibleHistory=useMemo(()=>existing.filter(entry=>{
  const personId=population==='students'?entry.student_id:entry.teacher_id
  const person=people.find(item=>item.id===personId)
  const searchable=[person?.full_name,person?.admission_no,person?.employee_no,person?.class_name,entry.status,entry.notes].map(value=>String(value??'')).join(' ').toLowerCase()
  return searchable.includes(historySearch.trim().toLowerCase())
 }),[existing,people,population,historySearch])

 const loadRoster=useCallback(async()=>{
  if(!supabase||!user){setLoading(false);return}
  setLoading(true);setLoadingError('')
  try{
   const [studentResult,staffResult]=await Promise.all([
    supabase.from('students').select('id,full_name,admission_no,guardian_name,class_name,status,campus_id').eq('institution_id',user.institutionId).eq('status','active').order('class_name').order('full_name'),
    supabase.from('teachers').select('id,full_name,employee_no,employment_status,employee_type,department,campus_id').eq('institution_id',user.institutionId).eq('employment_status','active').order('full_name')
   ])
   if(studentResult.error && population==='students')throw studentResult.error
   if(staffResult.error && population!=='students' && (canManageStaff||isEmployeeSelf))throw staffResult.error
   const [classResult,placementResult]=await Promise.all([
    supabase.from('classes').select('id,name,section,campus_id').eq('institution_id',user.institutionId).eq('is_active',true),
    supabase.from('student_placements').select('student_id,class_id,effective_from,effective_to,status,campus_id').eq('institution_id',user.institutionId).eq('status','active').lte('effective_from',date).or('effective_to.is.null,effective_to.gte.'+date).order('effective_from',{ascending:false})
   ])
   if(classResult.error)throw classResult.error
   if(placementResult.error)throw placementResult.error
   const classMap=new Map((classResult.data??[]).map(row=>[String(row.id),row]))
   const placementMap=new Map<string,typeof placementResult.data[number]>();for(const row of placementResult.data??[])if(!placementMap.has(String(row.student_id)))placementMap.set(String(row.student_id),row)
   setClassRecords((classResult.data??[]) as {id:string;name:string;section:string|null;campus_id:string|null}[])
   const roster=(studentResult.data??[]).map(row=>{const placement=placementMap.get(String(row.id));const linked=placement?classMap.get(String(placement.class_id)):undefined;return {...row,class_name:linked?.name??row.class_name??null,section_name:linked?.section??null,class_id:linked?.id??null} as Person})
   setStudents(roster)
   setStaff((staffResult.data??[]) as Person[])
   const campusResult=await supabase.from('campuses').select('id,name').eq('institution_id',user.institutionId).order('name')
   if(campusResult.error)throw campusResult.error
   setCampuses((campusResult.data??[]) as {id:string;name:string}[])
   if(canManageStaff){const shiftResult=await supabase.from('employee_shifts').select('*').eq('institution_id',user.institutionId).eq('is_active',true).order('name');if(shiftResult.error)throw shiftResult.error;setShifts((shiftResult.data??[]) as RecordRow[])}
  }catch(error){setLoadingError(error instanceof Error?error.message:'The roster could not be loaded.');setStudents([]);setStaff([])}
  finally{setLoading(false)}
 },[user?.id,user?.institutionId,population,canManageStaff,date])

 const loadAttendance=useCallback(async()=>{
  if(!supabase||!user)return
  setHistoryLoading(true)
  setLoadingError('')
  const table=population==='students'?'attendance':'employee_attendance'
  try{
   let query=supabase.from(table).select('*').eq('institution_id',user.institutionId).eq('attendance_date',date)
   if(population==='students'&&className)query=query.eq('class_name',className)
   if(population==='students')query=query.eq('period_label',period)
   if(campusId)query=query.eq('campus_id',campusId)
   const {data,error}=await query.order(population==='students'?'student_name':'created_at')
   if(error)throw error
   const values=(data??[]) as AttendanceEntry[]
   setExisting(values)
   const initial:Record<string,AttendanceMark>={}
   const noteMap:Record<string,string>={}
   values.forEach(row=>{
    const id=population==='students'?row.student_id:row.teacher_id
    if(id&&['present','absent','late','approved_leave','leave_pending','excused'].includes(row.status))initial[id]=row.status as AttendanceMark
    if(id&&row.arrival_time)setArrivalTimes(v=>({...v,[id]:String(row.arrival_time).slice(0,5)}))
    if(id&&row.departure_time)setDepartureTimes(v=>({...v,[id]:String(row.departure_time).slice(0,5)}))
    if(id&&row.check_in_time)setArrivalTimes(v=>({...v,[id]:String(row.check_in_time).slice(0,5)}))
    if(id&&row.check_out_time)setDepartureTimes(v=>({...v,[id]:String(row.check_out_time).slice(0,5)}))
    if(id&&row.early_departure_minutes)setEarlyMinutes(v=>({...v,[id]:String(row.early_departure_minutes)}))
    if(id&&row.notes)noteMap[id]=row.notes
   })
   setMarks(initial);setNotes(noteMap)
  }catch(error){setExisting([]);setMarks({});setNotes({});setLoadingError(error instanceof Error?error.message:'Attendance could not be loaded.')}
  finally{setHistoryLoading(false)}
 },[user?.id,user?.institutionId,population,date,className,period,campusId])

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

 const effectiveMarks=useMemo(()=>Object.fromEntries(people.map(person=>[person.id,marks[person.id]??'unmarked'])) as Record<string,AttendanceMark>,[people,marks])
 const counts=useMemo(()=>{const tally={present:0,absent:0,late:0,approved_leave:0,leave_pending:0,excused:0,unmarked:0};Object.values(effectiveMarks).forEach(status=>{tally[status]+=1});return tally},[effectiveMarks])
 function markOne(id:string,value:AttendanceMark){setMarks(current=>({...current,[id]:value}))}
 function markAll(value:AttendanceMark){setMarks(Object.fromEntries(people.map(person=>[person.id,value])))}
 async function createShift(event:FormEvent){event.preventDefault();if(!supabase||!user||!canManageStaff)return;if(!shiftName.trim()||shiftEnd<=shiftStart){onToast('Enter a shift name and a valid start/end time.',true);return}const {error}=await supabase.from('employee_shifts').insert({institution_id:user.institutionId,name:shiftName.trim(),start_time:shiftStart,end_time:shiftEnd,grace_minutes:Number(shiftGrace)||0,created_by:user.id});if(error){onToast(error.message,true);return}setShiftName('');setShowShiftForm(false);onToast('Employee shift saved.');void loadRoster()}

 async function saveRegister(){
  if(!supabase||!user)return
  if(population==='students'&&!canManageStudents){onToast('You do not have permission to record student attendance.',true);return}
  if(population!=='students'&&!canManageStaff){onToast('Only owner and administrators can record employee attendance.',true);return}
  if(population==='students'&&!className){onToast('Choose a class before saving attendance.',true);return}
  if(population==='students'&&sectionName&&!classRecords.some(row=>row.name===className&&row.section===sectionName)){onToast('The selected section does not belong to the selected class.',true);return}
  if(!people.length){onToast('There are no active people in this roster.',true);return}
  if(people.some(person=>effectiveMarks[person.id]==='unmarked')){onToast('Complete every attendance mark before saving. Unmarked people will not be treated as present.',true);return}
  setSaving(true)
  const rows=people.map(person=>population==='students'
   ?{student_id:person.id,status:effectiveMarks[person.id],notes:notes[person.id]??null,arrival_time:arrivalTimes[person.id]??null,departure_time:departureTimes[person.id]??null,early_departure_minutes:Number(earlyMinutes[person.id]??0)}
   :{teacher_id:person.id,status:effectiveMarks[person.id],notes:notes[person.id]??null,check_in_time:arrivalTimes[person.id]??null,check_out_time:departureTimes[person.id]??null})
  try{
   const result=population==='students'
    ?await supabase.rpc('save_student_attendance_register',{p_institution_id:user.institutionId,p_attendance_date:date,p_class_name:className,p_section_name:sectionName||null,p_campus_id:campusId||null,p_period_label:period,p_rows:rows,p_late_after:'08:00'})
    :await supabase.rpc('save_employee_attendance_register',{p_institution_id:user.institutionId,p_attendance_date:date,p_population:population==='teachers'?'teacher':'staff',p_campus_id:campusId||null,p_shift_id:shiftId||null,p_rows:rows})
   if(result.error)throw result.error
   const saved=result.data as {total:number;present:number;absent:number;late:number}
   setLastSaved(new Date().toLocaleTimeString())
   onToast('Attendance saved for '+saved.total+' '+(population==='students'?'students':population==='teachers'?'teachers':'staff')+'.')
   await loadAttendance()
  }catch(error){onToast(error instanceof Error?error.message:'Attendance could not be saved.',true)}
  finally{setSaving(false)}
 }

 function exportRegister(){
  const rows=people.map(person=>({
   identifier:person.admission_no??person.employee_no??'',name:person.full_name,guardian:person.guardian_name??'',
   class_name:person.class_name??(population==='staff'?'Staff':''),section:person.section_name??'',
   date,period,status:effectiveMarks[person.id],notes:notes[person.id]??''
  }))
  const columns=[{key:'identifier',label:'ID'},{key:'name',label:'Name'},{key:'guardian',label:'Guardian'},{key:'class_name',label:'Class / Department'},{key:'section',label:'Section'},{key:'date',label:'Date'},{key:'period',label:'Period'},{key:'status',label:'Status'},{key:'notes',label:'Notes'}]
  const filename='ed360-attendance-'+population+'-'+date
  try{
   if(reportFormat==='xlsx')exportXlsx(filename+'.xlsx','Attendance Register',rows,columns)
   else if(reportFormat==='xls')exportExcelXml(filename+'.xls','Attendance Register',rows,columns)
   else if(reportFormat==='docx')exportDocx(filename+'.docx','Attendance Register',rows,columns)
   else if(reportFormat==='doc')exportWordXml(filename+'.doc','Attendance Register',rows,columns)
   else if(reportFormat==='pdf')printOfficeReport('Attendance Register',rows,columns,'Government Islamia Degree College, Badin')
   else downloadCsv(filename+'.csv',rows,columns)
   onToast('Attendance register export prepared.')
  }catch(error){onToast(error instanceof Error?error.message:'Attendance export failed.',true)}
 }

 async function recordQrScan(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user||!canManageStudents){setScanError('Student scan attendance is restricted to authorised attendance staff.');return}
  const raw=scanValue.trim()
  if(!raw){setScanError('Scan or enter the student admission number.');return}
  const payload=raw.match(/(?:admission(?:_no)?[=:][/]*|student[:=]|gidc[:=])([^?&/]+)/i)
  const admission=decodeURIComponent((payload?.[1]??raw).trim())
  const student=students.find(row=>String(row.admission_no??'').toLowerCase()===admission.toLowerCase()||row.id===admission)
  if(!student?.class_name){setScanError('No active student matches this admission number.');return}
  setScanError('')
  try{
   const {data,error}=await supabase.rpc('record_student_attendance_scan',{p_institution_id:user.institutionId,p_admission_no:student.admission_no??admission,p_attendance_date:date,p_period_label:period,p_class_name:student.class_name,p_section_name:student.section_name??null,p_campus_id:student.campus_id??null})
   if(error)throw error
   setPopulation('students');setClassName(student.class_name);setSectionName(student.section_name??'');setCampusId(student.campus_id??'')
   setMarks(current=>({...current,[student.id]:'present'}));setScannedNames(names=>[student.full_name,...names].slice(0,12))
   setScanValue('')
   if(data?.duplicate)onToast(student.full_name+' already has an attendance entry for this date and period.',true)
   else onToast('Attendance recorded for '+student.full_name+'.')
  }catch(error){setScanError(error instanceof Error?error.message:'The QR/barcode scan could not be recorded.')}
 }
 function exportAttendanceReport(format=reportFormat){
  const rows=existing.map(entry=>{const id=population==='students'?entry.student_id:entry.teacher_id;const person=people.find(row=>row.id===id);return {identifier:person?.admission_no??person?.employee_no??'',name:person?.full_name??'Person record',class_or_department:person?.class_name??person?.department??'',date:entry.attendance_date,period:entry.period_label??period,status:entry.status,notes:entry.notes??''}})
  if(!rows.length){onToast('No saved attendance records are available for this report.',true);return}
  const name='attendance-'+population+'-'+date
  const cols=[{key:'identifier',label:'ID'},{key:'name',label:'Name'},{key:'class_or_department',label:'Class / Department'},{key:'date',label:'Date'},{key:'period',label:'Period'},{key:'status',label:'Status'},{key:'notes',label:'Notes'}]
  try{
   if(format==='xlsx')exportXlsx(name+'.xlsx','Attendance Report',rows,cols)
   else if(format==='xls')exportExcelXml(name+'.xls','Attendance Report',rows,cols)
   else if(format==='docx')exportDocx(name+'.docx','Attendance Report',rows,cols)
   else if(format==='doc')exportWordXml(name+'.doc','Attendance Report',rows,cols)
   else if(format==='pdf')printOfficeReport('Attendance Report',rows,cols,'Government Islamia Degree College, Badin')
   else downloadCsv(name+'.csv',rows,cols)
   onToast('Attendance report prepared.')
  }catch(error){onToast(error instanceof Error?error.message:'Attendance export failed.',true)}
 }
 const cardPeople=cardPopulation==='students'?students:staff.filter(person=>cardPopulation==='teachers'?String(person.employee_type??'').toLowerCase()==='teaching':String(person.employee_type??'').toLowerCase()!=='teaching')
 const reportTotal=existing.length
 const reportPresent=existing.filter(row=>row.status==='present').length
 const reportAbsent=existing.filter(row=>row.status==='absent').length
 const reportLeave=existing.filter(row=>['approved_leave','excused'].includes(row.status)).length
 const reportPending=existing.filter(row=>row.status==='leave_pending').length
 const presentRate=reportTotal?Math.round(reportPresent/reportTotal*1000)/10:0

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
   <div><span>ACADEMIC & STAFF OPERATIONS / ATTENDANCE</span><h1>Attendance Management</h1><p>Class-wise registers, scan-assisted marking, saved history and staff attendance.</p></div>
   <div className="ed360-attendance-stats"><span><b>{people.length}</b> people in selected roster</span></div>
  </header>
  <div className="ed360-attendance-main-tabs">
    <button className={autoTab==='register'?'active':''} onClick={()=>setAutoTab('register')}>Manual register</button>
    <button className={autoTab==='devices'?'active':''} onClick={()=>{setAutoTab('devices');void loadDevices()}}>Automatic attendance</button>
    <button className={autoTab==='cards'?'active':''} onClick={()=>setAutoTab('cards')}>ID cards</button>
    <button className={autoTab==='history'?'active':''} onClick={()=>setAutoTab('history')}>Attendance history</button>
    <button className={autoTab==='reports'?'active':''} onClick={()=>setAutoTab('reports')}>Reports</button>
    <button className={autoTab==='biometric'?'active':''} onClick={()=>setAutoTab('biometric')}>Biometric access</button>
  </div>
  {autoTab==='register'&&<>
   <section className="ed360-attendance-filter-card">
    <div className="ed360-attendance-filter">
     <label>Attendance type<select value={population} onChange={e=>{setPopulation(e.target.value as 'students'|'teachers'|'staff');setSearch('')}} disabled={readOnly}><option value="students">Student attendance</option>{canManageStaff?<><option value="teachers">Teacher attendance</option><option value="staff">Staff attendance</option></>:user?.role==='teacher'?<option value="teachers">My teacher attendance</option>:null}</select></label>
     <label>Branch / campus<select value={campusId} onChange={e=>setCampusId(e.target.value)}><option value="">All permitted branches</option>{campuses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
     {population==='students'&&canManageStudents&&<><label>Class<select value={className} onChange={e=>{setClassName(e.target.value);setSectionName('')}}><option value="">Select class</option>{classes.map(c=><option key={c} value={c}>{c}</option>)}</select></label><label>Section<select value={sectionName} onChange={e=>setSectionName(e.target.value)}><option value="">All sections</option>{sections.map(s=><option key={s} value={s}>{s}</option>)}</select></label></>}
     {population!=='students'&&canManageStaff&&<label>Department<select value={department} onChange={e=>setDepartment(e.target.value)}><option value="">All departments</option>{[...new Set(staff.map(s=>s.department).filter(Boolean))].sort().map(d=><option key={d}>{d}</option>)}</select></label>}
     {population!=='students'&&canManageStaff&&<label>Shift<select value={shiftId} onChange={e=>setShiftId(e.target.value)}><option value="">No shift selected</option>{shifts.map(s=><option key={s.id} value={s.id}>{String(s.name)} · {String(s.start_time).slice(0,5)}–{String(s.end_time).slice(0,5)}</option>)}</select></label>}
     <label>Date<input type="date" value={date} max={today()} onChange={e=>setDate(e.target.value)} /></label>
     {population==='students'&&<label>Attendance period<select value={period} onChange={e=>setPeriod(e.target.value)}>{['Daily','Period 1','Period 2','Period 3','Period 4','Period 5','Period 6','Morning','Afternoon'].map(p=><option key={p}>{p}</option>)}</select></label>}
     {canManageStaff&&population!=='students'&&<button type="button" className="button button-outline" onClick={()=>setShowShiftForm(v=>!v)}>Manage shifts</button>}
     <label className="ed360-attendance-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find name or ID"/></label>
    </div>
    <div className="ed360-attendance-roster-meta"><div><strong>{population==='students'?className||'Choose a class':'Employee register'}</strong><span>{date} · {population==='students'?period:'Daily'}{shiftId?' · '+String(shifts.find(s=>s.id===shiftId)?.name??'Shift'):''}</span></div><div className="ed360-attendance-bulk">{!readOnly&&<><button type="button" onClick={()=>markAll('present')}><i className="mark-p">P</i> All present</button><button type="button" onClick={()=>markAll('absent')}><i className="mark-a">A</i> All absent</button><button type="button" onClick={()=>markAll('approved_leave')}><i className="mark-leave">LV</i> All leave</button></>}</div></div>
   </section>
   <section className="ed360-attendance-board">
    <div className="ed360-attendance-board-head"><div><span>REGISTER CHART</span><h2>{population==='students'?'Class attendance register':population==='teachers'?'Teacher attendance register':'Staff attendance register'}</h2><p>Each row is one person. Use the status controls in the row or bulk-mark the whole roster above.</p></div><button type="button" onClick={()=>{void loadRoster();void loadAttendance()}}><RefreshCw size={14}/> Refresh roster</button></div>
    
    {loading?<div className="ed360-attendance-empty">Loading the institution roster…</div>:loadingError?<div className="ed360-attendance-empty error">{loadingError}</div>:visiblePeople.length===0?<div className="ed360-attendance-empty">{people.length?'No matching names. Clear your search.':'No active people were found in this roster.'}</div>:
    <div className="ed360-attendance-grid-table"><div className="attendance-grid-head"><span>Roll / Employee ID</span><span>Name</span><span>Class / Department</span><span>Attendance mark</span><span>Note (optional)</span></div>
     {visiblePeople.map((person,index)=><div className="attendance-grid-row" key={person.id}><span className="attendance-grid-id">{person.admission_no??person.employee_no??String(index+1).padStart(2,'0')}</span><strong>{person.full_name}</strong><small className="attendance-person-guardian">{population==='students'&&person.guardian_name?'Guardian: '+person.guardian_name:''}</small><span>{person.class_name??person.department??(population==='teachers'?'Teacher':'Employee')}</span>
      <div className="attendance-mark-options">
       {(['present','absent','approved_leave','leave_pending'] as AttendanceMark[]).map(s=><button type="button" disabled={readOnly} key={s} aria-pressed={effectiveMarks[person.id]===s} className={'attendance-mark-button mark-'+(s==='approved_leave'?'leave':s==='excused'?'excused':s.charAt(0))} onClick={()=>markOne(person.id,s)}>{statusLabel(s)}</button>)}
      </div>
      <div className="attendance-time-fields"><input aria-label="Arrival or check-in time" type="time" value={arrivalTimes[person.id]??''} onChange={e=>setArrivalTimes(v=>({...v,[person.id]:e.target.value}))} disabled={readOnly} title="Arrival / check-in"/><input aria-label="Departure or check-out time" type="time" value={departureTimes[person.id]??''} onChange={e=>setDepartureTimes(v=>({...v,[person.id]:e.target.value}))} disabled={readOnly} title="Departure / check-out"/>{population==='students'&&<input aria-label="Early departure minutes" type="number" min="0" max="1440" value={earlyMinutes[person.id]??'0'} onChange={e=>setEarlyMinutes(v=>({...v,[person.id]:e.target.value}))} disabled={readOnly} placeholder="Early min"/>}<input className="attendance-note-input" value={notes[person.id]??''} onChange={e=>setNotes(current=>({...current,[person.id]:e.target.value}))} disabled={readOnly} placeholder="Reason / note"/></div>
     </div>)}
    </div>}
    <div className="ed360-attendance-board-footer"><div><span className="attendance-legend"><i className="mark-p">P</i> Present</span><span className="attendance-legend"><i className="mark-a">A</i> Absent</span><span className="attendance-legend"><i className="mark-leave">LV</i> Leave</span><span className="attendance-legend"><i className="mark-leave">UL</i> Leave not approved</span></div><div>{lastSaved&&<span className="ed360-last-saved"><Check size={13}/> Last saved {lastSaved}</span>}<button type="button" className="button button-outline" onClick={exportRegister}><Download size={15}/> Export register</button>{!readOnly&&<button type="button" className="button button-primary" disabled={saving||loading||!people.length||(population==='students'&&!canManageStudents)||(population==='staff'&&!canManageStaff)} onClick={()=>void saveRegister()}>{saving?'Saving whole register…':'Save whole register'}</button>}</div></div>
   </section>
   <p className="ed360-attendance-method-note">Unmarked people remain pending. Select Present, Absent, Leave or Leave not approved for every person before saving the register. Existing historical late-arrival records remain preserved for reporting.</p>
  </>}
  {autoTab==='history'&&<section className="ed360-attendance-board">
   <div className="ed360-attendance-board-head">
    <div><span>REGISTER HISTORY</span><h2>Saved attendance history</h2><p>Choose the roster and date to inspect stored attendance entries.</p></div>
    <div className="ed360-attendance-history-controls">
     <label>Roster<select value={population} onChange={e=>{setPopulation(e.target.value as 'students'|'staff');setHistorySearch('')}} disabled={readOnly}><option value="students">Students</option>{canManageStaff&&<option value="staff">Faculty and staff</option>}</select></label>
     {population==='students'&&canManageStudents&&<label>Class / section<select value={className} onChange={e=>setClassName(e.target.value)}><option value="">All classes</option>{classes.map(value=><option key={value} value={value}>{value}</option>)}</select></label>}
     <label>Date<input type="date" value={date} max={today()} onChange={e=>setDate(e.target.value)}/></label>
     <button type="button" onClick={()=>void loadAttendance()}><RefreshCw size={14}/> Refresh history</button>
    </div>
   </div>
   <label className="ed360-attendance-search"><Search size={15}/><input value={historySearch} onChange={e=>setHistorySearch(e.target.value)} placeholder="Search person, ID, status or note"/></label>
   <div className="ed360-attendance-counts"><div className="count-p"><b>{existing.filter(x=>x.status==='present').length}</b><span>Present</span></div><div className="count-a"><b>{existing.filter(x=>x.status==='absent').length}</b><span>Absent</span></div><div className="count-l"><b>{existing.filter(x=>x.status==='late').length}</b><span>Historical late</span></div><div><b>{existing.length}</b><span>Entries</span></div></div>
   {historyLoading&&<p className="ed360-attendance-empty">Loading attendance history…</p>}
   {!loadingError&&visibleHistory.length>0&&<div className="ed360-attendance-history-list">{visibleHistory.map((entry,index)=>{
    const personId=population==='students'?entry.student_id:entry.teacher_id
    const person=people.find(item=>item.id===personId)
    return <div key={entry.id??index}>
     <span><b>{person?.full_name??'Person record unavailable'}</b><small>{person?.admission_no??person?.employee_no??String(personId??'—')}{person?.class_name?' · '+person.class_name:''}</small></span>
     <b className={'attendance-history-status status-'+entry.status}>{entry.status.toUpperCase()}</b>
     <small>{entry.notes||'No note'}</small>
    </div>
   })}</div>}
   {!loading&&loadingError&&<p className="ed360-attendance-empty error">{loadingError}</p>}
   {!loading&& !loadingError&&visibleHistory.length===0&&<p className="ed360-attendance-empty">{existing.length?'No history rows match your search.':'No attendance entries were found for the selected date and filters.'}</p>}
  </section>}
   {autoTab==='devices'&&<section className="ed360-attendance-board ed360-device-workspace">
    <div className="ed360-attendance-board-head"><div><span>AUTOMATIC ATTENDANCE</span><h2>QR / barcode scan register</h2><p>USB and Bluetooth scanners that type the card value into the focused field can mark a verified admission number present.</p></div>{canManageStaff&&<button className="button button-primary" onClick={()=>setShowDeviceForm(true)}>Register device source</button>}</div>
    <div className="ed360-qr-scan-panel"><div className="ed360-qr-scan-icon"><Fingerprint size={26}/></div><form onSubmit={recordQrScan}><label>Scan student ID / QR payload<input autoFocus value={scanValue} onChange={e=>setScanValue(e.target.value)} placeholder="Scan card or enter admission number"/></label><button className="button button-primary" type="submit" disabled={!scanValue.trim()}>Record present</button></form>{scanError&&<p className="ed360-attendance-empty error">{scanError}</p>}<p>Each scan is checked against the active student, institution, class, section and selected period. Duplicate scans are rejected.</p></div>
    {scannedNames.length>0&&<div className="ed360-scanned-list"><b>Scanned this session</b>{scannedNames.map((name,index)=><span key={name+'-'+index}><Check size={13}/>{name}</span>)}</div>}
    <div className="ed360-device-notice"><Activity size={22}/><div><strong>Other device integrations</strong><p>Device profiles are registration records only. RFID and biometric feeds require an authenticated device gateway and verified event mapping before they can mark attendance automatically.</p></div></div>
    <div className="ed360-device-list">{devices.length?devices.map(device=><div key={device.id}><span><Fingerprint size={18}/></span><div><b>{String(device.name??'Device source')}</b><small>{String(device.provider_type??'provider').toUpperCase()} · {String(device.external_device_id??'No device ID')}</small></div><em>{String(device.status??'not_configured').replaceAll('_',' ')}</em></div>):<p className="ed360-attendance-empty">No device sources have been registered.</p>}</div>
   </section>}
   {autoTab==='cards'&&<section className="ed360-attendance-board ed360-attendance-cards-page">
    <div className="ed360-attendance-board-head"><div><span>INSTITUTION ID CARDS</span><h2>Student, teacher and staff cards</h2><p>Print identity cards from the current authorised institutional roster.</p></div><button className="button button-primary" onClick={()=>window.print()}>Print cards</button></div>
    <div className="ed360-attendance-card-tabs"><button className={cardPopulation==='students'?'active':''} onClick={()=>setCardPopulation('students')}>Student cards</button><button className={cardPopulation==='teachers'?'active':''} onClick={()=>setCardPopulation('teachers')}>Teacher cards</button><button className={cardPopulation==='staff'?'active':''} onClick={()=>setCardPopulation('staff')}>Staff cards</button></div>
    <div className="ed360-attendance-filter"><label>Branch / campus<select value={campusId} onChange={e=>setCampusId(e.target.value)}><option value="">All branches</option>{campuses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
    <div className="ed360-id-card-grid">{cardPeople.filter(person=>!campusId||person.campus_id===campusId).map(person=><article className="ed360-id-card" key={person.id}><header><img src="/gidc-badin-official-logo.svg" alt="College emblem"/><span><b>Government Islamia Degree College</b><small>Badin · Official identity card</small></span></header><h3>{person.full_name}</h3><p>{cardPopulation==='students'?'Student':cardPopulation==='teachers'?'Teacher':'Staff'} · {person.class_name??person.department??'Institution'}</p><div className="ed360-id-card-meta"><span>ID number</span><b>{person.admission_no??person.employee_no??'—'}</b></div>{cardPopulation==='students'&&person.guardian_name&&<small>Guardian: {person.guardian_name}</small>}<footer>Verify identity at the college office</footer></article>)}</div>
    {cardPeople.length===0&&<p className="ed360-attendance-empty">No records are available for this card group.</p>}
   </section>}
   {autoTab==='reports'&&<section className="ed360-attendance-board ed360-attendance-report-page">
    <div className="ed360-attendance-board-head"><div><span>ATTENDANCE ANALYTICS</span><h2>{population==='students'?'Student attendance report':population==='teachers'?'Teacher attendance report':'Staff attendance report'}</h2><p>Saved attendance records for the selected population and date.</p></div><button type="button" onClick={()=>void loadAttendance()}><RefreshCw size={14}/> Refresh report</button></div>
    <div className="ed360-attendance-history-controls"><label>Population<select value={population} onChange={e=>setPopulation(e.target.value as 'students'|'teachers'|'staff')}><option value="students">Students</option><option value="teachers">Teachers</option><option value="staff">Staff</option></select></label>{population==='students'&&<label>Class<select value={className} onChange={e=>setClassName(e.target.value)}><option value="">All classes</option>{classes.map(value=><option key={value}>{value}</option>)}</select></label>}<label>Date<input type="date" value={date} max={today()} onChange={e=>setDate(e.target.value)}/></label><label>Export format<select value={reportFormat} onChange={e=>setReportFormat(e.target.value as typeof reportFormat)}><option value="csv">CSV</option><option value="xlsx">Excel XLSX</option><option value="xls">Excel XLS</option><option value="docx">Word DOCX</option><option value="doc">Word DOC</option><option value="pdf">PDF / Print</option></select></label><button type="button" className="button button-primary" onClick={()=>exportAttendanceReport()}>Export report</button></div>
    <div className="ed360-attendance-report-summary"><div className="ed360-attendance-donut" style={{background:'conic-gradient(#23633a '+presentRate+'%,#d8a246 '+presentRate+'% '+(reportTotal?Math.round((reportPresent+reportLeave)/reportTotal*1000)/10:0)+'%,#c66a61 '+(reportTotal?Math.round((reportPresent+reportLeave)/reportTotal*1000)/10:0)+'% 100%)'}}><strong>{presentRate}%</strong><small>Present</small></div><div className="ed360-attendance-report-metrics"><article><b>{reportTotal.toLocaleString()}</b><span>Attendance entries</span></article><article><b>{reportPresent.toLocaleString()}</b><span>Present</span></article><article><b>{reportAbsent.toLocaleString()}</b><span>Absent</span></article><article><b>{reportLeave.toLocaleString()}</b><span>Approved leave</span></article><article><b>{reportPending.toLocaleString()}</b><span>Leave not approved</span></article></div></div>
    {existing.length===0&&<p className="ed360-attendance-empty">No saved attendance entries are available for these filters.</p>}
   </section>}
   {autoTab==='biometric'&&<section className="ed360-attendance-board ed360-biometric-page"><div className="ed360-attendance-board-head"><div><span>DEVICE AUTHENTICATION</span><h2>Biometric attendance access</h2><p>Use a supported platform authenticator only after secure credential enrolment is configured.</p></div><Fingerprint size={26}/></div>
    <div className="ed360-device-notice"><Fingerprint size={20}/><div><strong>Biometric verification is not configured for this institution.</strong><p>A website cannot read the fingerprint sensor or power-button fingerprint template directly. Supported phones may verify a passkey locally through WebAuthn, but the college needs a secure challenge and credential service before this can be used as an attendance factor.</p></div></div>
    <div className="ed360-biometric-grid"><article><b>Browser support</b><span>{typeof window!=='undefined'&&'PublicKeyCredential'in window?'This browser exposes WebAuthn/passkey APIs.':'This browser does not expose WebAuthn/passkey APIs.'}</span></article><article><b>Credential privacy</b><span>Biometric templates stay on the user device. Only a public-key credential is registered with the college service.</span></article><article><b>Attendance marking</b><span>Not enabled until enrolment, challenge validation, replay protection and student identity mapping are implemented.</span></article></div>
   </section>}

  {showShiftForm&&<div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-heading"><div><h2>Employee shifts</h2><p>Define start time, finish time and permitted grace period for attendance calculations.</p></div><button type="button" className="icon-button" onClick={()=>setShowShiftForm(false)}><X size={18}/></button></div><form className="ed360-context-form-grid" onSubmit={createShift}><label>Shift name<input required value={shiftName} onChange={e=>setShiftName(e.target.value)}/></label><label>Start time<input type="time" required value={shiftStart} onChange={e=>setShiftStart(e.target.value)}/></label><label>End time<input type="time" required value={shiftEnd} onChange={e=>setShiftEnd(e.target.value)}/></label><label>Grace minutes<input type="number" min="0" max="240" value={shiftGrace} onChange={e=>setShiftGrace(e.target.value)}/></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowShiftForm(false)}>Cancel</button><button type="submit" className="button button-primary">Save shift</button></div></form></section></div>}
  {showDeviceForm&&<div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-heading"><div><h2>Register attendance source</h2><p>Register a source before connecting its provider or device feed.</p></div><button type="button" className="icon-button" onClick={()=>setShowDeviceForm(false)}><X size={18}/></button></div><form className="ed360-context-form-grid" onSubmit={createDevice}><label>Device / provider name<input required value={deviceName} onChange={e=>setDeviceName(e.target.value)}/></label><label>Source type<select value={deviceType} onChange={e=>setDeviceType(e.target.value)}><option value="qr">QR</option><option value="rfid">RFID</option><option value="biometric">Biometric</option><option value="third_party">Third-party provider</option><option value="csv">CSV import</option></select></label><label>External device ID (optional)<input value={deviceId} onChange={e=>setDeviceId(e.target.value)}/></label><div className="ed360-device-notice"><Activity size={18}/><p>This profile will remain <b>Not configured</b> until a trusted feed is connected and tested.</p></div><div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowDeviceForm(false)}>Cancel</button><button type="submit" className="button button-primary">Save device profile</button></div></form></section></div>}
 </main>
}
