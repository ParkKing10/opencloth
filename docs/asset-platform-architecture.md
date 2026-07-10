# THREADOS Asset Platform — Architecture (PRD 002)

> Status: **Design / approved-for-build spine.** Synthesized from a 6-lens design + adversarial red-team pass (all lenses returned NEEDS_WORK; every convergent flaw below is resolved here).
> Depends on **PRD 001 (Garment Engine), which is FROZEN.** This document references PRD-1's contracts; it never redesigns them. Any rule here that would force a PRD-1 change is called out explicitly — there is exactly one, and it is additive at the boundary.

---

## 0. The laws everything obeys

Three structural laws, plus one boundary law with the frozen Garment Engine.

```
   ┌──────────────────────────────────────────────────────────────┐
   │                     ASSET  (the identity)                     │
   │   uuid · type · name · workspace · visibility · status ·      │
   │   version pointer · tags · payload_ref  — governance only     │
   └───────▲───────────────────────▲──────────────────────▲───────┘
   owns    │ 1                      │ 1..n                  │ 1..n
   ┌───────┴────────┐   ┌───────────┴──────────┐  ┌─────────┴─────────┐
   │ TYPED PAYLOAD  │   │  REPRESENTATIONS      │  │  RELATIONS        │
   │ one per type,  │   │  physical formats of  │  │  asset → asset,   │
   │ a real table   │   │  the SAME identity    │  │  never a copy     │
   │ (never jsonb)  │   │  (svg/png/ai/dxf…)    │  │  (uses/contains)  │
   └───────┬────────┘   └───────────────────────┘  └───────────────────┘
           │ for type='garment'
           ▼
   ┌────────────────────────────────────────────────────────────────┐
   │  FROZEN PRD-1: garment_templates (id, version) — the GOM.       │
   │  Asset REFERENCES it. Asset never reaches into it, never renders.│
   └────────────────────────────────────────────────────────────────┘
```

- **Law 1 — Envelope is the only identity.** One universal `assets` row per logical asset. It owns identity, governance, discovery, lifecycle. It is *never* a data container.
- **Law 2 — Typed payload, always (Principle A).** Every asset references a **dedicated typed payload table** via `payload_ref = (payload_type, payload_id, payload_version)`. **There is no inline-JSON payload path — not even for "lightweight" types.** Colour Palette, Material Preset, Typography Preset each own a real table, exactly like Garment owns `garment_templates`. Adding a field to a type is a per-type migration; it never reshapes a shared blob or the envelope.
- **Law 3 — Files are Representations, not files (Principle B).** An uploaded or derived file is one **physical format of the same logical asset**. The Asset is the stable identity; representations are interchangeable encodings. Deriving PNG-from-SVG *adds a representation*; it never mutates identity or payload.
- **Law 4 — The boundary with PRD-1 is reference + reaction, never orchestration.** The Asset Platform *references* a frozen `garment_template` and *reacts* to its publication to register a Garment Asset. It does **not** classify, convert, decompose, queue, or render garments — that is PRD-1's frozen pipeline. (§5)

Why it matters: this is what lets THREADOS add a new asset type, a new file format, or a new marketplace feature **without a schema-wide migration or a single change to the Garment Engine.**

---

## 1. The Asset envelope + the type registry

The envelope is deliberately lean so listing millions of rows stays fast. Payload and representations load lazily via the resolver (§8).

```sql
create table public.assets (
  id              uuid primary key default gen_random_uuid(),
  type            text not null references public.asset_types(type_name),
  name            text not null,
  slug            text not null,
  owner_id        uuid not null references auth.users(id),
  workspace_id    uuid not null references public.workspaces(id),   -- personal workspace is a real row, never null
  category        text,
  subcategory     text,
  description      text not null default '',
  tags            text[] not null default '{}',
  visibility      text not null default 'private',   -- private | team | public | marketplace
  status          text not null default 'draft',     -- draft | published | archived  (soft state, §4)

  -- Principle A: the ONLY link to data. Always all three, always non-null.
  payload_type    text not null references public.asset_types(type_name),
  payload_id      uuid not null,
  payload_version int  not null,

  current_version_id uuid,                            -- → asset_versions.id (the published head)
  origin_asset_id    uuid references public.assets(id) on delete set null, -- fork lineage (duplicate ≠ version, §4)

  -- denormalized facets for fast filtering (kept in sync by trigger/subscriber, §8)
  thumbnail_rep_id uuid,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (workspace_id, type, slug)                   -- slug unique per (workspace, type); avoids team races
);

create index assets_owner       on public.assets (owner_id) where deleted_at is null;
create index assets_workspace   on public.assets (workspace_id, type, status) where deleted_at is null;
create index assets_discover    on public.assets (visibility, status) where deleted_at is null;
create index assets_payload     on public.assets (payload_type, payload_id, payload_version);
```

**The type registry is data, not an enum.** A new asset type is a row + a payload table — no code change, no redeploy.

```sql
create table public.asset_types (
  type_name             text primary key,           -- 'garment' | 'logo' | 'palette' | 'material_preset' | ...
  payload_table         text not null,              -- 'garment_templates' | 'palette_payloads' | ...
  payload_resolver      text not null,              -- DI key → an IPayloadResolver<T> impl (§1.1)
  allowed_reps          text[] not null default '{}',-- ['svg','png','dxf',...] this type may own
  validation_schema     jsonb,                       -- JSON Schema for the payload row (enforced via pg_jsonschema)
  is_searchable         boolean not null default true,
  is_ai_retrievable     boolean not null default true,
  is_marketplace_eligible boolean not null default false,
  default_renderer      text,                        -- 'svg'|'canvas'|'three'|'pdf'|null — a HINT for consumers, not owned here
  is_managed_by_prd1    boolean not null default false, -- true for 'garment': payload is written by PRD-1, read-only here
  created_at            timestamptz not null default now()
);
```

### 1.1 The payload resolver (referential integrity across a polymorphic edge)
Because `payload_id` points at *different tables per type*, integrity cannot be a plain FK. It is enforced two ways:

- **Write path:** inserts/updates to `assets` go through `resolve_and_validate_payload(type, id, version)` — a `SECURITY DEFINER` function that looks up `asset_types.payload_table`, confirms the row exists at that version, and validates it against `validation_schema`. No raw INSERT into `assets`.
- **Delete path:** every payload table carries an `ON DELETE` trigger that refuses deletion while an `assets` row references it (or, for versioned payloads, tombstones instead). Payload rows are **immutable once referenced by a published version** (§4) — this is what keeps a Garment Asset's frozen GOM from drifting.
- **Runtime:** a typed `IPayloadResolver<T>` per type, wired by dependency injection (a registry `Map<type, resolver>`), **never reflection**. Unknown type → explicit error, not a silent null.

```ts
interface IPayloadResolver<T> {
  resolve(payloadId: string, payloadVersion: number): Promise<T>   // pure read; no mutation
}
// GarmentPayloadResolver.resolve() loads garment_templates(id, version) → the PRD-1 GarmentModel, untouched.
```

---

## 2. Principle A in practice — typed payloads, always

Four payloads, showing the rule holds from the heaviest type to the most trivial.

```sql
-- GARMENT: the payload is the FROZEN PRD-1 template. PRD-2 owns NOTHING here; it references (id, version).
-- (garment_templates is defined and written by PRD-1. asset_types.is_managed_by_prd1 = true.)

-- COLOUR PALETTE — a "trivial" type still gets a real table (so adding a field is a local migration).
create table public.palette_payloads (
  id            uuid primary key default gen_random_uuid(),
  version       int  not null default 1,
  swatches      jsonb not null,          -- [{ ref, hex, name }]  — structured, validated by asset_types.validation_schema
  colour_space  text not null default 'srgb',  -- srgb | display-p3 | cmyk | pantone  (fixes cross-device colour drift)
  created_at    timestamptz not null default now(),
  unique (id, version)
);

create table public.material_preset_payloads (
  id           uuid primary key default gen_random_uuid(),
  version      int not null default 1,
  fabric       text not null,           -- 'french_terry_450gsm'
  weight_gsm   int,
  finish       text,
  composition  jsonb,                    -- [{ fiber, pct }]
  created_at   timestamptz not null default now(),
  unique (id, version)
);

create table public.typography_preset_payloads (
  id            uuid primary key default gen_random_uuid(),
  version       int not null default 1,
  font_asset_id uuid references public.assets(id),  -- references a Font ASSET, never embeds font bytes
  weight        int,
  line_height   numeric,
  letter_spacing numeric,
  created_at    timestamptz not null default now(),
  unique (id, version)
);
```

A **Brand Kit** payload obeys the same law by *referencing* other assets, never inlining their data:

```sql
create table public.brand_kit_payloads (
  id                uuid primary key default gen_random_uuid(),
  version           int not null default 1,
  palette_asset_id  uuid references public.assets(id),   -- a Palette asset
  typography_asset_id uuid references public.assets(id), -- a Typography asset
  logo_asset_id     uuid references public.assets(id),   -- a Logo asset
  packaging_asset_id uuid references public.assets(id),
  manufacturing_defaults jsonb,
  business_info     jsonb,
  unique (id, version)
);
```

> This directly retires the legacy `brand_kits` table (one inline row per user). Colours and fonts become Palette/Typography assets the kit *references* — no duplicated colour or font data anywhere in the system (§11).

---

## 3. Principle B in practice — representations

One asset, many physical formats. The Asset is identity; each representation is an encoding of one **asset version**.

```sql
create table public.asset_representations (
  id            uuid primary key default gen_random_uuid(),
  asset_id      uuid not null references public.assets(id) on delete cascade,
  version_id    uuid not null references public.asset_versions(id) on delete cascade, -- reps pin a version
  kind          text not null,   -- master | editor | preview | thumbnail | print | export
  format        text not null,   -- svg | png | ai | dxf | pdf | gltf | jpg | woff2 ...
  source        text not null,   -- uploaded | derived | converted | prd1_imported
  derived_from_id uuid references public.asset_representations(id), -- lineage (PNG ← SVG)
  content_hash  text not null,   -- sha256 of bytes — the dedup key
  storage_path  text not null,
  bytes         bigint,
  width         int,
  height        int,
  colour_profile text,
  is_current    boolean not null default true, -- false when a newer version supersedes it
  created_at    timestamptz not null default now()
);
create index reps_asset on public.asset_representations (asset_id, version_id, kind);
create unique index reps_dedup on public.asset_representations (content_hash, format); -- identical bytes stored once
```

Examples the model must express:
- **Logo Asset** → `{svg:editor, png:preview, png:thumbnail}`
- **Garment Asset** → `{ai:master(prd1_imported), svg:editor, png:preview, dxf:export}` — all produced by PRD-1's pipeline and registered as representations; PRD-2 **never re-renders** them (Law 4).

**Content-hash dedup:** before storing bytes, look up `(content_hash, format)`; if present, link instead of copying. Kills the "5 TB of duplicate files" cliff every lens flagged.

**Derivation is a durable job, not a synchronous call.** SVG→PNG, thumbnailing, and format exports run through a conversion queue with a real state machine — so a weekly-sale spike of 1k conversions can't stall uploads:

```sql
create table public.representation_jobs (
  id           uuid primary key default gen_random_uuid(),
  asset_id     uuid not null,
  source_rep_id uuid,
  target_kind  text not null,
  target_format text not null,
  priority     int  not null default 100,   -- paid tiers jump the queue
  status       text not null default 'queued', -- queued|converting|ready|failed|dead
  attempts     int  not null default 0,
  error        text,
  created_at   timestamptz not null default now()
);
```
Backed by **pg_boss** (same queue substrate as PRD-1) + dead-letter + reaper. On `ready`, it emits `RepresentationReady` (§9). **GC:** a nightly job hard-deletes representations that are `is_current=false` *and* orphaned > 30 days, freeing storage; deletions are logged for audit.

---

## 4. Versioning, relationships, collections

### 4.1 Immutable versions
```sql
create table public.asset_versions (
  id             uuid primary key default gen_random_uuid(),
  asset_id       uuid not null references public.assets(id) on delete cascade,
  version_num    int  not null,          -- allocated atomically, never max()+1
  payload_type   text not null,
  payload_id     uuid not null,
  payload_version int not null,           -- REQUIRED — never "latest"
  payload_state_hash text,                -- sha256 of the RESOLVED payload (e.g. GOM geometry) at pin time
  status         text not null default 'draft',  -- draft | published | tombstone
  change_summary text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  unique (asset_id, version_num)
);
```
- **Atomic allocation** of `version_num` via `GENERATED ALWAYS AS IDENTITY` per-asset sequence or an advisory-lock function — not `SELECT max()+1` (concurrent-publish race).
- **Publish** flips `assets.current_version_id` inside a `SELECT … FOR UPDATE` transaction with `RETURNING` — not a bare `UPDATE … WHERE EXISTS`.
- **Immutable per version.** Once a version is published, its payload row is locked (§1.1). This is the airtight version of the PRD-1 reconciliation: a Garment Asset version pins `(garment_templates.id, version)` **and** stores `payload_state_hash` = the GOM geometry hash, so drift is detectable, not silent.
- **Restore/duplicate/branch/compare** all operate on immutable versions. **Duplicate ≠ version:** a duplicate is a *new asset id* with `origin_asset_id` set (a fork); a version is a new `version_num` on the *same* id. `parent_id` ambiguity is removed.
- **Delete is a tombstone**, never a hard cascade — audit and restore survive.

### 4.2 Relationships (reference, never duplicate)
```sql
create table public.asset_relations (
  id             uuid primary key default gen_random_uuid(),
  from_asset_id  uuid not null references public.assets(id) on delete restrict, -- deleting a relation ≠ deleting an asset
  from_version_id uuid not null references public.asset_versions(id),
  to_asset_id    uuid not null references public.assets(id) on delete restrict,
  to_version_id  uuid not null references public.asset_versions(id),
  rel_type       text not null,           -- uses | contains | derived_from | references
  metadata       jsonb,                    -- e.g. {slot:'primary_logo'} — feeds faceted search
  created_at     timestamptz not null default now(),
  unique (from_asset_id, from_version_id, to_asset_id, to_version_id, rel_type)
);
create index rel_reverse on public.asset_relations (to_asset_id, rel_type) include (from_asset_id);
```
- Versions are **required and pinned** on both ends → a design's dependency graph is reproducible. `Garment → Brand Kit → {Palette, Typography, Logo} → Font` is all references; nothing is copied.
- `ON DELETE RESTRICT` (not cascade): you cannot silently delete an asset 10 others depend on.
- A **daily cycle-detection + broken-reference reaper** flags cycles and dangling pins (quarantine, alert) instead of letting traversal break at read time.
- **Reverse-dependency at scale** ("what uses Logo X") uses the covering index above; hot chains get a materialized `asset_relations_current` view refreshed on publish.

### 4.3 Collections = membership (folders without duplication)
A Collection *is* an asset (`type='collection'`). Membership is a join, so one asset lives in many collections with zero copies:
```sql
create table public.collection_members (
  collection_id uuid not null references public.assets(id) on delete cascade,
  asset_id      uuid not null references public.assets(id) on delete cascade,
  added_by      uuid references auth.users(id),
  added_at      timestamptz not null default now(),
  primary key (collection_id, asset_id)
);
```
RLS on `collection_members` enforces *who may add/remove* (collection owner, or an editor it's shared with). Keyset pagination (`asset_id > $cursor`), never OFFSET, for million-member collections. Retires the legacy `collections` table (§11).

---

## 5. The PRD-1 ↔ PRD-2 seam (the one genuinely new subsystem)

Every red-team lens flagged the same two things: (a) PRD-2 must **not** own garment import, and (b) the registration contract between the pipelines was undefined. This section is that contract.

### 5.1 Smart Import splits by whether PRD-1 owns the type
```
 Upload ──▶ classify (extension + content sniff + cost-gated vision on ambiguity)
              │
   ┌──────────┴───────────────────────────────┐
   │ NON-garment types (logo, palette, font…)  │   GARMENT source (.ai / vendor .zip)
   │ PRD-2 OWNS this fully:                     │   PRD-2 does NOT convert/decompose/queue.
   │  create Asset + typed payload +            │   It HANDS the file to PRD-1's FROZEN pipeline
   │  uploaded Representation, in one txn.       │   (Ingest→Convert→Decompose→Review→Publish).
   └────────────────────────────────────────────┘   PRD-2 waits for publication, then registers. ▼
```
This is the precise freeze correction: PRD-2's "front door" is real for native asset types; for garments it is a **hand-off + a reaction**, never orchestration of the container worker.

### 5.2 Registration: zero-touch to PRD-1
PRD-1 already ends its pipeline at a **Publish** step that writes a row to `garment_templates`. PRD-2 reacts to that write **without modifying PRD-1's code**:

- A **PRD-2-owned trigger** on `garment_templates` (a DB object PRD-2 adds, not a change to PRD-1's logic) fires on publish and does one cheap thing: **enqueue** a `pg_boss` registration job. It never does work inline, so it can never block or fail the import.
- A **PRD-2 registration worker** consumes the job and, in one transaction, creates/updates the Garment Asset with `payload_ref = ('garment', template_id, template_version)` and its representations (from PRD-1's outputs). Retries + dead-letter on failure.

```sql
create table public.asset_registration_jobs (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null,
  template_version int not null,
  import_job_id uuid,                       -- correlates to PRD-1's import_jobs (observability)
  state        text not null default 'pending', -- pending | registering | registered | failed | orphaned
  asset_id     uuid,
  attempts     int not null default 0,
  error        text,
  created_at   timestamptz not null default now(),
  unique (template_id, template_version)    -- idempotent: re-publish is a no-op
);
```
- **Orphan handling:** if a template is later removed, the job → `orphaned`, the Garment Asset is soft-archived (existing designs still resolve their pinned version), and an admin is alerted. No dangling `payload_id`.
- **The single, explicit, additive touchpoint:** PRD-2 depends on PRD-1 *publishing a row* (which it already does). It does **not** require any change to the GOM, the renderer, or the pipeline's internals. The trigger and queue live entirely on PRD-2's side of the boundary. If PRD-1 ever grows its own outbox, this trigger is swapped for an event subscription with no schema change here.

---

## 6. Permissions & workspaces (RLS that survives millions of rows)

Every workspace type — personal, team, company, marketplace, public — is a real `workspaces` row; **there is no null-workspace special case.** Membership and roles are explicit:
```sql
create table public.workspaces      ( id uuid primary key, kind text not null, owner_id uuid, ... );
create table public.workspace_members( workspace_id uuid, user_id uuid, role text, -- owner|admin|editor|viewer
                                       primary key (workspace_id, user_id) );
```

**The RLS scaling decision (the #1 cliff across all lenses):** never write `workspace_id IN (SELECT … FROM workspace_members WHERE user_id = auth.uid())` — that correlated subquery is O(n) and dies at ~500k assets. Instead:

1. **Workspace membership is baked into the JWT** as a custom claim (`workspace_ids uuid[]`), computed at login and on membership change. RLS becomes `assets.workspace_id = ANY(auth.jwt_workspace_ids())` — an index probe, not a scan.
2. **Public/marketplace browse bypasses RLS entirely** via an `assets_public` view (`WHERE visibility IN ('public','marketplace') AND status='published'`) with no row policy — so unauthenticated discovery is fast and never pays the membership check.
3. **Per-asset sharing** (ACL beyond workspace role) is an `asset_shares(asset_id, user_id, access_level)` table, also folded into the accessible-set the policy checks.
4. **Bulk operations** (10k edits/day) route through an `asset_bulk_actions` queue, not 10k individually-RLS'd UPDATEs.

---

## 7. Marketplace = discovery projection **+** stateful entitlements

The founder's law holds — **no separate asset database.** A listing is a thin projection over a published asset. But the red-team was unanimous on the correction: **licenses and entitlements are stateful contracts, not columns on `assets`,** because a purchased license must outlive the seller archiving the asset.

```sql
create table public.marketplace_listings (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references public.assets(id),
  seller_id   uuid not null,
  price       numeric, currency text, model text,  -- free | one_time | subscription | bundle
  license_type text not null,                       -- personal | commercial | extended
  rating      numeric, downloads int not null default 0,  -- denormalized metrics, updated by subscriber (§9)
  listed_at   timestamptz, archived_at timestamptz
);

create table public.asset_entitlements (             -- the buyer's durable right to use an asset
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  asset_id    uuid not null references public.assets(id),
  listing_id  uuid references public.marketplace_listings(id),
  grant_type  text not null,                          -- purchase | subscription | bundle | gift
  is_revoked  boolean not null default false,
  expires_at  timestamptz, usage_limit int, usage_count int not null default 0,
  granted_at  timestamptz not null default now()
);
```
- **Buying grants an entitlement, never a copy.** A buyer using a purchased garment resolves the *seller-owned* asset; RLS lets them read it because an active `asset_entitlements` row exists.
- **License validity is independent of asset status.** Seller archives Logo X → the buyer's existing designs still resolve it (their entitlement is live); only *new* uses by non-entitled users are blocked.
- **Revocation is a gate, not a delete** (`is_revoked = true`) — nothing is destroyed.
- Marketplace discovery is `marketplace_listings JOIN assets_public` — the "projection over Assets" the founder specified, with the stateful parts (entitlements, seller onboarding/Stripe Connect) as their own tables reserved for the marketplace PRD.

---

## 8. Search + the Resolver (the one door Studio & AI use)

**Search is layered, cost-aware, and lexical-first:**
- **Lexical + faceted is the default.** A `search_tsv` GENERATED column + GIN index; denormalized facet columns (`_garment_type`, `_season`, `_dominant_colour`, `_material`, `_price`) instead of JSONB filters, kept current by the publish subscriber.
- The correlated `MAX(version)` subquery (a search-latency cliff) is killed by an `assets_published_latest` materialized view (or an `is_latest` flag maintained on version increment).
- **Semantic vector search is secondary.** `asset_embeddings(asset_id, embedding vector, model, content_hash)` with a partial HNSW/IVFFlat index over **published** rows only. Embeddings are generated **async on publish** (not on every metadata edit), **batched, cached by content-hash, and budget-capped per workspace** — the fix for the "$5k/month embedding" trap. `"luxury oversized hoodie"` expands to facets + vector neighbours across types and (optionally) walks `asset_relations` to surface matching fabrics, labels, and packaging.

**The resolver is the sole consumption path** for both the Design Studio and the AI — they consume **Asset Objects, never raw files:**
```ts
resolveAsset(assetId, version?) : Promise<{
  envelope:  AssetEnvelope
  payload:   TypedPayload          // for 'garment': the untouched PRD-1 GarmentModel (via GarmentPayloadResolver)
  representations: Representation[] // each { kind, format, signedUrl }
  relations: ResolvedRelation[]    // version-pinned
}>
```
- Studio asks for the `editor/svg` representation; the tech pack asks for the `export/dxf` representation — **neither reaches for a "file".**
- For a garment, `payload` is the frozen GOM, handed straight to PRD-1's **unchanged** `SvgGarmentRenderer`. The Asset Platform adds zero rendering.
- A resolver **circuit-breaker** returns `payload_state='degraded'` with cached data rather than failing a whole design when one referenced asset (e.g. a supplier-backed Material) is slow.

---

## 9. The event system (durable outbox)

One transaction writes the asset change *and* its event — no dual-write, no lost events.

```sql
create table public.asset_events (
  id          bigint generated always as identity primary key,  -- ordering
  asset_id    uuid not null,
  event_type  text not null,   -- AssetCreated|Updated|Published|Archived|Deleted|VersionCreated|RepresentationAdded|RepresentationReady|Shared
  payload     jsonb not null,
  idempotency_key text unique, -- consumers dedupe
  created_at  timestamptz not null default now()
);
create table public.asset_event_cursors ( subscriber text primary key, last_event_id bigint not null default 0 );
```
- **Subscribers** poll `WHERE id > last_event_id ORDER BY id`, process in order, advance their cursor: **search indexer, embedding generator, representation deriver, marketplace projector (metrics + listing sync), AI cache, webhooks.**
- **At-least-once + idempotency keys** → safe reprocessing. **Dead-letter** table + reaper for poison events. New subscribers **replay** from cursor 0. Runs on the Supabase + pg_boss + one-worker reality — no Kafka required at this scale.

---

## 10. Data model at a glance

| Table | Role |
|---|---|
| `assets` | universal envelope / identity |
| `asset_types` | data-driven type registry (payload table, resolver, allowed reps, flags) |
| `asset_versions` | immutable version history + `payload_state_hash` |
| `asset_representations` | physical formats of an asset version (dedup by content hash) |
| `representation_jobs` | durable SVG→PNG/DXF/thumbnail conversion queue |
| `asset_relations` | version-pinned asset→asset graph (uses/contains/…) |
| `collection_members` | collection membership (folders without duplication) |
| `*_payloads` (`palette_`, `material_preset_`, `typography_preset_`, `brand_kit_`, …) | one typed payload table per type (Principle A) |
| `garment_templates` (PRD-1) | the Garment payload — **referenced, never owned** |
| `workspaces`, `workspace_members`, `asset_shares` | tenancy + permissions |
| `marketplace_listings`, `asset_entitlements` | discovery projection + stateful licenses |
| `asset_registration_jobs` | PRD-1→PRD-2 registration state machine |
| `asset_events`, `asset_event_cursors` | durable outbox + subscriber cursors |
| `asset_embeddings` | pgvector semantic index (published rows) |
| `upload_sessions` | chunked/resumable upload tracking |

**Storage buckets** (private, CDN-fronted, signed-URL delivery): `asset-representations/` (keyed by `asset_id`), `asset-previews/`, `asset-thumbnails/`. Garment source/geometry stay in PRD-1's buckets; PRD-2 references them as representations.

---

## 11. Migration from the existing schema (no data loss)

| Legacy | Becomes | How |
|---|---|---|
| `drive_assets` | an Asset + its uploaded Representation | ETL: infer `type` from MIME; put in owner's personal workspace; point a representation at the existing `storage_path` (no re-upload). |
| `brand_kits` (inline colours/fonts, 1/user) | a **Brand Kit asset** + `brand_kit_payloads` **referencing** Palette/Typography/Logo assets | Split colours → `palette_payloads`, fonts → `typography_preset_payloads`; wire the kit to reference them. No inline colour/font data remains. |
| `collections` | a **Collection asset** + `collection_members` | Rows → membership joins; delete legacy table after dual-read window. |
| `designs`, `orders`, `manufacturers`, `tech_packs` | **stay as-is** | Operational records, not reusable assets. `designs` continues to hold `GarmentState` (per PRD-1); it *references* assets, it is not one. |

Migrations run one-time with a **dual-read** window; legacy tables go read-only, then are dropped after two releases.

---

## 12. Scale & ops — the cliffs and their mitigations

| Cliff (from red-team) | First hit | Mitigation (built in above) |
|---|---|---|
| RLS correlated subquery | ~500k assets | JWT workspace claims + `assets_public` view (§6) |
| Representation storage blowup | ~5M assets | content-hash dedup + lineage + GC (§3) |
| `MAX(version)` search subquery | ~1M assets | `assets_published_latest` MV / `is_latest` flag (§8) |
| Embedding cost / index churn | ~1M assets, daily edits | publish-time async, batched, cached, budget-capped; lexical-first (§8) |
| License logic conflated with versioning | first marketplace sale | entitlements as their own stateful tables (§7) |
| Version-number race | concurrent publishes | atomic IDENTITY/advisory-lock allocation (§4.1) |
| Reverse-dependency scans | ~100M relations | covering index + `asset_relations_current` MV (§4.2) |
| Beyond ~100M assets | year 8–10 | external vector DB + sharding — *planned, out of scope now* |

---

## 13. Phased roadmap

| Phase | Ships | New infra |
|---|---|---|
| **0 — Envelope + registry** | `assets`, `asset_types`, resolver, one non-garment type end-to-end (Logo: upload → payload → representations → resolve) | none (Supabase) |
| **1 — Representations + versioning** | `asset_representations` + dedup + conversion queue + `asset_versions` (immutable, atomic) | reuses PRD-1 pg_boss + worker |
| **2 — PRD-1 seam** | registration trigger + worker + state machine → Garment Assets appear automatically on publish | none (PRD-2-owned trigger) |
| **3 — Workspaces + permissions** | `workspaces`, `workspace_members`, JWT-claim RLS, sharing, `assets_public` | none |
| **4 — Search + resolver + events** | lexical/faceted search, `resolveAsset` as the sole door, durable outbox + subscribers | none |
| **5 — Semantic search** | `asset_embeddings`, budget-capped publish-time embedding, vector-secondary retrieval | none |
| **6 — Marketplace** | `marketplace_listings` + `asset_entitlements` + revocation-as-gate; seller onboarding deferred to its own PRD | none |
| **7 — Migration + retire legacy** | `drive_assets`/`brand_kits`/`collections` ETL, dual-read, drop | none |

The three laws (§0) are what make every later phase additive: a new type is a registry row, a new format is a representation, a new marketplace feature is a table that references assets — and none of it ever touches the frozen Garment Engine.
