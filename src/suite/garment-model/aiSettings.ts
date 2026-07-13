/**
 * AI provider settings (Settings → AI). Configures OpenAI for the garment-edit pipeline.
 *
 * SECURITY REALITY: loom studios ships as a static site. A static browser app cannot truly encrypt a
 * secret it must also decrypt (the decrypt routine + key are in the bundle). So the stored key is
 * OBFUSCATED at rest, not encrypted — the Settings UI states this plainly and recommends a
 * server-side proxy or an environment variable for production. `VITE_OPENAI_API_KEY` is honored as
 * a fallback source (note: Vite inlines it into the bundle — only use it on trusted deployments).
 * The key is never hardcoded.
 */
export type AiProviderId = 'placeholder' | 'openai'

export type AiSettings = {
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
}

export type ConnectionStatus = 'connected' | 'invalid' | 'disconnected' | 'untested'

export const DEFAULT_OPENAI_MODEL = 'gpt-5.5'
export const OPENAI_MODEL_OPTIONS = ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.4', 'gpt-5.1', 'gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o']

/** GPT-5 / o-series reasoning models take no `temperature` and use `max_completion_tokens`, not `max_tokens`. */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/i.test(model.trim())
}

const KEY = 'threados-ai-settings'
const OBFUSCATION_SALT = 'threados-ai-v1'

/** Lightweight reversible obfuscation. NOT encryption — see the file header. */
function obfuscate(text: string): string {
  if (!text) return ''
  let out = ''
  for (let i = 0; i < text.length; i += 1) {
    out += String.fromCharCode(text.charCodeAt(i) ^ OBFUSCATION_SALT.charCodeAt(i % OBFUSCATION_SALT.length))
  }
  return btoa(unescape(encodeURIComponent(out)))
}
function deobfuscate(stored: string): string {
  if (!stored) return ''
  try {
    const raw = decodeURIComponent(escape(atob(stored)))
    let out = ''
    for (let i = 0; i < raw.length; i += 1) {
      out += String.fromCharCode(raw.charCodeAt(i) ^ OBFUSCATION_SALT.charCodeAt(i % OBFUSCATION_SALT.length))
    }
    return out
  } catch {
    return ''
  }
}

function envApiKey(): string {
  try {
    return (import.meta.env?.VITE_OPENAI_API_KEY as string | undefined)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { apiKey: '', model: DEFAULT_OPENAI_MODEL }
    const parsed = JSON.parse(raw) as { apiKey?: string; model?: string; temperature?: number; maxTokens?: number }
    const stored = parsed.apiKey ?? ''
    const apiKey = deobfuscate(stored)
    // A stored-but-undecodable key means the entry is corrupt — clear it so the user re-enters
    // rather than silently degrading to the placeholder with a key they think is still set.
    if (stored && !apiKey) {
      try {
        localStorage.removeItem(KEY)
      } catch {
        /* ignore */
      }
      return { apiKey: '', model: parsed.model || DEFAULT_OPENAI_MODEL }
    }
    return { apiKey, model: parsed.model || DEFAULT_OPENAI_MODEL, temperature: parsed.temperature, maxTokens: parsed.maxTokens }
  } catch {
    return { apiKey: '', model: DEFAULT_OPENAI_MODEL }
  }
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        apiKey: obfuscate(settings.apiKey.trim()),
        model: settings.model || DEFAULT_OPENAI_MODEL,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      }),
    )
  } catch {
    /* non-fatal */
  }
}

/** The effective key: an explicitly-saved key wins, else the build-time env var. */
export function resolveApiKey(): string {
  const saved = loadAiSettings().apiKey.trim()
  return saved || envApiKey()
}

export function hasApiKey(): boolean {
  return resolveApiKey().length > 0
}

// ---- Runware (image generation: Nano Banana 2 etc.) ----
// Stored obfuscated at rest (same caveat as the OpenAI key — never truly secret in a static app).
// NEVER hardcode a key; it comes from here (Settings → AI) or VITE_RUNWARE_API_KEY.
const RUNWARE_KEY_STORE = 'threados-runware-key'

function envRunwareKey(): string {
  try {
    return (import.meta.env?.VITE_RUNWARE_API_KEY as string | undefined)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function loadRunwareKey(): string {
  try {
    const raw = localStorage.getItem(RUNWARE_KEY_STORE)
    return raw ? deobfuscate(raw) : ''
  } catch {
    return ''
  }
}

export function saveRunwareKey(key: string): void {
  try {
    const trimmed = key.trim()
    if (trimmed) localStorage.setItem(RUNWARE_KEY_STORE, obfuscate(trimmed))
    else localStorage.removeItem(RUNWARE_KEY_STORE)
  } catch {
    /* non-fatal */
  }
}

export function resolveRunwareKey(): string {
  return loadRunwareKey() || envRunwareKey()
}

export function hasRunwareKey(): boolean {
  return resolveRunwareKey().length > 0
}

/** True when the string looks like an OpenAI key (sk-… / project keys). Cheap pre-check only. */
export function looksLikeOpenAiKey(key: string): boolean {
  return /^sk-[A-Za-z0-9_-]{20,}$/.test(key.trim())
}

/**
 * Real connection test — asks OpenAI for the model list. As real as a browser allows:
 * 200 → connected, 401/403 → invalid key, network/CORS/other → disconnected (reported honestly).
 * This lists models only; it never generates anything.
 */
export async function testConnection(apiKey: string): Promise<ConnectionStatus> {
  const key = apiKey.trim()
  if (!key) return 'disconnected'
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
    })
    if (res.ok) return 'connected'
    if (res.status === 401 || res.status === 403) return 'invalid'
    return 'disconnected'
  } catch {
    return 'disconnected'
  }
}
