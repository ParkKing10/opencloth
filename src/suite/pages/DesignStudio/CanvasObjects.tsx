import { useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { Layer } from './LayersPanel'
import { GRAPHIC_MARKS, type CanvasObject } from './objectModel'
import './canvas-objects.css'

export type Overlays = { safe: boolean; bleed: boolean; print: boolean }

type Props = {
  /** Layers that carry a canvas object, panel order (top-first). */
  objects: Layer[]
  hidden: Record<string, boolean>
  /** All currently-selected object ids (multi-select). */
  selectedIds: string[]
  /** Select an object. additive=true toggles it in/out of the current selection (Shift+Click). */
  onSelect: (id: string | null, additive?: boolean) => void
  /** Live transform update during a drag (no undo entry). */
  onLive: (id: string, patch: Partial<CanvasObject>) => void
  /** Commit the current state to the undo history (drag end / text edit). */
  onCommit: () => void
  onEditText: (id: string, text: string) => void
  /** Which print-zone overlays to show (all hidden by default). */
  overlays?: Overlays
}

type Drag =
  | { mode: 'move'; id: string; sx: number; sy: number; ox: number; oy: number; w: number; h: number; halfW: number; halfH: number; group: { id: string; ox: number; oy: number }[] }
  | { mode: 'resize'; id: string; cx: number; cy: number; startDist: number; startW: number }
  | { mode: 'rotate'; id: string; cx: number; cy: number; startAngle: number; startRot: number }

/** The editable object surface that sits over the garment's print area. */
export function CanvasObjects({ objects, hidden, selectedIds, onSelect, onLive, onCommit, onEditText, overlays }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  // Snap-guide positions (0..1 within the print area) shown while dragging; null = no guide.
  const [snap, setSnap] = useState<{ x: number | null; y: number | null }>({ x: null, y: null })
  // Ids of objects whose bounds spill outside the print area — a soft warning, never a block.
  const [outside, setOutside] = useState<string[]>([])

  const rect = () => boxRef.current?.getBoundingClientRect() ?? new DOMRect(0, 0, 1, 1)

  // Measure objects against the print area — ONLY while the Print guide is on (the only time
  // the warning shows). Skipping it otherwise avoids a full DOM sweep on every edit, which
  // matters at hundreds of objects. The set-equality bail-out prevents render churn.
  useLayoutEffect(() => {
    if (!overlays?.print) {
      setOutside((prev) => (prev.length ? [] : prev))
      return
    }
    const box = boxRef.current?.getBoundingClientRect()
    if (!box) return
    const eps = 0.5
    const next: string[] = []
    for (const l of objects) {
      if (!l.obj || hidden[l.id]) continue
      const el = boxRef.current?.querySelector<HTMLElement>(`.co-obj[data-id="${l.id}"]`)
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (r.left < box.left - eps || r.right > box.right + eps || r.top < box.top - eps || r.bottom > box.bottom + eps) {
        next.push(l.id)
      }
    }
    setOutside((prev) => (prev.length === next.length && prev.every((id, i) => id === next[i]) ? prev : next))
  }, [objects, hidden, overlays?.print])

  const anyOutside = outside.length > 0

  function capture(el: HTMLElement, pointerId: number) {
    try {
      el.setPointerCapture(pointerId)
    } catch {
      /* synthetic / already-released pointers can't be captured — the box still tracks the move */
    }
  }

  function onPointerDownBody(e: RPointerEvent<HTMLDivElement>, l: Layer) {
    if (editing || l.locked || !l.obj) return
    e.stopPropagation()
    // Shift+Click toggles this object in/out of the selection (no drag).
    if (e.shiftKey) {
      onSelect(l.id, true)
      return
    }
    // Dragging an already-selected object in a multi-selection moves the whole group;
    // otherwise this click replaces the selection with just this object.
    const inMulti = selectedIds.length > 1 && selectedIds.includes(l.id)
    if (!inMulti) onSelect(l.id)
    const r = rect()
    const objR = e.currentTarget.getBoundingClientRect()
    const halfW = r.width ? objR.width / 2 / r.width : 0.1
    const halfH = r.height ? objR.height / 2 / r.height : 0.1
    const movingIds = inMulti ? selectedIds : [l.id]
    const group = movingIds
      .map((id) => objects.find((o) => o.id === id))
      .filter((o): o is Layer => !!o && !!o.obj && !o.locked)
      .map((o) => ({ id: o.id, ox: o.obj!.x, oy: o.obj!.y }))
    dragRef.current = { mode: 'move', id: l.id, sx: e.clientX, sy: e.clientY, ox: l.obj.x, oy: l.obj.y, w: r.width, h: r.height, halfW, halfH, group }
    capture(e.currentTarget, e.pointerId)
  }

  function onPointerDownHandle(e: RPointerEvent<HTMLButtonElement>, l: Layer, kind: 'resize' | 'rotate') {
    if (!l.obj) return
    e.stopPropagation()
    e.preventDefault()
    const r = rect()
    const cx = r.left + l.obj.x * r.width
    const cy = r.top + l.obj.y * r.height
    if (kind === 'resize') {
      const startDist = Math.hypot(e.clientX - cx, e.clientY - cy)
      dragRef.current = { mode: 'resize', id: l.id, cx, cy, startDist: startDist || 1, startW: l.obj.width }
    } else {
      const startAngle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI
      dragRef.current = { mode: 'rotate', id: l.id, cx, cy, startAngle, startRot: l.obj.rotation }
    }
    capture(e.currentTarget, e.pointerId)
  }

  function onPointerMove(e: RPointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d) return
    if (d.mode === 'move') {
      const dx = (e.clientX - d.sx) / d.w
      const dy = (e.clientY - d.sy) / d.h
      let nx = clamp(d.ox + dx)
      let ny = clamp(d.oy + dy)
      // Snap the object's center OR either edge to the print-area center / bounds. Each
      // candidate maps to a guide line: { at = center value to snap to, guide = the line shown }.
      // Hold Alt for free placement.
      let gx: number | null = null
      let gy: number | null = null
      if (!e.altKey) {
        const xCands = [
          { at: d.halfW, guide: 0 },
          { at: 0.5, guide: 0.5 },
          { at: 1 - d.halfW, guide: 1 },
        ]
        const yCands = [
          { at: d.halfH, guide: 0 },
          { at: 0.5, guide: 0.5 },
          { at: 1 - d.halfH, guide: 1 },
        ]
        for (const c of xCands) if (Math.abs(nx - c.at) < SNAP_THRESHOLD) { nx = c.at; gx = c.guide; break }
        for (const c of yCands) if (Math.abs(ny - c.at) < SNAP_THRESHOLD) { ny = c.at; gy = c.guide; break }
      }
      setSnap({ x: gx, y: gy })
      // Move the whole selected group by the pressed object's (snapped) delta.
      const ddx = nx - d.ox
      const ddy = ny - d.oy
      if (d.group.length > 1) {
        for (const g of d.group) {
          if (g.id === d.id) onLive(g.id, { x: nx, y: ny })
          else onLive(g.id, { x: clamp(g.ox + ddx), y: clamp(g.oy + ddy) })
        }
      } else {
        onLive(d.id, { x: nx, y: ny })
      }
    } else if (d.mode === 'resize') {
      const dist = Math.hypot(e.clientX - d.cx, e.clientY - d.cy)
      onLive(d.id, { width: Math.max(0.06, Math.min(1.4, d.startW * (dist / d.startDist))) })
    } else {
      const ang = (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI
      let rot = Math.round(d.startRot + (ang - d.startAngle))
      if (e.shiftKey) rot = Math.round(rot / 15) * 15
      onLive(d.id, { rotation: rot })
    }
  }

  function endDrag() {
    if (dragRef.current) {
      dragRef.current = null
      setSnap({ x: null, y: null })
      onCommit()
    }
  }

  return (
    <div className="co-box" ref={boxRef} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      {/* Print-zone overlays (optional, hidden by default). Bleed sits outside, safe inside. */}
      {overlays?.bleed && <span className="co-zone co-zone--bleed" aria-hidden><span className="co-zone__tag">Bleed</span></span>}
      {overlays?.print && <span className="co-zone co-zone--print" aria-hidden><span className="co-zone__tag">Print area</span></span>}
      {overlays?.safe && <span className="co-zone co-zone--safe" aria-hidden><span className="co-zone__tag">Safe area</span></span>}
      {/* Only warn about the print area when the user has actually turned that guide on —
          otherwise it's just noise (we have no real per-garment print zone to warn against). */}
      {overlays?.print && anyOutside && (
        <span className="co-warn" role="status">
          {outside.length} object{outside.length === 1 ? '' : 's'} outside the print area
        </span>
      )}
      {snap.x != null && <span className="co-guide co-guide--v" style={{ left: `${snap.x * 100}%` }} aria-hidden />}
      {snap.y != null && <span className="co-guide co-guide--h" style={{ top: `${snap.y * 100}%` }} aria-hidden />}
      {[...objects].reverse().map((l) => {
        if (!l.obj || hidden[l.id]) return null
        const o = l.obj
        const selected = selectedIds.includes(l.id)
        // Resize/rotate handles only for a single selection; multi-select supports move together.
        const showHandles = selected && selectedIds.length === 1
        return (
          <div
            key={l.id}
            data-id={l.id}
            className={`co-obj${selected ? ' is-selected' : ''}${l.locked ? ' is-locked' : ''}${overlays?.print && outside.includes(l.id) ? ' is-outside' : ''}`}
            style={{
              left: `${o.x * 100}%`,
              top: `${o.y * 100}%`,
              width: `${o.width * 100}%`,
              transform: `translate(-50%, -50%) rotate(${o.rotation}deg)`,
              opacity: o.opacity,
            }}
            onPointerDown={(e) => onPointerDownBody(e, l)}
            onDoubleClick={() => o.type === 'text' && !l.locked && setEditing(l.id)}
          >
            <ObjectContent obj={o} editing={editing === l.id} onText={(t) => { onEditText(l.id, t); onCommit() }} onDone={() => setEditing(null)} />

            {selected && editing !== l.id && <span className="co-frame" aria-hidden />}
            {showHandles && !l.locked && editing !== l.id && (
              <>
                <button
                  className="co-handle co-handle--rotate"
                  type="button"
                  aria-label="Rotate"
                  onPointerDown={(e) => onPointerDownHandle(e, l, 'rotate')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v3h3" />
                  </svg>
                </button>
                <span className="co-rotate-stem" aria-hidden />
                {(['nw', 'ne', 'se', 'sw'] as const).map((c) => (
                  <button
                    key={c}
                    className={`co-handle co-handle--${c}`}
                    type="button"
                    aria-label={`Resize ${c}`}
                    onPointerDown={(e) => onPointerDownHandle(e, l, 'resize')}
                  />
                ))}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ObjectContent({
  obj,
  editing,
  onText,
  onDone,
}: {
  obj: CanvasObject
  editing: boolean
  onText: (t: string) => void
  onDone: () => void
}) {
  // Blend the artwork onto the garment (scoped to content so the selection frame stays crisp).
  const bm = obj.blendMode && obj.blendMode !== 'normal' ? obj.blendMode : undefined
  if (obj.type === 'text') {
    if (editing) {
      return (
        <input
          className="co-text-input"
          autoFocus
          defaultValue={obj.text}
          style={{ color: obj.color, fontFamily: obj.font, fontWeight: obj.weight, letterSpacing: obj.letterSpacing, textAlign: obj.align ?? 'center' }}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => {
            onText(e.currentTarget.value)
            onDone()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onText((e.target as HTMLInputElement).value)
              onDone()
            }
            if (e.key === 'Escape') onDone()
          }}
        />
      )
    }
    return (
      <span
        className="co-text"
        style={{
          color: obj.color,
          fontFamily: obj.font,
          fontWeight: obj.weight,
          fontStyle: obj.italic ? 'italic' : undefined,
          textDecoration: obj.underline ? 'underline' : undefined,
          letterSpacing: obj.letterSpacing,
          lineHeight: obj.lineHeight ?? 1.1,
          textAlign: obj.align ?? 'center',
          mixBlendMode: bm,
        }}
      >
        {obj.text || 'Text'}
      </span>
    )
  }
  const flip = `scale(${obj.flipH ? -1 : 1}, ${obj.flipV ? -1 : 1})`
  if (obj.type === 'shape' || obj.type === 'path') {
    return <VectorContent obj={obj} flip={flip} />
  }
  if (obj.type === 'image' && obj.src) {
    return <img className="co-img" src={obj.src} alt="" draggable={false} style={{ transform: flip, mixBlendMode: bm }} />
  }
  // graphic
  return (
    <svg className="co-gfx" viewBox="0 0 100 100" style={{ color: obj.color, transform: flip, mixBlendMode: bm }} dangerouslySetInnerHTML={{ __html: GRAPHIC_MARKS[obj.glyph ?? ''] ?? GRAPHIC_MARKS['Box Logo'] }} />
  )
}

/** Vector primitives (rectangle / ellipse / path), drawn in a local 0..100 × 0..(100·aspect) viewBox. */
function VectorContent({ obj, flip }: { obj: CanvasObject; flip: string }) {
  const aspect = obj.aspect && obj.aspect > 0 ? obj.aspect : 1
  const vbH = 100 * aspect
  const sw = Math.max(0, obj.strokeWidth ?? 0)
  const fill = obj.fill && obj.fill !== 'none' ? obj.fill : 'none'
  const stroke = obj.stroke && obj.stroke !== 'none' ? obj.stroke : 'none'
  const bm = obj.blendMode && obj.blendMode !== 'normal' ? obj.blendMode : undefined
  return (
    <svg className="co-shape" viewBox={`0 0 100 ${vbH}`} style={{ transform: flip, mixBlendMode: bm }} preserveAspectRatio="none">
      {obj.type === 'shape' && obj.shape === 'ellipse' ? (
        <ellipse cx={50} cy={vbH / 2} rx={Math.max(0.5, 50 - sw / 2)} ry={Math.max(0.5, vbH / 2 - sw / 2)} fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : obj.type === 'shape' ? (
        <rect x={sw / 2} y={sw / 2} width={Math.max(0.5, 100 - sw)} height={Math.max(0.5, vbH - sw)} rx={Math.max(0, obj.cornerRadius ?? 0)} fill={fill} stroke={stroke} strokeWidth={sw} />
      ) : (
        <path d={obj.d ?? ''} fill={obj.closed ? fill : 'none'} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}

const clamp = (v: number) => Math.max(0, Math.min(1, v))
/** How close (in print-area fraction) an object must be to a center axis to snap. */
const SNAP_THRESHOLD = 0.022
