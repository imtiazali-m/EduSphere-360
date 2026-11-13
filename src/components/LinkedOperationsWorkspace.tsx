import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { BookOpen, Bus, MapPin, Package, Plus, RefreshCw, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/userErrors'
import { downloadCsv } from '../lib/csv'
import { getWorkspaceGroup } from '../lib/institutionalCatalog'
import { createRecord } from '../lib/data'

type Props={workspaceKey:string;onToast:(message:string,error?:boolean)=>void;onNavigate:(key:string)=>void}
type Campus={id:string;name:string;campus_code?:string|null;address?:string|null;phone?:string|null;email?:string|null;branch_head_name?:string|null;academic_settings?:Record<string,unknown>;operational_settings?:Record<string,unknown>;is_headquarters:boolean;is_active:boolean}
type Book={id:string;title:string;reference_code?:string|null;quantity?:number|null;payload?:Record<string,unknown>}
type Student={id:string;full_name:string;admission_no?:string|null;class_name?:string|null}
type Item={id:string;title:string;reference_code?:string|null;quantity?:number|null;payload?:Record<string,unknown>}
type RouteRecord={id:string;title:string;reference_code?:string|null;parent_record_id?:string|null;payload?:Record<string,unknown>;record_type?:string;description?:string|null;status?:string}
type Loan={id:string;book_record_id:string;student_id:string|null;issued_at:string;due_at:string;returned_at:string|null;status:string;fine_amount:number;notes?:string|null}
type Movement={id:string;item_record_id:string;movement_type:string;quantity:number;unit_cost?:number|null;movement_date:string;reference_code?:string|null;notes?:string|null}
type Allocation={id:string;student_id:string;route_record_id:string;stop_record_id?:string|null;vehicle_record_id?:string|null;effective_from:string;effective_to?:string|null;transport_fee:number;status:string;notes?:string|null}
type TransportEvent={id:string;allocation_id:string;event_type:'boarded'|'alighted'|'absent';occurred_at:string;recorded_by:string;notes?:string|null;source:string}
type FeeCharge={id:string;allocation_id:string;billing_period:string;amount:number;paid_amount:number;due_date:string;status:string}
type FeePayment={id:string;charge_id:string;amount:number;payment_method:string;payment_reference?:string|null;received_at:string}

const today=()=>new Date().toLocaleDateString('en-CA')
const pkMoney=(value:number)=>new Intl.NumberFormat('en-PK',{style:'currency',currency:'PKR',maximumFractionDigits:0}).format(Number(value)||0)
const dateLabel=(value:string|null|undefined)=>value?new Date(value+'T00:00:00').toLocaleDateString():'—'
const statusText=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,char=>char.toUpperCase())
type PageResult<T>={data:T[]|null;error:{message:string}|null}

async function loadAllPages<T>(
 fetchPage:(from:number,to:number)=>PromiseLike<PageResult<T>>,
 pageSize=500
):Promise<T[]>{
 const all:T[]=[]
 for(let from=0;;from+=pageSize){
  const {data,error}=await fetchPage(from,from+pageSize-1)
  if(error)throw error
  const page=data??[]
  all.push(...page)
  if(page.length<pageSize)break
 }
 return all
}

const palette:Record<string,{accent:string;soft:string;ink:string}>={
 administration:{accent:'#667d98',soft:'#f0f3f7',ink:'#344a61'},
 library:{accent:'#5368c9',soft:'#eef0ff',ink:'#35458f'},
 inventory:{accent:'#c58b24',soft:'#fff7e8',ink:'#795515'},
 transport:{accent:'#d87831',soft:'#fff1e8',ink:'#8d481d'}
}

export function LinkedOperationsWorkspace({workspaceKey,onToast,onNavigate}:Props){
 const {user,mode}=useAuth()
 const [groupKey,itemKey]=workspaceKey.split(':')
 const group=getWorkspaceGroup(groupKey)
 const [loading,setLoading]=useState(true)
 const [loadError,setLoadError]=useState('')
 const [saving,setSaving]=useState(false)
 const [campusSearch,setCampusSearch]=useState('')
 const [campusPage,setCampusPage]=useState(1)
 const [librarySearch,setLibrarySearch]=useState('')
 const [libraryPage,setLibraryPage]=useState(1)
 const [inventorySearch,setInventorySearch]=useState('')
 const [inventoryPage,setInventoryPage]=useState(1)
 const [movementSearch,setMovementSearch]=useState('')
 const [movementPage,setMovementPage]=useState(1)
 const [allocationSearch,setAllocationSearch]=useState('')
 const [allocationPage,setAllocationPage]=useState(1)
 const [routeSearch,setRouteSearch]=useState('')
 const [routePage,setRoutePage]=useState(1)
 const pageSize=10

 const [campuses,setCampuses]=useState<Campus[]>([])
 const [books,setBooks]=useState<Book[]>([])
 const [students,setStudents]=useState<Student[]>([])
 const [loans,setLoans]=useState<Loan[]>([])
 const [items,setItems]=useState<Item[]>([])
 const [movements,setMovements]=useState<Movement[]>([])
 const [routes,setRoutes]=useState<RouteRecord[]>([])
 const [stops,setStops]=useState<RouteRecord[]>([])
 const [vehicles,setVehicles]=useState<RouteRecord[]>([])
 const [allocations,setAllocations]=useState<Allocation[]>([])
 const [transportEvents,setTransportEvents]=useState<TransportEvent[]>([])
 const [attendanceSearch,setAttendanceSearch]=useState('')
 const [showTransportEventForm,setShowTransportEventForm]=useState(false)
 const [attendanceAllocation,setAttendanceAllocation]=useState('')
 const [attendanceType,setAttendanceType]=useState<'boarded'|'alighted'|'absent'>('boarded')
 const [attendanceNotes,setAttendanceNotes]=useState('')
 const [editingCampus,setEditingCampus]=useState<Campus|null>(null)
 const [campusName,setCampusName]=useState('')
 const [campusCode,setCampusCode]=useState('')
 const [campusAddress,setCampusAddress]=useState('')
 const [campusPhone,setCampusPhone]=useState('')
 const [campusEmail,setCampusEmail]=useState('')
 const [campusBranchHead,setCampusBranchHead]=useState('')
 const [campusAcademicSettings,setCampusAcademicSettings]=useState('{}')
 const [campusOperationalSettings,setCampusOperationalSettings]=useState('{}')
 const [campusHQ,setCampusHQ]=useState(false)
 const [campusActive,setCampusActive]=useState(true)
 const [showCampusForm,setShowCampusForm]=useState(false)
 const [bookId,setBookId]=useState('')
 const [studentId,setStudentId]=useState('')
 const [loanDue,setLoanDue]=useState(()=>new Date(Date.now()+14*86400000).toLocaleDateString('en-CA'))
 const [loanNotes,setLoanNotes]=useState('')
 const [showLoanForm,setShowLoanForm]=useState(false)
 const [itemId,setItemId]=useState('')
 const [movementType,setMovementType]=useState(itemKey==='stock-in'?'stock_in':itemKey==='stock-out'?'stock_out':itemKey==='stock-allocation'?'allocation':'adjustment')
 const [movementQty,setMovementQty]=useState('1')
 const [movementCost,setMovementCost]=useState('')
 const [movementDate,setMovementDate]=useState(today())
 const [movementRef,setMovementRef]=useState('')
 const [movementNotes,setMovementNotes]=useState('')
 const [showMovementForm,setShowMovementForm]=useState(false)
 const [allocationStudent,setAllocationStudent]=useState('')
 const [allocationRoute,setAllocationRoute]=useState('')
 const [allocationStop,setAllocationStop]=useState('')
 const [allocationVehicle,setAllocationVehicle]=useState('')
 const [allocationFrom,setAllocationFrom]=useState(today())
 const [allocationTo,setAllocationTo]=useState('')
 const [transportFee,setTransportFee]=useState('')
 const [allocationNotes,setAllocationNotes]=useState('')
 const [showAllocationForm,setShowAllocationForm]=useState(false)
 const [libraryCategories,setLibraryCategories]=useState<RouteRecord[]>([])
 const [libraryResources,setLibraryResources]=useState<RouteRecord[]>([])
 const [inventoryCategories,setInventoryCategories]=useState<RouteRecord[]>([])
 const [drivers,setDrivers]=useState<RouteRecord[]>([])
 const [vehicleMaintenance,setVehicleMaintenance]=useState<RouteRecord[]>([])
 const [transportFeeCharges,setTransportFeeCharges]=useState<FeeCharge[]>([])
 const [transportFeePayments,setTransportFeePayments]=useState<FeePayment[]>([])
 const [showManagedRecordForm,setShowManagedRecordForm]=useState(false)
 const [managedDraft,setManagedDraft]=useState<Record<string,string>>({title:'',code:'',description:'',category:'',quantity:'1',sku:'',unit:'unit',unit_cost:'0',reorder_level:'0',author:'',publisher:'',isbn:'',shelf_location:'',resource_url:'',audience:'all',route_id:'',route_code:'',stop_order:'1',arrival_time:'',departure_time:'',registration_number:'',vehicle_type:'bus',capacity:'20',phone:'',license_number:'',license_expiry:'',vehicle_id:'',maintenance_type:'service',maintenance_date:today(),maintenance_cost:'0'})
 const [feeAllocationId,setFeeAllocationId]=useState('')
 const [feeBillingPeriod,setFeeBillingPeriod]=useState(new Date().toISOString().slice(0,7))
 const [feeDueDate,setFeeDueDate]=useState(today())
 const [feeChargeId,setFeeChargeId]=useState('')
 const [feePaymentAmount,setFeePaymentAmount]=useState('')
 const [feePaymentMethod,setFeePaymentMethod]=useState('cash')
 const [feePaymentReference,setFeePaymentReference]=useState('')

 const isCampus=groupKey==='administration'&&itemKey==='campus-and-branch-management'
 const isLibrary=groupKey==='library'&&['library-dashboard','book-management','book-catalogue','book-categories','book-registration','book-issue-and-returns','digital-library','learning-materials','resource-downloads','library-reports'].includes(itemKey)
 const isLibraryCatalog=['library-dashboard','book-management','book-catalogue','book-categories','book-registration','digital-library','learning-materials','resource-downloads'].includes(itemKey)
 const isLibraryResources=['digital-library','learning-materials','resource-downloads'].includes(itemKey)
 const isLibraryReport=groupKey==='library'&&itemKey==='library-reports'
 const isInventory=groupKey==='inventory'&&['inventory-dashboard','items-management','item-catalogue','item-categories','stock-in','stock-out','stock-allocation','stock-adjustments','inventory-history','stock-reports'].includes(itemKey)
 const isInventoryCatalog=['inventory-dashboard','items-management','item-catalogue','item-categories'].includes(itemKey)
 const isTransport=groupKey==='transport'&&['transport-dashboard','vehicle-management','drivers-management','transport-routes','route-stops','student-transport-allocation','transport-fees','transport-assignments','vehicle-maintenance','transport-attendance','transport-history','transport-reports'].includes(itemKey)
 const isTransportReport=groupKey==='transport'&&['transport-dashboard','transport-history','transport-reports'].includes(itemKey)
 const isTransportRegistry=['vehicle-management','drivers-management','transport-routes','route-stops','vehicle-maintenance'].includes(itemKey)
 const isTransportFees=groupKey==='transport'&&itemKey==='transport-fees'
 const isTransportAttendance=groupKey==='transport'&&itemKey==='transport-attendance'
 const canRecordTransportAttendance=Boolean(user&&['owner','admin','teacher'].includes(user.role))
 const canAdmin=Boolean(user&&['owner','admin'].includes(user.role))
 const canLibrary=Boolean(user&&['owner','admin','teacher'].includes(user.role))
 const theme=palette[groupKey]??palette.administration

 const load=useCallback(async()=>{
  if(!supabase||!user){setLoading(false);return}
  const db=supabase
  setLoading(true);setLoadError('')
  try{
   if(isCampus){
    const {data,error}=await supabase.from('campuses').select('*').eq('institution_id',user.institutionId).order('name')
    if(error)throw error
    setCampuses((data??[]) as Campus[])
    }else if(isLibrary){
     const [catalogResult,studentResult,loanRows]=await Promise.all([
      supabase.from('institutional_records').select('id,title,reference_code,quantity,payload,description,status,record_type,parent_record_id').eq('institution_id',user.institutionId).eq('module_key','library').in('record_type',['book-registration','book-management','book-catalogue','book-categories','digital-library','learning-materials','resource-downloads']).order('title'),
      supabase.from('students').select('id,full_name,admission_no,class_name').eq('institution_id',user.institutionId).eq('status','active').order('full_name'),
      loadAllPages<Loan>((from,to)=>db.from('library_loans').select('*').eq('institution_id',user.institutionId).order('issued_at',{ascending:false}).range(from,to))
     ])
     if(catalogResult.error)throw catalogResult.error
     if(studentResult.error)throw studentResult.error
     const catalog=(catalogResult.data??[]) as RouteRecord[]
     setBooks(catalog.filter(row=>['book-registration','book-management','book-catalogue'].includes(String(row.record_type??''))) as Book[])
     setLibraryCategories(catalog.filter(row=>row.record_type==='book-categories'))
     setLibraryResources(catalog.filter(row=>['digital-library','learning-materials','resource-downloads'].includes(String(row.record_type??''))))
     setStudents((studentResult.data??[]) as Student[]);setLoans(loanRows)
   }else if(isInventory){
     const [itemResult,categoryResult,movementRows]=await Promise.all([
      supabase.from('institutional_records').select('id,title,reference_code,quantity,payload').eq('institution_id',user.institutionId).eq('module_key','inventory').in('record_type',['items-management','item-catalogue']).order('title'),
      supabase.from('institutional_records').select('id,title,reference_code,payload,description,status').eq('institution_id',user.institutionId).eq('module_key','inventory').eq('record_type','item-categories').order('title'),
      loadAllPages<Movement>((from,to)=>db.from('inventory_movements').select('*').eq('institution_id',user.institutionId).order('movement_date',{ascending:false}).range(from,to))
     ])
     if(itemResult.error)throw itemResult.error
     if(categoryResult.error)throw categoryResult.error
     setItems((itemResult.data??[]) as Item[]);setInventoryCategories((categoryResult.data??[]) as RouteRecord[]);setMovements(movementRows)
   }else if(isTransport){
     const [studentResult,routeResult,stopResult,vehicleResult,extraResult,allocationRows,attendanceRows,feeRows,paymentRows]=await Promise.all([
      supabase.from('students').select('id,full_name,admission_no,class_name').eq('institution_id',user.institutionId).eq('status','active').order('full_name'),
      supabase.from('institutional_records').select('id,title,reference_code,payload').eq('institution_id',user.institutionId).eq('module_key','transport').eq('record_type','transport-routes').order('title'),
      supabase.from('institutional_records').select('id,title,reference_code,parent_record_id,payload').eq('institution_id',user.institutionId).eq('module_key','transport').eq('record_type','route-stops').order('title'),
      supabase.from('institutional_records').select('id,title,reference_code,payload').eq('institution_id',user.institutionId).eq('module_key','transport').eq('record_type','vehicle-management').order('title'),
      supabase.from('institutional_records').select('id,title,reference_code,parent_record_id,payload,description,status,record_type').eq('institution_id',user.institutionId).eq('module_key','transport').in('record_type',['drivers-management','vehicle-maintenance']).order('created_at',{ascending:false}),
      loadAllPages<Allocation>((from,to)=>db.from('student_transport_allocations').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false}).range(from,to)),
      loadAllPages<TransportEvent>((from,to)=>db.from('transport_attendance_events').select('*').eq('institution_id',user.institutionId).order('occurred_at',{ascending:false}).range(from,to)),
      supabase.from('student_transport_fee_charges').select('*').eq('institution_id',user.institutionId).order('due_date',{ascending:false}),
      supabase.from('student_transport_fee_payments').select('*').eq('institution_id',user.institutionId).order('received_at',{ascending:false})
     ])
     for(const result of [studentResult,routeResult,stopResult,vehicleResult,extraResult,feeRows,paymentRows])if(result.error)throw result.error
     const extras=(extraResult.data??[]) as RouteRecord[]
     setStudents((studentResult.data??[]) as Student[]);setRoutes((routeResult.data??[]) as RouteRecord[])
     setStops((stopResult.data??[]) as RouteRecord[]);setVehicles((vehicleResult.data??[]) as RouteRecord[])
     setDrivers(extras.filter(row=>row.record_type==='drivers-management'))
     setVehicleMaintenance(extras.filter(row=>row.record_type==='vehicle-maintenance'))
     setAllocations(allocationRows);setTransportEvents(attendanceRows)
     setTransportFeeCharges((feeRows.data??[]) as FeeCharge[]);setTransportFeePayments((paymentRows.data??[]) as FeePayment[])
    }catch(error){setLoadError(error instanceof Error?error.message:'The operation records could not be loaded.');}
  finally{setLoading(false)}
 },[user?.id,user?.institutionId,isCampus,isLibrary,isInventory,isTransport])

 useEffect(()=>{void load()},[load])
 const loanCounts=useMemo(()=>({
  issued:loans.filter(x=>x.status==='issued'&&x.due_at>=today()).length,
  overdue:loans.filter(x=>x.status==='issued'&&x.due_at<today()).length,
  returned:loans.filter(x=>x.status==='returned').length
 }),[loans])
 const stockRows=useMemo(()=>items.map(item=>{
  const entries=movements.filter(m=>m.item_record_id===item.id)
  const delta=entries.reduce((sum,m)=>sum+(['stock_in','return','adjustment'].includes(m.movement_type)?Number(m.quantity):-Number(m.quantity)),0)
  return {...item,available:Number(item.quantity??0)+delta,movements:entries.length}
 }),[items,movements])
 const allocationMap=useMemo(()=>new Map(students.map(student=>[student.id,student])),[students])
 const bookMap=useMemo(()=>new Map(books.map(book=>[book.id,book])),[books])
 const itemMap=useMemo(()=>new Map(items.map(item=>[item.id,item])),[items])
 const routeStops=useMemo(()=>{
  if(!allocationRoute)return stops
  const route=routes.find(row=>row.id===allocationRoute)
  const routeCode=String(route?.payload?.route_code??route?.reference_code??'').trim().toLowerCase()
  return stops.filter(stop=>{
   const related=String(stop.parent_record_id??stop.payload?.route_record_id??stop.payload?.route_id??'')
   const stopCode=String(stop.payload?.route_code??'').trim().toLowerCase()
   if(related)return related===allocationRoute
   if(stopCode&&routeCode)return stopCode===routeCode
   return true
  })
 },[stops,routes,allocationRoute])
 const displayedMovements=useMemo(()=>{
  if(itemKey==='stock-in')return movements.filter(row=>['stock_in','return'].includes(row.movement_type))
  if(itemKey==='stock-out')return movements.filter(row=>['stock_out','write_off'].includes(row.movement_type))
  if(itemKey==='stock-allocation')return movements.filter(row=>row.movement_type==='allocation')
  if(itemKey==='stock-adjustments')return movements.filter(row=>['adjustment','write_off'].includes(row.movement_type))
  return movements
 },[movements,itemKey])
 const matches=(values:unknown[],query:string)=>!query.trim()||values.map(value=>String(value??'')).join(' ').toLowerCase().includes(query.trim().toLowerCase())
 const visibleCampuses=useMemo(()=>campuses.filter(row=>matches([row.name,row.campus_code,row.branch_head_name,row.address,row.phone,row.email,row.is_active?'active':'inactive'],campusSearch)),[campuses,campusSearch])
 const visibleLoans=useMemo(()=>loans.filter(row=>{
  const book=bookMap.get(row.book_record_id)
  const student=students.find(item=>item.id===row.student_id)
  return matches([book?.title,book?.reference_code,student?.full_name,student?.admission_no,row.status,row.due_at,row.fine_amount,row.notes],librarySearch)
 }),[loans,bookMap,students,librarySearch])
 const visibleStockRows=useMemo(()=>stockRows.filter(row=>matches([row.title,row.reference_code,row.payload?.sku,row.payload?.item_category,row.available,row.payload?.reorder_level,row.payload?.unit_cost],inventorySearch)),[stockRows,inventorySearch])
 const visibleMovements=useMemo(()=>displayedMovements.filter(row=>matches([itemMap.get(row.item_record_id)?.title,row.movement_type,row.movement_date,row.quantity,row.reference_code,row.notes],movementSearch)),[displayedMovements,itemMap,movementSearch])
 const visibleAllocations=useMemo(()=>allocations.filter(row=>{
  const student=allocationMap.get(row.student_id)
  const route=routes.find(item=>item.id===row.route_record_id)
  const stop=stops.find(item=>item.id===row.stop_record_id)
  const vehicle=vehicles.find(item=>item.id===row.vehicle_record_id)
  return matches([student?.full_name,student?.admission_no,route?.title,stop?.title,vehicle?.title,row.status,row.effective_from,row.effective_to,row.transport_fee],allocationSearch)
 }),[allocations,allocationMap,routes,stops,vehicles,allocationSearch])
 function pageRows<T>(rows:T[],page:number){
  const current=Math.min(page,Math.max(1,Math.ceil(rows.length/pageSize)))
  return rows.slice((current-1)*pageSize,current*pageSize)
 }
 function pageControls(total:number,page:number,setPage:(page:number)=>void){
  const count=Math.max(1,Math.ceil(total/pageSize))
  const current=Math.min(page,count)
  return total>pageSize?<div className="ed360-linked-pagination">
   <span>Showing <b>{(current-1)*pageSize+1}–{Math.min(current*pageSize,total)}</b> of <b>{total}</b></span>
   <div><button type="button" disabled={current<=1} onClick={()=>setPage(current-1)}>Previous</button><span>Page {current} of {count}</span><button type="button" disabled={current>=count} onClick={()=>setPage(current+1)}>Next</button></div>
  </div>:null
 }

 const stockInUnits=movements.filter(row=>['stock_in','return'].includes(row.movement_type)).reduce((sum,row)=>sum+Number(row.quantity),0)
 const stockOutUnits=movements.filter(row=>['stock_out','write_off','allocation'].includes(row.movement_type)).reduce((sum,row)=>sum+Number(row.quantity),0)
 const overdueLoans=loans.filter(row=>row.status==='issued'&&row.due_at<today())
 const totalLibraryFines=loans.reduce((sum,row)=>sum+Number(row.fine_amount??0),0)
 const transportActive=allocations.filter(row=>row.status==='active')
 const transportFees=transportActive.reduce((sum,row)=>sum+Number(row.transport_fee??0),0)
 const routeAllocationRows=routes.map(route=>{
  const assigned=transportActive.filter(row=>row.route_record_id===route.id)
  return {route:route.title,students:assigned.length,vehicles:new Set(assigned.map(row=>row.vehicle_record_id).filter(Boolean)).size,fees:assigned.reduce((sum,row)=>sum+Number(row.transport_fee??0),0)}
 })
 const visibleRouteRows=useMemo(()=>routeAllocationRows.filter(row=>matches([row.route,row.students,row.vehicles,row.fees],routeSearch)),[routeAllocationRows,routeSearch])

 function resetCampus(row?:Campus){
  setEditingCampus(row??null);setCampusName(row?.name??'');setCampusCode(row?.campus_code??'');setCampusAddress(row?.address??'')
  setCampusPhone(row?.phone??'');setCampusEmail(row?.email??'');setCampusBranchHead(row?.branch_head_name??'')
  setCampusAcademicSettings(JSON.stringify(row?.academic_settings??{},null,2));setCampusOperationalSettings(JSON.stringify(row?.operational_settings??{},null,2))
  setCampusHQ(row?.is_headquarters??false);setCampusActive(row?.is_active??true);setShowCampusForm(true)
 }
 async function saveCampus(event:FormEvent){
  event.preventDefault();if(!supabase||!user||!canAdmin)return
  if(!campusName.trim()){onToast('Campus name is required.',true);return}
  let academicSettings:Record<string,unknown>,operationalSettings:Record<string,unknown>
  try{
   const academic=JSON.parse(campusAcademicSettings||'{}'),operational=JSON.parse(campusOperationalSettings||'{}')
   if(!academic||typeof academic!=='object'||Array.isArray(academic))throw new Error('Academic settings must be a JSON object.')
   if(!operational||typeof operational!=='object'||Array.isArray(operational))throw new Error('Operational settings must be a JSON object.')
   academicSettings=academic as Record<string,unknown>;operationalSettings=operational as Record<string,unknown>
  }catch(error){onToast(error instanceof Error?error.message:'Enter valid campus settings.',true);return}
  setSaving(true)
  const values={institution_id:user.institutionId,name:campusName.trim(),campus_code:campusCode.trim()||null,address:campusAddress.trim()||null,phone:campusPhone.trim()||null,email:campusEmail.trim()||null,branch_head_name:campusBranchHead.trim()||null,academic_settings:academicSettings,operational_settings:operationalSettings,is_headquarters:campusHQ,is_active:campusActive}
  const result=editingCampus
   ?await supabase.from('campuses').update(values).eq('institution_id',user.institutionId).eq('id',editingCampus.id)
   :await supabase.from('campuses').insert({...values,created_by:user.id})
  if(result.error){onToast(result.error.message,true);setSaving(false);return}
  setShowCampusForm(false);setEditingCampus(null);onToast(editingCampus?'Campus updated.':'Campus created.');setSaving(false);await load()
 }
 async function deleteCampus(row:Campus){
  if(!supabase||!user||!canAdmin)return
  if(!window.confirm('Delete campus '+row.name+'? Records linked to this campus prevent deletion.'))return
  const {error}=await supabase.from('campuses').delete().eq('institution_id',user.institutionId).eq('id',row.id)
  if(error){onToast(error.message,true);return}
  onToast('Campus deleted.');await load()
 }
 function updateManagedDraft(key:string,value:string){setManagedDraft(current=>({...current,[key]:value}))}
 function openManagedRecord(){
  setManagedDraft({title:'',code:'',description:'',category:'',quantity:'1',sku:'',unit:'unit',unit_cost:'0',reorder_level:'0',author:'',publisher:'',isbn:'',shelf_location:'',resource_url:'',audience:'all',route_id:'',route_code:'',stop_order:'1',arrival_time:'',departure_time:'',registration_number:'',vehicle_type:'bus',capacity:'20',phone:'',license_number:'',license_expiry:'',vehicle_id:'',maintenance_type:'service',maintenance_date:today(),maintenance_cost:'0'})
  setShowManagedRecordForm(true)
 }
 async function saveManagedRecord(event:FormEvent){
  event.preventDefault()
  if(!user||!canAdmin||saving)return
  const title=managedDraft.title.trim()
  if(!title){onToast('Enter a name or title before saving.',true);return}
  let recordType=itemKey
  let payload:Record<string,unknown>={description:managedDraft.description.trim()||null}
  let referenceCode=managedDraft.code.trim()||null
  let quantity:number|null=null
  let parentRecordId:string|null=null
  if(groupKey==='library'){
   if(['book-management','book-catalogue','book-registration'].includes(itemKey)){
    recordType='book-registration'
    const copies=Number(managedDraft.quantity||1)
    if(!Number.isInteger(copies)||copies<1){onToast('Book copy count must be a positive whole number.',true);return}
    quantity=copies;referenceCode=referenceCode||managedDraft.isbn.trim()||null
    payload={...payload,author:managedDraft.author.trim()||null,publisher:managedDraft.publisher.trim()||null,isbn:managedDraft.isbn.trim()||null,category:managedDraft.category.trim()||null,shelf_location:managedDraft.shelf_location.trim()||null,total_copies:copies,available_copies:copies}
   }else if(itemKey==='book-categories'){recordType='book-categories';payload={...payload,category_code:referenceCode}}
   else{recordType=itemKey;payload={...payload,resource_url:managedDraft.resource_url.trim(),category:managedDraft.category.trim()||null,audience:managedDraft.audience}}
  }else if(groupKey==='inventory'){
   if(['items-management','item-catalogue'].includes(itemKey)){
    recordType='items-management'
    quantity=Number(managedDraft.quantity||0)
    const unitCost=Number(managedDraft.unit_cost||0),reorder=Number(managedDraft.reorder_level||0)
    if(!Number.isFinite(quantity)||quantity<0||!Number.isFinite(unitCost)||unitCost<0||!Number.isFinite(reorder)||reorder<0){onToast('Enter valid non-negative quantity, cost and reorder values.',true);return}
    payload={...payload,sku:managedDraft.sku.trim()||referenceCode,unit:managedDraft.unit||'unit',unit_cost:unitCost,reorder_level:reorder,item_category:managedDraft.category.trim()||null}
   }else{recordType='item-categories';payload={...payload,category_code:referenceCode}}
  }else if(groupKey==='transport'){
   if(itemKey==='transport-routes'){
    payload={...payload,route_code:referenceCode,origin:managedDraft.category.trim()||null,destination:managedDraft.description.trim()||null,capacity:Number(managedDraft.capacity||0)}
   }else if(itemKey==='route-stops'){
    parentRecordId=managedDraft.route_id||null
    if(!parentRecordId){onToast('Choose the route for this stop.',true);return}
    payload={...payload,route_record_id:parentRecordId,stop_order:Number(managedDraft.stop_order||1),arrival_time:managedDraft.arrival_time||null,departure_time:managedDraft.departure_time||null}
   }else if(itemKey==='vehicle-management'){
    payload={...payload,registration_number:managedDraft.registration_number.trim()||referenceCode,vehicle_type:managedDraft.vehicle_type,seat_capacity:Number(managedDraft.capacity||0),make_model:managedDraft.category.trim()||null,insurance_expiry:managedDraft.license_expiry||null}
   }else if(itemKey==='drivers-management'){
    payload={...payload,phone:managedDraft.phone.trim()||null,license_number:managedDraft.license_number.trim()||null,license_expiry:managedDraft.license_expiry||null}
   }else if(itemKey==='vehicle-maintenance'){
    parentRecordId=managedDraft.vehicle_id||null
    payload={...payload,vehicle_record_id:parentRecordId,maintenance_type:managedDraft.maintenance_type,maintenance_date:managedDraft.maintenance_date,maintenance_cost:Number(managedDraft.maintenance_cost||0),status:'scheduled'}
   }
  }
  setSaving(true)
  try{
   const saved=await createRecord(mode,user,'institutional_records',{
    module_key:groupKey,record_type:recordType,title,reference_code:referenceCode,quantity,
    description:managedDraft.description.trim()||null,status:'active',parent_record_id:parentRecordId,payload
   })
   if(saved===null)throw new Error('The record could not be confirmed as saved.')
   setShowManagedRecordForm(false);onToast('Record saved to the institution '+groupKey+' register.');await load()
  }catch(error){onToast(userFacingError(error,'The record could not be saved.'),true)}
  finally{setSaving(false)}
 }
 async function createTransportCharge(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user||!['owner','admin','accountant'].includes(user.role))return
  if(!feeAllocationId){onToast('Select an active transport allocation.',true);return}
  setSaving(true)
  const {error}=await supabase.rpc('create_student_transport_fee_charge',{p_institution_id:user.institutionId,p_allocation_id:feeAllocationId,p_billing_period:feeBillingPeriod,p_due_date:feeDueDate})
  setSaving(false)
  if(error){onToast(userFacingError(error,'Transport fee charge could not be created.'),true);return}
  onToast('Transport fee charge created or updated for this billing period.');await load()
 }
 async function recordTransportPayment(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user||!['owner','admin','accountant'].includes(user.role))return
  const amount=Number(feePaymentAmount)
  if(!feeChargeId||!Number.isFinite(amount)||amount<=0){onToast('Select a charge and enter a positive payment amount.',true);return}
  setSaving(true)
  const {error}=await supabase.rpc('record_student_transport_fee_payment',{p_institution_id:user.institutionId,p_charge_id:feeChargeId,p_amount:amount,p_payment_method:feePaymentMethod,p_payment_reference:feePaymentReference.trim()||null})
  setSaving(false)
  if(error){onToast(userFacingError(error,'Transport fee payment could not be recorded.'),true);return}
  setFeePaymentAmount('');setFeePaymentReference('');onToast('Transport fee payment recorded and balance updated.');await load()
 }
 async function issueBook(event:FormEvent){
  event.preventDefault();if(!supabase||!user||!canLibrary)return
  const book=books.find(row=>row.id===bookId)
  const student=students.find(row=>row.id===studentId)
  if(!book||!student||!loanDue||loanDue<today()){onToast('Select a valid book and student, and enter a due date that is today or later.',true);return}
  const alreadyIssued=loans.some(row=>row.status==='issued'&&row.book_record_id===book.id&&row.student_id===student.id)
  if(alreadyIssued){onToast('This student already has this book checked out. Record the return before issuing it again.',true);return}
  const rawCopies=book.payload?.total_copies??book.quantity
  const totalCopies=rawCopies===undefined||rawCopies===null||rawCopies===''?1:Number(rawCopies)
  if(!Number.isFinite(totalCopies)||totalCopies<=0){onToast('This book has no valid available-copy count. Update its catalogue record before issuing it.',true);return}
  const activeCopies=loans.filter(row=>row.book_record_id===book.id&&row.status==='issued').length
  if(activeCopies>=totalCopies){onToast('All registered copies of this book are currently issued. Record a return or update the book catalogue before issuing another copy.',true);return}
  setSaving(true)
  const {error}=await supabase.rpc('issue_library_book',{
   p_institution_id:user.institutionId,p_book_record_id:book.id,p_student_id:student.id,
   p_due_at:loanDue,p_notes:loanNotes.trim()||null
  })
  if(error){onToast(userFacingError(error,'The book could not be issued. Check availability and try again.'),true);setSaving(false);return}
  setShowLoanForm(false);setBookId('');setStudentId('');setLoanNotes('');onToast('Book issued. Availability was verified and reserved in one database transaction.');setSaving(false);await load()
 }
 async function returnBook(loan:Loan){
  if(!supabase||!user||!canLibrary)return
  const {data,error}=await supabase.rpc('return_library_book',{p_institution_id:user.institutionId,p_loan_id:loan.id})
  if(error){onToast(userFacingError(error,'The book return could not be recorded. Refresh the circulation register.'),true);return}
  const result=data as {late_days?:number;fine_amount?:number}
  const lateDays=Number(result?.late_days??0)
  const fineAmount=Number(result?.fine_amount??0)
  onToast(lateDays>0?'Book returned. '+lateDays+' overdue day(s); fine assessed: '+pkMoney(fineAmount)+'.':'Book return recorded. No overdue fine was due.');await load()
 }
 async function saveMovement(event:FormEvent){
  event.preventDefault();if(!supabase||!user||!canAdmin)return
  const qty=Number(movementQty);const cost=movementCost.trim()?Number(movementCost):null
  if(!itemId||!Number.isFinite(qty)||qty<=0||cost!==null&&(!Number.isFinite(cost)||cost<0)){onToast('Select an item and enter a valid positive quantity and non-negative unit cost.',true);return}
  setSaving(true)
  const {data,error}=await supabase.rpc('record_inventory_movement',{
   p_institution_id:user.institutionId,p_item_record_id:itemId,p_movement_type:movementType,
   p_quantity:qty,p_unit_cost:cost,p_movement_date:movementDate,p_reference_code:movementRef.trim()||null,p_notes:movementNotes.trim()||null
  })
  if(error){onToast(error.message,true);setSaving(false);return}
  const result=data as {current_stock?:number}
  setShowMovementForm(false);setMovementQty('1');setMovementCost('');setMovementRef('');setMovementNotes('')
  onToast('Stock movement saved. New available balance: '+String(result.current_stock??'updated')+'.');setSaving(false);await load()
 }
 async function createAllocation(event:FormEvent){
  event.preventDefault();if(!supabase||!user||!canAdmin)return
  if(!allocationStudent||!allocationRoute||!allocationFrom){onToast('Select a student, route and allocation start date.',true);return}
  if(allocationTo&&allocationTo<allocationFrom){onToast('Allocation end date cannot precede its start date.',true);return}
  const selectedRoute=routes.find(row=>row.id===allocationRoute)
  const selectedStop=stops.find(row=>row.id===allocationStop)
  const selectedVehicle=vehicles.find(row=>row.id===allocationVehicle)
  if(!selectedRoute){onToast('Select a route registered by this institution.',true);return}
  if(allocationStop&&!selectedStop){onToast('Select a stop registered by this institution.',true);return}
  if(selectedStop){
   const linkedRoute=String(selectedStop.parent_record_id??selectedStop.payload?.route_record_id??selectedStop.payload?.route_id??'')
   const selectedRouteCode=String(selectedRoute.payload?.route_code??selectedRoute.reference_code??'').trim().toLowerCase()
   const selectedStopRouteCode=String(selectedStop.payload?.route_code??'').trim().toLowerCase()
   if(linkedRoute&&linkedRoute!==allocationRoute){onToast('The selected stop belongs to a different route.',true);return}
   if(selectedStopRouteCode&&selectedRouteCode&&selectedStopRouteCode!==selectedRouteCode){onToast('The selected stop route code does not match the selected route.',true);return}
  }
  if(allocationVehicle&&!selectedVehicle){onToast('Select a vehicle registered by this institution.',true);return}
  const overlaps=(startA:string,endA:string|null|undefined,startB:string,endB:string|null|undefined)=>startA<=(endB||'9999-12-31')&&startB<=(endA||'9999-12-31')
  const conflict=allocations.find(row=>row.status==='active'&&row.student_id===allocationStudent&&overlaps(allocationFrom,allocationTo||null,row.effective_from,row.effective_to??null))
  if(conflict){onToast('This student already has an active transport allocation covering part of these dates. End the current allocation or choose a non-overlapping period.',true);return}
  const fee=transportFee.trim()?Number(transportFee):0
  if(!Number.isFinite(fee)||fee<0){onToast('Transport fee must be a valid non-negative amount.',true);return}
  if(selectedVehicle){
   const capacity=Number(selectedVehicle.payload?.seat_capacity??selectedVehicle.payload?.capacity??selectedVehicle.payload?.seating_capacity??0)
   const occupied=allocations.filter(row=>row.status==='active'&&row.vehicle_record_id===selectedVehicle.id&&overlaps(allocationFrom,allocationTo||null,row.effective_from,row.effective_to??null)).length
   if(Number.isFinite(capacity)&&capacity>0&&occupied>=capacity){onToast('The selected vehicle is at capacity for at least part of this allocation period.',true);return}
  }
  setSaving(true)
  const {error}=await supabase.rpc('create_student_transport_allocation',{
   p_institution_id:user.institutionId,p_student_id:allocationStudent,p_route_record_id:selectedRoute.id,
   p_stop_record_id:allocationStop||null,p_vehicle_record_id:allocationVehicle||null,
   p_effective_from:allocationFrom,p_effective_to:allocationTo||null,p_transport_fee:fee,p_notes:allocationNotes.trim()||null
  })
  if(error){onToast(userFacingError(error,'The transport allocation could not be created. Recheck dates, route and vehicle capacity.'),true);setSaving(false);return}
  setShowAllocationForm(false);setAllocationStudent('');setAllocationRoute('');setAllocationStop('');setAllocationVehicle('');setTransportFee('');setAllocationNotes('');setAllocationFrom(today());setAllocationTo('')
  onToast('Transport allocation created after checking route, stop, date conflicts and available vehicle capacity.');setSaving(false);await load()
 }
 async function saveTransportAttendance(event:FormEvent){
  event.preventDefault();if(!supabase||!user||!canRecordTransportAttendance)return
  const allocation=allocations.find(row=>row.id===attendanceAllocation&&row.status==='active')
  if(!allocation){onToast('Select an active student transport allocation.',true);return}
  const previous=[...transportEvents].filter(row=>row.allocation_id===allocation.id).sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at))[0]
  if(attendanceType==='boarded'&&previous?.event_type==='boarded'){onToast('This student is already recorded as on board. Record alighting before another boarding event.',true);return}
  if(attendanceType==='alighted'&&previous?.event_type!=='boarded'){onToast('Alighting can only be recorded after a boarding event.',true);return}
  setSaving(true)
  const {error}=await supabase.from('transport_attendance_events').insert({
   institution_id:user.institutionId,allocation_id:allocation.id,event_type:attendanceType,
   occurred_at:new Date().toISOString(),recorded_by:user.id,notes:attendanceNotes.trim()||null,source:'manual'
  })
  if(error){onToast(userFacingError(error,'The transport attendance event could not be saved.'),true);setSaving(false);return}
  onToast(attendanceType==='boarded'?'Student boarding recorded.':attendanceType==='alighted'?'Student alighting recorded.':'Student marked absent for this route event.')
  setShowTransportEventForm(false);setAttendanceNotes('');setAttendanceAllocation('');setSaving(false);await load()
 }
 async function cancelAllocation(row:Allocation){
  if(!supabase||!user||!canAdmin)return
  const {error}=await supabase.rpc('end_student_transport_allocation',{p_institution_id:user.institutionId,p_allocation_id:row.id})
  if(error){onToast(userFacingError(error,'The transport allocation could not be ended.'),true);return}
  onToast('Transport allocation ended.');await load()
 }

 if(!user||!group)return null
 const specialTitle=isTransportAttendance?'Transport Attendance':isCampus?'Campus and Branch Management':isLibrary?(isLibraryReport?'Library Circulation Reports':'Book Issue and Returns'):isInventory?(itemKey==='stock-reports'?'Inventory Stock Reports':itemKey==='inventory-history'?'Inventory Movement History':itemKey==='stock-in'?'Stock In':itemKey==='stock-out'?'Stock Out':itemKey==='stock-allocation'?'Stock Allocation':itemKey==='stock-adjustments'?'Stock Adjustments':'Inventory Stock Movements'):isTransport?(isTransportReport?'Transport Allocation Reports':isTransportAttendance?'Transport Attendance':'Student Transport Allocation'):'Institution Operations'
 const nav=<nav className="ed360-operations-window-nav ed360-workspace-tabs" aria-label={group.label+' submenus'}>{group.items.map(menu=><button key={menu.key} className={menu.key===itemKey?'active':''} type="button" onClick={()=>onNavigate('institutional:'+group.key+':'+menu.key)}>{menu.label}</button>)}</nav>
 const header=<header className="ed360-workspace-hero" style={{'--workspace-accent':theme.accent,'--workspace-soft':theme.soft,'--workspace-ink':theme.ink} as CSSProperties}><div className="ed360-workspace-hero-icon">{isCampus?<MapPin size={21}/>:isLibrary?<BookOpen size={21}/>:isInventory?<Package size={21}/>:<Bus size={21}/>}</div><div className="ed360-workspace-hero-copy"><span>{group.label.toUpperCase()} / LIVE RELATIONAL WORKFLOW</span><h1>{specialTitle}</h1><p>{isCampus?'Manage real institution branches. Campus assignments are referenced by existing institutional tables.':isLibrary?(isLibraryReport?'Review actual issue, return, overdue and fine activity from the library loan ledger.':'Issue and return books against student records, with due dates and traceable circulation history.'):isInventory?'Record stock movement through an atomic transaction that prevents inventory going below zero.':isTransport?(isTransportReport?'Review active allocations, registered routes, vehicle usage and recorded transport fees.':isTransportAttendance?'Record and review student boarding, alighting and absence events against active route allocations.':'Allocate students to registered routes, stops and vehicles with effective dates and transport fees.'):'Institution operations'}</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Live Supabase records</span>{isCampus&&canAdmin&&<button className="button button-primary" onClick={()=>resetCampus()}><Plus size={16}/> Add campus</button>}{isLibrary&&!isLibraryReport&&canLibrary&&<button className="button button-primary" onClick={()=>setShowLoanForm(true)}><Plus size={16}/> Issue book</button>}{isInventory&&!['stock-reports','inventory-history'].includes(itemKey)&&canAdmin&&<button className="button button-primary" onClick={()=>setShowMovementForm(true)}><Plus size={16}/> Record movement</button>}{isTransport&&!isTransportReport&&!isTransportAttendance&&canAdmin&&<button className="button button-primary" onClick={()=>setShowAllocationForm(true)}><Plus size={16}/> Allocate student</button>}{isTransportAttendance&&canRecordTransportAttendance&&<button className="button button-primary" onClick={()=>setShowTransportEventForm(true)}><Plus size={16}/> Record route event</button>}</div></header>

 return <main className="page-content ed360-module-page ed360-institutional-workspace ed360-linked-operations" style={{'--workspace-accent':theme.accent,'--workspace-soft':theme.soft,'--workspace-ink':theme.ink} as React.CSSProperties}>
  {header}{nav}
  {loadError&&<div className="ed360-workspace-error" role="alert">{loadError}</div>}
  {loading?<div className="ed360-workspace-empty">Loading secure institution records…</div>:null}

  {isCampus&&<>
   <section className="ed360-workspace-kpis"><article><span>Registered campuses</span><strong>{campuses.length}</strong><small>Institution branches and sites</small></article><article><span>Active campuses</span><strong>{campuses.filter(x=>x.is_active).length}</strong><small>Available for assignment</small></article><article><span>Headquarters</span><strong>{campuses.filter(x=>x.is_headquarters).length}</strong><small>Primary campus designation</small></article><article><span>Inactive</span><strong>{campuses.filter(x=>!x.is_active).length}</strong><small>Retained in records</small></article></section>
   <section className="table-card ed360-workspace-record-card"><div className="table-toolbar"><div className="table-count"><strong>{visibleCampuses.length}</strong> matching campuses · Institution scope</div><span className="ed360-table-refresh"><button type="button" onClick={()=>void load()}>Refresh <RefreshCw size={13}/></button></span></div>
    <label className="ed360-linked-search">Search campuses<input aria-label="Search campuses" value={campusSearch} onChange={e=>{setCampusSearch(e.target.value);setCampusPage(1)}} placeholder="Name, campus code, branch head, address or contact…"/></label>
    {visibleCampuses.length===0?<div className="ed360-workspace-empty"><strong>No campuses are registered</strong><span>Add a campus or branch before assigning institutional records to a site.</span>{canAdmin&&<button className="button button-primary" onClick={()=>resetCampus()}>Add first campus</button>}</div>:<div className="table-scroll"><table><thead><tr><th>Campus code</th><th>Campus</th><th>Branch head</th><th>Address</th><th>Contact</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody>{pageRows(visibleCampuses,campusPage).map(row=><tr key={row.id}><td>{row.campus_code||'—'}</td><td><b>{row.name}</b></td><td>{row.branch_head_name||'Not assigned'}</td><td>{row.address||'—'}</td><td>{row.phone||row.email||'—'}</td><td>{row.is_headquarters?'Headquarters':'Branch'}</td><td><span className={'ed360-state-pill '+(row.is_active?'state-approved':'state-cancelled')}>{row.is_active?'Active':'Inactive'}</span></td><td><div className="ed360-row-actions">{canAdmin&&<button onClick={()=>resetCampus(row)}>Edit</button>}{canAdmin&&<button onClick={()=>void deleteCampus(row)}>Delete</button>}</div></td></tr>)}</tbody></table></div>}
    {pageControls(visibleCampuses.length,campusPage,setCampusPage)}
   </section>
   {showCampusForm&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShowCampusForm(false)}}><section className="modal-card ed360-context-form" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">INSTITUTION ADMINISTRATION / CAMPUS</div><h2>{editingCampus?'Edit campus':'Register campus / branch'}</h2></div><button className="icon-button" onClick={()=>setShowCampusForm(false)}><X size={18}/></button></div><form className="ed360-context-form-grid" onSubmit={saveCampus}><label>Campus name *<input required value={campusName} onChange={e=>setCampusName(e.target.value)}/></label><label>Campus code<input value={campusCode} onChange={e=>setCampusCode(e.target.value)}/></label><label>Branch head<input value={campusBranchHead} onChange={e=>setCampusBranchHead(e.target.value)} placeholder="Responsible campus head"/></label><label>Address<textarea rows={2} value={campusAddress} onChange={e=>setCampusAddress(e.target.value)}/></label><div className="ed360-form-row"><label>Phone<input value={campusPhone} onChange={e=>setCampusPhone(e.target.value)}/></label><label>Email<input type="email" value={campusEmail} onChange={e=>setCampusEmail(e.target.value)}/></label></div><label>Academic settings (JSON object)<textarea rows={4} value={campusAcademicSettings} onChange={e=>setCampusAcademicSettings(e.target.value)} placeholder="{&quot;default_session_id&quot;:&quot;...&quot;}"/></label><label>Operational settings (JSON object)<textarea rows={4} value={campusOperationalSettings} onChange={e=>setCampusOperationalSettings(e.target.value)} placeholder="{&quot;attendance_cutoff&quot;:&quot;...&quot;}"/></label><label className="ed360-check-label"><input type="checkbox" checked={campusHQ} onChange={e=>setCampusHQ(e.target.checked)}/> Headquarters</label><label className="ed360-check-label"><input type="checkbox" checked={campusActive} onChange={e=>setCampusActive(e.target.checked)}/> Active campus</label><div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowCampusForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving?'Saving…':'Save campus'}</button></div></form></section></div>}
  </>}

  {isLibrary&&<>
   <section className="ed360-workspace-kpis"><article><span>Books registered</span><strong>{books.length}</strong><small>Book catalogue records</small></article><article><span>Currently issued</span><strong>{loanCounts.issued}</strong><small>Not yet due</small></article><article><span>Overdue</span><strong>{overdueLoans.length}</strong><small>Past due date</small></article><article><span>{isLibraryReport?'Fines assessed':'Returned'}</span><strong>{isLibraryReport?pkMoney(totalLibraryFines):loanCounts.returned}</strong><small>{isLibraryReport?'Recorded at return time':'Completed circulation'}</small></article></section>
   <section className="table-card ed360-workspace-record-card"><div className="table-toolbar"><div className="table-count"><strong>{visibleLoans.length}</strong> matching {isLibraryReport?'historical circulation transactions':'circulation records'}</div><div className="ed360-row-actions">{isLibraryReport&&<button type="button" onClick={()=>downloadCsv('edusphere-library-circulation-'+today()+'.csv',loans.map(loan=>({book:bookMap.get(loan.book_record_id)?.title??'Book record',student:students.find(row=>row.id===loan.student_id)?.full_name??'Linked student',admission_no:students.find(row=>row.id===loan.student_id)?.admission_no??'',issued_at:loan.issued_at,due_at:loan.due_at,returned_at:loan.returned_at??'',status:loan.status,fine_amount:Number(loan.fine_amount??0)})),[{key:'book',label:'Book'},{key:'student',label:'Student'},{key:'admission_no',label:'Admission ID'},{key:'issued_at',label:'Issued'},{key:'due_at',label:'Due'},{key:'returned_at',label:'Returned'},{key:'status',label:'Status'},{key:'fine_amount',label:'Fine (PKR)'}])}>Export CSV</button>}<button type="button" onClick={()=>void load()}>Refresh <RefreshCw size={13}/></button></div></div>
    <label className="ed360-linked-search">Search circulation<input aria-label="Search library circulation" value={librarySearch} onChange={e=>{setLibrarySearch(e.target.value);setLibraryPage(1)}} placeholder="Book, student, admission ID, due date or status…"/></label>
    {visibleLoans.length===0?<div className="ed360-workspace-empty"><strong>No circulation records</strong><span>Register books under Book Registration before issuing them to students.</span></div>:<div className="table-scroll"><table><thead><tr><th>Book</th><th>Student</th><th>Admission ID</th><th>Issue date</th><th>Due date</th><th>Fine</th><th>Status</th><th>Action</th></tr></thead><tbody>{pageRows(visibleLoans,libraryPage).map(loan=>{const book=bookMap.get(loan.book_record_id);const student=students.find(x=>x.id===loan.student_id);const overdue=loan.status==='issued'&&loan.due_at<today();return <tr key={loan.id}><td><b>{book?.title??'Book record unavailable'}</b><small className="ed360-record-subtitle">{book?.reference_code??''}</small></td><td>{student?.full_name??'Linked learner'}</td><td>{student?.admission_no??'—'}</td><td>{dateLabel(loan.issued_at)}</td><td>{dateLabel(loan.due_at)}</td><td>{pkMoney(Number(loan.fine_amount??0))}</td><td><span className={'ed360-state-pill '+(overdue?'state-pending':loan.status==='returned'?'state-approved':'')}>{overdue?'Overdue':statusText(loan.status)}</span></td><td>{canLibrary&&loan.status==='issued'&&<button type="button" className="button button-outline" onClick={()=>void returnBook(loan)}>Record return</button>}</td></tr>})}</tbody></table></div>}
    {pageControls(visibleLoans.length,libraryPage,setLibraryPage)}
   </section>
   {showLoanForm&&<div className="modal-backdrop"><section className="modal-card ed360-context-form" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">DIGITAL LIBRARY / CIRCULATION</div><h2>Issue a book</h2><p>Issue an existing catalogue record to a linked student.</p></div><button className="icon-button" onClick={()=>setShowLoanForm(false)}><X size={18}/></button></div><form className="ed360-context-form-grid" onSubmit={issueBook}><label>Book *<select required value={bookId} onChange={e=>setBookId(e.target.value)}><option value="">Select book</option>{books.map(book=><option key={book.id} value={book.id}>{book.title}{book.reference_code?' · '+book.reference_code:''}</option>)}</select></label><label>Student *<select required value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Select student</option>{students.map(student=><option key={student.id} value={student.id}>{student.full_name}{student.admission_no?' · '+student.admission_no:''}</option>)}</select></label><label>Due date *<input type="date" required min={today()} value={loanDue} onChange={e=>setLoanDue(e.target.value)}/></label><label>Issue note<textarea rows={2} value={loanNotes} onChange={e=>setLoanNotes(e.target.value)}/></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowLoanForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving||!books.length}>Issue book</button></div></form></section></div>}
  </>}

  {isInventory&&<>
   {itemKey==='stock-reports'&&<section className="ed360-workspace-kpis"><article><span>Units received</span><strong>{stockInUnits.toLocaleString()}</strong><small>Stock in and returns</small></article><article><span>Units issued / written off</span><strong>{stockOutUnits.toLocaleString()}</strong><small>Outbound movements</small></article><article><span>Low / zero stock items</span><strong>{stockRows.filter(row=>row.available<=Number(row.payload?.reorder_level??0)).length}</strong><small>At or below reorder level</small></article><article><span>Estimated stock value</span><strong>{pkMoney(stockRows.reduce((sum,row)=>sum+row.available*Number(row.payload?.unit_cost??0),0))}</strong><small>Available units × recorded cost</small></article></section>}
   <section className="ed360-workspace-kpis"><article><span>Inventory items</span><strong>{items.length}</strong><small>Registered item catalogue</small></article><article><span>Available units</span><strong>{stockRows.reduce((sum,x)=>sum+x.available,0).toLocaleString()}</strong><small>Opening quantity plus ledger</small></article><article><span>Movement entries</span><strong>{movements.length}</strong><small>Stock transaction ledger</small></article><article><span>Low / zero stock</span><strong>{stockRows.filter(x=>x.available<=Number(x.payload?.reorder_level??0)).length}</strong><small>At or below reorder level</small></article></section>
   <section className="table-card ed360-workspace-record-card"><div className="table-toolbar"><div className="table-count"><strong>{items.length}</strong> catalogue items · {movements.length} movements</div><div className="ed360-row-actions">{itemKey==='stock-reports'&&<button type="button" onClick={()=>downloadCsv('edusphere-inventory-stock-report-'+today()+'.csv',stockRows.map(row=>({sku:row.payload?.sku??row.reference_code??'',item:row.title,category:row.payload?.item_category??'',opening_quantity:Number(row.quantity??0),available:row.available,reorder_level:row.payload?.reorder_level??'',unit_cost:row.payload?.unit_cost??0,estimated_value:row.available*Number(row.payload?.unit_cost??0)})),[{key:'sku',label:'SKU'},{key:'item',label:'Item'},{key:'category',label:'Category'},{key:'opening_quantity',label:'Opening quantity'},{key:'available',label:'Available'},{key:'reorder_level',label:'Reorder level'},{key:'unit_cost',label:'Unit cost (PKR)'},{key:'estimated_value',label:'Estimated value (PKR)'}])}>Export stock report</button>}<button type="button" onClick={()=>void load()}>Refresh <RefreshCw size={13}/></button></div></div>
    <label className="ed360-linked-search">Search inventory<input aria-label="Search inventory" value={inventorySearch} onChange={e=>{setInventorySearch(e.target.value);setInventoryPage(1)}} placeholder="SKU, item name, category or stock level…"/></label><div className="table-scroll"><table><thead><tr><th>SKU</th><th>Item</th><th>Category</th><th>Available</th><th>Reorder level</th><th>Unit cost</th><th>Movements</th></tr></thead><tbody>{pageRows(visibleStockRows,inventoryPage).map(item=><tr key={item.id}><td>{item.payload?.sku?String(item.payload.sku):item.reference_code??'—'}</td><td><b>{item.title}</b></td><td>{String(item.payload?.item_category??'—')}</td><td><strong>{item.available}</strong></td><td>{String(item.payload?.reorder_level??'—')}</td><td>{pkMoney(Number(item.payload?.unit_cost??0))}</td><td>{item.movements}</td></tr>)}</tbody></table></div>{pageControls(visibleStockRows.length,inventoryPage,setInventoryPage)}
   </section>
   <section className="table-card ed360-workspace-record-card"><div className="table-toolbar"><div className="table-count"><strong>{visibleMovements.length}</strong> matching stock movements</div></div><label className="ed360-linked-search">Search stock movements<input aria-label="Search stock movements" value={movementSearch} onChange={e=>{setMovementSearch(e.target.value);setMovementPage(1)}} placeholder="Item, date, movement type or reference…"/></label><div className="table-scroll"><table><thead><tr><th>Movement date</th><th>Item</th><th>Type</th><th>Quantity</th><th>Unit cost</th><th>Reference</th><th>Notes</th></tr></thead><tbody>{pageRows(visibleMovements,movementPage).map(m=><tr key={m.id}><td>{dateLabel(m.movement_date)}</td><td>{itemMap.get(m.item_record_id)?.title??'Item record'}</td><td>{statusText(m.movement_type)}</td><td>{m.quantity}</td><td>{m.unit_cost===null?'—':pkMoney(Number(m.unit_cost))}</td><td>{m.reference_code??'—'}</td><td>{m.notes??'—'}</td></tr>)}</tbody></table></div>{pageControls(visibleMovements.length,movementPage,setMovementPage)}</section>
   {showMovementForm&&<div className="modal-backdrop"><section className="modal-card ed360-context-form" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">INVENTORY / STOCK CONTROL</div><h2>Record stock movement</h2><p>Stock issue, allocation and write-off are rejected if available quantity would become negative.</p></div><button className="icon-button" onClick={()=>setShowMovementForm(false)}><X size={18}/></button></div><form className="ed360-context-form-grid" onSubmit={saveMovement}><label>Inventory item *<select required value={itemId} onChange={e=>setItemId(e.target.value)}><option value="">Select item</option>{stockRows.map(item=><option key={item.id} value={item.id}>{item.title} · available {item.available}</option>)}</select></label><label>Movement type<select value={movementType} onChange={e=>setMovementType(e.target.value)}><option value="stock_in">Stock in</option><option value="stock_out">Stock out</option><option value="allocation">Allocate stock</option><option value="return">Return to stock</option><option value="adjustment">Positive adjustment</option><option value="write_off">Write off / reduce stock</option></select></label><div className="ed360-form-row"><label>Quantity *<input type="number" min="0.001" step="0.001" required value={movementQty} onChange={e=>setMovementQty(e.target.value)}/></label><label>Unit cost (PKR)<input type="number" min="0" step="0.01" value={movementCost} onChange={e=>setMovementCost(e.target.value)}/></label></div><label>Movement date<input type="date" max={today()} value={movementDate} onChange={e=>setMovementDate(e.target.value)}/></label><label>Purchase / allocation reference<input value={movementRef} onChange={e=>setMovementRef(e.target.value)}/></label><label>Notes<textarea rows={2} value={movementNotes} onChange={e=>setMovementNotes(e.target.value)}/></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowMovementForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving||!items.length}>Save movement</button></div></form></section></div>}
  </>}

  {isTransport&&<>
   <section className="ed360-workspace-kpis"><article><span>Students allocated</span><strong>{allocations.filter(x=>x.status==='active').length}</strong><small>Active transport assignments</small></article><article><span>Routes</span><strong>{routes.length}</strong><small>Registered routes</small></article><article><span>Stops</span><strong>{stops.length}</strong><small>Registered route stops</small></article><article><span>{isTransportReport?'Recorded active fees':'Monthly fee total'}</span><strong>{pkMoney(transportFees)}</strong><small>{isTransportReport?'Fee values on active allocations':'Recorded active allocations'}</small></article></section>
   {isTransportReport&&<section className="table-card ed360-workspace-record-card"><div className="table-toolbar"><div className="table-count"><strong>{visibleRouteRows.length}</strong> matching routes · Active student allocations grouped by route</div></div><label className="ed360-linked-search">Search route utilisation<input aria-label="Search route utilisation" value={routeSearch} onChange={e=>{setRouteSearch(e.target.value);setRoutePage(1)}} placeholder="Route name or utilisation…"/></label><div className="table-scroll"><table><thead><tr><th>Route</th><th>Active students</th><th>Vehicles used</th><th>Recorded fees</th></tr></thead><tbody>{pageRows(visibleRouteRows,routePage).map(row=><tr key={row.route}><td>{row.route}</td><td>{row.students}</td><td>{row.vehicles}</td><td>{pkMoney(row.fees)}</td></tr>)}</tbody></table></div>{pageControls(visibleRouteRows.length,routePage,setRoutePage)}</section>}
   {isTransportAttendance&&<section className="table-card ed360-workspace-record-card"><div className="table-toolbar"><div className="table-count"><strong>{transportEvents.length}</strong> route attendance events</div><button type="button" onClick={()=>void load()}>Refresh <RefreshCw size={13}/></button></div><label className="ed360-linked-search">Search route attendance<input aria-label="Search route attendance" value={attendanceSearch} onChange={e=>setAttendanceSearch(e.target.value)} placeholder="Student, admission ID, route or event…"/></label>{transportEvents.filter(event=>{const allocation=allocations.find(x=>x.id===event.allocation_id);const student=students.find(x=>x.id===allocation?.student_id);const route=routes.find(x=>x.id===allocation?.route_record_id);return [student?.full_name,student?.admission_no,route?.title,event.event_type,event.notes].join(' ').toLowerCase().includes(attendanceSearch.toLowerCase())}).length?<div className="table-scroll"><table><thead><tr><th>Time</th><th>Student</th><th>Admission ID</th><th>Route</th><th>Event</th><th>Source</th><th>Notes</th></tr></thead><tbody>{transportEvents.filter(event=>{const allocation=allocations.find(x=>x.id===event.allocation_id);const student=students.find(x=>x.id===allocation?.student_id);const route=routes.find(x=>x.id===allocation?.route_record_id);return [student?.full_name,student?.admission_no,route?.title,event.event_type,event.notes].join(' ').toLowerCase().includes(attendanceSearch.toLowerCase())}).map(event=>{const allocation=allocations.find(x=>x.id===event.allocation_id);const student=students.find(x=>x.id===allocation?.student_id);const route=routes.find(x=>x.id===allocation?.route_record_id);return <tr key={event.id}><td>{new Date(event.occurred_at).toLocaleString()}</td><td><b>{student?.full_name??'Linked student'}</b></td><td>{student?.admission_no??'—'}</td><td>{route?.title??'Route'}</td><td><span className="ed360-state-pill">{statusText(event.event_type)}</span></td><td>{statusText(event.source)}</td><td>{event.notes??'—'}</td></tr>})}</tbody></table></div>:<div className="ed360-workspace-empty">No transport attendance events have been recorded for this institution.</div>}</section>}
   <section className="table-card ed360-workspace-record-card"><div className="table-toolbar"><div className="table-count"><strong>{visibleAllocations.length}</strong> matching student transport allocations</div><div className="ed360-row-actions">{isTransportReport&&<button type="button" onClick={()=>downloadCsv('edusphere-transport-allocations-'+today()+'.csv',allocations.map(row=>({student:allocationMap.get(row.student_id)?.full_name??'Linked student',admission_no:allocationMap.get(row.student_id)?.admission_no??'',route:routes.find(x=>x.id===row.route_record_id)?.title??'Route',stop:stops.find(x=>x.id===row.stop_record_id)?.title??'',vehicle:vehicles.find(x=>x.id===row.vehicle_record_id)?.title??'',effective_from:row.effective_from,effective_to:row.effective_to??'',transport_fee:Number(row.transport_fee??0),status:row.status})),[{key:'student',label:'Student'},{key:'admission_no',label:'Admission ID'},{key:'route',label:'Route'},{key:'stop',label:'Stop'},{key:'vehicle',label:'Vehicle'},{key:'effective_from',label:'From'},{key:'effective_to',label:'To'},{key:'transport_fee',label:'Fee (PKR)'},{key:'status',label:'Status'}])}>Export CSV</button>}<button onClick={()=>void load()}>Refresh <RefreshCw size={13}/></button></div></div>
    <label className="ed360-linked-search">Search transport allocations<input aria-label="Search transport allocations" value={allocationSearch} onChange={e=>{setAllocationSearch(e.target.value);setAllocationPage(1)}} placeholder="Student, admission ID, route, vehicle or status…"/></label>
    {visibleAllocations.length===0?<div className="ed360-workspace-empty"><strong>No transport allocations</strong><span>Register routes, route stops and vehicles before allocating students.</span></div>:<div className="table-scroll"><table><thead><tr><th>Student</th><th>Admission ID</th><th>Route</th><th>Stop</th><th>Vehicle</th><th>Effective from</th><th>Fee</th><th>Status</th><th>Action</th></tr></thead><tbody>{pageRows(visibleAllocations,allocationPage).map(row=>{const student=allocationMap.get(row.student_id);return <tr key={row.id}><td><b>{student?.full_name??'Linked student'}</b></td><td>{student?.admission_no??'—'}</td><td>{routes.find(x=>x.id===row.route_record_id)?.title??'Route'}</td><td>{stops.find(x=>x.id===row.stop_record_id)?.title??'—'}</td><td>{vehicles.find(x=>x.id===row.vehicle_record_id)?.title??'—'}</td><td>{dateLabel(row.effective_from)}</td><td>{pkMoney(Number(row.transport_fee??0))}</td><td><span className={'ed360-state-pill '+(row.status==='active'?'state-approved':'')}>{statusText(row.status)}</span></td><td>{canAdmin&&row.status==='active'&&<button className="button button-outline" onClick={()=>void cancelAllocation(row)}>End allocation</button>}</td></tr>})}</tbody></table></div>}{pageControls(visibleAllocations.length,allocationPage,setAllocationPage)}
   </section>

   {showTransportEventForm&&<div className="modal-backdrop"><section className="modal-card ed360-context-form" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">TRANSPORT / ATTENDANCE</div><h2>Record route attendance</h2><p>Events are tied to an active student transport allocation. GPS/RFID imports are not enabled.</p></div><button className="icon-button" type="button" onClick={()=>setShowTransportEventForm(false)}><X size={18}/></button></div><form className="ed360-context-form-grid" onSubmit={saveTransportAttendance}><label>Active allocation *<select required value={attendanceAllocation} onChange={e=>setAttendanceAllocation(e.target.value)}><option value="">Select student / route</option>{allocations.filter(row=>row.status==='active').map(row=><option key={row.id} value={row.id}>{allocationMap.get(row.student_id)?.full_name??'Student'} · {routes.find(x=>x.id===row.route_record_id)?.title??'Route'}</option>)}</select></label><label>Event *<select value={attendanceType} onChange={e=>setAttendanceType(e.target.value as 'boarded'|'alighted'|'absent')}><option value="boarded">Boarded</option><option value="alighted">Alighted</option><option value="absent">Absent from route</option></select></label><label>Notes<textarea rows={2} value={attendanceNotes} onChange={e=>setAttendanceNotes(e.target.value)}/></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowTransportEventForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving||!allocations.some(row=>row.status==='active')}>Save route event</button></div></form></section></div>}

   {showAllocationForm&&<div className="modal-backdrop"><section className="modal-card ed360-context-form" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">TRANSPORT / STUDENT ALLOCATION</div><h2>Allocate a student</h2><p>Allocation links an existing student, route, stop and vehicle.</p></div><button className="icon-button" onClick={()=>setShowAllocationForm(false)}><X size={18}/></button></div><form className="ed360-context-form-grid" onSubmit={createAllocation}><label>Student *<select required value={allocationStudent} onChange={e=>setAllocationStudent(e.target.value)}><option value="">Select student</option>{students.map(student=><option key={student.id} value={student.id}>{student.full_name}{student.admission_no?' · '+student.admission_no:''}</option>)}</select></label><label>Transport route *<select required value={allocationRoute} onChange={e=>{setAllocationRoute(e.target.value);setAllocationStop('')}}><option value="">Select route</option>{routes.map(route=><option key={route.id} value={route.id}>{route.title}</option>)}</select></label><label>Route stop<select value={allocationStop} onChange={e=>setAllocationStop(e.target.value)}><option value="">Not assigned</option>{routeStops.map(stop=><option key={stop.id} value={stop.id}>{stop.title}</option>)}</select></label><label>Vehicle<select value={allocationVehicle} onChange={e=>setAllocationVehicle(e.target.value)}><option value="">Not assigned</option>{vehicles.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.title}</option>)}</select></label><div className="ed360-form-row"><label>Start date *<input type="date" required value={allocationFrom} onChange={e=>setAllocationFrom(e.target.value)}/></label><label>End date<input type="date" min={allocationFrom} value={allocationTo} onChange={e=>setAllocationTo(e.target.value)}/></label></div><label>Transport fee (PKR)<input type="number" min="0" step="0.01" value={transportFee} onChange={e=>setTransportFee(e.target.value)}/></label><label>Allocation notes<textarea rows={2} value={allocationNotes} onChange={e=>setAllocationNotes(e.target.value)}/></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowAllocationForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving||!students.length||!routes.length}>Save allocation</button></div></form></section></div>}
  </>}
 </main>
}
