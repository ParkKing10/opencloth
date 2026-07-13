// Presentation Mode — built-in, luxury demo content. 100% local, zero APIs, instant.
//
// The garments are REAL LOOM STUDIOS product shots (shot on black, so they blend into the dark
// keynote stage). Nothing here touches the real store or garment catalog — it is presentation-owned
// data used only by the scripted keynote.

import hoodieImg from '../../assets/presentation/hoodie.webp'
import sweatshirtImg from '../../assets/presentation/sweatshirt.webp'
import pufferImg from '../../assets/presentation/puffer.webp'
import leatherImg from '../../assets/presentation/leather-jacket.webp'
import overcoatImg from '../../assets/presentation/overcoat.webp'

export type DemoGarment = {
  id: string
  name: string
  line: string
  price: string
  /** Real product-shot URL (shot on black). */
  image: string
}

export type DemoGraphic = {
  id: string
  name: string
  gradient: [string, string]
  /** A compact SVG inner motif (drawn on a 0 0 100 100 viewBox). */
  motif: string
}

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

/** A recolour swatch. Kept to DARK tones so tinting a real (dark) product photo stays believable. */
export type DemoColor = { id: string; name: string; hex: string }

// ── Scene 3: the luxury streetwear collection (created "instantly") ─────────────────────────────
export const DEMO_COLLECTION: DemoGarment[] = [
  { id: 'g-hoodie', name: 'Atelier Oversized Hoodie', line: 'Heavyweight 480gsm loopback', price: '$189', image: hoodieImg },
  { id: 'g-sweat', name: 'Varsity Heavyweight Crew', line: 'Boxy 420gsm brushed-back', price: '$145', image: sweatshirtImg },
  { id: 'g-puffer', name: 'Glacier Down Puffer', line: 'Baffled 700-fill, olive', price: '$410', image: pufferImg },
  { id: 'g-leather', name: 'Vandal Leather Biker', line: 'Washed lamb nappa', price: '$690', image: leatherImg },
]

/** Scene 8 — the full range as studio-ready mockups (adds the overcoat). */
export const DEMO_LOOKBOOK: DemoGarment[] = [
  ...DEMO_COLLECTION,
  { id: 'g-coat', name: 'Camden Wool Overcoat', line: 'Italian melton, navy', price: '$540', image: overcoatImg },
]

/** The hero garment carried through scenes 4–7 (select → graphic → drag → recolour). */
export const DEMO_HERO = DEMO_COLLECTION[0]

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

// ── Scene 7: premium recolour sequence (dark tones — believable on a real product photo) ─────────
export const DEMO_COLORS: DemoColor[] = [
  { id: 'c-black', name: 'Onyx Black', hex: '#141418' },
  { id: 'c-olive', name: 'Field Olive', hex: '#565f3c' },
  { id: 'c-burg', name: 'Oxblood', hex: '#5a2230' },
  { id: 'c-navy', name: 'Midnight Navy', hex: '#26324f' },
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
