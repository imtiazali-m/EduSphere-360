import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { BookOpen, Bus, MapPin, Package, Plus, RefreshCw, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/userErrors'
import { downloadCsv } from '../lib/csv'
import { getWorkspaceGroup } from '../lib/institutionalCatalog'

type Props={workspaceKey:string;onToast:(message:string,error?:boolean)=>void;onNavigate:(key:string)=>void}
type Campus={id:string;name:string;campus_code?:string|null;address?:string|null;phone?:string|null;email?:string|null;branch_head_name?:string|null;academic_settings?:Record<string,unknown>;operational_settings?:Record<string,unknown>;is_headquarters:boolean;is_active:boolean}
type Book={id:string;title:string;reference_code?:string|null;quantity?:number|null;payload?:Record<string,unknown>}
type Student={id:string;full_name:string;admission_no?:string|null;class_name?:string|null}
type Item={id:string;title:string;reference_code?:string|null;quantity?:number|null;payload?:Record<string,unknown>}
type RouteRecord={id:string;title:string;reference_code?:string|null;parent_record_id?:string|null;payload?:Record<string,unknown>}
type Loan={id:string;book_record_id:string;student_id:string|null;issued_at:string;due_at:string;returned_at:string|null;status:string;fine_amount:number;notes?:string|null}
type ReadingRecord={id:string;student_id:string;book_title:string;reading_date:string;pages_read:number;reading_minutes:number;progress_percent:number|null;rating:number|null;status:string;notes?:string|null;recorded_by:string}
type Movement={id:string;item_record_id:string;movement_type:string;quantity:number;unit_cost?:number|null;movement_date:string;reference_code?:string|null;notes?:string|null}
type Allocation={id:string;student_id:string;route_record_id:string;stop_record_id?:string|null;vehicle_record_id?:string|null;effective_from:string;effective_to?:string|null;transport_fee:number;status:string;notes?:string|null}

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
 administration:{accent:'#55735d',soft:'#edf1e8',ink:'#284a37'},
 library:{accent:'#55735d',soft:'#e8eee6',ink:'#284a37'},
 inventory:{accent:'#af793b',soft:'#f6efdf',ink:'#795515'},
 transport:{accent:'#a65b3b',soft:'#f5eae3',ink:'#763c29'}
}

export function LinkedOperationsWorkspace({workspaceKey,onToast,onNavigate}:Props){
 const {user}=useAuth()
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
 const [readingRecords,setReadingRecords]=useState<ReadingRecord[]>([])
 const [readingSearch,setReadingSearch]=useState('')
 const [readingPage,setReadingPage]=useState(1)
 const [readingStudentId,setReadingStudentId]=useState('')
 const [readingBookTitle,setReadingBookTitle]=useState('')
 const [readingDate,setReadingDate]=useState(today())
 const [readingPages,setReadingPages]=useState('0')
 const [readingMinutes,setReadingMinutes]=useState('0')
 const [readingProgress,setReadingProgress]=useState('')
 const [readingRating,setReadingRating]=useState('')
 const [readingStatus,setReadingStatus]=useState('in_progress')
 const [readingNotes,setReadingNotes]=useState('')
 const [showReadingForm,setShowReadingForm]=useState(false)
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

 const isCampus=groupKey==='administration'&&itemKey==='campus-and-branch-management'
 const isLibrary=groupKey==='library'&&['book-issue-and-returns','library-reports'].includes(itemKey)
 const isReading=groupKey==='library'&&itemKey==='reading-records'
 const isLibraryReport=groupKey==='library'&&itemKey==='library-reports'
 const isInventory=groupKey==='inventory'&&['stock-in','stock-out','stock-allocation','stock-adjustments','inventory-history','stock-reports'].includes(itemKey)
 const isTransport=groupKey==='transport'&&['student-transport-allocation','transport-reports'].includes(itemKey)
 const isTransportReport=groupKey==='transport'&&itemKey==='transport-reports'
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
    const [bookResult,studentResult,loanRows]=await Promise.all([
     supabase.from('institutional_records').select('id,title,reference_code,quantity,payload').eq('institution_id',user.institutionId).eq('module_key','library').eq('record_type','book-registration').order('title'),
     supabase.from('students').select('id,full_name,admission_no,class_name').eq('institution_id',user.institutionId).eq('status','active').order('full_name'),
     loadAllPages<Loan>((from,to)=>db.from('library_loans').select('*').eq('institution_id',user.institutionId).order('issued_at',{ascending:false}).range(from,to))
    ])
    if(bookResult.error)throw bookResult.error
    if(studentResult.error)throw studentResult.error
    setBooks((bookResult.data??[]) as Book[]);setStudents((studentResult.data??[]) as Student[]);setLoans(loanRows)
   }else if(isReading){
    const readingRows=await loadAllPages<ReadingRecord>((from,to)=>db.from('library_reading_records').select('*').eq('institution_id',user.institutionId).order('reading_date',{ascending:false}).range(from,to))
    setReadingRecords(readingRows)
    if(canLibrary){
     const studentResult=await db.from('students').select('id,full_name,admission_no,class_name').eq('institution_id',user.institutionId).eq('status','active').order('full_name')
     if(studentResult.error)throw studentResult.error
     setStudents((studentResult.data??[]) as Student[])
    }else if(readingRows.length){
     const visibleStudentIds=[...new Set(readingRows.map(row=>row.student_id))]
     const studentResult=await db.from('students').select('id,full_name,admission_no,class_name').eq('institution_id',user.institutionId).in('id',visibleStudentIds)
     if(!studentResult.error)setStudents((studentResult.data??[]) as Student[])
    }
   }else if(isInventory){
    const [itemResult,movementRows]=await Promise.all([
     supabase.from('institutional_records').select('id,title,reference_code,quantity,payload').eq('institution_id',user.institutionId).eq('module_key','inventory').in('record_type',['items-management','item-catalogue']).order('title'),
     loadAllPages<Movement>((from,to)=>db.from('inventory_movements').select('*').eq('institution_id',user.institutionId).order('movement_date',{ascending:false}).range(from,to))
    ])
    if(itemResult.error)throw itemResult.error
    setItems((itemResult.data??[]) as Item[]);setMovements(movementRows)
   }else if(isTransport){
    const [studentResult,routeResult,stopResult,vehicleResult,allocationRows]=await Promise.all([
     supabase.from('students').select('id,full_name,admission_no,class_name').eq('institution_id',user.institutionId).eq('status','active').order('full_name'),
     supabase.from('institutional_records').select('id,title,reference_code,payload').eq('institution_id',user.institutionId).eq('module_key','transport').eq('record_type','transport-routes').order('title'),
     supabase.from('institutional_records').select('id,title,reference_code,parent_record_id,payload').eq('institution_id',user.institutionId).eq('module_key','transport').eq('record_type','route-stops').order('title'),
     supabase.from('institutional_records').select('id,title,reference_code,payload').eq('institution_id',user.institutionId).eq('module_key','transport').eq('record_type','vehicle-management').order('title'),
     loadAllPages<Allocation>((from,to)=>db.from('student_transport_allocations').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false}).range(from,to))
    ])
    for(const result of [studentResult,routeResult,stopResult,vehicleResult])if(result.error)throw result.error
    setStudents((studentResult.data??[]) as Student[]);setRoutes((routeResult.data??[]) as RouteRecord[])
    setStops((stopResult.data??[]) as RouteRecord[]);setVehicles((vehicleResult.data??[]) as RouteRecord[])
    setAllocations(allocationRows)
   }
  }catch(error){setLoadError(error instanceof Error?error.message:'The operation records could not be loaded.');}
  finally{setLoading(false)}
 },[user?.id,user?.institutionId,isCampus,isLibrary,isReading,isInventory,isTransport,canLibrary])

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
 const visibleReadingRecords=useMemo(()=>readingRecords.filter(row=>{
  const student=students.find(item=>item.id===row.student_id)
  return matches([row.book_title,row.reading_date,row.pages_read,row.reading_minutes,row.progress_percent,row.rating,row.status,row.notes,student?.full_name,student?.admission_no,student?.class_name],readingSearch)
 }),[readingRecords,students,readingSearch])
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
 async function saveReadingRecord(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user||!canLibrary)return
  const student=students.find(row=>row.id===readingStudentId)
  const pages=Number(readingPages),minutes=Number(readingMinutes)
  const progress=readingProgress.trim()===''?null:Number(readingProgress)
  const rating=readingRating.trim()===''?null:Number(readingRating)
  if(!student||!readingBookTitle.trim()||readingBookTitle.trim().length>240||!readingDate||!Number.isInteger(pages)||pages<0||!Number.isInteger(minutes)||minutes<0||progress!==null&&(!Number.isFinite(progress)||progress<0||progress>100)||rating!==null&&(!Number.isInteger(rating)||rating<1||rating>5)||!['in_progress','completed','paused'].includes(readingStatus)){
   onToast('Choose a student, enter a book title, and check the reading date, pages, time, progress and rating.',true);return
  }
  setSaving(true)
  const {error}=await supabase.from('library_reading_records').insert({
   institution_id:user.institutionId,student_id:student.id,book_title:readingBookTitle.trim(),
   reading_date:readingDate,pages_read:pages,reading_minutes:minutes,
   progress_percent:progress,rating,status:readingStatus,notes:readingNotes.trim()||null,recorded_by:user.id
  })
  if(error){onToast(userFacingError(error,'The reading record could not be saved. Check the student relationship and your library permissions.'),true);setSaving(false);return}
  setShowReadingForm(false);setReadingStudentId('');setReadingBookTitle('');setReadingDate(today())
  setReadingPages('0');setReadingMinutes('0');setReadingProgress('');setReadingRating('')
  setReadingStatus('in_progress');setReadingNotes('')
  onToast('Student reading record saved.');setSaving(false);await load()
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
 async function cancelAllocation(row:Allocation){
  if(!supabase||!user||!canAdmin)return
  const {error}=await supabase.rpc('end_student_transport_allocation',{p_institution_id:user.institutionId,p_allocation_id:row.id})
  if(error){onToast(userFacingError(error,'The transport allocation could not be ended.'),true);return}
  onToast('Transport allocation ended.');await load()
 }

 if(!user||!group)return null
 const specialTitle=isCampus?'Campus and Branch Management':isReading?'Student Reading Records':isLibrary?(isLibraryReport?'Library Circulation Reports':'Book Issue and Returns'):isInventory?(itemKey==='stock-reports'?'Inventory Stock Reports':itemKey==='inventory-history'?'Inventory Movement History':itemKey==='stock-in'?'Stock In':itemKey==='stock-out'?'Stock Out':itemKey==='stock-allocation'?'Stock Allocation':itemKey==='stock-adjustments'?'Stock Adjustments':'Inventory Stock Movements'):isTransport?(isTransportReport?'Transport Allocation Reports':'Student Transport Allocation'):'Institution Operations'
 const nav=<nav className="ed360-operations-window-nav ed360-workspace-tabs" aria-label={group.label+' submenus'}>{group.items.map(menu=><button key={menu.key} className={menu.key===itemKey?'active':''} type="button" onClick={()=>onNavigate('institutional:'+group.key+':'+menu.key)}>{menu.label}</button>)}</nav>
 const header=<header className="ed360-workspace-hero" style={{'--workspace-accent':theme.accent,'--workspace-soft':theme.soft,'--workspace-ink':theme.ink} as CSSProperties}><div className="ed360-workspace-hero-icon">{isCampus?<MapPin size={21}/>:isLibrary||isReading?<BookOpen size={21}/>:isInventory?<Package size={21}/>:<Bus size={21}/>}</div><div className="ed360-workspace-hero-copy"><span>{group.label.toUpperCase()} / LIVE RELATIONAL WORKFLOW</span><h1>{specialTitle}</h1><p>{isCampus?'Manage college campuses and branches with linked institutional records.':isReading?'Track reading activity, pages completed, time spent and progress for students visible to your account.':isLibrary?(isLibraryReport?'Review actual issue, return, overdue and fine activity from the library loan ledger.':'Issue and return books against student records, with due dates and traceable circulation history.'):isInventory?'Record stock movement through an atomic transaction that prevents inventory going below zero.':isTransport?(isTransportReport?'Review active allocations, registered routes, vehicle usage and recorded transport fees.':'Allocate students to registered routes, stops and vehicles with effective dates and transport fees.'):'Institution operations'}</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Live Supabase records</span>{isCampus&&canAdmin&&<button className="button button-primary" onClick={()=>resetCampus()}><Plus size={16}/> Add campus</button>}{isReading&&canLibrary&&<button className="button button-primary" onClick={()=>setShowReadingForm(true)}><Plus size={16}/> Record reading</button>}{isLibrary&&!isLibraryReport&&canLibrary&&<button className="button button-primary" onClick={()=>setShowLoanForm(true)}><Plus size={16}/> Issue book</button>}{isInventory&&!['stock-reports','inventory-history'].includes(itemKey)&&canAdmin&&<button className="button button-primary" onClick={()=>setShowMovementForm(true)}><Plus size={16}/> Record movement</button>}{isTransport&&!isTransportReport&&canAdmin&&<button className="button button-primary" onClick={()=>setShowAllocationForm(true)}><Plus size={16}/> Allocate student</button>}</div></header>

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

  {isReading&&<>
   <section className="ed360-workspace-kpis">
    <article><span>Reading records</span><strong>{visibleReadingRecords.length}</strong><small>Records visible to your account</small></article>
    <article><span>Pages recorded</span><strong>{visibleReadingRecords.reduce((sum,row)=>sum+Number(row.pages_read||0),0).toLocaleString()}</strong><small>Across visible reading logs</small></article>
    <article><span>Reading time</span><strong>{Math.round(visibleReadingRecords.reduce((sum,row)=>sum+Number(row.reading_minutes||0),0)/60*10)/10} h</strong><small>Recorded reading minutes</small></article>
    <article><span>Completed logs</span><strong>{visibleReadingRecords.filter(row=>row.status==='completed').length}</strong><small>Marked as completed</small></article>
   </section>
   <section className="table-card ed360-workspace-record-card">
    <div className="table-toolbar">
     <div className="table-count"><strong>{visibleReadingRecords.length}</strong> visible reading records</div>
     <div className="ed360-row-actions">
      <button type="button" onClick={()=>downloadCsv('college-reading-records-'+today()+'.csv',visibleReadingRecords.map(row=>({student:students.find(person=>person.id===row.student_id)?.full_name??'Linked student',admission_no:students.find(person=>person.id===row.student_id)?.admission_no??'',book_title:row.book_title,reading_date:row.reading_date,pages_read:row.pages_read,reading_minutes:row.reading_minutes,progress_percent:row.progress_percent??'',rating:row.rating??'',status:row.status,notes:row.notes??''})),[{key:'student',label:'Student'},{key:'admission_no',label:'Admission ID'},{key:'book_title',label:'Book title'},{key:'reading_date',label:'Reading date'},{key:'pages_read',label:'Pages'},{key:'reading_minutes',label:'Minutes'},{key:'progress_percent',label:'Progress %'},{key:'rating',label:'Rating'},{key:'status',label:'Status'},{key:'notes',label:'Notes'}])}>Export CSV</button>
      <button type="button" onClick={()=>void load()}>Refresh <RefreshCw size={13}/></button>
     </div>
    </div>
    <label className="ed360-linked-search">Search reading records<input aria-label="Search reading records" value={readingSearch} onChange={e=>{setReadingSearch(e.target.value);setReadingPage(1)}} placeholder="Student, admission ID, book title, date or status…"/></label>
    {visibleReadingRecords.length===0
     ?<div className="ed360-workspace-empty"><strong>No reading records are available</strong><span>{canLibrary?'Record a student’s reading activity to start the college reading log.':'Reading records will appear here when they have been recorded for a student linked to your account.'}</span>{canLibrary&&<button className="button button-primary" type="button" onClick={()=>setShowReadingForm(true)}>Record first reading</button>}</div>
     :<div className="table-scroll"><table><thead><tr><th>Student</th><th>Book / reading material</th><th>Date</th><th>Pages</th><th>Time</th><th>Progress</th><th>Rating</th><th>Status</th><th>Notes</th></tr></thead><tbody>{pageRows(visibleReadingRecords,readingPage).map(row=>{
      const student=students.find(person=>person.id===row.student_id)
      return <tr key={row.id}><td><b>{student?.full_name??'My linked student'}</b><small className="ed360-record-subtitle">{student?.admission_no??''}</small></td><td>{row.book_title}</td><td>{dateLabel(row.reading_date)}</td><td>{Number(row.pages_read).toLocaleString()}</td><td>{Number(row.reading_minutes)} min</td><td>{row.progress_percent===null||row.progress_percent===undefined?'—':Number(row.progress_percent).toLocaleString()+'%'}</td><td>{row.rating===null||row.rating===undefined?'—':row.rating+'/5'}</td><td><span className={'ed360-state-pill '+(row.status==='completed'?'state-approved':row.status==='paused'?'state-pending':'')}>{statusText(row.status)}</span></td><td>{row.notes||'—'}</td></tr>
     })}</tbody></table></div>}
    {pageControls(visibleReadingRecords.length,readingPage,setReadingPage)}
   </section>
   {showReadingForm&&canLibrary&&<div className="modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setShowReadingForm(false)}}>
    <section className="modal-card ed360-context-form" role="dialog" aria-modal="true" aria-labelledby="reading-record-title">
     <div className="modal-heading"><div><div className="eyebrow">COLLEGE LIBRARY / STUDENT READING</div><h2 id="reading-record-title">Record reading activity</h2><p>Log reading against a student record. Access is checked again by the database.</p></div><button type="button" className="icon-button" aria-label="Close reading form" onClick={()=>setShowReadingForm(false)}><X size={18}/></button></div>
     <form className="ed360-context-form-grid" onSubmit={saveReadingRecord}>
      <label>Student *<select required value={readingStudentId} onChange={event=>setReadingStudentId(event.target.value)}><option value="">Select student</option>{students.map(student=><option key={student.id} value={student.id}>{student.full_name}{student.admission_no?' · '+student.admission_no:''}</option>)}</select></label>
      <label>Book / reading material *<input required maxLength={240} value={readingBookTitle} onChange={event=>setReadingBookTitle(event.target.value)} placeholder="Enter book or material title"/></label>
      <div className="ed360-form-row"><label>Reading date *<input required type="date" value={readingDate} max={today()} onChange={event=>setReadingDate(event.target.value)}/></label><label>Pages read<input type="number" min="0" step="1" value={readingPages} onChange={event=>setReadingPages(event.target.value)}/></label></div>
      <div className="ed360-form-row"><label>Reading time (minutes)<input type="number" min="0" step="1" value={readingMinutes} onChange={event=>setReadingMinutes(event.target.value)}/></label><label>Progress (%)<input type="number" min="0" max="100" step="0.1" value={readingProgress} onChange={event=>setReadingProgress(event.target.value)} placeholder="Optional"/></label></div>
      <div className="ed360-form-row"><label>Rating<select value={readingRating} onChange={event=>setReadingRating(event.target.value)}><option value="">Not rated</option>{[1,2,3,4,5].map(value=><option value={value} key={value}>{value} / 5</option>)}</select></label><label>Progress status<select value={readingStatus} onChange={event=>setReadingStatus(event.target.value)}><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="paused">Paused</option></select></label></div>
      <label>Reading notes<textarea rows={3} maxLength={2000} value={readingNotes} onChange={event=>setReadingNotes(event.target.value)} placeholder="Optional notes or teacher feedback"/></label>
      <div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowReadingForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving||!students.length}>{saving?'Saving…':'Save reading record'}</button></div>
     </form>
    </section>
   </div>}
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
   <section className="table-card ed360-workspace-record-card"><div className="table-toolbar"><div className="table-count"><strong>{visibleAllocations.length}</strong> matching student transport allocations</div><div className="ed360-row-actions">{isTransportReport&&<button type="button" onClick={()=>downloadCsv('edusphere-transport-allocations-'+today()+'.csv',allocations.map(row=>({student:allocationMap.get(row.student_id)?.full_name??'Linked student',admission_no:allocationMap.get(row.student_id)?.admission_no??'',route:routes.find(x=>x.id===row.route_record_id)?.title??'Route',stop:stops.find(x=>x.id===row.stop_record_id)?.title??'',vehicle:vehicles.find(x=>x.id===row.vehicle_record_id)?.title??'',effective_from:row.effective_from,effective_to:row.effective_to??'',transport_fee:Number(row.transport_fee??0),status:row.status})),[{key:'student',label:'Student'},{key:'admission_no',label:'Admission ID'},{key:'route',label:'Route'},{key:'stop',label:'Stop'},{key:'vehicle',label:'Vehicle'},{key:'effective_from',label:'From'},{key:'effective_to',label:'To'},{key:'transport_fee',label:'Fee (PKR)'},{key:'status',label:'Status'}])}>Export CSV</button>}<button onClick={()=>void load()}>Refresh <RefreshCw size={13}/></button></div></div>
    <label className="ed360-linked-search">Search transport allocations<input aria-label="Search transport allocations" value={allocationSearch} onChange={e=>{setAllocationSearch(e.target.value);setAllocationPage(1)}} placeholder="Student, admission ID, route, vehicle or status…"/></label>
    {visibleAllocations.length===0?<div className="ed360-workspace-empty"><strong>No transport allocations</strong><span>Register routes, route stops and vehicles before allocating students.</span></div>:<div className="table-scroll"><table><thead><tr><th>Student</th><th>Admission ID</th><th>Route</th><th>Stop</th><th>Vehicle</th><th>Effective from</th><th>Fee</th><th>Status</th><th>Action</th></tr></thead><tbody>{pageRows(visibleAllocations,allocationPage).map(row=>{const student=allocationMap.get(row.student_id);return <tr key={row.id}><td><b>{student?.full_name??'Linked student'}</b></td><td>{student?.admission_no??'—'}</td><td>{routes.find(x=>x.id===row.route_record_id)?.title??'Route'}</td><td>{stops.find(x=>x.id===row.stop_record_id)?.title??'—'}</td><td>{vehicles.find(x=>x.id===row.vehicle_record_id)?.title??'—'}</td><td>{dateLabel(row.effective_from)}</td><td>{pkMoney(Number(row.transport_fee??0))}</td><td><span className={'ed360-state-pill '+(row.status==='active'?'state-approved':'')}>{statusText(row.status)}</span></td><td>{canAdmin&&row.status==='active'&&<button className="button button-outline" onClick={()=>void cancelAllocation(row)}>End allocation</button>}</td></tr>})}</tbody></table></div>}{pageControls(visibleAllocations.length,allocationPage,setAllocationPage)}
   </section>
   {showAllocationForm&&<div className="modal-backdrop"><section className="modal-card ed360-context-form" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">TRANSPORT / STUDENT ALLOCATION</div><h2>Allocate a student</h2><p>Allocation links an existing student, route, stop and vehicle.</p></div><button className="icon-button" onClick={()=>setShowAllocationForm(false)}><X size={18}/></button></div><form className="ed360-context-form-grid" onSubmit={createAllocation}><label>Student *<select required value={allocationStudent} onChange={e=>setAllocationStudent(e.target.value)}><option value="">Select student</option>{students.map(student=><option key={student.id} value={student.id}>{student.full_name}{student.admission_no?' · '+student.admission_no:''}</option>)}</select></label><label>Transport route *<select required value={allocationRoute} onChange={e=>{setAllocationRoute(e.target.value);setAllocationStop('')}}><option value="">Select route</option>{routes.map(route=><option key={route.id} value={route.id}>{route.title}</option>)}</select></label><label>Route stop<select value={allocationStop} onChange={e=>setAllocationStop(e.target.value)}><option value="">Not assigned</option>{routeStops.map(stop=><option key={stop.id} value={stop.id}>{stop.title}</option>)}</select></label><label>Vehicle<select value={allocationVehicle} onChange={e=>setAllocationVehicle(e.target.value)}><option value="">Not assigned</option>{vehicles.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.title}</option>)}</select></label><div className="ed360-form-row"><label>Start date *<input type="date" required value={allocationFrom} onChange={e=>setAllocationFrom(e.target.value)}/></label><label>End date<input type="date" min={allocationFrom} value={allocationTo} onChange={e=>setAllocationTo(e.target.value)}/></label></div><label>Transport fee (PKR)<input type="number" min="0" step="0.01" value={transportFee} onChange={e=>setTransportFee(e.target.value)}/></label><label>Allocation notes<textarea rows={2} value={allocationNotes} onChange={e=>setAllocationNotes(e.target.value)}/></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowAllocationForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving||!students.length||!routes.length}>Save allocation</button></div></form></section></div>}
  </>}
 </main>
}
