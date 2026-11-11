import { useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck, FileCheck2, Plus, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/userErrors'
import type { RecordRow } from '../lib/types'

type Qualification = RecordRow & {id:string;teacher_id:string;qualification_name:string;awarding_institution:string;verification_status:string}
type Props = { employeeId:string; institutionId:string; canManage:boolean; onToast:(message:string,error?:boolean)=>void }

const emptyForm = {qualification_name:'',field_of_study:'',awarding_institution:'',date_awarded:'',expiry_date:'',grade_or_result:'',notes:''}
const dateLabel=(value:unknown)=>value?new Date(String(value).slice(0,10)+'T00:00:00').toLocaleDateString():'—'
const label=(value:unknown)=>String(value??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())

export function EmployeeQualificationsPanel({employeeId,institutionId,canManage,onToast}:Props){
 const [rows,setRows]=useState<Qualification[]>([])
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [open,setOpen]=useState(false)
 const [editing,setEditing]=useState<Qualification|null>(null)
 const [form,setForm]=useState(emptyForm)
 const [search,setSearch]=useState('')

 async function load(){
  if(!supabase||!employeeId||!institutionId){setRows([]);setLoading(false);return}
  setLoading(true)
  const {data,error}=await supabase.from('employee_qualifications').select('*').eq('institution_id',institutionId).eq('teacher_id',employeeId).order('date_awarded',{ascending:false})
  if(error)onToast(userFacingError(error,'Qualifications could not be loaded.'),true)
  else setRows((data??[]) as Qualification[])
  setLoading(false)
 }
 useEffect(()=>{void load()},[employeeId,institutionId])

 function startForm(row?:Qualification){
  setEditing(row??null)
  setForm(row?{
   qualification_name:String(row.qualification_name??''),field_of_study:String(row.field_of_study??''),
   awarding_institution:String(row.awarding_institution??''),date_awarded:String(row.date_awarded??'').slice(0,10),
   expiry_date:String(row.expiry_date??'').slice(0,10),grade_or_result:String(row.grade_or_result??''),notes:String(row.notes??''),
  }:{...emptyForm})
  setOpen(true)
 }
 async function save(event:FormEvent){
  event.preventDefault()
  if(!canManage||!supabase||!employeeId||!form.qualification_name.trim()||!form.awarding_institution.trim())return
  if(form.date_awarded&&form.expiry_date&&form.expiry_date<form.date_awarded){onToast('Expiry date cannot precede the date awarded.',true);return}
  setSaving(true)
  const payload={institution_id:institutionId,teacher_id:employeeId,qualification_name:form.qualification_name.trim(),
   field_of_study:form.field_of_study.trim()||null,awarding_institution:form.awarding_institution.trim(),
   date_awarded:form.date_awarded||null,expiry_date:form.expiry_date||null,grade_or_result:form.grade_or_result.trim()||null,
   notes:form.notes.trim()||null,updated_at:new Date().toISOString()}
  const result=editing
   ? await supabase.from('employee_qualifications').update(payload).eq('id',editing.id).eq('institution_id',institutionId)
   : await supabase.from('employee_qualifications').insert({...payload,created_by:(await supabase.auth.getUser()).data.user?.id})
  if(result.error)onToast(userFacingError(result.error,'The qualification record could not be saved.'),true)
  else{onToast(editing?'Qualification updated.':'Qualification registered.');setOpen(false);await load()}
  setSaving(false)
 }
 async function verify(row:Qualification,status:'verified'|'rejected'){
  if(!canManage||!supabase)return
  setSaving(true)
  const userId=(await supabase.auth.getUser()).data.user?.id??null
  const {error}=await supabase.from('employee_qualifications').update({
   verification_status:status,verified_by:status==='verified'?userId:null,verified_at:status==='verified'?new Date().toISOString():null,updated_at:new Date().toISOString()
  }).eq('id',row.id).eq('institution_id',institutionId)
  if(error)onToast(userFacingError(error,'Qualification verification could not be updated.'),true)
  else{onToast('Qualification marked '+label(status).toLowerCase()+'.');await load()}
  setSaving(false)
 }
 async function remove(row:Qualification){
  if(!canManage||!supabase||!window.confirm('Delete this qualification record?'))return
  setSaving(true)
  const {error}=await supabase.from('employee_qualifications').delete().eq('id',row.id).eq('institution_id',institutionId)
  if(error)onToast(userFacingError(error,'Qualification could not be deleted.'),true)
  else{onToast('Qualification record deleted.');await load()}
  setSaving(false)
 }
 const visible=rows.filter(row=>[row.qualification_name,row.field_of_study,row.awarding_institution,row.grade_or_result,row.verification_status].some(v=>String(v??'').toLowerCase().includes(search.trim().toLowerCase())))
 return <section className="staff-panel staff-full-panel">
  <header><div><h2>Qualifications & certificates</h2><p>Structured education credentials, professional certifications and verification history. Upload supporting files in the private Documents workspace.</p></div>{canManage&&<button type="button" className="staff-button staff-button-primary" onClick={()=>startForm()}><Plus size={14}/> Add qualification</button>}</header>
  <div className="staff-toolbar"><label><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search qualification, institution or status…"/></label><span className="staff-record-count">{visible.length} records</span></div>
  {loading?<div className="staff-empty"><RefreshCw className="spin" size={17}/> Loading qualifications…</div>:visible.length?<div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>Qualification</th><th>Field / specialisation</th><th>Awarding institution</th><th>Awarded</th><th>Expiry</th><th>Result</th><th>Verification</th>{canManage&&<th>Actions</th>}</tr></thead><tbody>{visible.map(row=><tr key={row.id}>
   <td><b>{row.qualification_name}</b></td><td>{String(row.field_of_study??'—')}</td><td>{row.awarding_institution}</td><td>{dateLabel(row.date_awarded)}</td><td>{dateLabel(row.expiry_date)}</td><td>{String(row.grade_or_result??'—')}</td>
   <td><span className={'staff-status staff-status-'+row.verification_status}>{label(row.verification_status)}</span></td>
   {canManage&&<td><div className="staff-row-actions"><button type="button" title="Edit" onClick={()=>startForm(row)}><FileCheck2 size={14}/></button>{row.verification_status!=='verified'&&<button type="button" title="Verify" disabled={saving} onClick={()=>void verify(row,'verified')}><BadgeCheck size={14}/></button>}{row.verification_status!=='rejected'&&<button type="button" title="Reject" disabled={saving} onClick={()=>void verify(row,'rejected')}><ShieldCheck size={14}/></button>}<button type="button" title="Delete" className="staff-action-danger" disabled={saving} onClick={()=>void remove(row)}><Trash2 size={14}/></button></div></td>}
  </tr>)}</tbody></table></div>:<div className="staff-empty"><span><FileCheck2 size={21}/></span><strong>No qualification records yet</strong><p>{canManage?'Add the employee’s academic and professional qualifications. Use the private Documents window to attach proof.':'Your recorded qualifications will appear here after an administrator adds them.'}</p></div>}
  {!canManage&&<div className="people-hr-inline-note"><ShieldCheck size={15}/> Employees can view their own qualification records. Only the institution owner or authorised administrator can add, edit or verify credentials.</div>}
  {open&&<div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="qualification-form-title">
   <div className="modal-heading"><div><div className="eyebrow">EMPLOYEE RECORD</div><h2 id="qualification-form-title">{editing?'Edit':'Add'} qualification</h2><p>Record the awarded credential and its verification status.</p></div><button type="button" className="icon-button" onClick={()=>setOpen(false)} aria-label="Close"><X size={18}/></button></div>
   <form className="staff-dialog-form" onSubmit={save}>
    <label>Qualification / certificate title *<input required value={form.qualification_name} onChange={e=>setForm(v=>({...v,qualification_name:e.target.value}))} placeholder="Bachelor of Education"/></label>
    <label>Field of study / specialisation<input value={form.field_of_study} onChange={e=>setForm(v=>({...v,field_of_study:e.target.value}))}/></label>
    <label>Awarding institution *<input required value={form.awarding_institution} onChange={e=>setForm(v=>({...v,awarding_institution:e.target.value}))}/></label>
    <div className="staff-dialog-row"><label>Date awarded<input type="date" value={form.date_awarded} onChange={e=>setForm(v=>({...v,date_awarded:e.target.value}))}/></label><label>Expiry date<input type="date" min={form.date_awarded||undefined} value={form.expiry_date} onChange={e=>setForm(v=>({...v,expiry_date:e.target.value}))}/></label></div>
    <label>Grade / result<input value={form.grade_or_result} onChange={e=>setForm(v=>({...v,grade_or_result:e.target.value}))}/></label>
    <label>Notes<textarea rows={3} value={form.notes} onChange={e=>setForm(v=>({...v,notes:e.target.value}))}/></label>
    <div className="modal-actions"><button type="button" className="staff-button staff-button-outline" onClick={()=>setOpen(false)}>Cancel</button><button type="submit" className="staff-button staff-button-primary" disabled={saving}>{saving?'Saving…':'Save qualification'}</button></div>
   </form>
  </section></div>}
 </section>
}
