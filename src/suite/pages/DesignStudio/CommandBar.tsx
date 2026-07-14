import { useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import type { Readiness } from '../../export/readiness'
import { type Proposal } from './studioModel'
import type { AiMode } from './ThreadosAIModal'
import { ReadinessPanel } from './ReadinessPanel'
import './smart-studio.css'

export type StudioMode = 'beginner' | 'pro'

type Props = {
  readiness: Readiness
  /** Kept for API compatibility — the inline command bar is now a single button that opens the panel. */
  interpret?: (text: string) => Proposal | null
  onApply?: (p: Proposal) => void
  onFix: (checkId: string) => void
  /** Kept for API compatibility — the AI now lives in the Library rail, opened from there. */
  onGenerate?: (prompt: string, mode: AiMode) => void
  /** Open the Connect App panel (draw on iPad, live on the desktop canvas). */
  onConnectApp: () => void
}

/** The top bar — just Connect App + the manufacturing-readiness pill. loom studios AI now lives in the
 *  Library rail on the left, so there is no AI button up here. */
export function CommandBar({ readiness, onFix, onConnectApp }: Props) {
  const t = useT()
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

  const tone = readiness.score >= 90 ? 'good' : readiness.score >= 70 ? 'warn' : 'low'

  return (
    <div className="cb">
      <div className="cb__right">
        <button
          type="button"
          className="cb__connect"
          onClick={onConnectApp}
          title={t('dsPanels.cb.connectTitle')}
        >
          <span className="cb__connect-glow" aria-hidden />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="7" y="2.5" width="10" height="19" rx="2" />
            <circle cx="12" cy="18.4" r="0.9" fill="currentColor" stroke="none" />
            <path d="M9.6 6.6c1.5-1.2 3.3-1.2 4.8 0M11 9c.7-.5 1.3-.5 2 0" />
          </svg>
          {t('dsPanels.cb.connect')}
          <span className="cb__connect-badge">{t('dsPanels.cb.new')}</span>
        </button>

        <div className="cb__pill-wrap" ref={pillRef}>
          <button
            type="button"
            className={`cb__pill cb__pill--${tone}`}
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
            title={t('dsPanels.cb.readyTitle')}
          >
            <span className="cb__pill-dot" />
            {readiness.score}%
            <span className="cb__pill-label">{t('dsPanels.cb.ready')}</span>
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
    </div>
  )
}
