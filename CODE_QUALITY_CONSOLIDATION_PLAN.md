# Code Quality Consolidation Plan — Auto-Formatter, Auto-Fix, & Code Quality Pipeline

## Executive Summary

Consolidate 3 separate, overlapping modules + **8 auto-formatters** into 1 unified Code Quality extension:

**Modules to consolidate:**
- `core-tools/autofix/` (200 LOC) — standalone lint auto-fix runners
- `core-tools/code-quality/` (1,000 LOC) — pipeline + registry infrastructure
- `core-tools/code-quality/formatter-runners/` (1,200 LOC) — **8 auto-formatters**

**8 Auto-Formatters Retained & Unified:**
1. **Biome** — JavaScript, TypeScript, JSON
2. **Prettier** — JavaScript, TypeScript, CSS, YAML, TOML
3. **ESLint** — JavaScript, TypeScript
4. **Ruff Format** — Python
5. **Clang-Format** — C, C++, Objective-C
6. **ShFmt** — Bash, Shell
7. **CMake-Format** — CMake
8. **MarkdownLint** — Markdown

**3 Auto-Fix Runners Consolidated:**
1. **Biome** — biome check --write
2. **ESLint** — eslint --fix
3. **Ruff** — ruff check --fix (Python)

**Result**: Single unified module, 27 files → 12 files, 2,417 LOC → 1,200 LOC (50% reduction), zero duplicate runner definitions, **full telemetry integration for both auto-formatting AND auto-fixing**.

---

## Problem Analysis

### Current State (3 Modules + 8 Formatters)

```
core-tools/
├── autofix/
│   ├── index.ts           ← listens on tool_call (write/edit)
│   └── runners.ts         ← biome, eslint, ruff fix runners
│
└── code-quality/
    ├── index.ts           ← CodeQualityExtension
    ├── pipeline.ts        ← format→fix→analyze pipeline
    ├── registry.ts        ← RunnerRegistry (Open/Closed pattern)
    ├── types.ts           ← CodeRunner, PipelineResult interfaces
    ├── runners/
    │   └── formatter-adapter.ts ← bridges formatter-runners into pipeline
    └── formatter-runners/ (21 files)
        ├── config.ts      ← config file discovery
        ├── context.ts     ← FormatRunContext
        ├── dispatch.ts    ← format file orchestration
        ├── path.ts        ← path utilities
        ├── plan.ts        ← format plan by language
        ├── system.ts      ← system command detection
        ├── types.ts       ← FormatterDefinition, etc.
        └── runners/       (8 formatters)
            ├── biome.ts
            ├── clang-format.ts
            ├── cmake-format.ts
            ├── eslint.ts
            ├── markdownlint.ts
            ├── prettier.ts
            ├── ruff-format.ts
            ├── ruff-check.ts
            ├── shfmt.ts
            ├── helpers.ts
            ├── config-patterns.ts
            └── index.ts
```

### Issues

#### 1. Duplicate Runner Logic (DRY violation)

**Autofix runners** (`core-tools/autofix/runners.ts`):
```typescript
const biomeFix: FixRunner = {
  isAvailable(dir) { return findConfig(dir, ["biome.json"]) !== null; },
  fix(filePath) {
    const result = spawnSync("biome", ["check", "--write", "--unsafe", filePath]);
    return { changed: result.stdout.includes("Fixed"), error: ... };
  }
};
```

**Same tools in formatter-runners** (`core-tools/code-quality/formatter-runners/runners/`):
- Separate biome.ts (format only, no fix logic)
- Separate eslint.ts (format only, no fix logic)
- Separate ruff-format.ts (format only, no fix logic)
- Plus 5 others (clang-format, shfmt, cmake-format, markdownlint, ruff-check)

**Problem**: 
- **Two implementations of "run biome"** — one for fix (in autofix), one for format (in formatter-runners). They don't share config detection, error handling, or telemetry.
- **3 fix runners hardcoded in autofix**: biome, eslint, ruff. Adding a new fix tool requires editing autofix/runners.ts.
- **8 formatters hardcoded in formatter-runners**: Adding a new formatter requires editing formatter-runners/plan.ts + adding new runner file.

Adding support for a new tool (e.g., Deno fmt) requires:
1. Add to `formatter-runners/runners/deno.ts` + `formatter-runners/plan.ts`
2. Add to `autofix/runners.ts` (if Deno supports --fix)
3. Update both systems separately, no shared infrastructure

---

#### 2. Adapter Indirection (OCP anti-pattern)

Current flow:
```
CodeQualityPipeline
  → registry.getForFile(filePath, "format")
    → formatAdapter (FixRunner → CodeRunner bridge)
      → formatFile(cwd, filePath)
        → dispatch.ts
          → format-plan[kind]
            → run biome/prettier/etc.
```

`formatter-adapter.ts` is a shim that bridges two incompatible systems:
- `formatter-runners/` works with `formatFile()` async function
- `code-quality/` expects `CodeRunner` interface with `matches()` + `run()`

If we want to add a new formatter, it needs to:
1. Be added to `formatter-runners/runners/` directory
2. Be added to `formatter-runners/plan.ts` format-plan mapping
3. Be automatically picked up by `formatAdapter` (which just delegates anyway)

The adapter is ceremonial — it adds no value, only indirection.

---

#### 3. Unused Pipeline Stage (ISP violation)

`PipelineResult`:
```typescript
interface PipelineResult {
  filePath: string;
  format: RunnerResult[];   // USED
  fix: RunnerResult[];      // USED
  analyze: RunnerResult[];  // NEVER USED
  duration: number;
}
```

`analyze` was planned but never implemented. Every consumer ignores it:
```typescript
const result = await pipeline.processFile(filePath, cwd, exec);
// result.analyze is never read
```

This bloats the interface and confuses the mental model.

---

#### 4. Formatters & Fixers in Different Profiles (Inconsistency)

Formatters and fixers are loaded inconsistently:
- `dev` profile: gets **8 auto-formatters** (via code-quality in subset A)
- `dev` profile: does NOT get **3 auto-fix runners** (autofix in subset B)
- `full` profile: gets both formatters and fixers

Result: `dev` users get code **formatted automatically** but NOT **fixed automatically**. If a tool fixes lints (eslint --fix), only full profile users benefit. Inconsistent UX.

---

#### 5. No Telemetry (Silent Automation)

Neither autofix nor formatter-runners notifies the user when they run:
- **8 auto-formatters run silently** on every write/edit — user doesn't know if formatting succeeded
- **3 auto-fix runners run silently** on every write/edit — user doesn't know if lints were fixed
- No notification on failure (e.g., "eslint failed: missing .eslintrc")
- No tracking of "formatted 42 files this session" or "fixed 156 linting issues this session"

The context-intel system uses telemetry badges for auto-execution feedback. Code quality should too — users should see:
- ✅ "file.ts formatted" (prettier ran)
- ✅ "file.ts fixed (3 linting issues)" (eslint --fix applied)
- ⚠️ "file.ts format failed: timeout" (prettier hung)

---

#### 6. No Configuration (Magic Numbers & Hidden Logic)

**Timeouts scattered**:
- Autofix: `timeout: 15_000` ms (biome, eslint, ruff)
- Pipeline: `timeoutMs: 30_000` default
- Formatter-runners: varies per runner

**8 formatters have hardcoded behavior**:
- No way to configure which formatters to skip
- No way to set per-language timeouts
- No way to skip large files (>5MB) without waiting 30s
- No way to skip binary files
- No way to enable/disable specific formatters by language

**3 fix runners have no config**:
- No way to set which linters can auto-fix
- No way to skip fix for specific file types
- No cooldown between consecutive fixes

---

## Proposed Solution: Unified Code Quality Module

### Target Structure

**Single entry point. 8 Auto-Formatters + 3 Auto-Fixers + Unified Pipeline + Telemetry:**

```
core-tools/code-quality/
├── index.ts                      ← single entry point
├── extension.ts                  ← CodeQualityExtension (auto-format + auto-fix on write/edit)
├── types.ts                      ← unified types (FixRunner + CodeRunner, remove unused analyze)
├── config.ts                     ← configuration schema (new: timeouts, skip-large-files, enabled formatters)
├── pipeline.ts                   ← AUTO-FORMAT → AUTO-FIX → NOTIFY (unified 3-stage)
├── runners/
│   ├── registry.ts               ← unified runner registry (both formatters + fixers)
│   ├── types.ts                  ← shared runner interfaces
│   ├── formatter/                ← 8 AUTO-FORMATTERS (all retained, unchanged logic)
│   │   ├── dispatch.ts           ← format orchestration (moved, unchanged)
│   │   ├── context.ts            ← format run context (moved, unchanged)
│   │   ├── path.ts               ← path utilities (moved, unchanged)
│   │   ├── plan.ts               ← format plan by language (moved, unchanged)
│   │   ├── config.ts             ← config discovery (moved, unchanged)
│   │   ├── system.ts             ← system command checks (moved, unchanged)
│   │   ├── types.ts              ← formatter types (moved, unchanged)
│   │   └── runners/              ← 8 formatters (moved, unchanged)
│   │       ├── biome.ts          ← ✅ AUTO-FORMAT: JS/TS/JSON
│   │       ├── prettier.ts       ← ✅ AUTO-FORMAT: JS/TS/CSS/YAML
│   │       ├── eslint.ts         ← ✅ AUTO-FORMAT: JS/TS
│   │       ├── ruff-format.ts    ← ✅ AUTO-FORMAT: Python
│   │       ├── clang-format.ts   ← ✅ AUTO-FORMAT: C/C++/Objective-C
│   │       ├── shfmt.ts          ← ✅ AUTO-FORMAT: Bash/Shell
│   │       ├── cmake-format.ts   ← ✅ AUTO-FORMAT: CMake
│   │       ├── markdownlint.ts   ← ✅ AUTO-FORMAT: Markdown
│   │       ├── helpers.ts
│   │       ├── config-patterns.ts
│   │       └── index.ts
│   └── fix/                      ← 3 AUTO-FIX RUNNERS (consolidated from autofix/)
│       ├── types.ts              ← FixRunner interface
│       ├── biome.ts              ← ✅ AUTO-FIX: biome check --write
│       ├── eslint.ts             ← ✅ AUTO-FIX: eslint --fix
│       ├── ruff.ts               ← ✅ AUTO-FIX: ruff check --fix (Python)
│       └── index.ts              ← export FIX_RUNNERS array
├── telemetry/
│   ├── triggers.ts               ← automation triggers (4 badges: format-success, fix-success, format-failure, fix-failure)
│   └── types.ts                  ← trigger interfaces
└── tests/
    ├── pipeline.test.ts
    ├── fix-runners.test.ts
    ├── formatter-dispatch.test.ts
    └── telemetry.test.ts
```

**Rationale**:
- **`runners/formatter/`** — all 8 auto-formatters grouped together, just moved up one level from formatter-runners/, logic unchanged
- **`runners/fix/`** — all 3 auto-fix runners consolidated from autofix/, same directory structure as formatters
- **`runners/registry.ts`** — unified registry serves both 8 formatters AND 3 fixers (Open/Closed principle: add new runners without editing core)
- **`extension.ts`** — orchestrates: on write/edit, run pipeline which stages: auto-format → auto-fix → notify user
- **`telemetry/`** — new, fires pi-telemetry badges on format success/failure, fix success/failure
- **Single `pipeline.ts`** — orchestrates 3-stage sequence (format → fix → notify) with zero duplication

---

## Implementation (7 Steps)

### Step 1: Extract Fix Runners to `runners/fix/`

**Move from** `core-tools/autofix/runners.ts` **to** `core-tools/code-quality/runners/fix/`:

```typescript
// runners/fix/types.ts
export interface FixRunner {
  readonly name: string;
  isAvailable(filePath: string, cwd: string): boolean;
  fix(filePath: string, timeoutMs: number): Promise<FixResult>;
}

export interface FixResult {
  status: "succeeded" | "failed" | "skipped";
  detail: string;      // "Fixed 3 issues" / "Error: no config"
  changes?: number;    // number of fixes applied
}
```

```typescript
// runners/fix/biome.ts
import { spawnSync } from "node:child_process";
import { findConfigFileFromPath } from "../formatter/config.ts";

export const biomeFix: FixRunner = {
  name: "biome",
  isAvailable(filePath: string, cwd: string): boolean {
    return findConfigFileFromPath(filePath, ["biome.json", "biome.jsonc"], cwd) !== null;
  },
  async fix(filePath: string, timeoutMs: number): Promise<FixResult> {
    try {
      const result = spawnSync("biome", ["check", "--write", "--unsafe", filePath], {
        encoding: "utf-8",
        timeout: timeoutMs,
      });
      if (result.status === 0 && result.stdout?.includes("Fixed")) {
        return { status: "succeeded", detail: "Fixed", changes: 1 };
      }
      return { status: "failed", detail: result.stderr ?? "Failed" };
    } catch (err: any) {
      return { status: "failed", detail: err.message };
    }
  },
};

// Same for eslint.ts, ruff.ts
```

```typescript
// runners/fix/index.ts
export const FIX_RUNNERS: readonly FixRunner[] = [biomeFix, eslintFix, ruffFix];
```

**Benefits**:
- Fix runners are now in the same `runners/` tree as formatters
- Share `findConfigFileFromPath` from formatter utilities
- Async `fix()` method matches the pipeline's async execution model

---

### Step 2: Create Unified `runners/registry.ts`

**Move from** `core-tools/code-quality/registry.ts` **to** `core-tools/code-quality/runners/registry.ts`:

The current `RunnerRegistry` already supports the `Open/Closed` principle. No changes needed to the registry — it works for both formatters and fixers.

```typescript
// runners/registry.ts (from current code-quality/registry.ts, unchanged)
export class RunnerRegistry {
  private runners = new Map<string, CodeRunner>();

  register(runner: CodeRunner): this { /* ... */ }
  get(id: string): CodeRunner | undefined { /* ... */ }
  getForFile(filePath: string, type: "format" | "fix"): CodeRunner[] { /* ... */ }
  list(): CodeRunner[] { /* ... */ }
}
```

---

### Step 3: Refactor `pipeline.ts` (Core Consolidation)

**Location**: `core-tools/code-quality/pipeline.ts`

**Current pipeline** is async, registry-based, complex with `runAll()` parallel execution and unused `analyze` stage.

**New pipeline** is simpler: format → fix → notify.

```typescript
// pipeline.ts
import type { FixRunner } from "./runners/fix/types.ts";
import type { CodeRunner } from "./types.ts";
import { formatFile } from "./runners/formatter/dispatch.ts";
import { getTelemetry } from "pi-telemetry";

export interface StageResult {
  status: "succeeded" | "failed" | "skipped";
  message?: string;
  changes?: number;
}

export interface ProcessResult {
  filePath: string;
  format: StageResult;
  fix: StageResult;
  duration: number; // ms
}

export class CodeQualityPipeline {
  constructor(
    private fixRunners: FixRunner[],
    private timeoutMs: number = 30_000,
  ) {}

  async run(filePath: string, cwd: string, pi: ExtensionAPI): Promise<ProcessResult> {
    const start = Date.now();
    const results: ProcessResult = {
      filePath,
      format: { status: "skipped" },
      fix: { status: "skipped" },
      duration: 0,
    };

    // Stage 1: Format
    try {
      await formatFile(pi, cwd, filePath, this.timeoutMs);
      results.format = { status: "succeeded", message: "Formatted" };
    } catch (err: any) {
      results.format = { status: "failed", message: err.message };
    }

    // Stage 2: Fix
    for (const runner of this.fixRunners) {
      if (!runner.isAvailable(filePath, cwd)) continue;

      const fixResult = await runner.fix(filePath, this.timeoutMs);
      if (fixResult.status !== "skipped") {
        results.fix = fixResult;
        break; // Run first available fixer, stop
      }
    }

    results.duration = Date.now() - start;
    return results;
  }
}
```

**Key changes**:
- No more `analyze` stage
- No registry for fixers — just pass `fixRunners: FixRunner[]` array
- Simple sequential flow: format first, then fix
- Removed `runAll()` parallel execution (unnecessary)

---

### Step 4: Create `extension.ts` (Auto-Execution with Telemetry)

**Location**: `core-tools/code-quality/extension.ts`

The extension orchestrates the pipeline and fires telemetry badges on every write/edit. This is **automatic** — no user action needed.

```typescript
// extension.ts
import { ExtensionLifecycle } from "../../shared/lifecycle.ts";
import { getTelemetry } from "pi-telemetry";
import { CodeQualityPipeline } from "./pipeline.ts";
import { FIX_RUNNERS } from "./runners/fix/index.ts";
import type { ProcessResult } from "./pipeline.ts";

export class CodeQualityExtension extends ExtensionLifecycle {
  readonly name = "code-quality";
  readonly version = "1.0.0"; // Consolidation release

  private pipeline: CodeQualityPipeline;

  constructor(pi: ExtensionAPI) {
    super(pi);
    this.pipeline = new CodeQualityPipeline(FIX_RUNNERS);
  }

  register(): void {
    super.register();
    this.pi.on("tool_call", (event) => this.onToolCall(event));
  }

  private async onToolCall(event: any): Promise<void> {
    const toolName = event.toolName ?? "";
    if (toolName !== "write" && toolName !== "edit") return;

    const filePath = event.input?.path;
    if (!filePath) return;

    const cwd = dirname(filePath);
    const result = await this.pipeline.run(filePath, cwd, this.pi);

    this.notify(result);
    this.track("code_quality_processed", {
      filePath,
      formatted: result.format.status === "succeeded",
      fixed: result.fix.status === "succeeded",
      duration: result.duration,
    });
  }

  private notify(result: ProcessResult): void {
    const t = getTelemetry();
    if (!t) return;

    const parts: string[] = [];
    if (result.format.status === "succeeded") parts.push("formatted");
    if (result.fix.status === "succeeded") parts.push(`fixed (${result.fix.changes ?? 0} issues)`);

    if (parts.length > 0) {
      t.notify(`✅ ${basename(result.filePath)}: ${parts.join(" + ")}`, {
        package: "code-quality",
        badge: { text: "code-quality", variant: "success" },
      });
      return;
    }

    // Notify on failures
    const failures: string[] = [];
    if (result.format.status === "failed" && result.format.message) {
      failures.push(`format: ${result.format.message}`);
    }
    if (result.fix.status === "failed" && result.fix.message) {
      failures.push(`fix: ${result.fix.message}`);
    }

    if (failures.length > 0) {
      t.notify(`⚠️  ${basename(result.filePath)}: ${failures.join("; ")}`, {
        package: "code-quality",
        badge: { text: "code-quality-err", variant: "warning" },
      });
    }
  }
}

export default function (pi: ExtensionAPI) {
  const ext = new CodeQualityExtension(pi);
  ext.register();
}
```

### Telemetry Integration — Automatic Feedback on Every Write/Edit

**8 Auto-Formatters Fire Notifications:**
- ✅ "file.ts formatted (prettier)" — Prettier succeeded
- ✅ "file.ts formatted (biome)" — Biome succeeded
- ✅ "file.ts formatted (eslint)" — ESLint format succeeded
- ... (same for clang-format, ruff-format, shfmt, cmake-format, markdownlint)
- ⚠️ "file.ts format failed: prettier timeout" — Formatter failed

**3 Auto-Fix Runners Fire Notifications:**
- ✅ "file.ts fixed (3 linting issues)" — ESLint --fix applied
- ✅ "file.ts fixed (1 issue)" — Biome --write applied
- ✅ "file.ts fixed (5 issues)" — Ruff --fix applied (Python)
- ⚠️ "file.ts fix failed: eslint no config" — Fixer failed

**Combined Success:**
- ✅ "file.ts formatted + fixed (2 issues)" — Both stages succeeded

**Session Tracking** (available via `/ctx stats`):
- `format_count` — files formatted this session
- `fix_count` — files fixed this session
- `format_total_duration` — total time spent formatting
- `fix_total_duration` — total time spent fixing

---

### Step 5: Consolidate `types.ts`

**Location**: `core-tools/code-quality/types.ts`

Remove the unused `analyze` stage, add `FixResult`:

```typescript
// types.ts
export interface CodeRunner {
  readonly id: string;
  readonly type: "format" | "fix";  // remove "analyze"
  matches(filePath: string): boolean;
  run(filePath: string, config: RunnerConfig): Promise<RunnerResult>;
}

export interface RunnerConfig {
  cwd: string;
  timeoutMs: number;
  exec(cmd: string, args: string[], opts: any): Promise<ExecResult>;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr?: string;
}

export interface RunnerResult {
  status: "succeeded" | "failed" | "skipped" | "warning";
  message?: string;
  changes?: number;
}

// Remove: Snippet, PipelineResult (replace with ProcessResult in pipeline.ts)
```

---

### Step 6: Update `core-tools/index.ts`

**Before**:
```typescript
import codeQuality from "./code-quality/index.ts";
import autofix from "./autofix/index.ts";

// ...
codeQuality(pi);

if (profile === "full") {
  fileCollector(pi);
  astGrepTools(pi);
  codeReview(pi);
  autofix(pi);  // subset B
}
```

**After**:
```typescript
import codeQuality from "./code-quality/index.ts";

// ...
codeQuality(pi);  // now always on (dev + full)

if (profile === "full") {
  fileCollector(pi);
  astGrepTools(pi);
  codeReview(pi);
  // autofix removed — now part of code-quality
}
```

Also update the telemetry description:
```typescript
t.register({
  name: "core-tools",
  version: "0.9.0",  // bump for code-quality consolidation
  description: "Core tools: task orchestration, planning, memory, thinking-steps, code quality (format+fix), file intelligence, subprocess orchestration",
  // ... rest unchanged
});
```

---

### Step 7: Delete Legacy Modules

After Step 6 passes testing:

```bash
rm -rf core-tools/autofix/
rm core-tools/code-quality/runners/formatter-adapter.ts
```

That's it. The formatter-runners directory becomes `runners/formatter/` (moved, not deleted).

---

## Testing Strategy

### Unit Tests (All Formatters + Fixers Tested)

| Test File | Coverage |
|-----------|----------|
| `tests/pipeline.test.ts` | Format→fix→notify flow with mock runners |
| `tests/fix-runners.test.ts` | Each of 3 fix runners (biome --write, eslint --fix, ruff --fix) returns correct `FixResult` |
| `tests/formatter-dispatch.test.ts` | All 8 formatters dispatch unchanged (copy of existing tests) |
| `tests/telemetry.test.ts` | Badge notifications fire correctly on success/failure |

### Integration Tests (All Scenarios Covered)

| Scenario | Expected |
|----------|----------|
| **Write TypeScript** → biome auto-formats | ✅ "file.ts formatted (biome)" badge |
| **Write JS** → prettier auto-formats | ✅ "file.ts formatted (prettier)" badge |
| **Write JS with lint error** → eslint --fix auto-fixes | ✅ "file.ts fixed (3 issues)" badge |
| **Write Python** → ruff --fix auto-fixes | ✅ "file.ts fixed (2 issues)" badge |
| **Write C file** → clang-format auto-formats | ✅ "file.c formatted (clang-format)" badge |
| **Write Shell** → shfmt auto-formats | ✅ "file.sh formatted (shfmt)" badge |
| **Write file with no config** → formatters skip | No badge, no error (silent skip) |
| **Write large file (>5MB)** → skip format | No badge (configured skip) |
| **Format timeout** → fail gracefully | ⚠️ "format failed: timeout" badge |
| **Fix timeout** → fail gracefully | ⚠️ "fix failed: timeout" badge |

### Regression Tests (Backward Compatibility)

| Test | Expected |
|------|----------|
| `/ctx stats` includes code-quality metrics | ✅ format_count, fix_count, format_duration_avg, fix_duration_avg |
| Telemetry badge fires on format success | ✅ pi-telemetry.notify() with formatter name |
| Telemetry badge fires on fix success | ✅ pi-telemetry.notify() with issue count |
| Telemetry badge fires on failure | ✅ warning variant badge |
| Dev profile loads code-quality | ✅ 8 formatters + 3 fixers both active (no separate autofix import) |
| Full profile loads code-quality | ✅ no separate autofix in subset B (consolidated) |
| All 8 formatters still work | ✅ biome, prettier, eslint, ruff-format, clang-format, shfmt, cmake-format, markdownlint |
| All 3 fixers still work | ✅ biome --write, eslint --fix, ruff --fix |

---

## Code Metrics

| Metric | Current | Target | Delta |
|--------|---------|--------|-------|
| **Files** | 29 (3 modules) | ~12 (1 module) | **−17** (59% reduction) |
| **LOC** | 2,417 | ~1,200 | **−1,217** (50% reduction) |
| **Auto-Formatters** | 8 (biome, prettier, eslint, ruff-format, clang-format, shfmt, cmake-format, markdownlint) | **8 retained** | **0** (no loss) |
| **Auto-Fixers** | 3 (biome, eslint, ruff) in autofix/ | **3 consolidated** | **0** (no loss) |
| **Entry points** | 2 (code-quality/index.ts, autofix/index.ts) | 1 (code-quality/index.ts) | **−1** |
| **Runner registrations** | 2 separate (formatters in formatter-runners, fixers in autofix) | 1 unified (both formatters + fixers) | **−1 duplication** |
| **Classes** | 5 | 3 | **−2** |
| **Interfaces** | 7 | 5 (removed PipelineResult, removed Snippet) | **−2** |
| **Telemetry triggers** | 0 | 4+ (format-success, fix-success, format-failure, fix-failure, combined-success, format-slow) | **+4** |

---

## Why This Consolidation

### 1. **Eliminate Redundancy** (DRY)
Two implementations of "run biome --write" are maintained separately. Config discovery is duplicated. Consolidating to one reduces maintenance burden.

### 2. **Simplify Automation** (SRP)
Autofix hooks on tool_call. Formatter has no direct execution — only registry. Consolidating means one extension owns format+fix, one decision on when to run.

### 3. **Universal Code Quality** (Consistency)
Autofix in subset B means dev users don't get fixes. Moving to always-on means dev profile gets the same quality enforcement as full.

### 4. **Add Telemetry** (Observability)
Formatter and autofix run silently. Users don't know if formatting succeeded or failed. Telemetry badges inform the user automatically.

### 5. **Reduce Configuration Chaos** (Clarity)
Timeouts scattered: 15s (autofix), 30s (pipeline default). Format plan is implicit in dispatcher. New config schema centralizes all settings.

---

## Implementation Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1: Extract** | 2 days | Step 1 (fix runners) + Step 2 (registry) |
| **Phase 2: Refactor** | 2 days | Step 3 (pipeline) + Step 4 (extension) |
| **Phase 3: Polish** | 2 days | Step 5 (types) + Step 6 (entry points) |
| **Phase 4: Test & Delete** | 2 days | Unit tests, integration tests, Step 7 (delete legacy) |
| **Total** | ~8 days | Ready for staging/production |

---

## Backward Compatibility

✅ **ZERO breaking changes**:
- No new commands (format/fix still auto-execute)
- No new config schema (uses existing formatter/autofix configs)
- No changes to public APIs
- All existing tests pass (plus new ones)

---

## Summary

This consolidation:
1. **Merges 3 modules into 1** (29 files → 12 files, 50% LOC reduction)
2. **Retains all 8 auto-formatters** (biome, prettier, eslint, ruff-format, clang-format, shfmt, cmake-format, markdownlint)
3. **Consolidates 3 auto-fixers** (biome --write, eslint --fix, ruff --fix)
4. **Eliminates duplicate runner logic** (biome/eslint/ruff defined once, not twice)
5. **Removes adapter indirection** (formatter-adapter.ts unnecessary shim)
6. **Adds telemetry feedback** (4+ automation triggers: format-success, fix-success, format-failure, fix-failure, combined-success, format-slow)
7. **Makes code quality universal** (dev profile gets both auto-format + auto-fix, not just format)
8. **Improves maintainability** (one extension, one pipeline, one registry, one entry point)

**Zero breaking changes** for end users:
- All 8 formatters work identically
- All 3 fixers work identically
- All commands/configs unchanged
- Just automatic user feedback via telemetry badges
