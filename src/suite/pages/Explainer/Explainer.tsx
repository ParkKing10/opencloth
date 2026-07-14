/* ============================================================
   Explainer Studio — page shell.
   Default mode is MOTION: an After-Effects-style SaaS explainer
   generated 100% in code (scenes → canvas renderer → video file).
   The screen recorder lives in a secondary tab.
   ============================================================ */

import { useState } from 'react'
import { useT } from '@/i18n'
import { SuitePage } from '../_shared/SuitePage'
import { AdDirector } from './AdDirector'
import { MotionEditor } from './MotionEditor'
import { ScreenRecorder } from './ScreenRecorder'
import './explainer.css'

type Mode = 'director' | 'motion' | 'record'

export function Explainer() {
  const t = useT()
  // Ad Director is the primary experience: upload real footage → one prompt → the AI cuts it into an ad.
  const [mode, setMode] = useState<Mode>('director')
  // While an export/draft runs, switching tabs would unmount the editor and silently
  // kill the render — lock the tabs until it finishes.
  const [busy, setBusy] = useState(false)

  return (
    <SuitePage
      eyebrow={t('explainer.page.eyebrow')}
      title={mode === 'director' ? 'Ad Director' : t('explainer.page.title')}
      subtitle={
        mode === 'director'
          ? 'Upload a screen recording. Write one prompt. The director watches it, cuts the boring parts, and builds a premium ad — no scenes, no timeline juggling.'
          : mode === 'motion'
            ? t('explainer.page.subtitleMotion')
            : t('explainer.page.subtitle')
      }
      wide
    >
      <div className="mx-mode" role="tablist" aria-label={t('explainer.mode.aria')}>
        <button
          role="tab"
          aria-selected={mode === 'director'}
          className={`mx-mode__tab${mode === 'director' ? ' is-on' : ''}`}
          onClick={() => setMode('director')}
          disabled={busy}
        >
          🎬 Ad Director
        </button>
        <button
          role="tab"
          aria-selected={mode === 'motion'}
          className={`mx-mode__tab${mode === 'motion' ? ' is-on' : ''}`}
          onClick={() => setMode('motion')}
          disabled={busy}
        >
          ✨ {t('explainer.mode.motion')}
        </button>
        <button
          role="tab"
          aria-selected={mode === 'record'}
          className={`mx-mode__tab${mode === 'record' ? ' is-on' : ''}`}
          onClick={() => setMode('record')}
          disabled={busy}
        >
          ⏺ {t('explainer.mode.record')}
        </button>
      </div>

      {mode === 'director' ? <AdDirector /> : mode === 'motion' ? <MotionEditor onBusyChange={setBusy} /> : <ScreenRecorder />}
    </SuitePage>
  )
}
