import { describe, expect, it } from 'vitest'
import { detectMoments } from './recordingAnalysis'

/** Build an activity envelope at a given fps with spikes at some times and a flat dead stretch. */
function envelope(seconds: number, fps: number, spikes: number[], deadRange?: [number, number]) {
  const n = Math.round(seconds * fps)
  const times: number[] = []
  const activity: number[] = []
  for (let i = 0; i < n; i++) {
    const t = i / fps
    times.push(t)
    let v = 0.08 + 0.02 * Math.sin(i) // low baseline
    if (deadRange && t >= deadRange[0] && t <= deadRange[1]) v = 0.02
    for (const s of spikes) if (Math.abs(t - s) < 1 / fps) v = 0.95
    activity.push(v)
  }
  return { times, activity }
}

describe('detectMoments', () => {
  it('finds the spikes as key moments', () => {
    const { times, activity } = envelope(10, 6, [2, 5, 8])
    const { moments } = detectMoments(activity, times)
    // One moment near each spike.
    expect(moments.length).toBeGreaterThanOrEqual(3)
    for (const target of [2, 5, 8]) {
      expect(moments.some((m) => Math.abs(m.t - target) < 0.4)).toBe(true)
    }
    // Strengths are normalised to 0..1.
    expect(Math.max(...moments.map((m) => m.strength))).toBeCloseTo(1, 5)
  })

  it('detects a long low-activity stretch as a dead zone', () => {
    const { times, activity } = envelope(12, 6, [1, 11], [4, 8])
    const { deadZones } = detectMoments(activity, times)
    expect(deadZones.length).toBeGreaterThanOrEqual(1)
    const dz = deadZones.find((z) => z.start <= 5 && z.end >= 7)
    expect(dz).toBeTruthy()
    expect((dz!.end - dz!.start)).toBeGreaterThan(2)
  })

  it('respects the minimum gap between moments (clustered spikes collapse to one)', () => {
    const { times, activity } = envelope(6, 10, [2.0, 2.1, 2.2])
    const { moments } = detectMoments(activity, times, { minGap: 0.7 })
    const near2 = moments.filter((m) => Math.abs(m.t - 2) < 0.5)
    expect(near2.length).toBe(1)
  })

  it('is deterministic and safe on empty input', () => {
    expect(detectMoments([], [])).toEqual({ moments: [], deadZones: [] })
    const { times, activity } = envelope(5, 6, [2.5])
    expect(detectMoments(activity, times)).toEqual(detectMoments(activity, times))
  })
})
