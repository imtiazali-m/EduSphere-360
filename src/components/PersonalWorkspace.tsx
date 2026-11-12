import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Activity, Bell, CircleHelp, KeyRound, Save, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/personal-workspace.css'

type PersonalSection='profile'|'account'|'notifications'|'activity'|'help'
type ActivityRow={id:string;action:string;module_key:string;record_type:string;record_id:string;occurred_at:string;new_values?:unknown}
type NoticePreferences={announcements:boolean;attendance:boolean;assignments:boolean;examinations:boolean;fees:boolean;account:boolean}
const preferenceKey='ed360-notification-preferences-v1'
const defaults:NoticePreferences={announcements:true,attendance:true,assignments:true,examinations:true,fees:true,account:true}
const sections:{key:PersonalSection;label:string;icon:typeof UserRound;description:string}[]=[
 {key:'profile',label:'My Profile',icon:UserRound,description:'Your identity and institution membership'},
 {key:'account',label:'Account Settings',icon:KeyRound,description:'Keep your sign-in credentials up to date'},
 {key:'notifications',label:'Notification Settings',icon:Bell,description:'Choose optional notification preferences'},
 {key:'activity',label:'My Activity',icon:Activity,description:'Your recent institution actions'},
 {key:'help',label:'Help & Support',icon:CircleHelp,description:'Find help or send a support request'},
]
const roleName=(role:string)=>role.replaceAll('_',' ').replace(/\b\w/g,v=>v.toUpperCase())

export function PersonalWorkspace({initialWindow,onToast,onNavigate}:{initialWindow?:string;onToast:(message:string,error?:boolean)=>void;onNavigate:(route:string)=>void}){
 const {user}=useAuth()
 const initial:PersonalSection=initialWindow==='account-settings'?'account':initialWindow==='notification-settings'?'notifications':initialWindow==='my-activity'?'activity':initialWindow==='help-support'?'help':'profile'
 const [section,setSection]=useState<PersonalSection>(initial)
 const [preferences,setPreferences]=useState<NoticePreferences>(defaults)
 const [activity,setActivity]=useState<ActivityRow[]>([])
 const [activityLoading,setActivityLoading]=useState(false)
 const [activityError,setActivityError]=useState('')
 const [currentPassword,setCurrentPassword]=useState('')
 const [newPassword,setNewPassword]=useState('')
 const [confirmPassword,setConfirmPassword]=useState('')
 const [savingPassword,setSavingPassword]=useState(false)
 const [savingPreferences,setSavingPreferences]=useState(false)

 useEffect(()=>{
  try{
   const saved=window.localStorage.getItem(preferenceKey)
   if(saved){const parsed=JSON.parse(saved) as Partial<NoticePreferences>;setPreferences({...defaults,...parsed})}
  }catch{/* Keep safe defaults when local browser storage is unavailable. */}
 },[])

 useEffect(()=>{
  let alive=true
  async function loadActivity(){
   if(section!=='activity'||!supabase||!user)return
   setActivityLoading(true);setActivityError('')
   try{
    const {data,error}=await supabase.from('institutional_audit_events')
      .select('id,action,module_key,record_type,record_id,occurred_at,new_values')
      .eq('institution_id',user.institutionId).eq('actor_id',user.id)
      .order('occurred_at',{ascending:false}).limit(100)
    if(error)throw error
    if(alive)setActivity((data??[]) as ActivityRow[])
   }catch(error){
    if(alive){setActivity([]);setActivityError(error instanceof Error?error.message:'Your recent activity could not be loaded.')}
   }finally{if(alive)setActivityLoading(false)}
  }
  void loadActivity()
  return()=>{alive=false}
 },[section,user?.id,user?.institutionId])

 const profileItems=useMemo(()=>[
  ['Full name',user?.fullName??'—'],['Email address',user?.email??'—'],['Account role',user?roleName(user.role):'—'],
  ['Institution',user?.institutionName??'—'],['Institution type',user?.institutionType?.replaceAll('_',' ')??'—'],
  ['Account ID',user?.id??'—'],
 ],[user])

 async function updatePassword(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user)return
  if(newPassword.length<10){onToast('Use a password with at least 10 characters.',true);return}
  if(newPassword!==confirmPassword){onToast('The new passwords do not match.',true);return}
  if(newPassword===currentPassword){onToast('Choose a password different from your current password.',true);return}
  setSavingPassword(true)
  try{
   const {data:verified,error:verifyError}=await supabase.auth.signInWithPassword({email:user.email,password:currentPassword})
   if(verifyError||verified.user?.id!==user.id)throw new Error('The current password is incorrect. Your password was not changed.')
   const {error}=await supabase.auth.updateUser({password:newPassword})
   if(error)throw error
   setCurrentPassword('');setNewPassword('');setConfirmPassword('')
   onToast('Your password was updated successfully.')
  }catch(error){onToast(error instanceof Error?error.message:'Your password could not be updated.',true)}
  finally{setSavingPassword(false)}
 }

 function savePreferences(){
  setSavingPreferences(true)
  try{
   window.localStorage.setItem(preferenceKey,JSON.stringify(preferences))
   onToast('Notification preferences saved on this device.')
  }catch{onToast('This browser could not save the preferences. Check its storage settings.',true)}
  finally{setSavingPreferences(false)}
 }

 return <main className="ed360-personal-workspace">
  <header className="ed360-personal-hero">
   <div className="ed360-personal-hero-mark"><UserRound size={23}/></div>
   <div><span>STAGE 15 / ROLE PORTAL & PERSONAL SETTINGS</span><h1>My Workspace</h1><p>Manage your personal account details, preferences and support requests.</p></div>
  </header>
  <nav className="ed360-personal-nav" aria-label="Personal workspace pages">
   {sections.map(item=>{const Icon=item.icon;return <button key={item.key} type="button" className={section===item.key?'active':''} aria-current={section===item.key?'page':undefined} onClick={()=>setSection(item.key)}><Icon size={16}/><span>{item.label}</span></button>})}
  </nav>
  <section className="ed360-personal-content">
   <header className="ed360-personal-section-heading"><div><span>MY ACCOUNT</span><h2>{sections.find(item=>item.key===section)?.label}</h2><p>{sections.find(item=>item.key===section)?.description}</p></div></header>
   {section==='profile'&&<div className="ed360-personal-profile-layout">
    <article className="ed360-personal-card ed360-personal-id-card"><div className="ed360-personal-avatar">{user?.fullName?.slice(0,1).toUpperCase()??'U'}</div><div><h3>{user?.fullName??'Account user'}</h3><p>{user?roleName(user.role):'Institution member'}</p></div><span className="ed360-personal-active"><i/> Active session</span><small>Your access is managed by your institution.</small></article>
    <article className="ed360-personal-card"><h3>Account information</h3><dl>{profileItems.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="ed360-personal-note"><ShieldCheck size={15}/> Institution-controlled details are read-only here. Ask an authorised administrator to correct them.</p></article>
   </div>}
   {section==='account'&&<article className="ed360-personal-card ed360-personal-form-card"><div className="ed360-personal-card-heading"><span><KeyRound size={18}/></span><div><h3>Change password</h3><p>Use a unique password of at least 10 characters.</p></div></div><form onSubmit={updatePassword}>
    <label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} required/></label>
    <label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={event=>setNewPassword(event.target.value)} minLength={10} required/></label>
    <label>Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} minLength={10} required/></label>
    <div className="ed360-personal-form-actions"><span>Changes are saved directly to your signed-in account.</span><button type="submit" disabled={savingPassword}>{savingPassword?'Updating…':'Update password'}</button></div>
   </form></article>}
   {section==='notifications'&&<article className="ed360-personal-card"><div className="ed360-personal-card-heading"><span><Bell size={18}/></span><div><h3>Optional notification preferences</h3><p>These preferences are stored on this browser. Required account and security notices remain available.</p></div></div>
    <div className="ed360-personal-preferences">{([['announcements','Announcements'],['attendance','Attendance updates'],['assignments','Assignments and homework'],['examinations','Examination reminders'],['fees','Fee reminders'],['account','Account activity']] as const).map(([key,label])=><label key={key}><span><b>{label}</b><small>Optional alerts for {label.toLowerCase()}.</small></span><input type="checkbox" checked={preferences[key]} onChange={event=>setPreferences(old=>({...old,[key]:event.target.checked}))}/></label>)}</div>
    <div className="ed360-personal-form-actions"><span>Saved locally for this device and browser only.</span><button type="button" onClick={savePreferences} disabled={savingPreferences}><Save size={15}/>{savingPreferences?'Saving…':'Save preferences'}</button></div>
   </article>}
   {section==='activity'&&<article className="ed360-personal-card"><div className="ed360-personal-card-heading"><span><Activity size={18}/></span><div><h3>Your recent recorded actions</h3><p>Only audit entries attributed to your signed-in account are requested.</p></div></div>
    {activityError&&<div className="ed360-personal-error" role="alert">{activityError}</div>}
    {activityLoading?<div className="ed360-personal-empty">Loading your activity…</div>:activity.length?<div className="ed360-personal-activity-list">{activity.map(row=><article key={row.id}><span className="ed360-personal-activity-icon"><Activity size={15}/></span><div><b>{row.action.replaceAll('_',' ')}</b><small>{row.module_key.replaceAll('_',' ')} · {row.record_type.replaceAll('-',' ')}</small><time>{row.occurred_at?new Date(row.occurred_at).toLocaleString():'Date unavailable'}</time></div><code>{row.record_id.slice(0,8)}</code></article>)}</div>:<div className="ed360-personal-empty">No personal audit activity is available for this account yet.</div>}
   </article>}
   {section==='help'&&<div className="ed360-personal-help-grid">
    <article className="ed360-personal-card"><span className="ed360-personal-help-icon"><CircleHelp size={20}/></span><h3>Help with your institution account</h3><p>For access, profile corrections, student records, academic matters or payment questions, contact your institution owner or administrator.</p>{user&&['owner','admin','teacher'].includes(user.role)?<button type="button" onClick={()=>onNavigate('institutional:front-office:complaints-helpdesk')}>Open Helpdesk workspace</button>:<p className="ed360-personal-note">The in-app student/parent helpdesk submission channel is not configured in the current database. Contact your institution office directly for assistance.</p>}</article>
    <article className="ed360-personal-card"><span className="ed360-personal-help-icon"><ShieldCheck size={20}/></span><h3>Account and privacy</h3><p>Only use your own account. Do not share passwords or verification codes. Access to institution records is determined by your role and the institution's permissions.</p></article>
   </div>}
  </section>
 </main>
}
