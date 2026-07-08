/** Real client-side file downloads — buttons produce actual files, not just toasts. */

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // revoke on the next tick so the download has started
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(text: string, filename: string, type = 'text/plain'): void {
  downloadBlob(new Blob([text], { type }), filename)
}

export function downloadJson(data: unknown, filename: string): void {
  downloadText(JSON.stringify(data, null, 2), filename, 'application/json')
}

/** Export an array of flat objects as a CSV file. */
export function downloadCsv<T extends Record<string, unknown>>(rows: T[], filename: string): void {
  if (rows.length === 0) {
    downloadText('', filename, 'text/csv')
    return
  }
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))]
  downloadText(lines.join('\n'), filename, 'text/csv')
}

/** Turn an inline <svg> element into a downloadable PNG. */
export async function svgElementToPngBlob(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const bbox = svg.viewBox.baseVal
  const w = (bbox && bbox.width) || svg.clientWidth || 600
  const h = (bbox && bbox.height) || svg.clientHeight || 600
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))
  const data = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('svg load failed'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.fillStyle = '#0a0a0e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'file'
}
