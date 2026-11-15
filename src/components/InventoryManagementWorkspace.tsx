import { useCallback,useEffect,useMemo,useState,type FormEvent } from 'react'
import { Boxes,Download,Layers3,Package,Plus,RefreshCw,Search,Pencil,Trash2,ArrowDownToLine } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { downloadCsv } from '../lib/csv'
import '../styles/operation-management.css'

type InventoryRecord={id:string;institution_id:string;module_key:string;record_type:string;title:string;reference_code:string|null;description:string|null;status:string;quantity:number|null;amount:number|null;payload:Record<string,any>;created_at:string;updated_at:string}
type Movement={id:string;item_record_id:string;movement_type:string;quantity:number;unit_cost:number|null;movement_date:string;reference_code:string|null;notes:string|null}
type Props={workspaceKey:string;onToast:(message:string,error?:boolean)=>void;onNavigate?:(key:string)=>void}
type Form=Record<string,string>
const views:Record<string,{title:string;description:string;kind:'dashboard'|'items'|'categories'}>={
 'inventory-dashboard':{title:'Inventory Dashboard',description:'Stock position, low-stock items, category coverage and direct links to the inventory ledger.',kind:'dashboard'},
 'item-categories':{title:'Item Categories',description:'Create reusable item categories and keep the inventory catalogue consistently classified.',kind:'categories'},
 'item-catalogue':{title:'Item Catalogue',description:'Search and maintain the institution’s registered inventory items and opening stock.',kind:'items'},
 'items-management':{title:'Items Management',description:'Maintain item details, supplier references, reorder points and storage locations.',kind:'items'}
}
const makeForm=():Form=>({title:'',reference_code:'',description:'',category_id:'',unit:'pcs',unit_cost:'',opening_quantity:'0',reorder_level:'0',supplier:'',storage_location:'',status:'active'})
const safeNum=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0
const fmt=(v:number)=>new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(v)
export function InventoryManagementWorkspace({workspaceKey,onToast,onNavigate}:Props){
 const {user}=useAuth()
 const page=workspaceKey.split(':').slice(-1)[0]||'inventory-dashboard'
 const config=views[page]??views['inventory-dashboard']
 const canRead=Boolean(user&&['owner','admin','accountant'].includes(user.role))
 const canEdit=Boolean(user&&['owner','admin','accountant'].includes(user.role))
 const canDelete=Boolean(user&&['owner','admin'].includes(user.role))
 const [items,setItems]=useState<InventoryRecord[]>([])
 const [categories,setCategories]=useState<InventoryRecord[]>([])
 const [movements,setMovements]=useState<Movement[]>([])
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [search,setSearch]=useState('')
 const [open,setOpen]=useState(false)
 const [editing,setEditing]=useState<InventoryRecord|null>(null)
 const [form,setForm]=useState<Form>(makeForm())
 const load=useCallback(async()=>{
  if(!supabase||!user||!canRead){setLoading(false);return}
  setLoading(true);setError('')
  try{
   const [itemResult,categoryResult,movementResult]=await Promise.all([
    supabase.from('institutional_records').select('id,institution_id,module_key,record_type,title,reference_code,description,status,quantity,amount,payload,created_at,updated_at').eq('institution_id',user.institutionId).eq('module_key','inventory').in('record_type',['item-catalogue','items-management']).order('title').limit(3000),
    supabase.from('institutional_records').select('id,institution_id,module_key,record_type,title,reference_code,description,status,payload,created_at,updated_at').eq('institution_id',user.institutionId).eq('module_key','inventory').eq('record_type','item-category').order('title').limit(1000),
    supabase.from('inventory_movements').select('id,item_record_id,movement_type,quantity,unit_cost,movement_date,reference_code,notes').eq('institution_id',user.institutionId).order('movement_date',{ascending:false}).limit(5000)
   ])
   for(const result of [itemResult,categoryResult,movementResult])if(result.error)throw result.error
   setItems((itemResult.data??[]) as InventoryRecord[])
   setCategories((categoryResult.data??[]) as InventoryRecord[])
   setMovements((movementResult.data??[]) as Movement[])
  }catch(e){setError(e instanceof Error?e.message:'Inventory records could not be loaded.')}
  finally{setLoading(false)}
 },[user?.id,user?.institutionId,canRead])
 useEffect(()=>{void load()},[load])
 const movementMap=useMemo(()=>{
  const map=new Map<string,Movement[]>()
  for(const row of movements){const rows=map.get(row.item_record_id)??[];rows.push(row);map.set(row.item_record_id,rows)}
  return map
 },[movements])
 const stockRows=useMemo(()=>items.map(item=>{
  const rows=movementMap.get(item.id)??[]
  const delta=rows.reduce((sum,row)=>sum+(['stock_in','return','adjustment'].includes(row.movement_type)?safeNum(row.quantity):-safeNum(row.quantity)),0)
  const opening=safeNum(item.quantity)
  const available=Math.max(0,opening+delta)
  return {...item,opening,available,movementCount:rows.length,reorder:safeNum(item.payload?.reorder_level)}
 }),[items,movementMap])
 const lowStock=stockRows.filter(row=>row.reorder>0&&row.available<=row.reorder)
 const visibleItems=useMemo(()=>stockRows.filter(row=>[row.title,row.reference_code,row.payload?.sku,row.payload?.category_name,row.payload?.supplier,row.payload?.storage_location,row.status].join(' ').toLowerCase().includes(search.toLowerCase().trim())),[stockRows,search])
 const visibleCategories=useMemo(()=>categories.filter(row=>[row.title,row.reference_code,row.description].join(' ').toLowerCase().includes(search.toLowerCase().trim())),[categories,search])
 const beginCreate=()=>{
  if(!canEdit){onToast('Your role can view inventory but cannot change catalogue records.',true);return}
  setEditing(null);setForm(makeForm());setOpen(true)
 }
 const beginEdit=(row:InventoryRecord)=>{
  if(!canEdit)return
  setEditing(row)
  setForm({...makeForm(),title:row.title,reference_code:row.reference_code??'',description:row.description??'',category_id:String(row.payload?.category_id??''),unit:String(row.payload?.unit??'pcs'),unit_cost:String(row.amount??''),opening_quantity:String(row.quantity??0),reorder_level:String(row.payload?.reorder_level??0),supplier:String(row.payload?.supplier??''),storage_location:String(row.payload?.storage_location??''),status:row.status||'active'})
  setOpen(true)
 }
 async function saveRecord(event:FormEvent){
  event.preventDefault();if(!supabase||!user||!canEdit)return
  const title=form.title.trim()
  if(title.length<2){onToast('Enter an item or category name of at least two characters.',true);return}
  setSaving(true)
  try{
   if(config.kind==='categories'){
    const duplicate=categories.find(row=>row.id!==editing?.id&&row.title.trim().toLowerCase()===title.toLowerCase())
    if(duplicate)throw new Error('That item category already exists.')
    const values={institution_id:user.institutionId,module_key:'inventory',record_type:'item-category',title,reference_code:form.reference_code.trim()||null,description:form.description.trim()||null,status:form.status,payload:{description:form.description.trim()||null}}
    const result=editing
     ?await supabase.from('institutional_records').update({...values,updated_by:user.id}).eq('id',editing.id).eq('institution_id',user.institutionId).eq('module_key','inventory')
     :await supabase.from('institutional_records').insert({...values,created_by:user.id})
    if(result.error)throw result.error
    onToast(editing?'Category updated.':'Category created.')
   }else{
    const qty=Number(form.opening_quantity),unitCost=form.unit_cost.trim()===''?null:Number(form.unit_cost),reorder=Number(form.reorder_level)
    if(!Number.isFinite(qty)||qty<0)throw new Error('Opening stock must be a non-negative quantity.')
    if(unitCost!==null&&(!Number.isFinite(unitCost)||unitCost<0))throw new Error('Unit cost must be a non-negative amount.')
    if(!Number.isFinite(reorder)||reorder<0)throw new Error('Reorder level must be a non-negative quantity.')
    const duplicate=items.find(row=>row.id!==editing?.id&&form.reference_code.trim()&&String(row.reference_code??'').toLowerCase()===form.reference_code.trim().toLowerCase())
    if(duplicate)throw new Error('That SKU or item reference is already registered in this institution.')
    const category=categories.find(row=>row.id===form.category_id)
    const openingQuantity=editing&&(movementMap.get(editing.id)?.length??0)>0?safeNum(editing.quantity):qty
    const values={institution_id:user.institutionId,module_key:'inventory',record_type:'item-catalogue',title,reference_code:form.reference_code.trim()||null,description:form.description.trim()||null,status:form.status,quantity:openingQuantity,amount:unitCost,payload:{sku:form.reference_code.trim()||null,category_id:category?.id??null,category_name:category?.title??null,unit:form.unit||'pcs',unit_cost:unitCost,reorder_level:reorder,supplier:form.supplier.trim()||null,storage_location:form.storage_location.trim()||null}}
    const result=editing
     ?await supabase.from('institutional_records').update({...values,updated_by:user.id}).eq('id',editing.id).eq('institution_id',user.institutionId).eq('module_key','inventory')
     :await supabase.from('institutional_records').insert({...values,created_by:user.id})
    if(result.error)throw result.error
    if(editing&&movementMap.get(editing.id)?.length)onToast('Item details updated. Opening stock was preserved because this item already has movement history.')
    else onToast(editing?'Item updated.':'Item registered.')
   }
   setOpen(false);setEditing(null);await load()
  }catch(e){onToast(e instanceof Error?e.message:'Inventory record could not be saved.',true)}
  finally{setSaving(false)}
 }
 async function deleteRecord(row:InventoryRecord){
  if(!supabase||!user||!canDelete)return
  if(row.record_type!=='item-category'&&(movementMap.get(row.id)?.length??0)>0){onToast('This item has stock movement history. Archive it rather than deleting its ledger identity.',true);return}
  if(row.record_type==='item-category'&&items.some(item=>item.payload?.category_id===row.id)){onToast('This category is assigned to inventory items. Reassign those items before deleting it.',true);return}
  if(!window.confirm('Delete '+row.title+' from this institution inventory?'))return
  setSaving(true)
  try{const {error}=await supabase.from('institutional_records').delete().eq('id',row.id).eq('institution_id',user.institutionId).eq('module_key','inventory');if(error)throw error;onToast('Inventory record deleted.');await load()}
  catch(e){onToast(e instanceof Error?e.message:'Inventory record could not be deleted.',true)}
  finally{setSaving(false)}
 }
 const exportRows=()=>{
  downloadCsv('edusphere-inventory-'+page+'.csv',visibleItems.map(row=>({title:row.title,sku:row.reference_code??'',category:row.payload?.category_name??'',unit:row.payload?.unit??'',opening:row.opening,available:row.available,reorder:row.reorder,unit_cost:row.amount??'',supplier:row.payload?.supplier??'',location:row.payload?.storage_location??'',movements:row.movementCount})),[
   {key:'title',label:'Item'},{key:'sku',label:'SKU'},{key:'category',label:'Category'},{key:'unit',label:'Unit'},{key:'opening',label:'Opening stock'},{key:'available',label:'Available'},{key:'reorder',label:'Reorder level'},{key:'unit_cost',label:'Unit cost'},{key:'supplier',label:'Supplier'},{key:'location',label:'Storage location'},{key:'movements',label:'Movements'}
  ])
 }
 useEffect(()=>{
  if(!open)return
  const previous=document.body.style.overflow
  const keydown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!saving){setOpen(false);setEditing(null)}}
  document.body.style.overflow='hidden';window.addEventListener('keydown',keydown)
  return ()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',keydown)}
 },[open,saving])
 if(!user)return null
 return <main className="page-content ed360-module-page ed360-operation-management">
  <header className="ed360-operation-hero"><div className="ed360-operation-icon"><Boxes size={21}/></div><div className="ed360-operation-title"><span>INVENTORY / CATALOGUE & STOCK CONTROL</span><h1>{config.title}</h1><p>{config.description}</p></div><div className="ed360-operation-tools"><button type="button" className="button button-outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button>{config.kind!=='dashboard'&&canEdit&&<button type="button" className="button button-primary" onClick={beginCreate}><Plus size={15}/> Add {config.kind==='categories'?'category':'item'}</button>}</div></header>
  {loading&&<div className="ed360-workspace-empty">Loading inventory records…</div>}
  {error&&<section className="ed360-operation-error"><strong>Inventory records could not be loaded</strong><span>{error}</span><button type="button" className="button button-outline" onClick={()=>void load()}>Retry</button></section>}
  {config.kind==='dashboard'&&<><section className="ed360-operation-metrics">
   <article><span>Catalogue items</span><strong>{items.length}</strong><small>Institution-registered items</small></article>
   <article><span>Total available stock</span><strong>{fmt(stockRows.reduce((sum,row)=>sum+row.available,0))}</strong><small>After recorded movements</small></article>
   <article><span>Low-stock items</span><strong>{lowStock.length}</strong><small>At or below reorder levels</small></article>
   <article><span>Stock movements</span><strong>{movements.length}</strong><small>Auditable movement entries</small></article>
  </section><section className="ed360-operation-cards">
   <article><Layers3 size={19}/><h2>Item categories</h2><p>Maintain the inventory classification list.</p><button className="button button-outline" type="button" onClick={()=>onNavigate?.('institutional:inventory:item-categories')}>Manage categories</button></article>
   <article><Package size={19}/><h2>Item catalogue</h2><p>Manage SKU, storage location, supplier and opening stock.</p><button className="button button-outline" type="button" onClick={()=>onNavigate?.('institutional:inventory:item-catalogue')}>Open catalogue</button></article>
   <article><ArrowDownToLine size={19}/><h2>Receive / issue stock</h2><p>Use the protected stock ledger for every quantity change.</p><button className="button button-outline" type="button" onClick={()=>onNavigate?.('institutional:inventory:stock-in')}>Open stock ledger</button></article>
  </section><section className="ed360-operation-panel"><header><div><h2>Reorder attention</h2><p>Items whose available balance has reached the configured reorder threshold.</p></div></header>{lowStock.length===0?<p className="ed360-operation-empty">No low-stock items are currently detected.</p>:<div className="ed360-operation-table-wrap"><table><thead><tr><th>Item</th><th>Available</th><th>Reorder at</th><th>Supplier</th></tr></thead><tbody>{lowStock.map(row=><tr key={row.id}><td><strong>{row.title}</strong><small>{row.reference_code??'No SKU'}</small></td><td>{fmt(row.available)}</td><td>{fmt(row.reorder)}</td><td>{row.payload?.supplier??'—'}</td></tr>)}</tbody></table></div>}</section></>}
  {config.kind!=='dashboard'&&<section className="ed360-operation-panel">
   <div className="ed360-operation-toolbar"><label><Search size={15}/><input aria-label="Search inventory" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search by item, SKU, supplier or category…"/></label><div><span>{config.kind==='items'?visibleItems.length:visibleCategories.length} record(s)</span>{config.kind==='items'&&<button type="button" className="button button-outline" onClick={exportRows} disabled={!visibleItems.length}><Download size={14}/> Export CSV</button>}</div></div>
   {config.kind==='categories'?visibleCategories.length===0?<div className="ed360-operation-empty">No inventory categories have been created yet.</div>:<div className="ed360-operation-table-wrap"><table><thead><tr><th>Category</th><th>Reference</th><th>Description</th><th>Actions</th></tr></thead><tbody>{visibleCategories.map(row=><tr key={row.id}><td><strong>{row.title}</strong></td><td>{row.reference_code??'—'}</td><td>{row.description??'—'}</td><td><div className="ed360-operation-actions"><button title="Edit category" onClick={()=>beginEdit(row)}><Pencil size={14}/></button>{canDelete&&<button title="Delete category" onClick={()=>void deleteRecord(row)}><Trash2 size={14}/></button>}</div></td></tr>)}</tbody></table></div>:visibleItems.length===0?<div className="ed360-operation-empty">No inventory items match this search.</div>:<div className="ed360-operation-table-wrap"><table><thead><tr><th>Item / SKU</th><th>Category</th><th>Available</th><th>Reorder level</th><th>Unit cost</th><th>Storage / supplier</th><th>Actions</th></tr></thead><tbody>{visibleItems.map(row=><tr key={row.id}><td><strong>{row.title}</strong><small>{row.reference_code??'No SKU'} · {row.status}</small></td><td>{row.payload?.category_name??'Uncategorised'}</td><td><strong>{fmt(row.available)}</strong><small>Opening {fmt(row.opening)}</small></td><td>{row.reorder?fmt(row.reorder):'—'} {row.reorder&&row.available<=row.reorder?<em>Low stock</em>:''}</td><td>{row.amount===null?'—':fmt(safeNum(row.amount))}</td><td>{row.payload?.storage_location??'—'}<small>{row.payload?.supplier??''}</small></td><td><div className="ed360-operation-actions"><button title="Edit item" onClick={()=>beginEdit(row)}><Pencil size={14}/></button>{canDelete&&<button title="Delete item" onClick={()=>void deleteRecord(row)}><Trash2 size={14}/></button>}</div></td></tr>)}</tbody></table></div>}
  </section>}
  {open&&<div className="ed360-operation-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget){setOpen(false);setEditing(null)}}}><section className="ed360-operation-modal" role="dialog" aria-modal="true" aria-labelledby="ed360-inventory-form-title"><header><div><span>INSTITUTION INVENTORY</span><h2 id="ed360-inventory-form-title">{editing?'Edit':'Add'} {config.kind==='categories'?'item category':'inventory item'}</h2><p>Changes are stored in this institution’s inventory register.</p></div><button type="button" onClick={()=>{setOpen(false);setEditing(null)}} aria-label="Close"><span>×</span></button></header><form onSubmit={saveRecord}><div className="ed360-operation-form-grid">
   <label className="span-two">Name *<input required minLength={2} value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))}/></label>
   <label>Reference / SKU<input value={form.reference_code} onChange={e=>setForm(v=>({...v,reference_code:e.target.value}))}/></label>
   {config.kind==='categories'?<label>Description<input value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/></label>:<>
    <label>Category<select value={form.category_id} onChange={e=>setForm(v=>({...v,category_id:e.target.value}))}><option value="">Uncategorised</option>{categories.map(row=><option key={row.id} value={row.id}>{row.title}</option>)}</select></label>
    <label>Unit<select value={form.unit} onChange={e=>setForm(v=>({...v,unit:e.target.value}))}><option value="pcs">Pieces</option><option value="box">Box</option><option value="pack">Pack</option><option value="kg">Kilogram</option><option value="litre">Litre</option><option value="ream">Ream</option><option value="unit">Unit</option></select></label>
    <label>Opening stock<input type="number" min="0" step="0.001" value={form.opening_quantity} disabled={Boolean(editing&&movementMap.get(editing.id)?.length)} onChange={e=>setForm(v=>({...v,opening_quantity:e.target.value}))}/></label>
    <label>Reorder level<input type="number" min="0" step="0.001" value={form.reorder_level} onChange={e=>setForm(v=>({...v,reorder_level:e.target.value}))}/></label>
    <label>Unit cost<input type="number" min="0" step="0.01" value={form.unit_cost} onChange={e=>setForm(v=>({...v,unit_cost:e.target.value}))}/></label>
    <label>Supplier<input value={form.supplier} onChange={e=>setForm(v=>({...v,supplier:e.target.value}))}/></label>
    <label>Storage location<input value={form.storage_location} onChange={e=>setForm(v=>({...v,storage_location:e.target.value}))}/></label>
    <label>Status<select value={form.status} onChange={e=>setForm(v=>({...v,status:e.target.value}))}><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></select></label>
    <label className="span-two">Description<textarea rows={3} value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/></label>
   </>}
  </div><footer><span>Institution-scoped record · Stock ledger stays separate</span><div><button className="button button-outline" type="button" onClick={()=>setOpen(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving?'Saving…':'Save'}</button></div></footer></form></section></div>}
 </main>
}
