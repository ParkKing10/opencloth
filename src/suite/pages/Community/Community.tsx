import { useState } from 'react'
import { SuitePage } from '../_shared/SuitePage'
import {
  IcoSearch,
  IcoUpload,
  IcoCheck,
  IcoEye,
  IcoStar,
  IcoArrowRight,
  IcoTrend,
  IcoCommunity,
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

/* -------------------------------------------------------------------------- */
/*  Mock data                                                                  */
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
    tint: 'b',
    size: 'short',
    likes: 703,
    views: '10.6k',
  },
]

function formatLikes(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function DesignerCard({ designer }: { designer: Designer }) {
  const [isFollowing, setIsFollowing] = useState(false)
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
          onClick={() => setIsFollowing((v) => !v)}
        >
          {isFollowing ? (
            <>
              <IcoCheck width="14" height="14" /> Following
            </>
          ) : (
            'Follow'
          )}
        </button>
        <button type="button" className="s-btn s-btn--subtle com-hire">
          Hire
        </button>
      </div>
    </article>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const Glyph = GARMENT_GLYPHS[project.kind]
  const likeCount = project.likes + (isLiked ? 1 : 0)

  return (
    <button type="button" className="com-proj">
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
        <span
          className={`com-proj__save${isSaved ? ' is-saved' : ''}`}
          role="button"
          tabIndex={-1}
          aria-label={isSaved ? 'Saved' : 'Save project'}
          onClick={(e) => {
            e.stopPropagation()
            setIsSaved((v) => !v)
          }}
        >
          <IcoBookmark />
        </span>
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
            <span
              className={`com-proj__stat com-proj__stat--like${isLiked ? ' is-liked' : ''}`}
              role="button"
              tabIndex={-1}
              aria-label={isLiked ? 'Unlike' : 'Like'}
              onClick={(e) => {
                e.stopPropagation()
                setIsLiked((v) => !v)
              }}
            >
              {isLiked ? <IcoHeartFill /> : <IcoHeart />}
              {formatLikes(likeCount)}
            </span>
            <span className="com-proj__stat">
              <IcoEye width="13" height="13" />
              {project.views}
            </span>
          </span>
        </div>
      </div>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export function Community() {
  const [tab, setTab] = useState<Tab>('Designers')
  const [category, setCategory] = useState<Category>('All')

  const actions = (
    <>
      <label className="com-search">
        <IcoSearch width="16" height="16" />
        <input type="text" placeholder="Search designers, drops…" aria-label="Search community" />
        <kbd>/</kbd>
      </label>
      <button type="button" className="s-btn s-btn--accent">
        <IcoUpload width="16" height="16" /> Share your work
      </button>
    </>
  )

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
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* ---- Top designers ---- */}
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
                Verified makers shipping the most-loved work this month.
              </p>
            </div>
            <a className="s-link" href="/suite/community">
              Browse all <IcoArrowRight width="13" height="13" />
            </a>
          </div>

          <div className="com-scroller">
            {DESIGNERS.map((d) => (
              <DesignerCard key={d.id} designer={d} />
            ))}
          </div>
        </section>

        {/* ---- Trending projects ---- */}
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
                {category === 'All' ? 'Across every category' : `Filtered by ${category}`} · updated
                hourly
              </p>
            </div>
            <a className="s-link" href="/suite/community">
              View gallery <IcoArrowRight width="13" height="13" />
            </a>
          </div>

          <div className="com-gallery">
            {PROJECTS.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      </div>
    </SuitePage>
  )
}
