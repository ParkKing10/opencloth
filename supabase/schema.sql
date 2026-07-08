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
-- role/status to their previous values for non-admins (admins bypass it).
create or replace function public.profiles_guard()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
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
-- Make yourself an admin AFTER you have signed up once:
--   update public.profiles set role = 'admin' where email = 'you@brand.com';
-- ============================================================================
