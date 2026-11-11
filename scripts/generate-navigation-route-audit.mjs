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
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  module._compile(output, filename)
}

const { getNavigationRoute } = require(path.join(root, 'src/lib/navigationRoutes.ts'))
const { roleNavigationGroups } = require(path.join(root, 'src/lib/navigationCatalog.ts'))

const roles = [
  ['owner', 'Owner'],
  ['admin', 'Administrator'],
  ['teacher', 'Teacher / employee'],
  ['student', 'Student'],
  ['parent', 'Parent / guardian'],
  ['accountant', 'Accountant'],
  ['exam_officer', 'Examination officer'],
]

const classify = (route) => {
  if (route.startsWith('unavailable:')) return 'Explicitly unavailable'
  if (route.startsWith('institutional:')) return 'Linked institutional workspace · acceptance pending'
  const workspace = route.split(':')[0]
  const rootRoute = route === workspace
  const intentionalRootRoutes = new Set(['overview', 'notifications', 'files'])
  const known = new Set([
    'admin', 'assignments', 'assignment_submissions', 'attendance', 'announcements',
    'employees', 'exam_results', 'exams', 'fees', 'finance', 'files', 'governance',
    'notifications', 'operations', 'overview', 'payroll', 'reports', 'students',
    'timetable', 'work_tasks',
  ])
  if (!known.has(workspace)) return 'Unexpected route family · investigate'
  if (rootRoute && !intentionalRootRoutes.has(route)) return 'Bare module root · confirm the intended default window'
  return 'Workspace route resolved · acceptance pending'
}

const rows = []
const summaries = {}
const totals = { groups: 0, destinations: 0, unavailable: 0, linked: 0, workspace: 0, root: 0, unexpected: 0 }
const groupTotals = new Map()

for (const [role, roleLabel] of roles) {
  const groups = roleNavigationGroups(role)
  const summary = { groups: groups.length, destinations: 0, unavailable: 0, linked: 0, workspace: 0, root: 0, unexpected: 0 }
  summaries[role] = summary
  for (const group of groups) {
    groupTotals.set(group.key, group.label)
    for (const label of group.items) {
      const route = getNavigationRoute(group.key, label, role)
      if (typeof route !== 'string' || !route.trim()) {
        throw new Error(`Empty route for ${role}/${group.key}/${label}`)
      }
      const status = classify(route)
      const family = route.split(':')[0]
      summary.destinations += 1
      totals.destinations += 1
      if (status === 'Explicitly unavailable') { summary.unavailable += 1; totals.unavailable += 1 }
      else if (status.startsWith('Linked')) { summary.linked += 1; totals.linked += 1 }
      else if (status.startsWith('Unexpected')) { summary.unexpected += 1; totals.unexpected += 1 }
      else if (status.startsWith('Bare module root')) { summary.root += 1; totals.root += 1 }
      else { summary.workspace += 1; totals.workspace += 1 }
      rows.push({ role, roleLabel, group: group.key, groupLabel: group.label, label, route, family, status })
    }
  }
  totals.groups = Math.max(totals.groups, groups.length)
}

const md = []
md.push('# Phase 1 — Exact role-aware route resolution audit')
md.push('')
md.push('**Generated:** by the repository source verifier during GitHub Actions  ')
md.push('**Resolver:** `src/lib/navigationRoutes.ts#getNavigationRoute`  ')
md.push('**Role filter:** `src/lib/navigationCatalog.ts#roleNavigationGroups`  ')
md.push('')
md.push('## Evidence boundary')
md.push('')
md.push('Every row below is the exact route string returned by the current TypeScript resolver when called with the visible menu group, item label and role. This verifies source-level route resolution only. It does not verify the rendered destination, database authorization, RLS, persistence, external integrations or a successful user journey.')
md.push('')
md.push('A route beginning with `unavailable:` is explicitly unavailable. A linked institutional route is mapped to an existing linked workspace but still needs functional acceptance. Bare routes such as `overview`, `notifications` and `files` are treated as intentional roots; other bare module roots are flagged for confirmation of their default sub-view. All remaining workspace routes still require module-level testing.')
md.push('')
md.push('## Resolver totals')
md.push('')
md.push('| Role | Visible groups | Destinations | Explicitly unavailable | Linked institutional | Workspace routes | Bare roots to review | Unexpected |')
md.push('|---|---:|---:|---:|---:|---:|---:|---:|')
for (const [role, label] of roles) {
  const s = summaries[role]
  md.push(`| ${label} | ${s.groups} | ${s.destinations} | ${s.unavailable} | ${s.linked} | ${s.workspace} | ${s.root} | ${s.unexpected} |`)
}
md.push('')
md.push(`**Total resolver evaluations:** ${totals.destinations}.  **Groups:** ${groupTotals.size}.  **Bare module roots to review:** ${totals.root}.  **Unexpected route families:** ${totals.unexpected}.`)
md.push('')
md.push('## Exact route matrix')
for (const [role, roleLabel] of roles) {
  md.push('')
  md.push(`### ${roleLabel} (${role})`)
  md.push('')
  md.push('| Menu group | Submenu destination | Exact resolver output | Route family | Source status |')
  md.push('|---|---|---|---|---|')
  for (const row of rows.filter(item => item.role === role)) {
    md.push(`| ${row.groupLabel} (${row.group}) | ${row.label.replaceAll('|', '\\|')} | \`${row.route}\` | ${row.family} | ${row.status} |`)
  }
}
md.push('')
md.push('## Release acceptance still required')
md.push('')
md.push('- Open every resolved route and verify the intended workspace and selected sub-view.')
md.push('- Test allowed and denied roles through direct navigation and API/RLS, not just the menu.')
md.push('- Confirm tenant boundaries and parent-to-student relationship scoping.')
md.push('- Test each domain-specific create/edit/approve/post/return/publish lifecycle using controlled test records.')
md.push('- Keep external services marked unavailable until credentials, provider confirmation and delivery evidence exist.')
md.push('- Capture desktop, tablet and mobile screenshots and inspect overflow, contrast, focus, labels, loading, empty and error states.')
md.push('')

const output = path.join(root, 'docs/PHASE_1_EXACT_ROUTE_AUDIT.md')
fs.writeFileSync(output, md.join('\n'), 'utf8')
console.log(`Generated ${path.relative(root, output)}: ${totals.destinations} exact role-aware route evaluations; ${totals.unavailable} unavailable; ${totals.linked} linked; ${totals.root} bare roots to review; ${totals.unexpected} unexpected.`)
if (totals.unexpected > 0) process.exitCode = 1
