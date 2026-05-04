# π-me Extension Review — Complete Codebase Survey

**Last Updated:** 2025-06-XX (v0.4.0)  
**Total Extensions:** 37 (4 umbrella + 33 specialized, removed 3 deprecated in v0.4.0)  
**Test Coverage:** 598 passing tests, 0 failing  
**Architecture:** SOLID principles, ExtensionLifecycle base class, agent automation, production-grade

---

## 📋 Executive Summary

The π-me extension suite is organized into **4 profile-based umbrellas** that load specialized extensions based on user profile:

| Umbrella | Profile | Extensions | Purpose |
|----------|---------|-----------|---------|
| **foundation** | Always | 4 | Safety & security baseline |
| **session-lifecycle** | dev, full | 9 | Session state & context management |
| **core-tools** | dev, full | 16 | Agent capabilities & task execution |
| **content-tools** | full only | 5 | Content utilities & web access |
| **authoring** | dev, full | 2 | AI-assisted creation helpers |
| **Sub-extensions** | Various | (nested) | Specialized sub-tools |

**Total: 40+ extensions delivering 60+ agent tools and 25+ skills**

---

## 🏛️ Foundation Layer (Always On)

**Profile:** Always loaded, regardless of user profile selection.  
**Version:** 0.2.0  
**Purpose:** Safety guards, permission control, secret obfuscation, context tracking.

### 1. **Secrets Obfuscation** (`secrets/`)

**What it does:**
- Scans all tool output and conversation context for sensitive credentials
- Detects: API keys, tokens, private keys, database URIs, auth headers
- Automatically obfuscates detected secrets (replaces with `[REDACTED]`)
- YAML-configurable patterns for organization-specific secrets

**Key Methods:**
- `scanForSecrets(text)` — identify credential patterns
- `obfuscateSecrets(text)` — replace with [REDACTED]

**Events:** Runs on every tool output, message, and context update  
**Config:** `.pi/secrets.yml` for custom patterns  
**Example:** `API_KEY=sk-abc123` → `API_KEY=[REDACTED]`

---

### 2. **Permission System** (`permission/`)

**What it does:**
- 5-tier command safety model (minimal → bypassed)
- Blocks dangerous patterns: `rm -rf /`, `git reset --hard`, `sudo`
- Validates before bash execution, file writes, deletions
- Per-command safety rules

**Tiers:**
1. **minimal** — only read operations allowed
2. **interactive** — allows edit but blocks destructive ops
3. **standard** (default) — permits most operations except `rm -rf`
4. **unrestricted** — allows all except `sudo` and password entry
5. **bypassed** — no restrictions (dangerous, use with caution)

**Key Methods:**
- `validateCommand(cmd, tier)` — check if command is safe
- `isSafeForTier(pattern, tier)` — pattern safety check

**Dangerous Patterns Blocked:**
- `rm -rf /`, `dd if=/dev/zero`, `> /boot/`, `: > file`
- `git reset --hard`, `git push --force`
- `sudo`, `passwd`, `su -`

**Events:** Fires on bash command execution  
**Configuration:** Set via `/permission` slash command

---

### 3. **Safe Operations** (`safe-ops.ts`)

**What it does:**
- Intercepts dangerous operations and makes them safer
- Platform-specific safe replacements

**Replacements:**
| Original | Replacement (macOS) | Reason |
|----------|-------------------|--------|
| `rm -rf` | → `trash` command | Recoverable via Trash |
| `git reset --hard` | → Prompts for confirmation | Prevents accidental loss |
| `git push --force` | → Requires explicit flag | Prevents branch overwrites |

**Key Methods:**
- `replaceDangerousOps(bash)` — rewrite unsafe commands
- `confirmDestructiveOp(cmd)` — prompt user for confirmation

**Platform Detection:** macOS, Linux, Windows-specific behavior  
**Events:** Runs on every bash command before execution

---

### 4. **Context Window** (`context-window/`)

**What it does:**
- Real-time monitoring of conversation context usage
- Visual footer widget showing context % used
- Warns at 70%, alerts at 90%, blocks at 100%
- Integrates with auto-compact and handoff suggestions

**Display:**
```
[Context: 65% (1.2M/2M tokens)] ← Green
[Context: 75% (1.5M/2M tokens)] ⚠️  Yellow
[Context: 92% (1.84M/2M tokens)] 🔴 Red
```

**Key Methods:**
- `calculateContextUsage()` — measure current usage
- `renderWidget()` — display footer indicator
- `maybeWarnOrBlock()` — alert at thresholds

**Thresholds:**
- 70% → Show warning
- 90% → Show alert badge
- 100% → Block further input, suggest `/handoff`

**Events:** Updates on every turn, message, tool call  
**Integration:** Triggers `context-intel` handoff/compact suggestions

---

## 📅 Session Lifecycle (dev / full profiles)

**Profile:** Loaded for `dev` and `full` profiles (skipped for `minimal`).  
**Version:** 0.3.1 (Soft Deprecation)  
**Purpose:** Session boundaries, context management, progress tracking.

### ❌ REMOVAL NOTICE (v0.4.0 - COMPLETED)

**Three extensions have been removed (deprecated in v0.3.1):**

| Extension | Status | Timeline | Notes |
|-----------|--------|----------|-------|
| **Handoff** | ❌ Removed | Deprecated v0.3.1 → Removed v0.4.0 | Now part of Context Intel. Use `/handoff [goal]` (same). |
| **Auto Compact** | ❌ Removed | Deprecated v0.3.1 → Removed v0.4.0 | Now part of Context Intel. Auto-triggers on threshold. |
| **Session Recap** | ❌ Removed | Deprecated v0.3.1 → Removed v0.4.0 | Now part of Context Intel. Use `/recap` (same). |

**Impact:** No functional changes for users. All features preserved in Context Intel.
Removed modules (-490 LOC) → Total redundancy eliminated (-536 LOC).

**Timeline:**
- v0.3.0: Merged but not loaded
- v0.3.0.1: Loading fixed
- v0.3.1: Soft deprecation (warnings, backward compatible)
- v0.4.0: Hard removal (production-grade cleanup) ✅

See [MIGRATION_GUIDE_v0.4.0.md](./MIGRATION_GUIDE_v0.4.0.md) for details.

---

### 1. **Context Intelligence** (`context-intel/`)

**What it does:**
- Core extension for intelligent context management
- Merges handoff, auto-compact, session-recap capabilities
- Auto-suggests context refresh when:
  - Conversation exceeds 50 messages
  - >5 tool calls in recent session
  - >10 files have been touched
  - Context depth approaches limit

**Sub-modules:**
- `TranscriptBuilder` — extract & format conversation transcripts
  - `extractFilePaths(messages)` → array of touched files
  - `countToolCalls(messages, type)` → count specific tool calls
  - `formatTranscript(messages)` → markdown summary
  
- `PromptBuilder` — construct prompts for different scenarios
  - `buildHandoffPrompt(recap)` → context summary for new session
  - `buildRecapPrompt(messages)` → one-line session summary
  - `buildCompactionPrompt(messages)` → compress old messages
  - `buildTaskExtractionPrompt(messages)` → extract active tasks

**Lifecycle Hooks:**
- `onSessionStart()` — reset message counter, welcome message
- `onTurnEnd()` → increment message count
- `onAgentEnd()` → analyze activity, fire telemetry triggers

**Telemetry Triggers (9 total):**
1. Context depth warning (≥50 messages)
2. High activity detection (>5 tool calls)
3. File involvement detection (>10 files)
4. Plan creation
5. Parallel task detection
6. File indexing
7. Task normalization
8. Web search
9. Code quality pipeline

**Key Methods:**
- `createHandoff(context)` → transfer to new session
- `createRecap()` → session summary
- `compactOldMessages(messages)` → compress history
- `extractActiveTasks(messages)` → identify pending work

**Command Integration:**
- `/handoff [prompt]` → generate context summary + create new session
- `/recap` → show one-line summary or full recap
- `/compact` → compress conversation history (auto or manual)

**Example Flow:**
```
User: "Let's refactor the auth module"
[20 messages later, 3 files edited, 6 tool calls]
Extension → "High activity detected. Consider `/recap` to checkpoint progress"
User: /recap
Extension → "Session: Refactored authentication module — completed login/logout, pending tests"
```

---

### 2. **Git Checkpoint** (`git-checkpoint/`)

**What it does:**
- Auto-saves working tree as git refs at session boundaries
- Enables recovery via `git reflog` if session goes wrong
- Records checkpoint before/after major operations
- Integrates with handoff for safe session transfers

**Key Methods:**
- `saveCheckpoint(sessionId)` → create git ref `pi-checkpoint/{sessionId}/{timestamp}`
- `listCheckpoints()` → show all saved checkpoints
- `restoreCheckpoint(ref)` → checkout saved state

**Events:**
- `session_start` → save baseline checkpoint
- `session_shutdown` → save final state
- `handoff` → checkpoint before context transfer

**Example:**
```bash
$ git reflog
abc123 pi-checkpoint/auth-refactor/2025-05-03T10:30:00
def456 pi-checkpoint/auth-refactor/2025-05-03T09:15:00
ghi789 HEAD: ...
```

---

### 3. **Auto Compact** (`auto-compact/`) ⚠️ DEPRECATED (v0.3.1)

⚠️ **DEPRECATION NOTICE:** This extension has been merged into **Context Intel** (v0.3.0).
It will be removed in v0.4.0. No migration needed — all features work identically through Context Intel.

**Historical note (functionality preserved in Context Intel):**
- Monitors context usage in real-time
- Automatically triggers message compaction when usage exceeds threshold
- Per-model configurable thresholds (GPT-4 vs Claude vs local models)
- Preserves important messages while compressing verbose ones

**Thresholds (configurable):**
- GPT-4: 75% usage → compact
- Claude 3 Opus: 80% usage → compact
- Local models: 60% usage → compact (conservative)

**Key Methods:**
- `shouldCompact(contextUsage)` → check if compaction needed
- `compactMessages(messages)` → intelligently compress
- `preserveImportant(messages)` → keep critical context

**Preservation Rules:**
- Keep user instructions and goals
- Keep tool results (read/bash output)
- Keep error messages and fixes
- Compress verbose explanations, summaries

**Events:**
- `context_usage_update` → check compaction threshold
- `auto_compact_triggered` → run compaction
- Fire telemetry badge: "compaction-triggered"

---

### 4. **Context Pruning** (`context-pruning/`)

**What it does:**
- Removes duplicate messages and obsolete context
- Deletes messages that have been superseded (e.g., old error + new fix)
- Removes resolved issues (found bug → fixed → delete error message)
- Runs after each message to keep context fresh

**Pruning Rules:**
| Type | Action | Reason |
|------|--------|--------|
| Duplicate messages | Delete | Save context budget |
| Old error message (after fix) | Delete | Issue resolved |
| Superseded plan | Delete | New plan created |
| Verbose explanations (>100 tokens) | Delete | Info already used |
| Tool result (>1000 tokens, old) | Compress | Keep reference, lose detail |

**Key Methods:**
- `findDuplicates(messages)` → identify identical messages
- `findSuperseded(messages)` → find old versions of fixed issues
- `pruneMessages(messages)` → apply all pruning rules
- `compressVerbose(message)` → reduce token usage while keeping meaning

**Events:**
- `message_added` → check for pruning opportunities
- `turn_end` → run full pruning pass
- Fires telemetry: "pruning-stats" (removed X messages, saved Y tokens)

**Example:**
```
Before:
[1] User: "Fix the login bug"
[2] Assistant: "I found the issue: password hash mismatch at line 42"
[3] User: "How to fix it?"
[4] Assistant: "Update the hash function to use bcrypt instead of MD5"
[5] Tool result: "✓ Fixed login.ts"

After:
[4] Assistant: "Update the hash function to use bcrypt instead of MD5"
[5] Tool result: "✓ Fixed login.ts"
(Messages 1-3 pruned as resolved)
```

---

### 5. **Session Recap** (`session-recap/`) ⚠️ DEPRECATED (v0.3.1)

⚠️ **DEPRECATION NOTICE:** This extension has been merged into **Context Intel** (v0.3.0).
It will be removed in v0.4.0. No migration needed — all features work identically through Context Intel.

**Historical note (functionality preserved in Context Intel):**
- Generates one-line summary of session progress
- Auto-displays when terminal regains focus
- Accessible via `/recap` for manual trigger
- Helps context-switch when returning after break

**Key Methods:**
- `buildRecap(messages)` → create summary
- `displayOnFocus()` → show when switching back
- `renderFullRecap()` → detailed report with stats

**Output Examples:**
```
Session: Refactored authentication module (2h)
  • Completed: login, logout, password reset
  • In progress: 2FA integration
  • Pending: unit tests

Key files: auth.ts, session.ts, token-manager.ts
Latest result: ✓ POST /auth/refresh returns new token
```

---

### 6. **Usage Extension** (`usage-extension/`)

**What it does:**
- Tracks token usage and cost per session
- Provides `/usage` command for token/cost dashboard
- Shows cost breakdown by model, tool, operation
- Integrates with telemetry for usage analytics

**Key Methods:**
- `trackTokens(input, output, model)` → record usage
- `getUsageStats()` → return dashboard data
- `calculateCost(tokens, model)` → estimate spending

**Dashboard Output:**
```
╔════════════════════════════════════════╗
║         Session Usage Report            ║
╠════════════════════════════════════════╣
║ Total tokens: 145K (in: 42K, out: 103K) ║
║ Model: claude-3-opus                    ║
║ Cost: $0.87 (in) + $0.31 (out) = $1.18 ║
║ Time: 45 minutes                        ║
║ Tools: bash (12), read (8), write (3)   ║
╚════════════════════════════════════════╝
```

**Cost Models (configurable):**
- Claude Opus: $15/M in, $75/M out
- Claude Sonnet: $3/M in, $15/M out
- GPT-4: $30/M in, $60/M out

---

### 7. **Welcome Overlay** (`welcome-overlay/`)

**What it does:**
- Displays welcome message on session start
- Shows quick-start hints and available commands
- Profile-specific tips (e.g., "full" profile shows subagent hints)
- Dismissible, can be re-shown with `/help`

**Content Examples:**
```
👋 Welcome to π-me! (v0.3.0 — SOLID refactored)

Quick Start:
  /handoff [prompt]  — Transfer context to new session
  /recap            — Session summary
  /todo [task]      — Track work items
  /plan             — Manage execution plan
  /usage            — Token usage dashboard

Full profile loaded:
  /subagent        — Dispatch subagent
  /search          — Web search
  /code-review     — Analyze codebase

Type /help for full command reference.
```

---

### 8. **Session Naming** (`session-name.ts`)

**What it does:**
- Auto-generates session names from first user message
- Extracts meaningful title from initial prompt
- Falls back to timestamp if no clear title
- Integrates with git checkpoint naming

**Algorithm:**
1. Extract first 10 words from user's first message
2. Remove common words ("I", "the", "want to", "please")
3. Keep max 3 significant words
4. Create title like "auth-refactor" or "bug-fix-login"

**Examples:**
```
User: "Let's refactor the authentication module"
→ Session: auth-refactor

User: "I need to fix the login bug"
→ Session: login-bug-fix

User: "Setup TypeScript configuration for the project"
→ Session: typescript-setup
```

**Integration:** Used by git-checkpoint, usage-extension, welcome-overlay

---

### 9. **Skill Args** (`skill-args.ts`)

**What it does:**
- Enables parameterized skills with `$1`, `$2`, `$ARGUMENTS` substitution
- Parses slash command arguments
- Substitutes placeholders in skill bodies before execution
- Supports multiple argument styles

**Syntax:**
```
/my-skill arg1 arg2 arg3

Within skill body:
  $1 → arg1
  $2 → arg2
  $3 → arg3
  $ARGUMENTS → "arg1 arg2 arg3" (space-separated)
```

**Example Skill:**
```bash
# Skill: refactor-fn (in .pi/skills/refactor-fn)
Refactor the $1 function to use $2 pattern

pi-bash:
  grep -n "function $1" src/*.ts
  # Show matches for refactoring
```

**Usage:**
```
User: /refactor-fn login async-await
→ "Refactor the login function to use async-await pattern"
→ grep finds login function
```

**Key Methods:**
- `parseCommandArgs(input)` → split into args
- `substituteArgs(skillBody, args)` → replace placeholders
- `handleInput(userInput)` → entry point for skill args processor

---

## 🛠️ Core Tools (dev / full profiles)

**Profile:** `dev` loads subset A; `full` loads both A + B.  
**Version:** 0.3.0  
**Purpose:** Agent capabilities, task orchestration, code quality, developer workflows.

### Subset A — dev + full (10 extensions)

---

### 1. **Task Orchestration** (`task-orchestration/`)

**What it does:**
- Orchestrates multi-step tasks with dependencies
- Executes tasks sequentially or in parallel
- Captures task state (pending, running, done, failed)
- Integrates with progress widget for visual feedback

**Key Concepts:**
- **Task** — atomic work unit with inputs/outputs
- **Dependency** — task A blocks task B until complete
- **Executor** — runs tasks respecting dependencies
- **Renderer** — displays progress UI

**Key Methods:**
- `createTask(name, handler)` → define new task
- `addDependency(taskA, taskB)` → task B waits for A
- `execute(tasks)` → run with dependency ordering
- `getStatus(taskId)` → check current state

**Architecture:**
```
Graph Analysis
    ↓
Topological Sort (respects dependencies)
    ↓
Parallel Execution (independent tasks run together)
    ↓
State Machine (pending → running → done/failed)
    ↓
Progress Widget (visual feedback)
```

**Example:**
```typescript
const tasks = [
  { id: "read", handler: () => readFile("app.ts") },
  { id: "format", handler: () => format(), deps: ["read"] },
  { id: "lint", handler: () => lint(), deps: ["read"] },
  { id: "fix", handler: () => fix(), deps: ["format", "lint"] }
];

// Execution: read → (format + lint in parallel) → fix
```

**Events:**
- `task_created` → telemetry tracking
- `task_done` → record completion
- `task_failed` → error handling + retry

---

### 2. **Planning** (`core-tools/planning/`)

**What it does:**
- Unified planning with DAG (Directed Acyclic Graph) support
- Topological sort for dependency resolution
- Parallel/sequential execution strategies
- Auto-detects independent tasks for parallelization

**Sub-modules:**
- `PlanDAG` — graph-based plan representation
  - `addStep(step)` → add plan step
  - `topologicalSort()` → order respecting dependencies
  - `getUnblocked()` → find ready-to-execute steps
  - `getDependencies(stepId)` → find blocker steps
  - `detectCycles()` → prevent infinite loops

- `StepExecutor` — execute plan respecting dependencies
  - `executeParallel(steps)` → run independent steps together
  - `executeSequential(steps)` → strict order
  - `executeWithRetry(step, maxRetries)` → error resilience

- `PlanningExtension` (extends `ExtensionLifecycle`)
  - `createPlan(title, description)` → new plan
  - `addStep(plan, step)` → add task to plan
  - `executePlan(plan)` → run all steps
  - `/plan` slash command interface

**Example Plan:**
```
Plan: "Refactor auth module"

Steps:
  1. Read current auth.ts (no deps)
  2. Analyze dependencies (deps: 1)
  3. Create backup (deps: 1)
  4. Refactor code (deps: 2, 3)    ← parallel with 3
  5. Run tests (deps: 4)
  6. Update docs (deps: 4)         ← parallel with 5
  7. Commit changes (deps: 5, 6)

Execution order:
  1 → (2, 3 in parallel) → 4 → (5, 6 in parallel) → 7
```

**Telemetry Trigger:**
- Fires `planCreated` badge when plan created
- Fires `parallelTasksDetected` when ≥3 independent steps found

---

### 3. **Code Quality Pipeline** (`core-tools/code-quality/`)

**What it does:**
- Unified pipeline for code formatting, fixing, analyzing
- Extensible via `RunnerRegistry` (Open/Closed principle)
- Automatic runner discovery and execution
- 3-stage pipeline: format → fix → analyze

**Sub-modules:**
- `RunnerRegistry` — plugin system for runners
  - `register(runner)` → add new formatter/fixer/analyzer
  - `getRunners(type)` → find runners by stage
  - `execute(file, config)` → run all applicable runners

- `CodeRunner` interface — implement to add runners
  ```typescript
  interface CodeRunner {
    id: string;              // "biome", "eslint", "ruff"
    type: "format" | "fix" | "analyze";
    priority: number;        // execution order
    matches(filepath): boolean;
    async run(filepath, config): Promise<RunnerResult>;
  }
  ```

- `CodeQualityPipeline` — orchestrate 3-stage execution
  - `formatFile(path)` → stage 1: formatting
  - `fixFile(path)` → stage 2: auto-fixes
  - `analyzeFile(path)` → stage 3: static analysis
  - `processFile(path)` → run full pipeline

- `CodeQualityExtension` (extends `ExtensionLifecycle`)
  - Integrates with formatter, autofix, code-actions
  - Fires telemetry on each stage completion

**Built-in Runners:**
- **Formatters:** Biome, Prettier, Ruff (Python), shfmt (shell)
- **Fixers:** ESLint --fix, Ruff --fix, Biome --fix
- **Analyzers:** ESLint, Biome lint, Ruff check, TSC

**Example Pipeline Run:**
```
Input: src/app.ts (poorly formatted, has issues)
    ↓
Stage 1 — Format:
  • Biome format
  • Output: properly indented, consistent spacing
    ↓
Stage 2 — Fix:
  • ESLint --fix (removes unused vars, fixes imports)
  • Biome --fix (enforces rules)
  • Output: auto-fixed issues resolved
    ↓
Stage 3 — Analyze:
  • TSC type check
  • ESLint full scan
  • Report: 0 errors, 2 warnings
```

**Extensibility Example:**
```typescript
// User can register custom runner
class CustomRustFormatter implements CodeRunner {
  id = "rust-fmt";
  type = "format";
  matches(path) { return path.endsWith(".rs"); }
  async run(path, config) { /* ... */ }
}

registry.register(new CustomRustFormatter());
// Now pipeline automatically runs rust-fmt on .rs files
```

**Telemetry Triggers:**
- `qualityCheckRan` — fires for each stage completion
- Tracks duration, file size, issues found

---

### 4. **File Intelligence** (`core-tools/file-intelligence/`)

**What it does:**
- Indexes files for quick structure lookups
- Extracts imports, exports, classes, functions, types
- Language-specific parsing (TS, JS, Python, Go, Rust)
- Persistent storage for codebase analysis

**Sub-modules:**
- `FileStore` — persistence layer for indexes
  - `save(index)` → persist file metadata
  - `load(path)` → retrieve cached index
  - `search(query)` → find files by pattern
  - Storage: JSON files in `.pi/file-intelligence/`

- `FileCapturer` — extract structure from code
  - `capture(filePath, content)` → analyze file
  - Returns: imports, exports, classes, functions, types
  - Regex-based (extensible to AST)

- `FileIntelligenceExtension` (extends `ExtensionLifecycle`)
  - `indexFile(path, content)` → add to index
  - `findImportsOf(symbol)` → find references
  - `getClassMembers(className)` → list methods
  - Auto-triggers on file write/edit events

**Captured Data:**
```typescript
interface FileIndex {
  path: string;
  language: "ts" | "js" | "py" | "go" | "rs";
  lines: number;
  imports: string[];      // ["express", "lodash", "./utils"]
  exports: string[];      // ["App", "Config", "startServer"]
  classes: ClassInfo[];   // [{name, methods, fields}]
  functions: FunctionInfo[]; // [{name, params, returns}]
  types: TypeInfo[];      // [{name, fields}]
  lastIndexedAt: ISO8601;
}
```

**Example:**
```typescript
// Input: src/app.ts
import express from "express";
import { logger } from "./utils";

export class App {
  private server: express.Application;
  constructor() { /* ... */ }
  start() { /* ... */ }
}

export async function main() { /* ... */ }

// Captured:
{
  imports: ["express", "./utils"],
  exports: ["App", "main"],
  classes: [{ name: "App", methods: ["start"], fields: ["server"] }],
  functions: [{ name: "main" }]
}
```

**Telemetry Trigger:**
- `fileIndexed` — fires when file added to index
- Tracks file path, language, line count

---

### 5. **Subprocess Orchestration** (`core-tools/subprocess-orchestrator/`)

**What it does:**
- Bridges planning system with subprocess execution
- Normalizes plan steps to subprocess tasks
- Executes plans with parallel and sequential strategies
- Handles critical task failures and retries

**Sub-modules:**
- `TaskNormalizer` — convert PlanStep → SubprocessTask
  - `normalize(planStep)` → adapt types
  - `normalizeMany(planSteps)` → batch conversion
  - Preserves dependencies and critical flags

- `SubprocessExecutor` — execute tasks with error handling
  - `runTask(task)` → execute single task
  - `runParallel(tasks)` → parallel execution
  - `runSequential(tasks)` → strict order
  - `runWithRetry(task, maxRetries)` → resilience

- `SubprocessOrchestrationExtension` (extends `ExtensionLifecycle`)
  - `runPlan(planSteps)` → orchestrate execution
  - Integrates with planning extension
  - Fires telemetry on task normalization

**Critical Task Handling:**
```typescript
// If a task is marked critical: true
// And it fails, entire batch fails (stops processing)
// Non-critical tasks continue even if one fails

plan.steps = [
  { name: "read-config", critical: true },   // Must succeed
  { name: "backup", critical: false },       // Can fail
  { name: "deploy", critical: true },        // Depends on read-config
];
```

**Telemetry Trigger:**
- `tasksNormalized` — fires when plan steps converted
- Tracks step count, critical task count

**Example Execution:**
```
Plan step: "Format all TypeScript files"
    ↓
Normalized task: {
  id: "format-ts",
  command: "biome format src/**/*.ts",
  critical: false,
  retries: 2
}
    ↓
Execution:
  Run 1: timeout → retry
  Run 2: success
  Track: "Task completed after 1 retry"
```

---

### 6. **Memory** (`core-tools/memory/`)

**What it does:**
- Persistent memory system for session-independent facts
- SQLite-backed storage (key-value facts, lessons, events)
- Recall facts across sessions
- Audit log for decision tracking

**Key Methods:**
- `remember(key, value)` → store fact
- `recall(key)` → retrieve fact
- `addLesson(topic, lesson)` → store learned fact
- `getLesson(topic)` → retrieve lesson
- `auditLog()` → show decision history

**Storage Model:**
```sql
-- Facts table
CREATE TABLE facts (
  key TEXT PRIMARY KEY,
  value TEXT,
  createdAt TIMESTAMP,
  source TEXT
);

-- Lessons table
CREATE TABLE lessons (
  id INTEGER PRIMARY KEY,
  topic TEXT,
  content TEXT,
  context TEXT,
  createdAt TIMESTAMP
);

-- Audit log
CREATE TABLE audit (
  id INTEGER PRIMARY KEY,
  event TEXT,
  details JSON,
  timestamp TIMESTAMP
);
```

**Example Usage:**
```
Agent: "The API token is stored in .env as GITHUB_TOKEN"
→ remember("github-token-location", ".env:GITHUB_TOKEN")

Next session:
Agent: "Where do I get the API token?"
→ recall("github-token-location")
→ "The API token is stored in .env as GITHUB_TOKEN"
```

---

### 7. **Formatter** (`core-tools/formatter/`)

**What it does:**
- Auto-formats files on write/edit operations
- Supports multiple formatters: Biome, Prettier, Ruff, shfmt
- Configurable per-language formatting rules
- Integrates with code-quality pipeline

**Supported Languages:**
| Language | Formatters | Config |
|----------|-----------|--------|
| TypeScript/JS | Biome, Prettier | .prettierrc |
| Python | Ruff, Black | pyproject.toml |
| Shell | shfmt | n/a |
| JSON | Biome, Prettier | n/a |

**Key Methods:**
- `formatFile(path)` → auto-format file
- `selectFormatter(path)` → pick best formatter
- `applyFormatting(path, config)` → execute formatter

**Trigger:** Runs automatically after write/edit operations  
**Configuration:** Project-specific rules in config files

---

### 8. **Thinking Steps** (`core-tools/thinking-steps/`)

**What it does:**
- Structures agent reasoning before tool execution
- Enforces plan → research → implement → review cycle
- Improves decision quality and auditability
- Integrates with planning extension

**Phases:**
1. **Plan** — outline approach
2. **Research** — gather information
3. **Implement** — execute solution
4. **Review** — validate result

**Example Workflow:**
```
User: "Add error handling to the API"

Agent (Thinking Steps):
  PLAN: Review current error handling, identify gaps, design new approach
  RESEARCH: Check what errors API can throw, review best practices
  IMPLEMENT: Add try-catch, error codes, logging
  REVIEW: Test error scenarios, validate logging

[Then executes with telemetry on each phase]
```

---

### 9. **Clipboard** (`core-tools/clipboard.ts`)

**What it does:**
- Copy text to clipboard via OSC52 escape sequences
- Works in remote terminals (SSH, containers)
- Fallback to `pbcopy` (macOS), `xclip` (Linux)
- Integration point: `/copy` command

**Key Methods:**
- `copyToClipboard(text)` → send to system clipboard
- `useOSC52(text)` → terminal escape sequence
- `usePbcopy(text)` → macOS native
- `useXclip(text)` → Linux native

**Example:**
```
Tool output: [very long code snippet]
Agent: "I've copied the solution to your clipboard"
→ OSC52 sends content to clipboard
User can now paste with Cmd+V
```

---

### 10. **Read-Before-Edit Guard** (`core-tools/read-guard/`)

**What it does:**
- Prevents blind edits to files not yet read
- Tracks which files have been read in current session
- Blocks edit/write if file not in read-set
- Configurable override for force-edits

**Key Methods:**
- `trackRead(path)` → record file read
- `canEdit(path)` → check if file previously read
- `permitEdit(path)` → override guard (risky)

**Behavior:**
```
User: "Fix the bug in auth.ts"
Agent: [tries to write auth.ts without reading first]
Guard: ❌ "Cannot edit auth.ts — file not read yet"
Agent: [reads auth.ts first]
Guard: ✓ "auth.ts is readable, edit permitted"
```

**Rationale:** Prevents accidental blindedits that clobber code

---

### Subset B — full profile only (6 extensions)

---

### 11. **Subagent** (`core-tools/subagent/`)

**What it does:**
- Full subagent engine with dispatch modes
- Single execution, chain (sequential), parallel (concurrent)
- Async job tracking and status
- Team tool support (multiple agents working together)
- Slash command interface (`/subagent`)

**Dispatch Modes:**
1. **Single** — spawn one subagent, wait for result
2. **Chain** — agents work sequentially, each sees prior results
3. **Parallel** — agents work independently, aggregate results
4. **Async** — fire-and-forget subagent job

**Key Methods:**
- `dispatch(task, mode)` → spawn subagent
- `awaitResult(jobId)` → wait for async job
- `aggregateResults(results)` → combine multiple results
- `trackJob(jobId)` → status monitoring

**Example Chain:**
```
Task: "Analyze repository and create refactoring plan"

Subagent 1: Scan codebase structure
  → Output: "Found 150 TS files, 50K LOC, 8 modules"

Subagent 2: Analyze code quality (uses Subagent 1 output)
  → Output: "Complexity: 12 files high, duplication: 15%"

Subagent 3: Create refactoring plan (uses 1+2 output)
  → Output: "Prioritize these 5 files for refactoring"
```

---

### 12. **Ralph Loop** (`core-tools/ralph-loop/`)

**What it does:**
- Subagent loop executor with condition polling
- Pause/resume execution
- Steering controls (next iteration, abort, force-continue)
- Progress tracking and telemetry

**Key Methods:**
- `startLoop(condition, handler)` → loop until condition false
- `pause()` → pause loop
- `resume()` → continue execution
- `nextIteration()` → force next step
- `abort()` → stop loop
- `status()` → check loop state

**Example Loop:**
```
Task: "Keep refactoring until code quality A+ achieved"

Ralph Loop:
  Iteration 1: Score C → refactor
  Iteration 2: Score B → refactor
  Iteration 3: Score A → refactor (more improvements)
  Iteration 4: Score A+ → ✓ DONE

Can pause/resume or force-skip iterations via commands
```

---

### 13. **Sub-Pi** (`core-tools/sub-pi/`)

**What it does:**
- Spawn subprocess π agent
- Pass context and tasks to subprocess
- Collect results and metrics
- Integration with subagent (uses subagent dispatch)

**Key Methods:**
- `spawnSubPi(config)` → start subprocess agent
- `sendContext(context)` → pass conversation
- `submitTask(task)` → assign work
- `collectResults()` → gather outputs

**Modes:**
- **Single** — one subprocess, wait for completion
- **Chain** — subprocess chain (A → B → C)
- **Parallel** — multiple subprocesses, aggregate

**Example:**
```
Main agent: "I need parallel code reviews on 3 files"

Sub-Pi (1): Review auth.ts
Sub-Pi (2): Review payment.ts
Sub-Pi (3): Review api.ts

[All run in parallel]
→ Aggregate results
→ Return consolidated review
```

---

### 14. **Web Search** (`core-tools/web-search.ts`)

**What it does:**
- Search the web using Exa, Tavily, or Valiyu APIs
- Configurable backend based on API key
- Returns ranked results with snippets
- Integrates with context-intel for automation

**Supported Backends:**
- **Exa** (default if `EXA_API_KEY` set)
- **Tavily** (if `TAVILY_API_KEY` set)
- **Valiyu** (if `VALIYU_API_KEY` set)

**Key Methods:**
- `search(query, limit)` → search web
- `selectBackend()` → auto-pick based on API key
- `parseResults(rawResults)` → format for agent

**Example:**
```
User: "Search for TypeScript compiler options"
Agent: search("TypeScript compiler options")
→ Exa returns:
  [1] Official TypeScript Handbook - compilerOptions
  [2] TSConfig Reference - detailed options guide
  [3] TS Handbook - tsconfig.json patterns

Telemetry trigger: webSearched("TypeScript compiler options")
```

---

### 15. **File Collector** (`core-tools/file-collector/`)

**What it does:**
- Collects files matching patterns
- Integrates with file-intelligence for codebase analysis
- Supports glob patterns, file types, size filters
- Used by code-review, refactoring tasks

**Key Methods:**
- `collect(patterns)` → find matching files
- `filterByType(type)` → keep only specific language
- `filterBySize(minSize, maxSize)` → size constraints
- `getContent()` → read collected files

**Example:**
```
Patterns: ["src/**/*.ts", "!src/**/*.test.ts"]
→ Collects all TS files except tests
→ Returns: [{path, content, language, lines}]
→ Used by code-review for analysis
```

---

### 16. **AST-grep Tools** (`core-tools/ast-grep-tool/`)

**What it does:**
- Registers `ast_grep_search` and `ast_grep_replace` tools
- Enables structural code search and replacement
- Integrates with code-quality pipeline for refactoring

**Key Methods:**
- `ast_grep_search(pattern, language)` → find matches
- `ast_grep_replace(pattern, replacement, language)` → replace matches

**Example Search:**
```
Pattern: "console.log($$$args)"
Language: "ts"
→ Finds all console.log calls regardless of argument count
→ Returns: line numbers, matched code
```

---

### 17. **Code Review** (`core-tools/code-review/`)

**What it does:**
- Full codebase assessment
- Complexity analysis, TODO inventory, code quality metrics
- TDI (Technical Debt Index) calculation
- Integrates with file-collector, file-intelligence

**Metrics:**
- **Complexity** — cyclomatic complexity per function
- **TODOs** — inventory of TODOs, FIXMEs, HACKs
- **Duplication** — copy-paste detection via jscpd
- **Coverage** — test coverage metrics
- **TDI** — technical debt index (0-100)

**Example Report:**
```
Code Review: π-me (session-lifecycle/)
  Complexity: 8 high-complexity functions
  TODOs: 12 unaddressed
  Duplication: 15% (3 cloned blocks)
  Tests: 89% coverage
  TDI: 32 (Good)

Recommendations:
  • Refactor 3 complex functions
  • Address 5 critical TODOs
  • Remove 2 duplicate blocks
```

**Command:** `/code-review [path]`

---

### 18. **Autofix** (`core-tools/autofix/`)

**What it does:**
- Automatic fixing via ESLint, Ruff, Biome
- Runs after code-review to apply fixes
- Integrates with code-quality pipeline
- Tracks fixed issues

**Supported Fixers:**
- **ESLint** (JS/TS) — auto-fix common issues
- **Ruff** (Python) — fix linting violations
- **Biome** (JS/TS/JSON) — format and fix

**Key Methods:**
- `autofix(path)` → apply fixes
- `listFixableIssues(path)` → preview what will be fixed

---

## 🎨 Content Tools (full profile only)

**Profile:** Loaded only for `full` profile.  
**Version:** 0.2.0  
**Purpose:** Content utilities, web access, file management.

### 1. **Web Tools** (`content-tools/web-tools/`)

**What it does:**
- Unified web search and fetch interface
- Consolidates web-search + web-fetch capabilities
- HTML sanitization (removes scripts, styles)
- Content extraction from web pages

**Sub-modules:**
- `WebSearcher` — search engine integration
  - `search(query, limit)` → search web
  - Supports Exa, Tavily, Valiyu backends

- `WebFetcher` — HTTP client with extraction
  - `fetch(url)` → get content
  - HTML sanitization, text extraction
  - Browser profile support (Chrome, Firefox, Safari)

- `WebToolsExtension` (extends `ExtensionLifecycle`)
  - Registered tools: `web_search`, `web_fetch`, `batch_web_fetch`
  - Telemetry integration

**Telemetry Trigger:**
- `webSearched` — fires on search
- `qualityCheckRan` — fires on fetch completion

---

### 2. **Web Fetch** (`content-tools/web-fetch/`)

**What it does:**
- HTTP fetcher with browser-grade TLS fingerprinting
- JavaScript rendering support (optional)
- Content extraction and text cleanup
- Multiple output formats (markdown, HTML, text, JSON)

**Key Methods:**
- `fetch(url, options)` → get content
- `extractText(html)` → convert to readable text
- `sanitize(html)` → remove scripts/styles

**Options:**
```typescript
{
  browser?: "chrome" | "firefox" | "safari";  // TLS fingerprint
  format?: "markdown" | "html" | "text";      // output format
  timeout?: 15000;                             // ms
  renderJs?: boolean;                          // execute JavaScript
}
```

---

### 3. **GitHub** (`content-tools/github.ts`)

**What it does:**
- GitHub API integration
- Search code, create issues/PRs, read files
- Requires `GITHUB_TOKEN` environment variable

**Registered Tools:**
- `github_search_code` — search repository
- `github_create_issue` — file new issue
- `github_create_pr` — create pull request
- `github_read_file` — read file from repo

**Example:**
```
Tool: github_search_code
Query: "repo:dmoreq/pi-me path:src extension"
→ Returns matching code snippets with line numbers
```

---

### 4. **Repeat** (`content-tools/repeat/`)

**What it does:**
- Replay previous bash/edit/write commands with modifications
- `/repeat [changes]` command interface
- Supports command editing and re-execution

**Example:**
```
History:
  bash: "npm test src/auth/"

User: /repeat (change src/auth/ to src/api/)
→ Executes: npm test src/api/
```

---

### 5. **File Picker** (`content-tools/file-picker/`)

**What it does:**
- TUI file selector with preview
- Quick file access and editing
- Integration with editor actions
- `/files` command

**Features:**
- Tree view of directory structure
- File preview (first 50 lines)
- Quick-open with fuzzy search
- Actions: reveal, edit, copy path

---

## 📝 Authoring Tools (dev / full)

**Profile:** Loaded for `dev` and `full` profiles.  
**Version:** 0.3.0  
**Purpose:** AI-assisted creation and documentation helpers.

### 1. **Commit Helper** (`authoring/commit-helper/`)

**What it does:**
- Generates conventional commit messages from git diffs
- `/commit` command for interactive use
- Follows Conventional Commits format
- Integrates with git workflow

**Output:**
```
feat(auth): add password reset functionality

- Add ResetToken model for time-limited tokens
- Implement POST /auth/reset endpoint
- Add email notification service integration
- Update Auth tests (98% coverage)

BREAKING CHANGE: Auth.resetPassword() signature changed
Closes #456
```

---

### 2. **Skill Bootstrap** (`authoring/skill-bootstrap/`)

**What it does:**
- Auto-generates `SKILL.md` templates
- Detects project type (TS, Python, Go, Rust)
- Creates proper skill skeleton with examples
- `/bootstrap-skill` command

**Example Output:**
```markdown
# My Skill

Detect language pattern and fix issues

pi code runner:
  language: typescript
  compile: true

pi bash:
  npm run lint -- --fix
```

---

## 🔌 Sub-Extensions (nested under umbrellas)

Some extensions have sub-extensions registered within their parent:

### `core-tools/subagent/`
- `subagent-executor` — executes subagent dispatch
- Team tool support

### `core-tools/formatter/`
- `formatter-runners` — registers formatters as runners

### `core-tools/code-actions/`
- `snippet-picker` — interactive code snippet selection

### `core-tools/sub-pi/`
- `sub-pi-config` — configuration management

### `core-tools/sub-pi-skill/`
- Skill-based subprocess dispatch

---

## 📊 Extension Organization Summary

```
┌─────────────────────────────────────────────────────────────┐
│ pi-me v0.3.0 Extension Architecture (40 total)              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ foundation/ (Always on)                                       │
│   ├─ secrets              — credential obfuscation           │
│   ├─ permission           — 5-tier command safety            │
│   ├─ safe-ops            — dangerous op rewrites            │
│   └─ context-window      — token usage monitoring           │
│                                                               │
│ session-lifecycle/ (dev, full)                               │
│   ├─ context-intel       — 📌 Merged (handoff+recap)         │
│   ├─ git-checkpoint      — working tree snapshots           │
│   ├─ auto-compact        — context compression              │
│   ├─ context-pruning     — message cleanup                  │
│   ├─ session-recap       — progress summary                 │
│   ├─ usage-extension     — token/cost tracking              │
│   ├─ welcome-overlay     — session welcome                  │
│   ├─ session-name        — auto-naming (extracted)          │
│   └─ skill-args          — $1/$2 substitution               │
│                                                               │
│ core-tools/ (dev + some full)                                │
│                                                               │
│ Subset A (dev + full):                                       │
│   ├─ task-orchestration  — multi-step task management       │
│   ├─ planning            — 📌 DAG-based plans               │
│   ├─ memory              — persistent facts DB              │
│   ├─ formatter           — auto-format on write             │
│   ├─ thinking-steps      — structured reasoning             │
│   ├─ clipboard           — OSC52 copy                       │
│   ├─ read-guard          — prevent blind edits              │
│   ├─ code-quality        — 📌 Merged pipeline               │
│   ├─ code-actions        — snippet picking                  │
│   └─ file-intelligence   — 📌 Code indexing                 │
│                                                               │
│ Subset B (full only):                                        │
│   ├─ subagent            — spawn subagent tasks             │
│   ├─ sub-pi              — subprocess π agent               │
│   ├─ sub-pi-skill        — skill-based subprocess           │
│   ├─ ralph-loop          — loop executor                    │
│   ├─ web-search          — Exa/Tavily/Valiyu               │
│   ├─ file-collector      — glob-based file collection       │
│   ├─ ast-grep-tool       — structural search/replace        │
│   ├─ code-review         — codebase assessment              │
│   ├─ autofix             — ESLint/Ruff/Biome               │
│   ├─ subprocess-orchestrator — 📌 Plan execution            │
│   └─ web-tools           — 📌 Merged (search+fetch)         │
│                                                               │
│ content-tools/ (full only)                                   │
│   ├─ web-tools           — 📌 Unified web interface         │
│   ├─ web-fetch           — HTTP fetcher (moved to web-tools)│
│   ├─ github              — GitHub API access                │
│   ├─ repeat              — command replay                   │
│   └─ file-picker         — TUI file selector                │
│                                                               │
│ authoring/ (dev, full)                                       │
│   ├─ commit-helper       — conventional commits             │
│   └─ skill-bootstrap     — SKILL.md generation              │
│                                                               │
│ 📌 = v0.3.0 refactored/merged/new extensions                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Design Patterns

### ExtensionLifecycle Base Class
All new v0.3.0 extensions extend this class:
```typescript
class MyExtension extends ExtensionLifecycle {
  async onSessionStart() { }
  async onTurnEnd() { }
  async onAgentEnd() { }
  
  notify(msg, opts) { }  // built-in telemetry
  track(event, data) { } // built-in tracking
}
```

### RunnerRegistry Pattern (Code Quality)
Extensible via interface, no code edits needed:
```typescript
interface CodeRunner {
  id: string;
  type: "format" | "fix" | "analyze";
  matches(path): boolean;
  async run(path, config): Promise<Result>;
}

registry.register(new MyRunner()); // adds to pipeline
```

### TranscriptBuilder + PromptBuilder (Reusable)
Shared across all context-management extensions:
```typescript
const messages = [/* ... */];
const transcript = TranscriptBuilder.formatTranscript(messages);
const prompt = PromptBuilder.buildHandoffPrompt(transcript);
```

---

## 📈 Statistics

| Category | Count |
|----------|-------|
| **Total Extensions** | 37 |
| **Umbrella Configs** | 4 (foundation, session-lifecycle, core-tools, content-tools, authoring) |
| **Registered Tools** | 60+ |
| **Registered Skills** | 25+ |
| **Test Suites** | 212 |
| **Passing Tests** | 598 |
| **Test Coverage** | 85%+ (maintained) |
| **v0.4.0 Cleanup** | Removed 3 deprecated (-490 LOC) |
| **Total LOC** | ~51K |
| **New in v0.3.0** | ~10.5K |

---

## 🚀 Profile Loading Strategy

**minimal:**
- foundation (always)
- No session-lifecycle, core-tools, content-tools, authoring

**dev:**
- foundation (always)
- session-lifecycle (subset A)
- core-tools (subset A)
- authoring

**full (default):**
- foundation (always)
- session-lifecycle (all)
- core-tools (A + B)
- content-tools (all)
- authoring (all)

---

## 📚 Conclusion

The π-me extension suite is a comprehensive, SOLID-architected system providing:

✅ **40 extensions** organized into 4 umbrellas  
✅ **SOLID design** with shared foundation, interfaces, and extensibility  
✅ **598 passing tests** validating all functionality  
✅ **Agent automation** via 9 telemetry triggers  
✅ **Profile-based loading** (minimal/dev/full)  
✅ **Rich tooling** for safety, planning, code quality, and content management  

All designed to support the π coding agent in delivering professional-grade, context-aware code assistance.
