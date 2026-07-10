import { useEffect, useRef, useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import { downloadBlob } from '../../lib/download'
import type { ProductSpecs, ProjectInfo } from '../../pages/DesignStudio/designDoc'
import { slug, type RealExportProject } from '../real/exportProject'
import { captureDesignPng, type CaptureBackground } from '../real/capture'
import { buildTechPackPdf } from '../real/techPack'
import { buildManufacturingZip } from '../real/manufacturingPackage'
import { ExportWizard } from './ExportWizard'
import './export.css'

type Props = {
  project: RealExportProject
  projectInfo: ProjectInfo
  specs: ProductSpecs
  onPatchProjectInfo: (patch: Partial<ProjectInfo>) => void
  onPatchSpec: (patch: Partial<ProductSpecs>) => void
}

type PngMode = 'current' | 'front' | 'back' | 'all' | 'design'

/**
 * The Export control. Three real exports: ⭐ Manufacturing Package (opens a 3-step wizard),
 * Tech Pack (PDF), Design Export (PNG with a single-choice mode picker). Every file is built
 * from the current project.
 */
export function ExportMenu({ project, projectInfo, specs, onPatchProjectInfo, onPatchSpec }: Props) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'png'>('menu')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // PNG options
  const [pngMode, setPngMode] = useState<PngMode>('current')
  const [pngBg, setPngBg] = useState<CaptureBackground>('white')
  const [pngScale, setPngScale] = useState(2)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setView('menu')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const base = slug(project.projectName)

  async function guard(id: string, fn: () => Promise<void>) {
    setBusy(id)
    try {
      await fn()
    } catch (err) {
      console.error(err)
      toast('Could not export — open a garment and try again.', 'info')
    } finally {
      setBusy(null)
    }
  }

  const runTechPack = () =>
    guard('techPack', async () => {
      const png = await captureDesignPng({ scope: 'garment', background: 'white', scale: 2 })
      const blob = await buildTechPackPdf(project, png)
      downloadBlob(blob, `${base}-techpack.pdf`)
      toast('Tech Pack exported.', 'accent')
      setOpen(false)
    })

  const runPng = () =>
    guard('png', async () => {
      const scope = pngMode === 'design' ? 'design' : 'garment'
      const background = pngMode === 'design' ? 'transparent' : pngBg
      const blob = await captureDesignPng({ scope, background, scale: pngScale })
      downloadBlob(blob, `${base}-${pngMode}-${pngScale}x.png`)
      toast('Design exported.', 'accent')
      setOpen(false)
      setView('menu')
    })

  const runPackage = () =>
    guard('package', async () => {
      const blob = await buildManufacturingZip(project)
      downloadBlob(blob, `${base}-manufacturing.zip`)
      toast('Manufacturing package exported.', 'accent')
      setWizardOpen(false)
    })

  // Honest per-view availability: the export captures the live stage, so a specific view is
  // exported by SWITCHING the canvas to it first (the view tabs render real per-view backdrops).
  // Dedicated one-click per-view renders are a later enhancement — disabled with real guidance.
  const v = project.garment.views
  const switchHint = (label: string) =>
    v.front && v.back
      ? `Switch the canvas to ${label} (Garment Views) and use Current View`
      : v.combinedFrontBack
        ? 'One combined flat — use Current View'
        : `No ${label.toLowerCase()} view`
  const pngModes: { id: PngMode; label: string; desc: string; available: boolean; reason?: string }[] = [
    { id: 'current', label: 'Current View', desc: 'Exactly what you see now', available: true },
    { id: 'front', label: 'Front', desc: 'Front view only', available: false, reason: switchHint('Front') },
    { id: 'back', label: 'Back', desc: 'Back view only', available: false, reason: switchHint('Back') },
    { id: 'all', label: 'All Views', desc: 'Every available garment view', available: false, reason: 'Export each view via Current View for now' },
    { id: 'design', label: 'Printable Design Only', desc: 'Transparent PNG, no garment', available: true },
  ]

  const arrow = (
    <svg className="xm-item__arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )

  return (
    <div className="xm-wrap" ref={wrapRef}>
      <button
        className="s-btn s-btn--accent"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o)
          setView('menu')
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
        Export
        <svg className="xm-caret" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="xm-menu" role="menu">
          {view === 'menu' ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="xm-item xm-item--hero"
                onClick={() => {
                  setOpen(false)
                  setWizardOpen(true)
                }}
              >
                <span className="xm-item__badge">.ZIP</span>
                <span className="xm-item__text">
                  <b>Manufacturing Package</b>
                  <small>Guided 3-step export</small>
                </span>
                <span className="xm-item__star">★</span>
              </button>
              <span className="xm-divider" aria-hidden />
              <button type="button" role="menuitem" className="xm-item" onClick={runTechPack} disabled={busy !== null}>
                <span className="xm-item__badge">PDF</span>
                <span className="xm-item__text">
                  <b>Tech Pack</b>
                  <small>Full production specification</small>
                </span>
                {busy === 'techPack' ? <span className="xm-spin" aria-hidden /> : arrow}
              </button>
              <button type="button" role="menuitem" className="xm-item" onClick={() => setView('png')} disabled={busy !== null}>
                <span className="xm-item__badge">PNG</span>
                <span className="xm-item__text">
                  <b>Design Export</b>
                  <small>Choose a view to export</small>
                </span>
                {arrow}
              </button>
            </>
          ) : (
            <div className="xm-opts">
              <button type="button" className="xm-opts__back" onClick={() => setView('menu')}>
                ← Design Export
              </button>
              <div className="xm-modes" role="radiogroup" aria-label="Export mode">
                {pngModes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={pngMode === m.id}
                    className={`xm-mode${pngMode === m.id ? ' is-active' : ''}${m.available ? '' : ' is-disabled'}`}
                    disabled={!m.available}
                    onClick={() => m.available && setPngMode(m.id)}
                  >
                    <span className={`xm-mode__radio${pngMode === m.id ? ' is-on' : ''}`} aria-hidden />
                    <span className="xm-mode__text">
                      <b>{m.label}</b>
                      <small>{m.available ? m.desc : m.reason}</small>
                    </span>
                    {!m.available && <span className="xm-mode__na">Unavailable</span>}
                  </button>
                ))}
              </div>
              <OptRow label="Background" value={pngMode === 'design' ? 'transparent' : pngBg} onChange={setPngBg} disabled={pngMode === 'design'} opts={[['transparent', 'Transparent'], ['white', 'White']]} />
              <OptRow label="Resolution" value={pngScale} onChange={setPngScale} opts={[[2, '2×'], [4, '4×']]} />
              <button type="button" className="s-btn s-btn--accent xm-opts__go" onClick={runPng} disabled={busy !== null}>
                {busy === 'png' ? 'Exporting…' : 'Export PNG'}
              </button>
            </div>
          )}
        </div>
      )}

      <ExportWizard
        open={wizardOpen}
        project={project}
        projectInfo={projectInfo}
        specs={specs}
        busy={busy === 'package'}
        onPatchProjectInfo={onPatchProjectInfo}
        onPatchSpec={onPatchSpec}
        onClose={() => setWizardOpen(false)}
        onGenerate={runPackage}
      />
    </div>
  )
}

function OptRow<T extends string | number>({
  label,
  value,
  onChange,
  opts,
  disabled,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  opts: [T, string][]
  disabled?: boolean
}) {
  return (
    <div className={`xm-opt${disabled ? ' is-disabled' : ''}`}>
      <span className="xm-opt__label">{label}</span>
      <div className="xm-opt__choices">
        {opts.map(([v, lbl]) => (
          <button key={String(v)} type="button" className={`xm-opt__btn${value === v ? ' is-active' : ''}`} disabled={disabled} onClick={() => onChange(v)}>
            {lbl}
          </button>
        ))}
      </div>
    </div>
  )
}
