import {
  institutionalMenu,
  institutionalRoute,
  existingRouteOverrides,
  getWorkspaceGroup,
  getWorkspaceItem,
} from './institutionalCatalog'
import { roleNavigationGroups } from './navigationCatalog'

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const linkedRoutes = new Set([
  'administration:campus-and-branch-management',
  'library:book-issue-and-returns','library:digital-library','library:book-management','library:book-catalogue','library:book-categories','library:book-registration','library:reading-records','library:reading-cards','library:student-reading-history','library:learning-materials','library:resource-downloads','library:library-reports',
  'inventory:items-management','inventory:item-catalogue','inventory:item-categories','inventory:suppliers','inventory:purchase-records','inventory:stock-in','inventory:stock-out','inventory:stock-allocation','inventory:stock-adjustments','inventory:inventory-history','inventory:stock-reports',
  'transport:vehicle-management','transport:drivers-management','transport:transport-routes','transport:route-stops','transport:student-transport-allocation','transport:transport-fees','transport:transport-assignments','transport:vehicle-maintenance','transport:transport-history','transport:transport-reports',

])

const dashboardViews: Record<string, string> = {
  'institutional-overview': 'overview',
  'academic-overview': 'reports:academics',
  'financial-overview': 'finance:fees:overview',
  'attendance-overview': 'attendance:students',
  'student-performance': 'exam_results:published',
  'student-behaviour': 'operations:behaviour:register',
  'employee-performance': 'employees:reports',
  'statistics-and-kpi-cards': 'overview',
  'charts-and-comparative-analytics': 'reports:overview',
  'calendar-and-events': 'frontoffice:events',
  'notification-centre': 'notifications',
  'tasks-and-reminders': 'work_tasks:queue',
  'pending-approvals': 'governance:approvals',
  'recent-activities': 'governance:audit',
  'institutional-alerts': 'governance:audit',
  'my-profile':'personal:my-profile',
  'account-settings':'personal:account-settings',
  'notification-settings':'personal:notification-settings',
  'my-activity':'personal:my-activity',
  'help-support':'personal:help-support',
}
const studentViews: Record<string, string> = {
  'student-directory': 'directory',
  'new-admissions': 'admissions',
  'admission-applications': 'admissions',
  'student-profiles': 'profile',
  'student-id-cards': 'id-cards',
  'enrollment': 'admissions',
  'class-and-section-assignments': 'classes',
  'promotion-and-transfer': 'classes',
  'student-documentation': 'documents',
  'student-history': 'history',
  'alumni-records': 'history',
  'student-performance-charts': 'results',
  'student-reports': 'results',
  'student-data-export': 'directory',
  'bulk-student-operations': 'unavailable',
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
  'employee-id-cards': 'id-cards',
  'employee-history': 'history',
  'employee-performance': 'unavailable',
  'employee-attendance': 'attendance',
  'employee-leave-management': 'leave',
  'employee-reports': 'reports',
}

const attendanceViews: Record<string, string> = {
  'teacher-attendance': 'teachers',
  'staff-attendance': 'staff',
  'attendance-dashboard': 'students',
  'student-attendance': 'students',
  'daily-attendance': 'students',
  'period-wise-attendance': 'students',
  'class-wise-attendance': 'students',
  'bulk-student-attendance': 'students',
  'faculty-and-staff-attendance': 'staff',
  'bulk-staff-attendance': 'staff',
  'attendance-corrections': 'history',
  'leave-applications': 'leave',
  'late-arrival': 'history',
  'early-departure': 'staff',
  'attendance-calendar': 'history',
  'attendance-history': 'history',
  'automatic-attendance': 'devices',
  'attendance-devices': 'devices',
  'qr-barcode-check-in': 'qr-scan',
  'biometric-verification': 'biometric',
  'student-attendance-cards': 'cards-students',
  'teacher-attendance-cards': 'cards-teachers',
  'staff-attendance-cards': 'cards-staff',
}

const reportViews: Record<string, string> = {
  'reports-dashboard': 'overview',
  'student-reports': 'students',
  'employee-reports': 'employees',
  'attendance-reports': 'attendance',
  'examination-reports': 'examinations',
  'academic-reports': 'academic',
  'fee-reports': 'fees',
  'payroll-reports': 'payroll',
  'financial-reports': 'financial',
  'class-reports': 'class',
  'comparative-analytics': 'comparative',
  'custom-report-builder': 'builder',
  'scheduled-reports': 'scheduled',
  'report-templates': 'templates',
  'form-templates': 'forms',
  'report-history': 'history',
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
  'academic-structure-and-sections': 'academic',
  'department-directory': 'departments',
  'designation-catalogue': 'designations',
  'student-policies': 'policies-students',
  'faculty-policies': 'policies-faculty',
  'institution-settings': 'settings',
  'branding-and-document-settings': 'settings',
  'system-configuration': 'settings',
  'approval-and-workflows': 'approvals',
  'administrative-audit': 'audit',
  'institution-configuration': 'settings',
  'education-system-configuration': 'settings',
  'education-levels': 'academic',
  'grade-and-academic-level-configuration': 'academic',
  'academic-settings': 'academic',
  'general-system-settings': 'settings',
  'campus-settings': 'settings',
  'user-management': 'accounts',
  'invitations-and-access': 'accounts',
}

const institutionalOperationsItems: Record<string, Record<string,string>> = {
  'question-bank': {
    'question-bank-dashboard':'pool','multiple-choice-questions':'pool','short-questions':'pool',
    'long-questions':'pool','subject-wise-questions':'pool','chapter-wise-questions':'pool',
    'difficulty-levels':'pool','question-categories':'pool','question-builder':'pool',
    'question-paper-designer':'papers','paper-templates':'papers','marks-distribution':'papers','random-question-selection':'papers',
    'question-review':'pool','question-paper-download':'papers',
  },
  curriculum: {
    'curriculum-dashboard':'units','curriculum-map':'units','syllabus-management':'units',
    'learning-outcomes':'units','lesson-plans':'units','subject-wise-curriculum':'coverage','curriculum-reports':'coverage',
    'curriculum-coverage':'coverage',
  },
  behaviour: {
    'behaviour-dashboard':'register','behaviour-records':'register','positive-behaviour':'positive',
    'disciplinary-incidents':'register','rewards-and-recognition':'positive','warnings':'register',
  },
  certificates: {
    'certificate-dashboard':'verify','character-certificate':'issue','leaving-certificate':'issue',
    'enrollment-certificate':'issue','bonafide-certificate':'issue','achievement-certificate':'issue',
    'certificate-verification':'verify','certificate-history':'verify',
  },
  visitors: {
    'visitor-dashboard':'log','visitor-registration':'log','visitor-information':'log',
    'visitor-passes':'log','entry-and-exit-records':'checked-in','visit-history':'history',
  },
  facilities: {
    'facilities-dashboard':'assets','facility-maintenance':'maintenance','facility-history':'history',
  },
}

const administrationGovernanceItems: Record<string,string> = {
  'institute-profile':'profile',
  'academic-structure-sections':'academic',
  'department-directory':'departments',
  'designation-catalogue':'designations',
  'departments-designations':'departments',
  'student-policies':'policies-students',
  'faculty-policies':'policies-faculty',
  'organisational-structure':'organization',
  'system-configuration':'system',
  'approval-workflows':'approvals',
  'policies-rules':'policies',
  'administrative-audit':'audit',
  'user-access-invitations':'accounts',
  'role-permission-management':'permissions',
  'institute-settings':'settings',
  'branding-document-settings':'branding',
  'document-access':'files',
  'security-access-history':'security',
}
const institutionConfigurationItems: Record<string,string> = {
  'institution-configuration':'settings','education-system-configuration':'settings','education-levels':'academic',
  'grade-and-academic-level-configuration':'academic','institution-settings':'settings','campus-settings':'settings',
  'academic-settings':'academic','general-system-settings':'settings','invitations-and-access':'accounts',
  'user-management':'accounts','role-management':'accounts','user-permissions':'accounts','module-permissions':'accounts',
  'approval-permissions':'approvals','security-configuration':'audit',
}
function institutionOperationsRoute(groupKey:string,itemKey:string):string|undefined {
  const section=institutionalOperationsItems[groupKey]?.[itemKey]
  return section ? `operations:${groupKey}:${section}` : undefined
}

function dedicatedRoute(groupKey: string, itemKey: string): string | undefined {
  // Dedicated operational workspaces. Provider-dependent execution remains
  // visibly pending until its real integration is configured.
  if (groupKey === 'backup' && itemKey === 'duplicate-detection') return 'duplicate-detection:duplicate-detection'
  if (groupKey === 'communication' && itemKey === 'complaints-helpdesk') return 'helpdesk:complaints-helpdesk'
  if (groupKey === 'reports' && itemKey === 'scheduled-reports') return 'scheduled-reports:scheduled-reports'
  if (groupKey === 'facilities' && ['asset-assignment','asset-transfers','asset-warranty','asset-disposal','asset-reports'].includes(itemKey)) return 'asset-lifecycle:' + itemKey
  if (groupKey === 'payments' && ['online-payment-records','failed-and-pending-payments'].includes(itemKey)) return 'payment-operations:' + itemKey
  if (groupKey === 'fees' && itemKey === 'online-payments') return 'payment-operations:online-payment-records'
  if (groupKey === 'receipts' && ['receipt-templates','receipt-numbering','bulk-receipt-generation'].includes(itemKey)) return 'receipt-operations:' + itemKey
  if (groupKey === 'library' && ['reading-records','reading-cards','student-reading-history'].includes(itemKey)) return 'library-reading:' + itemKey
  if (groupKey === 'library' && ['library-dashboard','book-management','book-catalogue','book-categories','book-registration','book-issue-and-returns','digital-library','learning-materials','resource-downloads','library-reports'].includes(itemKey)) return institutionalRoute(groupKey,itemKey)
  if (groupKey === 'inventory' && ['inventory-dashboard','items-management','item-catalogue','item-categories','stock-in','stock-out','stock-allocation','stock-adjustments','inventory-history','stock-reports'].includes(itemKey)) return institutionalRoute(groupKey,itemKey)
  if (groupKey === 'transport' && ['transport-dashboard','vehicle-management','drivers-management','transport-routes','route-stops','student-transport-allocation','transport-fees','transport-assignments','vehicle-maintenance','transport-history','transport-reports'].includes(itemKey)) return institutionalRoute(groupKey,itemKey)
  if (groupKey === 'inventory') {
    const procurementPages = new Set(['suppliers','supplier-directory','purchase-records','purchase-requests','quotation-comparison','purchase-approvals','purchase-orders','goods-receipt','supplier-invoices','procurement-reports'])
    const cafeteriaPages = new Set(['cafeteria-dashboard','menu-price-list','daily-availability','sales-transactions','meal-plans','cafeteria-inventory','cafeteria-reports'])
    if (procurementPages.has(itemKey)) return 'procurement:' + (itemKey === 'suppliers' ? 'supplier-directory' : itemKey === 'purchase-records' ? 'purchase-orders' : itemKey)
    if (cafeteriaPages.has(itemKey)) return 'cafeteria:' + itemKey
  }
  if (groupKey === 'facilities') {
    const hostelPages = new Set(['hostel-dashboard','hostel-buildings','room-bed-register','resident-allocation','room-transfers','check-in-check-out','hostel-visitor-register','hostel-fees','accommodation-maintenance','occupancy-reports'])
    if (hostelPages.has(itemKey)) return 'hostel:' + itemKey
  }
  if (groupKey === 'communication' && ['whatsapp-integration','individual-messages','bulk-messages','class-wise-messaging','employee-notifications','message-templates','email-notifications','delivery-history','communication-logs','communication-reports','parent-communication','internal-messages'].includes(itemKey)) return 'messaging:' + itemKey
  if (groupKey === 'certificates') {
    if (['certificate-dashboard','character-certificate','leaving-certificate','enrollment-certificate','bonafide-certificate','achievement-certificate','experience-certificate'].includes(itemKey)) return 'operations:certificates:issue'
    if (itemKey === 'certificate-verification' || itemKey === 'document-verification') return 'operations:certificates:verify'
    if (['id-card-designer','certificate-templates','editable-document-templates'].includes(itemKey)) return 'operations:certificates:templates'
    if (itemKey === 'bulk-certificate-generation') return 'operations:certificates:bulk'
    if (itemKey === 'certificate-history') return 'operations:certificates:history'
    if (['form-builder','form-submissions','letters-applications'].includes(itemKey)) return 'certificate-forms:' + itemKey
  }
  if (groupKey === 'visitors') {
    const visitorPages:Record<string,string> = {'visitor-approvals':'approvals','visitor-notifications':'notifications','visitor-reports':'reports'}
    if (visitorPages[itemKey]) return itemKey === 'visitor-notifications' ? 'messaging:visitor-notifications' : 'operations:visitors:' + visitorPages[itemKey]
  }
  if (groupKey === 'facilities' && itemKey === 'room-reservations') return 'operations:facilities:reservations'
  if (groupKey === 'facilities' && itemKey === 'facilities-reports') return 'operations:facilities:reports'
  if (groupKey === 'communication') {
    const frontOfficeRoutes:Record<string,string>={
      'reception-enquiries':'frontoffice:enquiries',
      'circulars-notices':'frontoffice:announcements',
      'events-activities':'frontoffice:events',
      'sports-extracurricular-activities':'academic:classroom-activities',
    }
    if(frontOfficeRoutes[itemKey])return frontOfficeRoutes[itemKey]
    if(['sports-and-clubs','teams-and-members','coaches-and-supervisors','activity-schedules','participation-records','competitions-and-results','achievements','activity-reports'].includes(itemKey))return 'academic:classroom-activities'
    if(['parent-communication','internal-messages','complaints-helpdesk','whatsapp-integration','individual-messages','bulk-messages','class-wise-messaging','employee-notifications','message-templates','email-notifications','delivery-history','communication-logs','communication-reports'].includes(itemKey))return 'unavailable:communication:'+itemKey
  }
  if (groupKey === 'certificates') {
    if(['certificate-dashboard','character-certificate','leaving-certificate','enrollment-certificate','bonafide-certificate','achievement-certificate'].includes(itemKey))return 'operations:certificates:issue'
    if(itemKey==='certificate-verification'||itemKey==='document-verification')return 'operations:certificates:verify'
    if(itemKey==='document-records')return 'files'
    if(['form-builder','form-submissions','letters-applications','experience-certificate','id-card-designer','certificate-templates','editable-document-templates','bulk-certificate-generation','certificate-history'].includes(itemKey))return 'unavailable:certificates:'+itemKey
  }
  if (groupKey === 'facilities' && itemKey === 'asset-register') return 'operations:facilities:assets'
  if (groupKey === 'communication' && itemKey === 'reception-enquiries') return 'frontoffice:enquiries'
  if (groupKey === 'communication' && itemKey === 'circulars-notices') return 'frontoffice:announcements'
  if (groupKey === 'communication' && itemKey === 'events-activities') return 'frontoffice:events'
  if (groupKey === 'dashboard') return dashboardViews[itemKey] ?? 'unavailable:dashboard:' + itemKey
  if (groupKey === 'institution-config') {
    const section = institutionConfigurationItems[itemKey]
    return section ? 'governance:' + section : undefined
  }
  if (groupKey === 'administration' && administrationGovernanceItems[itemKey]) {
    return 'governance:' + administrationGovernanceItems[itemKey]
  }

  if (groupKey === 'students') {
    if (itemKey === 'bulk-student-operations') return 'unavailable:students:bulk-student-operations'
    const view = studentViews[itemKey]
    return view && view !== 'unavailable' ? `students:${view}` : undefined
  }
  if (groupKey === 'employees') {
    if (itemKey === 'employee-performance') return 'unavailable:employees:employee-performance'
    const view = employeeViews[itemKey]
    return view && view !== 'unavailable' ? `employees:${view}` : undefined
  }
  if (groupKey === 'attendance') {
    const careRoutes:Record<string,string> = {
      'leave-management':'care:leave-applications',
      'leave-applications':'care:leave-applications',
      'leave-review-approvals':'care:leave-approvals',
      'leave-balances':'care:leave-balances',
      'leave-reports':'care:leave-reports',
      'attendance-reports':'care:reports',
      'student-attendance-reports':'care:reports-students',
      'teacher-attendance-reports':'care:reports-teachers',
      'staff-attendance-reports':'care:reports-staff',
      'student-discipline':'care:discipline',
      'student-counselling-wellbeing':'care:counselling',
      'health-emergency-records':'care:health',
    }
    if (careRoutes[itemKey]) return careRoutes[itemKey]
    const view = attendanceViews[itemKey]
    return view ? `attendance:${view}` : undefined
  }
  if (groupKey === 'academic-sessions') {
    if (itemKey === 'session-wise-student-records') return 'students:directory'
    if (itemKey === 'session-wise-examination-records') return 'exams:calendar'
    if (itemKey === 'session-reports') return 'reports:academics'
    return 'admin:academic_sessions'
  }
  if (groupKey === 'classes-sections') {
    if (itemKey === 'student-class-assignment') return 'students:classes'
    if (itemKey === 'class-promotion-history' || itemKey === 'transfer-history' || itemKey === 'class-history') return 'students:history'
    if (itemKey === 'class-teachers') return 'employees:assignments'
    return 'admin:classes'
  }
  if (groupKey === 'subjects') {
    if (itemKey === 'subject-syllabus' || itemKey === 'subject-combinations') return 'operations:curriculum:units'
    if (itemKey === 'subject-performance' || itemKey === 'subject-wise-reports') return 'reports:academics'
    return 'admin:subjects'
  }
  if (groupKey === 'teaching') {
    if (['teaching-dashboard','homework','create-assignment','assignment-design-and-management','assignment-history','assignment-reports'].includes(itemKey)) {
      const view = itemKey === 'homework' ? 'open' : 'board'
      return 'assignments:' + view
    }
    if (itemKey === 'homework-calendar' || itemKey === 'pending-assignments') return 'assignments:upcoming'
    if (['student-submissions','teacher-review','pending-reviews','marks-and-feedback'].includes(itemKey)) {
      const view = itemKey === 'pending-reviews' ? 'awaiting' : itemKey === 'marks-and-feedback' ? 'graded' : 'inbox'
      return 'assignment_submissions:' + view
    }
    if (itemKey === 'teaching-materials' || itemKey === 'lesson-plans') return 'operations:curriculum:units'
    if (itemKey === 'downloadable-attachments') return 'files'
  }
  if (groupKey === 'examinations') {
    return 'institutional:examinations:' + itemKey
  }
  if (groupKey === 'class-tests') {
    const classTestViews:Record<string,string> = {
      'class-test-dashboard':'examination-programs',
      'create-class-tests':'online-tests-and-quizzes',
      'test-schedule':'examination-timetable',
      'online-tests':'online-tests-and-quizzes',
      'written-tests':'online-tests-and-quizzes',
      'test-questions':'question-bank',
      'marks-entry':'marks-entry',
      'test-results':'results-and-result-approval',
      'performance-analysis':'examination-reports',
      'test-reports':'examination-reports',
      'student-wise-test-history':'results-and-result-approval',
    }
    const view=classTestViews[itemKey]
    if (view) return 'institutional:examinations:' + view
    if (['marks-verification','result-processing','report-cards','merit-lists','result-publishing','result-corrections'].includes(itemKey)) {
      const resultView = ['report-cards','merit-lists','result-publishing'].includes(itemKey) ? 'published'
        : ['marks-verification','result-processing','result-corrections'].includes(itemKey) ? 'review' : 'all'
      return 'exam_results:' + resultView
    }
    return 'institutional:examinations:examination-programs'
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
    if (itemKey === 'class-timetable') return 'timetable:classes'
    if (itemKey === 'teacher-timetable') return 'timetable:teachers'
    if (itemKey === 'room-timetable') return 'timetable:rooms'
    if (['timetable-dashboard','master-timetable','period-timetable'].includes(itemKey)) return 'timetable:week'
    if (itemKey.includes('availability')) return 'timetable:teachers'
    if (itemKey.includes('substitution') || itemKey.includes('coverage')) return 'timetable:unassigned'
    if (itemKey.includes('conflict')) return 'timetable:conflicts'
    if (itemKey.includes('history')) return 'timetable:history'
    const day = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].find(value => itemKey.includes(value))
    return 'timetable:' + (day ?? 'week')
  }
  if (groupKey === 'communication') {
    if (itemKey === 'communication-dashboard' || itemKey === 'notification-centre') return 'notifications'
    if (itemKey.includes('assignment')) return 'announcements:staff'
    if (['whatsapp-integration','individual-messages','bulk-messages','class-wise-messaging','employee-notifications','message-templates','email-notifications','delivery-history','communication-logs','communication-reports'].includes(itemKey)) return institutionalRoute(groupKey,itemKey)
    return 'announcements:bulletin'
  }
  if (groupKey === 'reports') {
    if (['custom-report-builder','report-templates','report-history'].includes(itemKey)) return 'custom-reports:' + itemKey
    if (itemKey === 'scheduled-reports') return 'scheduled-reports:scheduled-reports'
    const view = reportViews[itemKey]
    return view ? `reports:${view}` : undefined
  }
  if (groupKey === 'administration') {
    if (itemKey === 'designations') return 'employees:designations'
    const adminKey = itemKey === 'academic-structure-and-sections' ? 'classes'
      : itemKey === 'departments' ? 'departments'
      : itemKey === 'system-configuration' || itemKey === 'academic-configuration' ? 'academic_sessions' : undefined
    return adminKey ? 'admin:' + adminKey : undefined
  }
  return undefined
}

/**
 * Resolve a destination in its menu-group context. This avoids collisions when
 * two groups contain the same display label and prevents silent routing into
 * the generic institutional_records CRUD screen.
 */
function resolveNavigationRoute(groupKey: string, itemLabel: string, role?: string): string {
  const itemKey = slug(itemLabel)
  const directDedicated = dedicatedRoute(groupKey,itemKey)
  const earlyDedicatedPrefixes = ['duplicate-detection:','helpdesk:','scheduled-reports:','asset-lifecycle:','payment-operations:','receipt-operations:','library-reading:','certificate-forms:','procurement:','cafeteria:','hostel:','messaging:','operations:certificates:','operations:visitors:','operations:facilities:']
  const linkedInstitutionalGroup = ['administration','library','inventory','transport','ai'].includes(groupKey) && Boolean(directDedicated?.startsWith('institutional:'))
  if (directDedicated && (earlyDedicatedPrefixes.some(prefix=>directDedicated.startsWith(prefix)) || linkedInstitutionalGroup)) return directDedicated
  if (groupKey === 'communication' && itemKey === 'internet-calling') return 'voice:native'
  if (groupKey === 'dashboard' && itemKey === 'dashboard') return 'overview'
  if (groupKey === 'people-hr') {
    const destinations: Record<string,string> = {
      'students':role==='student'||role==='parent'?'students:profile':'students:directory',
      'admissions-enrollment':'peoplehr:admissions',
      'teachers':role==='teacher'?'employees:profile':'employees:directory-teaching',
      'faculty-staff':'employees:directory-staff',
      'parents-guardians':'students:guardians',
      'hr-recruitment':'peoplehr:recruitment',
      'employee-contracts-documents':'peoplehr:contracts',
      'employee-performance':'peoplehr:performance',
      'payroll-salary-records':'payroll:overview',
      'alumni':'peoplehr:alumni',
    }
    return destinations[itemKey] ?? 'unavailable:people-hr:' + itemKey
  }
  const compositeKey = `${groupKey}:${itemKey}`
  const actorRole = role ?? 'owner'
  if (groupKey === 'class-tests') {
    const classTestViews:Record<string,string> = {
      'class-test-dashboard':'examination-programs',
      'create-class-tests':'online-tests-and-quizzes',
      'test-schedule':'examination-timetable',
      'online-tests':'online-tests-and-quizzes',
      'written-tests':'online-tests-and-quizzes',
      'marks-entry':'marks-entry',
      'test-results':'results-and-result-approval',
      'performance-analysis':'examination-reports',
      'test-reports':'examination-reports',
      'student-wise-test-history':'results-and-result-approval',
    }
    if (itemKey === 'test-questions') return 'operations:question-bank:pool'
    if (classTestViews[itemKey]) return 'institutional:examinations:' + classTestViews[itemKey]
  }
  const transportAttendanceRoutePrefix = 'transport-attendance:'
  if (groupKey === 'transport' && itemKey === 'transport-attendance') return ['owner','admin','teacher'].includes(actorRole) ? transportAttendanceRoutePrefix + 'transport-attendance' : 'unavailable:transport:transport-attendance'
  if (groupKey === 'integrations') {
    const views:Record<string,string> = {
      'integration-overview':'overview',
      'ai-provider-connections':'ai-providers',
      'biometric-attendance-devices':'biometric',
    }
    return 'integration:' + (views[itemKey] ?? 'overview')
  }
  if (groupKey === 'behaviour') {
    const views:Record<string,string> = {
      'behaviour-dashboard':'dashboard',
      'behaviour-records':'records',
      'positive-behaviour':'positive',
      'disciplinary-incidents':'incidents',
      'rewards-and-recognition':'recognition',
      'warnings':'warnings',
      'student-skills':'skills',
      'co-curricular-activities':'activities',
      'competency-tracking':'competencies',
      'student-progress-history':'progress',
      'behaviour-analytics':'analytics',
      'downloadable-behaviour-reports':'downloads',
    }
    return 'behaviour:' + (views[itemKey] ?? 'dashboard')
  }
  if (groupKey === 'academic-management') {
    const academicWindows: Record<string,string> = {
      'academic-sessions':'academic-sessions',
      'classes-sections':'classes-sections',
      'subjects':'subjects-courses',
      'curriculum':'curriculum',
      'lesson-plans':'lesson-planning',
      'timetable':'timetable',
      'homework':'homework-assignments',
      'learning-materials':'study-materials',
      'online-learning':'online-learning',
      'live-online-classes':'live-online-classes',
      'classroom-activities':'classroom-activities',
      'academic-calendar':'academic-calendar',
      'learning-progress':'learning-progress',
    }
    return 'academic:' + (academicWindows[itemKey] ?? 'academic-sessions')
  }
  if (groupKey === 'ai') {
    const intelligenceRoutes: Record<string, string> = {
      'ai-assistant': 'assistant:chat',
      'smart-reports': 'assistant:smart-reports',
      'student-performance-prediction': 'assistant:student-performance-prediction',
      'student-analysis': 'assistant:student-analysis',
      'fee-collection-prediction': 'assistant:fee-collection-prediction',
      'examination-analysis': 'assistant:examination-analysis',
      'ai-timetable-suggestions': 'assistant:ai-timetable-suggestions',
      'ai-question-generation': 'assistant:ai-question-generation',
      'ai-document-assistant': 'assistant:ai-document-assistant',
      'ai-learning-recommendations': 'assistant:ai-learning-recommendations',
      'academic-performance-insights': 'assistant:academic-performance-insights',
      'attendance-and-behaviour-insights': 'assistant:attendance-and-behaviour-insights',
      'institutional-intelligence': 'assistant:institutional-intelligence',
    }
    return intelligenceRoutes[itemKey] ?? 'unavailable:ai:' + itemKey
  }
  if (groupKey === 'backup' && itemKey === 'integration-status') return 'integration:overview'
  if (groupKey === 'backup') return 'data-management:' + itemKey
  if (groupKey === 'timetable' && ['teacher-availability','substitution-management','timetable-publishing','class-coverage','engaged-classes'].includes(itemKey)) return 'unavailable:timetable:'+itemKey
  if (groupKey === 'students' && itemKey === 'student-data-export' && role && !['owner','admin'].includes(role)) {
    return 'unavailable:students:student-data-export'
  }
  if (groupKey === 'students' && itemKey === 'student-data-export') return 'students:directory'
  if(groupKey==='attendance'){
    const stage7Routes:Record<string,string>={
      'student-attendance':'attendance:students',
      'teacher-attendance':'attendance:teachers',
      'staff-attendance':'attendance:staff',
      'leave-management':'care:leave',
      'attendance-reports':'care:reports',
      'student-attendance-reports':'care:reports-students',
      'teacher-attendance-reports':'care:reports-teachers',
      'staff-attendance-reports':'care:reports-staff',
      'student-discipline':'care:discipline',
      'student-counselling-wellbeing':'care:counselling',
      'health-emergency-records':'care:health',
    }
    if(stage7Routes[itemKey])return stage7Routes[itemKey]
  }
  if (groupKey === 'attendance' && itemKey === 'attendance-analytics') return 'reports:attendance'
  if (groupKey === 'attendance' && itemKey === 'attendance-alerts') return 'unavailable:attendance:attendance-alerts'
  if (groupKey === 'certificates' && itemKey === 'form-builder') return 'reports:forms'
  if (groupKey === 'certificates' && itemKey === 'form-submissions') return 'reports:forms'
  if (groupKey === 'administration' && itemKey === 'document-access') return 'files'
  if (groupKey === 'question-bank' && itemKey === 'question-bank-import-and-export') return 'operations:question-bank:pool'
  if (groupKey === 'question-bank' && itemKey === 'question-paper-version-history') return 'operations:question-bank:papers'
  if (groupKey === 'curriculum' && ['teaching-resources','learning-materials','resource-downloads','chapter-wise-learning-resources','learning-progress-tracking'].includes(itemKey)) return 'unavailable:curriculum:'+itemKey
  if (groupKey === 'behaviour') {
    const behaviourWindows:Record<string,string>={'behaviour-dashboard':'dashboard','behaviour-records':'register','positive-behaviour':'positive','disciplinary-incidents':'incidents','rewards-and-recognition':'recognition','warnings':'warnings','student-skills':'skills','co-curricular-activities':'activities','competency-tracking':'competencies','student-progress-history':'progress','behaviour-analytics':'analytics','downloadable-behaviour-reports':'downloads'}
    const view=behaviourWindows[itemKey]
    return view? 'operations:behaviour:'+view:'unavailable:behaviour:'+itemKey
  }
  if (groupKey === 'certificates' && ['experience-certificate','id-card-designer','certificate-templates','editable-document-templates','bulk-certificate-generation'].includes(itemKey)) return 'unavailable:certificates:'+itemKey
  if (groupKey === 'library' && ['reading-records','reading-cards','student-reading-history'].includes(itemKey)) return 'unavailable:library:'+itemKey
  if (groupKey === 'transport' && itemKey === 'transport-attendance') return 'unavailable:transport:transport-attendance'
  if (groupKey === 'facilities' && ['room-reservations','facilities-reports'].includes(itemKey)) return 'unavailable:facilities:'+itemKey
  if (groupKey === 'visitors' && ['visitor-approvals','visitor-notifications','visitor-reports'].includes(itemKey)) return 'unavailable:visitors:'+itemKey
  if (groupKey === 'examinations' && ['invigilation-management','automatic-checking'].includes(itemKey)) return 'unavailable:examinations:'+itemKey
  if (groupKey === 'examinations' && ['examination-programs','examination-timetable','question-bank','online-tests-and-quizzes','marks-entry','grades-and-grading-system','results-and-result-approval','report-cards','examination-reports'].includes(itemKey)) return 'institutional:examinations:' + itemKey
  if (groupKey === 'examinations' && itemKey === 'examination-rooms') return 'admin:rooms'
  if (groupKey === 'class-tests' && itemKey === 'test-questions') return 'operations:question-bank:pool'
  if (groupKey === 'class-tests' && ['online-tests','written-tests'].includes(itemKey)) return 'institutional:examinations:online-tests-and-quizzes'
  if (groupKey === 'fees' && itemKey === 'online-payments') return 'unavailable:fees:online-payments'
  if (groupKey === 'payments' && itemKey === 'online-payment-records') return 'unavailable:payments:online-payment-records'
  if (groupKey === 'receipts' && ['receipt-templates','receipt-numbering','bulk-receipt-generation'].includes(itemKey)) return 'unavailable:receipts:'+itemKey
  if (groupKey === 'inventory' && itemKey === 'inventory-dashboard') return 'institutional:inventory:stock-reports'
  if (groupKey === 'library' && itemKey === 'library-dashboard') return 'institutional:library:library-reports'
  if (groupKey === 'transport' && (itemKey === 'transport-dashboard' || itemKey === 'transport-fees' || itemKey === 'transport-history')) return 'institutional:transport:transport-reports'
  if (groupKey === 'facilities' && itemKey === 'facilities-dashboard') return 'operations:facilities:assets'
  if (groupKey === 'reports' && itemKey === 'comparative-analytics') return 'reports:overview'
  if (groupKey === 'dashboard') {
    if (itemKey === 'employee-performance') return 'unavailable:dashboard:employee-performance'
    if (itemKey === 'student-behaviour') {
      return ['owner','admin','teacher'].includes(actorRole)
        ? 'operations:behaviour:register'
        : 'unavailable:dashboard:student-behaviour'
    }
    if (['recent-activities','institutional-alerts'].includes(itemKey) && !['owner','admin'].includes(actorRole)) {
      return 'unavailable:dashboard:' + itemKey
    }
    if (itemKey === 'financial-overview' && !['owner','admin','accountant','student','parent'].includes(actorRole)) {
      return 'unavailable:dashboard:financial-overview'
    }
    if (itemKey === 'attendance-overview' && actorRole === 'accountant') return 'unavailable:dashboard:attendance-overview'
    if (itemKey === 'student-performance' && actorRole === 'accountant') return 'unavailable:dashboard:student-performance'
    if (itemKey === 'tasks-and-reminders' && ['student','parent'].includes(actorRole)) return 'unavailable:dashboard:tasks-and-reminders'
    if (itemKey === 'academic-overview' && ['student','parent'].includes(actorRole)) return 'exams:calendar'
  }

  // Resolve dashboard shortcuts before legacy module-root overrides so the
  // requested report/finance/result sub-view is not lost.
  if (groupKey === 'dashboard') {
    return dashboardViews[itemKey] ?? 'unavailable:dashboard:' + itemKey
  }

  // Preserve the actual requested timetable window before any legacy
  // module-root override can collapse class/teacher/room views into "week".
  if (groupKey === 'timetable') {
    if (itemKey === 'class-timetable') return 'timetable:classes'
    if (itemKey === 'teacher-timetable') return 'timetable:teachers'
    if (itemKey === 'room-timetable') return 'timetable:rooms'
    if (itemKey === 'timetable-conflicts') return 'timetable:conflicts'
    if (itemKey === 'timetable-history') return 'timetable:history'
    const day = ['monday','tuesday','wednesday','thursday','friday','saturday'].find(value => itemKey.includes(value))
    return 'timetable:' + (day ?? 'week')
  }

  const override = existingRouteOverrides[compositeKey]

  const financeDestination = financeRoute(groupKey,itemKey)
  if (financeDestination) return financeDestination
  if(groupKey==='facilities'&&['classroom-management','laboratories','library-rooms','room-allocation','room-availability'].includes(itemKey)) return 'admin:rooms'
  const operationsDestination=institutionOperationsRoute(groupKey,itemKey)
  if (operationsDestination) return operationsDestination
  if (groupKey === 'payroll') return payrollRoute(itemKey)
  if (groupKey === 'administration' && governanceRoutes[itemKey] && itemKey !== 'campus-and-branch-management') {
    return `governance:${governanceRoutes[itemKey]}`
  }
  if (groupKey === 'institution-config' && governanceRoutes[itemKey]) return `governance:${governanceRoutes[itemKey]}`

  // A few older shortcuts pointed at a module root, losing the requested
  // report/employee/coursework sub-view. Prefer the typed sub-view in those groups.
  if (['reports', 'teaching', 'employees', 'attendance', 'examinations', 'class-tests', 'communication'].includes(groupKey)) {
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
  return 'unavailable:' + groupKey + ':' + itemKey
}

/**
 * All visible institution-owned menu destinations resolve to a dedicated
 * workspace or to a typed, institution-scoped record register. This fallback
 * never creates a new sidebar item and never bypasses role/RLS enforcement.
 */
export function getNavigationRoute(groupKey: string, itemLabel: string, role?: string): string {
  const route = resolveNavigationRoute(groupKey,itemLabel,role)
  if (!route.startsWith('unavailable:')) return route
  const explicitlyUnavailable = new Set([
    'attendance:attendance-alerts','timetable:substitution-management','timetable:timetable-publishing',
    'examinations:automatic-checking','examinations:invigilation-management','transport:transport-attendance',
  ])
  if (explicitlyUnavailable.has(groupKey + ':' + slug(itemLabel))) return route
  const group = getWorkspaceGroup(groupKey)
  const item = getWorkspaceItem(groupKey,slug(itemLabel))
  const actorRole = role ?? 'owner'
  if (!group || !item || !group.dataModule || !group.roles.includes(actorRole as typeof group.roles[number])) return route
  const visibleGroup = roleNavigationGroups(actorRole as Parameters<typeof roleNavigationGroups>[0]).find(candidate=>candidate.key===groupKey)
  if (!visibleGroup?.items.includes(item.label)) return route
  return institutionalRoute(groupKey,item.key)
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
