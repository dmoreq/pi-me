# Phase 2 — Shared Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the repeated adopted-package registration pattern into `shared/register-package.ts` and migrate all 15 adopted plugin wrappers to use it, so a single change propagates to all wrappers.

**Architecture:** New `registerAdoptedPackage()` function in `shared/` handles `session_start` registration, dynamic import, `setStatus`, and error notification. Plugins with skill paths pass `skillPaths` and the helper registers `resources_discover` eagerly. Each migrated wrapper shrinks from ~15 lines to 4. Shared notifications audit runs last (read-only until a duplicate is confirmed).

**Tech Stack:** TypeScript, Node.js `node:test`, pi `ExtensionAPI`

---

### Task 1: Write the failing tests for `registerAdoptedPackage`

**Files:**
- Create: `shared/register-package.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// shared/register-package.test.ts
import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerAdoptedPackage } from "./register-package.ts";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

function makePi() {
  const handlers: Record<string, Function[]> = {};
  const statusCalls: Array<[string, string]> = [];
  const notifyCalls: Array<[string, string]> = [];
  const resourcesHandlers: Function[] = [];

  const pi = {
    on(event: string, fn: Function) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(fn);
    },
    _trigger: async (event: string, ctx: object) => {
      for (const fn of handlers[event] ?? []) await fn({}, ctx);
    },
    _triggerResources: async () => {
      let merged: { skillPaths: string[] } = { skillPaths: [] };
      for (const fn of resourcesHandlers) {
        const r = await fn();
        if (r?.skillPaths) merged.skillPaths.push(...r.skillPaths);
      }
      return merged;
    },
    _resourcesHandlers: resourcesHandlers,
    _statusCalls: statusCalls,
    _notifyCalls: notifyCalls,
  } as unknown as ExtensionAPI & {
    _trigger: (e: string, ctx: object) => Promise<void>;
    _triggerResources: () => Promise<{ skillPaths: string[] }>;
    _resourcesHandlers: Function[];
    _statusCalls: Array<[string, string]>;
    _notifyCalls: Array<[string, string]>;
  };

  // Override pi.on for resources_discover to use resourcesHandlers array
  const originalOn = pi.on.bind(pi);
  (pi as any).on = (event: string, fn: Function) => {
    if (event === "resources_discover") {
      resourcesHandlers.push(fn);
    } else {
      originalOn(event, fn);
    }
  };

  const ctx = {
    ui: {
      setStatus(key: string, val: string) { statusCalls.push([key, val]); },
      notify(msg: string, type: string) { notifyCalls.push([msg, type]); },
    },
  };

  return { pi, ctx };
}

describe("registerAdoptedPackage", () => {
  it("calls mod.default(pi) and sets status to ready on success", async () => {
    const { pi, ctx } = makePi();
    let called = false;
    registerAdoptedPackage(pi, {
      importFn: async () => ({ default: () => { called = true; } }),
      statusKey: "test-pkg",
      packageName: "test-pkg",
    });

    await (pi as any)._trigger("session_start", ctx);

    assert.equal(called, true);
    assert.deepEqual((pi as any)._statusCalls, [["test-pkg", "ready"]]);
  });

  it("logs error and notifies when import throws", async () => {
    const { pi, ctx } = makePi();
    const errors: unknown[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args);

    registerAdoptedPackage(pi, {
      importFn: async () => { throw new Error("boom"); },
      statusKey: "bad-pkg",
      packageName: "bad-pkg",
    });

    await (pi as any)._trigger("session_start", ctx);

    console.error = origError;
    assert.equal(errors.length, 1);
    assert.match(String(errors[0]), /bad-pkg/);
    assert.equal((pi as any)._notifyCalls.length, 1);
    assert.match((pi as any)._notifyCalls[0][0], /bad-pkg failed to load/);
    assert.equal((pi as any)._notifyCalls[0][1], "error");
  });

  it("does not crash when module has no default export", async () => {
    const { pi, ctx } = makePi();
    registerAdoptedPackage(pi, {
      importFn: async () => ({}),
      statusKey: "no-default",
      packageName: "no-default",
    });

    await assert.doesNotReject(() => (pi as any)._trigger("session_start", ctx));
    assert.deepEqual((pi as any)._statusCalls, [["no-default", "ready"]]);
  });

  it("registers resources_discover when skillPaths provided", async () => {
    const { pi } = makePi();
    registerAdoptedPackage(pi, {
      importFn: async () => ({}),
      statusKey: "with-skills",
      packageName: "with-skills",
      skillPaths: ["/some/skills/dir"],
    });

    const result = await (pi as any)._triggerResources();
    assert.deepEqual(result.skillPaths, ["/some/skills/dir"]);
  });

  it("does not register resources_discover when skillPaths not provided", async () => {
    const { pi } = makePi();
    registerAdoptedPackage(pi, {
      importFn: async () => ({}),
      statusKey: "no-skills",
      packageName: "no-skills",
    });

    assert.equal((pi as any)._resourcesHandlers.length, 0);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
tsx --test "shared/**/*.test.ts"
```

Expected: FAIL — `register-package.ts` does not exist yet.

---

### Task 2: Implement `registerAdoptedPackage`

**Files:**
- Create: `shared/register-package.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// shared/register-package.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export interface RegisterAdoptedPackageOptions {
  importFn: () => Promise<{ default?: (pi: ExtensionAPI) => unknown }>;
  statusKey: string;
  packageName: string;
  skillPaths?: string[];
}

export function registerAdoptedPackage(
  pi: ExtensionAPI,
  opts: RegisterAdoptedPackageOptions,
): void {
  if (opts.skillPaths && opts.skillPaths.length > 0) {
    const paths = opts.skillPaths;
    pi.on("resources_discover", async () => ({ skillPaths: paths }));
  }

  pi.on("session_start", async (_event: unknown, ctx: { ui: { setStatus(k: string, v: string): void; notify(msg: string, type: string): void } }) => {
    try {
      const mod = await opts.importFn();
      if (typeof mod.default === "function") await mod.default(pi);
      ctx.ui.setStatus(opts.statusKey, "ready");
    } catch (err) {
      console.error(`[${opts.statusKey}] Failed:`, err);
      ctx.ui.notify(
        `${opts.packageName} failed to load. Run: npm install ${opts.packageName}`,
        "error",
      );
    }
  });
}
```

- [ ] **Step 2: Run the tests to confirm they pass**

```bash
tsx --test "shared/**/*.test.ts"
```

Expected: all 5 tests PASS.

- [ ] **Step 3: Update the test script in `package.json` to include `shared/`**

Change the `test` script from:
```json
"test": "tsx --test \"foundation/**/*.test.ts\" \"session-lifecycle/**/*.test.ts\" \"core-tools/**/*.test.ts\" \"content-tools/**/*.test.ts\" \"authoring/**/*.test.ts\""
```
to:
```json
"test": "tsx --test \"shared/**/*.test.ts\" \"foundation/**/*.test.ts\" \"session-lifecycle/**/*.test.ts\" \"core-tools/**/*.test.ts\" \"content-tools/**/*.test.ts\" \"authoring/**/*.test.ts\""
```

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```

Expected: all existing tests + 5 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add shared/register-package.ts shared/register-package.test.ts package.json
git commit -m "feat: add registerAdoptedPackage() shared utility with tests"
```

---

### Task 3: Migrate core-tools adopted plugins (batch A — simple, no skillPaths)

These 9 plugins have no skillPaths and use the identical boilerplate.

**Files — each modified from ~15 lines to 4:**
- Modify: `core-tools/pi-memory/index.ts`
- Modify: `core-tools/memex/index.ts`
- Modify: `core-tools/pi-thinking-steps/index.ts`
- Modify: `core-tools/pi-crew/index.ts`
- Modify: `core-tools/pi-edit-session/index.ts`
- Modify: `core-tools/pi-stash/index.ts`
- Modify: `core-tools/pi-formatter/index.ts`
- Modify: `core-tools/pi-link/index.ts`
- Modify: `core-tools/pi-processes/index.ts`

- [ ] **Step 1: Replace `core-tools/pi-memory/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("@samfp/pi-memory"),
    statusKey: "pi-memory",
    packageName: "@samfp/pi-memory",
  });
```

- [ ] **Step 2: Replace `core-tools/memex/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("@touchskyer/memex/pi-extension/index.ts"),
    statusKey: "memex",
    packageName: "@touchskyer/memex",
  });
```

- [ ] **Step 3: Replace `core-tools/pi-thinking-steps/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-thinking-steps"),
    statusKey: "pi-thinking-steps",
    packageName: "pi-thinking-steps",
  });
```

- [ ] **Step 4: Replace `core-tools/pi-crew/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-crew"),
    statusKey: "pi-crew",
    packageName: "pi-crew",
  });
```

- [ ] **Step 5: Replace `core-tools/pi-edit-session/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-edit-session-in-place/extensions/edit-session-in-place.ts"),
    statusKey: "pi-edit-session",
    packageName: "pi-edit-session-in-place",
  });
```

- [ ] **Step 6: Replace `core-tools/pi-stash/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("@fitchmultz/pi-stash/extensions/stash.ts"),
    statusKey: "pi-stash",
    packageName: "@fitchmultz/pi-stash",
  });
```

- [ ] **Step 7: Replace `core-tools/pi-formatter/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-formatter"),
    statusKey: "pi-formatter",
    packageName: "pi-formatter",
  });
```

- [ ] **Step 8: Replace `core-tools/pi-link/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-link"),
    statusKey: "pi-link",
    packageName: "pi-link",
  });
```

- [ ] **Step 9: Replace `core-tools/pi-processes/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("@aliou/pi-processes"),
    statusKey: "pi-processes",
    packageName: "@aliou/pi-processes",
  });
```

- [ ] **Step 10: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
git add core-tools/pi-memory/index.ts core-tools/memex/index.ts core-tools/pi-thinking-steps/index.ts core-tools/pi-crew/index.ts core-tools/pi-edit-session/index.ts core-tools/pi-stash/index.ts core-tools/pi-formatter/index.ts core-tools/pi-link/index.ts core-tools/pi-processes/index.ts
git commit -m "refactor: migrate 9 core-tools adopted plugins to registerAdoptedPackage()"
```

---

### Task 4: Migrate remaining adopted plugins (batch B — cross-layer + skillPaths)

**Files:**
- Modify: `core-tools/greedysearch-pi/index.ts`
- Modify: `core-tools/pi-mcp-adapter/index.ts`
- Modify: `authoring/plannotator/index.ts`
- Modify: `content-tools/pi-docparser/index.ts`
- Modify: `content-tools/pi-markdown-preview/index.ts`
- Modify: `content-tools/pi-studio/index.ts`
- Modify: `content-tools/feynman/index.ts` (has skillPaths)
- Modify: `content-tools/context-mode/index.ts` (has skillPaths)

- [ ] **Step 1: Replace `core-tools/greedysearch-pi/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("@apmantza/greedysearch-pi"),
    statusKey: "greedysearch",
    packageName: "@apmantza/greedysearch-pi",
  });
```

- [ ] **Step 2: Replace `core-tools/pi-mcp-adapter/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-mcp-adapter"),
    statusKey: "pi-mcp",
    packageName: "pi-mcp-adapter",
  });
```

- [ ] **Step 3: Replace `authoring/plannotator/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("@plannotator/pi-extension"),
    statusKey: "plannotator",
    packageName: "@plannotator/pi-extension",
  });
```

- [ ] **Step 4: Replace `content-tools/pi-docparser/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-docparser"),
    statusKey: "pi-docparser",
    packageName: "pi-docparser",
  });
```

- [ ] **Step 5: Replace `content-tools/pi-markdown-preview/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-markdown-preview"),
    statusKey: "pi-markdown-preview",
    packageName: "pi-markdown-preview",
  });
```

- [ ] **Step 6: Replace `content-tools/pi-studio/index.ts`**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-studio"),
    statusKey: "pi-studio",
    packageName: "pi-studio",
  });
```

- [ ] **Step 7: Replace `content-tools/feynman/index.ts`**

Note: feynman also registers skill paths — use the `skillPaths` option.

```typescript
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const skillsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "..", "..", "node_modules", "@companion-ai", "feynman", "skills"
);

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("@companion-ai/feynman/extensions/research-tools.ts"),
    statusKey: "feynman",
    packageName: "@companion-ai/feynman",
    skillPaths: [skillsDir],
  });
```

- [ ] **Step 8: Replace `content-tools/context-mode/index.ts`**

```typescript
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const skillsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "..", "..", "node_modules", "context-mode", "skills"
);

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("context-mode/build/pi-extension.js"),
    statusKey: "context-mode",
    packageName: "context-mode",
    skillPaths: [skillsDir],
  });
```

- [ ] **Step 9: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add core-tools/greedysearch-pi/index.ts core-tools/pi-mcp-adapter/index.ts authoring/plannotator/index.ts content-tools/pi-docparser/index.ts content-tools/pi-markdown-preview/index.ts content-tools/pi-studio/index.ts content-tools/feynman/index.ts content-tools/context-mode/index.ts
git commit -m "refactor: migrate remaining 8 adopted plugins to registerAdoptedPackage()"
```

---

### Task 5: Audit shared notifications (read-only check)

**Files:**
- Read: `session-lifecycle/warp-notify/index.ts`
- Read: `session-lifecycle/session-recap/index.ts`
- Read: `session-lifecycle/startup-header.ts`
- Read: `shared/notifications.ts`

- [ ] **Step 1: Check warp-notify for duplicated notification logic**

```bash
grep -n "beep\|speak\|notify\|osascript\|terminal-notifier\|displayNotification" session-lifecycle/warp-notify/index.ts
```

If any matches overlap with functions already in `shared/notifications.ts` (e.g., `playBeep`, `speakMessage`, `displayOSXNotification`), move them.

- [ ] **Step 2: Check session-recap for duplicated notification logic**

```bash
grep -n "beep\|speak\|notify\|osascript\|terminal-notifier\|displayNotification" session-lifecycle/session-recap/index.ts
```

- [ ] **Step 3: Check startup-header for duplicated notification logic**

```bash
grep -n "beep\|speak\|notify\|osascript\|terminal-notifier\|displayNotification" session-lifecycle/startup-header.ts
```

- [ ] **Step 4: If any duplicates found — move to `shared/notifications.ts`**

Export the generic function from `shared/notifications.ts` and import it in the plugin. Do not move plugin-specific logic (warp OSC escape sequences, recap summary display).

If no duplicates are found, skip this step.

- [ ] **Step 5: Run tests after any changes**

```bash
npm test
```

- [ ] **Step 6: Commit if changes were made**

```bash
git add shared/notifications.ts session-lifecycle/warp-notify/index.ts session-lifecycle/session-recap/index.ts session-lifecycle/startup-header.ts
git commit -m "refactor: consolidate duplicated notification logic into shared/notifications.ts"
```

---

### Task 6: Final verification

- [ ] **Step 1: Count lines in migrated wrappers**

```bash
wc -l core-tools/pi-memory/index.ts core-tools/pi-crew/index.ts content-tools/feynman/index.ts
```

Expected: pi-memory and pi-crew are ≤6 lines; feynman is ≤10 lines (has skillPaths path resolution).

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests pass including the 5 new `register-package` tests.

- [ ] **Step 3: Verify shared/index.ts exports the new utility**

Open `shared/index.ts` and add the export if missing:
```typescript
export * from "./register-package.js";
```

Run `npm test` again to confirm no regression.
