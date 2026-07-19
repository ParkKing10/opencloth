/* ============================================================
   hf-cancel — abort one generation, owner-checked.

   Forwards the cancel to the provider (documented: effective only
   while queued) and marks the row cancelled when it is not yet
   terminal. Called when the user hits Cancel or the client-side
   watchdog times out — a refunded job must not keep burning
   provider compute silently.
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CORS, json, hfCancel } from '../_shared/higgsfield.ts'

const TERMINAL = new Set(['completed', 'failed', 'cancelled'])

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

  let generationId = ''
  try {
    generationId = String(((await req.json()) as { generationId?: string }).generationId ?? '')
  } catch {
    /* validated below */
  }
  if (!generationId) return json({ error: { code: 'bad_request', message: 'generationId is required.' } }, 400)

  const svc = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: row } = await svc.from('video_generations').select('*').eq('id', generationId).eq('user_id', user.id).maybeSingle()
  if (!row) return json({ error: { code: 'not_found', message: 'Unknown generation.' } }, 404)
  if (TERMINAL.has(row.status)) return json({ job: row })

  if (row.provider_job_id) await hfCancel(row.provider_job_id) // best-effort; only queued jobs can stop

  const { data: fresh } = await svc
    .from('video_generations')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', row.id)
    .select()
    .single()
  return json({ job: fresh ?? { ...row, status: 'cancelled' } })
})
