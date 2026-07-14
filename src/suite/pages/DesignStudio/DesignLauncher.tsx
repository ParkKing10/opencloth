import { IcoArrowRight, IcoPlus, IcoSparkle } from '../../components/ui/Icons'
import { useT } from '@/i18n'
import './launcher.css'

export type LauncherDesign = { id: string; name: string; thumb?: string; updatedAt: number }

type TFn = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  designs: LauncherDesign[]
  onOpen: (id: string) => void
  onNew: () => void
  onGetApp: () => void
  /** Leave the studio back to the workspace. Omitted when the launcher lives inside the suite shell
   *  (the sidebar already provides navigation), so no redundant back button is shown. */
  onBack?: () => void
  /** Rendered as a normal page inside the suite shell (not a full-screen fixed overlay) — flows in
   *  the content area so the sidebar stays visible. */
  inline?: boolean
}

function timeAgo(ms: number, t: TFn): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000))
  if (s < 60) return t('studioLanding.time.justNow')
  const m = Math.floor(s / 60)
  if (m < 60) return t('studioLanding.time.minutes', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('studioLanding.time.hours', { n: h })
  return t('studioLanding.time.days', { n: Math.floor(h / 24) })
}

/**
 * Design Studio launcher — shown every time the Studio is entered WITHOUT a specific garment. It never
 * drops the user straight into the editor: they pick a saved design to continue or start fresh. Up
 * top, a bold "get the app" hero promotes designing on mobile.
 */
export function DesignLauncher({ designs, onOpen, onNew, onGetApp, onBack, inline = false }: Props) {
  const t = useT()
  return (
    <div className={`dl${inline ? ' dl--page' : ''}`}>
      <div className="dl__inner">
        {onBack && (
          <button type="button" className="dl__back" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            {t('studioLanding.back')}
          </button>
        )}
        {/* App-download hero — the device shows the app mid-design, so the promise ("design your
            clothes anywhere") is shown, not just told. */}
        <div className="dl__hero" data-tour="studio-hero">
          <div className="dl__hero-glow" aria-hidden="true" />
          <div className="dl__hero-grain" aria-hidden="true" />
          <div className="dl__hero-body">
            <span className="dl__hero-kicker"><IcoSparkle width="14" height="14" /> {t('studioLanding.hero.kicker')}</span>
            <h1>{t('studioLanding.hero.title1')}<br /><em>{t('studioLanding.hero.title2')}</em></h1>
            <p>{t('studioLanding.hero.body')}</p>
            <div className="dl__hero-cta">
              <button type="button" className="dl__store" onClick={onGetApp}>
                <svg className="dl__store-logo" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M17.56 12.85c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.15-2.76.83-3.48.83-.72 0-1.52-.81-2.5-.79-1.29.02-2.48.75-3.14 1.9-1.34 2.33-.34 5.77.96 7.66.64.92 1.39 1.96 2.38 1.92.96-.04 1.32-.62 2.47-.62 1.15 0 1.48.62 2.49.6 1.03-.02 1.68-.94 2.31-1.87.73-1.07 1.03-2.11 1.05-2.16-.02-.01-2.02-.78-2.04-3.08 Z M15.28 5.15c.53-.65.89-1.55.79-2.45-.76.03-1.69.51-2.24 1.16-.49.57-.92 1.49-.8 2.37.85.07 1.72-.43 2.25-1.08 Z"/>
                </svg>
                <span className="dl__store-txt"><small>{t('studioLanding.store.appleSmall')}</small><b>App Store</b></span>
              </button>
              <button type="button" className="dl__store" onClick={onGetApp}>
                <svg className="dl__store-logo" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#00d0ff" d="M3.35 2.34A1.4 1.4 0 0 0 3 3.28v17.44c0 .37.14.69.36.9l9.53-9.55L3.35 2.34Z"/>
                  <path fill="#00e17a" d="M3.35 2.34a1.4 1.4 0 0 1 1.53-.11l11.34 6.44-2.87 2.87L3.35 2.34Z"/>
                  <path fill="#ffc400" d="M16.22 8.67l3.06 1.74c.99.56.99 2.02 0 2.58l-3.07 1.74-2.88-2.87 2.89-2.87Z"/>
                  <path fill="#ff4133" d="M3.36 21.62a1.4 1.4 0 0 0 1.52.11l11.34-6.44-2.87-2.87L3.36 21.62Z"/>
                </svg>
                <span className="dl__store-txt"><small>{t('studioLanding.store.googleSmall')}</small><b>Google Play</b></span>
              </button>
            </div>
          </div>
          {/* An iPad running the actual Design Studio — dark grid canvas, tool rail, a garment on the
              board with a graphic dropped on the chest, and the layers panel. The real app, in a frame. */}
          <div className="dl__hero-phone" aria-hidden="true">
            <div className="dl__ipad">
              <span className="dl__ipad-cam" />
              <div className="dl__ipad-screen">
                <div className="dl__ds">
                  <div className="dl__ds-top">
                    <span className="dl__ds-brand">
                      <span className="dl__ds-mark" />
                      loom studios
                    </span>
                    <span className="dl__ds-top-actions">
                      <span className="dl__ds-btn">Generate</span>
                      <span className="dl__ds-btn">Export</span>
                    </span>
                  </div>
                  <div className="dl__ds-body">
                    <div className="dl__ds-rail">
                      <i className="is-on" /><i /><i /><i /><i />
                    </div>
                    <div className="dl__ds-canvas">
                      <svg className="dl__ds-flat" viewBox="0 0 120 140" fill="none" stroke="#cfcfd6" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
                        <path d="M44 22 26 32 18 54 32 62 38 54 38 120 82 120 82 54 88 62 102 54 94 32 76 22C72 32 66 36 60 36 54 36 48 32 44 22Z"/>
                        <path d="M44 22C48 32 54 36 60 36 66 36 72 32 76 22"/>
                      </svg>
                      <span className="dl__ds-graphic" />
                      <span className="dl__ds-zoom">100%</span>
                    </div>
                    <div className="dl__ds-panel">
                      <span className="dl__ds-panel-h">Layers</span>
                      <span className="dl__ds-row is-sel"><i />Graphic</span>
                      <span className="dl__ds-row"><i />Hoodie</span>
                      <span className="dl__ds-row"><i />Canvas</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Continue / start */}
        <div className="dl__head" data-tour="studio-designs-head">
          <b>{t('studioLanding.open')}</b>
          <button type="button" className="dl__new" data-tour="studio-new-design" onClick={onNew}>
            <IcoPlus width="16" height="16" /> {t('studioLanding.new')}
          </button>
        </div>

        {designs.length === 0 ? (
          <div className="dl__empty">
            <p>{t('studioLanding.empty')}</p>
            <button type="button" className="dl__new dl__new--lg" onClick={onNew}>
              <IcoPlus width="18" height="18" /> {t('studioLanding.first')}
            </button>
          </div>
        ) : (
          <div className="dl__grid">
            {designs.map((d) => (
              <button key={d.id} type="button" className="dl__card" onClick={() => onOpen(d.id)} title={t('studioLanding.card.openTitle', { name: d.name })}>
                <div className="dl__card-thumb">
                  {d.thumb ? <img src={d.thumb} alt={d.name} loading="lazy" /> : <span className="dl__card-glyph" aria-hidden="true">🧥</span>}
                  <span className="dl__card-open"><IcoArrowRight width="16" height="16" /></span>
                </div>
                <div className="dl__card-body">
                  <span className="dl__card-name">{d.name}</span>
                  <span className="dl__card-time">{t('studioLanding.card.edited', { ago: timeAgo(d.updatedAt, t) })}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
