/**
 * AI provider settings (Settings → AI). Configure OpenAI for the garment-edit pipeline. When a key
 * is present the app uses the real API through the provider abstraction; otherwise it falls back to
 * the deterministic placeholder — same editable-garment interface either way.
 */
import { useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import {
  loadAiSettings,
  saveAiSettings,
  testConnection,
  hasApiKey,
  looksLikeOpenAiKey,
  OPENAI_MODEL_OPTIONS,
  loadRunwareKey,
  saveRunwareKey,
  hasRunwareKey,
  type ConnectionStatus,
} from '../../garment-model/aiSettings'
import './ai-settings.css'

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  invalid: 'Invalid API key',
  disconnected: 'Disconnected',
  untested: 'Not tested',
}

export function AiSettings() {
  const toast = useToast()
  const initial = loadAiSettings()
  const [apiKey, setApiKey] = useState(initial.apiKey)
  const [model, setModel] = useState(initial.model)
  const [temperature, setTemperature] = useState(initial.temperature?.toString() ?? '')
  const [maxTokens, setMaxTokens] = useState(initial.maxTokens?.toString() ?? '')
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus>('untested')
  const [testing, setTesting] = useState(false)
  // Runware — the image-generation engine (Nano Banana 2) behind THREADOS AI graphics, garment
  // edits and campaign photos.
  const [runwareKey, setRunwareKey] = useState(loadRunwareKey())
  const [showRunware, setShowRunware] = useState(false)
  const runwareActive = hasRunwareKey()

  const activeProvider = hasApiKey() ? 'OpenAI' : 'Placeholder'

  const saveRunware = () => {
    saveRunwareKey(runwareKey)
    toast(runwareKey.trim() ? 'Runware key saved — THREADOS AI images are live.' : 'Runware key cleared.', 'success')
  }

  const save = () => {
    saveAiSettings({
      apiKey,
      model,
      temperature: temperature.trim() ? Number(temperature) : undefined,
      maxTokens: maxTokens.trim() ? Number(maxTokens) : undefined,
    })
    toast('AI settings saved.', 'success')
  }

  const test = async () => {
    if (!apiKey.trim()) {
      setStatus('disconnected')
      return
    }
    setTesting(true)
    try {
      setStatus(await testConnection(apiKey))
    } finally {
      setTesting(false)
    }
  }

  const keyFormatWarning = apiKey.trim() && !looksLikeOpenAiKey(apiKey) ? "That doesn't look like an OpenAI key (expected sk-…)." : ''

  return (
    <>
    <section className="set-card">
      <div className="aiset">
        <div className="aiset__head">
          <div>
            <h2>Image Generation · Runware</h2>
            <p className="aiset__sub">Powers THREADOS AI — graphics, garment edits and campaign photos (Nano Banana 2). Get a key at runware.ai.</p>
          </div>
          <span className={`aiset__provider aiset__provider--${runwareActive ? 'openai' : 'placeholder'}`}>
            {runwareActive ? 'Connected' : 'Not connected'}
          </span>
        </div>

        <label className="aiset__field">
          <span>Runware API Key</span>
          <div className="aiset__key">
            <input type={showRunware ? 'text' : 'password'} value={runwareKey} onChange={(e) => setRunwareKey(e.target.value)} placeholder="Your Runware API key" autoComplete="off" spellCheck={false} />
            <button type="button" className="aiset__reveal" onClick={() => setShowRunware((v) => !v)}>
              {showRunware ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <div className="aiset__actions">
          <button type="button" className="s-btn s-btn--accent" onClick={saveRunware}>Save</button>
        </div>

        <p className="aiset__security">
          <b>Security:</b> saved obfuscated in your browser (a static app can’t truly encrypt it). For production, set
          <code>VITE_RUNWARE_API_KEY</code> at build time instead. The key is never hardcoded, and without one THREADOS
          AI falls back to on-device vector previews (garment/campaign photos are gated, never faked).
        </p>
      </div>
    </section>

    <section className="set-card">
      <div className="aiset">
        <div className="aiset__head">
          <div>
            <h2>Garment Text AI · OpenAI</h2>
            <p className="aiset__sub">Optional — powers garment-structure generation in the Garment Lab. Without a key, THREADOS uses the built-in placeholder.</p>
          </div>
          <span className={`aiset__provider aiset__provider--${activeProvider.toLowerCase()}`}>
            Active: {activeProvider}
          </span>
        </div>

        <label className="aiset__field">
          <span>OpenAI API Key</span>
          <div className="aiset__key">
            <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-…" autoComplete="off" spellCheck={false} />
            <button type="button" className="aiset__reveal" onClick={() => setShowKey((v) => !v)}>
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          {keyFormatWarning && <em className="aiset__warn">{keyFormatWarning}</em>}
        </label>

        <div className="aiset__grid">
          <label className="aiset__field">
            <span>Model</span>
            <input list="aiset-models" value={model} onChange={(e) => setModel(e.target.value)} />
            <datalist id="aiset-models">
              {OPENAI_MODEL_OPTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <label className="aiset__field">
            <span>Temperature (optional)</span>
            <input type="number" step="0.1" min="0" max="2" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="0.2" />
          </label>
          <label className="aiset__field">
            <span>Max tokens (optional)</span>
            <input type="number" min="1" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} placeholder="auto" />
          </label>
        </div>

        <div className="aiset__actions">
          <button type="button" className="s-btn s-btn--accent" onClick={save}>Save</button>
          <button type="button" className="s-btn s-btn--subtle" onClick={() => void test()} disabled={testing}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <span className={`aiset__status aiset__status--${status}`}>
            <span className="aiset__dot" aria-hidden="true" />
            {STATUS_LABEL[status]}
          </span>
        </div>

        <p className="aiset__security">
          <b>Security:</b> THREADOS is a static app, so a key saved here is obfuscated in your browser — not truly
          encrypted. For production, serve OpenAI through a backend proxy or a build-time environment variable
          (<code>VITE_OPENAI_API_KEY</code>) rather than pasting a key into the browser. The key is never hardcoded.
        </p>
      </div>
    </section>
    </>
  )
}
