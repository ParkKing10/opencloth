import { useT } from '@/i18n'
import { IcoSparkle } from '../../components/ui/Icons'
import type { DirectorSuggestion } from './directorModel'
import './creative-director.css'

type Props = {
  suggestions: DirectorSuggestion[]
  onApply: (s: DirectorSuggestion) => void
  onDismiss: (id: string) => void
  onClose: () => void
}

/**
 * A floating "creative director" card that appears after a graphic lands. Each row is a real,
 * one-click move computed from the actual design — apply it, or dismiss it. When the list empties
 * the card closes itself (handled by the parent).
 */
export function CreativeDirector({ suggestions, onApply, onDismiss, onClose }: Props) {
  const t = useT()
  if (suggestions.length === 0) return null
  return (
    <aside className="cd" role="complementary" aria-label={t('dsInspectors.cd.aria')}>
      <div className="cd__head">
        <span className="cd__title">
          <IcoSparkle width="14" height="14" />
          {t('dsInspectors.cd.title')}
        </span>
        <button type="button" className="cd__close" aria-label={t('dsInspectors.cd.dismissAll')} onClick={onClose}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <ul className="cd__list">
        {suggestions.map((s) => (
          <li key={s.id} className="cd__item">
            <p className="cd__text">{s.text}</p>
            <div className="cd__actions">
              <button type="button" className="cd__skip" onClick={() => onDismiss(s.id)}>{t('dsInspectors.cd.notNow')}</button>
              <button type="button" className="cd__apply" onClick={() => onApply(s)}>{s.cta}</button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  )
}
