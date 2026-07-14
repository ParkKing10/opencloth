import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/i18n'
import { useToast } from '../../components/ui/Toast'
import { downloadBlob } from '../../lib/download'
import { slugify } from '../../lib/download'
import { buildManufacturingPackage } from '../generators/manufacturingPackage'
import { computeReadiness, factoryCheck, type ReadinessInput } from '../readiness'
import { estimatePackage } from '../summary'
import { DEFAULT_SELECTION, type ManufacturingProject, type PackageProgress, type PackageSelection } from '../types'
import './export.css'

// title + note are resolved at render time via t('exportUi.doc.<key>.*') so they translate.
type Row = { key: keyof PackageSelection; badge: string }

const ROWS: Row[] = [
  { key: 'techPack', badge: 'PDF' },
  { key: 'sizeChart', badge: 'PDF' },
  { key: 'bom', badge: 'XLSX' },
  { key: 'printAssets', badge: 'PNG' },
  { key: 'patterns', badge: 'DXF' },
  { key: 'logos', badge: 'SVG/AI' },
  { key: 'colorReferences', badge: 'PDF' },
  { key: 'productionNotes', badge: 'PDF' },
  { key: 'packaging', badge: 'PDF' },
  { key: 'readme', badge: 'PDF' },
]

type Phase = 'config' | 'building' | 'done'

export function ExportModal({
  open,
  project,
  readiness,
  onClose,
}: {
  open: boolean
  project: ManufacturingProject
  readiness?: ReadinessInput
  onClose: () => void
}) {
  const t = useT()
  const toast = useToast()
  const [selection, setSelection] = useState<PackageSelection>(DEFAULT_SELECTION)
  const [phase, setPhase] = useState<Phase>('config')
  const [progress, setProgress] = useState<PackageProgress | null>(null)
  const [lastBlob, setLastBlob] = useState<Blob | null>(null)

  const count = useMemo(() => ROWS.filter((r) => selection[r.key]).length, [selection])
  const estimate = useMemo(() => estimatePackage(project, selection), [project, selection])
  const verdict = useMemo(() => (readiness ? factoryCheck(computeReadiness(readiness)) : null), [readiness])
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
      toast(t('exportUi.modal.toast.selectOne'), 'info')
      return
    }
    setPhase('building')
    setProgress({ step: t('exportUi.modal.preparing'), done: 0, total: 1 })
    try {
      const blob = await buildManufacturingPackage(project, selection, (e) => setProgress(e))
      setLastBlob(blob)
      downloadBlob(blob, filename)
      setPhase('done')
      toast(t('exportUi.modal.toast.ready'), 'accent')
    } catch (err) {
      console.error(err)
      setPhase('config')
      toast(t('exportUi.modal.toast.failed'), 'info')
    }
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return createPortal(
    <div className="suite">
      <div className="xp-overlay" role="dialog" aria-modal="true" aria-label={t('exportUi.modal.aria')} onMouseDown={close}>
        <div className="xp-modal" onMouseDown={(e) => e.stopPropagation()}>
          <header className="xp-head">
            <div>
              <span className="xp-eyebrow">{t('exportUi.modal.eyebrow')}</span>
              <h2 className="xp-title">{project.meta.styleName}</h2>
              <p className="xp-sub">
                {project.meta.styleNumber} · {project.meta.collection}
              </p>
            </div>
            <button className="xp-close" type="button" aria-label={t('exportUi.modal.close')} onClick={close} disabled={phase === 'building'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          {phase === 'config' && (
            <>
              {verdict && (
                <div className={`xp-factory xp-factory--${verdict.status}`}>
                  <span className="xp-factory__icon" aria-hidden>
                    {verdict.status === 'ready' ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 8v5M12 16.5v.5M10.3 3.9 2.5 18a1.7 1.7 0 0 0 1.5 2.5h16a1.7 1.7 0 0 0 1.5-2.5L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z" />
                      </svg>
                    )}
                  </span>
                  <div className="xp-factory__text">
                    <span className="xp-factory__eyebrow">{t('exportUi.modal.factoryCheck')}</span>
                    <b>{verdict.headline}</b>
                    <small>{verdict.detail}</small>
                    {verdict.blockers.length > 0 && (
                      <ul className="xp-factory__list">
                        {verdict.blockers.map((b) => (
                          <li key={b.id}>{b.label}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
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
                        <b>{t(`exportUi.doc.${r.key}.title`)}</b>
                        <small>{t(`exportUi.doc.${r.key}.note`)}</small>
                      </span>
                      <span className="xp-badge">{r.badge}</span>
                    </button>
                  )
                })}
              </div>
              <footer className="xp-foot">
                <div className="xp-estimate">
                  <span className="xp-estimate__eyebrow">{t('exportUi.modal.estimate')}</span>
                  <div className="xp-estimate__stats">
                    <span className="xp-estimate__stat">
                      <b>{estimate.files}</b> {t('exportUi.modal.files')}
                    </span>
                    <span className="xp-estimate__dot" />
                    <span className="xp-estimate__stat">
                      <b>{estimate.size}</b>
                    </span>
                    <span className="xp-estimate__dot" />
                    <span className={`xp-estimate__ready${verdict && verdict.status !== 'ready' ? ' is-warn' : ''}`}>
                      {verdict && verdict.status !== 'ready' ? t('exportUi.modal.almostReady') : t('exportUi.modal.ready')}
                    </span>
                  </div>
                </div>
                <button className="xp-generate" type="button" onClick={generate} disabled={count === 0}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                  </svg>
                  {t('exportUi.modal.generate')}
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
              <p className="xp-step">{progress?.step ?? t('exportUi.modal.working')}</p>
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
              <h3 className="xp-done__title">{t('exportUi.modal.doneTitle')}</h3>
              <p className="xp-done__sub">{filename}</p>
              <div className="xp-done__actions">
                <button
                  className="xp-generate xp-generate--ghost"
                  type="button"
                  onClick={() => lastBlob && downloadBlob(lastBlob, filename)}
                >
                  {t('exportUi.modal.downloadAgain')}
                </button>
                <button className="xp-generate" type="button" onClick={close}>
                  {t('exportUi.modal.done')}
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
