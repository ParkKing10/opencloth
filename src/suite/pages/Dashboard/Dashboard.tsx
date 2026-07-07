import { useNavigate } from 'react-router-dom'
import {
  IcoArrowRight,
  IcoPlus,
  IcoUpload,
  IcoAI,
  IcoDesign,
  IcoPattern,
  IcoTechPack,
  IcoFactory,
  IcoTrend,
} from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { ProgressChart } from './ProgressChart'
import './dashboard.css'

type Feature = {
  icon: typeof IcoDesign
  title: string
  desc: string
  cta: string
  to: string
  isNew?: boolean
  primary?: boolean
}

const FEATURES: Feature[] = [
  {
    icon: IcoDesign,
    title: 'Design Studio',
    desc: 'Create new designs with our easy drag & drop editor.',
    cta: 'Start Designing',
    to: '/suite/design',
    primary: true,
  },
  {
    icon: IcoPattern,
    title: 'Pattern Studio',
    desc: 'Edit patterns, seams and every detail of your garment.',
    cta: 'Edit Patterns',
    to: '/suite/pattern',
  },
  {
    icon: IcoAI,
    title: 'AI Designer',
    desc: 'Generate unique designs with the power of AI.',
    cta: 'Generate',
    to: '/suite/ai',
    isNew: true,
  },
  {
    icon: IcoTechPack,
    title: 'Tech Pack',
    desc: 'Create professional tech packs ready for manufacturing.',
    cta: 'Create Tech Pack',
    to: '/suite/tech-packs',
  },
  {
    icon: IcoFactory,
    title: 'Manufacturer Hub',
    desc: 'Find the best manufacturers for your products.',
    cta: 'Find Manufacturers',
    to: '/suite/manufacturers',
  },
]

type Design = { name: string; kind: GarmentKind; modified: string }
const RECENT_DESIGNS: Design[] = [
  { name: 'Vintage Washed Hoodie', kind: 'hoodie', modified: '2h ago' },
  { name: 'Oversized Street Tee', kind: 'tee', modified: '1d ago' },
  { name: 'Cargo Pocket Jacket', kind: 'jacket', modified: '2d ago' },
  { name: 'Baggy Cargo Pants', kind: 'pants', modified: '3d ago' },
  { name: 'Washed Cap', kind: 'cap', modified: '4d ago' },
]

type Stat = { icon: typeof IcoDesign; label: string; value: string; delta: string }
const PROGRESS_STATS: Stat[] = [
  { icon: IcoDesign, label: 'Designs Created', value: '47', delta: '+12%' },
  { icon: IcoTechPack, label: 'Tech Packs', value: '23', delta: '+8%' },
  { icon: IcoFactory, label: 'Samples Ordered', value: '12', delta: '+5%' },
  { icon: IcoTrend, label: 'Production Orders', value: '7', delta: '+16%' },
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
      {/* ---- Body: main + rail ---- */}
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
                className={`feat${f.primary ? ' feat--primary' : ''}`}
                onClick={() => navigate(f.to)}
              >
                <div className="feat__top">
                  <span className="feat__icon">
                    <f.icon width="20" height="20" />
                  </span>
                  {f.isNew && <span className="feat__new">NEW</span>}
                </div>
                <h3 className="feat__title">{f.title}</h3>
                <p className="feat__desc">{f.desc}</p>
                <button
                  className={`feat__cta${f.primary ? ' feat__cta--primary' : ''}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(f.to)
                  }}
                >
                  {f.cta} <IcoArrowRight width="14" height="14" />
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

          {/* Your progress */}
          <section className="dash-progress s-panel">
            <div className="s-section-head">
              <h2 className="s-section-title">Your Progress</h2>
              <button className="dash-select" type="button">
                Last 30 days <IcoArrowRight width="12" height="12" style={{ transform: 'rotate(90deg)' }} />
              </button>
            </div>
            <div className="dash-progress__stats">
              {PROGRESS_STATS.map((s) => (
                <div className="pstat" key={s.label}>
                  <div className="pstat__head">
                    <span className="pstat__label">{s.label}</span>
                    <span className="pstat__ico">
                      <s.icon width="15" height="15" />
                    </span>
                  </div>
                  <div className="pstat__row">
                    <span className="pstat__value">{s.value}</span>
                    <span className="s-delta">
                      <IcoTrend width="12" height="12" /> {s.delta}
                    </span>
                  </div>
                  <span className="pstat__note">vs last 30 days</span>
                </div>
              ))}
            </div>
            <ProgressChart />
          </section>
        </div>

        {/* ---- Right rail ---- */}
        <aside className="dash-rail">
          {/* Quick actions */}
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

          {/* Recent tech packs */}
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

          {/* Notifications */}
          <section className="s-panel rail-panel">
            <div className="s-section-head">
              <h2 className="s-section-title">Notifications</h2>
              <a className="s-link" href="#">
                View all
              </a>
            </div>
            <div className="notif-list">
              <div className="notif">
                <span className="notif__dot" style={{ background: 'var(--s-accent)' }} />
                <span className="notif__text">
                  <b>Your tech pack is ready</b>
                  <small>Vintage Washed Hoodie tech pack has been generated.</small>
                </span>
                <span className="notif__time">2h</span>
              </div>
              <div className="notif">
                <span className="notif__dot" style={{ background: 'var(--s-info)' }} />
                <span className="notif__text">
                  <b>Manufacturer matched</b>
                  <small>We found 3 manufacturers for your design “Oversized Street Tee”.</small>
                </span>
                <span className="notif__time">5h</span>
              </div>
              <div className="notif">
                <span className="notif__dot" style={{ background: 'var(--s-good)' }} />
                <span className="notif__text">
                  <b>Sample approved</b>
                  <small>Your sample for “Cargo Pocket Jacket” has been approved.</small>
                </span>
                <span className="notif__time">1d</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
