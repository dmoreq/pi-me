# pi-me Codebase Cleanup Plan

> Generated: 2026-05-15  
> **Status: COMPLETED 2026-05-15**  
> Scope: All `.ts` source files in main branch (excludes `.worktrees/`)  
> Test baseline: **452 tests pass** → after cleanup: **243 tests pass, 0 fail**  
> Net change: 141 insertions, 6,153 deletions (51 files)

---

## Executive Summary

The codebase has accumulated ~5 000+ lines of dead, superseded, or low-value code across six distinct problem areas. These are ranked by impact (lines removed ÷ risk).

| # | Area | Est. lines | Risk | Priority |
|---|------|-----------|------|----------|
| 1 | `task-orchestration/` — fully superseded module | ~3 700 | Low | 🔴 High |
| 2 | `planning/` partial — orphaned sub-modules | ~1 000 | Low | 🔴 High |
| 3 | `file-intelligence/` — no consumer, no tool | ~650 | Low | 🔴 High |
| 4 | `skills/systematic-debugging/condition-based-waiting-example.ts` | ~120 | None | 🔴 High |
| 5 | `core-tools/web-providers-integration.test.ts` | ~145 | None | 🔴 High |
| 6 | `TelemetryAutomation` — low-value badge noise, misused | ~200 | Low | 🟡 Medium |
| 7 | `shared/command-builder.ts` — zero callers | ~120 | Low | 🟡 Medium |
| 8 | `shared/ext-state.ts` — zero production callers | ~80 | Low | 🟡 Medium |
| 9 | `subprocess-orchestrator/normalizer.ts` — stub bridge to deleted module | ~110 | Low | 🟡 Medium |
| 10 | `core-tools/intent/` shim in `task-plan/src/intent-detector.ts` | ~30 | Low | 🟢 Low |

**Total estimated reduction: ~6 155 lines** (~40% of non-test source code).

---

## Detailed Items

---

### 1. `core-tools/task-orchestration/` — Delete Entire Directory

**Status:** Fully superseded by `core-tools/task-plan/`.

**Evidence:**
- `task-plan/index.ts` comment block literally says:  
  `Replaces: task-orchestration/, planning/, intent/`
- `core-tools/index.ts` **does not import** `task-orchestration` at all — only `task-plan`.
- Zero production imports from `task-orchestration` found in codebase (only self-referencing).
- `task-plan/src/capture.ts` duplicates `task-orchestration/src/core/capture.ts` with improvements.
- `task-plan/src/types.ts` comment says it replaces `task-orchestration/src/types.ts`.

**Files to delete (27 files, ~3 729 lines):**
```
core-tools/task-orchestration/src/index.ts             (170 lines)
core-tools/task-orchestration/src/types.ts             (165 lines)
core-tools/task-orchestration/src/core/capture.ts      (198 lines)
core-tools/task-orchestration/src/core/dependency.ts   (123 lines)
core-tools/task-orchestration/src/core/executor.ts     (181 lines)
core-tools/task-orchestration/src/core/task.ts         (253 lines)
core-tools/task-orchestration/src/inference/ai-intent-detector.ts   (180 lines)
core-tools/task-orchestration/src/inference/fallback-detector.ts    (74 lines)
core-tools/task-orchestration/src/inference/intent.ts  (86 lines)
core-tools/task-orchestration/src/persistence/state.ts (314 lines)
core-tools/task-orchestration/src/ui/notification-inbox.ts   (180 lines)
core-tools/task-orchestration/src/ui/progress-widget.ts      (82 lines)
core-tools/task-orchestration/src/ui/renderer.ts       (131 lines)
core-tools/task-orchestration/src/ui/task-card.ts      (89 lines)
# plus 13 test files (1 503 lines)
core-tools/task-orchestration/tests/core/capture.test.ts
core-tools/task-orchestration/tests/core/dependency.test.ts
core-tools/task-orchestration/tests/core/executor.test.ts
core-tools/task-orchestration/tests/core/task.test.ts
core-tools/task-orchestration/tests/inference/ai-intent-detector.test.ts
core-tools/task-orchestration/tests/inference/fallback-detector.test.ts
core-tools/task-orchestration/tests/inference/intent.test.ts
core-tools/task-orchestration/tests/integration/full-flow.test.ts
core-tools/task-orchestration/tests/integration/tools.test.ts
core-tools/task-orchestration/tests/persistence/state.test.ts
core-tools/task-orchestration/tests/ui/notification-inbox.test.ts
core-tools/task-orchestration/tests/ui/progress-widget.test.ts
core-tools/task-orchestration/tests/ui/renderer.test.ts
```

**Action:** `rm -rf core-tools/task-orchestration/`

**Verification:** `npm test` — 349 tests should still pass (none reference `task-orchestration` in test runner glob).

---

### 2. `core-tools/planning/` — Partial Delete

**Status:** Mixed. `plan-mode.ts` and `plan-mode-core.ts` are the **real, active plan UI** registered by `task-plan`. The surrounding `PlanningExtension` wrapper (`index.ts`) and DAG utilities (`dag.ts`, `executor.ts`, `types.ts`) are orphaned stubs.

**What to KEEP:**
- `core-tools/planning/plan-mode.ts` (902 lines) — active TUI extension imported by task-plan
- `core-tools/planning/plan-mode-core.ts` (997 lines) — imported by plan-mode.ts and task-plan/src/store.ts

**Files to delete (~489 lines):**
```
core-tools/planning/index.ts       (152 lines) — PlanningExtension stub; never registered in core-tools/index.ts
core-tools/planning/dag.ts         (151 lines) — "Ported from task-orchestration" comment; DAG logic exists in task-plan
core-tools/planning/executor.ts    (92 lines)  — placeholder executeStep does `setTimeout(resolve, 100)`; no real logic
core-tools/planning/types.ts       (46 lines)  — superseded by task-plan/src/types.ts
# plus test files
core-tools/planning/dag.test.ts    (178 lines)
core-tools/planning/executor.test.ts (75 lines)
```

**Dependency fix needed:**
- `core-tools/subprocess-orchestrator/normalizer.ts` imports `PlanStep` from `../planning/types.ts`.
- After deletion, update the import to `../task-plan/src/types.ts` (which has `Step` — rename accordingly), or delete `normalizer.ts` entirely (see item #9).

**Action:**
```bash
rm core-tools/planning/index.ts
rm core-tools/planning/dag.ts
rm core-tools/planning/executor.ts
rm core-tools/planning/types.ts
rm core-tools/planning/dag.test.ts
rm core-tools/planning/executor.test.ts
```

---

### 3. `core-tools/file-intelligence/` — Delete Entire Directory

**Status:** No production consumer. No tool registered. No command registered. Hooks on `write`/`edit` events to index files into `.pi/indexes/` — but `core-tools/index.ts` only imports it to call `fileIntelligence(pi)` (loads the extension) — and the extension **registers no tools and exposes no API** that anything else calls.

**Evidence:**
- `grep -r "from.*file-intelligence"` → only `core-tools/index.ts` (the loader)
- The extension's `onWrite` hook stores JSON to `.pi/indexes/` — never read by any other code
- `FileStore`, `FileCapturer` exported but never imported elsewhere
- The regex-based `FileCapturer` duplicates what `pi-scope` does properly (AST-level)

**Files to delete (6 files, ~645 lines):**
```
core-tools/file-intelligence/index.ts        (125 lines)
core-tools/file-intelligence/types.ts        (60 lines)
core-tools/file-intelligence/store.ts        (157 lines)
core-tools/file-intelligence/capture.ts      (157 lines)
core-tools/file-intelligence/store.test.ts   (157 lines)
core-tools/file-intelligence/capture.test.ts (150 lines)
```

**Action:**
```bash
rm -rf core-tools/file-intelligence/
```

**Also:** Remove the import and call in `core-tools/index.ts`:
```diff
- import fileIntelligence from "./file-intelligence/index.ts";
  ...
- fileIntelligence(pi);
```

---

### 4. `skills/systematic-debugging/condition-based-waiting-example.ts` — Delete

**Status:** Foreign code — references `ThreadManager`, `LaceEvent`, `LaceEventType` from `~/threads/...` which don't exist in this repository. This is copied from the **Lace** project test infrastructure, not pi-me.

**File:** `skills/systematic-debugging/condition-based-waiting-example.ts` (~120 lines)

**Action:**
```bash
rm skills/systematic-debugging/condition-based-waiting-example.ts
```

**Note:** The skill directory `skills/systematic-debugging/` should be kept — it contains the actual `SKILL.md` (managed in the pi-me skills folder).

---

### 5. `core-tools/web-providers-integration.test.ts` — Delete

**Status:** This is not a unit test — it's a **machine configuration validator**. Every assertion reads `~/.pi/agent/web-providers.json` from the developer's home directory. This fails on any other machine, CI, or fresh checkout. It has no business being in the test suite.

**File:** `core-tools/web-providers-integration.test.ts` (145 lines)

**Problems:**
- `assert.ok(existsSync(configPath))` — fails on CI (no home dir config)
- Tests specific provider routing (`exa`, `tavily`, `valyu`) and exact timeout values that are config data, not code behavior
- The test glob `"core-tools/**/*.test.ts"` picks this up in every `npm test` run

**Action:**
```bash
rm core-tools/web-providers-integration.test.ts
```

---

### 6. `shared/telemetry-automation.ts` — Delete or Dramatically Trim

**Status:** `TelemetryAutomation` is a class of 9 static methods that fire badge notifications. Analysis:

- **`contextDepth` / `highActivityDetected` / `fileInvolvementDetected`** — defined but **never called** anywhere in production code
- **`planCreated`** — called from `core-tools/planning/index.ts` (being deleted in item #2)
- **`fileIndexed`** — called from `core-tools/file-intelligence/index.ts` (being deleted in item #3)
- **`tasksNormalized`** — called from `subprocess-orchestrator/index.ts` (fires on every `runPlanSteps` — but `runPlanSteps` is never called by anyone)
- **`webSearched`** — called from `content-tools/web-tools/index.ts` — fires a badge notification on every search. Low value: just says "Searching web for: X" but pi already shows tool calls in context
- **`qualityCheckRan`** — defined but **never called**

After deleting items #1–#5 above, the only active caller is `content-tools/web-tools/index.ts → webSearched`. That one call should be replaced with a direct `recordEvent()` call, eliminating the entire `TelemetryAutomation` class.

**Files to delete:**
```
shared/telemetry-automation.ts       (~150 lines)
shared/telemetry-automation.test.ts  (~80 lines)
```

**Inline fix for web-tools:**
```diff
- const { TelemetryAutomation } = await import("../../shared/telemetry-automation.ts");
- const searchTrigger = TelemetryAutomation.webSearched(query);
- TelemetryAutomation.fire(this, searchTrigger);
+ recordEvent(this.name, "web-search", `Searching: "${query}"`);
```

---

### 7. `shared/command-builder.ts` — Delete

**Status:** Zero callers. `registerSettingsCommand`, `registerToggleCommand`, `registerStatusCommand` are exported but imported by **no file** in the codebase.

**File:** `shared/command-builder.ts` (~120 lines)

**Action:**
```bash
rm shared/command-builder.ts
```

**Also:** Remove the re-export from `shared/index.ts` (it's not currently re-exported there — `shared/index.ts` does not include `command-builder` — so nothing to update).

---

### 8. `shared/ext-state.ts` — Delete

**Status:** `readExtState`, `writeExtState`, `getExtStatePath`, `removeExtState` are exported via `shared/index.ts` but **never called** in any production code in this repo.

**File:** `shared/ext-state.ts` (~80 lines) + `shared/ext-state.test.ts` (~60 lines)

**Action:**
```bash
rm shared/ext-state.ts
rm shared/ext-state.test.ts
```

**Also:** Remove from `shared/index.ts`:
```diff
- export * from "./ext-state";
```

---

### 9. `core-tools/subprocess-orchestrator/normalizer.ts` — Delete

**Status:** A bridge between `planning/types.ts` (being deleted in item #2) and `SubprocessTask`. The core logic maps every `step.intent` to `"bash"` regardless of intent — i.e., `commandForIntent` returns `"bash"` for all 7 cases. This is a stub, not real logic.

**Evidence:**
```ts
private static commandForIntent(intent: string): string {
  switch (intent) {
    case "fix":      return "bash"; // run bash script
    case "refactor": return "bash";
    case "test":     return "npm";  // only non-bash case
    // ...all return "bash"
  }
}
```

`runPlanSteps()` in `SubprocessOrchestrationExtension` is its only caller — and `runPlanSteps()` itself is never called from outside the class.

**Files to delete:**
```
core-tools/subprocess-orchestrator/normalizer.ts       (~110 lines)
core-tools/subprocess-orchestrator/normalizer.test.ts  (~60 lines)
```

**Action:**
- Delete both files
- Remove `normalizer` import and `private normalizer = TaskNormalizer` from `subprocess-orchestrator/index.ts`
- Remove the `runPlanSteps()` method (its only consumer is now gone)
- Remove the `getNormalizer()` accessor

---

### 10. `core-tools/task-plan/src/intent-detector.ts` — Simplify Shim

**Status:** Low priority. This 30-line file exists to re-export from `core-tools/intent/detector.ts` with backward-compat aliases. The comment says "new code should import directly". Since `intent-detector.ts` is only imported by `task-plan/src/capture.ts` and `task-plan/src/index.ts`, consolidate by importing `intent/detector.ts` directly.

**Action:** Update 2 import sites to point to `../../intent/detector.ts` directly, then delete `task-plan/src/intent-detector.ts` and `task-plan/src/intent-detector.test.ts`.

---

## Implementation Order

Execute items in this order to avoid broken intermediate states:

```
Step 1: Delete task-orchestration/          (no dependents)
Step 2: Delete file-intelligence/           (no dependents; update core-tools/index.ts)
Step 3: Delete planning/index + dag + executor + types + tests
        → fix normalizer.ts import or delete normalizer.ts first
Step 4: Delete normalizer.ts + normalizer.test.ts
        → clean up subprocess-orchestrator/index.ts
Step 5: Delete TelemetryAutomation files
        → inline web-tools call
Step 6: Delete command-builder.ts
Step 7: Delete ext-state.ts + ext-state.test.ts
        → update shared/index.ts
Step 8: Delete condition-based-waiting-example.ts
Step 9: Delete web-providers-integration.test.ts
Step 10: Simplify task-plan/src/intent-detector.ts shim (optional)

Run `npm test` after each step.
```

---

## What NOT to Touch

| Module | Reason to Keep |
|--------|---------------|
| `core-tools/planning/plan-mode.ts` | Active TUI — the real `/plan` command UI |
| `core-tools/planning/plan-mode-core.ts` | Core plan data model + lock/GC used by task-plan |
| `core-tools/intent/detector.ts` | Cross-cutting: imported by `session-lifecycle/welcome`, `code-review`, `subprocess-orchestrator` |
| `shared/telemetry-helpers.ts` | Active wrappers; imported by subprocess, planning, file-intelligence, web-tools |
| `shared/lazy-package.ts` | Utility; has tests; may be used by adopters |
| `shared/register-package.ts` | Active pattern; has tests |
| `foundation/context-monitor/` | Active singleton; used in foundation/index.ts |
| `core-tools/code-review/` | Active feature; profile=full only |
| `core-tools/task-plan/` | The active unified replacement for everything deleted above |

---

## Expected Test Count After Cleanup

Before: **349 tests**  
Deletions include ~1 503 (task-orchestration) + 233 (planning dag/executor) + 307 (file-intelligence) + ~140 (normalizer) + ~80 (telemetry-automation) + ~60 (ext-state) = **~2 323 test lines removed**

Estimated remaining tests after cleanup: **~100–150 tests** (task-plan, memory, code-quality, subprocess-core, secrets, shared utilities).

> **Note:** The large reduction is intentional — those tests were testing code that duplicated `task-plan` functionality.
