/* ============================================================
   Higgsfield Cloud API — server-side adapter (Deno Edge).

   Every endpoint below is taken from the OFFICIAL docs
   (docs.higgsfield.ai / official higgsfield-js SDK):
     base        https://platform.higgsfield.ai
     auth        Authorization: Key {KEY_ID}:{KEY_SECRET}
     submit      POST /{model_id}
     status      GET  /requests/{request_id}/status
     cancel      POST /requests/{request_id}/cancel
     webhook     ?hf_webhook=<url> query param, retried ≤ 2h,
                 idempotency via request_id (no signature — so we
                 NEVER trust payloads; we re-fetch status ourselves)
   Statuses: queued | in_progress | completed | failed | nsfw
   Results:  { video: { url } } and/or { images: [{ url }] }
   Nothing else is assumed. No fabricated fields.
   ============================================================ */

export const HF_BASE = 'https://platform.higgsfield.ai'

/* Documented model ids only. Overridable via secrets, never invented. */
export const MODELS = {
  i2v: Deno.env.get('HIGGSFIELD_I2V_MODEL') ?? 'higgsfield-ai/dop/standard',
  i2vAlternates: ['higgsfield-ai/dop/preview', 'kling-video/v2.1/pro/image-to-video', 'bytedance/seedance/v1/pro/image-to-video'],
  t2i: Deno.env.get('HIGGSFIELD_T2I_MODEL') ?? 'flux-pro/kontext/max/text-to-image',
}

export function hfAuthHeader(): string {
  const key = Deno.env.get('HIGGSFIELD_API_KEY') ?? ''
  const secret = Deno.env.get('HIGGSFIELD_API_SECRET') ?? ''
  return `Key ${key}:${secret}`
}

export function hfConfigured(): boolean {
  return !!Deno.env.get('HIGGSFIELD_API_KEY') && !!Deno.env.get('HIGGSFIELD_API_SECRET')
}

/* ---------------- requests ---------------- */

export type HfSubmitResult = { requestId: string; raw: unknown }

/** POST /{model_id}. `input` carries only documented fields for that model. */
export async function hfSubmit(modelId: string, input: Record<string, unknown>, webhookUrl?: string): Promise<HfSubmitResult> {
  const url = new URL(`${HF_BASE}/${modelId}`)
  if (webhookUrl) url.searchParams.set('hf_webhook', webhookUrl)
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: hfAuthHeader(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  })
  const raw = await res.json().catch(() => ({}))
  if (!res.ok) throw providerError(res.status, raw)
  const requestId = pickRequestId(raw)
  if (!requestId) throw new HfError('malformed_response', 'Provider response had no request id.')
  return { requestId, raw }
}

export type HfStatus = {
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'nsfw'
  videoUrl?: string
  imageUrls: string[]
  error?: string
  raw: unknown
}

/** GET /requests/{id}/status. */
export async function hfStatus(requestId: string): Promise<HfStatus> {
  const res = await fetch(`${HF_BASE}/requests/${encodeURIComponent(requestId)}/status`, {
    headers: { Authorization: hfAuthHeader(), Accept: 'application/json' },
  })
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw providerError(res.status, raw)
  const status = String(raw.status ?? '') as HfStatus['status']
  if (!['queued', 'in_progress', 'completed', 'failed', 'nsfw'].includes(status)) {
    throw new HfError('malformed_response', `Unknown provider status "${raw.status}".`)
  }
  const video = raw.video as { url?: string } | undefined
  const images = Array.isArray(raw.images) ? (raw.images as { url?: string }[]) : []
  return {
    status,
    videoUrl: typeof video?.url === 'string' ? video.url : undefined,
    imageUrls: images.map((i) => i?.url).filter((u): u is string => typeof u === 'string'),
    error: typeof raw.error === 'string' ? raw.error : undefined,
    raw,
  }
}

/** POST /requests/{id}/cancel — only effective while queued (documented). */
export async function hfCancel(requestId: string): Promise<void> {
  await fetch(`${HF_BASE}/requests/${encodeURIComponent(requestId)}/cancel`, {
    method: 'POST',
    headers: { Authorization: hfAuthHeader(), Accept: 'application/json' },
  }).catch(() => {})
}

/* ---------------- normalization ---------------- */

/** Provider status → our normalized GenerationState. */
export function normalizeStatus(s: HfStatus['status']): 'queued' | 'generating' | 'completed' | 'failed' {
  switch (s) {
    case 'queued':
      return 'queued'
    case 'in_progress':
      return 'generating'
    case 'completed':
      return 'completed'
    case 'nsfw':
    case 'failed':
      return 'failed'
  }
}

export function errorCodeFor(s: HfStatus['status']): string | null {
  if (s === 'nsfw') return 'moderation'
  if (s === 'failed') return 'provider_failed'
  return null
}

/* ---------------- errors ---------------- */

export class HfError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

function providerError(httpStatus: number, raw: unknown): HfError {
  const msg = typeof (raw as { error?: unknown })?.error === 'string' ? String((raw as { error: string }).error) : `Provider HTTP ${httpStatus}`
  if (httpStatus === 401 || httpStatus === 403) return new HfError('invalid_api_key', msg)
  if (httpStatus === 402) return new HfError('provider_credits', msg)
  if (httpStatus === 429) return new HfError('rate_limited', msg)
  if (httpStatus >= 500) return new HfError('provider_unavailable', msg)
  return new HfError('provider_rejected', msg)
}

/* ---------------- misc ---------------- */

function pickRequestId(raw: unknown): string | null {
  const r = raw as Record<string, unknown>
  for (const k of ['request_id', 'id']) {
    if (typeof r?.[k] === 'string' && (r[k] as string).length > 0) return r[k] as string
  }
  return null
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
