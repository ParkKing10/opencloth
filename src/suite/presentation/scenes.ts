// Presentation Mode — the ~15s "talk to your clothing" spot.
//
// ONE hoodie, six prompts. Each prompt transforms the SAME hoodie live — it is never replaced or
// regenerated. The whole thing sells a single feeling: you describe what you want, and the garment
// changes in real time. No other features, no distractions.

export type TxKind =
  | 'create' // the hoodie materialises
  | 'oversized' // the same hoodie grows / boxier
  | 'holes' // distressed rips appear on it
  | 'butterfly' // a chrome tribal butterfly print lands on the chest
  | 'color' // it recolours to washed black
  | 'mockup' // seamless cut to the finished hoodie on a model

export type Scene = { id: number; prompt: string; apply: TxKind }

export const SCENES: Scene[] = [
  { id: 1, prompt: 'Create an oversized luxury hoodie', apply: 'create' },
  { id: 2, prompt: 'Make it oversized', apply: 'oversized' },
  { id: 3, prompt: 'Add distressed holes', apply: 'holes' },
  { id: 4, prompt: 'Add chrome tribal butterfly', apply: 'butterfly' },
  { id: 5, prompt: 'Change color to washed black', apply: 'color' },
  { id: 6, prompt: 'Generate realistic mockup', apply: 'mockup' },
]
