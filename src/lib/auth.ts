import type { AppRole, AppUser, InstitutionChoice } from './types'
import { supabase } from './supabase'

export async function listCloudInstitutionChoices(userId: string): Promise<InstitutionChoice[]> {
  if (!supabase) throw new Error('Cloud mode is not configured.')
  const { data, error } = await supabase.from('memberships')
    .select('institution_id,role,created_at,institutions(name,institution_type)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((membership) => {
    const institution = membership.institutions as unknown as { name?: string; institution_type?: string } | null
    return {
      institutionId: String(membership.institution_id),
      institutionName: institution?.name ?? 'Institution',
      institutionType: institution?.institution_type ?? undefined,
      role: membership.role as AppRole,
      createdAt: membership.created_at ?? undefined,
    }
  })
}

export async function getCloudUserContext(userId: string, selectedInstitutionId?: string): Promise<AppUser> {
  if (!supabase) throw new Error('Cloud mode is not configured. Add the Supabase URL and publishable key to .env.local.')
  let institutionId = selectedInstitutionId
  if (!institutionId) {
    const choices = await listCloudInstitutionChoices(userId)
    if (choices.length === 0) throw new Error('This login has no active institution account. Verify your invitation or ask your institution administrator to activate your account.')
    if (choices.length > 1) throw new Error('Choose which institution you want to open.')
    institutionId = choices[0].institutionId
  }

  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('full_name,email').eq('id', userId).maybeSingle()
  if (profileError) throw profileError

  const { data: membership, error: membershipError } = await supabase.from('memberships')
    .select('institution_id,role,institutions(name,institution_type)')
    .eq('user_id', userId).eq('institution_id', institutionId).eq('status', 'active').maybeSingle()
  if (membershipError) throw membershipError
  if (!membership) throw new Error('This account is not active in the selected institution. Ask its administrator for access.')

  const institution = membership.institutions as unknown as { name: string; institution_type?: string } | null
  const role = membership.role as AppRole
  let linkedStudentId: string | null = null
  if (role === 'student') {
    const { data: student } = await supabase.from('students').select('id')
      .eq('user_id', userId).eq('institution_id', institutionId).maybeSingle()
    linkedStudentId = student?.id ?? null
  } else if (role === 'parent') {
    const { data: guardianLink } = await supabase.from('student_guardians').select('student_id')
      .eq('parent_user_id', userId).eq('institution_id', institutionId).limit(1).maybeSingle()
    linkedStudentId = guardianLink?.student_id ?? null
  }
  return {
    id: userId,
    email: profile?.email ?? '',
    fullName: profile?.full_name ?? 'User',
    role,
    institutionId,
    institutionName: institution?.name ?? 'Institution',
    institutionType: institution?.institution_type ?? undefined,
    linkedStudentId,
  }
}

export async function cloudSignIn(email: string, password: string): Promise<{ userId: string }> {
  if (!supabase) throw new Error('Cloud mode is not configured. Add your Supabase settings first.')
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) {
    const message = \`\${error.message} \${'code' in error ? String(error.code ?? '') : ''}\`.toLowerCase()
    if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) {
      throw new Error('Please verify your email before logging in. Open the confirmation email we sent, then return here to sign in.')
    }
    throw error
  }
  if (!data.user) throw new Error('Sign-in did not return a user.')
  return { userId: data.user.id }
}

export async function cloudCreateAccount(input: {
  fullName: string
  email: string
  password?: string
  role: AppRole
  institutionId: string
  linkedStudentId?: string
  sendInvitation?: boolean
}) {
  if (!supabase) throw new Error('Cloud mode is not configured.')
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: {
      fullName: input.fullName,
      email: input.email.trim().toLowerCase(),
      password: input.sendInvitation ? undefined : input.password,
      role: input.role,
      institutionId: input.institutionId,
      linkedStudentId: input.linkedStudentId || null,
      sendInvitation: input.sendInvitation === true,
    },
  })
  if (error) throw error
  return data
}

export async function listCloudAccounts(institutionId: string) {
  if (!supabase) throw new Error('Cloud mode is not configured.')
  const { data: memberships, error: membershipError } = await supabase.from('memberships')
    .select('user_id,role,status,created_at').eq('institution_id', institutionId)
    .order('created_at', { ascending: false })
  if (membershipError) throw membershipError
  const ids = (memberships ?? []).map((item) => item.user_id as string)
  if (!ids.length) return []
  const { data: profiles, error: profileError } = await supabase.from('profiles')
    .select('id,full_name,email').in('id', ids)
  if (profileError) throw profileError
  const byId = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]))
  return (memberships ?? []).map((membership) => {
    const profile = byId.get(membership.user_id as string)
    return {
      id: membership.user_id,
      fullName: profile?.full_name ?? 'User',
      email: profile?.email ?? '',
      role: membership.role as AppRole,
      status: membership.status,
      created_at: membership.created_at,
    }
  })
}

export type OwnerRegistrationResult =
  | { verificationRequired: true; email: string }
  | { verificationRequired: false; user: AppUser }

function getEmailConfirmationRedirectUrl() {
  // Production and preview origins must be allowlisted in Supabase Auth URL Configuration.
  return \`\${window.location.origin}/\`
}

export async function cloudRegisterInstitutionOwner(input: {
  fullName: string
  email: string
  password: string
  institutionName: string
  institutionType: 'school' | 'college' | 'university' | 'multi_institution'
  country: string
  location: string
  phone: string
}): Promise<OwnerRegistrationResult> {
  if (!supabase) throw new Error('Online registration is unavailable because cloud mode is not configured.')
  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim()
  const institutionName = input.institutionName.trim()
  const country = input.country.trim()
  const location = input.location.trim()
  const phone = input.phone.trim()
  if (!fullName || !institutionName || !country || !location || !phone) {
    throw new Error('Complete your name, institution, country, location and contact phone before continuing.')
  }
  if (!['school', 'college', 'university', 'multi_institution'].includes(input.institutionType)) {
    throw new Error('Select a valid institution type.')
  }

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
        institution_country: country,
        institution_location: location,
        institution_contact_phone: phone,
      },
    },
  })

  if (error) throw error
  if (!data.user) throw new Error('EduSphere 360 could not create the account. Please try again.')
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('An account using this email may already exist. Try logging in or use a different email address.')
  }
  if (!data.session) return { verificationRequired: true, email }

  try {
    const choices = await listCloudInstitutionChoices(data.user.id)
    if (choices.length !== 1) throw new Error('The new owner institution could not be resolved.')
    const user = await getCloudUserContext(data.user.id, choices[0].institutionId)
    return { verificationRequired: false, user }
  } catch {
    await supabase.auth.signOut()
    throw new Error('Your email was accepted, but the institution workspace is not ready yet. Please contact support before trying to register again.')
  }
}

export async function resendInstitutionOwnerVerification(email: string): Promise<void> {
  if (!supabase) throw new Error('Online email verification is unavailable because cloud mode is not configured.')
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: getEmailConfirmationRedirectUrl() },
  })
  if (error) throw error
}

export async function requestCloudPasswordReset(email: string): Promise<void> {
  if (!supabase) throw new Error('Online password recovery is unavailable because cloud mode is not configured.')
  const address = email.trim().toLowerCase()
  if (!address) throw new Error('Enter the email address for your EduSphere 360 account.')
  const { error } = await supabase.auth.resetPasswordForEmail(address, {
    redirectTo: getEmailConfirmationRedirectUrl(),
  })
  if (error) throw error
}
