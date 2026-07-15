/* ============================================================
   Shared job-state transition — the ONE place a generation row
   advances. Called by hf-status (client polling) and hf-webhook
   (provider push). Idempotent: terminal rows never move again,
   and both callers re-fetch the provider status themselves — a
   webhook payload is only ever a HINT, never trusted data.
   ============================================================ */

// deno-lint-ignore-file no-explicit-any
import { hfStatus, hfSubmit, normalizeStatus, errorCodeFor, MODELS, HfError } from './higgsfield.ts'

type Row = {
  id: string
  user_id: string
  provider_job_id: string | null
  status: string
  request_params: { duration?: number; aspect?: string; chain?: 'none' | 't2i' } | null
  result_path: string | null
}

const TERMINAL = new Set(['completed', 'failed', 'cancelled'])

/** Advance one row against the live provider state. Returns the fresh row. */
export async function advanceRow(svc: any, row: Row): Promise<any> {
  if (TERMINAL.has(row.status) || !row.provider_job_id) return row

  let hf
  try {
    hf = await hfStatus(row.provider_job_id)
  } catch (err) {
    // Status probe failed — leave the row untouched; polling will retry.
    if (err instanceof HfError && err.code === 'invalid_api_key') {
      return await update(svc, row.id, { status: 'failed', error_code: 'invalid_api_key', error_message: 'Provider credentials rejected.' })
    }
    return row
  }

  const chain = row.request_params?.chain ?? 'none'

  // Text mode: the first hop was a documented text-to-image; when it completes,
  // hand its still to the documented image-to-video model and keep generating.
  if (chain === 't2i') {
    if (hf.status === 'completed') {
      const still = hf.imageUrls[0]
      if (!still) return await update(svc, row.id, { status: 'failed', error_code: 'provider_failed', error_message: 'Text step returned no image.' })
      try {
        const sub = await hfSubmit(MODELS.i2v, { prompt: rowPrompt(row), image_url: still, duration: row.request_params?.duration ?? 5 })
        return await update(svc, row.id, {
          provider_job_id: sub.requestId,
          model: MODELS.i2v,
          status: 'generating',
          request_params: { ...row.request_params, chain: 'none' },
        })
      } catch (err) {
        const e = err instanceof HfError ? err : new HfError('provider_unavailable', 'Chained submit failed.')
        return await update(svc, row.id, { status: 'failed', error_code: e.code, error_message: e.message })
      }
    }
    if (hf.status === 'failed' || hf.status === 'nsfw') {
      return await update(svc, row.id, { status: 'failed', error_code: errorCodeFor(hf.status), error_message: hf.error ?? 'Text step rejected.' })
    }
    return await update(svc, row.id, { status: normalizeStatus(hf.status) })
  }

  // Video hop.
  if (hf.status === 'completed') {
    if (!hf.videoUrl) {
      return await update(svc, row.id, { status: 'failed', error_code: 'malformed_response', error_message: 'Provider returned no video URL.' })
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
      return await update(svc, row.id, { status: 'completed', result_path: path, result_url: publicUrl })
    } catch {
      return await update(svc, row.id, { status: 'failed', error_code: 'ingest_failed', error_message: 'Could not copy the result into storage.' })
    }
  }
  if (hf.status === 'failed' || hf.status === 'nsfw') {
    return await update(svc, row.id, { status: 'failed', error_code: errorCodeFor(hf.status), error_message: hf.error ?? 'Generation failed at the provider.' })
  }
  return await update(svc, row.id, { status: normalizeStatus(hf.status) })
}

async function update(svc: any, id: string, patch: Record<string, unknown>): Promise<any> {
  const { data } = await svc
    .from('video_generations')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return data
}

function rowPrompt(row: any): string {
  return typeof row.compiled_prompt === 'string' && row.compiled_prompt ? row.compiled_prompt : (row.user_prompt ?? '')
}
