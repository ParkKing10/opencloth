import { describe, expect, it } from 'vitest'
import { isUsableRect, placeCard, type Box } from './geometry'

const box = (left: number, top: number, width: number, height: number): Box => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
})

const VW = 1280
const VH = 800

describe('isUsableRect', () => {
  it('accepts a normal on-screen rect', () => {
    expect(isUsableRect(box(100, 100, 200, 40), VW, VH)).toBe(true)
  })
  it('rejects a zero-size rect (hidden element)', () => {
    expect(isUsableRect(box(100, 100, 0, 0), VW, VH)).toBe(false)
  })
  it('rejects a rect fully off-screen (drawer mid-transition)', () => {
    expect(isUsableRect(box(-300, 100, 260, 40), VW, VH)).toBe(false)
    expect(isUsableRect(box(VW + 10, 100, 260, 40), VW, VH)).toBe(false)
  })
})

describe('placeCard', () => {
  const CW = 340
  const CH = 220

  it('centres when there is no target', () => {
    const p = placeCard(null, CW, CH, VW, VH)
    expect(p.left).toBeCloseTo((VW - CW) / 2)
    expect(p.top).toBeCloseTo((VH - CH) / 2)
  })

  it('prefers the right side of a sidebar item', () => {
    const t = box(0, 300, 260, 40) // sidebar nav item at the left edge
    const p = placeCard(t, CW, CH, VW, VH)
    expect(p.left).toBe(t.right + 16)
    // vertically centred on the target
    expect(p.top).toBeCloseTo(300 + 20 - CH / 2)
  })

  it('falls below when the target spans the full width', () => {
    const t = box(10, 10, VW - 20, 60) // topbar-like strip
    const p = placeCard(t, CW, CH, VW, VH)
    expect(p.top).toBe(t.bottom + 16)
    expect(p.left).toBeGreaterThanOrEqual(10)
    expect(p.left + CW).toBeLessThanOrEqual(VW - 10)
  })

  it('goes above when the target hugs the bottom', () => {
    const t = box(10, VH - 70, VW - 20, 60)
    const p = placeCard(t, CW, CH, VW, VH)
    expect(p.top).toBe(t.top - 16 - CH)
  })

  it('centres when the target covers nearly everything', () => {
    const t = box(5, 5, VW - 10, VH - 10)
    const p = placeCard(t, CW, CH, VW, VH)
    expect(p.left).toBeCloseTo((VW - CW) / 2)
    expect(p.top).toBeCloseTo((VH - CH) / 2)
  })

  it('never leaves the viewport, even for edge targets', () => {
    const t = box(0, 0, 40, 40)
    const p = placeCard(t, CW, CH, VW, VH)
    expect(p.left).toBeGreaterThanOrEqual(0)
    expect(p.top).toBeGreaterThanOrEqual(0)
    expect(p.left + CW).toBeLessThanOrEqual(VW)
    expect(p.top + CH).toBeLessThanOrEqual(VH)
  })
})
