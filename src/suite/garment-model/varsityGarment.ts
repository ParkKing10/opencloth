/**
 * A hand-authored VARSITY / LETTERMAN JACKET in the loom studios Editable Garment format — a proper
 * technical flat with correct jacket proportions (full sleeves to the wrist, jacket-length body,
 * ribbed stand collar + cuffs + hem, a snap-button placket, side pockets, a chest patch, and a
 * back logo panel). This is what a detected "jacket" reconstructs into: it reads as a varsity
 * jacket, not a dress. Symmetric about x=200 in a 400×560 viewBox.
 *
 * Both closure styles ship as regions (snaps visible, zipper hidden) so the reconstruction's
 * detected closure can toggle them without inventing geometry.
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

function region(id: string, name: string, type: RegionType, shapes: RegionShape[], children: string[] = [], visible = true): GarmentRegion {
  return { id, name, type, children, shapes, visible, locked: false, capabilities: defaultCapabilities(type) }
}
const both = (d: string, role: RegionShape['role']): RegionShape[] => [
  { view: 'front', d, role },
  { view: 'back', d, role },
]
const front = (d: string, role: RegionShape['role']): RegionShape[] => [{ view: 'front', d, role }]
const back = (d: string, role: RegionShape['role']): RegionShape[] => [{ view: 'back', d, role }]

/** Build the varsity jacket. Proportioned so the ribbed hem sits near wrist level (a jacket, not a coat). */
export function makeVarsityJacket(): EditableGarment {
  const regions: Record<string, GarmentRegion> = {}
  const add = (r: GarmentRegion) => {
    regions[r.id] = r
  }

  // Body — shoulders ~y158, jacket-length hem at ~y400 (NOT floor length).
  add(region('body', 'Body', 'body', both('M130,158 Q200,150 270,158 L273,400 L127,400 Z', 'fill')))

  // Ribbed stand collar with a contrast top stripe.
  add(
    region('collar', 'Collar', 'collar', [
      ...both('M172,152 Q200,136 228,152 L224,172 Q200,158 176,172 Z', 'detail'),
      ...both('M178,166 Q200,155 222,166', 'stitch'),
    ]),
  )

  // Full set-in sleeves reaching the wrist.
  add(region('sleeve-l', 'Left Sleeve', 'sleeve', both('M130,158 L98,198 L90,346 L136,352 L152,216 Z', 'fill'), ['cuff-l']))
  add(region('sleeve-r', 'Right Sleeve', 'sleeve', both('M270,158 L302,198 L310,346 L264,352 L248,216 Z', 'fill'), ['cuff-r']))

  // Ribbed cuffs.
  add(
    region('cuff-l', 'Left Cuff', 'cuff', [
      ...both('M90,346 L136,352 L133,378 L87,372 Z', 'detail'),
      ...both('M98,352 L96,374 M110,354 L108,376 M122,355 L120,377', 'seam'),
    ]),
  )
  add(
    region('cuff-r', 'Right Cuff', 'cuff', [
      ...both('M310,346 L264,352 L267,378 L313,372 Z', 'detail'),
      ...both('M302,352 L304,374 M290,354 L292,376 M278,355 L280,377', 'seam'),
    ]),
  )

  // Ribbed hem (waistband) with a contrast stripe + vertical ribs.
  add(
    region('waistband', 'Ribbed Hem', 'waistband', [
      ...both('M127,400 L273,400 L273,430 L127,430 Z', 'detail'),
      ...both('M127,412 L273,412', 'seam'),
      ...both('M142,404 L142,426 M158,404 L158,426 M174,404 L174,426 M190,404 L190,426 M206,404 L206,426 M222,404 L222,426 M238,404 L238,426 M254,404 L254,426', 'seam'),
    ]),
  )

  // Snap-button placket (front) — the default varsity closure.
  add(region('placket', 'Snap Placket', 'panel', front('M189,158 L211,158 L211,400 L189,400 Z', 'detail')))
  add(
    region('snaps', 'Snap Buttons', 'button', [
      ...front('M195,192 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0', 'detail'),
      ...front('M195,228 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0', 'detail'),
      ...front('M195,264 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0', 'detail'),
      ...front('M195,300 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0', 'detail'),
      ...front('M195,336 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0', 'detail'),
      ...front('M195,372 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0', 'detail'),
    ]),
  )

  // Center-front zipper — hidden by default; the detected closure can reveal it instead of snaps.
  add(
    region(
      'zipper',
      'Center Zipper',
      'zipper',
      [...front('M200,160 L200,398', 'seam'), ...front('M194,158 L206,158 L206,172 L194,172 Z', 'detail')],
      [],
      false,
    ),
  )

  // Slanted side pockets (front).
  add(region('pocket-l', 'Pocket Left', 'pocket', [...front('M150,330 L192,320 L196,340 L154,350 Z', 'detail'), ...front('M153,332 L191,323', 'stitch')]))
  add(region('pocket-r', 'Pocket Right', 'pocket', [...front('M250,330 L208,320 L204,340 L246,350 Z', 'detail'), ...front('M247,332 L209,323', 'stitch')]))
  add(region('pockets', 'Pockets', 'group', [], ['pocket-l', 'pocket-r']))

  // Left-chest letter patch — the signature varsity element (small, on the wearer's left chest).
  add(region('chest-patch', 'Chest Patch', 'label', [...front('M150,200 L168,200 L168,215 L159,222 L150,215 Z', 'detail'), ...front('M154,206 L164,206', 'stitch')]))

  // Back construction: yoke seam + a center-back logo panel (editable placeholder for the script logo).
  add(region('yoke', 'Back Yoke', 'panel', back('M138,210 Q200,228 262,210', 'seam')))
  add(region('back-logo', 'Back Logo', 'label', [...back('M172,248 Q200,236 228,248 Q234,278 200,290 Q166,278 172,248 Z', 'detail'), ...back('M182,264 Q200,256 218,264', 'stitch')]))

  // A little topstitching for the flat.
  add(region('stitching', 'Topstitching', 'stitch', both('M132,406 L268,406', 'stitch')))

  const rootIds = [
    'body',
    'yoke',
    'sleeve-l',
    'sleeve-r',
    'waistband',
    'collar',
    'placket',
    'zipper',
    'snaps',
    'pockets',
    'chest-patch',
    'back-logo',
    'stitching',
  ]

  return {
    format: EDITABLE_GARMENT_FORMAT,
    version: EDITABLE_GARMENT_VERSION,
    id: 'reference-varsity',
    name: 'Varsity Jacket',
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
