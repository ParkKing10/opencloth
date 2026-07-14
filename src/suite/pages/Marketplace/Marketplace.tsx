import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SuitePage } from '../_shared/SuitePage'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { uid } from '../../data/utils'
import { downloadJson } from '../../lib/download'
import { useT } from '@/i18n'
import type { Design, TechPack } from '../../data/types'
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

/** Where new sellers apply — shared by the header panel and footer CTA. */
const SELLER_APPLY_URL = 'https://threados.studio/sell/apply'

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

/* Translation-key maps for values held in const data — resolved via t() at the render site. */
const CATEGORY_LABELS: Record<Category, string> = {
  All: 'marketplace.cat.all',
  Templates: 'marketplace.cat.templates',
  Garments: 'marketplace.cat.garments',
  Collections: 'marketplace.cat.collections',
  Graphics: 'marketplace.cat.graphics',
  'Tech Packs': 'marketplace.cat.techPacks',
}

const SORT_LABELS: Record<Sort, string> = {
  Popular: 'marketplace.sort.popular',
  Newest: 'marketplace.sort.newest',
  'Price: Low': 'marketplace.sort.priceLow',
}

const CHIP_LABELS: Record<string, string> = {
  Trending: 'marketplace.chip.trending',
  New: 'marketplace.chip.new',
  Pro: 'marketplace.chip.pro',
  'Editor’s pick': 'marketplace.chip.editors',
}

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
  const t = useT()
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
              {CHIP_LABELS[asset.chip.label] ? t(CHIP_LABELS[asset.chip.label]) : asset.chip.label}
            </span>
          )}
        </div>
        <button
          type="button"
          className={`mk-like${liked ? ' is-liked' : ''}`}
          aria-pressed={liked}
          title={liked ? t('marketplace.card.like.remove') : t('marketplace.card.like.save')}
          onClick={() => onToggleLike(asset)}
        >
          <IcoHeart filled={liked} width="15" height="15" />
        </button>
        <span className={`mk-price${isFree ? ' mk-price--free' : ''}`}>
          {isFree ? t('marketplace.free') : priceLabel(asset.price)}
        </span>
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
            <span className="mk-author__verify" title={t('marketplace.card.verified')} aria-label={t('marketplace.card.verified')}>
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
            <span className="mk-stat" title={t('marketplace.card.downloadsTitle', { n: asset.downloads })}>
              <IcoUpload width="13" height="13" style={{ transform: 'rotate(180deg)' }} />
              {asset.downloads}
            </span>
            <span className="mk-stat" title={t('marketplace.card.likesTitle', { n: likeCount })}>
              <IcoEye width="13" height="13" />
              {likeCount}
            </span>
          </div>
          {isFree ? (
            <button type="button" className="mk-use mk-use--free" onClick={() => onUse(asset)}>
              {t('marketplace.card.useTemplate')} <IcoArrowRight width="13" height="13" />
            </button>
          ) : owned ? (
            <button type="button" className="mk-use mk-use--owned" disabled title={t('marketplace.card.ownedTitle')}>
              <IcoCheck width="13" height="13" /> {t('marketplace.card.owned')}
            </button>
          ) : (
            <button type="button" className="mk-use mk-use--buy" onClick={() => onBuy(asset)}>
              {t('marketplace.card.buy', { price: priceLabel(asset.price) })}
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
  const navigate = useNavigate()
  const t = useT()

  const [category, setCategory] = useState<Category>('All')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('Popular')
  const [liked, setLiked] = useState<ReadonlySet<string>>(() => new Set())
  const [owned, setOwned] = useState<ReadonlySet<string>>(() => new Set())
  const [sellerOpen, setSellerOpen] = useState(false)

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
    toast(nowLiked ? t('marketplace.toast.saved', { title: asset.title }) : t('marketplace.toast.removed', { title: asset.title }), nowLiked ? 'accent' : 'default')
  }

  function useTemplate(asset: Asset) {
    if (!user) {
      toast(t('marketplace.toast.signInUse'), 'info')
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
    // Real persistence: add the design, then open it in the studio.
    mutate((d) => ({ ...d, designs: [design, ...d.designs] }))
    toast(t('marketplace.toast.addedDesign', { title: asset.title }), 'success')
    navigate('/suite/design')
  }

  function buyAsset(asset: Asset) {
    if (owned.has(asset.id)) return
    if (!user) {
      toast(t('marketplace.toast.signInBuy'), 'info')
      return
    }
    // Real persistence: purchased assets land in the owner's library as a tech pack.
    const techPack: TechPack = {
      id: uid('t'),
      ownerId: user.id,
      name: asset.title,
      kind: assetToDesignKind(asset),
      status: 'ready',
      manufacturer: asset.author.name,
      pages: 12,
      updatedAt: Date.now(),
    }
    mutate((d) => ({ ...d, techPacks: [techPack, ...d.techPacks] }))
    setOwned((prev) => {
      const next = new Set(prev)
      next.add(asset.id)
      return next
    })
    toast(t('marketplace.toast.addedLibrary', { title: asset.title }), 'success')
  }

  /** Open the purchased asset in the Design studio. */
  function openInDesign() {
    navigate('/suite/design')
  }

  /** Copy the seller application link (real clipboard write, guarded). */
  async function copySellerLink() {
    try {
      await navigator.clipboard.writeText(SELLER_APPLY_URL)
      toast(t('marketplace.toast.linkCopied'), 'accent')
    } catch {
      toast(t('marketplace.toast.linkCopyFail'), 'info')
    }
  }

  /** Download a real starter-kit JSON creators can fill in and submit. */
  function downloadSellerKit() {
    try {
      downloadJson(
        {
          product: 'loom studios Marketplace',
          applyUrl: SELLER_APPLY_URL,
          payoutShare: '80%',
          payoutCadence: 'weekly',
          submissionChecklist: [
            'Source design or tech pack files',
            'Cover preview (1600×1200 min)',
            'Title, category and price',
            'License terms',
          ],
          applicant: user ? { name: user.name, email: user.email } : null,
          generatedAt: new Date().toISOString(),
        },
        'threados-seller-starter-kit.json',
      )
      // Success toast only fires after the download actually started.
      toast(t('marketplace.toast.kitDownloaded'), 'success')
    } catch {
      toast(t('marketplace.toast.kitFail'), 'info')
    }
  }

  return (
    <SuitePage
      eyebrow={t('marketplace.eyebrow')}
      title={t('marketplace.title')}
      subtitle={t('marketplace.subtitle')}
      actions={
        <button
          type="button"
          className="s-btn s-btn--accent"
          aria-expanded={sellerOpen}
          aria-controls="mk-seller-panel"
          onClick={() => setSellerOpen((open) => !open)}
        >
          <IcoPlus width="16" height="16" /> {t('marketplace.sellTemplate')}
        </button>
      }
    >
      <div className="mk-root">
        {/* Seller onboarding panel — toggled by the header action */}
        {sellerOpen && (
          <section id="mk-seller-panel" className="mk-panel">
            <div className="mk-panel__head">
              <div>
                <b>{t('marketplace.panel.title')}</b>
                <small>{t('marketplace.panel.sub')}</small>
              </div>
              <button
                type="button"
                className="mk-panel__close"
                aria-label={t('marketplace.panel.close')}
                onClick={() => setSellerOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="mk-panel__row">
              <button type="button" className="s-btn s-btn--accent" onClick={copySellerLink}>
                {t('marketplace.panel.copyLink')}
              </button>
              <button type="button" className="s-btn s-btn--subtle" onClick={downloadSellerKit}>
                <IcoUpload width="15" height="15" style={{ transform: 'rotate(180deg)' }} />
                {t('marketplace.panel.downloadKit')}
              </button>
            </div>
          </section>
        )}

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
                {t(CATEGORY_LABELS[c])}
              </button>
            ))}
          </div>
          <label className="mk-search">
            <IcoSearch className="mk-search__ico" width="16" height="16" />
            <input
              className="mk-search__input"
              type="search"
              placeholder={t('marketplace.search.placeholder')}
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
              <IcoSparkle width="12" height="12" /> {t('marketplace.featured.badge')}
            </span>
            <h2 className="mk-featured__title">
              {t('marketplace.featured.titleBefore')}<em>Vantablack Co.</em>{t('marketplace.featured.titleAfter')}
            </h2>
            <p className="mk-featured__sub">{t('marketplace.featured.sub')}</p>
            <div className="mk-featured__row">
              <button
                type="button"
                className="s-btn s-btn--accent"
                onClick={() => {
                  if (owned.has('a9')) {
                    openInDesign()
                    return
                  }
                  const drop = ASSETS.find((a) => a.id === 'a9')
                  if (drop) buyAsset(drop)
                }}
              >
                {owned.has('a9') ? t('marketplace.featured.getOwned') : t('marketplace.featured.getDrop')}
              </button>
              <button
                type="button"
                className="s-btn s-btn--subtle"
                onClick={() => {
                  setCategory('Collections')
                  toast(t('marketplace.toast.showingCollections'), 'info')
                }}
              >
                {t('marketplace.featured.preview')} <IcoArrowRight width="14" height="14" />
              </button>
              <span className="mk-featured__meta">
                <IcoStar width="13" height="13" style={{ color: 'var(--s-warn)' }} />
                <b>5.0</b> · 1.4k {t('marketplace.downloads')}
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
            {category === 'All' ? t('marketplace.listhead.all') : t(CATEGORY_LABELS[category])}
            <span className="mk-listhead__count">
              {' · '}
              <b>{visible.length}</b> {visible.length === 1 ? t('marketplace.item') : t('marketplace.items')}
            </span>
          </span>
          <button type="button" className="mk-sort" onClick={cycleSort} title={t('marketplace.sortTitle')}>
            {t('marketplace.sortLabel')}: {t(SORT_LABELS[sort])} <IcoChevron width="13" height="13" />
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
              <h3>{t('marketplace.empty.title')}</h3>
              <p>{t('marketplace.empty.body')}</p>
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
                  {t('marketplace.empty.clear')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Seller CTA */}
        <section className="mk-seller">
          <div className="mk-seller__text">
            <b>{t('marketplace.seller.title')}</b>
            <small>{t('marketplace.seller.sub')}</small>
          </div>
          <button
            type="button"
            className="s-btn s-btn--ghost"
            onClick={copySellerLink}
          >
            <IcoPlus width="16" height="16" /> {t('marketplace.seller.become')}
          </button>
        </section>
      </div>
    </SuitePage>
  )
}
