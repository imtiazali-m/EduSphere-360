import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { CheckCheck, MessageSquare, Plus, RefreshCw, Send } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { createRecord, listRecords } from '../lib/data'
import type { RecordRow } from '../lib/types'
import '../styles/data-management.css'

type Member={user_id:string;role:string;full_name:string;email:string}
type Message={id:string;batch_id:string;sender_user_id:string;recipient_user_id:string;message_type:string;subject:string;body:string;status:string;sent_at:string;read_at:string|null}
type Template=RecordRow & {id:string;title:string;payload?:Record<string,unknown>}
type VisitorRow={id:string;visitor_name:string;host_teacher_id:string|null;visit_date:string;status:string;approved_by:string|null}
type TeacherRow={id:string;user_id:string|null;full_name:string}
const pageTitles:Record<string,string>={'whatsapp-integration':'WhatsApp Integration','individual-messages':'Individual Messages','bulk-messages':'Bulk Messages','class-wise-messaging':'Class-wise Messaging','employee-notifications':'Employee Notifications','message-templates':'Message Templates','email-notifications':'Email Notifications','delivery-history':'Delivery History','communication-logs':'Communication Logs','communication-reports':'Communication Reports','parent-communication':'Parent Communication','internal-messages':'Internal Messages','complaints-helpdesk':'Complaints & Helpdesk','visitor-notifications':'Visitor Host Notifications'}
const pageNotes:Record<string,string>={
 'whatsapp-integration':'Review the WhatsApp provider state. In-app messages work; WhatsApp delivery is not connected.',
 'individual-messages':'Send a private in-app message to one active member of this institution.',
 'bulk-messages':'Send one in-app notice to a selected institution role group.',
 'class-wise-messaging':'Send an in-app notice to students with active accounts in a selected class.',
 'employee-notifications':'Send operational notices to active employee and specialist accounts.',
 'message-templates':'Save reusable subject and message templates for institution communications.',
 'email-notifications':'Review email delivery readiness. No email provider is connected.',
 'delivery-history':'Review sent and read states for in-app messages.',
 'communication-logs':'Review institution message activity with sender, recipient and time.',
 'communication-reports':'Review message volume and read status by message type.',
 'parent-communication':'Send an in-app notice to active parent accounts. This is not an SMS or WhatsApp delivery.',
 'internal-messages':'Manage direct in-app conversations inside the institution.',
 'complaints-helpdesk':'Review and respond to complaints and helpdesk messages received in the institution.',
 'visitor-notifications':'Notify an approved visitor’s host through a private in-app message. External email and WhatsApp delivery are not connected.'
}
const displayDate=(value:string)=>value?new Date(value).toLocaleString():'—'
export function CommunicationWorkspace({workspaceKey,onToast}:{workspaceKey:string;onToast:(message:string,error?:boolean)=>void}){
 const {user,mode}=useAuth()
 const itemKey=workspaceKey.split(':').slice(1).join(':')||'communication-logs'
 const title=pageTitles[itemKey]??'Institution Communication'
 const description=pageNotes[itemKey]??'Keep institution communication in one controlled workspace.'
 const admin=Boolean(user&&['owner','admin'].includes(user.role))
 const [members,setMembers]=useState<Member[]>([])
 const [messages,setMessages]=useState<Message[]>([])
 const [templates,setTemplates]=useState<Template[]>([])
 const [students,setStudents]=useState<{user_id:string;full_name:string;class_name:string}[]>([])
 const [visitors,setVisitors]=useState<VisitorRow[]>([])
 const [teachers,setTeachers]=useState<TeacherRow[]>([])
 const [visitorId,setVisitorId]=useState('')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [search,setSearch]=useState('')
 const [audience,setAudience]=useState('teachers')
 const [className,setClassName]=useState('')
 const [recipient,setRecipient]=useState('')
 const [subject,setSubject]=useState('')
 const [body,setBody]=useState('')
 const [templateName,setTemplateName]=useState('')
 const [templateSubject,setTemplateSubject]=useState('')
 const [templateBody,setTemplateBody]=useState('')
 const [templateCategory,setTemplateCategory]=useState('general')
 const [statusFilter,setStatusFilter]=useState('all')
 const [selectedTemplate,setSelectedTemplate]=useState('')
 const isProviderPage=itemKey==='whatsapp-integration'||itemKey==='email-notifications'
 const isTemplatePage=itemKey==='message-templates'
 const canCompose=admin&&!isProviderPage&&!isTemplatePage&&['individual-messages','bulk-messages','class-wise-messaging','employee-notifications','parent-communication','internal-messages','complaints-helpdesk','visitor-notifications'].includes(itemKey)
 async function load(){
  if(!supabase||!user){setLoading(false);return}
  setLoading(true)
  try{
   const {data:messageData,error:messageError}=await supabase.from('institution_messages').select('*').eq('institution_id',user.institutionId).order('sent_at',{ascending:false}).limit(1000)
   if(messageError)throw messageError
   setMessages((messageData??[]) as Message[])
   if(admin){
    const {data:membersData,error:membersError}=await supabase.from('memberships').select('user_id,role').eq('institution_id',user.institutionId).eq('status','active')
    if(membersError)throw membersError
    const ids=(membersData??[]).map(x=>String(x.user_id)).filter(x=>x!==user.id)
    const profileMap=new Map<string,{full_name:string;email:string}>()
    for(let i=0;i<ids.length;i+=100){
     const {data:profiles,error}=await supabase.from('profiles').select('id,full_name,email').in('id',ids.slice(i,i+100))
     if(error)throw error
     ;(profiles??[]).forEach(p=>profileMap.set(String(p.id),{full_name:String(p.full_name),email:String(p.email)}))
    }
    setMembers((membersData??[]).filter(x=>String(x.user_id)!==user.id).map(x=>({user_id:String(x.user_id),role:String(x.role),full_name:profileMap.get(String(x.user_id))?.full_name??'Institution member',email:profileMap.get(String(x.user_id))?.email??''})))
    const [studentResult,visitorResult,teacherResult]=await Promise.all([
     supabase.from('students').select('user_id,full_name,class_name').eq('institution_id',user.institutionId).not('user_id','is',null).limit(1000),
     supabase.from('visitor_entries').select('id,visitor_name,host_teacher_id,visit_date,status,approved_by').eq('institution_id',user.institutionId).eq('status','expected').not('approved_by','is',null).order('visit_date',{ascending:false}).limit(500),
     supabase.from('teachers').select('id,user_id,full_name').eq('institution_id',user.institutionId).not('user_id','is',null).limit(1000)
    ])
    if(studentResult.error)throw studentResult.error
    if(visitorResult.error)throw visitorResult.error
    if(teacherResult.error)throw teacherResult.error
    setStudents((studentResult.data??[]).filter(x=>x.user_id).map(x=>({user_id:String(x.user_id),full_name:String(x.full_name??''),class_name:String(x.class_name??'')})))
    setVisitors((visitorResult.data??[]) as VisitorRow[])
    setTeachers((teacherResult.data??[]) as TeacherRow[])
    const records=await listRecords(mode,user,'institutional_records') as Template[]
    setTemplates(records.filter(row=>row.module_key==='communication'&&row.record_type==='message-template'))
   }
  }catch(error){onToast(error instanceof Error?error.message:'Communication records could not be loaded.',true)}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[user?.id,user?.institutionId,user?.role])
 const incoming=messages.filter(m=>m.recipient_user_id===user?.id)
 const unread=incoming.filter(m=>m.status==='sent').length
 const filtered=useMemo(()=>messages.filter(m=>{
  const q=search.trim().toLowerCase()
  return (statusFilter==='all'||m.status===statusFilter)&&(!q||[m.subject,m.body,m.message_type,m.status,m.sender_user_id,m.recipient_user_id].some(x=>String(x??'').toLowerCase().includes(q)))
 }),[messages,search,statusFilter])
 const visibleTemplates=templates.filter(t=>!search||t.title.toLowerCase().includes(search.toLowerCase()))
 function templateForForm(id:string){
  setSelectedTemplate(id)
  const row=templates.find(x=>x.id===id)
  if(!row)return
  setSubject(String(row.payload?.subject??row.title))
  setBody(String(row.payload?.body??''))
 }
 async function sendMessage(event:FormEvent){
  event.preventDefault();if(!supabase||!user||!admin)return
  if(!subject.trim()||!body.trim()){onToast('Enter both a subject and a message.',true);return}
  let targetMembers:Member[]=[]
  let messageType:'direct'|'broadcast'|'complaint'='direct'
  if(itemKey==='individual-messages'||itemKey==='internal-messages'){
   targetMembers=members.filter(x=>x.user_id===recipient)
  }else if(itemKey==='complaints-helpdesk'){
   targetMembers=members.filter(x=>['owner','admin'].includes(x.role))
   messageType='complaint'
  }else if(itemKey==='visitor-notifications'){
   const visitor=visitors.find(row=>row.id===visitorId)
   if(!visitor){onToast('Select an approved visitor before composing a host notification.',true);return}
   const host=teachers.find(row=>row.id===visitor.host_teacher_id)
   if(!host?.user_id){onToast('The selected visitor has no linked host account. Assign a host with an active institution login first.',true);return}
   targetMembers=members.filter(row=>row.user_id===host.user_id)
  }else{
   messageType='broadcast'
   if(itemKey==='class-wise-messaging'){
    if(!className){onToast('Choose a class before sending.',true);return}
    const ids=new Set(students.filter(x=>x.class_name===className).map(x=>x.user_id))
    targetMembers=members.filter(x=>ids.has(x.user_id))
   }else if(itemKey==='employee-notifications')targetMembers=members.filter(x=>['teacher','accountant','exam_officer'].includes(x.role))
   else if(itemKey==='parent-communication'||audience==='parents')targetMembers=members.filter(x=>x.role==='parent')
   else if(audience==='students')targetMembers=members.filter(x=>x.role==='student')
   else if(audience==='teachers')targetMembers=members.filter(x=>x.role==='teacher')
   else if(audience==='all')targetMembers=members
  }
  if(!targetMembers.length){onToast('No active recipients match this message. Check that those users have active institution accounts.',true);return}
  if(targetMembers.length>500){onToast('This message exceeds the 500-recipient limit. Narrow the audience.',true);return}
  setBusy(true)
  try{
   const batch=crypto.randomUUID()
   const records=targetMembers.map(target=>({institution_id:user.institutionId,batch_id:batch,sender_user_id:user.id,recipient_user_id:target.user_id,message_type:messageType,subject:subject.trim(),body:body.trim(),status:'sent'}))
   const {error}=await supabase.from('institution_messages').insert(records)
   if(error)throw error
   onToast('In-app message sent to '+targetMembers.length+' recipient(s).')
   setSubject('');setBody('');setRecipient('');setVisitorId('');await load()
  }catch(error){onToast(error instanceof Error?error.message:'Messages could not be sent.',true)}
  finally{setBusy(false)}
 }
 async function saveTemplate(event:FormEvent){
  event.preventDefault();if(!user||!admin||!templateName.trim()||!templateSubject.trim()||!templateBody.trim())return
  setBusy(true)
  try{
   await createRecord(mode,user,'institutional_records',{module_key:'communication',record_type:'message-template',title:templateName.trim(),description:templateCategory,status:'active',approval_status:'not_required',visibility:'staff_only',record_date:new Date().toISOString().slice(0,10),payload:{subject:templateSubject.trim(),body:templateBody.trim(),category:templateCategory}})
   setTemplateName('');setTemplateSubject('');setTemplateBody('');onToast('Message template saved.');await load()
  }catch(error){onToast(error instanceof Error?error.message:'Template could not be saved.',true)}
  finally{setBusy(false)}
 }
 async function markRead(row:Message){
  if(!supabase||!user||row.recipient_user_id!==user.id||row.status!=='sent')return
  const {error}=await supabase.from('institution_messages').update({status:'read',read_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('institution_id',user.institutionId).eq('id',row.id)
  if(error){onToast(error.message,true);return}
  setMessages(current=>current.map(m=>m.id===row.id?{...m,status:'read',read_at:new Date().toISOString()}:m))
 }
 function applyTemplate(event:ChangeEvent<HTMLSelectElement>){templateForForm(event.target.value)}
 if(!user)return null
 return <main className="page-content ed360-module-page ed360-communication-workspace">
  <header className="ed360-workspace-hero"><div className="ed360-workspace-hero-icon"><MessageSquare size={21}/></div><div className="ed360-workspace-hero-copy"><span>COMMUNICATION / IN-APP MESSAGING</span><h1>{title}</h1><p>{description}</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Institution-scoped messages</span><button type="button" className="button button-outline" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div></header>
  <section className="ed360-workspace-kpis"><article><span>Messages</span><strong>{messages.length}</strong><small>Accessible in-app records</small></article><article><span>Received</span><strong>{incoming.length}</strong><small>Addressed to your account</small></article><article><span>Unread</span><strong>{unread}</strong><small>Awaiting your review</small></article><article><span>Active accounts</span><strong>{admin?members.length:'—'}</strong><small>{admin?'Recipient directory':'Directory restricted to administrators'}</small></article></section>
  {isProviderPage&&<section className="ed360-data-card"><header><h2>{itemKey==='whatsapp-integration'?'WhatsApp connection':'Email delivery connection'}</h2><p>External providers are not connected. The in-app message centre below is available independently.</p></header><div className="ed360-integration-list"><div><b>In-app institution messaging</b><span className="state-ready">Available</span><small>Messages are stored in the institution database with sender and recipient permissions.</small></div><div><b>{itemKey==='whatsapp-integration'?'WhatsApp Business API':'Email service provider'}</b><span className="state-pending">Not connected</span><small>Provider credentials, webhook delivery, sender verification and failure handling must be configured before external sending can be enabled.</small></div></div></section>}
  {isTemplatePage&&<section className="ed360-data-card"><header><h2>Create reusable message template</h2><p>Templates store text only. They do not send a message until an authorised user selects the template and sends it.</p></header><form className="ed360-data-form" onSubmit={saveTemplate}><label>Template name<input required value={templateName} onChange={e=>setTemplateName(e.target.value)}/></label><label>Category<select value={templateCategory} onChange={e=>setTemplateCategory(e.target.value)}><option value="general">General</option><option value="fee-reminder">Fee reminder</option><option value="academic">Academic</option><option value="attendance">Attendance</option><option value="event">Event</option><option value="staff">Staff</option></select></label><label>Subject<input required value={templateSubject} onChange={e=>setTemplateSubject(e.target.value)}/></label><label>Message<textarea required rows={4} value={templateBody} onChange={e=>setTemplateBody(e.target.value)}/></label><button className="button button-primary" disabled={busy}><Plus size={15}/> Save template</button></form><div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search templates…" aria-label="Search message templates"/></div>{visibleTemplates.map(t=><article className="ed360-template-row" key={t.id}><div><b>{t.title}</b><small>{String(t.payload?.category??'general')} · {String(t.payload?.subject??'')}</small><p>{String(t.payload?.body??'')}</p></div><span>{t.status??'active'}</span></article>)}</section>}
  {canCompose&&<section className="ed360-data-card"><header><h2>Compose in-app message</h2><p>Sending creates one traceable message per recipient. The selected audience must have active accounts in this institution.</p></header><form className="ed360-data-form" onSubmit={sendMessage}>
   {templates.length>0&&<label>Use a saved template<select value={selectedTemplate} onChange={applyTemplate}><option value="">Start blank</option>{templates.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>}
   {itemKey==='visitor-notifications'&&<label>Approved visitor<select required value={visitorId} onChange={e=>setVisitorId(e.target.value)}><option value="">Select visitor / host</option>{visitors.map(visitor=>{const host=teachers.find(row=>row.id===visitor.host_teacher_id);return <option key={visitor.id} value={visitor.id}>{visitor.visitor_name} · {visitor.visit_date} · {host?.full_name??'Host not linked'}</option>})}</select></label>}
   {(itemKey==='individual-messages'||itemKey==='internal-messages')&&<label>Recipient<select required value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="">Select an institution member</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{m.full_name} · {m.role}{m.email?' · '+m.email:''}</option>)}</select></label>}
   {itemKey==='bulk-messages'&&<label>Audience<select value={audience} onChange={e=>setAudience(e.target.value)}><option value="students">Students</option><option value="parents">Parents / guardians</option><option value="teachers">Teachers</option><option value="all">All active institution members</option></select></label>}
   {itemKey==='class-wise-messaging'&&<label>Class<select required value={className} onChange={e=>setClassName(e.target.value)}><option value="">Select class</option>{[...new Set(students.map(s=>s.class_name).filter(Boolean))].sort().map(x=><option key={x} value={x}>{x}</option>)}</select></label>}
   {itemKey==='complaints-helpdesk'&&<p className="ed360-data-warning">This message is recorded as a helpdesk complaint and delivered to active owner/administrator accounts.</p>}
   <label>Subject<input required maxLength={180} value={subject} onChange={e=>setSubject(e.target.value)}/></label><label>Message<textarea required rows={5} maxLength={12000} value={body} onChange={e=>setBody(e.target.value)}/></label><button className="button button-primary" disabled={busy}><Send size={15}/>{busy?'Sending…':'Send in-app message'}</button>
  </form></section>}
  {(!admin&&!isProviderPage&&!isTemplatePage)&&<section className="ed360-data-card"><p>Recipient directory and broadcast controls are managed by your institution owner or administrator. You can review messages addressed to your account below.</p></section>}
  {['delivery-history','communication-logs','communication-reports','complaints-helpdesk','individual-messages','internal-messages','bulk-messages','class-wise-messaging','employee-notifications','parent-communication','whatsapp-integration','email-notifications','visitor-notifications'].includes(itemKey)&&<section className="ed360-data-card"><header><h2>{itemKey==='complaints-helpdesk'?'Institution helpdesk queue':itemKey==='communication-reports'?'Communication delivery summary':itemKey==='delivery-history'?'Message delivery history':'Institution message register'}</h2><p>Status is based on in-app recipient acknowledgements. External channel delivery is not included.</p></header><div className="ed360-data-toolbar"><label><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search messages…" aria-label="Search messages"/></label><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} aria-label="Filter message status"><option value="all">All status</option><option value="sent">Sent / unread</option><option value="read">Read</option><option value="archived">Archived</option></select></div>{loading?<p>Loading messages…</p>:filtered.length===0?<div className="ed360-workspace-empty">No messages match this view.</div>:<div className="table-scroll"><table><thead><tr><th>Sent</th><th>Type</th><th>Subject</th><th>Sender</th><th>Recipient</th><th>Message</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id}><td>{displayDate(row.sent_at)}</td><td>{row.message_type}</td><td>{row.subject}</td><td>{row.sender_user_id===user.id?'You':members.find(x=>x.user_id===row.sender_user_id)?.full_name??'Institution member'}</td><td>{row.recipient_user_id===user.id?'You':members.find(x=>x.user_id===row.recipient_user_id)?.full_name??'Institution member'}</td><td className="ed360-message-body">{row.body}</td><td>{row.status}</td><td>{row.recipient_user_id===user.id&&row.status==='sent'&&<button type="button" className="button button-outline" onClick={()=>void markRead(row)}><CheckCheck size={13}/> Mark read</button>}</td></tr>)}</tbody></table></div>}</section>}
 </main>
}
