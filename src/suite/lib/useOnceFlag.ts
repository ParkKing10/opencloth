import { useCallback, useState } from 'react'

/**
 * A persistent one-time flag — powers "don't show this again" for guided overlays and coach
 * marks. Backed by localStorage so an experienced user is never slowed by the same primer twice.
 */
export function useOnceFlag(key: string): { seen: boolean; markSeen: () => void; reset: () => void } {
  const [seen, setSeen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })

  const markSeen = useCallback(() => {
    setSeen(true)
    try {
      localStorage.setItem(key, '1')
    } catch {
      /* storage blocked — the flag still holds for this session */
    }
  }, [key])

  const reset = useCallback(() => {
    setSeen(false)
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }, [key])

  return { seen, markSeen, reset }
}
