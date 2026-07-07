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
import { SuitePage } from '../_shared/SuitePage'
import './mf.css'

/* ---------- Domain model ---------- */

type Capability = 'Knitwear' | 'Cut & Sew' | 'Denim' | 'Outerwear' | 'Accessories'

type BannerHue = 'a' | 'b' | 'c' | 'd'

interface Factory {
  id: string
  name: string
  country: string
  city: string
  flag: string
  caps: Capability[]
  rating: number
  reviews: number
  moq: number
  leadDays: number
  priceFrom: number
  specialty: string
  glyph: GarmentKind
  hue: BannerHue
  verified: boolean
}

/* Country accent dots — muted tones kept within the violet/neutral discipline */
const COUNTRY_FLAGS: Record<string, string> = {
  Portugal: '#3ecf8e',
  Turkey: '#ff6ba6',
  Vietnam: '#f5b544',
  Italy: '#5aa2ff',
  China: '#dcff66',
  India: '#d1f94f',
}

const CAPABILITIES: Capability[] = ['Knitwear', 'Cut & Sew', 'Denim', 'Outerwear', 'Accessories']

const COUNTRIES = ['Portugal', 'Turkey', 'Vietnam', 'Italy', 'China', 'India'] as const

const FACTORIES: Factory[] = [
  {
    id: 'atelier-norte',
    name: 'Atelier Norte',
    country: 'Portugal',
    city: 'Porto',
    flag: COUNTRY_FLAGS.Portugal,
    caps: ['Knitwear', 'Cut & Sew'],
    rating: 4.9,
    reviews: 128,
    moq: 50,
    leadDays: 18,
    priceFrom: 14,
    specialty: 'Heavyweight fleece & organic cotton',
    glyph: 'hoodie',
    hue: 'a',
    verified: true,
  },
  {
    id: 'bosphorus-mills',
    name: 'Bosphorus Mills',
    country: 'Turkey',
    city: 'Istanbul',
    flag: COUNTRY_FLAGS.Turkey,
    caps: ['Cut & Sew', 'Knitwear', 'Accessories'],
    rating: 4.8,
    reviews: 214,
    moq: 100,
    leadDays: 16,
    priceFrom: 9,
    specialty: 'Fast-turn jersey & ribbed knits',
    glyph: 'tee',
    hue: 'b',
    verified: true,
  },
  {
    id: 'saigon-craft',
    name: 'Saigon Craft Co.',
    country: 'Vietnam',
    city: 'Ho Chi Minh City',
    flag: COUNTRY_FLAGS.Vietnam,
    caps: ['Outerwear', 'Cut & Sew'],
    rating: 4.7,
    reviews: 96,
    moq: 150,
    leadDays: 24,
    priceFrom: 21,
    specialty: 'Technical shells & padded jackets',
    glyph: 'jacket',
    hue: 'c',
    verified: true,
  },
  {
    id: 'milano-forma',
    name: 'Milano Forma',
    country: 'Italy',
    city: 'Milan',
    flag: COUNTRY_FLAGS.Italy,
    caps: ['Outerwear', 'Cut & Sew'],
    rating: 5.0,
    reviews: 74,
    moq: 30,
    leadDays: 28,
    priceFrom: 46,
    specialty: 'Luxury tailoring & wool outerwear',
    glyph: 'jacket',
    hue: 'd',
    verified: true,
  },
  {
    id: 'canton-thread',
    name: 'Canton Thread Works',
    country: 'China',
    city: 'Guangzhou',
    flag: COUNTRY_FLAGS.China,
    caps: ['Cut & Sew', 'Denim', 'Accessories'],
    rating: 4.6,
    reviews: 331,
    moq: 200,
    leadDays: 20,
    priceFrom: 7,
    specialty: 'Full-package streetwear at scale',
    glyph: 'pants',
    hue: 'a',
    verified: true,
  },
  {
    id: 'indigo-house',
    name: 'Indigo House Denim',
    country: 'India',
    city: 'Ahmedabad',
    flag: COUNTRY_FLAGS.India,
    caps: ['Denim', 'Cut & Sew'],
    rating: 4.8,
    reviews: 152,
    moq: 120,
    leadDays: 26,
    priceFrom: 16,
    specialty: 'Selvedge denim & signature washes',
    glyph: 'pants',
    hue: 'b',
    verified: true,
  },
  {
    id: 'lisbon-loop',
    name: 'Lisbon Loop Knits',
    country: 'Portugal',
    city: 'Lisbon',
    flag: COUNTRY_FLAGS.Portugal,
    caps: ['Knitwear', 'Accessories'],
    rating: 4.9,
    reviews: 88,
    moq: 40,
    leadDays: 22,
    priceFrom: 19,
    specialty: 'Fine-gauge merino & beanies',
    glyph: 'cap',
    hue: 'c',
    verified: true,
  },
  {
    id: 'anatolia-denim',
    name: 'Anatolia Denim Lab',
    country: 'Turkey',
    city: 'Izmir',
    flag: COUNTRY_FLAGS.Turkey,
    caps: ['Denim', 'Outerwear'],
    rating: 4.7,
    reviews: 119,
    moq: 80,
    leadDays: 19,
    priceFrom: 15,
    specialty: 'Laser-wash denim & trucker jackets',
    glyph: 'jacket',
    hue: 'd',
    verified: false,
  },
  {
    id: 'hanoi-stitch',
    name: 'Hanoi Stitch House',
    country: 'Vietnam',
    city: 'Hanoi',
    flag: COUNTRY_FLAGS.Vietnam,
    caps: ['Cut & Sew', 'Knitwear'],
    rating: 4.6,
    reviews: 143,
    moq: 100,
    leadDays: 21,
    priceFrom: 11,
    specialty: 'Oversized tees & heavyweight hoodies',
    glyph: 'hoodie',
    hue: 'a',
    verified: true,
  },
  {
    id: 'delhi-trim',
    name: 'Delhi Trim & Co.',
    country: 'India',
    city: 'New Delhi',
    flag: COUNTRY_FLAGS.India,
    caps: ['Accessories', 'Cut & Sew'],
    rating: 4.5,
    reviews: 67,
    moq: 60,
    leadDays: 23,
    priceFrom: 6,
    specialty: 'Caps, patches & custom hardware',
    glyph: 'cap',
    hue: 'b',
    verified: false,
  },
]

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

interface FactoryCardProps {
  factory: Factory
  saved: boolean
  onToggleSave: (id: string) => void
}

const MAX_TAGS = 3

function FactoryCard({ factory, saved, onToggleSave }: FactoryCardProps) {
  const Glyph = GARMENT_GLYPHS[factory.glyph]
  const visibleTags = factory.caps.slice(0, MAX_TAGS)
  const hiddenCount = factory.caps.length - visibleTags.length

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleSave(factory.id)
  }

  return (
    <article className="mf-card">
      <div className={`mf-banner mf-banner--${factory.hue}`}>
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
            onClick={handleSave}
            aria-pressed={saved}
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
              <span className="mf-flag" style={{ background: factory.flag }} />
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
            <small>{factory.specialty}</small>
          </span>
          <button
            type="button"
            className="s-btn s-btn--accent mf-sample"
            onClick={(e) => e.stopPropagation()}
          >
            Request Sample <IcoArrowRight width="14" height="14" />
          </button>
        </div>
      </div>
    </article>
  )
}

/* ---------- Page ---------- */

const ALL_CAPS = 'All' as const
type CapFilter = typeof ALL_CAPS | Capability
type CountryFilter = 'Any country' | (typeof COUNTRIES)[number]
type MoqFilter = 'Any MOQ' | 'Under 50' | 'Under 100' | 'Under 200'

const MOQ_CEILINGS: Record<Exclude<MoqFilter, 'Any MOQ'>, number> = {
  'Under 50': 50,
  'Under 100': 100,
  'Under 200': 200,
}

const MOQ_ORDER: MoqFilter[] = ['Any MOQ', 'Under 50', 'Under 100', 'Under 200']

export function Manufacturers() {
  const [activeCap, setActiveCap] = useState<CapFilter>(ALL_CAPS)
  const [country, setCountry] = useState<CountryFilter>('Any country')
  const [moq, setMoq] = useState<MoqFilter>('Any MOQ')
  const [query, setQuery] = useState('')
  const [saved, setSaved] = useState<Set<string>>(() => new Set(['milano-forma', 'lisbon-loop']))

  const toggleSave = (id: string) => {
    setSaved((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const cycleCountry = () => {
    const options: CountryFilter[] = ['Any country', ...COUNTRIES]
    const idx = options.indexOf(country)
    setCountry(options[(idx + 1) % options.length])
  }

  const cycleMoq = () => {
    const idx = MOQ_ORDER.indexOf(moq)
    setMoq(MOQ_ORDER[(idx + 1) % MOQ_ORDER.length])
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return FACTORIES.filter((f) => {
      if (activeCap !== ALL_CAPS && !f.caps.includes(activeCap)) return false
      if (country !== 'Any country' && f.country !== country) return false
      if (moq !== 'Any MOQ' && f.moq > MOQ_CEILINGS[moq]) return false
      if (q) {
        const haystack = `${f.name} ${f.city} ${f.country} ${f.specialty}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [activeCap, country, moq, query])

  return (
    <SuitePage
      eyebrow="Manufacturer Hub"
      title="Manufacturers"
      subtitle="Discover vetted factories across the globe — filter by capability, country, MOQ and lead time, then request a sample in one tap."
      actions={
        <button type="button" className="s-btn s-btn--accent">
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
            <button type="button" className="mf-select" onClick={cycleCountry}>
              <b>{country}</b>
              <IcoChevron className="mf-select__chev" width="14" height="14" />
            </button>
            <button type="button" className="mf-select" onClick={cycleMoq}>
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
          </p>
          <button type="button" className="mf-sort">
            Sort by <b>Top rated</b>
            <IcoChevron width="13" height="13" />
          </button>
        </div>

        {/* Grid */}
        {results.length > 0 ? (
          <div className="mf-grid">
            {results.map((factory) => (
              <FactoryCard
                key={factory.id}
                factory={factory}
                saved={saved.has(factory.id)}
                onToggleSave={toggleSave}
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
            </div>
          </div>
        )}
      </div>
    </SuitePage>
  )
}
