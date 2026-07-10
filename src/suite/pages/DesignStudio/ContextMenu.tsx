import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './context-menu.css'

export type MenuItem =
  | { kind?: 'item'; label: string; shortcut?: string; onSelect: () => void; disabled?: boolean; danger?: boolean }
  | { kind: 'separator' }

type Props = {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

/** A cursor-anchored right-click menu. Closes on outside-click, Esc, or after an action runs.
 *  Every item just calls an already-wired Studio op — no state of its own. */
export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  // Keep the menu fully on-screen (flip near the right/bottom edges).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const pad = 8
    const left = Math.min(x, window.innerWidth - width - pad)
    const top = Math.min(y, window.innerHeight - height - pad)
    setPos({ left: Math.max(pad, left), top: Math.max(pad, top) })
  }, [x, y])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="ctxm"
      style={{ left: pos.left, top: pos.top }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) =>
        it.kind === 'separator' ? (
          <div key={i} className="ctxm__sep" role="separator" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={`ctxm__item${it.danger ? ' ctxm__item--danger' : ''}`}
            disabled={it.disabled}
            onClick={() => {
              it.onSelect()
              onClose()
            }}
          >
            <span className="ctxm__label">{it.label}</span>
            {it.shortcut && <kbd className="ctxm__kbd">{it.shortcut}</kbd>}
          </button>
        ),
      )}
    </div>,
    document.body,
  )
}
