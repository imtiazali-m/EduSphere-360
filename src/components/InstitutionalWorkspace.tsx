import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { CheckCircle2, Download, FileSpreadsheet, FileText, Filter, Plus, Printer, RefreshCw, Search, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { getWorkspaceGroup, getWorkspaceItem, institutionalMenu } from '../lib/institutionalCatalog'
import { exportDocx, exportXlsx, printOfficeReport, type OfficeColumn } from '../lib/officeExport'
import { downloadCsv } from '../lib/csv'
import { canViewInternalApproval, getWorkspaceExportColumns, getWorkspaceExportRows, getWorkspaceReviewMetrics } from '../lib/workspacePrivacy.js'
import type { RecordRow } from '../lib/types'
import { getWorkspaceExperience, getWorkspaceFields } from '../lib/workspaceExperience'

type OperationalRow = RecordRow & {
 module_key:string;record_type:string;title:string;reference_code?:string|null;description?:string|null;
 status:string;approval_status:string;record_date?:string|null;due_date?:string|null;amount?:number|null;
 quantity?:number|null;payload:Record<string,unknown>;visibility:string
}
type Props={workspaceKey:string;onToast:(message:string,error?:boolean)=>void}
type WorkspaceField={key:string;label:string;type?:'text'|'email'|'date'|'number'|'time'|'datetime-local'|'url'|'textarea'|'select';options?:string[];placeholder?:string}
const fld=(key:string,label:string,type:WorkspaceField['type']='text',options?:string[]):WorkspaceField=>({key,label,type,options})
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


/** Purpose-built field contracts for submenu-specific operational registers. */
const completionItemFields:Record<string,WorkspaceField[]> = {
  // Backup, import, export and recovery (job records; execution requires a platform service)
  'backup:create-backup':[fld('backup_scope','Backup scope','select',['Database records','Private files','Full institution']),fld('export_format','Format','select',['JSON','CSV']),fld('requested_at','Requested at','datetime-local'),fld('job_status','Job status','select',['Requested','Awaiting platform service','Completed','Failed'])],
  'backup:scheduled-cloud-backups':[fld('frequency','Frequency','select',['Daily','Weekly','Monthly']),fld('run_at','Run time','time'),fld('retention_days','Retention days','number'),fld('enabled','Schedule status','select',['Enabled','Paused'])],
  'backup:backup-history':[fld('backup_reference','Backup reference'),fld('backup_scope','Backup scope'),fld('archive_size','Archive size (MB)','number'),fld('checksum','Integrity checksum'),fld('completed_at','Completed at','datetime-local')],
  'backup:restore-data':[fld('backup_reference','Source backup reference'),fld('restore_scope','Restore scope','select',['Selected records','Module','Full institution']),fld('restore_point','Restore point','datetime-local'),fld('approval_reference','Approval reference'),fld('validation_result','Pre-restore validation','select',['Not checked','Passed','Failed'])],
  'backup:data-recovery':[fld('incident_reference','Incident reference'),fld('affected_area','Affected module / data'),fld('recovery_point','Recovery point','datetime-local'),fld('recovery_action','Recovery action','textarea'),fld('verification_result','Verification','select',['Pending','Passed','Failed'])],
  'backup:import-data':[fld('source_file','Source file name'),fld('target_module','Target module'),fld('field_mapping','Field mapping','textarea'),fld('rows_valid','Valid rows','number'),fld('import_status','Import status','select',['Draft','Validated','Ready for review','Imported','Rejected'])],
  'backup:export-data':[fld('export_scope','Export scope'),fld('file_format','Format','select',['CSV','JSON','XLSX']),fld('date_from','From date','date'),fld('date_to','To date','date'),fld('export_status','Status','select',['Requested','Ready','Failed'])],
  'backup:bulk-data-import':[fld('entity_type','Record type'),fld('source_filename','Filename'),fld('column_mapping','Column mapping','textarea'),fld('row_count','Rows in file','number'),fld('rejected_rows','Rejected rows','number'),fld('validation_status','Validation','select',['Not checked','Passed','Issues found'])],
  'backup:data-validation':[fld('dataset','Dataset / module'),fld('rule_set','Validation rules','textarea'),fld('records_checked','Records checked','number'),fld('errors_found','Errors','number'),fld('validation_status','Result','select',['Pending','Passed','Issues found','Failed'])],
  'backup:import-history':[fld('source_filename','Source filename'),fld('target_module','Imported module'),fld('rows_created','Rows created','number'),fld('rows_updated','Rows updated','number'),fld('rows_rejected','Rows rejected','number')],
  'backup:export-history':[fld('export_reference','Export reference'),fld('data_scope','Data scope'),fld('file_format','File format'),fld('row_count','Rows exported','number'),fld('requested_by','Requested by')],
  'backup:data-integrity-reports':[fld('report_period','Report period'),fld('modules_checked','Modules checked','textarea'),fld('checks_passed','Checks passed','number'),fld('issues_found','Issues found','number'),fld('recommendations','Recommended action','textarea')],
  'backup:duplicate-detection':[fld('record_type','Record type'),fld('match_fields','Matching fields','textarea'),fld('candidate_count','Potential matches','number'),fld('review_outcome','Review outcome','select',['Needs review','Confirmed duplicate','Not a duplicate','Resolved'])],
  'backup:integration-status':[fld('service_name','Connected service'),fld('integration_type','Integration type'),fld('last_checked','Last checked','datetime-local'),fld('connection_status','Connection status','select',['Not configured','Connected','Needs attention','Failed']),fld('latest_issue','Latest issue','textarea')],

  // Behaviour, competency and student development
  'behaviour:student-skills':[fld('student_reference','Student / admission ID'),fld('skill_domain','Skill domain'),fld('skill_name','Skill / competency'),fld('rating','Rating','select',['Beginning','Developing','Proficient','Advanced']),fld('evidence','Observed evidence','textarea')],
  'behaviour:co-curricular-activities':[fld('student_reference','Student reference'),fld('activity_name','Activity'),fld('participation_role','Role'),fld('activity_date','Activity date','date'),fld('outcome','Outcome / achievement','textarea')],
  'behaviour:competency-tracking':[fld('student_reference','Student reference'),fld('competency','Competency'),fld('proficiency','Proficiency','select',['Not assessed','Emerging','Developing','Secure','Exceeding']),fld('evidence_reference','Evidence reference'),fld('assessed_on','Assessed on','date')],
  'behaviour:student-progress-history':[fld('student_reference','Student reference'),fld('review_period','Review period'),fld('strengths','Strengths','textarea'),fld('development_targets','Development targets','textarea'),fld('next_review','Next review','date')],
  'behaviour:behaviour-analytics':[fld('report_period','Reporting period'),fld('cohort','Class / cohort'),fld('event_category','Category'),fld('record_count','Records included','number'),fld('analysis_notes','Interpretation and limitations','textarea')],
  'behaviour:downloadable-behaviour-reports':[fld('report_type','Report type','select',['Student summary','Class summary','Recognition','Follow-up']),fld('date_from','From date','date'),fld('date_to','To date','date'),fld('student_reference','Student / cohort'),fld('file_reference','Generated file reference')],

  // Certificates, ID documents, templates and forms
  'certificates:experience-certificate':[fld('employee_reference','Employee ID'),fld('employee_name','Employee name'),fld('designation','Designation'),fld('employment_start','Employment start','date'),fld('employment_end','Employment end','date'),fld('issue_date','Issue date','date')],
  'certificates:id-card-designer':[fld('card_name','ID card template'),fld('audience','Audience','select',['Student','Teacher','Employee','Visitor']),fld('front_layout','Front layout fields','textarea'),fld('back_layout','Back layout fields','textarea'),fld('template_status','Status','select',['Draft','Active','Archived'])],
  'certificates:certificate-templates':[fld('template_name','Template name'),fld('certificate_type','Certificate type'),fld('template_version','Version'),fld('body_content','Certificate wording','textarea'),fld('signatory','Authorised signatory'),fld('template_status','Status','select',['Draft','Active','Archived'])],
  'certificates:editable-document-templates':[fld('template_name','Template name'),fld('document_type','Document type'),fld('merge_fields','Merge fields','textarea'),fld('document_body','Document body','textarea'),fld('version','Version'),fld('template_status','Status','select',['Draft','Active','Archived'])],
  'certificates:bulk-certificate-generation':[fld('certificate_type','Certificate type'),fld('selection_rule','Student selection / class'),fld('issue_date','Issue date','date'),fld('record_count','Records selected','number'),fld('job_status','Generation status','select',['Draft','Awaiting review','Ready','Completed','Failed'])],
  'certificates:certificate-history':[fld('certificate_number','Certificate number'),fld('recipient_reference','Student / employee reference'),fld('certificate_type','Certificate type'),fld('issue_date','Issue date','date'),fld('verification_code','Verification code')],
  'certificates:form-builder':[fld('form_name','Form name'),fld('form_purpose','Purpose'),fld('field_schema','Fields and validation','textarea'),fld('audience','Who can submit','select',['Students','Parents','Teachers','Employees']),fld('submission_deadline','Deadline','date'),fld('publication_status','Status','select',['Draft','Published','Closed'])],
  'certificates:form-submissions':[fld('form_name','Form name'),fld('submission_reference','Submission reference'),fld('submitted_by','Submitted by'),fld('submitted_at','Submitted at','datetime-local'),fld('reviewer','Reviewer'),fld('review_status','Review status','select',['Received','Under review','Needs correction','Approved','Rejected'])],
  'certificates:letters-applications':[fld('document_type','Letter / application type'),fld('recipient','Recipient'),fld('reference_number','Reference number'),fld('issue_date','Date','date'),fld('document_body','Letter / application content','textarea'),fld('approval_status','Status','select',['Draft','Pending approval','Approved','Rejected','Issued'])],

  // Library reading journeys
  'library:reading-records':[fld('student_reference','Student / reader'),fld('book_reference','Book / ISBN'),fld('reading_start','Started on','date'),fld('reading_end','Completed on','date'),fld('pages_read','Pages read','number'),fld('reading_notes','Reading notes','textarea')],
  'library:reading-cards':[fld('card_number','Reading card number'),fld('student_reference','Student reference'),fld('issued_on','Issued on','date'),fld('expires_on','Expires on','date'),fld('card_status','Status','select',['Active','Suspended','Expired','Returned'])],
  'library:student-reading-history':[fld('student_reference','Student reference'),fld('book_reference','Book reference'),fld('activity_type','Activity','select',['Issued','Returned','Renewed','Reading completed']),fld('activity_date','Activity date','date'),fld('notes','Notes','textarea')],

  // Online payment transaction reconciliation; no payment gateway is implied
  'payments:online-payment-records':[fld('gateway_name','Payment gateway'),fld('transaction_id','Gateway transaction ID'),fld('invoice_reference','Invoice reference'),fld('student_reference','Student reference'),fld('paid_amount','Amount (PKR)','number'),fld('gateway_status','Provider status','select',['Created','Pending','Succeeded','Failed','Reversed'])],

  // Receipt templates and batch controls
  'receipts:receipt-templates':[fld('template_name','Receipt template'),fld('template_version','Version'),fld('header_content','Header content','textarea'),fld('footer_content','Footer / signatory','textarea'),fld('numbering_format','Number format'),fld('template_status','Status','select',['Draft','Active','Archived'])],
  'receipts:receipt-numbering':[fld('series_name','Numbering series'),fld('prefix','Prefix'),fld('next_number','Next number','number'),fld('number_width','Number width','number'),fld('effective_from','Effective from','date'),fld('series_status','Status','select',['Active','Paused','Closed'])],
  'receipts:bulk-receipt-generation':[fld('generation_batch','Batch reference'),fld('date_from','Payment from','date'),fld('date_to','Payment to','date'),fld('payment_filter','Payment selection'),fld('receipts_requested','Receipts selected','number'),fld('batch_status','Batch status','select',['Draft','Ready for review','Generated','Failed'])],
  'receipts:receipt-verification':[fld('receipt_number','Receipt number'),fld('verification_code','Verification code'),fld('verified_by','Verified by'),fld('verification_date','Verified at','datetime-local'),fld('verification_result','Result','select',['Pending','Verified','Not found','Revoked'])],

  // Communication registers. Actual email/SMS/WhatsApp delivery requires provider credentials.
  'communication:whatsapp-integration':[fld('provider_name','WhatsApp provider'),fld('business_account','Business account reference'),fld('phone_number_id','Phone number ID'),fld('webhook_status','Webhook status','select',['Not configured','Pending verification','Connected','Failed']),fld('secret_reference','Secret reference (do not paste secrets)'),fld('last_delivery_test','Last delivery test','datetime-local')],
  'communication:individual-messages':[fld('recipient_role','Recipient role','select',['Parent','Student','Teacher','Employee']),fld('recipient_reference','Recipient account / student reference'),fld('channel','Channel','select',['In-app','Email','WhatsApp','SMS']),fld('message_subject','Subject'),fld('message_body','Message','textarea'),fld('send_status','Status','select',['Draft','Queued','Sent','Delivered','Failed'])],
  'communication:bulk-messages':[fld('audience','Audience','select',['All students','Parents','Teachers','Employees','Selected class']),fld('filter_rule','Audience selection rule','textarea'),fld('channel','Channel','select',['In-app','Email','WhatsApp','SMS']),fld('message_subject','Subject'),fld('message_body','Message','textarea'),fld('batch_status','Batch status','select',['Draft','Review','Queued','Sent','Failed'])],
  'communication:class-wise-messaging':[fld('class_reference','Class / section'),fld('recipient_group','Recipients','select',['Parents','Students','Both']),fld('channel','Channel','select',['In-app','Email','WhatsApp']),fld('message_subject','Subject'),fld('message_body','Message','textarea'),fld('delivery_status','Status','select',['Draft','Queued','Sent','Failed'])],
  'communication:employee-notifications':[fld('employee_reference','Employee / staff reference'),fld('notification_type','Notification type'),fld('channel','Channel','select',['In-app','Email','SMS']),fld('message_body','Notification text','textarea'),fld('scheduled_at','Scheduled at','datetime-local'),fld('delivery_status','Status','select',['Draft','Queued','Sent','Delivered','Failed'])],
  'communication:message-templates':[fld('template_name','Template name'),fld('channel','Channel','select',['In-app','Email','WhatsApp','SMS']),fld('subject_template','Subject template'),fld('body_template','Message body','textarea'),fld('merge_fields','Allowed merge fields','textarea'),fld('template_status','Status','select',['Draft','Active','Archived'])],
  'communication:email-notifications':[fld('recipient_group','Recipient group'),fld('email_subject','Email subject'),fld('email_body','Email body','textarea'),fld('scheduled_at','Schedule time','datetime-local'),fld('delivery_status','Status','select',['Draft','Queued','Sent','Delivered','Failed'])],
  'communication:delivery-history':[fld('message_reference','Message / batch reference'),fld('channel','Delivery channel'),fld('recipient_count','Recipients','number'),fld('delivered_count','Delivered','number'),fld('failed_count','Failed','number'),fld('last_attempt','Last attempt','datetime-local')],
  'communication:communication-logs':[fld('event_type','Log event'),fld('channel','Channel'),fld('provider_reference','Provider reference'),fld('event_time','Event time','datetime-local'),fld('result','Result'),fld('detail','Details','textarea')],
  'communication:communication-reports':[fld('report_period','Report period'),fld('channel','Channel'),fld('messages_total','Messages','number'),fld('delivered_total','Delivered','number'),fld('failed_total','Failed','number'),fld('report_notes','Analysis notes','textarea')],
  'communication:parent-communication':[fld('student_reference','Linked student'),fld('guardian_reference','Parent / guardian'),fld('conversation_subject','Subject'),fld('message_body','Message','textarea'),fld('last_response_at','Last response','datetime-local'),fld('conversation_status','Status','select',['Open','Waiting','Responded','Closed'])],
  'communication:internal-messages':[fld('recipient','Recipient / team'),fld('message_subject','Subject'),fld('message_body','Message','textarea'),fld('attachment_reference','Attachment reference'),fld('sent_at','Sent at','datetime-local'),fld('message_status','Status','select',['Draft','Sent','Archived'])],
  'communication:complaints-helpdesk':[fld('requester','Submitted by'),fld('requester_role','Role'),fld('category','Category','select',['Academic','Finance','Facilities','Transport','Safety','Technical','Other']),fld('priority','Priority','select',['Low','Normal','High','Urgent']),fld('assigned_to','Assigned team / staff'),fld('resolution_notes','Resolution notes','textarea'),fld('request_status','Status','select',['Open','Assigned','In progress','Waiting','Resolved','Closed'])],

  // Transport boarding register
  'transport:transport-attendance':[fld('service_date','Service date','date'),fld('route_reference','Route'),fld('vehicle_reference','Vehicle'),fld('stop_reference','Boarding stop'),fld('student_reference','Student / admission ID'),fld('boarding_status','Boarding status','select',['Boarded','Absent','Late','Alighted']),fld('recorded_at','Recorded at','datetime-local')],

  // Cafeteria and procurement
  'inventory:cafeteria-dashboard':[fld('report_period','Report period'),fld('sales_total','Sales total (PKR)','number'),fld('transactions','Transactions','number'),fld('low_stock_count','Low-stock items','number'),fld('summary','Operational summary','textarea')],
  'inventory:menu-price-list':[fld('item_code','Menu item code'),fld('item_name','Menu item'),fld('category','Category'),fld('unit_price','Price (PKR)','number'),fld('dietary_notes','Dietary / allergen information','textarea'),fld('availability','Availability','select',['Available','Unavailable','Seasonal'])],
  'inventory:daily-availability':[fld('menu_item','Menu item'),fld('service_date','Service date','date'),fld('available_quantity','Available quantity','number'),fld('sold_quantity','Sold quantity','number'),fld('availability','Status','select',['Available','Sold out','Unavailable'])],
  'inventory:sales-transactions':[fld('transaction_reference','Transaction reference'),fld('transaction_time','Transaction time','datetime-local'),fld('buyer_reference','Student / staff ID'),fld('items_summary','Items and quantities','textarea'),fld('total_amount','Total amount (PKR)','number'),fld('payment_method','Payment method','select',['Cash','Card','Account','Other'])],
  'inventory:meal-plans':[fld('plan_name','Meal plan'),fld('duration','Duration'),fld('included_meals','Meals included','textarea'),fld('price','Plan price (PKR)','number'),fld('eligibility','Eligible users'),fld('plan_status','Status','select',['Active','Inactive','Archived'])],
  'inventory:cafeteria-inventory':[fld('stock_code','Stock item code'),fld('supplier','Supplier'),fld('quantity_on_hand','Quantity on hand','number'),fld('reorder_level','Reorder level','number'),fld('unit_cost','Unit cost (PKR)','number'),fld('expiry_date','Expiry date','date')],
  'inventory:cafeteria-reports':[fld('report_type','Report type'),fld('date_from','From date','date'),fld('date_to','To date','date'),fld('revenue','Revenue (PKR)','number'),fld('waste_summary','Waste / stock usage summary','textarea')],
  'inventory:supplier-directory':[fld('supplier_code','Supplier code'),fld('supplier_name','Supplier name'),fld('contact_person','Contact person'),fld('phone','Phone'),fld('email','Email','email'),fld('supplier_status','Status','select',['Active','On hold','Inactive'])],
  'inventory:purchase-requests':[fld('request_reference','Request reference'),fld('department','Requesting department'),fld('requested_by','Requested by'),fld('item_description','Requested items','textarea'),fld('quantity','Quantity','number'),fld('estimated_cost','Estimated cost (PKR)','number'),fld('required_by','Required by','date')],
  'inventory:quotation-comparison':[fld('request_reference','Purchase request'),fld('supplier_a','Supplier A'),fld('quote_a','Quote A (PKR)','number'),fld('supplier_b','Supplier B'),fld('quote_b','Quote B (PKR)','number'),fld('supplier_c','Supplier C'),fld('quote_c','Quote C (PKR)','number'),fld('recommended_supplier','Recommended supplier')],
  'inventory:purchase-approvals':[fld('request_reference','Request reference'),fld('requested_by','Requested by'),fld('approver','Approver'),fld('decision','Decision','select',['Pending','Approved','Rejected']),fld('decision_date','Decision date','date'),fld('decision_notes','Decision notes','textarea')],
  'inventory:purchase-orders':[fld('purchase_order','Purchase order number'),fld('supplier','Supplier'),fld('order_date','Order date','date'),fld('delivery_date','Expected delivery','date'),fld('order_total','Order total (PKR)','number'),fld('order_status','Status','select',['Draft','Issued','Part received','Received','Cancelled'])],
  'inventory:goods-receipt':[fld('purchase_order','Purchase order'),fld('received_date','Received date','date'),fld('received_by','Received by'),fld('quantity_ordered','Quantity ordered','number'),fld('quantity_received','Quantity received','number'),fld('inspection_result','Inspection result','select',['Accepted','Part accepted','Rejected'])],
  'inventory:supplier-invoices':[fld('supplier_invoice','Supplier invoice number'),fld('supplier','Supplier'),fld('invoice_date','Invoice date','date'),fld('due_date','Due date','date'),fld('invoice_amount','Invoice amount (PKR)','number'),fld('payment_status','Payment status','select',['Pending','Part paid','Paid'])],
  'inventory:procurement-reports':[fld('report_type','Report type'),fld('date_from','From date','date'),fld('date_to','To date','date'),fld('spend_total','Spend total (PKR)','number'),fld('report_summary','Report summary','textarea')],

  // Facilities, hostel and assets
  'facilities:room-reservations':[fld('room_reference','Room / venue'),fld('reservation_title','Reservation title'),fld('requested_by','Requested by'),fld('start_at','Start time','datetime-local'),fld('end_at','End time','datetime-local'),fld('reservation_status','Status','select',['Requested','Approved','Rejected','Cancelled'])],
  'facilities:facilities-reports':[fld('report_period','Report period'),fld('facility_type','Facility type'),fld('maintenance_open','Open maintenance items','number'),fld('rooms_unavailable','Unavailable rooms','number'),fld('report_notes','Summary','textarea')],
  'facilities:hostel-dashboard':[fld('hostel_name','Hostel / residence'),fld('total_beds','Total beds','number'),fld('occupied_beds','Occupied beds','number'),fld('vacant_beds','Vacant beds','number'),fld('occupancy_note','Occupancy notes','textarea')],
  'facilities:hostel-buildings':[fld('building_code','Building code'),fld('building_name','Building name'),fld('warden','Warden / supervisor'),fld('address','Address','textarea'),fld('floor_count','Floors','number'),fld('building_status','Status','select',['Active','Maintenance','Inactive'])],
  'facilities:room-bed-register':[fld('building','Building'),fld('floor','Floor'),fld('room_number','Room number'),fld('bed_number','Bed number'),fld('capacity','Room capacity','number'),fld('room_status','Status','select',['Available','Part occupied','Full','Maintenance'])],
  'facilities:resident-allocation':[fld('student_reference','Student / resident ID'),fld('building','Building'),fld('room_number','Room number'),fld('bed_number','Bed number'),fld('check_in','Check-in date','date'),fld('expected_checkout','Expected check-out','date')],
  'facilities:room-transfers':[fld('resident_reference','Resident reference'),fld('from_room','Current room'),fld('to_room','New room'),fld('transfer_date','Transfer date','date'),fld('reason','Transfer reason','textarea'),fld('approval_reference','Approval reference')],
  'facilities:check-in-check-out':[fld('resident_reference','Resident reference'),fld('movement','Movement','select',['Check-in','Temporary exit','Return','Check-out']),fld('movement_time','Date / time','datetime-local'),fld('authorised_by','Authorised by'),fld('notes','Movement notes','textarea')],
  'facilities:hostel-visitor-register':[fld('visitor_name','Visitor name'),fld('resident_reference','Resident being visited'),fld('relationship','Relationship'),fld('purpose','Visit purpose','textarea'),fld('entry_time','Entry time','datetime-local'),fld('exit_time','Exit time','datetime-local')],
  'facilities:hostel-fees':[fld('resident_reference','Resident reference'),fld('billing_period','Billing period'),fld('fee_amount','Accommodation fee (PKR)','number'),fld('due_date','Due date','date'),fld('payment_reference','Payment reference'),fld('payment_status','Status','select',['Pending','Part paid','Paid','Waived'])],
  'facilities:accommodation-maintenance':[fld('building','Building'),fld('room_number','Room'),fld('reported_by','Reported by'),fld('issue_type','Issue type'),fld('priority','Priority','select',['Low','Normal','High','Urgent']),fld('assigned_to','Assigned technician'),fld('request_status','Status','select',['Open','Assigned','In progress','Resolved','Closed'])],
  'facilities:occupancy-reports':[fld('report_period','Report period'),fld('building','Building'),fld('total_beds','Total beds','number'),fld('occupied_beds','Occupied beds','number'),fld('vacant_beds','Vacant beds','number'),fld('occupancy_rate','Occupancy rate (%)','number')],
  'facilities:asset-assignment':[fld('asset_tag','Asset tag'),fld('assigned_to','Assigned person / department'),fld('assigned_date','Assigned date','date'),fld('condition_at_issue','Condition at issue'),fld('expected_return','Expected return','date')],
  'facilities:asset-transfers':[fld('asset_tag','Asset tag'),fld('from_location','From location'),fld('to_location','To location'),fld('transfer_date','Transfer date','date'),fld('authorised_by','Authorised by'),fld('transfer_reason','Transfer reason','textarea')],
  'facilities:asset-warranty':[fld('asset_tag','Asset tag'),fld('supplier','Supplier'),fld('warranty_start','Warranty start','date'),fld('warranty_expiry','Warranty expiry','date'),fld('coverage','Coverage details','textarea'),fld('claim_status','Claim status')],
  'facilities:asset-disposal':[fld('asset_tag','Asset tag'),fld('disposal_date','Disposal date','date'),fld('disposal_method','Disposal method'),fld('approved_by','Approved by'),fld('recovered_value','Recovered value (PKR)','number'),fld('disposal_notes','Disposal notes','textarea')],
  'facilities:asset-reports':[fld('report_type','Report type'),fld('date_from','From date','date'),fld('date_to','To date','date'),fld('asset_scope','Asset scope'),fld('report_notes','Report notes','textarea')],

  // Visitor approvals / notifications / review
  'visitors:visitor-approvals':[fld('visitor_reference','Visitor entry reference'),fld('visitor_name','Visitor name'),fld('host_reference','Host / staff member'),fld('visit_date','Visit date','date'),fld('decision','Decision','select',['Pending','Approved','Rejected']),fld('decision_notes','Decision notes','textarea')],
  'visitors:visitor-notifications':[fld('visitor_reference','Visitor entry reference'),fld('recipient','Notify'),fld('notification_channel','Channel','select',['In-app','Email','SMS']),fld('message','Notification text','textarea'),fld('sent_at','Sent at','datetime-local'),fld('delivery_status','Status','select',['Draft','Queued','Sent','Delivered','Failed'])],
  'visitors:visitor-reports':[fld('date_from','From date','date'),fld('date_to','To date','date'),fld('visitor_type','Visitor category'),fld('visit_count','Visits','number'),fld('denied_count','Denied visits','number'),fld('report_notes','Summary','textarea')],

  // Custom and scheduled report definitions (scheduling requires a server runner)
  'reports:custom-report-builder':[fld('report_name','Report name'),fld('source_module','Data source'),fld('selected_fields','Selected fields','textarea'),fld('filter_rules','Filter rules','textarea'),fld('grouping','Group / sort fields'),fld('output_format','Output format','select',['CSV','XLSX','PDF'])],
  'reports:scheduled-reports':[fld('report_reference','Saved report'),fld('frequency','Frequency','select',['Daily','Weekly','Monthly','Term']),fld('run_at','Next run','datetime-local'),fld('recipient_list','Recipients','textarea'),fld('schedule_status','Status','select',['Draft','Enabled','Paused','Failed'])],
  'reports:report-templates':[fld('template_name','Template name'),fld('report_type','Report type'),fld('layout_definition','Layout / column definition','textarea'),fld('version','Version'),fld('template_status','Status','select',['Draft','Active','Archived'])],
  'reports:report-history':[fld('report_name','Report name'),fld('run_at','Run time','datetime-local'),fld('run_by','Requested by'),fld('row_count','Rows produced','number'),fld('file_reference','Output file reference'),fld('run_status','Status','select',['Queued','Completed','Failed'])]
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
 const experience=getWorkspaceExperience(group.key,item.label)
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
 useEffect(()=>{setSelectedItem(initialItem.key);setSearch('');setRange('all');setCampus('');setPage(1);setShowForm(false);setDetail(null);setEditing(null)},[workspaceKey])
 const structuredFields=completionItemFields[group.key+':'+item.key]??itemWorkspaceFields[group.key+':'+item.key]??getWorkspaceFields(group.key,item.label)
 const preferredFieldKeys=workspaceTableFieldOrder[group.key]??workspaceTableFieldOrder[group.dataModule]??structuredFields.map(field=>field.key)
 const preferredTableFields=preferredFieldKeys.flatMap(key=>{
  const field=structuredFields.find(candidate=>candidate.key===key)
  return field?[field]:[]
 })
 const tableFields=(preferredTableFields.length?preferredTableFields:structuredFields).slice(0,4)
 const canAdmin=Boolean(user&&['owner','admin'].includes(user.role))
 const itemName=item.label.toLowerCase()
 const readOnlyPage=/dashboard|overview|history|reports?|analytics|audit|logs?|summary|notifications?|performance|insights?|statistics|delivery history|access history|change history/i.test(itemName)
 const canWrite=Boolean(user&&!readOnlyPage&&(
  canAdmin||
  (user.role==='teacher'&&['academic_setup','attendance','timetable','teaching','behaviour','communication','question_bank','examinations','tests','curriculum','front_office','forms_documents','hostel','sports'].includes(group.dataModule))||
  (user.role==='accountant'&&['finance','fees','receivables','payments','receipts','payroll','reconciliation','inventory','cafeteria','assets','procurement','hostel'].includes(group.dataModule))||
  (user.role==='exam_officer'&&['question_bank','examinations','tests','reports'].includes(group.dataModule))
 ))
 const hasSchemaField=(pattern:RegExp)=>structuredFields.some(field=>pattern.test(field.key+' '+field.label))
 const hasMoneyField=hasSchemaField(/amount|fee|cost|price|revenue|debit|credit|refund|salary|balance|budget|paid|payment|income|expense/i)
 const hasQuantityField=hasSchemaField(/quantity|\\bqty\\b|copies|capacity|stock|beds|seats|pages|allocated/i)
 const hasDueField=hasSchemaField(/due|deadline|expiry|expires|follow.?up|expected.*date|return date|next review/i)
 const hasApprovalField=hasSchemaField(/approval|approver|decision|review status|verification result/i)
 const hasSchemaStatus=hasSchemaField(/status|state|stage|decision|result|verification/i)
 const hasNarrativeField=structuredFields.some(field=>field.type==='textarea'||/description|notes|reason|purpose|message|comment|summary|instruction|finding/i.test(field.key+' '+field.label))
 const showStatusField=!hasSchemaStatus
 const showDescription=!hasNarrativeField&&/incident|complaint|request|application|policy|plan|notice|message|activity|event|observation|recommendation|maintenance|review|feedback|enquiry|visitor|support|follow.?up|details/i.test(itemName)
 const hasReferenceField=hasSchemaField(/reference|code|serial|number|isbn|sku|admission|employee.?no/i)
 const hasDateField=structuredFields.some(field=>['date','datetime-local','time'].includes(field.type??'text')||/date|time|period|session|year/i.test(field.key+' '+field.label))
 const showAmount=!hasMoneyField&&/fee|payment|receipt|refund|invoice|receivable|balance|salary|payroll|income|expense|cost|budget|collection|reconciliation/i.test(itemName)
 const showQuantity=!hasQuantityField&&/stock|inventory|catalogue|catalog|book|copies|capacity|class|section|room|bed|vehicle|asset|allocation/i.test(itemName)
 const showDueDate=!hasDueField&&/due|deadline|follow.?up|assignment|homework|contract|warranty|maintenance|reservation|leave|invoice|fee|payment|application|session|schedule/i.test(itemName)
 const showRecordDate=!hasDateField&&/attendance|history|report|audit|transaction|payment|collection|assessment|examination|event|visit|issue|certificate|session|application|maintenance|reservation|progress|performance/i.test(itemName)
 const showApproval=canAdmin&&!readOnlyPage&&!hasApprovalField&&/approval|approver|review|verification|permission|policy|access|request|reservation|purchase|certificate|visitor|audit/i.test(itemName)
 const showPortalVisibility=/notice|circular|announcement|message|homework|assignment|learning material|resource|curriculum|form|submission|document|certificate|event|activity|classroom/i.test(itemName)
 const showReference=!hasReferenceField&&/reference|directory|catalog|register|history|report|request|invoice|receipt|certificate|document|id card|code|number|asset|vehicle|route|book|account|class|subject|session|fee|payment|employee|student|visitor|purchase|stock|attendance|question|policy|permission|case|form|submission|transfer|allocation|reservation|application|enquiry|complaint|supplier|payroll|audit/i.test(itemName)
 const showCreatedDateFilter=hasDateField||/dashboard|history|report|log|attendance|assessment|examination|event|visit|transaction|payment|invoice|receipt|session|audit/i.test(itemName)
 const metaColumnKeys:RecordMetaKey[]=recordMetaColumnPlan[group.key]??recordMetaColumnPlan[group.dataModule]??['reference_code','status']
 const tableMetaColumns=metaColumnKeys
  .filter(key=>{
   if(key==='approval_status')return canViewInternalApproval(user?.role)&&showApproval
   if(key==='status')return !hasSchemaStatus
   if(key==='amount')return showAmount
   if(key==='quantity')return showQuantity
   if(key==='due_date')return showDueDate
   if(key==='record_date')return showRecordDate
   if(key==='reference_code')return showReference
   return true
  })
  .map(key=>({key,label:recordMetaLabels[key]}))
 const recordLabel=workspaceRecordLabels[group.key]??workspaceRecordLabels[group.dataModule]??'Record'
 const workspaceLayout=workspaceLayouts[group.key]??workspaceLayouts[group.dataModule]??'registry'
 const theme=themes[group.theme]||themes.blue
 
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
 function print(){try{printOfficeReport(group.label+' — '+item.label,exportRows as unknown as Record<string,unknown>[],columns,user?.institutionName??'Government Islamia Degree College Badin')}catch(error){onToast(error instanceof Error?error.message:'Print view could not be opened.',true)}}

 return <main className="page-content ed360-module-page ed360-institutional-workspace" data-workspace-group={group.key} data-workspace-theme={group.theme} data-workspace-layout={workspaceLayout} style={{'--workspace-accent':theme.accent,'--workspace-soft':theme.soft,'--workspace-ink':theme.ink} as CSSProperties}>
  <header className="ed360-workspace-hero">
   <div className="ed360-workspace-hero-copy">
    <span>{(user?.institutionName||'Government Islamia Degree College, Badin').toUpperCase()} / {group.label.toUpperCase()}</span>
    <h1>{item.label}</h1>
   </div>
   <div className="ed360-workspace-hero-tools">
    <button type="button" className="button button-primary" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> {loading?'Refreshing…':'Refresh'}</button>
    {canWrite&&<button type="button" className="button button-outline" onClick={()=>resetForm()}><Plus size={16}/> New record</button>}
   </div>
  </header>
  <nav className="ed360-operations-window-nav ed360-workspace-tabs" aria-label={group.label+' submenus'}>
   {group.items.map(menu=><button key={menu.key} type="button" className={selectedItem===menu.key?'active':''} aria-current={selectedItem===menu.key?'page':undefined} onClick={()=>setSelectedItem(menu.key)}>{menu.label}</button>)}
  </nav>
  <div className="ed360-workspace-toolbar">
   <div className="ed360-workspace-filter">
    {showCreatedDateFilter&&<><Filter size={15}/><label className="ed360-filter-label">Created<select value={range} onChange={e=>setRange(e.target.value)} aria-label="Created date range"><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option><option value="all">All dates</option></select></label></>}
    {campuses.length>0&&<label className="ed360-filter-label">Campus<select value={campus} onChange={e=>setCampus(e.target.value)} aria-label="Campus filter"><option value="">All campuses</option>{campuses.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}
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
  {dashboard&&<section className="ed360-workspace-kpis">
   <article><span>{item.label} records</span><strong>{loading?'—':rows.length.toLocaleString()}</strong></article>
   {canAdmin&&showApproval&&pendingReviewCount!==null&&<article><span>Pending review</span><strong>{loading?'—':pendingReviewCount.toLocaleString()}</strong></article>}
   {showDueDate&&<article><span>Overdue</span><strong>{loading?'—':overdue.toLocaleString()}</strong></article>}
   {showAmount&&<article><span>Recorded value</span><strong>{loading?'—':money(totalAmount)}</strong></article>}
  </section>}
  {dashboard&&<section className="ed360-workspace-chart">
   <div className="ed360-workspace-section-title"><div><span>RECORD STATUS</span><h3>{item.label} status</h3></div></div>
   {statusCounts.length?statusCounts.map(s=><div className="ed360-workspace-bar" key={s.status}><label>{s.status.replaceAll('_',' ')}</label><div><i style={{width:Math.max(2,(s.count/Math.max(1,rows.length))*100)+'%'}}/></div><b>{s.count}</b></div>):<p className="ed360-workspace-empty-inline">No statuses recorded.</p>}
  </section>}
  <section className="table-card ed360-workspace-record-card">
   <div className="table-toolbar"><div className="table-count"><strong>{filtered.length.toLocaleString()}</strong> {item.label.toLowerCase()} </div></div>
   {loading?<div className="ed360-workspace-empty">Loading…</div>:filtered.length===0?<div className="ed360-workspace-empty"><strong>{experience.emptyTitle}</strong>{experience.emptyDescription&&<span>{experience.emptyDescription}</span>}{canWrite&&<button type="button" className="button button-primary" onClick={()=>resetForm()}><Plus size={15}/> {experience.actionLabel}</button>}</div>:
   <div className="table-scroll"><table aria-label={group.label+' '+item.label+' register'}><thead><tr><th scope="col">{recordLabel}</th>{tableMetaColumns.map(column=><th key={column.key} scope="col" data-column={column.key}>{column.label}</th>)}{tableFields.map(field=><th key={field.key} scope="col">{field.label}</th>)}<th scope="col">Actions</th></tr></thead><tbody>
    {pageRows.map(row=><tr key={row.id}><td><button className="ed360-record-open" type="button" onClick={()=>setDetail(row)}>{row.title}</button><small className="ed360-record-subtitle">{row.description||row.record_type.replaceAll('-',' ')}</small></td>{tableMetaColumns.map(column=><td key={column.key} data-column={column.key}>{column.key==='reference_code'?row.reference_code||'—':column.key==='status'?<span className={'ed360-state-pill state-'+row.status}>{row.status.replaceAll('_',' ')}</span>:column.key==='approval_status'?row.approval_status.replaceAll('_',' '):column.key==='record_date'?displayDate(row.record_date):column.key==='due_date'?displayDate(row.due_date):column.key==='amount'?money(row.amount):row.quantity??'—'}</td>)}{tableFields.map(field=><td key={field.key} data-column={field.key}>{String(row.payload?.[field.key]??'—')}</td>)}<td><div className="ed360-row-actions"><button type="button" onClick={()=>setDetail(row)}>Open</button>{canWrite&&<button type="button" onClick={()=>resetForm(row)}>Edit</button>}</div></td></tr>)}
   </tbody></table></div>}
   {!loading&&filtered.length>pageSize&&<div className="ed360-record-pagination"><span>Showing <b>{(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize,filtered.length)}</b> of <b>{filtered.length}</b> records</span><div><button type="button" disabled={currentPage<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>Previous</button><span>Page {currentPage} of {pageCount}</span><button type="button" disabled={currentPage>=pageCount} onClick={()=>setPage(value=>Math.min(pageCount,value+1))}>Next</button></div></div>}
  </section>
  {showForm&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShowForm(false)}}><section className="modal-card ed360-context-form" role="dialog" aria-modal="true" aria-labelledby="ed360-form-heading">
   <div className="modal-heading"><div><div className="eyebrow">{group.label.toUpperCase()} / {item.label.toUpperCase()}</div><h2 id="ed360-form-heading">{editing?'Edit':'Create'} {item.label}</h2></div><button type="button" className="icon-button" onClick={()=>setShowForm(false)} aria-label="Close"><X size={18}/></button></div>
   <form onSubmit={save} className="ed360-context-form-grid">
    <label>Record title *<input required value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} placeholder={'Enter '+item.label.toLowerCase()}/></label>
    {showReference&&<label>Reference / number<input value={reference} onChange={e=>setReference(e.target.value)} maxLength={80} placeholder="Optional reference"/></label>}
    {showDescription&&<label>Description / notes<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} maxLength={3000}/></label>}
    {(showStatusField||showApproval)&&<div className="ed360-form-row">{showStatusField&&<label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{statusOptions.map(s=><option value={s} key={s}>{s.replaceAll('_',' ')}</option>)}</select></label>}{showApproval&&<label>Approval<select value={approval} onChange={e=>setApproval(e.target.value)}><option value="not_required">Not required</option><option value="draft">Draft</option><option value="pending">Needs approval</option></select></label>}</div>}
    {(showRecordDate||showDueDate)&&<div className="ed360-form-row">{showRecordDate&&<label>Record date<input type="date" value={recordDate} onChange={e=>setRecordDate(e.target.value)}/></label>}{showDueDate&&<label>Due date<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label>}</div>}
    {showPortalVisibility&&<div className="ed360-form-row"><label>Portal visibility<select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="staff_only">Staff only</option><option value="student_portal">Student portal (one linked student)</option><option value="parent_portal">Parent portal (one linked student)</option><option value="institution_portal">Institution portal (shared notice)</option></select></label>{canWrite&&visibility!=='staff_only'&&visibility!=='institution_portal'&&<label>Linked student *<select required value={selectedStudentId} onChange={e=>setSelectedStudentId(e.target.value)}><option value="">Select the relevant student</option>{studentOptions.map(student=><option key={student.id} value={student.id}>{student.name}{student.reference?' · '+student.reference:''}</option>)}</select></label>}</div>}
    {(showAmount||showQuantity)&&<div className="ed360-form-row">{showAmount&&<label>Amount (PKR)<input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>}{showQuantity&&<label>Quantity<input type="number" min="0" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>}</div>}
    {structuredFields.length>0&&<section className="ed360-module-specific-form"><div className="ed360-module-specific-heading"><span>ADDITIONAL DETAILS</span></div><div className="ed360-context-form-fields">{structuredFields.map(field=><label key={field.key}>{field.label}{field.type==='select'?<select value={String(payloadData[field.key]??'')} onChange={e=>setPayloadData(old=>({...old,[field.key]:e.target.value}))}><option value="">Select / not set</option>{(field.options??[]).map(option=><option value={option} key={option}>{option}</option>)}</select>:field.type==='textarea'?<textarea rows={3} value={String(payloadData[field.key]??'')} onChange={e=>setPayloadData(old=>({...old,[field.key]:e.target.value}))} placeholder={field.placeholder??''}/>:<input type={field.type??'text'} step={field.type==='number'?'0.01':undefined} value={String(payloadData[field.key]??'')} onChange={e=>setPayloadData(old=>({...old,[field.key]:e.target.value}))} placeholder={field.placeholder??''}/>}</label>)}</div></section>}
    <div className="modal-actions"><button type="button" className="button button-outline" onClick={()=>setShowForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving?'Saving…':editing?'Save changes':'Create record'}</button></div>
   </form>
  </section></div>}
  {detail&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setDetail(null)}}><section className="modal-card ed360-record-details ed360-context-detail" role="dialog" aria-modal="true" aria-labelledby="ed360-detail-heading">
   <div className="modal-heading"><div><div className="eyebrow">CONTEXTUAL SUB-WINDOW / {group.label.toUpperCase()}</div><h2 id="ed360-detail-heading">{detail.title}</h2><p>{detail.reference_code||detail.record_type.replaceAll('-',' ')}{!hasSchemaStatus?' · '+detail.status:''}</p></div><button type="button" className="icon-button" onClick={()=>setDetail(null)} aria-label="Close"><X size={18}/></button></div>
   <div className="ed360-context-detail-callout"><div>{canAdmin&&<><span>RECORD WORKFLOW</span><strong>{detail.approval_status.replaceAll('_',' ')}</strong></>}{detail.description&&<p>{detail.description}</p>}</div><aside><b>Responsible workspace</b><p>{group.label} / {item.label}</p><b>Updated</b><p>{detail.updated_at?new Date(detail.updated_at).toLocaleString():'Not available'}</p></aside></div>
   <div className="ed360-record-details-grid">
    {!hasSchemaStatus&&<div className="ed360-record-detail"><small>Status</small><b>{detail.status}</b></div>}
    {showRecordDate&&<div className="ed360-record-detail"><small>Record date</small><b>{displayDate(detail.record_date)}</b></div>}
    {showDueDate&&<div className="ed360-record-detail"><small>Due date</small><b>{displayDate(detail.due_date)}</b></div>}
    {showAmount&&<div className="ed360-record-detail"><small>Amount</small><b>{money(detail.amount)}</b></div>}
    {showQuantity&&<div className="ed360-record-detail"><small>Quantity</small><b>{detail.quantity??'—'}</b></div>}
    <div className="ed360-record-detail"><small>Created</small><b>{detail.created_at?new Date(detail.created_at).toLocaleString():'—'}</b></div>
   </div>
   {Object.keys(detail.payload??{}).length>0&&<section className="ed360-payload-section"><h3>{item.label} details</h3><div className="ed360-record-details-grid">{Object.entries(detail.payload).map(([key,value])=><div className="ed360-record-detail" key={key}><small>{structuredFields.find(field=>field.key===key)?.label??key.replaceAll('_',' ')}</small><b>{typeof value==='boolean'?(value?'Yes':'No'):String(value??'—')}</b></div>)}</div></section>}
   <div className="modal-actions">
    {canAdmin&&detail.approval_status==='pending'&&<><button type="button" className="button button-outline" onClick={()=>void decide(detail,'rejected')}>Reject</button><button type="button" className="button button-primary" onClick={()=>void decide(detail,'approved')}><CheckCircle2 size={15}/> Approve</button></>}
    {canWrite&&<button type="button" className="button button-outline" onClick={()=>{const row=detail;setDetail(null);resetForm(row)}}>Edit record</button>}
    {canAdmin&&!readOnlyPage&&<button type="button" className="button button-danger" onClick={()=>void remove(detail)}>Delete</button>}
    <button type="button" className="button button-primary" onClick={()=>setDetail(null)}>Close</button>
   </div>
  </section></div>}
 </main>
}
