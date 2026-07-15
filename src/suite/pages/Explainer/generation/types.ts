/* ============================================================
   Video generation — normalized provider contracts.

   The UI and the project model never see provider-specific
   shapes: every provider (mock today, Higgsfield Cloud behind
   our Supabase Edge Functions) maps its responses into these
   types. The provider API key NEVER exists in this bundle —
   the higgsfield adapter only talks to our own backend.
   ============================================================ */

import type { MotionAspect } from '../types'
import type { ClipStyle, ClipTypeId } from '../clipModel'

/* ---------------- states ---------------- */

export type GenerationState =
  | 'draft'
  | 'validating'
  | 'uploading_assets'
  | 'queued'
  | 'generating'
  | 'processing' // provider finished — we are ingesting/normalizing the media
  | 'completed'
  | 'failed'
  | 'cancelled'

export const TERMINAL_STATES: ReadonlySet<GenerationState> = new Set(['completed', 'failed', 'cancelled'])
export const isTerminal = (s: GenerationState): boolean => TERMINAL_STATES.has(s)

/* ---------------- modes ---------------- */

export type GenerationMode =
  | 'text-to-video' // no assets: documented t2i → i2v chain (never a fabricated t2v endpoint)
  | 'image-to-video'
  | 'multi-reference'
  | 'product-shot'
  | 'character-consistent'
  | 'continuation'

/* ---------------- inputs ---------------- */

export type GenerateClipInput = {
  clipId: string
  clipType: ClipTypeId
  /** What the user typed — the only prompt they normally see. */
  userPrompt: string
  /** What we actually send to the provider (admin/debug inspectable). */
  compiledPrompt: string
  style: ClipStyle
  aspect: MotionAspect
  durationSec: number
  /** Image assets owned by the clip (engine/assets ids, stored as data URLs). */
  imageAssetIds: string[]
  /** Continue Scene: the accepted clip this one continues from. */
  continueFromClipId?: string
  /** A frame handed over for continuity (data URL), when available. */
  continuityImage?: string
  /** Guards double-submits: same key → same job, never a second paid job. */
  idempotencyKey: string
}

/* ---------------- jobs ---------------- */

export type GenerationError = { code: string; message: string }

export type GenerationJob = {
  /** Internal id — never the provider's. */
  id: string
  provider: 'mock' | 'higgsfield'
  /** The provider's job/request id, once submitted. */
  providerJobId?: string
  clipId: string
  mode: GenerationMode
  model?: string
  state: GenerationState
  error?: GenerationError
  userPrompt: string
  compiledPrompt: string
  /** Where the ingested media landed (videoAssets id) once completed. */
  resultAssetId?: string
  /** Result URL on OUR storage (higgsfield path) before ingestion, never a raw provider CDN link we depend on. */
  resultUrl?: string
  idempotencyKey: string
  costCoins: number
  retryCount: number
  createdAt: number
  updatedAt: number
}

export type GeneratedMedia = {
  blob: Blob
  mime: string
  width: number
  height: number
  duration: number
}

/* ---------------- the provider interface ---------------- */

export interface VideoGenerationProvider {
  readonly id: 'mock' | 'higgsfield'
  /** Validate + submit. Resolves as soon as the provider accepted the job. */
  submitJob(input: GenerateClipInput): Promise<GenerationJob>
  /** One status probe — providers must be cheap + idempotent here. */
  getJobStatus(job: GenerationJob): Promise<GenerationJob>
  cancelJob?(job: GenerationJob): Promise<void>
  /** Fetch the finished media (from OUR storage for cloud providers). */
  downloadResult(job: GenerationJob): Promise<GeneratedMedia>
}

/* ---------------- polling ----------------
   The API exposes status, not progress — poll politely with backoff and a hard
   timeout, and NEVER show fake percentages (the UI stays indeterminate). */

export const POLL_TIMEOUT_MS = 10 * 60 * 1000

/** Backoff schedule in ms: quick at first (queue moves fast), then settles at 15s. */
export function nextPollDelay(attempt: number): number {
  const steps = [2000, 3000, 5000, 8000, 12000]
  return attempt < steps.length ? steps[attempt] : 15000
}

/** What one generation costs in coins (reserved on submit, refunded on provider failure). */
export const VIDEO_GEN_COST = 300
