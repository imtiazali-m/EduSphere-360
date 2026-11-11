import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, FileText, Plus, RefreshCw, Search, ShieldCheck, Users, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/userErrors'
import type { RecordRow } from '../lib/types'
import '../styles/people-hr-workspace.css'

type WindowKey = 'admissions' | 'recruitment' | 'contracts' | 'performance' | 'alumni'
type RecruitTab = 'vacancies' | 'candidates' | 'interviews'
type Field = { name: string; label: string; type?: 'text'|'email'|'tel'|'date'|'datetime-local'|'number'|'textarea'|'select'|'checkbox'; required?: boolean; options?: {value:string;label:string}[]; help?: string }
type Props = { initialWindow?: string; onToast: (message:string,error?:boolean)=>void; onNavigate:(route:string)=>void }

const dateToday = () => new Date().toISOString().slice(0,10)
const title = (value:unknown) => String(value??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const dateLabel = (value:unknown) => value ? new Date(String(value).slice(0,10)+'T00:00:00').toLocaleDateString() : '—'
const makeId = (prefix:string) => prefix+'-'+new Date().getFullYear()+'-'+crypto.randomUUID().replaceAll('-','').slice(0,7).toUpperCase()
const textValue = (value:unknown) => value===null||value===undefined||value===''?'—':String(value)

const viewLabels:Record<WindowKey,string> = {
  admissions:'Admissions & Enrollment',
  recruitment:'HR & Recruitment',
  contracts:'Employee Contracts & Documents',
  performance:'Employee Performance',
  alumni:'Alumni',
}
const recruitTabs:{key:RecruitTab;label:string}[] = [
  {key:'vacancies',label:'Vacancies'},
  {key:'candidates',label:'Candidates'},
  {key:'interviews',label:'Interviews'},
]

export function PeopleHRWorkspace({initialWindow,onToast,onNavigate}:Props) {
  const {user}=useAuth()
  const isAdmin = user?.role==='owner'||user?.role==='admin'
  const canViewOwnEmployeeRecords = user?.role==='teacher'
  const [windowKey,setWindowKey]=useState<WindowKey>(() => (['admissions','recruitment','contracts','performance','alumni'].includes(initialWindow??'') ? initialWindow as WindowKey : 'admissions'))
  const [recruitTab,setRecruitTab]=useState<RecruitTab>('vacancies')
  const [data,setData]=useState<Record<string,RecordRow[]>>({})
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [query,setQuery]=useState('')
  const [formOpen,setFormOpen]=useState(false)
  const [editing,setEditing]=useState<RecordRow|null>(null)
  const [values,setValues]=useState<Record<string,string>>({})

  const tableRows=(key:string)=>data[key]??[]
  const employees=tableRows('teachers')
  const students=tableRows('students')
  const vacancies=tableRows('hr_job_postings')
  const candidates=tableRows('hr_candidates')
  const interviews=tableRows('hr_interviews')
  const enquiries=tableRows('admission_enquiries')
  const contracts=tableRows('employee_contracts')
  const appraisals=tableRows('employee_appraisals')
  const alumni=tableRows('alumni_records')
  const documents=tableRows('staff_documents')
  const departments=tableRows('departments')
  const designations=tableRows('designations')

  const loadTables = useMemo(() => {
    if(windowKey==='admissions') return ['admission_enquiries','students']
    if(windowKey==='recruitment') return ['hr_job_postings','hr_candidates','hr_interviews','departments','designations']
    if(windowKey==='contracts') return ['employee_contracts','teachers','staff_documents']
    if(windowKey==='performance') return ['employee_appraisals','teachers']
    return ['alumni_records','students']
  },[windowKey])

  async function load(silent=false) {
    if(!supabase||!user?.institutionId){setLoading(false);return}
    if(!silent)setLoading(true)
    try {
      const results=await Promise.all(loadTables.map(async table=>{
        const {data:rows,error}=await supabase!.from(table).select('*').eq('institution_id',user!.institutionId).order('created_at',{ascending:false}).limit(500)
        if(error) throw error
        return [table,(rows??[]) as RecordRow[]] as const
      }))
      setData(old=>({...old,...Object.fromEntries(results)}))
    } catch(error) {
      onToast(userFacingError(error,'People and HR records could not be loaded. Check your role access and refresh.'),true)
    } finally {setLoading(false)}
  }
  useEffect(()=>{void load()},[user?.id,user?.institutionId,user?.role,loadTables])

  const config = useMemo<{table:string;heading:string;description:string;columns:[string,string][];fields:Field[]}>(() => {
    if(windowKey==='admissions') return {
      table:'admission_enquiries',heading:'Enquiry register',description:'Capture a prospective learner and guardian before creating a formal student application.',
      columns:[['enquiry_no','Enquiry ID'],['student_name','Prospective student'],['class_applied_for','Class / programme'],['guardian_name','Guardian'],['guardian_phone','Phone'],['follow_up_date','Follow-up'],['status','Stage']],
      fields:[
        {name:'enquiry_no',label:'Enquiry number',required:true,help:'Use a unique reference, for example ENQ-2026-001.'},
        {name:'student_name',label:'Student full name',required:true},
        {name:'date_of_birth',label:'Date of birth',type:'date'},
        {name:'class_applied_for',label:'Class / programme applied for',required:true},
        {name:'academic_session',label:'Academic session'},
        {name:'guardian_name',label:'Parent / guardian name',required:true},
        {name:'guardian_relationship',label:'Relationship'},
        {name:'guardian_phone',label:'Guardian phone',type:'tel',required:true},
        {name:'guardian_email',label:'Guardian email',type:'email'},
        {name:'source',label:'Enquiry source',options:[{value:'direct',label:'Walk-in / direct'},{value:'website',label:'Website'},{value:'referral',label:'Referral'},{value:'campaign',label:'Campaign'},{value:'other',label:'Other'}]},
        {name:'follow_up_date',label:'Follow-up date',type:'date'},
        {name:'status',label:'Enquiry stage',options:[{value:'new',label:'New'},{value:'contacted',label:'Contacted'},{value:'follow_up',label:'Follow-up required'},{value:'application_started',label:'Application started'},{value:'not_interested',label:'Not interested'}]},
        {name:'notes',label:'Enquiry notes',type:'textarea'},
      ] as Field[],
    }
    if(windowKey==='recruitment'&&recruitTab==='vacancies') return {
      table:'hr_job_postings',heading:'Vacancies',description:'Define the role, hiring requirements, employment type and application window.',
      columns:[['job_code','Job code'],['title','Position'],['department','Department'],['employee_type','Category'],['openings','Openings'],['closing_date','Closing date'],['status','Status']],
      fields:[
        {name:'job_code',label:'Job code',required:true},
        {name:'title',label:'Position title',required:true},
        {name:'department',label:'Department'},
        {name:'department_id',label:'Institution department',type:'select',options:departments.map(row=>({value:String(row.id),label:String(row.name??row.department_name??'Department')}))},
        {name:'designation_id',label:'Designation',type:'select',options:designations.map(row=>({value:String(row.id),label:String(row.name??row.title??'Designation')}))},
        {name:'employee_type',label:'Employee category',options:[{value:'teaching',label:'Teaching'},{value:'non_teaching',label:'Non-teaching'}]},
        {name:'employment_type',label:'Employment type',options:[{value:'full_time',label:'Full-time'},{value:'part_time',label:'Part-time'},{value:'contract',label:'Contract'},{value:'temporary',label:'Temporary'}]},
        {name:'openings',label:'Number of openings',type:'number',required:true},
        {name:'work_location',label:'Work location'},
        {name:'closing_date',label:'Application closing date',type:'date'},
        {name:'salary_range_min',label:'Salary range minimum (PKR)',type:'number'},
        {name:'salary_range_max',label:'Salary range maximum (PKR)',type:'number'},
        {name:'qualifications',label:'Required qualifications',type:'textarea'},
        {name:'experience_required',label:'Experience required'},
        {name:'job_description',label:'Job description and responsibilities',type:'textarea',required:true},
        {name:'status',label:'Vacancy status',options:[{value:'draft',label:'Draft'},{value:'open',label:'Open'},{value:'paused',label:'Paused'},{value:'closed',label:'Closed'}]},
      ] as Field[],
    }
    if(windowKey==='recruitment'&&recruitTab==='candidates') return {
      table:'hr_candidates',heading:'Candidate pipeline',description:'Track applications from screening through shortlisting, interviews, offer and hiring.',
      columns:[['full_name','Candidate'],['email','Email'],['phone','Phone'],['job_posting_id','Vacancy'],['years_experience','Experience (years)'],['stage','Stage'],['application_date','Applied']],
      fields:[
        {name:'full_name',label:'Candidate full name',required:true},
        {name:'email',label:'Email',type:'email',required:true},
        {name:'phone',label:'Phone',type:'tel'},
        {name:'job_posting_id',label:'Vacancy',type:'select',options:vacancies.map(row=>({value:String(row.id),label:String(row.title)+' · '+String(row.job_code)}))},
        {name:'source',label:'Candidate source',options:[{value:'direct',label:'Direct'},{value:'website',label:'Website'},{value:'referral',label:'Referral'},{value:'job_board',label:'Job board'},{value:'other',label:'Other'}]},
        {name:'years_experience',label:'Experience (years)',type:'number'},
        {name:'current_employer',label:'Current employer'},
        {name:'expected_salary',label:'Expected salary (PKR)',type:'number'},
        {name:'notice_period_days',label:'Notice period (days)',type:'number'},
        {name:'available_from',label:'Available from',type:'date'},
        {name:'application_date',label:'Application date',type:'date',required:true},
        {name:'stage',label:'Candidate stage',options:['new','screening','shortlisted','interview','offer','rejected','withdrawn'].map(value=>({value,label:title(value)}))},
        {name:'notes',label:'Recruitment notes',type:'textarea'},
      ] as Field[],
    }
    if(windowKey==='recruitment') return {
      table:'hr_interviews',heading:'Interview schedule',description:'Schedule candidate interviews, assign interviewers and record the panel outcome.',
      columns:[['candidate_id','Candidate'],['scheduled_at','Date and time'],['interview_type','Round'],['mode','Mode'],['interviewer_name','Interviewer'],['status','Status'],['score','Score']],
      fields:[
        {name:'candidate_id',label:'Candidate',type:'select',required:true,options:candidates.filter(row=>!['rejected','withdrawn'].includes(String(row.stage))).map(row=>({value:String(row.id),label:String(row.full_name)+' · '+String(row.email)}))},
        {name:'scheduled_at',label:'Interview date and time',type:'datetime-local',required:true},
        {name:'interview_type',label:'Interview round',options:[{value:'screening',label:'Screening'},{value:'first_round',label:'First round'},{value:'technical',label:'Technical'},{value:'final',label:'Final'},{value:'other',label:'Other'}]},
        {name:'mode',label:'Interview mode',options:[{value:'in_person',label:'In person'},{value:'video',label:'Video call'},{value:'phone',label:'Phone'}]},
        {name:'location_or_link',label:'Location or meeting link'},
        {name:'interviewer_name',label:'Interviewer / panel'},
        {name:'status',label:'Interview status',options:[{value:'scheduled',label:'Scheduled'},{value:'completed',label:'Completed'},{value:'rescheduled',label:'Rescheduled'},{value:'cancelled',label:'Cancelled'},{value:'no_show',label:'No show'}]},
        {name:'score',label:'Panel score (0–100)',type:'number'},
        {name:'feedback',label:'Panel feedback',type:'textarea'},
      ] as Field[],
    }
    if(windowKey==='contracts') return {
      table:'employee_contracts',heading:'Contract register',description:'Versioned employment agreements with approval, signing, effective dates and expiry status.',
      columns:[['contract_no','Contract no.'],['teacher_id','Employee'],['contract_type','Contract type'],['staff_document_id','Supporting document'],['start_date','Start'],['end_date','End'],['status','Status'],['signed_at','Signed']],
      fields:[
        {name:'teacher_id',label:'Employee',type:'select',required:true,options:employees.map(row=>({value:String(row.id),label:String(row.full_name)+' · '+String(row.employee_no)}))},
        {name:'contract_no',label:'Contract reference',required:true},
        {name:'contract_type',label:'Contract type',options:['employment','fixed_term','probation','part_time','consultancy','temporary','renewal'].map(value=>({value,label:title(value)}))},
        {name:'staff_document_id',label:'Supporting private staff document',type:'select',options:documents.filter(doc=>doc.teacher_id===values.teacher_id).map(doc=>({value:String(doc.id),label:String(doc.title??doc.file_name??doc.document_type??'Staff document')}))},
        {name:'start_date',label:'Start date',type:'date',required:true},
        {name:'end_date',label:'End date',type:'date'},
        {name:'probation_end_date',label:'Probation end date',type:'date'},
        {name:'notice_period_days',label:'Notice period (days)',type:'number'},
        {name:'issued_at',label:'Issued date',type:'date'},
        {name:'signed_at',label:'Signed date',type:'date'},
        {name:'status',label:'Contract status',options:['draft','pending_approval','active','expired','terminated','superseded'].map(value=>({value,label:title(value)}))},
        {name:'termination_reason',label:'Termination reason (when applicable)',type:'textarea'},
        {name:'notes',label:'Contract notes',type:'textarea'},
      ] as Field[],
    }
    if(windowKey==='performance') return {
      table:'employee_appraisals',heading:'Performance reviews',description:'Record structured reviews, goals, strengths, improvement areas, development plans and review outcomes.',
      columns:[['teacher_id','Employee'],['review_period_start','Review start'],['review_period_end','Review end'],['overall_rating','Rating / 5'],['status','Review status'],['next_review_date','Next review']],
      fields:[
        {name:'teacher_id',label:'Employee',type:'select',required:true,options:employees.map(row=>({value:String(row.id),label:String(row.full_name)+' · '+String(row.employee_no)}))},
        {name:'review_period_start',label:'Review period start',type:'date',required:true},
        {name:'review_period_end',label:'Review period end',type:'date',required:true},
        {name:'overall_rating',label:'Overall rating (1–5)',type:'number'},
        {name:'goals',label:'Agreed goals',type:'textarea'},
        {name:'strengths',label:'Strengths and achievements',type:'textarea'},
        {name:'improvement_areas',label:'Areas for improvement',type:'textarea'},
        {name:'development_plan',label:'Professional development plan',type:'textarea'},
        {name:'reviewer_summary',label:'Reviewer summary',type:'textarea'},
        {name:'next_review_date',label:'Next review date',type:'date'},
        {name:'status',label:'Review status',options:[{value:'draft',label:'Draft'},{value:'submitted',label:'Submitted'},{value:'reviewed',label:'Reviewed'},{value:'acknowledged',label:'Acknowledged by employee'}]},
      ] as Field[],
    }
    return {
      table:'alumni_records',heading:'Alumni directory',description:'Preserve graduation outcomes, verified contact details and consent-based alumni communication.',
      columns:[['student_id','Graduate'],['graduation_date','Graduation'],['graduating_class','Class'],['qualification_or_award','Award / qualification'],['current_organization','Organization'],['current_occupation','Occupation'],['communication_consent','Contact consent'],['status','Status']],
      fields:[
        {name:'student_id',label:'Graduated student',type:'select',required:true,options:students.filter(row=>String(row.status)==='graduated').map(row=>({value:String(row.id),label:String(row.full_name)+' · '+String(row.admission_no)}))},
        {name:'graduation_date',label:'Graduation date',type:'date',required:true},
        {name:'graduating_class',label:'Graduating class / programme'},
        {name:'qualification_or_award',label:'Qualification / award'},
        {name:'final_grade',label:'Final grade'},
        {name:'contact_email',label:'Contact email',type:'email'},
        {name:'contact_phone',label:'Contact phone',type:'tel'},
        {name:'current_organization',label:'Current organization'},
        {name:'current_occupation',label:'Current occupation'},
        {name:'city',label:'City'},
        {name:'communication_consent',label:'Consent to alumni communications',type:'checkbox'},
        {name:'status',label:'Alumni status',options:[{value:'active',label:'Active'},{value:'do_not_contact',label:'Do not contact'},{value:'archived',label:'Archived'}]},
        {name:'notes',label:'Notes',type:'textarea'},
      ] as Field[],
    }
  },[windowKey,recruitTab,employees,students,vacancies,candidates,departments,designations,documents,values.teacher_id])

  const currentRows = windowKey==='admissions' ? enquiries
    : windowKey==='recruitment' ? (recruitTab==='vacancies'?vacancies:recruitTab==='candidates'?candidates:interviews)
    : windowKey==='contracts' ? contracts
    : windowKey==='performance' ? appraisals
    : alumni
  const filteredRows=useMemo(()=>currentRows.filter(row=>config.columns.some(([key])=>{
    const value=row[key]
    const employee=employees.find(item=>item.id===row.teacher_id)
    const student=students.find(item=>item.id===row.student_id)
    const candidate=candidates.find(item=>item.id===row.candidate_id)
    const job=vacancies.find(item=>item.id===row.job_posting_id)
    return [value,employee?.full_name,student?.full_name,candidate?.full_name,job?.title].some(v=>String(v??'').toLowerCase().includes(query.trim().toLowerCase()))
  })),[currentRows,config.columns,query,employees,students,candidates,vacancies])

  function displayValue(row:RecordRow,key:string) {
    if(key==='teacher_id') return textValue(employees.find(item=>item.id===row.teacher_id)?.full_name)
    if(key==='student_id') return textValue(students.find(item=>item.id===row.student_id)?.full_name)
    if(key==='candidate_id') return textValue(candidates.find(item=>item.id===row.candidate_id)?.full_name)
    if(key==='job_posting_id') return textValue(vacancies.find(item=>item.id===row.job_posting_id)?.title)
    if(key==='staff_document_id') return textValue(documents.find(item=>item.id===row.staff_document_id)?.title??documents.find(item=>item.id===row.staff_document_id)?.file_name)
    if(key.includes('date')||key.endsWith('_at')) return dateLabel(row[key])
    if(typeof row[key]==='boolean') return row[key]?'Yes':'No'
    return textValue(row[key]).replaceAll('_',' ')
  }

  function openForm(row?:RecordRow) {
    setEditing(row??null)
    const initial:Record<string,string>={}
    for(const field of config.fields) {
      const source=row?.[field.name]
      initial[field.name]=source===null||source===undefined?'':field.type==='checkbox'?(source?'true':'false'):String(source)
    }
    if(!row) {
      initial.status=config.fields.find(f=>f.name==='status')?.options?.[0]?.value??''
      initial.openings='1'
      initial.application_date=dateToday()
      initial.start_date=dateToday()
      initial.review_period_start=dateToday()
      initial.status=initial.status||'draft'
    }
    if(windowKey==='admissions'&&!row) initial.enquiry_no=makeId('ENQ')
    if(windowKey==='recruitment'&&recruitTab==='vacancies'&&!row) initial.job_code=makeId('JOB')
    if(windowKey==='contracts'&&!row) initial.contract_no=makeId('CON')
    if(windowKey==='performance'&&!row) initial.reviewer_id=user!.id
    setValues(initial)
    setFormOpen(true)
  }

  async function save(event:FormEvent) {
    event.preventDefault()
    if(!isAdmin||!supabase||!user?.institutionId)return
    const payload:Record<string,unknown>={institution_id:user.institutionId,...values,updated_at:new Date().toISOString()}
    for(const field of config.fields) {
      if(field.type==='checkbox') payload[field.name]=values[field.name]==='true'
      else if(field.type==='number') payload[field.name]=values[field.name]===''?null:Number(values[field.name])
      else if(values[field.name]==='') payload[field.name]=null
    }
    if(windowKey==='performance') payload.reviewer_id=user.id
    if(windowKey==='alumni') payload.consent_captured_at=payload.communication_consent===true?(editing?.consent_captured_at??new Date().toISOString()):null
    if(!editing) payload.created_by=user.id
    setSaving(true)
    try {
      if(editing) {
        const {error}=await supabase.from(config.table).update(payload).eq('id',editing.id).eq('institution_id',user.institutionId)
        if(error)throw error
      } else {
        const {error}=await supabase.from(config.table).insert(payload)
        if(error)throw error
      }
      setFormOpen(false);setEditing(null);onToast(editing?'Record updated.':'Record created.')
      await load(true)
    } catch(error) {onToast(userFacingError(error,'The record could not be saved. Check required fields and institution permissions.'),true)}
    finally {setSaving(false)}
  }

  async function updateStatus(row:RecordRow,field:string,value:string) {
    if(!isAdmin||!supabase||!user?.institutionId)return
    setSaving(true)
    const patch:Record<string,unknown>={[field]:value,updated_at:new Date().toISOString()}
    if(windowKey==='performance'&&value==='acknowledged')patch.acknowledged_at=new Date().toISOString()
    const {error}=await supabase.from(config.table).update(patch).eq('id',row.id).eq('institution_id',user.institutionId)
    if(error)onToast(userFacingError(error,'The stage could not be updated.'),true)
    else {onToast('Workflow stage updated.');await load(true)}
    setSaving(false)
  }

  async function convertEnquiry(row:RecordRow) {
    if(!isAdmin||!supabase||!user?.institutionId)return
    const admissionNo=makeId('ES')
    setSaving(true)
    const {data:studentId,error}=await supabase.rpc('convert_admission_enquiry',{
      p_institution_id:user.institutionId,p_enquiry_id:row.id,p_admission_no:admissionNo,
      p_full_name:String(row.student_name??''),p_email:null,p_class_name:String(row.class_applied_for??''),
    })
    if(error)onToast(userFacingError(error,'The enquiry could not be converted to a student application.'),true)
    else {onToast('Student application created and linked to the original enquiry.');await load(true);onNavigate('students:admissions')}
    setSaving(false)
  }

  async function hireCandidate(row:RecordRow) {
    if(!isAdmin||!supabase||!user?.institutionId)return
    const employeeNo=makeId('EMP')
    setSaving(true)
    const {error}=await supabase.rpc('hire_hr_candidate',{
      p_institution_id:user.institutionId,p_candidate_id:row.id,p_employee_no:employeeNo,p_joining_date:dateToday(),
    })
    if(error)onToast(userFacingError(error,'The candidate could not be hired into the employee register.'),true)
    else {onToast('Candidate hired and employee record created in Faculty & Staff.');await load(true);onNavigate('employees:directory')}
    setSaving(false)
  }

  async function remove(row:RecordRow) {
    if(!isAdmin||!supabase||!user?.institutionId)return
    if(!window.confirm('Delete this record? This action cannot be undone.'))return
    setSaving(true)
    const {error}=await supabase.from(config.table).delete().eq('id',row.id).eq('institution_id',user.institutionId)
    if(error)onToast(userFacingError(error,'The record could not be deleted.'),true)
    else {onToast('Record deleted.');await load(true)}
    setSaving(false)
  }

  const titleText=viewLabels[windowKey]
  const statusField=windowKey==='admissions'?'status':windowKey==='recruitment'&&recruitTab==='candidates'?'stage':null
  const statusOptions=windowKey==='admissions'
    ? ['new','contacted','follow_up','application_started','not_interested']
    : windowKey==='recruitment'&&recruitTab==='candidates'
      ? ['new','screening','shortlisted','interview','offer','rejected','withdrawn']
      : []
  const totalEnrolledApplications=students.filter(row=>['submitted','under_review','documents_required','approved'].includes(String(row.application_status))).length

  if(!isAdmin&&!canViewOwnEmployeeRecords) return <main className="page-content people-hr-workspace"><section className="staff-panel"><h2>Access restricted</h2><p>People and HR administration records are available only to the institution owner and authorised administrators.</p></section></main>
  if(canViewOwnEmployeeRecords&&!['contracts','performance'].includes(windowKey)) return <main className="page-content people-hr-workspace"><section className="staff-panel"><h2>Access restricted</h2><p>Your employee role does not include institution-wide People and HR records.</p></section></main>

  return <main className="page-content people-hr-workspace">
    <header className="staff-workspace-heading">
      <div><span className="staff-kicker">STAGE 6 · PEOPLE MANAGEMENT & HUMAN RESOURCES</span><h1>{titleText}</h1><p>{windowKey==='admissions'?'Enquiry intake, application conversion and admission follow-up.':windowKey==='recruitment'?'Vacancy planning, applicant screening, interviews and hiring.':windowKey==='contracts'?'Contract lifecycle, signing dates, expiry controls and employee documents.':windowKey==='performance'?'Structured employee reviews, appraisal outcomes and development plans.':'Graduate history, contact preferences and consent-based alumni relations.'}</p></div>
      <button type="button" className="staff-button staff-button-outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button>
    </header>

    {(isAdmin||canViewOwnEmployeeRecords)&&<nav className="people-hr-subnav" aria-label="People management workspaces">
      {(isAdmin?(['admissions','recruitment','contracts','performance','alumni'] as WindowKey[]):(['contracts','performance'] as WindowKey[])).map(key=><button type="button" key={key} className={windowKey===key?'active':''} onClick={()=>{setWindowKey(key);setQuery('')}}>{key==='admissions'?<Users size={15}/>:key==='recruitment'?<ClipboardList size={15}/>:key==='contracts'?<FileText size={15}/>:key==='performance'?<ShieldCheck size={15}/>:<CalendarDays size={15}/>}<span>{viewLabels[key]}</span></button>)}
    </nav>}

    {windowKey==='admissions'&&<section className="people-hr-metric-row">
      <article><small>Open enquiries</small><strong>{enquiries.filter(row=>!['converted','not_interested'].includes(String(row.status))).length}</strong><span>Prospective learners in progress</span></article>
      <article><small>Follow-ups due</small><strong>{enquiries.filter(row=>row.follow_up_date&&String(row.follow_up_date)<=dateToday()&&!['converted','not_interested'].includes(String(row.status))).length}</strong><span>Due today or earlier</span></article>
      <article><small>Applications in review</small><strong>{totalEnrolledApplications}</strong><span>Existing student application workflow</span></article>
    </section>}
    {windowKey==='recruitment'&&<nav className="people-hr-secondary-nav" aria-label="Recruitment workflow">{recruitTabs.map(item=><button type="button" className={recruitTab===item.key?'active':''} key={item.key} onClick={()=>{setRecruitTab(item.key);setQuery('')}}>{item.label}{item.key==='vacancies'?' · '+vacancies.length:item.key==='candidates'?' · '+candidates.length:' · '+interviews.length}</button>)}</nav>}
    {windowKey==='contracts'&&<div className="people-hr-inline-note"><ShieldCheck size={16}/> Signed contract metadata is restricted to the employee and authorised administrators. Private contract files are managed in the existing staff document vault.</div>}
    {windowKey==='performance'&&canViewOwnEmployeeRecords&&!isAdmin&&<div className="people-hr-inline-note"><ShieldCheck size={16}/> Only acknowledged appraisals linked to your own employee account are visible here.</div>}

    <section className="staff-panel people-hr-data-panel">
      <header><div><h2>{config.heading}</h2><p>{config.description}</p></div><div className="people-hr-header-actions">{windowKey==='contracts'&&<button type="button" className="staff-button staff-button-outline" onClick={()=>onNavigate('employees:documents')}><FileText size={14}/> Open private document vault</button>}{isAdmin&&<button type="button" className="staff-button staff-button-primary" onClick={()=>openForm()}><Plus size={15}/> {windowKey==='admissions'?'New enquiry':windowKey==='recruitment'?'New '+(recruitTab==='vacancies'?'vacancy':recruitTab==='candidates'?'candidate':'interview'):windowKey==='contracts'?'New contract':windowKey==='performance'?'New review':'Register graduate'}</button>}</div></header>
      <div className="people-hr-toolbar"><label><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search this register…"/></label><span>{filteredRows.length} records</span></div>
      {loading?<div className="staff-empty"><RefreshCw size={18}/> Loading institution records…</div>:filteredRows.length===0?<div className="staff-empty"><span><Users size={22}/></span><strong>No records in this register yet</strong><p>{config.description}</p></div>:<div className="staff-table-wrap people-hr-table-wrap"><table className="staff-table"><thead><tr>{config.columns.map(([key,label])=><th key={key}>{label}</th>)}{isAdmin&&<th>Workflow / Actions</th>}</tr></thead><tbody>{filteredRows.map(row=><tr key={row.id}>{config.columns.map(([key])=><td key={key}>{key==='status'||key==='stage'?<span className={'staff-status staff-status-'+String(row[key]??'draft')}>{title(row[key])}</span>:displayValue(row,key)}</td>)}{isAdmin&&<td className="people-hr-row-actions">
        {statusField&&<select aria-label={'Update '+String(row.id)+' workflow stage'} value={String(row[statusField]??statusOptions[0])} disabled={saving||['converted','hired'].includes(String(row.status??row.stage))} onChange={event=>void updateStatus(row,statusField,event.target.value)}>{statusOptions.map(option=><option key={option} value={option}>{title(option)}</option>)}</select>}
        {windowKey==='admissions'&&row.status!=='converted'&&row.status!=='not_interested'&&<button type="button" className="staff-button staff-button-primary" disabled={saving} onClick={()=>void convertEnquiry(row)}>Convert to application</button>}
        {windowKey==='recruitment'&&recruitTab==='candidates'&&row.stage!=='hired'&&row.stage!=='rejected'&&row.stage!=='withdrawn'&&<button type="button" className="staff-button staff-button-primary" disabled={saving||!row.job_posting_id} onClick={()=>void hireCandidate(row)}>Hire</button>}
        {windowKey!=='recruitment'||recruitTab==='vacancies'?<button type="button" className="people-hr-icon-button" title="Edit record" onClick={()=>openForm(row)}><FileText size={14}/></button>:null}
        {['admissions','recruitment','contracts','performance','alumni'].includes(windowKey)&&<button type="button" className="people-hr-icon-button danger" title="Delete record" onClick={()=>void remove(row)}><X size={14}/></button>}
      </td>}</tr>)}</tbody></table></div>}
      {windowKey==='admissions'&&<footer className="people-hr-panel-footer"><span>Formal admission applications, document review, approval and enrolment remain in the existing Student Admissions workspace.</span><button type="button" className="staff-button staff-button-outline" onClick={()=>onNavigate('students:admissions')}>Open applications <ArrowRight size={14}/></button></footer>}
      {windowKey==='recruitment'&&recruitTab==='interviews'&&<footer className="people-hr-panel-footer"><span>Candidate pipeline: New → Screening → Shortlisted → Interview → Offer → Hired.</span><button type="button" className="staff-button staff-button-outline" onClick={()=>setRecruitTab('candidates')}>Review candidates <ArrowRight size={14}/></button></footer>}
      {windowKey==='contracts'&&<footer className="people-hr-panel-footer"><span>{documents.length} private employee documents are already registered in the institution vault.</span><span>Contract renewals create a new history row; they do not overwrite signed agreements.</span></footer>}
    </section>

    {formOpen&&<div className="modal-backdrop"><section className="modal-card people-hr-modal" role="dialog" aria-modal="true" aria-labelledby="people-hr-form-title">
      <header className="people-hr-modal-heading"><div><span className="staff-kicker">{viewLabels[windowKey]}</span><h2 id="people-hr-form-title">{editing?'Edit':'Create'} {config.heading.replace(/s$/,'').toLowerCase()}</h2><p>Complete the required details. Institution and audit fields are assigned automatically.</p></div><button type="button" className="icon-button" onClick={()=>setFormOpen(false)} aria-label="Close form"><X size={18}/></button></header>
      <form className="people-hr-form" onSubmit={save}><div className="people-hr-field-grid">{config.fields.map(field=><label key={field.name} className={field.type==='textarea'?'wide':''}><span>{field.label}{field.required?' *':''}</span>
        {field.type==='textarea'?<textarea rows={3} required={field.required} value={values[field.name]??''} onChange={event=>setValues(old=>({...old,[field.name]:event.target.value}))}/>:
        field.type==='select'?<select required={field.required} value={values[field.name]??field.options?.[0]?.value??''} onChange={event=>setValues(old=>({...old,[field.name]:event.target.value}))}><option value="">Select…</option>{(field.options??[]).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:
        field.type==='checkbox'?<input type="checkbox" checked={values[field.name]==='true'} onChange={event=>setValues(old=>({...old,[field.name]:event.target.checked?'true':'false'}))}/>:
        <input type={field.type??'text'} required={field.required} min={field.type==='number'?0:undefined} step={field.type==='number'?'0.01':undefined} value={values[field.name]??''} onChange={event=>setValues(old=>({...old,[field.name]:event.target.value}))}/>}
        {field.help&&<small>{field.help}</small>}
      </label>)}</div><div className="modal-actions"><button type="button" className="staff-button staff-button-outline" onClick={()=>setFormOpen(false)}>Cancel</button><button type="submit" className="staff-button staff-button-primary" disabled={saving}>{saving?'Saving…':editing?'Save changes':'Create record'}</button></div></form>
    </section></div>}
  </main>
}
