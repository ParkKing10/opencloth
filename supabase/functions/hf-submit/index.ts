/* ============================================================
   hf-submit — create one Higgsfield generation job.

   The ONLY place a job is born. Order matters for money-safety:
   the idempotency row is INSERTED FIRST (unique (user_id,
   idempotency_key)) and only the winner talks to the provider —
   a concurrent duplicate conflicts at the insert, BEFORE any
   paid submit, and simply receives the winner's row. The API
   key never leaves this process.

   Secrets:  HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET
   Optional: HIGGSFIELD_WEBHOOK_SECRET (enables hf_webhook),
             HIGGSFIELD_I2V_MODEL / HIGGSFIELD_T2I_MODEL
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CORS, json, hfConfigured, hfSubmit, webhookUrl, MODELS, HfError } from '../_shared/higgsfield.ts'

type SubmitBody = {
  clipId?: string
  projectId?: string
  userPrompt?: string
  compiledPrompt?: string
  durationSec?: number
  aspect?: string
  images?: { name?: string; dataUrl?: string }[]
  idempotencyKey?: string
}

const MAX_IMAGES = 4
const MAX_IMAGE_BYTES = 3_500_000

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string; ext: string } | null {
  const m = /^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(dataUrl)
  if (!m) return null
  const bin = atob(m[3])
  if (bin.length > MAX_IMAGE_BYTES) return null
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { bytes, contentType: m[1], ext: m[2] === 'jpeg' ? 'jpg' : m[2] }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: { code: 'method', message: 'POST only' } }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: userData } = await anon.auth.getUser()
  const user = userData?.user
  if (!user) return json({ error: { code: 'auth', message: 'Sign in required.' } }, 401)

  if (!hfConfigured()) return json({ error: { code: 'not_configured', message: 'Video provider is not configured on the server.' } }, 503)

  let body: SubmitBody
  try {
    body = (await req.json()) as SubmitBody
  } catch {
    return json({ error: { code: 'bad_request', message: 'Malformed JSON.' } }, 400)
  }

  const compiledPrompt = (body.compiledPrompt ?? '').trim().slice(0, 4000)
  const userPrompt = (body.userPrompt ?? '').trim().slice(0, 1000)
  const clipId = (body.clipId ?? '').slice(0, 64)
  const idempotencyKey = (body.idempotencyKey ?? '').slice(0, 80)
  if (!compiledPrompt || !clipId || !idempotencyKey) {
    return json({ error: { code: 'bad_request', message: 'compiledPrompt, clipId and idempotencyKey are required.' } }, 400)
  }
  // Official examples document 5s; longer requests round to the next supported step.
  const duration = (body.durationSec ?? 5) <= 6 ? 5 : 10
  const aspect = body.aspect === '9:16' || body.aspect === '1:1' ? body.aspect : '16:9'
  const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : []

  const svc = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Upload reference images to OUR storage; the provider gets stable public URLs.
  const refUrls: string[] = []
  for (const img of images) {
    const parsed = img?.dataUrl ? dataUrlToBytes(img.dataUrl) : null
    if (!parsed) return json({ error: { code: 'unsupported_asset', message: 'Only PNG/JPEG/WebP references up to 3.5 MB are supported.' } }, 400)
    const path = `refs/${user.id}/${crypto.randomUUID()}.${parsed.ext}`
    const { error: upErr } = await svc.storage.from('generated-media').upload(path, parsed.bytes, { contentType: parsed.contentType })
    if (upErr) return json({ error: { code: 'upload_failed', message: 'Could not store a reference image.' } }, 502)
    refUrls.push(svc.storage.from('generated-media').getPublicUrl(path).data.publicUrl)
  }

  const mode = refUrls.length > 0 ? 'image-to-video' : 'text-to-video'
  const chain: 'none' | 't2i' = refUrls.length > 0 ? 'none' : 't2i'
  const model = refUrls.length > 0 ? MODELS.i2v : MODELS.t2i

  // IDEMPOTENCY ROW FIRST — before any paid provider call. A duplicate submit
  // conflicts here (unique user_id+idempotency_key) and gets the winner's row.
  const { data: row, error: insErr } = await svc
    .from('video_generations')
    .insert({
      user_id: user.id,
      project_id: (body.projectId ?? '').slice(0, 64),
      clip_id: clipId,
      provider: 'higgsfield',
      provider_job_id: null,
      model,
      mode,
      user_prompt: userPrompt,
      compiled_prompt: compiledPrompt,
      request_params: { duration, aspect, chain },
      asset_refs: refUrls,
      idempotency_key: idempotencyKey,
      status: 'validating',
    })
    .select()
    .single()

  if (insErr || !row) {
    const { data: existing } = await svc
      .from('video_generations')
      .select('*')
      .eq('user_id', user.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (existing) return json({ job: existing, deduped: true })
    return json({ error: { code: 'db', message: 'Could not record the job.' } }, 500)
  }

  // Now — and only now — pay: submit to the documented model for the mode.
  try {
    const input = chain === 'none' ? { prompt: compiledPrompt, image_url: refUrls[0], duration } : { prompt: compiledPrompt, aspect_ratio: aspect }
    const sub = await hfSubmit(model, input, webhookUrl())
    const { data: live } = await svc
      .from('video_generations')
      .update({ provider_job_id: sub.requestId, status: 'queued', updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select()
      .single()
    return json({ job: live ?? { ...row, provider_job_id: sub.requestId, status: 'queued' }, deduped: false })
  } catch (err) {
    const e = err instanceof HfError ? err : new HfError('provider_unavailable', 'Provider request failed.')
    await svc
      .from('video_generations')
      .update({ status: 'failed', error_code: e.code, error_message: e.message, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    return json({ error: { code: e.code, message: e.message } }, 502)
  }
})
