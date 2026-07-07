import { useCallback, useState } from 'react'

export type SuiteTheme = 'dark' | 'light'

const KEY = 'threados-theme'

export function getStoredTheme(): SuiteTheme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/** Apply the theme to the document root so every route (incl. the editor) reacts. */
export function applyTheme(theme: SuiteTheme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

/** Set once on app boot, before React renders, to avoid a flash. */
export function initTheme(): void {
  applyTheme(getStoredTheme())
}

export function useSuiteTheme(): { theme: SuiteTheme; toggle: () => void } {
  const [theme, setTheme] = useState<SuiteTheme>(() => getStoredTheme())

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: SuiteTheme = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(KEY, next)
      } catch {
        /* ignore storage failures */
      }
      applyTheme(next)
      return next
    })
  }, [])

  return { theme, toggle }
}
