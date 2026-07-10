/**
 * Data-driven garment templates. A TemplateSpec is a compact description (regions + view-aware
 * shapes) that `buildTemplate` turns into a real EditableGarment (front + back, region tree). Using
 * `view: 'both'` on fabric shapes keeps specs short, so the catalog can hold many distinct pieces
 * (puffers, blazers, dresses, one-pieces…) without a hand-written function per garment.
 *
 * Convention: 400×560 viewBox, symmetric about x=200. Roles map to paint via garmentStyle:
 *   fill   = coloured fabric panel (body/sleeve/leg)      detail = trim/rib/pocket/patch (also coloured)
 *   seam   = construction line (always black)             stitch = dashed topstitch (always black)
 * Front-only details (placket, buttons, pockets) use view:'front'; back construction uses view:'back'.
 */
import {
  EDITABLE_GARMENT_FORMAT,
  EDITABLE_GARMENT_VERSION,
  defaultCapabilities,
  type EditableGarment,
  type GarmentRegion,
  type RegionShape,
  type RegionType,
} from './editableGarment'
import type { ShapeRole } from './garmentStyle'
import { TECH_FLAT } from './garmentStyle'

export type SpecView = 'front' | 'back' | 'both'
export type ShapeSpec = { view: SpecView; d: string; role: ShapeRole }
export type RegionSpec = { id: string; name: string; type: RegionType; children?: string[]; shapes: ShapeSpec[] }
export type TemplateSpec = { id: string; name: string; category: string; rootIds: string[]; regions: RegionSpec[] }

const W = 400
const H = 560

function expand(shapes: ShapeSpec[]): RegionShape[] {
  const out: RegionShape[] = []
  for (const s of shapes) {
    if (s.view === 'both') {
      out.push({ view: 'front', d: s.d, role: s.role }, { view: 'back', d: s.d, role: s.role })
    } else {
      out.push({ view: s.view, d: s.d, role: s.role })
    }
  }
  return out
}

/** Turn a compact TemplateSpec into a full editable garment (front + back). */
export function buildTemplate(spec: TemplateSpec): EditableGarment {
  const regions: Record<string, GarmentRegion> = {}
  for (const r of spec.regions) {
    regions[r.id] = {
      id: r.id,
      name: r.name,
      type: r.type,
      children: (r.children ?? []).filter((c) => spec.regions.some((x) => x.id === c)),
      shapes: expand(r.shapes),
      visible: true,
      locked: false,
      capabilities: defaultCapabilities(r.type),
    }
  }
  // Any region that isn't in rootIds and isn't someone's child would be invisible — append it so no
  // authored region (e.g. a back seam the author forgot to root) is silently dropped from the tree.
  const childIds = new Set(Object.values(regions).flatMap((r) => r.children))
  const rooted = new Set(spec.rootIds)
  const rootIds = [...spec.rootIds.filter((id) => regions[id])]
  for (const id of Object.keys(regions)) if (!rooted.has(id) && !childIds.has(id)) rootIds.push(id)
  return {
    format: EDITABLE_GARMENT_FORMAT,
    version: EDITABLE_GARMENT_VERSION,
    id: spec.id,
    name: spec.name,
    category: spec.category,
    style: TECH_FLAT.id,
    views: [
      { id: 'front', label: 'Front', viewBox: { w: W, h: H } },
      { id: 'back', label: 'Back', viewBox: { w: W, h: H } },
    ],
    rootIds,
    regions,
    source: { kind: 'reference' },
    createdAt: 0,
  }
}

const b = (d: string, role: ShapeRole): ShapeSpec => ({ view: 'both', d, role })
const f = (d: string, role: ShapeRole): ShapeSpec => ({ view: 'front', d, role })
const bk = (d: string, role: ShapeRole): ShapeSpec => ({ view: 'back', d, role })
const dot = (cx: number, cy: number, r = 5): string => `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`

/**
 * PUFFER JACKET — the hero. Signature horizontal quilt channels across a rounded, padded silhouette,
 * puffy stand collar, storm-flap snap placket over a centre zip, side zip pockets, ribbed cuffs + hem.
 */
export const PUFFER: TemplateSpec = {
  id: 'tpl-puffer',
  name: 'Puffer Jacket',
  category: 'Outerwear',
  rootIds: ['body', 'quilting', 'sleeve-l', 'sleeve-r', 'collar', 'waistband', 'placket', 'zipper', 'snaps', 'pocket-l', 'pocket-r'],
  regions: [
    { id: 'body', name: 'Body', type: 'body', shapes: [b('M126,164 Q200,150 274,164 Q290,300 278,468 L122,468 Q110,300 126,164 Z', 'fill')] },
    {
      id: 'quilting',
      name: 'Quilt Channels',
      type: 'stitch',
      shapes: [
        b('M124,208 Q200,220 276,208', 'seam'),
        b('M122,254 Q200,266 278,254', 'seam'),
        b('M121,300 Q200,312 279,300', 'seam'),
        b('M121,346 Q200,358 279,346', 'seam'),
        b('M122,392 Q200,404 278,392', 'seam'),
        b('M124,438 Q200,450 276,438', 'seam'),
      ],
    },
    { id: 'cuff-l', name: 'Left Cuff', type: 'cuff', shapes: [b('M100,452 L150,464 L147,492 L96,480 Z', 'detail'), b('M108,458 L106,482 M120,460 L118,484 M132,462 L130,486', 'seam')] },
    { id: 'cuff-r', name: 'Right Cuff', type: 'cuff', shapes: [b('M300,452 L250,464 L253,492 L304,480 Z', 'detail'), b('M292,458 L294,482 M280,460 L282,484 M268,462 L270,486', 'seam')] },
    {
      id: 'sleeve-l',
      name: 'Left Sleeve',
      type: 'sleeve',
      children: ['cuff-l'],
      shapes: [
        b('M126,166 Q92,188 88,300 Q86,388 104,458 L150,466 Q140,300 150,196 Z', 'fill'),
        b('M96,244 Q124,252 150,246', 'seam'),
        b('M94,300 Q122,308 150,302', 'seam'),
        b('M96,356 Q124,364 150,358', 'seam'),
        b('M100,410 Q126,418 150,412', 'seam'),
      ],
    },
    {
      id: 'sleeve-r',
      name: 'Right Sleeve',
      type: 'sleeve',
      children: ['cuff-r'],
      shapes: [
        b('M274,166 Q308,188 312,300 Q314,388 296,458 L250,466 Q260,300 250,196 Z', 'fill'),
        b('M304,244 Q276,252 250,246', 'seam'),
        b('M306,300 Q278,308 250,302', 'seam'),
        b('M304,356 Q276,364 250,358', 'seam'),
        b('M300,410 Q274,418 250,412', 'seam'),
      ],
    },
    { id: 'collar', name: 'Puffer Collar', type: 'collar', shapes: [b('M162,118 Q200,92 238,118 Q244,150 238,160 Q200,138 162,160 Q156,150 162,118 Z', 'detail'), b('M170,140 Q200,124 230,140', 'seam')] },
    { id: 'waistband', name: 'Ribbed Hem', type: 'waistband', shapes: [b('M122,468 L278,468 L278,498 L122,498 Z', 'detail'), b('M138,472 L138,494 M158,472 L158,494 M178,472 L178,494 M198,472 L198,494 M218,472 L218,494 M238,472 L238,494 M258,472 L258,494', 'seam')] },
    { id: 'placket', name: 'Storm Flap', type: 'panel', shapes: [f('M186,162 L214,162 L214,468 L186,468 Z', 'detail')] },
    { id: 'zipper', name: 'Centre Zip', type: 'zipper', shapes: [f('M200,164 L200,468', 'seam'), f('M195,162 L205,162 L205,176 L195,176 Z', 'detail')] },
    { id: 'snaps', name: 'Snaps', type: 'button', shapes: [f(dot(200, 150), 'detail'), f(dot(200, 188), 'detail'), f(dot(200, 226), 'detail'), f(dot(200, 264), 'detail'), f(dot(200, 446), 'detail'), f(dot(200, 480), 'detail')] },
    { id: 'pocket-l', name: 'Pocket Left', type: 'pocket', shapes: [f('M150,356 L162,356 L162,428 L150,428 Z', 'detail'), f('M156,360 L156,424', 'seam')] },
    { id: 'pocket-r', name: 'Pocket Right', type: 'pocket', shapes: [f('M250,356 L238,356 L238,428 L250,428 Z', 'detail'), f('M244,360 L244,424', 'seam')] },
  ],
}

// Re-export the shape helpers so catalog authors can write terse specs.
export { b, f, bk, dot }
