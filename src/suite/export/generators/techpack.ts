import { PdfDoc } from './pdfKit'
import type { ManufacturingProject } from '../types'

export function generateTechPackPdf(p: ManufacturingProject): Blob {
  const pdf = new PdfDoc('Tech Pack')
  pdf.cover(p, `${p.garment.fit} ${p.garment.kind} · production specification`)

  // ---- Garment overview (flats) ----
  pdf.section('Garment Overview')
  pdf.flatsRow(p.garment.kind, ['Front View', 'Back View', 'Side View', 'Detail View'])

  // ---- Materials ----
  pdf.section('Materials')
  pdf.table(
    ['Role', 'Fabric', 'Weight', 'Composition', 'Color', 'Supplier'],
    p.materials.map((m) => [m.role, m.fabric, `${m.weightGsm} GSM`, m.composition, m.color, m.supplier]),
    [1.1, 1.6, 0.8, 1.6, 1.1, 1.1],
  )

  // ---- Construction ----
  pdf.section('Construction')
  pdf.kv([
    ['Stitch type', p.construction.stitchType],
    ['Thread', p.construction.thread],
    ['Pocket', p.construction.pocket],
    ['Collar / Neck', p.construction.collar],
    ['Cuffs', p.construction.cuffs],
    ['Hem', p.construction.hem],
    ['Labels', p.construction.labels],
    ['Packaging', p.construction.packaging],
  ])

  // ---- Graphics ----
  pdf.section('Graphics & Artwork')
  pdf.table(
    ['Placement', 'Technique', 'Width', 'Height', 'Colors'],
    p.graphics.map((g) => [`${g.name} — ${g.placement}`, g.technique, `${g.widthCm} cm`, `${g.heightCm} cm`, String(g.colors)]),
    [2, 1.4, 0.8, 0.8, 0.7],
  )

  // ---- Measurements ----
  pdf.section('Measurements (cm)')
  pdf.table(
    ['Code', 'Point of measure', ...p.sizes, 'Tol.'],
    p.measurements.map((r) => [r.code, r.point, ...p.sizes.map((s) => String(r.values[s])), `±${r.toleranceCm}`]),
    [0.5, 2.4, ...p.sizes.map(() => 0.6), 0.6],
  )

  // ---- Color references ----
  pdf.section('Color References')
  pdf.table(
    ['Name', 'HEX', 'RGB', 'Pantone'],
    p.colors.map((c) => [c.name, c.hex, `${c.rgb[0]}, ${c.rgb[1]}, ${c.rgb[2]}`, c.pantone]),
    [1.6, 1, 1.2, 1.4],
  )

  // ---- Production notes ----
  pdf.section('Production Notes')
  pdf.bullets(p.notes.special)
  pdf.kv([
    ['Washing', p.notes.washing],
    ['Finishing', p.notes.finishing],
    ['Vintage wash', p.notes.vintageWash],
    ['Distressing', p.notes.distressing],
    ['Embroidery', p.notes.embroideryNotes],
  ])

  return pdf.finalizeAndBlob()
}
