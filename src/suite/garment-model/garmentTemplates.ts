/**
 * Real, editable garment templates for the Create-Garment wizard. Each is a genuine multi-region
 * technical flat in the loom studios Editable Garment format (not a picture) so it opens straight into
 * the editor with selectable/hideable/lockable regions. Kept intentionally to a curated set of real
 * templates — the wizard shows exactly these, never a fake longer list.
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
import { makeReferenceBomber } from './referenceGarment'
import { makeVarsityJacket } from './varsityGarment'
import { buildTemplate, PUFFER } from './templateLibrary'
import { CATALOG_SPECS } from './templateCatalog'

const W = 400
const H = 560

function region(id: string, name: string, type: RegionType, shapes: RegionShape[], children: string[] = []): GarmentRegion {
  return { id, name, type, children, shapes, visible: true, locked: false, capabilities: defaultCapabilities(type) }
}
const both = (d: string, role: RegionShape['role']): RegionShape[] => [
  { view: 'front', d, role },
  { view: 'back', d, role },
]
const front = (d: string, role: RegionShape['role']): RegionShape[] => [{ view: 'front', d, role }]
const back = (d: string, role: RegionShape['role']): RegionShape[] => [{ view: 'back', d, role }]
const circle = (cx: number, cy: number, r = 5): string => `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`

function assemble(id: string, name: string, category: string, rootIds: string[], regions: GarmentRegion[]): EditableGarment {
  const map: Record<string, GarmentRegion> = {}
  regions.forEach((r) => {
    map[r.id] = r
  })
  return {
    format: EDITABLE_GARMENT_FORMAT,
    version: EDITABLE_GARMENT_VERSION,
    id,
    name,
    category,
    style: TECH_FLAT.id,
    views: [
      { id: 'front', label: 'Front', viewBox: { w: W, h: H } },
      { id: 'back', label: 'Back', viewBox: { w: W, h: H } },
    ],
    rootIds,
    regions: map,
    source: { kind: 'reference' },
    createdAt: 0,
  }
}

function makeTee(): EditableGarment {
  return assemble('tpl-tshirt', 'T-Shirt', 'Tops', ['body', 'sleeve-l', 'sleeve-r', 'collar', 'stitch'], [
    region('body', 'Body', 'body', both('M124,152 Q200,142 276,152 L284,404 L116,404 Z', 'fill')),
    region('sleeve-l', 'Left Sleeve', 'sleeve', both('M124,152 L82,204 L116,228 L152,176 Z', 'fill')),
    region('sleeve-r', 'Right Sleeve', 'sleeve', both('M276,152 L318,204 L284,228 L248,176 Z', 'fill')),
    region('collar', 'Collar', 'collar', both('M180,152 Q200,172 220,152 L216,162 Q200,180 184,162 Z', 'detail')),
    region('stitch', 'Hem Stitch', 'stitch', both('M122,396 L278,396', 'stitch')),
  ])
}

function makeHoodie(): EditableGarment {
  return assemble('tpl-hoodie', 'Hoodie', 'Tops', ['body', 'hood', 'sleeve-l', 'sleeve-r', 'pocket', 'waistband', 'drawstring'], [
    region('body', 'Body', 'body', both('M118,152 Q200,140 282,152 L288,448 L112,448 Z', 'fill')),
    region('hood', 'Hood', 'hood', both('M142,152 Q200,80 258,152 L236,150 Q200,116 164,150 Z', 'fill')),
    region('cuff-l', 'Left Cuff', 'cuff', both('M74,322 L120,340 L114,368 L68,348 Z', 'detail')),
    region('cuff-r', 'Right Cuff', 'cuff', both('M326,322 L280,340 L286,368 L332,348 Z', 'detail')),
    region('sleeve-l', 'Left Sleeve', 'sleeve', both('M118,156 L74,322 L120,340 L150,206 Z', 'fill'), ['cuff-l']),
    region('sleeve-r', 'Right Sleeve', 'sleeve', both('M282,156 L326,322 L280,340 L250,206 Z', 'fill'), ['cuff-r']),
    region('pocket', 'Kangaroo Pocket', 'pocket', [...front('M150,362 L250,362 L242,410 L158,410 Z', 'detail'), ...front('M155,366 L245,366', 'stitch')]),
    region('waistband', 'Waistband Rib', 'waistband', [...both('M112,448 L288,448 L288,498 L112,498 Z', 'detail'), ...both('M138,454 L138,492 M172,454 L172,492 M206,454 L206,492 M240,454 L240,492 M268,454 L268,492', 'seam')]),
    region('drawstring', 'Drawstrings', 'drawstring', front('M188,150 L186,196 M212,150 L214,196', 'seam')),
  ])
}

function makePants(): EditableGarment {
  return assemble('tpl-pants', 'Pants', 'Bottoms', ['waistband', 'leg-l', 'leg-r', 'fly', 'pocket-l', 'pocket-r'], [
    region('waistband', 'Waistband', 'waistband', both('M118,92 L282,92 L282,124 L118,124 Z', 'detail')),
    region('leg-l', 'Left Leg', 'panel', both('M118,124 L200,124 L200,520 L134,520 L150,300 Z', 'fill')),
    region('leg-r', 'Right Leg', 'panel', both('M282,124 L200,124 L200,520 L266,520 L250,300 Z', 'fill')),
    region('fly', 'Fly Zipper', 'zipper', front('M200,124 L200,238', 'seam')),
    region('pocket-l', 'Left Pocket', 'pocket', both('M126,132 L166,128 L164,152 L130,158 Z', 'detail')),
    region('pocket-r', 'Right Pocket', 'pocket', both('M274,132 L234,128 L236,152 L270,158 Z', 'detail')),
  ])
}

function makeShorts(): EditableGarment {
  return assemble('tpl-shorts', 'Shorts', 'Bottoms', ['waistband', 'leg-l', 'leg-r', 'fly', 'pocket-l', 'pocket-r', 'hem'], [
    region('waistband', 'Waistband', 'waistband', both('M118,92 L282,92 L282,124 L118,124 Z', 'detail')),
    region('leg-l', 'Left Leg', 'panel', both('M118,124 L200,124 L200,300 L136,300 L152,220 Z', 'fill')),
    region('leg-r', 'Right Leg', 'panel', both('M282,124 L200,124 L200,300 L264,300 L248,220 Z', 'fill')),
    region('fly', 'Fly Zipper', 'zipper', front('M200,124 L200,210', 'seam')),
    region('pocket-l', 'Left Pocket', 'pocket', both('M126,132 L166,128 L164,152 L130,158 Z', 'detail')),
    region('pocket-r', 'Right Pocket', 'pocket', both('M274,132 L234,128 L236,152 L270,158 Z', 'detail')),
    region('hem', 'Hem Stitch', 'stitch', both('M138,292 L196,292 M204,292 L262,292', 'stitch')),
  ])
}

function makeSweater(): EditableGarment {
  return assemble('tpl-sweater', 'Sweater', 'Tops', ['body', 'sleeve-l', 'sleeve-r', 'waistband', 'collar'], [
    region('body', 'Body', 'body', both('M120,152 Q200,140 280,152 L286,426 L114,426 Z', 'fill')),
    region('collar', 'Ribbed Collar', 'collar', both('M176,152 Q200,170 224,152 L221,164 Q200,180 179,164 Z', 'detail')),
    region('cuff-l', 'Left Cuff', 'cuff', [...both('M84,348 L130,356 L127,380 L81,372 Z', 'detail'), ...both('M92,355 L90,377 M104,357 L102,379', 'seam')]),
    region('cuff-r', 'Right Cuff', 'cuff', [...both('M316,348 L270,356 L273,380 L319,372 Z', 'detail'), ...both('M308,355 L310,377 M296,357 L298,379', 'seam')]),
    region('sleeve-l', 'Left Sleeve', 'sleeve', both('M120,152 L82,196 L84,350 L130,356 L150,206 Z', 'fill'), ['cuff-l']),
    region('sleeve-r', 'Right Sleeve', 'sleeve', both('M280,152 L318,196 L316,350 L270,356 L250,206 Z', 'fill'), ['cuff-r']),
    region('waistband', 'Ribbed Hem', 'waistband', [...both('M114,426 L286,426 L286,454 L114,454 Z', 'detail'), ...both('M134,430 L134,450 M160,430 L160,450 M186,430 L186,450 M212,430 L212,450 M238,430 L238,450 M264,430 L264,450', 'seam')]),
  ])
}

function makeTank(): EditableGarment {
  return assemble('tpl-tank', 'Tank Top', 'Tops', ['body', 'stitch'], [
    region('body', 'Body', 'body', both('M146,150 L182,150 Q200,194 218,150 L254,150 Q264,172 244,196 L258,408 L142,408 L156,196 Q136,172 146,150 Z', 'fill')),
    region('stitch', 'Hem Stitch', 'stitch', both('M148,400 L252,400', 'stitch')),
  ])
}

function makePolo(): EditableGarment {
  return assemble('tpl-polo', 'Polo', 'Tops', ['body', 'sleeve-l', 'sleeve-r', 'collar', 'placket', 'buttons', 'hem'], [
    region('body', 'Body', 'body', both('M120,158 Q200,148 280,158 L286,410 L114,410 Z', 'fill')),
    region('cuff-l', 'Left Cuff', 'cuff', both('M82,204 L114,220 L108,234 L76,218 Z', 'detail')),
    region('cuff-r', 'Right Cuff', 'cuff', both('M318,204 L286,220 L292,234 L324,218 Z', 'detail')),
    region('sleeve-l', 'Left Sleeve', 'sleeve', both('M120,158 L82,204 L114,220 L152,196 Z', 'fill'), ['cuff-l']),
    region('sleeve-r', 'Right Sleeve', 'sleeve', both('M280,158 L318,204 L286,220 L248,196 Z', 'fill'), ['cuff-r']),
    region('collar', 'Collar', 'collar', [...front('M180,156 L162,150 L172,178 L200,168 L228,178 L238,150 L220,156 L200,166 Z', 'detail'), ...back('M178,158 Q200,150 222,158 L219,150 Q200,142 181,150 Z', 'detail')]),
    region('placket', 'Placket', 'panel', front('M193,168 L207,168 L207,210 L193,210 Z', 'detail')),
    region('buttons', 'Buttons', 'button', [...front(circle(200, 182, 4), 'detail'), ...front(circle(200, 200, 4), 'detail')]),
    region('hem', 'Hem Stitch', 'stitch', both('M120,402 L280,402', 'stitch')),
  ])
}

function makeDress(): EditableGarment {
  return assemble('tpl-dress', 'Dress', 'Dresses', ['body', 'sleeve-l', 'sleeve-r', 'collar', 'waist'], [
    region('body', 'Body', 'body', both('M150,152 Q200,142 250,152 L256,240 L286,470 L114,470 L144,240 Z', 'fill')),
    region('collar', 'Neckline', 'collar', both('M182,152 Q200,168 218,152 L215,162 Q200,176 185,162 Z', 'detail')),
    region('sleeve-l', 'Left Sleeve', 'sleeve', both('M150,152 L120,186 L140,206 L162,168 Z', 'fill')),
    region('sleeve-r', 'Right Sleeve', 'sleeve', both('M250,152 L280,186 L260,206 L238,168 Z', 'fill')),
    region('waist', 'Waist Seam', 'stitch', both('M146,240 L254,240', 'stitch')),
  ])
}

function makeSkirt(): EditableGarment {
  return assemble('tpl-skirt', 'Skirt', 'Bottoms', ['waistband', 'skirt', 'hem'], [
    region('waistband', 'Waistband', 'waistband', both('M144,120 L256,120 L258,150 L142,150 Z', 'detail')),
    region('skirt', 'Skirt', 'panel', both('M142,150 L258,150 L298,440 L102,440 Z', 'fill')),
    region('hem', 'Hem Stitch', 'stitch', both('M110,432 L290,432', 'stitch')),
  ])
}

function makeCoat(): EditableGarment {
  return assemble('tpl-coat', 'Coat', 'Outerwear', ['body', 'sleeve-l', 'sleeve-r', 'collar', 'placket', 'buttons', 'pocket-l', 'pocket-r'], [
    region('body', 'Body', 'body', both('M132,150 Q200,140 268,150 L276,496 L124,496 Z', 'fill')),
    region('cuff-l', 'Left Cuff', 'cuff', both('M92,372 L134,378 L131,398 L89,392 Z', 'detail')),
    region('cuff-r', 'Right Cuff', 'cuff', both('M308,372 L266,378 L269,398 L311,392 Z', 'detail')),
    region('sleeve-l', 'Left Sleeve', 'sleeve', both('M132,150 L98,200 L92,372 L134,378 L156,210 Z', 'fill'), ['cuff-l']),
    region('sleeve-r', 'Right Sleeve', 'sleeve', both('M268,150 L302,200 L308,372 L266,378 L244,210 Z', 'fill'), ['cuff-r']),
    region('collar', 'Lapel Collar', 'collar', [...front('M186,152 L172,152 L162,214 L200,176 L238,214 L228,152 L214,152 L200,166 Z', 'detail'), ...back('M172,150 Q200,166 228,150 L225,164 Q200,178 175,164 Z', 'detail')]),
    region('placket', 'Placket', 'panel', front('M192,158 L208,158 L208,496 L192,496 Z', 'detail')),
    region('buttons', 'Buttons', 'button', [...front(circle(200, 214), 'detail'), ...front(circle(200, 266), 'detail'), ...front(circle(200, 318), 'detail'), ...front(circle(200, 370), 'detail'), ...front(circle(200, 422), 'detail')]),
    region('pocket-l', 'Pocket Left', 'pocket', front('M148,392 L192,392 L192,436 L148,436 Z', 'detail')),
    region('pocket-r', 'Pocket Right', 'pocket', front('M252,392 L208,392 L208,436 L252,436 Z', 'detail')),
  ])
}

export type GarmentTemplate = {
  id: string
  name: string
  category: string
  make: () => EditableGarment
}

const FUNCTION_TEMPLATES: GarmentTemplate[] = [
  { id: 'tpl-varsity', name: 'Varsity Jacket', category: 'Outerwear', make: makeVarsityJacket },
  { id: 'tpl-bomber', name: 'Bomber Jacket', category: 'Outerwear', make: makeReferenceBomber },
  { id: 'tpl-coat', name: 'Coat', category: 'Outerwear', make: makeCoat },
  { id: 'tpl-hoodie', name: 'Hoodie', category: 'Tops', make: makeHoodie },
  { id: 'tpl-sweater', name: 'Sweater', category: 'Tops', make: makeSweater },
  { id: 'tpl-tshirt', name: 'T-Shirt', category: 'Tops', make: makeTee },
  { id: 'tpl-polo', name: 'Polo', category: 'Tops', make: makePolo },
  { id: 'tpl-tank', name: 'Tank Top', category: 'Tops', make: makeTank },
  { id: 'tpl-dress', name: 'Dress', category: 'Dresses', make: makeDress },
  { id: 'tpl-skirt', name: 'Skirt', category: 'Bottoms', make: makeSkirt },
  { id: 'tpl-pants', name: 'Pants', category: 'Bottoms', make: makePants },
  { id: 'tpl-shorts', name: 'Shorts', category: 'Bottoms', make: makeShorts },
]

// The catalog = hand-authored function templates + the data-driven spec catalog (puffer, and the
// large set that follows). Each data spec becomes a template that builds a real editable garment.
const SPEC_TEMPLATES: GarmentTemplate[] = [PUFFER, ...CATALOG_SPECS].map((s) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  make: () => buildTemplate(s),
}))

export const GARMENT_TEMPLATES: GarmentTemplate[] = [...FUNCTION_TEMPLATES, ...SPEC_TEMPLATES]

export function getTemplate(id: string): GarmentTemplate | undefined {
  return GARMENT_TEMPLATES.find((t) => t.id === id)
}

/** Map a free-text prompt to the closest real template (used by the AI-placeholder create path). */
export function nearestTemplate(prompt: string): GarmentTemplate {
  const p = prompt.toLowerCase()
  const rules: { re: RegExp; id: string }[] = [
    { re: /\bpuffer|quilted|down jacket|padded\b/, id: 'tpl-puffer' },
    { re: /\bparka|anorak\b/, id: 'tpl-parka' },
    { re: /\bhoodie|hooded|sweatshirt\b/, id: 'tpl-hoodie' },
    { re: /\bvarsity|letterman/, id: 'tpl-varsity' },
    { re: /\bbomber\b/, id: 'tpl-bomber' },
    { re: /\bblazer|suit jacket|sport coat\b/, id: 'tpl-blazer' },
    { re: /\bcardigan\b/, id: 'tpl-cardigan' },
    { re: /\bdenim jacket|trucker\b/, id: 'tpl-denim-jacket' },
    { re: /\bcoat|overcoat|trench|peacoat\b/, id: 'tpl-coat' },
    { re: /\bjacket|outer/, id: 'tpl-varsity' },
    { re: /\bpolo\b/, id: 'tpl-polo' },
    { re: /\btank|vest|sleeveless\b/, id: 'tpl-tank' },
    { re: /\bsweater|jumper|knit|crewneck|pullover|turtleneck\b/, id: 'tpl-sweater' },
    { re: /\bjumpsuit|romper|overalls?|dungarees?\b/, id: 'tpl-jumpsuit' },
    { re: /\bdress|gown\b/, id: 'tpl-dress' },
    { re: /\bskirt\b/, id: 'tpl-skirt' },
    { re: /\bshorts?\b/, id: 'tpl-shorts' },
    { re: /\bpants?|trousers?|cargos?|jeans|joggers?|leggings|chinos?\b/, id: 'tpl-pants' },
    { re: /\btee|t-?shirt|top\b/, id: 'tpl-tshirt' },
  ]
  const hit = rules.find((r) => r.re.test(p))
  return getTemplate(hit?.id ?? 'tpl-tshirt') ?? GARMENT_TEMPLATES[0]
}
