import { useT } from '@/i18n'
import { IcoChevron, IcoSparkle } from '../../components/ui/Icons'
import type { Layer } from './LayersPanel'
import { PickerField } from './PickerField'
import type { ObjectNote } from './studioModel'
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
        { id: 'cx-material', label: 'Material', value: 'Heavy French Terry 450 GSM' },
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
  Graphic: 'dsInspectors.hint.graphic',
  Logo: 'dsInspectors.hint.logo',
  Material: 'dsInspectors.hint.material',
  Text: 'dsInspectors.hint.text',
  Group: 'dsInspectors.hint.group',
}

// Display-label translation keys for the default context fields (keyed by field id). The field
// VALUE stays as authored (it matches the English preset options), only the label is localized.
const CX_LABELS: Record<string, string> = {
  'cx-scale': 'dsInspectors.prop.scale',
  'cx-rotation': 'dsInspectors.prop.rotation',
  'cx-opacity': 'dsInspectors.prop.opacity',
  'cx-placement': 'dsInspectors.prop.placement',
  'cx-technique': 'dsInspectors.prop.technique',
  'cx-width': 'dsInspectors.prop.width',
  'cx-material': 'dsInspectors.prop.material',
  'cx-weight': 'dsInspectors.prop.weightFabric',
  'cx-stretch': 'dsInspectors.prop.stretch',
  'cx-texture': 'dsInspectors.prop.texture',
  'cx-composition': 'dsInspectors.prop.composition',
  'cx-color': 'dsInspectors.prop.color',
  'cx-font': 'dsInspectors.prop.font',
  'cx-size': 'dsInspectors.prop.size',
  'cx-tracking': 'dsInspectors.prop.tracking',
  'cx-blend': 'dsInspectors.prop.blendMode',
}

type Props = {
  layer: Layer
  fields: ContextField[]
  memberCount?: number
  /** The AI's note about THIS object (null = nothing to say). */
  aiNote: ObjectNote | null
  onFieldChange: (fieldId: string, value: string) => void
  onApplyNote: (note: ObjectNote) => void
  onBack: () => void
}

/** Contextual inspector for the selected layer — only relevant controls, nothing else. */
export function ContextPanel({ layer, fields, memberCount, aiNote, onFieldChange, onApplyNote, onBack }: Props) {
  const t = useT()
  return (
    <div className="cx">
      <button className="cx__back" type="button" onClick={onBack}>
        <IcoChevron width="14" height="14" style={{ transform: 'rotate(90deg)' }} />
        {t('dsInspectors.prop.garment')}
      </button>

      <div className="cx__head">
        <span className={`cx__badge cx__badge--${layer.type.toLowerCase()}`}>{layer.type}</span>
        <b className="cx__name">{layer.name}</b>
        <small className="cx__hint">{t(TYPE_HINTS[layer.type] ?? 'dsInspectors.hint.layer')}</small>
      </div>

      {aiNote && (
        <div className="cx__ai">
          <span className="cx__ai-mark" aria-hidden>
            <IcoSparkle width="14" height="14" />
          </span>
          <div className="cx__ai-body">
            <span className="cx__ai-eyebrow">loom studios AI</span>
            <p>{aiNote.text}</p>
            <button type="button" className="cx__ai-apply" onClick={() => onApplyNote(aiNote)}>
              {aiNote.actionLabel}
            </button>
          </div>
        </div>
      )}

      {layer.type === 'Group' ? (
        <p className="cx__group-note">
          {memberCount === 1
            ? t('dsInspectors.groupNoteOne', { n: memberCount ?? 0 })
            : t('dsInspectors.groupNoteMany', { n: memberCount ?? 0 })}
        </p>
      ) : (
        <div className="cx__fields">
          {fields.map((f) => (
            <PickerField
              key={f.id}
              field={CX_LABELS[f.id] ? { ...f, label: t(CX_LABELS[f.id]) } : f}
              onChange={(v) => onFieldChange(f.id, v)}
              disabled={!!layer.locked}
            />
          ))}
        </div>
      )}

      {layer.locked && <p className="cx__locked">{t('dsInspectors.contextLocked')}</p>}
    </div>
  )
}
