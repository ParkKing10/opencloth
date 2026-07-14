import { describe, expect, it } from 'vitest'
import { buildAdPlan } from './adPlan'
import type { RecordingAnalysis } from './recordingAnalysis'

const analysis: RecordingAnalysis = {
  duration: 12,
  times: [],
  activity: [],
  moments: [
    { t: 2, strength: 0.8, kind: 'action' },
    { t: 9, strength: 1, kind: 'reveal' },
  ],
  deadZones: [{ start: 4, end: 8 }], // 4s of loading
  thumbs: [{ t: 9, url: 'data:image/jpeg;base64,x' }],
}

describe('buildAdPlan', () => {
  it('speeds through dead zones and keeps live segments at 1x', () => {
    const plan = buildAdPlan(analysis, { deadSpeed: 4 })
    const dead = plan.clips.find((c) => c.speed > 1)
    expect(dead).toBeTruthy()
    expect(dead!.start).toBeCloseTo(4)
    expect(dead!.end).toBeCloseTo(8)
    expect(plan.clips.filter((c) => c.speed === 1).length).toBeGreaterThanOrEqual(2)
    // The 4s dead zone at 4× only adds 1s → total is well under the original 12s.
    expect(plan.cutDuration).toBeLessThan(12)
    expect(plan.deadTrimmed).toBeCloseTo(4)
  })

  it('focuses a live clip on its strongest moment', () => {
    const plan = buildAdPlan(analysis)
    const revealClip = plan.clips.find((c) => c.start <= 9 && c.end >= 9)
    expect(revealClip?.focus).toBeCloseTo(9)
  })

  it('builds a storyboard with a hook, the moments, and an outro', () => {
    const plan = buildAdPlan(analysis)
    expect(plan.story[0].kind).toBe('hook')
    expect(plan.story[plan.story.length - 1].kind).toBe('outro')
    expect(plan.story.some((s) => s.kind === 'reveal' && s.thumb)).toBe(true)
  })

  it('snaps live cut points to nearby beats', () => {
    const plan = buildAdPlan(analysis, { beats: [4.15] })
    // The dead zone starts at 4.0; the live clip before it ends near there and snaps to 4.15.
    expect(plan.clips.some((c) => Math.abs(c.end - 4.15) < 0.01 || Math.abs(c.start - 4.15) < 0.01)).toBe(true)
  })
})
