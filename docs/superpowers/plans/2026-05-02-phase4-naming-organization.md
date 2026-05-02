# Phase 4 — Naming & Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document the plugin layout and naming rules in `docs/intro.md`, and reorder the `package.json` extension list to match the documented layer order — making the codebase self-explaining for future contributors.

**Architecture:** Two changes only: a `package.json` reorder (array element order, no additions or removals) and a documentation addition in `docs/intro.md`. No TypeScript files change. Run `npm test` after the reorder to confirm no behavioral regression.

**Tech Stack:** JSON (package.json), Markdown (docs/intro.md)

---

### Task 1: Document plugin conventions in `docs/intro.md`

**Files:**
- Modify: `docs/intro.md`

- [ ] **Step 1: Read the current `docs/intro.md`**

```bash
cat docs/intro.md
```

Note where the file currently ends — append the new section after the last heading.

- [ ] **Step 2: Add the Plugin Conventions section**

Append to the end of `docs/intro.md`:

```markdown
---

## Plugin Conventions

These rules apply to all extensions in pi-me. Follow them when adding a new plugin.

### Layout: subdirectory vs. loose file

A plugin gets its own subdirectory when it has **more than one source file** OR is **adopted from an external npm package**. Single-file native plugins live as loose `.ts` files in their category root.

```
core-tools/
  calc.ts           ← single-file native: loose .ts ✓
  oracle.ts         ← single-file native: loose .ts ✓
  pi-crew/          ← adopted package: subdirectory ✓
    index.ts
  subagent/         ← multi-file native: subdirectory ✓
    extension/
    runs/
    ...
```

Subdirectories signal internal structure (tests, a `-core.ts` split, sub-modules). A lone `index.ts` in an otherwise empty directory is noise.

### Naming: match the npm package name

The directory name for an adopted plugin matches the npm package name as typed in `npm install`. Scoped packages drop the `@scope/` prefix.

| npm install | Directory |
|---|---|
| `npm install pi-crew` | `core-tools/pi-crew/` |
| `npm install @touchskyer/memex` | `core-tools/memex/` |
| `npm install @companion-ai/feynman` | `content-tools/feynman/` |
| `npm install context-mode` | `content-tools/context-mode/` |

### Layer assignment

| Layer | What belongs here |
|---|---|
| `foundation/` | Always-on safety guards — secrets, permission, context guards. Run before anything else. |
| `session-lifecycle/` | Session boundary events, state, branding, compaction. Hooks into `session_start`, `turn_end`, `session_compact`. |
| `core-tools/` | Tools the LLM calls directly — task management, computation, orchestration, web access. |
| `content-tools/` | File and web resource utilities — document parsing, notebooks, web fetch, markdown rendering. |
| `authoring/` | AI-assisted content creation — commit helpers, plan annotation, skill generation. |

### Adopted package wrapper template

Use `registerAdoptedPackage()` from `shared/register-package.ts` for every adopted package:

```typescript
// core-tools/my-package/index.ts
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("my-package"),
    statusKey: "my-package",
    packageName: "my-package",
  });
```

For packages that also ship skills, pass `skillPaths`:

```typescript
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { registerAdoptedPackage } from "../../shared/register-package.js";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const skillsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "..", "..", "node_modules", "my-package", "skills"
);

export default (pi: ExtensionAPI) =>
  registerAdoptedPackage(pi, {
    importFn: () => import("my-package"),
    statusKey: "my-package",
    packageName: "my-package",
    skillPaths: [skillsDir],
  });
```
```

- [ ] **Step 3: Commit**

```bash
git add docs/intro.md
git commit -m "docs: add plugin conventions section to docs/intro.md"
```

---

### Task 2: Reorder the `package.json` extension list

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Read the current extension list to understand the current order**

```bash
node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); p.pi.extensions.forEach((e,i) => console.log(i+1, e))"
```

Note the current positions of all entries. The reorder preserves all entries — no additions or removals.

- [ ] **Step 2: Replace the `pi.extensions` array with the layered order**

The target order is: foundation → session-lifecycle (native first, adopted second) → core-tools (native first, adopted second) → content-tools (native first, adopted second) → authoring → external dist.

In `package.json`, replace the `pi.extensions` array value with:

```json
[
  "./foundation/secrets/secrets.ts",
  "./foundation/permission/permission.ts",
  "./foundation/context-window/context-window.ts",
  "./foundation/status-widget.ts",
  "./foundation/safe-ops.ts",
  "./foundation/extra-context-files.ts",
  "./session-lifecycle/git-checkpoint-new/checkpoint.ts",
  "./session-lifecycle/auto-compact/auto-compact.ts",
  "./session-lifecycle/auto-compact/compact-config.ts",
  "./session-lifecycle/agent-guidance/agent-guidance.ts",
  "./session-lifecycle/dcp/index.ts",
  "./session-lifecycle/handoff.ts",
  "./session-lifecycle/model-filter/index.ts",
  "./session-lifecycle/notifications.ts",
  "./session-lifecycle/preset/index.ts",
  "./session-lifecycle/session-name/session-name.ts",
  "./session-lifecycle/session-recap/index.ts",
  "./session-lifecycle/session-style.ts",
  "./session-lifecycle/skill-args/index.ts",
  "./session-lifecycle/startup-header.ts",
  "./session-lifecycle/tab-status/tab-status.ts",
  "./session-lifecycle/token-rate/token-rate.ts",
  "./session-lifecycle/usage-extension/index.ts",
  "./session-lifecycle/warp-notify/index.ts",
  "./core-tools/memory-mode.ts",
  "./core-tools/web-search.ts",
  "./core-tools/todo/index.ts",
  "./core-tools/calc.ts",
  "./core-tools/ask-user-question/index.ts",
  "./core-tools/ralph-loop/ralph-loop.ts",
  "./core-tools/plan-tracker/plan-tracker.ts",
  "./core-tools/code-actions/index.ts",
  "./core-tools/arcade/spice-invaders.ts",
  "./core-tools/arcade/picman.ts",
  "./core-tools/arcade/ping.ts",
  "./core-tools/arcade/tetris.ts",
  "./core-tools/arcade/mario-not/mario-not.ts",
  "./core-tools/clipboard.ts",
  "./core-tools/flicker-corp.ts",
  "./core-tools/oracle.ts",
  "./core-tools/btw/index.ts",
  "./core-tools/plan-mode.ts",
  "./core-tools/speedreading.ts",
  "./core-tools/ultrathink.ts",
  "./core-tools/file-collector/index.ts",
  "./core-tools/sub-pi/index.ts",
  "./core-tools/subagent/extension/index.ts",
  "./core-tools/greedysearch-pi/index.ts",
  "./core-tools/memex/index.ts",
  "./core-tools/pi-crew/index.ts",
  "./core-tools/pi-edit-session/index.ts",
  "./core-tools/pi-formatter/index.ts",
  "./core-tools/pi-lens/index.ts",
  "./core-tools/pi-link/index.ts",
  "./core-tools/pi-mcp-adapter/index.ts",
  "./core-tools/pi-memory/index.ts",
  "./core-tools/pi-processes/index.ts",
  "./core-tools/pi-stash/index.ts",
  "./core-tools/pi-thinking-steps/index.ts",
  "./content-tools/notebook.ts",
  "./content-tools/mermaid.ts",
  "./content-tools/github.ts",
  "./content-tools/repeat/repeat.ts",
  "./content-tools/files-widget/index.ts",
  "./content-tools/raw-paste/index.ts",
  "./content-tools/richard-files/index.ts",
  "./content-tools/web-fetch/index.ts",
  "./content-tools/context-mode/index.ts",
  "./content-tools/feynman/index.ts",
  "./content-tools/pi-docparser/index.ts",
  "./content-tools/pi-markdown-preview/index.ts",
  "./content-tools/pi-studio/index.ts",
  "./authoring/output-artifacts/output-artifacts.ts",
  "./authoring/commit-helper/commit-helper.ts",
  "./authoring/skill-bootstrap/skill-bootstrap.ts",
  "./authoring/plannotator/index.ts",
  "pi-web-providers/dist/index.js"
]
```

**Important:** Before saving, cross-check this list against the current `package.json` to confirm every entry that existed before is present exactly once. Run:

```bash
node -e "
const p = JSON.parse(require('fs').readFileSync('package.json','utf8'));
console.log('Count:', p.pi.extensions.length);
const dupes = p.pi.extensions.filter((e, i) => p.pi.extensions.indexOf(e) !== i);
if (dupes.length) console.log('DUPLICATES:', dupes);
else console.log('No duplicates');
"
```

Expected: `Count: 51` (after Phase 1), no duplicates.

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all tests pass. Extension load order change is safe — pi extensions use event hooks and do not depend on sibling extensions having loaded first (foundation extensions remain first as before).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "refactor: reorder package.json extensions by architecture layer"
```

---

### Task 3: Final verification

- [ ] **Step 1: Confirm extension count**

```bash
node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('Extensions:', p.pi.extensions.length)"
```

Expected: `Extensions: 51`.

- [ ] **Step 2: Confirm layer order is preserved**

```bash
node -e "
const p = JSON.parse(require('fs').readFileSync('package.json','utf8'));
const layers = p.pi.extensions.map(e => e.split('/')[0] + '/' + e.split('/')[1]);
console.log(layers.join('\n'));
"
```

Verify visually: foundation entries come first, then session-lifecycle, then core-tools, then content-tools, then authoring, then pi-web-providers.

- [ ] **Step 3: Run full test suite one final time**

```bash
npm test
```

Expected: all tests pass, 0 failures.
