import { describe, it, expect } from 'vitest'
import { outputSize, pointerAt } from './composer'
import type { PointerEvt } from './types'

describe('outputSize', () => {
  it('produces a 16:9 canvas capped at 1920 on the long edge', () => {
    expect(outputSize('16:9', 2560, 1440)).toEqual({ w: 1920, h: 1080 })
  })

  it('produces a vertical 9:16 canvas', () => {
    const { w, h } = outputSize('9:16', 1920, 1080)
    expect(h).toBe(1920)
    expect(w).toBe(1080)
  })

  it('produces a square canvas', () => {
    expect(outputSize('1:1', 1920, 1080)).toEqual({ w: 1080, h: 1080 })
  })

  it('scales the source aspect ratio, long edge to 1920', () => {
    const { w, h } = outputSize('source', 1000, 500)
    expect(w).toBe(1920)
    expect(h).toBe(960)
  })
})

describe('pointerAt', () => {
  const events: PointerEvt[] = [
    { t: 0, x: 0, y: 0, click: false },
    { t: 1, x: 1, y: 0.5, click: false },
    { t: 2, x: 0.5, y: 1, click: true },
  ]

  it('returns null for an empty timeline', () => {
    expect(pointerAt([], 1)).toBeNull()
  })

  it('interpolates linearly between two samples', () => {
    const p = pointerAt(events, 0.5)
    expect(p?.x).toBeCloseTo(0.5)
    expect(p?.y).toBeCloseTo(0.25)
  })

  it('clamps to the last sample past the end of the timeline', () => {
    const p = pointerAt(events, 99)
    expect(p).toEqual({ x: 0.5, y: 1 })
  })

  it('clamps to the first sample before the start', () => {
    const p = pointerAt(events, -5)
    expect(p?.x).toBeCloseTo(0)
    expect(p?.y).toBeCloseTo(0)
  })
})
