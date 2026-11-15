import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Activity, Award, CheckCircle2, Download, FilePlus2, Filter, RefreshCw, Search, ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { downloadCsv } from '../lib/csv'
import { exportDocx, exportXlsx, printOfficeReport, type OfficeColumn } from '../lib/officeExport'
import '../styles/behaviour-skills-workspace.css'

type ViewKey='dashboard'|'records'|'positive'|'incidents'|'recognition'|'warnings'|'skills'|'activities'|'competencies'|'progress'|'analytics'|'downloads'
type Student=Record<string,any>&{id:string;full_name:string;admission_no:string;class_name:string}
type EventRow=Record<string,any>&{id:string;student_id:string;event_type:string;category:string;severity:string;event_date:string;summary:string;status:string}
type CompetencyRow=Record<string,any>&{id:string;student_id:string;competency_name:string;competency_area:string;proficiency_level:number;assessed_on:string}
type ActivityRow=Record<string,any>&{id:string;title:string;activity_date:string;activity_type:string;class_id:string}
const pageMeta:Record<ViewKey,{title:string;subtitle:string;kind:'dashboard'|'events'|'competencies'|'activities'|'progress'|'analytics'|'downloads'}>={
 dashboard:{title:'Behaviour & Skills Dashboard',subtitle:'A live view of student wellbeing, positive conduct, follow-up and competency development.',kind:'dashboard'},
 records:{title:'Behaviour Records',subtitle:'A dated, student-linked register of positive and corrective behaviour records.',kind:'events'},
 positive:{title:'Positive Behaviour',subtitle:'Recognise positive actions, classroom conduct, leadership and responsible participation.',kind:'events'},
 incidents:{title:'Disciplinary Incidents',subtitle:'Record incidents with proportionate severity, follow-up, actions and review history.',kind:'events'},
 recognition:{title:'Rewards & Recognition',subtitle:'Record awards, achievements and recognition with evidence and family visibility controls.',kind:'events'},
 warnings:{title:'Warnings',subtitle:'Record formal warnings, action taken and follow-up requirements.',kind:'events'},
 skills:{title:'Student Skills',subtitle:'Review personal, social, academic and practical skills using evidence-based observations.',kind:'competencies'},
 activities:{title:'Co-curricular Activities',subtitle:'Record class activities, clubs, sports and participation for each academic group.',kind:'activities'},
 competencies:{title:'Competency Tracking',subtitle:'Assess defined competencies against a consistent proficiency scale and evidence.',kind:'competencies'},
 progress:{title:'Student Progress History',subtitle:'Review each student’s behaviour and competency timeline across the academic year.',kind:'progress'},
 analytics:{title:'Behaviour Analytics',subtitle:'Review trends by event type, severity and competency area without replacing staff judgement.',kind:'analytics'},
 downloads:{title:'Downloadable Behaviour Reports',subtitle:'Export filtered behaviour, recognition and competency records for authorised review.',kind:'downloads'},
}
const eventTypes:Record<string,string>={positive:'positive',incidents:'incident',recognition:'positive',warnings:'concern'}
const today=()=>new Date().toLocaleDateString('en-CA')
const studentLabel=(s?:Student)=>s?[s.full_name,s.admission_no].filter(Boolean).join(' · '):'Student not found'
const dateLabel=(s?:string)=>s?new Date(String(s).slice(0,10)+'T00:00:00').toLocaleDateString():'—'
export function BehaviourSkillsWorkspace({initialWindow='dashboard',onToast}:{initialWindow?:string;onToast:(message:string,error?:boolean)=>void}){
 const {user}=useAuth()
 const view=(initialWindow in pageMeta?initialWindow:'dashboard') as ViewKey
 const meta=pageMeta[view]
 const [students,setStudents]=useState<Student[]>([])
 const [events,setEvents]=useState<EventRow[]>([])
 const [competencies,setCompetencies]=useState<CompetencyRow[]>([])
 const [activities,setActivities]=useState<ActivityRow[]>([])
 const [classes,setClasses]=useState<Record<string,any>[]>([])
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [search,setSearch]=useState('')
 const [studentFilter,setStudentFilter]=useState('')
 const [typeFilter,setTypeFilter]=useState('all')
 const [showForm,setShowForm]=useState(false)
 const [formKind,setFormKind]=useState<'event'|'competency'|'activity'>('event')
 const [form,setForm]=useState({student_id:'',event_type:'positive',category:'classroom_conduct',severity:'low',event_date:today(),summary:'',description:'',action_taken:'',follow_up_required:false,follow_up_date:'',family_visible:false,competency_name:'',competency_area:'general',proficiency_level:'3',assessment_method:'teacher_review',evidence:'',notes:'',assessed_on:today(),class_id:'',activity_type:'classwork',activity_date:today(),title:'',visibility:'staff_only'})
 const [exportRequest,setExportRequest]=useState<{name:string;title:string;rows:Record<string,unknown>[];columns:OfficeColumn[]}|null>(null)
 const [canRead,setCanRead]=useState(true)
 const [canWrite,setCanWrite]=useState(false)
 const [grantLoading,setGrantLoading]=useState(false)
 const isAdmin=Boolean(user&&['owner','admin'].includes(user.role))
 const isTeacher=user?.role==='teacher'

 const load=useCallback(async()=>{
  if(!supabase||!user){setLoading(false);return}
  setLoading(true);setError('')
  try{
   if(isTeacher){
    setGrantLoading(true)
    const {data:grant,error:grantError}=await supabase.from('student_care_access').select('can_read,can_write').eq('institution_id',user.institutionId).eq('user_id',user.id).eq('area','discipline').maybeSingle()
    if(grantError)throw grantError
    setCanRead(Boolean(grant?.can_read));setCanWrite(Boolean(grant?.can_write));setGrantLoading(false)
   }else{setCanRead(isAdmin);setCanWrite(isAdmin);setGrantLoading(false)}
   const [studentResult,eventResult,competencyResult,activityResult,classResult]=await Promise.all([
    supabase.from('students').select('id,full_name,admission_no,class_name,section_name,guardian_name,status').eq('institution_id',user.institutionId).eq('status','active').order('full_name').limit(2000),
    supabase.from('student_behaviour_events').select('*').eq('institution_id',user.institutionId).order('event_date',{ascending:false}).limit(2500),
    supabase.from('student_competency_records').select('*').eq('institution_id',user.institutionId).order('assessed_on',{ascending:false}).limit(2500),
    supabase.from('classroom_activities').select('*').eq('institution_id',user.institutionId).order('activity_date',{ascending:false}).limit(1000),
    supabase.from('classes').select('*').eq('institution_id',user.institutionId).order('name').limit(1000),
   ])
   if(studentResult.error)throw studentResult.error
   if(eventResult.error&&canRead)throw eventResult.error
   if(competencyResult.error&&canRead)throw competencyResult.error
   if(activityResult.error&&['owner','admin','teacher'].includes(user.role))throw activityResult.error
   setStudents((studentResult.data??[]) as Student[])
   setEvents((eventResult.data??[]) as EventRow[])
   setCompetencies((competencyResult.data??[]) as CompetencyRow[])
   setActivities((activityResult.data??[]) as ActivityRow[])
   setClasses(classResult.data??[])
  }catch(e){setError(e instanceof Error?e.message:'The behaviour and skills records could not be loaded.');setEvents([]);setCompetencies([]);setActivities([])}
  finally{setLoading(false);setGrantLoading(false)}
 },[user?.id,user?.institutionId,user?.role,isAdmin,isTeacher,canRead])

 useEffect(()=>{void load()},[load])
 const studentsById=useMemo(()=>new Map(students.map(s=>[s.id,s])),[students])
 const filteredEvents=useMemo(()=>{
  let rows=events
  if(eventTypes[view])rows=rows.filter(row=>row.event_type===eventTypes[view])
  if(typeFilter!=='all')rows=rows.filter(row=>row.event_type===typeFilter)
  if(studentFilter)rows=rows.filter(row=>row.student_id===studentFilter)
  if(search.trim())rows=rows.filter(row=>[row.summary,row.category,row.description,row.action_taken,studentsById.get(row.student_id)?.full_name].some(v=>String(v??'').toLowerCase().includes(search.toLowerCase())))
  return rows
 },[events,view,typeFilter,studentFilter,search,studentsById])
 const filteredCompetencies=useMemo(()=>competencies.filter(row=>(!studentFilter||row.student_id===studentFilter)&&(!search||[row.competency_name,row.competency_area,row.evidence,studentsById.get(row.student_id)?.full_name].some(v=>String(v??'').toLowerCase().includes(search.toLowerCase())))),[competencies,studentFilter,search,studentsById])
 const filteredActivities=useMemo(()=>activities.filter(row=>!search||[row.title,row.activity_type,row.description].some(v=>String(v??'').toLowerCase().includes(search.toLowerCase()))),[activities,search])
 const unresolved=events.filter(row=>row.status==='open').length
 const severityCounts=useMemo(()=>['low','medium','high','critical'].map(level=>({level,count:events.filter(row=>row.severity===level&&row.event_type==='incident').length})),[events])
 const eventCount=filteredEvents.length

 function openForm(kind:'event'|'competency'|'activity'){
  const allowed=kind==='activity'?Boolean(user&&['owner','admin','teacher'].includes(user.role)):canWrite;if(!allowed){onToast('Your account does not have permission to create this record. Ask the administrator to grant the required module access.',true);return}
  setFormKind(kind)
  setForm(old=>({...old,student_id:students[0]?.id??'',event_type:eventTypes[view]??'positive',category:view==='recognition'?'recognition':view==='warnings'?'warning':view==='incidents'?'incident':'classroom_conduct',event_date:today(),assessed_on:today(),activity_date:today(),title:''}))
  setShowForm(true)
 }
 function field(key:string,value:unknown){setForm(old=>({...old,[key]:value}))}
 async function save(event:FormEvent){
  event.preventDefault();if(!supabase||!user)return
  setSaving(true)
  try{
   if(formKind==='event'){
    if(!form.student_id||!form.summary.trim()||!form.category.trim()){onToast('Select a student and enter a category and summary.',true);return}
     if(form.follow_up_required&&!form.follow_up_date){onToast('Choose a follow-up date or clear Follow-up required.',true);return}
    const {error:saveError}=await supabase.from('student_behaviour_events').insert({
     institution_id:user.institutionId,student_id:form.student_id,event_type:form.event_type,category:form.category,severity:form.severity,
     event_date:form.event_date,summary:form.summary.trim(),description:form.description.trim()||null,action_taken:form.action_taken.trim()||null,
     follow_up_required:form.follow_up_required,follow_up_date:form.follow_up_date||null,family_visible:form.family_visible,status:'open',created_by:user.id,
    })
    if(saveError)throw saveError
   }else if(formKind==='competency'){
    if(!form.student_id||!form.competency_name.trim()){onToast('Select a student and enter a competency name.',true);return}
    const level=Number(form.proficiency_level);if(!Number.isInteger(level)||level<1||level>5){onToast('Proficiency level must be from 1 to 5.',true);return}
    const {error:saveError}=await supabase.from('student_competency_records').insert({
     institution_id:user.institutionId,student_id:form.student_id,competency_name:form.competency_name.trim(),competency_area:form.competency_area,
     proficiency_level:level,assessment_method:form.assessment_method,evidence:form.evidence.trim()||null,notes:form.notes.trim()||null,assessed_on:form.assessed_on,created_by:user.id,
    })
    if(saveError)throw saveError
   }else{
    if(!form.class_id||!form.title.trim()){onToast('Select a class and enter an activity title.',true);return}
    const {error:saveError}=await supabase.from('classroom_activities').insert({
     institution_id:user.institutionId,class_id:form.class_id,activity_date:form.activity_date,activity_type:form.activity_type,
     title:form.title.trim(),description:form.description.trim()||null,visibility:form.visibility,created_by:user.id,
    })
    if(saveError)throw saveError
   }
   setShowForm(false);onToast('The record has been saved.');await load()
  }catch(e){onToast(e instanceof Error?e.message:'The record could not be saved. Check the role grant and class assignment.',true)}
  finally{setSaving(false)}
 }
 async function resolve(row:EventRow){
  if(!supabase||!user)return
  const {error:updateError}=await supabase.from('student_behaviour_events').update({status:'resolved',reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq('id',row.id).eq('institution_id',user.institutionId)
  if(updateError){onToast(updateError.message,true);return}
  onToast('Follow-up marked resolved.');await load()
 }
 function requestExport(name:string,title:string,rows:Record<string,unknown>[],columns:OfficeColumn[]){if(!rows.length){onToast('There are no records in this report to export.',true);return}setExportRequest({name,title,rows,columns})}
 function completeExport(format:'csv'|'xlsx'|'docx'|'print'){if(!exportRequest)return;const {name,title,rows,columns}=exportRequest,filename='edusphere-'+name+'-'+today();try{if(format==='csv')downloadCsv(filename+'.csv',rows,columns);else if(format==='xlsx')exportXlsx(filename+'.xlsx',title,rows,columns);else if(format==='docx')exportDocx(filename+'.docx',title,rows,columns);else printOfficeReport(title,rows,columns,user?.institutionName??'Institution name not set');setExportRequest(null)}catch(error){onToast(error instanceof Error?error.message:'The report could not be exported.',true)}}
 function exportEvents(){const rows=filteredEvents.map(row=>({date:row.event_date,student:studentsById.get(row.student_id)?.full_name??row.student_id,admission_no:studentsById.get(row.student_id)?.admission_no??'',type:row.event_type,category:row.category,severity:row.severity,summary:row.summary,status:row.status,action:row.action_taken,follow_up:row.follow_up_required?'Yes':'No'}));const columns:OfficeColumn[]=[{key:'date',label:'Date'},{key:'student',label:'Student'},{key:'admission_no',label:'Admission ID'},{key:'type',label:'Type'},{key:'category',label:'Category'},{key:'severity',label:'Severity'},{key:'summary',label:'Summary'},{key:'status',label:'Status'},{key:'action',label:'Action taken'},{key:'follow_up',label:'Follow-up required'}];requestExport('behaviour-records','Behaviour and Incident Report',rows,columns)}
 function exportCompetencies(){const rows=filteredCompetencies.map(row=>({date:row.assessed_on,student:studentsById.get(row.student_id)?.full_name??row.student_id,competency:row.competency_name,area:row.competency_area,level:row.proficiency_level,method:row.assessment_method,evidence:row.evidence,notes:row.notes}));const columns:OfficeColumn[]=[{key:'date',label:'Assessment date'},{key:'student',label:'Student'},{key:'competency',label:'Competency'},{key:'area',label:'Area'},{key:'level',label:'Proficiency level'},{key:'method',label:'Assessment method'},{key:'evidence',label:'Evidence'},{key:'notes',label:'Notes'}];requestExport('student-competencies','Student Competency Report',rows,columns)}
 function exportHistory(){const rows=[...filteredEvents.map(row=>({date:row.event_date,student:studentsById.get(row.student_id)?.full_name??row.student_id,record_type:'Behaviour',detail:row.summary,classification:row.event_type+' · '+row.category,status:row.status})),...filteredCompetencies.map(row=>({date:row.assessed_on,student:studentsById.get(row.student_id)?.full_name??row.student_id,record_type:'Competency',detail:row.competency_name,classification:row.competency_area+' · level '+row.proficiency_level,status:'Recorded'}))].sort((a,b)=>b.date.localeCompare(a.date));const columns:OfficeColumn[]=[{key:'date',label:'Date'},{key:'student',label:'Student'},{key:'record_type',label:'Record type'},{key:'detail',label:'Detail'},{key:'classification',label:'Classification'},{key:'status',label:'Status'}];requestExport('student-progress-history','Student Progress History',rows,columns)}

 if(isTeacher&&!canRead&&!grantLoading&&view!=='activities')return <main className="page-content ed360-behaviour-workspace"><header className="ed360-behaviour-header"><span>BEHAVIOUR & SKILLS</span><h1>{meta.title}</h1><p>Access to student behaviour and competency records has not been granted to this teacher account.</p></header><div className="ed360-behaviour-empty"><ShieldAlert size={24}/><b>Permission required</b><p>An owner or administrator must grant read/write access in Student Care Access before this workspace can display confidential records.</p></div></main>

 return <main className="page-content ed360-behaviour-workspace" data-behaviour-view={view}>
  <header className="ed360-behaviour-header"><div><span>STUDENT DEVELOPMENT / BEHAVIOUR & SKILLS</span><h1>{meta.title}</h1><p>{meta.subtitle}</p></div><div className="ed360-behaviour-header-actions"><button type="button" className="button button-outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button>{['events','competencies','activities'].includes(meta.kind)&&<button type="button" className="button button-primary" onClick={()=>openForm(meta.kind==='activities'?'activity':meta.kind==='competencies'?'competency':'event')}><FilePlus2 size={15}/> Add record</button>}</div></header>
  {error&&<div className="ed360-behaviour-error">{error}</div>}
  {loading?<div className="ed360-behaviour-empty">Loading authorised student development records…</div>:<>
   <div className="ed360-behaviour-toolbar"><label><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search this page"/></label><label><Filter size={15}/><select value={studentFilter} onChange={e=>setStudentFilter(e.target.value)}><option value="">All students</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name} · {s.admission_no}</option>)}</select></label>{meta.kind==='events'&&view==='records'&&<label><Filter size={15}/><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">All record types</option>{['positive','incident','recognition','warning'].map(v=><option key={v} value={v}>{v}</option>)}</select></label>}</div>
   {meta.kind==='dashboard'&&<><div className="ed360-behaviour-kpis"><article><span>Student behaviour records</span><strong>{events.length}</strong><small>Across the available institution period</small></article><article><span>Open follow-ups</span><strong>{unresolved}</strong><small>Require review or action</small></article><article><span>Competency assessments</span><strong>{competencies.length}</strong><small>Evidence-based assessments</small></article><article><span>Classroom activities</span><strong>{activities.length}</strong><small>Recorded co-curricular / classwork</small></article></div><section className="ed360-behaviour-panel"><div className="ed360-behaviour-section-title"><div><span>RECENT ACTIVITY</span><h2>Latest behaviour records</h2></div><button type="button" className="button button-outline" onClick={exportEvents}><Download size={14}/> Export</button></div><EventTable rows={events.slice(0,8)} studentsById={studentsById} onResolve={resolve} canWrite={canWrite}/></section></>}
   {meta.kind==='events'&&<section className="ed360-behaviour-panel"><div className="ed360-behaviour-section-title"><div><span>REGISTER</span><h2>{meta.title}</h2></div><div className="ed360-behaviour-count">{eventCount} matching records</div></div><EventTable rows={filteredEvents} studentsById={studentsById} onResolve={resolve} canWrite={canWrite}/></section>}
   {meta.kind==='competencies' && (
    <section className="ed360-behaviour-panel">
     <div className="ed360-behaviour-section-title">
      <div><span>STUDENT DEVELOPMENT</span><h2>{meta.title}</h2></div>
      <button type="button" className="button button-outline" onClick={exportCompetencies}><Download size={14}/> Export</button>
     </div>
     <div className="ed360-behaviour-table-wrap">
      <table>
       <thead><tr><th>Student</th><th>Competency</th><th>Area</th><th>Level</th><th>Method</th><th>Assessed</th></tr></thead>
       <tbody>
        {filteredCompetencies.map(row => (
         <tr key={row.id}>
          <td>{studentsById.get(row.student_id)?.full_name ?? 'Restricted student'}</td>
          <td>{row.competency_name}</td>
          <td>{row.competency_area}</td>
          <td><span className="ed360-level">{row.proficiency_level}/5</span></td>
          <td>{String(row.assessment_method).replaceAll('_', ' ')}</td>
          <td>{dateLabel(row.assessed_on)}</td>
         </tr>
        ))}
        {!filteredCompetencies.length && <EmptyRow text="No competency assessments match these filters." colSpan={6} />}
       </tbody>
      </table>
     </div>
    </section>
   )}
   {meta.kind==='activities' && (
    <section className="ed360-behaviour-panel">
     <div className="ed360-behaviour-section-title">
      <div><span>CLASSROOM & CO-CURRICULAR</span><h2>Activity register</h2></div>
     </div>
     <div className="ed360-behaviour-table-wrap">
      <table>
       <thead><tr><th>Activity</th><th>Type</th><th>Class</th><th>Date</th><th>Visibility</th></tr></thead>
       <tbody>
        {filteredActivities.map(row => (
         <tr key={row.id}>
          <td><b>{row.title}</b><small>{row.description ?? ''}</small></td>
          <td>{row.activity_type}</td>
          <td>{classes.find(item => item.id === row.class_id)?.name ?? 'Class'}</td>
          <td>{dateLabel(row.activity_date)}</td>
          <td>{row.visibility?.replaceAll('_', ' ')}</td>
         </tr>
        ))}
        {!filteredActivities.length && <EmptyRow text="No activities match these filters." colSpan={5} />}
       </tbody>
      </table>
     </div>
    </section>
   )}
   {meta.kind==='progress'&&<section className="ed360-behaviour-panel"><div className="ed360-behaviour-section-title"><div><span>STUDENT TIMELINE</span><h2>Progress history</h2></div><button type="button" className="button button-outline" onClick={exportHistory}><Download size={14}/> Export history</button></div><div className="ed360-behaviour-timeline">{[...events.filter(r=>!studentFilter||r.student_id===studentFilter).map(r=>({id:r.id,date:r.event_date,title:r.summary,detail:r.event_type+' · '+r.category,student:r.student_id})),...competencies.filter(r=>!studentFilter||r.student_id===studentFilter).map(r=>({id:r.id,date:r.assessed_on,title:r.competency_name,detail:'Competency · '+r.competency_area+' · '+r.proficiency_level+'/5',student:r.student_id}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,100).map(row=><article key={row.id}><i/><div><span>{dateLabel(row.date)} · {studentsById.get(row.student)?.full_name??'Student'}</span><b>{row.title}</b><small>{row.detail}</small></div></article>)}{!events.length&&!competencies.length&&<div className="ed360-behaviour-empty">No progress history has been recorded.</div>}</div></section>}
   {meta.kind==='analytics'&&<div className="ed360-behaviour-analytics"><section className="ed360-behaviour-panel"><div className="ed360-behaviour-section-title"><div><span>INCIDENT SEVERITY</span><h2>Recorded incident levels</h2></div></div>{severityCounts.map(s=><div className="ed360-behaviour-bar" key={s.level}><span>{s.level}</span><div><i style={{width:(Math.max(2,s.count/Math.max(1,events.filter(e=>e.event_type==='incident').length)*100))+'%'}}/></div><b>{s.count}</b></div>)}</section><section className="ed360-behaviour-panel"><div className="ed360-behaviour-section-title"><div><span>RECORD MIX</span><h2>Events by type</h2></div></div>{['positive','incident','recognition','warning'].map(type=>{const count=events.filter(e=>e.event_type===type).length;return <div className="ed360-behaviour-bar" key={type}><span>{type}</span><div><i style={{width:(Math.max(2,count/Math.max(1,events.length)*100))+'%'}}/></div><b>{count}</b></div>})}</section></div>}
   {meta.kind==='downloads'&&<section className="ed360-behaviour-panel"><div className="ed360-behaviour-section-title"><div><span>REPORT EXPORTS</span><h2>Download authorised data</h2></div></div><div className="ed360-behaviour-downloads"><article><Activity size={20}/><b>Behaviour and incident register</b><p>Current search, type and student filters are applied to this export.</p><button type="button" className="button button-primary" onClick={exportEvents}><Download size={14}/> Download CSV</button></article><article><Award size={20}/><b>Skills and competency register</b><p>Exports proficiency levels, assessment methods and available evidence notes.</p><button type="button" className="button button-primary" onClick={exportCompetencies}><Download size={14}/> Download CSV</button></article></div></section>}
  </>}
  {showForm&&<div className="ed360-behaviour-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShowForm(false)}}><section role="dialog" aria-modal="true" aria-labelledby="behaviour-form-heading" className="ed360-behaviour-modal"><header><div><span>NEW REGISTER ENTRY</span><h2 id="behaviour-form-heading">{formKind==='event'?'Behaviour record':formKind==='competency'?'Competency assessment':'Classroom activity'}</h2></div><button type="button" onClick={()=>setShowForm(false)}>×</button></header><form onSubmit={save}>
   {formKind!=='activity'&&<label>Student *<select required value={form.student_id} onChange={e=>field('student_id',e.target.value)}><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{studentLabel(s)} · {s.class_name}</option>)}</select></label>}
   {formKind==='event'&&<><div className="ed360-behaviour-form-grid"><label>Type<select value={form.event_type} onChange={e=>field('event_type',e.target.value)}>{['positive','concern','incident','safeguarding'].map(v=><option key={v}>{v}</option>)}</select></label><label>Category<input required value={form.category} onChange={e=>field('category',e.target.value)} placeholder="e.g. punctuality, teamwork"/></label><label>Severity<select value={form.severity} onChange={e=>field('severity',e.target.value)}>{['low','medium','high','critical'].map(v=><option key={v}>{v}</option>)}</select></label><label>Event date<input type="date" required value={form.event_date} onChange={e=>field('event_date',e.target.value)}/></label></div><label>Summary *<input required value={form.summary} onChange={e=>field('summary',e.target.value)} maxLength={200}/></label><label>Description<textarea rows={3} value={form.description} onChange={e=>field('description',e.target.value)}/></label><label>Action taken<textarea rows={2} value={form.action_taken} onChange={e=>field('action_taken',e.target.value)}/></label><div className="ed360-behaviour-form-grid"><label>Follow-up date<input type="date" value={form.follow_up_date} onChange={e=>field('follow_up_date',e.target.value)}/></label><label className="ed360-behaviour-check"><input type="checkbox" checked={form.follow_up_required} onChange={e=>field('follow_up_required',e.target.checked)}/> Follow-up required</label><label className="ed360-behaviour-check"><input type="checkbox" checked={form.family_visible} onChange={e=>field('family_visible',e.target.checked)}/> Visible to linked family account</label></div></>}
   {formKind==='competency'&&<><div className="ed360-behaviour-form-grid"><label>Competency name *<input required value={form.competency_name} onChange={e=>field('competency_name',e.target.value)}/></label><label>Area<select value={form.competency_area} onChange={e=>field('competency_area',e.target.value)}>{['general','academic','communication','teamwork','leadership','problem_solving','digital','practical','creative','sports'].map(v=><option key={v}>{v}</option>)}</select></label><label>Proficiency (1–5)<select value={form.proficiency_level} onChange={e=>field('proficiency_level',e.target.value)}>{[1,2,3,4,5].map(v=><option key={v} value={String(v)}>{v} / 5</option>)}</select></label><label>Assessment method<select value={form.assessment_method} onChange={e=>field('assessment_method',e.target.value)}>{['teacher_review','rubric','portfolio','practical','self_assessment'].map(v=><option key={v}>{v}</option>)}</select></label><label>Assessment date<input type="date" value={form.assessed_on} onChange={e=>field('assessed_on',e.target.value)}/></label></div><label>Evidence<textarea rows={3} value={form.evidence} onChange={e=>field('evidence',e.target.value)}/></label><label>Notes<textarea rows={2} value={form.notes} onChange={e=>field('notes',e.target.value)}/></label></>}
   {formKind==='activity'&&<><div className="ed360-behaviour-form-grid"><label>Activity title *<input required value={form.title} onChange={e=>field('title',e.target.value)}/></label><label>Class *<select required value={form.class_id} onChange={e=>field('class_id',e.target.value)}><option value="">Select class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name??c.class_name??c.id}</option>)}</select></label><label>Activity type<select value={form.activity_type} onChange={e=>field('activity_type',e.target.value)}>{['classwork','discussion','project','presentation','practical','group_work','participation','other'].map(v=><option key={v}>{v}</option>)}</select></label><label>Date<input type="date" value={form.activity_date} onChange={e=>field('activity_date',e.target.value)}/></label></div><label>Description<textarea rows={3} value={form.description} onChange={e=>field('description',e.target.value)}/></label><label>Visibility<select value={form.visibility} onChange={e=>field('visibility',e.target.value)}><option value="staff_only">Staff only</option><option value="published">Published to class</option></select></label></>}
   <footer><button type="button" className="button button-outline" onClick={()=>setShowForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving?'Saving…':'Save record'}</button></footer>
  </form></section></div>}
   {exportRequest&&<div className="ed360-behaviour-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setExportRequest(null)}}><section className="ed360-behaviour-modal" role="dialog" aria-modal="true" aria-labelledby="behaviour-export-heading"><header><div><span>DOCUMENT EXPORT</span><h2 id="behaviour-export-heading">{exportRequest.title}</h2><small>{exportRequest.rows.length} filtered records</small></div><button type="button" onClick={()=>setExportRequest(null)}>×</button></header><div className="ed360-behaviour-form-grid"><button type="button" className="button button-outline" onClick={()=>completeExport('csv')}>CSV</button><button type="button" className="button button-outline" onClick={()=>completeExport('xlsx')}>Excel (XLSX)</button><button type="button" className="button button-outline" onClick={()=>completeExport('docx')}>Word (DOCX)</button><button type="button" className="button button-primary" onClick={()=>completeExport('print')}>Print / Save as PDF</button></div><p>Print output uses a clean white A4 report. Choose Save as PDF in the print dialog to download a PDF copy.</p></section></div>}
 </main>
}
function EventTable({rows,studentsById,onResolve,canWrite}:{rows:EventRow[];studentsById:Map<string,Student>;onResolve:(row:EventRow)=>void;canWrite:boolean}){
 return <div className="ed360-behaviour-table-wrap"><table><thead><tr><th>Date</th><th>Student</th><th>Type / category</th><th>Severity</th><th>Summary</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{dateLabel(row.event_date)}</td><td>{studentsById.get(row.student_id)?.full_name??'Restricted student'}<small>{studentsById.get(row.student_id)?.admission_no??''}</small></td><td>{row.event_type}<small>{row.category}</small></td><td><span className={'ed360-severity severity-'+row.severity}>{row.severity}</span></td><td>{row.summary}<small>{row.description??''}</small></td><td>{row.status}</td><td>{canWrite&&row.status==='open'?<button type="button" className="ed360-resolve" onClick={()=>onResolve(row)}><CheckCircle2 size={13}/> Resolve</button>:'—'}</td></tr>)}{!rows.length&&<EmptyRow text="No records match these filters." />}</tbody></table></div>
}
function EmptyRow({text,colSpan=7}:{text:string;colSpan?:number}){return <tr><td colSpan={colSpan} className="ed360-behaviour-no-rows">{text}</td></tr>}
