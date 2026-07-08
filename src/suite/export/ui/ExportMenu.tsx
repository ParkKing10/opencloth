import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../components/ui/Toast'
import { downloadBlob } from '../../lib/download'
import { buildManufacturingProject, type ProjectInput } from '../project'
import { EXPORT_ITEMS, type ExportItemId } from '../actions'
import { ExportModal } from './ExportModal'
import './export.css'

/** The Export control in the studio top bar: a dropdown of 8 real export actions. */
export function ExportMenu({ input }: { input: ProjectInput }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState<ExportItemId | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Rebuild the manufacturing project only when the design's identity changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const project = useMemo(() => buildManufacturingProject(input), [input.styleName, input.kind, input.fabricColor])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function run(id: ExportItemId) {
    const item = EXPORT_ITEMS.find((i) => i.id === id)
    if (!item) return
    if (item.kind === 'package') {
      setOpen(false)
      setModalOpen(true)
      return
    }
    if (!item.build) return
    setBusy(id)
    try {
      const { blob, filename } = await item.build(project)
      downloadBlob(blob, filename)
      toast(`Exported ${filename}`, 'accent')
      setOpen(false)
    } catch (err) {
      console.error(err)
      toast(`Could not export ${item.title}. Please try again.`, 'info')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="xm-wrap" ref={wrapRef}>
      <button
        className="s-btn s-btn--accent"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
        Export
        <svg className="xm-caret" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="xm-menu" role="menu">
          {EXPORT_ITEMS.map((item, i) => {
            const isPackage = item.kind === 'package'
            const isBusy = busy === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`xm-item${isPackage ? ' xm-item--hero' : ''}`}
                onClick={() => run(item.id)}
                disabled={busy !== null}
              >
                <span className="xm-item__badge">{item.badge}</span>
                <span className="xm-item__text">
                  <b>{item.title}</b>
                  <small>{item.desc}</small>
                </span>
                {isBusy ? (
                  <span className="xm-spin" aria-hidden />
                ) : isPackage ? (
                  <span className="xm-item__star">★</span>
                ) : (
                  <svg className="xm-item__arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                )}
                {i === 0 && <span className="xm-divider" aria-hidden />}
              </button>
            )
          })}
        </div>
      )}

      <ExportModal open={modalOpen} project={project} onClose={() => setModalOpen(false)} />
    </div>
  )
}
