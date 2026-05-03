# pi-me Codebase Refactoring — Implementation Plan

**Based on:** `docs/deep-review-report.md`
**Total tasks:** 22 across 6 phases
**Total estimated effort:** ~25-35 hours
**Strategy:** Each phase is independently testable + deployable. Phases are ordered by dependency (earlier phases may block later ones).

---

## Architecture Diagram (Target State)

```
pi-me/
├── foundation/              ← Always-on guards (unchanged core)
├── session-lifecycle/       ← Session-scoped only (notifications extracted)
├── core-tools/              ← All tools unified (including preset, model-filter)
│   └── shared/              ← NEW: shared AI utils, model picker
├── content-tools/           ← Unchanged
├── authoring/               ← Unchanged
├── shared/                  ← Consolidated config, state, notif utils
│   ├── pi-config.ts         ← 🎯 Zod-based config (all consumers)
│   ├── ext-state.ts         ← 🆕 State file helper
│   ├── notify-utils.ts      ← 📛 Renamed from notifications.ts
│   ├── model-picker.ts      ← 🆕 Shared TUI picker
│   └── ai-utils.ts          ← 🆕 Shared AI query helpers
├── skills/                  ← Unchanged
├── themes/                  ← Unchanged
└── docs/
    ├── conventions.md       ← 🆕 Naming/style conventions
    └── architecture.md      ← 🆕 Updated docs
```

---

## Phase 0: Pre-Flight Checks

Before any changes, verify the current state is clean.

### Task 0.1: Verify clean git state & test baseline

```bash
cd /Users/quy.doan/Workspace/personal/pi-me
git status          # No uncommitted changes
npm test            # All tests pass
```

**Files:** N/A
**Effort:** 5 min
**Blocking:** All subsequent phases

### Task 0.2: Audit all imports in package.json for unused dependencies

`lodash` is listed in `package.json` but has **zero imports** in the codebase. Also check `bunfig` usage — `dcp/config.ts` imports it, but `pi-config.ts` serves the same purpose.

**Files checked:**
- `package.json` (lodash removal candidate)
- `content-tools/web-fetch/settings.ts` (duplicates `pi-config.ts` readJsonc logic)
- `session-lifecycle/dcp/config.ts` (uses `bunfig` instead of `pi-config.ts`)

**Effort:** 15 min
**Output:** List of unused/duplicate dependencies for cleanup in Phase 2

---

## Phase 1: Quick-Win Mechanical Renames (No Behavior Change)

These are pure renames with zero behavioral impact. Each can be verified by checking imports still resolve.

### Task 1.1: Rename `shared/notifications.ts` → `shared/notify-utils.ts`

**Why:** Name collision with `session-lifecycle/notifications.ts` (the extension). Both are imported as `./notifications` contextually.

**Changes:**
```
mv shared/notifications.ts shared/notify-utils.ts
```

**Files to update:**
- `shared/index.ts` — update export path
- `session-lifecycle/notifications.ts` — update import from `../shared/notifications.js` → `../shared/notify-utils.js`

**Verification:**
```bash
grep -r "from.*shared/notifications" --include="*.ts" .    # Should find zero after change
npm test
```

**Effort:** 10 min

---

### Task 1.2: Rename `session-lifecycle/git-checkpoint-new/` → `session-lifecycle/git-checkpoint/`

**Why:** `-new` suffix is stale — there is no "old" version anymore.

**Changes:**
```
mv session-lifecycle/git-checkpoint-new session-lifecycle/git-checkpoint
```

**Files to update:**
- `package.json` — update path from `./session-lifecycle/git-checkpoint-new/checkpoint.ts` → `./session-lifecycle/git-checkpoint/checkpoint.ts`

**Verification:**
```bash
# Should show 0 references after update
grep -r "git-checkpoint-new" --include="*.ts" --include="*.json" . | grep -v node_modules | grep -v .worktrees
npm test
```

**Effort:** 10 min

---

### Task 1.3: Rename `session-lifecycle/dcp/` → `session-lifecycle/context-pruning/`

**Why:** `dcp` = "Dynamic Context Pruning" is an opaque abbreviation. Full names are more discoverable.

**Changes:**
```
mv session-lifecycle/dcp session-lifecycle/context-pruning
```

**Files to update:**
- `package.json` — update path
- Any internal imports (dcp modules import each other)

**Verification:**
```bash
grep -r "from.*dcp" --include="*.ts" . | grep -v node_modules | grep -v .worktrees
# Should be zero after update
npm test
```

**Effort:** 15 min

---

### Task 1.4: Rename `core-tools/arcade/mario-not/` → `core-tools/arcade/platformer/`

**Why:** `mario-not` is whimsical, not descriptive. Package entry is `mario-not.ts`.

**Changes:**
```
mv core-tools/arcade/mario-not core-tools/arcade/platformer
```

**Files to update:**
- `package.json` — update path
- Internal test imports
- Any references

**Effort:** 15 min

---

### Task 1.5: Standardize file naming to kebab-case

**Why:** Mixed camelCase (`safe-ops.ts`, `startup-header.ts`) and kebab-case throughout.

**Current non-compliant files:**
- `foundation/safe-ops.ts` — already kebab-case, OK
- `foundation/extra-context-files.ts` — already kebab-case, OK

**Check for any final stragglers:**
```bash
# Files that don't match kebab-case (lowercase with hyphens only)
find . -name "*.ts" ! -path "*/node_modules/*" ! -path "*/.worktrees/*" \
  ! -name "*-*.ts" ! -name "*.test.ts" | grep -v node_modules
```

**Effort:** 10 min

---

### Task 1.6: Add naming/structure conventions doc

**Create `docs/conventions.md`:**

```markdown
# pi-me Coding Conventions

## File & Directory Naming
- **kebab-case** for all file and directory names: `my-extension.ts`, `my-module/index.ts`
- Avoid abbreviations unless well-known (`dcp` → use full name `context-pruning`)
- Avoid whimsical names in production paths (`mario-not` → `platformer`)

## Extension Structure
- `index.ts` is the entry point (loads config, calls factory)
- `extension.ts` contains the factory function (testable without fs)
- Config uses `loadConfigOrDefault` from `shared/pi-config.ts`
- State files use `shared/ext-state.ts` helper

## Import Conventions
- Use `.js` extension for local imports (ESM)
- Use `node:` prefix for Node.js built-ins
- Group imports: node builtins → 3rd party → local
```

**Effort:** 15 min

---

## Phase 2: Configuration Consolidation (Centralize All Config Loading)

### Task 2.1: Remove `shared/settings.ts` — migrate to `loadConfigOrDefault`

**Why:** `shared/settings.ts` exists solely to load a `backgroundNotify` config subsection. It's a reimplementation of `loadConfigOrDefault` without zod validation.

**What happens to `getBackgroundNotifyConfig`?**
1. Define a zod schema for `BackgroundNotifyConfig` in `shared/pi-config.ts` (or alongside `shared/types.ts`)
2. Replace calls to `getBackgroundNotifyConfig(ctx)` with:
   ```typescript
   loadConfigOrDefault({
     filename: "settings.json",
     schema: z.object({ backgroundNotify: BackgroundNotifySchema }).partial(),
     defaults: { backgroundNotify: DEFAULT_BACKGROUND_NOTIFY },
   })
   ```
3. Remove `shared/settings.ts` entirely
4. Update `shared/index.ts` to not export from settings

**Files affected:**
- `shared/settings.ts` — DELETE
- `shared/pi-config.ts` — add `BackgroundNotifySchema`
- `shared/types.ts` — keep `BackgroundNotifyConfig` interface (or replace with zod infer)
- `shared/index.ts` — remove settings export
- `session-lifecycle/notifications.ts` — update import

**Verification:**
```bash
grep -r "settings" --include="*.ts" shared/ | grep -v node_modules
npm test
```

**Effort:** 2 hrs

---

### Task 2.2: Migrate `content-tools/web-fetch/settings.ts` to use `loadConfigOrDefault`

**Why:** `web-fetch/settings.ts` reimplements JSONC reading, field picking, and cascade merging — all of which `loadConfigOrDefault` already does.

**Before `web-fetch/settings.ts`:**
```typescript
// ~40 lines of: readJsonc, pick<T>, mergeConfig, toFetchToolConfig
```

**After:**
```typescript
import { loadConfigOrDefault } from "../../shared/pi-config.js";

const WebFetchSchema = z.object({
  verboseByDefault: z.boolean().default(false),
  defaultMaxChars: z.number().default(50000),
  defaultTimeoutMs: z.number().default(15000),
  // ... etc
});
```

Keep the cascade logic (project > global > defaults) using `loadConfig` with fallback.

**Files affected:**
- `content-tools/web-fetch/settings.ts` — refactor
- `content-tools/web-fetch/core/` — no changes (settings interface unchanged)

**Effort:** 1.5 hrs

---

### Task 2.3: Migrate inline `settingsManager` access to `loadConfigOrDefault`

**Why:** `session-style.ts` and `permission.ts` use `(ctx as any).settingsManager?.getSettings()` with no validation. This bypasses schema checking.

**Files affected:**
- `session-lifecycle/session-style.ts` — both `getEmojiConfig()` and `getColorConfig()` functions
- `foundation/permission/permission.ts` — any direct settings access

**Migration pattern:**
```typescript
// Before:
function getEmojiConfig(ctx: ExtensionContext): SessionEmojiConfig {
  const settings = (ctx as any).settingsManager?.getSettings() ?? {};
  return { ...DEFAULT_EMOJI_CONFIG, ...(settings.sessionEmoji ?? {}) };
}

// After:
function getEmojiConfig(): SessionEmojiConfig {
  return loadConfigOrDefault({
    filename: "settings.json",
    schema: z.object({ sessionEmoji: EmojiConfigSchema }).partial(),
    defaults: { sessionEmoji: DEFAULT_EMOJI_CONFIG },
  }).sessionEmoji;
}
```

**Effort:** 2 hrs

---

### Task 2.4: Migrate `session-lifecycle/dcp/config.ts` from `bunfig` to `loadConfigOrDefault`

**Why:** `dcp/config.ts` uses `bunfig` library. Since `pi-config.ts` already provides jsonc parsing + zod validation, migrate DCP config loading to it. This also reduces the dependency surface.

**Files affected:**
- `session-lifecycle/dcp/config.ts` (or `session-lifecycle/context-pruning/config.ts` after rename)
- `package.json` — evaluate if `bunfig` can be removed

**Effort:** 30 min

---

### Task 2.5: Add `shared/ext-state.ts` — state file helper

**Why:** Multiple extensions write state files to different locations with different naming conventions. A shared helper ensures consistency.

```typescript
// shared/ext-state.ts
export function getExtStatePath(extensionName: string): string {
  return path.join(homedir(), ".pi", "ext-state", `${extensionName}.json`);
}

export async function readExtState<T>(extensionName: string): Promise<T | null> { ... }
export async function writeExtState<T>(extensionName: string, state: T): Promise<void> { ... }
export function readExtStateSync<T>(extensionName: string): T | null { ... }
export function writeExtStateSync<T>(extensionName: string, state: T): void { ... }
```

**Consumers to migrate:**
- `session-lifecycle/session-style.ts` — `COLOR_FILE` → `getExtStatePath("session-color")`
- `session-lifecycle/auto-compact/compact-config.ts` — `CONFIG_FILE` → `getExtStatePath("compact-config")`
- `foundation/permission/permission.ts` — `allowed-commands.json` → `getExtStatePath("allowed-commands")`
- `session-lifecycle/notifications.ts` — settings write path

**Effort:** 2 hrs

---

## Phase 3: Shared Component Extraction

### Task 3.1: Extract shared model picker TUI

**Why:** `compact-config.ts`, `oracle.ts`, and `preset/index.ts` all implement a model selection TUI with filtering, keyboard navigation, and selection. This is ~150 lines of duplicated code.

**Extract `shared/model-picker.ts`:**

```typescript
export interface ModelPickerItem {
  key: string;
  name: string;
  provider: string;
  contextWindow: number;
  metadata?: Record<string, unknown>;
}

export async function pickModel(
  ctx: ExtensionContext,
  items: ModelPickerItem[],
  options?: { title?: string; showContextWindow?: boolean }
): Promise<string | null> { ... }
```

**Files affected:**
- `shared/model-picker.ts` — NEW
- `session-lifecycle/auto-compact/compact-config.ts` — refactor
- `core-tools/oracle.ts` — refactor  
- `session-lifecycle/preset/index.ts` — refactor

**Effort:** 3 hrs

---

### Task 3.2: Extract shared AI query helpers

**Why:** `oracle.ts`, `btw/btw.ts`, and `speedreading.ts` each independently:
1. Resolve a model from provider/model ID
2. Format messages via `convertToLlm()`
3. Call `complete()` or `completeSimple()`
4. Handle errors and render output

**Extract `core-tools/shared/ai-utils.ts`:**

```typescript
export interface AIQueryOptions {
  model: { provider: string; id: string };
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
}

export async function queryModel(ctx: ExtensionContext, options: AIQueryOptions): Promise<string>;

export function resolveModel(
  ctx: ExtensionContext,
  provider: string,
  modelId: string
): Model | null;

export function formatMessages(ctx: ExtensionContext, scope?: "recent" | "all"): Message[];
```

**Files affected:**
- `core-tools/shared/` — NEW directory
- `core-tools/shared/ai-utils.ts` — NEW
- `core-tools/oracle.ts` — refactor
- `core-tools/btw/btw.ts` — refactor
- `core-tools/speedreading.ts` — refactor

**Note:** Do NOT extract `flicker-corp.ts` — it's cosmetic/visual only, not AI querying.

**Effort:** 4 hrs

---

## Phase 4: Extension Structure Unification

### Task 4.1: Unify all adopted plugin wrappers

**Current state (inconsistent):**

| Plugin | Wrapper Pattern |
|--------|----------------|
| `pi-crew` | `registerAdoptedPackage` |
| `pi-memory` | `registerAdoptedPackage` |
| `pi-formatter` | `LazyModule` |
| `pi-stash` | Direct default export |
| `pi-docparser` | Manual wrapper (inlined) |
| `pi-markdown-preview` | Direct default export |
| `greedysearch-pi` | Direct import + manual init |

**Target pattern for ALL adopted wrappers:**

```typescript
import { registerAdoptedPackage } from "../../shared/register-package.js";

export default function (pi: ExtensionAPI) {
  registerAdoptedPackage(pi, {
    importFn: () => import("package-name"),
    statusKey: "package-name",
    packageName: "Package Name",
    skillPaths: [],  // if applicable
  });
}
```

**Files to update:**
- `core-tools/pi-stash/index.ts`
- `core-tools/pi-formatter/index.ts`
- `content-tools/pi-docparser/index.ts`
- `content-tools/pi-markdown-preview/index.ts`
- `core-tools/greedysearch-pi/index.ts`

**Effort:** 1 hr

---

### Task 4.2: Ensure all lazy-loaded packages use `LazyModule`

After Task 4.1, verify each plugin uses `LazyModule` internally if it has heavy dependencies. The `registerAdoptedPackage` helper already handles this, but audit to make sure.

**Effort:** 30 min

---

## Phase 5: Notification System Cleanup

### Task 5.1: Extract funny messages from `session-lifecycle/notifications.ts`

**Why:** The extension does two unrelated things: (a) background task notification and (b) funny working messages. Extract food/cooking humor into a standalone extension.

**Create `session-lifecycle/funny-messages.ts`:**

```typescript
// Extracted from session-lifecycle/notifications.ts
const FUNNY = [
  "Simmering... (esc to interrupt)", "Julienning... (esc to interrupt)",
  // ... all cooking puns
];

export default function (pi: ExtensionAPI) {
  // Register /fun-working command
  // Hook agent_start to set working message
}
```

**Update `session-lifecycle/notifications.ts`:** Remove all funny message code, imports, and state.

**Update `package.json`:** Add `./session-lifecycle/funny-messages.ts` to extensions list.

**Effort:** 1 hr

---

### Task 5.2: Final cleanup of notification module boundaries

After Phase 2 (config consolidation) and Task 5.1:
- `shared/notify-utils.ts` → pure utilities (beep, speak, bring-to-front, pronunciations) ✅
- `session-lifecycle/notifications.ts` → dedicated to background task notification ✅
- `session-lifecycle/funny-messages.ts` → dedicated to funny working messages ✅
- `session-lifecycle/warp-notify/` → stays as Warp-specific transport ✅

**Verify no cross-contamination** between the modules.

**Effort:** 15 min

---

## Phase 6: Directory Reorganization & Scope Clarification

### Task 6.1: Move `session-lifecycle/preset/` → `core-tools/preset/`

**Why:** `preset` is a model configuration tool, not a session lifecycle concern. It belongs with `/oracle`, model selection, and similar tooling.

**Changes:**
```
mv session-lifecycle/preset core-tools/preset
```

**Files to update:**
- `package.json` — update path
- Internal imports within preset modules

**Effort:** 30 min

---

### Task 6.2: Move `session-lifecycle/model-filter/` → `core-tools/model-filter/`

**Why:** Same reasoning as Task 6.1 — model filtering is a tool concern, not lifecycle.

**Changes:**
```
mv session-lifecycle/model-filter core-tools/model-filter
```

**Files to update:**
- `package.json`

**Effort:** 15 min

---

### Task 6.3: Remove empty/obsolete directories

**Files to clean up:**
- `tests/` — empty directory (remove if truly unused)
- Verify `scripts/reinstall.sh` is still useful

**Effort:** 10 min

---

## Rollback Strategy

Every rename in Phase 1 is a `git mv` — git tracks the rename. If something breaks:
```bash
git checkout HEAD -- <file>
```
Re-run `npm test`.

For code refactors (Phase 2-5), each task is independently testable. No task should break more than its own module + direct consumers.

---

## Verification Checklist (Run After Each Phase)

```bash
# 1. All tests pass
npm test

# 2. No dangling imports to deleted files
grep -r "from.*shared/settings" --include="*.ts" . | grep -v node_modules
# → should be zero after Phase 2

# 3. No references to old names
grep -r "git-checkpoint-new\|/dcp/" --include="*.ts" --include="*.json" . | grep -v node_modules | grep -v .worktrees
# → should be zero after Phase 1

# 4. Package.json extensions list is valid (all paths resolve)
for ext in $(grep -oP '"[^"]+\.ts"' package.json | tr -d '"'); do
  test -f "$ext" || echo "MISSING: $ext"
done
# → should produce no output
```

---

## Summary Table

| Phase | Tasks | Files Changed | Effort | Risk |
|-------|-------|---------------|--------|------|
| **0** Pre-flight | 2 | N/A | 20 min | None |
| **1** Mechanical Renames | 6 | ~15 files | 1.5 hrs | 🟢 Low |
| **2** Config Consolidation | 5 | ~10 files | 8 hrs | 🟡 Medium |
| **3** Shared Components | 2 | ~8 files (3 new) | 7 hrs | 🟡 Medium |
| **4** Extension Unification | 2 | ~6 files | 1.5 hrs | 🟢 Low |
| **5** Notification Cleanup | 2 | ~4 files (1 new) | 1.5 hrs | 🟢 Low |
| **6** Directory Reorg | 3 | ~5 files | 1 hr | 🟡 Medium |
| **Total** | **22** | **~50 files** | **~25 hrs** | |
