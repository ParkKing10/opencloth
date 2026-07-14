/* ============================================================
   Guest wall — registration is MANDATORY beyond the dashboard.
   Guests may look at the dashboard as the storefront; every other
   page renders this wall INSTEAD of its content (no dismiss, no
   peeking). Two ways forward: register or log in.
   ============================================================ */

import { useNavigate } from 'react-router-dom'
import { useT } from '@/i18n'
import './shell-modals.css'

export function GuestWall() {
  const t = useT()
  const navigate = useNavigate()

  return (
    <div className="gwall">
      <div className="gwall__card">
        <span className="gwall__mark" aria-hidden="true">✦</span>
        <h2 className="gwall__title">{t('wall.title')}</h2>
        <p className="gwall__sub">{t('wall.sub')}</p>
        <div className="gwall__actions">
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
  )
}
