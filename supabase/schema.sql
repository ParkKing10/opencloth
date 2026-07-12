-- ============================================================================
-- THREADOS — Supabase schema + Row Level Security
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run (idempotent).
-- ============================================================================

-- ---------- PROFILES (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null default '',
  email      text not null default '',
  role       text not null default 'user'   check (role   in ('user','admin')),
  plan       text not null default 'Free'   check (plan   in ('Free','Studio','Scale')),
  status     text not null default 'active' check (status in ('active','suspended')),
  coins      integer not null default 100,
  created_at timestamptz not null default now()
);

-- Is the current user an admin? (security definer so the policy can read profiles)
create or replace function public.is_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- Create a profile automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- OWNER-SCOPED CONTENT ----------
create table if not exists public.collections (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  season     text not null default '',
  status     text not null default 'draft',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.designs (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  kind          text not null default 'hoodie',
  status        text not null default 'draft',
  progress      integer not null default 0,
  collection_id uuid references public.collections(id) on delete set null,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table if not exists public.tech_packs (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  kind         text not null default 'hoodie',
  status       text not null default 'draft',
  manufacturer text,
  pages        integer not null default 1,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  design_name  text not null,
  kind         text not null default 'hoodie',
  qty          integer not null default 0,
  manufacturer text,
  country      text,
  stage        text not null default 'sample',
  progress     integer not null default 0,
  eta          text,
  created_at   timestamptz not null default now()
);

-- ---------- SHARED CATALOG ----------
create table if not exists public.manufacturers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  city         text,
  country      text,
  rating       numeric,
  reviews      integer,
  moq          integer,
  lead_days    integer,
  capabilities text[] not null default '{}',
  price_from   numeric,
  verified     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles      enable row level security;
alter table public.collections   enable row level security;
alter table public.designs       enable row level security;
alter table public.tech_packs    enable row level security;
alter table public.orders        enable row level security;
alter table public.manufacturers enable row level security;

-- ---------- TABLE GRANTS ----------
-- RLS decides which ROWS a request may touch, but the API roles still need
-- table-level privileges. Tables created via raw SQL don't always inherit
-- Supabase's default grants, so grant them explicitly (RLS remains the gate).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.manufacturers to anon;

-- Profiles: read your own or (admin) everyone; update your own; admins update anyone.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update using (public.is_admin());

-- Privilege guard: the self-update policy lets a user edit their own row, but they
-- must not be able to escalate role or lift their own suspension. This trigger pins
-- role/status to their previous values for a regular authenticated non-admin user.
--
-- IMPORTANT: it must NOT fire for the service role / SQL editor (which have no
-- auth.uid()). Otherwise `is_admin()` is false there and the guard reverts every
-- role change — making it impossible to promote the FIRST admin. The
-- `auth.uid() is not null` clause scopes the guard to end-user API updates only;
-- the SQL editor / service role (and real admins) may set role/status freely.
create or replace function public.profiles_guard()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role   := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- Owner-scoped tables: owners get full CRUD on their rows; admins can read all.
do $$
declare t text;
begin
  foreach t in array array['collections','designs','tech_packs','orders']
  loop
    execute format('drop policy if exists %I_owner_all on public.%I', t, t);
    execute format(
      'create policy %I_owner_all on public.%I for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
      t, t);
    execute format('drop policy if exists %I_admin_read on public.%I', t, t);
    execute format(
      'create policy %I_admin_read on public.%I for select using (public.is_admin())', t, t);
  end loop;
end $$;

-- Manufacturers: any signed-in user can read; only admins can write.
drop policy if exists manufacturers_read on public.manufacturers;
create policy manufacturers_read on public.manufacturers
  for select using (auth.role() = 'authenticated');
drop policy if exists manufacturers_admin_write on public.manufacturers;
create policy manufacturers_admin_write on public.manufacturers
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- SEED the shared manufacturer catalog (only if empty)
-- ============================================================================
insert into public.manufacturers (name, city, country, rating, reviews, moq, lead_days, capabilities, price_from, verified)
select * from (values
  ('Atelier Norte','Porto','Portugal',4.9,128,50,18, array['Knitwear','Cut & Sew'],14,true),
  ('Bosphorus Mills','Istanbul','Turkey',4.8,214,100,16, array['Cut & Sew','Knitwear','Accessories'],9,true),
  ('Saigon Craft Co.','Ho Chi Minh City','Vietnam',4.7,96,150,24, array['Outerwear','Cut & Sew'],21,true),
  ('Milano Forma','Milan','Italy',5.0,74,30,28, array['Outerwear','Denim'],46,true),
  ('Canton Thread Works','Guangzhou','China',4.6,331,300,20, array['Cut & Sew','Knitwear','Accessories'],7,true),
  ('Indigo House Denim','Ahmedabad','India',4.8,152,200,26, array['Denim','Cut & Sew'],16,true)
) as v
where not exists (select 1 from public.manufacturers);

-- ============================================================================
-- PHASE 2 — THREADOS Drive + Brand Kit
-- ============================================================================

-- Drive assets: metadata for files stored in the 'drive' storage bucket.
create table if not exists public.drive_assets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  folder       text not null default 'Graphics',
  mime         text not null default '',
  size_bytes   bigint not null default 0,
  storage_path text not null,
  created_at   timestamptz not null default now()
);

-- Brand kit: one row per account — brand defaults every new project loads.
create table if not exists public.brand_kits (
  owner_id       uuid primary key references auth.users(id) on delete cascade,
  brand_name     text not null default '',
  primary_font   text not null default 'Inter',
  secondary_font text not null default 'Space Grotesk',
  colors         jsonb not null default '["#D8FF3E","#14141A","#F4F4F6"]',
  default_fabric text not null default 'French Terry 450 GSM',
  default_fit    text not null default 'Oversized',
  default_labels text not null default 'Woven neck label + heat-transfer care label',
  packaging_notes text not null default '',
  brand_notes    text not null default '',
  memory_enabled boolean not null default true,
  memory         jsonb not null default '{}',
  updated_at     timestamptz not null default now()
);

alter table public.drive_assets enable row level security;
alter table public.brand_kits   enable row level security;

drop policy if exists drive_assets_owner_all on public.drive_assets;
create policy drive_assets_owner_all on public.drive_assets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists brand_kits_owner_all on public.brand_kits;
create policy brand_kits_owner_all on public.brand_kits
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Tables created after the earlier GRANT need their own grants…
grant select, insert, update, delete on public.drive_assets, public.brand_kits to authenticated;
-- …and default privileges keep future tables covered automatically.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- Storage bucket for Drive files (private; RLS on storage.objects gates access).
insert into storage.buckets (id, name, public)
values ('drive', 'drive', false)
on conflict (id) do nothing;

-- Files live under "<user-id>/<folder>/<filename>" — each user only touches
-- their own prefix.
drop policy if exists drive_objects_select on storage.objects;
create policy drive_objects_select on storage.objects
  for select using (bucket_id = 'drive' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists drive_objects_insert on storage.objects;
create policy drive_objects_insert on storage.objects
  for insert with check (bucket_id = 'drive' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists drive_objects_update on storage.objects;
create policy drive_objects_update on storage.objects
  for update using (bucket_id = 'drive' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists drive_objects_delete on storage.objects;
create policy drive_objects_delete on storage.objects
  for delete using (bucket_id = 'drive' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- MILESTONE 1 — GARMENT LIBRARY (admin-managed shared catalog)
-- Consistent with PRD-001 (garment identity/payload) + PRD-002 (representations).
-- Everyone signed-in READS published garments; only admins WRITE.
-- ============================================================================

-- Taxonomy of garment kinds.
create table if not exists public.garment_categories (
  id    text primary key,
  label text not null,
  sort  integer not null default 0
);

insert into public.garment_categories (id, label, sort) values
  ('hoodie','Hoodie',1),('tee','T-Shirt',2),('sweatshirt','Sweatshirt',3),
  ('pants','Pants',4),('shorts','Shorts',5),('jacket','Jacket',6),
  ('bomber','Bomber',7),('blazer','Blazer',8),('cap','Cap / Hat',9),
  ('dress','Dress',10),('skirt','Skirt',11),('knitwear','Knitwear',12),
  ('accessory','Accessory',13),('other','Other',99)
on conflict (id) do nothing;

-- One row per uploaded archive (provenance of an import).
create table if not exists public.garment_packs (
  id            uuid primary key default gen_random_uuid(),
  uploaded_by   uuid references auth.users(id) on delete set null,
  name          text not null,
  source_name   text not null default '',
  file_count    integer not null default 0,
  garment_count integer not null default 0,
  status        text not null default 'imported' check (status in ('processing','imported','failed')),
  created_at    timestamptz not null default now()
);

-- The garment identity + catalog record (PRD-1 template payload, catalog-facing).
create table if not exists public.garment_templates (
  id          uuid primary key default gen_random_uuid(),
  pack_id     uuid references public.garment_packs(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  name        text not null,
  slug        text not null unique,
  category    text not null default 'other' references public.garment_categories(id),
  status      text not null default 'published' check (status in ('draft','published','archived')),
  vendor      text not null default '',
  tags        text[] not null default '{}',
  search_text text not null default '',
  thumb_path  text,
  views       jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Milestone 1.1: view metadata (added idempotently for existing installs).
alter table public.garment_templates add column if not exists views jsonb not null default '{}';

-- Shop pricing: coin price the admin sets per garment at upload (0 = not for sale / free).
alter table public.garment_templates add column if not exists price integer not null default 0;

-- Physical files of a garment (PRD-2 Principle B: representations).
create table if not exists public.garment_representations (
  id           uuid primary key default gen_random_uuid(),
  garment_id   uuid not null references public.garment_templates(id) on delete cascade,
  kind         text not null,   -- master | preview | thumbnail | source | export
  format       text not null,   -- ai | svg | png | pdf | dxf | jpg | ttf | ...
  storage_path text not null,
  bytes        bigint not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists garment_templates_category on public.garment_templates(category) where status = 'published';
create index if not exists garment_templates_search on public.garment_templates using gin (to_tsvector('simple', search_text));
create index if not exists garment_reps_garment on public.garment_representations(garment_id);

alter table public.garment_categories      enable row level security;
alter table public.garment_packs           enable row level security;
alter table public.garment_templates       enable row level security;
alter table public.garment_representations enable row level security;

grant select, insert, update, delete on
  public.garment_packs, public.garment_templates, public.garment_representations to authenticated;
grant select, insert, update, delete on public.garment_categories to authenticated;
grant select on public.garment_categories to anon;

-- Categories: read by anyone; admin writes.
drop policy if exists garment_categories_read on public.garment_categories;
create policy garment_categories_read on public.garment_categories for select using (true);
drop policy if exists garment_categories_admin on public.garment_categories;
create policy garment_categories_admin on public.garment_categories
  for all using (public.is_admin()) with check (public.is_admin());

-- Packs: admin only.
drop policy if exists garment_packs_admin on public.garment_packs;
create policy garment_packs_admin on public.garment_packs
  for all using (public.is_admin()) with check (public.is_admin());

-- Templates: authenticated read published (admins read all); admin writes.
drop policy if exists garment_templates_read on public.garment_templates;
create policy garment_templates_read on public.garment_templates
  for select using (status = 'published' or public.is_admin());
drop policy if exists garment_templates_admin on public.garment_templates;
create policy garment_templates_admin on public.garment_templates
  for all using (public.is_admin()) with check (public.is_admin());

-- Representations: readable when the parent garment is; admin writes.
drop policy if exists garment_reps_read on public.garment_representations;
create policy garment_reps_read on public.garment_representations
  for select using (
    exists (select 1 from public.garment_templates g
            where g.id = garment_id and (g.status = 'published' or public.is_admin())));
drop policy if exists garment_reps_admin on public.garment_representations;
create policy garment_reps_admin on public.garment_representations
  for all using (public.is_admin()) with check (public.is_admin());

-- Storage bucket for garment files (private; RLS on storage.objects gates access).
insert into storage.buckets (id, name, public) values ('garments','garments',false)
on conflict (id) do nothing;

drop policy if exists garment_objects_read on storage.objects;
create policy garment_objects_read on storage.objects
  for select using (bucket_id = 'garments' and auth.role() = 'authenticated');
drop policy if exists garment_objects_admin on storage.objects;
create policy garment_objects_admin on storage.objects
  for all using (bucket_id = 'garments' and public.is_admin())
  with check (bucket_id = 'garments' and public.is_admin());

-- ============================================================================
-- Make yourself an admin AFTER you have signed up once:
--   update public.profiles set role = 'admin' where email = 'you@brand.com';
-- ============================================================================
