/**
 * Archive extraction — turns an uploaded .zip / .rar into a flat ExtractedFile[].
 * ZIP uses jszip (already a dependency); RAR lazy-loads node-unrar-js + its wasm
 * so the RAR code path only ships when actually used.
 */
import JSZip from 'jszip'
import type { ExtractedFile } from '../types'

const extOf = (name: string): string => {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}
const baseOf = (path: string): string => path.split('/').pop() ?? path

function toFile(path: string, blob: Blob): ExtractedFile {
  const name = baseOf(path)
  return { path, name, ext: extOf(name), bytes: blob.size, blob }
}

async function extractZip(file: Blob): Promise<ExtractedFile[]> {
  const zip = await JSZip.loadAsync(file)
  const out: ExtractedFile[] = []
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue
    const blob = await entry.async('blob')
    out.push(toFile(entry.name, blob))
  }
  return out
}

let rarWasm: ArrayBuffer | null = null
async function loadRarWasm(): Promise<ArrayBuffer> {
  if (rarWasm) return rarWasm
  const mod = await import('node-unrar-js/esm/js/unrar.wasm?url')
  const buf = await fetch(mod.default).then((r) => r.arrayBuffer())
  rarWasm = buf
  return buf
}

async function extractRar(file: Blob): Promise<ExtractedFile[]> {
  const { createExtractorFromData } = await import('node-unrar-js')
  const wasmBinary = await loadRarWasm()
  const data = await file.arrayBuffer()
  const extractor = await createExtractorFromData({ data, wasmBinary })
  const extracted = extractor.extract()
  const out: ExtractedFile[] = []
  for (const f of extracted.files) {
    if (f.fileHeader.flags.directory) continue
    const bytes = f.extraction
    if (!bytes) continue
    // copy out of the wasm heap so the blob owns stable bytes
    out.push(toFile(f.fileHeader.name, new Blob([new Uint8Array(bytes)])))
  }
  return out
}

export function archiveKind(name: string): 'zip' | 'rar' | null {
  const ext = extOf(name)
  if (ext === 'zip') return 'zip'
  if (ext === 'rar') return 'rar'
  return null
}

/** Extract a .zip or .rar into a flat list of files. Throws on unsupported input. */
export async function extractArchive(file: File): Promise<ExtractedFile[]> {
  const kind = archiveKind(file.name)
  if (kind === 'zip') return extractZip(file)
  if (kind === 'rar') return extractRar(file)
  throw new Error('Unsupported archive — upload a .zip or .rar file.')
}
