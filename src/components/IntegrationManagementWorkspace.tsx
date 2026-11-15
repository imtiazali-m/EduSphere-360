import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertCircle, ArrowUpRight, CircleHelp, Cloud, Fingerprint, GraduationCap, KeyRound, MessageCircle, Palette, RefreshCw, ShieldCheck, Video, Youtube, type LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/integrations-workspace.css'

type PageKey = 'overview'|'ai-providers'|'biometric'|'whatsapp'|'canva'|'google-classroom'|'zoom'|'youtube'
type ProviderKey = 'cloudflare'|'openai'|'anthropic'|'gemini'|'deepseek'|'xai'|'meta'|'perplexity'
type ProviderState = Record<string,{configured:boolean}>
const providers:{key:ProviderKey;name:string;model:string;secret:string;purpose:string}[]=[
  {key:'cloudflare',name:'Cloudflare Workers AI · Free quota',model:'@cf/zai-org/glm-4.7-flash',secret:'CLOUDFLARE_AI_API_TOKEN + CLOUDFLARE_ACCOUNT_ID',purpose:'Free Workers AI daily allowance · automatic mode uses this provider only'},
 {key:'openai',name:'OpenAI',model:'gpt-6.1-sol',secret:'OPENAI_API_KEY',purpose:'Reasoning, document assistance and institutional insights'},
 {key:'anthropic',name:'Anthropic Claude',model:'claude-sonnet-5-5',secret:'ANTHROPIC_API_KEY',purpose:'Long-form analysis, policy and document review'},
 {key:'gemini',name:'Google Gemini',model:'gemini-3.8-flash',secret:'GEMINI_API_KEY',purpose:'Multimodal learning assistance and analysis'},
 {key:'deepseek',name:'DeepSeek',model:'deepseek-flash',secret:'DEEPSEEK_API_KEY',purpose:'Cost-conscious analytical and coding tasks'},
 {key:'xai',name:'xAI Grok',model:'grok-4.7',secret:'XAI_API_KEY',purpose:'Research and reasoning tasks'},
 {key:'meta',name:'Meta AI',model:'muse-spark-1.3',secret:'MODEL_API_KEY',purpose:'General assistant and content generation'},
 {key:'perplexity',name:'Perplexity',model:'fast-search',secret:'PERPLEXITY_API_KEY',purpose:'Grounded web research and source discovery'},
]
const pages:Record<PageKey,{title:string;eyebrow:string;intro:string}> = {
 overview:{title:'Integrations & Devices',eyebrow:'INSTITUTION PLATFORM',intro:'Manage AI services, communications, design tools, online teaching and attendance hardware from one institutional integration centre.'},
 'ai-providers':{title:'AI Provider Connections',eyebrow:'AI SERVICES',intro:'Check credential readiness and run a live test before an AI provider is used by institutional workflows.'},
 biometric:{title:'Biometric Attendance Devices',eyebrow:'ATTENDANCE HARDWARE',intro:'Connect a supported fingerprint reader or attendance terminal. A phone’s built-in biometric sensor verifies its own user, not a room full of students.'},
 whatsapp:{title:'WhatsApp Business',eyebrow:'COMMUNICATION CHANNEL',intro:'Prepare official WhatsApp messaging for verified institution numbers, approved templates, inbound webhooks and delivery tracking.'},
 canva:{title:'Canva Connect',eyebrow:'DESIGN & DOCUMENTS',intro:'Connect Canva so approved institutional templates and design exports can be used inside EduSphere rather than leaving the college portal.'},
 'google-classroom':{title:'Google Workspace & Classroom',eyebrow:'ACADEMIC CLOUD SERVICES',intro:'Plan the authorised Google connection for Classroom courses, rosters, assignments, course materials and grades.'},
 zoom:{title:'Zoom Meetings & Video',eyebrow:'LIVE TEACHING',intro:'Connect Zoom for scheduled meetings or embedded Video SDK sessions, including server-side token handling and meeting event webhooks.'},
 youtube:{title:'YouTube Education Media',eyebrow:'VIDEO LEARNING RESOURCES',intro:'Connect approved YouTube channels and videos for lesson libraries, embeds, channel metadata and permitted publishing workflows.'},
}
const steps:Record<Exclude<PageKey,'overview'|'ai-providers'>,{number:string;heading:string;detail:string}[]> = {
 biometric:[
  {number:'01',heading:'Choose a supported reader first',detail:'Select a fingerprint scanner/terminal that explicitly supports a documented SDK/API, device identity and server/event export. A phone camera or power-button fingerprint sensor is not a student scanner.'},
  {number:'02',heading:'Set up a supervised enrolment station',detail:'An authorised staff member verifies identity and records the required notice/consent. Provide an accessible non-biometric alternative.'},
  {number:'03',heading:'Keep fingerprint templates on the reader',detail:'The reader should create and match biometric templates locally. EduSphere should store only a student-to-reader reference and match result, never raw fingerprint images.'},
  {number:'04',heading:'Send signed attendance events',detail:'A trusted device gateway sends a signed event with person ID, device ID, timestamp, event type and match result to a protected Supabase Edge Function.'},
  {number:'05',heading:'Verify, reconcile and audit',detail:'Test duplicate scans, failed matches, offline queue/resync, clock drift and manual override before using the hardware for live attendance.'},
 ],
 whatsapp:[
  {number:'01',heading:'Create the Meta developer app',detail:'Create a Meta app with the WhatsApp product, link the college Business Portfolio and verify the business and sending phone number.'},
  {number:'02',heading:'Collect the WhatsApp identifiers',detail:'Record the WhatsApp Business Account ID and Phone Number ID. Use a production system-user access token with only the required WhatsApp Business permissions.'},
  {number:'03',heading:'Configure the secure webhook',detail:'Register an HTTPS callback and verification token. Subscribe to message and message-status events, verify webhook signatures, and prevent duplicate event processing.'},
  {number:'04',heading:'Approve templates and messaging rules',detail:'Create and approve fee reminders, attendance alerts, notices and other approved templates. Enforce user consent, opt-outs, template categories and the WhatsApp customer-service window.'},
  {number:'05',heading:'Connect delivery back to EduSphere',detail:'The server-side sender and webhook handler must write message IDs, delivery/read/failure status and timestamps into the communication history before WhatsApp can be marked connected.'},
 ],
 canva:[
  {number:'01',heading:'Create a Canva Connect app',detail:'Create a public or private app in Canva Developer Portal and configure its redirect URL, scopes and application details.'},
  {number:'02',heading:'Choose the OAuth flow',detail:'Use OAuth 2.0 Authorization Code with PKCE for a user-authorised app. Keep client credentials and token exchanges on the server; never expose the client secret in the browser.'},
  {number:'03',heading:'Select the design workflow',detail:'Start with brand templates, design metadata, autofill and export scopes needed for certificates, ID cards, notices and institutional reports.'},
  {number:'04',heading:'Map the college brand',detail:'Set the official college name, emblem, purple/charcoal palette, typography and approved document sizes as the design defaults.'},
  {number:'05',heading:'Show the results in EduSphere',detail:'After OAuth and permission checks work, embed the authorised design picker and return saved/exported designs to the relevant certificate, ID-card or document page.'},
 ],
 'google-classroom':[
  {number:'01',heading:'Create the Google Cloud project',detail:'Create a project for EduSphere, enable the Google Classroom API and configure the OAuth consent screen for the college account.'},
  {number:'02',heading:'Create a web OAuth client',detail:'Register the production portal origin and the server callback URL. Select only the Classroom, Drive or Calendar scopes needed for the feature being connected.'},
  {number:'03',heading:'Authorise the college account',detail:'A college Google Workspace administrator approves the connection and the required scopes. Eligibility for some Classroom API features depends on the Workspace for Education licence.'},
  {number:'04',heading:'Map academic records',detail:'Match EduSphere sessions, classes, subjects and enrolled learners to Google Classroom courses and rosters. Keep one-way or two-way sync rules explicit.'},
  {number:'05',heading:'Test synchronisation and access',detail:'Test course creation, roster changes, assignments, course materials and grades with a pilot class before enabling institution-wide sync.'},
 ],
 zoom:[
  {number:'01',heading:'Choose the correct Zoom product',detail:'Use OAuth and REST APIs to schedule and manage meetings, or use the Video SDK to embed a separate video experience inside EduSphere. The Video SDK does not join ordinary Zoom Meetings.'},
  {number:'02',heading:'Create the Zoom developer app',detail:'Create the appropriate OAuth or Video SDK app and configure the production redirect URL, allowed domains and least-privilege scopes.'},
  {number:'03',heading:'Keep credentials on the server',detail:'Store the client secret or SDK secret in Supabase Edge Function secrets. Generate short-lived tokens on the server; never put raw app secrets in the browser.'},
  {number:'04',heading:'Configure event subscriptions',detail:'Set up HTTPS webhooks for meeting lifecycle and recording events, verify the event signature/token and store the event history.'},
  {number:'05',heading:'Connect classes and timetables',detail:'Map Zoom meetings to EduSphere class sessions, show join links in the timetable and test host, teacher and student permissions before launch.'},
 ],
 youtube:[
  {number:'01',heading:'Enable the YouTube Data API',detail:'Create or select the Google Cloud project and enable YouTube Data API v3. Review quota limits and request only the endpoints the college needs.'},
  {number:'02',heading:'Configure Google OAuth',detail:'Use OAuth 2.0 when accessing a channel, private user data, or publishing/updating videos. API keys are only appropriate for restricted public-data requests.'},
  {number:'03',heading:'Choose the college channel',detail:'Authorise the official college channel and confirm whether the workflow is read-only, embeds existing videos or uploads approved content.'},
  {number:'04',heading:'Curate the learning library',detail:'Store video IDs, titles, thumbnails, subject, class, teacher and publication status in EduSphere. Apply privacy and age-appropriate review before publishing.'},
  {number:'05',heading:'Display videos in learning pages',detail:'Show approved video resources inside Learning Materials and Online Learning, with access controls and a link back to the official channel.'},
 ],
}
const requiredSecrets:Record<Exclude<PageKey,'overview'|'ai-providers'>,string[]> = {
 biometric:['No fingerprint image or template secret belongs in the browser. Device SDK credentials and the event signing key must remain server-side.'],
 whatsapp:['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_BUSINESS_ACCOUNT_ID','WHATSAPP_WEBHOOK_VERIFY_TOKEN','META_APP_SECRET'],
 canva:['CANVA_CLIENT_ID','CANVA_CLIENT_SECRET','CANVA_REDIRECT_URI','Server-side OAuth token and refresh-token storage'],
 'google-classroom':['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI','Server-side OAuth refresh-token storage'],
 zoom:['ZOOM_CLIENT_ID','ZOOM_CLIENT_SECRET','ZOOM_REDIRECT_URI','ZOOM_WEBHOOK_SECRET_TOKEN','Video SDK key/secret only if using embedded Video SDK'],
 youtube:['YOUTUBE_API_KEY for public metadata only','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI for authorised channel access'],
}
const PageIcon:Record<PageKey,LucideIcon>={overview:Cloud,'ai-providers':Activity,biometric:Fingerprint,whatsapp:MessageCircle,canva:Palette,'google-classroom':GraduationCap,zoom:Video,youtube:Youtube}
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
   <div><span>{(user?.institutionName||'Government Islamia Degree College, Badin').toUpperCase()} / {meta.eyebrow}</span><h1>{meta.title}</h1></div>
   {(page==='ai-providers'||page==='overview')&&<button type="button" className="button button-primary" onClick={()=>void refreshAI()} disabled={checking}><RefreshCw size={15}/>{checking?'Refreshing…':'Refresh'}</button>}
  </header>
  {page==='overview'&&<section className="ed360-integration-grid">
   {(['ai-providers','biometric','whatsapp','canva','google-classroom','zoom','youtube'] as PageKey[]).map(key=>{const CardIcon=PageIcon[key];return <article className="ed360-integration-card" key={key}>
    <div className="ed360-integration-card-icon"><CardIcon size={20}/></div><div><span>{pages[key].eyebrow}</span><h2>{pages[key].title}</h2><p>{pages[key].intro}</p></div>
    <div className="ed360-integration-card-foot">{key==='ai-providers'?<b className={configuredCount?'is-ready':'is-pending'}>{checking?'Checking…':configuredCount+' of '+providers.length+' credentials present'}</b>:key==='biometric'?<b className="is-pending">Hardware setup required</b>:<b className="is-pending">Not connected · setup required</b>}<button type="button" className="button button-outline" onClick={()=>onNavigate('integration:'+key)}>Open workspace <ArrowUpRight size={14}/></button></div>
   </article>})}
  </section>}
  {page==='ai-providers'&&<>
   <div className="ed360-integration-summary"><div><span>VERIFIED CREDENTIALS</span><strong>{checking?'—':configuredCount} / {providers.length}</strong><small>Presence check only; not a successful API test</small></div><div><span>LAST CHECKED</span><strong>{lastChecked||'Not checked'}</strong><small>Credentials never leave the server</small></div></div>
   {error&&<div className="ed360-integration-alert"><AlertCircle size={16}/>{error}</div>}
   <div className="ed360-integration-provider-list">{providers.map(p=><article className="ed360-integration-provider" key={p.key}>
    <div className="ed360-integration-provider-title"><div><h2>{p.name}</h2><p>{p.purpose}</p></div><span className={providerStatus[p.key]?.configured?'is-ready':'is-pending'}>{checking?'Checking…':providerStatus[p.key]?.configured?'Credential present':'Not configured'}</span></div>
    <div className="ed360-integration-provider-meta"><span>Model: <b>{p.model}</b></span><span>Secret: <code>{p.secret}</code></span></div>
    <div className="ed360-integration-provider-actions"><button type="button" className="button button-outline" disabled={checking||testing===p.key||!providerStatus[p.key]?.configured} onClick={()=>void testProvider(p)}>{testing===p.key?'Testing…':'Test live connection'}</button>{testResults[p.key]&&<small className={testResults[p.key].startsWith('Passed')?'is-ready':'is-pending'}>{testResults[p.key]}</small>}</div>
   </article>)}</div>
   <aside className="ed360-integration-note"><ShieldCheck size={18}/><p>Add the Cloudflare account ID and API token only in <b>Supabase Dashboard → Edge Functions → Secrets</b>. Keep the Cloudflare account on its Free plan: its daily free AI allowance is capped, and EduSphere automatic mode will not switch to paid providers. Other providers are optional and may charge. Never paste keys into a website field, source file, GitHub commit or chat. A credential marked present must still pass the live test above before it is treated as working.</p></aside>
  </>}
  {page!=='overview'&&page!=='ai-providers'&&<>
   <div className="ed360-integration-status-card"><div><span>CONNECTION STATUS</span><strong>Not connected</strong><small>{page==='biometric'?'No attendance terminal has passed the connection and identity-match test.':page==='whatsapp'?'The institution currently sends in-app messages only; no WhatsApp messages are being sent.':page==='canva'?'No Canva OAuth authorisation or design export has been verified.':page==='google-classroom'?'No Google account has authorised this institution or synced a Classroom course yet.':page==='zoom'?'No Zoom OAuth account or embedded Video SDK session has passed a live test.':'No college YouTube channel has been authorised or synchronised.'}</small></div><span className="ed360-integration-pill">Setup required</span></div>
   <section className="ed360-integration-steps"><div className="ed360-integration-section-heading"><span>IMPLEMENTATION WORKFLOW</span><h2>Configure {meta.title}</h2></div>{steps[page].map(step=><article className="ed360-integration-step" key={step.number}><b>{step.number}</b><div><h3>{step.heading}</h3><p>{step.detail}</p></div></article>)}</section>
   <section className="ed360-integration-secrets"><div className="ed360-integration-section-heading"><span>SERVER CONFIGURATION</span><h2>Required credentials / device prerequisites</h2></div>{requiredSecrets[page].map(secret=><div className="ed360-integration-secret" key={secret}><KeyRound size={15}/><code>{secret}</code></div>)}</section>
   <aside className="ed360-integration-note"><CircleHelp size={18}/><p>Connection remains disabled until the server-side OAuth or webhook workflow, institution permissions, encrypted token storage, delivery/event history and live end-to-end test are complete. A visible setup page does not mean the external service is connected.</p></aside>
  </>}
 </main>
}
