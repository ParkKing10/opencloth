import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
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
  const t = useT()
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
    <div className="xw" role="dialog" aria-modal="true" aria-label={t('exportUi.wizard.aria')} onClick={onClose}>
      <div className="xw__panel" onClick={(e) => e.stopPropagation()}>
        <header className="xw__head">
          <div>
            <span className="xw__eyebrow">{t('exportUi.wizard.eyebrow')}</span>
            <h2>{[t('exportUi.wizard.step1.title'), t('exportUi.wizard.step2.title'), t('exportUi.wizard.step3.title')][step - 1]}</h2>
          </div>
          <button className="xw__x" type="button" aria-label={t('exportUi.wizard.close')} onClick={onClose}>
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
              <Field label={t('exportUi.field.brand')} value={projectInfo.brand ?? ''} placeholder={project.brand} onChange={(v) => onPatchProjectInfo({ brand: v })} />
              <Field label={t('exportUi.field.designer')} value={projectInfo.designer ?? ''} placeholder={project.designer} onChange={(v) => onPatchProjectInfo({ designer: v })} />
              <Field label={t('exportUi.field.collection')} value={projectInfo.collection ?? ''} placeholder={t('exportUi.ph.collection')} onChange={(v) => onPatchProjectInfo({ collection: v })} />
              <Field label={t('exportUi.field.styleNumber')} value={projectInfo.styleNumber ?? ''} placeholder={t('exportUi.ph.styleNumber')} onChange={(v) => onPatchProjectInfo({ styleNumber: v })} />
              <Field label={t('exportUi.field.sku')} value={projectInfo.sku ?? ''} placeholder={t('exportUi.ph.sku')} onChange={(v) => onPatchProjectInfo({ sku: v })} />
              <Field label={t('exportUi.field.season')} value={projectInfo.season ?? ''} placeholder={t('exportUi.ph.season')} onChange={(v) => onPatchProjectInfo({ season: v })} />
            </div>
          )}

          {step === 2 && (
            <div className="xw__grid">
              <Field label={t('exportUi.field.material')} value={specs.material ?? ''} placeholder={t('exportUi.ph.material')} onChange={(v) => onPatchSpec({ material: v })} />
              <Field label={t('exportUi.field.composition')} value={specs.composition ?? ''} placeholder={t('exportUi.ph.composition')} onChange={(v) => onPatchSpec({ composition: v })} />
              <Field label={t('exportUi.field.weight')} value={specs.weight ?? ''} placeholder={t('exportUi.ph.weight')} onChange={(v) => onPatchSpec({ weight: v })} />
              <Field label={t('exportUi.field.fit')} value={specs.fit ?? ''} placeholder={t('exportUi.ph.fit')} onChange={(v) => onPatchSpec({ fit: v })} />
              <label className="xw__field xw__field--wide">
                <span>{t('exportUi.field.notes')}</span>
                <textarea rows={3} value={specs.notes ?? ''} placeholder={t('exportUi.ph.notes')} onChange={(e) => onPatchSpec({ notes: e.target.value })} />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="xw__summary">
              <div className="xw__preview">{preview ? <img src={preview} alt={t('exportUi.summary.previewAlt')} /> : <span className="xw__preview-ph">{t('exportUi.summary.previewLoading')}</span>}</div>
              <div className="xw__meta">
                <Row k={t('exportUi.summary.project')} v={project.projectName} />
                <Row k={t('exportUi.field.brand')} v={project.brand} />
                <Row k={t('exportUi.field.designer')} v={project.designer} />
                {project.collection && <Row k={t('exportUi.field.collection')} v={project.collection} />}
                <Row k={t('exportUi.summary.layers')} v={String(layerCount)} />
                <Row k={t('exportUi.summary.views')} v={viewsSummary(project.garment.views)} />
                <div className="xw__files">
                  <span className="xw__files-label">{t('exportUi.summary.filesGenerated')}</span>
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
              {t('exportUi.wizard.back')}
            </button>
          ) : (
            <button className="s-btn" type="button" onClick={onClose} disabled={busy}>
              {t('exportUi.wizard.cancel')}
            </button>
          )}
          {step < 3 ? (
            <button className="s-btn s-btn--accent" type="button" onClick={() => setStep((s) => s + 1)}>
              {t('exportUi.wizard.continue')}
            </button>
          ) : (
            <button className="s-btn s-btn--accent xw__generate" type="button" onClick={onGenerate} disabled={busy}>
              {busy ? t('exportUi.wizard.generating') : t('exportUi.wizard.generate')}
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
