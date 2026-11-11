export type AppRole = 'owner' | 'admin' | 'teacher' | 'student' | 'parent' | 'accountant' | 'exam_officer'
export type AppMode = 'cloud'

export type AuthLinkMode = 'recovery' | 'invite'

export interface InstitutionChoice {
  institutionId: string
  institutionName: string
  institutionType?: string
  role: AppRole
  createdAt?: string
}

export interface AppUser {
  id: string
  email: string
  fullName: string
  role: AppRole
  institutionId: string
  institutionName: string
  institutionType?: string
  linkedStudentId?: string | null
}

export interface RecordRow {
  id: string
  institution_id: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface FieldConfig {
  name: string
  label: string
  type?: 'text' | 'email' | 'date' | 'number' | 'select' | 'textarea' | 'time'
  required?: boolean
  readOnly?: boolean
  options?: { label: string; value: string }[]
  placeholder?: string
}

export interface ModuleConfig {
  key: string
  title: string
  description: string
  table: string
  icon: string
  roles: AppRole[]
  fields: FieldConfig[]
  columns: { key: string; label: string }[]
}
