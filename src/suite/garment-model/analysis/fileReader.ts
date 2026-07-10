/**
 * Browser file adapter — the only impure module in the engine. Turns a picked File into bytes/text
 * the pure pipeline can analyze. SVG → text (Phase 1); .ai/.pdf → bytes (Phase 2 pdf.js).
 */
export type GarmentFileKind = 'svg' | 'ai' | 'pdf' | 'unknown'
export type ReadFileResult = { kind: GarmentFileKind; text?: string; bytes?: Uint8Array }

export async function readGarmentFile(file: File): Promise<ReadFileResult> {
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'svg') return { kind: 'svg', text: await file.text() }
  if (ext === 'ai') return { kind: 'ai', bytes: new Uint8Array(await file.arrayBuffer()) }
  if (ext === 'pdf') return { kind: 'pdf', bytes: new Uint8Array(await file.arrayBuffer()) }
  return { kind: 'unknown' }
}
