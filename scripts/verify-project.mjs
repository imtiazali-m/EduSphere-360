import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const check = (label, fn) => {
  try { fn(); console.log(`PASS  ${label}`) }
  catch (error) { console.error(`FAIL  ${label}: ${error.message}`); process.exitCode = 1 }
}

const packageJson = JSON.parse(read('package.json'))
check('External provider centre exposes AI, biometric, messaging, design and online-class integration workspaces', () => {
  const integrations = read('src/components/IntegrationManagementWorkspace.tsx')
  const dashboard = read('src/components/Dashboard.tsx')
  for (const key of ["'ai-providers'", "biometric:", "whatsapp:", "canva:", "'google-classroom':", "zoom:", "youtube:"]) {
    assert.ok(integrations.includes(key), 'Missing integration workspace: ' + key)
  }
  assert.ok(integrations.includes("action:'status'") && integrations.includes("action:'generate'"), 'AI credentials need a live status and provider test')
  assert.ok(integrations.includes('Not connected') && integrations.includes('setup required'), 'External integrations must remain unconnected until verified')
  for (const key of ['WHATSAPP_ACCESS_TOKEN','CANVA_CLIENT_ID','GOOGLE_CLIENT_ID','ZOOM_CLIENT_ID','YOUTUBE_API_KEY']) {
    assert.ok(integrations.includes(key), 'Missing server-side integration prerequisite: ' + key)
  }
  assert.ok(dashboard.includes('<IntegrationManagementWorkspace'), 'Dashboard must dispatch the Integration workspace')
  assert.ok(dashboard.includes('<NativeCallingWorkspace'), 'Native calling and online classes must be dispatched by EduSphere')
})
check('Behaviour and Skills has distinct database-backed pages and record workflows', () => {
  const behaviour = read('src/components/BehaviourSkillsWorkspace.tsx')
  const dashboard = read('src/components/Dashboard.tsx')
  for (const view of ['dashboard','records','positive','incidents','recognition','warnings','skills','activities','competencies','progress','analytics','downloads']) {
    assert.ok(behaviour.includes(view + ':'), 'Missing Behaviour & Skills view: ' + view)
  }
  for (const table of ['student_behaviour_events','student_competency_records','classroom_activities']) {
    assert.ok(behaviour.includes(table), 'Missing connected records table: ' + table)
  }
  assert.ok(behaviour.includes('student_care_access'), 'Teacher access must follow the care-area permission grant')
  assert.ok(dashboard.includes('<BehaviourSkillsWorkspace'), 'Dashboard must dispatch the Behaviour & Skills workspace')
})
check('Dedicated operational submenus dispatch to institution-scoped workspace components', () => {
  const dashboard = read('src/components/Dashboard.tsx')
  const routes = read('src/lib/navigationRoutes.ts')
  const contracts = [
    ['data-management','DataManagementWorkspace','src/components/DataManagementWorkspace.tsx'],
    ['custom-reports','CustomReportsWorkspace','src/components/CustomReportsWorkspace.tsx'],
    ['messaging','CommunicationWorkspace','src/components/CommunicationWorkspace.tsx'],
    ['hostel','HostelWorkspace','src/components/HostelWorkspace.tsx'],
    ['procurement','ProcurementWorkspace','src/components/ProcurementWorkspace.tsx'],
    ['cafeteria','CafeteriaWorkspace','src/components/CafeteriaWorkspace.tsx'],
    ['library-reading','LibraryReadingWorkspace','src/components/LibraryReadingWorkspace.tsx'],
    ['receipt-operations','ReceiptWorkspace','src/components/ReceiptWorkspace.tsx'],
    ['payment-operations','PaymentOperationsWorkspace','src/components/PaymentOperationsWorkspace.tsx'],
    ['asset-lifecycle','AssetLifecycleWorkspace','src/components/AssetLifecycleWorkspace.tsx'],
    ['scheduled-reports','ScheduledReportsWorkspace','src/components/ScheduledReportsWorkspace.tsx'],
    ['helpdesk','HelpdeskWorkspace','src/components/HelpdeskWorkspace.tsx'],
    ['duplicate-detection','DuplicateDetectionWorkspace','src/components/DuplicateDetectionWorkspace.tsx'],
    ['certificate-forms','CertificateFormsWorkspace','src/components/CertificateFormsWorkspace.tsx'],
    ['transport-attendance','TransportAttendanceWorkspace','src/components/TransportAttendanceWorkspace.tsx'],
  ]
  for (const [prefix, component, file] of contracts) {
    assert.ok(dashboard.includes("tab.targetKey === '" + prefix + "'"), 'Missing Dashboard route dispatch: ' + prefix)
    assert.ok(dashboard.includes('<' + component), 'Missing workspace component render: ' + component)
    assert.ok(routes.includes("'" + prefix + ":'"), 'Missing route family mapping: ' + prefix)
    const source = read(file)
    assert.ok(source.includes('institution_id') || source.includes('listRecords') || source.includes('createRecord'), file + ' must use institution-scoped data services')
    assert.ok(source.includes('onToast('), file + ' must surface user-facing success or error feedback')
  }
  const operations = read('src/components/InstitutionOperationsWorkspace.tsx')
  for (const view of ['templates','bulk','approvals','notifications','reservations','reports']) {
    assert.ok(operations.includes("view === '" + view + "'") || operations.includes("view==='" + view + "'"), 'Missing operations submenu view: ' + view)
  }
  assert.ok(operations.includes('approve_facility_room_reservation'), 'Room reservation approval must use the conflict-checking database RPC')
  assert.ok(operations.includes('Generate draft certificates'), 'Bulk certificates must remain drafts until authorised review')
})
check('Examination and class-test pages dispatch to the dedicated assessment lifecycle', () => {
  const dashboard = read('src/components/Dashboard.tsx')
  const assessment = read('src/components/AssessmentWorkspace.tsx')
  const audit = read('scripts/generate-route-view-audit.mjs')
  assert.ok(dashboard.includes("tab.targetKey === 'institutional' && tab.targetWindow.startsWith('examinations:')"), 'Examination routes must use the dedicated AssessmentWorkspace dispatcher')
  assert.ok(dashboard.includes('<AssessmentWorkspace workspaceKey={tab.targetWindow} onToast={onToast}/>'), 'AssessmentWorkspace must be rendered for examination route destinations')
  for (const table of ['exams','exam_results','question_bank_items','online_assessments','online_assessment_attempts','examination_grade_bands','examination_assessment_weights','examination_assessment_rubrics']) {
    assert.ok(assessment.includes("from('"+table+"')"), 'AssessmentWorkspace is missing institution-scoped '+table+' workflow')
  }
  for (const action of ['saveExam','deleteExam','saveQuestion','saveMarks','createAssessment']) {
    assert.ok(assessment.includes('function '+action+'('), 'AssessmentWorkspace is missing '+action+' operation')
  }
  assert.ok(assessment.includes('eq(\'institution_id\',user.institutionId)'), 'Assessment operations must scope database reads/writes to the active institution')
  assert.ok(audit.includes("targetWindow.startsWith('examinations:') ? 'AssessmentWorkspace'"), 'Route-view audit must match Dashboard examination dispatch')
  assert.ok(audit.includes("component: 'AssessmentWorkspace'"), 'Assessment destinations must be classified as the actual assessment workspace')
})
check('Library catalogue, circulation and learning resources use dedicated tenant-scoped workflows', () => {
  const dashboard = read('src/components/Dashboard.tsx')
  const library = read('src/components/LibraryManagementWorkspace.tsx')
  const linked = read('src/components/LinkedOperationsWorkspace.tsx')
  const audit = read('scripts/generate-route-view-audit.mjs')
  assert.ok(dashboard.includes("tab.targetKey === 'institutional' && tab.targetWindow.startsWith('library:')"), 'Library catalogue routes must dispatch to the dedicated library manager')
  assert.ok(dashboard.includes('<LibraryManagementWorkspace workspaceKey={tab.targetWindow} onToast={onToast} onNavigate={navigateChild}/>'), 'Library manager must receive workspace navigation and toast handlers')
  for (const type of ['book-registration','book-category','digital-resource','learning-material','resource-download']) {
    assert.ok(library.includes("'" + type + "'"), 'Library manager is missing record type ' + type)
  }
  for (const operation of ['institutional_records','library_loans','created_by:user.id','updated_by:user.id','deleteRecord','saveRecord']) {
    assert.ok(library.includes(operation), 'Library manager is missing tenant-scoped persistence guard ' + operation)
  }
  assert.ok(library.includes(".eq('institution_id',user.institutionId)") && library.includes(".eq('module_key','library')"), 'Library catalogue queries must remain institution- and module-scoped')
  assert.ok(library.includes("['owner','admin'].includes(user.role)"), 'Only institution owners and administrators may modify the catalogue')
  assert.ok(library.includes('validWebUrl'), 'Digital resource links must be validated before publication')
  assert.ok(linked.includes("rpc('issue_library_book'") && linked.includes("rpc('return_library_book'"), 'Book issue and return must remain on the transactional library RPCs')
  assert.ok(audit.includes("component: 'LibraryManagementWorkspace'") && audit.includes("'book-issue-and-returns','library-reports'"), 'Route-view audit must recognise the library manager and linked circulation workflows')
})
check('Transport fleet, route, history and fee workflows are tenant-scoped', () => {
  const dashboard = read('src/components/Dashboard.tsx')
  const transport = read('src/components/TransportManagementWorkspace.tsx')
  const linked = read('src/components/LinkedOperationsWorkspace.tsx')
  const audit = read('scripts/generate-route-view-audit.mjs')
  assert.ok(dashboard.includes("tab.targetWindow.startsWith('transport:')") && dashboard.includes('<TransportManagementWorkspace workspaceKey={tab.targetWindow} onToast={onToast} onNavigate={navigateChild}/>'), 'Transport fleet and fees must use the dedicated transport dispatcher')
  for (const table of ['institutional_records','student_transport_allocations','student_transport_fee_charges','student_transport_fee_payments','transport_attendance_events']) {
    assert.ok(transport.includes("from('" + table + "')"), 'Transport workspace is missing ' + table)
  }
  for (const rpc of ['create_student_transport_fee_charge','record_student_transport_fee_payment']) {
    assert.ok(transport.includes("rpc('" + rpc + "'"), 'Transport fees must use the database transaction ' + rpc)
  }
  for (const recordType of ['vehicle-management','drivers-management','transport-routes','route-stops','vehicle-maintenance']) {
    assert.ok(transport.includes("'" + recordType + "'"), 'Transport workspace is missing ' + recordType)
  }
  assert.ok(transport.includes(".eq('institution_id',user.institutionId)") && transport.includes("module_key:'transport'"), 'Transport fleet reads and writes must be institution-scoped')
  assert.ok(transport.includes("['owner','admin'].includes(user.role)") && transport.includes("['owner','admin','accountant'].includes(user.role)"), 'Fleet administration and transport finance must enforce distinct role boundaries')
  assert.ok(linked.includes("rpc('create_student_transport_allocation'") && linked.includes("rpc('end_student_transport_allocation'"), 'Student transport allocation must keep server-side date and vehicle-capacity checks')
  assert.ok(audit.includes("component: 'TransportManagementWorkspace'"), 'Route audit must map transport fleet pages to their real workspace')
})
check('Inventory catalogue and category CRUD preserve the movement ledger', () => {
  const dashboard = read('src/components/Dashboard.tsx')
  const inventory = read('src/components/InventoryManagementWorkspace.tsx')
  const linked = read('src/components/LinkedOperationsWorkspace.tsx')
  const audit = read('scripts/generate-route-view-audit.mjs')
  assert.ok(dashboard.includes("tab.targetWindow.startsWith('inventory:')") && dashboard.includes('<InventoryManagementWorkspace workspaceKey={tab.targetWindow} onToast={onToast} onNavigate={navigateChild}/>'), 'Inventory catalogue routes must use the dedicated manager')
  assert.ok(inventory.includes("from('inventory_movements')") && inventory.includes("from('institutional_records')"), 'Inventory catalogue and movement data must be read from the existing tenant schema')
  assert.ok(inventory.includes("record_type:'item-catalogue'") && inventory.includes("record_type:'item-category'"), 'Inventory catalogue must support items and categories')
  assert.ok(inventory.includes("['owner','admin','accountant'].includes(user.role)") && inventory.includes("['owner','admin'].includes(user.role)"), 'Inventory edit and delete roles must follow existing database policies')
  assert.ok(inventory.includes('movementMap.get(editing.id)?.length') && inventory.includes('Opening stock was preserved'), 'Opening stock cannot be rewritten after an item has ledger history')
  assert.ok(linked.includes("rpc('record_inventory_movement'"), 'Stock adjustments must remain on the protected inventory movement RPC')
  assert.ok(audit.includes("component: 'InventoryManagementWorkspace'"), 'Route audit must map inventory catalogue pages to their real workspace')
})
check('Campus management uses the existing relational campus register', () => {
  const linked = read('src/components/LinkedOperationsWorkspace.tsx')
  const audit = read('scripts/generate-route-view-audit.mjs')
  assert.ok(linked.includes("supabase.from('campuses')") && linked.includes('async function saveCampus'), 'Campus management must keep its dedicated CRUD flow')
  assert.ok(linked.includes("['owner','admin'].includes(user.role)"), 'Campus administration must be owner/admin controlled')
  assert.ok(audit.includes("targetWindow === 'administration:campus-and-branch-management'"), 'Campus management audit classification must match its actual workspace')
})
check('Leave applications, approvals, balances and reporting have separate role-scoped workflows', () => {
  const care = read('src/components/Stage7CareWorkspace.tsx')
  const routes = read('src/lib/navigationRoutes.ts')
  const access = read('src/lib/navigationCatalog.ts')
  for (const view of ['leave-applications','leave-approvals','leave-balances','leave-reports']) {
    assert.ok(care.includes("activeWindow==='" + view + "'"), 'Missing leave workspace view: ' + view)
    assert.ok(routes.includes("'"+view+"':'care:"+view+"'"), 'Missing leave route: ' + view)
  }
  assert.ok(care.includes("user?.role==='teacher'?employees.filter(employee=>employee.user_id===user.id):employees"), 'Teachers must apply only for their own employee profile')
  assert.ok(care.includes("if(!supabase||!user||!isAdmin)return"), 'Only owners and administrators can review leave')
  assert.ok(care.includes("if(!supabase||!user||!isAdmin||!balancePerson)return"), 'Only owners and administrators can change leave entitlements')
  assert.ok(care.includes('overlapDays(row.start_date,row.end_date,leavePeriodRange.from,leavePeriodRange.to)'), 'Leave reporting must count only days overlapping the selected reporting period')
  assert.ok(access.includes("student:['Student Attendance','Leave Applications'"), 'Students must receive leave self-service without approval controls')
  assert.ok(access.includes("parent:['Student Attendance','Leave Applications'"), 'Parents must receive linked-child leave self-service without approval controls')
})
check('Formal fee receipts are issued through the secured ledger and can be retried or printed', () => {
  const dataLayer = read('src/lib/data.ts')
  const finance = read('src/components/FinanceWorkspace.tsx')
  const migration = read('supabase/migrations/20261113092730_fee_receipt_issuance_and_numbering.sql')
  assert.ok(dataLayer.includes('export async function issueFeeReceipt'), 'Missing authenticated fee receipt issuance helper')
  assert.ok(dataLayer.includes(".rpc('issue_fee_receipt'"), 'Formal receipt helper must call the database receipt issuer')
  assert.ok(dataLayer.includes("['owner', 'admin', 'accountant']"), 'Only finance-authorised roles may issue formal receipts')
  assert.ok(finance.includes("issueFeeReceipt(mode,user!,{paymentId:result.payment_id,templateKey:'default'})"), 'Payment recording must attempt formal receipt issuance')
  assert.ok(finance.includes('Open Receipt Register to retry'), 'A receipt issuance failure must not hide a recorded payment and must offer a retry path')
  assert.ok(finance.includes("supabase.from('fee_receipt_ledger')"), 'Receipt register must load official ledger rows')
  assert.ok(finance.includes('function printReceipt(') && finance.includes('Print receipt'), 'Official receipts must be printable from the ledger')
  assert.ok(migration.includes('create table if not exists public.fee_receipt_ledger'), 'Receipt ledger schema must exist in migrations')
})
check('Identity cards and certificates generate QR codes locally without sending identifiers to third-party QR services', () => {
  const qr = read('src/components/LocalQrCode.tsx')
  const attendance = read('src/components/AttendanceWorkspace.tsx')
  const operations = read('src/components/InstitutionOperationsWorkspace.tsx')
  const index = read('index.html')
  assert.ok(index.includes('/vendor/qrcode.min.js'), 'Bundled QR generator must load from the college application')
  assert.ok(qr.includes('new QRCode(host') && qr.includes('value.trim()'), 'Visible QR previews must be generated in the browser')
  assert.ok(attendance.includes('<LocalQrCode') && attendance.includes('data-qr-value=') && attendance.includes('/vendor/qrcode.min.js'), 'Attendance cards and print sheets must use the local QR generator')
  assert.ok(operations.includes('<LocalQrCode') && operations.includes('certificate-qr-code') && operations.includes('data-qr-value='), 'Student ID cards and certificates must use local QR generation')
  assert.ok(!attendance.includes('api.qrserver.com') && !operations.includes('api.qrserver.com'), 'Student and staff identifiers must not be sent to an external QR-image service')
})
check('Vite development and production scripts exist', () => {
  assert.equal(packageJson.scripts.dev, 'vite --host 0.0.0.0')
  assert.equal(packageJson.scripts.build, 'tsc -b && vite build')
  assert.equal(packageJson.scripts.typecheck, 'tsc -b --pretty')
  assert.equal(packageJson.scripts['audit:navigation'], 'node scripts/generate-navigation-route-audit.mjs')
  assert.equal(packageJson.scripts['audit:route-views'], 'node scripts/generate-route-view-audit.mjs')
  assert.equal(packageJson.scripts['audit:responsive'], 'node scripts/generate-responsive-source-audit.mjs')
  assert.equal(packageJson.scripts['test:responsive:public'], 'node scripts/test-responsive-public.mjs')
  assert.equal(packageJson.scripts['test:workspace-privacy'], 'node scripts/test-workspace-privacy.mjs')
  assert.equal(packageJson.scripts['test:display-preferences'], 'node --test scripts/test-display-preferences.mjs')
  assert.equal(packageJson.scripts['test:online-session-security'], 'node scripts/test-online-session-security.mjs')
  assert.equal(packageJson.scripts['test:ai-free-provider'], 'node scripts/test-ai-free-provider.mjs')
})

const requiredFiles = [
  'src/styles/clean-blue-workspace-system.css',
  'src/components/AssetLifecycleWorkspace.tsx',
  'src/components/CafeteriaWorkspace.tsx',
  'src/components/CertificateFormsWorkspace.tsx',
  'src/components/CommunicationWorkspace.tsx',
  'src/components/CustomReportsWorkspace.tsx',
  'src/components/DataManagementWorkspace.tsx',
  'src/components/DuplicateDetectionWorkspace.tsx',
  'src/components/HelpdeskWorkspace.tsx',
  'src/components/HostelWorkspace.tsx',
  'src/components/LibraryReadingWorkspace.tsx',
  'src/components/PaymentOperationsWorkspace.tsx',
  'src/components/ProcurementWorkspace.tsx',
  'src/components/ReceiptWorkspace.tsx',
  'src/components/ScheduledReportsWorkspace.tsx',
  'src/components/TransportAttendanceWorkspace.tsx',
  'src/styles/data-management.css',
  'src/styles/library-reading.css',
  'index.html', 'src/main.tsx', 'src/App.tsx', 'src/components/Dashboard.tsx', 'src/components/RoleDashboard.tsx', 'src/components/role-dashboard.css', 'src/components/WorkspaceUnavailable.tsx', 'src/components/BackupDataWorkspace.tsx', 'src/components/backup-data-workspace.css', 'src/components/IntegrationManagementWorkspace.tsx', 'src/styles/integrations-workspace.css', 'src/components/LocalQrCode.tsx', 'src/styles/local-qr.css', 'public/vendor/qrcode.min.js', 'public/vendor/qrcodejs.LICENSE.txt', 'src/styles/premium-institutional-theme.css', 'src/components/BehaviourSkillsWorkspace.tsx', 'src/styles/behaviour-skills-workspace.css',
  'src/components/FinanceWorkspace.tsx', 'src/styles/finance-workspace.css', 'src/styles/student-promotion-workspace.css', 'src/styles/navigation-refinement.css',
  'src/components/PayrollWorkspace.tsx', 'src/styles/payroll-workspace.css',
  'src/components/GovernanceWorkspace.tsx', 'src/components/AdministrationStage5Workspace.tsx', 'src/components/PeopleHRWorkspace.tsx', 'src/components/EmployeeQualificationsPanel.tsx', 'src/styles/people-hr-workspace.css', 'src/styles/governance-workspace.css',
  'src/components/InstitutionOperationsWorkspace.tsx', 'src/styles/institution-operations.css',
  'src/components/AcademicManagementWorkspace.tsx', 'src/styles/academic-management.css',
  'src/components/NativeCallingWorkspace.tsx', 'src/styles/native-calling-workspace.css', 'scripts/test-ai-free-provider.mjs', 'docs/FREE_AI_SETUP.md', 'infra/livekit/README.md', 'scripts/test-online-session-security.mjs', 'supabase/functions/online-session-control/index.ts', 'supabase/migrations/20261115070000_native_online_sessions_calling.sql', 'supabase/migrations/20261115080000_native_online_sessions_realtime_and_link_guards.sql', 'supabase/migrations/20261115100000_native_online_session_public_grants_lockdown.sql', 'supabase/migrations/20261115110000_online_session_attendance_reconnect_fix.sql', 'supabase/migrations/20261115120000_guardian_online_class_observer_access.sql',
  'src/components/AuthScreens.tsx', 'src/components/AdministrationModule.tsx',
  'src/components/RecordModule.tsx', 'src/components/FacultyWorkspace.tsx', 'src/styles/faculty-workspace.css', 'src/components/ReportsModule.tsx', 'src/components/ProfileModule.tsx', 'src/components/PersonalWorkspace.tsx', 'src/components/AIAssistantWorkspace.tsx', 'src/components/FrontOfficeWorkspace.tsx', 'src/styles/front-office-workspace.css', 'src/context/AuthContext.tsx', 'src/lib/auth.ts',
  'src/lib/data.ts', 'src/lib/workspacePrivacy.js', 'src/lib/workspacePrivacy.d.ts', 'scripts/test-workspace-privacy.mjs', '.github/workflows/workspace-family-privacy.yml', 'docs/WORKSPACE_ROLE_PRIVACY.md', 'src/lib/displayPreferences.js', 'src/lib/displayPreferences.d.ts', 'src/styles/dashboard-display-settings.css', 'scripts/test-display-preferences.mjs', '.github/workflows/dashboard-display-preferences.yml', 'docs/STAGE_4_DASHBOARD_DISPLAY_MODES.md', 'src/lib/navigationAccess.ts', 'src/lib/userErrors.ts', 'scripts/test-user-errors.mjs',
  'src/lib/finance.ts', 'scripts/test-finance.mjs', 'src/lib/fileAccess.ts', 'scripts/test-file-access.mjs',
  'scripts/test-account-provisioning.mjs', 'supabase/functions/create-user/index.ts', 'supabase/functions/create-user/provisioning-guards.mjs', '.github/workflows/teacher-account-provisioning.yml', 'docs/TEACHER_ACCOUNT_LINK_INTEGRITY.md',
  'src/lib/navigationCatalog.ts', 'src/lib/navigationRoutes.ts', 'scripts/generate-navigation-route-audit.mjs', 'scripts/generate-route-view-audit.mjs', 'scripts/generate-responsive-source-audit.mjs', 'docs/PHASE_1_EXACT_ROUTE_AUDIT.md', 'docs/PHASE_1_ROUTE_VIEW_AUDIT.md', 'docs/PHASE_2_RESPONSIVE_SOURCE_AUDIT.md', 'src/components/NotificationCenter.tsx', 'src/styles/notification-center.css', 'public/_redirects', 'scripts/test-responsive-public.mjs', 'docs/PUBLIC_RESPONSIVE_QA.md',
  'supabase/migrations/20261109125937_announcement_read_receipts.sql',
  'supabase/migrations/20261109150048_finance_accounting_and_payroll_workflows.sql',
  'supabase/migrations/20261109150654_atomic_employee_salary_profile_workflow.sql',
  'supabase/migrations/20261109150857_employee_own_payroll_run_read.sql',
  'supabase/migrations/20261109151231_atomic_institution_setting_approval.sql',
  'supabase/migrations/20261109153658_academic_studentcare_and_campus_operations.sql',
  'supabase/migrations/20261109155028_question_paper_approval_and_line_removal.sql',
  'docs/EDUSPHERE_360_BENCHMARK_AND_GAP_REVIEW.md',
  '.env.example', 'package-lock.json', 'src/lib/types.ts', 'supabase/migrations/20261108053651_owner_signup_institution_details.sql', 'supabase/migrations/20261109085154_faculty_employee_management.sql', 'supabase/migrations/20261109092734_student_management_operations.sql',
  'supabase/migrations/20261114033957_guard_student_admission_status_transitions.sql', 'supabase/migrations/20261109092920_student_management_scope_indexes_and_guardian_portal_read.sql',
  '.github/workflows/cloudflare-pages-release.yml', 'docs/FINAL_REBUILD_STAGE.md', 'docs/NAVIGATION_RECONCILIATION.md',
]
check('Integrated frontend, authentication, modules and deployment files exist', () => {
  for (const file of requiredFiles) assert.ok(fs.existsSync(path.join(root, file)), `${file} is missing`)
})

const dashboardNavigationSource = read('src/components/Dashboard.tsx')
check('Sidebar highlights only the exact selected submenu', () => {
  assert.ok(dashboardNavigationSource.includes('const isActive = activeNavigationTab.groupKey === group.key && activeNavigationTab.itemKey === itemKey'))
  assert.ok(!dashboardNavigationSource.includes('const isActive = activeTab.route === route ||'))
})

const require = createRequire(import.meta.url)
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  module._compile(output, filename)
}

const { navigationCatalog } = require(path.join(root, 'src/lib/navigationCatalog.ts'))
const { navigationRoutes, getNavigationRoute } = require(path.join(root, 'src/lib/navigationRoutes.ts'))
const { roleNavigationGroups, roleNavigationSections, navigationSectionDefinitions } = require(path.join(root, 'src/lib/navigationAccess.ts'))
const { institutionalMenu } = require(path.join(root, 'src/lib/institutionalCatalog.ts'))
const { modules, modulesForRole } = require(path.join(root, 'src/lib/modules.ts'))
const roles = ['owner', 'admin', 'teacher', 'student', 'parent', 'accountant', 'exam_officer']

check('Transport attendance visibility follows staff-only event-table permissions', () => {
  const source = read('src/lib/navigationCatalog.ts')
  const start = source.indexOf('  transport:{')
  const end = source.indexOf('  reports:{', start)
  assert.ok(start >= 0 && end > start, 'Transport role menu allowlist is missing')
  const transportRoles = source.slice(start, end)
  const student = transportRoles.match(/student:\[([^\]]*)\]/)
  const parent = transportRoles.match(/parent:\[([^\]]*)\]/)
  const teacher = transportRoles.match(/teacher:\[([^\]]*)\]/)
  assert.ok(student && !student[1].includes('Transport Attendance'), 'Students must not be shown the staff-only transport attendance register')
  assert.ok(parent && !parent[1].includes('Transport Attendance'), 'Parents must not be shown the staff-only transport attendance register')
  assert.ok(teacher && teacher[1].includes('Transport Attendance'), 'Teachers must retain access to their permitted transport attendance register')
  const route = read('src/lib/navigationRoutes.ts')
  assert.ok(route.includes("['owner','admin','teacher'].includes(actorRole)"), 'Transport attendance route guard must match event-table RLS roles')
})
check('The full institutional menu maps every submenu to a working destination', () => {
  assert.equal(navigationCatalog.length, 25, 'The visible sidebar contains 25 main workspaces after Administration and academic consolidation')
  const groupKeys = new Set(navigationCatalog.map(group => group.key))
  assert.equal(groupKeys.size, 25, 'Visible main workspace keys must be unique')
  for (const group of navigationCatalog) {
    assert.ok(group.items.length > 0 || group.key === 'dashboard', group.label + ' must have its own operational submenus unless it is the direct Dashboard link')
    for (const page of group.items) assert.ok(navigationRoutes[page], 'No route is connected for ' + group.label + '/' + page)
  }
  assert.equal(navigationCatalog.find(group=>group.key==='dashboard')?.items.length,0,'Dashboard must open directly without an Institute Overview submenu')
  assert.equal(getNavigationRoute('dashboard','Dashboard','owner'),'overview','Dashboard must route to the dashboard page itself')
  for (const group of institutionalMenu) {
    for (const item of group.items) assert.ok(navigationRoutes[item.label], 'No route is connected for ' + group.label + '/' + item.label)
  }
  for (const required of ['academic-management','question-bank','library','transport','inventory','facilities','visitors','reconciliation','backup']) {
    assert.ok(groupKeys.has(required), 'Missing expansion workspace: ' + required)
  }
  for (const required of ['attendance','people-hr','accounts-finance','fees','payments','receipts','examinations','class-tests','reports']) {
    assert.ok(groupKeys.has(required), 'Missing core institution workspace: ' + required)
  }
  assert.ok(institutionalMenu.length === 32, 'Full route catalogue must preserve all 34 source groups')
  const menuDestinationCount = institutionalMenu.reduce((total, group) => total + group.items.length, 0)
  assert.ok(menuDestinationCount >= 390, 'All specified submenu destinations should be present')
  const administration = institutionalMenu.find(group => group.key === 'administration')
  const peopleHR = institutionalMenu.find(group => group.key === 'people-hr')
  assert.deepEqual(peopleHR?.items.map(item => item.label), ['Admissions & Enrollment','Students','Parents & Guardians','Teachers','Faculty & Staff','HR & Recruitment','Employee Contracts & Documents','Employee Performance','Payroll & Salary Records','Alumni'], 'People & HR must contain the ten approved Stage 6 destinations in lifecycle order')
  assert.deepEqual(administration?.items.map(item => item.label), [
    'Institute Profile','Campus and Branch Management','Organisational Structure','Department Directory','Designation Catalogue',
    'Academic Structure & Sections','Institute Settings','Branding & Document Settings','Student Policies','Faculty Policies',
    'User Access & Invitations','Role & Permission Management','Document Access','Approval Workflows','Security & Access History','Administrative Audit',
  ], 'Administration must retain the requested dedicated submenus in institution-setup order')
  assert.ok(!navigationCatalog.some(group => ['institution-config','academic-sessions','classes-sections','subjects','curriculum','timetable','teaching'].includes(group.key)), 'Nested setup and academic workspaces must not remain separate top-level menus')
  const permittedLinkedRoutes = new Set([
    'administration:campus-and-branch-management',
    'library:digital-library','library:book-management','library:book-catalogue','library:book-categories',
    'library:book-registration','library:reading-records','library:reading-cards','library:student-reading-history',
    'library:book-issue-and-returns','library:learning-materials','library:resource-downloads','library:library-reports',
    'inventory:items-management','inventory:item-catalogue','inventory:item-categories','inventory:suppliers','inventory:purchase-records',
    'inventory:stock-in','inventory:stock-out','inventory:stock-allocation','inventory:stock-adjustments','inventory:inventory-history','inventory:stock-reports',
    'transport:vehicle-management','transport:drivers-management','transport:transport-routes','transport:route-stops',
    'transport:student-transport-allocation','transport:transport-fees','transport:transport-assignments','transport:vehicle-maintenance',
    'transport:transport-attendance','transport:transport-history','transport:transport-reports',
    'library:library-dashboard','inventory:inventory-dashboard',
    'transport:transport-dashboard','transport:transport-fees','transport:transport-history',
    'examinations:examination-programs','examinations:examination-timetable','examinations:question-bank',
    'class-tests:class-test-dashboard',
    'class-tests:create-class-tests',
    'class-tests:test-schedule',
    'class-tests:marks-entry',
    'class-tests:test-results',
    'class-tests:performance-analysis',
    'class-tests:test-reports',
    'class-tests:student-wise-test-history',
    'class-tests:online-tests','class-tests:written-tests',
    'examinations:online-tests-and-quizzes','examinations:marks-entry','examinations:grades-and-grading-system',
    'examinations:results-and-result-approval','examinations:report-cards','examinations:examination-reports',
    // AI question-generation opens the dedicated examination question-bank workspace;
    // it does not write to the generic institutional-records table.
    'ai:ai-question-generation',
  ])
  for (const group of navigationCatalog) {
    for (const page of group.items) {
      const itemKey = page.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const route = getNavigationRoute(group.key, page)
      assert.ok(route, `${group.label}/${page} has no contextual route`)
      assert.equal(navigationRoutes[`${group.key}:${itemKey}`], route, `${group.label}/${page} contextual route index is stale`)
      if (route.startsWith('institutional:')) {
        assert.ok(permittedLinkedRoutes.has(`${group.key}:${itemKey}`), `${group.label}/${page} must not fall back to generic institutional CRUD`)
      }
    }
  }
  assert.equal(getNavigationRoute('ai', 'AI Question Generation'), 'assistant:ai-question-generation', 'AI question generation must open its dedicated intelligence workspace')
  assert.equal(getNavigationRoute('reports', 'Student Reports'), 'reports:students', 'Student reports must open the student report window')
  assert.equal(getNavigationRoute('reports', 'Attendance Reports'), 'reports:attendance', 'Attendance reports must open the attendance report window')
  assert.equal(getNavigationRoute('teaching', 'Homework'), 'assignments:open', 'Homework must open the open-coursework view')
  assert.equal(getNavigationRoute('attendance', 'Attendance Reports'), 'care:reports', 'Stage 7 attendance reports must open the dedicated care/report workspace')
  assert.equal(getNavigationRoute('students', 'Student Directory'), 'students:directory', 'Student Directory must open the student directory view')
  assert.equal(getNavigationRoute('students', 'Bulk Student Operations'), 'unavailable:students:bulk-student-operations', 'Bulk student operations must not imply a batch edit workflow')
  assert.equal(getNavigationRoute('students', 'Student Data Export', 'student'), 'unavailable:students:student-data-export', 'Student accounts must not receive institution-wide data export access')
  assert.equal(getNavigationRoute('students', 'Student Data Export', 'owner'), 'students:directory', 'Administrators can export their permitted student directory records')
  assert.equal(getNavigationRoute('employees', 'Employee Performance'), 'unavailable:employees:employee-performance', 'HR headcount must not be presented as a performance appraisal')
  assert.equal(getNavigationRoute('attendance', 'Leave Applications'), 'care:leave-applications', 'Leave applications must open the self-service leave workflow')
  assert.equal(getNavigationRoute('attendance', 'Leave Review & Approvals'), 'care:leave-approvals', 'Leave approvals must open their restricted review queue')
  assert.equal(getNavigationRoute('attendance', 'Leave Balances'), 'care:leave-balances', 'Leave balances must open their entitlement register')
  assert.equal(getNavigationRoute('attendance', 'Leave Reports'), 'care:leave-reports', 'Leave reports must open period-based analytics')
  assert.equal(getNavigationRoute('attendance', 'Attendance Analytics'), 'reports:attendance', 'Attendance analytics must open the live attendance report')
  assert.equal(getNavigationRoute('attendance', 'Attendance Alerts'), 'unavailable:attendance:attendance-alerts', 'Attendance alerts require a configured rules/notification workflow')
  assert.equal(getNavigationRoute('timetable', 'Substitution Management'), 'unavailable:timetable:substitution-management', 'Teacher substitution must not be represented as unassigned timetable entries')
  assert.equal(getNavigationRoute('timetable', 'Timetable Publishing'), 'unavailable:timetable:timetable-publishing', 'Timetable publication controls are not implemented yet')
  assert.equal(getNavigationRoute('class-tests', 'Online Tests'), 'institutional:examinations:online-tests-and-quizzes', 'Online tests must open the timed assessment workspace')
  assert.equal(getNavigationRoute('examinations', 'Automatic Checking'), 'unavailable:examinations:automatic-checking', 'Automated marking is not configured')
  assert.equal(getNavigationRoute('reports', 'Custom Report Builder'), 'custom-reports:custom-report-builder', 'Custom Report Builder must open its dedicated multi-source builder')
  assert.equal(getNavigationRoute('reports', 'Scheduled Reports'), 'scheduled-reports:scheduled-reports', 'Scheduled Reports must open its dedicated scheduling page')
  assert.equal(getNavigationRoute('library', 'Student Reading History'), 'library-reading:student-reading-history', 'Reading progress history must open its dedicated learner reading register')
  assert.equal(getNavigationRoute('transport', 'Transport Attendance', 'owner'), 'transport-attendance:transport-attendance', 'Transport boarding attendance must open its append-only event register')
  assert.equal(getNavigationRoute('transport', 'Transport Attendance', 'student'), 'unavailable:transport:transport-attendance', 'Student accounts must not access the staff-only transport event register')
  assert.equal(getNavigationRoute('receipts', 'Receipt Templates'), 'receipt-operations:receipt-templates', 'Receipt template management must open the dedicated receipt workspace')
  assert.equal(getNavigationRoute('students', 'Student ID Cards'), 'students:id-cards', 'Student ID Cards must open the print workspace')
  assert.equal(getNavigationRoute('employees', 'Employee ID Cards'), 'employees:id-cards', 'Employee ID Cards must open the staff print workspace')
  assert.equal(getNavigationRoute('ai', 'AI Assistant'), 'assistant:chat', 'AI Assistant must open its dedicated shell while keeping sending disabled until a provider is configured')
  assert.equal(getNavigationRoute('backup', 'Create Backup'), 'data-management:create-backup', 'Create Backup must open the backup request and data management workspace')
  assert.equal(getNavigationRoute('communication', 'WhatsApp Integration'), 'messaging:whatsapp-integration', 'WhatsApp integration must open its connection-status workspace without claiming provider readiness')
  assert.ok(read('src/components/CommunicationWorkspace.tsx').includes("isProviderPage=itemKey==='whatsapp-integration'"), 'WhatsApp configuration must remain a status/configuration page until verified credentials are available')
  assert.equal(getNavigationRoute('communication', 'Notification Centre'), 'notifications', 'In-app notifications remain a supported communication workflow')
  assert.equal(getNavigationRoute('people-hr', 'Teachers'), 'employees:directory-teaching', 'Teachers must open the teaching directory window')
  assert.equal(getNavigationRoute('people-hr', 'Faculty & Staff'), 'employees:directory-staff', 'Faculty & Staff must open the staff directory window')
  assert.equal(getNavigationRoute('dashboard', 'Institutional Overview', 'owner'), 'overview', 'Institutional overview must open the dashboard')
  assert.equal(getNavigationRoute('dashboard', 'Academic Overview', 'owner'), 'reports:academics', 'Academic Overview must retain its academic report sub-view')
  assert.equal(getNavigationRoute('dashboard', 'Financial Overview', 'owner'), 'finance:fees:overview', 'Financial Overview must retain its fee/finance overview window')
  assert.equal(getNavigationRoute('dashboard', 'Attendance Overview', 'owner'), 'attendance:students', 'Attendance Overview must retain its student attendance window')
  assert.equal(getNavigationRoute('dashboard', 'Student Performance', 'owner'), 'exam_results:published', 'Student Performance must open published results instead of the results module root')
  assert.equal(getNavigationRoute('dashboard', 'Charts and Comparative Analytics', 'owner'), 'reports:overview', 'Comparative analytics must retain the reports overview window')
  assert.equal(getNavigationRoute('dashboard', 'Tasks and Reminders', 'owner'), 'work_tasks:queue', 'Tasks and reminders must retain the task queue window')
  assert.equal(getNavigationRoute('dashboard', 'Academic Overview', 'student'), 'exams:calendar', 'Student academic overview must use the permitted assessment calendar')
  assert.equal(getNavigationRoute('dashboard', 'Financial Overview', 'teacher'), 'unavailable:dashboard:financial-overview', 'Teacher financial overview must remain restricted')
  assert.equal(getNavigationRoute('timetable', 'Master Timetable', 'owner'), 'timetable:week', 'Master timetable must retain the weekly schedule window')
  assert.equal(getNavigationRoute('timetable', 'Class Timetable', 'owner'), 'timetable:classes', 'Class Timetable must open the class schedule view')
  assert.equal(getNavigationRoute('timetable', 'Class Timetable', 'student'), 'timetable:classes', 'Student Class Timetable must open the class schedule view')
  assert.equal(getNavigationRoute('timetable', 'Teacher Timetable', 'teacher'), 'timetable:teachers', 'Teacher Timetable must open the teacher schedule view')
  assert.equal(getNavigationRoute('timetable', 'Room Timetable', 'owner'), 'timetable:rooms', 'Room Timetable must open the room schedule view')
  assert.equal(getNavigationRoute('timetable', 'Period Timetable', 'parent'), 'timetable:week', 'Period Timetable must remain on the weekly schedule because there is no separate period filter view')
  assert.equal(getNavigationRoute('timetable', 'Timetable Conflicts', 'owner'), 'timetable:conflicts', 'Timetable conflicts must retain the conflict view')
  assert.equal(getNavigationRoute('timetable', 'Timetable History', 'owner'), 'timetable:history', 'Timetable history must retain the history view')
  assert.equal(getNavigationRoute('dashboard', 'Employee Performance', 'owner'), 'unavailable:dashboard:employee-performance', 'Employee appraisal must not be confused with an HR headcount report')
  assert.equal(getNavigationRoute('dashboard', 'Employee Performance', 'teacher'), 'unavailable:dashboard:employee-performance', 'Employee appraisal must stay unavailable until a review workflow exists')
  assert.equal(getNavigationRoute('dashboard', 'Financial Overview', 'teacher'), 'unavailable:dashboard:financial-overview', 'Teacher navigation must not expose institutional finance totals')
  assert.equal(getNavigationRoute('dashboard', 'Student Behaviour', 'student'), 'unavailable:dashboard:student-behaviour', 'Student dashboard must not expose staff-only behaviour logs')
  assert.equal(getNavigationRoute('reports', 'Employee Reports'), 'reports:employees', 'Employee report shortcut must open the dedicated employee report workspace')
  assert.equal(getNavigationRoute('reports', 'Payroll Reports'), 'reports:payroll', 'Payroll report shortcut must open the payroll report view')
  assert.equal(getNavigationRoute('library', 'Book Registration'), 'institutional:library:book-registration', 'Library catalogue must use its structured master-record form')
  assert.equal(getNavigationRoute('inventory', 'Items Management'), 'institutional:inventory:items-management', 'Inventory catalogue must use its structured master-record form')
  assert.equal(getNavigationRoute('transport', 'Transport Routes'), 'institutional:transport:transport-routes', 'Transport routes must use their structured master-record form')
  assert.ok(!roleNavigationGroups('student').find(group => group.key === 'dashboard')?.items.includes('Employee Performance'), 'Student dashboard must not contain workforce analytics')
  assert.ok(!roleNavigationGroups('teacher').find(group => group.key === 'employees')?.items.includes('Employee Reports'), 'Staff reporting summary is owner/admin-only')
  for (const [page, route] of Object.entries(navigationRoutes)) {
    if (route.startsWith('institutional:')) {
      const groupKey = route.split(':')[1]
      assert.ok(groupKeys.has(groupKey), page + ' points to an unknown institutional workspace')
    }
  }
  assert.equal(getNavigationRoute('people-hr', 'Students', 'owner'), 'students:directory', 'Student Directory must open the student workspace')
  assert.equal(navigationRoutes['fees:fee-invoices'], 'finance:fees:invoices', 'Fee invoices must open the dedicated Finance & Payments workspace')
})


check('Sidebar workspaces follow the approved parent-section sequence for every role', () => {
  const expectedGroupOrder = ["dashboard","administration","academic-management","people-hr","attendance","behaviour","question-bank","examinations","class-tests","library","certificates","fees","receivables","payments","receipts","accounts-finance","reconciliation","communication","transport","inventory","facilities","visitors","reports","ai","backup"]
  const completeCatalogOrder = ["dashboard","administration","institution-config","academic-sessions","classes-sections","subjects","people-hr","academic-management","curriculum","timetable","teaching","attendance","behaviour","question-bank","examinations","class-tests","library","certificates","fees","receivables","payments","receipts","accounts-finance","reconciliation","communication","transport","inventory","facilities","visitors","reports","ai","backup"]
  assert.deepEqual(navigationSectionDefinitions.map(section => section.key), ['main'], 'The sidebar must use one continuous, unlabelled navigation list')
  assert.deepEqual(navigationSectionDefinitions.flatMap(section => section.groupKeys), expectedGroupOrder)
  assert.deepEqual(navigationCatalog.map(group => group.key), expectedGroupOrder)
  assert.deepEqual(institutionalMenu.map(group => group.key), completeCatalogOrder, 'Nested administration and academic destinations remain in the full route catalogue')
  for (const role of roles) {
    const groups = roleNavigationGroups(role)
    const sections = roleNavigationSections(role)
    assert.ok(sections.length > 0, `${role} has no visible navigation sections`)
    assert.ok(sections.every(section => section.groups.length > 0), `${role} has an empty navigation heading`)
    assert.deepEqual(
      sections.flatMap(section => section.groups.map(group => group.key)),
      groups.map(group => group.key),
      `${role} hierarchy must preserve every permitted group exactly once`,
    )
    assert.ok(!groups.some(group => ['institution-config','academic-sessions','classes-sections','subjects','curriculum','timetable','teaching'].includes(group.key)), `${role} must access nested setup/academic work through parent workspaces`)
  }
})

const roleCounts = {}
check('All seven roles receive focused, permission-aware workspaces', () => {
  for (const role of roles) {
    const groups = roleNavigationGroups(role)
    assert.ok(groups.some(group => group.key === 'dashboard'), `${role} has no Dashboard entry`)
    assert.equal(new Set(groups.map(group => group.key)).size, groups.length, `${role} has duplicate groups`)
    roleCounts[role] = { groups: groups.length, destinations: groups.reduce((n, group) => n + group.items.length, 0) }
    for (const group of groups) {
      for (const page of group.items) assert.ok(navigationRoutes[page], `${role} can see an un-routed page: ${page}`)
    }
    for (const module of modulesForRole(role)) assert.ok(module.roles.includes(role), `${role} received an unauthorised module ${module.key}`)
  }
  assert.ok(roleNavigationGroups('teacher').some(group => group.key === 'academic-management'), 'Teachers must receive the Stage 8 academic workspace')
  assert.ok(roleNavigationGroups('student').some(group => group.key === 'academic-management'), 'Students must receive the Stage 8 academic workspace')
  assert.ok(roleNavigationGroups('parent').some(group => group.key === 'academic-management'), 'Parents must receive the Stage 8 academic workspace')
  assert.ok(!roleNavigationGroups('teacher').some(group => ['administration','institution-config','academic-sessions','classes-sections','subjects','curriculum','timetable','teaching'].includes(group.key)), 'Legacy academic groups must be consolidated, not duplicated')
  assert.ok(roleNavigationGroups('teacher').find(group => group.key === 'people-hr')?.items.includes('Employee Contracts & Documents'))
  assert.ok(!roleNavigationGroups('student').some(group => ['administration','institution-config','employees','accounts-finance','payroll'].includes(group.key)))
  assert.ok(!roleNavigationGroups('parent').some(group => ['administration','institution-config','employees','accounts-finance','payroll'].includes(group.key)))
  assert.ok(!roleNavigationGroups('accountant').some(group => ['employees','students','question-bank','examinations'].includes(group.key)))
  assert.ok(!roleNavigationGroups('exam_officer').some(group => ['employees','students','accounts-finance','payroll'].includes(group.key)))
})

check('Bulk attendance uses class and section registers without a new Late status', () => {
  const attendance = read('src/components/AttendanceWorkspace.tsx')
  assert.ok(attendance.includes('All present') && attendance.includes('All absent') && attendance.includes('All on approved leave') && attendance.includes('sectionName'))
  assert.ok(!attendance.includes("markAll('late')") && !attendance.includes('>All late</button>'), 'New attendance registers must not offer Late marking')
  assert.ok(attendance.includes('save_student_attendance_register') && attendance.includes('save_employee_attendance_register') && attendance.includes('Save whole register'), 'Student and employee registers must use their validated atomic save RPCs')
  const deviceAdmin = read('supabase/functions/attendance-device-admin/index.ts')
  const deviceWebhook = read('supabase/functions/attendance-device-webhook/index.ts')
  assert.ok(attendance.includes('Awaiting first signed event') && attendance.includes('last_synced_at'), 'Device sources must remain visibly awaiting their first authenticated event')
  assert.ok(deviceAdmin.includes('vault.create_secret') && deviceAdmin.includes('vault.update_secret'), 'Device signing keys must be issued and rotated in Supabase Vault')
  assert.ok(deviceWebhook.includes('verifyDeviceSignature') && deviceWebhook.includes('event.event_type === "heartbeat"') && deviceWebhook.includes('processing_status: "received"') && deviceWebhook.includes('No attendance record was created'), 'Signed heartbeats must update device health while attendance events remain reviewable and never silently create official attendance')
})
check('Signed device attendance events require authorised review before reconciliation', () => {
  const attendance = read('src/components/AttendanceWorkspace.tsx')
  const review = read('supabase/migrations/20261115060000_attendance_device_event_review_approval.sql')
  assert.ok(attendance.includes('review_attendance_device_event') && attendance.includes('Approve & apply attendance') && attendance.includes('Reject event'), 'The device queue must expose distinct approval and rejection actions')
  assert.ok(attendance.includes('p_review_note:reviewNote.trim()') && attendance.includes('p_attendance_date:action===\'approve\'?reviewDate:null'), 'The reviewer must submit an audit note and confirm the local attendance date')
  assert.ok(review.includes('security definer') && review.includes("has_institution_role(v_event.institution_id, array['owner','admin'])"), 'Employee event review must be restricted to owners and administrators')
  assert.ok(review.includes("array['owner','admin','teacher']"), 'Teacher review may only be enabled for student events')
  assert.ok(review.includes("private.has_institution_permission(\n      v_event.institution_id,\n      'attendance',\n      'approve'"), 'Review decisions must enforce custom attendance-approval permissions')
  assert.ok(review.includes("'attendance',\n        'view'") && review.includes('private.college_department_for_student'), 'Teacher queue visibility must enforce class/campus scope')
  assert.ok(review.includes('register_id = coalesce(register_id, v_register_id)'), 'A reconciled check-out must preserve its attendance-register link')
  assert.ok(review.includes('Original device event evidence is immutable') && review.includes('revoke update on public.attendance_device_events'), 'Signed event evidence must not be directly editable by browsers')
  assert.ok(review.includes("v_register_status = 'locked'") && review.includes('correction_reason is null'), 'Locked registers and unreasoned corrections must be blocked')
  assert.ok(review.includes('insert into public.attendance(') && review.includes('insert into public.employee_attendance('), 'Approved events must reconcile into the existing attendance records')
})
check('Stage 12 front-office windows use the live tenant-scoped enquiry, notices and calendar tables', () => {
  const frontOffice = read('src/components/FrontOfficeWorkspace.tsx')
  for (const value of ['admission_enquiries','announcements','academic_calendar_events','institution_id','enquiry_no','guardian_phone','created_by','audience','start_date','end_date']) {
    assert.ok(frontOffice.includes(value), 'Front Office is missing its real persisted field/table: '+value)
  }
  assert.ok(frontOffice.includes('follow_up') && frontOffice.includes('application_started') && frontOffice.includes('not_interested'), 'Enquiry statuses must match the live database constraint')
  assert.ok(frontOffice.includes('Save enquiry') && frontOffice.includes('Publish notice') && frontOffice.includes('Publish event'), 'Each front-office workflow must have its own save/publish action')
  assert.ok(!frontOffice.includes('institutional_records'), 'Front-office records must not be written into a generic catch-all table')
})
check('Stage 14 AI assistant is transparent when no AI provider is connected', () => {
  const assistant = read('src/components/AIAssistantWorkspace.tsx')
  assert.ok(assistant.includes('The free Cloudflare AI connection is not configured yet') && assistant.includes("provider==='auto'&&!providerStatus.cloudflare?.configured") && assistant.includes('Automatic · Cloudflare free quota only') && assistant.includes('supabase.functions.invoke'), 'The assistant must require the free Cloudflare connection for automatic mode and never fall back to paid providers')
})
check('Stage 15 personal account pages use the authenticated session and respect personal scope', () => {
  const personal = read('src/components/PersonalWorkspace.tsx')
  assert.ok(personal.includes('supabase.auth.updateUser') && personal.includes('signInWithPassword'), 'Password changes must verify the current account before update')
  assert.ok(personal.includes('.eq(\'actor_id\',user.id)'), 'Personal activity must filter by the signed-in user')
})
check('Institutional workspace includes real record CRUD and office-compatible exports', () => {
  const workspace = read('src/components/InstitutionalWorkspace.tsx')
  const exporters = read('src/lib/officeExport.ts')
  for (const value of ['institutional_records','created_by','updated_by','approval_status','CONTEXTUAL SUB-WINDOW']) assert.ok(workspace.includes(value))
  for (const value of ['exportXlsx','exportDocx','printOfficeReport']) assert.ok(workspace.includes(value))
  for (const value of ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document','window.print']) assert.ok(exporters.includes(value))
})


check('Institutional registers and windows are tailored by workspace domain', () => {
  const workspace = read('src/components/InstitutionalWorkspace.tsx')
  const styles = read('src/styles/institutional-premium.css')
  for (const value of ['recordMetaColumnPlan','workspaceTableFieldOrder','workspaceRecordLabels','workspaceLayouts','data-workspace-group','data-workspace-theme','data-workspace-layout']) {
    assert.ok(workspace.includes(value), 'Module-specific workspace mapping is missing: ' + value)
  }
  for (const value of ['showAmount','showQuantity','showDueDate','showPortalVisibility']) {
    assert.ok(workspace.includes(value), 'Module-specific form visibility is missing: ' + value)
  }
  assert.ok(workspace.includes('canViewInternalApproval(user?.role)'), 'Only owner/admin may see internal approval columns')
  assert.ok(workspace.includes('getWorkspaceExportColumns(user?.role'), 'Workspace exports must use role-scoped columns')
  assert.ok(workspace.includes('getWorkspaceExportRows(user?.role'), 'Workspace export rows must remove internal review metadata')
  assert.ok(workspace.includes('getWorkspaceReviewMetrics(rows,user?.role)'), 'Workspace review metrics must use role-aware projections')
  assert.ok(workspace.includes('pendingReviewCount!==null'), 'Pending review KPI must be hidden from non-admin roles')
  for (const layout of ['academic','people','assessment','ledger','communication','resource','operations','governance','intelligence']) {
    assert.ok(styles.includes(`[data-workspace-layout="${layout}"]`), 'Distinct workspace surface is missing: ' + layout)
  }
})

check('Non-admin workspace projections remove all internal review metadata recursively', () => {
  const privacy = read('src/lib/workspacePrivacy.js')
  const tests = read('scripts/test-workspace-privacy.mjs')
  for (const field of ['approval_status', 'reviewed_by', 'reviewed_at', 'review_notes']) {
    assert.ok(privacy.includes(field), 'Protected review field is missing: ' + field)
    assert.ok(tests.includes(field), 'Privacy regression is missing protected field: ' + field)
  }
  assert.ok(privacy.includes('removeInternalReviewFields'), 'Nested export metadata must be recursively removed')
})

const dashboardSource = read('src/components/Dashboard.tsx')
check('Dashboard matches the menu and keeps Quick Access at the sidebar bottom', () => {
  for (const forbidden of ['CatalogWorkspace', '22-group, 122-section', 'WORKSPACE PAGES', 'MENU GROUPS', '⌘ K', '<kbd>/</kbd>', 'pro-sidebar-footer']) {
    assert.ok(!dashboardSource.includes(forbidden), `Found outdated dashboard element: ${forbidden}`)
  }
  const navStart = dashboardSource.indexOf('<nav className="pro-navigation"')
  const navEnd = dashboardSource.indexOf('</nav>', navStart)
  const quickStart = dashboardSource.indexOf('className="pro-quick-access"')
  assert.ok(navStart >= 0 && navEnd > navStart, 'Scrollable navigation is missing')
  assert.ok(quickStart > navEnd, 'Quick Access must be outside the scrollable navigation at the sidebar bottom')
  assert.ok(!dashboardSource.includes('pro-menu-overview') && !dashboardSource.includes('Menu overview'), 'Dashboard must not repeat the sidebar menu')
  assert.ok(dashboardSource.includes('roleNavigationGroups(user!.role)'), 'Sidebar navigation must follow role permissions')
  assert.ok(dashboardSource.includes('roleNavigationSections(user!.role,stage7CareAreas)') && dashboardSource.includes('pro-nav-section-label'), 'Sidebar must render parent sections while applying per-user Stage 7 care grants')
  assert.ok(dashboardSource.includes('ed360-dashboard'), 'Approved first-image dashboard layout is missing')
  assert.ok(dashboardSource.includes('ed360-metric-grid') && dashboardSource.includes('ed360-line-chart') && dashboardSource.includes('ed360-module-panel'), 'Dashboard statistics, academic chart or module overview is missing')
  assert.ok(dashboardSource.includes('ed360-recent-panel') && dashboardSource.includes('ed360-events-panel') && dashboardSource.includes('ed360-quick-stats-panel'), 'Dashboard activity, events or quick statistics panel is missing')
  assert.ok(dashboardSource.includes('id="ed360-workspace-search"') && dashboardSource.includes('Search pages and tools…'), 'Workspace page-and-tool search is missing')
  assert.ok(!dashboardSource.includes('pro-workspace-tabs') && !dashboardSource.includes('pro-active-workspace-context') && !dashboardSource.includes('closeWorkspaceTab'), 'Obsolete open-window and active-workspace bars must remain removed')
  assert.ok(dashboardSource.includes('pro-window-panel') && dashboardSource.includes('hidden={activeTabId !== tab.id}'), 'The selected workspace must still render without visible window chrome')
  assert.ok(dashboardSource.includes('parentId?: string') && dashboardSource.includes('function navigateChild') && dashboardSource.includes('current.parentId') && dashboardSource.includes('options.parentId'), 'Nested child workspace navigation must retain its parent context internally')
  assert.ok(dashboardSource.includes("getNavigationRoute(group.key, item, user!.role)"), 'Sidebar destinations must use their exact group and active role')
  assert.ok(!dashboardSource.includes("group.key === 'dashboard' ? 'overview' : getNavigationRoute"), 'Dashboard submenu items must not all collapse to overview')
  assert.ok(!dashboardSource.includes('closeWorkspaceTab'), 'The visible close-window workflow must remain removed with the window bar')
  assert.ok(dashboardSource.includes('ed360-topbar-institution') && dashboardSource.includes('ed360-topbar-notice'), 'Approved institution topbar is missing')
  assert.ok(dashboardSource.includes('/gidc-badin-official-logo.svg') && dashboardSource.includes('ed360-topbar-college-logo') && dashboardSource.includes('pro-sidebar-college-logo'), 'College emblem must appear in the sidebar and institution topbar')
  assert.ok(dashboardSource.includes('Online notifications') && dashboardSource.includes('College portal online'), 'The topbar must identify college online notifications and portal status')
  const navigationTheme = read('src/styles/college-theme.css')
  for (const style of ['background:#ffffff !important;', 'color:#080b09 !important;', '.pro-app-shell[data-theme] .pro-sidebar .pro-nav-group-head.active', '.pro-app-shell[data-theme] .pro-sidebar .pro-nav-item.active', '.ed360-notification-copy']) assert.ok(navigationTheme.includes(style), 'High-contrast white navigation style is missing: ' + style)

  assert.ok(dashboardSource.includes('pro-profile-menu'), 'Account menu is missing')
  const quickAccessBlock = dashboardSource.slice(quickStart, dashboardSource.indexOf('</section>', quickStart) + 10)
  assert.ok(quickAccessBlock.includes('Sign out') && quickAccessBlock.includes('logout()'), 'Sidebar bottom area must retain Sign out')
  for (const shortcut of ['Attendance Registration', 'Fees Invoice', 'Files & Documentation']) assert.ok(!quickAccessBlock.includes(shortcut), 'Shortcut must not remain in Quick Access: ' + shortcut)
  assert.ok(dashboardSource.includes('pro-quick-access'), 'Bottom session action area is missing')
  assert.ok(dashboardSource.includes('sidebarCollapsed') && dashboardSource.includes('compactSidebar'), 'Desktop sidebar collapse state is missing')
  assert.ok(dashboardSource.includes('aria-hidden={isMobileNav && !sidebarOpen}'), 'Visible desktop navigation must remain in the accessibility tree')
  const sidebarCss = read('src/styles/pro-dashboard.css')
  for (const feature of ['sidebar-collapsed', 'width:72px', 'width:calc(100% - 72px)', 'pro-sidebar-brand-copy', 'pro-sidebar-collapse']) {
    assert.ok(sidebarCss.includes(feature), 'Compact sidebar styling is missing: ' + feature)
  }
})

check('Teacher account provisioning verifies and links one employee identity with rollback', () => {
  const createUser = read('supabase/functions/create-user/index.ts')
  const guards = read('supabase/functions/create-user/provisioning-guards.mjs')
  const tests = read('scripts/test-account-provisioning.mjs')
  const accountForm = read('src/components/AccountsModule.tsx')
  assert.equal(packageJson.scripts['test:account-provisioning'], 'node scripts/test-account-provisioning.mjs')
  for (const value of ['resolveTeacherEmployee', 'escapeIlikeLiteral', 'isVerifiedTeacherLink', ".is('user_id', null)", 'cleanupFailed', 'admin.auth.admin.deleteUser(newUserId)']) {
    assert.ok(createUser.includes(value), 'Teacher provisioning safeguard is missing: ' + value)
  }
  for (const value of ['normalizeIdentityEmail', 'employee_ambiguous', 'employee_already_linked', 'isVerifiedTeacherLink']) {
    assert.ok(guards.includes(value), 'Teacher identity helper is missing: ' + value)
  }
  for (const value of ['no employee record exists', 'ambiguous employee matches', 'already linked to a login', 'confirms only the exact employee']) {
    assert.ok(tests.includes(value), 'Teacher provisioning regression test is missing: ' + value)
  }
  assert.ok(accountForm.includes('Teacher login creation verifies and links that employee record'), 'Account form does not explain the employee-first teacher login flow')
})

check('EduSphere 360 production deployment runs only from main after the verified build', () => {
  const releaseWorkflow = read('.github/workflows/cloudflare-pages-release.yml')
  const productionJob = releaseWorkflow.slice(releaseWorkflow.indexOf('  deploy-production:'))
  assert.ok(productionJob.includes("github.ref == 'refs/heads/main'"), 'Production deployment must be restricted to main')
  assert.ok(!productionJob.includes("github.event_name == 'push'") && productionJob.includes("github.event_name == 'workflow_dispatch'") && productionJob.includes('inputs.deploy_production == true'), 'Production release must remain manual and explicitly approved after verification')
  assert.ok(productionJob.includes("github.event_name == 'workflow_dispatch'") && productionJob.includes('inputs.deploy_production == true'), 'A manual, explicitly approved redeploy must remain available')
  assert.ok(productionJob.includes('Ensure the EduSphere 360 production Pages project exists') && productionJob.includes('for project in edusphere360; do'), 'Only the EduSphere 360 Pages project may be created or deployed by this workflow')
  assert.ok(productionJob.includes('pages deploy dist --project-name=edusphere360 --branch=main') && !productionJob.includes('project-name=gidcbadin'), 'Production must deploy the verified build only to the EduSphere 360 Pages project')
  assert.ok(!releaseWorkflow.includes('deploy-preview'), 'Pull requests must not publish a separate Cloudflare preview')
})

const authScreens = read('src/components/AuthScreens.tsx')
const authContext = read('src/context/AuthContext.tsx')
const authSource = read('src/lib/auth.ts')
const signupMigration = read('supabase/migrations/20261108053651_owner_signup_institution_details.sql')

check('Public welcome page includes an accessible feature showcase and FAQ', () => {
  const welcome = read('src/components/AuthScreens.tsx')
  const styles = read('src/styles/welcome-marketing.css')
  for (const value of ['role="tablist"', 'role="tab"', 'role="tabpanel"', "event.key === 'ArrowRight'", "event.key === 'ArrowLeft'", 'aria-selected={showcaseTab === tab.key}', 'welcomeFaqs.map', 'aria-expanded={openFaq === index}', 'edm-faq-answer-' ]) {
    assert.ok(welcome.includes(value), 'Welcome page interaction is missing: ' + value)
  }
  for (const value of ['edm-showcase-tabs', 'edm-showcase-preview', 'edm-faq-layout', 'edm-faq-item', '@media(max-width:620px)']) {
    assert.ok(styles.includes(value), 'Welcome interaction styling is missing: ' + value)
  }
  assert.ok(welcome.includes('Offline/local operation is not available in this release.'), 'The public FAQ must accurately disclose the online-only release')
  assert.ok(welcome.includes('self-hosted deployment is not currently offered as a released installation.'), 'The public FAQ must not imply the planned self-hosted edition is released')
  assert.ok(welcome.includes('href="#showcase"') && welcome.includes('href="#faq"'), 'The welcome navigation must link to the product tour and FAQ')
  assert.ok(welcome.includes('Frequently asked questions'), 'The footer must include a visible FAQ link')
})
check('Owner signup collects and sends name, institution and institution type', () => {
  for (const value of ['Your full name', 'Institution name', 'Institution type', 'Owner / Admin']) assert.ok(authScreens.includes(value), `${value} is missing from authentication screens`)
  for (const value of ['institutionName', 'institutionType', 'fullName']) assert.ok(authContext.includes(value) && authSource.includes(value), `${value} is missing from auth context/client`)
  assert.ok(authSource.includes('institution_name: institutionName'))
  assert.ok(authSource.includes('institution_type: input.institutionType'))
  assert.ok(signupMigration.includes("new.raw_user_meta_data ->> 'institution_name'"))
  assert.ok(signupMigration.includes("new.raw_user_meta_data ->> 'institution_type'"))
})
check('Login separates owner/admin, employee, student and parent role checks', () => {
  assert.ok(authScreens.includes("'owner_admin' | 'employee' | 'student' | 'parent'"))
  assert.ok(authContext.includes("expectedRole === 'owner_admin'"))
  assert.ok(authContext.includes("const mode = ONLINE_MODE"), 'Application must use its fixed online-only mode')
  assert.ok(!authContext.includes('signInLocal') && !authContext.includes('createLocalAdmin'), 'Local authentication fallback must be removed')
  assert.ok(!fs.existsSync(path.join(root, 'src/lib/localDb.ts')), 'Browser-local database must not ship in the online-only application')
  assert.equal(read('src/lib/types.ts').match(/export type AppMode = ([^\n]+)/)?.[1], "'cloud'", 'AppMode must only permit cloud operation')
  assert.ok(authSource.includes('institutions(name,institution_type)'), 'Signed-in profile must load institution type')
  assert.ok(read('src/components/Dashboard.tsx').includes('Institution type:'), 'Profile menu must show institution type')
  assert.ok(authContext.includes("['teacher', 'accountant', 'exam_officer'].includes(signedIn.role)"))
})

check('Role-specific login route changes reset the selected account category', () => {
  const auth = read('src/components/AuthScreens.tsx')
  const browserTest = read('scripts/test-responsive-public.mjs')
  assert.ok(auth.includes('useEffect(() => { setAccountType(initialAccountType) }, [initialAccountType])'), 'Login account type must follow a changed role-route prop')
  assert.ok(browserTest.includes('await page.waitForFunction(expected =>'), 'Browser QA must wait for the selected role category before asserting')
  assert.ok(browserTest.includes("name: 'Welcome back', exact: true"), 'Browser heading selection must uniquely target the login heading')
})

check('Self-service password recovery sends email and completes the authenticated reset flow', () => {
  assert.ok(authScreens.includes('Send password-reset link') && authScreens.includes('ResetPasswordScreen') && authScreens.includes('Update password'))
  assert.ok(authContext.includes('recoveryMode') && authContext.includes('completePasswordReset'))
  assert.ok(authSource.includes('resetPasswordForEmail') && authSource.includes('requestCloudPasswordReset'))
})

check('Notification centre has per-user read state and a tenant-scoped RLS table', () => {
  const notifications = read('src/components/NotificationCenter.tsx')
  const dashboard = read('src/components/Dashboard.tsx')
  const migration = read('supabase/migrations/20261109125937_announcement_read_receipts.sql')
  assert.ok(dashboard.includes('unreadAnnouncementCount') && dashboard.includes("navigate('notifications')"))
  assert.equal(navigationRoutes['Notification Centre'], 'notifications')
  for (const feature of ['announcement_reads', 'markAllRead', 'Mark read', 'Unread (']) assert.ok(notifications.includes(feature))
  for (const safeguard of ['enable row level security', 'users read own announcement receipts', 'users create own announcement receipts', 'users update own announcement receipts', 'auth.uid()', 'memberships']) assert.ok(migration.includes(safeguard))
})

check('Online-only data and file workflows do not fall back to browser storage', () => {
  const context = read('src/context/AuthContext.tsx')
  const data = read('src/lib/data.ts')
  const files = read('src/components/FilesModule.tsx')
  const records = read('src/components/RecordModule.tsx')
  for (const source of [context, data, files, records]) {
    assert.ok(!source.includes('localDb'), 'Local database import or use remains in a production workflow')
    assert.ok(!source.includes('signInLocal'), 'Local sign-in remains in a production workflow')
  }
  assert.ok(files.includes("storage.from('institution-files')"), 'Institution files must use Supabase Storage')
  assert.ok(records.includes("storage.from('institution-files')"), 'Student photos must use Supabase Storage')
})

check('User-facing error handling does not expose database or provider diagnostics', () => {
  assert.equal(packageJson.scripts['test:user-errors'], 'node scripts/test-user-errors.mjs')
  assert.ok(read('src/components/AdministrationModule.tsx').includes('userFacingError'), 'Administration must translate provider errors')
  assert.ok(read('src/lib/auth.ts').includes('contact support before trying to register again'), 'Owner registration must not expose database diagnostics')
  const surfaces = [
    'src/components/RecordModule.tsx', 'src/components/FilesModule.tsx',
    'src/components/AccountsModule.tsx', 'src/components/Dashboard.tsx',
    'src/components/AuthScreens.tsx',
  ]
  for (const file of surfaces) {
    const source = read(file)
    assert.ok(source.includes('userFacingError'), `${file} must translate provider errors before displaying them`)
    assert.ok(!/error instanceof Error\s*\?\s*error\.message/.test(source), `${file} exposes raw provider error messages`)
  }
  const helper = read('src/lib/userErrors.ts')
  for (const phrase of ['row.level security', 'duplicate key', 'foreign key constraint', 'Failed to fetch', 'Invalid login credentials']) {
    assert.ok(helper.toLowerCase().includes(phrase.toLowerCase()), `user error translation missing ${phrase}`)
  }
  const administration = read('src/components/AdministrationModule.tsx')
  assert.ok(administration.includes('userFacingError'), 'Administration must translate load/save/delete failures')
  assert.ok(!/queryError\.message|saveError\.message|deleteError\.message/.test(administration), 'Administration must not expose raw provider messages')
  assert.ok(administration.includes('referencesError') && administration.includes('referencesReload'), 'Administration must report and retry failed relationship lookups')
  const dashboard = read('src/components/Dashboard.tsx')
  assert.ok(dashboard.includes('userFacingError'), 'Dashboard data failures must use safe messages')
  assert.ok(!/error instanceof Error\s*\?\s*error\.message/.test(dashboard), 'Dashboard must not display raw provider errors')
  assert.ok(!read('src/lib/auth.ts').includes('Details: ${detail}'), 'Owner registration must not append raw database diagnostics')
})

check('Finance balance calculations include fees, fines and discounts', () => {
  assert.equal(packageJson.scripts['test:finance'], 'node scripts/test-finance.mjs')
  assert.ok(read('src/components/Dashboard.tsx').includes('outstandingInvoiceBalance'))
  const recordModule = read('src/components/RecordModule.tsx')
  assert.ok(recordModule.includes('outstandingInvoiceBalance') && recordModule.includes('netInvoiceAmount'))
})

check('Operational modules expose distinct nested workspace windows and contextual sub-windows', () => {
  const views = read('src/lib/operationalWorkspaceViews.ts')
  const record = read('src/components/RecordModule.tsx')
  for (const key of ['attendance', 'exams', 'exam_results', 'fees', 'assignments', 'assignment_submissions', 'timetable', 'announcements', 'work_tasks']) {
    assert.ok(views.includes(key + ':'), 'Dedicated workspace configuration missing for ' + key)
  }
  assert.ok(record.includes('operationalWorkspace.views.map'), 'Operational modules must render their configured internal windows')
  assert.ok(record.includes('activeOperationalView.matches(row)'), 'Selecting an internal window must filter its actual database records')
  assert.ok(record.includes('ed360-operations-context-window'), 'Each operational view must identify its current workspace window')
  assert.ok(record.includes('ed360-contextual-subwindow') && record.includes('Operational next step'), 'Record detail must open a module-specific contextual sub-window')
  const accounts = read('src/components/AccountsModule.tsx')
  const files = read('src/components/FilesModule.tsx')
  const reports = read('src/components/ReportsAnalyticsWorkspace.tsx')
  const administration = read('src/components/AdministrationModule.tsx')
  assert.ok(accounts.includes('Access Overview') && accounts.includes('Account Directory') && accounts.includes('Provision Account'), 'Accounts must have separate overview, directory and provisioning windows')
  assert.ok(files.includes('File Register') && files.includes('categoryFilter') && files.includes('viewingFile') && files.includes('CONTEXTUAL SUB-WINDOW'), 'Files must have category windows and a contextual file detail window')
  assert.ok(reports.includes('Student Reports') && reports.includes('Employee Reports') && reports.includes('Attendance Reports') && reports.includes('Examination Reports') && reports.includes('Academic Reports') && reports.includes('Fee Collection Reports') && reports.includes('Payroll Reports') && reports.includes('Financial Reports') && reports.includes('Class Reports') && reports.includes('Comparative Analytics') && reports.includes('Custom Report Builder') && reports.includes('Scheduled Reports') && reports.includes('Report Templates') && reports.includes('Report History'), 'Reports must provide separate dedicated report pages')
  assert.ok(administration.includes('Department Structure') && administration.includes('Class Capacity Overview') && administration.includes('Session Configuration'), 'Administration workspaces must use structure-specific tabs')
  const styles = read('src/styles/operational-hierarchy.css')
  assert.ok(!/zoom\s*:/.test(styles), 'The application must not use browser-level zoom for responsive scaling')
  assert.ok(styles.includes('.ed360-operations-window-nav') && styles.includes('.ed360-contextual-subwindow'), 'Nested workspace hierarchy styles are required')
})

check('Attendance history is searchable and independently date-filterable', () => {
  const attendance = read('src/components/AttendanceWorkspace.tsx')
  const styles = read('src/styles/module-workspaces.css')
  for (const value of ['historySearch', 'visibleHistory', 'historyLoading', 'Attendance history', 'type="date"', 'Search person, ID, status or note', 'person?.full_name', 'person?.admission_no', 'person?.employee_no']) {
    assert.ok(attendance.includes(value), 'Attendance history view is missing: ' + value)
  }
  assert.ok(styles.includes('.ed360-attendance-history-controls') && styles.includes('.attendance-history-status'), 'Attendance history needs responsive filter and status styles')
  assert.ok(attendance.includes('await loadAttendance()'), 'Attendance history refresh must reload saved database records')
})

check('Student, faculty and operational record tables support accessible sorting', () => {
  const record = read('src/components/RecordModule.tsx')
  const styles = read('src/styles/module-workspaces.css')
  for (const value of ['sortKey', 'sortDirection', 'toggleSort', 'orderedFiltered', 'aria-sort=', 'ed360-sort-header']) {
    assert.ok(record.includes(value), 'Sortable record table behaviour is missing: ' + value)
  }
  assert.ok(record.includes("setSortKey(''); setSortDirection('asc')"), 'Sort state must reset when switching record tables')
  for (const value of ['Student', 'Faculty member', 'module.columns.map']) {
    assert.ok(record.includes(value), 'A key record table is missing sortable columns: ' + value)
  }
  assert.ok(styles.includes('.ed360-sort-header:focus-visible'), 'Sortable table headings need a visible keyboard focus indicator')
})

check('Role-specific dashboard landing pages use scoped live data', () => {
  const roleDashboard = read('src/components/RoleDashboard.tsx')
  const dashboard = read('src/components/Dashboard.tsx')
  const data = read('src/lib/data.ts')
  assert.ok(roleDashboard.includes('TABLES_BY_ROLE') && roleDashboard.includes('listRecords') && roleDashboard.includes('roleLabels'), 'Dashboard metrics must be loaded from role-scoped live records')
  assert.ok(dashboard.includes('<RoleDashboard onNavigate={navigateChild}/>'), 'The signed-in overview must render the role-specific dashboard')
  for (const role of roles) assert.ok(roleDashboard.includes(role), 'Role dashboard must provide a dataset for ' + role)
  assert.ok(data.includes("'student_guardians'") && data.includes("'workflow_approvals'") && data.includes("'institutional_audit_events'"), 'Dashboard read-only datasets must be allowed through the data layer')
  assert.ok(data.includes('linkedStudentIds') && data.includes('parentLinks'), 'Parent dashboards must support all linked children, not only one linkedStudentId')
  assert.ok(data.includes("table === 'institutional_audit_events' ? 'occurred_at' : 'created_at'"), 'Audit activity must be ordered by its event timestamp')
  for (const role of roles) assert.ok(roleNavigationGroups(role).some(group => group.key === 'dashboard'), role + ' has no Dashboard entry')
})

check('PeopleHRWorkspace exposes recruitment, contracts, performance and alumni workflows', () => {
  for (const [label,route] of [
    ['Students','students:directory'],['Admissions & Enrollment','peoplehr:admissions'],['Teachers','employees:directory-teaching'],
    ['Faculty & Staff','employees:directory-staff'],['Parents & Guardians','students:guardians'],['HR & Recruitment','peoplehr:recruitment'],
    ['Employee Contracts & Documents','peoplehr:contracts'],['Employee Performance','peoplehr:performance'],['Payroll & Salary Records','payroll:overview'],['Alumni','peoplehr:alumni'],
  ]) assert.equal(getNavigationRoute('people-hr',label,'owner'),route,label+' must resolve to its operational destination')
  const people = read('src/components/PeopleHRWorkspace.tsx')
  for (const value of ['hr_job_postings','hr_candidates','hr_interviews','admission_enquiries','employee_contracts','employee_appraisals','alumni_records','hire_hr_candidate','convert_admission_enquiry','acknowledge_employee_appraisal']) {
    assert.ok(people.includes(value), 'People & HR workflow is missing ' + value)
  }
  const hrSql = read('supabase/migrations/20261111162254_stage_6_people_hr_and_payroll_controls.sql')
  const peopleStyles = read('src/styles/people-hr-workspace.css')
  assert.ok(people.includes("range(offset,offset+499)") && people.includes('collected.push(...chunk)') && people.includes('pageRows.map(row=>'), 'People & HR registers must load full tenant data in batches and paginate visible rows')
  assert.ok(people.includes('const sortedRows=useMemo') && people.includes('aria-sort=') && people.includes('const pageSize=25'), 'People & HR registers must support sortable 25-row pages')
  assert.ok(people.includes('isAdmin&&<button type="button" className="people-hr-icon-button" title="Edit record"') && people.includes('title="Delete record"'), 'Only owners and administrators may edit or delete employee HR workflows')
  assert.ok(people.includes('Number of openings must be a whole number between 1 and 500') && people.includes('maximum salary cannot be below the minimum salary') && people.includes('Interview score must be between 0 and 100') && people.includes('Performance rating must be between 1 and 5'), 'HR forms must validate vacancy, interview and appraisal constraints')
  assert.ok(people.includes('This employee already has an active contract') && people.includes('probation_end_date') && people.includes('review_period_end'), 'Contract and appraisal validation must enforce valid date boundaries and active contract rules')
  assert.ok(people.includes('getFullYear()') && !people.includes("new Date().toISOString().slice(0,10)"), 'HR date defaults must use the local calendar date')
  const exportStart=people.indexOf('function exportCurrent(')
  const exportEnd=people.indexOf('function openForm(',exportStart)
  assert.ok(exportStart>=0 && exportEnd>exportStart && people.slice(exportStart,exportEnd).includes('filteredRows.map'), 'HR exports must include all filtered records, not only the current page')
  for(const value of ['hr_job_postings_salary_range_ck','hr_job_postings_institution_code_uq','employee_contracts_date_ck','employee_contracts_probation_ck','employee_contracts_one_active_idx','employee_appraisals_period_ck','score>=0 and score<=100']) assert.ok(hrSql.includes(value), 'HR database constraint is missing: '+value)
  assert.ok(peopleStyles.includes('.people-hr-sort') && peopleStyles.includes('.people-hr-pagination'), 'HR sorting and pagination must use responsive styles')
  const qualifications = read('src/components/EmployeeQualificationsPanel.tsx')
  assert.ok(qualifications.includes('employee_qualifications'), 'Qualifications must use institution-scoped employee qualification records')
  assert.ok(read('src/components/Dashboard.tsx').includes('<PeopleHRWorkspace '), 'PeopleHRWorkspace must be connected to the signed-in dashboard')
  assert.deepEqual(roleNavigationGroups('teacher').find(group => group.key === 'people-hr')?.items, ['Students','Teachers','Employee Contracts & Documents','Employee Performance','Payroll & Salary Records'])
  assert.deepEqual(roleNavigationGroups('student').find(group => group.key === 'people-hr')?.items, ['Students'])
  assert.deepEqual(roleNavigationGroups('parent').find(group => group.key === 'people-hr')?.items, ['Students','Parents & Guardians'])
  assert.deepEqual(roleNavigationGroups('accountant').find(group => group.key === 'people-hr')?.items, ['Payroll & Salary Records'])
  assert.ok(!roleNavigationGroups('exam_officer').some(group => group.key === 'people-hr'))
})

check('Finance and payroll registers support searchable sortable pagination', () => {
  const finance = read('src/components/FinanceWorkspace.tsx')
  const financeStyles = read('src/styles/finance-workspace.css')
  for (const value of ['invoiceSortKey', 'paymentSortKey', 'sortedFinanceRows', 'financeSortHeader', 'pageControls', 'ordered.length', 'setInvoicePage(1)', 'setPaymentPage(1)']) {
    assert.ok(finance.includes(value), 'Finance register interaction is missing: ' + value)
  }
  assert.ok(finance.includes("financeSortHeader('Balance','balance'"), 'Invoice balance must be sortable')
  assert.ok(finance.includes("financeSortHeader('Invoice','invoice'"), 'Payment register must retain and sort its invoice context')
  assert.ok(financeStyles.includes('.fin-sort-header:focus-visible') && financeStyles.includes('.fin-table-pagination'), 'Finance controls need accessible responsive styling')
  const payroll = read('src/components/PayrollWorkspace.tsx')
  const payrollStyles = read('src/styles/payroll-workspace.css')
  for (const value of ['salarySearch', 'salaryPageRows', 'payslipPageRows', 'toggleSalarySort', 'togglePayslipSort', 'payrollSortHeader', 'payrollPageControls']) {
    assert.ok(payroll.includes(value), 'Payroll register interaction is missing: ' + value)
  }
  assert.ok(payroll.includes('Search employees') && payroll.includes('Search payslips'), 'Payroll and payslip registers must be independently searchable')
  assert.ok(payrollStyles.includes('.payroll-sort-header:focus-visible') && payrollStyles.includes('.payroll-table-pagination'), 'Payroll controls need accessible responsive styling')
  const accounts = read('src/components/AccountsModule.tsx')
  assert.ok(accounts.includes('sortedAccounts') && accounts.includes('toggleSort') && accounts.includes('aria-sort='), 'Account directory must provide accessible sorting')
})

check('Student, employee and operational records expose accessible row action menus', () => {
  const record = read('src/components/RecordModule.tsx')
  const styles = read('src/styles/module-workspaces.css')
  assert.ok(record.includes('function RowActionMenu'), 'Reusable row action menu is missing')
  assert.ok(record.includes('<RowActionMenu label={'), 'Record rows must expose contextual action menus')
  for (const value of ['Open profile', 'View employee', 'View record', 'Delete record']) {
    assert.ok(record.includes(value), 'A row action is missing: ' + value)
  }
  for (const value of ['aria-label={label}', 'role="group"', "removeAttribute('open')"]) {
    assert.ok(record.includes(value), 'Row action menu accessibility/close behaviour is missing: ' + value)
  }
  assert.ok(styles.includes('.ed360-row-action-menu>summary:focus-visible') && styles.includes('.ed360-row-action-menu>div>button:focus-visible'), 'Row menus need visible keyboard focus')
})

check('Administration settings and approval queues support sorting and pagination', () => {
  const administration = read('src/components/AdministrationStage5Workspace.tsx')
  const styles = read('src/styles/governance-workspace.css')
  for (const value of ['settingsSortKey', 'settingsSortDirection', 'orderedSettings', 'settingsPageRows', 'orderedApprovals', 'approvalPageRows', 'toggleSettingsSort', 'sortHeader', 'pageControls']) {
    assert.ok(administration.includes(value), 'Administration list interaction is missing: ' + value)
  }
  assert.ok(administration.includes("onChange={e=>{setSearch(e.target.value);setSettingsPage(1);setApprovalPage(1)}}"), 'Administration search must reset both page positions')
  assert.ok(styles.includes('.gov-sort-header:focus-visible') && styles.includes('.gov-pagination'), 'Administration controls need accessible responsive styles')
})

check('Report tables show all rows through accessible sorting and pagination', () => {
  const reports = read('src/components/ReportsAnalyticsWorkspace.tsx')
  const styles = read('src/styles/reports-analytics-workspace.css')
  for (const value of ['orderedRows', 'pageRows', 'toggleSort', 'aria-sort=', 'ra-sort-button', 'ra-pagination']) {
    assert.ok(reports.includes(value), 'Report table interaction is missing: ' + value)
  }
  assert.ok(!reports.includes('rows.slice(0, 200)'), 'Reports must not silently truncate records at 200 rows')
  assert.ok(styles.includes('.ra-sort-button:focus-visible') && styles.includes('.ra-pagination'), 'Report tables require responsive accessible controls')
})

check('Institution operations lists are paginated without changing their domain workflows', () => {
  const operations = read('src/components/InstitutionOperationsWorkspace.tsx')
  const styles = read('src/styles/institution-operations.css')
  for (const value of ['listPage', 'pageSize=10', 'function pageRows', 'function pageControls', 'viewRowCount', 'pageRows(visibleQuestions)', 'pageRows(visiblePapers)', 'pageRows(visibleCurriculum)', 'pageRows(rows)', 'pageRows(completed)', 'pageRows(visibleAssets)', 'pageRows(visibleMaintenance)']) {
    assert.ok(operations.includes(value), 'Institution operations pagination is missing: ' + value)
  }
  for (const domain of ['renderQuestionBank', 'renderCurriculum', 'renderBehaviour', 'renderCertificates', 'renderVisitors', 'renderFacilities']) {
    assert.ok(operations.includes('function ' + domain), 'Dedicated operations domain is missing: ' + domain)
  }
  assert.ok(styles.includes('.iop-pagination') && styles.includes('.iop-global-pagination'), 'Operations pagination needs responsive styles')
})

check('Campus library inventory and transport registers support independent search and pagination', () => {
  const linked = read('src/components/LinkedOperationsWorkspace.tsx')
  const styles = read('src/styles/institutional-premium.css')
  for (const value of ['visibleCampuses', 'visibleLoans', 'visibleStockRows', 'visibleMovements', 'visibleAllocations', 'visibleRouteRows', 'pageRows(visibleCampuses,campusPage)', 'pageRows(visibleLoans,libraryPage)', 'pageRows(visibleStockRows,inventoryPage)', 'pageRows(visibleMovements,movementPage)', 'pageRows(visibleAllocations,allocationPage)', 'pageRows(visibleRouteRows,routePage)']) {
    assert.ok(linked.includes(value), 'Linked operations list feature is missing: ' + value)
  }
  for (const value of ['Search campuses', 'Search circulation', 'Search inventory', 'Search stock movements', 'Search route utilisation', 'Search transport allocations']) {
    assert.ok(linked.includes(value), 'Linked operations search is missing: ' + value)
  }
  assert.ok(styles.includes('.ed360-linked-search:focus-within') && styles.includes('.ed360-linked-pagination'), 'Linked operations filters and page controls need responsive focus styling')
})

check('Campus and branch editor maintains the saved head and scoped settings fields', () => {
  const operations = read('src/components/LinkedOperationsWorkspace.tsx')
  for (const value of ['branch_head_name','academic_settings','operational_settings','campusBranchHead','campusAcademicSettings','campusOperationalSettings']) {
    assert.ok(operations.includes(value), 'Campus editor is missing: ' + value)
  }
  assert.ok(operations.includes('Academic settings (JSON object)') && operations.includes('Operational settings (JSON object)'), 'Campus-specific settings need dedicated validated editors')
})

check('Linked library inventory and transport ledgers load all pages from Supabase', () => {
  const linked = read('src/components/LinkedOperationsWorkspace.tsx')
  assert.ok(linked.includes('async function loadAllPages'), 'Unbounded Supabase page reader is missing')
  assert.ok(linked.includes("loadAllPages<Loan>") && linked.includes("loadAllPages<Movement>") && linked.includes("loadAllPages<Allocation>"), 'Library loans, inventory movements and transport allocations must load every database page')
  assert.ok(linked.includes('.range(from,to)'), 'Linked operational data must use explicit server-side page ranges')
  assert.ok(!linked.includes(".limit(500)") && !linked.includes(".limit(1000)"), 'Linked operations must not silently truncate circulation, movements or allocations')
  for (const value of ['visibleCampuses','visibleLoans','visibleStockRows','visibleMovements','visibleAllocations','visibleRouteRows','pageRows','pageControls']) {
    assert.ok(linked.includes(value), 'Linked operation list interaction is missing: ' + value)
  }
})

check('Private file controls match institution storage permissions', () => {
  assert.equal(packageJson.scripts['test:file-access'], 'node scripts/test-file-access.mjs')
  const files = read('src/components/FilesModule.tsx')
  assert.ok(files.includes('canUploadInstitutionFiles(user?.role)'))
  assert.ok(files.includes('canDeleteInstitutionFiles(user?.role)'))
  const access = read('src/lib/fileAccess.ts')
  assert.ok(access.includes("role === 'owner' || role === 'admin' || role === 'teacher'"))
  assert.ok(access.includes("role === 'owner' || role === 'admin'"))
  assert.ok(files.includes('{canUpload && <label'))
  assert.ok(files.includes('{canDelete && <button'))
  assert.ok(files.includes('ALLOWED_FILE_TYPES'))
  for (const mime of ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'application/msword']) {
    assert.ok(files.includes(mime), `Allowed file type ${mime} missing from client validation`)
  }
})

check('Shared record reader retrieves every institution-scoped database page before role filtering', () => {
  const data = read('src/lib/data.ts')
  for (const value of ['const pageSize = 500', 'for (let from = 0; ; from += pageSize)', '.range(from, from + pageSize - 1)', ".order(table === 'institutional_audit_events' ? 'occurred_at' : 'created_at', { ascending: false })", ".order('id', { ascending: true })", 'return filterRowsForRole(mode, user, table, rows)']) {
    assert.ok(data.includes(value), 'Shared data reader pagination is missing: ' + value)
  }
  const readerStart = data.indexOf('export async function listRecords')
  const readerEnd = data.indexOf('export async function createRecord', readerStart)
  const reader = data.slice(readerStart, readerEnd)
  assert.ok(reader.includes('rows.push(...page)') && reader.includes('if (page.length < pageSize) break'), 'The shared reader must continue until the final partial page')
  assert.ok(!reader.includes('.limit('), 'The shared record reader must not hard-cap institution rows')
})

check('Module definitions and generic CRUD table allowlist remain valid', () => {
  assert.ok(modules.length >= 10, 'Expected core module definitions')
  assert.equal(new Set(modules.map(module => module.key)).size, modules.length)
  for (const module of modules) {
    assert.ok(module.roles.length > 0, `${module.key} has no allowed roles`)
    assert.ok(module.table && module.title, `${module.key} is missing its table/title`)
  }
  const dataSource = read('src/lib/data.ts')
  const allowlistBlock = dataSource.match(/const ALLOWED_TABLES = new Set\(\[([\s\S]*?)\]\)/)
  assert.ok(allowlistBlock, 'ALLOWED_TABLES was not found')
  const tables = [...allowlistBlock[1].matchAll(/'([a-z_]+)'/g)].map(match => match[1])
  for (const module of modules) {
    assert.ok(tables.includes(module.table), `${module.key} points to a table outside ALLOWED_TABLES: ${module.table}`)
  }
  assert.ok(tables.length >= 15)
  assert.ok(tables.includes('fee_invoices'))
  assert.ok(tables.includes('fee_payments'), 'The finance workspace needs institution-scoped receipt history')
  const readOnlyBlock = dataSource.match(/const READ_ONLY_TABLES = new Set\(\[([\s\S]*?)\]\)/)
  assert.ok(readOnlyBlock, 'READ_ONLY_TABLES was not found')
  const readOnlyTables = [...readOnlyBlock[1].matchAll(/'([a-z_]+)'/g)].map(match => match[1])
  for (const table of ['fee_payments','fee_payment_allocations','fee_audit_logs','employee_salary_profiles','payroll_runs','payroll_items']) {
    assert.ok(readOnlyTables.includes(table), table + ' must be read-only to generic CRUD')
  }
  assert.ok(dataSource.includes("rpc('record_fee_payment'"), 'Payment creation must remain on its atomic RPC')
  for (const operation of ['createRecord', 'updateRecord', 'deleteRecord', 'recordFeePayment']) assert.ok(dataSource.includes(`export async function ${operation}`), `${operation} is missing`)
})

check('Student Record is a complete permission-aware multi-window workspace', () => {
  const recordModule = read('src/components/RecordModule.tsx')
  const dataSource = read('src/lib/data.ts')
  for (const label of ['Overview', 'Admissions', 'Student Directory', 'Student Profile', 'Class Placement', 'Promotion', 'Guardians', 'Student Attendance', 'Student Exam Results', 'Student Assignments', 'Student Timetable', 'Student Documentation', 'Fee Records', 'Health & Emergency', 'Student History']) {
    assert.ok(recordModule.includes("label: '" + label + "'"), 'Student workspace window is missing: ' + label)
  }
  const studentWorkspaceStart = recordModule.indexOf("if (module.key === 'students') {", recordModule.indexOf('export function RecordModule'))
  const studentWorkspaceEnd = recordModule.indexOf("if (module.key === 'teachers') {", studentWorkspaceStart)
  const studentWorkspace = recordModule.slice(studentWorkspaceStart, studentWorkspaceEnd)
  for (const table of ['attendance', 'exams', 'exam_results', 'assignments', 'assignment_submissions', 'timetable_entries', 'classes', 'academic_sessions', 'programs', 'guardian_students', 'parent_guardians', 'student_placements', 'student_documents', 'fee_invoices', 'fee_payments', 'student_health_emergency', 'student_history']) {
    assert.ok(recordModule.includes("'" + table + "'"), 'Student workspace is missing related data source: ' + table)
  }
  assert.ok(studentWorkspace.includes("studentWorkspaceTab === 'fees'") && studentWorkspace.includes("studentWorkspaceTab === 'health'"), 'Student profiles must expose linked fee history and restricted health information')
  assert.ok(recordModule.includes('studentRelatedTables.filter') && recordModule.includes('visibleTables.map'), 'Student related workspaces must load linked records while excluding restricted health data for other roles')
  const dashboardSource = read('src/components/Dashboard.tsx')
  assert.ok(dashboardSource.includes('key={tab.id}') && dashboardSource.includes('initialWindow={tab.targetWindow}'), 'Student workspace destinations must open in their own persistent dashboard window')
  assert.ok(dashboardSource.includes("showWindowNavigation={tab.targetKey !== 'students'}"), 'Student sidebar tabs must not duplicate the internal student-window navigation')
  assert.ok(recordModule.includes('showWindowNavigation = true') && recordModule.includes('showWindowNavigation && ('), 'Student sidebar windows must not be duplicated by a second copy of the same window navigation')
  assert.ok(recordModule.includes('setStudentWorkspaceTab'), 'Student workspace windows must navigate independently inside Student Record')
  assert.ok(recordModule.includes('Student admission saved successfully.'), 'Student admission confirmation is missing')
  assert.ok(recordModule.includes('Do not submit this admission again'), 'Unconfirmed admissions must not encourage duplicate submission')
  assert.ok(recordModule.includes('This admission number is already registered'), 'Duplicate admission numbers must be checked before insert')
  assert.ok(recordModule.includes('async function updateAdmissionStatus'), 'Admission review and approval workflow is missing')
  assert.ok(recordModule.includes("application_status: nextStatus"), 'Admission status transitions are not persisted')
  assert.ok(recordModule.includes('async function saveGuardianContact') && recordModule.includes("'guardian_students'"), 'Guardian contacts must be linked to students')
  assert.ok(recordModule.includes('async function saveStudentPlacement') && recordModule.includes("'student_placements'"), 'Class placement must use linked class records')
  assert.ok(recordModule.includes("studentWorkspaceTab === 'promotion'") && recordModule.includes('ed360-student-promotion-workspace'), 'Student promotion must have its own dedicated workspace')
  assert.ok(recordModule.includes("setStudentWorkspaceTab('promotion')") && recordModule.includes('placementSaving'), 'Promotion navigation and duplicate-save protection must be connected')
  assert.ok(recordModule.includes('selectedClass.id === activeStudentPlacement?.class_id') && recordModule.includes('placementEffectiveFrom < currentEffectiveFrom'), 'Promotion must reject same-class and earlier-than-current placement dates')
  assert.ok(recordModule.includes("from('student-files')") && recordModule.includes('async function uploadStudentDocument'), 'Private student document upload is missing')
  assert.ok(recordModule.includes("studentHistoryRows.map(event") && recordModule.includes("'student_history'"), 'Student History must render database audit events')
  for (const trigger of ['attendance_student_history_audit', 'exam_results_student_history_audit', 'assignment_submissions_student_history_audit']) assert.ok(read('supabase/migrations/20261109094108_student_activity_history_events.sql').includes(trigger), `Student history trigger is missing: ${trigger}`)
  assert.ok(dataSource.includes("const READ_ONLY_TABLES = new Set(") && dataSource.includes("'student_history'"), 'Student audit history must be read-only to the client')
  assert.ok(dataSource.match(/const READ_ONLY_TABLES = new Set\(\[([\s\S]*?)\]\)/)?.[1].includes("'student_history'"), 'Student audit history must remain within the generic read-only table set')
  assert.ok(recordModule.includes("isStudent && field.name === 'status'") && recordModule.includes("? 'pending'"), 'New student admissions must start in Pending status')
  assert.ok(dataSource.includes("if (table === 'students')"), 'Student insertion must use its specific authorization-safe path')
  assert.ok(dataSource.includes("rpc('has_institution_role'") || dataSource.includes("rpc('has_institution_role',"), 'Student admission must verify existing owner/admin authorization')
  assert.ok(recordModule.includes('The database accepted this admission'), 'Student admission must distinguish database insert from read-back confirmation')
  const dashboard = read('src/components/Dashboard.tsx')
  const navStart = dashboard.indexOf('<nav className="pro-navigation"')
  const navEnd = dashboard.indexOf('</nav>', navStart)
  const quickStart = dashboard.indexOf('className="pro-quick-access"')
  assert.ok(quickStart > navEnd, 'Quick Access must remain outside the scrollable menu')
  const workspaceCss = read('src/styles/module-workspaces.css')
  assert.ok(workspaceCss.includes('.ed360-student-window-nav') && workspaceCss.includes('.ed360-student-profile-grid'), 'Student workspace styling is missing')
})

check('Faculty & Employee Management uses dedicated institution-scoped HR workspaces', () => {
  const faculty = read('src/components/FacultyWorkspace.tsx')
  for (const label of ['Overview', 'Employee Registration', 'All Employees', 'Employee Profile', 'Departments', 'Designations', 'Teaching Assignments', 'Faculty Attendance', 'Leave Management', 'Workload & Timetable', 'Documents', 'Qualifications', 'Employment History', 'Staff Reports']) {
    assert.ok(faculty.includes("label:'" + label + "'") || faculty.includes("label: '" + label + "'"), 'Faculty workspace window is missing: ' + label)
  }
  for (const table of ['designations', 'teacher_assignments', 'employee_attendance', 'employee_leave_requests', 'staff_documents', 'employee_history']) {
    assert.ok(faculty.includes("'" + table + "'"), 'Faculty workspace is missing its dedicated data source: ' + table)
    assert.ok(read('src/lib/data.ts').includes("'" + table + "'"), 'Generic cloud data allowlist is missing: ' + table)
  }
  assert.ok(faculty.includes("from('staff-files')"), 'Confidential documents must use the dedicated private staff-files bucket')
  assert.ok(faculty.includes('createSignedUrl'), 'Staff documents must be retrieved with signed URLs')
  assert.ok(faculty.includes('EmployeeQualificationsPanel') && read('src/components/EmployeeQualificationsPanel.tsx').includes('employee_qualifications'), 'Faculty workspace must expose institution-scoped qualification records')
  const dashboard = read('src/components/Dashboard.tsx')
  assert.ok(dashboard.includes('<FacultyWorkspace onToast={onToast} onNavigate={navigateChild} initialWindow={tab.targetWindow}/>'), 'Existing dashboard must route Faculty & Staff into their selected nested workspace')
  const migration = read('supabase/migrations/20261109085154_faculty_employee_management.sql')
  for (const required of ['enable row level security', 'teacher_assignments', 'employee_attendance', 'employee_leave_requests', 'staff_documents', 'employee_history', 'staff-files', 'teachers_owner_admin_or_self_read', 'audit_teacher_history']) {
    assert.ok(migration.includes(required), 'Faculty management migration is missing: ' + required)
  }
  assert.ok(!migration.includes('drop table') && !migration.includes('truncate '), 'Faculty management migration must remain additive and non-destructive')
})

check('Finance menu destinations open the dedicated fee and ledger workspace', () => {
  assert.equal(getNavigationRoute('fees', 'Fee Structure'), 'finance:fees:structures')
  assert.equal(getNavigationRoute('fees', 'Fee Invoices'), 'finance:fees:invoices')
  assert.equal(getNavigationRoute('fees', 'Payment Collection'), 'finance:fees:payments')
  assert.equal(getNavigationRoute('receivables', 'Ageing Analysis'), 'finance:receivables:receivables')
  assert.equal(getNavigationRoute('payments', 'Refund Processing'), 'finance:payments:refunds')
  assert.equal(getNavigationRoute('receipts', 'Fee Receipts'), 'finance:receipts:receipts')
  assert.equal(getNavigationRoute('accounts-finance', 'Chart of Accounts'), 'finance:accounts-finance:accounts')
  assert.equal(getNavigationRoute('accounts-finance', 'General Ledger'), 'finance:accounts-finance:journals')
  const finance = read('src/components/FinanceWorkspace.tsx')
  for (const value of ['recordFeePayment', 'fee_structures', 'fee_structure_items', 'fee_discounts', 'fee_refunds', 'finance_accounts', 'finance_journals', 'post_finance_journal']) {
    assert.ok(finance.includes(value), 'Finance workflow is missing ' + value)
  }
  assert.ok(finance.includes('Refund request recorded for manual processing'), 'Refund workflow must not claim an external payment-provider transfer')
  assert.ok(read('src/lib/data.ts').includes("rpc('record_fee_payment'"), 'Fee payments must use the atomic record_fee_payment database operation')
})

check('Payroll routes use database salary, approval and payment workflows', () => {
  assert.equal(getNavigationRoute('payroll', 'Payroll Dashboard'), 'payroll:overview')
  assert.equal(getNavigationRoute('payroll', 'Salary Structure'), 'payroll:salary')
  assert.equal(getNavigationRoute('payroll', 'Monthly Payroll'), 'payroll:runs')
  assert.equal(getNavigationRoute('payroll', 'Payslips'), 'payroll:payslips')
  const payroll = read('src/components/PayrollWorkspace.tsx')
  for (const value of ['employee_salary_profiles', 'generate_payroll_run', 'approve_payroll_run', 'mark_payroll_run_paid', 'save_employee_salary_profile']) {
    assert.ok(payroll.includes(value), 'Payroll workflow is missing ' + value)
  }
  for (const value of ['employee_salary_components','payroll_adjustments','create_payroll_adjustment','review_payroll_adjustment']) assert.ok(payroll.includes(value), 'Payroll component and adjustment workflow is missing: '+value)
  const stage6Salary = read('supabase/migrations/20261111170358_stage_6_employee_salary_components_own_read.sql')
  assert.ok(stage6Salary.includes('employee_salary_components'))
  assert.ok(read('supabase/migrations/20261111170659_stage_6_employee_appraisal_acknowledgement.sql').includes('acknowledge_employee_appraisal'))
  const migration = read('supabase/migrations/20261109150048_finance_accounting_and_payroll_workflows.sql')
  for (const value of ['enable row level security', 'finance_journal_lines_one_side', 'post_finance_journal', 'generate_payroll_run', 'approve_payroll_run', 'mark_payroll_run_paid', 'revoke all on function']) {
    assert.ok(migration.includes(value), 'Finance/payroll database safeguard is missing: ' + value)
  }
  assert.ok(read('supabase/migrations/20261109150654_atomic_employee_salary_profile_workflow.sql').includes('save_employee_salary_profile'))
  assert.ok(read('supabase/migrations/20261109150857_employee_own_payroll_run_read.sql').includes('payroll_runs_employee_own_read'))
})

check('Question bank and paper designer use tenant-safe records and guarded approval', () => {
  for (const [label,expected] of [
    ['Question Bank Dashboard','pool'],['Question Paper Designer','papers'],['Question Review','pool'],['Question Paper Download','papers'],
  ]) assert.ok(getNavigationRoute('question-bank',label).startsWith('operations:question-bank:'+expected), label+' must open the question bank workspace')
  const operations=read('src/components/InstitutionOperationsWorkspace.tsx')
  for (const value of ['question_bank_items','assessment_papers','assessment_paper_items','curriculum_units','student_behaviour_events','student_certificates','visitor_entries','facility_assets','facility_maintenance_requests']) {
    assert.ok(operations.includes(value), 'Institution operations UI is missing '+value)
  }
  assert.ok(operations.includes("rpc('approve_assessment_paper'") || operations.includes("rpc('approve_assessment_paper'"), 'Paper approval must use the guarded database function')
  const migration=read('supabase/migrations/20261109153658_academic_studentcare_and_campus_operations.sql')
  for (const value of ['enable row level security','question_bank_items','assessment_papers','assessment_paper_items','curriculum_units','student_behaviour_events','student_certificates','visitor_entries','facility_assets','facility_maintenance_requests','public.can_view_student']) {
    assert.ok(migration.includes(value), 'Institution operations schema/policy is missing '+value)
  }
  const approval=read('supabase/migrations/20261109155028_question_paper_approval_and_line_removal.sql')
  for (const value of ['approve_assessment_paper','maximum_marks','question_bank_items','revoke all on function','assessment_paper_items_delete']) {
    if(value==='assessment_paper_items_delete') continue
    assert.ok(approval.includes(value), 'Question paper approval safeguard is missing '+value)
  }
  assert.ok(operations.includes("status==='safeguarding'&&v.family_visible==='true'") || operations.includes("event_type==='safeguarding'"), 'Safeguarding events must not be exposed through family visibility')
  assert.ok(operations.includes("row.status==='issued'") && operations.includes('verification_code'), 'Issued certificates must support institution register verification')
})

check('Administration settings, approvals and audit are connected to governance tables', () => {
  assert.equal(getNavigationRoute('administration', 'Institute Profile'), 'governance:profile')
  assert.equal(getNavigationRoute('administration', 'Institute Settings'), 'governance:settings')
  assert.equal(getNavigationRoute('administration', 'Approval Workflows'), 'governance:approvals')
  assert.equal(getNavigationRoute('administration', 'Department Directory'), 'governance:departments')
  assert.equal(getNavigationRoute('administration', 'Designation Catalogue'), 'governance:designations')
  assert.equal(getNavigationRoute('administration', 'Student Policies'), 'governance:policies-students')
  assert.equal(getNavigationRoute('administration', 'Faculty Policies'), 'governance:policies-faculty')
  assert.equal(getNavigationRoute('administration', 'Academic Structure & Sections'), 'governance:academic')
  assert.equal(getNavigationRoute('administration', 'Administrative Audit'), 'governance:audit')
  const administration = read('src/components/AdministrationStage5Workspace.tsx')
  for (const value of ['institution_settings', 'workflow_approvals', 'institutional_audit_events', 'decide_institution_setting_approval']) {
    assert.ok(administration.includes(value), 'Administration workspace is missing ' + value)
  }
  assert.ok(administration.includes('Save Institute Profile') && administration.includes("supabase.from('institutions').update(values)"), 'Institute Profile must use its existing owner/admin update path')
  for (const section of ['Institute Identity','Contact Details','Public Profile']) assert.ok(administration.includes(section), 'Institute Profile is missing its dedicated section: ' + section)
  assert.ok(administration.includes('ed360-admin-profile-v2') && administration.includes('ed360-profile-public-card') && administration.includes('logoPreviewUrl'), 'Institute Profile must render the live identity preview and local logo preview')
  assert.ok(read('supabase/migrations/20261109151231_atomic_institution_setting_approval.sql').includes('decide_institution_setting_approval'))
})

check('Administration membership controls use the protected tenant access procedure', () => {
  const administration = read('src/components/AdministrationStage5Workspace.tsx')
  const migration = read('supabase/migrations/20261111161307_stage5_administration_profile_campus_and_access_controls.sql')
  for (const value of ["select('id,user_id,role,status,created_at')", "set_institution_membership_status", 'p_institution_id:user!.institutionId', 'p_membership_id:member.id', "member.role==='owner'", 'member.user_id===user?.id', "['active','suspended'].includes(member.status)", 'Reactivate access', 'Suspend access']) {
    assert.ok(administration.includes(value), 'Administration membership access control is missing: ' + value)
  }
  for (const value of ["p_status not in ('active','suspended')", "array['owner','admin']::text[]", 'v_membership.role = \'owner\'', 'v_membership.user_id = auth.uid()', 'p_membership_id', 'p_institution_id']) {
    assert.ok(migration.includes(value), 'Membership access procedure is missing safeguard: ' + value)
  }
})

check('Student and employee ID cards are printed from selected verified records', () => {
  const students = read('src/components/RecordModule.tsx')
  const staff = read('src/components/FacultyWorkspace.tsx')
  const studentCss = read('src/styles/module-workspaces.css')
  const staffCss = read('src/styles/faculty-workspace.css')
  for (const feature of ["'id-cards'","Student identity card","selectedStudent.admission_no","activeStudentClass?.name","window.print()"]) assert.ok(students.includes(feature), 'Student ID card feature is missing: ' + feature)
  for (const feature of ["'id-cards'","Employee identity card","selected.employee_no","departmentFor(selected.department_id)","window.print()"]) assert.ok(staff.includes(feature), 'Employee ID card feature is missing: ' + feature)
  assert.ok(studentCss.includes('.ed360-student-id-card') && studentCss.includes('@page{size:85.6mm 54mm;margin:0}'), 'Student ID card print layout is missing')
  assert.ok(students.includes("downloadCsv('edusphere-students-'") && students.includes('studentFiltered.map'), 'Student data export must export only the filtered records the current role may view')
  assert.ok(staffCss.includes('.staff-id-card-print') && staffCss.includes('@page{size:85.6mm 54mm;margin:0}'), 'Employee ID card print layout is missing')
})
check('Timetable workspace exposes schedule resources and detects real conflicts', () => {
  const views = read('src/lib/operationalWorkspaceViews.ts')
  const record = read('src/components/RecordModule.tsx')
  for (const key of ["view('classes'", "view('teachers'", "view('rooms'", "view('conflicts'", "view('history'"]) assert.ok(views.includes(key), 'Timetable view is missing: ' + key)
  assert.ok(record.includes('timetableConflictIds') && record.includes('const overlaps =') && record.includes("activeOperationalView.key === 'conflicts'"), 'Timetable conflicts must be derived from saved class/teacher/room overlaps')
})
check('Employee and payroll report workspaces use role-scoped live database records', () => {
  const reports = read('src/components/ReportsAnalyticsWorkspace.tsx')
  for (const value of ['payroll_runs','payroll_items','Employee Reports','Payroll Reports','teachers','payroll']) assert.ok(reports.includes(value), 'Report workflow feature is missing: ' + value)
  assert.ok(reports.includes('listRecords(mode,user!,key)'), 'Report sources must use the existing role-aware record reader')
  assert.ok(reports.includes(".eq('institution_id',user!.institutionId)"), 'Payroll queries must be institution-scoped')
})
check('Transport allocation and cancellation use atomic tenant-scoped capacity controls', () => {
  const migration = read('supabase/migrations/20261110082738_atomic_transport_allocations.sql')
  const linked = read('src/components/LinkedOperationsWorkspace.tsx')
  for (const value of ['create_student_transport_allocation','end_student_transport_allocation','for update','seat capacity','effective_from <= coalesce']) {
    assert.ok(migration.toLowerCase().includes(value.toLowerCase()), 'Transport allocation safeguard is missing: ' + value)
  }
  assert.ok(linked.includes("rpc('create_student_transport_allocation'") && linked.includes("rpc('end_student_transport_allocation'"), 'Transport UI must use the atomic database functions')
  assert.ok(!linked.includes("from('student_transport_allocations').insert("), 'Transport allocation must not bypass the database transaction')
})
check('Library checkout and return run as atomic tenant-scoped transactions', () => {
  const migration = read('supabase/migrations/20261110082731_atomic_library_circulation.sql')
  const linked = read('src/components/LinkedOperationsWorkspace.tsx')
  for (const value of ['issue_library_book','return_library_book','security invoker','pg_advisory_xact_lock','All registered copies of this book are currently issued','v_late_days * v_daily_fine']) {
    assert.ok(migration.toLowerCase().includes(value.toLowerCase()), 'Atomic library circulation safeguard is missing: ' + value)
  }
  const advisoryLockStart = migration.indexOf('pg_advisory_xact_lock')
  const bookReadStart = migration.indexOf('select * into v_book')
  const bookReadEnd = migration.indexOf('if not found then raise exception', bookReadStart)
  const bookRead = migration.slice(bookReadStart, bookReadEnd)
  assert.ok(advisoryLockStart >= 0 && advisoryLockStart < bookReadStart, 'Library checkout must take its per-book advisory lock before reading the copy count')
  assert.ok(!bookRead.includes('for update'), 'Library checkout must not require UPDATE access to the admin-managed book catalogue')
  assert.ok(migration.includes('select * into v_loan') && migration.includes('for update'), 'Returning a library loan must lock its own loan record')
  assert.ok(linked.includes("rpc('issue_library_book'") && linked.includes("rpc('return_library_book'"), 'Library UI must use the atomic database functions')
  assert.ok(!linked.includes("from('library_loans').insert("), 'Library checkout must not bypass the atomic checkout function')
})
check('Institution-wide catalogues are admin-managed at both UI and RLS layers', () => {
  const migration = read('supabase/migrations/20261110082719_institutional_catalog_permissions.sql')
  const workspace = read('src/components/InstitutionalWorkspace.tsx')
  const teacherRoleStart = migration.indexOf("public.has_institution_role(institution_id, array['teacher'])")
  const teacherPolicyStart = migration.indexOf('and module_key = any(array[', teacherRoleStart)
  const teacherPolicyEnd = migration.indexOf('])', teacherPolicyStart)
  assert.ok(teacherRoleStart >= 0 && teacherPolicyStart > teacherRoleStart && teacherPolicyEnd > teacherPolicyStart, 'Teacher insert policy must remain explicitly scoped')
  const teacherPolicy = migration.slice(teacherPolicyStart, teacherPolicyEnd)
  for (const module of ["'library'","'transport'","'facilities'","'visitors'","'certificates'"]) {
    assert.ok(!teacherPolicy.includes(module), 'Teacher insert policy must not grant generic catalogue writes for ' + module)
  }
  const teacherUiStart = workspace.indexOf("(user.role==='teacher'&&[")
  const teacherUiEnd = workspace.indexOf('].includes(group.dataModule)', teacherUiStart)
  assert.ok(teacherUiStart >= 0 && teacherUiEnd > teacherUiStart, 'Teacher write UI must remain explicitly scoped')
  const teacherUi = workspace.slice(teacherUiStart, teacherUiEnd)
  for (const module of ["'library'","'transport'","'facilities'","'visitors'","'certificates'"]) {
    assert.ok(!teacherUi.includes(module), 'Teacher UI must not offer generic catalogue writes for ' + module)
  }
  assert.ok(migration.includes("public.has_institution_role(institution_id, array['owner','admin'])"))
  assert.ok(teacherPolicy.includes("'academic_setup','attendance','timetable','teaching','behaviour'"))
  const unavailable = read('src/components/WorkspaceUnavailable.tsx')
  for (const phrase of ['model provider','Automated cloud backups','external messaging']) assert.ok(unavailable.includes(phrase), 'Unavailable integrations must explain the missing dependency: ' + phrase)
  for (const phrase of ['A safe batch-processing workflow','An employee appraisal workflow','configurable and scheduled report engine','transport-specific boarding']) assert.ok(unavailable.includes(phrase), 'Unsupported domain workflow must explain its dependency: ' + phrase)
})
check('Dashboard first-run guidance is role-specific and reports only saved-record signals', () => {
  const dashboard = read('src/components/Dashboard.tsx')
  const styles = read('src/styles/pro-dashboard.css')
  assert.ok(dashboard.includes('ed360-start-panel'), 'Dashboard guidance panel is missing')
  assert.ok(dashboard.includes('const workspaceGuide ='), 'Role-specific guidance configuration is missing')
  for (const role of ['owner', 'teacher', 'student', 'parent', 'accountant']) {
    assert.ok(dashboard.includes("user!.role === '" + role + "'"), 'Missing dashboard guidance for ' + role)
  }
  assert.ok(dashboard.includes('Your examination workbench'), 'Examination Officer guidance is missing')
  assert.ok(dashboard.includes('hasRecords('), 'Guidance must derive states from loaded records')
  assert.ok(dashboard.includes('Status is based on saved records visible to your signed-in role'), 'Guidance must explain its evidence boundary')
  assert.ok(!dashboard.includes('sampleData') && !dashboard.includes('seededRecords'), 'Guidance must not use sample records')
  for (const route of ['admin:academic_sessions','students:admissions','attendance:students','finance:fees:invoices','reports:finance','exam_results:published']) {
    assert.ok(dashboard.includes(route), 'Missing existing workspace action route: ' + route)
  }
  assert.ok(styles.includes('.ed360-start-panel') && styles.includes('@media(max-width:640px)'), 'Guidance must have responsive styling')
})

check('Dashboard entry points resolve to the intended role-specific operational workspaces', () => {
  assert.equal(getNavigationRoute('fees', 'Fee Invoices', 'owner'), 'finance:fees:invoices')
  assert.equal(getNavigationRoute('fees', 'Payment Collection', 'accountant'), 'finance:fees:payments')
  assert.equal(getNavigationRoute('receivables', 'Total Outstanding', 'accountant'), 'finance:receivables:receivables')
  assert.equal(getNavigationRoute('question-bank', 'Question Bank Dashboard', 'exam_officer'), 'operations:question-bank:pool')
  assert.equal(getNavigationRoute('students', 'Student Profiles', 'parent'), 'students:profile')
  assert.equal(getNavigationRoute('teaching', 'Homework', 'teacher'), 'assignments:open')
  assert.equal(getNavigationRoute('timetable', 'Timetable Dashboard', 'student'), 'timetable:week')
})

check('Teacher reporting routes expose only the teacher-permitted report datasets', () => {
  const reports = read('src/components/ReportsAnalyticsWorkspace.tsx')
  assert.ok(reports.includes('listRecords(mode,user!,key)'), 'Teacher report data must flow through role-aware listRecords permissions')
  assert.ok(reports.includes("'attendance'" ) && reports.includes("'exam_results'"), 'Teacher report workspace must include permitted attendance and examination datasets')
})
 
check('EduSphere 360 GitHub release pipeline verifies and deploys only its dedicated public website', () => {
  const workflow = read('.github/workflows/cloudflare-pages-release.yml')
  for (const phrase of ['workflow_dispatch', 'npm ci --no-audit --no-fund', 'npm run verify:project', 'npm run test:user-errors', 'npm run test:finance', 'npm run test:file-access', 'npm run build', 'edusphere360-cloudflare-direct-upload.zip', 'cloudflare/wrangler-action@v4']) {
    assert.ok(workflow.includes(phrase), `Release workflow is missing ${phrase}`)
  }
  assert.ok(workflow.includes('inputs.deploy_production == true'), 'Manual production redeployment must require explicit approval')
  assert.ok(workflow.includes('Generate responsive source coverage audit') && workflow.includes('edusphere360-responsive-source-audit'), 'Responsive source evidence must be generated and uploaded in CI')
  assert.ok(workflow.includes('edusphere360-dist') && workflow.includes('edusphere360-exact-route-audit') && workflow.includes('edusphere360-route-view-audit'), 'Production and audit artifacts must use the EduSphere 360 project name')
  assert.ok(!workflow.includes('deploy-preview'), 'Pull requests must not create a Cloudflare preview deployment')
  assert.ok(!workflow.includes("github.event_name == 'push'") && workflow.includes("github.event_name == 'workflow_dispatch'") && workflow.includes("github.ref == 'refs/heads/main'") && workflow.includes('inputs.deploy_production == true'), 'Production deployment must remain manual and explicitly approved after main-branch verification')
  assert.ok(workflow.includes('secrets.CLOUDFLARE_API_TOKEN') && workflow.includes('secrets.CLOUDFLARE_ACCOUNT_ID'))
  assert.ok(!workflow.includes('gidcbadin'), 'EduSphere release must never deploy to the separate GIDC Pages project')
  assert.ok(workflow.includes('vars.VITE_SUPABASE_URL') && workflow.includes('vars.VITE_SUPABASE_PUBLISHABLE_KEY'))
  assert.ok(!workflow.includes('SUPABASE_SERVICE_ROLE_KEY'), 'A Supabase service-role key must never be a frontend build variable')
})

check('Required database safeguards and Cloudflare redirects remain in the project', () => {
  const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(name => name.endsWith('.sql')).sort()
  for (const migration of ['001_initial_schema.sql', '017_public_institution_signup.sql', '018_assessment_metadata_and_result_visibility.sql', '019_phase_two_integrity_guards.sql', '020_fee_payment_date_validation.sql', '20261108053651_owner_signup_institution_details.sql', '20261109085154_faculty_employee_management.sql', '20261109092734_student_management_operations.sql', '20261109092920_student_management_scope_indexes_and_guardian_portal_read.sql', '20261109094108_student_activity_history_events.sql', '20261109094402_student_guardian_policy_consolidation_and_activity_indexes.sql', '20261109105804_institutional_platform_expansion.sql', '20261109110541_institution_attendance_bulk_register.sql', '20261109111818_institutional_policy_and_foreign_key_refinement.sql', '20261109113516_campus_scope_and_inventory_transaction_workflows.sql', '20261109113606_inventory_movement_row_count_safety_fix.sql', '20261109114108_transport_accountant_read_access.sql', '20261109125937_announcement_read_receipts.sql', '20261109130705_announcement_reads_index_and_fee_policy_cleanup.sql', '20261109150048_finance_accounting_and_payroll_workflows.sql', '20261109150654_atomic_employee_salary_profile_workflow.sql', '20261109150857_employee_own_payroll_run_read.sql', '20261109151231_atomic_institution_setting_approval.sql', '20261110082719_institutional_catalog_permissions.sql', '20261110082731_atomic_library_circulation.sql', '20261110082738_atomic_transport_allocations.sql', '20261110091600_fee_discount_approval_and_refund_processing.sql', '20261110092328_atomic_finance_journal_and_discount_limit_validation.sql',
    '20261111165012_stage9_exam_assessment_foundation.sql',
    '20261111165108_stage9_exam_result_workflow_and_online_delivery.sql',
    '20261111170323_stage9_security_rubrics_and_policy_optimization.sql',
    '20261111170350_stage9_online_assessment_manual_review.sql',
    '20261111170921_stage9_weight_scope_validation.sql',
    '20261111161307_stage5_administration_profile_campus_and_access_controls.sql',
    '20261111162254_stage_6_people_hr_and_payroll_controls.sql',
    '20261111162922_20261111193000_academic_sessions_active_members_read.sql',
    '20261111163125_stage7_attendance_leave_student_wellbeing.sql',
    '20261111163838_stage7_rls_policy_tuning.sql',
    '20261111164407_stage_6_employee_qualification_records.sql',
    '20261111164932_stage7_sensitive_access_and_discipline_details.sql',
    '20261111165921_stage8_academic_data_tables.sql',
    '20261111170012_stage8_academic_access_policies.sql',
    '20261111170040_stage8_academic_performance_indexes.sql',
    '20261111170147_stage8_academic_relational_allocations.sql',
    '20261111170233_stage7_branch_scope_and_guardian_message_access.sql',
    '20261111170358_stage_6_employee_salary_components_own_read.sql',
    '20261111170659_stage_6_employee_appraisal_acknowledgement.sql',
    '20261111170722_stage8_timetable_session_and_student_submission_guards.sql',
    '20261113173320_college_custom_role_profiles_and_scope_policies.sql',
    '20261113173552_college_private_permission_guards.sql',
    '20261113174054_college_approval_profile_action_alignment.sql',
    '20261113175058_college_custom_role_high_impact_rpc_guards.sql',
    '20261115060000_attendance_device_event_review_approval.sql'
  ]) {
    assert.ok(migrations.includes(migration), `${migration} missing`)
  }
  const timestamped = migrations.filter(name => /^202611\d{8}_.+\.sql$/.test(name))
  assert.ok(timestamped.length >= 60, 'Expected the timestamped migration history to include the institution, operations, attendance and online-class changes')
  const requiredMigrationFiles = [
    '20261113085725_institution_messages_and_delivery_tracking.sql',
    '20261113090948_hostel_residence_operations.sql',
    '20261113091806_cafeteria_menu_availability_sales.sql',
    '20261113092458_library_reading_history.sql',
    '20261113092730_fee_receipt_issuance_and_numbering.sql',
    '20261113092952_payment_gateway_review_register.sql',
    '20261113093152_facility_asset_lifecycle.sql',
    '20261113094116_scheduled_report_execution_history.sql',
    '20261113094248_institution_helpdesk_ticket_lifecycle.sql',
    '20261113094459_duplicate_detection_review_workflow.sql',
    '20261113145609_institution_dynamic_forms_and_submissions.sql',
    '20261115060000_attendance_device_event_review_approval.sql',
    '20261115070000_native_online_sessions_calling.sql',
    '20261115080000_native_online_sessions_realtime_and_link_guards.sql',
    '20261115100000_native_online_session_public_grants_lockdown.sql',
    '20261115110000_online_session_attendance_reconnect_fix.sql',
    '20261115120000_guardian_online_class_observer_access.sql',
  ]
  for (const migration of requiredMigrationFiles) assert.ok(migrations.includes(migration), migration + ' missing')
  const migrationReadme = read('supabase/migrations/README.md')
  assert.ok(migrationReadme.includes('migration ledger') && migrationReadme.includes('must not be replayed blindly'), 'Migration documentation must state that repository files and the remote migration ledger require reconciliation before applying SQL')
  assert.equal(read('public/_redirects').trim(), '/* /index.html 200')
  const envExample = read('.env.example')
  const gitignore = read('.gitignore')
  assert.ok(envExample.includes('VITE_SUPABASE_URL='))
  assert.ok(envExample.includes('VITE_SUPABASE_PUBLISHABLE_KEY='))
  assert.ok(envExample.includes('REPLACE_ME'))
  assert.ok(gitignore.includes('.env.*') && gitignore.includes('!.env.example'))
})

check('All TypeScript and TSX sources parse without syntax diagnostics', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : /\.tsx?$/.test(entry.name) ? [full] : []
  })
  const sourceFiles = walk(path.join(root, 'src'))
  const diagnostics = []
  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf8')
    const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind)
    for (const diagnostic of parsed.parseDiagnostics ?? []) { const position = parsed.getLineAndCharacterOfPosition(diagnostic.start ?? 0); diagnostics.push(`${path.relative(root, file)}:${position.line + 1}:${position.character + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`) }
  }
  assert.deepEqual(diagnostics, [], diagnostics.join('\n'))
  console.log(`      Parsed ${sourceFiles.length} TypeScript/TSX files.`)
})

check('Unified design system is loaded last and removes global browser zoom', () => {
  const main = read('src/main.tsx')
  const design = read('src/styles/design-system.css')
  const operational = read('src/styles/operational-hierarchy.css')
  assert.ok(main.includes("import './styles/design-system.css'"), 'Unified design system stylesheet must be loaded')
  const navigationRefinement = read('src/styles/navigation-refinement.css')
  assert.ok(main.includes("import './styles/navigation-refinement.css'"), 'Final sidebar refinements must load after the shared visual system')
  assert.ok(navigationRefinement.includes('display: grid !important') && navigationRefinement.includes('.pro-sidebar-collapse:focus-visible'), 'Desktop sidebar collapse control must be visible and keyboard accessible')
  assert.ok(navigationRefinement.includes('@media (max-width: 820px)') && navigationRefinement.includes('min-height: 40px'), 'Mobile navigation targets must remain comfortably tappable')
  assert.ok(navigationRefinement.includes('prefers-reduced-motion: reduce'), 'Navigation transitions must respect reduced-motion preferences')
  assert.ok(main.indexOf("import './styles/design-system.css'") > main.indexOf("import './styles/institutional-premium.css'"), 'Unified design system must load after legacy component styles')
  for (const token of ['--es-brand-950', '--es-brand-900', '--es-primary-600', '--es-teal-700', '--es-canvas', '--es-surface', '--es-success', '--es-warning', '--es-danger']) {
    assert.ok(design.includes(token), 'Missing shared design token ' + token)
  }
  for (const selector of ['.pro-sidebar', '.pro-topbar', '.ed360-dashboard', '.ed360-metric-card', '.ed360-start-panel', '.ed360-module-page', '.ed360-workspace-record-card', '.edm-home', '.es-auth-page', '.fin-stage', '.payroll-stage', '.gov-stage', '.iop-stage']) {
    assert.ok(design.includes(selector), 'The shared design system is missing a cross-screen surface ' + selector)
  }
  assert.ok(!/#root\s*\{[^}]*zoom\s*:/.test(operational), 'Global root zoom must not be used')
  assert.ok(!/zoom\s*:/.test(operational), 'Operational styles must not apply browser-level zoom')
  const luminance = (hex) => {
    const values = [1, 3, 5].map(index => {
      const channel = parseInt(hex.slice(index, index + 2), 16) / 255
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
  }
  const contrast = (left, right) => {
    const a = luminance(left), b = luminance(right)
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  }
  for (const [foreground, background, label] of [
    ['#172B43', '#F3F6FB', 'main ink on canvas'],
    ['#5E7289', '#F3F6FB', 'muted text on canvas'],
    ['#5E7289', '#FFFFFF', 'muted text on white'],
    ['#FFFFFF', '#316FE0', 'white text on primary action'],
    ['#FFFFFF', '#177B55', 'white text on success'],
    ['#FFFFFF', '#9A6718', 'white text on warning'],
    ['#FFFFFF', '#AD4541', 'white text on danger'],
  ]) assert.ok(contrast(foreground, background) >= 4.5, label + ' must meet WCAG AA normal-text contrast')
  assert.ok(read('docs/PHASE_1_DETAILED_AUDIT.md').includes('Phase 1 disposition'), 'Detailed Phase 1 audit document is missing')
  const roleMenu = read('docs/PHASE_1_ROLE_MENU_INVENTORY.md')
  assert.ok(roleMenu.includes('25 visible sidebar groups') && roleMenu.includes('32 route-catalogue groups') && roleMenu.includes('Administration parent menu') && roleMenu.includes('Academic Management parent menu') && roleMenu.includes('People & HR parent menu'), 'Current visible sidebar and consolidated parent workspaces must be documented')
  assert.ok(read('docs/PHASE_2_DESIGN_SYSTEM.md').includes('Core colour tokens'), 'Phase 2 design specification is missing')
  const routeAudit = read('docs/PHASE_1_EXACT_ROUTE_AUDIT.md')
  assert.ok(/Unexpected route families:\*\* 0\./.test(routeAudit), 'Exact route audit must resolve each visible role/menu destination without unknown route families')
  assert.ok(routeAudit.includes('Bare module roots to review:** 0.') && routeAudit.includes('Unexpected route families:** 0.'), 'All role-visible destinations must retain explicit workspace or intentional root routes')
  assert.ok(routeAudit.includes('## Dispatcher coverage') && routeAudit.includes('Unmapped routes:** 0.') && routeAudit.includes('LinkedOperationsWorkspace') && routeAudit.includes('InstitutionalWorkspace') && routeAudit.includes('RecordModule'), 'Every role-visible route must map to a known Dashboard component')
  const responsiveAudit = read('docs/PHASE_2_RESPONSIVE_SOURCE_AUDIT.md')
  assert.ok(responsiveAudit.includes('16 responsive source checks passed') && responsiveAudit.includes('390×844') && responsiveAudit.includes('768×1024'), 'Responsive source coverage audit is missing or incomplete')
  const viewAudit = read('docs/PHASE_1_ROUTE_VIEW_AUDIT.md')
  assert.ok(/Compatibility issues:\*\* 0\./.test(viewAudit), 'Every role-visible destination must request a supported component sub-view')
  assert.ok(viewAudit.includes('Hidden from role workspace tabs') === false, 'Role menus must not expose inaccessible internal workspace tabs')
  assert.ok(routeAudit.includes('### Owner (owner)') && routeAudit.includes('### Student (student)') && routeAudit.includes('### Examination officer (exam_officer)') && routeAudit.includes('Exact route matrix'), 'Exact route audit must list all seven role sections')
  assert.ok(routeAudit.includes('Explicitly unavailable') && routeAudit.includes('acceptance pending'), 'Exact route audit must distinguish unresolved workflows')
})

check('Stage 8 provides all 12 connected academic work areas', () => {
  const academic = read('src/components/AcademicManagementWorkspace.tsx')
  const academicStyles = read('src/styles/academic-management.css')
  const dashboard = read('src/components/Dashboard.tsx')
  const catalog = read('src/lib/institutionalCatalog.ts')
  const routes = read('src/lib/navigationRoutes.ts')
  for (const name of ['Academic Sessions','Classes & Sections','Subjects','Curriculum','Lesson Plans','Timetable','Homework','Learning Materials','Online Learning','Classroom Activities','Academic Calendar','Learning Progress']) {
    assert.ok(catalog.includes(name), 'Stage 8 navigation is missing ' + name)
    assert.ok(academic.includes(name), 'Stage 8 workspace is missing ' + name)
  }
  for (const table of ['academic_sessions','academic_terms','classes','class_teacher_assignments','student_placements','subjects','teacher_assignments','curriculum_units','lesson_plans','timetable_entries','assignments','assignment_submissions','study_materials','learning_courses','learning_course_units','learning_course_progress','classroom_activities','classroom_activity_participants','academic_calendar_events','learning_progress','academic_preferences']) {
    assert.ok(academic.includes("'" + table + "'") || academic.includes(table), 'Academic table is not connected: ' + table)
  }
  assert.ok(academic.includes('online_learning_enabled') && academic.includes('Disable online learning') && academic.includes('Enable online learning'), 'Online learning must remain optional and institution-controlled')
  assert.ok(academic.includes('institution-files') && academic.includes('createSignedUrl'), 'Study materials must use private institution file storage')
  assert.ok(academic.includes('class_id') && academic.includes('teacher_id') && academic.includes('room_id') && academic.includes('start_time') && academic.includes('end_time'), 'Timetable must use the class, teacher, room and period relationships')
  assert.ok(routes.includes("return 'academic:'"), 'Academic menu destinations must route to the Stage 8 workspace')
  assert.ok(dashboard.includes('<AcademicManagementWorkspace'), 'Dashboard must dispatch Stage 8 to its dedicated workspace')
  assert.ok(academicStyles.includes('.ed360-academic-nav') && academicStyles.includes('.ed360-academic-table-wrap') && academicStyles.includes('.ed360-academic-modal'), 'Stage 8 tables, navigation and forms need a unified visual system')
})


check('Academic records validate date ranges, marks and overlapping timetable allocations', () => {
  const academic = read('src/components/AcademicManagementWorkspace.tsx')
  const academicStyles = read('src/styles/academic-management.css')
  const timetable = read('supabase/migrations/20261111165921_stage8_academic_data_tables.sql')
  const guards = read('supabase/migrations/20261111170722_stage8_timetable_session_and_student_submission_guards.sql')
  for (const value of ['function timetableConflictReason', 'if(existing.id&&candidate.id&&existing.id===candidate.id)', 'candidateSession&&existingSession&&candidateSession!==existingSession', 'end<start', 'completion percentage must be between 0 and 100', 'Marks awarded cannot exceed the assignment maximum', 'Timetable conflict: this', "academic_session_id.eq.", ".lt('start_time'", ".gt('end_time'"]) {
    assert.ok(academic.toLowerCase().includes(value.toLowerCase()), 'Academic validation is missing: ' + value)
  }
  assert.ok(academic.includes('getFullYear()') && !academic.includes("new Date().toISOString().slice(0, 10)"), "Academic date defaults must use the user local calendar date")
  assert.ok(academic.includes('async function fetchTable(table: string, loadAll = false)') && academic.includes('query.range(offset, offset + 499)') && academic.includes('fetchTable(activeMode.table,true)'), 'Academic primary records must load in batches rather than stop at 500')
  assert.ok(academic.includes('activeMode.fields.map(field=>field.source)') && academic.includes('fetchTable(sourceTables[source])'), 'Academic forms must load the linked options used by the active record type')
  assert.ok(academic.includes('const sortedRows=useMemo') && academic.includes('const pageRows=sortedRows.slice') && academic.includes('const pageSize = 25') && academic.includes('aria-sort='), 'Academic registers need sorting and pagination')
  const exportStart=academic.indexOf('function exportRows(')
  const exportEnd=academic.indexOf('function renderField(',exportStart)
  const exportHandler=academic.slice(exportStart,exportEnd)
  assert.ok(exportStart>=0 && exportEnd>exportStart && exportHandler.includes('filteredRows.map') && !exportHandler.includes('pageRows'), 'Academic exports and print reports must include every filtered record, not only the visible page')
  assert.ok(academicStyles.includes('.ed360-academic-sort') && academicStyles.includes('.ed360-academic-pagination') && academicStyles.includes('@media print{.ed360-academic-pagination'), 'Academic sorting and pagination need responsive and print-aware styles')
  assert.ok(timetable.includes('create trigger timetable_entries_prevent_conflicts') && timetable.includes('pg_advisory_xact_lock'), 'Timetable collision enforcement must remain database-backed and concurrency-safe')
  for (const value of ['new.end_time<=new.start_time', 'e.id is distinct from new.id', 'new.start_time<e.end_time and new.end_time>e.start_time', 'e.academic_session_id is not distinct from new.academic_session_id', 'e.academic_session_id is null or new.academic_session_id is null']) {
    assert.ok(guards.includes(value), 'Database timetable guard is missing: ' + value)
  }
})

check('Single dashboard layout preserves role data and accessible display preferences', () => {
  const dashboard = read('src/components/Dashboard.tsx')
  const preferences = read('src/lib/displayPreferences.js')
  const displayStyles = read('src/styles/dashboard-display-settings.css')
  const displayTests = read('scripts/test-display-preferences.mjs')
  const mainEntry = read('src/main.tsx')
  assert.ok(dashboard.includes('data-view-mode="modern"') && dashboard.includes('data-theme={displayPreferences.theme}'), 'One consistent dashboard layout and theme preferences must be applied to the signed-in shell')
  assert.ok(!dashboard.includes('aria-label="Dashboard display mode"') && !dashboard.includes('>Modern</button>') && !dashboard.includes('>Classic</button>'), 'The inactive Modern / Classic selector must be removed')
  assert.ok(dashboard.includes('roleNavigationGroups(user!.role)') && dashboard.includes('modulesForRole(user!.role)'), 'Role-filtered navigation and modules must remain unchanged')
  assert.ok(dashboard.includes('workspaceTabs.map(tab =>') && dashboard.includes('<RoleDashboard onNavigate={navigateChild}/>'), 'The single layout must retain the same workspace and overview components')
  for (const preference of ['viewMode', 'theme', 'fontSize', 'sidebar', 'reducedMotion']) assert.ok(preferences.includes(preference), 'Preference persistence is missing: ' + preference)
  assert.ok(preferences.includes('localStorage') === false, 'The preference helper must remain storage-adapter based and testable')
  for (const style of ['data-view-mode="classic"', 'data-theme="dark"', 'data-font-size="largest"', 'data-reduced-motion="true"', 'prefers-reduced-motion: reduce', 'focus-visible', 'min-height: 32px']) assert.ok(displayStyles.includes(style), 'Display style/accessibility support is missing: ' + style)
  assert.ok(mainEntry.includes("import './styles/dashboard-display-settings.css'"), 'Dashboard display styles must be loaded in the application')
  assert.ok(displayTests.includes('reads all supported settings') && displayTests.includes('storage write failure is non-fatal'), 'Display preference persistence regressions are missing')
})

check('Internal account and institute profile controls remain connected to secure owner workflows', () => {
  const dashboard = read('src/components/Dashboard.tsx')
  const account = read('src/components/PersonalWorkspace.tsx')
  const auth = read('src/lib/auth.ts')
  const institute = read('src/components/AdministrationStage5Workspace.tsx')
  const roleDashboard = read('src/components/RoleDashboard.tsx')
  const internalTheme = read('src/styles/college-theme.css')
  assert.ok(dashboard.includes("navigate('personal:account-settings'") && dashboard.includes("navigate('governance:profile'") && dashboard.includes('void logout()'), 'The profile menu must link account settings, institute profile and sign-out')
  assert.ok(account.includes('updateAccountName') && account.includes("from('profiles').update({full_name:fullName})"), 'Users must be able to edit their own account name')
  assert.ok(account.includes("updateUser({email:address}") && account.includes('updatePassword') && account.includes('Request email change'), 'Account settings must include secure email and password changes')
  assert.ok(auth.includes('supabase.auth.getUser()') && auth.includes('authData.user?.email'), 'The verified Auth email must be used for the signed-in account')
  assert.ok(institute.includes('ed360-profile-public-card') && institute.includes('logoUrl') && institute.includes('previewLogo') && !institute.includes('showProfileCard'), 'Institute identity preview with its logo must be visible without an extra toggle')
  for (const item of ['institutional_audit_events', 'Recent database changes', 'Live database activity', 'GLOBAL INSTITUTION OVERSIGHT', 'Live updates']) assert.ok(!roleDashboard.includes(item), 'Dashboard-only audit or live-feed UI should be removed: ' + item)
  assert.ok(roleDashboard.includes('studentPresentToday') && roleDashboard.includes('studentAbsentToday') && roleDashboard.includes('studentAttendancePercent'), 'Student attendance must be reported separately from staff attendance')
  assert.ok(internalTheme.includes('linear-gradient(128deg,#321943') && internalTheme.includes('.pro-app-shell'), 'The purple / pink canvas must be scoped to the signed-in internal shell')
  assert.ok(!internalTheme.includes(':root {') || internalTheme.indexOf(':root {') < internalTheme.indexOf('/* Internal application — one cohesive plum'), 'Internal palette tokens must not overwrite public-page root tokens')
})

check('Administration pages are dedicated, audience-aware and scoped to existing college records', () => {
  const adminWorkspace = read('src/components/AdministrationStage5Workspace.tsx')
  const roleDashboard = read('src/components/RoleDashboard.tsx')
  const operations = read('src/components/LinkedOperationsWorkspace.tsx')
  assert.ok(adminWorkspace.includes('renderDesignations') && adminWorkspace.includes('Designation Catalogue') && adminWorkspace.includes('designationRows'), 'Designation Catalogue must be a dedicated Administration page')
  assert.ok(adminWorkspace.includes('policies-students') && adminWorkspace.includes('policies-faculty') && adminWorkspace.includes("section==='policies-faculty'?'faculty':'student'") && adminWorkspace.includes('category:policyCategory'), 'Student and faculty policies must use separate audience categories')
  assert.ok(adminWorkspace.includes('renderInstituteSettings') && adminWorkspace.includes('institution_preferences'), 'Institute Settings must use the dedicated preference form rather than raw website key/value rows')
  assert.ok(adminWorkspace.includes('academicSessionResult') && adminWorkspace.includes('classResult') && adminWorkspace.includes('programResult') && adminWorkspace.includes('subjectResult') && adminWorkspace.includes('roomResult'), 'Academic Structure must read the actual academic registers')
  assert.ok(!adminWorkspace.includes('Institution data remains scoped by the signed-in membership') && !adminWorkspace.includes('Direct supervisor links and approved vacancy positions are not stored'), 'Remove redundant scope and schema-explanation statements from Administration views')
  assert.ok(!operations.includes('Changes remain inside {user?.institutionName') && !operations.includes('Scoped to {user?.institutionName'), 'Campus workspace must not repeat institution-scope statements')
  assert.ok(roleDashboard.includes('Government Islamia Degree College, Badin') && roleDashboard.includes('Badin weather') || roleDashboard.includes('BADIN WEATHER · LIVE'), 'College welcome panel must identify the college and show live Badin conditions')
  assert.ok(roleDashboard.includes('timeZone:\'Asia/Karachi\'') && !roleDashboard.includes('CampusIllustration') && !roleDashboard.includes('rd-institution-logo'), 'Welcome panel must use Pakistan local date/time without a forced campus visual or logo')
})
check('Student admission is a dedicated, accessible workspace window', () => {
  const recordModule = read('src/components/RecordModule.tsx')
  const admissionStyles = read('src/styles/student-admission-workspace.css')
  const mainEntry = read('src/main.tsx')
  assert.ok(recordModule.includes('if (isStudent && fullPage)'), 'Student admission must render in its dedicated full-page mode')
  assert.ok(recordModule.includes('if (showForm) return formDialog'), 'The student form must replace the directory content while open')
  for (const section of ['Student identity', 'Academic placement', 'Contact information', 'Parent / guardian information']) {
    assert.ok(recordModule.includes(section), 'Missing dedicated admission form section: ' + section)
  }
  assert.ok(recordModule.includes('Save student admission') && recordModule.includes('Back to students'), 'The admission window must provide clear save and return actions')
  assert.ok(admissionStyles.includes('.ed360-admission-workspace') && admissionStyles.includes('@media(max-width:680px)'), 'The admission workspace must have dedicated responsive styles')
  assert.ok(mainEntry.includes("import './styles/student-admission-workspace.css'"), 'Dedicated admission styles must be loaded by the application')
})

check('College role assignment expiry controls use effective dates and clear old expiry on reactivation', () => {
  const roles = read('src/components/CollegeRolePermissionWorkspace.tsx')
  const policy = read('supabase/migrations/20261113173320_college_custom_role_profiles_and_scope_policies.sql')
  for (const value of ['assignmentIsActive', 'assignEndDate', 'must be in the future', 'ends_at:null', 'starts_at:new Date().toISOString()', "'Expired'", "'Scheduled'"]) {
    assert.ok(roles.includes(value), 'Role assignment date handling is missing: ' + value)
  }
  assert.ok(roles.includes('assignments.filter(assignmentIsActive)') && roles.includes('assignmentIsActive(row)'), 'Role assignment counts and duplicate checks must use effective dates')
  assert.ok(policy.includes('a.starts_at<=now()') && policy.includes('(a.ends_at is null or a.ends_at>now())') && policy.includes('p.is_active'), 'Database permission checks must enforce assignment start, expiry and profile state')
})

check('Admission transitions are enforced by the database and reviewed with trusted identity', () => {
  const guard = read('supabase/migrations/20261114033957_guard_student_admission_status_transitions.sql')
  const recordModule = read('src/components/RecordModule.tsx')
  for (const rule of [
    "when 'draft' then new.application_status in ('submitted','withdrawn')",
    "when 'submitted' then new.application_status in ('under_review','documents_required','rejected','withdrawn')",
    "when 'under_review' then new.application_status in ('documents_required','approved','rejected','withdrawn')",
    "when 'documents_required' then new.application_status in ('under_review','rejected','withdrawn')",
    "when 'approved' then new.application_status in ('enrolled','withdrawn')",
    "when 'enrolled' then new.application_status = 'withdrawn'",
  ]) assert.ok(guard.includes(rule), 'Missing database admission transition rule: ' + rule)
  assert.ok(guard.includes('security invoker'), 'Admission guard must run with the authenticated caller privileges')
  assert.ok(guard.includes("array['owner','admin']::text[]"), 'Only institution owners and administrators may change admission stages')
  assert.ok(guard.includes('private.has_institution_permission(') && guard.includes("'students'") && guard.includes("'edit'"), 'Custom college role and scope must be checked')
  assert.ok(guard.includes('new.application_reviewed_by := auth.uid()'), 'Reviewer identity must come from the authenticated session')
  assert.ok(guard.includes('new.application_reviewed_at := now()'), 'Review timestamp must be assigned by the database')
  assert.ok(guard.includes("new.status := 'active'") && guard.includes("new.status := 'inactive'") && guard.includes("new.status := 'pending'"), 'Student status must follow the admission stage')
  assert.ok(guard.includes('before update of application_status on public.students'), 'Admission changes must be guarded on every database update')
  const updateStart = recordModule.indexOf('async function updateAdmissionStatus')
  const updateEnd = recordModule.indexOf('async function saveGuardianContact', updateStart)
  assert.ok(updateStart >= 0 && updateEnd > updateStart, 'Student admission status action must remain present')
  const updateHandler = recordModule.slice(updateStart, updateEnd)
  assert.ok(updateHandler.includes('application_review_notes: note.trim() || null'), 'The UI must preserve the admission review note')
  assert.ok(!updateHandler.includes('application_reviewed_by:'), 'The browser must not choose the reviewer identity')
  assert.ok(!updateHandler.includes('application_reviewed_at:'), 'The browser must not choose the review timestamp')
  assert.ok(!updateHandler.includes('application_submitted_at:'), 'The browser must not choose submission timestamps')
})

console.log('\nRole workspace counts:')
for (const [role, count] of Object.entries(roleCounts)) console.log(`  ${role.padEnd(13)} ${String(count.groups).padStart(2)} menu groups / ${String(count.destinations).padStart(2)} destinations`)
console.log(`\nConfigured data modules: ${modules.length}`)
if (process.exitCode) process.exit(process.exitCode)
console.log('\nProject verification passed. This checks source and configuration; it is not a live end-to-end Supabase test.')


const landingPage = read('src/components/AuthScreens.tsx')
const landingStyles = read('src/styles/welcome-completion.css')
check('Public landing sections follow the requested visitor journey', () => {
  const sectionOrder = [
    'id="platform"',
    'id="features"',
    'id="analytics"',
    'id="solutions" aria-labelledby="edm-solutions-heading"',
    'id="workflow"',
    'id="campus-services"',
    'id="security"',
    'id="testimonials"',
    'id="faq"',
  ].map(marker => landingPage.indexOf(marker))
  for (let index = 0; index < sectionOrder.length; index++) {
    assert.ok(sectionOrder[index] >= 0, 'Missing landing section in visitor journey')
    if (index > 0) assert.ok(sectionOrder[index] > sectionOrder[index - 1], 'Landing sections are out of requested order')
  }
})

check('Public landing page includes the complete requested navigation and section architecture', () => {
  for (const label of ['>Home</a>', '>Features</a>', '>Solutions</a>', '>About</a>', '>Contact</a>', '>Login</button>', '>Get Started']) {
    assert.ok(landingPage.includes(label), 'Missing public navigation/action: ' + label)
  }
  for (const id of ['top','features','solutions','about','platform','analytics','institution-types','campus-services','security','testimonials','workflow','contact','faq','get-started']) {
    assert.ok(landingPage.includes('id="' + id + '"'), 'Missing landing-page section anchor: #' + id)
  }
  for (const feature of ['Institution administration & access','Admissions & enrolment','Student & guardian records','Teachers, faculty & staff','Attendance & daily operations','Comprehensive academic management','Fees, payments & clear records']) {
    assert.ok(landingPage.includes(feature), 'Missing required feature: ' + feature)
  }
  for (const service of ['Digital library','Transport management','Rooms & facilities','Inventory & supplies','Visitor management','Hostel & residence']) {
    assert.ok(landingPage.includes(service), 'Missing campus service disclosure: ' + service)
  }
  for (const section of ['SECURITY & RELIABILITY','VERIFIED FEEDBACK','CONTACT & HELP','edm-faq-section']) {
    assert.ok(landingPage.includes(section), 'Missing public information section: ' + section)
  }
  for (const chart of ['Enrollment trend','Attendance rate','Exam results & academic performance','Fee collection']) {
    assert.ok(landingPage.includes(chart), 'Missing illustrative analytics: ' + chart)
  }
  const ids = new Set(landingPage.split('id="').slice(1).map(part => part.split('"')[0]))
  for (const part of landingPage.split('href="#').slice(1)) {
    const target = part.split('"')[0]
    assert.ok(ids.has(target), 'Broken in-page link: #' + target)
  }
  assert.ok(landingPage.includes("go('login')"), 'Login actions must open the Stage 2 login route')
  assert.ok(landingPage.includes("go('setup')"), 'Get Started actions must open institution onboarding')
  assert.ok(landingPage.includes('There are no verified institution testimonials'), 'Testimonials must not be fabricated')
  assert.ok(landingPage.includes('Official public support email and telephone details are not configured'), 'Missing public contact-channel disclosure')
  assert.ok(landingStyles.includes('prefers-reduced-motion'), 'Scroll animations must respect reduced-motion preferences')
})
