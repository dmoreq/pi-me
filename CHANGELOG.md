# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-05-06

### Removed

- **Permission feature removed**: `foundation/permission/` (9 files) and `skills/permission/` fully deleted. This includes the 3-layer guard (safety patterns, permission tiers, safe-ops), `/permission`, `/permission-mode`, `/safegit`, `/saferm` commands, path-guard, and all associated tests and skill documentation.
- **Git checkpoint removed**: `session-lifecycle/git-checkpoint/` (3 files) fully deleted. Git-based checkpoint snapshots and restore functionality removed.
- **pi-dialog dependency removed**: Removed from `package.json` dependencies and `pi.extensions` list.

---

## [1.0.0] - 2026-05-04 (Unified Task & Plan Management)

### BREAKING CHANGES

- **Task Orchestration and Plan Mode merged**: `core-tools/task-orchestration/` and `core-tools/planning/` fully replaced by a single unified `core-tools/task-plan/` module. The `plan` tool and `task_control` tool are replaced by a single `task` tool with 15+ actions.
- **core-tools/intent/types.ts removed**: Types moved into `core-tools/task-plan/src/types.ts` as the single source of truth.
- **Safety/review mode**: Auto-captured tasks now require explicit review (`requiresReview=true`) before execution. Use `task review` tool with `approve=true` to approve.
- **New `task` tool**: Replaces both `plan` and `task_control` tools. Supports: list, get, create, update, delete, add-step, complete-step, claim, release, execute, skip, retry, review, search.

### Added

- **Unified Task type**: Single `Task` interface that works for both auto-captured tasks and user-created plans (a plan is a Task with `steps[]` and `title`).
- **Unified TaskDAG**: Merged from both systems — topological sort, cycle detection, ready-task queries.
- **Unified TaskStore**: JSON file persistence with locking, garbage collection, search/filtering, event log.
- **Unified TaskExecutor**: DAG-based batch execution with retry, timeout, safety mode, dry-run mode, and event emission.
- **Unified Intent Detector**: AI-first (Groq/Llama) with regex-based manual fallback.
- **Unified TaskCapture**: Extracts tasks from conversation with priority/tag/dependency inference.
- **Safety mode**: Auto-captured tasks require review before execution. Toggle with `setSafetyMode()`.
- **`/tasks` command**: List all tasks grouped by status.
- **`/tasks-review` command**: Show tasks awaiting review.
- **`/task <description>` command**: Quick task creation from command line.
- **58 new unit tests** covering types, store, capture, executor, and intent detection.
- **Telemetry tracking**: All task operations tracked via pi-telemetry.

### Removed

- `core-tools/task-orchestration/` — fully replaced by task-plan
- `core-tools/planning/` — fully replaced by task-plan
- `core-tools/intent/types.ts` — moved into task-plan/types.ts
- `plan` tool — replaced by unified `task` tool
- `task_control` tool — actions merged into `task` tool

---

## [0.10.0] - 2026-05-04 (Codebase Cleanup & Pipeline Fix)

### Cleanup

- **Deleted 5 flat barrel files**: core-tools/code-quality.ts, core-tools/planning.ts, core-tools/subprocess-orchestrator.ts, content-tools/web-tools.ts, core-tools/file-intelligence.ts -- pure re-exports with no consumers.
- **Deleted 4 orphaned utility files**: shared/automation-manager.ts, shared/path-utils.ts, shared/tool-detect.ts, core-tools/fs-utils.ts -- never imported or wired.
- **Deleted stale .d.ts file**: content-tools/repeat/types.d.ts -- no consumers.
- **Fixed .js to .ts import extensions** across 21 files -- all internal relative imports now use correct extensions.
- **Stripped version-history docblocks** from 7 source files. Changelog consolidated into this file.
- **Updated legacy reference comments** in 3 files to reflect current architecture.

### Fixed

- **CodeQualityPipeline**: processFile() returned StageResult (single object) but types/tests expected StageResult[]. Added toStageResults() method; fixed extension.ts consumer to iterate arrays. Removed dead "analyze" stage from types, pipeline, and tests.
- **Restored shared/telemetry-automation.ts**: Was missing from filesystem after context-intel extraction. Restored from git history.

### Added

- **Restored memory/ module** from feature branch: core-tools/memory/index.ts, core-tools/memory/src/ (store, consolidator, injector, bootstrap), core-tools/memory-mode.ts. Adds +41 passing tests.

### Tests

- 490 tests passing, 0 failing (up from 426 with 6 pre-existing failures fixed).

---

## [0.9.0] - 2026-05-04 (Context-Intel Cleanup)

### BREAKING CHANGES

- **Context-Intel removed**: `session-lifecycle/context-intel/` fully removed and deleted. The context-intelligence system (context monitoring, pruning, automation, memory, plugins) was adopted into **pi-slim v0.2.0** as the core context management layer. See [pi-slim](https://github.com/dmoreq/pi-slim) for the complete system.
- **Barrel file removed**: `session-lifecycle/context-intel.ts` deleted. No remaining consumers.
- **bunfig dependency removed**: No longer used after context-intel deletion.

### Cleanup

- Deleted planning documents: `CONTEXT_INTEL_IMPLEMENTATION_PLAN.md`, `CONTEXT_INTEL_REFACTOR_PLAN.md`, `CONTEXT_INTEL_SUMMARY.md`, `CODE_QUALITY_CONSOLIDATION_COMPLETE.md`, `CODE_QUALITY_CONSOLIDATION_PLAN.md`, `CODE_QUALITY_REFACTOR_PLAN.md`, `FEATURE_REPORT.md`.
- Updated `session-lifecycle/index.ts` — removed ContextIntelExtension import/registration, bumped telemetry version to 0.9.0.
- Updated `package.json` — bumped version to 0.9.0, removed bunfig.

## [0.5.0] - 2026-05-04 (Extension Consolidation & Agent Automation)

### BREAKING CHANGES

- **Permission + Safe Ops merged**: `foundation/safe-ops.ts` removed. All safe-ops commands (/safegit, /saferm, etc.) still work — now loaded via `foundation/permission/` as `SafeOpsLayer`.
- **Context Window + Usage merged**: `session-lifecycle/usage-extension/` removed. `/usage` and `/cost` commands moved to `foundation/context-monitor/`.
- **Context Pruning → Plugin**: `session-lifecycle/context-pruning/` removed. Pruning rules are now plugins in `session-lifecycle/context-intel/plugins/`. Commands (/cp-stats, /cp-toggle) still work.
- **Read Guard → Plugin**: `core-tools/read-guard/` removed. Now a plugin in `session-lifecycle/context-intel/plugins/`. `/trust-me` command still works.
- **Formatter → Code Quality**: Formatter runners accessible via code-quality pipeline adapter. `/formatter` command remains.
- **Welcome + Session Name merged**: `session-lifecycle/welcome-overlay/` and `session-lifecycle/session-name.ts` merged into `session-lifecycle/welcome/`.
- **Skill Bootstrap → Memory**: `authoring/skill-bootstrap/` removed. Auto-project-context scanning now happens in `core-tools/memory/src/project-context.ts`.
- **Code Actions removed**: `core-tools/code-actions/` deleted (redundant with built-in TUI).
- **File Picker removed**: `content-tools/file-picker/` deleted (redundant — agent reads files directly).

### Features

- **3 new TelemetryAutomation triggers** (10-12): sessionStale, memoryReadyForConsolidation, contextPressure
- **AutomationManager**: new `shared/automation-manager.ts` with sense → decide → act → inform pipeline
- **Plugin system**: `session-lifecycle/context-intel/plugins/plugin.ts` — composable `ContextPlugin` interface with `PluginManager`
- **CommandBuilder**: new `shared/command-builder.ts` — DRY settings/toggle/status command registration
- **Auto-project-context scanning**: Memory automatically scans project structure on session_start

### Architecture

- Extensions reduced from 37 to 22 unified modules
- All merged extensions extend `ExtensionLifecycle` (SOLID base class)
- PluginManager handles lifecycle dispatch for composable plugins
- Telemetry-driven automation across context-intel, memory, and permission

### Tests

- All 545 existing tests preserved and passing

## [0.4.0] - 2025-06-XX (Production-Grade Deep Cleanup)

### BREAKING CHANGES

⚠️ **3 Extensions Removed** — These were deprecated in v0.3.1:
- `session-lifecycle/auto-compact/` — Removed (-300 LOC)
- `session-lifecycle/handoff.ts` — Removed (-150 LOC)
- `session-lifecycle/session-recap/` — Removed (-80 LOC)

**Migration Path:**
All features are now provided exclusively by **ContextIntelExtension**:
- `/handoff [goal]` — Unchanged, better integration
- `/recap` — Unchanged, better integration
- Auto-compact on threshold — Still works, same behavior

No code changes needed unless you were directly importing these modules.

### Major Changes

#### Architecture Cleanup
- **Unified Extension Patterns** — All umbrellas now use consistent loading
- **Removed Dead Extensions** — preset, edit-session, files-widget gone
- **Cleaned Umbrellas:**
  - `core-tools/index.ts` — Updated to v0.4.0 pattern
  - `content-tools/index.ts` — Updated to v0.4.0 pattern
  - `session-lifecycle/index.ts` — Removed deprecated calls

#### Code Metrics
- **-490 LOC** removed (deprecated modules)
- **-1,020 LOC** total redundancy eliminated (includes v0.3.1 stubs)
- **-536 LOC** duplicate code consolidated
- **40 extensions** → unified patterns (all consistent)

#### Telemetry
- All 9 agent automation triggers firing correctly
- All extensions register via `pi-telemetry` uniformly
- Dashboard now shows clean, consistent metadata

### Documentation Updates

- **README.md** — Updated architecture, removed old references
- **EXTENSIONS_TABLE.md** — Removed deprecated entries
- **EXTENSION_REVIEW.md** — Removed deprecated sections
- **CHANGELOG.md** — This file, comprehensive v0.4.0 summary
- **MIGRATION_GUIDE_v0.4.0.md** — New detailed migration guide

### Testing

- 598 tests passing, 0 failing
- All telemetry tests verified
- All extension loading patterns tested

### Code Quality

- Production-grade code quality achieved
- All extensions use consistent patterns
- Umbrellas cleanly organized
- Foundation layer stable
- 85%+ test coverage maintained

---

## [0.3.1] - 2025-05-XX (Soft Deprecation)

### DEPRECATED (will remove in v0.4.0)

⚠️ **Legacy Extensions** — These have been merged into ContextIntelExtension (v0.3.0):
- `session-lifecycle/auto-compact/` — auto context compaction
- `session-lifecycle/handoff.ts` — session handoff command
- `session-lifecycle/session-recap/` — session summary command

**Migration:** No changes needed! All features work identically through ContextIntelExtension.
These modules are deprecated stubs and will be removed in v0.4.0.

For details, see [MIGRATION_GUIDE_v0.3.1.md](./MIGRATION_GUIDE_v0.3.1.md).

### Hotfixes

- **Critical:** Load ContextIntelExtension (was implemented but never registered)
  - All 9 telemetry automation triggers now fire correctly
  - Context management features (handoff, recap, compact) fully working
  - Fixes: context-depth, high-activity, file-involvement badges

### Documentation

- Added deprecation notices to legacy modules
- Updated EXTENSIONS_TABLE.md with deprecation markers
- Updated EXTENSION_REVIEW.md with migration guidance
- Created comprehensive cleanup & migration documentation

### Testing

- 598 tests passing, 0 failing
- All telemetry automation triggers verified
- Backward compatibility confirmed

---

## [0.3.0] - 2025-05-03

### Major Changes

#### Extension Merges (6 merges → 7 new extensions)
- **Context Intelligence** (replaces handoff, auto-compact, session-recap)
  - `TranscriptBuilder` — extract & format conversation transcripts
  - `PromptBuilder` — construct prompts for handoff, recap, compaction
  - `ContextIntelExtension` — auto-suggest context management

- **Planning** (unifies plan-mode + task-orchestration)
  - `PlanDAG` — topological sort, cycle detection, dependency analysis
  - `StepExecutor` — parallel/sequential task execution
  - Unified `Plan`/`PlanStep` types

- **Code Quality Pipeline** (merges formatter, autofix, code-actions)
  - `RunnerRegistry` — extensible runner management (Open/Closed principle)
  - `CodeQualityPipeline` — format → fix → analyze pipeline
  - `CodeRunner` interface

- **File Intelligence** (new, replaces scattered file logic)
  - `FileStore` — JSON-based file index persistence
  - `FileCapturer` — extract structure (imports, exports, classes, functions)
  - Automatic indexing on write/edit

- **Subprocess Orchestration** (new, bridges planning + execution)
  - `TaskNormalizer` — adapt PlanSteps to SubprocessTasks
  - `SubprocessExecutor` — sequential/parallel with retry logic
  - Critical task failure handling

- **Web Tools** (consolidates web-search + web-fetch)
  - `WebSearcher` — unified search interface
  - `WebFetcher` — fetch & extract text from URLs
  - HTML sanitization (removes scripts, styles)

#### Shared Foundation
- **`ExtensionLifecycle`** — SOLID base class
  - Eliminates 7 copies of telemetry boilerplate
  - 8 optional lifecycle hooks (onSessionStart, onTurnEnd, onAgentEnd, etc.)
  - Built-in `notify()` and `track()` helpers

- **Telemetry Helpers** — safe wrappers
  - `registerPackage()`, `telemetryNotify()`, `telemetryHeartbeat()`
  - No-ops when telemetry not loaded

- **Telemetry Automation** — 9 agent-automation triggers
  - Context depth warning (≥50 messages)
  - High activity detection (>5 tool calls)
  - File involvement detection (>10 files)
  - Plan creation, parallel tasks, file indexing, web search, etc.
  - Badge-based notifications with telemetry integration

- **Code Extraction** — reduced duplication
  - `session-name.ts` — auto-name sessions from first message
  - `skill-args.ts` — $1/$2/$ARGUMENTS substitution
  - `clipboard.ts` — OSC52 clipboard support
  - Split `notify-utils.ts` (20K → 3 focused modules)

#### Test Runner Fix
- Converted 11 jest test files → `node:test`
- Replaced `@jest/globals` with `node:assert/strict`
- Removed nested jest config in task-orchestration
- All tests now use Node.js built-in test runner

### Removed

- ❌ **Preset extension** (`core-tools/preset/`) — unused
- ❌ **Edit Session extension** (`core-tools/edit-session/`) — deprecated
- ❌ **Files Widget** (`content-tools/files-widget/`) — broken

### Added

- ✅ 7 new extensions (all extend `ExtensionLifecycle`)
- ✅ 48 new TypeScript modules
- ✅ 598 passing tests (up from 464)
- ✅ 0 failing tests (fixed all 23 jest-related failures)
- ✅ 100% test pass rate

### Architecture Improvements

#### DRY (Don't Repeat Yourself)
- Eliminated 7 copies of telemetry boilerplate
- Single `TranscriptBuilder` (was 3 copies)
- Single `PromptBuilder` (was 3 copies)
- Unified `Plan`/`PlanStep` (was separate Task/TaskDAG)

#### SOLID Principles
- **Single Responsibility**: Each module has one reason to change
- **Open/Closed**: RunnerRegistry & CodeQualityPipeline extensible without edits
- **Liskov Substitution**: CodeRunner interface enables drop-in replacements
- **Interface Segregation**: Focused types (RunnerConfig, RunnerResult)
- **Dependency Inversion**: Pipeline depends on abstractions, not concrete runners

#### Testing
- All tests use `node:test` + `node:assert/strict`
- Pure functions testable in isolation
- Mock implementations for side effects
- Comprehensive coverage: builders, DAG, executors, registries, stores

### Breaking Changes

- **Removed tools**:
  - `preset_*` (all preset management tools)
  - `edit_session_*` (all session editing tools)
  - `files_widget_*` (all file widget tools)

- **Changed exports** (barrel paths updated):
  - `session-lifecycle/handoff.ts` → merged into `session-lifecycle/context-intel/`
  - `session-lifecycle/auto-compact/` → merged into `session-lifecycle/context-intel/`
  - `session-lifecycle/session-recap/` → merged into `session-lifecycle/context-intel/`
  - `core-tools/formatter/` + `core-tools/autofix/` → merged into `core-tools/code-quality/`
  - `core-tools/task-orchestration/` files now under `core-tools/planning/`

- **API Changes**:
  - `getRecap()` now returns string instead of launching TUI
  - `createPlan()` signature unchanged but wires telemetry automation
  - All extensions now require `ExtensionLifecycle` base (or adapt manually)

### Notes for Users

- **Upgrade recommended**: v0.3.0 removes technical debt (dead code, duplication)
- **Backwards compatibility**: Deprecated tools stay as aliases in this release (will remove in 0.4.0)
- **New automation**: Extensions now emit badge notifications for context management hints
- **Test reliability**: All 23 previously failing tests now pass (jest → node:test migration)

### Migration Guide for Extension Authors

If you've extended pi-me in a custom extension:

1. **For telemetry**: Use `ExtensionLifecycle` base class
   ```typescript
   export class MyExtension extends ExtensionLifecycle {
     // ...
     async onAgentEnd(...) { this.notify(...); this.track(...); }
   }
   ```

2. **For runners**: Implement `CodeRunner` interface
   ```typescript
   class MyRunner implements CodeRunner {
     id = "my-runner";
     type = "format";
     matches(path) { return path.endsWith(".ts"); }
     async run(path, config) { ... }
   }
   ```

3. **For file indexing**: Use `FileStore` + `FileCapturer`
   ```typescript
   const store = new FileStore();
   const captured = FileCapturer.capture(filePath, content);
   ```

4. **For tests**: Use `node:test` + `node:assert/strict`
   ```typescript
   import { describe, it } from "node:test";
   import assert from "node:assert/strict";
   ```

---

## [0.2.0] - Previous release

See git history for details.
