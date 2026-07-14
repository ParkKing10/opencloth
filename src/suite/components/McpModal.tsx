/* ============================================================
   MCP modal — "connect loom studios to Claude". Opened from the
   sidebar button that replaced the storage meter. Honest teaser:
   what the MCP integration will do, with a beta-soon chip — no
   fake endpoints, no pretend connections.
   ============================================================ */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/i18n'
import './shell-modals.css'

export function McpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null

  // Same portal reasoning as TrialModal: escape any filtered/sticky containing block.
  return createPortal(
    <div className="suite shm-host">
    <div className="shm" role="dialog" aria-modal="true" aria-labelledby="mcp-title">
      <div className="shm__scrim" onClick={onClose} />
      <div className="shm__card shm__card--mcp">
        <button className="shm__x" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="shm__mcp-head">
          <span className="shm__mcp-mark" aria-hidden="true">✳</span>
          <h2 className="shm__title" id="mcp-title">{t('mcp.title')}</h2>
          <span className="shm__soon">{t('mcp.soon')}</span>
        </div>
        <p className="shm__sub">{t('mcp.body')}</p>
        <ul className="shm__examples">
          <li>{t('mcp.ex1')}</li>
          <li>{t('mcp.ex2')}</li>
          <li>{t('mcp.ex3')}</li>
        </ul>
        <div className="shm__cmd" aria-hidden="true">
          <code>claude mcp add loom-studios</code>
        </div>
        <button className="shm__cta shm__cta--sm" type="button" onClick={onClose}>
          {t('mcp.ok')}
        </button>
      </div>
    </div>
    </div>,
    document.body,
  )
}
