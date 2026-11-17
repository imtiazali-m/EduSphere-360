import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowUpRight, Building2, CheckCircle2, Download, FileSpreadsheet, FileText, LockKeyhole, Palette, Plus, Printer, RefreshCw, Save, Search, ShieldCheck, Upload, Users, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/userErrors'
import { downloadCsv } from '../lib/csv'
import { exportDocx, exportXlsx, printOfficeReport, type OfficeColumn } from '../lib/officeExport'
import { CollegeRolePermissionWorkspace } from './CollegeRolePermissionWorkspace'
import type { RecordRow } from '../lib/types'
import { displayInstitutionName } from '../lib/collegeIdentity'
import '../styles/governance-workspace.css'

type Section='profile'|'academic'|'departments'|'designations'|'organization'|'system'|'approvals'|'policies'|'policies-students'|'policies-faculty'|'audit'|'accounts'|'permissions'|'settings'|'branding'|'security'
type Props={initialWindow?:string;onToast:(message:string,error?:boolean)=>void;onNavigate:(route:string)=>void}
type Institution={id:string;name:string;institution_type:string;tagline?:string|null;phone?:string|null;email?:string|null;website?:string|null;address?:string|null;country?:string|null;logo_path?:string|null;created_by?:string|null}
type Setting=RecordRow & {id:string;category:string;setting_key:string;setting_value:unknown;is_public:boolean}
type Approval=RecordRow & {id:string;workflow_key:string;status:string;target_type:string;payload:Record<string,unknown>;requested_at:string;requested_by:string|null;decision_notes?:string|null}
type Audit=RecordRow & {id:string;record_id:string;action:string;module_key:string;record_type:string;occurred_at:string;actor_id:string|null;old_values:unknown;new_values:unknown}
type Department=RecordRow & {id:string;name:string;department_code?:string;head_name?:string|null;email?:string|null;phone?:string|null;status?:string;is_active?:boolean;campus_id?:string|null}
type Designation=RecordRow & {id:string;name:string;code?:string|null;department_id?:string|null;is_active:boolean}
type Teacher=RecordRow & {id:string;full_name:string;department?:string|null;department_id?:string|null;designation_id?:string|null;employment_status?:string;campus_id?:string|null}
type Member=RecordRow & {id:string;user_id:string;role:string;status:string;created_at?:string;full_name?:string;email?:string}
type Policy=RecordRow & {id:string;title:string;reference_code?:string|null;description?:string|null;status:string;effective_date?:string|null;payload:Record<string,unknown>}
type AcademicRow=RecordRow & {id:string;[key:string]:unknown}
type InstitutePreferences={timezone:string;date_format:string;currency:string;academic_year_start_month:string;term_structure:string;student_id_prefix:string;employee_id_prefix:string}
const defaultInstitutePreferences:InstitutePreferences={timezone:'Asia/Karachi',date_format:'dd MMM yyyy',currency:'PKR',academic_year_start_month:'8',term_structure:'annual',student_id_prefix:'GIDC-STU',employee_id_prefix:'GIDC-EMP'}
const sectionByWindow:Record<string,Section>={profile:'profile',settings:'settings',institution_settings:'settings',approvals:'approvals',audit:'audit',academic:'academic',accounts:'accounts',departments:'departments',designations:'designations',organization:'organization',system:'system',policies:'policies-students','policies-students':'policies-students','policies-faculty':'policies-faculty',policies_students:'policies-students',policies_faculty:'policies-faculty',organization_structure:'organization',permissions:'permissions',branding:'branding',security:'security'}
const dateLabel=(value:unknown)=>value?new Date(String(value)).toLocaleString():'—'
const label=(value:unknown)=>String(value??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const jsonObject=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
const safeInstitutionBrandColor=(value:unknown,fallback:string)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:fallback

async function fetchAllInstitutionAuditEvents(institutionId:string):Promise<{data:Audit[];error:unknown|null}>{
  if(!supabase)return {data:[],error:new Error('The institution database connection is unavailable.')}
  const rows:Audit[]=[]
  const batchSize=500
  for(let offset=0;;offset+=batchSize){
    const {data,error}=await supabase.from('institutional_audit_events').select('*').eq('institution_id',institutionId).order('occurred_at',{ascending:false}).range(offset,offset+batchSize-1)
    if(error)return {data:[],error}
    const batch=(data??[]) as Audit[]
    rows.push(...batch)
    if(batch.length<batchSize)return {data:rows,error:null}
  }
}

async function fetchAllInstitutionSettings(institutionId:string):Promise<{data:Setting[];error:unknown|null}>{
  if(!supabase)return {data:[],error:new Error('The institution database connection is unavailable.')}
  const rows:Setting[]=[]
  const batchSize=500
  for(let offset=0;;offset+=batchSize){
    const {data,error}=await supabase.from('institution_settings').select('*').eq('institution_id',institutionId).order('category').order('setting_key').range(offset,offset+batchSize-1)
    if(error)return {data:[],error}
    const batch=(data??[]) as Setting[]
    rows.push(...batch)
    if(batch.length<batchSize)return {data:rows,error:null}
  }
}

async function fetchAllInstitutionApprovals(institutionId:string):Promise<{data:Approval[];error:unknown|null}>{
  if(!supabase)return {data:[],error:new Error('The institution database connection is unavailable.')}
  const rows:Approval[]=[]
  const batchSize=500
  for(let offset=0;;offset+=batchSize){
    const {data,error}=await supabase.from('workflow_approvals').select('*').eq('institution_id',institutionId).order('requested_at',{ascending:false}).range(offset,offset+batchSize-1)
    if(error)return {data:[],error}
    const batch=(data??[]) as Approval[]
    rows.push(...batch)
    if(batch.length<batchSize)return {data:rows,error:null}
  }
}

async function fetchAllInstitutionPolicies(institutionId:string):Promise<{data:Policy[];error:unknown|null}>{
  if(!supabase)return {data:[],error:new Error('The institution database connection is unavailable.')}
  const rows:Policy[]=[]
  const batchSize=500
  for(let offset=0;;offset+=batchSize){
    const {data,error}=await supabase.from('institutional_records').select('*').eq('institution_id',institutionId).eq('module_key','administration').eq('record_type','institutional-policy').order('updated_at',{ascending:false}).range(offset,offset+batchSize-1)
    if(error)return {data:[],error}
    const batch=(data??[]) as Policy[]
    rows.push(...batch)
    if(batch.length<batchSize)return {data:rows,error:null}
  }
}

async function fetchAllInstitutionMemberships(institutionId:string):Promise<{data:Member[];error:unknown|null}>{
  if(!supabase)return {data:[],error:new Error('The institution database connection is unavailable.')}
  const rows:Member[]=[]
  const batchSize=500
  for(let offset=0;;offset+=batchSize){
    const {data,error}=await supabase.from('memberships').select('id,user_id,role,status,created_at').eq('institution_id',institutionId).order('created_at',{ascending:false}).range(offset,offset+batchSize-1)
    if(error)return {data:[],error}
    const batch=(data??[]) as Member[]
    rows.push(...batch)
    if(batch.length<batchSize)return {data:rows,error:null}
  }
}

async function fetchAllInstitutionDepartments(institutionId:string):Promise<{data:Department[];error:unknown|null}>{
  if(!supabase)return {data:[],error:new Error('The institution database connection is unavailable.')}
  const rows:Department[]=[]
  const batchSize=500
  for(let offset=0;;offset+=batchSize){
    const {data,error}=await supabase.from('departments').select('*').eq('institution_id',institutionId).order('name').range(offset,offset+batchSize-1)
    if(error)return {data:[],error}
    const batch=(data??[]) as Department[]
    rows.push(...batch)
    if(batch.length<batchSize)return {data:rows,error:null}
  }
}
async function fetchAllInstitutionDesignations(institutionId:string):Promise<{data:Designation[];error:unknown|null}>{
  if(!supabase)return {data:[],error:new Error('The institution database connection is unavailable.')}
  const rows:Designation[]=[]
  const batchSize=500
  for(let offset=0;;offset+=batchSize){
    const {data,error}=await supabase.from('designations').select('*').eq('institution_id',institutionId).order('name').range(offset,offset+batchSize-1)
    if(error)return {data:[],error}
    const batch=(data??[]) as Designation[]
    rows.push(...batch)
    if(batch.length<batchSize)return {data:rows,error:null}
  }
}
async function fetchAllInstitutionTeachers(institutionId:string):Promise<{data:Teacher[];error:unknown|null}>{
  if(!supabase)return {data:[],error:new Error('The institution database connection is unavailable.')}
  const rows:Teacher[]=[]
  const batchSize=500
  for(let offset=0;;offset+=batchSize){
    const {data,error}=await supabase.from('teachers').select('id,full_name,department,department_id,designation_id,employment_status,campus_id').eq('institution_id',institutionId).order('full_name').range(offset,offset+batchSize-1)
    if(error)return {data:[],error}
    const batch=(data??[]) as Teacher[]
    rows.push(...batch)
    if(batch.length<batchSize)return {data:rows,error:null}
  }
}

export function AdministrationStage5Workspace({initialWindow,onToast,onNavigate}:Props){
  const {user}=useAuth()
  const [section]=useState<Section>(sectionByWindow[initialWindow??'']??'profile')
  const pageMeta:Record<Section,{title:string;description:string}>={profile:{title:'Institute Profile',description:'Official institution identity, contact details and public profile.'},academic:{title:'Academic Structure & Sections',description:'Academic levels, programmes, classes and institutional section structure.'},departments:{title:'Department Directory',description:'Department ownership, contacts and organisational assignments.'},designations:{title:'Designation Catalogue',description:'Faculty and staff positions, role titles and department relationships.'},organization:{title:'Organisational Structure',description:'Institution reporting lines, leadership and organisational units.'},system:{title:'System Configuration',description:'Institution-level configuration values and operational preferences.'},approvals:{title:'Approval Workflows',description:'Review and decide institution change requests with an audit trail.'},policies:{title:'Institution Policies',description:'Institution policy records and publication status.'},'policies-students':{title:'Student Policies',description:'Student-facing rules, procedures and effective policy revisions.'},'policies-faculty':{title:'Faculty Policies',description:'Faculty and staff rules, procedures and effective policy revisions.'},audit:{title:'Administrative Audit',description:'Search institution-scoped administrative actions and record changes.'},accounts:{title:'User Access & Invitations',description:'Institution memberships, roles and account activation status.'},permissions:{title:'Role & Permission Management',description:'Role grants and access boundaries for institution workspaces.'},settings:{title:'Institute Settings',description:'Institution preferences, local formats and operational defaults.'},branding:{title:'Branding & Document Settings',description:'Institution identity assets, colours and document preferences.'},security:{title:'Security & Access History',description:'Available institution security evidence and access audit events.'}}
  const admin=user?.role==='owner'||user?.role==='admin'
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('')
  const [institution,setInstitution]=useState<Institution|null>(null)
  const [profileDraft,setProfileDraft]=useState({name:'',institution_type:'school',tagline:'',phone:'',email:'',website:'',address:'',country:''})
  const [logoFile,setLogoFile]=useState<File|null>(null),[logoUrl,setLogoUrl]=useState('')
  const [logoPreviewUrl,setLogoPreviewUrl]=useState('')
  const [settings,setSettings]=useState<Setting[]>([]),[approvals,setApprovals]=useState<Approval[]>([]),[audit,setAudit]=useState<Audit[]>([]),[policies,setPolicies]=useState<Policy[]>([])
  const [departments,setDepartments]=useState<Department[]>([]),[designations,setDesignations]=useState<Designation[]>([]),[teachers,setTeachers]=useState<Teacher[]>([]),[members,setMembers]=useState<Member[]>([])
  const [academicSessions,setAcademicSessions]=useState<AcademicRow[]>([]),[classes,setClasses]=useState<AcademicRow[]>([]),[programs,setPrograms]=useState<AcademicRow[]>([]),[subjects,setSubjects]=useState<AcademicRow[]>([]),[rooms,setRooms]=useState<AcademicRow[]>([])
  const [institutePreferences,setInstitutePreferences]=useState<InstitutePreferences>(defaultInstitutePreferences)
  const [primaryColorDraft,setPrimaryColorDraft]=useState('#6035B5')
  const [accentColorDraft,setAccentColorDraft]=useState('#16877B')
  const [search,setSearch]=useState('')
  const [settingsSortKey,setSettingsSortKey]=useState<'category'|'setting_key'|'is_public'>('category')
  const [settingsSortDirection,setSettingsSortDirection]=useState<'asc'|'desc'>('asc')
  const [settingsPage,setSettingsPage]=useState(1),[approvalPage,setApprovalPage]=useState(1),[auditPage,setAuditPage]=useState(1),[securityPage,setSecurityPage]=useState(1)
  const [auditSearch,setAuditSearch]=useState('')
  const [auditSortKey,setAuditSortKey]=useState<'occurred_at'|'action'|'module_key'>('occurred_at')
  const [auditSortDirection,setAuditSortDirection]=useState<'desc'|'asc'>('desc')
  const [securitySearch,setSecuritySearch]=useState('')
  const [securitySortKey,setSecuritySortKey]=useState<'occurred_at'|'action'|'module_key'>('occurred_at')
  const [securitySortDirection,setSecuritySortDirection]=useState<'desc'|'asc'>('desc')
  const pageSize=10
  const [membershipSavingId,setMembershipSavingId]=useState<string|null>(null)
  const [policyForm,setPolicyForm]=useState(false),[policyEditing,setPolicyEditing]=useState<Policy|null>(null)
  const [policyTitle,setPolicyTitle]=useState(''),[policyCode,setPolicyCode]=useState(''),[policyCategory,setPolicyCategory]=useState('general'),[policyDescription,setPolicyDescription]=useState(''),[policyStatus,setPolicyStatus]=useState('draft'),[policyEffectiveDate,setPolicyEffectiveDate]=useState('')
  const [policyPage,setPolicyPage]=useState(1)
  const [policyStatusFilter,setPolicyStatusFilter]=useState<'all'|'draft'|'published'|'archived'>('all')
  const [policySortKey,setPolicySortKey]=useState<'title'|'status'|'effective_date'|'updated_at'>('updated_at')
  const [policySortDirection,setPolicySortDirection]=useState<'asc'|'desc'>('desc')
  const [settingForm,setSettingForm]=useState(false),[settingEditing,setSettingEditing]=useState<Setting|null>(null),[settingCategory,setSettingCategory]=useState('general'),[settingKey,setSettingKey]=useState(''),[settingValue,setSettingValue]=useState('{}'),[settingPublic,setSettingPublic]=useState(false)
  const [approvalForm,setApprovalForm]=useState(false),[approvalKey,setApprovalKey]=useState(''),[approvalValue,setApprovalValue]=useState('{}'),[approvalNotes,setApprovalNotes]=useState(''),[approvalPublic,setApprovalPublic]=useState(false)
  const [approvalStatusFilter,setApprovalStatusFilter]=useState<'all'|'pending'|'approved'|'rejected'>('all')
  const [approvalSortKey,setApprovalSortKey]=useState<'requested_at'|'status'|'workflow_key'>('requested_at')
  const [approvalSortDirection,setApprovalSortDirection]=useState<'asc'|'desc'>('desc')
  const [memberPage,setMemberPage]=useState(1)
  const [memberStatusFilter,setMemberStatusFilter]=useState('all')
  const [memberRoleFilter,setMemberRoleFilter]=useState('all')
  const [memberSortKey,setMemberSortKey]=useState<'full_name'|'email'|'role'|'status'|'created_at'>('created_at')
  const [memberSortDirection,setMemberSortDirection]=useState<'asc'|'desc'>('desc')
  const [departmentPage,setDepartmentPage]=useState(1),[designationPage,setDesignationPage]=useState(1)
  const [departmentStatusFilter,setDepartmentStatusFilter]=useState<'all'|'active'|'inactive'>('all')
  const [designationStatusFilter,setDesignationStatusFilter]=useState<'all'|'active'|'inactive'>('all')
  const [departmentSortKey,setDepartmentSortKey]=useState<'name'|'department_code'|'head_name'|'status'>('name')
  const [departmentSortDirection,setDepartmentSortDirection]=useState<'asc'|'desc'>('asc')
  const [designationSortKey,setDesignationSortKey]=useState<'name'|'code'|'department'|'status'>('name')
  const [designationSortDirection,setDesignationSortDirection]=useState<'asc'|'desc'>('asc')
  const [orgPage,setOrgPage]=useState(1)
  const [orgDepartmentFilter,setOrgDepartmentFilter]=useState('all')
  const [orgDesignationFilter,setOrgDesignationFilter]=useState('all')
  const [orgEmploymentFilter,setOrgEmploymentFilter]=useState('all')
  const [orgSortKey,setOrgSortKey]=useState<'full_name'|'department'|'designation'|'employment_status'>('department')
  const [orgSortDirection,setOrgSortDirection]=useState<'asc'|'desc'>('asc')
  const [orgSearch,setOrgSearch]=useState('')

  async function load(silent=false){
    if(!supabase||!user){setLoading(false);return}
    if(!silent){setLoading(true);setError('')}
    try{
      const [institutionResult,settingsResult,approvalResult,auditResult,policyResult,departmentResult,designationResult,teacherResult,membershipResult,academicSessionResult,classResult,programResult,subjectResult,roomResult]=await Promise.all([
        supabase.from('institutions').select('id,name,institution_type,tagline,phone,email,website,address,country,logo_path,created_by').eq('id',user.institutionId).maybeSingle(),
        admin?fetchAllInstitutionSettings(user.institutionId):Promise.resolve({data:[],error:null}),
        admin?fetchAllInstitutionApprovals(user.institutionId):Promise.resolve({data:[],error:null}),
        admin?fetchAllInstitutionAuditEvents(user.institutionId):Promise.resolve({data:[],error:null}),
        admin?fetchAllInstitutionPolicies(user.institutionId):Promise.resolve({data:[],error:null}),
        admin?fetchAllInstitutionDepartments(user.institutionId):Promise.resolve({data:[],error:null}),
        admin?fetchAllInstitutionDesignations(user.institutionId):Promise.resolve({data:[],error:null}),
        admin?fetchAllInstitutionTeachers(user.institutionId):Promise.resolve({data:[],error:null}),
        admin?fetchAllInstitutionMemberships(user.institutionId):Promise.resolve({data:[],error:null}),
        admin?supabase.from('academic_sessions').select('*').eq('institution_id',user.institutionId).order('start_date',{ascending:false}).limit(200):Promise.resolve({data:[],error:null}),
        admin?supabase.from('classes').select('*').eq('institution_id',user.institutionId).order('name').limit(500):Promise.resolve({data:[],error:null}),
        admin?supabase.from('programs').select('*').eq('institution_id',user.institutionId).order('name').limit(500):Promise.resolve({data:[],error:null}),
        admin?supabase.from('subjects').select('*').eq('institution_id',user.institutionId).order('name').limit(1000):Promise.resolve({data:[],error:null}),
        admin?supabase.from('rooms').select('*').eq('institution_id',user.institutionId).order('name').limit(500):Promise.resolve({data:[],error:null}),
      ])
      for(const result of [institutionResult,settingsResult,approvalResult,auditResult,policyResult,departmentResult,designationResult,teacherResult,membershipResult,academicSessionResult,classResult,programResult,subjectResult,roomResult])if(result.error)throw result.error
      const institutionRow=institutionResult.data as Institution|null
      setInstitution(institutionRow)
      if(institutionRow)setProfileDraft({name:institutionRow.name??'',institution_type:institutionRow.institution_type??'school',tagline:institutionRow.tagline??'',phone:institutionRow.phone??'',email:institutionRow.email??'',website:institutionRow.website??'',address:institutionRow.address??'',country:institutionRow.country??''})
      const membershipRows=(membershipResult.data??[]) as Member[]
      if(membershipRows.length){
        const ids=membershipRows.map(row=>row.user_id).filter(Boolean)
        const profiles:Array<{id:string;full_name?:string|null;email?:string|null}>=[]
        const profileBatchSize=500
        for(let offset=0;offset<ids.length;offset+=profileBatchSize){
          const {data:profileBatch,error:profilesError}=await supabase.from('profiles').select('id,full_name,email').in('id',ids.slice(offset,offset+profileBatchSize))
          if(profilesError)throw profilesError
          profiles.push(...(profileBatch??[]))
        }
        const profileMap=new Map(profiles.map(profile=>[profile.id,profile]))
        setMembers(membershipRows.map(row=>({...row,full_name:profileMap.get(row.user_id)?.full_name??'Institution member',email:profileMap.get(row.user_id)?.email??''})))
      }else setMembers([])
      setSettings((settingsResult.data??[]) as Setting[]);setApprovals((approvalResult.data??[]) as Approval[]);setAudit((auditResult.data??[]) as Audit[])
      setPolicies((policyResult.data??[]) as Policy[]);setDepartments((departmentResult.data??[]) as Department[])
      setDesignations((designationResult.data??[]) as Designation[]);setTeachers((teacherResult.data??[]) as Teacher[])
      setAcademicSessions((academicSessionResult.data??[]) as AcademicRow[]);setClasses((classResult.data??[]) as AcademicRow[]);setPrograms((programResult.data??[]) as AcademicRow[]);setSubjects((subjectResult.data??[]) as AcademicRow[]);setRooms((roomResult.data??[]) as AcademicRow[])
      const preferenceRow=((settingsResult.data??[]) as Setting[]).find(row=>row.category==='general'&&row.setting_key==='institution_preferences')
      setInstitutePreferences({...defaultInstitutePreferences,...jsonObject(preferenceRow?.setting_value)} as InstitutePreferences)
      if(institutionRow?.logo_path){const {data:signed}=await supabase.storage.from('institution-files').createSignedUrl(institutionRow.logo_path,3600);setLogoUrl(signed?.signedUrl??'')}else setLogoUrl('')
    }catch(err){const message=userFacingError(err,'Administration records could not be loaded.');setError(message);if(!silent)onToast(message,true)}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[user?.id,user?.institutionId,user?.role])
  useEffect(()=>{if(!logoFile){setLogoPreviewUrl('');return}const url=URL.createObjectURL(logoFile);setLogoPreviewUrl(url);return()=>URL.revokeObjectURL(url)},[logoFile])
  useEffect(()=>{
    setPrimaryColorDraft(safeInstitutionBrandColor(settings.find(row=>row.category==='branding'&&row.setting_key==='primary_color')?.setting_value,'#6035B5'))
    setAccentColorDraft(safeInstitutionBrandColor(settings.find(row=>row.category==='branding'&&row.setting_key==='accent_color')?.setting_value,'#16877B'))
  },[settings])

  const filteredPolicies=useMemo(()=>policies.filter(row=>{
    const audience=String(jsonObject(row.payload).category??'').toLowerCase()
    const audienceMatches=section==='policies-students'?['student','students'].includes(audience):section==='policies-faculty'?['faculty','staff','teacher','teachers'].includes(audience):false
    const statusMatches=policyStatusFilter==='all'||row.status===policyStatusFilter
    return audienceMatches&&statusMatches&&[row.title,row.reference_code,row.description,row.status,JSON.stringify(row.payload)].join(' ').toLowerCase().includes(search.trim().toLowerCase())
  }),[policies,search,section,policyStatusFilter])
  const orderedPolicies=useMemo(()=>[...filteredPolicies].sort((a,b)=>{
    const left=String(a[policySortKey]??'')
    const right=String(b[policySortKey]??'')
    const comparison=left.localeCompare(right,undefined,{numeric:true,sensitivity:'base'})
    return policySortDirection==='asc'?comparison:-comparison
  }),[filteredPolicies,policySortKey,policySortDirection])
  const policiesPageCount=Math.max(1,Math.ceil(orderedPolicies.length/pageSize))
  const policiesCurrentPage=Math.min(policyPage,policiesPageCount)
  const policyPageRows=orderedPolicies.slice((policiesCurrentPage-1)*pageSize,policiesCurrentPage*pageSize)
  const filteredAudit=useMemo(()=>audit.filter(row=>[row.action,row.module_key,row.record_type,row.actor_id,row.record_id].join(' ').toLowerCase().includes(auditSearch.trim().toLowerCase())).sort((a,b)=>{
    const left=String(a[auditSortKey]??'')
    const right=String(b[auditSortKey]??'')
    const comparison=left.localeCompare(right,undefined,{numeric:true,sensitivity:'base'})
    return auditSortDirection==='asc'?comparison:-comparison
  }),[audit,auditSearch,auditSortKey,auditSortDirection])
  const filteredMembers=useMemo(()=>members.filter(row=>(memberStatusFilter==='all'||row.status===memberStatusFilter)&&(memberRoleFilter==='all'||row.role===memberRoleFilter)&&[row.full_name,row.email,row.role,row.status].join(' ').toLowerCase().includes(search.trim().toLowerCase())),[members,search,memberStatusFilter,memberRoleFilter])
  const orderedMembers=useMemo(()=>[...filteredMembers].sort((a,b)=>{
    const left=String(a[memberSortKey]??'')
    const right=String(b[memberSortKey]??'')
    const comparison=left.localeCompare(right,undefined,{numeric:true,sensitivity:'base'})
    return memberSortDirection==='asc'?comparison:-comparison
  }),[filteredMembers,memberSortKey,memberSortDirection])
  const membersPageCount=Math.max(1,Math.ceil(orderedMembers.length/pageSize))
  const membersCurrentPage=Math.min(memberPage,membersPageCount)
  const memberPageRows=orderedMembers.slice((membersCurrentPage-1)*pageSize,membersCurrentPage*pageSize)
  const visibleSettings=useMemo(()=>settings.filter(row=>section==='system'?row.category==='system':section==='branding'?['branding','documents'].includes(row.category):section==='settings'?false:true).filter(row=>[row.category,row.setting_key,JSON.stringify(row.setting_value)].join(' ').toLowerCase().includes(search.trim().toLowerCase())),[settings,section,search])
  const orderedSettings=useMemo(()=>[...visibleSettings].sort((a,b)=>{
    const left=settingsSortKey==='is_public'?String(a.is_public):String(a[settingsSortKey]??'')
    const right=settingsSortKey==='is_public'?String(b.is_public):String(b[settingsSortKey]??'')
    const comparison=left.localeCompare(right,undefined,{numeric:true,sensitivity:'base'})
    return settingsSortDirection==='asc'?comparison:-comparison
  }),[visibleSettings,settingsSortKey,settingsSortDirection])
  const settingsPageCount=Math.max(1,Math.ceil(orderedSettings.length/pageSize))
  const settingsCurrentPage=Math.min(settingsPage,settingsPageCount)
  const settingsPageRows=orderedSettings.slice((settingsCurrentPage-1)*pageSize,settingsCurrentPage*pageSize)
  const orderedApprovals=useMemo(()=>approvals.filter(row=>(approvalStatusFilter==='all'||row.status===approvalStatusFilter)&&[row.workflow_key,row.target_type,row.status,JSON.stringify(row.payload)].join(' ').toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>{
    const left=String(a[approvalSortKey]??'')
    const right=String(b[approvalSortKey]??'')
    const comparison=left.localeCompare(right,undefined,{numeric:true,sensitivity:'base'})
    return approvalSortDirection==='asc'?comparison:-comparison
  }),[approvals,search,approvalStatusFilter,approvalSortKey,approvalSortDirection])
  const approvalsPageCount=Math.max(1,Math.ceil(orderedApprovals.length/pageSize))
  const approvalsCurrentPage=Math.min(approvalPage,approvalsPageCount)
  const approvalPageRows=orderedApprovals.slice((approvalsCurrentPage-1)*pageSize,approvalPage*pageSize)
  const pendingApprovals=approvals.filter(row=>row.status==='pending').length
  const auditPageCount=Math.max(1,Math.ceil(filteredAudit.length/pageSize))
  const auditCurrentPage=Math.min(auditPage,auditPageCount)
  const auditPageRows=filteredAudit.slice((auditCurrentPage-1)*pageSize,auditCurrentPage*pageSize)
  function toggleSettingsSort(key:'category'|'setting_key'|'is_public'){
    if(settingsSortKey===key)setSettingsSortDirection(direction=>direction==='asc'?'desc':'asc')
    else{setSettingsSortKey(key);setSettingsSortDirection('asc')}
    setSettingsPage(1)
  }
  function sortHeader(labelText:string,key:'category'|'setting_key'|'is_public'){
    return <th aria-sort={settingsSortKey===key?(settingsSortDirection==='asc'?'ascending':'descending'):'none'}><button type="button" className="gov-sort-header" onClick={()=>toggleSettingsSort(key)}>{labelText}<span aria-hidden="true">{settingsSortKey===key?(settingsSortDirection==='asc'?'↑':'↓'):'↕'}</span></button></th>
  }
  function pageControls(total:number,page:number,pageCount:number,onPage:(next:number)=>void){
    return total>pageSize?<div className="gov-pagination"><span>Showing <b>{(page-1)*pageSize+1}–{Math.min(page*pageSize,total)}</b> of <b>{total}</b></span><div><button type="button" className="gov-button" disabled={page<=1} onClick={()=>onPage(page-1)}>Previous</button><span>Page {page} of {pageCount}</span><button type="button" className="gov-button" disabled={page>=pageCount} onClick={()=>onPage(page+1)}>Next</button></div></div>:null
  }

  function reportActions(title:string,fileName:string,rows:Record<string,unknown>[],columns:OfficeColumn[]){
    const run=(format:'csv'|'excel'|'word'|'print')=>{
      try{
        if(format==='csv')downloadCsv(fileName+'.csv',rows,columns)
        else if(format==='excel')exportXlsx(fileName+'.xlsx',title,rows,columns)
        else if(format==='word')exportDocx(fileName+'.docx',title,rows,columns)
        else printOfficeReport(title,rows,columns,user?.institutionName??'Institution')
      }catch(error){onToast(error instanceof Error?error.message:'The administration report could not be opened.',true)}
    }
    return <div className="gov-row-actions ed360-admin-report-actions" aria-label={title+' exports'}>
      <button type="button" className="gov-button" onClick={()=>run('csv')}><Download size={13}/> CSV</button>
      <button type="button" className="gov-button" onClick={()=>run('excel')}><FileSpreadsheet size={13}/> Excel</button>
      <button type="button" className="gov-button" onClick={()=>run('word')}><FileText size={13}/> Word</button>
      <button type="button" className="gov-button primary" onClick={()=>run('print')}><Printer size={13}/> Print A4</button>
    </div>
  }

  async function saveBrandColors(event:FormEvent){
    event.preventDefault()
    if(!supabase||!admin)return
    const colors=[['primary_color',primaryColorDraft],['accent_color',accentColorDraft]] as const
    if(colors.some(([,value])=>!/^#[0-9a-f]{6}$/i.test(value))){onToast('Choose valid six-digit hexadecimal brand colours.',true);return}
    setSaving(true)
    try{
      for(const [settingKey,settingValue] of colors){
        const {data:existing,error:lookupError}=await supabase.from('institution_settings').select('id').eq('institution_id',user!.institutionId).eq('category','branding').eq('setting_key',settingKey).is('campus_id',null).maybeSingle()
        if(lookupError)throw lookupError
        const values={category:'branding',setting_key:settingKey,setting_value:settingValue,is_public:false,updated_by:user!.id,updated_at:new Date().toISOString()}
        const result=existing
          ?await supabase.from('institution_settings').update(values).eq('institution_id',user!.institutionId).eq('id',existing.id)
          :await supabase.from('institution_settings').insert({...values,institution_id:user!.institutionId})
        if(result.error)throw result.error
      }
      onToast('Institution brand colours saved.')
      await load(true)
    }catch(err){
      onToast(userFacingError(err,'Institution brand colours could not be saved.'),true)
      await load(true)
    }finally{setSaving(false)}
  }

  function openSetting(row?:Setting,category?:string){
    setSettingEditing(row??null);setSettingCategory(category??row?.category??(section==='system'?'system':section==='branding'?'branding':'general'))
    setSettingKey(row?.setting_key??'');setSettingValue(JSON.stringify(row?.setting_value??{},null,2));setSettingPublic(row?.is_public??false);setSettingForm(true)
  }
  async function saveSetting(event:FormEvent){
    event.preventDefault();if(!supabase||!admin)return
    let parsed:unknown
    try{parsed=JSON.parse(settingValue)}catch{onToast('Enter a valid JSON value for this setting.',true);return}
    if(!settingKey.trim()||!settingCategory.trim()){onToast('A setting category and key are required.',true);return}
    setSaving(true)
    const values={category:settingCategory.trim(),setting_key:settingKey.trim(),setting_value:parsed,is_public:settingPublic,updated_by:user!.id,updated_at:new Date().toISOString()}
    try{
      if(settingEditing){const {error:saveError}=await supabase.from('institution_settings').update(values).eq('institution_id',user!.institutionId).eq('id',settingEditing.id);if(saveError)throw saveError}
      else{
        const {data:existing,error:lookupError}=await supabase.from('institution_settings').select('id').eq('institution_id',user!.institutionId).eq('category',values.category).eq('setting_key',values.setting_key).is('campus_id',null).maybeSingle()
        if(lookupError)throw lookupError
        const result=existing?await supabase.from('institution_settings').update(values).eq('institution_id',user!.institutionId).eq('id',existing.id):await supabase.from('institution_settings').insert({...values,institution_id:user!.institutionId})
        if(result.error)throw result.error
      }
      setSettingForm(false);onToast(settingEditing?'Setting updated.':'Setting saved.');await load(true)
    }catch(err){onToast(userFacingError(err,'The setting could not be saved.'),true)}finally{setSaving(false)}
  }
  async function removeSetting(row:Setting){
    if(!supabase||!admin||saving||!window.confirm('Delete '+row.category+'/'+row.setting_key+'?'))return
    setSaving(true)
    try{
      const {error:removeError}=await supabase.from('institution_settings').delete().eq('institution_id',user!.institutionId).eq('id',row.id)
      if(removeError)throw removeError
      onToast('Setting deleted.')
      await load(true)
    }catch(err){onToast(userFacingError(err,'The setting could not be deleted.'),true)}
    finally{setSaving(false)}
  }

  async function saveProfile(event:FormEvent){
    event.preventDefault();if(!supabase||!admin)return
    if(!profileDraft.name.trim()){onToast('Institution name is required.',true);return}
    const email=profileDraft.email.trim()
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){onToast('Enter a valid institution email address.',true);return}
    const websiteInput=profileDraft.website.trim()
    let normalizedWebsite:string|null=null
    if(websiteInput){
      try{
        const parsedWebsite=new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(websiteInput)?websiteInput:'https://'+websiteInput)
        if(!['https:','http:'].includes(parsedWebsite.protocol)||!parsedWebsite.hostname)throw new Error('Unsupported website address.')
        normalizedWebsite=parsedWebsite.toString()
      }catch{onToast('Enter a valid HTTP or HTTPS website address.',true);return}
    }
    setSaving(true);let uploadedPath:string|undefined
    try{
      if(logoFile){
        if(!['image/png','image/jpeg','image/webp'].includes(logoFile.type))throw new Error('Use a PNG, JPG or WebP logo image.')
        if(logoFile.size>5*1024*1024)throw new Error('The institution logo must be 5 MB or smaller.')
        const extension=logoFile.type==='image/png'?'png':logoFile.type==='image/webp'?'webp':'jpg'
        uploadedPath=user!.institutionId+'/branding/logo-'+Date.now()+'.'+extension
        const {error:uploadError}=await supabase.storage.from('institution-files').upload(uploadedPath,logoFile,{contentType:logoFile.type,upsert:false})
        if(uploadError)throw uploadError
      }
      const values={...profileDraft,name:profileDraft.name.trim(),email:email||null,website:normalizedWebsite,phone:profileDraft.phone.trim()||null,tagline:profileDraft.tagline.trim()||null,address:profileDraft.address.trim()||null,country:profileDraft.country.trim()||null,...(uploadedPath?{logo_path:uploadedPath}:{})}
      const {error:updateError}=await supabase.from('institutions').update(values).eq('id',user!.institutionId)
      if(updateError)throw updateError
      if(uploadedPath&&institution?.logo_path)await supabase.storage.from('institution-files').remove([institution.logo_path])
      setLogoFile(null);onToast('Institution profile updated.');await load(true)
    }catch(err){if(uploadedPath)await supabase.storage.from('institution-files').remove([uploadedPath]);onToast(userFacingError(err,'The institution profile could not be updated.'),true)}
    finally{setSaving(false)}
  }

  function openPolicy(row?:Policy){
    setPolicyEditing(row??null);setPolicyTitle(row?.title??'');setPolicyCode(row?.reference_code??'')
    setPolicyCategory(String(jsonObject(row?.payload).category??(section==='policies-faculty'?'faculty':'student')));setPolicyDescription(row?.description??'')
    setPolicyStatus(row?.status??'draft');setPolicyEffectiveDate(row?.effective_date??'');setPolicyForm(true)
  }
  async function savePolicy(event:FormEvent){
    event.preventDefault();if(!supabase||!admin)return
    if(!policyTitle.trim()){onToast('Enter a policy title.',true);return}
    setSaving(true)
    const previousPayload=jsonObject(policyEditing?.payload)
    const payload={...previousPayload,category:policyCategory,revision:Number(previousPayload.revision??0)+1}
    const values={institution_id:user!.institutionId,module_key:'administration',record_type:'institutional-policy',title:policyTitle.trim(),reference_code:policyCode.trim()||null,description:policyDescription.trim()||null,status:policyStatus,approval_status:'not_required',visibility:'staff_only',effective_date:policyEffectiveDate||null,payload,updated_by:user!.id,updated_at:new Date().toISOString()}
    try{
      const result=policyEditing?await supabase.from('institutional_records').update(values).eq('institution_id',user!.institutionId).eq('id',policyEditing.id):await supabase.from('institutional_records').insert({...values,created_by:user!.id})
      if(result.error)throw result.error
      setPolicyForm(false);onToast(policyEditing?'Policy revision saved.':'Policy created.');await load(true)
    }catch(err){onToast(userFacingError(err,'The policy could not be saved.'),true)}finally{setSaving(false)}
  }
  async function removePolicy(row:Policy){
    if(!supabase||!admin||!window.confirm('Delete policy “'+row.title+'”? Its audit event remains available to administrators.'))return
    setSaving(true)
    try{
      const {error:removeError}=await supabase.from('institutional_records').delete().eq('institution_id',user!.institutionId).eq('id',row.id)
      if(removeError)throw removeError
      onToast('Policy removed.')
      await load(true)
    }catch(err){
      onToast(userFacingError(err,'The policy could not be deleted.'),true)
    }finally{
      setSaving(false)
    }
  }
  async function submitApproval(event:FormEvent){
    event.preventDefault();if(!supabase)return
    let parsed:unknown;try{parsed=JSON.parse(approvalValue)}catch{onToast('Enter a valid JSON setting value.',true);return}
    if(!approvalKey.trim()){onToast('Enter a setting key.',true);return}
    setSaving(true)
    try{
      const {error:requestError}=await supabase.from('workflow_approvals').insert({institution_id:user!.institutionId,workflow_key:'institution_setting_change',target_type:'institution_settings',target_id:crypto.randomUUID(),requested_by:user!.id,status:'pending',payload:{category:'general',setting_key:approvalKey.trim(),setting_value:parsed,is_public:approvalPublic,request_notes:approvalNotes.trim()||null}})
      if(requestError)throw requestError
      setApprovalForm(false);setApprovalKey('');setApprovalValue('{}');setApprovalNotes('')
      onToast('Approval request submitted.')
      await load(true)
    }catch(err){
      onToast(userFacingError(err,'Approval request could not be submitted.'),true)
    }finally{
      setSaving(false)
    }
  }
  async function decideApproval(row:Approval,decision:'approved'|'rejected'){
    if(!supabase||!admin)return
    const notes=window.prompt(decision==='approved'?'Optional approval note:':'Reason for rejection (recommended):','')??''
    if(decision==='rejected'&&!notes.trim()){onToast('Add a reason before rejecting this request.',true);return}
    setSaving(true)
    try{
      const {error:decisionError}=await supabase.rpc('decide_institution_setting_approval',{p_institution_id:user!.institutionId,p_approval_id:row.id,p_decision:decision,p_notes:notes})
      if(decisionError)throw decisionError
      onToast(decision==='approved'?'Approved and applied.':'Request rejected.')
      await load(true)
    }catch(err){
      onToast(userFacingError(err,'Approval decision could not be saved.'),true)
    }finally{
      setSaving(false)
    }
  }

  async function changeMembershipStatus(member:Member){
    if(!supabase||!admin)return
    if(member.role==='owner'){
      onToast('The institution owner membership cannot be suspended from this workspace.',true)
      return
    }
    if(member.user_id===user?.id){
      onToast('You cannot change the access status of your own account.',true)
      return
    }
    if(!['active','suspended'].includes(member.status)){
      onToast('Pending and invited memberships must be completed through account provisioning.',true)
      return
    }
    const nextStatus=member.status==='active'?'suspended':'active'
    const displayName=member.full_name||member.email||'this member'
    if(!window.confirm(`${nextStatus==='suspended'?'Suspend':'Reactivate'} access for ${displayName}?`))return
    setMembershipSavingId(member.id)
    try{
      const {error:statusError}=await supabase.rpc('set_institution_membership_status',{
        p_institution_id:user!.institutionId,
        p_membership_id:member.id,
        p_status:nextStatus,
      })
      if(statusError)throw statusError
      onToast(nextStatus==='suspended'?'Institution access suspended.':'Institution access reactivated.')
      await load(true)
    }catch(err){
      onToast(userFacingError(err,'The membership access status could not be changed.'),true)
    }finally{
      setMembershipSavingId(null)
    }
  }

  async function saveInstitutePreferences(event:FormEvent){
    event.preventDefault()
    if(!supabase||!admin)return
    const allowedTimezones=['Asia/Karachi','UTC']
    const allowedDateFormats=['dd MMM yyyy','dd/MM/yyyy','yyyy-MM-dd']
    const allowedCurrencies=['PKR','USD','GBP']
    const allowedTermStructures=['annual','semester','trimester','quarter']
    const startMonth=Number(institutePreferences.academic_year_start_month)
    const studentPrefix=institutePreferences.student_id_prefix.trim().toUpperCase()
    const employeePrefix=institutePreferences.employee_id_prefix.trim().toUpperCase()
    const prefixPattern=/^[A-Z0-9][A-Z0-9-]{1,15}$/
    if(!allowedTimezones.includes(institutePreferences.timezone)){onToast('Choose a supported institution time zone.',true);return}
    if(!allowedDateFormats.includes(institutePreferences.date_format)){onToast('Choose a supported date format.',true);return}
    if(!allowedCurrencies.includes(institutePreferences.currency)){onToast('Choose a supported currency.',true);return}
    if(!Number.isInteger(startMonth)||startMonth<1||startMonth>12){onToast('Choose an academic year start month from January to December.',true);return}
    if(!allowedTermStructures.includes(institutePreferences.term_structure)){onToast('Choose a supported academic term structure.',true);return}
    if(!prefixPattern.test(studentPrefix)||!prefixPattern.test(employeePrefix)){onToast('Student and employee ID prefixes must be 2–16 characters using letters, numbers or hyphens.',true);return}
    const preferences={...institutePreferences,academic_year_start_month:String(startMonth),student_id_prefix:studentPrefix,employee_id_prefix:employeePrefix}
    setInstitutePreferences(preferences)
    setSaving(true)
    const values={category:'general',setting_key:'institution_preferences',setting_value:preferences,is_public:false,updated_by:user!.id,updated_at:new Date().toISOString()}
    try{
      const {data:existing,error:lookupError}=await supabase.from('institution_settings').select('id').eq('institution_id',user!.institutionId).eq('category','general').eq('setting_key','institution_preferences').is('campus_id',null).maybeSingle()
      if(lookupError)throw lookupError
      const result=existing
        ?await supabase.from('institution_settings').update(values).eq('institution_id',user!.institutionId).eq('id',existing.id)
        :await supabase.from('institution_settings').insert({...values,institution_id:user!.institutionId})
      if(result.error)throw result.error
      onToast('Institute settings saved.')
      await load(true)
    }catch(err){onToast(userFacingError(err,'Institute settings could not be saved.'),true)}
    finally{setSaving(false)}
  }

  function renderInstituteSettings(){
    const update=(key:keyof InstitutePreferences,value:string)=>setInstitutePreferences(current=>({...current,[key]:value}))
    return <div className="ed360-admin-settings-page">
      <section className="gov-panel ed360-admin-settings-card">
        <header><div><h2>Institute preferences</h2><p>Set the defaults used by this college’s internal registers and generated records.</p></div><Building2 size={22}/></header>
        <form className="ed360-admin-preferences-form" onSubmit={saveInstitutePreferences}>
          <label>Time zone<select value={institutePreferences.timezone} onChange={e=>update('timezone',e.target.value)}><option value="Asia/Karachi">Pakistan Standard Time · Asia/Karachi</option><option value="UTC">Coordinated Universal Time · UTC</option></select></label>
          <label>Date format<select value={institutePreferences.date_format} onChange={e=>update('date_format',e.target.value)}><option value="dd MMM yyyy">14 Nov 2026</option><option value="dd/MM/yyyy">14/11/2026</option><option value="yyyy-MM-dd">2026-11-14</option></select></label>
          <label>Currency<select value={institutePreferences.currency} onChange={e=>update('currency',e.target.value)}><option value="PKR">Pakistani Rupee · PKR</option><option value="USD">US Dollar · USD</option><option value="GBP">Pound Sterling · GBP</option></select></label>
          <label>Academic year starts<select value={institutePreferences.academic_year_start_month} onChange={e=>update('academic_year_start_month',e.target.value)}>{['January','February','March','April','May','June','July','August','September','October','November','December'].map((month,index)=><option key={month} value={String(index+1)}>{month}</option>)}</select></label>
          <label>Academic term structure<select value={institutePreferences.term_structure} onChange={e=>update('term_structure',e.target.value)}><option value="annual">Annual session</option><option value="semester">Two semesters</option><option value="trimester">Three terms</option><option value="quarter">Four terms</option></select></label>
          <label>Student ID prefix<input maxLength={16} value={institutePreferences.student_id_prefix} onChange={e=>update('student_id_prefix',e.target.value.toUpperCase())}/></label>
          <label>Employee ID prefix<input maxLength={16} value={institutePreferences.employee_id_prefix} onChange={e=>update('employee_id_prefix',e.target.value.toUpperCase())}/></label>
          <div className="ed360-admin-preferences-footer"><span>These defaults are private to the college and do not publish website settings.</span><button className="gov-button primary" disabled={saving}><Save size={14}/>{saving?'Saving…':'Save institute settings'}</button></div>
        </form>
      </section>
      <section className="ed360-admin-preferences-note"><span><ShieldCheck size={18}/></span><div><strong>College defaults</strong><p>New forms can use these settings as defaults. Existing academic, finance and staff records are not modified by changing preferences.</p></div></section>
    </div>
  }

  function renderSettingRows(rows:Setting[],empty:string){
    return rows.length?<div className="gov-table-wrap"><table className="ed360-admin-table"><thead><tr>{sortHeader('Category','category')}{sortHeader('Key','setting_key')}<th>Value</th>{sortHeader('Visibility','is_public')}<th>Actions</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{label(row.category)}</td><td><b>{row.setting_key}</b></td><td><code>{JSON.stringify(row.setting_value)}</code></td><td>{row.is_public?'Public':'Private'}</td><td><div className="gov-row-actions"><button className="gov-button" onClick={()=>openSetting(row)}>Edit</button><button className="gov-button danger" onClick={()=>void removeSetting(row)}>Delete</button></div></td></tr>)}</tbody></table></div>:<div className="gov-empty">{empty}</div>
  }
  function renderProfile(){
    const previewLogo=logoPreviewUrl||logoUrl
    const institutionName=profileDraft.name.trim()||'Government Islamia Degree College'
    return <div className="ed360-admin-profile-v2">
      <nav className="ed360-admin-profile-nav" aria-label="Institute profile sections">
        <a href="#institute-identity"><Building2 size={15}/> Institute Identity</a>
        <a href="#institute-contact"><Users size={15}/> Contact Details</a>
        <a href="#institute-public-profile"><ArrowUpRight size={15}/> Public Profile</a>
      </nav>
      <form className="ed360-admin-profile-form-v2" onSubmit={saveProfile}>
        <section className="gov-panel ed360-profile-section" id="institute-identity">
          <header><div><span className="ed360-profile-kicker">OFFICIAL RECORD</span><h2>Institute Identity</h2><p>Legal name, institute category and official emblem.</p></div><span className="ed360-profile-index">01</span></header>
          <div className="ed360-profile-identity-grid">
            <label className="ed360-admin-field">Official institute name *<input required maxLength={180} value={profileDraft.name} onChange={e=>setProfileDraft(v=>({...v,name:e.target.value}))} placeholder="Enter the official institute name"/></label>
            <label className="ed360-admin-field">Institute category<select value={profileDraft.institution_type} onChange={e=>setProfileDraft(v=>({...v,institution_type:e.target.value}))}><option value="school">School</option><option value="college">College</option><option value="university">University</option><option value="multi_institution">Multi-institution</option></select></label>
            <div className="ed360-profile-logo-field">
              <div className="ed360-profile-logo-preview">{previewLogo?<img src={previewLogo} alt="Institute emblem preview"/>:<span>{(institutionName||'I').slice(0,1).toUpperCase()}</span>}</div>
              <div className="ed360-profile-logo-copy"><b>Official institute emblem</b><small>PNG, JPG or WebP · maximum 5 MB</small><label className="gov-button ed360-profile-upload"><Upload size={14}/> {logoFile?'Choose another logo':'Upload emblem'}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>setLogoFile(e.target.files?.[0]??null)}/></label>{logoFile&&<button type="button" className="ed360-profile-clear-file" onClick={()=>setLogoFile(null)}>Discard selected file</button>}</div>
            </div>
          </div>
        </section>

        <section className="gov-panel ed360-profile-section" id="institute-contact">
          <header><div><span className="ed360-profile-kicker">OFFICIAL CHANNELS</span><h2>Contact Details</h2><p>Verified contact channels and registered postal address.</p></div><span className="ed360-profile-index">02</span></header>
          <div className="ed360-profile-contact-grid">
            <label className="ed360-admin-field">Official phone<input type="tel" maxLength={40} value={profileDraft.phone} onChange={e=>setProfileDraft(v=>({...v,phone:e.target.value}))} placeholder="+92 …"/></label>
            <label className="ed360-admin-field">Official email<input type="email" maxLength={180} value={profileDraft.email} onChange={e=>setProfileDraft(v=>({...v,email:e.target.value}))} placeholder="office@institution.edu"/></label>
            <label className="ed360-admin-field ed360-profile-span">Registered address<textarea rows={3} maxLength={500} value={profileDraft.address} onChange={e=>setProfileDraft(v=>({...v,address:e.target.value}))} placeholder="Street, area, city and district"/></label>
            <label className="ed360-admin-field">Country<input maxLength={80} value={profileDraft.country} onChange={e=>setProfileDraft(v=>({...v,country:e.target.value}))} placeholder="Pakistan"/></label>
          </div>
        </section>

        <section className="gov-panel ed360-profile-section" id="institute-public-profile">
          <header><div><span className="ed360-profile-kicker">PUBLIC-FACING INFORMATION</span><h2>Public Profile</h2><p>The short introduction and website shown in the institute profile preview.</p></div><span className="ed360-profile-index">03</span></header>
          <div className="ed360-profile-public-grid">
            <label className="ed360-admin-field ed360-profile-span">Official tagline<input maxLength={220} value={profileDraft.tagline} onChange={e=>setProfileDraft(v=>({...v,tagline:e.target.value}))} placeholder="A short official description of the institution"/></label>
            <label className="ed360-admin-field ed360-profile-span">Official website<input type="text" inputMode="url" maxLength={240} value={profileDraft.website} onChange={e=>setProfileDraft(v=>({...v,website:e.target.value}))} placeholder="https://www.example.edu"/></label>
          </div>
          
        </section>

        <div className="ed360-profile-savebar"><button type="submit" className="gov-button primary" disabled={saving}>{saving?'Saving profile…':'Save Institute Profile'} <Save size={15}/></button></div>
      </form>

      <aside className="ed360-profile-preview-panel">
        <div className="ed360-profile-preview-heading"><div><span className="ed360-profile-kicker">LIVE PREVIEW</span><h2>Official Institute Identity</h2></div><span className="ed360-profile-preview-state">Preview</span></div>
        <article className="ed360-profile-public-card">
          <div className="ed360-profile-card-accent"/>
          <header>
            <div className="ed360-profile-card-logo">{previewLogo?<img src={previewLogo} alt="Institute emblem"/>:<span>{institutionName.slice(0,1).toUpperCase()}</span>}</div>
            <div><span>OFFICIAL INSTITUTION</span><h3>{institutionName}</h3><p>{label(profileDraft.institution_type)}{profileDraft.country?' · '+profileDraft.country:''}</p></div>
          </header>
          {profileDraft.tagline&&<p className="ed360-profile-card-tagline">{profileDraft.tagline}</p>}
          <div className="ed360-profile-card-details">
            <div><small>PHONE</small><b>{profileDraft.phone||'Not provided'}</b></div>
            <div><small>EMAIL</small><b>{profileDraft.email||'Not provided'}</b></div>
            <div><small>ADDRESS</small><b>{profileDraft.address||'Not provided'}</b></div>
            <div><small>WEBSITE</small><b>{profileDraft.website||'Not provided'}</b></div>
          </div>
          <footer><span>{displayInstitutionName(institutionName)}</span><span>GIDC BADIN</span></footer>
        </article>
        <p className="ed360-profile-preview-caption">This preview reflects the form values. The official institute record changes only after saving.</p>
      </aside>
    </div>
  }
  function renderDepartments(){
    const q=search.trim().toLowerCase()
    const filtered=departments.filter(row=>{
      const status=row.is_active===false||row.status==='inactive'?'inactive':'active'
      return (departmentStatusFilter==='all'||status===departmentStatusFilter)&&[row.name,row.department_code,row.head_name,row.email,row.phone].join(' ').toLowerCase().includes(q)
    })
    const departmentRows=[...filtered].sort((a,b)=>{
      const left=departmentSortKey==='status'?(a.is_active===false||a.status==='inactive'?'inactive':'active'):String(a[departmentSortKey]??'')
      const right=departmentSortKey==='status'?(b.is_active===false||b.status==='inactive'?'inactive':'active'):String(b[departmentSortKey]??'')
      const comparison=left.localeCompare(right,undefined,{numeric:true,sensitivity:'base'})
      return departmentSortDirection==='asc'?comparison:-comparison
    })
    const pageCount=Math.max(1,Math.ceil(departmentRows.length/pageSize))
    const currentPage=Math.min(departmentPage,pageCount)
    const pageRows=departmentRows.slice((currentPage-1)*pageSize,currentPage*pageSize)
    const reportRows:Record<string,unknown>[]=departmentRows.map(row=>({code:row.department_code??row.code??'',department:row.name,head:row.head_name??'',email:row.email??'',phone:row.phone??'',status:row.is_active===false||row.status==='inactive'?'Inactive':'Active'}))
    const reportColumns:OfficeColumn[]=[{key:'code',label:'Department code'},{key:'department',label:'Department'},{key:'head',label:'Department head'},{key:'email',label:'Email'},{key:'phone',label:'Phone'},{key:'status',label:'Status'}]
    return <div className="ed360-admin-directory-page">
      <section className="gov-panel ed360-admin-directory-card">
        <header><div><h2>Department records</h2><p>{departmentRows.length} matching departments · {departments.length} total institution departments</p></div><button className="gov-button primary" onClick={()=>onNavigate('admin:departments')}>Open Department Manager <ArrowUpRight size={14}/></button></header>
        <div className="ed360-admin-kpis"><article><small>Departments</small><strong>{departments.length}</strong></article><article><small>Active departments</small><strong>{departments.filter(d=>d.is_active!==false&&d.status!=='inactive').length}</strong></article><article><small>Department heads</small><strong>{departments.filter(d=>Boolean(d.head_name)).length}</strong></article></div>
        {reportActions('Department directory','department-directory',reportRows,reportColumns)}
        <div className="ed360-admin-directory-filters">
          <label>Status<select value={departmentStatusFilter} onChange={e=>{setDepartmentStatusFilter(e.target.value as typeof departmentStatusFilter);setDepartmentPage(1)}}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label>Order by<select value={departmentSortKey} onChange={e=>{setDepartmentSortKey(e.target.value as typeof departmentSortKey);setDepartmentPage(1)}}><option value="name">Department name</option><option value="department_code">Department code</option><option value="head_name">Department head</option><option value="status">Status</option></select></label>
          <button type="button" className="gov-button" onClick={()=>{setDepartmentSortDirection(value=>value==='asc'?'desc':'asc');setDepartmentPage(1)}} aria-label={'Sort '+(departmentSortDirection==='asc'?'descending':'ascending')}>{departmentSortDirection==='asc'?'Ascending ↑':'Descending ↓'}</button>
          <label className="ed360-admin-directory-search"><Search size={14}/><input value={search} onChange={e=>{setSearch(e.target.value);setDepartmentPage(1)}} placeholder="Search department, code, head or contact…"/></label>
        </div>
        {departmentRows.length?<div className="gov-table-wrap"><table className="ed360-admin-table"><thead><tr><th>Code</th><th>Department</th><th>Department head</th><th>Contact</th><th>Status</th></tr></thead><tbody>{pageRows.map(row=><tr key={row.id}><td>{String(row.department_code??row.code??'—')}</td><td><b>{row.name}</b></td><td>{String(row.head_name??'Not assigned')}</td><td>{String(row.email??row.phone??'—')}</td><td><span className={'ed360-admin-status '+(row.is_active===false||row.status==='inactive'?'inactive':'')}>{row.is_active===false||row.status==='inactive'?'Inactive':'Active'}</span></td></tr>)}</tbody></table></div>:<div className="gov-empty">No departments match these filters. Clear the search or status filter, or create a department in the Department Manager.</div>}
        {pageControls(departmentRows.length,currentPage,pageCount,setDepartmentPage)}
      </section>
    </div>
  }
  function renderDesignations(){
    const q=search.trim().toLowerCase()
    const filtered=designations.filter(row=>{
      const status=row.is_active?'active':'inactive'
      return (designationStatusFilter==='all'||status===designationStatusFilter)&&[row.name,row.code,departments.find(d=>d.id===row.department_id)?.name].join(' ').toLowerCase().includes(q)
    })
    const designationRows=[...filtered].sort((a,b)=>{
      const departmentA=departments.find(d=>d.id===a.department_id)?.name??''
      const departmentB=departments.find(d=>d.id===b.department_id)?.name??''
      const left=designationSortKey==='department'?departmentA:designationSortKey==='status'?(a.is_active?'active':'inactive'):String(a[designationSortKey]??'')
      const right=designationSortKey==='department'?departmentB:designationSortKey==='status'?(b.is_active?'active':'inactive'):String(b[designationSortKey]??'')
      const comparison=left.localeCompare(right,undefined,{numeric:true,sensitivity:'base'})
      return designationSortDirection==='asc'?comparison:-comparison
    })
    const pageCount=Math.max(1,Math.ceil(designationRows.length/pageSize))
    const currentPage=Math.min(designationPage,pageCount)
    const pageRows=designationRows.slice((currentPage-1)*pageSize,currentPage*pageSize)
    const reportRows:Record<string,unknown>[]=designationRows.map(row=>({designation:row.name,code:row.code??'',department:departments.find(d=>d.id===row.department_id)?.name??'Institution-wide',employee_count:teachers.filter(person=>person.designation_id===row.id).length,status:row.is_active?'Active':'Inactive'}))
    const reportColumns:OfficeColumn[]=[{key:'designation',label:'Designation'},{key:'code',label:'Code'},{key:'department',label:'Department'},{key:'employee_count',label:'Assigned employees'},{key:'status',label:'Status'}]
    return <div className="ed360-admin-directory-page">
      <section className="gov-panel ed360-admin-directory-card">
        <header><div><h2>Designation Catalogue</h2><p>{designationRows.length} matching designations · {designations.length} total institution positions</p></div><button className="gov-button primary" onClick={()=>onNavigate('employees:designations')}>Open Designation Manager <ArrowUpRight size={14}/></button></header>
        <div className="ed360-admin-kpis"><article><small>Designations</small><strong>{designations.length}</strong></article><article><small>Active positions</small><strong>{designations.filter(row=>row.is_active).length}</strong></article><article><small>Department-linked</small><strong>{designations.filter(row=>Boolean(row.department_id)).length}</strong></article></div>
        {reportActions('Designation catalogue','designation-catalogue',reportRows,reportColumns)}
        <div className="ed360-admin-directory-filters">
          <label>Status<select value={designationStatusFilter} onChange={e=>{setDesignationStatusFilter(e.target.value as typeof designationStatusFilter);setDesignationPage(1)}}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label>Order by<select value={designationSortKey} onChange={e=>{setDesignationSortKey(e.target.value as typeof designationSortKey);setDesignationPage(1)}}><option value="name">Designation</option><option value="code">Code</option><option value="department">Department</option><option value="status">Status</option></select></label>
          <button type="button" className="gov-button" onClick={()=>{setDesignationSortDirection(value=>value==='asc'?'desc':'asc');setDesignationPage(1)}} aria-label={'Sort '+(designationSortDirection==='asc'?'descending':'ascending')}>{designationSortDirection==='asc'?'Ascending ↑':'Descending ↓'}</button>
          <label className="ed360-admin-directory-search"><Search size={14}/><input value={search} onChange={e=>{setSearch(e.target.value);setDesignationPage(1)}} placeholder="Search designation, code or department…"/></label>
        </div>
        {designationRows.length?<div className="gov-table-wrap"><table className="ed360-admin-table"><thead><tr><th>Designation</th><th>Code</th><th>Department</th><th>Assigned employees</th><th>Status</th></tr></thead><tbody>{pageRows.map(row=><tr key={row.id}><td><b>{row.name}</b></td><td>{row.code??'—'}</td><td>{departments.find(d=>d.id===row.department_id)?.name??'Institution-wide'}</td><td>{teachers.filter(person=>person.designation_id===row.id).length}</td><td><span className={'ed360-admin-status '+(!row.is_active?'inactive':'')}>{row.is_active?'Active':'Inactive'}</span></td></tr>)}</tbody></table></div>:<div className="gov-empty">No designations match these filters. Clear the search or status filter, or add a position in the Designation Manager.</div>}
        {pageControls(designationRows.length,currentPage,pageCount,setDesignationPage)}
      </section>
    </div>
  }
  function renderOrganization(){
    const ownerMembers=members.filter(row=>row.role==='owner'),adminMembers=members.filter(row=>row.role==='admin')
    const filteredStaff=teachers.filter(person=>{
      const departmentName=departments.find(d=>d.id===person.department_id)?.name??person.department??'Not assigned'
      const designationName=designations.find(d=>d.id===person.designation_id)?.name??'Not assigned'
      return (orgDepartmentFilter==='all'||person.department_id===orgDepartmentFilter)&&
        (orgDesignationFilter==='all'||person.designation_id===orgDesignationFilter)&&
        (orgEmploymentFilter==='all'||String(person.employment_status??'not recorded')===orgEmploymentFilter)&&
        [person.full_name,departmentName,designationName,person.employment_status,person.campus_id].join(' ').toLowerCase().includes(orgSearch.trim().toLowerCase())
    })
    const orderedStaff=[...filteredStaff].sort((a,b)=>{
      const value=(person:Teacher)=>{
        if(orgSortKey==='department')return departments.find(d=>d.id===person.department_id)?.name??person.department??'Not assigned'
        if(orgSortKey==='designation')return designations.find(d=>d.id===person.designation_id)?.name??'Not assigned'
        return String(person[orgSortKey]??'')
      }
      const comparison=value(a).localeCompare(value(b),undefined,{numeric:true,sensitivity:'base'})
      return orgSortDirection==='asc'?comparison:-comparison
    })
    const pageCount=Math.max(1,Math.ceil(orderedStaff.length/pageSize))
    const currentPage=Math.min(orgPage,pageCount)
    const pageRows=orderedStaff.slice((currentPage-1)*pageSize,currentPage*pageSize)
    const employmentStatuses=[...new Set(teachers.map(person=>String(person.employment_status??'not recorded')))].sort()
    const reportRows:Record<string,unknown>[]=orderedStaff.map(person=>({
      employee:person.full_name,
      department:departments.find(d=>d.id===person.department_id)?.name??person.department??'Not assigned',
      designation:designations.find(d=>d.id===person.designation_id)?.name??'Not assigned',
      employment_status:label(person.employment_status??'not recorded'),
      campus:person.campus_id??''
    }))
    const reportColumns:OfficeColumn[]=[{key:'employee',label:'Employee'},{key:'department',label:'Department'},{key:'designation',label:'Designation'},{key:'employment_status',label:'Employment status'},{key:'campus',label:'Campus ID'}]
    return <div className="ed360-admin-organization-page">
      <section className="gov-panel ed360-admin-organization-card">
        <header><div><h2>Reporting layers</h2><p>College authority, administration, department leadership and employee assignments.</p></div><div className="gov-row-actions"><button className="gov-button" onClick={()=>onNavigate('admin:departments')}>Departments <ArrowUpRight size={13}/></button><button className="gov-button" onClick={()=>onNavigate('employees:designations')}>Designations <ArrowUpRight size={13}/></button><button className="gov-button" onClick={()=>onNavigate('teachers')}>Faculty &amp; staff <ArrowUpRight size={13}/></button></div></header>
        <div className="ed360-admin-kpis"><article><small>Departments</small><strong>{departments.length}</strong></article><article><small>Faculty & staff records</small><strong>{teachers.length}</strong></article><article><small>Designations</small><strong>{designations.length}</strong></article><article><small>Administrators</small><strong>{adminMembers.length}</strong></article></div>
        <div className="ed360-admin-org">
          <div className="ed360-admin-org-root"><span>COLLEGE AUTHORITY</span><b>{ownerMembers.map(row=>row.full_name).join(', ')||'Institution Owner'}</b><small>Institute owner · highest authority</small></div>
          <div className="ed360-admin-org-connector" aria-hidden="true"/>
          <div className="ed360-admin-org-admins">{adminMembers.map(row=><span key={row.user_id}><b>{row.full_name}</b><br/>Administrator</span>)}</div>
          <div className="ed360-admin-org-departments">{departments.map(department=>{
            const people=teachers.filter(person=>person.department_id===department.id||(person.department_id==null&&person.department===department.name))
            return <article className="ed360-admin-org-department" key={department.id}>
              <header><div><h3>{department.name}</h3><p>{String(department.department_code??department.code??'Department')} · {String(department.head_name??'Head not assigned')}</p></div><span className="ed360-admin-status">{people.length} staff</span></header>
              {people.length?<details className="ed360-admin-org-staff-details"><summary>View assigned employees</summary><div className="ed360-admin-org-staff">{people.map(person=><span key={person.id}><b>{person.full_name}</b><small>{designations.find(d=>d.id===person.designation_id)?.name??'Position not assigned'}</small></span>)}</div></details>:<div className="ed360-admin-org-empty">No employee records are assigned to this department yet.</div>}
            </article>
          })}</div>
        </div>
      </section>
      <section className="gov-panel ed360-admin-organization-roster">
        <header><div><h2>Faculty and staff roster</h2><p>{orderedStaff.length} matching employees · {teachers.length} total institution employee records</p></div></header>
        {reportActions('Faculty and staff organization roster','organization-staff-roster',reportRows,reportColumns)}
        <div className="ed360-admin-organization-filters">
          <label>Department<select value={orgDepartmentFilter} onChange={e=>{setOrgDepartmentFilter(e.target.value);setOrgPage(1)}}><option value="all">All departments</option>{departments.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label>Designation<select value={orgDesignationFilter} onChange={e=>{setOrgDesignationFilter(e.target.value);setOrgPage(1)}}><option value="all">All designations</option>{designations.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label>Employment status<select value={orgEmploymentFilter} onChange={e=>{setOrgEmploymentFilter(e.target.value);setOrgPage(1)}}><option value="all">All statuses</option>{employmentStatuses.map(status=><option key={status} value={status}>{label(status)}</option>)}</select></label>
          <label>Order by<select value={orgSortKey} onChange={e=>{setOrgSortKey(e.target.value as typeof orgSortKey);setOrgPage(1)}}><option value="department">Department</option><option value="designation">Designation</option><option value="full_name">Employee name</option><option value="employment_status">Employment status</option></select></label>
          <button type="button" className="gov-button" onClick={()=>{setOrgSortDirection(value=>value==='asc'?'desc':'asc');setOrgPage(1)}} aria-label={'Sort '+(orgSortDirection==='asc'?'descending':'ascending')}>{orgSortDirection==='asc'?'Ascending ↑':'Descending ↓'}</button>
          <label className="ed360-admin-organization-search"><Search size={14}/><input value={orgSearch} onChange={e=>{setOrgSearch(e.target.value);setOrgPage(1)}} placeholder="Search employee, department or position…"/></label>
        </div>
        {orderedStaff.length?<div className="gov-table-wrap"><table className="ed360-admin-table"><thead><tr><th>Employee</th><th>Department</th><th>Designation</th><th>Employment status</th></tr></thead><tbody>{pageRows.map(person=><tr key={person.id}><td><b>{person.full_name}</b></td><td>{departments.find(d=>d.id===person.department_id)?.name??person.department??'Not assigned'}</td><td>{designations.find(d=>d.id===person.designation_id)?.name??'Not assigned'}</td><td>{label(person.employment_status??'not recorded')}</td></tr>)}</tbody></table></div>:<div className="gov-empty">No employee records match these filters. Clear a filter or search, or add an employee in Faculty & Staff Management.</div>}
        {pageControls(orderedStaff.length,currentPage,pageCount,setOrgPage)}
      </section>
    </div>
  }
  function renderAcademic(){
    const currentSessions=academicSessions.filter(row=>Boolean(row.is_current)||String(row.status??'').toLowerCase()==='active')
    return <div className="ed360-admin-academic-page">
      <section className="ed360-admin-kpis">
        <article><small>Academic sessions</small><strong>{academicSessions.length}</strong><em>{currentSessions.length} current / active</em></article>
        <article><small>Classes & sections</small><strong>{classes.length}</strong><em>College class register</em></article>
        <article><small>Programmes</small><strong>{programs.length}</strong><em>Programme catalogue</em></article>
        <article><small>Subjects</small><strong>{subjects.length}</strong><em>Subject catalogue</em></article>
        <article><small>Rooms</small><strong>{rooms.length}</strong><em>Teaching and campus spaces</em></article>
      </section>
      <div className="ed360-admin-academic-grid">
        <section className="gov-panel"><header><div><h2>Academic sessions</h2><p>Saved academic years and their current status.</p></div><button className="gov-button" onClick={()=>onNavigate('admin:academic_sessions')}>Manage sessions <ArrowUpRight size={14}/></button></header>
          {academicSessions.length?<div className="gov-table-wrap"><table className="ed360-admin-table"><thead><tr><th>Session</th><th>Start</th><th>End</th><th>Status</th></tr></thead><tbody>{academicSessions.map(row=><tr key={row.id}><td><b>{String(row.session_name??row.name??'Academic session')}</b></td><td>{dateLabel(row.start_date)}</td><td>{dateLabel(row.end_date)}</td><td>{label(row.status??(row.is_current?'current':'active'))}</td></tr>)}</tbody></table></div>:<div className="gov-empty">No academic sessions have been saved yet.</div>}
        </section>
        <section className="gov-panel"><header><div><h2>Classes and sections</h2><p>Classes, grade levels and section names currently on file.</p></div><button className="gov-button" onClick={()=>onNavigate('admin:classes')}>Manage classes <ArrowUpRight size={14}/></button></header>
          {classes.length?<div className="gov-table-wrap"><table className="ed360-admin-table"><thead><tr><th>Class</th><th>Grade / level</th><th>Section</th><th>Status</th></tr></thead><tbody>{classes.map(row=><tr key={row.id}><td><b>{String(row.name??'Class')}</b></td><td>{String(row.grade_level??'—')}</td><td>{String(row.section??'—')}</td><td>{row.is_active===false?'Inactive':'Active'}</td></tr>)}</tbody></table></div>:<div className="gov-empty">No classes or sections have been saved yet.</div>}
        </section>
        <section className="gov-panel"><header><div><h2>Programmes</h2><p>Institution programmes with their connected departments.</p></div><button className="gov-button" onClick={()=>onNavigate('admin:programs')}>Manage programmes <ArrowUpRight size={14}/></button></header>
          {programs.length?<div className="ed360-admin-academic-list">{programs.map(row=><article key={row.id}><b>{String(row.name??'Programme')}</b><span>{String(row.code??'No programme code')}</span><small>{departments.find(d=>d.id===row.department_id)?.name??'Department not assigned'}</small></article>)}</div>:<div className="gov-empty">No programmes have been saved yet.</div>}
        </section>
        <section className="gov-panel"><header><div><h2>Subjects</h2><p>Registered subjects and their available department links.</p></div><button className="gov-button" onClick={()=>onNavigate('admin:subjects')}>Manage subjects <ArrowUpRight size={14}/></button></header>
          {subjects.length?<div className="ed360-admin-academic-list">{subjects.map(row=><article key={row.id}><b>{String(row.name??'Subject')}</b><span>{String(row.code??'No subject code')}</span><small>{departments.find(d=>d.id===row.department_id)?.name??'Department not assigned'}</small></article>)}</div>:<div className="gov-empty">No subjects have been saved yet.</div>}
        </section>
        <section className="gov-panel"><header><div><h2>Rooms and teaching spaces</h2><p>Rooms available in the college facilities register.</p></div><button className="gov-button" onClick={()=>onNavigate('admin:rooms')}>Manage rooms <ArrowUpRight size={14}/></button></header>
          {rooms.length?<div className="ed360-admin-academic-list">{rooms.map(row=><article key={row.id}><b>{String(row.name??row.room_number??'Room')}</b><span>{String(row.code??row.room_type??'Teaching space')}</span><small>{String(row.building??row.location??'College campus')}</small></article>)}</div>:<div className="gov-empty">No rooms have been saved yet.</div>}
        </section>
      </div>
    </div>
  }

  function renderSettingsPage(){
    const reportRows:Record<string,unknown>[]=orderedSettings.map(row=>({category:label(row.category),key:row.setting_key,value:JSON.stringify(row.setting_value),visibility:row.is_public?'Public':'Private',updated_at:row.updated_at??''}))
    const reportColumns:OfficeColumn[]=[{key:'category',label:'Category'},{key:'key',label:'Setting key'},{key:'value',label:'Value'},{key:'visibility',label:'Visibility'},{key:'updated_at',label:'Last updated'}]
    return <div className="ed360-admin-stage5">
      {section==='branding'&&<section className="gov-panel ed360-admin-branding-panel"><header><div><h2>Institution brand identity</h2><p>Choose the primary and accent colours used as this institution’s branding defaults. The college emblem is managed in Institute Profile.</p></div><Palette size={20}/></header><div className="ed360-admin-brand-preview"><span className="ed360-admin-brand-swatch" style={{background:primaryColorDraft}}/><span><b>{displayInstitutionName(institution?.name)}</b><small>Primary colour · {primaryColorDraft}</small></span><span className="ed360-admin-brand-swatch" style={{background:accentColorDraft}}/><small>Accent colour · {accentColorDraft}</small></div><form className="ed360-admin-brand-colors" onSubmit={saveBrandColors}><label><span>Primary colour</span><input type="color" value={primaryColorDraft} onChange={event=>setPrimaryColorDraft(event.target.value)} aria-label="Primary institution brand colour"/></label><label><span>Accent colour</span><input type="color" value={accentColorDraft} onChange={event=>setAccentColorDraft(event.target.value)} aria-label="Accent institution brand colour"/></label><button type="submit" className="gov-button primary" disabled={saving}><Save size={14}/>{saving?'Saving colours…':'Save brand colours'}</button></form></section>}
      <section className="gov-panel ed360-admin-settings-table-panel"><header><div><h2>{section==='system'?'System settings register':'Brand and document defaults'}</h2></div><div className="gov-row-actions">{section==='branding'?<><button className="gov-button primary" onClick={()=>openSetting(undefined,'branding')}><Plus size={14}/> Add brand setting</button><button className="gov-button" onClick={()=>openSetting(undefined,'documents')}><FileText size={14}/> Add document setting</button></>:<button className="gov-button primary" onClick={()=>openSetting(undefined,'system')}><Plus size={14}/> Add system setting</button>}</div></header>
        {reportActions(section==='system'?'System settings':'Branding and document settings','institution-'+section+'-settings',reportRows,reportColumns)}
        <label className="ed360-admin-search"><Search size={14}/><input value={search} onChange={e=>{setSearch(e.target.value);setSettingsPage(1)}} placeholder="Search settings…"/></label>
        {renderSettingRows(settingsPageRows,section==='system'?'No system settings have been configured.':'No branding or document settings have been configured.')}
        {pageControls(orderedSettings.length,settingsCurrentPage,settingsPageCount,setSettingsPage)}
      </section>
    </div>
  }
  function renderApprovals(){
    const rows=orderedApprovals
    const reportRows:Record<string,unknown>[]=rows.map(row=>({
      workflow:label(row.workflow_key),target_type:label(row.target_type),target_id:row.target_id??'',
      status:label(row.status),requested_at:row.requested_at,
      requested_by:members.find(member=>member.user_id===row.requested_by)?.full_name??row.requested_by??'Institution member',
      request_notes:String(row.payload?.request_notes??''),decision_notes:row.decision_notes??'',
      setting:row.payload.setting_key??'',requested_value:JSON.stringify(row.payload.setting_value??'')
    }))
    const reportColumns:OfficeColumn[]=[
      {key:'workflow',label:'Workflow'},{key:'target_type',label:'Target type'},{key:'target_id',label:'Target ID'},
      {key:'status',label:'Status'},{key:'requested_at',label:'Requested at'},{key:'requested_by',label:'Requester'},
      {key:'request_notes',label:'Request rationale'},{key:'setting',label:'Setting key'},
      {key:'requested_value',label:'Requested value'},{key:'decision_notes',label:'Decision notes'}
    ]
    return <div className="ed360-admin-approval-page">
      <section className="gov-panel ed360-admin-approval-panel">
        <header><div><h2>Approval register</h2><p>{rows.length} matching workflow requests across the full institution history</p></div><div className="gov-header-actions"><span className="gov-pending">{pendingApprovals} pending in total</span><button className="gov-button primary" onClick={()=>setApprovalForm(true)}><Plus size={14}/> Request approval</button></div></header>
        {reportActions('Approval register','approval-workflows',reportRows,reportColumns)}
        <div className="ed360-admin-approval-filters">
          <label>Status
            <select value={approvalStatusFilter} onChange={e=>{setApprovalStatusFilter(e.target.value as typeof approvalStatusFilter);setApprovalPage(1)}}>
              <option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
            </select>
          </label>
          <label>Order by
            <select value={approvalSortKey} onChange={e=>{setApprovalSortKey(e.target.value as typeof approvalSortKey);setApprovalPage(1)}}>
              <option value="requested_at">Request date</option><option value="status">Status</option><option value="workflow_key">Workflow</option>
            </select>
          </label>
          <button type="button" className="gov-button" onClick={()=>{setApprovalSortDirection(value=>value==='asc'?'desc':'asc');setApprovalPage(1)}} aria-label={'Sort '+(approvalSortDirection==='asc'?'descending':'ascending')}>
            {approvalSortDirection==='asc'?'Ascending ↑':'Descending ↓'}
          </button>
          <label className="ed360-admin-approval-search"><Search size={14}/><input value={search} onChange={e=>{setSearch(e.target.value);setSettingsPage(1);setApprovalPage(1)}} placeholder="Search workflow, status, target or notes…"/></label>
        </div>
        {rows.length?<div className="gov-approval-list">{approvalPageRows.map(row=><article key={row.id}>
          <div className="gov-approval-heading"><div><small>{label(row.workflow_key)}</small><strong>{label(row.target_type)}</strong></div><span className={'gov-status '+row.status}>{label(row.status)}</span></div>
          <dl><div><dt>Requested</dt><dd>{dateLabel(row.requested_at)}</dd></div><div><dt>Requester</dt><dd>{members.find(member=>member.user_id===row.requested_by)?.full_name??String(row.requested_by??'Institution member')}</dd></div><div><dt>Target</dt><dd className="gov-mono">{String(row.target_id)}</dd></div></dl>
          {Boolean(row.payload?.request_notes)&&<div className="gov-decision-note"><b>Request rationale</b><p>{String(row.payload.request_notes)}</p></div>}
          {row.workflow_key==='institution_setting_change'&&<div className="gov-payload"><b>{String(row.payload.category??'general')} / {String(row.payload.setting_key??'setting')}</b><pre>{JSON.stringify(row.payload.setting_value??{},null,2)}</pre></div>}
          {row.decision_notes&&<p className="gov-decision-note"><b>Decision note</b> · {row.decision_notes}</p>}
          {admin&&row.status==='pending'&&row.workflow_key==='institution_setting_change'&&<div className="gov-row-actions"><button className="gov-button primary" disabled={saving} onClick={()=>void decideApproval(row,'approved')}><CheckCircle2 size={13}/> Approve and apply</button><button className="gov-button danger" disabled={saving} onClick={()=>void decideApproval(row,'rejected')}>Reject</button></div>}
          {admin&&row.status==='pending'&&row.workflow_key!=='institution_setting_change'&&<div className="gov-note">No decision handler is configured for this workflow type. It remains pending and cannot be approved from this page.</div>}
        </article>)}</div>:<div className="gov-empty">No approval requests match this status and search.</div>}
        {pageControls(orderedApprovals.length,approvalsCurrentPage,approvalsPageCount,setApprovalPage)}
      </section>
    </div>
  }
  function renderPolicies(){
    const audience=section==='policies-faculty'?'Faculty':'Student'
    const audiencePolicies=policies.filter(row=>{
      const category=String(jsonObject(row.payload).category??'').toLowerCase()
      return audience==='Faculty'?['faculty','staff','teacher','teachers'].includes(category):['student','students'].includes(category)
    })
    const reportRows:Record<string,unknown>[]=orderedPolicies.map(row=>({title:row.title,reference:row.reference_code??'',audience:label(row.payload.category??''),revision:Number(row.payload.revision??1),effective_date:row.effective_date??'',status:label(row.status),updated_at:row.updated_at??'',description:row.description??''}))
    const reportColumns:OfficeColumn[]=[{key:'title',label:'Policy title'},{key:'reference',label:'Reference'},{key:'audience',label:'Audience'},{key:'revision',label:'Revision'},{key:'effective_date',label:'Effective date'},{key:'status',label:'Status'},{key:'updated_at',label:'Last updated'},{key:'description',label:'Policy text'}]
    return <section className="gov-panel ed360-admin-policy-page">
      <header><div><h2>{audience} policy register</h2><p>{orderedPolicies.length} matching policies · {audiencePolicies.length} records for this audience</p></div><button className="gov-button primary" onClick={()=>openPolicy()}><Plus size={14}/> Add {audience.toLowerCase()} policy</button></header>
      {reportActions(audience+' policies',audience.toLowerCase()+'-policies',reportRows,reportColumns)}
      <div className="ed360-admin-policy-filters">
        <label>Status<select value={policyStatusFilter} onChange={e=>{setPolicyStatusFilter(e.target.value as typeof policyStatusFilter);setPolicyPage(1)}}><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
        <label>Order by<select value={policySortKey} onChange={e=>{setPolicySortKey(e.target.value as typeof policySortKey);setPolicyPage(1)}}><option value="updated_at">Last updated</option><option value="title">Policy title</option><option value="status">Status</option><option value="effective_date">Effective date</option></select></label>
        <button type="button" className="gov-button" onClick={()=>{setPolicySortDirection(value=>value==='asc'?'desc':'asc');setPolicyPage(1)}} aria-label={'Sort '+(policySortDirection==='asc'?'descending':'ascending')}>{policySortDirection==='asc'?'Ascending ↑':'Descending ↓'}</button>
        <label className="ed360-admin-policy-search"><Search size={14}/><input value={search} onChange={e=>{setSearch(e.target.value);setPolicyPage(1)}} placeholder={'Search '+audience.toLowerCase()+' policy title, reference or text…'}/></label>
      </div>
      {orderedPolicies.length?<div className="ed360-admin-policy-list">{policyPageRows.map(row=>{const revisions=audit.filter(event=>event.record_id===row.id).sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at)));return <article className="ed360-admin-policy-card" key={row.id}><header><div><h3>{row.title}</h3><div className="ed360-admin-policy-meta"><span>{row.reference_code??'No reference'}</span><span>Revision {Number(row.payload?.revision??1)}</span><span>Effective {row.effective_date??'Not set'}</span><span>Updated {dateLabel(row.updated_at)}</span></div></div><span className={'ed360-admin-status '+row.status}>{label(row.status)}</span></header>{row.description&&<p>{row.description}</p>}<div className="gov-row-actions"><button className="gov-button" onClick={()=>openPolicy(row)}>Edit / revise</button><button className="gov-button danger" disabled={saving} onClick={()=>void removePolicy(row)}>Delete</button></div><details><summary>Revision and audit history ({revisions.length} events)</summary>{revisions.length?revisions.map(event=><p key={event.id}>{dateLabel(event.occurred_at)} · {label(event.action)} by {event.actor_id??'system'}</p>):<p>No previous revisions are linked to this policy.</p>}</details></article>})}</div>:<div className="gov-empty">No {audience.toLowerCase()} policies match these filters. Clear the search or status filter, or create the first policy.</div>}
      {pageControls(orderedPolicies.length,policiesCurrentPage,policiesPageCount,setPolicyPage)}
    </section>
  }

  function renderPermissions(){
    if(!admin)return <div className="ed360-admin-callout warning">Role profiles can only be administered by the college owner or an authorised administrator.</div>
    return <div className="ed360-admin-stage5"><CollegeRolePermissionWorkspace institutionId={user!.institutionId} currentUserId={user!.id} members={members} onToast={onToast}/></div>
  }
  function renderAudit(){
    const recent=filteredAudit.filter(row=>Date.now()-new Date(row.occurred_at).getTime()<=30*24*60*60*1000).length
    const reportRows:Record<string,unknown>[]=filteredAudit.map(row=>({occurred_at:row.occurred_at,action:label(row.action),module:label(row.module_key),record_type:label(row.record_type),record_id:row.record_id,actor_id:row.actor_id??'system'}))
    const reportColumns:OfficeColumn[]=[{key:'occurred_at',label:'Occurred at'},{key:'action',label:'Action'},{key:'module',label:'Module'},{key:'record_type',label:'Record type'},{key:'record_id',label:'Record ID'},{key:'actor_id',label:'Actor ID'}]
    const actors=new Set(filteredAudit.map(row=>row.actor_id).filter(Boolean)).size
    const modules=new Set(filteredAudit.map(row=>row.module_key).filter(Boolean)).size
    return <div className="ed360-admin-audit-page">
      <div className="ed360-admin-kpis">
        <article><small>Events available</small><strong>{filteredAudit.length}</strong><em>Institution-scoped audit records</em></article>
        <article><small>Last 30 days</small><strong>{recent}</strong><em>Recorded change events</em></article>
        <article><small>Actors</small><strong>{actors}</strong><em>Distinct recorded actor IDs</em></article>
        <article><small>Modules</small><strong>{modules}</strong><em>Modules represented in this feed</em></article>
      </div>
      <section className="gov-panel ed360-admin-audit-feed">
        <div className="ed360-admin-audit-filters">
          <label>Order by<select value={auditSortKey} onChange={e=>{setAuditSortKey(e.target.value as typeof auditSortKey);setAuditPage(1)}}><option value="occurred_at">Event date</option><option value="action">Action</option><option value="module_key">Module</option></select></label>
          <button type="button" className="gov-button" onClick={()=>{setAuditSortDirection(value=>value==='asc'?'desc':'asc');setAuditPage(1)}} aria-label={'Sort '+(auditSortDirection==='asc'?'descending':'ascending')}>{auditSortDirection==='asc'?'Ascending ↑':'Descending ↓'}</button>
          <label className="ed360-admin-audit-search"><Search size={14}/><input value={auditSearch} onChange={e=>{setAuditSearch(e.target.value);setAuditPage(1)}} placeholder="Search actor, action, module or record…"/></label>
          <span className="gov-readonly">Read-only audit feed</span>
        </div>
        {reportActions('Administrative audit','administrative-audit',reportRows,reportColumns)}
        {filteredAudit.length?<div className="gov-timeline">{auditPageRows.map(row=><article key={row.id}><i/><div><strong>{label(row.action)} · {label(row.module_key)} / {label(row.record_type)}</strong><small>{dateLabel(row.occurred_at)} · Actor {String(row.actor_id??'system')} · Record {String(row.record_id)}</small><details><summary>View recorded values</summary><div><div><b>Before</b><pre>{JSON.stringify(row.old_values??null,null,2)}</pre></div><div><b>After</b><pre>{JSON.stringify(row.new_values??null,null,2)}</pre></div></div></details></div></article>)}</div>:<div className="gov-empty">No administrative audit events match this search.</div>}{pageControls(filteredAudit.length,auditCurrentPage,auditPageCount,setAuditPage)}
      </section>
    </div>
  }
  function renderAccounts(){
    const reportRows:Record<string,unknown>[]=orderedMembers.map(row=>({name:row.full_name??'',email:row.email??'',role:label(row.role),status:label(row.status),added:row.created_at??'',user_id:row.user_id}))
    const reportColumns:OfficeColumn[]=[{key:'name',label:'User'},{key:'email',label:'Email'},{key:'role',label:'Role'},{key:'status',label:'Access status'},{key:'added',label:'Membership created'},{key:'user_id',label:'User ID'}]
    const roles=[...new Set(members.map(row=>row.role).filter(Boolean))].sort()
    return <section className="gov-panel">
      <header><div><h2>User access and invitations</h2><p>{orderedMembers.length} matching memberships · {members.length} total institution memberships</p></div><Users size={20}/></header>
      {reportActions('User access register','user-access-register',reportRows,reportColumns)}
      <div className="ed360-admin-kpis"><article><small>Total memberships</small><strong>{members.length}</strong></article><article><small>Active</small><strong>{members.filter(row=>row.status==='active').length}</strong></article><article><small>Invited / pending</small><strong>{members.filter(row=>['invited','pending'].includes(row.status)).length}</strong></article><article><small>Suspended / inactive</small><strong>{members.filter(row=>['suspended','inactive'].includes(row.status)).length}</strong></article></div>
      <div className="ed360-admin-account-filters">
        <label>Status<select value={memberStatusFilter} onChange={e=>{setMemberStatusFilter(e.target.value);setMemberPage(1)}}><option value="all">All statuses</option>{['active','invited','pending','suspended','inactive'].map(status=><option key={status} value={status}>{label(status)}</option>)}</select></label>
        <label>Role<select value={memberRoleFilter} onChange={e=>{setMemberRoleFilter(e.target.value);setMemberPage(1)}}><option value="all">All roles</option>{roles.map(role=><option key={role} value={role}>{label(role)}</option>)}</select></label>
        <label>Order by<select value={memberSortKey} onChange={e=>{setMemberSortKey(e.target.value as typeof memberSortKey);setMemberPage(1)}}><option value="created_at">Date added</option><option value="full_name">Name</option><option value="email">Email</option><option value="role">Role</option><option value="status">Status</option></select></label>
        <button type="button" className="gov-button" onClick={()=>{setMemberSortDirection(value=>value==='asc'?'desc':'asc');setMemberPage(1)}} aria-label={'Sort '+(memberSortDirection==='asc'?'descending':'ascending')}>{memberSortDirection==='asc'?'Ascending ↑':'Descending ↓'}</button>
        <label className="ed360-admin-account-search"><Search size={14}/><input value={search} onChange={e=>{setSearch(e.target.value);setMemberPage(1)}} placeholder="Search name, email, role or status…"/></label>
      </div>
      {orderedMembers.length?<div className="gov-table-wrap"><table className="ed360-admin-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Access status</th><th>Added</th><th>Access action</th></tr></thead><tbody>{memberPageRows.map(row=><tr key={row.user_id}><td><b>{row.full_name}</b>{row.user_id===user?.id&&<small className="gov-note">Your account</small>}</td><td>{row.email}</td><td>{label(row.role)}</td><td><span className={'ed360-admin-status '+row.status}>{label(row.status)}</span></td><td>{dateLabel(row.created_at)}</td><td>{row.role==='owner'?<span className="gov-readonly">Protected owner</span>:row.user_id===user?.id?<span className="gov-readonly">Protected account</span>:['active','suspended'].includes(row.status)?<button type="button" className={'gov-button '+(row.status==='active'?'danger':'primary')} disabled={membershipSavingId===row.id} onClick={()=>void changeMembershipStatus(row)}>{membershipSavingId===row.id?'Updating…':row.status==='active'?'Suspend access':'Reactivate access'}</button>:<span className="gov-readonly">Use account provisioning</span>}</td></tr>)}</tbody></table></div>:<div className="gov-empty">No memberships match these filters. Clear a filter or search, or invite an institution member through the Account Manager.</div>}
      {pageControls(orderedMembers.length,membersCurrentPage,membersPageCount,setMemberPage)}
      <div className="gov-row-actions" style={{marginTop:14}}><button className="gov-button primary" onClick={()=>onNavigate('accounts')}>Open User Account Manager <ArrowUpRight size={14}/></button></div>
      <div className="gov-note">Create and invite accounts in the linked Account Manager. This register can activate or suspend established memberships; pending and invited accounts remain under account provisioning.</div>
    </section>
  }
  function renderSecurity(){
    const securityQuery=securitySearch.trim().toLowerCase()
    const related=audit.filter(row=>
      /auth|login|session|security|access|membership/i.test(row.module_key+' '+row.record_type+' '+row.action)&&
      [row.action,row.module_key,row.record_type,row.actor_id,row.record_id].join(' ').toLowerCase().includes(securityQuery)
    )
    const orderedRelated=[...related].sort((a,b)=>{
      const left=String(a[securitySortKey]??'')
      const right=String(b[securitySortKey]??'')
      const comparison=left.localeCompare(right,undefined,{numeric:true,sensitivity:'base'})
      return securitySortDirection==='asc'?comparison:-comparison
    })
    const reportRows:Record<string,unknown>[]=orderedRelated.map(row=>({occurred_at:row.occurred_at,action:label(row.action),module:label(row.module_key),record_type:label(row.record_type),record_id:row.record_id,actor_id:row.actor_id??'system'}))
    const reportColumns:OfficeColumn[]=[{key:'occurred_at',label:'Occurred at'},{key:'action',label:'Action'},{key:'module',label:'Module'},{key:'record_type',label:'Record type'},{key:'record_id',label:'Record ID'},{key:'actor_id',label:'Actor ID'}]
    const securityPageCount=Math.max(1,Math.ceil(orderedRelated.length/pageSize))
    const securityCurrentPage=Math.min(securityPage,securityPageCount)
    const securityPageRows=orderedRelated.slice((securityCurrentPage-1)*pageSize,securityCurrentPage*pageSize)
    return <div className="ed360-admin-stage5">
      <section className="gov-panel">
        <header><div><h2>Security and access overview</h2><p>Current membership status and available administrative security evidence.</p></div><LockKeyhole size={20}/></header>
        <div className="ed360-admin-security-grid">
          <article><b>{members.filter(row=>row.status==='active').length} active memberships</b><small>Active institution accounts recorded in memberships.</small></article>
          <article><b>{members.filter(row=>row.status!=='active').length} non-active memberships</b><small>Invited, pending, suspended or inactive states where recorded.</small></article>
          <article><b>{related.length} related audit events</b><small>Events matching the available access/security categories and current search.</small></article>
        </div>
        <div className="ed360-admin-callout warning">Login history, failed sign-in attempts and live session termination are not exposed by the current tenant-facing database API. This register shows only available institution audit evidence. No invented sign-in events or false zero counts are shown.</div>
      </section>
      <section className="gov-panel">
        <header><div><h2>Available access audit events</h2><p>{orderedRelated.length} matching events in the loaded institution audit history.</p></div></header>
        {reportActions('Security access audit events','security-access-audit-events',reportRows,reportColumns)}
        <div className="ed360-admin-security-filters">
          <label>Order by<select value={securitySortKey} onChange={e=>{setSecuritySortKey(e.target.value as typeof securitySortKey);setSecurityPage(1)}}><option value="occurred_at">Event date</option><option value="action">Action</option><option value="module_key">Module</option></select></label>
          <button type="button" className="gov-button" onClick={()=>{setSecuritySortDirection(value=>value==='asc'?'desc':'asc');setSecurityPage(1)}} aria-label={'Sort '+(securitySortDirection==='asc'?'descending':'ascending')}>{securitySortDirection==='asc'?'Ascending ↑':'Descending ↓'}</button>
          <label className="ed360-admin-security-search"><Search size={14}/><input value={securitySearch} onChange={e=>{setSecuritySearch(e.target.value);setSecurityPage(1)}} placeholder="Search action, module, actor or record…"/></label>
        </div>
        {orderedRelated.length?<div className="gov-timeline">{securityPageRows.map(row=><article key={row.id}><i/><div><strong>{label(row.action)} · {label(row.module_key)}</strong><small>{dateLabel(row.occurred_at)} · {row.actor_id??'system'}</small></div></article>)}</div>:<div className="gov-empty">No security-labelled audit events match this search.</div>}
        {pageControls(orderedRelated.length,securityCurrentPage,securityPageCount,setSecurityPage)}
      </section>
    </div>
  }
  function renderContent(){
    if(section==='profile')return renderProfile()
    if(section==='academic')return renderAcademic()
    if(section==='departments')return renderDepartments()
    if(section==='designations')return renderDesignations()
    if(section==='organization')return renderOrganization()
    if(section==='settings')return renderInstituteSettings()
    if(['system','branding'].includes(section))return renderSettingsPage()
    if(section==='approvals')return renderApprovals()
    if(section==='policies-students'||section==='policies-faculty')return renderPolicies()
    if(section==='audit')return renderAudit()
    if(section==='accounts')return renderAccounts()
    if(section==='permissions')return renderPermissions()
    if(section==='security')return renderSecurity()
    return null
  }
  if(!admin)return <main className="page-content"><div className="gov-error">Administration is restricted to authorised institution owners and administrators.</div></main>
  return <main className={"gov-stage page-content ed360-module-page ed360-admin-stage5" + (section === "profile" ? " is-profile" : "")}>
    <header className="gov-heading"><div><span>{(profileDraft.name.trim()||user?.institutionName?.trim()||'GOVERNMENT ISLAMIA DEGREE COLLEGE').toUpperCase()} / ADMINISTRATION / {section==='profile'?'OFFICIAL INSTITUTE PROFILE':pageMeta[section].title.toUpperCase()}</span><h1>{pageMeta[section].title}</h1></div><button type="button" className="gov-button primary" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> {loading?'Refreshing…':'Refresh'}</button></header>
    {error&&<div className="gov-error" role="alert">{error}</div>}
    {loading?<div className="gov-empty"><RefreshCw size={18}/> Loading Administration records…</div>:renderContent()}
    {settingForm&&<div className="modal-backdrop"><section className="modal-card gov-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">INSTITUTION CONFIGURATION</div><h2>{settingEditing?'Edit setting':'Create setting'}</h2><p>Save an institution-scoped value. Public visibility is off by default.</p></div><button className="icon-button" onClick={()=>setSettingForm(false)}><X size={18}/></button></div><form className="gov-form" onSubmit={saveSetting}><label>Category *<input required value={settingCategory} onChange={e=>setSettingCategory(e.target.value)}/></label><label>Setting key *<input required value={settingKey} onChange={e=>setSettingKey(e.target.value)}/></label><label>Value (JSON) *<textarea rows={6} required value={settingValue} onChange={e=>setSettingValue(e.target.value)}/></label><label className="gov-check"><input type="checkbox" checked={settingPublic} onChange={e=>setSettingPublic(e.target.checked)}/> Publicly visible to unauthenticated visitors</label><div className="modal-actions"><button type="button" className="gov-button" onClick={()=>setSettingForm(false)}>Cancel</button><button className="gov-button primary" disabled={saving}><Save size={14}/> Save setting</button></div></form></section></div>}
    {approvalForm&&<div className="modal-backdrop"><section className="modal-card gov-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">APPROVAL REQUEST</div><h2>Request an institute setting change</h2><p>The owner/administrator decision applies the saved value atomically.</p></div><button className="icon-button" onClick={()=>setApprovalForm(false)}><X size={18}/></button></div><form className="gov-form" onSubmit={submitApproval}><label>Setting key *<input required value={approvalKey} onChange={e=>setApprovalKey(e.target.value)}/></label><label>Requested value (JSON) *<textarea rows={6} required value={approvalValue} onChange={e=>setApprovalValue(e.target.value)}/></label><label className="gov-check"><input type="checkbox" checked={approvalPublic} onChange={e=>setApprovalPublic(e.target.checked)}/> Request public visibility</label><label>Request notes<input value={approvalNotes} onChange={e=>setApprovalNotes(e.target.value)} placeholder="Optional context"/></label><div className="modal-actions"><button type="button" className="gov-button" onClick={()=>setApprovalForm(false)}>Cancel</button><button className="gov-button primary" disabled={saving}>Submit request</button></div></form></section></div>}
    {policyForm&&<div className="modal-backdrop"><section className="modal-card gov-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">INSTITUTIONAL POLICY</div><h2>{policyEditing?'Revise policy':'Create policy or rule'}</h2><p>Each save increments the revision and is included in the audit feed.</p></div><button className="icon-button" onClick={()=>setPolicyForm(false)} aria-label="Close"><X size={18}/></button></div><form className="gov-form" onSubmit={savePolicy}><label>Policy title *<input required value={policyTitle} onChange={e=>setPolicyTitle(e.target.value)}/></label><label>Reference code<input value={policyCode} onChange={e=>setPolicyCode(e.target.value)}/></label><label>Policy audience<select value={policyCategory} onChange={e=>setPolicyCategory(e.target.value)}><option value="student">Students</option><option value="faculty">Faculty & staff</option></select></label><label>Description / guideline<textarea rows={5} value={policyDescription} onChange={e=>setPolicyDescription(e.target.value)}/></label><label>Effective date<input type="date" value={policyEffectiveDate} onChange={e=>setPolicyEffectiveDate(e.target.value)}/></label><label>Publication status<select value={policyStatus} onChange={e=>setPolicyStatus(e.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><div className="modal-actions"><button type="button" className="gov-button" onClick={()=>setPolicyForm(false)}>Cancel</button><button className="gov-button primary" disabled={saving}>{policyEditing?'Save revision':'Create policy'}</button></div></form></section></div>}
  </main>
}
