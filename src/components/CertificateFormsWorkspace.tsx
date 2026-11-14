import { useEffect, useState, type FormEvent } from 'react'
import { FilePlus2, FileText, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/data-management.css'

type FormField={key:string;label:string;type:'text'|'email'|'number'|'date'|'textarea'|'select'|'checkbox';required?:boolean;options?:string[]}
type Definition={id:string;form_code:string;title:string;form_type:string;description:string|null;field_schema:FormField[];audience_roles:string[];status:string;created_at:string}
type Submission={id:string;form_id:string;submission_number:string;submitted_by:string;submitted_at:string;answers:Record<string,unknown>;status:string;review_note:string|null;reviewed_at:string|null}
const roles=['owner','admin','teacher','student','parent','accountant','exam_officer']
const schemaExample:FormField[]=[
 {key:'full_name',label:'Full name',type:'text',required:true},
 {key:'contact_email',label:'Contact email',type:'email',required:true},
 {key:'details',label:'Details / reason',type:'textarea',required:true}
]
const pretty=(v:unknown)=>String(v??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const stamp=(v:unknown)=>v?new Date(String(v)).toLocaleString():'—'
const safeCode=(v:string)=>v.toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/(^-|-$)/g,'')
const makeNumber=()=>'FR-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,7).toUpperCase()
export function CertificateFormsWorkspace({workspaceKey,onToast}:{workspaceKey:string;onToast:(message:string,error?:boolean)=>void}){
 const {user}=useAuth()
 const page=workspaceKey.split(':').slice(-1)[0]
 const admin=Boolean(user&&['owner','admin'].includes(user.role))
 const [definitions,setDefinitions]=useState<Definition[]>([])
 const [submissions,setSubmissions]=useState<Submission[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [search,setSearch]=useState('')
 const [selectedForm,setSelectedForm]=useState('')
 const [answers,setAnswers]=useState<Record<string,unknown>>({})
 const [reviewNote,setReviewNote]=useState<Record<string,string>>({})
 const [draft,setDraft]=useState({form_code:'',title:'',form_type:'general',description:'',audience_roles:'teacher,student,parent',field_schema:JSON.stringify(schemaExample,null,2)})
 async function load(){
  if(!supabase||!user){setLoading(false);return}
  setLoading(true)
  try{
   const [f,s]=await Promise.all([
    supabase.from('institution_form_definitions').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false}).limit(1000),
    supabase.from('institution_form_submissions').select('*').eq('institution_id',user.institutionId).order('submitted_at',{ascending:false}).limit(2000)
   ])
   if(f.error)throw f.error
   if(s.error)throw s.error
   setDefinitions((f.data??[]) as Definition[])
   setSubmissions((s.data??[]) as Submission[])
  }catch(e){onToast(e instanceof Error?e.message:'Form records could not be loaded.',true)}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[user?.id,user?.institutionId,user?.role])
 const published=definitions.filter(d=>d.status==='published'&&d.audience_roles.includes(user?.role??''))
 const selectedDefinition=definitions.find(d=>d.id===selectedForm)
 const visibleDefinitions=definitions.filter(d=>!search||[d.title,d.form_code,d.form_type,d.status].join(' ').toLowerCase().includes(search.toLowerCase()))
 const visibleSubmissions=submissions.filter(s=>{
  const d=definitions.find(x=>x.id===s.form_id)
  return (page!=='letters-applications'||d?.form_type==='letter_request')&&(!search||[s.submission_number,d?.title,s.status,s.submitted_by].join(' ').toLowerCase().includes(search.toLowerCase()))
 })
 async function saveDefinition(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user||!admin)return
  const code=safeCode(draft.form_code||draft.title)
  if(code.length<2){onToast('Enter a valid form code or name.',true);return}
  let fieldSchema:FormField[]
  let audiences:string[]
  try{
   const parsed=JSON.parse(draft.field_schema)
   if(!Array.isArray(parsed)||!parsed.length)throw new Error('The form must contain at least one field.')
   const keys=new Set<string>()
   fieldSchema=parsed.map((f:any)=>{
    if(!f||typeof f.key!=='string'||typeof f.label!=='string'||!f.key.trim()||!f.label.trim())throw new Error('Each field needs a key and label.')
    const key=safeCode(f.key).toLowerCase().replaceAll('-','_')
    if(keys.has(key))throw new Error('Field keys must be unique.')
    keys.add(key)
    const allowed=['text','email','number','date','textarea','select','checkbox']
    if(!allowed.includes(f.type))throw new Error('Unsupported field type for '+f.label)
    if(f.type==='select'&&(!Array.isArray(f.options)||!f.options.length))throw new Error('Select fields need at least one option.')
    return {key,label:f.label,type:f.type,required:Boolean(f.required),...(f.type==='select'?{options:f.options.map((x:any)=>String(x))}:{})}
   })
   audiences=[...new Set(draft.audience_roles.split(',').map(x=>x.trim()).filter(Boolean))]
   if(!audiences.length||audiences.some(x=>!roles.includes(x)))throw new Error('Audience roles must use: '+roles.join(', '))
  }catch(e){onToast(e instanceof Error?e.message:'Form schema is invalid.',true);return}
  setBusy(true)
  try{
   const {error}=await supabase.from('institution_form_definitions').insert({
    institution_id:user.institutionId,form_code:code,title:draft.title.trim(),form_type:draft.form_type,
    description:draft.description.trim()||null,field_schema:fieldSchema,audience_roles:audiences,
    status:'draft',allow_multiple_submissions:true,created_by:user.id
   })
   if(error)throw error
   setDraft({form_code:'',title:'',form_type:'general',description:'',audience_roles:'teacher,student,parent',field_schema:JSON.stringify(schemaExample,null,2)})
   await load()
   onToast('Form definition saved as draft. Publish it when the fields and audience are ready.')
  }catch(e){onToast(e instanceof Error?e.message:'Form definition could not be saved.',true)}
  finally{setBusy(false)}
 }
 async function changeDefinitionStatus(row:Definition,next:'published'|'archived'|'draft'){
  if(!supabase||!user||!admin)return
  setBusy(true)
  try{
   const {error}=await supabase.from('institution_form_definitions').update({status:next,updated_at:new Date().toISOString()}).eq('institution_id',user.institutionId).eq('id',row.id)
   if(error)throw error
   await load()
   onToast('Form '+(next==='published'?'published':next==='archived'?'archived':'returned to draft')+'.')
  }catch(e){onToast(e instanceof Error?e.message:'Form status could not be changed.',true)}
  finally{setBusy(false)}
 }
 async function submitForm(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user||!selectedDefinition)return
  for(const field of selectedDefinition.field_schema){
   const value=answers[field.key]
   if(field.required&&(value===undefined||value===null||String(value).trim()==='')){onToast(field.label+' is required.',true);return}
   if(field.type==='email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))){onToast('Enter a valid '+field.label.toLowerCase()+'.',true);return}
  }
  setBusy(true)
  try{
   const {error}=await supabase.from('institution_form_submissions').insert({
    institution_id:user.institutionId,form_id:selectedDefinition.id,submission_number:makeNumber(),
    submitted_by:user.id,answers,status:'pending'
   })
   if(error)throw error
   setAnswers({})
   setSelectedForm('')
   await load()
   onToast('Form submitted for institutional review.')
  }catch(e){onToast(e instanceof Error?e.message:'Form submission could not be saved.',true)}
  finally{setBusy(false)}
 }
 async function reviewSubmission(row:Submission,decision:'approved'|'rejected'|'returned'){
  if(!supabase||!user||!admin)return
  setBusy(true)
  try{
   const {error}=await supabase.rpc('review_institution_form_submission',{
    p_institution_id:user.institutionId,p_submission_id:row.id,p_decision:decision,p_review_note:reviewNote[row.id]||null
   })
   if(error)throw error
   await load()
   onToast('Form submission '+decision+'.')
  }catch(e){onToast(e instanceof Error?e.message:'Form submission review failed.',true)}
  finally{setBusy(false)}
 }
 const renderField=(field:FormField)=>{
  const value=answers[field.key]
  if(field.type==='textarea')return <label key={field.key}>{field.label}{field.required?' *':''}<textarea required={field.required} rows={3} value={String(value??'')} onChange={e=>setAnswers(v=>({...v,[field.key]:e.target.value}))}/></label>
  if(field.type==='select')return <label key={field.key}>{field.label}{field.required?' *':''}<select required={field.required} value={String(value??'')} onChange={e=>setAnswers(v=>({...v,[field.key]:e.target.value}))}><option value="">Select {field.label.toLowerCase()}</option>{(field.options??[]).map(o=><option key={o} value={o}>{o}</option>)}</select></label>
  if(field.type==='checkbox')return <label className="ed360-form-checkbox" key={field.key}><input type="checkbox" checked={Boolean(value)} onChange={e=>setAnswers(v=>({...v,[field.key]:e.target.checked}))}/>{field.label}{field.required?' *':''}</label>
  return <label key={field.key}>{field.label}{field.required?' *':''}<input type={field.type} required={field.required} value={String(value??'')} onChange={e=>setAnswers(v=>({...v,[field.key]:e.target.value}))}/></label>
 }
 if(!user)return null
 const title=page==='form-builder'?'Form Builder':page==='form-submissions'?'Form Submissions':'Letters & Applications'
 return <main className="page-content ed360-module-page ed360-certificate-forms">
  <header className="ed360-workspace-hero"><div className="ed360-workspace-hero-icon"><FileText size={21}/></div><div className="ed360-workspace-hero-copy"><span>CERTIFICATES / FORMS & LETTERS</span><h1>{title}</h1><p>{page==='form-builder'?'Configure reusable institution forms and publish them to selected roles.':page==='form-submissions'?'Review submitted forms, decisions and resolution notes.':'Submit a formal letter or application using institution-published templates.'}</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Tenant-scoped forms</span><button type="button" className="button button-outline" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div></header>
  {loading&&<div className="ed360-workspace-empty">Loading form definitions…</div>}
  {page==='form-builder'&&<>{admin&&<section className="ed360-data-card"><header><h2>Create form definition</h2><p>Fields use JSON schema with a unique key, label, type, required flag and optional select choices.</p></header><form className="ed360-data-form" onSubmit={saveDefinition}>
   <label>Form title<input required value={draft.title} onChange={e=>setDraft(v=>({...v,title:e.target.value}))}/></label>
   <label>Form code<input value={draft.form_code} onChange={e=>setDraft(v=>({...v,form_code:e.target.value}))} placeholder="Leave blank to derive from title"/></label>
   <label>Form type<select value={draft.form_type} onChange={e=>setDraft(v=>({...v,form_type:e.target.value}))}>{['general','application','letter_request','consent','feedback'].map(x=><option key={x} value={x}>{pretty(x)}</option>)}</select></label>
   <label>Audience roles (comma-separated)<input required value={draft.audience_roles} onChange={e=>setDraft(v=>({...v,audience_roles:e.target.value}))}/><small>Allowed: {roles.join(', ')}</small></label>
   <label className="ed360-forms-wide">Description<textarea rows={2} value={draft.description} onChange={e=>setDraft(v=>({...v,description:e.target.value}))}/></label>
   <label className="ed360-forms-wide">Field schema (JSON)<textarea rows={12} required value={draft.field_schema} onChange={e=>setDraft(v=>({...v,field_schema:e.target.value}))}/></label>
   <button className="button button-primary" disabled={busy}><FilePlus2 size={14}/> Save as draft</button>
  </form></section>}
  <section className="ed360-data-card"><header><h2>Form catalogue</h2><p>Publish only after reviewing the field schema and intended audience.</p></header><div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search form title or code…" aria-label="Search forms"/></div><div className="table-scroll"><table><thead><tr><th>Form</th><th>Type</th><th>Fields</th><th>Audience</th><th>Status</th><th>Action</th></tr></thead><tbody>{visibleDefinitions.map(row=><tr key={row.id}><td><b>{row.title}</b><small>{row.form_code}</small></td><td>{pretty(row.form_type)}</td><td>{row.field_schema.length}</td><td>{row.audience_roles.map(pretty).join(', ')}</td><td>{pretty(row.status)}</td><td>{admin&&<div className="ed360-form-actions">{row.status!=='published'&&<button type="button" className="button button-primary" disabled={busy} onClick={()=>void changeDefinitionStatus(row,'published')}>Publish</button>}{row.status==='published'&&<button type="button" className="button button-outline" disabled={busy} onClick={()=>void changeDefinitionStatus(row,'draft')}>Unpublish</button>}{row.status!=='archived'&&<button type="button" className="button button-outline" disabled={busy} onClick={()=>void changeDefinitionStatus(row,'archived')}>Archive</button>}</div>}</td></tr>)}</tbody></table></div></section></>}
  {page==='letters-applications'&&<><section className="ed360-data-card"><header><h2>Published letters and applications</h2><p>Select a published form addressed to your role and submit it for review.</p></header><div className="ed360-form-list">{published.filter(f=>f.form_type==='letter_request'||f.form_type==='application').map(form=><button type="button" className={'ed360-form-list-item '+(selectedForm===form.id?'selected':'')} key={form.id} onClick={()=>{setSelectedForm(form.id);setAnswers({})}}><b>{form.title}</b><small>{form.description??'Institution application form'} · {form.field_schema.length} fields</small></button>)}{published.filter(f=>f.form_type==='letter_request'||f.form_type==='application').length===0&&<div className="ed360-workspace-empty">No letter/application forms are currently published for your role.</div>}</div></section>
   {selectedDefinition&&<section className="ed360-data-card"><header><h2>{selectedDefinition.title}</h2><p>{selectedDefinition.description}</p></header><form className="ed360-data-form" onSubmit={submitForm}>{selectedDefinition.field_schema.map(renderField)}<button className="button button-primary" disabled={busy}><Send size={14}/> Submit application</button></form></section>}
   <section className="ed360-data-card"><header><h2>My recent submissions</h2></header><div className="table-scroll"><table><thead><tr><th>Submission</th><th>Form</th><th>Date</th><th>Status</th><th>Review note</th></tr></thead><tbody>{submissions.filter(s=>s.submitted_by===user.id).map(s=><tr key={s.id}><td>{s.submission_number}</td><td>{definitions.find(d=>d.id===s.form_id)?.title??'Form'}</td><td>{stamp(s.submitted_at)}</td><td>{pretty(s.status)}</td><td>{s.review_note??'—'}</td></tr>)}</tbody></table></div></section>
  </>}
  {page==='form-submissions'&&<section className="ed360-data-card"><header><h2>Form submission queue</h2><p>Requesters see their own submissions; owners/admins can review the institution queue.</p></header><div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search submission number or form…" aria-label="Search submissions"/></div><div className="table-scroll"><table><thead><tr><th>Submission</th><th>Form</th><th>Submitted by</th><th>Submitted</th><th>Status</th><th>Answers / review</th><th>Action</th></tr></thead><tbody>{visibleSubmissions.map(row=><tr key={row.id}><td><b>{row.submission_number}</b></td><td>{definitions.find(d=>d.id===row.form_id)?.title??'Form'}</td><td>{row.submitted_by===user.id?'You':row.submitted_by.slice(0,8)}</td><td>{stamp(row.submitted_at)}</td><td>{pretty(row.status)}</td><td><details><summary>View answers</summary><pre>{JSON.stringify(row.answers,null,2)}</pre>{row.review_note&&<p>{row.review_note}</p>}</details></td><td>{admin&&row.status==='pending'&&<div className="ed360-form-review"><input aria-label="Review note" placeholder="Required for reject/return" value={reviewNote[row.id]??''} onChange={e=>setReviewNote(v=>({...v,[row.id]:e.target.value}))}/><div className="ed360-form-actions"><button type="button" className="button button-primary" disabled={busy} onClick={()=>void reviewSubmission(row,'approved')}><ShieldCheck size={13}/> Approve</button><button type="button" className="button button-outline" disabled={busy} onClick={()=>void reviewSubmission(row,'returned')}>Return</button><button type="button" className="button button-outline" disabled={busy} onClick={()=>void reviewSubmission(row,'rejected')}>Reject</button></div></div>}</td></tr>)}</tbody></table></div></section>}
 </main>
}
