/**
 * One garment-edit interface, two providers.
 *
 *   Editable Garment + prompt → provider.editGarment → validated Editable Garment (never an image)
 *
 * - PlaceholderProvider wraps the deterministic Milestone 8 editor (always available, no network).
 * - OpenAiProvider calls the real OpenAI chat API, then THREADOS VALIDATES the response is a
 *   well-formed editable garment that preserved IDs/hierarchy/order. Anything invalid, or any
 *   failure, falls back to the placeholder — so callers always get a usable editable garment.
 *
 * resolveProvider() picks OpenAI when a key is configured, else the placeholder. Callers use the
 * same interface regardless — no duplication.
 *
 * NOTE: image generation is intentionally NOT wired (Milestone 8.1). The OpenAI path returns a
 * STRUCTURED garment edit as JSON. It is implemented and guarded, but has not been run against a
 * live key in this milestone; it degrades to the placeholder on any error.
 */
import type { EditableGarment } from './editableGarment'
import { isEditableGarment } from './editableGarment'
import { editGarment as placeholderEdit, type AiEditResult } from './aiGarmentEditor'
import { diffGarments } from './garmentDiff'
import { buildFromPrompt } from './garmentFactory'
import { getTemplate } from './garmentTemplates'
import { makeReferenceBomber } from './referenceGarment'
import { normalizeGarment, parseJsonLoose } from './garmentNormalize'
import { coerceSpec, type GarmentSpec } from './garmentSpec'
import { buildFromSpec } from './specToGarment'
import { loadAiSettings, resolveApiKey, isReasoningModel, type AiProviderId } from './aiSettings'

/** Result of generating a NEW garment from a prompt. Always a structured editable garment. */
export type AiGenerationResult = { garment: EditableGarment; source: AiProviderId }

/** Per-region reconstruction confidence (only present when a real vision model produced it). */
export type RegionConfidence = { label: string; value: number }

/**
 * Result of reconstructing a garment from photos — an editable garment, NEVER the photo.
 * `spec` is the detected garment spec (present only on a real vision analysis). `templateStart` is
 * true when we could NOT analyse the photo (no key, or an unusable response) and honestly started
 * the user from a neutral template instead of pretending it came from their photo.
 */
export type ReconstructionResult = {
  garment: EditableGarment
  confidences?: RegionConfidence[]
  source: AiProviderId
  spec?: GarmentSpec
  templateStart?: boolean
}

/** An honest "we couldn't reconstruct your photo" result: a neutral template, clearly labelled. */
function templateStart(source: AiProviderId): ReconstructionResult {
  const g = getTemplate('tpl-tshirt')?.make() ?? makeReferenceBomber()
  return {
    garment: { ...g, name: 'Template start · not from your photo', source: { kind: 'reference' } },
    source,
    templateStart: true,
  }
}

const REQUEST_TIMEOUT_MS = 45000
const REASONING_TIMEOUT_MS = 120000 // reasoning models (gpt-5/o-series) think before answering — give them room

/** fetch with a hard timeout so a slow/hung network can never leave generation spinning forever. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw new Error('OpenAI request timed out')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export interface AiGarmentProvider {
  readonly id: AiProviderId
  editGarment(garment: EditableGarment, prompt: string): Promise<AiEditResult>
  /** Generate a NEW editable garment from a prompt — always with front + back views. */
  generateGarment(prompt: string): Promise<AiGenerationResult>
  /** Reconstruct an editable garment from one or more photos (data URLs). NEVER returns the photo. */
  reconstructGarment(images: string[]): Promise<ReconstructionResult>
}

/** A garment is only usable if it has both a front and a back view with real regions. */
export function hasFrontAndBack(g: EditableGarment): boolean {
  const ids = g.views.map((v) => v.id)
  if (!ids.includes('front') || !ids.includes('back')) return false
  const shapes = Object.values(g.regions).flatMap((r) => r.shapes)
  return shapes.some((s) => s.view === 'front') && shapes.some((s) => s.view === 'back')
}

class PlaceholderProvider implements AiGarmentProvider {
  readonly id = 'placeholder' as const
  async editGarment(garment: EditableGarment, prompt: string): Promise<AiEditResult> {
    return placeholderEdit(garment, prompt)
  }
  async generateGarment(prompt: string): Promise<AiGenerationResult> {
    // No key → build a real editable garment from the closest template (front + back guaranteed).
    const { garment, name } = buildFromPrompt(prompt)
    return {
      garment: { ...garment, name, source: { kind: 'ai', prompt, worker: 'placeholder', generatedAt: Date.now() } },
      source: 'placeholder',
    }
  }
  async reconstructGarment(_images: string[]): Promise<ReconstructionResult> {
    // No vision model → we cannot analyse the photo. Be honest: start from a neutral template,
    // clearly labelled, with NO invented confidences. The UI tells the user to add a key.
    return templateStart('placeholder')
  }
}

const SYSTEM_PROMPT = `You are the THREADOS garment editor. You receive an editable garment as JSON and a user instruction.
Return ONLY a JSON object of the SAME schema representing the edited garment. Rules:
- Edit ONLY the regions the instruction requires; leave everything else byte-identical.
- Preserve every region id, the parent/child hierarchy, and rootIds order wherever possible.
- Never return an image or prose. Never invent a different garment. Output must be valid JSON only.`

const GENERATE_SYSTEM_PROMPT = `You are the THREADOS garment generator. Output ONLY a JSON object in the THREADOS
Editable Garment format — never an image, never PNG/JPG, never prose. The garment MUST contain:
- "format":"threados.editable-garment","version":1, a unique "id", a "name", a "category", "style":"tech-flat".
- "views": BOTH a front and a back view: [{"id":"front","label":"Front","viewBox":{"w":400,"h":560}},{"id":"back","label":"Back","viewBox":{"w":400,"h":560}}].
- "rootIds": ordered top-level region ids, and "regions": a map of id → {id,name,type,children[],shapes[],visible:true,locked:false,capabilities}.
- Each shape: {"view":"front"|"back","d":"<SVG path>","role":"fill"|"outline"|"seam"|"stitch"|"detail"}. Provide BOTH front AND back shapes.
- A real region hierarchy (body, collar, sleeves, cuffs, pockets, buttons, waistband, zipper, labels, topstitching, panels, back yoke, …), symmetric, white fill with black outlines (a professional technical flat).
- viewBox is 400×560; draw within it, symmetric about x=200. EVERY region needs at least one front shape AND one back shape.
Follow this shape EXACTLY (minimal example):
{"format":"threados.editable-garment","version":1,"id":"g1","name":"Tee","category":"Tops","style":"tech-flat",
"views":[{"id":"front","label":"Front","viewBox":{"w":400,"h":560}},{"id":"back","label":"Back","viewBox":{"w":400,"h":560}}],
"rootIds":["body","collar"],
"regions":{"body":{"id":"body","name":"Body","type":"body","children":[],"shapes":[{"view":"front","d":"M150,120 L250,120 L258,432 L142,432 Z","role":"fill"},{"view":"back","d":"M150,120 L250,120 L258,432 L142,432 Z","role":"fill"}],"visible":true,"locked":false,"capabilities":{"colorReplaceable":true,"materialAssignable":true,"textureAssignable":true,"embroiderable":true,"printable":true}},
"collar":{"id":"collar","name":"Collar","type":"collar","children":[],"shapes":[{"view":"front","d":"M182,120 Q200,142 218,120","role":"seam"},{"view":"back","d":"M182,120 Q200,142 218,120","role":"seam"}],"visible":true,"locked":false,"capabilities":{"colorReplaceable":true,"materialAssignable":true,"textureAssignable":true,"embroiderable":true,"printable":true}}},
"source":{"kind":"ai"},"createdAt":0}
Return valid JSON only.`

const RECONSTRUCT_SPEC_PROMPT = `You are a garment analyst. You receive one or more PHOTOS of a single garment.
Do NOT draw, trace, or output any SVG, path, image, or geometry — you cannot trace a photo accurately, so don't try.
Instead, CLASSIFY the garment and read its construction, returning ONLY this JSON spec:
{
  "garmentType": {"value":"jacket|puffer|coat|parka|blazer|hoodie|sweater|cardigan|tee|polo|tank|dress|skirt|pants|shorts|jumpsuit|unknown","confidence":0-100},
  "length":      {"value":"cropped|regular|long","confidence":0-100},
  "sleeves":     {"value":"sleeveless|short|long","confidence":0-100},
  "collar":      {"value":"none|crew|ribbed|hood|lapel","confidence":0-100},
  "closure":     {"value":"none|zip|buttons|snaps","confidence":0-100},
  "pockets":     {"value":"none|side|kangaroo|chest","confidence":0-100},
  "primaryColor":   {"value":"<colour name or hex>","confidence":0-100},
  "secondaryColor": {"value":"<colour name or hex>","confidence":0-100},
  "pattern":     {"value":"solid|striped|graphic","confidence":0-100}
}
Rules: choose ONLY from the listed enum values for each field. "confidence" is YOUR real certainty (0–100).
If you cannot tell a field, pick the closest option and give it a LOW confidence. A varsity/letterman jacket is "jacket".
Return valid JSON only — the spec object above, nothing else.`

const shapeCount = (g: EditableGarment): number => Object.values(g.regions).reduce((n, r) => n + r.shapes.length, 0)

/** Guard that an OpenAI response is a safe, region-preserving edit; otherwise reject it. */
function isAcceptableEdit(before: EditableGarment, after: unknown): after is EditableGarment {
  if (!isEditableGarment(after)) return false
  // The garment identity and view space must be unchanged (an edit, not a replacement).
  if (after.id !== before.id || after.views.length !== before.views.length) return false
  // An edit must keep at least half the original regions (reject a wholesale rewrite).
  const survivors = Object.keys(before.regions).filter((id) => after.regions[id]).length
  if (survivors < Object.keys(before.regions).length / 2) return false
  // An edit must not destroy the garment's geometry — vector detail can't collapse to near-nothing.
  const before2 = shapeCount(before)
  const after2 = shapeCount(after)
  if (before2 > 0 && after2 < before2 * 0.3) return false
  return true
}

class OpenAiProvider implements AiGarmentProvider {
  readonly id = 'openai' as const
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly temperature?: number,
    private readonly maxTokens?: number,
  ) {}

  async editGarment(garment: EditableGarment, prompt: string): Promise<AiEditResult> {
    try {
      const content = await this.chat(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `INSTRUCTION: ${prompt}\n\nGARMENT:\n${JSON.stringify(garment)}` },
        ],
        0.2,
      )
      const parsed: unknown = JSON.parse(content)
      if (!isAcceptableEdit(garment, parsed)) return this.fallback(garment, prompt, 'OpenAI output failed validation')
      const diff = diffGarments(garment, parsed)
      return { garment: parsed, changedRegionIds: diff.changed, summary: [`Edited via OpenAI (${this.model})`], understood: true, intent: 'openai' }
    } catch (err) {
      return this.fallback(garment, prompt, err instanceof Error ? err.message : 'OpenAI error')
    }
  }

  /** Any failure degrades to the deterministic placeholder — the caller always gets a real result. */
  private fallback(garment: EditableGarment, prompt: string, _reason: string): AiEditResult {
    return placeholderEdit(garment, prompt)
  }

  /**
   * POST chat completions with a MODEL-APPROPRIATE body and return the raw message text.
   * Reasoning models (gpt-5 / o-series) reject `temperature` and `max_tokens` — they take
   * `max_completion_tokens` and no temperature, and think longer (so a longer timeout). Throws
   * ONLY on network / non-200 / empty content.
   */
  private async chat(messages: Array<{ role: string; content: unknown }>, temperature: number): Promise<string> {
    const reasoning = isReasoningModel(this.model)
    const body: Record<string, unknown> = { model: this.model, response_format: { type: 'json_object' }, messages }
    if (reasoning) {
      // Honour the user's cap, but floor it — reasoning tokens count against this budget, and too low
      // a cap makes the model spend it all "thinking" and return empty content.
      if (this.maxTokens) body.max_completion_tokens = Math.max(this.maxTokens, 4000)
    } else {
      body.temperature = this.temperature ?? temperature
      if (this.maxTokens) body.max_tokens = this.maxTokens
    }
    const res = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
      },
      reasoning ? REASONING_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
    )
    if (!res.ok) throw new Error(`OpenAI request failed (${res.status})`)
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('OpenAI returned no content')
    return content
  }

  async generateGarment(prompt: string): Promise<AiGenerationResult> {
    // Repair-first: the model's output is normalized into a valid garment; a stricter retry runs if
    // it's unusable; a template start is the final safety net — so generation never errors on output.
    const attempt = async (extra: string) =>
      normalizeGarment(parseJsonLoose(await this.chat([
        { role: 'system', content: GENERATE_SYSTEM_PROMPT + extra },
        { role: 'user', content: `Create this garment as a THREADOS editable garment: ${prompt}` },
      ], 0.4)))

    let garment = await attempt('')
    if (!garment) garment = await attempt(RETRY_HINT)
    if (!garment) {
      const { garment: tpl, name } = buildFromPrompt(prompt)
      return { garment: { ...tpl, name, source: { kind: 'ai', prompt, worker: 'openai-fallback', generatedAt: Date.now() } }, source: 'placeholder' }
    }
    return { garment: { ...garment, name: garment.name || 'AI Garment', source: { kind: 'ai', prompt, worker: 'openai', generatedAt: Date.now() } }, source: 'openai' }
  }

  async reconstructGarment(images: string[]): Promise<ReconstructionResult> {
    // Vision returns a SPEC (type + construction), not geometry — that's what it can do reliably.
    // THREADOS then assembles the garment from its own trusted templates. A network failure throws
    // (→ honest retry UI); a response we can't read becomes an honest template start.
    const userContent = [
      { type: 'text', text: 'Analyse the garment in the photo(s) and return the JSON spec. Use the photos only as reference; never return the image or any geometry.' },
      ...images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
    ]
    const raw = parseJsonLoose(await this.chat([
      { role: 'system', content: RECONSTRUCT_SPEC_PROMPT },
      { role: 'user', content: userContent },
    ], 0.4))
    const spec = coerceSpec(raw)
    if (!spec) return templateStart('openai')
    const { garment, confidences } = buildFromSpec(spec)
    return { garment, confidences, spec, source: 'openai' }
  }
}

const RETRY_HINT =
  '\n\nYour previous output could not be used. Return ONLY a JSON object with a non-empty "regions" map; each region MUST have a non-empty "shapes" array where every shape is {"view":"front"|"back","d":"<SVG path>","role":"fill"|"outline"|"seam"|"stitch"|"detail"}. Include BOTH front and back shapes.'

/** The active provider: OpenAI when a key is configured, else the deterministic placeholder. */
export function resolveProvider(): AiGarmentProvider {
  const key = resolveApiKey()
  if (!key) return new PlaceholderProvider()
  const s = loadAiSettings()
  return new OpenAiProvider(key, s.model, s.temperature, s.maxTokens)
}
