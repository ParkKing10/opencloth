import { describe, it, expect, beforeEach } from 'vitest'
import { loadDoc, saveDoc, loadLastGarment, saveLastGarment, type DesignDoc } from './designDoc'
import { makeTextLayer, makeImageLayer, makeGraphicLayer, patchObject } from './objectModel'
import { builtinGarments, isBuiltinGarmentId, builtinTemplateId } from '../../garments/builtinGarments'
import { getTemplate } from '../../garment-model/garmentTemplates'

// jsdom-free localStorage stub so the persistence layer is testable under the 'node' env.
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
  ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()
})

const doc = (over: Partial<DesignDoc> = {}): DesignDoc => ({
  layers: [makeTextLayer('Hi')],
  hidden: {},
  designName: 'My Design',
  updatedAt: 1,
  ...over,
})

describe('designDoc persistence', () => {
  it('round-trips a document per garment', () => {
    saveDoc('g1', doc({ designName: 'One' }))
    saveDoc('g2', doc({ designName: 'Two', layers: [] }))
    expect(loadDoc('g1')?.designName).toBe('One')
    expect(loadDoc('g1')?.layers).toHaveLength(1)
    expect(loadDoc('g2')?.designName).toBe('Two')
    expect(loadDoc('g2')?.layers).toHaveLength(0)
  })

  it('returns null for an unknown garment', () => {
    expect(loadDoc('missing')).toBeNull()
  })

  it('returns null (not throw) on corrupt data', () => {
    localStorage.setItem('threados-doc-bad', '{not json')
    expect(loadDoc('bad')).toBeNull()
  })

  it('preserves the hidden map', () => {
    saveDoc('g3', doc({ hidden: { 'l-1': true } }))
    expect(loadDoc('g3')?.hidden).toEqual({ 'l-1': true })
  })

  it('remembers the last-opened garment', () => {
    expect(loadLastGarment()).toBeNull()
    saveLastGarment('g9')
    expect(loadLastGarment()).toBe('g9')
  })

  it('round-trips user product specs (material/fit/weight/colors) per garment', () => {
    saveDoc(
      'gspec',
      doc({
        specs: {
          material: 'French Terry',
          fit: 'Oversized',
          weight: '450 GSM',
          composition: '80% Cotton / 20% Poly',
          variant: 'Zip Hoodie',
          colors: [{ name: 'Bone', hex: '#EDE7DA' }],
          notes: 'Garment-dye wash',
        },
      }),
    )
    const back = loadDoc('gspec')
    expect(back?.specs?.material).toBe('French Terry')
    expect(back?.specs?.fit).toBe('Oversized')
    expect(back?.specs?.weight).toBe('450 GSM')
    expect(back?.specs?.colors).toEqual([{ name: 'Bone', hex: '#EDE7DA' }])
  })

  it('a design with no specs loads with specs undefined (empty by default)', () => {
    saveDoc('gnospec', doc())
    expect(loadDoc('gnospec')?.specs).toBeUndefined()
  })

  it('round-trips M4 object styles (italic/underline) + image flip through the document', () => {
    const t = makeTextLayer('Hi')
    t.obj = { ...t.obj!, italic: true, underline: true, weight: 700 }
    const img = makeImageLayer('logo.png', 'data:image/png;base64,AAAA')
    img.obj = { ...img.obj!, flipH: true, flipV: true }
    saveDoc('gm4', doc({ layers: [t, img] }))
    const back = loadDoc('gm4')
    const rt = back?.layers.find((l) => l.type === 'Text')?.obj
    const ri = back?.layers.find((l) => l.type === 'Image')?.obj
    expect(rt?.italic).toBe(true)
    expect(rt?.underline).toBe(true)
    expect(rt?.weight).toBe(700)
    expect(ri?.flipH).toBe(true)
    expect(ri?.flipV).toBe(true)
  })

  it('round-trips manufacturing project info (brand/collection/SKU/…) through the document', () => {
    saveDoc(
      'ginfo',
      doc({
        projectInfo: {
          brand: 'Acme',
          designer: 'Sam',
          collection: 'FW26',
          styleNumber: 'TS-001',
          sku: 'TS-001-BLK-M',
          season: 'Fall/Winter 2026',
        },
      }),
    )
    const info = loadDoc('ginfo')?.projectInfo
    expect(info?.brand).toBe('Acme')
    expect(info?.collection).toBe('FW26')
    expect(info?.styleNumber).toBe('TS-001')
    expect(info?.sku).toBe('TS-001-BLK-M')
    expect(info?.season).toBe('Fall/Winter 2026')
  })

  it('a design with no project info loads with projectInfo undefined', () => {
    saveDoc('gnoinfo', doc())
    expect(loadDoc('gnoinfo')?.projectInfo).toBeUndefined()
  })

  it('preserves stacking order (layer array) through the document', () => {
    const a = makeTextLayer('A')
    const b = makeTextLayer('B')
    const c = makeTextLayer('C')
    saveDoc('gorder', doc({ layers: [a, b, c] }))
    expect(loadDoc('gorder')?.layers.map((l) => l.obj?.text)).toEqual(['A', 'B', 'C'])
  })
})

describe('object model', () => {
  it('creates a text layer with real, non-uppercase-forced defaults incl. alignment + line height', () => {
    const l = makeTextLayer('Hello')
    expect(l.type).toBe('Text')
    expect(l.obj?.type).toBe('text')
    expect(l.obj?.text).toBe('Hello')
    expect(l.obj?.align).toBe('center')
    expect(l.obj?.lineHeight).toBeGreaterThan(0)
  })

  it('creates an image layer from a data URL and strips the extension from the name', () => {
    const l = makeImageLayer('logo.png', 'data:image/png;base64,AAAA')
    expect(l.type).toBe('Image')
    expect(l.obj?.type).toBe('image')
    expect(l.obj?.src).toBe('data:image/png;base64,AAAA')
    expect(l.name).toBe('logo')
  })

  it('creates a graphic layer for a built-in mark', () => {
    const l = makeGraphicLayer('Star')
    expect(l.type).toBe('Graphic')
    expect(l.obj?.glyph).toBe('Star')
  })

  it('patchObject immutably updates only the target layer', () => {
    const a = makeTextLayer('A')
    const b = makeTextLayer('B')
    const next = patchObject([a, b], b.id, { rotation: 45 })
    expect(next[1].obj?.rotation).toBe(45)
    // originals untouched (immutability)
    expect(b.obj?.rotation).toBe(0)
    expect(next[0]).toBe(a) // unchanged layer keeps identity
  })
})

describe('studio catalog is editable-only', () => {
  // Contract: the Design Studio rail (DesignStudio.tsx `catalog`) is filtered to builtin ids so
  // every card resolves to a real region tree. This locks that a builtin id ALWAYS yields a
  // non-empty region tree (no dead click) and that the filter excludes traced/uploaded ids.
  it('every builtin catalog garment maps to a template with a non-empty region tree', () => {
    const rail = builtinGarments().filter((g) => isBuiltinGarmentId(g.id))
    expect(rail.length).toBeGreaterThanOrEqual(50)
    for (const g of rail) {
      const tpl = getTemplate(builtinTemplateId(g.id))
      expect(tpl, `no template for ${g.id}`).toBeTruthy()
      const made = tpl!.make()
      expect(Object.keys(made.regions).length, `${g.id} has no regions`).toBeGreaterThan(0)
      expect(made.rootIds.length, `${g.id} has no rootIds`).toBeGreaterThan(0)
      // Every rootId resolves to a real region — the layer tree (flattenRegions) walks these.
      for (const rid of made.rootIds) expect(made.regions[rid], `${g.id} rootId ${rid} missing`).toBeTruthy()
    }
  })

  it('the rail filter keeps only builtin ids (traced/uploaded excluded)', () => {
    const mixed = [{ id: 'traced-x' }, { id: 'builtin-tpl-tshirt' }, { id: 'up-y' }]
    const kept = mixed.filter((g) => isBuiltinGarmentId(g.id))
    expect(kept).toEqual([{ id: 'builtin-tpl-tshirt' }])
  })
})
