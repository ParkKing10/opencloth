import { IcoChevron } from '../../components/ui/Icons'
import type { Layer } from './LayersPanel'
import { FONT_OPTIONS, type CanvasObject } from './objectModel'
import { COLOR_PRESETS } from './presets'
import './object-inspector.css'

type Props = {
  layer: Layer
  onChange: (patch: Partial<CanvasObject>) => void
  onDelete: () => void
  onBack: () => void
  /** Replace an image object's source, keeping its position/size/rotation. */
  onReplace?: () => void
  /** Change stacking order of the selected object. */
  onArrange?: (op: 'front' | 'back' | 'forward' | 'backward') => void
}

const TYPE_LABEL: Record<string, string> = { text: 'Text', image: 'Image', graphic: 'Graphic' }

/** Inspector for a placed canvas object — content + transform, all live. */
export function ObjectInspector({ layer, onChange, onDelete, onBack, onReplace, onArrange }: Props) {
  const o = layer.obj
  if (!o) return null

  return (
    <div className="oi">
      <button className="oi__back" type="button" onClick={onBack}>
        <IcoChevron width="14" height="14" style={{ transform: 'rotate(90deg)' }} />
        Garment
      </button>

      <div className="oi__head">
        <span className={`oi__badge oi__badge--${o.type}`}>{TYPE_LABEL[o.type] ?? 'Object'}</span>
        <b className="oi__name">{layer.name}</b>
      </div>

      {o.type === 'text' && (
        <>
          <label className="oi__field">
            <span>Text</span>
            <input
              className="oi__input"
              value={o.text ?? ''}
              onChange={(e) => onChange({ text: e.target.value })}
              placeholder="Type your text…"
            />
          </label>

          <div className="oi__field">
            <span>Font</span>
            <div className="oi__chips">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`oi__chip${o.font === f ? ' is-active' : ''}`}
                  style={{ fontFamily: f }}
                  onClick={() => onChange({ font: f })}
                >
                  Ag
                </button>
              ))}
            </div>
          </div>

          <StyleRow
            bold={(o.weight ?? 400) >= 700}
            italic={!!o.italic}
            underline={!!o.underline}
            onBold={(v) => onChange({ weight: v ? 700 : 400 })}
            onItalic={(v) => onChange({ italic: v })}
            onUnderline={(v) => onChange({ underline: v })}
          />
          <RangeRow label="Weight" min={300} max={900} step={100} value={o.weight ?? 800} onChange={(v) => onChange({ weight: v })} suffix="" />
          <RangeRow label="Tracking" min={-2} max={12} step={0.5} value={o.letterSpacing ?? 2} onChange={(v) => onChange({ letterSpacing: v })} suffix="px" />
          <RangeRow label="Line height" min={0.8} max={2.2} step={0.05} value={o.lineHeight ?? 1.1} onChange={(v) => onChange({ lineHeight: Math.round(v * 100) / 100 })} suffix="" />
          <AlignRow value={o.align ?? 'center'} onChange={(v) => onChange({ align: v })} />
          <ColorRow value={o.color ?? '#F4F4F6'} onChange={(v) => onChange({ color: v })} />
        </>
      )}

      {o.type === 'image' && (
        <div className="oi__field">
          <span>Image</span>
          <div className="oi__chips">
            {onReplace && (
              <button type="button" className="oi__chip oi__chip--wide" onClick={onReplace}>
                Replace
              </button>
            )}
            <button type="button" className={`oi__chip${o.flipH ? ' is-active' : ''}`} title="Flip horizontal" aria-pressed={!!o.flipH} onClick={() => onChange({ flipH: !o.flipH })}>
              ⇋
            </button>
            <button type="button" className={`oi__chip${o.flipV ? ' is-active' : ''}`} title="Flip vertical" aria-pressed={!!o.flipV} onClick={() => onChange({ flipV: !o.flipV })}>
              ⇅
            </button>
          </div>
        </div>
      )}

      {o.type === 'graphic' && (
        <>
          <ColorRow value={o.color ?? '#F4F4F6'} onChange={(v) => onChange({ color: v })} />
          <div className="oi__field">
            <span>Flip</span>
            <div className="oi__chips">
              <button type="button" className={`oi__chip${o.flipH ? ' is-active' : ''}`} title="Flip horizontal" aria-pressed={!!o.flipH} onClick={() => onChange({ flipH: !o.flipH })}>
                ⇋
              </button>
              <button type="button" className={`oi__chip${o.flipV ? ' is-active' : ''}`} title="Flip vertical" aria-pressed={!!o.flipV} onClick={() => onChange({ flipV: !o.flipV })}>
                ⇅
              </button>
            </div>
          </div>
        </>
      )}

      <div className="oi__divider" />

      {onArrange && (
        <div className="oi__field">
          <span>Arrange</span>
          <div className="oi__chips">
            <button type="button" className="oi__chip" title="Send to back" onClick={() => onArrange('back')}>⤓</button>
            <button type="button" className="oi__chip" title="Send backward" onClick={() => onArrange('backward')}>↓</button>
            <button type="button" className="oi__chip" title="Bring forward" onClick={() => onArrange('forward')}>↑</button>
            <button type="button" className="oi__chip" title="Bring to front" onClick={() => onArrange('front')}>⤒</button>
          </div>
        </div>
      )}

      <RangeRow label="Size" min={6} max={140} step={1} value={Math.round(o.width * 100)} onChange={(v) => onChange({ width: v / 100 })} suffix="%" />
      <RangeRow label="Rotation" min={-180} max={180} step={1} value={o.rotation} onChange={(v) => onChange({ rotation: v })} suffix="°" />
      <RangeRow label="Opacity" min={10} max={100} step={1} value={Math.round(o.opacity * 100)} onChange={(v) => onChange({ opacity: v / 100 })} suffix="%" />

      <div className="oi__actions">
        <button type="button" className="oi__reset" onClick={() => onChange({ rotation: 0 })}>
          Reset rotation
        </button>
        <button type="button" className="oi__delete" onClick={onDelete}>
          Delete
        </button>
      </div>

      <p className="oi__tip">Drag on the garment to move · corner to resize · top handle to rotate · double-click text to edit.</p>
    </div>
  )
}

function RangeRow({
  label,
  min,
  max,
  step,
  value,
  suffix,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  suffix: string
  onChange: (v: number) => void
}) {
  return (
    <label className="oi__range">
      <span className="oi__range-label">
        {label}
        <b>
          {value}
          {suffix}
        </b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function StyleRow({
  bold,
  italic,
  underline,
  onBold,
  onItalic,
  onUnderline,
}: {
  bold: boolean
  italic: boolean
  underline: boolean
  onBold: (v: boolean) => void
  onItalic: (v: boolean) => void
  onUnderline: (v: boolean) => void
}) {
  return (
    <div className="oi__field">
      <span>Style</span>
      <div className="oi__chips">
        <button type="button" className={`oi__chip${bold ? ' is-active' : ''}`} style={{ fontWeight: 800 }} aria-pressed={bold} title="Bold" onClick={() => onBold(!bold)}>
          B
        </button>
        <button type="button" className={`oi__chip${italic ? ' is-active' : ''}`} style={{ fontStyle: 'italic' }} aria-pressed={italic} title="Italic" onClick={() => onItalic(!italic)}>
          I
        </button>
        <button type="button" className={`oi__chip${underline ? ' is-active' : ''}`} style={{ textDecoration: 'underline' }} aria-pressed={underline} title="Underline" onClick={() => onUnderline(!underline)}>
          U
        </button>
      </div>
    </div>
  )
}

function AlignRow({ value, onChange }: { value: 'left' | 'center' | 'right'; onChange: (v: 'left' | 'center' | 'right') => void }) {
  const opts: { id: 'left' | 'center' | 'right'; lines: string[] }[] = [
    { id: 'left', lines: ['M4 6h16', 'M4 12h10', 'M4 18h14'] },
    { id: 'center', lines: ['M4 6h16', 'M7 12h10', 'M5 18h14'] },
    { id: 'right', lines: ['M4 6h16', 'M10 12h10', 'M6 18h14'] },
  ]
  return (
    <div className="oi__field">
      <span>Alignment</span>
      <div className="oi__chips">
        {opts.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`oi__chip${value === o.id ? ' is-active' : ''}`}
            aria-label={`Align ${o.id}`}
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {o.lines.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

function ColorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="oi__field">
      <span>Color</span>
      <div className="oi__swatches">
        {COLOR_PRESETS.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`oi__swatch${value.toLowerCase() === c.value.toLowerCase() ? ' is-active' : ''}`}
            style={{ background: c.swatch }}
            title={c.hint}
            onClick={() => onChange(c.value)}
          />
        ))}
        <label className="oi__swatch oi__swatch--custom" title="Custom color">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
          +
        </label>
      </div>
    </div>
  )
}
