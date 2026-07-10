import { useEffect, useState } from 'react'
import type { ProductSpecs, ProjectInfo } from '../../pages/DesignStudio/designDoc'
import { viewsSummary } from '../../garments/import/detect'
import { captureDesignPng } from '../real/capture'
import type { RealExportProject } from '../real/exportProject'
import { artworkRows } from '../real/exportProject'

type Props = {
  open: boolean
  project: RealExportProject
  projectInfo: ProjectInfo
  specs: ProductSpecs
  busy: boolean
  onPatchProjectInfo: (patch: Partial<ProjectInfo>) => void
  onPatchSpec: (patch: Partial<ProductSpecs>) => void
  onClose: () => void
  onGenerate: () => void
}

const FILES = ['TechPack.pdf', 'Design.png', 'Preview.png', 'Project.threados', 'Metadata.json', 'Manifest.json']

/**
 * The Manufacturing Package export wizard — 3 steps. Every field auto-saves immediately (via
 * the studio's patch handlers) and restores on reopen. Nothing here is invented; the summary
 * reads the real project.
 */
export function ExportWizard({ open, project, projectInfo, specs, busy, onPatchProjectInfo, onPatchSpec, onClose, onGenerate }: Props) {
  const [step, setStep] = useState(1)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (open) setStep(1)
  }, [open])

  // Capture a real preview when the summary step opens.
  useEffect(() => {
    if (!open || step !== 3) return
    let url: string | null = null
    let alive = true
    captureDesignPng({ scope: 'garment', background: 'transparent', scale: 1 })
      .then((blob) => {
        if (!alive) return
        url = URL.createObjectURL(blob)
        setPreview(url)
      })
      .catch(() => setPreview(null))
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [open, step])

  if (!open) return null

  const layerCount = artworkRows(project).length

  return (
    <div className="xw" role="dialog" aria-modal="true" aria-label="Manufacturing package" onClick={onClose}>
      <div className="xw__panel" onClick={(e) => e.stopPropagation()}>
        <header className="xw__head">
          <div>
            <span className="xw__eyebrow">Manufacturing Package</span>
            <h2>{['Project information', 'Garment specifications', 'Export summary'][step - 1]}</h2>
          </div>
          <button className="xw__x" type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="xw__steps" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span key={n} className={`xw__dot${n === step ? ' is-active' : ''}${n < step ? ' is-done' : ''}`} />
          ))}
        </div>

        <div className="xw__body">
          {step === 1 && (
            <div className="xw__grid">
              <Field label="Brand" value={projectInfo.brand ?? ''} placeholder={project.brand} onChange={(v) => onPatchProjectInfo({ brand: v })} />
              <Field label="Designer" value={projectInfo.designer ?? ''} placeholder={project.designer} onChange={(v) => onPatchProjectInfo({ designer: v })} />
              <Field label="Collection" value={projectInfo.collection ?? ''} placeholder="e.g. FW26" onChange={(v) => onPatchProjectInfo({ collection: v })} />
              <Field label="Style Number" value={projectInfo.styleNumber ?? ''} placeholder="e.g. TS-001" onChange={(v) => onPatchProjectInfo({ styleNumber: v })} />
              <Field label="SKU" value={projectInfo.sku ?? ''} placeholder="e.g. TS-001-BLK-M" onChange={(v) => onPatchProjectInfo({ sku: v })} />
              <Field label="Season" value={projectInfo.season ?? ''} placeholder="e.g. Fall / Winter 2026" onChange={(v) => onPatchProjectInfo({ season: v })} />
            </div>
          )}

          {step === 2 && (
            <div className="xw__grid">
              <Field label="Material" value={specs.material ?? ''} placeholder="e.g. French Terry" onChange={(v) => onPatchSpec({ material: v })} />
              <Field label="Composition" value={specs.composition ?? ''} placeholder="e.g. 100% Cotton" onChange={(v) => onPatchSpec({ composition: v })} />
              <Field label="Weight" value={specs.weight ?? ''} placeholder="e.g. 320 GSM" onChange={(v) => onPatchSpec({ weight: v })} />
              <Field label="Fit" value={specs.fit ?? ''} placeholder="e.g. Oversized" onChange={(v) => onPatchSpec({ fit: v })} />
              <label className="xw__field xw__field--wide">
                <span>Notes</span>
                <textarea rows={3} value={specs.notes ?? ''} placeholder="Production notes, wash, trims…" onChange={(e) => onPatchSpec({ notes: e.target.value })} />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="xw__summary">
              <div className="xw__preview">{preview ? <img src={preview} alt="Design preview" /> : <span className="xw__preview-ph">Preview…</span>}</div>
              <div className="xw__meta">
                <Row k="Project" v={project.projectName} />
                <Row k="Brand" v={project.brand} />
                <Row k="Designer" v={project.designer} />
                {project.collection && <Row k="Collection" v={project.collection} />}
                <Row k="Design layers" v={String(layerCount)} />
                <Row k="Views" v={viewsSummary(project.garment.views)} />
                <div className="xw__files">
                  <span className="xw__files-label">Files generated</span>
                  {FILES.map((f) => (
                    <span className="xw__file" key={f}>
                      <span className="xw__check">✓</span> {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="xw__foot">
          {step > 1 ? (
            <button className="s-btn" type="button" onClick={() => setStep((s) => s - 1)} disabled={busy}>
              Back
            </button>
          ) : (
            <button className="s-btn" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          )}
          {step < 3 ? (
            <button className="s-btn s-btn--accent" type="button" onClick={() => setStep((s) => s + 1)}>
              Continue
            </button>
          ) : (
            <button className="s-btn s-btn--accent xw__generate" type="button" onClick={onGenerate} disabled={busy}>
              {busy ? 'Generating…' : 'Generate Manufacturing Package'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <label className="xw__field">
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="xw__row">
      <span className="xw__row-k">{k}</span>
      <span className="xw__row-v">{v}</span>
    </div>
  )
}
