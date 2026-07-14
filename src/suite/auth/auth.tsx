import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useT } from '@/i18n'
import { useStore } from '../data/store'
import type { User } from '../data/types'
import { constantTimeEqual, hashPassword, uid } from '../data/utils'
import { rowToUser, synthUser, type SessionUser } from '../data/records'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

const SESSION_KEY = 'threados-session' // fallback (no-Supabase) mode only
const SUPA = isSupabaseConfigured ? supabase : null

export type AuthResult = { ok: boolean; error?: string }

type AuthApi = {
  user: User | null
  isAuthed: boolean
  isAdmin: boolean
  /** True until the session (and, if present, its profile) has been resolved. */
  initializing: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  signup: (name: string, email: string, password: string) => Promise<AuthResult>
  logout: () => void
}

const AuthContext = createContext<AuthApi | null>(null)

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Map a raw Supabase auth error to a friendly message (never echo raw server text). */
function friendlyAuthError(message: string, t: (key: string) => string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return t('auth.err.invalidLogin')
  if (m.includes('already registered') || m.includes('already exists')) return t('auth.err.emailExists')
  if (m.includes('email not confirmed')) return t('auth.err.emailNotConfirmed')
  if (m.includes('rate limit') || m.includes('too many')) return t('auth.err.tooMany')
  if (m.includes('should be at least') || m.includes('weak')) return t('auth.err.pwTooShort')
  return t('auth.err.generic')
}

function sessionUserFrom(u: { id: string; email?: string | null; user_metadata?: { name?: string } }): SessionUser {
  return { id: u.id, email: u.email ?? '', name: u.user_metadata?.name ?? '' }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const { data, mutate } = useStore()

  // ---- Fallback (localStorage) session ----
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (SUPA) return null
    try {
      return localStorage.getItem(SESSION_KEY)
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (SUPA) return
    try {
      if (sessionId) localStorage.setItem(SESSION_KEY, sessionId)
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  }, [sessionId])

  // ---- Supabase session ----
  const [supaUserId, setSupaUserId] = useState<string | null>(null)
  const [supaProfile, setSupaProfile] = useState<User | null>(null)
  const [initializing, setInitializing] = useState<boolean>(!!SUPA)

  const loadProfile = useCallback(async (session: SessionUser): Promise<User> => {
    if (!SUPA) return synthUser(session)
    const { data: row } = await SUPA.from('profiles').select('*').eq('id', session.id).maybeSingle()
    return row ? rowToUser(row) : synthUser(session)
  }, [])

  useEffect(() => {
    if (!SUPA) return
    let active = true

    const apply = async (u: { id: string; email?: string | null; user_metadata?: { name?: string } } | undefined) => {
      if (!u) {
        if (!active) return
        setSupaUserId(null)
        setSupaProfile(null)
        setInitializing(false)
        return
      }
      setSupaUserId(u.id)
      const profile = await loadProfile(sessionUserFrom(u))
      if (!active) return
      setSupaProfile(profile)
      setInitializing(false)
    }

    // onAuthStateChange fires INITIAL_SESSION immediately, so a separate getSession() would
    // only cause a redundant second profile fetch (and a double-hydrate in the store).
    const { data: sub } = SUPA.auth.onAuthStateChange((_e, session) => active && void apply(session?.user))

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  // Current user: prefer the live store row (reflects Settings edits), else the fetched profile.
  const user = useMemo<User | null>(() => {
    if (SUPA) {
      if (!supaUserId) return null
      return data.users.find((u) => u.id === supaUserId) ?? supaProfile
    }
    return data.users.find((u) => u.id === sessionId) ?? null
  }, [data.users, sessionId, supaUserId, supaProfile])

  const login = useCallback<AuthApi['login']>(
    async (email, password) => {
      const trimmed = email.trim().toLowerCase()
      if (!validEmail(trimmed)) return { ok: false, error: t('auth.err.validEmail') }
      if (!password) return { ok: false, error: t('auth.err.enterPassword') }

      if (SUPA) {
        const { data: res, error } = await SUPA.auth.signInWithPassword({ email: trimmed, password })
        if (error || !res.user) return { ok: false, error: friendlyAuthError(error?.message ?? '', t) }
        const profile = await loadProfile(sessionUserFrom(res.user))
        if (profile.status === 'suspended') {
          await SUPA.auth.signOut()
          return { ok: false, error: t('auth.err.suspended') }
        }
        setSupaUserId(res.user.id)
        setSupaProfile(profile)
        setInitializing(false)
        return { ok: true }
      }

      const found = data.users.find((u) => u.email.toLowerCase() === trimmed)
      if (!found) return { ok: false, error: t('auth.err.noAccount') }
      if (found.status === 'suspended') return { ok: false, error: t('auth.err.suspended') }
      const hash = await hashPassword(password)
      if (!constantTimeEqual(hash, found.passwordHash)) return { ok: false, error: t('auth.err.incorrectPassword') }
      setSessionId(found.id)
      return { ok: true }
    },
    [data.users, loadProfile, t],
  )

  const signup = useCallback<AuthApi['signup']>(
    async (name, email, password) => {
      const cleanName = name.trim()
      const trimmed = email.trim().toLowerCase()
      if (cleanName.length < 2) return { ok: false, error: t('auth.err.enterName') }
      if (!validEmail(trimmed)) return { ok: false, error: t('auth.err.validEmail') }
      if (password.length < 8) return { ok: false, error: t('auth.err.pwTooShort') }

      if (SUPA) {
        const { data: res, error } = await SUPA.auth.signUp({
          email: trimmed,
          password,
          options: { data: { name: cleanName } },
        })
        if (error) return { ok: false, error: friendlyAuthError(error.message, t) }
        if (!res.session || !res.user) {
          return { ok: false, error: t('auth.err.confirmEmail') }
        }
        const profile = await loadProfile(sessionUserFrom(res.user))
        setSupaUserId(res.user.id)
        setSupaProfile(profile)
        setInitializing(false)
        return { ok: true }
      }

      if (data.users.some((u) => u.email.toLowerCase() === trimmed)) {
        return { ok: false, error: t('auth.err.emailExists') }
      }
      const passwordHash = await hashPassword(password)
      const newUser: User = {
        id: uid('u'),
        name: cleanName,
        email: trimmed,
        role: 'user',
        plan: 'Free',
        status: 'active',
        passwordHash,
        createdAt: Date.now(),
        coins: 100,
      }
      mutate((d) => ({ ...d, users: [...d.users, newUser] }))
      setSessionId(newUser.id)
      return { ok: true }
    },
    [data.users, mutate, loadProfile, t],
  )

  const logout = useCallback(() => {
    if (SUPA) {
      void SUPA.auth.signOut()
      setSupaUserId(null)
      setSupaProfile(null)
      return
    }
    setSessionId(null)
  }, [])

  const value = useMemo<AuthApi>(
    () => ({
      user,
      isAuthed: !!user,
      // Anchor admin status to the authoritative auth profile (loaded before
      // `initializing` clears) so a transient store-hydration row — which can
      // briefly hold a synth 'user' role for the current user — cannot bounce a
      // real admin out of /admin on a hard load or refresh.
      isAdmin: supaProfile?.role === 'admin' || user?.role === 'admin',
      initializing,
      login,
      signup,
      logout,
    }),
    [user, supaProfile, initializing, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

/** Minimal branded splash shown while the session resolves (Supabase mode). */
function AuthSplash() {
  const t = useT()
  return (
    <div className="suite" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <style>{'@keyframes threados-auth-spin{to{transform:rotate(360deg)}}'}</style>
      <span
        aria-label={t('auth.loading')}
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.18)',
          borderTopColor: '#d1f94f',
          animation: 'threados-auth-spin 0.7s linear infinite',
        }}
      />
    </div>
  )
}

/** Redirect to /login when not authenticated. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthed, initializing } = useAuth()
  const location = useLocation()
  if (initializing) return <AuthSplash />
  if (!isAuthed) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <>{children}</>
}

/** Redirect non-admins away from admin routes. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthed, isAdmin, initializing } = useAuth()
  if (initializing) return <AuthSplash />
  if (!isAuthed) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/suite" replace />
  return <>{children}</>
}
