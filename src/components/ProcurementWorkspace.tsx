import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ClipboardCheck, FileText, Package, RefreshCw, Send, Truck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/data-management.css'

type Row=Record<string,any>&{id:string}
type Item={id:string;title:string;reference_code:string|null;quantity:number|null;payload:Record<string,unknown>}
const titles:Record<string,string>={
 'supplier-directory':'Supplier Directory','suppliers':'Supplier Directory','purchase-records':'Purchase Order Records',
 'purchase-requests':'Purchase Requests','quotation-comparison':'Quotation Comparison','purchase-approvals':'Purchase Approvals',
 'purchase-orders':'Purchase Orders','goods-receipt':'Goods Receipt','supplier-invoices':'Supplier Invoices','procurement-reports':'Procurement Reports'
}
const descriptions:Record<string,string>={
 'supplier-directory':'Maintain approved supplier details and trading status for this institution.',
 'suppliers':'Maintain approved supplier details and trading status for this institution.',
 'purchase-records':'Review purchase orders, receiving progress and supplier costs.',
 'purchase-requests':'Raise, itemise and submit purchase requests for approval.',
 'quotation-comparison':'Capture supplier quotations against approved requests and compare totals before selection.',
 'purchase-approvals':'Review submitted purchase requests and approve or reject draft purchase orders.',
 'purchase-orders':'Create orders from approved requests, add inventory lines and approve the order.',
 'goods-receipt':'Record actual deliveries and post received quantities into the existing inventory stock ledger.',
 'supplier-invoices':'Record supplier invoices and review their approval status. This does not trigger a bank payment.',
 'procurement-reports':'Review request pipeline, supplier spend, purchase orders, receipts and invoices.'
}
const date=(v:unknown)=>v?new Date(String(v)).toLocaleDateString():'—'
const money=(v:unknown)=>'PKR '+Number(v??0).toLocaleString(undefined,{maximumFractionDigits:2})
const label=(v:unknown)=>String(v??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
export function ProcurementWorkspace({workspaceKey,onToast}:{workspaceKey:string;onToast:(message:string,error?:boolean)=>void}){
 const {user}=useAuth()
 const page=workspaceKey.split(':').slice(-1)[0]
 const title=titles[page]??'Procurement'
 const ownerAdmin=Boolean(user&&['owner','admin'].includes(user.role))
 const financeAccess=Boolean(user&&['owner','admin','accountant'].includes(user.role))
 const canRequest=Boolean(user&&['owner','admin','accountant','teacher'].includes(user.role))
 const [suppliers,setSuppliers]=useState<Row[]>([])
 const [requests,setRequests]=useState<Row[]>([])
 const [requestItems,setRequestItems]=useState<Row[]>([])
 const [quotes,setQuotes]=useState<Row[]>([])
 const [orders,setOrders]=useState<Row[]>([])
 const [orderItems,setOrderItems]=useState<Row[]>([])
 const [receipts,setReceipts]=useState<Row[]>([])
 const [receiptItems,setReceiptItems]=useState<Row[]>([])
 const [invoices,setInvoices]=useState<Row[]>([])
 const [inventoryItems,setInventoryItems]=useState<Item[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [search,setSearch]=useState('')
 const [activeRequest,setActiveRequest]=useState('')
 const [activeOrder,setActiveOrder]=useState('')
 const [activeReceipt,setActiveReceipt]=useState('')
 const [form,setForm]=useState<Record<string,string>>({})
 const [line,setLine]=useState<Record<string,string>>({})
 const [quoteForm,setQuoteForm]=useState<Record<string,string>>({})
 const [orderForm,setOrderForm]=useState<Record<string,string>>({})
 const [receiptForm,setReceiptForm]=useState<Record<string,string>>({})
 const [receiptLine,setReceiptLine]=useState<Record<string,string>>({})
 const [invoiceForm,setInvoiceForm]=useState<Record<string,string>>({})
 const [supplierForm,setSupplierForm]=useState<Record<string,string>>({})
 const [requestFilter,setRequestFilter]=useState('all')
 async function load(){
  if(!supabase||!user){setLoading(false);setError('The cloud database is not available.');return}
  setLoading(true);setError('')
  try{
   const [req,reqLines,inventory]=await Promise.all([
    supabase.from('procurement_requests').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false}).limit(1000),
    supabase.from('procurement_request_items').select('*').eq('institution_id',user.institutionId).order('created_at'),
    supabase.from('institutional_records').select('id,title,reference_code,quantity,payload').eq('institution_id',user.institutionId).eq('module_key','inventory').in('record_type',['items-management','item-catalogue']).order('title')
   ])
   for(const result of [req,reqLines,inventory])if(result.error)throw result.error
   setRequests((req.data??[]) as Row[]);setRequestItems((reqLines.data??[]) as Row[]);setInventoryItems((inventory.data??[]) as Item[])
   if(financeAccess){
    const [sup,q,po,poi,gr,gri,si]=await Promise.all([
     supabase.from('supplier_directory').select('*').eq('institution_id',user.institutionId).order('name'),
     supabase.from('supplier_quotes').select('*').eq('institution_id',user.institutionId).order('total_amount'),
     supabase.from('purchase_orders').select('*').eq('institution_id',user.institutionId).order('order_date',{ascending:false}),
     supabase.from('purchase_order_items').select('*').eq('institution_id',user.institutionId),
     supabase.from('goods_receipts').select('*').eq('institution_id',user.institutionId).order('received_at',{ascending:false}),
     supabase.from('goods_receipt_items').select('*').eq('institution_id',user.institutionId),
     supabase.from('supplier_invoices').select('*').eq('institution_id',user.institutionId).order('invoice_date',{ascending:false})
    ])
    for(const result of [sup,q,po,poi,gr,gri,si])if(result.error)throw result.error
    setSuppliers((sup.data??[]) as Row[]);setQuotes((q.data??[]) as Row[]);setOrders((po.data??[]) as Row[])
    setOrderItems((poi.data??[]) as Row[]);setReceipts((gr.data??[]) as Row[]);setReceiptItems((gri.data??[]) as Row[])
    setInvoices((si.data??[]) as Row[])
   }else{
    setSuppliers([]);setQuotes([]);setOrders([]);setOrderItems([]);setReceipts([]);setReceiptItems([]);setInvoices([])
   }
  }catch(e){const message=e instanceof Error?e.message:'Procurement records could not be loaded.';setError(message);onToast(message,true)}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[user?.id,user?.institutionId,user?.role])
 const selectedRequest=requests.find(x=>x.id===activeRequest)
 const selectedOrder=orders.find(x=>x.id===activeOrder)
 const selectedReceipt=receipts.find(x=>x.id===activeReceipt)
 const openRequests=requests.filter(x=>['submitted','approved'].includes(x.status))
 const approvedRequests=requests.filter(x=>x.status==='approved')
 const draftOrders=orders.filter(x=>x.status==='draft')
 const selectedRequestLines=requestItems.filter(x=>x.request_id===activeRequest)
 const selectedOrderLines=orderItems.filter(x=>x.purchase_order_id===activeOrder)
 const selectedReceiptLines=receiptItems.filter(x=>x.receipt_id===activeReceipt)
 const q=(query:string,values:unknown[])=>!query.trim()||values.some(v=>String(v??'').toLowerCase().includes(query.toLowerCase()))
 const rowsForPage=useMemo(()=>{
  const src=page==='supplier-directory'||page==='suppliers'?suppliers:page==='purchase-requests'?requests:page==='quotation-comparison'?quotes:page==='purchase-approvals'?requests:page==='purchase-orders'||page==='purchase-records'?orders:page==='goods-receipt'?receipts:page==='supplier-invoices'?invoices:[]
  return src.filter(x=>(requestFilter==='all'||x.status===requestFilter)&&q(search,[x.name,x.title,x.request_number,x.order_number,x.invoice_number,x.quote_number,x.receipt_number,x.status]))
 },[page,suppliers,requests,quotes,orders,receipts,invoices,requestFilter,search])
 const setValue=(setter:typeof setForm,key:string,value:string)=>setter(current=>({...current,[key]:value}))
 const makeNumber=(prefix:string)=>prefix+'-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+Math.random().toString(36).slice(2,7).toUpperCase()
 async function mutate(action:()=>Promise<void>,success:string){
  if(busy)return
  setBusy(true)
  try{await action();onToast(success);await load()}
  catch(e){onToast(e instanceof Error?e.message:'The procurement operation failed.',true)}
  finally{setBusy(false)}
 }
 async function addSupplier(event:FormEvent){
  event.preventDefault();if(!user||!ownerAdmin)return
  await mutate(async()=>{
   const {error}=await supabase!.from('supplier_directory').insert({institution_id:user.institutionId,supplier_code:supplierForm.supplier_code.trim(),name:supplierForm.name.trim(),contact_name:supplierForm.contact_name||null,email:supplierForm.email||null,phone:supplierForm.phone||null,address:supplierForm.address||null,tax_reference:supplierForm.tax_reference||null,payment_terms:supplierForm.payment_terms||null,status:'active',created_by:user.id})
   if(error)throw error
   setSupplierForm({})
  },'Supplier saved.')
 }
 async function addRequest(event:FormEvent){
  event.preventDefault();if(!user||!canRequest)return
  await mutate(async()=>{
   const {data,error}=await supabase!.from('procurement_requests').insert({institution_id:user.institutionId,request_number:makeNumber('PR'),title:form.title.trim(),department:form.department||null,justification:form.justification||null,needed_by:form.needed_by||null,requested_by:user.id,status:'draft'}).select('*').single()
   if(error)throw error
   setActiveRequest(data.id);setForm({})
  },'Draft purchase request created. Add its line items before submitting.')
 }
 async function addRequestLine(event:FormEvent){
  event.preventDefault();if(!user||!activeRequest)return
  const request=requests.find(x=>x.id===activeRequest)
  if(!request||!['draft','submitted'].includes(request.status))throw new Error('Only a draft or submitted request can receive additional lines.')
  const item=inventoryItems.find(x=>x.id===line.inventory_item_id)
  await mutate(async()=>{
   const {error}=await supabase!.from('procurement_request_items').insert({institution_id:user.institutionId,request_id:activeRequest,inventory_item_id:item?.id??null,item_description:line.item_description?.trim()||item?.title,quantity:Number(line.quantity),unit:line.unit||'unit',estimated_unit_cost:line.estimated_unit_cost?Number(line.estimated_unit_cost):null,notes:line.notes||null})
   if(error)throw error
   setLine({})
  },'Request line added.')
 }
 async function submitRequest(id:string){
  if(!user)return
  await mutate(async()=>{const {error}=await supabase!.rpc('submit_procurement_request',{p_institution_id:user.institutionId,p_request_id:id});if(error)throw error},'Procurement request submitted for approval.')
 }
 async function reviewRequest(id:string,decision:'approved'|'rejected'){
  if(!user||!ownerAdmin)return
  await mutate(async()=>{const {error}=await supabase!.rpc('review_procurement_request',{p_institution_id:user.institutionId,p_request_id:id,p_decision:decision,p_notes:form.review_notes||null});if(error)throw error;setForm({})},decision==='approved'?'Purchase request approved.':'Purchase request rejected.')
 }
 async function addQuote(event:FormEvent){
  event.preventDefault();if(!user||!financeAccess)return
  await mutate(async()=>{
   const {error}=await supabase!.from('supplier_quotes').insert({institution_id:user.institutionId,request_id:quoteForm.request_id,supplier_id:quoteForm.supplier_id,quote_number:quoteForm.quote_number,quote_date:quoteForm.quote_date||new Date().toISOString().slice(0,10),valid_until:quoteForm.valid_until||null,total_amount:Number(quoteForm.total_amount),currency:'PKR',terms:quoteForm.terms||null,status:'received',recorded_by:user.id})
   if(error)throw error
   setQuoteForm({})
  },'Supplier quotation recorded.')
 }
 async function selectQuote(id:string){
  if(!user)return
  await mutate(async()=>{const {error}=await supabase!.rpc('select_supplier_quote',{p_institution_id:user.institutionId,p_quote_id:id});if(error)throw error},'Quotation selected. Other quotations for the request were marked not selected.')
 }
 async function addPurchaseOrder(event:FormEvent){
  event.preventDefault();if(!user||!ownerAdmin)return
  const supplier=suppliers.find(x=>x.id===orderForm.supplier_id)
  if(!supplier)throw new Error('Choose an active supplier.')
  await mutate(async()=>{
   const {data,error}=await supabase!.from('purchase_orders').insert({institution_id:user.institutionId,order_number:makeNumber('PO'),request_id:orderForm.request_id||null,supplier_id:supplier.id,order_date:orderForm.order_date||new Date().toISOString().slice(0,10),expected_delivery_date:orderForm.expected_delivery_date||null,status:'draft',currency:'PKR',subtotal:0,tax_amount:Number(orderForm.tax_amount||0),total_amount:0,terms:orderForm.terms||null,created_by:user.id}).select('*').single()
   if(error)throw error
   setActiveOrder(data.id);setOrderForm({})
  },'Draft purchase order created. Add inventory lines and submit it for approval.')
 }
 async function addOrderItem(event:FormEvent){
  event.preventDefault();if(!user||!ownerAdmin||!activeOrder)return
  const item=inventoryItems.find(x=>x.id===line.inventory_item_id)
  if(!item)throw new Error('Choose an item already registered in the institution inventory.')
  await mutate(async()=>{
   const {error}=await supabase!.from('purchase_order_items').insert({institution_id:user.institutionId,purchase_order_id:activeOrder,request_item_id:line.request_item_id||null,inventory_item_id:item.id,item_description:item.title,quantity:Number(line.quantity),unit:line.unit||String(item.payload?.unit??'unit'),unit_cost:Number(line.unit_cost)})
   if(error)throw error
   setLine({})
  },'Purchase order line added.')
 }
 async function approveOrder(id:string){
  if(!user||!ownerAdmin)return
  await mutate(async()=>{const {error}=await supabase!.rpc('approve_purchase_order',{p_institution_id:user.institutionId,p_purchase_order_id:id});if(error)throw error},'Purchase order approved and totals recalculated.')
 }
 async function createReceipt(event:FormEvent){
  event.preventDefault();if(!user||!ownerAdmin)return
  await mutate(async()=>{
   const {data,error}=await supabase!.from('goods_receipts').insert({institution_id:user.institutionId,receipt_number:makeNumber('GR'),purchase_order_id:receiptForm.purchase_order_id,received_at:new Date().toISOString(),status:'draft',received_by:user.id,notes:receiptForm.notes||null}).select('*').single()
   if(error)throw error
   setActiveReceipt(data.id);setReceiptForm({})
  },'Draft goods receipt created. Add quantities received for each purchase-order line.')
 }
 async function addReceiptItem(event:FormEvent){
  event.preventDefault();if(!user||!ownerAdmin||!activeReceipt)return
  await mutate(async()=>{
   const {error}=await supabase!.from('goods_receipt_items').insert({institution_id:user.institutionId,receipt_id:activeReceipt,purchase_order_item_id:receiptLine.purchase_order_item_id,received_quantity:Number(receiptLine.received_quantity),condition_notes:receiptLine.condition_notes||null})
   if(error)throw error
   setReceiptLine({})
  },'Goods receipt line added.')
 }
 async function postReceipt(id:string){
  if(!user||!ownerAdmin)return
  await mutate(async()=>{const {error}=await supabase!.rpc('post_goods_receipt',{p_institution_id:user.institutionId,p_receipt_id:id});if(error)throw error},'Goods receipt posted. Received quantities have been added to the institution stock ledger.')
 }
 async function addSupplierInvoice(event:FormEvent){
  event.preventDefault();if(!user||!financeAccess)return
  await mutate(async()=>{
   const {error}=await supabase!.from('supplier_invoices').insert({institution_id:user.institutionId,supplier_id:invoiceForm.supplier_id,purchase_order_id:invoiceForm.purchase_order_id||null,invoice_number:invoiceForm.invoice_number,invoice_date:invoiceForm.invoice_date,due_date:invoiceForm.due_date,amount:Number(invoiceForm.amount),status:'received',recorded_by:user.id,notes:invoiceForm.notes||null})
   if(error)throw error
   setInvoiceForm({})
  },'Supplier invoice recorded. No payment has been sent.')
 }
 async function reviewInvoice(row:Row,next:'under_review'|'approved'){
  if(!user||!financeAccess)return
  await mutate(async()=>{const {error}=await supabase!.from('supplier_invoices').update({status:next,reviewed_by:user.id,updated_at:new Date().toISOString()}).eq('institution_id',user.institutionId).eq('id',row.id);if(error)throw error},'Supplier invoice status updated.')
 }
 const formField=(setter:typeof setForm,state:Record<string,string>,name:string,caption:string,type='text',required=true,options?:{label:string;value:string}[])=><label>{caption}{options?<select required={required} value={state[name]??''} onChange={e=>setValue(setter,name,e.target.value)}><option value="">Select {caption.toLowerCase()}</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<input required={required} type={type} value={state[name]??''} onChange={e=>setValue(setter,name,e.target.value)}/>}</label>
 const requestFor=(id:string)=>requests.find(x=>x.id===id)
 const supplierFor=(id:string)=>suppliers.find(x=>x.id===id)
 const itemFor=(id:string)=>inventoryItems.find(x=>x.id===id)
 const orderFor=(id:string)=>orders.find(x=>x.id===id)
 const orderItemFor=(id:string)=>orderItems.find(x=>x.id===id)
 const renderRequests=()=> <section className="ed360-data-card"><header><h2>Purchase request pipeline</h2><p>Requesters can prepare and submit their own requests. Owner/admin reviews submissions.</p></header>{canRequest&&<form className="ed360-data-form" onSubmit={addRequest}>{formField(setForm,form,'title','Request title')}{formField(setForm,form,'department','Department', 'text',false)}{formField(setForm,form,'needed_by','Needed by','date',false)}<label>Justification<textarea value={form.justification??''} onChange={e=>setValue(setForm,'justification',e.target.value)}/></label><button className="button button-primary" disabled={busy}>Create draft request</button></form>}<div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search requests…" aria-label="Search requests"/><select value={requestFilter} onChange={e=>setRequestFilter(e.target.value)}><option value="all">All statuses</option>{['draft','submitted','approved','rejected','ordered','closed','cancelled'].map(x=><option key={x} value={x}>{label(x)}</option>)}</select></div><div className="table-scroll"><table><thead><tr><th>Request</th><th>Department</th><th>Needed by</th><th>Requester</th><th>Lines</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rowsForPage.map(row=><tr key={row.id}><td><b>{row.request_number}</b><small>{row.title}</small></td><td>{row.department??'—'}</td><td>{date(row.needed_by)}</td><td>{row.requested_by===user?.id?'You':String(row.requested_by).slice(0,8)}</td><td>{requestItems.filter(x=>x.request_id===row.id).length}</td><td>{label(row.status)}</td><td><div className="ed360-proc-actions"><button type="button" className="button button-outline" onClick={()=>setActiveRequest(row.id)}>View lines</button>{row.status==='draft'&&row.requested_by===user?.id&&<button type="button" className="button button-outline" onClick={()=>void submitRequest(row.id)}>Submit</button>}{ownerAdmin&&row.status==='submitted'&&<><button type="button" className="button button-primary" onClick={()=>void reviewRequest(row.id,'approved')}>Approve</button><button type="button" className="button button-outline" onClick={()=>void reviewRequest(row.id,'rejected')}>Reject</button></>}</div></td></tr>)}</tbody></table></div>{selectedRequest&&<div className="ed360-data-card ed360-proc-subpanel"><header><div><h3>{selectedRequest.request_number} · {selectedRequest.title}</h3><p>Request line items</p></div><button type="button" className="button button-outline" onClick={()=>setActiveRequest('')}>Close</button></header>{['draft','submitted'].includes(selectedRequest.status)&&selectedRequest.requested_by===user?.id&&<form className="ed360-data-form" onSubmit={addRequestLine}>{formField(setLine,line,'inventory_item_id','Existing inventory item','text',false,inventoryItems.map(i=>({label:i.title,value:i.id})))}{formField(setLine,line,'item_description','Item description')}{formField(setLine,line,'quantity','Quantity','number')}{formField(setLine,line,'unit','Unit','text',false)}{formField(setLine,line,'estimated_unit_cost','Estimated unit cost','number',false)}<button className="button button-primary" disabled={busy}>Add line item</button></form>}<div className="table-scroll"><table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Estimate</th></tr></thead><tbody>{selectedRequestLines.map(row=><tr key={row.id}><td>{row.item_description}</td><td>{row.quantity}</td><td>{row.unit}</td><td>{row.estimated_unit_cost?money(row.estimated_unit_cost):'—'}</td></tr>)}</tbody></table></div></div>}</section>
 const renderSuppliers=()=> <section className="ed360-data-card"><header><h2>Supplier directory</h2><p>Approved supplier details, contact information and trading status. Supplier records are private to authorised procurement and finance roles.</p></header>{ownerAdmin&&<form className="ed360-data-form" onSubmit={addSupplier}>{formField(setSupplierForm,supplierForm,'supplier_code','Supplier code')}{formField(setSupplierForm,supplierForm,'name','Supplier name')}{formField(setSupplierForm,supplierForm,'contact_name','Contact person','text',false)}{formField(setSupplierForm,supplierForm,'email','Email','email',false)}{formField(setSupplierForm,supplierForm,'phone','Phone','text',false)}{formField(setSupplierForm,supplierForm,'tax_reference','Tax reference','text',false)}{formField(setSupplierForm,supplierForm,'payment_terms','Payment terms','text',false)}<label>Address<textarea value={supplierForm.address??''} onChange={e=>setValue(setSupplierForm,'address',e.target.value)}/></label><button className="button button-primary" disabled={busy}>Save supplier</button></form>}<div className="table-scroll"><table><thead><tr><th>Code</th><th>Supplier</th><th>Contact</th><th>Phone / Email</th><th>Terms</th><th>Status</th></tr></thead><tbody>{rowsForPage.map(row=><tr key={row.id}><td>{row.supplier_code}</td><td>{row.name}</td><td>{row.contact_name??'—'}</td><td>{row.phone??'—'}<small>{row.email??''}</small></td><td>{row.payment_terms??'—'}</td><td>{label(row.status)}</td></tr>)}</tbody></table></div></section>
 const renderQuotes=()=> <section className="ed360-data-card"><header><h2>Supplier quotation comparison</h2><p>Compare recorded supplier totals for the same approved request. Selection rejects competing quotes so the purchase order uses one chosen supplier.</p></header>{financeAccess&&<form className="ed360-data-form" onSubmit={addQuote}>{formField(setQuoteForm,quoteForm,'request_id','Approved request','text',true,approvedRequests.map(r=>({label:r.request_number+' · '+r.title,value:r.id})))}{formField(setQuoteForm,quoteForm,'supplier_id','Supplier','text',true,suppliers.filter(s=>s.status==='active').map(s=>({label:s.name,value:s.id})))}{formField(setQuoteForm,quoteForm,'quote_number','Quote number')}{formField(setQuoteForm,quoteForm,'quote_date','Quote date','date',false)}{formField(setQuoteForm,quoteForm,'valid_until','Valid until','date',false)}{formField(setQuoteForm,quoteForm,'total_amount','Quoted total (PKR)','number')}{formField(setQuoteForm,quoteForm,'terms','Terms','text',false)}<button className="button button-primary" disabled={busy}>Record quotation</button></form>}<div className="table-scroll"><table><thead><tr><th>Request</th><th>Supplier</th><th>Quote</th><th>Date</th><th>Valid until</th><th>Total</th><th>Status / action</th></tr></thead><tbody>{rowsForPage.map(row=><tr key={row.id}><td>{requestFor(row.request_id)?.request_number??'—'}</td><td>{supplierFor(row.supplier_id)?.name??'—'}</td><td>{row.quote_number}</td><td>{date(row.quote_date)}</td><td>{date(row.valid_until)}</td><td>{money(row.total_amount)}</td><td>{label(row.status)} {financeAccess&&requestFor(row.request_id)?.status==='approved'&&row.status!=='selected'&&<button className="button button-outline" type="button" onClick={()=>void selectQuote(row.id)}>Select quote</button>}</td></tr>)}</tbody></table></div></section>
 const renderOrders=()=> <section className="ed360-data-card"><header><h2>Purchase orders</h2><p>Orders can only be approved after at least one line item is added. Approval recalculates totals from actual lines.</p></header>{ownerAdmin&&<form className="ed360-data-form" onSubmit={addPurchaseOrder}>{formField(setOrderForm,orderForm,'request_id','Approved request','text',false,approvedRequests.map(r=>({label:r.request_number+' · '+r.title,value:r.id})))}{formField(setOrderForm,orderForm,'supplier_id','Supplier','text',true,suppliers.filter(s=>s.status==='active').map(s=>({label:s.name,value:s.id})))}{formField(setOrderForm,orderForm,'order_date','Order date','date',false)}{formField(setOrderForm,orderForm,'expected_delivery_date','Expected delivery','date',false)}{formField(setOrderForm,orderForm,'tax_amount','Tax amount (PKR)','number',false)}<button className="button button-primary" disabled={busy}>Create draft purchase order</button></form>}<div className="table-scroll"><table><thead><tr><th>Order</th><th>Supplier</th><th>Request</th><th>Order date</th><th>Total</th><th>Received lines</th><th>Status / actions</th></tr></thead><tbody>{rowsForPage.map(row=><tr key={row.id}><td><b>{row.order_number}</b></td><td>{supplierFor(row.supplier_id)?.name??'—'}</td><td>{requestFor(row.request_id)?.request_number??'—'}</td><td>{date(row.order_date)}</td><td>{money(row.total_amount)}</td><td>{orderItems.filter(x=>x.purchase_order_id===row.id).map(x=>Number(x.received_quantity)+'/'+Number(x.quantity)).join(', ')||'—'}</td><td>{label(row.status)} <div className="ed360-proc-actions"><button type="button" className="button button-outline" onClick={()=>setActiveOrder(row.id)}>View lines</button>{ownerAdmin&&row.status==='draft'&&<button type="button" className="button button-primary" onClick={()=>void approveOrder(row.id)}>Approve</button>}</div></td></tr>)}</tbody></table></div>{selectedOrder&&<div className="ed360-data-card ed360-proc-subpanel"><header><div><h3>{selectedOrder.order_number}</h3><p>{supplierFor(selectedOrder.supplier_id)?.name??''} · {label(selectedOrder.status)}</p></div><button type="button" className="button button-outline" onClick={()=>setActiveOrder('')}>Close</button></header>{ownerAdmin&&selectedOrder.status==='draft'&&<form className="ed360-data-form" onSubmit={addOrderItem}>{formField(setLine,line,'inventory_item_id','Inventory item','text',true,inventoryItems.map(i=>({label:i.title,value:i.id})))}{formField(setLine,line,'quantity','Quantity','number')}{formField(setLine,line,'unit','Unit','text',false)}{formField(setLine,line,'unit_cost','Unit cost (PKR)','number')}{buttonLine('Add order line',busy)}</form>}<div className="table-scroll"><table><thead><tr><th>Inventory item</th><th>Quantity</th><th>Received</th><th>Unit cost</th><th>Line total</th></tr></thead><tbody>{selectedOrderLines.map(row=><tr key={row.id}><td>{row.item_description}</td><td>{row.quantity}</td><td>{row.received_quantity}</td><td>{money(row.unit_cost)}</td><td>{money(row.line_total)}</td></tr>)}</tbody></table></div><p>Subtotal: {money(selectedOrderLines.reduce((n,x)=>n+Number(x.line_total),0))} · Tax: {money(selectedOrder.tax_amount)} · Total after approval: {money(Number(selectedOrder.subtotal)+Number(selectedOrder.tax_amount)}</p></div>}</section>
 const renderReceipts=()=> <section className="ed360-data-card"><header><h2>Goods receipt</h2><p>Post a receipt only after checking delivered quantities. Posting updates the existing inventory stock ledger through a transaction.</p></header>{ownerAdmin&&<form className="ed360-data-form" onSubmit={createReceipt}>{formField(setReceiptForm,receiptForm,'purchase_order_id','Approved / sent purchase order','text',true,orders.filter(o=>['approved','sent','partially_received'].includes(o.status)).map(o=>({label:o.order_number+' · '+label(o.status),value:o.id})))}<label>Notes<textarea value={receiptForm.notes??''} onChange={e=>setValue(setReceiptForm,'notes',e.target.value)}/></label><button className="button button-primary" disabled={busy}>Create draft receipt</button></form>}<div className="table-scroll"><table><thead><tr><th>Receipt</th><th>Purchase order</th><th>Received at</th><th>Status / action</th></tr></thead><tbody>{rowsForPage.map(row=><tr key={row.id}><td>{row.receipt_number}</td><td>{orderFor(row.purchase_order_id)?.order_number??'—'}</td><td>{date(row.received_at)}</td><td>{label(row.status)} <button type="button" className="button button-outline" onClick={()=>setActiveReceipt(row.id)}>View receipt</button></td></tr>)}</tbody></table></div>{selectedReceipt&&<div className="ed360-data-card ed360-proc-subpanel"><header><div><h3>{selectedReceipt.receipt_number}</h3><p>{orderFor(selectedReceipt.purchase_order_id)?.order_number??'Purchase order'} · {label(selectedReceipt.status)}</p></div><button type="button" className="button button-outline" onClick={()=>setActiveReceipt('')}>Close</button></header>{ownerAdmin&&selectedReceipt.status==='draft'&&<form className="ed360-data-form" onSubmit={addReceiptItem}>{formField(setReceiptLine,receiptLine,'purchase_order_item_id','Purchase order line','text',true,orderItems.filter(i=>i.purchase_order_id===selectedReceipt.purchase_order_id&&Number(i.received_quantity)<Number(i.quantity)).map(i=>({label:i.item_description+' · remaining '+(Number(i.quantity)-Number(i.received_quantity)),value:i.id})))}{formField(setReceiptLine,receiptLine,'received_quantity','Quantity received','number')}{formField(setReceiptLine,receiptLine,'condition_notes','Condition notes','text',false)}<button className="button button-primary" disabled={busy}>Add received line</button></form>}<div className="table-scroll"><table><thead><tr><th>PO item</th><th>Qty received</th><th>Condition</th></tr></thead><tbody>{selectedReceiptLines.map(row=><tr key={row.id}><td>{orderItemFor(row.purchase_order_item_id)?.item_description??'—'}</td><td>{row.received_quantity}</td><td>{row.condition_notes??'—'}</td></tr>)}</tbody></table></div>{ownerAdmin&&selectedReceipt.status==='draft'&&<button className="button button-primary" disabled={busy||selectedReceiptLines.length===0} onClick={()=>void postReceipt(selectedReceipt.id)}>Post receipt and update stock</button>}</div>}</section>
 const renderInvoices=()=> <section className="ed360-data-card"><header><h2>Supplier invoices</h2><p>Record the supplier invoice against its order. Approval is tracked separately; the application does not send payment to the supplier.</p></header>{financeAccess&&<form className="ed360-data-form" onSubmit={addSupplierInvoice}>{formField(setInvoiceForm,invoiceForm,'supplier_id','Supplier','text',true,suppliers.map(s=>({label:s.name,value:s.id})))}{formField(setInvoiceForm,invoiceForm,'purchase_order_id','Purchase order','text',false,orders.map(o=>({label:o.order_number,value:o.id})))}{formField(setInvoiceForm,invoiceForm,'invoice_number','Invoice number')}{formField(setInvoiceForm,invoiceForm,'invoice_date','Invoice date','date')}{formField(setInvoiceForm,invoiceForm,'due_date','Due date','date')}{formField(setInvoiceForm,invoiceForm,'amount','Amount (PKR)','number')}<label>Notes<textarea value={invoiceForm.notes??''} onChange={e=>setValue(setInvoiceForm,'notes',e.target.value)}/></label><button className="button button-primary" disabled={busy}>Record supplier invoice</button></form>}<div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Supplier</th><th>PO</th><th>Invoice / due</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{rowsForPage.map(row=><tr key={row.id}><td>{row.invoice_number}</td><td>{supplierFor(row.supplier_id)?.name??'—'}</td><td>{orderFor(row.purchase_order_id)?.order_number??'—'}</td><td>{date(row.invoice_date)} / {date(row.due_date)}</td><td>{money(row.amount)}</td><td>{label(row.status)}</td><td>{financeAccess&&row.status==='received'&&<button type="button" className="button button-outline" onClick={()=>void reviewInvoice(row,'under_review')}>Review</button>}{financeAccess&&row.status==='under_review'&&<button type="button" className="button button-outline" onClick={()=>void reviewInvoice(row,'approved')}>Approve</button>}</td></tr>)}</tbody></table></div></section>
 const renderApprovals=()=> <section className="ed360-data-card"><header><h2>Procurement approvals</h2><p>Owner/admin reviews requests. Purchase orders are approved after line validation and supplier selection.</p></header><h3>Requests awaiting review</h3><div className="table-scroll"><table><thead><tr><th>Request</th><th>Requested by</th><th>Lines</th><th>Needed by</th><th>Action</th></tr></thead><tbody>{requests.filter(r=>r.status==='submitted').map(r=><tr key={r.id}><td>{r.request_number} · {r.title}</td><td>{String(r.requested_by).slice(0,8)}</td><td>{requestItems.filter(i=>i.request_id===r.id).length}</td><td>{date(r.needed_by)}</td><td>{ownerAdmin&&<div className="ed360-proc-actions"><button className="button button-primary" onClick={()=>void reviewRequest(r.id,'approved')}>Approve</button><button className="button button-outline" onClick={()=>void reviewRequest(r.id,'rejected')}>Reject</button></div>}</td></tr>)}</tbody></table></div><h3>Draft purchase orders</h3><div className="table-scroll"><table><thead><tr><th>Order</th><th>Supplier</th><th>Lines</th><th>Status</th><th>Action</th></tr></thead><tbody>{draftOrders.map(o=><tr key={o.id}><td>{o.order_number}</td><td>{supplierFor(o.supplier_id)?.name??'—'}</td><td>{orderItems.filter(i=>i.purchase_order_id===o.id).length}</td><td>{label(o.status)}</td><td>{ownerAdmin&&<button type="button" className="button button-primary" onClick={()=>void approveOrder(o.id)}>Approve order</button>}</td></tr>)}</tbody></table></div></section>
 const renderReports=()=> <section className="ed360-data-card"><header><h2>Procurement and supplier performance</h2><p>Live metrics calculated from actual requests, quotations, purchase orders, receipts and invoices.</p></header><div className="ed360-workspace-kpis"><article><span>Open requests</span><strong>{openRequests.length}</strong><small>Submitted or approved</small></article><article><span>Suppliers</span><strong>{suppliers.filter(s=>s.status==='active').length}</strong><small>Active suppliers</small></article><article><span>Purchase orders</span><strong>{orders.length}</strong><small>{orders.filter(o=>o.status==='received').length} received</small></article><article><span>Outstanding invoices</span><strong>{invoices.filter(i=>!['paid','rejected'].includes(i.status)).length}</strong><small>Not marked as paid</small></article></div><div className="table-scroll"><table><thead><tr><th>Supplier</th><th>Orders</th><th>Order value</th><th>Open invoices</th></tr></thead><tbody>{suppliers.map(s=>{const os=orders.filter(o=>o.supplier_id===s.id);const inv=invoices.filter(i=>i.supplier_id===s.id&&!['paid','rejected'].includes(i.status));return <tr key={s.id}><td>{s.name}</td><td>{os.length}</td><td>{money(os.reduce((n,o)=>n+Number(o.total_amount),0))}</td><td>{inv.length}</td></tr>})}</tbody></table></div></section>
 const buttonLine=(caption:string,disabled:boolean)=><button className="button button-primary" disabled={disabled}>{busy?'Saving…':caption}</button>
 if(!user)return null
 if(!canRequest)return <main className="page-content ed360-module-page"><section className="ed360-workspace-empty">Procurement access is not enabled for this role.</section></main>
 if(!financeAccess&&page!=='purchase-requests')return <main className="page-content ed360-module-page"><section className="ed360-workspace-empty"><strong>Procurement finance access required</strong><span>Supplier, quotation, purchase order and invoice records are visible to owner, administrator and accountant roles. Requesters can still raise and track their own purchase requests.</span></section></main>
 return <main className="page-content ed360-module-page ed360-procurement-workspace"><header className="ed360-workspace-hero"><div className="ed360-workspace-hero-icon"><Package size={21}/></div><div className="ed360-workspace-hero-copy"><span>INVENTORY / PROCUREMENT</span><h1>{title}</h1><p>{descriptions[page]??'Manage procurement and supplier workflows.'}</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Institution-scoped purchasing</span><button className="button button-outline" type="button" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div></header>{error&&<div className="ed360-data-error">{error}</div>}{loading?<div className="ed360-workspace-empty">Loading procurement records…</div>:null}
  {page==='supplier-directory'||page==='suppliers'?renderSuppliers():page==='purchase-requests'?renderRequests():page==='quotation-comparison'?renderQuotes():page==='purchase-approvals'?renderApprovals():page==='purchase-orders'||page==='purchase-records'?renderOrders():page==='goods-receipt'?renderReceipts():page==='supplier-invoices'?renderInvoices():renderReports()}
 </main>
}
