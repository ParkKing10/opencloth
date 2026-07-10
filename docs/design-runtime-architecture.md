# THREADOS Design Runtime Engine — Architecture (PRD 003)

> Status: **Design / approved-for-build spine.** Synthesized from a 7-lens design + adversarial red-team pass (the document/override core returned SOLID; the rest returned NEEDS_WORK on "specify the mechanism" — every convergent gap is closed here).
> Depends on **PRD 001 (Garment Engine)** and **PRD 002 (Asset Platform)**, both **FROZEN**. This document references their contracts; it never redesigns them. The two CRITICAL freeze-flags the red-team raised are resolved in §0 and §11.

---

## 0. The laws everything obeys

```
   ASSETS (immutable, versioned)          TEMPLATES/GOM (immutable, versioned)
        │  referenced by (id, version)          │  referenced by (id, version)
        ▼                                        ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │                    THE DESIGN RUNTIME  (the ONLY mutable layer)     │
   │  DesignDocument = immutable references + SPARSE OVERRIDES + objects │
   │  every mutation is a COMMAND · history is an event log · dual FSM   │
   │  policy-gated · validated · renderer-independent · client-side      │
   └───────────────▲───────────────────────────────────▲───────────────┘
        produces    │ GarmentState (unchanged shape)     │ proposes commands
   ┌────────────────┴───────────┐              ┌──────────┴─────────────┐
   │ FROZEN GarmentRenderer      │              │ AI / Manufacturing /   │
   │ render(model, state, opts)  │              │ Collaboration / Market │
   │ applies overrides at draw   │              │ = event subscribers    │
   └─────────────────────────────┘              └────────────────────────┘
```

- **Law 1 — The Runtime is the only mutable layer.** Assets, garments, and templates are immutable. A Design stores **only overrides**; deleting an override restores the original.
- **Law 2 — Commands are the only mutation path.** Every action is a serializable Command (`apply`/`invert`). Nothing mutates state directly. Commands are the unit of undo, history, autosave, macros, AI, and future collaboration.
- **Law 3 — The Runtime never renders and never mutates the model.** It produces `GarmentState` and hands `(model, state, opts)` to the **frozen** `GarmentRenderer`; the renderer applies overrides at draw time.
- **Law 4 — Two freeze boundaries are absolute:**
  - **PRD-1:** the Runtime always produces the *unchanged* `GarmentState = {templateId, templateVersion, partOverrides, placedObjects}`. Lifecycle/policy **never** alter that shape — "Approved is locked" means the **policy denies mutating commands**, not that state looks different. `render(model, state, opts)` is untouched.
  - **PRD-2:** a Design **is not an asset**. The `designs` table stays an operational record that *references* assets. The only bridge into the asset graph is **Publish** (§11), which creates a *new, additive* Design-Preset asset — the design row is never converted.

---

## 1. The Design document model + override system

The persisted Design is a **superset of PRD-1 `GarmentState`**, so it feeds the frozen renderer directly. It holds immutable references + a sparse override layer + placed print objects — never a copy of any asset.

```ts
interface DesignDocument {
  id: string
  projectId: string | null            // null → the workspace's default "Drafts" project (§9)
  ownerId: string; workspaceId: string
  name: string

  // ── superset of the FROZEN PRD-1 GarmentState (this IS the renderer's `state`) ──
  garment: {
    templateId: string
    templateVersion: number            // PRD-2 version pin
    templateStateHash: string          // PRD-2 payload_state_hash — drift detection (§2)
    partOverrides: Record<PartRole, PartOverride>   // keyed by STABLE role, never an SVG id
    placedObjects: CanvasObject[]      // the EXISTING studio print-layer model, unchanged
  }

  assetRefs: AssetRef[]                // every referenced asset, version-pinned (logos, materials, brand kit…)
  lifecycleState: LifecycleState       // durable business FSM (§6)
  validationSnapshot: ValidationSnapshot // durable, gate-safe (§8)
  headVersion: number                  // atomic revision counter
  contentHash: string                  // sha256(CanonicalJSON(design)) — reproducible drift key
  updatedAt: number
}

type PartRole = string                 // e.g. 'body' | 'left_sleeve' — canonical PRD-1 role
interface PartOverride { color?: string; material?: string /* additive-only */ }

interface AssetRef {                   // reproducible reference into PRD-2 (never a copy)
  refId: string                        // stable handle used by overrides/objects
  assetId: string; assetType: string
  version: number; payloadStateHash: string
}
```

**Effective value = base ⊕ overrides**, resolved at read/render time (never baked in):

```ts
effectivePartColor(partRole) = design.garment.partOverrides[partRole]?.color
                             ?? resolveAsset(templateId, templateVersion).payload.part(partRole).colorRef
// delete the override entry → the template original returns automatically
```

**UI state is separated from design state.** Viewport, camera, zoom, selection, and clipboard live in an ephemeral `UIState` on the session — **never in `garment`, never autosaved, never broadcast as a design mutation.** (This closes the "viewport leaks into GarmentState/collaboration" flaw.)

---

## 2. Version upgrade & override drift (the #1 correctness bug, resolved)

A Design pins `(templateVersion, templateStateHash)` and each `AssetRef` version. Upgrading is an **explicit user action**, never automatic. `migrateOverridesOnUpgrade` is concrete and **never silently drops data**:

```ts
function migrateOverridesOnUpgrade(oldV, newV, overrides): UpgradeResult {
  for (const [role, ov] of overrides) {
    // 1. exact role match (roles are canonical + stable across versions)
    if (newV.hasRole(role)) rebind(role → role)
    // 2. geometric heuristic for renamed/split parts (bbox overlap, area, z-order, mirror)
    else if (const cand = geometricMatch(role, newV)) rebindProvisional(role → cand)  // flagged for review
    // 3. NO match → mark ORPHANED (kept, never discarded)
    else orphan(role, ov)
  }
  return { rebound, provisional, orphaned }  // written to a durable DesignUpgrade audit record
}
```

- Drift is detected by comparing the pinned `payloadStateHash` to the current asset's (PRD-2). A stale pin surfaces a "Template updated" review, not a silent change.
- Orphaned overrides set a validation error (`orphaned_overrides_exist`) that **blocks transition to Review/Approved** (§8) until the user re-binds or deletes them — the silent-loss gap is closed.
- **Placed-object assets upgrade too:** a Logo inside a `CanvasObject` carries its own `AssetRef`; the same drift check + review applies before Sampling.

---

## 3. The command system

```ts
interface Command {
  id: string                  // ULID — also the idempotency key for autosave
  type: string                // 'SetPartColor' | 'PlaceObject' | 'TransitionLifecycle' | ...
  schemaVersion: number       // forward-compat (see migrator)
  designId: string
  actor: { userId: string; source: 'user' | 'ai' | 'collab' | 'system' }
  clock: { wall: number; logical: number }  // logical clock reserved for future CRDT/OT ordering
  payload: unknown            // semantic only — NEVER computed layout for another renderer
}
```

**Dispatch is the single mutation pipeline** — identical for humans and AI:

```
dispatch(cmd) →
  1. POLICY.evaluate(cmd, context)        // deny-wins; §7 — no mutation on deny, no side effects
  2. validateSchema(cmd) + migrate if older schemaVersion
  3. next = applyCommand(present, cmd)    // pure, immutable, structural sharing
  4. append HistoryEvent (immutable)      // §4
  5. enqueue for incremental validation   // §8 (Web Worker)
  6. enqueue autosave delta               // §5
  7. emit on the runtime event bus        // §10 (CommandExecuted, OverrideCreated, RendererUpdated…)
```

- **Forward-compat is a requirement.** A `CommandMigrator` registry upcasts stored commands before replay (`migrate(cmd, from, to)`); a breaking change mints a **new command type** rather than reinterpreting an old one. Handlers are **deterministic** so replay converges.
- **Payloads are semantic, never renderer layout.** (Red-team CRITICAL: storing computed `x/y/width` per renderer breaks portability.) Placement intent is stored; the renderer computes pixels.
- **Coalescing:** a drag = many `MoveObject` commands merged into one undo step by `(type, targetId, time-window)`.
- **Batch / AI proposals are atomic:** an accepted proposal is one durable record; sub-commands apply with savepoints and **roll back entirely on any failure**; idempotency key = hash(proposalId + ordered sub-ids).
- **Lifecycle transitions are commands too** (`TransitionLifecycle`), so they pass through policy + history uniformly — the guard table (§6) reads the *current* state, which removes the FSM-within-FSM circularity.

---

## 4. History & compaction

History is an immutable event log with periodic snapshots so **opening a design is never a 10k-command replay**.

```ts
interface HistoryEvent { id; commandId; hashBefore; hashAfter; invert: Command; at: number; actor }
```

- **Snapshot every ~100 committed commands** (tunable). Open = load latest snapshot + replay only the tail. Undo crossing a snapshot boundary seeks to the snapshot and replays forward.
- **Undo/redo** replay stored `invert`/`redo` commands — no full replay for a single step.
- **Multi-user undo decision, made now:** **per-user undo** (a user undoes only their *own* commands; "undo" of a peer's change is a new `Revert(targetCommandId)` command, never a destructive rewind). This keeps shared undo safe and is a day-1 Command-schema decision (hence `actor.userId` on every command).
- **Durable + bounded:** snapshots and events persist in Postgres (`design_snapshots`, `design_events`), not just IndexedDB. Retention: keep ≥5 recent snapshots; compact/GC intermediate events; archive histories beyond a threshold. Bounded in-memory window prevents session OOM.

---

## 5. Session, persistence & incremental autosave (client-side reality)

**Sharp split:** the ephemeral **RuntimeSession** (user, `UIState`, undo/redo, locks, transient AI suggestions, autosave controller, the runtime/sync FSM) disappears on close; the **DesignDocument** persists.

**There is no app server** (static site + Supabase only), so the Runtime is a **client-side in-browser engine** and autosave writes **directly to Supabase** (RLS-guarded) or a thin **Edge Function** — never a Node backend. Validation runs client-side in a Web Worker (§8).

- **Incremental autosave, never whole-design:** commit → append the command/override **delta** to an append-only stream. Deltas are first written **durably to IndexedDB** (crash-safe), then flushed to Postgres in debounced ~500 ms batches.
- **Idempotent + concurrency-safe:** each delta insert is `ON CONFLICT (design_id, command_id) DO NOTHING`; the batch carries `expectedHeadVersion` for optimistic concurrency. Server ahead → **Conflict** state (§6), never a silent clobber.
- **Offline / recovery:** offline commands accumulate in the IndexedDB queue; on reconnect the client fetches the server tail, **rebases** local commands, and resolves (independent props merge; same-property → the conflict strategy in §10). On app load a non-empty queue prompts resume vs discard.
- **Hydrate:** open → load latest `design_snapshots` row → replay tail `design_events` → attach session → ready.

---

## 6. The dual state machine (two orthogonal, first-class FSMs)

**These are runtime states, not UI states.** Both are formally modelled with typed states, guarded transitions, and emitted events; other modules **subscribe** instead of reinventing lifecycle logic.

### 6.1 Design Lifecycle (durable, on the Design)
```
Draft ⇄ Review → Approved → Sampling → Production-Ready → Archived
  ▲        │         │
  └────────┴─────────┘   (guarded back-transitions: Review→Draft, Approved→Draft)
```

| Transition | Guards (all must pass, evaluated atomically) |
|---|---|
| Draft→Review | role can `submit_for_review`; **zero orphaned overrides**; runtime=Saved |
| Review→Approved | role can `approve`; **durable validation snapshot = clean**; runtime=Saved |
| Approved→Sampling | role can `order_sample`; runtime ∉ {Offline, Conflict} |
| Sampling→Production-Ready | manufacturing-readiness check passes (reads PRD-1 data, no duplication); runtime=Saved |
| *→Archived | role can `archive` |
| Review→Draft / Approved→Draft | role can `reopen` |

Guards are **data** (a transition table), not `if`s in the editor. A lifecycle transition is a policy-gated Command; the guard reads the *current* state → no circularity.

### 6.2 Runtime / Sync (transient, on the Session)
```
Unsaved → Saving → Saved
   Saved/Unsaved ⇄ Offline → Syncing → Saved
                      Syncing → Conflict → (resolve) → Saved
   any → Error → (backoff) → Saving/Offline
```
This **is** the autosave/persistence-controller state (connection + save status).

### 6.3 Orthogonality + legal pairs
They're independent (a `Draft` can be `Saving`; an `Approved` design can be `Offline`) — but a few pairs are policy-enforced: **no mutating command while `Conflict`**, and **lifecycle transitions require `Saved`** (so a transition can't race an in-flight save). Each FSM emits a typed event: `LifecycleChanged(from,to,actor)`, `RuntimeStateChanged(from,to)`.

---

## 7. The policy engine (business rules out of the editor)

A pure function, consulted on **every** command dispatch (human and AI identically):

```ts
evaluate(action: Command, ctx: PolicyContext): { allow: boolean; reason?: string }

interface PolicyContext {
  role: WorkspaceRole                 // snapshot from PRD-2 (see below)
  entitlements: Set<string>
  lifecycleState: LifecycleState
  runtimeState: RuntimeState
  node?: { locked?: boolean; lockedBy?: string }
}
```

- **Deny-wins, data-driven registry.** Rules are composable data (`{ when, effect: 'deny', reason }`), not scattered conditionals. New rules ship without touching the editor — mirrors PRD-1/PRD-2 registry discipline.
- **Permissions come from PRD-2 with no new frozen API** (freeze fix): the session loads a **permissions snapshot** at open from PRD-2's *existing* JWT workspace claims + a `workspace_members` read, caches it (≤5 min TTL), and refreshes on a Supabase Realtime role-change event. The engine reads the snapshot; it never mutates or forks PRD-2 RBAC.
- **AI gets no privileged path** and **cannot fire lifecycle transitions** — it may *propose* one, which a human must execute.
- Worked denials: a Viewer's `SetPartColor` → deny(`role`); any mutating command while `runtimeState=Conflict` → deny(`conflict`); `Review→Approved` with open validation errors → deny(`validation`).

---

## 8. The validation engine

Continuous, **incremental**, reactive, and **never blocks editing** (runs in a Web Worker). Pure derivation — it never mutates design state; it emits `ValidationUpdated`.

```ts
interface ValidationRule {
  id: string; category: 'construction'|'brand'|'manufacturing'|'legal'|'appearance'
  severity: 'error' | 'warning'
  dependsOn: string[]          // property paths that dirty this rule (enables incremental eval)
  check(ctx): ValidationViolation[]   // reads FROZEN PRD-1 GOM data (printableZones, seams…)
}
```

- **Incremental via a dependency graph:** a command dirties only the nodes it touched; only rules whose `dependsOn` intersect re-run; results memoized by `(nodeId, ruleId)`. O(delta·rules), not O(objects·rules) — kills the per-keystroke cliff.
- **Extensible registry:** rules are data (per garment-category rule sets); Manufacturing/Compliance register rules without touching the engine. Built-ins: logo/print outside `part.printableZones`, embroidery too close to `part.seams`, pocket/part collision, invalid material combo, missing care label, missing packaging, `orphaned_overrides_exist`.
- **Durable, gate-safe snapshot:** results are persisted as `validationSnapshot` on the Design at each lifecycle transition, so a gate reads a *committed* result (never an in-flight async race) and the audit survives session close. `error`-severity rules can run synchronously for the transition gate; `warning`s defer.

---

## 9. Rendering integration & the design graph

- **Frozen boundary:** the Runtime calls `render(model, state, opts)` unchanged; the renderer applies overrides at draw time. The Runtime **never** bakes overrides into the model.
- **Update contract (perf without changing the signature):** the Runtime emits `RendererUpdated` carrying a **minimal patch** (changed part roles / object ids). A renderer *may* expose a surgical `updatePart(...)` fast path; otherwise it re-renders. Full render targets <16 ms; one `DesignState` drives every backend (SVG/Canvas/WebGL/PDF/PNG) renderer-independently.
- **The design graph** is a DAG in the DesignDocument: **nodes** = the pinned Garment asset + referenced assets (material/logo/brand-kit, each a version-pinned `AssetRef`) + `CanvasObject` print instances; **edges** = references + containment. Asset nodes are *references* (resolved once via `resolveAsset`, cached — no duplication); `CanvasObject`s are per-design instances (expected). The graph drives validation dependency order and resolve order.
- **Projects** group **Designs** (mutable work): a `projects` table, `designs.project_id` (nullable → default "Drafts"), fork = copy state into a new design id, shared via RLS. Distinct from a PRD-2 **Collection**, which groups **Assets**.

---

## 10. Event bus, AI-as-client & collaboration readiness

**Three cleanly separated channels** (the red-team's key "don't conflate" point):
1. **Runtime event bus** — ephemeral, in-session, in-memory pub/sub (`SelectionChanged`, `CommandExecuted`, `OverrideCreated/Removed`, `ValidationUpdated`, `LifecycleChanged`, `RuntimeStateChanged`, `RendererUpdated`). Auto-unsubscribes on unmount. No module calls another directly.
2. **Durable design audit log** (`design_events`) — survives reload; powers history, replay, analytics.
3. **PRD-2 outbox** — touched **only** at the Publish bridge (§11), never from routine editing.

**AI is another Runtime client:** it reads via an explicit `getVisualContext(designId) → { garmentGeometry (resolveAsset), effectivePartValues, placedObjects, validationResults, fsmStates }` (pure re-assembly, **no direct DB access**), and it **proposes** Commands through the same bus + the same policy gate. Suggestions live in the session until the user **accepts** → execute. AI cannot execute lifecycle transitions.

**Collaboration is designed-for, not built** — but the day-1 decisions that make it a drop-in are made now:
- **Commands are the collab unit**, each carrying `{id, actor.userId, clock}` for future ordering.
- **Conflict model:** overrides are keyed at `(partRole, property)` granularity, so independent concurrent edits (color vs material on one part) **merge trivially (LWW-map)**; only same-property concurrent edits need OT/CRDT, reserved behind the `clock`.
- **Per-user undo** (§4) and **session-local UIState/presence** (viewport, selection, locks) over Supabase Realtime — never mixed into `GarmentState`.

---

## 11. The Publish bridge (freeze-compliant design → asset)

A Design never becomes an asset. **Publish** is an explicit op that creates a **new, additive** PRD-2 asset:

```
publishDesign(designId) →
  create asset { type: 'design_preset', payload_type: 'design_snapshot',
                 payload: frozen snapshot of resolved DesignState + ALL version pins + hashes }
  → registers via PRD-2's normal asset path; emits to the PRD-2 outbox
  → the `designs` row is UNTOUCHED (still an operational record)
```

This gives Marketplace templates and design presets reproducibility (the snapshot pins every referenced asset version) **without violating PRD-2's "a design is not an asset" law** — it's additive, exactly as PRD-2's type registry intends.

---

## 12. Persistence schema (Supabase Postgres) + the no-server note

| Table | Role |
|---|---|
| `designs` | the durable DesignDocument head (frozen PRD-1/PRD-2 shape: GarmentState + refs + lifecycle + validation snapshot + headVersion + contentHash) |
| `design_events` | append-only command/history log (idempotent by `(design_id, command_id)`) — durable audit + replay |
| `design_snapshots` | periodic materialized snapshots (`design_id`, `up_to_event`, `state`, `command_schema_max`) — fast open, bounded replay |
| `design_lifecycle_history` | immutable lifecycle transition audit (from/to/actor/at/reason) |
| `design_upgrades` | override-drift upgrade audits (rebound/provisional/orphaned) |
| `projects` | groups Designs (mutable work); distinct from PRD-2 Collections |

Client-side write path: browser → (RLS-guarded Supabase insert **or** a thin Edge Function) → `design_events`; IndexedDB is the crash-safe local mirror. **No application server** is introduced (PRD-1's worker is unrelated to editing).

---

## 13. Scale cliffs & mitigations (red-team-hardened)

| Cliff | First hit | Mitigation (built in) |
|---|---|---|
| Command replay on open | ~1–5k commands | snapshot every ~100 + tail replay (§4) |
| Validation per keystroke | ~500 objects × N rules | dependency-graph incremental + Web Worker + memoize (§8) |
| Renderer redraw | thousands of objects | `RendererUpdated` minimal patch + surgical `updatePart` (§9) |
| Autosave / offline race | any flaky network | ULID idempotency + IndexedDB queue + optimistic `expectedHeadVersion` (§5) |
| Override silent-loss | template version upgrade | orphan-flag + blocking validation + audit (§2) |
| Command rot across app upgrades | year-old history | `schemaVersion` + `CommandMigrator` + new-type-on-break (§3) |
| Session memory | long heavy session | bounded in-memory window + snapshot eviction (§4) |
| Real-time collab correctness | 2+ concurrent editors | `(role,property)` LWW-map + per-user undo + logical clock reserved now (§10) |

---

## 14. Phased roadmap

| Phase | Ships | New infra |
|---|---|---|
| **0 — Document + commands** | DesignDocument (GarmentState superset), override system, Command bus + dispatch pipeline, base⊕override resolve | none (Supabase) |
| **1 — History + autosave** | event log + snapshots + per-user undo/redo; incremental autosave (IndexedDB → `design_events`), offline recovery | none |
| **2 — Dual FSM + policy** | lifecycle + runtime FSMs, guard tables, data-driven policy engine reading PRD-2 permission snapshot | none |
| **3 — Validation** | Web-Worker incremental engine + rule registry + durable validation snapshot + transition gating | none |
| **4 — Rendering + drift** | `RendererUpdated` patches; version-upgrade + `migrateOverridesOnUpgrade`; design graph | none |
| **5 — AI-as-client** | `getVisualContext`, propose/accept/reject, same policy gate | none |
| **6 — Publish bridge** | Design → additive Design-Preset asset (PRD-2) | none |
| **7 — Collaboration** | presence/selections/comments over Realtime; same-property OT/CRDT on the reserved clock | Supabase Realtime |

Because commands, stable override keys, and the event bus are decided now, Phase 7 is additive — not a rewrite. The Runtime stays the single mutable layer; assets, garments, and templates remain immutable throughout.
