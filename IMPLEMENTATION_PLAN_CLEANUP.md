# π-me Full Codebase Cleanup — Comprehensive Implementation Plan

**Date:** 2025-05-03  
**Status:** Ready for execution  
**Total Effort:** 12-16 hours across 3 releases  
**Target:** Achieve production-grade cleanliness, 100% code coverage, zero debt

---

## Executive Summary

The π-me codebase has grown to 51K LOC across 239 TS files with excellent test coverage (598 tests). However, the v0.3.0 refactoring exposed **systemic issues that compound across the entire architecture**:

- **Incomplete merges** (context-intel, code-quality, web-tools)
- **Dead code paths** (preset, edit-session, files-widget already deleted)
- **Inconsistent patterns** (direct imports vs barrel exports, old vs new lifecycle)
- **Documentation gaps** (4 docs describe old separation, redundant descriptions)
- **Scattered boilerplate** (telemetry registration, lifecycle hooks, error handling)

This plan addresses **all systemic issues** across the entire codebase in a **3-release timeline** with minimal disruption.

---

## Scope & Approach

### What We're Cleaning Up

| Category | Items | Status | Effort |
|----------|-------|--------|--------|
| **Incomplete Merges** | 3 (auto-compact, handoff, session-recap) | Identified | 4h |
| **Dead Code** | 5 modules (removed in v0.3.0, cleanup needed) | Identified | 2h |
| **Inconsistent Patterns** | Foundation layer (10+ inconsistencies) | Identified | 3h |
| **Documentation** | 4 master docs + 40 extension docs | Identified | 3h |
| **Test Consolidation** | 598 tests (reorganize, eliminate duplication) | Identified | 2h |
| **Architecture Cleanup** | Extension loading, telemetry, error handling | Identified | 4h |

**Total:** ~18 hours of focused work

### Approach: 3-Release Strategy

```
v0.3.0 ✅ DONE
  ├─ 7 extensions merged
  ├─ 598 tests passing
  └─ Foundation laid

v0.3.0.1 (Hotfix, THIS WEEK)
  ├─ Load ContextIntelExtension (critical)
  ├─ Verify telemetry triggers
  └─ Minimum viable fix

v0.3.1 (Soft Deprecation, 1-2 WEEKS)
  ├─ Deprecate legacy modules (wrappers)
  ├─ Consolidate tests
  ├─ Update documentation
  └─ Backward compatible

v0.4.0 (Deep Cleanup, 1 MONTH)
  ├─ Hard remove deprecated modules
  ├─ Unify patterns across codebase
  ├─ Refactor foundation layer
  ├─ Consolidate documentation
  └─ Final architecture cleanup

v0.5.0 (Polish, 2 MONTHS, optional)
  ├─ Advanced optimization
  ├─ Performance tuning
  ├─ 100% test coverage
  └─ Enterprise-grade release
```

---

## Phase 1: v0.3.0.1 Hotfix (THIS WEEK) — 25 minutes

**Goal:** Fix critical issue (ContextIntelExtension never loaded)

### Task 1.1: Load ContextIntelExtension

**File:** `session-lifecycle/index.ts`

```typescript
// BEFORE
import autoCompact from "./auto-compact/index.ts";
import handoff from "./handoff.ts";
import sessionRecap from "./session-recap/index.ts";

export default function (pi: ExtensionAPI) {
  autoCompact(pi);
  handoff(pi);
  sessionRecap(pi);
  // ... other extensions
}

// AFTER
import { ContextIntelExtension } from "./context-intel";

export default function (pi: ExtensionAPI) {
  // Load merged context-intel (v0.3.0 redesign)
  new ContextIntelExtension(pi).register();

  // Comment out legacy extensions (still loaded for v0.3.0.1 compat)
  // autoCompact(pi);     // ⚠️ DEPRECATED: merged into context-intel
  // handoff(pi);         // ⚠️ DEPRECATED: merged into context-intel
  // sessionRecap(pi);    // ⚠️ DEPRECATED: merged into context-intel
  
  // ... keep other extensions
}
```

**Effort:** 5 minutes  
**Risk:** Very Low (just loads the already-implemented extension)  
**Test:** npm test (expect 598 passing)

---

### Task 1.2: Verify Telemetry Fires

**Verify:** All 9 telemetry automation triggers

```bash
npm test
# Look for in test output:
# ✓ contextDepth trigger fires at ≥50 messages
# ✓ highActivityDetected trigger fires at >5 tool calls
# ✓ fileInvolvementDetected trigger fires at >10 files
# ✓ planCreated trigger fires
# ✓ parallelTasksDetected trigger fires at ≥3 tasks
# ✓ fileIndexed trigger fires
# ✓ tasksNormalized trigger fires
# ✓ webSearched trigger fires
# ✓ qualityCheckRan trigger fires
```

**Effort:** 5 minutes  
**Risk:** Very Low  
**Test:** npm test (expect 598 passing, 9 triggers working)

---

### Task 1.3: Commit & Tag

```bash
git add -A
git commit -m "fix(hotfix): load ContextIntelExtension in session-lifecycle

v0.3.0.1 Hotfix

This critical fix loads the ContextIntelExtension that was implemented
in v0.3.0 but never actually registered in session-lifecycle/index.ts.

Result:
  ✅ All 9 telemetry automation triggers now fire
  ✅ Context management features (handoff, recap, compact) working
  ✅ Ready for v0.3.1 soft deprecation release

Fixes:
  - ContextIntelExtension never loaded
  - 3 of 9 telemetry triggers not firing
  - User not seeing automation hints"

git tag v0.3.0.1
```

**Effort:** 5 minutes  
**Risk:** Very Low

---

## Phase 2: v0.3.1 Soft Deprecation (1-2 WEEKS) — 4 hours

**Goal:** Deprecate legacy modules gracefully, consolidate tests, update docs

### Task 2.1: Create Deprecation Wrappers (30 minutes)

#### 2.1.1: auto-compact wrapper

**File:** `session-lifecycle/auto-compact/index.ts`

```typescript
// BEFORE: 300 LOC of auto-compact implementation
// AFTER: Deprecation wrapper

export default function (pi: ExtensionAPI) {
  console.warn(
    "[DEPRECATED] auto-compact merged into context-intel in v0.3.0\n" +
    "  The auto-compact functionality is now part of ContextIntelExtension.\n" +
    "  This adapter will be removed in v0.4.0.\n" +
    "  No action needed — compaction still works automatically."
  );

  // Auto-compact is now handled by ContextIntelExtension
  // This is a no-op wrapper for backwards compatibility
}
```

**Effort:** 5 minutes  
**Impact:** 300 LOC → 10 LOC stub

#### 2.1.2: handoff wrapper

**File:** `session-lifecycle/handoff.ts`

```typescript
// BEFORE: 150 LOC of handoff implementation
// AFTER: Deprecation wrapper

export default function (pi: ExtensionAPI) {
  console.warn(
    "[DEPRECATED] handoff merged into context-intel in v0.3.0\n" +
    "  Use: /handoff [goal] — same interface, better integration.\n" +
    "  This adapter will be removed in v0.4.0.\n" +
    "  Migration: No changes needed, command still works."
  );

  // Handoff is now handled by ContextIntelExtension
  // This is a no-op wrapper for backwards compatibility
}
```

**Effort:** 5 minutes  
**Impact:** 150 LOC → 10 LOC stub

#### 2.1.3: session-recap wrapper

**File:** `session-lifecycle/session-recap/index.ts`

```typescript
// BEFORE: 80 LOC of session-recap implementation
// AFTER: Deprecation wrapper

export default function (pi: ExtensionAPI) {
  console.warn(
    "[DEPRECATED] session-recap merged into context-intel in v0.3.0\n" +
    "  Use: /recap — same interface, better integration.\n" +
    "  This adapter will be removed in v0.4.0.\n" +
    "  Migration: No changes needed, command still works."
  );

  // Session recap is now handled by ContextIntelExtension
  // This is a no-op wrapper for backwards compatibility
}
```

**Effort:** 5 minutes  
**Impact:** 80 LOC → 10 LOC stub

#### 2.1.4: Keep the loaded wrappers in index.ts

**File:** `session-lifecycle/index.ts` (from v0.3.0.1)

```typescript
import autoCompact from "./auto-compact/index.ts";      // ✅ Now wrapper
import handoff from "./handoff.ts";                     // ✅ Now wrapper
import sessionRecap from "./session-recap/index.ts";    // ✅ Now wrapper
import { ContextIntelExtension } from "./context-intel";// ✅ Real impl

export default function (pi: ExtensionAPI) {
  // Load real implementation (v0.3.0 merged)
  new ContextIntelExtension(pi).register();

  // Keep wrappers loaded (shows deprecation warnings)
  // Users see warnings but everything still works
  autoCompact(pi);       // Shows: "[DEPRECATED] merged into context-intel"
  handoff(pi);           // Shows: "[DEPRECATED] merged into context-intel"
  sessionRecap(pi);      // Shows: "[DEPRECATED] merged into context-intel"
  
  // ... other extensions
}
```

**Effort:** 2 minutes (just comments)  
**Impact:** Users see warnings, features still work

---

### Task 2.2: Consolidate Tests (1 hour)

#### 2.2.1: Move auto-compact tests

```bash
# Current structure
session-lifecycle/auto-compact/         # ← tests here (if any)

# After consolidation
session-lifecycle/context-intel/tests/
├── auto-compact/                      # ← moved here
│   └── [test files]
├── handoff/
│   └── [test files]
├── recap/
│   └── [test files]
└── [other context-intel tests]
```

**Steps:**
1. Create `session-lifecycle/context-intel/tests/auto-compact/`
2. Move auto-compact test files there
3. Update imports in test files (path changes)
4. Run: `npm test` (verify all pass)

**Effort:** 15 minutes  
**Files:** Move any `auto-compact/*.test.ts` files

#### 2.2.2: Move handoff tests

```bash
# Move handoff.test.ts to context-intel/tests/handoff/
session-lifecycle/context-intel/tests/handoff/
└── handoff.test.ts
```

**Effort:** 10 minutes

#### 2.2.3: Move session-recap tests

```bash
# Move session-recap/tests/* to context-intel/tests/recap/
session-lifecycle/context-intel/tests/recap/
├── recap.test.ts
└── [other recap tests]
```

**Effort:** 10 minutes

#### 2.2.4: Run full test suite

```bash
npm test
# Expect: 598+ tests passing
#         0 tests failing
#         All context-intel tests consolidated
```

**Effort:** 5 minutes  
**Risk:** Low (just moving tests, not changing code)

---

### Task 2.3: Update Documentation (1.5 hours)

#### 2.3.1: Update README.md

**Current Problem:**
```markdown
# Session Lifecycle — State & Branding
| Feature | Purpose |
|---------|---------|
| **Auto Compact** | Triggers context compaction... |
| **Handoff** | `/handoff` generates... |
| **Session Recap** | One-line summary... |
```

**After (Consolidated):**
```markdown
# Session Lifecycle — Context Intelligence
| Feature | Purpose |
|---------|---------|
| **Context Intelligence** | Merged: auto-compact, handoff, session-recap. Intelligently manages conversation context with automatic compaction, session transfer, and summarization. |
```

**Effort:** 30 minutes  
**Files:** README.md

#### 2.3.2: Update EXTENSIONS_TABLE.md

Remove redundant rows:
```markdown
# BEFORE (redundant)
| auto-compact | Auto-compress messages at threshold | ... |
| handoff | Transfer context to new session | ... |
| session-recap | Generate session summary | ... |
| context-intel | Merged features | ... |

# AFTER (consolidated)
| context-intel | Merged: auto-compact, handoff, session-recap | ... |
```

**Effort:** 20 minutes  
**Files:** EXTENSIONS_TABLE.md

#### 2.3.3: Update EXTENSION_REVIEW.md

Merge 3 sections into 1:
```markdown
# BEFORE (3 sections)
### 2. **Auto Compact** (`auto-compact/`)
### 3. **Handoff** (`handoff.ts`)
### 4. **Session Recap** (`session-recap/`)

# AFTER (1 section)
### 1. **Context Intelligence** (`context-intel/`)
  Merged features:
  - Auto-compact: `onAgentEnd()` detects activity, triggers at threshold
  - Handoff: `buildHandoffPrompt()` creates context for new session
  - Session Recap: `buildRecapPrompt()` generates summaries
```

**Effort:** 20 minutes  
**Files:** EXTENSION_REVIEW.md

#### 2.3.4: Add v0.3.1 Deprecation Notice to CHANGELOG.md

```markdown
## [0.3.1] - 2025-05-10

### Deprecations

- ⚠️ **auto-compact** merged into context-intel (deprecated, will remove in 0.4.0)
- ⚠️ **handoff** merged into context-intel (deprecated, will remove in 0.4.0)
- ⚠️ **session-recap** merged into context-intel (deprecated, will remove in 0.4.0)

**Migration:** No action needed. Features still work, but deprecation warnings shown.

### Cleanup

- Soft-deprecated 3 legacy session-lifecycle modules
- Consolidated tests under context-intel
- Updated documentation to reflect mergers
- Added deprecation warnings for graceful migration

### Notes

All deprecated modules will be hard-removed in v0.4.0 (planned 1 month later).
Users have one release cycle to test the merged implementation.
```

**Effort:** 10 minutes  
**Files:** CHANGELOG.md

#### 2.3.5: Update AUDIT_SUMMARY.md & CLEANUP_PLAN.md

Mark as "In Progress: v0.3.1":
```markdown
Status: ✅ Complete (v0.3.1 released)

Remaining work: See CLEANUP_PLAN.md Phase 3 (v0.4.0 hard removal)
```

**Effort:** 10 minutes

---

### Task 2.4: Test & Release (30 minutes)

```bash
# Full test run
npm test
# Expect: 598+ tests passing
#         0 failures
#         All warnings shown for deprecated modules

# Verify deprecation warnings appear
# (Run a few commands that trigger deprecated modules)

# Commit with summary
git add -A
git commit -m "v0.3.1: soft deprecate legacy session-lifecycle modules

Deprecations:
  - auto-compact (merged into context-intel)
  - handoff (merged into context-intel)
  - session-recap (merged into context-intel)

Changes:
  - Created deprecation wrappers (show console warnings)
  - Consolidated tests under context-intel
  - Updated README.md, EXTENSIONS_TABLE.md, EXTENSION_REVIEW.md, CHANGELOG.md

Result:
  ✅ Users see deprecation warnings but features work
  ✅ Backward compatible
  ✅ Clear migration path to v0.4.0
  ✅ 598 tests passing

Timeline:
  v0.3.1: Soft deprecation (this release)
  v0.4.0: Hard removal (1 month later)"

git tag v0.3.1
```

**Effort:** 10 minutes

---

## Phase 3: v0.4.0 Deep Cleanup (1 MONTH) — 8 hours

**Goal:** Hard remove deprecated code, unify patterns, refactor foundation

### Task 3.1: Remove Deprecated Modules (1 hour)

#### 3.1.1: Delete auto-compact directory

```bash
rm -rf session-lifecycle/auto-compact/
```

**Files to remove:**
- `session-lifecycle/auto-compact/index.ts` (deprecated wrapper)
- `session-lifecycle/auto-compact/tests/` (if any tests remain)

**Update:** `session-lifecycle/index.ts`
```typescript
// BEFORE
import autoCompact from "./auto-compact/index.ts";
// ...
autoCompact(pi);

// AFTER
// [REMOVED] auto-compact merged into context-intel in v0.3.1
```

**Effort:** 10 minutes

#### 3.1.2: Delete handoff.ts

```bash
rm session-lifecycle/handoff.ts
```

**Update:** `session-lifecycle/index.ts`
```typescript
// BEFORE
import handoff from "./handoff.ts";
// ...
handoff(pi);

// AFTER
// [REMOVED] handoff merged into context-intel in v0.3.1
```

**Effort:** 5 minutes

#### 3.1.3: Delete session-recap directory

```bash
rm -rf session-lifecycle/session-recap/
```

**Update:** `session-lifecycle/index.ts`
```typescript
// BEFORE
import sessionRecap from "./session-recap/index.ts";
// ...
sessionRecap(pi);

// AFTER
// [REMOVED] session-recap merged into context-intel in v0.3.1
```

**Effort:** 5 minutes

#### 3.1.4: Verify remaining files in session-lifecycle/

```bash
ls -la session-lifecycle/
# Should show:
# ✅ context-intel/             (MAIN — merged features)
# ✅ context-pruning/           (keep — specialized)
# ✅ git-checkpoint/            (keep)
# ✅ usage-extension/           (keep)
# ✅ welcome-overlay/           (keep)
# ✅ session-name.ts            (keep — extracted)
# ✅ skill-args.ts              (keep — extracted)
# ✅ index.ts                   (UPDATED)
# ❌ auto-compact/              (DELETED)
# ❌ handoff.ts                 (DELETED)
# ❌ session-recap/             (DELETED)
```

**Effort:** 5 minutes

---

### Task 3.2: Unify Extension Patterns (2 hours)

#### 3.2.1: Audit all extensions

**Goal:** Ensure all extensions follow ExtensionLifecycle pattern

```bash
# Count extensions using ExtensionLifecycle
grep -r "extends ExtensionLifecycle" . --include="*.ts" | wc -l
# Target: 40+ extensions using it (currently 7 new ones)

# Count old-style extensions (direct pi registration)
grep -r "pi.registerCommand\|pi.on\|pi.registerTool" . --include="*.ts" | wc -l
# Target: Reduce by consolidating into lifecycle hooks
```

**Effort:** 15 minutes (audit only)

#### 3.2.2: Standardize loading patterns

**Current Problems:**
```typescript
// ❌ Inconsistent: direct imports
import autoCompact from "./auto-compact/index.ts";
import { registerSessionName } from "./session-name.ts";

// ✅ Consistent: barrel exports
export { ContextIntelExtension } from "./context-intel";
```

**Solution:** Use barrel exports for all public APIs

```typescript
// session-lifecycle/index.ts
import { ContextIntelExtension } from "./context-intel";       // ✅ Barrel
import { GitCheckpointExtension } from "./git-checkpoint";    // ✅ Barrel
import { ContextPruningExtension } from "./context-pruning";  // ✅ Barrel
// ... etc

export default function (pi: ExtensionAPI) {
  new ContextIntelExtension(pi).register();
  new GitCheckpointExtension(pi).register();
  new ContextPruningExtension(pi).register();
  // ... etc
}
```

**Benefits:**
- Single import pattern
- Easy refactoring (no cascading path changes)
- Clear public API
- Better tree-shaking

**Effort:** 45 minutes

**Files to Update:**
- All `session-lifecycle/*/index.ts` (add exports)
- All `core-tools/*/index.ts` (add exports)
- All `content-tools/*/index.ts` (add exports)
- Umbrella entry points (consistent loading)

#### 3.2.3: Standardize telemetry registration

**Current:**
```typescript
// ❌ Varied: some use registerPackage, some direct getTelemetry

// Pattern 1: ExtensionLifecycle (new)
class MyExtension extends ExtensionLifecycle {
  constructor(pi) {
    super(pi);
    registerPackage({ name, version, ... });
  }
}

// Pattern 2: Direct registration (old)
export default function (pi) {
  const t = getTelemetry();
  if (t) {
    t.register({ name, version, ... });
    t.heartbeat("name");
  }
  // ... extension code
}
```

**Solution:** All extensions use ExtensionLifecycle

**Effort:** 30 minutes

**Files to Update:**
- Foundation layer (4 extensions)
- Session lifecycle (legacy extensions being refactored)
- Core tools (20 extensions)

---

### Task 3.3: Refactor Foundation Layer (2 hours)

**Goal:** Make foundation layer follow SOLID principles

#### 3.3.1: Audit Foundation Extensions

```typescript
// foundation/index.ts (current: 30 LOC)
export default function (pi: ExtensionAPI) {
  const t = getTelemetry();
  if (t) {
    t.register({ name: "foundation", ... });
    t.heartbeat("foundation");
  }

  void secrets(pi);
  permission(pi);
  safeOps(pi);
  contextWindow(pi);
}
```

**Issues:**
- ❌ Telemetry boilerplate repeated
- ❌ No unified error handling
- ❌ No lifecycle hooks
- ✅ Calling old-style functions (not ExtensionLifecycle)

#### 3.3.2: Create Foundation Base Class

**File:** `foundation/foundation-extension.ts`

```typescript
import { ExtensionLifecycle } from "../shared/lifecycle.ts";

/**
 * Base class for foundation extensions (always-on safety guardrails)
 */
export abstract class FoundationExtension extends ExtensionLifecycle {
  readonly tier = "foundation";
  protected abstract readonly name: string;
  protected abstract readonly version: string;
  protected abstract readonly description: string;

  async onSessionStart() {
    // Default: no-op (can override)
  }

  async onError(error: Error) {
    this.notify(`[Foundation] Error: ${error.message}`, {
      severity: "error",
    });
    this.track("foundation_error", {
      name: this.name,
      error: error.message,
    });
  }
}
```

**Effort:** 15 minutes

#### 3.3.3: Migrate Foundation Extensions

Migrate each foundation extension to use FoundationExtension:

```typescript
// BEFORE: secrets/secrets.ts (old function-based)
export default function (pi: ExtensionAPI) {
  pi.on("output", (event, ctx) => {
    // scan for secrets and obfuscate
  });
}

// AFTER: secrets extension using FoundationExtension
export class SecretsExtension extends FoundationExtension {
  readonly name = "secrets";
  readonly version = "0.3.0";
  protected description = "Credential obfuscation & masking";

  async onTurnStart(event: any, ctx: any) {
    // scan context for secrets
  }

  async onToolOutput(output: string): Promise<string> {
    // obfuscate secrets in tool output
    return this.obfuscateSecrets(output);
  }
}
```

**Effort:** 45 minutes (4 extensions × 10 min each)

**Foundation Extensions:**
1. SecretsExtension (secrets/)
2. PermissionExtension (permission/)
3. SafeOpsExtension (safe-ops.ts)
4. ContextWindowExtension (context-window/)

#### 3.3.4: Update foundation/index.ts

```typescript
// AFTER: All use ExtensionLifecycle pattern
import { SecretsExtension } from "./secrets/secrets-extension.ts";
import { PermissionExtension } from "./permission/permission-extension.ts";
import { SafeOpsExtension } from "./safe-ops-extension.ts";
import { ContextWindowExtension } from "./context-window/context-window-extension.ts";

export default function (pi: ExtensionAPI) {
  const t = getTelemetry();
  if (t) {
    t.register({
      name: "foundation",
      version: "0.3.0",
      description: "Always-on safety guardrails",
      extensions: ["secrets", "permission", "safe-ops", "context-window"],
    });
    t.heartbeat("foundation");
  }

  // All use ExtensionLifecycle pattern
  new SecretsExtension(pi).register();
  new PermissionExtension(pi).register();
  new SafeOpsExtension(pi).register();
  new ContextWindowExtension(pi).register();
}
```

**Effort:** 10 minutes

---

### Task 3.4: Consolidate Documentation (2 hours)

#### 3.4.1: Update CHANGELOG.md with v0.4.0

```markdown
## [0.4.0] - 2025-06-03

### Major Changes

#### Cleanup & Consolidation
- Hard-removed deprecated auto-compact, handoff, session-recap modules (-490 LOC)
- Unified extension loading patterns (all use barrel exports)
- Refactored foundation layer (all use ExtensionLifecycle base class)
- Consolidated documentation (removed redundant sections)

#### Architecture Improvements
- All 40 extensions follow consistent patterns
- Foundation extensions now use FoundationExtension base class
- Telemetry registration unified across all extensions
- Clear separation of concerns (utility vs feature extensions)

#### Breaking Changes
- ❌ auto-compact module removed (use context-intel)
- ❌ handoff module removed (use context-intel)
- ❌ session-recap module removed (use context-intel)

### Migration Guide

If you were importing from deprecated modules:

```typescript
// ❌ OLD (v0.3.1)
import autoCompact from "pi-me/session-lifecycle/auto-compact";

// ✅ NEW (v0.4.0)
import { ContextIntelExtension } from "pi-me/session-lifecycle/context-intel";
```

All functionality preserved, just consolidated under one extension.

### Code Quality

- -490 LOC of redundant/deprecated code
- +0 new features (refactoring only)
- 598+ tests passing (100% pass rate)
- 85%+ test coverage maintained
```

**Effort:** 20 minutes

#### 3.4.2: Update README.md

Remove all references to deprecated modules:
- Delete "Auto Compact" section
- Delete "Handoff" section (keep under Context Intelligence)
- Delete "Session Recap" section (keep under Context Intelligence)
- Update "Session Lifecycle" to only list active extensions

**Effort:** 15 minutes

#### 3.4.3: Update EXTENSIONS_TABLE.md

Remove deprecated rows entirely:
```markdown
# BEFORE (v0.3.1)
| auto-compact | ... | ⚠️  DEPRECATED |
| handoff | ... | ⚠️  DEPRECATED |
| session-recap | ... | ⚠️  DEPRECATED |

# AFTER (v0.4.0)
# (Rows deleted entirely)
```

Update summary statistics:
```markdown
| Extension | Count |
|-----------|-------|
| Foundation | 4 |
| Session Lifecycle | 6 | (was 9, removed 3 deprecated)
| Core Tools | 20 |
| Content Tools | 5 |
| Authoring | 2 |
| **Total** | 37 | (was 40)
```

**Effort:** 15 minutes

#### 3.4.4: Update EXTENSION_REVIEW.md

Remove deprecated sections entirely:
- Delete "Auto Compact" section
- Delete "Handoff" section
- Delete "Session Recap" section
- Keep "Context Intelligence" section with merged features documented
- Update statistics

**Effort:** 20 minutes

#### 3.4.5: Create MIGRATION_GUIDE_v0.4.0.md

Comprehensive guide for users upgrading from v0.3.x:

```markdown
# Migration Guide: v0.3.x → v0.4.0

## Overview
v0.4.0 removes deprecated modules and unifies the codebase.
All functionality preserved — just reorganized.

## Removed Modules

### 1. auto-compact
- **What:** Automatic context compaction trigger
- **Moved to:** context-intel/ContextIntelExtension
- **Migration:** No action needed. Compaction happens automatically.
- **Command:** `/compact` (unchanged)

### 2. handoff
- **What:** Transfer context to new session
- **Moved to:** context-intel/ContextIntelExtension
- **Migration:** No action needed. Command still works.
- **Command:** `/handoff [goal]` (unchanged)

### 3. session-recap
- **What:** One-line session summary
- **Moved to:** context-intel/ContextIntelExtension
- **Migration:** No action needed. Command still works.
- **Command:** `/recap` (unchanged)

## What Changed Internally

- All 40 extensions now use consistent patterns
- Foundation layer refactored (4 extensions)
- Telemetry registration unified
- -490 LOC of redundant code removed

## What Didn't Change

- ✅ All user-facing commands work identically
- ✅ All features work identically
- ✅ All tests pass (598 tests)
- ✅ All APIs stable

## For Extension Developers

If you extended π-me extensions:

### Old Pattern (still works)
```typescript
export default function (pi: ExtensionAPI) {
  pi.registerCommand("mycommand", { ... });
}
```

### New Pattern (recommended)
```typescript
export class MyExtension extends ExtensionLifecycle {
  readonly name = "my-extension";
  
  async onSessionStart() { ... }
}

export default function (pi: ExtensionAPI) {
  new MyExtension(pi).register();
}
```

## Questions?

See EXTENSION_REVIEW.md for architecture details.
```

**Effort:** 30 minutes

#### 3.4.6: Update AUDIT_SUMMARY.md & CLEANUP_PLAN.md

Mark as "Complete":
```markdown
## Status: ✅ COMPLETE (v0.4.0 released)

All issues resolved:
- ❌ auto-compact → REMOVED (merged into context-intel)
- ❌ handoff → REMOVED (merged into context-intel)
- ❌ session-recap → REMOVED (merged into context-intel)
- ❌ ContextIntelExtension never loaded → FIXED (v0.3.0.1 + consolidated v0.4.0)
- ❌ Documentation mismatch → FIXED (updated all 4 docs)

Result: Production-grade codebase with -490 LOC redundancy removed.
```

**Effort:** 10 minutes

---

### Task 3.5: Test & Release (1.5 hours)

#### 3.5.1: Run full test suite

```bash
npm test
# Expect:
#   598+ tests passing
#   0 failures
#   All deprecated tests removed
#   All migrated tests still passing
```

**Effort:** 10 minutes

#### 3.5.2: Verify no broken imports

```bash
# TypeScript compiler check
npx tsc --noEmit
# Expect: 0 errors

# Grep for removed modules
grep -r "auto-compact\|handoff.ts\|session-recap" . \
  --include="*.ts" --include="*.js" \
  --exclude-dir=node_modules \
  --exclude-dir=.git
# Expect: 0 matches (except in CHANGELOG, MIGRATION_GUIDE)
```

**Effort:** 5 minutes

#### 3.5.3: Verify foundation layer works

```bash
# Quick test: can still load foundation extensions
npm test -- foundation

# Verify telemetry integrates correctly
npm test -- "telemetry"

# Verify permission system works
npm test -- "permission"

# Verify secrets obfuscation works
npm test -- "secrets"
```

**Effort:** 10 minutes

#### 3.5.4: Build & verify TypeScript

```bash
npm run build
# Expect: 0 errors, clean build
```

**Effort:** 5 minutes

#### 3.5.5: Final commit

```bash
git add -A
git commit -m "v0.4.0: deep cleanup — remove deprecated modules, unify patterns

Phase 3: Deep Cleanup

Removals:
  - session-lifecycle/auto-compact/ (merged into context-intel)
  - session-lifecycle/handoff.ts (merged into context-intel)
  - session-lifecycle/session-recap/ (merged into context-intel)

Refactoring:
  - Unified extension loading patterns (barrel exports)
  - Refactored foundation layer (FoundationExtension base class)
  - Standardized telemetry registration across all extensions
  - Consolidated documentation (removed redundant sections)

Statistics:
  - -490 LOC removed (deprecated code)
  - -3 modules removed (auto-compact, handoff, session-recap)
  - 37 active extensions (was 40)
  - 598+ tests passing
  - 100% test pass rate
  - 85%+ code coverage

Documentation:
  - Updated CHANGELOG.md with breaking changes
  - Updated README.md (removed deprecated sections)
  - Updated EXTENSIONS_TABLE.md (removed deprecated rows)
  - Updated EXTENSION_REVIEW.md (consolidated sections)
  - Created MIGRATION_GUIDE_v0.4.0.md

Result:
  ✅ Production-grade codebase
  ✅ Consistent patterns across all extensions
  ✅ Clear separation of concerns
  ✅ Unified architecture
  ✅ Zero technical debt from v0.3.0 issues

Next: v0.5.0 (optional) — Performance, optimization, 100% coverage"

git tag v0.4.0
```

**Effort:** 10 minutes

---

## Phase 4: v0.5.0 (Optional Polish) — 4 hours (1-2 months later)

**Goal:** Achieve enterprise-grade quality (optional, can skip)

### Task 4.1: Performance Optimization (1.5 hours)

- Profile test execution time
- Optimize slow tests
- Lazy-load extensions based on profile
- Cache telemetry registration
- **Effort:** 1.5 hours

### Task 4.2: Test Coverage Audit (1 hour)

```bash
# Measure coverage
npm test -- --coverage

# Target: 85%+ → 95%+
# Add tests for:
# - Error paths (foundation.ts error handling)
# - Edge cases (telemetry null checks)
# - Integration scenarios (multi-extension interactions)

# Effort: 1 hour
```

### Task 4.3: Documentation Polish (1 hour)

- Add architecture diagrams (Mermaid)
- Create ADR (Architecture Decision Records)
- Add inline code comments for complex sections
- Create CONTRIBUTING.md for future developers
- **Effort:** 1 hour

### Task 4.4: Release Polish (30 minutes)

- Clean up git history
- Create comprehensive release notes
- Tag as v0.5.0

---

## Summary: Timeline & Effort

| Phase | Release | Timeline | Effort | Status |
|-------|---------|----------|--------|--------|
| **0** | v0.3.0 | ✅ DONE | - | ✅ Complete |
| **1** | v0.3.0.1 | THIS WEEK | 25 min | 🔴 TODO |
| **2** | v0.3.1 | 1-2 WEEKS | 4 hours | 🔴 TODO |
| **3** | v0.4.0 | 1 MONTH | 8 hours | 🔴 TODO |
| **4** | v0.5.0 | 2 MONTHS | 4 hours | ⚪ Optional |
| **TOTAL** |  | 2 MONTHS | 16.5 hours | - |

---

## Execution Checklist

### v0.3.0.1 (THIS WEEK)
- [ ] Load ContextIntelExtension in session-lifecycle/index.ts
- [ ] Verify tests pass (598)
- [ ] Verify telemetry triggers fire (9/9)
- [ ] Commit & tag v0.3.0.1

### v0.3.1 (1-2 WEEKS)
- [ ] Create deprecation wrappers (auto-compact, handoff, session-recap)
- [ ] Keep wrappers loaded in index.ts
- [ ] Consolidate tests under context-intel
- [ ] Update README.md
- [ ] Update EXTENSIONS_TABLE.md
- [ ] Update EXTENSION_REVIEW.md
- [ ] Add v0.3.1 deprecation notice to CHANGELOG.md
- [ ] Run full test suite
- [ ] Commit & tag v0.3.1

### v0.4.0 (1 MONTH)
- [ ] Remove deprecated modules (auto-compact, handoff, session-recap)
- [ ] Unify extension loading patterns (barrel exports)
- [ ] Refactor foundation layer (FoundationExtension base class)
- [ ] Update all documentation
- [ ] Create MIGRATION_GUIDE_v0.4.0.md
- [ ] Verify no broken imports
- [ ] Run full test suite
- [ ] Build & verify TypeScript
- [ ] Commit & tag v0.4.0

### v0.5.0 (OPTIONAL, 2 MONTHS)
- [ ] Performance optimization
- [ ] Test coverage audit (85% → 95%+)
- [ ] Documentation polish
- [ ] Release polish
- [ ] Commit & tag v0.5.0

---

## Success Criteria

### v0.3.0.1 ✅
- [ ] 598 tests passing
- [ ] 9/9 telemetry triggers firing
- [ ] Zero breaking changes
- [ ] Ready for v0.3.1 (optional) or production use

### v0.3.1 ✅
- [ ] 598+ tests passing
- [ ] Deprecation warnings visible
- [ ] All documentation updated
- [ ] Backward compatible (nothing broken)
- [ ] Clear v0.4.0 migration path

### v0.4.0 ✅
- [ ] 598 tests passing (consolidated)
- [ ] -490 LOC removed
- [ ] All 37 extensions using consistent patterns
- [ ] Foundation layer refactored
- [ ] Documentation complete & accurate
- [ ] Production-grade code quality
- [ ] Zero legacy debt

### v0.5.0 (Optional) ✅
- [ ] 598+ tests passing
- [ ] 95%+ code coverage
- [ ] Performance optimized
- [ ] Enterprise-grade documentation
- [ ] Ready for large teams

---

## Rollback Plan

If issues occur at any phase:

```bash
# v0.3.0.1 issues?
git revert <commit>
git tag -d v0.3.0.1
# Stay on v0.3.0, investigate

# v0.3.1 issues?
git revert <commit>
git tag -d v0.3.1
# Revert to v0.3.0.1, fix issues, retry

# v0.4.0 issues?
git revert <commit>
git tag -d v0.4.0
# Revert to v0.3.1, fix issues, retry
```

---

## Notes

### Why 3 Releases?

1. **v0.3.0.1 (Hotfix):** Minimal fix, low risk, immediate benefit
2. **v0.3.1 (Soft Deprecation):** Graceful migration, backward compatible, user-friendly
3. **v0.4.0 (Hard Removal):** Clean break, production-ready, no legacy code

### Why Not All at Once?

- **Risk Management:** Each release validates the path forward
- **User Communication:** Clear deprecation period (1 release cycle)
- **Quality:** Time to test, fix issues, gather feedback
- **Safety:** Easy rollback if problems found

### Estimated Team Effort

- **Solo Developer:** 16.5 hours spread over 2 months = ~1-2 hours/week
- **Pair:** 8-10 hours total (parallelizable phases)
- **Team of 3:** 5-6 hours total (many tasks run in parallel)

---

## Next Steps

1. **Approve this plan** (or request changes)
2. **Schedule v0.3.0.1 hotfix** (THIS WEEK, 25 min)
3. **Schedule v0.3.1 release** (in 1-2 WEEKS, 4 hours)
4. **Schedule v0.4.0 release** (in 1 MONTH, 8 hours)
5. **Optional: v0.5.0** (in 2 MONTHS, 4 hours)

---

**Prepared:** 2025-05-03  
**Status:** Ready for Execution  
**Contact:** See AUDIT_INDEX.md for documentation hub
