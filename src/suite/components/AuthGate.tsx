/* ============================================================
   Auth gate — shown when a GUEST clicks anything interactive in
   the suite. Browsing is free; using it needs an account. Two
   ways in: register (accent) or log in.
   ============================================================ */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useT } from '@/i18n'
import './shell-modals.css'

export function AuthGate({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="suite shm-host">
      <div className="shm" role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <div className="shm__scrim" onClick={onClose} />
        <div className="shm__card shm__card--gate">
          <button className="shm__x" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
          <h2 className="shm__title" id="gate-title">
            <span className="shm__title-accent">{t('gate.title1')}</span>
            <br />
            {t('gate.title2')}
          </h2>
          <p className="shm__sub">{t('gate.sub')}</p>
          <div className="shm__gate-actions">
            <button className="shm__cta" type="button" onClick={() => navigate('/signup')}>
              {t('gate.signup')}
            </button>
            <button className="shm__gate-login" type="button" onClick={() => navigate('/login')}>
              {t('gate.login')}
            </button>
          </div>
          <p className="shm__note">{t('gate.note')}</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
