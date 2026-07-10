import { describe, it, expect, beforeEach } from 'vitest'
import { readSvg } from './svgReader'
import { classifyGraph } from './classify'
import { mapClassifiedToEditable } from './smartGarmentMapping'
import { analyzeGarment } from './analyzeGarment'
import { pathBounds, isClosedPath, pointInPolygon } from './pathGeometry'
import { applyMatrixToPath, parseTransform } from './svgTransform'
import { flattenRegions } from '../regionTree'
import { isEditableGarment } from '../editableGarment'
import { TECH_FLAT_TEE_SVG } from './__fixtures__/techFlatTee'

// jsdom-free storage + crypto shims (node env) so the createGarment round-trip works.
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
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null
  }
  get length(): number {
    return this.m.size
  }
}
beforeEach(() => {
  ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()
})

describe('pathGeometry', () => {
  it('pathBounds covers a closed polygon', () => {
    const b = pathBounds('M 10 20 L 40 20 L 40 60 L 10 60 Z')
    expect(b).toEqual({ minX: 10, minY: 20, w: 30, h: 40 })
  })
  it('handles relative + H/V + curves without throwing', () => {
    const b = pathBounds('m 0 0 h 100 v 50 c 0 10 -10 10 -20 0 z')
    expect(b.w).toBeGreaterThan(0)
    expect(b.h).toBeGreaterThan(0)
  })
  it('isClosedPath detects Z', () => {
    expect(isClosedPath('M0 0 L1 1 Z')).toBe(true)
    expect(isClosedPath('M0 0 L1 1')).toBe(false)
  })
  it('pointInPolygon is correct', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    expect(pointInPolygon({ x: 5, y: 5 }, sq)).toBe(true)
    expect(pointInPolygon({ x: 15, y: 5 }, sq)).toBe(false)
  })
})

describe('svgTransform', () => {
  it('translate matrix bakes into the path', () => {
    const m = parseTransform('translate(10 20)')
    const out = applyMatrixToPath('M 0 0 L 5 5', m)
    expect(pathBounds(out)).toEqual({ minX: 10, minY: 20, w: 5, h: 5 })
  })
  it('scale matrix scales coordinates', () => {
    const m = parseTransform('scale(2)')
    expect(pathBounds(applyMatrixToPath('M 1 1 L 2 3', m))).toEqual({ minX: 2, minY: 2, w: 2, h: 4 })
  })
})

describe('svgReader', () => {
  const g = readSvg(TECH_FLAT_TEE_SVG)
  it('reads the artboard viewBox as bounds', () => {
    expect(g.bounds).toEqual({ minX: 0, minY: 0, w: 400, h: 560 })
  })
  it('extracts every drawn primitive (2 sleeves + body + collar + 4 buttons + 1 seam = 9)', () => {
    expect(g.paths.length).toBe(9)
  })
  it('converts circles to closed paths and keeps their fill', () => {
    const buttons = g.paths.filter((p) => p.closed && p.bounds.w < 20 && p.fill === '#1a1a20')
    expect(buttons.length).toBe(4)
  })
  it('marks the dashed line open + dashed', () => {
    const seam = g.paths.find((p) => !p.closed)
    expect(seam?.dashed).toBe(true)
  })
})

describe('classifyGraph', () => {
  const cg = classifyGraph(readSvg(TECH_FLAT_TEE_SVG))
  const byType = (t: string) => cg.regions.filter((r) => r.type === t)

  it('finds exactly one body, high confidence', () => {
    const body = byType('body')
    expect(body.length).toBe(1)
    expect(body[0].confidence).toBeGreaterThan(0.9)
  })
  it('finds a left + right sleeve, matched as a mirror pair', () => {
    const sleeves = byType('sleeve')
    expect(sleeves.length).toBe(2)
    const sides = sleeves.map((s) => s.side).sort()
    expect(sides).toEqual(['left', 'right'])
    expect(sleeves[0].mirrorIndex).toBeDefined()
    expect(sleeves.every((s) => s.confidence > 0.85)).toBe(true)
  })
  it('finds the collar at the top centre', () => {
    expect(byType('collar').length).toBe(1)
  })
  it('finds all four buttons with high confidence', () => {
    const buttons = byType('button')
    expect(buttons.length).toBe(4)
    expect(buttons.every((b) => b.confidence > 0.9)).toBe(true)
  })
  it('classifies the dashed line as stitching', () => {
    expect(byType('stitch').length).toBe(1)
  })
})

describe('smartGarmentMapping', () => {
  const cg = classifyGraph(readSvg(TECH_FLAT_TEE_SVG))
  const { garment, report } = mapClassifiedToEditable(cg, 'Test Tee', 'Tops')

  it('produces a valid EditableGarment', () => {
    expect(isEditableGarment(garment)).toBe(true)
    expect(garment.views[0].viewBox).toEqual({ w: 400, h: 560 })
  })
  it('flattenRegions returns every part', () => {
    const flat = flattenRegions(garment)
    expect(flat.length).toBe(9)
  })
  it('body + both sleeves are top-level; buttons nest inside the body', () => {
    const roots = garment.rootIds.map((id) => garment.regions[id].type)
    expect(roots).toContain('body')
    expect(roots.filter((t) => t === 'sleeve').length).toBe(2)
    // buttons sit inside the body, so they are never top-level
    expect(roots).not.toContain('button')
    const body = Object.values(garment.regions).find((r) => r.type === 'body')!
    expect(body.children.map((id) => garment.regions[id].type)).toContain('button')
  })
  it('pairs the sleeves via mirrorOf', () => {
    const sleeves = Object.values(garment.regions).filter((r) => r.type === 'sleeve')
    expect(sleeves[0].mirrorOf).toBeDefined()
    expect(garment.regions[sleeves[0].mirrorOf!].type).toBe('sleeve')
  })
  it('reports real numbers', () => {
    expect(report.regionCount).toBe(9)
    expect(report.types.button).toBe(4)
  })
})

describe('analyzeGarment (end to end)', () => {
  it('turns SVG text into a normalized garment with front + back views', async () => {
    const { garment } = await analyzeGarment({ text: TECH_FLAT_TEE_SVG, filename: 'basic-tee.svg' })
    expect(isEditableGarment(garment)).toBe(true)
    expect(garment.views.map((v) => v.id).sort()).toEqual(['back', 'front'])
    expect(garment.name).toBe('Basic Tee')
  })
  it('degrades to a template (never throws) on unreadable input', async () => {
    const { garment, report } = await analyzeGarment({ text: '<svg></svg>', filename: 'empty.svg' })
    expect(isEditableGarment(garment)).toBe(true)
    expect(report.regionCount).toBe(0)
  })
})
