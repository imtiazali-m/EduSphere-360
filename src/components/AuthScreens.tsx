import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Building2, GraduationCap, LockKeyhole, Mail, MonitorSmartphone, ShieldCheck, Users, Wifi, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import type { AppRole } from '../lib/types'
import { roleLabels } from '../lib/modules'
import { cloudConfigured } from '../lib/supabase'

interface ScreenProps { navigate: (screen: 'welcome' | 'login' | 'setup', role?: AppRole) => void }

const portals: { role: AppRole; title: string; description: string; icon: typeof GraduationCap }[] = [
  { role: 'admin', title: 'Administrator', description: 'Institution-wide management and reports', icon: ShieldCheck },
  { role: 'teacher', title: 'Teacher', description: 'Classes, attendance and academic work', icon: BookOpen },
  { role: 'student', title: 'Student', description: 'Learning, exams and personal records', icon: GraduationCap },
  { role: 'parent', title: 'Parent / guardian', description: 'Attendance, progress and fee updates', icon: Users },
]

function Brand() {
  return <div className="brand-lockup"><div className="brand-mark"><GraduationCap size={23} /></div><div><strong>EduSphere <span>360</span></strong><small>EDUCATION MANAGEMENT</small></div></div>
}

export function WelcomeScreen({ navigate }: ScreenProps) {
  const { mode, setMode } = useAuth()
  const [modeError, setModeError] = useState('')
  async function switchMode(value: 'local' | 'cloud') {
    setModeError('')
    try { await setMode(value) } catch (error) { setModeError(error instanceof Error ? error.message : 'Could not change mode.') }
  }
  return <div className="welcome-shell">
    <header className="public-nav"><Brand /><div className="nav-right"><span className={`connection-pill ${mode === 'local' ? 'local' : 'cloud'}`}>{mode === 'local' ? <WifiOff size={14}/> : <Wifi size={14}/>} {mode === 'local' ? 'Offline workspace' : 'Cloud workspace'}</span><button className="button button-outline button-small" onClick={() => navigate('login')}>Login <ArrowRight size={15}/></button></div></header>
    <main>
      <section className="hero-section">
        <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"/> ONE CONNECTED EDUCATION PLATFORM</div><h1>Every part of education.<br/><span>One clear picture.</span></h1><p className="hero-lead">Manage students, faculty, parents, academics and administration from one connected workspace — built for schools, colleges and universities.</p><div className="hero-actions"><button className="button button-primary button-large" onClick={() => navigate('setup')}>Create your institution <ArrowRight size={17}/></button><button className="button button-quiet button-large" onClick={() => navigate('login')}>I already have an account</button></div><div className="hero-notes"><span><ShieldCheck size={15}/> Role-based access</span><span><MonitorSmartphone size={15}/> Mobile responsive</span><span><LockKeyhole size={15}/> Private records</span></div></div>
        <div className="hero-visual"><div className="visual-glow"/><div className="visual-window"><div className="visual-top"><div className="window-dots"><i/><i/><i/></div><span>SAMPLE DASHBOARD</span><span className="live-chip">PREVIEW</span></div><div className="visual-title"><div><small>GOOD MORNING</small><strong>Your institution at a glance</strong></div><div className="visual-avatar">ES</div></div><div className="visual-stats"><div><span>STUDENTS</span><strong>1,248</strong><small>Across all programs</small></div><div><span>FACULTY</span><strong>86</strong><small>Teaching staff</small></div><div><span>ATTENDANCE</span><strong>94.2%</strong><small>Today's snapshot</small></div></div><div className="visual-lower"><div className="visual-chart"><div className="lower-label">Attendance overview <small>THIS WEEK</small></div><div className="bars">{[42,58,51,76,64,88,72].map((v,i)=><i key={i} style={{height:`${v}%`}}/>)}</div><div className="bar-days"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div></div><div className="visual-activity"><div className="lower-label">Example activity</div><p><i className="activity-dot blue"/> New admission <small>Just now</small></p><p><i className="activity-dot green"/> Attendance saved <small>12 min</small></p><p><i className="activity-dot amber"/> Fee received <small>28 min</small></p></div></div></div><div className="floating-note"><div className="floating-icon"><Users size={18}/></div><div><strong>Connected people</strong><small>Admin · Faculty · Students · Parents</small></div></div></div>
      </section>
      <section className="portal-section"><div className="section-heading"><div><div className="eyebrow">YOUR ROLE, YOUR WORKSPACE</div><h2>Choose your portal</h2></div><p>Sign in with the account created for you by your institution administrator.</p></div><div className="portal-grid">{portals.map(({role,title,description,icon:Icon})=><button className="portal-card" key={role} onClick={()=>navigate('login',role)}><div className="portal-icon"><Icon size={22}/></div><div className="portal-card-text"><strong>{title}</strong><small>{description}</small></div><ArrowRight size={17} className="portal-arrow"/></button>)}</div></section>
    </main>
    <footer className="public-footer"><Brand/><span>© {new Date().getFullYear()} EduSphere 360. A connected education workspace.</span><div className="mode-switch"><span>Workspace mode</span><button className={mode === 'local' ? 'selected' : ''} onClick={()=>void switchMode('local')}>Offline</button><button className={mode === 'cloud' ? 'selected' : ''} onClick={()=>void switchMode('cloud')} disabled={!cloudConfigured}>Online</button></div></footer>
    {modeError && <div className="toast toast-error">{modeError}</div>}
  </div>
}

export function LoginScreen({ navigate, initialRole }: ScreenProps & { initialRole?: AppRole }) {
  const { mode, signIn } = useAuth()
  const [role,setRole] = useState<AppRole>(initialRole ?? 'admin')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await signIn(email,password,role) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in.') }
    finally { setBusy(false) }
  }
  return <div className="auth-shell"><header className="public-nav"><Brand/><button className="button button-quiet" onClick={()=>navigate('welcome')}><ArrowLeft size={16}/> Back to home</button></header><main className="auth-layout"><section className="auth-side-copy"><div className="eyebrow">WELCOME BACK</div><h1>Your institution,<br/><span>all in one place.</span></h1><p>Sign in to access your workspace. Your role determines which student, academic and administrative tools you can use.</p><div className="auth-feature-list"><span><ShieldCheck size={17}/> Protected role-based access</span><span><Users size={17}/> Connected institution records</span><span><MonitorSmartphone size={17}/> Works on desktop and mobile</span></div></section><section className="auth-card"><div className="auth-card-heading"><div className="portal-icon large"><LockKeyhole size={22}/></div><h2>Sign in to EduSphere</h2><p>Select your portal and enter your account details.</p></div><form onSubmit={submit} className="form-stack"><label className="field-label">Sign in as<select value={role} onChange={e=>setRole(e.target.value as AppRole)} className="input-control">{(['admin','teacher','student','parent','accountant','exam_officer'] as AppRole[]).map(r=><option value={r} key={r}>{roleLabels[r]}</option>)}</select></label><label className="field-label">Email address<div className="input-icon-wrap"><Mail size={17}/><input className="input-control with-icon" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@institution.edu"/></div></label><label className="field-label">Password<div className="input-icon-wrap"><LockKeyhole size={17}/><input className="input-control with-icon" type="password" autoComplete="current-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/></div></label>{error && <div className="inline-error">{error}</div>}<button className="button button-primary button-full" disabled={busy}>{busy?'Signing in…':'Sign in securely'} <ArrowRight size={17}/></button></form><div className="auth-card-foot"><span>{mode === 'local' ? <><WifiOff size={14}/> Offline local workspace</> : <><Wifi size={14}/> Online cloud workspace</>}</span><button onClick={()=>navigate('setup')}>First-time setup</button></div></section></main></div>
}

export function SetupScreen({ navigate }: ScreenProps) {
  const { mode, registerAdmin } = useAuth()
  const [institutionName,setInstitutionName] = useState('')
  const [institutionType,setInstitutionType] = useState('school')
  const [fullName,setFullName] = useState('')
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await registerAdmin({institutionName,institutionType,fullName,email,password}) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not create the institution.') }
    finally { setBusy(false) }
  }

  // Online first-owner provisioning is intentionally performed in the Supabase
  // dashboard + SQL Editor. This removes the browser-entered bootstrap secret
  // without exposing an unauthenticated public endpoint that can claim ownership.
  if (mode === 'cloud') {
    return <div className="auth-shell">
      <header className="public-nav"><Brand/><button className="button button-quiet" onClick={()=>navigate('welcome')}><ArrowLeft size={16}/> Back to home</button></header>
      <main className="setup-layout">
        <div className="setup-intro">
          <div className="eyebrow">FIRST-TIME CLOUD SETUP</div>
          <h1>Create your<br/><span>owner account.</span></h1>
          <p>For the first online administrator, create the Auth user in your own Supabase dashboard and then attach the owner role to your institution. No setup secret is needed in the website.</p>
          <div className="setup-security"><ShieldCheck size={20}/><div><strong>Owner-controlled setup</strong><small>Only someone with access to your Supabase project can create the first owner. Teacher, student and parent accounts are created later by an authorized administrator.</small></div></div>
        </div>
        <section className="auth-card setup-card">
          <div className="auth-card-heading"><div className="portal-icon large"><Building2 size={22}/></div><h2>Online owner setup</h2><p>Complete these steps in your Supabase project.</p></div>
          <div className="form-stack">
            <div className="setup-security"><span className="portal-icon">1</span><div><strong>Create the owner login</strong><small>Supabase Dashboard → Authentication → Users → Add user. Enter your email and a strong password, and confirm the email.</small></div></div>
            <div className="setup-security"><span className="portal-icon">2</span><div><strong>Attach the owner role</strong><small>Open the included MANUAL_FIRST_ADMIN_SETUP.sql file, replace its four placeholders with your user ID, name, email and institution name, then run it in Supabase SQL Editor.</small></div></div>
            <div className="setup-security"><span className="portal-icon">3</span><div><strong>Sign in here</strong><small>Return to this website and sign in using the email and password you created in Supabase.</small></div></div>
            <button className="button button-primary button-full" onClick={()=>navigate('login','admin')}>Go to administrator login <ArrowRight size={17}/></button>
          </div>
          <div className="auth-card-foot"><span>Public cloud owner registration is disabled.</span><button onClick={()=>navigate('welcome')}>Back to welcome</button></div>
        </section>
      </main>
    </div>
  }

  return <div className="auth-shell"><header className="public-nav"><Brand/><button className="button button-quiet" onClick={()=>navigate('welcome')}><ArrowLeft size={16}/> Back to home</button></header><main className="setup-layout"><div className="setup-intro"><div className="eyebrow">OFFLINE INSTITUTION SETUP</div><h1>Start with your<br/><span>institution.</span></h1><p>Create the first owner account for this browser's offline workspace. Online owner accounts are provisioned through Supabase.</p><div className="setup-security"><ShieldCheck size={20}/><div><strong>Local-only account</strong><small>This account stays in this browser and is not synchronized to Supabase.</small></div></div></div><section className="auth-card setup-card"><div className="auth-card-heading"><div className="portal-icon large"><Building2 size={22}/></div><h2>Create your institution</h2><p>Register the institution and its first offline administrator.</p></div><form onSubmit={submit} className="form-stack"><label className="field-label">Institution name<input className="input-control" required value={institutionName} onChange={e=>setInstitutionName(e.target.value)} placeholder="e.g. Bright Future Academy"/></label><label className="field-label">Institution type<select className="input-control" value={institutionType} onChange={e=>setInstitutionType(e.target.value)}><option value="school">School</option><option value="college">College</option><option value="university">University</option><option value="multi_institution">School / college / university group</option></select></label><div className="form-two"><label className="field-label">Owner full name<input className="input-control" required value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your name"/></label><label className="field-label">Owner email<input className="input-control" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com"/></label></div><label className="field-label">Create password<input className="input-control" type="password" required minLength={10} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 10 characters"/></label>{error && <div className="inline-error">{error}</div>}<button className="button button-primary button-full" disabled={busy}>{busy?'Creating institution…':'Create institution & owner account'} <ArrowRight size={17}/></button></form><div className="auth-card-foot"><span>Account is saved only in this browser.</span><button onClick={()=>navigate('login')}>Already registered?</button></div></section></main></div>
}
