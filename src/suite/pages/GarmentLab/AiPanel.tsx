/**
 * AI Designer panel (redesigned in Milestone 8.2, Part 4). Large prompt, prominent full-width lime
 * "Generate Edit" button with a live thinking state, suggestions, and a conversation-style timeline
 * of recent edits (restore any version). AI edits the garment through the provider (OpenAI when
 * configured, else the deterministic placeholder) — always an editable garment, never an image.
 */
import { useState } from 'react'
import { useT } from '@/i18n'
import type { GarmentHistory } from '../../garment-model/garmentRevision'
import { revisionLabel } from '../../garment-model/garmentRevision'
import type { AiEditResult } from '../../garment-model/aiGarmentEditor'
import { isLiveAi } from '../../garment-model/garmentGeneration'

const SUGGESTIONS = ['removeButtons', 'addButtons', 'widerSleeves', 'cropped', 'oversized', 'distressed'] as const

type Props = {
  history: GarmentHistory
  onApply: (prompt: string) => Promise<AiEditResult>
  onRestore: (index: number) => void
}

export function AiPanel({ history, onApply, onRestore }: Props) {
  const t = useT()
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
        <span className="ai-panel__eyebrow">{t('labPanels.ai.eyebrow')}</span>
        <p className="ai-panel__hint">{t('labPanels.ai.hint')}</p>
      </div>

      <div className="ai-composer">
        <textarea
          className="ai-prompt"
          rows={4}
          placeholder={t('labPanels.ai.placeholder')}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void run()
          }}
          aria-label={t('labPanels.ai.promptAria')}
        />
        <div className="ai-suggest">
          {SUGGESTIONS.map((s) => {
            const label = t(`labPanels.suggest.${s}`)
            return (
              <button key={s} type="button" className="ai-chip" onClick={() => setPrompt(label)} disabled={busy}>
                {label}
              </button>
            )
          })}
        </div>
        <button type="button" className={`ai-generate${busy ? ' is-busy' : ''}`} onClick={() => void run()} disabled={busy || !prompt.trim()}>
          {busy ? (
            <>
              <span className="ai-thinking" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {t('labPanels.ai.generating')}
            </>
          ) : (
            t('labPanels.ai.generate')
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
          <p>{t('labPanels.ai.empty')}</p>
        </div>
      )}

      {history.revisions.length > 1 && (
        <div className="ai-timeline">
          <span className="ai-timeline__label">{t('labPanels.ai.recentEdits')}</span>
          <ol className="ai-timeline__list">
            {history.revisions.map((rev, i) => (
              <li key={rev.id}>
                <button type="button" className={`ai-rev${i === history.currentIndex ? ' is-current' : ''}`} onClick={() => onRestore(i)} title={t('labPanels.ai.restore')}>
                  <span className={`ai-rev__kind ai-rev__kind--${rev.source.kind}`}>
                    {rev.source.kind === 'ai' ? t('labPanels.rev.ai') : rev.source.kind === 'manual' ? t('labPanels.rev.manual') : t('labPanels.rev.base')}
                  </span>
                  <span className="ai-rev__label">{revisionLabel(rev)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="ai-panel__note">
        {live ? t('labPanels.ai.noteLive') : t('labPanels.ai.notePlaceholder')}
      </p>
    </div>
  )
}
