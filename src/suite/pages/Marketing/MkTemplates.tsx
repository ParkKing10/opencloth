import { useState } from 'react'
import { useT } from '@/i18n'
import { MK_TEMPLATES, type MkTemplateCategory } from '../../marketing/templates'
import { TemplateCard } from './TemplateCard'

const CATS: ('all' | MkTemplateCategory)[] = ['all', 'social', 'commercial', 'photo', 'launch']

/** The full template catalog with category filters. */
export function MkTemplates() {
  const t = useT()
  const [cat, setCat] = useState<(typeof CATS)[number]>('all')

  const shown = cat === 'all' ? MK_TEMPLATES : MK_TEMPLATES.filter((tpl) => tpl.category === cat)

  return (
    <section className="mst-sec">
      <div className="mst-sec__head">
        <div>
          <h2>{t('mk.templates.head')}</h2>
          <p>{t('mk.templates.sub')}</p>
        </div>
      </div>

      <div className="mst-chiprow" role="group" aria-label={t('mk.templates.filterAria')}>
        {CATS.map((c) => (
          <button key={c} type="button" className={`mst-chip${cat === c ? ' is-on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>
            {t(`mk.cat.${c}`)}
          </button>
        ))}
      </div>

      <div className="mst-grid">
        {shown.map((tpl) => (
          <TemplateCard key={tpl.id} template={tpl} />
        ))}
      </div>
    </section>
  )
}
