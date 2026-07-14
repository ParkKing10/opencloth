import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { DICT } from './dict'
import type { Lang } from './types'

// Lightweight, dependency-free i18n. English is the DEFAULT; German is a full second locale the user
// can switch to from the language toggle. Choice is persisted in localStorage.

export type { Lang } from './types'
export const LANGS: { id: Lang; label: string; long: string }[] = [
  { id: 'en', label: 'EN', long: 'English' },
  { id: 'de', label: 'DE', long: 'Deutsch' },
]

const STORAGE_KEY = 'loom-lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'de') return saved
  } catch {
    /* ignore */
  }
  return 'en' // default: English
}

type TFn = (key: string, vars?: Record<string, string | number>) => string

type I18nContextValue = { lang: Lang; setLang: (l: Lang) => void; t: TFn }

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* ignore */
    }
    if (typeof document !== 'undefined') document.documentElement.lang = l
  }, [])

  const t = useCallback<TFn>(
    (key, vars) => {
      let s = DICT[lang][key] ?? DICT.en[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
      }
      return s
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>')
  return ctx
}

/** Convenience hook — returns just the translate function. */
export function useT(): TFn {
  return useI18n().t
}
