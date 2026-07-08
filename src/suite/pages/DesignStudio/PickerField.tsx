import { useEffect, useRef, useState } from 'react'
import { IcoChevron } from '../../components/ui/Icons'
import { FIELD_PRESETS } from './presets'
import './picker.css'

export type PickerFieldData = { id: string; label: string; value: string; swatch?: boolean }

type Props = {
  field: PickerFieldData
  onChange: (value: string) => void
  disabled?: boolean
  /** Larger, object-first presentation (the simple beginner rows). */
  hero?: boolean
}

/**
 * An editable property row. Clicking opens an anchored picker with real preset
 * options (plus a custom input) — no native prompt dialogs anywhere.
 */
export function PickerField({ field, onChange, disabled, hero }: Props) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const options = FIELD_PRESETS[field.id]
  const hasSwatches = !!options?.some((o) => o.swatch)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(value: string) {
    setOpen(false)
    setCustom('')
    if (value.trim() && value !== field.value) onChange(value.trim())
  }

  const currentHint = options?.find((o) => o.value === field.value)?.hint

  return (
    <div className={`pk${hero ? ' pk--hero' : ''}`} ref={wrapRef}>
      <span className="pk__label">{field.label}</span>
      <button
        type="button"
        className={`pk__value${open ? ' is-open' : ''}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={disabled ? 'Locked' : `Change ${field.label}`}
      >
        {field.swatch && <span className="pk__swatch" style={{ background: field.value }} />}
        <span className="pk__text">
          <b>{hero && currentHint && field.swatch ? currentHint : field.value}</b>
          {hero && currentHint && !field.swatch && <small>{currentHint}</small>}
        </span>
        <IcoChevron width="14" height="14" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div className="pk__pop" role="listbox" aria-label={`${field.label} options`}>
          {options && hasSwatches && (
            <div className="pk__swatches">
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={o.value === field.value}
                  className={`pk__chip${o.value === field.value ? ' is-active' : ''}`}
                  style={{ background: o.swatch }}
                  title={o.hint ?? o.value}
                  onClick={() => pick(o.value)}
                />
              ))}
            </div>
          )}
          {options && !hasSwatches && (
            <div className="pk__opts">
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={o.value === field.value}
                  className={`pk__opt${o.value === field.value ? ' is-active' : ''}`}
                  onClick={() => pick(o.value)}
                >
                  <b>{o.value}</b>
                  {o.hint && <small>{o.hint}</small>}
                </button>
              ))}
            </div>
          )}
          <form
            className="pk__custom"
            onSubmit={(e) => {
              e.preventDefault()
              pick(custom)
            }}
          >
            <input
              placeholder={options ? 'Custom…' : `Set ${field.label.toLowerCase()}…`}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              aria-label={`Custom ${field.label}`}
              autoFocus={!options}
            />
            <button type="submit" disabled={!custom.trim()}>
              Set
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
