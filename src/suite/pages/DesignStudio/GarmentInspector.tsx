import { useEffect, useState } from 'react'
import { IcoChevron } from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { PickerField, type PickerFieldData } from './PickerField'
import type { StudioConfig } from './studioModel'
import type { StudioMode } from './CommandBar'

export type PropField = PickerFieldData

type Props = {
  mode: StudioMode
  garment: { name: string; kind: GarmentKind; fit: string }
  fields: Record<string, PropField[]>
  config: StudioConfig
  onField: (group: string, fieldId: string, value: string) => void
  onGarment: (name: string) => void
  onConfig: (key: keyof StudioConfig, value: boolean) => void
  /** Rendered at the bottom of the scroll area (the AI companion). */
  children?: React.ReactNode
}

/**
 * The garment inspector — object-first. A beginner sees the garment itself
 * (Garment / Fabric / Fit / Color as big natural rows) with everything else one
 * "Advanced" click away. Pro sees every group expanded. Nothing is removed.
 */
export function GarmentInspector({ mode, garment, fields, config, onField, onGarment, onConfig, children }: Props) {
  const [propTab, setPropTab] = useState<'Properties' | 'Materials' | 'Colors'>('Properties')
  const isPro = mode === 'pro'
  const Glyph = GARMENT_GLYPHS[garment.kind]

  const detail = (id: string) => fields.details.find((f) => f.id === id)
  const heroField = (id: string, label: string): PropField | null => {
    const f = detail(id)
    return f ? { ...f, label } : null
  }

  // The four rows a beginner actually thinks in: the piece, the cloth, the cut, the color.
  const heroRows: (PropField | null)[] = [
    { id: 'g-garment', label: 'Garment', value: garment.name },
    heroField('d-fabric', 'Fabric'),
    heroField('d-fit', 'Fit'),
    detail('d-color') ? { ...detail('d-color')!, label: 'Color' } : null,
  ]

  const brandToggles = (
    <>
      <ConfigToggle label="Neck Label Artwork" on={config.neckLabel} onToggle={(v) => onConfig('neckLabel', v)} />
      <ConfigToggle label="Care Label" on={config.careLabel} onToggle={(v) => onConfig('careLabel', v)} />
    </>
  )
  const constructionToggles = (
    <ConfigToggle label="Construction confirmed" on={config.construction} onToggle={(v) => onConfig('construction', v)} />
  )
  const manufacturingToggles = (
    <>
      <ConfigToggle label="Tolerance Table" on={config.tolerance} onToggle={(v) => onConfig('tolerance', v)} />
      <ConfigToggle label="Production Notes" on={config.productionNotes} onToggle={(v) => onConfig('productionNotes', v)} />
      <ConfigToggle label="Packaging" on={config.packaging} onToggle={(v) => onConfig('packaging', v)} />
    </>
  )

  if (!isPro) {
    // ---- Beginner: the garment, in plain language ----
    return (
      <div className="ds-right__scroll">
        <div className="gi-hero">
          <div className="gi-hero__item">
            <span className="gi-hero__thumb">
              <Glyph width="30" height="30" />
            </span>
            <span className="gi-hero__text">
              <b>{garment.name}</b>
              <small>{detail('d-fit')?.value ?? garment.fit} fit</small>
            </span>
          </div>
          {heroRows.map((f) =>
            f ? (
              <PickerField
                key={f.id}
                field={f}
                hero
                onChange={(v) => (f.id === 'g-garment' ? onGarment(v) : onField('details', f.id, v))}
              />
            ) : null,
          )}
        </div>

        <Accordion title="Design" open>
          {fields.design.map((f) => (
            <PickerField key={f.id} field={f} onChange={(v) => onField('design', f.id, v)} />
          ))}
        </Accordion>

        <Advanced>
          <Accordion title="Details" open>
            {fields.details
              .filter((f) => !['d-fabric', 'd-fit', 'd-color'].includes(f.id))
              .map((f) => (
                <PickerField key={f.id} field={f} onChange={(v) => onField('details', f.id, v)} />
              ))}
            {fields.detailsAdvanced.map((f) => (
              <PickerField key={f.id} field={f} onChange={(v) => onField('detailsAdvanced', f.id, v)} />
            ))}
          </Accordion>
          <Accordion title="Brand" open>
            {brandToggles}
          </Accordion>
          <Accordion title="Construction" open>
            {constructionToggles}
          </Accordion>
          <Accordion title="Manufacturing" open>
            {manufacturingToggles}
          </Accordion>
        </Advanced>

        {children}
      </div>
    )
  }

  // ---- Pro: every production control, expanded ----
  return (
    <>
      <div className="ds-proptabs">
        {(['Properties', 'Materials', 'Colors'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`ds-proptab${propTab === t ? ' is-active' : ''}`}
            onClick={() => setPropTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="ds-right__scroll">
        {propTab === 'Properties' && (
          <>
            <section className="ds-group">
              <div className="ds-group__head">
                <span>Item</span>
              </div>
              <div className="ds-item">
                <span className="ds-item__thumb">
                  <Glyph width="26" height="26" />
                </span>
                <span className="ds-item__text">
                  <b>{garment.name}</b>
                  <small>{garment.fit}</small>
                </span>
              </div>
              <PickerField
                field={{ id: 'g-garment', label: 'Garment', value: garment.name }}
                onChange={(v) => onGarment(v)}
              />
            </section>

            <Accordion title="Appearance" open>
              {fields.details.map((f) => (
                <PickerField key={f.id} field={f} onChange={(v) => onField('details', f.id, v)} />
              ))}
              {fields.detailsAdvanced.map((f) => (
                <PickerField key={f.id} field={f} onChange={(v) => onField('detailsAdvanced', f.id, v)} />
              ))}
            </Accordion>

            <Accordion title="Design" open>
              {fields.design.map((f) => (
                <PickerField key={f.id} field={f} onChange={(v) => onField('design', f.id, v)} />
              ))}
            </Accordion>

            <Accordion title="Brand" open>
              {brandToggles}
            </Accordion>
            <Accordion title="Construction" open>
              {constructionToggles}
            </Accordion>
            <Accordion title="Manufacturing" open>
              {manufacturingToggles}
            </Accordion>
          </>
        )}

        {propTab === 'Materials' && (
          <Accordion title="Materials" open>
            {fields.materials.map((f) => (
              <PickerField key={f.id} field={f} onChange={(v) => onField('materials', f.id, v)} />
            ))}
          </Accordion>
        )}

        {propTab === 'Colors' && (
          <Accordion title="Palette" open>
            {fields.colors.map((f) => (
              <PickerField key={f.id} field={f} onChange={(v) => onField('colors', f.id, v)} />
            ))}
          </Accordion>
        )}

        {children}
      </div>
    </>
  )
}

function Accordion({ title, open, children }: { title: string; open?: boolean; children?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(!!open)
  useEffect(() => setIsOpen(!!open), [open])
  return (
    <section className="ds-group">
      <button className="ds-group__head ds-group__head--btn" type="button" onClick={() => setIsOpen((o) => !o)}>
        <span>{title}</span>
        <IcoChevron width="15" height="15" style={{ transform: isOpen ? 'none' : 'rotate(-90deg)' }} />
      </button>
      {isOpen && children && <div className="ds-fields">{children}</div>}
    </section>
  )
}

/** Progressive disclosure: professional controls one click away, never removed. */
function Advanced({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="ds-adv">
      <button
        type="button"
        className={`ds-adv__toggle${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
      >
        <IcoChevron className="ds-adv__caret" width="13" height="13" style={{ transform: isOpen ? 'none' : 'rotate(-90deg)' }} />
        Advanced
      </button>
      {isOpen && <div className="ds-adv__body">{children}</div>}
    </div>
  )
}

function ConfigToggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="ds-toggle">
      <span className="ds-toggle__label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`ds-switch${on ? ' is-on' : ''}`}
        onClick={() => onToggle(!on)}
      >
        <span className="ds-switch__knob" />
      </button>
    </div>
  )
}
