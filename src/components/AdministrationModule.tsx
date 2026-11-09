import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, BookOpen, Building2, CalendarDays, DoorOpen, Layers3, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { createRecord, deleteRecord as deleteDataRecord, listRecords, updateRecord } from '../lib/data'
import { userFacingError } from '../lib/userErrors'

type AdminModuleKey =
  | 'departments'
  | 'programs'
  | 'classes'
  | 'academic_sessions'
  | 'subjects'
  | 'rooms'

type AdminRecord = {
  id: string
  name?: string
  title?: string
  code?: string | null
  description?: string | null
  is_active?: boolean | null
  department_id?: string | null
  program_id?: string | null
  academic_session_id?: string | null
  section?: string | null
  grade_level?: string | null
  capacity?: number | null
  start_date?: string | null
  end_date?: string | null
  is_current?: boolean | null
  room_type?: string | null
  subject_type?: string | null
  credit_hours?: number | null
  [key: string]: unknown
}

type ModuleConfig = {
  key: AdminModuleKey
  label: string
  singular: string
  description: string
}

type AdvancedField = {
  key: string
  label: string
  type?: 'text' | 'date' | 'number' | 'select' | 'checkbox'
  options?: { label: string; value: string }[]
  source?: 'departments' | 'programs' | 'academic_sessions'
}

const MODULES: ModuleConfig[] = [
  {
    key: 'departments',
    label: 'Departments',
    singular: 'Department',
    description: 'Organize academic and administrative departments.',
  },
  {
    key: 'programs',
    label: 'Programs',
    singular: 'Program',
    description: 'Organize academic programs and courses offered by the institution.',
  },
  {
    key: 'classes',
    label: 'Class Sections',
    singular: 'Class / Section',
    description: 'Manage classes and section names.',
  },
  {
    key: 'academic_sessions',
    label: 'Academic Sessions',
    singular: 'Academic Session',
    description: 'Manage academic years and sessions.',
  },
  {
    key: 'subjects',
    label: 'Subjects',
    singular: 'Subject',
    description: 'Maintain the institution subject catalogue.',
  },
  {
    key: 'rooms',
    label: 'Rooms & Facilities',
    singular: 'Room / Facility',
    description: 'Maintain classrooms, labs and other facilities.',
  },
]

const ADVANCED_FIELDS: Partial<Record<AdminModuleKey, AdvancedField[]>> = {
  programs: [
    { key: 'department_id', label: 'Department', type: 'select', source: 'departments' },
  ],
  classes: [
    { key: 'program_id', label: 'Academic program', type: 'select', source: 'programs' },
    { key: 'academic_session_id', label: 'Academic session', type: 'select', source: 'academic_sessions' },
    { key: 'section', label: 'Section', type: 'text' },
    { key: 'grade_level', label: 'Grade / year level', type: 'text' },
    { key: 'capacity', label: 'Student capacity', type: 'number' },
  ],
  academic_sessions: [
    { key: 'start_date', label: 'Start date', type: 'date' },
    { key: 'end_date', label: 'End date', type: 'date' },
    { key: 'is_current', label: 'Current academic session', type: 'checkbox' },
  ],
  subjects: [
    { key: 'department_id', label: 'Department', type: 'select', source: 'departments' },
    { key: 'subject_type', label: 'Subject type', type: 'select', options: [
      { label: 'Core', value: 'core' }, { label: 'Elective', value: 'elective' },
      { label: 'Practical', value: 'practical' }, { label: 'Other', value: 'other' },
    ] },
    { key: 'credit_hours', label: 'Credit hours', type: 'number' },
  ],
  rooms: [
    { key: 'room_type', label: 'Facility type', type: 'select', options: [
      { label: 'Classroom', value: 'classroom' }, { label: 'Laboratory', value: 'laboratory' },
      { label: 'Library', value: 'library' }, { label: 'Office', value: 'office' },
      { label: 'Auditorium', value: 'auditorium' }, { label: 'Other', value: 'other' },
    ] },
    { key: 'capacity', label: 'Room capacity', type: 'number' },
  ],
}
const NO_ADVANCED_FIELDS: AdvancedField[] = []

const getDisplayName = (record: AdminRecord) =>
  String(record.name ?? record.title ?? record.code ?? 'Unnamed record')

const relatedSources: Record<AdminModuleKey, string[]> = {
  departments: ['programs'],
  programs: ['departments', 'classes'],
  classes: ['programs', 'academic_sessions', 'students'],
  academic_sessions: ['classes'],
  subjects: ['departments'],
  rooms: ['timetable_entries'],
}

function AdminWorkspaceInsights({ activeKey, records, references, loading }: {
  activeKey: AdminModuleKey; records: AdminRecord[]; references: Record<string, AdminRecord[]>; loading: boolean
}) {
  const linkedSource = ({
    departments: 'programs', programs: 'classes', classes: 'students',
    academic_sessions: 'classes', subjects: 'departments', rooms: 'timetable_entries',
  } as Record<AdminModuleKey, string>)[activeKey]
  const linkedRows = references[linkedSource] ?? []
  const active = records.filter(row => row.is_active !== false).length
  const capacity = records.reduce((sum, row) => sum + Math.max(0, Number(row.capacity ?? 0)), 0)
  const current = records.filter(row => row.is_current === true).length
  const groupRows = (() => {
    if (activeKey === 'departments') return records.map(parent => ({
      label: String(parent.name ?? 'Department'),
      value: linkedRows.filter(child => child.department_id === parent.id).length,
    }))
    if (activeKey === 'programs') return records.map(parent => ({
      label: String(parent.name ?? 'Program'),
      value: linkedRows.filter(child => child.program_id === parent.id).length,
    }))
    if (activeKey === 'classes') return records.map(parent => ({
      label: String(parent.name ?? parent.title ?? 'Class'),
      value: linkedRows.filter(child => String(child.class_name ?? '').toLowerCase() === String(parent.name ?? parent.title ?? '').toLowerCase()).length,
    }))
    if (activeKey === 'academic_sessions') return records.map(parent => ({
      label: String(parent.name ?? 'Session'),
      value: linkedRows.filter(child => child.academic_session_id === parent.id).length,
    }))
    const field = activeKey === 'subjects' ? 'subject_type' : activeKey === 'rooms' ? 'room_type' : 'name'
    const counts = new Map<string, number>()
    records.forEach(record => {
      const label = String(record[field] ?? 'Not specified').replaceAll('_', ' ')
      counts.set(label, (counts.get(label) ?? 0) + 1)
    })
    return [...counts.entries()].map(([label, value]) => ({ label, value }))
  })().sort((a, b) => b.value - a.value).slice(0, 6)
  const metrics = [
    { label: 'Total ' + MODULES.find(item => item.key === activeKey)!.label, value: records.length.toLocaleString(), note: 'Institution records', icon: Building2, tone: 'blue' },
    { label: 'Active records', value: active.toLocaleString(), note: 'Available for use', icon: Activity, tone: 'green' },
    { label: ({ departments: 'Programs linked', programs: 'Class sections', classes: 'Students linked', academic_sessions: 'Classes linked', subjects: 'Departments linked', rooms: 'Timetable bookings' } as Record<AdminModuleKey, string>)[activeKey], value: linkedRows.length.toLocaleString(), note: 'Related workspace records', icon: Layers3, tone: 'violet' },
    { label: activeKey === 'academic_sessions' ? 'Current sessions' : ['classes', 'rooms'].includes(activeKey) ? 'Total capacity' : 'Defined categories', value: activeKey === 'academic_sessions' ? current.toLocaleString() : ['classes', 'rooms'].includes(activeKey) ? capacity.toLocaleString() : groupRows.length.toLocaleString(), note: activeKey === 'academic_sessions' ? 'Marked as current' : ['classes', 'rooms'].includes(activeKey) ? 'Places / seats capacity' : 'Groups represented', icon: activeKey === 'rooms' ? DoorOpen : activeKey === 'subjects' ? BookOpen : activeKey === 'classes' ? Users : CalendarDays, tone: 'amber' },
  ]
  const max = Math.max(1, ...groupRows.map(item => item.value))
  return <section className="ed360-module-insights ed360-admin-insights">
    <header className="ed360-module-insights-heading">
      <div><span>INSTITUTE STRUCTURE</span><h2>{MODULES.find(item => item.key === activeKey)!.label} overview</h2><p>Live totals and relationships with the other administration records.</p></div>
      <small>{loading ? 'Updating records…' : records.length + ' records loaded'}</small>
    </header>
    <div className="ed360-workspace-metrics">{metrics.map(item => {
      const Icon = item.icon
      return <div className={'ed360-workspace-metric ' + item.tone} key={item.label}><span><Icon size={19}/></span><small>{item.label}</small><strong>{loading ? '—' : item.value}</strong><em>{item.note}</em></div>
    })}</div>
    <div className="ed360-workspace-chart-card">
      <div><h3>{({ departments: 'Programs per department', programs: 'Class sections per program', classes: 'Students by class section', academic_sessions: 'Classes per academic session', subjects: 'Subjects by type', rooms: 'Facilities by type' } as Record<AdminModuleKey, string>)[activeKey]}</h3><p>Relationship counts from the existing institution records.</p></div>
      <div className="ed360-workspace-bar-list">
        {groupRows.map(item => <div className="ed360-workspace-bar-row" key={item.label}><div><span>{item.label}</span><b>{loading ? '—' : item.value.toLocaleString()}</b></div><span className="ed360-workspace-bar-track"><i style={{ width: (item.value / max * 100) + '%', background: '#2877ee' }}/></span></div>)}
        {!loading && groupRows.length === 0 && <p className="ed360-workspace-empty">Add records to see their linked structure and distribution here.</p>}
      </div>
    </div>
  </section>
}

export default function AdministrationModule({ initialKey = 'departments' }: { initialKey?: AdminModuleKey }) {
  const { user, mode } = useAuth()
  const activeKey: AdminModuleKey = initialKey
  const [workspaceTab,setWorkspaceTab] = useState<'overview'|'directory'|'editor'>('overview')
  const [records, setRecords] = useState<AdminRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewingRecord, setViewingRecord] = useState<AdminRecord | null>(null)
  const pageSize = 10
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [advancedValues, setAdvancedValues] = useState<Record<string, string | boolean>>({})
  const [references, setReferences] = useState<Record<string, AdminRecord[]>>({})
  const [referencesError, setReferencesError] = useState('')
  const [referencesReload, setReferencesReload] = useState(0)
  const advancedFields = ADVANCED_FIELDS[activeKey] ?? NO_ADVANCED_FIELDS

  const activeModule = useMemo(
    () => MODULES.find((item) => item.key === activeKey) ?? MODULES[0],
    [activeKey],
  )
  const windowLabels: Record<AdminModuleKey,{overview:string;directory:string;editor:string;scope:string}> = {
    departments:{overview:'Department Structure',directory:'Department Register',editor:'Department Setup',scope:'Organisational units and their active/inactive status.'},
    programs:{overview:'Program Overview',directory:'Program Catalogue',editor:'Program Definition',scope:'Academic programs linked to departments.'},
    classes:{overview:'Class Capacity Overview',directory:'Class & Section Register',editor:'Class Placement Setup',scope:'Sections, grade levels, program links and learner capacity.'},
    academic_sessions:{overview:'Academic Calendar Overview',directory:'Session Register',editor:'Session Configuration',scope:'Academic years, dates and current-session designation.'},
    subjects:{overview:'Subject Catalogue Overview',directory:'Subject Register',editor:'Subject Definition',scope:'Subject types, departments and credit-hour definitions.'},
    rooms:{overview:'Facilities Overview',directory:'Room & Facility Register',editor:'Facility Setup',scope:'Room types, capacity and timetable usage.'},
  }
  const currentWindow = windowLabels[activeKey]

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setError('')
    setNotice('')

    try {
      if (!user) throw new Error('Sign in again to manage institution settings.')

      const data = await listRecords(mode, user, activeKey)
      setRecords(data as AdminRecord[])
    } catch (queryError) {
      setRecords([])
      setError(userFacingError(queryError, `Unable to load ${activeModule.label.toLowerCase()}. Refresh and try again.`))
    } finally {
      setLoading(false)
    }
  }, [activeKey, mode, user])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords])

  useEffect(() => {
    let alive = true
    const sources = [...new Set([...advancedFields.map((field) => field.source).filter(Boolean), ...relatedSources[activeKey]])] as string[]
    setReferencesError('')
    if (!user || sources.length === 0) {
      setReferences({})
      return
    }
    void (async () => {
      let firstError: unknown = null
      const entries = await Promise.all(sources.map(async (source) => {
        try {
          const rows = await listRecords(mode, user, source)
          return [source, rows as AdminRecord[]] as const
        } catch (lookupError) {
          firstError ??= lookupError
          return [source, [] as AdminRecord[]] as const
        }
      }))
      if (!alive) return
      setReferences(Object.fromEntries(entries))
      setReferencesError(firstError ? userFacingError(firstError, 'Some linked options could not be loaded. Refresh and try again.') : '')
    })()
    return () => { alive = false }
  }, [activeKey, mode, user?.id, advancedFields, referencesReload])

  const resetForm = () => {
    setEditingId(null)
    setCurrentPage(1)
    setName('')
    setCode('')
    setDescription('')
    setIsActive(true)
    setAdvancedValues({})
  }

  const startEdit = (record: AdminRecord) => {
    setEditingId(record.id)
    setName(String(record.name ?? record.title ?? ''))
    setCode(String(record.code ?? ''))
    setDescription(String(record.description ?? ''))
    setIsActive(record.is_active !== false)
    setAdvancedValues(Object.fromEntries(advancedFields.map((field) => [
      field.key,
      field.type === 'checkbox' ? Boolean(record[field.key]) : String(record[field.key] ?? ''),
    ])))
    setNotice('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanName = name.trim()

    if (!cleanName) {
      setError(`Enter a ${activeModule.singular.toLowerCase()} name.`)
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    const payload: Record<string, unknown> = {
      name: cleanName,
      code: code.trim() || null,
      description: description.trim() || null,
      is_active: isActive,
    }
    for (const field of advancedFields) {
      const value = advancedValues[field.key]
      if (field.type === 'checkbox') payload[field.key] = Boolean(value)
      else if (field.type === 'number') payload[field.key] = value === '' || value === undefined ? null : Number(value)
      else payload[field.key] = value === '' || value === undefined ? null : value
    }

    if (activeKey === 'academic_sessions') {
      const start = String(payload.start_date ?? '')
      const end = String(payload.end_date ?? '')
      if (start && end && end < start) {
        setError('The session end date cannot be earlier than its start date.')
        setSaving(false)
        return
      }
    }
    if (['classes', 'rooms'].includes(activeKey) && payload.capacity !== null && Number(payload.capacity) < 0) {
      setError('Capacity cannot be negative.')
      setSaving(false)
      return
    }
    if (activeKey === 'subjects' && payload.credit_hours !== null && Number(payload.credit_hours) < 0) {
      setError('Credit hours cannot be negative.')
      setSaving(false)
      return
    }

    try {
      if (!user) throw new Error('Sign in again to save institution settings.')
      const actionLabel = editingId ? 'updated' : 'created'
      if (editingId) await updateRecord(mode, user, activeKey, editingId, payload)
      else await createRecord(mode, user, activeKey, payload)
      resetForm()
      await loadRecords()
      setNotice(`${activeModule.singular} ${actionLabel} successfully.`)
    } catch (saveError) {
      setError(userFacingError(saveError, `Unable to save ${activeModule.singular.toLowerCase()}. Check the details and try again.`))
    } finally {
      setSaving(false)
    }
  }

  const deleteRecord = async (record: AdminRecord) => {
    const label = getDisplayName(record)
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return

    setError('')
    setNotice('')
    try {
      if (!user) throw new Error('Sign in again to delete institution settings.')
      await deleteDataRecord(mode, user, activeKey, record.id)
      if (editingId === record.id) resetForm()
      await loadRecords()
      setNotice(`${activeModule.singular} deleted successfully.`)
    } catch (deleteError) {
      setError(userFacingError(deleteError, `Unable to delete ${activeModule.singular.toLowerCase()}. Refresh and try again.`))
    }
  }

  const filteredRecords = records.filter((record) => {
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [record.name, record.title, record.code, record.description]
      .some((value) => String(value ?? '').toLowerCase().includes(query))
  })
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const pagedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  if (!user || !['owner', 'admin'].includes(user.role)) {
    return <section className="admin-page"><div className="admin-alert error" role="alert">You do not have permission to manage institution settings.</div></section>
  }

  return (
    <main className="admin-page ed360-module-page">
      <style>{`
        .admin-page{color:var(--text-primary,#172033);display:grid;gap:20px}
        .admin-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
        .admin-heading h1{font-size:26px;margin:0 0 6px;font-weight:750}
        .admin-muted{color:var(--text-secondary,#64748b);font-size:13px;margin:0}
        .admin-tabs{display:flex;gap:8px;flex-wrap:wrap}
        .admin-tab,.admin-button{border:1px solid var(--border-color,#dbe2ea);border-radius:10px;padding:9px 13px;background:var(--surface,#fff);color:inherit;font-weight:600;cursor:pointer}
        .admin-tab[aria-pressed="true"]{background:var(--primary,#2457d6);border-color:var(--primary,#2457d6);color:#fff}
        .admin-grid{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);gap:18px;align-items:start}
        .admin-card{background:var(--card-bg,#fff);border:1px solid var(--border-color,#e2e8f0);border-radius:14px;padding:18px;box-shadow:0 2px 10px #0f172a08}
        .admin-card h2{font-size:17px;margin:0 0 6px}
        .admin-field{display:grid;gap:6px;margin-top:13px}
        .admin-field label{font-size:13px;font-weight:650}
        .admin-field input,.admin-field textarea,.admin-field select,.admin-search{width:100%;box-sizing:border-box;border:1px solid var(--border-color,#cbd5e1);border-radius:9px;padding:10px 11px;background:var(--input-bg,#fff);color:inherit;font:inherit}
        .admin-field textarea{min-height:82px;resize:vertical}
        .admin-check{display:flex;gap:9px;align-items:center;margin:14px 0;font-size:13px}
        .admin-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
        .admin-button.primary{background:var(--primary,#2457d6);color:#fff;border-color:var(--primary,#2457d6)}
        .admin-button.danger{color:#b42318}
        .admin-list-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
        .admin-search{max-width:260px}
        .admin-table-wrap{overflow:auto}
        .admin-table{width:100%;border-collapse:collapse;font-size:13px}
        .admin-table th,.admin-table td{text-align:left;padding:12px 9px;border-bottom:1px solid var(--border-color,#e2e8f0);vertical-align:middle}
        .admin-table th{color:var(--text-secondary,#64748b);font-size:11px;text-transform:uppercase;letter-spacing:.04em}
        .admin-status{display:inline-block;border-radius:99px;padding:4px 8px;background:#e8f7ee;color:#187443;font-size:11px;font-weight:700}
        .admin-status.off{background:#f1f5f9;color:#64748b}
        .admin-alert{padding:11px 13px;border-radius:9px;font-size:13px}
        .admin-alert.error{background:#fff1f0;color:#a32118}
        .admin-alert.success{background:#ecfdf3;color:#176b3a}
        .admin-empty{padding:28px 12px;text-align:center;color:var(--text-secondary,#64748b);font-size:13px}
        @media(max-width:850px){.admin-grid{grid-template-columns:1fr}.admin-search{max-width:none}}
      `}</style>

      <header className="admin-heading">
        <div>
          <h1>{activeModule.label}</h1>
          <p className="admin-muted">{activeModule.description}</p>
        </div>
        <div className="admin-actions"><button className="admin-button" type="button" onClick={() => { void loadRecords(); setReferencesReload((value) => value + 1) }}>Refresh records</button><button className="admin-button primary" type="button" onClick={() => { resetForm(); setWorkspaceTab('editor') }}>Add {activeModule.singular}</button></div>
      </header>
      <nav className="ed360-operations-window-nav" aria-label={activeModule.label + ' workspace windows'}>
        <button type="button" className={workspaceTab==='overview'?'active':''} aria-current={workspaceTab==='overview'?'page':undefined} onClick={()=>setWorkspaceTab('overview')}>{currentWindow.overview}</button>
        <button type="button" className={workspaceTab==='directory'?'active':''} aria-current={workspaceTab==='directory'?'page':undefined} onClick={()=>setWorkspaceTab('directory')}>{currentWindow.directory}<b>{records.length}</b></button>
        <button type="button" className={workspaceTab==='editor'?'active':''} aria-current={workspaceTab==='editor'?'page':undefined} onClick={()=>setWorkspaceTab('editor')}>{currentWindow.editor}</button>
      </nav>
      <section className="ed360-operations-context-window"><div><span>INSTITUTE ADMINISTRATION / {activeModule.label.toUpperCase()}</span><h2>{currentWindow[workspaceTab]}</h2><p>{currentWindow.scope}</p></div><div><strong>{records.length}</strong><small>{activeModule.label.toLowerCase()}</small></div></section>
      <div hidden={workspaceTab!=='overview'}><AdminWorkspaceInsights activeKey={activeKey} records={records} references={references} loading={loading}/></div>
      {error && <div className="admin-alert error" role="alert">{error}</div>}
      {referencesError && <div className="admin-alert error" role="alert">{referencesError} Use Refresh records to retry linked options.</div>}
      {notice && <div className="admin-alert success" role="status">{notice}</div>}

      <section className="admin-grid">
        <form className="admin-card" hidden={workspaceTab!=='editor'} onSubmit={saveRecord}>
          <h2>{editingId ? `Edit ${activeModule.singular}` : `Add ${activeModule.singular}`}</h2>
          <p className="admin-muted">{activeModule.description}</p>

          <div className="admin-field">
            <label htmlFor="admin-record-name">Name *</label>
            <input
              id="admin-record-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={`Enter ${activeModule.singular.toLowerCase()} name`}
              maxLength={120}
              required
            />
          </div>

          {advancedFields.map((field) => {
            const value = advancedValues[field.key] ?? (field.type === 'checkbox' ? false : '')
            const options = field.source
              ? (references[field.source] ?? []).map((record) => ({
                label: getDisplayName(record), value: record.id,
              }))
              : field.options ?? []
            if (field.type === 'checkbox') return (
              <label className="admin-check" key={field.key}>
                <input type="checkbox" checked={Boolean(value)} onChange={(event) => setAdvancedValues((old) => ({ ...old, [field.key]: event.target.checked }))}/>
                {field.label}
              </label>
            )
            if (field.type === 'select') return (
              <div className="admin-field" key={field.key}>
                <label htmlFor={`admin-${field.key}`}>{field.label}</label>
                <select id={`admin-${field.key}`} value={String(value)} onChange={(event) => setAdvancedValues((old) => ({ ...old, [field.key]: event.target.value }))}>
                  <option value="">Not assigned</option>
                  {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </div>
            )
            return (
              <div className="admin-field" key={field.key}>
                <label htmlFor={`admin-${field.key}`}>{field.label}</label>
                <input id={`admin-${field.key}`} type={field.type ?? 'text'} min={field.type === 'number' ? 0 : undefined} step={field.key === 'credit_hours' ? '0.5' : '1'} value={String(value)} onChange={(event) => setAdvancedValues((old) => ({ ...old, [field.key]: event.target.value }))}/>
              </div>
            )
          })}

          <div className="admin-field">
            <label htmlFor="admin-record-code">Code (optional)</label>
            <input
              id="admin-record-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Enter code"
              maxLength={40}
            />
          </div>

          <div className="admin-field">
            <label htmlFor="admin-record-description">Description (optional)</label>
            <textarea
              id="admin-record-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add notes or details"
              maxLength={1000}
            />
          </div>

          <label className="admin-check">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            Active
          </label>

          <div className="admin-actions">
            <button className="admin-button primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update record' : 'Save record'}
            </button>
            {editingId && <button className="admin-button" type="button" onClick={resetForm}>Cancel</button>}
          </div>
        </form>

        <section className="admin-card" hidden={workspaceTab!=='directory'}>
          <div className="admin-list-head">
            <div>
              <h2>{activeModule.label}</h2>
              <p className="admin-muted">{records.length} total records</p>
            </div>
            <input
              className="admin-search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setCurrentPage(1) }}
              placeholder="Search records…"
              aria-label="Search records"
            />
          </div>

          {loading ? (
            <div className="admin-empty">Loading records…</div>
          ) : filteredRecords.length === 0 ? (
            <div className="admin-empty">
              {records.length === 0 ? 'No records found. Add the first record using the form.' : 'No matching records.'}
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Name</th><th>Code</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {pagedRecords.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <strong>{getDisplayName(record)}</strong>
                        {record.description && <div className="admin-muted">{String(record.description)}</div>}
                      </td>
                      <td>{String(record.code ?? '—')}</td>
                      <td><span className={`admin-status${record.is_active === false ? ' off' : ''}`}>{record.is_active === false ? 'Inactive' : 'Active'}</span></td>
                      <td>
                        <div className="admin-actions">
                          <button className="admin-button" type="button" onClick={() => setViewingRecord(record)}>View</button>
                          <button className="admin-button" type="button" onClick={() => { startEdit(record); setWorkspaceTab('editor') }}>Edit</button>
                          <button className="admin-button danger" type="button" onClick={() => void deleteRecord(record)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredRecords.length > pageSize && <div className="ed360-table-pagination">
            <span>Showing <b>{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredRecords.length)}</b> of <b>{filteredRecords.length}</b> records</span>
            <div className="ed360-pagination-controls">
              <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage(value => value - 1)}>‹</button>
              {Array.from({ length: pageCount }, (_, index) => index + 1).filter(number => number === 1 || number === pageCount || Math.abs(number - currentPage) <= 1).map(number => <button type="button" key={number} className={number === currentPage ? 'active' : ''} onClick={() => setCurrentPage(number)}>{number}</button>)}
              <button type="button" disabled={currentPage >= pageCount} onClick={() => setCurrentPage(value => value + 1)}>›</button>
            </div>
          </div>}
        </section>
      </section>
      {viewingRecord && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setViewingRecord(null) }}>
        <section className="modal-card ed360-record-details" role="dialog" aria-modal="true">
          <div className="modal-heading"><div><div className="eyebrow">{activeModule.label.toUpperCase()}</div><h2>{getDisplayName(viewingRecord)}</h2><p>Institution administration record details</p></div><button type="button" className="icon-button" onClick={() => setViewingRecord(null)}>×</button></div>
          <div className="ed360-record-details-grid">
            {Object.entries(viewingRecord).filter(([key, value]) => !['id', 'institution_id', 'created_by', 'updated_at'].includes(key) && value !== null && value !== '').map(([key, value]) => <div className="ed360-record-detail" key={key}><small>{key.replaceAll('_', ' ')}</small><b>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</b></div>)}
          </div>
          <div className="modal-actions"><button type="button" className="button button-primary" onClick={() => setViewingRecord(null)}>Close</button></div>
        </section>
      </div>}
    </main>
  )
}
