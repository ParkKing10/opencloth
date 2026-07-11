import { useNavigate } from 'react-router-dom'
import { IcoArrowRight, IcoPlus } from '../../components/ui/Icons'
import { GARMENT_GLYPHS } from '../../components/ui/Garments'
import { TechPackFlats, GlobePins } from './FeatureArt'
import { useStore } from '../../data/store'
import { useAuth } from '../../auth/auth'
import { relativeTime } from '../../data/utils'
import { loadDesignThumb } from '../../data/designThumbs'
import teeImg from '../../../assets/cards/tee.png'
import hoodieImg from '../../../assets/cards/hoodie.png'
import './dashboard.css'

type ArtKind = 'tee' | 'hoodie' | 'techpack' | 'globe'
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
    title: 'AI Designer',
    desc: 'Generate unique designs with the power of AI.',
    cta: 'Generate',
    to: '/suite/ai',
    tint: 'blue',
    art: 'hoodie',
    isNew: true,
  },
  {
    title: 'Tech Pack',
    desc: 'Create professional tech packs ready for manufacturing.',
    cta: 'Create Tech Pack',
    to: '/suite/tech-packs',
    tint: 'teal',
    art: 'techpack',
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
  }
}

const RECENT_LIMIT = 5

export function Dashboard() {
  const navigate = useNavigate()
  const { data } = useStore()
  const { user } = useAuth()

  const firstName = user?.name.split(' ')[0] ?? 'there'

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
          {/* Hero */}
          <header className="dash-hero">
            <h1 className="dash-hero__title">
              Welcome back, {firstName} <span className="dash-hero__wave">👋</span>
            </h1>
            <p className="dash-hero__sub">Let's bring your next collection to life.</p>
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
                      onClick={() => navigate(`/suite/design?garment=${encodeURIComponent(d.id)}&name=${encodeURIComponent(d.name)}`)}
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
                        <span className="design__mod">Modified {relativeTime(d.updatedAt)}</span>
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
