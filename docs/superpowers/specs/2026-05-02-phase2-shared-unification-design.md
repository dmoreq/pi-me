# Phase 2 — Shared Unification Design

**Date:** 2026-05-02
**Status:** Approved
**Depends on:** Phase 1 (plugin consolidation)

## Goal

Extract the repeated adopted-package registration pattern into a shared utility so all adopted plugin wrappers stay synchronized. Extend the existing `shared/notifications.ts` to cover inline notification logic currently duplicated in three session-lifecycle plugins.

## Problem

After Phase 1, ~12 adopted plugin wrappers each repeat the same ~15-line boilerplate:

```ts
export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("pkg-name");
      if (typeof mod.default === "function") await mod.default(pi);
      ctx.ui.setStatus("key", "ready");
    } catch (err) {
      console.error("[name] Failed:", err);
      ctx.ui.notify("name failed. Run: npm install pkg-name", "error");
    }
  });
}
```

If this pattern needs to change (e.g., error format, status key convention, skill path registration), all 12 files need updating in sync. The `LazyModule` class already exists in `shared/lazy-package.ts` but only covers module caching — not the full pi registration lifecycle.

Three session-lifecycle plugins (warp-notify, session-recap, startup-header) also roll their own terminal-notification/alert logic instead of importing from `shared/notifications.ts`.

## Architecture

### New utility: `shared/register-package.ts`

```ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export interface RegisterAdoptedPackageOptions {
  /** Dynamic import function for the package */
  importFn: () => Promise<{ default?: (pi: ExtensionAPI) => unknown }>;
  /** Key shown in pi status bar (e.g. "pi-crew") */
  statusKey: string;
  /** npm package name shown in error message (e.g. "pi-crew") */
  packageName: string;
  /** Optional skill directories to register via resources_discover */
  skillPaths?: string[];
}

export function registerAdoptedPackage(
  pi: ExtensionAPI,
  opts: RegisterAdoptedPackageOptions,
): void
```

**Behavior:**
1. If `skillPaths` is provided, registers a `resources_discover` handler immediately (eager — skill metadata must be available before session start)
2. Registers a `session_start` handler that:
   - Calls `opts.importFn()`
   - Calls `mod.default(pi)` if it is a function
   - Calls `ctx.ui.setStatus(opts.statusKey, "ready")` on success
   - On error: logs `[statusKey] Failed: <err>` to console and calls `ctx.ui.notify("<packageName> failed to load. Run: npm install <packageName>", "error")`

### Migrated plugins (after Phase 1)

All of these shrink from ~15 lines to 4:

| Plugin | Package |
|---|---|
| `core-tools/pi-memory/index.ts` | `@samfp/pi-memory` |
| `core-tools/memex/index.ts` | `@touchskyer/memex/pi-extension/index.ts` |
| `core-tools/pi-thinking-steps/index.ts` | `pi-thinking-steps` |
| `core-tools/pi-crew/index.ts` | `pi-crew` |
| `core-tools/pi-edit-session/index.ts` | `pi-edit-session-in-place/extensions/edit-session-in-place.ts` |
| `core-tools/pi-stash/index.ts` | `@fitchmultz/pi-stash/extensions/stash.ts` |
| `core-tools/pi-formatter/index.ts` | `pi-formatter` |
| `core-tools/pi-link/index.ts` | `pi-link` |
| `core-tools/pi-processes/index.ts` | `@aliou/pi-processes` |
| `core-tools/greedysearch-pi/index.ts` | `@apmantza/greedysearch-pi` |
| `core-tools/pi-mcp-adapter/index.ts` | `pi-mcp-adapter` |
| `authoring/plannotator/index.ts` | `@plannotator/pi-extension` |
| `content-tools/pi-docparser/index.ts` | `pi-docparser` |
| `content-tools/pi-markdown-preview/index.ts` | `pi-markdown-preview` |
| `content-tools/pi-studio/index.ts` | `pi-studio` |

**Plugins with skillPaths** (pass `skillPaths` option):

| Plugin | Skill dir |
|---|---|
| `content-tools/feynman/index.ts` | `node_modules/@companion-ai/feynman/skills` |
| `content-tools/context-mode/index.ts` | `node_modules/context-mode/skills` |

**pi-lens special case:** `core-tools/pi-lens/index.ts` currently pre-registers 7 flags inline as a workaround to avoid eager import. After this phase ships, migrate `pi-lens` to use `registerAdoptedPackage()` with its `skillPaths`. The 7 inline flag stubs are removed; the package registers its own flags after load.

### Shared notifications extension

Audit `session-lifecycle/warp-notify/index.ts`, `session-lifecycle/session-recap/index.ts`, and `session-lifecycle/startup-header.ts` for any generic terminal notification logic (beep, OS notify, speak, bring-to-front) that duplicates `shared/notifications.ts`. Move duplicates into `shared/notifications.ts`. Do not move plugin-specific logic (warp OSC sequences, recap summary formatting).

## Migration pattern

Before:
```ts
export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const mod = await import("pi-crew");
      if (typeof mod.default === "function") await mod.default(pi);
      ctx.ui.setStatus("pi-crew", "ready");
    } catch (err) {
      console.error("[pi-crew] Failed:", err);
    }
  });
}
```

After:
```ts
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("pi-crew"),
    statusKey: "pi-crew",
    packageName: "pi-crew",
  });
```

## Testing

Add `shared/register-package.test.ts` covering:
- Success path: module loaded, status set to "ready"
- Error path: import throws, console.error called, notify called with correct message
- skillPaths path: resources_discover registered when skillPaths provided
- No-default-export path: module loaded without calling default (no crash)
