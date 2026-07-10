/**
 * In-editor creation methods for an empty garment. Three ways to start, each producing a fully
 * editable garment: Create with AI (prompt → structured editable garment), Start from Template
 * (browse the catalog), or Draw Garment (sketch regions).
 */
import { useState } from 'react'
import { TemplateGallery } from './TemplateGallery'

type Props = {
  onGenerate: (prompt: string) => void
  onDraw: () => void
  onTemplate: (templateId: string) => void
}

const EXAMPLES = ['Oversized bomber jacket', 'Cropped hoodie', 'Wool trench coat', 'Gold chain necklace']

export function GarmentCreateMethods({ onGenerate, onDraw, onTemplate }: Props) {
  const [method, setMethod] = useState<'ai' | 'template' | null>('ai')
  const [prompt, setPrompt] = useState('')

  return (
    <div className="egc">
      <div className="egc__head">
        <span className="egc__eyebrow">New piece</span>
        <h2>How would you like to start?</h2>
        <p className="egc__sub">Every method produces a fully editable piece with front + back and a real region tree.</p>
      </div>

      <div className="egc__methods egc__methods--3">
        <button type="button" className={`egc__method${method === 'ai' ? ' is-active' : ''}`} onClick={() => setMethod('ai')}>
          <span className="egc__method-glyph">✦</span>
          <b>Create with AI</b>
          <small>Describe it — the AI builds editable garment data, never an image.</small>
        </button>
        <button type="button" className={`egc__method${method === 'template' ? ' is-active' : ''}`} onClick={() => setMethod('template')}>
          <span className="egc__method-glyph">▦</span>
          <b>Start from Template</b>
          <small>Browse the catalog of real editable flats.</small>
        </button>
        <button type="button" className="egc__method" onClick={onDraw}>
          <span className="egc__method-glyph">✎</span>
          <b>Draw</b>
          <small>Sketch shapes that become editable regions.</small>
        </button>
      </div>

      {method === 'ai' && (
        <div className="egc__ai">
          <textarea
            className="egc__prompt"
            rows={3}
            placeholder="e.g. Oversized double-breasted wool overcoat with wide lapels"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && prompt.trim()) onGenerate(prompt.trim())
            }}
            aria-label="Describe your piece"
          />
          <div className="egc__examples">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="egc__example" onClick={() => setPrompt(ex)}>
                {ex}
              </button>
            ))}
          </div>
          <button type="button" className="egc__generate" disabled={!prompt.trim()} onClick={() => onGenerate(prompt.trim())}>
            Generate
          </button>
        </div>
      )}

      {method === 'template' && <TemplateGallery onPick={onTemplate} />}
    </div>
  )
}
