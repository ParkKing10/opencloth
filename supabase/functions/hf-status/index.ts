/* ============================================================
   hf-status — one polite status probe for one generation.

   The client polls THIS (with backoff), never the provider.
   Owner-checked, advances the row via the shared transition
   (chained t2i→i2v, result ingestion into our storage) and
   returns the normalized row.
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CORS, json } from '../_shared/higgsfield.ts'
import { advanceRow } from '../_shared/transition.ts'

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
    /* fall through to validation */
  }
  if (!generationId) return json({ error: { code: 'bad_request', message: 'generationId is required.' } }, 400)

  const svc = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: row } = await svc.from('video_generations').select('*').eq('id', generationId).eq('user_id', user.id).maybeSingle()
  if (!row) return json({ error: { code: 'not_found', message: 'Unknown generation.' } }, 404)

  const fresh = await advanceRow(svc, row)
  return json({ job: fresh ?? row })
})
