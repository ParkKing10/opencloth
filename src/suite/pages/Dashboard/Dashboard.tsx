import { useNavigate } from 'react-router-dom'
import { IcoArrowRight, IcoPlus, IcoUpload, IcoAI, IcoTechPack } from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { PatternWireframe, TechPackFlats, GlobePins } from './FeatureArt'
import teeImg from '../../../assets/cards/tee.png'
import hoodieImg from '../../../assets/cards/hoodie.png'
import './dashboard.css'

type ArtKind = 'tee' | 'hoodie' | 'pattern' | 'techpack' | 'globe'
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
    title: 'Pattern Studio',
    desc: 'Edit patterns, seams and every detail of your garment.',
    cta: 'Edit Patterns',
    to: '/suite/pattern',
    tint: 'slate',
    art: 'pattern',
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
    case 'pattern':
      return <PatternWireframe />
    case 'techpack':
      return <TechPackFlats />
    case 'globe':
      return <GlobePins />
  }
}

type Design = { name: string; kind: GarmentKind; modified: string }
const RECENT_DESIGNS: Design[] = [
  { name: 'Vintage Washed Hoodie', kind: 'hoodie', modified: '2h ago' },
  { name: 'Oversized Street Tee', kind: 'tee', modified: '1d ago' },
  { name: 'Cargo Pocket Jacket', kind: 'jacket', modified: '2d ago' },
  { name: 'Baggy Cargo Pants', kind: 'pants', modified: '3d ago' },
  { name: 'Washed Cap', kind: 'cap', modified: '4d ago' },
]

const QUICK_ACTIONS = [
  { icon: IcoPlus, title: 'Create New Design', sub: 'Start from scratch', to: '/suite/design' },
  { icon: IcoUpload, title: 'Upload Design', sub: 'Import your artwork', to: '/suite/design' },
  { icon: IcoAI, title: 'AI Design Generator', sub: 'Generate with AI', to: '/suite/ai' },
  { icon: IcoTechPack, title: 'Create Tech Pack', sub: 'Auto-generate tech pack', to: '/suite/tech-packs' },
]

const RECENT_TECH_PACKS = [
  { name: 'Vintage Washed Hoodie', time: '2h ago' },
  { name: 'Oversized Street Tee', time: '1d ago' },
  { name: 'Cargo Pocket Jacket', time: '2d ago' },
  { name: 'Baggy Cargo Pants', time: '3d ago' },
]

export function Dashboard() {
  const navigate = useNavigate()

  return (
    <div className="dash">
      <div className="dash-grid">
        <div className="dash-main">
          {/* Hero */}
          <header className="dash-hero">
            <h1 className="dash-hero__title">
              Welcome back, Mike <span className="dash-hero__wave">👋</span>
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
              <a className="s-link" href="/suite/collections">
                View all <IcoArrowRight width="13" height="13" />
              </a>
            </div>
            <div className="dash-designs">
              {RECENT_DESIGNS.map((d) => {
                const Glyph = GARMENT_GLYPHS[d.kind]
                return (
                  <article className="design" key={d.name} onClick={() => navigate('/suite/design')}>
                    <div className="design__preview">
                      <Glyph width="52" height="52" />
                    </div>
                    <div className="design__meta">
                      <span className="design__name">{d.name}</span>
                      <span className="design__mod">Modified {d.modified}</span>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </div>

        {/* ---- Right rail ---- */}
        <aside className="dash-rail">
          <section className="s-panel rail-panel">
            <div className="s-section-head">
              <h2 className="s-section-title">Quick Actions</h2>
            </div>
            <div className="qa-list">
              {QUICK_ACTIONS.map((q) => (
                <button className="qa" type="button" key={q.title} onClick={() => navigate(q.to)}>
                  <span className="qa__ico">
                    <q.icon width="18" height="18" />
                  </span>
                  <span className="qa__text">
                    <b>{q.title}</b>
                    <small>{q.sub}</small>
                  </span>
                  <IcoArrowRight className="qa__chev" width="15" height="15" />
                </button>
              ))}
            </div>
          </section>

          <section className="s-panel rail-panel">
            <div className="s-section-head">
              <h2 className="s-section-title">Recent Tech Packs</h2>
              <a className="s-link" href="/suite/tech-packs">
                View all
              </a>
            </div>
            <div className="dtp-list">
              {RECENT_TECH_PACKS.map((t) => (
                <button className="dtp-row" type="button" key={t.name} onClick={() => navigate('/suite/tech-packs')}>
                  <span className="dtp-row__ico">
                    <IcoTechPack width="16" height="16" />
                  </span>
                  <span className="dtp-row__text">
                    <b>{t.name}</b>
                    <small>Created {t.time}</small>
                  </span>
                  <span className="s-dot" style={{ background: 'var(--s-good)' }} />
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
