/**
 * Browsable gallery of every garment template, grouped by category with live SVG thumbnails.
 * Picking one starts an editable garment from that flat. This is the home for the full catalog
 * (50+ pieces) — searchable so a designer can find "puffer", "cargo", "wrap dress" fast.
 */
import { useMemo, useState } from 'react'
import { GARMENT_TEMPLATES, type GarmentTemplate } from '../../garment-model/garmentTemplates'
import { garmentThumbnailDataUrl } from '../../garment-model/garmentThumbnail'

type Props = {
  onPick: (templateId: string) => void
}

const CATEGORY_ORDER = ['Outerwear', 'Coats', 'Tops', 'Bottoms', 'Dresses', 'One-Piece', 'Accessories', 'Jewellery']

export function TemplateGallery({ onPick }: Props) {
  const [query, setQuery] = useState('')

  // Thumbnails built once from each template's front view (no raster stored, always on-style).
  const thumbs = useMemo(() => {
    const map: Record<string, string> = {}
    for (const t of GARMENT_TEMPLATES) map[t.id] = garmentThumbnailDataUrl(t.make())
    return map
  }, [])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const byCat = new Map<string, GarmentTemplate[]>()
    for (const t of GARMENT_TEMPLATES) {
      if (q && !t.name.toLowerCase().includes(q) && !t.category.toLowerCase().includes(q)) continue
      const list = byCat.get(t.category) ?? []
      list.push(t)
      byCat.set(t.category, list)
    }
    return [...byCat.entries()].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a[0])
      const ib = CATEGORY_ORDER.indexOf(b[0])
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
  }, [query])

  const total = groups.reduce((n, [, list]) => n + list.length, 0)

  return (
    <div className="tgal">
      <div className="tgal__bar">
        <input
          className="tgal__search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${GARMENT_TEMPLATES.length} templates — puffer, cargo, wrap dress…`}
          aria-label="Search templates"
        />
        <span className="tgal__count">{total} templates</span>
      </div>

      {groups.length === 0 && <p className="tgal__empty">No templates match “{query}”.</p>}

      {groups.map(([category, list]) => (
        <section key={category} className="tgal__group">
          <h3 className="tgal__cat">{category}</h3>
          <div className="tgal__grid">
            {list.map((t) => (
              <button key={t.id} type="button" className="tgal__card" onClick={() => onPick(t.id)}>
                <span className="tgal__thumb">
                  <img src={thumbs[t.id]} alt={t.name} loading="lazy" width={140} height={196} />
                </span>
                <span className="tgal__name">{t.name}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
