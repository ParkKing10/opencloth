import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/i18n'
import './guided-overlay.css'

export type GuidedStep = {
  /** Short leading token — a badge like "PDF" / ".ZIP", or a number. */
  tag: string
  title: string
  desc: string
}

type Props = {
  open: boolean
  eyebrow?: string
  title: string
  lede: string
  steps: GuidedStep[]
  continueLabel?: string
  skipLabel?: string
  /** Fires when the user proceeds. `dontShowAgain` reflects the checkbox. */
  onContinue: (dontShowAgain: boolean) => void
  /** Fires when the user backs out (Esc, backdrop, or the skip button). */
  onSkip: (dontShowAgain: boolean) => void
}

/**
 * A guided primer for an important workflow. It explains the real choices ahead, then gets out
 * of the way: Skip backs out, Continue proceeds, and "Don't show this again" makes it one-time.
 * Purely presentational — the caller owns the persistence (see useOnceFlag).
 */
export function GuidedOverlay({
  open,
  eyebrow,
  title,
  lede,
  steps,
  continueLabel,
  skipLabel,
  onContinue,
  onSkip,
}: Props) {
  const t = useT()
  const [dontShow, setDontShow] = useState(false)
  const continueRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    setDontShow(false)
    continueRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="go-overlay" role="dialog" aria-modal="true" aria-labelledby="go-title" onMouseDown={() => onSkip(dontShow)}>
      <div className="go-card" onMouseDown={(e) => e.stopPropagation()}>
        {eyebrow && <span className="go-eyebrow">{eyebrow}</span>}
        <h2 className="go-title" id="go-title">
          {title}
        </h2>
        <p className="go-lede">{lede}</p>

        <ol className="go-steps">
          {steps.map((s) => (
            <li className="go-step" key={s.title}>
              <span className="go-step__tag">{s.tag}</span>
              <span className="go-step__text">
                <b>{s.title}</b>
                <small>{s.desc}</small>
              </span>
            </li>
          ))}
        </ol>

        <div className="go-foot">
          <label className="go-check">
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
            <span>{t('sharedUi.dontShowAgain')}</span>
          </label>
          <div className="go-actions">
            <button type="button" className="go-btn go-btn--ghost" onClick={() => onSkip(dontShow)}>
              {skipLabel ?? t('sharedUi.notNow')}
            </button>
            <button ref={continueRef} type="button" className="go-btn go-btn--accent" onClick={() => onContinue(dontShow)}>
              {continueLabel ?? t('sharedUi.continue')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Optional slot for callers that want to compose extra content under the steps. */
export function GuidedNote({ children }: { children: ReactNode }) {
  return <p className="go-note">{children}</p>
}
