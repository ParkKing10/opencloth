import { useEffect, useMemo, useState } from 'react'
import type { DragEvent } from 'react'
import { ACCESSORY_CATEGORIES, listAccessories, type Accessory } from '../../accessories/accessoryClient'
import './library-panels.css'

// The Library rail's "Accessories" panel — the shared, admin-curated accessories every user can
// drop onto a garment for free. Click (or drag) a card to place it as a movable image layer.

export const ACCESSORY_DRAG_MIME = 'application/x-loom-accessory'

function handleDragStart(event: DragEvent<HTMLButtonElement>, acc: Accessory): void {
  event.dataTransfer.setData(ACCESSORY_DRAG_MIME, JSON.stringify({ name: acc.name, image: acc.image }))
  event.dataTransfer.setData('text/plain', acc.name)
  event.dataTransfer.effectAllowed = 'copy'
}

export function AccessoriesPanel({ onPlace }: { onPlace: (acc: Accessory) => void }) {
  const [items, setItems] = useState<Accessory[]>([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState('all')

  useEffect(() => {
    let live = true
    setLoading(true)
    void listAccessories().then((list) => {
      if (!live) return
      setItems(list)
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [])

  // Only show category chips that actually have accessories, to keep the rail tidy.
  const cats = useMemo(() => {
    const present = new Set(items.map((a) => a.category))
    return ACCESSORY_CATEGORIES.filter((c) => present.has(c.id))
  }, [items])

  const shown = useMemo(() => (cat === 'all' ? items : items.filter((a) => a.category === cat)), [items, cat])

  return (
    <section className="lib-panel" aria-label="Accessories">
      <header className="lib-head">
        <h2>Accessories</h2>
        <p className="lib-head__hint">Free for everyone — click to place on your piece</p>
      </header>

      {cats.length > 0 && (
        <div className="lib-chips">
          <button className={`lib-chip${cat === 'all' ? ' is-active' : ''}`} type="button" onClick={() => setCat('all')}>
            All
          </button>
          {cats.map((c) => (
            <button
              key={c.id}
              className={`lib-chip${cat === c.id ? ' is-active' : ''}`}
              type="button"
              onClick={() => setCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="lib-scroll">
        {loading ? (
          <p className="lib-empty">Loading accessories…</p>
        ) : items.length === 0 ? (
          <p className="lib-empty">No accessories yet. Your admin adds them in the Accessory Library.</p>
        ) : (
          <div className="lib-grid">
            {shown.map((a) => (
              <button
                type="button"
                key={a.id}
                className="lib-gcard"
                draggable={true}
                aria-label={`Place ${a.name}`}
                title={a.name}
                onClick={() => onPlace(a)}
                onDragStart={(event) => handleDragStart(event, a)}
              >
                <span className="lib-acc-thumb">
                  <img src={a.image} alt="" draggable={false} />
                </span>
                <span className="lib-gcard__name">{a.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <footer className="lib-foot">Drag onto the garment or click to add.</footer>
    </section>
  )
}
