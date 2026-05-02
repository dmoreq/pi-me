# pi-me Deep Codebase Review: Consolidation, DRY, & Structural Refactoring

**Date:** 2026-05-02
**Scope:** 77+ extensions, 23 skills, ~shared utilities across `foundation/`, `session-lifecycle/`, `core-tools/`, `content-tools/`, `authoring/`, `shared/`

---

## Table of Contents

1. [Settings/Config Loading — 4 Divergent Patterns](#1-settingsconfig-loading--4-divergent-patterns)
2. [Notification System — Fragmented Across 5 Files](#2-notification-system--fragmented-across-5-files)
3. [Extension Structure — 3 Competing Patterns](#3-extension-structure--3-competing-patterns)
4. [Context Management — Overlapping Concerns](#4-context-management--overlapping-concerns)
5. [AI Querying — Duplicated Patterns Across Tools](#5-ai-querying--duplicated-patterns-across-tools)
6. [Naming & Folder Structure Inconsistencies](#6-naming--folder-structure-inconsistencies)
7. [Session Lifecycle Scope Blur](#7-session-lifecycle-scope-blur)
8. [Duplicate Utility Functions](#8-duplicate-utility-functions)
9. [Configuration Persistence Patterns](#9-configuration-persistence-patterns)
10. [Adopted Plugin Wrappers — Unifying Pattern Exists But Isn't Universal](#10-adopted-plugin-wrappers)
11. [Implementation Plan](#11-implementation-plan)

---

## 1. Settings/Config Loading — 4 Divergent Patterns

### Problem

There are **four distinct ways** settings/config are loaded across the codebase. Each has different validation, sync/async behavior, and error handling. This creates maintenance burden and inconsistent DX.

### Pattern A: `shared/settings.ts` (async, custom, 1 consumer)

```typescript
// Used by: session-lifecycle/notifications.ts (the notifications *extension*)
// Reader: shared/settings.ts:getBackgroundNotifyConfig()
// Method: async file read + ctx.settingsManager fallback + runtime overrides
// Validation: none (raw JSON spread into typed interface)
// Dependencies: fs/promises, os, path
```

**Wait, there's more:** `getBackgroundNotifyConfig` is essentially reimplementing what `loadConfigOrDefault` already does, but without schema validation.

### Pattern B: `shared/pi-config.ts` (sync, zod-validated, 5+ consumers)

```typescript
// Used by: file-collector, sub-pi, richard-files, extra-context-files, preset
// Method: sync readFileSync + jsonc-parser + zod schema + deep-merge defaults
// Validation: full zod schema
// Benefit: JSONC support, type-safe output, clear error messages
```

### Pattern C: Inline `settingsManager` access (3+ consumers)

```typescript
// Used by: session-style.ts, permission.ts, auto-compact config
// Pattern: const settings = (ctx as any).settingsManager?.getSettings() ?? {};
// Validation: none
// Risk: no schema, no fallback chain, `as any` casting
```

### Pattern D: Hardcoded `readFileSync` (2 consumers)

```typescript
// Used by: pi-memory/src/index.ts, notifications.ts (settings write path)
// Pattern: readFileSync(join(homedir(), ".pi", "agent", "settings.json"), "utf-8")
// Validation: none
```

### Recommendation

**Consolidate all config loading into `shared/pi-config.ts`** — the zod-based pattern is the most robust. Pattern A (`shared/settings.ts`) should be deprecated in favor of `loadConfigOrDefault`. Pattern C and D callers should be migrated.

---

## 2. Notification System — Fragmented Across 5 Files

### Problem

The "notify the user" concern is split across:

| File | Purpose | Type |
|------|---------|------|
| `shared/notifications.ts` | Utility functions: beep, speak, bring-to-front, pronunciation | Library |
| `session-lifecycle/notifications.ts` | Extension: commands + event hooks for background/long-running notify + funny messages | Extension |
| `session-lifecycle/warp-notify/` | Warp terminal OSC 777 notification transport | Extension |
| `shared/settings.ts` | Config loader for notification settings | Library |
| `shared/types.ts` | Types for notification config | Library |

### Observations

- **Name collision**: `shared/notifications.ts` (utility) and `session-lifecycle/notifications.ts` (extension) share the same filename but sit in different directories. This is confusing — any import of `./notifications` is ambiguous without the full path.
- **`warp-notify` is self-contained**: it does one thing (OSC 777 transport) and does it well. It doesn't overlap much with the other notifications.
- **`session-lifecycle/notifications.ts` does two unrelated things**: (a) background task notification and (b) funny working messages. The funny messages are cosmetic and could be a standalone micro-extension.
- **`shared/settings.ts` is notification-specific**: it exists solely to load `backgroundNotify` config. This could be replaced by `loadConfigOrDefault`.

### Consolidation Options

1. **Rename `shared/notifications.ts` → `shared/notify-utils.ts`** to avoid the name collision.
2. **Remove `shared/settings.ts`** and move `getBackgroundNotifyConfig` logic into `loadConfigOrDefault`.
3. **Extract funny messages** from `session-lifecycle/notifications.ts` into a standalone `session-lifecycle/funny-messages.ts` extension.

---

## 3. Extension Structure — 3 Competing Patterns

### Problem

Extensions follow different structural patterns, making it harder to reason about how each works.

### Pattern 1: Direct Factory (most common)

```typescript
// session-lifecycle/handoff.ts, session-lifecycle/session-name/*, etc.
export default function (pi: ExtensionAPI) {
  pi.on("session_start", ...);
  pi.registerCommand("x", ...);
}
```

### Pattern 2: Config-loaded Factory

```typescript
// file-collector, richard-files, sub-pi, preset
// index.ts:
import { loadConfigOrDefault } from "../../shared/pi-config.js";
const config = loadConfigOrDefault({ filename: "...", schema: ..., defaults: ... });
export default factory(config);

// extension.ts: (separate file)
export function factory(config) { ... }
```

### Pattern 3: Wrapped npm Package

```typescript
// pi-stash, pi-formatter, pi-memory, pi-link, pi-crew, etc.
// index.ts:
import { registerAdoptedPackage } from "../../shared/register-package.js";
registerAdoptedPackage(pi, { importFn: () => import("..."), ... });

// Or:
import { LazyModule } from "../../shared/lazy-package.js";
const mod = new LazyModule(() => import("..."), "name");
```

### Observations

- **Pattern 2 is a good pattern** — separates config loading from business logic. The `extension.ts` file is testable without mocking filesystem.
- **Pattern 3 is inconsistent** — some adopted plugins wrap with `registerAdoptedPackage` (`pi-crew`), some wrap with `LazyModule` (`pi-formatter`), and some just import directly (`notebook.ts`, `github.ts`).
- **Several "adopted" plugins still import their npm dependency directly** instead of using the shared wrapper pattern.

### Recommendation

- Document Pattern 2 as the canonical approach.
- Ensure all adopted npm packages use `registerAdoptedPackage` + `LazyModule` consistently.
- Add a generator/scaffold command for new extensions following the canonical pattern.

---

## 4. Context Management — Overlapping Concerns

### Problem

Two separate systems manage context pruning:

| System | Location | Trigger | Approach |
|--------|----------|---------|----------|
| `auto-compact` | `session-lifecycle/auto-compact/` | `turn_end` at threshold % | Calls `ctx.compact()` with instructions |
| `dcp` (Dynamic Context Pruning) | `session-lifecycle/dcp/` | `context` event | Prunes individual messages via rules (dedup, error-purging, recency, etc.) |
| Built-in pi compaction | pi-core | Configurable via settings | Built-in threshold-based |

### Observations

- `auto-compact` and built-in pi compaction both trigger on percentage thresholds. `compact-config.ts` adds custom per-model thresholds on top of auto-compact.
- `dcp` is more surgical — it removes individual messages rather than compacting the whole context.
- **These are complementary but the boundary is unclear** — a developer might not know whether to configure `auto-compact` or `dcp` or pi's built-in settings.
- `compact-config.ts` reimplements a model-picker TUI that's similar to the preset model picker.

### Recommendation

1. **Document the hierarchy** clearly: DCP removes messages → auto-compact compresses remaining → built-in pi is the fallback.
2. **Consolidate config UI**: `compact-config` and `preset` both have model picker TUI widgets — extract a shared `shared/model-picker.ts` component.
3. **Rename `dcp` → `context-pruning`** or keep abbreviation but add a comment/doc.

---

## 5. AI Querying — Duplicated Patterns Across Tools

### Problem

Four tools independently implement LLM querying with different approaches but similar concerns:

| Tool | File(s) | What it does |
|------|---------|-------------|
| `/oracle` | `core-tools/oracle.ts` | Queries a different AI model for second opinion |
| `/btw` | `core-tools/btw/btw.ts` | Side question to primary model |
| `speedreading` | `core-tools/speedreading.ts` | Reads assistant text at speed |
| `flicker-corp` | `core-tools/flicker-corp.ts` | Flashy terminal output (NOT AI-related) |

### Duplicated Logic

Each of `/oracle`, `/btw`, and `speedreading` have:
- **Model discovery/selection** — resolving available models, picking one
- **Message formatting** — `convertToLlm()`, building message arrays
- **Completion calls** — `complete()` or `completeSimple()` from `@mariozechner/pi-ai`
- **Output rendering** — custom TUI components for displaying AI results

### Recommendation

1. **Extract a shared `core-tools/shared/ai-utils.ts`** with common AI query helpers:
   - `resolveModel(ctx, provider, modelId)` — find available model
   - `formatConversationContext(ctx, options)` — build message history
   - `queryModel(model, messages, options)` — make completion call with error handling
   - `renderAIResponse(tui, response, options)` — standard output display
2. **Refactor `/oracle` and `/btw`** to use the shared helpers.
3. **`flicker-corp` is cosmetic only** — doesn't query AI. Keep separate.

---

## 6. Naming & Folder Structure Inconsistencies

### Problem

Several naming and structural inconsistencies affect readability:

### `git-checkpoint-new/` directory

```typescript
// Path: session-lifecycle/git-checkpoint-new/
// Files: checkpoint-core.ts, checkpoint.ts, tests/checkpoint.test.ts
```

The `-new` suffix suggests there was once an old version. If the old version was removed, rename to `git-checkpoint/`. If not, the old version should be removed or the new one should replace it.

### `dcp/` — Abbreviation without explanation

```typescript
// Path: session-lifecycle/dcp/
// Means: Dynamic Context Pruning
```

The abbreviation `dcp` is not immediately obvious. Either rename to `context-pruning/` or add a top-level `README.md` / docstring.

### `foundation/` vs `session-lifecycle/` boundary

- `foundation/notifications.ts` doesn't exist, but `session-lifecycle/notifications.ts` handles both session-level notifications and cross-cutting concerns (funny messages)
- `foundation/permission/` and `foundation/secrets/` are truly always-on guards
- `session-lifecycle/` contains things that are session-scoped, but also things that manage global state

### Mixed naming conventions

| Pattern | Examples |
|---------|---------|
| kebab-case | `agent-guidance`, `auto-compact`, `extra-context-files`, `skill-args`, `tab-status`, `token-rate`, `warp-notify` |
| camelCase | `safe-ops.ts`, `startup-header.ts` (in path only) |
| dot-separated | `mario-not.ts` (not really a convention) |

### `mario-not/` game directory

```typescript
// Path: core-tools/arcade/mario-not/
// Contains: 20 JS files + 1 TS file
```

The `mario-not` directory name is whimsical but confusing — it doesn't communicate "this is a Mario-like platformer game." Consider renaming to `platformer/` or keeping a separate `games/` category.

### Recommendation

- Rename `git-checkpoint-new/` → `git-checkpoint/`
- Rename `dcp/` → `context-pruning/` (or add README)
- Rename `shared/notifications.ts` → `shared/notify-utils.ts` (avoids collision)
- Add a naming convention doc: **kebab-case for directories and file names consistently**
- Consider moving `arcade/` games into a dedicated `games/` top-level directory

---

## 7. Session Lifecycle Scope Blur

### Boundary Issues

The `session-lifecycle/` directory has the widest scope variance:

**Belongs here (session scoped):**
- `session-name/` — names sessions
- `session-style.ts` — emoji + color branding
- `session-recap/` — session recap
- `tab-status/` — tab status indicators
- `skill-args/` — skill argument passing
- `token-rate/` — token rate tracking
- `usage-extension/` — cost tracking
- `handoff.ts` — session handoff
- `startup-header.ts` — startup display

**Cross-cutting or foundation-level:**
- `notifications.ts` — background task notify (cross-cutting, used across sessions)
- `auto-compact/` — context compaction (cross-cutting)
- `dcp/` — context pruning (cross-cutting)
- `warp-notify/` — terminal transport (foundation)
- `preset/` — model presets (core-tools / session-lifecycle blur)
- `model-filter/` — model filtering (core-tools)

### Recommendation

- Move `notifications.ts`, `auto-compact/`, `dcp/` to a new `lifecycle/` or keep them in `session-lifecycle/` but document the scope
- Move `preset/` and `model-filter/` to `core-tools/` since they're model-related tools
- Consider `warp-notify/` as a shared utility → move to `shared/` or keep in `session-lifecycle/`

---

## 8. Duplicate Utility Functions

### Problem

Several utility functions are duplicated across the codebase:

| Function | Locations |
|----------|-----------|
| `isMacOS()` | `shared/notifications.ts`, duplicated elsewhere |
| Path building to `~/.pi/agent/settings.json` | `session-lifecycle/notifications.ts`, `pi-memory/src/index.ts`, `foundation/permission/permission.ts`, `core-tools/subagent/agents/agents.ts` |
| Settings file reading/parsing | Multiple inline implementations |
| Model lookup by name | `oracle.ts`, `ralph-loop/ralph-loop.ts`, `flicker-corp.ts`, `preset/index.ts` (each has a different lookup strategy) |
| Model picker TUI | `oracle.ts`, `compact-config.ts`, `preset/index.ts` |
| ANSI color code rendering | `ultrathink.ts`, `session-style.ts`, `flicker-corp.ts` |

---

## 9. Configuration Persistence Patterns

### Multiple State File Approaches

| Extension | State Storage | Format | Location |
|-----------|--------------|--------|----------|
| `session-style.ts` | JSON file | `session-color-state.json` | `~/.pi/` |
| `auto-compact/compact-config.ts` | JSON file | `compact-config.json` | `~/.pi/agent/` |
| `dcp/` | JSON file | Various | Config file + runtime |
| `skill-args/` | In-memory + pi session | Via `pi.getState()/setState()` | In-memory |
| `permission/` | JSON file | `allowed-commands.json` | `~/.pi/agent/` |

### Observation

State file locations are inconsistent — some go to `~/.pi/`, others to `~/.pi/agent/`. Different extensions use different file names with no naming convention.

### Recommendation

Standardize on:
- **Per-extension config**: `~/.pi/agent/extensions/<extension-name>/config.json`
- **Global state**: `~/.pi/agent/<extension-name>-state.json` (flat)
- Produce a **shared helper** in `shared/` for writing/reading extension state files

---

## 10. Adopted Plugin Wrappers

### Current State

The codebase has excellent infrastructure for wrapping npm packages:
- `shared/register-package.ts` — `registerAdoptedPackage()` helper
- `shared/lazy-package.ts` — `LazyModule<T>` for deferred imports
- `docs/adopted-plugins-inline-review.md` — detailed review of all 18 adopted plugins

### Unused Opportunity

Not all adopted plugins use these utilities consistently:
- `pi-formatter`: uses `LazyModule`
- `pi-crew`: uses `registerAdoptedPackage`
- `pi-memory`: uses `registerAdoptedPackage`
- `pi-stash`: direct default export import
- `pi-docparser`: direct default export import
- `pi-markdown-preview`: direct default export import
- `greedysearch-pi`: direct import

### Recommendation

Standardize all adopted plugin wrappers to use both `registerAdoptedPackage` + `LazyModule` together.

---

## 11. Implementation Plan

### Priority: P0 (High Impact, Low Effort)

| # | Task | Files | Effort | Risk |
|---|------|-------|--------|------|
| 1 | **Rename `shared/notifications.ts` → `shared/notify-utils.ts`** | `shared/notifications.ts`, `shared/index.ts`, `session-lifecycle/notifications.ts` | 15 min | None (mechanical rename) |
| 2 | **Rename `git-checkpoint-new/` → `git-checkpoint/`** | Directory + imports in `package.json` | 10 min | Update path in package.json |
| 3 | **Add naming convention doc** | `docs/conventions.md` | 20 min | None |
| 4 | **Standardize all kebab-case for file names** | Rename `safe-ops.ts` → `safe-ops.ts` (already ok), check others | 15 min | Low |

### Priority: P1 (High Impact, Medium Effort)

| # | Task | Files | Effort | Risk |
|---|------|-------|--------|------|
| 5 | **Consolidate config loading** — remove `shared/settings.ts`, add `loadConfigOrDefault` for notification config | `shared/settings.ts`, `shared/index.ts`, `session-lifecycle/notifications.ts` | 2 hrs | Medium — needs testing |
| 6 | **Extract shared model picker TUI** from `compact-config.ts`, `oracle.ts`, `preset/` | `shared/model-picker.ts` + 3 consumers | 3 hrs | Low — pure refactor |
| 7 | **Extract shared AI query helpers** (`ai-utils.ts`) from oracle, btw, speedreading | `core-tools/shared/ai-utils.ts` + 3 consumers | 4 hrs | Medium — behavioral |
| 8 | **Standardize state file paths** — shared helper in `shared/ext-state.ts` | New file + 5 consumers | 2 hrs | Low |

### Priority: P2 (Medium Impact, Medium Effort)

| # | Task | Files | Effort | Risk |
|---|------|-------|--------|------|
| 9 | **Rename `dcp/` → `context-pruning/`** | Directory + imports across codebase | 30 min | Low |
| 10 | **Unify adopted plugin wrappers** to use `registerAdoptedPackage` + `LazyModule` | 6 plugin wrapper files | 2 hrs | Low — standardize pattern |
| 11 | **Migrate inline `settingsManager` access** to `loadConfigOrDefault` | `session-style.ts`, `permission.ts` | 3 hrs | Medium — behavior change |
| 12 | **Extract funny messages** from `session-lifecycle/notifications.ts` | New `session-lifecycle/funny-messages.ts` | 1 hr | Low |

### Priority: P3 (Lower Impact)

| # | Task | Files | Effort | Risk |
|---|------|-------|--------|------|
| 13 | **Move `preset/` → `core-tools/`** | Directory move + package.json update | 30 min | Medium — path changes |
| 14 | **Move `model-filter/` → `core-tools/`** | Directory move + package.json update | 15 min | Low |
| 15 | **Rename `arcade/mario-not/` → `arcade/platformer/`** | Directory + imports | 1 hr | Low |
| 16 | **Add README to `dcp/` explaining abbreviation** | Doc | 15 min | None |

### Suggested Phasing

**Phase 1 — Quick Wins (P0 tasks 1-4):**
Mechanical renames and doc. No behavior changes. Can be done in one PR.

**Phase 2 — Configuration Consolidation (P1 tasks 5, 8):**
Unify all config/settings loading under `shared/pi-config.ts`. Remove `shared/settings.ts`. Add `shared/ext-state.ts`.

**Phase 3 — Shared Component Extraction (P1 tasks 6, 7):**
Extract model picker and AI query helpers. Refactor consumers.

**Phase 4 — Structural Cleanup (P2 tasks 9-11):**
Rename `dcp`, unify plugin wrappers, migrate inline settings access.

**Phase 5 — Directory Reorganization (P3 tasks 13-16):**
Move directories, rename games, add docs.

---

## Summary Statistics

| Category | Count | Details |
|----------|-------|---------|
| Settings loading patterns | 4 | `pi-config.ts`, `settings.ts`, `settingsManager`, inline `readFileSync` |
| Notification files | 5 | `shared/notifications.ts`, `shared/settings.ts`, `shared/types.ts`, `session-lifecycle/notifications.ts`, `session-lifecycle/warp-notify/` |
| Extension structure patterns | 3 | Direct factory, config-loaded factory, wrapped npm package |
| AI query implementations | 3 | `/oracle`, `/btw`, `speedreading` (different approaches, same concerns) |
| State file locations | 2 | `~/.pi/` vs `~/.pi/agent/` — inconsistent |
| Adopted plugin wrappers | 8+ | Only 2 use the shared wrapping pattern |

**Total actionable items: 16 tasks across P0-P3 priority**
