-- Community 2.0 — one-time migration.
-- Run this in the Supabase SQL editor to make the community Lounge (chat) and the
-- Feedback/Collab boards SHARED across all users. Without it the community still works,
-- but per-browser only (localStorage fallback), exactly like the accessories library.

-- ── Lounge chat messages ─────────────────────────────────────────────────────────────
create table if not exists public.community_messages (
  id text primary key,
  channel text not null,
  author_id text not null,
  author_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists community_messages_channel_idx
  on public.community_messages (channel, created_at);

alter table public.community_messages enable row level security;

drop policy if exists "community messages read" on public.community_messages;
create policy "community messages read"
  on public.community_messages for select to authenticated using (true);

drop policy if exists "community messages write" on public.community_messages;
create policy "community messages write"
  on public.community_messages for insert to authenticated with check (true);

-- ── Feedback + collab board posts ────────────────────────────────────────────────────
create table if not exists public.community_posts (
  id text primary key,
  kind text not null check (kind in ('feedback', 'collab')),
  author_id text not null,
  author_name text not null,
  title text not null,
  body text not null default '',
  image text,
  tags jsonb not null default '[]',
  replies jsonb not null default '[]',
  votes integer not null default 0,
  voter_ids jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.community_posts enable row level security;

drop policy if exists "community posts read" on public.community_posts;
create policy "community posts read"
  on public.community_posts for select to authenticated using (true);

drop policy if exists "community posts write" on public.community_posts;
create policy "community posts write"
  on public.community_posts for insert to authenticated with check (true);

-- Replies and votes are stored on the post row, so members need update rights.
drop policy if exists "community posts update" on public.community_posts;
create policy "community posts update"
  on public.community_posts for update to authenticated using (true) with check (true);

-- ── Starter content (same voices as the local fallback seed) ─────────────────────────
insert into public.community_messages (id, channel, author_id, author_name, text, created_at) values
  ('seed_m1', 'general', 'seed_mika', 'Mika Okafor', 'Welcome to the lounge! Drop what you are working on this week 👇', now() - interval '26 hours'),
  ('seed_m2', 'general', 'seed_nora', 'Nora Bennett', 'Finishing a faded-wash capsule. The AI garment edit for acid wash is scary good.', now() - interval '25 hours'),
  ('seed_m3', 'general', 'seed_diego', 'Diego Salas', 'Same — used it on a selvedge jacket yesterday. Saved me a full sample round.', now() - interval '22 hours'),
  ('seed_m4', 'production', 'seed_elias', 'Elias Vandt', 'Anyone got a trusted manufacturer for small-batch shell jackets in Europe? MOQ under 100.', now() - interval '20 hours'),
  ('seed_m5', 'production', 'seed_sora', 'Sora Tanaka', '@Elias Vandt check the Manufacturers tab — the Porto factory did our 80-piece run, solid QC.', now() - interval '19 hours'),
  ('seed_m6', 'feedback', 'seed_priya', 'Priya Raman', 'Posted my knit hoodie on the feedback board — be brutal, the neckline feels off to me.', now() - interval '8 hours'),
  ('seed_m7', 'collabs', 'seed_mika', 'Mika Okafor', 'Looking for a brand to split a 200-piece drop with. Streetwear, EU shipping. Board post is up.', now() - interval '6 hours'),
  ('seed_m8', 'drops', 'seed_nora', 'Nora Bennett', 'Faded Archive vol. 2 goes live Friday. Lookbook was shot entirely with loom on-model renders.', now() - interval '3 hours')
on conflict (id) do nothing;

insert into public.community_posts (id, kind, author_id, author_name, title, body, tags, replies, votes, created_at) values
  ('seed_p1', 'feedback', 'seed_priya', 'Priya Raman',
   'Is this neckline too wide for a heavyweight knit?',
   'Second iteration of my knit hoodie. The ribbed neckline reads too open to me on the front render — honest takes please.',
   '[]',
   '[{"id":"seed_r1","authorId":"seed_nora","authorName":"Nora Bennett","text":"Not too wide — but I would raise the rib height 2cm so it holds shape after washing.","createdAt":0}]',
   12, now() - interval '9 hours'),
  ('seed_p2', 'feedback', 'seed_diego', 'Diego Salas',
   'Back print placement — high or center?',
   'Carpenter jacket, single back print. High between the shoulder blades feels premium, center feels more street. Votes?',
   '[]', '[]', 8, now() - interval '5 hours'),
  ('seed_p3', 'collab', 'seed_mika', 'Mika Okafor',
   'Split a 200-piece streetwear drop (EU)',
   'I cover design + 50% of production. You bring audience + fulfilment. Revenue split 50/50, drop target in 6 weeks.',
   '["seeking","collab-drop"]', '[]', 15, now() - interval '7 hours'),
  ('seed_p4', 'collab', 'seed_sora', 'Sora Tanaka',
   'Offering: technical flat drawings, 48h turnaround',
   'Art director day-rate is off, but I take small flat-drawing jobs between projects. Portfolio on my profile.',
   '["offering","design-help"]', '[]', 9, now() - interval '4 hours'),
  ('seed_p5', 'collab', 'seed_elias', 'Elias Vandt',
   'Seeking: lookbook photographer in Copenhagen',
   'Two-day shoot, 12 outerwear pieces, studio + street. Paid, credits, and I will return the favour with tech packs.',
   '["seeking","photography"]', '[]', 6, now() - interval '2 hours')
on conflict (id) do nothing;
