/**
 * Real image generation via Runware (https://runware.ai) — the engine behind every THREADOS AI
 * image (graphics, garment edits, campaign shots). Default model: Nano Banana 2 (google:4@3),
 * which does text→image and image→image (reference) editing.
 *
 * Auth: the Runware key from Settings → AI (localStorage) or VITE_RUNWARE_API_KEY. NOTHING is
 * hardcoded and no key is ever logged. When no key is present, callers fall back to the on-device
 * vector engine (graphics) or gate honestly (garment/campaign) — never a faked image.
 */
import { hasRunwareKey, resolveRunwareKey } from '../garment-model/aiSettings'

const ENDPOINT = 'https://api.runware.ai/v1'
const MODEL = 'google:4@3' // Nano Banana 2 — text→image, image→image, edit

export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536' | 'auto'
export type ImageQuality = 'low' | 'medium' | 'high'
export type ImageBackground = 'transparent' | 'opaque' | 'auto'

export type GenerateImageOpts = {
  n?: number
  size?: ImageSize
  quality?: ImageQuality
  background?: ImageBackground
  /** Reference images (data URLs or URLs). When present the call is an image→image edit. */
  references?: string[]
  signal?: AbortSignal
}

/** Whether real image generation is available (a Runware key is configured). */
export function hasImageAi(): boolean {
  return hasRunwareKey()
}

/** RFC4122-ish id for the Runware task (crypto.randomUUID where available). */
function taskUUID(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(16)}-${Math.floor(Math.random() * 1e9).toString(16)}`
  }
}

// Nano Banana 2 (google:4@3) accepts only a fixed set of dimensions, not arbitrary values. This is a
// practical ~1–1.7 MP subset covering square, portrait and landscape aspect ratios.
const SUPPORTED_SIZES: [number, number][] = [
  [1024, 1024],
  [1264, 848], [848, 1264], // 3:2 / 2:3
  [1200, 896], [896, 1200], // 4:3 / 3:4
  [1152, 928], [928, 1152], // 5:4 / 4:5
  [1376, 768], [768, 1376], // 16:9 / 9:16
]

/** Snap any requested size to the nearest SUPPORTED Nano Banana dimension by aspect ratio. */
function snapSize(size: ImageSize): [number, number] {
  const [rw, rh] = size === 'auto' || !/^\d+x\d+$/.test(size) ? [1024, 1024] : size.split('x').map((n) => parseInt(n, 10))
  const target = rw / rh
  let best = SUPPORTED_SIZES[0]
  let bestScore = Infinity
  for (const [w, h] of SUPPORTED_SIZES) {
    // Match aspect first; a small resolution penalty avoids jumping to the largest option.
    const score = Math.abs(w / h - target) * 100 + Math.abs((w * h) / 1_000_000 - 1.2)
    if (score < bestScore) {
      bestScore = score
      best = [w, h]
    }
  }
  return best
}

function toDataUrl(item: { imageBase64Data?: string; imageURL?: string; imageDataURI?: string }): string {
  if (item.imageDataURI) return item.imageDataURI
  if (item.imageBase64Data) {
    return item.imageBase64Data.startsWith('data:') ? item.imageBase64Data : `data:image/png;base64,${item.imageBase64Data}`
  }
  return item.imageURL ?? ''
}

/** Turn a Runware error response into a short, honest message (never leaks the key). */
function errorMessage(status: number, json: unknown): string {
  const errs = (json as { errors?: Array<{ message?: string; code?: string }> })?.errors
  const first = Array.isArray(errs) && errs.length > 0 ? errs[0] : null
  const detail = first?.message ?? ''
  const code = first?.code ?? ''
  if (/invalidapikey|unauthorized/i.test(code) || (!detail && (status === 401 || status === 403))) {
    return 'Runware rejected the API key. Check it in Settings → AI.'
  }
  // Runware's own messages (insufficient credits + wallet link, rate limits, etc.) are already
  // clear and actionable — pass them straight through so the user knows exactly what to do.
  return detail || `Image generation failed (HTTP ${status}).`
}

/**
 * Generate N images from a prompt (optionally conditioned on reference images) via Runware. Returns
 * PNG data URLs. Throws with a friendly message on failure — callers decide whether to fall back.
 */
export async function generateImages(prompt: string, opts: GenerateImageOpts = {}): Promise<string[]> {
  const key = resolveRunwareKey()
  if (!key) throw new Error('Add your Runware API key in Settings → AI to generate images.')

  const n = Math.max(1, Math.min(4, opts.n ?? 1))
  const [width, height] = snapSize(opts.size ?? '1024x1024')
  const refs = (opts.references ?? []).filter(Boolean)

  const task: Record<string, unknown> = {
    taskType: 'imageInference',
    taskUUID: taskUUID(),
    positivePrompt: prompt,
    model: MODEL,
    width,
    height,
    numberResults: n,
    outputType: 'base64Data',
    outputFormat: 'PNG',
  }
  if (refs.length > 0) task.referenceImages = refs

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify([task]),
    signal: opts.signal,
  })

  const json = await res.json().catch(() => null)
  if (!res.ok || (json && (json as { errors?: unknown[] }).errors)) {
    throw new Error(errorMessage(res.status, json))
  }
  const data = (json as { data?: Array<{ imageBase64Data?: string; imageURL?: string; imageDataURI?: string }> })?.data
  const images = Array.isArray(data) ? data.map(toDataUrl).filter(Boolean) : []
  if (images.length === 0) throw new Error('Runware returned no image. Try a different prompt.')
  return images
}

/** Engineer a clean, print-ready GRAPHIC prompt from the user's idea. */
export function graphicPrompt(idea: string): string {
  return (
    `${idea.trim()}. A single high-detail graphic design for streetwear apparel, ` +
    `centered and isolated on a plain flat transparent background, crisp clean edges, sticker/print style, ` +
    `no mockup, no fabric, no garment, no person, no text unless part of the idea.`
  )
}

/**
 * Engineer a GARMENT-EDIT prompt — apply the requested change to the SAME garment in the reference
 * image (e.g. "add crazy holes", "distress it", "make it acid-washed") without turning it into a
 * different piece. Product-shot framing, no model.
 */
export function garmentEditPrompt(intent: string): string {
  return (
    `Edit the exact garment shown in the reference image: ${intent.trim()}. ` +
    `Keep the SAME garment type, silhouette, cut and any existing prints/logos — only apply the requested change ` +
    `to the fabric realistically (rips, washes, textures, colour, distressing, etc.). ` +
    `Product flat-lay / ghost-mannequin shot isolated on a plain background, no person, no mannequin, ` +
    `high detail, realistic fabric, even studio lighting.`
  )
}

export const IMAGE_QUALITY_BY_TIER: Record<'fast' | 'high' | 'ultra', ImageQuality> = {
  fast: 'low',
  high: 'medium',
  ultra: 'high',
}
