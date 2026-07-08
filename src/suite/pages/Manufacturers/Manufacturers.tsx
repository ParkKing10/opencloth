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
import type { Manufacturer, Order } from '../../data/types'
import { SuitePage } from '../_shared/SuitePage'
import './mf.css'

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

/** Short human-friendly specialty line derived from capabilities. */
function specialtyFor(caps: string[]): string {
  if (caps.length === 0) return 'Full-package apparel production'
  if (caps.length === 1) return `${caps[0]} specialist`
  return `${caps[0]} · ${caps[1]}${caps.length > 2 ? ' +more' : ''}`
}

function flagFor(country: string): string {
  return COUNTRY_FLAGS[country] ?? FALLBACK_FLAG
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
              <IcoCheck width="12" height="12" /> Verified
            </span>
          ) : (
            <span className="mf-verified">New partner</span>
          )}
          <button
            type="button"
            className={`mf-save${saved ? ' is-saved' : ''}`}
            onClick={() => onToggleSave(factory)}
            aria-pressed={saved}
            title={saved ? 'Remove from saved' : 'Save factory'}
            aria-label={saved ? 'Remove from saved' : 'Save factory'}
          >
            <Heart filled={saved} />
          </button>
        </div>

        <span className="mf-price">
          <small>from</small>
          <b>${factory.priceFrom}</b>
          <span>/unit</span>
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
            <span className="mf-fact__k">MOQ</span>
            <span className="mf-fact__v">
              {factory.moq} <span>units</span>
            </span>
          </div>
          <div className="mf-fact">
            <span className="mf-fact__k">Lead time</span>
            <span className="mf-fact__v">
              {factory.leadDays} <span>days</span>
            </span>
          </div>
          <div className="mf-fact">
            <span className="mf-fact__k">Reviews</span>
            <span className="mf-fact__v">{factory.reviews}</span>
          </div>
        </div>

        <div className="mf-tags">
          {visibleTags.map((cap) => (
            <span className="mf-tag" key={cap}>
              {cap}
            </span>
          ))}
          {hiddenCount > 0 && <span className="mf-tag mf-tag--more">+{hiddenCount}</span>}
        </div>

        <div className="mf-foot">
          <span className="mf-foot__spec">
            <b>Specialty</b>
            <small>{specialtyFor(factory.capabilities)}</small>
          </span>
          <button
            type="button"
            className="s-btn s-btn--accent mf-sample"
            onClick={() => onRequestSample(factory)}
            title={`Request a sample from ${factory.name}`}
          >
            Request Sample <IcoArrowRight width="14" height="14" />
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
    toast(nowSaved ? `Saved ${m.name}` : `Removed ${m.name} from saved`, nowSaved ? 'success' : 'default')
  }

  const requestSample = (m: Manufacturer) => {
    if (!user) {
      toast('Sign in to request a sample.', 'info')
      return
    }
    const glyph = glyphFor(m.capabilities)
    const newOrder: Order = {
      id: uid('o'),
      ownerId: user.id,
      designName: `Sample — ${m.name}`,
      kind: glyph,
      qty: 1,
      manufacturer: m.name,
      country: m.country,
      stage: 'sample',
      progress: 5,
      eta: `~${m.leadDays} days`,
    }
    mutate((d) => ({ ...d, orders: [newOrder, ...d.orders] }))
    toast(`Sample requested from ${m.name}`, 'accent')
  }

  const postRequest = () => {
    toast('Request posted — matched factories will reach out shortly.', 'accent')
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
  const activeSortLabel = SORTS.find((s) => s.id === sort)?.label ?? 'Top rated'

  return (
    <SuitePage
      eyebrow="Manufacturer Hub"
      title="Manufacturers"
      subtitle="Discover vetted factories across the globe — filter by capability, country, MOQ and lead time, then request a sample in one tap."
      actions={
        <button type="button" className="s-btn s-btn--accent" onClick={postRequest}>
          <IcoPlus width="16" height="16" /> Post a Request
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
              <IcoFactory width="14" height="14" /> All
            </button>
            {CAPABILITIES.map((cap) => (
              <button
                key={cap}
                type="button"
                className={`mf-cap${activeCap === cap ? ' is-active' : ''}`}
                onClick={() => setActiveCap(cap)}
              >
                {cap}
              </button>
            ))}
          </div>

          <div className="mf-toolbar__right">
            <button
              type="button"
              className="mf-select"
              onClick={cycleCountry}
              title="Cycle country filter"
            >
              <b>{country}</b>
              <IcoChevron className="mf-select__chev" width="14" height="14" />
            </button>
            <button type="button" className="mf-select" onClick={cycleMoq} title="Cycle MOQ ceiling">
              <b>{moq}</b>
              <IcoChevron className="mf-select__chev" width="14" height="14" />
            </button>
            <label className="mf-search">
              <IcoSearch width="15" height="15" />
              <input
                type="text"
                placeholder="Search factories, cities…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search factories"
              />
            </label>
          </div>
        </div>

        {/* Result meta */}
        <div className="mf-meta">
          <p className="mf-meta__count">
            <b>{results.length}</b> {results.length === 1 ? 'factory' : 'factories'} available
            {activeCap !== ALL_CAPS && (
              <>
                {' · '}
                {activeCap}
              </>
            )}
            {savedCount > 0 && (
              <>
                {' · '}
                {savedCount} saved
              </>
            )}
            {hasActiveFilter && (
              <button type="button" className="mf-clear" onClick={clearFilters}>
                Clear filters
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
              Sort by <b>{activeSortLabel}</b>
              <IcoChevron width="13" height="13" />
            </button>
            {sortOpen && (
              <>
                <button
                  type="button"
                  className="mf-menu__scrim"
                  aria-label="Close sort menu"
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
                        {s.label}
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
              <h3>No factories match those filters</h3>
              <p>Try widening the country or MOQ range, or clear your search.</p>
              {hasActiveFilter && (
                <button type="button" className="s-btn s-btn--subtle mf-empty-cta" onClick={clearFilters}>
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </SuitePage>
  )
}
