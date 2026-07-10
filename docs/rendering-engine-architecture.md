# THREADOS Visual Rendering Engine — Architecture (PRD 005)

> Status: **Design / approved-for-build spine.** Synthesized from a 6-lens design + adversarial red-team pass in which each lens argued competing architectures. The lenses converged on one central correction (below) that makes the engine *more* freeze-honest than a naive shared scene graph.
> Depends on **PRD 001 / 002 / 003 / 004, all FROZEN.** The Rendering Engine is **pure visualization** — it consumes the frozen contracts and owns nothing.

---

## 0. The laws everything obeys

- **Law 1 — Pure visualization.** The renderer owns **no** business logic, garment data, asset data, runtime state, viewport state, or command execution. It **reads** `(model, state, opts)` and produces pixels/vectors. It is **never a source of truth**.
- **Law 2 — The frozen signature is untouchable.** Every backend implements PRD-1's `GarmentRenderer<Output> { render(model: GarmentModel, state: GarmentState, opts: RenderOpts): Output }`. Viewport rides **inside `opts`** (`opts.viewport`) — no side-channel, no new parameter.
- **Law 3 — Overrides applied at draw, never baked.** Effective values are resolved from `state.partOverrides ⊕ model` at draw time. No node ever stores a resolved override; transforms stay **semantic** (translate/rotate/scale as data), never baked into contours.
- **Law 4 — Everything the renderer computes is a query.** Hit-tests, snap positions, and bounding boxes are **returned** to the interaction layer, which emits a **PRD-4 Command**. The renderer never mutates.
- **Law 5 — Hits resolve to GOM, never to SVG.** Every hit/selection resolves to a **GOM part role or CanvasObject id** — never an SVG/DOM/WebGL id. (This is PRD-1's founding law, enforced in the renderer.)
- **Law 6 — Deterministic, stateless, replaceable.** Same `(model, state, opts)` ⇒ same output on any device. Swapping SVG→WebGL→PDF requires **zero** change to PRD 1–4.

---

## 1. The core architecture (and the correction the red-team forced)

Every lens attacked the same naive idea: **a single shared, retained scene graph that backends consume**. The red-team showed it silently (a) changes the effective contract to `render(tree, opts)`, (b) becomes a **stateful source of truth** (dirty sets, caches), and (c) leaks backend details (`_nativeId`, FBOs) into the "neutral" layer. The resolution — and the spine of this engine:

```
   (model, state, opts)                          ← the FROZEN inputs, per backend
        │
        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  SCENE COMPILER  — SHARED · PURE · STATELESS                   │
   │  resolve refs (resolveAsset) → apply overrides at draw →       │
   │  resolve materials/colours → normalize geometry → ⇒ SCENE      │
   │  (ephemeral · backend-neutral · owns NO state/caches/hints)    │
   └───────────────┬───────────────────────────────┬──────────────┘
        consumed by │                                │ consumed by
   ┌────────────────▼────────────┐      ┌────────────▼──────────────┐
   │ SvgBackend / CanvasBackend / │      │ PdfBackend / PngBackend /  │
   │ WebGLBackend / ThreeBackend  │ ...  │ ThumbnailBackend / Native  │
   │ own PRIVATE retained tree +  │      │ own PRIVATE retained tree +│
   │ cache · dirty-tracked LOCALLY│      │ cache                      │
   └──────────────────────────────┘      └────────────────────────────┘
```

- **The public contract stays `render(model, state, opts)` per backend.** Internally each backend runs the shared **Scene Compiler**, then rasterizes.
- **The Scene Compiler is a pure function** `(model, state, opts) → Scene`. The `Scene` is **ephemeral, backend-neutral, and holds no dirty state, no caches, no backend hints**. It exists only for the duration of a render (or is structurally shared across renders). This gives determinism + DRY **without** being a source of truth.
- **Dirty tracking and caching live inside each backend** (SVG caches DOM nodes, Canvas caches draw ops, WebGL caches GPU buffers), driven by PRD-3's `RendererUpdated` patch as an **optimization hint** — `render(model, state, opts)` must always be correct *without* a patch (so a headless PDF/Native backend that ignores patches still works).

**Competing models weighed.** *(A) one retained neutral scene graph + thin backends* (Figma-like) vs *(B) stateless compiler + per-backend private retained structures*. (A) tends to make the shared graph the de-facto contract and a home for dirty state; (B) keeps the neutral layer pure and pushes retained/mutable concerns into swappable backends. **Chosen: (B)** — it is the only one that satisfies Laws 1, 2, and 6 simultaneously.

---

## 2. The backend-neutral Scene (the IR)

```ts
interface Scene {
  root: SceneGroup
  // resolution index — semantic back-refs, NEVER backend ids
  refOf: Map<NodeId, { kind: 'part' | 'object'; partRole?: string; canvasObjectId?: string }>
  bounds: Rect                 // design-space (cm) content bounds, for export fit
}
type NodeId = string           // OPAQUE (uuid/index) — never used as a DOM/SVG id
interface SceneNode {
  id: NodeId
  transform: { tx: number; ty: number; sx: number; sy: number; rot: number }  // SEMANTIC, not baked
  geometry: NormalizedContours // in cm, UNTRANSFORMED
  material?: MaterialRef; text?: TextRef; image?: ImageRef  // semantic refs, resolved lazily
  opacity: number; blendMode: BlendMode; clip?: NormalizedContours
  // NO resolved colour, NO rasters, NO _nativeId, NO dirty flags — those live in backends
}
```

- **Opaque node ids + a `refOf` map.** A backend that needs a DOM id generates its own; the semantic identity (`partRole`/`canvasObjectId`) is looked up via `refOf`. Semantic prefixes never leak into markup (Law 5).
- **Untransformed geometry + a semantic transform** keeps AABBs, hit-testing, and snapping correct on rotated/scaled objects (a rotation baked into contours corrupts all three).
- **No overrides, no rasters, no caches in the Scene.** Effective colour/material is resolved at draw; rasterized artifacts and dirty state live in the backend (§3).

---

## 3. Incremental rendering & performance

- **Patch-driven, per-backend dirty update.** `RendererUpdated{ changedPartRoles, changedObjectIds }` (PRD-3) → each backend updates only its affected cached nodes. The patch is a *hint*: a full `render(model, state, opts)` is always correct.
- **Cache geometry + base material only; apply colour non-destructively at draw** (SVG `fill` attr / Canvas tint pass / WebGL uniform). This kills the red-team's worst memory cliff — a per-`(geometry×colour×material)` raster cache is 20 parts × 10 colours × 5 materials ≈ **20 GB VRAM** and thrashes on every colour edit/undo. Colour is a draw-time parameter, not a cache key.
- **Virtualized rendering.** Viewport culling builds/draws only nodes intersecting the visible region + margin. **LOD** uses PRD-1's frozen decimated-studio geometry vs full-detail export.
- **GPU + off-main-thread.** WebGL/WebGPU backend for heavy scenes and mobile; OffscreenCanvas + Web Worker render loop; object pooling + typed arrays; draw-call batching + texture atlasing.
- **Pan/zoom never rebuilds the Scene** — it is a viewport transform applied at draw (CSS/GPU transform where possible).

**First cliff per backend** (design targets 60 FPS):

| Backend | Cliff | Mitigation |
|---|---|---|
| SVG (DOM) | ~2–3k live nodes (DOM-node cost) | best for export/crisp vector, not heavy live scenes; switch to Canvas/WebGL |
| Canvas 2D | full-frame redraw cost at ~4K canvas × thousands of ops | batch draw ops; per-layer OffscreenCanvas; **skip manual dirty-regions** (no native API — batching wins) |
| WebGL | VRAM / draw-call sort at ~10–20k objects desktop, ~5k mobile | GPU batching by texture/blend; LRU texture budget = `deviceMemory`-scaled |
| Mobile | ~800–2k nodes | GPU picking + culling; fallback to quadtree picking under low VRAM |

---

## 4. Hit testing & selection

- **Spatial index** (R-tree/quadtree) over scene-node **world-space** bounds, **incrementally updated** from the patch (`O(Δ·log n)`), viewport-culled — never a per-frame `O(n log n)` rebuild.
- **Invert the viewport transform first:** `screen → design` coords, then query in design space (fixes click-misses-after-zoom).
- **Two picking strategies, chosen per backend** (red-team correction — GPU picking should be primary, not optional):
  - **GPU colour-id picking** primary for **Canvas/WebGL** — `O(1)`, and it handles alpha/blend-mode transparency correctly.
  - **Geometric spatial-index picking** primary for **SVG/PDF** and as the **low-VRAM fallback** (auto-detected).
- **Resolves to GOM refs only** (`{kind, partRole?, canvasObjectId?}` via `refOf`) — never a backend id (Law 5). Precise point-in-contour for complex embroidery/seam regions, not just AABB.
- **Selection/handles/transform-controls are an overlay layer** with its **own** small index, checked **first** (so you grab a handle, not the object under it). Marquee range-queries run async in a Worker for large scenes.

---

## 5. The viewport subsystem (owns no state)

A **pure projection** from runtime-owned viewport state (arriving in `opts.viewport`):

```ts
interface ViewportRenderer {
  project(v: ViewportState): { matrix: Mat3; visibleRegion: Rect; cull(node: SceneNode): boolean }
  // clipping, safe-areas, bleed, margins, guides are OVERLAY geometry computed here
}
```

- **Consumes, never owns** zoom/pan/camera (PRD-3). Zoom bounds live in this contract, not hardcoded in the canvas component — so every backend obeys the same bounds.
- **Safe-area/bleed/print-zone carry an explicit `cullMode: 'studio' | 'export'`** — a visual hint in the studio vs a hard boundary in export — resolving the "is it a hint or a cull?" ambiguity.
- **Export viewport is explicit** (fit-to-content-bounds), **never** the live editor's zoom/pan — otherwise export silently diverges from preview.

---

## 6. Snapping (pure, world-space, zoom-invariant)

The single most important snapping correction: **snapping is zoom-invariant and lives in world space (cm)** — the same drag snaps identically at any zoom, preserving determinism and offline replay.

```ts
interface SnapService {
  query(candidate: Vec2Cm, cfg: SnapConfig): {
    delta: Vec2Cm                 // semantic snapped offset (cm), NOT pixels
    guides: GuideGeometry[]       // ALL candidate guides in world space
  }
}
```

- **Pure query, never mutation.** The interaction layer reads the result and emits a **PRD-4 `MoveCommand`** on commit. Guides are ephemeral overlays, never a Scene mutation, never persisted, never in undo history.
- **Zoom affects only which guides are *drawn*** (the overlay layer culls minor grid lines by zoom) — not the snap math. Snap distance is a constant in cm.
- **2D nearest-snap in L2 space** with a **data-driven priority** (`symmetry > alignment > margin > part_edge > object_edge > grid`), defined as a single geometric predicate so it is **commutative** (drag-left-then-up ≡ up-then-left), not path-dependent axis-by-axis.
- **Rebuilds on the `RendererUpdated` patch, not on zoom**, and **shares the hit-test spatial index** (one invalidation contract). Snap targets computed from **untransformed geometry + transform matrix**, so rotated objects snap correctly.
- The snap engine **owns no viewport state and no rendering decisions** — it returns all candidate guides; the overlay layer picks styling/opacity/which to show.

---

## 7. Material, text & image realization

Semantic params are **data** (GOM / PRD-2 payloads); each backend **realizes** the same params. The Scene carries semantic refs; realized artifacts (textures, glyph atlases, decoded bitmaps) live in **backend/resolver caches**, never in the ephemeral Scene.

### 7.1 Materials
- Visual params (weave, sheen/roughness, base-texture representation ref, `colour_space`) live in PRD-2 `material_preset_payloads`/GOM. Backends realize them: **SVG** `<pattern>`/filter, **Canvas** `CanvasPattern`, **WebGL** procedural PBR-ish shaders (plain/twill/jersey/corduroy) for cotton/french-terry/mesh/leather/denim/canvas/corduroy/wool.
- **Live viewport uses WebGL procedural** for instant feedback on material edits. **Export determinism uses version-pinned, pre-rasterized material textures** (stored as PRD-2 representations) — *not* raw GPU shader output, because shaders vary across drivers. This split gives real-time feel **and** reproducible export.
- Texture fetched via `resolveAsset(materialRef).representations[]` at the requested LOD (preview for canvas, hi-res for export).

### 7.2 Text
- **Shape with HarfBuzz-WASM → glyph contours** (chosen over DOM `<text>`, which varies across browsers and breaks path-text/OpenType). Same contours feed every backend; **PDF/export converts glyphs→curves** for pixel-perfect reproducibility.
- Kerning/tracking/alignment/curved-path-text/OpenType/variable-fonts are **semantic params** in GOM/state. Fonts are **pinned via the PRD-2 asset envelope + version** (do not build a parallel pinned-font system) — the envelope identity includes the shaping/subset params.
- **Shape off-thread** and cache shaped runs by `(fontId, version, content, features)`; glyph atlases live in the backend and rebuild on context-loss (cache the `Path2D` contours, not the rasterized atlas).

### 7.3 Images
- Sourced via `resolveAsset().representations[]` at a LOD (preview for canvas, hi-res for export). **Decode off-thread** (`createImageBitmap({ colorSpaceConversion: 'none' })` in a Worker), LOD-aware (preview renders now, hi-res swaps in), cached by `(assetId, version, lod)`.
- Transparency, masks, clipping, and a **blend-mode mapping table** (`css / canvas globalCompositeOperation / WebGL glBlendFunc / svg mix-blend-mode / pdf BM`) validated per backend for parity. Colour space is explicit in the payload and converted at render/export.

---

## 8. Export rendering & the determinism guarantee

**Export = the same Scene, a different rasterizer.** SVG/PNG/PDF/marketplace-preview/thumbnail/factory-preview/3D backends consume the identical `Scene` the live editor compiled.

**"Exports always match the live editor" is guaranteed by:**
- **Fonts** pinned via PRD-2 `resolveAsset(id, version)` envelope (shaping is deterministic); glyphs→curves in PDF.
- **Colours** stored as **palette indices** (PRD-2), mapped through the **target colour profile** at the backend (sRGB / Display-P3 / **CMYK for factory**), with the **ICC profile embedded** in the export (PDF ICC, PNG metadata) so round-trips are device-independent.
- **Materials** rendered from **version-pinned pre-rasterized textures** (§7.1), immune to GPU variance.
- **Explicit export viewport** (fit-to-bounds), never live zoom/pan; fixed rasterization params (DPI, AA).
- **Verified by a visual oracle**, not naive byte-compare: render across backends, rasterize, pixel-compare within a stated tolerance (≈±2px RMS per 1000px) — a CI gate.

**Operational reality:**
- Exports run **off-thread** (Web Worker / OffscreenCanvas) so they never block editing — but **all asset resolution happens on the main thread** (`resolveAsset` needs Supabase; Workers can't reach it); fully-resolved data (blobs/JSON) is transferred into the Worker for rasterization only.
- **`PdfGarmentRenderer` draws tech-pack flats as vectors** (PRD-1) — only *images* rasterize, keeping geometry crisp and files small.
- **Export outputs ARE PRD-2 representations.** The renderer hands PNG/preview/thumbnail/factory outputs back to the Asset Platform to be **stored as representations** (PRD-2 §3) — it does not fork export storage.

---

## 9. Debug tooling (development only)

Behind a `__DEV__` flag (tree-shaken from production): Scene inspector, per-backend render-tree/DOM/GPU-buffer inspector, FPS monitor, dirty-region visualizer, hit-test visualizer, memory usage, GPU timing, render timing. The inspector reads the **active backend's** real structures — there is no reified "neutral scene graph" persisted for debugging (that would re-introduce a stateful shared graph).

---

## 10. Scale cliffs & mitigations (red-team-hardened)

| Cliff | First hit | Mitigation |
|---|---|---|
| Per-combo raster cache (colour edits) | frequent colour/undo | cache geometry+base-material only; colour at draw (§3) |
| Spatial-index rebuild per frame | ~3k+ nodes | incremental `O(Δ·log n)` update from patch (§4) |
| GPU picking texture VRAM | low-end mobile | vRAM detection → quadtree fallback (§4) |
| Glyph atlas unbounded | 1000+ unique glyphs | 4K atlas shards + LRU; cache contours not atlas (§7.2) |
| Hi-res material/texture VRAM | 8K × many fabrics | LRU texture budget scaled to `deviceMemory`; stream LODs (§3, §7.1) |
| Main-thread text shaping | 1000+ char runs | shape in a Worker; cache by `(font,version,content,features)` (§7.2) |
| Worker can't reach Supabase | any export | resolve assets on main thread, transfer resolved data in (§8) |
| Export ≠ live drift | fonts/colour/GPU/material | pinning + ICC + pre-rasterized materials + visual-oracle CI (§8) |

---

## 11. Phased roadmap

| Phase | Ships | Notes |
|---|---|---|
| **0 — Compiler + SVG** | Scene Compiler (pure) + `SvgBackend` behind the frozen `render()`; overrides-at-draw; opaque ids + `refOf` | replaces today's studio backdrop |
| **1 — Incremental + hit-test** | patch-driven per-backend dirty update; spatial-index hit-test → GOM refs; selection overlay | 60fps foundation |
| **2 — Viewport + snapping** | viewport projection from `opts.viewport`; world-space zoom-invariant snapping → Commands | interaction-complete |
| **3 — Canvas/WebGL** | `CanvasBackend` (mobile/perf) + `WebGLBackend` (heavy scenes) + GPU colour-id picking | pure backend swaps |
| **4 — Material/text/image** | per-backend realization; HarfBuzz shaping; off-thread image decode; blend-mode map | pro fidelity |
| **5 — Export + determinism** | `PdfBackend`/`PngBackend`/thumbnail/factory; pinned fonts+materials, ICC, export viewport, visual-oracle CI; outputs → PRD-2 representations | WYSIWYG export |
| **6 — 3D + debug** | `ThreeBackend` 3D preview (model untouched); dev inspectors | additive |

Because the frozen `render(model, state, opts)` is the only public surface and the neutral Scene is stateless, every later backend — WebGL, PDF, 3D, a future native renderer — is a **drop-in** that touches nothing in PRD 1–4. The engine visualizes; it never owns.
