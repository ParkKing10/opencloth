/**
 * Option presets for every editable studio property — real choices, one click.
 * A field with presets opens a picker popover; anything else gets a text input.
 */

export type PresetOption = { value: string; hint?: string; swatch?: string }

export const COLOR_PRESETS: PresetOption[] = [
  { value: '#1E1E1E', hint: 'Vintage Black', swatch: '#1E1E1E' },
  { value: '#F4F4F6', hint: 'Off White', swatch: '#F4F4F6' },
  { value: '#8A8A96', hint: 'Heather Grey', swatch: '#8A8A96' },
  { value: '#D8C9B0', hint: 'Washed Beige', swatch: '#D8C9B0' },
  { value: '#22304A', hint: 'Navy', swatch: '#22304A' },
  { value: '#3E4A3A', hint: 'Forest', swatch: '#3E4A3A' },
  { value: '#5C2E35', hint: 'Burgundy', swatch: '#5C2E35' },
  { value: '#D8FF3E', hint: 'Lime Punch', swatch: '#D8FF3E' },
]

const FITS: PresetOption[] = [
  { value: 'Oversized', hint: 'Roomy, drapey, street' },
  { value: 'Regular', hint: 'True to size' },
  { value: 'Boxy', hint: 'Short + wide' },
  { value: 'Cropped', hint: 'Above the waist' },
  { value: 'Slim', hint: 'Close to the body' },
  { value: 'Baggy', hint: 'Maximum room' },
]

const WEIGHTS: PresetOption[] = [
  { value: '240 GSM', hint: 'Lightweight — summer tees' },
  { value: '320 GSM', hint: 'Midweight — everyday' },
  { value: '450 GSM', hint: 'Heavy — premium hoodies' },
  { value: '480 GSM', hint: 'Extra heavy' },
  { value: '520 GSM', hint: 'Ultra — luxury drop' },
]

const FABRICS: PresetOption[] = [
  { value: 'Lightweight Jersey 240 GSM', hint: '100% Cotton' },
  { value: 'Midweight Twill 320 GSM', hint: '98% Cotton / 2% Elastane' },
  { value: 'Heavy French Terry 450 GSM', hint: '80% Cotton / 20% Poly' },
  { value: 'Ultra Fleece 520 GSM', hint: '100% Cotton' },
  { value: 'Ripstop 280 GSM', hint: 'Technical cargo' },
  { value: 'Waffle Knit 300 GSM', hint: 'Texture piece' },
]

const TECHNIQUES: PresetOption[] = [
  { value: 'Screen Print', hint: 'Crisp, durable, flat' },
  { value: 'Puff Print', hint: 'Raised 3D hand-feel' },
  { value: 'Embroidery', hint: 'Premium stitched' },
  { value: 'Heat Transfer', hint: 'Fine detail, photos' },
  { value: 'DTG', hint: 'Full color, low runs' },
]

const PLACEMENTS: PresetOption[] = [
  { value: 'Front Center', hint: 'The classic statement' },
  { value: 'Left Chest', hint: 'Subtle brand mark' },
  { value: 'Upper Back', hint: 'Between shoulders' },
  { value: 'Full Back', hint: 'Big canvas' },
  { value: 'Left Sleeve', hint: 'Detail moment' },
  { value: 'Hem', hint: 'Low-key label spot' },
]

const SIZES: PresetOption[] = ['S', 'M', 'L', 'XL', 'XXL'].map((v) => ({ value: v }))
const LENGTHS: PresetOption[] = [
  { value: 'Cropped' },
  { value: 'Regular' },
  { value: 'Longline' },
]
const BLENDS: PresetOption[] = [
  { value: 'Normal' },
  { value: 'Multiply' },
  { value: 'Screen' },
  { value: 'Overlay' },
]
const PERCENTS: PresetOption[] = ['25%', '50%', '75%', '100%', '125%', '150%'].map((v) => ({ value: v }))
const OPACITIES: PresetOption[] = ['25%', '50%', '75%', '90%', '100%'].map((v) => ({ value: v }))
const ROTATIONS: PresetOption[] = ['0°', '90°', '180°', '270°', '-15°', '15°'].map((v) => ({ value: v }))
const STRETCH: PresetOption[] = [{ value: 'None' }, { value: '2-way' }, { value: '4-way' }]

/** The garment blanks, for the object-first "Garment" picker (names match the catalog). */
const GARMENTS_OPTS: PresetOption[] = [
  { value: 'Hoodie', hint: 'The streetwear staple' },
  { value: 'T-Shirt', hint: 'Everyday essential' },
  { value: 'Zip Hoodie', hint: 'Layer piece' },
  { value: 'Sweatshirt', hint: 'Clean crewneck' },
  { value: 'Oversized Tee', hint: 'Drapey statement' },
  { value: 'Longsleeve', hint: 'Cold-season tee' },
  { value: 'Tank Top', hint: 'Summer cut' },
  { value: 'Bomber Jacket', hint: 'Outerwear icon' },
  { value: 'Cargo Jacket', hint: 'Utility layer' },
  { value: 'Cargo Pants', hint: 'Pocketed bottoms' },
  { value: 'Wide Trousers', hint: 'Relaxed tailoring' },
  { value: 'Dad Cap', hint: 'Finishing touch' },
]

/** Preset options per field id. Fields without presets get a free-text input. */
export const FIELD_PRESETS: Record<string, PresetOption[]> = {
  // the garment itself
  'g-garment': GARMENTS_OPTS,
  // garment details
  'd-size': SIZES,
  'd-fit': FITS,
  'd-length': LENGTHS,
  'd-fabric': FABRICS,
  'd-weight': WEIGHTS,
  'd-color': COLOR_PRESETS,
  // design
  'de-technique': TECHNIQUES,
  'de-placement': PLACEMENTS,
  'de-color': COLOR_PRESETS,
  // palette tab
  'c-base': COLOR_PRESETS,
  'c-print': COLOR_PRESETS,
  'c-rib': COLOR_PRESETS,
  'c-stitch': COLOR_PRESETS,
  // context panel (per-object)
  'cx-scale': PERCENTS,
  'cx-rotation': ROTATIONS,
  'cx-opacity': OPACITIES,
  'cx-blend': BLENDS,
  'cx-placement': PLACEMENTS,
  'cx-technique': TECHNIQUES,
  'cx-weight': WEIGHTS,
  'cx-material': FABRICS,
  'cx-stretch': STRETCH,
  'cx-color': COLOR_PRESETS,
}
