# Optimization History

This document records the phased optimization of the pi-me codebase. All phases are complete.

**Timeline:** 2026-05-01

---

## Phase 1 — Structural Cleanup

Moved misplaced files to correct layers, removed orphaned code, organized directory structure.

## Phase 2 — Large File Splitting

Extracted pure logic into `-core.ts` files for all extensions exceeding 800 lines, leaving thin glue layers:
`plan-mode.ts` (1852→902+997), `usage-bar.ts` (1065→9+1063), `usage-extension/index.ts` (1128→70+1059).

## Phase 3 — Test Coverage

Added `permission-core.test.ts` and `plan-mode-core.test.ts`. Fixed 3 test assertion bugs. Current state: 202 tests, 0 failures.

## Phase 4 — Loop Tool Consolidation

Merged 4 overlapping loop tools into `ralph-loop`: removed `loop.ts`, `pi-ralph-wiggum/index.ts`. Added parallel,
self, and chain modes to ralph-loop.

## Phase 5 — Test Runner Auto-Discovery

Replaced manual test file listing with glob patterns for automatic discovery of all `*.test.ts` files.

## Post-Phase — Extension Consolidation

Merged 12 extensions into 6 to reduce bloat while preserving all functionality:
- `sub-pi` + `sub-pi-skill` → unified sub-pi with skill prefix support
- `cost-tracker` → merged into `usage-extension` (adds `/cost` command)
- `safe-git` + `safe-rm` → `safe-ops` (unified operation guard)
- `background-notify` + `funny-working-message` → `notifications`
- `session-emoji` + `session-color` → `session-style`
- `usage-bar` → removed (command conflict with `usage-extension`)

## rpiv-mono Adoption

Adopted 5 packages from [rpiv-mono](https://github.com/juicesharp/rpiv-mono):
`rpiv-todo` (live overlay todo), `rpiv-btw` (side questions), `rpiv-args` (skill parameterization),
`rpiv-ask-user-question` (structured questions), `rpiv-warp` (Warp notifications).

---

**Final state: 54 extensions, 23 skills, 202 tests, 0 failures.**
