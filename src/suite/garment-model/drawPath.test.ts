import { describe, it, expect } from 'vitest'
import { ellipsePath, curvePath, linePath, type Pt } from './drawPath'

describe('ellipsePath', () => {
  it('draws two arcs inscribed in the drag box', () => {
    const d = ellipsePath({ x: 0, y: 0 }, { x: 100, y: 60 })
    // Centre (50,30), radii (50,30) → starts at the left vertex, two sweeping arcs, closed.
    expect(d).toBe('M0,30 A50,30 0 1 0 100,30 A50,30 0 1 0 0,30 Z')
  })

  it('is empty for a degenerate (zero-size) box so we never commit an invisible shape', () => {
    expect(ellipsePath({ x: 40, y: 40 }, { x: 40, y: 40 })).toBe('')
  })
})

describe('curvePath', () => {
  it('falls back to a straight line with fewer than three points', () => {
    const a: Pt = { x: 0, y: 0 }
    const b: Pt = { x: 20, y: 10 }
    expect(curvePath([a, b])).toBe(linePath(a, b))
  })

  it('a straight drag stays (near) straight — control sits on the line', () => {
    // Evenly spaced collinear samples → control point lands on the A–B line.
    const d = curvePath([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
    ])
    expect(d).toBe('M0,0 Q50,0 100,0')
  })

  it('a bowed drag keeps the bulge (control pushed past the sampled midpoint)', () => {
    // Mid sample lifted to y=20 → control lifts to y=40 (2·20 − ½·(0+0)), a real bump.
    const d = curvePath([
      { x: 0, y: 0 },
      { x: 50, y: 20 },
      { x: 100, y: 0 },
    ])
    expect(d).toBe('M0,0 Q50,40 100,0')
  })
})
