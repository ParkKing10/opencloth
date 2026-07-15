import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SuiteData } from './types'
import { buildSeed } from './seed'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { hydrate, reconcile, type SessionUser } from './records'
import { setSyncSession } from '../lib/docSync'

const STORAGE_KEY = 'threados-data-v1'

/** Supabase is the source of truth only when a client exists. */
const SUPA = isSupabaseConfigured ? supabase : null

function loadLocal(): SuiteData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as SuiteData
  } catch {
    /* corrupt storage — fall through to seed */
  }
  const seed = buildSeed()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
  } catch {
    /* ignore quota */
  }
  return seed
}

/**
 * Neutral state for Supabase mode: the shared manufacturer catalog + demo
 * notifications, but no owner-scoped rows and no foreign users. This guarantees
 * one user never briefly sees another user's (or the seed's) data before hydration.
 */
function neutralData(): SuiteData {
  const seed = buildSeed()
  return { ...seed, designs: [], collections: [], techPacks: [], orders: [], users: [] }
}

function initialData(): SuiteData {
  return SUPA ? neutralData() : loadLocal()
}

function sessionUserFrom(u: { id: string; email?: string | null; user_metadata?: { name?: string } }): SessionUser {
  return { id: u.id, email: u.email ?? '', name: u.user_metadata?.name ?? '' }
}

type StoreApi = {
  data: SuiteData
  /** Immutable update: return a new SuiteData from the current one. */
  mutate: (fn: (data: SuiteData) => SuiteData) => void
  reset: () => void
}

const StoreContext = createContext<StoreApi | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SuiteData>(() => initialData())
  const dataRef = useRef(data)
  const sessionRef = useRef<SessionUser | null>(null)
  const first = useRef(true)

  // Hydration guards (Supabase mode):
  const hydratingId = useRef<string | null>(null) // session already hydrated/in-flight — dedupes repeat auth events
  const hydrationSeq = useRef(0) // newest hydration wins
  const mutations = useRef(0) // if a mutate lands mid-hydrate, keep the optimistic state

  // Synchronous mirror so `mutate` can diff prev→next without a stale closure.
  const commit = useCallback((next: SuiteData) => {
    dataRef.current = next
    setData(next)
  }, [])

  // ---- Fallback mode: persist to localStorage exactly like before ----
  useEffect(() => {
    if (SUPA) return
    if (first.current) {
      first.current = false
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Quota hit: the app database could NOT persist — designs/collections would only
      // survive until the tab closes. Tell the shell so the user hears about it.
      window.dispatchEvent(new CustomEvent('loom:sync-error', { detail: 'local' }))
    }
  }, [data])

  // ---- Supabase mode: hydrate on sign-in, neutralize on sign-out ----
  const hydrateFor = useCallback(
    async (session: SessionUser, force = false) => {
      if (!SUPA) return
      if (!force && hydratingId.current === session.id) return // dedupe repeat events (INITIAL_SESSION, token refresh)
      hydratingId.current = session.id
      sessionRef.current = session
      setSyncSession(session.id) // document sync (design docs, garments) follows the auth session
      const gen = ++hydrationSeq.current
      const mut = mutations.current
      const slices = await hydrate(SUPA, session)
      // Drop the result if a newer hydration started or a mutation landed meanwhile.
      if (gen !== hydrationSeq.current || mutations.current !== mut) return
      commit({ ...neutralData(), ...slices, notifications: dataRef.current.notifications })
    },
    [commit],
  )

  useEffect(() => {
    if (!SUPA) return
    let active = true
    // onAuthStateChange fires INITIAL_SESSION immediately, so no separate getSession() is needed.
    const { data: sub } = SUPA.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (session?.user) void hydrateFor(sessionUserFrom(session.user))
      else {
        hydratingId.current = null
        sessionRef.current = null
        setSyncSession(null)
        commit(neutralData())
      }
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [commit, hydrateFor])

  const mutate = useCallback(
    (fn: (d: SuiteData) => SuiteData) => {
      const prev = dataRef.current
      const next = fn(prev)
      mutations.current += 1
      commit(next)
      if (SUPA && sessionRef.current) {
        // optimistic UI already applied; persist the delta in the background
        void reconcile(SUPA, prev, next, sessionRef.current.id).catch((e) => {
          console.error('[store] reconcile failed:', e)
          // A failed cloud write must not stay a console-only secret — surface it.
          window.dispatchEvent(new CustomEvent('loom:sync-error', { detail: 'cloud' }))
        })
      }
    },
    [commit],
  )

  const reset = useCallback(() => {
    if (SUPA) {
      // never wipe the database — re-pull the source of truth
      if (sessionRef.current) void hydrateFor(sessionRef.current, true)
      else commit(neutralData())
      return
    }
    localStorage.removeItem(STORAGE_KEY)
    commit(buildSeed())
  }, [commit, hydrateFor])

  const value = useMemo<StoreApi>(() => ({ data, mutate, reset }), [data, mutate, reset])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>')
  return ctx
}
