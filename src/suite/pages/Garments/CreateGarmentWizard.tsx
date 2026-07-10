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

const AI_EXAMPLES = ['Oversized hoodie', 'Luxury bomber', 'Double breasted blazer', 'Streetwear cargos']

export function CreateGarmentWizard({ onClose, onCreated }: { onClose: () => void; onCreated: (s: GarmentSummary) => void }) {
  const { user } = useAuth()
  const toast = useToast()

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
    toast('Garment created — added to My Garments.', 'success')
    onCreated(summary)
  }

  return (
    <div className="gw" role="dialog" aria-modal="true" aria-label="Create garment">
      <div className="gw__panel">
        <header className="gw__head">
          <div>
            <span className="gw__eyebrow">New garment</span>
            <h2>{step === 1 ? 'How would you like to start?' : step === 2 ? stepTwoTitle(method) : 'Review & create'}</h2>
          </div>
          <button type="button" className="gw__x" onClick={onClose} aria-label="Close">
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
                  { id: 'ai', title: 'AI Garment', desc: 'Describe it — start from the closest editable garment.' },
                  { id: 'upload', title: 'Upload Garment Pack', desc: 'Bring a ZIP / SVG / AI / PNG / PDF.' },
                  { id: 'blank', title: 'Blank Garment', desc: 'Pick a clean template to build from.' },
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
              <textarea className="gw-prompt" rows={3} placeholder="e.g. Oversized cropped bomber with two chest pockets" value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Describe your garment" />
              <div className="gw-examples">
                {AI_EXAMPLES.map((ex) => (
                  <button key={ex} type="button" className="gw-example" onClick={() => setPrompt(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
              <p className="gw-note">
                THREADOS starts you from the closest real template, named from your prompt — every region stays editable.
                {hasApiKey()
                  ? ' OpenAI is connected for garment editing; prompt-to-garment generation is a future milestone.'
                  : ' Prompt-to-garment generation arrives with the AI worker (a future milestone).'}
              </p>
            </div>
          )}

          {step === 2 && method === 'upload' && (
            <div className="gw__upload">
              <input ref={fileRef} type="file" accept=".zip,.svg,.ai,.png,.pdf" hidden onChange={handleFile} />
              <button type="button" className="gw-drop" onClick={() => fileRef.current?.click()}>
                <b>{uploadName || 'Choose a file'}</b>
                <small>ZIP · SVG · AI · PNG · PDF</small>
              </button>
              <p className="gw-note">
                <b>SVG files are analyzed automatically</b> — THREADOS reads the geometry and builds editable regions
                (body, sleeves, collar, buttons…) with a confidence score each. Direct <b>.ai / .pdf</b> vector
                extraction and ZIP packs are coming; those start from the closest editable template for now.
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
                  <span>Name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <div className="gw-review__meta">
                  <div>
                    <span>Category</span>
                    <b>{built.category}</b>
                  </div>
                  <div>
                    <span>Regions</span>
                    <b>{Object.keys(built.garment.regions).length}</b>
                  </div>
                  <div>
                    <span>Source</span>
                    <b style={{ textTransform: 'capitalize' }}>{method}</b>
                  </div>
                </div>
                {report && report.regionCount > 0 && (
                  <p className="gw-note" style={{ marginTop: 4 }}>
                    Analysis: <b>{report.regionCount} regions detected</b>
                    {Object.entries(report.types).length > 0 && (
                      <> ({Object.entries(report.types).map(([t, n]) => `${n} ${t}`).join(' · ')})</>
                    )}
                    {report.lowConfidence > 0 && <> · {report.lowConfidence} low-confidence, editable in the Studio</>}
                    .
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="gw__foot">
          <button type="button" className="s-btn s-btn--subtle" onClick={() => (step === 1 ? onClose() : setStep(step - 1))}>
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 3 ? (
            <button type="button" className="s-btn s-btn--accent" disabled={!canAdvance || analyzing} onClick={() => (step === 2 ? void goReview() : setStep(2))}>
              {analyzing ? 'Analyzing…' : 'Continue'}
            </button>
          ) : (
            <button type="button" className="s-btn s-btn--accent" onClick={finish} disabled={!name.trim()}>
              Create garment
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

function stepTwoTitle(method: Method): string {
  if (method === 'ai') return 'Describe your garment'
  if (method === 'upload') return 'Upload a garment pack'
  return 'Choose a template'
}
