import { describe, it, expect } from 'vitest'
import { generateConcepts, regenerateConcept, conceptName, buildConceptSvg, isLiveConceptAi } from './conceptEngine'
import { parsePrompt, describesGraphic } from './promptParse'
import { MOTIFS, buildMotif } from './motifs'
import { makeRng } from './rng'

describe('parsePrompt', () => {
  it('resolves subject motif and style from a prompt', () => {
    const p = parsePrompt('Chrome tribal star')
    expect(p.motif).toBe('tribalStar')
    expect(p.styles).toContain('chrome')
    expect(p.tags).toContain('Chrome')
    expect(p.tags).toContain('Star')
  })

  it('detects multiple subjects and styles across examples', () => {
    expect(parsePrompt('vintage skull with roses').motif).toBe('skull')
    expect(parsePrompt('vintage skull with roses').styles).toContain('vintage')
    expect(parsePrompt('graffiti butterfly').motif).toBe('butterfly')
    expect(parsePrompt('graffiti butterfly').styles).toContain('graffiti')
    expect(parsePrompt('cyberpunk dragon').motif).toBe('serpent')
    expect(parsePrompt('neon lightning').motif).toBe('lightning')
    expect(parsePrompt('gothic cross').motif).toBe('gothicCross')
    expect(parsePrompt('Y2K chrome heart').motif).toBe('heart')
  })

  it('matches whole words only — "vintage" must not trigger the graffiti "tag" keyword', () => {
    const p = parsePrompt('vintage skull with roses')
    expect(p.styles).toEqual(['vintage'])
    expect(p.styles).not.toContain('graffiti')
    expect(p.tags).not.toContain('Graffiti')
  })

  it('falls back to an emblem for an unknown subject and never throws', () => {
    const p = parsePrompt('quantum flux widget')
    expect(p.motif).toBe('emblem')
    expect(p.initials.length).toBeGreaterThan(0)
  })
})

describe('describesGraphic — command bar routing', () => {
  it('routes described graphics to generation, even when they contain style words', () => {
    expect(describesGraphic('Chrome tribal star')).toBe(true)
    expect(describesGraphic('vintage skull with roses')).toBe(true)
    expect(describesGraphic('graffiti butterfly')).toBe(true)
    expect(describesGraphic('luxury monogram')).toBe(true)
  })

  it('leaves edit commands for the interpreter (does not generate)', () => {
    expect(describesGraphic('make it oversized')).toBe(false)
    expect(describesGraphic('add a vintage wash')).toBe(false)
    expect(describesGraphic('move the logo to the left chest')).toBe(false)
    expect(describesGraphic('')).toBe(false)
  })
})

describe('generateConcepts', () => {
  it('returns exactly 3 concepts with valid transparent SVG + data URLs', () => {
    const concepts = generateConcepts('Chrome tribal star')
    expect(concepts).toHaveLength(3)
    for (const c of concepts) {
      expect(c.svg).toContain('<svg')
      expect(c.svg).toContain('viewBox="0 0 200 200"')
      expect(c.svg).not.toContain('<rect width="200" height="200"') // no opaque backing
      expect(c.dataUrl.startsWith('data:image/svg+xml')).toBe(true)
      expect(c.tags.length).toBeGreaterThan(0)
    }
  })

  it('is deterministic for the same prompt', () => {
    const a = generateConcepts('neon lightning')
    const b = generateConcepts('neon lightning')
    expect(a.map((c) => c.svg)).toEqual(b.map((c) => c.svg))
  })

  it('produces three distinct concepts', () => {
    const svgs = generateConcepts('gothic cross').map((c) => c.svg)
    expect(new Set(svgs).size).toBe(3)
  })

  it('respects a named style across all three concepts', () => {
    const concepts = generateConcepts('chrome skull')
    // every concept should be a chrome/gold-chrome variant when chrome is named
    expect(concepts.every((c) => /chrome/i.test(c.styleLabel))).toBe(true)
  })

  it('regenerateConcept yields a different seed/art than the source', () => {
    const [first] = generateConcepts('chrome tribal star')
    const re = regenerateConcept(first.prompt, first.seed)
    expect(re.seed).not.toBe(first.seed)
    expect(re.svg).not.toBe(first.svg)
  })

  it('reports live-AI availability as a boolean (false without an API key, as in tests)', () => {
    expect(typeof isLiveConceptAi()).toBe('boolean')
    expect(isLiveConceptAi()).toBe(false) // no OpenAI key in the test environment
  })
})

describe('motif library', () => {
  it('every motif builds nodes without throwing', () => {
    for (const key of Object.keys(MOTIFS)) {
      const nodes = buildMotif(key, makeRng(42), 'AB')
      expect(nodes.length).toBeGreaterThan(0)
      for (const n of nodes) {
        if (n.kind === 'path') expect(n.d.length).toBeGreaterThan(2)
        else expect(n.text.length).toBeGreaterThan(0)
      }
    }
  })

  it('buildConceptSvg produces well-formed markup for each motif', () => {
    for (const key of Object.keys(MOTIFS)) {
      const { svg } = buildConceptSvg(`test ${key}`, 123)
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg.endsWith('</svg>')).toBe(true)
      // balanced-ish: no NaN leaked into coordinates
      expect(svg).not.toContain('NaN')
    }
  })
})

describe('conceptName', () => {
  it('title-cases a prompt into a layer name', () => {
    expect(conceptName('chrome tribal star')).toBe('Chrome Tribal Star')
    expect(conceptName('  ')).toBe('AI Graphic')
  })
})
