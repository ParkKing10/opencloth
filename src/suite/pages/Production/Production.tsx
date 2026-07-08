import { useMemo, useState, type FormEvent, type SVGProps } from 'react'
import { SuitePage } from '../_shared/SuitePage'
import { IcoPlus, IcoUpload, IcoSearch, IcoBolt, IcoArrowRight, IcoCheck } from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { uid } from '../../data/utils'
import type { Order, OrderStage } from '../../data/types'
import './pr.css'

/* ---- Small inline icons not present in Icons.tsx ---- */
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
const IcoClose = (p: SvgP) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

/* ---- Stage pipeline: fixed order, delivered is terminal ---- */
const STAGES: readonly OrderStage[] = ['sample', 'production', 'qc', 'shipping', 'delivered'] as const

const STAGE_META: Record<OrderStage, { title: string; color: string; verb: string }> = {
  sample: { title: 'Sample', color: 'var(--s-info)', verb: 'Start production' },
  production: { title: 'Production', color: 'var(--s-accent)', verb: 'Send to QC' },
  qc: { title: 'Quality Check', color: 'var(--s-warn)', verb: 'Approve & ship' },
  shipping: { title: 'Shipping', color: 'var(--s-pink)', verb: 'Mark delivered' },
  delivered: { title: 'Delivered', color: 'var(--s-good)', verb: '' },
}

/** Progress floor for each stage — advancing lifts a lagging order to at least this. */
const STAGE_FLOOR: Record<OrderStage, number> = {
  sample: 10,
  production: 45,
  qc: 80,
  shipping: 95,
  delivered: 100,
}

const KIND_LABEL: Record<GarmentKind, string> = {
  hoodie: 'Hoodie',
  tee: 'Tee',
  jacket: 'Jacket',
  pants: 'Pants',
  cap: 'Cap',
}

const KINDS: readonly GarmentKind[] = ['hoodie', 'tee', 'jacket', 'pants', 'cap'] as const

/** Rough flag per country so the maker row keeps its premium touch. */
const COUNTRY_FLAG: Record<string, string> = {
  Portugal: '🇵🇹',
  Vietnam: '🇻🇳',
  Italy: '🇮🇹',
  China: '🇨🇳',
  Turkey: '🇹🇷',
  Türkiye: '🇹🇷',
  Bangladesh: '🇧🇩',
  India: '🇮🇳',
}

function nextStage(stage: OrderStage): OrderStage | null {
  const i = STAGES.indexOf(stage)
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null
}

/** Non-delivered order sitting below its stage floor = behind schedule. */
function needsAttention(o: Order): boolean {
  return o.stage !== 'delivered' && o.progress < STAGE_FLOOR[o.stage]
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0] ?? '').join('').toUpperCase() || 'U'
}

/* ============================================================ */

export function Production() {
  const { data, mutate } = useStore()
  const { user } = useAuth()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [autoFlow, setAutoFlow] = useState(false)
  const [composerStage, setComposerStage] = useState<OrderStage | null>(null)

  /* Orders owned by the signed-in creator (real, scoped, live from store). */
  const myOrders = useMemo(
    () => (user ? data.orders.filter((o) => o.ownerId === user.id) : []),
    [data.orders, user],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return myOrders
    return myOrders.filter(
      (o) =>
        o.designName.toLowerCase().includes(q) ||
        o.manufacturer.toLowerCase().includes(q) ||
        o.country.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q),
    )
  }, [myOrders, query])

  /* Header stats recompute from the (unfiltered) owned set. */
  const activeOrders = myOrders.filter((o) => o.stage !== 'delivered').length
  const unitsInFlight = myOrders.reduce((sum, o) => (o.stage === 'delivered' ? sum : sum + o.qty), 0)
  const atRisk = myOrders.filter(needsAttention).length

  /* Group the visible orders by stage. */
  const byStage = useMemo(() => {
    const map: Record<OrderStage, Order[]> = { sample: [], production: [], qc: [], shipping: [], delivered: [] }
    for (const o of filtered) map[o.stage].push(o)
    return map
  }, [filtered])

  /* ---- Mutations ---- */

  function advanceOrder(order: Order) {
    const target = nextStage(order.stage)
    if (!target) return
    const bumped = Math.max(order.progress, STAGE_FLOOR[target])
    const eta = target === 'delivered' ? 'Delivered' : order.eta
    mutate((d) => ({
      ...d,
      orders: d.orders.map((o) => (o.id === order.id ? { ...o, stage: target, progress: bumped, eta } : o)),
    }))
    const tone = target === 'delivered' ? 'success' : 'accent'
    toast(`${order.designName} → ${STAGE_META[target].title}`, tone)
  }

  function createOrder(input: { designName: string; kind: GarmentKind; qty: number; manufacturer: string; country: string; stage: OrderStage }) {
    if (!user) return
    const order: Order = {
      id: uid('o'),
      ownerId: user.id,
      designName: input.designName,
      kind: input.kind,
      qty: input.qty,
      manufacturer: input.manufacturer,
      country: input.country,
      stage: input.stage,
      progress: STAGE_FLOOR[input.stage],
      eta: input.stage === 'delivered' ? 'Delivered' : 'TBC',
    }
    mutate((d) => ({ ...d, orders: [order, ...d.orders] }))
    toast(`Order created — ${order.designName} in ${STAGE_META[input.stage].title}`, 'success')
    setComposerStage(null)
  }

  function toggleAuto() {
    const next = !autoFlow
    setAutoFlow(next)
    toast(next ? 'Auto-flow on — orders advance as milestones clear.' : 'Auto-flow paused — advance orders manually.', next ? 'accent' : 'default')
  }

  function exportCsv() {
    if (myOrders.length === 0) {
      toast('Nothing to export yet — create your first order.', 'info')
      return
    }
    const header = ['Order', 'Design', 'Garment', 'Qty', 'Manufacturer', 'Country', 'Stage', 'Progress', 'ETA']
    const rows = myOrders.map((o) => [o.id, o.designName, KIND_LABEL[o.kind], String(o.qty), o.manufacturer, o.country, STAGE_META[o.stage].title, `${o.progress}%`, o.eta])
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `threados-production-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast(`Exported ${myOrders.length} orders to CSV.`, 'success')
  }

  const isSearching = query.trim().length > 0
  const teamInitials = user ? initials(user.name) : 'U'

  return (
    <SuitePage
      wide
      eyebrow="Operations"
      title="Production board"
      subtitle="Every order from sample to delivered, tracked live across your factory network."
      actions={
        <>
          <button className="s-btn s-btn--subtle" type="button" onClick={exportCsv} title="Download your orders as a CSV file">
            <IcoUpload width="16" height="16" /> Export
          </button>
          <button className="s-btn s-btn--accent" type="button" onClick={() => setComposerStage('sample')}>
            <IcoPlus width="16" height="16" /> New order
          </button>
        </>
      }
    >
      <div className="pr-toolbar">
        <div className="pr-summary">
          <span className="pr-stat">
            <span className="pr-stat__val">{activeOrders}</span>
            <span className="pr-stat__lbl">active orders</span>
          </span>
          <span className="pr-stat pr-stat--accent">
            <span className="pr-stat__val">{unitsInFlight.toLocaleString()}</span>
            <span className="pr-stat__lbl">units in flight</span>
          </span>
          <span className="pr-stat">
            <span className="pr-stat__val">{atRisk}</span>
            <span className="pr-stat__lbl">need attention</span>
          </span>
        </div>
        <div className="pr-toolbar__right">
          <label className="pr-search">
            <IcoSearch width="15" height="15" />
            <input
              type="text"
              placeholder="Search orders, factories…"
              aria-label="Search orders"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {isSearching ? (
              <button className="pr-search__clear" type="button" aria-label="Clear search" onClick={() => setQuery('')}>
                <IcoClose width="13" height="13" />
              </button>
            ) : (
              <kbd>{filtered.length}</kbd>
            )}
          </label>
          <button
            className={`s-btn s-btn--ghost${autoFlow ? ' is-on' : ''}`}
            type="button"
            aria-pressed={autoFlow}
            onClick={toggleAuto}
            title="Toggle auto-flow — a hint for advancing orders as milestones clear"
          >
            <IcoBolt width="15" height="15" /> {autoFlow ? 'Auto-flow on' : 'Automate'}
          </button>
        </div>
      </div>

      {myOrders.length === 0 ? (
        <EmptyBoard onCreate={() => setComposerStage('sample')} />
      ) : (
        <div className="pr-board-wrap">
          <div className="pr-board" role="list" aria-label="Production pipeline">
            {STAGES.map((stage) => (
              <Column
                key={stage}
                stage={stage}
                orders={byStage[stage]}
                teamInitials={teamInitials}
                isSearching={isSearching}
                onAdd={() => setComposerStage(stage)}
                onAdvance={advanceOrder}
              />
            ))}
          </div>
        </div>
      )}

      {composerStage && (
        <OrderComposer
          stage={composerStage}
          manufacturers={data.manufacturers.map((m) => ({ name: m.name, country: m.country }))}
          onClose={() => setComposerStage(null)}
          onCreate={createOrder}
        />
      )}
    </SuitePage>
  )
}

/* ============================================================ */

type ColumnProps = {
  stage: OrderStage
  orders: Order[]
  teamInitials: string
  isSearching: boolean
  onAdd: () => void
  onAdvance: (order: Order) => void
}

function Column({ stage, orders, teamInitials, isSearching, onAdd, onAdvance }: ColumnProps) {
  const meta = STAGE_META[stage]
  return (
    <section className="pr-col" style={{ ['--pr-col-c' as string]: meta.color }} role="listitem">
      <header className="pr-col__head">
        <span className="pr-col__dot" style={{ background: meta.color }} />
        <span className="pr-col__title">{meta.title}</span>
        <span className="pr-col__count">{orders.length}</span>
        <span className="pr-col__spacer" />
        <button className="pr-col__add" type="button" aria-label={`Add order to ${meta.title}`} title={`Add order to ${meta.title}`} onClick={onAdd}>
          <IcoPlus width="15" height="15" />
        </button>
      </header>
      <div className="pr-col__meter" aria-hidden="true" />
      <div className="pr-col__body">
        {orders.length === 0 ? (
          <div className="pr-col__empty">{isSearching ? 'No matches' : 'No orders'}</div>
        ) : (
          orders.map((o) => <OrderCard key={o.id} order={o} teamInitials={teamInitials} onAdvance={() => onAdvance(o)} />)
        )}
      </div>
    </section>
  )
}

/* ============================================================ */

type CardProps = { order: Order; teamInitials: string; onAdvance: () => void }

function OrderCard({ order, teamInitials, onAdvance }: CardProps) {
  const Glyph = GARMENT_GLYPHS[order.kind]
  const target = nextStage(order.stage)
  const delivered = order.stage === 'delivered'
  const behind = needsAttention(order)
  const live = order.stage === 'production'
  const flag = COUNTRY_FLAG[order.country] ?? '🏭'

  return (
    <article className={`pr-card${live ? ' is-live' : ''}`} tabIndex={0} aria-label={`${order.designName}, ${order.progress}% complete, ${STAGE_META[order.stage].title}`}>
      <div className="pr-card__top">
        <span className="pr-thumb" aria-hidden="true">
          <Glyph width="30" height="30" />
        </span>
        <div className="pr-card__id">
          <span className="pr-card__name">{order.designName}</span>
          <span className="pr-card__sub">
            <span className="pr-card__code">{order.id.slice(0, 8).toUpperCase()}</span>
            {behind && <span className="pr-tag pr-tag--hold">Behind</span>}
          </span>
        </div>
        <span className="pr-card__qty">×{order.qty.toLocaleString()}</span>
      </div>

      <div className="pr-card__maker">
        <span className="pr-flag" aria-hidden="true">
          {flag}
        </span>
        <b>{order.manufacturer}</b>
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
        {live ? (
          <span className="pr-live">
            <span className="pr-live__pip" aria-hidden="true" />
            Live now
          </span>
        ) : (
          <span className={`pr-eta${delivered ? ' is-done' : behind ? ' is-late' : ''}`}>
            {delivered ? <IcoCheckSm /> : <IcoCal />}
            {order.eta}
          </span>
        )}
        <span className="pr-avatars" aria-label="Assigned to you">
          <span className="pr-av pr-av--accent">{teamInitials}</span>
        </span>
      </div>

      {delivered ? (
        <span className="pr-done" aria-label="Order complete">
          <IcoCheck width="13" height="13" /> Order complete
        </span>
      ) : (
        <button className="pr-advance" type="button" onClick={onAdvance} title={target ? STAGE_META[order.stage].verb : undefined}>
          {STAGE_META[order.stage].verb}
          <IcoArrowRight width="14" height="14" />
        </button>
      )}
    </article>
  )
}

/* ============================================================ */

function EmptyBoard({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="pr-empty">
      <span className="pr-empty__ico" aria-hidden="true">
        <IcoBolt width="26" height="26" />
      </span>
      <h2 className="pr-empty__title">No orders in production yet</h2>
      <p className="pr-empty__sub">
        Kick off your first purchase order and track it from sample through to delivered — right here on the board.
      </p>
      <button className="s-btn s-btn--accent" type="button" onClick={onCreate}>
        <IcoPlus width="16" height="16" /> Create your first order
      </button>
    </div>
  )
}

/* ============================================================ */

type ComposerProps = {
  stage: OrderStage
  manufacturers: { name: string; country: string }[]
  onClose: () => void
  onCreate: (input: { designName: string; kind: GarmentKind; qty: number; manufacturer: string; country: string; stage: OrderStage }) => void
}

function OrderComposer({ stage, manufacturers, onClose, onCreate }: ComposerProps) {
  const first = manufacturers[0]
  const [designName, setDesignName] = useState('')
  const [kind, setKind] = useState<GarmentKind>('hoodie')
  const [qty, setQty] = useState('250')
  const [makerName, setMakerName] = useState(first?.name ?? '')
  const [error, setError] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const name = designName.trim()
    const quantity = Number.parseInt(qty, 10)
    if (name.length < 2) {
      setError('Give the order a design name.')
      return
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      setError('Enter a quantity of at least 1.')
      return
    }
    const maker = manufacturers.find((m) => m.name === makerName) ?? first
    onCreate({
      designName: name,
      kind,
      qty: quantity,
      manufacturer: maker?.name ?? 'Unassigned',
      country: maker?.country ?? '—',
      stage,
    })
  }

  return (
    <div className="pr-scrim" role="dialog" aria-modal="true" aria-labelledby="pr-composer-title" onClick={onClose}>
      <form className="pr-composer" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="pr-composer__head">
          <div>
            <p className="pr-composer__eyebrow">New order · {STAGE_META[stage].title}</p>
            <h3 className="pr-composer__title" id="pr-composer-title">
              Add to the board
            </h3>
          </div>
          <button className="pr-composer__close" type="button" aria-label="Close" onClick={onClose}>
            <IcoClose />
          </button>
        </header>

        <label className="pr-field">
          <span className="pr-field__label">Design name</span>
          <input
            className="pr-input"
            type="text"
            value={designName}
            autoFocus
            placeholder="e.g. Vintage Washed Hoodie"
            onChange={(e) => {
              setDesignName(e.target.value)
              if (error) setError('')
            }}
          />
        </label>

        <div className="pr-field-row">
          <label className="pr-field">
            <span className="pr-field__label">Garment</span>
            <select className="pr-input" value={kind} onChange={(e) => setKind(e.target.value as GarmentKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="pr-field pr-field--qty">
            <span className="pr-field__label">Quantity</span>
            <input
              className="pr-input"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => {
                setQty(e.target.value)
                if (error) setError('')
              }}
            />
          </label>
        </div>

        <label className="pr-field">
          <span className="pr-field__label">Manufacturer</span>
          <select className="pr-input" value={makerName} onChange={(e) => setMakerName(e.target.value)}>
            {manufacturers.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} · {m.country}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="pr-composer__error" role="alert">
            {error}
          </p>
        )}

        <div className="pr-composer__foot">
          <button className="s-btn s-btn--subtle" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="s-btn s-btn--accent" type="submit">
            <IcoPlus width="16" height="16" /> Create order
          </button>
        </div>
      </form>
    </div>
  )
}
