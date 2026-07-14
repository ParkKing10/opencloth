import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query and re-render when it flips. Client-only app (no SSR), so we can
 * seed straight from matchMedia — no hydration flash.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Phone-sized viewport (≤ 768px) — the threshold below which heavy desktop-only UIs are gated. */
export function useIsPhone(): boolean {
  return useMediaQuery('(max-width: 768px)')
}

/** Compact viewport (≤ 1024px) — where the suite sidebar collapses into a slide-in drawer. */
export function useIsCompact(): boolean {
  return useMediaQuery('(max-width: 1024px)')
}
