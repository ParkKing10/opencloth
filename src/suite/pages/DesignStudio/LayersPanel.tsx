import { useEffect, useMemo, useRef, useState } from 'react'
import { IcoChevron, IcoPlus, IcoSearch } from '../../components/ui/Icons'
import { useToast } from '../../components/ui/Toast'
import { GRAPHIC_MARKS, type CanvasObject } from './objectModel'
import './layers.css'

/** A small preview of a layer's content — text glyph, image, or graphic mark. */
function LayerThumb({ obj }: { obj: CanvasObject }) {
  if (obj.type === 'image' && obj.src) {
    return <span className="lp-row__thumb"><img src={obj.src} alt="" /></span>
  }
  if (obj.type === 'graphic' && obj.glyph && GRAPHIC_MARKS[obj.glyph]) {
    return (
      <span className="lp-row__thumb" style={{ color: obj.color || 'currentColor' }}>
        <svg viewBox="0 0 100 100" dangerouslySetInnerHTML={{ __html: GRAPHIC_MARKS[obj.glyph] }} />
      </span>
    )
  }
  if (obj.type === 'shape' || obj.type === 'path') {
    const aspect = obj.aspect && obj.aspect > 0 ? obj.aspect : 1
    const vbH = 100 * aspect
    const fill = obj.fill && obj.fill !== 'none' ? obj.fill : 'none'
    const rawStroke = obj.stroke && obj.stroke !== 'none' ? obj.stroke : 'none'
    // Outline-only shapes need a visible stroke in the thumb, so fall back to the row colour.
    const stroke = rawStroke === 'none' && fill === 'none' ? 'currentColor' : rawStroke
    const sw = Math.max(obj.strokeWidth ?? 0, fill === 'none' ? 5 : 0)
    return (
      <span className="lp-row__thumb">
        <svg viewBox={`0 0 100 ${vbH}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }}>
          {obj.type === 'path' ? (
            <path d={obj.d ?? ''} fill={obj.closed ? fill : 'none'} stroke={stroke === 'none' ? 'currentColor' : stroke} strokeWidth={Math.max(5, obj.strokeWidth ?? 0)} strokeLinecap="round" />
          ) : obj.shape === 'ellipse' ? (
            <ellipse cx={50} cy={vbH / 2} rx={Math.max(1, 50 - sw / 2)} ry={Math.max(1, vbH / 2 - sw / 2)} fill={fill} stroke={stroke} strokeWidth={sw} />
          ) : (
            <rect x={sw / 2} y={sw / 2} width={Math.max(1, 100 - sw)} height={Math.max(1, vbH - sw)} rx={obj.cornerRadius ?? 0} fill={fill} stroke={stroke} strokeWidth={sw} />
          )}
        </svg>
      </span>
    )
  }
  // text (or a graphic with no mark): show the first glyph on a chip
  const ch = (obj.text?.trim()?.[0] ?? 'T').toUpperCase()
  return (
    <span className="lp-row__thumb lp-row__thumb--text" style={{ color: obj.color || undefined }}>
      {ch}
    </span>
  )
}

/** One entry in the layer stack. A group is a layer of type 'Group'; members point at it. */
export type Layer = {
  id: string
  name: string
  type: string
  locked?: boolean
  /** Color label (Figma-style organisational dot). */
  color?: string
  /** Parent group id — one level deep. */
  groupId?: string
  /** Groups only: collapse their members in the list. */
  collapsed?: boolean
  /** A placeable canvas object (text / image / graphic). Absent = garment part. */
  obj?: import('./objectModel').CanvasObject
}

export const LAYER_COLORS = ['', '#d1f94f', '#5aa2ff', '#ff6ba6', '#f5b544', '#3ecf8e'] as const

/** One row of the garment's own region tree, shown as a layer (Body, Sleeve, Collar…). */
export type GarmentRegionLayer = { id: string; name: string; type: string; depth: number; visible: boolean; color?: string }

type Props = {
  layers: Layer[]
  hidden: Record<string, boolean>
  selectedIds: string[]
  /** Commit a new stack + visibility to the undo history. */
  onCommit: (layers: Layer[], hidden: Record<string, boolean>) => void
  onSelect: (ids: string[]) => void
  onAddLayer: () => void
  /** Minimized to just the header row (default state — the canvas is the star). */
  collapsed?: boolean
  onToggleCollapse?: () => void
  /** The base garment (design surface) — a pinned, selectable layer beneath the design. */
  baseGarmentName?: string
  baseSelected?: boolean
  onSelectBase?: () => void
  /** The garment's OWN region tree, shown as controllable layers above the design layers. */
  garmentRegions?: GarmentRegionLayer[]
  garmentTitle?: string
  garmentSelectedId?: string | null
  onToggleRegion?: (id: string) => void
  onSelectRegion?: (id: string) => void
  onCycleRegionColor?: (id: string) => void
  /** Right-click on a design-layer row. */
  onRowContextMenu?: (id: string, x: number, y: number) => void
  /** Filled with a function that starts inline rename for a layer id (used by the context menu). */
  renameHandle?: React.MutableRefObject<((id: string) => void) | null>
}

const uid = () => `l-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export function LayersPanel({
  layers,
  hidden,
  selectedIds,
  onCommit,
  onSelect,
  onAddLayer,
  collapsed,
  onToggleCollapse,
  baseGarmentName,
  baseSelected,
  onSelectBase,
  garmentRegions,
  garmentTitle,
  garmentSelectedId,
  onToggleRegion,
  onSelectRegion,
  onCycleRegionColor,
  onRowContextMenu,
  renameHandle,
}: Props) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  // Expose "start rename" so the right-click context menu can trigger inline rename.
  useEffect(() => {
    if (renameHandle) renameHandle.current = (id: string) => setRenaming(id)
  }, [renameHandle])
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<{ id: string; after: boolean } | null>(null)
  const lastClicked = useRef<string | null>(null)

  const byId = useMemo(() => new Map(layers.map((l) => [l.id, l])), [layers])
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])

  /** Rows in render order: groups pull their members directly beneath them. */
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out: { layer: Layer; depth: number }[] = []
    const topLevel = layers.filter((l) => !l.groupId)
    for (const l of topLevel) {
      out.push({ layer: l, depth: 0 })
      if (l.type === 'Group' && !l.collapsed) {
        layers.filter((m) => m.groupId === l.id).forEach((m) => out.push({ layer: m, depth: 1 }))
      }
    }
    if (!q) return out
    return out.filter(({ layer }) => layer.name.toLowerCase().includes(q) || layer.type.toLowerCase().includes(q))
  }, [layers, query])

  const effLocked = (l: Layer): boolean => !!l.locked || (!!l.groupId && !!byId.get(l.groupId)?.locked)
  const effHidden = (l: Layer): boolean => !!hidden[l.id] || (!!l.groupId && !!hidden[l.groupId!])
  const membersOf = (groupId: string) => layers.filter((m) => m.groupId === groupId)

  // ---------- selection ----------
  function clickRow(e: React.MouseEvent, layer: Layer) {
    if (e.shiftKey && lastClicked.current) {
      const ids = rows.map((r) => r.layer.id)
      const a = ids.indexOf(lastClicked.current)
      const b = ids.indexOf(layer.id)
      if (a !== -1 && b !== -1) {
        onSelect(ids.slice(Math.min(a, b), Math.max(a, b) + 1))
        return
      }
    }
    if (e.metaKey || e.ctrlKey) {
      onSelect(selected.has(layer.id) ? selectedIds.filter((id) => id !== layer.id) : [...selectedIds, layer.id])
    } else {
      onSelect([layer.id])
    }
    lastClicked.current = layer.id
  }

  /** Row to refocus once the rename input has actually unmounted. */
  const pendingFocus = useRef<string | null>(null)
  function refocusRow(id: string) {
    pendingFocus.current = id
  }
  useEffect(() => {
    // Runs after commit — the input is gone, so focus sticks to the row.
    if (renaming !== null || !pendingFocus.current) return
    const row = document.querySelector<HTMLElement>(`.lp-row[data-layer-id="${pendingFocus.current}"]`)
    pendingFocus.current = null
    row?.focus()
  }, [renaming])

  // ---------- operations (all commit through the undo history) ----------
  function rename(layer: Layer, name: string) {
    setRenaming(null)
    refocusRow(layer.id)
    const trimmed = name.trim()
    if (!trimmed || trimmed === layer.name) return
    onCommit(layers.map((l) => (l.id === layer.id ? { ...l, name: trimmed } : l)), hidden)
  }

  function toggleLock(layer: Layer) {
    onCommit(layers.map((l) => (l.id === layer.id ? { ...l, locked: !l.locked } : l)), hidden)
  }

  function toggleHidden(layer: Layer) {
    onCommit(layers, { ...hidden, [layer.id]: !hidden[layer.id] })
  }

  function toggleCollapse(group: Layer) {
    onCommit(layers.map((l) => (l.id === group.id ? { ...l, collapsed: !l.collapsed } : l)), hidden)
  }

  function cycleColor(layer: Layer) {
    const idx = LAYER_COLORS.indexOf((layer.color ?? '') as (typeof LAYER_COLORS)[number])
    const next = LAYER_COLORS[(idx + 1) % LAYER_COLORS.length]
    onCommit(layers.map((l) => (l.id === layer.id ? { ...l, color: next || undefined } : l)), hidden)
  }

  function duplicate(layer: Layer) {
    const clones: Layer[] = []
    const copy = { ...layer, id: uid(), name: `${layer.name} copy`, locked: false }
    clones.push(copy)
    if (layer.type === 'Group') {
      membersOf(layer.id).forEach((m) => clones.push({ ...m, id: uid(), groupId: copy.id, locked: false }))
    }
    const at = layers.findIndex((l) => l.id === layer.id)
    const next = [...layers.slice(0, at), ...clones, ...layers.slice(at)]
    onCommit(next, hidden)
    onSelect([copy.id])
    toast(`Duplicated “${layer.name}”.`, 'success')
  }

  function remove(ids: string[]) {
    const removable = new Set<string>()
    ids.forEach((id) => {
      const l = byId.get(id)
      if (!l || effLocked(l)) return
      removable.add(id)
      if (l.type === 'Group') membersOf(l.id).forEach((m) => !m.locked && removable.add(m.id))
    })
    if (removable.size === 0) {
      toast('Nothing to delete — the selection is locked.', 'info')
      return
    }
    const nextHidden = { ...hidden }
    removable.forEach((id) => delete nextHidden[id])
    onCommit(layers.filter((l) => !removable.has(l.id)), nextHidden)
    onSelect([])
    toast(`Removed ${removable.size} ${removable.size === 1 ? 'layer' : 'layers'}.`)
  }

  function groupSelection() {
    const members = selectedIds.map((id) => byId.get(id)).filter((l): l is Layer => !!l && l.type !== 'Group')
    if (members.length < 2) {
      toast('Select at least two layers to group.', 'info')
      return
    }
    const group: Layer = { id: uid(), name: `Group ${layers.filter((l) => l.type === 'Group').length + 1}`, type: 'Group' }
    const memberIds = new Set(members.map((m) => m.id))
    const firstIdx = layers.findIndex((l) => memberIds.has(l.id))
    const rest = layers.filter((l) => !memberIds.has(l.id))
    const updated = members.map((m) => ({ ...m, groupId: group.id }))
    let next = [...rest.slice(0, firstIdx), group, ...updated, ...rest.slice(firstIdx)]
    // Reassigning members can leave their old groups empty — drop those orphans.
    const emptyGroups = new Set(
      next
        .filter((l) => l.type === 'Group' && l.id !== group.id && !next.some((m) => m.groupId === l.id))
        .map((l) => l.id),
    )
    if (emptyGroups.size > 0) next = next.filter((l) => !emptyGroups.has(l.id))
    onCommit(next, hidden)
    onSelect([group.id])
    toast(`Grouped ${members.length} layers.`, 'success')
  }

  function ungroup(group: Layer) {
    const next = layers
      .filter((l) => l.id !== group.id)
      .map((l) => (l.groupId === group.id ? { ...l, groupId: undefined } : l))
    const nextHidden = { ...hidden }
    delete nextHidden[group.id]
    onCommit(next, nextHidden)
    onSelect(membersOf(group.id).map((m) => m.id))
    toast(`Ungrouped “${group.name}”.`)
  }

  // ---------- drag & drop reorder ----------
  function handleDrop(target: Layer, after: boolean) {
    setDropAt(null)
    const id = dragId
    setDragId(null)
    if (!id || id === target.id) return
    const dragged = byId.get(id)
    if (!dragged || effLocked(dragged)) return
    // a group cannot be dropped into another group
    const targetGroupId = target.type === 'Group' && !after ? target.id : target.groupId
    if (dragged.type === 'Group' && targetGroupId) return

    const moving = dragged.type === 'Group' ? [dragged, ...membersOf(dragged.id)] : [{ ...dragged, groupId: targetGroupId }]
    const rest = layers.filter((l) => l.id !== dragged.id && (dragged.type !== 'Group' || l.groupId !== dragged.id))
    let at = rest.findIndex((l) => l.id === target.id)
    if (at === -1) return
    if (after) {
      // dropping after a group header lands after its members
      if (target.type === 'Group') at += membersOf(target.id).filter((m) => m.id !== dragged.id).length
      at += 1
    }
    onCommit([...rest.slice(0, at), ...moving, ...rest.slice(at)], hidden)
  }

  const hasSelection = selectedIds.length > 0

  if (collapsed) {
    return (
      <div className="lp lp--collapsed">
        <button
          className="lp__collapsed-head"
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={false}
          title="Show layers"
        >
          <IcoChevron width="13" height="13" style={{ transform: 'rotate(-90deg)' }} />
          <h2>Layers</h2>
          <span className="lp__count">{layers.length + (garmentRegions?.length ?? 0)}</span>
        </button>
      </div>
    )
  }

  return (
    <div className="lp">
      <div className="ds-panel-head ds-panel-head--tight">
        {onToggleCollapse ? (
          <button className="lp__collapsed-head lp__collapsed-head--open" type="button" onClick={onToggleCollapse} aria-expanded title="Minimize layers">
            <IcoChevron width="13" height="13" />
            <h2>Layers</h2>
            {/* Count BOTH the garment's region layers and the design layers — a garment with 10
                editable regions and no artwork yet is "10 layers", not "0". */}
            <span className="lp__count">{layers.length + (garmentRegions?.length ?? 0)}</span>
          </button>
        ) : (
          <div className="lp__title">
            <h2>Layers</h2>
            <span className="lp__count">{layers.length + (garmentRegions?.length ?? 0)}</span>
          </div>
        )}
        <div className="lp__head-actions">
          {selectedIds.length > 1 && (
            <button className="lp__group-btn" type="button" title="Group selection (⌘G)" onClick={groupSelection}>
              Group
            </button>
          )}
          <button className="ds-mini" type="button" aria-label="Add layer" title="Add a new layer" onClick={onAddLayer}>
            <IcoPlus width="15" height="15" />
          </button>
        </div>
      </div>

      <label className="lp__search">
        <IcoSearch width="13" height="13" />
        <input
          placeholder="Search layers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search layers"
        />
      </label>

      <div className="lp__list" role="listbox" aria-multiselectable aria-label="Layers">
        {garmentRegions && garmentRegions.length > 0 && (
          <>
            <div className="lp-section">Garment{garmentTitle ? ` · ${garmentTitle}` : ''}</div>
            {garmentRegions
              .filter((r) => !query.trim() || r.name.toLowerCase().includes(query.trim().toLowerCase()) || r.type.toLowerCase().includes(query.trim().toLowerCase()))
              .map((r) => (
                <div
                  key={`g-${r.id}`}
                  className={`lp-row lp-row--garment${garmentSelectedId === r.id ? ' is-selected' : ''}${!r.visible ? ' is-hidden' : ''}`}
                  role="option"
                  aria-selected={garmentSelectedId === r.id}
                  style={{ paddingLeft: 8 + r.depth * 16 }}
                  onClick={() => onSelectRegion?.(r.id)}
                >
                  <button
                    className={`lp-row__dot${r.color ? '' : ' is-empty'}`}
                    type="button"
                    aria-label="Region colour"
                    title="Cycle region colour"
                    style={r.color ? { background: r.color } : undefined}
                    onClick={(e) => {
                      e.stopPropagation()
                      onCycleRegionColor?.(r.id)
                    }}
                  />
                  <span className="lp-row__text">
                    <b>{r.name}</b>
                    <small>{r.type}</small>
                  </span>
                  <span className="lp-row__actions">
                    <button
                      type="button"
                      className={`lp-act${!r.visible ? ' is-on' : ''}`}
                      title={r.visible ? 'Hide region' : 'Show region'}
                      aria-label={r.visible ? `Hide ${r.name}` : `Show ${r.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleRegion?.(r.id)
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
                        {r.visible ? <circle cx="12" cy="12" r="2.6" /> : <path d="M4 20 20 4" />}
                      </svg>
                    </button>
                  </span>
                </div>
              ))}
            <div className="lp-section">Design</div>
          </>
        )}
        {rows.length === 0 &&
          (query.trim() ? (
            <p className="lp__empty">No layers match “{query.trim()}”.</p>
          ) : (
            <p className="lp__empty">No design layers yet — add text or graphics to design on the garment.</p>
          ))}
        {rows.map(({ layer, depth }) => {
          const isGroup = layer.type === 'Group'
          const isSel = selected.has(layer.id)
          const lockOn = effLocked(layer)
          const hideOn = effHidden(layer)
          const dropping = dropAt?.id === layer.id
          return (
            <div
              key={layer.id}
              data-layer-id={layer.id}
              tabIndex={-1}
              role="option"
              aria-selected={isSel}
              className={[
                'lp-row',
                isSel ? 'is-selected' : '',
                hideOn ? 'is-hidden' : '',
                dragId === layer.id ? 'is-dragging' : '',
                dropping && !dropAt?.after ? 'is-drop-before' : '',
                dropping && dropAt?.after ? 'is-drop-after' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ paddingLeft: 8 + depth * 18 }}
              draggable={!lockOn && renaming !== layer.id}
              onDragStart={(e) => {
                setDragId(layer.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => {
                setDragId(null)
                setDropAt(null)
              }}
              onDragOver={(e) => {
                if (!dragId || dragId === layer.id) return
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                setDropAt({ id: layer.id, after: e.clientY > rect.top + rect.height / 2 })
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dropAt?.id === layer.id) handleDrop(layer, dropAt.after)
              }}
              onClick={(e) => clickRow(e, layer)}
              onDoubleClick={() => !lockOn && setRenaming(layer.id)}
              onContextMenu={(e) => {
                if (!onRowContextMenu) return
                e.preventDefault()
                onRowContextMenu(layer.id, e.clientX, e.clientY)
              }}
            >
              {isGroup ? (
                <button
                  className="lp-row__caret"
                  type="button"
                  aria-label={layer.collapsed ? 'Expand group' : 'Collapse group'}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleCollapse(layer)
                  }}
                >
                  <IcoChevron width="12" height="12" style={{ transform: layer.collapsed ? 'rotate(-90deg)' : 'none' }} />
                </button>
              ) : (
                <button
                  className={`lp-row__dot${layer.color ? '' : ' is-empty'}`}
                  type="button"
                  aria-label="Cycle color label"
                  title="Color label"
                  style={layer.color ? { background: layer.color } : undefined}
                  onClick={(e) => {
                    e.stopPropagation()
                    cycleColor(layer)
                  }}
                />
              )}

              {!isGroup && layer.obj && <LayerThumb obj={layer.obj} />}

              <span className="lp-row__text">
                {renaming === layer.id ? (
                  <input
                    className="lp-row__rename"
                    autoFocus
                    aria-label={`Rename ${layer.name}`}
                    defaultValue={layer.name}
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={(e) => rename(layer, e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') rename(layer, e.currentTarget.value)
                      if (e.key === 'Escape') {
                        setRenaming(null)
                        refocusRow(layer.id)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <b>{layer.name}</b>
                    <small>{isGroup ? `${membersOf(layer.id).length} layers` : layer.type}</small>
                  </>
                )}
              </span>

              <span className="lp-row__actions">
                {isGroup && (
                  <button
                    type="button"
                    className="lp-act"
                    title="Ungroup"
                    aria-label="Ungroup"
                    onClick={(e) => {
                      e.stopPropagation()
                      ungroup(layer)
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="4" y="4" width="9" height="9" rx="2" />
                      <rect x="11" y="11" width="9" height="9" rx="2" />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  className="lp-act"
                  title="Duplicate"
                  aria-label={`Duplicate ${layer.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    duplicate(layer)
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="8" y="8" width="12" height="12" rx="2" />
                    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={`lp-act${layer.locked ? ' is-on' : ''}`}
                  title={layer.locked ? 'Unlock' : 'Lock'}
                  aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleLock(layer)
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    {layer.locked ? (
                      <>
                        <rect x="5" y="11" width="14" height="9" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </>
                    ) : (
                      <>
                        <rect x="5" y="11" width="14" height="9" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 7.5-1.8" />
                      </>
                    )}
                  </svg>
                </button>
                <button
                  type="button"
                  className={`lp-act${hidden[layer.id] ? ' is-on' : ''}`}
                  title={hidden[layer.id] ? 'Show' : 'Hide'}
                  aria-label={hidden[layer.id] ? `Show ${layer.name}` : `Hide ${layer.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleHidden(layer)
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
                    {hidden[layer.id] ? <path d="M4 20 20 4" /> : <circle cx="12" cy="12" r="2.6" />}
                  </svg>
                </button>
              </span>
            </div>
          )
        })}
      </div>

      {baseGarmentName && (
        <button
          type="button"
          className={`lp-base${baseSelected ? ' is-selected' : ''}`}
          onClick={onSelectBase}
          title="Select the base garment"
        >
          <span className="lp-base__icon" aria-hidden>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
              <path d="M9 4.5 5 7l1.6 3.2 1.6-.9v9.2h7.6v-9.2l1.6.9L19 7l-4-2.5a3 3 0 0 1-6 0Z" />
            </svg>
          </span>
          <span className="lp-base__text">
            <b>{baseGarmentName}</b>
            <small>Base garment</small>
          </span>
        </button>
      )}

      {hasSelection && (
        <div className="lp__footer">
          <span>
            {selectedIds.length} selected
          </span>
          <button type="button" className="lp__footer-btn" onClick={() => remove(selectedIds)}>
            Delete
          </button>
          <button type="button" className="lp__footer-btn" onClick={() => onSelect([])}>
            Deselect
          </button>
        </div>
      )}
    </div>
  )
}
