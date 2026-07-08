import { useEffect, useRef, useState } from 'react'
import { IcoChevron } from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { useToast } from '../../components/ui/Toast'
import { downloadBlob, slugify, svgElementToPngBlob } from '../../lib/download'
import { downloadTechPackPdf } from '../../lib/exporters'

const TOOLS = ['move', 'rotate', 'pan', 'node', 'frame', 'measure', 'crop']
const VIEWS = ['Front', 'Angle', 'Side', 'Hood']
const FLATS = ['Front', 'Back', 'Side', 'Details']
const CANVAS_TOOLS = ['orbit', 'zoom', 'fit', 'grid', 'measure', 'light']

const ZOOM_STEP = 0.15
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2.5

const SIZE_ROWS: [string, string[]][] = [
  ['Chest', ['58', '60', '62', '64', '66']],
  ['Length', ['70', '72', '74', '76', '78']],
  ['Shoulder', ['56', '58', '60', '62', '64']],
  ['Sleeve', ['60', '61', '62', '63', '64']],
]

type Props = {
  garmentName: string
  garmentKind: GarmentKind
  garmentFit: string
}

export function StudioCanvas({ garmentName, garmentKind, garmentFit }: Props) {
  const toast = useToast()
  const [mode, setMode] = useState<'3D' | '2D'>('3D')
  const [view, setView] = useState('Front')
  const [tool, setTool] = useState('move')
  const [bottomTab, setBottomTab] = useState<'Tech Pack' | 'Size Chart'>('Tech Pack')
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(true)
  const [isRendering, setIsRendering] = useState(false)
  // Editable design title, seeded from the active blank and re-synced when it changes.
  const [designName, setDesignName] = useState(garmentName)

  // Ref to the wrapper so we can grab the live <svg> and rasterise it to PNG.
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDesignName(garmentName)
  }, [garmentName])

  const Glyph = GARMENT_GLYPHS[garmentKind]

  function renameDesign() {
    const next = window.prompt('Rename this design', designName)
    if (next == null) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === designName) return
    setDesignName(trimmed)
    toast(`Renamed to “${trimmed}”.`, 'success')
  }

  async function renderPng() {
    if (isRendering) return
    const svg = stageRef.current?.querySelector('svg')
    if (!svg) {
      toast('Nothing to render yet.', 'info')
      return
    }
    setIsRendering(true)
    try {
      const blob = await svgElementToPngBlob(svg)
      downloadBlob(blob, `${slugify(designName)}.png`)
      toast(`Rendered “${designName}” to PNG.`, 'accent')
    } catch {
      toast('Render failed — could not rasterise the garment.', 'info')
    } finally {
      setIsRendering(false)
    }
  }

  function handleCanvasTool(t: string) {
    switch (t) {
      case 'zoom':
        setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))
        toast('Zoomed in.')
        break
      case 'fit':
        setZoom(1)
        toast('Fit to view.')
        break
      case 'grid':
        setShowGrid((g) => !g)
        toast(showGrid ? 'Grid hidden.' : 'Grid shown.')
        break
      case 'orbit':
        setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))
        toast('Zoomed out.')
        break
      default:
        setTool(t)
        toast(`${t.charAt(0).toUpperCase() + t.slice(1)} tool`)
    }
  }

  function openFlat(flat: string) {
    try {
      const filename = downloadTechPackPdf({
        name: `${designName} — ${flat}`,
        kind: garmentKind,
        fit: garmentFit,
        placement: flat,
      })
      toast(`Exported ${filename}`, 'accent')
    } catch {
      toast('Could not generate the flat. Please try again.', 'info')
    }
  }

  return (
    <main className="ds-canvas">
      {/* Title bar */}
      <div className="ds-canvas__bar">
        <button className="ds-name" type="button" title="Rename this design" onClick={renameDesign}>
          {designName} <IcoChevron width="15" height="15" />
        </button>
        <span className="ds-saved">
          <span className="s-dot" style={{ background: 'var(--s-good)' }} /> Saved
        </span>
        <div className="ds-mode">
          {(['3D', '2D'] as const).map((m) => (
            <button key={m} className={mode === m ? 'is-active' : ''} type="button" onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Stage */}
      <div className="ds-stage">
        <div className="ds-toolrail">
          {TOOLS.map((t, i) => (
            <button
              key={t}
              type="button"
              className={tool === t ? 'is-active' : ''}
              aria-label={t}
              title={t.charAt(0).toUpperCase() + t.slice(1)}
              onClick={() => setTool(t)}
            >
              <ToolGlyph i={i} />
            </button>
          ))}
        </div>

        <div className="ds-viewport">
          {showGrid && <div className="ds-viewport__grid" aria-hidden="true" />}
          <div className="ds-garment-3d" ref={stageRef} style={{ transform: `scale(${zoom})` }}>
            <Glyph width="340" height="340" />
            <span className="ds-print">VISIONARY</span>
          </div>
        </div>

        <div className="ds-views">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              className={`ds-view${view === v ? ' is-active' : ''}`}
              aria-label={`${v} view`}
              title={`${v} view`}
              onClick={() => {
                setView(v)
                toast(`${v} view`, 'default')
              }}
            >
              <Glyph width="34" height="34" />
            </button>
          ))}
        </div>

        <div className="ds-canvas-toolbar">
          <div className="ds-canvas-toolbar__group">
            {CANVAS_TOOLS.map((t, i) => (
              <button
                key={t}
                type="button"
                aria-label={t}
                title={t.charAt(0).toUpperCase() + t.slice(1)}
                onClick={() => handleCanvasTool(t)}
              >
                <ToolGlyph i={i} small />
              </button>
            ))}
          </div>
          <button
            className="ds-render"
            type="button"
            title="Render a PNG of the current garment"
            disabled={isRendering}
            onClick={renderPng}
          >
            {isRendering ? 'Rendering…' : 'Render'} <IcoChevron width="14" height="14" />
          </button>
        </div>
      </div>

      {/* Tech pack / size chart strip */}
      <div className="ds-techpack">
        <div className="ds-techpack__tabs">
          {(['Tech Pack', 'Size Chart'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`ds-tp-tab${bottomTab === t ? ' is-active' : ''}`}
              onClick={() => setBottomTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {bottomTab === 'Tech Pack' ? (
          <div className="ds-flats">
            {FLATS.map((f) => (
              <button
                className="ds-flat"
                type="button"
                key={f}
                title={`Download ${f} flat as a PDF tech pack`}
                onClick={() => openFlat(f)}
              >
                <div className="ds-flat__art">
                  <Glyph width="66" height="66" />
                </div>
                <span>{f}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="ds-sizechart">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>S</th>
                  <th>M</th>
                  <th>L</th>
                  <th>XL</th>
                  <th>XXL</th>
                </tr>
              </thead>
              <tbody>
                {SIZE_ROWS.map(([label, vals]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    {vals.map((v) => (
                      <td key={v}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}

function ToolGlyph({ i, small }: { i: number; small?: boolean }) {
  const sz = small ? 16 : 18
  const base = {
    width: sz,
    height: sz,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  const glyphs = [
    <path key="0" d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />,
    <path key="1" d="M4 12a8 8 0 1 1 3 6M4 12v-4M4 12h4" />,
    <path key="2" d="M12 3v18M3 12h18" />,
    <><circle key="a" cx="6" cy="6" r="2" /><circle key="b" cx="18" cy="18" r="2" /><path key="c" d="M8 6h8a2 2 0 0 1 2 2v8" /></>,
    <rect key="3" x="4" y="4" width="16" height="16" rx="2" />,
    <path key="4" d="M4 4v16M4 4h16M8 8v4M12 8v8M16 8v4" />,
    <path key="5" d="M6 6h12v12H6zM3 9h3M18 9h3M3 15h3M18 15h3" />,
  ]
  return <svg {...base}>{glyphs[i % glyphs.length]}</svg>
}
