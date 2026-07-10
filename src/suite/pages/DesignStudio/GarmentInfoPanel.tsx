import { categoryLabel, type GarmentCategoryId, type GarmentRepresentation, type GarmentViews } from '../../garments/types'
import { viewsSummary } from '../../garments/import/detect'

type Props = {
  name: string
  brand?: string
  category?: GarmentCategoryId
  views: GarmentViews
  /** The garment's real representations (from getGarment). */
  representations: GarmentRepresentation[]
  /** True when the garment has a real editable region tree (its parts show as layers), even if the
   *  Garment Editor button is gated (e.g. the user is signed out). Keeps the status honest. */
  hasRegionTree?: boolean
  /** When set, this catalog garment has a real region tree — open it in the Garment Editor for
   *  full per-region control (front + back, every part a layer). */
  onEditRegions?: () => void
}

/** Formats that can be opened/edited as vector/source artwork. */
const EDITABLE_FORMATS = new Set(['ai', 'svg', 'pdf', 'eps', 'dxf'])

/**
 * The default right inspector for an imported garment — honest, read-only facts only.
 * No fabric/weight/color pickers, no manufacturing toggles: those imply design/spec data
 * we do not have for a freshly selected blank. Real design controls appear only once the
 * user adds a layer (then the object/context inspector takes over).
 */
export function GarmentInfoPanel({ name, brand, category, views, representations, hasRegionTree, onEditRegions }: Props) {
  // Real representations only — skip the auto-generated thumbnail.
  const realReps = representations.filter((r) => r.kind !== 'thumbnail')
  const formats = Array.from(new Set(realReps.map((r) => r.format.toUpperCase()))).sort()
  const hasEditableSource = realReps.some((r) => EDITABLE_FORMATS.has(r.format.toLowerCase()))

  return (
    <div className="gi2">
      <div className="gi2__id">
        <span className="gi2__eyebrow">Garment</span>
        <b className="gi2__name" title={name}>
          {name}
        </b>
        <div className="gi2__tags">
          {category && <span className="gi2__cat">{categoryLabel(category)}</span>}
          {brand && <span className="gi2__brand">{brand}</span>}
        </div>
      </div>

      <Row label="Available views">
        <span className="gi2__value">{viewsSummary(views)}</span>
      </Row>

      <Row label="Representations">
        {formats.length > 0 ? (
          <span className="gi2__chips">
            {formats.map((f) => (
              <span className="gi2__chip" key={f}>
                {f}
              </span>
            ))}
          </span>
        ) : (
          <span className="gi2__muted">—</span>
        )}
      </Row>

      <Row label="Editable source">
        <span className={`gi2__status${hasEditableSource || onEditRegions || hasRegionTree ? ' is-yes' : ''}`}>
          {onEditRegions || hasRegionTree
            ? 'Yes — editable region tree'
            : hasEditableSource
              ? 'Yes — vector source available'
              : 'No — preview only'}
        </span>
      </Row>

      {onEditRegions ? (
        <>
          <button type="button" className="gi2__edit" onClick={onEditRegions}>
            Open in Garment Editor →
          </button>
          <p className="gi2__hint">
            The Studio adds graphics &amp; prints on top. To control every region (body, sleeves, collar,
            buttons…) with front + back views, open the Garment Editor.
          </p>
        </>
      ) : (
        <p className="gi2__hint">Add text or graphics from the toolbar to start designing on this blank.</p>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="gi2__row">
      <span className="gi2__label">{label}</span>
      {children}
    </div>
  )
}
