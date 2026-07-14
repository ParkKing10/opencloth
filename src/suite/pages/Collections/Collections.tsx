import { useMemo, useState, type SVGProps } from 'react'
import { useNavigate } from 'react-router-dom'
import { SuitePage } from '../_shared/SuitePage'
import { IcoPlus, IcoGrid, IcoDots, IcoChevron, IcoUpload } from '../../components/ui/Icons'
import { GARMENT_GLYPHS } from '../../components/ui/Garments'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { uid, relativeTime } from '../../data/utils'
import { downloadJson, slugify } from '../../lib/download'
import type { Collection, Design, GarmentKind } from '../../data/types'
import { useT } from '@/i18n'
import './col.css'

type ViewMode = 'grid' | 'list'

const SORTS = ['Last updated', 'Name (A–Z)', 'Most designs', 'Season'] as const
type Sort = (typeof SORTS)[number]

/* Season labels cycle so a fresh collection reads like a real drop, not "undefined". */
const NEW_COLLECTION_NAMES = [
  'Untitled Collection',
  'New Season Drop',
  'Working Capsule',
  'Draft Lineup',
] as const
const NEW_COLLECTION_SEASONS = ['SS26', 'FW25', 'RESORT', 'CORE'] as const

/* Cover tints keyed off the collection status so the moodboard glow stays on-brand. */
const STATUS_TINT: Record<Collection['status'], string> = {
  draft: 'rgba(209, 249, 79, 0.14)',
  active: 'rgba(209, 249, 79, 0.20)',
  published: 'rgba(62, 207, 142, 0.16)',
}
/* Sort values double as logic keys; these map each to its i18n label key. */
const SORT_KEYS: Record<Sort, string> = {
  'Last updated': 'collections.sort.lastUpdated',
  'Name (A–Z)': 'collections.sort.nameAZ',
  'Most designs': 'collections.sort.mostDesigns',
  Season: 'collections.sort.season',
}

/** A view model derived entirely from real store data. */
type CollectionCard = {
  collection: Collection
  designs: Design[]
  sampleCount: number
  mosaic: GarmentKind[]
  tint: string
}

/* --- Local trash icon (no trash glyph in the shared set) ------------------- */
function IcoTrash(p: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

/** Build a stable 2×2 mosaic from a collection's real designs, padded when sparse. */
function buildMosaic(designs: Design[]): GarmentKind[] {
  const kinds = designs.map((d) => d.kind)
  const fillers: GarmentKind[] = ['tee', 'hoodie', 'jacket', 'cap']
  const out = [...kinds]
  for (let i = 0; out.length < 4; i++) out.push(fillers[i % fillers.length])
  return out.slice(0, 4)
}

/** Cheap deterministic initials for the "team" stack, derived from the owner + name. */
function teamFor(collection: Collection): string[] {
  const source = `${collection.ownerId}${collection.name}`.replace(/[^a-z]/gi, '').toUpperCase()
  const seeds = ['MC', 'JD', 'AL', 'KP', 'RS']
  const size = 2 + (source.charCodeAt(0) % 2) // 2 or 3 members
  return seeds.slice(0, size)
}

function Mosaic({ tiles, tint }: { tiles: GarmentKind[]; tint: string }) {
  return (
    <>
      <div className="col-cover__glow" style={{ ['--col-tint' as string]: tint }} aria-hidden="true" />
      <div className="col-mosaic" aria-hidden="true">
        {tiles.map((kind, i) => {
          const Glyph = GARMENT_GLYPHS[kind]
          return (
            <span className="col-tile" key={`${kind}-${i}`}>
              <Glyph width="34" height="34" />
            </span>
          )
        })}
      </div>
    </>
  )
}

function TeamStack({ team }: { team: string[] }) {
  const shown = team.slice(0, 3)
  const extra = team.length - shown.length
  return (
    <span className="col-team">
      {shown.map((t) => (
        <span className="col-av" key={t}>
          {t}
        </span>
      ))}
      {extra > 0 ? <span className="col-av col-av--more">+{extra}</span> : null}
    </span>
  )
}

/* --- Per-card actions menu (Export / Delete) ------------------------------- */
function CardMenu({ onExport, onDelete }: { onExport: () => void; onDelete: () => void }) {
  const t = useT()
  return (
    <div className="col-menu" role="menu" onClick={(e) => e.stopPropagation()}>
      <button className="col-menu__item" type="button" role="menuitem" onClick={onExport}>
        <IcoUpload width="14" height="14" />
        {t('collections.card.export')}
      </button>
      <button className="col-menu__item col-menu__item--danger" type="button" role="menuitem" onClick={onDelete}>
        <IcoTrash width="14" height="14" />
        {t('collections.card.delete')}
      </button>
    </div>
  )
}

function CollectionCardView({
  card,
  menuOpen,
  onOpen,
  onToggleMenu,
  onExport,
  onDelete,
}: {
  card: CollectionCard
  menuOpen: boolean
  onOpen: () => void
  onToggleMenu: () => void
  onExport: () => void
  onDelete: () => void
}) {
  const t = useT()
  const { collection, designs, sampleCount, mosaic, tint } = card
  const statusMod = collection.status
  return (
    <article
      className="col-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="col-cover">
        <Mosaic tiles={mosaic} tint={tint} />
        <span className={`s-chip col-status col-status--${statusMod}`}>{t(`collections.status.${collection.status}`)}</span>
        <span className="col-season">{collection.season}</span>
      </div>

      <div className="col-body">
        <div className="col-head">
          <h3 className="col-name">{collection.name}</h3>
          <div className="col-menu-wrap">
            <button
              className="col-more"
              type="button"
              aria-label={t('collections.card.moreOptions', { name: collection.name })}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation()
                onToggleMenu()
              }}
            >
              <IcoDots width="16" height="16" />
            </button>
            {menuOpen && <CardMenu onExport={onExport} onDelete={onDelete} />}
          </div>
        </div>

        <div className="col-metrics">
          <span>{t('collections.card.designs', { n: designs.length })}</span>
          <span className="col-metrics__sep" />
          <span>{t('collections.card.samples', { n: sampleCount })}</span>
          <span className={`s-chip col-status--${statusMod} col-row-status`}>{t(`collections.status.${collection.status}`)}</span>
        </div>

        <div className="col-foot">
          <TeamStack team={teamFor(collection)} />
          <span className="col-updated">{t('collections.card.updated', { time: relativeTime(collection.updatedAt) })}</span>
        </div>
      </div>
    </article>
  )
}

export function Collections() {
  const navigate = useNavigate()
  const { data, mutate } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const t = useT()

  const [view, setView] = useState<ViewMode>('grid')
  const [sort, setSort] = useState<Sort>('Last updated')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  /* Scope to the signed-in user; fall back to all so a fresh demo never looks empty. */
  const scoped = useMemo<Collection[]>(() => {
    const owned = user ? data.collections.filter((c) => c.ownerId === user.id) : []
    return owned.length > 0 ? owned : data.collections
  }, [data.collections, user])

  /* Index designs by collection once, then derive each card's real display fields. */
  const cards = useMemo<CollectionCard[]>(() => {
    const built = scoped.map((collection) => {
      const designs = data.designs.filter((d) => d.collectionId === collection.id)
      const sampleCount = designs.filter((d) => d.status === 'in_review' || d.status === 'approved').length
      return {
        collection,
        designs,
        sampleCount,
        mosaic: buildMosaic(designs),
        tint: STATUS_TINT[collection.status],
      }
    })

    const sorted = [...built]
    switch (sort) {
      case 'Name (A–Z)':
        sorted.sort((a, b) => a.collection.name.localeCompare(b.collection.name))
        break
      case 'Most designs':
        sorted.sort((a, b) => b.designs.length - a.designs.length)
        break
      case 'Season':
        sorted.sort((a, b) => a.collection.season.localeCompare(b.collection.season))
        break
      case 'Last updated':
      default:
        sorted.sort((a, b) => b.collection.updatedAt - a.collection.updatedAt)
        break
    }
    return sorted
  }, [scoped, data.designs, sort])

  const totalDesigns = useMemo(() => cards.reduce((sum, c) => sum + c.designs.length, 0), [cards])

  const cycleSort = () => {
    setSort((current) => SORTS[(SORTS.indexOf(current) + 1) % SORTS.length])
  }

  const toggleMenu = (id: string) => {
    setOpenMenuId((current) => (current === id ? null : id))
  }

  /* --- Real: open a collection → its detail view (the designs saved inside it) --- */
  const openCollection = (id: string) => {
    setOpenMenuId(null)
    navigate(`/suite/collections/${id}`)
  }

  /* --- Real: create a collection → persist to the store -------------------- */
  const createCollection = () => {
    if (!user) {
      toast(t('collections.toast.signIn'), 'info')
      return
    }
    const seed = data.collections.length
    const newCollection: Collection = {
      id: uid('c'),
      ownerId: user.id,
      name: NEW_COLLECTION_NAMES[seed % NEW_COLLECTION_NAMES.length],
      season: NEW_COLLECTION_SEASONS[seed % NEW_COLLECTION_SEASONS.length],
      status: 'draft',
      updatedAt: Date.now(),
    }
    mutate((d) => ({ ...d, collections: [newCollection, ...d.collections] }))
    setSort('Last updated')
    toast(t('collections.toast.created', { name: newCollection.name }), 'success')
  }

  /* --- Real: export a collection + its designs as a JSON file -------------- */
  const exportCollection = (card: CollectionCard) => {
    setOpenMenuId(null)
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        collection: card.collection,
        designs: card.designs,
        summary: {
          designs: card.designs.length,
          samples: card.sampleCount,
        },
      }
      downloadJson(payload, `collection-${slugify(card.collection.name)}.json`)
      toast(t('collections.toast.exported', { name: card.collection.name }), 'success')
    } catch {
      toast(t('collections.toast.exportError'), 'info')
    }
  }

  /* --- Real: delete a collection → persist to the store -------------------- */
  const deleteCollection = (card: CollectionCard) => {
    setOpenMenuId(null)
    const { id, name } = card.collection
    mutate((d) => ({
      ...d,
      collections: d.collections.filter((c) => c.id !== id),
      // Unlink any designs that pointed at the removed collection.
      designs: d.designs.map((des) => (des.collectionId === id ? { ...des, collectionId: undefined } : des)),
    }))
    toast(t('collections.toast.deleted', { name }), 'default')
  }

  return (
    <SuitePage
      eyebrow={t('collections.page.eyebrow')}
      title={t('collections.page.title')}
      subtitle={t('collections.page.subtitle')}
      actions={
        <button className="s-btn s-btn--accent" type="button" onClick={createCollection}>
          <IcoPlus width="16" height="16" /> {t('collections.page.newCollection')}
        </button>
      }
    >
      <div className="col-toolbar">
        <div className="col-toolbar__left">
          <div className="col-seg" role="group" aria-label={t('collections.toolbar.viewMode')}>
            <button
              className={`col-seg__btn${view === 'grid' ? ' is-active' : ''}`}
              type="button"
              aria-label={t('collections.toolbar.gridView')}
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
            >
              <IcoGrid width="16" height="16" />
            </button>
            <button
              className={`col-seg__btn${view === 'list' ? ' is-active' : ''}`}
              type="button"
              aria-label={t('collections.toolbar.listView')}
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              <ListIcon />
            </button>
          </div>
          <button className="col-sort" type="button" onClick={cycleSort}>
            {t('collections.toolbar.sort')} <b>{t(SORT_KEYS[sort])}</b>
            <IcoChevron width="13" height="13" />
          </button>
        </div>
        <span className="col-count">
          <b>{cards.length}</b> {t('collections.count.collections')} · {t('collections.count.designs', { n: totalDesigns })}
        </span>
      </div>

      <div className={`col-grid${view === 'list' ? ' is-list' : ''}`}>
        <button className="col-new" type="button" onClick={createCollection}>
          <span className="col-new__ico">
            <IcoPlus width="22" height="22" />
          </span>
          <span className="col-new__text">
            <b>{t('collections.new.title')}</b>
            <small>{t('collections.new.subtitle')}</small>
          </span>
        </button>

        {cards.map((card) => (
          <CollectionCardView
            key={card.collection.id}
            card={card}
            menuOpen={openMenuId === card.collection.id}
            onOpen={() => openCollection(card.collection.id)}
            onToggleMenu={() => toggleMenu(card.collection.id)}
            onExport={() => exportCollection(card)}
            onDelete={() => deleteCollection(card)}
          />
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
