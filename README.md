# π-me v1.0.0

**Production-Grade AI Assistant Extension Suite** — unified task & plan management, 840+ tests, SOLID-refactored, telemetry-driven automation

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-840%20passing-brightgreen)]()
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](./CHANGELOG.md)

A comprehensive extension suite for the [pi coding agent](https://github.com/mariozechner/pi-coding-agent). **Production-grade quality** with safety guards, session lifecycle management, code quality pipelines, persistent memory, and telemetry-driven automation.

**18 extensions • 4 umbrellas • 840+ tests • 0 failures • MIT licensed.**

---

## Architecture Overview

```
pi-me v1.0.0 — Unified Task & Plan
====================================

foundation/              ← Always loaded
├── secrets/              Secret scanning (env vars, API keys)
└── context-monitor/       Session stats & token usage tracking (passive hooks, no slash commands)

session-lifecycle/       ← dev/full profiles
├── welcome/              Welcome header + auto session naming
└── skill-args/           $1/$2/$ARGUMENTS skill argument substitution

core-tools/              ← dev/full profiles
├── subset A (always on)
│   ├── task-plan/            Unified task & plan management (replaces task-orch + planning)
│   ├── memory/               Persistent memory + project-context scanner
│   ├── code-quality/         Auto-format (8) + auto-fix (3) pipeline
│   ├── subprocess-orchestrator/  Subprocess execution (single/chain/loop/bg/pi)
│   ├── thinking-steps/       Structured reasoning TUI (3 modes)
│   ├── file-intelligence/    File summarization & indexing
│   └── clipboard/            copy_to_clipboard tool
├── subset B (full profile only)
│   ├── file-collector/       Bash shim command tooling
│   └── code-review/          /code-review, complexity, TDI, TODO scanner

content-tools/           ← full profile only
├── web-tools/             Web fetch, search, batch fetch
├── repeat/                Repeat/replay tools
└── github.ts              GitHub API integration

authoring/               ← full profile only
└── commit-helper/         Conventional commit message generation

shared/                  ← Infrastructure
├── lifecycle.ts           ExtensionLifecycle SOLID base class
├── telemetry-automation.ts  9 automation triggers
├── telemetry-helpers.ts      Safe pi-telemetry wrappers
├── command-builder.ts        DRY command registration patterns
├── profile.ts                Profile-based extension loading
├── notify-utils.ts           Desktop notification utilities
├── pi-config.ts              Pi configuration reading
└── ...
```

---

## What's New in v1.0.0

### Unified Task & Plan Management

**Task Orchestration** and **Interactive Plan Mode** are now merged into one system (`core-tools/task-plan/`):

- **Single `task` tool** replaces both `plan` and `task_control` (15+ actions: list, get, create, update, delete, add-step, complete-step, claim, release, execute, skip, retry, review, search)
- **Unified Task type** — one model for auto-captured tasks and user-created plans
- **Safety/review mode** — auto-captured tasks require approval before execution
- **AI-powered intent detection** with regex fallback
- **DAG-based execution** with retry, timeout, dry-run
- **Persistent store** with locking, GC, search, event audit log
- **Commands**: `/tasks`, `/tasks-review`, `/task <description>`, `/plan`
- **223+ tests** — all passing

### Removed

- `core-tools/task-orchestration/` — merged into task-plan
- `core-tools/planning/` — removed after migration into task-plan
- `core-tools/intent/` — shared infrastructure retained
- `plan` tool and `task_control` tool — replaced by unified `task` tool

---

## Quick Start

```bash
npm install pi-me
```

Add to your pi configuration:

```json
{
  "pi": {
    "extensions": ["pi-me"]
  }
}
```

---

## Key Commands

| Command | Extension | Description |
|---------|-----------|-------------|

| `/welcome-toggle` | welcome | Toggle welcome header |
| `/welcome-builtin` | welcome | Restore built-in header |
| `/memory-consolidate` | memory | Manually trigger consolidation |
| `/mem` | memory | Memory slash commands |
| `/remember` | memory | Manual memory add |
| `/tasks` | task-plan | List all tasks grouped by status |
| `/tasks-review` | task-plan | List tasks awaiting review |
| `/task <desc>` | task-plan | Quick task creation |
| `/code-review` | code-review | Full codebase health assessment |
| `/thinking-steps` | thinking-steps | Set thinking display mode |

---

## Extension Profiles

| Profile | Loads |
|---------|-------|
| **minimal** | Nothing from pi-me |
| **dev** | `foundation/` + `session-lifecycle/` + `core-tools` subset A |
| **full** | Everything above + `core-tools` subset B + `content-tools/` + `authoring/` |

---

## Test Suite

```bash
npm test    # 840+ tests, all passing
```

## License

MIT
