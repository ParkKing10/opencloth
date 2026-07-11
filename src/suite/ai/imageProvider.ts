/**
 * Real OpenAI image generation (gpt-image-1) — the engine behind THREADOS AI when a key is set.
 *
 * Auth reuses the app's existing OpenAI settings (Settings → AI): the user's key from localStorage
 * or VITE_OPENAI_API_KEY. NOTHING is hardcoded and no key is ever logged. When no key is present,
 * callers fall back to the on-device vector concept engine — honestly, never faking a diffusion call.
 *
 * Two modes:
 *  - text → image via /v1/images/generations
 *  - image + text → image via /v1/images/edits, with input_fidelity:'high' so a supplied reference
 *    (a garment render, an uploaded graphic) is preserved rather than redesigned.
 */
import { hasApiKey, resolveApiKey } from '../garment-model/aiSettings'

const IMAGE_MODEL = 'gpt-image-1'
const BASE = 'https://api.openai.com/v1/images'

export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536' | 'auto'
export type ImageQuality = 'low' | 'medium' | 'high'
export type ImageBackground = 'transparent' | 'opaque' | 'auto'

export type GenerateImageOpts = {
  n?: number
  size?: ImageSize
  quality?: ImageQuality
  background?: ImageBackground
  /** Reference images (data URLs). When present the call uses /edits so they are preserved. */
  references?: string[]
  signal?: AbortSignal
}

/** Whether real image generation is available (an OpenAI key is configured). */
export function hasImageAi(): boolean {
  return hasApiKey()
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob())
}

/** Turn an OpenAI error response into a short, honest, user-facing message (never leaks the key). */
async function toMessage(res: Response): Promise<string> {
  let detail = ''
  try {
    const body = await res.json()
    detail = body?.error?.message ?? ''
  } catch {
    /* ignore */
  }
  if (res.status === 401 || res.status === 403) {
    if (/verif/i.test(detail)) return 'Your OpenAI organization must be verified to use gpt-image-1. Verify it in the OpenAI dashboard, then try again.'
    return 'OpenAI rejected the API key. Check it in Settings → AI.'
  }
  if (res.status === 429) return 'OpenAI rate limit or quota reached. Try again shortly.'
  if (res.status >= 500) return 'OpenAI had a server error. Try again in a moment.'
  return detail || `Image generation failed (HTTP ${res.status}).`
}

function readImages(json: unknown): string[] {
  const data = (json as { data?: Array<{ b64_json?: string; url?: string }> })?.data
  if (!Array.isArray(data)) return []
  return data
    .map((d) => (d.b64_json ? `data:image/png;base64,${d.b64_json}` : d.url ?? ''))
    .filter(Boolean)
}

/**
 * Generate N images from a prompt (optionally conditioned on reference images). Returns PNG data
 * URLs. Throws with a friendly message on failure — callers decide whether to fall back.
 */
export async function generateImages(prompt: string, opts: GenerateImageOpts = {}): Promise<string[]> {
  const key = resolveApiKey()
  if (!key) throw new Error('Add your OpenAI API key in Settings → AI to generate images.')

  const n = Math.max(1, Math.min(4, opts.n ?? 1))
  const size = opts.size ?? '1024x1024'
  const quality = opts.quality ?? 'high'
  const background = opts.background ?? 'transparent'
  const refs = opts.references ?? []

  let res: Response
  if (refs.length > 0) {
    const form = new FormData()
    form.append('model', IMAGE_MODEL)
    form.append('prompt', prompt)
    form.append('n', String(n))
    form.append('size', size)
    form.append('quality', quality)
    form.append('background', background)
    form.append('input_fidelity', 'high')
    for (let i = 0; i < refs.length; i += 1) {
      const blob = await dataUrlToBlob(refs[i])
      form.append('image[]', blob, `reference-${i}.png`)
    }
    res = await fetch(`${BASE}/edits`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: opts.signal })
  } else {
    res = await fetch(`${BASE}/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, n, size, quality, background, output_format: 'png' }),
      signal: opts.signal,
    })
  }

  if (!res.ok) throw new Error(await toMessage(res))
  const images = readImages(await res.json())
  if (images.length === 0) throw new Error('OpenAI returned no image. Try a different prompt.')
  return images
}

/** Engineer a clean, print-ready GRAPHIC prompt from the user's idea. */
export function graphicPrompt(idea: string): string {
  return (
    `${idea.trim()}. A single high-detail graphic design for streetwear apparel, ` +
    `centered and isolated on a fully transparent background, crisp clean edges, sticker/print style, ` +
    `no mockup, no fabric, no garment, no person, no text unless part of the idea.`
  )
}

export const IMAGE_QUALITY_BY_TIER: Record<'fast' | 'high' | 'ultra', ImageQuality> = {
  fast: 'low',
  high: 'medium',
  ultra: 'high',
}
