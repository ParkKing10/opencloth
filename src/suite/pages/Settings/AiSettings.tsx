/**
 * AI settings (Settings → AI). loom studios uses a single provider you manage: Runware
 * (https://runware.ai), which powers every AI image — graphics, garment edits and campaign photos
 * (default model: Nano Banana 2). Without a key, image AI falls back to the on-device vector engine
 * (graphics) or is gated honestly (garment/campaign photos are never faked).
 *
 * The Garment-Lab "generate a garment from text" feature produces a structured editable garment, not
 * an image — that is not something Runware does, so it uses the built-in engine (or a build-time
 * VITE_OPENAI_API_KEY for those who want it). No key for it is managed here.
 */
import { useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import { useT } from '@/i18n'
import { loadRunwareKey, saveRunwareKey, hasRunwareKey } from '../../garment-model/aiSettings'
import './ai-settings.css'

export function AiSettings() {
  const toast = useToast()
  const t = useT()
  const [runwareKey, setRunwareKey] = useState(loadRunwareKey())
  const [showRunware, setShowRunware] = useState(false)
  const connected = hasRunwareKey()

  const save = () => {
    saveRunwareKey(runwareKey)
    toast(runwareKey.trim() ? t('settings.ai.savedToast') : t('settings.ai.clearedToast'), 'success')
  }

  return (
    <section className="set-card">
      <div className="aiset">
        <div className="aiset__head">
          <div>
            <h2>{t('settings.ai.title')}</h2>
            <p className="aiset__sub">{t('settings.ai.sub')}</p>
          </div>
          <span className={`aiset__provider aiset__provider--${connected ? 'openai' : 'placeholder'}`}>
            {connected ? t('settings.ai.connected') : t('settings.ai.notConnected')}
          </span>
        </div>

        <label className="aiset__field">
          <span>{t('settings.ai.keyLabel')}</span>
          <div className="aiset__key">
            <input
              type={showRunware ? 'text' : 'password'}
              value={runwareKey}
              onChange={(e) => setRunwareKey(e.target.value)}
              placeholder={t('settings.ai.keyPlaceholder')}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="aiset__reveal" onClick={() => setShowRunware((v) => !v)}>
              {showRunware ? t('settings.ai.hide') : t('settings.ai.show')}
            </button>
          </div>
        </label>

        <div className="aiset__actions">
          <button type="button" className="s-btn s-btn--accent" onClick={save}>{t('settings.ai.save')}</button>
        </div>

        <p className="aiset__security">
          <b>{t('settings.ai.securityLabel')}</b>{t('settings.ai.securityBefore')}
          <code>VITE_RUNWARE_API_KEY</code>{t('settings.ai.securityAfter')}
        </p>
      </div>
    </section>
  )
}
