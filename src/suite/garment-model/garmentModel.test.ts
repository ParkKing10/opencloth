import { describe, it, expect } from 'vitest'
import { makeReferenceBomber } from './referenceGarment'
import { isEditableGarment, defaultCapabilities } from './editableGarment'
import { styleForRole, TECH_FLAT } from './garmentStyle'
import {
  flattenRegions,
  getRegion,
  parentOf,
  toggleVisible,
  toggleLocked,
  moveRegion,
  rename,
  isEffectivelyVisible,
} from './regionTree'
import { generateGarment, loadReferenceGarment, GarmentGeneratorNotConnectedError } from './garmentGenerator'

describe('editable garment format', () => {
  it('the reference bomber is a well-formed editable garment (not an image)', () => {
    const g = makeReferenceBomber()
    expect(isEditableGarment(g)).toBe(true)
    expect(g.format).toBe('threados.editable-garment')
    expect(g.source).toEqual({ kind: 'reference' })
    expect(g.views.map((v) => v.id)).toEqual(['front', 'back'])
  })

  it('models a real hierarchy — cuffs nested under sleeves, pockets under a group', () => {
    const g = makeReferenceBomber()
    expect(getRegion(g, 'sleeve-l')?.children).toContain('cuff-l')
    expect(parentOf(g, 'cuff-l')).toBe('sleeve-l')
    expect(parentOf(g, 'pocket-l')).toBe('pockets')
    expect(parentOf(g, 'body')).toBeNull()
  })

  it('round-trips losslessly through JSON (structured vector data, not a PNG)', () => {
    const g = makeReferenceBomber()
    const back = JSON.parse(JSON.stringify(g))
    expect(isEditableGarment(back)).toBe(true)
    expect(Object.keys(back.regions)).toEqual(Object.keys(g.regions))
    expect(back.regions['zipper'].shapes).toEqual(g.regions['zipper'].shapes)
  })

  it('assigns future capabilities by material class (fabric printable, hardware not)', () => {
    expect(defaultCapabilities('body').printable).toBe(true)
    expect(defaultCapabilities('zipper').printable).toBe(false)
    expect(defaultCapabilities('button').materialAssignable).toBe(true)
    expect(defaultCapabilities('label').embroiderable).toBe(true)
  })

  it('leaves future appearance unset — the seam, not the feature', () => {
    const g = makeReferenceBomber()
    for (const r of Object.values(g.regions)) expect(r.appearance).toBeUndefined()
  })
})

describe('style contract (tech-flat)', () => {
  it('paints a white garment with black outlines by role', () => {
    expect(styleForRole('fill').fill).toBe(TECH_FLAT.fill)
    expect(styleForRole('fill').stroke).toBe(TECH_FLAT.outline)
    expect(styleForRole('outline').fill).toBe('none')
  })

  it('renders topstitching as a dashed line', () => {
    expect(styleForRole('stitch').dash).toBe(TECH_FLAT.stitchDash)
  })
})

describe('region tree operations (immutable)', () => {
  it('flattens depth-first with depth annotations', () => {
    const g = makeReferenceBomber()
    const flat = flattenRegions(g)
    const cuff = flat.find((f) => f.region.id === 'cuff-l')
    expect(cuff?.depth).toBe(1)
    expect(flat.find((f) => f.region.id === 'sleeve-l')?.depth).toBe(0)
  })

  it('toggleVisible / toggleLocked return a new garment and do not mutate the input', () => {
    const g = makeReferenceBomber()
    const v = toggleVisible(g, 'zipper')
    expect(v).not.toBe(g)
    expect(g.regions['zipper'].visible).toBe(true) // original untouched
    expect(v.regions['zipper'].visible).toBe(false)
    const l = toggleLocked(g, 'body')
    expect(l.regions['body'].locked).toBe(true)
    expect(g.regions['body'].locked).toBe(false)
  })

  it('a hidden parent hides its children (effective visibility)', () => {
    const g = toggleVisible(makeReferenceBomber(), 'sleeve-l') // hide sleeve
    expect(isEffectivelyVisible(g, 'cuff-l')).toBe(false)
    expect(isEffectivelyVisible(g, 'cuff-r')).toBe(true)
  })

  it('moveRegion reorders within siblings only, and is a no-op at the ends', () => {
    const g = makeReferenceBomber()
    const idx = (x: typeof g) => x.rootIds.indexOf('body')
    const down = moveRegion(g, 'body', 1)
    expect(idx(down)).toBe(1)
    expect(down.rootIds).toHaveLength(g.rootIds.length)
    expect(moveRegion(g, 'body', -1)).toBe(g) // already first → unchanged reference
    // child reorder stays within the parent
    const moved = moveRegion(g, 'cuff-l', 1)
    expect(moved.regions['sleeve-l'].children).toEqual(['cuff-l']) // only child → no move
  })

  it('rename trims and ignores empty', () => {
    const g = makeReferenceBomber()
    expect(rename(g, 'body', '  Shell  ').regions['body'].name).toBe('Shell')
    expect(rename(g, 'body', '   ')).toBe(g)
  })
})

describe('AI generator seam (honest, not connected)', () => {
  it('generateGarment throws NotConnected — no model, no fake garment', async () => {
    await expect(generateGarment({ prompt: 'oversized bomber' })).rejects.toBeInstanceOf(GarmentGeneratorNotConnectedError)
  })

  it('loadReferenceGarment returns the real hand-authored specimen', () => {
    expect(loadReferenceGarment().id).toBe('reference-bomber')
  })
})
