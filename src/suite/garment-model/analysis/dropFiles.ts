/**
 * Collect every File from a drag-and-drop DataTransfer, recursing into dropped FOLDERS via the
 * webkitGetAsEntry directory API (so a user can drop a whole folder of garment flats). Falls back
 * to the flat file list when the entry API isn't available.
 */

function readEntriesOnce(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => reader.readEntries((e) => resolve(e), () => resolve([])))
}

async function walk(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    const fe = entry as FileSystemFileEntry
    const file = await new Promise<File | null>((resolve) => fe.file((f) => resolve(f), () => resolve(null)))
    if (file) out.push(file)
    return
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    // readEntries returns at most ~100 entries per call — loop until it's empty.
    let batch = await readEntriesOnce(reader)
    while (batch.length) {
      for (const child of batch) await walk(child, out)
      batch = await readEntriesOnce(reader)
    }
  }
}

/** All files under a dropped selection (folders expanded). */
export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = dt.items ? Array.from(dt.items) : []
  const entries = items
    .filter((it) => it.kind === 'file')
    .map((it) => (typeof it.webkitGetAsEntry === 'function' ? it.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => e !== null)

  if (entries.length > 0) {
    const out: File[] = []
    for (const e of entries) await walk(e, out)
    if (out.length > 0) return out
  }
  // Fallback: plain flat file list.
  return dt.files ? Array.from(dt.files) : []
}

/** Keep only the garment vector formats the engine can read. */
export function keepGarmentFiles(files: File[]): File[] {
  return files.filter((f) => /\.(svg|ai|pdf)$/i.test(f.name))
}
