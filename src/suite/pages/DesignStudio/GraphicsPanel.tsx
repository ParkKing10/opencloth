import type { DragEvent, ReactElement, ReactNode, SVGProps } from 'react'
import './library-panels.css'

const GRAPHIC_DRAG_MIME = 'application/x-threados-graphic'

function Mark({ children, ...p }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...p}
    >
      {children}
    </svg>
  )
}

type StarterGraphic = { name: string; mark: ReactElement }

const STARTER_GRAPHICS: readonly StarterGraphic[] = [
  {
    name: 'Box Logo',
    mark: (
      <Mark>
        <rect x="3.5" y="5" width="17" height="14" rx="3.2" />
        <text
          x="12"
          y="15.4"
          textAnchor="middle"
          fontSize="9.5"
          fontWeight={800}
          fill="currentColor"
          stroke="none"
        >
          T
        </text>
      </Mark>
    ),
  },
  {
    name: 'Star',
    mark: (
      <Mark>
        <polygon
          points="12,3 14.2,8.9 20.6,9.2 15.6,13.2 17.3,19.3 12,15.8 6.7,19.3 8.4,13.2 3.4,9.2 9.8,8.9"
          fill="currentColor"
          stroke="none"
        />
      </Mark>
    ),
  },
  {
    name: 'Flame',
    mark: (
      <Mark>
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </Mark>
    ),
  },
  {
    name: 'Smiley',
    mark: (
      <Mark>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="8.9" cy="9.9" r="1.05" fill="currentColor" stroke="none" />
        <circle cx="15.1" cy="9.9" r="1.05" fill="currentColor" stroke="none" />
        <path d="M8.2 14.3c.9 1.7 2.2 2.5 3.8 2.5s2.9-.8 3.8-2.5" />
      </Mark>
    ),
  },
  {
    name: 'Barcode',
    mark: (
      <Mark>
        <g fill="currentColor" stroke="none">
          <rect x="3" y="5.5" width="1.7" height="13" rx="0.5" />
          <rect x="6.2" y="5.5" width="1" height="13" rx="0.5" />
          <rect x="8.7" y="5.5" width="2.4" height="13" rx="0.5" />
          <rect x="12.6" y="5.5" width="1" height="13" rx="0.5" />
          <rect x="15" y="5.5" width="1.7" height="13" rx="0.5" />
          <rect x="18.2" y="5.5" width="1" height="13" rx="0.5" />
          <rect x="20.3" y="5.5" width="1.4" height="13" rx="0.5" />
        </g>
      </Mark>
    ),
  },
  {
    name: 'Lightning',
    mark: (
      <Mark>
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" fill="currentColor" stroke="none" />
      </Mark>
    ),
  },
  {
    name: 'Globe',
    mark: (
      <Mark>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17" />
        <ellipse cx="12" cy="12" rx="3.9" ry="8.5" />
      </Mark>
    ),
  },
  {
    name: 'Arch Text',
    mark: (
      <Mark>
        <path d="M4 16a8.5 8.5 0 0 1 16 0" />
        <path d="M6.5 19.5a6 6 0 0 1 11 0" />
      </Mark>
    ),
  },
]

function handleDragStart(event: DragEvent<HTMLButtonElement>, name: string): void {
  event.dataTransfer.setData(GRAPHIC_DRAG_MIME, name)
  event.dataTransfer.setData('text/plain', name)
  event.dataTransfer.effectAllowed = 'copy'
}

export function GraphicsPanel({ onAdd }: { onAdd: (name: string) => void }) {
  return (
    <section className="lib-panel" aria-label="Graphics">
      <header className="lib-head">
        <h2>Graphics</h2>
        <p className="lib-head__hint">Starter marks — drop them on your piece</p>
      </header>

      <div className="lib-scroll">
        <div className="lib-grid">
          {STARTER_GRAPHICS.map((graphic) => (
            <button
              type="button"
              key={graphic.name}
              className="lib-gcard"
              draggable={true}
              aria-label={`Add ${graphic.name} to design`}
              onClick={() => onAdd(graphic.name)}
              onDragStart={(event) => handleDragStart(event, graphic.name)}
            >
              <span className="lib-gcard__mark">{graphic.mark}</span>
              <span className="lib-gcard__name">{graphic.name}</span>
            </button>
          ))}
        </div>
      </div>

      <footer className="lib-foot">Your own uploads live in Assets.</footer>
    </section>
  )
}
