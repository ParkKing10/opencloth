/* ============================================================
   Generation service — one orchestrator for every provider.

   Owns the job registry (localStorage — small JSON only), the
   polite polling loop (backoff + hard timeout, resumable after
   a reload), duplicate-submit protection, the credit reserve /
   refund handshake and result ingestion into the video asset
   store. The UI talks to THIS, never to a provider directly.
   ============================================================ */

import { uid } from '../types'
import type { GenerateClipInput, GenerationJob, VideoGenerationProvider } from './types'
import { isTerminal, nextPollDelay, POLL_TIMEOUT_MS, VIDEO_GEN_COST } from './types'
import { saveVideoAsset, type VideoAssetMeta } from './videoAssets'
import { mockProvider } from './mockProvider'

/* ---------------- provider selection ----------------
   VIDEO_PROVIDER switch: build-time default via VITE_VIDEO_PROVIDER, admin
   override in localStorage. The higgsfield adapter registers itself here to
   avoid a hard import cycle; without it (or without a backend) we honestly
   run the mock. */

const PROVIDER_OVERRIDE_KEY = 'loom-video-provider'
const registry = new Map<string, VideoGenerationProvider>([[mockProvider.id, mockProvider]])

export function registerProvider(p: VideoGenerationProvider): void {
  registry.set(p.id, p)
}

export function resolveProviderId(): 'mock' | 'higgsfield' {
  try {
    const o = localStorage.getItem(PROVIDER_OVERRIDE_KEY)
    if (o === 'mock' || o === 'higgsfield') return o
  } catch {
    /* ignore */
  }
  const env = (import.meta.env?.VITE_VIDEO_PROVIDER as string | undefined)?.toLowerCase()
  return env === 'higgsfield' ? 'higgsfield' : 'mock'
}

export function setProviderOverride(id: 'mock' | 'higgsfield' | null): void {
  try {
    if (id) localStorage.setItem(PROVIDER_OVERRIDE_KEY, id)
    else localStorage.removeItem(PROVIDER_OVERRIDE_KEY)
  } catch {
    /* ignore */
  }
}

export function getProvider(): VideoGenerationProvider {
  return registry.get(resolveProviderId()) ?? mockProvider
}

/* ---------------- job registry (persisted) ---------------- */

const JOBS_KEY = 'loom-director-jobs-v1'
const MAX_JOBS = 50

export function listJobs(): GenerationJob[] {
  try {
    const raw = localStorage.getItem(JOBS_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(arr) ? (arr.filter((j) => !!j && typeof j === 'object' && typeof (j as GenerationJob).id === 'string') as GenerationJob[]) : []
  } catch {
    return []
  }
}

function persist(jobs: GenerationJob[]): void {
  try {
    localStorage.setItem(JOBS_KEY, JSON.stringify(jobs.slice(-MAX_JOBS)))
  } catch {
    /* quota — job history is best-effort */
  }
}

export function upsertJob(job: GenerationJob): void {
  const jobs = listJobs()
  const i = jobs.findIndex((j) => j.id === job.id)
  if (i >= 0) jobs[i] = job
  else jobs.push(job)
  persist(jobs)
}

export function jobsForClip(clipId: string): GenerationJob[] {
  return listJobs().filter((j) => j.clipId === clipId)
}

/* ---------------- credits handshake ----------------
   The service never touches the store directly — the caller passes the wallet
   (reserve on submit, refund on provider-side failure per policy: failed/nsfw
   refunds, user cancel refunds, success keeps the charge). */

export type CreditWallet = {
  reserve: (coins: number) => boolean
  refund: (coins: number) => void
}

/* ---------------- start + run ---------------- */

export type StartResult = { job: GenerationJob; deduped: boolean }

export async function startGeneration(input: GenerateClipInput, wallet: CreditWallet): Promise<StartResult> {
  const provider = getProvider()

  // Duplicate protection FIRST: an identical in-flight submission is returned, never re-charged.
  const existing = listJobs().find((j) => j.idempotencyKey === input.idempotencyKey && !isTerminal(j.state))
  if (existing) return { job: existing, deduped: true }

  // Entitlement: reserve before the provider sees anything.
  const cost = provider.id === 'mock' ? 0 : inputCost()
  if (cost > 0 && !wallet.reserve(cost)) throw new Error('credits')

  try {
    const job = await provider.submitJob(input)
    const withCost = { ...job, costCoins: cost }
    upsertJob(withCost)
    return { job: withCost, deduped: false }
  } catch (err) {
    if (cost > 0) wallet.refund(cost) // submission never happened — full refund
    throw err
  }
}

const inputCost = (): number => VIDEO_GEN_COST

export type JobUpdate = (job: GenerationJob) => void

/** Consecutive status-probe failures tolerated before a job is declared unreachable. */
const MAX_PROBE_MISSES = 8

/** Same tab, same job, one loop — recovery + a surviving pre-unmount loop must
    never poll (or refund) the same job twice. */
const runningJobs = new Set<string>()

/** Refund EXACTLY once per job: the flag is persisted to the registry before the
    wallet moves, so a second loop (remount, second tab) sees `refunded` and skips. */
function refundOnce(job: GenerationJob, wallet: CreditWallet): GenerationJob {
  const fresh = listJobs().find((j) => j.id === job.id) ?? job
  if (fresh.refunded || job.costCoins <= 0) return { ...job, refunded: fresh.refunded ?? job.refunded }
  const marked = { ...job, refunded: true, updatedAt: Date.now() }
  upsertJob(marked)
  wallet.refund(job.costCoins)
  return marked
}

/**
 * Poll until terminal, ingest the media, return the final job. Resolves with
 * state 'completed' + resultAssetId, or 'failed'/'cancelled'. Never throws for
 * provider-side failures — the returned job carries the error.
 */
export async function runJob(job: GenerationJob, wallet: CreditWallet, onUpdate?: JobUpdate, signal?: AbortSignal): Promise<GenerationJob> {
  if (runningJobs.has(job.id)) {
    // Another loop in this tab already owns the job — report the latest state, do nothing.
    return listJobs().find((j) => j.id === job.id) ?? job
  }
  runningJobs.add(job.id)
  try {
    return await runJobInner(job, wallet, onUpdate, signal)
  } finally {
    runningJobs.delete(job.id)
  }
}

async function runJobInner(job: GenerationJob, wallet: CreditWallet, onUpdate?: JobUpdate, signal?: AbortSignal): Promise<GenerationJob> {
  const provider = registry.get(job.provider) ?? mockProvider
  let current = job
  const started = Date.now()
  let attempt = 0
  let misses = 0

  const commit = (next: GenerationJob) => {
    current = next
    upsertJob(current)
    onUpdate?.(current)
  }

  const abandon = async (state: 'cancelled' | 'failed', error?: GenerationJob['error']) => {
    try {
      await provider.cancelJob?.(current) // refunded jobs must not keep burning provider compute
    } catch {
      /* best-effort */
    }
    current = refundOnce(current, wallet)
    commit({ ...current, state, error })
    return current
  }

  while (!isTerminal(current.state) && current.state !== 'processing') {
    if (signal?.aborted) {
      // 'detach' (unmount) just stops WATCHING — the paid job keeps running and the
      // next mount's recovery resumes it. Anything else is a real user cancel.
      if ((signal as AbortSignal & { reason?: unknown }).reason === 'detach') return current
      return await abandon('cancelled')
    }
    if (Date.now() - started > POLL_TIMEOUT_MS) return await abandon('failed', { code: 'timeout', message: 'Generation timed out.' })
    await new Promise((r) => setTimeout(r, nextPollDelay(attempt++)))
    try {
      const probed = await provider.getJobStatus(current)
      misses = 0
      if (probed.state !== current.state || probed.updatedAt !== current.updatedAt) commit({ ...current, ...probed })
    } catch {
      // Transient status failure — tolerate a few, then declare the job unreachable
      // instead of polling a dead endpoint for the full ten minutes.
      if (++misses >= MAX_PROBE_MISSES) return await abandon('failed', { code: 'status_unreachable', message: 'Job status could not be read.' })
    }
  }

  if (current.state === 'failed' || current.state === 'cancelled') {
    // Provider-side failure/moderation: Higgsfield refunds its credits; we refund ours.
    current = refundOnce(current, wallet)
    commit({ ...current })
    return current
  }

  // Terminal-completed at the provider → ingest into OUR storage (never depend on a CDN URL).
  commit({ ...current, state: 'processing' })
  try {
    const media = await provider.downloadResult(current)
    const meta: VideoAssetMeta = await saveVideoAsset(media.blob, `generated-${current.id}`)
    commit({ ...current, state: 'completed', resultAssetId: meta.id })
  } catch (err) {
    current = refundOnce(current, wallet)
    commit({ ...current, state: 'failed', error: { code: 'ingest_failed', message: err instanceof Error ? err.message : 'Could not store the result.' } })
  }
  return current
}

/** After a reload: resume polling for cloud jobs, honestly fail lost mock jobs.
    The signal aborts resumed polling (unmount) without cancelling the provider jobs. */
export async function recoverPendingJobs(wallet: CreditWallet, onUpdate?: JobUpdate, signal?: AbortSignal): Promise<GenerationJob[]> {
  const pending = listJobs().filter((j) => !isTerminal(j.state))
  const results: GenerationJob[] = []
  for (const job of pending) {
    if (signal?.aborted) break
    if (job.provider === 'mock') {
      const dead = { ...job, state: 'failed' as const, error: { code: 'mock_lost', message: 'Mock job did not survive the reload.' }, updatedAt: Date.now() }
      upsertJob(dead)
      onUpdate?.(dead)
      results.push(dead)
    } else {
      results.push(await runJob(job, wallet, onUpdate, signal))
    }
  }
  return results
}

/** Fresh idempotency key for one user intent (a Generate click). */
export const newIdempotencyKey = (): string => `gen_${uid()}${uid()}`
