import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Activity, ArrowUpRight, BrainCircuit, CheckCircle2, ChevronDown, CircleAlert, FileBarChart2, GraduationCap, LoaderCircle, MessageCircle, Send, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listRecords } from '../lib/data'
import { supabase } from '../lib/supabase'
import type { RecordRow } from '../lib/types'
import '../styles/ai-assistant-workspace.css'

type ProviderKey='openai'|'anthropic'|'gemini'|'deepseek'|'xai'|'meta'|'perplexity'
type ProviderStatus=Record<ProviderKey,{configured:boolean}>
type Message={id:string;role:'user'|'assistant';content:string;provider?:string;sources?:{title?:string;url?:string;snippet?:string}[]}
const providers:{key:ProviderKey;label:string;model:string}[]=[
 {key:'openai',label:'ChatGPT / OpenAI',model:'gpt-6-astra'},
 {key:'anthropic',label:'Claude',model:'claude-sonnet-5'},
 {key:'gemini',label:'Gemini',model:'gemini-flash-latest'},
 {key:'deepseek',label:'DeepSeek',model:'deepseek-flash'},
 {key:'xai',label:'Grok',model:'grok-4.7'},
 {key:'meta',label:'Meta',model:'muse-spark-1.3'},
 {key:'perplexity',label:'Perplexity',model:'fast'},
]
const intelligencePages:Record<string,{title:string;eyebrow:string;description:string;placeholder:string;icon:any;quick:string[]}>={
 chat:{title:'AI Assistant',eyebrow:'INSTITUTIONAL AI',description:'Ask a question, prepare a document or explore an authorised institutional dataset.',placeholder:'Ask the college assistant…',icon:BrainCircuit,quick:['Summarise the latest institutional indicators','Draft a formal college notice','Explain the strongest attendance trend']},
 'smart-reports':{title:'Smart Reports',eyebrow:'REPORT INTELLIGENCE',description:'Turn report data into a concise explanation, comparisons and practical next steps.',placeholder:'Which report or trend should be explained?',icon:FileBarChart2,quick:['Summarise key changes by class','Identify unusual changes without overstating them','Recommend what the report owner should verify']},
 'student-performance-prediction':{title:'Student Performance Prediction',eyebrow:'LEARNER OUTLOOK',description:'Assess aggregate learning signals and explain the assumptions behind any forward-looking estimate.',placeholder:'Describe the cohort, subject or assessment period…',icon:GraduationCap,quick:['Estimate class-level performance from published results','Identify subjects needing additional support','Explain which evidence is missing for a reliable forecast']},
 'student-analysis':{title:'Student Analysis',eyebrow:'STUDENT INSIGHTS',description:'Review permitted learner indicators without exposing unrelated personal details.',placeholder:'Describe the learner group or analysis question…',icon:GraduationCap,quick:['Compare attendance and published result patterns','Identify a learner support review checklist','Summarise progress by class and subject']},
 'fee-collection-prediction':{title:'Fee Collection Prediction',eyebrow:'FINANCE FORECAST',description:'Review invoice and receipt patterns. Estimates are planning guidance, not collection guarantees.',placeholder:'Set the fee period and forecast question…',icon:FileBarChart2,quick:['Estimate collection from recorded invoice history','Explain ageing and outstanding balance patterns','Identify what may affect next-month receipts']},
 'examination-analysis':{title:'Examination Analysis',eyebrow:'ASSESSMENT INTELLIGENCE',description:'Explore result quality, class and subject outcomes, grade distributions and missing evidence.',placeholder:'Which examination, class or subject should be analysed?',icon:Activity,quick:['Summarise published result outcomes','Compare subjects and class averages','Flag missing marks or incomplete publication evidence']},
 'ai-timetable-suggestions':{title:'AI Timetable Suggestions',eyebrow:'SCHEDULING INTELLIGENCE',description:'Review timetable constraints and propose options for human review before publishing.',placeholder:'Describe teacher, room and period constraints…',icon:Activity,quick:['Suggest ways to reduce timetable conflicts','Review room and teacher allocation constraints','Prepare a substitution planning checklist']},
 'ai-question-generation':{title:'AI Question Generation',eyebrow:'ASSESSMENT AUTHORING',description:'Draft question sets from a subject, class level, learning outcome and difficulty mix.',placeholder:'Enter subject, learning outcome, marks and difficulty…',icon:WandSparkles,quick:['Create a balanced MCQ and short-answer blueprint','Generate questions at three difficulty levels','Prepare an answer key and marking rubric']},
 'ai-document-assistant':{title:'AI Document Assistant',eyebrow:'DOCUMENT WORKSPACE',description:'Draft, revise and summarise college documents using the selected institutional context.',placeholder:'Describe the document or file task…',icon:FileBarChart2,quick:['Draft a formal college circular','Create an approval memo with clear sections','Summarise a policy in plain language']},
 'ai-learning-recommendations':{title:'AI Learning Recommendations',eyebrow:'LEARNING SUPPORT',description:'Build practical study recommendations from available academic evidence and stated learning goals.',placeholder:'Describe the class, subject and learning goal…',icon:GraduationCap,quick:['Create a two-week revision plan','Suggest follow-up practice for difficult topics','Prepare differentiated learning support ideas']},
 'academic-performance-insights':{title:'Academic Performance Insights',eyebrow:'ACADEMIC INTELLIGENCE',description:'Compare learning outcomes across available classes, subjects and published assessments.',placeholder:'Which academic performance question should be explored?',icon:FileBarChart2,quick:['Find classes with improving average results','Compare subject performance over the available period','Explain gaps in the current academic evidence']},
 'attendance-and-behaviour-insights':{title:'Attendance & Behaviour Insights',eyebrow:'STUDENT ENGAGEMENT',description:'Explore attendance and authorised behaviour patterns. Correlation must not be treated as causation.',placeholder:'Select a cohort, period or engagement question…',icon:Activity,quick:['Compare attendance patterns by class','Identify repeated absence trends for review','Prepare a supportive attendance follow-up plan']},
 'institutional-intelligence':{title:'Institutional Intelligence',eyebrow:'COLLEGE-WIDE INTELLIGENCE',description:'Bring permitted academic, people, attendance and financial indicators into one evidence-led review.',placeholder:'What institutional decision or trend should be analysed?',icon:BrainCircuit,quick:['Prepare a concise institutional health summary','Compare academic, attendance and fee indicators','Identify data quality gaps for management review']},
}
const datasetsByPage:Record<string,string[]>={
 chat:['students','teachers','attendance','exam_results','fee_invoices','assignments','assignment_submissions'],
 'smart-reports':['students','teachers','attendance','exam_results','fee_invoices','assignments','assignment_submissions'],
 'student-performance-prediction':['students','attendance','exam_results','assignment_submissions'],
 'student-analysis':['students','attendance','exam_results','assignment_submissions'],
 'fee-collection-prediction':['fee_invoices'],
 'examination-analysis':['students','exam_results'],
 'ai-timetable-suggestions':['teachers','classes','subjects','rooms','timetable_entries'],
 'ai-question-generation':['classes','subjects'],
 'ai-document-assistant':['announcements','institutional_records'],
 'ai-learning-recommendations':['students','exam_results','assignments','assignment_submissions'],
 'academic-performance-insights':['students','exam_results','assignments','assignment_submissions'],
 'attendance-and-behaviour-insights':['students','attendance'],
 'institutional-intelligence':['students','teachers','attendance','exam_results','fee_invoices','assignments','assignment_submissions'],
}
const compact=(rows:RecordRow[],key:string)=>rows.reduce<Record<string,number>>((acc,row)=>{const label=String(row[key]??'Not recorded').trim()||'Not recorded';acc[label]=(acc[label]??0)+1;return acc},{})
function buildEvidence(page:string,sets:Record<string,RecordRow[]>){
 const count=(key:string)=>(sets[key]??[]).length
 const attendance=sets.attendance??[]
 const present=attendance.filter(r=>['present','late'].includes(String(r.status))).length
 const results=(sets.exam_results??[]).filter(r=>String(r.result_status??'published')==='published')
 const average=results.length?results.reduce((n,r)=>n+(Number(r.total_marks)>0?Number(r.marks_obtained??0)/Number(r.total_marks)*100:0),0)/results.length:null
 const invoices=sets.fee_invoices??[]
 const invoiced=invoices.reduce((n,r)=>n+Number(r.total_amount??r.amount??0),0)
 const received=invoices.reduce((n,r)=>n+Number(r.paid_amount??0),0)
 return {
  evidence_scope:page,
  source_record_counts:Object.fromEntries(Object.keys(sets).map(key=>[key,count(key)])),
  student_distribution_by_class:compact(sets.students??[],'class_name'),
  staff_by_department:compact(sets.teachers??[],'department'),
  attendance:{entries:attendance.length,present_or_legacy_late:present,absence_entries:attendance.filter(r=>r.status==='absent').length,aggregate_rate:attendance.length?Number((present/attendance.length*100).toFixed(1)):null,by_class:compact(attendance,'class_name')},
  published_examination_results:{entries:results.length,mean_percentage:average===null?null:Number(average.toFixed(1)),by_class:compact(results,'class_name'),by_subject:compact(results,'subject')},
  fee_invoices:{count:invoices.length,total_invoiced:invoiced,total_received:received,total_outstanding:Math.max(0,invoiced-received),currency:'PKR'},
  coursework:{assignments:count('assignments'),submissions:count('assignment_submissions'),graded_submissions:(sets.assignment_submissions??[]).filter(r=>r.status==='graded').length},
  timetable:{teacher_records:count('teachers'),class_records:count('classes'),subject_records:count('subjects'),room_records:count('rooms'),timetable_entries:count('timetable_entries')},
  privacy_note:'Only institution-scoped aggregate counts and sums are supplied. Student and employee names, emails, admission numbers and other direct identifiers are excluded.'
 }
}
const uid=()=>typeof crypto!=='undefined'&&'randomUUID'in crypto?crypto.randomUUID():String(Date.now())+Math.random()
export function AIAssistantWorkspace({initialWindow='chat'}:{initialWindow?:string}){
 const {user,mode}=useAuth()
 const pageKey=initialWindow.split(':').pop()||'chat'
 const page=intelligencePages[pageKey]??intelligencePages.chat
 const Icon=page.icon
 const [messages,setMessages]=useState<Message[]>([])
 const [prompt,setPrompt]=useState('')
 const [settingsOpen,setSettingsOpen]=useState(false)
 const [provider,setProvider]=useState<'auto'|ProviderKey>('auto')
 const [model,setModel]=useState('')
 const [providerStatus,setProviderStatus]=useState<ProviderStatus>({} as ProviderStatus)
 const [statusLoading,setStatusLoading]=useState(true)
 const [dataLoading,setDataLoading]=useState(true)
 const [evidence,setEvidence]=useState<Record<string,unknown>>({})
 const [sourceNames,setSourceNames]=useState<string[]>([])
 const [sending,setSending]=useState(false)
 const [error,setError]=useState('')
 const feedRef=useRef<HTMLDivElement>(null)
 const configured=providers.filter(p=>providerStatus[p.key]?.configured)
 const selectedProvider=provider==='auto'?(configured[0]?.key??''):provider
 const activeModel=model.trim()||(providers.find(p=>p.key===selectedProvider)?.model??'')
 const contextNames=useMemo(()=>sourceNames.map(key=>key.replaceAll('_',' ')),[sourceNames])
 useEffect(()=>{
  if(!user||!supabase){setStatusLoading(false);setDataLoading(false);return}
  let live=true
  setStatusLoading(true);setDataLoading(true)
  void supabase.functions.invoke('ai-assistant',{body:{action:'status',institutionId:user.institutionId}})
   .then(({data,error:invokeError})=>{
    if(!live)return
    if(invokeError)throw invokeError
    setProviderStatus((data?.providers??{}) as ProviderStatus)
   }).catch(err=>{if(live)setError(err instanceof Error?err.message:'AI connection status could not be checked.')})
   .finally(()=>{if(live)setStatusLoading(false)})
  const keys=[...new Set(datasetsByPage[pageKey]??datasetsByPage.chat)]
  void Promise.all(keys.map(async key=>{
    try{return [key,await listRecords(mode,user,key)] as const}
    catch{return [key,[] as RecordRow[]] as const}
  })).then(pairs=>{
    if(!live)return
    const sets=Object.fromEntries(pairs) as Record<string,RecordRow[]>
    setEvidence(buildEvidence(pageKey,sets))
    setSourceNames(pairs.filter(([,rows])=>rows.length>0).map(([key])=>key))
  }).catch(()=>{if(live){setEvidence(buildEvidence(pageKey,{}));setSourceNames([])}})
   .finally(()=>{if(live)setDataLoading(false)})
  return()=>{live=false}
 },[user?.id,user?.institutionId,mode,pageKey])
 useEffect(()=>{if(feedRef.current)feedRef.current.scrollTop=feedRef.current.scrollHeight},[messages,sending])
 function appendPrompt(value:string){setPrompt(value);setError('')}
 async function send(event:FormEvent){
  event.preventDefault()
  const content=prompt.trim()
  if(!content||sending)return
  if(!supabase||!user){setError('Your authenticated institution session is not available. Sign in again.');return}
  if(statusLoading){setError('Checking the institution AI connection. Try again in a moment.');return}
  if(provider==='auto'&&!configured.length){setError('No AI provider key is configured on the institution server yet. An administrator must add at least one approved provider secret; no request has been sent.');setSettingsOpen(true);return}
  if(provider!=='auto'&&!providerStatus[provider]?.configured){setError('This provider is not configured on the institution server. Choose an available provider or ask the administrator to add its secret.');setSettingsOpen(true);return}
  const next:Message[]=[...messages,{id:uid(),role:'user',content}]
  setMessages(next);setPrompt('');setSending(true);setError('')
  try{
   const {data,error:invokeError}=await supabase.functions.invoke('ai-assistant',{body:{
    action:'generate',institutionId:user.institutionId,page:pageKey,provider,model:activeModel,
    messages:next.slice(-8).map(m=>({role:m.role,content:m.content})),
    context:evidence,
   }})
   if(invokeError)throw invokeError
   if(data?.error)throw new Error(String(data.error))
   const label=providers.find(p=>p.key===data?.provider)?.label
   setMessages(current=>[...current,{id:uid(),role:'assistant',content:String(data?.text??''),provider:label,sources:Array.isArray(data?.sources)?data.sources:[]}])
  }catch(err){setError(err instanceof Error?err.message:'AI response could not be generated.');}
  finally{setSending(false)}
 }
 const availableCount=configured.length
 return <main className="ed360-ai-workspace">
  <header className="ed360-ai-header">
   <div className="ed360-ai-brand"><span><Icon size={23}/></span><div><small>EDUSPHERE 360 · {page.eyebrow}</small><h1>{page.title}</h1><p>{page.description}</p></div></div>
   <div className="ed360-ai-status"><i className={availableCount?'is-connected':''}/>{statusLoading?'Checking AI service':availableCount?'AI service available':'AI connection needed'}</div>
  </header>
  <div className="ed360-ai-layout">
   <aside className="ed360-ai-context">
    <div className="ed360-ai-context-title"><ShieldCheck size={17}/><b>Connected context</b></div>
    <p>Only records your signed-in role can access are considered. Personal identifiers are left out of the shared summary.</p>
    <div className="ed360-ai-source-list">
     {contextNames.length?contextNames.map(name=><span key={name}><CheckCircle2 size={13}/>{name}</span>):<span className="muted">{dataLoading?'Loading authorised sources…':'No permitted data rows were available for this view.'}</span>}
    </div>
    <div className="ed360-ai-context-foot"><small>Institution</small><b>{user?.institutionName??'Institution workspace'}</b><small>Evidence status</small><b>{dataLoading?'Preparing data summary':'Summary prepared'}</b></div>
    <button type="button" className="ed360-ai-settings-trigger" onClick={()=>setSettingsOpen(v=>!v)} aria-expanded={settingsOpen}><span>AI service settings</span><ChevronDown size={15}/></button>
    {settingsOpen&&<div className="ed360-ai-provider-settings">
     <p>Connection details are kept here. Provider credentials remain server-side.</p>
     <label>Preferred service<select value={provider} onChange={e=>setProvider(e.target.value as 'auto'|ProviderKey)}><option value="auto">Automatic · choose an available service</option>{providers.map(p=><option value={p.key} key={p.key} disabled={!providerStatus[p.key]?.configured}>{p.label}{providerStatus[p.key]?.configured?' · ready':' · not configured'}</option>)}</select></label>
     <label>Model identifier (optional)<input value={model} onChange={e=>setModel(e.target.value)} placeholder="Use the configured default model"/></label>
     <div className="ed360-ai-provider-list">{providers.map(p=><div key={p.key}><span>{p.label}</span><em className={providerStatus[p.key]?.configured?'ready':''}>{statusLoading?'Checking…':providerStatus[p.key]?.configured?'Connected':'Not configured'}</em></div>)}</div>
     <small>API keys are never requested in this browser. Add or rotate them in Supabase Edge Function secrets.</small>
    </div>}
   </aside>
   <section className="ed360-ai-chat">
    <div className="ed360-ai-chat-top"><span><Sparkles size={15}/> {page.title}</span><small>Evidence-led · institution-scoped</small></div>
    <div className="ed360-ai-chat-body" ref={feedRef}>
     {!messages.length&&<div className="ed360-ai-welcome">
      <span className="ed360-ai-welcome-mark"><Icon size={28}/></span>
      <span className="ed360-ai-eyebrow">{page.eyebrow}</span>
      <h2>What would you like to work on?</h2>
      <p>Ask a question or start with one of the guided tasks. Results will use the available authorised data context and clearly state what the records cannot prove.</p>
      <div className="ed360-ai-suggestions">{page.quick.map((item,i)=><button type="button" key={item} onClick={()=>appendPrompt(item)}><span>{i===0?<FileBarChart2 size={17}/>:i===1?<Activity size={17}/>:<Sparkles size={17}/>}</span><div><b>{item}</b><small>Use this as a starting prompt</small></div><ArrowUpRight size={14}/></button>)}</div>
     </div>}
     {messages.map(message=><article className={'ed360-ai-message '+message.role} key={message.id}>
       <span className="ed360-ai-message-avatar">{message.role==='assistant'?<BrainCircuit size={16}/>:<MessageCircle size={16}/>}</span>
       <div className="ed360-ai-message-content"><small>{message.role==='assistant'?'AI response':'You'}</small><p>{message.content}</p>
        {message.provider&&<span className="ed360-ai-generated"><Sparkles size={12}/> Generated response</span>}
        {!!message.sources?.length&&<div className="ed360-ai-citations"><b>Web sources</b>{message.sources.map((s,i)=><a key={s.url??i} href={s.url} target="_blank" rel="noreferrer">{s.title??s.url}<ArrowUpRight size={12}/></a>)}</div>}
       </div>
      </article>)}
     {sending&&<div className="ed360-ai-thinking"><LoaderCircle size={17}/> Preparing a sourced response…</div>}
    </div>
    {error&&<div className="ed360-ai-error" role="alert"><CircleAlert size={16}/>{error}</div>}
    <form className="ed360-ai-composer" onSubmit={send}>
     <label htmlFor="ed360-ai-prompt">Your request</label>
     <div><textarea id="ed360-ai-prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} rows={2} placeholder={page.placeholder} disabled={sending}/><button type="submit" disabled={sending||!prompt.trim()}><Send size={16}/><span>{sending?'Working…':'Send'}</span></button></div>
     <small>AI outputs are suggestions. Verify sensitive decisions against official records and human review.</small>
    </form>
   </section>
  </div>
 </main>
}
