import { SuitePage } from '../_shared/SuitePage'
import {
  IcoCoins,
  IcoCollections,
  IcoProduction,
  IcoFactory,
  IcoTrend,
  IcoUpload,
  IcoChevron,
} from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import './an.css'

/* ============================================================
   Mock data — realistic fashion-brand operation
   ============================================================ */

type Kpi = {
  label: string
  value: string
  delta: string
  caption: string
  icon: typeof IcoCoins
  spark: number[]
  down?: boolean
}

const KPIS: Kpi[] = [
  {
    label: 'Revenue',
    value: '$128.4k',
    delta: '+18%',
    caption: 'vs. last 30d',
    icon: IcoCoins,
    spark: [8, 11, 9, 14, 13, 17, 16, 21, 24],
  },
  {
    label: 'Collections',
    value: '8',
    delta: '+2',
    caption: '2 in review',
    icon: IcoCollections,
    spark: [3, 3, 4, 5, 5, 6, 6, 7, 8],
  },
  {
    label: 'Production Orders',
    value: '7',
    delta: '+16%',
    caption: '4 in progress',
    icon: IcoProduction,
    spark: [4, 5, 4, 6, 5, 6, 7, 6, 7],
  },
  {
    label: 'Manufacturers',
    value: '12',
    delta: '+3',
    caption: 'across 5 regions',
    icon: IcoFactory,
    spark: [7, 8, 8, 9, 10, 10, 11, 11, 12],
  },
]

// Revenue area chart — monthly, in $k
const REVENUE = [42, 51, 47, 63, 58, 72, 69, 81, 76, 94, 108, 128]
const REVENUE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type Collection = { name: string; kind: GarmentKind; revenue: string; pct: number }
const TOP_COLLECTIONS: Collection[] = [
  { name: 'SS26 — Concrete Series', kind: 'hoodie', revenue: '$41.2k', pct: 100 },
  { name: 'Vault — Washed Denim', kind: 'jacket', revenue: '$32.8k', pct: 80 },
  { name: 'Baseline — Everyday Tees', kind: 'tee', revenue: '$24.5k', pct: 60 },
  { name: 'Utility — Cargo Drop', kind: 'pants', revenue: '$18.1k', pct: 44 },
  { name: 'Off-Field — Caps', kind: 'cap', revenue: '$11.8k', pct: 29 },
]

// Production by month — units in hundreds
const PRODUCTION = [12, 18, 15, 22, 19, 27, 24, 31, 28, 35, 30, 42]
const PRODUCTION_MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

type Region = { name: string; count: number; color: string }
const REGIONS: Region[] = [
  { name: 'Portugal', count: 4, color: 'var(--s-accent)' },
  { name: 'Turkey', count: 3, color: 'var(--s-accent-2)' },
  { name: 'Vietnam', count: 2, color: 'var(--s-info)' },
  { name: 'India', count: 2, color: 'var(--s-pink)' },
  { name: 'Poland', count: 1, color: 'var(--s-good)' },
]

/* ============================================================
   Sparkline — tiny inline SVG polyline for KPI cards
   ============================================================ */

function Sparkline({ data, down }: { data: number[]; down?: boolean }) {
  const w = 62
  const h = 22
  const max = Math.max(...data)
  const min = Math.min(...data)
  const span = max - min || 1
  const step = w / (data.length - 1)
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`)
  const stroke = down ? 'var(--s-warn)' : 'var(--s-accent-2)'
  return (
    <svg className="an-kpi__spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={Number(pts[pts.length - 1].split(',')[1])} r="2" fill={stroke} />
    </svg>
  )
}

/* ============================================================
   Area chart — smooth Catmull-Rom bezier + violet gradient
   ============================================================ */

const AW = 720
const AH = 240
const APAD = { top: 20, right: 6, bottom: 6, left: 6 }

function buildArea(data: number[]) {
  const max = Math.max(...data) * 1.1
  const innerW = AW - APAD.left - APAD.right
  const innerH = AH - APAD.top - APAD.bottom
  const step = innerW / (data.length - 1)
  const pts = data.map((v, i) => ({
    x: APAD.left + i * step,
    y: APAD.top + innerH - (v / max) * innerH,
  }))

  let line = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    line += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  const baseY = AH - APAD.bottom
  const area = `${line} L ${pts[pts.length - 1].x.toFixed(2)} ${baseY} L ${pts[0].x.toFixed(2)} ${baseY} Z`
  return { line, area, pts }
}

function RevenueChart() {
  const { line, area, pts } = buildArea(REVENUE)
  const last = pts[pts.length - 1]
  const gridLines = [0.25, 0.5, 0.75]
  const innerH = AH - APAD.top - APAD.bottom

  return (
    <div className="an-area">
      <svg
        className="an-area__svg"
        viewBox={`0 0 ${AW} ${AH}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Revenue over the last twelve months"
      >
        <defs>
          <linearGradient id="anRevFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--s-accent)" stopOpacity="0.34" />
            <stop offset="60%" stopColor="var(--s-accent)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--s-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((f) => (
          <line
            key={f}
            x1={APAD.left}
            x2={AW - APAD.right}
            y1={APAD.top + innerH * f}
            y2={APAD.top + innerH * f}
            stroke="var(--s-line)"
            strokeWidth="1"
          />
        ))}

        <path d={area} fill="url(#anRevFill)" />
        <path d={line} fill="none" stroke="var(--s-accent)" strokeWidth="2.5" strokeLinecap="round" />

        {/* marker on last point */}
        <line x1={last.x} x2={last.x} y1={last.y} y2={AH - APAD.bottom} stroke="var(--s-accent-line)" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx={last.x} cy={last.y} r="8" fill="var(--s-accent)" opacity="0.18" />
        <circle cx={last.x} cy={last.y} r="4.5" fill="var(--s-accent)" stroke="var(--s-bg)" strokeWidth="2.5" />
      </svg>
      <div className="an-area__labels">
        {REVENUE_MONTHS.map((m, i) => (
          <span key={`${m}-${i}`}>{m}</span>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   Bar chart — production by month
   ============================================================ */

function ProductionBars() {
  const max = Math.max(...PRODUCTION)
  const peak = PRODUCTION.indexOf(max)
  return (
    <div className="an-bars">
      {PRODUCTION.map((v, i) => {
        const h = Math.round((v / max) * 100)
        const isPeak = i === peak
        return (
          <div className="an-bar" key={`${PRODUCTION_MONTHS[i]}-${i}`}>
            <div className="an-bar__track">
              <span className="an-bar__cap">{v * 100} units</span>
              <span
                className={`an-bar__fill${isPeak ? '' : ' an-bar__fill--muted'}`}
                style={{ height: `${h}%` }}
              />
            </div>
            <span className="an-bar__label">{PRODUCTION_MONTHS[i]}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ============================================================
   Donut — manufacturers by region
   ============================================================ */

function RegionDonut() {
  const total = REGIONS.reduce((sum, r) => sum + r.count, 0)
  const size = 148
  const stroke = 16
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const center = size / 2

  let offset = 0
  const segments = REGIONS.map((r) => {
    const frac = r.count / total
    const dash = frac * circ
    const seg = { color: r.color, dash, gap: circ - dash, dashoffset: -offset }
    offset += dash
    return seg
  })

  return (
    <div className="an-donut">
      <div className="an-donut__ring">
        <svg className="an-donut__svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Manufacturers by region">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--s-inset)" strokeWidth={stroke} />
          {segments.map((seg, i) => (
            <circle
              key={i}
              className="an-donut__slice"
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={`${seg.dash.toFixed(2)} ${seg.gap.toFixed(2)}`}
              strokeDashoffset={seg.dashoffset.toFixed(2)}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="an-donut__center">
          <span className="an-donut__total">{total}</span>
          <span className="an-donut__cap">Partners</span>
        </div>
      </div>
      <ul className="an-donut__legend">
        {REGIONS.map((r) => (
          <li className="an-leg" key={r.name}>
            <span className="an-leg__dot" style={{ background: r.color }} />
            <span className="an-leg__name">{r.name}</span>
            <span className="an-leg__val">{r.count}</span>
            <span className="an-leg__pct">{Math.round((r.count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ============================================================
   Page
   ============================================================ */

export function Analytics() {
  return (
    <SuitePage
      eyebrow="Analytics"
      title="Analytics"
      subtitle="Revenue, collections, production and manufacturers — your whole operation at a glance."
      actions={
        <>
          <button className="an-range" type="button">
            <span className="an-range__dot" aria-hidden="true" />
            Last 30 days
            <IcoChevron className="an-range__chev" width="14" height="14" />
          </button>
          <button className="s-btn s-btn--ghost" type="button">
            <IcoUpload width="15" height="15" /> Export
          </button>
        </>
      }
    >
      <div className="an-root">
        {/* ---- KPI row ---- */}
        <section className="an-kpis">
          {KPIS.map((k) => (
            <article className="an-kpi" key={k.label}>
              <div className="an-kpi__top">
                <span className="an-kpi__label">{k.label}</span>
                <span className="an-kpi__ico">
                  <k.icon width="15" height="15" />
                </span>
              </div>
              <div className="an-kpi__value">{k.value}</div>
              <div className="an-kpi__foot">
                <span className={`an-delta${k.down ? ' an-delta--down' : ''}`}>
                  <IcoTrend width="12" height="12" />
                  {k.delta}
                </span>
                <Sparkline data={k.spark} down={k.down} />
              </div>
              <div className="an-kpi__caption" style={{ marginTop: 6 }}>
                {k.caption}
              </div>
            </article>
          ))}
        </section>

        {/* ---- Revenue chart + top collections ---- */}
        <section className="an-grid">
          <article className="an-card">
            <div className="an-card__head">
              <div>
                <h2 className="an-card__title">Revenue</h2>
                <div className="an-card__figure">
                  <span className="an-card__big">$128.4k</span>
                  <span className="an-delta">
                    <IcoTrend width="12" height="12" /> +18%
                  </span>
                </div>
                <p className="an-card__sub">Gross merchandise value · trailing 12 months</p>
              </div>
              <div className="an-legend">
                <span className="an-legend__item">
                  <span className="an-legend__swatch" style={{ background: 'var(--s-accent)' }} />
                  Revenue
                </span>
              </div>
            </div>
            <RevenueChart />
          </article>

          <article className="an-card an-side">
            <div className="an-card__head" style={{ marginBottom: 8 }}>
              <div>
                <h2 className="an-card__title">Top collections</h2>
                <p className="an-card__sub">By revenue this quarter</p>
              </div>
            </div>
            <div>
              {TOP_COLLECTIONS.map((c) => {
                const Glyph = GARMENT_GLYPHS[c.kind]
                return (
                  <div className="an-coll" key={c.name}>
                    <div className="an-coll__row">
                      <span className="an-coll__glyph">
                        <Glyph width="20" height="20" />
                      </span>
                      <span className="an-coll__name">{c.name}</span>
                      <span className="an-coll__val">{c.revenue}</span>
                    </div>
                    <div className="an-coll__meter">
                      <span className="an-coll__fill" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </article>
        </section>

        {/* ---- Bar chart + donut ---- */}
        <section className="an-lower">
          <article className="an-card">
            <div className="an-card__head">
              <div>
                <h2 className="an-card__title">Production by month</h2>
                <p className="an-card__sub">Units manufactured · this year</p>
              </div>
              <div className="an-legend">
                <span className="an-legend__item">
                  <span className="an-legend__swatch" style={{ background: 'var(--s-accent)' }} />
                  Peak month
                </span>
              </div>
            </div>
            <ProductionBars />
          </article>

          <article className="an-card">
            <div className="an-card__head">
              <div>
                <h2 className="an-card__title">Manufacturers by region</h2>
                <p className="an-card__sub">12 active partners</p>
              </div>
            </div>
            <RegionDonut />
          </article>
        </section>
      </div>
    </SuitePage>
  )
}
