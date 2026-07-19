/* ============================================================
   Higgsfield — REAL AI video generation for storyboard beats.
   Browser → platform.higgsfield.ai directly (CORS is open; verified):
     POST /v1/image2video/dop   { model, prompt, input_images }
     GET  /requests/{id}/status  queued|in_progress|completed|failed|nsfw
   Auth: "Authorization: Key KEY_ID:KEY_SECRET" (Settings → AI).
   Keyframes are data URLs in IndexedDB, but the API only accepts
   public image URLs — they are published to Supabase storage first
   and passed as short-lived signed URLs. Response parsing is
   deliberately defensive (pure helpers, unit-tested): the exact
   result shape varies across models, the video URL does not.
   ============================================================ */

import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { resolveHiggsfieldKey } from '../garment-model/aiSettings'

const BASE = 'https://platform.higgsfield.ai'
const SUPA = isSupabaseConfigured ? supabase : null
const BUCKET = 'garments' // reuse the existing storage bucket (marketing/ prefix)

/* ---------------- pure response parsing (unit-tested) ---------------- */

/** Pull the request id out of whatever shape the submit endpoint returns. */
export function extractRequestId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  for (const k of ['id', 'request_id', 'requestId']) {
    if (typeof b[k] === 'string' && b[k]) return b[k] as string
  }
  const jobs = b.jobs
  if (Array.isArray(jobs) && jobs[0] && typeof jobs[0] === 'object') {
    const j = jobs[0] as Record<string, unknown>
    if (typeof j.id === 'string' && j.id) return j.id
  }
  return null
}

/** Depth-first walk for the first plausible video URL anywhere in the result body. */
export function findVideoUrl(node: unknown, depth = 0): string | null {
  if (depth > 6 || node == null) return null
  if (typeof node === 'string') {
    return /^https?:\/\//.test(node) && (/\.(mp4|webm|mov)(\?|$)/i.test(node) || /video/i.test(node)) ? node : null
  }
  if (Array.isArray(node)) {
    for (const v of node) {
      const hit = findVideoUrl(v, depth + 1)
      if (hit) return hit
    }
    return null
  }
  if (typeof node === 'object') {
    const o = node as Record<string, unknown>
    // Prefer explicit keys before walking everything.
    for (const k of ['video_url', 'videoUrl', 'url', 'raw']) {
      if (k in o) {
        const hit = findVideoUrl(o[k], depth + 1)
        if (hit) return hit
      }
    }
    for (const v of Object.values(o)) {
      const hit = findVideoUrl(v, depth + 1)
      if (hit) return hit
    }
  }
  return null
}

/** Normalise the polling payload to a tri-state. */
export function parseStatus(body: unknown): { state: 'pending' | 'done' | 'failed'; url?: string; reason?: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const status = String(b.status ?? '').toLowerCase()
  if (status === 'completed' || status === 'complete') {
    const url = findVideoUrl(b)
    return url ? { state: 'done', url } : { state: 'failed', reason: 'completed without a video url' }
  }
  if (status === 'failed' || status === 'nsfw' || status === 'canceled') return { state: 'failed', reason: status }
  return { state: 'pending' }
}

/* ---------------- API calls ---------------- */

function authHeaders(): Record<string, string> {
  return { Authorization: `Key ${resolveHiggsfieldKey()}`, 'Content-Type': 'application/json' }
}

export async function submitImage2Video(opts: { imageUrl: string; prompt: string }): Promise<string> {
  const res = await fetch(`${BASE}/v1/image2video/dop`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      model: 'dop-turbo',
      prompt: opts.prompt,
      input_images: [{ type: 'image_url', image_url: opts.imageUrl }],
    }),
  })
  if (res.status === 401 || res.status === 403) throw new Error('auth')
  if (!res.ok) throw new Error(`submit ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const id = extractRequestId(await res.json())
  if (!id) throw new Error('submit: no request id in response')
  return id
}

export async function pollRequest(id: string): Promise<ReturnType<typeof parseStatus>> {
  const res = await fetch(`${BASE}/requests/${id}/status`, { headers: authHeaders() })
  if (!res.ok) return { state: 'pending' } // transient poll errors never kill the run
  return parseStatus(await res.json())
}

/* ---------------- keyframe publishing ---------------- */

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [head, b64] = dataUrl.split(',')
    const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg'
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  } catch {
    return null
  }
}

/** Publish a keyframe data URL so Higgsfield can fetch it (signed URL, 1h). */
export async function publishKeyframe(userId: string, sceneId: string, dataUrl: string): Promise<string> {
  if (!SUPA) throw new Error('storage')
  const blob = dataUrlToBlob(dataUrl)
  if (!blob) throw new Error('keyframe decode failed')
  const ext = blob.type.includes('png') ? 'png' : 'jpg'
  const path = `marketing/${userId}/${sceneId}-${Date.now().toString(36)}.${ext}`
  const up = await SUPA.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: true })
  if (up.error) throw new Error(`upload: ${up.error.message}`)
  const signed = await SUPA.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (signed.error || !signed.data?.signedUrl) throw new Error('signed url failed')
  return signed.data.signedUrl
}

/* ---------------- orchestration ---------------- */

export type BeatResult = { url: string | null; error?: string }

/** Generate one real video per beat: submit everything, then poll until all settle.
 *  onUpdate fires with (settled, total) after every state change. */
export async function generateBeatVideos(
  beats: { imageUrl: string; prompt: string }[],
  onUpdate?: (settled: number, total: number) => void,
): Promise<BeatResult[]> {
  const ids = await Promise.all(
    beats.map(async (b): Promise<{ id?: string; error?: string }> => {
      try {
        return { id: await submitImage2Video(b) }
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'submit failed' }
      }
    }),
  )
  // An auth failure on every beat is a key problem — surface it as one clear error.
  if (ids.every((r) => r.error === 'auth')) throw new Error('auth')

  const results: BeatResult[] = ids.map((r) => ({ url: null, error: r.error }))
  const pending = new Map<number, string>()
  ids.forEach((r, i) => {
    if (r.id) pending.set(i, r.id)
  })
  const settledCount = () => results.filter((r, i) => r.url || (!pending.has(i) && r.error)).length
  onUpdate?.(settledCount(), beats.length)

  const startedAt = Date.now()
  while (pending.size > 0 && Date.now() - startedAt < 8 * 60_000) {
    await new Promise((r) => setTimeout(r, 5000))
    for (const [i, id] of [...pending.entries()]) {
      const st = await pollRequest(id)
      if (st.state === 'done') {
        results[i] = { url: st.url ?? null }
        pending.delete(i)
        onUpdate?.(settledCount(), beats.length)
      } else if (st.state === 'failed') {
        results[i] = { url: null, error: st.reason ?? 'failed' }
        pending.delete(i)
        onUpdate?.(settledCount(), beats.length)
      }
    }
  }
  for (const [i] of pending) results[i] = { url: null, error: 'timeout' }
  return results
}
