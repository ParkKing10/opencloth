import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useStore } from '../data/store'
import type { User } from '../data/types'
import { constantTimeEqual, hashPassword, uid } from '../data/utils'

const SESSION_KEY = 'threados-session'

export type AuthResult = { ok: boolean; error?: string }

type AuthApi = {
  user: User | null
  isAuthed: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  signup: (name: string, email: string, password: string) => Promise<AuthResult>
  logout: () => void
}

const AuthContext = createContext<AuthApi | null>(null)

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, mutate } = useStore()
  const [sessionId, setSessionId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_KEY)
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      if (sessionId) localStorage.setItem(SESSION_KEY, sessionId)
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  }, [sessionId])

  const user = useMemo(() => data.users.find((u) => u.id === sessionId) ?? null, [data.users, sessionId])

  const login = useCallback<AuthApi['login']>(
    async (email, password) => {
      const trimmed = email.trim().toLowerCase()
      if (!validEmail(trimmed)) return { ok: false, error: 'Enter a valid email address.' }
      if (!password) return { ok: false, error: 'Enter your password.' }
      const found = data.users.find((u) => u.email.toLowerCase() === trimmed)
      if (!found) return { ok: false, error: 'No account found for that email.' }
      if (found.status === 'suspended') return { ok: false, error: 'This account has been suspended.' }
      const hash = await hashPassword(password)
      if (!constantTimeEqual(hash, found.passwordHash)) return { ok: false, error: 'Incorrect password.' }
      setSessionId(found.id)
      return { ok: true }
    },
    [data.users],
  )

  const signup = useCallback<AuthApi['signup']>(
    async (name, email, password) => {
      const cleanName = name.trim()
      const trimmed = email.trim().toLowerCase()
      if (cleanName.length < 2) return { ok: false, error: 'Enter your name.' }
      if (!validEmail(trimmed)) return { ok: false, error: 'Enter a valid email address.' }
      if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }
      if (data.users.some((u) => u.email.toLowerCase() === trimmed)) {
        return { ok: false, error: 'An account with that email already exists.' }
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
    [data.users, mutate],
  )

  const logout = useCallback(() => setSessionId(null), [])

  const value = useMemo<AuthApi>(
    () => ({ user, isAuthed: !!user, isAdmin: user?.role === 'admin', login, signup, logout }),
    [user, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

/** Redirect to /login when not authenticated. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthed } = useAuth()
  const location = useLocation()
  if (!isAuthed) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <>{children}</>
}

/** Redirect non-admins away from admin routes. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthed, isAdmin } = useAuth()
  if (!isAuthed) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/suite" replace />
  return <>{children}</>
}
