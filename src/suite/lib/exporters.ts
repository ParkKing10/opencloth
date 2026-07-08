import { jsPDF } from 'jspdf'
import { slugify } from './download'

export type TechPackInput = {
  name: string
  kind?: string
  fit?: string
  fabric?: string
  weight?: string
  technique?: string
  placement?: string
  color?: string
  manufacturer?: string
}

const SIZE_ROWS: [string, number[]][] = [
  ['Chest (cm)', [58, 60, 62, 64, 66]],
  ['Length (cm)', [70, 72, 74, 76, 78]],
  ['Shoulder (cm)', [56, 58, 60, 62, 64]],
  ['Sleeve (cm)', [60, 61, 62, 63, 64]],
]

const BOM: [string, string, string][] = [
  ['Main fabric', 'French Terry 450 GSM', '100% cotton'],
  ['Ribbing', '2×1 rib', '95% cotton / 5% elastane'],
  ['Drawcord', 'Flat 8mm', 'Matched tonal'],
  ['Label', 'Woven, hem', 'Recycled polyester'],
]

/** Generate and download a real, multi-section PDF tech pack. */
export function downloadTechPackPdf(input: TechPackInput): string {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 48
  let y = M

  // Header band
  doc.setFillColor(12, 12, 16)
  doc.rect(0, 0, W, 92, 'F')
  doc.setTextColor(209, 249, 79)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('THREADOS · TECH PACK', M, 40)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.text(input.name, M, 66)
  doc.setTextColor(160, 160, 170)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`${(input.kind ?? 'garment').toUpperCase()}  ·  Generated ${new Date().toISOString().slice(0, 10)}`, M, 82)
  y = 128

  const section = (title: string) => {
    doc.setTextColor(20, 20, 26)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(title, M, y)
    doc.setDrawColor(220, 220, 224)
    doc.line(M, y + 6, W - M, y + 6)
    y += 22
  }

  const kv = (rows: [string, string][]) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    rows.forEach(([k, v]) => {
      doc.setTextColor(120, 120, 130)
      doc.text(k, M, y)
      doc.setTextColor(30, 30, 38)
      doc.text(v || '—', M + 150, y)
      y += 18
    })
    y += 8
  }

  section('Garment details')
  kv([
    ['Type', input.kind ?? 'Hoodie'],
    ['Fit', input.fit ?? 'Oversized'],
    ['Fabric', input.fabric ?? 'French Terry 450 GSM'],
    ['Weight', input.weight ?? '450 GSM'],
    ['Print technique', input.technique ?? 'Puff Print'],
    ['Placement', input.placement ?? 'Front Center'],
    ['Manufacturer', input.manufacturer ?? 'To be matched'],
  ])

  section('Bill of materials')
  doc.setFontSize(9)
  BOM.forEach(([part, material, comp]) => {
    doc.setTextColor(30, 30, 38)
    doc.text(part, M, y)
    doc.setTextColor(90, 90, 100)
    doc.text(material, M + 150, y)
    doc.text(comp, M + 320, y)
    y += 16
  })
  y += 14

  section('Size chart')
  const cols = ['', 'S', 'M', 'L', 'XL', 'XXL']
  const colW = (W - 2 * M) / cols.length
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 130)
  cols.forEach((c, i) => doc.text(c, M + i * colW + (i === 0 ? 0 : 6), y))
  y += 6
  doc.setDrawColor(230, 230, 234)
  doc.line(M, y, W - M, y)
  y += 14
  SIZE_ROWS.forEach(([label, vals]) => {
    doc.setTextColor(30, 30, 38)
    doc.text(label, M, y)
    vals.forEach((v, i) => doc.text(String(v), M + (i + 1) * colW + 6, y))
    y += 17
  })
  y += 14

  section('Construction notes')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(70, 70, 80)
  const notes = doc.splitTextToSize(
    'Overlock all seams; coverstitch hems and cuffs. Tonal topstitch at 1.5cm. Woven care label at inner back neck. Pre-wash garment for a vintage finish. Confirm Pantone against approved lab dip before bulk.',
    W - 2 * M,
  )
  doc.text(notes, M, y)

  const filename = `threados-${slugify(input.name)}-techpack.pdf`
  doc.save(filename)
  return filename
}
