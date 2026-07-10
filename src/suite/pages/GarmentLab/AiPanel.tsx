/**
 * AI Designer panel (redesigned in Milestone 8.2, Part 4). Large prompt, prominent full-width lime
 * "Generate Edit" button with a live thinking state, suggestions, and a conversation-style timeline
 * of recent edits (restore any version). AI edits the garment through the provider (OpenAI when
 * configured, else the deterministic placeholder) — always an editable garment, never an image.
 */
import { useState } from 'react'
import type { GarmentHistory } from '../../garment-model/garmentRevision'
import { revisionLabel } from '../../garment-model/garmentRevision'
import type { AiEditResult } from '../../garment-model/aiGarmentEditor'
import { isLiveAi } from '../../garment-model/garmentGeneration'

const SUGGESTIONS = ['Remove the buttons', 'Add 6 buttons', 'Make the sleeves wider', 'Make it cropped', 'Oversized fit', 'Make it distressed']

type Props = {
  history: GarmentHistory
  onApply: (prompt: string) => Promise<AiEditResult>
  onRestore: (index: number) => void
}

export function AiPanel({ history, onApply, onRestore }: Props) {
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<AiEditResult | null>(null)
  const live = isLiveAi()

  const run = async () => {
    if (!prompt.trim() || busy) return
    setBusy(true)
    try {
      const result = await onApply(prompt)
      setLast(result)
      if (result.understood && result.changedRegionIds.length > 0) setPrompt('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel__head">
        <span className="ai-panel__eyebrow">AI Designer</span>
        <p className="ai-panel__hint">Describe a change — the AI edits only the regions it needs and keeps everything else.</p>
      </div>

      <div className="ai-composer">
        <textarea
          className="ai-prompt"
          rows={4}
          placeholder="e.g. Make the sleeves wider and add a chest pocket"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void run()
          }}
          aria-label="AI edit prompt"
        />
        <div className="ai-suggest">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="ai-chip" onClick={() => setPrompt(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>
        <button type="button" className={`ai-generate${busy ? ' is-busy' : ''}`} onClick={() => void run()} disabled={busy || !prompt.trim()}>
          {busy ? (
            <>
              <span className="ai-thinking" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              Generating edit
            </>
          ) : (
            'Generate Edit'
          )}
        </button>
      </div>

      {last && (
        <div className={`ai-result${last.understood ? '' : ' is-unknown'}`}>
          {last.summary.map((line, i) => (
            <div key={i} className="ai-result__line">
              {last.understood && last.changedRegionIds.length > 0 && i === 0 ? '✓ ' : ''}
              {line}
            </div>
          ))}
        </div>
      )}

      {history.revisions.length <= 1 && !last && (
        <div className="ai-empty">
          <span className="ai-empty__glyph" aria-hidden="true">✦</span>
          <p>No edits yet — describe what you'd like to change and your garment updates instantly.</p>
        </div>
      )}

      {history.revisions.length > 1 && (
        <div className="ai-timeline">
          <span className="ai-timeline__label">Recent edits</span>
          <ol className="ai-timeline__list">
            {history.revisions.map((rev, i) => (
              <li key={rev.id}>
                <button type="button" className={`ai-rev${i === history.currentIndex ? ' is-current' : ''}`} onClick={() => onRestore(i)} title="Restore this version">
                  <span className={`ai-rev__kind ai-rev__kind--${rev.source.kind}`}>
                    {rev.source.kind === 'ai' ? 'AI' : rev.source.kind === 'manual' ? 'Edit' : 'Base'}
                  </span>
                  <span className="ai-rev__label">{revisionLabel(rev)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="ai-panel__note">
        {live
          ? 'OpenAI is connected — edits run through the real provider and are validated as editable garments.'
          : 'Deterministic placeholder active. Connect OpenAI in Settings → AI for full AI editing. Either way, the result is always an editable garment — never an image.'}
      </p>
    </div>
  )
}
