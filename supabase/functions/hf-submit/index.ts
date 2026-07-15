/* ============================================================
   hf-submit — create one Higgsfield generation job.

   The ONLY place a job is born. Validates the user, enforces
   idempotency (unique (user_id, idempotency_key)), uploads the
   clip's reference images to our storage, picks the documented
   model for the mode and submits. The API key never leaves this
   process.

   Secrets:  HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET
   Optional: HIGGSFIELD_WEBHOOK_SECRET (enables hf_webhook),
             HIGGSFIELD_I2V_MODEL / HIGGSFIELD_T2I_MODEL
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CORS, json, hfConfigured, hfSubmit, MODELS, HfError } from '../_shared/higgsfield.ts'

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

  // Idempotency FIRST: the same intent never becomes a second paid job.
  const { data: existing } = await svc
    .from('video_generations')
    .select('*')
    .eq('user_id', user.id)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (existing) return json({ job: existing, deduped: true })

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

  // Documented modes only: images → image-to-video; none → t2i→i2v chain.
  const webhookSecret = Deno.env.get('HIGGSFIELD_WEBHOOK_SECRET')
  const webhookUrl = webhookSecret ? `${supabaseUrl}/functions/v1/hf-webhook?secret=${encodeURIComponent(webhookSecret)}` : undefined

  let providerJobId: string
  let model: string
  let chain: 'none' | 't2i'
  try {
    if (refUrls.length > 0) {
      model = MODELS.i2v
      chain = 'none'
      const sub = await hfSubmit(model, { prompt: compiledPrompt, image_url: refUrls[0], duration }, webhookUrl)
      providerJobId = sub.requestId
    } else {
      // No assets: first a documented text-to-image, hf-status chains the i2v step.
      model = MODELS.t2i
      chain = 't2i'
      const sub = await hfSubmit(model, { prompt: compiledPrompt, aspect_ratio: aspect }, webhookUrl)
      providerJobId = sub.requestId
    }
  } catch (err) {
    const e = err instanceof HfError ? err : new HfError('provider_unavailable', 'Provider request failed.')
    return json({ error: { code: e.code, message: e.message } }, 502)
  }

  const { data: row, error: insErr } = await svc
    .from('video_generations')
    .insert({
      user_id: user.id,
      project_id: (body.projectId ?? '').slice(0, 64),
      clip_id: clipId,
      provider: 'higgsfield',
      provider_job_id: providerJobId,
      model,
      mode: refUrls.length > 0 ? 'image-to-video' : 'text-to-video',
      user_prompt: userPrompt,
      compiled_prompt: compiledPrompt,
      request_params: { duration, aspect, chain },
      asset_refs: refUrls,
      idempotency_key: idempotencyKey,
      status: 'queued',
    })
    .select()
    .single()
  if (insErr || !row) {
    // Unique-index race: a concurrent identical submit won — return that job.
    const { data: raced } = await svc
      .from('video_generations')
      .select('*')
      .eq('user_id', user.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()
    if (raced) return json({ job: raced, deduped: true })
    return json({ error: { code: 'db', message: 'Could not record the job.' } }, 500)
  }
  return json({ job: row, deduped: false })
})
