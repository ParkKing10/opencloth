import { useNavigate } from 'react-router-dom'
import { useT } from '@/i18n'
import type { MkTemplate } from '../../marketing/templates'

/**
 * One animated template card (Higgsfield-style). The preview is a living CSS scene — layered
 * gradients, a drifting garment silhouette and floating caption chips — that idles subtly and
 * plays fully on hover/focus. Click opens the generator preloaded with this template.
 */
export function TemplateCard({ template, size = 'md' }: { template: MkTemplate; size?: 'md' | 'lg' }) {
  const t = useT()
  const navigate = useNavigate()

  return (
    <button
      type="button"
      className={`mkcard mkcard--${template.look} mkcard--${size} mkcard--f${template.format.replace(':', 'x')}`}
      onClick={() => navigate(`/marketing/generate?t=${template.id}`)}
      aria-label={t(`mk.tpl.${template.id}.title`)}
    >
      <span className="mkcard__scene" aria-hidden="true">
        <span className="mkcard__glow" />
        <span className="mkcard__grid" />
        <span className="mkcard__orb mkcard__orb--a" />
        <span className="mkcard__orb mkcard__orb--b" />
        <svg className="mkcard__glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
        </svg>
        <span className="mkcard__chip mkcard__chip--a">{t(`mk.cat.${template.category}`)}</span>
        <span className="mkcard__chip mkcard__chip--b">{t(`mk.tpl.${template.id}.tag`)}</span>
        <span className="mkcard__scan" />
      </span>

      <span className="mkcard__meta">
        <span className="mkcard__text">
          <b>{t(`mk.tpl.${template.id}.title`)}</b>
          <small>{t(`mk.tpl.${template.id}.tag`)}</small>
        </span>
        <span className="mkcard__badges">
          <span className="mkcard__format">{template.format}</span>
          <span className="mkcard__kind">{t(`mk.output.${template.output}`)}</span>
        </span>
      </span>
    </button>
  )
}
