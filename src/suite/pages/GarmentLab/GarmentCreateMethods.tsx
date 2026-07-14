/**
 * In-editor creation methods for an empty garment. Three ways to start, each producing a fully
 * editable garment: Create with AI (prompt → structured editable garment), Start from Template
 * (browse the catalog), or Draw Garment (sketch regions).
 */
import { useState } from 'react'
import { useT } from '@/i18n'
import { TemplateGallery } from './TemplateGallery'

type Props = {
  onGenerate: (prompt: string) => void
  onDraw: () => void
  onTemplate: (templateId: string) => void
}

const EXAMPLE_KEYS = ['labMain.exampleBomber', 'labMain.exampleHoodie', 'labMain.exampleTrench', 'labMain.exampleNecklace']

export function GarmentCreateMethods({ onGenerate, onDraw, onTemplate }: Props) {
  const t = useT()
  const [method, setMethod] = useState<'ai' | 'template' | null>('ai')
  const [prompt, setPrompt] = useState('')

  return (
    <div className="egc">
      <div className="egc__head">
        <span className="egc__eyebrow">{t('labMain.createEyebrow')}</span>
        <h2>{t('labMain.createHeading')}</h2>
        <p className="egc__sub">{t('labMain.createSub')}</p>
      </div>

      <div className="egc__methods egc__methods--3">
        <button type="button" className={`egc__method${method === 'ai' ? ' is-active' : ''}`} onClick={() => setMethod('ai')}>
          <span className="egc__method-glyph">✦</span>
          <b>{t('labMain.methodAiTitle')}</b>
          <small>{t('labMain.methodAiDesc')}</small>
        </button>
        <button type="button" className={`egc__method${method === 'template' ? ' is-active' : ''}`} onClick={() => setMethod('template')}>
          <span className="egc__method-glyph">▦</span>
          <b>{t('labMain.methodTemplateTitle')}</b>
          <small>{t('labMain.methodTemplateDesc')}</small>
        </button>
        <button type="button" className="egc__method" onClick={onDraw}>
          <span className="egc__method-glyph">✎</span>
          <b>{t('labMain.methodDrawTitle')}</b>
          <small>{t('labMain.methodDrawDesc')}</small>
        </button>
      </div>

      {method === 'ai' && (
        <div className="egc__ai">
          <textarea
            className="egc__prompt"
            rows={3}
            placeholder={t('labMain.promptPlaceholder')}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && prompt.trim()) onGenerate(prompt.trim())
            }}
            aria-label={t('labMain.promptAria')}
          />
          <div className="egc__examples">
            {EXAMPLE_KEYS.map((key) => {
              const ex = t(key)
              return (
                <button key={key} type="button" className="egc__example" onClick={() => setPrompt(ex)}>
                  {ex}
                </button>
              )
            })}
          </div>
          <button type="button" className="egc__generate" disabled={!prompt.trim()} onClick={() => onGenerate(prompt.trim())}>
            {t('labMain.generate')}
          </button>
        </div>
      )}

      {method === 'template' && <TemplateGallery onPick={onTemplate} />}
    </div>
  )
}
