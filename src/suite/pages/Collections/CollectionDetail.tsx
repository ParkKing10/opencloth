import { useMemo } from 'react'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { SuitePage } from '../_shared/SuitePage'
import { useStore } from '../../data/store'
import { GARMENT_GLYPHS } from '../../components/ui/Garments'
import { relativeTime } from '../../data/utils'
import { loadDesignThumb } from '../../data/designThumbs'
import { IcoPlus } from '../../components/ui/Icons'
import { useT } from '@/i18n'
import '../Dashboard/dashboard.css'
import './col.css'

/** A collection opened — the designs saved inside it, each opening in the Design Studio. */
export function CollectionDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data } = useStore()
  const t = useT()

  const collection = data.collections.find((c) => c.id === id)
  const designs = useMemo(
    () => data.designs.filter((d) => d.collectionId === id).sort((a, b) => b.updatedAt - a.updatedAt),
    [data.designs, id],
  )

  if (!collection) return <Navigate to="/suite/collections" replace />

  const open = (d: { id: string; name: string }) =>
    navigate(`/suite/studio?garment=${encodeURIComponent(d.id)}&name=${encodeURIComponent(d.name)}`)

  const countLabel =
    designs.length === 1
      ? t('collections.detail.countOne', { n: designs.length })
      : t('collections.detail.countMany', { n: designs.length })
  const subtitle = collection.season ? `${countLabel} · ${collection.season}` : countLabel

  return (
    <SuitePage
      eyebrow={t('collections.detail.eyebrow')}
      title={collection.name}
      subtitle={subtitle}
      actions={
        <button type="button" className="s-btn s-btn--ghost" onClick={() => navigate('/suite/collections')}>
          ← {t('collections.detail.allCollections')}
        </button>
      }
    >
      {designs.length === 0 ? (
        <div className="col-detail__empty">
          <p>{t('collections.detail.emptyBody')}</p>
          <button type="button" className="s-btn s-btn--accent" onClick={() => navigate('/suite/design')}>
            <IcoPlus width="15" height="15" /> {t('collections.detail.startDesign')}
          </button>
        </div>
      ) : (
        <div className="dash-designs">
          {designs.map((d) => {
            const Glyph = GARMENT_GLYPHS[d.kind]
            const thumb = loadDesignThumb(d.id)
            return (
              <article key={d.id} className="design" title={t('collections.detail.openTitle', { name: d.name })} onClick={() => open(d)}>
                <div className={`design__preview${thumb ? ' design__preview--img' : ''}`}>
                  {thumb ? <img src={thumb} alt={d.name} loading="lazy" /> : <Glyph width="52" height="52" />}
                </div>
                <div className="design__meta">
                  <span className="design__name">{d.name}</span>
                  <span className="design__mod">
                    <Glyph width="13" height="13" />
                    <span className="design__type">{d.kind}</span>
                    <span className="design__dot">·</span>
                    <span>{relativeTime(d.updatedAt)}</span>
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </SuitePage>
  )
}
