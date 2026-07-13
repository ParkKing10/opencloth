import { IcoArrowRight, IcoPlus, IcoSparkle } from '../../components/ui/Icons'
import './launcher.css'

export type LauncherDesign = { id: string; name: string; thumb?: string; updatedAt: number }

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

function timeAgo(ms: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/**
 * Design Studio launcher — shown every time the Studio is entered WITHOUT a specific garment. It never
 * drops the user straight into the editor: they pick a saved design to continue or start fresh. Up
 * top, a bold "get the app" hero promotes designing on mobile.
 */
export function DesignLauncher({ designs, onOpen, onNew, onGetApp, onBack, inline = false }: Props) {
  return (
    <div className={`dl${inline ? ' dl--page' : ''}`}>
      <div className="dl__inner">
        {onBack && (
          <button type="button" className="dl__back" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Back to workspace
          </button>
        )}
        {/* App-download hero */}
        <div className="dl__hero">
          <div className="dl__hero-glow" aria-hidden="true" />
          <div className="dl__hero-body">
            <span className="dl__hero-kicker"><IcoSparkle width="15" height="15" /> loom studios MOBILE</span>
            <h1>Design your clothes<br />anywhere.</h1>
            <p>Get the loom studios app — paint, print and drop graphics on your garments from your phone, exactly like here, in your pocket.</p>
            <div className="dl__hero-cta">
              <button type="button" className="dl__store" onClick={onGetApp}>
                <span className="dl__store-glyph"></span>
                <span><small>Download on the</small><b>App Store</b></span>
              </button>
              <button type="button" className="dl__store" onClick={onGetApp}>
                <span className="dl__store-glyph">▶</span>
                <span><small>Get it on</small><b>Google Play</b></span>
              </button>
            </div>
          </div>
          <div className="dl__hero-phone" aria-hidden="true">
            <div className="dl__phone">
              <div className="dl__phone-screen" />
            </div>
          </div>
        </div>

        {/* Continue / start */}
        <div className="dl__head">
          <b>Open a design</b>
          <button type="button" className="dl__new" onClick={onNew}>
            <IcoPlus width="16" height="16" /> Start new design
          </button>
        </div>

        {designs.length === 0 ? (
          <div className="dl__empty">
            <p>No saved designs yet.</p>
            <button type="button" className="dl__new dl__new--lg" onClick={onNew}>
              <IcoPlus width="18" height="18" /> Start your first design
            </button>
          </div>
        ) : (
          <div className="dl__grid">
            {designs.map((d) => (
              <button key={d.id} type="button" className="dl__card" onClick={() => onOpen(d.id)} title={`Open “${d.name}”`}>
                <div className="dl__card-thumb">
                  {d.thumb ? <img src={d.thumb} alt={d.name} loading="lazy" /> : <span className="dl__card-glyph" aria-hidden="true">🧥</span>}
                  <span className="dl__card-open"><IcoArrowRight width="16" height="16" /></span>
                </div>
                <div className="dl__card-body">
                  <span className="dl__card-name">{d.name}</span>
                  <span className="dl__card-time">Edited {timeAgo(d.updatedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
