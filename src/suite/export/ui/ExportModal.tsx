import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '../../components/ui/Toast'
import { downloadBlob } from '../../lib/download'
import { slugify } from '../../lib/download'
import { buildManufacturingPackage } from '../generators/manufacturingPackage'
import { DEFAULT_SELECTION, type ManufacturingProject, type PackageProgress, type PackageSelection } from '../types'
import './export.css'

type Row = { key: keyof PackageSelection; title: string; badge: string; note: string }

const ROWS: Row[] = [
  { key: 'techPack', title: 'Tech Pack', badge: 'PDF', note: 'Full production spec with flats' },
  { key: 'sizeChart', title: 'Size Chart', badge: 'PDF', note: 'Graded across all sizes' },
  { key: 'bom', title: 'Bill of Materials', badge: 'XLSX', note: 'Editable workbook' },
  { key: 'printAssets', title: 'Print Assets', badge: 'PNG', note: 'Front · Back · Sleeves, 300 DPI' },
  { key: 'patterns', title: 'Pattern Files', badge: 'DXF', note: 'CAD polylines + reference PDF' },
  { key: 'logos', title: 'Logo Pack', badge: 'SVG/AI', note: 'Vector brand lockup' },
  { key: 'colorReferences', title: 'Color References', badge: 'PDF', note: 'HEX · RGB · Pantone' },
  { key: 'productionNotes', title: 'Production Notes', badge: 'PDF', note: 'Wash, finishing, QC' },
  { key: 'packaging', title: 'Packaging Guide', badge: 'PDF', note: 'Folding, labels, cartons' },
  { key: 'readme', title: 'README', badge: 'PDF', note: 'Package contents & handover' },
]

type Phase = 'config' | 'building' | 'done'

export function ExportModal({
  open,
  project,
  onClose,
}: {
  open: boolean
  project: ManufacturingProject
  onClose: () => void
}) {
  const toast = useToast()
  const [selection, setSelection] = useState<PackageSelection>(DEFAULT_SELECTION)
  const [phase, setPhase] = useState<Phase>('config')
  const [progress, setProgress] = useState<PackageProgress | null>(null)
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)

  const count = useMemo(() => ROWS.filter((r) => selection[r.key]).length, [selection])
  const filename = `${slugify(project.meta.styleName)}-manufacturing-package.zip`

  if (!open) return null

  function toggle(key: keyof PackageSelection) {
    setSelection((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function reset() {
    setPhase('config')
    setProgress(null)
    setLastBlob(null)
  }

  function close() {
    if (phase === 'building') return
    reset()
    onClose()
  }

  async function generate() {
    if (count === 0) {
      toast('Select at least one document to include.', 'info')
      return
    }
    setPhase('building')
    setProgress({ step: 'Preparing project', done: 0, total: 1 })
    try {
      const blob = await buildManufacturingPackage(project, selection, (e) => setProgress(e))
      setLastBlob(blob)
      downloadBlob(blob, filename)
      setPhase('done')
      toast('Manufacturing package ready — download started.', 'accent')
    } catch (err) {
      console.error(err)
      setPhase('config')
      toast('Package generation failed. Please try again.', 'info')
    }
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return createPortal(
    <div className="suite">
      <div className="xp-overlay" role="dialog" aria-modal="true" aria-label="Export manufacturing package" onMouseDown={close}>
        <div className="xp-modal" onMouseDown={(e) => e.stopPropagation()}>
          <header className="xp-head">
            <div>
              <span className="xp-eyebrow">Manufacturing Export</span>
              <h2 className="xp-title">{project.meta.styleName}</h2>
              <p className="xp-sub">
                {project.meta.styleNumber} · {project.meta.collection}
              </p>
            </div>
            <button className="xp-close" type="button" aria-label="Close" onClick={close} disabled={phase === 'building'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          {phase === 'config' && (
            <>
              <div className="xp-list">
                {ROWS.map((r) => {
                  const on = selection[r.key]
                  return (
                    <button
                      key={r.key}
                      type="button"
                      className={`xp-row${on ? ' is-on' : ''}`}
                      onClick={() => toggle(r.key)}
                      aria-pressed={on}
                    >
                      <span className={`xp-check${on ? ' is-on' : ''}`}>
                        {on && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="xp-row__text">
                        <b>{r.title}</b>
                        <small>{r.note}</small>
                      </span>
                      <span className="xp-badge">{r.badge}</span>
                    </button>
                  )
                })}
              </div>
              <footer className="xp-foot">
                <span className="xp-foot__meta">
                  {count} {count === 1 ? 'document' : 'documents'} · ~3–5 seconds
                </span>
                <button className="xp-generate" type="button" onClick={generate} disabled={count === 0}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                  </svg>
                  Generate Package
                </button>
              </footer>
            </>
          )}

          {phase === 'building' && (
            <div className="xp-building">
              <div className="xp-orbit" aria-hidden>
                <span className="xp-orbit__core" />
                <span className="xp-orbit__ring" />
                <span className="xp-orbit__ring xp-orbit__ring--2" />
              </div>
              <p className="xp-step">{progress?.step ?? 'Working…'}</p>
              <div className="xp-bar">
                <span className="xp-bar__fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="xp-pct">{pct}%</span>
            </div>
          )}

          {phase === 'done' && (
            <div className="xp-done">
              <div className="xp-done__check" aria-hidden>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="xp-done__title">Package ready</h3>
              <p className="xp-done__sub">{filename}</p>
              <div className="xp-done__actions">
                <button
                  className="xp-generate xp-generate--ghost"
                  type="button"
                  onClick={() => lastBlob && downloadBlob(lastBlob, filename)}
                >
                  Download again
                </button>
                <button className="xp-generate" type="button" onClick={close}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
