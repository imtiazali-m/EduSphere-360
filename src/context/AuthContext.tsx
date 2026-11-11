import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppMode, AppRole, AppUser, AuthLinkMode, InstitutionChoice } from '../lib/types'
import {
  cloudCreateAccount,
  cloudRegisterInstitutionOwner,
  cloudSignIn,
  getCloudUserContext,
  listCloudInstitutionChoices,
  requestCloudPasswordReset,
} from '../lib/auth'
import { authLinkModeFromLocation, matchesLoginRole } from '../lib/authAccess.js'
import { cloudConfigured, supabase } from '../lib/supabase'

export type RegistrationResult =
  | { verificationRequired: true; email: string }
  | { verificationRequired: false }

interface AuthContextValue {
  mode: AppMode
  setMode: (mode: AppMode) => Promise<void>
  user: AppUser | null
  loading: boolean
  signIn: (email: string, password: string, expectedRole?: AppRole | 'employee' | 'owner_admin', rememberMe?: boolean) => Promise<void>
  registerAdmin: (input: {
    fullName: string
    email: string
    password: string
    institutionName: string
    institutionType: 'school' | 'college' | 'university' | 'multi_institution'
    country: string
    location: string
    phone: string
  }) => Promise<RegistrationResult>
  createAccount: (input: {
    fullName: string
    email: string
    password?: string
    role: AppRole
    linkedStudentId?: string
    sendInvitation?: boolean
  }) => Promise<{ requiresActivation?: boolean }>
  signOut: () => Promise<void>
  authLinkMode: AuthLinkMode | null
  clearAuthLinkMode: () => void
  requestPasswordReset: (email: string) => Promise<void>
  completePasswordReset: (password: string) => Promise<void>
  institutionChoices: InstitutionChoice[]
  selectInstitution: (institutionId: string) => Promise<void>
  cancelInstitutionSelection: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const ONLINE_MODE: AppMode = 'cloud'

function requireOnlineConfiguration() {
  if (!cloudConfigured || !supabase) {
    throw new Error('EduSphere 360 requires an active internet connection and configured Supabase cloud services. Please contact your institution administrator.')
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = ONLINE_MODE
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authLinkMode, setAuthLinkMode] = useState<AuthLinkMode | null>(() => typeof window === 'undefined'
    ? null
    : authLinkModeFromLocation(window.location.hash, window.location.search))
  const [institutionChoices, setInstitutionChoices] = useState<InstitutionChoice[]>([])
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const resolutionSequence = useRef(0)

  function clearInstitutionSelection() {
    setInstitutionChoices([])
    setPendingUserId(null)
  }

  async function resolveSignedInAccess(userId: string, expectedRole?: AppRole | 'employee' | 'owner_admin') {
    const sequence = ++resolutionSequence.current
    const memberships = await listCloudInstitutionChoices(userId)
    if (sequence !== resolutionSequence.current) return
    if (memberships.length === 0) {
      throw new Error('This account has no active institution membership. Verify your invitation or ask your institution administrator to activate your account.')
    }

    const choices = expectedRole
      ? memberships.filter(choice => matchesLoginRole(choice.role, expectedRole))
      : memberships
    if (choices.length === 0) {
      const registeredAs = memberships.map(choice => choice.role.replaceAll('_', ' ')).join(', ')
      const expected = expectedRole === 'owner_admin' ? 'owner or administrator'
        : expectedRole === 'employee' ? 'employee or teacher'
          : expectedRole?.replaceAll('_', ' ')
      throw new Error(\`This account is registered as \${registeredAs}, not \${expected}.\`)
    }

    if (choices.length === 1) {
      const resolved = await getCloudUserContext(userId, choices[0].institutionId)
      if (sequence !== resolutionSequence.current) return
      setUser(resolved)
      clearInstitutionSelection()
      return
    }

    setUser(null)
    setPendingUserId(userId)
    setInstitutionChoices(choices)
  }

  useEffect(() => {
    let alive = true
    async function restore() {
      try {
        if (!supabase || !cloudConfigured) {
          if (alive) setUser(null)
          return
        }
        const linkMode = authLinkModeFromLocation(window.location.hash, window.location.search)
        if (linkMode) {
          if (alive) {
            setAuthLinkMode(linkMode)
            setUser(null)
            clearInstitutionSelection()
          }
          return
        }
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (data.session?.user) {
          await resolveSignedInAccess(data.session.user.id)
        } else if (alive) {
          setUser(null)
        }
      } catch (error) {
        if (alive) {
          setUser(null)
          clearInstitutionSelection()
        }
      } finally {
        if (alive) setLoading(false)
      }
    }
    setLoading(true)
    void restore()
    return () => {
      alive = false
      resolutionSequence.current += 1
    }
  }, [])

  useEffect(() => {
    if (!supabase || !cloudConfigured) return
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setAuthLinkMode('recovery')
      if (event === 'SIGNED_OUT') {
        resolutionSequence.current += 1
        setUser(null)
        clearInstitutionSelection()
      }
    })
    const syncLinkMode = () => {
      const linkMode = authLinkModeFromLocation(window.location.hash, window.location.search)
      if (linkMode) setAuthLinkMode(linkMode)
    }
    window.addEventListener('hashchange', syncLinkMode)
    return () => {
      listener.subscription.unsubscribe()
      window.removeEventListener('hashchange', syncLinkMode)
    }
  }, [])

  async function setMode(next: AppMode) {
    if (next !== 'cloud') throw new Error('EduSphere 360 is online-only. Local and offline modes are not available.')
    requireOnlineConfiguration()
  }

  async function signIn(email: string, password: string, expectedRole?: AppRole | 'employee' | 'owner_admin', _rememberMe = true) {
    requireOnlineConfiguration()
    const { userId } = await cloudSignIn(email, password)
    try {
      await resolveSignedInAccess(userId, expectedRole)
    } catch (error) {
      await supabase!.auth.signOut()
      clearInstitutionSelection()
      throw error
    }
  }

  async function registerAdmin(input: {
    fullName: string
    email: string
    password: string
    institutionName: string
    institutionType: 'school' | 'college' | 'university' | 'multi_institution'
    country: string
    location: string
    phone: string
  }): Promise<RegistrationResult> {
    requireOnlineConfiguration()
    const email = input.email.trim().toLowerCase()
    const fullName = input.fullName.trim()
    const institutionName = input.institutionName.trim()
    if (!email || !input.password || !fullName || !institutionName || !input.country.trim() || !input.location.trim() || !input.phone.trim()) {
      throw new Error('Complete the owner and institution contact details before continuing.')
    }
    const result = await cloudRegisterInstitutionOwner({ ...input, fullName, email, institutionName })
    if (result.verificationRequired) {
      setUser(null)
      return { verificationRequired: true, email: result.email }
    }
    setUser(result.user)
    return { verificationRequired: false }
  }

  async function createAccount(input: {
    fullName: string
    email: string
    password?: string
    role: AppRole
    linkedStudentId?: string
    sendInvitation?: boolean
  }): Promise<{ requiresActivation?: boolean }> {
    requireOnlineConfiguration()
    if (!user || !['owner', 'admin'].includes(user.role)) throw new Error('Only an institution owner or administrator can create accounts.')
    if (input.role === 'admin' && user.role !== 'owner') throw new Error('Only the institution owner can appoint another administrator.')
    if (['student', 'parent'].includes(input.role) && !input.linkedStudentId) throw new Error('Link a student record before creating a student or parent account.')
    if (!input.sendInvitation && (!input.password || input.password.length < 10)) {
      throw new Error('Use a temporary password with at least 10 characters, or send an activation invitation.')
    }
    const result = await cloudCreateAccount({ ...input, institutionId: user.institutionId })
    return { requiresActivation: result?.requiresActivation === true }
  }

  async function selectInstitution(institutionId: string) {
    if (!pendingUserId || !institutionChoices.some(choice => choice.institutionId === institutionId)) {
      throw new Error('Choose an institution from the available list.')
    }
    const selected = await getCloudUserContext(pendingUserId, institutionId)
    setUser(selected)
    clearInstitutionSelection()
  }

  async function cancelInstitutionSelection() {
    await signOut()
  }

  async function requestPasswordReset(email: string) {
    requireOnlineConfiguration()
    await requestCloudPasswordReset(email)
  }

  async function completePasswordReset(password: string) {
    requireOnlineConfiguration()
    if (password.length < 10) throw new Error('Use a password with at least 10 characters.')
    const { error } = await supabase!.auth.updateUser({ password })
    if (error) throw error
  }

  function clearAuthLinkMode() {
    setAuthLinkMode(null)
  }

  async function signOut() {
    resolutionSequence.current += 1
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    setAuthLinkMode(null)
    clearInstitutionSelection()
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      mode, setMode, user, loading, signIn, registerAdmin, createAccount, signOut,
      authLinkMode, clearAuthLinkMode, requestPasswordReset, completePasswordReset,
      institutionChoices, selectInstitution, cancelInstitutionSelection,
    }),
    [user, loading, authLinkMode, institutionChoices, pendingUserId],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
