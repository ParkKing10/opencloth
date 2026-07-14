import { useState } from 'react'
import { useT } from '@/i18n'
import type { ProductSpecs, SpecColor } from './designDoc'
import type { StudioMode } from './CommandBar'
import { IcoChevron } from '../../components/ui/Icons'
import './product-specs.css'

type Props = {
  specs: ProductSpecs
  onSpec: (patch: Partial<ProductSpecs>) => void
  /** Beginner tucks production detail behind an Advanced disclosure; Pro expands everything. */
  mode?: StudioMode
}

// Real, common option names offered as quick picks. The user selects or types their own —
// nothing here is inferred from the garment image, and nothing is applied to it as "material".
// The stored VALUE stays as the English identifier; only the chip LABEL is localized.
const MATERIALS: { value: string; labelKey: string }[] = [
  { value: 'Cotton', labelKey: 'dsInspectors.mat.cotton' },
  { value: 'Heavy Cotton', labelKey: 'dsInspectors.mat.heavyCotton' },
  { value: 'French Terry', labelKey: 'dsInspectors.mat.frenchTerry' },
  { value: 'Polyester', labelKey: 'dsInspectors.mat.polyester' },
  { value: 'Fleece', labelKey: 'dsInspectors.mat.fleece' },
  { value: 'Canvas', labelKey: 'dsInspectors.mat.canvas' },
  { value: 'Denim', labelKey: 'dsInspectors.mat.denim' },
  { value: 'Leather', labelKey: 'dsInspectors.mat.leather' },
]
const FITS: { value: string; labelKey: string }[] = [
  { value: 'Oversized', labelKey: 'dsInspectors.fit.oversized' },
  { value: 'Regular', labelKey: 'dsInspectors.fit.regular' },
  { value: 'Slim', labelKey: 'dsInspectors.fit.slim' },
  { value: 'Boxy', labelKey: 'dsInspectors.fit.boxy' },
  { value: 'Relaxed', labelKey: 'dsInspectors.fit.relaxed' },
]

/**
 * Product Specs — user-provided, empty by default. These describe the product for later
 * production/export; they never change the garment image (it's a design surface). Design is
 * never blocked by missing specs. Everything here persists with the design document.
 */
export function ProductSpecsEditor({ specs, onSpec, mode = 'beginner' }: Props) {
  const t = useT()
  const colors = specs.colors ?? []
  const isPro = mode === 'pro'

  const addColor = () => onSpec({ colors: [...colors, { name: t('dsInspectors.ps.newColor'), hex: '#1A1A20' }] })
  const patchColor = (i: number, patch: Partial<SpecColor>) =>
    onSpec({ colors: colors.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) })
  const removeColor = (i: number) => onSpec({ colors: colors.filter((_, idx) => idx !== i) })

  // How many production fields the user has already filled — surfaced on the beginner
  // disclosure so nothing they entered feels hidden.
  const productionFilled = [specs.weight, specs.composition, specs.variant, specs.notes].filter(
    (v) => !!v?.trim(),
  ).length

  const colorsField = (
    <div className="ps__field">
      <span className="ps__label">{t('dsInspectors.ps.colors')}</span>
      {colors.length === 0 && <span className="ps__empty">{t('dsInspectors.ps.notSpecified')}</span>}
      <div className="ps__colors">
        {colors.map((c, i) => (
          <div className="ps__color" key={i}>
            <label className="ps__swatch" style={{ background: c.hex }}>
              <input type="color" value={c.hex} onChange={(e) => patchColor(i, { hex: e.target.value })} aria-label={t('dsInspectors.ps.colorValue')} />
            </label>
            <input
              className="ps__color-name"
              value={c.name}
              onChange={(e) => patchColor(i, { name: e.target.value })}
              aria-label={t('dsInspectors.ps.colorName')}
            />
            <button type="button" className="ps__color-x" aria-label={t('dsInspectors.ps.removeColor')} onClick={() => removeColor(i)}>
              ×
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="ps__add" onClick={addColor}>
        {t('dsInspectors.ps.addColorway')}
      </button>
    </div>
  )

  // Production detail — always available, but only front-and-centre in Pro. Beginners open it
  // on demand so the panel stays focused on the visual essentials.
  const production = (
    <>
      <TextField label={t('dsInspectors.prop.weightFabric')} value={specs.weight} placeholder={t('dsInspectors.ps.weightPh')} onChange={(v) => onSpec({ weight: v })} />
      <TextField
        label={t('dsInspectors.prop.composition')}
        value={specs.composition}
        placeholder={t('dsInspectors.ps.compositionPh')}
        onChange={(v) => onSpec({ composition: v })}
      />
      <TextField
        label={t('dsInspectors.ps.variant')}
        value={specs.variant}
        placeholder={t('dsInspectors.ps.variantPh')}
        onChange={(v) => onSpec({ variant: v })}
      />
      <div className="ps__field">
        <span className="ps__label">{t('dsInspectors.ps.notes')}</span>
        <textarea
          className="ps__notes"
          value={specs.notes ?? ''}
          placeholder={t('dsInspectors.ps.notesPh')}
          rows={2}
          onChange={(e) => onSpec({ notes: e.target.value })}
        />
      </div>
    </>
  )

  return (
    <section className="ps">
      <div className="ps__head">
        <span className="ps__eyebrow">{t('dsInspectors.ps.title')}</span>
        <span className="ps__hint">{isPro ? t('dsInspectors.ps.hintPro') : t('dsInspectors.ps.hintBasic')}</span>
      </div>

      <PickField
        label={t('dsInspectors.prop.material')}
        value={specs.material}
        suggestions={MATERIALS}
        placeholder={t('dsInspectors.ps.notSpecified')}
        onChange={(v) => onSpec({ material: v })}
      />
      <PickField
        label={t('dsInspectors.prop.fit')}
        value={specs.fit}
        suggestions={FITS}
        placeholder={t('dsInspectors.ps.notSpecified')}
        onChange={(v) => onSpec({ fit: v })}
      />
      {colorsField}

      {isPro ? (
        production
      ) : (
        <Disclosure label={t('dsInspectors.ps.productionDetails')} badge={productionFilled || undefined}>
          {production}
        </Disclosure>
      )}
    </section>
  )
}

/** Progressive disclosure for beginners — professional fields one click away, never removed. */
function Disclosure({ label, badge, children }: { label: string; badge?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="ps__adv">
      <button
        type="button"
        className={`ps__adv-toggle${open ? ' is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <IcoChevron width="13" height="13" style={{ transform: open ? 'none' : 'rotate(-90deg)' }} />
        {label}
        {badge ? <span className="ps__adv-badge">{badge}</span> : null}
      </button>
      {open && <div className="ps__adv-body">{children}</div>}
    </div>
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
  suggestions: { value: string; labelKey: string }[]
  placeholder: string
  onChange: (v: string) => void
}) {
  const t = useT()
  const [custom, setCustom] = useState(false)
  const isSuggested = (v?: string) => suggestions.some((s) => s.value === v)
  const showCustom = custom || (!!value && !isSuggested(value))
  return (
    <div className="ps__field">
      <span className="ps__label">{label}</span>
      <div className="ps__chips">
        {suggestions.map((s) => (
          <button
            key={s.value}
            type="button"
            className={`ps__chip${value === s.value ? ' is-active' : ''}`}
            onClick={() => onChange(value === s.value ? '' : s.value)}
          >
            {t(s.labelKey)}
          </button>
        ))}
        <button
          type="button"
          className={`ps__chip ps__chip--other${showCustom ? ' is-active' : ''}`}
          onClick={() => setCustom((c) => !c)}
        >
          {t('dsInspectors.ps.custom')}
        </button>
      </div>
      {showCustom && (
        <input
          className="ps__input"
          value={isSuggested(value ?? '') ? '' : value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-label={t('dsInspectors.ps.customAria', { label })}
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
