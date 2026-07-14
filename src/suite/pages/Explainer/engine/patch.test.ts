import { describe, expect, it } from 'vitest'
import { applyPatch, sanitizePatch } from './patch'
import { localDirect } from './localDirector'
import type { AudioBeats } from './audio'
import type { Project } from '../types'

function baseProject(): Project {
  return {
    version: 1,
    brand: { product: 'loom studios', accent: '#d1f94f', bg: 'midnight' },
    aspect: '16:9',
    scenes: [
      { id: 'intro1', type: 'intro', duration: 4, props: { title: 'Hi', tagline: 'x' } },
      {
        id: 'scene1',
        type: 'custom',
        duration: 5,
        props: {
          label: 'AI scene',
          orbs: true,
          elements: [
            { id: 'head', kind: 'text', text: 'Describe', size: 'md', color: 'white', x: 0.5, y: 0.4 },
            { id: 'btn', kind: 'button', label: 'Generate', x: 0.5, y: 0.7, clickAt: 0.6 },
          ],
        },
      },
    ],
    audio: { assetId: 'a1', name: 'song', volume: 0.8, fadeIn: 0.4, fadeOut: 0.8, offset: 0 },
  }
}

describe('applyPatch', () => {
  it('setElement changes one prop, leaves the rest intact', () => {
    const p = baseProject()
    const r = applyPatch(p, { ops: [{ op: 'setElement', sceneId: 'scene1', elementId: 'head', props: { size: 'xl', x: 0.3 } }] })
    expect(r.applied).toBe(1)
    const sc = r.project.scenes[1]
    const head = sc.type === 'custom' ? sc.props.elements.find((e) => e.id === 'head') : null
    expect(head?.kind === 'text' && head.size).toBe('xl')
    expect(head?.x).toBeCloseTo(0.3)
    // original object untouched (immutability)
    const origHead = p.scenes[1].type === 'custom' ? p.scenes[1].props.elements[0] : null
    expect(origHead?.kind === 'text' && origHead.size).toBe('md')
  })

  it('setScene retimes and edits template props', () => {
    const r = applyPatch(baseProject(), {
      ops: [
        { op: 'setScene', sceneId: 'intro1', duration: 6, props: { title: 'Hello world' } },
        { op: 'setScene', sceneId: 'scene1', duration: 3 },
      ],
    })
    expect(r.applied).toBe(2)
    const intro = r.project.scenes[0]
    expect(intro.duration).toBe(6)
    expect(intro.type === 'intro' && intro.props.title).toBe('Hello world')
    expect(r.project.scenes[1].duration).toBe(3)
  })

  it('setAspect + setBrand', () => {
    const r = applyPatch(baseProject(), {
      ops: [{ op: 'setAspect', aspect: '9:16' }, { op: 'setBrand', accent: '#7ab8ff', bg: 'aurora' }],
    })
    expect(r.project.aspect).toBe('9:16')
    expect(r.project.brand.accent).toBe('#7ab8ff')
    expect(r.project.brand.bg).toBe('aurora')
  })

  it('add / remove / reorder scenes', () => {
    const r = applyPatch(baseProject(), {
      ops: [
        { op: 'addScene', scene: { type: 'cta', duration: 4, props: { title: 'Go', button: 'Start' } } },
        { op: 'reorderScene', sceneId: 'scene1', toIndex: 0 },
      ],
    })
    expect(r.project.scenes.length).toBe(3)
    expect(r.project.scenes[0].id).toBe('scene1') // moved to front
    const r2 = applyPatch(r.project, { ops: [{ op: 'removeScene', sceneId: 'intro1' }] })
    expect(r2.project.scenes.find((s) => s.id === 'intro1')).toBeUndefined()
  })

  it('setAudio clamps and needs a track', () => {
    const r = applyPatch(baseProject(), { ops: [{ op: 'setAudio', volume: 2, fadeOut: 3 }] })
    expect(r.project.audio?.volume).toBe(1) // clamped
    expect(r.project.audio?.fadeOut).toBe(3)
    const noAudio = { ...baseProject(), audio: undefined }
    const r2 = applyPatch(noAudio, { ops: [{ op: 'setAudio', volume: 0.5 }] })
    expect(r2.skipped).toBe(1)
  })

  it('alignToBeat snaps the button click to the nearest beat', () => {
    const beats: AudioBeats = { bpm: 120, beats: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9], strongBeats: [4, 8], duration: 9 }
    // scene1 starts at t=4 (after 4s intro), duration 5. Button clickAt 0.6 → abs 4 + 3 = 7.0 → nearest beat 7.0.
    const r = applyPatch(baseProject(), { ops: [{ op: 'alignToBeat', sceneId: 'scene1' }] }, beats)
    expect(r.applied).toBe(1)
    const sc = r.project.scenes[1]
    const btn = sc.type === 'custom' ? sc.props.elements.find((e) => e.id === 'btn') : null
    // snapped click, converted back to fraction, lands on a beat → 7.0 abs → (7-4)/5 = 0.6
    expect(btn?.kind === 'button' && Math.round((btn.clickAt ?? 0) * 100) / 100).toBe(0.6)
  })

  it('skips invalid ops without throwing or corrupting', () => {
    const r = applyPatch(baseProject(), {
      ops: [
        { op: 'setElement', sceneId: 'intro1', elementId: 'x', props: { size: 'xl' } }, // intro is not custom
        { op: 'removeScene', sceneId: 'nope' },
      ],
    })
    expect(r.applied).toBe(0)
    expect(r.skipped).toBe(2)
    expect(r.project.scenes.length).toBe(2)
  })

  it('sanitizePatch drops junk ops and accepts "operations" alias', () => {
    const patch = sanitizePatch({ operations: [{ op: 'setAspect', aspect: '1:1' }, { op: 'nonsense' }, 42] })
    expect(patch.ops.length).toBe(1)
    expect(patch.ops[0].op).toBe('setAspect')
  })
})

describe('localDirect', () => {
  const P = baseProject()
  it('parses aspect', () => {
    expect(localDirect(P, 'mach es hochkant', 'scene1')?.ops[0]).toEqual({ op: 'setAspect', aspect: '9:16' })
    expect(localDirect(P, 'make it 1:1', 'scene1')?.ops[0]).toEqual({ op: 'setAspect', aspect: '1:1' })
  })
  it('parses accent colour (word + hex)', () => {
    expect(localDirect(P, 'accent blau', 'scene1')?.ops[0]).toEqual({ op: 'setBrand', accent: '#7ab8ff' })
    expect(localDirect(P, 'use #ff0000', 'scene1')?.ops[0]).toEqual({ op: 'setBrand', accent: '#ff0000' })
  })
  it('parses "make the headline bigger" into element size bumps', () => {
    const patch = localDirect(P, 'mach die headline größer', 'scene1')
    expect(patch?.ops.some((o) => o.op === 'setElement' && o.props.size === 'lg')).toBe(true)
  })
  it('parses duration + beat sync + music volume', () => {
    expect(localDirect(P, '0.8s länger', 'scene1')?.ops[0]).toMatchObject({ op: 'setScene', duration: 5.8 })
    expect(localDirect(P, 'leg den klick auf den starken beat', 'scene1')?.ops[0]).toEqual({ op: 'alignToBeat', sceneId: 'scene1', strongOnly: true })
    expect(localDirect(P, 'musik auf 50%', 'scene1')?.ops[0]).toEqual({ op: 'setAudio', volume: 0.5 })
  })
  it('returns null for anything it does not understand', () => {
    expect(localDirect(P, 'add a cinematic parallax hero with three product shots', 'scene1')).toBeNull()
  })
})
