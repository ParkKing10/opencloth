-- Cross-device sync for design/garment documents (run ONCE in the Supabase SQL editor).
-- One row per (user, key). Keys used by the app:
--   doc:<garmentId>      the Design Studio canvas document (layers, pages, specs)
--   garment:<garmentId>  the Garment Lab revision history (editable structure)
--   img:<garmentId>:<versionId>  AI garment backdrop images (base64 data URLs)
--   garments-index       the My-Garments collection index (cards)

create table if not exists public.user_documents (
  owner_id uuid not null default auth.uid(),
  key text not null,
  content text not null,
  updated_at bigint not null,
  primary key (owner_id, key)
);

alter table public.user_documents enable row level security;

drop policy if exists "own documents" on public.user_documents;
create policy "own documents" on public.user_documents
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
