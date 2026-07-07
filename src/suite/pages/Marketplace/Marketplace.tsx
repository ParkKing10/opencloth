import { useMemo, useState } from 'react'
import { SuitePage } from '../_shared/SuitePage'
import {
  IcoSearch,
  IcoPlus,
  IcoSparkle,
  IcoCheck,
  IcoStar,
  IcoUpload,
  IcoEye,
  IcoArrowRight,
  IcoChevron,
} from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import './mk.css'

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const CATEGORIES = ['All', 'Templates', 'Garments', 'Collections', 'Graphics', 'Tech Packs'] as const
type Category = (typeof CATEGORIES)[number]
type AssetCategory = Exclude<Category, 'All'>

type Author = { initials: string; name: string; verified: boolean }

type Asset = {
  id: string
  title: string
  category: AssetCategory
  glyph: GarmentKind
  tint: string
  chip?: { label: string; kind: 'accent' | 'new' | 'good' }
  price: number // 0 === Free
  author: Author
  rating: string
  downloads: string
  likes: string
}

const AUTHORS = {
  nova: { initials: 'NV', name: 'Nova Atelier', verified: true },
  kai: { initials: 'KP', name: 'Kai Prototype', verified: true },
  monoline: { initials: 'ML', name: 'Monoline Studio', verified: false },
  vantablack: { initials: 'VB', name: 'Vantablack Co.', verified: true },
  drift: { initials: 'DR', name: 'Drift Supply', verified: false },
  atelier: { initials: 'AT', name: 'Atelier Nord', verified: true },
} satisfies Record<string, Author>

const TINT = {
  violet: 'rgba(124, 92, 255, 0.18)',
  pink: 'rgba(255, 107, 166, 0.16)',
  info: 'rgba(90, 162, 255, 0.16)',
  good: 'rgba(62, 207, 142, 0.14)',
} as const

const ASSETS: Asset[] = [
  {
    id: 'a1',
    title: 'Vintage Washed Hoodie Kit',
    category: 'Templates',
    glyph: 'hoodie',
    tint: TINT.violet,
    chip: { label: 'Trending', kind: 'accent' },
    price: 29,
    author: AUTHORS.nova,
    rating: '4.9',
    downloads: '12.4k',
    likes: '3.1k',
  },
  {
    id: 'a2',
    title: 'Oversized Street Tee Base',
    category: 'Garments',
    glyph: 'tee',
    tint: TINT.info,
    price: 0,
    author: AUTHORS.monoline,
    rating: '4.8',
    downloads: '28.9k',
    likes: '6.4k',
  },
  {
    id: 'a3',
    title: 'Concrete Series — SS26',
    category: 'Collections',
    glyph: 'jacket',
    tint: TINT.pink,
    chip: { label: 'New', kind: 'new' },
    price: 89,
    author: AUTHORS.vantablack,
    rating: '5.0',
    downloads: '2.1k',
    likes: '1.7k',
  },
  {
    id: 'a4',
    title: 'Cargo Pocket Jacket Pack',
    category: 'Templates',
    glyph: 'jacket',
    tint: TINT.violet,
    price: 39,
    author: AUTHORS.kai,
    rating: '4.7',
    downloads: '9.8k',
    likes: '2.4k',
  },
  {
    id: 'a5',
    title: 'Baggy Cargo Pants Spec',
    category: 'Tech Packs',
    glyph: 'pants',
    tint: TINT.good,
    chip: { label: 'Pro', kind: 'good' },
    price: 24,
    author: AUTHORS.atelier,
    rating: '4.9',
    downloads: '5.6k',
    likes: '1.2k',
  },
  {
    id: 'a6',
    title: 'Structured 5-Panel Cap',
    category: 'Garments',
    glyph: 'cap',
    tint: TINT.info,
    price: 0,
    author: AUTHORS.drift,
    rating: '4.6',
    downloads: '18.2k',
    likes: '4.0k',
  },
  {
    id: 'a7',
    title: 'Acid Wash Graphic Bundle',
    category: 'Graphics',
    glyph: 'tee',
    tint: TINT.pink,
    chip: { label: 'Editor’s pick', kind: 'accent' },
    price: 19,
    author: AUTHORS.nova,
    rating: '4.9',
    downloads: '31.5k',
    likes: '8.9k',
  },
  {
    id: 'a8',
    title: 'Heavyweight Hoodie Tech Pack',
    category: 'Tech Packs',
    glyph: 'hoodie',
    tint: TINT.violet,
    price: 34,
    author: AUTHORS.kai,
    rating: '4.8',
    downloads: '7.3k',
    likes: '1.9k',
  },
  {
    id: 'a9',
    title: 'Nocturne Capsule — 6 pcs',
    category: 'Collections',
    glyph: 'jacket',
    tint: TINT.info,
    price: 129,
    author: AUTHORS.vantablack,
    rating: '5.0',
    downloads: '1.4k',
    likes: '1.1k',
  },
  {
    id: 'a10',
    title: 'Distressed Denim Overlay',
    category: 'Graphics',
    glyph: 'pants',
    tint: TINT.good,
    price: 0,
    author: AUTHORS.monoline,
    rating: '4.7',
    downloads: '22.7k',
    likes: '5.5k',
  },
  {
    id: 'a11',
    title: 'Utility Field Jacket Base',
    category: 'Garments',
    glyph: 'jacket',
    tint: TINT.pink,
    price: 0,
    author: AUTHORS.drift,
    rating: '4.8',
    downloads: '14.1k',
    likes: '3.6k',
  },
  {
    id: 'a12',
    title: 'Boxy Crop Tee Template',
    category: 'Templates',
    glyph: 'tee',
    tint: TINT.violet,
    chip: { label: 'Trending', kind: 'accent' },
    price: 22,
    author: AUTHORS.atelier,
    rating: '4.9',
    downloads: '16.8k',
    likes: '4.7k',
  },
]

const priceLabel = (price: number): string => (price === 0 ? 'Free' : `$${price}`)

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

function AssetCard({ asset }: { asset: Asset }) {
  const Glyph = GARMENT_GLYPHS[asset.glyph]
  const isFree = asset.price === 0

  return (
    <article className="mk-card" style={{ '--mk-tint': asset.tint } as Record<string, string>}>
      <div className="mk-card__preview">
        <span className="mk-card__grain" aria-hidden="true" />
        <div className="mk-card__tags">
          {asset.chip && (
            <span className={`s-chip s-chip--${asset.chip.kind}`}>
              {asset.chip.kind === 'accent' && <IcoSparkle width="11" height="11" />}
              {asset.chip.label}
            </span>
          )}
        </div>
        <span className={`mk-price${isFree ? ' mk-price--free' : ''}`}>{priceLabel(asset.price)}</span>
        <span className="mk-card__glyph" aria-hidden="true">
          <Glyph width="72" height="72" />
        </span>
      </div>

      <div className="mk-card__body">
        <h3 className="mk-card__title">{asset.title}</h3>

        <div className="mk-author">
          <span className="mk-author__av">{asset.author.initials}</span>
          <span className="mk-author__name">{asset.author.name}</span>
          {asset.author.verified && (
            <span className="mk-author__verify" title="Verified creator" aria-label="Verified creator">
              <IcoCheck width="9" height="9" />
            </span>
          )}
          <span className="mk-author__stats">
            <IcoStar width="12" height="12" />
            {asset.rating}
          </span>
        </div>

        <div className="mk-card__foot">
          <div className="mk-stats">
            <span className="mk-stat" title={`${asset.downloads} downloads`}>
              <IcoUpload width="13" height="13" style={{ transform: 'rotate(180deg)' }} />
              {asset.downloads}
            </span>
            <span className="mk-stat" title={`${asset.likes} likes`}>
              <IcoEye width="13" height="13" />
              {asset.likes}
            </span>
          </div>
          <button type="button" className={`mk-use ${isFree ? 'mk-use--free' : 'mk-use--buy'}`}>
            {isFree ? (
              <>
                Use Template <IcoArrowRight width="13" height="13" />
              </>
            ) : (
              <>Buy {priceLabel(asset.price)}</>
            )}
          </button>
        </div>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function Marketplace() {
  const [category, setCategory] = useState<Category>('All')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ASSETS.filter((asset) => {
      const matchCategory = category === 'All' || asset.category === category
      const matchQuery =
        q === '' ||
        asset.title.toLowerCase().includes(q) ||
        asset.author.name.toLowerCase().includes(q)
      return matchCategory && matchQuery
    })
  }, [category, query])

  return (
    <SuitePage
      eyebrow="Marketplace"
      title="Marketplace"
      subtitle="Dribbble meets Figma Community — templates, garments and full collections from top creators. Buy or use instantly."
      actions={
        <button type="button" className="s-btn s-btn--accent">
          <IcoPlus width="16" height="16" /> Sell a template
        </button>
      }
    >
      <div className="mk-root">
        {/* Toolbar: category pills + search */}
        <div className="mk-toolbar">
          <div className="s-filters">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`s-filter${category === c ? ' is-active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <label className="mk-search">
            <IcoSearch className="mk-search__ico" width="16" height="16" />
            <input
              className="mk-search__input"
              type="search"
              placeholder="Search assets, creators…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {/* Featured drop banner */}
        <section className="mk-featured">
          <span className="mk-featured__glow" aria-hidden="true" />
          <div className="mk-featured__body">
            <span className="s-chip s-chip--accent">
              <IcoSparkle width="12" height="12" /> Featured drop
            </span>
            <h2 className="mk-featured__title">
              Nocturne Capsule by <em>Vantablack Co.</em> — six garments, one mood.
            </h2>
            <p className="mk-featured__sub">
              A production-ready streetwear capsule with tech packs, colorways and factory-matched specs.
              Editable in the Design studio the moment you own it.
            </p>
            <div className="mk-featured__row">
              <button type="button" className="s-btn s-btn--accent">
                Get the drop — $129
              </button>
              <button type="button" className="s-btn s-btn--subtle">
                Preview collection <IcoArrowRight width="14" height="14" />
              </button>
              <span className="mk-featured__meta">
                <IcoStar width="13" height="13" style={{ color: 'var(--s-warn)' }} />
                <b>5.0</b> · 1.4k downloads
              </span>
            </div>
          </div>
          <div className="mk-featured__gallery" aria-hidden="true">
            <span className="mk-fchip">
              <GARMENT_GLYPHS.jacket width="52" height="52" />
            </span>
            <span className="mk-fchip">
              <GARMENT_GLYPHS.hoodie width="52" height="52" />
            </span>
            <span className="mk-fchip">
              <GARMENT_GLYPHS.pants width="52" height="52" />
            </span>
          </div>
        </section>

        {/* List head */}
        <div className="mk-listhead">
          <span className="s-section-title">
            {category === 'All' ? 'All assets' : category}
            <span className="mk-listhead__count">
              {' · '}
              <b>{visible.length}</b> {visible.length === 1 ? 'item' : 'items'}
            </span>
          </span>
          <button type="button" className="mk-sort">
            Sort: Popular <IcoChevron width="13" height="13" />
          </button>
        </div>

        {/* Grid */}
        {visible.length > 0 ? (
          <div className="mk-grid">
            {visible.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        ) : (
          <div className="page-empty">
            <div>
              <div className="page-empty__ico">
                <IcoSearch width="24" height="24" />
              </div>
              <h3>No matching assets</h3>
              <p>Try a different category or clear your search to browse the full marketplace.</p>
            </div>
          </div>
        )}

        {/* Seller CTA */}
        <section className="mk-seller">
          <div className="mk-seller__text">
            <b>Have a template worth selling?</b>
            <small>Publish to 40k+ fashion creators and earn 80% on every sale. Payouts weekly.</small>
          </div>
          <button type="button" className="s-btn s-btn--ghost">
            <IcoPlus width="16" height="16" /> Become a seller
          </button>
        </section>
      </div>
    </SuitePage>
  )
}
