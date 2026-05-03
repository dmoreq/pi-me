# pi-me

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-417%20passing-brightgreen)]()

A comprehensive extension suite for the [pi coding agent](https://github.com/mariozechner/pi-coding-agent). Provides safety guards, session lifecycle management, developer tools, content manipulation utilities, and AI-assisted authoring helpers.

**7 extensions, 25 skills, 417+ tests. MIT licensed.**

---

## Features

### Foundation — Safety & Diagnostics (always on)
| Feature | Purpose |
|---------|---------|
| **Secrets Obfuscation** | Scans tool output and context for credentials, auto-obfuscates. YAML-configured. |
| **Secrets Scanner** | Blocks writes containing API keys, tokens, and private keys. |
| **Permission System** | 5-tier command safety (minimal → bypassed). Blocks dangerous patterns. |
| **Context Window** | Footer widget showing context usage %. Warns at 70%, alerts at 90%. |
| **Safe Operations** | Intercepts dangerous git/gh commands. Replaces `rm` with `trash` on macOS. |

### Session Lifecycle — State & Branding
| Feature | Purpose |
|---------|---------|
| **Git Checkpoint** | Auto-saves working tree as git refs at each turn start. Enables session fork recovery. |
| **Auto Compact** | Triggers context compaction when usage exceeds threshold. Per-model thresholds via TUI. |
| **Context Pruning** | Removes duplicate, superseded, and resolved-error messages dynamically. |
| **Session Naming** | Auto-names sessions from the first user message. |
| **Session Recap** | One-line session summary on terminal refocus. `/recap` for full recap. |
| **Usage Dashboard** | `/usage` for token/cost dashboard; `/cost` for spending reports. |
| **Handoff** | `/handoff <prompt>` generates a focused context summary for a new session. |
| **Skill Args** | `$1`, `$2`, `$ARGUMENTS` substitution in skill bodies for parameterized skills. |

### Core Tools — Agent Tools
| Feature | Purpose |
|---------|---------|
| **Read-Before-Edit Guard** | Blocks edits to files the agent hasn't read. Prevents blind overwrites. |
| **Auto-Fix Pipeline** | Runs Biome/ESLint/Ruff `--fix` after write/edit. |
| **Web Search** | Exa, Tavily, or Valiyu backend. Set `EXA_API_KEY`, `TAVILY_API_KEY`, or `VALIYU_API_KEY`. |
| **Todo** | Live overlay task list with 4-state machine, dependency tracking, branch replay. |
| **Ralph Loop** | Subagent loop executor with condition polling, pause/resume, steering. |
| **Plan Tracker** | Inline plan progress widget with task status management. |
| **Plan Mode** | File-based plans in `.pi/plans/` with JSON frontmatter, locking. |
| **Subagent** | Full engine: single/chain/parallel dispatch, async jobs, slash commands, team tool. |
| **Sub-Pi** | Subprocess pi dispatch in single, chain, or parallel modes. |
| **Memory** | SQLite-backed persistent memory: key-value facts, lessons, event audit. |
| **Formatter** | Auto-formats files on save/write via Biome, Prettier, Ruff, shfmt, and more. |
| **AST-grep Tools** | Registered `ast_grep_search` and `ast_grep_replace` tools for structural code search. |
| **Code Review** | `/code-review` runs full codebase assessment: complexity, TODO inventory, TDI score. |
| **Edit Session** | `/edit-turn` re-edits previous user messages via `$VISUAL` / `$EDITOR`. |
| **Clipboard** | Copies text to clipboard via OSC52 escape sequences. |
| **Preset** | Save and switch provider/model/tool presets. `/preset` to cycle. |
| **Code Actions** | `/code` picks code snippets from assistant messages. |
| **Thinking Steps** | Structured thinking (plan, research, implement, review) before tool calls. |

### Content Tools — File & Resource Utilities
| Feature | Purpose |
|---------|---------|
| **GitHub** | GitHub API: search code, create issues/PRs, read files. Requires `GITHUB_TOKEN`. |
| **Repeat** | `/repeat` replays previous bash/edit/write commands with modifications. |
| **Files Widget** | `/readfiles` TUI file browser with tree, diff viewer, commenting. |
| **File Picker** | `/files` TUI file selector with reveal, quicklook, editor actions. |
| **Web Fetch** | HTTP fetcher with browser profiles, JS rendering, content extraction. |

### Authoring — AI-Assisted Creation
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

2. The `skills/` directory is registered automatically — no manifest changes needed.

---

## Adopted Packages

pi-me incorporates work from the open-source pi ecosystem:

| Package | Author | Contributions |
|---------|--------|---------------|
| [superpowers](https://github.com/obra/superpowers) | [Jesse Vincent](https://github.com/obra) | Workflow skills, plan-tracker |
| [pi-hooks](https://github.com/prateekmedia/pi-hooks) | [Prateek](https://github.com/prateekmedia) | Permission, checkpoint, ralph-loop, repeat |
| [pi-extensions](https://github.com/tmustier/pi-extensions) | [Thomas Mustier](https://github.com/tmustier) | Session-recap, usage-extension, code-actions, files-widget |
| [richardgill/pi-extensions](https://github.com/richardgill/pi-extensions) | [Richard Gill](https://github.com/richardgill) | File-collector, preset, sub-pi, pi-config |
| [rhubarb-pi](https://github.com/qualisero/rhubarb-pi) | [Dave](https://github.com/qualisero) | Background-notify, session-emoji, compact-config |
| [shitty-extensions](https://github.com/hjanuschka/shitty-extensions) | [hjanuschka](https://github.com/hjanuschka) | Clipboard, handoff, memory-mode, plan-mode, oracle |
| [rpiv-mono](https://github.com/juicesharp/rpiv-mono) | [juicesharp](https://github.com/juicesharp) | Todo, skill args, handoff, warp-notify |
| [pi-lens](https://github.com/dmoreq/pi-lens) | [quy.doan](https://github.com/dmoreq) | Read-guard, secrets scanner, ast-grep tools, code-review, autofix, similarity |

---

## License

MIT
