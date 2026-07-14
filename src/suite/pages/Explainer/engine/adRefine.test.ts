import { describe, expect, it } from 'vitest'
import { applyVibe, DEFAULT_STYLE, emphasisAt, localZoomAt, parseVibe, textHiddenAt, type LocalEdit } from './adRefine'

describe('parseVibe', () => {
  it('"more Apple" calms it down (less zoom, less accent)', () => {
    const m = parseVibe('make it more apple')!
    expect(m.zoom).toBeLessThan(1)
    expect(m.accentUse).toBeLessThan(1)
    const s = applyVibe(DEFAULT_STYLE, m)
    expect(s.zoom).toBeLessThan(DEFAULT_STYLE.zoom)
  })

  it('"faster" / "slower" move pace opposite ways', () => {
    expect(parseVibe('mach es schneller')!.pace).toBeGreaterThan(1)
    expect(parseVibe('slower please')!.pace).toBeLessThan(1)
  })

  it('"more zoom" / "less zoom"', () => {
    expect(parseVibe('mehr zoom')!.zoom).toBeGreaterThan(1)
    expect(parseVibe('less zoom')!.zoom).toBeLessThan(1)
  })

  it('parses music volume', () => {
    expect(parseVibe('musik auf 50%')!.musicVol).toBeCloseTo(0.5)
    expect(parseVibe('louder')!.musicVol).toBeGreaterThan(0.8)
  })

  it('returns null when nothing matches, and applyVibe clamps', () => {
    expect(parseVibe('add a giraffe doing taxes')).toBeNull()
    // Repeated "more zoom" cannot exceed the clamp.
    let s = DEFAULT_STYLE
    for (let i = 0; i < 20; i++) s = applyVibe(s, parseVibe('more zoom')!)
    expect(s.zoom).toBeLessThanOrEqual(2.2)
  })
})

describe('local edits', () => {
  const edits: LocalEdit[] = [
    { id: 'a', at: 3, kind: 'zoom' },
    { id: 'b', at: 6, kind: 'emphasis' },
    { id: 'c', at: 9, kind: 'noText' },
  ]
  it('adds zoom near a zoom/emphasis edit and nothing far away', () => {
    expect(localZoomAt(edits, 3)).toBeGreaterThan(0)
    expect(localZoomAt(edits, 6)).toBeGreaterThan(0)
    expect(localZoomAt(edits, 20)).toBe(0)
  })
  it('hides text near a noText edit only', () => {
    expect(textHiddenAt(edits, 9)).toBe(true)
    expect(textHiddenAt(edits, 3)).toBe(false)
  })
  it('emphasises near an emphasis edit only', () => {
    expect(emphasisAt(edits, 6)).toBe(true)
    expect(emphasisAt(edits, 3)).toBe(false)
  })
})
