import { useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { Layer } from './LayersPanel'
import { GRAPHIC_MARKS, type CanvasObject } from './objectModel'
import './canvas-objects.css'

type Props = {
  /** Layers that carry a canvas object, panel order (top-first). */
  objects: Layer[]
  hidden: Record<string, boolean>
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Live transform update during a drag (no undo entry). */
  onLive: (id: string, patch: Partial<CanvasObject>) => void
  /** Commit the current state to the undo history (drag end / text edit). */
  onCommit: () => void
  onEditText: (id: string, text: string) => void
}

type Drag =
  | { mode: 'move'; id: string; sx: number; sy: number; ox: number; oy: number; w: number; h: number }
  | { mode: 'resize'; id: string; cx: number; cy: number; startDist: number; startW: number }
  | { mode: 'rotate'; id: string; cx: number; cy: number; startAngle: number; startRot: number }

/** The editable object surface that sits over the garment's print area. */
export function CanvasObjects({ objects, hidden, selectedId, onSelect, onLive, onCommit, onEditText }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const rect = () => boxRef.current?.getBoundingClientRect() ?? new DOMRect(0, 0, 1, 1)

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
    onSelect(l.id)
    const r = rect()
    dragRef.current = { mode: 'move', id: l.id, sx: e.clientX, sy: e.clientY, ox: l.obj.x, oy: l.obj.y, w: r.width, h: r.height }
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
      onLive(d.id, { x: clamp(d.ox + dx), y: clamp(d.oy + dy) })
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
      onCommit()
    }
  }

  return (
    <div className="co-box" ref={boxRef} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      {[...objects].reverse().map((l) => {
        if (!l.obj || hidden[l.id]) return null
        const o = l.obj
        const selected = l.id === selectedId
        return (
          <div
            key={l.id}
            className={`co-obj${selected ? ' is-selected' : ''}${l.locked ? ' is-locked' : ''}`}
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

            {selected && !l.locked && editing !== l.id && (
              <>
                <span className="co-frame" aria-hidden />
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
  if (obj.type === 'text') {
    if (editing) {
      return (
        <input
          className="co-text-input"
          autoFocus
          defaultValue={obj.text}
          style={{ color: obj.color, fontFamily: obj.font, fontWeight: obj.weight }}
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
        style={{ color: obj.color, fontFamily: obj.font, fontWeight: obj.weight, letterSpacing: obj.letterSpacing }}
      >
        {obj.text || 'Text'}
      </span>
    )
  }
  if (obj.type === 'image' && obj.src) {
    return <img className="co-img" src={obj.src} alt="" draggable={false} />
  }
  // graphic
  return (
    <svg className="co-gfx" viewBox="0 0 100 100" style={{ color: obj.color }} dangerouslySetInnerHTML={{ __html: GRAPHIC_MARKS[obj.glyph ?? ''] ?? GRAPHIC_MARKS['Box Logo'] }} />
  )
}

const clamp = (v: number) => Math.max(0, Math.min(1, v))
