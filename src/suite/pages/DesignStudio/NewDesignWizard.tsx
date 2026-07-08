import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import './wizard.css'

export type WizardResult = {
  kind: GarmentKind
  garmentName: string
  fit: string
  fabric: string
  weight: string
  colorHex: string
  colorName: string
}

type GarmentOption = { kind: GarmentKind; name: string; vibe: string }
type FitOption = { name: string; note: string }

/** Proportions of the fit silhouette — same tee, different cut. */
type FitShape = { body: number; hem: number; shoulder: number; sleeveX: number; sleeveY: number }

const FIT_SHAPES: Record<string, FitShape> = {
  Oversized: { body: 30, hem: 76, shoulder: 27, sleeveX: 13, sleeveY: 12 },
  Regular: { body: 23, hem: 71, shoulder: 22, sleeveX: 10, sleeveY: 9 },
  Boxy: { body: 30, hem: 58, shoulder: 27, sleeveX: 12, sleeveY: 9 },
  Cropped: { body: 23, hem: 52, shoulder: 22, sleeveX: 10, sleeveY: 9 },
  Slim: { body: 17, hem: 71, shoulder: 18, sleeveX: 8, sleeveY: 8 },
}

/** A tee outline whose cut changes with the fit — the shape IS the explanation. */
function FitSilhouette({ fit }: { fit: string }) {
  const s = FIT_SHAPES[fit] ?? FIT_SHAPES.Regular
  const cx = 50
  const top = 14
  const cuffY = top + s.sleeveY + 9
  const d = [
    // right half: neck → shoulder → sleeve → underarm → hem
    `M ${cx + 8} ${top}`,
    `L ${cx + s.shoulder} ${top + 2}`,
    `L ${cx + s.shoulder + s.sleeveX} ${top + 2 + s.sleeveY}`,
    `L ${cx + s.body + 1} ${cuffY}`,
    `L ${cx + s.body} ${s.hem - 4}`,
    `Q ${cx + s.body} ${s.hem} ${cx + s.body - 4} ${s.hem}`,
    // hem
    `L ${cx - s.body + 4} ${s.hem}`,
    `Q ${cx - s.body} ${s.hem} ${cx - s.body} ${s.hem - 4}`,
    // left half mirrored back up
    `L ${cx - s.body - 1} ${cuffY}`,
    `L ${cx - s.shoulder - s.sleeveX} ${top + 2 + s.sleeveY}`,
    `L ${cx - s.shoulder} ${top + 2}`,
    `L ${cx - 8} ${top}`,
    // neckline
    `Q ${cx} ${top + 9} ${cx + 8} ${top}`,
  ].join(' ')
  return (
    <svg className="wz-fit-svg" viewBox="0 0 100 84" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
type FabricOption = { weight: string; name: string; note: string; popular?: boolean }
type ColorOption = { name: string; hex: string }

const GARMENTS: GarmentOption[] = [
  { kind: 'hoodie', name: 'Hoodie', vibe: 'The streetwear staple' },
  { kind: 'tee', name: 'T-Shirt', vibe: 'Your everyday canvas' },
  { kind: 'pants', name: 'Cargo Pants', vibe: 'Utility meets street' },
  { kind: 'jacket', name: 'Bomber Jacket', vibe: 'Statement outerwear' },
  { kind: 'cap', name: 'Dad Cap', vibe: 'The effortless finisher' },
]

const FITS: FitOption[] = [
  { name: 'Oversized', note: 'Roomy, drapey, street' },
  { name: 'Regular', note: 'True to size' },
  { name: 'Boxy', note: 'Short + wide' },
  { name: 'Cropped', note: 'Above the waist' },
  { name: 'Slim', note: 'Close to the body' },
]

const FABRICS: FabricOption[] = [
  { weight: '240 GSM', name: 'Lightweight Jersey', note: 'Summer tees' },
  { weight: '320 GSM', name: 'Midweight Twill', note: 'Everyday structure' },
  { weight: '450 GSM', name: 'Heavy French Terry', note: 'Premium hoodies — most popular', popular: true },
  { weight: '520 GSM', name: 'Ultra Heavyweight', note: 'Luxury drop' },
]

const COLORS: ColorOption[] = [
  { name: 'Vintage Black', hex: '#1E1E1E' },
  { name: 'Off White', hex: '#F4F4F6' },
  { name: 'Heather Grey', hex: '#8A8A96' },
  { name: 'Washed Beige', hex: '#D8C9B0' },
  { name: 'Navy', hex: '#22304A' },
  { name: 'Forest', hex: '#3E4A3A' },
  { name: 'Burgundy', hex: '#5C2E35' },
  { name: 'Lime Punch', hex: '#D8FF3E' },
]

const STEP_TITLES = ['What do you want to create?', 'Choose a fit', 'Pick your fabric', 'Choose a color'] as const
const STEP_LABELS = ['Garment', 'Fit', 'Fabric', 'Color'] as const
const ADVANCE_DELAY_MS = 200

export function NewDesignWizard({
  open,
  onComplete,
  onClose,
}: {
  open: boolean
  onComplete: (result: WizardResult) => void
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const [garment, setGarment] = useState<GarmentOption | null>(null)
  const [fit, setFit] = useState<string | null>(null)
  const [fabric, setFabric] = useState<FabricOption | null>(null)
  const [color, setColor] = useState<ColorOption | null>(null)
  const timerRef = useRef<number | null>(null)

  // Reset every time the wizard opens; clear any pending auto-advance on close.
  useEffect(() => {
    if (!open) return
    setStep(0)
    setDir(1)
    setGarment(null)
    setFit(null)
    setFabric(null)
    setColor(null)
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function advance(next: number) {
    clearTimer()
    setDir(1)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setStep(next)
    }, ADVANCE_DELAY_MS)
  }

  function goBack() {
    clearTimer()
    setDir(-1)
    setStep((s) => Math.max(0, s - 1))
  }

  function jumpTo(index: number) {
    if (index >= step) return
    clearTimer()
    setDir(-1)
    setStep(index)
  }

  function pickGarment(option: GarmentOption) {
    setGarment(option)
    advance(1)
  }

  function pickFit(option: FitOption) {
    setFit(option.name)
    advance(2)
  }

  function pickFabric(option: FabricOption) {
    setFabric(option)
    advance(3)
  }

  function handleComplete() {
    if (!garment || !fit || !fabric || !color) return
    onComplete({
      kind: garment.kind,
      garmentName: garment.name,
      fit,
      fabric: `${fabric.name} ${fabric.weight}`,
      weight: fabric.weight,
      colorHex: color.hex,
      colorName: color.name,
    })
  }

  return createPortal(
    <div className="suite">
      <div className="wz-overlay" role="dialog" aria-modal="true" aria-labelledby="wz-step-title">
        {step > 0 && (
          <button type="button" className="wz-back" onClick={goBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
        )}

        <div className="wz-shell">
          <header className="wz-chrome">
            <span className="wz-eyebrow">New Design</span>
            <h1 id="wz-step-title" className="wz-title">
              {STEP_TITLES[step]}
            </h1>
            <div className="wz-progress" aria-label={`Step ${step + 1} of ${STEP_LABELS.length}`}>
              {STEP_LABELS.map((label, i) => {
                const state = i < step ? 'done' : i === step ? 'current' : 'todo'
                return (
                  <button
                    key={label}
                    type="button"
                    className={`wz-progress__seg is-${state}`}
                    disabled={i >= step}
                    onClick={() => jumpTo(i)}
                    aria-label={i < step ? `Back to step ${i + 1}: ${label}` : `Step ${i + 1}: ${label}`}
                    aria-current={i === step ? 'step' : undefined}
                  />
                )
              })}
            </div>
          </header>

          <div key={step} className={`wz-step wz-step--${dir === 1 ? 'fwd' : 'back'}`}>
            {step === 0 && (
              <div className="wz-grid wz-grid--five">
                {GARMENTS.map((g) => {
                  const Glyph = GARMENT_GLYPHS[g.kind]
                  const selected = garment?.kind === g.kind
                  return (
                    <button
                      key={g.kind}
                      type="button"
                      className={`wz-card${selected ? ' is-selected' : ''}`}
                      onClick={() => pickGarment(g)}
                      aria-pressed={selected}
                    >
                      <span className="wz-card__figure">
                        <Glyph className="wz-card__glyph" width={64} height={64} />
                      </span>
                      <span className="wz-card__name">{g.name}</span>
                      <span className="wz-card__vibe">{g.vibe}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {step === 1 && (
              <div className="wz-grid wz-grid--five">
                {FITS.map((f) => {
                  const selected = fit === f.name
                  return (
                    <button
                      key={f.name}
                      type="button"
                      className={`wz-card${selected ? ' is-selected' : ''}`}
                      onClick={() => pickFit(f)}
                      aria-pressed={selected}
                    >
                      <span className="wz-card__figure">
                        <FitSilhouette fit={f.name} />
                      </span>
                      <span className="wz-card__name">{f.name}</span>
                      <span className="wz-card__vibe">{f.note}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {step === 2 && (
              <div className="wz-grid wz-grid--four">
                {FABRICS.map((f) => {
                  const selected = fabric?.weight === f.weight
                  return (
                    <button
                      key={f.weight}
                      type="button"
                      className={`wz-card wz-card--fabric${selected ? ' is-selected' : ''}`}
                      onClick={() => pickFabric(f)}
                      aria-pressed={selected}
                    >
                      {f.popular && <span className="wz-card__flag">Popular</span>}
                      <span className="wz-card__weight">{f.weight}</span>
                      <span className="wz-card__name">{f.name}</span>
                      <span className="wz-card__vibe">{f.note}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {step === 3 && (
              <>
                <div className="wz-grid wz-grid--colors">
                  {COLORS.map((c) => {
                    const selected = color?.hex === c.hex
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        className={`wz-swatch${selected ? ' is-selected' : ''}`}
                        onClick={() => setColor(c)}
                        aria-pressed={selected}
                      >
                        <span className="wz-swatch__dot" style={{ backgroundColor: c.hex }} aria-hidden="true" />
                        <span className="wz-swatch__name">{c.name}</span>
                      </button>
                    )
                  })}
                </div>
                {color && (
                  <div className="wz-cta-row">
                    <button type="button" className="wz-cta" onClick={handleComplete}>
                      Start designing <span aria-hidden="true">→</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <footer className="wz-foot">
            <button type="button" className="wz-skip" onClick={onClose}>
              Skip — start blank
            </button>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  )
}
