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
  'src/components/RecordModule.tsx', 'src/context/AuthContext.tsx', 'src/lib/auth.ts',
  'src/lib/data.ts', 'src/lib/navigationAccess.ts', 'src/lib/userErrors.ts', 'scripts/test-user-errors.mjs',
  'src/lib/finance.ts', 'scripts/test-finance.mjs', 'src/lib/fileAccess.ts', 'scripts/test-file-access.mjs',
  'src/lib/navigationCatalog.ts', 'src/lib/navigationRoutes.ts', 'public/_redirects',
  '.env.example', 'package-lock.json', 'src/lib/types.ts', 'supabase/migrations/20261108053651_owner_signup_institution_details.sql',
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

check('The approved eight-group menu maps every submenu to a real workspace', () => {
  const expected = [
    ['Dashboard', []],
    ['Admission & Students', ['Student Record']],
    ['People & Staff', ['Faculty & Staff', 'User Account']],
    ['Institute Administration', ['Departments', 'Programs', 'Class Sections', 'Academic Session', 'Subjects', 'Rooms & Facilities', 'Files & Documentation']],
    ['Academic Management', ['Attendance Registration', 'Examination', 'Exam Results', 'Assignments', 'Assignment Submission', 'Timetable']],
    ['Finance & Payments', ['Fees Invoice']],
    ['Communication', ['Announcement']],
    ['Operations & Reports', ['Work Management', 'Reports']],
  ]
  assert.equal(navigationCatalog.length, expected.length, 'The main menu must contain exactly eight groups')
  for (let i = 0; i < expected.length; i++) {
    assert.equal(navigationCatalog[i].label, expected[i][0], `Unexpected menu group at position ${i + 1}`)
    assert.deepEqual(navigationCatalog[i].items, expected[i][1], `Unexpected submenu list for ${expected[i][0]}`)
  }
  assert.ok(navigationCatalog.some(group => group.key === 'dashboard' && group.items.length === 0), 'Dashboard should be a direct destination')
  for (const group of navigationCatalog) for (const page of group.items) {
    assert.ok(navigationRoutes[page], `No route is connected for ${group.label}/${page}`)
  }
  const moduleKeys = new Set(modules.map(module => module.key))
  const adminKeys = new Set(['departments', 'programs', 'classes', 'academic_sessions', 'subjects', 'rooms'])
  for (const [page, route] of Object.entries(navigationRoutes)) {
    if (route.startsWith('admin:')) assert.ok(adminKeys.has(route.slice(6)), `${page} points to an unknown administration screen`)
    else if (!['overview', 'accounts', 'files', 'reports', 'profile'].includes(route)) assert.ok(moduleKeys.has(route), `${page} points to a missing data module: ${route}`)
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
  assert.ok(!roleNavigationGroups('teacher').some(group => group.key === 'administration'))
  assert.ok(!roleNavigationGroups('student').some(group => group.key === 'administration'))
  assert.ok(!roleNavigationGroups('accountant').some(group => group.key === 'employees'))
  assert.ok(!roleNavigationGroups('exam_officer').some(group => group.key === 'employees'))
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
  assert.ok(dashboardSource.includes('pro-menu-overview'), 'Dashboard must display the role-based menu overview')
  assert.ok(dashboardSource.includes('roleNavigationGroups(user!.role)'), 'Dashboard menu overview must follow role permissions')
  assert.ok(dashboardSource.includes('Search workspace'), 'Workspace search is missing')
  assert.ok(dashboardSource.includes('pro-profile-menu'), 'Account menu is missing')
  assert.ok(dashboardSource.includes("available.some(module => module.key === 'attendance')"), 'Attendance insights must only display for roles with attendance access')
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
  for (const migration of ['001_initial_schema.sql', '017_public_institution_signup.sql', '018_assessment_metadata_and_result_visibility.sql', '019_phase_two_integrity_guards.sql', '020_fee_payment_date_validation.sql', '20261108053651_owner_signup_institution_details.sql']) {
    assert.ok(migrations.includes(migration), `${migration} missing`)
  }
  const timestamped = migrations.filter(name => /^20261108\d{6}_.+\.sql$/.test(name))
  assert.equal(timestamped.length, 6, 'Expected six timestamped migrations matching the observed live migration history')
  assert.ok(read('supabase/migrations/README.md').includes('six `20261108...` migration files'))
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
    for (const diagnostic of parsed.parseDiagnostics ?? []) diagnostics.push(`${path.relative(root, file)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`)
  }
  assert.deepEqual(diagnostics, [], diagnostics.join('\n'))
  console.log(`      Parsed ${sourceFiles.length} TypeScript/TSX files.`)
})

console.log('\nRole workspace counts:')
for (const [role, count] of Object.entries(roleCounts)) console.log(`  ${role.padEnd(13)} ${String(count.groups).padStart(2)} menu groups / ${String(count.destinations).padStart(2)} destinations`)
console.log(`\nConfigured data modules: ${modules.length}`)
if (process.exitCode) process.exit(process.exitCode)
console.log('\nProject verification passed. This checks source and configuration; it is not a live end-to-end Supabase test.')
