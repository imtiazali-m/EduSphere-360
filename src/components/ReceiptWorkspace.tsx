import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, FileText, Printer, Receipt, RefreshCw, Settings2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { createRecord, listRecords } from '../lib/data'
import '../styles/data-management.css'

type Row=Record<string,any>&{id:string}
type ReceiptRow={id:string;institution_id:string;payment_id:string;receipt_number:string;template_key:string;payment_snapshot:Record<string,unknown>;issued_at:string;issued_by:string}
const titles:Record<string,string>={'receipt-templates':'Receipt Templates','receipt-numbering':'Receipt Numbering','bulk-receipt-generation':'Bulk Receipt Generation','receipt-verification':'Receipt Verification'}
const labels:Record<string,string>={'receipt-templates':'Manage print layouts and institution receipt text.','receipt-numbering':'Configure the institution prefix and next sequence number.','bulk-receipt-generation':'Issue and print receipts for selected recorded fee payments.','receipt-verification':'Verify a receipt number against the immutable issuance ledger.'}
const money=(v:unknown)=>'PKR '+Number(v??0).toLocaleString(undefined,{maximumFractionDigits:2})
const val=(row:Record<string,unknown>,keys:string[],fallback='—')=>{for(const k of keys){const v=row[k];if(v!==undefined&&v!==null&&String(v)!=='')return String(v)}return fallback}
const when=(v:unknown)=>v?new Date(String(v)).toLocaleString():'—'
function printable(row:ReceiptRow,template?:Row){
 const snapshot=row.payment_snapshot??{}
 return {receipt:row.receipt_number,student:val(snapshot,['student_name','student_full_name','payer_name']),studentId:val(snapshot,['admission_no','student_admission_no']),paymentDate:val(snapshot,['payment_date','paid_at','created_at']),invoice:val(snapshot,['invoice_number','invoice_no']),amount:val(snapshot,['amount','paid_amount','payment_amount'],'0'),method:val(snapshot,['payment_method','method']),reference:val(snapshot,['transaction_reference','reference_number','transaction_id']),templateTitle:String(template?.title??'Official fee receipt')}
}
export function ReceiptWorkspace({workspaceKey,onToast}:{workspaceKey:string;onToast:(message:string,error?:boolean)=>void}){
 const {user,mode}=useAuth()
 const page=workspaceKey.split(':').slice(-1)[0]
 const admin=Boolean(user&&['owner','admin'].includes(user.role))
 const finance=Boolean(user&&['owner','admin','accountant'].includes(user.role))
 const [payments,setPayments]=useState<Row[]>([])
 const [receipts,setReceipts]=useState<ReceiptRow[]>([])
 const [templates,setTemplates]=useState<Row[]>([])
 const [sequence,setSequence]=useState({prefix:'RCPT',next_number:'1'})
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [search,setSearch]=useState('')
 const [selected,setSelected]=useState<string[]>([])
 const [verifyCode,setVerifyCode]=useState('')
 const [templateForm,setTemplateForm]=useState({name:'',heading:'Fee Receipt',footer:'Thank you for your payment.',showSignature:'true'})
 const [selectedTemplate,setSelectedTemplate]=useState('default')
 const [verified,setVerified]=useState<ReceiptRow|null>(null)
 async function load(){
  if(!supabase||!user){setLoading(false);return}
  setLoading(true)
  try{
   const [p,r,s,t]=await Promise.all([
    supabase.from('fee_payments').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false}).limit(2000),
    supabase.from('fee_receipt_ledger').select('*').eq('institution_id',user.institutionId).order('issued_at',{ascending:false}).limit(2000),
    supabase.from('fee_receipt_sequences').select('*').eq('institution_id',user.institutionId).maybeSingle(),
    listRecords(mode,user,'institutional_records') as Promise<Row[]>
   ])
   if(p.error)throw p.error;if(r.error)throw r.error;if(s.error)throw s.error
   setPayments((p.data??[]) as Row[])
   setReceipts((r.data??[]) as ReceiptRow[])
   if(s.data)setSequence({prefix:String(s.data.prefix),next_number:String(s.data.next_number)})
   setTemplates(t.filter(x=>x.module_key==='receipts'&&x.record_type==='receipt-template'))
  }catch(e){onToast(e instanceof Error?e.message:'Receipt records could not be loaded.',true)}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[user?.id,user?.institutionId,user?.role])
 const receiptsByPayment=new Map(receipts.map(r=>[r.payment_id,r]))
 const eligiblePayments=payments.filter(p=>!receiptsByPayment.has(p.id)&&!['void','cancelled','failed'].includes(String(p.status??'').toLowerCase()))
 const visibleReceipts=receipts.filter(r=>[r.receipt_number,r.payment_snapshot?.student_name,r.payment_snapshot?.invoice_number,r.payment_snapshot?.transaction_reference].join(' ').toLowerCase().includes(search.toLowerCase()))
 const visiblePayments=eligiblePayments.filter(p=>!search||[p.student_name,p.invoice_number,p.receipt_number,p.transaction_reference,p.payment_method,p.status].join(' ').toLowerCase().includes(search.toLowerCase()))
 const activeTemplate=templates.find(t=>t.id===selectedTemplate)
 async function saveTemplate(event:FormEvent){
  event.preventDefault();if(!user||!admin)return
  setBusy(true)
  try{
   await createRecord(mode,user,'institutional_records',{module_key:'receipts',record_type:'receipt-template',title:templateForm.name.trim(),description:'Institution fee receipt layout',status:'active',approval_status:'not_required',visibility:'staff_only',record_date:new Date().toISOString().slice(0,10),payload:{heading:templateForm.heading,footer:templateForm.footer,show_signature:templateForm.showSignature==='true'}})
   onToast('Receipt template saved.');setTemplateForm({name:'',heading:'Fee Receipt',footer:'Thank you for your payment.',showSignature:'true'});await load()
  }catch(e){onToast(e instanceof Error?e.message:'Receipt template could not be saved.',true)}
  finally{setBusy(false)}
 }
 async function saveSequence(event:FormEvent){
  event.preventDefault();if(!user||!admin)return
  setBusy(true)
  try{
   const {data,error}=await supabase!.rpc('set_fee_receipt_sequence',{p_institution_id:user.institutionId,p_prefix:sequence.prefix,p_next_number:Number(sequence.next_number)})
   if(error)throw error
   setSequence({prefix:String(data.prefix),next_number:String(data.next_number)})
   onToast('Institution receipt sequence saved.')
  }catch(e){onToast(e instanceof Error?e.message:'Receipt numbering could not be saved.',true)}
  finally{setBusy(false)}
 }
 async function issueSelected(){
  if(!user||!finance||!selected.length)return
  setBusy(true)
  try{
   const {data,error}=await supabase!.rpc('issue_fee_receipts_bulk',{p_institution_id:user.institutionId,p_payment_ids:selected,p_template_key:selectedTemplate})
   if(error)throw error
   const issued=(data??[]) as ReceiptRow[]
   setSelected([]);await load()
   onToast(issued.length+' receipt(s) issued from recorded fee payments.')
  }catch(e){onToast(e instanceof Error?e.message:'Receipts could not be issued.',true)}
  finally{setBusy(false)}
 }
 async function issueOne(paymentId:string){
  if(!user||!finance)return
  setBusy(true)
  try{
   const {error}=await supabase!.rpc('issue_fee_receipt',{p_institution_id:user.institutionId,p_payment_id:paymentId,p_template_key:selectedTemplate})
   if(error)throw error
   await load();onToast('Receipt issued.')
  }catch(e){onToast(e instanceof Error?e.message:'Receipt could not be issued.',true)}
  finally{setBusy(false)}
 }
 function toggle(id:string,checked:boolean){setSelected(current=>checked?[...current,id]:current.filter(x=>x!==id))}
 function printReceipt(row:ReceiptRow){
  const info=printable(row,templates.find(t=>t.record_type==='receipt-template'&&(t.id===row.template_key||t.title===row.template_key)))
  const container=document.getElementById('ed360-print-receipt')
  if(!container)return
  container.innerHTML=''
  const card=document.createElement('article')
  card.className='ed360-print-receipt-card'
  const add=(tag:string,text:string)=>{const el=document.createElement(tag);el.textContent=text;card.appendChild(el)}
  add('h1',info.templateTitle);add('h2',info.receipt)
  add('p','Student: '+info.student);add('p','Admission ID: '+info.studentId)
  add('p','Invoice: '+info.invoice);add('p','Payment date: '+info.paymentDate)
  add('p','Payment method: '+info.method);add('p','Reference: '+info.reference)
  add('h2','Amount received: '+money(info.amount))
  container.appendChild(card);window.print()
 }
 function verifyReceipt(event:FormEvent){
  event.preventDefault()
  const found=receipts.find(r=>r.receipt_number.toLowerCase()===verifyCode.trim().toLowerCase())??null
  setVerified(found)
 }
 if(!user)return null
 if(!finance)return <main className="page-content ed360-module-page"><section className="ed360-workspace-empty">Finance access is required to view or issue official receipts.</section></main>
 return <main className="page-content ed360-module-page ed360-receipt-workspace">
  <header className="ed360-workspace-hero"><div className="ed360-workspace-hero-icon"><Receipt size={21}/></div><div className="ed360-workspace-hero-copy"><span>FEES & FINANCE / RECEIPTS</span><h1>{titles[page]??'Receipts'}</h1><p>{labels[page]??'Issue and verify fee receipts.'}</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Official institution receipt ledger</span><button type="button" className="button button-outline" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div></header>
  {page==='receipt-templates'&&<section className="ed360-data-card"><header><h2>Receipt layout templates</h2><p>Templates control the receipt heading and footer. Issued receipts retain the template key used at issuance.</p></header>{admin&&<form className="ed360-data-form" onSubmit={saveTemplate}><label>Template name<input required value={templateForm.name} onChange={e=>setTemplateForm(x=>({...x,name:e.target.value}))}/></label><label>Receipt heading<input value={templateForm.heading} onChange={e=>setTemplateForm(x=>({...x,heading:e.target.value}))}/></label><label>Footer text<input value={templateForm.footer} onChange={e=>setTemplateForm(x=>({...x,footer:e.target.value}))}/></label><label>Show signature line<select value={templateForm.showSignature} onChange={e=>setTemplateForm(x=>({...x,showSignature:e.target.value}))}><option value="true">Yes</option><option value="false">No</option></select></label><button className="button button-primary" disabled={busy}>Save template</button></form>}<div className="table-scroll"><table><thead><tr><th>Template</th><th>Heading</th><th>Footer</th><th>Status</th></tr></thead><tbody>{templates.map(t=><tr key={t.id}><td>{t.title}</td><td>{String(t.payload?.heading??'Fee Receipt')}</td><td>{String(t.payload?.footer??'')}</td><td>{t.status}</td></tr>)}</tbody></table></div></section>}
  {page==='receipt-numbering'&&<section className="ed360-data-card"><header><h2>Institution receipt sequence</h2><p>Numbering is assigned atomically by the database when a receipt is issued. Existing numbers are never re-used.</p></header>{admin?<form className="ed360-data-form" onSubmit={saveSequence}><label>Prefix<input required maxLength={12} value={sequence.prefix} onChange={e=>setSequence(x=>({...x,prefix:e.target.value.toUpperCase()}))}/></label><label>Next serial number<input required type="number" min="1" value={sequence.next_number} onChange={e=>setSequence(x=>({...x,next_number:e.target.value}))}/></label><button className="button button-primary" disabled={busy}><Settings2 size={15}/> Save numbering</button></form>:<p>Receipt numbering is controlled by your institution administrator.</p>}<p>Current preview: <b>{sequence.prefix}-{String(Math.max(1,Number(sequence.next_number))).padStart(6,'0')}</b></p></section>}
  {page==='bulk-receipt-generation'&&<section className="ed360-data-card"><header><h2>Batch receipt issuance</h2><p>Select recorded payments. Issuing a receipt does not create a new payment or change its paid state.</p></header><label>Receipt template<select value={selectedTemplate} onChange={e=>setSelectedTemplate(e.target.value)}><option value="default">Default</option>{templates.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label><div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search payments…" aria-label="Search fee payments"/><span>{selected.length} selected / {visiblePayments.length} visible</span></div><div className="table-scroll"><table><thead><tr><th><input type="checkbox" aria-label="Select all visible payments" checked={visiblePayments.length>0&&visiblePayments.every(p=>selected.includes(p.id))} onChange={e=>setSelected(current=>e.target.checked?[...new Set([...current,...visiblePayments.map(p=>p.id)])]:current.filter(id=>!visiblePayments.some(p=>p.id===id)))}/></th><th>Student</th><th>Invoice</th><th>Paid date</th><th>Amount</th><th>Payment ref</th><th>Action</th></tr></thead><tbody>{visiblePayments.map(p=><tr key={p.id}><td><input type="checkbox" checked={selected.includes(p.id)} onChange={e=>toggle(p.id,e.target.checked)}/></td><td>{val(p,['student_name','payer_name'])}</td><td>{val(p,['invoice_number','invoice_no'])}</td><td>{when(p.payment_date??p.paid_at??p.created_at)}</td><td>{money(p.amount??p.paid_amount)}</td><td>{val(p,['transaction_reference','reference_number'])}</td><td><button type="button" className="button button-outline" disabled={busy} onClick={()=>void issueOne(p.id)}>Issue</button></td></tr>)}</tbody></table></div><button type="button" className="button button-primary" disabled={busy||selected.length===0} onClick={()=>void issueSelected()}>Issue {selected.length} selected receipt(s)</button></section>}
  {page==='receipt-verification'&&<section className="ed360-data-card"><header><h2>Receipt verification</h2><p>Verification checks the institution’s receipt issuance ledger, not a manually entered receipt number in a fee record.</p></header><form className="ed360-data-form" onSubmit={verifyReceipt}><label>Receipt number<input required value={verifyCode} onChange={e=>{setVerifyCode(e.target.value);setVerified(null)}} placeholder="RCPT-000001"/></label><button className="button button-primary">Verify receipt</button></form>{verified?<div className="ed360-receipt-verification"><CheckCircle2 size={18}/><div><b>Verified receipt</b><p>{verified.receipt_number} · Issued {when(verified.issued_at)}</p><p>Payment ID: {verified.payment_id}</p><p>Amount: {money(verified.payment_snapshot.amount??verified.payment_snapshot.paid_amount)}</p></div><button className="button button-outline" type="button" onClick={()=>printReceipt(verified)}><Printer size={14}/> Print</button></div>:verifyCode&&<p>No matching receipt found in this institution’s receipt ledger.</p>}</section>}
  <section className="ed360-data-card"><header><h2>Issued receipt register</h2><p>Each receipt is linked to one recorded fee payment.</p></header><div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search receipt register…" aria-label="Search receipts"/></div><div className="table-scroll"><table><thead><tr><th>Receipt no.</th><th>Student</th><th>Invoice</th><th>Amount</th><th>Issued</th><th>Action</th></tr></thead><tbody>{visibleReceipts.map(r=><tr key={r.id}><td><b>{r.receipt_number}</b></td><td>{val(r.payment_snapshot,['student_name','payer_name'])}</td><td>{val(r.payment_snapshot,['invoice_number','invoice_no'])}</td><td>{money(r.payment_snapshot.amount??r.payment_snapshot.paid_amount)}</td><td>{when(r.issued_at)}</td><td><button className="button button-outline" type="button" onClick={()=>printReceipt(r)}><Printer size={14}/> Print</button></td></tr>)}</tbody></table></div></section>
  <div id="ed360-print-receipt" className="ed360-print-receipt-root"/>
 </main>
}
