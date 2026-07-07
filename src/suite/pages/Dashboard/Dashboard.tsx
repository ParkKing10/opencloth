import { useNavigate } from 'react-router-dom'
import {
  IcoArrowRight,
  IcoPlus,
  IcoUpload,
  IcoAI,
  IcoTechPack,
  IcoSparkle,
  IcoDots,
  IcoCheck,
  IcoFactory,
  IcoProduction,
  IcoCollections,
} from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import { ProgressChart } from './ProgressChart'
import './dashboard.css'

const STATS = [
  { label: 'Designs', value: '47', delta: '+12%' },
  { label: 'Collections', value: '8', delta: '+2' },
  { label: 'Tech Packs', value: '23', delta: '+8%' },
  { label: 'Manufacturers', value: '12', delta: '+3' },
  { label: 'Production', value: '7', delta: '+16%' },
]

type Project = { name: string; kind: GarmentKind; progress: number; updated: string; team: string[] }
const PROJECTS: Project[] = [
  { name: 'Vintage Washed Hoodie', kind: 'hoodie', progress: 82, updated: '2h ago', team: ['MC', 'JD', 'AL'] },
  { name: 'Oversized Street Tee', kind: 'tee', progress: 64, updated: '1d ago', team: ['MC', 'KP'] },
  { name: 'Cargo Pocket Jacket', kind: 'jacket', progress: 38, updated: '2d ago', team: ['MC', 'JD'] },
]

const AI_SUGGESTIONS = [
  'Oversized Hoodie',
  'Luxury Collection',
  'Vintage Wash',
  'Sportswear Collection',
  'Streetwear Drop',
]

const QUICK_ACTIONS = [
  { icon: IcoPlus, title: 'Create New Design', sub: 'Start from scratch', to: '/suite/design' },
  { icon: IcoUpload, title: 'Upload Design', sub: 'Import your artwork', to: '/suite/design' },
  { icon: IcoAI, title: 'AI Design Generator', sub: 'Generate with AI', to: '/suite/ai' },
  { icon: IcoTechPack, title: 'Create Tech Pack', sub: 'Auto-generate tech pack', to: '/suite/tech-packs' },
]

type Activity = { icon: typeof IcoCheck; tone: string; text: string; meta: string; time: string }
const ACTIVITY: Activity[] = [
  { icon: IcoTechPack, tone: 'accent', text: 'Tech Pack created', meta: 'Vintage Washed Hoodie', time: '2h' },
  { icon: IcoFactory, tone: 'info', text: 'Manufacturer matched', meta: '3 factories for Oversized Tee', time: '5h' },
  { icon: IcoCheck, tone: 'good', text: 'Sample approved', meta: 'Cargo Pocket Jacket', time: '1d' },
  { icon: IcoCollections, tone: 'accent', text: 'Collection published', meta: 'SS26 — Concrete Series', time: '2d' },
  { icon: IcoProduction, tone: 'warn', text: 'Production started', meta: 'Baggy Cargo Pants ×250', time: '3d' },
]

function Avatar({ initials }: { initials: string }) {
  return <span className="dash-av">{initials}</span>
}

export function Dashboard() {
  const navigate = useNavigate()

  return (
    <div className="dash">
      {/* ---- Hero ---- */}
      <section className="dash-hero">
        <div>
          <p className="dash-hero__eyebrow">Good evening</p>
          <h1 className="dash-hero__title">Welcome back, Mike.</h1>
          <p className="dash-hero__sub">Continue working on your brand — 3 projects in progress.</p>
        </div>
        <button className="dash-hero__cta" type="button" onClick={() => navigate('/suite/design')}>
          <span className="dash-hero__cta-thumb" aria-hidden="true">
            <GARMENT_GLYPHS.hoodie width="26" height="26" />
          </span>
          <span className="dash-hero__cta-text">
            <span>Continue project</span>
            <small>Vintage Washed Hoodie</small>
          </span>
          <IcoArrowRight width="18" height="18" />
        </button>
      </section>

      {/* ---- Quick stats ---- */}
      <section className="dash-stats">
        {STATS.map((s) => (
          <article className="dash-stat" key={s.label}>
            <span className="dash-stat__label">{s.label}</span>
            <span className="dash-stat__row">
              <span className="dash-stat__value">{s.value}</span>
              <span className="s-delta">{s.delta}</span>
            </span>
          </article>
        ))}
      </section>

      {/* ---- Two-column body ---- */}
      <div className="dash-grid">
        <div className="dash-col">
          {/* Continue working */}
          <section>
            <div className="s-section-head">
              <h2 className="s-section-title">Continue working</h2>
              <a className="s-link" href="/suite/collections">
                View all <IcoArrowRight width="13" height="13" />
              </a>
            </div>
            <div className="dash-projects">
              {PROJECTS.map((p) => {
                const Glyph = GARMENT_GLYPHS[p.kind]
                return (
                  <article className="proj" key={p.name} onClick={() => navigate('/suite/design')}>
                    <div className="proj__preview">
                      <Glyph width="46" height="46" />
                    </div>
                    <div className="proj__body">
                      <div className="proj__head">
                        <h3 className="proj__name">{p.name}</h3>
                        <button
                          className="proj__more"
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="More"
                        >
                          <IcoDots width="16" height="16" />
                        </button>
                      </div>
                      <div className="proj__bar">
                        <span style={{ width: `${p.progress}%` }} />
                      </div>
                      <div className="proj__meta">
                        <span>{p.progress}% complete</span>
                        <span className="proj__team">
                          {p.team.map((t) => (
                            <Avatar key={t} initials={t} />
                          ))}
                        </span>
                      </div>
                      <div className="proj__foot">
                        <span className="proj__updated">Updated {p.updated}</span>
                        <span className="proj__open">
                          Open <IcoArrowRight width="12" height="12" />
                        </span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          {/* Progress chart */}
          <section className="dash-progress s-panel">
            <div className="s-section-head">
              <div>
                <h2 className="s-section-title">Your progress</h2>
                <p className="dash-progress__sub">Designs & tech packs over time</p>
              </div>
              <button className="dash-select" type="button">
                Last 30 days <IcoArrowRight width="12" height="12" style={{ transform: 'rotate(90deg)' }} />
              </button>
            </div>
            <ProgressChart />
          </section>

          {/* Activity */}
          <section>
            <div className="s-section-head">
              <h2 className="s-section-title">Recent activity</h2>
              <a className="s-link" href="/suite/analytics">
                View all <IcoArrowRight width="13" height="13" />
              </a>
            </div>
            <div className="dash-activity s-panel">
              {ACTIVITY.map((a, i) => (
                <div className="act" key={i}>
                  <span className={`act__ico act__ico--${a.tone}`}>
                    <a.icon width="15" height="15" />
                  </span>
                  <span className="act__text">
                    <b>{a.text}</b>
                    <span className="act__meta">{a.meta}</span>
                  </span>
                  <span className="act__time">{a.time}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ---- Right rail ---- */}
        <aside className="dash-rail">
          {/* AI assistant */}
          <section className="ai-card">
            <div className="ai-card__glow" aria-hidden="true" />
            <span className="s-chip s-chip--accent">
              <IcoSparkle width="12" height="12" /> AI Assistant
            </span>
            <h3 className="ai-card__title">What would you like to create today?</h3>
            <div className="ai-card__chips">
              {AI_SUGGESTIONS.map((s) => (
                <button className="ai-chip" type="button" key={s} onClick={() => navigate('/suite/ai')}>
                  {s}
                </button>
              ))}
            </div>
            <button className="s-btn s-btn--accent ai-card__go" type="button" onClick={() => navigate('/suite/ai')}>
              <IcoSparkle width="16" height="16" /> Generate with AI
            </button>
          </section>

          {/* Quick actions */}
          <section className="s-panel rail-panel">
            <div className="s-section-head">
              <h2 className="s-section-title">Quick actions</h2>
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
                  <small>3 manufacturers found for “Oversized Street Tee”.</small>
                </span>
                <span className="notif__time">5h</span>
              </div>
              <div className="notif">
                <span className="notif__dot" style={{ background: 'var(--s-good)' }} />
                <span className="notif__text">
                  <b>Sample approved</b>
                  <small>Your sample for “Cargo Pocket Jacket” is approved.</small>
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
