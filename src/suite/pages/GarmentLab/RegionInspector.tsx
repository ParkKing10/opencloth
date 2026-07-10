/**
 * Inspector for the selected region. Exposes the real editable properties (name, visibility, lock,
 * view presence) and a REAL per-region colour picker. Material/texture/embroidery/print remain
 * honest future-capability slots (disabled), so nothing is faked.
 */
import { useEffect, useState } from 'react'
import type { EditableGarment, RegionCapabilities } from '../../garment-model/editableGarment'
import { getRegion } from '../../garment-model/regionTree'
import { COLOR_SWATCHES } from '../../garment-model/garmentColors'

// Colour replacement is now real — the remaining slots are genuinely future work.
const CAP_LABELS: { key: keyof RegionCapabilities; label: string }[] = [
  { key: 'materialAssignable', label: 'Material' },
  { key: 'textureAssignable', label: 'Texture' },
  { key: 'embroiderable', label: 'Embroidery' },
  { key: 'printable', label: 'Print placement' },
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
        <p className="eg-inspector__empty">Select a region on the flat or in the tree to inspect it.</p>
      </aside>
    )
  }

  const views = garment.views.filter((v) => region.shapes.some((s) => s.view === v.id)).map((v) => v.label)

  return (
    <aside className="eg-inspector">
      <span className="eg-inspector__eyebrow">Region</span>
      <input
        className="eg-inspector__name"
        value={nameDraft ?? region.name}
        onChange={(e) => setNameDraft(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitName()
          if (e.key === 'Escape') setNameDraft(null)
        }}
        aria-label="Region name"
      />
      <div className="eg-inspector__rows">
        <div className="eg-inspector__row">
          <span>Type</span>
          <b>{region.type}</b>
        </div>
        <div className="eg-inspector__row">
          <span>Appears in</span>
          <b>{views.join(' · ') || '—'}</b>
        </div>
        <div className="eg-inspector__row">
          <span>Shapes</span>
          <b>{region.shapes.length}</b>
        </div>
      </div>

      <div className="eg-inspector__toggles">
        <button type="button" className={`eg-toggle${region.visible ? ' is-on' : ''}`} onClick={() => onToggleVisible(region.id)}>
          {region.visible ? 'Visible' : 'Hidden'}
        </button>
        <button type="button" className={`eg-toggle${region.locked ? ' is-on' : ''}`} onClick={() => onToggleLocked(region.id)}>
          {region.locked ? 'Locked' : 'Unlocked'}
        </button>
      </div>

      <div className="eg-inspector__color">
        <div className="eg-inspector__color-head">
          <span className="eg-inspector__eyebrow">Colour</span>
          {region.appearance?.fill && (
            <button type="button" className="eg-color-clear" onClick={() => onSetColor(region.id, undefined)}>
              Reset
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
          <label className="eg-swatch eg-swatch--custom" title="Custom colour">
            <input
              type="color"
              value={region.appearance?.fill ?? '#ffffff'}
              onChange={(e) => onSetColor(region.id, e.target.value)}
              aria-label="Custom colour"
            />
          </label>
        </div>
      </div>

      <div className="eg-inspector__future">
        <span className="eg-inspector__future-label">Future capabilities</span>
        <p className="eg-inspector__future-hint">Architecture only — implemented in a later milestone. Not available today.</p>
        <div className="eg-caps">
          {CAP_LABELS.map(({ key, label }) => (
            <span key={key} className={`eg-cap${region.capabilities[key] ? '' : ' is-na'}`}>
              {label}
              <em>{region.capabilities[key] ? 'planned' : 'n/a'}</em>
            </span>
          ))}
        </div>
      </div>
    </aside>
  )
}
