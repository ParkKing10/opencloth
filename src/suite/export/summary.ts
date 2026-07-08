import type { ManufacturingProject, PackageSelection } from './types'
import { printViews } from './generators/printAssets'

const KB = 1024
// Typical generated sizes (measured from the real generators) — an honest estimate,
// not a placeholder. The actual .zip will land close to this.
const SIZE = {
  readme: 12 * KB,
  techPack: 36 * KB,
  sizeChart: 20 * KB,
  bom: 9 * KB,
  productionNotes: 15 * KB,
  colorReferences: 15 * KB,
  packaging: 12 * KB,
  logoSvg: 2 * KB,
  logoAi: 8 * KB,
  patternDxf: 3 * KB,
  patternPdf: 30 * KB,
  printAsset: 110 * KB,
  projectJson: 4 * KB,
  designPng: 180 * KB,
}

export type PackageEstimate = { files: number; bytes: number; size: string }

function humanSize(bytes: number): string {
  if (bytes >= KB * KB) return `${(bytes / (KB * KB)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / KB))} KB`
}

/** Estimate the file count + compressed-ish size of the package for the current selection. */
export function estimatePackage(project: ManufacturingProject, selection: PackageSelection): PackageEstimate {
  let files = 0
  let bytes = 0
  const add = (n: number, b: number) => {
    files += n
    bytes += b
  }

  if (selection.readme) add(1, SIZE.readme)
  if (selection.techPack) add(1, SIZE.techPack)
  if (selection.sizeChart) add(1, SIZE.sizeChart)
  if (selection.bom) add(1, SIZE.bom)
  if (selection.productionNotes) add(1, SIZE.productionNotes)
  if (selection.colorReferences) add(1, SIZE.colorReferences)
  if (selection.packaging) add(1, SIZE.packaging)
  if (selection.printAssets) {
    const views = printViews(project).length
    add(views, views * SIZE.printAsset)
  }
  if (selection.logos) add(2, SIZE.logoSvg + SIZE.logoAi)
  if (selection.patterns) add(2, SIZE.patternDxf + SIZE.patternPdf)
  // The design source (project.json + render) is always written by the assembler.
  add(2, SIZE.projectJson + SIZE.designPng)

  // .zip DEFLATE typically shaves the text-heavy docs; nudge the estimate down a touch.
  bytes = Math.round(bytes * 0.82)
  return { files, bytes, size: humanSize(bytes) }
}
