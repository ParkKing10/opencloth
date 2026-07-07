import { useState } from 'react'
import type { SVGProps } from 'react'
import {
  IcoPattern,
  IcoGrid,
  IcoBolt,
  IcoSparkle,
  IcoEye,
  IcoPlus,
  IcoUpload,
  IcoDots,
} from '../../components/ui/Icons'
import './pt.css'

/* ------------------------------------------------------------------ */
/* Piece geometry — hand-authored polygon paths on a 640×520 canvas.   */
/* Each piece carries its seam allowance offset, notches, grainline    */
/* and dimension callouts so the canvas reads like a real CAD sheet.   */
/* ------------------------------------------------------------------ */

type PieceKind = 'bodice-f' | 'bodice-b' | 'sleeve' | 'hood' | 'pocket' | 'cuff' | 'waistband'

type Piece = {
  id: PieceKind
  name: string
  seams: number
  qty: number
  fabric: string
}

const PIECES: Piece[] = [
  { id: 'bodice-f', name: 'Front Bodice', seams: 6, qty: 1, fabric: 'Main · Loopback' },
  { id: 'bodice-b', name: 'Back Bodice', seams: 5, qty: 1, fabric: 'Main · Loopback' },
  { id: 'sleeve', name: 'Sleeve', seams: 4, qty: 2, fabric: 'Main · Loopback' },
  { id: 'hood', name: 'Hood', seams: 3, qty: 2, fabric: 'Main · Loopback' },
  { id: 'pocket', name: 'Kangaroo Pocket', seams: 4, qty: 1, fabric: 'Main · Loopback' },
  { id: 'cuff', name: 'Cuff', seams: 2, qty: 2, fabric: 'Rib · 2×1' },
  { id: 'waistband', name: 'Waistband', seams: 2, qty: 1, fabric: 'Rib · 2×1' },
]

/* A tiny per-piece glyph — abstract outline, purely decorative. */
function PieceGlyph({ kind, ...p }: { kind: PieceKind } & SVGProps<SVGSVGElement>) {
  const paths: Record<PieceKind, string> = {
    'bodice-f': 'M10 6h10l3 4-2 3v9H9v-9l-2-3 3-4Z',
    'bodice-b': 'M10 6h10l2 4-1 3v9H9v-9l-1-3 1-4Z',
    sleeve: 'M8 7l14-1 2 16-4 1-3-9-3 9-4-1L8 7Z',
    hood: 'M8 22C8 12 14 6 22 6c1 6-2 12-9 16H8Z',
    pocket: 'M7 9h18l-2 13H9L7 9Z',
    cuff: 'M8 10h16v8H8z',
    waistband: 'M6 12h20v6H6z',
  }
  return (
    <svg viewBox="0 0 32 30" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" {...p}>
      <path d={paths[kind]} />
    </svg>
  )
}

/* ---- Canvas geometry per piece ---- */
type Geometry = {
  tag: string
  dims: string
  seam: string // main seam polygon
  allowance: string // dashed seam-allowance offset
  grain: { x1: number; y1: number; x2: number; y2: number }
  notches: Array<{ x: number; y: number }>
  nodes: Array<{ x: number; y: number }>
  labels: Array<{ x: number; y: number; text: string }>
  dimensions: Array<{ x1: number; y1: number; x2: number; y2: number; label: string; lx: number; ly: number }>
  name: string
}

const GEO: Record<PieceKind, Geometry> = {
  'bodice-f': {
    name: 'FRONT BODICE',
    tag: 'PIECE 01 / 07',
    dims: '58.4 × 71.2 cm',
    seam: 'M250 90 L390 90 L404 150 L410 300 L400 430 L240 430 L230 300 L236 150 Z',
    allowance:
      'M240 78 L400 78 L416 148 L423 302 L411 442 L229 442 L217 302 L224 148 Z',
    grain: { x1: 320, y1: 110, x2: 320, y2: 410 },
    notches: [
      { x: 320, y: 90 },
      { x: 285, y: 430 },
      { x: 355, y: 430 },
    ],
    nodes: [
      { x: 250, y: 90 },
      { x: 390, y: 90 },
      { x: 410, y: 300 },
      { x: 400, y: 430 },
      { x: 240, y: 430 },
      { x: 230, y: 300 },
    ],
    labels: [{ x: 320, y: 262, text: 'FRONT · CF' }],
    dimensions: [
      { x1: 250, y1: 66, x2: 390, y2: 66, label: '58.4', lx: 320, ly: 60 },
      { x1: 452, y1: 90, x2: 452, y2: 430, label: '71.2', lx: 470, ly: 262 },
    ],
  },
  'bodice-b': {
    name: 'BACK BODICE',
    tag: 'PIECE 02 / 07',
    dims: '60.1 × 71.2 cm',
    seam: 'M244 96 L396 96 L408 150 L414 300 L404 430 L236 430 L226 300 L232 150 Z',
    allowance: 'M234 84 L406 84 L420 148 L427 302 L415 442 L225 442 L214 302 L221 148 Z',
    grain: { x1: 320, y1: 116, x2: 320, y2: 410 },
    notches: [
      { x: 300, y: 96 },
      { x: 340, y: 96 },
      { x: 320, y: 430 },
    ],
    nodes: [
      { x: 244, y: 96 },
      { x: 396, y: 96 },
      { x: 414, y: 300 },
      { x: 404, y: 430 },
      { x: 236, y: 430 },
      { x: 232, y: 150 },
    ],
    labels: [{ x: 320, y: 262, text: 'BACK · CB' }],
    dimensions: [
      { x1: 244, y1: 72, x2: 396, y2: 72, label: '60.1', lx: 320, ly: 66 },
      { x1: 456, y1: 96, x2: 456, y2: 430, label: '71.2', lx: 474, ly: 262 },
    ],
  },
  sleeve: {
    name: 'SLEEVE',
    tag: 'PIECE 03 / 07',
    dims: '44.8 × 62.0 cm',
    seam: 'M320 78 C372 96 396 130 400 168 L378 430 L262 430 L240 168 C244 130 268 96 320 78 Z',
    allowance:
      'M320 66 C382 88 408 128 412 168 L390 444 L250 444 L228 168 C232 128 258 88 320 66 Z',
    grain: { x1: 320, y1: 120, x2: 320, y2: 410 },
    notches: [
      { x: 288, y: 92 },
      { x: 352, y: 92 },
      { x: 268, y: 430 },
    ],
    nodes: [
      { x: 320, y: 78 },
      { x: 400, y: 168 },
      { x: 378, y: 430 },
      { x: 262, y: 430 },
      { x: 240, y: 168 },
    ],
    labels: [{ x: 320, y: 300, text: 'SLEEVE ×2' }],
    dimensions: [
      { x1: 240, y1: 168, x2: 400, y2: 168, label: 'Ø 44.8', lx: 320, ly: 162 },
      { x1: 440, y1: 90, x2: 440, y2: 430, label: '62.0', lx: 458, ly: 260 },
    ],
  },
  hood: {
    name: 'HOOD',
    tag: 'PIECE 04 / 07',
    dims: '34.0 × 40.5 cm',
    seam: 'M240 400 L240 200 C240 130 300 92 380 92 L392 400 Z',
    allowance: 'M228 412 L228 200 C228 122 296 80 384 80 L406 412 Z',
    grain: { x1: 300, y1: 130, x2: 366, y2: 388 },
    notches: [
      { x: 240, y: 300 },
      { x: 320, y: 400 },
    ],
    nodes: [
      { x: 240, y: 400 },
      { x: 240, y: 200 },
      { x: 380, y: 92 },
      { x: 392, y: 400 },
    ],
    labels: [{ x: 318, y: 270, text: 'HOOD ×2' }],
    dimensions: [
      { x1: 240, y1: 428, x2: 392, y2: 428, label: '34.0', lx: 316, ly: 444 },
      { x1: 216, y1: 92, x2: 216, y2: 400, label: '40.5', lx: 198, ly: 250 },
    ],
  },
  pocket: {
    name: 'KANGAROO POCKET',
    tag: 'PIECE 05 / 07',
    dims: '38.2 × 22.4 cm',
    seam: 'M200 200 L440 200 L420 320 L360 300 L340 360 L300 360 L280 300 L220 320 Z',
    allowance: 'M188 188 L452 188 L430 330 L364 310 L346 372 L294 372 L276 310 L210 330 Z',
    grain: { x1: 320, y1: 214, x2: 320, y2: 346 },
    notches: [
      { x: 260, y: 200 },
      { x: 380, y: 200 },
    ],
    nodes: [
      { x: 200, y: 200 },
      { x: 440, y: 200 },
      { x: 420, y: 320 },
      { x: 340, y: 360 },
      { x: 300, y: 360 },
      { x: 220, y: 320 },
    ],
    labels: [{ x: 320, y: 250, text: 'POCKET' }],
    dimensions: [
      { x1: 200, y1: 176, x2: 440, y2: 176, label: '38.2', lx: 320, ly: 170 },
      { x1: 472, y1: 200, x2: 472, y2: 330, label: '22.4', lx: 490, ly: 268 },
    ],
  },
  cuff: {
    name: 'CUFF',
    tag: 'PIECE 06 / 07',
    dims: '20.0 × 8.5 cm',
    seam: 'M180 232 L460 232 L460 300 L180 300 Z',
    allowance: 'M168 220 L472 220 L472 312 L168 312 Z',
    grain: { x1: 220, y1: 266, x2: 420, y2: 266 },
    notches: [
      { x: 320, y: 232 },
      { x: 320, y: 300 },
    ],
    nodes: [
      { x: 180, y: 232 },
      { x: 460, y: 232 },
      { x: 460, y: 300 },
      { x: 180, y: 300 },
    ],
    labels: [{ x: 320, y: 272, text: 'CUFF ×2 · RIB' }],
    dimensions: [
      { x1: 180, y1: 208, x2: 460, y2: 208, label: '20.0', lx: 320, ly: 202 },
      { x1: 492, y1: 232, x2: 492, y2: 300, label: '8.5', lx: 508, ly: 268 },
    ],
  },
  waistband: {
    name: 'WAISTBAND',
    tag: 'PIECE 07 / 07',
    dims: '52.0 × 9.0 cm',
    seam: 'M150 236 L490 236 L490 300 L150 300 Z',
    allowance: 'M138 224 L502 224 L502 312 L138 312 Z',
    grain: { x1: 190, y1: 268, x2: 450, y2: 268 },
    notches: [
      { x: 240, y: 236 },
      { x: 400, y: 236 },
      { x: 320, y: 300 },
    ],
    nodes: [
      { x: 150, y: 236 },
      { x: 490, y: 236 },
      { x: 490, y: 300 },
      { x: 150, y: 300 },
    ],
    labels: [{ x: 320, y: 274, text: 'WAISTBAND · RIB' }],
    dimensions: [
      { x1: 150, y1: 212, x2: 490, y2: 212, label: '52.0', lx: 320, ly: 206 },
      { x1: 522, y1: 236, x2: 522, y2: 300, label: '9.0', lx: 538, ly: 268 },
    ],
  },
}

/* ---- Sizes & measurement grading ---- */
type SizeKey = 'S' | 'M' | 'L' | 'XL'
const SIZES: SizeKey[] = ['S', 'M', 'L', 'XL']

type Measurement = { name: string; code: string; values: Record<SizeKey, number>; unit: string }
const MEASUREMENTS: Measurement[] = [
  { name: 'Chest width', code: 'A · 1/2', values: { S: 56, M: 58.4, L: 61, XL: 64 }, unit: 'cm' },
  { name: 'Body length', code: 'B · HPS', values: { S: 68, M: 71.2, L: 74, XL: 77 }, unit: 'cm' },
  { name: 'Waist width', code: 'C · 1/2', values: { S: 54, M: 56.4, L: 59, XL: 62 }, unit: 'cm' },
  { name: 'Sleeve length', code: 'D · CB', values: { S: 60, M: 62, L: 64, XL: 66 }, unit: 'cm' },
  { name: 'Shoulder', code: 'E · S2S', values: { S: 46, M: 47.5, L: 49, XL: 50.5 }, unit: 'cm' },
  { name: 'Hood height', code: 'F · CF', values: { S: 38.5, M: 40.5, L: 42, XL: 43.5 }, unit: 'cm' },
  { name: 'Cuff opening', code: 'G · relaxed', values: { S: 19, M: 20, L: 21, XL: 22 }, unit: 'cm' },
]

const GRADE_INCREMENT: Record<SizeKey, string> = { S: '−2.4', M: 'base', L: '+2.6', XL: '+5.6' }

export function PatternStudio() {
  const [activePiece, setActivePiece] = useState<PieceKind>('bodice-f')
  const [size, setSize] = useState<SizeKey>('M')
  const [tool, setTool] = useState('select')
  const [showGrid, setShowGrid] = useState(true)
  const [snap, setSnap] = useState(true)
  const [zoom, setZoom] = useState(100)

  const geo = GEO[activePiece]
  const piece = PIECES.find((p) => p.id === activePiece) as Piece

  const clampZoom = (z: number) => Math.min(240, Math.max(40, z))

  return (
    <div className="pt-root">
      {/* ================= Toolbar ================= */}
      <header className="pt-toolbar">
        <div className="pt-brand">
          <span className="pt-brand__ico" aria-hidden="true">
            <IcoPattern width="17" height="17" />
          </span>
          <span className="pt-brand__text">
            <b>Vintage Washed Hoodie</b>
            <small>Block · v4 · imperial off</small>
          </span>
        </div>

        <div className="pt-tools" role="toolbar" aria-label="Piece tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`pt-tool${tool === t.id ? ' is-active' : ''}`}
              onClick={() => setTool(t.id)}
              aria-label={t.label}
              aria-pressed={tool === t.id}
              title={t.label}
            >
              <t.icon width="17" height="17" />
            </button>
          ))}
        </div>

        <span className="pt-sep" aria-hidden="true" />

        <button
          type="button"
          className={`pt-toggle${showGrid ? ' is-on' : ''}`}
          onClick={() => setShowGrid((v) => !v)}
          aria-pressed={showGrid}
        >
          <span className="pt-toggle__led" aria-hidden="true" />
          Grid
        </button>
        <button
          type="button"
          className={`pt-toggle${snap ? ' is-on' : ''}`}
          onClick={() => setSnap((v) => !v)}
          aria-pressed={snap}
        >
          <span className="pt-toggle__led" aria-hidden="true" />
          Snap 1&nbsp;cm
        </button>

        <span className="pt-spacer" />

        <div className="pt-zoom" role="group" aria-label="Zoom">
          <button type="button" className="pt-zoom__btn" onClick={() => setZoom((z) => clampZoom(z - 10))} aria-label="Zoom out">
            −
          </button>
          <button type="button" className="pt-zoom__val" onClick={() => setZoom(100)} title="Reset to 100%">
            {zoom}%
          </button>
          <button type="button" className="pt-zoom__btn" onClick={() => setZoom((z) => clampZoom(z + 10))} aria-label="Zoom in">
            +
          </button>
        </div>
      </header>

      {/* ================= 3-pane workspace ================= */}
      <div className="pt-workspace">
        {/* ---------- Left: pieces ---------- */}
        <aside className="pt-pane pt-pane--left">
          <div className="pt-pane__head">
            <span className="pt-pane__title">Pattern pieces</span>
            <span className="pt-pane__count">{PIECES.length}</span>
          </div>
          <div className="pt-pane__body">
            {PIECES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`pt-piece${activePiece === p.id ? ' is-active' : ''}`}
                onClick={() => setActivePiece(p.id)}
              >
                <span className="pt-piece__glyph" aria-hidden="true">
                  <PieceGlyph kind={p.id} width="22" height="22" />
                </span>
                <span className="pt-piece__main">
                  <span className="pt-piece__name">{p.name}</span>
                  <span className="pt-piece__meta">
                    {p.seams} seams <i>·</i> {p.fabric}
                  </span>
                </span>
                <span className="pt-piece__qty">×{p.qty}</span>
              </button>
            ))}

            <div className="pt-pane__note">
              <IcoSparkle width="15" height="15" />
              <p>
                <b>Auto-walk enabled.</b> Seams re-measured against neighbours on every edit. 2 notches
                pending on the sleeve cap.
              </p>
            </div>
          </div>
        </aside>

        {/* ---------- Center: CAD canvas ---------- */}
        <main className={`pt-canvas${showGrid ? '' : ' is-nogrid'}`}>
          <div className="pt-canvas__grid" aria-hidden="true" />

          <div className="pt-canvas__tag">
            <b>{piece.name}</b>
            <span>
              {geo.tag} · {geo.dims}
            </span>
          </div>

          <div className="pt-canvas__ruler">
            <IcoGrid width="13" height="13" />
            <span>
              Snap <b>{snap ? '1 cm' : 'off'}</b> · scale 1:{Math.round(1000 / zoom)}
            </span>
          </div>

          <svg
            className="pt-canvas__svg"
            viewBox="0 0 640 520"
            preserveAspectRatio="xMidYMid meet"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center' }}
          >
            <defs>
              <marker id="pt-arrow" markerWidth="9" markerHeight="9" refX="4.5" refY="4.5" orient="auto">
                <path d="M1 1 L8 4.5 L1 8 Z" className="pt-grain-cap" />
              </marker>
            </defs>

            {/* seam allowance (dashed, offset outward) */}
            <path className="pt-allow" d={geo.allowance} />

            {/* main cut line */}
            <path className="pt-seam" d={geo.seam} />

            {/* grainline with double arrowhead */}
            <line
              className="pt-grain"
              x1={geo.grain.x1}
              y1={geo.grain.y1}
              x2={geo.grain.x2}
              y2={geo.grain.y2}
              markerStart="url(#pt-arrow)"
              markerEnd="url(#pt-arrow)"
            />

            {/* notches — short perpendicular ticks */}
            {geo.notches.map((n, i) => (
              <line key={`n${i}`} className="pt-notch" x1={n.x} y1={n.y - 8} x2={n.x} y2={n.y + 8} />
            ))}

            {/* dimension callouts */}
            {geo.dimensions.map((d, i) => (
              <g key={`d${i}`}>
                <line className="pt-dim" x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} />
                <line
                  className="pt-dim"
                  x1={d.x1}
                  y1={d.y1 - (d.x1 === d.x2 ? 0 : 5)}
                  x2={d.x1}
                  y2={d.y1 + (d.x1 === d.x2 ? 0 : 5)}
                />
                <line
                  className="pt-dim"
                  x1={d.x2}
                  y1={d.y2 - (d.x1 === d.x2 ? 0 : 5)}
                  x2={d.x2}
                  y2={d.y2 + (d.x1 === d.x2 ? 0 : 5)}
                />
                <text
                  className="pt-dim-lbl"
                  x={d.lx}
                  y={d.ly}
                  textAnchor="middle"
                  transform={d.x1 === d.x2 ? `rotate(-90 ${d.lx} ${d.ly})` : undefined}
                >
                  {d.label}
                </text>
              </g>
            ))}

            {/* piece label(s) */}
            {geo.labels.map((l, i) => (
              <text key={`l${i}`} className="pt-piece-lbl" x={l.x} y={l.y} textAnchor="middle">
                {l.text}
              </text>
            ))}

            {/* corner nodes (control points) */}
            {geo.nodes.map((v, i) => (
              <circle key={`v${i}`} className="pt-node" cx={v.x} cy={v.y} r="3.4" />
            ))}
          </svg>

          <div className="pt-canvas__hud">
            <span className="pt-legend">
              <span className="pt-legend__swatch" /> Cut line
            </span>
            <span className="pt-legend">
              <span className="pt-legend__swatch pt-legend__swatch--dash" /> Seam allowance 1.2 cm
            </span>
            <span className="pt-legend">
              <span className="pt-legend__swatch pt-legend__swatch--notch">
                <IcoBolt width="12" height="12" />
              </span>
              Notch
            </span>
          </div>
        </main>

        {/* ---------- Right: measurements ---------- */}
        <aside className="pt-pane pt-pane--right">
          <div className="pt-pane__head">
            <span className="pt-pane__title">Measurements</span>
            <span className="pt-pane__count">{MEASUREMENTS.length}</span>
          </div>
          <div className="pt-pane__body">
            <div className="pt-size" role="group" aria-label="Size">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`pt-size__btn${size === s ? ' is-active' : ''}`}
                  onClick={() => setSize(s)}
                  aria-pressed={size === s}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="pt-measure">
              {MEASUREMENTS.map((m) => {
                const base = m.values.M
                const cur = m.values[size]
                const delta = cur - base
                const deltaStr = delta === 0 ? '±0' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`
                return (
                  <div className="pt-measure__row" key={m.code}>
                    <span className="pt-measure__label">
                      <b>{m.name}</b>
                      <small>{m.code}</small>
                    </span>
                    <span className="pt-measure__val">
                      {cur.toFixed(1)}
                      <i>{m.unit}</i>
                    </span>
                    <span className={`pt-measure__delta${delta > 0 ? ' is-up' : ''}`}>{deltaStr}</span>
                  </div>
                )
              })}
            </div>

            {/* Grading mini section */}
            <section className="pt-grade">
              <div className="pt-grade__head">
                <b>Grading</b>
                <span className="s-chip s-chip--accent">
                  <IcoEye width="11" height="11" /> Nested
                </span>
              </div>
              <div className="pt-grade__scale" aria-hidden="true">
                {SIZES.map((s, i) => (
                  <span key={s} className={`pt-grade__bar${size === s ? ' is-active' : ''}`}>
                    <span style={{ height: `${28 + i * 9}px` }} />
                    <small>{s}</small>
                  </span>
                ))}
              </div>
              <div className="pt-grade__foot">
                <span>
                  Increment · <b>{GRADE_INCREMENT[size]}</b>
                </span>
                <span>
                  Rule · <b>ASTM 1/2&quot;</b>
                </span>
              </div>
            </section>
          </div>
        </aside>
      </div>

      {/* ================= Status bar ================= */}
      <footer className="pt-status">
        <span className="pt-status__item">
          <span className="s-dot" style={{ background: 'var(--s-good)' }} /> <b>Synced</b>
        </span>
        <span className="pt-status__item pt-status__item--hide">
          Active&nbsp;<b>{piece.name}</b>
        </span>
        <span className="pt-status__item pt-status__item--hide">
          Size&nbsp;<b>{size}</b> · {SIZES.length} nested
        </span>
        <span className="pt-status__spacer" />
        <span className="pt-status__item pt-status__item--hide">Units cm · seam 1.2 cm</span>
        <span className="pt-status__item">
          Zoom&nbsp;<b>{zoom}%</b>
        </span>
      </footer>
    </div>
  )
}

const TOOLS = [
  { id: 'select', label: 'Select', icon: IcoGrid },
  { id: 'pen', label: 'Add point', icon: IcoPlus },
  { id: 'measure', label: 'Measure', icon: IcoBolt },
  { id: 'notch', label: 'Notch', icon: IcoUpload },
  { id: 'more', label: 'More', icon: IcoDots },
] as const
