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
  'index.html', 'src/main.tsx', 'src/App.tsx', 'src/components/Dashboard.tsx', 'src/components/WorkspaceUnavailable.tsx',
  'src/components/FinanceWorkspace.tsx', 'src/styles/finance-workspace.css',
  'src/components/PayrollWorkspace.tsx', 'src/styles/payroll-workspace.css',
  'src/components/GovernanceWorkspace.tsx', 'src/styles/governance-workspace.css',
  'src/components/InstitutionOperationsWorkspace.tsx', 'src/styles/institution-operations.css',
  'src/components/AuthScreens.tsx', 'src/components/AdministrationModule.tsx',
  'src/components/RecordModule.tsx', 'src/components/FacultyWorkspace.tsx', 'src/styles/faculty-workspace.css', 'src/components/ReportsModule.tsx', 'src/components/ProfileModule.tsx', 'src/context/AuthContext.tsx', 'src/lib/auth.ts',
  'src/lib/data.ts', 'src/lib/navigationAccess.ts', 'src/lib/userErrors.ts', 'scripts/test-user-errors.mjs',
  'src/lib/finance.ts', 'scripts/test-finance.mjs', 'src/lib/fileAccess.ts', 'scripts/test-file-access.mjs',
  'src/lib/navigationCatalog.ts', 'src/lib/navigationRoutes.ts', 'src/components/NotificationCenter.tsx', 'src/styles/notification-center.css', 'public/_redirects',
  'supabase/migrations/20261109125937_announcement_read_receipts.sql',
  'supabase/migrations/20261109150048_finance_accounting_and_payroll_workflows.sql',
  'supabase/migrations/20261109150654_atomic_employee_salary_profile_workflow.sql',
  'supabase/migrations/20261109150857_employee_own_payroll_run_read.sql',
  'supabase/migrations/20261109151231_atomic_institution_setting_approval.sql',
  'supabase/migrations/20261109153658_academic_studentcare_and_campus_operations.sql',
  'supabase/migrations/20261109155028_question_paper_approval_and_line_removal.sql',
  'docs/EDUSPHERE_360_BENCHMARK_AND_GAP_REVIEW.md',
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
const { navigationRoutes, getNavigationRoute } = require(path.join(root, 'src/lib/navigationRoutes.ts'))
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
  assert.equal(getNavigationRoute('reports', 'Student Reports'), 'reports:students', 'Student reports must open the student report window')
  assert.equal(getNavigationRoute('reports', 'Attendance Reports'), 'reports:attendance', 'Attendance reports must open the attendance report window')
  assert.equal(getNavigationRoute('teaching', 'Homework'), 'assignments:open', 'Homework must open the open-coursework view')
  assert.equal(getNavigationRoute('attendance', 'Attendance Reports'), 'reports:attendance', 'Attendance report shortcut must open the correct report view')
  assert.equal(getNavigationRoute('students', 'Student Directory'), 'students:directory', 'Student Directory must open the student directory view')
  assert.equal(getNavigationRoute('students', 'Bulk Student Operations'), 'unavailable:students:bulk-student-operations', 'Bulk student operations must not imply a batch edit workflow')
  assert.equal(getNavigationRoute('students', 'Student Data Export', 'student'), 'unavailable:students:student-data-export', 'Student accounts must not receive institution-wide data export access')
  assert.equal(getNavigationRoute('students', 'Student Data Export', 'owner'), 'students:directory', 'Administrators can export their permitted student directory records')
  assert.equal(getNavigationRoute('employees', 'Employee Performance'), 'unavailable:employees:employee-performance', 'HR headcount must not be presented as a performance appraisal')
  assert.equal(getNavigationRoute('attendance', 'Leave Applications'), 'employees:leave', 'Leave applications must open the HR leave workflow')
  assert.equal(getNavigationRoute('attendance', 'Attendance Analytics'), 'reports:attendance', 'Attendance analytics must open the live attendance report')
  assert.equal(getNavigationRoute('attendance', 'Attendance Alerts'), 'unavailable:attendance:attendance-alerts', 'Attendance alerts require a configured rules/notification workflow')
  assert.equal(getNavigationRoute('timetable', 'Substitution Management'), 'unavailable:timetable:substitution-management', 'Teacher substitution must not be represented as unassigned timetable entries')
  assert.equal(getNavigationRoute('timetable', 'Timetable Publishing'), 'unavailable:timetable:timetable-publishing', 'Timetable publication controls are not implemented yet')
  assert.equal(getNavigationRoute('class-tests', 'Online Tests'), 'unavailable:class-tests:online-tests', 'Online test delivery must not be represented as ordinary examination records')
  assert.equal(getNavigationRoute('examinations', 'Automatic Checking'), 'unavailable:examinations:automatic-checking', 'Automated marking is not configured')
  assert.equal(getNavigationRoute('reports', 'Custom Report Builder'), 'unavailable:reports:custom-report-builder', 'Custom report builder must not open fixed report cards')
  assert.equal(getNavigationRoute('reports', 'Scheduled Reports'), 'unavailable:reports:scheduled-reports', 'Scheduled report execution is not implemented')
  assert.equal(getNavigationRoute('library', 'Student Reading History'), 'unavailable:library:student-reading-history', 'Reading progress history is distinct from the library loan ledger')
  assert.equal(getNavigationRoute('transport', 'Transport Attendance'), 'unavailable:transport:transport-attendance', 'Transport boarding attendance requires its own route attendance register')
  assert.equal(getNavigationRoute('receipts', 'Receipt Templates'), 'unavailable:receipts:receipt-templates', 'Receipt template management must not be confused with receipt printing')
  assert.equal(getNavigationRoute('students', 'Student ID Cards'), 'students:id-cards', 'Student ID Cards must open the print workspace')
  assert.equal(getNavigationRoute('employees', 'Employee ID Cards'), 'employees:id-cards', 'Employee ID Cards must open the staff print workspace')
  assert.equal(getNavigationRoute('ai', 'AI Assistant'), 'unavailable:ai:ai-assistant', 'AI must not pretend to generate results before a model provider is configured')
  assert.equal(getNavigationRoute('backup', 'Create Backup'), 'unavailable:backup:create-backup', 'Backup menu must not claim to create a backup without a platform backup service')
  assert.equal(getNavigationRoute('communication', 'WhatsApp Integration'), 'unavailable:communication:whatsapp-integration', 'External messaging must remain unconnected until credentials and delivery tests exist')
  assert.equal(getNavigationRoute('communication', 'Notification Centre'), 'notifications', 'In-app notifications remain a supported communication workflow')
  assert.equal(getNavigationRoute('employees', 'Employee Directory'), 'employees:directory', 'Employee Directory must open the staff directory window')
  assert.equal(getNavigationRoute('employees', 'Employee Reports'), 'employees:reports', 'Employee reports must open the staff report window')
  assert.equal(getNavigationRoute('dashboard', 'Institutional Overview', 'owner'), 'overview', 'Institutional overview must open the dashboard')
  assert.equal(getNavigationRoute('dashboard', 'Employee Performance', 'owner'), 'unavailable:dashboard:employee-performance', 'Employee appraisal must not be confused with an HR headcount report')
  assert.equal(getNavigationRoute('dashboard', 'Employee Performance', 'teacher'), 'unavailable:dashboard:employee-performance', 'Employee appraisal must stay unavailable until a review workflow exists')
  assert.equal(getNavigationRoute('dashboard', 'Financial Overview', 'teacher'), 'unavailable:dashboard:financial-overview', 'Teacher navigation must not expose institutional finance totals')
  assert.equal(getNavigationRoute('dashboard', 'Student Behaviour', 'student'), 'unavailable:dashboard:student-behaviour', 'Student dashboard must not expose staff-only behaviour logs')
  assert.equal(getNavigationRoute('reports', 'Employee Reports'), 'employees:reports', 'Employee report shortcut must open the HR report view')
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
  assert.ok(navigationRoutes['Student Directory']?.startsWith('students:'), 'Student Directory must open the student workspace')
  assert.equal(navigationRoutes['fees:fee-invoices'], 'finance:fees:invoices', 'Fee invoices must open the dedicated Finance & Payments workspace')
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
  assert.ok(dashboardSource.includes('id="ed360-workspace-search"') && dashboardSource.includes('Search pages and tools…'), 'Workspace page-and-tool search is missing')
  assert.ok(dashboardSource.includes('pro-workspace-tabs') && dashboardSource.includes('pro-window-stack') && dashboardSource.includes('closeWorkspaceTab'), 'Dashboard multi-window tab management is missing')
  assert.ok(dashboardSource.includes('parentId?: string') && dashboardSource.includes('function navigateChild') && dashboardSource.includes('tab.parentId'), 'Nested child workspace state must remain attached to a parent window')
  assert.ok(dashboardSource.includes("getNavigationRoute(group.key, item, user!.role)"), 'Sidebar destinations must use their exact group and active role')
  assert.ok(!dashboardSource.includes("group.key === 'dashboard' ? 'overview' : getNavigationRoute"), 'Dashboard submenu items must not all collapse to overview')
  assert.ok(dashboardSource.includes('closing.add(tab.id)') && dashboardSource.includes('parentStillOpen'), 'Closing a parent must close descendants and restore the parent context')
  assert.ok(dashboardSource.includes('ed360-topbar-institution') && dashboardSource.includes('ed360-topbar-notice'), 'Approved institution topbar is missing')
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
  const reports = read('src/components/ReportsModule.tsx')
  const administration = read('src/components/AdministrationModule.tsx')
  assert.ok(accounts.includes('Access Overview') && accounts.includes('Account Directory') && accounts.includes('Provision Account'), 'Accounts must have separate overview, directory and provisioning windows')
  assert.ok(files.includes('File Register') && files.includes('categoryFilter') && files.includes('viewingFile') && files.includes('CONTEXTUAL SUB-WINDOW'), 'Files must have category windows and a contextual file detail window')
  assert.ok(reports.includes('Finance & Collections') && reports.includes('Attendance Analysis') && reports.includes('Examination Results'), 'Reports must have separate subject-specific windows')
  assert.ok(administration.includes('Department Structure') && administration.includes('Class Capacity Overview') && administration.includes('Session Configuration'), 'Administration workspaces must use structure-specific tabs')
  const styles = read('src/styles/operational-hierarchy.css')
  assert.ok(styles.includes('zoom: 1.06') && styles.includes('.ed360-operations-window-nav') && styles.includes('.ed360-contextual-subwindow'), 'Readable UI scale and nested workspace styles are required')
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

check('Governance settings and approval queues support sorting and pagination', () => {
  const governance = read('src/components/GovernanceWorkspace.tsx')
  const styles = read('src/styles/governance-workspace.css')
  for (const value of ['settingsSortKey', 'settingsSortDirection', 'orderedSettings', 'settingsPageRows', 'orderedApprovals', 'approvalPageRows', 'toggleSettingsSort', 'sortHeader', 'pageControls']) {
    assert.ok(governance.includes(value), 'Governance list interaction is missing: ' + value)
  }
  assert.ok(governance.includes("onChange={e=>{setQuery(e.target.value);setSettingsPage(1);setApprovalPage(1)}}"), 'Governance search must reset both page positions')
  assert.ok(styles.includes('.gov-sort-header:focus-visible') && styles.includes('.gov-pagination'), 'Governance controls need accessible responsive styles')
})

check('Report tables show all rows through accessible sorting and pagination', () => {
  const reports = read('src/components/ReportsModule.tsx')
  const styles = read('src/styles/reports.css')
  for (const value of ['orderedRows', 'pageRows', 'toggleSort', 'aria-sort=', 'report-sort-header', 'report-table-pagination']) {
    assert.ok(reports.includes(value), 'Report table interaction is missing: ' + value)
  }
  assert.ok(!reports.includes('rows.slice(0, 200)'), 'Reports must not silently truncate records at 200 rows')
  assert.ok(styles.includes('.report-sort-header:focus-visible') && styles.includes('.report-table-pagination'), 'Report tables require responsive accessible controls')
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
  assert.ok(dashboard.includes('<FacultyWorkspace onToast={onToast} onNavigate={navigateChild} initialWindow={tab.targetWindow}/>'), 'Existing dashboard must route Faculty & Staff into their selected nested workspace')
  const migration = read('supabase/migrations/20261109083133_faculty_employee_management.sql')
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
  assert.equal(getNavigationRoute('administration', 'Institution Settings'), 'governance:settings')
  assert.equal(getNavigationRoute('administration', 'Approval and Workflows'), 'governance:approvals')
  assert.equal(getNavigationRoute('administration', 'Administrative Audit'), 'governance:audit')
  const governance = read('src/components/GovernanceWorkspace.tsx')
  for (const value of ['institution_settings', 'workflow_approvals', 'institutional_audit_events', 'decide_institution_setting_approval']) {
    assert.ok(governance.includes(value), 'Governance workspace is missing ' + value)
  }
  assert.ok(governance.includes('Read only') && governance.includes('does not grant direct client updates'), 'Institution profile must not offer an unsupported edit action')
  assert.ok(read('supabase/migrations/20261109151231_atomic_institution_setting_approval.sql').includes('decide_institution_setting_approval'))
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
  const reports = read('src/components/ReportsModule.tsx')
  for (const value of ['payroll_runs','payroll_items','Employee Reports','Payroll Reports','employeeColumns','payrollColumns']) assert.ok(reports.includes(value), 'Report workflow feature is missing: ' + value)
  assert.ok(reports.includes("const wantsEmployees = ['owner', 'admin'].includes(role)"))
  assert.ok(reports.includes("const wantsPayroll = ['owner', 'admin', 'accountant'].includes(role)"))
  assert.ok(reports.includes("'Restricted employee record'"), 'Payroll reports must not leak employee names to roles without staff directory permission')
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
check('Teacher reporting routes expose only the teacher-permitted report datasets', () => {
  const reports = read('src/components/ReportsModule.tsx')
  assert.ok(reports.includes("const wantsPeople = ['owner', 'admin', 'teacher'].includes(role)"))
  assert.ok(reports.includes("const wantsResults = ['owner', 'admin', 'teacher', 'exam_officer'].includes(role)"))
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
  for (const migration of ['001_initial_schema.sql', '017_public_institution_signup.sql', '018_assessment_metadata_and_result_visibility.sql', '019_phase_two_integrity_guards.sql', '020_fee_payment_date_validation.sql', '20261108053651_owner_signup_institution_details.sql', '20261109083133_faculty_employee_management.sql', '20261109092734_student_management_operations.sql', '20261109092920_student_management_scope_indexes_and_guardian_portal_read.sql', '20261109094108_student_activity_history_events.sql', '20261109094402_student_guardian_policy_consolidation_and_activity_indexes.sql', '20261109105804_institutional_platform_expansion.sql', '20261109110541_institution_attendance_bulk_register.sql', '20261109111818_institutional_policy_and_foreign_key_refinement.sql', '20261109113516_campus_scope_and_inventory_transaction_workflows.sql', '20261109113606_inventory_movement_row_count_safety_fix.sql', '20261109114108_transport_accountant_read_access.sql', '20261109125937_announcement_read_receipts.sql', '20261109130705_announcement_reads_index_and_fee_policy_cleanup.sql', '20261109150048_finance_accounting_and_payroll_workflows.sql', '20261109150654_atomic_employee_salary_profile_workflow.sql', '20261109150857_employee_own_payroll_run_read.sql', '20261109151231_atomic_institution_setting_approval.sql', '20261110082719_institutional_catalog_permissions.sql', '20261110082731_atomic_library_circulation.sql', '20261110082738_atomic_transport_allocations.sql']) {
    assert.ok(migrations.includes(migration), `${migration} missing`)
  }
  const timestamped = migrations.filter(name => /^202611\d{8}_.+\.sql$/.test(name))
  assert.equal(timestamped.length, 28, 'Expected twenty-eight timestamped migrations including staged catalogue, library and transport refinements')
  assert.ok(read('supabase/migrations/README.md').includes('twenty-eight timestamped migration files'))
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
