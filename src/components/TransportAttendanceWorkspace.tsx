import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Bus, Download, RefreshCw, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type Row = Record<string, any> & { id: string }
type EventType = 'boarded' | 'alighted' | 'absent'
const today = () => new Date().toLocaleDateString('en-CA')
const localDateTime = () => {
  const date = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const escapeCsv = (value: unknown) => {
  const raw = value === null || value === undefined ? '' : String(value)
  return '"' + raw.replaceAll('"', '""') + '"'
}
const eventLabel: Record<EventType,string> = { boarded:'Boarded', alighted:'Alighted', absent:'Absent' }

export function TransportAttendanceWorkspace({ onToast }: {
  workspaceKey: string
  onToast: (message: string, error?: boolean) => void
}) {
  const { user } = useAuth()
  const allowed = Boolean(user && ['owner','admin','teacher'].includes(user.role))
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const [allocations,setAllocations] = useState<Row[]>([])
  const [students,setStudents] = useState<Row[]>([])
  const [routes,setRoutes] = useState<Row[]>([])
  const [events,setEvents] = useState<Row[]>([])
  const [allocationId,setAllocationId] = useState('')
  const [eventType,setEventType] = useState<EventType>('boarded')
  const [occurredAt,setOccurredAt] = useState(localDateTime)
  const [notes,setNotes] = useState('')
  const [search,setSearch] = useState('')
  const [dateFilter,setDateFilter] = useState(today)

  const load = useCallback(async () => {
    if (!supabase || !user || !allowed) { setLoading(false); return }
    setLoading(true); setError('')
    try {
      const [allocationResult,studentResult,routeResult,eventResult] = await Promise.all([
        supabase.from('student_transport_allocations').select('*')
          .eq('institution_id',user.institutionId).eq('status','active')
          .order('effective_from',{ascending:false}).limit(2000),
        supabase.from('students').select('id,full_name,admission_no,class_name,section_name')
          .eq('institution_id',user.institutionId).eq('status','active').order('full_name').limit(2000),
        supabase.from('institutional_records').select('id,title,reference_code,payload')
          .eq('institution_id',user.institutionId).eq('module_key','transport')
          .eq('record_type','transport-routes').order('title').limit(1000),
        supabase.from('transport_attendance_events').select('*')
          .eq('institution_id',user.institutionId).order('occurred_at',{ascending:false}).limit(2000),
      ])
      for (const result of [allocationResult,studentResult,routeResult,eventResult]) {
        if (result.error) throw result.error
      }
      setAllocations((allocationResult.data??[]) as Row[])
      setStudents((studentResult.data??[]) as Row[])
      setRoutes((routeResult.data??[]) as Row[])
      setEvents((eventResult.data??[]) as Row[])
      if (!allocationId && allocationResult.data?.[0]?.id) setAllocationId(String(allocationResult.data[0].id))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Transport attendance could not be loaded.'
      setError(message); onToast(message,true)
    } finally { setLoading(false) }
  },[user?.id,user?.institutionId,allowed])

  useEffect(()=>{void load()},[load])

  const studentMap = useMemo(()=>new Map(students.map(row=>[row.id,row])),[students])
  const routeMap = useMemo(()=>new Map(routes.map(row=>[row.id,row])),[routes])
  const allocationMap = useMemo(()=>new Map(allocations.map(row=>[row.id,row])),[allocations])
  const activeAllocations = useMemo(()=>allocations.filter(row=>{
    const end = row.effective_to ? String(row.effective_to).slice(0,10) : ''
    const start = String(row.effective_from??'').slice(0,10)
    return (!start || start <= today()) && (!end || end >= today())
  }),[allocations])
  const visibleEvents = useMemo(()=>events.filter(event=>{
    const allocation=allocationMap.get(String(event.allocation_id))
    const student=allocation ? studentMap.get(String(allocation.student_id)) : undefined
    const route=allocation ? routeMap.get(String(allocation.route_record_id)) : undefined
    const eventDate=String(event.occurred_at??'').slice(0,10)
    const query=[student?.full_name,student?.admission_no,student?.class_name,route?.title,event.event_type,event.source,event.notes].join(' ').toLowerCase()
    return (!dateFilter || eventDate===dateFilter) && (!search || query.includes(search.toLowerCase()))
  }),[events,allocationMap,studentMap,routeMap,dateFilter,search])
  const todayEvents=events.filter(event=>String(event.occurred_at??'').slice(0,10)===today())
  const summary={
    boarded:todayEvents.filter(x=>x.event_type==='boarded').length,
    alighted:todayEvents.filter(x=>x.event_type==='alighted').length,
    absent:todayEvents.filter(x=>x.event_type==='absent').length,
  }

  async function save(event:FormEvent) {
    event.preventDefault()
    if(!supabase||!user||!allowed)return
    if(!allocationMap.has(allocationId)){onToast('Select an active student transport allocation.',true);return}
    const timestamp=new Date(occurredAt)
    if(Number.isNaN(timestamp.getTime())){onToast('Enter a valid event date and time.',true);return}
    if(timestamp.getTime()>Date.now()+5*60*1000){onToast('A transport event cannot be recorded more than five minutes in the future.',true);return}
    setSaving(true)
    try{
      const {error:insertError}=await supabase.from('transport_attendance_events').insert({
        institution_id:user.institutionId,
        allocation_id:allocationId,
        event_type:eventType,
        occurred_at:timestamp.toISOString(),
        recorded_by:user.id,
        source:'manual',
        notes:notes.trim()||null,
      })
      if(insertError)throw insertError
      onToast('Transport attendance event recorded.')
      setNotes('');setOccurredAt(localDateTime());await load()
    }catch(cause){onToast(cause instanceof Error?cause.message:'Transport attendance could not be saved.',true)}
    finally{setSaving(false)}
  }

  function exportEvents(){
    const columns=['Occurred at','Student','Admission number','Class','Route','Event','Source','Notes']
    const rows=visibleEvents.map(row=>{
      const allocation=allocationMap.get(String(row.allocation_id))
      const student=allocation?studentMap.get(String(allocation.student_id)):undefined
      const route=allocation?routeMap.get(String(allocation.route_record_id)):undefined
      return [row.occurred_at,student?.full_name,student?.admission_no,student?.class_name,route?.title,row.event_type,row.source,row.notes]
    })
    const csv=[columns,...rows].map(line=>line.map(escapeCsv).join(',')).join('\r\n')
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
    const anchor=document.createElement('a');anchor.href=url;anchor.download='transport-attendance.csv';anchor.click();URL.revokeObjectURL(url)
  }

  const selectedAllocation=allocationMap.get(allocationId)
  const selectedStudent=selectedAllocation?studentMap.get(String(selectedAllocation.student_id)):undefined

  return <main className="page-content ed360-module-page ed360-transport-attendance">
    <header className="ed360-workspace-hero">
      <div className="ed360-workspace-hero-icon"><Bus size={21}/></div>
      <div className="ed360-workspace-hero-copy">
        <span>TRANSPORT MANAGEMENT / LIVE BOARDING REGISTER</span>
        <h1>Transport Attendance</h1>
        <p>Record student boarding, alighting and absence events against active transport allocations. Entries are append-only and institution-scoped.</p>
      </div>
      <button type="button" className="button button-outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button>
    </header>
    {!allowed ? <section className="table-card"><p>Transport attendance is restricted to institution owners, administrators and authorised teachers. Student and parent transport access is not enabled for this register.</p></section> :
    <>
      <section className="ed360-workspace-kpis">
        <article><span>Boarded today</span><strong>{summary.boarded}</strong><small>Recorded boarding events</small></article>
        <article><span>Alighted today</span><strong>{summary.alighted}</strong><small>Recorded alighting events</small></article>
        <article><span>Marked absent</span><strong>{summary.absent}</strong><small>Transport absence events</small></article>
        <article><span>Active allocations</span><strong>{activeAllocations.length}</strong><small>Students assigned to transport</small></article>
      </section>
      <section className="table-card">
        <div className="table-toolbar"><div><h2>Record boarding event</h2><p>Manual events are stored as immutable evidence. Existing events cannot be edited or deleted from the browser.</p></div></div>
        <form className="ed360-context-form-grid" onSubmit={save}>
          <label>Active student allocation *
            <select required value={allocationId} onChange={e=>setAllocationId(e.target.value)}>
              <option value="">Select student / route</option>
              {activeAllocations.map(row=>{
                const student=studentMap.get(String(row.student_id)),route=routeMap.get(String(row.route_record_id))
                return <option key={row.id} value={row.id}>{student?.full_name??'Student'} · {student?.admission_no??'No admission ID'} · {route?.title??'Route'}</option>
              })}
            </select>
          </label>
          <label>Event type *
            <select value={eventType} onChange={e=>setEventType(e.target.value as EventType)}>
              <option value="boarded">Boarded</option><option value="alighted">Alighted</option><option value="absent">Absent</option>
            </select>
          </label>
          <label>Event date and time *
            <input type="datetime-local" required value={occurredAt} onChange={e=>setOccurredAt(e.target.value)}/>
          </label>
          <label>Notes
            <input value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1000} placeholder="Optional driver / stop / exception note"/>
          </label>
          <div className="modal-actions"><button className="button button-primary" type="submit" disabled={saving||!allocationId}>{saving?'Saving event…':'Save attendance event'}</button></div>
        </form>
        {selectedAllocation&&<p className="ed360-helper-text">Selected: <strong>{selectedStudent?.full_name??'Student'}</strong> · {selectedStudent?.class_name??'Class not recorded'} · {routeMap.get(String(selectedAllocation.route_record_id))?.title??'Route not recorded'}</p>}
        <p className="ed360-helper-text">The database accepts events only for active allocations and only from an authorised owner, administrator or teacher in this institution.</p>
      </section>
      <section className="table-card">
        <div className="table-toolbar"><div><h2>Transport attendance history</h2><p>{visibleEvents.length} matching immutable event records</p></div><button type="button" className="button button-outline" onClick={exportEvents} disabled={!visibleEvents.length}><Download size={15}/> Export CSV</button></div>
        <div className="table-toolbar">
          <label className="search-box"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student, admission, route or event…"/></label>
          <label>Date <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/></label>
          <button type="button" className="button button-quiet" onClick={()=>{setDateFilter('');setSearch('')}}>Clear filters</button>
        </div>
        {loading?<p>Loading transport attendance…</p>:error?<p role="alert">{error}</p>:visibleEvents.length===0?<div className="ed360-empty-state"><Bus size={24}/><strong>No transport events found</strong><span>Adjust the date/search filters or record a boarding event above.</span></div>:
        <div className="table-scroll"><table><thead><tr><th>Occurred</th><th>Student</th><th>Admission</th><th>Class</th><th>Route</th><th>Event</th><th>Source</th><th>Notes</th></tr></thead><tbody>
          {visibleEvents.map(row=>{
            const allocation=allocationMap.get(String(row.allocation_id)),student=allocation?studentMap.get(String(allocation.student_id)):undefined,route=allocation?routeMap.get(String(allocation.route_record_id)):undefined
            const type=String(row.event_type) as EventType
            return <tr key={row.id}><td>{row.occurred_at?new Date(row.occurred_at).toLocaleString():'—'}</td><td>{student?.full_name??'Student'}</td><td>{student?.admission_no??'—'}</td><td>{student?.class_name??'—'}</td><td>{route?.title??'—'}</td><td><span className="status-pill">{eventLabel[type]??row.event_type}</span></td><td>{row.source??'manual'}</td><td>{row.notes??'—'}</td></tr>
          })}
        </tbody></table></div>}
      </section>
    </>}
  </main>
}
