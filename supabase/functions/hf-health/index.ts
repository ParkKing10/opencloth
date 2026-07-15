/* ============================================================
   hf-health — provider diagnostics for the admin page.

   Reports configuration presence (never values), the active
   model registry and the caller's recent job statistics. The
   full API key is never returned anywhere.
   ============================================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CORS, json, hfConfigured, MODELS } from '../_shared/higgsfield.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: userData } = await anon.auth.getUser()
  if (!userData?.user) return json({ error: { code: 'auth', message: 'Sign in required.' } }, 401)

  const svc = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: jobs } = await svc
    .from('video_generations')
    .select('id, status, model, error_code, created_at, updated_at')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false })
    .limit(25)

  const list = jobs ?? []
  const done = list.filter((j) => j.status === 'completed')
  const failed = list.filter((j) => j.status === 'failed')
  const latencies = done
    .map((j) => (new Date(j.updated_at).getTime() - new Date(j.created_at).getTime()) / 1000)
    .filter((s) => Number.isFinite(s) && s > 0)

  return json({
    configured: hfConfigured(),
    webhookConfigured: !!Deno.env.get('HIGGSFIELD_WEBHOOK_SECRET'),
    models: { imageToVideo: MODELS.i2v, textToImage: MODELS.t2i, alternates: MODELS.i2vAlternates },
    recentJobs: list,
    stats: {
      total: list.length,
      completed: done.length,
      failed: failed.length,
      successRate: list.length ? done.length / Math.max(1, done.length + failed.length) : null,
      avgLatencySec: latencies.length ? latencies.reduce((s, v) => s + v, 0) / latencies.length : null,
    },
  })
})
