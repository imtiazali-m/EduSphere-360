import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  module._compile(output, filename)
}

const { getNavigationRoute } = require(path.join(root, 'src/lib/navigationRoutes.ts'))
const { roleNavigationGroups } = require(path.join(root, 'src/lib/navigationCatalog.ts'))
const { modulesForRole } = require(path.join(root, 'src/lib/modules.ts'))
const { operationalWorkspaceConfigs } = require(path.join(root, 'src/lib/operationalWorkspaceViews.ts'))
const { getWorkspaceGroup, getWorkspaceItem } = require(path.join(root, 'src/lib/institutionalCatalog.ts'))

const roles = [
  ['owner', 'Owner'], ['admin', 'Administrator'], ['teacher', 'Teacher / employee'],
  ['student', 'Student'], ['parent', 'Parent / guardian'], ['accountant', 'Accountant'],
  ['exam_officer', 'Examination officer'],
]

const studentTabs = new Set(['overview','admissions','directory','profile','id-cards','classes','guardians','attendance','results','assignments','timetable','documents','fees','health','history'])
const studentVisibleTabs = {
  owner: studentTabs,
  admin: studentTabs,
  teacher: new Set(['overview','directory','profile','id-cards','classes','attendance','results','assignments','timetable','history']),
  student: new Set(['overview','profile','id-cards','classes','guardians','attendance','results','assignments','timetable','documents','fees','health','history']),
  parent: new Set(['overview','profile','id-cards','classes','guardians','attendance','results','assignments','timetable','documents','fees','health','history']),
}
const facultyTabs = new Set(['overview','registration','directory','directory-teaching','directory-staff','profile','id-cards','departments','designations','assignments','attendance','leave','workload','documents','qualifications','history','reports'])
const facultyStaffTabs = new Set(['overview','profile','id-cards','assignments','attendance','leave','workload','documents','qualifications','history'])
const attendanceWindows = new Set(['students','teachers','staff','history','devices'])
const reportTabs = new Set(['overview','finance','attendance','academics','students','employees','payroll'])
const financeTabs = {
  'accounts-finance': new Set(['overview','accounts','journals','reconciliation']),
  fees: new Set(['overview','structures','invoices','payments','receivables','discounts','refunds','receipts','reconciliation']),
  receivables: new Set(['overview','receivables','invoices','payments','reconciliation']),
  payments: new Set(['overview','payments','receivables','refunds','reconciliation']),
  receipts: new Set(['overview','receipts','payments']),
  reconciliation: new Set(['overview','reconciliation','journals','receivables']),
}
const payrollTabs = new Set(['overview','salary','components','adjustments','runs','payslips'])
const peopleHRTabs = new Set(['admissions','recruitment','contracts','performance','alumni'])
const governanceTabs = new Set(['profile','settings','approvals','audit','academic','accounts','departments','organization','system','policies','permissions','branding','security'])
const operationTabs = {
  'question-bank': new Set(['pool','papers']),
  curriculum: new Set(['units','coverage']),
  behaviour: new Set(['register','positive','follow-up','skills','activities','competencies','history','analytics','reports']),
  certificates: new Set(['verify','issue','templates','bulk','history']),
  visitors: new Set(['log','checked-in','approvals','notifications','history','reports']),
  facilities: new Set(['assets','maintenance','history','reservations','reports']),
}
const adminKeys = new Set(['departments','programs','classes','academic_sessions','subjects','rooms'])
const linkedKeys = new Set(["administration:campus-and-branch-management","library:library-dashboard","library:book-management","library:book-catalogue","library:book-categories","library:book-registration","library:book-issue-and-returns","library:digital-library","library:learning-materials","library:resource-downloads","library:library-reports","inventory:inventory-dashboard","inventory:items-management","inventory:item-catalogue","inventory:item-categories","inventory:stock-in","inventory:stock-out","inventory:stock-allocation","inventory:stock-adjustments","inventory:inventory-history","inventory:stock-reports","transport:transport-dashboard","transport:vehicle-management","transport:drivers-management","transport:transport-routes","transport:route-stops","transport:student-transport-allocation","transport:transport-fees","transport:transport-assignments","transport:vehicle-maintenance","transport:transport-attendance","transport:transport-history","transport:transport-reports"])

function shellTarget(route) {
  const academic = route.startsWith('academic:')
  const student = route.startsWith('students:')
  const attendance = route.startsWith('attendance:')
  const care = route.startsWith('care:')
  const institutional = route.startsWith('institutional:')
  const unavailable = route.startsWith('unavailable:')
  const employee = route.startsWith('employees:')
  const reports = route.startsWith('reports:')
  const finance = route.startsWith('finance:')
  const payroll = route.startsWith('payroll:')
  const peopleHR = route.startsWith('peoplehr:')
  const dataManagement = route.startsWith('data-management:')
  const customReports = route.startsWith('custom-reports:')
  const messaging = route.startsWith('messaging:')
  const hostel = route.startsWith('hostel:')
  const procurement = route.startsWith('procurement:')
  const cafeteria = route.startsWith('cafeteria:')
  const libraryReading = route.startsWith('library-reading:')
  const receiptOperations = route.startsWith('receipt-operations:')
  const paymentOperations = route.startsWith('payment-operations:')
  const assetLifecycle = route.startsWith('asset-lifecycle:')
  const scheduledReports = route.startsWith('scheduled-reports:')
  const helpdesk = route.startsWith('helpdesk:')
  const duplicateDetection = route.startsWith('duplicate-detection:')
  const personal = route.startsWith('personal:')
  const assistant = route.startsWith('assistant:')
  const frontOffice = route.startsWith('frontoffice:')
  const governance = route.startsWith('governance:')
  const operations = route.startsWith('operations:')
  const parts = route.split(':')
  const moduleWindow = parts.length === 2 && ['fees','exams','exam_results','assignments','assignment_submissions','timetable','announcements','work_tasks'].includes(parts[0])
  const targetKey = academic ? 'academic'
    : student ? 'students'
    : attendance ? 'attendance'
    : care ? 'care'
    : institutional ? 'institutional'
    : unavailable ? 'unavailable'
    : employee ? 'teachers'
    : reports ? 'reports'
    : finance ? 'finance'
    : payroll ? 'payroll'
    : peopleHR ? 'peoplehr'
    : dataManagement ? 'data-management'
    : customReports ? 'custom-reports'
    : messaging ? 'messaging'
    : hostel ? 'hostel'
    : procurement ? 'procurement'
    : cafeteria ? 'cafeteria'
    : libraryReading ? 'library-reading'
    : receiptOperations ? 'receipt-operations'
    : paymentOperations ? 'payment-operations'
    : assetLifecycle ? 'asset-lifecycle'
    : scheduledReports ? 'scheduled-reports'
    : helpdesk ? 'helpdesk'
    : duplicateDetection ? 'duplicate-detection'
    : personal ? 'personal'
    : assistant ? 'assistant'
    : frontOffice ? 'frontoffice'
    : governance ? 'governance'
    : operations ? 'operations'
    : moduleWindow ? parts[0]
    : route
  const targetWindow = academic ? route.slice('academic:'.length)
    : student ? route.slice('students:'.length)
    : attendance ? route.slice('attendance:'.length)
    : care ? route.slice('care:'.length)
    : institutional ? route.slice('institutional:'.length)
    : unavailable ? route.slice('unavailable:'.length)
    : employee ? route.slice('employees:'.length)
    : reports ? route.slice('reports:'.length)
    : finance ? route.slice('finance:'.length)
    : payroll ? route.slice('payroll:'.length)
    : peopleHR ? route.slice('peoplehr:'.length)
    : dataManagement ? route.slice('data-management:'.length)
    : customReports ? route.slice('custom-reports:'.length)
    : messaging ? route.slice('messaging:'.length)
    : hostel ? route.slice('hostel:'.length)
    : procurement ? route.slice('procurement:'.length)
    : cafeteria ? route.slice('cafeteria:'.length)
    : libraryReading ? route.slice('library-reading:'.length)
    : receiptOperations ? route.slice('receipt-operations:'.length)
    : paymentOperations ? route.slice('payment-operations:'.length)
    : assetLifecycle ? route.slice('asset-lifecycle:'.length)
    : scheduledReports ? route.slice('scheduled-reports:'.length)
    : helpdesk ? route.slice('helpdesk:'.length)
    : duplicateDetection ? route.slice('duplicate-detection:'.length)
    : personal ? route.slice('personal:'.length)
    : assistant ? route.slice('assistant:'.length)
    : frontOffice ? route.slice('frontoffice:'.length)
    : governance ? route.slice('governance:'.length)
    : operations ? route.slice('operations:'.length)
    : moduleWindow ? parts[1]
    : 'overview'
  return { targetKey, targetWindow, moduleWindow }
}

function checkView(role, route, dispatcher) {
  const { targetKey, targetWindow, moduleWindow } = shellTarget(route)
  if (targetKey === 'unavailable') return { component: 'WorkspaceUnavailable', view: 'n/a', status: 'Expected unavailable state' }
  if (targetKey === 'academic') {
    const supported = new Set(['academic-sessions','classes-sections','subjects-courses','curriculum','lesson-planning','timetable','homework-assignments','study-materials','online-learning','classroom-activities','academic-calendar','learning-progress'])
    return { component:'AcademicManagementWorkspace', view:targetWindow, status:supported.has(targetWindow) ? 'Supported' : 'Unsupported academic workspace' }
  }
  if (targetKey === 'data-management') {
    const pages = new Set(['backup-dashboard','create-backup','scheduled-cloud-backups','backup-history','restore-data','data-recovery','import-data','export-data','bulk-data-import','data-validation','import-history','export-history','data-integrity-reports','duplicate-detection','integration-status'])
    return { component:'DataManagementWorkspace', view:targetWindow, status:pages.has(targetWindow)?'Supported':'Unsupported data-management view' }
  }
  if (targetKey === 'custom-reports') {
    const pages = new Set(['custom-report-builder','scheduled-reports','report-templates','report-history'])
    return { component:'CustomReportsWorkspace', view:targetWindow, status:pages.has(targetWindow)?'Supported':'Unsupported custom-report view' }
  }
  if (targetKey === 'messaging') {
    const pages = new Set(['whatsapp-integration','individual-messages','bulk-messages','class-wise-messaging','employee-notifications','message-templates','email-notifications','delivery-history','communication-logs','communication-reports','parent-communication','internal-messages','complaints-helpdesk','visitor-notifications'])
    return { component:'CommunicationWorkspace', view:targetWindow, status:pages.has(targetWindow)?'Supported':'Unsupported communication view' }
  }
  if (targetKey === 'hostel') {
    const pages = new Set(['hostel-dashboard','hostel-buildings','room-bed-register','resident-allocation','room-transfers','check-in-check-out','hostel-visitor-register','hostel-fees','accommodation-maintenance','occupancy-reports'])
    return { component:'HostelWorkspace', view:targetWindow, status:pages.has(targetWindow)?'Supported':'Unsupported hostel view' }
  }
  if(targetKey==='scheduled-reports')return {component:'ScheduledReportsWorkspace',view:targetWindow,status:targetWindow==='scheduled-reports'?'Supported':'Unsupported scheduled report view'}
  if(targetKey==='helpdesk')return {component:'HelpdeskWorkspace',view:targetWindow,status:targetWindow==='complaints-helpdesk'?'Supported':'Unsupported helpdesk view'}
  if(targetKey==='duplicate-detection')return {component:'DuplicateDetectionWorkspace',view:targetWindow,status:targetWindow==='duplicate-detection'?'Supported':'Unsupported duplicate detection view'}
  if(targetKey==='asset-lifecycle'){
    const pages=new Set(['asset-assignment','asset-transfers','asset-warranty','asset-disposal','asset-reports'])
    return {component:'AssetLifecycleWorkspace',view:targetWindow,status:pages.has(targetWindow)?'Supported':'Unsupported asset lifecycle view'}
  }
  if(targetKey==='payment-operations'){
    const pages=new Set(['online-payment-records','failed-and-pending-payments'])
    return {component:'PaymentOperationsWorkspace',view:targetWindow,status:pages.has(targetWindow)?'Supported':'Unsupported payment operations view'}
  }
  if(targetKey==='receipt-operations'){
    const pages=new Set(['receipt-templates','receipt-numbering','bulk-receipt-generation','receipt-verification'])
    return {component:'ReceiptWorkspace',view:targetWindow,status:pages.has(targetWindow)?'Supported':'Unsupported receipt view'}
  }
  if(targetKey==='library-reading'){
    const pages=new Set(['reading-records','reading-cards','student-reading-history'])
    return {component:'LibraryReadingWorkspace',view:targetWindow,status:pages.has(targetWindow)?'Supported':'Unsupported library reading view'}
  }
  if(targetKey==='cafeteria'){
    const pages=new Set(['cafeteria-dashboard','menu-price-list','daily-availability','sales-transactions','meal-plans','cafeteria-inventory','cafeteria-reports'])
    return {component:'CafeteriaWorkspace',view:targetWindow,status:pages.has(targetWindow)?'Supported':'Unsupported cafeteria view'}
  }
  if(targetKey==='procurement'){
    const pages=new Set(['supplier-directory','suppliers','purchase-records','purchase-requests','quotation-comparison','purchase-approvals','purchase-orders','goods-receipt','supplier-invoices','procurement-reports'])
    return {component:'ProcurementWorkspace',view:targetWindow,status:pages.has(targetWindow)?'Supported':'Unsupported procurement view'}
  }
  if (targetKey === 'personal') return { component:'PersonalWorkspace', view:targetWindow, status:new Set(['my-profile','account-settings','notification-settings','my-activity','help-support']).has(targetWindow)?'Supported':'Unsupported personal view' }
  if (targetKey === 'assistant') return { component:'AIAssistantWorkspace', view:targetWindow, status:targetWindow==='chat'?'Supported':'Unsupported AI assistant view' }
  if (targetKey === 'frontoffice') return { component:'FrontOfficeWorkspace', view:targetWindow, status:new Set(['enquiries','announcements','events']).has(targetWindow)?'Supported':'Unsupported front-office view' }
  if (targetKey === 'overview') return { component: 'RoleDashboard', view: 'overview', status: 'Supported' }
  if (targetKey === 'notifications') return { component: 'NotificationCenter', view: 'notifications', status: 'Supported' }
  if (targetKey === 'accounts') return { component: 'AccountsModule', view: 'accounts', status: 'Supported' }
  if (targetKey === 'files') return { component: 'FilesModule', view: 'files', status: 'Supported' }
  if (targetKey === 'profile') return { component: 'ProfileModule', view: 'profile', status: 'Supported' }
  if (targetKey === 'teachers') {
    const tabs = ['owner','admin'].includes(role) ? facultyTabs : facultyStaffTabs
    return { component: 'FacultyWorkspace', view: targetWindow, status: tabs.has(targetWindow) ? 'Supported' : 'Unsupported faculty view' }
  }
  if (targetKey === 'students') {
    const tabs = studentVisibleTabs[role] ?? studentTabs
    return { component: 'RecordModule · students', view: targetWindow, status: !studentTabs.has(targetWindow) ? 'Unknown student view' : tabs.has(targetWindow) ? 'Supported' : 'Hidden from role workspace tabs' }
  }
  if (targetKey === 'attendance') {
    return { component: 'AttendanceWorkspace', view: targetWindow, status: attendanceWindows.has(targetWindow) ? 'Supported' : 'Unsupported attendance view' }
  }
  if (targetKey === 'care') {
    const careWindows = new Set(['leave','reports','discipline','counselling','health'])
    return { component: 'Stage7CareWorkspace', view: targetWindow, status: careWindows.has(targetWindow) ? 'Supported' : 'Unsupported care view' }
  }
  if (targetKey === 'reports') {
    return { component: 'ReportsModule', view: targetWindow, status: reportTabs.has(targetWindow) ? 'Supported' : 'Unsupported reports view' }
  }
  if (targetKey === 'finance') {
    const [group, view] = targetWindow.split(':')
    const supported = financeTabs[group]
    return { component: 'FinanceWorkspace', view: group + ':' + view, status: supported?.has(view) ? 'Supported' : 'Unsupported finance view' }
  }
  if (targetKey === 'peoplehr') {
    const permitted = ['owner','admin'].includes(role) ? peopleHRTabs : role === 'teacher' ? new Set(['contracts','performance']) : new Set()
    return { component:'PeopleHRWorkspace', view:targetWindow, status:permitted.has(targetWindow) ? 'Supported' : 'Hidden from role workspace tabs' }
  }
  if (targetKey === 'payroll') {
    return { component: 'PayrollWorkspace', view: targetWindow, status: payrollTabs.has(targetWindow) ? 'Supported' : 'Unsupported payroll view' }
  }
  if (targetKey === 'governance') {
    return { component: 'GovernanceWorkspace', view: targetWindow, status: governanceTabs.has(targetWindow) ? 'Supported' : 'Unsupported governance view' }
  }
  if (targetKey === 'operations') {
    const [domain, view] = targetWindow.split(':')
    return { component: 'InstitutionOperationsWorkspace', view: domain + ':' + view, status: operationTabs[domain]?.has(view) ? 'Supported' : 'Unsupported operations view' }
  }
  if (targetKey === 'institutional') {
    const [group, item] = targetWindow.split(':')
    const key = group + ':' + item
    if (dispatcher === 'AssessmentWorkspace' && group === 'examinations') {
      const assessmentViews = new Set(['examination-programs','examination-timetable','question-bank','online-tests-and-quizzes','marks-entry','grades-and-grading-system','results-and-result-approval','report-cards','examination-reports'])
      return {component:'AssessmentWorkspace',view:item,status:assessmentViews.has(item)?'Supported':'Unsupported examination view'}
    }
    if (!getWorkspaceGroup(group) || !getWorkspaceItem(group, item)) return { component: dispatcher, view: key, status: 'Unknown institutional item' }
    if (dispatcher === 'LinkedOperationsWorkspace' && !linkedKeys.has(key)) return { component: dispatcher, view: key, status: 'Missing linked-workspace dispatch key' }
    if (dispatcher === 'LinkedOperationsWorkspace' && linkedKeys.has(key)) return { component: dispatcher, view: key, status: 'Supported' }
    return { component: dispatcher, view: key, status: 'Supported destination; lifecycle pending' }
  }
  if (targetKey.startsWith('admin:')) {
    const key = targetKey.slice('admin:'.length)
    return { component: 'AdministrationModule', view: key, status: adminKeys.has(key) ? 'Supported' : 'Unsupported administration key' }
  }
  const module = modulesForRole(role).find(item => item.key === targetKey)
  if (module) {
    const config = operationalWorkspaceConfigs[targetKey]
    if (config) return { component: 'RecordModule · ' + targetKey, view: targetWindow, status: config.views.some(item => item.key === targetWindow) ? 'Supported' : 'Unsupported record-module view' }
    return { component: 'RecordModule · ' + targetKey, view: targetWindow, status: moduleWindow ? 'Module has no named sub-view contract' : 'Supported default module view' }
  }
  return { component: dispatcher, view: targetWindow, status: 'No role-accessible module dispatch found' }
}

const rows = []
const totals = { roles: roles.length, destinations: 0, supported: 0, unavailable: 0, pending: 0, issues: 0 }
const roleSummary = {}
for (const [role, label] of roles) {
  const groups = roleNavigationGroups(role)
  const summary = { groups: groups.length, destinations: 0, supported: 0, unavailable: 0, pending: 0, issues: 0 }
  roleSummary[role] = summary
  for (const group of groups) {
    for (const labelText of group.items) {
      const route = getNavigationRoute(group.key, labelText, role)
      const dashboard = shellTarget(route)
      const dispatcher = route.startsWith('unavailable:') ? 'WorkspaceUnavailable'
        : route.startsWith('institutional:') ? (route.startsWith('institutional:examinations:') ? 'AssessmentWorkspace' : linkedKeys.has(route.slice('institutional:'.length)) ? 'LinkedOperationsWorkspace' : 'InstitutionalWorkspace')
        : dashboard.targetKey === 'academic' ? 'AcademicManagementWorkspace'
        : dashboard.targetKey === 'overview' ? 'RoleDashboard'
        : dashboard.targetKey === 'notifications' ? 'NotificationCenter'
        : dashboard.targetKey === 'accounts' ? 'AccountsModule'
        : dashboard.targetKey === 'files' ? 'FilesModule'
        : dashboard.targetKey === 'profile' ? 'ProfileModule'
        : dashboard.targetKey === 'teachers' ? 'FacultyWorkspace'
        : dashboard.targetKey === 'students' ? 'RecordModule · students'
        : dashboard.targetKey === 'attendance' ? 'AttendanceWorkspace'
        : dashboard.targetKey === 'care' ? 'Stage7CareWorkspace'
        : dashboard.targetKey === 'reports' ? 'ReportsModule'
        : dashboard.targetKey === 'finance' ? 'FinanceWorkspace'
        : dashboard.targetKey === 'payroll' ? 'PayrollWorkspace'
        : dashboard.targetKey === 'peoplehr' ? 'PeopleHRWorkspace'
        : dashboard.targetKey === 'data-management' ? 'DataManagementWorkspace'
        : dashboard.targetKey === 'custom-reports' ? 'CustomReportsWorkspace'
        : dashboard.targetKey === 'messaging' ? 'CommunicationWorkspace'
        : dashboard.targetKey === 'hostel' ? 'HostelWorkspace'
        : dashboard.targetKey === 'procurement' ? 'ProcurementWorkspace'
        : dashboard.targetKey === 'cafeteria' ? 'CafeteriaWorkspace'
        : dashboard.targetKey === 'library-reading' ? 'LibraryReadingWorkspace'
        : dashboard.targetKey === 'receipt-operations' ? 'ReceiptWorkspace'
        : dashboard.targetKey === 'payment-operations' ? 'PaymentOperationsWorkspace'
        : dashboard.targetKey === 'asset-lifecycle' ? 'AssetLifecycleWorkspace'
        : dashboard.targetKey === 'scheduled-reports' ? 'ScheduledReportsWorkspace'
        : dashboard.targetKey === 'helpdesk' ? 'HelpdeskWorkspace'
        : dashboard.targetKey === 'duplicate-detection' ? 'DuplicateDetectionWorkspace'
        : dashboard.targetKey === 'personal' ? 'PersonalWorkspace'
        : dashboard.targetKey === 'assistant' ? 'AIAssistantWorkspace'
        : dashboard.targetKey === 'frontoffice' ? 'FrontOfficeWorkspace'
        : dashboard.targetKey === 'governance' ? 'GovernanceWorkspace'
        : dashboard.targetKey === 'operations' ? 'InstitutionOperationsWorkspace'
        : dashboard.targetKey.startsWith('admin:') ? 'AdministrationModule'
        : 'RecordModule · ' + dashboard.targetKey
      const resolved = checkView(role, route, dispatcher)
      const status = resolved.status
      summary.destinations += 1; totals.destinations += 1
      if (status === 'Expected unavailable state') { summary.unavailable += 1; totals.unavailable += 1 }
      else if (status.includes('pending')) { summary.pending += 1; totals.pending += 1 }
      else if (status === 'Supported') { summary.supported += 1; totals.supported += 1 }
      else { summary.issues += 1; totals.issues += 1 }
      rows.push({ role, roleLabel: label, group: group.key, groupLabel: group.label, item: labelText, route, component: resolved.component, view: resolved.view, status })
    }
  }
}

const md = []
md.push('# Phase 1 — Role-aware route-to-view compatibility audit')
md.push('')
md.push('**Generated:** by the repository source verifier during GitHub Actions  ')
md.push('**Sources:** route resolver, role menu filter, Dashboard dispatcher, workspace view contracts and module role grants')
md.push('')
md.push('## Evidence boundary')
md.push('')
md.push('This audit runs every menu entry visible to a role through the exact route resolver, mirrors the Dashboard shell target and workspace-component dispatch, then checks the requested sub-view against the component view contract and that role’s internal tab visibility. It is source-level compatibility evidence only; it does not prove API/RLS permissions, saved data, or a successful browser workflow.')
md.push('')
md.push('## Summary by role')
md.push('')
md.push('| Role | Visible groups | Destinations | Supported sub-views | Explicitly unavailable | Lifecycle pending | Compatibility issues |')
md.push('|---|---:|---:|---:|---:|---:|---:|')
for (const [role, label] of roles) {
  const s = roleSummary[role]
  md.push(`| ${label} | ${s.groups} | ${s.destinations} | ${s.supported} | ${s.unavailable} | ${s.pending} | ${s.issues} |`)
}
md.push('')
md.push(`**Total evaluations:** ${totals.destinations}. **Supported views:** ${totals.supported}. **Unavailable destinations:** ${totals.unavailable}. **Lifecycle acceptance pending:** ${totals.pending}. **Compatibility issues:** ${totals.issues}.`)
md.push('')
md.push('## Compatibility exceptions')
md.push('')
md.push('| Role | Menu group | Menu item | Exact route | Dashboard component | Requested view | Finding |')
md.push('|---|---|---|---|---|---|---|')
for (const row of rows.filter(item => !['Supported','Expected unavailable state','Supported destination; lifecycle pending'].includes(item.status))) {
  md.push(`| ${row.roleLabel} | ${row.group} | ${row.item.replaceAll('|','\\|')} | \`${row.route}\` | ${row.component} | ${row.view} | ${row.status} |`)
}
md.push('')
md.push('## Per-role view matrix')
for (const [role, label] of roles) {
  md.push('')
  md.push(`### ${label}`)
  md.push('')
  md.push('| Menu group | Item | Route | Component | Requested view | Compatibility |')
  md.push('|---|---|---|---|---|---|')
  for (const row of rows.filter(item => item.role === role)) {
    md.push(`| ${row.group} | ${row.item.replaceAll('|','\\|')} | \`${row.route}\` | ${row.component} | ${row.view} | ${row.status} |`)
  }
}
md.push('')
md.push('## Acceptance still required')
md.push('')
md.push('- Render each route in a signed-in browser session and verify the selected view and page heading.')
md.push('- Confirm all role-specific tab labels match the destination name and user permission scope.')
md.push('- Verify no denied direct route can be used to bypass the menu filter.')
md.push('- Test every destination against a populated, empty, loading and error-state institution account.')
md.push('- Test tenant-scoped reads and writes; this audit does not replace RLS or workflow E2E.')
md.push('')

const output = path.join(root, 'docs/PHASE_1_ROUTE_VIEW_AUDIT.md')
fs.writeFileSync(output, md.join('\n'), 'utf8')
console.log(`Generated ${path.relative(root, output)}: ${totals.destinations} role-aware route-to-view evaluations; ${totals.supported} supported; ${totals.unavailable} unavailable; ${totals.pending} lifecycle pending; ${totals.issues} compatibility issues.`)
for (const row of rows.filter(item => !['Supported','Expected unavailable state','Supported destination; lifecycle pending'].includes(item.status))) {
  console.error(`VIEW ISSUE | ${row.role} | ${row.group}/${row.item} | ${row.route} | ${row.component} | ${row.view} | ${row.status}`)
}
if (totals.issues > 0) process.exitCode = 1
