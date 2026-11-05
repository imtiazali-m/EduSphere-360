import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bootstrap-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const configuredSecret = Deno.env.get('EDU_BOOTSTRAP_SECRET')
  const suppliedSecret = request.headers.get('x-bootstrap-secret')
  if (!configuredSecret || !suppliedSecret || suppliedSecret !== configuredSecret) {
    return json({ error: 'Invalid or missing one-time setup secret.' }, 403)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS')
  const secretKeys = secretKeysRaw ? JSON.parse(secretKeysRaw) : {}
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? secretKeys.default
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server-side Supabase credentials are not configured.' }, 500)

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return json({ error: 'Request body must be valid JSON.' }, 400) }
  const institutionName = String(body.institutionName ?? '').trim()
  const institutionType = String(body.institutionType ?? 'school')
  const fullName = String(body.fullName ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  if (!institutionName || !fullName || !email || password.length < 10) return json({ error: 'Complete all fields and use a password of at least 10 characters.' }, 400)
  if (!['school','college','university','multi_institution'].includes(institutionType)) return json({ error: 'Invalid institution type.' }, 400)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: claimed, error: claimError } = await admin.rpc('claim_edu_bootstrap')
  if (claimError) return json({ error: `Could not verify one-time setup state: ${claimError.message}` }, 500)
  if (!claimed) return json({ error: 'The initial institution setup has already been claimed or completed. Ask an existing administrator to create your account.' }, 409)

  let createdUserId: string | null = null
  let createdInstitutionId: string | null = null

  try {

    const { data: existing, error: existingError } = await admin.from('institutions').select('id').limit(1)
    if (existingError) throw existingError
    if (existing && existing.length > 0) {
      await admin.rpc('complete_edu_bootstrap')
      return json({ error: 'The initial institution has already been created. Ask an existing administrator to create your account.' }, 409)
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } })
    if (authError) throw authError
    if (!authData.user) throw new Error('Supabase did not return the new account.')
    createdUserId = authData.user.id

    const { data: institution, error: institutionError } = await admin.from('institutions').insert({ name: institutionName, institution_type: institutionType, created_by: createdUserId }).select('id').single()
    if (institutionError) throw institutionError
    createdInstitutionId = institution.id

    const { error: profileError } = await admin.from('profiles').insert({ id: createdUserId, full_name: fullName, email })
    if (profileError) throw profileError
    const { error: membershipError } = await admin.from('memberships').insert({ institution_id: createdInstitutionId, user_id: createdUserId, role: 'owner', status: 'active' })
    if (membershipError) throw membershipError

    const { data: completed, error: completeError } = await admin.rpc('complete_edu_bootstrap')
    if (completeError || !completed) throw completeError ?? new Error('Could not finalize institution setup.')
    return json({ success: true, message: 'Institution owner created. Sign in using the new account.' })
  } catch (error) {
    if (createdInstitutionId) await admin.from('institutions').delete().eq('id', createdInstitutionId)
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId)
    await admin.rpc('release_edu_bootstrap')
    const message = error instanceof Error ? error.message : 'Setup failed.'
    return json({ error: message }, 400)
  }
})
