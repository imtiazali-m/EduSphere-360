import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { MessageSquareText, Plus, RefreshCw, Send, TicketCheck, UserCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/data-management.css'
type Row=Record<string,any>&{id:string}
const label=(v:unknown)=>String(v??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const stamp=(v:unknown)=>v?new Date(String(v)).toLocaleString():'—'
const ticketNumber=()=>'HD-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,7).toUpperCase()
export function HelpdeskWorkspace({workspaceKey,onToast}:{workspaceKey:string;onToast:(message:string,error?:boolean)=>void}){
 const {user}=useAuth()
 const admin=Boolean(user&&['owner','admin'].includes(user.role))
 const [tickets,setTickets]=useState<Row[]>([]),[comments,setComments]=useState<Row[]>([])
 const [selectedId,setSelectedId]=useState(''),[filter,setFilter]=useState('all'),[search,setSearch]=useState('')
 const [creating,setCreating]=useState(false),[busy,setBusy]=useState(false)
 const [newTicket,setNewTicket]=useState({title:'',description:'',category:'general',priority:'normal'})
 const [reply,setReply]=useState(''),[internal,setInternal]=useState(false),[nextStatus,setNextStatus]=useState('in_progress'),[resolution,setResolution]=useState('')
 async function load(){
  if(!supabase||!user){setTickets([]);return}
  const {data,error}=await supabase.from('institution_helpdesk_tickets').select('*').eq('institution_id',user.institutionId).order('updated_at',{ascending:false}).limit(2000)
  if(error){onToast(error.message,true);return} setTickets((data??[]) as Row[])
 }
 async function loadComments(id:string){
  if(!supabase||!user)return
  const {data,error}=await supabase.from('institution_helpdesk_comments').select('*').eq('institution_id',user.institutionId).eq('ticket_id',id).order('created_at')
  if(error){onToast(error.message,true);return} setComments((data??[]) as Row[])
 }
 useEffect(()=>{void load()},[user?.id,user?.institutionId,user?.role])
 useEffect(()=>{if(selectedId)void loadComments(selectedId);else setComments([])},[selectedId,user?.id,user?.institutionId])
 const selected=tickets.find(t=>t.id===selectedId)
 const visible=useMemo(()=>tickets.filter(t=>(filter==='all'||t.status===filter)&&(!search||[t.ticket_number,t.title,t.description,t.category].join(' ').toLowerCase().includes(search.toLowerCase()))),[tickets,filter,search])
 async function act(fn:()=>Promise<void>,success:string){
  if(busy)return;setBusy(true)
  try{await fn();onToast(success);await load();if(selectedId)await loadComments(selectedId)}
  catch(e){onToast(e instanceof Error?e.message:'The ticket action failed.',true)}finally{setBusy(false)}
 }
 async function create(event:FormEvent){
  event.preventDefault();if(!supabase||!user)return
  await act(async()=>{
   const {data,error}=await supabase!.from('institution_helpdesk_tickets').insert({
    institution_id:user!.institutionId,ticket_number:ticketNumber(),title:newTicket.title.trim(),description:newTicket.description.trim(),
    category:newTicket.category,priority:newTicket.priority,status:'open',created_by:user!.id
   }).select('*').single()
   if(error)throw error
   setNewTicket({title:'',description:'',category:'general',priority:'normal'});setCreating(false);setSelectedId(data.id)
  },'Helpdesk ticket submitted.')
 }
 async function sendReply(event:FormEvent){
  event.preventDefault();if(!supabase||!user||!selected)return
  await act(async()=>{
   const {error}=await supabase!.from('institution_helpdesk_comments').insert({
    institution_id:user!.institutionId,ticket_id:selected.id,author_id:user!.id,comment_body:reply.trim(),is_internal:admin&&internal
   });if(error)throw error;setReply('');setInternal(false)
  },'Ticket reply saved.')
 }
 async function update(status:string,assign=false){
  if(!supabase||!user||!selected||!admin)return
  await act(async()=>{
   const {error}=await supabase!.rpc('update_institution_helpdesk_ticket',{
    p_institution_id:user!.institutionId,p_ticket_id:selected.id,p_status:status,p_assign_to_self:assign,p_resolution_note:resolution
   });if(error)throw error
  },assign?'Ticket assigned to you.':'Ticket status updated.')
 }
 if(!user)return null
 return <main className="page-content ed360-module-page ed360-helpdesk">
  <header className="ed360-workspace-hero"><div className="ed360-workspace-hero-icon"><MessageSquareText size={21}/></div><div className="ed360-workspace-hero-copy"><span>COMMUNICATION / {workspaceKey.split(':').slice(-1)[0].replaceAll('-',' ').toUpperCase()}</span><h1>Complaints & Helpdesk</h1><p>Submit issues, track ownership, reply to requests and record resolutions.</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Tenant-scoped ticket register</span><button className="button button-outline" type="button" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div></header>
  <section className="ed360-data-card"><header><div><h2>Support tickets</h2><p>Requesters see their own tickets. Owners and administrators manage the institution queue.</p></div><button className="button button-primary" type="button" onClick={()=>setCreating(v=>!v)}><Plus size={14}/> New ticket</button></header>
   <div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tickets…" aria-label="Search tickets"/><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option>{['open','in_progress','waiting_on_requester','resolved','closed'].map(x=><option key={x} value={x}>{label(x)}</option>)}</select></div>
   {creating&&<form className="ed360-data-form" onSubmit={create}><label>Subject<input required minLength={4} maxLength={180} value={newTicket.title} onChange={e=>setNewTicket(v=>({...v,title:e.target.value}))}/></label><label>Category<select value={newTicket.category} onChange={e=>setNewTicket(v=>({...v,category:e.target.value}))}>{['general','account_access','student_records','fees_and_payments','attendance','academic','technical','other'].map(x=><option key={x} value={x}>{label(x)}</option>)}</select></label><label>Priority<select value={newTicket.priority} onChange={e=>setNewTicket(v=>({...v,priority:e.target.value}))}>{['low','normal','high','urgent'].map(x=><option key={x} value={x}>{label(x)}</option>)}</select></label><label className="ed360-helpdesk-wide">Description<textarea required minLength={10} rows={4} value={newTicket.description} onChange={e=>setNewTicket(v=>({...v,description:e.target.value}))}/></label><button className="button button-primary" disabled={busy}>Submit ticket</button></form>}
   <div className="ed360-helpdesk-columns"><div className="ed360-helpdesk-list">{visible.map(t=><button type="button" key={t.id} className={'ed360-helpdesk-ticket '+(selectedId===t.id?'selected':'')} onClick={()=>{setSelectedId(t.id);setNextStatus(t.status)}}><div><b>{t.ticket_number}</b><span className={'ed360-helpdesk-status '+t.status}>{label(t.status)}</span></div><strong>{t.title}</strong><small>{label(t.priority)} · {stamp(t.updated_at)}</small></button>)}{visible.length===0&&<div className="ed360-workspace-empty">No tickets found.</div>}</div>
    {selected?<div className="ed360-helpdesk-detail"><header><small>{selected.ticket_number} · {label(selected.category)} · {label(selected.priority)}</small><h2>{selected.title}</h2><p>Submitted {stamp(selected.created_at)}</p></header><div className="ed360-helpdesk-description">{selected.description}</div>
     {admin&&<div className="ed360-helpdesk-controls"><button className="button button-outline" type="button" disabled={busy||selected.assigned_to===user.id} onClick={()=>void update('in_progress',true)}><UserCheck size={14}/> {selected.assigned_to===user.id?'Assigned to you':'Assign to me'}</button><label>Status<select value={nextStatus} onChange={e=>setNextStatus(e.target.value)}>{['open','in_progress','waiting_on_requester','resolved','closed'].map(x=><option key={x} value={x}>{label(x)}</option>)}</select></label>{['resolved','closed'].includes(nextStatus)&&<label>Resolution note<input required value={resolution} onChange={e=>setResolution(e.target.value)}/></label>}<button className="button button-primary" type="button" disabled={busy} onClick={()=>void update(nextStatus)}><TicketCheck size={14}/> Save status</button></div>}
     <div className="ed360-helpdesk-comments"><h3>Conversation</h3>{comments.map(c=><article className={c.is_internal?'internal':''} key={c.id}><header><b>{c.author_id===user.id?'You':String(c.author_id).slice(0,8)}</b><small>{stamp(c.created_at)}{c.is_internal?' · Internal note':''}</small></header><p>{c.comment_body}</p></article>)}</div>
     {selected.status!=='closed'&&<form className="ed360-data-form" onSubmit={sendReply}><label className="ed360-helpdesk-wide">Reply<textarea rows={3} required minLength={2} value={reply} onChange={e=>setReply(e.target.value)}/></label>{admin&&<label className="ed360-helpdesk-internal"><input type="checkbox" checked={internal} onChange={e=>setInternal(e.target.checked)}/> Internal staff note</label>}<button className="button button-primary" disabled={busy}><Send size={14}/> Send reply</button></form>}
     {selected.resolution_note&&<div className="ed360-helpdesk-resolution">{selected.resolution_note}</div>}
    </div>:<div className="ed360-helpdesk-empty"><MessageSquareText size={24}/><b>Select a ticket</b><span>Choose a ticket to inspect its history and respond.</span></div>}
   </div>
  </section>
 </main>
}
