import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpen, CalendarDays, Download, GraduationCap, History, Printer, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/data-management.css'

type Row=Record<string,any>&{id:string}
const titles:Record<string,string>={'reading-records':'Reading Records','reading-cards':'Student Reading Cards','student-reading-history':'Student Reading History'}
const notes:Record<string,string>={
 'reading-records':'Log a student reading session against an active institution library loan, including pages, duration, progress and reflection.',
 'reading-cards':'Print a student library card from the existing student profile and current or previous library loans.',
 'student-reading-history':'Combine circulation issue/return history with logged student reading progress.'
}
const date=(v:unknown)=>v?new Date(String(v)).toLocaleDateString():'—'
const datetime=(v:unknown)=>v?new Date(String(v)).toLocaleString():'—'
const label=(v:unknown)=>String(v??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
function getBook(row:Row){return row.book_title??row.title??row.book_name??row.book_record_id??row.book_id??'Library book'}
function getLoanDate(row:Row){return row.issued_at??row.issue_date??row.loan_date??row.created_at}
function getReturnDate(row:Row){return row.returned_at??row.return_date??row.actual_return_date}
function getLoanStatus(row:Row){return row.status??(getReturnDate(row)?'returned':'issued')}
export function LibraryReadingWorkspace({workspaceKey,onToast}:{workspaceKey:string;onToast:(message:string,error?:boolean)=>void}){
 const {user}=useAuth()
 const page=workspaceKey.split(':').slice(-1)[0]
 const staff=Boolean(user&&['owner','admin','teacher','librarian'].includes(user.role))
 const [students,setStudents]=useState<Row[]>([])
 const [loans,setLoans]=useState<Row[]>([])
 const [reading,setReading]=useState<Row[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [search,setSearch]=useState('')
 const [selectedStudent,setSelectedStudent]=useState('')
 const [form,setForm]=useState<Record<string,string>>({reading_date:new Date().toISOString().slice(0,10),status:'in_progress'})
 async function load(){
  if(!supabase||!user){setLoading(false);return}
  setLoading(true)
  try{
   const [st,ln,rr]=await Promise.all([
    supabase.from('students').select('*').eq('institution_id',user.institutionId).order('full_name'),
    supabase.from('library_loans').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false}).limit(2000),
    supabase.from('library_reading_records').select('*').eq('institution_id',user.institutionId).order('reading_date',{ascending:false}).limit(2000)
   ])
   for(const x of [st,ln,rr])if(x.error)throw x.error
   setStudents((st.data??[]) as Row[]);setLoans((ln.data??[]) as Row[]);setReading((rr.data??[]) as Row[])
  }catch(e){onToast(e instanceof Error?e.message:'Library records could not be loaded.',true)}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[user?.id,user?.institutionId,user?.role])
 const studentFor=(id:string)=>students.find(s=>s.id===id)
 const loansFor=(id:string)=>loans.filter(l=>String(l.student_id??'')===id)
 const selectedLoans=useMemo(()=>selectedStudent?loansFor(selectedStudent):loans,[selectedStudent,loans,students])
 const visibleReading=reading.filter(r=>{
  const student=studentFor(String(r.student_id))
  return !search||[student?.full_name,student?.admission_no,r.book_title,r.notes,r.status].some(x=>String(x??'').toLowerCase().includes(search.toLowerCase()))
 })
 const visibleStudents=students.filter(s=>!search||[s.full_name,s.admission_no,s.class_name,s.section].some(x=>String(x??'').toLowerCase().includes(search.toLowerCase())))
 async function addReading(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user||!staff)return
  const student=studentFor(form.student_id)
  const loan=loans.find(x=>x.id===form.library_loan_id&&String(x.student_id)===form.student_id)
  if(!student){onToast('Select a valid student.',true);return}
  if(form.library_loan_id&&!loan){onToast('The selected loan does not belong to that student.',true);return}
  const title=String(loan?getBook(loan):form.book_title??'').trim()
  if(!title){onToast('Enter a book title or select a current/past loan.',true);return}
  setBusy(true)
  try{
   const {error}=await supabase.from('library_reading_records').insert({
    institution_id:user.institutionId,student_id:student.id,library_loan_id:loan?.id??null,
    book_title:title,reading_date:form.reading_date,pages_read:Number(form.pages_read||0),
    reading_minutes:Number(form.reading_minutes||0),progress_percent:form.progress_percent===''?null:Number(form.progress_percent),
    rating:form.rating===''?null:Number(form.rating),status:form.status,notes:form.notes||null,recorded_by:user.id
   })
   if(error)throw error
   onToast('Student reading session saved.')
   setForm({reading_date:new Date().toISOString().slice(0,10),status:'in_progress',student_id:form.student_id})
   await load()
  }catch(e){onToast(e instanceof Error?e.message:'Reading session could not be saved.',true)}
  finally{setBusy(false)}
 }
 const field=(name:string,labelText:string,type='text',required=true)=><label className="ed360-library-field">{labelText}<input type={type} required={required} value={form[name]??''} onChange={e=>setForm(v=>({...v,[name]:e.target.value}))}/></label>
 if(!user)return null
 return <main className="page-content ed360-module-page ed360-library-reading">
  <header className="ed360-workspace-hero"><div className="ed360-workspace-hero-icon"><BookOpen size={21}/></div><div className="ed360-workspace-hero-copy"><span>LIBRARY / READING & CIRCULATION</span><h1>{titles[page]??'Library Reading Workspace'}</h1><p>{notes[page]??'Student library reading activity and circulation.'}</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Institution records</span><button className="button button-outline" type="button" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div></header>
  {page==='reading-records'&&<section className="ed360-data-card"><header><h2>Record a reading session</h2><p>Reading entries can be linked to a library loan or recorded as an independent reading activity.</p></header>{staff&&<form className="ed360-data-form" onSubmit={addReading}>
   <label>Student<select required value={form.student_id??''} onChange={e=>setForm(v=>({...v,student_id:e.target.value,library_loan_id:''}))}><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{s.full_name} · {s.admission_no??'No admission ID'}</option>)}</select></label>
   <label>Related library loan (optional)<select value={form.library_loan_id??''} onChange={e=>setForm(v=>({...v,library_loan_id:e.target.value}))}><option value="">Independent reading</option>{selectedLoans.map(l=><option key={l.id} value={l.id}>{getBook(l)} · {label(getLoanStatus(l))} · {date(getLoanDate(l))}</option>)}</select></label>
   {field('book_title','Book title')}
   {field('reading_date','Reading date','date')}
   {field('pages_read','Pages read','number',false)}
   {field('reading_minutes','Reading duration (minutes)','number',false)}
   {field('progress_percent','Progress (%)','number',false)}
   {field('rating','Reading rating (1–5)','number',false)}
   <label>Status<select value={form.status??'in_progress'} onChange={e=>setForm(v=>({...v,status:e.target.value}))}><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="paused">Paused</option></select></label>
   <label className="ed360-library-wide">Reflection / teacher notes<textarea rows={3} value={form.notes??''} onChange={e=>setForm(v=>({...v,notes:e.target.value}))}/></label>
   <button className="button button-primary" disabled={busy}>{busy?'Saving…':'Save reading session'}</button>
  </form>}</section>}
  {page==='reading-cards'&&<section className="ed360-data-card"><header><h2>Student reading cards</h2><p>Each card is generated from the current student profile and real library circulation entries.</p><button className="button button-outline" type="button" onClick={()=>window.print()}><Printer size={15}/> Print cards</button></header><div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search students…" aria-label="Search student cards"/></div><div className="ed360-library-card-grid">{visibleStudents.map(student=>{const bookLoans=loansFor(student.id);const active=bookLoans.filter(l=>!getReturnDate(l)&&!['returned','closed'].includes(String(getLoanStatus(l))));return <article className="ed360-library-card" key={student.id}><div className="ed360-library-card-head"><span>EDUSPHERE 360 / LIBRARY</span><BookOpen size={18}/></div><h3>{student.full_name}</h3><p>{student.admission_no??'Student ID pending'} · {student.class_name??'Class not assigned'} {student.section??''}</p><strong>Reader ID: {student.library_card_number??student.admission_no??student.id.slice(0,8).toUpperCase()}</strong><div><b>{active.length}</b> active loan(s) · <b>{bookLoans.length}</b> historical loan(s)</div><small>Institution-issued reading card · Use with the institution library register</small></article>})}</div></section>}
  {page==='student-reading-history'&&<section className="ed360-data-card"><header><h2>Student reading and circulation history</h2><p>Reading sessions and issue/return activity are shown together; a reading session is not counted as a book loan.</p></header><div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by student or title…" aria-label="Search history"/></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Student</th><th>Book</th><th>Activity</th><th>Pages / status</th><th>Duration / due</th><th>Notes</th></tr></thead><tbody>
   {visibleReading.map(r=><tr key={'reading-'+r.id}><td>{date(r.reading_date)}</td><td>{studentFor(String(r.student_id))?.full_name??'Student'}</td><td>{r.book_title}</td><td>Reading session</td><td>{r.pages_read} pages · {label(r.status)}</td><td>{r.reading_minutes} min</td><td>{r.notes??'—'}</td></tr>)}
   {loans.filter(l=>!search||[studentFor(String(l.student_id))?.full_name,getBook(l)].join(' ').toLowerCase().includes(search.toLowerCase())).map(l=><tr key={'loan-'+l.id}><td>{date(getLoanDate(l))}</td><td>{studentFor(String(l.student_id))?.full_name??'Student'}</td><td>{String(getBook(l))}</td><td>Library loan / {getReturnDate(l)?'return':'issue'}</td><td>{label(getLoanStatus(l))}</td><td>Due {date(l.due_date)}</td><td>{l.notes??'—'}</td></tr>)}
  </tbody></table>{visibleReading.length===0&&loans.length===0&&<div className="ed360-workspace-empty">No reading sessions or library loans have been recorded.</div>}</div></section>}
 </main>
}
