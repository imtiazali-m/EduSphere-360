import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Activity, AlertCircle, BookOpen, BookOpenCheck, CalendarDays, CheckCircle2,
  ChevronRight, ClipboardList, Clock3, Download, ExternalLink, GraduationCap,
  Layers3, Library, LockKeyhole, Pencil, Plus, Printer, RefreshCw, Search, ShieldCheck,
  Trash2, Upload, Users, Video, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { AppRole } from '../lib/types'
import '../styles/academic-management.css'

type RowData = Record<string, any>
type OptionSource = 'sessions' | 'classes' | 'subjects' | 'teachers' | 'rooms' | 'students' | 'assignments' | 'courses' | 'courseUnits' | 'curriculum' | 'programs' | 'activities'
type FieldSpec = {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'date' | 'time' | 'number' | 'select' | 'url' | 'email' | 'boolean'
  required?: boolean
  source?: OptionSource
  options?: { label: string; value: string }[]
  placeholder?: string
  jsonArray?: boolean
  studentOnly?: boolean
  staffOnly?: boolean
}
type ColumnSpec = { key: string; label: string; source?: OptionSource }
type DataMode = {
  key: string
  title: string
  table: string
  description: string
  fields: FieldSpec[]
  columns: ColumnSpec[]
  writeRoles: AppRole[]
  hideFrom?: AppRole[]
}
type AcademicSection = {
  key: string
  title: string
  short: string
  description: string
  icon: typeof BookOpen
  modes: DataMode[]
}

const admins: AppRole[] = ['owner', 'admin']
const manager: AppRole[] = ['owner', 'admin', 'teacher']
const f = (key: string, label: string, type: FieldSpec['type'] = 'text', required = false, source?: OptionSource, options?: { label: string; value: string }[], extra: Partial<FieldSpec> = {}): FieldSpec => ({
  key, label, type, required, source, options, ...extra,
})
const c = (key: string, label: string, source?: OptionSource): ColumnSpec => ({ key, label, source })
const select = (items: string[]) => items.map(value => ({ label: value.replace(/_/g, ' '), value }))

const academicSections: AcademicSection[] = [
  {
    key: 'academic-sessions', title: 'Academic Sessions', short: 'Sessions',
    description: 'Academic years, terms, semester dates, activation and session history.',
    icon: CalendarDays,
    modes: [
      { key: 'sessions', title: 'Academic years', table: 'academic_sessions', description: 'Set the active academic year, start and end dates, and status.',
        writeRoles: admins,
        fields: [
          f('session_name', 'Session name', 'text', true), f('code', 'Session code'),
          f('start_date', 'Start date', 'date'), f('end_date', 'End date', 'date'),
          f('status', 'Status', 'select', true, undefined, select(['planned','active','completed'])),
          f('is_current', 'Current session', 'boolean'), f('is_active', 'Available for use', 'boolean'),
          f('description', 'Description', 'textarea'), f('notes', 'Internal notes', 'textarea'),
        ],
        columns: [c('session_name','Academic year'),c('code','Code'),c('start_date','Starts'),c('end_date','Ends'),c('status','Status'),c('is_current','Current')],
      },
      { key: 'terms', title: 'Terms & semesters', table: 'academic_terms', description: 'Create school terms, college semesters, quarters or university modules within a session.',
        writeRoles: admins,
        fields: [
          f('academic_session_id','Academic session','select',true,'sessions'),f('term_name','Term / semester name','text',true),
          f('term_code','Term code'),f('term_type','Structure','select',true,undefined,select(['term','semester','quarter','trimester','module'])),
          f('term_order','Sequence','number',true),f('start_date','Start date','date',true),f('end_date','End date','date',true),
          f('status','Status','select',true,undefined,select(['planned','active','completed','cancelled'])),
          f('is_current','Current term','boolean'),f('notes','Notes','textarea'),
        ],
        columns: [c('term_name','Term'),c('academic_session_id','Academic session','sessions'),c('term_type','Type'),c('start_date','Starts'),c('end_date','Ends'),c('status','Status'),c('is_current','Current')],
      },
    ],
  },
  {
    key: 'classes-sections', title: 'Classes & Sections', short: 'Classes',
    description: 'Class, grade and section structures, class teachers, capacity and student allocation.',
    icon: GraduationCap,
    modes: [
      { key: 'classes', title: 'Classes & sections', table: 'classes', description: 'Maintain grade, programme, section and capacity records.',
        writeRoles: admins,
        fields: [
          f('name','Class / programme name','text',true),f('code','Class code'),f('grade_level','Grade / academic level'),
          f('section','Section'),f('academic_session_id','Academic session','select',false,'sessions'),
          f('program_id','Programme','select',false,'programs'),f('capacity','Class capacity','number'),
          f('description','Description','textarea'),f('is_active','Active class','boolean'),
        ],
        columns: [c('name','Class'),c('section','Section'),c('grade_level','Grade'),c('academic_session_id','Session','sessions'),c('capacity','Capacity'),c('is_active','Active')],
      },
      { key: 'class-teachers', title: 'Class teachers', table: 'class_teacher_assignments', description: 'Assign a primary class teacher for each session, with effective dates and history.',
        writeRoles: admins,
        fields: [
          f('class_id','Class / section','select',true,'classes'),f('teacher_id','Class teacher','select',true,'teachers'),
          f('academic_session_id','Academic session','select',true,'sessions'),f('is_primary','Primary class teacher','boolean'),
          f('start_date','Effective from','date'),f('end_date','Effective until','date'),
          f('status','Status','select',true,undefined,select(['active','ended','cancelled'])),f('notes','Notes','textarea'),
        ],
        columns: [c('class_id','Class','classes'),c('teacher_id','Teacher','teachers'),c('academic_session_id','Session','sessions'),c('is_primary','Primary'),c('start_date','From'),c('end_date','Until'),c('status','Status')],
      },
      { key: 'student-placement', title: 'Student allocation', table: 'student_placements', description: 'Allocate or transfer students into a class and preserve placement history.',
        writeRoles: admins,
        fields: [
          f('student_id','Student','select',true,'students'),f('class_id','Class / section','select',true,'classes'),
          f('effective_from','Effective from','date',true),f('effective_to','Effective until','date'),
          f('status','Placement status','select',true,undefined,select(['active','transferred','completed','withdrawn'])),
          f('placement_reason','Reason / notes','textarea'),
        ],
        columns: [c('student_id','Student','students'),c('class_id','Class','classes'),c('effective_from','From'),c('effective_to','Until'),c('status','Status'),c('placement_reason','Reason')],
      },
    ],
  },
  {
    key: 'subjects-courses', title: 'Subjects', short: 'Subjects',
    description: 'Subject catalogue, course information, credits and teacher / class allocations.',
    icon: BookOpen,
    modes: [
      { key: 'subjects', title: 'Subject catalogue', table: 'subjects', description: 'Set subject codes, learning levels, departments and credit hours.',
        writeRoles: admins,
        fields: [
          f('subject_code','Subject code','text',true),f('name','Subject / course name','text',true),
          f('description','Description','textarea'),f('department','Department'),f('level','Grade / level'),
          f('subject_type','Subject type','select',false,undefined,select(['core','elective','optional','practical','theory','other'])),
          f('credit_hours','Credit hours','number'),f('is_active','Active subject','boolean'),
        ],
        columns: [c('subject_code','Code'),c('name','Subject'),c('department','Department'),c('level','Level'),c('credit_hours','Credits'),c('is_active','Active')],
      },
      { key: 'teacher-allocations', title: 'Teacher allocations', table: 'teacher_assignments', description: 'Allocate a teacher to a subject and class for an academic session.',
        writeRoles: admins,
        fields: [
          f('teacher_id','Teacher','select',true,'teachers'),f('subject_id','Subject','select',true,'subjects'),
          f('class_id','Class / section','select',true,'classes'),f('academic_session_id','Academic session','select',true,'sessions'),
          f('weekly_periods','Weekly periods','number'),f('assignment_type','Allocation type','select',true,undefined,select(['teaching','homeroom','substitution','coordination'])),
          f('start_date','Starts','date'),f('end_date','Ends','date'),
          f('status','Status','select',true,undefined,select(['active','completed','cancelled'])),f('notes','Notes','textarea'),
        ],
        columns: [c('teacher_id','Teacher','teachers'),c('subject_id','Subject','subjects'),c('class_id','Class','classes'),c('academic_session_id','Session','sessions'),c('weekly_periods','Periods / week'),c('assignment_type','Type'),c('status','Status')],
      },
    ],
  },
  {
    key: 'curriculum', title: 'Curriculum', short: 'Curriculum',
    description: 'Curriculum map, objectives, learning outcomes, units, topics and syllabus coverage.',
    icon: Layers3,
    modes: [
      { key: 'units', title: 'Curriculum units', table: 'curriculum_units', description: 'Map syllabus topics and outcomes to a class, subject and academic session.',
        writeRoles: manager,
        fields: [
          f('unit_code','Unit / chapter code'),f('title','Unit / chapter title','text',true),
          f('subject_id','Subject','select',true,'subjects'),f('class_id','Class / section','select',true,'classes'),
          f('academic_session_id','Academic session','select',false,'sessions'),f('sequence_no','Sequence','number',true),
          f('overview','Unit overview','textarea'),f('learning_objectives','Learning objectives (one per line)','textarea',false,undefined,undefined,{jsonArray:true}),
          f('learning_outcomes','Learning outcomes (one per line)','textarea',false,undefined,undefined,{jsonArray:true}),
          f('resource_links','Resource links (one URL per line)','textarea',false,undefined,undefined,{jsonArray:true}),
          f('planned_start','Planned start','date'),f('planned_end','Planned completion','date'),
          f('status','Coverage status','select',true,undefined,select(['planned','in_progress','completed','published','archived'])),
        ],
        columns: [c('unit_code','Unit'),c('title','Chapter / unit'),c('subject_id','Subject','subjects'),c('class_id','Class','classes'),c('sequence_no','Order'),c('planned_start','Starts'),c('planned_end','Ends'),c('status','Coverage')],
      },
    ],
  },
  {
    key: 'lesson-planning', title: 'Lesson Plans', short: 'Lessons',
    description: 'Teacher lesson plans, learning objectives, teaching methods, resources and completion tracking.',
    icon: BookOpenCheck,
    modes: [
      { key: 'plans', title: 'Lesson plans', table: 'lesson_plans', description: 'Plan and record lessons against class, subject and session.',
        writeRoles: manager,
        fields: [
          f('title','Lesson plan title','text',true),f('topic','Topic / chapter','text',true),
          f('class_id','Class / section','select',true,'classes'),f('subject_id','Subject','select',true,'subjects'),
          f('academic_session_id','Academic session','select',false,'sessions'),f('teacher_id','Teacher','select',false,'teachers'),
          f('planned_date','Planned date','date'),f('duration_minutes','Duration (minutes)','number'),
          f('learning_objectives','Learning objectives','textarea'),f('teaching_method','Teaching method','textarea'),
          f('resources','Resources / materials','textarea'),f('status','Status','select',true,undefined,select(['draft','planned','in_progress','completed','cancelled'])),
          f('completion_notes','Completion notes','textarea'),
        ],
        columns: [c('title','Lesson'),c('topic','Topic'),c('class_id','Class','classes'),c('subject_id','Subject','subjects'),c('teacher_id','Teacher','teachers'),c('planned_date','Date'),c('status','Status')],
      },
    ],
  },
  {
    key: 'timetable', title: 'Timetable', short: 'Timetable',
    description: 'Class, teacher, subject, room and period schedules with automatic conflict prevention.',
    icon: Clock3,
    modes: [
      { key: 'schedule', title: 'Timetable schedule', table: 'timetable_entries', description: 'Assign classes, teachers, subjects and rooms to days and periods.',
        writeRoles: manager,
        fields: [
          f('academic_session_id','Academic session','select',false,'sessions'),f('class_id','Class / section','select',true,'classes'),
          f('subject_id','Subject','select',true,'subjects'),f('teacher_id','Teacher','select',true,'teachers'),f('room_id','Room','select',false,'rooms'),
          f('weekday','Day','select',true,undefined,select(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])),
          f('period_label','Period label'),f('period_order','Period number','number'),f('start_time','Starts at','time',true),f('end_time','Ends at','time',true),
          f('status','Publication status','select',true,undefined,select(['draft','published'])),f('notes','Notes','textarea'),
        ],
        columns: [c('weekday','Day'),c('period_label','Period'),c('class_id','Class','classes'),c('subject_id','Subject','subjects'),c('teacher_id','Teacher','teachers'),c('room_id','Room','rooms'),c('start_time','Start'),c('end_time','End'),c('status','Status')],
      },
    ],
  },
  {
    key: 'homework-assignments', title: 'Homework', short: 'Homework',
    description: 'Create assignments, collect submissions, review work, award marks and share feedback.',
    icon: ClipboardList,
    modes: [
      { key: 'assignments', title: 'Assignments', table: 'assignments', description: 'Publish class and subject assignments with deadlines and marks.',
        writeRoles: manager,
        fields: [
          f('title','Assignment title','text',true),f('class_id','Class / section','select',true,'classes'),
          f('subject_id','Subject','select',true,'subjects'),f('teacher_id','Assigned teacher','select',false,'teachers'),
          f('academic_session_id','Academic session','select',false,'sessions'),f('section_name','Section'),
          f('description','Instructions','textarea'),f('due_date','Deadline','date'),f('points','Maximum marks','number',true),
          f('attachment_url','Attachment URL','url'),f('status','Status','select',true,undefined,select(['open','closed'])),
        ],
        columns: [c('title','Assignment'),c('class_name','Class'),c('subject','Subject'),c('due_date','Deadline'),c('points','Marks'),c('status','Status')],
      },
      { key: 'submissions', title: 'Submissions & feedback', table: 'assignment_submissions', description: 'Students submit work; teachers review, mark and return feedback.',
        writeRoles: ['owner','admin','teacher','student'],
        fields: [
          f('assignment_id','Assignment','select',true,'assignments'),f('student_id','Student','select',true,'students',undefined,{studentOnly:true}),
          f('submission_text','Submission / answer','textarea',true),
          f('attachment_url','Submitted file URL','url'),
          f('status','Submission status','select',true,undefined,select(['submitted','late','graded','returned'])),
          f('marks_obtained','Marks awarded','number',false,undefined,undefined,{staffOnly:true}),
          f('feedback','Teacher feedback','textarea',false,undefined,undefined,{staffOnly:true}),
        ],
        columns: [c('assignment_title','Assignment'),c('student_name','Student'),c('submitted_at','Submitted'),c('status','Status'),c('marks_obtained','Marks'),c('feedback','Feedback')],
      },
    ],
  },
  {
    key: 'study-materials', title: 'Learning Materials', short: 'Materials',
    description: 'Upload and share notes, PDFs, presentations, videos, links and learning resources.',
    icon: Library,
    modes: [
      { key: 'materials', title: 'Learning resources', table: 'study_materials', description: 'Upload files or add links, then publish resources to the permitted class audience.',
        writeRoles: manager,
        fields: [
          f('title','Resource title','text',true),f('material_type','Resource type','select',true,undefined,select(['document','pdf','presentation','video','audio','link','image','other'])),
          f('class_id','Class / section','select',false,'classes'),f('subject_id','Subject','select',false,'subjects'),
          f('academic_session_id','Academic session','select',false,'sessions'),f('description','Description','textarea'),
          f('external_url','External resource URL','url'),f('available_from','Available from','date'),f('available_until','Available until','date'),
          f('visibility','Visibility','select',true,undefined,select(['draft','published','archived'])),
        ],
        columns: [c('title','Resource'),c('material_type','Type'),c('class_id','Class','classes'),c('subject_id','Subject','subjects'),c('visibility','Visibility'),c('available_from','From'),c('available_until','Until')],
      },
    ],
  },
  {
    key: 'online-learning', title: 'Online Learning', short: 'E-learning',
    description: 'Optional digital courses, units, resources, assignments and student completion tracking.',
    icon: Video,
    modes: [
      { key: 'courses', title: 'Courses', table: 'learning_courses', description: 'Create optional digital courses for classes and subjects.',
        writeRoles: manager,
        fields: [
          f('title','Course title','text',true),f('course_code','Course code'),f('class_id','Class / section','select',true,'classes'),
          f('subject_id','Subject','select',false,'subjects'),f('academic_session_id','Academic session','select',false,'sessions'),
          f('description','Course description','textarea'),f('learning_outcomes','Learning outcomes','textarea'),
          f('is_optional','Optional digital course','boolean'),f('start_date','Start date','date'),f('end_date','End date','date'),
          f('status','Status','select',true,undefined,select(['draft','published','archived'])),
        ],
        columns: [c('title','Course'),c('course_code','Code'),c('class_id','Class','classes'),c('subject_id','Subject','subjects'),c('is_optional','Optional'),c('status','Status')],
      },
      { key: 'units', title: 'Learning units', table: 'learning_course_units', description: 'Add lessons, text content, video links and required learning activities to a course.',
        writeRoles: manager,
        fields: [
          f('course_id','Course','select',true,'courses'),f('unit_order','Unit order','number',true),f('title','Unit title','text',true),
          f('content','Lesson content','textarea'),f('resource_url','Video / resource URL','url'),f('estimated_minutes','Estimated minutes','number'),
          f('is_required','Required unit','boolean'),f('status','Status','select',true,undefined,select(['draft','published','archived'])),
        ],
        columns: [c('course_id','Course','courses'),c('unit_order','Order'),c('title','Learning unit'),c('estimated_minutes','Minutes'),c('is_required','Required'),c('status','Status')],
      },
      { key: 'progress', title: 'Course progress', table: 'learning_course_progress', description: 'Track unit completion and teacher feedback for individual learners.',
        writeRoles: ['owner','admin','teacher','student'],
        fields: [
          f('course_id','Course','select',true,'courses'),f('unit_id','Learning unit','select',true,'courseUnits'),
          f('student_id','Student','select',true,'students',undefined,{studentOnly:true}),
          f('status','Completion status','select',true,undefined,select(['not_started','in_progress','completed'])),
          f('completion_percent','Completion (%)','number'),f('teacher_feedback','Teacher feedback','textarea',false,undefined,undefined,{staffOnly:true}),
        ],
        columns: [c('course_id','Course','courses'),c('unit_id','Unit','courseUnits'),c('student_id','Student','students'),c('status','Status'),c('completion_percent','Complete'),c('completed_at','Completed')],
      },
    ],
  },
  {
    key: 'classroom-activities', title: 'Classroom Activities', short: 'Classwork',
    description: 'Daily classwork, group activities, practical work, participation and teacher observations.',
    icon: Users,
    modes: [
      { key: 'activities', title: 'Classroom activities', table: 'classroom_activities', description: 'Record classroom activities and share the appropriate summary with families.',
        writeRoles: manager,
        fields: [
          f('class_id','Class / section','select',true,'classes'),f('subject_id','Subject','select',false,'subjects'),
          f('academic_session_id','Academic session','select',false,'sessions'),f('teacher_id','Teacher','select',false,'teachers'),
          f('activity_date','Activity date','date',true),f('activity_type','Activity type','select',true,undefined,select(['classwork','discussion','project','presentation','practical','group_work','participation','other'])),
          f('title','Activity title','text',true),f('description','Activity details','textarea'),f('participation_summary','Participation summary','textarea'),
          f('visibility','Family visibility','select',true,undefined,select(['staff_only','published'])),
        ],
        columns: [c('activity_date','Date'),c('title','Activity'),c('class_id','Class','classes'),c('subject_id','Subject','subjects'),c('activity_type','Type'),c('visibility','Visibility')],
      },
      { key: 'participation', title: 'Student participation', table: 'classroom_activity_participants', description: 'Capture a learner’s participation and teacher notes against a classroom activity.',
        writeRoles: manager,
        fields: [
          f('activity_id','Classroom activity','select',true,'activities'),f('student_id','Student','select',true,'students'),
          f('participation_status','Participation','select',true,undefined,select(['participated','noted','not_participated','absent'])),
          f('notes','Teacher observation','textarea'),
        ],
        columns: [c('activity_id','Activity','activities'),c('student_id','Student','students'),c('participation_status','Participation'),c('notes','Notes')],
      },
    ],
  },
  {
    key: 'academic-calendar', title: 'Academic Calendar', short: 'Calendar',
    description: 'Holidays, institutional events, examinations, assessment dates and academic milestones.',
    icon: CalendarDays,
    modes: [
      { key: 'events', title: 'Calendar events', table: 'academic_calendar_events', description: 'Publish important dates to staff, students, parents or the entire institution.',
        writeRoles: manager,
        fields: [
          f('title','Event title','text',true),f('event_type','Event type','select',true,undefined,select(['holiday','event','examination','assessment','milestone','deadline','meeting','other'])),
          f('academic_session_id','Academic session','select',false,'sessions'),f('class_id','Class / section','select',false,'classes'),
          f('start_date','Starts on','date',true),f('end_date','Ends on','date',true),f('all_day','All day event','boolean'),
          f('start_time','Start time','time'),f('end_time','End time','time'),f('audience','Audience','select',true,undefined,select(['all','staff','students','parents','students_and_parents'])),
          f('description','Description','textarea'),f('status','Publication status','select',true,undefined,select(['draft','published','cancelled'])),
        ],
        columns: [c('title','Event'),c('event_type','Type'),c('start_date','Starts'),c('end_date','Ends'),c('audience','Audience'),c('status','Status')],
      },
    ],
  },
  {
    key: 'learning-progress', title: 'Learning Progress', short: 'Progress',
    description: 'Topic completion, student performance, teacher observations and early intervention indicators.',
    icon: Activity,
    modes: [
      { key: 'student-progress', title: 'Student learning progress', table: 'learning_progress', description: 'Record progress against subjects and curriculum units, and identify learners who need support.',
        writeRoles: manager,
        fields: [
          f('student_id','Student','select',true,'students'),f('class_id','Class / section','select',true,'classes'),
          f('subject_id','Subject','select',true,'subjects'),f('curriculum_unit_id','Curriculum topic / unit','select',false,'curriculum'),
          f('academic_session_id','Academic session','select',false,'sessions'),
          f('progress_status','Progress status','select',true,undefined,select(['not_started','in_progress','completed','needs_support'])),
          f('completion_percent','Topic completion (%)','number'),f('assessment_score','Assessment score','number'),
          f('assessed_on','Assessment date','date',true),f('intervention_required','Intervention required','boolean'),
          f('intervention_notes','Intervention plan','textarea'),f('teacher_notes','Teacher observations','textarea'),
        ],
        columns: [c('student_id','Student','students'),c('class_id','Class','classes'),c('subject_id','Subject','subjects'),c('curriculum_unit_id','Topic','curriculum'),c('completion_percent','Complete'),c('assessment_score','Score'),c('progress_status','Progress'),c('intervention_required','Support needed')],
      },
    ],
  },
]

const sourceTables: Record<OptionSource, string> = {
  sessions: 'academic_sessions', classes: 'classes', subjects: 'subjects', teachers: 'teachers',
  rooms: 'rooms', students: 'students', assignments: 'assignments', courses: 'learning_courses',
  courseUnits: 'learning_course_units', curriculum: 'curriculum_units', programs: 'programs', activities: 'classroom_activities',
}
const displayName = (row: RowData): string => {
  const name = row.name ?? row.session_name ?? row.title ?? row.full_name ?? row.term_name ?? row.subject_code ?? row.employee_no ?? row.code ?? row.id
  const tail = row.section ? ' · ' + row.section : ''
  const extra = row.admission_no ? ' · ' + row.admission_no : row.employee_no ? ' · ' + row.employee_no : ''
  return String(name ?? 'Unnamed record') + tail + extra
}
const normalDate = () => new Date().toISOString().slice(0, 10)
const csvValue = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"'

interface Props { initialWindow?: string; onToast: (message: string, error?: boolean) => void }

export function AcademicManagementWorkspace({ initialWindow = 'academic-sessions', onToast }: Props) {
  const { user } = useAuth()
  const [activeKey, setActiveKey] = useState(initialWindow)
  const [modeKey, setModeKey] = useState('')
  const [rows, setRows] = useState<RowData[]>([])
  const [references, setReferences] = useState<Partial<Record<OptionSource, RowData[]>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editing, setEditing] = useState<RowData | null>(null)
  const [values, setValues] = useState<Record<string, string | boolean>>({})
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [onlineLearningEnabled, setOnlineLearningEnabled] = useState(false)
  const [preferenceLoading, setPreferenceLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => { setActiveKey(initialWindow) }, [initialWindow])

  const section = useMemo(() => academicSections.find(item => item.key === activeKey) ?? academicSections[0], [activeKey])
  const activeMode = useMemo(() => section.modes.find(item => item.key === modeKey) ?? section.modes[0], [section, modeKey])
  const canCreate = Boolean(user && activeMode.writeRoles.includes(user.role))
  const isStudent = user?.role === 'student'
  const visibleFields = activeMode.fields.filter(field => !(field.staffOnly && (user?.role === 'student' || user?.role === 'parent')) && !(field.studentOnly && user?.role === 'parent') && !(isStudent && activeMode.table === 'assignment_submissions' && field.key === 'status'))
  const isOnlineLearning = section.key === 'online-learning'

  async function fetchTable(table: string): Promise<RowData[]> {
    if (!supabase || !user) return []
    let query = supabase.from(table).select('*').eq('institution_id', user.institutionId)
    if (table !== 'academic_preferences') query = query.order('created_at', { ascending: false })
    const { data, error } = await query.limit(500)
    if (error) throw error
    return (data ?? []) as RowData[]
  }

  async function reload() {
    if (!supabase || !user) {
      setLoading(false)
      setErrorMessage('Your institution session is not available. Sign in again to load academic records.')
      return
    }
    setLoading(true)
    setErrorMessage('')
    try {
      const sourceList = Object.keys(sourceTables) as OptionSource[]
      const [primary, refs, preference] = await Promise.all([
        fetchTable(activeMode.table),
        Promise.all(sourceList.map(async source => {
          try { return [source, await fetchTable(sourceTables[source])] as const }
          catch { return [source, [] as RowData[]] as const }
        })),
        supabase.from('academic_preferences').select('online_learning_enabled').eq('institution_id', user.institutionId).maybeSingle(),
      ])
      setRows(primary)
      setReferences(Object.fromEntries(refs) as Partial<Record<OptionSource, RowData[]>>)
      if (preference.error) throw preference.error
      setOnlineLearningEnabled(Boolean(preference.data?.online_learning_enabled))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Academic records could not be loaded.'
      setRows([])
      setErrorMessage(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void reload() }, [activeMode.table, user?.id, user?.institutionId])

  function optionsFor(source?: OptionSource) {
    if (!source) return []
    const options = references[source] ?? []
    return options.map(row => ({ value: String(row.id), label: displayName(row) }))
  }

  function openCreate() {
    const next: Record<string, string | boolean> = {}
    visibleFields.forEach(field => {
      if (field.type === 'boolean') next[field.key] = ['is_active','is_optional','all_day','intervention_required','is_primary'].includes(field.key)
      else if (field.key === 'status') next[field.key] = field.options?.[0]?.value ?? ''
      else if (['activity_date','effective_from','assessed_on','planned_date','start_date'].includes(field.key)) next[field.key] = normalDate()
      else if (field.key === 'is_current') next[field.key] = false
      else next[field.key] = ''
    })
    if (user?.role === 'student' && user.linkedStudentId) next.student_id = user.linkedStudentId
    setEditing(null)
    setValues(next)
    setSelectedFile(null)
    setShowEditor(true)
  }

  function openEdit(row: RowData) {
    const next: Record<string, string | boolean> = {}
    visibleFields.forEach(field => {
      const value = row[field.key]
      next[field.key] = field.type === 'boolean' ? Boolean(value) : value === null || value === undefined ? '' : String(value)
    })
    setEditing(row)
    setValues(next)
    setSelectedFile(null)
    setShowEditor(true)
  }

  function setField(key: string, value: string | boolean) {
    setValues(current => ({ ...current, [key]: value }))
  }

  function resolveOption(source: OptionSource | undefined, id: unknown) {
    if (!source || !id) return undefined
    return (references[source] ?? []).find(row => String(row.id) === String(id))
  }

  function buildPayload(): RowData {
    const payload: RowData = {}
    visibleFields.forEach(field => {
      const value = values[field.key]
      if (value === '' || value === null || value === undefined) return
      if (field.jsonArray) {
        const raw = String(value).trim()
        if (!raw) payload[field.key] = []
        else {
          try {
            const parsed = JSON.parse(raw)
            payload[field.key] = Array.isArray(parsed) ? parsed : [parsed]
          } catch { payload[field.key] = raw.split('\n').map(item => item.trim()).filter(Boolean) }
        }
      } else if (field.type === 'number') payload[field.key] = Number(value)
      else if (field.type === 'boolean') payload[field.key] = Boolean(value)
      else payload[field.key] = String(value).trim()
    })

    if (!editing && activeMode.table === 'academic_sessions') {
      payload.name = payload.session_name
    }
    if (activeMode.table === 'timetable_entries') {
      const cls = resolveOption('classes', payload.class_id)
      const subject = resolveOption('subjects', payload.subject_id)
      const teacher = resolveOption('teachers', payload.teacher_id)
      const room = resolveOption('rooms', payload.room_id)
      payload.class_name = cls?.name ?? editing?.class_name ?? ''
      payload.subject = subject?.name ?? editing?.subject ?? ''
      payload.teacher_name = teacher?.full_name ?? editing?.teacher_name ?? ''
      payload.room = room?.name ?? editing?.room ?? ''
    }
    if (activeMode.table === 'assignments') {
      const cls = resolveOption('classes', payload.class_id)
      const subject = resolveOption('subjects', payload.subject_id)
      const session = resolveOption('sessions', payload.academic_session_id)
      payload.class_name = cls?.name ?? editing?.class_name ?? ''
      payload.subject = subject?.name ?? editing?.subject ?? ''
      payload.academic_session = session?.session_name ?? session?.name ?? editing?.academic_session ?? ''
    }
    if (activeMode.table === 'assignment_submissions') {
      const assignment = resolveOption('assignments', payload.assignment_id)
      const studentId = payload.student_id ?? user?.linkedStudentId
      const student = resolveOption('students', studentId)
      payload.student_id = studentId
      payload.assignment_title = assignment?.title ?? editing?.assignment_title ?? ''
      payload.student_name = student?.full_name ?? editing?.student_name ?? user?.fullName ?? 'Student'
      if (!editing && isStudent) payload.status = 'submitted'
    }
    if (activeMode.table === 'classroom_activity_participants') {
      payload.recorded_by = user?.id
    }
    if (activeMode.table === 'study_materials' && !selectedFile && !payload.external_url && editing?.storage_path) {
      payload.storage_path = editing.storage_path
      payload.file_name = editing.file_name
      payload.mime_type = editing.mime_type
      payload.file_size_bytes = editing.file_size_bytes
    }
    return payload
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !user || !canCreate) return
    setSaving(true)
    let uploadedPath: string | null = null
    try {
      const payload = buildPayload()
      payload.institution_id = user.institutionId
      if (activeMode.table === 'lesson_plans' || activeMode.table === 'learning_courses' || activeMode.table === 'learning_course_units' || activeMode.table === 'classroom_activities' || activeMode.table === 'academic_calendar_events') {
        if (!editing) payload.created_by = user.id
      }
      if (activeMode.table === 'academic_terms' || activeMode.table === 'class_teacher_assignments' || activeMode.table === 'assignments' || activeMode.table === 'assignment_submissions' || activeMode.table === 'timetable_entries' || activeMode.table === 'teacher_assignments' || activeMode.table === 'student_placements' || activeMode.table === 'curriculum_units') {
        if (!editing) payload.created_by = user.id
      }
      if (activeMode.table === 'curriculum_units') payload.updated_by = user.id
      if (activeMode.table === 'learning_progress') payload.recorded_by = user.id
      if (activeMode.table === 'learning_course_progress') payload.updated_by = user.id
      if (activeMode.table === 'study_materials') payload.uploaded_by = user.id

      if (selectedFile && activeMode.table === 'study_materials') {
        if (selectedFile.size > 25 * 1024 * 1024) throw new Error('The selected file exceeds the 25 MB limit.')
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100)
        uploadedPath = user.institutionId + '/academic/' + crypto.randomUUID() + '-' + safeName
        const { error: uploadError } = await supabase.storage.from('institution-files').upload(uploadedPath, selectedFile, {
          contentType: selectedFile.type || 'application/octet-stream', upsert: false,
        })
        if (uploadError) throw uploadError
        payload.storage_path = uploadedPath
        payload.file_name = selectedFile.name
        payload.mime_type = selectedFile.type || null
        payload.file_size_bytes = selectedFile.size
        payload.external_url = null
      }
      if (activeMode.table === 'learning_course_progress') {
        const { error } = await supabase.from(activeMode.table).upsert(payload, { onConflict: 'institution_id,course_id,unit_id,student_id' })
        if (error) throw error
      } else if (editing) {
        const { error } = await supabase.from(activeMode.table).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id).eq('institution_id', user.institutionId)
        if (error) throw error
      } else {
        const { error } = await supabase.from(activeMode.table).insert(payload)
        if (error) throw error
      }
      setShowEditor(false)
      setEditing(null)
      setSelectedFile(null)
      onToast(editing ? 'Academic record updated.' : 'Academic record saved.')
      await reload()
    } catch (error) {
      if (uploadedPath && supabase) await supabase.storage.from('institution-files').remove([uploadedPath])
      const message = error instanceof Error ? error.message : 'The academic record could not be saved.'
      onToast(message, true)
    } finally { setSaving(false) }
  }

  async function deleteRecord(row: RowData) {
    if (!supabase || !user || !canCreate) return
    if (!window.confirm('Delete this record? This action cannot be undone.')) return
    try {
      const { error } = await supabase.from(activeMode.table).delete().eq('id', row.id).eq('institution_id', user.institutionId)
      if (error) throw error
      if (activeMode.table === 'study_materials' && row.storage_path) {
        const { error: storageError } = await supabase.storage.from('institution-files').remove([row.storage_path])
        if (storageError) onToast('Record deleted, but the stored file could not be removed.', true)
      }
      onToast('Record deleted.')
      await reload()
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'The record could not be deleted.', true)
    }
  }

  async function openMaterial(row: RowData) {
    if (!supabase) return
    if (row.external_url) { window.open(row.external_url, '_blank', 'noopener,noreferrer'); return }
    if (!row.storage_path) return
    const { data, error } = await supabase.storage.from('institution-files').createSignedUrl(row.storage_path, 300)
    if (error || !data?.signedUrl) {
      onToast(error?.message ?? 'This resource could not be opened.', true)
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function toggleOnlineLearning() {
    if (!supabase || !user || !admins.includes(user.role)) return
    setPreferenceLoading(true)
    try {
      const next = !onlineLearningEnabled
      const { error } = await supabase.from('academic_preferences').upsert({
        institution_id: user.institutionId, online_learning_enabled: next, updated_by: user.id, updated_at: new Date().toISOString(),
      }, { onConflict: 'institution_id' })
      if (error) throw error
      setOnlineLearningEnabled(next)
      onToast(next ? 'Online learning is enabled for this institution.' : 'Online learning is disabled. Existing course data is preserved.')
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Online learning settings could not be updated.', true)
    } finally { setPreferenceLoading(false) }
  }

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(row => Object.values(row).some(value => String(value ?? '').toLowerCase().includes(term)))
  }, [rows, search])

  function labelValue(value: unknown, source?: OptionSource) {
    if (value === null || value === undefined || value === '') return '—'
    const found = resolveOption(source, value)
    if (found) return displayName(found)
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (Array.isArray(value)) return value.join(', ')
    return String(value)
  }

  function exportRows() {
    const visibleColumns = activeMode.columns
    const output = [
      visibleColumns.map(column => csvValue(column.label)).join(','),
      ...filteredRows.map(row => visibleColumns.map(column => csvValue(labelValue(row[column.key], column.source))).join(',')),
    ].join('\n')
    const url = URL.createObjectURL(new Blob([output], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'edusphere-' + activeMode.table + '-' + normalDate() + '.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function renderField(field: FieldSpec) {
    const raw = values[field.key]
    const common = { id: 'academic-' + field.key, required: field.required, value: field.type === 'boolean' ? undefined : String(raw ?? '') }
    return (
      <label className={'ed360-academic-field ' + (field.type === 'textarea' ? 'is-wide' : '')} key={field.key} htmlFor={common.id}>
        <span>{field.label}{field.required ? <b> *</b> : null}</span>
        {field.type === 'textarea' ? <textarea id={common.id} required={field.required} rows={3} value={String(raw ?? '')} onChange={event => setField(field.key,event.target.value)} placeholder={field.placeholder ?? ''}/> :
         field.type === 'select' ? <select id={common.id} required={field.required} value={String(raw ?? '')} onChange={event => setField(field.key,event.target.value)}>
           <option value="">Select {field.label.toLowerCase()}</option>
           {(field.source ? optionsFor(field.source) : field.options ?? []).filter(option => !(field.studentOnly && isStudent && user?.linkedStudentId && option.value !== user.linkedStudentId)).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
         </select> :
         field.type === 'boolean' ? <span className="ed360-academic-toggle"><input id={common.id} type="checkbox" checked={Boolean(raw)} onChange={event => setField(field.key,event.target.checked)}/><small>{Boolean(raw) ? 'Enabled' : 'Disabled'}</small></span> :
         <input id={common.id} type={field.type ?? 'text'} required={field.required} value={String(raw ?? '')} onChange={event => setField(field.key,event.target.value)} placeholder={field.placeholder ?? ''} min={field.type === 'number' ? '0' : undefined}/>}
      </label>
    )
  }

  function displayCell(row: RowData, column: ColumnSpec) {
    const value = row[column.key]
    if (column.key === 'storage_path' || column.key === 'external_url') return value ? 'Available' : '—'
    if (column.key.endsWith('_at') && value) return new Date(value).toLocaleString()
    return labelValue(value,column.source)
  }

  const canEditRow = () => canCreate && !(isStudent && activeMode.table !== 'assignment_submissions' && activeMode.table !== 'learning_course_progress')
  const totalActive = rows.filter(row => ['active','open','published','planned','in_progress'].includes(String(row.status ?? row.progress_status ?? '')) || row.is_active === true).length
  const completed = rows.filter(row => ['completed','graded'].includes(String(row.status ?? row.progress_status ?? ''))).length
  const needsSupport = rows.filter(row => row.intervention_required === true || row.progress_status === 'needs_support').length

  return (
    <main className="page-content ed360-module-page ed360-academic-page">
      <header className="ed360-academic-heading">
        <div className="ed360-academic-heading-copy">
          <span>STAGE 08 · ACADEMIC OPERATIONS</span>
          <h1>Academic Management & Learning</h1>
          <p>{section.description}</p>
        </div>
        <div className="ed360-academic-heading-tools">
          <span className="ed360-academic-live"><i/> Live institution records</span>
          <button className="ed360-academic-icon-button" type="button" onClick={() => void reload()} disabled={loading} aria-label="Refresh records"><RefreshCw size={16}/></button>
        </div>
      </header>

      <nav className="ed360-academic-nav" aria-label="Academic work areas">
        {academicSections.map((item,index) => {
          const Icon = item.icon
          return <button type="button" className={item.key === section.key ? 'active' : ''} key={item.key} onClick={() => {setActiveKey(item.key);setModeKey('');setSearch('');setShowEditor(false)}}>
            <span className="ed360-academic-nav-number">{String(index+1).padStart(2,'0')}</span><Icon size={17}/><span>{item.title}</span>{item.key === section.key ? <ChevronRight size={15}/> : null}
          </button>
        })}
      </nav>

      <section className="ed360-academic-workspace">
        <div className="ed360-academic-workspace-top">
          <div>
            <span className="ed360-academic-kicker">{section.short.toUpperCase()} WORKSPACE</span>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
          </div>
          {isOnlineLearning ? <div className="ed360-academic-online-control">
            <span className={onlineLearningEnabled ? 'is-on' : ''}>{onlineLearningEnabled ? 'Digital learning is active' : 'Digital learning is optional and inactive'}</span>
            {admins.includes(user?.role as AppRole) ? <button type="button" onClick={() => void toggleOnlineLearning()} disabled={preferenceLoading}>{preferenceLoading ? 'Saving…' : onlineLearningEnabled ? 'Disable online learning' : 'Enable online learning'}</button> : <small>{onlineLearningEnabled ? 'Enabled by your institution' : 'Not enabled by your institution'}</small>}
          </div> : null}
        </div>

        <div className="ed360-academic-mode-tabs" role="tablist" aria-label="Academic record types">
          {section.modes.map(mode => <button type="button" role="tab" aria-selected={activeMode.key === mode.key} className={activeMode.key === mode.key ? 'active' : ''} key={mode.key} onClick={() => {setModeKey(mode.key);setSearch('');setShowEditor(false)}}>{mode.title}</button>)}
        </div>
        <div className="ed360-academic-toolbar">
          <div className="ed360-academic-toolbar-copy"><strong>{activeMode.title}</strong><span>{activeMode.description}</span></div>
          <div className="ed360-academic-toolbar-actions">
            <label className="ed360-academic-search"><Search size={15}/><input aria-label="Search records" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search records…"/></label>
            <button type="button" className="ed360-academic-secondary" onClick={exportRows} disabled={!rows.length}><Download size={15}/> Export</button>
            <button type="button" className="ed360-academic-secondary" onClick={() => window.print()}><Printer size={15}/> Print</button>
            {canCreate ? <button type="button" className="ed360-academic-primary" onClick={openCreate}><Plus size={16}/> Add record</button> : null}
          </div>
        </div>

        {isOnlineLearning && !onlineLearningEnabled && !admins.includes(user?.role as AppRole) ?
          <div className="ed360-academic-locked"><LockKeyhole size={23}/><div><strong>Online learning is not enabled</strong><p>Your institution can continue using everyday academic management without digital courses. Ask the institution owner or administrator to activate this optional area.</p></div></div> :
          <div className="ed360-academic-metrics">
            <div><span><Layers3 size={17}/></span><small>Total records</small><strong>{rows.length}</strong></div>
            <div><span><Activity size={17}/></span><small>Active / in progress</small><strong>{totalActive}</strong></div>
            <div><span><CheckCircle2 size={17}/></span><small>Completed / graded</small><strong>{completed}</strong></div>
            <div><span><AlertCircle size={17}/></span><small>Needs attention</small><strong>{needsSupport}</strong></div>
          </div>
        }

        {errorMessage ? <div className="ed360-academic-error"><AlertCircle size={16}/><span>{errorMessage}</span><button type="button" onClick={() => void reload()}>Retry</button></div> : null}
        {loading ? <div className="ed360-academic-loading"><span className="ed360-academic-spinner"/><strong>Loading permitted records…</strong></div> :
          isOnlineLearning && !onlineLearningEnabled && !admins.includes(user?.role as AppRole) ? null :
          <div className="ed360-academic-table-wrap">
            <table className="ed360-academic-table">
              <thead><tr>{activeMode.columns.map(column => <th key={column.key}>{column.label}</th>)}<th className="action-column">Actions</th></tr></thead>
              <tbody>
                {filteredRows.map(row => <tr key={row.id}>
                  {activeMode.columns.map(column => <td key={column.key}>{column.key === 'status' || column.key === 'progress_status' || column.key === 'visibility' ?
                    <span className={'ed360-academic-status status-' + String(row[column.key] ?? '').toLowerCase().replace(/[^a-z0-9]+/g,'-')}>{displayCell(row,column)}</span> :
                    <span title={String(row[column.key] ?? '')}>{displayCell(row,column)}</span>}</td>)}
                  <td className="ed360-academic-row-actions">
                    {activeMode.table === 'study_materials' && (row.storage_path || row.external_url) ? <button type="button" aria-label="Open learning resource" title="Open resource" onClick={() => void openMaterial(row)}><ExternalLink size={15}/></button> : null}
                    {canEditRow() ? <button type="button" aria-label="Edit record" title="Edit record" onClick={() => openEdit(row)}><Pencil size={15}/></button> : null}
                    {canCreate && admins.includes(user?.role as AppRole) ? <button type="button" className="danger" aria-label="Delete record" title="Delete record" onClick={() => void deleteRecord(row)}><Trash2 size={15}/></button> : null}
                  </td>
                </tr>)}
                {!filteredRows.length ? <tr><td colSpan={activeMode.columns.length+1} className="ed360-academic-empty">
                  {rows.length ? 'No records match your search.' : 'No records yet. Use Add record to create the first entry for this area.'}
                </td></tr> : null}
              </tbody>
            </table>
          </div>
        }
        <footer className="ed360-academic-foot"><ShieldCheck size={14}/><span>Access is filtered by institution membership, assigned class and permitted role. Student and parent views are read-only unless a workflow explicitly permits a learner submission.</span><span>{filteredRows.length} shown</span></footer>
      </section>

      {showEditor ? <div className="ed360-academic-modal-backdrop" role="presentation" onMouseDown={event => {if(event.target===event.currentTarget)setShowEditor(false)}}>
        <section className="ed360-academic-modal" role="dialog" aria-modal="true" aria-labelledby="ed360-academic-form-title">
          <header><div><span>{editing ? 'UPDATE ACADEMIC RECORD' : 'NEW ACADEMIC RECORD'}</span><h2 id="ed360-academic-form-title">{editing ? 'Edit ' + activeMode.title : 'Add ' + activeMode.title}</h2><p>{activeMode.description}</p></div><button type="button" onClick={() => setShowEditor(false)} aria-label="Close form"><X size={18}/></button></header>
          <form onSubmit={saveRecord}>
            <div className="ed360-academic-form-grid">{visibleFields.map(renderField)}
              {activeMode.table === 'study_materials' ? <label className="ed360-academic-field is-wide"><span>Upload a file (optional, up to 25 MB)</span><span className="ed360-academic-file-input"><Upload size={17}/><input type="file" onChange={event => setSelectedFile(event.target.files?.[0] ?? null)} accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.mp4,.mp3"/></span>{selectedFile ? <small>{selectedFile.name} · {(selectedFile.size/1024/1024).toFixed(1)} MB</small> : <small>Alternatively, provide an external resource URL above.</small>}</label> : null}
            </div>
            <div className="ed360-academic-form-footer"><button type="button" className="ed360-academic-secondary" onClick={() => setShowEditor(false)} disabled={saving}>Cancel</button><button type="submit" className="ed360-academic-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save record'}</button></div>
          </form>
        </section>
      </div> : null}
    </main>
  )
}
