/**
 * Builds the BASE editable garment for each create method in the wizard. The library then assigns
 * an id, seeds history, and files it in the collection.
 *
 * - blank  → the chosen real template.
 * - ai     → the deterministic placeholder maps the prompt to the closest real template (honest:
 *            true prompt-to-garment generation needs the AI worker; this is a real editable start).
 * - upload → creates a real editable template named from the file. Converting an uploaded pack
 *            (AI/PDF/SVG) into regions requires the conversion worker — a future milestone — so
 *            the file is not parsed here; the garment is a genuine editable template, not a fake.
 */
import type { EditableGarment } from './editableGarment'
import { getTemplate, nearestTemplate } from './garmentTemplates'

/** Turn a free-text prompt or filename into a clean garment name. */
export function toGarmentName(text: string): string {
  const cleaned = text
    .replace(/\.[a-z0-9]+$/i, '') // strip extension
    .replace(/[_-]+/g, ' ')
    .replace(/\b(create|make|design|a|an|the|please|with|for me)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return 'Untitled Garment'
  const titled = cleaned
    .split(' ')
    .slice(0, 5)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return titled.slice(0, 48)
}

export function buildFromTemplate(templateId: string): { garment: EditableGarment; name: string; category: string } {
  const tpl = getTemplate(templateId) ?? nearestTemplate('')
  return { garment: tpl.make(), name: tpl.name, category: tpl.category }
}

export function buildFromPrompt(prompt: string): { garment: EditableGarment; name: string; category: string } {
  const tpl = nearestTemplate(prompt)
  return { garment: tpl.make(), name: toGarmentName(prompt), category: tpl.category }
}

export function buildFromUpload(filename: string): { garment: EditableGarment; name: string; category: string } {
  const tpl = nearestTemplate(filename)
  return { garment: tpl.make(), name: toGarmentName(filename), category: tpl.category }
}
