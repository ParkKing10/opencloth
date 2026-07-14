import { describe, it, expect } from 'vitest'
import { clamp01, easeOutBack, easeOutExpo, pulse, seg } from './ease'
import { formatCount, sceneAt, totalDuration } from './render'
import { defaultProject } from '../types'

describe('easing math', () => {
  it('clamp01 bounds values', () => {
    expect(clamp01(-2)).toBe(0)
    expect(clamp01(0.4)).toBe(0.4)
    expect(clamp01(7)).toBe(1)
  })

  it('seg maps a window to 0..1 and clamps outside', () => {
    expect(seg(1, 2, 4)).toBe(0)
    expect(seg(3, 2, 4)).toBeCloseTo(0.5)
    expect(seg(9, 2, 4)).toBe(1)
  })

  it('eases land exactly on 1', () => {
    expect(easeOutExpo(1)).toBe(1)
    expect(easeOutBack(1)).toBeCloseTo(1)
  })

  it('pulse rises then falls around its centre', () => {
    expect(pulse(0.1, 0.3, 0.05)).toBe(0)
    expect(pulse(0.35, 0.3, 0.05)).toBeCloseTo(1)
    expect(pulse(0.42, 0.3, 0.05)).toBe(0)
  })
})

describe('timeline', () => {
  const p = defaultProject() // durations 4 + 3.5 + 8 + 5 + 4.5 = 25s

  it('sums scene durations', () => {
    expect(totalDuration(p)).toBeCloseTo(25)
  })

  it('maps absolute time to the owning scene + local progress', () => {
    expect(sceneAt(p, 0)).toEqual({ index: 0, local: 0 })
    expect(sceneAt(p, 2).index).toBe(0)
    expect(sceneAt(p, 2).local).toBeCloseTo(0.5)
    expect(sceneAt(p, 4).index).toBe(1) // boundary belongs to the next scene
  })

  it('clamps outside the timeline', () => {
    expect(sceneAt(p, -5)).toEqual({ index: 0, local: 0 })
    const end = sceneAt(p, 1000)
    expect(end.index).toBe(p.scenes.length - 1)
    expect(end.local).toBeCloseTo(1)
  })

  it('handles an empty project', () => {
    expect(sceneAt({ ...p, scenes: [] }, 1)).toEqual({ index: -1, local: 0 })
    expect(totalDuration({ ...p, scenes: [] })).toBe(0)
  })
})

describe('formatCount', () => {
  it('formats integers with separators', () => {
    expect(formatCount(12000, 1)).toBe('12,000')
    expect(formatCount(12000, 0.5)).toBe('6,000')
  })

  it('formats floats with one decimal', () => {
    expect(formatCount(4.9, 1)).toBe('4.9')
  })
})
