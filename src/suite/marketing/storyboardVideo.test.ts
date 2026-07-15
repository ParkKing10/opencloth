import { describe, expect, it } from 'vitest'
import { kenBurns, sceneAt, storyboardDuration, wrapLines, SCENE_SECONDS } from './storyboardVideo'

describe('storyboardDuration / sceneAt', () => {
  it('duration = scenes × seconds-per-scene', () => {
    expect(storyboardDuration(4)).toBe(4 * SCENE_SECONDS)
    expect(storyboardDuration(0)).toBe(SCENE_SECONDS) // never zero-length
  })

  it('maps output time to the right beat and local progress', () => {
    expect(sceneAt(0, 4)).toEqual({ index: 0, local: 0 })
    const mid = sceneAt(SCENE_SECONDS * 1.5, 4)
    expect(mid.index).toBe(1)
    expect(mid.local).toBeCloseTo(0.5)
  })

  it('clamps past the end instead of overflowing', () => {
    const end = sceneAt(SCENE_SECONDS * 99, 4)
    expect(end.index).toBe(3)
    expect(end.local).toBe(1)
  })
})

describe('kenBurns', () => {
  it('even beats zoom in, odd beats zoom out', () => {
    expect(kenBurns(1, 0).zoom).toBeGreaterThan(kenBurns(0, 0).zoom)
    expect(kenBurns(1, 1).zoom).toBeLessThan(kenBurns(0, 1).zoom)
  })

  it('zoom always stays above 1 (no letterboxing gaps)', () => {
    for (const i of [0, 1, 2, 3]) {
      for (const l of [0, 0.5, 1]) {
        expect(kenBurns(l, i).zoom).toBeGreaterThan(1)
      }
    }
  })
})

describe('wrapLines', () => {
  const measure = (s: string) => s.length * 10 // 10px per char fake

  it('wraps at the width limit without splitting words', () => {
    const lines = wrapLines('der Fit spricht für sich', 100, measure)
    expect(lines.every((l) => measure(l) <= 100 || !l.includes(' '))).toBe(true)
    expect(lines.join(' ')).toBe('der Fit spricht für sich')
  })

  it('single short caption stays one line', () => {
    expect(wrapLines('schau genauer hin.', 1000, measure)).toEqual(['schau genauer hin.'])
  })

  it('empty caption produces no lines', () => {
    expect(wrapLines('   ', 100, measure)).toEqual([])
  })
})
