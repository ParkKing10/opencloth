import { useEffect, useRef, useState } from 'react'
import { IcoSparkle } from '../../components/ui/Icons'
import type { Readiness } from '../../export/readiness'
import { type Proposal } from './studioModel'
import { describesGraphic, describesGarmentEdit } from '../../ai/promptParse'
import type { AiMode } from './ThreadosAIModal'
import { ReadinessPanel } from './ReadinessPanel'
import './smart-studio.css'

export type StudioMode = 'beginner' | 'pro'

/** Imagination-first prompts — describe a graphic and THREADOS AI generates it. */
const GENERATION_EXAMPLES = ['Chrome tribal star', 'Vintage skull with roses', 'Graffiti butterfly']

type Props = {
  readiness: Readiness
  interpret: (text: string) => Proposal | null
  onApply: (p: Proposal) => void
  onFix: (checkId: string) => void
  /** Open THREADOS AI — 'graphic' to design an artwork, 'garment' to edit the garment itself. */
  onGenerate: (prompt: string, mode: AiMode) => void
  /** Open the Connect App panel (draw on iPad, live on the desktop canvas). */
  onConnectApp: () => void
}

/** The permanent AI command bar at the top of the editor. */
export function CommandBar({ readiness, interpret, onApply, onFix, onGenerate, onConnectApp }: Props) {
  const [input, setInput] = useState('')
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [missNote, setMissNote] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const pillRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /** Customize = refine the command: keep the text, close the card, put the cursor back. */
  function customize() {
    setProposal(null)
    inputRef.current?.focus()
    inputRef.current?.select()
  }

  useEffect(() => {
    if (!panelOpen) return
    const onDown = (e: MouseEvent) => {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) setPanelOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [panelOpen])

  function submit() {
    const text = input.trim()
    setProposal(null)
    setMissNote(false)
    // Empty prompt → still open THREADOS AI so you can pick Design vs Edit Garment and type there.
    // The button is never dead. Then:
    // (1) a garment/fabric edit ("mach die Jacke mit Löchern") opens straight into Edit Garment;
    // (2) a known studio command ("make it oversized") stays inline as a quick, free Proposal;
    // (3) anything else opens THREADOS AI in Design mode — the modal's toggle is always there to switch.
    if (!text) {
      onGenerate('', 'graphic')
      return
    }
    if (describesGarmentEdit(text)) {
      onGenerate(text, 'garment')
      return
    }
    if (!describesGraphic(text)) {
      const p = interpret(text)
      if (p) {
        setProposal(p)
        return
      }
    }
    onGenerate(text, 'graphic')
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
          ref={inputRef}
          className="cb__input"
          placeholder="Describe a graphic — “chrome tribal star” — or an edit — “make it oversized”…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          aria-label="AI command"
        />
        <div className="cb__chips">
          {GENERATION_EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="cb__chip" onClick={() => onGenerate(ex, 'graphic')}>
              {ex}
            </button>
          ))}
        </div>
        <button className="cb__go" type="button" onClick={submit} title="Open THREADOS AI — choose Design or Edit Garment">
          Ask THREADOS AI
        </button>
      </div>

      <div className="cb__right">
        <button
          type="button"
          className="cb__connect"
          onClick={onConnectApp}
          title="Draw on your iPad with Apple Pencil — live on this canvas"
        >
          <span className="cb__connect-glow" aria-hidden />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="7" y="2.5" width="10" height="19" rx="2" />
            <circle cx="12" cy="18.4" r="0.9" fill="currentColor" stroke="none" />
            <path d="M9.6 6.6c1.5-1.2 3.3-1.2 4.8 0M11 9c.7-.5 1.3-.5 2 0" />
          </svg>
          Connect App
          <span className="cb__connect-badge">NEW</span>
        </button>

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
            <button type="button" className="cb-proposal__customize" onClick={customize} title="Refine the command text">
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
