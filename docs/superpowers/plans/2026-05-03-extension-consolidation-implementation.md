# Extension Consolidation — Implementation Plan

**Based on:** [Extension Consolidation Design](../specs/2026-05-03-extension-consolidation-design.md)  
**Status:** Draft  
**Updated:** 2026-05-03

---

## Overview

Reduce `package.json` extension entries from 35 to 5 using umbrella entry points with profile-based loading, plus inline/merge tiny extensions that add no structural value.

**Two independent tracks that can be done in parallel:**
1. **Umbrella entry points** (Phase 2) — new files, no existing code changes
2. **Tiny extension merges** (Phase 1) — edits to existing files, deletions

---

## Phase 1 — Tiny Extension Merges (Safe, No API Changes)

These consolidations are mechanical — no tool names, slash commands, or test expectations change.

### 1.1 Auto-compact merge → `session-lifecycle/auto-compact/index.ts`

**Files to merge:**
- `session-lifecycle/auto-compact/auto-compact.ts` (current entry point)
- `session-lifecycle/auto-compact/compact-config.ts` (separate entry point)

**Action:**
1. Create `session-lifecycle/auto-compact/index.ts` that exports both:
   - `createAutoCompact(options?)` from auto-compact.ts
   - `default` function that registers compact-config command + events from compact-config.ts
   - The `default` export calls both: `createAutoCompact()` and registers compact-config listeners
2. Delete `auto-compact.ts` and `compact-config.ts`

**Files changed:** `session-lifecycle/auto-compact/index.ts` (new), `auto-compact.ts` (del), `compact-config.ts` (del)

### 1.2 Session-name inline → `session-lifecycle/index.ts`

**Files to merge:**
- `session-lifecycle/session-name/session-name.ts` (51 lines, 0 deps)

**Action:**
1. Copy the `sessionNameFromMessage()` function and the `default` export logic into `session-lifecycle/index.ts` (Phase 2)
2. Delete `session-lifecycle/session-name/` directory

**Files changed:** `session-lifecycle/index.ts` (modified in Phase 2), `session-lifecycle/session-name/session-name.ts` (del), `session-lifecycle/session-name/` (del)

### 1.3 Skill-args inline → `session-lifecycle/index.ts`

**Files to merge:**
- `session-lifecycle/skill-args/index.ts` (entry, 9 lines)
- `session-lifecycle/skill-args/args.ts` (~100 lines)

**Action:**
1. Copy both `handleInput()` and `registerArgsHandler()` from `args.ts` into `session-lifecycle/index.ts` (Phase 2)
2. Delete `session-lifecycle/skill-args/` directory

**Files changed:** `session-lifecycle/index.ts` (modified in Phase 2), `session-lifecycle/skill-args/` (del)

### 1.4 Clipboard inline → `core-tools/index.ts`

**Files to merge:**
- `core-tools/clipboard.ts` (94 lines, OSC52 function, 0 deps)

**Action:**
1. Copy the `toBase64()`, `copyToClipboard()`, and `clipboardExtension` default export into `core-tools/index.ts` (Phase 2)
2. Delete `core-tools/clipboard.ts`

**Files changed:** `core-tools/index.ts` (modified in Phase 2), `core-tools/clipboard.ts` (del)

### 1.5 Delete wrapper-only index files

**Files to delete:**
- `core-tools/thinking-steps/index.ts` (try/catch wrapper, 11 lines)
- `core-tools/edit-session/index.ts` (wrapper, 17 lines)
- `core-tools/formatter/index.ts` (wrapper, 16 lines)
- `core-tools/subagent/index.ts` (6-line re-export)

**Action:**
- Delete all four files.
- In Phase 2, the umbrella imports the real implementations directly:
  - `core-tools/thinking-steps/thinking-steps.ts`
  - `core-tools/edit-session/extensions/edit-session-in-place.ts`
  - `core-tools/formatter/extensions/index.ts`
  - `core-tools/subagent/extension/index.ts`

---

## Phase 2 — Umbrella Entry Points (5 New Files + 1 Modified)

### 2.1 Shared profile reader → `shared/types.ts`

Add the profile type and a shared profile reader in the existing `shared/` module.

**Add to `shared/types.ts`:**
```typescript
export type Profile = "minimal" | "dev" | "full";
```

**Create `shared/profile.ts`:**
```typescript
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "../shared/pi-config.js";
import type { Profile } from "./types.js";

export function readProfile(): Profile {
  try {
    const p = join(getAgentDir(), "settings.json");
    if (!existsSync(p)) return "full";
    const s = JSON.parse(readFileSync(p, "utf-8"));
    if (s?.profile === "minimal" || s?.profile === "dev") return s.profile;
    return "full";
  } catch {
    return "full";
  }
}
```

*(Note: We use `shared/pi-config.ts`'s `getAgentDir()` instead of the pi SDK one to keep 0 runtime dependency on the SDK for path resolution.)*

### 2.2 Create `foundation/index.ts`

**Profile filter:** always loaded (all profiles include it)

**Imports and registers (in order):**
1. `secrets/secrets.ts` — default export
2. `permission/permission.ts` — default export
3. `safe-ops.ts` — default export
4. `context-window/context-window.ts` — default export

**Pattern:**
```typescript
import secrets from "../foundation/secrets/secrets.ts";
import permission from "../foundation/permission/permission.ts";
import safeOps from "../foundation/safe-ops.ts";
import contextWindow from "../foundation/context-window/context-window.ts";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  secrets(pi);
  permission(pi);
  safeOps(pi);
  contextWindow(pi);
}
```

*(No profile gate needed — foundation is always loaded.)*

### 2.3 Create `session-lifecycle/index.ts`

**Profile filter:** `dev` / `full` only

**Imports and registers (in order):**
1. `handoff.ts` — default export
2. `git-checkpoint/checkpoint.ts` — default export
3. `auto-compact/index.ts` — default export (merged file from Phase 1.1)
4. `context-pruning/index.ts` — default export
5. ↳ **inlined:** `session-name` logic (from Phase 1.2)
6. `session-recap/index.ts` — default export
7. `usage-extension/index.ts` — default export
8. ↳ **inlined:** `skill-args` logic (from Phase 1.3)

**Pattern:**
```typescript
import handoff from "./handoff.ts";
import checkpoint from "./git-checkpoint/checkpoint.ts";
import autoCompact from "./auto-compact/index.ts";
import contextPruning from "./context-pruning/index.ts";
import sessionRecap from "./session-recap/index.ts";
import usageExtension from "./usage-extension/index.ts";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readProfile } from "../shared/profile.ts";

// Inlined session-name
function sessionNameFromMessage(text: string): string { /* ... */ }

// Inlined skill-args (registerArgsHandler + handleInput)
import { readFileSync } from "node:fs";
import { getAgentDir, loadSkills, parseFrontmatter, stripFrontmatter } from "@mariozechner/pi-coding-agent";
// ... rest of inlined logic

export default function (pi: ExtensionAPI) {
  const profile = readProfile();
  if (profile === "minimal") return;

  handoff(pi);
  checkpoint(pi);
  autoCompact(pi);
  contextPruning(pi);

  // Inlined session-name
  pi.on("session_start", async (_event, ctx) => { /* ... */ });
  pi.on("input", async (event, ctx) => { /* ... */ });
  pi.on("session_shutdown", async (_event, ctx) => { /* ... */ });

  sessionRecap(pi);
  usageExtension(pi);

  // Inlined skill-args
  registerArgsHandler(pi);
}
```

### 2.4 Create `core-tools/index.ts`

**Profile filter:** `dev` includes subset A; `full` includes A + B

| Subset | Extensions | Profile |
|--------|-----------|---------|
| A (essential tools) | todo, plan-mode, plan-tracker, memory, formatter, thinking-steps, edit-session, clipboard, preset, code-actions | dev + full |
| B (heavy/orchestration) | sub-pi, subagent, ralph-loop, web-search, file-collector | full only |

**Imports:**
```
// Subset A — dev + full
todo          → ./todo/index.ts
plan-mode     → ./plan-mode.ts
plan-tracker  → ./plan-tracker/plan-tracker.ts
memory        → ./memory/index.ts
formatter     → ./formatter/extensions/index.ts          // direct, no wrapper
thinking-steps → ./thinking-steps/thinking-steps.ts       // direct, no wrapper
edit-session  → ./edit-session/extensions/edit-session-in-place.ts  // direct, no wrapper
clipboard     → inlined (from Phase 1.4)
preset        → ./preset/index.ts
code-actions  → ./code-actions/index.ts

// Subset B — full only
sub-pi       → ./sub-pi/index.ts
subagent     → ./subagent/extension/index.ts             // direct, no wrapper
ralph-loop   → ./ralph-loop/ralph-loop.ts
web-search   → ./web-search.ts
file-collector → ./file-collector/index.ts
```

**Pattern:**
```typescript
import todo from "./todo/index.ts";
import planMode from "./plan-mode.ts";
import planTracker from "./plan-tracker/plan-tracker.ts";
import memory from "./memory/index.ts";
import formatter from "./formatter/extensions/index.ts";
import thinkingSteps from "./thinking-steps/thinking-steps.ts";
import editSession from "./edit-session/extensions/edit-session-in-place.ts";
import preset from "./preset/index.ts";
import codeActions from "./code-actions/index.ts";
import subPi from "./sub-pi/index.ts";
import subagent from "./subagent/extension/index.ts";
import ralphLoop from "./ralph-loop/ralph-loop.ts";
import webSearch from "./web-search.ts";
import fileCollector from "./file-collector/index.ts";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readProfile } from "../shared/profile.ts";

// Inlined clipboard
function toBase64(text: string): string { /* ... */ }
function copyToClipboard(text: string): void { /* ... */ }
function clipboardExtension(pi: ExtensionAPI) { /* ... */ }

export default function (pi: ExtensionAPI) {
  const profile = readProfile();
  if (profile === "minimal") return;

  // Subset A — dev + full
  todo(pi);
  planMode(pi);
  planTracker(pi);
  memory(pi);
  formatter(pi);
  thinkingSteps(pi);
  editSession(pi);
  clipboardExtension(pi);
  preset(pi);
  codeActions(pi);

  // Subset B — full only
  if (profile === "full") {
    subPi(pi);
    subagent(pi);
    ralphLoop(pi);
    webSearch(pi);
    fileCollector(pi);
  }
}
```

### 2.5 Create `content-tools/index.ts`

**Profile filter:** `full` only

**Imports:**
```typescript
import github from "../content-tools/github.ts";
import repeat from "../content-tools/repeat/repeat.ts";
import filesWidget from "../content-tools/files-widget/index.ts";
import filePicker from "../content-tools/file-picker/index.ts";
import webFetch from "../content-tools/web-fetch/index.ts";
```

### 2.6 Create `authoring/index.ts`

**Profile filter:** `full` only

**Imports:**
```typescript
import commitHelper from "../authoring/commit-helper/commit-helper.ts";
import skillBootstrap from "../authoring/skill-bootstrap/skill-bootstrap.ts";
```

### 2.7 Update `package.json`

Replace the current 35-entry `pi.extensions` array with:

```json
"extensions": [
  "./foundation/index.ts",
  "./session-lifecycle/index.ts",
  "./core-tools/index.ts",
  "./content-tools/index.ts",
  "./authoring/index.ts",
  "pi-web-providers/dist/index.js",
  "pi-dialog"
]
```

**Keep:** `pi-web-providers` and `pi-dialog` (external packages, non-goal to touch).

---

## Execution Order

```
Phase 1 (no umbrella dependency)
  ├── 1.1 Auto-compact merge → auto-compact/index.ts
  ├── 1.2 Session-name → extract for inline (code ready for Phase 2)
  ├── 1.3 Skill-args → extract for inline (code ready for Phase 2)
  ├── 1.4 Clipboard → extract for inline (code ready for Phase 2)
  └── 1.5 Delete wrapper-only index files

Phase 2 (umbrellas + package.json)
  ├── 2.1 shared/profile.ts + shared/types.ts update
  ├── 2.2 foundation/index.ts
  ├── 2.3 session-lifecycle/index.ts (includes inlined 1.2 + 1.3)
  ├── 2.4 core-tools/index.ts (includes inlined 1.4)
  ├── 2.5 content-tools/index.ts
  ├── 2.6 authoring/index.ts
  └── 2.7 package.json update

Verification
  ├── Run full test suite
  ├── Verify no orphan imports (grep for deleted file paths)
  └── Manual: start pi with settings.json profile=*, verify correct subset loads
```

---

## What Does NOT Change

| Aspect | Status |
|--------|--------|
| Extension internal implementations | ✅ Unchanged |
| Tool names (`/todo`, `/plan`, etc.) | ✅ Unchanged |
| Slash commands | ✅ Unchanged |
| Test files | ✅ Unchanged (test files are never touched) |
| Test imports from implementation files | ✅ Must verify — tests import from implementation files, not wrapper index files |
| `pi-web-providers` entry | ✅ Unchanged |
| `pi-dialog` entry | ✅ Unchanged |

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Tests import from deleted wrapper index files | Grep for `from "./thinking-steps/index"`, `from "./edit-session/index"`, `from "./formatter/index"`, `from "./subagent/index"` before deleting. If found, update test imports to point to real implementation files. |
| `skill-args` shared state (`skillIndex` module var) breaks under umbrella lifetime | No change — umbrella calls `registerArgsHandler(pi)` which sets up the same listeners. Singleton state is per-process, same as today. |
| `session-name` `firstMessageSeen` state resets correctly | The inline code's `session_start` handler resets it. No change. |
| `auto-compact` and `compact-config` both export `default` | Merge into one file where the default export calls both. Ensure only one `default` export. |
| Profile reader has runtime dep on SDK | We use `shared/pi-config.ts`'s `getAgentDir()` which doesn't import the SDK. |
