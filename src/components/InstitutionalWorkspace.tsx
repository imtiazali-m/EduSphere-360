import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Activity, ArrowUpRight, CheckCircle2, Download, FileSpreadsheet, FileText, Filter, Plus, Printer, Search, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getWorkspaceGroup, getWorkspaceItem, institutionalMenu } from '../lib/institutionalCatalog'
import { exportExcelXml, exportWordXml, printOfficeReport, type OfficeColumn } from '../lib/officeExport'
import { downloadCsv } from '../lib/csv'
import type { RecordRow } from '../lib/types'

type OperationalRow = RecordRow & {
 module_key:string;record_type:string;title:string;reference_code?:string|null;description?:string|null;
 status:string;approval_status:string;record_date?:string|null;due_date?:string|null;amount?:number|null;
 quantity?:number|null;payload:Record<string,unknown>;visibility:string
}
type Props={workspaceKey:string;onToast:(message:string,error?:boolean)=>void}
const statusOptions=['draft','open','in_progress','pending','approved','published','completed','closed','on_hold','cancelled','rejected']
const themes:Record<string,{accent:string;soft:string;ink:string}>={
 blue:{accent:'#3477dc',soft:'#edf4ff',ink:'#1c477b'},violet:{accent:'#7955d6',soft:'#f2efff',ink:'#49358b'},
 slate:{accent:'#64788f',soft:'#f0f3f7',ink:'#36485b'},teal:{accent:'#159b9a',soft:'#e8f8f6',ink:'#146d6c'},
 cyan:{accent:'#1496b7',soft:'#e8f7fb',ink:'#155f77'},emerald:{accent:'#15956a',soft:'#e9f8f1',ink:'#17694f'},
 amber:{accent:'#c58b24',soft:'#fff7e8',ink:'#795515'},orange:{accent:'#d87831',soft:'#fff1e8',ink:'#8d481d'},
 green:{accent:'#199764',soft:'#e9f8f1',ink:'#17694f'},indigo:{accent:'#5368c9',soft:'#eef0ff',ink:'#35458f'},
 rose:{accent:'#d15e78',soft:'#fff0f3',ink:'#963b53'},pink:{accent:'#ca5c9a',soft:'#fff0f8',ink:'#8b3867'},
 sky:{accent:'#3c91c7',soft:'#edf8ff',ink:'#245e83'},gold:{accent:'#ac8428',soft:'#fbf6e8',ink:'#77601f'},
 red:{accent:'#c65b57',soft:'#fff0ef',ink:'#8e3834'}
}
const displayDate=(value:unknown)=>typeof value==='string'&&value?new Date(value+'T00:00:00').toLocaleDateString():'—'
const money=(value:unknown)=>value===null||value===undefined?'—':new Intl.NumberFormat('en-PK',{style:'currency',currency:'PKR',maximumFractionDigits:0}).format(Number(value)||0)
const isOverview=(key:string,label:string)=>/dashboard|overview|intelligence|analytics/i.test(key+' '+label)
const exportColumns:OfficeColumn[]=[
 {key:'reference_code',label:'Reference'},{key:'title',label:'Record'},{key:'record_type',label:'Workspace type'},
 {key:'status',label:'Status'},{key:'approval_status',label:'Approval'},{key:'record_date',label:'Date'},
 {key:'due_date',label:'Due date'},{key:'amount',label:'Amount (PKR)'},{key:'quantity',label:'Quantity'}
]

export function InstitutionalWorkspace({workspaceKey,onToast}:Props){
 const {user}=useAuth()
 const [groupKey,itemKey]=workspaceKey.split(':')
 const group=getWorkspaceGroup(groupKey)||institutionalMenu[0]
 const initialItem=getWorkspaceItem(group.key,itemKey)||group.items[0]
 const [selectedItem,setSelectedItem]=useState(initialItem.key)
 const item=getWorkspaceItem(group.key,selectedItem)||group.items[0]
 const [rows,setRows]=useState<OperationalRow[]>([])
 const [loading,setLoading]=useState(true)
 const [loadError,setLoadError]=useState('')
 const [search,setSearch]=useState('')
 const [range,setRange]=useState('90')
 const [campus,setCampus]=useState('')
 const [campuses,setCampuses]=useState<{id:string;name:string}[]>([])
 const [showForm,setShowForm]=useState(false)
 const [detail,setDetail]=useState<OperationalRow|null>(null)
 const [editing,setEditing]=useState<OperationalRow|null>(null)
 const [saving,setSaving]=useState(false)
 const [title,setTitle]=useState('')
 const [reference,setReference]=useState('')
 const [description,setDescription]=useState('')
 const [status,setStatus]=useState('draft')
 const [approval,setApproval]=useState('not_required')
 const [recordDate,setRecordDate]=useState(new Date().toISOString().slice(0,10))
 const [dueDate,setDueDate]=useState('')
 const [amount,setAmount]=useState('')
 const [quantity,setQuantity]=useState('')
 const [payloadText,setPayloadText]=useState('{}')
 const theme=themes[group.theme]||themes.blue
 const canAdmin=Boolean(user&&['owner','admin'].includes(user.role))
 const canWrite=Boolean(user&&(
  canAdmin||
  (user.role==='teacher'&&['academic_setup','employees','attendance','timetable','teaching','behaviour','communication','question_bank','examinations','tests','curriculum','library','transport','facilities','visitors'].includes(group.dataModule))||
  (user.role==='accountant'&&['finance','fees','receivables','payments','receipts','payroll','reconciliation','inventory'].includes(group.dataModule))||
  (user.role==='exam_officer'&&['question_bank','examinations','tests','reports'].includes(group.dataModule))
 ))

 const load=useCallback(async()=>{
  if(!supabase||!user||!group.dataModule){setRows([]);setLoading(false);return}
  setLoading(true);setLoadError('')
  try{
   let query=supabase.from('institutional_records').select('*').eq('institution_id',user.institutionId).eq('module_key',group.dataModule)
   if(!isOverview(item.key,item.label))query=query.eq('record_type',item.key)
   if(campus)query=query.eq('campus_id',campus)
   if(range!=='all'){
    const days=Number(range);const cutoff=new Date();cutoff.setDate(cutoff.getDate()-days)
    query=query.gte('created_at',cutoff.toISOString())
   }
   const {data,error}=await query.order('created_at',{ascending:false}).limit(500)
   if(error)throw error
   setRows((data??[]) as OperationalRow[])
  }catch(error){setLoadError(error instanceof Error?error.message:'Records could not be loaded');setRows([])}
  finally{setLoading(false)}
 },[user?.id,user?.institutionId,group.dataModule,item.key,item.label,campus,range])

 useEffect(()=>{void load()},[load])
 useEffect(()=>{
  let live=true
  async function loadCampuses(){
   if(!supabase||!user)return
   const {data}=await supabase.from('campuses').select('id,name').eq('institution_id',user.institutionId).order('name')
   if(live)setCampuses((data??[]) as {id:string;name:string}[])
  }
  void loadCampuses()
  return()=>{live=false}
 },[user?.id,user?.institutionId])

 const filtered=useMemo(()=>{
  const q=search.trim().toLowerCase()
  return rows.filter(row=>!q||[row.title,row.reference_code,row.status,row.description,row.record_type].some(value=>String(value??'').toLowerCase().includes(q)))
 },[rows,search])
 const dashboard= isOverview(item.key,item.label)
 const pending=rows.filter(row=>['pending','draft'].includes(row.approval_status)).length
 const overdue=rows.filter(row=>row.due_date&&row.due_date<new Date().toISOString().slice(0,10)&&!['completed','cancelled','closed','approved'].includes(row.status)).length
 const totalAmount=rows.reduce((sum,row)=>sum+Number(row.amount??0),0)
 const statusCounts=useMemo(()=>['draft','pending','in_progress','approved','published','completed','cancelled'].map(s=>({status:s,count:rows.filter(r=>r.status===s||r.approval_status===s).length})).filter(x=>x.count>0),[rows])

 function resetForm(row?:OperationalRow){
  setEditing(row??null);setTitle(row?.title??'');setReference(row?.reference_code??'');setDescription(row?.description??'')
  setStatus(row?.status??'draft');setApproval(row?.approval_status??'not_required')
  setRecordDate(row?.record_date??new Date().toISOString().slice(0,10));setDueDate(row?.due_date??'')
  setAmount(row?.amount===null||row?.amount===undefined?'':String(row.amount));setQuantity(row?.quantity===null||row?.quantity===undefined?'':String(row.quantity))
  setPayloadText(JSON.stringify(row?.payload??{},null,2));setShowForm(true)
 }
 async function save(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user)return
  let payload:Record<string,unknown>
  try{const parsed=JSON.parse(payloadText||'{}');if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw new Error('Enter a JSON object');payload=parsed as Record<string,unknown>}
  catch(error){onToast(error instanceof Error?error.message:'Extra data must be valid JSON',true);return}
  if(amount.trim()&&(!Number.isFinite(Number(amount))||Number(amount)<0)){onToast('Amount must be a valid non-negative number.',true);return}
  if(quantity.trim()&&(!Number.isFinite(Number(quantity))||Number(quantity)<0)){onToast('Quantity must be a valid non-negative number.',true);return}
  setSaving(true)
  const values={
   institution_id:user.institutionId,module_key:group.dataModule,record_type:item.key,title:title.trim(),
   reference_code:reference.trim()||null,description:description.trim()||null,status,approval_status:approval,
   record_date:recordDate||null,due_date:dueDate||null,amount:amount.trim()?Number(amount):null,
   quantity:quantity.trim()?Number(quantity):null,payload,campus_id:campus||null,
   ...(editing?{updated_by:user.id}:{created_by:user.id})
  }
  try{
   const query=editing
    ?supabase.from('institutional_records').update(values).eq('id',editing.id).eq('institution_id',user.institutionId).select().single()
    :supabase.from('institutional_records').insert(values).select().single()
   const {data,error}=await query
   if(error)throw error
   const saved=data as OperationalRow
   setShowForm(false);setEditing(null);setDetail(saved)
   onToast(editing?'Record updated successfully.':'Record created successfully.')
   await load()
  }catch(error){onToast(error instanceof Error?error.message:'The record could not be saved.',true)}
  finally{setSaving(false)}
 }
 async function remove(row:OperationalRow){
  if(!supabase||!user||!canAdmin)return
  if(!window.confirm('Delete '+row.title+'? This action will be recorded in the audit history.'))return
  const {error}=await supabase.from('institutional_records').delete().eq('id',row.id).eq('institution_id',user.institutionId)
  if(error){onToast(error.message,true);return}
  setDetail(null);onToast('Record deleted.');await load()
 }
 async function decide(row:OperationalRow,decision:'approved'|'rejected'){
  if(!supabase||!user||!canAdmin)return
  const {data,error}=await supabase.from('institutional_records').update({approval_status:decision,reviewed_by:user.id,reviewed_at:new Date().toISOString(),updated_by:user.id}).eq('id',row.id).eq('institution_id',user.institutionId).select().single()
  if(error){onToast(error.message,true);return}
  setDetail(data as OperationalRow);onToast('Approval decision saved.');await load()
 }

 const baseName=(group.label+'-'+item.label).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')
 const columns=dashboard?exportColumns:exportColumns
 function exportCsv(){downloadCsv(baseName+'.csv',filtered as unknown as Record<string,unknown>[],columns)}
 function exportExcel(){exportExcelXml(baseName+'.xls',group.label+' — '+item.label,filtered as unknown as Record<string,unknown>[],columns)}
 function exportWord(){exportWordXml(baseName+'.doc',group.label+' — '+item.label,filtered as unknown as Record<string,unknown>[],columns)}
 function print(){try{printOfficeReport(group.label+' — '+item.label,filtered as unknown as Record<string,unknown>[],columns,user?.institutionName??'EduSphere 360')}catch(error){onToast(error instanceof Error?error.message:'Print view could not be opened.',true)}}

 return <main className="page-content ed360-module-page ed360-institutional-workspace" style={{'--workspace-accent':theme.accent,'--workspace-soft':theme.soft,'--workspace-ink':theme.ink} as CSSProperties}>
  <header className="ed360-workspace-hero">
   <div className="ed360-workspace-hero-icon"><Activity size={21}/></div>
   <div className="ed360-workspace-hero-copy"><span>{group.label.toUpperCase()} / INSTITUTIONAL WORKSPACE</span><h1>{group.label}</h1><p>{group.description}</p></div>
   <div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Live institution records</span>{canWrite&&<button className="button button-primary" onClick={()=>resetForm()}><Plus size={16}/> New record</button>}</div>
  </header>
  <nav className="ed360-operations-window-nav ed360-workspace-tabs" aria-label={group.label+' submenus'}>
   {group.items.map(menu=><button key={menu.key} type="button" className={selectedItem===menu.key?'active':''} aria-current={selectedItem===menu.key?'page':undefined} onClick={()=>setSelectedItem(menu.key)}>{menu.label}</button>)}
  </nav>
  <section className="ed360-operations-context-window ed360-workspace-subwindow">
   <div><span>MAIN MENU / {group.label.toUpperCase()}</span><h2>{item.label}</h2><p>{item.description}</p></div>
   <div className="ed360-workspace-window-number"><strong>{filtered.length.toLocaleString()}</strong><small>{dashboard?'records in this module':'records in this view'}</small></div>
  </section>
  <div className="ed360-workspace-toolbar">
   <div className="ed360-workspace-filter"><Filter size={15}/><select value={range} onChange={e=>setRange(e.target.value)} aria-label="Date range"><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option><option value="all">All dates</option></select>
    {campuses.length>0&&<select value={campus} onChange={e=>setCampus(e.target.value)} aria-label="Campus filter"><option value="">All campuses</option>{campuses.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select>}
   </div>
   <label className="ed360-workspace-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search this workspace..." aria-label="Search records"/></label>
   <div className="ed360-export-actions">
    <button type="button" onClick={exportCsv}><Download size={14}/> CSV</button>
    <button type="button" onClick={exportExcel}><FileSpreadsheet size={14}/> Excel</button>
    <button type="button" onClick={exportWord}><FileText size={14}/> Word</button>
    <button type="button" onClick={print}><Printer size={14}/> Print / PDF</button>
   </div>
  </div>
  {loadError&&<div className="ed360-workspace-error" role="alert">{loadError}</div>}
  {dashboard&&<section className="ed360-workspace-kpis">
   <article><span>Total records</span><strong>{loading?'—':rows.length.toLocaleString()}</strong><small>From this institution’s records</small></article>
   <article><span>Pending review</span><strong>{loading?'—':pending.toLocaleString()}</strong><small>Draft and pending approvals</small></article>
   <article><span>Overdue items</span><strong>{loading?'—':overdue.toLocaleString()}</strong><small>Past due date, not closed</small></article>
   <article><span>Recorded value</span><strong>{loading?'—':money(totalAmount)}</strong><small>Only where records have a numeric amount</small></article>
  </section>}
  {dashboard&&<section className="ed360-workspace-chart">
   <div className="ed360-workspace-section-title"><div><span>LIVE DISTRIBUTION</span><h3>Workflow status</h3></div><span>Calculated from loaded records</span></div>
   {statusCounts.length?statusCounts.map(s=><div className="ed360-workspace-bar" key={s.status}><label>{s.status.replaceAll('_',' ')}</label><div><i style={{width:Math.max(2,(s.count/Math.max(1,rows.length))*100)+'%'}}/></div><b>{s.count}</b></div>):<p className="ed360-workspace-empty-inline">No workflow statuses have been recorded in this module yet.</p>}
  </section>}
  <section className="table-card ed360-workspace-record-card">
   <div className="table-toolbar"><div className="table-count"><strong>{filtered.length.toLocaleString()}</strong> {item.label.toLowerCase()} <span>·</span> Institution scope</div><span className="ed360-table-refresh"><button type="button" onClick={()=>void load()}>Refresh records <ArrowUpRight size={13}/></button></span></div>
   {loading?<div className="ed360-workspace-empty">Loading institution records…</div>:filtered.length===0?<div className="ed360-workspace-empty"><strong>No records in this workspace yet</strong><span>Records will appear here after they are created or imported. No sample data is being shown.</span>{canWrite&&<button type="button" className="button button-primary" onClick={()=>resetForm()}><Plus size={15}/> Create first record</button>}</div>:
   <div className="table-scroll"><table><thead><tr><th>Reference</th><th>Record</th><th>Status</th><th>Approval</th><th>Date</th><th>Due</th><th>Amount</th><th>Actions</th></tr></thead><tbody>
    {filtered.map(row=><tr key={row.id}><td>{row.reference_code||'—'}</td><td><button className="ed360-record-open" type="button" onClick={()=>setDetail(row)}>{row.title}</button><small className="ed360-record-subtitle">{row.description||row.record_type.replaceAll('-',' ')}</small></td><td><span className={'ed360-state-pill state-'+row.status}>{row.status.replaceAll('_',' ')}</span></td><td>{row.approval_status.replaceAll('_',' ')}</td><td>{displayDate(row.record_date)}</td><td>{displayDate(row.due_date)}</td><td>{money(row.amount)}</td><td><div className="ed360-row-actions"><button type="button" onClick={()=>setDetail(row)}>Open</button>{canWrite&&<button type="button" onClick={()=>resetForm(row)}>Edit</button>}</div></td></tr>)}
   </tbody></table></div>}
  </section>
  {showForm&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShowForm(false)}}><section className="modal-card ed360-context-form" role="dialog" aria-modal="true" aria-labelledby="ed360-form-heading">
   <div className="modal-heading"><div><div className="eyebrow">{group.label.toUpperCase()} / {item.label.toUpperCase()}</div><h2 id="ed360-form-heading">{editing?'Edit':'Create'} {item.label}</h2><p>This form saves a real institution-scoped record.</p></div><button type="button" className="icon-button" onClick={()=>setShowForm(false)} aria-label="Close"><X size={18}/></button></div>
   <form onSubmit={save} className="ed360-context-form-grid">
    <label>Record title *<input required value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} placeholder={'Enter '+item.label.toLowerCase()}/></label>
    <label>Reference / number<input value={reference} onChange={e=>setReference(e.target.value)} maxLength={80} placeholder="Optional reference"/></label>
    <label>Description / notes<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} maxLength={3000}/></label>
    <div className="ed360-form-row"><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{statusOptions.map(s=><option value={s} key={s}>{s.replaceAll('_',' ')}</option>)}</select></label><label>Approval<select value={approval} onChange={e=>setApproval(e.target.value)}><option value="not_required">Not required</option><option value="draft">Draft</option><option value="pending">Needs approval</option></select></label></div>
    <div className="ed360-form-row"><label>Record date<input type="date" value={recordDate} onChange={e=>setRecordDate(e.target.value)}/></label><label>Due date<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label></div>
    <div className="ed360-form-row"><label>Amount (PKR)<input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Quantity<input type="number" min="0" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label></div>
    <label>Additional structured fields (JSON)<textarea rows={4} spellCheck={false} value={payloadText} onChange={e=>setPayloadText(e.target.value)}/><small>Use this for module-specific details not represented above. Keep names and values accurate.</small></label>
    <div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving?'Saving…':editing?'Save changes':'Create record'}</button></div>
   </form>
  </section></div>}
  {detail&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setDetail(null)}}><section className="modal-card ed360-record-details ed360-context-detail" role="dialog" aria-modal="true" aria-labelledby="ed360-detail-heading">
   <div className="modal-heading"><div><div className="eyebrow">CONTEXTUAL SUB-WINDOW / {group.label.toUpperCase()}</div><h2 id="ed360-detail-heading">{detail.title}</h2><p>{detail.reference_code||detail.record_type.replaceAll('-',' ')} · {detail.status}</p></div><button type="button" className="icon-button" onClick={()=>setDetail(null)} aria-label="Close"><X size={18}/></button></div>
   <div className="ed360-context-detail-callout"><div><span>RECORD WORKFLOW</span><strong>{detail.approval_status.replaceAll('_',' ')}</strong><p>{detail.description||'No additional description supplied.'}</p></div><aside><b>Responsible workspace</b><p>{group.label} / {item.label}</p><b>Updated</b><p>{detail.updated_at?new Date(detail.updated_at).toLocaleString():'Not available'}</p></aside></div>
   <div className="ed360-record-details-grid"><div className="ed360-record-detail"><small>Status</small><b>{detail.status}</b></div><div className="ed360-record-detail"><small>Record date</small><b>{displayDate(detail.record_date)}</b></div><div className="ed360-record-detail"><small>Due date</small><b>{displayDate(detail.due_date)}</b></div><div className="ed360-record-detail"><small>Amount</small><b>{money(detail.amount)}</b></div><div className="ed360-record-detail"><small>Quantity</small><b>{detail.quantity??'—'}</b></div><div className="ed360-record-detail"><small>Created</small><b>{detail.created_at?new Date(detail.created_at).toLocaleString():'—'}</b></div></div>
   {Object.keys(detail.payload??{}).length>0&&<section className="ed360-payload-section"><h3>Module-specific details</h3><pre>{JSON.stringify(detail.payload,null,2)}</pre></section>}
   <div className="modal-actions">
    {canAdmin&&detail.approval_status==='pending'&&<><button type="button" className="button button-outline" onClick={()=>void decide(detail,'rejected')}>Reject</button><button type="button" className="button button-primary" onClick={()=>void decide(detail,'approved')}><CheckCircle2 size={15}/> Approve</button></>}
    {canWrite&&<button type="button" className="button button-outline" onClick={()=>{const row=detail;setDetail(null);resetForm(row)}}>Edit record</button>}
    {canAdmin&&<button type="button" className="button button-danger" onClick={()=>void remove(detail)}>Delete</button>}
    <button type="button" className="button button-primary" onClick={()=>setDetail(null)}>Close</button>
   </div>
  </section></div>}
 </main>
}
