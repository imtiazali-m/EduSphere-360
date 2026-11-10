import { ArrowLeft, Construction, Database, ShieldCheck } from 'lucide-react'
import { getWorkspaceGroup, getWorkspaceItem } from '../lib/institutionalCatalog'

interface Props {
  groupKey: string
  itemKey: string
  onNavigate: (route: string) => void
}

export function WorkspaceUnavailable({ groupKey, itemKey, onNavigate }: Props) {
  const group = getWorkspaceGroup(groupKey)
  const item = getWorkspaceItem(groupKey, itemKey)
  const title = item?.label ?? itemKey.replaceAll('-', ' ').replace(/\b\w/g, value => value.toUpperCase())
  const description = item?.description ?? group?.description ?? 'This destination belongs to the institution workspace.'
  const reason = groupKey === 'ai'
    ? 'EduSphere AI is not connected to a configured model provider yet. This screen will remain unavailable until generation, evidence-grounding, data-scope controls and human-review rules are implemented and tested.'
    : groupKey === 'backup'
      ? 'Automated cloud backups and restore operations are platform-level services that are not connected to this project yet. No backup or restore is being created by this screen.'
      : groupKey === 'communication'
        ? 'The selected external messaging or delivery provider is not configured. Institution notices and the in-app notification centre remain separate supported features.'
        : groupKey === 'students' && itemKey === 'bulk-student-operations'
          ? 'A safe batch-processing workflow is not connected yet. Student admissions and the individual student directory remain available; this destination will not perform unreviewed bulk edits.'
          : groupKey === 'employees' && itemKey === 'employee-performance'
            ? 'An employee appraisal workflow with objectives, review cycles, evidence and approvals is not connected yet. HR directory statistics are available separately and are not a performance rating.'
            : groupKey === 'reports' && ['custom-report-builder','scheduled-reports','report-templates','report-history'].includes(itemKey)
              ? 'The configurable and scheduled report engine is not connected yet. The built-in live finance, attendance, enrolment, employee and assessment reports remain available with CSV export where provided.'
              : groupKey === 'class-tests' && ['online-tests','written-tests','test-questions'].includes(itemKey)
                ? 'A separate class-test delivery and question workflow is not connected yet. The standard examination schedule and recorded examination results remain available.'
                : groupKey === 'examinations' && itemKey === 'automatic-checking'
                  ? 'Automated marking is not configured. Examination marks are entered and reviewed by authorised staff; this screen will not generate unverified grades.'
                  : groupKey === 'timetable' && ['teacher-availability','substitution-management','timetable-publishing','class-coverage','engaged-classes'].includes(itemKey)
                    ? 'The advanced availability, substitution and publishing workflow is not connected yet. Saved weekly timetables and detected class, teacher or room overlaps remain available.'
                    : groupKey === 'library' && ['reading-records','reading-cards','student-reading-history'].includes(itemKey)
                      ? 'A separate reading-progress and reading-card workflow is not connected yet. The book catalogue, circulation register, returns and recorded overdue fines remain available.'
                      : groupKey === 'transport' && itemKey === 'transport-attendance'
                        ? 'A transport-specific boarding and route attendance register is not connected yet. Student route and vehicle allocations and their recorded fees remain available.'
                        : groupKey === 'facilities' && ['room-reservations','facilities-reports'].includes(itemKey)
                          ? 'Room reservation scheduling and dedicated facility analytics are not connected yet. Room records and the facility maintenance queue remain available.'
                          : groupKey === 'visitors' && ['visitor-approvals','visitor-notifications','visitor-reports'].includes(itemKey)
                            ? 'Advanced visitor approvals, notifications and dedicated visitor analytics are not connected yet. Visitor registration, check-in, check-out and visit history remain available.'
                            : groupKey === 'certificates' && ['experience-certificate','id-card-designer','certificate-templates','editable-document-templates','bulk-certificate-generation'].includes(itemKey)
                              ? 'This document template or bulk generation workflow is not connected yet. Individual student certificates can be created, issued, printed and verified from the certificate register.'
                              : 'This destination is identified, but its dedicated production workflow is not connected yet.'
  const alternative = groupKey === 'ai'
    ? 'Current institutional reports and dashboards use recorded database values. They do not claim to be AI-generated predictions.'
    : groupKey === 'backup'
      ? 'Existing module reports can be exported where the relevant workspace provides an export action. This is not a full database or file backup.'
      : groupKey === 'communication'
        ? 'Use the institution bulletin and notification centre for supported in-app notices.'
        : 'Your institution data is not changed by opening this screen.'

  return <main className="page-content ed360-module-page" style={{ maxWidth: 1100, margin: '0 auto', padding: 32 }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28 }}>
      <span style={{ width: 52, height: 52, borderRadius: 16, display: 'grid', placeItems: 'center', background: '#edf2fb', color: '#315b9b' }}><Construction size={24}/></span>
      <div>
        <div className="eyebrow">{group?.label ?? groupKey} / WORKSPACE STATUS</div>
        <h1 style={{ margin: '5px 0', fontSize: 30 }}>{title}</h1>
        <p style={{ margin: 0, color: 'var(--muted, #64748b)' }}>{description}</p>
      </div>
    </header>
    <section className="table-card" style={{ padding: 28, borderRadius: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9a6515', fontWeight: 700, marginBottom: 12 }}>
        <Database size={18}/> Dedicated workflow connection required
      </div>
      <p style={{ maxWidth: 760, lineHeight: 1.65, color: 'var(--text-secondary, #536173)' }}>
        {reason} It will not display invented sample records or save unrelated entries in a generic record store.
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 16, borderRadius: 12, background: '#f3f7fb', color: '#40536b', margin: '20px 0' }}>
        <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 2 }}/>
        <span style={{ lineHeight: 1.55 }}>{alternative} Existing supported workspaces remain available from the main navigation.</span>
      </div>
      <button type="button" className="button button-outline" onClick={() => onNavigate('overview')}><ArrowLeft size={15}/> Return to dashboard</button>
    </section>
  </main>
}
