import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { BookOpen, CheckCircle2, Download, FileBadge, FileQuestion, Plus, Printer, RefreshCw, ShieldCheck, Wrench, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/userErrors'
import { listRecords } from '../lib/data'
import { downloadCsv } from '../lib/csv'
import type { RecordRow } from '../lib/types'
import '../styles/institution-operations.css'

type Domain = 'question-bank'|'curriculum'|'behaviour'|'certificates'|'visitors'|'facilities'
type View = 'pool'|'papers'|'units'|'coverage'|'register'|'positive'|'follow-up'|'skills'|'activities'|'competencies'|'analytics'|'reports'|'issue'|'verify'|'templates'|'bulk'|'log'|'checked-in'|'approvals'|'notifications'|'history'|'assets'|'maintenance'|'reservations'
type Row = RecordRow & { id:string; [key:string]:unknown }
type Props = { workspaceKey:string; initialWindow?:string; onToast:(message:string,error?:boolean)=>void }
type Draft = Record<string,string>

const viewLabels:Record<View,string>={
  pool:'Question bank',papers:'Question papers',units:'Curriculum units',coverage:'Curriculum coverage',
  register:'Behaviour register',positive:'Positive recognition', 'follow-up':'Follow-up cases',skills:'Student skills',activities:'Co-curricular activities',competencies:'Competency tracking',analytics:'Behaviour analytics',reports:'Behaviour reports',
  issue:'Issue certificate',verify:'Certificate register',templates:'Certificate and ID-card templates',bulk:'Bulk certificate generation',log:'Visitor log','checked-in':'Currently on site',approvals:'Visitor approvals',notifications:'Visitor notifications',
  history:'Visit and certificate history',assets:'Asset register',maintenance:'Maintenance queue',reservations:'Room reservations',
}
const toLabel=(value:unknown)=>String(value??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const day=()=>new Date().toLocaleDateString('en-CA')
const time=()=>new Date().toISOString()
const prettyDate=(value:unknown)=>value?new Date(String(value).slice(0,10)+'T00:00:00').toLocaleDateString():'—'
const number=(value:unknown)=>Number(value??0)
const jsonArray=(raw:string,fallback:string)=>{try{const value=JSON.parse(raw);if(!Array.isArray(value))throw new Error('Expected an array');return value}catch{throw new Error(fallback)}}
const todayCode=(prefix:string)=>prefix+'-'+new Date().getFullYear()+'-'+crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase()

const domainTitles:Record<Domain,string>={
  'question-bank':'Question Bank and Question Papers',
  curriculum:'Curriculum and Learning Resources',
  behaviour:'Behaviour, Recognition and Student Care',
  certificates:'Certificates and Student Documentation',
  visitors:'Visitor Management',
  facilities:'Rooms, Assets and Facility Maintenance',
}
const domainDescriptions:Record<Domain,string>={
  'question-bank':'Build institution-owned question pools, assemble paper drafts and control review and approval.',
  curriculum:'Plan subject and class units, record outcomes and publish the learning map for linked students and families.',
  behaviour:'Maintain confidential behaviour, skills, co-curricular recognition, competency and follow-up records with controlled family visibility.',
  certificates:'Create and issue learner certificates, manage reusable document templates, generate batches and verify certificate codes.',
  visitors:'Register visitors, approve access, record check-in/out, notify hosts and review visitor activity.',
  facilities:'Reserve real rooms, track assets, manage maintenance requests and review facility availability and usage.',
}
const views:Record<Domain,View[]>={
  'question-bank':['pool','papers'],
  curriculum:['units','coverage'],
  behaviour:['register','positive','follow-up','skills','activities','competencies','history','analytics','reports'],
  certificates:['verify','issue','templates','bulk','history'],
  visitors:['log','checked-in','approvals','notifications','history','reports'],
  facilities:['assets','maintenance','history','reservations','reports'],
}
const initialViews:Record<Domain,string>={'question-bank':'pool',curriculum:'units',behaviour:'register',certificates:'verify',visitors:'log',facilities:'assets'}

export function InstitutionOperationsWorkspace({workspaceKey,initialWindow,onToast}:Props){
  const {user,mode}=useAuth()
  const domain=workspaceKey.split(':')[0] as Domain
  const allowed:Domain[]=['question-bank','curriculum','behaviour','certificates','visitors','facilities']
  const selectedDomain=allowed.includes(domain)?domain:'question-bank'
  const admin=['owner','admin'].includes(user!.role)
  const examiner=['owner','admin','exam_officer'].includes(user!.role)
  const teacher=['owner','admin','teacher'].includes(user!.role)
  const firstView=(views[selectedDomain] as string[]).includes(initialWindow??'')?initialWindow as View:initialViews[selectedDomain] as View
  const [view,setView]=useState<View>(firstView)
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [search,setSearch]=useState('')
  const [listPage,setListPage]=useState(1)
  const pageSize=10
  const [questions,setQuestions]=useState<Row[]>([])
  const [papers,setPapers]=useState<Row[]>([])
  const [paperItems,setPaperItems]=useState<Row[]>([])
  const [curriculum,setCurriculum]=useState<Row[]>([])
  const [students,setStudents]=useState<Row[]>([])
  const [behaviour,setBehaviour]=useState<Row[]>([])
  const [certificates,setCertificates]=useState<Row[]>([])
  const [visitors,setVisitors]=useState<Row[]>([])
  const [teachers,setTeachers]=useState<Row[]>([])
  const [assets,setAssets]=useState<Row[]>([])
  const [maintenance,setMaintenance]=useState<Row[]>([])
  const [subjects,setSubjects]=useState<Row[]>([])
  const [classes,setClasses]=useState<Row[]>([])
  const [sessions,setSessions]=useState<Row[]>([])
  const [rooms,setRooms]=useState<Row[]>([])
  const [certificateTemplates,setCertificateTemplates]=useState<Row[]>([])
  const [reservationRooms,setReservationRooms]=useState<Row[]>([])
  const [roomReservations,setRoomReservations]=useState<Row[]>([])
  const [reservationStatus,setReservationStatus]=useState('all')
  const [bulkStudents,setBulkStudents]=useState<string[]>([])
  const [bulkTemplateId,setBulkTemplateId]=useState('')
  const [dialog,setDialog]=useState<string|null>(null)
  const [draft,setDraft]=useState<Draft>({})
  const [selectedPaper,setSelectedPaper]=useState('')
  const [questionToAdd,setQuestionToAdd]=useState('')
  const [certificateCode,setCertificateCode]=useState('')
  const [certificateResult,setCertificateResult]=useState<Row|null>(null)

  function update(key:string,value:string){setDraft(current=>({...current,[key]:value}))}
  function field(label:string,key:string,type='text',required=true,options?:{label:string;value:string}[]){
    return <label className="iop-field" key={key}>{label}{options
      ? <select required={required} value={draft[key]??''} onChange={event=>update(key,event.target.value)}><option value="">Select {label.toLowerCase()}</option>{options.map(option=><option value={option.value} key={option.value}>{option.label}</option>)}</select>
      : type==='textarea'
        ? <textarea required={required} rows={3} value={draft[key]??''} onChange={event=>update(key,event.target.value)}/>
        : <input required={required} type={type} value={draft[key]??''} onChange={event=>update(key,event.target.value)}/>}
    </label>
  }
  function openDialog(kind:string,values:Draft={}){setDraft(values);setDialog(kind)}

  async function fetchRows(table:string):Promise<Row[]>{
    if(!supabase)throw new Error('The cloud database is not configured.')
    const {data,error:fetchError}=await supabase.from(table).select('*').eq('institution_id',user!.institutionId).order('created_at',{ascending:false}).limit(1000)
    if(fetchError)throw fetchError
    return (data??[]) as Row[]
  }
  async function load(silent=false){
    if(!silent){setLoading(true);setError('')}
    try{
      if(selectedDomain==='question-bank'){
        const [q,p,pi,subjectRows,classRows,sessionRows]=await Promise.all([
          fetchRows('question_bank_items'),fetchRows('assessment_papers'),fetchRows('assessment_paper_items'),
          listRecords(mode,user!,'subjects') as Promise<Row[]>,listRecords(mode,user!,'classes') as Promise<Row[]>,listRecords(mode,user!,'academic_sessions') as Promise<Row[]>,
        ])
        setQuestions(q);setPapers(p);setPaperItems(pi);setSubjects(subjectRows);setClasses(classRows);setSessions(sessionRows)
      }else if(selectedDomain==='curriculum'){
        const [unitRows,subjectRows,classRows,sessionRows]=await Promise.all([
          fetchRows('curriculum_units'),listRecords(mode,user!,'subjects') as Promise<Row[]>,
          listRecords(mode,user!,'classes') as Promise<Row[]>,listRecords(mode,user!,'academic_sessions') as Promise<Row[]>,
        ])
        setCurriculum(unitRows);setSubjects(subjectRows);setClasses(classRows);setSessions(sessionRows)
      }else if(selectedDomain==='behaviour'){
        const [rows,studentRows]=await Promise.all([fetchRows('student_behaviour_events'),listRecords(mode,user!,'students') as Promise<Row[]>])
        setBehaviour(rows);setStudents(studentRows)
      }else if(selectedDomain==='certificates'){
        const [rows,studentRows,recordRows]=await Promise.all([fetchRows('student_certificates'),listRecords(mode,user!,'students') as Promise<Row[]>,listRecords(mode,user!,'institutional_records') as Promise<Row[]>])
        setCertificates(rows);setStudents(studentRows);setCertificateTemplates(recordRows.filter(row=>row.module_key==='certificates'&&row.record_type==='certificate-template'))
      }else if(selectedDomain==='visitors'){
        const [rows,employeeRows]=await Promise.all([fetchRows('visitor_entries'),listRecords(mode,user!,'teachers') as Promise<Row[]>])
        setVisitors(rows);setTeachers(employeeRows)
      }else if(selectedDomain==='facilities'){
        const [assetRows,requestRows,roomRows,employeeRows,bookableRooms,reservationRows]=await Promise.all([
          fetchRows('facility_assets'),fetchRows('facility_maintenance_requests'),fetchRows('institution_rooms'),listRecords(mode,user!,'teachers') as Promise<Row[]>,
          fetchRows('rooms'),fetchRows('facility_room_reservations'),
        ])
        setAssets(assetRows);setMaintenance(requestRows);setRooms(roomRows);setTeachers(employeeRows);setReservationRooms(bookableRooms.filter(row=>row.is_active));setRoomReservations(reservationRows)
      }
    }catch(err){
      const message=userFacingError(err,'This institutional workspace could not load its records.')
      setError(message);if(!silent)onToast(message,true)
    }finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[user?.id,user?.institutionId,user?.role,selectedDomain])
  useEffect(()=>{setListPage(1)},[view,search,selectedDomain])

  async function insert(table:string,payload:Record<string,unknown>){
    if(!supabase)throw new Error('The cloud database is not configured.')
    const {error:insertError}=await supabase.from(table).insert({...payload,institution_id:user!.institutionId})
    if(insertError)throw insertError
  }
  async function updateRow(table:string,id:string,payload:Record<string,unknown>){
    if(!supabase)throw new Error('The cloud database is not configured.')
    const {error:updateError}=await supabase.from(table).update({...payload,updated_at:time()}).eq('institution_id',user!.institutionId).eq('id',id)
    if(updateError)throw updateError
  }

  async function saveDialog(event:FormEvent){
    event.preventDefault();if(!dialog||!supabase)return
    setBusy(true)
    try{
      const v=draft
      if(dialog==='question'){
        const options=jsonArray(v.options||'[]','Options must be valid JSON array syntax.')
        let answer:unknown
        try{answer=JSON.parse(v.answer_key||'null')}catch{throw new Error('Answer key must be valid JSON.')}
        if(v.question_type==='multiple_choice'&&options.length<2)throw new Error('A multiple-choice question needs at least two options.')
        const prompt=v.prompt?.trim()??''
        if(!prompt)throw new Error('Enter the question text.')
        await insert('question_bank_items',{
          question_code:v.question_code||todayCode('Q'),question_type:v.question_type,prompt,options,answer_key:answer,
          explanation:v.explanation||null,marks:Number(v.marks||1),difficulty:v.difficulty||'medium',
          subject_id:v.subject_id||null,class_id:v.class_id||null,academic_session_id:v.academic_session_id||null,
          topic:v.topic||null,tags:(v.tags||'').split(',').map(x=>x.trim()).filter(Boolean),
          status:'draft',created_by:user!.id,
        })
        onToast('Question saved as a draft. It is not visible to student or parent portals.')
      }else if(dialog==='paper'){
        const {data:paper,error:paperError}=await supabase.from('assessment_papers').insert({
          institution_id:user!.institutionId,paper_code:v.paper_code||todayCode('PAPER'),
          title:v.title?.trim(),subject_id:v.subject_id,class_id:v.class_id,
          academic_session_id:v.academic_session_id||null,duration_minutes:Number(v.duration_minutes),
          maximum_marks:Number(v.maximum_marks),instructions:v.instructions||null,status:'draft',created_by:user!.id,
        }).select('id').single()
        if(paperError)throw paperError
        setSelectedPaper(String(paper.id));setView('papers')
        onToast('Question paper draft created. Add questions from the question bank.')
      }else if(dialog==='curriculum'){
        const objectives=jsonArray(v.learning_objectives||'[]','Learning objectives must be a JSON array.')
        const outcomes=jsonArray(v.learning_outcomes||'[]','Learning outcomes must be a JSON array.')
        await insert('curriculum_units',{
          unit_code:v.unit_code||null,title:v.title?.trim(),subject_id:v.subject_id,class_id:v.class_id,
          academic_session_id:v.academic_session_id||null,sequence_no:Number(v.sequence_no||1),overview:v.overview||null,
          learning_objectives:objectives,learning_outcomes:outcomes,planned_start:v.planned_start||null,
          planned_end:v.planned_end||null,status:'planned',created_by:user!.id,updated_by:user!.id,
        })
        onToast('Curriculum unit saved in the planned state.')
      }else if(dialog==='behaviour'){
        const follow=v.follow_up_required==='true'
        if(follow&&!v.follow_up_date)throw new Error('Choose a follow-up date when follow-up is required.')
        const familyVisible=v.event_type!=='safeguarding'&&v.family_visible==='true'
        if(v.event_type==='safeguarding'&&v.family_visible==='true')onToast('Safeguarding records remain staff-only.')
        await insert('student_behaviour_events',{
          student_id:v.student_id,event_type:v.event_type,category:v.category?.trim(),severity:v.severity||'low',
          event_date:v.event_date||day(),summary:v.summary?.trim(),description:v.description||null,
          action_taken:v.action_taken||null,follow_up_required:follow,follow_up_date:follow?(v.follow_up_date||null):null,
          family_visible:familyVisible,status:follow?'follow_up':'open',created_by:user!.id,
        })
        onToast('Student care record saved with its current privacy setting.')
      }else if(dialog==='certificate'){
        const issue=v.status==='issued'
        await insert('student_certificates',{
          student_id:v.student_id,certificate_no:v.certificate_no||todayCode('CERT'),
          verification_code:crypto.randomUUID().replaceAll('-','').toUpperCase(),
          certificate_type:v.certificate_type,title:v.title?.trim(),achievement:v.achievement||null,
          issue_date:issue?(v.issue_date||day()):null,expiry_date:v.expiry_date||null,
          signatory_name:v.signatory_name||null,status:issue?'issued':'draft',
          issued_by:issue?user!.id:null,created_by:user!.id,remarks:v.remarks||null,
        })
        onToast(issue?'Certificate issued and assigned a verification code.':'Certificate draft created.')
      }else if(dialog==='visitor'){
        if(v.status==='checked_in'&&!v.checked_in_at)v.checked_in_at=time()
        await insert('visitor_entries',{
          visitor_name:v.visitor_name?.trim(),phone:v.phone||null,email:v.email||null,
          organization:v.organization||null,purpose:v.purpose?.trim(),host_teacher_id:v.host_teacher_id||null,
          visit_date:v.visit_date||day(),badge_number:v.badge_number||null,status:v.status||'expected',
          checked_in_at:v.checked_in_at||null,notes:v.notes||null,created_by:user!.id,
        })
        onToast('Visitor entry registered.')
      }else if(dialog==='room-reservation'){
        const startAt=new Date(v.start_at).getTime(),endAt=new Date(v.end_at).getTime()
        if(!v.room_id||!Number.isFinite(startAt)||!Number.isFinite(endAt)||endAt<=startAt)throw new Error('Choose a room and a valid end time after the start time.')
        await insert('facility_room_reservations',{room_id:v.room_id,title:v.title?.trim(),purpose:v.purpose?.trim(),start_at:new Date(startAt).toISOString(),end_at:new Date(endAt).toISOString(),status:'requested',requested_by:user!.id,notes:v.notes||null})
        onToast('Room reservation submitted for approval. The booking is not confirmed until an administrator approves it.')
      }else if(dialog==='asset'){
        if(!admin)throw new Error('Only the owner or an administrator can register facility assets.')
        await insert('facility_assets',{
          asset_code:v.asset_code||todayCode('ASSET'),asset_name:v.asset_name?.trim(),category:v.category?.trim(),
          room_id:v.room_id||null,building:v.building||null,condition:v.condition||'good',
          status:v.status||'active',acquired_on:v.acquired_on||null,replacement_due:v.replacement_due||null,
          purchase_cost:v.purchase_cost?Number(v.purchase_cost):null,notes:v.notes||null,created_by:user!.id,
        })
        onToast('Facility asset registered.')
      }else if(dialog==='maintenance'){
        if(!v.asset_id&&!v.room_id)throw new Error('Select the affected asset or room.')
        await insert('facility_maintenance_requests',{
          asset_id:v.asset_id||null,room_id:v.room_id||null,title:v.title?.trim(),description:v.description?.trim(),
          priority:v.priority||'medium',status:'submitted',requested_by:user!.id,
          assigned_to:admin?(v.assigned_to||null):null,scheduled_for:v.scheduled_for||null,
        })
        onToast('Facility maintenance request submitted.')
      }
      setDialog(null);await load(true)
    }catch(err){onToast(userFacingError(err,'The record could not be saved. Check the required fields.'),true)}
    finally{setBusy(false)}
  }

  async function updateStatus(table:string,row:Row,payload:Record<string,unknown>,message:string){
    setBusy(true)
    try{await updateRow(table,row.id,payload);onToast(message);await load(true)}
    catch(err){onToast(userFacingError(err,'The status change could not be saved.'),true)}
    finally{setBusy(false)}
  }
  async function approveRoomReservation(row:Row){
    if(!admin||!supabase)return
    setBusy(true)
    try{
      const {error:approvalError}=await supabase.rpc('approve_facility_room_reservation',{p_institution_id:user!.institutionId,p_reservation_id:row.id})
      if(approvalError)throw approvalError
      onToast('Room reservation approved. Its time slot was checked against other approved bookings.')
      await load(true)
    }catch(err){onToast(userFacingError(err,'The reservation could not be approved. The room may already be booked for this time.'),true)}
    finally{setBusy(false)}
  }
  async function saveCertificateTemplate(event:FormEvent){
    event.preventDefault();if(!admin||!supabase)return
    const templateName=draft.template_name?.trim()
    if(!templateName){onToast('Enter a template name.',true);return}
    setBusy(true)
    try{
      await insert('institutional_records',{module_key:'certificates',record_type:'certificate-template',title:templateName,description:draft.document_kind||'certificate',status:'active',approval_status:'not_required',visibility:'staff_only',record_date:day(),created_by:user!.id,payload:{document_kind:draft.document_kind||'certificate',body:draft.template_body||'',signatory:draft.template_signatory||'',version:1}})
      onToast('Document template saved to this institution.')
      setDraft({});await load(true)
    }catch(err){onToast(userFacingError(err,'The document template could not be saved.'),true)}
    finally{setBusy(false)}
  }
  async function generateBulkCertificates(event:FormEvent){
    event.preventDefault();if(!admin||!supabase)return
    if(!bulkStudents.length){onToast('Select at least one student.',true);return}
    const template=certificateTemplates.find(row=>row.id===bulkTemplateId)
    if(!template){onToast('Select an active certificate template.',true);return}
    setBusy(true);let created=0;const errors:string[]=[]
    for(const studentId of bulkStudents){
      const student=students.find(row=>row.id===studentId)
      if(!student)continue
      const {error:insertError}=await supabase.from('student_certificates').insert({
        institution_id:user!.institutionId,student_id:student.id,certificate_no:todayCode('CERT'),
        verification_code:crypto.randomUUID().replaceAll('-','').toUpperCase(),
        certificate_type:String(template.description??'certificate'),title:String(template.title??'Certificate'),
        achievement:String((template.payload as Record<string,unknown>|undefined)?.body??''),issue_date:null,expiry_date:null,
        signatory_name:String((template.payload as Record<string,unknown>|undefined)?.signatory??''),status:'draft',issued_by:null,created_by:user!.id,
        remarks:'Generated in bulk from template '+template.title,
      })
      if(insertError)errors.push(String(student.full_name??'Student')+': '+insertError.message);else created++
    }
    onToast('Bulk certificate generation: '+created+' draft(s) created, '+errors.length+' failed. Review each draft before issuing.',errors.length>0)
    setBulkStudents([]);await load(true);setBusy(false)
  }
  async function addPaperQuestion(){
    if(!supabase||!selectedPaper||!questionToAdd)return
    const existing=paperItems.filter(row=>row.paper_id===selectedPaper)
    setBusy(true)
    try{
      const {error:addError}=await supabase.from('assessment_paper_items').insert({
        institution_id:user!.institutionId,paper_id:selectedPaper,question_id:questionToAdd,
        sequence_no:existing.reduce((max,row)=>Math.max(max,number(row.sequence_no)),0)+1,
      })
      if(addError)throw addError
      setQuestionToAdd('');onToast('Question added to the paper draft.');await load(true)
    }catch(err){onToast(userFacingError(err,'The question could not be added to this paper.'),true)}
    finally{setBusy(false)}
  }
  async function changePaperStatus(row:Row,status:'review'|'approved'){
    if(!examiner)return
    if(status==='approved'){
      if(!supabase)return
      setBusy(true)
      const {error:approvalError}=await supabase.rpc('approve_assessment_paper',{p_institution_id:user!.institutionId,p_paper_id:row.id})
      if(approvalError)onToast(userFacingError(approvalError,'Question paper could not be approved.'),true)
      else{onToast('Question paper approved after database validation.');await load(true)}
      setBusy(false)
      return
    }
    await updateStatus('assessment_papers',row,{status,approved_by:null,approved_at:null},'Question paper sent for review.')
  }
  async function removePaperQuestion(line:Row){
    if(!supabase)return
    setBusy(true)
    try{
      const {error:removeError}=await supabase.from('assessment_paper_items').delete().eq('institution_id',user!.institutionId).eq('id',line.id)
      if(removeError)throw removeError
      onToast('Question removed from the paper draft.');await load(true)
    }catch(err){onToast(userFacingError(err,'Question could not be removed from this paper.'),true)}
    finally{setBusy(false)}
  }
  async function addRandomQuestions(){
    if(!supabase||!selectedPaper)return
    const paper=papers.find(row=>row.id===selectedPaper);if(!paper)return
    const existing=new Set(paperItems.filter(item=>item.paper_id===selectedPaper).map(item=>String(item.question_id)))
    const candidates=questions.filter(q=>q.status==='published'&&q.subject_id===paper.subject_id&&(!paper.class_id||!q.class_id||q.class_id===paper.class_id)&&!existing.has(q.id))
    const picked=[...candidates].sort(()=>Math.random()-.5).slice(0,3)
    if(!picked.length){onToast('No additional published questions match this paper.',true);return}
    setBusy(true)
    try{
      const start=paperItems.filter(item=>item.paper_id===selectedPaper).reduce((max,item)=>Math.max(max,number(item.sequence_no)),0)
      const {error:addError}=await supabase.from('assessment_paper_items').insert(picked.map((q,i)=>({institution_id:user!.institutionId,paper_id:selectedPaper,question_id:q.id,sequence_no:start+i+1})))
      if(addError)throw addError
      onToast(picked.length+' randomly selected questions added to the paper draft.');await load(true)
    }catch(err){onToast(userFacingError(err,'Random question selection could not be saved.'),true)}
    finally{setBusy(false)}
  }
  function exportRows(name:string,rows:Row[],columns:{key:string;label:string}[]){
    if(!rows.length){onToast('There are no records to export.',true);return}
    downloadCsv('edusphere-'+name+'-'+day()+'.csv',rows as Record<string,unknown>[],columns)
  }

  const queryMatch=(row:Row,fields:string[])=>fields.some(key=>String(row[key]??'').toLowerCase().includes(search.trim().toLowerCase()))
  const visibleQuestions=useMemo(()=>questions.filter(row=>queryMatch(row,['question_code','prompt','question_type','topic','status'])),[questions,search])
  const visiblePapers=useMemo(()=>papers.filter(row=>queryMatch(row,['paper_code','title','status'])),[papers,search])
  const visibleCurriculum=useMemo(()=>curriculum.filter(row=>queryMatch(row,['unit_code','title','overview','status'])),[curriculum,search])
  const visibleBehaviour=useMemo(()=>behaviour.filter(row=>queryMatch(row,['summary','category','event_type','status'])),[behaviour,search])
  const visibleCertificates=useMemo(()=>certificates.filter(row=>queryMatch(row,['certificate_no','title','certificate_type','status'])),[certificates,search])
  const visibleVisitors=useMemo(()=>visitors.filter(row=>queryMatch(row,['visitor_name','organization','purpose','badge_number','status'])),[visitors,search])
  const visibleAssets=useMemo(()=>assets.filter(row=>queryMatch(row,['asset_code','asset_name','category','building','status'])),[assets,search])
  const visibleMaintenance=useMemo(()=>maintenance.filter(row=>queryMatch(row,['title','description','priority','status'])),[maintenance,search])
  const tabItems=views[selectedDomain]

  function renderQuestionBank(){
    const selected=papers.find(row=>row.id===selectedPaper)??papers[0]??null
    const selectedLines=paperItems.filter(row=>row.paper_id===selected?.id)
    return <div className="iop-split">
      <section className="iop-panel"><header><div><h2>Question pool</h2><p>Questions are private drafts until reviewed and published by an authorised examiner or administrator.</p></div><div className="iop-actions"><button className="iop-button" onClick={()=>exportRows('question-bank',visibleQuestions,[{key:'question_code',label:'Question code'},{key:'question_type',label:'Type'},{key:'prompt',label:'Prompt'},{key:'marks',label:'Marks'},{key:'difficulty',label:'Difficulty'},{key:'status',label:'Status'}])}><Download size={14}/> Export</button><button className="iop-button primary" onClick={()=>openDialog('question')}><Plus size={14}/> Add question</button></div></header><label className="iop-search">Search questions<input value={search} onChange={e=>{setSearch(e.target.value);setListPage(1)}} placeholder="Code, text, topic or status…"/></label>{visibleQuestions.length?<div className="iop-record-list">{pageRows(visibleQuestions).map(row=><article key={row.id}><div className="iop-record-heading"><b>{String(row.question_code)}</b><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></div><p>{String(row.prompt)}</p><div className="iop-meta"><span>{toLabel(row.question_type)}</span><span>{number(row.marks)} marks</span><span>{toLabel(row.difficulty)}</span><span>{String(row.topic??'No topic')}</span></div>{examiner&&row.status==='draft'&&<button className="iop-button" onClick={()=>void updateStatus('question_bank_items',row,{status:'published',reviewed_by:user!.id,reviewed_at:time()},'Question published to the authorised question bank.')}>Publish question</button>}</article>)}</div>:<div className="iop-empty"><FileQuestion size={22}/><b>No questions yet</b><span>Create the first question or change the search term.</span></div>}</section>
      <section className="iop-panel"><header><div><h2>Question paper designer</h2><p>Build a paper from saved institution questions. The paper remains a draft until review and approval.</p></div><button className="iop-button primary" onClick={()=>openDialog('paper')}><Plus size={14}/> New paper</button></header>{visiblePapers.length?<div className="iop-record-list">{pageRows(visiblePapers).map(row=><button type="button" className={'iop-select-record '+(selected?.id===row.id?'selected':'')} key={row.id} onClick={()=>setSelectedPaper(row.id)}><span><b>{String(row.paper_code)} · {String(row.title)}</b><small>{number(row.duration_minutes)} minutes · {number(row.maximum_marks)} marks</small></span><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></button>)}</div>:<div className="iop-empty">No question papers have been created.</div>}{selected&&<div className="iop-paper-detail"><h3>{String(selected.title)}</h3><div className="iop-meta"><span>{selectedLines.length} questions</span><span>{number(selected.maximum_marks)} maximum marks</span><span>{toLabel(selected.status)}</span></div><label className="iop-field">Add a question<select value={questionToAdd} onChange={e=>setQuestionToAdd(e.target.value)}><option value="">Select question</option>{questions.filter(q=>q.status==='published'&&q.subject_id===selected.subject_id&&!selectedLines.some(line=>line.question_id===q.id)).map(q=><option key={q.id} value={q.id}>{String(q.question_code)} · {String(q.prompt).slice(0,80)}</option>)}</select></label><button className="iop-button" disabled={!questionToAdd||busy} onClick={()=>void addPaperQuestion()}>Add question to draft</button>{selectedLines.map(line=><div className="iop-paper-line" key={line.id}><span>{number(line.sequence_no)}.</span><b>{String(questions.find(q=>q.id===line.question_id)?.question_code??'Question')}</b><small>{String(questions.find(q=>q.id===line.question_id)?.prompt??'')}</small>{selected.status==='draft'&&<button className="iop-button danger" disabled={busy} onClick={()=>void removePaperQuestion(line)}>Remove</button>}</div>)}<div className="iop-actions"><button className="iop-button" onClick={()=>window.print()}><Printer size={13}/> Print paper</button>{selected.status==='draft'&&<button className="iop-button" disabled={busy} onClick={()=>void addRandomQuestions()}>Randomly add 3</button>}</div>{examiner&&selected.status==='draft'&&<button className="iop-button primary" onClick={()=>void changePaperStatus(selected,'review')}>Submit paper for review</button>}{examiner&&selected.status==='review'&&<button className="iop-button primary" onClick={()=>void changePaperStatus(selected,'approved')}>Approve paper</button>}</div>}</section>
    </div>
  }

  function renderCurriculum(){
    const published=curriculum.filter(row=>row.status==='published')
    if(view==='coverage'){
      const bySubject=new Map<string,{name:string;total:number;completed:number;published:number}>()
      curriculum.forEach(row=>{
        const name=String(subjects.find(item=>item.id===row.subject_id)?.name??'Unassigned subject')
        const data=bySubject.get(name)??{name,total:0,completed:0,published:0}
        data.total+=1
        if(['completed','published'].includes(String(row.status)))data.completed+=1
        if(row.status==='published')data.published+=1
        bySubject.set(name,data)
      })
      const rows=[...bySubject.values()].sort((a,b)=>a.name.localeCompare(b.name))
      return <div className="iop-panel"><header><div><h2>Subject curriculum coverage</h2><p>Coverage is calculated from saved unit records. No planned syllabus is invented.</p></div><button className="iop-button" onClick={()=>setView('units')}>Open unit register</button></header>{rows.length?<div className="iop-table-wrap"><table><thead><tr><th>Subject</th><th>Units</th><th>Completed</th><th>Published</th><th>Coverage</th></tr></thead><tbody>{rows.map(row=><tr key={row.name}><td><b>{row.name}</b></td><td>{row.total}</td><td>{row.completed}</td><td>{row.published}</td><td>{Math.round(row.completed/Math.max(1,row.total)*100)}%</td></tr>)}</tbody></table></div>:<div className="iop-empty">No curriculum records are available to calculate coverage.</div>}</div>
    }
    return <div className="iop-panel"><header><div><h2>Curriculum unit plan</h2><p>Plan each unit by subject, class and academic session. Published units become visible to linked learners/families.</p></div>{teacher&&<div className="iop-actions"><button className="iop-button" onClick={()=>exportRows('curriculum',visibleCurriculum,[{key:'unit_code',label:'Unit code'},{key:'title',label:'Unit'},{key:'sequence_no',label:'Order'},{key:'status',label:'Status'}])}><Download size={14}/> Export</button><button className="iop-button primary" onClick={()=>openDialog('curriculum')}><Plus size={14}/> Plan a unit</button></div>}</header><div className="iop-kpis"><article><small>Total units</small><b>{curriculum.length}</b></article><article><small>Published</small><b>{published.length}</b></article><article><small>In progress</small><b>{curriculum.filter(row=>row.status==='in_progress').length}</b></article><article><small>Completed</small><b>{curriculum.filter(row=>row.status==='completed').length}</b></article></div><label className="iop-search">Search curriculum<input value={search} onChange={e=>{setSearch(e.target.value);setListPage(1)}} placeholder="Unit, subject or status…"/></label>{visibleCurriculum.length?<div className="iop-table-wrap"><table><thead><tr><th>Order</th><th>Unit</th><th>Subject / class</th><th>Session</th><th>Planned dates</th><th>Status</th><th>Action</th></tr></thead><tbody>{pageRows(visibleCurriculum).map(row=><tr key={row.id}><td>{number(row.sequence_no)}</td><td><b>{String(row.title)}</b><small>{String(row.unit_code??'')}</small></td><td>{String(subjects.find(x=>x.id===row.subject_id)?.name??'Subject')}<small>{String(classes.find(x=>x.id===row.class_id)?.name??'Class')}</small></td><td>{String(sessions.find(x=>x.id===row.academic_session_id)?.name??'—')}</td><td>{prettyDate(row.planned_start)} – {prettyDate(row.planned_end)}</td><td><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></td><td>{teacher&&row.status!=='published'&&<button className="iop-button" onClick={()=>void updateStatus('curriculum_units',row,{status:row.status==='planned'?'in_progress':row.status==='in_progress'?'completed':'published',updated_by:user!.id},row.status==='completed'?'Curriculum unit published.':'Curriculum unit status updated.')}>{row.status==='completed'?'Publish':row.status==='planned'?'Start unit':'Complete'}</button>}</td></tr>)}</tbody></table></div>:<div className="iop-empty"><BookOpen size={22}/><b>No curriculum units defined</b><span>Build a unit plan for a subject and class.</span></div>}</div>
  }

  function renderBehaviour(){
    const categoryFor=(row:Row)=>String(row.category??'').toLowerCase()
    const rows=visibleBehaviour.filter(row=>{
      if(view==='positive')return row.event_type==='positive'
      if(view==='follow-up')return row.follow_up_required===true
      if(view==='register')return row.event_type!=='positive'
      if(view==='skills')return categoryFor(row).includes('student-skill')
      if(view==='activities')return categoryFor(row).includes('co-curricular')
      if(view==='competencies')return categoryFor(row).includes('competency')
      return true
    })
    const title=view==='positive'?'Positive behaviour and recognition':view==='follow-up'?'Student care follow-up queue':view==='skills'?'Student skills register':view==='activities'?'Co-curricular participation':view==='competencies'?'Competency tracking':view==='history'?'Student progress history':view==='analytics'?'Behaviour and skills analytics':view==='reports'?'Downloadable student-care report':'Student behaviour register'
    const categoryCounts=['student-skill','co-curricular','competency'].map(category=>({category,total:behaviour.filter(row=>categoryFor(row).includes(category)).length,positive:behaviour.filter(row=>categoryFor(row).includes(category)&&row.event_type==='positive').length}))
    const openCases=behaviour.filter(row=>!['resolved','closed'].includes(String(row.status)))
    return <div className="iop-panel"><header><div><h2>{title}</h2><p>Real student-care events are filtered by category. Safeguarding entries remain staff-only and linked-family visibility is controlled per record.</p></div>{teacher&&<button className="iop-button primary" onClick={()=>openDialog('behaviour',{
      event_type:['skills','activities','competencies','positive'].includes(view)?'positive':'concern',
      category:view==='skills'?'student-skill':view==='activities'?'co-curricular':view==='competencies'?'competency':view==='positive'?'recognition':'behaviour',
      family_visible:'false',follow_up_required:'false',severity:'low',event_date:day()
    })}><Plus size={14}/> {view==='skills'?'Record skill':view==='activities'?'Record activity':view==='competencies'?'Record competency':'Record event'}</button>}</header>
      <div className="iop-kpis"><article><small>Total records</small><b>{behaviour.length}</b></article><article><small>Positive recognition</small><b>{behaviour.filter(row=>row.event_type==='positive').length}</b></article><article><small>Open cases</small><b>{openCases.length}</b></article><article><small>Follow-up required</small><b>{behaviour.filter(row=>row.follow_up_required&&!['resolved','closed'].includes(String(row.status))).length}</b></article></div>
      {(view==='analytics'||view==='reports')?<><div className="iop-kpis">{categoryCounts.map(item=><article key={item.category}><small>{toLabel(item.category)}</small><b>{item.total}</b><small>{item.positive} positive records</small></article>)}</div><div className="iop-table-wrap"><table><thead><tr><th>Event category</th><th>Total</th><th>Positive</th><th>Open / follow-up</th></tr></thead><tbody>{['positive','concern','incident','safeguarding'].map(type=><tr key={type}><td>{toLabel(type)}</td><td>{behaviour.filter(row=>row.event_type===type).length}</td><td>{behaviour.filter(row=>row.event_type===type&&row.status==='resolved').length}</td><td>{behaviour.filter(row=>row.event_type===type&&!['resolved','closed'].includes(String(row.status))).length}</td></tr>)}</tbody></table></div><div className="iop-actions"><button className="iop-button" onClick={()=>exportRows('behaviour-'+view,rows,[{key:'student_id',label:'Student ID'},{key:'event_date',label:'Date'},{key:'event_type',label:'Type'},{key:'category',label:'Category'},{key:'summary',label:'Summary'},{key:'severity',label:'Severity'},{key:'status',label:'Status'},{key:'follow_up_date',label:'Follow-up date'}])}><Download size={14}/> Export CSV</button></div></>:<><label className="iop-search">Search student-care records<input value={search} onChange={e=>{setSearch(e.target.value);setListPage(1)}} placeholder="Student, category or event…"/></label>{rows.length?<div className="iop-table-wrap"><table><thead><tr><th>Student</th><th>Date</th><th>Type / category</th><th>Summary</th><th>Severity</th><th>Family visibility</th><th>Follow-up</th><th>Status</th></tr></thead><tbody>{pageRows(rows).map(row=><tr key={row.id}><td>{String(students.find(x=>x.id===row.student_id)?.full_name??'Student')}</td><td>{prettyDate(row.event_date)}</td><td>{toLabel(row.event_type)}<small>{String(row.category)}</small></td><td>{String(row.summary)}</td><td>{toLabel(row.severity)}</td><td>{row.family_visible?'Visible':'Staff only'}</td><td>{row.follow_up_required?prettyDate(row.follow_up_date):'—'}</td><td><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></td></tr>)}</tbody></table></div>:<div className="iop-empty">No records in this behaviour view.</div>}</>}
    </div>
  }

  function renderCertificates(){
    const rows=visibleCertificates
    if(view==='templates')return <div className="iop-panel"><header><div><h2>Certificate and ID-card templates</h2><p>Save institution-specific document copy and signatory defaults. Templates do not issue a document until the certificate is generated and approved.</p></div></header>{admin&&<form className="iop-form" onSubmit={saveCertificateTemplate}><div className="iop-form-grid">{field('Template name','template_name')}{field('Document type','document_kind','text',true,[{label:'Character certificate',value:'character'},{label:'Leaving certificate',value:'leaving'},{label:'Enrollment certificate',value:'enrollment'},{label:'Bonafide certificate',value:'bonafide'},{label:'Achievement certificate',value:'achievement'},{label:'Experience certificate',value:'experience'},{label:'Student ID card design',value:'id-card'}])}{field('Signatory name','template_signatory','text',false)}{field('Template body / statement','template_body','textarea')}</div><div className="modal-actions"><button className="iop-button primary" disabled={busy}>Save document template</button></div></form>}<div className="iop-table-wrap"><table><thead><tr><th>Template</th><th>Document type</th><th>Signatory</th><th>Version</th><th>Status</th></tr></thead><tbody>{certificateTemplates.map(row=><tr key={row.id}><td><b>{String(row.title)}</b></td><td>{toLabel(row.description??'certificate')}</td><td>{String((row.payload as Record<string,unknown>|undefined)?.signatory??'—')}</td><td>{String((row.payload as Record<string,unknown>|undefined)?.version??1)}</td><td>{String(row.status??'active')}</td></tr>)}</tbody></table></div>{certificateTemplates.length===0&&<div className="iop-empty">No document templates are saved yet. Create the first template above.</div>}</div>
    if(view==='bulk')return <div className="iop-panel"><header><div><h2>Bulk certificate generation</h2><p>Select a saved template and learners. This creates draft certificates; an authorised officer must review and issue each certificate.</p></div></header>{admin&&<form className="iop-form" onSubmit={generateBulkCertificates}><div className="iop-form-grid"><label className="iop-field">Certificate template<select required value={bulkTemplateId} onChange={e=>setBulkTemplateId(e.target.value)}><option value="">Choose template</option>{certificateTemplates.filter(row=>row.status==='active').map(row=><option key={row.id} value={row.id}>{String(row.title)} · {toLabel(row.description??'certificate')}</option>)}</select></label></div><div className="iop-bulk-students"><div className="iop-actions"><b>Select learners ({bulkStudents.length} selected)</b><button type="button" className="iop-button" onClick={()=>setBulkStudents(students.filter(row=>row.status==='active').map(row=>row.id))}>Select all active</button><button type="button" className="iop-button" onClick={()=>setBulkStudents([])}>Clear</button></div>{students.filter(row=>row.status==='active').map(student=><label key={student.id}><input type="checkbox" checked={bulkStudents.includes(student.id)} onChange={e=>setBulkStudents(current=>e.target.checked?[...current,student.id]:current.filter(id=>id!==student.id))}/><span>{String(student.full_name??'Student')}<small>{String(student.admission_no??'No admission ID')} · {String(student.class_name??'Class not assigned')}</small></span></label>)}</div><div className="modal-actions"><button className="iop-button primary" disabled={busy||bulkStudents.length===0||!bulkTemplateId}>{busy?'Generating…':'Generate draft certificates'}</button></div></form>}</div>
    const historyOnly=view==='history'
    const visibleRows=historyOnly?rows:rows
    return <div className="iop-panel"><header><div><h2>{view==='issue'?'Issue a student certificate':historyOnly?'Certificate issue and revocation history':'Certificate register and verification'}</h2><p>Certificates use institution-unique serial numbers and a verification code. Printed output is a browser print view; no external digital-signature provider is configured.</p></div><div className="iop-actions">{admin&&<button className="iop-button primary" onClick={()=>openDialog('certificate')}><Plus size={14}/> Create certificate</button>}</div></header><div className="iop-kpis"><article><small>Total certificates</small><b>{certificates.length}</b></article><article><small>Issued</small><b>{certificates.filter(row=>row.status==='issued').length}</b></article><article><small>Drafts</small><b>{certificates.filter(row=>row.status==='draft').length}</b></article><article><small>Revoked</small><b>{certificates.filter(row=>row.status==='revoked').length}</b></article></div>{!historyOnly&&<div className="iop-search-grid"><label className="iop-search">Search register<input value={search} onChange={e=>{setSearch(e.target.value);setListPage(1)}} placeholder="Certificate number, student or title…"/></label><label className="iop-search">Verify certificate code<input value={certificateCode} onChange={e=>{setCertificateCode(e.target.value);setCertificateResult(certificates.find(row=>row.verification_code===e.target.value.trim().toUpperCase())??null)}} placeholder="Enter verification code…"/></label></div>}{certificateCode&&<div className={'iop-verification '+(certificateResult?.status==='issued'?'valid':'invalid')}>{certificateResult?.status==='issued'?<><CheckCircle2 size={17}/><span><b>Issued certificate found</b>{String(certificateResult.title)} · {String(students.find(x=>x.id===certificateResult.student_id)?.full_name??'Student')}</span></>:<><ShieldCheck size={17}/><span>No issued certificate matches that code in this institution.</span></>}</div>}{visibleRows.length?<div className="iop-table-wrap"><table><thead><tr><th>Certificate no.</th><th>Student</th><th>Type / title</th><th>Issue date</th><th>Verification code</th><th>Status</th><th>Action</th></tr></thead><tbody>{pageRows(visibleRows).map(row=><tr key={row.id}><td><b>{String(row.certificate_no)}</b></td><td>{String(students.find(x=>x.id===row.student_id)?.full_name??'Student')}</td><td>{toLabel(row.certificate_type)}<small>{String(row.title)}</small></td><td>{prettyDate(row.issue_date)}</td><td className="iop-mono">{String(row.verification_code)}</td><td><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></td><td><div className="iop-actions">{admin&&row.status==='draft'&&<button className="iop-button" onClick={()=>void updateStatus('student_certificates',row,{status:'issued',issue_date:day(),issued_by:user!.id},'Certificate issued.')}>Issue</button>}{row.status==='issued'&&<button className="iop-button" onClick={()=>window.print()}><Printer size={13}/> Print</button>}{admin&&row.status==='issued'&&<button className="iop-button danger" onClick={()=>void updateStatus('student_certificates',row,{status:'revoked'},'Certificate revoked.')}>Revoke</button>}</div></td></tr>)}</tbody></table></div>:<div className="iop-empty"><FileBadge size={22}/><b>No certificates in the register</b><span>Create an approved certificate for a learner to get started.</span></div>}</div>
  }

  function renderVisitors(){
    const rows=visibleVisitors.filter(row=>
      view==='checked-in'?row.status==='checked_in':
      view==='history'?['checked_out','denied','cancelled'].includes(String(row.status)):
      view==='approvals'?row.status==='expected'&&!row.approved_by:true)
    const pending=visitors.filter(row=>row.status==='expected'&&!row.approved_by)
    const approved=visitors.filter(row=>Boolean(row.approved_by)&&row.status==='expected')
    if(view==='reports')return <div className="iop-panel"><header><div><h2>Visitor activity report</h2><p>Counts are calculated from this institution's registered visitor entries and entry/exit timestamps.</p></div><button className="iop-button" onClick={()=>exportRows('visitor-report',visitors,[{key:'visitor_name',label:'Visitor'},{key:'organization',label:'Organisation'},{key:'purpose',label:'Purpose'},{key:'visit_date',label:'Visit date'},{key:'badge_number',label:'Badge'},{key:'status',label:'Status'},{key:'checked_in_at',label:'Checked in'},{key:'checked_out_at',label:'Checked out'}])}><Download size={14}/> Export CSV</button></header><div className="iop-kpis"><article><small>Total visits</small><b>{visitors.length}</b></article><article><small>Approved / expected</small><b>{approved.length}</b></article><article><small>Checked in</small><b>{visitors.filter(row=>row.status==='checked_in').length}</b></article><article><small>Denied / cancelled</small><b>{visitors.filter(row=>['denied','cancelled'].includes(String(row.status))).length}</b></article></div><div className="iop-table-wrap"><table><thead><tr><th>Visit date</th><th>Visitor</th><th>Host</th><th>Organisation</th><th>State</th><th>Duration / entry</th></tr></thead><tbody>{pageRows(visitors).map(row=><tr key={row.id}><td>{prettyDate(row.visit_date)}</td><td>{String(row.visitor_name)}</td><td>{String(teachers.find(x=>x.id===row.host_teacher_id)?.full_name??'—')}</td><td>{String(row.organization??'—')}</td><td>{row.status==='expected'&&row.approved_by?'Approved':toLabel(row.status)}</td><td>{row.checked_in_at?new Date(String(row.checked_in_at)).toLocaleString():'Not checked in'}</td></tr>)}</tbody></table></div></div>
    if(view==='notifications')return <div className="iop-panel"><header><div><h2>Visitor host notifications</h2><p>Notify a host about a scheduled visitor using the institution in-app messaging centre. WhatsApp and email require external providers.</p></div><button type="button" className="iop-button primary" onClick={()=>window.location.hash='#/'}>Open message centre</button></header><div className="iop-kpis"><article><small>Visitors expected</small><b>{visitors.filter(row=>row.status==='expected').length}</b></article><article><small>Awaiting approval</small><b>{pending.length}</b></article><article><small>Approved visits</small><b>{approved.length}</b></article><article><small>Host contacts available</small><b>{teachers.filter(row=>row.user_id).length}</b></article></div><p className="iop-help">Use Communication → Individual Messages to notify the host. This page does not claim an email or WhatsApp notification was delivered.</p></div>
    return <div className="iop-panel"><header><div><h2>{view==='checked-in'?'Visitors currently on site':view==='history'?'Completed and closed visits':view==='approvals'?'Visitor access approvals':'Visitor registration and entry log'}</h2><p>Visitors are registered with a host and purpose. Unapproved visits remain expected and cannot be checked in; owner/admin approval is recorded before entry.</p></div><div className="iop-actions">{view!=='approvals'&&<button className="iop-button" onClick={()=>exportRows('visitor-register',rows,[{key:'visitor_name',label:'Visitor'},{key:'organization',label:'Organisation'},{key:'purpose',label:'Purpose'},{key:'visit_date',label:'Visit date'},{key:'badge_number',label:'Badge'},{key:'status',label:'Status'}])}><Download size={14}/> Export</button>}<button className="iop-button primary" onClick={()=>openDialog('visitor')}><Plus size={14}/> Register visitor</button></div></header><div className="iop-kpis"><article><small>Visits today</small><b>{visitors.filter(row=>row.visit_date===day()).length}</b></article><article><small>Awaiting approval</small><b>{pending.length}</b></article><article><small>Approved / expected</small><b>{approved.length}</b></article><article><small>Checked in</small><b>{visitors.filter(row=>row.status==='checked_in').length}</b></article></div><label className="iop-search">Search visitor register<input value={search} onChange={e=>{setSearch(e.target.value);setListPage(1)}} placeholder="Visitor, organisation, host or badge…"/></label>{rows.length?<div className="iop-table-wrap"><table><thead><tr><th>Visitor</th><th>Organisation</th><th>Purpose</th><th>Host</th><th>Visit date</th><th>Badge</th><th>Approval / status</th><th>Action</th></tr></thead><tbody>{pageRows(rows).map(row=><tr key={row.id}><td><b>{String(row.visitor_name)}</b><small>{String(row.phone??row.email??'')}</small></td><td>{String(row.organization??'—')}</td><td>{String(row.purpose)}</td><td>{String(teachers.find(x=>x.id===row.host_teacher_id)?.full_name??'—')}</td><td>{prettyDate(row.visit_date)}</td><td>{String(row.badge_number??'—')}</td><td>{row.status==='expected'&&row.approved_by?'Approved':row.status==='expected'?'Awaiting approval':toLabel(row.status)}</td><td><div className="iop-actions">{view==='approvals'&&admin&&row.status==='expected'&&!row.approved_by&&<><button className="iop-button primary" disabled={busy} onClick={()=>void updateStatus('visitor_entries',row,{approved_by:user!.id},'Visitor approved for entry.')}>Approve</button><button className="iop-button danger" disabled={busy} onClick={()=>void updateStatus('visitor_entries',row,{status:'denied'},'Visitor access denied.')}>Deny</button></>}{row.status==='expected'&&Boolean(row.approved_by)&&<button className="iop-button" disabled={busy} onClick={()=>void updateStatus('visitor_entries',row,{status:'checked_in',checked_in_at:time()},'Visitor checked in.')}>Check in</button>}{row.status==='checked_in'&&<button className="iop-button" disabled={busy} onClick={()=>void updateStatus('visitor_entries',row,{status:'checked_out',checked_out_at:time()},'Visitor checked out.')}>Check out</button>}</div></td></tr>)}</tbody></table></div>:<div className="iop-empty">{view==='approvals'?'No visitor approvals are waiting for review.':'No visitor entries match this view.'}</div>}</div>
  }

  function renderFacilities(){
    if(view==='reservations'){
      const rows=roomReservations.filter(row=>reservationStatus==='all'||row.status===reservationStatus)
      return <div className="iop-panel"><header><div><h2>Room reservation register</h2><p>Reservations are linked to real institution rooms. Requested bookings require owner/admin approval; approvals check overlapping approved reservations before confirmation.</p></div><div className="iop-actions"><select aria-label="Filter room reservations" value={reservationStatus} onChange={e=>setReservationStatus(e.target.value)}><option value="all">All statuses</option><option value="requested">Requested</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select><button className="iop-button primary" onClick={()=>openDialog('room-reservation')}><Plus size={14}/> Request reservation</button></div></header><div className="iop-kpis"><article><small>Total reservations</small><b>{roomReservations.length}</b></article><article><small>Awaiting approval</small><b>{roomReservations.filter(row=>row.status==='requested').length}</b></article><article><small>Approved</small><b>{roomReservations.filter(row=>row.status==='approved').length}</b></article><article><small>Rooms available to book</small><b>{reservationRooms.length}</b></article></div>{rows.length?<div className="iop-table-wrap"><table><thead><tr><th>Room</th><th>Reservation</th><th>Purpose</th><th>Start</th><th>End</th><th>Requested by</th><th>Status</th><th>Action</th></tr></thead><tbody>{pageRows(rows).map(row=><tr key={row.id}><td><b>{String(reservationRooms.find(room=>room.id===row.room_id)?.name??'Room')}</b><small>{String(reservationRooms.find(room=>room.id===row.room_id)?.code??'')}</small></td><td>{String(row.title)}</td><td>{String(row.purpose)}</td><td>{new Date(String(row.start_at)).toLocaleString()}</td><td>{new Date(String(row.end_at)).toLocaleString()}</td><td>{String(row.requested_by)===user!.id?'You':String(row.requested_by).slice(0,8)}</td><td><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></td><td><div className="iop-actions">{admin&&row.status==='requested'&&<><button className="iop-button primary" disabled={busy} onClick={()=>void approveRoomReservation(row)}>Approve</button><button className="iop-button danger" disabled={busy} onClick={()=>void updateStatus('facility_room_reservations',row,{status:'rejected'},'Room reservation rejected.')}>Reject</button></>}{(admin||String(row.requested_by)===user!.id)&&row.status==='requested'&&<button className="iop-button" disabled={busy} onClick={()=>void updateStatus('facility_room_reservations',row,{status:'cancelled'},'Room reservation cancelled.')}>Cancel</button>}</div></td></tr>)}</tbody></table></div>:<div className="iop-empty">No room reservations match this status.</div>}</div>
    }
    if(view==='reports')return <div className="iop-panel"><header><div><h2>Facilities and asset report</h2><p>Summary is calculated from room, asset, maintenance and reservation data recorded by the institution.</p></div><button className="iop-button" onClick={()=>exportRows('facility-asset-maintenance-report',[...assets,...maintenance,...roomReservations],[{key:'id',label:'Record ID'},{key:'asset_code',label:'Asset code'},{key:'asset_name',label:'Asset'},{key:'title',label:'Title'},{key:'status',label:'Status'},{key:'priority',label:'Priority'},{key:'start_at',label:'Reservation start'},{key:'end_at',label:'Reservation end'}])}><Download size={14}/> Export report</button></header><div className="iop-kpis"><article><small>Rooms available</small><b>{reservationRooms.length}</b></article><article><small>Assets</small><b>{assets.length}</b></article><article><small>Open maintenance</small><b>{maintenance.filter(row=>!['completed','cancelled'].includes(String(row.status))).length}</b></article><article><small>Approved reservations</small><b>{roomReservations.filter(row=>row.status==='approved').length}</b></article></div><div className="iop-table-wrap"><table><thead><tr><th>Facility indicator</th><th>Count</th><th>Details</th></tr></thead><tbody><tr><td>Assets in maintenance</td><td>{assets.filter(row=>row.status==='maintenance').length}</td><td>Asset status = maintenance</td></tr><tr><td>Urgent / high requests</td><td>{maintenance.filter(row=>['urgent','high'].includes(String(row.priority))&&!['completed','cancelled'].includes(String(row.status))).length}</td><td>Open high-priority work</td></tr><tr><td>Pending room bookings</td><td>{roomReservations.filter(row=>row.status==='requested').length}</td><td>Awaiting owner/admin approval</td></tr><tr><td>Rejected / cancelled bookings</td><td>{roomReservations.filter(row=>['rejected','cancelled'].includes(String(row.status))).length}</td><td>Not occupying a confirmed slot</td></tr></tbody></table></div></div>
    if(view==='history'){
      const completed=maintenance.filter(row=>['completed','cancelled'].includes(String(row.status)))
      return <div className="iop-panel"><header><div><h2>Facility maintenance history</h2><p>Completed and cancelled work requests retained for institutional review.</p></div></header>{completed.length?<div className="iop-table-wrap"><table><thead><tr><th>Request</th><th>Asset / room</th><th>Requested</th><th>Resolved</th><th>Outcome</th></tr></thead><tbody>{pageRows(completed).map(row=><tr key={row.id}><td><b>{String(row.title)}</b><small>{String(row.description)}</small></td><td>{String(assets.find(x=>x.id===row.asset_id)?.asset_name??rooms.find(x=>x.id===row.room_id)?.name??'—')}</td><td>{prettyDate(row.requested_at)}</td><td>{prettyDate(row.resolved_at)}</td><td><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></td></tr>)}</tbody></table></div>:<div className="iop-empty">No completed facility requests are recorded.</div>}</div>
    }
    if(view==='assets')return <div className="iop-panel"><header><div><h2>Facility asset register</h2><p>Track classrooms, specialist equipment and institution assets. Asset inventory changes are owner/admin controlled.</p></div>{admin&&<button className="iop-button primary" onClick={()=>openDialog('asset')}><Plus size={14}/> Add asset</button>}</header><div className="iop-kpis"><article><small>Total assets</small><b>{assets.length}</b></article><article><small>Active</small><b>{assets.filter(row=>row.status==='active').length}</b></article><article><small>In maintenance</small><b>{assets.filter(row=>row.status==='maintenance').length}</b></article><article><small>Retired</small><b>{assets.filter(row=>['retired','disposed'].includes(String(row.status))).length}</b></article></div><label className="iop-search">Search asset register<input value={search} onChange={e=>{setSearch(e.target.value);setListPage(1)}} placeholder="Asset code, name, type or room…"/></label>{visibleAssets.length?<div className="iop-table-wrap"><table><thead><tr><th>Asset</th><th>Category</th><th>Room / building</th><th>Condition</th><th>Replacement due</th><th>Status</th></tr></thead><tbody>{pageRows(visibleAssets).map(row=><tr key={row.id}><td><b>{String(row.asset_code)}</b><small>{String(row.asset_name)}</small></td><td>{toLabel(row.category)}</td><td>{String(rooms.find(x=>x.id===row.room_id)?.name??row.building??'—')}</td><td>{toLabel(row.condition)}</td><td>{prettyDate(row.replacement_due)}</td><td><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></td></tr>)}</tbody></table></div>:<div className="iop-empty"><Wrench size={22}/><b>No facility assets recorded</b><span>Owner/admin can register the first asset.</span></div>}</div>
    return <div className="iop-panel"><header><div><h2>Facility maintenance queue</h2><p>Teachers can submit a request. Owner/admin assigns work, tracks progress and records completion.</p></div><button className="iop-button primary" onClick={()=>openDialog('maintenance')}><Plus size={14}/> New maintenance request</button></header><div className="iop-kpis"><article><small>Open requests</small><b>{maintenance.filter(row=>!['completed','cancelled'].includes(String(row.status))).length}</b></article><article><small>Urgent / high</small><b>{maintenance.filter(row=>['urgent','high'].includes(String(row.priority))&&row.status!=='completed').length}</b></article><article><small>In progress</small><b>{maintenance.filter(row=>row.status==='in_progress').length}</b></article><article><small>Completed</small><b>{maintenance.filter(row=>row.status==='completed').length}</b></article></div><label className="iop-search">Search maintenance requests<input value={search} onChange={e=>{setSearch(e.target.value);setListPage(1)}} placeholder="Request, asset, priority or status…"/></label>{visibleMaintenance.length?<div className="iop-table-wrap"><table><thead><tr><th>Request</th><th>Asset / room</th><th>Priority</th><th>Requested</th><th>Assigned to</th><th>Status</th><th>Action</th></tr></thead><tbody>{pageRows(visibleMaintenance).map(row=><tr key={row.id}><td><b>{String(row.title)}</b><small>{String(row.description)}</small></td><td>{String(assets.find(x=>x.id===row.asset_id)?.asset_name??rooms.find(x=>x.id===row.room_id)?.name??'—')}</td><td><span className={'iop-priority '+String(row.priority)}>{toLabel(row.priority)}</span></td><td>{prettyDate(row.requested_at)}</td><td>{String(teachers.find(x=>x.id===row.assigned_to)?.full_name??'Unassigned')}</td><td><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></td><td>{admin&&row.status!=='completed'&&row.status!=='cancelled'&&<div className="iop-actions">{row.status==='submitted'&&<button className="iop-button" onClick={()=>void updateStatus('facility_maintenance_requests',row,{status:'assigned'},'Maintenance request assigned.')}>Assign</button>}{row.status==='assigned'&&<button className="iop-button" onClick={()=>void updateStatus('facility_maintenance_requests',row,{status:'in_progress'},'Maintenance work started.')}>Start</button>}{row.status==='in_progress'&&<button className="iop-button primary" onClick={()=>void updateStatus('facility_maintenance_requests',row,{status:'completed',resolved_at:time()},'Maintenance request completed.')}>Complete</button>}</div>}</td></tr>)}</tbody></table></div>:<div className="iop-empty">No maintenance requests are recorded.</div>}</div>
  }

  function renderDialog(){
    if(!dialog)return null
    let title='Create record'
    const fields:ReactNode[]=[]
    const subjectOptions=subjects.map(row=>({label:String(row.name),value:String(row.id)}))
    const classOptions=classes.map(row=>({label:String(row.name),value:String(row.id)}))
    const sessionOptions=sessions.map(row=>({label:String(row.name??row.session_name),value:String(row.id)}))
    const studentOptions=students.map(row=>({label:String(row.full_name)+' · '+String(row.admission_no),value:String(row.id)}))
    const teacherOptions=teachers.map(row=>({label:String(row.full_name),value:String(row.id)}))
    const roomOptions=rooms.map(row=>({label:String(row.room_name??row.room_code??row.id),value:String(row.id)}))
    const reservationRoomOptions=reservationRooms.map(row=>({label:String(row.name)+' · '+String(row.room_type??'room')+' · '+String(row.code??row.id).slice(0,8),value:String(row.id)}))
    if(dialog==='question'){
      title='Create question bank item'
      fields.push(field('Question code','question_code'),field('Question type','question_type','text',true,['multiple_choice','true_false','short_answer','long_answer','fill_blank'].map(x=>({label:toLabel(x),value:x}))),field('Subject','subject_id','text',true,subjectOptions),field('Class','class_id','text',false,classOptions),field('Academic session','academic_session_id','text',false,sessionOptions),field('Prompt','prompt','textarea'),field('Options JSON array','options','textarea',false),field('Answer key JSON','answer_key','textarea',false),field('Explanation','explanation','textarea',false),field('Marks','marks','number'),field('Difficulty','difficulty','text',true,['easy','medium','hard'].map(x=>({label:toLabel(x),value:x}))),field('Topic','topic','text',false),field('Tags (comma-separated)','tags','text',false))
    }else if(dialog==='paper'){
      title='Create question paper draft'
      fields.push(field('Paper code','paper_code','text',false),field('Title','title'),field('Subject','subject_id','text',true,subjectOptions),field('Class','class_id','text',true,classOptions),field('Academic session','academic_session_id','text',false,sessionOptions),field('Duration (minutes)','duration_minutes','number'),field('Maximum marks','maximum_marks','number'),field('Instructions','instructions','textarea',false))
    }else if(dialog==='curriculum'){
      title='Plan curriculum unit'
      fields.push(field('Unit code','unit_code','text',false),field('Unit title','title'),field('Subject','subject_id','text',true,subjectOptions),field('Class','class_id','text',true,classOptions),field('Academic session','academic_session_id','text',false,sessionOptions),field('Sequence number','sequence_no','number'),field('Overview','overview','textarea',false),field('Learning objectives JSON array','learning_objectives','textarea',false),field('Learning outcomes JSON array','learning_outcomes','textarea',false),field('Planned start','planned_start','date',false),field('Planned end','planned_end','date',false))
    }else if(dialog==='behaviour'){
      title='Record student-care event'
      fields.push(field('Student','student_id','text',true,studentOptions),field('Event type','event_type','text',true,['positive','concern','incident','safeguarding'].map(x=>({label:toLabel(x),value:x}))),field('Category','category'),field('Severity','severity','text',true,['low','medium','high','critical'].map(x=>({label:toLabel(x),value:x}))),field('Event date','event_date','date'),field('Summary','summary'),field('Description','description','textarea',false),field('Action taken','action_taken','textarea',false),field('Follow-up required','follow_up_required','text',true,[{label:'No',value:'false'},{label:'Yes',value:'true'}]),field('Follow-up date','follow_up_date','date',false),field('Family visible','family_visible','text',true,[{label:'Staff only',value:'false'},{label:'Share with linked family',value:'true'}]))
    }else if(dialog==='certificate'){
      title='Create certificate'
      fields.push(field('Student','student_id','text',true,studentOptions),field('Certificate number','certificate_no','text',false),field('Certificate type','certificate_type','text',true,['character','leaving','enrollment','bonafide','achievement','experience'].map(x=>({label:toLabel(x),value:x}))),field('Certificate title','title'),field('Achievement / statement','achievement','textarea',false),field('Issue date','issue_date','date',false),field('Expiry date','expiry_date','date',false),field('Signatory name','signatory_name','text',false),field('Initial state','status','text',true,[{label:'Draft',value:'draft'},{label:'Issue now',value:'issued'}]),field('Remarks','remarks','textarea',false))
    }else if(dialog==='visitor'){
      title='Register visitor'
      fields.push(field('Visitor name','visitor_name'),field('Phone','phone','text',false),field('Email','email','email',false),field('Organisation','organization','text',false),field('Purpose','purpose'),field('Host employee','host_teacher_id','text',false,teacherOptions),field('Visit date','visit_date','date'),field('Badge number','badge_number','text',false),field('Status','status','text',true,[{label:'Expected',value:'expected'},{label:'Check in now',value:'checked_in'}]),field('Notes','notes','textarea',false))
    }else if(dialog==='asset'){
      title='Register facility asset'
      fields.push(field('Asset code','asset_code','text',false),field('Asset name','asset_name'),field('Category','category'),field('Room','room_id','text',false,roomOptions),field('Building / location','building','text',false),field('Condition','condition','text',true,['excellent','good','fair','poor','out_of_service'].map(x=>({label:toLabel(x),value:x}))),field('Acquired on','acquired_on','date',false),field('Replacement due','replacement_due','date',false),field('Purchase cost (PKR)','purchase_cost','number',false),field('Notes','notes','textarea',false))
    }else if(dialog==='room-reservation'){
      title='Request a room reservation'
      fields.push(field('Room','room_id','text',true,reservationRoomOptions),field('Reservation title','title'),field('Purpose','purpose','textarea'),field('Start time','start_at','datetime-local'),field('End time','end_at','datetime-local'),field('Notes','notes','textarea',false))
    }else if(dialog==='maintenance'){
      title='Submit maintenance request'
      fields.push(field('Request title','title'),field('Description','description','textarea'),field('Asset','asset_id','text',false,assets.map(row=>({label:String(row.asset_code)+' · '+String(row.asset_name),value:String(row.id)}))),field('Room','room_id','text',false,roomOptions),field('Priority','priority','text',true,['low','medium','high','urgent'].map(x=>({label:toLabel(x),value:x}))),admin?field('Assign to employee','assigned_to','text',false,teacherOptions):null,field('Scheduled date','scheduled_for','date',false))
    }
    return <div className="modal-backdrop"><section className="modal-card iop-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">{domainTitles[selectedDomain].toUpperCase()}</div><h2>{title}</h2><p>Saved to the institution's cloud database with role-based record access.</p></div><button className="icon-button" onClick={()=>setDialog(null)}><X size={18}/></button></div><form className="iop-form" onSubmit={saveDialog}><div className="iop-form-grid">{fields.filter(Boolean)}</div><div className="modal-actions"><button type="button" className="iop-button" onClick={()=>setDialog(null)}>Cancel</button><button className="iop-button primary" disabled={busy}>{busy?'Saving…':'Save record'}</button></div></form></section></div>
  }

  function renderContent(){
    if(selectedDomain==='question-bank')return renderQuestionBank()
    if(selectedDomain==='curriculum')return renderCurriculum()
    if(selectedDomain==='behaviour')return renderBehaviour()
    if(selectedDomain==='certificates')return renderCertificates()
    if(selectedDomain==='visitors')return renderVisitors()
    return renderFacilities()
  }
  function pageRows<T>(rows:T[]):T[]{
    const pageCount=Math.max(1,Math.ceil(rows.length/pageSize))
    const currentPage=Math.min(listPage,pageCount)
    return rows.slice((currentPage-1)*pageSize,currentPage*pageSize)
  }
  function pageControls(total:number){
    const pageCount=Math.max(1,Math.ceil(total/pageSize))
    const currentPage=Math.min(listPage,pageCount)
    return total>pageSize?<div className="iop-pagination">
      <span>Showing <b>{(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize,total)}</b> of <b>{total}</b></span>
      <div><button type="button" className="iop-button" disabled={currentPage<=1} onClick={()=>setListPage(currentPage-1)}>Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" className="iop-button" disabled={currentPage>=pageCount} onClick={()=>setListPage(currentPage+1)}>Next</button></div>
    </div>:null
  }

  const recordCount=selectedDomain==='question-bank'?questions.length+papers.length:selectedDomain==='curriculum'?curriculum.length:selectedDomain==='behaviour'?behaviour.length:selectedDomain==='certificates'?certificates.length:selectedDomain==='visitors'?visitors.length:selectedDomain==='facilities'?assets.length+maintenance.length+roomReservations.length:0
  const viewRowCount=selectedDomain==='question-bank'?Math.max(visibleQuestions.length,visiblePapers.length)
    :selectedDomain==='curriculum'?visibleCurriculum.length
    :selectedDomain==='behaviour'?visibleBehaviour.filter(row=>view==='positive'?row.event_type==='positive':view==='follow-up'?row.follow_up_required===true:view==='register'?row.event_type!=='positive':view==='skills'?String(row.category??'').toLowerCase().includes('student-skill'):view==='activities'?String(row.category??'').toLowerCase().includes('co-curricular'):view==='competencies'?String(row.category??'').toLowerCase().includes('competency'):true).length
    :selectedDomain==='certificates'?view==='templates'?certificateTemplates.length:visibleCertificates.length
    :selectedDomain==='visitors'?visibleVisitors.filter(row=>view==='checked-in'?row.status==='checked_in':view==='history'?['checked_out','denied','cancelled'].includes(String(row.status)):view==='approvals'?row.status==='expected'&&!row.approved_by:true).length
    :view==='reservations'?roomReservations.filter(row=>reservationStatus==='all'||row.status===reservationStatus).length
    :view==='history'?maintenance.filter(row=>['completed','cancelled'].includes(String(row.status))).length
    :view==='assets'?visibleAssets.length:view==='reports'?assets.length+maintenance.length+roomReservations.length:visibleMaintenance.length

  return <main className="iop-stage page-content ed360-module-page">
    <header className="iop-heading"><div><span>INSTITUTION OPERATIONS / {selectedDomain.toUpperCase()}</span><h1>{domainTitles[selectedDomain]}</h1><p>{domainDescriptions[selectedDomain]}</p></div><span className="iop-live"><i/> Institution cloud records</span></header>
    <nav className="iop-nav" aria-label={domainTitles[selectedDomain]+' workspace windows'}>{tabItems.map(key=><button type="button" key={key} className={view===key?'active':''} aria-current={view===key?'page':undefined} onClick={()=>setView(key)}>{viewLabels[key]}</button>)}</nav>
    <section className="iop-context"><div><small>ACTIVE DOMAIN WINDOW</small><h2>{viewLabels[view]}</h2><p>{domainDescriptions[selectedDomain]}</p></div><div><strong>{recordCount}</strong><small>Visible records</small></div></section>
    {error&&<div className="iop-error" role="alert">{error}</div>}
    {loading?<div className="iop-empty"><RefreshCw size={18}/> Loading institution records…</div>:renderContent()}
    {!loading&&viewRowCount>pageSize&&<div className="iop-global-pagination">{pageControls(viewRowCount)}</div>}
    <footer className="iop-footer"><span><ShieldCheck size={14}/> Institution access and linked family visibility are enforced by Supabase row-level security.</span><button className="iop-button" onClick={()=>void load()}><RefreshCw size={14}/> Refresh</button></footer>
    {renderDialog()}
  </main>
}
