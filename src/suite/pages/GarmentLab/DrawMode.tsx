/**
 * Draw Garment workspace (Milestone 8.2, Part 6). Sketch with a pen (freehand), rectangle or line;
 * every finished stroke becomes an EDITABLE garment region (a real vector path in the same format),
 * so the drawing is immediately editable. No AI interpretation yet — this milestone builds the
 * workspace only.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useT } from '@/i18n'
import type { EditableGarment, GarmentViewId } from '../../garment-model/editableGarment'
import { flattenRegions } from '../../garment-model/regionTree'
import { styleForRole, type ShapeRole } from '../../garment-model/garmentStyle'
import { pointsToPath, rectPath, linePath, type Pt } from '../../garment-model/drawPath'
import './garment-lab.css'

type Tool = 'pen' | 'rect' | 'line'
const TOOL_ROLE: Record<Tool, ShapeRole> = { pen: 'outline', rect: 'fill', line: 'seam' }

type Props = {
  garment: EditableGarment
  view: GarmentViewId
  onCommit: (d: string, role: ShapeRole) => void
  onExit: () => void
}

export function DrawMode({ garment, view, onCommit, onExit }: Props) {
  const t = useT()
  const vb = garment.views.find((v) => v.id === view)?.viewBox ?? { w: 400, h: 560 }
  const svgRef = useRef<SVGSVGElement>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [pts, setPts] = useState<Pt[]>([])
  const [drawing, setDrawing] = useState(false)

  const toView = (e: ReactPointerEvent): Pt => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * vb.w, y: ((e.clientY - rect.top) / rect.height) * vb.h }
  }

  const preview =
    pts.length === 0
      ? ''
      : tool === 'pen'
        ? pointsToPath(pts)
        : tool === 'rect'
          ? rectPath(pts[0], pts[pts.length - 1])
          : linePath(pts[0], pts[pts.length - 1])

  const down = (e: ReactPointerEvent) => {
    try {
      // Synthetic / already-released pointers can't be captured — never let this throw.
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
    setDrawing(true)
    setPts([toView(e)])
  }
  const move = (e: ReactPointerEvent) => {
    if (!drawing) return
    const p = toView(e)
    // Guard against a batched-event race where `prev` is momentarily empty (rect/line need a start).
    setPts((prev) => (tool === 'pen' ? [...prev, p] : prev.length > 0 ? [prev[0], p] : [p]))
  }
  const up = () => {
    if (!drawing) return
    setDrawing(false)
    if (preview && pts.length > 1) onCommit(preview, TOOL_ROLE[tool])
    setPts([])
  }

  return (
    <div className="draw">
      <div className="draw__toolbar">
        <span className="draw__eyebrow">{t('labPanels.draw.eyebrow')}</span>
        <div className="draw__tools" role="toolbar" aria-label={t('labPanels.draw.toolsAria')}>
          {(['pen', 'rect', 'line'] as Tool[]).map((toolId) => (
            <button key={toolId} type="button" className={`draw__tool${tool === toolId ? ' is-active' : ''}`} onClick={() => setTool(toolId)}>
              {toolId === 'pen' ? t('labPanels.draw.pen') : toolId === 'rect' ? t('labPanels.draw.rectangle') : t('labPanels.draw.line')}
            </button>
          ))}
        </div>
        <button type="button" className="s-btn s-btn--accent draw__done" onClick={onExit}>
          {t('labPanels.draw.done')}
        </button>
      </div>

      <div className="draw__stage">
        <svg
          ref={svgRef}
          className="draw__surface"
          viewBox={`0 0 ${vb.w} ${vb.h}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
        >
          {/* Existing garment, faint, as a reference to draw over. */}
          <g className="draw__ghost">
            {flattenRegions(garment).flatMap(({ region }) =>
              region.shapes
                .filter((s) => s.view === view)
                .map((s, i) => {
                  const st = styleForRole(s.role)
                  return <path key={`${region.id}-${i}`} d={s.d} fill={st.fill === 'none' ? 'none' : '#e7e7ea'} stroke="#c7c7cd" strokeWidth={st.strokeWidth} />
                }),
            )}
          </g>
          {preview && <path d={preview} fill={tool === 'rect' ? 'rgba(209,249,79,0.15)' : 'none'} stroke="#2f6bff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
      </div>

      <p className="draw__hint">{tool === 'pen' ? t('labPanels.draw.hintPen') : tool === 'rect' ? t('labPanels.draw.hintRect') : t('labPanels.draw.hintLine')}</p>
    </div>
  )
}
