// Presentation Mode — built-in, luxury demo content. 100% local, zero APIs, instant.
//
// Nothing here touches the real store or garment catalog — it is presentation-owned data used
// only by the scripted keynote and demo overlays. Kept deliberately isolated from src/suite/data
// types so production models can evolve without ever affecting the show.

export type DemoGarmentGlyph = 'hoodie' | 'tee' | 'bomber' | 'puffer'

export type DemoGarment = {
  id: string
  name: string
  line: string
  price: string
  glyph: DemoGarmentGlyph
  /** Two-stop gradient for the card backdrop. */
  gradient: [string, string]
  /** The garment silhouette fill. */
  fabric: string
}

export type DemoGraphic = {
  id: string
  name: string
  gradient: [string, string]
  /** A compact SVG inner motif (drawn on a 0 0 100 100 viewBox). */
  motif: string
}

export type DemoMockup = { id: string; label: string; gradient: [string, string]; glyph: DemoGarmentGlyph }

export type DemoTechSection = { id: string; title: string; rows: Array<{ label: string; value: string }> }

export type DemoManufacturer = {
  id: string
  name: string
  city: string
  country: string
  flag: string
  rating: number
  moq: number
  leadDays: number
  capability: string
  priceFrom: string
}

export type DemoColor = { id: string; name: string; hex: string }

// ── Garment silhouettes (fill-only paths on a 0 0 200 200 viewBox) ─────────────────────────────
export const DEMO_GARMENT_PATHS: Record<DemoGarmentGlyph, string> = {
  hoodie:
    'M70 34c0-9 12-15 30-15s30 6 30 15l24 12 14 30-20 12-8-6v62c0 6-4 9-10 9H70c-6 0-10-3-10-9v-62l-8 6-20-12 14-30zM82 34c0 10 8 17 18 17s18-7 18-17',
  tee: 'M64 40 42 56l14 26 16-8v72c0 6 4 9 10 9h36c6 0 10-3 10-9V74l16 8 14-26-22-16-18-8h-24z',
  bomber:
    'M66 40 44 54l12 26 14-6v70c0 6 4 9 10 9h40c6 0 10-3 10-9V74l14 6 12-26-22-14-20-6-10 10-8-10zM98 46l4 108',
  puffer:
    'M70 38 46 54l12 26 12-5v68c0 6 4 9 10 9h40c6 0 10-3 10-9V75l12 5 12-26-24-16-18-6h-24zM74 70h52M74 92h52M74 114h52M74 136h52',
}

// ── Scene 3: the luxury streetwear collection (created "instantly") ─────────────────────────────
export const DEMO_COLLECTION: DemoGarment[] = [
  {
    id: 'g-hoodie',
    name: 'Atelier Oversized Hoodie',
    line: 'Heavyweight 480gsm loopback',
    price: '$189',
    glyph: 'hoodie',
    gradient: ['#20202b', '#101016'],
    fabric: '#e9e6df',
  },
  {
    id: 'g-tee',
    name: 'Monolith Heavyweight Tee',
    line: 'Boxy 260gsm compact cotton',
    price: '$95',
    glyph: 'tee',
    gradient: ['#26262f', '#111117'],
    fabric: '#d8d4cb',
  },
  {
    id: 'g-bomber',
    name: 'Nightfall Bomber Jacket',
    line: 'Matte technical shell',
    price: '$320',
    glyph: 'bomber',
    gradient: ['#1b1c24', '#0c0d12'],
    fabric: '#2c2f3a',
  },
  {
    id: 'g-puffer',
    name: 'Glacier Down Puffer',
    line: 'Baffled 700-fill down',
    price: '$410',
    glyph: 'puffer',
    gradient: ['#232430', '#0e0f15'],
    fabric: '#c9cdd6',
  },
]

// ── Scene 5: four premium graphics for "Chrome tribal butterfly" ────────────────────────────────
export const DEMO_GRAPHICS: DemoGraphic[] = [
  {
    id: 'gr-1',
    name: 'Chrome Butterfly / Liquid',
    gradient: ['#3a3f4c', '#14161d'],
    motif:
      '<path d="M50 20c-10 8-26 6-32 22 8 10 22 6 32 18 10-12 24-8 32-18-6-16-22-14-32-22Z" fill="url(#chrome)"/><path d="M50 24v52" stroke="#0b0b10" stroke-width="2"/>',
  },
  {
    id: 'gr-2',
    name: 'Chrome Butterfly / Etched',
    gradient: ['#4a4033', '#17130d'],
    motif:
      '<path d="M50 22c-9 7-24 6-30 20 7 9 21 6 30 16 9-10 23-7 30-16-6-14-21-13-30-20Z" fill="none" stroke="url(#chrome)" stroke-width="3"/>',
  },
  {
    id: 'gr-3',
    name: 'Chrome Butterfly / Solid',
    gradient: ['#2f3b3a', '#0d1413'],
    motif:
      '<path d="M50 18c-11 9-28 7-34 24 9 11 24 7 34 20 10-13 25-9 34-20-6-17-23-15-34-24Z" fill="url(#chrome)"/>',
  },
  {
    id: 'gr-4',
    name: 'Chrome Butterfly / Outline',
    gradient: ['#3b3446', '#140f19'],
    motif:
      '<path d="M50 22c-9 7-24 6-30 20 7 9 21 6 30 16 9-10 23-7 30-16-6-14-21-13-30-20Z" fill="none" stroke="url(#chrome)" stroke-width="2"/><circle cx="50" cy="50" r="3" fill="url(#chrome)"/>',
  },
]

// ── Scene 7: premium recolour sequence ──────────────────────────────────────────────────────────
export const DEMO_COLORS: DemoColor[] = [
  { id: 'c-black', name: 'Onyx Black', hex: '#15151b' },
  { id: 'c-white', name: 'Bone White', hex: '#ece9e2' },
  { id: 'c-olive', name: 'Field Olive', hex: '#585e42' },
  { id: 'c-cream', name: 'Vintage Cream', hex: '#d9cfb8' },
]

// ── Scene 8: mockups ────────────────────────────────────────────────────────────────────────────
export const DEMO_MOCKUPS: DemoMockup[] = [
  { id: 'm-front', label: 'Front', gradient: ['#22222c', '#101016'], glyph: 'hoodie' },
  { id: 'm-back', label: 'Back', gradient: ['#20202a', '#0e0e14'], glyph: 'hoodie' },
  { id: 'm-life', label: 'Lifestyle', gradient: ['#2a2620', '#131009'], glyph: 'hoodie' },
  { id: 'm-studio', label: 'Studio', gradient: ['#1d2026', '#0b0d11'], glyph: 'hoodie' },
]

// ── Scene 9: tech pack ──────────────────────────────────────────────────────────────────────────
export const DEMO_TECHPACK: DemoTechSection[] = [
  {
    id: 'measure',
    title: 'Measurements',
    rows: [
      { label: 'Chest (M)', value: '60 cm' },
      { label: 'Body length', value: '72 cm' },
      { label: 'Sleeve length', value: '64 cm' },
    ],
  },
  {
    id: 'construction',
    title: 'Construction',
    rows: [
      { label: 'Seams', value: 'Double-needle' },
      { label: 'Cuffs', value: '2×2 rib, elastane' },
      { label: 'Finish', value: 'Enzyme wash' },
    ],
  },
  {
    id: 'materials',
    title: 'Materials',
    rows: [
      { label: 'Main', value: '480gsm loopback' },
      { label: 'Fibre', value: '92% cotton / 8% PES' },
      { label: 'Trims', value: 'YKK / woven label' },
    ],
  },
  {
    id: 'pantone',
    title: 'Pantone',
    rows: [
      { label: 'Body', value: 'PANTONE 19-4005' },
      { label: 'Print', value: 'Chrome silver 877C' },
    ],
  },
  {
    id: 'print',
    title: 'Print Areas',
    rows: [
      { label: 'Front', value: '28 × 34 cm' },
      { label: 'Back', value: '32 × 40 cm' },
    ],
  },
  {
    id: 'accessories',
    title: 'Accessories',
    rows: [
      { label: 'Drawcord', value: 'Flat 8mm, metal tip' },
      { label: 'Eyelets', value: 'Antique brass' },
    ],
  },
]

// ── Scene 10: manufacturers ─────────────────────────────────────────────────────────────────────
export const DEMO_MANUFACTURERS: DemoManufacturer[] = [
  { id: 'mf-1', name: 'Ateliê Porto', city: 'Porto', country: 'Portugal', flag: '🇵🇹', rating: 4.9, moq: 50, leadDays: 21, capability: 'Cut & Sew', priceFrom: '$14' },
  { id: 'mf-2', name: 'Egeo Knit Co.', city: 'Izmir', country: 'Turkey', flag: '🇹🇷', rating: 4.8, moq: 100, leadDays: 25, capability: 'Knitwear', priceFrom: '$11' },
  { id: 'mf-3', name: 'Milano Capi', city: 'Milan', country: 'Italy', flag: '🇮🇹', rating: 5.0, moq: 30, leadDays: 28, capability: 'Outerwear', priceFrom: '$29' },
  { id: 'mf-4', name: 'Saigon Craft', city: 'Ho Chi Minh', country: 'Vietnam', flag: '🇻🇳', rating: 4.7, moq: 150, leadDays: 24, capability: 'Cut & Sew', priceFrom: '$9' },
]
