/* ============================================================
   Earn Coins — the coin economy + viral growth hub.
   Coins are the only currency inside loom studios. Here you buy
   them (the single place a € price appears), refer friends for a
   free month, and go viral for coins. Built to make people want to
   post, post, post.
   ============================================================ */

import { useState } from 'react'
import { useT } from '@/i18n'
import { SuitePage } from '../_shared/SuitePage'
import { useToast } from '../../components/ui/Toast'
import { IcoCoins } from '../../components/ui/Icons'
import { useRewards } from '../../economy/useRewards'
import { COIN_PACKS, VIRAL_TASKS, type ViralTask } from '../../economy/economy'
import './rewards.css'

export function Rewards() {
  const t = useT()
  const toast = useToast()
  const r = useRewards()
  const [submitFor, setSubmitFor] = useState<string | null>(null)
  const [url, setUrl] = useState('')

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(r.referral.link)
      toast(t('rewards.ref.copied'), 'success')
    } catch {
      toast(r.referral.link, 'info')
    }
  }

  const buy = (pack: (typeof COIN_PACKS)[number]) => {
    r.buyPack(pack)
    toast(t('rewards.buy.bought', { n: (pack.coins + pack.bonus).toLocaleString() }), 'success')
  }

  const claim = (task: ViralTask, link?: string) => {
    const ok = r.claimTask(task, link)
    if (ok) toast(t('rewards.task.claimed', { n: task.reward }), 'success')
    else toast(t('rewards.task.cooldown'), 'info')
    setSubmitFor(null)
    setUrl('')
  }

  return (
    <SuitePage eyebrow={t('rewards.page.eyebrow')} title={t('rewards.page.title')} subtitle={t('rewards.page.subtitle')} wide>
      <div className="rw">
        {/* balance */}
        <section className="rw-balance">
          <div className="rw-balance__main">
            <span className="rw-balance__label">{t('rewards.balance.label')}</span>
            <span className="rw-balance__value">
              <IcoCoins width="34" height="34" />
              {r.balance.toLocaleString()}
              <small>{t('rewards.balance.coins')}</small>
            </span>
          </div>
          <p className="rw-balance__hint">{t('rewards.balance.hint')}</p>
        </section>

        {/* refer & earn — the growth engine */}
        <section className="rw-card rw-ref">
          <div className="rw-ref__head">
            <h2>🎁 {t('rewards.ref.title')}</h2>
            <p>{t('rewards.ref.desc')}</p>
          </div>
          <div className="rw-ref__linkrow">
            <input className="rw-ref__link" readOnly value={r.referral.link} onFocus={(e) => e.currentTarget.select()} />
            <button className="s-btn s-btn--accent" type="button" onClick={copyLink}>
              {t('rewards.ref.copy')}
            </button>
          </div>
          <div className="rw-ref__stats">
            <div className="rw-stat">
              <b>{r.referral.invited}</b>
              <span>{t('rewards.ref.invited')}</span>
            </div>
            <div className="rw-stat">
              <b>{r.referral.subscribed}</b>
              <span>{t('rewards.ref.subscribed')}</span>
            </div>
            <div className="rw-stat rw-stat--accent">
              <b>{r.referral.freeMonths}</b>
              <span>{t('rewards.ref.freeMonths')}</span>
            </div>
            <div className="rw-stat">
              <b className="rw-stat__code">{r.referral.code}</b>
              <span>{t('rewards.ref.code')}</span>
            </div>
          </div>
          <p className="rw-ref__how">{t('rewards.ref.how')}</p>
        </section>

        {/* go viral, get coins */}
        <section className="rw-card">
          <div className="rw-sec-head">
            <h2>🔥 {t('rewards.earn.title')}</h2>
            <p>{t('rewards.earn.desc')}</p>
          </div>
          <div className="rw-tasks">
            {VIRAL_TASKS.map((task) => {
              const ready = r.taskReady(task)
              const isUgc = task.kind === 'ugc' || task.kind === 'social'
              return (
                <div key={task.id} className={`rw-task${ready ? '' : ' is-done'}`}>
                  <div className="rw-task__body">
                    <span className="rw-task__title">{t(`rewards.task.${task.id}.title`)}</span>
                    <span className="rw-task__desc">{t(`rewards.task.${task.id}.desc`)}</span>
                  </div>
                  <span className="rw-task__reward">{t('rewards.task.reward', { n: task.reward })}</span>
                  {submitFor === task.id ? (
                    <div className="rw-task__submit">
                      <input
                        className="rw-input"
                        autoFocus
                        placeholder={t('rewards.task.submitPlaceholder')}
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                      />
                      <button className="s-btn s-btn--accent" type="button" onClick={() => claim(task, url || undefined)}>
                        {t('rewards.task.submit', { n: task.reward })}
                      </button>
                    </div>
                  ) : (
                    <div className="rw-task__actions">
                      {task.actionUrl && (
                        <a className="s-btn s-btn--ghost" href={task.actionUrl} target="_blank" rel="noreferrer">
                          {t('rewards.task.do')}
                        </a>
                      )}
                      <button
                        className="s-btn s-btn--accent"
                        type="button"
                        disabled={!ready}
                        onClick={() => (isUgc ? setSubmitFor(task.id) : claim(task))}
                      >
                        {!ready ? (task.repeatable ? t('rewards.task.cooldown') : t('rewards.task.oneShot')) : t('rewards.task.claim')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* buy coins — the ONLY place a price shows */}
        <section className="rw-card">
          <div className="rw-sec-head">
            <h2>💎 {t('rewards.buy.title')}</h2>
            <p>{t('rewards.buy.desc')}</p>
          </div>
          <div className="rw-packs">
            {COIN_PACKS.map((pack) => (
              <div key={pack.id} className={`rw-pack${pack.badge ? ` rw-pack--${pack.badge}` : ''}`}>
                {pack.badge && <span className="rw-pack__badge">{t(pack.badge === 'popular' ? 'rewards.buy.badgePopular' : 'rewards.buy.badgeBest')}</span>}
                <span className="rw-pack__name">{t(pack.labelKey)}</span>
                <span className="rw-pack__coins">
                  <IcoCoins width="18" height="18" />
                  {t('rewards.buy.coins', { n: pack.coins.toLocaleString() })}
                </span>
                {pack.bonus > 0 && <span className="rw-pack__bonus">{t('rewards.buy.bonus', { n: pack.bonus.toLocaleString() })}</span>}
                <span className="rw-pack__price">{pack.price}</span>
                <button className="s-btn s-btn--accent rw-pack__buy" type="button" onClick={() => buy(pack)}>
                  {t('rewards.buy.cta')}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* coin history */}
        <section className="rw-card">
          <div className="rw-sec-head">
            <h2>{t('rewards.history.title')}</h2>
          </div>
          {r.state.ledger.length === 0 ? (
            <p className="rw-empty">{t('rewards.history.empty')}</p>
          ) : (
            <ul className="rw-ledger">
              {r.state.ledger.slice(0, 12).map((e, i) => (
                <li key={i} className="rw-ledger__row">
                  <span className="rw-ledger__reason">{e.reason}</span>
                  <span className={`rw-ledger__delta${e.delta >= 0 ? ' is-pos' : ' is-neg'}`}>
                    {e.delta >= 0 ? '+' : ''}
                    {e.delta.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </SuitePage>
  )
}
