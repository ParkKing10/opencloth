import { useState, type CSSProperties, type SVGProps } from 'react'
import { SuitePage } from '../_shared/SuitePage'
import { useAuth } from '../../auth/auth'
import { useToast } from '../../components/ui/Toast'
import { useT } from '@/i18n'
import { IcoSparkle, IcoCheck, IcoArrowRight, IcoStar } from '../../components/ui/Icons'
import './mk.css'

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

const svg = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})
const IcoStore = (p: SVGProps<SVGSVGElement>) => (
  <svg {...svg(p)}><path d="M3 9l1.5-5h15L21 9M4 9v10h16V9M4 9h16M9 19v-6h6v6" /></svg>
)
const IcoPalette = (p: SVGProps<SVGSVGElement>) => (
  <svg {...svg(p)}><path d="M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-1.3-1-1.8-1-2.9 0-.8.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7Z" /><circle cx="7.5" cy="10.5" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" /><circle cx="16.5" cy="10.5" r="1" fill="currentColor" stroke="none" /></svg>
)
const IcoMail = (p: SVGProps<SVGSVGElement>) => (
  <svg {...svg(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
)
const IcoPlay = (p: SVGProps<SVGSVGElement>) => (
  <svg {...svg(p)}><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" stroke="none" /></svg>
)
const IcoTrend = (p: SVGProps<SVGSVGElement>) => (
  <svg {...svg(p)}><path d="M3 17l6-6 4 4 8-8M21 7v5m0-5h-5" /></svg>
)

const PKG_ICONS: Record<string, (p: SVGProps<SVGSVGElement>) => JSX.Element> = {
  store: IcoStore,
  brand: IcoPalette,
  mail: IcoMail,
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

type Track = 'packages' | 'academy' | 'grow'
const TRACKS: { id: Track; labelKey: string }[] = [
  { id: 'packages', labelKey: 'marketplace.tab.packages' },
  { id: 'academy', labelKey: 'marketplace.tab.academy' },
  { id: 'grow', labelKey: 'marketplace.tab.grow' },
]

type Pkg = { id: string; icon: keyof typeof PKG_ICONS; accent: string; nameKey: string; tagKey: string; priceKey: string; features: string[] }
const PACKAGES: Pkg[] = [
  {
    id: 'store', icon: 'store', accent: '#7ab8ff',
    nameKey: 'marketplace.pkg.store.name', tagKey: 'marketplace.pkg.store.tag', priceKey: 'marketplace.pkg.store.price',
    features: ['marketplace.pkg.store.f1', 'marketplace.pkg.store.f2', 'marketplace.pkg.store.f3'],
  },
  {
    id: 'brand', icon: 'brand', accent: '#d1f94f',
    nameKey: 'marketplace.pkg.brand.name', tagKey: 'marketplace.pkg.brand.tag', priceKey: 'marketplace.pkg.brand.price',
    features: ['marketplace.pkg.brand.f1', 'marketplace.pkg.brand.f2', 'marketplace.pkg.brand.f3'],
  },
  {
    id: 'email', icon: 'mail', accent: '#ff7ab8',
    nameKey: 'marketplace.pkg.email.name', tagKey: 'marketplace.pkg.email.tag', priceKey: 'marketplace.pkg.email.price',
    features: ['marketplace.pkg.email.f1', 'marketplace.pkg.email.f2', 'marketplace.pkg.email.f3'],
  },
]

type Level = 'beginner' | 'intermediate' | 'advanced'
type Course = { id: string; titleKey: string; topic: string; accent: string; lessons: number; minutes: number; level: Level; badge?: 'new' | 'updated' }
const COURSES: Course[] = [
  { id: 'store', titleKey: 'marketplace.course.store', topic: 'SHOP', accent: '#7ab8ff', lessons: 8, minutes: 95, level: 'beginner' },
  { id: 'cro', titleKey: 'marketplace.course.cro', topic: 'CRO', accent: '#3ecf8e', lessons: 10, minutes: 120, level: 'intermediate', badge: 'updated' },
  { id: 'meta', titleKey: 'marketplace.course.meta', topic: 'META', accent: '#5aa2ff', lessons: 14, minutes: 180, level: 'intermediate', badge: 'updated' },
  { id: 'tiktok', titleKey: 'marketplace.course.tiktok', topic: 'TIKTOK', accent: '#ff6ba6', lessons: 11, minutes: 140, level: 'beginner', badge: 'new' },
  { id: 'google', titleKey: 'marketplace.course.google', topic: 'GOOGLE', accent: '#ffb26b', lessons: 9, minutes: 110, level: 'advanced' },
  { id: 'email', titleKey: 'marketplace.course.email', topic: 'EMAIL', accent: '#c99bff', lessons: 7, minutes: 80, level: 'beginner' },
  { id: 'branding', titleKey: 'marketplace.course.branding', topic: 'BRAND', accent: '#d1f94f', lessons: 6, minutes: 70, level: 'beginner', badge: 'new' },
]

/* ------------------------------------------------------------------ */
/*  Intake modal                                                       */
/* ------------------------------------------------------------------ */

const NEEDS = ['store', 'brand', 'email', 'growth', 'courses'] as const
const STAGES = ['idea', 'selling', 'scaling'] as const
const BUDGETS = ['a', 'b', 'c', 'd'] as const

function IntakeModal({ presetNeed, onClose }: { presetNeed?: string; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const { user } = useAuth()
  const [brand, setBrand] = useState('')
  const [stage, setStage] = useState<(typeof STAGES)[number]>('idea')
  const [budget, setBudget] = useState<(typeof BUDGETS)[number]>('b')
  const [email, setEmail] = useState(user?.email ?? '')
  const [needs, setNeeds] = useState<Set<string>>(() => new Set(presetNeed ? [presetNeed] : ['store']))

  const toggleNeed = (n: string) =>
    setNeeds((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })

  const submit = () => {
    if (!email.trim() || !email.includes('@')) {
      toast(t('marketplace.intake.toastEmail'), 'info')
      return
    }
    // Lead capture is stubbed for now — a real backend would receive { brand, stage, needs, budget, email }.
    toast(t('marketplace.intake.toastOk'), 'success')
    onClose()
  }

  return (
    <div className="mk-scrim" role="dialog" aria-modal="true" aria-labelledby="mk-intake-title" onClick={onClose}>
      <div className="mk-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="mk-modal__x" aria-label={t('marketplace.intake.close')} onClick={onClose}>×</button>
        <h2 id="mk-intake-title" className="mk-modal__title">{t('marketplace.intake.title')}</h2>
        <p className="mk-modal__sub">{t('marketplace.intake.sub')}</p>

        <label className="mk-field">
          <span>{t('marketplace.intake.brand')}</span>
          <input className="mk-input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t('marketplace.intake.brandPh')} />
        </label>

        <label className="mk-field">
          <span>{t('marketplace.intake.stage')}</span>
          <select className="mk-input" value={stage} onChange={(e) => setStage(e.target.value as (typeof STAGES)[number])}>
            {STAGES.map((s) => (
              <option key={s} value={s}>{t(`marketplace.intake.stage.${s}`)}</option>
            ))}
          </select>
        </label>

        <div className="mk-field">
          <span>{t('marketplace.intake.need')}</span>
          <div className="mk-needs">
            {NEEDS.map((n) => (
              <button key={n} type="button" className={`mk-need${needs.has(n) ? ' is-on' : ''}`} aria-pressed={needs.has(n)} onClick={() => toggleNeed(n)}>
                {needs.has(n) && <IcoCheck width="12" height="12" />}
                {t(`marketplace.intake.need.${n}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="mk-field">
          <span>{t('marketplace.intake.budget')}</span>
          <select className="mk-input" value={budget} onChange={(e) => setBudget(e.target.value as (typeof BUDGETS)[number])}>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>{t(`marketplace.intake.budget.${b}`)}</option>
            ))}
          </select>
        </label>

        <label className="mk-field">
          <span>{t('marketplace.intake.email')}</span>
          <input className="mk-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('marketplace.intake.emailPh')} />
        </label>

        <div className="mk-modal__actions">
          <button type="button" className="s-btn s-btn--subtle" onClick={onClose}>{t('marketplace.intake.cancel')}</button>
          <button type="button" className="s-btn s-btn--accent" onClick={submit}>{t('marketplace.intake.submit')} <IcoArrowRight width="15" height="15" /></button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function Marketplace() {
  const t = useT()
  const toast = useToast()
  const [track, setTrack] = useState<Track>('packages')
  const [intake, setIntake] = useState<{ open: boolean; need?: string }>({ open: false })

  const openIntake = (need?: string) => setIntake({ open: true, need })

  return (
    <SuitePage
      eyebrow={t('marketplace.eyebrow')}
      title={t('marketplace.title')}
      subtitle={t('marketplace.subtitle')}
      actions={
        <button type="button" className="s-btn s-btn--accent" onClick={() => openIntake()}>
          <IcoSparkle width="16" height="16" /> {t('marketplace.buildBrand')}
        </button>
      }
    >
      <div className="mk-root">
        {/* Track tabs */}
        <div className="mk-tabs" role="tablist" aria-label={t('marketplace.title')}>
          {TRACKS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={track === tab.id}
              className={`mk-tab${track === tab.id ? ' is-active' : ''}`}
              onClick={() => setTrack(tab.id)}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* ── PACKAGES ─────────────────────────────────────────────── */}
        {track === 'packages' && (
          <>
            <section className="mk-hero mk-hero--bundle">
              <span className="mk-hero__glow" aria-hidden="true" />
              <div className="mk-hero__body">
                <span className="s-chip s-chip--accent"><IcoSparkle width="12" height="12" /> {t('marketplace.feat.badge')}</span>
                <h2 className="mk-hero__title">{t('marketplace.feat.title')}</h2>
                <p className="mk-hero__sub">{t('marketplace.feat.sub')}</p>
                <ul className="mk-hero__list">
                  <li><IcoCheck width="14" height="14" /> {t('marketplace.feat.bullet1')}</li>
                  <li><IcoCheck width="14" height="14" /> {t('marketplace.feat.bullet2')}</li>
                  <li><IcoCheck width="14" height="14" /> {t('marketplace.feat.bullet3')}</li>
                </ul>
                <div className="mk-hero__row">
                  <button type="button" className="s-btn s-btn--accent" onClick={() => openIntake('store')}>{t('marketplace.feat.cta')}</button>
                  <span className="mk-hero__price">{t('marketplace.feat.price')}<em>{t('marketplace.feat.save')}</em></span>
                </div>
              </div>
              <div className="mk-hero__art" aria-hidden="true">
                <span className="mk-hero__chip" style={{ '--a': '#7ab8ff' } as CSSProperties}><IcoStore width="30" height="30" /></span>
                <span className="mk-hero__chip" style={{ '--a': '#d1f94f' } as CSSProperties}><IcoPalette width="30" height="30" /></span>
                <span className="mk-hero__chip" style={{ '--a': '#ff7ab8' } as CSSProperties}><IcoMail width="30" height="30" /></span>
              </div>
            </section>

            <div className="mk-listhead"><span className="s-section-title">{t('marketplace.pkg.sectionTitle')}</span></div>
            <div className="mk-pkgs">
              {PACKAGES.map((p) => {
                const Icon = PKG_ICONS[p.icon]
                return (
                  <article key={p.id} className="mk-pkg" style={{ '--a': p.accent } as CSSProperties}>
                    <div className="mk-pkg__top">
                      <span className="mk-pkg__ico"><Icon width="22" height="22" /></span>
                      <span className="mk-pkg__verified"><IcoCheck width="11" height="11" /> {t('marketplace.verified')}</span>
                    </div>
                    <h3 className="mk-pkg__name">{t(p.nameKey)}</h3>
                    <p className="mk-pkg__tag">{t(p.tagKey)}</p>
                    <ul className="mk-pkg__list">
                      {p.features.map((f) => (
                        <li key={f}><IcoCheck width="13" height="13" /> {t(f)}</li>
                      ))}
                    </ul>
                    <div className="mk-pkg__foot">
                      <span className="mk-pkg__price">{t(p.priceKey)}</span>
                      <button type="button" className="s-btn s-btn--accent" onClick={() => openIntake(p.id === 'store' ? 'store' : p.id === 'brand' ? 'brand' : 'email')}>{t('marketplace.book')}</button>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

        {/* ── ACADEMY ──────────────────────────────────────────────── */}
        {track === 'academy' && (
          <>
            <section className="mk-hero mk-hero--academy">
              <span className="mk-hero__glow" aria-hidden="true" />
              <div className="mk-hero__body">
                <span className="s-chip s-chip--accent"><IcoPlay width="11" height="11" /> {t('marketplace.academy.badge')}</span>
                <h2 className="mk-hero__title">{t('marketplace.academy.title')}</h2>
                <p className="mk-hero__sub">{t('marketplace.academy.sub')}</p>
                <div className="mk-hero__row">
                  <button type="button" className="s-btn s-btn--accent" onClick={() => toast(t('marketplace.toast.academySoon'), 'accent')}>{t('marketplace.academy.cta')}</button>
                  <span className="mk-hero__price mk-hero__price--big">{t('marketplace.academy.price')}<i>{t('marketplace.academy.per')}</i><em>{t('marketplace.academy.priceYr')}</em></span>
                </div>
                <span className="mk-academy-note"><IcoSparkle width="12" height="12" /> {t('marketplace.academy.note')}</span>
              </div>
            </section>

            <div className="mk-listhead"><span className="s-section-title">{t('marketplace.academy.sectionTitle')}</span></div>
            <div className="mk-courses">
              {COURSES.map((c) => (
                <article key={c.id} className="mk-course" style={{ '--a': c.accent } as CSSProperties}>
                  <div className="mk-course__thumb">
                    <span className="mk-course__topic">{c.topic}</span>
                    {c.badge && <span className={`mk-course__badge mk-course__badge--${c.badge}`}>{t(`marketplace.badge.${c.badge}`)}</span>}
                    <span className="mk-course__play"><IcoPlay width="20" height="20" /></span>
                  </div>
                  <div className="mk-course__body">
                    <h3 className="mk-course__title">{t(c.titleKey)}</h3>
                    <div className="mk-course__meta">
                      <span>{t('marketplace.academy.lessons', { n: c.lessons })}</span>
                      <span>·</span>
                      <span>{t('marketplace.academy.min', { n: c.minutes })}</span>
                      <span>·</span>
                      <span>{t(`marketplace.level.${c.level}`)}</span>
                    </div>
                    <div className="mk-course__foot">
                      <span className="mk-course__incl"><IcoCheck width="12" height="12" /> {t('marketplace.academy.included')}</span>
                      <button type="button" className="mk-course__watch" onClick={() => toast(t('marketplace.toast.academySoon'), 'accent')}>{t('marketplace.academy.watch')} <IcoArrowRight width="13" height="13" /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {/* ── GROW WITH LOOM ───────────────────────────────────────── */}
        {track === 'grow' && (
          <>
            <section className="mk-hero mk-hero--grow">
              <span className="mk-hero__glow" aria-hidden="true" />
              <div className="mk-hero__body">
                <span className="s-chip s-chip--accent"><IcoTrend width="12" height="12" /> {t('marketplace.grow.badge')}</span>
                <h2 className="mk-hero__title">{t('marketplace.grow.title')}</h2>
                <p className="mk-hero__sub">{t('marketplace.grow.sub')}</p>
                <div className="mk-hero__row">
                  <button type="button" className="s-btn s-btn--accent" onClick={() => openIntake('growth')}>{t('marketplace.grow.cta')}</button>
                  <span className="mk-hero__model">{t('marketplace.grow.model')}</span>
                </div>
              </div>
              <div className="mk-hero__art" aria-hidden="true">
                <span className="mk-hero__chip mk-hero__chip--lg" style={{ '--a': '#d1f94f' } as CSSProperties}><IcoTrend width="42" height="42" /></span>
              </div>
            </section>

            <div className="mk-grow-cols">
              <div className="mk-grow-steps">
                <span className="s-section-title">{t('marketplace.grow.how')}</span>
                {(['s1', 's2', 's3'] as const).map((s, i) => (
                  <div key={s} className="mk-step">
                    <span className="mk-step__n">{i + 1}</span>
                    <div>
                      <b>{t(`marketplace.grow.${s}.t`)}</b>
                      <small>{t(`marketplace.grow.${s}.b`)}</small>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mk-grow-incl">
                <span className="s-section-title">{t('marketplace.grow.incl')}</span>
                <ul className="mk-grow-incl__list">
                  {(['i1', 'i2', 'i3', 'i4'] as const).map((i) => (
                    <li key={i}><IcoCheck width="14" height="14" /> {t(`marketplace.grow.${i}`)}</li>
                  ))}
                </ul>
                <div className="mk-grow-cta">
                  <span className="mk-grow-cta__meta"><IcoStar width="13" height="13" style={{ color: 'var(--s-accent)' }} /> {t('marketplace.grow.model')}</span>
                  <button type="button" className="s-btn s-btn--accent" onClick={() => openIntake('growth')}>{t('marketplace.grow.cta')} <IcoArrowRight width="15" height="15" /></button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {intake.open && <IntakeModal presetNeed={intake.need} onClose={() => setIntake({ open: false })} />}
    </SuitePage>
  )
}
