import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Frontend Supabase client. Uses the publishable (anon) key — safe for the
 * browser because every table is protected by Row Level Security. The secret
 * key and database password must never reach the client.
 *
 * If the env vars are absent the app keeps working against the local store,
 * so development never hard-fails on a missing backend.
 */
const env = import.meta.env as unknown as Record<string, string | undefined>

const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured: boolean = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
