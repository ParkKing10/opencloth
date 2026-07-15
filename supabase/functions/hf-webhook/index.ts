/* ============================================================
   hf-webhook — provider push notifications.

   Deploy with --no-verify-jwt (the provider has no Supabase JWT):
     supabase functions deploy hf-webhook --no-verify-jwt

   Higgsfield documents NO payload signature, so the payload is
   treated purely as a hint: we authenticate the caller with OUR
   shared secret (query param baked into the hf_webhook URL at
   submit time), look the job up by its provider request_id, and
   re-fetch the status from the provider ourselves. Idempotent by
   construction — terminal rows never move, repeated deliveries
   just re-verify. Malformed payloads are rejected.
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { json } from '../_shared/higgsfield.ts'
import { advanceRow } from '../_shared/transition.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false }, 405)

  const secret = Deno.env.get('HIGGSFIELD_WEBHOOK_SECRET')
  const given = new URL(req.url).searchParams.get('secret') ?? ''
  if (!secret || given !== secret) return json({ ok: false }, 401)

  let requestId = ''
  try {
    const payload = (await req.json()) as { request_id?: unknown }
    requestId = typeof payload.request_id === 'string' ? payload.request_id : ''
  } catch {
    /* malformed */
  }
  if (!requestId) return json({ ok: false, error: 'malformed' }, 400)

  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  // Never trust a user-suppliable id blindly: only rows WE created for this
  // provider job can move, and only via a fresh server-to-server status fetch.
  const { data: row } = await svc.from('video_generations').select('*').eq('provider_job_id', requestId).maybeSingle()
  if (!row) return json({ ok: true, ignored: true }) // 2xx: unknown ids must not trigger 2h of retries

  await advanceRow(svc, row)
  return json({ ok: true })
})
