# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
