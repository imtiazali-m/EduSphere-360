import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/data-management.css'

type Row=Record<string,any>&{id:string}
type Candidate={entity:'student'|'teacher';a:Row;b:Row;matchedOn:string;pairKey:string}
const fields:Record<'student'|'teacher',string[]>={student:['admission_no','email','phone','national_id'],teacher:['employee_no','email','phone','national_id']}
const normalize=(value:unknown,key:string)=>{
 const raw=String(value??'').trim()
 if(!raw)return ''
 return key.includes('email')?raw.toLowerCase():key.includes('phone')||key.includes('mobile')?raw.replace(/\D/g,''):raw.toLowerCase().replace(/\s+/g,' ')
}
const display=(row:Row,entity:'student'|'teacher')=>String(row.full_name??row.name??(entity==='student'?row.admission_no:row.employee_no)??'Unnamed record')
export function DuplicateDetectionWorkspace({workspaceKey,onToast}:{workspaceKey:string;onToast:(message:string,error?:boolean)=>void}){
 const {user}=useAuth()
 const [students,setStudents]=useState<Row[]>([])
 const [teachers,setTeachers]=useState<Row[]>([])
 const [decisions,setDecisions]=useState<Row[]>([])
 const [loading,setLoading]=useState(true)
 const [busyKey,setBusyKey]=useState('')
 const [search,setSearch]=useState('')
 const [entity,setEntity]=useState('all')
 const [note,setNote]=useState<Record<string,string>>({})
 async function load(){
  if(!supabase||!user){setLoading(false);return}
  if(!['owner','admin'].includes(user.role)){setLoading(false);return}
  setLoading(true)
  try{
   const [s,t,d]=await Promise.all([
    supabase.from('students').select('*').eq('institution_id',user.institutionId).limit(5000),
    supabase.from('teachers').select('*').eq('institution_id',user.institutionId).limit(5000),
    supabase.from('institution_duplicate_review_decisions').select('*').eq('institution_id',user.institutionId).order('reviewed_at',{ascending:false}).limit(5000)
   ])
   if(s.error)throw s.error;if(t.error)throw t.error;if(d.error)throw d.error
   setStudents((s.data??[]) as Row[]);setTeachers((t.data??[]) as Row[]);setDecisions((d.data??[]) as Row[])
  }catch(e){onToast(e instanceof Error?e.message:'Duplicate scan could not read institution records.',true)}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[user?.id,user?.institutionId,user?.role])
 const candidates=useMemo(()=>{
  const output:Candidate[]=[]
  const scan=(records:Row[],kind:'student'|'teacher')=>{
   const seen=new Set<string>()
   for(const key of fields[kind]){
    const groups=new Map<string,Row[]>()
    for(const row of records){
     const value=normalize(row[key],key)
     if(value.length<(key.includes('phone')?7:key.includes('email')?5:3))continue
     const list=groups.get(value)??[];list.push(row);groups.set(value,list)
    }
    for(const [value,list] of groups){
     if(list.length<2)continue
     const ordered=list.slice(0,50)
     for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){
      const a=ordered[i],b=ordered[j]
      const left=a.id<b.id?a:b,right=a.id<b.id?b:a
      const pairKey=[kind,left.id,right.id,key].join(':')
      if(seen.has(pairKey))continue
      seen.add(pairKey)
      output.push({entity:kind,a:left,b:right,matchedOn:key,pairKey})
     }
    }
   }
  }
  scan(students,'student');scan(teachers,'teacher')
  return output
 },[students,teachers])
 const decisionFor=(c:Candidate)=>decisions.find(d=>d.entity_type===c.entity&&d.record_a_id===c.a.id&&d.record_b_id===c.b.id&&d.matched_on===c.matchedOn)
 const visible=candidates.filter(c=>(entity==='all'||entity===c.entity)&&(!search||[display(c.a,c.entity),display(c.b,c.entity),c.matchedOn,c.a.admission_no,c.b.admission_no,c.a.employee_no,c.b.employee_no].join(' ').toLowerCase().includes(search.toLowerCase())))
 async function decide(candidate:Candidate,decision:'confirmed_duplicate'|'false_positive'){
  if(!supabase||!user)return
  setBusyKey(candidate.pairKey)
  try{
   const {error}=await supabase.rpc('review_possible_duplicate',{
    p_institution_id:user.institutionId,p_entity_type:candidate.entity,
    p_record_a_id:candidate.a.id,p_record_b_id:candidate.b.id,p_matched_on:candidate.matchedOn,
    p_decision:decision,p_review_note:note[candidate.pairKey]||null
   })
   if(error)throw error
   await load();onToast(decision==='confirmed_duplicate'?'Possible duplicate confirmed and recorded.':'Match dismissed as a false positive.')
  }catch(e){onToast(e instanceof Error?e.message:'Duplicate decision could not be saved.',true)}
  finally{setBusyKey('')}
 }
 if(!user)return null
 if(!['owner','admin'].includes(user.role))return <main className="page-content ed360-module-page"><section className="ed360-workspace-empty">Duplicate detection is restricted to institution owners and administrators.</section></main>
 return <main className="page-content ed360-module-page ed360-duplicate-workspace">
  <header className="ed360-workspace-hero"><div className="ed360-workspace-hero-icon"><Search size={21}/></div><div className="ed360-workspace-hero-copy"><span>DATA MANAGEMENT / QUALITY</span><h1>Duplicate Detection</h1><p>Find likely duplicate student and staff records using admission IDs, employee IDs, email addresses and phone numbers. Review each match without automatically merging or deleting records.</p></div><div className="ed360-workspace-hero-tools"><span className="ed360-data-state"><i/> Owner/admin review</span><button className="button button-outline" onClick={()=>void load()}><RefreshCw size={15}/> Scan again</button></div></header>
  <div className="ed360-payment-provider-note"><AlertTriangle size={18}/><span><b>Review before changing records</b> Shared family phone numbers or email addresses can be legitimate. Matches are suggestions only; no student or staff data is changed by this scan.</span></div>
  <section className="ed360-data-card"><div className="ed360-workspace-kpis"><article><span>Possible matches</span><strong>{candidates.length}</strong><small>Based on normalized identifiers</small></article><article><span>Confirmed duplicates</span><strong>{decisions.filter(d=>d.decision==='confirmed_duplicate').length}</strong><small>Reviewed decisions</small></article><article><span>False positives</span><strong>{decisions.filter(d=>d.decision==='false_positive').length}</strong><small>Dismissed matches</small></article><article><span>Not reviewed</span><strong>{candidates.filter(c=>!decisionFor(c)).length}</strong><small>Awaiting admin decision</small></article></div>
   <div className="ed360-data-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search names or matching field…" aria-label="Search duplicate candidates"/><select value={entity} onChange={e=>setEntity(e.target.value)}><option value="all">Students and staff</option><option value="student">Students</option><option value="teacher">Teachers / staff</option></select></div>
   <div className="table-scroll"><table><thead><tr><th>Record type</th><th>First record</th><th>Second record</th><th>Matching field</th><th>Decision</th><th>Review note</th><th>Actions</th></tr></thead><tbody>{visible.slice(0,2000).map(c=>{const d=decisionFor(c);return <tr key={c.pairKey}><td>{c.entity==='student'?'Student':'Staff'}</td><td><b>{display(c.a,c.entity)}</b><small>{c.a.admission_no??c.a.employee_no??c.a.id}</small></td><td><b>{display(c.b,c.entity)}</b><small>{c.b.admission_no??c.b.employee_no??c.b.id}</small></td><td>{c.matchedOn.replaceAll('_',' ')}</td><td>{d?d.decision==='confirmed_duplicate'?'Confirmed duplicate':'False positive':'Needs review'}</td><td><input aria-label="Review note" value={note[c.pairKey]??d?.review_note??''} onChange={e=>setNote(v=>({...v,[c.pairKey]:e.target.value}))}/></td><td><div className="ed360-duplicate-actions"><button className="button button-primary" type="button" disabled={!!busyKey||!!d} onClick={()=>void decide(c,'confirmed_duplicate')}><ShieldCheck size={14}/> Confirm</button><button className="button button-outline" type="button" disabled={!!busyKey||!!d} onClick={()=>void decide(c,'false_positive')}><CheckCircle2 size={14}/> Not duplicate</button></div></td></tr>})}</tbody></table></div>
   {visible.length===0&&!loading&&<div className="ed360-workspace-empty">No possible duplicate matches found for this filter.</div>}
   {visible.length>2000&&<small>Showing the first 2,000 potential matches. Refine the search for more.</small>}
  </section>
 </main>
}
