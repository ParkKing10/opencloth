/**
 * Renders an EditableGarment as an interactive professional technical flat.
 * Paint is derived from each shape's role (never arbitrary colors), so the output is always
 * on-style. Regions are click-to-select, hover-to-highlight, and DRAG-to-move; locked regions can't
 * be picked or moved; hidden regions (or those under a hidden parent) are skipped. Each region
 * renders ONLY its shapes for the current view — a front-only detail (placket, chest patch) never
 * leaks onto the back. Generated garments are mirrored to both views upstream (ensureBothViews),
 * so a back is never blank; templates carry intentional per-view construction.
 */
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useT } from '@/i18n'
import type { EditableGarment, GarmentViewId } from '../../garment-model/editableGarment'
import { flattenRegions, isEffectivelyVisible } from '../../garment-model/regionTree'
import { paintForShape } from '../../garment-model/garmentStyle'
import './garment-lab.css'

type Props = {
  garment: EditableGarment
  view: GarmentViewId
  selectedId: string | null
  highlightId: string | null
  onSelect: (id: string | null) => void
  onHighlight: (id: string | null) => void
  onMoveRegion?: (id: string, dx: number, dy: number) => void
}

const MOVE_THRESHOLD = 3 // px before a click becomes a drag

export function EditableGarmentCanvas({ garment, view, selectedId, highlightId, onSelect, onHighlight, onMoveRegion }: Props) {
  const t = useT()
  const viewBox = garment.views.find((v) => v.id === view)?.viewBox ?? { w: 400, h: 560 }
  const order = useMemo(() => flattenRegions(garment), [garment])
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ id: string; clientX: number; clientY: number; dx: number; dy: number; moved: boolean } | null>(null)

  const scale = () => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { sx: viewBox.w / rect.width, sy: viewBox.h / rect.height }
  }

  const startDrag = (e: ReactPointerEvent, id: string, locked: boolean) => {
    e.stopPropagation()
    onSelect(id)
    if (locked || !onMoveRegion) return
    ;(e.currentTarget as SVGGElement).ownerSVGElement?.setPointerCapture?.(e.pointerId)
    setDrag({ id, clientX: e.clientX, clientY: e.clientY, dx: 0, dy: 0, moved: false })
  }
  const onMove = (e: ReactPointerEvent) => {
    if (!drag) return
    const { sx, sy } = scale()
    const dx = (e.clientX - drag.clientX) * sx
    const dy = (e.clientY - drag.clientY) * sy
    const moved = drag.moved || Math.abs(e.clientX - drag.clientX) > MOVE_THRESHOLD || Math.abs(e.clientY - drag.clientY) > MOVE_THRESHOLD
    setDrag({ ...drag, dx, dy, moved })
  }
  const endDrag = () => {
    if (drag?.moved && onMoveRegion && (drag.dx !== 0 || drag.dy !== 0)) onMoveRegion(drag.id, drag.dx, drag.dy)
    setDrag(null)
  }

  return (
    <svg
      ref={svgRef}
      className={`eg-canvas${drag?.moved ? ' is-dragging' : ''}`}
      viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
      role="img"
      aria-label={t('labPanels.canvas.aria', { name: garment.name, view })}
      onClick={(e) => {
        // Only a click on the bare background clears the selection — a click that bubbled up from a
        // region must NOT deselect (that made every pick instantly un-stick).
        if (!drag && e.target === e.currentTarget) onSelect(null)
      }}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
    >
      {order.map(({ region }) => {
        // Render ONLY this view's shapes — intentional single-view details must not leak across views.
        const shapes = region.shapes.filter((s) => s.view === view)
        if (shapes.length === 0 || !isEffectivelyVisible(garment, region.id)) return null
        const isDragging = drag?.id === region.id && drag.moved
        const cls = [
          'eg-region',
          region.id === selectedId ? 'is-selected' : '',
          region.id === highlightId ? 'is-highlight' : '',
          region.locked ? 'is-locked' : '',
          isDragging ? 'is-moving' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <g
            key={region.id}
            className={cls}
            transform={isDragging ? `translate(${drag.dx} ${drag.dy})` : undefined}
            onPointerDown={(e) => startDrag(e, region.id, region.locked)}
            onMouseEnter={() => onHighlight(region.id)}
            onMouseLeave={() => onHighlight(null)}
          >
            {shapes.map((shape, i) => {
              const s = paintForShape(shape.role, region.appearance?.fill)
              return (
                <path
                  key={i}
                  d={shape.d}
                  data-role={shape.role}
                  fill={s.fill}
                  stroke={s.stroke}
                  strokeWidth={s.strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={s.dash}
                />
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
