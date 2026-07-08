import { useEffect, useRef, useState } from 'react'
import { IcoSparkle } from '../../components/ui/Icons'
import type { Readiness } from '../../export/readiness'
import { COMMAND_EXAMPLES, type Proposal } from './studioModel'
import { ReadinessPanel } from './ReadinessPanel'
import './smart-studio.css'

export type StudioMode = 'beginner' | 'pro'

type Props = {
  mode: StudioMode
  onModeChange: (m: StudioMode) => void
  readiness: Readiness
  interpret: (text: string) => Proposal | null
  onApply: (p: Proposal) => void
  onFix: (checkId: string) => void
}

/** The permanent AI command bar at the top of the editor. */
export function CommandBar({ mode, onModeChange, readiness, interpret, onApply, onFix }: Props) {
  const [input, setInput] = useState('')
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [missNote, setMissNote] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const pillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!panelOpen) return
    const onDown = (e: MouseEvent) => {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) setPanelOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [panelOpen])

  function submit() {
    const p = interpret(input)
    setProposal(p)
    setMissNote(!p && input.trim().length > 0)
  }

  function apply() {
    if (!proposal) return
    onApply(proposal)
    setProposal(null)
    setInput('')
    setMissNote(false)
  }

  const tone = readiness.score >= 90 ? 'good' : readiness.score >= 70 ? 'warn' : 'low'

  return (
    <div className="cb">
      <div className="cb__main">
        <span className="cb__spark" aria-hidden>
          <IcoSparkle width="16" height="16" />
        </span>
        <input
          className="cb__input"
          placeholder="Describe what you want to change…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          aria-label="AI command"
        />
        <div className="cb__chips">
          {COMMAND_EXAMPLES.slice(0, 3).map((ex) => (
            <button key={ex} type="button" className="cb__chip" onClick={() => setInput(ex)}>
              {ex}
            </button>
          ))}
        </div>
        <button className="cb__go" type="button" onClick={submit} disabled={!input.trim()}>
          Ask THREADOS AI
        </button>
      </div>

      <div className="cb__right">
        <div className="cb__mode" role="tablist" aria-label="Editor mode">
          {(['beginner', 'pro'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`cb__mode-btn${mode === m ? ' is-active' : ''}`}
              onClick={() => onModeChange(m)}
            >
              {m === 'beginner' ? 'Beginner' : 'Pro'}
            </button>
          ))}
        </div>

        <div className="cb__pill-wrap" ref={pillRef}>
          <button
            type="button"
            className={`cb__pill cb__pill--${tone}`}
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
            title="Manufacturing readiness"
          >
            <span className="cb__pill-dot" />
            {readiness.score}%
            <span className="cb__pill-label">Ready</span>
          </button>
          {panelOpen && (
            <div className="cb__panel">
              <ReadinessPanel
                readiness={readiness}
                onFix={(id) => {
                  onFix(id)
                }}
              />
            </div>
          )}
        </div>
      </div>

      {proposal && (
        <div className="cb-proposal">
          <span className="cb-proposal__spark" aria-hidden>
            <IcoSparkle width="15" height="15" />
          </span>
          <div className="cb-proposal__text">
            <span className="cb-proposal__eyebrow">Proposed change</span>
            <b>{proposal.title}</b>
            <small>{proposal.detail}</small>
          </div>
          <div className="cb-proposal__actions">
            <button type="button" className="cb-proposal__dismiss" onClick={() => setProposal(null)}>
              Dismiss
            </button>
            <button type="button" className="cb-proposal__customize" onClick={() => setProposal(null)}>
              Customize
            </button>
            <button type="button" className="cb-proposal__apply" onClick={apply}>
              Apply
            </button>
          </div>
        </div>
      )}
      {missNote && !proposal && (
        <div className="cb-proposal cb-proposal--miss">
          <div className="cb-proposal__text">
            <small>
              I couldn’t map that to a change yet. Try “make it oversized”, “add a vintage wash”, “move the logo to the left
              chest”, “use embroidery”, or “make it premium”.
            </small>
          </div>
          <button type="button" className="cb-proposal__dismiss" onClick={() => setMissNote(false)}>
            Got it
          </button>
        </div>
      )}
    </div>
  )
}
