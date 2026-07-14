import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/i18n'
import { IcoSparkle } from '../../components/ui/Icons'
import { useToast } from '../../components/ui/Toast'
import { generateImages, neckLabelPrompt, removeImageBackground, hasImageAi, type NeckLabelFields } from '../../ai/imageProvider'
import './necklabel.css'

const STYLES = ['minimal', 'vintage', 'bold', 'luxury'] as const
const SIZES = ['One Size', 'XS', 'S', 'M', 'L', 'XL', 'XXL']
const CARE_OPTIONS = [
  'Machine wash cold',
  'Hand wash only',
  'Do not bleach',
  'Tumble dry low',
  'Do not tumble dry',
  'Iron low heat',
  'Do not iron',
  'Dry clean only',
  'Do not dry clean',
  'Wash inside out',
]

// Maps each care option to its i18n key. The English value stays the stored/prompt value; only the
// chip label is translated at the render site.
const CARE_I18N: Record<string, string> = {
  'Machine wash cold': 'dsDialogs.nl.care.machineWashCold',
  'Hand wash only': 'dsDialogs.nl.care.handWashOnly',
  'Do not bleach': 'dsDialogs.nl.care.doNotBleach',
  'Tumble dry low': 'dsDialogs.nl.care.tumbleDryLow',
  'Do not tumble dry': 'dsDialogs.nl.care.doNotTumbleDry',
  'Iron low heat': 'dsDialogs.nl.care.ironLowHeat',
  'Do not iron': 'dsDialogs.nl.care.doNotIron',
  'Dry clean only': 'dsDialogs.nl.care.dryCleanOnly',
  'Do not dry clean': 'dsDialogs.nl.care.doNotDryClean',
  'Wash inside out': 'dsDialogs.nl.care.washInsideOut',
}

type Props = {
  open: boolean
  onClose: () => void
  onApply: (dataUrl: string) => void
}

/**
 * Neck Label creator — a few brand/care fields plus a free prompt, then a real AI render of a
 * print-ready woven neck/care tag (Runware). Applying it stores the label as the garment's third view.
 */
export function NeckLabelModal({ open, onClose, onApply }: Props) {
  const toast = useToast()
  const t = useT()
  const live = hasImageAi()
  const [brand, setBrand] = useState('')
  const [style, setStyle] = useState<(typeof STYLES)[number]>('minimal')
  const [size, setSize] = useState('One Size')
  const [composition, setComposition] = useState('')
  const [country, setCountry] = useState('')
  const [care, setCare] = useState<string[]>([])
  const [extra, setExtra] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) return
    // Reset transient state when closed so the next open starts clean.
    abortRef.current?.abort()
    setBusy(false)
    setResult(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const toggleCare = (c: string) =>
    setCare((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))

  const generate = async () => {
    if (busy) return
    if (!live) {
      toast(t('dsDialogs.nl.gateToast'), 'info')
      return
    }
    const fields: NeckLabelFields = {
      brand,
      style,
      size,
      composition,
      country,
      care: care.join(', '),
      extra,
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setBusy(true)
    setResult(null)
    try {
      const signal = AbortSignal.any([ctrl.signal, AbortSignal.timeout(90_000)])
      const urls = await generateImages(neckLabelPrompt(fields), { n: 1, size: '1024x1024', quality: 'high', signal })
      if (ctrl.signal.aborted) return
      const raw = urls[0]
      if (!raw) {
        toast(t('dsDialogs.nl.errNoGen'), 'info')
        return
      }
      // Cut out the background so the label sits transparently on the garment.
      const cut = await removeImageBackground(raw, ctrl.signal).catch(() => null)
      if (ctrl.signal.aborted) return
      setResult(cut || raw)
    } catch (err) {
      if (!ctrl.signal.aborted) toast(err instanceof Error ? err.message : t('dsDialogs.nl.errFailed'), 'info')
    } finally {
      if (!ctrl.signal.aborted) setBusy(false)
    }
  }

  const apply = () => {
    if (!result) return
    onApply(result)
    onClose()
  }

  return createPortal(
    <div className="suite">
      <div className="nl-scrim" onClick={onClose} />
      <div className="nl" role="dialog" aria-modal="true" aria-labelledby="nl-title">
        <header className="nl__head">
          <span className="nl__title" id="nl-title">
            <IcoSparkle width="18" height="18" />
            {t('dsDialogs.nl.title')}
          </span>
          <button type="button" className="nl__x" aria-label={t('dsDialogs.nl.close')} onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <div className="nl__body">
          <div className="nl__form">
            <label className="nl__field">
              <span>{t('dsDialogs.nl.brandName')}</span>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="loom studios" />
            </label>

            <label className="nl__field">
              <span>{t('dsDialogs.nl.logoStyle')}</span>
              <div className="nl__chips">
                {STYLES.map((s) => (
                  <button key={s} type="button" className={`nl__chip${style === s ? ' is-on' : ''}`} onClick={() => setStyle(s)}>{t(`dsDialogs.nl.style.${s}`)}</button>
                ))}
              </div>
            </label>

            <div className="nl__row">
              <label className="nl__field">
                <span>{t('dsDialogs.nl.size')}</span>
                <select value={size} onChange={(e) => setSize(e.target.value)}>
                  {SIZES.map((s) => <option key={s} value={s}>{s === 'One Size' ? t('dsDialogs.nl.oneSize') : s}</option>)}
                </select>
              </label>
              <label className="nl__field">
                <span>{t('dsDialogs.nl.madeIn')}</span>
                <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Portugal" />
              </label>
            </div>

            <label className="nl__field">
              <span>{t('dsDialogs.nl.composition')}</span>
              <input value={composition} onChange={(e) => setComposition(e.target.value)} placeholder={t('dsDialogs.nl.compositionPlaceholder')} />
            </label>

            <label className="nl__field">
              <span>{t('dsDialogs.nl.careInstructions')}</span>
              <div className="nl__chips">
                {CARE_OPTIONS.map((c) => (
                  <button key={c} type="button" className={`nl__chip${care.includes(c) ? ' is-on' : ''}`} onClick={() => toggleCare(c)}>{t(CARE_I18N[c])}</button>
                ))}
              </div>
            </label>

            <label className="nl__field">
              <span>{t('dsDialogs.nl.extra')}</span>
              <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} placeholder={t('dsDialogs.nl.extraPlaceholder')} />
            </label>

            {!live && <p className="nl__note">{t('dsDialogs.nl.note')}</p>}
          </div>

          <div className="nl__preview">
            <div className="nl__stage">
              {busy ? (
                <span className="nl__spin" aria-label={t('dsDialogs.nl.generatingAria')} />
              ) : result ? (
                <img src={result} alt={t('dsDialogs.nl.resultAlt')} />
              ) : (
                <span className="nl__empty">{t('dsDialogs.nl.emptyPreview')}</span>
              )}
            </div>
            <div className="nl__actions">
              <button type="button" className="s-btn s-btn--accent" onClick={generate} disabled={busy}>
                {busy ? t('dsDialogs.nl.generating') : result ? t('dsDialogs.nl.regenerate') : t('dsDialogs.nl.generateLabel')}
              </button>
              <button type="button" className="s-btn" onClick={apply} disabled={!result || busy}>
                {t('dsDialogs.nl.useLabel')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
