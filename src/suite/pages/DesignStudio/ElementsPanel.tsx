import type { DragEvent } from 'react'
import { GRAPHIC_MARKS } from './objectModel'
import { ELEMENT_GROUPS } from './elementsCatalog'
import './library-panels.css'

const GRAPHIC_DRAG_MIME = 'application/x-threados-graphic'

/** Render a built-in mark by name. The marks are trusted in-code constants (not user input). */
function ElementMark({ name }: { name: string }) {
  return (
    <svg
      className="lib-el__svg"
      viewBox="0 0 100 100"
      aria-hidden="true"
      // eslint-disable-next-line react/no-danger -- GRAPHIC_MARKS is a static, developer-authored map
      dangerouslySetInnerHTML={{ __html: GRAPHIC_MARKS[name] ?? '' }}
    />
  )
}

function handleDragStart(event: DragEvent<HTMLButtonElement>, name: string): void {
  event.dataTransfer.setData(GRAPHIC_DRAG_MIME, name)
  event.dataTransfer.setData('text/plain', name)
  event.dataTransfer.effectAllowed = 'copy'
}

/**
 * Elements library — a Canva-style set of vector building blocks (shapes, stars, arrows, badges,
 * streetwear marks, frames). Clicking or dragging one drops a normal graphic object on the canvas.
 */
export function ElementsPanel({ onAdd }: { onAdd: (name: string) => void }) {
  return (
    <section className="lib-panel" aria-label="Elements">
      <header className="lib-head">
        <h2>Elements</h2>
        <p className="lib-head__hint">Shapes, marks & frames — drop them on your piece</p>
      </header>

      <div className="lib-scroll">
        {ELEMENT_GROUPS.map((group) => (
          <div className="lib-group" key={group.title}>
            <h3 className="lib-group__title">{group.title}</h3>
            <div className="lib-grid">
              {group.items.map((name) => (
                <button
                  type="button"
                  key={name}
                  className="lib-gcard"
                  draggable={true}
                  aria-label={`Add ${name} to design`}
                  title={name}
                  onClick={() => onAdd(name)}
                  onDragStart={(event) => handleDragStart(event, name)}
                >
                  <span className="lib-gcard__mark">
                    <ElementMark name={name} />
                  </span>
                  <span className="lib-gcard__name">{name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <footer className="lib-foot">Recolour, scale &amp; rotate any element after adding. Your own uploads live in Assets.</footer>
    </section>
  )
}
