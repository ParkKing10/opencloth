import { useMemo, useState } from 'react'
import {
  IcoPlus,
  IcoSearch,
  IcoChevron,
  IcoStar,
  IcoCheck,
  IcoArrowRight,
  IcoFactory,
} from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { uid } from '../../data/utils'
import { downloadJson, slugify } from '../../lib/download'
import type { Manufacturer, Order } from '../../data/types'
import { SuitePage } from '../_shared/SuitePage'
import { useT } from '@/i18n'
import './mf.css'

/** Minimal shape of the translate function used by module-level label helpers. */
type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Units requested for a first sample run. */
const SAMPLE_QTY = 50

/* ---------- Presentation helpers ----------
   The store's Manufacturer only carries real business fields. We derive purely
   cosmetic details (accent dot, banner wash, glyph, specialty blurb) from that
   data so the premium card stays identical without duplicating a second model. */

type BannerHue = 'a' | 'b' | 'c' | 'd'

/* Country accent dots — muted tones kept within the lime/neutral discipline */
const COUNTRY_FLAGS: Record<string, string> = {
  Portugal: '#3ecf8e',
  Turkey: '#ff6ba6',
  Vietnam: '#f5b544',
  Italy: '#5aa2ff',
  China: '#dcff66',
  India: '#d1f94f',
}

const FALLBACK_FLAG = '#9b7bff'

const HUES: BannerHue[] = ['a', 'b', 'c', 'd']

/** Deterministic hash so a factory always renders with the same banner wash. */
function hueFor(id: string): BannerHue {
  let sum = 0
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i)
  return HUES[sum % HUES.length]
}

/** Map capabilities to a representative garment glyph for the banner. */
function glyphFor(caps: string[]): GarmentKind {
  if (caps.includes('Denim')) return 'pants'
  if (caps.includes('Outerwear')) return 'jacket'
  if (caps.includes('Accessories') && !caps.includes('Cut & Sew')) return 'cap'
  if (caps.includes('Knitwear')) return 'hoodie'
  return 'tee'
}

function flagFor(country: string): string {
  return COUNTRY_FLAGS[country] ?? FALLBACK_FLAG
}

/* ---------- Label helpers (map controlled vocab → translated copy) ----------
   The underlying capability / MOQ / country sentinel values stay in English so
   the filter + sort logic is unaffected; only the display label is translated. */

const CAP_KEY: Record<string, string> = {
  Knitwear: 'manufacturers.cap.knitwear',
  'Cut & Sew': 'manufacturers.cap.cutSew',
  Denim: 'manufacturers.cap.denim',
  Outerwear: 'manufacturers.cap.outerwear',
  Accessories: 'manufacturers.cap.accessories',
}

function capLabel(cap: string, t: Translate): string {
  const key = CAP_KEY[cap]
  return key ? t(key) : cap
}

/** Short human-friendly specialty line derived from capabilities. */
function specialtyFor(caps: string[], t: Translate): string {
  if (caps.length === 0) return t('manufacturers.specialty.full')
  if (caps.length === 1) return t('manufacturers.specialty.one', { cap: capLabel(caps[0], t) })
  return t('manufacturers.specialty.multi', {
    a: capLabel(caps[0], t),
    b: capLabel(caps[1], t),
    more: caps.length > 2 ? t('manufacturers.specialty.more') : '',
  })
}

const MOQ_KEY: Record<string, string> = {
  'Any MOQ': 'manufacturers.moq.any',
  'Under 50': 'manufacturers.moq.u50',
  'Under 100': 'manufacturers.moq.u100',
  'Under 200': 'manufacturers.moq.u200',
}

const SORT_KEY: Record<string, string> = {
  rating: 'manufacturers.sort.rating',
  moq: 'manufacturers.sort.moq',
  price: 'manufacturers.sort.price',
  lead: 'manufacturers.sort.lead',
}

/* ---------- Filter option definitions ---------- */

const CAPABILITIES = ['Knitwear', 'Cut & Sew', 'Denim', 'Outerwear', 'Accessories'] as const
type Capability = (typeof CAPABILITIES)[number]

const ALL_CAPS = 'All' as const
type CapFilter = typeof ALL_CAPS | Capability

const MOQ_ORDER = ['Any MOQ', 'Under 50', 'Under 100', 'Under 200'] as const
type MoqFilter = (typeof MOQ_ORDER)[number]

const MOQ_CEILINGS: Record<Exclude<MoqFilter, 'Any MOQ'>, number> = {
  'Under 50': 50,
  'Under 100': 100,
  'Under 200': 200,
}

const SORTS = [
  { id: 'rating', label: 'Top rated' },
  { id: 'moq', label: 'Lowest MOQ' },
  { id: 'price', label: 'Lowest price' },
  { id: 'lead', label: 'Fastest lead time' },
] as const
type SortId = (typeof SORTS)[number]['id']

/* ---------- Small presentational pieces ---------- */

interface HeartProps {
  filled: boolean
}

function Heart({ filled }: HeartProps) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20s-7-4.6-9.2-9C1.3 8 2.6 4.8 5.8 4.8c2 0 3.3 1.2 4.2 2.6.9-1.4 2.2-2.6 4.2-2.6 3.2 0 4.5 3.2 3 6.2C19 15.4 12 20 12 20Z" />
    </svg>
  )
}

const MAX_TAGS = 3

interface FactoryCardProps {
  factory: Manufacturer
  onToggleSave: (m: Manufacturer) => void
  onRequestSample: (m: Manufacturer) => void
}

function FactoryCard({ factory, onToggleSave, onRequestSample }: FactoryCardProps) {
  const t = useT()
  const Glyph = GARMENT_GLYPHS[glyphFor(factory.capabilities)]
  const visibleTags = factory.capabilities.slice(0, MAX_TAGS)
  const hiddenCount = factory.capabilities.length - visibleTags.length
  const saved = factory.saved

  return (
    <article className="mf-card">
      <div className={`mf-banner mf-banner--${hueFor(factory.id)}`}>
        <span className="mf-banner__glyph" aria-hidden="true">
          <Glyph width="128" height="128" />
        </span>

        <div className="mf-banner__top">
          {factory.verified ? (
            <span className="mf-verified">
              <IcoCheck width="12" height="12" /> {t('manufacturers.card.verified')}
            </span>
          ) : (
            <span className="mf-verified">{t('manufacturers.card.newPartner')}</span>
          )}
          <button
            type="button"
            className={`mf-save${saved ? ' is-saved' : ''}`}
            onClick={() => onToggleSave(factory)}
            aria-pressed={saved}
            title={saved ? t('manufacturers.card.removeSaved') : t('manufacturers.card.saveFactory')}
            aria-label={saved ? t('manufacturers.card.removeSaved') : t('manufacturers.card.saveFactory')}
          >
            <Heart filled={saved} />
          </button>
        </div>

        <span className="mf-price">
          <small>{t('manufacturers.card.from')}</small>
          <b>${factory.priceFrom}</b>
          <span>{t('manufacturers.card.perUnit')}</span>
        </span>
      </div>

      <div className="mf-body">
        <div className="mf-head">
          <div>
            <h3 className="mf-name">{factory.name}</h3>
            <span className="mf-loc">
              <span className="mf-flag" style={{ background: flagFor(factory.country) }} />
              {factory.city}, {factory.country}
            </span>
          </div>
          <span className="mf-rate">
            <IcoStar width="12" height="12" />
            <b>{factory.rating.toFixed(1)}</b>
            <small>· {factory.reviews}</small>
          </span>
        </div>

        <div className="mf-facts">
          <div className="mf-fact">
            <span className="mf-fact__k">{t('manufacturers.card.moq')}</span>
            <span className="mf-fact__v">
              {factory.moq} <span>{t('manufacturers.card.units')}</span>
            </span>
          </div>
          <div className="mf-fact">
            <span className="mf-fact__k">{t('manufacturers.card.leadTime')}</span>
            <span className="mf-fact__v">
              {factory.leadDays} <span>{t('manufacturers.card.days')}</span>
            </span>
          </div>
          <div className="mf-fact">
            <span className="mf-fact__k">{t('manufacturers.card.reviews')}</span>
            <span className="mf-fact__v">{factory.reviews}</span>
          </div>
        </div>

        <div className="mf-tags">
          {visibleTags.map((cap) => (
            <span className="mf-tag" key={cap}>
              {capLabel(cap, t)}
            </span>
          ))}
          {hiddenCount > 0 && <span className="mf-tag mf-tag--more">+{hiddenCount}</span>}
        </div>

        <div className="mf-foot">
          <span className="mf-foot__spec">
            <b>{t('manufacturers.card.specialty')}</b>
            <small>{specialtyFor(factory.capabilities, t)}</small>
          </span>
          <button
            type="button"
            className="s-btn s-btn--accent mf-sample"
            onClick={() => onRequestSample(factory)}
            title={t('manufacturers.card.requestTitle', { name: factory.name })}
          >
            {t('manufacturers.card.requestSample')} <IcoArrowRight width="14" height="14" />
          </button>
        </div>
      </div>
    </article>
  )
}

/* ---------- Page ---------- */

export function Manufacturers() {
  const { data, mutate } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const t = useT()

  const [activeCap, setActiveCap] = useState<CapFilter>(ALL_CAPS)
  const [country, setCountry] = useState<string>('Any country')
  const [moq, setMoq] = useState<MoqFilter>('Any MOQ')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortId>('rating')
  const [sortOpen, setSortOpen] = useState(false)

  /* Countries actually present in the data, so the pill never offers a dead option. */
  const countryOptions = useMemo<string[]>(() => {
    const set = new Set<string>()
    data.manufacturers.forEach((m) => set.add(m.country))
    return ['Any country', ...Array.from(set).sort()]
  }, [data.manufacturers])

  const cycleCountry = () => {
    const idx = countryOptions.indexOf(country)
    setCountry(countryOptions[(idx + 1) % countryOptions.length])
  }

  const cycleMoq = () => {
    const idx = MOQ_ORDER.indexOf(moq)
    setMoq(MOQ_ORDER[(idx + 1) % MOQ_ORDER.length])
  }

  const toggleSave = (m: Manufacturer) => {
    const nowSaved = !m.saved
    mutate((d) => ({
      ...d,
      manufacturers: d.manufacturers.map((x) => (x.id === m.id ? { ...x, saved: nowSaved } : x)),
    }))
    toast(
      nowSaved
        ? t('manufacturers.toast.saved', { name: m.name })
        : t('manufacturers.toast.removed', { name: m.name }),
      nowSaved ? 'success' : 'default',
    )
  }

  const requestSample = (m: Manufacturer) => {
    if (!user) {
      toast(t('manufacturers.toast.signInSample'), 'info')
      return
    }
    const glyph = glyphFor(m.capabilities)
    const newOrder: Order = {
      id: uid('o'),
      ownerId: user.id,
      designName: `Sample — ${m.name}`,
      kind: glyph,
      qty: SAMPLE_QTY,
      manufacturer: m.name,
      country: m.country,
      stage: 'sample',
      progress: 5,
      eta: `~${m.leadDays} days`,
    }
    mutate((d) => ({ ...d, orders: [newOrder, ...d.orders] }))
    toast(t('manufacturers.toast.sampleRequested', { name: m.name, n: SAMPLE_QTY }), 'accent')
  }

  const chooseSort = (id: SortId) => {
    setSort(id)
    setSortOpen(false)
  }

  const clearFilters = () => {
    setActiveCap(ALL_CAPS)
    setCountry('Any country')
    setMoq('Any MOQ')
    setQuery('')
  }

  const hasActiveFilter =
    activeCap !== ALL_CAPS || country !== 'Any country' || moq !== 'Any MOQ' || query.trim() !== ''

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = data.manufacturers.filter((f) => {
      if (activeCap !== ALL_CAPS && !f.capabilities.includes(activeCap)) return false
      if (country !== 'Any country' && f.country !== country) return false
      if (moq !== 'Any MOQ' && f.moq > MOQ_CEILINGS[moq]) return false
      if (q) {
        const haystack = `${f.name} ${f.city} ${f.country} ${f.capabilities.join(' ')}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    const sorted = [...filtered]
    switch (sort) {
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
        break
      case 'moq':
        sorted.sort((a, b) => a.moq - b.moq)
        break
      case 'price':
        sorted.sort((a, b) => a.priceFrom - b.priceFrom)
        break
      case 'lead':
        sorted.sort((a, b) => a.leadDays - b.leadDays)
        break
    }
    return sorted
  }, [data.manufacturers, activeCap, country, moq, query, sort])

  const savedCount = useMemo(() => data.manufacturers.filter((m) => m.saved).length, [data.manufacturers])
  const activeSortLabel = t(SORT_KEY[sort])

  /* "Post a Request" — export a real sourcing brief the user can send to factories. */
  const postRequest = () => {
    if (!user) {
      toast(t('manufacturers.toast.signInRequest'), 'info')
      return
    }
    const brief = {
      type: 'threados.sourcing-request',
      version: 1,
      createdAt: new Date().toISOString(),
      requestedBy: { id: user.id, name: user.name, email: user.email },
      criteria: {
        capability: activeCap === ALL_CAPS ? 'Any' : activeCap,
        country: country === 'Any country' ? 'Any' : country,
        moq: moq === 'Any MOQ' ? 'Any' : moq,
        search: query.trim() || null,
        sort: activeSortLabel,
      },
      matchedFactories: results.map((f) => ({
        id: f.id,
        name: f.name,
        location: `${f.city}, ${f.country}`,
        capabilities: f.capabilities,
        moq: f.moq,
        leadDays: f.leadDays,
        priceFrom: f.priceFrom,
        rating: f.rating,
      })),
    }
    try {
      const stamp = new Date().toISOString().slice(0, 10)
      downloadJson(brief, `${slugify(`sourcing request ${stamp}`)}.json`)
      toast(
        t('manufacturers.toast.briefExported', {
          n: results.length,
          factories: results.length === 1 ? t('manufacturers.factory') : t('manufacturers.factories'),
        }),
        'accent',
      )
    } catch {
      toast(t('manufacturers.toast.exportError'), 'info')
    }
  }

  return (
    <SuitePage
      eyebrow={t('manufacturers.page.eyebrow')}
      title={t('manufacturers.page.title')}
      subtitle={t('manufacturers.page.subtitle')}
      actions={
        <button type="button" className="s-btn s-btn--accent" onClick={postRequest}>
          <IcoPlus width="16" height="16" /> {t('manufacturers.actions.postRequest')}
        </button>
      }
    >
      <div className="mf-root">
        {/* Toolbar */}
        <div className="mf-toolbar">
          <div className="mf-caps">
            <button
              type="button"
              className={`mf-cap${activeCap === ALL_CAPS ? ' is-active' : ''}`}
              onClick={() => setActiveCap(ALL_CAPS)}
            >
              <IcoFactory width="14" height="14" /> {t('manufacturers.cap.all')}
            </button>
            {CAPABILITIES.map((cap) => (
              <button
                key={cap}
                type="button"
                className={`mf-cap${activeCap === cap ? ' is-active' : ''}`}
                onClick={() => setActiveCap(cap)}
              >
                {capLabel(cap, t)}
              </button>
            ))}
          </div>

          <div className="mf-toolbar__right">
            <button
              type="button"
              className="mf-select"
              onClick={cycleCountry}
              title={t('manufacturers.filter.countryTitle')}
            >
              <b>{country === 'Any country' ? t('manufacturers.filter.anyCountry') : country}</b>
              <IcoChevron className="mf-select__chev" width="14" height="14" />
            </button>
            <button
              type="button"
              className="mf-select"
              onClick={cycleMoq}
              title={t('manufacturers.filter.moqTitle')}
            >
              <b>{t(MOQ_KEY[moq])}</b>
              <IcoChevron className="mf-select__chev" width="14" height="14" />
            </button>
            <label className="mf-search">
              <IcoSearch width="15" height="15" />
              <input
                type="text"
                placeholder={t('manufacturers.search.placeholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={t('manufacturers.search.aria')}
              />
            </label>
          </div>
        </div>

        {/* Result meta */}
        <div className="mf-meta">
          <p className="mf-meta__count">
            <b>{results.length}</b>{' '}
            {results.length === 1
              ? t('manufacturers.meta.factoryAvailable')
              : t('manufacturers.meta.factoriesAvailable')}
            {activeCap !== ALL_CAPS && (
              <>
                {' · '}
                {capLabel(activeCap, t)}
              </>
            )}
            {savedCount > 0 && (
              <>
                {' · '}
                {t('manufacturers.meta.saved', { n: savedCount })}
              </>
            )}
            {hasActiveFilter && (
              <button type="button" className="mf-clear" onClick={clearFilters}>
                {t('manufacturers.meta.clearFilters')}
              </button>
            )}
          </p>

          <div className="mf-sortwrap">
            <button
              type="button"
              className="mf-sort"
              onClick={() => setSortOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
            >
              {t('manufacturers.sort.by')} <b>{activeSortLabel}</b>
              <IcoChevron width="13" height="13" />
            </button>
            {sortOpen && (
              <>
                <button
                  type="button"
                  className="mf-menu__scrim"
                  aria-label={t('manufacturers.sort.closeAria')}
                  onClick={() => setSortOpen(false)}
                />
                <ul className="mf-menu" role="listbox">
                  {SORTS.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={sort === s.id}
                        className={`mf-menu__item${sort === s.id ? ' is-active' : ''}`}
                        onClick={() => chooseSort(s.id)}
                      >
                        {t(SORT_KEY[s.id])}
                        {sort === s.id && <IcoCheck width="14" height="14" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        {/* Grid */}
        {results.length > 0 ? (
          <div className="mf-grid">
            {results.map((factory) => (
              <FactoryCard
                key={factory.id}
                factory={factory}
                onToggleSave={toggleSave}
                onRequestSample={requestSample}
              />
            ))}
          </div>
        ) : (
          <div className="page-empty">
            <div>
              <div className="page-empty__ico">
                <IcoFactory width="26" height="26" />
              </div>
              <h3>{t('manufacturers.empty.title')}</h3>
              <p>{t('manufacturers.empty.desc')}</p>
              {hasActiveFilter && (
                <button type="button" className="s-btn s-btn--subtle mf-empty-cta" onClick={clearFilters}>
                  {t('manufacturers.empty.clearAll')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </SuitePage>
  )
}
