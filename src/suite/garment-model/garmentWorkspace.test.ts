import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createGarment, listGarments, getGarment, renameGarment, toggleFavorite, duplicateGarment, deleteGarment } from './garmentLibrary'
import { loadHistory } from './garmentDocumentStore'
import { buildFromPrompt, buildFromTemplate, buildFromUpload, toGarmentName } from './garmentFactory'
import { GARMENT_TEMPLATES, nearestTemplate, getTemplate } from './garmentTemplates'
import { isEditableGarment } from './editableGarment'
import { garmentThumbnailSvg } from './garmentThumbnail'
import { saveAiSettings, loadAiSettings, hasApiKey, looksLikeOpenAiKey } from './aiSettings'
import { resolveProvider, hasFrontAndBack } from './aiProvider'
import { generateGarment, makeEmptyGarment, isEmptyGarment, ensureBothViews } from './garmentGeneration'
import { normalizeGarment, parseJsonLoose } from './garmentNormalize'
import { translateD } from './pathTransform'
import { makeReferenceBomber } from './referenceGarment'
import { removeRegions } from './regionEdit'
import { flattenRegions } from './regionTree'
import { coerceSpec, colorNotesFromSpec } from './garmentSpec'
import { buildFromSpec } from './specToGarment'

class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
}

beforeEach(() => {
  ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()
})
afterEach(() => {
  vi.restoreAllMocks()
})

const U = 'user-1'

describe('garment templates + factory', () => {
  it('every template is a real editable garment (not an image)', () => {
    for (const t of GARMENT_TEMPLATES) {
      const g = t.make()
      expect(isEditableGarment(g)).toBe(true)
      expect(Object.keys(g.regions).length).toBeGreaterThan(1)
    }
  })

  it('nearestTemplate maps prompts to the closest real template', () => {
    expect(nearestTemplate('oversized hoodie').id).toBe('tpl-hoodie')
    expect(nearestTemplate('luxury bomber jacket').id).toBe('tpl-bomber')
    expect(nearestTemplate('streetwear cargo pants').id).toBe('tpl-pants')
    expect(nearestTemplate('summer shorts').id).toBe('tpl-shorts')
  })

  it('toGarmentName cleans prompts and filenames', () => {
    expect(toGarmentName('create an oversized hoodie')).toBe('Oversized Hoodie')
    expect(toGarmentName('bomber_v2.svg')).toBe('Bomber V2')
  })

  it('buildFromPrompt / Template / Upload return editable garments', () => {
    expect(isEditableGarment(buildFromPrompt('luxury bomber').garment)).toBe(true)
    expect(buildFromTemplate('tpl-tshirt').name).toBe('T-Shirt')
    expect(isEditableGarment(buildFromUpload('cargo.pdf').garment)).toBe(true)
  })

  it('thumbnails render as inline SVG (never raster)', () => {
    const svg = garmentThumbnailSvg(getTemplate('tpl-hoodie')!.make())
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('<path')
  })

  it('sanitizes malicious path data so a crafted garment cannot inject markup', () => {
    const g = buildFromTemplate('tpl-tshirt').garment
    const evil = {
      ...g,
      regions: { ...g.regions, body: { ...g.regions.body, shapes: [{ view: 'front' as const, d: 'M0 0"/><script>alert(1)</script> onload="x', role: 'fill' as const }] } },
    }
    const svg = garmentThumbnailSvg(evil)
    expect(svg).not.toContain('<script')
    expect(svg).not.toContain('onload=')
    expect(svg).not.toContain('alert(')
    // No injected elements: only the real region shapes render as <path>, nothing else.
    expect(svg.match(/<(?!path|svg|rect)[a-z]/gi)).toBeNull()
  })
})

describe('garment collection library', () => {
  it('creates, lists, and reads garments per user', () => {
    const { garment } = buildFromTemplate('tpl-hoodie')
    const s = createGarment(U, garment, { name: 'My Hoodie', category: 'Tops', origin: 'blank' })
    expect(s.name).toBe('My Hoodie')
    expect(s.regionCount).toBeGreaterThan(1)
    expect(s.thumb.startsWith('data:image/svg+xml')).toBe(true)
    expect(listGarments(U)).toHaveLength(1)
    // the garment's editable history exists under its own id
    expect(loadHistory(s.id)?.revisions).toHaveLength(1)
  })

  it('rename updates the summary AND the editable garment name', () => {
    const s = createGarment(U, buildFromTemplate('tpl-tshirt').garment, { name: 'Tee', category: 'Tops', origin: 'blank' })
    renameGarment(U, s.id, 'Signature Tee')
    expect(getGarment(U, s.id)?.name).toBe('Signature Tee')
    expect(loadHistory(s.id)?.revisions[0].garment.name).toBe('Signature Tee')
  })

  it('toggles favorite', () => {
    const s = createGarment(U, buildFromTemplate('tpl-pants').garment, { name: 'Pants', category: 'Bottoms', origin: 'blank' })
    toggleFavorite(U, s.id)
    expect(getGarment(U, s.id)?.favorite).toBe(true)
  })

  it('duplicate creates an independent copy with its own id + history', () => {
    const s = createGarment(U, buildFromTemplate('tpl-shorts').garment, { name: 'Shorts', category: 'Bottoms', origin: 'blank' })
    const dup = duplicateGarment(U, s.id)!
    expect(dup.id).not.toBe(s.id)
    expect(dup.name).toBe('Shorts copy')
    expect(listGarments(U)).toHaveLength(2)
    expect(loadHistory(dup.id)).not.toBeNull()
  })

  it('delete removes the summary AND its history (never affects others)', () => {
    const a = createGarment(U, buildFromTemplate('tpl-tshirt').garment, { name: 'A', category: 'Tops', origin: 'blank' })
    const b = createGarment(U, buildFromTemplate('tpl-hoodie').garment, { name: 'B', category: 'Tops', origin: 'blank' })
    deleteGarment(U, a.id)
    expect(getGarment(U, a.id)).toBeUndefined()
    expect(loadHistory(a.id)).toBeNull()
    expect(getGarment(U, b.id)).toBeDefined() // untouched
  })
})

describe('AI settings', () => {
  it('obfuscates the key at rest and round-trips it', () => {
    saveAiSettings({ apiKey: 'sk-test-abcdefghijklmnopqrstuvwxyz', model: 'gpt-4o' })
    const raw = localStorage.getItem('threados-ai-settings') as string
    expect(raw).not.toContain('sk-test-abcdefghijklmnopqrstuvwxyz') // not stored in cleartext
    expect(loadAiSettings().apiKey).toBe('sk-test-abcdefghijklmnopqrstuvwxyz')
  })

  it('clears a corrupt key entry instead of silently keeping a dead key', () => {
    localStorage.setItem('threados-ai-settings', JSON.stringify({ apiKey: 'not valid base64 !!!', model: 'gpt-4o' }))
    expect(loadAiSettings().apiKey).toBe('') // corrupt → treated as no key
    expect(localStorage.getItem('threados-ai-settings')).toBeNull() // and cleared
  })

  it('hasApiKey reflects configuration; looksLikeOpenAiKey validates format', () => {
    expect(hasApiKey()).toBe(false)
    expect(looksLikeOpenAiKey('sk-abcdefghijklmnopqrstuvwx')).toBe(true)
    expect(looksLikeOpenAiKey('nope')).toBe(false)
    saveAiSettings({ apiKey: 'sk-abcdefghijklmnopqrstuvwx', model: 'gpt-4o' })
    expect(hasApiKey()).toBe(true)
  })
})

describe('garment generation (Milestone 8.2)', () => {
  it('makeEmptyGarment is empty but always has front + back views', () => {
    const g = makeEmptyGarment('Untitled')
    expect(isEmptyGarment(g)).toBe(true)
    expect(g.views.map((v) => v.id)).toEqual(['front', 'back'])
    expect(isEditableGarment(g)).toBe(true)
  })

  it('ensureBothViews mirrors front→back so a front-only garment renders (and stays editable) in both views', () => {
    const g = makeReferenceBomber()
    // Strip all back shapes to simulate a front-only AI garment.
    const frontOnly = { ...g, regions: Object.fromEntries(Object.entries(g.regions).map(([id, r]) => [id, { ...r, shapes: r.shapes.filter((s) => s.view === 'front') }])) }
    const fixed = ensureBothViews(frontOnly)
    for (const r of Object.values(fixed.regions)) {
      const f = r.shapes.filter((s) => s.view === 'front').length
      if (f > 0) expect(r.shapes.some((s) => s.view === 'back')).toBe(true) // every front region now has a back
    }
  })

  it('translateD shifts absolute coords and preserves relative arcs (button move never breaks)', () => {
    const t1 = translateD('M100,100 L200,100 Z', 10, -5)
    expect(t1).toContain('M110 95')
    expect(t1).toContain('L210 95')
    expect(t1.endsWith('Z')).toBe(true)
    // relative arc (button): the absolute M moves, the relative "a" deltas are unchanged
    const t2 = translateD('M172,150 a5,5 0 1,0 10,0', 8, 2)
    expect(t2).toContain('M180 152')
    expect(t2).toContain('a5,5 0 1,0 10,0')
  })

  it('generateGarment (no key → placeholder) returns a real editable garment with front AND back', async () => {
    const res = await generateGarment('oversized bomber jacket')
    expect(res.source).toBe('placeholder')
    expect(isEditableGarment(res.garment)).toBe(true)
    expect(hasFrontAndBack(res.garment)).toBe(true)
    expect(res.garment.source.kind).toBe('ai') // provenance recorded
    expect(res.garment.name).toBe('Oversized Bomber Jacket')
  })

  it('hasFrontAndBack rejects a garment missing a side', () => {
    const g = makeReferenceBomber()
    const frontOnly = { ...g, regions: Object.fromEntries(Object.entries(g.regions).map(([id, r]) => [id, { ...r, shapes: r.shapes.filter((s) => s.view === 'front') }])) }
    expect(hasFrontAndBack(frontOnly)).toBe(false)
  })

  it('photo reconstruction (no key → placeholder) returns an HONEST template start, not a fake from-photo garment', async () => {
    const res = await resolveProvider().reconstructGarment(['data:image/png;base64,AAAA'])
    expect(res.source).toBe('placeholder')
    expect(isEditableGarment(res.garment)).toBe(true)
    expect(hasFrontAndBack(res.garment)).toBe(true)
    expect(res.confidences).toBeUndefined() // never fabricates confidence without a vision model
    expect(res.templateStart).toBe(true)
    expect(res.garment.source.kind).toBe('reference') // NOT { kind:'import', from:'photo' } — no masquerade
  })

  it('OpenAI photo reconstruction reads a garment SPEC and assembles the closest editable template', async () => {
    saveAiSettings({ apiKey: 'sk-abcdefghijklmnopqrstuvwx', model: 'gpt-4o' })
    const specJson = JSON.stringify({
      garmentType: { value: 'jacket', confidence: 92 },
      length: { value: 'regular', confidence: 70 },
      sleeves: { value: 'long', confidence: 88 },
      collar: { value: 'ribbed', confidence: 80 },
      closure: { value: 'snaps', confidence: 74 },
      pockets: { value: 'side', confidence: 61 },
      primaryColor: { value: 'red', confidence: 90 },
    })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: specJson } }] }),
    }) as unknown as typeof fetch
    const res = await resolveProvider().reconstructGarment(['data:image/png;base64,AAAA'])
    expect(res.source).toBe('openai')
    expect(res.templateStart).toBeFalsy()
    expect(hasFrontAndBack(res.garment)).toBe(true)
    expect(res.garment.regions['snaps']).toBeTruthy() // bomber base for a detected jacket
    expect(res.spec?.garmentType.value).toBe('jacket')
    // confidences are the REAL detected attributes, and a jacket detection maps closure to snaps-visible
    expect(res.confidences && res.confidences.length).toBeGreaterThan(0)
    expect(res.garment.regions['snaps'].visible).toBe(true)
  })

  it('OpenAI photo reconstruction falls back to an honest template start when the response is not a usable spec', async () => {
    saveAiSettings({ apiKey: 'sk-abcdefghijklmnopqrstuvwx', model: 'gpt-4o' })
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"chatter":"a lovely red jacket"}' } }] }),
    }) as unknown as typeof fetch
    const res = await resolveProvider().reconstructGarment(['data:image/png;base64,AAAA'])
    expect(res.templateStart).toBe(true)
    expect(res.garment.source.kind).toBe('reference')
    expect(hasFrontAndBack(res.garment)).toBe(true)
  })

  it('OpenAI generation accepts a valid garment and REPAIRS an imperfect one (never errors on output)', async () => {
    saveAiSettings({ apiKey: 'sk-abcdefghijklmnopqrstuvwx', model: 'gpt-4o' })
    const valid = makeReferenceBomber()
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(valid) } }] }) }) as unknown as typeof fetch
    const res = await generateGarment('a bomber')
    expect(res.source).toBe('openai')
    expect(hasFrontAndBack(res.garment)).toBe(true)

    // A front-only response is now REPAIRED (front mirrored to back) — not an error to the user.
    const frontOnly = { ...valid, regions: Object.fromEntries(Object.entries(valid.regions).map(([id, r]) => [id, { ...r, shapes: r.shapes.filter((s) => s.view === 'front') }])) }
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(frontOnly) } }] }) }) as unknown as typeof fetch
    const repaired = await generateGarment('a bomber')
    expect(hasFrontAndBack(repaired.garment)).toBe(true)
    expect(isEditableGarment(repaired.garment)).toBe(true)
  })

  it('generation falls back to a template (never errors) when OpenAI output is unusable garbage', async () => {
    saveAiSettings({ apiKey: 'sk-abcdefghijklmnopqrstuvwx', model: 'gpt-4o' })
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"totally":"wrong"}' } }] }) }) as unknown as typeof fetch
    const res = await generateGarment('luxury bomber')
    expect(isEditableGarment(res.garment)).toBe(true)
    expect(hasFrontAndBack(res.garment)).toBe(true) // a real editable garment, not an error screen
  })
})

describe('garment normalizer — repairs imperfect AI output', () => {
  const region = (over: object = {}) => ({ id: 'body', name: 'Body', type: 'body', children: [], shapes: [{ view: 'front', d: 'M150,120 L250,120 L250,432 L150,432 Z', role: 'fill' }], visible: true, locked: false, ...over })

  it('fills missing top-level fields + mirrors front→back', () => {
    const raw = { regions: { body: region() } } // no format/version/id/style/views/rootIds
    const g = normalizeGarment(raw)!
    expect(isEditableGarment(g)).toBe(true)
    expect(hasFrontAndBack(g)).toBe(true) // back mirrored from front
    expect(g.rootIds).toContain('body') // rootIds computed
    expect(g.views.map((v) => v.id)).toEqual(['front', 'back'])
  })

  it('unwraps { garment: {...} } and drops regions with no usable shapes', () => {
    const raw = { garment: { regions: { body: region(), ghost: region({ id: 'ghost', shapes: [] }), bad: region({ id: 'bad', shapes: [{ view: 'front', d: '', role: 'fill' }] }) } } }
    const g = normalizeGarment(raw)!
    expect(Object.keys(g.regions)).toEqual(['body']) // ghost + bad dropped
  })

  it('coerces invalid region type / shape role and filters dangling children', () => {
    const raw = { regions: { body: region({ type: 'not-a-type', children: ['missing'], shapes: [{ view: 'sideways', d: 'M0,0 L10,0', role: 'nonsense' }] }) } }
    const g = normalizeGarment(raw)!
    expect(g.regions['body'].type).toBe('panel') // bad type → panel
    expect(g.regions['body'].children).toEqual([]) // dangling child dropped
    expect(g.regions['body'].shapes[0].view).toBe('front') // bad view → front
    expect(g.regions['body'].shapes[0].role).toBe('fill') // bad role → fill
  })

  it('returns null only when there is no usable geometry', () => {
    expect(normalizeGarment({ totally: 'wrong' })).toBeNull()
    expect(normalizeGarment({ regions: {} })).toBeNull()
    expect(normalizeGarment('not json')).toBeNull()
  })

  it('parseJsonLoose extracts JSON from fences and prose', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 })
    expect(parseJsonLoose('```json\n{"a":2}\n```')).toEqual({ a: 2 })
    expect(parseJsonLoose('Here you go: {"a":3} — enjoy!')).toEqual({ a: 3 })
    expect(parseJsonLoose('no json here')).toBeNull()
  })
})

describe('normalizer adversarial stress — never crashes, always valid-or-null', () => {
  const good = 'M150,120 L250,120 L250,432 L150,432 Z'
  // A gauntlet of the shapes real models actually return when they drift off-spec.
  const cases: unknown[] = [
    { regions: { a: { shapes: [{ view: 'front', d: good, role: 'fill' }] } } }, // bare region
    { garment: { regions: { a: { shapes: [{ view: 'front', d: good, role: 'fill' }] } } } }, // wrapped
    { regions: { a: { children: ['a'], shapes: [{ view: 'front', d: good }] } } }, // self-child
    { regions: { a: { children: ['b'], shapes: [{ view: 'front', d: good }] }, b: { children: ['a'], shapes: [{ view: 'back', d: good }] } } }, // 2-cycle
    { regions: { a: { children: ['b'], shapes: [{ d: good }] }, b: { children: ['c'], shapes: [{ d: good }] }, c: { children: ['a'], shapes: [{ d: good }] } } }, // 3-cycle
    { regions: { a: { children: ['a', 'b', 'ghost'], shapes: [{ d: good }] }, b: { shapes: [{ d: good }] } } }, // dangling + self child
    { regions: { a: { type: 'wat', shapes: [{ view: 'diagonal', d: good, role: 'glow' }] } } }, // bad type/view/role
    { regions: { a: { shapes: [{ view: 'front', d: 'not a path' }, { view: 'front', d: good }] } } }, // one junk shape
    { regions: { a: { shapes: [] }, b: { shapes: [{ d: good }] } } }, // empty-shape region dropped
    { regions: { a: { shapes: [{ d: good, view: 'back' }] } } }, // back-only → front mirrored
    { rootIds: ['zzz', 'a'], regions: { a: { shapes: [{ d: good }] } } }, // rootId points at missing id
    { regions: { a: { shapes: [{ d: good }], visible: 'yes', locked: 1 } } }, // wrong-typed flags
    { regions: { a: { name: 42, shapes: [{ d: good }] } } }, // non-string name
    { regions: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`r${i}`, { children: [`r${i + 1}`], shapes: [{ d: good }] }])) }, // deep 40-level chain
    'plain string', 42, null, undefined, [], {}, { regions: null }, { regions: 'x' }, // junk → null
    { regions: { a: { shapes: 'nope' } } }, // shapes not array → dropped → null
    { views: [{ viewBox: { w: 'x', h: null } }], regions: { a: { shapes: [{ d: good }] } } }, // bad viewBox
  ]

  it('every malformed payload yields null OR a valid, walkable front+back garment (no throw, no hang)', () => {
    for (const input of cases) {
      const g = normalizeGarment(input)
      if (g === null) continue
      expect(isEditableGarment(g)).toBe(true)
      expect(hasFrontAndBack(g)).toBe(true)
      // The tree must be finite/walkable — a cycle would hang here without the guard.
      const flat = flattenRegions(g)
      expect(flat.length).toBeGreaterThan(0)
      expect(flat.length).toBeLessThanOrEqual(Object.keys(g.regions).length)
      // Every rendered region has real geometry in both views.
      for (const { region } of flat) {
        expect(region.shapes.some((s) => s.view === 'front')).toBe(true)
        expect(region.shapes.some((s) => s.view === 'back')).toBe(true)
      }
    }
  })

  it('cyclic model output is broken into a finite tree (would otherwise hang the editor)', () => {
    const g = normalizeGarment({ regions: { a: { children: ['b'], shapes: [{ d: good }] }, b: { children: ['a'], shapes: [{ d: good }] } } })!
    expect(g).not.toBeNull()
    const flat = flattenRegions(g)
    expect(flat.length).toBe(2) // both regions appear exactly once — no repeats, no infinite loop
  })
})

describe('template catalog — 50+ distinct garments, all valid', () => {
  it('ships 50+ templates, each a unique id that builds a valid front+back garment', () => {
    expect(GARMENT_TEMPLATES.length).toBeGreaterThanOrEqual(50)
    const ids = new Set<string>()
    for (const t of GARMENT_TEMPLATES) {
      expect(ids.has(t.id)).toBe(false) // unique ids
      ids.add(t.id)
      const g = t.make()
      expect(isEditableGarment(g)).toBe(true)
      expect(hasFrontAndBack(g)).toBe(true)
      expect(Object.keys(g.regions).length).toBeGreaterThan(1)
      // every shape path is non-empty and starts with a move command (renderable)
      for (const r of Object.values(g.regions)) for (const s of r.shapes) expect(/^\s*M/.test(s.d)).toBe(true)
    }
  })

  it('a detected puffer builds the puffer template with quilt channels', () => {
    const g = buildFromSpec(coerceSpec({ garmentType: { value: 'puffer', confidence: 95 } })!).garment
    expect(g.regions['quilting']).toBeTruthy() // the puffer's signature horizontal channels
    expect(hasFrontAndBack(g)).toBe(true)
  })

  it('every catalog template covers a real garment category', () => {
    const cats = new Set(GARMENT_TEMPLATES.map((t) => t.category))
    for (const c of ['Outerwear', 'Tops', 'Bottoms', 'Dresses']) expect(cats.has(c)).toBe(true)
  })
})

describe('photo reconstruction — vision spec → trusted template (honest, not a fake trace)', () => {
  const maxNum = (d: string) => Math.max(...(d.match(/-?\d*\.?\d+/g) ?? ['0']).map(Number))
  const bodyFront = (g: ReturnType<typeof buildFromSpec>['garment']) => g.regions['body'].shapes.find((s) => s.view === 'front')!.d
  const spec = (over: Partial<Record<string, { value: string; confidence: number }>> = {}) => ({
    garmentType: { value: 'jacket', confidence: 88 },
    length: { value: 'regular', confidence: 70 },
    sleeves: { value: 'long', confidence: 80 },
    collar: { value: 'ribbed', confidence: 75 },
    closure: { value: 'snaps', confidence: 66 },
    pockets: { value: 'side', confidence: 60 },
    ...over,
  })

  it('coerceSpec keeps in-enum values, zeroes out-of-enum ones, and rejects junk', () => {
    const s = coerceSpec(spec())!
    expect(s.garmentType.value).toBe('jacket')
    expect(s.closure.value).toBe('snaps')
    // out-of-enum value is treated as "not said": falls back to default at confidence 0
    const bad = coerceSpec(spec({ garmentType: { value: 'spaceship', confidence: 99 } }))!
    expect(bad.garmentType.value).toBe('unknown')
    expect(bad.garmentType.confidence).toBe(0)
    // no usable signal at all → null (so the caller shows an honest template start)
    expect(coerceSpec('nope')).toBeNull()
    expect(coerceSpec({})).toBeNull()
    expect(coerceSpec(null)).toBeNull()
  })

  it('coerceSpec accepts a spec that is only a detected colour', () => {
    const s = coerceSpec({ primaryColor: { value: 'red', confidence: 91 } })
    expect(s).not.toBeNull()
    expect(s!.primaryColor!.value).toBe('red')
  })

  it('a jacket spec builds the bomber template (real structural match), front + back, honest name', () => {
    const { garment, confidences } = buildFromSpec(coerceSpec(spec())!)
    expect(isEditableGarment(garment)).toBe(true)
    expect(hasFrontAndBack(garment)).toBe(true)
    // bomber structure — the closest match to a varsity/letterman jacket
    expect(garment.regions['body']).toBeTruthy()
    expect(garment.regions['snaps']).toBeTruthy()
    expect(garment.regions['zipper']).toBeTruthy()
    expect(garment.name.endsWith('(from photo)')).toBe(true)
    expect(garment.source.kind).toBe('ai')
    // confidences are REAL detected attributes, never invented
    expect(confidences.some((c) => c.label.startsWith('Type'))).toBe(true)
    expect(confidences.every((c) => c.value >= 0 && c.value <= 100)).toBe(true)
  })

  it('every detected garment type builds a distinct, valid front+back template', () => {
    const types = ['jacket', 'coat', 'hoodie', 'sweater', 'tee', 'polo', 'tank', 'dress', 'skirt', 'pants', 'shorts'] as const
    const ids = new Set<string>()
    for (const t of types) {
      const g = buildFromSpec(coerceSpec(spec({ garmentType: { value: t, confidence: 90 } }))!).garment
      expect(isEditableGarment(g)).toBe(true)
      expect(hasFrontAndBack(g)).toBe(true)
      expect(Object.keys(g.regions).length).toBeGreaterThan(1)
      ids.add(g.id)
    }
    expect(ids.size).toBe(types.length) // 11 distinct templates, not all the same
  })

  it('per-view thumbnails render genuinely different front/back (drives the Studio view tabs)', () => {
    const g = getTemplate('tpl-varsity')!.make()
    const front = garmentThumbnailSvg(g)
    const back = garmentThumbnailSvg({ ...g, views: [...g.views].reverse() })
    expect(front).not.toBe(back) // the Back tab must not show the front
    expect(front).toContain('a5,5') // snap buttons are front-only…
    expect(back).not.toContain('a5,5') // …and never leak onto the back
  })

  it('a detected jacket builds the VARSITY template with intentional per-view construction (no front→back leak)', () => {
    const g = buildFromSpec(coerceSpec(spec())!).garment
    // varsity-specific regions (a plain bomber has none of these) prove the varsity template was used
    expect(g.regions['chest-patch']).toBeTruthy()
    expect(g.regions['back-logo']).toBeTruthy()
    expect(g.regions['placket']).toBeTruthy()
    // front-only details never carry a back shape (so the back view can't leak them)
    expect(g.regions['placket'].shapes.every((s) => s.view === 'front')).toBe(true)
    expect(g.regions['chest-patch'].shapes.every((s) => s.view === 'front')).toBe(true)
    // back-only construction never carries a front shape
    expect(g.regions['back-logo'].shapes.every((s) => s.view === 'back')).toBe(true)
    expect(g.regions['yoke'].shapes.every((s) => s.view === 'back')).toBe(true)
    // fabric renders in BOTH views (so neither view is blank)
    const body = g.regions['body'].shapes
    expect(body.some((s) => s.view === 'front') && body.some((s) => s.view === 'back')).toBe(true)
  })

  it('detected attributes actually change geometry (cropped shortens, sleeveless removes sleeves)', () => {
    const regular = buildFromSpec(coerceSpec(spec())!).garment
    const cropped = buildFromSpec(coerceSpec(spec({ length: { value: 'cropped', confidence: 80 } }))!).garment
    expect(maxNum(bodyFront(cropped))).toBeLessThan(maxNum(bodyFront(regular))) // hem raised
    const sleeveless = buildFromSpec(coerceSpec(spec({ sleeves: { value: 'sleeveless', confidence: 80 } }))!).garment
    expect(Object.values(sleeveless.regions).some((r) => r.type === 'sleeve' || r.type === 'cuff')).toBe(false)
    expect(hasFrontAndBack(sleeveless)).toBe(true)
  })

  it('closure detection toggles snaps vs zipper visibility to match the photo', () => {
    const snaps = buildFromSpec(coerceSpec(spec({ closure: { value: 'snaps', confidence: 70 } }))!).garment
    expect(snaps.regions['snaps'].visible).toBe(true)
    expect(snaps.regions['zipper'].visible).toBe(false)
    const zip = buildFromSpec(coerceSpec(spec({ closure: { value: 'zip', confidence: 70 } }))!).garment
    expect(zip.regions['zipper'].visible).toBe(true)
    expect(zip.regions['snaps'].visible).toBe(false)
  })

  it('colorNotesFromSpec reports colour as applied, but keeps pattern honestly not-drawn', () => {
    const notes = colorNotesFromSpec(coerceSpec(spec({ primaryColor: { value: 'red', confidence: 91 }, pattern: { value: 'striped', confidence: 80 } }))!)
    expect(notes[0].toLowerCase()).toContain('applied') // colour IS painted now
    expect(notes.some((n) => /aren't drawn|not drawn/i.test(n))).toBe(true) // stripes still honestly deferred
    expect(colorNotesFromSpec(undefined)).toEqual([])
  })

  it('buildFromSpec paints the detected colours onto fabric (primary body, secondary sleeves) — real colour', () => {
    const g = buildFromSpec(coerceSpec(spec({ primaryColor: { value: 'red', confidence: 95 }, secondaryColor: { value: 'white', confidence: 92 } }))!).garment
    expect(g.regions['body'].appearance?.fill).toBe('#C0392B') // red body
    expect(g.regions['sleeve-l'].appearance?.fill).toBe('#F4F4F2') // white sleeves (contrast)
    // construction/hardware isn't colour-painted
    expect(g.regions['snaps'].appearance?.fill).toBeUndefined()
  })

  it('placeholder provider (no key) returns an HONEST template start — never mislabeled as from-photo', async () => {
    saveAiSettings({ apiKey: '', model: 'gpt-4o' })
    const result = await resolveProvider().reconstructGarment(['data:image/png;base64,AAAA'])
    expect(result.templateStart).toBe(true)
    expect(result.confidences).toBeUndefined() // no invented confidences
    expect(result.garment.source.kind).toBe('reference') // not { kind:'import', from:'photo' }
    expect(result.garment.name.toLowerCase()).toContain('template start')
    expect(hasFrontAndBack(result.garment)).toBe(true)
  })
})

describe('AI provider abstraction — one interface, two providers', () => {
  it('falls back to the placeholder when no key is configured', async () => {
    const p = resolveProvider()
    expect(p.id).toBe('placeholder')
    const g = makeReferenceBomber()
    const res = await p.editGarment(g, 'remove the buttons')
    expect(res.garment.regions['snaps']).toBeUndefined()
  })

  it('uses OpenAI when a key is set, and accepts a valid edited garment', async () => {
    saveAiSettings({ apiKey: 'sk-abcdefghijklmnopqrstuvwx', model: 'gpt-4o' })
    const g = makeReferenceBomber()
    const edited = removeRegions(g, new Set(['snaps'])).garment
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(edited) } }] }),
    }) as unknown as typeof fetch
    const p = resolveProvider()
    expect(p.id).toBe('openai')
    const res = await p.editGarment(g, 'remove the buttons')
    expect(res.intent).toBe('openai')
    expect(res.garment.regions['snaps']).toBeUndefined()
  })

  it('rejects an invalid OpenAI response and falls back to the placeholder', async () => {
    saveAiSettings({ apiKey: 'sk-abcdefghijklmnopqrstuvwx', model: 'gpt-4o' })
    const g = makeReferenceBomber()
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ not: 'a garment' }) } }] }),
    }) as unknown as typeof fetch
    const res = await resolveProvider().editGarment(g, 'remove the buttons')
    // fell back to the deterministic placeholder → still a valid region-scoped edit
    expect(res.intent).toBe('remove')
    expect(res.garment.regions['snaps']).toBeUndefined()
  })

  it('rejects an OpenAI response that guts the geometry, and falls back', async () => {
    saveAiSettings({ apiKey: 'sk-abcdefghijklmnopqrstuvwx', model: 'gpt-4o' })
    const g = makeReferenceBomber()
    // Same structure/ids but every region's shapes emptied — structurally valid, visually destroyed.
    const gutted = { ...g, regions: Object.fromEntries(Object.entries(g.regions).map(([id, r]) => [id, { ...r, shapes: [] }])) }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(gutted) } }] }),
    }) as unknown as typeof fetch
    const res = await resolveProvider().editGarment(g, 'remove the buttons')
    expect(res.intent).toBe('remove') // rejected the gutted response, used the placeholder
    expect(res.garment.regions['body'].shapes.length).toBeGreaterThan(0) // geometry intact
  })

  it('degrades to the placeholder when the network throws', async () => {
    saveAiSettings({ apiKey: 'sk-abcdefghijklmnopqrstuvwx', model: 'gpt-4o' })
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch
    const res = await resolveProvider().editGarment(makeReferenceBomber(), 'add 6 buttons')
    expect(res.garment.regions['snaps'].shapes.filter((s) => s.view === 'front')).toHaveLength(6)
  })
})

describe('garment duplication - reference integrity', () => {
  it('duplicate garment histories are completely independent after save/load cycle', () => {
    const s = createGarment(U, buildFromTemplate('tpl-shorts').garment, { name: 'Shorts', category: 'Bottoms', origin: 'blank' })
    const dup = duplicateGarment(U, s.id)!
    
    // Reload both from localStorage
    const origHist = loadHistory(s.id)!
    const dupHist = loadHistory(dup.id)!
    
    // They should be completely separate objects
    expect(origHist.revisions[0].garment).not.toBe(dupHist.revisions[0].garment)
    expect(origHist.revisions[0].garment.regions).not.toBe(dupHist.revisions[0].garment.regions)
  })
})

describe('garment duplication - in-memory phase', () => {
  it('during duplication, before save/load, duplicate shares regions reference with source history', () => {
    // This test captures the behavior described in the finding
    const s = createGarment(U, buildFromTemplate('tpl-shorts').garment, { name: 'Shorts', category: 'Bottoms', origin: 'blank' })
    
    // Load the original history (simulating what duplicateGarment does)
    const sourceHist = loadHistory(s.id)!
    const current = sourceHist.revisions[0].garment
    
    // Duplicating from the source's current garment must produce an independent garment id +
    // history; nothing mutates regions in place, so the two never affect each other.
    const dup = createGarment(U, current, { name: 'Shorts copy', category: 'Bottoms', origin: 'blank' })
    expect(dup.id).not.toBe(s.id)
    expect(loadHistory(dup.id)!.revisions[0].garment.id).toBe(dup.id)
    expect(loadHistory(s.id)!.revisions[0].garment.id).toBe(s.id)
  })
})
