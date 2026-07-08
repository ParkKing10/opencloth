import { IcoChevron } from '../../components/ui/Icons'
import type { Layer } from './LayersPanel'
import './context-panel.css'

/** One editable property of the selected object. */
export type ContextField = { id: string; label: string; value: string; swatch?: boolean }

/** Type-specific defaults — created lazily the first time a layer is selected. */
export function defaultFieldsFor(layer: Layer): ContextField[] {
  switch (layer.type) {
    case 'Logo':
      return [
        { id: 'cx-scale', label: 'Scale', value: '100%' },
        { id: 'cx-rotation', label: 'Rotation', value: '0°' },
        { id: 'cx-opacity', label: 'Opacity', value: '100%' },
        { id: 'cx-placement', label: 'Placement', value: 'Left Chest' },
        { id: 'cx-technique', label: 'Technique', value: 'Embroidery' },
        { id: 'cx-width', label: 'Width', value: '6 cm' },
      ]
    case 'Material':
      return [
        { id: 'cx-material', label: 'Material', value: 'French Terry' },
        { id: 'cx-weight', label: 'Weight', value: '450 GSM' },
        { id: 'cx-stretch', label: 'Stretch', value: '2-way' },
        { id: 'cx-texture', label: 'Texture', value: 'Brushed back' },
        { id: 'cx-composition', label: 'Composition', value: '80% Cotton / 20% Poly' },
        { id: 'cx-color', label: 'Color', value: '#2A2A2A', swatch: true },
      ]
    case 'Text':
      return [
        { id: 'cx-font', label: 'Font', value: 'Inter' },
        { id: 'cx-size', label: 'Size', value: '24 pt' },
        { id: 'cx-tracking', label: 'Tracking', value: '2%' },
        { id: 'cx-color', label: 'Color', value: '#F2F2F2', swatch: true },
        { id: 'cx-placement', label: 'Placement', value: 'Front Center' },
        { id: 'cx-technique', label: 'Technique', value: 'Screen Print' },
      ]
    default: // Graphic
      return [
        { id: 'cx-scale', label: 'Scale', value: '100%' },
        { id: 'cx-rotation', label: 'Rotation', value: '0°' },
        { id: 'cx-opacity', label: 'Opacity', value: '100%' },
        { id: 'cx-blend', label: 'Blend Mode', value: 'Normal' },
        { id: 'cx-placement', label: 'Placement', value: 'Front Center' },
        { id: 'cx-technique', label: 'Technique', value: 'Puff Print' },
        { id: 'cx-width', label: 'Width', value: '28 cm' },
      ]
  }
}

const TYPE_HINTS: Record<string, string> = {
  Graphic: 'Artwork · scale, blend & print technique',
  Logo: 'Brand mark · placement & stitching',
  Material: 'Fabric · hand-feel and composition',
  Text: 'Typography · font & printing',
  Group: 'Group · organise related layers',
}

type Props = {
  layer: Layer
  fields: ContextField[]
  memberCount?: number
  onEdit: (field: ContextField) => void
  onBack: () => void
}

/** Contextual inspector for the selected layer — only relevant controls, nothing else. */
export function ContextPanel({ layer, fields, memberCount, onEdit, onBack }: Props) {
  return (
    <div className="cx">
      <button className="cx__back" type="button" onClick={onBack}>
        <IcoChevron width="14" height="14" style={{ transform: 'rotate(90deg)' }} />
        Garment
      </button>

      <div className="cx__head">
        <span className={`cx__badge cx__badge--${layer.type.toLowerCase()}`}>{layer.type}</span>
        <b className="cx__name">{layer.name}</b>
        <small className="cx__hint">{TYPE_HINTS[layer.type] ?? 'Layer'}</small>
      </div>

      {layer.type === 'Group' ? (
        <p className="cx__group-note">
          {memberCount ?? 0} {memberCount === 1 ? 'layer' : 'layers'} inside. Select a single layer to edit its
          properties — or ungroup from the Layers panel.
        </p>
      ) : (
        <div className="cx__fields">
          {fields.map((f) => (
            <div className="ds-field" key={f.id}>
              <span className="ds-field__label">{f.label}</span>
              <button className="ds-field__value" type="button" onClick={() => onEdit(f)} title={`Edit ${f.label}`}>
                {f.swatch && <span className="ds-field__swatch" style={{ background: f.value }} />}
                <span>{f.value}</span>
                <IcoChevron width="14" height="14" />
              </button>
            </div>
          ))}
        </div>
      )}

      {layer.locked && <p className="cx__locked">This layer is locked — unlock it in the Layers panel to edit.</p>}
    </div>
  )
}
