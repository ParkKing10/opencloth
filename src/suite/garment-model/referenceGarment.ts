/**
 * A hand-authored reference garment in the THREADOS Editable Garment format: an oversized
 * bomber jacket as a professional technical flat, front + back aligned in one coordinate space.
 *
 * This is NOT AI output and is not claimed to be — it is the concrete specimen the format is
 * designed around and the exact structure the future AI worker must emit. It gives the editor
 * something real to render, select, hide, lock and reorder today, with zero model connected.
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
import { TECH_FLAT } from './garmentStyle'

const VIEW_W = 400
const VIEW_H = 560

function region(id: string, name: string, type: RegionType, shapes: RegionShape[], children: string[] = []): GarmentRegion {
  return { id, name, type, children, shapes, visible: true, locked: false, capabilities: defaultCapabilities(type) }
}

// Both-view fabric shapes reuse the same geometry (front and back of a boxy bomber align).
const both = (d: string, role: RegionShape['role']): RegionShape[] => [
  { view: 'front', d, role },
  { view: 'back', d, role },
]
const front = (d: string, role: RegionShape['role']): RegionShape[] => [{ view: 'front', d, role }]
const back = (d: string, role: RegionShape['role']): RegionShape[] => [{ view: 'back', d, role }]

/** Build the reference bomber. Symmetric about x=200 in a 400×560 viewBox. */
export function makeReferenceBomber(): EditableGarment {
  const regions: Record<string, GarmentRegion> = {}
  const add = (r: GarmentRegion) => {
    regions[r.id] = r
  }

  add(region('body', 'Body', 'body', both('M126,116 Q200,100 274,116 L260,452 L140,452 Z', 'fill')))

  add(
    region('collar', 'Collar', 'collar', [
      ...both('M164,120 Q200,104 236,120 L232,140 Q200,126 168,140 Z', 'detail'),
      ...both('M168,136 Q200,122 232,136', 'stitch'),
    ]),
  )

  add(region('cuff-l', 'Left Cuff', 'cuff', both('M78,300 L120,318 L114,346 L72,326 Z', 'detail')))
  add(region('cuff-r', 'Right Cuff', 'cuff', both('M322,300 L280,318 L286,346 L328,326 Z', 'detail')))

  add(region('sleeve-l', 'Left Sleeve', 'sleeve', both('M126,116 L78,300 L120,318 L140,180 Z', 'fill'), ['cuff-l']))
  add(region('sleeve-r', 'Right Sleeve', 'sleeve', both('M274,116 L322,300 L280,318 L260,180 Z', 'fill'), ['cuff-r']))

  add(
    region('waistband', 'Waistband Rib', 'waistband', [
      ...both('M140,452 L260,452 L260,508 L140,508 Z', 'detail'),
      ...both('M148,460 L148,500 M164,460 L164,500 M182,460 L182,500 M200,460 L200,500 M218,460 L218,500 M236,460 L236,500 M252,460 L252,500', 'seam'),
    ]),
  )

  // Front-only construction
  add(
    region('zipper', 'Center Zipper', 'zipper', [
      ...front('M200,122 L200,452', 'seam'),
      ...front('M194,120 L206,120 L206,134 L194,134 Z', 'detail'),
    ]),
  )

  add(region('pocket-l', 'Pocket Left', 'pocket', [...front('M150,372 L196,360 L200,378 L154,390 Z', 'detail'), ...front('M153,374 L195,363', 'stitch')]))
  add(region('pocket-r', 'Pocket Right', 'pocket', [...front('M250,372 L204,360 L200,378 L246,390 Z', 'detail'), ...front('M247,374 L205,363', 'stitch')]))
  add(region('pockets', 'Pockets', 'group', [], ['pocket-l', 'pocket-r']))

  add(
    region('snaps', 'Snap Buttons', 'button', [
      ...front('M172,150 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0', 'detail'),
      ...front('M218,150 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0', 'detail'),
    ]),
  )

  // Back-only construction
  add(region('yoke', 'Back Yoke', 'panel', back('M140,182 Q200,204 260,182', 'seam')))
  add(region('label-brand', 'Brand Label', 'label', [...back('M182,132 L218,132 L218,148 L182,148 Z', 'detail'), ...back('M188,140 L212,140', 'stitch')]))
  add(region('labels', 'Labels', 'group', [], ['label-brand']))

  add(
    region('stitching', 'Topstitching', 'stitch', [
      ...both('M144,456 L256,456', 'stitch'),
      ...both('M80,306 L116,320', 'stitch'),
      ...both('M320,306 L284,320', 'stitch'),
    ]),
  )

  const rootIds = ['body', 'yoke', 'sleeve-l', 'sleeve-r', 'waistband', 'collar', 'zipper', 'pockets', 'snaps', 'labels', 'stitching']

  return {
    format: EDITABLE_GARMENT_FORMAT,
    version: EDITABLE_GARMENT_VERSION,
    id: 'reference-bomber',
    name: 'Oversized Bomber Jacket',
    category: 'Outerwear',
    style: TECH_FLAT.id,
    views: [
      { id: 'front', label: 'Front', viewBox: { w: VIEW_W, h: VIEW_H } },
      { id: 'back', label: 'Back', viewBox: { w: VIEW_W, h: VIEW_H } },
    ],
    rootIds,
    regions,
    source: { kind: 'reference' },
    createdAt: 0,
  }
}
