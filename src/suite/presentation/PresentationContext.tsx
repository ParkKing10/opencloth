import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/auth'
import { applyPresentation, getStoredPresentation, storePresentation } from './presentation'

// Presentation Mode context.
//
// `enabled` is the admin's persisted preference. `active` = enabled && isAdmin — and ONLY `active`
// ever stamps [data-presentation='on'] on <html>. So a non-admin can never see the feature, even
// if the flag is present in their localStorage, and it self-disables the moment an admin logs out.

type PresentationApi = {
  isAdmin: boolean
  /** The admin's saved preference. */
  enabled: boolean
  /** enabled && isAdmin — the real on/off that drives the CSS layer + overlay. */
  active: boolean
  /** Admin-only. Toggling for a non-admin is a no-op. */
  setEnabled: (on: boolean) => void
}

const PresentationCtx = createContext<PresentationApi | null>(null)

export function PresentationProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  const [enabled, setEnabledState] = useState<boolean>(() => getStoredPresentation())

  const active = enabled && isAdmin

  // The single source of truth for the whole feature: the root attribute.
  useEffect(() => {
    applyPresentation(active)
    return () => applyPresentation(false)
  }, [active])

  const setEnabled = useCallback(
    (on: boolean) => {
      if (!isAdmin) return // hard gate — normal users can never enable it
      setEnabledState(on)
      storePresentation(on)
    },
    [isAdmin],
  )

  const value = useMemo<PresentationApi>(() => ({ isAdmin, enabled, active, setEnabled }), [isAdmin, enabled, active, setEnabled])

  return <PresentationCtx.Provider value={value}>{children}</PresentationCtx.Provider>
}

export function usePresentation(): PresentationApi {
  const ctx = useContext(PresentationCtx)
  if (!ctx) throw new Error('usePresentation must be used within <PresentationProvider>')
  return ctx
}
