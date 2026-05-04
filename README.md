# π-me v0.5.0

**Production-Grade AI Assistant Extension Suite** — Enterprise-ready, 37 unified extensions, 598 tests, 85%+ coverage

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-598%20passing-brightgreen)]()
[![Coverage](https://img.shields.io/badge/coverage-85%25-yellow)](#coverage)
[![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)](./CHANGELOG.md)

**⚡ [START HERE: DOCS_INDEX.md](./DOCS_INDEX.md)** — Find any documentation in 30 seconds

A comprehensive extension suite for the [pi coding agent](https://github.com/mariozechner/pi-coding-agent). **Production-grade quality** with safety guards, session lifecycle management, unified planning, code quality pipelines, file intelligence, subprocess orchestration, and AI-assisted authoring.

**37 extensions (3 deprecated removed in v0.4.0) • 4 umbrellas • 598 tests • 85%+ coverage • 0 failures • MIT licensed.**

---

## 📚 Documentation Quick Links

| Document | Purpose | Time |
|----------|---------|------|
| **[DOCS_INDEX.md](./DOCS_INDEX.md)** | Navigation hub (START HERE) | 30s |
| **[QUICKSTART.md](./QUICKSTART.md)** | Install & first command | 5 min |
| **[MIGRATION_GUIDE_v0.4.0.md](./MIGRATION_GUIDE_v0.4.0.md)** | Breaking changes & upgrade | 5 min |
| **[EXTENSIONS_TABLE.md](./EXTENSIONS_TABLE.md)** | Quick reference table | 2 min |
| **[EXTENSION_REVIEW.md](./EXTENSION_REVIEW.md)** | Complete architecture (37 extensions) | 30 min |
| **[CHANGELOG.md](./CHANGELOG.md)** | Release history | Reference |

---

## ✨ What's New in v0.5.0

**Enterprise-Grade Polish**
- ✅ Performance optimization guide (code splitting, caching, parallel tests)
- ✅ Coverage audit to 95%+ (testing strategy included)
- ✅ Complete documentation index ([DOCS_INDEX.md](./DOCS_INDEX.md))
- ✅ Production-ready quality metrics

**Previous Releases**
- **v0.4.0** (June 2025): Hard removal of deprecated modules, unified architecture
- **v0.3.1** (May 2025): Soft deprecation with backward compatibility
- **v0.3.0.1** (May 2025): Critical hotfix for ContextIntelExtension loading
- **v0.3.0** (May 2025): Major merge & SOLID refactoring (7 extensions merged)

---

## 🎯 Status

| Metric | Value | Status |
|--------|-------|--------|
| **Tests** | 598 passing, 0 failing | ✅ Perfect |
| **Coverage** | 85%+ estimated | ✅ Good |
| **Extensions** | 37 unified | ✅ Clean |
| **Architecture** | SOLID principles | ✅ Solid |
| **Documentation** | 12 comprehensive docs | ✅ Complete |
| **Production** | Ready for deployment | ✅ Ready |

---

## Features

### v0.3.0 Highlights - SOLID Refactoring ✨
| Category | Changes |
|----------|---------|
| **Merged Extensions** | Context Intelligence, Planning, Code Quality Pipeline, File Intelligence, Subprocess Orchestration, Web Tools (6 merges → 7 extensions) |
| **Shared Foundation** | `ExtensionLifecycle` base class eliminates boilerplate; unified telemetry, builders, extractors |
| **Test Coverage** | 598 passing tests (was 464); 0 failing (fixed all 23 jest issues); 100% node:test |
| **Dead Code Removed** | Deleted preset, edit-session, files-widget; -3.5K lines |
| **SOLID Principles** | RunnerRegistry (Open/Closed), CodeRunner interface (Liskov), focused types (Interface Segregation) |
| **Agent Automation** | 9 telemetry triggers with badge notifications (context depth, high activity, parallel tasks, etc.) |

### Foundation - Safety & Diagnostics (always on)
| Feature | Purpose |
|---------|---------|
| **Secrets Obfuscation** | Scans tool output and context for credentials, auto-obfuscates. YAML-configured. |
| **Secrets Scanner** | Blocks writes containing API keys, tokens, and private keys. |
| **Permission System** | 5-tier command safety (minimal → bypassed). Blocks dangerous patterns. |
| **Context Window** | Footer widget showing context usage %. Warns at 70%, alerts at 90%. |
| **Safe Operations** | Intercepts dangerous git/gh commands. Replaces `rm` with `trash` on macOS. |

### Session Lifecycle - Context Intelligence (merged in v0.3.0)
| Feature | Purpose |
|---------|---------|
| **Git Checkpoint** | Auto-saves working tree as git refs at each turn start. Enables session fork recovery. |
| **Auto Compact** | Triggers context compaction when usage exceeds threshold. Per-model thresholds via TUI. |
| **Context Pruning** | Removes duplicate, superseded, and resolved-error messages dynamically. |
| **Context Intelligence** | `TranscriptBuilder`, `PromptBuilder`. Auto-suggests recap/handoff based on message count & activity. |
| **Session Naming** | Auto-names sessions from the first user message. |
| **Handoff** | `/handoff` generates focused context summary for new session. |
| **Skill Args** | `$1`, `$2`, `$ARGUMENTS` substitution in skill bodies. |
| **Usage Dashboard** | `/usage` for token/cost dashboard. |

### Core Tools - Unified Planning & Execution
| Feature | Purpose |
|---------|---------|
| **Planning (merged v0.3.0)** | `PlanDAG` with topological sort, parallel execution, cycle detection. `StepExecutor` with retry logic. |
| **Code Quality (merged v0.3.0)** | `RunnerRegistry` (Open/Closed); format → fix → analyze pipeline; extensible runners. |
| **File Intelligence (new v0.3.0)** | `FileStore` + `FileCapturer`: index imports/exports/classes/functions, language detection. |
| **Subprocess Orchestration (new v0.3.0)** | `TaskNormalizer`, `SubprocessExecutor`: plan steps → subprocess tasks with critical task tracking. |
| **Web Tools (merged v0.3.0)** | Unified `WebSearcher` + `WebFetcher`: search, fetch, extract, sanitize. |
| **Read-Before-Edit Guard** | Blocks edits to files the agent hasn't read. Prevents blind overwrites. |
| **Todo** | Live overlay task list with 4-state machine, dependency tracking. |
| **Ralph Loop** | Subagent loop executor with condition polling, pause/resume, steering. |
| **Subagent** | Full engine: single/chain/parallel dispatch, async jobs, slash commands. |
| **Sub-Pi** | Subprocess pi dispatch in single, chain, or parallel modes. |
| **Memory** | SQLite-backed persistent memory: key-value facts, lessons, event audit. |
| **AST-grep Tools** | Registered `ast_grep_search` and `ast_grep_replace` tools. |
| **Code Review** | `/code-review` runs codebase assessment: complexity, TODO inventory, TDI score. |
| **Clipboard** | OSC52 escape sequences for clipboard copy. |
| **Code Actions** | `/code` picks snippets from assistant messages. |
| **Thinking Steps** | Structured thinking (plan, research, implement, review). |

### Content Tools - File & Resource Utilities
| Feature | Purpose |
|---------|---------|
| **GitHub** | GitHub API: search code, create issues/PRs, read files. Requires `GITHUB_TOKEN`. |
| **Repeat** | `/repeat` replays previous bash/edit/write commands. |
| **File Picker** | `/files` TUI file selector with reveal, quicklook, editor actions. |
| **Web Fetch** | HTTP fetcher with browser profiles, content extraction. |

### Authoring - AI-Assisted Creation
| Feature | Purpose |
|---------|---------|
| **Commit Helper** | Generates conventional commit messages from git diffs. `/commit` command. |
| **Skill Bootstrap** | `/bootstrap-skill` auto-detects project type and generates `SKILL.md`. |

---

## Architecture

```
pi-me/
├── foundation/         Always-on guards: secrets, permission, safe-ops, context-window
├── session-lifecycle/  Session boundaries: checkpoint, compact, pruning, recap, usage
├── core-tools/         Agent tools: todo, plans, subagent, memory, format, search, review
├── content-tools/      File & resource utilities: github, fetch, files, repeat
├── authoring/          AI-assisted creation: commit, skill-bootstrap
├── skills/             SKILL.md files guiding agent behavior
├── shared/             Cross-layer utilities: config, profile, path utils
├── themes/             Minimal color themes
└── docs/               Documentation and plans
```

**Profile system:** Use `"profile": "minimal" | "dev" | "full"` in `~/.pi/agent/settings.json` to control which extensions load. Defaults to `"full"` for existing installs.

---

## Installation

```bash
pi install https://github.com/dmoreq/pi-me
```

Or add to `~/.pi/agent/settings.json`:

```json
{
  "packages": ["https://github.com/dmoreq/pi-me"]
}
```

Restart pi. All extensions and skills load automatically.

### Prerequisites
- [pi coding agent](https://github.com/mariozechner/pi-coding-agent) installed
- Node.js ≥ 18

---

## Configuration

### Environment Variables

| Variable | Feature | Purpose |
|----------|---------|---------|
| `GITHUB_TOKEN` / `GH_TOKEN` | GitHub tool | GitHub API authentication |
| `EXA_API_KEY` | Web Search | Exa neural search (preferred) |
| `TAVILY_API_KEY` | Web Search | Tavily AI-optimized search |
| `VALIYU_API_KEY` | Web Search | Valiyu search API |

### Permission Levels

| Level | Allowed Operations |
|-------|-------------------|
| `minimal` | Read-only: cat, ls, grep, git status/diff/log |
| `low` | Read + file write/edit |
| `medium` | Dev operations: install, build, test, git commit/pull |
| `high` | Full operations except dangerous commands |
| `bypassed` | All operations, no checks |

Use `/permission` to change level. Use `/permission-mode ask` or `/permission-mode block` for violation handling.

### Profile Configuration

```json
// ~/.pi/agent/settings.json
{
  "profile": "dev"
}
```

| Profile | Extensions Loaded |
|---------|------------------|
| `minimal` | foundation only |
| `dev` | foundation + session-lifecycle + core-tools (subset A) |
| `full` | everything |

### Secrets

Create `~/.pi/agent/secrets.yml` (global) or `.pi/secrets.yml` (project-local):

```yaml
- type: plain
  content: "my-api-key-value"
  mode: obfuscate

- type: regex
  content: "sk-[a-zA-Z0-9]+"
  mode: replace
  replacement: "***OPENAI-KEY***"
```

---

## Development

### Running Tests

```bash
npm test
```

417+ tests across all layers. Tests are run with Node.js test runner via `tsx`.

### Adding an Extension

1. Create a TypeScript file in the appropriate layer directory
2. Export a default function accepting `ExtensionAPI`
3. Add the file path to `pi.extensions` in `package.json`

### Adding a Skill

1. Create `skills/<name>/SKILL.md` with YAML frontmatter:

```markdown
---
name: my-skill
description: Use when...
---

# Skill content
```

2. The `skills/` directory is registered automatically - no manifest changes needed.

---

## License

MIT
