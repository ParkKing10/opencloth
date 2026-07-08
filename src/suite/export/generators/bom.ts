import JSZip from 'jszip'
import type { ManufacturingProject } from '../types'

/** A single cell in the sheet. */
type Cell = { v: string | number; num?: boolean; bold?: boolean }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function colName(i: number): string {
  let s = ''
  let n = i
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

function cellXml(r: number, c: number, cell: Cell): string {
  const ref = `${colName(c)}${r}`
  const s = cell.bold ? ' s="1"' : ''
  if (cell.num) return `<c r="${ref}"${s} t="n"><v>${cell.v}</v></c>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(String(cell.v))}</t></is></c>`
}

/** Build a real .xlsx workbook from the project's bill of materials. */
export async function generateBomXlsx(p: ManufacturingProject): Promise<Blob> {
  const headers = ['Component', 'Material', 'Composition', 'Placement', 'Supplier', 'Qty', 'Unit']
  const rows: Cell[][] = []
  rows.push([{ v: `BILL OF MATERIALS — ${p.meta.styleName} (${p.meta.styleNumber})`, bold: true }])
  rows.push([{ v: `Brand: ${p.meta.brand}   Collection: ${p.meta.collection}   Date: ${p.meta.date}` }])
  rows.push([])
  rows.push(headers.map((h) => ({ v: h, bold: true })))
  p.bom.forEach((it) =>
    rows.push([
      { v: it.component },
      { v: it.material },
      { v: it.composition },
      { v: it.placement },
      { v: it.supplier },
      { v: it.qty, num: true },
      { v: it.unit },
    ]),
  )

  const sheetRows = rows
    .map((cells, ri) => {
      const r = ri + 1
      const cs = cells.map((c, ci) => cellXml(r, ci, c)).join('')
      return `<row r="${r}">${cs}</row>`
    })
    .join('')

  const cols = `<cols><col min="1" max="1" width="22" customWidth="1"/><col min="2" max="3" width="26" customWidth="1"/><col min="4" max="5" width="18" customWidth="1"/><col min="6" max="7" width="8" customWidth="1"/></cols>`

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${sheetRows}</sheetData></worksheet>`

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="BOM" sheetId="1" r:id="rId1"/></sheets></workbook>`

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`

  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypes)
  zip.file('_rels/.rels', rootRels)
  zip.file('xl/workbook.xml', workbookXml)
  zip.file('xl/_rels/workbook.xml.rels', workbookRels)
  zip.file('xl/styles.xml', stylesXml)
  zip.file('xl/worksheets/sheet1.xml', sheetXml)
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
