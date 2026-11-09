import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpen, CalendarDays, Check, CheckCircle2, ClipboardCheck, Download, FileBadge, FileQuestion, History, Plus, Printer, RefreshCw, Search, ShieldCheck, Users, Wrench, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/userErrors'
import { listRecords } from '../lib/data'
import { downloadCsv } from '../lib/csv'
import type { RecordRow } from '../lib/types'
import '../styles/institution-operations.css'

type Domain = 'question-bank'|'curriculum'|'behaviour'|'certificates'|'visitors'|'facilities'
type View = 'pool'|'papers'|'units'|'coverage'|'register'|'positive'|'follow-up'|'issue'|'verify'|'log'|'checked-in'|'history'|'assets'|'maintenance'
type Row = RecordRow & { id:string; [key:string]:unknown }
type Props = { workspaceKey:string; initialWindow?:string; onToast:(message:string,error?:boolean)=>void }
type Draft = Record<string,string>

const viewLabels:Record<View,string>={
  pool:'Question bank',papers:'Question papers',units:'Curriculum units',coverage:'Curriculum coverage',
  register:'Behaviour register',positive:'Positive recognition', 'follow-up':'Follow-up cases',
  issue:'Issue certificate',verify:'Certificate register',log:'Visitor log','checked-in':'Currently on site',
  history:'Visit history',assets:'Asset register',maintenance:'Maintenance queue',
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
  behaviour:'Maintain confidential staff records, celebrate positive conduct and schedule follow-up with controlled family visibility.',
  certificates:'Issue institution-numbered learner certificates, retain status history and verify recorded certificate codes.',
  visitors:'Register expected visitors, control check-in and check-out, and retain the visit register.',
  facilities:'Track institution assets and handle room or equipment maintenance requests from report to resolution.',
}
const views:Record<Domain,View[]>={
  'question-bank':['pool','papers'],
  curriculum:['units','coverage'],
  behaviour:['register','positive','follow-up'],
  certificates:['verify','issue'],
  visitors:['log','checked-in','history'],
  facilities:['assets','maintenance'],
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
  const finance=false
  const firstView=(views[selectedDomain] as string[]).includes(initialWindow??'')?initialWindow as View:initialViews[selectedDomain] as View
  const [view,setView]=useState<View>(firstView)
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [search,setSearch]=useState('')
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
        const [rows,studentRows]=await Promise.all([fetchRows('student_certificates'),listRecords(mode,user!,'students') as Promise<Row[]>])
        setCertificates(rows);setStudents(studentRows)
      }else if(selectedDomain==='visitors'){
        const [rows,employeeRows]=await Promise.all([fetchRows('visitor_entries'),listRecords(mode,user!,'teachers') as Promise<Row[]>])
        setVisitors(rows);setTeachers(employeeRows)
      }else if(selectedDomain==='facilities'){
        const [assetRows,requestRows,roomRows,employeeRows]=await Promise.all([
          fetchRows('facility_assets'),fetchRows('facility_maintenance_requests'),fetchRows('institution_rooms'),listRecords(mode,user!,'teachers') as Promise<Row[]>,
        ])
        setAssets(assetRows);setMaintenance(requestRows);setRooms(roomRows);setTeachers(employeeRows)
      }
    }catch(err){
      const message=userFacingError(err,'This institutional workspace could not load its records.')
      setError(message);if(!silent)onToast(message,true)
    }finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[user?.id,user?.institutionId,user?.role,selectedDomain])

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
        await insert('assessment_papers',{
          paper_code:v.paper_code||todayCode('PAPER'),title:v.title?.trim(),subject_id:v.subject_id,class_id:v.class_id,
          academic_session_id:v.academic_session_id||null,duration_minutes:Number(v.duration_minutes),
          maximum_marks:Number(v.maximum_marks),instructions:v.instructions||null,status:'draft',created_by:user!.id,
        })
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
        await insert('student_behaviour_events',{
          student_id:v.student_id,event_type:v.event_type,category:v.category?.trim(),severity:v.severity||'low',
          event_date:v.event_date||day(),summary:v.summary?.trim(),description:v.description||null,
          action_taken:v.action_taken||null,follow_up_required:follow,follow_up_date:follow?(v.follow_up_date||null):null,
          family_visible:v.family_visible==='true',status:follow?'follow_up':'open',created_by:user!.id,
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
    await updateStatus('assessment_papers',row,{status,approved_by:status==='approved'?user!.id:null,approved_at:status==='approved'?time():null},status==='approved'?'Question paper approved.':'Question paper sent for review.')
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
      <section className="iop-panel"><header><div><h2>Question pool</h2><p>Questions are private drafts until reviewed and published by an authorised examiner or administrator.</p></div><div className="iop-actions"><button className="iop-button" onClick={()=>exportRows('question-bank',visibleQuestions,[{key:'question_code',label:'Question code'},{key:'question_type',label:'Type'},{key:'prompt',label:'Prompt'},{key:'marks',label:'Marks'},{key:'difficulty',label:'Difficulty'},{key:'status',label:'Status'}])}><Download size={14}/> Export</button><button className="iop-button primary" onClick={()=>openDialog('question')}><Plus size={14}/> Add question</button></div></header><label className="iop-search">Search questions<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Code, text, topic or status…"/></label>{visibleQuestions.length?<div className="iop-record-list">{visibleQuestions.map(row=><article key={row.id}><div className="iop-record-heading"><b>{String(row.question_code)}</b><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></div><p>{String(row.prompt)}</p><div className="iop-meta"><span>{toLabel(row.question_type)}</span><span>{number(row.marks)} marks</span><span>{toLabel(row.difficulty)}</span><span>{String(row.topic??'No topic')}</span></div>{examiner&&row.status==='draft'&&<button className="iop-button" onClick={()=>void updateStatus('question_bank_items',row,{status:'published',reviewed_by:user!.id,reviewed_at:time()},'Question published to the authorised question bank.')}>Publish question</button>}</article>)}</div>:<div className="iop-empty"><FileQuestion size={22}/><b>No questions yet</b><span>Create the first question or change the search term.</span></div>}</section>
      <section className="iop-panel"><header><div><h2>Question paper designer</h2><p>Build a paper from saved institution questions. The paper remains a draft until review and approval.</p></div><button className="iop-button primary" onClick={()=>openDialog('paper')}><Plus size={14}/> New paper</button></header>{visiblePapers.length?<div className="iop-record-list">{visiblePapers.map(row=><button type="button" className={'iop-select-record '+(selected?.id===row.id?'selected':'')} key={row.id} onClick={()=>setSelectedPaper(row.id)}><span><b>{String(row.paper_code)} · {String(row.title)}</b><small>{number(row.duration_minutes)} minutes · {number(row.maximum_marks)} marks</small></span><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></button>)}</div>:<div className="iop-empty">No question papers have been created.</div>}{selected&&<div className="iop-paper-detail"><h3>{String(selected.title)}</h3><div className="iop-meta"><span>{selectedLines.length} questions</span><span>{number(selected.maximum_marks)} maximum marks</span><span>{toLabel(selected.status)}</span></div><label className="iop-field">Add a question<select value={questionToAdd} onChange={e=>setQuestionToAdd(e.target.value)}><option value="">Select question</option>{questions.filter(q=>['draft','published'].includes(String(q.status))&&q.subject_id===selected.subject_id).map(q=><option key={q.id} value={q.id}>{String(q.question_code)} · {String(q.prompt).slice(0,80)}</option>)}</select></label><button className="iop-button" disabled={!questionToAdd||busy} onClick={()=>void addPaperQuestion()}>Add question to draft</button>{selectedLines.map(line=><div className="iop-paper-line" key={line.id}><span>{number(line.sequence_no)}.</span><b>{String(questions.find(q=>q.id===line.question_id)?.question_code??'Question')}</b><small>{String(questions.find(q=>q.id===line.question_id)?.prompt??'')}</small></div>)}{examiner&&selected.status==='draft'&&<button className="iop-button primary" onClick={()=>void changePaperStatus(selected,'review')}>Submit paper for review</button>}{examiner&&selected.status==='review'&&<button className="iop-button primary" onClick={()=>void changePaperStatus(selected,'approved')}>Approve paper</button>}</div>}</section>
    </div>
  }

  function renderCurriculum(){
    const published=curriculum.filter(row=>row.status==='published')
    return <div className="iop-panel"><header><div><h2>Curriculum unit plan</h2><p>Plan each unit by subject, class and academic session. Published units become visible to linked learners/families.</p></div>{teacher&&<div className="iop-actions"><button className="iop-button" onClick={()=>exportRows('curriculum',visibleCurriculum,[{key:'unit_code',label:'Unit code'},{key:'title',label:'Unit'},{key:'sequence_no',label:'Order'},{key:'status',label:'Status'}])}><Download size={14}/> Export</button><button className="iop-button primary" onClick={()=>openDialog('curriculum')}><Plus size={14}/> Plan a unit</button></div>}</header><div className="iop-kpis"><article><small>Total units</small><b>{curriculum.length}</b></article><article><small>Published</small><b>{published.length}</b></article><article><small>In progress</small><b>{curriculum.filter(row=>row.status==='in_progress').length}</b></article><article><small>Completed</small><b>{curriculum.filter(row=>row.status==='completed').length}</b></article></div><label className="iop-search">Search curriculum<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Unit, subject or status…"/></label>{visibleCurriculum.length?<div className="iop-table-wrap"><table><thead><tr><th>Order</th><th>Unit</th><th>Subject / class</th><th>Session</th><th>Planned dates</th><th>Status</th><th>Action</th></tr></thead><tbody>{visibleCurriculum.map(row=><tr key={row.id}><td>{number(row.sequence_no)}</td><td><b>{String(row.title)}</b><small>{String(row.unit_code??'')}</small></td><td>{String(subjects.find(x=>x.id===row.subject_id)?.name??'Subject')}<small>{String(classes.find(x=>x.id===row.class_id)?.name??'Class')}</small></td><td>{String(sessions.find(x=>x.id===row.academic_session_id)?.name??'—')}</td><td>{prettyDate(row.planned_start)} – {prettyDate(row.planned_end)}</td><td><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></td><td>{teacher&&row.status!=='published'&&<button className="iop-button" onClick={()=>void updateStatus('curriculum_units',row,{status:row.status==='planned'?'in_progress':row.status==='in_progress'?'completed':'published',updated_by:user!.id},row.status==='completed'?'Curriculum unit published.':'Curriculum unit status updated.')}>{row.status==='completed'?'Publish':row.status==='planned'?'Start unit':'Complete'}</button>}</td></tr>)}</tbody></table></div>:<div className="iop-empty"><BookOpen size={22}/><b>No curriculum units defined</b><span>Build a unit plan for a subject and class.</span></div>}</div>
  }

  function renderBehaviour(){
    const rows=visibleBehaviour.filter(row=>view==='positive'?row.event_type==='positive':view==='follow-up'?row.follow_up_required===true: true)
    return <div className="iop-panel"><header><div><h2>{view==='positive'?'Positive behaviour and recognition':view==='follow-up'?'Student care follow-up queue':'Student behaviour register'}</h2><p>Private student-care records. Family visibility is explicit and off by default; safeguarding notes remain staff-only unless authorised to share.</p></div>{teacher&&<button className="iop-button primary" onClick={()=>openDialog('behaviour')}><Plus size={14}/> Record event</button>}</header><div className="iop-kpis"><article><small>Total records</small><b>{behaviour.length}</b></article><article><small>Positive</small><b>{behaviour.filter(row=>row.event_type==='positive').length}</b></article><article><small>Concerns / incidents</small><b>{behaviour.filter(row=>['concern','incident','safeguarding'].includes(String(row.event_type))).length}</b></article><article><small>Follow-up due</small><b>{behaviour.filter(row=>row.follow_up_required&&row.status!=='resolved'&&row.status!=='closed').length}</b></article></div><label className="iop-search">Search student-care records<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Student, category or event…"/></label>{rows.length?<div className="iop-table-wrap"><table><thead><tr><th>Student</th><th>Date</th><th>Type / category</th><th>Summary</th><th>Severity</th><th>Family visibility</th><th>Follow-up</th><th>Status</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{String(students.find(x=>x.id===row.student_id)?.full_name??'Student')}</td><td>{prettyDate(row.event_date)}</td><td>{toLabel(row.event_type)}<small>{String(row.category)}</small></td><td>{String(row.summary)}</td><td>{toLabel(row.severity)}</td><td>{row.family_visible?'Visible':'Staff only'}</td><td>{row.follow_up_required?prettyDate(row.follow_up_date):'—'}</td><td><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></td></tr>)}</tbody></table></div>:<div className="iop-empty">No records in this behaviour view.</div>}</div>
  }

  function renderCertificates(){
    const rows=visibleCertificates
    return <div className="iop-panel"><header><div><h2>{view==='issue'?'Issue a student certificate':'Certificate register and verification'}</h2><p>Certificates use institution-unique serial numbers and a verification code. Printed output is a browser print view; no external digital-signature provider is configured.</p></div><div className="iop-actions">{admin&&<button className="iop-button primary" onClick={()=>openDialog('certificate')}><Plus size={14}/> Create certificate</button>}</div></header><div className="iop-kpis"><article><small>Total certificates</small><b>{certificates.length}</b></article><article><small>Issued</small><b>{certificates.filter(row=>row.status==='issued').length}</b></article><article><small>Drafts</small><b>{certificates.filter(row=>row.status==='draft').length}</b></article><article><small>Revoked</small><b>{certificates.filter(row=>row.status==='revoked').length}</b></article></div><div className="iop-search-grid"><label className="iop-search">Search register<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Certificate number, student or title…"/></label><label className="iop-search">Verify certificate code<input value={certificateCode} onChange={e=>{setCertificateCode(e.target.value);setCertificateResult(certificates.find(row=>row.verification_code===e.target.value.trim().toUpperCase())??null)}} placeholder="Enter verification code…"/></label></div>{certificateCode&&<div className={'iop-verification '+(certificateResult?.status==='issued'?'valid':'invalid')}>{certificateResult?.status==='issued'?<><CheckCircle2 size={17}/><span><b>Issued certificate found</b>{String(certificateResult.title)} · {String(students.find(x=>x.id===certificateResult.student_id)?.full_name??'Student')}</span></>:<><ShieldCheck size={17}/><span>No issued certificate matches that code in this institution.</span></>}</div>}{rows.length?<div className="iop-table-wrap"><table><thead><tr><th>Certificate no.</th><th>Student</th><th>Type / title</th><th>Issue date</th><th>Verification code</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><b>{String(row.certificate_no)}</b></td><td>{String(students.find(x=>x.id===row.student_id)?.full_name??'Student')}</td><td>{toLabel(row.certificate_type)}<small>{String(row.title)}</small></td><td>{prettyDate(row.issue_date)}</td><td className="iop-mono">{String(row.verification_code)}</td><td><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></td><td><div className="iop-actions">{admin&&row.status==='draft'&&<button className="iop-button" onClick={()=>void updateStatus('student_certificates',row,{status:'issued',issue_date:day(),issued_by:user!.id},'Certificate issued.')}>Issue</button>}{row.status==='issued'&&<button className="iop-button" onClick={()=>window.print()}><Printer size={13}/> Print</button>}{admin&&row.status==='issued'&&<button className="iop-button danger" onClick={()=>void updateStatus('student_certificates',row,{status:'revoked'},'Certificate revoked.')}>Revoke</button>}</div></td></tr>)}</tbody></table></div>:<div className="iop-empty"><FileBadge size={22}/><b>No certificates in the register</b><span>Create an approved certificate for a learner to get started.</span></div>}</div>
  }

  function renderVisitors(){
    const rows=visibleVisitors.filter(row=>view==='checked-in'?row.status==='checked_in':view==='history'?['checked_out','denied','cancelled'].includes(String(row.status)):true)
    return <div className="iop-panel"><header><div><h2>{view==='checked-in'?'Visitors currently on site':view==='history'?'Completed and closed visits':'Visitor registration and entry log'}</h2><p>Register a visitor, attach an institution host, and record entry and exit times for the institution.</p></div><button className="iop-button primary" onClick={()=>openDialog('visitor')}><Plus size={14}/> Register visitor</button></header><div className="iop-kpis"><article><small>Visits today</small><b>{visitors.filter(row=>row.visit_date===day()).length}</b></article><article><small>Expected</small><b>{visitors.filter(row=>row.status==='expected').length}</b></article><article><small>Checked in</small><b>{visitors.filter(row=>row.status==='checked_in').length}</b></article><article><small>Checked out</small><b>{visitors.filter(row=>row.status==='checked_out').length}</b></article></div><label className="iop-search">Search visitor register<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Visitor, organisation, host or badge…"/></label>{rows.length?<div className="iop-table-wrap"><table><thead><tr><th>Visitor</th><th>Organisation</th><th>Purpose</th><th>Host</th><th>Visit date</th><th>Badge</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><b>{String(row.visitor_name)}</b><small>{String(row.phone??row.email??'')}</small></td><td>{String(row.organization??'—')}</td><td>{String(row.purpose)}</td><td>{String(teachers.find(x=>x.id===row.host_teacher_id)?.full_name??'—')}</td><td>{prettyDate(row.visit_date)}</td><td>{String(row.badge_number??'—')}</td><td><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></td><td><div className="iop-actions">{row.status==='expected'&&<button className="iop-button" disabled={busy} onClick={()=>void updateStatus('visitor_entries',row,{status:'checked_in',checked_in_at:time()},'Visitor checked in.')}>Check in</button>}{row.status==='checked_in'&&<button className="iop-button" disabled={busy} onClick={()=>void updateStatus('visitor_entries',row,{status:'checked_out',checked_out_at:time()},'Visitor checked out.')}>Check out</button>}</div></td></tr>)}</tbody></table></div>:<div className="iop-empty">No visitor entries match this view.</div>}</div>
  }

  function renderFacilities(){
    if(view==='assets')return <div className="iop-panel"><header><div><h2>Facility asset register</h2><p>Track classrooms, specialist equipment and institution assets. Asset inventory changes are owner/admin controlled.</p></div>{admin&&<button className="iop-button primary" onClick={()=>openDialog('asset')}><Plus size={14}/> Add asset</button>}</header><div className="iop-kpis"><article><small>Total assets</small><b>{assets.length}</b></article><article><small>Active</small><b>{assets.filter(row=>row.status==='active').length}</b></article><article><small>In maintenance</small><b>{assets.filter(row=>row.status==='maintenance').length}</b></article><article><small>Retired</small><b>{assets.filter(row=>['retired','disposed'].includes(String(row.status))).length}</b></article></div><label className="iop-search">Search asset register<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Asset code, name, type or room…"/></label>{visibleAssets.length?<div className="iop-table-wrap"><table><thead><tr><th>Asset</th><th>Category</th><th>Room / building</th><th>Condition</th><th>Replacement due</th><th>Status</th></tr></thead><tbody>{visibleAssets.map(row=><tr key={row.id}><td><b>{String(row.asset_code)}</b><small>{String(row.asset_name)}</small></td><td>{toLabel(row.category)}</td><td>{String(rooms.find(x=>x.id===row.room_id)?.room_name??row.building??'—')}</td><td>{toLabel(row.condition)}</td><td>{prettyDate(row.replacement_due)}</td><td><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></td></tr>)}</tbody></table></div>:<div className="iop-empty"><Wrench size={22}/><b>No facility assets recorded</b><span>Owner/admin can register the first asset.</span></div>}</div>
    return <div className="iop-panel"><header><div><h2>Facility maintenance queue</h2><p>Teachers can submit a request. Owner/admin assigns work, tracks progress and records completion.</p></div><button className="iop-button primary" onClick={()=>openDialog('maintenance')}><Plus size={14}/> New maintenance request</button></header><div className="iop-kpis"><article><small>Open requests</small><b>{maintenance.filter(row=>!['completed','cancelled'].includes(String(row.status))).length}</b></article><article><small>Urgent / high</small><b>{maintenance.filter(row=>['urgent','high'].includes(String(row.priority))&&row.status!=='completed').length}</b></article><article><small>In progress</small><b>{maintenance.filter(row=>row.status==='in_progress').length}</b></article><article><small>Completed</small><b>{maintenance.filter(row=>row.status==='completed').length}</b></article></div><label className="iop-search">Search maintenance requests<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Request, asset, priority or status…"/></label>{visibleMaintenance.length?<div className="iop-table-wrap"><table><thead><tr><th>Request</th><th>Asset / room</th><th>Priority</th><th>Requested</th><th>Assigned to</th><th>Status</th><th>Action</th></tr></thead><tbody>{visibleMaintenance.map(row=><tr key={row.id}><td><b>{String(row.title)}</b><small>{String(row.description)}</small></td><td>{String(assets.find(x=>x.id===row.asset_id)?.asset_name??rooms.find(x=>x.id===row.room_id)?.room_name??'—')}</td><td><span className={'iop-priority '+String(row.priority)}>{toLabel(row.priority)}</span></td><td>{prettyDate(row.requested_at)}</td><td>{String(teachers.find(x=>x.id===row.assigned_to)?.full_name??'Unassigned')}</td><td><span className={'iop-status '+String(row.status)}>{toLabel(row.status)}</span></td><td>{admin&&row.status!=='completed'&&row.status!=='cancelled'&&<div className="iop-actions">{row.status==='submitted'&&<button className="iop-button" onClick={()=>void updateStatus('facility_maintenance_requests',row,{status:'assigned'},'Maintenance request assigned.')}>Assign</button>}{row.status==='assigned'&&<button className="iop-button" onClick={()=>void updateStatus('facility_maintenance_requests',row,{status:'in_progress'},'Maintenance work started.')}>Start</button>}{row.status==='in_progress'&&<button className="iop-button primary" onClick={()=>void updateStatus('facility_maintenance_requests',row,{status:'completed',resolved_at:time()},'Maintenance request completed.')}>Complete</button>}</div>}</td></tr>)}</tbody></table></div>:<div className="iop-empty">No maintenance requests are recorded.</div>}</div>
  }

  function renderDialog(){
    if(!dialog)return null
    let title='Create record'
    const fields:React.ReactNode[]=[]
    const subjectOptions=subjects.map(row=>({label:String(row.name),value:String(row.id)}))
    const classOptions=classes.map(row=>({label:String(row.name),value:String(row.id)}))
    const sessionOptions=sessions.map(row=>({label:String(row.name??row.session_name),value:String(row.id)}))
    const studentOptions=students.map(row=>({label:String(row.full_name)+' · '+String(row.admission_no),value:String(row.id)}))
    const teacherOptions=teachers.map(row=>({label:String(row.full_name),value:String(row.id)}))
    const roomOptions=rooms.map(row=>({label:String(row.room_name??row.room_code??row.id),value:String(row.id)}))
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
  const recordCount=selectedDomain==='question-bank'?questions.length+papers.length:selectedDomain==='curriculum'?curriculum.length:selectedDomain==='behaviour'?behaviour.length:selectedDomain==='certificates'?certificates.length:selectedDomain==='visitors'?visitors.length:assets.length+maintenance.length

  return <main className="iop-stage page-content ed360-module-page">
    <header className="iop-heading"><div><span>INSTITUTION OPERATIONS / {selectedDomain.toUpperCase()}</span><h1>{domainTitles[selectedDomain]}</h1><p>{domainDescriptions[selectedDomain]}</p></div><span className="iop-live"><i/> Institution cloud records</span></header>
    <nav className="iop-nav" aria-label={domainTitles[selectedDomain]+' workspace windows'}>{tabItems.map(key=><button type="button" key={key} className={view===key?'active':''} aria-current={view===key?'page':undefined} onClick={()=>setView(key)}>{viewLabels[key]}</button>)}</nav>
    <section className="iop-context"><div><small>ACTIVE DOMAIN WINDOW</small><h2>{viewLabels[view]}</h2><p>{domainDescriptions[selectedDomain]}</p></div><div><strong>{recordCount}</strong><small>Visible records</small></div></section>
    {error&&<div className="iop-error" role="alert">{error}</div>}
    {loading?<div className="iop-empty"><RefreshCw size={18}/> Loading institution records…</div>:renderContent()}
    <footer className="iop-footer"><span><ShieldCheck size={14}/> Institution access and linked family visibility are enforced by Supabase row-level security.</span><button className="iop-button" onClick={()=>void load()}><RefreshCw size={14}/> Refresh</button></footer>
    {renderDialog()}
  </main>
}
