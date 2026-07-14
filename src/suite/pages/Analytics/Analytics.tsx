import { useMemo, useRef, useState, useEffect } from 'react'
import { SuitePage } from '../_shared/SuitePage'
import {
  IcoCoins,
  IcoCollections,
  IcoProduction,
  IcoFactory,
  IcoTrend,
  IcoUpload,
  IcoChevron,
  IcoCheck,
} from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { downloadCsv, slugify } from '../../lib/download'
import { useT } from '@/i18n'
import './an.css'

/* ============================================================
   Date range — drives every number & chart on the page
   ============================================================ */

type RangeKey = '30d' | '90d' | '12m'

type RangeDef = {
  key: RangeKey
  label: string
  short: string
  /** How many trailing buckets of the base 12-month series to show. */
  buckets: number
  /** Axis labels for the revenue area chart (one per bucket). */
  months: string[]
  /** Axis labels for the production bars (one per bucket). */
  bars: string[]
  caption: string
}

// Base series — deterministic, trailing 12 months. Ranges slice/reshape these
// so charts and totals visibly change without any per-render randomness.
const BASE_REVENUE = [42, 51, 47, 63, 58, 72, 69, 81, 76, 94, 108, 128] // $k / month
const BASE_PRODUCTION = [12, 18, 15, 22, 19, 27, 24, 31, 28, 35, 30, 42] // units / hundred
const MONTHS_12 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_12_SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

// The 30-day window is shown as four weekly buckets carved out of the final
// month's revenue — an accelerating ramp that sums back to that month.
const WEEK_REVENUE = [26, 29, 34, 39] // $k / week  (sums to ~128k month)
const WEEK_PRODUCTION = [9, 10, 11, 12] // units / hundred per week
const WEEK_LABELS = ['W1', 'W2', 'W3', 'W4']

const RANGES: Record<RangeKey, RangeDef> = {
  '30d': {
    key: '30d',
    label: 'Last 30 days',
    short: '30d',
    buckets: 4,
    months: WEEK_LABELS,
    bars: WEEK_LABELS,
    caption: 'trailing 4 weeks',
  },
  '90d': {
    key: '90d',
    label: 'Last 90 days',
    short: '90d',
    buckets: 3,
    months: MONTHS_12.slice(-3),
    bars: MONTHS_12_SHORT.slice(-3),
    caption: 'trailing 3 months',
  },
  '12m': {
    key: '12m',
    label: 'Last 12 months',
    short: '12m',
    buckets: 12,
    months: MONTHS_12,
    bars: MONTHS_12_SHORT,
    caption: 'trailing 12 months',
  },
}

const RANGE_ORDER: RangeKey[] = ['30d', '90d', '12m']

/** Deterministic revenue/production series for a range. */
function seriesFor(range: RangeKey): { revenue: number[]; production: number[] } {
  if (range === '30d') {
    return { revenue: WEEK_REVENUE, production: WEEK_PRODUCTION }
  }
  const def = RANGES[range]
  return {
    revenue: BASE_REVENUE.slice(-def.buckets),
    production: BASE_PRODUCTION.slice(-def.buckets),
  }
}

/** Fraction of the trailing window that lands inside the given range. */
function windowFraction(range: RangeKey): number {
  if (range === '30d') return 0.33
  if (range === '90d') return 0.66
  return 1
}

function fmtMoney(k: number): string {
  return `$${k.toFixed(1)}k`
}

/* ============================================================
   KPI model
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

/* ============================================================
   Sparkline — tiny inline SVG polyline for KPI cards
   ============================================================ */

function Sparkline({ data, down }: { data: number[]; down?: boolean }) {
  const w = 62
  const h = 22
  const max = Math.max(...data)
  const min = Math.min(...data)
  const span = max - min || 1
  const step = w / (data.length - 1 || 1)
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
   Area chart — smooth Catmull-Rom bezier + accent gradient
   ============================================================ */

const AW = 720
const AH = 240
const APAD = { top: 20, right: 6, bottom: 6, left: 6 }

function buildArea(data: number[]) {
  const max = Math.max(...data) * 1.1 || 1
  const innerW = AW - APAD.left - APAD.right
  const innerH = AH - APAD.top - APAD.bottom
  const step = innerW / (data.length - 1 || 1)
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

function RevenueChart({ data, labels }: { data: number[]; labels: string[] }) {
  const t = useT()
  const { line, area, pts } = buildArea(data)
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
        aria-label={t('analytics.revenueChart.aria', { n: labels.length })}
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
        {labels.map((m, i) => (
          <span key={`${m}-${i}`}>{m}</span>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   Bar chart — production by period
   ============================================================ */

function ProductionBars({ data, labels }: { data: number[]; labels: string[] }) {
  const t = useT()
  const max = Math.max(...data) || 1
  const peak = data.indexOf(max)
  return (
    <div className="an-bars" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
      {data.map((v, i) => {
        const h = Math.round((v / max) * 100)
        const isPeak = i === peak
        return (
          <div className="an-bar" key={`${labels[i]}-${i}`}>
            <div className="an-bar__track">
              <span className="an-bar__cap">{t('analytics.bar.units', { n: v * 100 })}</span>
              <span
                className={`an-bar__fill${isPeak ? '' : ' an-bar__fill--muted'}`}
                style={{ height: `${h}%` }}
              />
            </div>
            <span className="an-bar__label">{labels[i]}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ============================================================
   Donut — manufacturers by region (derived from the store)
   ============================================================ */

type Region = { name: string; count: number; color: string }

const REGION_COLORS = [
  'var(--s-accent)',
  'var(--s-accent-2)',
  'var(--s-info)',
  'var(--s-pink)',
  'var(--s-good)',
  'var(--s-warn)',
]

function RegionDonut({ regions }: { regions: Region[] }) {
  const t = useT()
  const total = regions.reduce((sum, r) => sum + r.count, 0)
  const size = 148
  const stroke = 16
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const center = size / 2

  let offset = 0
  const segments = regions.map((r) => {
    const frac = total ? r.count / total : 0
    const dash = frac * circ
    const seg = { color: r.color, dash, gap: circ - dash, dashoffset: -offset }
    offset += dash
    return seg
  })

  return (
    <div className="an-donut">
      <div className="an-donut__ring">
        <svg className="an-donut__svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t('analytics.region.title')}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--s-inset)" strokeWidth={stroke} />
          {segments.map((seg, i) => (
            <circle
              key={regions[i].name}
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
          <span className="an-donut__cap">{t('analytics.donut.partners')}</span>
        </div>
      </div>
      <ul className="an-donut__legend">
        {regions.map((r) => (
          <li className="an-leg" key={r.name}>
            <span className="an-leg__dot" style={{ background: r.color }} />
            <span className="an-leg__name">{r.name}</span>
            <span className="an-leg__val">{r.count}</span>
            <span className="an-leg__pct">{total ? Math.round((r.count / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ============================================================
   Range picker — controlled dropdown in the page header
   ============================================================ */

function RangePicker({ value, onChange }: { value: RangeKey; onChange: (r: RangeKey) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="an-rangewrap" ref={wrapRef}>
      <button
        className="an-range"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t('analytics.range.pickerTitle')}
      >
        <span className="an-range__dot" aria-hidden="true" />
        {t(`analytics.range.${value}.label`)}
        <IcoChevron className="an-range__chev" width="14" height="14" />
      </button>
      {open && (
        <ul className="an-rangemenu" role="listbox" aria-label={t('analytics.range.menuAria')}>
          {RANGE_ORDER.map((key) => (
            <li key={key} role="option" aria-selected={key === value}>
              <button
                type="button"
                className={`an-rangeopt${key === value ? ' is-active' : ''}`}
                onClick={() => {
                  onChange(key)
                  setOpen(false)
                }}
              >
                <span>{t(`analytics.range.${key}.label`)}</span>
                {key === value && <IcoCheck width="14" height="14" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ============================================================
   Page
   ============================================================ */

export function Analytics() {
  const { data } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const t = useT()
  const [range, setRange] = useState<RangeKey>('30d')

  const def = RANGES[range]
  const rangeLabel = t(`analytics.range.${range}.label`)
  const rangeCaption = t(`analytics.range.${range}.caption`)
  // Month axis labels translated at the render site (week labels W1–W4 are locale-neutral).
  const monthLabels = def.months.map((m) => {
    const key: Record<string, string> = {
      Jan: 'analytics.mon.jan',
      Feb: 'analytics.mon.feb',
      Mar: 'analytics.mon.mar',
      Apr: 'analytics.mon.apr',
      May: 'analytics.mon.may',
      Jun: 'analytics.mon.jun',
      Jul: 'analytics.mon.jul',
      Aug: 'analytics.mon.aug',
      Sep: 'analytics.mon.sep',
      Oct: 'analytics.mon.oct',
      Nov: 'analytics.mon.nov',
      Dec: 'analytics.mon.dec',
    }
    return key[m] ? t(key[m]) : m
  })

  // ---- Real store data, scoped to the signed-in creator ----
  const myOrders = useMemo(
    () => (user ? data.orders.filter((o) => o.ownerId === user.id) : []),
    [data.orders, user],
  )
  const myTechPacks = useMemo(
    () => (user ? data.techPacks.filter((t) => t.ownerId === user.id) : []),
    [data.techPacks, user],
  )
  const myCollections = useMemo(
    () => (user ? data.collections.filter((c) => c.ownerId === user.id) : []),
    [data.collections, user],
  )
  const myDesigns = useMemo(
    () => (user ? data.designs.filter((dz) => dz.ownerId === user.id) : []),
    [data.designs, user],
  )

  // ---- Derived series + totals for the active range ----
  const { revenue, production } = useMemo(() => seriesFor(range), [range])
  const revenueTotal = useMemo(() => revenue.reduce((a, b) => a + b, 0), [revenue])
  const prevTotal = useMemo(() => {
    // Prior comparable window = the buckets just before the visible ones.
    const priorEnd = BASE_REVENUE.length - def.buckets
    const priorStart = Math.max(0, priorEnd - def.buckets)
    const slice = BASE_REVENUE.slice(priorStart, priorEnd)
    return slice.reduce((a, b) => a + b, 0) || revenueTotal
  }, [def.buckets, revenueTotal])
  const revenueDelta = useMemo(() => {
    if (range === '30d') return 12 // weekly window vs prior weeks
    const pct = prevTotal ? Math.round(((revenueTotal - prevTotal) / prevTotal) * 100) : 0
    return pct
  }, [range, revenueTotal, prevTotal])

  // Orders / production active inside the window (deterministic slice).
  const frac = windowFraction(range)
  const ordersInWindow = Math.max(1, Math.round(myOrders.length * frac))
  const ordersActive = myOrders.filter((o) => o.stage !== 'delivered').length
  const productionUnits = useMemo(() => production.reduce((a, b) => a + b, 0) * 100, [production])

  // ---- Manufacturers by country (real store data) ----
  const regions = useMemo<Region[]>(() => {
    const counts = new Map<string, number>()
    for (const m of data.manufacturers) counts.set(m.country, (counts.get(m.country) ?? 0) + 1)
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({ name, count, color: REGION_COLORS[i % REGION_COLORS.length] }))
  }, [data.manufacturers])

  // ---- Top collections by revenue (deterministic, scaled to the window) ----
  const topCollections = useMemo(() => {
    const kinds: GarmentKind[] = ['hoodie', 'jacket', 'tee', 'pants', 'cap']
    // Weight each of the user's collections by a stable factor, scaled by window.
    const base = myCollections.length
      ? myCollections.map((c, i) => ({ name: c.name, kind: kinds[i % kinds.length] }))
      : [
          { name: 'SS26 — Concrete Series', kind: 'hoodie' as GarmentKind },
          { name: 'Vault — Washed Denim', kind: 'jacket' as GarmentKind },
          { name: 'Baseline — Everyday Tees', kind: 'tee' as GarmentKind },
        ]
    const weights = [41.2, 32.8, 24.5, 18.1, 11.8]
    const rows = base.slice(0, 5).map((c, i) => {
      const rev = (weights[i] ?? 8) * frac
      return { name: c.name, kind: c.kind, rev }
    })
    const top = rows[0]?.rev || 1
    return rows.map((r) => ({ ...r, pct: Math.round((r.rev / top) * 100), revenue: fmtMoney(r.rev) }))
  }, [myCollections, frac])

  // ---- KPI cards (mix of window-derived + real store counts) ----
  const kpis = useMemo<Kpi[]>(() => {
    const revSpark = revenue.length >= 2 ? revenue : [revenue[0] ?? 0, revenue[0] ?? 0]
    return [
      {
        label: t('analytics.kpi.revenue'),
        value: fmtMoney(revenueTotal),
        delta: `${revenueDelta >= 0 ? '+' : ''}${revenueDelta}%`,
        caption: t('analytics.kpi.vsPrior', { short: def.short }),
        icon: IcoCoins,
        spark: revSpark,
        down: revenueDelta < 0,
      },
      {
        label: t('analytics.kpi.collections'),
        value: String(myCollections.length),
        delta: `${myDesigns.length}`,
        caption: t('analytics.kpi.designsInFlight', { n: myDesigns.length }),
        icon: IcoCollections,
        spark: revSpark.map((_, i) => i + 1),
      },
      {
        label: t('analytics.kpi.productionOrders'),
        value: String(ordersInWindow),
        delta: t('analytics.kpi.ordersActive', { n: ordersActive }),
        caption: t('analytics.kpi.productionCaption', {
          n: productionUnits.toLocaleString(),
          caption: rangeCaption,
        }),
        icon: IcoProduction,
        spark: production.length >= 2 ? production : [production[0] ?? 0, production[0] ?? 0],
      },
      {
        label: t('analytics.kpi.manufacturers'),
        value: String(data.manufacturers.length),
        delta: t('analytics.kpi.regions', { n: regions.length }),
        caption: t('analytics.kpi.techPacksLinked', { n: myTechPacks.length }),
        icon: IcoFactory,
        spark: regions.map((r) => r.count).length >= 2 ? regions.map((r) => r.count) : [1, 1],
      },
    ]
  }, [
    t,
    revenue,
    revenueTotal,
    revenueDelta,
    def.short,
    rangeCaption,
    myCollections.length,
    myDesigns.length,
    ordersInWindow,
    ordersActive,
    productionUnits,
    production,
    data.manufacturers.length,
    regions,
    myTechPacks.length,
  ])

  function handleExport() {
    // Build a single, flat, uniform CSV of the current view: KPI summary rows
    // followed by the per-period revenue & production series driving the charts.
    type Row = {
      section: string
      metric: string
      period: string
      value: string
      detail: string
    }

    const kpiRows: Row[] = kpis.map((k) => ({
      section: t('analytics.export.sectionKpi'),
      metric: k.label,
      period: rangeLabel,
      value: k.value,
      detail: `${k.delta} · ${k.caption}`,
    }))

    const revenueRows: Row[] = revenue.map((v, i) => ({
      section: t('analytics.export.sectionRevenue'),
      metric: t('analytics.export.metricRevenue'),
      period: monthLabels[i] ?? `P${i + 1}`,
      value: fmtMoney(v),
      detail: rangeCaption,
    }))

    const productionRows: Row[] = production.map((v, i) => ({
      section: t('analytics.export.sectionProduction'),
      metric: t('analytics.export.metricUnits'),
      period: def.bars[i] ?? `P${i + 1}`,
      value: String(v * 100),
      detail: rangeCaption,
    }))

    const regionRows: Row[] = regions.map((r) => ({
      section: t('analytics.export.sectionRegion'),
      metric: r.name,
      period: rangeLabel,
      value: String(r.count),
      detail: t('analytics.export.detailActivePartners'),
    }))

    const collectionRows: Row[] = topCollections.map((c) => ({
      section: t('analytics.export.sectionTopCollections'),
      metric: c.name,
      period: rangeLabel,
      value: c.revenue,
      detail: t('analytics.export.detailPctOfTop', { pct: c.pct }),
    }))

    const rows: Row[] = [...kpiRows, ...revenueRows, ...productionRows, ...regionRows, ...collectionRows]

    const filename = `threados-analytics-${slugify(def.short)}.csv`
    try {
      downloadCsv(rows, filename)
      toast(t('analytics.toast.exported', { label: rangeLabel, n: rows.length, filename }), 'success')
    } catch {
      toast(t('analytics.toast.exportError'), 'info')
    }
  }

  return (
    <SuitePage
      eyebrow={t('analytics.eyebrow')}
      title={t('analytics.title')}
      subtitle={t('analytics.subtitle')}
      actions={
        <>
          <RangePicker value={range} onChange={setRange} />
          <button className="s-btn s-btn--ghost" type="button" onClick={handleExport} title={t('analytics.exportTitle')}>
            <IcoUpload width="15" height="15" /> {t('analytics.export')}
          </button>
        </>
      }
    >
      <div className="an-root">
        {/* ---- KPI row ---- */}
        <section className="an-kpis">
          {kpis.map((k) => (
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
                <h2 className="an-card__title">{t('analytics.revenue.title')}</h2>
                <div className="an-card__figure">
                  <span className="an-card__big">{fmtMoney(revenueTotal)}</span>
                  <span className={`an-delta${revenueDelta < 0 ? ' an-delta--down' : ''}`}>
                    <IcoTrend width="12" height="12" /> {revenueDelta >= 0 ? '+' : ''}
                    {revenueDelta}%
                  </span>
                </div>
                <p className="an-card__sub">{t('analytics.revenue.gmv', { caption: rangeCaption })}</p>
              </div>
              <div className="an-legend">
                <span className="an-legend__item">
                  <span className="an-legend__swatch" style={{ background: 'var(--s-accent)' }} />
                  {t('analytics.revenue.legend')}
                </span>
              </div>
            </div>
            <RevenueChart data={revenue} labels={monthLabels} />
          </article>

          <article className="an-card an-side">
            <div className="an-card__head" style={{ marginBottom: 8 }}>
              <div>
                <h2 className="an-card__title">{t('analytics.topCollections.title')}</h2>
                <p className="an-card__sub">{t('analytics.topCollections.sub', { caption: rangeCaption })}</p>
              </div>
            </div>
            {topCollections.length === 0 ? (
              <p className="an-card__sub" style={{ paddingTop: 8 }}>
                {t('analytics.topCollections.empty')}
              </p>
            ) : (
              <div>
                {topCollections.map((c) => {
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
            )}
          </article>
        </section>

        {/* ---- Bar chart + donut ---- */}
        <section className="an-lower">
          <article className="an-card">
            <div className="an-card__head">
              <div>
                <h2 className="an-card__title">
                  {range === '30d' ? t('analytics.production.byWeek') : t('analytics.production.byMonth')}
                </h2>
                <p className="an-card__sub">
                  {t('analytics.production.sub', { n: productionUnits.toLocaleString(), caption: rangeCaption })}
                </p>
              </div>
              <div className="an-legend">
                <span className="an-legend__item">
                  <span className="an-legend__swatch" style={{ background: 'var(--s-accent)' }} />
                  {range === '30d' ? t('analytics.production.peakWeek') : t('analytics.production.peakMonth')}
                </span>
              </div>
            </div>
            <ProductionBars data={production} labels={def.bars} />
          </article>

          <article className="an-card">
            <div className="an-card__head">
              <div>
                <h2 className="an-card__title">{t('analytics.region.title')}</h2>
                <p className="an-card__sub">{t('analytics.region.activePartners', { n: data.manufacturers.length })}</p>
              </div>
            </div>
            {regions.length === 0 ? (
              <p className="an-card__sub" style={{ paddingTop: 8 }}>
                {t('analytics.region.empty')}
              </p>
            ) : (
              <RegionDonut regions={regions} />
            )}
          </article>
        </section>
      </div>
    </SuitePage>
  )
}
