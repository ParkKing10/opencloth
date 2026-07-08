import JSZip from 'jszip'

export type ZipEntry = { name: string; data: Blob | string }

/** Bundle a handful of named blobs/strings into one real .zip Blob. */
export async function zipEntries(entries: ZipEntry[]): Promise<Blob> {
  const zip = new JSZip()
  entries.forEach((e) => zip.file(e.name, e.data))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}
