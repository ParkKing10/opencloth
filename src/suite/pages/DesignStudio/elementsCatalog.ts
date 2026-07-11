/**
 * Elements catalog — the built-in vector library that replaces the old Materials tab. Each element
 * is a named inline SVG (0–100 viewBox, drawn with `currentColor`) that merges into GRAPHIC_MARKS,
 * so clicking one drops a normal `graphic` CanvasObject and inherits every Studio behaviour
 * (layers, move/scale/rotate, recolour, undo, export) for free.
 *
 * These are the NEW marks only; the original starter marks (Star, Flame, Smiley, Barcode, Lightning,
 * Globe…) already live in objectModel's GRAPHIC_MARKS and are referenced by name in ELEMENT_GROUPS.
 * The catalog is a single data file so the set is trivial to extend (admin-curated for all users).
 */
export const ELEMENT_MARKS: Record<string, string> = {
  // Shapes
  Circle: '<circle cx="50" cy="50" r="40" fill="currentColor"/>',
  Square: '<rect x="14" y="14" width="72" height="72" rx="4" fill="currentColor"/>',
  Triangle: '<path d="M50 14 86 84 14 84Z" fill="currentColor"/>',
  Diamond: '<path d="M50 10 88 50 50 90 12 50Z" fill="currentColor"/>',
  Pentagon: '<path d="M50 10 89 39 74 85 26 85 11 39Z" fill="currentColor"/>',
  Hexagon: '<path d="M30 14 70 14 90 50 70 86 30 86 10 50Z" fill="currentColor"/>',
  Heart: '<path d="M50 86C18 64 10 44 20 30c8-11 24-9 30 4 6-13 22-15 30-4 10 14 2 34-30 56Z" fill="currentColor"/>',
  Plus: '<path d="M40 10h20v30h30v20H60v30H40V60H10V40h30Z" fill="currentColor"/>',
  // Stars & sparkles
  Sparkle: '<path d="M50 6C54 30 70 46 94 50 70 54 54 70 50 94 46 70 30 54 6 50 30 46 46 30 50 6Z" fill="currentColor"/>',
  '4-Point': '<path d="M50 10 58 42 90 50 58 58 50 90 42 58 10 50 42 42Z" fill="currentColor"/>',
  Starburst:
    '<path d="M50 4 57 26 74 12 68 34 92 32 73 48 96 58 71 60 84 82 60 73 58 96 47 74 30 90 34 66 10 70 28 52 6 42 30 40 20 18 42 30Z" fill="currentColor"/>',
  // Arrows
  'Arrow Right': '<path d="M8 40h44V22l40 28-40 28V60H8Z" fill="currentColor"/>',
  'Arrow Up': '<path d="M40 92V48H22l28-40 28 40H60v44Z" fill="currentColor"/>',
  Chevron: '<path d="M34 18 66 50 34 82" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>',
  'Curved Arrow':
    '<path d="M18 74C18 44 40 26 72 26" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/><path d="M60 12 82 26 60 40Z" fill="currentColor"/>',
  // Badges & seals
  Ring: '<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="10"/>',
  Shield: '<path d="M50 8 84 20V48C84 72 68 86 50 92 32 86 16 72 16 48V20Z" fill="currentColor"/>',
  Check:
    '<circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="7"/><path d="M33 51 45 64 68 36" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>',
  Award:
    '<circle cx="50" cy="38" r="26" fill="none" stroke="currentColor" stroke-width="8"/><path d="M38 60 30 92 50 80 70 92 62 60" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>',
  Crown: '<path d="M16 74 10 30 34 48 50 20 66 48 90 30 84 74Z" fill="currentColor"/>',
  // Streetwear
  Skull:
    '<path fill-rule="evenodd" fill="currentColor" d="M50 10C28 10 15 26 15 46c0 12 6 19 11 23v13h9v-8h5v10h20v-10h5v8h9V69c5-4 11-11 11-23 0-20-13-36-35-36ZM37 40a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm26 0a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z"/>',
  Splatter:
    '<g fill="currentColor"><circle cx="50" cy="52" r="22"/><circle cx="22" cy="30" r="8"/><circle cx="78" cy="34" r="10"/><circle cx="28" cy="76" r="7"/><circle cx="76" cy="72" r="9"/><circle cx="50" cy="88" r="5"/><circle cx="88" cy="54" r="4"/></g>',
  Peace:
    '<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="8"/><path d="M50 12v76M50 50 24 74M50 50 76 74" fill="none" stroke="currentColor" stroke-width="8"/>',
  Eye:
    '<path d="M8 50C22 30 78 30 92 50 78 70 22 70 8 50Z" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="50" cy="50" r="13" fill="currentColor"/>',
  // Frames & banners
  'Circle Frame': '<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="6"/>',
  'Square Frame': '<rect x="12" y="12" width="76" height="76" fill="none" stroke="currentColor" stroke-width="6"/>',
  'Rounded Frame': '<rect x="12" y="12" width="76" height="76" rx="16" fill="none" stroke="currentColor" stroke-width="6"/>',
  Banner: '<path d="M18 20h64v46l-16-11-16 11-16-11-16 11Z" fill="currentColor"/>',
  Tag: '<path fill-rule="evenodd" fill="currentColor" d="M14 32c0-3 2-5 5-5h34l24 23-24 23H19c-3 0-5-2-5-5ZM30 44a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"/>',
}

export type ElementGroup = { title: string; items: readonly string[] }

/** How the Elements panel is organised. Item names resolve through the merged GRAPHIC_MARKS. */
export const ELEMENT_GROUPS: readonly ElementGroup[] = [
  { title: 'Shapes', items: ['Circle', 'Square', 'Triangle', 'Diamond', 'Pentagon', 'Hexagon', 'Heart', 'Plus'] },
  { title: 'Stars & Sparkles', items: ['Star', 'Sparkle', '4-Point', 'Starburst'] },
  { title: 'Arrows', items: ['Arrow Right', 'Arrow Up', 'Chevron', 'Curved Arrow'] },
  { title: 'Badges & Seals', items: ['Ring', 'Shield', 'Check', 'Award', 'Crown'] },
  { title: 'Streetwear', items: ['Flame', 'Lightning', 'Skull', 'Splatter', 'Peace', 'Smiley', 'Barcode', 'Eye'] },
  { title: 'Frames & Banners', items: ['Circle Frame', 'Square Frame', 'Rounded Frame', 'Banner', 'Tag'] },
]
