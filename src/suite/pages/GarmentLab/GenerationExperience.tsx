/**
 * Premium full-screen creation experience (Milestone 8.2). Drives BOTH prompt generation and photo
 * reconstruction: animated phases + progress while `run` produces a real editable garment (front +
 * back, region tree) — never an image. Never frozen; premium retry on failure. When the provider
 * returns per-region confidences (real vision reconstruction), they're shown before opening the editor.
 */
import { useEffect, useRef, useState } from 'react'
import type { EditableGarment } from '../../garment-model/editableGarment'
import type { RegionConfidence } from '../../garment-model/aiProvider'
import './garment-lab.css'

export type CreationResult = {
  garment: EditableGarment
  confidences?: RegionConfidence[]
  /** True when the photo could NOT be analysed and we honestly started from a template. */
  templateStart?: boolean
  /** Honest "detected but not rendered yet" notes (e.g. colour) shown on the review screen. */
  notes?: string[]
}

type Props = {
  eyebrow: string
  title: string
  subtitle?: string
  phases: readonly string[]
  etaLabel: string
  minRevealMs: number
  stepMs: number
  run: () => Promise<CreationResult>
  onComplete: (garment: EditableGarment) => void
  onCancel: () => void
}

export function GenerationExperience({ eyebrow, title, subtitle, phases, etaLabel, minRevealMs, stepMs, run, onComplete, onCancel }: Props) {
  const [phase, setPhase] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [done, setDone] = useState<CreationResult | null>(null)

  const runRef = useRef(run)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    runRef.current = run
    onCompleteRef.current = onComplete
  })

  useEffect(() => {
    let cancelled = false
    setError(null)
    setPhase(0)
    setDone(null)
    const timer = setInterval(() => setPhase((p) => Math.min(p + 1, phases.length - 1)), stepMs)

    Promise.all([runRef.current(), new Promise((res) => setTimeout(res, minRevealMs))])
      .then(([result]) => {
        if (cancelled) return
        clearInterval(timer)
        setPhase(phases.length - 1)
        const r = result as CreationResult
        const hasReview = !!r.templateStart || (r.confidences && r.confidences.length > 0) || (r.notes && r.notes.length > 0)
        setTimeout(() => {
          if (cancelled) return
          if (hasReview) setDone(r)
          else onCompleteRef.current(r.garment)
        }, 320)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        clearInterval(timer)
        setError(err instanceof Error ? err.message : 'Something went wrong')
      })

    return () => {
      cancelled = true
      clearInterval(timer)
    }
    // Runs once per mount / retry. run + onComplete are held in refs so parent re-renders never re-fire it.
  }, [attempt, phases.length, stepMs, minRevealMs])

  if (error) {
    return (
      <div className="gen" role="dialog" aria-modal="true" aria-label="Creation failed">
        <div className="gen__panel gen__panel--error">
          <div className="gen__err-glyph" aria-hidden="true">!</div>
          <h2>That didn't finish</h2>
          <p className="gen__err-msg">{error}</p>
          <div className="gen__err-actions">
            <button type="button" className="s-btn s-btn--subtle" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="s-btn s-btn--accent" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (done) {
    const confidences = done.confidences ?? []
    const notes = done.notes ?? []
    if (done.templateStart) {
      return (
        <div className="gen" role="dialog" aria-modal="true" aria-label="Template start">
          <div className="gen__panel">
            <span className="gen__eyebrow">Couldn't read this photo</span>
            <h2>Template start</h2>
            <p className="gen__prompt">
              We couldn't analyse this photo, so we started you from a neutral editable template — it is
              <strong> not</strong> a reconstruction of your garment. Add an OpenAI key in Settings, or try a
              clearer, straight-on photo. Everything here is still fully editable.
            </p>
            <div className="gen__foot">
              <button type="button" className="s-btn s-btn--accent" onClick={() => onCompleteRef.current(done.garment)}>
                Open template in editor
              </button>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="gen" role="dialog" aria-modal="true" aria-label="Detected garment">
        <div className="gen__panel">
          <span className="gen__eyebrow">Detected from your photo</span>
          <h2>Assembled from detected attributes</h2>
          <p className="gen__prompt">
            loom studios matched your photo to an editable technical flat. Anything below can be refined in the editor.
          </p>
          {confidences.length > 0 && (
            <ul className="gen__conf">
              {confidences.map((c) => (
                <li key={c.label} className={`gen__conf-row${c.value < 75 ? ' is-low' : ''}`}>
                  <span>{c.label}</span>
                  <span className="gen__conf-bar" aria-hidden="true">
                    <i style={{ width: `${Math.max(0, Math.min(100, c.value))}%` }} />
                  </span>
                  <b>{Math.round(c.value)}%</b>
                </li>
              ))}
            </ul>
          )}
          {notes.length > 0 && (
            <ul className="gen__notes">
              {notes.map((n) => (
                <li key={n} className="gen__note">{n}</li>
              ))}
            </ul>
          )}
          <div className="gen__foot">
            <span className="gen__eta">{confidences.length} attribute{confidences.length === 1 ? '' : 's'} detected</span>
            <button type="button" className="s-btn s-btn--accent" onClick={() => onCompleteRef.current(done.garment)}>
              Open in editor
            </button>
          </div>
        </div>
      </div>
    )
  }

  const pct = Math.round(((phase + 1) / phases.length) * 100)

  return (
    <div className="gen" role="dialog" aria-modal="true" aria-label={title}>
      <div className="gen__panel">
        <span className="gen__eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {subtitle && <p className="gen__prompt">{subtitle}</p>}

        <div className="gen__bar" aria-hidden="true">
          <div className="gen__bar-fill" style={{ width: `${pct}%` }} />
        </div>

        <ul className="gen__phases">
          {phases.map((label, i) => (
            <li key={label} className={`gen__phase${i < phase ? ' is-done' : ''}${i === phase ? ' is-active' : ''}`}>
              <span className="gen__phase-dot" aria-hidden="true" />
              {label}
              {i < phase && <span className="gen__phase-check" aria-hidden="true">✓</span>}
            </li>
          ))}
        </ul>

        <div className="gen__foot">
          <span className="gen__eta">{etaLabel}</span>
          <button type="button" className="gen__cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
