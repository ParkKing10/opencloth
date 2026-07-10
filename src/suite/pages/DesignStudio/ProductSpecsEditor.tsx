import { useState } from 'react'
import type { ProductSpecs, SpecColor } from './designDoc'
import './product-specs.css'

type Props = {
  specs: ProductSpecs
  onSpec: (patch: Partial<ProductSpecs>) => void
}

// Real, common option names offered as quick picks. The user selects or types their own —
// nothing here is inferred from the garment image, and nothing is applied to it as "material".
const MATERIALS = ['Cotton', 'Heavy Cotton', 'French Terry', 'Polyester', 'Fleece', 'Canvas', 'Denim', 'Leather']
const FITS = ['Oversized', 'Regular', 'Slim', 'Boxy', 'Relaxed']

/**
 * Product Specs — user-provided, empty by default. These describe the product for later
 * production/export; they never change the garment image (it's a design surface). Design is
 * never blocked by missing specs. Everything here persists with the design document.
 */
export function ProductSpecsEditor({ specs, onSpec }: Props) {
  const colors = specs.colors ?? []

  const addColor = () => onSpec({ colors: [...colors, { name: 'New color', hex: '#1A1A20' }] })
  const patchColor = (i: number, patch: Partial<SpecColor>) =>
    onSpec({ colors: colors.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
  const removeColor = (i: number) => onSpec({ colors: colors.filter((_, idx) => idx !== i) })

  return (
    <section className="ps">
      <div className="ps__head">
        <span className="ps__eyebrow">Product Specs</span>
        <span className="ps__hint">Optional — needed before production/export</span>
      </div>

      <PickField
        label="Material"
        value={specs.material}
        suggestions={MATERIALS}
        placeholder="Not specified yet"
        onChange={(v) => onSpec({ material: v })}
      />
      <PickField
        label="Fit"
        value={specs.fit}
        suggestions={FITS}
        placeholder="Not specified yet"
        onChange={(v) => onSpec({ fit: v })}
      />
      <TextField label="Weight" value={specs.weight} placeholder="e.g. 320 GSM" onChange={(v) => onSpec({ weight: v })} />
      <TextField
        label="Composition"
        value={specs.composition}
        placeholder="e.g. 100% Cotton"
        onChange={(v) => onSpec({ composition: v })}
      />
      <TextField
        label="Variant"
        value={specs.variant}
        placeholder="e.g. Zip / Crop / Standard"
        onChange={(v) => onSpec({ variant: v })}
      />

      <div className="ps__field">
        <span className="ps__label">Colors</span>
        {colors.length === 0 && <span className="ps__empty">Not specified yet</span>}
        <div className="ps__colors">
          {colors.map((c, i) => (
            <div className="ps__color" key={i}>
              <label className="ps__swatch" style={{ background: c.hex }}>
                <input type="color" value={c.hex} onChange={(e) => patchColor(i, { hex: e.target.value })} aria-label="Color value" />
              </label>
              <input
                className="ps__color-name"
                value={c.name}
                onChange={(e) => patchColor(i, { name: e.target.value })}
                aria-label="Color name"
              />
              <button type="button" className="ps__color-x" aria-label="Remove color" onClick={() => removeColor(i)}>
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="ps__add" onClick={addColor}>
          + Add colorway
        </button>
      </div>

      <div className="ps__field">
        <span className="ps__label">Notes</span>
        <textarea
          className="ps__notes"
          value={specs.notes ?? ''}
          placeholder="Production notes, wash, trims…"
          rows={2}
          onChange={(e) => onSpec({ notes: e.target.value })}
        />
      </div>
    </section>
  )
}

/** A field with quick-pick chips plus free text. The value is always user-chosen. */
function PickField({
  label,
  value,
  suggestions,
  placeholder,
  onChange,
}: {
  label: string
  value?: string
  suggestions: string[]
  placeholder: string
  onChange: (v: string) => void
}) {
  const [custom, setCustom] = useState(false)
  const showCustom = custom || (!!value && !suggestions.includes(value))
  return (
    <div className="ps__field">
      <span className="ps__label">{label}</span>
      <div className="ps__chips">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            className={`ps__chip${value === s ? ' is-active' : ''}`}
            onClick={() => onChange(value === s ? '' : s)}
          >
            {s}
          </button>
        ))}
        <button
          type="button"
          className={`ps__chip ps__chip--other${showCustom ? ' is-active' : ''}`}
          onClick={() => setCustom((c) => !c)}
        >
          Custom
        </button>
      </div>
      {showCustom && (
        <input
          className="ps__input"
          value={suggestions.includes(value ?? '') ? '' : value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} (custom)`}
        />
      )}
    </div>
  )
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value?: string
  placeholder: string
  onChange: (v: string) => void
}) {
  return (
    <div className="ps__field">
      <span className="ps__label">{label}</span>
      <input className="ps__input" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label={label} />
    </div>
  )
}
