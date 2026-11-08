import { Fragment, useEffect, useState } from 'react'
import '../styles/reports.css'
import { useAuth } from '../context/AuthContext'
import { listRecords } from '../lib/data'
import { userFacingError } from '../lib/userErrors'
import type { RecordRow } from '../lib/types'

const fields: { key: string; label: string }[] = [
  { key: 'full_name', label: 'Full name' }, { key: 'admission_no', label: 'Admission number' }, { key: 'class_name', label: 'Class / program' },
  { key: 'status', label: 'Status' }, { key: 'date_of_birth', label: 'Date of birth' }, { key: 'email', label: 'Student email' },
  { key: 'guardian_name', label: 'Parent / guardian' }, { key: 'guardian_email', label: 'Guardian email' },
]

export function ProfileModule() {
  const { user, mode } = useAuth()
  const [rows, setRows] = useState<RecordRow[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const isParent = user!.role === 'parent'

  useEffect(() => {
    let alive = true
    listRecords(mode, user!, 'students')
      .then(data => { if (alive) setRows(data) })
      .catch(problem => { if (alive) setError(userFacingError(problem, 'Unable to load your profile.')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [mode, user])

  if (loading) return <div className="report-empty">Loading profile…</div>
  if (error) return <div className="report-error" role="alert">{error}</div>
  if (!rows.length) return <div className="report-empty">{isParent ? 'No child is linked to your account yet.' : 'No student record is linked to your account yet.'} Please contact your institution administrator.</div>

  return <div className="report-profile-grid">
    {rows.map(row => <section className="report-section" key={row.id}>
      <header><div><h2>{isParent ? `Linked child: ${String(row.full_name ?? '')}` : 'My profile'}</h2><p>Read-only. Ask your institution to correct any detail.</p></div></header>
      <dl>{fields.map(field => <Fragment key={field.key}><dt>{field.label}</dt><dd>{String(row[field.key] ?? '') || '—'}</dd></Fragment>)}</dl>
    </section>)}
  </div>
}
