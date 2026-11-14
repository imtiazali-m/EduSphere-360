import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Activity, BarChart3, BrainCircuit, CalendarDays, CircleAlert, FileText, GraduationCap, LoaderCircle, RefreshCw, Send, Settings2, ShieldCheck, Sparkles, TrendingUp, Users, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import '../styles/modern-workspace-refresh.css'

type ProviderKey='openai'|'anthropic'|'gemini'|'deepseek'|'xai'|'meta'|'perplexity'
type ProviderStatus={configured:boolean;secretName:string}
type Message={role:'user'|'assistant';content:string;time:string}
const providers:{key:ProviderKey;name:string;secret:string;hint:string;model:string}[]=[
 {key:'openai',name:'OpenAI',secret:'OPENAI_API_KEY',hint:'Model ID',model:'gpt-6'},
 {key:'anthropic',name:'Claude',secret:'ANTHROPIC_API_KEY',hint:'Model ID',model:'claude-sonnet-4-5'},
 {key:'gemini',name:'Gemini',secret:'GEMINI_API_KEY',hint:'Model ID',model:'gemini-3-pro-preview'},
 {key:'deepseek',name:'DeepSeek',secret:'DEEPSEEK_API_KEY',hint:'Model ID',model:'deepseek-chat'},
 {key:'xai',name:'Grok · xAI',secret:'XAI_API_KEY',hint:'Model ID',model:'grok-4'},
 {key:'meta',name:'Meta Model API',secret:'META_MODEL_API_KEY',hint:'Model ID',model:'muse-spark-1.3'},
 {key:'perplexity',name:'Perplexity',secret:'PERPLEXITY_API_KEY',hint:'Model ID',model:'perplexity/sonar'},
]
const pages:Record<string,{title:string;category:string;description:string;prompt:string;icon:any}>={
 chat:{title:'AI Assistant',category:'ASSISTANT',description:'Ask a question or prepare a college task using the selected model.',prompt:'What would you like to work on?',icon:BrainCircuit},
 'smart-reports':{title:'Smart Reports',category:'REPORT INTELLIGENCE',description:'Explain report patterns, exceptions and changes using permitted college records.',prompt:'Which report should be interpreted, and what should be highlighted?',icon:BarChart3},
 'student-performance-prediction':{title:'Student Performance Prediction',category:'STUDENT OUTLOOK',description:'Estimate class-level academic outlook from past marks and attendance. Predictions are guidance, not decisions.',prompt:'Which class, subject or assessment period should be forecast?',icon:TrendingUp},
 'student-analysis':{title:'Student Analysis',category:'LEARNER REVIEW',description:'Review a learner’s authorised academic and attendance context and identify useful support actions.',prompt:'Enter an admission number or describe the cohort to review.',icon:GraduationCap},
 'fee-collection-prediction':{title:'Fee Collection Prediction',category:'FINANCE OUTLOOK',description:'Estimate collection trends using recorded invoices, receipts and outstanding balances.',prompt:'Which fee period and forecast horizon should be analysed?',icon:Wallet},
 'examination-analysis':{title:'Examination Analysis',category:'EXAMINATION INTELLIGENCE',description:'Compare marks, grade distributions, pass rates and subject performance from saved results.',prompt:'Which exam, class or subject should be analysed?',icon:BarChart3},
 'ai-timetable-suggestions':{title:'AI Timetable Suggestions',category:'SCHEDULING',description:'Suggest schedule improvements from saved timetable, teacher and room allocations.',prompt:'Describe the scheduling objective or constraints.',icon:CalendarDays},
 'ai-question-generation':{title:'AI Question Generation',category:'ASSESSMENT AUTHORING',description:'Draft questions by subject, class, topic, learning outcome, marks and difficulty.',prompt:'Specify subject, class, topic, question count and difficulty.',icon:FileText},
 'ai-document-assistant':{title:'AI Document Assistant',category:'DOCUMENT WORKSPACE',description:'Draft or review college notices, letters, meeting notes and policy documents.',prompt:'Describe the document and required format.',icon:FileText},
 'ai-learning-recommendations':{title:'AI Learning Recommendations',category:'LEARNING SUPPORT',description:'Suggest learning steps from available class-level progress and curriculum evidence.',prompt:'Which learner, class or learning goal should be considered?',icon:GraduationCap},
 'academic-performance-insights':{title:'Academic Performance Insights',category:'ACADEMIC INTELLIGENCE',description:'Identify strengths and improvement areas across sessions, classes and subjects.',prompt:'Which academic period or classes should be compared?',icon:TrendingUp},
 'attendance-and-behaviour-insights':{title:'Attendance & Behaviour Insights',category:'STUDENT ENGAGEMENT',description:'Review attendance patterns and recorded behaviour categories without assuming causation.',prompt:'Which date range, class or behaviour category should be reviewed?',icon:Users},
 'institutional-intelligence':{title:'Institutional Intelligence',category:'COLLEGE INTELLIGENCE',description:'Combine approved academic, attendance, staffing and finance summaries for leadership review.',prompt:'What college-level question should the analysis answer?',icon:Activity},
}
const statusCount=(rows:any[],key:string)=>rows.reduce((out:Record<string,number>,row:any)=>{const k=String(row[key]??'Unspecified');out[k]=(out[k]??0)+1;return out},{})
const groupAverage=(rows:any[],key:string)=>{const groups:Record<string,{count:number;sum:number}>={};for(const row of rows){const label=String(row[key]??'Unspecified');groups[label]??={count:0,sum:0};groups[label].count++;groups[label].sum+=Number(row.total_marks)>0?Number(row.marks_obtained)/Number(row.total_marks)*100:0}return Object.entries(groups).map(([label,value])=>({label,count:value.count,average:Math.round(value.sum/value.count*10)/10}))}

export function AIAssistantWorkspace({initialWindow='chat'}:{initialWindow?:string}){
 const {user}=useAuth()
 const pageKey=initialWindow in pages?initialWindow:'chat'
 const page=pages[pageKey]
 const [provider,setProvider]=useState<ProviderKey>('openai')
 const [model,setModel]=useState('gpt-6')
 const [status,setStatus]=useState<Partial<Record<ProviderKey,ProviderStatus>>>({})
 const [messages,setMessages]=useState<Message[]>([])
 const [prompt,setPrompt]=useState('')
 const [loading,setLoading]=useState(false)
 const [checking,setChecking]=useState(true)
 const [error,setError]=useState('')
 const [showProviders,setShowProviders]=useState(false)
 const [contextSummary,setContextSummary]=useState('No database context loaded')
 const [includeData,setIncludeData]=useState(true)
 const selectedProvider=providers.find(item=>item.key===provider)!
 const available=Boolean(status[provider]?.configured)
 const PageIcon=page.icon

 useEffect(()=>{setModel(providers.find(p=>p.key===provider)?.model??'')},[provider])
 useEffect(()=>{let active=true;(async()=>{if(!supabase||!user){setChecking(false);return}const {data,error:invokeError}=await supabase.functions.invoke('ai-assistant',{body:{action:'status',institutionId:user.institutionId}});if(!active)return;if(invokeError){setError('AI gateway is unavailable.');setChecking(false);return}if(data?.providers)setStatus(data.providers as Partial<Record<ProviderKey,ProviderStatus>>);setChecking(false)})();return()=>{active=false}},[user?.id,user?.institutionId])

 async function loadContext(){
  if(!supabase||!user)return {}
  const institutionId=user.institutionId
  const read=(table:string,columns:string)=>supabase!.from(table).select(columns).eq('institution_id',institutionId).limit(1500)
  const needExam=['student-performance-prediction','student-analysis','academic-performance-insights','examination-analysis','smart-reports','institutional-intelligence'].includes(pageKey)
  const needAttendance=['student-performance-prediction','student-analysis','attendance-and-behaviour-insights','institutional-intelligence','smart-reports'].includes(pageKey)
  const needFees=['fee-collection-prediction','institutional-intelligence']
  const needPeople=pageKey==='institutional-intelligence'
  const [exam,attendance,fees,students,teachers]=await Promise.all([
   needExam?read('exam_results','exam_title,subject,class_name,marks_obtained,total_marks,result_status,is_absent,created_at'):Promise.resolve({data:[],error:null}),
   needAttendance?read('attendance','class_name,status,attendance_date,period_label'):Promise.resolve({data:[],error:null}),
   needFees?read('fee_invoices','total_amount,paid_amount,due_date,status,created_at'):Promise.resolve({data:[],error:null}),
   needPeople?read('students','class_name,status'):Promise.resolve({data:[],error:null}),
   needPeople?read('teachers','department,employment_status,employee_type'):Promise.resolve({data:[],error:null}),
  ])
  for(const result of [exam,attendance,fees,students,teachers])if(result.error)throw result.error
  const context:Record<string,unknown>={}
  if(needExam){const rows=exam.data??[];context.examination={recordCount:rows.length,publishedCount:rows.filter(r=>r.result_status==='published').length,byClass:groupAverage(rows,'class_name'),bySubject:groupAverage(rows,'subject'),byExam:statusCount(rows,'exam_title')}}
  if(needAttendance){const rows=attendance.data??[];context.attendance={recordCount:rows.length,byStatus:statusCount(rows,'status'),byClass:statusCount(rows,'class_name'),dateRange:rows.length?{from:rows.reduce((a:string,r:any)=>r.attendance_date<a?a:r.attendance_date,rows[0].attendance_date),to:rows.reduce((a:string,r:any)=>r.attendance_date>a?a:r.attendance_date,rows[0].attendance_date)}:null}}
  if(needFees){const rows=fees.data??[];context.fees={invoiceCount:rows.length,invoiced:rows.reduce((n:number,r:any)=>n+Number(r.total_amount??0),0),received:rows.reduce((n:number,r:any)=>n+Number(r.paid_amount??0),0),byStatus:statusCount(rows,'status')}}
  if(needPeople){context.people={students:(students.data??[]).length,employees:(teachers.data??[]).length,studentsByClass:statusCount(students.data??[],'class_name'),employeesByDepartment:statusCount(teachers.data??[],'department')}}
  return context
 }

 async function sendMessage(event:FormEvent){
  event.preventDefault()
  if(!prompt.trim()||loading||!available||!supabase||!user)return
  const currentPrompt=prompt.trim()
  const nextMessages=[...messages.slice(-8),{role:'user' as const,content:currentPrompt,time:new Date().toLocaleTimeString()}]
  setMessages(nextMessages);setPrompt('');setLoading(true);setError('')
  try{
   const databaseContext=includeData?await loadContext():{}
   setContextSummary(includeData?'Institution-authorised summary data attached':'No college data attached')
   const history=nextMessages.map(m=>({role:m.role,content:m.content}))
   const {data,error:invokeError}=await supabase.functions.invoke('ai-assistant',{body:{action:'generate',institutionId:user.institutionId,provider,model,page:pageKey,messages:history,context:databaseContext}})
   if(invokeError)throw invokeError
   if(!data?.text)throw new Error(data?.error??'The provider did not return a response.')
   setMessages(current=>[...current,{role:'assistant',content:data.text,time:new Date().toLocaleTimeString()}])
  }catch(e){setError('The request could not be completed. Check the model ID, provider key and available balance, then try again.')}
  finally{setLoading(false)}
 }
 const suggestions=useMemo(()=>({
  chat:['Summarise current priorities','Draft an official college notice'],
  'smart-reports':['Explain the strongest and weakest indicators','Highlight unusual changes in the report'],
  'student-performance-prediction':['Estimate class-level subject trends','Identify learning-support priorities'],
  'student-analysis':['Review a learner’s progress','Suggest evidence-based support steps'],
  'fee-collection-prediction':['Estimate collection trends by period','Identify outstanding fee patterns'],
  'examination-analysis':['Compare subject performance','Explain grade and pass-rate patterns'],
  'ai-timetable-suggestions':['Find timetable conflicts','Suggest balanced period allocation'],
  'ai-question-generation':['Draft a class-level question set','Create a marking guide'],
  'ai-document-assistant':['Draft a formal letter','Summarise a policy document'],
  'ai-learning-recommendations':['Suggest next learning topics','Create a short revision plan'],
  'academic-performance-insights':['Compare subjects and classes','Summarise learning progress'],
  'attendance-and-behaviour-insights':['Review attendance by class','Highlight recorded behaviour patterns'],
  'institutional-intelligence':['Prepare a leadership summary','Highlight cross-college indicators'],
 } as Record<string,string[]>)[pageKey]??[],[pageKey])
 return <main className="mw-page ai-modern-page">
  <header className="mw-hero">
   <div className="mw-hero-mark"><BrainCircuit size={24}/></div>
   <div className="mw-hero-copy"><span>{page.category}</span><h1>{page.title}</h1><p>{page.description}</p></div>
   <div className="mw-hero-actions"><span className={'mw-status '+(available?'is-live':'is-pending')}>{checking?'Checking providers':available?'Provider ready':'Provider key needed'}</span><button className="mw-secondary" onClick={()=>setShowProviders(v=>!v)}><Settings2 size={15}/> Providers</button></div>
  </header>
  <section className="mw-two-column">
   <div className="mw-main-column">
    <section className="mw-panel ai-conversation-panel">
     <div className="mw-panel-head"><div><span>WORKSPACE</span><h2>Analysis and responses</h2></div><small>{messages.length} messages</small></div>
     {messages.length===0?<div className="ai-welcome"><div className="ai-welcome-icon"><PageIcon size={25}/></div><h2>{page.title}</h2><p>{contextSummary}</p><div className="ai-suggestion-grid">{suggestions.map(s=><button key={s} onClick={()=>setPrompt(s)}><Sparkles size={15}/>{s}</button>)}</div></div>:<div className="ai-message-list">{messages.map((m,i)=><article className={'ai-message '+m.role} key={i}><span>{m.role==='assistant'?'AI':'You'} · {m.time}</span><p>{m.content}</p></article>)}{loading&&<article className="ai-message assistant pending"><span>AI</span><p><LoaderCircle size={15} className="mw-spin"/> Preparing your analysis…</p></article>}</div>}
     <form className="ai-composer" onSubmit={sendMessage}><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={page.prompt} rows={3} disabled={loading}/><div><label className="ai-context-toggle"><input type="checkbox" checked={includeData} onChange={e=>setIncludeData(e.target.checked)}/> Include permitted college summaries</label><button className="mw-primary" type="submit" disabled={!available||loading||!prompt.trim()}>{loading?<LoaderCircle size={15}/>:<Send size={15}/>} {loading?'Working…':'Generate'}</button></div></form>
    </section>
   </div>
   <aside className="mw-side-column">
    <section className="mw-panel ai-model-panel"><div className="mw-panel-head"><div><span>MODEL ROUTING</span><h2>Choose a provider</h2></div><Sparkles size={18}/></div>
     <label>AI provider<select value={provider} onChange={e=>setProvider(e.target.value as ProviderKey)}>{providers.map(p=><option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
     <label>Model identifier<input value={model} onChange={e=>setModel(e.target.value)} placeholder={selectedProvider.hint}/></label>
     <div className="ai-provider-list">{providers.map(p=><div key={p.key}><span>{p.name}</span><b className={status[p.key]?.configured?'configured':''}>{checking?'Checking':status[p.key]?.configured?'Ready':'Key needed'}</b></div>)}</div>
     <p className="ai-secret-note"><ShieldCheck size={14}/> Keys are held in Supabase Edge Function secrets.</p>
     <button className="mw-secondary block" onClick={()=>setShowProviders(v=>!v)}><Settings2 size={14}/> Provider setup</button>
    </section>
    <section className="mw-panel ai-data-panel"><div className="mw-panel-head"><div><span>DATA SCOPE</span><h2>College records</h2></div><Activity size={18}/></div><p>{contextSummary}</p><button className="mw-secondary block" onClick={()=>void loadContext().then(()=>setContextSummary('Institution-authorised summaries are available for the next request.')).catch(()=>setError('Permitted records could not be read.'))}><RefreshCw size={14}/> Refresh data context</button></section>
    {showProviders&&<section className="mw-panel ai-setup-panel"><div className="mw-panel-head"><div><span>INTEGRATIONS</span><h2>Provider credentials</h2></div></div>{providers.map(p=><div className="ai-provider-detail" key={p.key}><div><b>{p.name}</b><small>{p.secret}</small></div><span className={status[p.key]?.configured?'configured':''}>{status[p.key]?.configured?'Key configured':'Missing key'}</span></div>)}<p>Add server-side keys in Supabase → Edge Functions → Secrets, then refresh this page.</p></section>}
   </aside>
  </section>
  {error&&<div className="mw-alert error"><CircleAlert size={16}/>{error}</div>}
 </main>
}
