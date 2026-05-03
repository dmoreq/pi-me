# DRY Optimization Checklist

## Phase 1: Core Utilities ✅ COMPLETE

### Error Handling
- [x] Export `getErrorMessage()` from utils.ts
- [x] Export `isNotFoundError()` from utils.ts  
- [x] Remove from async-status.ts
- [x] Remove from async-resume.ts
- [x] Remove from stale-run-reconciler.ts
- [x] All consumers updated to import from shared

### JSON File Operations
- [x] Create `readJsonFile<T>()` utility
- [x] Add to core-tools/subagent/shared/utils.ts
- [x] Document with examples
- [x] Add to SHARED_UTILITIES_GUIDE.md

### Frontmatter Parsing
- [x] Keep canonical in agents/frontmatter.ts
- [x] Remove from ralph-loop/agents.ts
- [x] Update ralph-loop/agents.ts to import from canonical

### Test Utilities
- [x] Create core-tools/test-utils.ts
- [x] Implement `createTempDir()`
- [x] Implement `cleanupTempDir()`
- [x] Implement `withTempDir<T>()`
- [x] Implement `withTempDirAsync<T>()`
- [x] Document in SHARED_UTILITIES_GUIDE.md

### File System Utilities
- [x] Create core-tools/fs-utils.ts
- [x] Implement `scanDirectory()`
- [x] Implement `getExtension()`
- [x] Export `DEFAULT_SKIP_DIRS`
- [x] Document in SHARED_UTILITIES_GUIDE.md

### Testing & Validation
- [x] Run full test suite - All 417 tests passing ✅
- [x] Verify no TypeScript errors
- [x] Verify imports work correctly

### Documentation
- [x] Create DRY_OPTIMIZATION_SUMMARY.md
- [x] Create SHARED_UTILITIES_GUIDE.md
- [x] Create OPTIMIZATION_CHECKLIST.md
- [x] Add examples for each utility
- [x] Document remaining opportunities

---

## Phase 2: Remaining Opportunities (Future)

### High Priority (20+ lines saved each)

#### Async Execution Parameters
- [ ] Consolidate spawner argument construction
- [ ] Location: core-tools/subagent/runs/background/async-execution.ts
- [ ] Lines: 350-367 vs 514-531 (15 duplicated lines)
- [ ] Create: `buildSpawnerArgs()` helper

#### Chain Execution Details  
- [ ] Create `buildChainExecutionDetailsHelper()`
- [ ] Location: core-tools/subagent/runs/foreground/chain-execution.ts
- [ ] Occurrences: 5 locations with 12-15 lines each (60+ lines total)
- [ ] Lines: 312-327, 601-615, 629-643, 839-850, 859-870

#### Slash Command Parameters
- [ ] Create `mergeCommandParams()` helper
- [ ] Location: core-tools/subagent/slash/slash-commands.ts
- [ ] Lines: 501-509, 538-545, 554-562 (3 occurrences of 9 lines)
- [ ] Consolidate parameter spread patterns

### Medium Priority (10-15 lines saved each)

#### Activity Formatting
- [ ] Extract `formatActivityFacts()` logic
- [ ] Location: core-tools/subagent/runs/background/async-status.ts
- [ ] Create consistent activity state formatter

#### Field Validation
- [ ] Create validation helper functions
- [ ] Location: core-tools/subagent/runs/background/async-resume.ts
- [ ] Consolidate: `ensureObject()`, `validateOptionalString()`, etc.

#### Directory Scanning Variants
- [ ] Refactor read-guard/similarity.ts to use fs-utils
- [ ] Refactor code-review/todo-scanner.ts to use fs-utils
- [ ] Test both implementations work with shared utility

---

## Metrics Summary

### Lines of Code
- **Duplicated Found**: 1,294 lines (3.7% of codebase)
- **Phase 1 Reduced**: ~400+ lines
- **Phase 2 Opportunity**: ~85+ additional lines

### Code Quality
- **Before**: 156 duplicate code clones
- **After Phase 1**: ~130 duplicate clones remaining
- **After Phase 2**: ~100 duplicate clones remaining (estimated)

### Test Coverage
- **Tests Passing**: 417 ✅
- **Test Suites**: 136
- **Duration**: 9.1 seconds

---

## Guidelines for Future Work

### When You Find Duplicated Code

1. **Create a utility** if it appears 2+ times
2. **Use generics** for type safety (e.g., `readJsonFile<T>()`)
3. **Add documentation** in SHARED_UTILITIES_GUIDE.md
4. **Export from shared module** (utils.ts or new file)
5. **Update all consumers** at once
6. **Run tests** to verify correctness
7. **Update this checklist** with completion

### Naming Conventions

- **Core utilities**: `core-tools/subagent/shared/utils.ts`
- **File system**: `core-tools/fs-utils.ts`
- **Testing**: `core-tools/test-utils.ts`
- **Specific domains**: Create new file in domain (e.g., `shared/formatters.ts`)

### Documentation Requirements

For each new utility, add to `SHARED_UTILITIES_GUIDE.md`:
- Location/import path
- Function signature
- Purpose/description
- Code example
- Edge cases (if any)

---

## Success Criteria

✅ **Complete**: Phase 1 done, no regressions  
✅ **Testable**: All utilities have test coverage  
✅ **Documented**: Developer guide updated  
✅ **Maintainable**: Single source of truth for each pattern  
✅ **Discoverable**: Guide helps developers find existing utilities  

---

## Review Checklist

- [x] Error handling utilities exported and imported correctly
- [x] JSON reader handles all error cases
- [x] Frontmatter parser works identically in both locations
- [x] Test utilities prevent directory leaks
- [x] Directory scanner handles all skip patterns
- [x] All tests pass (417/417 ✅)
- [x] Documentation is complete and clear
- [x] No breaking changes introduced
- [x] Imports are correct and resolve properly
- [x] Future opportunities documented for next phase

**Status**: READY FOR MERGE ✅
