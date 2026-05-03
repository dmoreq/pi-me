# Extension Consolidation Design

**Date:** 2026-05-03  
**Status:** Approved

## Problem

`package.json` registers 35 separate extension entry points. This causes two problems:

1. **Startup overhead** — each entry point runs independently, registering its own event listeners and initialising its own state. 35 registrations create measurable heap and startup-time cost.
2. **Hard to toggle** — disabling a feature requires editing `package.json` directly. There is no user-facing on/off mechanism.

## Goals

- Reduce `package.json` extension entries from 35 to 5.
- Add a profile system (`minimal` / `dev` / `full`) controlled via `settings.json`.
- Physically merge tiny extensions whose separate files add no architectural value.

---

## Approach A — Umbrella Entry Points

Replace 35 `package.json` entries with 5 category umbrellas:

```json
"extensions": [
  "./foundation/index.ts",
  "./session-lifecycle/index.ts",
  "./core-tools/index.ts",
  "./content-tools/index.ts",
  "./authoring/index.ts"
]
```

Each umbrella reads the profile from `~/.pi/agent/settings.json` at load time and calls only the extensions in that profile. Missing key defaults to `"full"` — existing installs are unaffected.

### Profile Membership

| Extension | minimal | dev | full |
|---|:---:|:---:|:---:|
| **foundation**: secrets, permission, safe-ops, context-window | ✓ | ✓ | ✓ |
| **session-lifecycle**: all | | ✓ | ✓ |
| **core-tools**: todo, plan-mode, plan-tracker, memory, formatter, thinking-steps, edit-session, clipboard, preset, code-actions | | ✓ | ✓ |
| **core-tools**: sub-pi, subagent, ralph-loop, web-search, file-collector | | | ✓ |
| **content-tools**: github, repeat, files-widget, file-picker, web-fetch | | | ✓ |
| **authoring**: commit-helper, skill-bootstrap | | | ✓ |

### Profile Configuration

```json
// ~/.pi/agent/settings.json
{
  "profile": "dev"
}
```

### Umbrella Implementation Pattern

Each umbrella follows the same pattern:

```typescript
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

type Profile = "minimal" | "dev" | "full";

function readProfile(): Profile {
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

export default function (pi: ExtensionAPI) {
  const profile = readProfile();
  // ... conditional loading
}
```

---

## Approach C — Tiny Extension Merges

Six consolidations where separate files add no value:

### 1. `auto-compact.ts` + `compact-config.ts` → `auto-compact/index.ts`
Same feature, same directory, currently two registered entries. Merge into a single `index.ts` that exports one default function calling both.

### 2. `session-name/session-name.ts` → inlined into `session-lifecycle/index.ts`
51 lines, zero external deps, no tests. Inline the implementation directly into the umbrella.

### 3. `skill-args/index.ts` + `args.ts` → inlined into `session-lifecycle/index.ts`
~100 lines total, single purpose (parse skill args on input). Inline into umbrella, delete the directory.

### 4. `clipboard.ts` → inlined into `core-tools/index.ts`
94 lines, single OSC52 function, no deps. Inline directly into the umbrella.

### 5. Wrapper-only index files deleted
`thinking-steps/index.ts`, `edit-session/index.ts`, `formatter/index.ts` are 17–19 line try/catch wrappers. Delete them; the umbrella calls the real implementation files directly with identical error handling.

### 6. `subagent/index.ts` (6-line re-export) deleted
The umbrella imports from `./subagent/extension/index.ts` directly.

---

## File Changes Summary

### Deleted files
- `session-lifecycle/auto-compact/auto-compact.ts` (merged into auto-compact/index.ts)
- `session-lifecycle/auto-compact/compact-config.ts` (merged into auto-compact/index.ts)
- `session-lifecycle/session-name/session-name.ts` + directory (inlined)
- `session-lifecycle/skill-args/index.ts` + `args.ts` + directory (inlined)
- `core-tools/clipboard.ts` (inlined)
- `core-tools/thinking-steps/index.ts` (wrapper deleted; `thinking-steps.ts` kept)
- `core-tools/edit-session/index.ts` (wrapper deleted; `extensions/` kept)
- `core-tools/formatter/index.ts` (wrapper deleted; `extensions/` kept)
- `core-tools/subagent/index.ts` (re-export deleted)

### New files
- `foundation/index.ts`
- `session-lifecycle/index.ts`
- `core-tools/index.ts`
- `content-tools/index.ts`
- `authoring/index.ts`
- `session-lifecycle/auto-compact/index.ts` (replaces auto-compact.ts + compact-config.ts)

### Modified files
- `package.json` — pi.extensions reduced from 35 to 5 entries

---

## Non-Goals

- Do not change any extension's internal implementation.
- Do not rename any tool names or slash commands.
- Do not change any tests.
- Do not touch `pi-web-providers` or `pi-dialog` (external packages, already minimal).
