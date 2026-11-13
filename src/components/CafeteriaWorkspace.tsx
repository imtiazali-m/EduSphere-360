import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Coffee, Download, Package, RefreshCw, ShoppingBasket, Utensils } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/data-management.css'

type Row=Record<string,any>&{id:string}
type Item={id:string;title:string;quantity:number|null;payload:Record<string,unknown>}
const titleByPage:Record<string,string>={
 'cafeteria-dashboard':'Cafeteria Dashboard','menu-price-list':'Menu & Price List',
 'daily-availability':'Daily Availability','sales-transactions':'Sales Transactions',
 'meal-plans':'Meal Plans','cafeteria-inventory':'Cafeteria Inventory','cafeteria-reports':'Cafeteria Reports'
}
const info:Record<string,string>={
 'cafeteria-dashboard':'Monitor today’s menu availability, sales, serving counts and stock-linked menu items.',
 'menu-price-list':'Maintain cafeteria menu items, prices, categories and optional links to inventory stock items.',
 'daily-availability':'Set the quantity of each menu item available for a specific service date.',
 'sales-transactions':'Record a cafeteria sale against today’s available items. Daily servings and linked inventory stock are updated transactionally.',
 'meal-plans':'Maintain meal-plan offers, audience, meal period, price and validity dates.',
 'cafeteria-inventory':'Review menu items linked to the institution inventory stock ledger.',
 'cafeteria-reports':'Review sales, serving volumes and menu performance from saved cafeteria transactions.'
}
const money=(v:unknown)=>'PKR '+Number(v??0).toLocaleString(undefined,{maximumFractionDigits:2})
const label=(v:unknown)=>String(v??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const day=()=>new Date().toISOString().slice(0,10)
export function CafeteriaWorkspace({workspaceKey,onToast}:{workspaceKey:string;onToast:(message:string,error?:boolean)=>void}){
 const {user}=useAuth()
 const page=workspaceKey.split(':').slice(-1)[0]
 const title=titleByPage[page]??'Cafeteria Operations'
 const ownerAdmin=Boolean(user&&['owner','admin'].includes(user.role))
 const finance=Boolean(user&&['owner','admin','accountant'].includes(user.role))
 const [menu,setMenu]=useState<Row[]>([])
 const [availability,setAvailability]=useState<Row[]>([])
 const [plans,setPlans]=useState<Row[]>([])
 const [sales,setSales]=useState<Row[]>([])
 const [saleItems,setSaleItems]=useState<Row[]>([])
 const [inventory,setInventory]=useState<Item[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [search,setSearch]=useState('')
 const [menuForm,setMenuForm]=useState<Record<string,string>>({})
 const [availabilityForm,setAvailabilityForm]=useState<Record<string,string>>({availability_date:day()})
 const [planForm,setPlanForm]=useState<Record<string,string>>({})
 const [saleForm,setSaleForm]=useState<Record<string,string>>({buyer_type:'walk_in',payment_method:'cash',payment_status:'paid'})
 const [saleLines,setSaleLines]=useState<{menu_item_id:string;quantity:string}[]>([])
 const [selectedMenu,setSelectedMenu]=useState('')
 const [selectedQuantity,setSelectedQuantity]=useState('1')
 const [detailSale,setDetailSale]=useState('')
 async function load(){
  if(!supabase||!user){setLoading(false);setError('The cloud database is not available.');return}
  setLoading(true);setError('')
  try{
   const [m,a,p,s,si,inv]=await Promise.all([
    supabase.from('cafeteria_menu_items').select('*').eq('institution_id',user.institutionId).order('name'),
    supabase.from('cafeteria_daily_availability').select('*').eq('institution_id',user.institutionId).order('availability_date',{ascending:false}).limit(1000),
    supabase.from('cafeteria_meal_plans').select('*').eq('institution_id',user.institutionId).order('name'),
    supabase.from('cafeteria_sales').select('*').eq('institution_id',user.institutionId).order('sale_at',{ascending:false}).limit(1000),
    supabase.from('cafeteria_sale_items').select('*').eq('institution_id',user.institutionId),
    supabase.from('institutional_records').select('id,title,quantity,payload').eq('institution_id',user.institutionId).eq('module_key','inventory').in('record_type',['items-management','item-catalogue']).order('title')
   ])
   for(const x of [m,a,p,s,si,inv])if(x.error)throw x.error
   setMenu((m.data??[]) as Row[]);setAvailability((a.data??[]) as Row[]);setPlans((p.data??[]) as Row[])
   setSales((s.data??[]) as Row[]);setSaleItems((si.data??[]) as Row[]);setInventory((inv.data??[]) as Item[])
  }catch(e){const msg=e instanceof Error?e.message:'Cafeteria records could not be loaded.';setError(msg);onToast(msg,true)}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[user?.id,user?.institutionId])
 const todayAvailability=availability.filter(x=>x.availability_date===day())
 const remaining=(id:string)=>{
  const row=todayAvailability.find(x=>x.menu_item_id===id)
  return row?Math.max(0,Number(row.quantity_available)-Number(row.quantity_sold)):0
 }
 const todaySales=sales.filter(x=>String(x.sale_at).slice(0,10)===day())
 const todayRevenue=todaySales.filter(x=>x.payment_status!=='void').reduce((n,x)=>n+Number(x.total_amount),0)
 const soldCount=saleItems.filter(x=>todaySales.some(s=>s.id===x.sale_id)).reduce((n,x)=>n+Number(x.quantity),0)
 const visibleMenu=menu.filter(x=>!search||[x.name,x.menu_code,x.category,x.meal_period].join(' ').toLowerCase().includes(search.toLowerCase()))
 const visibleSales=sales.filter(x=>!search||[x.receipt_number,x.buyer_label,x.buyer_type,x.payment_status].join(' ').toLowerCase().includes(search.toLowerCase()))
 const setField=(setter:typeof setMenuForm,key:string,value:string)=>setter(v=>({...v,[key]:value}))
 async function mutate(action:()=>Promise<void>,success:string){
  if(busy)return
  setBusy(true)
  try{await action();onToast(success);await load()}
  catch(e){onToast(e instanceof Error?e.message:'The cafeteria operation failed.',true)}
  finally{setBusy(false)}
 }
 async function saveMenu(event:FormEvent){
  event.preventDefault();if(!user||!ownerAdmin)return
  await mutate(async()=>{
   const {error}=await supabase!.from('cafeteria_menu_items').insert({
    institution_id:user.institutionId,menu_code:menuForm.menu_code.trim(),name:menuForm.name.trim(),
    category:menuForm.category||null,meal_period:menuForm.meal_period||'all_day',unit:menuForm.unit||'serving',
    unit_price:Number(menuForm.unit_price),stock_item_id:menuForm.stock_item_id||null,
    notes:menuForm.notes||null,is_active:true,created_by:user.id
   })
   if(error)throw error
   setMenuForm({})
  },'Menu item saved.')
 }
 async function saveAvailability(event:FormEvent){
  event.preventDefault();if(!user||!ownerAdmin)return
  await mutate(async()=>{
   const {error}=await supabase!.from('cafeteria_daily_availability').upsert({
    institution_id:user.institutionId,menu_item_id:availabilityForm.menu_item_id,
    availability_date:availabilityForm.availability_date,quantity_available:Number(availabilityForm.quantity_available),
    quantity_sold:0,status:'available',updated_by:user.id,updated_at:new Date().toISOString()
   },{onConflict:'institution_id,menu_item_id,availability_date'})
   if(error)throw error
   setAvailabilityForm({availability_date:day()})
  },'Daily availability saved.')
 }
 async function savePlan(event:FormEvent){
  event.preventDefault();if(!user||!ownerAdmin)return
  await mutate(async()=>{
   const {error}=await supabase!.from('cafeteria_meal_plans').insert({
    institution_id:user.institutionId,plan_code:planForm.plan_code.trim(),name:planForm.name.trim(),
    description:planForm.description||null,audience:planForm.audience||'all',meal_period:planForm.meal_period||'lunch',
    price:Number(planForm.price),starts_on:planForm.starts_on||null,ends_on:planForm.ends_on||null,
    max_servings_per_day:planForm.max_servings_per_day?Number(planForm.max_servings_per_day):null,status:'active',created_by:user.id
   })
   if(error)throw error
   setPlanForm({})
  },'Meal plan saved.')
 }
 function addSaleLine(){
  if(!selectedMenu||Number(selectedQuantity)<=0){onToast('Choose a menu item and quantity greater than zero.',true);return}
  const row=todayAvailability.find(x=>x.menu_item_id===selectedMenu)
  const inCart=saleLines.filter(x=>x.menu_item_id===selectedMenu).reduce((n,x)=>n+Number(x.quantity),0)
  if(!row||inCart+Number(selectedQuantity)>remaining(selectedMenu)){onToast('The quantity exceeds today’s remaining availability.',true);return}
  setSaleLines(current=>[...current.filter(x=>x.menu_item_id!==selectedMenu),{menu_item_id:selectedMenu,quantity:String(inCart+Number(selectedQuantity))}])
  setSelectedQuantity('1')
 }
 async function saveSale(event:FormEvent){
  event.preventDefault();if(!user||!ownerAdmin)return
  if(!saleLines.length){onToast('Add at least one menu item to the sale.',true);return}
  await mutate(async()=>{
   const {data,error}=await supabase!.rpc('record_cafeteria_sale',{
    p_institution_id:user.institutionId,p_receipt_number:'CAF-'+new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,5).toUpperCase(),
    p_buyer_label:saleForm.buyer_label||null,p_buyer_type:saleForm.buyer_type||'walk_in',
    p_payment_method:saleForm.payment_method||'cash',p_payment_status:saleForm.payment_status||'paid',
    p_lines:saleLines.map(line=>({menu_item_id:line.menu_item_id,quantity:Number(line.quantity)})),p_notes:saleForm.notes||null
   })
   if(error)throw error
   setSaleForm({buyer_type:'walk_in',payment_method:'cash',payment_status:'paid'});setSaleLines([])
   setSelectedMenu('');onToast('Cafeteria sale recorded. Daily serving availability and linked stock movements were updated.')
  },'Cafeteria sale recorded.')
 }
 async function updateMenuStatus(row:Row,is_active:boolean){
  if(!user||!ownerAdmin)return
  await mutate(async()=>{const {error}=await supabase!.from('cafeteria_menu_items').update({is_active,updated_at:new Date().toISOString()}).eq('institution_id',user!.institutionId).eq('id',row.id);if(error)throw error},is_active?'Menu item activated.':'Menu item deactivated.')
 }
 const field=(caption:string,key:string,setter:typeof setMenuForm,state:Record<string,string>,type='text',options?:{label:string;value:string}[],required=true)=><label>{caption}{options?<select required={required} value={state[key]??''} onChange={e=>setField(setter,key,e.target.value)}><option value="">Select {caption.toLowerCase()}</option>{options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>:<input required={required} type={type} value={state[key]??''} onChange={e=>setField(setter,key,e.target.value)}/>}</label>
 const menuFor=(id:string)=>menu.find(x=>x.id===id)
 const renderMenu=()=> <section className="ed360-data-card"><header><h2>Menu items and prices</h2><p>Menu items can link to a stock record so each recorded sale can reduce linked inventory.</p></header>{ownerAdmin&&<form className="ed360-data-form" onSubmit={saveMenu}>{field('Menu code','menu_code',setMenuForm,menuForm)}{field('Item name','name',setMenuForm,menuForm)}{field('Category','category',setMenuForm,menuForm,'text',undefined,false)}{field('Meal period','meal_period',setMenuForm,menuForm,'text',[{label:'Breakfast',value:'breakfast'},{label:'Lunch',value:'lunch'},{label:'Snack',value:'snack'},{label:'Dinner',value:'dinner'},{label:'All day',value:'all_day'}])}{field('Unit','unit',setMenuForm,menuForm,'text',undefined,false)}{field('Price (PKR)','unit_price',setMenuForm,menuForm,'number')}{field('Linked stock item','stock_item_id',setMenuForm,menuForm,'text',[{label:'No linked stock item',value:''},...inventory.map(i=>({label:i.title,value:i.id}))],false)}<label>Notes<textarea value={menuForm.notes??''} onChange={e=>setField(setMenuForm,'notes',e.target.value)}/></label><button className="button button-primary" disabled={busy}>Add menu item</button></form>}<div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search menu…" aria-label="Search menu"/></div><div className="table-scroll"><table><thead><tr><th>Code</th><th>Item</th><th>Category</th><th>Meal</th><th>Price</th><th>Stock link</th><th>Status</th><th>Action</th></tr></thead><tbody>{visibleMenu.map(row=><tr key={row.id}><td>{row.menu_code}</td><td>{row.name}</td><td>{row.category??'—'}</td><td>{label(row.meal_period)}</td><td>{money(row.unit_price)}</td><td>{inventory.find(i=>i.id===row.stock_item_id)?.title??(row.stock_item_id?'Stock record':'Not linked')}</td><td>{row.is_active?'Active':'Inactive'}</td><td>{ownerAdmin&&<button type="button" className="button button-outline" onClick={()=>void updateMenuStatus(row,!row.is_active)}>{row.is_active?'Deactivate':'Activate'}</button>}</td></tr>)}</tbody></table></div></section>
 const renderAvailability=()=> <section className="ed360-data-card"><header><h2>Daily menu availability</h2><p>Set how many servings can be sold for each date. Sales reduce the remaining amount in a database transaction.</p></header>{ownerAdmin&&<form className="ed360-data-form" onSubmit={saveAvailability}>{field('Menu item','menu_item_id',setAvailabilityForm,availabilityForm,'text',menu.filter(m=>m.is_active).map(m=>({label:m.name+' · '+money(m.unit_price),value:m.id})))}{field('Date','availability_date',setAvailabilityForm,availabilityForm,'date')}{field('Quantity available','quantity_available',setAvailabilityForm,availabilityForm,'number') }<button className="button button-primary" disabled={busy}>Save availability</button></form>}<div className="table-scroll"><table><thead><tr><th>Date</th><th>Menu item</th><th>Available</th><th>Sold</th><th>Remaining</th><th>Status</th></tr></thead><tbody>{availability.filter(x=>!search||[menuFor(x.menu_item_id)?.name,x.availability_date,x.status].join(' ').toLowerCase().includes(search.toLowerCase())).map(row=><tr key={row.id}><td>{row.availability_date}</td><td>{menuFor(row.menu_item_id)?.name??'Menu item'}</td><td>{row.quantity_available}</td><td>{row.quantity_sold}</td><td>{Number(row.quantity_available)-Number(row.quantity_sold)}</td><td>{label(row.status)}</td></tr>)}</tbody></table></div></section>
 const renderPlans=()=> <section className="ed360-data-card"><header><h2>Meal plan catalogue</h2><p>Define available meal offers and validity periods. This register does not issue subscriptions or automatically bill a student account.</p></header>{ownerAdmin&&<form className="ed360-data-form" onSubmit={savePlan}>{field('Plan code','plan_code',setPlanForm,planForm)}{field('Plan name','name',setPlanForm,planForm)}{field('Audience','audience',setPlanForm,planForm,'text',[{label:'Students',value:'students'},{label:'Staff',value:'staff'},{label:'All',value:'all'}])}{field('Meal period','meal_period',setPlanForm,planForm,'text',[{label:'Breakfast',value:'breakfast'},{label:'Lunch',value:'lunch'},{label:'Snack',value:'snack'},{label:'Dinner',value:'dinner'}])}{field('Price (PKR)','price',setPlanForm,planForm,'number')}{field('Starts on','starts_on',setPlanForm,planForm,'date',undefined,false)}{field('Ends on','ends_on',setPlanForm,planForm,'date',undefined,false)}{field('Max servings/day','max_servings_per_day',setPlanForm,planForm,'number',undefined,false)}<label>Description<textarea value={planForm.description??''} onChange={e=>setField(setPlanForm,'description',e.target.value)}/></label><button className="button button-primary" disabled={busy}>Save meal plan</button></form>}<div className="table-scroll"><table><thead><tr><th>Plan</th><th>Audience</th><th>Meal</th><th>Price</th><th>Validity</th><th>Status</th></tr></thead><tbody>{plans.map(p=><tr key={p.id}><td>{p.plan_code} · {p.name}</td><td>{label(p.audience)}</td><td>{label(p.meal_period)}</td><td>{money(p.price)}</td><td>{p.starts_on??'—'} to {p.ends_on??'—'}</td><td>{label(p.status)}</td></tr>)}</tbody></table></div></section>
 const renderSales=()=> <section className="ed360-data-card"><header><h2>Cafeteria sales transactions</h2><p>Choose items currently available today. Saving the sale reduces daily availability and linked inventory, if configured.</p></header>{ownerAdmin&&<form className="ed360-data-form" onSubmit={saveSale}>{field('Buyer type','buyer_type',setSaleForm,saleForm,'text',[{label:'Student',value:'student'},{label:'Staff',value:'staff'},{label:'Walk-in',value:'walk_in'},{label:'Meal plan',value:'meal_plan'}])}{field('Buyer / student reference','buyer_label',setSaleForm,saleForm,'text',undefined,false)}{field('Payment method','payment_method',setSaleForm,saleForm,'text',[{label:'Cash',value:'cash'},{label:'Card',value:'card'},{label:'Mobile wallet',value:'mobile_wallet'},{label:'On account',value:'account'}])}{field('Payment state','payment_status',setSaleForm,saleForm,'text',[{label:'Paid',value:'paid'},{label:'Unpaid',value:'unpaid'},{label:'On account',value:'on_account'}])}<label>Sale notes<textarea value={saleForm.notes??''} onChange={e=>setField(setSaleForm,'notes',e.target.value)}/></label><div className="ed360-cafe-addline"><label>Menu item<select value={selectedMenu} onChange={e=>setSelectedMenu(e.target.value)}><option value="">Select today’s available menu item</option>{menu.filter(m=>m.is_active&&remaining(m.id)>0).map(m=><option key={m.id} value={m.id}>{m.name} · {money(m.unit_price)} · {remaining(m.id)} left</option>)}</select></label><label>Quantity<input type="number" min="0.001" step="0.001" value={selectedQuantity} onChange={e=>setSelectedQuantity(e.target.value)}/></label><button className="button button-outline" type="button" onClick={addSaleLine}>Add item</button></div>{saleLines.length>0&&<div className="table-scroll"><table><thead><tr><th>Item</th><th>Quantity</th><th>Unit price</th><th>Line total</th><th/></tr></thead><tbody>{saleLines.map(row=>{const item=menuFor(row.menu_item_id);return <tr key={row.menu_item_id}><td>{item?.name}</td><td>{row.quantity}</td><td>{money(item?.unit_price)}</td><td>{money(Number(row.quantity)*Number(item?.unit_price))}</td><td><button className="button button-outline" type="button" onClick={()=>setSaleLines(current=>current.filter(x=>x.menu_item_id!==row.menu_item_id))}>Remove</button></td></tr>})}</tbody></table></div>}<button className="button button-primary" disabled={busy||saleLines.length===0}>Record cafeteria sale</button></form>}<div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search receipt or buyer…" aria-label="Search cafeteria sales"/></div><div className="table-scroll"><table><thead><tr><th>Receipt</th><th>Time</th><th>Buyer</th><th>Items</th><th>Total</th><th>Payment</th><th>Action</th></tr></thead><tbody>{visibleSales.map(s=><tr key={s.id}><td><b>{s.receipt_number}</b></td><td>{new Date(s.sale_at).toLocaleString()}</td><td>{s.buyer_label??label(s.buyer_type)}</td><td>{saleItems.filter(i=>i.sale_id===s.id).map(i=>menuFor(i.menu_item_id)?.name+' × '+i.quantity).join(', ')}</td><td>{money(s.total_amount)}</td><td>{label(s.payment_status)} · {label(s.payment_method)}</td><td><button className="button button-outline" type="button" onClick={()=>setDetailSale(detailSale===s.id?'':s.id)}>{detailSale===s.id?'Hide':'Details'}</button></td></tr>)}</tbody></table></div>{detailSale&&<section className="ed360-data-card"><h3>Sale details · {sales.find(x=>x.id===detailSale)?.receipt_number}</h3>{saleItems.filter(i=>i.sale_id===detailSale).map(i=><p key={i.id}>{menuFor(i.menu_item_id)?.name} · {i.quantity} × {money(i.unit_price)} = {money(i.line_total)}</p>)}</section>}</section>
 const renderDashboard=()=> <section className="ed360-workspace-kpis"><article><span>Menu items</span><strong>{menu.filter(m=>m.is_active).length}</strong><small>Active menu catalogue</small></article><article><span>Today availability</span><strong>{todayAvailability.length}</strong><small>Items with quantity set</small></article><article><span>Servings sold</span><strong>{soldCount}</strong><small>Across today’s sales</small></article><article><span>Today revenue</span><strong>{money(todayRevenue)}</strong><small>Not a bank reconciliation</small></article><article><span>Meal plans</span><strong>{plans.filter(p=>p.status==='active').length}</strong><small>Active meal plan definitions</small></article><article><span>Stock-linked menu</span><strong>{menu.filter(m=>m.stock_item_id).length}</strong><small>Sales post linked stock-out</small></article><section className="ed360-data-card"><h2>Today’s remaining servings</h2><div className="table-scroll"><table><thead><tr><th>Menu item</th><th>Available</th><th>Sold</th><th>Remaining</th></tr></thead><tbody>{todayAvailability.map(a=><tr key={a.id}><td>{menuFor(a.menu_item_id)?.name??'Menu item'}</td><td>{a.quantity_available}</td><td>{a.quantity_sold}</td><td>{Number(a.quantity_available)-Number(a.quantity_sold)}</td></tr>)}</tbody></table></div></section></section>
 const renderInventory=()=> <section className="ed360-data-card"><header><h2>Cafeteria stock links</h2><p>Menu items can optionally link to an institution inventory record. Each sale of a linked item posts a stock-out movement; unlinked menu items still track daily servings.</p></header><div className="table-scroll"><table><thead><tr><th>Menu item</th><th>Stock record</th><th>Current record quantity</th><th>Availability today</th><th>Sales linked</th></tr></thead><tbody>{menu.map(m=>{const stock=inventory.find(i=>i.id===m.stock_item_id);return <tr key={m.id}><td>{m.name}</td><td>{stock?.title??'Not linked'}</td><td>{stock?.quantity??stock?.payload?.quantity??'—'}</td><td>{remaining(m.id)}</td><td>{saleItems.filter(i=>i.menu_item_id===m.id).length}</td></tr>})}</tbody></table></div></section>
 const renderReports=()=> <section className="ed360-data-card"><header><h2>Cafeteria sales report</h2><p>Summary from recorded cafeteria transactions and daily availability. Cash/card/mobile payments are only marked as received when selected by the authorised operator.</p><button className="button button-outline" type="button" onClick={()=>window.print()}><Download size={15}/> Print</button></header><div className="ed360-workspace-kpis"><article><span>Sales</span><strong>{sales.length}</strong><small>All saved transactions</small></article><article><span>Paid total</span><strong>{money(sales.filter(s=>s.payment_status==='paid').reduce((n,s)=>n+Number(s.total_amount),0))}</strong><small>Operator-recorded paid state</small></article><article><span>Unpaid / account</span><strong>{sales.filter(s=>['unpaid','on_account'].includes(s.payment_status)).length}</strong><small>Requires collection</small></article><article><span>Servings</span><strong>{saleItems.reduce((n,s)=>n+Number(s.quantity),0)}</strong><small>All recorded sales lines</small></article></div><div className="table-scroll"><table><thead><tr><th>Menu item</th><th>Number of lines</th><th>Servings sold</th><th>Gross value</th></tr></thead><tbody>{menu.map(m=>{const rows=saleItems.filter(i=>i.menu_item_id===m.id);return <tr key={m.id}><td>{m.name}</td><td>{rows.length}</td><td>{rows.reduce((n,x)=>n+Number(x.quantity),0)}</td><td>{money(rows.reduce((n,x)=>n+Number(x.line_total),0))}</td></tr>})}</tbody></table></div></section>
 if(!user)return null
 if(!finance)return <main className="page-content ed360-module-page"><section className="ed360-workspace-empty">Cafeteria operations are available to the owner, administrator and accountant roles.</section></main>
 return <main className="page-content ed360-module-page ed360-cafeteria-workspace"><header className="ed360-workspace-hero"><div className="ed360-workspace-hero-icon"><Coffee size={21}/></div><div className="ed360-workspace-hero-copy"><span>INVENTORY / CAFETERIA</span><h1>{title}</h1><p>{info[page]??'Manage cafeteria menu, service and transactions.'}</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Institution-scoped service</span><button className="button button-outline" type="button" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div></header>{error&&<div className="ed360-data-error">{error}</div>}{loading?<div className="ed360-workspace-empty">Loading cafeteria records…</div>:null}
  {page==='cafeteria-dashboard'?renderDashboard():page==='menu-price-list'?renderMenu():page==='daily-availability'?renderAvailability():page==='sales-transactions'?renderSales():page==='meal-plans'?renderPlans():page==='cafeteria-inventory'?renderInventory():renderReports()}
 </main>
}
