import { useT } from '@/i18n'
import type { Readiness } from '../../export/readiness'

/** The Manufacturing Readiness popover — live score ring + ready/missing checklist. */
export function ReadinessPanel({ readiness, onFix }: { readiness: Readiness; onFix?: (id: string) => void }) {
  const t = useT()
  const { score, ready, missing } = readiness
  const tone = score >= 90 ? 'good' : score >= 70 ? 'warn' : 'low'

  return (
    <div className="rp">
      <div className="rp__head">
        <div className={`rp-ring rp-ring--${tone}`} role="img" aria-label={t('dsPanels.rp.ariaScore', { score })}>
          <svg viewBox="0 0 36 36">
            <circle className="rp-ring__track" cx="18" cy="18" r="15.9" pathLength={100} />
            <circle
              className="rp-ring__fill"
              cx="18"
              cy="18"
              r="15.9"
              pathLength={100}
              strokeDasharray={`${score} 100`}
              transform="rotate(-90 18 18)"
            />
          </svg>
          <span className="rp-ring__num">{score}%</span>
        </div>
        <div className="rp__headtext">
          <span className="rp__eyebrow">{t('dsPanels.rp.eyebrow')}</span>
          <b>{score === 100 ? t('dsPanels.rp.productionReady') : score >= 70 ? t('dsPanels.rp.almostThere') : t('dsPanels.rp.gettingStarted')}</b>
          <small>
            {t('dsPanels.rp.specsComplete', { done: ready.length, total: readiness.checks.length })}
          </small>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="rp__group">
          <span className="rp__label">{t('dsPanels.rp.needsAttention')}</span>
          {missing.map((c) => (
            <button
              key={c.id}
              type="button"
              className="rp-item rp-item--missing"
              onClick={() => onFix?.(c.id)}
              disabled={!onFix}
              title={onFix ? t('dsPanels.rp.fixNamed', { label: c.label }) : undefined}
            >
              <span className={`rp-item__dot rp-item__dot--${c.severity === 'required' ? 'req' : 'rec'}`} />
              <span className="rp-item__text">
                <b>{c.label}</b>
                {c.hint && <small>{c.hint}</small>}
              </span>
              {onFix && <span className="rp-item__cta">{t('dsPanels.rp.fix')}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="rp__group">
        <span className="rp__label">{t('dsPanels.rp.ready')}</span>
        {ready.map((c) => (
          <div key={c.id} className="rp-item">
            <span className="rp-item__check" aria-hidden>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span className="rp-item__text">
              <b>{c.label}</b>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
