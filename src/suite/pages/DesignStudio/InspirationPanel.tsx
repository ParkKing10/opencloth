import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import './inspiration.css'

export type InspirationPreset = {
  name: string
  vibe: string
  garment: string
  kind: GarmentKind
  fit: string
  fabric: string
  colorHex: string
  colorName: string
  text?: string
  textColor?: string
}

/** Curated starting looks — click to load the whole vibe onto the canvas. */
const LOOKS: InspirationPreset[] = [
  { name: 'Blackout', vibe: 'Minimal all-black statement', garment: 'Hoodie', kind: 'hoodie', fit: 'Oversized', fabric: 'Heavy French Terry 450 GSM', colorHex: '#1E1E1E', colorName: 'Jet Black', text: 'VISIONARY', textColor: '#C9C9D2' },
  { name: 'Vintage Wash', vibe: 'Faded, lived-in streetwear', garment: 'Oversized Tee', kind: 'tee', fit: 'Boxy', fabric: 'Midweight Twill 320 GSM', colorHex: '#8A8A96', colorName: 'Heather Grey', text: 'WORLDWIDE', textColor: '#2A2A2A' },
  { name: 'Cream Luxe', vibe: 'Elevated heavyweight essential', garment: 'Hoodie', kind: 'hoodie', fit: 'Regular', fabric: 'Ultra Fleece 520 GSM', colorHex: '#D8C9B0', colorName: 'Washed Beige', text: 'ATELIER', textColor: '#3E3428' },
  { name: 'Utility Cargo', vibe: 'Technical, pocketed, functional', garment: 'Cargo Pants', kind: 'pants', fit: 'Baggy', fabric: 'Ripstop 280 GSM', colorHex: '#3E4A3A', colorName: 'Forest' },
  { name: 'Racing Bomber', vibe: 'Moto-inspired outerwear', garment: 'Bomber Jacket', kind: 'jacket', fit: 'Regular', fabric: 'Midweight Twill 320 GSM', colorHex: '#22304A', colorName: 'Navy', text: 'SPEED', textColor: '#D8FF3E' },
  { name: 'Acid Pop', vibe: 'Loud lime graphic tee', garment: 'T-Shirt', kind: 'tee', fit: 'Regular', fabric: 'Lightweight Jersey 240 GSM', colorHex: '#1E1E1E', colorName: 'Jet Black', text: 'loom studios', textColor: '#D8FF3E' },
]

export function InspirationPanel({ onApply }: { onApply: (p: InspirationPreset) => void }) {
  return (
    <div className="insp">
      <div className="ds-panel-head">
        <h2>Inspiration</h2>
      </div>
      <p className="insp__hint">Start from a look — it loads the garment, fabric, colour and print.</p>
      <div className="insp__grid">
        {LOOKS.map((l) => {
          const Glyph = GARMENT_GLYPHS[l.kind]
          return (
            <button key={l.name} type="button" className="insp__card" onClick={() => onApply(l)} title={`Apply “${l.name}”`}>
              <span className="insp__thumb" style={{ background: l.colorHex }}>
                <Glyph width="42" height="42" />
                {l.text && (
                  <span className="insp__print" style={{ color: l.textColor }}>
                    {l.text}
                  </span>
                )}
              </span>
              <span className="insp__meta">
                <b>{l.name}</b>
                <small>{l.vibe}</small>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
