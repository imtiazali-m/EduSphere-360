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
check('Vite development and production scripts exist', () => {
  assert.equal(packageJson.scripts.dev, 'vite --host 0.0.0.0')
  assert.equal(packageJson.scripts.build, 'tsc -b && vite build')
  assert.equal(packageJson.scripts.typecheck, 'tsc -b --pretty')
})

const requiredFiles = [
  'index.html', 'src/main.tsx', 'src/App.tsx', 'src/components/Dashboard.tsx',
  'src/components/AuthScreens.tsx', 'src/components/AdministrationModule.tsx',
  'src/components/RecordModule.tsx', 'src/components/FacultyWorkspace.tsx', 'src/styles/faculty-workspace.css', 'src/components/ReportsModule.tsx', 'src/components/ProfileModule.tsx', 'src/context/AuthContext.tsx', 'src/lib/auth.ts',
  'src/lib/data.ts', 'src/lib/navigationAccess.ts', 'src/lib/userErrors.ts', 'scripts/test-user-errors.mjs',
  'src/lib/finance.ts', 'scripts/test-finance.mjs', 'src/lib/fileAccess.ts', 'scripts/test-file-access.mjs',
  'src/lib/navigationCatalog.ts', 'src/lib/navigationRoutes.ts', 'src/components/NotificationCenter.tsx', 'src/styles/notification-center.css', 'public/_redirects',
  'supabase/migrations/20261109125937_announcement_read_receipts.sql', 'docs/EDUSPHERE_360_BENCHMARK_AND_GAP_REVIEW.md',
  '.env.example', 'package-lock.json', 'src/lib/types.ts', 'supabase/migrations/20261108053651_owner_signup_institution_details.sql', 'supabase/migrations/20261109083133_faculty_employee_management.sql', 'supabase/migrations/20261109092734_student_management_operations.sql', 'supabase/migrations/20261109092920_student_management_scope_indexes_and_guardian_portal_read.sql',
  '.github/workflows/cloudflare-pages-release.yml', 'docs/FINAL_REBUILD_STAGE.md', 'docs/NAVIGATION_RECONCILIATION.md',
]
check('Integrated frontend, authentication, modules and deployment files exist', () => {
  for (const file of requiredFiles) assert.ok(fs.existsSync(path.join(root, file)), `${file} is missing`)
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
const { navigationRoutes } = require(path.join(root, 'src/lib/navigationRoutes.ts'))
const { roleNavigationGroups } = require(path.join(root, 'src/lib/navigationAccess.ts'))
const { modules, modulesForRole } = require(path.join(root, 'src/lib/modules.ts'))
const roles = ['owner', 'admin', 'teacher', 'student', 'parent', 'accountant', 'exam_officer']

check('The full institutional menu maps every submenu to a working destination', () => {
  assert.equal(navigationCatalog.length, 33, 'The complete institutional menu must contain 33 unique main workspaces')
  const groupKeys = new Set(navigationCatalog.map(group => group.key))
  assert.equal(groupKeys.size, 33, 'Main workspace keys must be unique')
  for (const group of navigationCatalog) {
    assert.ok(group.items.length > 0, group.label + ' must have its own operational submenus')
    for (const page of group.items) assert.ok(navigationRoutes[page], 'No route is connected for ' + group.label + '/' + page)
  }
  for (const required of ['curriculum','library','transport','inventory','facilities','visitors','institution-config','reconciliation','backup']) {
    assert.ok(groupKeys.has(required), 'Missing expansion workspace: ' + required)
  }
  for (const required of ['attendance','students','employees','accounts-finance','fees','payments','receipts','payroll','examinations','class-tests','reports']) {
    assert.ok(groupKeys.has(required), 'Missing core institution workspace: ' + required)
  }
  const menuDestinationCount = navigationCatalog.reduce((total, group) => total + group.items.length, 0)
  assert.ok(menuDestinationCount >= 400, 'All specified submenu destinations should be present')
  for (const [page, route] of Object.entries(navigationRoutes)) {
    if (route.startsWith('institutional:')) {
      const groupKey = route.split(':')[1]
      assert.ok(groupKeys.has(groupKey), page + ' points to an unknown institutional workspace')
    }
  }
  assert.ok(navigationRoutes['Student Directory']?.startsWith('students:'), 'Student Directory must open the student workspace')
  assert.equal(navigationRoutes['Fee Invoices'], 'fees', 'Fees remain in the dedicated Finance & Payments workspace')
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
  assert.ok(!roleNavigationGroups('teacher').some(group => ['administration','institution-config','academic-sessions','classes-sections','subjects'].includes(group.key)))
  assert.ok(roleNavigationGroups('teacher').find(group => group.key === 'employees')?.items.includes('Employee Leave Management'))
  assert.ok(!roleNavigationGroups('student').some(group => ['administration','institution-config','employees','accounts-finance','payroll'].includes(group.key)))
  assert.ok(!roleNavigationGroups('parent').some(group => ['administration','institution-config','employees','accounts-finance','payroll'].includes(group.key)))
  assert.ok(!roleNavigationGroups('accountant').some(group => ['employees','students','question-bank','examinations'].includes(group.key)))
  assert.ok(!roleNavigationGroups('exam_officer').some(group => ['employees','students','accounts-finance','payroll'].includes(group.key)))
})

check('Bulk attendance uses class registers with P A L marking and atomic saves', () => {
  const attendance = read('src/components/AttendanceWorkspace.tsx')
  assert.ok(attendance.includes('All present') && attendance.includes('All absent') && attendance.includes('All late'))
  assert.ok(attendance.includes('save_institution_attendance_register') && attendance.includes('Save whole register'))
  assert.ok(attendance.includes('not_configured') && attendance.includes('provider feed'), 'Automatic attendance must not pretend that a device is connected')
})
check('Institutional workspace includes real record CRUD and office-compatible exports', () => {
  const workspace = read('src/components/InstitutionalWorkspace.tsx')
  const exporters = read('src/lib/officeExport.ts')
  for (const value of ['institutional_records','created_by','updated_by','approval_status','CONTEXTUAL SUB-WINDOW']) assert.ok(workspace.includes(value))
  for (const value of ['exportXlsx','exportDocx','printOfficeReport']) assert.ok(workspace.includes(value))
  for (const value of ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document','window.print']) assert.ok(exporters.includes(value))
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
  assert.ok(dashboardSource.includes('ed360-dashboard'), 'Approved first-image dashboard layout is missing')
  assert.ok(dashboardSource.includes('ed360-metric-grid') && dashboardSource.includes('ed360-line-chart') && dashboardSource.includes('ed360-module-panel'), 'Dashboard statistics, academic chart or module overview is missing')
  assert.ok(dashboardSource.includes('ed360-recent-panel') && dashboardSource.includes('ed360-events-panel') && dashboardSource.includes('ed360-quick-stats-panel'), 'Dashboard activity, events or quick statistics panel is missing')
  assert.ok(dashboardSource.includes('Search modules, students, or records'), 'Workspace search is missing')
  assert.ok(dashboardSource.includes('ed360-topbar-institution') && dashboardSource.includes('ed360-topbar-notice'), 'Approved institution topbar is missing')
  assert.ok(dashboardSource.includes('pro-profile-menu'), 'Account menu is missing')
  assert.ok(dashboardSource.includes('QUICK ACCESS') && !dashboardSource.includes('QUICK ACCESS · PINNED'), 'Quick Access must remain a separate unpinned sidebar section')
})

const authScreens = read('src/components/AuthScreens.tsx')
const authContext = read('src/context/AuthContext.tsx')
const authSource = read('src/lib/auth.ts')
const signupMigration = read('supabase/migrations/20261108053651_owner_signup_institution_details.sql')
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
  const reports = read('src/components/ReportsModule.tsx')
  const administration = read('src/components/AdministrationModule.tsx')
  assert.ok(accounts.includes('Access Overview') && accounts.includes('Account Directory') && accounts.includes('Provision Account'), 'Accounts must have separate overview, directory and provisioning windows')
  assert.ok(files.includes('File Register') && files.includes('categoryFilter') && files.includes('viewingFile') && files.includes('CONTEXTUAL SUB-WINDOW'), 'Files must have category windows and a contextual file detail window')
  assert.ok(reports.includes('Finance & Collections') && reports.includes('Attendance Analysis') && reports.includes('Examination Results'), 'Reports must have separate subject-specific windows')
  assert.ok(administration.includes('Department Structure') && administration.includes('Class Capacity Overview') && administration.includes('Session Configuration'), 'Administration workspaces must use structure-specific tabs')
  const styles = read('src/styles/operational-hierarchy.css')
  assert.ok(styles.includes('zoom: 1.06') && styles.includes('.ed360-operations-window-nav') && styles.includes('.ed360-contextual-subwindow'), 'Readable UI scale and nested workspace styles are required')
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
  assert.ok(!tables.includes('fee_payments'), 'Fee payments must use the atomic payment RPC')
  for (const operation of ['createRecord', 'updateRecord', 'deleteRecord', 'recordFeePayment']) assert.ok(dataSource.includes(`export async function ${operation}`), `${operation} is missing`)
})

check('Student Record is a complete permission-aware multi-window workspace', () => {
  const recordModule = read('src/components/RecordModule.tsx')
  const dataSource = read('src/lib/data.ts')
  for (const label of ['Overview', 'Admissions', 'Student Directory', 'Student Profile', 'Class Placement', 'Guardians', 'Student Attendance', 'Student Exam Results', 'Student Assignments', 'Student Timetable', 'Student Documentation', 'Student History']) {
    assert.ok(recordModule.includes("label: '" + label + "'"), 'Student workspace window is missing: ' + label)
  }
  const studentWorkspaceStart = recordModule.indexOf("if (module.key === 'students') {", recordModule.indexOf('export function RecordModule'))
  const studentWorkspaceEnd = recordModule.indexOf("if (module.key === 'teachers') {", studentWorkspaceStart)
  const studentWorkspace = recordModule.slice(studentWorkspaceStart, studentWorkspaceEnd)
  for (const table of ['attendance', 'exams', 'exam_results', 'assignments', 'assignment_submissions', 'timetable_entries', 'classes', 'academic_sessions', 'programs', 'guardian_students', 'parent_guardians', 'student_placements', 'student_documents', 'student_history']) {
    assert.ok(recordModule.includes("'" + table + "'"), 'Student workspace is missing related data source: ' + table)
  }
  assert.ok(!studentWorkspace.includes("'fee_invoices'") && !studentWorkspace.includes("label: 'Fees & Payments'"), 'Fee management must remain exclusively in Finance, not Student Management')
  assert.ok(recordModule.includes('studentRelatedTables.map'), 'Student related workspaces must load their linked records')
  const dashboardSource = read('src/components/Dashboard.tsx')
  assert.ok(dashboardSource.includes("key={active + ':' + activeWorkspaceWindow}"), 'Student sidebar destinations must open the selected internal workspace')
  assert.ok(dashboardSource.includes("initialWindow={active === 'students' ? activeWorkspaceWindow : undefined}"), 'Student sidebar destinations must pass their selected window into the workspace')
  assert.ok(recordModule.includes('showWindowNavigation = true') && recordModule.includes('showWindowNavigation && ('), 'Student sidebar windows must not be duplicated by a second copy of the same window navigation')
  assert.ok(recordModule.includes('setStudentWorkspaceTab'), 'Student workspace windows must navigate independently inside Student Record')
  assert.ok(recordModule.includes('Student admission saved successfully.'), 'Student admission confirmation is missing')
  assert.ok(recordModule.includes('Do not submit this admission again'), 'Unconfirmed admissions must not encourage duplicate submission')
  assert.ok(recordModule.includes('This admission number is already registered'), 'Duplicate admission numbers must be checked before insert')
  assert.ok(recordModule.includes('async function updateAdmissionStatus'), 'Admission review and approval workflow is missing')
  assert.ok(recordModule.includes("application_status: nextStatus"), 'Admission status transitions are not persisted')
  assert.ok(recordModule.includes('async function saveGuardianContact') && recordModule.includes("'guardian_students'"), 'Guardian contacts must be linked to students')
  assert.ok(recordModule.includes('async function saveStudentPlacement') && recordModule.includes("'student_placements'"), 'Class placement must use linked class records')
  assert.ok(recordModule.includes("from('student-files')") && recordModule.includes('async function uploadStudentDocument'), 'Private student document upload is missing')
  assert.ok(recordModule.includes("studentHistoryRows.map(event") && recordModule.includes("'student_history'"), 'Student History must render database audit events')
  for (const trigger of ['attendance_student_history_audit', 'exam_results_student_history_audit', 'assignment_submissions_student_history_audit']) assert.ok(read('supabase/migrations/20261109094108_student_activity_history_events.sql').includes(trigger), `Student history trigger is missing: ${trigger}`)
  assert.ok(dataSource.includes("const READ_ONLY_TABLES = new Set(['student_history'])"), 'Student audit history must be read-only to the client')
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
  for (const label of ['Overview', 'Employee Registration', 'Employee Directory', 'Employee Profile', 'Departments', 'Designations', 'Teaching Assignments', 'Faculty Attendance', 'Leave Management', 'Workload & Timetable', 'Documents', 'Employment History', 'Staff Reports']) {
    assert.ok(faculty.includes("label:'" + label + "'") || faculty.includes("label: '" + label + "'"), 'Faculty workspace window is missing: ' + label)
  }
  for (const table of ['designations', 'teacher_assignments', 'employee_attendance', 'employee_leave_requests', 'staff_documents', 'employee_history']) {
    assert.ok(faculty.includes("'" + table + "'"), 'Faculty workspace is missing its dedicated data source: ' + table)
    assert.ok(read('src/lib/data.ts').includes("'" + table + "'"), 'Generic cloud data allowlist is missing: ' + table)
  }
  assert.ok(faculty.includes("from('staff-files')"), 'Confidential documents must use the dedicated private staff-files bucket')
  assert.ok(faculty.includes('createSignedUrl'), 'Staff documents must be retrieved with signed URLs')
  const dashboard = read('src/components/Dashboard.tsx')
  assert.ok(dashboard.includes("<FacultyWorkspace onToast={onToast} onNavigate={navigate}/>"), 'Existing dashboard must route Faculty & Staff into the dedicated workspace')
  const migration = read('supabase/migrations/20261109083133_faculty_employee_management.sql')
  for (const required of ['enable row level security', 'teacher_assignments', 'employee_attendance', 'employee_leave_requests', 'staff_documents', 'employee_history', 'staff-files', 'teachers_owner_admin_or_self_read', 'audit_teacher_history']) {
    assert.ok(migration.includes(required), 'Faculty management migration is missing: ' + required)
  }
  assert.ok(!migration.includes('drop table') && !migration.includes('truncate '), 'Faculty management migration must remain additive and non-destructive')
})

check('GitHub-hosted release pipeline builds assets and keeps production deploy manual', () => {
  const workflow = read('.github/workflows/cloudflare-pages-release.yml')
  for (const phrase of ['workflow_dispatch', 'npm ci --no-audit --no-fund', 'npm run verify:project', 'npm run test:user-errors', 'npm run test:finance', 'npm run test:file-access', 'npm run build', 'edusphere360-cloudflare-direct-upload.zip', 'cloudflare/wrangler-action@v4']) {
    assert.ok(workflow.includes(phrase), `Release workflow is missing ${phrase}`)
  }
  assert.ok(workflow.includes('inputs.deploy_production == true'), 'Production deployment must require an explicit manual approval input')
  assert.ok(workflow.includes("github.event_name == 'workflow_dispatch'"), 'Production deployment must not run on normal pushes or pull requests')
  assert.ok(workflow.includes('secrets.CLOUDFLARE_API_TOKEN') && workflow.includes('secrets.CLOUDFLARE_ACCOUNT_ID'))
  assert.ok(workflow.includes('vars.VITE_SUPABASE_URL') && workflow.includes('vars.VITE_SUPABASE_PUBLISHABLE_KEY'))
  assert.ok(!workflow.includes('SUPABASE_SERVICE_ROLE_KEY'), 'A Supabase service-role key must never be a frontend build variable')
})

check('Required database safeguards and Cloudflare redirects remain in the project', () => {
  const migrations = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(name => name.endsWith('.sql')).sort()
  for (const migration of ['001_initial_schema.sql', '017_public_institution_signup.sql', '018_assessment_metadata_and_result_visibility.sql', '019_phase_two_integrity_guards.sql', '020_fee_payment_date_validation.sql', '20261108053651_owner_signup_institution_details.sql', '20261109083133_faculty_employee_management.sql', '20261109092734_student_management_operations.sql', '20261109092920_student_management_scope_indexes_and_guardian_portal_read.sql', '20261109094108_student_activity_history_events.sql', '20261109094402_student_guardian_policy_consolidation_and_activity_indexes.sql', '20261109105804_institutional_platform_expansion.sql', '20261109110541_institution_attendance_bulk_register.sql', '20261109111818_institutional_policy_and_foreign_key_refinement.sql', '20261109113516_campus_scope_and_inventory_transaction_workflows.sql', '20261109113606_inventory_movement_row_count_safety_fix.sql', '20261109125937_announcement_read_receipts.sql']) {
    assert.ok(migrations.includes(migration), `${migration} missing`)
  }
  const timestamped = migrations.filter(name => /^202611\d{8}_.+\.sql$/.test(name))
  assert.equal(timestamped.length, 17, 'Expected seventeen timestamped migrations matching the live migration history')
  assert.ok(read('supabase/migrations/README.md').includes('seventeen timestamped migration files'))
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

console.log('\nRole workspace counts:')
for (const [role, count] of Object.entries(roleCounts)) console.log(`  ${role.padEnd(13)} ${String(count.groups).padStart(2)} menu groups / ${String(count.destinations).padStart(2)} destinations`)
console.log(`\nConfigured data modules: ${modules.length}`)
if (process.exitCode) process.exit(process.exitCode)
console.log('\nProject verification passed. This checks source and configuration; it is not a live end-to-end Supabase test.')
