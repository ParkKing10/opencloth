import { IcoSparkle } from '../../components/ui/Icons'
import type { Suggestion } from './studioModel'

type Props = {
  suggestions: Suggestion[]
  appliedNotes: string[]
  onApply: (s: Suggestion) => void
  onDismiss: (id: string) => void
}

/** The AI Companion — a senior designer reading the project. Never auto-applies. */
export function AICompanion({ suggestions, appliedNotes, onApply, onDismiss }: Props) {
  return (
    <section className="ai-comp">
      <div className="ai-comp__head">
        <span className="ai-comp__mark" aria-hidden>
          <IcoSparkle width="15" height="15" />
        </span>
        <div>
          <b>AI Companion</b>
          <small>Design co-pilot · always suggests, never changes on its own</small>
        </div>
      </div>

      {suggestions.length === 0 ? (
        <p className="ai-comp__clear">
          <span className="ai-comp__clear-check" aria-hidden>✓</span>
          Looking good — no notes right now.
        </p>
      ) : (
        <div className="ai-comp__list">
          {suggestions.map((s) => (
            <div className="ai-comp__card" key={s.id}>
              <p className="ai-comp__msg">{s.text}</p>
              <div className="ai-comp__actions">
                <button type="button" className="ai-comp__dismiss" onClick={() => onDismiss(s.id)}>
                  Dismiss
                </button>
                {s.actions.length > 0 && (
                  <button type="button" className="ai-comp__apply" onClick={() => onApply(s)}>
                    Apply
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {appliedNotes.length > 0 && (
        <div className="ai-comp__applied">
          <span className="ai-comp__applied-label">Applied</span>
          <ul>
            {appliedNotes.map((n, i) => (
              <li key={`${n}-${i}`}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
