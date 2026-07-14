/* Small shared controls used by both Explainer modes. */

export function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
  disabled,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  fmt: (v: number) => string
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <label className={`xp-slider${disabled ? ' is-disabled' : ''}`}>
      <span className="xp-slider__top">
        <span>{label}</span>
        <b>{fmt(value)}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  )
}

export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`xp-switch${on ? ' is-on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span />
    </button>
  )
}
