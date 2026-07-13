import { useNavigate } from 'react-router-dom'
import { IcoArrowRight, IcoPlus } from '../../components/ui/Icons'
import { GARMENT_GLYPHS } from '../../components/ui/Garments'
import { TechPackFlats, GlobePins, ShopArt } from './FeatureArt'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { relativeTime } from '../../data/utils'
import { loadDesignThumb } from '../../data/designThumbs'
import teeImg from '../../../assets/cards/tee.png'
import hoodieImg from '../../../assets/cards/hoodie.png'
import avatar1 from '../../../assets/avatars/1.jpg'
import avatar2 from '../../../assets/avatars/2.jpg'
import avatar3 from '../../../assets/avatars/3.jpg'
import avatar4 from '../../../assets/avatars/4.jpg'
import './dashboard.css'

const HERO_AVATARS = [avatar1, avatar2, avatar3, avatar4]

type ArtKind = 'tee' | 'hoodie' | 'techpack' | 'globe' | 'shop'
type Tint = 'violet' | 'slate' | 'blue' | 'teal' | 'amber'

type Feature = {
  title: string
  desc: string
  cta: string
  to: string
  tint: Tint
  art: ArtKind
  isNew?: boolean
  primary?: boolean
}

const FEATURES: Feature[] = [
  {
    title: 'Design Studio',
    desc: 'Create new designs with our easy drag & drop editor.',
    cta: 'Start Designing',
    to: '/suite/design',
    tint: 'violet',
    art: 'tee',
    primary: true,
  },
  {
    title: 'Garments Studio',
    desc: 'Build fully editable garments with real region layers.',
    cta: 'Open Studio',
    to: '/suite/garments',
    tint: 'slate',
    art: 'techpack',
  },
  {
    title: 'AI Designer',
    desc: 'Generate unique designs with the power of AI.',
    cta: 'Generate',
    to: '/suite/ai',
    tint: 'blue',
    art: 'hoodie',
    isNew: true,
  },
  {
    title: 'Garment Shop',
    desc: 'Buy premium editable garments with coins and design on them.',
    cta: 'Open Shop',
    to: '/suite/shop',
    tint: 'teal',
    art: 'shop',
  },
  {
    title: 'Manufacturer Hub',
    desc: 'Find the best manufacturers for your products.',
    cta: 'Find Manufacturers',
    to: '/suite/manufacturers',
    tint: 'amber',
    art: 'globe',
  },
]

// Decorative hero showcase content (the floating Layers/Colors panel + mini toolbar).
const HERO_LAYERS = ['Front Design', 'Back Design', 'Left Sleeve', 'Right Sleeve', 'Hood', 'Pocket']
const HERO_COLORS = ['#c9f24f', '#d7d7dc', '#8b8b93', '#2b2b52', '#6b4de6']
const HERO_TOOLS = [
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M4 3l7 17 2.5-6.5L20 11z" /></svg>,
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20M12 2l-3 3m3-3l3 3M12 22l-3-3m3 3l3-3M2 12l3-3m-3 3l3 3M22 12l-3-3m3 3l-3 3" /></svg>,
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-1.5M2 2l7.5 7.5M2 2l3 8 3-3z" /></svg>,
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V5h16v2M9 5v14M7 19h4" /></svg>,
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>,
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>,
]

function FeatureArt({ art }: { art: ArtKind }) {
  switch (art) {
    case 'tee':
      return <img className="feat-art__img" src={teeImg} alt="" loading="lazy" />
    case 'hoodie':
      return <img className="feat-art__img" src={hoodieImg} alt="" loading="lazy" />
    case 'techpack':
      return <TechPackFlats />
    case 'globe':
      return <GlobePins />
    case 'shop':
      return <ShopArt />
  }
}

const RECENT_LIMIT = 12

export function Dashboard() {
  const navigate = useNavigate()
  const { data } = useStore()
  const { user } = useAuth()
  const toast = useToast()

  // Real designs, scoped to the current user. When the user owns none, fall
  // back to showing all designs so the dashboard never looks empty for a fresh
  // demo account — but still surface an empty state when there are truly none.
  const ownDesigns = user ? data.designs.filter((d) => d.ownerId === user.id) : []
  const source = ownDesigns.length > 0 ? ownDesigns : data.designs
  const recentDesigns = [...source].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, RECENT_LIMIT)

  return (
    <div className="dash">
      <div className="dash-grid">
        <div className="dash-main">
          {/* Hero — Design Studio showcase */}
          <header className="dash-hero">
            <div className="dash-hero__glow" aria-hidden="true" />
            <div className="dash-hero__grid" aria-hidden="true" />
            <div className="dash-hero__left">
              <span className="dash-hero__kicker">
                <span className="dash-hero__kicker-mark" aria-hidden="true" />
                Design Studio
              </span>
              <h1 className="dash-hero__headline">
                Design without<br />
                <span className="dash-hero__headline-accent">limits.</span>
              </h1>
              <p className="dash-hero__tagline">Create. Customize. Launch.</p>
              <div className="dash-hero__cta">
                <button type="button" className="dash-hero__start" onClick={() => navigate('/suite/design')}>
                  Start Designing <IcoArrowRight width="16" height="16" />
                </button>
                <button type="button" className="dash-hero__demo" onClick={() => toast('A product walkthrough is coming soon.', 'info')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                  Watch Demo
                </button>
              </div>
              <div className="dash-hero__social">
                <div className="dash-hero__avatars" aria-hidden="true">
                  {HERO_AVATARS.map((src, i) => (
                    <img key={i} className="dash-hero__avatar" src={src} alt="" loading="lazy" />
                  ))}
                </div>
                <p className="dash-hero__social-text">
                  Join <b>12,400+</b> designers<br />building the future of fashion
                </p>
              </div>
            </div>

            <div className="dash-hero__stage">
              <img className="dash-hero__product" src={hoodieImg} alt="" loading="lazy" />
              <div className="dash-hero__tools" aria-hidden="true">
                {HERO_TOOLS.map((t, i) => (
                  <span key={i} className={`dash-hero__tool${i === 0 ? ' is-active' : ''}`}>{t}</span>
                ))}
              </div>
              <div className="dash-hero__panel" aria-hidden="true">
                <span className="dash-hero__panel-head">Layers</span>
                <ul className="dash-hero__layers">
                  {HERO_LAYERS.map((l) => (
                    <li key={l}>
                      <span className="dash-hero__layer-name">{l}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.6" /></svg>
                    </li>
                  ))}
                </ul>
                <span className="dash-hero__panel-head">Colors</span>
                <div className="dash-hero__swatches">
                  {HERO_COLORS.map((c) => (
                    <span key={c} className="dash-hero__swatch" style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
          </header>

          {/* Feature cards */}
          <section className="dash-features">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className={`feat feat--${f.tint}${f.primary ? ' feat--primary' : ''}`}
                onClick={() => navigate(f.to)}
              >
                <div className="feat__art">
                  <FeatureArt art={f.art} />
                </div>
                <div className="feat__overlay" aria-hidden="true" />

                <div className="feat__copy">
                  <div className="feat__title-row">
                    <h3 className="feat__title">{f.title}</h3>
                    {f.isNew && <span className="feat__new">NEW</span>}
                  </div>
                  <p className="feat__desc">{f.desc}</p>
                </div>

                <button
                  className={`feat__cta${f.primary ? ' feat__cta--primary' : ''}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(f.to)
                  }}
                >
                  {f.cta} <IcoArrowRight width="15" height="15" />
                </button>
              </article>
            ))}
          </section>

          {/* Recent designs */}
          <section>
            <div className="s-section-head">
              <h2 className="s-section-title">Recent Designs</h2>
              {recentDesigns.length > 0 && (
                <button
                  className="s-link"
                  type="button"
                  onClick={() => navigate('/suite/collections')}
                >
                  View all <IcoArrowRight width="13" height="13" />
                </button>
              )}
            </div>

            {recentDesigns.length > 0 ? (
              <div className="dash-designs">
                {recentDesigns.map((d) => {
                  const Glyph = GARMENT_GLYPHS[d.kind]
                  const thumb = loadDesignThumb(d.id)
                  return (
                    <article
                      className="design"
                      key={d.id}
                      title={`Open ${d.name} in the Design Studio`}
                      onClick={() => navigate(`/suite/studio?garment=${encodeURIComponent(d.id)}&name=${encodeURIComponent(d.name)}`)}
                    >
                      <div className={`design__preview${thumb ? ' design__preview--img' : ''}`}>
                        {thumb ? (
                          <img src={thumb} alt={`${d.name} preview`} loading="lazy" />
                        ) : (
                          <Glyph width="52" height="52" />
                        )}
                      </div>
                      <div className="design__meta">
                        <span className="design__name">{d.name}</span>
                        <span className="design__mod">
                          <Glyph width="13" height="13" />
                          <span className="design__type">{d.kind}</span>
                          <span className="design__dot">·</span>
                          <span>{relativeTime(d.updatedAt)}</span>
                        </span>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="page-empty dash-empty">
                <div className="page-empty__ico">
                  <IcoPlus width="24" height="24" />
                </div>
                <h3>No designs yet</h3>
                <p>Your recent designs will show up here. Start your first one to get going.</p>
                <button
                  className="s-btn s-btn--accent dash-empty__cta"
                  type="button"
                  onClick={() => navigate('/suite/design')}
                >
                  <IcoPlus width="15" height="15" /> Create your first design
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
