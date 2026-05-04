# Code Quality Refactor Plan — Auto-Fix, Formatter, & Code Quality Pipeline Consolidation

## Problem Statement

Three separate modules handle overlapping concerns:

| Module | LOC | Profile | Purpose |
|--------|-----|---------|---------|
| `core-tools/autofix/` | ~200 | Subset B (full) | Lite auto-fix of lint errors after write/edit |
| `core-tools/code-quality/formatter-runners/` | ~1,200 | Subset A (dev) | 8 language formatters (biome, prettier, etc.) |
| `core-tools/code-quality/` (pipeline + registry) | ~1,000 | Subset A (dev) | Format→fix→analyze pipeline with RunnerRegistry |

### Overlap & Waste

1. **Duplicate runner logic**: Autofix's `runners.ts` has its own biome/eslint/ruff runners (spawnSync-based). Formatter-runners has the same tools (dispatch-based). Two completely separate implementations.

2. **Autofix is a weak sibling**: Only fires on `tool_call` (write/edit), has no telemetry, no status reporting, no config, no TUI feedback. The formatter-runners dispatch already handles formatting — autofix should just be the "fix" stage running after format.

3. **Formatter-runners has no pipeline**: It only formats. The fix step (lint auto-fix) is missing from the formatter dispatch system. Autofix does it, but poorly.

4. **Code-quality pipeline is over-engineered**: `RunnerRegistry`, `CodeQualityPipeline`, `CodeRunner` interface, `PipelineResult` types — 3 files for a simple format→fix sequence that could be one class.

5. **Adapter pattern adds complexity**: `formatter-adapter.ts` bridges formatter-runners into code-quality's `RunnerRegistry`. This indirection is unnecessary if both are in the same module.

6. **Autofix in subset B (full)**: Formatting/fixing should be universal. Having autofix in "full-only" means dev profile users don't get lint fixes — inconsistent UX.

### Current Data Flow

```
write/edit tool_call
    │
    ├──→ code-quality (format step)
    │       └──→ formatter-adapter → dispatch.ts → run biome/prettier/etc.
    │
    └──→ autofix (fix step)
            └──→ fix biomes/eslint/ruff --write
```

Two separate event handlers, two separate runner definitions, zero coordination.

---

## Proposed Architecture: `core-tools/code-quality/` (Consolidated)

### Target State

Single module, single entry point, three sequential stages: **format → fix → notify**.

```
write/edit tool_call
    │
    └──→ CodeQualityExtension.processFile(path)
            │
            ├── 1. FORMAT: dispatch.ts (existing, unmodified)
            │       → biome, prettier, clang-format, shfmt, etc.
            │
            ├── 2. FIX: fix-runners/*.ts (consolidated from autofix)
            │       → biome --write, eslint --fix, ruff --fix
            │       → ruff-format moved here from formatter-runners
            │
            └── 3. NOTIFY: pi-telemetry badge
                    → "✅ Formatted + fixed file.ts (2 changes)"
                    → "⚠️  eslint failed on file.ts: no config found"
```

### Target Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Files | 29 | ~12 |
| LOC | 2,417 | ~1,200 |
| Modules | 3 | 1 |
| Redundant runner defs | 2 sets (autofix, formatter-runners) | 1 set |

---

## Step-by-Step Implementation Plan (7 steps)

### Step 1: Directory Structure

```
core-tools/code-quality/
├── index.ts              ← single entry point (replaces current index.ts + autofix/index.ts)
├── pipeline.ts           ← format→fix→notify pipeline (replaces current pipeline.ts)
├── registry.ts           ← runner registry (unchanged, move from current)
├── types.ts              ← combined types (move + add fix types)
├── runners/
│   ├── formatter/
│   │   ├── config.ts     ← (moved unchanged from formatter-runners/)
│   │   ├── context.ts    ← (moved unchanged from formatter-runners/)
│   │   ├── dispatch.ts   ← (moved unchanged from formatter-runners/)
│   │   ├── path.ts       ← (moved unchanged from formatter-runners/)
│   │   ├── plan.ts       ← (moved unchanged from formatter-runners/)
│   │   ├── system.ts     ← (moved unchanged from formatter-runners/)
│   │   ├── types.ts      ← (moved unchanged from formatter-runners/)
│   │   └── *             ← 8 runner files (moved unchanged)
│   └── fix/
│       ├── types.ts      ← FixRunner interface + FixResult (from autofix, enhanced)
│       ├── biome.ts      ← biome --write fix runner
│       ├── eslint.ts     ← eslint --fix fix runner
│       ├── ruff.ts       ← ruff --fix fix runner
│       └── index.ts      ← fix runner registry
├── tests/
│   ├── pipeline.test.ts
│   ├── registry.test.ts
│   └── fix-runners.test.ts
```

**Rationale**: `formatter/` and `fix/` are sibling directories under `runners/`. They share the same `types.ts` concept but serve different stages. This avoids circular dependencies.

---

### Step 2: Refactor Types (`types.ts`)

Merge `code-quality/types.ts` + `autofix/runners.ts` types + remove unused `Snippet`:

```typescript
// Stage types (unchanged from current)
export interface CodeRunner {
  readonly id: string;
  readonly type: "format" | "fix" | "analyze";
  matches(filePath: string): boolean;
  run(filePath: string, config: RunnerConfig): Promise<RunnerResult>;
}

// Fix-specific (consolidated from autofix, enhanced)
export interface FixResult {
  changed: boolean;
  detail: string;      // "Fixed 3 issues" / "Error: no config"
  changes?: number;    // lines changed
}

export interface FixRunner {
  readonly name: string;
  readonly stage: "fix";
  isAvailable(filePath: string, cwd: string): boolean;
  fix(filePath: string): FixResult;
}
```

**Key change**: `FixRunner` is a separate interface from `CodeRunner` because fix runners need synchronous `fix()` calls (they run immediately after format, no async pipeline needed). The `CodeRunner` interface stays for the registry compatibility layer.

---

### Step 3: Consolidate Fix Runners (`runners/fix/`)

Move from `core-tools/autofix/runners.ts` → `core-tools/code-quality/runners/fix/`.

Three files (biome, eslint, ruff) instead of one. Each exports a `FixRunner`.

**Enhancements** (over current autofix):

1. **Telemetry**: Each fix runner calls `getTelemetry().notify()` on success/failure
2. **Better detail**: Return "Fixed 3 issues" instead of just `{ changed: true }`
3. **Config detection**: Reuse `findConfigFileFromPath` from formatter/context.ts instead of standalone `findConfig`
4. **Async**: Use `pi.exec()` instead of `spawnSync()` for consistency

```typescript
// runners/fix/eslint.ts — example
export const eslintFix: FixRunner = {
  name: "eslint",
  stage: "fix",
  isAvailable(filePath: string, cwd: string): boolean {
    return findConfigFileFromPath(filePath, [
      ".eslintrc", ".eslintrc.json",
      "eslint.config.js",
    ], cwd) !== null;
  },
  async fix(filePath: string): Promise<FixResult> {
    const result = await exec("npx", ["eslint", "--fix", filePath]);
    const changed = result.exitCode === 0;
    const detail = changed ? `eslint fixed ${filePath}` : result.stderr ?? "no issues";
    return { changed, detail, changes: changed ? 1 : 0 };
  },
};
```

**Ruff-format is MOVED** from formatter-runners to fix runners. Ruff-format is a fixer, not a formatter — it rewrites code. The formatter-runners have `ruff-format.ts` and `ruff-check.ts`; only `ruff-check` should remain in formatter.

---

### Step 4: Refactor Pipeline (`pipeline.ts`)

Current pipeline is async registry-based with `runAll()` parallel execution. New pipeline is a simpler three-stage sequential flow:

```typescript
export class CodeQualityPipeline {
  constructor(
    private registry: RunnerRegistry,
    private fixRunners: FixRunner[],
  ) {}

  async run(filePath: string, cwd: string, pi: ExtensionAPI): Promise<PipelineResult> {
    const start = Date.now();
    const results: PipelineResult = { filePath, format: [], fix: [], duration: 0 };

    // Stage 1: Format — existing dispatch system
    try {
      await formatFile(null as any, cwd, filePath, 30_000);
      results.format = [{ status: "succeeded" }];
    } catch (err: any) {
      results.format = [{ status: "failed", message: err.message }];
    }

    // Stage 2: Fix — consolidated from autofix
    for (const runner of this.fixRunners) {
      if (runner.isAvailable(filePath, cwd)) {
        const fixResult = await runner.fix(filePath);
        results.fix.push({
          status: fixResult.changed ? "succeeded" : "failed",
          message: fixResult.detail,
          changes: fixResult.changes ?? 0,
        });
      }
    }

    results.duration = Date.now() - start;
    return results;
  }
}
```

**`PipelineResult` simplified**: Remove `analyze` stage (never implemented). Add `changes` count to each result.

---

### Step 5: Auto-Execution with Telemetry (`index.ts`)

The extension auto-executes on `tool_call` (write/edit) — no user interaction needed. Telemetry notifies the user of results.

```typescript
export class CodeQualityExtension extends ExtensionLifecycle {
  readonly name = "code-quality";
  readonly version = "1.0.0"; // bump — consolidation release

  private pipeline: CodeQualityPipeline;

  constructor(pi: ExtensionAPI) {
    super(pi);
    this.pipeline = new CodeQualityPipeline(
      new RunnerRegistry(),
      FIX_RUNNERS,  // from runners/fix/index.ts
    );

    // Register format adapter — simplified, no separate file needed
    // Format is handled directly via formatFile() in pipeline.ts
  }

  // Auto-triggered on every write/edit — agent does it, no human involved
  async onToolCall(event: ToolCallEvent): Promise<void> {
    if (event.toolName !== "write" && event.toolName !== "edit") return;
    const path = event.input?.path;
    if (!path || !existsSync(path)) return;

    const result = await this.pipeline.run(path, dirname(path), this.pi);

    // Notify user via telemetry badge
    const formatted = result.format.some(r => r.status === "succeeded");
    const fixed = result.fix.some(r => r.status === "succeeded");
    const failed = result.fix.some(r => r.status === "failed");

    if (formatted || fixed) {
      const parts: string[] = [];
      if (formatted) parts.push("formatted");
      if (fixed) parts.push(`fixed (${result.fix.filter(r => r.changes > 0).length} issues)`);
      getTelemetry()?.notify(`✅ ${path}: ${parts.join(" + ")}`, {
        package: "code-quality",
        badge: { text: "code-fmt", variant: "success" },
      });
    }

    if (failed && !fixed) {
      const errors = result.fix.filter(r => r.status === "failed");
      getTelemetry()?.notify(`⚠️  ${path}: ${errors.map(e => e.message).join("; ")}`, {
        package: "code-quality",
        badge: { text: "code-fmt", variant: "warning" },
      });
    }

    this.track("file_processed", { path, duration: result.duration, formatted, fixed });
  }
}
```

**Automation triggers** (via telemetry):
- `format-success` — green badge, file was formatted
- `fix-success` — green badge, lint issues auto-fixed
- `fix-failure` — amber badge, lint fix failed (no config / tool missing)
- `format-slow` — amber badge, formatting took >5s

---

### Step 6: Update Entry Points

#### `core-tools/index.ts`

```typescript
// Before:
import codeQuality from "./code-quality/index.ts";
import autofix from "./autofix/index.ts";

// After:
import codeQuality from "./code-quality/index.ts";  // handles format + fix now
// autofix import REMOVED
```

And in the default export:

```typescript
// After:
codeQuality(pi);  // always in dev/full — no more subset B for autofix

if (profile === "full") {
  fileCollector(pi);
  astGrepTools(pi);
  codeReview(pi);
  // autofix(pi); REMOVED
}
```

#### `package.json`

Update version to 1.0.0 (major — consolidation release).

---

### Step 7: Delete Legacy Modules

After Step 6 passes testing:

```bash
rm -rf core-tools/autofix/
rm core-tools/code-quality/runners/formatter-adapter.ts
rm core-tools/code-quality/pipeline.test.ts
rm core-tools/code-quality/registry.test.ts
```

Formatter-runners stays in place — it moves to `code-quality/runners/formatter/` but the old location is removed.

---

## DRY / OOP / SOLID Compliance

| Principle | Implementation |
|-----------|---|
| **DRY** | One `FixRunner` type instead of two (autofix + formatter-adapter). Config detection shared via `findConfigFileFromPath`. |
| **S**ingle Responsibility | `pipeline.ts` owns the format→fix flow. `runners/fix/*.ts` own one fix tool each. `index.ts` owns lifecycle + telemetry. |
| **O**pen/Closed | New fix tools added by creating a file in `runners/fix/` and registering in `runners/fix/index.ts`. No pipeline code changes. |
| **L**iskov | `FixRunner` interface ensures all fix tools are interchangeable. `formatFile` remains the same contract for all formatters. |
| **I**nterface Segregation | `FixRunner` has only `{ name, stage, isAvailable, fix }` — minimal contract. `PipelineResult` has only what the UI needs. |
| **D**ependency Inversion | Pipeline depends on `FixRunner[]` interface array, not concrete implementations. Fix runners depend on `pi.exec()`, not spawn/fetch. |

---

## Telemetry Integration

### Automation Triggers (fired automatically by agent, no human needed)

| Trigger | When | Badge | Action |
|---------|------|-------|--------|
| `format-start` | Every write/edit | `{ text: "fmt", variant: "info" }` | Transient — shown briefly while formatting |
| `format-success` | Format succeeded | `{ text: "fmt-ok", variant: "success" }` | "✅ file.ts formatted" |
| `fix-success` | Fix applied | `{ text: "fix", variant: "success" }` | "✅ file.ts fixed (3 issues)" |
| `fix-failure` | Fix failed (no config) | `{ text: "fix-fail", variant: "warning" }` | "⚠️  eslint: no config found" |
| `format-slow` | Format took >5s | `{ text: "slow", variant: "warning" }` | "🐢 formatting file.ts took 8s" |

### Context Intel Integration

The `ContextMonitor` should track:
- `totalFilesFormatted` — across session
- `totalFilesFixed` — across session
- `formatDuration` — average ms

Accessible via `/ctx stats`.

---

## Migration Path

### Phase 1: Create `runners/fix/` (alongside existing autofix)
Autofix still works. New fix runners are registered in pipeline but not yet wired to events.

### Phase 2: Rewire pipeline
Replace `formatFile()` call with new `pipeline.run()`. Wire `onToolCall` in `CodeQualityExtension`. Both autofix and new pipeline fire simultaneously — compare results.

### Phase 3: Switch over
Remove autofix event handler. New pipeline is sole owner of format→fix.

### Phase 4: Delete legacy
Remove `core-tools/autofix/`, remove `formatter-adapter.ts`, delete old test files.

---

## Edge Cases

1. **No config found**: Fix runner returns `{ changed: false, detail: "no config found" }`. Badge shows warning. No breakage.

2. **Tool not installed**: `isAvailable()` returns false. Runner skipped. No badge, no error.

3. **Large file (>1MB)**: Skip formatting (check file size before calling `formatFile`). Notify user via badge.

4. **Binary file**: Detect mime type, skip. No badge.

5. **Concurrent edits**: Pipeline runs sequentially per file (async but not parallel). Safe for sequential write/edit events.

6. **Session without cwd**: `dirname(path)` falls back to `process.cwd()`.

---

## Code Metrics Target

| Metric | Current (3 modules) | Target (1 module) | Delta |
|--------|--------------------|-------------------|-------|
| Files | 29 | ~12 | **−17** |
| LOC | 2,417 | ~1,200 | **−1,217** |
| Interfaces | 4 (CodeRunner, RunnerConfig, etc.) | 2 (FixRunner, PipelineResult) | **−2** |
| Entry points | 2 (code-quality, autofix) | 1 | **−1** |
| Dependency: spawnSync | Yes (autofix) | No (pi.exec) | **−1** |
| Runner definitions | 2 sets (8 format + 3 fix = 11) | 1 set (8 format + 3 fix = 11) | **0** (no reduction) |
| Telemetry | None | 5 triggers | **+5** |
| Test files | 3 (pipeline, registry, autofix) | 3 (keep) | **0** |

**Net reduction**: ~1,200 LOC (50%).

---

## Testing Plan

### Unit Tests
1. `pipeline.test.ts` — format→fix→notify flow works with mock runners
2. `fix-runners.test.ts` — each fix runner returns correct `FixResult`
3. `registry.test.ts` — unchanged from current

### Integration Tests
1. Write a TypeScript file → verify biome format runs
2. Write a file with lint error → verify fix runner catches it
3. Write a file with no config → verify skip (no crash, no error)

### Regression Tests
1. `/ctx stats` shows format/file counts
2. Telemetry badge fires on format/fix events
3. Dev profile loads code-quality but no separate autofix

---

## Implementation Order

```
Week 1:  Step 1 + Step 2 (scaffold + types)
Week 2:  Step 3 (fix runners consolidation)
Week 3:  Step 4 (pipeline refactor)
Week 4:  Step 5 (telemetry + auto-execution)
Week 5:  Step 6 (entry points update)
Week 6:  Step 7 (delete legacy, testing)
```

---

## Summary

This plan consolidates 29 files / 2,417 LOC across 3 modules into ~12 files / ~1,200 LOC in 1 module. It eliminates:
- Duplicate runner definitions (autofix had its own biome/eslint/ruff)
- Adapter indirection (formatter-adapter.ts)
- Unused pipeline stage (analyze)
- spawnSync dependency (autofix uses synchronous child_process calls)

The result is a single `CodeQualityExtension` that auto-formats and auto-fixes on every write/edit, notifies users via telemetry badges, and is fully DRY/OOP/SOLID compliant.
