/**
 * AI settings (Settings → AI). THREADOS uses a single provider you manage: Runware
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
import { loadRunwareKey, saveRunwareKey, hasRunwareKey } from '../../garment-model/aiSettings'
import './ai-settings.css'

export function AiSettings() {
  const toast = useToast()
  const [runwareKey, setRunwareKey] = useState(loadRunwareKey())
  const [showRunware, setShowRunware] = useState(false)
  const connected = hasRunwareKey()

  const save = () => {
    saveRunwareKey(runwareKey)
    toast(runwareKey.trim() ? 'Runware key saved — THREADOS AI images are live.' : 'Runware key cleared.', 'success')
  }

  return (
    <section className="set-card">
      <div className="aiset">
        <div className="aiset__head">
          <div>
            <h2>AI Provider · Runware</h2>
            <p className="aiset__sub">
              One key powers all of THREADOS AI — graphics, garment edits and campaign photos (Nano Banana 2).
              Get a key at runware.ai and top up your wallet (external models need credit).
            </p>
          </div>
          <span className={`aiset__provider aiset__provider--${connected ? 'openai' : 'placeholder'}`}>
            {connected ? 'Connected' : 'Not connected'}
          </span>
        </div>

        <label className="aiset__field">
          <span>Runware API Key</span>
          <div className="aiset__key">
            <input
              type={showRunware ? 'text' : 'password'}
              value={runwareKey}
              onChange={(e) => setRunwareKey(e.target.value)}
              placeholder="Your Runware API key"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="aiset__reveal" onClick={() => setShowRunware((v) => !v)}>
              {showRunware ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <div className="aiset__actions">
          <button type="button" className="s-btn s-btn--accent" onClick={save}>Save</button>
        </div>

        <p className="aiset__security">
          <b>Security:</b> saved obfuscated in your browser — a static app can’t truly encrypt it. For production, set
          <code>VITE_RUNWARE_API_KEY</code> at build time instead. The key is never hardcoded, and without one THREADOS
          AI falls back to on-device vector previews (garment &amp; campaign photos are gated, never faked).
        </p>
      </div>
    </section>
  )
}
