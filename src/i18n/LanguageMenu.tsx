import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, FocusEvent as ReactFocusEvent } from 'react'
import { LANGS, useI18n } from './I18nProvider'
import './language-menu.css'

/**
 * Globe + dropdown language switcher. A single icon button (world glyph) opens a small menu listing
 * the available languages with the active one checked. Follows the WAI-ARIA menu-button pattern:
 * opening moves focus into the menu, Arrow/Home/End move between items, Escape or selecting closes and
 * returns focus to the trigger, and Tabbing out closes it. Used in the suite Topbar; theme-aware via
 * the suite CSS variables. For the compact inline EN/DE pill (marketing, auth) use `LanguageToggle`.
 */
export function LanguageMenu() {
  const { lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const activeIndex = Math.max(0, LANGS.findIndex((l) => l.id === lang))

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) btnRef.current?.focus()
  }, [])

  // When the menu opens, move focus onto the active item (menu-button pattern).
  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.focus()
    // Only depend on `open`: we deliberately focus once, on the opening transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Close on any outside pointer press.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  const focusItem = (i: number) => {
    const n = LANGS.length
    itemRefs.current[((i % n) + n) % n]?.focus()
  }

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const focused = itemRefs.current.findIndex((el) => el === document.activeElement)
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        close(true)
        break
      case 'ArrowDown':
        e.preventDefault()
        focusItem(focused + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        focusItem(focused - 1)
        break
      case 'Home':
        e.preventDefault()
        focusItem(0)
        break
      case 'End':
        e.preventDefault()
        focusItem(LANGS.length - 1)
        break
    }
  }

  // Open with ArrowDown/Enter/Space from the trigger (native click already handles Enter/Space toggle).
  const onTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setOpen(true)
    }
  }

  // Close when focus leaves the whole control (e.g. Tabbing out of the last item).
  const onBlur = (e: ReactFocusEvent<HTMLDivElement>) => {
    if (rootRef.current && e.relatedTarget && rootRef.current.contains(e.relatedTarget as Node)) return
    setOpen(false)
  }

  const current = LANGS.find((l) => l.id === lang) ?? LANGS[0]

  return (
    <div className="lang-menu" ref={rootRef} onBlur={onBlur}>
      <button
        ref={btnRef}
        type="button"
        className="lang-menu__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Language — ${current.long}`}
        title={current.long}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
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
        <div className="lang-menu__pop" role="menu" aria-label="Language" onKeyDown={onMenuKeyDown}>
          {LANGS.map((l, i) => (
            <button
              key={l.id}
              ref={(el) => { itemRefs.current[i] = el }}
              type="button"
              role="menuitemradio"
              aria-checked={lang === l.id}
              className={`lang-menu__item${lang === l.id ? ' is-active' : ''}`}
              onClick={() => {
                setLang(l.id)
                close(true)
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
