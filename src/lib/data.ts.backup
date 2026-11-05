import { supabase } from './supabase'
import { listLocalAccounts } from './localDb'
import { listCloudAccounts } from './auth'
import { createRecordLocal, deleteRecordLocal, listRecordsLocal, updateRecordLocal } from './localDb'
import type { AppMode, AppUser, RecordRow } from './types'

const ALLOWED_TABLES = new Set([
  'students', 'teachers', 'attendance', 'faculty_attendance', 'departments', 'institution_classes', 'academic_sessions', 'subjects', 'institution_rooms', 'exams', 'exam_results', 'fee_invoices', 'assignments', 'announcements', 'timetable_entries',
])

function checkTable(table: string) {
  if (!ALLOWED_TABLES.has(table)) throw new Error('Unsupported data module.')
}

async function filterRowsForRole(mode: AppMode, user: AppUser, table: string, rows: RecordRow[]) {
  if (!['student', 'parent'].includes(user.role)) return rows
  if (table === 'announcements') {
    const audience = user.role === 'student' ? 'students' : 'parents'
    return rows.filter((row) => row.audience === 'all' || row.audience === audience)
  }
  if (!user.linkedStudentId) return []
  if (table === 'students') return rows.filter((row) => row.id === user.linkedStudentId)
  if (['attendance', 'exam_results', 'fee_invoices'].includes(table)) {
    return rows.filter((row) => row.student_id === user.linkedStudentId)
  }
  if (['exams', 'assignments', 'timetable_entries'].includes(table)) {
    const linkedStudents = await listRecords(mode, user, 'students')
    const className = linkedStudents[0]?.class_name
    return className ? rows.filter((row) => row.class_name === className) : []
  }
  return rows
}

export async function listRecords(mode: AppMode, user: AppUser, table: string): Promise<RecordRow[]> {
  checkTable(table)
  if (mode === 'local') {
    const rows = await listRecordsLocal(table, user.institutionId)
    return filterRowsForRole(mode, user, table, rows)
  }
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.from(table).select('*').eq('institution_id', user.institutionId).order('created_at', { ascending: false })
  if (error) throw error
  return filterRowsForRole(mode, user, table, (data ?? []) as RecordRow[])
}

export async function createRecord(mode: AppMode, user: AppUser, table: string, payload: Record<string, unknown>) {
  checkTable(table)
  if (mode === 'local') return createRecordLocal(table, user.institutionId, payload)
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.from(table).insert({ ...payload, institution_id: user.institutionId, created_by: user.id }).select().single()
  if (error) throw error
  return data as RecordRow
}

export async function updateRecord(mode: AppMode, user: AppUser, table: string, id: string, payload: Record<string, unknown>) {
  checkTable(table)
  if (mode === 'local') return updateRecordLocal(id, user.institutionId, table, payload)
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.from(table).update(payload).eq('id', id).eq('institution_id', user.institutionId).select().single()
  if (error) throw error
  return data as RecordRow
}

export async function deleteRecord(mode: AppMode, user: AppUser, table: string, id: string) {
  checkTable(table)
  if (mode === 'local') return deleteRecordLocal(id, user.institutionId, table)
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from(table).delete().eq('id', id).eq('institution_id', user.institutionId)
  if (error) throw error
}

export async function listAccounts(mode: AppMode, user: AppUser) {
  if (mode === 'local') return listLocalAccounts(user.institutionId)
  return listCloudAccounts(user.institutionId)
}
