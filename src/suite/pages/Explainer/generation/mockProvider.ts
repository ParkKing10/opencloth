/* ============================================================
   Mock provider — local development + no-backend fallback.

   Honest by construction: it does not pretend to be Higgsfield.
   It bakes a REAL playable video (the deterministic engine spec
   rendered to webm via canvas + MediaRecorder), walking through
   the same normalized states the cloud path uses — so every part
   of the pipeline (submit → poll → download → ingest → preview)
   is exercised without spending a single provider credit.

   VIDEO_PROVIDER=mock (default) selects this provider.
   ============================================================ */

import { uid } from '../types'
import { newClip } from '../clipModel'
import { generateSceneVersions } from '../clipDirector'
import { exportVideo } from '../engine/exportVideo'
import { ensureAssetsLoaded } from '../engine/assets'
import type { GenerateClipInput, GenerationJob, GeneratedMedia, VideoGenerationProvider } from './types'
import { probeVideo } from './videoAssets'

type MockEntry = { job: GenerationJob; blob?: Blob; bake: Promise<void> }

/** In-memory only — a reload loses mock jobs, and recovery honestly fails them. */
const jobs = new Map<string, MockEntry>()

const now = () => Date.now()

function update(entry: MockEntry, patch: Partial<GenerationJob>): void {
  entry.job = { ...entry.job, ...patch, updatedAt: now() }
}

async function bake(entry: MockEntry, input: GenerateClipInput): Promise<void> {
  try {
    update(entry, { state: 'queued' })
    await new Promise((r) => setTimeout(r, 400))
    update(entry, { state: 'generating' })
    // Direct a single take with the local director and rasterize it for real.
    const pseudo = {
      ...newClip(input.clipType),
      id: input.clipId,
      prompt: input.userPrompt || input.compiledPrompt,
      title: '',
      style: input.style,
      durationSec: input.durationSec,
      assetIds: input.imageAssetIds,
    }
    await ensureAssetsLoaded(input.imageAssetIds)
    const metas = input.imageAssetIds.map((id) => ({ id, name: 'asset', addedAt: 0 }))
    const versions = await generateSceneVersions(pseudo, metas, '#d1f94f', input.aspect, entry.job.retryCount)
    const take = versions[0]
    if (take.kind !== 'scene') throw new Error('mock: unexpected version kind')
    const blob = await exportVideo({ project: take.spec })
    entry.blob = blob
    update(entry, { state: 'completed' })
  } catch (err) {
    update(entry, { state: 'failed', error: { code: 'mock_bake_failed', message: err instanceof Error ? err.message : 'bake failed' } })
  }
}

export const mockProvider: VideoGenerationProvider = {
  id: 'mock',

  async submitJob(input: GenerateClipInput): Promise<GenerationJob> {
    // Idempotency: the same key returns the SAME job — a double click never bakes twice.
    for (const e of jobs.values()) {
      if (e.job.idempotencyKey === input.idempotencyKey && e.job.state !== 'failed' && e.job.state !== 'cancelled') return e.job
    }
    const job: GenerationJob = {
      id: uid(),
      provider: 'mock',
      providerJobId: `mock_${uid()}`,
      clipId: input.clipId,
      mode: input.imageAssetIds.length > 0 ? 'image-to-video' : 'text-to-video',
      model: 'loom-local-director',
      state: 'validating',
      userPrompt: input.userPrompt,
      compiledPrompt: input.compiledPrompt,
      idempotencyKey: input.idempotencyKey,
      costCoins: 0, // the mock never spends anything
      retryCount: 0,
      createdAt: now(),
      updatedAt: now(),
    }
    const entry: MockEntry = { job, bake: Promise.resolve() }
    jobs.set(job.id, entry)
    entry.bake = bake(entry, input)
    return entry.job
  },

  async getJobStatus(job: GenerationJob): Promise<GenerationJob> {
    const entry = jobs.get(job.id)
    if (!entry) {
      // Reload wiped the in-memory bake — say so instead of hanging forever.
      return { ...job, state: 'failed', error: { code: 'mock_lost', message: 'Mock job did not survive the reload.' }, updatedAt: now() }
    }
    return entry.job
  },

  async cancelJob(job: GenerationJob): Promise<void> {
    const entry = jobs.get(job.id)
    if (entry && entry.job.state !== 'completed') update(entry, { state: 'cancelled' })
  },

  async downloadResult(job: GenerationJob): Promise<GeneratedMedia> {
    const entry = jobs.get(job.id)
    if (!entry?.blob) throw new Error('mock: no result available')
    const probed = await probeVideo(entry.blob)
    return { blob: entry.blob, mime: entry.blob.type || 'video/webm', ...probed }
  },
}
