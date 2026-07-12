/**
 * Import orchestration: archive → extracted files → detected garments (each with
 * a generated preview), reporting progress along the way. Pure of any network I/O
 * — publishing to Supabase is a separate, explicit step (garmentClient.publish).
 */
import { extractArchive } from './extract'
import { groupIntoGarments, pickPreviewSource, detectViews, garmentHealth } from './detect'
import { generatePreview } from './preview'
import { defaultGarmentPrice } from '../pricing'
import { analyzeGarment } from '../../garment-model/analysis/analyzeGarment'
import type { DetectedGarment, ExtractedFile, ImportProgress } from '../types'

let counter = 0
const tempId = (): string => `g_${Date.now().toString(36)}_${(counter++).toString(36)}`

/**
 * Count the editable regions/layers the Analysis Engine finds in a garment's vector master (SVG/AI/PDF).
 * This is the SAME analysis a purchase runs, so validating it here means the shop only ever contains
 * garments that actually open with layers. Returns 0 for a raster-only or unreadable garment.
 */
async function countRegions(files: ExtractedFile[]): Promise<number> {
  const vec = files.find((f) => f.ext === 'svg' || f.ext === 'ai' || f.ext === 'pdf')
  if (!vec) return 0
  try {
    if (vec.ext === 'svg') {
      const { report } = await analyzeGarment({ text: await vec.blob.text(), filename: vec.name })
      return report.regionCount
    }
    const bytes = new Uint8Array(await vec.blob.arrayBuffer())
    const { report } = await analyzeGarment({ bytes, filename: vec.name })
    return report.regionCount
  } catch {
    return 0
  }
}

/** Run the full detect pipeline for one uploaded archive. Throws with a friendly message on failure. */
export async function runImport(file: File, onProgress: (p: ImportProgress) => void): Promise<DetectedGarment[]> {
  onProgress({ stage: 'extract', message: `Extracting ${file.name}…`, pct: 0.05 })
  const files = await extractArchive(file)
  if (files.length === 0) throw new Error('The archive is empty.')

  onProgress({ stage: 'detect', message: `Reading ${files.length} files…`, pct: 0.3 })
  const groups = groupIntoGarments(files, file.name)
  if (groups.length === 0) throw new Error('No garment files were found in the archive.')

  const detected: DetectedGarment[] = []
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]
    onProgress({
      stage: 'preview',
      message: `Generating preview ${i + 1} of ${groups.length} — ${g.name}`,
      pct: 0.35 + (0.6 * (i + 1)) / groups.length,
    })
    const src = pickPreviewSource(g.files)
    const previewBlob = await generatePreview(src, { name: g.name, category: g.category })
    // Validate at UPLOAD: does this garment analyse into editable layers? If not it can't be published.
    const regionCount = await countRegions(g.files)
    detected.push({
      tempId: tempId(),
      name: g.name,
      category: g.category,
      price: defaultGarmentPrice(g.category),
      regionCount,
      files: g.files,
      previewBlob,
      previewUrl: URL.createObjectURL(previewBlob),
      views: detectViews(g.files),
      // a real preview means a usable source image existed (not just the placeholder fallback)
      health: garmentHealth(g.name, g.files, src !== null),
      // Only a garment WITH editable layers is publishable — a 0-layer garment starts excluded.
      include: regionCount > 0,
    })
  }

  flagDuplicateNames(detected)

  onProgress({
    stage: 'done',
    message: `Detected ${detected.length} garment${detected.length === 1 ? '' : 's'}.`,
    pct: 1,
  })
  return detected
}

/** Cross-garment check: mark any garment whose name collides with another as a warning. */
function flagDuplicateNames(detected: DetectedGarment[]): void {
  const counts = new Map<string, number>()
  for (const d of detected) counts.set(d.name.toLowerCase(), (counts.get(d.name.toLowerCase()) ?? 0) + 1)
  for (const d of detected) {
    if ((counts.get(d.name.toLowerCase()) ?? 0) > 1) {
      d.health = {
        status: d.health.status === 'incomplete' ? 'incomplete' : 'warning',
        issues: [...d.health.issues, 'Duplicate name'],
      }
    }
  }
}
