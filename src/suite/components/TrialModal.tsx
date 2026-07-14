/* ============================================================
   Trial modal — the Canva-style "start your free trial" dialog,
   opened from the topbar crown button. Left: pick a plan (radio
   cards, €0 for 30 days). Right: what the selected plan gives you.
   The CTA activates the plan exactly like the Pricing page does
   (plan on the user + monthly coins granted).
   ============================================================ */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/i18n'
import { useAuth } from '../auth/auth'
import { useStore } from '../data/store'
import { useToast } from './ui/Toast'
import { useRewards } from '../economy/useRewards'
import { PRICING_TIERS, type PricingTier } from '../economy/economy'
import './shell-modals.css'

export function TrialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const { mutate } = useStore()
  const { grant } = useRewards()
  const [sel, setSel] = useState<PricingTier['id']>('Studio')

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null
  const tier = PRICING_TIERS.find((p) => p.id === sel) ?? PRICING_TIERS[1]

  const start = () => {
    if (!user) return
    mutate((d) => ({ ...d, users: d.users.map((u) => (u.id === user.id ? { ...u, plan: tier.id } : u)) }))
    grant(tier.coins, `${tier.id} plan — trial start`)
    toast(t('pricing.chosen', { plan: t(`pricing.tier.${tier.id}.name`), n: tier.coins.toLocaleString() }), 'success')
    onClose()
  }

  // Portal to <body>: the sticky topbar's backdrop-filter would otherwise become
  // the containing block for position:fixed and clip the dialog. The .suite class
  // carries the design tokens; display:contents keeps the wrapper layout-neutral.
  return createPortal(
    <div className="suite shm-host">
    <div className="shm" role="dialog" aria-modal="true" aria-labelledby="trial-title">
      <div className="shm__scrim" onClick={onClose} />
      <div className="shm__card shm__card--trial">
        <button className="shm__x" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="shm__left">
          <h2 className="shm__title" id="trial-title">
            <span className="shm__title-accent">{t('trial.title1')}</span>
            <br />
            {t('trial.title2')}
          </h2>
          <p className="shm__sub">{t('trial.subtitle')}</p>

          <div className="shm__plans">
            {PRICING_TIERS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`shm__plan${sel === p.id ? ' is-on' : ''}`}
                onClick={() => setSel(p.id)}
                style={{ ['--plan-accent' as string]: p.accent }}
              >
                <span className="shm__radio" aria-hidden="true" />
                <span className="shm__plan-text">
                  <b>
                    {t(`pricing.tier.${p.id}.name`)}
                    {p.badge === 'popular' && <span className="shm__badge">{t('pricing.badge.popular')}</span>}
                  </b>
                  <small>{t('trial.planLine', { price: p.monthly })}</small>
                </span>
              </button>
            ))}
          </div>

          <button className="shm__cta" type="button" onClick={start}>
            👑 {t('trial.start')}
          </button>
          <p className="shm__note">{t('trial.note')}</p>
        </div>

        <div className="shm__right">
          <div className="shm__coins" style={{ ['--plan-accent' as string]: tier.accent }}>
            <b>{tier.coins.toLocaleString()}</b>
            <small>{t('trial.coinsPerMonth')}</small>
          </div>
          <p className="shm__benefits-title">{t('trial.benefitsTitle')}</p>
          <ul className="shm__benefits">
            {Array.from({ length: Math.min(6, tier.bullets) }, (_, i) => (
              <li key={i}>
                <span aria-hidden="true">✓</span> {t(`pricing.feat.${tier.id}.${i + 1}`)}
              </li>
            ))}
          </ul>
          <p className="shm__tagline">{t(`pricing.tier.${tier.id}.tagline`)}</p>
        </div>
      </div>
    </div>
    </div>,
    document.body,
  )
}
