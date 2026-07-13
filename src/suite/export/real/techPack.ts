/**
 * Real Tech Pack PDF — built with jsPDF from the actual project data + the captured garment
 * image. No placeholders: empty fields read "Not specified", never invented values.
 */
import { jsPDF } from 'jspdf'
import { artworkRows, blobToDataUrl, colorList, type RealExportProject } from './exportProject'

const INK = '#14141A'
const MUTED = '#8A8A96'
const LINE = '#E4E4EA'
const ACCENT = '#111111'

function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 })
    img.onerror = () => resolve({ w: 1, h: 1 })
    img.src = dataUrl
  })
}

const dash = (v?: string) => (v && v.trim() ? v.trim() : 'Not specified')

/** Build the Tech Pack as a PDF blob. `garmentPng` is the captured garment+design render. */
export async function buildTechPackPdf(project: RealExportProject, garmentPng: Blob): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  const date = new Date().toISOString().slice(0, 10)

  const footer = () => {
    doc.setDrawColor(LINE)
    doc.setLineWidth(0.5)
    doc.line(M, H - 40, W - M, H - 40)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(INK)
    doc.text('loom studios', M, H - 26)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(MUTED)
    doc.text(project.projectName, W - M, H - 26, { align: 'right' })
  }

  let y = M

  // ---- Cover ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(MUTED)
  doc.text('TECH PACK', M, y)
  y += 46
  doc.setFontSize(30)
  doc.setTextColor(INK)
  doc.text(project.projectName, M, y)
  y += 30
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(13)
  doc.setTextColor(MUTED)
  doc.text(project.brand, M, y)
  y += 40

  const meta: [string, string][] = [
    ['Brand', project.brand],
    ['Project', project.projectName],
    ['Designer', project.designer],
    // Only include the manufacturing fields the user actually entered — never blank rows.
    ...(project.collection ? ([['Collection', project.collection]] as [string, string][]) : []),
    ...(project.styleNumber ? ([['Style No.', project.styleNumber]] as [string, string][]) : []),
    ...(project.sku ? ([['SKU', project.sku]] as [string, string][]) : []),
    ...(project.season ? ([['Season', project.season]] as [string, string][]) : []),
    ['Date', date],
    ['Garment', project.garment.name],
    ['Category', project.garment.category],
  ]
  doc.setFontSize(10)
  meta.forEach(([k, v]) => {
    doc.setTextColor(MUTED)
    doc.text(k.toUpperCase(), M, y)
    doc.setTextColor(INK)
    doc.text(v, M + 110, y)
    y += 18
  })

  // ---- Garment preview ----
  y += 16
  doc.setDrawColor(LINE)
  doc.line(M, y, W - M, y)
  y += 22
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(INK)
  doc.text('Garment', M, y)
  y += 14

  const dataUrl = await blobToDataUrl(garmentPng)
  const { w: iw, h: ih } = await imageSize(dataUrl)
  const boxW = W - M * 2
  const boxH = 300
  const scale = Math.min(boxW / iw, boxH / ih)
  const dw = iw * scale
  const dh = ih * scale
  doc.addImage(dataUrl, 'PNG', M + (boxW - dw) / 2, y, dw, dh, undefined, 'FAST')
  y += dh + 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  const viewLabel = project.garment.views.front && project.garment.views.back ? 'Front · Back' : project.garment.views.combinedFrontBack ? 'Front + Back' : 'Preview'
  doc.text(`${viewLabel} · design shown on the print area`, M, y)

  footer()

  // ---- Specifications ----
  doc.addPage()
  y = M
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(INK)
  doc.text('Specifications', M, y)
  y += 22
  const s = project.specs
  const specRows: [string, string][] = [
    ['Material', dash(s.material)],
    ['Fabric', dash(s.material)],
    ['Weight', dash(s.weight)],
    ['Composition', dash(s.composition)],
    ['Fit', dash(s.fit)],
    ['Variant', dash(s.variant)],
    ['Notes', dash(s.notes)],
  ]
  doc.setFontSize(10)
  specRows.forEach(([k, v]) => {
    doc.setTextColor(MUTED)
    doc.text(k.toUpperCase(), M, y)
    doc.setTextColor(INK)
    const lines = doc.splitTextToSize(v, W - M - (M + 120))
    doc.text(lines, M + 120, y)
    y += 16 * lines.length + 4
  })

  // ---- Artwork ----
  y += 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(INK)
  doc.text('Artwork', M, y)
  y += 8
  const rows = artworkRows(project)
  const cols = [
    { h: 'Layer', x: M, w: 150 },
    { h: 'Type', x: M + 150, w: 60 },
    { h: 'Size', x: M + 210, w: 50 },
    { h: 'X', x: M + 260, w: 45 },
    { h: 'Y', x: M + 305, w: 45 },
    { h: 'Rotation', x: M + 350, w: 60 },
    { h: 'Placement', x: M + 410, w: 90 },
  ]
  y += 18
  doc.setFontSize(8)
  doc.setTextColor(MUTED)
  cols.forEach((c) => doc.text(c.h.toUpperCase(), c.x, y))
  y += 6
  doc.setDrawColor(LINE)
  doc.line(M, y, W - M, y)
  y += 14
  doc.setFontSize(9)
  if (rows.length === 0) {
    doc.setTextColor(MUTED)
    doc.text('No artwork placed yet.', M, y)
    y += 16
  }
  rows.forEach((r) => {
    if (y > H - 70) {
      footer()
      doc.addPage()
      y = M
    }
    doc.setTextColor(INK)
    const name = r.name.length > 26 ? r.name.slice(0, 25) + '…' : r.name
    doc.text(name, cols[0].x, y)
    doc.text(r.type, cols[1].x, y)
    doc.text(r.size, cols[2].x, y)
    doc.text(r.x, cols[3].x, y)
    doc.text(r.y, cols[4].x, y)
    doc.text(r.rotation, cols[5].x, y)
    doc.text(r.placement, cols[6].x, y)
    y += 16
  })

  // ---- Print information ----
  y += 16
  if (y > H - 120) {
    footer()
    doc.addPage()
    y = M
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(INK)
  doc.text('Print Information', M, y)
  y += 22
  const colors = colorList(project)
  const printInfo: [string, string][] = [
    ['Technique', 'Not specified'],
    ['Artworks', String(rows.length)],
    ['Color count', String(colors.length)],
    ['Colors', colors.length ? colors.join('  ') : 'Not specified'],
  ]
  doc.setFontSize(10)
  printInfo.forEach(([k, v]) => {
    doc.setTextColor(MUTED)
    doc.text(k.toUpperCase(), M, y)
    doc.setTextColor(INK)
    doc.text(v, M + 120, y)
    y += 18
  })
  // color swatches
  if (colors.length) {
    let sx = M + 120
    const sy = y
    colors.slice(0, 12).forEach((hex) => {
      doc.setFillColor(hex)
      doc.setDrawColor(LINE)
      doc.roundedRect(sx, sy, 22, 14, 2, 2, 'FD')
      sx += 28
    })
    y += 24
  }

  // accent tick so the page reads as a finished loom studios doc
  doc.setDrawColor(ACCENT)

  footer()
  return doc.output('blob')
}
