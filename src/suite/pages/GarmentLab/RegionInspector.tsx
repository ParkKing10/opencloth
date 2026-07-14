/**
 * Inspector for the selected region. Exposes the real editable properties (name, visibility, lock,
 * view presence) and a REAL per-region colour picker. Material/texture/embroidery/print remain
 * honest future-capability slots (disabled), so nothing is faked.
 */
import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import type { EditableGarment, RegionCapabilities } from '../../garment-model/editableGarment'
import { getRegion } from '../../garment-model/regionTree'
import { COLOR_SWATCHES } from '../../garment-model/garmentColors'
import './RegionInspector.css'

// Colour replacement is now real — the remaining slots are genuinely future work.
const CAP_LABELS: { key: keyof RegionCapabilities; labelKey: string }[] = [
  { key: 'materialAssignable', labelKey: 'labPanels.cap.material' },
  { key: 'textureAssignable', labelKey: 'labPanels.cap.texture' },
  { key: 'embroiderable', labelKey: 'labPanels.cap.embroidery' },
  { key: 'printable', labelKey: 'labPanels.cap.print' },
]

type Props = {
  garment: EditableGarment
  selectedId: string | null
  onRename: (id: string, name: string) => void
  onToggleVisible: (id: string) => void
  onToggleLocked: (id: string) => void
  onSetColor: (id: string, hex: string | undefined) => void
}

export function RegionInspector({ garment, selectedId, onRename, onToggleVisible, onToggleLocked, onSetColor }: Props) {
  const t = useT()
  const region = selectedId ? getRegion(garment, selectedId) : undefined

  // Rename uses a local draft committed on blur/Enter — committing per keystroke would trim
  // spaces as you type ("Left Sleeve" became "LeftSleeve") and made the field impossible to clear.
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  useEffect(() => setNameDraft(null), [selectedId])
  const commitName = () => {
    if (nameDraft !== null && region && nameDraft.trim() && nameDraft.trim() !== region.name) {
      onRename(region.id, nameDraft)
    }
    setNameDraft(null)
  }

  if (!region) {
    return (
      <aside className="eg-inspector">
        <p className="eg-inspector__empty">{t('labPanels.insp.empty')}</p>
      </aside>
    )
  }

  const views = garment.views.filter((v) => region.shapes.some((s) => s.view === v.id)).map((v) => v.label)

  return (
    <aside className="eg-inspector">
      <span className="eg-inspector__eyebrow">{t('labPanels.insp.region')}</span>
      <input
        className="eg-inspector__name"
        value={nameDraft ?? region.name}
        onChange={(e) => setNameDraft(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitName()
          if (e.key === 'Escape') setNameDraft(null)
        }}
        aria-label={t('labPanels.insp.nameAria')}
      />
      <div className="eg-inspector__rows">
        <div className="eg-inspector__row">
          <span>{t('labPanels.insp.type')}</span>
          <b>{region.type}</b>
        </div>
        <div className="eg-inspector__row">
          <span>{t('labPanels.insp.appearsIn')}</span>
          <b>{views.join(' · ') || '—'}</b>
        </div>
        <div className="eg-inspector__row">
          <span>{t('labPanels.insp.shapes')}</span>
          <b>{region.shapes.length}</b>
        </div>
      </div>

      <div className="eg-inspector__toggles">
        <button type="button" className={`eg-toggle${region.visible ? ' is-on' : ''}`} onClick={() => onToggleVisible(region.id)}>
          {region.visible ? t('labPanels.insp.visible') : t('labPanels.insp.hidden')}
        </button>
        <button type="button" className={`eg-toggle${region.locked ? ' is-on' : ''}`} onClick={() => onToggleLocked(region.id)}>
          {region.locked ? t('labPanels.insp.locked') : t('labPanels.insp.unlocked')}
        </button>
      </div>

      <div className="eg-inspector__color">
        <div className="eg-inspector__color-head">
          <span className="eg-inspector__eyebrow">{t('labPanels.insp.colour')}</span>
          {region.appearance?.fill && (
            <button type="button" className="eg-color-clear" onClick={() => onSetColor(region.id, undefined)}>
              {t('labPanels.insp.reset')}
            </button>
          )}
        </div>
        <div className="eg-swatches">
          {COLOR_SWATCHES.map((sw) => {
            const active = region.appearance?.fill?.toLowerCase() === sw.hex.toLowerCase()
            return (
              <button
                key={sw.hex}
                type="button"
                className={`eg-swatch${active ? ' is-active' : ''}`}
                style={{ background: sw.hex }}
                title={sw.name}
                aria-label={sw.name}
                aria-pressed={active}
                onClick={() => onSetColor(region.id, sw.hex)}
              />
            )
          })}
          <label className="eg-swatch eg-swatch--custom" title={t('labPanels.insp.customColour')}>
            <input
              type="color"
              value={region.appearance?.fill ?? '#ffffff'}
              onChange={(e) => onSetColor(region.id, e.target.value)}
              aria-label={t('labPanels.insp.customColour')}
            />
          </label>
        </div>
      </div>

      <div className="eg-inspector__future">
        <span className="eg-inspector__future-label">{t('labPanels.insp.future')}</span>
        <p className="eg-inspector__future-hint">{t('labPanels.insp.futureHint')}</p>
        <div className="eg-caps">
          {CAP_LABELS.map(({ key, labelKey }) => (
            <span key={key} className={`eg-cap${region.capabilities[key] ? '' : ' is-na'}`}>
              {t(labelKey)}
              <em>{region.capabilities[key] ? t('labPanels.insp.planned') : t('labPanels.insp.na')}</em>
            </span>
          ))}
        </div>
      </div>
    </aside>
  )
}
