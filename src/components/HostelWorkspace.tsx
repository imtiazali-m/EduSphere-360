import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Building2, Download, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/data-management.css'
import '../styles/institution-operations.css'

type Row = Record<string,any> & {id:string}
type Student = {id:string;full_name:string;admission_no:string;class_name:string;status:string}
type Teacher = {id:string;full_name:string;employee_no:string}
const titles:Record<string,string>={
 'hostel-dashboard':'Hostel & Residence Dashboard','hostel-buildings':'Hostel Buildings',
 'room-bed-register':'Room & Bed Register','resident-allocation':'Resident Allocation',
 'room-transfers':'Room Transfers','check-in-check-out':'Check-in & Check-out',
 'hostel-visitor-register':'Hostel Visitor Register','hostel-fees':'Hostel Fees',
 'accommodation-maintenance':'Accommodation Maintenance','occupancy-reports':'Occupancy Reports'
}
const descriptions:Record<string,string>={
 'hostel-dashboard':'See occupancy, available beds, arrivals, departures and maintenance from live residence records.',
 'hostel-buildings':'Register residence buildings, assign wardens and maintain their operating status.',
 'room-bed-register':'Manage room capacity, room types and the individual bed inventory.',
 'resident-allocation':'Allocate an eligible student to an available bed using a transaction that checks bed and resident conflicts.',
 'room-transfers':'Transfer an active resident to another available bed and retain the movement history.',
 'check-in-check-out':'Record check-in, temporary exit, return and final check-out against active residence allocations.',
 'hostel-visitor-register':'Record visitors for resident visits and retain their check-in/check-out details.',
 'hostel-fees':'Create accommodation charges and track paid amounts, balances and due dates. These are not automatically posted to the main fee ledger.',
 'accommodation-maintenance':'Report, assign and resolve accommodation maintenance requests.',
 'occupancy-reports':'Review occupancy and bed availability by building, room and resident status.'
}
const fmt=(v:unknown)=>v?new Date(String(v)).toLocaleDateString():'—'
const dateTime=(v:unknown)=>v?new Date(String(v)).toLocaleString():'—'
const money=(v:unknown)=>'PKR '+Number(v??0).toLocaleString(undefined,{maximumFractionDigits:2})
const label=(v:unknown)=>String(v??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
export function HostelWorkspace({workspaceKey,onToast}:{workspaceKey:string;onToast:(message:string,error?:boolean)=>void}){
 const {user}=useAuth()
 const page=workspaceKey.split(':').slice(-1)[0]
 const title=titles[page]??'Hostel & Residence'
 const admin=Boolean(user&&['owner','admin'].includes(user.role))
 const staff=Boolean(user&&['owner','admin','teacher'].includes(user.role))
 const [buildings,setBuildings]=useState<Row[]>([])
 const [rooms,setRooms]=useState<Row[]>([])
 const [beds,setBeds]=useState<Row[]>([])
 const [residents,setResidents]=useState<Row[]>([])
 const [movements,setMovements]=useState<Row[]>([])
 const [guests,setGuests]=useState<Row[]>([])
 const [fees,setFees]=useState<Row[]>([])
 const [maintenance,setMaintenance]=useState<Row[]>([])
 const [students,setStudents]=useState<Student[]>([])
 const [teachers,setTeachers]=useState<Teacher[]>([])
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [search,setSearch]=useState('')
 const [status,setStatus]=useState('all')
 const [form,setForm]=useState<Record<string,string>>({})
 async function load(){
  if(!supabase||!user){setLoading(false);setError('The cloud database is not available.');return}
  setLoading(true);setError('')
  try{
   const [b,r,bd,rs,m,g,f,mt,s,t]=await Promise.all([
    supabase.from('hostel_buildings').select('*').eq('institution_id',user.institutionId).order('name'),
    supabase.from('hostel_rooms').select('*').eq('institution_id',user.institutionId).order('room_number'),
    supabase.from('hostel_beds').select('*').eq('institution_id',user.institutionId).order('bed_code'),
    supabase.from('hostel_residents').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false}),
    supabase.from('hostel_movements').select('*').eq('institution_id',user.institutionId).order('occurred_at',{ascending:false}).limit(1000),
    supabase.from('hostel_guest_visits').select('*').eq('institution_id',user.institutionId).order('check_in_at',{ascending:false}).limit(1000),
    supabase.from('hostel_fee_charges').select('*').eq('institution_id',user.institutionId).order('due_date'),
    supabase.from('hostel_maintenance_requests').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false}),
    supabase.from('students').select('id,full_name,admission_no,class_name,status').eq('institution_id',user.institutionId).order('full_name'),
    supabase.from('teachers').select('id,full_name,employee_no').eq('institution_id',user.institutionId).order('full_name')
   ])
   for(const result of [b,r,bd,rs,m,g,f,mt,s,t])if(result.error)throw result.error
   setBuildings((b.data??[]) as Row[]);setRooms((r.data??[]) as Row[]);setBeds((bd.data??[]) as Row[])
   setResidents((rs.data??[]) as Row[]);setMovements((m.data??[]) as Row[]);setGuests((g.data??[]) as Row[])
   setFees((f.data??[]) as Row[]);setMaintenance((mt.data??[]) as Row[])
   setStudents((s.data??[]) as Student[]);setTeachers((t.data??[]) as Teacher[])
  }catch(e){const msg=e instanceof Error?e.message:'Hostel records could not be loaded.';setError(msg);onToast(msg,true)}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[user?.id,user?.institutionId])
 const activeResidents=useMemo(()=>residents.filter(r=>r.status==='active'),[residents])
 const availableBeds=beds.filter(b=>b.status==='available')
 const occupiedBeds=beds.filter(b=>b.status==='occupied')
 const visible=useMemo(()=>{
  const rows=page==='hostel-buildings'?buildings:page==='room-bed-register'?rooms:
   page==='resident-allocation'||page==='check-in-check-out'||page==='room-transfers'?residents:
   page==='hostel-visitor-register'?guests:page==='hostel-fees'?fees:
   page==='accommodation-maintenance'?maintenance:page==='occupancy-reports'?beds:
   page==='hostel-dashboard'?residents:residents
  return rows.filter(row=>(status==='all'||String(row.status)===status)&&(!search||Object.values(row).some(v=>String(v??'').toLowerCase().includes(search.toLowerCase()))))
 },[page,buildings,rooms,residents,guests,fees,maintenance,beds,status,search])
 const buildingFor=(id:string)=>buildings.find(x=>x.id===id)
 const roomFor=(id:string)=>rooms.find(x=>x.id===id)
 const bedFor=(id:string)=>beds.find(x=>x.id===id)
 const studentFor=(id:string)=>students.find(x=>x.id===id)
 const residentFor=(id:string)=>residents.find(x=>x.id===id)
 const create=async(table:string,payload:Record<string,unknown>)=>{
  if(!supabase||!user)throw new Error('Please sign in again.')
  const {error}=await supabase.from(table).insert({...payload,institution_id:user.institutionId,created_by:user.id})
  if(error)throw error
 }
 const run=async(action:()=>Promise<void>,success:string)=>{
  if(busy)return
  setBusy(true)
  try{await action();onToast(success);setForm({});await load()}
  catch(e){onToast(e instanceof Error?e.message:'The operation could not be completed.',true)}
  finally{setBusy(false)}
 }
 const submit=(action:(v:Record<string,string>)=>Promise<void>,success:string)=>(event:FormEvent)=>{
  event.preventDefault();void run(()=>action(form),success)
 }
 const allocate=async(v:Record<string,string>)=>{
  if(!supabase||!user)throw new Error('Sign in again.')
  const {error}=await supabase.rpc('allocate_hostel_bed',{p_institution_id:user.institutionId,p_student_id:v.student_id,p_bed_id:v.bed_id,p_check_in_date:v.check_in_date,p_expected_checkout_date:v.expected_checkout_date||null,p_notes:v.notes||null})
  if(error)throw error
 }
 const transfer=async(v:Record<string,string>)=>{
  if(!supabase||!user)throw new Error('Sign in again.')
  const {error}=await supabase.rpc('transfer_hostel_resident',{p_institution_id:user.institutionId,p_resident_id:v.resident_id,p_new_bed_id:v.new_bed_id,p_notes:v.notes||null})
  if(error)throw error
 }
 const movement=async(v:Record<string,string>)=>{
  if(!supabase||!user)throw new Error('Sign in again.')
  const {error}=await supabase.rpc('record_hostel_movement',{p_institution_id:user.institutionId,p_resident_id:v.resident_id,p_movement_type:v.movement_type,p_notes:v.notes||null})
  if(error)throw error
 }
 const markGuestExit=async(row:Row)=>{
  if(!supabase||!admin)return
  await run(async()=>{
   const {error}=await supabase.from('hostel_guest_visits').update({check_out_at:new Date().toISOString()}).eq('institution_id',user!.institutionId).eq('id',row.id)
   if(error)throw error
  },'Guest check-out recorded.')
 }
 const updateMaintenance=async(row:Row,next:string)=>{
  if(!supabase||!staff)return
  await run(async()=>{
   const {error}=await supabase.from('hostel_maintenance_requests').update({status:next,updated_at:new Date().toISOString(),resolved_at:next==='resolved'?new Date().toISOString():null}).eq('institution_id',user!.institutionId).eq('id',row.id)
   if(error)throw error
  },'Maintenance status updated.')
 }
 const field=(caption:string,key:string,type='text',required=true,options?:{label:string;value:string}[])=> <label className="iop-field" key={key}>{caption}{options?<select required={required} value={form[key]??''} onChange={e=>setForm(x=>({...x,[key]:e.target.value}))}><option value="">Select {caption.toLowerCase()}</option>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<input required={required} type={type} value={form[key]??''} onChange={e=>setForm(x=>({...x,[key]:e.target.value}))}/>}</label>
 const textArea=(caption:string,key:string)=> <label className="iop-field" key={key}>{caption}<textarea rows={3} value={form[key]??''} onChange={e=>setForm(x=>({...x,[key]:e.target.value}))}/></label>
 const submitBar=(caption:string)=><div className="modal-actions"><button className="iop-button primary" disabled={busy}>{busy?'Saving…':caption}</button></div>
 const header=<header className="ed360-workspace-hero"><div className="ed360-workspace-hero-icon"><Building2 size={21}/></div><div className="ed360-workspace-hero-copy"><span>ROOMS & FACILITIES / HOSTEL</span><h1>{title}</h1><p>{descriptions[page]??'Manage student residence operations.'}</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Live institution records</span><button type="button" className="button button-outline" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div></header>
 if(!user)return null
 return <main className="page-content ed360-module-page ed360-hostel-workspace">
  {header}
  {error&&<div className="ed360-workspace-error" role="alert">{error}</div>}
  {loading?<div className="ed360-workspace-empty">Loading residence records…</div>:null}
  {page==='hostel-dashboard'&&<section className="ed360-workspace-kpis"><article><span>Buildings</span><strong>{buildings.length}</strong><small>Residence buildings</small></article><article><span>Rooms</span><strong>{rooms.length}</strong><small>Registered rooms</small></article><article><span>Occupied beds</span><strong>{occupiedBeds.length}</strong><small>Of {beds.length} registered beds</small></article><article><span>Available beds</span><strong>{availableBeds.length}</strong><small>Ready for allocation</small></article><article><span>Active residents</span><strong>{activeResidents.length}</strong><small>Current check-ins</small></article><article><span>Open maintenance</span><strong>{maintenance.filter(x=>!['resolved','closed'].includes(x.status)).length}</strong><small>Needs attention</small></article><div className="ed360-data-card"><h2>Recent resident movements</h2>{movements.slice(0,8).map(row=><p key={row.id}>{dateTime(row.occurred_at)} · {label(row.movement_type)} · {studentFor(residentFor(row.resident_id)?.student_id??'')?.full_name??'Resident'}</p>)}</div></section>}
  {page==='hostel-buildings'&&<section className="ed360-data-card"><header><h2>Building register</h2><p>Each building belongs to this institution.</p></header>{admin&&<form className="ed360-data-form" onSubmit={submit(v=>create('hostel_buildings',{created_by:user!.id,building_code:v.building_code,name:v.name,address:v.address||null,floors:Number(v.floors||1),warden_teacher_id:v.warden_teacher_id||null,status:v.status||'active'}),'Hostel building saved.')} >{field('Building code','building_code')}{field('Building name','name')}{field('Floor count','floors','number')}{field('Warden','warden_teacher_id','text',false,teachers.map(t=>({label:t.full_name,value:t.id})))}{field('Status','status','text',true,[{label:'Active',value:'active'},{label:'Maintenance',value:'maintenance'},{label:'Inactive',value:'inactive'}])}{textArea('Address','address')}{submitBar('Save building')}</form>}<div className="table-scroll"><table><thead><tr><th>Code</th><th>Building</th><th>Floors</th><th>Warden</th><th>Status</th></tr></thead><tbody>{visible.filter(x=>buildings.some(b=>b.id===x.id)).map(row=><tr key={row.id}><td>{row.building_code}</td><td>{row.name}</td><td>{row.floors}</td><td>{teachers.find(t=>t.id===row.warden_teacher_id)?.full_name??'—'}</td><td>{label(row.status)}</td></tr>)}</tbody></table></div></section>}
  {page==='room-bed-register'&&<section className="ed360-data-card"><header><h2>Rooms and beds</h2><p>Capacity is maintained through individual bed records. Beds cannot be allocated while occupied or under maintenance.</p></header>{admin&&<><form className="ed360-data-form" onSubmit={submit(v=>create('hostel_rooms',{created_by:user!.id,building_id:v.building_id,room_number:v.room_number,floor:Number(v.floor||0),room_type:v.room_type,capacity:Number(v.capacity),status:'active',notes:v.notes||null}),'Room saved. Create its beds below.')}>{field('Building','building_id','text',true,buildings.map(b=>({label:b.name,value:b.id})))}{field('Room number','room_number')}{field('Floor','floor','number')}{field('Room type','room_type','text',true,['single','shared','dormitory'].map(x=>({label:label(x),value:x})))}{field('Bed capacity','capacity','number')}{textArea('Notes','notes')}{submitBar('Save room')}</form><form className="ed360-data-form" onSubmit={submit(v=>{const room=roomFor(v.room_id);const count=beds.filter(b=>b.room_id===v.room_id).length;if(!room)throw new Error('Select a valid room.');if(count>=Number(room.capacity))throw new Error('This room has reached its registered bed capacity.');return create('hostel_beds',{created_by:user!.id,room_id:v.room_id,bed_code:v.bed_code,status:'available'})},'Bed registered.')}>{field('Room','room_id','text',true,rooms.map(r=>({label:buildingFor(r.building_id)?.name+' · '+r.room_number,value:r.id})))}{field('Bed code','bed_code')}{submitBar('Add bed')}</form></> }<div className="table-scroll"><table><thead><tr><th>Building</th><th>Room</th><th>Type</th><th>Capacity</th><th>Beds</th><th>Available</th></tr></thead><tbody>{rooms.filter(r=>visible.some(x=>x.id===r.id)||!search).map(room=><tr key={room.id}><td>{buildingFor(room.building_id)?.name??'—'}</td><td>{room.room_number}</td><td>{label(room.room_type)}</td><td>{room.capacity}</td><td>{beds.filter(b=>b.room_id===room.id).length}</td><td>{beds.filter(b=>b.room_id===room.id&&b.status==='available').length}</td></tr>)}</tbody></table></div><div className="table-scroll"><table><thead><tr><th>Bed</th><th>Room</th><th>Building</th><th>Status</th></tr></thead><tbody>{beds.filter(b=>!search||[b.bed_code,roomFor(b.room_id)?.room_number,buildingFor(roomFor(b.room_id)?.building_id??'')?.name,b.status].join(' ').toLowerCase().includes(search.toLowerCase())).map(b=><tr key={b.id}><td>{b.bed_code}</td><td>{roomFor(b.room_id)?.room_number??'—'}</td><td>{buildingFor(roomFor(b.room_id)?.building_id??'')?.name??'—'}</td><td>{label(b.status)}</td></tr>)}</tbody></table></div></section>}
  {page==='resident-allocation'&&<section className="ed360-data-card"><header><h2>Allocate a resident</h2><p>Allocation runs through a database transaction. The bed must be available and the student must not already have an active residence.</p></header>{admin&&<form className="ed360-data-form" onSubmit={submit(allocate,'Resident allocated to the selected bed.')}>{field('Student','student_id','text',true,students.filter(s=>s.status==='active').map(s=>({label:s.full_name+' · '+s.admission_no,value:s.id})))}{field('Available bed','bed_id','text',true,availableBeds.map(b=>({label:(buildingFor(roomFor(b.room_id)?.building_id??'')?.name??'')+' · '+(roomFor(b.room_id)?.room_number??'')+' · '+b.bed_code,value:b.id})))}{field('Check-in date','check_in_date','date')}{field('Expected check-out','expected_checkout_date','date',false)}{textArea('Notes','notes')}{submitBar('Allocate bed')}</form>}<div className="table-scroll"><table><thead><tr><th>Student</th><th>Admission</th><th>Building / room / bed</th><th>Check-in</th><th>Expected out</th><th>Status</th></tr></thead><tbody>{activeResidents.map(r=><tr key={r.id}><td>{studentFor(r.student_id)?.full_name??'—'}</td><td>{studentFor(r.student_id)?.admission_no??'—'}</td><td>{buildingFor(roomFor(bedFor(r.bed_id)?.room_id??'')?.building_id??'')?.name??''} / {roomFor(bedFor(r.bed_id)?.room_id??'')?.room_number??''} / {bedFor(r.bed_id)?.bed_code??''}</td><td>{fmt(r.check_in_date)}</td><td>{fmt(r.expected_checkout_date)}</td><td>{label(r.status)}</td></tr>)}</tbody></table></div></section>}
  {page==='room-transfers'&&<section className="ed360-data-card"><header><h2>Transfer a resident</h2><p>The current bed is released and the new bed occupied in one transaction.</p></header>{admin&&<form className="ed360-data-form" onSubmit={submit(transfer,'Resident transferred successfully.')}>{field('Active resident','resident_id','text',true,activeResidents.map(r=>({label:studentFor(r.student_id)?.full_name??'Student',value:r.id})))}{field('New available bed','new_bed_id','text',true,availableBeds.map(b=>({label:(roomFor(b.room_id)?.room_number??'')+' · '+b.bed_code,value:b.id})))}{textArea('Transfer reason','notes')}{submitBar('Transfer resident')}</form>}<div className="table-scroll"><table><thead><tr><th>Date</th><th>Resident</th><th>Movement</th><th>From bed</th><th>To bed</th><th>Notes</th></tr></thead><tbody>{movements.filter(m=>m.movement_type==='transfer').map(m=><tr key={m.id}><td>{dateTime(m.occurred_at)}</td><td>{studentFor(residentFor(m.resident_id)?.student_id??'')?.full_name??'Student'}</td><td>{label(m.movement_type)}</td><td>{bedFor(m.from_bed_id)?.bed_code??'—'}</td><td>{bedFor(m.to_bed_id)?.bed_code??'—'}</td><td>{m.notes??'—'}</td></tr>)}</tbody></table></div></section>}
  {page==='check-in-check-out'&&<section className="ed360-data-card"><header><h2>Resident movement register</h2><p>Temporary exit and return events are recorded. Final check-out releases the resident bed.</p></header>{admin&&<form className="ed360-data-form" onSubmit={submit(movement,'Resident movement recorded.')}>{field('Active resident','resident_id','text',true,activeResidents.map(r=>({label:studentFor(r.student_id)?.full_name??'Student',value:r.id})))}{field('Movement','movement_type','text',true,[{label:'Temporary exit',value:'temporary_exit'},{label:'Return',value:'return'},{label:'Final check-out',value:'check_out'}])}{textArea('Notes','notes')}{submitBar('Record movement')}</form>}<div className="table-scroll"><table><thead><tr><th>Time</th><th>Resident</th><th>Movement</th><th>Notes</th></tr></thead><tbody>{movements.map(m=><tr key={m.id}><td>{dateTime(m.occurred_at)}</td><td>{studentFor(residentFor(m.resident_id)?.student_id??'')?.full_name??'Student'}</td><td>{label(m.movement_type)}</td><td>{m.notes??'—'}</td></tr>)}</tbody></table></div></section>}
  {page==='hostel-visitor-register'&&<section className="ed360-data-card"><header><h2>Hostel visitor register</h2><p>Record guest visits against an active resident. Visitor records remain institution-restricted.</p></header>{admin&&<form className="ed360-data-form" onSubmit={submit(v=>create('hostel_guest_visits',{resident_id:v.resident_id,guest_name:v.guest_name,relationship:v.relationship||null,purpose:v.purpose,check_in_at:new Date().toISOString(),badge_number:v.badge_number||null,notes:v.notes||null,recorded_by:user!.id}),'Guest visit recorded.')}>{field('Resident','resident_id','text',true,activeResidents.map(r=>({label:studentFor(r.student_id)?.full_name??'Student',value:r.id})))}{field('Guest name','guest_name')}{field('Relationship','relationship', 'text',false)}{field('Purpose','purpose')}{field('Badge number','badge_number','text',false)}{textArea('Notes','notes')}{submitBar('Register guest')}</form>}<div className="table-scroll"><table><thead><tr><th>Guest</th><th>Resident</th><th>Relationship</th><th>Purpose</th><th>Entry</th><th>Exit</th><th>Action</th></tr></thead><tbody>{guests.map(g=><tr key={g.id}><td>{g.guest_name}</td><td>{studentFor(residentFor(g.resident_id)?.student_id??'')?.full_name??'Resident'}</td><td>{g.relationship??'—'}</td><td>{g.purpose}</td><td>{dateTime(g.check_in_at)}</td><td>{dateTime(g.check_out_at)}</td><td>{admin&&!g.check_out_at&&<button className="iop-button" type="button" onClick={()=>void markGuestExit(g)}>Check out guest</button>}</td></tr>)}</tbody></table></div></section>}
  {page==='hostel-fees'&&<section className="ed360-data-card"><header><h2>Accommodation charges</h2><p>Separate from tuition/fee invoices. Payment reconciliation with your main finance ledger must be recorded separately.</p></header>{admin&&<form className="ed360-data-form" onSubmit={submit(v=>create('hostel_fee_charges',{resident_id:v.resident_id,billing_period:v.billing_period,amount:Number(v.amount),paid_amount:Number(v.paid_amount||0),due_date:v.due_date,status:Number(v.paid_amount||0)===0?'pending':Number(v.paid_amount)===Number(v.amount)?'paid':'part_paid',created_by:user!.id}),'Accommodation charge recorded.')}>{field('Resident','resident_id','text',true,activeResidents.map(r=>({label:studentFor(r.student_id)?.full_name??'Student',value:r.id})))}{field('Billing period','billing_period')}{field('Amount (PKR)','amount','number')}{field('Paid amount (PKR)','paid_amount','number',false)}{field('Due date','due_date','date')}{submitBar('Save accommodation charge')}</form>}<div className="table-scroll"><table><thead><tr><th>Resident</th><th>Period</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Due</th><th>Status</th></tr></thead><tbody>{fees.map(f=><tr key={f.id}><td>{studentFor(residentFor(f.resident_id)?.student_id??'')?.full_name??'Student'}</td><td>{f.billing_period}</td><td>{money(f.amount)}</td><td>{money(f.paid_amount)}</td><td>{money(Number(f.amount)-Number(f.paid_amount))}</td><td>{fmt(f.due_date)}</td><td>{label(f.status)}</td></tr>)}</tbody></table></div></section>}
  {page==='accommodation-maintenance'&&<section className="ed360-data-card"><header><h2>Accommodation maintenance</h2><p>Report and track room maintenance requests.</p></header>{staff&&<form className="ed360-data-form" onSubmit={submit(v=>create('hostel_maintenance_requests',{room_id:v.room_id,title:v.title,description:v.description||null,priority:v.priority,status:'open',reported_by:user!.id,assigned_to:null}),'Maintenance request opened.')}>{field('Room','room_id','text',true,rooms.map(r=>({label:buildingFor(r.building_id)?.name+' · '+r.room_number,value:r.id})))}{field('Request title','title')}{field('Priority','priority','text',true,['low','normal','high','urgent'].map(x=>({label:label(x),value:x})))}{textArea('Description','description')}{submitBar('Create maintenance request')}</form>}<div className="table-scroll"><table><thead><tr><th>Room</th><th>Request</th><th>Priority</th><th>Status</th><th>Reported</th><th>Action</th></tr></thead><tbody>{maintenance.map(m=><tr key={m.id}><td>{roomFor(m.room_id)?.room_number??'Room'}</td><td>{m.title}<small>{m.description}</small></td><td>{label(m.priority)}</td><td>{label(m.status)}</td><td>{dateTime(m.created_at)}</td><td>{admin&&m.status==='open'&&<button className="iop-button" onClick={()=>void updateMaintenance(m,'in_progress')}>Start</button>}{admin&&m.status==='in_progress'&&<button className="iop-button primary" onClick={()=>void updateMaintenance(m,'resolved')}>Resolve</button>}</td></tr>)}</tbody></table></div></section>}
  {page==='occupancy-reports'&&<section className="ed360-data-card"><header><h2>Residence occupancy</h2><p>Live counts by building and room, based on active residents and available bed registers.</p><button className="button button-outline" onClick={()=>window.print()}><Download size={15}/> Print report</button></header><div className="table-scroll"><table><thead><tr><th>Building</th><th>Room</th><th>Capacity</th><th>Bed records</th><th>Occupied</th><th>Available</th><th>Occupancy</th></tr></thead><tbody>{rooms.map(r=>{const roomBeds=beds.filter(b=>b.room_id===r.id);const occupied=roomBeds.filter(b=>b.status==='occupied').length;return <tr key={r.id}><td>{buildingFor(r.building_id)?.name??'—'}</td><td>{r.room_number}</td><td>{r.capacity}</td><td>{roomBeds.length}</td><td>{occupied}</td><td>{roomBeds.filter(b=>b.status==='available').length}</td><td>{roomBeds.length?Math.round(occupied/roomBeds.length*100):0}%</td></tr>})}</tbody></table></div></section>}
  <section className="ed360-data-card ed360-hostel-footer"><div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search this workspace…" aria-label="Search hostel records"/><select aria-label="Filter status" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="available">Available</option><option value="occupied">Occupied</option><option value="maintenance">Maintenance</option><option value="checked_out">Checked out</option><option value="resolved">Resolved</option></select></div><small>Changes are saved to the institution residence records. Only owner/admin can allocate, transfer or check out residents; approved read access is role-scoped.</small></section>
 </main>
}
