import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowUpRight, BookOpen, Building2, CalendarDays, CheckCircle2, FileText, LockKeyhole, Palette, Plus, RefreshCw, Save, Search, ShieldCheck, Upload, Users, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/userErrors'
import type { RecordRow } from '../lib/types'
import '../styles/governance-workspace.css'

type Section='profile'|'academic'|'departments'|'organization'|'system'|'approvals'|'policies'|'audit'|'accounts'|'permissions'|'settings'|'branding'|'security'
type Props={initialWindow?:string;onToast:(message:string,error?:boolean)=>void;onNavigate:(route:string)=>void}
type Institution={id:string;name:string;institution_type:string;tagline?:string|null;phone?:string|null;email?:string|null;website?:string|null;address?:string|null;country?:string|null;logo_path?:string|null;created_by?:string|null}
type Setting=RecordRow & {id:string;category:string;setting_key:string;setting_value:unknown;is_public:boolean}
type Approval=RecordRow & {id:string;workflow_key:string;status:string;target_type:string;payload:Record<string,unknown>;requested_at:string;requested_by:string|null;decision_notes?:string|null}
type Audit=RecordRow & {id:string;record_id:string;action:string;module_key:string;record_type:string;occurred_at:string;actor_id:string|null;old_values:unknown;new_values:unknown}
type Department=RecordRow & {id:string;name:string;department_code?:string;head_name?:string|null;email?:string|null;phone?:string|null;status?:string;is_active?:boolean;campus_id?:string|null}
type Designation=RecordRow & {id:string;name:string;code?:string|null;department_id?:string|null;is_active:boolean}
type Teacher=RecordRow & {id:string;full_name:string;department?:string|null;department_id?:string|null;designation_id?:string|null;employment_status?:string;campus_id?:string|null}
type Member=RecordRow & {user_id:string;role:string;status:string;full_name?:string;email?:string}
type Policy=RecordRow & {id:string;title:string;reference_code?:string|null;description?:string|null;status:string;effective_date?:string|null;payload:Record<string,unknown>}
const sectionByWindow:Record<string,Section>={profile:'profile',settings:'settings',institution_settings:'settings',approvals:'approvals',audit:'audit',academic:'academic',accounts:'accounts',departments:'departments',organization:'organization',system:'system',policies:'policies',permissions:'permissions',branding:'branding',security:'security'}
const pageTitle:Record<Section,string>={profile:'Institute Profile',academic:'Academic Structure & Sections',departments:'Departments & Designations',organization:'Organisational Structure',system:'System Configuration',approvals:'Approval Workflows',policies:'Policies & Rules',audit:'Administrative Audit',accounts:'User Access & Invitations',permissions:'Role & Permission Management',settings:'Institute Settings',branding:'Branding & Document Settings',security:'Security & Access History'}
const dateLabel=(value:unknown)=>value?new Date(String(value)).toLocaleString():'—'
const label=(value:unknown)=>String(value??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
const jsonObject=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}

export function AdministrationStage5Workspace({initialWindow,onToast,onNavigate}:Props){
  const {user}=useAuth()
  const [section,setSection]=useState<Section>(sectionByWindow[initialWindow??'']??'profile')
  const admin=user?.role==='owner'||user?.role==='admin'
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('')
  const [institution,setInstitution]=useState<Institution|null>(null)
  const [profileDraft,setProfileDraft]=useState({name:'',institution_type:'school',tagline:'',phone:'',email:'',website:'',address:'',country:''})
  const [logoFile,setLogoFile]=useState<File|null>(null),[logoUrl,setLogoUrl]=useState(''),[showProfileCard,setShowProfileCard]=useState(false)
  const [settings,setSettings]=useState<Setting[]>([]),[approvals,setApprovals]=useState<Approval[]>([]),[audit,setAudit]=useState<Audit[]>([]),[policies,setPolicies]=useState<Policy[]>([])
  const [departments,setDepartments]=useState<Department[]>([]),[designations,setDesignations]=useState<Designation[]>([]),[teachers,setTeachers]=useState<Teacher[]>([]),[members,setMembers]=useState<Member[]>([])
  const [search,setSearch]=useState('')
  const [settingsSortKey,setSettingsSortKey]=useState<'category'|'setting_key'|'is_public'>('category')
  const [settingsSortDirection,setSettingsSortDirection]=useState<'asc'|'desc'>('asc')
  const [settingsPage,setSettingsPage]=useState(1),[approvalPage,setApprovalPage]=useState(1)
  const pageSize=10
  const [policyForm,setPolicyForm]=useState(false),[policyEditing,setPolicyEditing]=useState<Policy|null>(null)
  const [policyTitle,setPolicyTitle]=useState(''),[policyCode,setPolicyCode]=useState(''),[policyCategory,setPolicyCategory]=useState('general'),[policyDescription,setPolicyDescription]=useState(''),[policyStatus,setPolicyStatus]=useState('draft'),[policyEffectiveDate,setPolicyEffectiveDate]=useState('')
  const [settingForm,setSettingForm]=useState(false),[settingEditing,setSettingEditing]=useState<Setting|null>(null),[settingCategory,setSettingCategory]=useState('general'),[settingKey,setSettingKey]=useState(''),[settingValue,setSettingValue]=useState('{}'),[settingPublic,setSettingPublic]=useState(false)
  const [approvalForm,setApprovalForm]=useState(false),[approvalKey,setApprovalKey]=useState(''),[approvalValue,setApprovalValue]=useState('{}'),[approvalNotes,setApprovalNotes]=useState(''),[approvalPublic,setApprovalPublic]=useState(false)

  async function load(silent=false){
    if(!supabase||!user){setLoading(false);return}
    if(!silent){setLoading(true);setError('')}
    try{
      const [institutionResult,settingsResult,approvalResult,auditResult,policyResult,departmentResult,designationResult,teacherResult,membershipResult]=await Promise.all([
        supabase.from('institutions').select('id,name,institution_type,tagline,phone,email,website,address,country,logo_path,created_by').eq('id',user.institutionId).maybeSingle(),
        admin?supabase.from('institution_settings').select('*').eq('institution_id',user.institutionId).order('category').order('setting_key').limit(1000):Promise.resolve({data:[],error:null}),
        admin?supabase.from('workflow_approvals').select('*').eq('institution_id',user.institutionId).order('requested_at',{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
        admin?supabase.from('institutional_audit_events').select('*').eq('institution_id',user.institutionId).order('occurred_at',{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
        admin?supabase.from('institutional_records').select('*').eq('institution_id',user.institutionId).eq('module_key','administration').eq('record_type','institutional-policy').order('updated_at',{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
        admin?supabase.from('departments').select('*').eq('institution_id',user.institutionId).order('name').limit(500):Promise.resolve({data:[],error:null}),
        admin?supabase.from('designations').select('*').eq('institution_id',user.institutionId).order('name').limit(500):Promise.resolve({data:[],error:null}),
        admin?supabase.from('teachers').select('id,full_name,department,department_id,designation_id,employment_status,campus_id').eq('institution_id',user.institutionId).order('full_name').limit(1000):Promise.resolve({data:[],error:null}),
        admin?supabase.from('memberships').select('user_id,role,status,created_at').eq('institution_id',user.institutionId).order('created_at').limit(1000):Promise.resolve({data:[],error:null}),
      ])
      for(const result of [institutionResult,settingsResult,approvalResult,auditResult,policyResult,departmentResult,designationResult,teacherResult,membershipResult])if(result.error)throw result.error
      const institutionRow=institutionResult.data as Institution|null
      setInstitution(institutionRow)
      if(institutionRow)setProfileDraft({name:institutionRow.name??'',institution_type:institutionRow.institution_type??'school',tagline:institutionRow.tagline??'',phone:institutionRow.phone??'',email:institutionRow.email??'',website:institutionRow.website??'',address:institutionRow.address??'',country:institutionRow.country??''})
      const membershipRows=(membershipResult.data??[]) as Member[]
      if(membershipRows.length){
        const ids=membershipRows.map(row=>row.user_id).filter(Boolean)
        const {data:profiles,error:profilesError}=await supabase.from('profiles').select('id,full_name,email').in('id',ids)
        if(profilesError)throw profilesError
        const profileMap=new Map((profiles??[]).map((profile:any)=>[profile.id,profile]))
        setMembers(membershipRows.map(row=>({...row,full_name:profileMap.get(row.user_id)?.full_name??'Institution member',email:profileMap.get(row.user_id)?.email??''})))
      }else setMembers([])
      setSettings((settingsResult.data??[]) as Setting[]);setApprovals((approvalResult.data??[]) as Approval[]);setAudit((auditResult.data??[]) as Audit[])
      setPolicies((policyResult.data??[]) as Policy[]);setDepartments((departmentResult.data??[]) as Department[])
      setDesignations((designationResult.data??[]) as Designation[]);setTeachers((teacherResult.data??[]) as Teacher[])
      if(institutionRow?.logo_path){const {data:signed}=await supabase.storage.from('institution-files').createSignedUrl(institutionRow.logo_path,3600);setLogoUrl(signed?.signedUrl??'')}else setLogoUrl('')
    }catch(err){const message=userFacingError(err,'Administration records could not be loaded.');setError(message);if(!silent)onToast(message,true)}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[user?.id,user?.institutionId,user?.role])

  const filteredPolicies=useMemo(()=>policies.filter(row=>[row.title,row.reference_code,row.description,row.status,JSON.stringify(row.payload)].join(' ').toLowerCase().includes(search.trim().toLowerCase())),[policies,search])
  const filteredAudit=useMemo(()=>audit.filter(row=>[row.action,row.module_key,row.record_type,row.actor_id,row.record_id].join(' ').toLowerCase().includes(search.trim().toLowerCase())),[audit,search])
  const filteredMembers=useMemo(()=>members.filter(row=>[row.full_name,row.email,row.role,row.status].join(' ').toLowerCase().includes(search.trim().toLowerCase())),[members,search])
  const visibleSettings=useMemo(()=>settings.filter(row=>section==='system'?row.category==='system':section==='branding'?['branding','documents'].includes(row.category):section==='settings'?!['system','branding','documents'].includes(row.category):true).filter(row=>[row.category,row.setting_key,JSON.stringify(row.setting_value)].join(' ').toLowerCase().includes(search.trim().toLowerCase())),[settings,section,search])
  const orderedSettings=useMemo(()=>[...visibleSettings].sort((a,b)=>{
    const left=settingsSortKey==='is_public'?String(a.is_public):String(a[settingsSortKey]??'')
    const right=settingsSortKey==='is_public'?String(b.is_public):String(b[settingsSortKey]??'')
    const comparison=left.localeCompare(right,undefined,{numeric:true,sensitivity:'base'})
    return settingsSortDirection==='asc'?comparison:-comparison
  }),[visibleSettings,settingsSortKey,settingsSortDirection])
  const settingsPageCount=Math.max(1,Math.ceil(orderedSettings.length/pageSize))
  const settingsCurrentPage=Math.min(settingsPage,settingsPageCount)
  const settingsPageRows=orderedSettings.slice((settingsCurrentPage-1)*pageSize,settingsCurrentPage*pageSize)
  const orderedApprovals=useMemo(()=>approvals.filter(row=>[row.workflow_key,row.target_type,row.status,JSON.stringify(row.payload)].join(' ').toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>String(b.requested_at??'').localeCompare(String(a.requested_at??''))),[approvals,search])
  const approvalsPageCount=Math.max(1,Math.ceil(orderedApprovals.length/pageSize))
  const approvalsCurrentPage=Math.min(approvalPage,approvalsPageCount)
  const approvalPageRows=orderedApprovals.slice((approvalsCurrentPage-1)*pageSize,approvalPage*pageSize)
  const pendingApprovals=approvals.filter(row=>row.status==='pending').length
  const primaryColor=String(settings.find(row=>row.category==='branding'&&row.setting_key==='primary_color')?.setting_value??'#205b43')
  const accentColor=String(settings.find(row=>row.category==='branding'&&row.setting_key==='accent_color')?.setting_value??'#9bc85b')

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
    if(!supabase||!admin||!window.confirm('Delete '+row.category+'/'+row.setting_key+'?'))return
    const {error:removeError}=await supabase.from('institution_settings').delete().eq('institution_id',user!.institutionId).eq('id',row.id)
    if(removeError)onToast(userFacingError(removeError,'The setting could not be deleted.'),true)
    else{onToast('Setting deleted.');await load(true)}
  }

  async function saveProfile(event:FormEvent){
    event.preventDefault();if(!supabase||!admin)return
    if(!profileDraft.name.trim()){onToast('Institution name is required.',true);return}
    if(profileDraft.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileDraft.email)){onToast('Enter a valid institution email address.',true);return}
    if(profileDraft.website){try{new URL(profileDraft.website.startsWith('http')?profileDraft.website:'https://'+profileDraft.website)}catch{onToast('Enter a valid website address.',true);return}}
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
      const values={...profileDraft,name:profileDraft.name.trim(),email:profileDraft.email.trim()||null,website:profileDraft.website.trim()||null,phone:profileDraft.phone.trim()||null,tagline:profileDraft.tagline.trim()||null,address:profileDraft.address.trim()||null,country:profileDraft.country.trim()||null,...(uploadedPath?{logo_path:uploadedPath}:{})}
      const {error:updateError}=await supabase.from('institutions').update(values).eq('id',user!.institutionId)
      if(updateError)throw updateError
      if(uploadedPath&&institution?.logo_path)await supabase.storage.from('institution-files').remove([institution.logo_path])
      setLogoFile(null);onToast('Institution profile updated.');await load(true)
    }catch(err){if(uploadedPath)await supabase.storage.from('institution-files').remove([uploadedPath]);onToast(userFacingError(err,'The institution profile could not be updated.'),true)}
    finally{setSaving(false)}
  }

  function openPolicy(row?:Policy){
    setPolicyEditing(row??null);setPolicyTitle(row?.title??'');setPolicyCode(row?.reference_code??'')
    setPolicyCategory(String(jsonObject(row?.payload).category??'general'));setPolicyDescription(row?.description??'')
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
    const {error:removeError}=await supabase.from('institutional_records').delete().eq('institution_id',user!.institutionId).eq('id',row.id)
    if(removeError)onToast(userFacingError(removeError,'The policy could not be deleted.'),true)
    else{onToast('Policy removed.');await load(true)}
  }
  async function submitApproval(event:FormEvent){
    event.preventDefault();if(!supabase)return
    let parsed:unknown;try{parsed=JSON.parse(approvalValue)}catch{onToast('Enter a valid JSON setting value.',true);return}
    if(!approvalKey.trim()){onToast('Enter a setting key.',true);return}
    setSaving(true)
    const {error:requestError}=await supabase.from('workflow_approvals').insert({institution_id:user!.institutionId,workflow_key:'institution_setting_change',target_type:'institution_settings',target_id:crypto.randomUUID(),requested_by:user!.id,status:'pending',payload:{category:'general',setting_key:approvalKey.trim(),setting_value:parsed,is_public:approvalPublic,request_notes:approvalNotes.trim()||null}})
    if(requestError)onToast(userFacingError(requestError,'Approval request could not be submitted.'),true)
    else{setApprovalForm(false);setApprovalKey('');setApprovalValue('{}');setApprovalNotes('');onToast('Approval request submitted.');await load(true)}
    setSaving(false)
  }
  async function decideApproval(row:Approval,decision:'approved'|'rejected'){
    if(!supabase||!admin)return
    const notes=window.prompt(decision==='approved'?'Optional approval note:':'Reason for rejection (recommended):','')??''
    if(decision==='rejected'&&!notes.trim()){onToast('Add a reason before rejecting this request.',true);return}
    setSaving(true)
    const {error:decisionError}=await supabase.rpc('decide_institution_setting_approval',{p_institution_id:user!.institutionId,p_approval_id:row.id,p_decision:decision,p_notes:notes})
    if(decisionError)onToast(userFacingError(decisionError,'Approval decision could not be saved.'),true)
    else{onToast(decision==='approved'?'Approved and applied.':'Request rejected.');await load(true)}
    setSaving(false)
  }

  function renderSettingRows(rows:Setting[],empty:string){
    return rows.length?<div className="gov-table-wrap"><table className="ed360-admin-table"><thead><tr>{sortHeader('Category','category')}{sortHeader('Key','setting_key')}<th>Value</th>{sortHeader('Visibility','is_public')}<th>Actions</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{label(row.category)}</td><td><b>{row.setting_key}</b></td><td><code>{JSON.stringify(row.setting_value)}</code></td><td>{row.is_public?'Public':'Private'}</td><td><div className="gov-row-actions"><button className="gov-button" onClick={()=>openSetting(row)}>Edit</button><button className="gov-button danger" onClick={()=>void removeSetting(row)}>Delete</button></div></td></tr>)}</tbody></table></div>:<div className="gov-empty">{empty}</div>
  }
  function renderProfile(){
    return <div className="ed360-admin-profile">
      <section className="gov-panel"><header><div><h2>Institution identity</h2><p>Update the public institution details used across this tenant.</p></div><span className="gov-readonly">Owner / admin</span></header>
        <form className="gov-form ed360-admin-profile-form" onSubmit={saveProfile}>
          <label className="ed360-admin-field">Institute name *<input required value={profileDraft.name} onChange={e=>setProfileDraft(v=>({...v,name:e.target.value}))}/></label>
          <label className="ed360-admin-field">Institution type<select value={profileDraft.institution_type} onChange={e=>setProfileDraft(v=>({...v,institution_type:e.target.value}))}><option value="school">School</option><option value="college">College</option><option value="university">University</option><option value="multi_institution">Multi-institution</option></select></label>
          <label className="ed360-admin-field full">Tagline<input value={profileDraft.tagline} onChange={e=>setProfileDraft(v=>({...v,tagline:e.target.value}))} placeholder="A short institutional statement"/></label>
          <label className="ed360-admin-field">Phone<input value={profileDraft.phone} onChange={e=>setProfileDraft(v=>({...v,phone:e.target.value}))}/></label>
          <label className="ed360-admin-field">Email<input type="email" value={profileDraft.email} onChange={e=>setProfileDraft(v=>({...v,email:e.target.value}))}/></label>
          <label className="ed360-admin-field full">Website<input value={profileDraft.website} onChange={e=>setProfileDraft(v=>({...v,website:e.target.value}))} placeholder="https://example.edu"/></label>
          <label className="ed360-admin-field full">Address<textarea value={profileDraft.address} onChange={e=>setProfileDraft(v=>({...v,address:e.target.value}))}/></label>
          <label className="ed360-admin-field">Country<input value={profileDraft.country} onChange={e=>setProfileDraft(v=>({...v,country:e.target.value}))}/></label>
          <div className="ed360-admin-field"><span>Institution logo</span><label className="gov-button"><Upload size={14}/> Choose logo<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>setLogoFile(e.target.files?.[0]??null)}/></label><small>{logoFile?logoFile.name:'PNG, JPG or WebP · up to 5 MB'}</small></div>
          <div className="gov-row-actions full"><button className="gov-button primary" disabled={saving}>{saving?'Saving…':'Update Profile'} <Save size={14}/></button><button type="button" className="gov-button" onClick={()=>setShowProfileCard(v=>!v)}>{showProfileCard?'Hide':'View'} Profile Card</button></div>
        </form>
      </section>
      <div className="ed360-admin-stage5">
        <section className="gov-panel"><div className="ed360-admin-logo">{logoUrl?<img src={logoUrl} alt="Institution logo"/>:<div className="placeholder">{(institution?.name??'E').slice(0,1).toUpperCase()}</div>}<b>{institution?.name??'Institution'}</b><small>Private institution file · access-controlled</small></div></section>
        {showProfileCard&&<section className="ed360-admin-profile-preview"><header>{logoUrl&&<img src={logoUrl} alt=""/>}<div><h3>{profileDraft.name||'Institute name'}</h3><p>{profileDraft.tagline||'Institution tagline'}</p></div></header><dl><div><dt>Institution type</dt><dd>{label(profileDraft.institution_type)}</dd></div><div><dt>Phone</dt><dd>{profileDraft.phone||'—'}</dd></div><div><dt>Email</dt><dd>{profileDraft.email||'—'}</dd></div><div><dt>Website</dt><dd>{profileDraft.website||'—'}</dd></div><div><dt>Address</dt><dd>{profileDraft.address||'—'}</dd></div><div><dt>Country</dt><dd>{profileDraft.country||'—'}</dd></div></dl></section>}
      </div>
    </div>
  }
  function renderDepartments(){
    const q=search.trim().toLowerCase(),departmentRows=departments.filter(row=>[row.name,row.department_code,row.head_name,row.email].join(' ').toLowerCase().includes(q)),designationRows=designations.filter(row=>[row.name,row.code].join(' ').toLowerCase().includes(q))
    return <div className="ed360-admin-stage5">
      <section className="gov-panel"><header><div><h2>Department directory</h2><p>Department codes, leadership contacts and active state.</p></div><button className="gov-button primary" onClick={()=>onNavigate('admin:departments')}>Open Department Manager <ArrowUpRight size={14}/></button></header>
        <div className="ed360-admin-kpis"><article><small>Departments</small><strong>{departments.length}</strong></article><article><small>Active</small><strong>{departments.filter(d=>d.is_active!==false&&d.status!=='inactive').length}</strong></article><article><small>Department heads</small><strong>{departments.filter(d=>Boolean(d.head_name)).length}</strong></article><article><small>Designations</small><strong>{designations.length}</strong></article></div>
        {departmentRows.length?<div className="gov-table-wrap"><table className="ed360-admin-table"><thead><tr><th>Code</th><th>Department</th><th>Head</th><th>Contact</th><th>Status</th></tr></thead><tbody>{departmentRows.map(row=><tr key={row.id}><td>{row.department_code??row.code??'—'}</td><td><b>{row.name}</b></td><td>{row.head_name??'Not assigned'}</td><td>{row.email??row.phone??'—'}</td><td><span className={'ed360-admin-status '+(row.is_active===false||row.status==='inactive'?'inactive':'')}>{row.is_active===false||row.status==='inactive'?'Inactive':'Active'}</span></td></tr>)}</tbody></table></div>:<div className="gov-empty">No department records are available.</div>}
      </section>
      <section className="gov-panel"><header><div><h2>Designation catalogue</h2><p>Position titles and department relationships used by employee assignment.</p></div><button className="gov-button primary" onClick={()=>onNavigate('employees:designations')}>Open Designation Manager <ArrowUpRight size={14}/></button></header>
        {designationRows.length?<div className="gov-table-wrap"><table className="ed360-admin-table"><thead><tr><th>Designation</th><th>Code</th><th>Department</th><th>Status</th></tr></thead><tbody>{designationRows.map(row=><tr key={row.id}><td><b>{row.name}</b></td><td>{row.code??'—'}</td><td>{departments.find(d=>d.id===row.department_id)?.name??'Institution-wide'}</td><td><span className={'ed360-admin-status '+(!row.is_active?'inactive':'')}>{row.is_active?'Active':'Inactive'}</span></td></tr>)}</tbody></table></div>:<div className="gov-empty">No designation records are available.</div>}
      </section>
    </div>
  }
  function renderOrganization(){
    const ownerMembers=members.filter(row=>row.role==='owner'),adminMembers=members.filter(row=>row.role==='admin')
    return <div className="ed360-admin-stage5"><section className="gov-panel"><header><div><h2>Institution reporting hierarchy</h2><p>Live owner/admin memberships, department leadership and staff assignments.</p></div><span className="gov-readonly">Live records</span></header>
      <div className="ed360-admin-kpis"><article><small>Departments</small><strong>{departments.length}</strong></article><article><small>Staff profiles</small><strong>{teachers.length}</strong></article><article><small>Designations</small><strong>{designations.length}</strong></article><article><small>Admin accounts</small><strong>{adminMembers.length}</strong></article></div>
      <div className="ed360-admin-org"><div className="ed360-admin-org-root"><b>{ownerMembers.map(row=>row.full_name).join(', ')||'Institution Owner'}</b><small>Institution owner · highest authority</small></div>
        <div className="ed360-admin-org-admins">{adminMembers.map(row=><span key={row.user_id}><b>{row.full_name}</b><br/>Administrator</span>)}</div>
        <div className="ed360-admin-org-departments">{departments.map(department=>{const people=teachers.filter(person=>person.department_id===department.id||(person.department_id==null&&person.department===department.name));return <article className="ed360-admin-org-department" key={department.id}><header><div><h3>{department.name}</h3><p>{department.department_code??department.code??'No code'} · {department.head_name??'Head not assigned'}</p></div><span className="ed360-admin-status">{people.length} staff</span></header><div className="ed360-admin-org-staff">{people.map(person=><span key={person.id}>{person.full_name} · {designations.find(d=>d.id===person.designation_id)?.name??'Position unassigned'}</span>)}{!people.length&&<span>No staff linked to this department</span>}</div></article>})}</div>
      </div></section><div className="ed360-admin-callout warning">Direct supervisor links and approved vacancy positions are not stored in the current schema; this view only displays recorded memberships, department head names and employee department/designation assignments.</div></div>
  }
  function renderAcademic(){
    return <div className="ed360-admin-stage5"><section className="gov-panel"><header><div><h2>Academic structure and session relationships</h2><p>Open each connected register in its own working window.</p></div></header><div className="gov-shortcuts"><button onClick={()=>onNavigate('admin:academic_sessions')}><CalendarDays size={18}/> Academic sessions <ArrowUpRight size={14}/></button><button onClick={()=>onNavigate('admin:classes')}><Users size={18}/> Classes and sections <ArrowUpRight size={14}/></button><button onClick={()=>onNavigate('admin:programs')}><BookOpen size={18}/> Programmes <ArrowUpRight size={14}/></button><button onClick={()=>onNavigate('admin:subjects')}><BookOpen size={18}/> Subjects <ArrowUpRight size={14}/></button><button onClick={()=>onNavigate('admin:rooms')}><Building2 size={18}/> Rooms and facilities <ArrowUpRight size={14}/></button><button onClick={()=>onNavigate('students:classes')}><Users size={18}/> Student class assignments <ArrowUpRight size={14}/></button></div></section><div className="ed360-admin-callout">Academic session, class, programme, subject and room registers remain tenant-scoped and keep their existing add/edit forms and permission checks.</div></div>
  }
  function renderSettingsPage(){
    const heading=section==='system'?'Institution-wide system configuration':section==='branding'?'Brand and document defaults':'Institute settings'
    const description=section==='system'?'Operating preferences and system-level configuration values.':section==='branding'?'Institution colours, document headers and reusable template defaults.':'Academic defaults, region, dates, time, language and institution preferences.'
    return <div className="ed360-admin-stage5">
      {section==='branding'&&<section className="gov-panel"><header><div><h2>Brand preview</h2><p>Stored branding defaults. Private logo is managed in Institute Profile.</p></div><Palette size={20}/></header><div className="ed360-admin-brand-preview"><span className="ed360-admin-brand-swatch" style={{background:primaryColor}}/><span><b>{institution?.name??'Institution'}</b><small style={{display:'block',color:'#859287',fontSize:10}}>Primary brand colour · {primaryColor}</small></span><span className="ed360-admin-brand-swatch" style={{background:accentColor}}/><small>Accent · {accentColor}</small></div></section>}
      <section className="gov-panel"><header><div><h2>{heading}</h2><p>{description}</p></div><div className="gov-row-actions">{section==='branding'?<><button className="gov-button primary" onClick={()=>openSetting(undefined,'branding')}><Plus size={14}/> Add brand setting</button><button className="gov-button" onClick={()=>openSetting(undefined,'documents')}><FileText size={14}/> Add document setting</button></>:<button className="gov-button primary" onClick={()=>openSetting(undefined,section==='system'?'system':'general')}><Plus size={14}/> Add setting</button>}</div></header>
        {section==='branding'&&<p className="gov-note">Store colour tokens and document header/footer defaults as institution-scoped settings. Generated receipts and certificates must consume these keys before their appearance changes.</p>}
        <label className="ed360-admin-search"><Search size={14}/><input value={search} onChange={e=>{setSearch(e.target.value);setSettingsPage(1);setApprovalPage(1)}} placeholder="Search category, key or value…"/></label>
        {renderSettingRows(settingsPageRows,section==='system'?'No system-level settings have been saved.':section==='branding'?'No branding or document settings have been saved.':'No institution settings have been saved.')}
        {pageControls(orderedSettings.length,settingsCurrentPage,settingsPageCount,setSettingsPage)}
      </section>
    </div>
  }
  function renderApprovals(){
    const rows=orderedApprovals
    return <section className="gov-panel"><header><div><h2>Approval queue</h2><p>Requests, responsible approvers, decisions and history. Setting changes are applied by the database approval function.</p></div><div className="gov-header-actions"><span className="gov-pending">{pendingApprovals} pending</span><button className="gov-button primary" onClick={()=>setApprovalForm(true)}><Plus size={14}/> Request setting change</button></div></header>
      <label className="ed360-admin-search"><Search size={14}/><input value={search} onChange={e=>{setSearch(e.target.value);setSettingsPage(1);setApprovalPage(1)}} placeholder="Search workflow, status or target…"/></label>
      {rows.length?<div className="gov-approval-list">{approvalPageRows.map(row=><article key={row.id}><div className="gov-approval-heading"><div><small>{label(row.workflow_key)}</small><strong>{label(row.target_type)}</strong></div><span className={'gov-status '+row.status}>{label(row.status)}</span></div><dl><div><dt>Requested</dt><dd>{dateLabel(row.requested_at)}</dd></div><div><dt>Requester</dt><dd>{String(row.requested_by??'Institution member')}</dd></div><div><dt>Target</dt><dd className="gov-mono">{String(row.target_id)}</dd></div></dl>{row.workflow_key==='institution_setting_change'&&<div className="gov-payload"><b>{String(row.payload.category??'general')} / {String(row.payload.setting_key??'setting')}</b><pre>{JSON.stringify(row.payload.setting_value??{},null,2)}</pre></div>}{row.decision_notes&&<p className="gov-decision-note">{row.decision_notes}</p>}{admin&&row.status==='pending'&&<div className="gov-row-actions"><button className="gov-button primary" disabled={saving} onClick={()=>void decideApproval(row,'approved')}><CheckCircle2 size={13}/> Approve and apply</button><button className="gov-button danger" disabled={saving} onClick={()=>void decideApproval(row,'rejected')}>Reject</button></div>}</article>)}</div>:<div className="gov-empty">No approval requests match this view.</div>}
      {pageControls(orderedApprovals.length,approvalsCurrentPage,approvalsPageCount,setApprovalPage)}
    </section>
  }
  function renderPolicies(){
    return <section className="gov-panel"><header><div><h2>Policy and rule register</h2><p>Institution policies, publication status, effective dates and recorded revisions.</p></div><button className="gov-button primary" onClick={()=>openPolicy()}><Plus size={14}/> Add policy</button></header><label className="ed360-admin-search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search policy title, reference or category…"/></label>
      {filteredPolicies.length?<div className="ed360-admin-policy-list">{filteredPolicies.map(row=>{const revisions=audit.filter(event=>event.record_id===row.id).sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at)));return <article className="ed360-admin-policy-card" key={row.id}><header><div><h3>{row.title}</h3><div className="ed360-admin-policy-meta"><span>{row.reference_code??'No reference'}</span><span>{label(row.payload?.category??'general')}</span><span>Revision {Number(row.payload?.revision??1)}</span><span>Effective {row.effective_date??'Not set'}</span></div></div><span className={'ed360-admin-status '+row.status}>{label(row.status)}</span></header>{row.description&&<p>{row.description}</p>}<div className="gov-row-actions"><button className="gov-button" onClick={()=>openPolicy(row)}>Edit / revise</button><button className="gov-button danger" onClick={()=>void removePolicy(row)}>Delete</button></div><details><summary>Revision and audit history ({revisions.length} events)</summary>{revisions.length?revisions.map(event=><p key={event.id}>{dateLabel(event.occurred_at)} · {label(event.action)} by {event.actor_id??'system'}</p>):<p>No prior revisions have been captured in the audit feed.</p>}</details></article>})}</div>:<div className="gov-empty">No policies or rules have been recorded yet.</div>}
      <div className="gov-note">Policies are stored in the institution-scoped Administration record set. Existing database audit triggers record insert, update and delete events.</div>
    </section>
  }
  function renderPermissions(){
    const rows=[
      {role:'Owner',scope:'All institution responsibilities',view:'All',create:'All',edit:'All',remove:'All',approve:'Configured flows',export:'Where enabled',settings:'Yes'},
      {role:'Administrator',scope:'Delegated institution operations',view:'Allowed modules',create:'Allowed modules',edit:'Allowed modules',remove:'RLS guarded',approve:'Configured flows',export:'Where enabled',settings:'Yes'},
      {role:'Teacher',scope:'Assigned teaching and staff records',view:'Assigned records',create:'Teaching workflows',edit:'Permitted records',remove:'Restricted',approve:'Request / review',export:'No institution-wide',settings:'No'},
      {role:'Accountant',scope:'Finance, fees and payroll',view:'Finance scope',create:'Finance scope',edit:'Finance scope',remove:'Restricted',approve:'No global approval',export:'Finance reports',settings:'No'},
      {role:'Examination officer',scope:'Assessments and reports',view:'Exam scope',create:'Assessment scope',edit:'Assessment scope',remove:'Restricted',approve:'Assessment-specific',export:'Result reports',settings:'No'},
      {role:'Student',scope:'Linked student portal records',view:'Linked records',create:'No',edit:'No',remove:'No',approve:'No',export:'No',settings:'No'},
      {role:'Parent / guardian',scope:'Linked family portal records',view:'Linked records',create:'No',edit:'No',remove:'No',approve:'No',export:'No',settings:'No'},
    ]
    return <div className="ed360-admin-stage5"><section className="gov-panel"><header><div><h2>Effective role permission matrix</h2><p>Current role boundaries across the institution—not an unrestricted permission editor.</p></div><ShieldCheck size={20}/></header><div className="gov-table-wrap"><table className="ed360-admin-permission-table"><thead><tr><th>Role</th><th>View</th><th>Create</th><th>Edit</th><th>Delete</th><th>Approve</th><th>Export</th><th>Manage settings</th></tr></thead><tbody>{rows.map(row=><tr key={row.role}><td title={row.scope}>{row.role}<small style={{display:'block',fontWeight:400,color:'#89968b',marginTop:3}}>{row.scope}</small></td>{(['view','create','edit','remove','approve','export','settings'] as const).map(key=><td key={key} className={row[key]==='No'?'ed360-admin-permission-no':row[key]==='All'?'ed360-admin-permission-yes':'ed360-admin-permission-limited'}>{row[key]}</td>)}</tr>)}</tbody></table></div></section><div className="ed360-admin-callout warning">This matrix documents role boundaries enforced by application routes and Supabase Row Level Security. It does not create custom role overrides. Editable permission toggles are intentionally omitted until a matching permission model and database policies exist; front-end-only toggles cannot protect sensitive data.</div></div>
  }
  function renderAudit(){
    return <section className="gov-panel"><header><div><h2>Administrative change history</h2><p>Searchable, institution-scoped events showing action, module, timestamp, actor and before/after values.</p></div><span className="gov-readonly">Immutable feed</span></header><label className="ed360-admin-search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search actor, action, module or record…"/></label>{filteredAudit.length?<div className="gov-timeline">{filteredAudit.map(row=><article key={row.id}><i/><div><strong>{label(row.action)} · {label(row.module_key)} / {label(row.record_type)}</strong><small>{dateLabel(row.occurred_at)} · Actor {String(row.actor_id??'system')} · Record {String(row.record_id)}</small><details><summary>View recorded values</summary><div><div><b>Before</b><pre>{JSON.stringify(row.old_values??null,null,2)}</pre></div><div><b>After</b><pre>{JSON.stringify(row.new_values??null,null,2)}</pre></div></div></details></div></article>)}</div>:<div className="gov-empty">No administrative audit events match this search.</div>}</section>
  }
  function renderAccounts(){
    return <section className="gov-panel"><header><div><h2>User access and invitations</h2><p>Institution memberships, role assignments and account activation status.</p></div><Users size={20}/></header><div className="ed360-admin-kpis"><article><small>Total memberships</small><strong>{members.length}</strong></article><article><small>Active</small><strong>{members.filter(row=>row.status==='active').length}</strong></article><article><small>Invited / pending</small><strong>{members.filter(row=>['invited','pending'].includes(row.status)).length}</strong></article><article><small>Suspended / inactive</small><strong>{members.filter(row=>['suspended','inactive'].includes(row.status)).length}</strong></article></div><label className="ed360-admin-search"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email, role or status…"/></label>{filteredMembers.length?<div className="gov-table-wrap"><table className="ed360-admin-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Access status</th><th>Added</th></tr></thead><tbody>{filteredMembers.map(row=><tr key={row.user_id}><td><b>{row.full_name}</b></td><td>{row.email}</td><td>{label(row.role)}</td><td><span className={'ed360-admin-status '+row.status}>{label(row.status)}</span></td><td>{dateLabel(row.created_at)}</td></tr>)}</tbody></table></div>:<div className="gov-empty">No memberships match this search.</div>}<div className="gov-row-actions" style={{marginTop:14}}><button className="gov-button primary" onClick={()=>onNavigate('accounts')}>Open User Account Manager <ArrowUpRight size={14}/></button></div><div className="gov-note">Account provisioning is handled in the linked account manager. Email invitation resends and membership suspension changes are not exposed by the current account API, so status is read-only here.</div></section>
  }
  function renderSecurity(){
    const related=filteredAudit.filter(row=>/auth|login|session|security|access|membership/i.test(row.module_key+' '+row.record_type+' '+row.action))
    return <div className="ed360-admin-stage5"><section className="gov-panel"><header><div><h2>Security and access overview</h2><p>Current membership status and available administrative security evidence.</p></div><LockKeyhole size={20}/></header><div className="ed360-admin-security-grid"><article><b>{members.filter(row=>row.status==='active').length} active memberships</b><small>Active institution accounts recorded in memberships.</small></article><article><b>{members.filter(row=>row.status!=='active').length} non-active memberships</b><small>Invited, pending, suspended or inactive states where recorded.</small></article><article><b>{related.length} related audit events</b><small>Operational audit entries with security or access keywords.</small></article></div><div className="ed360-admin-callout warning">Login history, failed sign-in attempts and live session termination are not exposed by the current tenant-facing database API. No invented sign-in events or false zero counts are shown. A privileged, tenant-filtered authentication event feed is required before these controls can be enabled.</div></section><section className="gov-panel"><header><div><h2>Available access audit events</h2><p>Operational audit entries that reference authentication, security, access or memberships.</p></div></header>{related.length?<div className="gov-timeline">{related.slice(0,100).map(row=><article key={row.id}><i/><div><strong>{label(row.action)} · {label(row.module_key)}</strong><small>{dateLabel(row.occurred_at)} · {row.actor_id??'system'}</small></div></article>)}</div>:<div className="gov-empty">No security-labelled administrative events are available in the current feed.</div>}</section></div>
  }
  function renderContent(){
    if(section==='profile')return renderProfile()
    if(section==='academic')return renderAcademic()
    if(section==='departments')return renderDepartments()
    if(section==='organization')return renderOrganization()
    if(['system','settings','branding'].includes(section))return renderSettingsPage()
    if(section==='approvals')return renderApprovals()
    if(section==='policies')return renderPolicies()
    if(section==='audit')return renderAudit()
    if(section==='accounts')return renderAccounts()
    if(section==='permissions')return renderPermissions()
    if(section==='security')return renderSecurity()
    return null
  }
  if(!admin)return <main className="page-content"><div className="gov-error">Administration is restricted to authorised institution owners and administrators.</div></main>
  return <main className="gov-stage page-content ed360-module-page ed360-admin-stage5">
    <header className="gov-heading"><div><span>ADMINISTRATION / INSTITUTION CONTROL</span><h1>{pageTitle[section]}</h1><p>Institution-scoped controls, operational registers and role-protected changes.</p></div><span className="gov-live"><i/>Live institution data</span></header>
    <section className="gov-context"><div><small>ADMINISTRATION WORKSPACE</small><h2>{pageTitle[section]}</h2><p>{institution?.name??user?.institutionName??'Institution'} · {label(user?.role)}</p></div><div><strong>{section==='settings'||section==='system'||section==='branding'?visibleSettings.length:section==='approvals'?approvals.length:section==='audit'?audit.length:section==='policies'?policies.length:section==='departments'?departments.length:section==='organization'?teachers.length:section==='accounts'||section==='security'?members.length:section==='profile'?(institution?1:0):'—'}</strong><small>{['settings','system','branding'].includes(section)?'Saved values':section==='approvals'?'Approval requests':section==='audit'?'Audit events':section==='policies'?'Policies':section==='departments'?'Departments':section==='organization'?'Staff records':section==='accounts'||section==='security'?'Memberships':'Institution record'}</small></div></section>
    {error&&<div className="gov-error" role="alert">{error}</div>}
    {loading?<div className="gov-empty"><RefreshCw size={18}/> Loading Administration records…</div>:renderContent()}
    <footer className="gov-footer"><span><ShieldCheck size={14}/> Institution data remains scoped by the signed-in membership and database policies.</span><button className="gov-button" onClick={()=>void load()}><RefreshCw size={13}/> Refresh</button></footer>
    {settingForm&&<div className="modal-backdrop"><section className="modal-card gov-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">INSTITUTION CONFIGURATION</div><h2>{settingEditing?'Edit setting':'Create setting'}</h2><p>Save an institution-scoped value. Public visibility is off by default.</p></div><button className="icon-button" onClick={()=>setSettingForm(false)}><X size={18}/></button></div><form className="gov-form" onSubmit={saveSetting}><label>Category *<input required value={settingCategory} onChange={e=>setSettingCategory(e.target.value)}/></label><label>Setting key *<input required value={settingKey} onChange={e=>setSettingKey(e.target.value)}/></label><label>Value (JSON) *<textarea rows={6} required value={settingValue} onChange={e=>setSettingValue(e.target.value)}/></label><label className="gov-check"><input type="checkbox" checked={settingPublic} onChange={e=>setSettingPublic(e.target.checked)}/> Publicly visible to unauthenticated visitors</label><div className="modal-actions"><button type="button" className="gov-button" onClick={()=>setSettingForm(false)}>Cancel</button><button className="gov-button primary" disabled={saving}><Save size={14}/> Save setting</button></div></form></section></div>}
    {approvalForm&&<div className="modal-backdrop"><section className="modal-card gov-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">APPROVAL REQUEST</div><h2>Request an institute setting change</h2><p>The owner/administrator decision applies the saved value atomically.</p></div><button className="icon-button" onClick={()=>setApprovalForm(false)}><X size={18}/></button></div><form className="gov-form" onSubmit={submitApproval}><label>Setting key *<input required value={approvalKey} onChange={e=>setApprovalKey(e.target.value)}/></label><label>Requested value (JSON) *<textarea rows={6} required value={approvalValue} onChange={e=>setApprovalValue(e.target.value)}/></label><label className="gov-check"><input type="checkbox" checked={approvalPublic} onChange={e=>setApprovalPublic(e.target.checked)}/> Request public visibility</label><label>Request notes<input value={approvalNotes} onChange={e=>setApprovalNotes(e.target.value)} placeholder="Optional context"/></label><div className="modal-actions"><button type="button" className="gov-button" onClick={()=>setApprovalForm(false)}>Cancel</button><button className="gov-button primary" disabled={saving}>Submit request</button></div></form></section></div>}
    {policyForm&&<div className="modal-backdrop"><section className="modal-card gov-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">INSTITUTIONAL POLICY</div><h2>{policyEditing?'Revise policy':'Create policy or rule'}</h2><p>Each save increments the revision and is included in the audit feed.</p></div><button className="icon-button" onClick={()=>setPolicyForm(false)} aria-label="Close"><X size={18}/></button></div><form className="gov-form" onSubmit={savePolicy}><label>Policy title *<input required value={policyTitle} onChange={e=>setPolicyTitle(e.target.value)}/></label><label>Reference code<input value={policyCode} onChange={e=>setPolicyCode(e.target.value)}/></label><label>Category<input value={policyCategory} onChange={e=>setPolicyCategory(e.target.value)}/></label><label>Description / guideline<textarea rows={5} value={policyDescription} onChange={e=>setPolicyDescription(e.target.value)}/></label><label>Effective date<input type="date" value={policyEffectiveDate} onChange={e=>setPolicyEffectiveDate(e.target.value)}/></label><label>Publication status<select value={policyStatus} onChange={e=>setPolicyStatus(e.target.value)}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><div className="modal-actions"><button type="button" className="gov-button" onClick={()=>setPolicyForm(false)}>Cancel</button><button className="gov-button primary" disabled={saving}>{policyEditing?'Save revision':'Create policy'}</button></div></form></section></div>}
  </main>
}
