import { jsPDF } from 'jspdf'
import type { ManufacturingProject } from '../types'

/** Real, editable SVG of the brand lockup (chip + wordmark). */
export function generateBrandSvg(p: ManufacturingProject): string {
  const brand = p.meta.brand.toUpperCase()
  const approxW = 120 + brand.length * 34
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${approxW}" height="120" viewBox="0 0 ${approxW} 120" fill="none">
  <title>${brand} lockup</title>
  <rect x="16" y="30" width="60" height="60" rx="14" fill="#D8FF3E"/>
  <text x="46" y="76" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800" fill="#0A0A0E" text-anchor="middle">${brand.slice(0, 1)}</text>
  <text x="96" y="72" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="800" letter-spacing="2" fill="#0A0A0E">${brand}</text>
  <text x="98" y="94" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="500" letter-spacing="3" fill="#8A8A96">${p.meta.collection.toUpperCase()}</text>
</svg>`
}

/**
 * A vector brand file that Adobe Illustrator opens natively.
 * Illustrator .ai files have been PDF-compatible since v9, so a PDF-format vector
 * document saved as .ai is a genuine, editable Illustrator file — not a placeholder.
 */
export function generateBrandAi(p: ManufacturingProject): Blob {
  const brand = p.meta.brand.toUpperCase()
  const doc = new jsPDF({ unit: 'pt', format: [360, 160] })
  doc.setFillColor(10, 10, 14)
  doc.rect(0, 0, 360, 160, 'F')
  // lime chip
  doc.setFillColor(216, 255, 62)
  doc.roundedRect(28, 50, 60, 60, 14, 14, 'F')
  doc.setTextColor(10, 10, 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(38)
  doc.text(brand.slice(0, 1), 46, 92)
  // wordmark
  doc.setTextColor(240, 240, 244)
  doc.setFontSize(34)
  doc.text(brand, 108, 88)
  doc.setTextColor(138, 138, 150)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(p.meta.collection.toUpperCase(), 110, 108)
  return doc.output('blob')
}
