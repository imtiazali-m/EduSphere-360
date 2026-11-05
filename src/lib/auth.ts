import type { AppRole, AppUser } from './types'
import { supabase } from './supabase'

export async function getCloudUserContext(userId: string): Promise<AppUser> {
  if (!supabase) throw new Error('Cloud mode is not configured. Add the Supabase URL and publishable key to .env.local.')
  const { data: profile, error: profileError } = await supabase.from('profiles').select('full_name,email').eq('id', userId).maybeSingle()
  if (profileError) throw profileError
  const { data: membership, error: membershipError } = await supabase
    .from('memberships').select('institution_id,role,institutions(name)')
    .eq('user_id', userId).eq('status', 'active').limit(1).maybeSingle()
  if (membershipError) throw membershipError
  if (!membership) throw new Error('This login has no active institution account. Ask your administrator to create or activate your account.')
  const institution = membership.institutions as unknown as { name: string } | null
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
    linkedStudentId,
  }
}

export async function cloudSignIn(email: string, password: string) {
  if (!supabase) throw new Error('Cloud mode is not configured. Add your Supabase settings first.')
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) throw error
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
