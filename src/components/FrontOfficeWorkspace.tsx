import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, ClipboardList, Megaphone, Plus, RefreshCw, Search, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/front-office-workspace.css'

type FrontOfficeView='enquiries'|'announcements'|'events'|'unavailable'
type Enquiry={
 id:string;enquiry_no:string;student_name:string;class_applied_for:string;guardian_name:string;guardian_phone:string;
 guardian_email:string|null;source:string;follow_up_date:string|null;status:string;notes:string|null;created_at:string
}
type Announcement={id:string;title:string;body:string;audience:string;created_at:string}
type EventRow={id:string;title:string;event_type:string;description:string|null;start_date:string;end_date:string;all_day:boolean;audience:string;status:string;created_at:string}
const viewOptions:{key:FrontOfficeView;label:string;description:string;icon:typeof ClipboardList}[]=[
 {key:'enquiries',label:'Reception & Enquiries',description:'Track prospective families and follow-ups.',icon:ClipboardList},
 {key:'announcements',label:'Circulars & Notices',description:'Publish notices to the correct institution audience.',icon:Megaphone},
 {key:'events',label:'Events & Activities',description:'Maintain the institution calendar and event schedule.',icon:CalendarDays},
]
const titleCase=(v:string)=>v.replaceAll('_',' ').replace(/\b\w/g,s=>s.toUpperCase())
const today=()=>new Date().toISOString().slice(0,10)
const enquiryNumber=()=>`ENQ-${Date.now().toString(36).toUpperCase()}`

export function FrontOfficeWorkspace({initialView='enquiries',onToast}:{initialView?:string;onToast:(message:string,error?:boolean)=>void}){
 const {user}=useAuth()
 const canManage=Boolean(user&&['owner','admin'].includes(user.role))
 const canPublish=Boolean(user&&['owner','admin','teacher'].includes(user.role))
 const [view,setView]=useState<FrontOfficeView>(['enquiries','announcements','events'].includes(initialView)?initialView as FrontOfficeView:'announcements')
 const [search,setSearch]=useState('')
 const [loading,setLoading]=useState(false)
 const [saving,setSaving]=useState(false)
 const [loadError,setLoadError]=useState('')
 const [enquiries,setEnquiries]=useState<Enquiry[]>([])
 const [announcements,setAnnouncements]=useState<Announcement[]>([])
 const [events,setEvents]=useState<EventRow[]>([])
 const [showForm,setShowForm]=useState(false)
 const [editingId,setEditingId]=useState<string|null>(null)
 const [selectedEnquiry,setSelectedEnquiry]=useState<Enquiry|null>(null)

 const [studentName,setStudentName]=useState('')
 const [classApplied,setClassApplied]=useState('')
 const [guardianName,setGuardianName]=useState('')
 const [guardianPhone,setGuardianPhone]=useState('')
 const [guardianEmail,setGuardianEmail]=useState('')
 const [source,setSource]=useState('Walk-in')
 const [followUpDate,setFollowUpDate]=useState('')
 const [enquiryStatus,setEnquiryStatus]=useState('new')
 const [enquiryNotes,setEnquiryNotes]=useState('')

 const [noticeTitle,setNoticeTitle]=useState('')
 const [noticeBody,setNoticeBody]=useState('')
 const [noticeAudience,setNoticeAudience]=useState('all')

 const [eventTitle,setEventTitle]=useState('')
 const [eventType,setEventType]=useState('event')
 const [eventDescription,setEventDescription]=useState('')
 const [eventStart,setEventStart]=useState(today())
 const [eventEnd,setEventEnd]=useState(today())
 const [eventAllDay,setEventAllDay]=useState(true)
 const [eventAudience,setEventAudience]=useState('all')
 const [eventStatus,setEventStatus]=useState('draft')

 const load=useCallback(async()=>{
  if(!supabase||!user){setLoadError('Sign in to view your institution workspace.');return}
  setLoading(true);setLoadError('')
  try{
   if(view==='enquiries'){
    if(!canManage){setEnquiries([]);return}
    const {data,error}=await supabase.from('admission_enquiries').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false}).limit(300)
    if(error)throw error
    setEnquiries((data??[]) as Enquiry[])
   }else if(view==='announcements'){
    const {data,error}=await supabase.from('announcements').select('id,title,body,audience,created_at').eq('institution_id',user.institutionId).order('created_at',{ascending:false}).limit(300)
    if(error)throw error
    setAnnouncements((data??[]) as Announcement[])
   }else if(view==='events'){
    const {data,error}=await supabase.from('academic_calendar_events').select('id,title,event_type,description,start_date,end_date,all_day,audience,status,created_at').eq('institution_id',user.institutionId).order('start_date',{ascending:false}).limit(300)
    if(error)throw error
    setEvents((data??[]) as EventRow[])
   }
  }catch{
   setLoadError('This information could not be loaded. Check your access and try refreshing.')
   if(view==='enquiries')setEnquiries([])
   if(view==='announcements')setAnnouncements([])
   if(view==='events')setEvents([])
  }finally{setLoading(false)}
 },[user?.id,user?.institutionId,view,canManage])

 useEffect(()=>{void load()},[load])

 const filteredEnquiries=useMemo(()=>enquiries.filter(row=>[row.enquiry_no,row.student_name,row.class_applied_for,row.guardian_name,row.guardian_phone,row.status].some(v=>String(v??'').toLowerCase().includes(search.toLowerCase()))),[enquiries,search])
 const filteredAnnouncements=useMemo(()=>announcements.filter(row=>[row.title,row.body,row.audience].some(v=>String(v??'').toLowerCase().includes(search.toLowerCase()))),[announcements,search])
 const filteredEvents=useMemo(()=>events.filter(row=>[row.title,row.event_type,row.audience,row.status].some(v=>String(v??'').toLowerCase().includes(search.toLowerCase()))),[events,search])

 function resetEnquiry(row?:Enquiry){
  setEditingId(row?.id??null);setStudentName(row?.student_name??'');setClassApplied(row?.class_applied_for??'')
  setGuardianName(row?.guardian_name??'');setGuardianPhone(row?.guardian_phone??'');setGuardianEmail(row?.guardian_email??'')
  setSource(row?.source??'Walk-in');setFollowUpDate(row?.follow_up_date??'');setEnquiryStatus(row?.status??'new')
  setEnquiryNotes(row?.notes??'');setShowForm(true)
 }
 function resetNotice(){setEditingId(null);setNoticeTitle('');setNoticeBody('');setNoticeAudience('all');setShowForm(true)}
 function resetEvent(row?:EventRow){
  setEditingId(row?.id??null);setEventTitle(row?.title??'');setEventType(row?.event_type??'event')
  setEventDescription(row?.description??'');setEventStart(row?.start_date??today());setEventEnd(row?.end_date??today())
  setEventAllDay(row?.all_day??true);setEventAudience(row?.audience??'all');setEventStatus(row?.status??'draft');setShowForm(true)
 }

 async function saveEnquiry(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user||!canManage)return
  if(!studentName.trim()||!classApplied.trim()||!guardianName.trim()||!guardianPhone.trim()){onToast('Complete the applicant, requested class and guardian contact fields.',true);return}
  setSaving(true)
  const values={student_name:studentName.trim(),class_applied_for:classApplied.trim(),guardian_name:guardianName.trim(),guardian_phone:guardianPhone.trim(),guardian_email:guardianEmail.trim()||null,source,follow_up_date:followUpDate||null,status:enquiryStatus,notes:enquiryNotes.trim()||null}
  try{
   const result=editingId
    ?await supabase.from('admission_enquiries').update(values).eq('id',editingId).eq('institution_id',user.institutionId)
    :await supabase.from('admission_enquiries').insert({...values,institution_id:user.institutionId,enquiry_no:enquiryNumber(),created_by:user.id})
   if(result.error)throw result.error
   setShowForm(false);setSelectedEnquiry(null);onToast(editingId?'Enquiry updated.':'Enquiry recorded.')
   await load()
  }catch{onToast('The enquiry was not saved. Check the required fields and your institution permissions.',true)}
  finally{setSaving(false)}
 }

 async function saveAnnouncement(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user||!canPublish)return
  if(!noticeTitle.trim()||!noticeBody.trim()){onToast('Enter a title and notice content before publishing.',true);return}
  setSaving(true)
  try{
   const values={title:noticeTitle.trim(),body:noticeBody.trim(),audience:noticeAudience,campus_id:null}
   const result=editingId
    ?await supabase.from('announcements').update(values).eq('id',editingId).eq('institution_id',user.institutionId)
    :await supabase.from('announcements').insert({...values,institution_id:user.institutionId,created_by:user.id})
   if(result.error)throw result.error
   setShowForm(false);onToast(editingId?'Notice updated.':'Notice published to the selected audience.')
   await load()
  }catch{onToast('The notice was not saved. Check your access and try again.',true)}
  finally{setSaving(false)}
 }

 async function saveEvent(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user||!canPublish)return
  if(!eventTitle.trim()||!eventStart||!eventEnd||eventEnd<eventStart){onToast('Enter an event title and a valid date range.',true);return}
  setSaving(true)
  try{
   const values={title:eventTitle.trim(),event_type:eventType,description:eventDescription.trim()||null,start_date:eventStart,end_date:eventEnd,all_day:eventAllDay,audience:eventAudience,status:eventStatus}
   const result=editingId
    ?await supabase.from('academic_calendar_events').update(values).eq('id',editingId).eq('institution_id',user.institutionId)
    :await supabase.from('academic_calendar_events').insert({...values,institution_id:user.institutionId,created_by:user.id})
   if(result.error)throw result.error
   setShowForm(false);onToast(editingId?'Event updated.':eventStatus==='published'?'Event published.':'Event saved as a draft.')
   await load()
  }catch{onToast('The calendar event was not saved. Check your access and dates.',true)}
  finally{setSaving(false)}
 }

 const activeLabel=viewOptions.find(item=>item.key===view)?.label??'Front Office'
 const rowsCount=view==='enquiries'?enquiries.length:view==='announcements'?announcements.length:events.length

 return <main className="ed360-front-office">
  <header className="ed360-front-office-hero"><div><span>STAGE 12 / COMMUNICATION & FRONT OFFICE</span><h1>Front Office & Communication</h1><p>Manage prospective-family enquiries, official notices and the institution calendar in their correct registers.</p></div><div className="ed360-front-office-count"><b>{rowsCount}</b><span>{activeLabel.toLowerCase()} records</span></div></header>
  <nav className="ed360-front-office-tabs" aria-label="Front office workspaces">
   {viewOptions.filter(item=>item.key!=='enquiries'||canManage).map(item=>{const Icon=item.icon;return <button type="button" key={item.key} className={view===item.key?'active':''} aria-current={view===item.key?'page':undefined} onClick={()=>{setView(item.key);setSearch('');setShowForm(false);setSelectedEnquiry(null)}}><Icon size={16}/><span>{item.label}</span></button>})}
  </nav>
  <section className="ed360-front-office-panel">
   <div className="ed360-front-office-toolbar"><div><h2>{activeLabel}</h2><p>{viewOptions.find(item=>item.key===view)?.description}</p></div><div className="ed360-front-office-actions"><label className="ed360-front-office-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={'Search '+activeLabel.toLowerCase()}/></label><button type="button" className="ed360-front-office-refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button>{((view==='enquiries'&&canManage)||(view!=='enquiries'&&canPublish))&&<button type="button" className="ed360-front-office-primary" onClick={()=>view==='enquiries'?resetEnquiry():view==='announcements'?resetNotice():resetEvent()}><Plus size={16}/>{view==='enquiries'?'Record Enquiry':view==='announcements'?'Publish Notice':'Add Event'}</button>}</div></div>
   {loadError&&<div className="ed360-front-office-error" role="alert">{loadError}<button type="button" onClick={()=>void load()}>Try again</button></div>}
   {loading?<div className="ed360-front-office-empty">Loading {activeLabel.toLowerCase()}…</div>:view==='enquiries'?<div className="ed360-front-office-table-wrap">{filteredEnquiries.length?<table><thead><tr><th>Enquiry No.</th><th>Applicant</th><th>Requested class</th><th>Guardian</th><th>Source</th><th>Follow-up</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredEnquiries.map(row=><tr key={row.id}><td><b>{row.enquiry_no}</b></td><td>{row.student_name}</td><td>{row.class_applied_for}</td><td>{row.guardian_name}<small>{row.guardian_phone}</small></td><td>{row.source}</td><td>{row.follow_up_date??'—'}</td><td><span className={'ed360-front-office-status state-'+row.status}>{titleCase(row.status)}</span></td><td><button type="button" onClick={()=>{setSelectedEnquiry(row);resetEnquiry(row)}}>Edit</button><button type="button" onClick={()=>setSelectedEnquiry(row)}>View</button></td></tr>)}</tbody></table>:<div className="ed360-front-office-empty"><b>No admission enquiries found</b><span>Record a new enquiry to start the admissions follow-up workflow.</span></div>}</div>
    :view==='announcements'?<div className="ed360-front-office-table-wrap">{filteredAnnouncements.length?<table><thead><tr><th>Notice</th><th>Audience</th><th>Published</th></tr></thead><tbody>{filteredAnnouncements.map(row=><tr key={row.id}><td><b>{row.title}</b><small>{row.body}</small></td><td>{titleCase(row.audience)}</td><td>{new Date(row.created_at).toLocaleDateString()}</td></tr>)}</tbody></table>:<div className="ed360-front-office-empty"><b>No notices have been published</b><span>Publish a notice for all users, students or parents when you are ready.</span></div>}</div>
    :<div className="ed360-front-office-table-wrap">{filteredEvents.length?<table><thead><tr><th>Event</th><th>Type</th><th>Dates</th><th>Audience</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredEvents.map(row=><tr key={row.id}><td><b>{row.title}</b><small>{row.description??''}</small></td><td>{titleCase(row.event_type)}</td><td>{row.start_date}{row.end_date!==row.start_date?' – '+row.end_date:''}</td><td>{titleCase(row.audience)}</td><td><span className={'ed360-front-office-status state-'+row.status}>{titleCase(row.status)}</span></td><td>{canPublish&&<button type="button" onClick={()=>resetEvent(row)}>Edit</button>}</td></tr>)}</tbody></table>:<div className="ed360-front-office-empty"><b>No calendar events found</b><span>Add an event, holiday, examination or institutional deadline.</span></div>}</div>}
  </section>
  {selectedEnquiry&&view==='enquiries'&&!showForm&&<aside className="ed360-front-office-detail"><button className="close" type="button" onClick={()=>setSelectedEnquiry(null)} aria-label="Close details"><X size={16}/></button><small>ENQUIRY DETAIL</small><h3>{selectedEnquiry.student_name}</h3><p>{selectedEnquiry.enquiry_no} · {selectedEnquiry.class_applied_for}</p><dl><div><dt>Guardian</dt><dd>{selectedEnquiry.guardian_name}</dd></div><div><dt>Phone</dt><dd>{selectedEnquiry.guardian_phone}</dd></div><div><dt>Email</dt><dd>{selectedEnquiry.guardian_email??'—'}</dd></div><div><dt>Notes</dt><dd>{selectedEnquiry.notes??'—'}</dd></div></dl><button type="button" className="ed360-front-office-primary" onClick={()=>resetEnquiry(selectedEnquiry)}>Edit enquiry</button></aside>}
  {showForm&&<div className="ed360-front-office-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShowForm(false)}}><section className="ed360-front-office-modal" role="dialog" aria-modal="true" aria-labelledby="ed360-front-office-form-title">
   <header><div><small>{activeLabel.toUpperCase()}</small><h2 id="ed360-front-office-form-title">{editingId?'Update':'Create'} {view==='enquiries'?'Enquiry':view==='announcements'?'Notice':'Calendar Event'}</h2></div><button type="button" onClick={()=>setShowForm(false)} aria-label="Close form"><X size={18}/></button></header>
   {view==='enquiries'?<form onSubmit={saveEnquiry}><div className="ed360-front-office-form-grid"><label>Applicant / student name *<input value={studentName} onChange={e=>setStudentName(e.target.value)} required maxLength={160}/></label><label>Class / program requested *<input value={classApplied} onChange={e=>setClassApplied(e.target.value)} required maxLength={120}/></label><label>Parent / guardian name *<input value={guardianName} onChange={e=>setGuardianName(e.target.value)} required maxLength={160}/></label><label>Guardian phone *<input value={guardianPhone} onChange={e=>setGuardianPhone(e.target.value)} required maxLength={40}/></label><label>Guardian email<input type="email" value={guardianEmail} onChange={e=>setGuardianEmail(e.target.value)} maxLength={200}/></label><label>Enquiry source<select value={source} onChange={e=>setSource(e.target.value)}><option>Walk-in</option><option>Phone</option><option>Website</option><option>Referral</option><option>Email</option><option>Other</option></select></label><label>Follow-up date<input type="date" value={followUpDate} onChange={e=>setFollowUpDate(e.target.value)}/></label><label>Enquiry status<select value={enquiryStatus} onChange={e=>setEnquiryStatus(e.target.value)}><option value="new">New</option><option value="contacted">Contacted</option><option value="scheduled">Meeting scheduled</option><option value="converted">Converted</option><option value="closed">Closed</option></select></label><label className="wide">Notes<textarea value={enquiryNotes} onChange={e=>setEnquiryNotes(e.target.value)} rows={3}/></label></div><footer><button type="button" onClick={()=>setShowForm(false)}>Cancel</button><button className="ed360-front-office-primary" type="submit" disabled={saving}>{saving?'Saving…':editingId?'Save changes':'Save enquiry'}</button></footer></form>
    :view==='announcements'?<form onSubmit={saveAnnouncement}><label>Notice title *<input value={noticeTitle} onChange={e=>setNoticeTitle(e.target.value)} required maxLength={180}/></label><label>Notice content *<textarea value={noticeBody} onChange={e=>setNoticeBody(e.target.value)} required rows={7} maxLength={12000}/></label><label>Target audience<select value={noticeAudience} onChange={e=>setNoticeAudience(e.target.value)}><option value="all">All institution members</option><option value="students">Students</option><option value="parents">Parents / guardians</option></select></label><p className="ed360-front-office-form-note">Publishing saves the notice to the institution announcements register. Users see it according to the database audience permissions.</p><footer><button type="button" onClick={()=>setShowForm(false)}>Cancel</button><button className="ed360-front-office-primary" type="submit" disabled={saving}>{saving?'Publishing…':'Publish notice'}</button></footer></form>
    :<form onSubmit={saveEvent}><label>Event title *<input value={eventTitle} onChange={e=>setEventTitle(e.target.value)} required maxLength={180}/></label><div className="ed360-front-office-form-grid"><label>Event type<select value={eventType} onChange={e=>setEventType(e.target.value)}><option value="event">Event</option><option value="holiday">Holiday</option><option value="examination">Examination</option><option value="assessment">Assessment</option><option value="milestone">Milestone</option><option value="deadline">Deadline</option><option value="meeting">Meeting</option><option value="other">Other</option></select></label><label>Audience<select value={eventAudience} onChange={e=>setEventAudience(e.target.value)}><option value="all">All institution</option><option value="staff">Staff</option><option value="students">Students</option><option value="parents">Parents</option><option value="students_and_parents">Students & parents</option></select></label><label>Start date *<input type="date" value={eventStart} onChange={e=>setEventStart(e.target.value)} required/></label><label>End date *<input type="date" value={eventEnd} onChange={e=>setEventEnd(e.target.value)} required min={eventStart}/></label><label className="wide">Description<textarea value={eventDescription} onChange={e=>setEventDescription(e.target.value)} rows={3}/></label><label>Publication status<select value={eventStatus} onChange={e=>setEventStatus(e.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="cancelled">Cancelled</option></select></label><label className="ed360-front-office-checkbox"><input type="checkbox" checked={eventAllDay} onChange={e=>setEventAllDay(e.target.checked)}/> All-day event</label></div><p className="ed360-front-office-form-note">Published events can be viewed by users included in the chosen audience. Draft events remain private.</p><footer><button type="button" onClick={()=>setShowForm(false)}>Cancel</button><button className="ed360-front-office-primary" type="submit" disabled={saving}>{saving?'Saving…':editingId?'Save changes':eventStatus==='published'?'Publish event':'Save event'}</button></footer></form>}
  </section></div>}
 </main>
}
