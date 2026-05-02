# Top 5 Package Adoption Plan — Performance-Optimized

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Adopt `pi-lens`, `pi-mcp-adapter`, `@samfp/pi-memory`, `pi-docparser`, and `@plannotator/pi-extension` into pi-me with zero measurable startup overhead.

**Architecture:** Each package is wrapped in a thin pi-me entry point that uses **dynamic `import()`** (not static imports) to defer heavy module loading until first use. Heavy initialization (LSP clients, TypeScript compiler, tree-sitter WASM) is deferred to `session_start` or on-demand via tool execution. Native dependencies (`@ast-grep/napi`, `typescript`, `tree-sitter-wasms`, `@llamaindex/liteparse`) are never loaded at pi startup — only when the agent first invokes the relevant tool.

**Tech Stack:** TypeScript, pi ExtensionAPI, dynamic `import()`, lazy `on("session_start")`, tool-first initialization

**Performance constraints:**
- pi-lens has **38KB of TS source** + heavy deps (`typescript`, `@ast-grep/napi` native binary, `tree-sitter-wasms`)
- pi-mcp-adapter depends on `@modelcontextprotocol/sdk` (MCP client/server libraries)
- pi-memory is **zero-dep** — trivially fast
- pi-docparser depends on `@llamaindex/liteparse` (heavy, LlamaIndex-based)
- plannotator depends on `turndown` (HTML→Markdown) — moderately light

---

## Task 1: Create performance-first adoption framework

**Goal:** Establish shared infrastructure for lazy-loading external packages to keep pi startup fast.

**Files:**
- Create: `shared/lazy-package.ts`
- Create: `shared/lazy-package.test.ts`

**Step 1: Design the lazy-wrapper pattern**

We need a reusable pattern that:
1. The extension entry point does **zero** static imports of the external package
2. Heavy modules are loaded via `import()` only when tools are first called
3. Native binaries / WASM are never loaded at pi startup
4. Failed loads are caught gracefully without breaking pi

Write `shared/lazy-package.ts`:

```typescript
/**
 * Lazy-load a module on first access and cache the result.
 * Uses dynamic import() so the module is never loaded at pi startup.
 * Catches and caches errors so repeated calls don't retry.
 */
export class LazyModule<TModule> {
  private _module: TModule | undefined;
  private _error: Error | undefined;
  private _loading: Promise<TModule> | undefined;

  constructor(
    private readonly importFn: () => Promise<TModule>,
    private readonly name: string,
  ) {}

  async get(): Promise<TModule> {
    if (this._module) return this._module;
    if (this._error) throw this._error;
    if (!this._loading) {
      this._loading = this.importFn()
        .then((mod) => {
          this._module = mod;
          return mod;
        })
        .catch((err: unknown) => {
          this._error = err instanceof Error ? err : new Error(String(err));
          throw this._error;
        });
    }
    return this._loading;
  }

  /** Non-throwing check — returns true if module is available */
  isLoaded(): boolean {
    return this._module !== undefined;
  }
}
```

**Step 2: Write the failing test**

Create `shared/lazy-package.test.ts`:

```typescript
import { describe, it, assert, beforeEach } from "./test-harness.ts";
import { LazyModule } from "./lazy-package.ts";

describe("LazyModule", () => {
  it("loads module on first get() call", async () => {
    const lazy = new LazyModule(() => Promise.resolve({ value: 42 }), "test");
    assert.isFalse(lazy.isLoaded());
    const mod = await lazy.get();
    assert.strictEqual(mod.value, 42);
    assert.isTrue(lazy.isLoaded());
  });

  it("caches result across multiple get() calls", async () => {
    let callCount = 0;
    const lazy = new LazyModule(() => {
      callCount++;
      return Promise.resolve({ value: callCount });
    }, "test");
    const m1 = await lazy.get();
    const m2 = await lazy.get();
    assert.strictEqual(m1.value, 1);
    assert.strictEqual(m2.value, 1);
    assert.strictEqual(callCount, 1);
  });

  it("caches and re-throws errors", async () => {
    const lazy = new LazyModule(
      () => Promise.reject(new Error("fail")),
      "test",
    );
    await assert.rejects(() => lazy.get(), /fail/);
    await assert.rejects(() => lazy.get(), /fail/);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `tsx --test shared/lazy-package.test.ts`
Expected: Tests fail (files don't exist yet)

**Step 4: Write implementation**

Create both files as described above.

**Step 5: Run test to verify it passes**

Run: `tsx --test shared/lazy-package.test.ts`
Expected: All tests pass

**Step 6: Commit**

```bash
git add shared/lazy-package.ts shared/lazy-package.test.ts
git commit -m "feat: add LazyModule for deferred extension loading"
```

---

## Task 2: Adopt `@samfp/pi-memory` (zero-dep, simplest)

**Why first:** Zero dependencies means zero startup cost. Fast win, builds confidence in the adoption pattern.

**Files:**
- Create: `core-tools/pi-memory/index.ts` (thin entry)
- Create: `core-tools/pi-memory/adapter.ts` (wrapper around original)
- Modify: `package.json` (add extension path + dependency)
- Destroy: no deletion needed

**Step 1: Install the package**

```bash
cd /Users/quy.doan/Workspace/personal/pi-me
npm install @samfp/pi-memory
```

**Step 2: Research the package API**

Read the source at `node_modules/@samfp/pi-memory/`:
- What does the default export function signature look like?
- What tools/events does it register?
- How does it persist memory?

**Step 3: Write the thin pi-me entry**

`core-tools/pi-memory/index.ts`:

```typescript
/**
 * pi-memory — Persistent memory across sessions.
 * Adopted from @samfp/pi-memory.
 * Zero startup cost: package is loaded via dynamic import() on session_start.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default async function (pi: ExtensionAPI) {
  // Defer loading the actual package to session_start, well after pi is ready
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("@samfp/pi-memory");
      if (typeof mod.default === "function") {
        mod.default(pi);
      }
    } catch (err) {
      console.error("[pi-memory] Failed to load:", err);
      ctx.ui.notify("pi-memory failed to load", "error");
    }
  });
}
```

**Step 4: Add to package.json**

Add to `pi.extensions` array:
```json
"./core-tools/pi-memory/index.ts"
```

Add to `dependencies`:
```json
"@samfp/pi-memory": "^1.0.2"
```

**Step 5: Verify startup is fast**

```bash
time pi --version  # Should show no perceptible delay vs baseline
pi --list-extensions  # Verify pi-memory extension is loaded
```

**Step 6: Commit**

```bash
git add package.json package-lock.json core-tools/pi-memory/
git commit -m "feat(pi-memory): adopt @samfp/pi-memory with lazy loading"
```

---

## Task 3: Adopt `pi-mcp-adapter` (MCP ecosystem access)

**Files:**
- Create: `core-tools/pi-mcp-adapter/index.ts`
- Create: `core-tools/pi-mcp-adapter/adapter.ts`
- Modify: `package.json`

**Performance strategy:**
- `@modelcontextprotocol/sdk` is loaded only when the agent first uses an MCP tool
- Server discovery/launch is deferred to first tool call
- Only the TUI panel lazy-loads on `session_start`

**Step 1: Install**

```bash
npm install pi-mcp-adapter
```

**Step 2: Study the package structure**

Read `node_modules/pi-mcp-adapter/init.ts` to understand how it initializes.

**Step 3: Write the thin entry**

`core-tools/pi-mcp-adapter/index.ts`:

```typescript
/**
 * pi-mcp-adapter — MCP (Model Context Protocol) adapter for Pi.
 * Adopted from pi-mcp-adapter by nicopreme.
 * Lazy: MCP SDK is loaded only when first MCP tool is called.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default async function (pi: ExtensionAPI) {
  // Register a lazy MCP tool that loads the SDK on first invocation
  pi.registerTool({
    name: "mcp",
    label: "MCP",
    // ... parameters copied from original
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const { default: initMCP } = await import("pi-mcp-adapter");
      return initMCP.execute(toolCallId, params, signal, onUpdate, ctx);
    },
  });

  // Optionally: register any TUI panels lazily on session_start
}
```

(Adjust based on actual package API — read the source first)

**Step 4: Add to package.json**

```json
"./core-tools/pi-mcp-adapter/index.ts"
```

**Step 5: Verify**

```bash
time pi --version  # Should be same speed as baseline
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(pi-mcp-adapter): adopt pi-mcp-adapter with on-demand MCP SDK loading"
```

---

## Task 4: Adopt `pi-docparser` (document parsing)

**Files:**
- Create: `content-tools/pi-docparser/index.ts`
- Create: `content-tools/pi-docparser/adapter.ts`
- Modify: `package.json`

**Performance strategy:**
- `@llamaindex/liteparse` is the heaviest dep — loaded only on first `document_parse` tool call
- Tool registration is synchronous (just registers metadata), execution is async (loads + runs)

**Step 1: Install**

```bash
npm install pi-docparser
```

**Step 2: Study the package**

Read `node_modules/pi-docparser/extensions/docparser/index.ts` to understand the tool registration pattern.

**Step 3: Write the lazy entry**

Same pattern as pi-mcp-adapter — defer the `import("pi-docparser")` until tool execution.

**Step 4: Add to package.json**

**Step 5: Verify**

**Step 6: Commit**

---

## Task 5: Adopt `@plannotator/pi-extension` (plan review with visual annotation)

**Files:**
- Create: `authoring/plannotator/index.ts`
- Create: `authoring/plannotator/adapter.ts`
- Modify: `package.json`

**Performance strategy:**
- `turndown` (HTML→Markdown) is light but still deferred to first use
- `@pierre/diffs` loaded only when reviewing diffs
- TUI components loaded via dynamic import on first plan-review command

**Step 1: Install**

```bash
npm install @plannotator/pi-extension
```

**Step 2: Study the package**

Read `node_modules/@plannotator/pi-extension/` to understand the API.

**Step 3: Write the lazy entry**

Same pattern — defer all imports.

**Step 4: Add to package.json**

**Step 5: Verify**

**Step 6: Commit**

---

# !!! PERFORMANCE CRITICAL — Read Before Adopting pi-lens !!!

pi-lens is **the most valuable but also the heaviest** package. The user reports significant startup slowdown when installing it raw. Here's why and how to fix it.

## Root Cause of Startup Slowdown

pi-lens' `index.ts` has **50 top-level `import` statements** that pull in:

| Import | What it loads | Startup Cost |
|--------|---------------|-------------|
| `@ast-grep/napi` | **Native Rust binary** (~4MB .node file) | High — Node loads + initializes native addon |
| `typescript` | **TypeScript compiler** (~50MB unpacked) | Very High — TS compiler instantiation |
| `tree-sitter-wasms` + `web-tree-sitter` | **WASM binaries** (optional but still loaded) | Medium — WASM compilation |
| `vscode-jsonrpc` | LSP transport protocol | Low — pure JS |
| 38KB of TypeScript source | All client modules parsed by jiti/tsx | Medium — 38KB transpiled at startup |
| `new RuntimeCoordinator()` | State machine initialization | Low |
| `new TreeSitterClient()` | Tree-sitter WASM init | High — WASM is loaded eagerly |

**Total estimated raw startup cost: ~800ms–2s** depending on machine.

## The Fix: Full lazy decomposition

Instead of:
```typescript
// Static imports — load EVERYTHING at startup
import { AstGrepClient } from "./clients/ast-grep-client.js";
import { TreeSitterClient } from "./clients/tree-sitter-client.js";
import { getLSPService } from "./clients/lsp/index.js";
```

The pi-me entry does:
```typescript
// Import nothing from pi-lens at module load time
export default function (pi: ExtensionAPI) {
  // Register tool with lazy executor
  pi.registerTool({
    name: "lens",
    execute: async (id, params, signal, onUpdate, ctx) => {
      // First call: dynamically import the heavy package
      const { executeLensTool } = await import("./adapter.ts");
      return executeLensTool(id, params, signal, onUpdate, ctx);
    },
  });
}
```

---

## Task 6: Adopt `pi-lens` — Performance-Optimized

**Files:**
- Create: `core-tools/pi-lens/index.ts` (thin entry, ~50 lines)
- Create: `core-tools/pi-lens/adapter.ts` (lazy module loader)
- Create: `core-tools/pi-lens/types.ts` (minimal types, no heavy imports)
- Modify: `package.json`

**Step 1: Install pi-lens**

```bash
npm install pi-lens
```

**Step 2: Audit all top-level imports in pi-lens**

Read the full `node_modules/pi-lens/index.ts` and catalog every import that could cause startup delay:

- File-system only imports (`node:fs`, `node:path`, etc.) — safe
- Type-only imports — safe
- Heavy library imports — must be deferred
- Constructors called at module scope (`new RuntimeCoordinator()`, `new TreeSitterClient()`) — must be deferred

**Step 3: Build the lazy adapter**

`core-tools/pi-lens/adapter.ts` implements a lazy version of pi-lens:

```typescript
import { LazyModule } from "../../shared/lazy-package.ts";

// Lazy loader — pi-lens module is never imported at startup
const piLensModule = new LazyModule(
  () => import("pi-lens"),
  "pi-lens",
);

export async function getPiLens() {
  return piLensModule.get();
}
```

**Step 4: Build the thin entry point**

`core-tools/pi-lens/index.ts`:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Strategy: defer ALL pi-lens initialization until first session_start
  // This means pi startup is fast, and pi-lens boot cost is paid once per session.
  
  pi.on("session_start", async (_event, ctx) => {
    try {
      // Deferred dynamic import — NOT loaded at pi startup
      const piLens = await import("./adapter.ts");
      await piLens.initializePiLens(pi);
      ctx.ui.setStatus("pi-lens", "ready");
    } catch (err) {
      console.error("[pi-lens] Init failed:", err);
      // Don't crash pi — lens is optional
    }
  });
}
```

Optional improvement: register a tool metadata placeholder at startup so the LLM knows lens tools exist, but defer the actual implementation to lazy load:

```typescript
// At pi startup — zero cost, just registers metadata
pi.registerTool({
  name: "lens_analyze",
  label: "Lens Analyze",
  description: "Analyze code for issues...",
  parameters: Type.Object({ file: Type.String() }),
  execute: async (id, params, signal, onUpdate, ctx) => {
    // First use loads the real implementation
    const { executeLensAnalyze } = await import("./lens-tools.ts");
    return executeLensAnalyze(id, params, signal, onUpdate, ctx);
  },
});
```

**Step 5: Verify startup performance**

```bash
# Measure startup time before and after
hyperfine --warmup 3 'pi --version' --export-json /tmp/pi-bench.json

# Verify lens tools work
pi -p "Analyze this file with lens" --dry-run  # or similar
```

Target: **< 50ms overhead vs baseline** (without lens)
Acceptable: **< 200ms overhead** (with lens tools registered but not loaded)

**Step 6: Add to package.json**

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(pi-lens): adopt pi-lens with full lazy loading — zero startup overhead"
```

---

## Task 7: Integration smoke test + performance benchmark

**Goal:** Run the full test suite and benchmark startup time.

**Step 1: Run existing test suite**

```bash
tsx --test "foundation/**/*.test.ts" "session-lifecycle/**/*.test.ts" "core-tools/**/*.test.ts" "content-tools/**/*.test.ts" "authoring/**/*.test.ts"
```

Expected: All 202+ tests pass (no regressions from new dependencies)

**Step 2: Baseline startup benchmark**

```bash
hyperfine --warmup 5 --min-runs 10 'pi --version'
```

**Step 3: Verify each adopted tool works**

```bash
# pi-lens: run a lens analysis
pi -p "Check this file with lens: core-tools/pi-lens/index.ts" --dry-run

# pi-mcp-adapter: list MCP servers
pi -p "List available MCP servers" --dry-run

# pi-memory: check memory
pi -p "Show my learned preferences" --dry-run

# pi-docparser: parse a document
pi -p "Parse README.md with document_parse" --dry-run

# plannotator: open plan review
pi -p "Review the current plan" --dry-run
```

**Step 4: Commit final state**

```bash
git commit -m "chore: integration smoke tests and perf benchmarks"
```

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-05-02-adopt-top-5-packages-perf-optimized.md`.**

**Two execution options:**

1. **Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
