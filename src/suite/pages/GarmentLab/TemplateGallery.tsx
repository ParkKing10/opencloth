/**
 * Browsable gallery of every garment template — a working product surface, not a static list.
 * Real state everywhere: instant search, clickable category tabs, a persisted favourites filter,
 * a recently-used row (updates when a template is used), a detail overlay with front+back preview,
 * and a Use Template action that loads the pick straight into the editor via onPick.
 */
import { useEffect, useMemo, useState } from 'react'
import { useT } from '@/i18n'
import { GARMENT_TEMPLATES, getTemplate, type GarmentTemplate } from '../../garment-model/garmentTemplates'
import { garmentThumbnailDataUrl } from '../../garment-model/garmentThumbnail'

type Props = {
  onPick: (templateId: string) => void
}

const CATEGORY_ORDER = ['Outerwear', 'Coats', 'Tops', 'Bottoms', 'Dresses', 'One-Piece', 'Accessories', 'Jewellery']
const FAVS_KEY = 'threados-tpl-favs-v1'
const RECENT_KEY = 'threados-tpl-recent-v1'
const RECENT_MAX = 8
const THUMB_BATCH = 12

function readIds(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
function writeIds(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    /* non-fatal */
  }
}

export function TemplateGallery({ onPick }: Props) {
  const t = useT()
  // Category values come from the template data (English). Translate for display only, with a safe
  // fallback to the raw value for any category not in the locale map.
  const catLabel = (c: string) => {
    const key = `labPanels.cat.${c}`
    const label = t(key)
    return label === key ? c : label
  }
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string>('all')
  const [favOnly, setFavOnly] = useState(false)
  const [favs, setFavs] = useState<Set<string>>(() => new Set(readIds(FAVS_KEY)))
  const [recent, setRecent] = useState<string[]>(() => readIds(RECENT_KEY))
  const [detailId, setDetailId] = useState<string | null>(null)

  // Thumbnails render in small batches so the gallery appears instantly with skeletons,
  // then fills in — a real loading state instead of a blocking build of 90+ SVGs.
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [thumbsReady, setThumbsReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    const map: Record<string, string> = {}
    let i = 0
    const step = () => {
      if (cancelled) return
      const end = Math.min(i + THUMB_BATCH, GARMENT_TEMPLATES.length)
      for (; i < end; i += 1) {
        const t = GARMENT_TEMPLATES[i]
        map[t.id] = garmentThumbnailDataUrl(t.make())
      }
      setThumbs({ ...map })
      if (i < GARMENT_TEMPLATES.length) setTimeout(step, 0)
      else setThumbsReady(true)
    }
    step()
    return () => {
      cancelled = true
    }
  }, [])

  const categories = useMemo(() => {
    const present = new Set(GARMENT_TEMPLATES.map((t) => t.category))
    return CATEGORY_ORDER.filter((c) => present.has(c)).concat([...present].filter((c) => !CATEGORY_ORDER.includes(c)).sort())
  }, [])

  const countByCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of GARMENT_TEMPLATES) m.set(t.category, (m.get(t.category) ?? 0) + 1)
    return m
  }, [])

  const q = query.trim().toLowerCase()
  const hasFilters = q !== '' || cat !== 'all' || favOnly

  const filtered = useMemo(
    () =>
      GARMENT_TEMPLATES.filter(
        (t) =>
          (cat === 'all' || t.category === cat) &&
          (!favOnly || favs.has(t.id)) &&
          (!q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)),
      ),
    [q, cat, favOnly, favs],
  )

  const groups = useMemo(() => {
    const byCat = new Map<string, GarmentTemplate[]>()
    for (const t of filtered) {
      const list = byCat.get(t.category) ?? []
      list.push(t)
      byCat.set(t.category, list)
    }
    return [...byCat.entries()].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a[0])
      const ib = CATEGORY_ORDER.indexOf(b[0])
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
  }, [filtered])

  const recentTemplates = useMemo(
    () => recent.map((id) => GARMENT_TEMPLATES.find((t) => t.id === id)).filter((t): t is GarmentTemplate => !!t),
    [recent],
  )

  // Detail data is built only when a card is opened (front + back previews + real region facts).
  const detail = useMemo(() => {
    if (!detailId) return null
    const t = getTemplate(detailId)
    if (!t) return null
    const g = t.make()
    const regions = Object.values(g.regions)
    const back = { ...g, views: [...g.views].reverse() }
    return {
      id: t.id,
      name: t.name,
      category: t.category,
      regionCount: regions.length,
      regionNames: regions.map((r) => r.name),
      front: garmentThumbnailDataUrl(g),
      back: garmentThumbnailDataUrl(back),
    }
  }, [detailId])

  function toggleFav(id: string) {
    setFavs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writeIds(FAVS_KEY, [...next])
      return next
    })
  }

  /** The one real "use" path: record recency, then hand the pick to the editor. */
  function useTemplate(id: string) {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_MAX)
      writeIds(RECENT_KEY, next)
      return next
    })
    setDetailId(null)
    onPick(id)
  }

  function clearFilters() {
    setQuery('')
    setCat('all')
    setFavOnly(false)
  }

  // Esc closes the detail overlay (skip for power users).
  useEffect(() => {
    if (!detailId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailId])

  const card = (tpl: GarmentTemplate, compact = false) => (
    <div
      key={tpl.id}
      role="button"
      tabIndex={0}
      className={`tgal__card${detailId === tpl.id ? ' is-open' : ''}${compact ? ' tgal__card--sm' : ''}`}
      onClick={() => setDetailId(tpl.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setDetailId(tpl.id)
        }
      }}
      aria-label={t('labPanels.gallery.cardAria', { name: tpl.name })}
    >
      <span className="tgal__thumb">
        {thumbs[tpl.id] ? (
          <img src={thumbs[tpl.id]} alt={tpl.name} loading="lazy" width={140} height={196} />
        ) : (
          <span className="tgal__skel" aria-hidden />
        )}
      </span>
      <button
        type="button"
        className={`tgal__star${favs.has(tpl.id) ? ' is-on' : ''}`}
        title={favs.has(tpl.id) ? t('labPanels.gallery.removeFav') : t('labPanels.gallery.addFav')}
        aria-label={favs.has(tpl.id) ? t('labPanels.gallery.unfavAria', { name: tpl.name }) : t('labPanels.gallery.favAria', { name: tpl.name })}
        aria-pressed={favs.has(tpl.id)}
        onClick={(e) => {
          e.stopPropagation()
          toggleFav(tpl.id)
        }}
      >
        ★
      </button>
      <span className="tgal__name">{tpl.name}</span>
    </div>
  )

  return (
    <div className="tgal">
      <div className="tgal__bar">
        <input
          className="tgal__search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('labPanels.gallery.searchPlaceholder', { n: GARMENT_TEMPLATES.length })}
          aria-label={t('labPanels.gallery.searchAria')}
        />
        <button
          type="button"
          className={`tgal__favtoggle${favOnly ? ' is-on' : ''}`}
          onClick={() => setFavOnly((v) => !v)}
          aria-pressed={favOnly}
          title={t('labPanels.gallery.favouritesOnly')}
        >
          ★ {t('labPanels.gallery.favourites')}{favs.size > 0 ? ` · ${favs.size}` : ''}
        </button>
      </div>

      <div className="tgal__tabs" role="tablist" aria-label={t('labPanels.gallery.filterByCategory')}>
        <button type="button" role="tab" aria-selected={cat === 'all'} className={`tgal__tab${cat === 'all' ? ' is-active' : ''}`} onClick={() => setCat('all')}>
          {t('labPanels.gallery.all')} · {GARMENT_TEMPLATES.length}
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={cat === c}
            className={`tgal__tab${cat === c ? ' is-active' : ''}`}
            onClick={() => setCat((cur) => (cur === c ? 'all' : c))}
          >
            {catLabel(c)} · {countByCat.get(c) ?? 0}
          </button>
        ))}
      </div>

      <div className="tgal__meta">
        <span className="tgal__count" aria-live="polite">
          {hasFilters
            ? t('labPanels.gallery.countFiltered', { n: filtered.length, total: GARMENT_TEMPLATES.length })
            : t('labPanels.gallery.countAll', { total: GARMENT_TEMPLATES.length })}
          {!thumbsReady && t('labPanels.gallery.rendering')}
        </span>
        {hasFilters && (
          <button type="button" className="tgal__clear" onClick={clearFilters}>
            {t('labPanels.gallery.clearFilters')} ×
          </button>
        )}
      </div>

      {!hasFilters && recentTemplates.length > 0 && (
        <section className="tgal__group">
          <h3 className="tgal__cat">{t('labPanels.gallery.recentlyUsed')}</h3>
          <div className="tgal__recent">{recentTemplates.map((tpl) => card(tpl, true))}</div>
        </section>
      )}

      {filtered.length === 0 && (
        <div className="tgal__empty">
          {favOnly && favs.size === 0 ? (
            <>
              <p>{t('labPanels.gallery.noFavs')}</p>
              <button type="button" className="tgal__clear" onClick={() => setFavOnly(false)}>
                {t('labPanels.gallery.showAll')}
              </button>
            </>
          ) : (
            <>
              <p>
                {q && cat !== 'all'
                  ? t('labPanels.gallery.noMatchQueryCat', { query: query.trim(), cat: catLabel(cat) })
                  : q
                    ? t('labPanels.gallery.noMatchQuery', { query: query.trim() })
                    : cat !== 'all'
                      ? t('labPanels.gallery.noMatchCat', { cat: catLabel(cat) })
                      : t('labPanels.gallery.noMatchNone')}
              </p>
              <button type="button" className="tgal__clear" onClick={clearFilters}>
                {t('labPanels.gallery.clearFilters')}
              </button>
            </>
          )}
        </div>
      )}

      {groups.map(([category, list]) => (
        <section key={category} className="tgal__group">
          <h3 className="tgal__cat">
            {catLabel(category)} <span className="tgal__cat-n">{list.length}</span>
          </h3>
          <div className="tgal__grid">{list.map((tpl) => card(tpl))}</div>
        </section>
      ))}

      {detail && (
        <div className="tgd" role="dialog" aria-modal="true" aria-label={t('labPanels.gallery.detailAria', { name: detail.name })} onClick={() => setDetailId(null)}>
          <div className="tgd__panel" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="tgd__close" aria-label={t('labPanels.gallery.closeDetails')} onClick={() => setDetailId(null)}>
              ×
            </button>
            <div className="tgd__views">
              <figure>
                <span className="tgd__img"><img src={detail.front} alt={t('labPanels.gallery.altFront', { name: detail.name })} /></span>
                <figcaption>{t('labPanels.gallery.front')}</figcaption>
              </figure>
              <figure>
                <span className="tgd__img"><img src={detail.back} alt={t('labPanels.gallery.altBack', { name: detail.name })} /></span>
                <figcaption>{t('labPanels.gallery.back')}</figcaption>
              </figure>
            </div>
            <div className="tgd__meta">
              <span className="tgd__eyebrow">{catLabel(detail.category)}</span>
              <h3>{detail.name}</h3>
              <p className="tgd__facts">
                {t('labPanels.gallery.facts', { n: detail.regionCount })}
              </p>
              <div className="tgd__regions">
                {detail.regionNames.slice(0, 10).map((n) => (
                  <span key={n} className="tgd__region">{n}</span>
                ))}
                {detail.regionNames.length > 10 && <span className="tgd__region tgd__region--more">{t('labPanels.gallery.more', { n: detail.regionNames.length - 10 })}</span>}
              </div>
              <div className="tgd__actions">
                <button type="button" className="tgd__use" onClick={() => useTemplate(detail.id)}>
                  {t('labPanels.gallery.useTemplate')} →
                </button>
                <button
                  type="button"
                  className={`tgal__favtoggle${favs.has(detail.id) ? ' is-on' : ''}`}
                  onClick={() => toggleFav(detail.id)}
                  aria-pressed={favs.has(detail.id)}
                >
                  ★ {favs.has(detail.id) ? t('labPanels.gallery.favourited') : t('labPanels.gallery.favourite')}
                </button>
              </div>
              <p className="tgd__hint">{t('labPanels.gallery.detailHint')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
