import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SuitePage } from '../_shared/SuitePage'
import { IcoPlus, IcoGrid, IcoDots, IcoChevron } from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import './col.css'

type Status = 'Draft' | 'Active' | 'Published'
type ViewMode = 'grid' | 'list'

type Collection = {
  id: string
  name: string
  season: string
  designs: number
  samples: number
  status: Status
  updated: string
  tint: string
  team: string[]
  extra?: number
  mosaic: [GarmentKind, GarmentKind, GarmentKind, GarmentKind]
}

const COLLECTIONS: Collection[] = [
  {
    id: 'ss26-concrete',
    name: 'SS26 — Concrete Series',
    season: 'Spring / Summer 26',
    designs: 18,
    samples: 6,
    status: 'Active',
    updated: '2h ago',
    tint: 'rgba(124, 92, 255, 0.20)',
    team: ['MC', 'JD', 'AL'],
    extra: 2,
    mosaic: ['hoodie', 'tee', 'jacket', 'pants'],
  },
  {
    id: 'fw25-nightshift',
    name: 'FW25 — Night Shift',
    season: 'Fall / Winter 25',
    designs: 24,
    samples: 11,
    status: 'Published',
    updated: '1d ago',
    tint: 'rgba(62, 207, 142, 0.16)',
    team: ['MC', 'KP', 'RS'],
    mosaic: ['jacket', 'hoodie', 'pants', 'cap'],
  },
  {
    id: 'capsule-monochrome',
    name: 'Monochrome Capsule',
    season: 'All Season',
    designs: 9,
    samples: 3,
    status: 'Draft',
    updated: '3d ago',
    tint: 'rgba(124, 92, 255, 0.14)',
    team: ['MC', 'JD'],
    mosaic: ['tee', 'tee', 'hoodie', 'cap'],
  },
  {
    id: 'resort26-coastline',
    name: 'Resort 26 — Coastline',
    season: 'Resort 26',
    designs: 15,
    samples: 5,
    status: 'Active',
    updated: '4d ago',
    tint: 'rgba(90, 162, 255, 0.16)',
    team: ['KP', 'AL', 'RS'],
    extra: 1,
    mosaic: ['tee', 'pants', 'cap', 'jacket'],
  },
  {
    id: 'drop-utility',
    name: 'Utility Drop 03',
    season: 'Limited Drop',
    designs: 12,
    samples: 8,
    status: 'Published',
    updated: '6d ago',
    tint: 'rgba(255, 107, 166, 0.14)',
    team: ['MC', 'DL'],
    mosaic: ['jacket', 'pants', 'jacket', 'cap'],
  },
  {
    id: 'ss26-atelier',
    name: 'SS26 — Atelier Basics',
    season: 'Spring / Summer 26',
    designs: 21,
    samples: 4,
    status: 'Draft',
    updated: '1w ago',
    tint: 'rgba(124, 92, 255, 0.16)',
    team: ['JD', 'AL'],
    mosaic: ['tee', 'hoodie', 'tee', 'pants'],
  },
  {
    id: 'archive-heritage',
    name: 'Heritage Archive',
    season: 'Archive',
    designs: 34,
    samples: 0,
    status: 'Published',
    updated: '2w ago',
    tint: 'rgba(245, 181, 68, 0.14)',
    team: ['MC', 'KP', 'RS', 'AL'],
    extra: 3,
    mosaic: ['jacket', 'hoodie', 'pants', 'cap'],
  },
  {
    id: 'collab-riso',
    name: 'RISO × Studio Collab',
    season: 'Collaboration',
    designs: 7,
    samples: 2,
    status: 'Active',
    updated: '2w ago',
    tint: 'rgba(124, 92, 255, 0.18)',
    team: ['MC', 'DL', 'JD'],
    mosaic: ['hoodie', 'cap', 'tee', 'jacket'],
  },
]

const SORTS = ['Last updated', 'Name (A–Z)', 'Most designs', 'Season'] as const
type Sort = (typeof SORTS)[number]

function statusModifier(status: Status): string {
  return status === 'Draft' ? 'draft' : status === 'Active' ? 'active' : 'published'
}

function Mosaic({ tiles, tint }: { tiles: Collection['mosaic']; tint: string }) {
  return (
    <>
      <div className="col-cover__glow" style={{ ['--col-tint' as string]: tint }} aria-hidden="true" />
      <div className="col-mosaic" aria-hidden="true">
        {tiles.map((kind, i) => {
          const Glyph = GARMENT_GLYPHS[kind]
          return (
            <span className="col-tile" key={i}>
              <Glyph width="34" height="34" />
            </span>
          )
        })}
      </div>
    </>
  )
}

function TeamStack({ team, extra }: { team: string[]; extra?: number }) {
  return (
    <span className="col-team">
      {team.slice(0, 3).map((t) => (
        <span className="col-av" key={t}>
          {t}
        </span>
      ))}
      {extra ? <span className="col-av col-av--more">+{extra}</span> : null}
    </span>
  )
}

export function Collections() {
  const navigate = useNavigate()
  const [view, setView] = useState<ViewMode>('grid')
  const [sort, setSort] = useState<Sort>('Last updated')

  const cycleSort = () => {
    const next = SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length]
    setSort(next)
  }

  const openCollection = (id: string) => navigate(`/suite/collections/${id}`)

  return (
    <SuitePage
      eyebrow="Workspace"
      title="Collections"
      subtitle="Organise your drops and seasons — every design grouped like a moodboard."
      actions={
        <button className="s-btn s-btn--accent" type="button" onClick={() => navigate('/suite/design')}>
          <IcoPlus width="16" height="16" /> New Collection
        </button>
      }
    >
      <div className="col-toolbar">
        <div className="col-toolbar__left">
          <div className="col-seg" role="group" aria-label="View mode">
            <button
              className={`col-seg__btn${view === 'grid' ? ' is-active' : ''}`}
              type="button"
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
            >
              <IcoGrid width="16" height="16" />
            </button>
            <button
              className={`col-seg__btn${view === 'list' ? ' is-active' : ''}`}
              type="button"
              aria-label="List view"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <ListIcon />
            </button>
          </div>
          <button className="col-sort" type="button" onClick={cycleSort}>
            Sort: <b>{sort}</b>
            <IcoChevron width="13" height="13" />
          </button>
        </div>
        <span className="col-count">
          <b>{COLLECTIONS.length}</b> collections · 140 designs
        </span>
      </div>

      <div className={`col-grid${view === 'list' ? ' is-list' : ''}`}>
        <button className="col-new" type="button" onClick={() => navigate('/suite/design')}>
          <span className="col-new__ico">
            <IcoPlus width="22" height="22" />
          </span>
          <span className="col-new__text">
            <b>Create new collection</b>
            <small>Group designs into a drop</small>
          </span>
        </button>

        {COLLECTIONS.map((c) => (
          <article
            className="col-card"
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => openCollection(c.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openCollection(c.id)
              }
            }}
          >
            <div className="col-cover">
              <Mosaic tiles={c.mosaic} tint={c.tint} />
              <span className={`s-chip col-status col-status--${statusModifier(c.status)}`}>{c.status}</span>
              <span className="col-season">{c.season}</span>
            </div>

            <div className="col-body">
              <div className="col-head">
                <h3 className="col-name">{c.name}</h3>
                <button
                  className="col-more"
                  type="button"
                  aria-label={`More options for ${c.name}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <IcoDots width="16" height="16" />
                </button>
              </div>

              <div className="col-metrics">
                <span>{c.designs} designs</span>
                <span className="col-metrics__sep" />
                <span>{c.samples} samples</span>
                <span className={`s-chip col-status--${statusModifier(c.status)} col-row-status`}>{c.status}</span>
              </div>

              <div className="col-foot">
                <TeamStack team={c.team} extra={c.extra} />
                <span className="col-updated">Updated {c.updated}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </SuitePage>
  )
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  )
}
