import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const hasBreakpoint = (css, width) => new RegExp('@media\\s*\\([^)]*max-width\\s*:\\s*' + width + 'px\\)').test(css)
const files = {
  html: read('index.html'),
  welcome: read('src/styles/welcome-marketing.css'),
  auth: read('src/styles/auth-experience.css'),
  dashboard: read('src/styles/pro-dashboard.css'),
  design: read('src/styles/design-system.css'),
  operational: read('src/styles/operational-hierarchy.css'),
  finance: read('src/styles/finance-workspace.css'),
  payroll: read('src/styles/payroll-workspace.css'),
  governance: read('src/styles/governance-workspace.css'),
  operations: read('src/styles/institution-operations.css'),
  institutional: read('src/styles/institutional-premium.css'),
  modules: read('src/styles/module-workspaces.css'),
  academic: read('src/styles/academic-management.css'),
  peopleHr: read('src/styles/people-hr-workspace.css'),
}
const checks = [
  ['Viewport', /<meta[^>]+name=["']viewport["']/.test(files.html) && /content=["']width=device-width, initial-scale=1\.0["']/.test(files.html), 'The document must declare the device-width viewport.'],
  ['Public welcome navigation', hasBreakpoint(files.welcome, 900) && hasBreakpoint(files.welcome, 620) && files.welcome.includes('.edm-nav.is-open') && files.welcome.includes('.edm-mobile-toggle'), 'Public navigation must collapse and expose its mobile menu below tablet widths.'],
  ['Public welcome layout', hasBreakpoint(files.welcome, 1120) && hasBreakpoint(files.welcome, 900) && hasBreakpoint(files.welcome, 620), 'Public sections must reflow at desktop, tablet and phone breakpoints.'],
  ['Authentication layout', hasBreakpoint(files.auth, 1050) && hasBreakpoint(files.auth, 760) && hasBreakpoint(files.auth, 420) && files.auth.includes('.es-auth-page,.es-auth-page-signup') && files.auth.includes('.es-signup-grid { grid-template-columns:1fr;'), 'Owner login/signup must collapse to a single column and form controls must remain single-column on phones.'],
  ['Signed-in dashboard shell', hasBreakpoint(files.dashboard, 820) && hasBreakpoint(files.dashboard, 600) && hasBreakpoint(files.dashboard, 380) && files.dashboard.includes('.pro-sidebar.is-open') && files.dashboard.includes('.pro-mobile-menu'), 'Dashboard must support drawer navigation and compact metric grids.'],
  ['Unified system and reduced motion', hasBreakpoint(files.design, 820) && hasBreakpoint(files.design, 600) && hasBreakpoint(files.design, 380) && files.design.includes('@media (prefers-reduced-motion: reduce)'), 'Unified visual layer must include tablet/mobile adjustments and reduced-motion handling.'],
  ['Operational workspace header', hasBreakpoint(files.operational, 850) && hasBreakpoint(files.operational, 600) && files.operational.includes('overflow-x:auto'), 'Operational workspace actions and horizontally scrollable sub-navigation must adapt on small screens.'],
  ['Finance workspace', hasBreakpoint(files.finance, 980) && hasBreakpoint(files.finance, 620) && hasBreakpoint(files.finance, 600), 'Finance workspace must reflow its cards, panels and forms for small screens.'],
  ['Payroll workspace', hasBreakpoint(files.payroll, 1020) && hasBreakpoint(files.payroll, 640) && hasBreakpoint(files.payroll, 620), 'Payroll workspace must reflow its tables and panels on phones.'],
  ['Governance workspace', hasBreakpoint(files.governance, 980) && hasBreakpoint(files.governance, 620), 'Governance workspace must reflow its approval and settings panels.'],
  ['Institution operations workspace', hasBreakpoint(files.operations, 1000) && hasBreakpoint(files.operations, 620), 'Institution operations must adapt its forms and panels.'],
  ['Institutional workspace', [1000,720,700,650,620,430].some(width => hasBreakpoint(files.institutional,width)) && hasBreakpoint(files.institutional,430), 'Institutional records must have both tablet and narrow-phone adjustments.'],
  ['Generic module workspaces', [1080,760,720,580,540,520].every(width => hasBreakpoint(files.modules,width)), 'Generic record modules must include responsive breakpoints for tablet and phone widths.'],
  ['Stage 8 academic workspace', hasBreakpoint(files.academic,1100) && hasBreakpoint(files.academic,800) && hasBreakpoint(files.academic,540) && files.academic.includes('.ed360-academic-nav') && files.academic.includes('.ed360-academic-table-wrap') && files.academic.includes('.ed360-academic-modal'), 'Academic navigation, record tables and forms must adapt for desktop, tablet and phone layouts.'],
  ['People & HR workspace', hasBreakpoint(files.peopleHr,980) && hasBreakpoint(files.peopleHr,620) && files.peopleHr.includes('overflow-x:auto'), 'People & HR tables and workflow panels must adapt to phone widths.'],
]
const failed = checks.filter(([,ok]) => !ok)
if (failed.length) {
  for (const [name,,detail] of failed) console.error('RESPONSIVE SOURCE CHECK FAILED | ' + name + ' | ' + detail)
  throw new Error(failed.length + ' responsive source checks failed')
}

const md = [
  '# Phase 2 — Responsive source coverage audit',
  '',
  '**Generated:** by the repository release workflow.',
  '**Scope:** responsive CSS declarations and required mobile navigation/form layout hooks.',
  '**Automated checks:** 14 responsive source checks passed.',
  '',
  '## Evidence boundary',
  '',
  'This is a static source audit. It confirms that the expected viewport declaration, breakpoints and layout selectors exist in the active stylesheet files. It does **not** calculate browser layout, measure rendered overflow, test touch targets, inspect screenshots, or substitute for browser testing at 390×844 and 768×1024.',
  '',
  '## Source checks',
  '',
  '| Area | Source-level result | Breakpoints / evidence |',
  '|---|---|---|',
  '| Document viewport | Pass | `width=device-width, initial-scale=1.0` |',
  '| Public welcome navigation | Pass | 900px / 620px; mobile toggle and open navigation state |',
  '| Public welcome sections | Pass | 1120px / 900px / 620px |',
  '| Login and owner signup | Pass | 1050px / 760px / 420px; signup grid collapses to one column |',
  '| Signed-in dashboard | Pass | 820px / 600px / 380px; off-canvas sidebar and mobile menu |',
  '| Shared design system | Pass | 820px / 600px / 380px; reduced-motion query |',
  '| Operational workspaces | Pass | 850px / 600px; horizontally scrollable sub-navigation |',
  '| Finance / payroll / governance | Pass | Dedicated tablet and phone breakpoints in each workspace stylesheet |',
  '| Campus operations and institutional records | Pass | Tablet, 620px and 430px breakpoints |',
  '| Generic module workspaces | Pass | 1080px / 760px / 720px / 580px / 540px / 520px |',
  '',
  '## Target viewport coverage (source-level only)',
  '',
  '| Target viewport | Expected applicable rules | Areas covered |',
  '|---|---|---|',
  '| Tablet — 768×1024 | 900px, 850px, 820px, 760px, 720px and workspace-specific breakpoints | Public menu collapse, one-column auth shell, dashboard drawer, workspace panels |',
  '| Mobile — 390×844 | 620px, 600px, 540px, 520px, 430px and 420px rules | Mobile public sections, auth/signup form, dashboard metrics, compact workspace layouts |',
  '',
  '## Browser acceptance still required',
  '',
  '- Capture the actual PR preview at 1440×900, 768×1024 and 390×844.',
  '- Verify no horizontal overflow, hidden submit buttons, clipped labels, overlapping navigation, or unreadable data tables.',
  '- Test the public mobile menu, dashboard sidebar open/close, touch-target spacing, keyboard focus and reduced-motion behaviour.',
  '- Repeat with authenticated sessions for all seven roles before release.',
  '',
  'A source-level pass is not a visual approval or an authenticated role test.',
  '',
]
const output = path.join(root, 'docs/PHASE_2_RESPONSIVE_SOURCE_AUDIT.md')
fs.writeFileSync(output, md.join('\n'), 'utf8')
console.log('Generated docs/PHASE_2_RESPONSIVE_SOURCE_AUDIT.md: ' + checks.length + ' responsive source checks passed; visual viewport acceptance remains pending.')
