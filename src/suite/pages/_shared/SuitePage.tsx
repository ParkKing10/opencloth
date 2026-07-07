import type { ReactNode } from 'react'
import './shared.css'

type Props = {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  wide?: boolean
}

/** Standard page frame: header (title/subtitle/actions) + content. */
export function SuitePage({ eyebrow, title, subtitle, actions, children, wide }: Props) {
  return (
    <div className={`page${wide ? ' page--wide' : ''}`}>
      <header className="page__head">
        <div>
          {eyebrow && <p className="page__eyebrow">{eyebrow}</p>}
          <h1 className="page__title">{title}</h1>
          {subtitle && <p className="page__sub">{subtitle}</p>}
        </div>
        {actions && <div className="page__actions">{actions}</div>}
      </header>
      {children}
    </div>
  )
}
