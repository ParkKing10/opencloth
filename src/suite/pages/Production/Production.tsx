import type { SVGProps } from 'react'
import { SuitePage } from '../_shared/SuitePage'
import { IcoPlus, IcoUpload, IcoSearch, IcoBolt } from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import './pr.css'

/* ---- Small inline icons (calendar + check) not present in Icons.tsx ---- */
type SvgP = SVGProps<SVGSVGElement>
const IcoCal = (p: SvgP) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
    <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
  </svg>
)
const IcoCheckSm = (p: SvgP) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m4 12 5 5L20 6" />
  </svg>
)

/* ---- Types ---- */
type Priority = 'rush' | 'hold' | null
type Order = {
  id: string
  name: string
  kind: GarmentKind
  qty: number
  maker: string
  flag: string
  country: string
  progress: number
  eta: string
  etaState?: 'late' | 'done'
  live?: boolean
  priority?: Priority
  team: string[]
  extra?: number
}

type Stage = { key: string; title: string; color: string; orders: Order[] }

/* ---- Board data — realistic streetwear production pipeline ---- */
const BOARD: Stage[] = [
  {
    key: 'sample',
    title: 'Sample',
    color: 'var(--s-info)',
    orders: [
      {
        id: 'PO-4821',
        name: 'Boxy Fit Wool Overshirt',
        kind: 'jacket',
        qty: 60,
        maker: 'Atlas Garment Co.',
        flag: '🇵🇹',
        country: 'Portugal',
        progress: 25,
        eta: 'Proto · Jul 22',
        priority: 'rush',
        team: ['MC', 'JD'],
      },
      {
        id: 'PO-4826',
        name: 'Ribbed Knit Beanie',
        kind: 'cap',
        qty: 400,
        maker: 'Meridian Knitwear',
        flag: '🇹🇷',
        country: 'Türkiye',
        progress: 12,
        eta: 'Proto · Jul 28',
        team: ['KP'],
      },
      {
        id: 'PO-4830',
        name: 'Heavyweight Boxy Tee',
        kind: 'tee',
        qty: 750,
        maker: 'Coastline Apparel',
        flag: '🇧🇩',
        country: 'Bangladesh',
        progress: 40,
        eta: 'Proto · Jul 19',
        team: ['MC', 'AL', 'RS'],
      },
    ],
  },
  {
    key: 'production',
    title: 'Production',
    color: 'var(--s-accent)',
    orders: [
      {
        id: 'PO-4790',
        name: 'Baggy Cargo Pants',
        kind: 'pants',
        qty: 250,
        maker: 'Northgate Denim Mills',
        flag: '🇻🇳',
        country: 'Vietnam',
        progress: 68,
        eta: 'Cut & sew · Aug 04',
        live: true,
        team: ['MC', 'JD', 'AL'],
        extra: 1,
      },
      {
        id: 'PO-4772',
        name: 'Vintage Washed Hoodie',
        kind: 'hoodie',
        qty: 500,
        maker: 'Atlas Garment Co.',
        flag: '🇵🇹',
        country: 'Portugal',
        progress: 54,
        eta: 'Dyeing · Aug 09',
        priority: 'rush',
        team: ['MC', 'KP'],
      },
      {
        id: 'PO-4801',
        name: 'Oversized Street Tee',
        kind: 'tee',
        qty: 1200,
        maker: 'Coastline Apparel',
        flag: '🇧🇩',
        country: 'Bangladesh',
        progress: 82,
        eta: 'Finishing · Jul 30',
        team: ['MC', 'RS'],
      },
    ],
  },
  {
    key: 'qc',
    title: 'Quality Check',
    color: 'var(--s-warn)',
    orders: [
      {
        id: 'PO-4715',
        name: 'Cargo Pocket Jacket',
        kind: 'jacket',
        qty: 320,
        maker: 'Meridian Knitwear',
        flag: '🇹🇷',
        country: 'Türkiye',
        progress: 90,
        eta: 'AQL 2.5 · Jul 18',
        etaState: 'late',
        priority: 'hold',
        team: ['JD', 'AL'],
      },
      {
        id: 'PO-4740',
        name: 'Corduroy 6-Panel Cap',
        kind: 'cap',
        qty: 600,
        maker: 'Summit Headwear',
        flag: '🇨🇳',
        country: 'China',
        progress: 96,
        eta: 'AQL 1.5 · Jul 21',
        team: ['KP', 'RS'],
      },
    ],
  },
  {
    key: 'shipping',
    title: 'Shipping',
    color: 'var(--s-pink)',
    orders: [
      {
        id: 'PO-4688',
        name: 'Relaxed Denim Trucker',
        kind: 'jacket',
        qty: 180,
        maker: 'Northgate Denim Mills',
        flag: '🇻🇳',
        country: 'Vietnam',
        progress: 100,
        eta: 'ETA · Jul 24',
        team: ['MC', 'JD'],
      },
      {
        id: 'PO-4702',
        name: 'Essential Jersey Tee 3-Pack',
        kind: 'tee',
        qty: 2000,
        maker: 'Coastline Apparel',
        flag: '🇧🇩',
        country: 'Bangladesh',
        progress: 100,
        eta: 'ETA · Jul 27',
        team: ['MC', 'AL', 'RS'],
        extra: 2,
      },
    ],
  },
  {
    key: 'delivered',
    title: 'Delivered',
    color: 'var(--s-good)',
    orders: [
      {
        id: 'PO-4601',
        name: 'Fleece Zip Hoodie',
        kind: 'hoodie',
        qty: 750,
        maker: 'Atlas Garment Co.',
        flag: '🇵🇹',
        country: 'Portugal',
        progress: 100,
        eta: 'Received · Jul 11',
        etaState: 'done',
        team: ['MC', 'KP'],
      },
      {
        id: 'PO-4590',
        name: 'Tapered Sweatpants',
        kind: 'pants',
        qty: 900,
        maker: 'Northgate Denim Mills',
        flag: '🇻🇳',
        country: 'Vietnam',
        progress: 100,
        eta: 'Received · Jul 08',
        etaState: 'done',
        team: ['JD', 'RS'],
      },
    ],
  },
]

const TOTAL_ORDERS = BOARD.reduce((sum, s) => sum + s.orders.length, 0)
const TOTAL_UNITS = BOARD.reduce((sum, s) => sum + s.orders.reduce((a, o) => a + o.qty, 0), 0)
const AT_RISK = BOARD.reduce((sum, s) => sum + s.orders.filter((o) => o.etaState === 'late' || o.priority === 'hold').length, 0)

function avatarTone(initials: string): string {
  return initials === 'MC' ? ' pr-av--accent' : ''
}

function OrderCard({ order }: { order: Order }) {
  const Glyph = GARMENT_GLYPHS[order.kind]
  const etaCls = order.etaState === 'late' ? ' is-late' : order.etaState === 'done' ? ' is-done' : ''
  return (
    <article className={`pr-card${order.live ? ' is-live' : ''}`} tabIndex={0} aria-label={`${order.name}, ${order.progress}% complete`}>
      <div className="pr-card__top">
        <span className="pr-thumb" aria-hidden="true">
          <Glyph width="30" height="30" />
        </span>
        <div className="pr-card__id">
          <span className="pr-card__name">{order.name}</span>
          <span className="pr-card__sub">
            <span className="pr-card__code">{order.id}</span>
            {order.priority === 'rush' && <span className="pr-tag pr-tag--rush">Rush</span>}
            {order.priority === 'hold' && <span className="pr-tag pr-tag--hold">On hold</span>}
          </span>
        </div>
        <span className="pr-card__qty">×{order.qty.toLocaleString()}</span>
      </div>

      <div className="pr-card__maker">
        <span className="pr-flag" aria-hidden="true">
          {order.flag}
        </span>
        <b>{order.maker}</b>
        <span>· {order.country}</span>
      </div>

      <div className="pr-prog">
        <div className="pr-prog__meta">
          <span className="pr-prog__label">Progress</span>
          <span className="pr-prog__pct">{order.progress}%</span>
        </div>
        <div className="pr-bar">
          <span className="pr-bar__fill" style={{ width: `${order.progress}%` }} />
        </div>
      </div>

      <div className="pr-card__foot">
        {order.live ? (
          <span className="pr-live">
            <span className="pr-live__pip" aria-hidden="true" />
            Live now
          </span>
        ) : (
          <span className={`pr-eta${etaCls}`}>
            {order.etaState === 'done' ? <IcoCheckSm /> : <IcoCal />}
            {order.eta}
          </span>
        )}
        <span className="pr-avatars" aria-label="Assigned team">
          {order.team.map((t) => (
            <span className={`pr-av${avatarTone(t)}`} key={t}>
              {t}
            </span>
          ))}
          {order.extra ? <span className="pr-av pr-av--more">+{order.extra}</span> : null}
        </span>
      </div>
    </article>
  )
}

function Column({ stage }: { stage: Stage }) {
  return (
    <section className="pr-col" style={{ ['--pr-col-c' as string]: stage.color }}>
      <header className="pr-col__head">
        <span className="pr-col__dot" style={{ background: stage.color }} />
        <span className="pr-col__title">{stage.title}</span>
        <span className="pr-col__count">{stage.orders.length}</span>
        <span className="pr-col__spacer" />
        <button className="pr-col__add" type="button" aria-label={`Add order to ${stage.title}`}>
          <IcoPlus width="15" height="15" />
        </button>
      </header>
      <div className="pr-col__meter" aria-hidden="true" />
      <div className="pr-col__body">
        {stage.orders.length === 0 ? (
          <div className="pr-col__empty">No orders</div>
        ) : (
          stage.orders.map((o) => <OrderCard key={o.id} order={o} />)
        )}
      </div>
    </section>
  )
}

export function Production() {
  return (
    <SuitePage
      wide
      eyebrow="Operations"
      title="Production board"
      subtitle="Every order from sample to delivered, tracked live across your factory network."
      actions={
        <>
          <button className="s-btn s-btn--subtle" type="button">
            <IcoUpload width="16" height="16" /> Export
          </button>
          <button className="s-btn s-btn--accent" type="button">
            <IcoPlus width="16" height="16" /> New order
          </button>
        </>
      }
    >
      <div className="pr-toolbar">
        <div className="pr-summary">
          <span className="pr-stat">
            <span className="pr-stat__val">{TOTAL_ORDERS}</span>
            <span className="pr-stat__lbl">active orders</span>
          </span>
          <span className="pr-stat pr-stat--accent">
            <span className="pr-stat__val">{TOTAL_UNITS.toLocaleString()}</span>
            <span className="pr-stat__lbl">units in flight</span>
          </span>
          <span className="pr-stat">
            <span className="pr-stat__val">{AT_RISK}</span>
            <span className="pr-stat__lbl">need attention</span>
          </span>
        </div>
        <div className="pr-toolbar__right">
          <label className="pr-search">
            <IcoSearch width="15" height="15" />
            <input type="text" placeholder="Search orders, factories…" aria-label="Search orders" />
            <kbd>⌘K</kbd>
          </label>
          <button className="s-btn s-btn--ghost" type="button">
            <IcoBolt width="15" height="15" /> Automate
          </button>
        </div>
      </div>

      <div className="pr-board-wrap">
        <div className="pr-board" role="list" aria-label="Production pipeline">
          {BOARD.map((stage) => (
            <Column key={stage.key} stage={stage} />
          ))}
        </div>
      </div>
    </SuitePage>
  )
}
