/* ============================================================
   Higgsfield provider — the CLIENT half.

   Talks exclusively to our own Supabase Edge Functions
   (hf-submit / hf-status). The provider API key never exists in
   this bundle, in localStorage, in requests from this origin or
   in anything a source map could leak — the browser only ever
   holds the user's own Supabase session.

   Server rows are normalized here into the app's GenerationJob;
   nothing downstream knows Higgsfield response shapes.
   ============================================================ */

import { supabase, isSupabaseConfigured } from '../../../../lib/supabase'
import { getAssetImage, ensureAssetsLoaded } from '../engine/assets'
import type { GenerateClipInput, GenerationJob, GenerationState, GeneratedMedia, VideoGenerationProvider } from './types'
import { registerProvider } from './generationService'
import { probeVideo } from './videoAssets'

/* ---------------- server row → normalized job ---------------- */

type ServerRow = {
  id: string
  clip_id: string
  provider_job_id?: string | null
  model?: string | null
  mode?: string | null
  status?: string | null
  error_code?: string | null
  error_message?: string | null
  user_prompt?: string | null
  compiled_prompt?: string | null
  idempotency_key?: string | null
  result_url?: string | null
  retry_count?: number | null
  created_at?: string | null
  updated_at?: string | null
}

const STATE_MAP: Record<string, GenerationState> = {
  queued: 'queued',
  generating: 'generating',
  in_progress: 'generating',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
}

/** Exported for tests — the ONLY place server rows become app jobs. */
export function normalizeServerRow(row: ServerRow, fallback?: GenerationJob): GenerationJob {
  return {
    id: row.id,
    provider: 'higgsfield',
    providerJobId: row.provider_job_id ?? undefined,
    clipId: row.clip_id ?? fallback?.clipId ?? '',
    mode: (row.mode as GenerationJob['mode']) ?? fallback?.mode ?? 'image-to-video',
    model: row.model ?? undefined,
    state: STATE_MAP[row.status ?? ''] ?? 'queued',
    error: row.error_code ? { code: row.error_code, message: row.error_message ?? 'Generation failed.' } : undefined,
    userPrompt: row.user_prompt ?? fallback?.userPrompt ?? '',
    compiledPrompt: row.compiled_prompt ?? fallback?.compiledPrompt ?? '',
    resultAssetId: fallback?.resultAssetId,
    resultUrl: row.result_url ?? undefined,
    idempotencyKey: row.idempotency_key ?? fallback?.idempotencyKey ?? '',
    costCoins: fallback?.costCoins ?? 0,
    refunded: fallback?.refunded,
    retryCount: row.retry_count ?? 0,
    createdAt: row.created_at ? Date.parse(row.created_at) : (fallback?.createdAt ?? Date.now()),
    updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
  }
}

type FnResult<T> = { data: T | null; error: { message?: string } | null }

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('backend_missing')
  const { data, error } = (await supabase.functions.invoke(name, { body })) as FnResult<T>
  if (error || !data) throw new Error(error?.message ?? 'backend_error')
  const maybeErr = data as { error?: { code?: string; message?: string } }
  if (maybeErr.error) throw new Error(maybeErr.error.code ?? 'backend_error')
  return data
}

/* ---------------- the provider ---------------- */

export const higgsfieldProvider: VideoGenerationProvider = {
  id: 'higgsfield',

  async submitJob(input: GenerateClipInput): Promise<GenerationJob> {
    // Ship the clip's reference images as data URLs; the server re-hosts them.
    await ensureAssetsLoaded(input.imageAssetIds)
    const images = input.imageAssetIds
      .map((id) => getAssetImage(id)?.src)
      .filter((src): src is string => typeof src === 'string' && src.startsWith('data:image/'))
      .map((dataUrl) => ({ dataUrl }))
    if (input.continuityImage?.startsWith('data:image/')) images.unshift({ dataUrl: input.continuityImage })

    const res = await invoke<{ job: ServerRow }>('hf-submit', {
      clipId: input.clipId,
      userPrompt: input.userPrompt,
      compiledPrompt: input.compiledPrompt,
      durationSec: input.durationSec,
      aspect: input.aspect,
      images,
      idempotencyKey: input.idempotencyKey,
    })
    return normalizeServerRow(res.job)
  },

  async getJobStatus(job: GenerationJob): Promise<GenerationJob> {
    const res = await invoke<{ job: ServerRow }>('hf-status', { generationId: job.id })
    return normalizeServerRow(res.job, job)
  },

  async cancelJob(job: GenerationJob): Promise<void> {
    // A refunded job must not keep burning provider compute — forward the cancel
    // (documented: effective while queued) and mark the row cancelled server-side.
    await invoke<{ job: ServerRow }>('hf-cancel', { generationId: job.id })
  },

  async downloadResult(job: GenerationJob): Promise<GeneratedMedia> {
    if (!job.resultUrl) throw new Error('no_result')
    // The URL points at OUR storage bucket (the server already ingested the CDN file).
    const res = await fetch(job.resultUrl)
    if (!res.ok) throw new Error('result_fetch_failed')
    const blob = await res.blob()
    const probed = await probeVideo(blob)
    return { blob, mime: blob.type || 'video/mp4', ...probed }
  },
}

/** Wire the provider into the service when a backend exists at all. */
export function registerHiggsfieldProvider(): void {
  if (isSupabaseConfigured) registerProvider(higgsfieldProvider)
}
