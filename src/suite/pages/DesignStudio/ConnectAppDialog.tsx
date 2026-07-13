import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import './connect.css'

/**
 * "Connect App" — communicates the loom studios iPad workflow that is on the roadmap. It is honest
 * about status (a Coming Soon badge, no fake pairing controls) while making the future concrete:
 * the desktop stays the command center, the tablet becomes the Apple Pencil drawing surface, and
 * strokes land live on this canvas. No dead UI — the button opens this real, explanatory panel.
 */
export function ConnectAppDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const steps = [
    { n: 1, t: 'Open loom studios on iPad', d: 'Install the app and sign in with this same account.' },
    { n: 2, t: 'Pair with this studio', d: 'A one-time code links the tablet to the desktop session.' },
    { n: 3, t: 'Draw with Apple Pencil', d: 'Pressure and tilt, on the surface that feels natural.' },
    { n: 4, t: 'It appears live here', d: 'Every stroke lands on this canvas as its own layer.' },
  ]

  return createPortal(
    <div className="suite">
      <div className="cn-scrim" onClick={onClose} />
      <div className="cn-panel" role="dialog" aria-modal="true" aria-labelledby="cn-title">
        <div className="cn-head">
          <div className="cn-eyebrow">
            <span>loom studios for iPad</span>
            <span className="cn-soon">Coming soon</span>
          </div>
          <button type="button" className="cn-x" aria-label="Close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <h1 id="cn-title" className="cn-title">Your iPad becomes the drawing surface</h1>
        <p className="cn-sub">
          The desktop stays your command center — layers, vectors, garment, export. Pick up the tablet
          and draw with Apple Pencil; the strokes show up here, live.
        </p>

        <div className="cn-stage" aria-hidden="true">
          <svg viewBox="0 0 420 150" className="cn-illo">
            {/* desktop — command center */}
            <rect x="14" y="26" width="150" height="92" rx="7" className="cn-screen" />
            <rect x="26" y="38" width="70" height="10" rx="3" className="cn-accent-fill" />
            <rect x="26" y="56" width="126" height="6" rx="3" className="cn-muted" />
            <rect x="26" y="68" width="110" height="6" rx="3" className="cn-muted" />
            <rect x="26" y="80" width="120" height="6" rx="3" className="cn-muted" />
            <rect x="60" y="122" width="58" height="6" rx="3" className="cn-screen" />
            {/* live link */}
            <path d="M176 72h68" className="cn-link" />
            <circle className="cn-pulse" r="4" cx="176" cy="72" />
            {/* tablet — drawing surface */}
            <rect x="258" y="16" width="120" height="118" rx="10" className="cn-screen" />
            <path d="M286 96c10-30 20-30 30-8s18 14 24-4" className="cn-stroke-demo" />
            {/* apple pencil */}
            <g className="cn-pencil">
              <rect x="330" y="70" width="8" height="58" rx="4" transform="rotate(34 334 99)" className="cn-accent-fill" />
              <path d="M349 78l4 6" className="cn-muted" />
            </g>
          </svg>
        </div>

        <ol className="cn-steps">
          {steps.map((s) => (
            <li key={s.n} className="cn-step">
              <span className="cn-step__n">{s.n}</span>
              <span className="cn-step__body">
                <b>{s.t}</b>
                <small>{s.d}</small>
              </span>
            </li>
          ))}
        </ol>

        <div className="cn-foot">
          <p className="cn-note">Not available yet — we’re building it. Painting tools arrive with the app.</p>
          <button type="button" className="cn-cta" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
