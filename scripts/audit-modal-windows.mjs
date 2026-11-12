import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const record = read('src/components/RecordModule.tsx')
const finance = read('src/components/FinanceWorkspace.tsx')
const refresh = read('src/styles/visual-refresh.css') + '\n' + read('src/styles/product-unification.css')
const main = read('src/main.tsx')
const dashboard = read('src/components/Dashboard.tsx')

const checks = [
  ['final visual layer loads after legacy styles', main.indexOf("import './styles/visual-refresh.css'") > main.indexOf("import './styles/design-system.css'")],
  ['record modal behavior uses a stable close callback ref', record.includes('const closeRef = useRef(onClose)')],
  ['record modal closes with Escape', record.includes("event.key === 'Escape'") && record.includes('closeRef.current()')],
  ['record modal traps keyboard Tab focus', record.includes("event.key !== 'Tab'") && record.includes('last.focus()') && record.includes('first.focus()')],
  ['record modal locks background scrolling and restores it', record.includes("document.body.style.overflow = 'hidden'") && record.includes('document.body.style.overflow = previousOverflow')],
  ['record modal restores focus to the opener', record.includes('previouslyFocused?.focus()')],
  ['record create/edit window has dialog semantics', /role="dialog" aria-modal="true" aria-labelledby="record-form-title"/.test(record)],
  ['record form, details and fee dialogs share the modal controller', (record.match(/useModalControls\(/g) ?? []).length >= 5],
  ['finance workspace identifies all supported dialog types', ['invoice','payment','structure','discount','discount-application','refund','account','journal'].every(name => finance.includes("'" + name + "'"))],
  ['finance dialog keyboard handling closes with Escape and traps focus', finance.includes("event.key === 'Escape'") && finance.includes("event.key !== 'Tab'") && finance.includes('last.focus()')],
  ['finance dialogs lock and restore page scrolling and focus', finance.includes("document.body.style.overflow = 'hidden'") && finance.includes('document.body.style.overflow = previousOverflow') && finance.includes('previousFocus?.focus()')],
  ['finance modal sections expose accessible labels', (finance.match(/aria-label="(?:Create fee invoice|Collect fee payment|Create fee schedule|Create discount scheme|Apply invoice discount|Record refund request|Add finance account|Create journal entry)"/g) ?? []).length === 8],
  ['student, faculty and attendance workspaces have final design rules', ['.ed360-student-window-nav','.student-directory-card','.faculty-directory-card','.ed360-attendance-workspace'].every(selector => refresh.includes(selector))],
  ['finance, governance, campus operations, payroll and reports have final design rules', ['.fin-stage','.gov-stage','.iop-stage','.payroll-stage','.report-stage'].every(selector => refresh.includes(selector))],
  ['notification centre has final card and filter styles', refresh.includes('.ed360-notification-page') && refresh.includes('.ed360-notification-card')],
  ['responsive breakpoints and reduced-motion preferences remain defined', refresh.includes('@media(max-width:680px)') && refresh.includes('@media(prefers-reduced-motion:reduce)')],
  ['workspace windows use one canonical tab identity per destination', dashboard.includes('const id = key') && dashboard.includes('const parentId = options.parentId && options.parentId !== id ? options.parentId : undefined')],
  ['opening a workspace cannot make a window its own parent', dashboard.includes('options.parentId !== id')],
  ['active menu state highlights only the exact selected submenu, including child navigation', dashboard.includes('activeNavigationTab.groupKey === group.key && activeNavigationTab.itemKey === itemKey') && !dashboard.includes('activeTab.route === route')],
  ['active menu state follows the parent workspace context for nested child windows', dashboard.includes('const activeNavigationTab = (() =>') && dashboard.includes('activeNavigationTab.groupKey === group.key')],
  ['collapsed sidebar disclosure expands before showing the selected submenu', dashboard.includes('if (compactSidebar) {') && dashboard.includes('setExpandedGroups(current => current.includes(group.key) ? current : [...current, group.key])')],
  ['open-window tab bar and active-workspace context strip are permanently removed', !dashboard.includes('className="pro-workspace-tabs"') && !dashboard.includes('className="pro-active-workspace-context"')],
  ['workspace panels retain one active page at a time without visible window chrome', dashboard.includes('className="pro-window-panel"') && dashboard.includes('hidden={activeTabId !== tab.id}') && dashboard.includes('aria-label={tab.title}')],
  ['stage branding is removed from user-facing workspace titles', !dashboard.includes('Stage 7 · Student Care & Wellbeing')],
  ['premium visual refresh styles the active workspace, cards, forms and tables', ['.pro-module-stage','.ed360-metric-card','.pro-window-panel :is(input,select,textarea)','.pro-window-panel :is(table th,.data-table th)'].every(selector => refresh.includes(selector))],
  ['student and faculty directories receive readable table and metric typography', ['.student-stat-label','.student-table th','.faculty-stat-label','.faculty-table td'].every(selector => refresh.includes(selector))],
  ['staff management heading, sub-windows, tables and dialogs receive readable presentation', ['.staff-workspace-heading','.staff-window-nav','.staff-table th','.staff-dialog'].every(selector => refresh.includes(selector))],
  ['administration and attendance workspaces receive consistent card and control styling', ['.admin-heading','.admin-table th','.ed360-attendance-filter-card','.ed360-attendance-board'].every(selector => refresh.includes(selector))],
  ['signed-in dashboard includes a campus photograph background treatment', refresh.includes('url("https://images.pexels.com/photos/29326797/pexels-photo-29326797.jpeg?auto=compress&cs=tinysrgb&w=1600")')],

]

let failed = 0
console.log('EduSphere 360 — modal, window and workspace visual source audit')
for (const [label, passed] of checks) {
  console.log((passed ? 'PASS' : 'FAIL') + '  ' + label)
  if (!passed) failed++
}
console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks passed')
if (failed) process.exitCode = 1
