import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowUpRight, Building2, CheckCircle2, ClipboardCheck, History, Plus, RefreshCw, Save, Settings, ShieldCheck, Users, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/userErrors'
import type { RecordRow } from '../lib/types'
import '../styles/governance-workspace.css'

type Section='profile'|'settings'|'approvals'|'audit'|'academic'|'accounts'
type Props={initialWindow?:string;onToast:(message:string,error?:boolean)=>void;onNavigate:(route:string)=>void}
type Approval=RecordRow & {id:string;workflow_key:string;status:string;target_type:string;payload:Record<string,unknown>}
type Setting=RecordRow & {id:string;category:string;setting_key:string;setting_value:unknown;is_public:boolean}
type Audit=RecordRow & {id:string;action:string;module_key:string;record_type:string;occurred_at:string}
const sections:Record<string,Section>={profile:'profile',settings:'settings',approvals:'approvals',audit:'audit',academic:'academic',accounts:'accounts'}
const title:Record<Section,string>={profile:'Institution profile',settings:'Institution settings',approvals:'Approval workflows',audit:'Operational audit history',academic:'Academic administration',accounts:'User access'}
const dateLabel=(value:unknown)=>value?new Date(String(value)).toLocaleString():'—'
const prettify=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())

export function GovernanceWorkspace({initialWindow,onToast,onNavigate}:Props){
  const {user}=useAuth()
  const [section,setSection]=useState<Section>(sections[initialWindow??'']??'profile')
  const admin=['owner','admin'].includes(user!.role)
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [institution,setInstitution]=useState<{id:string;name:string;institution_type:string}|null>(null)
  const [settings,setSettings]=useState<Setting[]>([])
  const [approvals,setApprovals]=useState<Approval[]>([])
  const [audit,setAudit]=useState<Audit[]>([])
  const [query,setQuery]=useState('')
  const [settingForm,setSettingForm]=useState(false)
  const [settingEditing,setSettingEditing]=useState<Setting|null>(null)
  const [category,setCategory]=useState('general')
  const [settingKey,setSettingKey]=useState('')
  const [settingValue,setSettingValue]=useState('{}')
  const [isPublic,setIsPublic]=useState(false)
  const [approvalForm,setApprovalForm]=useState(false)
  const [approvalCategory,setApprovalCategory]=useState('general')
  const [approvalKey,setApprovalKey]=useState('')
  const [approvalValue,setApprovalValue]=useState('{}')
  const [approvalPublic,setApprovalPublic]=useState(false)
  const [approvalNotes,setApprovalNotes]=useState('')

  async function load(silent=false){
    if(!supabase||!user){setLoading(false);return}
    if(!silent){setLoading(true);setError('')}
    try{
      const {data:institutionRow,error:institutionError}=await supabase.from('institutions').select('id,name,institution_type').eq('id',user.institutionId).maybeSingle()
      if(institutionError)throw institutionError
      setInstitution(institutionRow)
      const approvalQuery=supabase.from('workflow_approvals').select('*').eq('institution_id',user.institutionId).order('requested_at',{ascending:false}).limit(500)
      const [approvalResult,settingsResult,auditResult]=await Promise.all([
        approvalQuery,
        admin?supabase.from('institution_settings').select('*').eq('institution_id',user.institutionId).order('category').order('setting_key').limit(1000):Promise.resolve({data:[],error:null}),
        admin?supabase.from('institutional_audit_events').select('*').eq('institution_id',user.institutionId).order('occurred_at',{ascending:false}).limit(500):Promise.resolve({data:[],error:null}),
      ])
      for(const result of [approvalResult,settingsResult,auditResult])if(result.error)throw result.error
      setApprovals((approvalResult.data??[]) as Approval[])
      setSettings((settingsResult.data??[]) as Setting[])
      setAudit((auditResult.data??[]) as Audit[])
    }catch(err){
      const message=userFacingError(err,'Governance records could not be loaded.')
      setError(message);if(!silent)onToast(message,true)
    }finally{setLoading(false)}
  }

  useEffect(()=>{void load()},[user?.id,user?.institutionId,user?.role])

  const filteredSettings=useMemo(()=>settings.filter(row=>[row.category,row.setting_key,JSON.stringify(row.setting_value)].join(' ').toLowerCase().includes(query.trim().toLowerCase())),[settings,query])
  const filteredApprovals=useMemo(()=>approvals.filter(row=>[row.workflow_key,row.target_type,row.status,JSON.stringify(row.payload)].join(' ').toLowerCase().includes(query.trim().toLowerCase())),[approvals,query])
  const pendingApprovals=approvals.filter(row=>row.status==='pending').length

  function openSetting(row?:Setting){
    setSettingEditing(row??null);setCategory(row?.category??'general');setSettingKey(row?.setting_key??'')
    setSettingValue(JSON.stringify(row?.setting_value??{},null,2));setIsPublic(row?.is_public??false);setSettingForm(true)
  }

  async function saveSetting(event:FormEvent){
    event.preventDefault();if(!supabase||!admin)return
    let parsed:unknown
    try{parsed=JSON.parse(settingValue)}catch{onToast('Enter a valid JSON setting value.',true);return}
    if(!settingKey.trim()||!category.trim()){onToast('Category and setting key are required.',true);return}
    setSaving(true)
    const values={category:category.trim(),setting_key:settingKey.trim(),setting_value:parsed,is_public:isPublic,updated_by:user!.id,updated_at:new Date().toISOString()}
    const result=settingEditing
      ? await supabase.from('institution_settings').update(values).eq('institution_id',user!.institutionId).eq('id',settingEditing.id)
      : await supabase.from('institution_settings').insert({...values,institution_id:user!.institutionId})
    if(result.error)onToast(userFacingError(result.error,'Institution setting could not be saved.'),true)
    else{setSettingForm(false);onToast(settingEditing?'Institution setting updated.':'Institution setting created.');await load(true)}
    setSaving(false)
  }

  async function removeSetting(row:Setting){
    if(!supabase||!admin)return
    if(!window.confirm('Remove the setting '+row.category+'/'+row.setting_key+'?'))return
    const {error:removeError}=await supabase.from('institution_settings').delete().eq('institution_id',user!.institutionId).eq('id',row.id)
    if(removeError)onToast(userFacingError(removeError,'Institution setting could not be removed.'),true)
    else{onToast('Institution setting removed.');await load(true)}
  }

  async function submitApproval(event:FormEvent){
    event.preventDefault();if(!supabase)return
    let parsed:unknown
    try{parsed=JSON.parse(approvalValue)}catch{onToast('Enter a valid JSON setting value.',true);return}
    if(!approvalKey.trim()||!approvalCategory.trim()){onToast('Category and setting key are required.',true);return}
    const targetId=crypto.randomUUID()
    setSaving(true)
    const {error:requestError}=await supabase.from('workflow_approvals').insert({
      institution_id:user!.institutionId,workflow_key:'institution_setting_change',target_type:'institution_settings',
      target_id:targetId,requested_by:user!.id,status:'pending',
      payload:{category:approvalCategory.trim(),setting_key:approvalKey.trim(),setting_value:parsed,is_public:approvalPublic},
    })
    if(requestError)onToast(userFacingError(requestError,'Setting change request could not be submitted.'),true)
    else{setApprovalForm(false);setApprovalKey('');setApprovalValue('{}');setApprovalNotes('');onToast('Setting change request submitted for owner/administrator review.');await load(true)}
    setSaving(false)
  }

  async function decideApproval(row:Approval,decision:'approved'|'rejected'){
    if(!supabase||!admin)return
    const notes=window.prompt(decision==='approved'?'Optional approval note:':'Reason for rejection (recommended):','')??''
    if(decision==='rejected'&&!notes.trim()){onToast('Add a short reason before rejecting this request.',true);return}
    setSaving(true)
    const {error:decisionError}=await supabase.rpc('decide_institution_setting_approval',{
      p_institution_id:user!.institutionId,p_approval_id:row.id,p_decision:decision,p_notes:notes,
    })
    if(decisionError)onToast(userFacingError(decisionError,'Approval decision could not be saved.'),true)
    else{onToast(decision==='approved'?'Request approved and setting applied atomically.':'Request rejected.');await load(true)}
    setSaving(false)
  }

  function renderContent(){
    if(section==='profile')return <section className="gov-panel"><header><div><h2>Institution identity</h2><p>Registered institution details used by the signed-in cloud session.</p></div><span className="gov-readonly">Read only</span></header>{institution?<div className="gov-profile-grid"><article><small>Institution name</small><strong>{institution.name}</strong></article><article><small>Institution type</small><strong>{prettify(institution.institution_type)}</strong></article><article><small>Institution ID</small><strong className="gov-mono">{institution.id}</strong></article><article><small>Signed-in role</small><strong>{prettify(user!.role)}</strong></article></div>:<div className="gov-empty">Institution profile could not be found for this account.</div>}<div className="gov-note">The current database policy permits institution members to view this record but does not grant direct client updates. Profile changes should not be presented as saved until a separately authorised profile workflow exists.</div></section>
    if(section==='settings')return <section className="gov-panel"><header><div><h2>Institution settings</h2><p>Tenant-scoped configuration values stored as JSON. Public visibility is explicit and default-off.</p></div>{admin&&<button className="gov-button primary" onClick={()=>openSetting()}><Plus size={14}/> Add setting</button>}</header><label className="gov-search">Search settings<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Category, key or JSON value…"/></label>{filteredSettings.length?<div className="gov-table-wrap"><table><thead><tr><th>Category</th><th>Key</th><th>Value</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>{filteredSettings.map(row=><tr key={row.id}><td>{prettify(row.category)}</td><td><b>{row.setting_key}</b></td><td><code>{JSON.stringify(row.setting_value)}</code></td><td>{row.is_public?'Public':'Private'}</td><td><div className="gov-row-actions"><button className="gov-button" onClick={()=>openSetting(row)}>Edit</button><button className="gov-button danger" onClick={()=>void removeSetting(row)}>Delete</button></div></td></tr>)}</tbody></table></div>:<div className="gov-empty">No institution settings found. Create the first setting for this institution.</div>}</section>
    if(section==='approvals')return <section className="gov-panel"><header><div><h2>Approval queue</h2><p>Workflow requests submitted by members. Settings requests are applied in the same transaction as their approval decision.</p></div><div className="gov-header-actions"><span className="gov-pending">{pendingApprovals} pending</span><button className="gov-button primary" onClick={()=>setApprovalForm(true)}><Plus size={14}/> Request setting change</button></div></header><label className="gov-search">Search requests<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Workflow, target or status…"/></label>{filteredApprovals.length?<div className="gov-approval-list">{filteredApprovals.map(row=><article key={row.id}><div className="gov-approval-heading"><div><small>{prettify(row.workflow_key)}</small><strong>{prettify(row.target_type)}</strong></div><span className={'gov-status '+row.status}>{prettify(row.status)}</span></div><dl><div><dt>Requested</dt><dd>{dateLabel(row.requested_at)}</dd></div><div><dt>Requester</dt><dd>{String(row.requested_by??'Institution member')}</dd></div><div><dt>Target</dt><dd className="gov-mono">{row.target_id}</dd></div></dl>{row.workflow_key==='institution_setting_change'&&<div className="gov-payload"><b>{String(row.payload.category??'general')} / {String(row.payload.setting_key??'setting')}</b><pre>{JSON.stringify(row.payload.setting_value??{},null,2)}</pre><small>{row.payload.is_public?'Public visibility requested':'Private visibility requested'}</small></div>}{row.decision_notes&&<p className="gov-decision-note">{String(row.decision_notes)}</p>}{admin&&row.status==='pending'&&<div className="gov-row-actions"><button className="gov-button primary" disabled={saving} onClick={()=>void decideApproval(row,'approved')}><CheckCircle2 size={13}/> Approve and apply</button><button className="gov-button danger" disabled={saving} onClick={()=>void decideApproval(row,'rejected')}>Reject</button></div>}</article>)}</div>:<div className="gov-empty">No approval requests match this view.</div>}</section>
    if(section==='audit')return <section className="gov-panel"><header><div><h2>Operational record audit</h2><p>Immutable audit events emitted by the institutional records workflow. This is not a complete login/security event feed.</p></div></header>{audit.length?<div className="gov-timeline">{audit.map(row=><article key={row.id}><i/><div><strong>{prettify(row.action)} · {prettify(row.module_key)} / {prettify(row.record_type)}</strong><small>{dateLabel(row.occurred_at)} · Actor {String(row.actor_id??'system')}</small><details><summary>View recorded values</summary><div><b>Before</b><pre>{JSON.stringify(row.old_values??null,null,2)}</pre><b>After</b><pre>{JSON.stringify(row.new_values??null,null,2)}</pre></div></details></div></article>)}</div>:<div className="gov-empty">No institutional operational audit events are available yet. Student and employee history is available in their respective workspaces.</div>}</section>
    if(section==='academic')return <section className="gov-panel"><header><div><h2>Academic structure</h2><p>Open the dedicated administration records where programmes, sessions, classes and subjects have their own data forms and relationships.</p></div></header><div className="gov-shortcuts"><button onClick={()=>onNavigate('admin:departments')}><Building2 size={18}/> Departments <ArrowUpRight size={14}/></button><button onClick={()=>onNavigate('admin:programs')}><BookOpen size={18}/> Programs <ArrowUpRight size={14}/></button><button onClick={()=>onNavigate('admin:academic_sessions')}><CalendarDays size={18}/> Academic sessions <ArrowUpRight size={14}/></button><button onClick={()=>onNavigate('admin:classes')}><Users size={18}/> Classes and sections <ArrowUpRight size={14}/></button><button onClick={()=>onNavigate('admin:subjects')}><BookOpen size={18}/> Subjects <ArrowUpRight size={14}/></button><button onClick={()=>onNavigate('admin:rooms')}><Building2 size={18}/> Rooms and facilities <ArrowUpRight size={14}/></button></div></section>
    if(section==='accounts')return <section className="gov-panel"><header><div><h2>User access and invitations</h2><p>Institution-managed account provisioning and role-linked learner/guardian identities.</p></div></header><p className="gov-note">User account provisioning is handled by the dedicated Accounts workspace, which contains separate account overview, directory and provisioning operations.</p><button className="gov-button primary" onClick={()=>onNavigate('accounts')}><Users size={14}/> Open user accounts</button></section>
    return null
  }

  return <main className="gov-stage page-content ed360-module-page">
    <header className="gov-heading"><div><span>INSTITUTION GOVERNANCE / ADMINISTRATION</span><h1>Administration and Governance</h1><p>Institution identity, configuration, approvals and operational audit trails.</p></div><span className="gov-live"><i/>Live institution data</span></header>
    <nav className="gov-nav" aria-label="Governance workspace">{(admin?['profile','settings','approvals','audit','academic','accounts']:['profile','approvals']).map(key=><button type="button" key={key} className={section===key?'active':''} onClick={()=>setSection(key as Section)}>{title[key as Section]}</button>)}</nav>
    <section className="gov-context"><div><small>ACTIVE GOVERNANCE WINDOW</small><h2>{title[section]}</h2><p>Role-scoped records, with institution-level changes guarded by database permissions.</p></div><div><strong>{section==='settings'?settings.length:section==='approvals'?approvals.length:section==='audit'?audit.length:section==='profile'?(institution?1:0):'—'}</strong><small>{section==='settings'?'Saved settings':section==='approvals'?'Requests':section==='audit'?'Audit events':'Institution records'}</small></div></section>
    {error&&<div className="gov-error" role="alert">{error}</div>}
    {loading?<div className="gov-empty"><RefreshCw size={18}/> Loading governance records…</div>:renderContent()}
    <footer className="gov-footer"><span><ShieldCheck size={14}/> Institution-wide changes require an authorised owner or administrator.</span><button className="gov-button" onClick={()=>void load()}><RefreshCw size={13}/> Refresh</button></footer>
    {settingForm&&<div className="modal-backdrop"><section className="modal-card gov-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">INSTITUTION SETTINGS</div><h2>{settingEditing?'Edit setting':'Create setting'}</h2><p>Store structured configuration as valid JSON.</p></div><button className="icon-button" onClick={()=>setSettingForm(false)}><X size={18}/></button></div><form className="gov-form" onSubmit={saveSetting}><label>Category *<input required value={category} onChange={e=>setCategory(e.target.value)}/></label><label>Setting key *<input required value={settingKey} onChange={e=>setSettingKey(e.target.value)}/></label><label>Value (JSON) *<textarea rows={6} required value={settingValue} onChange={e=>setSettingValue(e.target.value)}/></label><label className="gov-check"><input type="checkbox" checked={isPublic} onChange={e=>setIsPublic(e.target.checked)}/> Publicly visible to unauthenticated visitors</label><div className="modal-actions"><button type="button" className="gov-button" onClick={()=>setSettingForm(false)}>Cancel</button><button className="gov-button primary" disabled={saving}><Save size={14}/> Save setting</button></div></form></section></div>}
    {approvalForm&&<div className="modal-backdrop"><section className="modal-card gov-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">WORKFLOW APPROVAL</div><h2>Request setting change</h2><p>Owner/admin approval applies this setting atomically with the approval decision.</p></div><button className="icon-button" onClick={()=>setApprovalForm(false)}><X size={18}/></button></div><form className="gov-form" onSubmit={submitApproval}><label>Category *<input required value={approvalCategory} onChange={e=>setApprovalCategory(e.target.value)}/></label><label>Setting key *<input required value={approvalKey} onChange={e=>setApprovalKey(e.target.value)}/></label><label>Requested value (JSON) *<textarea rows={6} required value={approvalValue} onChange={e=>setApprovalValue(e.target.value)}/></label><label className="gov-check"><input type="checkbox" checked={approvalPublic} onChange={e=>setApprovalPublic(e.target.checked)}/> Request public visibility</label><label>Request notes<input value={approvalNotes} onChange={e=>setApprovalNotes(e.target.value)} placeholder="Optional context"/></label><div className="modal-actions"><button type="button" className="gov-button" onClick={()=>setApprovalForm(false)}>Cancel</button><button className="gov-button primary" disabled={saving}>Submit request</button></div></form></section></div>}
  </main>
}
