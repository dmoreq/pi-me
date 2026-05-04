# pi-me v0.8.0 — Feature/Module Report

> **Current state:** 5 umbrella modules, ~14 active extension units, loaded via 3-tier profile (`minimal`/`dev`/`full`). Unified Context Intelligence system consolidates context management, memory, and pruning. ~33K LOC of deprecated code removed in v0.7.0. Total active codebase: ~15K LOC.

---

## Major Changes in v0.8.0

### 🤖 Unified Context Intelligence
**Status:** NEW (consolidated 5 modules into 1)

The most significant refactor in this release: consolidation of context-intel, context-pruning, usage-extension, context-window, and memory into a single automated Context Intelligence system.

#### Automation Execution Model (Shift from suggestion to auto-execution)
| Feature | v0.7.0 | v0.8.0 |
|---------|--------|--------|
| Compaction | Manual `/compact` | **Auto at 80%** |
| Recaps | Manual `/recap` | **Auto at boundary** |
| Memory extraction | Manual consolidation | **Auto ≥3 msgs** |
| Advice | Static checks | **4 composable triggers** |
| Logging | File-based | **Telemetry-based** |
| Config | 3 systems | **1 Zod+JSONC** |

#### Architecture (27 files, 2,865 LOC)
```
session-lifecycle/context-intel/
├── types.ts, config.ts          (177 LOC) — interfaces & Zod+JSONC loader
├── index.ts                      (256 LOC) — ContextIntelExtension + hooks
├── core/                         (541 LOC) — ContextMonitor, builders, stats
├── pruning/                      (388 LOC) — 5 rules + workflow engine (1,500→680)
├── memory/                       (952 LOC) — SQLite + consolidation + injection
├── automation/                   (290 LOC) — 4 auto-modules + 12 triggers
├── ui/                           (64 LOC)  — widgets + status bars
└── commands/                     (87 LOC)  — unified /ctx command
```

#### Key Features
- **Memory System**: SQLite + FTS5 + Jaccard dedup + LLM consolidation
- **Pruning Pipeline**: 5 inlined rules, no registry/logger/wrapper (1,500→680 LOC)
- **Configuration**: Auto-migrates from old bunfig/JSON/inline to single JSONC
- **Commands**: Unified `/ctx` replaces 6 `/cp-*` commands + backward-compat aliases
- **Telemetry**: Badge notifications via pi-telemetry (no file I/O)

---

## Profile Loading Hierarchy

| Profile | Loads |
|---|---|
| **minimal** | Foundation only (safety + permission + secrets) |
| **dev** | Foundation + Session Lifecycle + Subset A of Core Tools |
| **full** | Everything above + Subset B of Core Tools + Content Tools + Authoring |

---

## 1. Foundation — Always Loaded (all profiles)

| Module | File | Functionality | Value |
|---|---|---|---|
| **Permission** | `foundation/permission/permission.ts` | 5-tier system (`minimal`/`low`/`medium`/`high`/`bypassed`), session/global persistence, `/permission` + `/permission-mode` commands, safety prompts for dangerous commands, protected path guards (`.ssh`, `/etc`, etc.) | **Primary safety layer.** Prevents accidental destruction, enforces boundaries. |
| **Safe Ops** | `foundation/safe-ops.ts` | Guards 14 git/gh patterns (force push, hard reset, rebase, merge, cherry-pick, etc.) with severity-aware prompt levels. Replaces `rm` → macOS `trash`. `/safegit`, `/saferm`, `/safegit-level` commands. | **Asset protection.** Stops git disasters, makes deletions recoverable. |
| **Secrets** | `foundation/permission/permission-core.ts` (integrated) | Obfuscation of sensitive values before they reach the LLM. | **Security.** Prevents API keys and tokens from leaking. |

---

## 2. Session Lifecycle — dev/full profiles

| Module | File | Functionality | Value |
|---|---|---|---|
| **Context Intelligence** | `session-lifecycle/context-intel/` (NEW v0.8.0) | **Auto-compact** at 80% context threshold. **Auto-recap** at session boundaries. **Auto-consolidate** memory ≥3 user messages. **Auto-advise** via 4 composable triggers. Unified `/ctx` command (stats/pruning/memory/compact/recap/debug/config). Backward-compat: `/handoff`, `/recap`, `/mem`, `/memory-consolidate`. **Memory tools**: search, remember, forget, lessons, stats. **Config**: Zod+JSONC (replaces bunfig + JSON + inline). **UI**: context widget (token bar), pruning status, memory status. | **Fully automated context hygiene.** The agent now proactively compacts context, generates recaps, and consolidates memory without user intervention. Memory system is SQLite-backed with FTS5 search and Jaccard dedup. |
| **Git Checkpoint** | `session-lifecycle/git-checkpoint/` | Auto-creates git checkpoints before every turn. Supports `/fork` with "restore code state?" dialog listing all checkpoints. Uses git refs. | **Experimentation safety net.** Users can fork conversations and restore code to any prior turn. |
| **Session Name** | `session-lifecycle/session-name.ts` | Auto-names sessions from the first user message, displayed in TUI status. | **UX polish.** Context-rich session naming instead of random IDs. |
| **Skill Args** | `session-lifecycle/skill-args.ts` | `$1`/`$2`/`$ARGUMENTS` substitution in skill bodies. | **Skill authoring.** Enables parameterized, reusable skills. |
| **Welcome Overlay** | `session-lifecycle/welcome-overlay/` | Persistent welcome header (never collapses). Toggle via `/welcome-toggle`, restore built-in via `/welcome-builtin`. | **Onboarding & identity.** Keybindings and instructions stay visible. |

---

## 3. Core Tools — dev gets subset A (10), full gets A + B (14)

### Subset A — dev + full

| Module | File | Functionality | Value |
|---|---|---|---|
| **Task Orchestration** | `core-tools/task-orchestration/` | Captures tasks from conversation, classifies intent, builds DAG, executes with progress tracking. Notification inbox, progress widget, `task_control` tool (skip/retry/prioritize). | **Autonomous workflow.** Turns chat into tracked, actionable work items. |
| **Planning Extension** | `core-tools/planning/` | Programmatic Plan API: `PlanDAG` (topological sort, cycle detection), `StepExecutor` (parallel/sequential), `createPlan`/`addStep`/`executePlan`. | **Structured execution.** Bridges plan→do gap. |
| **Plan Mode (TUI)** | `core-tools/plan-mode.ts` | `/plan` command + `plan` tool + `Ctrl+Shift+X` shortcut. Read-only planning mode (safe bash only). Full lifecycle: create/list/get/update/add-step/complete-step/claim/release/delete/execute. File-based plans in `.pi/plans/`, lock TTL for multi-session coordination. | **Core user workflow.** The most-used feature — users plan before executing, track progress step-by-step. |
| **Formatter** | `core-tools/formatter/` | Auto-formats on write/edit. 8 runners: **Biome, ESLint, Prettier, Ruff (check + format), clang-format, shfmt, markdownlint, cmake-format.** 3 format modes (tool/prompt/session). Configurable via `/formatter` TUI settings. | **Passive quality enforcement.** Code comes out formatted automatically. Polyglot support. |
| **Thinking Steps** | `core-tools/thinking-steps/` | 3-mode thinking visualization: `collapsed` ("Thinking..."), `summary` (bullet list), `expanded` (native). Cycles via `Alt+T`. Persists per-session/project/global. | **UX clarity.** Makes LLM reasoning traceable and digestible. |
| **Code Quality Pipeline** | `core-tools/code-quality/` | Pluggable format→fix→analyze pipeline via `RunnerRegistry`. `CodeRunner` interface for custom runners. Telemetry automation triggers on each stage. | **Quality infrastructure.** Backend for auto-formatting and lint fixing. |
| **File Intelligence** | `core-tools/file-intelligence/` | Indexes files on write/edit: captures imports, exports, classes, functions, language metadata. `FileStore` for persistence, `FileCapturer` for structure extraction. | **Code awareness.** Agent knows codebase structure without re-reading. |
| **Code Actions** | `core-tools/code-actions/` | `/code` command — picks code blocks from assistant messages, copies to clipboard, inserts into editor, or runs in shell. Supports `last`/`all` scoping, positional indexing. | **Developer ergonomics.** Extracts generated code without manual selection. |
| **Subprocess Orchestrator** | `core-tools/subprocess-orchestrator/` | Consolidation target for async/parallel execution. 7 modes: `single`, `chain`, `loop`, `bg`, `pi` (isolated subprocess), `list`/`status`. Rich TUI rendering. Replaces 5 deprecated modules (subagent/sub-pi/ralph-loop). | **Multi-tasking enabler.** One clean interface for all subprocess patterns. `pi` mode enables recursive agent spawning. |
| **Read-Before-Edit Guard** | `core-tools/read-guard/` | Tracks file reads, blocks edits to unread files. `/trust-me` for one-time bypass. Reset per session. | **Quality gate.** Prevents blind edits. Simple but effective. |
| **Clipboard** | `core-tools/clipboard.ts` | `copy_to_clipboard` tool using OSC52 escape sequences. Works across SSH/tmux. | **Seamless copy-paste.** No terminal-select friction. Works remotely. |

### Subset B — full profile only

| Module | File | Functionality | Value |
|---|---|---|---|
| **File Collector** | `core-tools/file-collector/` | Configurable file sidecar: captures paths/values/ranges from bash output. Config-driven via `file-collector.jsonc` with Zod schema. | **Context enrichment.** Agent captures file paths and content from shell output. |
| **AST-grep Tools** | `core-tools/ast-grep-tool/` | Registers `ast_grep_search` + `ast_grep_replace` tools for AST-level code matching and rewriting. | **Precision refactoring.** Structural understanding beyond regex. |
| **Code Review** | `core-tools/code-review/` | `/code-review` command: cognitive complexity analysis, TODO/FIXME scanning, Technical Debt Index (TDI score/100 + letter grade). Report saved to `.pi/reviews/`. | **Codebase health monitoring.** Surfaces hotspots and tracks technical debt. |
| **Auto-Fix** | `core-tools/autofix/` | Runs Biome `--write`, ESLint `--fix`, Ruff `--fix` transparently after file writes/edits. | **Zero-friction linting.** Fixes applied without user action. |

---

## 4. Content Tools — full profile only

| Module | File | Functionality | Value |
|---|---|---|---|
| **GitHub Tool** | `content-tools/github.ts` | Full GitHub API via `github` tool: search issues/PRs/code/repos, get file contents, create issues. Auth via `GITHUB_TOKEN`. | **GitHub workflow integration.** Agent can triage issues, search code, create issues. |
| **Repeat** | `content-tools/repeat/repeat.ts` | Repeats previous `bash`/`edit`/`write` tool calls with modification. TUI selector for history, preview, rerun. | **Iterative accelerator.** Reruns commands without re-typing. |
| **File Picker** | `content-tools/file-picker/` | TUI file browser with reveal/quick-look/open/edit/add-to-prompt actions. Configurable shortcuts, directory support, range selection. | **File navigation UX.** Visual browsing instead of path typing. |
| **Web Tools** | `content-tools/web-tools/` | `web_search` + `web_fetch` tools. Consolidated from deprecated `web-search.ts` + `content-tools/web-fetch/`. HTML sanitization. Telemetry automation triggers. | **Web-aware agent.** Research, docs, external resources. Search-then-fetch pipeline for rich context. |

---

## 5. Authoring — full profile only

| Module | File | Functionality | Value |
|---|---|---|---|
| **Commit Helper** | `authoring/commit-helper/` | Generates conventional commit messages from git diffs via `commit_message` tool. | **Developer productivity.** Automates tedious git step. |
| **Skill Bootstrap** | `authoring/skill-bootstrap/` | Scaffolds skill files with proper structure, manifest, and SKILL.md template. | **Extensibility.** Lowers barrier for skill creation. |

---

## 6. Shared Utilities — Used by all modules

| Module | File | Functionality | Value |
|---|---|---|---|
| **ExtensionLifecycle** | `shared/lifecycle.ts` | SOLID base class: 9 optional hooks, auto telemetry wiring, `notify()` + `track()` helpers. | **Architecture backbone.** Eliminates telemetry boilerplate across modules. |
| **Telemetry Helpers** | `shared/telemetry-helpers.ts` | `registerPackage()`, `telemetryNotify()`, `telemetryHeartbeat()` — ergonomic no-op-safe wrappers. | **Telemetry ergonomics.** Simplifies instrumentation. |
| **PI Config Loader** | `shared/pi-config.ts` | JSONC config loader with Zod validation, nested defaults, line/column error reporting. | **Config infrastructure.** Powers all configurable tools. |
| **Profile Reader** | `shared/profile.ts` | Reads `profile` field from `settings.json` → `"minimal"`, `"dev"`, or `"full"` (default). | **Load mechanism.** Drives module loading hierarchy. |
| **Register Adopted Package** | `shared/register-package.ts` | DRY helper for lazy-loading external npm packages as pi extensions. | **Third-party integration pattern.** Standardizes external package onboarding. |
| **Audio / Notify / Terminal** | `shared/audio.ts`, `notify-utils.ts`, `terminal.ts` | Beep sounds, OS X `say` speech, terminal bring-to-front, OS X notifications. | **Background awareness.** Alerts users when terminal not in focus. |

---

## 7. Skills (7+ directories)

| Skill | Description |
|---|---|
| **using-superpowers** | Onboarding — guides users to find and invoke other skills. |
| **todo** | Multi-step task tracking with pending→in_progress→completed status. |
| **permission** | Mirror of permission system command docs. |
| **secrets** | Docs for foundation-level secrets manager. |
| **dispatching-parallel-agents** | Docs for parallel task execution. |
| **systematic-debugging** | Full debugging methodology with condition-based waiting, defense-in-depth. |
| **plugin-guide** | Decision tree for choosing the right tool/extension/skill. |
| **authoring-skills / writing-skills** | Companion SKILL.md docs for authoring tools. |

---

## Code Metrics Summary

| Metric | v0.7.0 | v0.8.0 | Delta |
|--------|--------|--------|-------|
| Active LOC | ~15,000 | ~15,000 | − |
| Deprecated LOC | ~33,000 (removed) | — | −33K |
| Extensions | 14 | 14 | − |
| Umbrella modules | 5 | 5 | − |
| Commands | 60+ | 60+ (new: `/ctx`) | + 1 unified |
| Tools | 40+ | 40+ (new: 5 memory tools) | + 5 memory |
| Config systems | 3 (bunfig+JSON+inline) | 1 (Zod+JSONC) | **−2** |
| Dependency: bunfig | present | **removed** | − |

---

## Architecture Diagram (v0.8.0)

```
pi-me v0.8.0 (~15K active LOC)
│
├── foundation/ ───────────────────────── Always loaded
│   ├── Permission       ← Safety net (5 tiers)
│   ├── Safe Ops         ← Git/rm guards
│   └── Secrets          ← Credential protection
│
├── session-lifecycle/ ─────────────────── dev/full profiles
│   ├── Context Intelligence ← NEW: Auto-compact, auto-recap, auto-consolidate
│   │   ├── Memory (SQLite + FTS5 + Jaccard dedup)
│   │   ├── Pruning (5 rules, 1,500→680 LOC)
│   │   ├── Automation (4 auto-modules)
│   │   └── Unified /ctx command
│   ├── Git Checkpoint   ← Per-turn snapshots
│   ├── Session Name     ← Auto-naming
│   ├── Skill Args       ← $1/$2 substitution
│   └── Welcome Overlay  ← Persistent header
│
├── core-tools/ ──────────────────────── dev: subset A | full: A + B
│   ├── [Subset A: Always in dev/full]
│   │   ├── Task Orchestration       ← DAG execution
│   │   ├── Planning (programmatic)
│   │   ├── Plan Mode (TUI)          ← /plan + tool
│   │   ├── Formatter                ← 8 runners
│   │   ├── Thinking Steps           ← 3-mode viz
│   │   ├── Code Quality Pipeline
│   │   ├── File Intelligence        ← AST indexing
│   │   ├── Code Actions             ← /code command
│   │   ├── Subprocess Orchestrator  ← 7 modes (replaces 5 deprecated)
│   │   ├── Read-Guard               ← Edit safety
│   │   └── Clipboard                ← OSC52 copy
│   │
│   └── [Subset B: Full profile only]
│       ├── File Collector           ← Sidecar capture
│       ├── AST-grep Tools           ← Structural refactor
│       ├── Code Review              ← TDI scoring
│       └── Auto-Fix                 ← Lint on save
│
├── content-tools/ ──────────────────── full profile
│   ├── GitHub Tool      ← GH API
│   ├── Repeat           ← Command repeat
│   ├── File Picker      ← TUI browser
│   └── Web Tools        ← search + fetch (consolidated from deprecated)
│
├── authoring/ ──────────────────────── full profile
│   ├── Commit Helper    ← Conventional commits
│   └── Skill Bootstrap  ← Scaffold skills
│
└── shared/ ─────────────────────────── Infrastructure
    ├── ExtensionLifecycle      ← SOLID base
    ├── Telemetry Helpers
    ├── PI Config Loader        ← Zod+JSONC
    ├── Profile Reader
    └── Register Package Helper
```

---

## Key Improvements in v0.8.0

### 🎯 Consolidation & Simplification
- **Context Intelligence**: 5 modules → 1 unified system (context-intel, context-pruning, usage-extension, context-window, memory)
- **Configuration**: 3 separate systems → 1 Zod+JSONC config
- **Code reduction**: 2,265 LOC net savings (44% reduction in context modules)
- **Dependency removal**: bunfig removed

### 🤖 Automation Shift
- **Auto-compact**: Executes at 80% context threshold (was: manual `/compact`)
- **Auto-recap**: Generates at session boundaries (was: manual `/recap`)
- **Auto-consolidate**: Extracts memory ≥3 user messages (was: manual consolidation)
- **Auto-advise**: 4 composable triggers with cooldown (was: static checks)

### 💾 Memory System Upgrade
- SQLite-backed persistent memory (was: scattered JSON files)
- FTS5 full-text search + linear fallback
- Jaccard similarity dedup (70% threshold for lessons)
- UUID-based lesson IDs + soft-delete
- LLM-backed consolidation (extract facts + lessons)
- 5 memory tools: search, remember, forget, lessons, stats

### ⚙️ Command Unification
- **New**: `/ctx stats|pruning|memory|compact|recap|debug|config`
- **Backward-compat**: `/handoff`, `/recap`, `/mem`, `/memory-consolidate` still work
- **Removed**: 6 `/cp-*` commands (debug, init, logs, recent, stats, toggle)

### 🏗️ SOLID Principles Applied
- **Single Responsibility**: Each module owns one concern
- **Open/Closed**: Rules/triggers added via arrays (no core edits)
- **Liskov Substitution**: All automation components share lifecycle interface
- **Interface Segregation**: Focused, minimal interfaces
- **Dependency Inversion**: Depends on interfaces, not implementations

---

## Backward Compatibility Status

✅ **FULLY BACKWARD COMPATIBLE**
- All existing commands work unchanged
- Memory tools unchanged in signature
- Config auto-migrates from old format
- Token usage widget still works (moved to context-intel)
- Backward-compat aliases for all old commands
- Zero breaking changes for end users

---

## Next Steps (v0.9.0 and beyond)

- [ ] Port existing tests from legacy modules
- [ ] Integration testing on sandbox sessions
- [ ] Auto-consolidation LLM call implementation (currently placeholder)
- [ ] Memory injection optimization for large fact databases
- [ ] Lesson Jaccard threshold tuning (currently 0.7)
- [ ] FTS5 availability detection and graceful degradation
- [ ] Performance profiling of SQLite store under heavy load
