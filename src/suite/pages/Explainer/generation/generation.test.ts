import { describe, it, expect, beforeEach, vi } from 'vitest'

// videoAssets touches IndexedDB + <video> — mock the ingestion boundary so the
// service tests run in node. The mock returns a stable meta for any blob.
vi.mock('./videoAssets', () => ({
  saveVideoAsset: vi.fn(async (_blob: Blob, name: string) => ({
    id: 'asset-1',
    name,
    mime: 'video/webm',
    size: 3,
    duration: 5,
    width: 1920,
    height: 1080,
    thumb: '',
    addedAt: 0,
  })),
  probeVideo: vi.fn(async () => ({ duration: 5, width: 1920, height: 1080 })),
}))

import { compilePrompt, resolveMode } from './promptCompiler'
import { nextPollDelay, isTerminal, VIDEO_GEN_COST, type GenerationJob, type VideoGenerationProvider, type GenerateClipInput } from './types'
import { startGeneration, runJob, registerProvider, setProviderOverride, listJobs, upsertJob, newIdempotencyKey, type CreditWallet } from './generationService'
import { normalizeServerRow } from './higgsfieldProvider'

class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v))
  }
  removeItem(k: string): void {
    this.m.delete(k)
  }
  clear(): void {
    this.m.clear()
  }
}

beforeEach(() => {
  ;(globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage()
})

/* ---------------- prompt compiler ---------------- */

describe('promptCompiler', () => {
  const base = {
    clipType: 'screenshot' as const,
    userPrompt: 'Move the cursor to Generate and click it',
    style: 'cinematic' as const,
    aspect: '16:9' as const,
    durationSec: 5,
    brandProduct: 'loom studios',
    brandAccent: '#d1f94f',
    hasImages: true,
    imageCount: 1,
  }

  it('keeps the user prompt first and adds direction — both prompts stored separately by design', () => {
    const out = compilePrompt(base)
    expect(out.startsWith(base.userPrompt)).toBe(true)
    expect(out).toContain('SHOT GOAL')
    expect(out).toContain('STYLE')
    expect(out).toContain('BRAND: loom studios')
  })

  it('screenshot mode forbids UI hallucination and anchors to the real upload', () => {
    const out = compilePrompt(base)
    expect(out).toContain('never redraw, never invent UI')
    expect(out).toContain('ground truth')
  })

  it('continuation adds a continuity block referencing the source brief', () => {
    const out = compilePrompt({ ...base, continuesFrom: { userPrompt: 'the hoodie reveal' } })
    expect(out).toContain('CONTINUITY')
    expect(out).toContain('the hoodie reveal')
  })

  it('is deterministic', () => {
    expect(compilePrompt(base)).toBe(compilePrompt(base))
  })

  it('resolves modes from inputs, never from providers', () => {
    expect(resolveMode({ clipType: 'typography', hasImages: false, continuesFrom: false })).toBe('text-to-video')
    expect(resolveMode({ clipType: 'screenshot', hasImages: true, continuesFrom: false })).toBe('image-to-video')
    expect(resolveMode({ clipType: 'garment', hasImages: true, continuesFrom: false })).toBe('product-shot')
    expect(resolveMode({ clipType: 'ai-scene', hasImages: true, continuesFrom: true })).toBe('continuation')
  })
})

/* ---------------- polling maths ---------------- */

describe('polling schedule', () => {
  it('backs off politely and settles at 15s — never an aggressive loop', () => {
    const delays = [0, 1, 2, 3, 4, 5, 20].map(nextPollDelay)
    expect(delays[0]).toBe(2000)
    expect(delays[delays.length - 1]).toBe(15000)
    for (let i = 1; i < delays.length; i++) expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1])
  })

  it('knows its terminal states', () => {
    expect(isTerminal('completed') && isTerminal('failed') && isTerminal('cancelled')).toBe(true)
    expect(isTerminal('generating') || isTerminal('queued') || isTerminal('processing')).toBe(false)
  })
})

/* ---------------- service: dedupe, wallet, lifecycle ---------------- */

function fakeProvider(script: { failStatus?: boolean; endState?: 'completed' | 'failed' }): VideoGenerationProvider & { submits: number } {
  const p = {
    id: 'higgsfield' as const,
    submits: 0,
    async submitJob(input: GenerateClipInput): Promise<GenerationJob> {
      p.submits++
      return {
        id: `job-${p.submits}`,
        provider: 'higgsfield',
        providerJobId: 'req-1',
        clipId: input.clipId,
        mode: 'image-to-video',
        state: 'queued',
        userPrompt: input.userPrompt,
        compiledPrompt: input.compiledPrompt,
        idempotencyKey: input.idempotencyKey,
        costCoins: 0,
        retryCount: 0,
        createdAt: 1,
        updatedAt: 1,
      }
    },
    async getJobStatus(job: GenerationJob): Promise<GenerationJob> {
      if (script.failStatus) throw new Error('flaky')
      const end = script.endState ?? 'completed'
      return { ...job, state: end, error: end === 'failed' ? { code: 'provider_failed', message: 'nope' } : undefined, resultUrl: 'blob:x', updatedAt: 2 }
    },
    async downloadResult(): Promise<{ blob: Blob; mime: string; width: number; height: number; duration: number }> {
      return { blob: new Blob(['vid'], { type: 'video/webm' }), mime: 'video/webm', width: 1920, height: 1080, duration: 5 }
    },
  }
  return p
}

const walletOf = (coins: number): CreditWallet & { balance: number } => {
  const w = {
    balance: coins,
    reserve(c: number) {
      if (w.balance < c) return false
      w.balance -= c
      return true
    },
    refund(c: number) {
      w.balance += c
    },
  }
  return w
}

const input = (key: string): GenerateClipInput => ({
  clipId: 'clip-1',
  clipType: 'garment',
  userPrompt: 'reveal',
  compiledPrompt: 'reveal…',
  style: 'cinematic',
  aspect: '16:9',
  durationSec: 5,
  imageAssetIds: [],
  idempotencyKey: key,
})

describe('generationService', () => {
  beforeEach(() => setProviderOverride('higgsfield'))

  it('the same idempotency key never creates a second paid job', async () => {
    const p = fakeProvider({})
    registerProvider(p)
    const w = walletOf(1000)
    const key = newIdempotencyKey()
    const a = await startGeneration(input(key), w)
    const b = await startGeneration(input(key), w)
    expect(a.deduped).toBe(false)
    expect(b.deduped).toBe(true)
    expect(b.job.id).toBe(a.job.id)
    expect(p.submits).toBe(1)
    expect(w.balance).toBe(1000 - VIDEO_GEN_COST) // charged exactly once
  })

  it('refuses without enough coins and never contacts the provider', async () => {
    const p = fakeProvider({})
    registerProvider(p)
    await expect(startGeneration(input(newIdempotencyKey()), walletOf(10))).rejects.toThrow('credits')
    expect(p.submits).toBe(0)
  })

  it('completes: polls, ingests, keeps the charge and records the asset', async () => {
    const p = fakeProvider({ endState: 'completed' })
    registerProvider(p)
    const w = walletOf(1000)
    const { job } = await startGeneration(input(newIdempotencyKey()), w)
    const final = await runJob(job, w)
    expect(final.state).toBe('completed')
    expect(final.resultAssetId).toBe('asset-1')
    expect(w.balance).toBe(1000 - VIDEO_GEN_COST) // success keeps the charge
    expect(listJobs().find((j) => j.id === final.id)?.state).toBe('completed')
  })

  it('provider failure refunds the reserved coins', async () => {
    const p = fakeProvider({ endState: 'failed' })
    registerProvider(p)
    const w = walletOf(1000)
    const { job } = await startGeneration(input(newIdempotencyKey()), w)
    const final = await runJob(job, w)
    expect(final.state).toBe('failed')
    expect(final.error?.code).toBe('provider_failed')
    expect(w.balance).toBe(1000) // fully refunded
  })

  it('cancellation refunds and lands as cancelled', async () => {
    const p = fakeProvider({ failStatus: true }) // status never resolves → we cancel first
    registerProvider(p)
    const w = walletOf(1000)
    const { job } = await startGeneration(input(newIdempotencyKey()), w)
    const ctrl = new AbortController()
    const run = runJob(job, w, undefined, ctrl.signal)
    ctrl.abort()
    const final = await run
    expect(final.state).toBe('cancelled')
    expect(w.balance).toBe(1000)
  }, 10_000)

  it('a job can never refund twice — flag persists across a second (stale) loop', async () => {
    const p = fakeProvider({ endState: 'failed' })
    registerProvider(p)
    const w = walletOf(1000)
    const { job } = await startGeneration(input(newIdempotencyKey()), w)
    const final = await runJob(job, w)
    expect(final.state).toBe('failed')
    expect(w.balance).toBe(1000) // refunded once
    // A remounted component / second tab resumes the same job: no second refund.
    const again = await runJob({ ...job, state: 'failed' }, w)
    expect(again.state).toBe('failed')
    expect(w.balance).toBe(1000)
  })

  it('two concurrent loops on one job: only one runs, one refund total', async () => {
    const p = fakeProvider({ endState: 'failed' })
    registerProvider(p)
    const w = walletOf(1000)
    const { job } = await startGeneration(input(newIdempotencyKey()), w)
    const [a, b] = await Promise.all([runJob(job, w), runJob(job, w)])
    expect([a.state, b.state]).toContain('failed')
    expect(w.balance).toBe(1000)
  })

  it("detach (unmount) stops watching WITHOUT cancelling or refunding — the job keeps running", async () => {
    const p = fakeProvider({ failStatus: true }) // never reaches terminal on its own
    registerProvider(p)
    const w = walletOf(1000)
    const { job } = await startGeneration(input(newIdempotencyKey()), w)
    const ctrl = new AbortController()
    const run = runJob(job, w, undefined, ctrl.signal)
    ctrl.abort('detach')
    const detached = await run
    expect(isTerminal(detached.state)).toBe(false) // still in flight server-side
    expect(w.balance).toBe(1000 - VIDEO_GEN_COST) // charge stays — nothing was cancelled
  }, 10_000)

  it('registry survives hostile localStorage content', () => {
    localStorage.setItem('loom-director-jobs-v1', '{"not":"an array"}')
    expect(listJobs()).toEqual([])
    localStorage.setItem('loom-director-jobs-v1', JSON.stringify([null, 42, { id: 'ok' }]))
    expect(listJobs().map((j) => j.id)).toEqual(['ok'])
    upsertJob({ ...inputJob(), id: 'ok' })
    expect(listJobs()).toHaveLength(1)
  })
})

const inputJob = (): GenerationJob => ({
  id: 'x',
  provider: 'higgsfield',
  clipId: 'c',
  mode: 'image-to-video',
  state: 'queued',
  userPrompt: '',
  compiledPrompt: '',
  idempotencyKey: 'k',
  costCoins: 0,
  retryCount: 0,
  createdAt: 0,
  updatedAt: 0,
})

/* ---------------- server-row normalization ---------------- */

describe('normalizeServerRow', () => {
  it('maps provider rows into the app job — provider shapes never leak past here', () => {
    const job = normalizeServerRow({
      id: 'g1',
      clip_id: 'c1',
      provider_job_id: 'req-9',
      model: 'higgsfield-ai/dop/standard',
      mode: 'image-to-video',
      status: 'generating',
      user_prompt: 'u',
      compiled_prompt: 'cp',
      idempotency_key: 'k',
      result_url: null,
      created_at: '2026-07-15T00:00:00Z',
      updated_at: '2026-07-15T00:01:00Z',
    })
    expect(job.state).toBe('generating')
    expect(job.provider).toBe('higgsfield')
    expect(job.providerJobId).toBe('req-9')
    expect(job.createdAt).toBe(Date.parse('2026-07-15T00:00:00Z'))
  })

  it('unknown status degrades to queued; errors carry code + message', () => {
    const weird = normalizeServerRow({ id: 'g2', clip_id: 'c', status: 'sparkling' })
    expect(weird.state).toBe('queued')
    const failed = normalizeServerRow({ id: 'g3', clip_id: 'c', status: 'failed', error_code: 'moderation', error_message: 'nope' })
    expect(failed.error).toEqual({ code: 'moderation', message: 'nope' })
  })
})
