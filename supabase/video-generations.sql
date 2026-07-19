-- ============================================================
-- Video generations — one row per provider job (Higgsfield).
-- Run once in the Supabase SQL editor (same one-time pattern as
-- community.sql / user-documents.sql).
--
-- The provider API key NEVER lives here or in the client — it is
-- an Edge Function secret:
--   supabase secrets set HIGGSFIELD_API_KEY=...  HIGGSFIELD_API_SECRET=...
-- ============================================================

create table if not exists public.video_generations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  project_id    text not null default '',
  clip_id       text not null,
  provider      text not null default 'higgsfield',
  provider_job_id text,
  model         text,
  mode          text not null default 'image-to-video',
  user_prompt   text not null default '',
  compiled_prompt text not null default '',
  request_params jsonb not null default '{}'::jsonb,
  asset_refs    jsonb not null default '[]'::jsonb,
  idempotency_key text not null,
  status        text not null default 'queued',
  error_code    text,
  error_message text,
  result_path   text,
  result_url    text,
  cost          numeric,
  retry_count   int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One job per user intent: the same idempotency key can never create a second paid job.
create unique index if not exists video_generations_idem
  on public.video_generations (user_id, idempotency_key);

create index if not exists video_generations_user on public.video_generations (user_id, created_at desc);
create index if not exists video_generations_provider_job on public.video_generations (provider_job_id);

alter table public.video_generations enable row level security;

-- Users see and create ONLY their own jobs. All writes beyond insert go through
-- Edge Functions with the service role (status transitions must not be client-editable).
drop policy if exists "video_generations_select_own" on public.video_generations;
create policy "video_generations_select_own"
  on public.video_generations for select
  using (auth.uid() = user_id);

-- ── Storage: reference uploads + ingested results ─────────────
insert into storage.buckets (id, name, public)
values ('generated-media', 'generated-media', true)
on conflict (id) do nothing;

-- NO select policy on purpose. The bucket is public=true, so objects are
-- fetchable by their direct URL (paths contain unguessable UUIDs) — that is
-- all <video> tags need. A bucket-wide SELECT policy would additionally allow
-- storage.list()/search, letting ANY caller enumerate every user's reference
-- images and results. Writes happen only via the service role in Edge Functions.
drop policy if exists "generated_media_public_read" on storage.objects;
