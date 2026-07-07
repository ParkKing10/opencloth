import { useNavigate } from 'react-router-dom'
import { IcoArrowRight } from '../../components/ui/Icons'
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
      </div>
    </div>
  )
}
