/**
 * Apparel colour palette + name→hex resolution. Turns a vision-detected colour name ("red",
 * "navy", "cream") into a concrete hex the renderer paints, and provides the swatch set the
 * region inspector offers. Kept muted/tasteful so coloured technical flats still read as flats.
 */
export type ColorSwatch = { name: string; hex: string }

export const COLOR_SWATCHES: ColorSwatch[] = [
  { name: 'White', hex: '#F4F4F2' },
  { name: 'Cream', hex: '#EDE6D6' },
  { name: 'Grey', hex: '#9AA0A6' },
  { name: 'Charcoal', hex: '#3A3D42' },
  { name: 'Black', hex: '#1A1A1D' },
  { name: 'Red', hex: '#C0392B' },
  { name: 'Maroon', hex: '#7B241C' },
  { name: 'Orange', hex: '#E8763A' },
  { name: 'Yellow', hex: '#E9C245' },
  { name: 'Tan', hex: '#C2A878' },
  { name: 'Green', hex: '#3F7D5A' },
  { name: 'Olive', hex: '#6B6B3A' },
  { name: 'Teal', hex: '#2E7D80' },
  { name: 'Blue', hex: '#2E5FA3' },
  { name: 'Navy', hex: '#20304F' },
  { name: 'Purple', hex: '#6A4C93' },
  { name: 'Pink', hex: '#D98BA6' },
  { name: 'Brown', hex: '#6E4B33' },
]

const ALIASES: Record<string, string> = {
  gray: 'grey', silver: 'grey', ivory: 'cream', 'off-white': 'cream', offwhite: 'cream',
  crimson: 'red', scarlet: 'red', burgundy: 'maroon', wine: 'maroon', cherry: 'red',
  gold: 'yellow', mustard: 'yellow', beige: 'tan', khaki: 'tan', camel: 'tan', sand: 'tan',
  forest: 'green', emerald: 'green', lime: 'green', mint: 'green',
  royal: 'blue', denim: 'blue', sky: 'blue', cobalt: 'blue',
  violet: 'purple', lavender: 'purple', magenta: 'pink', rose: 'pink', chocolate: 'brown', coffee: 'brown',
}

/** Resolve a colour name or hex string to a hex value; undefined if unrecognised. */
export function colorToHex(value?: string): string | undefined {
  if (!value) return undefined
  const raw = value.trim().toLowerCase()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(raw)) return value.trim()
  const key = ALIASES[raw] ?? raw
  const exact = COLOR_SWATCHES.find((s) => s.name.toLowerCase() === key)
  if (exact) return exact.hex
  // Last resort: the name contains a known colour word ("dark red", "light blue").
  const contained = COLOR_SWATCHES.find((s) => raw.includes(s.name.toLowerCase()))
  return contained?.hex
}
