import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import type { AppRole } from './lib/types'
import { Dashboard } from './components/Dashboard'
import { LoginScreen, SetupScreen, WelcomeScreen } from './components/AuthScreens'

function readRoute(): {screen:'welcome'|'login'|'setup';role?:AppRole} {
  const hash=window.location.hash
  if(hash.startsWith('#/setup'))return{screen:'setup'}
  if(hash.startsWith('#/login')){const role=hash.split('/')[2] as AppRole|undefined;return{screen:'login',role}}
  return{screen:'welcome'}
}

export default function App(){
  const {user,loading,mode}=useAuth();const [route,setRoute]=useState(readRoute);const [toast,setToast]=useState<{message:string,error:boolean}|null>(null)
  useEffect(()=>{const handler=()=>setRoute(readRoute());window.addEventListener('hashchange',handler);return()=>window.removeEventListener('hashchange',handler)},[])
  useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(null),4500);return()=>window.clearTimeout(id)},[toast])
  function navigate(screen:'welcome'|'login'|'setup',role?:AppRole){const hash=screen==='welcome'?'#/':screen==='setup'?'#/setup':`#/login${role?`/${role}`:''}`;window.location.hash=hash;setRoute(readRoute())}
  if(loading)return <div className="loading-screen"><div className="loading-brand">EduSphere <span>360</span></div><div className="loading-spinner"/><p>Preparing your workspace…</p></div>
  return <>{user?<Dashboard onToast={(message,error=false)=>setToast({message,error})}/>:route.screen==='login'?<LoginScreen navigate={navigate} initialRole={route.role}/>:route.screen==='setup'?<SetupScreen navigate={navigate}/>:<WelcomeScreen navigate={navigate}/>} {toast&&<div className={`toast ${toast.error?'toast-error':'toast-success'}`}>{toast.error?<AlertTriangle size={17}/>:<CheckCircle2 size={17}/>}<span>{toast.message}</span><button onClick={()=>setToast(null)}><X size={15}/></button></div>}<div className="build-corner">{mode==='local'?'LOCAL DATA':'CLOUD DATA'} · EDUSPHERE 360</div></>
}
