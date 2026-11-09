import { supabase } from './supabase'
import { listCloudAccounts } from './auth'
import type { AppMode, AppUser, RecordRow } from './types'


function localDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// These are the application tables intentionally exposed to the generic CRUD layer.
// Fee payments are excluded: they must be created through the atomic SQL RPC.
const ALLOWED_TABLES = new Set([
  'students',
  'teachers',
  'attendance',
  'exams',
  'exam_results',
  'fee_invoices',
  'assignments',
  'assignment_submissions',
  'work_tasks',
  'announcements',
  'timetable_entries',
  'departments',
  'programs',
  'academic_sessions',
  'classes',
  'subjects',
  'rooms',
])

function checkTable(table: string) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Unsupported data module: ${table}`)
}

function requireInstitution(user: AppUser) {
  if (!user?.id || !user.institutionId) {
    throw new Error('Your institution session is incomplete. Sign out and sign in again.')
  }
}

// Ensure the in-memory app context is the same actor as the live Supabase session.
// This gives a clear error before an RLS insert fails with an opaque 403.
async function verifyCloudActor(user: AppUser): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.')
  requireInstitution(user)

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const authUser = authData.user
  if (!authUser) throw new Error('Your cloud session has expired. Sign in again.')
  if (authUser.id !== user.id) {
    throw new Error('The signed-in cloud account does not match the active workspace. Sign out and sign in again.')
  }

  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('role,status')
    .eq('institution_id', user.institutionId)
    .eq('user_id', authUser.id)
    .eq('status', 'active')
    .maybeSingle()
  if (membershipError) throw membershipError
  if (!membership) {
    throw new Error('Your account has no active membership in this institution. Ask the institution owner to reactivate it.')
  }
  if (membership.role !== user.role) {
    throw new Error('Your institution role has changed. Sign out and sign in again to refresh permissions.')
  }
  return authUser.id
}

async function filterRowsForRole(
  mode: AppMode,
  user: AppUser,
  table: string,
  rows: RecordRow[],
): Promise<RecordRow[]> {
  if (table === 'work_tasks' && !['owner', 'admin'].includes(user.role)) {
    return rows.filter(
      (row) => String(row.assigned_to_email ?? '').trim().toLowerCase() === user.email.toLowerCase(),
    )
  }

  if (!['student', 'parent'].includes(user.role)) return rows

  if (table === 'announcements') {
    const audience = user.role === 'student' ? 'students' : 'parents'
    return rows.filter((row) => row.audience === 'all' || row.audience === audience)
  }

  if (!user.linkedStudentId) return []
  if (table === 'students') return rows.filter((row) => row.id === user.linkedStudentId)

  if (table === 'exam_results') {
    return rows.filter((row) => row.student_id === user.linkedStudentId && row.result_status === 'published')
  }

  if (table === 'assignment_submissions' || ['attendance', 'exam_results', 'fee_invoices'].includes(table)) {
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
  void mode
  checkTable(table)
  requireInstitution(user)

  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('institution_id', user.institutionId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return filterRowsForRole(mode, user, table, (data ?? []) as RecordRow[])
}

export async function createRecord(
  mode: AppMode,
  user: AppUser,
  table: string,
  payload: Record<string, unknown>,
): Promise<RecordRow | null> {
  void mode
  checkTable(table)
  requireInstitution(user)
  const actorId = await verifyCloudActor(user)
  const insertPayload = { ...payload, institution_id: user.institutionId, created_by: actorId }

  if (table === 'students') {
    if (!['owner', 'admin'].includes(user.role)) {
      throw new Error('Only the institution owner or an administrator can register a new student.')
    }

    // Use the exact authorization helper enforced by the students INSERT policy.
    // This diagnoses a stale/mismatched institution session before any write.
    const { data: canManageStudents, error: permissionError } = await supabase!.rpc('has_institution_role', {
      target_institution: user.institutionId,
      allowed_roles: ['owner', 'admin'],
    })
    if (permissionError) {
      throw new Error('EduSphere could not verify your owner/administrator access for this institution. No student record was submitted. Refresh your sign-in and try again.')
    }
    if (canManageStudents !== true) {
      throw new Error('Your current sign-in is not recognised as an active owner or administrator for this institution. No student record was submitted. Sign out and sign in again with the correct institution account.')
    }

    // Do not request INSERT ... RETURNING for student admission. PostgREST
    // applies the separate SELECT policy to returned rows; the client confirms
    // visibility by reloading the institution directory after this minimal insert.
    const { error } = await supabase!.from(table).insert(insertPayload)
    if (error) throw error
    return null
  }

  const { data, error } = await supabase!
    .from(table)
    .insert(insertPayload)
    .select()
    .single()
  if (error) throw error
  if (!data) throw new Error('The database did not confirm that this record was saved.')
  return data as RecordRow
}

export async function updateRecord(
  mode: AppMode,
  user: AppUser,
  table: string,
  id: string,
  payload: Record<string, unknown>,
) {
  void mode
  checkTable(table)
  requireInstitution(user)
  await verifyCloudActor(user)
  const { data, error } = await supabase!
    .from(table)
    .update(payload)
    .eq('id', id)
    .eq('institution_id', user.institutionId)
    .select()
    .single()
  if (error) throw error
  if (!data) throw new Error('No matching record was updated. Check your access and try again.')
  return data as RecordRow
}

export async function deleteRecord(mode: AppMode, user: AppUser, table: string, id: string) {
  void mode
  checkTable(table)
  requireInstitution(user)
  await verifyCloudActor(user)
  const { data, error } = await supabase!
    .from(table)
    .delete()
    .eq('id', id)
    .eq('institution_id', user.institutionId)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('No matching record was deleted. It may already be removed or your access may have changed.')
}

export async function listFeePayments(mode: AppMode, user: AppUser, invoiceId: string) {
  void mode
  requireInstitution(user)
  if (!supabase) throw new Error('Supabase is not configured.')
  await verifyCloudActor(user)
  const { data, error } = await supabase
    .from('fee_payments')
    .select('*')
    .eq('institution_id', user.institutionId)
    .eq('invoice_id', invoiceId)
    .order('payment_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as RecordRow[]
}

export async function recordFeePayment(
  mode: AppMode,
  user: AppUser,
  input: {
    invoiceId: string
    amount: number
    paymentMethod: string
    paymentReference?: string
    paymentDate?: string
    notes?: string
  },
) {
  void mode
  requireInstitution(user)
  if (!['owner', 'admin', 'accountant'].includes(user.role)) {
    throw new Error('Only the owner, administrator or accountant can record fee payments.')
  }
  await verifyCloudActor(user)
  const { data, error } = await supabase!.rpc('record_fee_payment', {
    p_invoice_id: input.invoiceId,
    p_amount: input.amount,
    p_payment_method: input.paymentMethod,
    p_payment_reference: input.paymentReference?.trim() || null,
    p_payment_date: input.paymentDate || localDateString(),
    p_notes: input.notes?.trim() || null,
  })
  if (error) throw error
  const result = Array.isArray(data) ? data[0] : data
  if (!result) throw new Error('The database did not confirm that the fee payment was recorded.')
  return result as {
    payment_id: string
    receipt_no: string
    invoice_id: string
    paid_amount: number
    balance: number
    invoice_status: string
  }
}

export async function listAccounts(mode: AppMode, user: AppUser) {
  void mode
  requireInstitution(user)
  await verifyCloudActor(user)
  return listCloudAccounts(user.institutionId)
}
