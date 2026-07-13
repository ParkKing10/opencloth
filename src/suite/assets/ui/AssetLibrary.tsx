import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type SVGProps,
} from 'react'
import { createPortal } from 'react-dom'
import { useAssets } from '../useAssets'
import { filterAssets, recentAssets, FILTER_LABELS, type AssetFilter, type AssetSort } from '../assetFilter'
import { touchAsset, type Asset } from '../assetStore'
import { ACCEPT_ATTR } from '../assetThumb'
import { useToast } from '../../components/ui/Toast'
import { downloadBlob } from '../../lib/download'
import { IcoPlus, IcoUpload } from '../../components/ui/Icons'
import './asset-library.css'

/** Carries the library asset id when dragging onto the canvas; the studio resolves it to a layer. */
export const ASSET_DRAG_TYPE = 'application/x-threados-asset-id'

const FILTERS: AssetFilter[] = ['all', 'images', 'vectors', 'png', 'svg']
const SKELETON_CARDS = 6

const IcoStar = (p: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth={1.6} strokeLinejoin="round" {...p}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
  </svg>
)

const IcoMore = (p: SVGProps<SVGSVGElement>) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...p}>
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
)

function hasOsFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function fileTypeLabel(asset: Asset): string {
  if (asset.type === 'image/svg+xml') return 'SVG'
  const sub = asset.type.split('/')[1] ?? ''
  return (sub === 'jpeg' ? 'jpg' : sub).toUpperCase() || 'IMG'
}

/** Owns its thumbnail object URL so it is created lazily and revoked on unmount (no leaks at scale). */
function Thumb({ asset }: { asset: Asset }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const objUrl = URL.createObjectURL(asset.thumb)
    setUrl(objUrl)
    return () => URL.revokeObjectURL(objUrl)
  }, [asset.thumb])
  if (!url) return <span className="al-card__ph" aria-hidden="true" />
  return <img src={url} alt={asset.filename} loading="lazy" draggable={false} />
}

/** Full-resolution image for the lightbox — uses the asset's real blob (not the thumb). */
function LightboxImg({ asset }: { asset: Asset }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const objUrl = URL.createObjectURL(asset.blob)
    setUrl(objUrl)
    return () => URL.revokeObjectURL(objUrl)
  }, [asset.blob])
  return <img className="al-lb__img" src={url || undefined} alt={asset.filename} draggable={false} />
}

type Props = {
  userId: string | undefined
  onPlace: (assetId: string) => void
  /** Full-page mode (the Assets page): clicking a graphic opens a large lightbox with actions,
   *  and the grid uses more columns. In the narrow Studio rail this stays off. */
  page?: boolean
}

export function AssetLibrary({ userId, onPlace, page = false }: Props) {
  const toast = useToast()
  const { assets, loading, busy, upload, rename, duplicate, remove, toggleFavorite, refresh } = useAssets(userId)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<AssetFilter>('all')
  const [sort, setSort] = useState<AssetSort>('newest')
  const [menuId, setMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [lightbox, setLightbox] = useState<Asset | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  const visible = useMemo(() => filterAssets(assets, { query, filter, sort }), [assets, query, filter, sort])
  const recent = useMemo(() => recentAssets(assets), [assets])

  // Place onto the garment (studio owns the actual layer) and record recency so the Recent row updates.
  const handlePlace = useCallback(
    async (id: string) => {
      onPlace(id)
      await touchAsset(id)
      await refresh()
    },
    [onPlace, refresh],
  )

  const runUpload = useCallback(
    async (files: File[] | FileList) => {
      const res = await upload(files)
      if (res.added) toast(`${res.added} ${res.added === 1 ? 'asset' : 'assets'} added to your library.`, 'success')
      if (res.rejected.length) toast(`Skipped ${res.rejected.length} unsupported file(s). Use PNG, JPG, SVG or WEBP.`, 'info')
    },
    [upload, toast],
  )

  const handlePick = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : []
      event.target.value = ''
      if (files.length) void runUpload(files)
    },
    [runUpload],
  )

  const handleDragStart = useCallback((event: DragEvent<HTMLElement>, asset: Asset) => {
    event.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id)
    event.dataTransfer.setData('text/plain', asset.filename)
    event.dataTransfer.effectAllowed = 'copy'
  }, [])

  const handleDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    if (!hasOsFiles(event)) return
    event.preventDefault()
    dragDepth.current += 1
    setIsDragOver(true)
  }, [])
  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (!hasOsFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])
  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (!hasOsFiles(event)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragOver(false)
  }, [])
  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!hasOsFiles(event)) return
      event.preventDefault()
      dragDepth.current = 0
      setIsDragOver(false)
      void runUpload(event.dataTransfer.files)
    },
    [runUpload],
  )

  const startRename = useCallback((asset: Asset) => {
    setMenuId(null)
    setRenamingId(asset.id)
    setRenameText(asset.filename)
  }, [])

  const commitRename = useCallback(
    (id: string) => {
      void rename(id, renameText)
      setRenamingId(null)
    },
    [rename, renameText],
  )

  // Close any open card menu on outside click.
  useEffect(() => {
    if (!menuId) return
    const close = () => setMenuId(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuId])

  if (!userId) {
    return (
      <section className="al-panel" aria-label="Graphics library">
        <div className="al-empty">
          <p>Sign in to build your graphics library. Your uploads are saved to your account.</p>
        </div>
      </section>
    )
  }

  const isEmpty = !loading && assets.length === 0

  return (
    <section
      className={`al-panel${isDragOver ? ' is-drop' : ''}`}
      aria-label="Graphics library"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        className="al-file-input"
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        tabIndex={-1}
        aria-hidden="true"
        onChange={handlePick}
      />

      <header className="al-head">
        <div>
          <h2>Graphics</h2>
          <p className="al-head__hint">Your library — uploads + every AI creation, auto-saved. Drag or double-click onto the garment</p>
        </div>
        <button type="button" className="al-upload" onClick={() => fileInputRef.current?.click()} disabled={busy}>
          {busy ? <span className="al-spin" aria-hidden="true" /> : <IcoUpload width={13} height={13} />}
          Upload
        </button>
      </header>

      {loading && (
        <div className="al-scroll" aria-busy="true">
          <div className="al-grid">
            {Array.from({ length: SKELETON_CARDS }, (_, i) => (
              <div className="al-skel-card" key={i}>
                <div className="al-skel al-skel--thumb" />
                <div className="al-skel al-skel--line" />
              </div>
            ))}
          </div>
        </div>
      )}

      {isEmpty && (
        <div className="al-scroll">
          <div className="al-empty">
            <span className="al-empty__ico">
              <IcoUpload width={16} height={16} />
            </span>
            <p>Upload PNG, JPG, SVG or WEBP graphics — and everything you make with loom studios AI saves here automatically. All ready to drop onto any garment.</p>
            <button type="button" className="al-upload" onClick={() => fileInputRef.current?.click()}>
              <IcoUpload width={13} height={13} />
              Upload graphics
            </button>
          </div>
        </div>
      )}

      {!loading && !isEmpty && (
        <>
          <div className="al-tools">
            <div className="al-search">
              <input
                type="search"
                placeholder="Search graphics…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search graphics"
              />
            </div>
            <nav className="al-chips" aria-label="Filter graphics">
              {FILTERS.map((f) => (
                <button key={f} type="button" className={`al-chip${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>
                  {FILTER_LABELS[f]}
                </button>
              ))}
              <button
                type="button"
                className="al-chip al-chip--sort"
                onClick={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))}
                title="Toggle sort order"
              >
                {sort === 'newest' ? 'Newest' : 'Oldest'}
              </button>
            </nav>
          </div>

          <div className="al-scroll">
            {recent.length > 0 && (
              <div className="al-recent">
                <span className="al-section-label">Recent</span>
                <div className="al-recent__row">
                  {recent.map((asset) => (
                    <button
                      key={`r-${asset.id}`}
                      type="button"
                      className="al-recent__item"
                      title={`${asset.filename} — double-click to place`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, asset)}
                      onDoubleClick={() => void handlePlace(asset.id)}
                      onClick={() => void handlePlace(asset.id)}
                    >
                      <Thumb asset={asset} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <span className="al-section-label">{query || filter !== 'all' ? `${visible.length} result${visible.length === 1 ? '' : 's'}` : 'All graphics'}</span>
            {visible.length === 0 ? (
              <p className="al-none">No graphics match your search.</p>
            ) : (
              <div className="al-grid">
                {visible.map((asset) => (
                  <article
                    key={asset.id}
                    className={`al-card${page ? ' al-card--page' : ''}`}
                    draggable={renamingId !== asset.id}
                    onDragStart={(e) => handleDragStart(e, asset)}
                    onDoubleClick={page ? undefined : () => void handlePlace(asset.id)}
                  >
                    <div
                      className="al-card__thumb"
                      onClick={page ? () => setLightbox(asset) : undefined}
                      role={page ? 'button' : undefined}
                      title={page ? `Open “${asset.filename}”` : undefined}
                    >
                      <Thumb asset={asset} />
                      <button
                        type="button"
                        className={`al-star${asset.favorite ? ' is-on' : ''}`}
                        title={asset.favorite ? 'Remove from favorites' : 'Add to favorites'}
                        aria-label={asset.favorite ? 'Remove from favorites' : 'Add to favorites'}
                        aria-pressed={asset.favorite}
                        onClick={(e) => { e.stopPropagation(); void toggleFavorite(asset.id) }}
                      >
                        <IcoStar fill={asset.favorite ? 'currentColor' : 'none'} stroke="currentColor" />
                      </button>
                      {!page && (
                        <div className="al-card__hover">
                          <button type="button" className="al-add" title="Place in center" aria-label={`Place ${asset.filename}`} onClick={(e) => { e.stopPropagation(); void handlePlace(asset.id) }}>
                            <IcoPlus width={13} height={13} />
                            Place
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="al-card__meta">
                      {renamingId === asset.id ? (
                        <input
                          className="al-rename"
                          autoFocus
                          value={renameText}
                          onChange={(e) => setRenameText(e.target.value)}
                          onBlur={() => commitRename(asset.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(asset.id)
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                        />
                      ) : (
                        <span className="al-card__name" title={asset.filename}>
                          {asset.filename}
                        </span>
                      )}
                      <span className="al-card__sub">
                        {asset.width}×{asset.height} · {fileTypeLabel(asset)} · {fmtDate(asset.createdAt)}
                      </span>
                    </div>

                    <div className="al-card__menu-wrap">
                      <button
                        type="button"
                        className="al-kebab"
                        aria-label="Asset actions"
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuId((cur) => (cur === asset.id ? null : asset.id))
                        }}
                      >
                        <IcoMore />
                      </button>
                      {menuId === asset.id && (
                        <div className="al-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                          <button type="button" role="menuitem" onClick={() => startRename(asset)}>
                            Rename
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuId(null)
                              void duplicate(asset.id)
                            }}
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="al-menu__danger"
                            onClick={() => {
                              setMenuId(null)
                              void remove(asset.id)
                              toast('Removed from library. Projects that use it keep their own copy.')
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {isDragOver && (
        <div className="al-drop" aria-hidden="true">
          <span className="al-drop__pill">
            <IcoUpload width={14} height={14} />
            Drop to add to library
          </span>
        </div>
      )}

      {lightbox &&
        createPortal(
          <div className="suite">
            <div className="al-lb" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
              <div className="al-lb__panel" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="al-lb__x" aria-label="Close" onClick={() => setLightbox(null)}>×</button>
                <div className="al-lb__stage al-checker">
                  <LightboxImg asset={lightbox} />
                </div>
                <div className="al-lb__bar">
                  <div className="al-lb__info">
                    <span className="al-lb__name" title={lightbox.filename}>{lightbox.filename}</span>
                    <span className="al-lb__sub">{lightbox.width}×{lightbox.height} · {fileTypeLabel(lightbox)} · {fmtDate(lightbox.createdAt)}</span>
                  </div>
                  <div className="al-lb__actions">
                    <button type="button" className="s-btn" onClick={() => downloadBlob(lightbox.blob, lightbox.filename)}>Download</button>
                    <button type="button" className="s-btn s-btn--accent" onClick={() => { void handlePlace(lightbox.id); setLightbox(null) }}>Use in design</button>
                    <button type="button" className="s-btn" onClick={() => { const a = lightbox; setLightbox(null); void remove(a.id); toast('Removed from library. Projects that use it keep their own copy.') }}>Delete</button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  )
}
