import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SuiteData } from './types'
import { buildSeed } from './seed'

const STORAGE_KEY = 'threados-data-v1'

function load(): SuiteData {
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

type StoreApi = {
  data: SuiteData
  /** Immutable update: return a new SuiteData from the current one. */
  mutate: (fn: (data: SuiteData) => SuiteData) => void
  reset: () => void
}

const StoreContext = createContext<StoreApi | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SuiteData>(() => load())
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      /* ignore quota */
    }
  }, [data])

  const mutate = useCallback((fn: (d: SuiteData) => SuiteData) => {
    setData((prev) => fn(prev))
  }, [])

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setData(buildSeed())
  }, [])

  const value = useMemo<StoreApi>(() => ({ data, mutate, reset }), [data, mutate, reset])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>')
  return ctx
}
