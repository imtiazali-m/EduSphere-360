import { createClient } from 'npm:@supabase/supabase-js@2'
import { escapeIlikeLiteral, isVerifiedTeacherLink, resolveTeacherEmployee } from './provisioning-guards.mjs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  const authorization = request.headers.get('Authorization')
  if (!authorization) return json({ error: 'Sign in as an administrator first.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const publishableRaw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')
  const publishableKeys = publishableRaw ? JSON.parse(publishableRaw) : {}
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? publishableKeys.default
  const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS')
  const secretKeys = secretKeysRaw ? JSON.parse(secretKeysRaw) : {}
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? secretKeys.default
  if (!supabaseUrl || !publishableKey || !serviceKey) return json({ error: 'Server-side Supabase credentials are not configured.' }, 500)

  const caller = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } }, auth: { autoRefreshToken: false, persistSession: false } })
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  let newUserId: string | null = null
  let teacherRecordId: string | null = null

  try {
    const { data: callerData, error: callerError } = await caller.auth.getUser()
    if (callerError || !callerData.user) return json({ error: 'Your session is invalid. Sign in again.' }, 401)
    const body = await request.json()
    const fullName = String(body.fullName ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const role = String(body.role ?? '')
    const institutionId = String(body.institutionId ?? '')
    const linkedStudentId = body.linkedStudentId ? String(body.linkedStudentId) : null
    const allowedRoles = ['admin','teacher','student','parent','accountant','exam_officer']
    if (!fullName || !email || password.length < 10 || !institutionId || !allowedRoles.includes(role)) {
      return json({ error: 'Check the name, email, password, institution and role.' }, 400)
    }

    const { data: callerMembership, error: membershipLookupError } = await admin.from('memberships')
      .select('id,role').eq('user_id', callerData.user.id).eq('institution_id', institutionId).eq('status','active').maybeSingle()
    if (membershipLookupError) throw membershipLookupError
    if (!callerMembership || !['owner','admin'].includes(callerMembership.role)) return json({ error: 'Only an institution owner or administrator can create accounts.' }, 403)
    if (role === 'admin' && callerMembership.role !== 'owner') return json({ error: 'Only the institution owner can appoint another administrator.' }, 403)

    if (['student','parent'].includes(role) && !linkedStudentId) return json({ error: 'A student or parent account must be linked to a student record.' }, 400)

    if (linkedStudentId) {
      const { data: linkedStudent, error: studentError } = await admin.from('students').select('id').eq('id', linkedStudentId).eq('institution_id', institutionId).maybeSingle()
      if (studentError) throw studentError
      if (!linkedStudent) return json({ error: 'The selected student does not belong to this institution.' }, 400)
    }

    // Resolve the employee identity before creating an Auth user. A teacher
    // login without its matching institution employee record is not valid.
    if (role === 'teacher') {
      const { data: teacherCandidates, error: teacherLookupError } = await admin.from('teachers')
        .select('id,email,user_id')
        .eq('institution_id', institutionId)
        .ilike('email', escapeIlikeLiteral(email))
        .limit(2)
      if (teacherLookupError) throw teacherLookupError

      const teacherResolution = resolveTeacherEmployee(teacherCandidates ?? [], email)
      if (!teacherResolution.ok) {
        const messages = {
          invalid_email: 'Enter a valid email address for the teacher account. No account was created.',
          employee_not_found: 'Register and save this employee in Faculty & Employee Management using the same email address before creating the teacher login. No account was created.',
          employee_ambiguous: 'More than one employee record matches this email. Resolve the duplicate employee records before creating a teacher login. No account was created.',
          employee_already_linked: 'This employee already has a linked login account. Review the existing account instead of creating another one.',
          employee_invalid: 'The matching employee record is incomplete. Review the employee record before creating a teacher login.',
        }
        return json({ error: messages[teacherResolution.reason] ?? 'The employee identity could not be verified. No account was created.' }, 409)
      }
      teacherRecordId = teacherResolution.teacherId
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } })
    if (createError) throw createError
    if (!created.user) throw new Error('Supabase did not return the new account.')
    newUserId = created.user.id

    const { error: profileError } = await admin.from('profiles').insert({ id: newUserId, full_name: fullName, email })
    if (profileError) throw profileError
    const { error: addMembershipError } = await admin.from('memberships').insert({ institution_id: institutionId, user_id: newUserId, role, status: 'active' })
    if (addMembershipError) throw addMembershipError

    if (linkedStudentId && role === 'student') {
      const { data: linked, error } = await admin.from('students').update({ user_id: newUserId })
        .eq('id', linkedStudentId).eq('institution_id', institutionId).is('user_id', null).select('id').maybeSingle()
      if (error) throw error
      if (!linked) throw new Error('This student record already has a login account. Choose a different student record.')
    }
    if (linkedStudentId && role === 'parent') {
      const { error } = await admin.from('student_guardians').insert({ institution_id: institutionId, student_id: linkedStudentId, parent_user_id: newUserId })
      if (error) throw error
    }
    if (role === 'teacher') {
      if (!teacherRecordId) throw new Error('The employee identity was not reserved for this teacher login.')
      const { data: linkedEmployees, error: teacherLinkError } = await admin.from('teachers').update({ user_id: newUserId })
        .eq('id', teacherRecordId)
        .eq('institution_id', institutionId)
        .is('user_id', null)
        .select('id,user_id')
      if (teacherLinkError) throw teacherLinkError
      if (!isVerifiedTeacherLink(linkedEmployees, teacherRecordId, newUserId)) {
        throw new Error('The employee record was linked by another request or changed during account creation. The new login will be rolled back; refresh the employee directory before trying again.')
      }
    }

    return json({ success: true, userId: newUserId, role, email, employeeRecordId: teacherRecordId })
  } catch (error) {
    let cleanupFailed = false
    if (newUserId) {
      const { error: cleanupError } = await admin.auth.admin.deleteUser(newUserId)
      cleanupFailed = Boolean(cleanupError)
      if (cleanupError) console.error('create-user could not confirm account rollback:', cleanupError.message)
    }
    if (cleanupFailed) {
      return json({
        error: 'Account provisioning failed and automatic cleanup could not be confirmed. Ask an administrator to review the account before retrying.',
      }, 500)
    }
    return json({ error: error instanceof Error ? error.message : 'Account creation failed.' }, 400)
  }
})
