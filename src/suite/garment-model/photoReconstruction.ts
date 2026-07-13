/**
 * Generate from Photo (Milestone 8.2, Option 2). The user uploads one or more garment photos;
 * loom studios reconstructs them as a fully EDITABLE garment (front + back, region tree, vector paths).
 * The photo is ONLY a reference — it is never stored as the editable source, never rasterized,
 * never returned as an image. Provider-agnostic: OpenAI vision when a key is set, else a template
 * start (honest — no vision model, no invented confidences).
 */
import { resolveProvider, hasFrontAndBack, type ReconstructionResult } from './aiProvider'

/** Animated phases for the reconstruction progress screen. */
export const PHOTO_PHASES = [
  'Analyzing garment',
  'Detecting silhouette',
  'Detecting sleeves',
  'Detecting collar',
  'Detecting cuffs',
  'Detecting waistband',
  'Detecting pockets',
  'Detecting zipper',
  'Detecting buttons',
  'Detecting stitching',
  'Building front',
  'Building back',
  'Building region tree',
  'Optimizing editable vector',
  'Opening loom studios editor',
] as const

export const PHOTO_ACCEPT = '.png,.jpg,.jpeg,.webp,.heic,.pdf,image/*'
const MAX_PHOTOS = 6

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read that image'))
    reader.readAsDataURL(file)
  })
}

export async function reconstructFromPhotos(files: File[]): Promise<ReconstructionResult> {
  const images = await Promise.all(files.slice(0, MAX_PHOTOS).map(fileToDataUrl))
  const result = await resolveProvider().reconstructGarment(images)
  // The garment is built from a trusted template with proper front + back construction; we do NOT
  // mirror views here (that would copy front-only details like the placket onto the back).
  if (!hasFrontAndBack(result.garment)) throw new Error('Reconstructed garment is missing front or back')
  return result
}
