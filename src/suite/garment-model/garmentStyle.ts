/**
 * The single mandatory visual language for every loom studios garment: a professional apparel
 * TECHNICAL FLAT. White garment, black outlines, one consistent stroke system, subtle grey
 * shading only. Encoded as tokens so hand-authored fixtures AND the future AI worker conform
 * to exactly one style — never glossy, photographic, painterly, 3D, or sketch.
 *
 * Style is applied by the renderer from each shape's `role`; shapes never carry arbitrary
 * colors. That makes an off-style garment structurally impossible, not merely discouraged.
 */
export type GarmentStyleId = 'tech-flat'

/** The role a vector shape plays in the flat. The renderer maps role → stroke/fill tokens. */
export type ShapeRole = 'fill' | 'outline' | 'seam' | 'stitch' | 'detail'

export const TECH_FLAT = {
  id: 'tech-flat' as GarmentStyleId,
  /** Clean white garment body. */
  fill: '#FFFFFF',
  /** Black construction outlines. */
  outline: '#141414',
  /** Seam lines — same ink as outline, thinner. */
  seam: '#141414',
  /** Subtle grey shadow, used sparingly for depth (ribs, welts). */
  shade: '#ECECEF',
  shadeDeep: '#DEDEE3',
  /** Consistent stroke widths across the whole system. */
  strokeOutline: 2.4,
  strokeSeam: 1.3,
  strokeStitch: 1,
  strokeDetail: 1.1,
  /** Dashed pattern for topstitching. */
  stitchDash: '5 3',
} as const

/** Aesthetics the future AI worker must never produce. Documented so reviewers can enforce them. */
export const FORBIDDEN_AESTHETICS = [
  'photographic',
  'glossy',
  'realistic',
  'painterly',
  'concept-art',
  'sketch',
  '3d-render',
  'product-mockup',
] as const

export type ShapeStyle = {
  fill: string
  stroke: string
  strokeWidth: number
  dash?: string
}

/** Resolve a shape's concrete paint from its role — the one place style is decided. */
export function styleForRole(role: ShapeRole): ShapeStyle {
  switch (role) {
    case 'fill':
      return { fill: TECH_FLAT.fill, stroke: TECH_FLAT.outline, strokeWidth: TECH_FLAT.strokeOutline }
    case 'outline':
      return { fill: 'none', stroke: TECH_FLAT.outline, strokeWidth: TECH_FLAT.strokeOutline }
    case 'seam':
      return { fill: 'none', stroke: TECH_FLAT.seam, strokeWidth: TECH_FLAT.strokeSeam }
    case 'stitch':
      return { fill: 'none', stroke: TECH_FLAT.seam, strokeWidth: TECH_FLAT.strokeStitch, dash: TECH_FLAT.stitchDash }
    case 'detail':
      return { fill: TECH_FLAT.shade, stroke: TECH_FLAT.outline, strokeWidth: TECH_FLAT.strokeDetail }
    default:
      return { fill: 'none', stroke: TECH_FLAT.outline, strokeWidth: TECH_FLAT.strokeDetail }
  }
}

/**
 * Resolve a shape's paint, honouring a region's assigned fabric colour. Only the FILLED roles
 * (fill/detail) take the colour; construction lines (outline/seam/stitch) always stay black so the
 * result is a proper coloured technical flat, never a solid blob. No colour → the tech-flat default.
 */
export function paintForShape(role: ShapeRole, fabricFill?: string): ShapeStyle {
  const base = styleForRole(role)
  if (fabricFill && (role === 'fill' || role === 'detail')) return { ...base, fill: fabricFill }
  return base
}
