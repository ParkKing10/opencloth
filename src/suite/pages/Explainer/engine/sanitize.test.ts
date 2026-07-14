import { describe, it, expect } from 'vitest'
import { sanitizeElement, sanitizeProject, sanitizeScene, sanitizeScenes } from './sanitize'

describe('sanitizeElement', () => {
  it('rejects unknown kinds and non-objects', () => {
    expect(sanitizeElement({ kind: 'video' })).toBeNull()
    expect(sanitizeElement('text')).toBeNull()
    expect(sanitizeElement(null)).toBeNull()
  })

  it('clamps positions and fills text defaults', () => {
    const el = sanitizeElement({ kind: 'text', x: 5, y: -3, size: 'huge', color: 'rainbow' })
    expect(el).toMatchObject({ kind: 'text', x: 1, y: 0, size: 'md', color: 'white', text: 'Text' })
  })

  it('rejects images without an assetId', () => {
    expect(sanitizeElement({ kind: 'image', w: 0.5 })).toBeNull()
    expect(sanitizeElement({ kind: 'image', assetId: 'abc', w: 99 })).toMatchObject({ assetId: 'abc', w: 1 })
  })

  it('rejects cursors with fewer than 2 waypoints and sorts the path', () => {
    expect(sanitizeElement({ kind: 'cursor', path: [{ at: 0, x: 0, y: 0 }] })).toBeNull()
    const el = sanitizeElement({
      kind: 'cursor',
      path: [
        { at: 0.8, x: 1, y: 1 },
        { at: 0.1, x: 0, y: 0, click: true },
      ],
    })
    expect(el?.kind).toBe('cursor')
    if (el?.kind === 'cursor') expect(el.path[0].at).toBeCloseTo(0.1)
  })

  it('whitelists animation effects', () => {
    const el = sanitizeElement({ kind: 'chip', label: 'Hi', enter: { effect: 'explode', at: 2, dur: 0 } })
    expect(el?.enter).toMatchObject({ effect: 'fade', at: 0.95, dur: 0.02 })
  })
})

describe('sanitizeScene / sanitizeScenes', () => {
  it('rejects unknown scene types', () => {
    expect(sanitizeScene({ type: 'outro', duration: 3 })).toBeNull()
  })

  it('clamps durations and caps custom elements at 12', () => {
    const scene = sanitizeScene({
      type: 'custom',
      duration: 99,
      props: { elements: Array.from({ length: 30 }, () => ({ kind: 'chip', label: 'x' })) },
    })
    expect(scene?.duration).toBe(15)
    if (scene?.type === 'custom') expect(scene.props.elements).toHaveLength(12)
  })

  it('drops invalid entries from a scene list and caps at 12', () => {
    const scenes = sanitizeScenes([{ type: 'intro' }, { type: 'bogus' }, null, { type: 'cta' }])
    expect(scenes.map((s) => s.type)).toEqual(['intro', 'cta'])
    expect(sanitizeScenes('not an array')).toEqual([])
  })
})

describe('sanitizeProject', () => {
  it('rejects wrong versions', () => {
    expect(sanitizeProject({ version: 2 })).toBeNull()
    expect(sanitizeProject(null)).toBeNull()
  })

  it('repairs a broken brand and keeps valid scenes', () => {
    const p = sanitizeProject({
      version: 1,
      brand: { product: '', accent: 'lime', bg: 'neon' },
      aspect: '4:3',
      scenes: [{ type: 'statement', duration: 3, props: { text: 'Hello world', highlight: 'world' } }],
    })
    expect(p).not.toBeNull()
    expect(p?.brand.accent).toBe('#d1f94f')
    expect(p?.brand.bg).toBe('midnight')
    expect(p?.aspect).toBe('16:9')
    expect(p?.scenes).toHaveLength(1)
  })
})
