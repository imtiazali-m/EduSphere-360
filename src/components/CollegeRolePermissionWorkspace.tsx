import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { BadgeCheck, BookOpen, CircleAlert, Edit3, LockKeyhole, Plus, RefreshCw, Save, ShieldCheck, UserPlus, Users, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { userFacingError } from '../lib/userErrors'
import '../styles/college-role-permissions.css'

type BaseRole = 'admin' | 'teacher' | 'student' | 'parent' | 'accountant' | 'exam_officer'
type Member = { user_id: string; role: string; status: string; full_name?: string; email?: string }
type RoleProfile = {
  id: string
  institution_id: string
  role_key: string
  name: string
  base_role: BaseRole
  description: string
  module_permissions: Record<string, string[]>
  is_active: boolean
  created_at: string
  updated_at: string
}
type RoleAssignment = {
  id: string
  institution_id: string
  user_id: string
  role_profile_id: string
  campus_id: string | null
  department_id: string | null
  status: 'active' | 'suspended' | 'ended'
  starts_at: string
  ends_at: string | null
}
type NamedRow = { id: string; name: string; campus_id?: string | null }

const baseRoleOptions: { value: BaseRole; label: string }[] = [
  { value: 'admin', label: 'Administrator (management-level ceiling)' },
  { value: 'teacher', label: 'Faculty / teacher' },
  { value: 'accountant', label: 'Accounts / finance' },
  { value: 'exam_officer', label: 'Examination officer' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent / guardian' },
]

const actionLabels: Record<string,string> = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete',
  approve: 'Approve', publish: 'Publish',
}

const modules = [
  { key: 'students', label: 'Student records', actions: ['view','create','edit','delete'] },
  { key: 'employees', label: 'Faculty & employee records', actions: ['view','create','edit','delete'] },
  { key: 'departments', label: 'Departments & designations', actions: ['view','create','edit','delete'] },
  { key: 'programs', label: 'Academic programmes', actions: ['view','create','edit','delete'] },
  { key: 'subjects', label: 'Subjects & curriculum', actions: ['view','create','edit','delete'] },
  { key: 'attendance', label: 'Student attendance', actions: ['view','create','edit','delete'] },
  { key: 'employee_attendance', label: 'Employee attendance', actions: ['view','create','edit','delete'] },
  { key: 'assignments', label: 'Assignments & submissions', actions: ['view','create','edit','delete'] },
  { key: 'examinations', label: 'Examinations & results', actions: ['view','create','edit','delete','approve','publish'] },
  { key: 'fees', label: 'Fees & payments', actions: ['view','create','edit','delete'] },
  { key: 'hr', label: 'HR, contracts & leave', actions: ['view','create','edit','delete'] },
  { key: 'payroll', label: 'Payroll records', actions: ['view','create','edit','delete','approve'] },
  { key: 'library', label: 'Library circulation', actions: ['view','create','edit','delete'] },
  { key: 'certificates', label: 'Certificates', actions: ['view','create','edit','delete'] },
  { key: 'visitors', label: 'Visitors & reception', actions: ['view','create','edit','delete'] },
  { key: 'approvals', label: 'Approval requests', actions: ['view','create','edit','approve'] },
  { key: 'work_tasks', label: 'Administrative tasks', actions: ['view','create','edit','delete'] },
  { key: 'announcements', label: 'Notices & announcements', actions: ['view','create','edit','delete'] },
  { key: 'campuses', label: 'Campus records', actions: ['view','create','edit','delete'] },
  { key: 'settings', label: 'Institution settings', actions: ['view','edit'] },
  { key: 'administration', label: 'Administration records', actions: ['view','create','edit','delete'] },
  { key: 'academic_setup', label: 'Academic setup records', actions: ['view','create','edit','delete'] },
  { key: 'admissions', label: 'Admissions records', actions: ['view','create','edit','delete'] },
  { key: 'behaviour', label: 'Student behaviour records', actions: ['view','create','edit','delete'] },
  { key: 'transport', label: 'Transport operations', actions: ['view','create','edit','delete'] },
  { key: 'inventory', label: 'Inventory operations', actions: ['view','create','edit','delete'] },
  { key: 'facilities', label: 'Facilities operations', actions: ['view','create','edit','delete'] },
  { key: 'hostel', label: 'Hostel & residence operations', actions: ['view','create','edit','delete','approve'] },
  { key: 'procurement', label: 'Procurement & suppliers', actions: ['view','create','edit','delete','approve'] },
  { key: 'cafeteria', label: 'Cafeteria & meal services', actions: ['view','create','edit','delete'] },
  { key: 'reports', label: 'Reports & scheduled execution', actions: ['view','create','edit','delete'] },
  { key: 'data_management', label: 'Data management & duplicate review', actions: ['view','create','edit','delete','approve'] },
  { key: 'helpdesk', label: 'Helpdesk & support tickets', actions: ['view','create','edit','delete','approve'] },
  { key: 'forms', label: 'Dynamic forms & submissions', actions: ['view','create','edit','delete','approve'] },
  { key: 'communications', label: 'Internal college messaging', actions: ['view','create','edit','delete'] },
  { key: 'ai', label: 'AI and analytics records', actions: ['view','create','edit','delete'] },
  { key: 'institutional_records', label: 'Other institutional records', actions: ['view','create','edit','delete'] },
]

const templates: { name: string; base_role: BaseRole; description: string; permissions: Record<string,string[]> }[] = [
  { name:'Principal / Head of College', base_role:'admin', description:'College-wide operational leadership. Ownership and platform security remain with the institution owner.', permissions:{
    students:['view','create','edit','delete'],employees:['view','create','edit'],administration:['view','create','edit'],academic_setup:['view','create','edit'],admissions:['view','create','edit'],departments:['view','create','edit'],programs:['view','create','edit'],subjects:['view','create','edit'],attendance:['view','create','edit'],employee_attendance:['view','create','edit'],assignments:['view','create','edit'],examinations:['view','create','edit','approve','publish'],fees:['view','create','edit'],hr:['view'],payroll:['view','approve'],library:['view'],certificates:['view','create'],visitors:['view'],approvals:['view','create','approve'],work_tasks:['view','create','edit'],announcements:['view','create','edit'],campuses:['view'],settings:['view'],facilities:['view','create','edit'],hostel:['view','create','edit','approve'],procurement:['view','create','edit','approve'],cafeteria:['view','create','edit'],reports:['view','create','edit'],data_management:['view','create','edit','approve'],helpdesk:['view','create','edit','approve'],forms:['view','create','edit','approve'],communications:['view','create','edit']
  }},
  { name:'Vice Principal', base_role:'admin', description:'Delegated campus leadership across student, staff and academic operations.', permissions:{
    students:['view','create','edit'],employees:['view'],administration:['view','edit'],academic_setup:['view','edit'],departments:['view'],programs:['view'],subjects:['view'],attendance:['view','create','edit'],employee_attendance:['view'],assignments:['view','edit'],examinations:['view','create','edit'],fees:['view'],approvals:['view'],work_tasks:['view','create','edit'],announcements:['view','create','edit'],campuses:['view'],communications:['view','create']
  }},
  { name:'Head of Department (HOD)', base_role:'teacher', description:'Department-scoped oversight of assigned faculty, classes, academic work and student progress.', permissions:{
    students:['view'],employees:['view'],academic_setup:['view','edit','create'],departments:['view'],programs:['view'],subjects:['view'],attendance:['view'],employee_attendance:['view'],assignments:['view','create','edit'],examinations:['view','create','edit'],announcements:['view'],communications:['view','create']
  }},
  { name:'Registrar', base_role:'admin', description:'Student registration, enrolment, academic records and official documentation.', permissions:{
    students:['view','create','edit'],admissions:['view','create','edit'],administration:['view'],academic_setup:['view'],departments:['view'],programs:['view'],subjects:['view'],attendance:['view'],examinations:['view'],certificates:['view','create','edit'],institutional_records:['view','create','edit'],forms:['view','create','edit'],announcements:['view'],communications:['view','create']
  }},
  { name:'Admissions Officer', base_role:'admin', description:'Admission enquiries, applicant records, document checks and enrolment workflows.', permissions:{
    students:['view','create','edit'],admissions:['view','create','edit'],academic_setup:['view'],departments:['view'],programs:['view'],subjects:['view'],institutional_records:['view','create','edit'],announcements:['view'],communications:['view','create']
  }},
  { name:'Examination Controller', base_role:'exam_officer', description:'Exam programmes, schedules, moderation, result approval and controlled publication.', permissions:{
    students:['view'],academic_setup:['view'],departments:['view'],programs:['view'],subjects:['view'],assignments:['view'],examinations:['view','create','edit','approve','publish'],approvals:['view','approve'],announcements:['view']
  }},
  { name:'Examination Officer', base_role:'exam_officer', description:'Examination schedules, paper administration and result preparation; approval and publication remain separate.', permissions:{
    students:['view'],departments:['view'],programs:['view'],subjects:['view'],examinations:['view','create','edit'],announcements:['view']
  }},
  { name:'Invigilator', base_role:'teacher', description:'Assigned examination-day duties and attendance recording, without access to result approval.', permissions:{
    students:['view'],attendance:['view','create','edit'],examinations:['view'],announcements:['view']
  }},
  { name:'Accounts Officer', base_role:'accountant', description:'Fee invoices, payments, receipts and financial records in the authorised campus scope.', permissions:{
    students:['view'],fees:['view','create','edit'],payroll:['view','create'],transport:['view','create'],hostel:['view','create'],procurement:['view'],reports:['view'],communications:['view','create'],announcements:['view']
  }},
  { name:'Cashier', base_role:'accountant', description:'Receive and record payments. Cannot change fee structures or delete financial records.', permissions:{
    students:['view'],fees:['view','create'],hostel:['view','create'],communications:['view'],announcements:['view']
  }},
  { name:'HR Manager', base_role:'admin', description:'Employee records, contracts, attendance and leave administration.', permissions:{
    employees:['view','create','edit'],departments:['view'],employee_attendance:['view','create','edit'],hr:['view','create','edit'],approvals:['view','approve'],work_tasks:['view','create','edit']
  }},
  { name:'Librarian', base_role:'teacher', description:'Library catalogue and circulation workflows, with limited student identification access.', permissions:{
    students:['view'],library:['view','create','edit'],announcements:['view']
  }},
  { name:'Transport Manager', base_role:'admin', description:'Routes, vehicle allocations and transport charges in the authorised campus scope.', permissions:{students:['view'],transport:['view','create','edit'],fees:['view'],announcements:['view']} },
  { name:'Hostel Warden', base_role:'admin', description:'Residence assignments, room occupancy, guest registers, maintenance and hostel fee workflow.', permissions:{hostel:['view','create','edit','approve'],students:['view'],announcements:['view']} },
  { name:'Procurement Officer', base_role:'admin', description:'Supplier records, purchase requests, quotations, purchase orders and goods receipt.', permissions:{procurement:['view','create','edit'],inventory:['view'],announcements:['view']} },
  { name:'Cafeteria Manager', base_role:'admin', description:'Menu availability, meal plans, cafeteria sales and stock-linked operations.', permissions:{cafeteria:['view','create','edit'],inventory:['view'],announcements:['view']} },
  { name:'Facilities Officer', base_role:'admin', description:'Asset assignments, transfers, warranty updates, maintenance and disposal records.', permissions:{facilities:['view','create','edit'],administration:['view'],announcements:['view']} },
  { name:'Helpdesk Officer', base_role:'admin', description:'Support-ticket triage, assignment, internal notes and resolution tracking.', permissions:{helpdesk:['view','create','edit'],announcements:['view']} },
  { name:'Data & Reporting Officer', base_role:'admin', description:'Saved report definitions, execution history, data review and duplicate resolution.', permissions:{reports:['view','create','edit'],data_management:['view','create','edit','approve']} },
  { name:'Forms & Records Officer', base_role:'admin', description:'Dynamic form definitions, submission review and controlled institutional records.', permissions:{forms:['view','create','edit','approve'],institutional_records:['view','create','edit']} },
  { name:'Receptionist', base_role:'admin', description:'Visitor registration, enquiries and public-facing college announcements.', permissions:{
    visitors:['view','create','edit'],announcements:['view'],work_tasks:['view','create'],helpdesk:['create','view']
  }},
  { name:'Student', base_role:'student', description:'Personal learning, attendance, assignments, published results, fee status and certificates.', permissions:{
    students:['view'],attendance:['view'],assignments:['view','create'],examinations:['view'],fees:['view'],announcements:['view'],certificates:['view'],library:['view'],behaviour:['view'],hostel:['view'],transport:['view'],forms:['view','create'],helpdesk:['create'],communications:['view','create','edit']
  }},
  { name:'Parent / Guardian', base_role:'parent', description:'View information belonging only to verified linked students.', permissions:{
    students:['view'],attendance:['view'],assignments:['view'],examinations:['view'],fees:['view'],announcements:['view'],certificates:['view'],library:['view'],behaviour:['view'],hostel:['view'],transport:['view'],forms:['view','create'],helpdesk:['create'],communications:['view','create','edit']
  }},
]

const emptyEditor = {
  name: '', base_role: 'teacher' as BaseRole, description: '',
  module_permissions: {} as Record<string,string[]>,
}
const slug = (value:string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,63)

export function CollegeRolePermissionWorkspace({
  institutionId, currentUserId, members, onToast,
}: {
  institutionId: string
  currentUserId: string
  members: Member[]
  onToast: (message:string,error?:boolean)=>void
}) {
  const [profiles,setProfiles] = useState<RoleProfile[]>([])
  const [assignments,setAssignments] = useState<RoleAssignment[]>([])
  const [campuses,setCampuses] = useState<NamedRow[]>([])
  const [departments,setDepartments] = useState<NamedRow[]>([])
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')
  const [editorOpen,setEditorOpen] = useState(false)
  const [editingProfile,setEditingProfile] = useState<RoleProfile|null>(null)
  const [editor,setEditor] = useState(emptyEditor)
  const [selectedTemplate,setSelectedTemplate] = useState('')
  const [assignOpen,setAssignOpen] = useState(false)
  const [assignProfileId,setAssignProfileId] = useState('')
  const [assignUserId,setAssignUserId] = useState('')
  const [assignCampusId,setAssignCampusId] = useState('')
  const [assignDepartmentId,setAssignDepartmentId] = useState('')
  const [assignEndDate,setAssignEndDate] = useState('')
  const editorModalRef = useRef<HTMLFormElement|null>(null)
  const assignmentModalRef = useRef<HTMLFormElement|null>(null)

  async function load(silent=false) {
    if (!supabase) { setError('Database connection is unavailable.'); setLoading(false); return }
    if (!silent) { setLoading(true); setError('') }
    try {
      const [profileResult,assignmentResult,campusResult,departmentResult] = await Promise.all([
        supabase.from('institution_role_profiles').select('*').eq('institution_id',institutionId).order('name'),
        supabase.from('institution_user_role_assignments').select('*').eq('institution_id',institutionId).order('created_at',{ascending:false}),
        supabase.from('campuses').select('id,name').eq('institution_id',institutionId).eq('is_active',true).order('name'),
        supabase.from('departments').select('id,name,campus_id').eq('institution_id',institutionId).order('name'),
      ])
      if (profileResult.error) throw profileResult.error
      if (assignmentResult.error) throw assignmentResult.error
      if (campusResult.error) throw campusResult.error
      if (departmentResult.error) throw departmentResult.error
      setProfiles((profileResult.data??[]) as RoleProfile[])
      setAssignments((assignmentResult.data??[]) as RoleAssignment[])
      setCampuses((campusResult.data??[]) as NamedRow[])
      setDepartments((departmentResult.data??[]) as NamedRow[])
    } catch (cause) {
      const message=userFacingError(cause,'Role profiles could not be loaded.')
      setError(message)
    } finally { setLoading(false) }
  }

  useEffect(()=>{ void load() },[institutionId])

  useEffect(()=>{
    if(!editorOpen&&!assignOpen)return
    const previousOverflow=document.body.style.overflow
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null
    document.body.style.overflow='hidden'
    const modal=assignOpen?assignmentModalRef.current:editorModalRef.current
    const focusable=()=>Array.from(modal?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')??[])
    focusable()[0]?.focus()
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault()
        if(assignOpen)setAssignOpen(false)
        else setEditorOpen(false)
        return
      }
      if(event.key!=='Tab')return
      const items=focusable()
      if(!items.length)return
      const first=items[0],last=items[items.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',onKeyDown)
    return ()=>{
      document.removeEventListener('keydown',onKeyDown)
      document.body.style.overflow=previousOverflow
      previousFocus?.focus()
    }
  },[editorOpen,assignOpen])

  const memberById=useMemo(()=>new Map(members.map(member=>[member.user_id,member])),[members])
  const profileById=useMemo(()=>new Map(profiles.map(profile=>[profile.id,profile])),[profiles])
  const activeAssignments=assignments.filter(item=>item.status==='active' && (!item.ends_at || new Date(item.ends_at).getTime()>Date.now()))
  const activeMembers=members.filter(member=>member.status==='active' && member.user_id!==currentUserId)
  const eligibleMembers=activeMembers.filter(member=>profiles.some(profile=>profile.base_role===member.role && profile.is_active))
  const profileCount=(profileId:string)=>assignments.filter(item=>item.role_profile_id===profileId && item.status==='active').length

  function newProfile(template?:typeof templates[number]) {
    setEditingProfile(null)
    setEditor(template?{
      name:template.name,base_role:template.base_role,description:template.description,
      module_permissions:JSON.parse(JSON.stringify(template.permissions)) as Record<string,string[]>,
    }:{...emptyEditor,module_permissions:{}})
    setSelectedTemplate(template?.name??'')
    setEditorOpen(true)
  }

  function editProfile(profile:RoleProfile) {
    setEditingProfile(profile)
    setEditor({name:profile.name,base_role:profile.base_role,description:profile.description,module_permissions:{...profile.module_permissions}})
    setSelectedTemplate('')
    setEditorOpen(true)
  }

  function chooseTemplate(name:string) {
    setSelectedTemplate(name)
    const template=templates.find(item=>item.name===name)
    if (template) setEditor({
      name:template.name,base_role:template.base_role,description:template.description,
      module_permissions:JSON.parse(JSON.stringify(template.permissions)) as Record<string,string[]>,
    })
  }

  function togglePermission(moduleKey:string,action:string,enabled:boolean) {
    setEditor(current=>{
      const next={...current.module_permissions}
      const actions=new Set(next[moduleKey]??[])
      if (enabled) actions.add(action); else actions.delete(action)
      if (actions.size) next[moduleKey]=Array.from(actions); else delete next[moduleKey]
      return {...current,module_permissions:next}
    })
  }

  async function saveProfile(event:FormEvent) {
    event.preventDefault()
    if(!supabase || !editor.name.trim()) return
    if(!Object.values(editor.module_permissions).some(actions=>actions.length)){
      onToast('Choose at least one module permission before saving.',true);return
    }
    const roleKey=editingProfile?.role_key??slug(editor.name)
    if(!roleKey){onToast('Enter a valid role name.',true);return}
    setSaving(true)
    try{
      const values={
        institution_id:institutionId,role_key:roleKey,name:editor.name.trim(),
        base_role:editor.base_role,description:editor.description.trim(),
        module_permissions:editor.module_permissions,is_active:editingProfile?.is_active??true,
        updated_by:currentUserId,
      }
      const result=editingProfile
        ? await supabase.from('institution_role_profiles').update(values).eq('institution_id',institutionId).eq('id',editingProfile.id)
        : await supabase.from('institution_role_profiles').insert({...values,created_by:currentUserId})
      if(result.error)throw result.error
      setEditorOpen(false);onToast(editingProfile?'Role profile updated.':'College role profile created.');await load(true)
    }catch(cause){onToast(userFacingError(cause,'The role profile could not be saved.'),true)}
    finally{setSaving(false)}
  }

  function openAssign(profileId='') {
    setAssignProfileId(profileId)
    setAssignUserId('')
    setAssignCampusId('')
    setAssignDepartmentId('')
    setAssignEndDate('')
    setAssignOpen(true)
  }

  async function saveAssignment(event:FormEvent) {
    event.preventDefault()
    if(!supabase || !assignUserId || !assignProfileId){onToast('Choose a member and a role profile.',true);return}
    const member=memberById.get(assignUserId)
    const profile=profileById.get(assignProfileId)
    if(!member || !profile || member.role!==profile.base_role || member.status!=='active'){
      onToast('This role profile does not match the member’s active account role.',true);return
    }
    const duplicate=assignments.some(row=>row.user_id===assignUserId&&row.role_profile_id===assignProfileId&&row.campus_id===(assignCampusId||null)&&row.department_id===(assignDepartmentId||null)&&row.status==='active')
    if(duplicate){onToast('This member already has that active assignment and scope.',true);return}
    setSaving(true)
    try{
      const {error:insertError}=await supabase.from('institution_user_role_assignments').insert({
        institution_id:institutionId,user_id:assignUserId,role_profile_id:assignProfileId,
        campus_id:assignCampusId||null,department_id:assignDepartmentId||null,
        status:'active',assigned_by:currentUserId,
        ...(assignEndDate?{ends_at:new Date(assignEndDate).toISOString()}:{})
      })
      if(insertError)throw insertError
      setAssignOpen(false);onToast('Role profile assigned. The member’s database access is now restricted to this profile.');await load(true)
    }catch(cause){onToast(userFacingError(cause,'The role profile could not be assigned.'),true)}
    finally{setSaving(false)}
  }

  async function setAssignmentStatus(row:RoleAssignment,status:RoleAssignment['status']) {
    if(!supabase)return
    const action=status==='active'?'reactivate':'suspend or end'
    if(!window.confirm('Are you sure you want to '+action+' this role assignment? An assigned member only retains the permissions in their active role profiles.'))return
    setSaving(true)
    const {error:updateError}=await supabase.from('institution_user_role_assignments').update({status,updated_at:new Date().toISOString()}).eq('institution_id',institutionId).eq('id',row.id)
    if(updateError)onToast(userFacingError(updateError,'The assignment status could not be changed.'),true)
    else{onToast(status==='active'?'Role assignment reactivated.':'Role assignment status changed.');await load(true)}
    setSaving(false)
  }

  async function toggleProfileStatus(profile:RoleProfile) {
    if(!supabase)return
    const next=!profile.is_active
    if(!window.confirm(next?'Reactivate this role profile?':'Deactivate this role profile? Members assigned only this profile will lose its permissions.'))return
    setSaving(true)
    const {error:updateError}=await supabase.from('institution_role_profiles').update({is_active:next,updated_by:currentUserId,updated_at:new Date().toISOString()}).eq('institution_id',institutionId).eq('id',profile.id)
    if(updateError)onToast(userFacingError(updateError,'The role profile status could not be changed.'),true)
    else{onToast(next?'Role profile reactivated.':'Role profile deactivated.');await load(true)}
    setSaving(false)
  }

  const matchingProfiles=profiles.filter(profile=>profile.base_role===memberById.get(assignUserId)?.role && profile.is_active)
  const scopedDepartments=departments.filter(department=>!assignCampusId||!department.campus_id||department.campus_id===assignCampusId)

  if(loading)return <section className="crp-panel"><p>Loading college role profiles…</p></section>

  return <div className="crp-workspace">
    <section className="crp-intro">
      <div className="crp-intro-icon"><ShieldCheck size={24}/></div>
      <div><span className="crp-kicker">COLLEGE ACCESS GOVERNANCE</span><h2>Roles, responsibilities & access</h2><p>Create job-specific profiles, assign them to active college accounts and restrict access by campus or department. Every profile sits below the person’s base account role—never above it.</p></div>
    </section>

    <div className="crp-security-note"><LockKeyhole size={17}/><span><b>Database-enforced access.</b> Assigned profiles restrict row-level access in Supabase. Members with no custom profile retain the existing base-role access. The owner remains the ultimate authority.</span></div>

    <div className="crp-summary-grid">
      <article><span>Role profiles</span><strong>{profiles.length}</strong><small>{profiles.filter(profile=>profile.is_active).length} active</small></article>
      <article><span>Active assignments</span><strong>{activeAssignments.length}</strong><small>Campus and department scoped</small></article>
      <article><span>Accounts available</span><strong>{activeMembers.length}</strong><small>Active college memberships, excluding your own account</small></article>
    </div>

    <section className="crp-panel">
      <header><div><h3>College role profiles</h3><p>Start with an institutional template or create a job profile for a specific responsibility.</p></div><button type="button" className="crp-button crp-button-primary" onClick={()=>newProfile()}><Plus size={16}/> Create role</button></header>
      <div className="crp-template-row">
        <label><span>Suggested role template</span><select value={selectedTemplate} onChange={event=>chooseTemplate(event.target.value)}><option value="">Choose a college role template…</option>{templates.map(template=><option key={template.name} value={template.name}>{template.name}</option>)}</select></label>
        <button type="button" className="crp-button" disabled={!selectedTemplate} onClick={()=>newProfile(templates.find(item=>item.name===selectedTemplate))}><BookOpen size={15}/> Use template</button>
      </div>
      {error&&<div className="crp-error"><CircleAlert size={16}/>{error}<button type="button" onClick={()=>void load()}><RefreshCw size={14}/> Retry</button></div>}
      {profiles.length?<div className="crp-role-grid">
        {profiles.map(profile=><article className={'crp-role-card '+(!profile.is_active?'is-inactive':'')} key={profile.id}>
          <div className="crp-role-card-top"><span className="crp-role-icon"><BadgeCheck size={18}/></span><span className={'crp-status '+(profile.is_active?'active':'inactive')}>{profile.is_active?'Active':'Inactive'}</span></div>
          <h4>{profile.name}</h4><p>{profile.description||'No role description supplied.'}</p>
          <div className="crp-role-meta"><span>Base account: <b>{profile.base_role.replaceAll('_',' ')}</b></span><span>{Object.keys(profile.module_permissions??{}).length} modules</span><span>{profileCount(profile.id)} active assignments</span></div>
          <div className="crp-role-actions"><button type="button" className="crp-button" onClick={()=>editProfile(profile)}><Edit3 size={14}/> Edit</button><button type="button" className="crp-button" onClick={()=>openAssign(profile.id)}><UserPlus size={14}/> Assign</button><button type="button" className="crp-button crp-button-quiet" onClick={()=>void toggleProfileStatus(profile)}>{profile.is_active?'Deactivate':'Activate'}</button></div>
        </article>)}
      </div>:<div className="crp-empty"><BookOpen size={25}/><b>No college role profiles created yet.</b><span>Use a suggested template to set up HOD, Registrar, Invigilator, Accounts Officer and other responsibilities.</span></div>}
    </section>

    <section className="crp-panel">
      <header><div><h3>Assigned role access</h3><p>Assignments remain in the history when suspended or ended. Reassign a profile to restore authorised access.</p></div><Users size={20}/></header>
      {assignments.length?<div className="crp-table-wrap"><table><thead><tr><th>Member</th><th>Assigned job profile</th><th>Base account</th><th>Scope</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {assignments.map(row=>{
          const member=memberById.get(row.user_id)
          const profile=profileById.get(row.role_profile_id)
          const scope=[campuses.find(item=>item.id===row.campus_id)?.name,departments.find(item=>item.id===row.department_id)?.name].filter(Boolean).join(' · ')||'All campuses / departments'
          const active=row.status==='active'&&(!row.ends_at||new Date(row.ends_at).getTime()>Date.now())
          return <tr key={row.id}><td><b>{member?.full_name??'College account'}</b><small>{member?.email??row.user_id}</small></td><td>{profile?.name??'Unavailable profile'}</td><td>{profile?.base_role??member?.role??'—'}</td><td>{scope}</td><td><span className={'crp-status '+(active?'active':'inactive')}>{active?'Active':row.status}</span></td><td><button type="button" className="crp-text-button" disabled={saving||!profile?.is_active} onClick={()=>void setAssignmentStatus(row,active?'suspended':'active')}>{active?'Suspend':'Reactivate'}</button></td></tr>
        })}
      </tbody></table></div>:<div className="crp-empty"><Users size={25}/><b>No role assignments yet.</b><span>Role profiles can be created first, then assigned to active members of the matching base account role.</span></div>}
    </section>

    {editorOpen&&<div className="crp-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setEditorOpen(false)}}>
      <form ref={editorModalRef} className="crp-modal" onSubmit={saveProfile} role="dialog" aria-modal="true" aria-labelledby="crp-editor-title">
        <header><div><span className="crp-kicker">ROLE PROFILE EDITOR</span><h3 id="crp-editor-title">{editingProfile?'Edit college role':'Create college role'}</h3><p>Choose a base account role and select only the module actions required for the job.</p></div><button type="button" className="crp-icon-button" onClick={()=>setEditorOpen(false)} aria-label="Close editor"><X size={19}/></button></header>
        <div className="crp-form-grid">
          <label><span>Job title / role name</span><input required maxLength={100} value={editor.name} onChange={event=>setEditor(current=>({...current,name:event.target.value}))} placeholder="e.g. Senior Lecturer / HOD"/></label>
          <label><span>Base account role</span><select value={editor.base_role} disabled={Boolean(editingProfile)} onChange={event=>setEditor(current=>({...current,base_role:event.target.value as BaseRole}))}>{baseRoleOptions.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="crp-form-wide"><span>Role purpose and responsibility</span><textarea rows={2} maxLength={500} value={editor.description} onChange={event=>setEditor(current=>({...current,description:event.target.value}))} placeholder="Describe what this person is responsible for…"/></label>
        </div>
        <div className="crp-permission-heading"><div><h4>Module permissions</h4><p>Actions are enforced against the relevant database records. Approval and publication are separate from ordinary editing.</p></div><span>{Object.keys(editor.module_permissions).length} selected modules</span></div>
        <div className="crp-permission-list">{modules.map(module=>{
          const selected=editor.module_permissions[module.key]??[]
          return <article key={module.key}><div><b>{module.label}</b><small>{module.key}</small></div><div className="crp-action-options">{module.actions.map(action=><label key={action}><input type="checkbox" checked={selected.includes(action)} onChange={event=>togglePermission(module.key,action,event.target.checked)}/><span>{actionLabels[action]}</span></label>)}</div></article>
        })}</div>
        <footer><button type="button" className="crp-button" onClick={()=>setEditorOpen(false)}>Cancel</button><button type="submit" className="crp-button crp-button-primary" disabled={saving}><Save size={15}/>{saving?'Saving…':'Save role profile'}</button></footer>
      </form>
    </div>}

    {assignOpen&&<div className="crp-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setAssignOpen(false)}}>
      <form ref={assignmentModalRef} className="crp-modal crp-assign-modal" onSubmit={saveAssignment} role="dialog" aria-modal="true" aria-labelledby="crp-assign-title">
        <header><div><span className="crp-kicker">COLLEGE ACCOUNT ACCESS</span><h3 id="crp-assign-title">Assign a job profile</h3><p>Only active members whose base account role matches the selected profile can be assigned.</p></div><button type="button" className="crp-icon-button" onClick={()=>setAssignOpen(false)} aria-label="Close assignment"><X size={19}/></button></header>
        <div className="crp-form-grid">
          <label className="crp-form-wide"><span>College member</span><select required value={assignUserId} onChange={event=>{const nextUserId=event.target.value;setAssignUserId(nextUserId);const selectedProfile=profileById.get(assignProfileId);if(selectedProfile&&memberById.get(nextUserId)?.role!==selectedProfile.base_role)setAssignProfileId('')}}><option value="">Choose an active member…</option>{eligibleMembers.map(member=><option key={member.user_id} value={member.user_id}>{member.full_name||member.email||member.user_id} — {member.role.replaceAll('_',' ')}</option>)}</select></label>
          <label className="crp-form-wide"><span>Job profile</span><select required value={assignProfileId} onChange={event=>setAssignProfileId(event.target.value)}><option value="">Choose a matching role profile…</option>{matchingProfiles.map(profile=><option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
          <label><span>Campus scope</span><select value={assignCampusId} onChange={event=>{setAssignCampusId(event.target.value);setAssignDepartmentId('')}}><option value="">All campuses</option>{campuses.map(campus=><option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label>
          <label><span>Department scope</span><select value={assignDepartmentId} onChange={event=>setAssignDepartmentId(event.target.value)}><option value="">All departments</option>{scopedDepartments.map(department=><option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
          <label className="crp-form-wide"><span>Access end date (optional)</span><input type="datetime-local" value={assignEndDate} onChange={event=>setAssignEndDate(event.target.value)}/></label>
        </div>
        <div className="crp-assignment-warning"><CircleAlert size={16}/><span>Assigning a profile activates custom restrictions for that account. Modules and records not included in its active profiles become inaccessible, while the college owner retains ultimate authority.</span></div>
        <footer><button type="button" className="crp-button" onClick={()=>setAssignOpen(false)}>Cancel</button><button type="submit" className="crp-button crp-button-primary" disabled={saving||!assignUserId||!assignProfileId}><UserPlus size={15}/>{saving?'Assigning…':'Assign profile'}</button></footer>
      </form>
    </div>}
  </div>
}
