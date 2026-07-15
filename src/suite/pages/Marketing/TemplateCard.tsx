import { useNavigate } from 'react-router-dom'
import { useT } from '@/i18n'
import type { MkTemplate } from '../../marketing/templates'

/**
 * One animated template card (Higgsfield-style). The preview is a living CSS scene — layered
 * gradients, a drifting garment silhouette and floating caption chips — that idles subtly and
 * plays fully on hover/focus. Click opens the generator preloaded with this template.
 */
export function TemplateCard({
  template,
  size = 'md',
  selected = false,
  onSelect,
}: {
  template: MkTemplate
  size?: 'md' | 'lg'
  /** When set, the card acts as a picker (generator strip) instead of navigating. */
  selected?: boolean
  onSelect?: () => void
}) {
  const t = useT()
  const navigate = useNavigate()

  return (
    <button
      type="button"
      className={`mstcard mstcard--${template.look} mstcard--${size} mstcard--f${template.format.replace(':', 'x')}${selected ? ' is-on' : ''}`}
      aria-pressed={onSelect ? selected : undefined}
      onClick={() => (onSelect ? onSelect() : navigate(`/marketing/generate?t=${template.id}`))}
      aria-label={t(`mk.tpl.${template.id}.title`)}
    >
      <span className="mstcard__scene" aria-hidden="true">
        <span className="mstcard__glow" />
        <span className="mstcard__grid" />
        <span className="mstcard__orb mstcard__orb--a" />
        <span className="mstcard__orb mstcard__orb--b" />
        <svg className="mstcard__glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
        </svg>
        <span className="mstcard__chip mstcard__chip--a">{t(`mk.cat.${template.category}`)}</span>
        <span className="mstcard__chip mstcard__chip--b">{t(`mk.tpl.${template.id}.tag`)}</span>
        <span className="mstcard__scan" />
      </span>

      <span className="mstcard__meta">
        <span className="mstcard__text">
          <b>{t(`mk.tpl.${template.id}.title`)}</b>
          <small>{t(`mk.tpl.${template.id}.tag`)}</small>
        </span>
        <span className="mstcard__badges">
          <span className="mstcard__format">{template.format}</span>
          <span className="mstcard__kind">{t(`mk.output.${template.output}`)}</span>
        </span>
      </span>
    </button>
  )
}
