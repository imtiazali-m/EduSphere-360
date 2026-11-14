import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertCircle, ArrowUpRight, CircleHelp, Cloud, Fingerprint, KeyRound, RefreshCw, ShieldCheck, Video, Youtube, type LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/integrations-workspace.css'

type PageKey = 'overview'|'ai-providers'|'zoom'|'google'|'youtube'|'biometric'
type ProviderKey = 'openai'|'anthropic'|'gemini'|'deepseek'|'xai'|'meta'|'perplexity'
type ProviderState = Record<string,{configured:boolean}>
const providers:{key:ProviderKey;name:string;model:string;secret:string;purpose:string}[]=[
 {key:'openai',name:'OpenAI',model:'gpt-6.1-sol',secret:'OPENAI_API_KEY',purpose:'Reasoning, document assistance and institutional insights'},
 {key:'anthropic',name:'Anthropic Claude',model:'claude-sonnet-5-5',secret:'ANTHROPIC_API_KEY',purpose:'Long-form analysis, policy and document review'},
 {key:'gemini',name:'Google Gemini',model:'gemini-3.8-flash',secret:'GEMINI_API_KEY',purpose:'Multimodal learning assistance and analysis'},
 {key:'deepseek',name:'DeepSeek',model:'deepseek-flash',secret:'DEEPSEEK_API_KEY',purpose:'Cost-conscious analytical and coding tasks'},
 {key:'xai',name:'xAI Grok',model:'grok-4.7',secret:'XAI_API_KEY',purpose:'Research and reasoning tasks'},
 {key:'meta',name:'Meta AI',model:'muse-spark-1.3',secret:'MODEL_API_KEY',purpose:'General assistant and content generation'},
 {key:'perplexity',name:'Perplexity',model:'fast-search',secret:'PERPLEXITY_API_KEY',purpose:'Grounded web research and source discovery'},
]
const pages:Record<PageKey,{title:string;eyebrow:string;intro:string}> = {
 overview:{title:'Integrations & Devices',eyebrow:'INSTITUTION PLATFORM',intro:'Connect approved teaching, meeting, AI and attendance services. Each connection is verified before it is shown as ready.'},
 'ai-providers':{title:'AI Provider Connections',eyebrow:'AI SERVICES',intro:'Check server-side provider credentials, test each model and use only verified connections in AI workspaces.'},
 zoom:{title:'Zoom Virtual Classrooms',eyebrow:'LIVE TEACHING',intro:'Create college-hosted meetings from a lesson or class, distribute student join links and import meeting attendance after the session.'},
 google:{title:'Google Workspace',eyebrow:'CLASSROOM · MEET · DRIVE',intro:'Connect Google Classroom coursework, Google Meet sessions and Drive learning materials through the college-approved Google account.'},
 youtube:{title:'YouTube Learning',eyebrow:'VIDEO LEARNING',intro:'Embed approved YouTube lessons in course materials. Use the Data API only where search or channel management is required.'},
 biometric:{title:'Biometric Attendance Devices',eyebrow:'ATTENDANCE HARDWARE',intro:'Connect a supported fingerprint reader or attendance terminal. A phone’s built-in biometric sensor is for verifying its own user, not enrolling students.'},
}
const steps:Record<Exclude<PageKey,'overview'|'ai-providers'>,{number:string;heading:string;detail:string}[]> = {
 zoom:[
  {number:'01',heading:'Create the Zoom app',detail:'The college Zoom account owner creates a Server-to-Server OAuth app in Zoom Marketplace for one central college host account. Use user-based OAuth instead only when teachers must connect their own separate Zoom accounts.'},
  {number:'02',heading:'Grant minimal meeting scopes',detail:'Enable only the meeting create/read and participant/report scopes needed for lessons and attendance. Avoid broad account permissions that the feature does not use.'},
  {number:'03',heading:'Store credentials on the server',detail:'Add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET to Supabase Edge Function secrets. Add the webhook secret after we register the webhook endpoint. Never place these values in website code.'},
  {number:'04',heading:'Deploy OAuth/API and webhook handlers',detail:'The server requests an account_credentials access token, creates meetings, stores the meeting ID and join URL, and verifies signed Zoom webhooks. The host start URL stays private to authorised staff.'},
  {number:'05',heading:'Test a complete lesson',detail:'Create a test meeting, join as a student, end it, receive the webhook and confirm the participant duration appears against the correct class session.'},
 ],
 google:[
  {number:'01',heading:'Create a college-owned Google Cloud project',detail:'The college Workspace administrator creates the project, configures the Google Auth consent screen and identifies the Workspace for Education domain and the account that owns each course.'},
  {number:'02',heading:'Enable the APIs',detail:'Enable Classroom API for courses, rosters, coursework and submissions; Meet REST API for meeting spaces and attendance records; and Drive API for approved learning files.'},
  {number:'03',heading:'Configure OAuth consent',detail:'Create a Web application OAuth client. Choose the smallest Classroom, Meet and Drive scopes for the features approved by the college. Use teacher-by-teacher consent when teachers own their courses.'},
  {number:'04',heading:'Connect the secure callback',detail:'After the Google OAuth callback Edge Function is deployed, add its exact redirect URI to Google Cloud. The server exchanges the authorisation code and stores refresh tokens encrypted per institution/user.'},
  {number:'05',heading:'Test sync in both directions',detail:'Test course matching, create one draft assignment, attach one Drive/YouTube resource, read a test submission and create a Meet space. Verify ownership and student permissions before enabling live sync.'},
 ],
 youtube:[
  {number:'01',heading:'Start with safe video embedding',detail:'For an ordinary lesson video, store its YouTube video ID and use the YouTube IFrame Player API. This does not require a channel password or permission to upload videos.'},
  {number:'02',heading:'Enable YouTube Data API v3 only if needed',detail:'For public video search and metadata, create an API key in the college Google Cloud project, enable YouTube Data API v3 and restrict the key to the website and that API.'},
  {number:'03',heading:'Use OAuth for channel actions',detail:'Uploading, managing private channel resources or acting on a channel requires OAuth consent from the authorised channel owner. Store its refresh token on the server.'},
  {number:'04',heading:'Add lessons to the learning library',detail:'Teachers select an approved video, map it to subject, class and chapter, then publish it as a learning resource. Student progress is recorded by EduSphere, not inferred from a public video view.'},
 ],
 biometric:[
  {number:'01',heading:'Choose a supported reader first',detail:'Select a fingerprint scanner/terminal that explicitly supports Android integration, a documented SDK/API, device identity and server/event export. A generic camera or phone power-button fingerprint sensor is not a student scanner.'},
  {number:'02',heading:'Set up a supervised enrolment station',detail:'An authorised staff member verifies the student’s identity and records consent/notice. Enrol two fingers where supported and provide an accessible non-biometric alternative.'},
  {number:'03',heading:'Keep fingerprint templates on the reader',detail:'The reader should create and match biometric templates locally. The college system stores a student-to-reader template reference, not raw fingerprint images or reusable fingerprint templates.'},
  {number:'04',heading:'Send signed attendance events',detail:'A trusted Android companion app or device gateway sends a signed event containing student ID, device ID, timestamp, event type and match result to a protected Supabase Edge Function. Duplicate events are rejected.'},
  {number:'05',heading:'Verify, reconcile and audit',detail:'Test multiple students, failed matches, offline queue/resync, duplicate scans, device clock drift and manual override. Keep a full audit trail and allow manual/QR attendance if a reader fails.'},
 ],
}
const requiredSecrets:Record<Exclude<PageKey,'overview'|'ai-providers'>,string[]> = {
 zoom:['ZOOM_ACCOUNT_ID','ZOOM_CLIENT_ID','ZOOM_CLIENT_SECRET','ZOOM_WEBHOOK_SECRET_TOKEN'],
 google:['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_TOKEN_ENCRYPTION_KEY'],
 youtube:['YOUTUBE_DATA_API_KEY (only for search/metadata)','GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (only for channel OAuth)'],
 biometric:['No student fingerprint image/template secret belongs in the browser. Device SDK credentials and webhook signing key are server-side.'],
}
const PageIcon:Record<PageKey,LucideIcon>={overview:Cloud,'ai-providers':Activity,zoom:Video,google:Cloud,youtube:Youtube,biometric:Fingerprint}

export function IntegrationManagementWorkspace({initialWindow='overview',onToast,onNavigate}:{initialWindow?:string;onToast:(message:string,error?:boolean)=>void;onNavigate:(route:string)=>void}){
 const {user}=useAuth()
 const page=(initialWindow in pages?initialWindow:'overview') as PageKey
 const meta=pages[page]
 const ActiveIcon=PageIcon[page]
 const [providerStatus,setProviderStatus]=useState<ProviderState>({})
 const [checking,setChecking]=useState(false)
 const [testing,setTesting]=useState('')
 const [lastChecked,setLastChecked]=useState('')
 const [error,setError]=useState('')
 const [testResults,setTestResults]=useState<Record<string,string>>({})

 const refreshAI=useCallback(async()=>{
  if(!supabase||!user){setError('Sign in to check the institution AI connection.');return}
  setChecking(true);setError('')
  try{
   const {data,error:invokeError}=await supabase.functions.invoke('ai-assistant',{body:{action:'status',institutionId:user.institutionId}})
   if(invokeError)throw invokeError
   setProviderStatus((data?.providers??{}) as ProviderState)
   setLastChecked(new Date().toLocaleString())
  }catch(e){setError(e instanceof Error?e.message:'AI provider status could not be checked.');setProviderStatus({})}
  finally{setChecking(false)}
 },[user?.id,user?.institutionId])
 useEffect(()=>{if(page==='ai-providers'||page==='overview')void refreshAI()},[page,refreshAI])
 const configuredCount=useMemo(()=>providers.filter(p=>providerStatus[p.key]?.configured).length,[providerStatus])

 async function testProvider(provider:typeof providers[number]){
  if(!supabase||!user)return
  if(!providerStatus[provider.key]?.configured){onToast(provider.name+' is not configured on the Supabase server.',true);return}
  setTesting(provider.key);setError('')
  try{
   const {data,error:invokeError}=await supabase.functions.invoke('ai-assistant',{body:{
    action:'generate',institutionId:user.institutionId,page:'institutional-intelligence',provider:provider.key,model:provider.model,
    messages:[{role:'user',content:'Reply with exactly the word READY.'}],context:{connection_test:true}
   }})
   if(invokeError)throw invokeError
   if(data?.error)throw new Error(String(data.error))
   const answer=String(data?.text??'').trim()
   if(!answer)throw new Error('The provider returned no text.')
   setTestResults(old=>({...old,[provider.key]:'Passed · '+new Date().toLocaleTimeString()}))
   onToast(provider.name+' completed its live connection test.')
  }catch(e){
   const message=e instanceof Error?e.message:'Connection test failed.'
   setTestResults(old=>({...old,[provider.key]:'Failed · '+message}))
   onToast(provider.name+' test failed: '+message,true)
  }finally{setTesting('')}
 }

 return <main className="page-content ed360-integration-workspace" data-integration-page={page}>
  <header className="ed360-integration-heading">
   <div className="ed360-integration-heading-icon"><ActiveIcon size={21}/></div>
   <div><span>{meta.eyebrow}</span><h1>{meta.title}</h1><p>{meta.intro}</p></div>
   {page==='ai-providers'&&<button type="button" className="button button-outline" onClick={()=>void refreshAI()} disabled={checking}><RefreshCw size={15}/>{checking?'Checking…':'Refresh status'}</button>}
  </header>
  {page==='overview'&&<section className="ed360-integration-grid">
   {(['ai-providers','zoom','google','youtube','biometric'] as PageKey[]).map(key=>{const CardIcon=PageIcon[key];return <article className="ed360-integration-card" key={key}>
    <div className="ed360-integration-card-icon"><CardIcon size={20}/></div><div><span>{pages[key].eyebrow}</span><h2>{pages[key].title}</h2><p>{pages[key].intro}</p></div>
    <div className="ed360-integration-card-foot">{key==='ai-providers'?<b className={configuredCount?'is-ready':'is-pending'}>{checking?'Checking…':configuredCount+' of 7 credentials configured'}</b>:<b className="is-pending">Connection pending</b>}<button type="button" className="button button-outline" onClick={()=>onNavigate('integration:'+key)}>Open workspace <ArrowUpRight size={14}/></button></div>
   </article>)}
  </section>}
  {page==='ai-providers'&&<>
   <div className="ed360-integration-summary"><div><span>VERIFIED CREDENTIALS</span><strong>{checking?'—':configuredCount} / 7</strong><small>Presence check only; not a successful API test</small></div><div><span>LAST CHECKED</span><strong>{lastChecked||'Not checked'}</strong><small>Credentials never leave the server</small></div></div>
   {error&&<div className="ed360-integration-alert"><AlertCircle size={16}/>{error}</div>}
   <div className="ed360-integration-provider-list">{providers.map(p=><article className="ed360-integration-provider" key={p.key}>
    <div className="ed360-integration-provider-title"><div><h2>{p.name}</h2><p>{p.purpose}</p></div><span className={providerStatus[p.key]?.configured?'is-ready':'is-pending'}>{checking?'Checking…':providerStatus[p.key]?.configured?'Credential present':'Not configured'}</span></div>
    <div className="ed360-integration-provider-meta"><span>Model: <b>{p.model}</b></span><span>Secret: <code>{p.secret}</code></span></div>
    <div className="ed360-integration-provider-actions"><button type="button" className="button button-outline" disabled={checking||testing===p.key||!providerStatus[p.key]?.configured} onClick={()=>void testProvider(p)}>{testing===p.key?'Testing…':'Test live connection'}</button>{testResults[p.key]&&<small className={testResults[p.key].startsWith('Passed')?'is-ready':'is-pending'}>{testResults[p.key]}</small>}</div>
   </article>)}</div>
   <aside className="ed360-integration-note"><ShieldCheck size={18}/><p>Add the seven keys directly in <b>Supabase Dashboard → Edge Functions → Secrets</b>. Never paste keys into a website field, source file, GitHub commit or chat. A credential marked present must still pass the live test above before it is treated as working.</p></aside>
  </>}
  {page!=='overview'&&page!=='ai-providers'&&<>
   <div className="ed360-integration-status-card"><div><span>CONNECTION STATUS</span><strong>Not connected</strong><small>This page is a setup guide, not a claim of a live provider link.</small></div><span className="ed360-integration-pill">Setup required</span></div>
   <section className="ed360-integration-steps"><div className="ed360-integration-section-heading"><span>IMPLEMENTATION WORKFLOW</span><h2>Connect {meta.title}</h2></div>{steps[page].map(step=><article className="ed360-integration-step" key={step.number}><b>{step.number}</b><div><h3>{step.heading}</h3><p>{step.detail}</p></div></article>)}</section>
   <section className="ed360-integration-secrets"><div className="ed360-integration-section-heading"><span>SERVER CONFIGURATION</span><h2>Required credentials / device prerequisites</h2></div>{requiredSecrets[page].map(secret=><div className="ed360-integration-secret" key={secret}><KeyRound size={15}/><code>{secret}</code></div>)}</section>
   <aside className="ed360-integration-note"><CircleHelp size={18}/><p>Before enabling this in live classes, the integration must have its approved external app, callback/webhook handler, tenant permission checks, encrypted token storage, audit log and end-to-end test. A visible menu item does not mean the external service is connected.</p></aside>
  </>}
 </main>
}
