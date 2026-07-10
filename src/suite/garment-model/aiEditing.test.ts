import { describe, it, expect } from 'vitest'
import { makeReferenceBomber } from './referenceGarment'
import { editGarment } from './aiGarmentEditor'
import { diffGarments } from './garmentDiff'
import { scalePath, translatePath } from './pathTransform'
import { removeRegions } from './regionEdit'
import {
  initHistory,
  commit,
  undo,
  redo,
  restore,
  canUndo,
  canRedo,
  currentGarment,
  revisionLabel,
} from './garmentRevision'

/** Every region that is NOT in `changed` must be byte-identical before and after. */
function untouchedRegionsIdentical(before: ReturnType<typeof makeReferenceBomber>, after: typeof before, changed: Set<string>) {
  for (const id of Object.keys(before.regions)) {
    if (changed.has(id) || !after.regions[id]) continue
    expect(after.regions[id]).toEqual(before.regions[id])
  }
}

describe('pathTransform', () => {
  it('scales coordinates about a pivot', () => {
    expect(scalePath('M100,100 L200,100', 2, 1, { x: 100, y: 100 })).toBe('M100,100 L300,100')
  })
  it('translates coordinates', () => {
    expect(translatePath('M10,10 L20,20', 5, -5)).toBe('M15,5 L25,15')
  })
  it('refuses arc paths (returns null) rather than corrupting them', () => {
    expect(scalePath('M172,150 a5,5 0 1,0 10,0', 2, 2, { x: 0, y: 0 })).toBeNull()
  })
  it('refuses zero-coordinate and incomplete commands rather than emitting a malformed path', () => {
    expect(scalePath('M', 2, 2, { x: 0, y: 0 })).toBeNull()
    expect(scalePath('M100,100 L', 2, 2, { x: 0, y: 0 })).toBeNull()
    expect(scalePath('M100,100 L200', 2, 2, { x: 0, y: 0 })).toBeNull() // odd count
  })
})

describe('regionEdit.removeRegions', () => {
  it('removes a region and preserves the order of the rest', () => {
    const g = makeReferenceBomber()
    const { garment, removed } = removeRegions(g, new Set(['zipper']))
    expect(removed).toEqual(['zipper'])
    expect(garment.regions['zipper']).toBeUndefined()
    expect(garment.rootIds).toEqual(g.rootIds.filter((id) => id !== 'zipper'))
  })
  it('cascades: removing both pockets drops the now-empty Pockets group', () => {
    const g = makeReferenceBomber()
    const { garment, removed } = removeRegions(g, new Set(['pocket-l', 'pocket-r']))
    expect(removed.sort()).toEqual(['pocket-l', 'pocket-r', 'pockets'])
    expect(garment.regions['pockets']).toBeUndefined()
  })
})

describe('AI garment editor — edits ONLY the required regions', () => {
  it('“remove the buttons” removes only the button region; everything else identical', () => {
    const g = makeReferenceBomber()
    const res = editGarment(g, 'remove the buttons')
    expect(res.understood).toBe(true)
    const diff = diffGarments(g, res.garment)
    expect(diff.removed).toEqual(['snaps'])
    expect(diff.added).toEqual([])
    expect(diff.modified).toEqual([])
    untouchedRegionsIdentical(g, res.garment, new Set(['snaps']))
    expect(g.regions['snaps']).toBeDefined() // original never mutated
  })

  it('“make the sleeves wider” modifies only sleeve + cuff regions', () => {
    const g = makeReferenceBomber()
    const res = editGarment(g, 'make the sleeves wider')
    const diff = diffGarments(g, res.garment)
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
    expect(new Set(diff.modified)).toEqual(new Set(['sleeve-l', 'sleeve-r', 'cuff-l', 'cuff-r']))
    untouchedRegionsIdentical(g, res.garment, new Set(diff.modified))
    expect(res.garment.rootIds).toEqual(g.rootIds) // layer order preserved
  })

  it('“add 6 buttons” reuses the existing button region id (preserve IDs)', () => {
    const g = makeReferenceBomber()
    const res = editGarment(g, 'add 6 buttons')
    expect(res.changedRegionIds).toEqual(['snaps'])
    expect(res.garment.regions['snaps'].shapes.filter((s) => s.view === 'front')).toHaveLength(6)
    expect(res.garment.rootIds).toEqual(g.rootIds)
  })

  it('“make it distressed” adds a distress region and keeps every original region', () => {
    const g = makeReferenceBomber()
    const res = editGarment(g, 'make it slightly distressed')
    const diff = diffGarments(g, res.garment)
    expect(diff.added).toEqual(['ai-distress'])
    expect(diff.removed).toEqual([])
    expect(diff.modified).toEqual([]) // nothing else touched
    untouchedRegionsIdentical(g, res.garment, new Set(['ai-distress']))
    expect(res.garment.rootIds.slice(0, -1)).toEqual(g.rootIds) // appended at the end
  })

  it('“make it cropped” reshapes fabric but leaves arc-based buttons untouched', () => {
    const g = makeReferenceBomber()
    const res = editGarment(g, 'make it cropped')
    const diff = diffGarments(g, res.garment)
    expect(diff.modified).not.toContain('snaps') // arc path can't scale → left alone, honestly
    expect(diff.modified.length).toBeGreaterThan(3)
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
  })

  it('is honest about unknown prompts — unchanged garment, understood=false', () => {
    const g = makeReferenceBomber()
    const res = editGarment(g, 'convert into a varsity jacket')
    expect(res.understood).toBe(false)
    expect(res.garment).toBe(g) // untouched, same reference
    expect(res.changedRegionIds).toEqual([])
  })

  it('never returns anything but an editable garment (no PNG/JPG)', () => {
    const g = makeReferenceBomber()
    for (const prompt of ['remove the zipper', 'add 3 buttons', 'oversized fit', 'nonsense xyz']) {
      const res = editGarment(g, prompt)
      expect(res.garment.format).toBe('threados.editable-garment')
    }
  })
})

describe('garment revision history — manual + AI share one timeline', () => {
  it('appends revisions; original snapshot is preserved', () => {
    const g = makeReferenceBomber()
    let h = initHistory(g)
    expect(h.revisions).toHaveLength(1)
    h = commit(h, editGarment(g, 'remove the buttons').garment, { kind: 'ai', prompt: 'remove the buttons', changedRegionIds: ['snaps'], summary: [], understood: true })
    expect(h.revisions).toHaveLength(2)
    expect(currentGarment(h).regions['snaps']).toBeUndefined()
    // original revision still intact
    expect(h.revisions[0].garment.regions['snaps']).toBeDefined()
  })

  it('undo/redo walk the timeline without destroying revisions', () => {
    const g = makeReferenceBomber()
    let h = initHistory(g)
    h = commit(h, editGarment(g, 'add 8 buttons').garment, { kind: 'manual', label: 'test' })
    expect(canUndo(h)).toBe(true)
    expect(canRedo(h)).toBe(false)
    h = undo(h)
    expect(h.currentIndex).toBe(0)
    expect(canRedo(h)).toBe(true)
    expect(h.revisions).toHaveLength(2) // nothing dropped
    h = redo(h)
    expect(h.currentIndex).toBe(1)
  })

  it('a new edit after undo appends (append-only) — old revisions stay available', () => {
    const g = makeReferenceBomber()
    let h = initHistory(g)
    h = commit(h, editGarment(g, 'remove the zipper').garment, { kind: 'ai', prompt: 'remove the zipper', changedRegionIds: [], summary: [], understood: true })
    h = undo(h) // back to original
    h = commit(h, editGarment(g, 'remove the buttons').garment, { kind: 'ai', prompt: 'remove the buttons', changedRegionIds: [], summary: [], understood: true })
    expect(h.revisions).toHaveLength(3) // the undone revision is NOT truncated
    expect(revisionLabel(h.revisions[1])).toBe('remove the zipper')
    expect(revisionLabel(h.revisions[2])).toBe('remove the buttons')
  })

  it('restore jumps to any version', () => {
    const g = makeReferenceBomber()
    let h = initHistory(g)
    h = commit(h, editGarment(g, 'make it distressed').garment, { kind: 'ai', prompt: 'make it distressed', changedRegionIds: [], summary: [], understood: true })
    h = restore(h, 0)
    expect(currentGarment(h).regions['ai-distress']).toBeUndefined()
    h = restore(h, 1)
    expect(currentGarment(h).regions['ai-distress']).toBeDefined()
  })

  it('AI edits never destroy a manual edit (same history)', () => {
    const g = makeReferenceBomber()
    let h = initHistory(g)
    // manual: rename body → committed
    const manual = { ...g, regions: { ...g.regions, body: { ...g.regions.body, name: 'Shell' } } }
    h = commit(h, manual, { kind: 'manual', label: 'Renamed Body → Shell' })
    // AI edit on top
    h = commit(h, editGarment(currentGarment(h), 'remove the buttons').garment, { kind: 'ai', prompt: 'remove the buttons', changedRegionIds: ['snaps'], summary: [], understood: true })
    // the manual rename survives in the AI result
    expect(currentGarment(h).regions['body'].name).toBe('Shell')
    // and is restorable
    h = restore(h, 1)
    expect(currentGarment(h).regions['body'].name).toBe('Shell')
    expect(currentGarment(h).regions['snaps']).toBeDefined()
  })
})
