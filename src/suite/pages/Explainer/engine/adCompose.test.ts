import { describe, expect, it } from 'vitest'
import { adOutputDuration, footageLayout, mapOutputToSource, DEFAULT_AD_CONFIG } from './adCompose'
import type { AdPlan } from './adPlan'

const cfg = { ...DEFAULT_AD_CONFIG, intro: 1, outro: 2, headline: 'Hi' }

// Body: two clips. Clip A 0–4s at 1× (4s out). Clip B 4–8s at 4× (1s out). Body = 5s out.
const plan: AdPlan = {
  clips: [
    { video: 0, start: 0, end: 4, speed: 1, focus: 2 },
    { video: 0, start: 4, end: 8, speed: 4 },
  ],
  story: [],
  cutDuration: 5,
  deadTrimmed: 0,
}

describe('mapOutputToSource', () => {
  it('total output = intro + body + outro', () => {
    expect(adOutputDuration(plan, cfg)).toBeCloseTo(1 + 5 + 2)
  })

  it('shows the intro card first', () => {
    const m = mapOutputToSource(plan, cfg, 0.5)
    expect(m.section).toBe('intro')
    if (m.section === 'intro') expect(m.p).toBeCloseTo(0.5)
  })

  it('maps body time into the correct clip + source time', () => {
    // 1s intro; at out=3 → bodyT=2 → inside clip A (1× ), srcTime≈2.
    const a = mapOutputToSource(plan, cfg, 3)
    expect(a.section).toBe('body')
    if (a.section === 'body') {
      expect(a.clip).toBe(0)
      expect(a.srcTime).toBeCloseTo(2)
      expect(a.focus).toBeCloseTo(2)
    }
    // out=5.5 → bodyT=4.5 → clip B, 0.5 of 1s out → src 4 + 0.5*4 = 6.
    const b = mapOutputToSource(plan, cfg, 5.5)
    expect(b.section).toBe('body')
    if (b.section === 'body') {
      expect(b.clip).toBe(1)
      expect(b.srcTime).toBeCloseTo(6)
    }
  })

  it('shows the outro card after the body', () => {
    const m = mapOutputToSource(plan, cfg, 6.5) // intro1 + body5 = 6; +0.5 into outro
    expect(m.section).toBe('outro')
    if (m.section === 'outro') expect(m.p).toBeCloseTo(0.25)
  })
})

describe('footageLayout', () => {
  it('landscape output: footage covers the whole frame', () => {
    const l = footageLayout(1920, 1080, 1920, 1080)
    expect(l.cover).toBe(true)
    expect(l.w).toBe(1920)
    expect(l.h).toBe(1080)
  })

  it('TikTok 9:16: a landscape screencast becomes a width-fitted card, aspect preserved', () => {
    const l = footageLayout(1080, 1920, 1920, 1080)
    expect(l.cover).toBe(false)
    expect(l.w).toBeCloseTo(1080 * 0.92)
    expect(l.w / l.h).toBeCloseTo(1920 / 1080)
    // fully inside the frame, sitting above centre
    expect(l.x).toBeGreaterThanOrEqual(0)
    expect(l.y).toBeGreaterThan(0)
    expect(l.y + l.h).toBeLessThan(1920)
  })

  it('caps very tall sources at 64% of the frame height', () => {
    const l = footageLayout(1080, 1920, 1080, 1920) // portrait source in portrait frame
    expect(l.cover).toBe(false)
    expect(l.h).toBeCloseTo(1920 * 0.64)
    expect(l.w / l.h).toBeCloseTo(1080 / 1920)
  })

  it('square output also uses the card layout', () => {
    const l = footageLayout(1080, 1080, 1920, 1080)
    expect(l.cover).toBe(false)
    expect(l.w).toBeCloseTo(1080 * 0.92)
  })
})
