import type { WorkspaceMenuGroup } from './institutionalCatalog'
import { institutionalMenu } from './institutionalCatalog'

export interface NavigationCatalogGroup { key:string; label:string; icon:string; items:string[]; description?:string; theme?:string }

export const navigationCatalog:NavigationCatalogGroup[]=institutionalMenu.map(group=>({
  key:group.key,label:group.label,icon:group.icon,description:group.description,theme:group.theme,
  items:group.items.map(item=>item.label),
}))

const roleItemAllow:Record<string,Partial<Record<string,string[]>>>={
  students:{
    student:['Student Directory','Student Profiles','Enrollment','Class and Section Assignments','Student ID Cards','Student Performance Charts','Student Reports','Student Data Export'],
    parent:['Student Profiles','Class and Section Assignments','Student ID Cards','Student Performance Charts','Student Reports'],
    teacher:['Student Directory','Student Profiles','Class and Section Assignments','Student Documentation','Student History','Student Performance Charts','Student Reports'],
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
  return selected ? group.items.filter(item=>selected.includes(item.label)) : group.items
}

export function roleNavigationGroups(role:WorkspaceMenuGroup['roles'][number]){
  return institutionalMenu
    .filter(group=>group.roles.includes(role))
    .map(group=>({...group,items:allowedItems(group,role).map(item=>item.label)}))
    .filter(group=>group.key==='dashboard'||group.items.length>0)
}
