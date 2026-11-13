import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertCircle, CreditCard, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/data-management.css'

type Row=Record<string,any>&{id:string}
const label=(v:unknown)=>String(v??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const text=(row:Row,keys:string[],fallback='—')=>{for(const key of keys){const value=row[key];if(value!==undefined&&value!==null&&String(value)!=='')return String(value)}return fallback}
const amount=(row:Row)=>Number(row.amount??row.paid_amount??row.payment_amount??0)
const date=(row:Row)=>{const value=row.payment_date??row.paid_at??row.created_at;return value?new Date(String(value)).toLocaleString():'—'}
const paymentStatus=(row:Row)=>String(row.status??row.payment_status??'unknown').toLowerCase()
const isOnline=(row:Row)=>/online|gateway|card|wallet|bank|digital|stripe|jazzcash|easypaisa/i.test(text(row,['payment_method','method','channel','gateway'],''))
const titles:Record<string,string>={'online-payment-records':'Online Payment Records','failed-and-pending-payments':'Failed & Pending Payments'}
export function PaymentOperationsWorkspace({workspaceKey,onToast}:{workspaceKey:string;onToast:(message:string,error?:boolean)=>void}){
 const {user}=useAuth()
 const page=workspaceKey.split(':').slice(-1)[0]
 const finance=Boolean(user&&['owner','admin','accountant'].includes(user.role))
 const [payments,setPayments]=useState<Row[]>([])
 const [reviews,setReviews]=useState<Row[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [search,setSearch]=useState('')
 const [filter,setFilter]=useState('all')
 const [selected,setSelected]=useState<Row|null>(null)
 const [form,setForm]=useState({provider:'External provider',reference:'',status:'awaiting_provider',note:''})
 async function load(){
  if(!supabase||!user){setLoading(false);return}
  setLoading(true)
  try{
   const [p,r]=await Promise.all([
    supabase.from('fee_payments').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false}).limit(3000),
    supabase.from('payment_gateway_reviews').select('*').eq('institution_id',user.institutionId).order('reviewed_at',{ascending:false}).limit(3000)
   ])
   if(p.error)throw p.error;if(r.error)throw r.error
   setPayments((p.data??[]) as Row[]);setReviews((r.data??[]) as Row[])
  }catch(e){onToast(e instanceof Error?e.message:'Payment records could not be loaded.',true)}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[user?.id,user?.institutionId,user?.role])
 const reviewFor=(id:string)=>reviews.find(r=>r.payment_id===id)
 const relevant=payments.filter(p=>{
  const online=isOnline(p)
  const status=paymentStatus(p)
  return page==='failed-and-pending-payments'?online&&['pending','failed','failure','initiated','processing','awaiting','cancelled'].includes(status):online
 })
 const filtered=useMemo(()=>relevant.filter(p=>{
  const q=search.toLowerCase()
  const status=paymentStatus(p)
  return (filter==='all'||(filter==='pending'&&['pending','initiated','processing','awaiting'].includes(status))||(filter==='failed'&&['failed','failure','cancelled'].includes(status))||(filter==='success'&&['paid','success','completed','settled'].includes(status)))&&
   (!q||[p.student_name,p.invoice_number,p.transaction_reference,p.reference_number,p.payment_method,p.status,p.gateway].join(' ').toLowerCase().includes(q))
 }),[relevant,search,filter])
 async function saveReview(event:FormEvent){
  event.preventDefault();if(!supabase||!user||!finance||!selected)return
  setBusy(true)
  try{
   const {error}=await supabase.rpc('record_payment_gateway_review',{
    p_institution_id:user.institutionId,p_payment_id:selected.id,p_provider_name:form.provider,
    p_transaction_reference:form.reference,p_provider_status:form.status,p_evidence_note:form.note
   })
   if(error)throw error
   setSelected(null);setForm({provider:'External provider',reference:'',status:'awaiting_provider',note:''})
   await load();onToast('External payment review recorded. The original fee payment status was not changed.')
  }catch(e){onToast(e instanceof Error?e.message:'Payment review could not be saved.',true)}
  finally{setBusy(false)}
 }
 if(!user)return null
 if(!finance)return <main className="page-content ed360-module-page"><section className="ed360-workspace-empty">Finance role access is required to view payment gateway records.</section></main>
 return <main className="page-content ed360-module-page ed360-online-payment-workspace">
  <header className="ed360-workspace-hero"><div className="ed360-workspace-hero-icon"><CreditCard size={21}/></div><div className="ed360-workspace-hero-copy"><span>FEES & FINANCE / ONLINE PAYMENTS</span><h1>{titles[page]??'Online Payment Records'}</h1><p>Review institution fee payments submitted through online or digital payment methods. Provider review is recorded separately and never changes the original fee ledger automatically.</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Institution fee records</span><button type="button" className="button button-outline" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div></header>
  <section className="ed360-data-card"><div className="ed360-payment-provider-note"><AlertCircle size={18}/><span><b>Payment gateway status</b> No live checkout, provider webhook or automatic settlement is configured in this release. These pages show saved fee-payment records and let finance staff document external verification.</span></div>
   <div className="ed360-workspace-kpis"><article><span>Digital payments</span><strong>{payments.filter(isOnline).length}</strong><small>Detected from stored method/channel fields</small></article><article><span>Pending</span><strong>{payments.filter(p=>isOnline(p)&&['pending','initiated','processing','awaiting'].includes(paymentStatus(p))).length}</strong><small>Not recorded as settled</small></article><article><span>Failed</span><strong>{payments.filter(p=>isOnline(p)&&['failed','failure','cancelled'].includes(paymentStatus(p))).length}</strong><small>Requires external review</small></article><article><span>Reviewed</span><strong>{reviews.length}</strong><small>Manual provider review records</small></article></div>
   <div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student, invoice or provider reference…" aria-label="Search payment records"/><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="success">Successful</option></select></div>
   <div className="table-scroll"><table><thead><tr><th>Date</th><th>Student</th><th>Invoice</th><th>Method</th><th>Transaction reference</th><th>Amount</th><th>Fee status</th><th>Provider review</th><th>Action</th></tr></thead><tbody>{filtered.map(p=>{const review=reviewFor(p.id);return <tr key={p.id}><td>{date(p)}</td><td>{text(p,['student_name','payer_name'])}</td><td>{text(p,['invoice_number','invoice_no'])}</td><td>{label(text(p,['payment_method','method','channel','gateway']))}</td><td>{text(p,['transaction_reference','reference_number','gateway_reference'])}</td><td>{'PKR '+amount(p).toLocaleString(undefined,{maximumFractionDigits:2})}</td><td>{label(paymentStatus(p))}</td><td>{review?label(review.provider_status):'Not reviewed'}</td><td><button type="button" className="button button-outline" onClick={()=>{setSelected(p);setForm({provider:review?.provider_name??'External provider',reference:review?.transaction_reference??text(p,['transaction_reference','reference_number'],''),status:review?.provider_status??'awaiting_provider',note:review?.evidence_note??''})}}>Review</button></td></tr>})}</tbody></table></div>
   {filtered.length===0&&!loading&&<div className="ed360-workspace-empty">No online payment records match this view.</div>}
  </section>
  {selected&&<div className="ed360-data-card"><header><div><h2>External provider verification</h2><p>Payment ID {selected.id} · Fee status remains {label(paymentStatus(selected))} until the fee ledger is separately reconciled.</p></div><button type="button" className="button button-outline" onClick={()=>setSelected(null)}>Close</button></header><form className="ed360-data-form" onSubmit={saveReview}><label>Provider<input required value={form.provider} onChange={e=>setForm(x=>({...x,provider:e.target.value}))}/></label><label>Provider transaction reference<input value={form.reference} onChange={e=>setForm(x=>({...x,reference:e.target.value}))}/></label><label>External verification result<select value={form.status} onChange={e=>setForm(x=>({...x,status:e.target.value}))}><option value="awaiting_provider">Awaiting provider response</option><option value="verified_success">Verified successful externally</option><option value="verified_failed">Verified failed externally</option><option value="reference_mismatch">Reference mismatch</option></select></label><label>Evidence / verification notes<textarea required rows={4} value={form.note} onChange={e=>setForm(x=>({...x,note:e.target.value}))}/></label><button className="button button-primary" disabled={busy}>{busy?'Saving…':'Save provider review'}</button></form></div>}
 </main>
}
