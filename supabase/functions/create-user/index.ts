import { createClient } from 'npm:@supabase/supabase-js@2'

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
      await admin.from('teachers').update({ user_id: newUserId }).eq('institution_id', institutionId).ilike('email', email)
    }

    return json({ success: true, userId: newUserId, role, email })
  } catch (error) {
    if (newUserId) await admin.auth.admin.deleteUser(newUserId)
    return json({ error: error instanceof Error ? error.message : 'Account creation failed.' }, 400)
  }
})
