import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import type { AppRole } from './lib/types'
import { Dashboard } from './components/Dashboard'
import { LoginScreen, ResetPasswordScreen, SetupScreen, WelcomeScreen } from './components/AuthScreens'

type RouteState = {screen:'welcome'|'login'|'setup'|'public';role?:AppRole;publicPage?:string}

function readRoute(): RouteState {
  const hash=window.location.hash
  if(hash.startsWith('#/setup'))return{screen:'setup'}
  if(hash.startsWith('#/login')){const role=hash.split('/')[2] as AppRole|undefined;return{screen:'login',role}}
  if(hash.startsWith('#/public/'))return{screen:'public',publicPage:hash.slice('#/public/'.length).split('?')[0]}
  return{screen:'welcome'}
}

export default function App(){
  const {user,loading,recoveryMode}=useAuth();const [route,setRoute]=useState(readRoute);const [toast,setToast]=useState<{message:string,error:boolean}|null>(null);const [online,setOnline]=useState(() => typeof navigator === 'undefined' || navigator.onLine)
  useEffect(()=>{const handler=()=>setRoute(readRoute());window.addEventListener('hashchange',handler);return()=>window.removeEventListener('hashchange',handler)},[])
  useEffect(()=>{const on=()=>setOnline(true);const off=()=>setOnline(false);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)}},[])
  useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(null),4500);return()=>window.clearTimeout(id)},[toast])
  function navigate(screen:'welcome'|'login'|'setup',role?:AppRole){const hash=screen==='welcome'?'#/':screen==='setup'?'#/setup':`#/login${role?`/${role}`:''}`;window.location.hash=hash;setRoute(readRoute())}
  if(!online)return <main className="connection-required-screen" role="alert"><div className="connection-required-card"><div className="connection-required-mark">GI</div><h1>Internet connection required</h1><p>The college portal is currently online-only. Reconnect to the internet to access college services and cloud records.</p><button type="button" onClick={()=>setOnline(navigator.onLine)}>Retry connection</button></div></main>
  if(loading)return <div className="loading-screen"><div className="loading-brand">Government Islamia <span>Degree College · Badin</span></div><div className="loading-spinner"/><p>Opening the college portal…</p></div>
  return <>{recoveryMode?<ResetPasswordScreen navigate={navigate}/>:user?<Dashboard onToast={(message,error=false)=>setToast({message,error})}/>:route.screen==='login'?<LoginScreen navigate={navigate} initialRole={route.role}/>:route.screen==='setup'?<SetupScreen navigate={navigate}/>:route.screen==='public'?<WelcomeScreen navigate={navigate}/>:<WelcomeScreen navigate={navigate}/>} {toast&&<div className={`toast ${toast.error?'toast-error':'toast-success'}`}>{toast.error?<AlertTriangle size={17}/>:<CheckCircle2 size={17}/>}<span>{toast.message}</span><button onClick={()=>setToast(null)}><X size={15}/></button></div>}</>
}
