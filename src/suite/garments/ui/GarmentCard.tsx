import type { Garment } from '../types'
import { categoryLabel } from '../types'
import { viewsSummary } from '../import/detect'

type Props = {
  garment: Garment
  admin?: boolean
  onOpen: (g: Garment) => void
  onDelete?: (g: Garment) => void
}

export function GarmentCard({ garment, admin, onOpen, onDelete }: Props) {
  return (
    <div className="gl-card">
      <button
        className="gl-card__thumb"
        type="button"
        onClick={() => onOpen(garment)}
        aria-label={`Open ${garment.name}`}
      >
        {garment.thumbUrl ? (
          <img className="gl-card__img" src={garment.thumbUrl} alt={garment.name} loading="lazy" />
        ) : (
          <span className="gl-card__ph">{garment.name.slice(0, 2).toUpperCase()}</span>
        )}
        <span className="gl-card__cat">{categoryLabel(garment.category)}</span>
        {garment.status !== 'published' && <span className="gl-card__flag">{garment.status}</span>}
        {garment.views.has3D && <span className="gl-card__badge3d">3D</span>}
      </button>
      <div className="gl-card__body">
        <div className="gl-card__text">
          <span className="gl-card__name" title={garment.name}>
            {garment.name}
          </span>
          <span className="gl-card__views">{viewsSummary(garment.views)}</span>
        </div>
        {admin && onDelete && (
          <button
            className="gl-card__del"
            type="button"
            onClick={() => onDelete(garment)}
            aria-label={`Delete ${garment.name}`}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
