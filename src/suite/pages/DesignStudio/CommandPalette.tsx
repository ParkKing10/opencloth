import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './command-palette.css'

export type Command = {
  id: string
  label: string
  /** Keyboard hint shown on the right, e.g. "⌘D". */
  hint?: string
  group?: string
  run: () => void
  disabled?: boolean
  keywords?: string
}

type Props = {
  open: boolean
  commands: Command[]
  onClose: () => void
}

/** Case-insensitive subsequence match — "algl" matches "Align left". Returns a score (lower = better). */
function fuzzyScore(query: string, text: string): number | null {
  if (!query) return 0
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let ti = 0
  let score = 0
  let lastHit = -1
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi]
    const found = t.indexOf(c, ti)
    if (found === -1) return null
    score += found - lastHit - 1 // gaps cost
    lastHit = found
    ti = found + 1
  }
  return score
}

export function CommandPalette({ open, commands, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      // focus after the portal mounts
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const results = useMemo(() => {
    const scored = commands
      .map((c) => ({ c, s: fuzzyScore(query, `${c.label} ${c.keywords ?? ''}`) }))
      .filter((x) => x.s !== null)
      .sort((a, b) => (a.s as number) - (b.s as number))
    return scored.map((x) => x.c)
  }, [commands, query])

  useEffect(() => {
    if (active >= results.length) setActive(0)
  }, [results.length, active])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('.cmdp__item.is-active')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const run = (c: Command) => {
    if (c.disabled) return
    onClose()
    c.run()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(results.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const c = results[active]
      if (c) run(c)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return createPortal(
    <div className="cmdp__scrim" onMouseDown={onClose}>
      <div className="cmdp" role="dialog" aria-modal="true" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmdp__search">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            className="cmdp__input"
            placeholder="Search actions…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            aria-label="Search actions"
          />
          <kbd className="cmdp__esc">Esc</kbd>
        </div>
        <div className="cmdp__list" ref={listRef} role="listbox">
          {results.length === 0 && <div className="cmdp__empty">No matching action.</div>}
          {results.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={i === active}
              className={`cmdp__item${i === active ? ' is-active' : ''}${c.disabled ? ' is-disabled' : ''}`}
              disabled={c.disabled}
              onMouseMove={() => setActive(i)}
              onClick={() => run(c)}
            >
              <span className="cmdp__label">
                {c.group && <span className="cmdp__group">{c.group}</span>}
                {c.label}
              </span>
              {c.hint && <kbd className="cmdp__hint">{c.hint}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
