import { useState } from 'react'
import { BrainCircuit, Clock3, FileText, MessageSquare, PanelLeftClose, Send, ShieldCheck, Sparkles } from 'lucide-react'
import '../styles/ai-assistant-workspace.css'

const suggestions=[
 {title:'Summarise a report',description:'Explain a permitted institution report in plain language.',icon:FileText},
 {title:'Prepare a notice',description:'Draft a clear notice for an institution audience.',icon:MessageSquare},
 {title:'Review attendance trends',description:'Help interpret attendance patterns and limitations.',icon:Clock3},
 {title:'Plan a lesson',description:'Create a lesson outline for a class and subject.',icon:Sparkles},
]

export function AIAssistantWorkspace(){
 const [prompt,setPrompt]=useState('')
 const [historyOpen,setHistoryOpen]=useState(true)
 const [showReadiness,setShowReadiness]=useState(false)
 return <main className="ed360-ai-workspace">
  <header className="ed360-ai-header">
   <div className="ed360-ai-brand"><span><BrainCircuit size={21}/></span><div><small>EDUSPHERE 360 INTELLIGENCE</small><h1>AI Assistant</h1><p>Assistance for authorised institution work.</p></div></div>
   <div className="ed360-ai-status"><i/> AI service not connected</div>
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
      <span className="ed360-ai-eyebrow">EDUSPHERE 360 INTELLIGENCE</span>
      <h2>How can I help your institution?</h2>
      <p>Use an AI assistant to understand permitted records, prepare communications and support academic planning. AI answers must cite their data context and disclose limitations.</p>
     </div>
     <div className="ed360-ai-suggestions">{suggestions.map(item=>{const Icon=item.icon;return <button type="button" key={item.title} onClick={()=>{setPrompt(item.title+': ');setShowReadiness(true)}}><span><Icon size={17}/></span><div><b>{item.title}</b><small>{item.description}</small></div></button>})}</div>
     {showReadiness&&<div className="ed360-ai-readiness" role="status"><ShieldCheck size={17}/><div><b>Your request has not been sent.</b><p>The current Supabase project has no AI assistant Edge Function or configured model endpoint. This screen is ready for that connection, but it will not invent a response or send institution data to an unconfigured service.</p></div></div>}
    </div>
    <form className="ed360-ai-composer" onSubmit={event=>{event.preventDefault();setShowReadiness(true)}}>
     <label htmlFor="ed360-ai-prompt">Message the assistant</label>
     <div><textarea id="ed360-ai-prompt" value={prompt} onChange={event=>setPrompt(event.target.value)} rows={2} placeholder="Describe the report or task you need help with…" disabled aria-describedby="ed360-ai-provider-note"/><button type="submit" disabled title="Connect an AI provider to send messages"><Send size={17}/><span>Send</span></button></div>
     <small id="ed360-ai-provider-note">Sending is disabled until an institution-approved AI service is connected. No prompt or private institution data is being transmitted.</small>
    </form>
   </section>
  </div>
 </main>
}
