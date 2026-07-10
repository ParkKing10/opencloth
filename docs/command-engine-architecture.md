# THREADOS Command Engine — Architecture (PRD 004)

> Status: **Design / approved-for-build spine.** Synthesized from a 6-lens design + adversarial red-team pass (all lenses NEEDS_WORK — every "CRITICAL" flag was an *ambiguity about consuming PRD-3*, not a contradiction; all are closed here).
> Depends on **PRD 001 / 002 / 003, all FROZEN.** PRD-004 does **not** re-open the Command system PRD-003 declared — it **formalizes** it into the reusable execution backbone every subsystem calls. The §1 consumption map proves each PRD-3 decision is realized unchanged.

---

## 0. What PRD-004 is (and is not)

PRD-003 *declared* a command system (contract, dispatch order, undo, versioning, bus, AI-as-client, macros). **PRD-004 is the formal engine that realizes it** — adding depth PRD-3 didn't specify: a data-driven type registry, a determinism contract, an idempotency/transaction contract, a migration subsystem, source-agnostic ingress, transactional macros, and the performance/replay machinery. It introduces **no new decision that contradicts PRD-3**. The three laws it inherits:

- **Law 1 — Commands are the only mutation path.** Users, AI, Macros, Automation, Collaboration, Import, and a future API all produce Commands; nothing mutates Runtime state directly.
- **Law 2 — The pipeline order is invariant** (PRD-3's frozen order, formalized): `dedup → policy → validate+migrate → apply → history → enqueue-validation → enqueue-autosave → emit`.
- **Law 3 — Handlers are pure and deterministic.** Same command + injected context ⇒ same state, on any device, after any app upgrade. This is what makes replay, offline, and future collaboration converge.

---

## 1. Consumption map — every PRD-3 frozen decision, realized unchanged

| PRD-3 frozen decision | How PRD-004 realizes it (no re-decision) |
|---|---|
| Command `{id:ULID, type, schemaVersion, actor:{userId,source}, clock, payload semantic-only}` | Kept verbatim; spec's extra fields (`undoPayload/redoPayload/executionResult/validationResult/origin/metadata`) are *additive execution metadata* (§2) |
| Dispatch order (7 stages) | Formalized as a staged middleware chain with per-stage failure semantics; **dedup added as Stage 0** — a realization of PRD-3's stated ULID idempotency, not a new stage (§3) |
| `schemaVersion` + `CommandMigrator`; breaking change ⇒ new type | Deepened into a full migration subsystem incl. **inverse-command migration** + mandatory-migrator + forward-incompat handling (§8) |
| Semantic-only payloads | Enforced by schema validation that **rejects renderer keys** (`x/y/width/height/px`) in payloads *and* inverses (§2, §7) |
| Per-user undo; peer-undo = `Revert(targetCommandId)` | Coalescing requires same `actor.userId`; snapshot-boundary rule preserves the per-user filter (§7) |
| Policy engine (deny-wins, data-driven, every command, AI no privilege, no new PRD-2 API) | Consumed as Stage 1; permissions come from the session's PRD-2 JWT-claims + `workspace_members` snapshot (§3, §6) |
| Validation engine (incremental, Web Worker, advisory, gates only transitions) | The engine's Stage-2 check is **structural preconditions only**; design-health is *delegated* to PRD-3 §8, never duplicated (§3) |
| Dual FSM (no mutation in Conflict; transition needs Saved; transition = a gated command) | Enforced as policy rules + a precondition; `TransitionLifecycle` is an ordinary command through the same pipeline (§3, §9) |
| Bus separation (ephemeral runtime bus ≠ PRD-2 outbox) | Formalized as three channels with explicit reliability semantics (§6) |
| AI proposes → preview → user accepts → execute; no privileged path | `origin='ai'` + `parentProposalId`; dry-run simulate; a data-driven `deny(origin='ai', type='TransitionLifecycle')` rule (§10) |
| A design is not an asset (PRD-2) | The engine never writes assets; publish is a separate op (PRD-3 §11) it does not own |

If any row above were violated, it would be a CRITICAL failure. None are.

---

## 2. The formal Command model + type registry

```ts
interface Command {
  id: string                 // ULID — unique, ordered, AND the idempotency key
  type: string; schemaVersion: number
  designId: string
  actor: { userId: string; source: 'user' | 'ai' | 'collab' | 'system' }  // FROZEN 4-value enum
  origin: 'direct' | 'macro' | 'automation' | 'import' | 'api'            // NEW: ingress context (not identity)
  batchId?: string           // groups a macro/transaction into one undo step
  parentProposalId?: string  // AI provenance: which proposal this came from
  clock: { wall: number; logical: number }   // wall = ctx.now (committed); logical reserved for CRDT/OT
  payload: unknown           // SEMANTIC ONLY — schema rejects renderer layout keys
  // ── execution metadata, populated by the pipeline (immutable once committed) ──
  invert?: Command           // precomputed inverse (semantic-only), stored on the HistoryEvent
  result?: { status: 'executed' | 'rejected' | 'error'; reason?: string; wasResubmission?: boolean }
}
```

> **Source vs. origin (freeze reconciliation).** The spec listed User/AI/Macro/Automation/Collaboration/Import/API as "sources," but PRD-3 froze `actor.source` to four *identities*. So Macro/Automation/Import/API are modeled as **`origin`** (+ `batchId`, `parentProposalId`), never as new `source` values. A macro a user runs is `source:'user', origin:'macro'`; an accepted AI proposal executes as `source:'user'` (the human committed it) with `parentProposalId`. Per-user undo and the frozen enum stay intact.

**The type registry is data** — a new command type ships without touching the engine:

```ts
interface CommandType<P> {
  type: string; schemaVersion: number
  payloadSchema: JSONSchema                 // validated; MUST reject renderer keys
  precondition(p: P, state, ctx): PreconditionError[]   // STRUCTURAL ONLY (see §3) — never design-health
  apply(state, p: P, ctx: ExecutionContext): DesignDocument   // pure + deterministic
  invert(before, p: P, after): Command      // produces a semantic-only inverse Command
  coalesce?: { group: string; windowMs: number }   // merge policy as DATA, not a heuristic
  migrate?: (cmd: Command, from: number, to: number) => Command   // pure; deterministic
}
registerCommandType(entry)   // e.g. SetPartColor, ReplaceMaterial, PlaceObject, ChangeMeasurement, TransitionLifecycle…
```

---

## 3. The dispatch pipeline (invariant order, precise failure semantics)

```
submit(cmd) →
 0. DEDUP        — cmd.id already in the durable log/queue? → return cached result {wasResubmission:true}; no re-apply
 1. POLICY       — evaluate(cmd, ctx); deny-wins; ZERO side-effects on deny → emit CommandRejected, stop
 2. VALIDATE     — (a) payload schema + schemaVersion migrate; (b) STRUCTURAL PRECONDITIONS only:
                    target design/part exists, asset resolvable (PRD-2), FSM legal (no mutation in Conflict).
                    fail → reject BEFORE apply ("validation never executes"). *No design-health here.*
 3. APPLY        — pure handler w/ injected ExecutionContext; immutable structural sharing; single-writer commit
 4. HISTORY      — append immutable HistoryEvent; precompute + store cmd.invert (schema-checked);
                    IF this is a lifecycle transition: compute + persist the durable validationSnapshot
                    atomically in this step (closes the PRD-3 §8 gate-timing ambiguity)
 5. VALIDATION   — enqueue PRD-3 incremental design-health validation (Web Worker; advisory; non-blocking)
 6. AUTOSAVE     — enqueue delta → IndexedDB (crash-safe) → batched flush to design_events
 7. EMIT         — publish on the ephemeral runtime bus (best-effort; §6)
```

**The most-repeated red-team correction:** Stage 2 is **structural preconditions only**. Design-health (printable zones, seams, material combos, care-label) is **never** a command precondition — putting `isWithinPrintableZone` in a `validate` handler re-introduces the per-keystroke latency PRD-3 §8 solved. Design-health lives in Stage 5 (PRD-3's engine), is advisory, and gates only lifecycle transitions via the durable snapshot written in Stage 4.

---

## 4. The determinism contract

Handlers receive an **injected `ExecutionContext`** and may read nothing ambient:

```ts
interface ExecutionContext {
  now: number      // = the command's committed clock.wall; NEVER Date.now()
  id(): string     // deterministic id source, seeded ONLY by cmd.id (a per-command ULID)
  actor: { userId: string; source: string }
}
```

- **Seed = `cmd.id` alone.** Not `state_hash` (diverges after a migration → silent ID mismatch, breaking undo/asset refs). Not wall-clock. Because ULIDs are unique per command *and* per device, replay reproduces identical ids **and** two offline devices never collide.
- **`now` is the committed dispatch time**, stored on the command; replay reproduces it exactly.
- **Enforcement, not hope:** a CI lint gate forbids `Date.now()`/`Math.random()`/`crypto`/`Math.imul`/BigInt-platform-variance inside handler modules; a `assertDeterministic(handler)` harness replays each command N× across engines and asserts an identical `contentHash`. A handler that fails the gate does not ship.

---

## 5. Idempotency & the durable-write transaction

- **Stage 0 dedup** checks `cmd.id` against the local IndexedDB queue *and* the server log.
- The durable write is **one Postgres transaction**: `INSERT design_events … ON CONFLICT (design_id, command_id) DO NOTHING`, head-version increment, and (if a transition) the validation-snapshot write — atomic. A conflict returns the existing result with `wasResubmission:true`; the client then **does not** re-emit events or push to its undo stack.
- **Offline queue clears only after server ack.** A crash mid-flush re-submits safely (dedup makes it a no-op). This closes every "double-apply on retry / crash / conflict" hole the red-team found.

---

## 6. Source-agnostic ingress & the three channels

**One ingress:** `submit(command)`. User, AI, Macro, Automation, Collaboration, Import, and a future API all funnel through it — a **single-writer ordered queue** with backpressure and ULID dedup. `origin`/`source` are metadata for policy + audit; **no privileged fast-path exists** (frozen PRD-3). Remote/collab commands enter the *same* path as local ones.

**Three cleanly separated channels:**
1. **Runtime event bus** — ephemeral, in-session, **best-effort/fire-and-forget**. Subscribers are wrapped in try/catch; a subscriber crash is logged (`SubscriberError`) and **never blocks** history persistence. Events: `CommandStarted/Validated/Executed/Rejected/Undone/Redone`, `RendererUpdated`, `Autosaved`, `ValidationUpdated`.
2. **Durable `design_events`** — the source of truth. **Collaboration/analytics subscribe here**, not to Channel 1, so every committed command is seen exactly once (via cursor).
3. **PRD-2 outbox** — touched only at the publish bridge (PRD-3 §11).

Autosave is a *critical* subscriber (retry + backoff + timeout), unlike best-effort UI subscribers.

---

## 7. Undo / redo / replay (engine-owned)

- **Inverse is precomputed and stored** on the HistoryEvent at Stage 4 (`cmd.invert`), schema-validated to be **semantic-only** (rejects `x/y/width/height`). Undo = apply the stored inverse through the pipeline (audited, policy-checked). **O(1)** per step — no re-derivation, no full replay.
- **Per-user undo (frozen):** coalescing merges only consecutive commands with the **same `actor.userId`** *and* `coalesce.group` *and* target within `windowMs` — a peer command breaks the batch. A merged form must have a valid inverter or the merge is refused (no silent history corruption).
- **Snapshot-boundary rule:** if the oldest undoable command predates the loaded snapshot, **disable undo** (greyed) rather than replay-and-lose the per-user filter.
- **Redo invalidation:** the redo stack clears on a new user command, a peer command, a server sync, or entry into `Conflict`.
- **Replay convergence check:** after snapshot + tail replay, compare `contentHash` to the stored `HistoryEvent.hashAfter`; divergence → log + offer reload (never silently proceed).
- **Offline replay** runs in a Web Worker in ~16 ms chunks (never blocks the main thread); dedup by ULID against the server tail.

---

## 8. Versioning & migration subsystem

- **Migrate before apply, in memory only.** On load/replay, `migrate(cmd, from, to)` upcasts through a per-type version chain; the `design_events` row **stays at its authored version** for audit. Migrators are pure + deterministic (injected context, no ambient time/random).
- **Inverses migrate too** (the gap the red-team caught): an inverse carries its target command's version; on replay it is migrated alongside, so `original(v1) + inverse(v2)` converges.
- **Mandatory migrators:** a missing migrator for a version gap is a hard error with an upgrade path — never a silent default. **All migrators are kept forever** (they are data); a migration-debt tracker alerts when >1% of live commands are >2 versions old.
- **Forward-incompatible streams block the load** (a NEW joint clarification PRD-3 left open, stated explicitly for veto): a client that meets a *newer* command type/version it cannot migrate **refuses to open the design** ("update THREADOS") — it does **not** quarantine-and-skip, because skipping an event corrupts the deterministic stream and could bypass the policy gate.
- **No silent reinterpretation.** Deprecating a type keeps its handler+inverter forever; truly retiring it is an explicit new-type migration recorded in history — never a `replacePayload` on the old type.
- Migration DAG is cycle-validated at registration; results are memoized by `(commandId, targetVersion)` so undo/redo/refresh don't re-migrate; snapshots record a monotonic `commandSchemaMax`.

*Worked example:* `SetPartColor v1 {partRole, hex}` → `v2 {partRole, hex, colourSpace}`; migrator adds `colourSpace:'srgb'`; the inverse (`SetPartColor` back to the prior value) is authored at v2 and likewise carries `colourSpace`.

---

## 9. Transactions / macros (atomicity done right)

A macro/batch is **one atomic transaction, one undo step** — and the rollback model is **pre-commit, never post-apply inversion** (the correction the red-team demanded):

```
executeBatch(cmds, batchId) →
  PHASE 1 (no state change): for every sub-command run Stage 0–2 (dedup, policy, structural preconditions).
                             ANY deny/precondition-fail → reject the whole batch; ZERO history written.
  PHASE 2 (commit): all passed → apply sequentially; commit ONE HistoryEvent (batchId) = one undo step.
                    if an apply throws (rare — preconditions passed): O(1) pointer-swap back to the
                    pre-batch state (structural sharing, NOT deepClone) + write a BatchFailed audit event.
                    Never invert individual already-applied commands (that path can hit a policy-denied inverse).
```

- **Policy is evaluated per-sub-command but *before any apply*** — so atomicity holds and a mid-batch denial cannot leave partial state.
- **Structural-sharing snapshot** for the pre-batch state (an O(1) pointer), not `deepClone` (the 100 MB memory cliff).
- A `design_transactions(design_id, batch_id, status, applied_count, created_at)` row gates replay/recovery: `committed` → skip on resubmit; `pending` after a crash → discard or resume by user choice.
- Coalescing does **not** apply across a transaction boundary (a transaction is already one undo unit).

---

## 10. Producers: AI, Import, Automation

- **AI (frozen: propose → preview → accept → execute; no privilege):** AI calls `simulate(cmds)` (§ dry-run) to produce a **preview** without touching durable state; the user accepts; the batch executes as `source:'user', origin:'ai', parentProposalId`. A data-driven policy rule `deny(origin='ai', type ∈ {TransitionLifecycle, PublishDesign})` enforces "AI cannot change lifecycle." Accepted proposals are logged for audit/training.
- **Import / template-apply / brand-kit-apply** become **deterministic command streams** through the same ingress, **referencing PRD-2 assets via `resolveAsset` + version pins — never copying**. Same asset version ⇒ same command stream ⇒ idempotent by `batchId`.
- **Automation / future API** are just origins on the same path — same policy gate, same determinism, no bypass.

**Dry-run/preview contract:** `simulate(cmds) → { resultStateHash, validationPreview, events }` runs Policy + preconditions + apply against a structural-sharing branch, writing **no** history/autosave/bus and touching **no** durable state. Deterministic under the same injected context.

---

## 11. Performance & scale (red-team-hardened)

| Cliff | First hit | Mitigation |
|---|---|---|
| Offline/large replay blocks UI | ~1–5k commands | Web-Worker chunked replay (~16 ms slices) + adaptive snapshot cadence (§7) |
| deepClone per savepoint | big designs (1–10 MB state) | structural-sharing pointer snapshots, not clones (§9) |
| IndexedDB write amplification | 100-event drag on mobile | pre-write coalescing + 100 ms batched writes (§6) |
| Policy O(rules×commands) | 50 rules × 10k cmds | session-cached allowed-actions per role + rule indexing by state predicates (§6) |
| Redo stack after a 1k-cmd macro | mobile OOM | cap redo depth; store redo as HistoryEvent pointers, not re-materialized commands (§7) |
| Snapshot I/O size | complex designs | reference snapshots (`{headVersion, commandIds, stateHash}`) + recompute, not full-state JSON |
| Migration on hot path | old streams | memoize by `(commandId, targetVersion)`; migrate once per load (§8) |

---

## 12. Persistence (additions over PRD-3's tables)

Reuses PRD-3's `design_events` (append-only, idempotent by `(design_id, command_id)`) and `design_snapshots`. Adds:

| Table | Role |
|---|---|
| `design_transactions` | `(design_id, batch_id, status: pending\|committed\|failed, applied_count, created_at)` — macro atomicity + crash recovery (§9) |
| `command_type_registry` (in-app data) | the registry manifest incl. `schemaVersion` chain + migrator presence, validated at boot |

Client write path stays the frozen PRD-3 reality: browser → RLS insert / Edge Function → `design_events`; IndexedDB is the crash-safe mirror. **No application server is introduced.**

---

## 13. Phased roadmap

| Phase | Ships | Notes |
|---|---|---|
| **0 — Registry + model** | `CommandType` registry, formal Command model, `submit()` ingress | data-driven; 3 seed types end-to-end |
| **1 — Pipeline + determinism** | 8-stage dispatch, `ExecutionContext`, lint gate + `assertDeterministic` harness | realizes PRD-3 dispatch order |
| **2 — Idempotency + history** | Stage-0 dedup, atomic durable write, precomputed stored inverses, per-user undo/redo | consumes PRD-3 history |
| **3 — Migration subsystem** | version chains, inverse migration, mandatory-migrator, forward-incompat block, DAG validation | "never break old projects" |
| **4 — Transactions/macros** | pre-commit atomic batches, `design_transactions`, O(1) structural rollback | one undo step |
| **5 — Producers** | AI dry-run/propose/accept, import/brand-kit/template streams, automation/API | same path, no privilege |
| **6 — Scale hardening** | Web-Worker replay, write coalescing, policy caching, adaptive snapshots | the §11 mitigations |

Because every decision here *realizes* PRD-3 rather than re-opening it, the Command Engine slots under the frozen Runtime as pure depth — and every future subsystem (AI, Collaboration, Marketplace, Automation, Manufacturing) gets one deterministic, replayable, reversible execution path.
