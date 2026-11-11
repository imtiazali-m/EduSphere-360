import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Activity, ArrowUpRight, CheckCircle2, Download, FileSpreadsheet, FileText, Filter, Plus, Printer, Search, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getWorkspaceGroup, getWorkspaceItem, institutionalMenu } from '../lib/institutionalCatalog'
import { exportDocx, exportXlsx, printOfficeReport, type OfficeColumn } from '../lib/officeExport'
import { downloadCsv } from '../lib/csv'
import type { RecordRow } from '../lib/types'

type OperationalRow = RecordRow & {
 module_key:string;record_type:string;title:string;reference_code?:string|null;description?:string|null;
 status:string;approval_status:string;record_date?:string|null;due_date?:string|null;amount?:number|null;
 quantity?:number|null;payload:Record<string,unknown>;visibility:string
}
type Props={workspaceKey:string;onToast:(message:string,error?:boolean)=>void}
type WorkspaceField={key:string;label:string;type?:'text'|'email'|'date'|'number'|'time'|'datetime-local'|'url'|'textarea'|'select';options?:string[];placeholder?:string}
const fld=(key:string,label:string,type:WorkspaceField['type']='text',options?:string[]):WorkspaceField=>({key,label,type,options})
const workspaceFields:Record<string,WorkspaceField[]>={
 ai:[fld('insight_type','Insight type','select',['Student analysis','Academic performance','Fee collection','Examination','Timetable','Attendance','Behaviour','Institutional']),fld('source_dataset','Source data / report','text'),fld('confidence_percent','Confidence (%)','number'),fld('assumptions','Assumptions and limitations','textarea'),fld('human_review','Human review','select',['Required','Reviewed','Not reviewed'])],
 administration:[fld('entity_code','Institution / department code'),fld('contact_name','Responsible contact'),fld('email','Contact email','email'),fld('phone','Telephone'),fld('address','Address','textarea'),fld('effective_date','Effective date','date')],
 academic_setup:[fld('academic_level','Education / grade level'),fld('academic_year','Academic year'),fld('start_date','Start date','date'),fld('end_date','End date','date'),fld('class_teacher','Class teacher'),fld('capacity','Capacity','number')],
 students:[fld('student_reference','Student / admission reference'),fld('class_name','Class / section'),fld('guardian_name','Parent / guardian'),fld('document_type','Document / card type'),fld('issue_date','Issue date','date'),fld('alumni_year','Alumni / completion year','number')],
 employees:[fld('employee_number','Employee number'),fld('employee_category','Employee category','select',['Teaching','Non-teaching','Administration','Support']),fld('department','Department'),fld('designation','Designation'),fld('employment_type','Employment type','select',['Full-time','Part-time','Contract','Temporary']),fld('joining_date','Joining date','date')],
 finance:[fld('account_code','Account code'),fld('account_category','Account category','select',['Asset','Liability','Equity','Income','Expense']),fld('transaction_type','Transaction type','select',['Income','Expense','Transfer','Journal']),fld('debit','Debit (PKR)','number'),fld('credit','Credit (PKR)','number'),fld('bank_reference','Bank / voucher reference')],
 fees:[fld('fee_category','Fee category','select',['Tuition','Admission','Examination','Transport','Library','Other']),fld('fee_frequency','Billing frequency','select',['One-time','Monthly','Quarterly','Term','Annual']),fld('class_name','Class / section'),fld('academic_session','Academic session'),fld('discount_percent','Discount (%)','number'),fld('scholarship_reference','Scholarship reference')],
 receivables:[fld('invoice_reference','Invoice reference'),fld('student_reference','Student / admission reference'),fld('ageing_bucket','Ageing band','select',['Current','1–30 days','31–60 days','61–90 days','90+ days']),fld('follow_up_date','Next follow-up date','date'),fld('follow_up_outcome','Follow-up outcome','textarea'),fld('promised_amount','Promised amount (PKR)','number')],
 payments:[fld('payment_method','Payment method','select',['Cash','Bank transfer','Card','Cheque','Online','Other']),fld('transaction_reference','Transaction reference'),fld('bank_name','Bank name'),fld('cheque_number','Cheque number'),fld('verification_status','Verification status','select',['Pending','Verified','Rejected']),fld('payment_date','Payment date','date')],
 receipts:[fld('receipt_number','Receipt number'),fld('receipt_template','Receipt design / template'),fld('payment_reference','Payment / invoice reference'),fld('issued_to','Issued to'),fld('issue_date','Issue date','date'),fld('signatory_name','Authorized signatory')],
 payroll:[fld('employee_reference','Employee / staff reference'),fld('salary_component','Salary component','select',['Basic salary','Allowance','Deduction','Advance recovery','Bonus']),fld('base_salary','Base salary (PKR)','number'),fld('allowance','Allowance (PKR)','number'),fld('deduction','Deduction (PKR)','number'),fld('pay_period','Payroll period')],
 attendance:[fld('register_period','Period / session'),fld('marking_source','Marking source','select',['Manual register','CSV import','QR','RFID','Biometric','Provider']),fld('marking_status','Register status','select',['Draft','Saved','Published','Locked']),fld('device_reference','Device / source reference')],
 timetable:[fld('weekday','Weekday','select',['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']),fld('period_label','Period / slot'),fld('start_time','Start time','time'),fld('end_time','End time','time'),fld('teacher_name','Teacher'),fld('room_name','Room / facility'),fld('subject_name','Subject')],
 teaching:[fld('subject_name','Subject'),fld('class_name','Class / section'),fld('chapter','Chapter / unit'),fld('submission_date','Submission / due date','date'),fld('maximum_marks','Maximum marks','number'),fld('attachment_url','Learning attachment URL','url')],
 behaviour:[fld('behaviour_type','Behaviour type','select',['Positive','Recognition','Warning','Incident','Safeguarding referral','Skill']),fld('severity','Severity','select',['Low','Medium','High','Urgent']),fld('observed_date','Observed date','date'),fld('recorded_by_name','Recorded by'),fld('action_taken','Action / follow-up','textarea')],
 communication:[fld('channel','Communication channel','select',['In-app','Email','WhatsApp','SMS','Notice']),fld('audience','Audience','select',['Everyone','Students','Parents','Teachers','Class / section','Individual']),fld('message_template','Message template'),fld('delivery_status','Delivery status','select',['Draft','Queued','Sent','Delivered','Failed','Not configured']),fld('scheduled_at','Schedule date/time','datetime-local'),fld('provider_reference','Provider reference')],
 question_bank:[fld('question_type','Question type','select',['Multiple choice','Short answer','Long answer','True / false','Matching','Practical']),fld('subject_name','Subject'),fld('chapter','Chapter / topic'),fld('difficulty','Difficulty','select',['Easy','Medium','Hard']),fld('marks','Marks','number'),fld('correct_answer','Answer / key','textarea')],
 examinations:[fld('exam_type','Examination type','select',['Midterm','Final','Quiz','Practical','Entrance','Other']),fld('class_name','Class / section'),fld('subject_name','Subject'),fld('exam_date','Examination date','date'),fld('total_marks','Total marks','number'),fld('room_name','Room / venue'),fld('invigilator','Invigilator')],
 tests:[fld('test_format','Test format','select',['Online','Written','Practical','Oral']),fld('subject_name','Subject'),fld('class_name','Class / section'),fld('test_date','Test date','date'),fld('duration_minutes','Duration (minutes)','number'),fld('total_marks','Total marks','number')],
 reports:[fld('report_type','Report type','select',['Student','Employee','Attendance','Academic','Examination','Fee','Payroll','Financial','Custom']),fld('date_from','From date','date'),fld('date_to','To date','date'),fld('schedule_frequency','Schedule','select',['One-time','Daily','Weekly','Monthly','Term']),fld('recipient','Recipient / email','email')],
 certificates:[fld('certificate_type','Certificate type','select',['Character','Leaving','Enrollment','Bonafide','Achievement','Experience','ID card','Other']),fld('certificate_number','Serial / certificate number'),fld('recipient_name','Student / employee name'),fld('issue_date','Issue date','date'),fld('signatory_name','Authorized signatory'),fld('template_name','Document template')],
 curriculum:[fld('education_level','Education / grade level'),fld('subject_name','Subject'),fld('chapter','Chapter / unit'),fld('learning_outcome','Learning outcome','textarea'),fld('resource_type','Resource type','select',['Syllabus','Lesson plan','Learning material','Worksheet','Video','Assessment','Other']),fld('coverage_status','Coverage status','select',['Not started','In progress','Covered','Reviewed'])],
 library:[fld('isbn','ISBN / book code'),fld('author','Author'),fld('publisher','Publisher'),fld('category','Book category'),fld('edition','Edition / year'),fld('total_copies','Total copies','number'),fld('fine_per_day','Overdue fine per day (PKR)','number'),fld('shelf_location','Shelf / location'),fld('digital_url','Digital resource URL','url')],
 transport:[fld('registration_number','Vehicle registration number'),fld('route_code','Route code'),fld('driver_name','Driver name'),fld('stop_name','Route stop'),fld('seat_capacity','Seat capacity','number'),fld('transport_fee','Transport fee (PKR)','number'),fld('maintenance_due','Maintenance due date','date')],
 inventory:[fld('sku','Item SKU / code'),fld('item_category','Item category'),fld('unit_of_measure','Unit of measure'),fld('supplier','Supplier'),fld('unit_cost','Unit cost (PKR)','number'),fld('reorder_level','Reorder level','number'),fld('storage_location','Store / location')],
 facilities:[fld('room_number','Room number / code'),fld('facility_type','Facility type','select',['Classroom','Laboratory','Library','Hall','Office','Sports','Other']),fld('building','Building / block'),fld('floor','Floor'),fld('capacity','Capacity','number'),fld('availability_status','Availability','select',['Available','Occupied','Reserved','Maintenance']),fld('maintenance_due','Maintenance due date','date')],
 visitors:[fld('visitor_name','Visitor full name'),fld('organization','Organization / company'),fld('host_name','Host / staff member'),fld('purpose','Visit purpose','textarea'),fld('pass_number','Visitor pass number'),fld('entry_time','Entry time','datetime-local'),fld('exit_time','Exit time','datetime-local')],
 institution_config:[fld('setting_category','Setting category'),fld('setting_key','Setting key'),fld('setting_value','Setting value','textarea'),fld('education_level','Education level'),fld('permission_scope','Permission scope','select',['Institution','Campus','Module','Role','Approval']),fld('access_role','Role / user group')],
 reconciliation:[fld('account_name','Bank / cash account'),fld('statement_period','Statement period'),fld('opening_balance','Opening balance (PKR)','number'),fld('closing_balance','Closing balance (PKR)','number'),fld('matched_total','Matched total (PKR)','number'),fld('unmatched_total','Unmatched total (PKR)','number'),fld('variance','Variance (PKR)','number'),fld('bank_reference','Bank reference')],
 backup:[fld('backup_type','Backup type','select',['Database','Files','Full institution export','Module export']),fld('backup_window','Backup schedule / window'),fld('export_format','Export format','select',['ZIP','CSV','JSON','XLSX','DOCX','PDF']),fld('integrity_check','Validation status','select',['Not run','Passed','Failed','Requires platform action']),fld('platform_job_reference','Platform job reference'),fld('recovery_status','Recovery status','select',['Not requested','Pending approval','Restored','Failed'])],
}
workspaceFields['academic-sessions']=[fld('session_code','Session code'),fld('start_date','Session start date','date'),fld('end_date','Session end date','date'),fld('is_current','Current session','select',['Yes','No']),fld('student_rollover_status','Student rollover status','select',['Not started','In progress','Completed'])]
workspaceFields['classes-sections']=[fld('grade_level','Grade / academic level'),fld('section','Section'),fld('class_teacher','Class teacher'),fld('capacity','Maximum capacity','number'),fld('room_name','Room / classroom'),fld('promotion_status','Promotion status','select',['Not started','In progress','Completed'])]
workspaceFields.subjects=[fld('subject_code','Subject code'),fld('subject_category','Subject category'),fld('department','Department'),fld('grade_level','Academic level'),fld('credit_hours','Credit hours','number'),fld('syllabus_reference','Syllabus reference')]
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

type RecordMetaKey='reference_code'|'status'|'approval_status'|'record_date'|'due_date'|'amount'|'quantity'
const recordMetaLabels:Record<RecordMetaKey,string>={
 reference_code:'Reference',status:'Status',approval_status:'Approval',record_date:'Date',
 due_date:'Due date',amount:'Amount (PKR)',quantity:'Quantity'
}
const recordMetaColumnPlan:Record<string,RecordMetaKey[]>={
 ai:['reference_code','status','approval_status','record_date'],
 administration:['reference_code','status','approval_status','record_date'],
 'academic-sessions':['reference_code','status','record_date','due_date'],
 'classes-sections':['reference_code','status','quantity'],
 subjects:['reference_code','status','record_date'],
 students:['reference_code','status','record_date'],
 employees:['reference_code','status','record_date'],
 finance:['reference_code','status','approval_status','record_date','amount'],
 fees:['reference_code','status','approval_status','due_date','amount'],
 receivables:['reference_code','status','due_date','amount'],
 payments:['reference_code','status','approval_status','record_date','amount'],
 receipts:['reference_code','status','record_date','amount'],
 payroll:['reference_code','status','approval_status','record_date','amount'],
 attendance:['reference_code','status','record_date'],
 timetable:['reference_code','status','record_date','due_date'],
 teaching:['reference_code','status','due_date'],
 behaviour:['reference_code','status','record_date'],
 communication:['reference_code','status','due_date'],
 question_bank:['reference_code','status','approval_status'],
 examinations:['reference_code','status','record_date','due_date'],
 tests:['reference_code','status','record_date','due_date'],
 reports:['reference_code','status','record_date','due_date'],
 certificates:['reference_code','status','record_date'],
 curriculum:['reference_code','status','record_date'],
 library:['reference_code','status','quantity'],
 transport:['reference_code','status','quantity','amount'],
 inventory:['reference_code','status','quantity','amount'],
 facilities:['reference_code','status','quantity'],
 visitors:['reference_code','status','record_date'],
 institution_config:['reference_code','status','approval_status'],
 reconciliation:['reference_code','status','approval_status','record_date','amount'],
 backup:['reference_code','status','approval_status','record_date'],
}
const workspaceTableFieldOrder:Record<string,string[]>={
 'academic-sessions':['session_code','start_date','end_date','student_rollover_status'],
 'classes-sections':['grade_level','section','class_teacher','capacity'],
 subjects:['subject_code','subject_category','grade_level','credit_hours'],
 ai:['insight_type','source_dataset','confidence_percent','human_review'],
 administration:['entity_code','contact_name','email','phone'],
 academic_setup:['academic_level','academic_year','start_date','end_date'],
 students:['student_reference','class_name','guardian_name','document_type'],
 employees:['employee_number','employee_category','department','designation'],
 finance:['account_code','account_category','transaction_type','debit'],
 fees:['fee_category','fee_frequency','class_name','academic_session'],
 receivables:['invoice_reference','student_reference','ageing_bucket','follow_up_date'],
 payments:['payment_method','transaction_reference','verification_status','payment_date'],
 receipts:['receipt_number','payment_reference','issued_to','issue_date'],
 payroll:['employee_reference','salary_component','pay_period','base_salary'],
 attendance:['register_period','marking_source','marking_status','device_reference'],
 timetable:['weekday','period_label','start_time','end_time'],
 teaching:['subject_name','class_name','chapter','submission_date'],
 behaviour:['behaviour_type','severity','observed_date','action_taken'],
 communication:['channel','audience','delivery_status','scheduled_at'],
 question_bank:['question_type','subject_name','chapter','difficulty'],
 examinations:['exam_type','class_name','subject_name','exam_date'],
 tests:['test_format','subject_name','class_name','test_date'],
 reports:['report_type','date_from','date_to','schedule_frequency'],
 certificates:['certificate_type','certificate_number','recipient_name','issue_date'],
 curriculum:['education_level','subject_name','chapter','coverage_status'],
 library:['isbn','author','category','total_copies'],
 transport:['registration_number','route_code','driver_name','seat_capacity'],
 inventory:['sku','item_category','supplier','unit_cost'],
 facilities:['room_number','facility_type','building','availability_status'],
 visitors:['visitor_name','organization','host_name','entry_time'],
 institution_config:['setting_category','setting_key','permission_scope','access_role'],
 reconciliation:['account_name','statement_period','matched_total','variance'],
 backup:['backup_type','backup_window','integrity_check','recovery_status'],
}
const workspaceRecordLabels:Record<string,string>={
 'academic-sessions':'Academic session','classes-sections':'Class / section',subjects:'Subject',
 students:'Student',employees:'Employee',attendance:'Attendance register',behaviour:'Behaviour entry',
 certificates:'Certificate',curriculum:'Learning resource',timetable:'Timetable entry',teaching:'Learning activity',
 'question-bank':'Question',examinations:'Examination',tests:'Class test',library:'Library item',
 finance:'Ledger entry',fees:'Fee record',receivables:'Receivable',payments:'Payment',receipts:'Receipt',
 payroll:'Payroll entry',reconciliation:'Reconciliation',communication:'Communication item',
 transport:'Transport record',inventory:'Stock item',facilities:'Facility',visitors:'Visitor',
 administration:'Institution record',institution_config:'Configuration item',backup:'Data job',ai:'Insight record',
}
const workspaceLayouts:Record<string,string>={
 administration:'governance',institution_config:'governance',backup:'governance',
 'academic-sessions':'academic','classes-sections':'academic',academic_setup:'academic',subjects:'academic',
 curriculum:'academic',timetable:'academic',teaching:'academic',question_bank:'assessment',examinations:'assessment',tests:'assessment',
 students:'people',employees:'people',attendance:'people',behaviour:'people',certificates:'people',
 finance:'ledger',fees:'ledger',receivables:'ledger',payments:'ledger',receipts:'ledger',payroll:'ledger',reconciliation:'ledger',
 communication:'communication',library:'resource',transport:'operations',inventory:'operations',facilities:'operations',visitors:'operations',
 ai:'intelligence',reports:'intelligence',
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
 const [visibility,setVisibility]=useState('staff_only')
 const [recordDate,setRecordDate]=useState(new Date().toISOString().slice(0,10))
 const [dueDate,setDueDate]=useState('')
 const [amount,setAmount]=useState('')
 const [quantity,setQuantity]=useState('')
 const [payloadData,setPayloadData]=useState<Record<string,unknown>>({})
 const structuredFields=workspaceFields[group.key]??workspaceFields[group.dataModule]??[]
 const preferredFieldKeys=workspaceTableFieldOrder[group.key]??workspaceTableFieldOrder[group.dataModule]??structuredFields.map(field=>field.key)
 const tableFields=preferredFieldKeys.flatMap(key=>{
  const field=structuredFields.find(candidate=>candidate.key===key)
  return field?[field]:[]
 }).slice(0,4)
 const metaColumnKeys:RecordMetaKey[]=recordMetaColumnPlan[group.key]??recordMetaColumnPlan[group.dataModule]??['reference_code','status','record_date']
 const tableMetaColumns=metaColumnKeys
  .filter(key=>!(['student','parent'].includes(user?.role??'')&&key==='approval_status'))
  .map(key=>({key,label:recordMetaLabels[key]}))
 const recordLabel=workspaceRecordLabels[group.key]??workspaceRecordLabels[group.dataModule]??'Record'
 const workspaceLayout=workspaceLayouts[group.key]??workspaceLayouts[group.dataModule]??'registry'
 const theme=themes[group.theme]||themes.blue
 const canAdmin=Boolean(user&&['owner','admin'].includes(user.role))
 const canWrite=Boolean(user&&(
  canAdmin||
  (user.role==='teacher'&&['academic_setup','attendance','timetable','teaching','behaviour','communication','question_bank','examinations','tests','curriculum'].includes(group.dataModule))||
  (user.role==='accountant'&&['finance','fees','receivables','payments','receipts','payroll','reconciliation','inventory'].includes(group.dataModule))||
  (user.role==='exam_officer'&&['question_bank','examinations','tests','reports'].includes(group.dataModule))
 ))

 const showAmount=['accounts-finance','fees','receivables','payments','receipts','payroll','reconciliation','transport','inventory'].includes(group.key)||['finance','fees','receivables','payments','receipts','payroll','reconciliation'].includes(group.dataModule)
 const showQuantity=['classes-sections','library','transport','inventory','facilities'].includes(group.key)
 const showDueDate=['academic-sessions','fees','receivables','timetable','teaching','examinations','class-tests','reports','certificates','transport','facilities','visitors','backup'].includes(group.key)||['fees','receivables','timetable','teaching','examinations','tests','reports','certificates'].includes(group.dataModule)
 const showPortalVisibility=['communication','curriculum','certificates','teaching','library','transport','behaviour'].includes(group.key)
 
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
  setStatus(row?.status??'draft');setApproval(row?.approval_status??'not_required');setVisibility(row?.visibility??(['library','curriculum','certificates','teaching','transport'].includes(group.key)?'student_portal':'staff_only'))
  setRecordDate(row?.record_date??new Date().toISOString().slice(0,10));setDueDate(row?.due_date??'')
  setAmount(row?.amount===null||row?.amount===undefined?'':String(row.amount));setQuantity(row?.quantity===null||row?.quantity===undefined?'':String(row.quantity))
  setPayloadData(row?.payload??{});setShowForm(true)
 }
 async function save(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user)return
  const payload:Record<string,unknown>={...payloadData}
  for(const field of structuredFields){if(field.type==='number'&&payload[field.key]!==undefined&&payload[field.key]!==''&&payload[field.key]!==null){const numeric=Number(payload[field.key]);if(!Number.isFinite(numeric)){onToast(field.label+' must be a valid number.',true);return}payload[field.key]=numeric}}
  if(amount.trim()&&(!Number.isFinite(Number(amount))||Number(amount)<0)){onToast('Amount must be a valid non-negative number.',true);return}
  if(quantity.trim()&&(!Number.isFinite(Number(quantity))||Number(quantity)<0)){onToast('Quantity must be a valid non-negative number.',true);return}
  setSaving(true)
  const values={
   institution_id:user.institutionId,module_key:group.dataModule,record_type:item.key,title:title.trim(),
   reference_code:reference.trim()||null,description:description.trim()||null,status,approval_status:approval,visibility,
   record_date:recordDate||null,due_date:dueDate||null,amount:amount.trim()?Number(amount):null,
   quantity:quantity.trim()?Number(quantity):null,payload,campus_id:campus||null
  }
  try{
   const query=editing
    ?supabase.from('institutional_records').update({...values,updated_by:user.id}).eq('id',editing.id).eq('institution_id',user.institutionId).select().single()
    :supabase.from('institutional_records').insert({...values,created_by:user.id,updated_by:user.id}).select().single()
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
 const columns=[...exportColumns,...structuredFields.map(field=>({key:field.key,label:field.label}))]
 const exportRows=filtered.map(row=>({...row,...row.payload}))
 function exportCsv(){downloadCsv(baseName+'.csv',exportRows as unknown as Record<string,unknown>[],columns)}
 function exportExcel(){exportXlsx(baseName+'.xlsx',group.label+' — '+item.label,exportRows as unknown as Record<string,unknown>[],columns)}
 function exportWord(){exportDocx(baseName+'.docx',group.label+' — '+item.label,exportRows as unknown as Record<string,unknown>[],columns)}
 function print(){try{printOfficeReport(group.label+' — '+item.label,exportRows as unknown as Record<string,unknown>[],columns,user?.institutionName??'EduSphere 360')}catch(error){onToast(error instanceof Error?error.message:'Print view could not be opened.',true)}}

 return <main className="page-content ed360-module-page ed360-institutional-workspace" data-workspace-group={group.key} data-workspace-theme={group.theme} data-workspace-layout={workspaceLayout} style={{'--workspace-accent':theme.accent,'--workspace-soft':theme.soft,'--workspace-ink':theme.ink} as CSSProperties}>
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
    <button type="button" onClick={exportExcel}><FileSpreadsheet size={14}/> XLSX</button>
    <button type="button" onClick={exportWord}><FileText size={14}/> DOCX</button>
    <button type="button" onClick={print}><Printer size={14}/> Print / PDF</button>
   </div>
  </div>
  {loadError&&<div className="ed360-workspace-error" role="alert">{loadError}</div>}
  {group.key==='ai'&&<div className="ed360-workspace-integration-note"><b>AI provider not configured</b><span>This workspace stores manually authored, reviewable insight records. Predictions and generated answers are not produced until an AI provider is connected and tested.</span></div>}
  {group.key==='communication'&&<div className="ed360-workspace-integration-note"><b>Messaging provider status</b><span>Not connected. This workspace records communication plans and delivery metadata; WhatsApp, SMS and email delivery require an approved provider integration.</span></div>}
  {group.key==='backup'&&<div className="ed360-workspace-integration-note"><b>Platform backup / restore connection required</b><span>Requests can be tracked here, but a backup or restore is only complete when Supabase or the configured storage provider confirms the operation.</span></div>}
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
   <div className="table-scroll"><table aria-label={group.label+' '+item.label+' register'}><thead><tr><th scope="col">{recordLabel}</th>{tableMetaColumns.map(column=><th key={column.key} scope="col" data-column={column.key}>{column.label}</th>)}{tableFields.map(field=><th key={field.key} scope="col">{field.label}</th>)}<th scope="col">Actions</th></tr></thead><tbody>
    {filtered.map(row=><tr key={row.id}><td><button className="ed360-record-open" type="button" onClick={()=>setDetail(row)}>{row.title}</button><small className="ed360-record-subtitle">{row.description||row.record_type.replaceAll('-',' ')}</small></td>{tableMetaColumns.map(column=><td key={column.key} data-column={column.key}>{column.key==='reference_code'?row.reference_code||'—':column.key==='status'?<span className={'ed360-state-pill state-'+row.status}>{row.status.replaceAll('_',' ')}</span>:column.key==='approval_status'?row.approval_status.replaceAll('_',' '):column.key==='record_date'?displayDate(row.record_date):column.key==='due_date'?displayDate(row.due_date):column.key==='amount'?money(row.amount):row.quantity??'—'}</td>)}{tableFields.map(field=><td key={field.key} data-column={field.key}>{String(row.payload?.[field.key]??'—')}</td>)}<td><div className="ed360-row-actions"><button type="button" onClick={()=>setDetail(row)}>Open</button>{canWrite&&<button type="button" onClick={()=>resetForm(row)}>Edit</button>}</div></td></tr>)}
   </tbody></table></div>}
  </section>
  {showForm&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShowForm(false)}}><section className="modal-card ed360-context-form" role="dialog" aria-modal="true" aria-labelledby="ed360-form-heading">
   <div className="modal-heading"><div><div className="eyebrow">{group.label.toUpperCase()} / {item.label.toUpperCase()}</div><h2 id="ed360-form-heading">{editing?'Edit':'Create'} {item.label}</h2><p>This form saves a real institution-scoped record.</p></div><button type="button" className="icon-button" onClick={()=>setShowForm(false)} aria-label="Close"><X size={18}/></button></div>
   <form onSubmit={save} className="ed360-context-form-grid">
    <label>Record title *<input required value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} placeholder={'Enter '+item.label.toLowerCase()}/></label>
    <label>Reference / number<input value={reference} onChange={e=>setReference(e.target.value)} maxLength={80} placeholder="Optional reference"/></label>
    <label>Description / notes<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} maxLength={3000}/></label>
    <div className="ed360-form-row"><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{statusOptions.map(s=><option value={s} key={s}>{s.replaceAll('_',' ')}</option>)}</select></label>{canAdmin&&<label>Approval<select value={approval} onChange={e=>setApproval(e.target.value)}><option value="not_required">Not required</option><option value="draft">Draft</option><option value="pending">Needs approval</option></select></label>}</div>
    <div className="ed360-form-row"><label>Record date<input type="date" value={recordDate} onChange={e=>setRecordDate(e.target.value)}/></label>{showDueDate&&<label>Due date<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label>}</div>
    {showPortalVisibility&&<label>Portal visibility<select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="staff_only">Staff only</option><option value="student_portal">Student portal</option><option value="parent_portal">Parent portal</option><option value="institution_portal">Institution portal (shared)</option></select><small>Choose portal access deliberately. Sensitive records should remain staff-only.</small></label>}
    {(showAmount||showQuantity)&&<div className="ed360-form-row">{showAmount&&<label>Amount (PKR)<input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}{showQuantity&&<label>Quantity<input type="number" min="0" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>}</div>}
    {structuredFields.length>0&&<section className="ed360-module-specific-form"><div className="ed360-module-specific-heading"><span>MODULE-SPECIFIC INFORMATION</span><p>Fields for {item.label.toLowerCase()}.</p></div><div className="ed360-context-form-fields">{structuredFields.map(field=><label key={field.key}>{field.label}{field.type==='select'?<select value={String(payloadData[field.key]??'')} onChange={e=>setPayloadData(old=>({...old,[field.key]:e.target.value}))}><option value="">Select / not set</option>{(field.options??[]).map(option=><option value={option} key={option}>{option}</option>)}</select>:field.type==='textarea'?<textarea rows={3} value={String(payloadData[field.key]??'')} onChange={e=>setPayloadData(old=>({...old,[field.key]:e.target.value}))} placeholder={field.placeholder??''}/>:<input type={field.type??'text'} step={field.type==='number'?'0.01':undefined} value={String(payloadData[field.key]??'')} onChange={e=>setPayloadData(old=>({...old,[field.key]:e.target.value}))} placeholder={field.placeholder??''}/>}</label>)}</div></section>}
    <div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving?'Saving…':editing?'Save changes':'Create record'}</button></div>
   </form>
  </section></div>}
  {detail&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setDetail(null)}}><section className="modal-card ed360-record-details ed360-context-detail" role="dialog" aria-modal="true" aria-labelledby="ed360-detail-heading">
   <div className="modal-heading"><div><div className="eyebrow">CONTEXTUAL SUB-WINDOW / {group.label.toUpperCase()}</div><h2 id="ed360-detail-heading">{detail.title}</h2><p>{detail.reference_code||detail.record_type.replaceAll('-',' ')} · {detail.status}</p></div><button type="button" className="icon-button" onClick={()=>setDetail(null)} aria-label="Close"><X size={18}/></button></div>
   <div className="ed360-context-detail-callout"><div>{canAdmin&&<><span>RECORD WORKFLOW</span><strong>{detail.approval_status.replaceAll('_',' ')}</strong></>}<p>{detail.description||'No additional description supplied.'}</p></div><aside><b>Responsible workspace</b><p>{group.label} / {item.label}</p><b>Updated</b><p>{detail.updated_at?new Date(detail.updated_at).toLocaleString():'Not available'}</p></aside></div>
   <div className="ed360-record-details-grid"><div className="ed360-record-detail"><small>Status</small><b>{detail.status}</b></div><div className="ed360-record-detail"><small>Record date</small><b>{displayDate(detail.record_date)}</b></div><div className="ed360-record-detail"><small>Due date</small><b>{displayDate(detail.due_date)}</b></div><div className="ed360-record-detail"><small>Amount</small><b>{money(detail.amount)}</b></div><div className="ed360-record-detail"><small>Quantity</small><b>{detail.quantity??'—'}</b></div><div className="ed360-record-detail"><small>Created</small><b>{detail.created_at?new Date(detail.created_at).toLocaleString():'—'}</b></div></div>
   {Object.keys(detail.payload??{}).length>0&&<section className="ed360-payload-section"><h3>{item.label} details</h3><div className="ed360-record-details-grid">{Object.entries(detail.payload).map(([key,value])=><div className="ed360-record-detail" key={key}><small>{structuredFields.find(field=>field.key===key)?.label??key.replaceAll('_',' ')}</small><b>{typeof value==='boolean'?(value?'Yes':'No'):String(value??'—')}</b></div>)}</div></section>}
   <div className="modal-actions">
    {canAdmin&&detail.approval_status==='pending'&&<><button type="button" className="button button-outline" onClick={()=>void decide(detail,'rejected')}>Reject</button><button type="button" className="button button-primary" onClick={()=>void decide(detail,'approved')}><CheckCircle2 size={15}/> Approve</button></>}
    {canWrite&&<button type="button" className="button button-outline" onClick={()=>{const row=detail;setDetail(null);resetForm(row)}}>Edit record</button>}
    {canAdmin&&<button type="button" className="button button-danger" onClick={()=>void remove(detail)}>Delete</button>}
    <button type="button" className="button button-primary" onClick={()=>setDetail(null)}>Close</button>
   </div>
  </section></div>}
 </main>
}
