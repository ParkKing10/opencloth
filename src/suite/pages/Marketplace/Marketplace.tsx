import { useMemo, useState } from 'react'
import { SuitePage } from '../_shared/SuitePage'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { uid } from '../../data/utils'
import type { Design } from '../../data/types'
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

/* Inline heart icon (not in the shared Icons set). */
function IcoHeart({ filled, ...props }: { filled?: boolean } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 20.5s-7.5-4.7-10-9.2C.4 8.2 1.7 4.7 5 4.2c2-.3 3.7.7 4.7 2.2L12 9l2.3-2.6c1-1.5 2.7-2.5 4.7-2.2 3.3.5 4.6 4 3 7.1-2.5 4.5-10 9.2-10 9.2Z" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const CATEGORIES = ['All', 'Templates', 'Garments', 'Collections', 'Graphics', 'Tech Packs'] as const
type Category = (typeof CATEGORIES)[number]
type AssetCategory = Exclude<Category, 'All'>

const SORTS = ['Popular', 'Newest', 'Price: Low'] as const
type Sort = (typeof SORTS)[number]

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
  /** Base like count as a plain number so we can add the viewer's like live. */
  likes: number
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
  violet: 'rgba(209, 249, 79, 0.18)',
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
    likes: 3100,
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
    likes: 6400,
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
    likes: 1700,
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
    likes: 2400,
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
    likes: 1200,
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
    likes: 4000,
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
    likes: 8900,
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
    likes: 1900,
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
    likes: 1100,
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
    likes: 5500,
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
    likes: 3600,
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
    likes: 4700,
  },
]

const priceLabel = (price: number): string => (price === 0 ? 'Free' : `$${price}`)

/** Render a like count the same way the seed data reads (e.g. 3.1k). */
function formatCount(n: number): string {
  if (n < 1000) return `${n}`
  const k = n / 1000
  return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`
}

/** Map a marketplace category to the closest garment kind for a new Design. */
function assetToDesignKind(asset: Asset): GarmentKind {
  return asset.glyph
}

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

type CardProps = {
  asset: Asset
  liked: boolean
  owned: boolean
  onToggleLike: (asset: Asset) => void
  onUse: (asset: Asset) => void
  onBuy: (asset: Asset) => void
}

function AssetCard({ asset, liked, owned, onToggleLike, onUse, onBuy }: CardProps) {
  const Glyph = GARMENT_GLYPHS[asset.glyph]
  const isFree = asset.price === 0
  const likeCount = formatCount(asset.likes + (liked ? 1 : 0))

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
        <button
          type="button"
          className={`mk-like${liked ? ' is-liked' : ''}`}
          aria-pressed={liked}
          title={liked ? 'Remove from saved' : 'Save to your likes'}
          onClick={() => onToggleLike(asset)}
        >
          <IcoHeart filled={liked} width="15" height="15" />
        </button>
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
            <span className="mk-stat" title={`${likeCount} likes`}>
              <IcoEye width="13" height="13" />
              {likeCount}
            </span>
          </div>
          {isFree ? (
            <button type="button" className="mk-use mk-use--free" onClick={() => onUse(asset)}>
              Use Template <IcoArrowRight width="13" height="13" />
            </button>
          ) : owned ? (
            <button type="button" className="mk-use mk-use--owned" disabled title="You already own this">
              <IcoCheck width="13" height="13" /> Owned
            </button>
          ) : (
            <button type="button" className="mk-use mk-use--buy" onClick={() => onBuy(asset)}>
              Buy {priceLabel(asset.price)}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function Marketplace() {
  const { mutate } = useStore()
  const { user } = useAuth()
  const toast = useToast()

  const [category, setCategory] = useState<Category>('All')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('Popular')
  const [liked, setLiked] = useState<ReadonlySet<string>>(() => new Set())
  const [owned, setOwned] = useState<ReadonlySet<string>>(() => new Set())

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = ASSETS.filter((asset) => {
      const matchCategory = category === 'All' || asset.category === category
      const matchQuery =
        q === '' ||
        asset.title.toLowerCase().includes(q) ||
        asset.author.name.toLowerCase().includes(q)
      return matchCategory && matchQuery
    })

    const sorted = [...filtered]
    if (sort === 'Newest') {
      // Reverse insertion order as a stand-in for recency (newest ids last).
      sorted.reverse()
    } else if (sort === 'Price: Low') {
      sorted.sort((a, b) => a.price - b.price)
    } else {
      sorted.sort((a, b) => b.likes - a.likes)
    }
    return sorted
  }, [category, query, sort])

  function cycleSort() {
    setSort((prev) => {
      const idx = SORTS.indexOf(prev)
      return SORTS[(idx + 1) % SORTS.length]
    })
  }

  function toggleLike(asset: Asset) {
    setLiked((prev) => {
      const next = new Set(prev)
      if (next.has(asset.id)) next.delete(asset.id)
      else next.add(asset.id)
      return next
    })
    const nowLiked = !liked.has(asset.id)
    toast(nowLiked ? `Saved “${asset.title}” to your likes` : `Removed “${asset.title}” from likes`, nowLiked ? 'accent' : 'default')
  }

  function useTemplate(asset: Asset) {
    if (!user) {
      toast('Sign in to use templates.', 'info')
      return
    }
    const design: Design = {
      id: uid('d'),
      ownerId: user.id,
      name: asset.title,
      kind: assetToDesignKind(asset),
      status: 'draft',
      progress: 0,
      updatedAt: Date.now(),
    }
    mutate((d) => ({ ...d, designs: [design, ...d.designs] }))
    toast(`“${asset.title}” added to your designs`, 'success')
  }

  function buyAsset(asset: Asset) {
    if (owned.has(asset.id)) return
    setOwned((prev) => {
      const next = new Set(prev)
      next.add(asset.id)
      return next
    })
    toast(`Purchased “${asset.title}” — ${priceLabel(asset.price)}`, 'success')
  }

  return (
    <SuitePage
      eyebrow="Marketplace"
      title="Marketplace"
      subtitle="Dribbble meets Figma Community — templates, garments and full collections from top creators. Buy or use instantly."
      actions={
        <button
          type="button"
          className="s-btn s-btn--accent"
          onClick={() => toast('Seller onboarding is coming soon — we’ll email you when it opens.', 'accent')}
        >
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
              <button
                type="button"
                className="s-btn s-btn--accent"
                onClick={() => {
                  const drop = ASSETS.find((a) => a.id === 'a9')
                  if (drop) buyAsset(drop)
                }}
              >
                {owned.has('a9') ? 'Owned — open in Design' : 'Get the drop — $129'}
              </button>
              <button
                type="button"
                className="s-btn s-btn--subtle"
                onClick={() => {
                  setCategory('Collections')
                  toast('Showing collections — the Nocturne Capsule is in this view.', 'info')
                }}
              >
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
          <button type="button" className="mk-sort" onClick={cycleSort} title="Change sort order">
            Sort: {sort} <IcoChevron width="13" height="13" />
          </button>
        </div>

        {/* Grid */}
        {visible.length > 0 ? (
          <div className="mk-grid">
            {visible.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                liked={liked.has(asset.id)}
                owned={owned.has(asset.id)}
                onToggleLike={toggleLike}
                onUse={useTemplate}
                onBuy={buyAsset}
              />
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
              {(query !== '' || category !== 'All') && (
                <button
                  type="button"
                  className="s-btn s-btn--subtle"
                  style={{ marginTop: 16 }}
                  onClick={() => {
                    setQuery('')
                    setCategory('All')
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Seller CTA */}
        <section className="mk-seller">
          <div className="mk-seller__text">
            <b>Have a template worth selling?</b>
            <small>Publish to 40k+ fashion creators and earn 80% on every sale. Payouts weekly.</small>
          </div>
          <button
            type="button"
            className="s-btn s-btn--ghost"
            onClick={() => toast('Thanks for your interest — seller applications open soon.', 'accent')}
          >
            <IcoPlus width="16" height="16" /> Become a seller
          </button>
        </section>
      </div>
    </SuitePage>
  )
}
