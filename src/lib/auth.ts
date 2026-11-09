import type { AppRole, AppUser } from './types'
import { supabase } from './supabase'

export async function getCloudUserContext(userId: string): Promise<AppUser> {
  if (!supabase) throw new Error('Cloud mode is not configured. Add the Supabase URL and publishable key to .env.local.')
  const { data: profile, error: profileError } = await supabase.from('profiles').select('full_name,email').eq('id', userId).maybeSingle()
  if (profileError) throw profileError
  const { data: membership, error: membershipError } = await supabase
    .from('memberships').select('institution_id,role,institutions(name,institution_type)')
    .eq('user_id', userId).eq('status', 'active').limit(1).maybeSingle()
  if (membershipError) throw membershipError
  if (!membership) throw new Error('This login has no active institution account. Ask your administrator to create or activate your account.')
  const institution = membership.institutions as unknown as { name: string; institution_type?: string } | null
  const role = membership.role as AppRole
  let linkedStudentId: string | null = null
  if (role === 'student') {
    const { data: student } = await supabase.from('students').select('id').eq('user_id', userId).eq('institution_id', membership.institution_id).maybeSingle()
    linkedStudentId = student?.id ?? null
  } else if (role === 'parent') {
    const { data: guardianLink } = await supabase.from('student_guardians').select('student_id').eq('parent_user_id', userId).eq('institution_id', membership.institution_id).limit(1).maybeSingle()
    linkedStudentId = guardianLink?.student_id ?? null
  }
  return {
    id: userId,
    email: profile?.email ?? '',
    fullName: profile?.full_name ?? 'User',
    role,
    institutionId: membership.institution_id,
    institutionName: institution?.name ?? 'Institution',
    institutionType: institution?.institution_type ?? undefined,
    linkedStudentId,
  }
}

export async function cloudSignIn(email: string, password: string) {
  if (!supabase) throw new Error('Cloud mode is not configured. Add your Supabase settings first.')
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) {
    const message = `${error.message} ${'code' in error ? String(error.code ?? '') : ''}`.toLowerCase()
    if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) {
      throw new Error('Please verify your email before logging in. Open the confirmation email we sent after registration, then return here to sign in.')
    }
    throw error
  }
  if (!data.user) throw new Error('Sign-in did not return a user.')
  try {
    return await getCloudUserContext(data.user.id)
  } catch (error) {
    await supabase.auth.signOut()
    throw error
  }
}

export async function cloudCreateAccount(input: {
  fullName: string; email: string; password: string; role: AppRole; institutionId: string; linkedStudentId?: string
}) {
  if (!supabase) throw new Error('Cloud mode is not configured.')
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: {
      fullName: input.fullName,
      email: input.email.trim().toLowerCase(),
      password: input.password,
      role: input.role,
      institutionId: input.institutionId,
      linkedStudentId: input.linkedStudentId || null,
    },
  })
  if (error) throw error
  return data
}

export async function listCloudAccounts(institutionId: string) {
  if (!supabase) throw new Error('Cloud mode is not configured.')
  const { data: memberships, error: membershipError } = await supabase.from('memberships')
    .select('user_id,role,status,created_at').eq('institution_id', institutionId).order('created_at', { ascending: false })
  if (membershipError) throw membershipError
  const ids = (memberships ?? []).map((item) => item.user_id as string)
  if (!ids.length) return []
  const { data: profiles, error: profileError } = await supabase.from('profiles').select('id,full_name,email').in('id', ids)
  if (profileError) throw profileError
  const byId = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]))
  return (memberships ?? []).map((membership) => {
    const profile = byId.get(membership.user_id as string)
    return { id: membership.user_id, fullName: profile?.full_name ?? 'User', email: profile?.email ?? '', role: membership.role as AppRole, status: membership.status, created_at: membership.created_at }
  })
}


/** Public self-service registration creates a NEW institution tenant.
 * With email confirmation enabled, the account is created without a session.
 * The owner membership stays invited until the auth.users confirmation trigger
 * activates it. No visitor is attached to an existing institution.
 */
export type OwnerRegistrationResult =
  | { verificationRequired: true; email: string }
  | { verificationRequired: false; user: AppUser }

function getEmailConfirmationRedirectUrl() {
  // The site origin must be present in Supabase Authentication > URL Configuration.
  // Supabase JS detects the returned confirmation session on this page load.
  return `${window.location.origin}/`
}

export async function cloudRegisterInstitutionOwner(input: { fullName: string; email: string; password: string; institutionName: string; institutionType: 'school' | 'college' | 'university' | 'multi_institution' }): Promise<OwnerRegistrationResult> {
  if (!supabase) throw new Error('Online registration is unavailable because cloud mode is not configured.')
  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim()
  const institutionName = input.institutionName.trim()
  if (!fullName || !institutionName) throw new Error('Enter both your full name and institution name.')
  if (!['school', 'college', 'university', 'multi_institution'].includes(input.institutionType)) throw new Error('Select a valid institution type.')

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: getEmailConfirmationRedirectUrl(),
      data: {
        edusphere_signup: 'institution_owner',
        full_name: fullName,
        institution_name: institutionName,
        institution_type: input.institutionType,
      },
    },
  })

  if (error) throw error
  if (!data.user) throw new Error('EduSphere 360 could not create the account. Please try again.')

  // Supabase may return an obfuscated user with no identities when an email is
  // already registered. Do not falsely tell the visitor a new email was sent.
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('An account using this email may already exist. Try logging in or use a different email address.')
  }

  if (!data.session) {
    return { verificationRequired: true, email }
  }

  try {
    const user = await getCloudUserContext(data.user.id)
    return { verificationRequired: false, user }
  } catch (error) {
    await supabase.auth.signOut()
    // Never surface database/provider diagnostics in the public registration UI.
    // Keep the actionable recovery step; internal diagnostics stay in server logs.
    throw new Error('Your email was accepted, but the institution workspace is not ready yet. Please contact support before trying to register again.')
  }
}

/** Resend the signup confirmation email for a pending institution owner. */
export async function resendInstitutionOwnerVerification(email: string): Promise<void> {
  if (!supabase) throw new Error('Online email verification is unavailable because cloud mode is not configured.')
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: getEmailConfirmationRedirectUrl() },
  })
  if (error) throw error
}


/** Send a self-service password recovery email. */
export async function requestCloudPasswordReset(email: string): Promise<void> {
  if (!supabase) throw new Error('Online password recovery is unavailable because cloud mode is not configured.')
  const address = email.trim().toLowerCase()
  if (!address) throw new Error('Enter the email address for your EduSphere 360 account.')
  const { error } = await supabase.auth.resetPasswordForEmail(address, {
    redirectTo: getEmailConfirmationRedirectUrl(),
  })
  if (error) throw error
}
