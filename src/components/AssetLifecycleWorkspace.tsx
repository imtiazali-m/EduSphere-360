import { useEffect, useState, type FormEvent } from 'react'
import { PackageCheck, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/data-management.css'
type Row=Record<string,any>&{id:string}
const titles:Record<string,string>={'asset-assignment':'Asset Assignment','asset-transfers':'Asset Transfers','asset-warranty':'Asset Warranty','asset-disposal':'Asset Disposal','asset-reports':'Asset Lifecycle Reports'}
const descriptions:Record<string,string>={'asset-assignment':'Assign an asset to a named person or department.','asset-transfers':'Transfer an asset to a new location while retaining a traceable event.','asset-warranty':'Record warranty provider and coverage dates.','asset-disposal':'Record approved disposal and recovered value.','asset-reports':'Review assignments, warranty coverage and lifecycle history.'}
const date=(v:unknown)=>v?new Date(String(v)).toLocaleDateString():'—'
const label=(v:unknown)=>String(v??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())
export function AssetLifecycleWorkspace({workspaceKey,onToast}:{workspaceKey:string;onToast:(message:string,error?:boolean)=>void}){
 const {user}=useAuth(),page=workspaceKey.split(':').slice(-1)[0],admin=Boolean(user&&['owner','admin'].includes(user.role))
 const [assets,setAssets]=useState<Row[]>([]),[events,setEvents]=useState<Row[]>([]),[selectedAsset,setSelectedAsset]=useState(''),[search,setSearch]=useState('')
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[form,setForm]=useState<Record<string,string>>({event_date:new Date().toISOString().slice(0,10)})
 async function load(){
  if(!supabase||!user){setLoading(false);return}
  setLoading(true)
  try{
   const [a,e]=await Promise.all([
    supabase.from('facility_assets').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false}).limit(3000),
    supabase.from('facility_asset_lifecycle_events').select('*').eq('institution_id',user.institutionId).order('event_date',{ascending:false}).limit(3000)
   ])
   if(a.error)throw a.error;if(e.error)throw e.error
   setAssets((a.data??[]) as Row[]);setEvents((e.data??[]) as Row[])
  }catch(err){onToast(err instanceof Error?err.message:'Asset lifecycle data could not be loaded.',true)}finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[user?.id,user?.institutionId])
 const available=assets.filter(a=>a.asset_lifecycle_status!=='disposed')
 const visible=available.filter(a=>!search||[a.asset_code,a.asset_name,a.category,a.current_location,a.assigned_to_name].join(' ').toLowerCase().includes(search.toLowerCase()))
 async function submit(event:FormEvent){
  event.preventDefault();if(!supabase||!user||!admin||!selectedAsset)return
  const type=page==='asset-assignment'?'assigned':page==='asset-transfers'?'transferred':page==='asset-warranty'?'warranty_updated':'disposed'
  const payload:Record<string,unknown>={...form};if(type==='disposed')payload.approved=true
  setBusy(true)
  try{
   const {error}=await supabase.rpc('record_facility_asset_lifecycle',{p_institution_id:user.institutionId,p_asset_id:selectedAsset,p_event_type:type,p_event_date:form.event_date||new Date().toISOString().slice(0,10),p_payload:payload})
   if(error)throw error
   setSelectedAsset('');setForm({event_date:new Date().toISOString().slice(0,10)})
   await load();onToast('Asset lifecycle event recorded.')
  }catch(err){onToast(err instanceof Error?err.message:'Asset lifecycle update failed.',true)}finally{setBusy(false)}
 }
 const field=(key:string,caption:string,type='text',required=true)=><label>{caption}<input required={required} type={type} value={form[key]??''} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/></label>
 const table=<div className="table-scroll"><table><thead><tr><th>Asset</th><th>Category</th><th>Assigned to</th><th>Location</th><th>Warranty</th><th>Status</th></tr></thead><tbody>{visible.map(a=><tr key={a.id}><td><b>{a.asset_code}</b><small>{a.asset_name}</small></td><td>{label(a.category)}</td><td>{a.assigned_to_name??'Unassigned'}<small>{a.assigned_to_department??''}</small></td><td>{a.current_location??a.building??'—'}</td><td>{a.warranty_provider??'Not recorded'}<small>{a.warranty_expiry?'Until '+date(a.warranty_expiry):''}</small></td><td>{label(a.asset_lifecycle_status??a.status)}</td></tr>)}</tbody></table></div>
 if(!user)return null
 return <main className="page-content ed360-module-page ed360-asset-lifecycle">
  <header className="ed360-workspace-hero"><div className="ed360-workspace-hero-icon"><PackageCheck size={21}/></div><div className="ed360-workspace-hero-copy"><span>FACILITIES / {page.replaceAll('-',' ').toUpperCase()}</span><h1>{titles[page]??'Asset Lifecycle'}</h1><p>{descriptions[page]??'Manage institution asset records.'}</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Live asset records</span><button type="button" className="button button-outline" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></div></header>
  {loading&&<div className="ed360-workspace-empty">Loading assets…</div>}
  {page==='asset-reports'?<section className="ed360-data-card"><header><h2>Asset lifecycle overview</h2><button type="button" className="button button-outline" onClick={()=>window.print()}>Print report</button></header><div className="ed360-workspace-kpis"><article><span>Assets</span><strong>{assets.length}</strong></article><article><span>Assigned</span><strong>{assets.filter(a=>Boolean(a.assigned_to_name)).length}</strong></article><article><span>Warranty expiry soon</span><strong>{assets.filter(a=>a.warranty_expiry&&new Date(a.warranty_expiry).getTime()>=Date.now()&&new Date(a.warranty_expiry).getTime()<Date.now()+30*86400000).length}</strong></article><article><span>Disposed</span><strong>{assets.filter(a=>a.asset_lifecycle_status==='disposed').length}</strong></article></div>{table}<h3>Event history</h3><div className="table-scroll"><table><thead><tr><th>Date</th><th>Asset</th><th>Event</th><th>Details</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td>{date(e.event_date)}</td><td>{assets.find(a=>a.id===e.asset_id)?.asset_name??'Asset'}</td><td>{label(e.event_type)}</td><td>{JSON.stringify(e.event_payload)}</td></tr>)}</tbody></table></div></section>:<section className="ed360-data-card"><header><h2>{titles[page]}</h2><p>{descriptions[page]}</p></header>{admin&&<form className="ed360-data-form" onSubmit={submit}><label>Asset<select required value={selectedAsset} onChange={e=>setSelectedAsset(e.target.value)}><option value="">Select asset</option>{available.map(a=><option key={a.id} value={a.id}>{a.asset_code} · {a.asset_name}</option>)}</select></label>{field('event_date','Event date','date')}
   {page==='asset-assignment'&&<>{field('assigned_to_name','Assigned to')}{field('assigned_to_department','Department','text',false)}{field('current_location','Location','text',false)}</>}
   {page==='asset-transfers'&&<>{field('to_location','Destination location')}{field('transfer_reason','Reason')}</>}
   {page==='asset-warranty'&&<>{field('warranty_provider','Warranty provider')}{field('warranty_start','Coverage start','date')}{field('warranty_expiry','Coverage expiry','date')}</>}
   {page==='asset-disposal'&&<><label>Disposal method<select required value={form.disposal_method??''} onChange={e=>setForm(v=>({...v,disposal_method:e.target.value}))}><option value="">Select method</option>{['sale','recycling','donation','write_off','other'].map(x=><option key={x} value={x}>{label(x)}</option>)}</select></label>{field('disposal_date','Disposal date','date')}{field('disposal_value','Recovered value','number',false)}<label><input type="checkbox" required/> Owner/admin disposal approval confirmed</label></>}
   <button className="button button-primary" disabled={busy||!selectedAsset}>{busy?'Saving…':'Save lifecycle event'}</button></form>}<div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search assets…" aria-label="Search assets"/></div>{table}</section>}
 </main>
}
