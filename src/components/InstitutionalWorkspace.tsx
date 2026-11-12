import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Activity, ArrowUpRight, CheckCircle2, Download, FileSpreadsheet, FileText, Filter, Plus, Printer, Search, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getWorkspaceGroup, getWorkspaceItem, institutionalMenu } from '../lib/institutionalCatalog'
import { exportDocx, exportXlsx, printOfficeReport, type OfficeColumn } from '../lib/officeExport'
import { downloadCsv } from '../lib/csv'
import { canViewInternalApproval, getWorkspaceExportColumns, getWorkspaceExportRows, getWorkspaceReviewMetrics } from '../lib/workspacePrivacy.js'
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
workspaceFields.front_office=[
 fld('contact_name','Contact / visitor name'),fld('contact_phone','Phone number'),fld('contact_email','Email address','email'),
 fld('enquiry_source','Enquiry source','select',['Walk-in','Phone','Website','Referral','Email','Other']),
 fld('assigned_to','Assigned staff member'),fld('follow_up_date','Follow-up date','date'),fld('request_status','Request status','select',['New','Assigned','In progress','Waiting for response','Resolved','Closed']),
 fld('audience','Target audience','select',['All institution','Parents','Students','Teachers','Staff','Selected class']),
 fld('event_venue','Venue / meeting location'),fld('event_start','Event start','datetime-local'),fld('event_end','Event end','datetime-local'),
 fld('visit_purpose','Purpose / request details','textarea'),fld('resolution_notes','Resolution / next action','textarea')
]
workspaceFields.forms_documents=[
 fld('form_category','Form category','select',['Admission','Leave','Feedback','Event registration','Profile update','General']),
 fld('audience','Who can submit','select',['Staff','Teachers','Students','Parents','Public','Selected group']),
 fld('field_schema','Form fields / instructions','textarea'),fld('submission_deadline','Submission deadline','date'),
 fld('submission_reference','Submission reference'),fld('reviewer','Assigned reviewer'),fld('review_status','Review status','select',['Received','Under review','Needs correction','Approved','Rejected']),
 fld('document_category','Document category','select',['Student','Employee','Institution','Finance','Academic','Policy','Other']),
 fld('related_record','Related record / person'),fld('file_reference','Private file reference'),fld('expiry_date','Expiry date','date'),
 fld('verification_code','Verification code'),fld('verification_status','Verification status','select',['Not checked','Verified','Rejected','Expired']),
 fld('import_file','Import filename'),fld('import_type','Import record type'),fld('validation_summary','Validation summary','textarea'),fld('export_scope','Export scope')
]
workspaceFields.hostel=[
 fld('building_name','Hostel / building'),fld('floor','Floor / block'),fld('room_number','Room number'),fld('bed_number','Bed number'),
 fld('room_capacity','Room capacity','number'),fld('resident_reference','Student / resident reference'),fld('allocation_start','Allocation start','date'),fld('allocation_end','Expected checkout','date'),
 fld('occupancy_status','Occupancy','select',['Available','Part occupied','Full','Maintenance']),fld('hostel_fee','Accommodation fee','number'),fld('warden_name','Warden / supervisor')
]
workspaceFields.cafeteria=[
 fld('menu_category','Menu category'),fld('item_code','Menu item code'),fld('unit_price','Unit price','number'),fld('availability','Availability','select',['Available','Unavailable','Seasonal']),
 fld('quantity_sold','Quantity sold','number'),fld('transaction_date','Transaction date','datetime-local'),fld('payment_method','Payment method','select',['Cash','Card','Account','Other']),
 fld('meal_plan','Meal plan'),fld('supplier','Supplier'),fld('stock_reference','Stock reference')
]
workspaceFields.assets=[
 fld('asset_tag','Asset tag / serial'),fld('asset_category','Asset category','select',['IT equipment','Furniture','Laboratory','Vehicle','Facility','Other']),
 fld('purchase_date','Purchase date','date'),fld('purchase_cost','Purchase cost','number'),fld('assigned_to','Assigned person / department'),
 fld('location','Current location'),fld('asset_condition','Condition','select',['New','Good','Needs repair','Damaged','Disposed']),
 fld('warranty_expiry','Warranty expiry','date'),fld('maintenance_due','Next maintenance','date'),fld('disposal_date','Disposal date','date')
]
workspaceFields.procurement=[
 fld('requesting_department','Requesting department'),fld('requested_by','Requested by'),fld('supplier','Supplier'),fld('quotation_reference','Quotation reference'),
 fld('requested_quantity','Requested quantity','number'),fld('estimated_cost','Estimated cost','number'),fld('approved_amount','Approved amount','number'),
 fld('purchase_order','Purchase order reference'),fld('delivery_due','Expected delivery','date'),fld('received_quantity','Quantity received','number'),
 fld('receiving_status','Receiving status','select',['Not ordered','Ordered','Part received','Received','Rejected'])
]
workspaceFields.sports=[
 fld('activity_type','Activity type','select',['Sport','Club','Arts','Competition','Community','Other']),fld('supervisor','Coach / supervisor'),
 fld('venue','Venue / facility'),fld('schedule_start','Start date/time','datetime-local'),fld('schedule_end','End date/time','datetime-local'),
 fld('eligibility','Eligibility / class'),fld('team_name','Team / club'),fld('participant_count','Participants','number'),
 fld('competition','Competition / event'),fld('achievement','Achievement / result','textarea')
]
const itemWorkspaceFields:Record<string,WorkspaceField[]> = {
 'front-office:reception-enquiries':[fld('contact_name','Applicant / contact name'),fld('contact_phone','Phone number'),fld('contact_email','Email address','email'),fld('requested_program','Requested class / program'),fld('enquiry_source','Enquiry source','select',['Walk-in','Phone','Website','Referral','Email','Other']),fld('assigned_to','Assigned counsellor'),fld('follow_up_date','Next follow-up','date'),fld('conversion_status','Application conversion','select',['Not started','Follow-up required','Converted to application','Closed'])],
 'front-office:complaints-helpdesk':[fld('requester_name','Submitted by'),fld('requester_role','Requester role'),fld('category','Request category','select',['Technical','Academic','Finance','Facilities','Transport','Safety','Other']),fld('priority','Priority','select',['Low','Normal','High','Urgent']),fld('assigned_to','Assigned staff'),fld('target_resolution','Target resolution date','date'),fld('resolution_notes','Resolution notes','textarea'),fld('request_status','Request status','select',['Open','Assigned','In progress','Waiting','Resolved','Closed','Reopened'])],
 'front-office:visitor-management':[fld('visitor_name','Visitor name'),fld('visitor_phone','Phone number'),fld('organization','Organization'),fld('host_name','Person to meet'),fld('purpose','Visit purpose','textarea'),fld('entry_time','Entry time','datetime-local'),fld('exit_time','Exit time','datetime-local'),fld('pass_number','Visitor pass number')],
 'forms-documents:form-builder':[fld('form_category','Form type','select',['Admission','Leave','Feedback','Event registration','Profile update','General']),fld('instructions','Instructions','textarea'),fld('field_schema','Field list and validation rules','textarea'),fld('audience','Audience','select',['Staff','Teachers','Students','Parents','Public']),fld('submission_deadline','Submission deadline','date'),fld('publication_status','Publication','select',['Draft','Published','Closed'])],
 'forms-documents:form-submissions':[fld('submission_reference','Submission reference'),fld('form_name','Form name'),fld('submitted_by','Submitted by'),fld('submission_date','Submission date','datetime-local'),fld('reviewer','Assigned reviewer'),fld('review_status','Review status','select',['Received','Under review','Needs correction','Approved','Rejected']),fld('review_notes','Reviewer notes','textarea')],
 'forms-documents:document-records':[fld('document_category','Document category'),fld('related_person','Related person / record'),fld('file_reference','Private file reference'),fld('uploaded_on','Upload date','date'),fld('expiry_date','Expiry date','date'),fld('access_classification','Access classification','select',['Restricted','Staff only','Student portal','Parent portal'])],
 'forms-documents:document-verification':[fld('verification_code','Verification code'),fld('document_type','Document type'),fld('subject_reference','Student / employee reference'),fld('issued_on','Issue date','date'),fld('verification_status','Verification result','select',['Not checked','Verified','Rejected','Expired']),fld('verification_notes','Verification notes','textarea')],
 'forms-documents:data-import':[fld('import_type','Record type'),fld('source_filename','Source filename'),fld('column_mapping','Column mapping','textarea'),fld('rows_total','Total rows','number'),fld('rows_valid','Valid rows','number'),fld('rows_rejected','Rejected rows','number'),fld('import_status','Import status','select',['Draft','Validated','Ready for review','Imported','Failed'])],
 'forms-documents:data-export':[fld('export_type','Record type'),fld('date_from','From date','date'),fld('date_to','To date','date'),fld('file_format','File format','select',['CSV','XLSX','PDF','DOCX']),fld('field_scope','Included fields','textarea'),fld('export_status','Export status','select',['Requested','Preparing','Ready','Failed'])],
 'forms-documents:data-validation':[fld('validation_type','Validation category'),fld('records_checked','Records checked','number'),fld('issues_found','Issues found','number'),fld('validation_rules','Rules checked','textarea'),fld('validation_status','Validation status','select',['Not run','Passed','Issues found','Failed'])],
 'my-account:my-profile':[fld('profile_section','Profile section'),fld('profile_note','Profile update request / note','textarea')],
 'my-account:account-settings':[fld('setting_group','Setting group'),fld('setting_name','Preference'),fld('setting_value','Selected value'),fld('saved_on_device','Saved on this device','select',['Yes','No'])],
 'my-account:notification-settings':[fld('notification_category','Notification category'),fld('delivery_preference','Preference','select',['In-app','Email','Disabled']),fld('quiet_hours','Quiet hours'),fld('saved_on_device','Saved on this device','select',['Yes','No'])],
 'my-account:my-activity':[fld('activity_type','Activity type'),fld('related_reference','Related record'),fld('activity_date','Activity date','datetime-local'),fld('activity_summary','Activity summary','textarea')],
 'my-account:help-support':[fld('support_category','Support category','select',['Login / account','Student records','Academic','Attendance','Finance','Technical','Other']),fld('priority','Priority','select',['Normal','High','Urgent']),fld('issue_description','Describe the issue','textarea'),fld('preferred_contact','Preferred contact method','select',['In-app','Email','Phone']),fld('support_status','Request status','select',['Open','In progress','Waiting','Resolved','Closed'])],
 'front-office:parent-communication':[fld('student_reference','Linked student'),fld('conversation_subject','Conversation subject'),fld('recipient_name','Parent / guardian'),fld('message_body','Message','textarea'),fld('communication_status','Conversation status','select',['Open','Waiting','Responded','Closed'])],
 'front-office:internal-messages':[fld('recipient_name','Recipient / team'),fld('message_subject','Subject'),fld('message_body','Message','textarea'),fld('attachment_reference','Attachment reference'),fld('message_status','Message status','select',['Draft','Sent','Archived'])],
 'front-office:circulars-notices':[fld('circular_number','Circular number'),fld('audience','Target audience','select',['All institution','Parents','Students','Teachers','Staff','Selected class']),fld('publication_date','Publication date','date'),fld('expiry_date','Expiry date','date'),fld('notice_body','Circular / notice text','textarea'),fld('publication_status','Publication status','select',['Draft','Published','Expired'])],
 'front-office:events-activities':[fld('event_type','Event type','select',['Academic','Sports','Cultural','Parent meeting','Training','Other']),fld('event_venue','Venue'),fld('event_start','Event start','datetime-local'),fld('event_end','Event end','datetime-local'),fld('organiser','Organiser'),fld('target_audience','Audience'),fld('registration_deadline','Registration deadline','date')],
 'forms-documents:letters-applications':[fld('document_type','Letter / application type'),fld('recipient_name','Recipient'),fld('reference_number','Reference number'),fld('issue_date','Issue date','date'),fld('document_body','Document content / application details','textarea'),fld('approval_status','Review status','select',['Draft','Pending','Approved','Rejected','Issued'])],
 'forms-documents:document-templates':[fld('template_type','Document type','select',['Certificate','Letter','Fee receipt','Report card','Notice','Other']),fld('template_name','Template name'),fld('header_content','Header / institution identity','textarea'),fld('body_content','Template body','textarea'),fld('footer_content','Footer / signatory','textarea'),fld('template_status','Template status','select',['Draft','Active','Archived'])],
 'forms-documents:duplicate-detection':[fld('record_category','Record type'),fld('matching_rule','Matching fields'),fld('records_scanned','Records scanned','number'),fld('possible_duplicates','Possible matches','number'),fld('review_outcome','Review outcome','select',['Needs review','Confirmed duplicate','Not a duplicate','Resolved'])],
 'forms-documents:integration-status':[fld('integration_name','Connected service'),fld('integration_type','Integration type'),fld('last_checked','Last checked','datetime-local'),fld('last_success','Last successful transfer','datetime-local'),fld('connection_status','Connection status','select',['Not configured','Connected','Needs attention','Failed']),fld('notes','Status notes','textarea')],
 'hostel:hostel-dashboard':[fld('building_count','Hostel buildings','number'),fld('room_count','Total rooms','number'),fld('occupied_beds','Occupied beds','number'),fld('available_beds','Available beds','number'),fld('occupancy_note','Occupancy notes','textarea')],
 'hostel:hostel-buildings':[fld('building_code','Building code'),fld('building_name','Building name'),fld('warden_name','Warden / supervisor'),fld('address','Building address','textarea'),fld('total_floors','Number of floors','number'),fld('building_status','Status','select',['Active','Maintenance','Inactive'])],
 'hostel:room-bed-register':[fld('building_name','Building'),fld('floor','Floor'),fld('room_number','Room number'),fld('bed_number','Bed number'),fld('room_capacity','Room capacity','number'),fld('room_condition','Condition','select',['Good','Needs cleaning','Needs repair','Unavailable'])],
 'hostel:resident-allocation':[fld('resident_reference','Student / resident ID'),fld('resident_name','Resident name'),fld('building_name','Building'),fld('room_number','Room number'),fld('bed_number','Bed number'),fld('allocation_start','Check-in date','date'),fld('allocation_end','Expected check-out','date')],
 'hostel:room-transfers':[fld('resident_reference','Resident reference'),fld('from_room','Current room'),fld('to_room','New room'),fld('transfer_date','Transfer date','date'),fld('transfer_reason','Reason','textarea'),fld('approved_by','Approved by')],
 'hostel:check-in-check-out':[fld('resident_reference','Resident reference'),fld('movement_type','Movement','select',['Check-in','Temporary exit','Return','Check-out']),fld('movement_date','Date and time','datetime-local'),fld('authorised_by','Authorised by'),fld('movement_note','Notes','textarea')],
 'hostel:visitor-register':[fld('visitor_name','Visitor name'),fld('resident_reference','Resident being visited'),fld('relationship','Relationship'),fld('visit_purpose','Visit purpose','textarea'),fld('entry_time','Entry time','datetime-local'),fld('exit_time','Exit time','datetime-local')],
 'hostel:hostel-fees':[fld('resident_reference','Resident reference'),fld('billing_period','Billing period'),fld('fee_amount','Accommodation fee','number'),fld('due_date','Due date','date'),fld('payment_reference','Payment reference'),fld('payment_status','Payment status','select',['Pending','Part paid','Paid','Waived'])],
 'hostel:maintenance-requests':[fld('building_name','Building'),fld('room_number','Room'),fld('reported_by','Reported by'),fld('issue_type','Issue type'),fld('priority','Priority','select',['Low','Normal','High','Urgent']),fld('assigned_to','Assigned technician'),fld('request_status','Status','select',['Open','Assigned','In progress','Resolved','Closed'])],
 'hostel:occupancy-reports':[fld('report_period','Report period'),fld('building_name','Building'),fld('total_beds','Total beds','number'),fld('occupied_beds','Occupied beds','number'),fld('vacant_beds','Vacant beds','number'),fld('occupancy_rate','Occupancy rate (%)','number')],
 'cafeteria:cafeteria-dashboard':[fld('report_period','Report period'),fld('total_sales','Total sales','number'),fld('transactions_count','Transactions','number'),fld('stock_alerts','Low-stock items','number'),fld('summary_notes','Summary','textarea')],
 'cafeteria:menu-price-list':[fld('item_code','Item code'),fld('item_name','Menu item'),fld('menu_category','Category'),fld('unit_price','Price (PKR)','number'),fld('dietary_note','Dietary / allergen notes','textarea'),fld('item_status','Status','select',['Available','Unavailable','Seasonal'])],
 'cafeteria:daily-availability':[fld('menu_item','Menu item'),fld('service_date','Service date','date'),fld('available_quantity','Available quantity','number'),fld('sold_quantity','Sold quantity','number'),fld('availability_status','Status','select',['Available','Sold out','Unavailable'])],
 'cafeteria:sales-transactions':[fld('transaction_reference','Transaction reference'),fld('transaction_date','Date and time','datetime-local'),fld('buyer_reference','Student / staff reference'),fld('items_summary','Items and quantities','textarea'),fld('total_amount','Total amount (PKR)','number'),fld('payment_method','Payment method','select',['Cash','Card','Account','Other'])],
 'cafeteria:meal-plans':[fld('plan_name','Meal plan'),fld('plan_period','Duration'),fld('included_meals','Meals included'),fld('plan_price','Price (PKR)','number'),fld('eligibility','Eligible users'),fld('plan_status','Status','select',['Active','Inactive','Archived'])],
 'cafeteria:cafeteria-inventory':[fld('item_code','Stock item'),fld('supplier','Supplier'),fld('quantity_on_hand','Quantity on hand','number'),fld('reorder_level','Reorder level','number'),fld('unit_cost','Unit cost (PKR)','number'),fld('expiry_date','Expiry date','date')],
 'cafeteria:supplier-records':[fld('supplier_name','Supplier'),fld('contact_name','Contact person'),fld('phone','Phone'),fld('email','Email','email'),fld('product_category','Supplied category'),fld('supplier_status','Status','select',['Active','On hold','Inactive'])],
 'cafeteria:cafeteria-reports':[fld('report_type','Report type'),fld('date_from','From date','date'),fld('date_to','To date','date'),fld('revenue_total','Revenue (PKR)','number'),fld('stock_usage','Stock usage summary','textarea')],
 'assets:asset-dashboard':[fld('assets_total','Total assets','number'),fld('assets_active','Active assets','number'),fld('assets_maintenance','Under maintenance','number'),fld('assets_disposed','Disposed assets','number'),fld('summary_note','Summary','textarea')],
 'assets:asset-register':[fld('asset_tag','Asset tag'),fld('asset_name','Asset name'),fld('asset_category','Category'),fld('serial_number','Serial number'),fld('purchase_date','Purchase date','date'),fld('purchase_cost','Purchase cost (PKR)','number'),fld('current_location','Location')],
 'assets:asset-categories':[fld('category_code','Category code'),fld('category_name','Category name'),fld('depreciation_method','Depreciation method'),fld('useful_life','Useful life (years)','number'),fld('category_notes','Notes','textarea')],
 'assets:asset-assignment':[fld('asset_tag','Asset tag'),fld('assigned_to','Assigned person / department'),fld('assigned_date','Assignment date','date'),fld('condition_at_issue','Condition at issue'),fld('expected_return','Expected return','date')],
 'assets:asset-transfers':[fld('asset_tag','Asset tag'),fld('from_location','From location'),fld('to_location','To location'),fld('transfer_date','Transfer date','date'),fld('authorised_by','Authorised by'),fld('transfer_reason','Reason','textarea')],
 'assets:maintenance-history':[fld('asset_tag','Asset tag'),fld('maintenance_type','Maintenance type'),fld('service_provider','Service provider'),fld('service_date','Service date','date'),fld('service_cost','Service cost (PKR)','number'),fld('next_due','Next service date','date')],
 'assets:warranty-register':[fld('asset_tag','Asset tag'),fld('supplier','Supplier'),fld('warranty_start','Warranty start','date'),fld('warranty_expiry','Warranty expiry','date'),fld('coverage','Coverage details','textarea'),fld('claim_status','Claim status')],
 'assets:asset-disposal':[fld('asset_tag','Asset tag'),fld('disposal_date','Disposal date','date'),fld('disposal_method','Disposal method'),fld('approved_by','Approved by'),fld('recovered_value','Recovered value (PKR)','number'),fld('disposal_notes','Disposal notes','textarea')],
 'assets:asset-reports':[fld('report_type','Report type'),fld('date_from','From date','date'),fld('date_to','To date','date'),fld('assets_scope','Asset scope'),fld('report_notes','Report notes','textarea')],
 'procurement:procurement-dashboard':[fld('open_requests','Open requests','number'),fld('pending_approvals','Pending approvals','number'),fld('orders_in_progress','Orders in progress','number'),fld('received_this_month','Received this month','number'),fld('summary_notes','Summary','textarea')],
 'procurement:supplier-directory':[fld('supplier_code','Supplier code'),fld('supplier_name','Supplier name'),fld('contact_person','Contact person'),fld('phone','Phone'),fld('email','Email','email'),fld('address','Address','textarea'),fld('supplier_status','Status','select',['Active','On hold','Inactive'])],
 'procurement:purchase-requests':[fld('request_reference','Request reference'),fld('requesting_department','Department'),fld('requested_by','Requested by'),fld('item_description','Requested item','textarea'),fld('quantity','Quantity','number'),fld('estimated_cost','Estimated cost (PKR)','number'),fld('required_by','Required by','date')],
 'procurement:quotation-comparison':[fld('request_reference','Purchase request'),fld('supplier_one','Supplier 1'),fld('quote_one','Quotation 1 (PKR)','number'),fld('supplier_two','Supplier 2'),fld('quote_two','Quotation 2 (PKR)','number'),fld('supplier_three','Supplier 3'),fld('quote_three','Quotation 3 (PKR)','number'),fld('recommended_supplier','Recommended supplier')],
 'procurement:purchase-approvals':[fld('request_reference','Request reference'),fld('requested_by','Requested by'),fld('approver','Approver'),fld('decision','Decision','select',['Pending','Approved','Rejected']),fld('decision_date','Decision date','date'),fld('decision_notes','Decision notes','textarea')],
 'procurement:purchase-orders':[fld('purchase_order','Purchase order number'),fld('supplier','Supplier'),fld('order_date','Order date','date'),fld('delivery_due','Expected delivery','date'),fld('order_amount','Order amount (PKR)','number'),fld('order_status','Status','select',['Draft','Issued','Part received','Received','Cancelled'])],
 'procurement:goods-receipt':[fld('purchase_order','Purchase order'),fld('received_date','Received date','date'),fld('received_by','Received by'),fld('quantity_ordered','Quantity ordered','number'),fld('quantity_received','Quantity received','number'),fld('inspection_result','Inspection result','select',['Accepted','Part accepted','Rejected'])],
 'procurement:supplier-invoices':[fld('supplier_invoice','Supplier invoice number'),fld('supplier','Supplier'),fld('invoice_date','Invoice date','date'),fld('due_date','Due date','date'),fld('invoice_amount','Invoice amount (PKR)','number'),fld('payment_status','Payment status','select',['Pending','Part paid','Paid'])],
 'procurement:procurement-reports':[fld('report_type','Report type'),fld('date_from','From date','date'),fld('date_to','To date','date'),fld('spend_total','Spend total (PKR)','number'),fld('report_summary','Summary','textarea')],
 'sports:activities-dashboard':[fld('active_activities','Active activities','number'),fld('registered_participants','Participants','number'),fld('upcoming_events','Upcoming events','number'),fld('recent_achievements','Recent achievements','number')],
 'sports:activity-directory':[fld('activity_code','Activity code'),fld('activity_name','Activity name'),fld('activity_type','Activity type'),fld('supervisor','Supervisor'),fld('eligibility','Eligibility'),fld('activity_status','Status','select',['Active','Seasonal','Inactive'])],
 'sports:sports-clubs':[fld('club_name','Sport / club name'),fld('club_type','Category'),fld('coach','Coach / supervisor'),fld('meeting_schedule','Schedule'),fld('venue','Venue'),fld('club_status','Status','select',['Active','Inactive'])],
 'sports:teams-members':[fld('team_name','Team name'),fld('coach','Coach'),fld('members','Members / student IDs','textarea'),fld('competition','Competition'),fld('team_status','Status','select',['Forming','Active','Completed'])],
 'sports:coaches-supervisors':[fld('staff_reference','Staff reference'),fld('coach_name','Coach / supervisor'),fld('expertise','Sport / activity expertise'),fld('contact','Contact'),fld('assignment','Assigned team / activity')],
 'sports:schedules-venues':[fld('activity_name','Activity'),fld('activity_date','Date','date'),fld('start_time','Start time','time'),fld('end_time','End time','time'),fld('venue','Venue'),fld('supervisor','Supervisor')],
 'sports:participation-records':[fld('student_reference','Student reference'),fld('activity_name','Activity'),fld('participation_date','Date','date'),fld('participation_type','Participation type'),fld('recognition','Recognition / result')],
 'sports:competitions-results':[fld('competition_name','Competition'),fld('event_date','Date','date'),fld('team_name','Team'),fld('opponent','Opponent'),fld('result','Result'),fld('score','Score')],
 'sports:achievements':[fld('student_reference','Student reference'),fld('activity_name','Activity'),fld('achievement_title','Achievement'),fld('award_date','Date','date'),fld('level','Competition level'),fld('evidence_reference','Evidence reference')],
 'sports:activity-reports':[fld('report_period','Report period'),fld('activity_name','Activity'),fld('participants','Participants','number'),fld('events_count','Events','number'),fld('report_summary','Summary','textarea')]
}

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
 backup:['reference_code','status','approval_status','record_date'],front_office:['reference_code','status','approval_status','record_date','due_date'],forms_documents:['reference_code','status','approval_status','record_date','due_date'],hostel:['reference_code','status','record_date','due_date','amount','quantity'],cafeteria:['reference_code','status','record_date','amount','quantity'],assets:['reference_code','status','record_date','amount'],procurement:['reference_code','status','approval_status','due_date','amount','quantity'],sports:['reference_code','status','record_date','due_date','quantity'], 
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
 backup:['backup_type','backup_window','integrity_check','recovery_status'],front_office:['contact_name','contact_phone','enquiry_source','assigned_to'],forms_documents:['form_category','audience','review_status','document_category'],hostel:['building_name','room_number','resident_reference','occupancy_status'],cafeteria:['menu_category','item_code','unit_price','availability'],assets:['asset_tag','asset_category','assigned_to','asset_condition'],procurement:['requesting_department','supplier','purchase_order','receiving_status'],sports:['activity_type','supervisor','venue','team_name'], 
}
const workspaceRecordLabels:Record<string,string>={
 'academic-sessions':'Academic session','classes-sections':'Class / section',subjects:'Subject',
 students:'Student',employees:'Employee',attendance:'Attendance register',behaviour:'Behaviour entry',
 certificates:'Certificate',curriculum:'Learning resource',timetable:'Timetable entry',teaching:'Learning activity',
 'question-bank':'Question',examinations:'Examination',tests:'Class test',library:'Library item',
 finance:'Ledger entry',fees:'Fee record',receivables:'Receivable',payments:'Payment',receipts:'Receipt',
 payroll:'Payroll entry',reconciliation:'Reconciliation',communication:'Communication item',
 transport:'Transport record',inventory:'Stock item',facilities:'Facility',visitors:'Visitor',
 administration:'Institution record',institution_config:'Configuration item',backup:'Data job',ai:'Insight record',front_office:'Front-office request',forms_documents:'Form / document',hostel:'Accommodation record',cafeteria:'Cafeteria item',assets:'Institutional asset',procurement:'Purchase record',sports:'Activity record',
}
const workspaceLayouts:Record<string,string>={
 administration:'governance',institution_config:'governance',backup:'governance',
 'academic-sessions':'academic','classes-sections':'academic',academic_setup:'academic',subjects:'academic',
 curriculum:'academic',timetable:'academic',teaching:'academic',question_bank:'assessment',examinations:'assessment',tests:'assessment',
 students:'people',employees:'people',attendance:'people',behaviour:'people',certificates:'people',
 finance:'ledger',fees:'ledger',receivables:'ledger',payments:'ledger',receipts:'ledger',payroll:'ledger',reconciliation:'ledger',
 communication:'communication',library:'resource',transport:'operations',inventory:'operations',facilities:'operations',visitors:'operations',
 ai:'intelligence',reports:'intelligence',front_office:'communication',forms_documents:'intelligence',my_account:'governance',hostel:'operations',cafeteria:'ledger',assets:'operations',procurement:'operations',sports:'operations',
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
 const [page,setPage]=useState(1)
 const pageSize=12
 const [range,setRange]=useState('all')
 const [campus,setCampus]=useState('')
 const [campuses,setCampuses]=useState<{id:string;name:string}[]>([])
 const [studentOptions,setStudentOptions]=useState<{id:string;name:string;reference:string}[]>([])
 const [selectedStudentId,setSelectedStudentId]=useState('')
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
 const structuredFields=itemWorkspaceFields[group.key+':'+item.key]??workspaceFields[group.key]??workspaceFields[group.dataModule]??[]
 const preferredFieldKeys=workspaceTableFieldOrder[group.key]??workspaceTableFieldOrder[group.dataModule]??structuredFields.map(field=>field.key)
 const tableFields=preferredFieldKeys.flatMap(key=>{
  const field=structuredFields.find(candidate=>candidate.key===key)
  return field?[field]:[]
 }).slice(0,4)
 const canAdmin=Boolean(user&&['owner','admin'].includes(user.role))
 const metaColumnKeys:RecordMetaKey[]=recordMetaColumnPlan[group.key]??recordMetaColumnPlan[group.dataModule]??['reference_code','status','record_date']
 const tableMetaColumns=metaColumnKeys
  .filter(key=>canViewInternalApproval(user?.role)||key!=='approval_status')
  .map(key=>({key,label:recordMetaLabels[key]}))
 const recordLabel=workspaceRecordLabels[group.key]??workspaceRecordLabels[group.dataModule]??'Record'
 const workspaceLayout=workspaceLayouts[group.key]??workspaceLayouts[group.dataModule]??'registry'
 const theme=themes[group.theme]||themes.blue
 const canWrite=Boolean(user&&(
  canAdmin||
  (user.role==='teacher'&&['academic_setup','attendance','timetable','teaching','behaviour','communication','question_bank','examinations','tests','curriculum','front_office','forms_documents','hostel','sports'].includes(group.dataModule))||
  (user.role==='accountant'&&['finance','fees','receivables','payments','receipts','payroll','reconciliation','inventory','cafeteria','assets','procurement','hostel'].includes(group.dataModule))||
  (user.role==='exam_officer'&&['question_bank','examinations','tests','reports'].includes(group.dataModule))
 ))

 const showAmount=['accounts-finance','fees','receivables','payments','receipts','payroll','reconciliation','transport','inventory'].includes(group.key)||['finance','fees','receivables','payments','receipts','payroll','reconciliation'].includes(group.dataModule)
 const showQuantity=['classes-sections','library','transport','inventory','facilities'].includes(group.key)
 const showDueDate=['academic-sessions','fees','receivables','timetable','teaching','examinations','class-tests','reports','certificates','transport','facilities','visitors','backup'].includes(group.key)||['fees','receivables','timetable','teaching','examinations','tests','reports','certificates'].includes(group.dataModule)
 const showPortalVisibility=['communication','front-office','forms-documents','curriculum','certificates','teaching','library','transport','behaviour'].includes(group.key)
 
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
   const visibleRows=(data??[]) as OperationalRow[]
   const portalRows=['parent','student'].includes(user.role)?visibleRows.filter(row=>row.visibility==='institution_portal'||Boolean(row.student_id)):visibleRows
   setRows(portalRows)
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
 useEffect(()=>{
  let live=true
  async function loadStudentOptions(){
   if(!supabase||!user||!showPortalVisibility||!canWrite){setStudentOptions([]);return}
   const {data,error}=await supabase.from('students').select('id,full_name,admission_no').eq('institution_id',user.institutionId).order('full_name').limit(500)
   if(error){if(live)setStudentOptions([]);return}
   if(live)setStudentOptions((data??[]).map(row=>({id:String(row.id),name:String(row.full_name??'Unnamed student'),reference:String(row.admission_no??'')})))
  }
  void loadStudentOptions()
  return()=>{live=false}
 },[user?.id,user?.institutionId,showPortalVisibility,canWrite])

 const filtered=useMemo(()=>{
  const q=search.trim().toLowerCase()
  return rows.filter(row=>!q||[row.title,row.reference_code,row.status,row.description,row.record_type].some(value=>String(value??'').toLowerCase().includes(q)))
 },[rows,search])
 const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize))
 const currentPage=Math.min(page,pageCount)
 const pageRows=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize)
 useEffect(()=>{setPage(1)},[search,range,campus,selectedItem])
 const dashboard= isOverview(item.key,item.label)
 const reviewMetrics=useMemo(()=>getWorkspaceReviewMetrics(rows,user?.role),[rows,user?.role])
 const pendingReviewCount=reviewMetrics.pendingCount
 const overdue=rows.filter(row=>row.due_date&&row.due_date<new Date().toISOString().slice(0,10)&&!['completed','cancelled','closed','approved'].includes(row.status)).length
 const totalAmount=rows.reduce((sum,row)=>sum+Number(row.amount??0),0)
 const statusCounts=reviewMetrics.statusCounts

 function resetForm(row?:OperationalRow){
  setEditing(row??null);setTitle(row?.title??'');setReference(row?.reference_code??'');setDescription(row?.description??'')
  setStatus(row?.status??'draft');setApproval(row?.approval_status??'not_required');setVisibility(row?.visibility??(['library','curriculum','certificates','teaching','transport'].includes(group.key)?'student_portal':'staff_only'))
  setRecordDate(row?.record_date??new Date().toISOString().slice(0,10));setDueDate(row?.due_date??'')
  setAmount(row?.amount===null||row?.amount===undefined?'':String(row.amount));setQuantity(row?.quantity===null||row?.quantity===undefined?'':String(row.quantity))
  setPayloadData(row?.payload??{});setSelectedStudentId(String(row?.student_id??''));setShowForm(true)
 }
 async function save(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user)return
  const payload:Record<string,unknown>={...payloadData}
  for(const field of structuredFields){if(field.type==='number'&&payload[field.key]!==undefined&&payload[field.key]!==''&&payload[field.key]!==null){const numeric=Number(payload[field.key]);if(!Number.isFinite(numeric)){onToast(field.label+' must be a valid number.',true);return}payload[field.key]=numeric}}
  if(amount.trim()&&(!Number.isFinite(Number(amount))||Number(amount)<0)){onToast('Amount must be a valid non-negative number.',true);return}
  if(quantity.trim()&&(!Number.isFinite(Number(quantity))||Number(quantity)<0)){onToast('Quantity must be a valid non-negative number.',true);return}
  if(['student_portal','parent_portal'].includes(visibility)&&!selectedStudentId){onToast('Select the student this private portal record belongs to.',true);return}
  setSaving(true)
  const values={
   institution_id:user.institutionId,module_key:group.dataModule,record_type:item.key,title:title.trim(),
   reference_code:reference.trim()||null,description:description.trim()||null,status,approval_status:approval,visibility,
   record_date:recordDate||null,due_date:dueDate||null,amount:amount.trim()?Number(amount):null,
   quantity:quantity.trim()?Number(quantity):null,payload,campus_id:campus||null,student_id:selectedStudentId||null
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
 const columns=getWorkspaceExportColumns(user?.role,[...exportColumns,...structuredFields.map(field=>({key:field.key,label:field.label}))])
 const exportRows=getWorkspaceExportRows(user?.role,filtered.map(row=>({...row,...row.payload}) as Record<string,unknown>))
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
   {pendingReviewCount!==null&&<article><span>Pending review</span><strong>{loading?'—':pendingReviewCount.toLocaleString()}</strong><small>Draft and pending approvals</small></article>}
   <article><span>Overdue items</span><strong>{loading?'—':overdue.toLocaleString()}</strong><small>Past due date, not closed</small></article>
   <article><span>Recorded value</span><strong>{loading?'—':money(totalAmount)}</strong><small>Only where records have a numeric amount</small></article>
  </section>}
  {dashboard&&<section className="ed360-workspace-chart">
   <div className="ed360-workspace-section-title"><div><span>LIVE DISTRIBUTION</span><h3>Workflow status</h3></div><span>Calculated from loaded records</span></div>
   {statusCounts.length?statusCounts.map(s=><div className="ed360-workspace-bar" key={s.status}><label>{s.status.replaceAll('_',' ')}</label><div><i style={{width:Math.max(2,(s.count/Math.max(1,rows.length))*100)+'%'}}/></div><b>{s.count}</b></div>):<p className="ed360-workspace-empty-inline">No workflow statuses have been recorded in this module yet.</p>}
  </section>}
  <section className="table-card ed360-workspace-record-card">
   <div className="table-toolbar"><div className="table-count"><strong>{filtered.length.toLocaleString()}</strong> {item.label.toLowerCase()} <span>·</span> Institution scope</div><span className="ed360-table-refresh"><button type="button" onClick={()=>void load()}>Refresh records <ArrowUpRight size={13}/></button></span></div>
   {loading?<div className="ed360-workspace-empty">Loading institution records…</div>:filtered.length===0?<div className="ed360-workspace-empty"><strong>No records in this workspace yet</strong><span>Records appear here after an authorised user creates them through this workspace. No sample data is being shown.</span>{canWrite&&<button type="button" className="button button-primary" onClick={()=>resetForm()}><Plus size={15}/> Create first record</button>}</div>:
   <div className="table-scroll"><table aria-label={group.label+' '+item.label+' register'}><thead><tr><th scope="col">{recordLabel}</th>{tableMetaColumns.map(column=><th key={column.key} scope="col" data-column={column.key}>{column.label}</th>)}{tableFields.map(field=><th key={field.key} scope="col">{field.label}</th>)}<th scope="col">Actions</th></tr></thead><tbody>
    {pageRows.map(row=><tr key={row.id}><td><button className="ed360-record-open" type="button" onClick={()=>setDetail(row)}>{row.title}</button><small className="ed360-record-subtitle">{row.description||row.record_type.replaceAll('-',' ')}</small></td>{tableMetaColumns.map(column=><td key={column.key} data-column={column.key}>{column.key==='reference_code'?row.reference_code||'—':column.key==='status'?<span className={'ed360-state-pill state-'+row.status}>{row.status.replaceAll('_',' ')}</span>:column.key==='approval_status'?row.approval_status.replaceAll('_',' '):column.key==='record_date'?displayDate(row.record_date):column.key==='due_date'?displayDate(row.due_date):column.key==='amount'?money(row.amount):row.quantity??'—'}</td>)}{tableFields.map(field=><td key={field.key} data-column={field.key}>{String(row.payload?.[field.key]??'—')}</td>)}<td><div className="ed360-row-actions"><button type="button" onClick={()=>setDetail(row)}>Open</button>{canWrite&&<button type="button" onClick={()=>resetForm(row)}>Edit</button>}</div></td></tr>)}
   </tbody></table></div>}
   {!loading&&filtered.length>pageSize&&<div className="ed360-record-pagination"><span>Showing <b>{(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize,filtered.length)}</b> of <b>{filtered.length}</b> records</span><div><button type="button" disabled={currentPage<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" disabled={currentPage>=pageCount} onClick={()=>setPage(value=>Math.min(pageCount,value+1))}>Next</button></div></div>}
  </section>
  {showForm&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShowForm(false)}}><section className="modal-card ed360-context-form" role="dialog" aria-modal="true" aria-labelledby="ed360-form-heading">
   <div className="modal-heading"><div><div className="eyebrow">{group.label.toUpperCase()} / {item.label.toUpperCase()}</div><h2 id="ed360-form-heading">{editing?'Edit':'Create'} {item.label}</h2><p>This form saves a real institution-scoped record.</p></div><button type="button" className="icon-button" onClick={()=>setShowForm(false)} aria-label="Close"><X size={18}/></button></div>
   <form onSubmit={save} className="ed360-context-form-grid">
    <label>Record title *<input required value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} placeholder={'Enter '+item.label.toLowerCase()}/></label>
    <label>Reference / number<input value={reference} onChange={e=>setReference(e.target.value)} maxLength={80} placeholder="Optional reference"/></label>
    <label>Description / notes<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} maxLength={3000}/></label>
    <div className="ed360-form-row"><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{statusOptions.map(s=><option value={s} key={s}>{s.replaceAll('_',' ')}</option>)}</select></label>{canAdmin&&<label>Approval<select value={approval} onChange={e=>setApproval(e.target.value)}><option value="not_required">Not required</option><option value="draft">Draft</option><option value="pending">Needs approval</option></select></label>}</div>
    <div className="ed360-form-row"><label>Record date<input type="date" value={recordDate} onChange={e=>setRecordDate(e.target.value)}/></label>{showDueDate&&<label>Due date<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label>}</div>
    {showPortalVisibility&&<div className="ed360-form-row"><label>Portal visibility<select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="staff_only">Staff only</option><option value="student_portal">Student portal (one linked student)</option><option value="parent_portal">Parent portal (one linked student)</option><option value="institution_portal">Institution portal (shared notice)</option></select><small>Student and parent portal records are linked to one student. Institution-wide notices use the shared institution portal.</small></label>{canWrite&&visibility!=='staff_only'&&visibility!=='institution_portal'&&<label>Linked student *<select required value={selectedStudentId} onChange={e=>setSelectedStudentId(e.target.value)}><option value="">Select the relevant student</option>{studentOptions.map(student=><option key={student.id} value={student.id}>{student.name}{student.reference?' · '+student.reference:''}</option>)}</select><small>Only permitted linked guardians/students can read this portal record.</small></label>}</div>}
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
