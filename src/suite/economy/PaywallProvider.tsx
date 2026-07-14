import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '@/i18n'
import { useAuth } from '../auth/auth'
import { useStore } from '../data/store'
import { COSTS, freeGenUsed, isPaidPlan, markFreeGen, type GenKind } from './economy'
import './paywall.css'

/**
 * One decision for one generation. The caller runs its work only when `allow` is true, and calls
 * `commit()` ONLY after the generation actually succeeded (so a failed/blocked attempt never spends
 * a coin or burns the free trial).
 */
export type GenDecision =
  | { allow: true; mode: 'free' | 'paid'; commit: () => void }
  | { allow: false }

type PaywallApi = { requireGeneration: (kind: GenKind) => GenDecision }
const PaywallCtx = createContext<PaywallApi | null>(null)

type Modal = { kind: GenKind; mode: 'subscribe' | 'topup' } | null

export function PaywallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { mutate } = useStore()
  const [modal, setModal] = useState<Modal>(null)

  const requireGeneration = useCallback(
    (kind: GenKind): GenDecision => {
      if (!user) return { allow: false }
      const cost = COSTS[kind]

      // 1) The one free trial per kind — the aha-moment, on the house.
      if (!freeGenUsed(user.id, kind)) {
        return { allow: true, mode: 'free', commit: () => markFreeGen(user.id, kind) }
      }

      // 2) Paid plans spend coins (deduction reads the LIVE store, so batches never over/under-charge).
      if (isPaidPlan(user.plan)) {
        if (user.coins >= cost) {
          return {
            allow: true,
            mode: 'paid',
            commit: () =>
              mutate((d) => ({ ...d, users: d.users.map((u) => (u.id === user.id ? { ...u, coins: Math.max(0, u.coins - cost) } : u)) })),
          }
        }
        setModal({ kind, mode: 'topup' }) // out of coins
        return { allow: false }
      }

      // 3) Free plan, trial spent → the wall.
      setModal({ kind, mode: 'subscribe' })
      return { allow: false }
    },
    [user, mutate],
  )

  const value = useMemo(() => ({ requireGeneration }), [requireGeneration])

  return (
    <PaywallCtx.Provider value={value}>
      {children}
      {modal && <Paywall kind={modal.kind} mode={modal.mode} onClose={() => setModal(null)} />}
    </PaywallCtx.Provider>
  )
}

export function usePaywall(): PaywallApi {
  const ctx = useContext(PaywallCtx)
  if (!ctx) throw new Error('usePaywall must be used within <PaywallProvider>')
  return ctx
}

/* ---------------- the wall ---------------- */

function Paywall({ kind, mode, onClose }: { kind: GenKind; mode: 'subscribe' | 'topup'; onClose: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  const go = (to: string) => {
    onClose()
    navigate(to)
  }
  return (
    <div className="pw-scrim" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="pw" onClick={(e) => e.stopPropagation()}>
        <button className="pw__x" type="button" onClick={onClose} aria-label={t('paywall.later')}>
          ×
        </button>
        <span className="pw__badge">{t('paywall.trialBadge')}</span>
        <h2 className="pw__title">{t(mode === 'topup' ? 'paywall.topup.title' : 'paywall.subscribe.title')}</h2>
        <p className="pw__body">{t(mode === 'topup' ? 'paywall.topup.body' : 'paywall.subscribe.body')}</p>
        <ul className="pw__perks">
          <li>{t('paywall.perk1')}</li>
          <li>{t('paywall.perk2')}</li>
          <li>{t('paywall.perk3')}</li>
        </ul>
        <p className="pw__cost">{t('paywall.cost', { n: COSTS[kind] })}</p>
        <div className="pw__actions">
          <button className="pw__cta" type="button" onClick={() => go('/pricing')}>
            {t('paywall.cta.plans')} →
          </button>
          <button className="pw__alt" type="button" onClick={() => go('/rewards')}>
            {t('paywall.cta.topup')}
          </button>
        </div>
        <button className="pw__later" type="button" onClick={onClose}>
          {t('paywall.later')}
        </button>
      </div>
    </div>
  )
}
