import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Activity, AlertTriangle, CalendarDays, Download, FileText,
  HeartPulse, LockKeyhole, MessageSquare, RefreshCw, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { downloadCsv } from '../lib/csv'
import { userFacingError } from '../lib/userErrors'
import type { RecordRow } from '../lib/types'
import '../styles/stage7-workspace.css'

type WindowKey = 'leave'|'reports'|'discipline'|'counselling'|'health'
type Student = { id:string; full_name:string; admission_no:string; class_name:string; campus_id?:string|null }
type Employee = { id:string; user_id?:string|null; full_name:string; employee_no:string; employee_type:string; department?:string|null; campus_id?:string|null }
type CareGrant = { area:'discipline'|'counselling'|'health'; can_read:boolean; can_write:boolean }
type LeaveRow = RecordRow & { person_type?:'student'|'employee' }
type GuardianLink = { student_id:string; parent_user_id:string; relationship?:string|null }
type AttendanceReportRow = RecordRow & {
  student_id?:string|null; student_name?:string|null; class_name?:string|null; attendance_date?:string
  status?:string; period_label?:string|null; arrival_time?:string|null; departure_time?:string|null
  minutes_late?:number|null; early_departure_minutes?:number|null; notes?:string|null
  teacher_id?:string|null; check_in_time?:string|null; check_out_time?:string|null
}
const today = () => new Date().toLocaleDateString('en-CA')
const dayCount = (start:string,end:string) => Math.max(0,Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000)+1)
const areaLabels:Record<string,string>={discipline:'Student Discipline',counselling:'Counselling & Wellbeing',health:'Health & Emergency'}
const message = (error:unknown,fallback:string) => userFacingError(error,fallback)

export function Stage7CareWorkspace({initialWindow='leave',onToast}:{initialWindow?:string;onToast:(message:string,error?:boolean)=>void}) {
  const {user}=useAuth()
  const activeWindow=(['leave','reports','discipline','counselling','health'].includes(initialWindow)?initialWindow:'leave') as WindowKey
  const isAdmin=Boolean(user&&['owner','admin'].includes(user.role))
  const isStudentOrParent=Boolean(user&&['student','parent'].includes(user.role))
  const [students,setStudents]=useState<Student[]>([])
  const [employees,setEmployees]=useState<Employee[]>([])
  const [grants,setGrants]=useState<CareGrant[]>([])
  const [loading,setLoading]=useState(true)
  const [loadError,setLoadError]=useState('')
  const [refreshKey,setRefreshKey]=useState(0)
  const [leaveRows,setLeaveRows]=useState<LeaveRow[]>([])
  const [leaveBalances,setLeaveBalances]=useState<RecordRow[]>([])
  const [leaveKind,setLeaveKind]=useState<'student'|'employee'>(isStudentOrParent?'student':'employee')
  const [leavePerson,setLeavePerson]=useState('')
  const [leaveType,setLeaveType]=useState('sick')
  const [leaveStart,setLeaveStart]=useState(today())
  const [leaveEnd,setLeaveEnd]=useState(today())
  const [leaveReason,setLeaveReason]=useState('')
  const [leaveFile,setLeaveFile]=useState<File|null>(null)
  const [reviewNotes,setReviewNotes]=useState<Record<string,string>>({})
  const [saving,setSaving]=useState(false)
  const [leavePeriod,setLeavePeriod]=useState<'week'|'month'|'year'|'session'|'all'>('month')
  const [leaveStatusFilter,setLeaveStatusFilter]=useState('all')
  const [leavePeopleFilter,setLeavePeopleFilter]=useState<'all'|'student'|'employee'>('all')
  const [reportFrom,setReportFrom]=useState(today().slice(0,8)+'01')
  const [reportTo,setReportTo]=useState(today())
  const [reportClass,setReportClass]=useState('')
  const [studentAttendance,setStudentAttendance]=useState<AttendanceReportRow[]>([])
  const [employeeAttendance,setEmployeeAttendance]=useState<AttendanceReportRow[]>([])
  const [careEvents,setCareEvents]=useState<RecordRow[]>([])
  const [selectedStudent,setSelectedStudent]=useState('')
  const [eventType,setEventType]=useState('incident')
  const [eventSeverity,setEventSeverity]=useState('medium')
  const [eventDate,setEventDate]=useState(today())
  const [eventCategory,setEventCategory]=useState('Conduct')
  const [eventSummary,setEventSummary]=useState('')
  const [eventDescription,setEventDescription]=useState('')
  const [eventLocation,setEventLocation]=useState('')
  const [eventAction,setEventAction]=useState('')
  const [eventStaff,setEventStaff]=useState('')
  const [eventFollowUp,setEventFollowUp]=useState(false)
  const [eventFollowUpDate,setEventFollowUpDate]=useState('')
  const [parentMessage,setParentMessage]=useState('')
  const [sendParentMessage,setSendParentMessage]=useState(false)
  const [guardianLinks,setGuardianLinks]=useState<GuardianLink[]>([])
  const [careAccessRows,setCareAccessRows]=useState<RecordRow[]>([])
  const [grantUser,setGrantUser]=useState('')
  const [grantArea,setGrantArea]=useState<'discipline'|'counselling'|'health'>('discipline')
  const [grantRead,setGrantRead]=useState(true)
  const [grantWrite,setGrantWrite]=useState(false)
  const [grantReason,setGrantReason]=useState('')
  const [appointments,setAppointments]=useState<RecordRow[]>([])
  const [appointmentStudent,setAppointmentStudent]=useState('')
  const [appointmentType,setAppointmentType]=useState('general')
  const [appointmentNotes,setAppointmentNotes]=useState('')
  const [appointmentDate,setAppointmentDate]=useState('')
  const [appointmentAssignedTo,setAppointmentAssignedTo]=useState('')
  const [counsellingNotes,setCounsellingNotes]=useState<RecordRow[]>([])
  const [noteStudent,setNoteStudent]=useState('')
  const [noteAppointment,setNoteAppointment]=useState('')
  const [noteConcern,setNoteConcern]=useState('')
  const [notePrivate,setNotePrivate]=useState('')
  const [notePlan,setNotePlan]=useState('')
  const [noteFollowUp,setNoteFollowUp]=useState('')
  const [healthRecords,setHealthRecords]=useState<RecordRow[]>([])
  const [healthIncidents,setHealthIncidents]=useState<RecordRow[]>([])
  const [emergencyContacts,setEmergencyContacts]=useState<RecordRow[]>([])
  const [healthStudent,setHealthStudent]=useState('')
  const [healthType,setHealthType]=useState('clinic_visit')
  const [healthDate,setHealthDate]=useState(today())
  const [healthSummary,setHealthSummary]=useState('')
  const [healthDetails,setHealthDetails]=useState('')
  const [clinicName,setClinicName]=useState('')
  const [healthAction,setHealthAction]=useState('')
  const [healthFollowUp,setHealthFollowUp]=useState('')
  const [incidentType,setIncidentType]=useState('Medical incident')
  const [incidentDescription,setIncidentDescription]=useState('')
  const [incidentLocation,setIncidentLocation]=useState('')
  const [incidentAction,setIncidentAction]=useState('')
  const [incidentClinic,setIncidentClinic]=useState('')
  const [incidentFollowUp,setIncidentFollowUp]=useState('')
  const [contactStudent,setContactStudent]=useState('')
  const [contactName,setContactName]=useState('')
  const [contactRelationship,setContactRelationship]=useState('Parent')
  const [contactPhone,setContactPhone]=useState('')
  const [contactAltPhone,setContactAltPhone]=useState('')
  const [contactEmail,setContactEmail]=useState('')
  const [balancePerson,setBalancePerson]=useState('')
  const [balanceType,setBalanceType]=useState('annual')
  const [balanceEntitlement,setBalanceEntitlement]=useState('12')
  const [balanceYear,setBalanceYear]=useState(String(new Date().getFullYear()))

  const grantFor=(area:CareGrant['area'])=>grants.find(item=>item.area===area)
  const canRead=(area:CareGrant['area'])=>isAdmin||Boolean(grantFor(area)?.can_read)
  const canWrite=(area:CareGrant['area'])=>isAdmin||Boolean(grantFor(area)?.can_write)
  const currentStudents=students
  const selectedLeavePeople=leaveKind==='student'?currentStudents:employees
  const leaveTypeOptions=leaveKind==='student'
    ?['sick','family','personal','other']
    :['annual','sick','casual','unpaid','maternity','paternity','other']

  const loadBase=useCallback(async()=>{
    if(!supabase||!user){setLoading(false);return}
    setLoading(true);setLoadError('')
    try{
      const studentQuery=supabase.from('students').select('id,full_name,admission_no,class_name,campus_id,status')
        .eq('institution_id',user.institutionId).eq('status','active').order('class_name').order('full_name')
      const studentResult=await studentQuery
      if(studentResult.error)throw studentResult.error
      setStudents((studentResult.data??[]) as Student[])
      if(['owner','admin','teacher'].includes(user.role)){
        const empResult=await supabase.from('teachers').select('id,user_id,full_name,employee_no,employee_type,department,campus_id,employment_status')
          .eq('institution_id',user.institutionId).eq('employment_status','active').order('full_name')
        if(empResult.error&&user.role!=='teacher')throw empResult.error
        setEmployees((empResult.data??[]) as Employee[])
      }else setEmployees([])
      if(user.role==='teacher'){
        const grantResult=await supabase.from('student_care_access').select('area,can_read,can_write')
          .eq('institution_id',user.institutionId).eq('user_id',user.id)
        if(grantResult.error)throw grantResult.error
        setGrants((grantResult.data??[]) as CareGrant[])
      }else setGrants([])
      if(isAdmin){
        const access=await supabase.from('student_care_access').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false})
        if(access.error)throw access.error
        setCareAccessRows((access.data??[]) as RecordRow[])
      }else setCareAccessRows([])
    }catch(error){setLoadError(message(error,'The student care workspace could not load its permitted records.'));setStudents([]);setEmployees([])}
    finally{setLoading(false)}
  },[user?.id,user?.institutionId,user?.role,isAdmin])

  const leaveWindow=useMemo(()=>{
    const now=new Date()
    const to=now.toLocaleDateString('en-CA')
    const start=new Date(now)
    if(leavePeriod==='week'){const day=(start.getDay()+6)%7;start.setDate(start.getDate()-day)}
    if(leavePeriod==='month')start.setDate(1)
    if(leavePeriod==='year')start.setMonth(0,1)
    if(leavePeriod==='session'){const month=now.getMonth()+1;const startYear=month>=8?now.getFullYear():now.getFullYear()-1;start.setFullYear(startYear,7,1)}
    const from=leavePeriod==='all'?'0001-01-01':start.toLocaleDateString('en-CA')
    return {from,to}
  },[leavePeriod])
  const filteredLeaveRows=useMemo(()=>leaveRows.filter(row=>{
    const kind=String(row.person_type??'student')
    if(leavePeopleFilter!=='all'&&kind!==leavePeopleFilter)return false
    if(leaveStatusFilter!=='all'&&String(row.status??'')!==leaveStatusFilter)return false
    const rowStart=String(row.start_date??'')
    const rowEnd=String(row.end_date??row.start_date??'')
    return rowEnd>=leaveWindow.from&&rowStart<=leaveWindow.to
  }),[leaveRows,leavePeopleFilter,leaveStatusFilter,leaveWindow])
  const leaveStats=useMemo(()=>({
    requests:filteredLeaveRows.length,
    pending:filteredLeaveRows.filter(row=>row.status==='pending').length,
    approved:filteredLeaveRows.filter(row=>row.status==='approved').length,
    rejected:filteredLeaveRows.filter(row=>row.status==='rejected').length,
    approvedDays:filteredLeaveRows.filter(row=>row.status==='approved').reduce((sum,row)=>sum+Number(row.day_count??dayCount(String(row.start_date),String(row.end_date))),0)
  }),[filteredLeaveRows])
  const loadLeave=useCallback(async()=>{
    if(!supabase||!user)return
    const [studentResult,employeeResult,balanceResult]=await Promise.all([
      supabase.from('student_leave_requests').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false}).limit(500),
      supabase.from('employee_leave_requests').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false}).limit(500),
      supabase.from('leave_balances').select('*').eq('institution_id',user.institutionId).order('leave_year',{ascending:false}).limit(500),
    ])
    if(studentResult.error)throw studentResult.error
    if(employeeResult.error&&isAdmin)throw employeeResult.error
    if(balanceResult.error)throw balanceResult.error
    setLeaveRows([
      ...((studentResult.data??[]).map(row=>({...row,person_type:'student' as const}))),
      ...((employeeResult.data??[]).map(row=>({...row,person_type:'employee' as const}))),
    ] as LeaveRow[])
    setLeaveBalances((balanceResult.data??[]) as RecordRow[])
  },[user?.id,user?.institutionId,isAdmin])

  const loadReports=useCallback(async()=>{
    if(!supabase||!user)return
    const [s,e]=await Promise.all([
      supabase.from('attendance').select('id,institution_id,student_id,student_name,class_name,attendance_date,status,period_label,arrival_time,departure_time,minutes_late,early_departure_minutes,notes')
        .eq('institution_id',user.institutionId).gte('attendance_date',reportFrom).lte('attendance_date',reportTo).order('attendance_date',{ascending:false}).limit(5000),
      supabase.from('employee_attendance').select('id,institution_id,teacher_id,attendance_date,status,check_in_time,check_out_time,minutes_late,early_departure_minutes,notes')
        .eq('institution_id',user.institutionId).gte('attendance_date',reportFrom).lte('attendance_date',reportTo).order('attendance_date',{ascending:false}).limit(5000),
    ])
    if(s.error)throw s.error
    if(e.error&&isAdmin)throw e.error
    setStudentAttendance((s.data??[]) as AttendanceReportRow[])
    setEmployeeAttendance((e.data??[]) as AttendanceReportRow[])
  },[user?.id,user?.institutionId,reportFrom,reportTo,isAdmin])

  const loadDiscipline=useCallback(async()=>{
    if(!supabase||!user||!canRead('discipline'))return
    const [events,links]=await Promise.all([
      supabase.from('student_behaviour_events').select('*').eq('institution_id',user.institutionId).order('event_date',{ascending:false}).limit(500),
      supabase.from('student_guardians').select('student_id,parent_user_id,relationship').eq('institution_id',user.institutionId),
    ])
    if(events.error)throw events.error
    if(links.error&&canWrite('discipline'))throw links.error
    setCareEvents((events.data??[]) as RecordRow[])
    setGuardianLinks((links.data??[]) as GuardianLink[])
  },[user?.id,user?.institutionId,grants,isAdmin])

  const loadCounselling=useCallback(async()=>{
    if(!supabase||!user||!(isAdmin||canRead('counselling')||isStudentOrParent))return
    const [a,n]=await Promise.all([
      supabase.from('student_counselling_appointments').select('*').eq('institution_id',user.institutionId).order('appointment_at',{ascending:false}).limit(500),
      canRead('counselling')?supabase.from('student_counselling_notes').select('*').eq('institution_id',user.institutionId).order('note_date',{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
    ])
    if(a.error)throw a.error
    if(n.error)throw n.error
    setAppointments((a.data??[]) as RecordRow[])
    setCounsellingNotes((n.data??[]) as RecordRow[])
  },[user?.id,user?.institutionId,grants,isAdmin,isStudentOrParent])

  const loadHealth=useCallback(async()=>{
    if(!supabase||!user)return
    const contacts=await supabase.from('student_emergency_contacts').select('*').eq('institution_id',user.institutionId).order('priority_order')
    if(contacts.error)throw contacts.error
    setEmergencyContacts((contacts.data??[]) as RecordRow[])
    if(canRead('health')){
      const [records,incidents]=await Promise.all([
        supabase.from('student_health_records').select('*').eq('institution_id',user.institutionId).order('record_date',{ascending:false}).limit(500),
        supabase.from('student_health_incidents').select('*').eq('institution_id',user.institutionId).order('occurred_at',{ascending:false}).limit(500),
      ])
      if(records.error)throw records.error
      if(incidents.error)throw incidents.error
      setHealthRecords((records.data??[]) as RecordRow[])
      setHealthIncidents((incidents.data??[]) as RecordRow[])
    }else{setHealthRecords([]);setHealthIncidents([])}
  },[user?.id,user?.institutionId,grants,isAdmin])

  useEffect(()=>{void loadBase()},[loadBase])
  useEffect(()=>{
    if(!user||!supabase)return
    const run=async()=>{
      try{
        if(activeWindow==='leave')await loadLeave()
        if(activeWindow==='reports')await loadReports()
        if(activeWindow==='discipline'&&canRead('discipline'))await loadDiscipline()
        if(activeWindow==='counselling')await loadCounselling()
        if(activeWindow==='health')await loadHealth()
      }catch(error){setLoadError(message(error,'The selected student care records could not be loaded.'))}
    }
    void run()
  },[user?.id,user?.institutionId,activeWindow,refreshKey,loadLeave,loadReports,loadDiscipline,loadCounselling,loadHealth,grants])

  useEffect(()=>{
    if(!leavePerson&&selectedLeavePeople[0])setLeavePerson(selectedLeavePeople[0].id)
  },[leavePerson,selectedLeavePeople])
  useEffect(()=>{if(!selectedStudent&&students[0])setSelectedStudent(students[0].id)},[selectedStudent,students])
  useEffect(()=>{if(!healthStudent&&students[0])setHealthStudent(students[0].id)},[healthStudent,students])
  useEffect(()=>{if(!appointmentStudent&&students[0])setAppointmentStudent(students[0].id)},[appointmentStudent,students])

  async function applyLeave(event:FormEvent){
    event.preventDefault()
    if(!supabase||!user)return
    if(!leavePerson){onToast('Select the student or employee before applying.',true);return}
    if(leaveEnd<leaveStart){onToast('The leave end date must be on or after the start date.',true);return}
    if(!leaveReason.trim()){onToast('Enter a reason for the leave request.',true);return}
    if(leaveFile&&(leaveFile.size>10*1024*1024||!['application/pdf','image/jpeg','image/png'].includes(leaveFile.type))){
      onToast('Supporting files must be PDF, JPG or PNG and no larger than 10 MB.',true);return
    }
    const person=selectedLeavePeople.find(p=>p.id===leavePerson)
    if(!person)return
    setSaving(true)
    let storagePath:string|undefined
    try{
      if(leaveFile){
        const extension=leaveFile.name.split('.').pop()?.toLowerCase()||'pdf'
        storagePath=user.institutionId+'/'+(leaveKind==='student'?'students':'employees')+'/'+leavePerson+'/'+crypto.randomUUID()+'.'+extension
        const upload=await supabase.storage.from('attendance-private').upload(storagePath,leaveFile,{contentType:leaveFile.type,upsert:false})
        if(upload.error)throw upload.error
      }
      const payload=leaveKind==='student'
        ?{institution_id:user.institutionId,student_id:leavePerson,campus_id:(person as Student).campus_id??null,leave_type:leaveType,start_date:leaveStart,end_date:leaveEnd,day_count:dayCount(leaveStart,leaveEnd),reason:leaveReason.trim(),supporting_document_path:storagePath??null,status:'pending',created_by:user.id}
        :{institution_id:user.institutionId,teacher_id:leavePerson,campus_id:(person as Employee).campus_id??null,leave_type:leaveType,start_date:leaveStart,end_date:leaveEnd,day_count:dayCount(leaveStart,leaveEnd),reason:leaveReason.trim(),supporting_document_path:storagePath??null,status:'pending',created_by:user.id}
      const table=leaveKind==='student'?'student_leave_requests':'employee_leave_requests'
      const {error}=await supabase.from(table).insert(payload as never)
      if(error)throw error
      onToast('Leave application submitted successfully.')
      setLeaveReason('');setLeaveFile(null);setRefreshKey(v=>v+1)
    }catch(error){
      if(storagePath)await supabase.storage.from('attendance-private').remove([storagePath])
      onToast(message(error,'The leave application could not be saved.'),true)
    }finally{setSaving(false)}
  }

  async function reviewLeave(row:LeaveRow,status:'approved'|'rejected'){
    if(!supabase||!user||!isAdmin)return
    setSaving(true)
    try{
      const table=row.person_type==='student'?'student_leave_requests':'employee_leave_requests'
      const {error}=await supabase.from(table).update({status,review_notes:reviewNotes[row.id]??null,reviewed_by:user.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',row.id)
      if(error)throw error
      onToast('Leave request '+status+'.');setRefreshKey(v=>v+1)
    }catch(error){onToast(message(error,'The leave request could not be updated.'),true)}
    finally{setSaving(false)}
  }

  async function openPrivateDocument(path:string){
    if(!supabase)return
    const {data,error}=await supabase.storage.from('attendance-private').createSignedUrl(path,120)
    if(error){onToast(message(error,'This supporting document is not available to your account.'),true);return}
    window.open(data.signedUrl,'_blank','noopener,noreferrer')
  }

  async function saveBalance(event:FormEvent){
    event.preventDefault()
    if(!supabase||!user||!isAdmin||!balancePerson)return
    const personType=employees.some(e=>e.id===balancePerson)?'employee':'student'
    const year=Number(balanceYear),entitlement=Number(balanceEntitlement)
    if(!Number.isFinite(year)||year<2000||year>2200||!Number.isFinite(entitlement)||entitlement<0){onToast('Enter a valid leave year and non-negative entitlement.',true);return}
    const payload={institution_id:user.institutionId,person_type:personType,person_id:balancePerson,leave_type:balanceType,leave_year:year,entitled_days:entitlement,updated_by:user.id}
    const {error}=await supabase.from('leave_balances').upsert(payload as never,{onConflict:'institution_id,person_type,person_id,leave_type,leave_year'})
    if(error){onToast(message(error,'The leave balance could not be saved.'),true);return}
    onToast('Leave balance saved.');setRefreshKey(v=>v+1)
  }

  async function saveDiscipline(event:FormEvent){
    event.preventDefault()
    if(!supabase||!user||!canWrite('discipline'))return
    if(!selectedStudent||!eventSummary.trim()||!eventCategory.trim()){onToast('Select a student and complete the incident summary and category.',true);return}
    if(eventFollowUp&&!eventFollowUpDate){onToast('Choose the follow-up date.',true);return}
    setSaving(true)
    try{
      const {data,error}=await supabase.from('student_behaviour_events').insert({
        institution_id:user.institutionId,student_id:selectedStudent,event_type:eventType,category:eventCategory.trim(),
        severity:eventSeverity,event_date:eventDate,summary:eventSummary.trim(),description:eventDescription.trim()||null,
        location:eventLocation.trim()||null,responsible_staff_id:eventStaff||null,action_taken:eventAction.trim()||null,
        follow_up_required:eventFollowUp,follow_up_date:eventFollowUp?eventFollowUpDate:null,family_visible:false,status:eventFollowUp?'follow_up':'open',
        created_by:user.id,
      }).select('id').single()
      if(error)throw error
      if(sendParentMessage&&parentMessage.trim()&&data){
        const recipients=guardianLinks.filter(g=>g.student_id===selectedStudent)
        if(!recipients.length)throw new Error('No linked parent account was found for this student. The incident was saved, but no parent message was sent.')
        const communications=recipients.map(g=>({institution_id:user.institutionId,student_id:selectedStudent,behaviour_event_id:data.id,sent_to_parent_user_id:g.parent_user_id,communication_date:today(),channel:'portal',message:parentMessage.trim(),parent_visible:true,created_by:user.id}))
        const sent=await supabase.from('student_discipline_communications').insert(communications as never)
        if(sent.error)throw sent.error
      }
      onToast('Discipline record saved with restricted staff access.')
      setEventSummary('');setEventDescription('');setEventAction('');setEventLocation('');setParentMessage('');setSendParentMessage(false);setRefreshKey(v=>v+1)
    }catch(error){onToast(message(error,'The discipline record could not be saved.'),true)}
    finally{setSaving(false)}
  }

  async function saveGrant(event:FormEvent){
    event.preventDefault()
    if(!supabase||!user||!isAdmin||!grantUser||!grantReason.trim())return
    if(grantWrite&&!grantRead){onToast('Write permission requires read permission.',true);return}
    const {error}=await supabase.from('student_care_access').upsert({
      institution_id:user.institutionId,user_id:grantUser,area:grantArea,can_read:grantRead,can_write:grantWrite,
      grant_reason:grantReason.trim(),granted_by:user.id,
    },{onConflict:'institution_id,user_id,area'})
    if(error){onToast(message(error,'The staff access grant could not be saved.'),true);return}
    onToast('Restricted access grant saved.');setGrantReason('');setRefreshKey(v=>v+1)
    void loadBase()
  }

  async function revokeGrant(id:string){
    if(!supabase||!user||!isAdmin)return
    const {error}=await supabase.from('student_care_access').delete().eq('id',id).eq('institution_id',user.institutionId)
    if(error){onToast(message(error,'The access grant could not be revoked.'),true);return}
    onToast('Restricted access revoked.');setRefreshKey(v=>v+1);void loadBase()
  }

  async function requestCounselling(event:FormEvent){
    event.preventDefault()
    if(!supabase||!user||!appointmentStudent)return
    setSaving(true)
    try{
      const {error}=await supabase.from('student_counselling_appointments').insert({
        institution_id:user.institutionId,student_id:appointmentStudent,requested_by:user.id,
        assigned_to:isAdmin||canWrite('counselling')?(appointmentAssignedTo||null):null,
        appointment_at:appointmentDate?new Date(appointmentDate).toISOString():null,appointment_type:appointmentType,
        request_notes:appointmentNotes.trim()||null,status:'pending',
      })
      if(error)throw error
      onToast('Counselling appointment request submitted.');setAppointmentNotes('');setAppointmentDate('');setRefreshKey(v=>v+1)
    }catch(error){onToast(message(error,'The counselling request could not be submitted.'),true)}
    finally{setSaving(false)}
  }

  async function updateAppointment(row:RecordRow,status:'scheduled'|'completed'|'cancelled'){
    if(!supabase||!user)return
    if(!isAdmin&&!canWrite('counselling'))return
    const {error}=await supabase.from('student_counselling_appointments').update({
      status,appointment_at:appointmentDate?new Date(appointmentDate).toISOString():(row.appointment_at??null),
      assigned_to:appointmentAssignedTo||row.assigned_to||null,updated_at:new Date().toISOString(),
    }).eq('id',row.id)
    if(error){onToast(message(error,'The appointment could not be updated.'),true);return}
    onToast('Appointment updated.');setRefreshKey(v=>v+1)
  }

  async function saveCounsellingNote(event:FormEvent){
    event.preventDefault()
    if(!supabase||!user||!canWrite('counselling')||!noteStudent||!noteConcern.trim()||!notePrivate.trim())return
    const {error}=await supabase.from('student_counselling_notes').insert({
      institution_id:user.institutionId,student_id:noteStudent,appointment_id:noteAppointment||null,note_date:today(),
      concern_summary:noteConcern.trim(),confidential_notes:notePrivate.trim(),support_plan:notePlan.trim()||null,
      follow_up_date:noteFollowUp||null,created_by:user.id,
    })
    if(error){onToast(message(error,'The confidential counselling note could not be saved.'),true);return}
    onToast('Confidential counselling note saved. It is not visible to parents or ordinary teachers.')
    setNoteConcern('');setNotePrivate('');setNotePlan('');setNoteFollowUp('');setRefreshKey(v=>v+1)
  }

  async function saveEmergencyContact(event:FormEvent){
    event.preventDefault()
    if(!supabase||!user||!canWrite('health')||!contactStudent||!contactName.trim()||!contactPhone.trim())return
    const {error}=await supabase.from('student_emergency_contacts').insert({
      institution_id:user.institutionId,student_id:contactStudent,contact_name:contactName.trim(),relationship:contactRelationship,
      phone:contactPhone.trim(),alternate_phone:contactAltPhone.trim()||null,email:contactEmail.trim()||null,
      priority_order:1,is_primary:true,created_by:user.id,
    })
    if(error){onToast(message(error,'The emergency contact could not be saved.'),true);return}
    onToast('Emergency contact saved.');setContactName('');setContactPhone('');setContactAltPhone('');setContactEmail('');setRefreshKey(v=>v+1)
  }

  async function saveHealthRecord(event:FormEvent){
    event.preventDefault()
    if(!supabase||!user||!canWrite('health')||!healthStudent||!healthSummary.trim())return
    const {error}=await supabase.from('student_health_records').insert({
      institution_id:user.institutionId,student_id:healthStudent,record_date:healthDate,record_type:healthType,
      summary:healthSummary.trim(),details:healthDetails.trim()||null,clinic_name:clinicName.trim()||null,
      action_taken:healthAction.trim()||null,follow_up_date:healthFollowUp||null,created_by:user.id,
    })
    if(error){onToast(message(error,'The health record could not be saved.'),true);return}
    onToast('Restricted health record saved.');setHealthSummary('');setHealthDetails('');setClinicName('');setHealthAction('');setHealthFollowUp('');setRefreshKey(v=>v+1)
  }

  async function saveHealthIncident(event:FormEvent){
    event.preventDefault()
    if(!supabase||!user||!canWrite('health')||!healthStudent||!incidentDescription.trim()||!incidentAction.trim())return
    const {error}=await supabase.from('student_health_incidents').insert({
      institution_id:user.institutionId,student_id:healthStudent,occurred_at:new Date().toISOString(),
      location:incidentLocation.trim()||null,incident_type:incidentType,symptoms_or_description:incidentDescription.trim(),
      clinic_visit:Boolean(incidentClinic.trim()),clinic_name:incidentClinic.trim()||null,action_taken:incidentAction.trim(),
      follow_up_required:Boolean(incidentFollowUp),follow_up_date:incidentFollowUp||null,status:incidentFollowUp?'follow_up':'open',
      created_by:user.id,
    })
    if(error){onToast(message(error,'The health incident could not be saved.'),true);return}
    onToast('Health incident recorded in the restricted health register.');setIncidentDescription('');setIncidentLocation('');setIncidentAction('');setIncidentClinic('');setIncidentFollowUp('');setRefreshKey(v=>v+1)
  }

  if(!user)return null
  if(loading)return <main className="page-content s7-page"><div className="s7-empty">Loading your permitted student care workspace…</div></main>
  const pageTitle:Record<WindowKey,string>={leave:'Leave Management',reports:'Attendance Reports',discipline:'Student Discipline',counselling:'Student Counselling & Wellbeing',health:'Health & Emergency Records'}
  const pageIntro:Record<WindowKey,string>={
    leave:'Submit, review and track student and employee leave applications.',
    reports:'Review date-wise, class-wise, student-wise and employee-wise attendance summaries.',
    discipline:'Restricted incident records, documented actions, parent communication and follow-up.',
    counselling:'Appointment requests, schedules and confidential counsellor notes.',
    health:'Emergency contacts, authorised health information, clinic visits and follow-up records.',
  }
  const reportRows=[
    ...studentAttendance.filter(row=>!reportClass||String(row.class_name??'')===reportClass).map(row=>({...row,group:'Student',person:String(row.student_name??'Student'),id:String(row.student_id??'')})),
    ...employeeAttendance.map(row=>{const employee=employees.find(e=>e.id===row.teacher_id);return {...row,group:'Employee',person:employee?.full_name??'Employee',id:String(row.teacher_id??'')}}),
  ]
  const reportCounts=reportRows.reduce((acc,row)=>{const status=String(row.status??'');acc.total++;acc[status]=(acc[status]??0)+1;return acc},{total:0} as Record<string,number>)
  const classOptions=[...new Set(students.map(s=>s.class_name).filter(Boolean))].sort()
  const accessBlocked=(activeWindow==='discipline'&&!canRead('discipline'))||(activeWindow==='counselling'&&!isAdmin&&!canRead('counselling')&&!isStudentOrParent)||(activeWindow==='health'&&!canRead('health')&&!isStudentOrParent)
  return <main className="page-content s7-page">
    <header className="s7-hero">
      <div className="s7-hero-icon">{activeWindow==='health'?<HeartPulse size={23}/>:activeWindow==='discipline'?<ShieldCheck size={23}/>:activeWindow==='counselling'?<MessageSquare size={23}/>:activeWindow==='reports'?<Activity size={23}/>:<CalendarDays size={23}/>}</div>
      <div><span>STUDENT CARE & WELLBEING</span><h1>{pageTitle[activeWindow]}</h1><p>{pageIntro[activeWindow]}</p></div>
      <button type="button" className="s7-refresh" onClick={()=>setRefreshKey(v=>v+1)}><RefreshCw size={15}/> Refresh</button>
    </header>
    {loadError&&<div className="s7-alert" role="alert"><AlertTriangle size={16}/>{loadError}</div>}
    {accessBlocked&&<section className="s7-panel s7-locked"><LockKeyhole size={26}/><h2>Restricted workspace</h2><p>This record category is not included in your account permissions. An institution owner or administrator must grant access to the appropriate student-care area.</p></section>}

    {activeWindow==='leave'&&<>
      <section className="s7-panel">
        <div className="s7-panel-title"><div><span>LEAVE WORKFLOW</span><h2>Apply for leave</h2><p>Applications are saved as pending until reviewed by an authorised administrator.</p></div></div>
        <form className="s7-form" onSubmit={applyLeave}>
          {isAdmin&&<label>Applicant type<select value={leaveKind} onChange={e=>{setLeaveKind(e.target.value as 'student'|'employee');setLeavePerson('')}}><option value="student">Student</option><option value="employee">Employee</option></select></label>}
          <label>{leaveKind==='student'?'Student':'Employee'}<select required value={leavePerson} onChange={e=>setLeavePerson(e.target.value)}><option value="">Select {leaveKind}</option>{selectedLeavePeople.map(p=><option key={p.id} value={p.id}>{p.full_name}{'class_name'in p&&p.class_name?' · '+p.class_name:''}</option>)}</select></label>
          <label>Leave type<select value={leaveType} onChange={e=>setLeaveType(e.target.value)}>{leaveTypeOptions.map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label>
          <label>Start date<input type="date" required value={leaveStart} onChange={e=>setLeaveStart(e.target.value)}/></label>
          <label>End date<input type="date" required min={leaveStart} value={leaveEnd} onChange={e=>setLeaveEnd(e.target.value)}/></label>
          <label className="s7-wide">Reason<textarea required rows={3} value={leaveReason} onChange={e=>setLeaveReason(e.target.value)} maxLength={1200} placeholder="Explain the reason for the leave request"/></label>
          <label className="s7-wide">Supporting document (optional)<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e=>setLeaveFile(e.target.files?.[0]??null)}/><small>Private upload · PDF, JPG or PNG · maximum 10 MB</small></label>
          <div className="s7-form-actions"><span>{leaveStart&&leaveEnd&&leaveEnd>=leaveStart?dayCount(leaveStart,leaveEnd)+' calendar day(s) requested':''}</span><button className="button button-primary" disabled={saving||!leavePerson}>{saving?'Submitting…':'Submit leave application'}</button></div>
        </form>
      </section>
      <section className="s7-panel">
        <div className="s7-panel-title"><div><span>APPLICATION HISTORY</span><h2>Leave requests</h2><p>{leaveWindow.from==='0001-01-01'?'All recorded periods':leaveWindow.from+' to '+leaveWindow.to}</p></div><strong>{filteredLeaveRows.length.toLocaleString()} records</strong></div>
        <div className="s7-filters">
          <label>Period<select value={leavePeriod} onChange={e=>setLeavePeriod(e.target.value as typeof leavePeriod)}><option value="week">This week</option><option value="month">This month</option><option value="year">This year</option><option value="session">Academic session</option><option value="all">All periods</option></select></label>
          <label>Applicant type<select value={leavePeopleFilter} onChange={e=>setLeavePeopleFilter(e.target.value as typeof leavePeopleFilter)}><option value="all">All applicants</option><option value="student">Students</option><option value="employee">Teachers / staff</option></select></label>
          <label>Status<select value={leaveStatusFilter} onChange={e=>setLeaveStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label>
        </div>
        <div className="s7-metrics s7-leave-metrics"><div><b>{leaveStats.requests}</b><span>Requests</span></div><div><b>{leaveStats.pending}</b><span>Pending</span></div><div><b>{leaveStats.approved}</b><span>Approved</span></div><div><b>{leaveStats.rejected}</b><span>Rejected</span></div><div><b>{leaveStats.approvedDays}</b><span>Approved days</span></div></div>
        {filteredLeaveRows.length===0?<div className="s7-empty">No leave applications match this period and filter.</div>:<div className="s7-table-wrap"><table><thead><tr><th>Applicant</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Document / review</th></tr></thead><tbody>{filteredLeaveRows.map(row=>{
          const student=students.find(s=>s.id===row.student_id),employee=employees.find(e=>e.id===row.teacher_id)
          const applicant=row.person_type==='student'?student?.full_name??'Student':employee?.full_name??'Employee'
          const path=String(row.supporting_document_path??'')
          return <tr key={row.id}><td><b>{applicant}</b><small>{row.person_type==='student'?student?.class_name??'Student':'Employee'}</small></td><td>{String(row.leave_type??'').replaceAll('_',' ')}</td><td>{String(row.start_date)} – {String(row.end_date)}</td><td>{String(row.day_count??'—')}</td><td><span className={'s7-status '+String(row.status)}>{String(row.status)}</span></td><td>{path&&<button className="s7-text-button" type="button" onClick={()=>void openPrivateDocument(path)}><FileText size={14}/> Open file</button>}{Boolean(row.review_notes)&&<small>{String(row.review_notes)}</small>}{isAdmin&&row.status==='pending'&&<div className="s7-review"><input aria-label="Review notes" value={reviewNotes[String(row.id)]??''} onChange={e=>setReviewNotes(v=>({...v,[String(row.id)]:e.target.value}))} placeholder="Review note"/><button type="button" onClick={()=>void reviewLeave(row,'approved')} disabled={saving}>Approve</button><button type="button" className="danger" onClick={()=>void reviewLeave(row,'rejected')} disabled={saving}>Reject</button></div>}</td></tr>
        })}</tbody></table></div>}
      </section>
      <section className="s7-panel">
        <div className="s7-panel-title"><div><span>LEAVE BALANCES</span><h2>Entitlements and remaining days</h2><p>Balances are institution-controlled; used days are calculated from approved requests.</p></div></div>
        {isAdmin&&<form className="s7-form s7-balance-form" onSubmit={saveBalance}><label>Person<select value={balancePerson} onChange={e=>setBalancePerson(e.target.value)}><option value="">Select person</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name} · Student</option>)}{employees.map(e=><option key={e.id} value={e.id}>{e.full_name} · Employee</option>)}</select></label><label>Leave type<input value={balanceType} onChange={e=>setBalanceType(e.target.value)}/></label><label>Year<input type="number" min="2000" max="2200" value={balanceYear} onChange={e=>setBalanceYear(e.target.value)}/></label><label>Entitled days<input type="number" min="0" step="0.5" value={balanceEntitlement} onChange={e=>setBalanceEntitlement(e.target.value)}/></label><button className="button button-primary" type="submit">Save balance</button></form>}
        {leaveBalances.length>0&&<div className="s7-table-wrap"><table><thead><tr><th>Person ID</th><th>Type</th><th>Year</th><th>Entitled</th><th>Carried forward</th></tr></thead><tbody>{leaveBalances.map(row=><tr key={row.id}><td>{String(row.person_id)}</td><td>{String(row.leave_type)}</td><td>{String(row.leave_year)}</td><td>{String(row.entitled_days)}</td><td>{String(row.carried_forward_days??0)}</td></tr>)}</tbody></table></div>}
      </section>
    </>}

    {activeWindow==='reports'&&<>
      <section className="s7-panel">
        <div className="s7-panel-title"><div><span>ATTENDANCE ANALYTICS</span><h2>Attendance summary</h2><p>Records are limited by the signed-in user’s institution and row-level permissions.</p></div></div>
        <div className="s7-filters"><label>From<input type="date" value={reportFrom} max={reportTo} onChange={e=>setReportFrom(e.target.value)}/></label><label>To<input type="date" value={reportTo} min={reportFrom} max={today()} onChange={e=>setReportTo(e.target.value)}/></label><label>Class<select value={reportClass} onChange={e=>setReportClass(e.target.value)}><option value="">All visible classes</option>{classOptions.map(c=><option key={c}>{c}</option>)}</select></label><button type="button" className="button button-outline" onClick={()=>void loadReports()}><RefreshCw size={14}/> Apply filters</button></div>
        <div className="s7-metrics"><div><b>{reportCounts.total??0}</b><span>Total records</span></div><div><b>{reportCounts.present??0}</b><span>Present</span></div><div><b>{reportCounts.absent??0}</b><span>Absent</span></div><div><b>{reportCounts.late??0}</b><span>Late</span></div><div><b>{reportCounts.approved_leave??0}</b><span>Approved leave</span></div></div>
        <div className="s7-panel-actions"><button type="button" className="button button-outline" onClick={()=>downloadCsv('edusphere-attendance-report-'+reportFrom+'-'+reportTo+'.csv',reportRows,[{key:'group',label:'Group'},{key:'person',label:'Person'},{key:'class_name',label:'Class'},{key:'attendance_date',label:'Date'},{key:'status',label:'Status'},{key:'minutes_late',label:'Minutes late'},{key:'early_departure_minutes',label:'Early departure minutes'}])}><Download size={15}/> Export CSV</button></div>
        <div className="s7-table-wrap"><table><thead><tr><th>Person</th><th>Class / type</th><th>Date</th><th>Status</th><th>Late (min)</th><th>Early (min)</th></tr></thead><tbody>{reportRows.slice(0,500).map((row,index)=><tr key={String(row.id??index)}><td>{String(row.person)}</td><td>{String(row.class_name??row.group)}</td><td>{String(row.attendance_date)}</td><td><span className={'s7-status '+String(row.status)}>{String(row.status)}</span></td><td>{String(row.minutes_late??0)}</td><td>{String(row.early_departure_minutes??0)}</td></tr>)}</tbody></table>{reportRows.length===0&&<div className="s7-empty">No attendance records match this date range and class filter.</div>}</div>
      </section>
    </>}

    {activeWindow==='discipline'&&!accessBlocked&&<>
      <section className="s7-privacy-note"><LockKeyhole size={18}/><div><b>Restricted student-care information</b><p>Incident details are not shared with ordinary teachers or parents. Use a separate parent communication for information the institution has approved to share.</p></div></section>
      {canWrite('discipline')&&<section className="s7-panel">
        <div className="s7-panel-title"><div><span>INCIDENT REGISTER</span><h2>Document an incident or positive record</h2></div></div>
        <form className="s7-form" onSubmit={saveDiscipline}>
          <label>Student<select value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)} required><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name} · {s.class_name}</option>)}</select></label>
          <label>Record type<select value={eventType} onChange={e=>setEventType(e.target.value)}><option value="positive">Positive</option><option value="concern">Concern</option><option value="incident">Incident</option><option value="safeguarding">Safeguarding</option></select></label>
          <label>Severity<select value={eventSeverity} onChange={e=>setEventSeverity(e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
          <label>Date<input type="date" max={today()} value={eventDate} onChange={e=>setEventDate(e.target.value)}/></label>
          <label>Category<input required value={eventCategory} onChange={e=>setEventCategory(e.target.value)}/></label>
          <label>Location<input value={eventLocation} onChange={e=>setEventLocation(e.target.value)} placeholder="Classroom, campus, etc."/></label>
          <label>Responsible staff<select value={eventStaff} onChange={e=>setEventStaff(e.target.value)}><option value="">Not assigned</option>{employees.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}</select></label>
          <label className="s7-wide">Summary<input required maxLength={250} value={eventSummary} onChange={e=>setEventSummary(e.target.value)}/></label>
          <label className="s7-wide">Restricted description<textarea rows={3} value={eventDescription} onChange={e=>setEventDescription(e.target.value)}/></label>
          <label className="s7-wide">Action taken<textarea rows={2} value={eventAction} onChange={e=>setEventAction(e.target.value)}/></label>
          <label className="s7-check"><input type="checkbox" checked={eventFollowUp} onChange={e=>setEventFollowUp(e.target.checked)}/> Follow-up required</label>
          {eventFollowUp&&<label>Follow-up date<input type="date" min={eventDate} required value={eventFollowUpDate} onChange={e=>setEventFollowUpDate(e.target.value)}/></label>}
          <label className="s7-check s7-wide"><input type="checkbox" checked={sendParentMessage} onChange={e=>setSendParentMessage(e.target.checked)}/> Send a separate approved message to linked parent account(s)</label>
          {sendParentMessage&&<label className="s7-wide">Parent-safe message<textarea rows={2} required value={parentMessage} onChange={e=>setParentMessage(e.target.value)} placeholder="Only include information approved for sharing with the family."/></label>}
          <div className="s7-form-actions"><span>Parent communication is stored separately from restricted incident details.</span><button className="button button-primary" disabled={saving}>{saving?'Saving…':'Save restricted record'}</button></div>
        </form>
      </section>}
      <section className="s7-panel"><div className="s7-panel-title"><div><span>RESTRICTED HISTORY</span><h2>Student discipline records</h2></div><strong>{careEvents.length} visible records</strong></div>
        {careEvents.length===0?<div className="s7-empty">No discipline records are available within your permission scope.</div>:<div className="s7-table-wrap"><table><thead><tr><th>Date</th><th>Student</th><th>Type / severity</th><th>Incident and action</th><th>Follow-up</th></tr></thead><tbody>{careEvents.map(row=>{const student=students.find(s=>s.id===row.student_id);return <tr key={row.id}><td>{String(row.event_date)}</td><td>{student?.full_name??'Student record'}</td><td>{String(row.event_type)} · {String(row.severity)}</td><td><b>{String(row.summary)}</b><small>{String(row.action_taken??'No action recorded')}</small></td><td>{row.follow_up_required?String(row.follow_up_date??'Due date not set'):'No follow-up'}</td></tr>})}</tbody></table></div>}
      </section>
      {isAdmin&&<section className="s7-panel"><div className="s7-panel-title"><div><span>AUTHORISED STAFF</span><h2>Manage restricted access</h2><p>Grant access per staff account and per sensitive category. Write access always includes read access.</p></div></div>
        <form className="s7-form" onSubmit={saveGrant}><label>Staff member<select value={grantUser} onChange={e=>setGrantUser(e.target.value)} required><option value="">Select employee account</option>{employees.filter(e=>e.user_id).map(e=><option key={e.id} value={e.user_id!}>{e.full_name} · {e.employee_no}</option>)}</select></label><label>Restricted area<select value={grantArea} onChange={e=>setGrantArea(e.target.value as typeof grantArea)}>{(['discipline','counselling','health'] as const).map(area=><option key={area} value={area}>{areaLabels[area]}</option>)}</select></label><label>Grant reason<input required value={grantReason} onChange={e=>setGrantReason(e.target.value)} maxLength={300}/></label><label className="s7-check"><input type="checkbox" checked={grantRead} onChange={e=>{setGrantRead(e.target.checked);if(!e.target.checked)setGrantWrite(false)}}/> Read permission</label><label className="s7-check"><input type="checkbox" checked={grantWrite} onChange={e=>{setGrantWrite(e.target.checked);if(e.target.checked)setGrantRead(true)}}/> Write permission</label><button className="button button-primary">Save access grant</button></form>
        {careAccessRows.length>0&&<div className="s7-grant-list">{careAccessRows.map(row=><div key={row.id}><span><b>{areaLabels[String(row.area)]??String(row.area)}</b><small>{String(row.user_id)} · {String(row.grant_reason??'')}</small></span><span>{row.can_write?'Read + write':row.can_read?'Read only':'No access'}</span><button type="button" className="s7-text-button danger" onClick={()=>void revokeGrant(String(row.id))}>Revoke</button></div>)}</div>}
      </section>}
    </>}

    {activeWindow==='counselling'&&!accessBlocked&&<>
      <section className="s7-privacy-note"><LockKeyhole size={18}/><div><b>Confidentiality by design</b><p>Students and parents can submit appointment requests. Detailed counselling notes are restricted to the institution’s explicitly authorised counselling team and administrators.</p></div></section>
      <section className="s7-panel"><div className="s7-panel-title"><div><span>APPOINTMENTS</span><h2>{isStudentOrParent?'Request an appointment':'Counselling appointments'}</h2></div></div>
        {(isStudentOrParent||isAdmin||canWrite('counselling'))&&<form className="s7-form" onSubmit={requestCounselling}><label>Student<select required value={appointmentStudent} onChange={e=>setAppointmentStudent(e.target.value)}><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name} · {s.class_name}</option>)}</select></label><label>Appointment type<select value={appointmentType} onChange={e=>setAppointmentType(e.target.value)}>{['general','academic','wellbeing','family','follow_up'].map(t=><option key={t} value={t}>{t.replaceAll('_',' ')}</option>)}</select></label><label>Preferred date and time<input type="datetime-local" value={appointmentDate} onChange={e=>setAppointmentDate(e.target.value)}/></label>{(isAdmin||canWrite('counselling'))&&<label>Assigned counsellor<select value={appointmentAssignedTo} onChange={e=>setAppointmentAssignedTo(e.target.value)}><option value="">Unassigned</option>{employees.filter(e=>e.user_id).map(e=><option key={e.id} value={e.user_id!}>{e.full_name}</option>)}</select></label>}<label className="s7-wide">Request notes<textarea rows={2} value={appointmentNotes} onChange={e=>setAppointmentNotes(e.target.value)} placeholder="Share a brief reason for the appointment"/></label><button className="button button-primary" disabled={saving}>Submit appointment request</button></form>}
        {appointments.length===0?<div className="s7-empty">No appointments are currently recorded.</div>:<div className="s7-table-wrap"><table><thead><tr><th>Student</th><th>Appointment</th><th>Preferred time</th><th>Status</th><th>Actions</th></tr></thead><tbody>{appointments.map(row=>{const student=students.find(s=>s.id===row.student_id);return <tr key={row.id}><td>{student?.full_name??'Student'}</td><td>{String(row.appointment_type??'general').replaceAll('_',' ')}</td><td>{row.appointment_at?new Date(String(row.appointment_at)).toLocaleString():'To be arranged'}</td><td><span className={'s7-status '+String(row.status)}>{String(row.status)}</span></td><td>{(isAdmin||canWrite('counselling'))&&<div className="s7-review"><button type="button" onClick={()=>void updateAppointment(row,'scheduled')}>Schedule</button><button type="button" onClick={()=>void updateAppointment(row,'completed')}>Complete</button><button type="button" className="danger" onClick={()=>void updateAppointment(row,'cancelled')}>Cancel</button></div>}</td></tr>})}</tbody></table></div>}
      </section>
      {canRead('counselling')&&<section className="s7-panel"><div className="s7-panel-title"><div><span>COUNSELLOR NOTES</span><h2>Confidential session record</h2></div><span className="s7-confidential-label"><LockKeyhole size={13}/> Restricted</span></div>
        {canWrite('counselling')&&<form className="s7-form" onSubmit={saveCounsellingNote}><label>Student<select value={noteStudent} onChange={e=>setNoteStudent(e.target.value)} required><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label><label>Related appointment<select value={noteAppointment} onChange={e=>setNoteAppointment(e.target.value)}><option value="">No linked appointment</option>{appointments.map(a=><option key={a.id} value={a.id}>{String(a.id).slice(0,8)} · {String(a.status)}</option>)}</select></label><label className="s7-wide">Concern summary<input required value={noteConcern} onChange={e=>setNoteConcern(e.target.value)}/></label><label className="s7-wide">Confidential notes<textarea required rows={4} value={notePrivate} onChange={e=>setNotePrivate(e.target.value)}/></label><label className="s7-wide">Support plan<textarea rows={2} value={notePlan} onChange={e=>setNotePlan(e.target.value)}/></label><label>Follow-up date<input type="date" value={noteFollowUp} onChange={e=>setNoteFollowUp(e.target.value)}/></label><button className="button button-primary">Save confidential note</button></form>}
        {counsellingNotes.length>0&&<div className="s7-table-wrap"><table><thead><tr><th>Date</th><th>Student</th><th>Concern</th><th>Support / follow-up</th><th>Confidential note</th></tr></thead><tbody>{counsellingNotes.map(row=><tr key={row.id}><td>{String(row.note_date)}</td><td>{students.find(s=>s.id===row.student_id)?.full_name??'Student'}</td><td>{String(row.concern_summary)}</td><td>{String(row.support_plan??'—')}<small>{String(row.follow_up_date??'No follow-up date')}</small></td><td>{String(row.confidential_notes)}</td></tr>)}</tbody></table></div>}
      </section>}
    </>}

    {activeWindow==='health'&&!accessBlocked&&<>
      <section className="s7-privacy-note"><LockKeyhole size={18}/><div><b>Protected medical and emergency information</b><p>Health history and incident notes are visible only to owners, administrators and staff with an explicit Health access grant. Linked parents/students can view emergency contacts only.</p></div></section>
      <section className="s7-panel"><div className="s7-panel-title"><div><span>EMERGENCY CONTACTS</span><h2>Student emergency contacts</h2></div></div>
        {canWrite('health')&&<form className="s7-form" onSubmit={saveEmergencyContact}><label>Student<select value={contactStudent} onChange={e=>setContactStudent(e.target.value)} required><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name} · {s.class_name}</option>)}</select></label><label>Contact name<input required value={contactName} onChange={e=>setContactName(e.target.value)}/></label><label>Relationship<input value={contactRelationship} onChange={e=>setContactRelationship(e.target.value)}/></label><label>Primary phone<input required type="tel" value={contactPhone} onChange={e=>setContactPhone(e.target.value)}/></label><label>Alternate phone<input type="tel" value={contactAltPhone} onChange={e=>setContactAltPhone(e.target.value)}/></label><label>Email<input type="email" value={contactEmail} onChange={e=>setContactEmail(e.target.value)}/></label><button className="button button-primary">Save emergency contact</button></form>}
        {emergencyContacts.length===0?<div className="s7-empty">No emergency contacts are available in this account’s permission scope.</div>:<div className="s7-table-wrap"><table><thead><tr><th>Student</th><th>Contact</th><th>Relationship</th><th>Phone</th><th>Alternate / email</th></tr></thead><tbody>{emergencyContacts.map(row=><tr key={row.id}><td>{students.find(s=>s.id===row.student_id)?.full_name??'Student'}</td><td>{String(row.contact_name)}</td><td>{String(row.relationship)}</td><td>{String(row.phone)}</td><td>{String(row.alternate_phone??'—')}<small>{String(row.email??'')}</small></td></tr>)}</tbody></table></div>}
      </section>
      {canRead('health')&&<>
        <section className="s7-panel"><div className="s7-panel-title"><div><span>HEALTH HISTORY</span><h2>Authorised medical and clinic records</h2></div></div>
          {canWrite('health')&&<form className="s7-form" onSubmit={saveHealthRecord}><label>Student<select value={healthStudent} onChange={e=>setHealthStudent(e.target.value)} required><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label><label>Record type<select value={healthType} onChange={e=>setHealthType(e.target.value)}>{['allergy','condition','medication','care_plan','clinic_visit','medical_note','other'].map(t=><option key={t} value={t}>{t.replaceAll('_',' ')}</option>)}</select></label><label>Date<input type="date" max={today()} value={healthDate} onChange={e=>setHealthDate(e.target.value)}/></label><label>Clinic / provider<input value={clinicName} onChange={e=>setClinicName(e.target.value)}/></label><label className="s7-wide">Summary<input required value={healthSummary} onChange={e=>setHealthSummary(e.target.value)}/></label><label className="s7-wide">Authorised details<textarea rows={3} value={healthDetails} onChange={e=>setHealthDetails(e.target.value)}/></label><label className="s7-wide">Action taken<textarea rows={2} value={healthAction} onChange={e=>setHealthAction(e.target.value)}/></label><label>Follow-up date<input type="date" value={healthFollowUp} onChange={e=>setHealthFollowUp(e.target.value)}/></label><button className="button button-primary">Save restricted health record</button></form>}
          {healthRecords.length>0&&<div className="s7-table-wrap"><table><thead><tr><th>Date</th><th>Student</th><th>Type</th><th>Summary</th><th>Clinic / action</th></tr></thead><tbody>{healthRecords.map(row=><tr key={row.id}><td>{String(row.record_date)}</td><td>{students.find(s=>s.id===row.student_id)?.full_name??'Student'}</td><td>{String(row.record_type)}</td><td>{String(row.summary)}</td><td>{String(row.clinic_name??'—')}<small>{String(row.action_taken??'')}</small></td></tr>)}</tbody></table></div>}
        </section>
        <section className="s7-panel"><div className="s7-panel-title"><div><span>EMERGENCY INCIDENTS</span><h2>Medical incident and action record</h2></div></div>
          <form className="s7-form" onSubmit={saveHealthIncident}><label>Student<select value={healthStudent} onChange={e=>setHealthStudent(e.target.value)} required><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></label><label>Incident type<input value={incidentType} onChange={e=>setIncidentType(e.target.value)}/></label><label>Location<input value={incidentLocation} onChange={e=>setIncidentLocation(e.target.value)}/></label><label>Clinic / provider<input value={incidentClinic} onChange={e=>setIncidentClinic(e.target.value)}/></label><label className="s7-wide">Symptoms / description<textarea required rows={3} value={incidentDescription} onChange={e=>setIncidentDescription(e.target.value)}/></label><label className="s7-wide">Action taken<textarea required rows={2} value={incidentAction} onChange={e=>setIncidentAction(e.target.value)}/></label><label>Follow-up date<input type="date" value={incidentFollowUp} onChange={e=>setIncidentFollowUp(e.target.value)}/></label><button className="button button-primary">Save emergency incident</button></form>
          {healthIncidents.length>0&&<div className="s7-table-wrap"><table><thead><tr><th>Occurred</th><th>Student</th><th>Incident</th><th>Location / clinic</th><th>Action / follow-up</th></tr></thead><tbody>{healthIncidents.map(row=><tr key={row.id}><td>{new Date(String(row.occurred_at)).toLocaleString()}</td><td>{students.find(s=>s.id===row.student_id)?.full_name??'Student'}</td><td>{String(row.incident_type)}<small>{String(row.symptoms_or_description)}</small></td><td>{String(row.location??'—')}<small>{String(row.clinic_name??'')}</small></td><td>{String(row.action_taken)}<small>{String(row.follow_up_date??'No follow-up date')}</small></td></tr>)}</tbody></table></div>}
        </section>
      </>}
    </>}
  </main>
}
