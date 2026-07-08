import { useMemo, useState, type ReactNode } from 'react'
import { SuitePage } from '../_shared/SuitePage'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import {
  IcoSearch,
  IcoUpload,
  IcoCheck,
  IcoEye,
  IcoStar,
  IcoArrowRight,
  IcoTrend,
  IcoCommunity,
  IcoCollections,
} from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import './com.css'

/* -------------------------------------------------------------------------- */
/*  Small inline icons (heart / bookmark / pin) — not in the shared Icons set  */
/* -------------------------------------------------------------------------- */

type IcoProps = { width?: number; height?: number }

function IcoHeart({ width = 14, height = 14 }: IcoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20s-7-4.4-9.3-8.5C1.2 8.9 2.4 5.6 5.6 5.1 7.6 4.8 9.3 6 12 8.4 14.7 6 16.4 4.8 18.4 5.1c3.2.5 4.4 3.8 2.9 6.4C19 15.6 12 20 12 20Z" />
    </svg>
  )
}

function IcoHeartFill({ width = 14, height = 14 }: IcoProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 20s-7-4.4-9.3-8.5C1.2 8.9 2.4 5.6 5.6 5.1 7.6 4.8 9.3 6 12 8.4 14.7 6 16.4 4.8 18.4 5.1c3.2.5 4.4 3.8 2.9 6.4C19 15.6 12 20 12 20Z" />
    </svg>
  )
}

function IcoBookmark({ width = 15, height = 15 }: IcoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.6L6 21V4.5Z" />
    </svg>
  )
}

function IcoPin({ width = 13, height = 13 }: IcoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s6-5.3 6-10a6 6 0 0 0-12 0c0 4.7 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </svg>
  )
}

function IcoUserPlus({ width = 14, height = 14 }: IcoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="8" r="3.4" />
      <path d="M3.5 20c.5-3.4 2.9-5.5 5.5-5.5s5 2.1 5.5 5.5M18 8v6M21 11h-6" />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/*  Static community catalogue (curated showcase content, not user-owned).     */
/*  Real user collections are pulled from the store further down.              */
/* -------------------------------------------------------------------------- */

const TABS = ['Designers', 'Collections', 'Trending'] as const
type Tab = (typeof TABS)[number]

const CATEGORIES = ['All', 'Streetwear', 'Outerwear', 'Denim', 'Techwear', 'Knitwear', 'Vintage'] as const
type Category = (typeof CATEGORIES)[number]

type Designer = {
  id: string
  name: string
  initials: string
  role: string
  category: Exclude<Category, 'All'>
  location: string
  followers: string
  projects: string
  verified: boolean
  grad: string
  thumbs: GarmentKind[]
}

const DESIGNERS: Designer[] = [
  {
    id: 'd1',
    name: 'Mika Okafor',
    initials: 'MO',
    role: 'Streetwear Designer',
    category: 'Streetwear',
    location: 'Lagos, NG',
    followers: '18.4k',
    projects: '62',
    verified: true,
    grad: 'com-grad-1',
    thumbs: ['hoodie', 'tee', 'cap'],
  },
  {
    id: 'd2',
    name: 'Elias Vandt',
    initials: 'EV',
    role: 'Outerwear Specialist',
    category: 'Outerwear',
    location: 'Copenhagen, DK',
    followers: '11.2k',
    projects: '38',
    verified: true,
    grad: 'com-grad-3',
    thumbs: ['jacket', 'pants', 'hoodie'],
  },
  {
    id: 'd3',
    name: 'Sora Tanaka',
    initials: 'ST',
    role: 'Techwear Art Director',
    category: 'Techwear',
    location: 'Tokyo, JP',
    followers: '27.9k',
    projects: '84',
    verified: true,
    grad: 'com-grad-6',
    thumbs: ['jacket', 'cap', 'pants'],
  },
  {
    id: 'd4',
    name: 'Priya Raman',
    initials: 'PR',
    role: 'Knitwear & Textiles',
    category: 'Knitwear',
    location: 'Mumbai, IN',
    followers: '9.6k',
    projects: '41',
    verified: false,
    grad: 'com-grad-4',
    thumbs: ['tee', 'hoodie', 'cap'],
  },
  {
    id: 'd5',
    name: 'Diego Salas',
    initials: 'DS',
    role: 'Denim Developer',
    category: 'Denim',
    location: 'Mexico City, MX',
    followers: '14.1k',
    projects: '57',
    verified: true,
    grad: 'com-grad-5',
    thumbs: ['pants', 'jacket', 'tee'],
  },
  {
    id: 'd6',
    name: 'Nora Bennett',
    initials: 'NB',
    role: 'Vintage Revivalist',
    category: 'Vintage',
    location: 'London, UK',
    followers: '22.7k',
    projects: '73',
    verified: true,
    grad: 'com-grad-2',
    thumbs: ['hoodie', 'jacket', 'pants'],
  },
]

type CoverTint = 'a' | 'b' | 'c'
type CoverSize = 'tall' | 'mid' | 'short'

type Project = {
  id: string
  title: string
  author: string
  initials: string
  grad: string
  kind: GarmentKind
  category: Exclude<Category, 'All'>
  tint: CoverTint
  size: CoverSize
  likes: number
  views: string
  tag?: string
}

const PROJECTS: Project[] = [
  {
    id: 'p1',
    title: 'Vintage Washed Hoodie — SS26',
    author: 'Nora Bennett',
    initials: 'NB',
    grad: 'com-grad-2',
    kind: 'hoodie',
    category: 'Vintage',
    tint: 'c',
    size: 'tall',
    likes: 1284,
    views: '24.1k',
    tag: 'Editor’s Pick',
  },
  {
    id: 'p2',
    title: 'Oversized Street Tee',
    author: 'Mika Okafor',
    initials: 'MO',
    grad: 'com-grad-1',
    kind: 'tee',
    category: 'Streetwear',
    tint: 'a',
    size: 'short',
    likes: 842,
    views: '12.8k',
  },
  {
    id: 'p3',
    title: 'Shell Cargo Jacket / Concrete',
    author: 'Sora Tanaka',
    initials: 'ST',
    grad: 'com-grad-6',
    kind: 'jacket',
    category: 'Techwear',
    tint: 'b',
    size: 'mid',
    likes: 2107,
    views: '38.5k',
    tag: 'Trending',
  },
  {
    id: 'p4',
    title: 'Baggy Cargo Pants — Rework',
    author: 'Diego Salas',
    initials: 'DS',
    grad: 'com-grad-5',
    kind: 'pants',
    category: 'Denim',
    tint: 'a',
    size: 'mid',
    likes: 976,
    views: '15.2k',
  },
  {
    id: 'p5',
    title: 'Structured Wool Overcoat',
    author: 'Elias Vandt',
    initials: 'EV',
    grad: 'com-grad-3',
    kind: 'jacket',
    category: 'Outerwear',
    tint: 'c',
    size: 'tall',
    likes: 1543,
    views: '29.7k',
  },
  {
    id: 'p6',
    title: 'Panelled 6-Panel Cap',
    author: 'Priya Raman',
    initials: 'PR',
    grad: 'com-grad-4',
    kind: 'cap',
    category: 'Knitwear',
    tint: 'b',
    size: 'short',
    likes: 611,
    views: '8.9k',
  },
  {
    id: 'p7',
    title: 'Boxy Cropped Tee — Faded Ink',
    author: 'Mika Okafor',
    initials: 'MO',
    grad: 'com-grad-1',
    kind: 'tee',
    category: 'Streetwear',
    tint: 'c',
    size: 'mid',
    likes: 1198,
    views: '19.4k',
  },
  {
    id: 'p8',
    title: 'Heavyweight Zip Hoodie',
    author: 'Priya Raman',
    initials: 'PR',
    grad: 'com-grad-4',
    kind: 'hoodie',
    category: 'Knitwear',
    tint: 'a',
    size: 'tall',
    likes: 1720,
    views: '31.2k',
    tag: 'New',
  },
  {
    id: 'p9',
    title: 'Selvedge Carpenter Pant',
    author: 'Diego Salas',
    initials: 'DS',
    grad: 'com-grad-5',
    kind: 'pants',
    category: 'Denim',
    tint: 'b',
    size: 'short',
    likes: 703,
    views: '10.6k',
  },
]

/* Curated community collections shown in the Collections tab. */
type CommunityCollection = {
  id: string
  name: string
  author: string
  initials: string
  grad: string
  category: Exclude<Category, 'All'>
  season: string
  pieces: GarmentKind[]
  saves: string
}

const COLLECTIONS: CommunityCollection[] = [
  {
    id: 'cc1',
    name: 'Concrete Series',
    author: 'Sora Tanaka',
    initials: 'ST',
    grad: 'com-grad-6',
    category: 'Techwear',
    season: 'SS26',
    pieces: ['jacket', 'pants', 'cap'],
    saves: '4.2k',
  },
  {
    id: 'cc2',
    name: 'Faded Archive',
    author: 'Nora Bennett',
    initials: 'NB',
    grad: 'com-grad-2',
    category: 'Vintage',
    season: 'FW25',
    pieces: ['hoodie', 'tee', 'jacket'],
    saves: '3.7k',
  },
  {
    id: 'cc3',
    name: 'Street Staples',
    author: 'Mika Okafor',
    initials: 'MO',
    grad: 'com-grad-1',
    category: 'Streetwear',
    season: 'CORE',
    pieces: ['tee', 'hoodie', 'cap'],
    saves: '5.9k',
  },
  {
    id: 'cc4',
    name: 'Northern Shell',
    author: 'Elias Vandt',
    initials: 'EV',
    grad: 'com-grad-3',
    category: 'Outerwear',
    season: 'FW25',
    pieces: ['jacket', 'pants', 'hoodie'],
    saves: '2.1k',
  },
  {
    id: 'cc5',
    name: 'Indigo Rework',
    author: 'Diego Salas',
    initials: 'DS',
    grad: 'com-grad-5',
    category: 'Denim',
    season: 'SS26',
    pieces: ['pants', 'jacket', 'tee'],
    saves: '1.8k',
  },
  {
    id: 'cc6',
    name: 'Soft Structures',
    author: 'Priya Raman',
    initials: 'PR',
    grad: 'com-grad-4',
    category: 'Knitwear',
    season: 'CORE',
    pieces: ['tee', 'hoodie', 'cap'],
    saves: '2.6k',
  },
]

function formatLikes(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

type DesignerCardProps = {
  designer: Designer
  isFollowing: boolean
  onToggleFollow: (designer: Designer) => void
  onHire: (designer: Designer) => void
}

function DesignerCard({ designer, isFollowing, onToggleFollow, onHire }: DesignerCardProps) {
  const Ghost = GARMENT_GLYPHS[designer.thumbs[0]]

  return (
    <article className="com-designer">
      <div className="com-designer__banner">
        <span className="com-designer__ghost" aria-hidden="true">
          <Ghost width="112" height="112" />
        </span>
      </div>

      <div className="com-designer__top">
        <span className={`com-av com-av--lg ${designer.grad}`}>{designer.initials}</span>
        <div className="com-designer__ident">
          <span className="com-designer__name">
            {designer.name}
            {designer.verified && (
              <span className="com-verify" title="Verified designer">
                <IcoCheck width="9" height="9" />
              </span>
            )}
          </span>
          <span className="com-designer__role">{designer.role}</span>
        </div>
      </div>

      <div className="com-designer__meta">
        <span>
          <IcoPin />
          {designer.location}
        </span>
        <span>
          <b>{designer.followers}</b> followers
        </span>
        <span>
          <b>{designer.projects}</b> projects
        </span>
      </div>

      <div className="com-thumbs">
        {designer.thumbs.map((kind, i) => {
          const Glyph = GARMENT_GLYPHS[kind]
          return (
            <span className="com-thumb" key={`${designer.id}-${kind}-${i}`} title={`${kind} project`}>
              <Glyph width="34" height="34" />
            </span>
          )
        })}
      </div>

      <div className="com-designer__actions">
        <button
          type="button"
          className={`s-btn s-btn--accent com-follow${isFollowing ? ' is-following' : ''}`}
          aria-pressed={isFollowing}
          title={isFollowing ? `Unfollow ${designer.name}` : `Follow ${designer.name}`}
          onClick={() => onToggleFollow(designer)}
        >
          {isFollowing ? (
            <>
              <IcoCheck width="14" height="14" /> Following
            </>
          ) : (
            'Follow'
          )}
        </button>
        <button
          type="button"
          className="s-btn s-btn--subtle com-hire"
          title={`Send ${designer.name} a hire request`}
          onClick={() => onHire(designer)}
        >
          Hire
        </button>
      </div>
    </article>
  )
}

type ProjectCardProps = {
  project: Project
  isLiked: boolean
  isSaved: boolean
  likeCount: number
  onToggleLike: (project: Project) => void
  onToggleSave: (project: Project) => void
}

function ProjectCard({
  project,
  isLiked,
  isSaved,
  likeCount,
  onToggleLike,
  onToggleSave,
}: ProjectCardProps) {
  const Glyph = GARMENT_GLYPHS[project.kind]

  return (
    <article className="com-proj">
      <div
        className={`com-proj__cover com-proj__cover--${project.tint} com-proj__cover--${project.size}`}
      >
        {project.tag && (
          <span
            className={`s-chip com-proj__tag ${
              project.tag === 'New' ? 's-chip--new' : 's-chip--accent'
            }`}
          >
            {project.tag !== 'New' && <IcoStar width="11" height="11" />}
            {project.tag}
          </span>
        )}
        <button
          type="button"
          className={`com-proj__save${isSaved ? ' is-saved' : ''}`}
          aria-pressed={isSaved}
          title={isSaved ? 'Remove from saved' : 'Save to your board'}
          onClick={() => onToggleSave(project)}
        >
          <IcoBookmark />
        </button>
        <span className="com-proj__glyph" aria-hidden="true">
          <Glyph width="96" height="96" />
        </span>
      </div>

      <div className="com-proj__body">
        <h3 className="com-proj__title">{project.title}</h3>
        <div className="com-proj__foot">
          <span className="com-author">
            <span className={`com-av com-av--sm ${project.grad}`}>{project.initials}</span>
            <span className="com-author__name">{project.author}</span>
          </span>
          <span className="com-proj__stats">
            <button
              type="button"
              className={`com-proj__stat com-proj__stat--like${isLiked ? ' is-liked' : ''}`}
              aria-pressed={isLiked}
              title={isLiked ? 'Unlike' : 'Like this project'}
              onClick={() => onToggleLike(project)}
            >
              {isLiked ? <IcoHeartFill /> : <IcoHeart />}
              {formatLikes(likeCount)}
            </button>
            <span className="com-proj__stat" title={`${project.views} views`}>
              <IcoEye width="13" height="13" />
              {project.views}
            </span>
          </span>
        </div>
      </div>
    </article>
  )
}

type CollectionCardProps = {
  collection: CommunityCollection
  isSaved: boolean
  onToggleSave: (collection: CommunityCollection) => void
}

function CollectionCard({ collection, isSaved, onToggleSave }: CollectionCardProps) {
  return (
    <article className="com-col">
      <div className="com-col__cover">
        <span className="s-chip com-col__season">{collection.season}</span>
        <div className="com-col__pieces">
          {collection.pieces.map((kind, i) => {
            const Glyph = GARMENT_GLYPHS[kind]
            return (
              <span className="com-col__piece" key={`${collection.id}-${kind}-${i}`}>
                <Glyph width="40" height="40" />
              </span>
            )
          })}
        </div>
      </div>
      <div className="com-col__body">
        <div className="com-col__head">
          <h3 className="com-col__title">{collection.name}</h3>
          <span className="com-col__cat">{collection.category}</span>
        </div>
        <div className="com-col__foot">
          <span className="com-author">
            <span className={`com-av com-av--sm ${collection.grad}`}>{collection.initials}</span>
            <span className="com-author__name">{collection.author}</span>
          </span>
          <button
            type="button"
            className={`com-col__save${isSaved ? ' is-saved' : ''}`}
            aria-pressed={isSaved}
            title={isSaved ? 'Remove from saved' : 'Save collection'}
            onClick={() => onToggleSave(collection)}
          >
            <IcoBookmark width={13} height={13} />
            {isSaved ? 'Saved' : collection.saves}
          </button>
        </div>
      </div>
    </article>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export function Community() {
  const { data } = useStore()
  const { user } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('Designers')
  const [category, setCategory] = useState<Category>('All')
  const [query, setQuery] = useState('')

  // Interaction state — lifted to the page so it survives tab / filter changes.
  const [followed, setFollowed] = useState<Set<string>>(() => new Set())
  const [liked, setLiked] = useState<Set<string>>(() => new Set())
  const [savedProjects, setSavedProjects] = useState<Set<string>>(() => new Set())
  const [savedCollections, setSavedCollections] = useState<Set<string>>(() => new Set())

  const q = query.trim().toLowerCase()
  const inCategory = (c: Exclude<Category, 'All'>) => category === 'All' || category === c

  const visibleDesigners = useMemo(
    () =>
      DESIGNERS.filter((dz) => {
        if (!inCategory(dz.category)) return false
        if (!q) return true
        return (
          dz.name.toLowerCase().includes(q) ||
          dz.role.toLowerCase().includes(q) ||
          dz.location.toLowerCase().includes(q) ||
          dz.category.toLowerCase().includes(q)
        )
      }),
    [q, category],
  )

  const visibleProjects = useMemo(
    () =>
      PROJECTS.filter((p) => {
        if (!inCategory(p.category)) return false
        if (!q) return true
        return (
          p.title.toLowerCase().includes(q) ||
          p.author.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        )
      }),
    [q, category],
  )

  // Real user-owned collections from the store, presented alongside curated ones.
  const myCollections = useMemo<CommunityCollection[]>(() => {
    if (!user) return []
    return data.collections
      .filter((c) => c.ownerId === user.id)
      .map((c) => {
        const pieces = data.designs
          .filter((dg) => dg.collectionId === c.id)
          .map((dg) => dg.kind)
        return {
          id: c.id,
          name: c.name,
          author: `${user.name} · You`,
          initials: initialsOf(user.name),
          grad: 'com-grad-1',
          category: 'Streetwear' as Exclude<Category, 'All'>,
          season: c.season,
          pieces: pieces.length ? pieces.slice(0, 3) : (['tee'] as GarmentKind[]),
          saves: '—',
        }
      })
  }, [data.collections, data.designs, user])

  const visibleCommunityCollections = useMemo(
    () =>
      COLLECTIONS.filter((c) => {
        if (!inCategory(c.category)) return false
        if (!q) return true
        return (
          c.name.toLowerCase().includes(q) ||
          c.author.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
        )
      }),
    [q, category],
  )

  /* ---- Handlers ---- */

  function toggleFollow(designer: Designer) {
    setFollowed((prev) => {
      const next = new Set(prev)
      if (next.has(designer.id)) next.delete(designer.id)
      else next.add(designer.id)
      return next
    })
    const nowFollowing = !followed.has(designer.id)
    toast(
      nowFollowing ? `Following ${designer.name}` : `Unfollowed ${designer.name}`,
      nowFollowing ? 'success' : 'default',
    )
  }

  function hire(designer: Designer) {
    toast(`Hire request sent to ${designer.name}`, 'accent')
  }

  function toggleLike(project: Project) {
    setLiked((prev) => {
      const next = new Set(prev)
      if (next.has(project.id)) next.delete(project.id)
      else next.add(project.id)
      return next
    })
    if (!liked.has(project.id)) toast('Added to your likes', 'accent')
  }

  function toggleSaveProject(project: Project) {
    setSavedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(project.id)) next.delete(project.id)
      else next.add(project.id)
      return next
    })
    toast(savedProjects.has(project.id) ? 'Removed from saved' : 'Saved to your board', 'info')
  }

  function toggleSaveCollection(collection: CommunityCollection) {
    setSavedCollections((prev) => {
      const next = new Set(prev)
      if (next.has(collection.id)) next.delete(collection.id)
      else next.add(collection.id)
      return next
    })
    toast(
      savedCollections.has(collection.id) ? 'Removed from saved' : `Saved “${collection.name}”`,
      'info',
    )
  }

  function shareWork() {
    toast('Upload started — pick files to publish to the community', 'accent')
  }

  function clearFilters() {
    setQuery('')
    setCategory('All')
  }

  const followCount = followed.size

  const actions = (
    <>
      <label className="com-search">
        <IcoSearch width="16" height="16" />
        <input
          type="text"
          placeholder="Search designers, drops…"
          aria-label="Search community"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd>/</kbd>
      </label>
      <button type="button" className="s-btn s-btn--accent" onClick={shareWork}>
        <IcoUpload width="16" height="16" /> Share your work
      </button>
    </>
  )

  const filterLabel = category === 'All' ? 'Across every category' : `Filtered by ${category}`
  const hasQuery = q.length > 0

  return (
    <SuitePage
      eyebrow="Community"
      title="Community"
      subtitle="Behance for fashion — discover top designers, browse trending drops and hire the makers behind them."
      actions={actions}
    >
      <div className="com-root">
        {/* Tabs + category filters */}
        <div className="com-tabsrow">
          <div className="s-tabs" role="tablist" aria-label="Community view">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`s-tab${tab === t ? ' is-active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="com-tags">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`s-filter${category === c ? ' is-active' : ''}`}
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {followCount > 0 && (
          <p className="com-followbar">
            <IcoUserPlus width={13} height={13} />
            You’re following <b>{followCount}</b> designer{followCount === 1 ? '' : 's'}.
          </p>
        )}

        {/* ============================ DESIGNERS ============================ */}
        {tab === 'Designers' && (
          <section className="com-sec" aria-labelledby="com-designers-h">
            <div className="com-sechead">
              <div>
                <h2 className="com-sechead__title" id="com-designers-h">
                  <span className="com-sec-ico">
                    <IcoCommunity width="15" height="15" />
                  </span>
                  Top designers
                </h2>
                <p className="com-sechead__sub">
                  {hasQuery || category !== 'All'
                    ? `${visibleDesigners.length} designer${visibleDesigners.length === 1 ? '' : 's'} match your filters`
                    : 'Verified makers shipping the most-loved work this month.'}
                </p>
              </div>
              <button type="button" className="s-link com-link" onClick={() => setTab('Trending')}>
                Browse trending work <IcoArrowRight width="13" height="13" />
              </button>
            </div>

            {visibleDesigners.length > 0 ? (
              <div className="com-scroller">
                {visibleDesigners.map((dz) => (
                  <DesignerCard
                    key={dz.id}
                    designer={dz}
                    isFollowing={followed.has(dz.id)}
                    onToggleFollow={toggleFollow}
                    onHire={hire}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<IcoCommunity width="22" height="22" />}
                title="No designers match"
                body="Try a different category or clear your search to see every maker."
                onClear={clearFilters}
              />
            )}
          </section>
        )}

        {/* =========================== COLLECTIONS =========================== */}
        {tab === 'Collections' && (
          <>
            {myCollections.length > 0 && (
              <section className="com-sec" aria-labelledby="com-mine-h">
                <div className="com-sechead">
                  <div>
                    <h2 className="com-sechead__title" id="com-mine-h">
                      <span className="com-sec-ico">
                        <IcoCollections width="15" height="15" />
                      </span>
                      Your collections
                    </h2>
                    <p className="com-sechead__sub">
                      Publish any of these to the community when you’re ready.
                    </p>
                  </div>
                </div>
                <div className="com-colgrid">
                  {myCollections.map((c) => (
                    <CollectionCard
                      key={c.id}
                      collection={c}
                      isSaved={savedCollections.has(c.id)}
                      onToggleSave={toggleSaveCollection}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="com-sec" aria-labelledby="com-collections-h">
              <div className="com-sechead">
                <div>
                  <h2 className="com-sechead__title" id="com-collections-h">
                    <span className="com-sec-ico">
                      <IcoCollections width="15" height="15" />
                    </span>
                    Featured collections
                  </h2>
                  <p className="com-sechead__sub">
                    {hasQuery || category !== 'All'
                      ? `${visibleCommunityCollections.length} collection${visibleCommunityCollections.length === 1 ? '' : 's'} match your filters`
                      : 'Curated capsule drops from makers across the community.'}
                  </p>
                </div>
                <button type="button" className="s-link com-link" onClick={() => setTab('Designers')}>
                  Meet the designers <IcoArrowRight width="13" height="13" />
                </button>
              </div>

              {visibleCommunityCollections.length > 0 ? (
                <div className="com-colgrid">
                  {visibleCommunityCollections.map((c) => (
                    <CollectionCard
                      key={c.id}
                      collection={c}
                      isSaved={savedCollections.has(c.id)}
                      onToggleSave={toggleSaveCollection}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<IcoCollections width="22" height="22" />}
                  title="No collections match"
                  body="Try a different category or clear your search to see every capsule."
                  onClear={clearFilters}
                />
              )}
            </section>
          </>
        )}

        {/* ============================ TRENDING ============================ */}
        {tab === 'Trending' && (
          <section className="com-sec" aria-labelledby="com-trending-h">
            <div className="com-sechead">
              <div>
                <h2 className="com-sechead__title" id="com-trending-h">
                  <span className="com-sec-ico">
                    <IcoTrend width="15" height="15" />
                  </span>
                  Trending projects
                </h2>
                <p className="com-sechead__sub">
                  {hasQuery || category !== 'All'
                    ? `${visibleProjects.length} project${visibleProjects.length === 1 ? '' : 's'} match your filters`
                    : `${filterLabel} · updated hourly`}
                </p>
              </div>
              <button type="button" className="s-link com-link" onClick={() => setTab('Collections')}>
                Browse collections <IcoArrowRight width="13" height="13" />
              </button>
            </div>

            {visibleProjects.length > 0 ? (
              <div className="com-gallery">
                {visibleProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    isLiked={liked.has(p.id)}
                    isSaved={savedProjects.has(p.id)}
                    likeCount={p.likes + (liked.has(p.id) ? 1 : 0)}
                    onToggleLike={toggleLike}
                    onToggleSave={toggleSaveProject}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<IcoTrend width="22" height="22" />}
                title="No projects match"
                body="Try a different category or clear your search to see the full gallery."
                onClear={clearFilters}
              />
            )}
          </section>
        )}
      </div>
    </SuitePage>
  )
}

/* -------------------------------------------------------------------------- */
/*  Empty state                                                                */
/* -------------------------------------------------------------------------- */

type EmptyStateProps = {
  icon: ReactNode
  title: string
  body: string
  onClear: () => void
}

function EmptyState({ icon, title, body, onClear }: EmptyStateProps) {
  return (
    <div className="com-empty">
      <span className="com-empty__ico" aria-hidden="true">
        {icon}
      </span>
      <h3 className="com-empty__title">{title}</h3>
      <p className="com-empty__body">{body}</p>
      <button type="button" className="s-btn s-btn--subtle" onClick={onClear}>
        Clear filters
      </button>
    </div>
  )
}
