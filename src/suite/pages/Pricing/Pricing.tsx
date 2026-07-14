/* ============================================================
   Pricing — the subscription offer (sold in €). Each plan grants
   monthly coins; inside the app you only spend coins. Tiered to
   anchor toward the bigger plans: coins-per-euro rises with every
   tier, the annual toggle discounts hard, and the value stacks.
   ============================================================ */

import { useState } from 'react'
import { useT } from '@/i18n'
import { SuitePage } from '../_shared/SuitePage'
import { useAuth } from '../../auth/auth'
import { useStore } from '../../data/store'
import { useToast } from '../../components/ui/Toast'
import { IcoCoins, IcoCheck } from '../../components/ui/Icons'
import { useRewards } from '../../economy/useRewards'
import {
  PRICING_TIERS,
  annualSavePct,
  coinsPerEuro,
  priceFor,
  type BillingCycle,
  type PricingTier,
} from '../../economy/economy'
import './pricing.css'

const FAQS = [1, 2, 3, 4, 5, 6]
const maxSave = Math.max(...PRICING_TIERS.map(annualSavePct))
const bestPerEuroId = [...PRICING_TIERS].sort((a, b) => coinsPerEuro(b, 'annual') - coinsPerEuro(a, 'annual'))[0].id

export function Pricing() {
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const { mutate } = useStore()
  const { grant } = useRewards()
  const [cycle, setCycle] = useState<BillingCycle>('annual')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const subscribe = (tier: PricingTier) => {
    if (!user) return
    mutate((d) => ({ ...d, users: d.users.map((u) => (u.id === user.id ? { ...u, plan: tier.id } : u)) }))
    grant(tier.coins, `${tier.id} plan — monthly coins`)
    toast(t('pricing.chosen', { plan: t(`pricing.tier.${tier.id}.name`), n: tier.coins.toLocaleString() }), 'success')
  }

  return (
    <SuitePage eyebrow={t('pricing.page.eyebrow')} title={t('pricing.page.title')} subtitle={t('pricing.page.subtitle')} wide>
      <div className="pr">
        {/* monthly / annual toggle */}
        <div className="pr-cycle">
          <button className={`pr-cycle__opt${cycle === 'monthly' ? ' is-on' : ''}`} type="button" onClick={() => setCycle('monthly')}>
            {t('pricing.cycle.monthly')}
          </button>
          <button className={`pr-cycle__opt${cycle === 'annual' ? ' is-on' : ''}`} type="button" onClick={() => setCycle('annual')}>
            {t('pricing.cycle.annual')}
            <span className="pr-cycle__save">{t('pricing.cycle.save', { n: maxSave })}</span>
          </button>
        </div>

        {/* tier grid */}
        <div className="pr-grid">
          {PRICING_TIERS.map((tier) => {
            const price = priceFor(tier, cycle)
            const isCurrent = user?.plan === tier.id
            const perEuro = coinsPerEuro(tier, cycle)
            return (
              <div
                key={tier.id}
                className={`pr-card${tier.badge ? ` pr-card--${tier.badge}` : ''}`}
                style={{ ['--tier' as string]: tier.accent }}
              >
                <span className="pr-card__stripe" />
                <div className="pr-card__head">
                  <span className="pr-card__name">{t(`pricing.tier.${tier.id}.name`)}</span>
                  {tier.badge && <span className="pr-card__badge">{t(tier.badge === 'popular' ? 'pricing.badge.popular' : 'pricing.badge.best')}</span>}
                </div>

                <div className="pr-card__price">
                  {cycle === 'annual' && <s className="pr-card__was">€{tier.monthly}</s>}
                  <b>€{price}</b>
                  <span className="pr-card__per">{t('pricing.perMonth')}</span>
                </div>
                <span className="pr-card__cycle">
                  {cycle === 'annual' ? t('pricing.billedAnnual', { n: annualSavePct(tier) }) : ''}
                </span>

                <button
                  className="pr-card__cta"
                  type="button"
                  disabled={isCurrent}
                  onClick={() => subscribe(tier)}
                >
                  {isCurrent ? t('pricing.currentPlan') : t('pricing.getStarted')}
                </button>

                <p className="pr-card__tag">{t(`pricing.tier.${tier.id}.tagline`)}</p>

                <div className="pr-card__coins">
                  <IcoCoins width="17" height="17" />
                  <b>{t('pricing.coinsMonth', { n: tier.coins.toLocaleString() })}</b>
                </div>
                <div className="pr-card__pereuro">
                  {t('pricing.perEuro', { n: perEuro })}
                  {tier.id === bestPerEuroId && <span className="pr-card__pereuro-badge">{t('pricing.mostPerEuro')}</span>}
                </div>

                <ul className="pr-card__list">
                  {tier.inherits && <li className="pr-card__inherit">{t('pricing.inherits', { plan: t(`pricing.tier.${tier.inherits}.name`) })}</li>}
                  {Array.from({ length: tier.bullets }, (_, i) => (
                    <li key={i}>
                      <IcoCheck width="15" height="15" />
                      {t(`pricing.feat.${tier.id}.${i + 1}`)}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <p className="pr-guarantee">{t('pricing.moneyBack')}</p>

        {/* FAQs */}
        <section className="pr-faq">
          <h2>{t('pricing.faq.title')}</h2>
          <div className="pr-faq__list">
            {FAQS.map((n) => (
              <div key={n} className={`pr-faq__row${openFaq === n ? ' is-open' : ''}`}>
                <button className="pr-faq__q" type="button" onClick={() => setOpenFaq(openFaq === n ? null : n)}>
                  <span>{t(`pricing.faq.q${n}`)}</span>
                  <span className="pr-faq__plus">{openFaq === n ? '−' : '+'}</span>
                </button>
                {openFaq === n && <p className="pr-faq__a">{t(`pricing.faq.a${n}`)}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </SuitePage>
  )
}
