import {
  institutionalMenu,
  institutionalRoute,
  existingRouteOverrides,
} from './institutionalCatalog'

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const linkedRoutes = new Set([
  'administration:campus-and-branch-management',
  'library:book-issue-and-returns',
  'inventory:stock-in',
  'inventory:stock-out',
  'inventory:stock-allocation',
  'inventory:stock-adjustments',
  'inventory:inventory-history',
  'inventory:stock-reports',
  'transport:student-transport-allocation',
])

const studentViews: Record<string, string> = {
  'student-directory': 'directory',
  'new-admissions': 'admissions',
  'admission-applications': 'admissions',
  'student-profiles': 'profile',
  'enrollment': 'admissions',
  'class-and-section-assignments': 'classes',
  'promotion-and-transfer': 'classes',
  'student-documentation': 'documents',
  'student-history': 'history',
  'alumni-records': 'history',
  'student-performance-charts': 'results',
  'student-reports': 'results',
  'student-data-export': 'directory',
  'bulk-student-operations': 'directory',
}

const employeeViews: Record<string, string> = {
  'employee-directory': 'directory',
  'add-employee': 'registration',
  'teacher-records': 'directory',
  'non-teaching-staff': 'directory',
  'employee-profiles': 'profile',
  'department-allocation': 'departments',
  'designations': 'designations',
  'workload-allocation': 'workload',
  'employee-documentation': 'documents',
  'employee-id-cards': 'documents',
  'employee-history': 'history',
  'employee-performance': 'reports',
  'employee-attendance': 'attendance',
  'employee-leave-management': 'leave',
  'employee-reports': 'reports',
}

const attendanceViews: Record<string, string> = {
  'attendance-dashboard': 'students',
  'student-attendance': 'students',
  'daily-attendance': 'students',
  'period-wise-attendance': 'students',
  'class-wise-attendance': 'students',
  'bulk-student-attendance': 'students',
  'faculty-and-staff-attendance': 'staff',
  'bulk-staff-attendance': 'staff',
  'attendance-corrections': 'history',
  'leave-applications': 'staff',
  'late-arrival': 'history',
  'early-departure': 'staff',
  'attendance-calendar': 'history',
  'attendance-history': 'history',
  'attendance-devices': 'devices',
}

const reportViews: Record<string, string> = {
  'reports-dashboard': 'overview',
  'student-reports': 'students',
  'attendance-reports': 'attendance',
  'examination-reports': 'academics',
  'academic-reports': 'academics',
  'fee-reports': 'finance',
  'financial-reports': 'finance',
}

const financeSections: Record<string, string> = {
  'accounts-dashboard': 'overview',
  'chart-of-accounts': 'accounts',
  'income': 'journals',
  'expenses': 'journals',
  'cash-book': 'reconciliation',
  'bank-book': 'reconciliation',
  'transactions': 'journals',
  'vouchers': 'journals',
  'general-ledger': 'journals',
  'financial-statements': 'reconciliation',
  'account-reconciliation': 'reconciliation',
  'financial-reports': 'reconciliation',
  'fees-dashboard': 'overview',
  'fee-structure': 'structures',
  'fee-categories': 'structures',
  'student-fee-assignment': 'structures',
  'fee-invoices': 'invoices',
  'payment-collection': 'payments',
  'online-payments': 'payments',
  'partial-payments': 'receivables',
  'discounts': 'discounts',
  'scholarships': 'discounts',
  'outstanding-dues': 'receivables',
  'fee-refunds': 'refunds',
  'fee-receipts': 'receipts',
  'class-wise-collection-reports': 'reconciliation',
  'section-wise-collection-reports': 'reconciliation',
  'overall-collection-reports': 'reconciliation',
  'receivables-dashboard': 'overview',
  'total-outstanding': 'receivables',
  'student-wise-receivables': 'receivables',
  'invoice-wise-receivables': 'receivables',
  'overdue-accounts': 'receivables',
  'ageing-analysis': 'receivables',
  'partial-payment-balances': 'receivables',
  'collection-follow-ups': 'receivables',
  'outstanding-history': 'receivables',
  'receivable-reconciliation': 'reconciliation',
  'collection-forecasts': 'receivables',
  'receivables-reports': 'reconciliation',
  'payments-dashboard': 'overview',
  'online-payment-records': 'payments',
  'cash-payments': 'payments',
  'bank-payments': 'payments',
  'payment-verification': 'reconciliation',
  'payment-reconciliation': 'reconciliation',
  'refund-processing': 'refunds',
  'payment-history': 'payments',
  'failed-and-pending-payments': 'payments',
  'collection-reports': 'reconciliation',
  'receipt-dashboard': 'overview',
  'generate-receipt': 'receipts',
  'payment-receipts': 'receipts',
  'receipt-history': 'receipts',
  'receipt-reprinting': 'receipts',
  'receipt-templates': 'receipts',
  'receipt-numbering': 'receipts',
  'receipt-verification': 'receipts',
  'bulk-receipt-generation': 'receipts',
  'reconciliation-dashboard': 'overview',
  'financial-reconciliation': 'reconciliation',
  'bank-reconciliation': 'reconciliation',
  'cash-reconciliation': 'reconciliation',
  'fee-collection-reconciliation': 'reconciliation',
  'transaction-verification': 'reconciliation',
  'audit-logs': 'reconciliation',
  'administrative-audit': 'reconciliation',
  'user-activity-logs': 'reconciliation',
  'access-history': 'reconciliation',
  'change-history': 'reconciliation',
  'audit-reports': 'reconciliation',
}

function financeRoute(groupKey: string, itemKey: string): string | undefined {
  if (!['accounts-finance', 'fees', 'receivables', 'payments', 'receipts', 'reconciliation'].includes(groupKey)) return undefined
  return `finance:${groupKey}:${financeSections[itemKey] ?? (groupKey === 'fees' ? 'invoices' : groupKey === 'receivables' ? 'receivables' : groupKey === 'payments' ? 'payments' : groupKey === 'receipts' ? 'receipts' : groupKey === 'reconciliation' ? 'reconciliation' : 'accounts')}`
}

const payrollSections: Record<string, string> = {
  'payroll-dashboard': 'overview',
  'salary-structure': 'salary',
  'salary-components': 'salary',
  'employee-salary-assignment': 'salary',
  'monthly-payroll': 'runs',
  'allowances': 'salary',
  'deductions': 'salary',
  'advances-and-loans': 'runs',
  'advance-recovery': 'runs',
  'payslips': 'payslips',
  'salary-payments': 'runs',
  'payroll-reports': 'payslips',
}

function payrollRoute(itemKey: string): string {
  return `payroll:${payrollSections[itemKey] ?? 'overview'}`
}

const governanceRoutes: Record<string,string> = {
  'institute-profile': 'profile',
  'institution-settings': 'settings',
  'branding-and-document-settings': 'settings',
  'system-configuration': 'settings',
  'approval-and-workflows': 'approvals',
  'administrative-audit': 'audit',
  'security-and-access-history': 'audit',
  'institution-configuration': 'settings',
  'education-system-configuration': 'settings',
  'education-levels': 'academic',
  'grade-and-academic-level-configuration': 'academic',
  'academic-settings': 'academic',
  'general-system-settings': 'settings',
  'campus-settings': 'settings',
  'user-management': 'accounts',
  'invitations-and-access': 'accounts',
  'role-management': 'accounts',
  'user-permissions': 'accounts',
  'module-permissions': 'accounts',
  'approval-permissions': 'approvals',
  'security-configuration': 'audit',
}

function dedicatedRoute(groupKey: string, itemKey: string): string | undefined {
  if (groupKey === 'students') {
    const view = studentViews[itemKey]
    return view ? `students:${view}` : undefined
  }
  if (groupKey === 'employees') {
    const view = employeeViews[itemKey]
    return view ? `employees:${view}` : undefined
  }
  if (groupKey === 'attendance') {
    const view = attendanceViews[itemKey]
    return view ? `attendance:${view}` : undefined
  }
  if (groupKey === 'academic-sessions') return 'admin:academic_sessions'
  if (groupKey === 'classes-sections') return 'admin:classes'
  if (groupKey === 'subjects') return 'admin:subjects'
  if (groupKey === 'teaching') {
    if (['homework', 'create-assignment', 'assignment-design-and-management', 'pending-assignments', 'assignment-history', 'assignment-reports'].includes(itemKey)) {
      const view = itemKey === 'homework' ? 'open' : itemKey === 'pending-assignments' ? 'upcoming' : 'board'
      return `assignments:${view}`
    }
    if (['student-submissions', 'teacher-review', 'pending-reviews', 'marks-and-feedback'].includes(itemKey)) {
      const view = itemKey === 'pending-reviews' ? 'awaiting' : 'inbox'
      return `assignment_submissions:${view}`
    }
  }
  if (groupKey === 'examinations' || groupKey === 'class-tests') {
    if (['marks-entry', 'report-cards', 'results-publication', 'result-analysis'].includes(itemKey)) {
      return `exam_results:${itemKey === 'results-publication' ? 'published' : 'all'}`
    }
    return `exams:${itemKey === 'upcoming-examinations' ? 'upcoming' : itemKey === 'completed-examinations' ? 'completed' : 'calendar'}`
  }
  if (groupKey === 'fees' || groupKey === 'receivables' || groupKey === 'payments' || groupKey === 'receipts') {
    const view = itemKey.includes('overdue') ? 'overdue'
      : itemKey.includes('partial') ? 'partial'
      : itemKey.includes('outstanding') || itemKey.includes('unpaid') || itemKey.includes('due') ? 'due'
      : itemKey.includes('receipt') || itemKey.includes('settled') ? 'settled'
      : 'ledger'
    if (groupKey === 'fees' && ['fee-structure', 'fee-categories', 'student-fee-assignment', 'discounts', 'scholarships', 'fee-refunds'].includes(itemKey)) return undefined
    if (groupKey === 'payments' && ['online-payments', 'online-payment-records', 'failed-and-pending-payments'].includes(itemKey)) return undefined
    if (groupKey === 'receipts' && ['receipt-templates', 'receipt-numbering', 'bulk-receipt-generation', 'receipt-verification'].includes(itemKey)) return undefined
    return `fees:${view}`
  }
  if (groupKey === 'timetable') {
    const day = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].find(value => itemKey.includes(value))
    return `timetable:${day ?? (itemKey.includes('conflict') ? 'unassigned' : 'week')}`
  }
  if (groupKey === 'communication' && ['communication-dashboard', 'notification-centre', 'announcements', 'institution-bulletin'].includes(itemKey)) {
    return `announcements:${itemKey.includes('notification') ? 'staff' : 'bulletin'}`
  }
  if (groupKey === 'reports') {
    const view = reportViews[itemKey]
    return view ? `reports:${view}` : undefined
  }
  if (groupKey === 'administration') {
    const adminKey = itemKey === 'academic-structure-and-sections' ? 'classes'
      : itemKey === 'departments' ? 'departments'
      : itemKey === 'system-configuration' || itemKey === 'academic-configuration' ? 'academic_sessions'
      : undefined
    return adminKey ? `admin:${adminKey}` : undefined
  }
  return undefined
}

/**
 * Resolve a destination in its menu-group context. This avoids collisions when
 * two groups contain the same display label and prevents silent routing into
 * the generic institutional_records CRUD screen.
 */
export function getNavigationRoute(groupKey: string, itemLabel: string): string {
  const itemKey = slug(itemLabel)
  const compositeKey = `${groupKey}:${itemKey}`
  const override = existingRouteOverrides[compositeKey]

  const financeDestination = financeRoute(groupKey,itemKey)
  if (financeDestination) return financeDestination
  if (groupKey === 'payroll') return payrollRoute(itemKey)
  if (groupKey === 'administration' && governanceRoutes[itemKey] && !['campus-and-branch-management','departments','designations','academic-structure-and-sections'].includes(itemKey)) {
    return `governance:${governanceRoutes[itemKey]}`
  }
  if (groupKey === 'institution-config' && governanceRoutes[itemKey]) return `governance:${governanceRoutes[itemKey]}`

  // A few older shortcuts pointed at a module root, losing the requested
  // report/employee/coursework sub-view. Prefer the typed sub-view in those groups.
  if (['reports', 'teaching', 'employees', 'attendance', 'examinations', 'class-tests'].includes(groupKey)) {
    const contextualRoute = dedicatedRoute(groupKey, itemKey)
    if (contextualRoute) return contextualRoute
  }
  if (groupKey === 'attendance' && itemKey === 'attendance-reports') return 'reports:attendance'

  if (override && (!override.startsWith('institutional:') || linkedRoutes.has(compositeKey))) {
    return override
  }

  const route = dedicatedRoute(groupKey, itemKey)
  if (route) return route

  if (linkedRoutes.has(compositeKey)) return institutionalRoute(groupKey, itemKey)
  return `unavailable:${groupKey}:${itemKey}`
}

const contextualEntries = institutionalMenu.flatMap(group => group.items.map(item => [
  `${group.key}:${item.key}`,
  getNavigationRoute(group.key, item.label),
] as const))

const legacyLabelEntries = institutionalMenu.flatMap(group => group.items.map(item => [
  item.label,
  getNavigationRoute(group.key, item.label),
] as const))

/** Composite keys are authoritative; label keys remain for older callers and checks. */
export const navigationRoutes: Record<string, string> = Object.fromEntries([
  ...legacyLabelEntries,
  ...contextualEntries,
  ['Dashboard', 'overview'],
  ['Notification Centre', 'notifications'],
])
