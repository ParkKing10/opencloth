import { describe, it, expect } from 'vitest'
import { buildDirector } from './directorModel'
import type { CanvasObject } from './objectModel'

const obj = (over: Partial<CanvasObject> = {}): CanvasObject => ({
  type: 'image',
  x: 0.5,
  y: 0.45,
  width: 0.4,
  rotation: 0,
  opacity: 1,
  src: 'data:image/svg+xml,x',
  ...over,
})

describe('buildDirector', () => {
  it('suggests scaling down when the graphic fills the print area (worded honestly)', () => {
    const s = buildDirector(obj({ width: 0.8 }), { objectType: 'image' })
    const scale = s.find((x) => x.id === 'scale-down')
    expect(scale).toBeTruthy()
    expect(scale!.text.toLowerCase()).toContain('print area')
    expect(scale!.text.toLowerCase()).not.toContain('chest') // no invented garment measurement
    expect(scale!.action).toEqual({ kind: 'scale', factor: 0.8 })
  })

  it('suggests scaling up when the graphic is tiny', () => {
    const s = buildDirector(obj({ width: 0.1 }), { objectType: 'image' })
    expect(s.some((x) => x.id === 'scale-up')).toBe(true)
  })

  it('suggests centering when off-centre', () => {
    const s = buildDirector(obj({ x: 0.2, y: 0.8, width: 0.3 }), { objectType: 'image' })
    expect(s.some((x) => x.id === 'center')).toBe(true)
  })

  it('offers a Multiply blend for art with a normal blend mode', () => {
    const s = buildDirector(obj({ width: 0.3 }), { objectType: 'image' })
    const blend = s.find((x) => x.id === 'blend')
    expect(blend?.action).toEqual({ kind: 'blend', blendMode: 'multiply' })
  })

  it('does not re-offer a blend when one is already applied', () => {
    const s = buildDirector(obj({ width: 0.3, blendMode: 'multiply' }), { objectType: 'image' })
    expect(s.some((x) => x.id === 'blend')).toBe(false)
  })

  it('offers matching pieces only when the prompt is known, and generates real prompts', () => {
    const withPrompt = buildDirector(obj({ width: 0.3 }), { objectType: 'image', prompt: 'chrome tribal star' })
    const sleeve = withPrompt.find((x) => x.id === 'sleeve')
    expect(sleeve?.action).toEqual({ kind: 'generate', prompt: 'chrome tribal star sleeve graphic' })
    const noPrompt = buildDirector(obj({ width: 0.3 }), { objectType: 'image' })
    expect(noPrompt.some((x) => x.id === 'sleeve')).toBe(false)
  })

  it('caps at three suggestions', () => {
    const s = buildDirector(obj({ width: 0.9, x: 0.1, y: 0.9 }), { objectType: 'image', prompt: 'neon dragon' })
    expect(s.length).toBeLessThanOrEqual(3)
  })
})
