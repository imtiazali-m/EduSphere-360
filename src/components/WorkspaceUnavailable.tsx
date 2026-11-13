import { ArrowLeft, Sparkles, ShieldCheck } from 'lucide-react'
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
  const description = item?.description ?? group?.description ?? 'This destination belongs to the college workspace.'
  const reason = groupKey === 'ai'
    ? 'EduSphere AI is not connected to a configured model provider yet. This screen will remain unavailable until generation, evidence-grounding, data-scope controls and human-review rules are implemented and tested.'
    : groupKey === 'backup'
      ? 'Automated cloud backups and restore operations are platform-level services that are not connected to this project yet. No backup or restore is being created by this screen.'
      : groupKey === 'communication'
        ? 'The selected external messaging or delivery provider is not configured. College notices and the in-app notification centre remain separate supported features.'
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
        ? 'Use the college bulletin and notification centre for supported in-app notices.'
        : 'Your college data is not changed by opening this screen.'

  return <main className="page-content ed360-module-page es-feature-state">
    <section className="es-feature-state-card">
      <div className="es-feature-state-orbit"><Sparkles size={25}/></div>
      <div className="es-feature-state-copy">
        <span className="es-feature-eyebrow">{group?.label ?? 'College workspace'}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="es-feature-state-status"><span/> Feature setup in progress</div>
        <p className="es-feature-state-detail">{reason}</p>
        <div className="es-feature-state-note"><ShieldCheck size={18}/><span>{alternative} No sample records or unrelated data are created here.</span></div>
        <button type="button" className="es-feature-state-back" onClick={() => onNavigate('overview')}><ArrowLeft size={16}/> Back to dashboard</button>
      </div>
      <div className="es-feature-state-art" aria-hidden="true"><div className="es-feature-art-ring ring-one"/><div className="es-feature-art-ring ring-two"/><div className="es-feature-art-core"><Sparkles size={42}/></div><span className="es-art-dot dot-one"/><span className="es-art-dot dot-two"/><span className="es-art-dot dot-three"/></div>
    </section>
  </main>
}
