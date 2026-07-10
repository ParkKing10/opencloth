/**
 * The Garment Analysis Engine orchestrator: file geometry → understood garment. One function the UI
 * calls. Phase 1 reads SVG text; Phase 2 adds .ai/.pdf via pdf.js (bytes branch). Always returns a
 * usable garment — if the geometry is unreadable it degrades to the honest upload template rather
 * than inventing regions.
 */
import { normalizeGarment } from '../garmentNormalize'
import { buildFromUpload } from '../garmentFactory'
import { readSvg } from './svgReader'
import { classifyGraph } from './classify'
import { mapClassifiedToEditable, type MapResult } from './smartGarmentMapping'
import { computeSignature } from './signature'
import { nearestSignatures, saveSignature } from './learningStore'
import { applyLearningPriors } from './learning'

export type AnalyzeInput = { text?: string; bytes?: Uint8Array; filename: string }

/** Human name from a filename ("double-breasted_coat.svg" → "Double Breasted Coat"). */
export function prettyName(filename: string): string {
  const stem = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  return stem.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Imported Garment'
}

export async function analyzeGarment(input: AnalyzeInput, opts?: { name?: string; category?: string }): Promise<MapResult> {
  const name = opts?.name ?? prettyName(input.filename)
  const category = opts?.category ?? 'Imported'
  try {
    let graph = input.text ? readSvg(input.text) : null
    // .ai / .pdf → pdf.js vector extraction (lazy import so the SVG path + node tests never load it).
    if (!graph && input.bytes) {
      const { readPdfVector } = await import('./pdfVectorReader')
      graph = await readPdfVector(input.bytes)
    }
    // Need at least a couple of real primitives to attempt an analysis.
    if (graph && graph.paths.length >= 2 && graph.bounds.w > 0) {
      const classified = classifyGraph(graph)
      // Learning: bias with the nearest previously-analyzed garment, then remember this one.
      const sig = computeSignature(classified, name)
      const learned = applyLearningPriors(classified, nearestSignatures(sig))
      const mapped = mapClassifiedToEditable(learned.garment, name, category)
      const normalized = normalizeGarment(mapped.garment)
      if (normalized) {
        saveSignature(sig, Date.now())
        return {
          garment: normalized,
          report: { ...mapped.report, matchedPrior: learned.matched, learnedFrom: learned.from },
        }
      }
    }
  } catch {
    /* fall through to the honest fallback below */
  }
  const fb = buildFromUpload(name)
  return { garment: fb.garment, report: { regionCount: 0, lowConfidence: 0, types: {} } }
}
