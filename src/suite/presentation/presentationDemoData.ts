// Presentation Mode — the single-hoodie spot's assets. 100% local, instant.
//
// Everything the keynote touches lives here: the one real hoodie, the AI model-mockup payoff shot,
// the chrome tribal butterfly print, the "washed black" recolour, and the distress rips.

import hoodieImg from '../../assets/presentation/hoodie.webp'
import modelImg from '../../assets/presentation/model-mockup.webp'

/** The one hoodie the whole spot is about — a real cut-out product shot. */
export const HOODIE_IMG = hoodieImg
/** Scene 6 payoff — the finished hoodie worn by a model (AI-generated editorial shot). */
export const MODEL_IMG = modelImg

/** Scene 5 — "washed black". A near-black wash colour-blended onto the garment. */
export const WASHED_BLACK = '#16161a'

/** Scene 4 — the chrome tribal butterfly print (SVG motif on a 0 0 100 100 viewBox, chrome fill). */
export const BUTTERFLY_MOTIF =
  '<path d="M50 20c-10 8-26 6-32 22 8 10 22 6 32 18 10-12 24-8 32-18-6-16-22-14-32-22Z" fill="url(#pmchrome)"/><path d="M50 24v52" stroke="rgba(11,11,16,0.85)" stroke-width="2"/>'

/** Scene 3 — distress rips placed on the hoodie (percent positions + a size scale). */
export type DistressHole = { id: string; x: string; y: string; scale: number; rot: number }
export const DISTRESS_HOLES: DistressHole[] = [
  { id: 'h1', x: '38%', y: '64%', scale: 1, rot: -12 },
  { id: 'h2', x: '62%', y: '58%', scale: 0.8, rot: 20 },
  { id: 'h3', x: '52%', y: '78%', scale: 1.15, rot: -4 },
]
