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
import {
  DRIVE_FOLDERS,
  deleteAsset,
  listAssets,
  uploadAsset,
  type DriveAsset,
  type DriveFolder,
} from '../driveClient'
import { useToast } from '../../components/ui/Toast'
import { IcoPlus, IcoUpload } from '../../components/ui/Icons'
import './drive.css'

const SKELETON_CHIP_COUNT = 3
const SKELETON_CARD_COUNT = 6

type FolderFilter = 'All' | DriveFolder

const IcoTrash = (p: SVGProps<SVGSVGElement>) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M4 7h16M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
    <path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" />
    <path d="M10 11v6M14 11v6" />
  </svg>
)

const IcoFile = (p: SVGProps<SVGSVGElement>) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14 3v4h4" />
  </svg>
)

function fileExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toUpperCase().slice(0, 5) : 'FILE'
}

function isRenderableImage(asset: DriveAsset): boolean {
  return asset.mime.startsWith('image/') || asset.name.toLowerCase().endsWith('.svg')
}

function hasOsFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

export function DrivePanel({ onAddToDesign }: { onAddToDesign: (asset: DriveAsset) => void }) {
  const toast = useToast()
  const [assets, setAssets] = useState<DriveAsset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FolderFilter>('All')
  const [uploadingCount, setUploadingCount] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)

  useEffect(() => {
    let cancelled = false
    listAssets()
      .then((items) => {
        if (!cancelled) setAssets(items)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const folderCounts = useMemo(() => {
    const counts = new Map<DriveFolder, number>()
    for (const asset of assets) counts.set(asset.folder, (counts.get(asset.folder) ?? 0) + 1)
    return counts
  }, [assets])

  /* If the selected folder empties out (e.g. last asset deleted), fall back to All. */
  const activeFilter: FolderFilter = filter !== 'All' && !folderCounts.has(filter) ? 'All' : filter

  const visibleAssets = useMemo(
    () => (activeFilter === 'All' ? assets : assets.filter((a) => a.folder === activeFilter)),
    [assets, activeFilter],
  )

  const uploadFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return
      setUploadingCount((n) => n + files.length)
      for (const file of files) {
        const result = await uploadAsset(file)
        if (result.ok) {
          setAssets((prev) => [result.value, ...prev])
          toast(`Uploaded to ${result.value.folder}.`, 'success')
        } else {
          toast(result.error, 'info')
        }
        setUploadingCount((n) => n - 1)
      }
    },
    [toast],
  )

  const openPicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handlePick = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : []
      event.target.value = ''
      void uploadFiles(files)
    },
    [uploadFiles],
  )

  const handleDelete = useCallback(
    async (asset: DriveAsset) => {
      const result = await deleteAsset(asset)
      if (!result.ok) {
        toast(result.error, 'info')
        return
      }
      setAssets((prev) => prev.filter((a) => a.id !== asset.id))
      toast('Removed from Drive.')
    },
    [toast],
  )

  const handleAssetDragStart = useCallback((event: DragEvent<HTMLElement>, asset: DriveAsset) => {
    event.dataTransfer.setData(
      'application/x-threados-asset',
      JSON.stringify({ id: asset.id, name: asset.name, folder: asset.folder, url: asset.url, mime: asset.mime }),
    )
    event.dataTransfer.setData('text/plain', asset.name)
    event.dataTransfer.effectAllowed = 'copy'
  }, [])

  /* OS-file drag-and-drop on the whole panel (depth counter avoids child flicker). */
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
      void uploadFiles(Array.from(event.dataTransfer.files))
    },
    [uploadFiles],
  )

  const isEmpty = !isLoading && assets.length === 0

  const uploadingNote =
    uploadingCount > 0 ? (
      <div className="dv-uploading" role="status">
        <span className="dv-spin" aria-hidden="true" />
        Uploading {uploadingCount} {uploadingCount === 1 ? 'file' : 'files'}…
      </div>
    ) : null

  return (
    <section
      className={`dv-panel${isDragOver ? ' is-drop' : ''}`}
      aria-label="Drive"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        className="dv-file-input"
        type="file"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={handlePick}
      />

      <header className="dv-head">
        <div>
          <h2>Drive</h2>
          <p className="dv-head__hint">Your permanent brand storage</p>
        </div>
        <button type="button" className="dv-upload" onClick={openPicker}>
          <IcoUpload width={13} height={13} />
          Upload
        </button>
      </header>

      {isLoading && (
        <>
          <div className="dv-chips" aria-hidden="true">
            {Array.from({ length: SKELETON_CHIP_COUNT }, (_, i) => (
              <span className="dv-skel dv-skel--chip" key={i} />
            ))}
          </div>
          <div className="dv-scroll" aria-busy="true">
            <div className="dv-grid">
              {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
                <div className="dv-skel-card" key={i}>
                  <div className="dv-skel dv-skel--thumb" />
                  <div className="dv-skel dv-skel--line" />
                  <div className="dv-skel dv-skel--line dv-skel--short" />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {isEmpty && (
        <div className="dv-scroll">
          {uploadingNote}
          <div className="dv-empty">
            <span className="dv-empty__ico">
              <IcoUpload width={16} height={16} />
            </span>
            <p>Drop files here — logos, graphics, patterns, fonts. THREADOS files them automatically.</p>
            <button type="button" className="dv-upload" onClick={openPicker}>
              <IcoUpload width={13} height={13} />
              Upload
            </button>
          </div>
        </div>
      )}

      {!isLoading && !isEmpty && (
        <>
          <nav className="dv-chips" aria-label="Drive folders">
            <button
              type="button"
              className={`dv-chip${activeFilter === 'All' ? ' is-active' : ''}`}
              onClick={() => setFilter('All')}
            >
              All
              <span className="dv-chip__count">{assets.length}</span>
            </button>
            {DRIVE_FOLDERS.filter((folder) => folderCounts.has(folder)).map((folder) => (
              <button
                type="button"
                key={folder}
                className={`dv-chip${activeFilter === folder ? ' is-active' : ''}`}
                onClick={() => setFilter(folder)}
              >
                {folder}
                <span className="dv-chip__count">{folderCounts.get(folder)}</span>
              </button>
            ))}
          </nav>

          <div className="dv-scroll">
            {uploadingNote}
            <div className="dv-grid">
              {visibleAssets.map((asset) => (
                <article
                  key={asset.id}
                  className="dv-card"
                  draggable={true}
                  onDragStart={(event: DragEvent<HTMLElement>) => handleAssetDragStart(event, asset)}
                >
                  <div className="dv-card__thumb">
                    {isRenderableImage(asset) ? (
                      <img src={asset.url} alt={asset.name} loading="lazy" draggable={false} />
                    ) : (
                      <span className="dv-card__glyph">
                        <IcoFile width={22} height={22} />
                        <span className="dv-card__ext">{fileExt(asset.name)}</span>
                      </span>
                    )}
                    <div className="dv-card__actions">
                      <button
                        type="button"
                        className="dv-act dv-act--add"
                        title="Add to design"
                        aria-label={`Add ${asset.name} to design`}
                        onClick={() => onAddToDesign(asset)}
                      >
                        <IcoPlus width={13} height={13} />
                      </button>
                      <button
                        type="button"
                        className="dv-act dv-act--del"
                        title="Remove from Drive"
                        aria-label={`Remove ${asset.name} from Drive`}
                        onClick={() => void handleDelete(asset)}
                      >
                        <IcoTrash width={13} height={13} />
                      </button>
                    </div>
                  </div>
                  <div className="dv-card__meta">
                    <span className="dv-card__name" title={asset.name}>
                      {asset.name}
                    </span>
                    <span className="dv-card__folder">{asset.folder}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </>
      )}

      <footer className="dv-foot">
        SVG → Logos · PNG → Graphics · DXF → Patterns · TTF → Fonts · JPG → References
      </footer>

      {isDragOver && (
        <div className="dv-drop" aria-hidden="true">
          <span className="dv-drop__pill">
            <IcoUpload width={14} height={14} />
            Drop to file it
          </span>
        </div>
      )}
    </section>
  )
}
