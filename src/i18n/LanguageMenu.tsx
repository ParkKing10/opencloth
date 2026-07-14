import { useEffect, useRef, useState } from 'react'
import { LANGS, useI18n } from './I18nProvider'
import './language-menu.css'

/**
 * Globe + dropdown language switcher. A single icon button (world glyph) opens a small menu listing
 * the available languages with the active one checked. Used in the suite Topbar; theme-aware via the
 * suite CSS variables. For the compact inline EN/DE pill (marketing, auth) use `LanguageToggle`.
 */
export function LanguageMenu() {
  const { lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = LANGS.find((l) => l.id === lang) ?? LANGS[0]

  return (
    <div className="lang-menu" ref={ref}>
      <button
        type="button"
        className="lang-menu__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Language — ${current.long}`}
        title={current.long}
        onClick={() => setOpen((o) => !o)}
      >
        <svg className="lang-menu__globe" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c2.6 2.7 3.9 5.9 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.9-3.9-9S9.4 5.7 12 3Z" />
        </svg>
        <svg className="lang-menu__chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="lang-menu__pop" role="menu">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="menuitemradio"
              aria-checked={lang === l.id}
              className={`lang-menu__item${lang === l.id ? ' is-active' : ''}`}
              onClick={() => {
                setLang(l.id)
                setOpen(false)
              }}
            >
              <span className="lang-menu__item-label">{l.long}</span>
              <span className="lang-menu__item-code">{l.label}</span>
              {lang === l.id && (
                <svg className="lang-menu__check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
