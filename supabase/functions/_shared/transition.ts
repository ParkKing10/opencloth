/* ============================================================
   Shared job-state transition — the ONE place a generation row
   advances. Called by hf-status (client polling) and hf-webhook
   (provider push). Idempotent AND race-safe: terminal rows never
   move, the paid chain hop is claimed atomically (a webhook and
   a poll advancing the same row can never double-submit), and
   both callers re-fetch the provider status themselves — a
   webhook payload is only ever a HINT, never trusted data.
   ============================================================ */

// deno-lint-ignore-file no-explicit-any
import { hfStatus, hfSubmit, normalizeStatus, errorCodeFor, webhookUrl, MODELS, HfError } from './higgsfield.ts'

type Row = {
  id: string
  user_id: string
  provider_job_id: string | null
  status: string
  compiled_prompt?: string
  user_prompt?: string
  request_params: { duration?: number; aspect?: string; chain?: 'none' | 't2i' | 'claimed' } | null
  result_path: string | null
  retry_count?: number
}

const TERMINAL = new Set(['completed', 'failed', 'cancelled'])
/** Probe failures tolerated before a job is declared unreachable (~7+ minutes of polling). */
const MAX_PROBE_MISSES = 30

/** Advance one row against the live provider state. Returns the freshest row we have. */
export async function advanceRow(svc: any, row: Row & { updated_at?: string }): Promise<any> {
  if (TERMINAL.has(row.status)) return row
  if (!row.provider_job_id) {
    // Insert happened but the submit never completed (function died mid-flight).
    // Give it 3 minutes, then fail honestly so the client stops polling and refunds.
    const age = row.updated_at ? Date.now() - Date.parse(row.updated_at) : 0
    if (age > 3 * 60 * 1000) {
      return await update(svc, row, { status: 'failed', error_code: 'submit_incomplete', error_message: 'The job was recorded but never reached the provider.' })
    }
    return row
  }

  let hf
  try {
    hf = await hfStatus(row.provider_job_id)
  } catch (err) {
    if (err instanceof HfError && err.code === 'invalid_api_key') {
      return await update(svc, row, { status: 'failed', error_code: 'invalid_api_key', error_message: 'Provider credentials rejected.' })
    }
    // Transient? Count it. A permanently unreachable job must not stay 'generating' forever.
    const misses = (row.retry_count ?? 0) + 1
    if (misses >= MAX_PROBE_MISSES) {
      return await update(svc, row, { status: 'failed', error_code: 'status_unreachable', error_message: 'Provider status could not be read.', retry_count: misses })
    }
    return await update(svc, row, { retry_count: misses })
  }

  const chain = row.request_params?.chain ?? 'none'

  // Text mode: the first hop was a documented text-to-image; when it completes,
  // hand its still to the documented image-to-video model and keep generating.
  if (chain === 't2i') {
    if (hf.status === 'completed') {
      const still = hf.imageUrls[0]
      if (!still) return await update(svc, row, { status: 'failed', error_code: 'provider_failed', error_message: 'Text step returned no image.' })

      // ATOMIC CLAIM: only ONE caller may pay for the i2v hop. The conditional
      // update flips chain t2i→claimed; whoever gets zero rows lost the race.
      const { data: claimed, error: claimErr } = await svc
        .from('video_generations')
        .update({ request_params: { ...row.request_params, chain: 'claimed' }, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('request_params->>chain', 't2i')
        .select()
        .maybeSingle()
      if (claimErr || !claimed) return await current(svc, row) // the other worker is submitting

      try {
        const sub = await hfSubmit(MODELS.i2v, { prompt: rowPrompt(row), image_url: still, duration: row.request_params?.duration ?? 5 }, webhookUrl())
        return await update(svc, claimed, {
          provider_job_id: sub.requestId,
          model: MODELS.i2v,
          status: 'generating',
          retry_count: 0,
          request_params: { ...row.request_params, chain: 'none' },
        })
      } catch (err) {
        const e = err instanceof HfError ? err : new HfError('provider_unavailable', 'Chained submit failed.')
        return await update(svc, claimed, { status: 'failed', error_code: e.code, error_message: e.message })
      }
    }
    if (hf.status === 'failed' || hf.status === 'nsfw') {
      return await update(svc, row, { status: 'failed', error_code: errorCodeFor(hf.status), error_message: hf.error ?? 'Text step rejected.' })
    }
    return await update(svc, row, { status: normalizeStatus(hf.status) })
  }

  // A row mid-claim: the winning worker is between claim and submit — do not touch it.
  if (chain === 'claimed') return row

  // Video hop.
  if (hf.status === 'completed') {
    if (!hf.videoUrl) {
      return await update(svc, row, { status: 'failed', error_code: 'malformed_response', error_message: 'Provider returned no video URL.' })
    }
    // Ingest NOW: provider CDN URLs are not ours to depend on.
    try {
      const res = await fetch(hf.videoUrl)
      if (!res.ok) throw new Error(`fetch ${res.status}`)
      const contentType = res.headers.get('content-type') ?? 'video/mp4'
      if (!contentType.startsWith('video/')) throw new Error(`unexpected type ${contentType}`)
      const bytes = new Uint8Array(await res.arrayBuffer())
      const ext = contentType.includes('webm') ? 'webm' : 'mp4'
      const path = `results/${row.user_id}/${row.id}.${ext}`
      const { error: upErr } = await svc.storage.from('generated-media').upload(path, bytes, { contentType, upsert: true })
      if (upErr) throw new Error(upErr.message)
      const publicUrl = svc.storage.from('generated-media').getPublicUrl(path).data.publicUrl
      return await update(svc, row, { status: 'completed', result_path: path, result_url: publicUrl })
    } catch {
      return await update(svc, row, { status: 'failed', error_code: 'ingest_failed', error_message: 'Could not copy the result into storage.' })
    }
  }
  if (hf.status === 'failed' || hf.status === 'nsfw') {
    return await update(svc, row, { status: 'failed', error_code: errorCodeFor(hf.status), error_message: hf.error ?? 'Generation failed at the provider.' })
  }
  return await update(svc, row, { status: normalizeStatus(hf.status) })
}

/** Guarded write: a failed DB update must never masquerade as a fresh row —
    return the last known state instead so callers keep a consistent shape. */
async function update(svc: any, row: Row, patch: Record<string, unknown>): Promise<any> {
  const { data, error } = await svc
    .from('video_generations')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .select()
    .single()
  if (error || !data) {
    console.error('video_generations update failed', row.id, error?.message)
    return row
  }
  return data
}

async function current(svc: any, row: Row): Promise<any> {
  const { data } = await svc.from('video_generations').select('*').eq('id', row.id).maybeSingle()
  return data ?? row
}

function rowPrompt(row: Row): string {
  return row.compiled_prompt && row.compiled_prompt.length > 0 ? row.compiled_prompt : (row.user_prompt ?? '')
}
