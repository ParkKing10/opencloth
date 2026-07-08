import { IcoSparkle, IcoArrowRight } from '../../components/ui/Icons'
import { GARMENT_GLYPHS, type GarmentKind } from '../../components/ui/Garments'
import './studio-dock.css'

export type DockView = { id: string; label: string }

type Props = {
  garmentKind: GarmentKind
  checklistPct: number
  checklistTitle?: string
  aiSuggestion: string | null
  onViewSuggestion: () => void
  views: DockView[]
  activeView: string
  onSelectView: (id: string) => void
  onCreateTechPack: () => void
}

/**
 * The full-width dock that spans the very bottom of the Design Studio editor.
 * Four zones in one row: project checklist, AI suggestion, per-view thumbnails,
 * and the "next step" tech-pack call to action.
 */
export function StudioDock({
  garmentKind,
  checklistPct,
  checklistTitle = 'Project Checklist',
  aiSuggestion,
  onViewSuggestion,
  views,
  activeView,
  onSelectView,
  onCreateTechPack,
}: Props): JSX.Element {
  const Glyph = GARMENT_GLYPHS[garmentKind]
  const pct = Math.max(0, Math.min(100, Math.round(checklistPct)))

  return (
    <div className="dk" role="region" aria-label="Studio dock">
      {/* Zone 1 — Project checklist */}
      <section className="dk-zone dk-check" aria-label={checklistTitle}>
        <div className="dk-check__head">
          <span className="dk-check__label">{checklistTitle}</span>
          <span className="dk-check__pct">{pct}%</span>
        </div>
        <div
          className="dk-check__track"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${checklistTitle} ${pct}% complete`}
        >
          <span className="dk-check__fill" style={{ width: `${pct}%` }} />
        </div>
      </section>

      {/* Zone 2 — AI suggestion (hidden gracefully when null) */}
      {aiSuggestion && (
        <section className="dk-zone dk-ai" aria-label="AI suggestion">
          <span className="dk-ai__mark" aria-hidden>
            <IcoSparkle width="16" height="16" />
          </span>
          <div className="dk-ai__body">
            <span className="dk-ai__eyebrow">AI Suggestion</span>
            <p className="dk-ai__text">{aiSuggestion}</p>
          </div>
          <button type="button" className="dk-ai__view" onClick={onViewSuggestion}>
            View
          </button>
        </section>
      )}

      {/* Zone 3 — View thumbnails (flexes to fill remaining space) */}
      <section className="dk-zone dk-views" aria-label="Views">
        <div className="dk-views__scroll">
          {views.map((v) => {
            const isActive = v.id === activeView
            return (
              <button
                key={v.id}
                type="button"
                className={`dk-view${isActive ? ' is-active' : ''}`}
                onClick={() => onSelectView(v.id)}
                aria-pressed={isActive}
                title={v.label}
              >
                <span className="dk-view__thumb" aria-hidden>
                  <Glyph width="30" height="30" />
                </span>
                <span className="dk-view__label">{v.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Zone 4 — Next step */}
      <section className="dk-zone dk-next" aria-label="Next step">
        <div className="dk-next__text">
          <span className="dk-next__eyebrow">Next Step</span>
          <b className="dk-next__title">Tech Pack</b>
          <small className="dk-next__sub">Generate a professional tech pack for production.</small>
        </div>
        <button type="button" className="dk-next__cta" onClick={onCreateTechPack}>
          Create Tech Pack
          <IcoArrowRight width="15" height="15" aria-hidden />
        </button>
      </section>
    </div>
  )
}
