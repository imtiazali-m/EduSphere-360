import { useState } from 'react'
import { BrainCircuit, Clock3, FileText, MessageSquare, PanelLeftClose, Send, ShieldCheck, Sparkles } from 'lucide-react'
import '../styles/ai-assistant-workspace.css'

const suggestions=[
 {title:'Summarise a report',description:'Explain a permitted institution report in plain language.',icon:FileText},
 {title:'Prepare a notice',description:'Draft a clear notice for an institution audience.',icon:MessageSquare},
 {title:'Review attendance trends',description:'Help interpret attendance patterns and limitations.',icon:Clock3},
 {title:'Plan a lesson',description:'Create a lesson outline for a class and subject.',icon:Sparkles},
]

const intelligencePages:Record<string,{title:string;eyebrow:string;description:string;prompt:string}>={
 chat:{title:'AI Assistant',eyebrow:'INSTITUTION AI ASSISTANT',description:'Ask questions about permitted institutional records, draft notices and plan academic work.',prompt:'Ask about an institutional task…'},
 'smart-reports':{title:'Smart Reports',eyebrow:'AI REPORT INTERPRETATION',description:'Prepare plain-language explanations of selected reports, trends and anomalies with source references.',prompt:'Describe the report you want interpreted…'},
 'student-performance-prediction':{title:'Student Performance Prediction',eyebrow:'LEARNER RISK & PROGRESS',description:'Review historical marks, attendance and assessment evidence. Any forecast must disclose its data window and uncertainty.',prompt:'Select the class, term and prediction question…'},
 'student-analysis':{title:'Student Analysis',eyebrow:'INDIVIDUAL LEARNER INSIGHTS',description:'Bring together authorised attendance, assessment and enrolment context for a student review.',prompt:'Enter a student or admission number…'},
 'fee-collection-prediction':{title:'Fee Collection Prediction',eyebrow:'RECEIVABLES FORECAST',description:'Analyse invoice ageing and recorded payment history. Forecasts require sufficient historical data and an enabled AI provider.',prompt:'Choose the fee period and forecast horizon…'},
 'examination-analysis':{title:'Examination Analysis',eyebrow:'EXAMINATION INTELLIGENCE',description:'Review class, section, subject and exam-level performance, grade distribution and missing marks.',prompt:'Select an examination to analyse…'},
 'ai-timetable-suggestions':{title:'AI Timetable Suggestions',eyebrow:'SCHEDULING ASSISTANT',description:'Evaluate teacher availability, room capacity and timetable conflicts before proposing a schedule.',prompt:'Describe the timetable constraints…'},
 'ai-question-generation':{title:'AI Question Generation',eyebrow:'ASSESSMENT AUTHORING',description:'Prepare question-generation instructions by subject, class, learning outcome and difficulty.',prompt:'Describe the subject and learning outcomes…'},
 'ai-document-assistant':{title:'AI Document Assistant',eyebrow:'INSTITUTION DOCUMENTS',description:'Assist with authorised document summaries, notices, letters and policy drafts.',prompt:'Describe the document task…'},
 'ai-learning-recommendations':{title:'AI Learning Recommendations',eyebrow:'PERSONALISED LEARNING',description:'Create evidence-led learning recommendations from published results and available learning progress.',prompt:'Select a learner and learning goal…'},
 'academic-performance-insights':{title:'Academic Performance Insights',eyebrow:'ACADEMIC INTELLIGENCE',description:'Compare academic outcomes across classes, sections, subjects and examination periods.',prompt:'Choose the academic comparison…'},
 'attendance-and-behaviour-insights':{title:'Attendance & Behaviour Insights',eyebrow:'STUDENT ENGAGEMENT',description:'Review attendance patterns and authorised behaviour records without treating correlation as causation.',prompt:'Choose a date range and cohort…'},
 'institutional-intelligence':{title:'Institutional Intelligence',eyebrow:'COLLEGE-WIDE INSIGHTS',description:'Bring together approved academic, attendance, staffing and financial indicators for institutional review.',prompt:'What institutional question should be explored…'}
}
export function AIAssistantWorkspace({initialWindow='chat'}:{initialWindow?:string}){
 const page=intelligencePages[initialWindow]??intelligencePages.chat
 const [prompt,setPrompt]=useState('')
 const [historyOpen,setHistoryOpen]=useState(true)
 const [showReadiness,setShowReadiness]=useState(false)
 return <main className="ed360-ai-workspace">
  <header className="ed360-ai-header">
   <div className="ed360-ai-brand"><span><BrainCircuit size={21}/></span><div><small>EDUSPHERE 360 INTELLIGENCE</small><h1>{page.title}</h1><p>{page.description}</p></div></div>
   <div className="ed360-ai-status"><i/> Private AI workspace</div>
  </header>
  <div className="ed360-ai-layout">
   <aside className={historyOpen?'ed360-ai-history':'ed360-ai-history is-collapsed'}>
    <div className="ed360-ai-history-head"><b>Conversations</b><button type="button" onClick={()=>setHistoryOpen(false)} aria-label="Collapse conversations"><PanelLeftClose size={16}/></button></div>
    <div className="ed360-ai-history-empty"><MessageSquare size={21}/><b>No conversations yet</b><p>Conversation history appears here when an AI provider is connected and conversation storage is enabled.</p></div>
    {!historyOpen&&<button type="button" className="ed360-ai-expand-history" onClick={()=>setHistoryOpen(true)} aria-label="Expand conversations"><PanelLeftClose size={16}/></button>}
   </aside>
   <section className="ed360-ai-chat">
    <div className="ed360-ai-chat-top"><span><Sparkles size={15}/> Assistant workspace</span><small>Role permissions continue to apply to any connected data.</small></div>
    <div className="ed360-ai-chat-body">
     <div className="ed360-ai-welcome">
      <span className="ed360-ai-welcome-mark"><BrainCircuit size={28}/></span>
      <span className="ed360-ai-eyebrow">{page.eyebrow}</span>
      <h2>{page.title}</h2>
      <p>{page.description} Any AI-generated conclusion must cite its source records and disclose its assumptions and limitations.</p>
     </div>
     <div className="ed360-ai-suggestions">{suggestions.map(item=>{const Icon=item.icon;return <button type="button" key={item.title} onClick={()=>{setPrompt(item.title+': ');setShowReadiness(true)}}><span><Icon size={17}/></span><div><b>{item.title}</b><small>{item.description}</small></div></button>})}</div>
     {showReadiness&&<div className="ed360-ai-readiness" role="status"><ShieldCheck size={17}/><div><b>Your request has not been sent.</b><p>The AI provider endpoint and institution-approved API secret have not been configured in this deployment. Your request remains on this page; no private college records are sent to an unconfigured service.</p></div></div>}
    </div>
    <form className="ed360-ai-composer" onSubmit={event=>{event.preventDefault();setShowReadiness(true)}}>
     <label htmlFor="ed360-ai-prompt">Message the assistant</label>
     <div><textarea id="ed360-ai-prompt" value={prompt} onChange={event=>setPrompt(event.target.value)} rows={2} placeholder={page.prompt} disabled aria-describedby="ed360-ai-provider-note"/><button type="submit" disabled title="Connect an AI provider to send messages"><Send size={17}/><span>Send</span></button></div>
     <small id="ed360-ai-provider-note">AI generation remains safely paused until an approved provider endpoint and server-side secret are configured. Do not enter confidential personal data here yet.</small>
    </form>
   </section>
  </div>
 </main>
}
