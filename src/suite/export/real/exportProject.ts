/**
 * Real export data model + helpers (Milestone 5).
 *
 * Everything here is derived from the ACTUAL project — the live design document (layers +
 * specs) and the real garment — never synthesized. The canvas itself is captured from the
 * live DOM (see capture.ts), so exports show exactly what the user sees.
 */
import type { Layer } from '../../pages/DesignStudio/LayersPanel'
import type { ProductSpecs } from '../../pages/DesignStudio/designDoc'
import type { GarmentViews } from '../../garments/types'

export type RealExportProject = {
  brand: string
  projectName: string
  designer: string
  /** Manufacturing project info (Export wizard) — blank strings when not provided. */
  collection: string
  styleNumber: string
  sku: string
  season: string
  garment: { name: string; category: string; views: GarmentViews }
  specs: ProductSpecs
  /** All design layers (garment is NOT a layer — it's the base surface). */
  layers: Layer[]
  hidden: Record<string, boolean>
}

/** One artwork row for the tech pack, computed straight from a layer's real transform. */
export type ArtworkRow = {
  name: string
  type: string
  size: string
  x: string
  y: string
  rotation: string
  placement: string
  /** Non-normal compositing intent (e.g. 'Multiply'), documented so it isn't a silent divergence. */
  blend?: string
}

/** Human placement derived honestly from the normalized position (no fake data). */
function placementOf(x: number, y: number): string {
  const h = x < 0.4 ? 'Left' : x > 0.6 ? 'Right' : 'Center'
  const v = y < 0.4 ? 'top' : y > 0.6 ? 'bottom' : 'middle'
  return `${h} ${v}`
}

/** Visible design objects → artwork rows (real transforms only). */
export function artworkRows(project: RealExportProject): ArtworkRow[] {
  return project.layers
    .filter((l) => l.obj && !project.hidden[l.id])
    .map((l) => {
      const o = l.obj!
      const blend = o.blendMode && o.blendMode !== 'normal' ? o.blendMode.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : undefined
      const place = placementOf(o.x, o.y)
      return {
        name: l.name,
        type: o.type,
        size: `${Math.round(o.width * 100)}%`,
        x: `${Math.round(o.x * 100)}%`,
        y: `${Math.round(o.y * 100)}%`,
        rotation: `${Math.round(o.rotation)}°`,
        // Fold the blend intent into the visible placement cell so the tech pack documents it.
        placement: blend ? `${place} · ${blend}` : place,
        blend,
      }
    })
}

/** Distinct solid colours used by text/graphic objects (raster images excluded). */
export function colorList(project: RealExportProject): string[] {
  const set = new Set<string>()
  project.layers.forEach((l) => {
    if (l.obj && !project.hidden[l.id] && (l.obj.type === 'text' || l.obj.type === 'graphic') && l.obj.color) {
      set.add(l.obj.color.toUpperCase())
    }
  })
  return [...set]
}

/** A file-safe slug for filenames. */
export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'design'
  )
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read blob'))
    r.readAsDataURL(blob)
  })
}
