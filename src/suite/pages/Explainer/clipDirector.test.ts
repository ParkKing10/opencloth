import { describe, it, expect, beforeEach } from 'vitest'
import { generateSceneVersions, generateFootageVersions, headlineFrom } from './clipDirector'
import { newClip, newCommercial, acceptedClips, clipPlayLength, commercialDuration, loadCommercial, saveCommercial } from './clipModel'
import type { RecordingAnalysis } from './engine/recordingAnalysis'

// Same MemoryStorage pattern as garmentDocumentStore.test — vitest runs in node.
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

const analysis: RecordingAnalysis = {
  duration: 20,
  activity: [0.1, 0.9, 0.05, 0.05, 0.8, 0.1],
  times: [0, 4, 8, 12, 16, 20],
  moments: [
    { t: 4, strength: 3, kind: 'action' },
    { t: 16, strength: 2.5, kind: 'reveal' },
  ],
  deadZones: [{ start: 7, end: 13 }],
  thumbs: [],
}

describe('clipDirector — scene generation', () => {
  it('always returns three takes labeled A/B/C, each a one-scene custom spec of the asked duration', async () => {
    const clip = { ...newClip('typography'), prompt: 'Design. Produce. Scale.', durationSec: 4 }
    const versions = await generateSceneVersions(clip, [], '#d1f94f', '16:9')
    expect(versions.map((v) => v.label)).toEqual(['A', 'B', 'C'])
    for (const v of versions) {
      if (v.kind !== 'scene') throw new Error('expected scene versions')
      expect(v.spec.scenes).toHaveLength(1)
      const scene = v.spec.scenes[0]
      expect(scene.type).toBe('custom')
      expect(scene.duration).toBe(4)
      if (scene.type === 'custom') expect(scene.props.elements.length).toBeGreaterThan(0)
    }
  })

  it('screenshot mode animates the REAL upload: image element + clicking cursor + zoom camera, never a mockup', async () => {
    const clip = { ...newClip('screenshot'), prompt: 'Click Generate', assetIds: ['shot-1'] }
    const versions = await generateSceneVersions(clip, [{ id: 'shot-1', name: 'dash.png', addedAt: 0 }], '#d1f94f', '16:9')
    for (const v of versions) {
      if (v.kind !== 'scene') throw new Error('expected scene versions')
      const scene = v.spec.scenes[0]
      if (scene.type !== 'custom') throw new Error('expected custom scene')
      const kinds = scene.props.elements.map((e) => e.kind)
      expect(kinds).not.toContain('mockup') // the fake-UI rule
      const img = scene.props.elements.find((e) => e.kind === 'image')
      expect(img && img.kind === 'image' ? img.assetId : null).toBe('shot-1')
      const cursor = scene.props.elements.find((e) => e.kind === 'cursor')
      expect(cursor && cursor.kind === 'cursor' ? cursor.path.some((p) => p.click) : false).toBe(true)
      expect((scene.props.camera ?? []).some((k) => k.scale > 1.2)).toBe(true)
    }
  })

  it('image-led types without an upload degrade honestly to typography instead of faking UI', async () => {
    const clip = { ...newClip('screenshot'), prompt: '"No assets here"' }
    const versions = await generateSceneVersions(clip, [], '#d1f94f', '16:9')
    for (const v of versions) {
      if (v.kind !== 'scene') throw new Error('expected scene versions')
      const scene = v.spec.scenes[0]
      if (scene.type !== 'custom') throw new Error('expected custom scene')
      const kinds = scene.props.elements.map((e) => e.kind)
      expect(kinds).not.toContain('mockup')
      expect(kinds).not.toContain('image')
      expect(kinds).toContain('text')
    }
  })

  it('regenerate (nonce) changes the direction of screenshot takes', async () => {
    const clip = { ...newClip('screenshot'), assetIds: ['shot-1'] }
    const a = await generateSceneVersions(clip, [], '#d1f94f', '16:9', 0)
    const b = await generateSceneVersions(clip, [], '#d1f94f', '16:9', 1)
    const cam = (vs: typeof a) => JSON.stringify(vs.map((v) => (v.kind === 'scene' && v.spec.scenes[0].type === 'custom' ? v.spec.scenes[0].props.camera : null)))
    expect(cam(a)).not.toBe(cam(b))
  })

  it('headlineFrom prefers quoted copy over the raw prompt', () => {
    const clip = { ...newClip('typography'), prompt: 'A premium intro with the word "Describe" in glow' }
    expect(headlineFrom(clip)).toBe('Describe')
  })
})

describe('clipDirector — footage generation', () => {
  it('returns three plans with no intro/outro cards and real cut durations', () => {
    const { versions, durations } = generateFootageVersions(analysis, '#d1f94f')
    expect(versions.map((v) => v.label)).toEqual(['A', 'B', 'C'])
    for (const v of versions) {
      if (v.kind !== 'footage') throw new Error('expected footage versions')
      expect(v.cfg.intro).toBe(0)
      expect(v.cfg.outro).toBe(0)
      expect(v.plan.cutDuration).toBeGreaterThan(0)
      expect(v.plan.cutDuration).toBeLessThan(analysis.duration) // dead time sped up
    }
    // Different deadSpeeds → different cuts.
    expect(new Set(durations.map((d) => d.toFixed(2))).size).toBeGreaterThan(1)
  })
})

describe('clipModel — commercial assembly + persistence', () => {
  it('orders accepted clips and sums trimmed lengths', () => {
    const c = newCommercial()
    const k1 = { ...newClip('typography'), durationSec: 4, status: 'accepted' as const, acceptedId: 'v1', versions: [], trimStart: 0.5, trimEnd: 0.5 }
    const k2 = { ...newClip('logo'), durationSec: 3, status: 'accepted' as const, acceptedId: 'v2', versions: [] }
    c.clips = [k1, k2]
    c.order = [k2.id, k1.id]
    expect(acceptedClips(c).map((k) => k.id)).toEqual([k2.id, k1.id])
    expect(clipPlayLength(k1)).toBe(3)
    expect(commercialDuration(c)).toBe(6)
  })

  it('round-trips through storage and clamps hostile fields', async () => {
    const c = newCommercial()
    const clip = { ...newClip('garment'), title: 'x'.repeat(300), durationSec: 99, prompt: 'ok' }
    const versions = await generateSceneVersions(clip, [], '#d1f94f', '16:9')
    c.clips = [{ ...clip, versions, status: 'ready' }]
    expect(saveCommercial(c)).toBe(true)
    const back = loadCommercial()
    expect(back.clips).toHaveLength(1)
    expect(back.clips[0].title.length).toBeLessThanOrEqual(80)
    expect(back.clips[0].durationSec).toBeLessThanOrEqual(8)
    expect(back.clips[0].versions).toHaveLength(3)
    expect(back.clips[0].status).toBe('ready')
  })

  it('footage versions do not survive a reload — the clip honestly returns to draft', () => {
    const c = newCommercial()
    const { versions } = generateFootageVersions(analysis, '#d1f94f')
    const clip = { ...newClip('recording'), versions, status: 'accepted' as const, acceptedId: versions[0].id }
    c.clips = [clip]
    c.order = [clip.id]
    saveCommercial(c)
    const back = loadCommercial()
    expect(back.clips[0].status).toBe('draft')
    expect(back.clips[0].versions).toHaveLength(0)
    expect(back.clips[0].acceptedId).toBeUndefined()
  })
})
