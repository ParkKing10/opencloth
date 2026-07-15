/**
 * Marketing Studio template registry. Every card on Home/Templates is one of these; the
 * generator uses `output` to decide what it produces (photo shoot vs. video storyboard vs.
 * content plan) and `scaffold`/`scenePlan` to steer the engine. Copy lives in the
 * marketingStudio locale under `mk.tpl.<id>.title` / `.tag`.
 */

export type MkTemplateOutput = 'photo' | 'storyboard' | 'plan'
export type MkTemplateCategory = 'social' | 'commercial' | 'photo' | 'launch'

export type MkTemplate = {
  id: string
  category: MkTemplateCategory
  output: MkTemplateOutput
  /** Aspect the content targets — drives the preview card art + generated image size. */
  format: '9:16' | '16:9' | '1:1' | '4:5'
  /** Visual theme of the animated preview card (marketing.css: .mkcard--<look>). */
  look: 'volt' | 'noir' | 'blush' | 'ocean' | 'ember' | 'jade'
  /** Whether a character adds value (UGC/founder formats basically require one). */
  wantsCharacter: 'required' | 'optional' | 'none'
  /** English scaffold appended to the user's prompt when building generation prompts. */
  scaffold: string
  /** Scene beats for storyboard templates (keys into the engine's beat library). */
  beats?: string[]
  featured?: boolean
}

export const MK_TEMPLATES: MkTemplate[] = [
  // ── Social video ──
  { id: 'tiktok-hook', category: 'social', output: 'storyboard', format: '9:16', look: 'volt', wantsCharacter: 'required', featured: true,
    scaffold: 'fast-paced vertical TikTok ad, punchy hook in the first second, handheld energy, jump cuts',
    beats: ['hook', 'wear', 'detail', 'cta'] },
  { id: 'ugc-video', category: 'social', output: 'storyboard', format: '9:16', look: 'blush', wantsCharacter: 'required', featured: true,
    scaffold: 'authentic UGC-style selfie video, natural light, honest talking-to-camera review energy',
    beats: ['selfie-intro', 'tryon', 'detail', 'verdict-cta'] },
  { id: 'instagram-reel', category: 'social', output: 'storyboard', format: '9:16', look: 'blush', wantsCharacter: 'optional',
    scaffold: 'aesthetic Instagram reel, smooth transitions, trending-audio pacing, clean color grade',
    beats: ['mood-open', 'wear', 'transition', 'cta'] },
  { id: 'youtube-short', category: 'social', output: 'storyboard', format: '9:16', look: 'ocean', wantsCharacter: 'optional',
    scaffold: 'YouTube Short with a strong narrative hook, captions on screen, quick payoff',
    beats: ['hook', 'story', 'payoff', 'cta'] },
  { id: 'street-interview', category: 'social', output: 'storyboard', format: '9:16', look: 'jade', wantsCharacter: 'required',
    scaffold: 'street interview format, mic in frame, candid city backdrop, real reactions',
    beats: ['question', 'reaction', 'reveal', 'cta'] },
  { id: 'before-after', category: 'social', output: 'storyboard', format: '9:16', look: 'ember', wantsCharacter: 'optional',
    scaffold: 'before/after transformation edit with a hard cut on the beat',
    beats: ['before', 'snap', 'after', 'cta'] },
  { id: 'unboxing', category: 'social', output: 'storyboard', format: '9:16', look: 'volt', wantsCharacter: 'optional',
    scaffold: 'satisfying unboxing, close-up hands, crisp packaging sounds, slow reveal',
    beats: ['box', 'open', 'reveal', 'tryon-cta'] },
  { id: 'behind-the-scenes', category: 'social', output: 'storyboard', format: '9:16', look: 'noir', wantsCharacter: 'optional',
    scaffold: 'behind-the-scenes documentary feel, raw studio moments, honest process shots',
    beats: ['process', 'craft', 'human', 'cta'] },

  // ── Commercial ──
  { id: 'luxury-commercial', category: 'commercial', output: 'storyboard', format: '16:9', look: 'noir', wantsCharacter: 'optional', featured: true,
    scaffold: 'cinematic luxury fashion commercial, slow dolly moves, dramatic rim lighting, editorial grade',
    beats: ['atmosphere', 'reveal', 'wear', 'logo-cta'] },
  { id: 'product-reveal', category: 'commercial', output: 'storyboard', format: '16:9', look: 'ember', wantsCharacter: 'none', featured: true,
    scaffold: 'dramatic product reveal, macro details, light sweep across fabric, deep shadows',
    beats: ['tease', 'macro', 'reveal', 'logo-cta'] },
  { id: 'founder-story', category: 'commercial', output: 'storyboard', format: '16:9', look: 'jade', wantsCharacter: 'required',
    scaffold: 'founder story mini-documentary, warm interview light, b-roll of the craft',
    beats: ['origin', 'struggle', 'craft', 'vision-cta'] },
  { id: 'app-trailer', category: 'commercial', output: 'storyboard', format: '16:9', look: 'ocean', wantsCharacter: 'none',
    scaffold: 'sleek product trailer, UI-forward, kinetic typography, gradient glow backgrounds',
    beats: ['problem', 'demo', 'wow', 'cta'] },
  { id: 'ai-demo', category: 'commercial', output: 'storyboard', format: '16:9', look: 'volt', wantsCharacter: 'none',
    scaffold: 'AI capability demo, screen-in-scene, before/after generations, futuristic minimalism',
    beats: ['prompt', 'generate', 'result', 'cta'] },

  // ── Photo ──
  { id: 'luxury-fashion-ad', category: 'photo', output: 'photo', format: '4:5', look: 'noir', wantsCharacter: 'optional', featured: true,
    scaffold: 'high-fashion luxury campaign photograph, editorial lighting, premium magazine quality' },
  { id: 'shopify-product-ad', category: 'photo', output: 'photo', format: '1:1', look: 'ocean', wantsCharacter: 'none',
    scaffold: 'clean e-commerce product photograph, soft studio light, seamless background, conversion-optimized' },
  { id: 'fashion-campaign', category: 'photo', output: 'photo', format: '4:5', look: 'blush', wantsCharacter: 'optional',
    scaffold: 'full fashion campaign photograph, styled set, art-directed color story' },

  // ── Launch ──
  { id: 'collection-launch', category: 'launch', output: 'storyboard', format: '9:16', look: 'ember', wantsCharacter: 'optional', featured: true,
    scaffold: 'collection launch film, piece-by-piece lookbook rhythm, date card ending',
    beats: ['tease', 'lookbook', 'hero-piece', 'date-cta'] },
  { id: 'new-drop', category: 'launch', output: 'storyboard', format: '9:16', look: 'volt', wantsCharacter: 'optional',
    scaffold: 'hype new-drop announcement, countdown energy, flash cuts, bold type',
    beats: ['countdown', 'flash', 'wear', 'drop-cta'] },
  { id: 'flash-sale', category: 'launch', output: 'storyboard', format: '9:16', look: 'ember', wantsCharacter: 'none',
    scaffold: 'urgent flash-sale promo, bold percentage type, ticking-clock pacing',
    beats: ['alarm', 'offer', 'pieces', 'urgency-cta'] },

  // ── Bulk plan ──
  { id: 'content-calendar', category: 'launch', output: 'plan', format: '9:16', look: 'jade', wantsCharacter: 'none', featured: true,
    scaffold: '30-day social content plan' },
]

export function mkTemplate(id: string): MkTemplate | undefined {
  return MK_TEMPLATES.find((t) => t.id === id)
}

export const MK_PHOTO_STYLES = ['studio', 'luxury', 'street', 'minimal', 'outdoor', 'gym', 'lifestyle', 'editorial'] as const
export type MkPhotoStyle = (typeof MK_PHOTO_STYLES)[number]
