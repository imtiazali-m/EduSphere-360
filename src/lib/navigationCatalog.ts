import type { WorkspaceMenuGroup } from './institutionalCatalog'
import { institutionalMenu } from './institutionalCatalog'

export interface NavigationCatalogGroup { key:string; label:string; icon:string; items:string[]; description?:string; theme?:string }

export const navigationCatalog:NavigationCatalogGroup[]=institutionalMenu.map(group=>({
  key:group.key,label:group.label,icon:group.icon,description:group.description,theme:group.theme,
  items:group.items.map(item=>item.label),
}))

const roleItemAllow:Record<string,Partial<Record<string,string[]>>>={
  'academic-management': {
    student:['Academic Sessions','Classes & Sections','Subjects & Courses','Curriculum & Syllabus','Lesson Planning','Timetable','Homework & Assignments','Study Materials','Online Learning','Classwork & Classroom Activities','Academic Calendar','Learning Progress'],
    parent:['Academic Sessions','Classes & Sections','Subjects & Courses','Curriculum & Syllabus','Lesson Planning','Timetable','Homework & Assignments','Study Materials','Online Learning','Classwork & Classroom Activities','Academic Calendar','Learning Progress'],
    teacher:['Academic Sessions','Classes & Sections','Subjects & Courses','Curriculum & Syllabus','Lesson Planning','Timetable','Homework & Assignments','Study Materials','Online Learning','Classwork & Classroom Activities','Academic Calendar','Learning Progress'],
    exam_officer:['Academic Sessions','Classes & Sections','Subjects & Courses','Timetable','Academic Calendar','Learning Progress'],
  },
  students:{
    student:['Student Profiles','Class and Section Assignments','Student ID Cards','Student Performance Charts','Student Reports'],
    parent:['Student Profiles','Class and Section Assignments','Student ID Cards','Student Performance Charts','Student Reports'],
    teacher:['Student Directory','Student Profiles','Class and Section Assignments','Student History','Student Performance Charts','Student Reports'],
  },
  employees:{
    teacher:['Employee Profiles','Employee Attendance','Employee Leave Management'],
  },
  fees:{
    student:['Fees Dashboard','Fee Invoices','Fee Receipts'],
    parent:['Fees Dashboard','Fee Invoices','Payment Collection','Fee Receipts','Outstanding Dues'],
  },
  attendance:{
    student:['Attendance Dashboard','Student Attendance','Daily Attendance','Period-wise Attendance','Attendance Calendar','Attendance History','Attendance Reports'],
    parent:['Attendance Dashboard','Student Attendance','Daily Attendance','Attendance Calendar','Attendance History','Attendance Reports'],
  },
  timetable:{
    student:['Timetable Dashboard','Class Timetable','Period Timetable','Timetable History'],
    parent:['Timetable Dashboard','Class Timetable','Period Timetable','Timetable History'],
    teacher:['Timetable Dashboard','Master Timetable','Class Timetable','Teacher Timetable','Period Timetable','Teacher Availability','Substitution Management','Timetable History','Class Coverage','Engaged Classes'],
  },
  teaching:{
    student:['Teaching Dashboard','Homework','Student Submissions','Marks and Feedback','Teaching Materials','Homework Calendar','Pending Assignments','Assignment History','Downloadable Attachments'],
    parent:['Teaching Dashboard','Homework','Marks and Feedback','Homework Calendar','Pending Assignments','Assignment History','Downloadable Attachments'],
    teacher:['Teaching Dashboard','Homework','Create Assignment','Assignment Design and Management','Student Submissions','Teacher Review','Marks and Feedback','Teaching Materials','Lesson Plans','Homework Calendar','Pending Assignments','Pending Reviews','Assignment History','Assignment Reports','Downloadable Attachments'],
  },
  behaviour:{
    student:['Behaviour Dashboard','Positive Behaviour','Rewards and Recognition','Student Skills','Co-curricular Activities','Competency Tracking','Student Progress History'],
    parent:['Behaviour Dashboard','Positive Behaviour','Rewards and Recognition','Student Skills','Co-curricular Activities','Student Progress History'],
  },
  library:{
    student:['Library Dashboard','Digital Library','Book Catalogue','Book Categories','Reading Records','Reading Cards','Student Reading History','Book Issue and Returns','Learning Materials','Resource Downloads','Library Reports'],
    parent:['Library Dashboard','Digital Library','Book Catalogue','Reading Records','Student Reading History','Book Issue and Returns','Library Reports'],
    teacher:['Library Dashboard','Digital Library','Book Catalogue','Book Categories','Reading Records','Book Issue and Returns','Learning Materials','Resource Downloads','Library Reports'],
  },
  transport:{
    student:['Transport Dashboard','Student Transport Allocation','Transport Attendance','Transport History'],
    parent:['Transport Dashboard','Student Transport Allocation','Transport Fees','Transport Attendance','Transport History'],
    teacher:['Transport Dashboard','Transport Routes','Route Stops','Transport Attendance','Transport History'],
    accountant:['Transport Dashboard','Transport Fees','Transport Reports'],
  },
  reports:{
    teacher:['Reports Dashboard','Student Reports','Attendance Reports','Examination Reports','Academic Reports','Class Reports','Comparative Analytics','Report Templates','Report History'],
    accountant:['Reports Dashboard','Fee Reports','Payroll Reports','Financial Reports','Comparative Analytics','Report Templates','Report History'],
    exam_officer:['Reports Dashboard','Examination Reports','Academic Reports','Class Reports','Comparative Analytics','Report Templates','Report History'],
  }
}

function allowedItems(group:WorkspaceMenuGroup,role:WorkspaceMenuGroup['roles'][number]){
  const selected=roleItemAllow[group.key]?.[role]
  const roleFiltered = selected ? group.items.filter(item=>selected.includes(item.label)) : group.items
  if (group.key === 'dashboard') {
    const hidden: Partial<Record<WorkspaceMenuGroup['roles'][number], string[]>> = {
      teacher: ['Financial Overview', 'Institutional Alerts'],
      student: ['Employee Performance', 'Student Behaviour', 'Institutional Alerts', 'Pending Approvals', 'Tasks and Reminders'],
      parent: ['Employee Performance', 'Student Behaviour', 'Institutional Alerts', 'Pending Approvals', 'Tasks and Reminders'],
      accountant: ['Attendance Overview', 'Student Behaviour', 'Employee Performance', 'Institutional Alerts', 'Pending Approvals'],
      exam_officer: ['Financial Overview', 'Employee Performance', 'Institutional Alerts', 'Pending Approvals'],
    }
    const excluded = new Set(hidden[role] ?? [])
    return roleFiltered.filter(item => !excluded.has(item.label))
  }
  return roleFiltered
}

export interface NavigationSectionDefinition { key:string; label:string; groupKeys:string[] }
export type RoleNavigationGroup = Omit<WorkspaceMenuGroup,'items'> & { items:string[] }
export interface RoleNavigationSection { key:string; label:string; groups:RoleNavigationGroup[] }

export const navigationSectionDefinitions:NavigationSectionDefinition[]=[
  {key:'overview',label:'Overview',groupKeys:['dashboard']},
  {key:'setup',label:'Institute Setup',groupKeys:['administration','institution-config','academic-sessions','classes-sections','subjects','backup']},
  {key:'people',label:'People & Admissions',groupKeys:['students','employees','attendance','behaviour','certificates']},
  {key:'academics',label:'Academic Delivery',groupKeys:['academic-management','question-bank','examinations','class-tests','library']},
  {key:'finance',label:'Finance & Payroll',groupKeys:['accounts-finance','fees','receivables','payments','receipts','payroll','reconciliation']},
  {key:'communication',label:'Communication',groupKeys:['communication']},
  {key:'campus',label:'Campus Operations',groupKeys:['transport','inventory','facilities','visitors']},
  {key:'intelligence',label:'Reports & Intelligence',groupKeys:['reports','ai']},
]
const navigationGroupOrder=new Map<string,number>(
  navigationSectionDefinitions.flatMap(section=>section.groupKeys).map((key,index)=>[key,index] as const)
)

export function roleNavigationGroups(role:WorkspaceMenuGroup['roles'][number]):RoleNavigationGroup[]{
  return institutionalMenu
    .filter(group=>group.roles.includes(role) && !['academic-sessions','classes-sections','subjects','curriculum','timetable','teaching'].includes(group.key))
    .map(group=>({...group,items:allowedItems(group,role).map(item=>item.label)}))
    .filter(group=>group.key==='dashboard'||group.items.length>0)
    .sort((left,right)=>(navigationGroupOrder.get(left.key)??Number.MAX_SAFE_INTEGER)-(navigationGroupOrder.get(right.key)??Number.MAX_SAFE_INTEGER))
}

export function roleNavigationSections(role:WorkspaceMenuGroup['roles'][number]):RoleNavigationSection[]{
  const groups=roleNavigationGroups(role)
  const groupByKey=new Map<string,RoleNavigationGroup>(groups.map(group=>[group.key,group] as const))
  const sections=navigationSectionDefinitions.flatMap(section=>{
    const sectionGroups=section.groupKeys.flatMap(key=>{
      const group=groupByKey.get(key)
      return group?[group]:[]
    })
    return sectionGroups.length?[{key:section.key,label:section.label,groups:sectionGroups}]:[]
  })
  const assigned=new Set(navigationSectionDefinitions.flatMap(section=>section.groupKeys))
  const remaining=groups.filter(group=>!assigned.has(group.key))
  return remaining.length?[...sections,{key:'other',label:'Other Workspaces',groups:remaining}]:sections
}
