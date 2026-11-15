import { useCallback,useEffect,useMemo,useState,type FormEvent } from 'react'
import { Bus,Download,Plus,RefreshCw,Route,Search,Wallet,Pencil,Trash2,Truck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { downloadCsv } from '../lib/csv'
import { userFacingError } from '../lib/userErrors'
import '../styles/operation-management.css'

type FleetType='vehicle-management'|'drivers-management'|'transport-routes'|'route-stops'|'vehicle-maintenance'
type FleetRecord={id:string;institution_id:string;module_key:string;record_type:FleetType;parent_record_id:string|null;title:string;reference_code:string|null;description:string|null;status:string;payload:Record<string,any>;created_at:string;updated_at:string}
type Allocation={id:string;student_id:string;route_record_id:string;stop_record_id:string|null;vehicle_record_id:string|null;effective_from:string;effective_to:string|null;transport_fee:number;status:string;notes:string|null}
type Student={id:string;full_name:string;admission_no:string|null;class_name:string|null}
type FeeCharge={id:string;allocation_id:string;billing_period:string;amount:number;paid_amount:number;due_date:string;status:string;created_at:string}
type FeePayment={id:string;charge_id:string;amount:number;payment_method:string;payment_reference:string|null;received_at:string}
type AttendanceEvent={id:string;allocation_id:string;event_type:string;occurred_at:string;source:string;notes:string|null}
type Props={workspaceKey:string;onToast:(message:string,error?:boolean)=>void;onNavigate?:(key:string)=>void}
type Form=Record<string,string>
const pages:Record<string,{title:string;description:string;type?:FleetType;kind?:'dashboard'|'allocation'|'fees'|'history'}>={
 'transport-dashboard':{title:'Transport Dashboard',description:'Fleet readiness, active routes, allocation coverage and current transport operations.',kind:'dashboard'},
 'vehicle-management':{title:'Vehicle Management',description:'Register institution vehicles, seat capacity, compliance dates and assigned drivers.',type:'vehicle-management'},
 'drivers-management':{title:'Drivers Management',description:'Maintain the authorised driver directory and licence verification dates.',type:'drivers-management'},
 'transport-routes':{title:'Transport Routes',description:'Create institution routes and maintain their reference codes, start points and schedules.',type:'transport-routes'},
 'route-stops':{title:'Route Stops',description:'Register ordered pickup and drop-off stops under the correct transport route.',type:'route-stops'},
 'vehicle-maintenance':{title:'Vehicle Maintenance',description:'Record service work, inspections, costs and next maintenance dates against each vehicle.',type:'vehicle-maintenance'},
 'transport-assignments':{title:'Transport Assignments',description:'Review active learner allocations and their route, stop, vehicle and validity dates.',kind:'allocation'},
 'transport-history':{title:'Transport History',description:'Review learner transport allocation periods and recorded boarding or alighting events.',kind:'history'},
 'transport-fees':{title:'Transport Fees',description:'Generate monthly charges from active allocations and record controlled partial or full payments.',kind:'fees'}
}
const newForm=():Form=>({title:'',reference_code:'',description:'',status:'active',plate_number:'',vehicle_type:'Bus',make_model:'',seat_capacity:'',registration_expiry:'',insurance_expiry:'',inspection_due:'',driver_record_id:'',phone:'',license_number:'',license_class:'',license_expiry:'',employee_reference:'',route_code:'',start_location:'',end_location:'',departure_time:'',return_time:'',estimated_minutes:'',route_record_id:'',stop_sequence:'1',stop_address:'',pickup_time:'',monthly_fee:'',service_date:new Date().toISOString().slice(0,10),next_service_date:'',maintenance_cost:'',provider:'',billing_period:new Date().toISOString().slice(0,7),due_date:new Date().toISOString().slice(0,10),amount:'',payment_method:'cash',payment_reference:''})
const number=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0
const money=(v:number)=>new Intl.NumberFormat(undefined,{style:'currency',currency:'PKR',maximumFractionDigits:0}).format(v)
const asDate=(v:string|undefined)=>v?new Date(v).toLocaleDateString():'—'
export function TransportManagementWorkspace({workspaceKey,onToast,onNavigate}:Props){
 const {user}=useAuth()
 const page=workspaceKey.split(':').slice(-1)[0]||'transport-dashboard'
 const config=pages[page]??pages['transport-dashboard']
 const canManage=Boolean(user&&['owner','admin'].includes(user.role))
 const canFinance=Boolean(user&&['owner','admin','accountant'].includes(user.role))
 const canReadStaff=Boolean(user&&['owner','admin','teacher','accountant'].includes(user.role))
 const [records,setRecords]=useState<FleetRecord[]>([])
 const [allocations,setAllocations]=useState<Allocation[]>([])
 const [students,setStudents]=useState<Student[]>([])
 const [charges,setCharges]=useState<FeeCharge[]>([])
 const [payments,setPayments]=useState<FeePayment[]>([])
 const [events,setEvents]=useState<AttendanceEvent[]>([])
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [search,setSearch]=useState('')
 const [open,setOpen]=useState(false)
 const [editing,setEditing]=useState<FleetRecord|null>(null)
 const [form,setForm]=useState<Form>(newForm())
 const [chargeAllocation,setChargeAllocation]=useState('')
 const [paymentCharge,setPaymentCharge]=useState('')
 const [paymentAmount,setPaymentAmount]=useState('')
 const [paymentMethod,setPaymentMethod]=useState('cash')
 const [paymentReference,setPaymentReference]=useState('')
 const [billingPeriod,setBillingPeriod]=useState(new Date().toISOString().slice(0,7))
 const [dueDate,setDueDate]=useState(new Date().toISOString().slice(0,10))
 const load=useCallback(async()=>{
  if(!supabase||!user){setLoading(false);return}
  setLoading(true);setError('')
  try{
   const recordQuery=supabase.from('institutional_records').select('id,institution_id,module_key,record_type,parent_record_id,title,reference_code,description,status,payload,created_at,updated_at').eq('institution_id',user.institutionId).eq('module_key','transport').in('record_type',['vehicle-management','drivers-management','transport-routes','route-stops','vehicle-maintenance']).order('title').limit(3000)
   const allocationQuery=supabase.from('student_transport_allocations').select('id,student_id,route_record_id,stop_record_id,vehicle_record_id,effective_from,effective_to,transport_fee,status,notes').eq('institution_id',user.institutionId).order('created_at',{ascending:false}).limit(5000)
   const chargeQuery=supabase.from('student_transport_fee_charges').select('id,allocation_id,billing_period,amount,paid_amount,due_date,status,created_at').eq('institution_id',user.institutionId).order('due_date',{ascending:false}).limit(5000)
   const paymentQuery=supabase.from('student_transport_fee_payments').select('id,charge_id,amount,payment_method,payment_reference,received_at').eq('institution_id',user.institutionId).order('received_at',{ascending:false}).limit(5000)
   const eventQuery=canReadStaff?supabase.from('transport_attendance_events').select('id,allocation_id,event_type,occurred_at,source,notes').eq('institution_id',user.institutionId).order('occurred_at',{ascending:false}).limit(5000):Promise.resolve({data:[],error:null} as any)
   const studentQuery=supabase.from('students').select('id,full_name,admission_no,class_name').eq('institution_id',user.institutionId).order('full_name').limit(5000)
   const [r,a,c,p,e,s]=await Promise.all([recordQuery,allocationQuery,chargeQuery,paymentQuery,eventQuery,studentQuery])
   for(const result of [r,a,c,p,e,s])if(result.error)throw result.error
   setRecords((r.data??[]) as FleetRecord[]);setAllocations((a.data??[]) as Allocation[])
   setCharges((c.data??[]) as FeeCharge[]);setPayments((p.data??[]) as FeePayment[])
   setEvents((e.data??[]) as AttendanceEvent[]);setStudents((s.data??[]) as Student[])
  }catch(e){setError(e instanceof Error?e.message:'Transport records could not be loaded.')}
  finally{setLoading(false)}
 },[user?.id,user?.institutionId,canReadStaff])
 useEffect(()=>{void load()},[load])
 const vehicles=useMemo(()=>records.filter(r=>r.record_type==='vehicle-management'),[records])
 const drivers=useMemo(()=>records.filter(r=>r.record_type==='drivers-management'),[records])
 const routes=useMemo(()=>records.filter(r=>r.record_type==='transport-routes'),[records])
 const stops=useMemo(()=>records.filter(r=>r.record_type==='route-stops'),[records])
 const maintenance=useMemo(()=>records.filter(r=>r.record_type==='vehicle-maintenance'),[records])
 const activeAllocations=useMemo(()=>allocations.filter(a=>a.status==='active'),[allocations])
 const dueCharges=charges.reduce((sum,c)=>sum+Math.max(0,number(c.amount)-number(c.paid_amount)),0)
 const paymentsByCharge=useMemo(()=>{const m=new Map<string,FeePayment[]>();for(const row of payments){const list=m.get(row.charge_id)??[];list.push(row);m.set(row.charge_id,list)}return m},[payments])
 const studentMap=useMemo(()=>new Map(students.map(s=>[s.id,s])),[students])
 const routeMap=useMemo(()=>new Map(routes.map(r=>[r.id,r])),[routes])
 const vehicleMap=useMemo(()=>new Map(vehicles.map(r=>[r.id,r])),[vehicles])
 const driverMap=useMemo(()=>new Map(drivers.map(r=>[r.id,r])),[drivers])
 const visibleRecords=useMemo(()=>{
  const type=config.type
  const source=type?records.filter(r=>r.record_type===type):records
  const q=search.trim().toLowerCase()
  return source.filter(r=>!q||[r.title,r.reference_code,r.description,r.status,r.payload?.plate_number,r.payload?.license_number,r.payload?.route_code,r.payload?.start_location,r.payload?.end_location,r.payload?.stop_address,r.payload?.provider].join(' ').toLowerCase().includes(q))
 },[records,config.type,search])
 const visibleAllocations=useMemo(()=>allocations.filter(a=>{
  const s=studentMap.get(a.student_id),r=routeMap.get(a.route_record_id),v=vehicleMap.get(String(a.vehicle_record_id??''))
  return !search.trim()||[s?.full_name,s?.admission_no,r?.title,v?.title,a.status,a.effective_from,a.effective_to,a.transport_fee].join(' ').toLowerCase().includes(search.toLowerCase().trim())
 }),[allocations,studentMap,routeMap,vehicleMap,search])
 const visibleCharges=useMemo(()=>charges.filter(c=>{
  const allocation=allocations.find(a=>a.id===c.allocation_id),student=allocation?studentMap.get(allocation.student_id):undefined
  return !search.trim()||[student?.full_name,student?.admission_no,c.billing_period,c.status,c.due_date].join(' ').toLowerCase().includes(search.toLowerCase().trim())
 }),[charges,allocations,studentMap,search])
 function update(key:string,value:string){setForm(f=>({...f,[key]:value}))}
 function startCreate(){
  if(!canManage||!config.type){onToast('Only the institution owner or administrator can manage fleet records.',true);return}
  setEditing(null);setForm(newForm());setOpen(true)
 }
 function startEdit(row:FleetRecord){
  if(!canManage)return
  const p=row.payload??{}
  setEditing(row)
  setForm({...newForm(),title:row.title,reference_code:row.reference_code??'',description:row.description??'',status:row.status,
   plate_number:String(p.plate_number??''),vehicle_type:String(p.vehicle_type??'Bus'),make_model:String(p.make_model??''),seat_capacity:String(p.seat_capacity??''),
   registration_expiry:String(p.registration_expiry??''),insurance_expiry:String(p.insurance_expiry??''),inspection_due:String(p.inspection_due??''),driver_record_id:String(p.vehicle_record_id??p.driver_record_id??''),
   phone:String(p.phone??''),license_number:String(p.license_number??''),license_class:String(p.license_class??''),license_expiry:String(p.license_expiry??''),employee_reference:String(p.employee_reference??''),
   route_code:String(p.route_code??row.reference_code??''),start_location:String(p.start_location??''),end_location:String(p.end_location??''),departure_time:String(p.departure_time??''),return_time:String(p.return_time??''),estimated_minutes:String(p.estimated_minutes??''),
   route_record_id:String(row.parent_record_id??p.route_record_id??''),stop_sequence:String(p.stop_sequence??'1'),stop_address:String(p.stop_address??''),pickup_time:String(p.pickup_time??''),
   monthly_fee:String(p.monthly_fee??''),service_date:String(p.service_date??''),next_service_date:String(p.next_service_date??''),maintenance_cost:String(p.maintenance_cost??''),provider:String(p.provider??'')})
  setOpen(true)
 }
 async function saveFleetRecord(event:FormEvent){
  event.preventDefault();if(!supabase||!user||!canManage||!config.type)return
  const title=form.title.trim()
  if(title.length<2){onToast('Enter a name with at least two characters.',true);return}
  let parentId:string|null=null,payload:Record<string,unknown>={}
  if(config.type==='vehicle-management'){
   const capacity=Number(form.seat_capacity)
   if(!Number.isInteger(capacity)||capacity<1){onToast('Seat capacity must be a whole number greater than zero.',true);return}
   if(form.plate_number.trim()&&vehicles.some(r=>r.id!==editing?.id&&String(r.payload?.plate_number??'').toLowerCase()===form.plate_number.trim().toLowerCase())){onToast('That vehicle registration number is already in use.',true);return}
   payload={plate_number:form.plate_number.trim()||null,vehicle_type:form.vehicle_type,make_model:form.make_model.trim()||null,seat_capacity:capacity,registration_expiry:form.registration_expiry||null,insurance_expiry:form.insurance_expiry||null,inspection_due:form.inspection_due||null,driver_record_id:form.driver_record_id||null}
  }else if(config.type==='drivers-management'){
   if(form.license_number.trim()&&drivers.some(r=>r.id!==editing?.id&&String(r.payload?.license_number??'').toLowerCase()===form.license_number.trim().toLowerCase())){onToast('That driver licence number is already registered.',true);return}
   payload={phone:form.phone.trim()||null,license_number:form.license_number.trim()||null,license_class:form.license_class.trim()||null,license_expiry:form.license_expiry||null,employee_reference:form.employee_reference.trim()||null}
  }else if(config.type==='transport-routes'){
   const fee=form.monthly_fee.trim()?Number(form.monthly_fee):0
   const duration=form.estimated_minutes.trim()?Number(form.estimated_minutes):null
   if(!form.route_code.trim()){onToast('A route code is required for allocation and stop matching.',true);return}
   if(!Number.isFinite(fee)||fee<0||duration!==null&&(!Number.isInteger(duration)||duration<1)){onToast('Check route fee and estimated journey minutes.',true);return}
   if(routes.some(r=>r.id!==editing?.id&&String(r.payload?.route_code??r.reference_code??'').toLowerCase()===form.route_code.trim().toLowerCase())){onToast('That route code is already registered.',true);return}
   payload={route_code:form.route_code.trim(),start_location:form.start_location.trim()||null,end_location:form.end_location.trim()||null,departure_time:form.departure_time||null,return_time:form.return_time||null,estimated_minutes:duration,monthly_fee:fee}
  }else if(config.type==='route-stops'){
   const route=routes.find(r=>r.id===form.route_record_id)
   const sequence=Number(form.stop_sequence)
   if(!route){onToast('Select a route registered by this institution.',true);return}
   if(!Number.isInteger(sequence)||sequence<1){onToast('Stop order must be a whole number starting at one.',true);return}
   const duplicateStop=stops.find(stop=>stop.id!==editing?.id&&stop.parent_record_id===route.id&&number(stop.payload?.stop_sequence)===sequence)
   if(duplicateStop){onToast('That stop sequence is already used on this route.',true);return}
   parentId=route.id
   payload={route_record_id:route.id,route_code:String(route.payload?.route_code??route.reference_code??''),stop_sequence:sequence,stop_address:form.stop_address.trim()||null,pickup_time:form.pickup_time||null}
  }else{
   const vehicle=vehicles.find(v=>v.id===form.driver_record_id)
   const cost=form.maintenance_cost.trim()?Number(form.maintenance_cost):0
   if(!vehicle){onToast('Select a vehicle registered by this institution.',true);return}
   if(!form.service_date){onToast('Enter the maintenance or inspection date.',true);return}
   if(!Number.isFinite(cost)||cost<0){onToast('Maintenance cost must be non-negative.',true);return}
   parentId=vehicle.id
   payload={vehicle_record_id:vehicle.id,vehicle_name:vehicle.title,service_date:form.service_date,next_service_date:form.next_service_date||null,maintenance_cost:cost,provider:form.provider.trim()||null}
  }
  const duplicate=records.find(r=>r.id!==editing?.id&&r.record_type===config.type&&form.reference_code.trim()&&String(r.reference_code??'').toLowerCase()===form.reference_code.trim().toLowerCase())
  if(duplicate){onToast('That reference code already exists in this transport register.',true);return}
  const values={institution_id:user.institutionId,module_key:'transport',record_type:config.type,title,reference_code:form.reference_code.trim()||null,description:form.description.trim()||null,status:form.status,approval_status:'not_required',visibility:'staff_only',parent_record_id:parentId,payload}
  setSaving(true)
  try{
   const request=editing
    ?await supabase.from('institutional_records').update({...values,updated_by:user.id}).eq('id',editing.id).eq('institution_id',user.institutionId).eq('module_key','transport')
    :await supabase.from('institutional_records').insert({...values,created_by:user.id})
   if(request.error)throw request.error
   onToast(editing?'Transport record updated.':'Transport record created.')
   setOpen(false);setEditing(null);await load()
  }catch(e){onToast(userFacingError(e,'The transport record could not be saved.'),true)}
  finally{setSaving(false)}
 }
 async function deleteFleetRecord(row:FleetRecord){
  if(!supabase||!user||!canManage)return
  if(row.record_type==='vehicle-management'&&allocations.some(a=>a.vehicle_record_id===row.id)){onToast('This vehicle has allocation history. Mark it inactive or under maintenance instead of deleting it.',true);return}
  if(row.record_type==='drivers-management'&&vehicles.some(v=>v.payload?.driver_record_id===row.id)){onToast('This driver is assigned to one or more vehicles. Reassign those vehicles before deleting the driver.',true);return}
  if(row.record_type==='transport-routes'&&allocations.some(a=>a.route_record_id===row.id)){onToast('This route has learner allocations. Keep its history and mark the route inactive instead.',true);return}
  if(row.record_type==='route-stops'&&allocations.some(a=>a.stop_record_id===row.id)){onToast('This stop is referenced by learner allocations and cannot be deleted.',true);return}
  if(records.some(child=>child.parent_record_id===row.id)){onToast('This record has linked operational records. Remove or reassign those records first.',true);return}
  if(!window.confirm('Delete '+row.title+' from this institution transport register?'))return
  setSaving(true)
  try{const {error}=await supabase.from('institutional_records').delete().eq('id',row.id).eq('institution_id',user.institutionId).eq('module_key','transport');if(error)throw error;onToast('Transport record deleted.');await load()}
  catch(e){onToast(userFacingError(e,'The transport record could not be deleted.'),true)}
  finally{setSaving(false)}
 }
 async function createFeeCharge(event:FormEvent){
  event.preventDefault();if(!supabase||!user||!canFinance)return
  if(!chargeAllocation||!/^\\d{4}-\\d{2}$/.test(billingPeriod)||!dueDate){onToast('Select an active allocation, billing month and due date.',true);return}
  const allocation=activeAllocations.find(a=>a.id===chargeAllocation)
  if(!allocation||number(allocation.transport_fee)<=0){onToast('Select an active allocation with a transport fee greater than zero.',true);return}
  setSaving(true)
  try{const {error}=await supabase.rpc('create_student_transport_fee_charge',{p_institution_id:user.institutionId,p_allocation_id:allocation.id,p_billing_period:billingPeriod,p_due_date:dueDate});if(error)throw error;onToast('Transport fee charge created or updated for '+billingPeriod+'.');await load()}
  catch(e){onToast(userFacingError(e,'The transport fee charge could not be created.'),true)}
  finally{setSaving(false)}
 }
 async function recordPayment(event:FormEvent){
  event.preventDefault();if(!supabase||!user||!canFinance)return
  const charge=charges.find(c=>c.id===paymentCharge)
  const amount=Number(paymentAmount)
  if(!charge||!Number.isFinite(amount)||amount<=0){onToast('Choose a fee charge and enter a payment greater than zero.',true);return}
  const outstanding=Math.max(0,number(charge.amount)-number(charge.paid_amount))
  if(amount>outstanding){onToast('Payment exceeds the outstanding balance of '+money(outstanding)+'.',true);return}
  setSaving(true)
  try{const {error}=await supabase.rpc('record_student_transport_fee_payment',{p_institution_id:user.institutionId,p_charge_id:charge.id,p_amount:amount,p_payment_method:paymentMethod,p_payment_reference:paymentReference.trim()||null});if(error)throw error;onToast('Transport payment recorded.');setPaymentAmount('');setPaymentReference('');setPaymentCharge('');await load()}
  catch(e){onToast(userFacingError(e,'The transport payment could not be recorded.'),true)}
  finally{setSaving(false)}
 }
 const exportReport=()=>{
  const rows=visibleAllocations.map(a=>({student:studentMap.get(a.student_id)?.full_name??a.student_id,admission:studentMap.get(a.student_id)?.admission_no??'',route:routeMap.get(a.route_record_id)?.title??'',vehicle:vehicleMap.get(String(a.vehicle_record_id??''))?.title??'',status:a.status,start:a.effective_from,end:a.effective_to??'',fee:a.transport_fee}))
  downloadCsv('edusphere-transport-assignments.csv',rows,[{key:'student',label:'Student'},{key:'admission',label:'Admission number'},{key:'route',label:'Route'},{key:'vehicle',label:'Vehicle'},{key:'status',label:'Status'},{key:'start',label:'Effective from'},{key:'end',label:'Effective to'},{key:'fee',label:'Transport fee'}])
 }
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;const keydown=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!saving){setOpen(false);setEditing(null)}};document.body.style.overflow='hidden';window.addEventListener('keydown',keydown);return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',keydown)}},[open,saving])
 if(!user)return null
 return <main className="page-content ed360-module-page ed360-operation-management">
  <header className="ed360-operation-hero"><div className="ed360-operation-icon"><Bus size={21}/></div><div className="ed360-operation-title"><span>TRANSPORT / FLEET & ROUTE CONTROL</span><h1>{config.title}</h1><p>{config.description}</p></div><div className="ed360-operation-tools"><button type="button" className="button button-outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button>{config.type&&canManage&&<button type="button" className="button button-primary" onClick={startCreate}><Plus size={15}/> Add record</button>}</div></header>
  {loading&&<div className="ed360-workspace-empty">Loading transport records…</div>}
  {error&&<section className="ed360-operation-error"><strong>Transport records could not be loaded</strong><span>{error}</span><button type="button" className="button button-outline" onClick={()=>void load()}>Retry</button></section>}
  {config.kind==='dashboard'&&<><section className="ed360-operation-metrics">
   <article><span>Active vehicles</span><strong>{vehicles.filter(v=>v.status==='active').length}</strong><small>{vehicles.length} registered vehicles</small></article>
   <article><span>Drivers</span><strong>{drivers.filter(d=>d.status==='active').length}</strong><small>{drivers.length} driver records</small></article>
   <article><span>Routes / stops</span><strong>{routes.length} / {stops.length}</strong><small>Institution route network</small></article>
   <article><span>Active allocations</span><strong>{canReadStaff?activeAllocations.length:'—'}</strong><small>Current learner assignments</small></article>
   <article><span>Outstanding fees</span><strong>{canFinance?money(dueCharges):'—'}</strong><small>Open transport charges</small></article>
   <article><span>Maintenance due</span><strong>{maintenance.filter(m=>m.payload?.next_service_date&&m.payload.next_service_date<=new Date().toISOString().slice(0,10)).length}</strong><small>Service records at or past due</small></article>
  </section><section className="ed360-operation-cards">
   <article><Truck size={19}/><h2>Fleet</h2><p>Register vehicles and authorised drivers, including seat capacity and licence dates.</p><button className="button button-outline" type="button" onClick={()=>onNavigate?.('institutional:transport:vehicle-management')}>Manage vehicles</button></article>
   <article><Route size={19}/><h2>Routes and stops</h2><p>Maintain route codes and route-linked pickup points used by student allocation.</p><button className="button button-outline" type="button" onClick={()=>onNavigate?.('institutional:transport:transport-routes')}>Manage routes</button></article>
   <article><Wallet size={19}/><h2>Transport fees</h2><p>Generate monthly charges and record partial or full payments.</p><button className="button button-outline" type="button" onClick={()=>onNavigate?.('institutional:transport:transport-fees')}>Open fee register</button></article>
  </section></>}
  {config.type&&<section className="ed360-operation-panel"><div className="ed360-operation-toolbar"><label><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, code, vehicle, route or status…" aria-label="Search transport records"/></label><span>{visibleRecords.length} record(s)</span></div>
   {visibleRecords.length===0?<div className="ed360-operation-empty">No transport records match this search. Register the first entry to build this institution’s transport register.</div>:<div className="ed360-operation-table-wrap"><table><thead><tr><th>Name / code</th><th>Details</th><th>Schedule / compliance</th><th>Status</th>{canManage&&<th>Actions</th>}</tr></thead><tbody>{visibleRecords.map(row=><tr key={row.id}><td><strong>{row.title}</strong><small>{row.reference_code??'No reference'}</small></td><td>{row.record_type==='vehicle-management'?<>{row.payload?.plate_number??'No registration'}<small>{row.payload?.make_model??row.payload?.vehicle_type} · {row.payload?.seat_capacity??'—'} seats · {driverMap.get(String(row.payload?.driver_record_id??''))?.title??'No driver'}</small></>:row.record_type==='drivers-management'?<>{row.payload?.license_number??'No licence'}<small>{row.payload?.phone??''} · {row.payload?.license_class??''}</small></>:row.record_type==='transport-routes'?<>{row.payload?.start_location??'—'} → {row.payload?.end_location??'—'}<small>Route: {row.payload?.route_code??row.reference_code}</small></>:row.record_type==='route-stops'?<>{row.payload?.stop_address??'—'}<small>Sequence {row.payload?.stop_sequence??'—'} · {routes.find(r=>r.id===row.parent_record_id)?.title??'Route not linked'}</small></>:<>{row.payload?.vehicle_name??'Vehicle'}<small>{row.payload?.provider??''} · {row.payload?.maintenance_cost?money(number(row.payload?.maintenance_cost)):''}</small></>}</td><td>{row.record_type==='vehicle-management'?<>Insurance: {asDate(row.payload?.insurance_expiry)}<small>Inspection: {asDate(row.payload?.inspection_due)}</small></>:row.record_type==='drivers-management'?<>Licence expiry: {asDate(row.payload?.license_expiry)}</>:row.record_type==='transport-routes'?<>Depart: {row.payload?.departure_time??'—'}<small>Return: {row.payload?.return_time??'—'} · Fee {money(number(row.payload?.monthly_fee))}</small></>:row.record_type==='route-stops'?<>Pickup: {row.payload?.pickup_time??'—'}</>:<>Service: {asDate(row.payload?.service_date)}<small>Next: {asDate(row.payload?.next_service_date)}</small></>}</td><td><span className="ed360-operation-status">{row.status}</span></td>{canManage&&<td><div className="ed360-operation-actions"><button title="Edit record" onClick={()=>startEdit(row)}><Pencil size={14}/></button><button title="Delete record" onClick={()=>void deleteFleetRecord(row)}><Trash2 size={14}/></button></div></td>}</tr>)}</tbody></table></div>}
  </section>}
  {(config.kind==='allocation'||config.kind==='history')&&<section className="ed360-operation-panel"><div className="ed360-operation-toolbar"><label><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student, admission number, route or date…" aria-label="Search transport allocation history"/></label><div><span>{visibleAllocations.length} allocation(s)</span><button type="button" className="button button-outline" onClick={exportReport}><Download size={14}/> Export CSV</button></div></div><div className="ed360-operation-table-wrap"><table><thead><tr><th>Student</th><th>Route / stop</th><th>Vehicle</th><th>Period</th><th>Fee</th><th>Status / events</th></tr></thead><tbody>{visibleAllocations.map(a=>{const student=studentMap.get(a.student_id),route=routeMap.get(a.route_record_id),vehicle=vehicleMap.get(String(a.vehicle_record_id??'')),stop=stops.find(x=>x.id===a.stop_record_id);const rowEvents=events.filter(e=>e.allocation_id===a.id);return <tr key={a.id}><td><strong>{student?.full_name??a.student_id}</strong><small>{student?.admission_no??''} · {student?.class_name??''}</small></td><td>{route?.title??'Route'}<small>{stop?.title??'Stop not selected'}</small></td><td>{vehicle?.title??'Not assigned'}</td><td>{asDate(a.effective_from)}<small>to {asDate(a.effective_to??undefined)}</small></td><td>{money(number(a.transport_fee))}</td><td><span className="ed360-operation-status">{a.status}</span><small>{rowEvents.length} attendance event(s)</small></td></tr>})}</tbody></table></div>{config.kind==='history'&&<div className="ed360-operation-event-list"><h2>Recent boarding / alighting events</h2>{events.slice(0,60).map(e=><article key={e.id}><span>{e.event_type.replaceAll('_',' ')}</span><strong>{studentMap.get(allocations.find(a=>a.id===e.allocation_id)?.student_id??'')?.full_name??'Student'}</strong><small>{new Date(e.occurred_at).toLocaleString()} · {e.source} · {e.notes??''}</small></article>)}</div>}</section>}
  {config.kind==='fees'&&<><section className="ed360-operation-metrics"><article><span>Transport fee billed</span><strong>{money(charges.reduce((s,c)=>s+number(c.amount),0))}</strong><small>All visible billing periods</small></article><article><span>Payments recorded</span><strong>{money(payments.reduce((s,p)=>s+number(p.amount),0))}</strong><small>Ledgered transport receipts</small></article><article><span>Outstanding balance</span><strong>{money(dueCharges)}</strong><small>Unpaid or part-paid charges</small></article></section>{canFinance&&<section className="ed360-operation-panel"><header><div><h2>Generate monthly fee charge</h2><p>Charges are created from an active student transport allocation and its configured monthly fee.</p></div></header><form className="ed360-operation-inline-form" onSubmit={createFeeCharge}><label>Active allocation<select required value={chargeAllocation} onChange={e=>setChargeAllocation(e.target.value)}><option value="">Choose allocation</option>{activeAllocations.filter(a=>number(a.transport_fee)>0).map(a=><option key={a.id} value={a.id}>{studentMap.get(a.student_id)?.full_name??'Student'} · {routeMap.get(a.route_record_id)?.title??'Route'} · {money(number(a.transport_fee))}</option>)}</select></label><label>Billing month<input type="month" required value={billingPeriod} onChange={e=>setBillingPeriod(e.target.value)}/></label><label>Due date<input type="date" required value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><button type="submit" className="button button-primary" disabled={saving}>Create charge</button></form></section>}
  <section className="ed360-operation-panel"><div className="ed360-operation-toolbar"><label><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search learner or billing period…" aria-label="Search transport fees"/></label><span>{visibleCharges.length} charge(s)</span></div><div className="ed360-operation-table-wrap"><table><thead><tr><th>Student / allocation</th><th>Period / due</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th><th>Payment</th></tr></thead><tbody>{visibleCharges.map(c=>{const a=allocations.find(x=>x.id===c.allocation_id),s=a?studentMap.get(a.student_id):undefined;const outstanding=Math.max(0,number(c.amount)-number(c.paid_amount));return <tr key={c.id}><td><strong>{s?.full_name??'Student'}</strong><small>{routeMap.get(a?.route_record_id??'')?.title??'Route'}</small></td><td>{c.billing_period}<small>Due {asDate(c.due_date)}</small></td><td>{money(number(c.amount))}</td><td>{money(number(c.paid_amount))}</td><td><strong>{money(outstanding)}</strong></td><td><span className="ed360-operation-status">{c.status}</span></td><td>{canFinance&&outstanding>0?<button type="button" className="button button-outline" onClick={()=>{setPaymentCharge(c.id);setPaymentAmount(String(outstanding));setPaymentReference('')}}>Record payment</button>:<span>—</span>}<small>{(paymentsByCharge.get(c.id)??[]).length} payment(s)</small></td></tr>})}</tbody></table></div></section>
  {canFinance&&paymentCharge&&<section className="ed360-operation-panel"><header><div><h2>Record transport payment</h2><p>Partial payments are supported; overpayment is blocked by the database transaction.</p></div><button type="button" className="button button-outline" onClick={()=>setPaymentCharge('')}>Close</button></header><form className="ed360-operation-inline-form" onSubmit={recordPayment}><label>Amount<input required type="number" min="0.01" step="0.01" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/></label><label>Payment method<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="mobile_wallet">Mobile wallet</option><option value="other">Other</option></select></label><label>Reference<input value={paymentReference} onChange={e=>setPaymentReference(e.target.value)}/></label><button type="submit" className="button button-primary" disabled={saving}>Save payment</button></form></section>}
  </>}
  {open&&<div className="ed360-operation-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget){setOpen(false);setEditing(null)}}}><section className="ed360-operation-modal" role="dialog" aria-modal="true" aria-labelledby="ed360-transport-form-title"><header><div><span>INSTITUTION TRANSPORT</span><h2 id="ed360-transport-form-title">{editing?'Edit':'Register'} {config.type?.replaceAll('-',' ')}</h2><p>Fleet and route records are scoped to the signed-in institution.</p></div><button type="button" aria-label="Close" onClick={()=>setOpen(false)}>×</button></header><form onSubmit={saveFleetRecord}><div className="ed360-operation-form-grid">
   <label className="span-two">Name / title *<input required minLength={2} value={form.title} onChange={e=>update('title',e.target.value)}/></label><label>Reference code<input value={form.reference_code} onChange={e=>update('reference_code',e.target.value)}/></label>
   {config.type==='vehicle-management'&&<><label>Registration / plate number<input value={form.plate_number} onChange={e=>update('plate_number',e.target.value)}/></label><label>Vehicle type<select value={form.vehicle_type} onChange={e=>update('vehicle_type',e.target.value)}><option>Bus</option><option>Coaster</option><option>Van</option><option>Car</option><option>Motorcycle</option><option>Other</option></select></label><label>Make / model<input value={form.make_model} onChange={e=>update('make_model',e.target.value)}/></label><label>Seat capacity *<input required type="number" min="1" step="1" value={form.seat_capacity} onChange={e=>update('seat_capacity',e.target.value)}/></label><label>Assigned driver<select value={form.driver_record_id} onChange={e=>update('driver_record_id',e.target.value)}><option value="">Not assigned</option>{drivers.filter(d=>d.status==='active').map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select></label><label>Registration expiry<input type="date" value={form.registration_expiry} onChange={e=>update('registration_expiry',e.target.value)}/></label><label>Insurance expiry<input type="date" value={form.insurance_expiry} onChange={e=>update('insurance_expiry',e.target.value)}/></label><label>Inspection due<input type="date" value={form.inspection_due} onChange={e=>update('inspection_due',e.target.value)}/></label></>}
   {config.type==='drivers-management'&&<><label>Phone<input type="tel" value={form.phone} onChange={e=>update('phone',e.target.value)}/></label><label>Licence number<input value={form.license_number} onChange={e=>update('license_number',e.target.value)}/></label><label>Licence class<input value={form.license_class} onChange={e=>update('license_class',e.target.value)}/></label><label>Licence expiry<input type="date" value={form.license_expiry} onChange={e=>update('license_expiry',e.target.value)}/></label><label>Employee reference<input value={form.employee_reference} onChange={e=>update('employee_reference',e.target.value)}/></label></>}
   {config.type==='transport-routes'&&<><label>Route code *<input required value={form.route_code} onChange={e=>update('route_code',e.target.value)}/></label><label>Start point<input value={form.start_location} onChange={e=>update('start_location',e.target.value)}/></label><label>End point<input value={form.end_location} onChange={e=>update('end_location',e.target.value)}/></label><label>Departure time<input type="time" value={form.departure_time} onChange={e=>update('departure_time',e.target.value)}/></label><label>Return time<input type="time" value={form.return_time} onChange={e=>update('return_time',e.target.value)}/></label><label>Journey minutes<input type="number" min="1" step="1" value={form.estimated_minutes} onChange={e=>update('estimated_minutes',e.target.value)}/></label><label>Monthly fee<input type="number" min="0" step="0.01" value={form.monthly_fee} onChange={e=>update('monthly_fee',e.target.value)}/></label></>}
   {config.type==='route-stops'&&<><label>Parent route *<select required value={form.route_record_id} onChange={e=>update('route_record_id',e.target.value)}><option value="">Choose route</option>{routes.filter(r=>r.status==='active').map(r=><option key={r.id} value={r.id}>{r.title} · {r.payload?.route_code??r.reference_code}</option>)}</select></label><label>Stop sequence *<input required type="number" min="1" step="1" value={form.stop_sequence} onChange={e=>update('stop_sequence',e.target.value)}/></label><label className="span-two">Stop address<input value={form.stop_address} onChange={e=>update('stop_address',e.target.value)}/></label><label>Pickup time<input type="time" value={form.pickup_time} onChange={e=>update('pickup_time',e.target.value)}/></label></>}
   {config.type==='vehicle-maintenance'&&<><label>Vehicle *<select required value={form.driver_record_id} onChange={e=>update('driver_record_id',e.target.value)}><option value="">Choose vehicle</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.title} · {v.payload?.plate_number??''}</option>)}</select></label><label>Service date<input required type="date" value={form.service_date} onChange={e=>update('service_date',e.target.value)}/></label><label>Next service date<input type="date" value={form.next_service_date} onChange={e=>update('next_service_date',e.target.value)}/></label><label>Maintenance cost<input type="number" min="0" step="0.01" value={form.maintenance_cost} onChange={e=>update('maintenance_cost',e.target.value)}/></label><label>Service provider<input value={form.provider} onChange={e=>update('provider',e.target.value)}/></label></>}
   <label>Status<select value={form.status} onChange={e=>update('status',e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option><option value="completed">Completed</option></select></label><label className="span-two">Description / notes<textarea rows={3} value={form.description} onChange={e=>update('description',e.target.value)}/></label>
  </div><footer><span>Institution-scoped record · related allocations are preserved</span><div><button type="button" className="button button-outline" onClick={()=>setOpen(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving?'Saving…':'Save record'}</button></div></footer></form></section></div>}
 </main>
}
