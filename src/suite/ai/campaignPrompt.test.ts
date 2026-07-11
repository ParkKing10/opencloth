import { describe, it, expect } from 'vitest'
import { campaignPrompt, campaignImageParams, CAMPAIGN_MODELS, DEFAULT_CAMPAIGN, type CampaignSelection } from './campaignPrompt'

describe('campaignPrompt', () => {
  it('always instructs the model to preserve the garment exactly', () => {
    const p = campaignPrompt(DEFAULT_CAMPAIGN)
    expect(p.toLowerCase()).toContain('exact garment shown in the reference')
    expect(p.toLowerCase()).toContain('preserve')
    expect(p.toLowerCase()).toContain('do not redesign')
    expect(p.toLowerCase()).toContain('generate only the person')
  })

  it('reflects the chosen model, pose and scene', () => {
    const sel: CampaignSelection = { modelId: 'runway', pose: 'Back', style: 'Luxury', background: 'Black', lighting: 'Dramatic', quality: 'ultra' }
    const p = campaignPrompt(sel)
    expect(p).toContain('runway model')
    expect(p.toLowerCase()).toContain('from behind') // Back pose exposes the back of the garment
    expect(p.toLowerCase()).toContain('black studio backdrop')
    expect(p.toLowerCase()).toContain('dramatic lighting')
  })

  it('every model builds a prompt without throwing', () => {
    for (const m of CAMPAIGN_MODELS) {
      const p = campaignPrompt({ ...DEFAULT_CAMPAIGN, modelId: m.id })
      expect(p.length).toBeGreaterThan(80)
    }
  })

  it('image params are portrait, quality-tiered, transparent only when asked', () => {
    expect(campaignImageParams(DEFAULT_CAMPAIGN).size).toBe('1024x1536')
    expect(campaignImageParams({ ...DEFAULT_CAMPAIGN, quality: 'ultra' }).quality).toBe('high')
    expect(campaignImageParams({ ...DEFAULT_CAMPAIGN, quality: 'fast' }).quality).toBe('low')
    expect(campaignImageParams({ ...DEFAULT_CAMPAIGN, background: 'Transparent' }).background).toBe('transparent')
    expect(campaignImageParams({ ...DEFAULT_CAMPAIGN, background: 'Studio' }).background).toBe('opaque')
  })
})
