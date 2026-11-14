import { lazy, Suspense, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import type { AppRole } from './lib/types'
const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })))
const LoginScreen = lazy(() => import('./components/AuthScreens').then(module => ({ default: module.LoginScreen })))
const ResetPasswordScreen = lazy(() => import('./components/AuthScreens').then(module => ({ default: module.ResetPasswordScreen })))
const WelcomeScreen = lazy(() => import('./components/AuthScreens').then(module => ({ default: module.WelcomeScreen })))
const CollegeHomePage = lazy(() => import('./components/CollegeHomePage').then(module => ({ default: module.CollegeHomePage })))

type RouteState = {screen:'welcome'|'login'|'public';role?:AppRole;publicPage?:string}

function readRoute(): RouteState {
  const hash=window.location.hash
  if(!hash || hash==='#/' || hash==='#')return{screen:'public',publicPage:'home'}
  if(hash==='#/welcome')return{screen:'welcome'}
  if(hash.startsWith('#/setup'))return{screen:'login',role:'owner'}
  if(hash.startsWith('#/login')){const role=hash.split('/')[2] as AppRole|undefined;return{screen:'login',role}}
  if(hash.startsWith('#/public/'))return{screen:'public',publicPage:hash.slice('#/public/'.length).split('?')[0]}
  return{screen:'welcome'}
}

export default function App(){
  const {user,loading,recoveryMode}=useAuth();const [route,setRoute]=useState(readRoute);const [toast,setToast]=useState<{message:string,error:boolean}|null>(null);const [online,setOnline]=useState(() => typeof navigator === 'undefined' || navigator.onLine)
  useEffect(()=>{const handler=()=>setRoute(readRoute());window.addEventListener('hashchange',handler);return()=>window.removeEventListener('hashchange',handler)},[])
  useEffect(()=>{const on=()=>setOnline(true);const off=()=>setOnline(false);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)}},[])
  useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(null),4500);return()=>window.clearTimeout(id)},[toast])
  function navigate(screen:'welcome'|'login'|'setup',role?:AppRole){const hash=screen==='welcome'?'#/welcome':screen==='setup'?'#/setup':`#/login${role?`/${role}`:''}`;window.location.hash=hash;setRoute(readRoute())}
  if(!online)return <main className="connection-required-screen" role="alert"><div className="connection-required-card"><div className="connection-required-mark">GIDC</div><h1>Internet connection required</h1><p>The Government Islamia Degree College Badin portal requires an internet connection. Reconnect to the internet to access your institution workspace and cloud records.</p><button type="button" onClick={()=>setOnline(navigator.onLine)}>Retry connection</button></div></main>
  if(loading)return <div className="loading-screen"><div className="loading-brand">Government Islamia Degree College Badin</div><div className="loading-spinner"/><p>Preparing your workspace…</p></div>
  return <><Suspense fallback={<div className="loading-screen" aria-live="polite"><div className="loading-brand">Government Islamia Degree College Badin</div><div className="loading-spinner"/><p>Preparing your page…</p></div>}>{recoveryMode?<ResetPasswordScreen navigate={navigate}/>:route.screen==='public'?<CollegeHomePage navigate={navigate} initialSection={route.publicPage||'home'}/>:user?<Dashboard onToast={(message,error=false)=>setToast({message,error})}/>:route.screen==='login'?<LoginScreen navigate={navigate} initialRole={route.role}/>:<WelcomeScreen navigate={navigate}/>}</Suspense> {toast&&<div className={`toast ${toast.error?'toast-error':'toast-success'}`}>{toast.error?<AlertTriangle size={17}/>:<CheckCircle2 size={17}/>}<span>{toast.message}</span><button onClick={()=>setToast(null)}><X size={15}/></button></div>}</>
}
