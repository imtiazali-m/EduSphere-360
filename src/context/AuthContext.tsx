import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppMode, AppRole, AppUser } from '../lib/types'
import {
  cloudCreateAccount,
  cloudRegisterInstitutionOwner,
  cloudSignIn,
  getCloudUserContext,
} from '../lib/auth'
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
  registerAdmin: (input: { fullName: string; email: string; password: string; institutionName: string; institutionType: 'school' | 'college' | 'university' | 'multi_institution' }) => Promise<RegistrationResult>
  createAccount: (input: { fullName: string; email: string; password: string; role: AppRole; linkedStudentId?: string }) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const ONLINE_MODE: AppMode = 'cloud'

function requireOnlineConfiguration() {
  if (!cloudConfigured || !supabase) {
    throw new Error('EduSphere 360 requires an active internet connection and configured Supabase cloud services. Please contact your institution administrator.')
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // The application is online-only. Existing local-mode preferences and browser
  // sessions from older builds are intentionally ignored.
  const mode = ONLINE_MODE
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function restore() {
      try {
        if (!supabase || !cloudConfigured) {
          if (alive) setUser(null)
          return
        }
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (data.session?.user) {
          try {
            const context = await getCloudUserContext(data.session.user.id)
            if (alive) setUser(context)
          } catch {
            await supabase.auth.signOut()
            if (alive) setUser(null)
          }
        } else if (alive) setUser(null)
      } catch {
        if (alive) setUser(null)
      } finally {
        if (alive) setLoading(false)
      }
    }
    setLoading(true)
    void restore()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!supabase || !cloudConfigured) return
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null)
        return
      }
      window.setTimeout(() => {
        void getCloudUserContext(session.user.id).then(setUser).catch(() => setUser(null))
      }, 0)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function setMode(next: AppMode) {
    if (next !== 'cloud') throw new Error('EduSphere 360 is online-only. Local and offline modes are not available.')
    requireOnlineConfiguration()
  }

  async function signIn(email: string, password: string, expectedRole?: AppRole | 'employee' | 'owner_admin', _rememberMe = true) {
    requireOnlineConfiguration()
    const signedIn = await cloudSignIn(email, password)
    const roleMatches = !expectedRole || (
      expectedRole === 'owner_admin' ? signedIn.role === 'owner' || signedIn.role === 'admin'
        : expectedRole === 'employee' ? ['teacher', 'accountant', 'exam_officer'].includes(signedIn.role)
          : signedIn.role === expectedRole || (expectedRole === 'admin' && signedIn.role === 'owner')
    )
    if (!roleMatches) {
      await supabase!.auth.signOut()
      const expectedLabel = expectedRole === 'employee' ? 'employee' : expectedRole?.replace('_', ' ')
      throw new Error(`This account is registered as ${signedIn.role.replace('_', ' ')}, not ${expectedLabel}.`)
    }
    setUser(signedIn)
  }

  async function registerAdmin(input: { fullName: string; email: string; password: string; institutionName: string; institutionType: 'school' | 'college' | 'university' | 'multi_institution' }): Promise<RegistrationResult> {
    requireOnlineConfiguration()
    const email = input.email.trim().toLowerCase()
    const fullName = input.fullName.trim()
    const institutionName = input.institutionName.trim()
    if (!email || !input.password || !fullName || !institutionName) {
      throw new Error('Complete your name, institution name, email and password.')
    }
    const result = await cloudRegisterInstitutionOwner({ ...input, fullName, email, institutionName })
    if (result.verificationRequired) {
      setUser(null)
      return { verificationRequired: true, email: result.email }
    }
    setUser(result.user)
    return { verificationRequired: false }
  }

  async function createAccount(input: { fullName: string; email: string; password: string; role: AppRole; linkedStudentId?: string }) {
    requireOnlineConfiguration()
    if (!user || !['owner', 'admin'].includes(user.role)) throw new Error('Only an institution owner or administrator can create accounts.')
    if (input.role === 'admin' && user.role !== 'owner') throw new Error('Only the institution owner can appoint another administrator.')
    if (['student', 'parent'].includes(input.role) && !input.linkedStudentId) throw new Error('Link a student record before creating a student or parent account.')
    await cloudCreateAccount({ ...input, institutionId: user.institutionId })
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
  }

  const value = useMemo<AuthContextValue>(
    () => ({ mode, setMode, user, loading, signIn, registerAdmin, createAccount, signOut }),
    [user, loading],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
