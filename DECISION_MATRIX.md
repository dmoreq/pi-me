# Cleanup Decision Matrix

## Decision 1: Which Fix Approach?

| Approach | Effort | Risk | Timeline | Recommendation |
|----------|--------|------|----------|-----------------|
| **Quick Fix Only** (load ContextIntelExtension) | 10 min | Very Low | Immediate | ✅ Do NOW (pre-req) |
| **Soft Deprecation** (wrappers + warnings) | 4 hours | Low | v0.3.1 (1-2 weeks) | ✅ Recommended |
| **Hard Removal** (delete legacy modules) | 4 hours | Medium | v0.3.1 (immediate) | ⚠️ Risky but fast |
| **Ignore Issue** (status quo) | 0 | HIGH | Never | ❌ DO NOT DO |

**Recommendation:** **Quick Fix NOW (10 min) → Soft Deprecation (v0.3.1) → Hard Removal (v0.4.0)**

---

## Decision 2: context-pruning — Keep or Simplify?

| Option | LOC | Complexity | Features | Maintenance | Recommendation |
|--------|-----|-----------|----------|-------------|---|
| **Keep As-Is** | 5K | High | 5 rules, configurable | High | ✅ if proven valuable |
| **Simplify** | 2K | Medium | 3 core rules | Low | ⚠️ Check usage first |
| **Merge into context-intel** | 0 | Low | Built-in | Very Low | ❌ Premature |
| **Deprecate** | -5K | N/A | N/A | None | ❌ Users might rely on it |

**Recommendation:** **KEEP AS-IS for now** (it's specialized, worth maintaining separate)

---

## Decision 3: Release Timeline?

| Option | Impact | Effort | Risk |
|--------|--------|--------|------|
| **Hotfix NOW** (quick fix only) | Fix telemetry | 10 min | None | ✅ RECOMMENDED |
| **v0.3.1 in 1 week** (soft deprecate) | Clean deprecation | 4 hours | Low |
| **v0.3.1 in 2 weeks** (soft deprecate) | More testing time | 4 hours | Very Low |
| **Skip to v0.4.0** (hard removal) | Break users | 4 hours | High |

**Recommendation:** **Quick Fix NOW (v0.3.0.1 patch) → v0.3.1 soft deprecate in 1 week → v0.4.0 hard remove in 1 month**

---

## Execution Checklist

### ✅ Immediate Actions (TODAY)

- [ ] **Implement Quick Fix** (10 min)
  ```bash
  # Add to session-lifecycle/index.ts
  import { ContextIntelExtension } from "./context-intel";
  new ContextIntelExtension(pi).register();
  
  # Comment out legacy calls
  // autoCompact(pi);     // Now merged into context-intel
  // handoff(pi);         // Now merged into context-intel
  // sessionRecap(pi);    // Now merged into context-intel
  ```

- [ ] **Verify Tests Pass** (5 min)
  ```bash
  npm test
  # All 598 tests should pass
  ```

- [ ] **Verify Telemetry Triggers Fire** (5 min)
  - Run agent with verbose logging
  - Confirm 9/9 telemetry triggers appear

- [ ] **Commit & Tag as v0.3.0.1**
  ```bash
  git commit -m "fix: load ContextIntelExtension in session-lifecycle

  This fix loads the merged context-intel extension that was implemented
  in v0.3.0 but never actually loaded.

  Result:
    - All 9 telemetry automation triggers now fire
    - 3 out of 3 context management features working
    - Ready for soft deprecation in v0.3.1

  Fixes: ContextIntelExtension never loaded, 3 telemetry triggers unused"
  
  git tag v0.3.0.1
  ```

---

### ⏳ v0.3.1 Release (Next 1-2 weeks)

Follow **CLEANUP_PLAN.md** Phase 1-3:

- [ ] **Phase 1: Deprecation Strategy** (30 min)
  - [ ] Replace auto-compact with deprecation wrapper
  - [ ] Replace handoff with deprecation wrapper
  - [ ] Replace session-recap with deprecation wrapper
  - [ ] Add console warnings

- [ ] **Phase 2: Consolidate Tests** (1 hour)
  - [ ] Move auto-compact tests → context-intel/tests/
  - [ ] Move handoff tests → context-intel/tests/
  - [ ] Move session-recap tests → context-intel/tests/
  - [ ] Verify all tests pass

- [ ] **Phase 3: Update Documentation** (1.5 hours)
  - [ ] Update README.md (remove separate sections)
  - [ ] Update EXTENSIONS_TABLE.md (mark as deprecated)
  - [ ] Update EXTENSION_REVIEW.md (consolidate)
  - [ ] Create CHANGELOG.md v0.3.1 section

- [ ] **Test & Release**
  - [ ] Run: npm test (verify 598 tests pass)
  - [ ] Commit: "v0.3.1: deprecate legacy context extensions"
  - [ ] Tag: git tag v0.3.1
  - [ ] Release notes: "Deprecation release: auto-compact, handoff, session-recap merged into context-intel"

---

### 📅 v0.4.0 Release (1 month later)

Hard removal:

- [ ] **Delete Legacy Modules**
  - [ ] Delete auto-compact/
  - [ ] Delete handoff.ts
  - [ ] Delete session-recap/
  - [ ] Delete any wrapper code

- [ ] **Clean Tests**
  - [ ] Verify context-intel tests cover all scenarios
  - [ ] Delete deprecated tests
  - [ ] Verify 598 tests still pass

- [ ] **Update Documentation**
  - [ ] Remove deprecation notices
  - [ ] Confirm no references to old modules
  - [ ] Clean CHANGELOG

- [ ] **Release**
  - [ ] Commit: "v0.4.0: remove deprecated session-lifecycle modules"
  - [ ] Tag: git tag v0.4.0

---

## Approval Sign-Off

**Quick Fix (v0.3.0.1):**
- [ ] Approved by: ___________
- [ ] Date: ___________

**Soft Deprecation (v0.3.1):**
- [ ] Approved by: ___________
- [ ] Date: ___________

**Hard Removal (v0.4.0):**
- [ ] Approved by: ___________
- [ ] Date: ___________

---

## Fallback Plan

If issues occur:
1. Revert last commit: `git revert <commit-hash>`
2. Stay on v0.3.0
3. Investigate issue
4. Re-attempt with more testing

---

## Success Criteria

### v0.3.0.1 (Quick Fix)
- ✅ 598 tests passing
- ✅ All 9 telemetry triggers firing
- ✅ No user-facing changes
- ✅ Zero new issues

### v0.3.1 (Soft Deprecation)
- ✅ 598+ tests passing
- ✅ Deprecation warnings in console
- ✅ Documentation updated
- ✅ Backward compatible
- ✅ v0.4.0 timeline clear

### v0.4.0 (Hard Removal)
- ✅ 598 tests passing (consolidated)
- ✅ -490 LOC removed
- ✅ Documentation clean
- ✅ No legacy references
- ✅ Simpler codebase

---

**Prepared:** 2025-05-03  
**Status:** Ready for Execution
