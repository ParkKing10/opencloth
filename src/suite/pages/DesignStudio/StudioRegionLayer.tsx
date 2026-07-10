/**
 * A transparent interactive hit-layer laid over the Studio's static garment backdrop. It never
 * paints the garment (the backdrop does that) — it draws one invisible path per region purely for
 * hit-testing, and outlines the region under the pointer / selected / being dragged. Clicking a
 * region selects it; dragging moves it (committed once on release as a regionTransforms override).
 *
 * Regions live in the garment's SVG viewBox units, so the layer shares the backdrop's viewBox and
 * converts pointer px → units with getBoundingClientRect (already inside the zoomed .cv-world).
 */
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { EditableGarment, GarmentViewId } from '../../garment-model/editableGarment'
import { flattenRegions, isEffectivelyVisible } from '../../garment-model/regionTree'
import './studio-region-layer.css'

type Props = {
  garment: EditableGarment
  view: GarmentViewId
  selectedId: string | null
  /** Off during pan / space-drag so the canvas can be grabbed over the garment. */
  interactive: boolean
  onSelect: (id: string | null) => void
  onMoveRegion: (id: string, dx: number, dy: number) => void
}

const MOVE_THRESHOLD = 3 // px before a click becomes a drag

/** The active view tab label ('Front'/'Back'/…) → the garment's view id for shape filtering. */
export function labelToViewId(label: string, garment: EditableGarment): GarmentViewId {
  if (label === 'Back' && garment.views.some((v) => v.id === 'back')) return 'back'
  return garment.views[0]?.id ?? 'front'
}

export function StudioRegionLayer({ garment, view, selectedId, interactive, onSelect, onMoveRegion }: Props) {
  const viewBox = garment.views.find((v) => v.id === view)?.viewBox ?? garment.views[0]?.viewBox ?? { w: 400, h: 560 }
  const order = useMemo(() => flattenRegions(garment), [garment])
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ id: string; clientX: number; clientY: number; dx: number; dy: number; moved: boolean } | null>(null)

  const scale = () => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { sx: viewBox.w / rect.width, sy: viewBox.h / rect.height }
  }

  const startDrag = (e: ReactPointerEvent, id: string, locked: boolean) => {
    // Keep the click from reaching the viewport (which would deselect) — a region press selects it.
    e.stopPropagation()
    onSelect(id)
    if (locked) return
    // setPointerCapture throws InvalidPointerId if the pointer was already released — never let
    // that abort the drag setup.
    try {
      svgRef.current?.setPointerCapture?.(e.pointerId)
    } catch {
      /* capture is best-effort */
    }
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
    if (drag?.moved && (Math.abs(drag.dx) > 0.01 || Math.abs(drag.dy) > 0.01)) onMoveRegion(drag.id, drag.dx, drag.dy)
    setDrag(null)
  }

  return (
    <svg
      ref={svgRef}
      className={`srl${drag?.moved ? ' is-dragging' : ''}${interactive ? '' : ' is-inert'}`}
      viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {order.map(({ region }) => {
        const shapes = region.shapes.filter((s) => s.view === view)
        if (shapes.length === 0 || !isEffectivelyVisible(garment, region.id)) return null
        const isSel = region.id === selectedId
        const isHover = region.id === hover
        const isDragging = drag?.id === region.id && drag.moved
        const active = isSel || isHover || isDragging
        const cls = ['srl__region', isSel ? 'is-selected' : '', region.locked ? 'is-locked' : '', isDragging ? 'is-moving' : '']
          .filter(Boolean)
          .join(' ')
        return (
          <g
            key={region.id}
            className={cls}
            transform={isDragging ? `translate(${drag.dx} ${drag.dy})` : undefined}
            onPointerDown={(e) => startDrag(e, region.id, region.locked)}
            onPointerEnter={() => setHover(region.id)}
            onPointerLeave={() => setHover((h) => (h === region.id ? null : h))}
          >
            {shapes.map((shape, i) => (
              <path
                key={i}
                d={shape.d}
                className="srl__hit"
                fill="transparent"
                stroke={active ? undefined : 'transparent'}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        )
      })}
    </svg>
  )
}
