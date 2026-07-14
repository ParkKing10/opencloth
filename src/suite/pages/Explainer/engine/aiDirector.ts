/* ============================================================
   Motion engine — the AI director.
   Turns natural language into scenes:
   - draftProject(briefing)  → a full scene list (first cut)
   - editScene(scene, text)  → one scene, iteratively refined

   Uses the SAME OpenAI plumbing as the rest of the app (key +
   model from Settings → AI, JSON mode, reasoning-model handling).
   Every byte of model output goes through sanitize.ts — the
   engine can never crash on a bad response.
   ============================================================ */

import { hasApiKey, isReasoningModel, loadAiSettings, resolveApiKey } from '../../../garment-model/aiSettings'
import type { Brand, Project, Scene } from '../types'
import type { AssetMeta } from './assets'
import { sanitizeScene, sanitizeScenes } from './sanitize'
import { sanitizePatch, type Patch } from './patch'

const REQUEST_TIMEOUT_MS = 60_000
const REASONING_TIMEOUT_MS = 240_000

export type DirectorResult<T> = { ok: true; value: T; model: string } | { ok: false; error: string }

export function hasDirectorAi(): boolean {
  return hasApiKey()
}

/* ---------------- the scene DSL the model writes ---------------- */

const DSL = `You are the motion-graphics director of "loom studios". You compose short, premium SaaS explainer videos (After-Effects style) that a canvas engine renders. You answer with JSON only.

COORDINATES: x/y are the ELEMENT CENTRE, normalised 0..1 of the canvas (0.5/0.5 = middle).
TIMES: every "at" and "dur" is a FRACTION 0..1 of the scene's duration. "duration" itself is seconds.

SCENE SHAPES (JSON):
- {"type":"intro","duration":4,"props":{"title":str,"tagline":str}}                      // logo pop + kinetic title
- {"type":"statement","duration":3.5,"props":{"text":str,"highlight":word-in-text}}     // big message, word-by-word
- {"type":"feature","duration":8,"props":{"heading":str,"caption":str,"demo":"dashboard|analytics","calloutA":str,"calloutB":str}}  // scripted product demo with camera + cursor
- {"type":"stats","duration":5,"props":{"heading":str,"stats":[{"value":num,"suffix":str,"label":str}] (max 4)}}
- {"type":"cta","duration":4.5,"props":{"title":str,"sub":str,"button":str,"url":str}}
- {"type":"custom","duration":secs,"props":{"label":short-str,"orbs":bool,"elements":[Element...],"camera":[{"at":t,"scale":1..1.6,"x":0..1,"y":0..1}...]}}

ELEMENTS for custom scenes — all support: "x","y", "enter":{"effect","at","dur"}, "exit":{"effect","at","dur"}, "pulseAt":[t...]:
- {"kind":"text","text":str,"size":"sm|md|lg|xl","color":"white|muted|accent","kinetic":bool,"maxWidth":0..1}
- {"kind":"image","assetId":from-ASSETS-only,"w":0..1,"frame":"none|browser","radius":px,"shadow":bool}   // the user's real screenshots/logos
- {"kind":"shape","shape":"rect|circle|line","w":0..1,"h":0..1,"color":"accent|white|muted|panel","radius":px,"opacity":0..1}
- {"kind":"button","label":str,"clickAt":t}          // accent pill button; clickAt adds a click ripple
- {"kind":"chip","label":str}                        // small outlined callout pill
- {"kind":"chart","chart":"line|bars","w":0..1,"h":0..1}   // animated chart card
- {"kind":"mockup","w":0..1,"demo":"dashboard|analytics"}  // procedural fake SaaS browser window
- {"kind":"cursor","path":[{"at":t,"x":0..1,"y":0..1,"click":bool}...]}   // animated mouse pointer
Enter/exit effects: "fade","rise","drop","slide-left","slide-right","pop","wipe".

DESIGN RULES:
- Stagger entrances (~0.06 apart); the headline lands first. Never overlap text with text.
- Camera: zoom toward what matters (scale ≤ 1.6) and glide back near the end of the scene. Omit camera when nothing needs focus.
- Accent colour is for emphasis only (one highlight, buttons, chips) — everything else white/muted.
- 3–8 elements per custom scene. Scene durations 3–9s. Whole video usually 4–7 scenes.
- Reference ONLY assetIds that appear in ASSETS. No assets → use mockup/chart/text instead.
- On-screen text uses the language of the user's brief (German brief → German text).`

/* ---------------- OpenAI plumbing (mirrors the app's provider) ---------------- */

async function chatJson(system: string, user: string, signal?: AbortSignal): Promise<string> {
  const { model, temperature, maxTokens } = loadAiSettings()
  const apiKey = resolveApiKey()
  if (!apiKey) throw new Error('No OpenAI key — add one in Settings → AI.')
  const reasoning = isReasoningModel(model)
  const body: Record<string, unknown> = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }
  if (reasoning) {
    if (maxTokens) body.max_completion_tokens = Math.max(maxTokens, 6000)
  } else {
    body.temperature = temperature ?? 0.4
    if (maxTokens) body.max_tokens = maxTokens
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), reasoning ? REASONING_TIMEOUT_MS : REQUEST_TIMEOUT_MS)
  const onOuterAbort = () => controller.abort()
  signal?.addEventListener('abort', onOuterAbort)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (res.status === 401) throw new Error('OpenAI key was rejected (401) — check Settings → AI.')
    if (!res.ok) throw new Error(`OpenAI request failed (${res.status}).`)
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('OpenAI returned no content.')
    return content
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', onOuterAbort)
  }
}

/** JSON.parse that survives code fences and stray prose around the object. */
function parseLoose(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

/* ---------------- the patch DSL (surgical, whole-project editing) ---------------- */

const PATCH_DSL = `You are the motion-graphics director of "loom studios". You EDIT an existing explainer video by returning a small list of surgical OPERATIONS as JSON — never rewrite the whole thing. Change ONLY what the user asked; leave everything else (ids, timings, other scenes) untouched. Answer with JSON only.

COORDINATES x/y = element centre, 0..1 of the canvas. TIMES "at"/"dur" = fraction 0..1 of the scene's duration. "duration" = seconds.

Return: {"summary": short sentence, "ops": [Operation, ...]}

OPERATIONS (pick the fewest that do the job):
- {"op":"setElement","sceneId":id,"elementId":id,"props":{...}}  // change any element props: x,y (move), w/h (resize), color, text, size("sm|md|lg|xl"), label, clickAt, radius, opacity, frame, assetId (from ASSETS only), kinetic, maxWidth, enter/exit ({effect,at,dur}), pulseAt
- {"op":"addElement","sceneId":id,"element":{Element}}          // scene must be "custom"
- {"op":"removeElement","sceneId":id,"elementId":id}
- {"op":"reorderElement","sceneId":id,"elementId":id,"toIndex":n}
- {"op":"setScene","sceneId":id,"duration":secs,"props":{...}}  // retime a scene, or edit template props (intro title, statement text, cta button, …)
- {"op":"replaceScene","sceneId":id,"scene":{Scene}}            // only for a full rebuild of one scene
- {"op":"addScene","scene":{Scene},"atIndex":n}                 // n optional (default end)
- {"op":"removeScene","sceneId":id}
- {"op":"reorderScene","sceneId":id,"toIndex":n}
- {"op":"setAspect","aspect":"16:9|9:16|1:1"}
- {"op":"setBrand","product":str,"accent":"#hex","bg":"midnight|aurora|sunset|mono"}
- {"op":"setAudio","volume":0..1,"fadeIn":secs,"fadeOut":secs,"offset":secs}
- {"op":"alignToBeat","sceneId":id,"strongOnly":bool}          // snap that scene's clicks onto the music beats

ELEMENT shapes (for add/replace) — text{text,size,color,kinetic,maxWidth}, image{assetId,w,frame:"none|browser",radius,shadow}, shape{shape:"rect|circle|line",w,h,color:"accent|white|muted|panel",radius,opacity}, button{label,clickAt}, chip{label}, chart{chart:"line|bars",w,h}, mockup{w,demo:"dashboard|analytics"}, cursor{path:[{at,x,y,click}]}. All support x,y,enter,exit,pulseAt. Enter/exit effects: fade,rise,drop,slide-left,slide-right,pop,wipe.
SCENE shapes — intro{title,tagline}, statement{text,highlight}, feature{heading,caption,demo,calloutA,calloutB}, stats{heading,stats:[{value,suffix,label}]}, cta{title,sub,button,url}, custom{label,orbs,elements,camera}.

RULES: bigger text = size up a step or setElement fontSize via size. "make it cleaner/more premium" → fewer elements, calmer camera, more muted colours, slightly longer durations. Reference ONLY assetIds from ASSETS. Keep on-screen text in the user's language.`

const brandLine = (brand: Brand): string =>
  `BRAND: product "${brand.product}", accent colour ${brand.accent}, dark stage (${brand.bg}).`

const assetLines = (assets: AssetMeta[]): string =>
  assets.length
    ? `ASSETS (the user's uploaded screenshots/logos):\n${assets.map((a) => `- assetId "${a.id}": ${a.name}`).join('\n')}`
    : 'ASSETS: none uploaded.'

/* ---------------- public API ---------------- */

/** One briefing → a complete first-cut scene list. */
export async function draftProject(
  briefing: string,
  brand: Brand,
  assets: AssetMeta[],
  beatHint?: string,
  signal?: AbortSignal,
): Promise<DirectorResult<Scene[]>> {
  try {
    const content = await chatJson(
      DSL,
      `${brandLine(brand)}
${assetLines(assets)}
${beatHint ? `\nMUSIC: ${beatHint} Give scenes clear moments (a button click, a reveal) so they can land on the beat.` : ''}

BRIEF FROM THE USER:
${briefing}

Draft the full explainer now. Mix template scenes and custom scenes — whatever tells the story best. Real product screenshots (ASSETS) beat the procedural mockup when they fit. Return exactly: {"scenes":[Scene, ...]}`,
      signal,
    )
    const parsed = parseLoose(content) as { scenes?: unknown } | null
    const scenes = sanitizeScenes(parsed?.scenes)
    if (scenes.length === 0) return { ok: false, error: 'The AI answer contained no usable scenes — try rephrasing the brief.' }
    return { ok: true, value: scenes, model: loadAiSettings().model }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'AI request failed.' }
  }
}

/** Iterative per-scene direction: "add X", "zoom onto the chart", "make the title bigger"… */
export async function editScene(
  scene: Scene,
  instruction: string,
  brand: Brand,
  assets: AssetMeta[],
  beatHint?: string,
  signal?: AbortSignal,
): Promise<DirectorResult<Scene>> {
  try {
    const content = await chatJson(
      DSL,
      `${brandLine(brand)}
${assetLines(assets)}
${beatHint ? `\nMUSIC: ${beatHint}` : ''}

CURRENT SCENE (JSON):
${JSON.stringify(scene)}

DIRECTION FROM THE USER:
${instruction}

Apply the direction to this scene. Keep everything the user did not mention (including element ids and timings) unchanged. You may convert a template scene to "custom" when the direction needs free composition. Return exactly: {"scene":Scene}`,
      signal,
    )
    const parsed = parseLoose(content) as { scene?: Record<string, unknown> } | null
    if (!parsed?.scene) return { ok: false, error: 'The AI answer contained no scene — try rephrasing.' }
    const next = sanitizeScene({ duration: scene.duration, ...parsed.scene, id: scene.id })
    if (!next) return { ok: false, error: 'The AI produced an invalid scene — try rephrasing.' }
    return { ok: true, value: next, model: loadAiSettings().model }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'AI request failed.' }
  }
}

/**
 * The power path: one instruction edits ANYTHING in the whole project via a validated patch.
 * "make the headline bigger", "change accent to blue", "move the stats scene first",
 * "put the click on the next strong beat", "make it 9:16 and 1s shorter", "add a closing CTA".
 */
export async function directProject(
  project: Project,
  instruction: string,
  assets: AssetMeta[],
  beatHint?: string,
  focusSceneId?: string | null,
  signal?: AbortSignal,
): Promise<DirectorResult<Patch>> {
  try {
    const content = await chatJson(
      PATCH_DSL,
      `${brandLine(project.brand)}
ASPECT: ${project.aspect}. ${project.audio ? `MUSIC: loaded, ${beatHint ?? 'beats available'}.` : 'MUSIC: none.'}
${assetLines(assets)}
${focusSceneId ? `FOCUSED SCENE (what "this"/"the" refers to): ${focusSceneId}` : ''}

CURRENT PROJECT (JSON — use these exact ids in your ops):
${JSON.stringify(project)}

INSTRUCTION FROM THE USER:
${instruction}

Return the minimal ops that satisfy it. {"summary":str,"ops":[...]}`,
      signal,
    )
    const patch = sanitizePatch(parseLoose(content))
    if (patch.ops.length === 0) return { ok: false, error: 'The AI did not produce a usable change — try rephrasing.' }
    return { ok: true, value: patch, model: loadAiSettings().model }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'AI request failed.' }
  }
}
