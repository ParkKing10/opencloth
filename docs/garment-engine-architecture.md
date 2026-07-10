# THREADOS Garment Engine — Architecture (Part 1)

> Status: **Design / approved-for-build spine**. Synthesized from a 6-lens design + adversarial red-team pass and the founding architectural law below.

---

## 0. The one law everything obeys

**The Garment Object Model (GOM) knows nothing about rendering.** It is pure, semantic, geometry-as-data. SVG, Canvas, WebGL/Three, PDF and Native are *rendering backends* that read the model — they are never inside it.

```
        ┌──────────────────────────────────────────────────────────┐
        │             GARMENT OBJECT MODEL  (the scene graph)        │
        │  parts · topology · materials · colours · measurements ·   │
        │  printable zones · seams — expressed in CM, as pure DATA   │
        │        ✗ no SVG  ✗ no DOM  ✗ no path strings               │
        └───────▲───────────────────▲───────────────────▲───────────┘
     reads      │        reads       │        reads       │
   ┌────────────┴───┐   ┌────────────┴──┐   ┌─────────────┴───────────┐
   │ RENDERING       │   │ EXPORT /       │   │ IMPORT PIPELINE writes  │
   │ ENGINES         │   │ MANUFACTURING  │   │ INTO the model.         │
   │ Svg·Canvas·3D·  │   │ (tech pack/BOM)│   │ SVG is only an internal │
   │ Pdf·Native      │   │ = a consumer   │   │ processing intermediate │
   └─────────────────┘   └────────────────┘   └─────────────────────────┘
```

Why it matters: this is the difference between "a picture of a garment" and "a garment." It lets us add a WebGL 3D preview or a native mobile renderer later **without touching the model, the import engine, or the tech-pack generator.** It also kills the single worst flaw the red-team found (below).

---

## 1. The Garment Object Model (render-agnostic core)

Geometry is stored as **neutral contours in centimetres**, never as markup. A part is a *role* + *geometry* + *bindings*, not an SVG node.

```ts
type GarmentModel = {
  id: string
  category: GarmentCategory          // 'hoodie' | 'blazer' | 'cargo_pants' | ...
  version: number                    // immutable; designs pin a version
  units: 'cm'
  parts: GarmentPart[]               // the semantic graph
  colorways: Colorway[]              // named default palettes
  measurements: MeasureAnchor[]      // graded points, in cm
  sizeGrades: SizeGrade[]
  meta: { vendor: string; packId: string; sourceHash: string }
}

type GarmentPart = {
  id: string
  role: PartRole                     // canonical taxonomy, e.g. 'left_sleeve'
  parentId?: string                  // topology: part-of (Body → Front → Pocket)
  mirrorOf?: string                  // 'right_sleeve' mirrors 'left_sleeve'
  geometry: NeutralGeometry          // contours + bbox, in CM — NOT an SVG string
  zIndex: number
  colorRef: string                   // → a Colorway slot
  materialRef: string                // → a Material
  printableZones: Polygon[]          // in the part's own normalized space
  seams: Edge[]
  confidence: number                 // decomposition certainty (0..1)
}

type NeutralGeometry = {
  contours: Contour[]                // closed/open paths of points + optional bézier handles
  bboxCm: { x: number; y: number; w: number; h: number }
}
type Contour = { points: { x: number; y: number; cIn?: Vec2; cOut?: Vec2 }[]; closed: boolean }
```

**Design instance vs. template.** The template (`GarmentModel`) is immutable and shared. A design carries a **`GarmentState`** — the per-part overrides + placed print objects. "Change the sleeve colour" mutates `state`, never the model.

```ts
type GarmentState = {
  templateId: string; templateVersion: number
  partOverrides: Record<string /*partId*/, { color?: string; material?: string }>
  placedObjects: CanvasObject[]      // the EXISTING studio object model, unchanged
}
```

> This is the exact fix for the red-team's most severe finding — *"part-region mapping uses SVG path IDs which break every time Illustrator regenerates IDs."* We never reference SVG IDs. Parts are geometry + role; any renderer re-derives its own draw calls.

---

## 2. The rendering boundary (pluggable adapters)

Renderers are the **only** layer that speaks a presentation format. One interface, many backends.

```ts
interface GarmentRenderer<Output> {
  render(model: GarmentModel, state: GarmentState, opts: RenderOpts): Output
}
class SvgGarmentRenderer   implements GarmentRenderer<SVGSVGElement>      // studio today
class CanvasGarmentRenderer implements GarmentRenderer<HTMLCanvasElement> // perf / mobile
class ThreeGarmentRenderer  implements GarmentRenderer<THREE.Object3D>    // future 3D
class PdfGarmentRenderer    implements GarmentRenderer<PdfDrawOps>        // tech-pack flats
```

- The **studio** uses `SvgGarmentRenderer` (or `CanvasGarmentRenderer` on mobile / huge templates). Part edits re-render only the touched part.
- The **tech pack** stops hand-drawing flats: `PdfGarmentRenderer` draws them from the same model → front/back/side/detail are always in sync with the design.
- Renderers may keep a **derived cache** (e.g. a pre-built SVG string for fast first paint). The cache is regenerable and owned by the renderer — the model never depends on it.

---

## 3. The import pipeline (Ingest → Convert → Decompose → Review → Publish)

```
 ZIP upload ──▶ [Ingest] ──▶ [Convert] ──▶ [Decompose] ──▶ [Review] ──▶ [Publish]
 Supabase       parse zip     .ai → SVG      artwork →       admin        library
 Storage        pair ai/png   (intermediate) part roles      correction   (versioned)
                content hash   → NEUTRAL      + confidence    → trains dict + CDN
                → 1 job/garment  GEOMETRY     + AI vision      (low-conf)
```

### 3.1 The infrastructure decision (the one true new piece)
Turning `.ai` (a PDF wrapper) into part-separated geometry needs **native binaries** (Ghostscript / pdf2svg / Inkscape). This **cannot** run in the static frontend or a Deno Edge Function (CPU/time limits, no native execs). Every red-team lens agreed.

**Decision:** introduce THREADOS's first **processing backend** — a small **container worker service** (Render Background Worker / Fly.io / a container on any host) with Ghostscript + Inkscape baked into the image. Everything else stays on Supabase.

- **MVP shortcut (Phase 0):** accept **pre-converted SVG/geometry packs** and/or route `.ai` through a **cloud conversion API (CloudConvert)** — ship the whole engine end-to-end with *zero* new infra, then swap in the owned worker for cost/control.

### 3.2 The queue (durable, not a naive poller)
- Jobs live in Postgres via **`pg_boss`** (or `LISTEN/NOTIFY`) — a real queue with retries, backoff, and a **dead-letter table**. Do **not** block an Edge Function on the worker's HTTP response.
- A **stuck-job reaper** times out jobs in `processing` > N min and requeues (workers crash).
- **Idempotency:** dedup on the **source `.ai` content hash + converter version** (not the output SVG — Ghostscript upgrades change output bytes). Re-import of an identical file is a no-op; a corrected/updated file makes a **new version**.

### 3.3 Job state machine
`queued → converting → decomposing → needs_review → published` (+ `failed` with `attempts`, `dead`).

---

## 4. Semantic decomposition (artwork → part roles)

Real vendor packs have layers named `Group3`, `Shape_15`, or localized text — **name matching alone caps at ~60–70%.** So a layered, confidence-gated strategy that *gets smarter with volume*:

1. **Name dictionary** (highest trust when it hits): synonym map `arm|sleeve_l|left arm → left_sleeve`, **scoped per vendor/pack** (a pack's own convention is consistent even when weird).
2. **Geometric heuristics**: bbox position, symmetry (mirrored pairs = sleeves), z-order, area — resolves many unnamed parts.
3. **AI vision** — **cost-gated**: render only the *low-confidence* parts as crops and ask a vision model to classify against the category's taxonomy. Batched, **budget-capped per import**, cached, and deferrable to async. (Naive per-part vision on thousands of templates is the cost trap the red-team flagged — we only spend it where 1+2 are unsure.)
4. **Human-in-the-loop that trains the system**: parts below a confidence threshold route to the admin **review canvas**; each correction writes to a **learning dictionary** keyed by vendor → the *next* pack from that vendor auto-labels better.

Confidence gates: `≥0.85` auto-approve · `0.65–0.85` provisional (flagged in studio) · `<0.65` mandatory review. Output = `GarmentPart[]` with `role`, `geometry`, `confidence` — **all render-agnostic.**

Each **`GarmentCategory`** owns a **frozen canonical taxonomy** (`HOODIE_PARTS`, `BLAZER_PARTS`, …). Import rejects/queues anything that can't map to a known role, so the library never drifts.

---

## 5. Data model (Supabase Postgres + Storage)

Tables (RLS: admin-write, authenticated-read *published* rows). Geometry lives in Storage as JSON blobs; Postgres holds the semantic index.

| Table | Purpose |
|---|---|
| `garment_packs` | one per uploaded ZIP · `(vendor, name, version)` natural key · `source_hash`, `status` |
| `import_jobs` | one per discovered garment · state machine · `attempts`, `worker_id`, `dead_letter` |
| `garment_templates` | published, **versioned** garment · `category`, `search_tsv`, `thumb_path`, `geometry_path` (Storage) |
| `garment_parts` | one per part · `role`, `confidence`, `bbox`, `default_color`, `default_material`, `printable_zones`, `measurement_anchors` (all geometry, no SVG IDs) |
| `part_label_dictionary` | learning map `(vendor, raw_name) → role` with hit counts — the loop that improves accuracy |
| `garment_categories` | frozen taxonomy per kind |

**Storage buckets** (private, CDN-fronted): `garment-source/` (raw `.ai`, never public), `garment-geometry/` (neutral JSON — the model payload), `garment-render-cache/` (optional per-renderer SVG cache), `garment-thumbs/` (previews).

**Versioning law:** templates are **immutable per version**. A design pins `(templateId, version)`, so re-importing a corrected pack **never breaks live designs** — new designs pick up the new version.

---

## 6. How it plugs into what exists (no fork)

- **Studio canvas:** the flat PNG/glyph backdrop is replaced by `SvgGarmentRenderer.render(model, state)`. Placed art keeps using the **existing `CanvasObject`/`Layer` model** — a template just adds a *garment layer group* beneath the print objects. Selecting a part opens a part inspector (colour/material) that writes to `state.partOverrides`.
- **Export / ManufacturingProject:** `buildManufacturingProject(input, template, state)` reads materials/colours **from the model** and measurements **from `part.measurement_anchors`** (replacing today's hardcoded `BASE_MEASURE`). Tech-pack flats come from `PdfGarmentRenderer`. One source of truth → Canvas, Preview, Tech Pack, BOM, Manufacturing Package all move together.

---

## 7. Scale & ops (red-team-hardened)

- **Perf:** ship a **decimated** geometry (studio) + full-detail (export); render huge templates via `CanvasGarmentRenderer`; pre-rendered thumbnails for the picker (never load full geometry to browse).
- **Cost:** owned worker ~fixed monthly vs. per-file API; vision spend gated to low-confidence only, budget-capped, cached.
- **Dedup:** hash the **source** + converter version; GC unreferenced geometry.
- **Isolation:** buckets keyed by `pack_id`; RLS scopes admin writes; published templates readable by all authenticated users.
- **Recovery:** dead-letter table + reaper + per-job retry; a failed garment never blocks its pack.

---

## 8. Phased roadmap

| Phase | Ships | New infra |
|---|---|---|
| **0 — MVP** | Upload ZIP → pre-converted SVG *or* CloudConvert → name+geometry decomposition → admin review → publish → **static** template on canvas | none (Supabase only) |
| **1 — Owned conversion** | Container worker (Ghostscript/Inkscape) + `pg_boss` queue + dead-letter/reaper | 1 worker service |
| **2 — Intelligence** | AI-vision decomposition (cost-gated) + learning dictionary + confidence UI | none |
| **3 — Full editability** | Per-part colour/material in studio → flows to ManufacturingProject; `PdfGarmentRenderer` tech-pack flats | none |
| **4 — New renderers** | `CanvasGarmentRenderer` (mobile/perf), then `ThreeGarmentRenderer` (3D preview) — **model untouched** | none |

The layering law is what makes Phase 4 a drop-in instead of a rewrite.
