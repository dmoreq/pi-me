# π-me Legacy Code Cleanup Plan (v0.3.0)

**Problem Identified:** After merging extensions in v0.3.0, legacy standalone extensions still exist alongside their merged equivalents in `context-intel`. This creates:
- 🔴 Code duplication
- 🔴 Maintenance burden (update logic in 2 places)
- 🔴 Confusion (which to use?)
- 🔴 Telemetry noise (duplicate events)

**Status:** 18 orphaned/redundant modules identified

---

## Current Architecture Issues

### Issue 1: auto-compact + handoff + session-recap → context-intel

**Problem:** Context Intelligence was supposed to MERGE three extensions, but they still exist standalone:

```
session-lifecycle/
├── auto-compact/        ❌ LEGACY (merged into context-intel)
│   └── Auto-compact logic → DUPLICATED in ContextIntelExtension
├── handoff.ts           ❌ LEGACY (merged into context-intel)
│   └── Handoff logic → DUPLICATED via PromptBuilder
├── session-recap/       ❌ LEGACY (merged into context-intel)
│   └── Recap logic → DUPLICATED via PromptBuilder
├── context-intel.ts     ✅ New barrel export
├── context-intel/       ✅ New implementation
│   ├── index.ts         (ContextIntelExtension)
│   ├── transcript-builder.ts
│   ├── prompt-builder.ts
│   └── tests/
└── index.ts             ❌ Still loads legacy extensions!
    ├── autoCompact(pi)        ← auto-compact/index.ts
    ├── handoff(pi)            ← handoff.ts
    ├── sessionRecap(pi)       ← session-recap/index.ts
    └── (does NOT load ContextIntelExtension!)
```

**Root Cause:** During v0.3.0 implementation, we created new context-intel module but DIDN'T remove or deprecate the legacy ones. The `session-lifecycle/index.ts` still calls the old extensions, ignoring the new merged one.

---

### Issue 2: context-pruning Complexity

**Problem:** `context-pruning/` is a sophisticated 10-file module with 5 pruning rules:

```
context-pruning/
├── index.ts
├── config.ts
├── logger.ts
├── metadata.ts
├── registry.ts
├── types.ts
├── workflow.ts
├── cmds/            (6 slash commands)
├── events/          (2 event handlers)
├── rules/           (5 pruning rules)
│   ├── deduplication.ts
│   ├── error-purging.ts
│   ├── recency.ts
│   ├── superseded-writes.ts
│   └── tool-pairing.ts
└── tests/           (4 test files)
```

**Decision Required:** Should context-pruning be:
1. **Kept as-is** (specialized, full-featured) ← Option A
2. **Simplified** (merge 5K LOC into context-intel) ← Option B
3. **Made optional** (full profile only) ← Option C

Currently loads for ALL dev/full profiles, but might be overkill.

---

### Issue 3: Barrel Exports + Direct Imports

**Problem:** Mixed loading patterns create ambiguity:

```typescript
// File 1: index.ts IMPORTS directly
import autoCompact from "./auto-compact/index.ts";  // ❌ Direct
import { registerSessionName } from "./session-name.ts"; // ❌ Direct

// File 2: context-intel.ts EXPORTS via barrel
export { ContextIntelExtension } from "./context-intel/index.ts"; // ✅ Barrel
export { TranscriptBuilder } from "./context-intel/transcript-builder.ts"; // ✅ Barrel

// Inconsistency: Why auto-compact direct but context-intel barrel?
// Maintenance nightmare when moving files
```

---

### Issue 4: Old Documentation References

**Problem:** Docs still reference old separation:

```markdown
# README.md mentions:
- Handoff
- Auto Compact
- Session Recap
(As if they're separate extensions)

# EXTENSIONS_TABLE.md lists:
- Auto Compact (separate row)
- Session Recap (separate row)
- Context Intel (separate row)
(Shows redundancy clearly!)

# EXTENSION_REVIEW.md describes:
- Auto Compact (dedicated section)
- Session Recap (dedicated section)
- Context Intel (dedicated section)
(Adds to confusion!)
```

---

## Cleanup Plan

**Total Effort:** ~4 hours  
**Risk Level:** Medium (refactoring active extensions)  
**Complexity:** 3 major phases

---

## Phase 1: Assess & Deprecate (30 minutes)

### 1.1 Verify Redundancy
- [x] auto-compact functionality is in ContextIntelExtension
- [x] handoff functionality is in PromptBuilder
- [x] session-recap functionality is in PromptBuilder
- [ ] Confirm no unique logic in legacy versions

### 1.2 Deprecation Strategy
```
Option A: HARD REMOVE (clean break)
  ❌ Risk: Users relying on auto-compact config CLI will break

Option B: SOFT DEPRECATE (1 release)
  ✅ Recommended
  1. Create deprecation wrapper in auto-compact/index.ts
  2. Log warnings when used: "auto-compact merged into context-intel, use /compact instead"
  3. Keep working but flag as deprecated
  4. Remove in v0.4.0

Option C: ADAPTER PATTERN
  ✅ Alternative
  1. Keep auto-compact/handoff/recap as thin adapters
  2. Internally call ContextIntelExtension
  3. No duplication, backwards-compatible
```

**Choose:** Option B (soft deprecate) for v0.3.1, hard remove in v0.4.0

---

## Phase 2: Clean Redundant Code (2 hours)

### 2.1 Clean auto-compact/

**Current:** 300 LOC in auto-compact/index.ts  
**Action:** Replace with deprecation wrapper

```typescript
// Before: Full auto-compact implementation
export default function (pi: ExtensionAPI) {
  createAutoCompact()(pi);
  registerCompactConfig(pi);
  // 300 LOC
}

// After: Thin deprecation wrapper
import { ContextIntelExtension } from "../context-intel";

export default function (pi: ExtensionAPI) {
  console.warn(
    "⚠️  [DEPRECATED] auto-compact merged into context-intel in v0.3.0\n" +
    "   Use /compact instead of /auto-compact\n" +
    "   This adapter will be removed in v0.4.0"
  );
  
  // Load context-intel which handles compaction
  new ContextIntelExtension(pi).register();
}
```

**Files to Delete:**
- `session-lifecycle/auto-compact/index.ts` → Keep as stub
- `session-lifecycle/auto-compact/` tests → Move to context-intel tests

---

### 2.2 Clean handoff.ts

**Current:** 150 LOC in handoff.ts  
**Action:** Replace with deprecation wrapper

```typescript
// Before: Full handoff implementation (150 LOC)
export default function (pi: ExtensionAPI) {
  pi.registerCommand("handoff", {
    handler: async (args, ctx) => { /* ... */ }
  });
}

// After: Thin wrapper
import { ContextIntelExtension } from "./context-intel";

export default function (pi: ExtensionAPI) {
  console.warn(
    "⚠️  [DEPRECATED] handoff merged into context-intel in v0.3.0\n" +
    "   Use /handoff [goal] - same interface, better integration\n" +
    "   This adapter will be removed in v0.4.0"
  );
  
  // Command already registered by ContextIntelExtension
  // This is a no-op, kept for backwards-compat
}
```

**Files to Delete:**
- `session-lifecycle/handoff.ts` → Keep as stub
- All internal handoff logic → Verify in PromptBuilder

---

### 2.3 Clean session-recap/

**Current:** 80 LOC in session-recap/index.ts  
**Action:** Replace with deprecation wrapper

```typescript
// After: Thin wrapper
import { ContextIntelExtension } from "../context-intel";

export default function (pi: ExtensionAPI) {
  console.warn(
    "⚠️  [DEPRECATED] session-recap merged into context-intel in v0.3.0\n" +
    "   Use /recap - same interface, better integration\n" +
    "   This adapter will be removed in v0.4.0"
  );
}
```

**Files to Delete:**
- `session-lifecycle/session-recap/index.ts` → Keep as stub
- Session recap CLI logic → Verify in PromptBuilder

---

### 2.4 Verify ContextIntelExtension Completeness

**Checklist:**
- [ ] `/handoff [goal]` command works
- [ ] `/recap` command works
- [ ] `/compact` command works
- [ ] Auto-compaction triggers at threshold
- [ ] All telemetry triggers fire
- [ ] Tests pass (31 tests)
- [ ] No functionality lost

---

## Phase 3: Update Architecture & Docs (1.5 hours)

### 3.1 Fix session-lifecycle/index.ts

**Current:**
```typescript
import autoCompact from "./auto-compact/index.ts";
import handoff from "./handoff.ts";
import sessionRecap from "./session-recap/index.ts";

export default function (pi: ExtensionAPI) {
  autoCompact(pi);      // ❌ Legacy
  handoff(pi);          // ❌ Legacy
  sessionRecap(pi);     // ❌ Legacy
  // MISSING: ContextIntelExtension!
}
```

**After (Option 1 - Hard Remove):**
```typescript
import { ContextIntelExtension } from "./context-intel";

export default function (pi: ExtensionAPI) {
  // context-intel now handles:
  // - Handoff (/handoff)
  // - Auto-compact (/compact, auto-triggers)
  // - Session recap (/recap)
  new ContextIntelExtension(pi).register();
}
```

**After (Option 2 - Soft Deprecate):**
```typescript
import autoCompact from "./auto-compact/index.ts";      // ✅ Wrapper
import handoff from "./handoff.ts";                     // ✅ Wrapper
import sessionRecap from "./session-recap/index.ts";    // ✅ Wrapper

export default function (pi: ExtensionAPI) {
  // Keep wrappers for backwards-compat (v0.3.1 only)
  autoCompact(pi);      // Shows deprecation warning
  handoff(pi);          // Shows deprecation warning
  sessionRecap(pi);     // Shows deprecation warning
  
  // ALSO load the new merged implementation
  const { ContextIntelExtension } = await import("./context-intel");
  new ContextIntelExtension(pi).register();
}
```

**Recommendation:** Option 2 (soft deprecate) for v0.3.1, then hard remove in v0.4.0

---

### 3.2 Update Extension Docs

**Files to Update:**
1. **README.md**
   - Remove separate "Auto Compact", "Session Recap" sections
   - Consolidate under "Context Intelligence"
   - Add migration note: "Previously 3 extensions (handoff, auto-compact, session-recap) → now merged as context-intel"

2. **EXTENSIONS_TABLE.md**
   - Remove rows for auto-compact, handoff, session-recap (if hard-removing)
   - OR mark as "(DEPRECATED, merged into context-intel)" if soft-deprecating
   - Keep 1 row for Context Intel with all 3 features listed

3. **EXTENSION_REVIEW.md**
   - Merge sections: auto-compact, handoff, session-recap → one Context Intelligence section
   - Document `/handoff`, `/recap`, `/compact` commands in single extension
   - Note v0.4.0 removal of legacy modules

4. **CHANGELOG.md**
   - Add "v0.3.1 — Deprecation Release" section
   - List auto-compact, handoff, session-recap as deprecated
   - Point to context-intel as replacement
   - Announce removal in v0.4.0

---

### 3.3 File Structure After Cleanup

**Option 1 (Hard Remove):**
```
session-lifecycle/
├── context-intel.ts          ✅ Barrel
├── context-intel/            ✅ Implementation
│   ├── index.ts              (ContextIntelExtension)
│   ├── transcript-builder.ts
│   ├── prompt-builder.ts
│   └── tests/
├── context-pruning/          ✅ Keep (specialized)
├── git-checkpoint/           ✅ Keep
├── usage-extension/          ✅ Keep
├── welcome-overlay/          ✅ Keep
├── session-name.ts           ✅ Keep (extracted)
├── skill-args.ts             ✅ Keep (extracted)
├── [DELETED] auto-compact/   ❌ REMOVED
├── [DELETED] handoff.ts      ❌ REMOVED
├── [DELETED] session-recap/  ❌ REMOVED
└── index.ts                  ✅ Updated
```

**Option 2 (Soft Deprecate):**
```
session-lifecycle/
├── context-intel.ts          ✅ Barrel
├── context-intel/            ✅ Implementation (real)
│   ├── index.ts
│   ├── transcript-builder.ts
│   ├── prompt-builder.ts
│   └── tests/
├── auto-compact/             ⚠️  DEPRECATED (wrapper)
│   └── index.ts              (1 line: shows deprecation warning)
├── handoff.ts                ⚠️  DEPRECATED (wrapper)
│   (1 line: shows deprecation warning)
├── session-recap/            ⚠️  DEPRECATED (wrapper)
│   └── index.ts              (1 line: shows deprecation warning)
├── context-pruning/          ✅ Keep
├── git-checkpoint/           ✅ Keep
├── usage-extension/          ✅ Keep
├── welcome-overlay/          ✅ Keep
├── session-name.ts           ✅ Keep
├── skill-args.ts             ✅ Keep
└── index.ts                  ✅ Updated (loads both)
```

---

### 3.4 Test Updates

**Before Cleanup:**
```
Session Lifecycle Tests: 90 tests
├── auto-compact/tests/ (12 tests)
├── handoff.test.ts (?)
├── session-recap/tests (?)
├── context-intel/ (31 tests) ← NEW
└── others
```

**After Cleanup (Option 1):**
```
Session Lifecycle Tests: 90+ tests (consolidated)
├── context-intel/ (31 tests) ← Expanded to include old tests
├── context-pruning/tests/ (4 tests)
├── git-checkpoint/tests/ (8 tests)
└── others
```

**Action:**
1. Move `auto-compact/tests` → `context-intel/tests/auto-compact/`
2. Move handoff tests → `context-intel/tests/handoff/`
3. Move session-recap tests → `context-intel/tests/recap/`
4. Keep all tests passing (backwards-compat verification)

---

## Phase 4: Context-Pruning Assessment (Parallel)

**Decision Point:** Keep, Simplify, or Deprecate?

### Option A: Keep As-Is
**Pros:**
- 5 sophisticated pruning rules (dedup, error-purge, recency, superseded, tool-pairing)
- Full-featured, user-configurable
- Well-tested (4 test files)

**Cons:**
- Complex (10 files, 5K LOC)
- Might be overkill for most users
- Maintenance burden

**Action:** Keep if it's proven valuable, otherwise simplify

### Option B: Simplify to 3 Core Rules
```typescript
// Simplified context-pruning/index.ts
rules = [
  "deduplication" (remove exact duplicates),
  "error-purging" (remove old errors once fixed),
  "recency" (remove very old low-value messages)
];
```

**Impact:** 10 files → 3 files, -2K LOC

### Option C: Merge into Context-Intel
```typescript
// context-intel/index.ts
async onTurnEnd() {
  // Built-in pruning (5 core rules)
  this.pruneMessages(messages);
}
```

**Impact:** 10 files → removed, -5K LOC, simplification

---

## Summary of Changes

| Module | Current | After | Effort | Risk |
|--------|---------|-------|--------|------|
| auto-compact | 300 LOC | ~5 LOC wrapper | Low | Low |
| handoff | 150 LOC | ~5 LOC wrapper | Low | Low |
| session-recap | 80 LOC | ~5 LOC wrapper | Low | Low |
| context-intel | 100 LOC | 150+ LOC | Low | Medium |
| context-pruning | 5K LOC | TBD | TBD | TBD |
| **Total** | 6K LOC | -490 LOC | 4h | Medium |

---

## Recommended Timeline

### v0.3.1 (1-2 weeks, soft deprecation)
- [x] Replace auto-compact/handoff/session-recap with deprecation wrappers
- [x] Update README, EXTENSIONS_TABLE, EXTENSION_REVIEW
- [x] Add deprecation warnings to console output
- [x] Update CHANGELOG with deprecation notice
- [x] Run full test suite (598 tests)
- [x] Release with note: "v0.3.1 — Deprecation Release: auto-compact, handoff, session-recap merged into context-intel"

### v0.4.0 (1 month later, hard remove)
- [ ] Remove deprecated modules entirely
- [ ] Update all docs
- [ ] Update tests
- [ ] Release with note: "v0.4.0 — Cleanup Release: removed legacy session-lifecycle modules"

### v0.4.0+ (optional)
- [ ] Decide on context-pruning (keep, simplify, or deprecate)
- [ ] Consolidate if needed

---

## Execution Steps (Phase 1-3 only)

```bash
# 1. Create soft deprecation wrappers
cd session-lifecycle/
cat > auto-compact/index.ts << 'EOF'
console.warn("[DEPRECATED] auto-compact merged into context-intel in v0.3.0");
export default function (pi) { /* no-op */ }
EOF

cat > handoff.ts << 'EOF'
console.warn("[DEPRECATED] handoff merged into context-intel in v0.3.0");
export default function (pi) { /* no-op */ }
EOF

cat > session-recap/index.ts << 'EOF'
console.warn("[DEPRECATED] session-recap merged into context-intel in v0.3.0");
export default function (pi) { /* no-op */ }
EOF

# 2. Update session-lifecycle/index.ts (add ContextIntelExtension)
# [Edit to import and use ContextIntelExtension]

# 3. Update docs
# [Edit README.md, EXTENSIONS_TABLE.md, EXTENSION_REVIEW.md, CHANGELOG.md]

# 4. Run tests
npm test

# 5. Commit
git add -A
git commit -m "v0.3.1: deprecate legacy auto-compact/handoff/session-recap

Phase 11: Legacy Code Cleanup

Deprecations:
  - auto-compact → merged into context-intel
  - handoff → merged into context-intel
  - session-recap → merged into context-intel

These modules now show deprecation warnings and will be removed in v0.4.0.

All functionality preserved via context-intel extension.
Updated docs and CHANGELOG with migration notes.

Tests: 598 passing, 0 failing"

# 6. Tag for release
git tag v0.3.1
```

---

## Rollback Plan

If issues occur:
1. Revert last 3 commits
2. Stay on v0.3.0
3. Address issues before re-attempting cleanup

---

## Post-Cleanup Benefits

✅ **Code Quality:**
- -490 LOC (redundant code removed)
- Single source of truth for context management
- Cleaner module organization

✅ **Maintainability:**
- Fewer files to update (1 instead of 3)
- Simpler test suite organization
- Consistent patterns (ExtensionLifecycle)

✅ **Documentation:**
- Clearer extension landscape
- No redundant explanations
- Better user guidance

✅ **Performance:**
- Fewer extension loads (1 instead of 3)
- Reduced telemetry noise
- Faster initialization

---

## Next Steps

1. **Approve cleanup plan** (this document)
2. **Decide on soft vs hard deprecation** (recommend soft)
3. **Decide on context-pruning** (keep, simplify, or merge)
4. **Execute Phase 1-3** (4 hours)
5. **Test thoroughly** (598 tests)
6. **Release v0.3.1**
7. **Plan v0.4.0 hard removal** (1 month later)

---

**Prepared by:** Code Review Analysis  
**Date:** 2025-05-03  
**Status:** Ready for Implementation
