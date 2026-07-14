import { useT } from '@/i18n'

/**
 * Minimal area chart rendered as inline SVG — no dependency, crisp at any size.
 * Two smoothed series over a shared x-axis.
 */
const DATA = [12, 18, 15, 22, 26, 21, 30, 34, 28, 38, 42, 39, 47, 52, 49, 58]
const LABELS = ['May 18', 'May 22', 'May 26', 'May 30', 'Jun 3', 'Jun 7', 'Jun 11', 'Jun 17']

const W = 720
const H = 220
const PAD = { top: 18, right: 8, bottom: 26, left: 8 }

function buildPath(data: number[]) {
  const max = Math.max(...data) * 1.12
  const min = 0
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const step = innerW / (data.length - 1)

  const pts = data.map((v, i) => ({
    x: PAD.left + i * step,
    y: PAD.top + innerH - ((v - min) / (max - min)) * innerH,
  }))

  // Catmull-Rom -> cubic bezier for a smooth line
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  const area = `${d} L ${pts[pts.length - 1].x} ${H - PAD.bottom} L ${pts[0].x} ${H - PAD.bottom} Z`
  return { line: d, area, pts }
}

export function ProgressChart() {
  const t = useT()
  const { line, area, pts } = buildPath(DATA)
  const last = pts[pts.length - 1]

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart__svg" preserveAspectRatio="none" role="img" aria-label={t('dashboard.chart.ariaLabel')}>
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--s-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--s-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + (H - PAD.top - PAD.bottom) * f}
            y2={PAD.top + (H - PAD.top - PAD.bottom) * f}
            stroke="var(--s-line)"
            strokeWidth="1"
          />
        ))}

        <path d={area} fill="url(#chartFill)" />
        <path d={line} fill="none" stroke="var(--s-accent)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={last.x} cy={last.y} r="4.5" fill="var(--s-accent)" stroke="var(--s-bg)" strokeWidth="2.5" />
      </svg>
      <div className="chart__labels">
        {LABELS.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  )
}
