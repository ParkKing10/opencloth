import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { IcoChevron } from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { PickerField, type PickerFieldData } from './PickerField'
import type { StudioConfig } from './studioModel'
import type { StudioMode } from './CommandBar'

export type PropField = PickerFieldData

const TAB_KEYS: Record<'Properties' | 'Materials' | 'Colors', string> = {
  Properties: 'dsInspectors.tab.properties',
  Materials: 'dsInspectors.tab.materials',
  Colors: 'dsInspectors.tab.colors',
}

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
  const t = useT()
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
    { id: 'g-garment', label: t('dsInspectors.prop.garment'), value: garment.name },
    heroField('d-fabric', t('dsInspectors.prop.fabric')),
    heroField('d-fit', t('dsInspectors.prop.fit')),
    detail('d-color') ? { ...detail('d-color')!, label: t('dsInspectors.prop.color') } : null,
  ]

  const brandToggles = (
    <>
      <ConfigToggle label={t('dsInspectors.toggle.neckLabel')} on={config.neckLabel} onToggle={(v) => onConfig('neckLabel', v)} />
      <ConfigToggle label={t('dsInspectors.toggle.careLabel')} on={config.careLabel} onToggle={(v) => onConfig('careLabel', v)} />
    </>
  )
  const constructionToggles = (
    <ConfigToggle label={t('dsInspectors.toggle.construction')} on={config.construction} onToggle={(v) => onConfig('construction', v)} />
  )
  const manufacturingToggles = (
    <>
      <ConfigToggle label={t('dsInspectors.toggle.tolerance')} on={config.tolerance} onToggle={(v) => onConfig('tolerance', v)} />
      <ConfigToggle label={t('dsInspectors.toggle.productionNotes')} on={config.productionNotes} onToggle={(v) => onConfig('productionNotes', v)} />
      <ConfigToggle label={t('dsInspectors.toggle.packaging')} on={config.packaging} onToggle={(v) => onConfig('packaging', v)} />
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
              <small>{t('dsInspectors.fitSuffix', { fit: detail('d-fit')?.value ?? garment.fit })}</small>
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

        <Accordion title={t('dsInspectors.acc.design')} open>
          {fields.design.map((f) => (
            <PickerField key={f.id} field={f} onChange={(v) => onField('design', f.id, v)} />
          ))}
        </Accordion>

        <Advanced>
          <Accordion title={t('dsInspectors.acc.details')} open>
            {fields.details
              .filter((f) => !['d-fabric', 'd-fit', 'd-color'].includes(f.id))
              .map((f) => (
                <PickerField key={f.id} field={f} onChange={(v) => onField('details', f.id, v)} />
              ))}
            {fields.detailsAdvanced.map((f) => (
              <PickerField key={f.id} field={f} onChange={(v) => onField('detailsAdvanced', f.id, v)} />
            ))}
          </Accordion>
          <Accordion title={t('dsInspectors.acc.brand')} open>
            {brandToggles}
          </Accordion>
          <Accordion title={t('dsInspectors.acc.construction')} open>
            {constructionToggles}
          </Accordion>
          <Accordion title={t('dsInspectors.acc.manufacturing')} open>
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
        {(['Properties', 'Materials', 'Colors'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`ds-proptab${propTab === tab ? ' is-active' : ''}`}
            onClick={() => setPropTab(tab)}
          >
            {t(TAB_KEYS[tab])}
          </button>
        ))}
      </div>

      <div className="ds-right__scroll">
        {propTab === 'Properties' && (
          <>
            <section className="ds-group">
              <div className="ds-group__head">
                <span>{t('dsInspectors.item')}</span>
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
                field={{ id: 'g-garment', label: t('dsInspectors.prop.garment'), value: garment.name }}
                onChange={(v) => onGarment(v)}
              />
            </section>

            <Accordion title={t('dsInspectors.acc.appearance')} open>
              {fields.details.map((f) => (
                <PickerField key={f.id} field={f} onChange={(v) => onField('details', f.id, v)} />
              ))}
              {fields.detailsAdvanced.map((f) => (
                <PickerField key={f.id} field={f} onChange={(v) => onField('detailsAdvanced', f.id, v)} />
              ))}
            </Accordion>

            <Accordion title={t('dsInspectors.acc.design')} open>
              {fields.design.map((f) => (
                <PickerField key={f.id} field={f} onChange={(v) => onField('design', f.id, v)} />
              ))}
            </Accordion>

            <Accordion title={t('dsInspectors.acc.brand')} open>
              {brandToggles}
            </Accordion>
            <Accordion title={t('dsInspectors.acc.construction')} open>
              {constructionToggles}
            </Accordion>
            <Accordion title={t('dsInspectors.acc.manufacturing')} open>
              {manufacturingToggles}
            </Accordion>
          </>
        )}

        {propTab === 'Materials' && (
          <Accordion title={t('dsInspectors.acc.materials')} open>
            {fields.materials.map((f) => (
              <PickerField key={f.id} field={f} onChange={(v) => onField('materials', f.id, v)} />
            ))}
          </Accordion>
        )}

        {propTab === 'Colors' && (
          <Accordion title={t('dsInspectors.acc.palette')} open>
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
  const t = useT()
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
        {t('dsInspectors.advanced')}
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
