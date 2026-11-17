import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Activity, Check, Copy, Download, Fingerprint, Printer, QrCode, RefreshCw, Search, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { downloadCsv } from '../lib/csv'
import { exportDocx, exportXlsx, printOfficeReport, type OfficeColumn } from '../lib/officeExport'
import type { RecordRow } from '../lib/types'
import { LocalQrCode } from './LocalQrCode'
import '../styles/attendance-enhancements.css'

type AttendanceMark='present'|'absent'|'late'|'approved_leave'|'leave_pending'|'excused'|'unmarked'
type Person={id:string;full_name:string;admission_no?:string|null;employee_no?:string|null;class_name?:string|null;section_name?:string|null;guardian_name?:string|null;employment_status?:string|null;employee_type?:string|null;department?:string|null;campus_id?:string|null}
type AttendanceEntry={id?:string;student_id?:string;teacher_id?:string;status:string;notes?:string|null;attendance_date:string;period_label?:string;arrival_time?:string|null;departure_time?:string|null;check_in_time?:string|null;check_out_time?:string|null;minutes_late?:number;early_departure_minutes?:number}
type Props={initialWindow?:string;onToast:(message:string,error?:boolean)=>void}
const today=()=>new Date().toLocaleDateString('en-CA')
const localEventDateTime=(value:string)=>{
 const d=new Date(value)
 if(Number.isNaN(d.getTime()))return {date:today(),time:'08:00'}
 const pad=(n:number)=>String(n).padStart(2,'0')
 return {date:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,time:`${pad(d.getHours())}:${pad(d.getMinutes())}`}
}
const statusLabel=(value:string)=>({present:'P',absent:'A',late:'L',approved_leave:'LV',leave_pending:'NP',excused:'EX',unmarked:'—'} as Record<string,string>)[value]??'—'

export function AttendanceWorkspace({initialWindow='students',onToast}:Props){
 const {user}=useAuth()
 const [population,setPopulation]=useState<'students'|'teachers'|'staff'>(['staff','cards-staff'].includes(initialWindow)?'staff':['teachers','cards-teachers'].includes(initialWindow)?'teachers':'students')
 const [date,setDate]=useState(today())
 const [period,setPeriod]=useState('Daily')
 const [className,setClassName]=useState('')
 const [sectionName,setSectionName]=useState('')
 const [scanCode,setScanCode]=useState('')
 const [scanResult,setScanResult]=useState('')
 const [cameraActive,setCameraActive]=useState(false)
 const [cameraMessage,setCameraMessage]=useState('')
 const videoRef=useRef<HTMLVideoElement|null>(null)
 const cameraStreamRef=useRef<MediaStream|null>(null)
 const cameraFrameRef=useRef<number|null>(null)
 const cameraActiveRef=useRef(false)
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
 const [autoTab,setAutoTab]=useState<'register'|'history'|'devices'|'qr-scan'|'biometric'|'cards-students'|'cards-teachers'|'cards-staff'>(['register','history','devices','qr-scan','biometric','cards-students','cards-teachers','cards-staff'].includes(initialWindow)?initialWindow as any:'register')
 const [devices,setDevices]=useState<RecordRow[]>([])
 const [deviceName,setDeviceName]=useState('')
 const [deviceType,setDeviceType]=useState('qr')
 const [deviceId,setDeviceId]=useState('')
 const [showDeviceForm,setShowDeviceForm]=useState(false)
 const [deviceSecret,setDeviceSecret]=useState<{sourceId:string;name:string;secret:string;endpoint:string}|null>(null)
 const [deviceBusy,setDeviceBusy]=useState(false)
 const [deviceEvents,setDeviceEvents]=useState<RecordRow[]>([])
 const [reviewEvent,setReviewEvent]=useState<RecordRow|null>(null)
 const [reviewDate,setReviewDate]=useState(today())
 const [reviewTime,setReviewTime]=useState('')
 const [reviewPeriod,setReviewPeriod]=useState('Daily')
 const [reviewStatus,setReviewStatus]=useState('present')
 const [reviewNote,setReviewNote]=useState('')
 const [correctionReason,setCorrectionReason]=useState('')
 const [reviewShiftId,setReviewShiftId]=useState('')
 const [reviewBusy,setReviewBusy]=useState(false)
 const [cardTemplate,setCardTemplate]=useState<'classic'|'compact'|'portrait'>('classic')
 const [cardIssueDate,setCardIssueDate]=useState(today())
 const [includeCardClass,setIncludeCardClass]=useState(true)
 const [includeCardGuardian,setIncludeCardGuardian]=useState(true)
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
    supabase.from('students').select('id,full_name,admission_no,class_name,section_name,guardian_name,status,campus_id').eq('institution_id',user.institutionId).eq('status','active').order('class_name').order('full_name'),
    supabase.from('teachers').select('id,full_name,employee_no,employment_status,employee_type,department,campus_id').eq('institution_id',user.institutionId).eq('employment_status','active').order('full_name')
   ])
   if(studentResult.error && population==='students')throw studentResult.error
   if(staffResult.error && population!=='students' && (canManageStaff||isEmployeeSelf))throw staffResult.error
   setStudents((studentResult.data??[]) as Person[])
   setStaff((staffResult.data??[]) as Person[])
   const campusResult=await supabase.from('campuses').select('id,name').eq('institution_id',user.institutionId).order('name')
   if(campusResult.error)throw campusResult.error
   setCampuses((campusResult.data??[]) as {id:string;name:string}[])
   if(canManageStaff){const shiftResult=await supabase.from('employee_shifts').select('*').eq('institution_id',user.institutionId).eq('is_active',true).order('name');if(shiftResult.error)throw shiftResult.error;setShifts((shiftResult.data??[]) as RecordRow[])}
  }catch(error){setLoadingError(error instanceof Error?error.message:'The roster could not be loaded.');setStudents([]);setStaff([])}
  finally{setLoading(false)}
 },[user?.id,user?.institutionId,population,canManageStaff])

 const loadAttendance=useCallback(async()=>{
  if(!supabase||!user)return
  setHistoryLoading(true)
  setLoadingError('')
  const table=population==='students'?'attendance':'employee_attendance'
  try{
   let query=supabase.from(table).select('*').eq('institution_id',user.institutionId).eq('attendance_date',date)
   if(population==='students'&&className)query=query.eq('class_name',className)
    if(population==='students'&&sectionName)query=query.eq('section_name',sectionName)
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
  if(!supabase||!user||!canManageStudents){setDevices([]);setDeviceEvents([]);return}
  if(canManageStaff){
   const sourceResult=await supabase.from('attendance_device_sources').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false})
   if(sourceResult.error){setLoadingError(sourceResult.error.message);return}
   setDevices((sourceResult.data??[]) as RecordRow[])
  }else{
   setDevices([])
  }
  const eventResult=await supabase.from('attendance_device_events')
   .select('id,institution_id,source_id,external_event_id,student_id,teacher_id,occurred_at,event_kind,processing_status,error_message,created_at,reviewed_by,reviewed_at,review_action,review_note,correction_reason,attendance_register_id,attendance_record_id,attendance_record_type')
   .eq('institution_id',user.institutionId)
   .order('created_at',{ascending:false})
   .limit(50)
  if(eventResult.error){setLoadingError(eventResult.error.message);setDeviceEvents([]);return}
  setDeviceEvents((eventResult.data??[]) as RecordRow[])
 },[user?.id,user?.institutionId,canManageStaff,canManageStudents])

 useEffect(()=>{void loadRoster()},[loadRoster])
 useEffect(()=>{if(!readOnly && population==='students' && !className && classes[0])setClassName(classes[0])},[readOnly,population,className,classes])
 useEffect(()=>{void loadAttendance()},[loadAttendance])
 useEffect(()=>{void loadDevices()},[loadDevices])

 const effectiveMarks=useMemo(()=>Object.fromEntries(people.map(person=>[person.id,marks[person.id]??'unmarked'])) as Record<string,AttendanceMark>,[people,marks])
 function markOne(id:string,value:AttendanceMark){setMarks(current=>({...current,[id]:value}))}
 function markAll(value:AttendanceMark){setMarks(Object.fromEntries(people.map(person=>[person.id,value])))}
 function stopQrCamera(){
  cameraActiveRef.current=false
  if(cameraFrameRef.current!==null){cancelAnimationFrame(cameraFrameRef.current);cameraFrameRef.current=null}
  cameraStreamRef.current?.getTracks().forEach(track=>track.stop())
  cameraStreamRef.current=null
  if(videoRef.current)videoRef.current.srcObject=null
  setCameraActive(false)
 }
 function applyScannedIdentity(rawValue:string){
  const key=rawValue.trim().toLowerCase()
  if(!key)return
  const person=people.find(candidate=>String(candidate.admission_no??candidate.employee_no??'').trim().toLowerCase()===key)
  if(!person){setScanResult('No matching person found in the selected roster. Check the ID and filters.');return}
  if(population==='students'&&!canManageStudents){setScanResult('You do not have permission to mark student attendance.');return}
  if(population!=='students'&&!canManageStaff){setScanResult('Only owner and administrators may mark employee attendance.');return}
  markOne(person.id,'present')
  setScanResult(person.full_name+' marked Present in the pending register. Save the register to commit this entry.')
  setScanCode('')
  stopQrCamera()
 }
 async function startQrCamera(){
  const detectorConstructor=(window as unknown as {BarcodeDetector?:new(options:{formats:string[]})=>{detect:(source:HTMLVideoElement)=>Promise<{rawValue?:string}[]>}}).BarcodeDetector
  if(!navigator.mediaDevices?.getUserMedia){setCameraMessage('Camera access is not available in this browser. Use the ID field or a USB/Bluetooth scanner.');return}
  if(!detectorConstructor){setCameraMessage('QR scanning is not supported in this browser. Enter the ID or use an external scanner.');return}
  try{
   const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false})
   cameraStreamRef.current=stream
   cameraActiveRef.current=true
   setCameraActive(true)
   setCameraMessage('Camera ready. Hold the student or employee QR/barcode inside the frame.')
   const video=videoRef.current
   if(!video)throw new Error('The camera preview could not be opened.')
   video.srcObject=stream
   await video.play()
   const detector=new detectorConstructor({formats:['qr_code','code_128','code_39','ean_13','ean_8','upc_a','upc_e']})
   const scan=async()=>{
    if(!cameraActiveRef.current)return
    if(video.readyState>=2){
     try{
      const detections=await detector.detect(video)
      const value=detections.find(item=>item.rawValue)?.rawValue
      if(value){applyScannedIdentity(value);return}
     }catch{setCameraMessage('The camera could not read that code. Keep the code steady or enter the ID manually.')}
    }
    if(cameraActiveRef.current)cameraFrameRef.current=requestAnimationFrame(()=>{void scan()})
   }
   cameraFrameRef.current=requestAnimationFrame(()=>{void scan()})
  }catch(error){
   stopQrCamera()
   setCameraMessage(error instanceof Error?error.message:'Camera access was blocked. Allow camera permission and retry.')
  }
 }
 useEffect(()=>{if(autoTab!=='qr-scan'&&cameraActiveRef.current)stopQrCamera()},[autoTab])
 useEffect(()=>()=>{cameraActiveRef.current=false;if(cameraFrameRef.current!==null)cancelAnimationFrame(cameraFrameRef.current);cameraStreamRef.current?.getTracks().forEach(track=>track.stop())},[])

 async function createShift(event:FormEvent){event.preventDefault();if(!supabase||!user||!canManageStaff)return;if(!shiftName.trim()||shiftEnd<=shiftStart){onToast('Enter a shift name and a valid start/end time.',true);return}const {error}=await supabase.from('employee_shifts').insert({institution_id:user.institutionId,name:shiftName.trim(),start_time:shiftStart,end_time:shiftEnd,grace_minutes:Number(shiftGrace)||0,created_by:user.id});if(error){onToast(error.message,true);return}setShiftName('');setShowShiftForm(false);onToast('Employee shift saved.');void loadRoster()}

 async function saveRegister(){
  if(!supabase||!user)return
  if(population==='students'&&!canManageStudents){onToast('You do not have permission to record student attendance.',true);return}
  if(population!=='students'&&!canManageStaff){onToast('Only owner and administrators can record employee attendance.',true);return}
  if(population==='students'&&!className){onToast('Choose a class before saving attendance.',true);return}
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

 function attendanceExportData(){
  const rows=people.map(p=>({
   identifier:p.admission_no??p.employee_no??'',name:p.full_name,class_name:p.class_name??(population==='staff'?'Staff':''),
   date,period,section:p.section_name??'',guardian:p.guardian_name??'',status:effectiveMarks[p.id],notes:notes[p.id]??''
  }))
  const columns:OfficeColumn[]=[
   {key:'identifier',label:'ID'},{key:'name',label:'Name'},{key:'guardian',label:'Father / Guardian'},{key:'class_name',label:'Class / Department'},{key:'section',label:'Section'},
   {key:'date',label:'Date'},{key:'period',label:'Period'},{key:'status',label:'Status'},{key:'notes',label:'Notes'}
  ]
  return {rows,columns,title:(population==='students'?'Student':population==='teachers'?'Teacher':'Staff')+' Attendance Register'}
 }
 function exportRegister(format:'csv'|'xlsx'|'docx'|'print'='csv'){
  const {rows,columns,title}=attendanceExportData()
  const filename='edusphere-attendance-'+population+'-'+date
  if(format==='csv')downloadCsv(filename+'.csv',rows,columns)
  else if(format==='xlsx')exportXlsx(filename+'.xlsx',title,rows,columns)
  else if(format==='docx')exportDocx(filename+'.docx',title,rows,columns)
  else {
   try{printOfficeReport(title+' · '+date,rows,columns,user?.institutionName??'EduSphere 360')}
   catch(error){onToast(error instanceof Error?error.message:'Print view could not be opened.',true)}
  }
 }

 function identityCardExportData(){
  const isStudent=autoTab==='cards-students'
  const rows=people.map(person=>({
   institution:user?.institutionName??'',person_type:isStudent?'Student':autoTab==='cards-teachers'?'Teacher':'Staff',
   identifier:person.admission_no??person.employee_no??'',name:person.full_name,
   class_or_department:person.class_name??person.department??'',section:person.section_name??'',
   guardian:isStudent&&includeCardGuardian?(person.guardian_name??''):'',issue_date:cardIssueDate
  }))
  const columns:OfficeColumn[]=[
   {key:'institution',label:'Institution'},{key:'person_type',label:'Card type'},{key:'identifier',label:'ID'},
   {key:'name',label:'Name'},{key:'class_or_department',label:'Class / Department'},
   {key:'section',label:'Section'},{key:'guardian',label:'Parent / Guardian'},{key:'issue_date',label:'Issue date'}
  ]
  return {rows,columns,title:(isStudent?'Student':autoTab==='cards-teachers'?'Teacher':'Staff')+' Attendance Identity Cards'}
 }
 function printIdentityCards(){
  const isStudent=autoTab==='cards-students'
  const roleLabel=isStudent?'STUDENT':autoTab==='cards-teachers'?'TEACHER':'STAFF'
  const institutionName=String(user?.institutionName??'Government Islamia Degree College, Badin')
  const escapeHtml=(value:unknown)=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
  if(!people.length){onToast('There are no active people in this card selection.',true);return}
  const cards=people.map(person=>{
   const identifier=String(person.admission_no??person.employee_no??'').trim()
   const fullName=String(person.full_name??'')
   const initials=fullName.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()
   const classOrDepartment=autoTab==='cards-students'?[person.class_name,person.section_name].filter(Boolean).join(' · '):String(person.department??'')
   const guardian=isStudent&&includeCardGuardian?String(person.guardian_name??''):''
   return '<article class="id-card"><header><img src="'+escapeHtml(window.location.origin+'/gidc-badin-official-logo.svg')+'" alt=""><span><b>'+escapeHtml(institutionName)+'</b><small>'+roleLabel+' IDENTITY CARD · BADIN</small></span></header><section><div class="id-photo">'+escapeHtml(initials||'ID')+'</div><div class="id-person"><strong>'+escapeHtml(fullName)+'</strong><small>'+roleLabel+' · '+escapeHtml(identifier||'ID pending')+'</small>'+(includeCardClass&&classOrDepartment?'<small>'+escapeHtml(classOrDepartment)+'</small>':'')+(guardian?'<small>Guardian: '+escapeHtml(guardian)+'</small>':'')+'<small>Issued: '+escapeHtml(cardIssueDate)+'</small></div><div class="id-code">'+(identifier?'<div class="qr-code" data-qr-value="'+escapeHtml(identifier)+'"></div>':'<span class="no-qr">ID pending</span>')+'<b>'+escapeHtml(identifier||'ID PENDING')+'</b></div></section><footer><span>SCAN TO MARK ATTENDANCE</span><b>GIDC · BADIN</b></footer></article>'
  }).join('')
  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escapeHtml(roleLabel)+' attendance identity cards</title><style>'+
   '@page{size:A4 portrait;margin:8mm}*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#1d2928;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.card-grid{display:grid;grid-template-columns:repeat(2,85.6mm);grid-auto-rows:54mm;justify-content:center;gap:2mm 5mm}.id-card{width:85.6mm;height:54mm;overflow:hidden;position:relative;border:1px solid #d9cfe8;border-radius:3mm;background:linear-gradient(145deg,#fff 0%,#f7f3fd 100%);break-inside:avoid;page-break-inside:avoid}.id-card>header{height:14mm;display:flex;align-items:center;gap:3mm;padding:2mm 3mm;color:#fff;background:linear-gradient(105deg,#193e4b,#28716e)}.id-card>header img{width:10mm;height:10mm;object-fit:contain;padding:1mm;border-radius:2mm;background:#fff}.id-card>header span{min-width:0}.id-card>header b{display:block;max-width:65mm;color:#fff;font-size:8pt;line-height:1.2}.id-card>header small{display:block;margin-top:1mm;color:#eee6f8;font-size:5.5pt;font-weight:800;letter-spacing:.6px}.id-card>section{display:grid;grid-template-columns:14mm minmax(0,1fr) 18mm;align-items:center;gap:2.5mm;padding:2.5mm 3mm}.id-photo{width:13mm;height:17mm;display:grid;place-items:center;border:1px solid #cdbde3;border-radius:2mm;color:#fff;background:linear-gradient(145deg,#28716e,#8b6bc5);font-size:15pt;font-weight:800}.id-person{min-width:0;display:grid;gap:1mm}.id-person strong{color:#193e4b;font-size:8pt;line-height:1.2;overflow-wrap:anywhere}.id-person small{color:#675c75;font-size:5.2pt;line-height:1.25;overflow-wrap:anywhere}.id-code{display:grid;justify-items:center;gap:.7mm}.id-code .qr-code{width:16mm;height:16mm;display:grid;place-items:center;overflow:hidden;padding:1mm;border:1px solid #e3dced;border-radius:1mm;background:#fff}.id-code .qr-code canvas,.id-code .qr-code img{display:block;width:100%!important;height:100%!important}.id-code b{max-width:18mm;overflow-wrap:anywhere;color:#1d5a5a;font-size:5pt;text-align:center}.no-qr{display:grid;place-items:center;width:16mm;height:16mm;border:1px dashed #c9bfd7;color:#746b80;font-size:5pt}.id-card>footer{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;padding:1.7mm 3mm;color:#fff;background:#193e4b;font-size:5pt;font-weight:800;letter-spacing:.5px}@media print{.id-card{box-shadow:none}}</style></head><body><main class="card-grid">'+cards+'</main><script src="/vendor/qrcode.min.js"></script><script>window.addEventListener("load",()=>{document.querySelectorAll(".qr-code").forEach(node=>{if(window.QRCode)new window.QRCode(node,{text:node.getAttribute("data-qr-value")||"",width:58,height:58,colorDark:"#1d2928",colorLight:"#ffffff",correctLevel:0})});window.setTimeout(()=>window.print(),700)})<\/script></body></html>'
  const win=window.open('','_blank')
  if(!win){onToast('Allow pop-ups to open the card print preview.',true);return}
  win.document.open();win.document.write(html);win.document.close()
 }

 function exportIdentityCards(format:'csv'|'xlsx'|'docx'|'print'){
  const {rows,columns,title}=identityCardExportData()
  const filename='edusphere-'+autoTab+'-'+cardIssueDate
  if(format==='csv')downloadCsv(filename+'.csv',rows,columns)
  else if(format==='xlsx')exportXlsx(filename+'.xlsx',title,rows,columns)
  else if(format==='docx')exportDocx(filename+'.docx',title,rows,columns)
  else printIdentityCards()
 }

 function beginDeviceEventReview(event:RecordRow){
  const local=localEventDateTime(String(event.occurred_at??''))
  setReviewEvent(event)
  setReviewDate(local.date)
  setReviewTime(local.time)
  setReviewPeriod('Daily')
  setReviewStatus('present')
  setReviewNote('')
  setCorrectionReason('')
  setReviewShiftId('')
 }

 async function submitDeviceEventReview(action:'approve'|'reject'){
  if(!supabase||!user||!reviewEvent||reviewBusy)return
  if(action==='approve'&&(!reviewDate||!reviewTime)){
   onToast('Confirm the attendance date and local event time before approval.',true)
   return
  }
  if(reviewNote.trim().length<5){
   onToast('Enter an audit note of at least five characters.',true)
   return
  }
  const studentEvent=Boolean(reviewEvent.student_id)
  if(!canManageStaff&&(!studentEvent||!canManageStudents)){
   onToast('Your role cannot review this attendance event.',true)
   return
  }
  setReviewBusy(true)
  try{
   const {data,error}=await supabase.rpc('review_attendance_device_event',{
    p_event_id:String(reviewEvent.id),
    p_action:action,
    p_attendance_date:action==='approve'?reviewDate:null,
    p_period_label:studentEvent?reviewPeriod:'Daily',
    p_attendance_status:reviewStatus,
    p_event_time:action==='approve'?reviewTime:null,
    p_review_note:reviewNote.trim(),
    p_correction_reason:correctionReason.trim()||null,
    p_shift_id:studentEvent?null:(reviewShiftId||null)
   })
   if(error)throw error
   if(data?.already_reviewed){
    onToast('This event was already reviewed. The saved review result has been refreshed.')
   }else if(action==='approve'){
    onToast('Device event approved and reconciled to the official attendance register.')
   }else{
    onToast('Device event rejected. The original signed event remains in the audit history.')
   }
   setReviewEvent(null)
   await Promise.all([loadDevices(),loadAttendance()])
  }catch(error){
   onToast(error instanceof Error?error.message:'The attendance event could not be reviewed.',true)
  }finally{
   setReviewBusy(false)
  }
 }

 async function createDevice(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user||!canManageStaff||deviceBusy)return
  setDeviceBusy(true)
  try{
   const {data,error}=await supabase.functions.invoke('attendance-device-admin',{body:{
    action:'create',institutionId:user.institutionId,name:deviceName.trim(),providerType:deviceType,externalDeviceId:deviceId.trim()
   }})
   if(error)throw error
   if(data?.error)throw new Error(String(data.error))
   if(!data?.source?.id||!data?.secret||!data?.endpoint)throw new Error('The secure device gateway did not return its one-time setup details.')
   setDeviceSecret({sourceId:String(data.source.id),name:String(data.source.name??deviceName),secret:String(data.secret),endpoint:String(data.endpoint)})
   setShowDeviceForm(false);setDeviceName('');setDeviceId('')
   onToast('Secure device source registered. Copy its one-time signing key and configure the device gateway.')
   await loadDevices()
  }catch(error){onToast(error instanceof Error?error.message:'The device source could not be registered.',true)}
  finally{setDeviceBusy(false)}
 }

 async function rotateDeviceSecret(sourceId:string,name:string){
  if(!supabase||!user||!canManageStaff||deviceBusy)return
  setDeviceBusy(true)
  try{
   const {data,error}=await supabase.functions.invoke('attendance-device-admin',{body:{action:'rotate',institutionId:user.institutionId,sourceId}})
   if(error)throw error
   if(data?.error)throw new Error(String(data.error))
   if(!data?.secret||!data?.endpoint)throw new Error('A new signing key was not returned.')
   setDeviceSecret({sourceId,name,secret:String(data.secret),endpoint:String(data.endpoint)})
   onToast('Device signing key rotated. Update the device gateway now; the previous key is no longer valid.')
   await loadDevices()
  }catch(error){onToast(error instanceof Error?error.message:'The signing key could not be rotated.',true)}
  finally{setDeviceBusy(false)}
 }

 async function setDeviceSourceStatus(sourceId:string,action:'pause'|'activate'){
  if(!supabase||!user||!canManageStaff||deviceBusy)return
  setDeviceBusy(true)
  try{
   const {data,error}=await supabase.functions.invoke('attendance-device-admin',{body:{action,institutionId:user.institutionId,sourceId}})
   if(error)throw error
   if(data?.error)throw new Error(String(data.error))
   onToast(action==='pause'?'Device source paused. Incoming events will be rejected.':'Device source activated.')
   await loadDevices()
  }catch(error){onToast(error instanceof Error?error.message:'Device status could not be changed.',true)}
  finally{setDeviceBusy(false)}
 }

 async function copyDeviceSecret(){
  if(!deviceSecret)return
  try{
   if(!navigator.clipboard)throw new Error('Clipboard access is unavailable in this browser.')
   await navigator.clipboard.writeText(deviceSecret.secret)
   onToast('Signing key copied. Store it securely in the device gateway.')
  }catch(error){onToast(error instanceof Error?error.message:'The signing key could not be copied.',true)}
 }

 if(!user)return null
 const attendanceTitles:Record<string,string>={students:'Student Attendance',teachers:'Teacher Attendance',staff:'Staff Attendance',devices:'Automatic Attendance',history:'Attendance History','qr-scan':'QR / Barcode Attendance',biometric:'Biometric Attendance','cards-students':'Student Attendance Cards','cards-teachers':'Teacher Attendance Cards','cards-staff':'Staff Attendance Cards'}
 const attendanceTitle=autoTab==='register'?attendanceTitles[population]:attendanceTitles[autoTab]
 const registerStats=(()=>{
  const values=visiblePeople.map(person=>effectiveMarks[person.id]??'unmarked')
  return {
   total:values.length,
   present:values.filter(value=>value==='present').length,
   absent:values.filter(value=>value==='absent').length,
   leave:values.filter(value=>value==='approved_leave').length,
   pending:values.filter(value=>value==='unmarked'||value==='leave_pending').length,
   completion:values.length?Math.round(values.filter(value=>value!=='unmarked').length/values.length*100):0
  }
 })()
 return <main className="page-content ed360-module-page ed360-attendance-workspace">
  <header className="ed360-attendance-hero">
   <div><span>{(user.institutionName?.trim()||'GOVERNMENT ISLAMIA DEGREE COLLEGE').toUpperCase()} / ATTENDANCE / {attendanceTitle.toUpperCase()}</span><h1>{attendanceTitle}</h1></div>
   <button type="button" className="ed360-attendance-refresh" onClick={()=>{void loadRoster();void loadAttendance();if(['devices','biometric'].includes(autoTab))void loadDevices()}} disabled={loading||deviceBusy}><RefreshCw size={15}/>{loading||deviceBusy?'Refreshing…':'Refresh'}</button>
  </header>
  {autoTab==='register'&&<section className="ed360-attendance-summary" aria-label="Attendance register summary">
   <article className="attendance-summary-total"><span>ROSTER SIZE</span><strong>{loading?'—':registerStats.total.toLocaleString()}</strong><small>{population==='students'?'Active students':population==='teachers'?'Active teachers':'Active staff'}</small></article>
   <article className="attendance-summary-present"><span>PRESENT</span><strong>{loading?'—':registerStats.present.toLocaleString()}</strong><small>Marked present</small></article>
   <article className="attendance-summary-absent"><span>ABSENT</span><strong>{loading?'—':registerStats.absent.toLocaleString()}</strong><small>Marked absent</small></article>
   <article className="attendance-summary-leave"><span>ON LEAVE</span><strong>{loading?'—':registerStats.leave.toLocaleString()}</strong><small>Approved leave</small></article>
   <article className="attendance-summary-pending"><span>REQUIRES ACTION</span><strong>{loading?'—':registerStats.pending.toLocaleString()}</strong><small>Unmarked or leave pending</small></article>
   <article className="attendance-summary-progress"><span>REGISTER COMPLETION</span><strong>{loading?'—':registerStats.completion+'%'}</strong><div className="attendance-progress-track"><i style={{width:registerStats.completion+'%'}}/></div><small>Based on the filtered roster</small></article>
  </section>}
  <div className="ed360-attendance-main-tabs">
   <button className={autoTab==='register'?'active':''} onClick={()=>setAutoTab('register')}>Manual register</button>
   <button className={autoTab==='history'?'active':''} onClick={()=>setAutoTab('history')}>Attendance history</button>
   {(canManageStudents||canManageStaff)&&<button className={autoTab==='devices'?'active':''} onClick={()=>{setAutoTab('devices');void loadDevices()}}>Device connections & review</button>}
   {(canManageStudents||canManageStaff)&&<><button className={autoTab==='qr-scan'?'active':''} onClick={()=>{setAutoTab('qr-scan');setScanResult('')}}>QR / barcode</button><button className={autoTab==='biometric'?'active':''} onClick={()=>setAutoTab('biometric')}>Biometric</button></>}
   {canManageStaff&&<button className={['cards-students','cards-teachers','cards-staff'].includes(autoTab)?'active':''} onClick={()=>setAutoTab(population==='students'?'cards-students':population==='teachers'?'cards-teachers':'cards-staff')}>ID cards</button>}
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
    <div className="ed360-attendance-roster-meta"><div><strong>{population==='students'?className||'Choose a class':'Employee register'}</strong><span>{date} · {population==='students'?period:'Daily'}{shiftId?' · '+String(shifts.find(s=>s.id===shiftId)?.name??'Shift'):''}</span></div><div className="ed360-attendance-bulk">{!readOnly&&<><button type="button" onClick={()=>markAll('present')}><i className="mark-p">P</i> All present</button><button type="button" onClick={()=>markAll('absent')}><i className="mark-a">A</i> All absent</button><button type="button" onClick={()=>markAll('approved_leave')}><i className="mark-leave">LV</i> All on approved leave</button><button type="button" onClick={()=>markAll('leave_pending')}><i className="mark-pending">NP</i> All leave not approved</button></>}</div></div>
   </section>
   <section className="ed360-attendance-board">
    <div className="ed360-attendance-board-head"><div><span>REGISTER CHART</span><h2>{population==='students'?'Class attendance register':population==='teachers'?'Teacher attendance register':'Staff attendance register'}</h2><p>Each row is one person. Use the status controls in the row or bulk-mark the whole roster above.</p></div></div>
    {loading?<div className="ed360-attendance-empty">Loading the institution roster…</div>:loadingError?<div className="ed360-attendance-empty error">{loadingError}</div>:visiblePeople.length===0?<div className="ed360-attendance-empty">{people.length?'No matching names. Clear your search.':'No active people were found in this roster.'}</div>:
    <div className="ed360-attendance-grid-table"><div className="attendance-grid-head"><span>Roll / Employee ID</span><span>Name</span><span>Father / Guardian</span><span>Section / Department</span><span>Attendance mark</span><span>Note (optional)</span></div>
     {visiblePeople.map((person,index)=><div className="attendance-grid-row" key={person.id}><span className="attendance-grid-id">{person.admission_no??person.employee_no??String(index+1).padStart(2,'0')}</span><strong>{person.full_name}</strong><span>{person.guardian_name??'—'}</span><span>{[person.class_name,person.section_name,person.department].filter(Boolean).join(' / ')||(population==='teachers'?'Teacher':'Employee')}</span>
      <div className="attendance-mark-options">
       {(['present','absent','approved_leave','leave_pending'] as AttendanceMark[]).map(s=><button type="button" disabled={readOnly} key={s} title={s==='leave_pending'?'Leave not approved':s==='approved_leave'?'Approved leave':s==='present'?'Present':'Absent'} aria-label={person.full_name+': '+(s==='leave_pending'?'Leave not approved':s==='approved_leave'?'Approved leave':s)} aria-pressed={effectiveMarks[person.id]===s} className={'attendance-mark-button mark-'+(s==='approved_leave'?'leave':s==='leave_pending'?'pending':s.charAt(0))} onClick={()=>markOne(person.id,s)}>{statusLabel(s)}</button>)}
      </div>
      <div className="attendance-time-fields"><input aria-label="Arrival or check-in time" type="time" value={arrivalTimes[person.id]??''} onChange={e=>setArrivalTimes(v=>({...v,[person.id]:e.target.value}))} disabled={readOnly} title="Arrival / check-in"/><input aria-label="Departure or check-out time" type="time" value={departureTimes[person.id]??''} onChange={e=>setDepartureTimes(v=>({...v,[person.id]:e.target.value}))} disabled={readOnly} title="Departure / check-out"/>{population==='students'&&<input aria-label="Early departure minutes" type="number" min="0" max="1440" value={earlyMinutes[person.id]??'0'} onChange={e=>setEarlyMinutes(v=>({...v,[person.id]:e.target.value}))} disabled={readOnly} placeholder="Early min"/>}<input className="attendance-note-input" value={notes[person.id]??''} onChange={e=>setNotes(current=>({...current,[person.id]:e.target.value}))} disabled={readOnly} placeholder="Reason / note"/></div>
     </div>)}
    </div>}
    <div className="ed360-attendance-board-footer"><div><span className="attendance-legend"><i className="mark-p">P</i> Present</span><span className="attendance-legend"><i className="mark-a">A</i> Absent</span><span className="attendance-legend"><i className="mark-leave">LV</i> Approved leave</span><span className="attendance-legend"><i className="mark-pending">NP</i> Leave not approved</span></div><div>{lastSaved&&<span className="ed360-last-saved"><Check size={13}/> Last saved {lastSaved}</span>}<div className="ed360-attendance-export-actions" aria-label="Export attendance register">
    <button type="button" className="button button-outline" onClick={()=>exportRegister('csv')}><Download size={14}/> CSV</button>
    <button type="button" className="button button-outline" onClick={()=>exportRegister('xlsx')}>Excel</button>
    <button type="button" className="button button-outline" onClick={()=>exportRegister('docx')}>Word</button>
    <button type="button" className="button button-outline" onClick={()=>exportRegister('print')}><Printer size={14}/> Print / PDF</button>
   </div>{!readOnly&&<button type="button" className="button button-primary" disabled={saving||loading||!people.length||(population==='students'&&!canManageStudents)||(population==='staff'&&!canManageStaff)} onClick={()=>void saveRegister()}>{saving?'Saving whole register…':'Save whole register'}</button>}</div></div>
   </section>
   <p className="ed360-attendance-method-note">Unmarked people remain pending and must be assigned a status before the register can be saved. Record arrival/check-in and departure/check-out times for late-arrival and early-departure reporting. No person is silently marked present. Legacy Late and Excused entries remain readable in history; new registers do not offer Late marking.</p>
  </>}
  {autoTab==='history'&&<section className="ed360-attendance-board">
   <div className="ed360-attendance-board-head">
    <div><span>REGISTER HISTORY</span><h2>Saved attendance history</h2><p>Choose the roster and date to inspect stored attendance entries.</p></div>
    <div className="ed360-attendance-history-controls">
     <label>Roster<select value={population} onChange={e=>{setPopulation(e.target.value as 'students'|'teachers'|'staff');setHistorySearch('')}} disabled={readOnly}><option value="students">Students</option>{canManageStaff&&<><option value="teachers">Teachers</option><option value="staff">Staff</option></>}</select></label>
     {population==='students'&&canManageStudents&&<><label>Class<select value={className} onChange={e=>{setClassName(e.target.value);setSectionName('')}}><option value="">All classes</option>{classes.map(value=><option key={value} value={value}>{value}</option>)}</select></label><label>Section<select value={sectionName} onChange={e=>setSectionName(e.target.value)}><option value="">All sections</option>{sections.map(value=><option key={value} value={value}>{value}</option>)}</select></label></>}
     <label>Date<input type="date" value={date} max={today()} onChange={e=>setDate(e.target.value)}/></label>
     
    </div>
   </div>
   <label className="ed360-attendance-search"><Search size={15}/><input value={historySearch} onChange={e=>setHistorySearch(e.target.value)} placeholder="Search person, ID, status or note"/></label>
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
   {canManageStaff&&<>
    <div className="ed360-attendance-board-head"><div><span>SECURE AUTOMATIC ATTENDANCE</span><h2>Device connections</h2><p>Register a trusted reader or gateway, issue a one-time signing key, then receive authenticated attendance events.</p></div><button className="button button-primary" onClick={()=>setShowDeviceForm(true)}>+ Register device source</button></div>
    
    {deviceSecret&&<section className="ed360-device-secret-panel" aria-live="polite">
     <div><span>ONE-TIME DEVICE CREDENTIAL</span><h3>Copy the signing key for {deviceSecret.name}</h3><p>This key is shown only after creation or rotation. It is not retrievable from the page later; rotate it if it is lost.</p></div>
     <div className="ed360-device-secret-value"><code>{deviceSecret.secret}</code><button type="button" className="button button-outline" onClick={()=>void copyDeviceSecret()}><Copy size={14}/> Copy key</button><button type="button" className="button button-outline" onClick={()=>setDeviceSecret(null)}>Hide</button></div>
     <div className="ed360-device-setup-details"><b>Webhook endpoint</b><code>{deviceSecret.endpoint}</code><b>Required request headers</b><code>X-EDUSPHERE-DEVICE-ID: {deviceSecret.sourceId}</code><code>X-EDUSPHERE-TIMESTAMP: Unix time in seconds</code><code>X-EDUSPHERE-SIGNATURE: v1= + HMAC-SHA256(key, timestamp + "." + exact JSON body)</code><b>Signed heartbeat payload (device-health check)</b><code>{'{"event_type":"heartbeat"}'}</code><b>Attendance event JSON fields</b><code>{'{"external_event_id":"unique-device-event-id","person_type":"student","person_id":"internal-UUID","occurred_at":"ISO-8601","event_kind":"check_in","match_result":true,"verification_method":"fingerprint"}'}</code></div>
    </section>}
    <div className="ed360-device-list">{devices.length?devices.map(device=><article className="ed360-device-list-row" key={String(device.id)}>
     <div className="ed360-device-list-identity"><span><Fingerprint size={18}/></span><div><b>{String(device.name??'Device source')}</b><small>{String(device.provider_type??'provider').toUpperCase()} · {String(device.external_device_id??'No external device ID')}</small><small>Source ID: {String(device.id)}</small></div></div>
     <div className="ed360-device-list-state"><em className={'device-state-'+String(device.status??'not_configured')}>{String(device.status??'not_configured').replaceAll('_',' ')}</em><small>{device.last_synced_at?'Last device sync: '+new Date(String(device.last_synced_at)).toLocaleString():'Awaiting first signed event'}</small>{Boolean(device.last_error)&&<small className="device-last-error">{String(device.last_error)}</small>}</div>
     <div className="ed360-device-list-actions"><button type="button" className="button button-outline" disabled={deviceBusy} onClick={()=>void rotateDeviceSecret(String(device.id),String(device.name??'Device source'))}>Rotate key</button>{String(device.status)==='paused'?<button type="button" className="button button-outline" disabled={deviceBusy} onClick={()=>void setDeviceSourceStatus(String(device.id),'activate')}>Activate</button>:<button type="button" className="button button-outline" disabled={deviceBusy} onClick={()=>void setDeviceSourceStatus(String(device.id),'pause')}>Pause</button>}</div>
    </article>):<p className="ed360-attendance-empty">No device sources have been registered.</p>}</div>
   </>}
   <section className="ed360-device-events">
    <div className="ed360-attendance-board-head"><div><span>REVIEW & RECONCILIATION QUEUE</span><h2>Signed device events</h2><p>Confirm the linked person and device time. Approvals update the official attendance register; rejections remain in immutable event history.</p></div></div>
    {deviceEvents.length?<div className="ed360-device-event-list">{deviceEvents.map(event=>{
     const isStudent=Boolean(event.student_id)
     const personId=String(isStudent?event.student_id??'':event.teacher_id??'')
     const person=isStudent?students.find(item=>item.id===personId):staff.find(item=>item.id===personId)
     const source=devices.find(item=>String(item.id)===String(event.source_id))
     const status=String(event.processing_status??'received')
     const canReview=status==='received'&&(canManageStaff||(canManageStudents&&isStudent))
     return <article className="ed360-device-event-card" key={String(event.id)}>
      <div className="ed360-device-event-summary"><span className="device-event-kind">{String(event.event_kind??'event').replaceAll('_',' ').toUpperCase()}</span><b>{person?.full_name??(isStudent?'Student identity':'Employee identity')+' · '+personId.slice(0,8)}</b><small>{isStudent?'Student':'Employee'}{person?.class_name?' · '+person.class_name:''}{person?.section_name?' / '+person.section_name:''}{person?.department?' · '+person.department:''}</small></div>
      <div className="ed360-device-event-meta"><b>{new Date(String(event.occurred_at)).toLocaleString()}</b><small>{source?.name?String(source.name):'Device source '+String(event.source_id??'').slice(0,8)}</small><small>Event ID: {String(event.external_event_id??'')}</small></div>
      <div className="ed360-device-event-state"><em className={'event-state-'+status}>{status.replaceAll('_',' ')}</em>{Boolean(event.review_action)&&<small>{String(event.review_action)} · {event.reviewed_at?new Date(String(event.reviewed_at)).toLocaleString():''}</small>}{Boolean(event.review_note)&&<small>{String(event.review_note)}</small>}</div>
      {canReview?<button type="button" className="button button-primary" onClick={()=>beginDeviceEventReview(event)}>Review event</button>:<span className="ed360-device-event-closed">{status==='processed'?'Applied to attendance':status==='rejected'?'Rejected':'No review action'}</span>}
     </article>
    })}</div>:<p className="ed360-attendance-empty">No signed device events have been received.</p>}
   </section>
   
  </section>}

   {autoTab==='qr-scan'&&<section className="ed360-attendance-board ed360-attendance-special"><div className="ed360-attendance-board-head"><div><span>IDENTITY CHECK-IN</span><h2>QR / barcode attendance</h2></div></div>{!canManageStudents&&!canManageStaff?<div className="ed360-attendance-empty">Your role cannot record attendance from an identity scan.</div>:<><div className="ed360-scan-controls"><label>Roster<select value={population} onChange={e=>{setPopulation(e.target.value as 'students'|'teachers'|'staff');setScanResult('')}}><option value="students">Students</option>{canManageStaff&&<><option value="teachers">Teachers</option><option value="staff">Staff</option></>}</select></label><label>Class<select value={className} onChange={e=>{setClassName(e.target.value);setSectionName('')}} disabled={population!=='students'}><option value="">All classes</option>{classes.map(v=><option key={v}>{v}</option>)}</select></label><label>Section<select value={sectionName} onChange={e=>setSectionName(e.target.value)} disabled={population!=='students'}><option value="">All sections</option>{sections.map(v=><option key={v}>{v}</option>)}</select></label><label>Date<input type="date" max={today()} value={date} onChange={e=>setDate(e.target.value)}/></label></div><label className="ed360-scan-input">Scan or enter Admission / Employee ID<input autoFocus value={scanCode} onChange={e=>setScanCode(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();const key=scanCode.trim().toLowerCase();const p=people.find(x=>String(x.admission_no??x.employee_no??'').trim().toLowerCase()===key);if(!p){setScanResult('No matching person found in the selected roster. Check the ID and filters.');return}if(population==='students'&&!canManageStudents){setScanResult('You do not have permission to mark student attendance.');return}if(population!=='students'&&!canManageStaff){setScanResult('Only owner and administrator accounts may mark employee attendance.');return}markOne(p.id,'present');setScanResult(p.full_name+' marked Present in the pending register. Save the whole register to commit this entry.');setScanCode('')}}} placeholder="Scan or enter ID"/></label><div className="ed360-mobile-scan-panel"><div><strong>Camera scan</strong>{cameraMessage&&<p>{cameraMessage}</p>}</div>{cameraActive?<button type="button" className="button button-outline" onClick={stopQrCamera}>Stop camera</button>:<button type="button" className="button button-primary" onClick={()=>void startQrCamera()}>Use phone camera</button>}</div><div className="ed360-camera-preview" hidden={!cameraActive}><video ref={videoRef} autoPlay playsInline muted aria-label="QR and barcode camera preview"/></div>{scanResult&&<div className="ed360-scan-result" role="status">{scanResult}</div>}<div className="ed360-attendance-board-footer"><button type="button" className="button button-outline" onClick={()=>setAutoTab('register')}>Review pending register</button><button type="button" className="button button-primary" onClick={()=>void saveRegister()} disabled={saving||!people.length}>Save attendance register</button></div></>}</section>}
   {autoTab==='biometric'&&<section className="ed360-attendance-board ed360-attendance-special"><div className="ed360-attendance-board-head"><div><span>DEVICE-BOUND IDENTITY</span><h2>Biometric attendance verification</h2><p>Design for supported fingerprint or device authentication without collecting raw fingerprint images in this web application.</p></div></div><div className="ed360-biometric-grid"><div className="ed360-biometric-mark"><Fingerprint size={38}/><b>Device-side verification</b><small>Passkey / WebAuthn or a trusted vendor connector</small></div><div><h3>Privacy and deployment status</h3><p>Modern browser biometrics do not expose the fingerprint image or template to a website. A phone's side power-button fingerprint is verified by the operating system; the site receives a cryptographic authentication result, not the fingerprint itself.</p><p>No biometric enrollment or device feed is active in this workspace yet. Register a trusted biometric provider under Device connections, complete signed event integration and test identity matching before enabling attendance writes.</p><span className="ed360-biometric-status">Not connected · no biometric attendance is being recorded</span></div></div><div className="ed360-attendance-board-footer"><button className="button button-outline" type="button" onClick={()=>{setAutoTab('devices');void loadDevices()}}>Open trusted device connections</button></div></section>}
   {['cards-students','cards-teachers','cards-staff'].includes(autoTab)&&<section className="ed360-attendance-board ed360-attendance-special"><div className="ed360-attendance-board-head"><div><span>IDENTITY CARD STUDIO</span><h2>{autoTab==='cards-students'?'Student attendance cards':autoTab==='cards-teachers'?'Teacher attendance cards':'Staff attendance cards'}</h2><p>Choose a white-paper card layout, review the live roster preview, then export or print the selected institution records.</p></div></div><div className="ed360-card-toolbar"><label>Class<select value={className} onChange={e=>setClassName(e.target.value)} disabled={autoTab!=='cards-students'}><option value="">All classes</option>{classes.map(v=><option key={v}>{v}</option>)}</select></label><label>Section<select value={sectionName} onChange={e=>setSectionName(e.target.value)} disabled={autoTab!=='cards-students'}><option value="">All sections</option>{sections.map(v=><option key={v}>{v}</option>)}</select></label><label>Card template<select value={cardTemplate} onChange={e=>setCardTemplate(e.target.value as 'classic'|'compact'|'portrait')}><option value="classic">Classic white</option><option value="compact">Compact white</option><option value="portrait">Portrait white</option></select></label><label>Issue date<input type="date" value={cardIssueDate} onChange={e=>setCardIssueDate(e.target.value)}/></label><span>{people.length} cards in preview</span></div><div className="ed360-card-options"><label><input type="checkbox" checked={includeCardClass} onChange={e=>setIncludeCardClass(e.target.checked)}/> Show class / department</label>{autoTab==='cards-students'&&<label><input type="checkbox" checked={includeCardGuardian} onChange={e=>setIncludeCardGuardian(e.target.checked)}/> Show parent / guardian</label>}</div><div className="ed360-card-export-actions" aria-label="Export attendance identity cards"><button type="button" className="button button-outline" onClick={()=>exportIdentityCards('csv')}><Download size={14}/> CSV</button><button type="button" className="button button-outline" onClick={()=>exportIdentityCards('xlsx')}>Excel</button><button type="button" className="button button-outline" onClick={()=>exportIdentityCards('docx')}>Word</button><button type="button" className="button button-outline" onClick={()=>exportIdentityCards('print')}><Printer size={14}/> Print / PDF</button></div><div className="ed360-attendance-card-grid">{people.map(person=><article className={'ed360-print-id-card template-'+cardTemplate} key={person.id}><div className="ed360-print-id-head"><b>{user?.institutionName?.trim()||'Institution name not set'}</b><small>{autoTab==='cards-students'?'STUDENT':autoTab==='cards-teachers'?'TEACHER':'STAFF'} ATTENDANCE IDENTITY CARD</small></div><div className="ed360-print-id-body"><div className="ed360-print-id-photo">{person.full_name.slice(0,1).toUpperCase()}</div><div className="ed360-print-id-details"><h3>{person.full_name}</h3><p>{autoTab==='cards-students'?'Student':autoTab==='cards-teachers'?'Teacher':'Staff'}</p><b>{autoTab==='cards-students'?(person.admission_no??'ID pending'):(person.employee_no??'ID pending')}</b>{includeCardClass&&<small>{[person.class_name,person.section_name,person.department].filter(Boolean).join(' · ')||'Class / department not set'}</small>}{autoTab==='cards-students'&&includeCardGuardian&&<small>Guardian: {person.guardian_name??'Not set'}</small>}<small>Issued: {cardIssueDate}</small></div>{String(person.admission_no??person.employee_no??'').trim()&&<LocalQrCode value={String(person.admission_no??person.employee_no??'').trim()} size={60} label={'Attendance QR for '+person.full_name}/>}</div><div className="ed360-print-id-foot"><span>SCAN TO MARK ATTENDANCE</span><span>GIDC · BADIN</span></div></article>)}</div>{people.length===0&&<p className="ed360-attendance-empty">No active records are available for this card selection.</p>}<div className="ed360-device-notice"><QrCode size={20}/><div><b>QR attendance cards</b><p>Each card QR contains the person's existing admission number or employee number. The attendance scanner looks up that same identifier in the selected institution roster; scanning marks Present in the pending register, and an authorised user must save the register to commit attendance.</p></div></div></section>}
  {showShiftForm&&<div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-heading"><div><h2>Employee shifts</h2><p>Define start time, finish time and permitted grace period for attendance calculations.</p></div><button type="button" className="icon-button" onClick={()=>setShowShiftForm(false)}><X size={18}/></button></div><form className="ed360-context-form-grid" onSubmit={createShift}><label>Shift name<input required value={shiftName} onChange={e=>setShiftName(e.target.value)}/></label><label>Start time<input type="time" required value={shiftStart} onChange={e=>setShiftStart(e.target.value)}/></label><label>End time<input type="time" required value={shiftEnd} onChange={e=>setShiftEnd(e.target.value)}/></label><label>Grace minutes<input type="number" min="0" max="240" value={shiftGrace} onChange={e=>setShiftGrace(e.target.value)}/></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowShiftForm(false)}>Cancel</button><button type="submit" className="button button-primary">Save shift</button></div></form></section></div>}
  {showDeviceForm&&<div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-heading"><div><h2>Register attendance source</h2><p>Register a source before connecting its provider or device feed.</p></div><button type="button" className="icon-button" onClick={()=>setShowDeviceForm(false)}><X size={18}/></button></div><form className="ed360-context-form-grid" onSubmit={createDevice}><label>Device / provider name<input required value={deviceName} onChange={e=>setDeviceName(e.target.value)}/></label><label>Source type<select value={deviceType} onChange={e=>setDeviceType(e.target.value)}><option value="qr">QR</option><option value="rfid">RFID</option><option value="biometric">Biometric</option><option value="third_party">Third-party device gateway</option></select></label><label>External device ID (optional)<input value={deviceId} onChange={e=>setDeviceId(e.target.value)}/></label><div className="ed360-device-notice"><Activity size={18}/><p>Copy the signing key once, then configure the device to send events to the HTTPS endpoint.</p></div><div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowDeviceForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={deviceBusy}>{deviceBusy?'Creating secure source…':'Create secure device source'}</button></div></form></section></div>}
  {reviewEvent&&<div className="modal-backdrop"><section className="modal-card ed360-device-review-modal" role="dialog" aria-modal="true" aria-labelledby="ed360-device-review-title">
   <div className="modal-heading"><div><span className="ed360-review-eyebrow">HUMAN REVIEW REQUIRED</span><h2 id="ed360-device-review-title">Review device attendance event</h2><p>Check the identity, event type and local time before applying it to the official register.</p></div><button type="button" className="icon-button" onClick={()=>setReviewEvent(null)} disabled={reviewBusy}><X size={18}/></button></div>
   <div className="ed360-device-review-identity"><Fingerprint size={20}/><div><b>{Boolean(reviewEvent.student_id)?(students.find(item=>item.id===String(reviewEvent.student_id))?.full_name??'Student record'): (staff.find(item=>item.id===String(reviewEvent.teacher_id))?.full_name??'Employee record')}</b><small>{String(reviewEvent.event_kind??'event').replaceAll('_',' ').toUpperCase()} · {new Date(String(reviewEvent.occurred_at)).toLocaleString()}</small><small>Original event: {String(reviewEvent.external_event_id??'')}</small></div></div>
   <form className="ed360-context-form-grid" onSubmit={e=>{e.preventDefault();void submitDeviceEventReview('approve')}}>
    <label>Attendance date<input type="date" required value={reviewDate} onChange={e=>setReviewDate(e.target.value)}/></label>
    <label>Confirmed local event time<input type="time" required value={reviewTime} onChange={e=>setReviewTime(e.target.value)}/></label>
    {Boolean(reviewEvent.student_id)&&<label>Student attendance period<select value={reviewPeriod} onChange={e=>setReviewPeriod(e.target.value)}>{['Daily','Period 1','Period 2','Period 3','Period 4','Period 5','Period 6','Morning','Afternoon'].map(value=><option key={value}>{value}</option>)}</select></label>}
    {String(reviewEvent.event_kind)==='check_in'&&<label>Approved attendance status<select value={reviewStatus} onChange={e=>setReviewStatus(e.target.value)}>{(Boolean(reviewEvent.student_id)?['present','late']:['present','late','remote','half_day']).map(value=><option key={value} value={value}>{value.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase())}</option>)}</select></label>}
    {!Boolean(reviewEvent.student_id)&&String(reviewEvent.event_kind)==='check_in'&&<label>Employee shift (optional)<select value={reviewShiftId} onChange={e=>setReviewShiftId(e.target.value)}><option value="">Use no shift calculation</option>{shifts.map(shift=><option key={String(shift.id)} value={String(shift.id)}>{String(shift.name)} · {String(shift.start_time).slice(0,5)}–{String(shift.end_time).slice(0,5)}</option>)}</select></label>}
    <label className="ed360-review-full">Review note (required)<textarea required minLength={5} rows={3} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Example: Confirmed the student identity and device timestamp against the daily register."/></label>
    <label className="ed360-review-full">Correction reason (when replacing an existing entry)<textarea rows={2} value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)} placeholder="Required when correcting an existing manual/device entry or a published register."/></label>
    <p className="ed360-review-hint">Check-out events update an existing attendance record only. They cannot create a new attendance entry. Locked registers must be formally reopened before device events can be applied.</p>
    <div className="modal-actions ed360-review-actions"><button type="button" className="button button-outline" onClick={()=>setReviewEvent(null)} disabled={reviewBusy}>Cancel</button><button type="button" className="button button-outline ed360-review-reject" onClick={()=>void submitDeviceEventReview('reject')} disabled={reviewBusy}>{reviewBusy?'Saving…':'Reject event'}</button><button type="submit" className="button button-primary" disabled={reviewBusy}>{reviewBusy?'Applying…':'Approve & apply attendance'}</button></div>
   </form>
  </section></div>}

 </main>
}
