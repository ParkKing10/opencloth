/**
 * The garment layer tree (Milestone 8.2, Parts 3 & 9). A professional layer panel: nested hierarchy
 * with collapse/expand, hover highlight, selection, visibility, lock, inline rename, and reorder.
 * Framed as GARMENT layers, with a DESIGN section so the user always knows what belongs to the
 * garment vs. the artwork (artwork layers live in the Design Studio).
 */
import { useMemo, useState, type SVGProps } from 'react'
import type { EditableGarment } from '../../garment-model/editableGarment'
import { flattenRegions } from '../../garment-model/regionTree'

const IcoEye = (p: SVGProps<SVGSVGElement>) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
const IcoEyeOff = (p: SVGProps<SVGSVGElement>) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4 4M6.5 6.6C4 8.1 2 12 2 12s3.5 7 10 7a10 10 0 0 0 4.3-1M9.9 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.4 3.3" />
  </svg>
)
const IcoLock = (p: SVGProps<SVGSVGElement>) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)
const IcoUnlock = (p: SVGProps<SVGSVGElement>) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 7.5-2" />
  </svg>
)
const IcoUp = (p: SVGProps<SVGSVGElement>) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M6 15l6-6 6 6" />
  </svg>
)
const IcoDown = (p: SVGProps<SVGSVGElement>) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)
const IcoChevron = ({ open, ...p }: { open: boolean } & SVGProps<SVGSVGElement>) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms ease' }} {...p}>
    <path d="M9 6l6 6-6 6" />
  </svg>
)

type Props = {
  garment: EditableGarment
  selectedId: string | null
  onSelect: (id: string) => void
  onHighlight: (id: string | null) => void
  onToggleVisible: (id: string) => void
  onToggleLocked: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onRename: (id: string, name: string) => void
}

export function RegionTreePanel({ garment, selectedId, onSelect, onHighlight, onToggleVisible, onToggleLocked, onMove, onRename }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')

  const all = flattenRegions(garment)

  // Hide descendants of any collapsed region.
  const hidden = useMemo(() => {
    const set = new Set<string>()
    const mark = (id: string) => {
      const r = garment.regions[id]
      r?.children.forEach((c) => {
        set.add(c)
        mark(c)
      })
    }
    collapsed.forEach(mark)
    return set
  }, [collapsed, garment.regions])

  const rows = all.filter((r) => !hidden.has(r.region.id))

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const commitRename = (id: string) => {
    onRename(id, renameText)
    setRenamingId(null)
  }

  return (
    <div className="eg-tree" role="tree" aria-label="Garment layers">
      <div className="eg-tree__head">
        <span className="eg-tree__title">{garment.name}</span>
        <span className="eg-tree__count">{all.length} regions</span>
      </div>

      <div className="eg-tree__list">
        <span className="eg-tree__section">Garment</span>
        {rows.map(({ region, depth }) => {
          const hasChildren = region.children.length > 0
          return (
            <div
              key={region.id}
              role="treeitem"
              aria-selected={region.id === selectedId}
              aria-expanded={hasChildren ? !collapsed.has(region.id) : undefined}
              className={`eg-row${region.id === selectedId ? ' is-selected' : ''}${region.visible ? '' : ' is-hidden'}`}
              style={{ paddingLeft: 6 + depth * 14 }}
              onMouseEnter={() => onHighlight(region.id)}
              onMouseLeave={() => onHighlight(null)}
            >
              {hasChildren ? (
                <button type="button" className="eg-caret" onClick={() => toggleCollapse(region.id)} aria-label={collapsed.has(region.id) ? 'Expand' : 'Collapse'}>
                  <IcoChevron open={!collapsed.has(region.id)} />
                </button>
              ) : (
                <span className="eg-caret eg-caret--leaf" aria-hidden="true" />
              )}

              {renamingId === region.id ? (
                <input
                  className="eg-row__rename"
                  autoFocus
                  value={renameText}
                  onChange={(e) => setRenameText(e.target.value)}
                  onBlur={() => commitRename(region.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(region.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  aria-label="Region name"
                />
              ) : (
                <button
                  type="button"
                  className="eg-row__name"
                  onClick={() => onSelect(region.id)}
                  onDoubleClick={() => {
                    setRenameText(region.name)
                    setRenamingId(region.id)
                  }}
                  title={`${region.type} region — double-click to rename`}
                >
                  <span className={`eg-row__dot eg-dot--${region.type}`} aria-hidden="true" />
                  <span className="eg-row__label">{region.name}</span>
                  <span className="eg-row__type">{region.type}</span>
                </button>
              )}

              <div className="eg-row__actions">
                <button type="button" className="eg-icobtn" title="Move up" aria-label="Move up" onClick={() => onMove(region.id, -1)}>
                  <IcoUp />
                </button>
                <button type="button" className="eg-icobtn" title="Move down" aria-label="Move down" onClick={() => onMove(region.id, 1)}>
                  <IcoDown />
                </button>
                <button
                  type="button"
                  className={`eg-icobtn${region.locked ? ' is-on' : ''}`}
                  title={region.locked ? 'Unlock' : 'Lock'}
                  aria-label={region.locked ? 'Unlock region' : 'Lock region'}
                  aria-pressed={region.locked}
                  onClick={() => onToggleLocked(region.id)}
                >
                  {region.locked ? <IcoLock /> : <IcoUnlock />}
                </button>
                <button
                  type="button"
                  className={`eg-icobtn${region.visible ? '' : ' is-off'}`}
                  title={region.visible ? 'Hide' : 'Show'}
                  aria-label={region.visible ? 'Hide region' : 'Show region'}
                  aria-pressed={!region.visible}
                  onClick={() => onToggleVisible(region.id)}
                >
                  {region.visible ? <IcoEye /> : <IcoEyeOff />}
                </button>
              </div>
            </div>
          )
        })}

        <span className="eg-tree__section eg-tree__section--design">Design</span>
        <p className="eg-tree__design-note">Artwork layers (logos, text, graphics) appear here when you design this garment in the Design Studio.</p>
      </div>
    </div>
  )
}
