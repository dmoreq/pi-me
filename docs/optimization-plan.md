# Codebase Review & Optimization Plan

Current state: **59 extensions**, **25 skills**, **10 test files**, **~36K lines of TypeScript**.

---

## Issues Found

### 🔴 High Priority

**1. No tests for 49/59 extensions**
Only 10 test files for 59 extensions. Largest untested files: `plan-mode.ts` (1852 lines), `ralph-loop.ts` (1714 lines), `sub-pi/extension.ts` (1272 lines), `usage-extension` (1128 lines), `usage-bar.ts` (1079 lines), `browser.ts` (1068 lines).

**2. 8 files over 800 lines with no extraction**
These are prime candidates for splitting into pure-logic + extension-glue patterns (like `plan-tracker-core.ts` / `plan-tracker.ts`):
- `plan-mode.ts` (1852)
- `ralph-loop.ts` (1714)
- `richard-files/extension.ts` (1286)
- `sub-pi/extension.ts` (1272)
- `permission-core.ts` (1194)
- `usage-extension/index.ts` (1128)
- `spice-invaders.ts` (1104)
- `usage-bar.ts` (1079)

**3. Four overlapping loop tools**
`ralph-loop` (subagent dispatch), `pi-ralph-wiggum` (file-based), `sub-pi` (single subagent spawn), `loop` (in-session repeat) — all solve "run something repeatedly" differently. Users and agents face choice paralysis.

**4. 32 singleton .ts files at layer root**
Files like `clipboard.ts`, `flicker-corp.ts`, `memory-mode.ts`, `safe-git.ts` etc. are directly in `foundation/`, `core-tools/`, `session-lifecycle/` rather than organized into subdirectories. Contrast with `permission/`, `secrets/`, `ralph-loop/` which use subdirs properly.

**5. `pi-config.ts` orphaned**
Removed from `pi.extensions` but still on disk. It's imported by other extensions as a library, so it must stay — but it's now invisible in the registration, which is confusing.

### 🟡 Medium Priority

**6. `rhubarb-shared/` lives in `session-lifecycle/` but is imported by `foundation/safe-git.ts`**
Should be in a top-level `shared/` directory so any layer can import it without weird relative paths.

**7. Test script misses many testable modules**
The `npm test` script only runs 10 test files. Any new tests added won't run automatically unless added to the script. Should use a glob pattern for auto-discovery.

**8. `memory-mode.ts` in wrong layer**
It's in `foundation/` (always-on guards) but it's a `/mem` command — should be in `core-tools/` or `session-lifecycle/`.

**9. `notebook.test.ts` at `content-tools/` root instead of alongside `notebook.ts`**
Consistency: most tests are in `tests/` subdirs. This one is a singleton at the layer root.

**10. `pi-config.ts` as orphaned library**
It's imported by 5 extensions via relative paths. It works but isn't registered anywhere. Needs clearer documentation.

### 🟢 Low Priority

**11. No README for each layer directory**
`foundation/`, `session-lifecycle/`, `core-tools/` have no index README explaining what goes where.

**12. Mixed import extension patterns**
Some extensions import `.js` extensions (TypeScript compiled), others use bare module names. Inconsistent but functional.

---

## Optimization Plan

### Phase 1: Structural Cleanup (low effort, high impact)

| Task | Effort | Impact |
|------|--------|--------|
| Move `rhubarb-shared/` to root `shared/` dir | 15 min | Fixes confusing cross-layer import |
| Move `memory-mode.ts` → `core-tools/memory-mode.ts` | 5 min | Correct layer placement |
| Move `notebook.test.ts` → alongside `notebook.ts` subdir | 5 min | Consistency |
| Remove orphaned `pi-config.ts` → absorbed into each extension that needs it, or keep as documented library | 10 min | Dead code cleanup |

### Phase 2: Large File Splitting (medium effort, high maintainability)

For each file >800 lines, extract pure logic into a `-core.ts` file:

| File | Extract to | Strategy |
|------|------------|----------|
| `plan-mode.ts` (1852) | `plan-mode-core.ts` | Separate plan CRUD logic from TUI rendering |
| `ralph-loop.ts` (1714) | Already partially done (`ralph-types.ts`, `ralph-render.ts`) | Complete: extract subagent spawning logic |
| `richard-files/extension.ts` (1286) | Split into `browser.ts`, `actions.ts`, `renderer.ts` | Follow existing `files-widget/` pattern |
| `sub-pi/extension.ts` (1272) | `sub-pi-core.ts` | Extract process spawning + result parsing |
| `usage-extension/index.ts` (1128) | `usage-core.ts`, `usage-render.ts` | Separate data collection from rendering |
| `usage-bar.ts` (1079) | `usage-bar-core.ts` | Same pattern |
| `browser.ts` (1068) | Already in `files-widget/` multi-file setup | Acceptable as-is |

### Phase 3: Test Coverage (ongoing, per-extension)

Add tests for the top 10 untested files. Priority based on complexity:

| Priority | File | Test Focus |
|----------|------|------------|
| P0 | `permission-core.ts` (1194) | Command classification, risk levels, edge cases |
| P1 | `plan-mode.ts` (1852) | Plan CRUD, status transitions, planning mode toggling |
| P2 | `sub-pi/extension.ts` (1272) | Config parsing, process spawning |
| P3 | `usage-extension/index.ts` (1128) | Cost aggregation, time-window filtering |
| P4 | `ralph-loop.ts` (1714) | Already has agent loading tests; add state machine tests |
| P5–10 | Remaining large files | Core logic extraction + test |

### Phase 4: Loop Tool Consolidation (strategic decision needed)

Evaluate whether to keep all 4 loop tools or merge:

| Tool | Mechanism | Keep? |
|------|-----------|-------|
| `ralph-loop` | Subagent dispatch + condition polling | ✅ Keep — most powerful |
| `pi-ralph-wiggum` | File-based task file + iteration | ❌ Deprecate — superseded by ralph-loop |
| `sub-pi` | Single subagent spawn | ✅ Keep — different use case (one-shot) |
| `loop` | In-session prompt repeat | ❌ Deprecate — overlaps with ralph-loop's single mode |

### Phase 5: Test Runner Auto-Discovery

Replace the manual test glob list with a dynamic discovery pattern:

```json
{
  "scripts": {
    "test": "tsx --test 'foundation/**/*.test.ts' 'session-lifecycle/**/*.test.ts' 'core-tools/**/*.test.ts' 'content-tools/**/*.test.ts' 'authoring/**/*.test.ts'"
  }
}
```

This auto-discovers any `*.test.ts` file in the project.
