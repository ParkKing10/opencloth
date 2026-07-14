/**
 * Create-Garment wizard (3 steps): how to start → details → review. Every path produces a REAL
 * editable garment and files it in the collection; the editor never opens automatically.
 *
 * Honesty notes surfaced in the UI:
 * - AI: with no OpenAI key the deterministic placeholder starts you from the closest real template.
 * - Upload: pack→regions conversion is a future worker; the file names a garment started from a template.
 */
import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { useT } from '@/i18n'
import type { EditableGarment } from '../../garment-model/editableGarment'
import { GARMENT_TEMPLATES } from '../../garment-model/garmentTemplates'
import { buildFromPrompt, buildFromTemplate, buildFromUpload } from '../../garment-model/garmentFactory'
import { garmentThumbnailDataUrl } from '../../garment-model/garmentThumbnail'
import { createGarment, type GarmentOrigin, type GarmentSummary } from '../../garment-model/garmentLibrary'
import { hasApiKey } from '../../garment-model/aiSettings'
import { analyzeGarment } from '../../garment-model/analysis/analyzeGarment'
import { readGarmentFile } from '../../garment-model/analysis/fileReader'
import type { MapReport } from '../../garment-model/analysis/smartGarmentMapping'
import './garments.css'

type Method = 'ai' | 'upload' | 'blank'
type Built = { garment: EditableGarment; name: string; category: string }

const AI_EXAMPLES = ['oversizedHoodie', 'luxuryBomber', 'doubleBreastedBlazer', 'streetwearCargos']

export function CreateGarmentWizard({ onClose, onCreated }: { onClose: () => void; onCreated: (s: GarmentSummary) => void }) {
  const { user } = useAuth()
  const toast = useToast()
  const t = useT()

  const [step, setStep] = useState(1)
  const [method, setMethod] = useState<Method>('ai')
  const [prompt, setPrompt] = useState('')
  const [templateId, setTemplateId] = useState('tpl-hoodie')
  const [uploadName, setUploadName] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [built, setBuilt] = useState<Built | null>(null)
  const [report, setReport] = useState<MapReport | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [name, setName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const templateThumbs = useMemo(() => GARMENT_TEMPLATES.map((t) => ({ ...t, thumb: garmentThumbnailDataUrl(t.make()) })), [])
  const builtThumb = useMemo(() => (built ? garmentThumbnailDataUrl(built.garment) : ''), [built])

  const canAdvance = step === 1 || (step === 2 && (method === 'ai' ? prompt.trim().length > 0 : method === 'upload' ? uploadName.length > 0 : true))

  const build = (): Built => {
    if (method === 'ai') return buildFromPrompt(prompt)
    if (method === 'upload') return buildFromUpload(uploadName || 'Uploaded Garment')
    return buildFromTemplate(templateId)
  }

  const goReview = async () => {
    setReport(null)
    // SVG upload → run the Garment Analysis Engine (geometry → editable Smart Garment).
    if (method === 'upload' && uploadFile) {
      setAnalyzing(true)
      try {
        const read = await readGarmentFile(uploadFile)
        if (read.kind === 'svg' && read.text) {
          const result = await analyzeGarment({ text: read.text, filename: uploadFile.name })
          setBuilt({ garment: result.garment, name: result.garment.name, category: result.garment.category })
          setName(result.garment.name)
          setReport(result.report)
          setAnalyzing(false)
          setStep(3)
          return
        }
      } catch {
        /* fall through to the honest template fallback */
      }
      setAnalyzing(false)
    }
    const b = build()
    setBuilt(b)
    setName(b.name)
    setStep(3)
  }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) {
      setUploadName(f.name)
      setUploadFile(f)
    }
  }

  const finish = () => {
    if (!user?.id || !built) return
    const origin: GarmentOrigin = method === 'blank' ? 'blank' : method
    const summary = createGarment(user.id, built.garment, { name, category: built.category, origin })
    toast(t('garments.wizard.createdToast'), 'success')
    onCreated(summary)
  }

  return (
    <div className="gw" role="dialog" aria-modal="true" aria-label={t('garments.wizard.dialogAria')}>
      <div className="gw__panel">
        <header className="gw__head">
          <div>
            <span className="gw__eyebrow">{t('garments.wizard.eyebrow')}</span>
            <h2>{step === 1 ? t('garments.wizard.step1Title') : step === 2 ? stepTwoTitle(method, t) : t('garments.wizard.step3Title')}</h2>
          </div>
          <button type="button" className="gw__x" onClick={onClose} aria-label={t('garments.wizard.closeAria')}>
            ×
          </button>
        </header>

        <div className="gw__steps" aria-hidden="true">
          {[1, 2, 3].map((s) => (
            <span key={s} className={`gw__dot${s === step ? ' is-active' : ''}${s < step ? ' is-done' : ''}`} />
          ))}
        </div>

        <div className="gw__body">
          {step === 1 && (
            <div className="gw__methods">
              {(
                [
                  { id: 'ai', title: t('garments.wizard.methodAiTitle'), desc: t('garments.wizard.methodAiDesc') },
                  { id: 'upload', title: t('garments.wizard.methodUploadTitle'), desc: t('garments.wizard.methodUploadDesc') },
                  { id: 'blank', title: t('garments.wizard.methodBlankTitle'), desc: t('garments.wizard.methodBlankDesc') },
                ] as { id: Method; title: string; desc: string }[]
              ).map((m) => (
                <button key={m.id} type="button" className={`gw-method${method === m.id ? ' is-active' : ''}`} onClick={() => setMethod(m.id)}>
                  <span className="gw-method__radio" aria-hidden="true" />
                  <span className="gw-method__text">
                    <b>{m.title}</b>
                    <small>{m.desc}</small>
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && method === 'ai' && (
            <div className="gw__ai">
              <textarea className="gw-prompt" rows={3} placeholder={t('garments.wizard.aiPlaceholder')} value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label={t('garments.wizard.aiAria')} />
              <div className="gw-examples">
                {AI_EXAMPLES.map((ex) => (
                  <button key={ex} type="button" className="gw-example" onClick={() => setPrompt(t(`garments.wizard.example.${ex}`))}>
                    {t(`garments.wizard.example.${ex}`)}
                  </button>
                ))}
              </div>
              <p className="gw-note">
                {t('garments.wizard.aiNote')}
                {hasApiKey() ? t('garments.wizard.aiNoteConnected') : t('garments.wizard.aiNotePending')}
              </p>
            </div>
          )}

          {step === 2 && method === 'upload' && (
            <div className="gw__upload">
              <input ref={fileRef} type="file" accept=".zip,.svg,.ai,.png,.pdf" hidden onChange={handleFile} />
              <button type="button" className="gw-drop" onClick={() => fileRef.current?.click()}>
                <b>{uploadName || t('garments.wizard.uploadChoose')}</b>
                <small>ZIP · SVG · AI · PNG · PDF</small>
              </button>
              <p className="gw-note">
                <b>{t('garments.wizard.uploadNoteBold1')}</b>{t('garments.wizard.uploadNoteMid')}<b>.ai / .pdf</b>{t('garments.wizard.uploadNoteEnd')}
              </p>
            </div>
          )}

          {step === 2 && method === 'blank' && (
            <div className="gw-templates">
              {templateThumbs.map((t) => (
                <button key={t.id} type="button" className={`gw-template${templateId === t.id ? ' is-active' : ''}`} onClick={() => setTemplateId(t.id)}>
                  <img src={t.thumb} alt={t.name} />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          )}

          {step === 3 && built && (
            <div className="gw__review">
              <div className="gw-review__thumb">
                <img src={builtThumb} alt={name} />
              </div>
              <div className="gw-review__fields">
                <label className="gw-field">
                  <span>{t('garments.wizard.reviewName')}</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <div className="gw-review__meta">
                  <div>
                    <span>{t('garments.wizard.reviewCategory')}</span>
                    <b>{built.category}</b>
                  </div>
                  <div>
                    <span>{t('garments.wizard.reviewRegions')}</span>
                    <b>{Object.keys(built.garment.regions).length}</b>
                  </div>
                  <div>
                    <span>{t('garments.wizard.reviewSource')}</span>
                    <b style={{ textTransform: 'capitalize' }}>{t(`garments.wizard.source.${method}`)}</b>
                  </div>
                </div>
                {report && report.regionCount > 0 && (
                  <p className="gw-note" style={{ marginTop: 4 }}>
                    {t('garments.wizard.reviewAnalysisLabel')}<b>{t('garments.wizard.reviewRegionsDetected', { n: report.regionCount })}</b>
                    {Object.entries(report.types).length > 0 && (
                      <> ({Object.entries(report.types).map(([ty, n]) => `${n} ${ty}`).join(' · ')})</>
                    )}
                    {report.lowConfidence > 0 && <>{t('garments.wizard.reviewLowConfidence', { n: report.lowConfidence })}</>}
                    .
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="gw__foot">
          <button type="button" className="s-btn s-btn--subtle" onClick={() => (step === 1 ? onClose() : setStep(step - 1))}>
            {step === 1 ? t('garments.wizard.cancel') : t('garments.wizard.back')}
          </button>
          {step < 3 ? (
            <button type="button" className="s-btn s-btn--accent" disabled={!canAdvance || analyzing} onClick={() => (step === 2 ? void goReview() : setStep(2))}>
              {analyzing ? t('garments.wizard.analyzing') : t('garments.wizard.continue')}
            </button>
          ) : (
            <button type="button" className="s-btn s-btn--accent" onClick={finish} disabled={!name.trim()}>
              {t('garments.wizard.createBtn')}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

function stepTwoTitle(method: Method, t: ReturnType<typeof useT>): string {
  if (method === 'ai') return t('garments.wizard.step2Ai')
  if (method === 'upload') return t('garments.wizard.step2Upload')
  return t('garments.wizard.step2Blank')
}
