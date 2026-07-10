/**
 * Real Manufacturing Package (.zip). The structure already matches the future production
 * architecture — top-level deliverables, an Assets/ tree (Artwork, Logos) and a Documents/
 * folder — so new exports can register themselves without changing the format.
 *
 *   ManufacturingPackage.zip
 *   ├── TechPack.pdf
 *   ├── Design.png
 *   ├── Preview.png
 *   ├── Project.threados
 *   ├── Metadata.json
 *   ├── Assets/           (Artwork/, Logos/ — created now, filled by future exporters)
 *   └── Documents/Manifest.json
 */
import JSZip from 'jszip'
import { artworkRows, colorList, type RealExportProject } from './exportProject'
import { captureDesignPng } from './capture'
import { buildTechPackPdf } from './techPack'

/** A file any current or future exporter can register into the package, by path. */
export type PackageEntry = { path: string; data: Blob | string }

/** Folders that always exist so the structure is stable as new asset types arrive. */
const RESERVED_FOLDERS = ['Assets/Artwork', 'Assets/Logos', 'Documents']

/**
 * Build the package. `extra` lets future exporters (DXF, AI, SVG, SizeChart.pdf, BOM.xlsx,
 * 3D.glb, Mockups, …) register additional files by path — no architecture change required.
 */
export async function buildManufacturingZip(project: RealExportProject, extra: PackageEntry[] = []): Promise<Blob> {
  const generatedAt = new Date().toISOString()

  // Real renders + tech pack, straight from the current canvas + stored project data.
  const designPng = await captureDesignPng({ scope: 'garment', background: 'white', scale: 2 })
  const previewPng = await captureDesignPng({ scope: 'garment', background: 'transparent', scale: 1 })
  const techPack = await buildTechPackPdf(project, designPng)

  const rows = artworkRows(project)
  const colors = colorList(project)

  const threados = {
    _format: 'threados.design',
    _version: 1,
    generatedAt,
    design: {
      name: project.projectName,
      brand: project.brand,
      garment: project.garment,
      specs: project.specs,
      layers: project.layers,
      hidden: project.hidden,
    },
  }

  const metadata = {
    brand: project.brand,
    project: project.projectName,
    designer: project.designer,
    collection: project.collection,
    styleNumber: project.styleNumber,
    sku: project.sku,
    season: project.season,
    date: generatedAt.slice(0, 10),
    garment: project.garment,
    specs: project.specs,
    artworkCount: rows.length,
    colorCount: colors.length,
    colors,
  }

  // The base deliverables, registered by path.
  const entries: PackageEntry[] = [
    { path: 'TechPack.pdf', data: techPack },
    { path: 'Design.png', data: designPng },
    { path: 'Preview.png', data: previewPng },
    { path: 'Project.threados', data: JSON.stringify(threados, null, 2) },
    { path: 'Metadata.json', data: JSON.stringify(metadata, null, 2) },
    ...extra,
  ]

  const manifest = {
    generator: 'THREADOS Export System',
    version: 1,
    generatedAt,
    structure: {
      root: entries.map((e) => e.path),
      folders: RESERVED_FOLDERS,
    },
    files: [...entries.map((e) => e.path), 'Documents/Manifest.json'],
    counts: { artworks: rows.length, colors: colors.length },
  }
  entries.push({ path: 'Documents/Manifest.json', data: JSON.stringify(manifest, null, 2) })

  const zip = new JSZip()
  // Reserve the future-architecture folders even when empty.
  RESERVED_FOLDERS.forEach((f) => zip.folder(f))
  // JSZip.file(path) auto-creates any parent folders, so paths drive the whole layout.
  entries.forEach((e) => zip.file(e.path, e.data))

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}
