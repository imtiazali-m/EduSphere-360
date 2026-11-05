import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppMode, AppRole, AppUser } from '../lib/types'
import { cloudCreateAccount, cloudSignIn, getCloudUserContext } from '../lib/auth'
import { cloudConfigured, supabase } from '../lib/supabase'
import { createLocalAccount, createLocalAdmin, signInLocal } from '../lib/localDb'

interface AuthContextValue {
  mode: AppMode
  setMode: (mode: AppMode) => Promise<void>
  user: AppUser | null
  loading: boolean
  signIn: (email: string, password: string, expectedRole?: AppRole) => Promise<void>
  registerAdmin: (input: { institutionName: string; institutionType: string; fullName: string; email: string; password: string }) => Promise<void>
  createAccount: (input: { fullName: string; email: string; password: string; role: AppRole; linkedStudentId?: string }) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const SESSION_KEY = 'edu360-local-session'
const MODE_KEY = 'edu360-mode'

export function AuthProvider({ children }: { children: ReactNode }) {
  const defaultMode: AppMode = import.meta.env.VITE_DEFAULT_MODE === 'cloud' && cloudConfigured ? 'cloud' : 'local'
  const [mode, setModeState] = useState<AppMode>(() => (localStorage.getItem(MODE_KEY) as AppMode) || defaultMode)
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function restore() {
      try {
        if (mode === 'local') {
          const session = localStorage.getItem(SESSION_KEY)
          if (session) setUser(JSON.parse(session) as AppUser)
          else setUser(null)
        } else if (supabase) {
          const { data } = await supabase.auth.getSession()
          if (data.session?.user) {
            try { setUser(await getCloudUserContext(data.session.user.id)) }
            catch { await supabase.auth.signOut(); setUser(null) }
          } else setUser(null)
        } else setUser(null)
      } finally {
        if (alive) setLoading(false)
      }
    }
    setLoading(true)
    void restore()
    return () => { alive = false }
  }, [mode])

  useEffect(() => {
    if (mode !== 'cloud' || !supabase) return
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) { setUser(null); return }
      window.setTimeout(() => {
        void getCloudUserContext(session.user.id).then(setUser).catch(() => setUser(null))
      }, 0)
    })
    return () => listener.subscription.unsubscribe()
  }, [mode])

  async function setMode(next: AppMode) {
    if (next === 'cloud' && !cloudConfigured) throw new Error('Cloud mode is not configured yet. Add your Supabase URL and publishable key to .env.local, then restart Vite.')
    if (mode === 'local') localStorage.removeItem(SESSION_KEY)
    else if (supabase) await supabase.auth.signOut()
    setUser(null)
    localStorage.setItem(MODE_KEY, next)
    setModeState(next)
  }

  async function signIn(email: string, password: string, expectedRole?: AppRole) {
    const signedIn = mode === 'local' ? await signInLocal(email, password) : await cloudSignIn(email, password)
    if (expectedRole && signedIn.role !== expectedRole && !(expectedRole === 'admin' && signedIn.role === 'owner')) {
      if (mode === 'cloud' && supabase) await supabase.auth.signOut()
      throw new Error(`This account is registered as ${signedIn.role.replace('_', ' ')}, not ${expectedRole.replace('_', ' ')}.`)
    }
    setUser(signedIn)
    if (mode === 'local') localStorage.setItem(SESSION_KEY, JSON.stringify(signedIn))
  }

  async function registerAdmin(input: { institutionName: string; institutionType: string; fullName: string; email: string; password: string }) {
    if (mode === 'cloud') {
      throw new Error('Create the first cloud owner in Supabase Dashboard using MANUAL_FIRST_ADMIN_SETUP.sql, then sign in.');
    }
    const created = await createLocalAdmin(input)
    setUser(created)
    localStorage.setItem(SESSION_KEY, JSON.stringify(created))
  }

  async function createAccount(input: { fullName: string; email: string; password: string; role: AppRole; linkedStudentId?: string }) {
    if (!user || !['owner', 'admin'].includes(user.role)) throw new Error('Only an institution owner or administrator can create accounts.')
    if (input.role === 'admin' && user.role !== 'owner') throw new Error('Only the institution owner can appoint another administrator.')
    if (['student','parent'].includes(input.role) && !input.linkedStudentId) throw new Error('Link a student record before creating a student or parent account.')
    const payload = { ...input, institutionId: user.institutionId, institutionName: user.institutionName }
    if (mode === 'local') await createLocalAccount(payload)
    else await cloudCreateAccount(payload)
  }

  async function signOut() {
    if (mode === 'local') localStorage.removeItem(SESSION_KEY)
    else if (supabase) await supabase.auth.signOut()
    setUser(null)
  }

  const value = useMemo<AuthContextValue>(() => ({ mode, setMode, user, loading, signIn, registerAdmin, createAccount, signOut }), [mode, user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
