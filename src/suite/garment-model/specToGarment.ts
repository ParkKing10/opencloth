/**
 * Assemble an editable garment from a detected GarmentSpec.
 *
 * The GEOMETRY is always THREADOS's own trusted template for the detected type — so the result is
 * always a clean, editable, front+back technical flat. The spec only decides WHICH template and
 * which ACHIEVABLE attributes to apply (length, sleeveless, closure), using existing structural
 * primitives. Nothing is traced from the photo; nothing is invented. Colours are detected upstream
 * and reported honestly (colorNotesFromSpec) — never painted, because the renderer is monochrome.
 */
import type { EditableGarment, GarmentRegion, RegionType } from './editableGarment'
import type { GarmentSpec, GarmentTypeId, LengthId } from './garmentSpec'
import { getTemplate, GARMENT_TEMPLATES } from './garmentTemplates'
import { removeRegions, mapRegionShapes } from './regionEdit'
import { setVisible } from './regionTree'
import { scalePath } from './pathTransform'
import { colorToHex } from './garmentColors'

/** A confidence row for the reconstruction review screen ({label, value} matches RegionConfidence). */
export type SpecConfidence = { label: string; value: number }

const TYPE_TO_TEMPLATE: Record<GarmentTypeId, string> = {
  jacket: 'tpl-varsity',
  puffer: 'tpl-puffer',
  coat: 'tpl-coat',
  parka: 'tpl-parka',
  blazer: 'tpl-blazer',
  hoodie: 'tpl-hoodie',
  sweater: 'tpl-sweater',
  cardigan: 'tpl-cardigan',
  tee: 'tpl-tshirt',
  polo: 'tpl-polo',
  tank: 'tpl-tank',
  dress: 'tpl-dress',
  skirt: 'tpl-skirt',
  pants: 'tpl-pants',
  shorts: 'tpl-shorts',
  jumpsuit: 'tpl-jumpsuit',
  unknown: 'tpl-tshirt',
}

const TYPE_LABEL: Record<GarmentTypeId, string> = {
  jacket: 'Jacket',
  puffer: 'Puffer Jacket',
  coat: 'Coat',
  parka: 'Parka',
  blazer: 'Blazer',
  hoodie: 'Hoodie',
  sweater: 'Sweater',
  cardigan: 'Cardigan',
  tee: 'T-Shirt',
  polo: 'Polo',
  tank: 'Tank Top',
  dress: 'Dress',
  skirt: 'Skirt',
  pants: 'Pants',
  shorts: 'Shorts',
  jumpsuit: 'Jumpsuit',
  unknown: 'Garment',
}

/** Vertical scale of the body about the shoulder line for a cropped / long silhouette. */
const SHOULDER = { x: 200, y: 120 }
const LENGTH_SCALE: Record<LengthId, number> = { cropped: 0.82, regular: 1, long: 1.16 }

// Ribs/trim/sleeves take the SECONDARY colour when the photo has one (classic contrast look),
// else the primary. Body/panels/pockets take the primary. Hardware + stitching stay uncoloured.
const CONTRAST_TYPES = new Set<RegionType>(['sleeve', 'cuff', 'collar', 'waistband', 'rib', 'label'])
const FABRIC_TYPES = new Set<RegionType>(['body', 'pocket', 'hood', 'panel', 'drawstring'])

/** Paint the detected colours onto fabric regions (front + back). Nothing faked — only what's detected. */
function applyColors(g: EditableGarment, primary?: string, secondary?: string): EditableGarment {
  if (!primary && !secondary) return g
  const regions: Record<string, GarmentRegion> = {}
  for (const [id, r] of Object.entries(g.regions)) {
    let fill: string | undefined
    if (CONTRAST_TYPES.has(r.type)) fill = secondary ?? primary
    else if (FABRIC_TYPES.has(r.type)) fill = primary
    regions[id] = fill ? { ...r, appearance: { ...r.appearance, fill } } : r
  }
  return { ...g, regions }
}

/**
 * Build the closest editable garment for a spec. Returns the garment, the REAL per-attribute
 * confidences to show the user (only fields the model actually reported), and a display type label.
 */
export function buildFromSpec(spec: GarmentSpec): { garment: EditableGarment; confidences: SpecConfidence[]; typeLabel: string } {
  const type = spec.garmentType.value
  const template = getTemplate(TYPE_TO_TEMPLATE[type]) ?? GARMENT_TEMPLATES[0]
  let g = template.make()

  const confidences: SpecConfidence[] = []
  const note = (label: string, f: { confidence: number }) => {
    if (f.confidence > 0) confidences.push({ label, value: f.confidence })
  }

  // Type headline — only shown with the model's OWN confidence, never a fabricated number.
  note(`Type · ${TYPE_LABEL[type]}`, spec.garmentType)

  // Length → scale the body region vertically about the shoulder (guarded: only if a body exists).
  if (spec.length.value !== 'regular' && g.regions['body']) {
    const sy = LENGTH_SCALE[spec.length.value]
    const res = mapRegionShapes(g, 'body', (s) => {
      const d = scalePath(s.d, 1, sy, SHOULDER)
      return d ? { ...s, d } : null
    })
    g = res.garment
    if (res.changed) note(`Length · ${spec.length.value}`, spec.length)
  }

  // Sleeveless → remove sleeve + cuff regions if this template has them; else report the sleeve type.
  if (spec.sleeves.value === 'sleeveless') {
    const sleeveIds = Object.keys(g.regions).filter((id) => {
      const t = g.regions[id].type
      return t === 'sleeve' || t === 'cuff'
    })
    if (sleeveIds.length > 0) {
      g = removeRegions(g, new Set(sleeveIds)).garment
      note('Sleeves · sleeveless', spec.sleeves)
    }
  } else {
    note(`Sleeves · ${spec.sleeves.value}`, spec.sleeves)
  }

  // Closure → toggle the jacket's zipper vs snap-button regions so the garment matches the photo.
  if (g.regions['zipper'] || g.regions['snaps']) {
    if (spec.closure.value === 'zip') {
      if (g.regions['zipper']) g = setVisible(g, 'zipper', true)
      if (g.regions['snaps']) g = setVisible(g, 'snaps', false)
      note('Closure · zip', spec.closure)
    } else if (spec.closure.value === 'buttons' || spec.closure.value === 'snaps') {
      if (g.regions['snaps']) g = setVisible(g, 'snaps', true)
      if (g.regions['zipper']) g = setVisible(g, 'zipper', false)
      note(`Closure · ${spec.closure.value}`, spec.closure)
    }
  }

  // Collar + pockets are reported (the template's own geometry stays; no faked construction).
  note(`Collar · ${spec.collar.value}`, spec.collar)
  note(`Pockets · ${spec.pockets.value}`, spec.pockets)

  // Paint the detected colours onto the fabric (primary body, secondary sleeves/ribs).
  const primary = colorToHex(spec.primaryColor?.value)
  const secondary = colorToHex(spec.secondaryColor?.value)
  g = applyColors(g, primary, secondary)
  if (spec.primaryColor && primary) note(`Colour · ${spec.primaryColor.value}`, spec.primaryColor)
  if (spec.secondaryColor && secondary) note(`Colour 2 · ${spec.secondaryColor.value}`, spec.secondaryColor)

  const name = `${TYPE_LABEL[type]} (from photo)`
  return {
    garment: {
      ...g,
      name,
      source: { kind: 'ai', prompt: 'photo reconstruction', worker: 'vision-spec', generatedAt: Date.now() },
    },
    confidences,
    typeLabel: TYPE_LABEL[type],
  }
}
