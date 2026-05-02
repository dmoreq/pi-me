# pi-me

A comprehensive extension suite for the [pi coding agent](https://github.com/mariozechner/pi-coding-agent). Provides
safety guards, session lifecycle management, developer tools, content manipulation utilities, and AI-assisted
authoring helpers — all loaded automatically as a single package.

**70 extensions, 25 skills, 290 tests. MIT licensed.**

---

## Quick Start

```bash
pi install https://github.com/dmoreq/pi-me
```

Restart pi. All extensions and skills load automatically — no additional configuration required.

---

## What You Get

| Capability | Mechanism |
|-----------|-----------|
| Command safety | Permission system blocks dangerous operations; secrets are obfuscated automatically |
| Task tracking | Agent calls `todo` to manage a live overlay task list; `plan_tracker` shows progress |
| Web access | Agent uses `web_search` via Exa (EXA_API_KEY), Tavily (TAVILY_API_KEY), or Valiyu (VALIYU_API_KEY) |
| Subagent dispatch | Agent uses `ralph_loop` for iterative subagent execution with steering controls |
| Model switching | `/oracle` for second opinions; `/preset` to switch provider/model configurations |
| Skill system | 23 skills auto-load when their description matches the agent's task |
| Cost visibility | `/usage` for token/cost dashboard; `/cost` for spending reports |
| Session branding | `/emoji*` and `/color*` for visual session identifiers |
| Side questions | `/btw` for one-off questions without polluting conversation context |
| Structured input | `ask_user_question` tool for multi-question user prompts with previews |

---

## Architecture

```
pi-me/
├── foundation/          Always-on guards and diagnostics
├── session-lifecycle/   Session boundaries, state, branding
├── core-tools/          General-purpose agent tools
├── content-tools/       File and resource utilities
├── authoring/           AI-assisted content creation
├── skills/              SKILL.md files guiding agent behavior
├── shared/              Cross-layer library code (also published standalone)
├── themes/              Minimal color themes
└── docs/                Documentation
```

**Detailed reference:** [Conventions](docs/conventions.md) · [Deep Review](docs/deep-review-report.md) · [Implementation Plan](docs/implementation-plan.md) · [Adopted Plugins](docs/adopted-plugins-inline-review.md)

---

## Installation

### Via pi CLI

```bash
pi install https://github.com/dmoreq/pi-me
```

### Via settings.json

Add to `~/.pi/agent/settings.json`:

```json
{
  "packages": ["https://github.com/dmoreq/pi-me"]
}
```

Restart pi. All 77 extensions and 23 skills load automatically.

### Prerequisites

- [pi coding agent](https://github.com/mariozechner/pi-coding-agent) installed
- Node.js ≥ 18

---

## Extension Reference

### Foundation — Safety & Diagnostics

| Extension | Source | Purpose |
|-----------|--------|---------|
| Secrets | `foundation/secrets/` | Scans tool output and context for credentials, obfuscates automatically. Configured via `secrets.yml`. |
| Permission | `foundation/permission/` | Tiered command safety: minimal → bypassed. Blocks dangerous patterns, prompts for high-risk operations. |
| Context Window | `foundation/context-window/` | Footer widget showing context usage percentage. Warns at 70%, alerts at 90%. |
| Safe Operations | `foundation/safe-ops.ts` | Intercepts dangerous git/gh commands for approval. Replaces `rm` with `trash` on macOS. |
| Status Widget | `foundation/status-widget.ts` | Live provider status indicators (Anthropic, OpenAI, GitHub) in the footer. |
| Extra Context Files | `foundation/extra-context-files.ts` | Injects `AGENTS.local.md` and provider-specific guidance files into context automatically. |

### Session Lifecycle — State & Branding

| Extension | Source | Purpose |
|-----------|--------|---------|
| Git Checkpoint | `session-lifecycle/git-checkpoint/` | Auto-saves working tree as git refs at each turn start. Enables recovery on session fork. |
| Auto Compact | `session-lifecycle/auto-compact/` | Triggers context compaction when usage exceeds the configured threshold. |
| Context Pruning | `session-lifecycle/context-pruning/` | Dynamic Context Pruning — removes duplicate, superseded, and resolved-error messages. Footer widget shows prune stats. |
| Session Name | `session-lifecycle/session-name/` | Names sessions from the first user message. |
| Token Rate | `session-lifecycle/token-rate/` | Displays tokens-per-second output rate in the footer. |
| Agent Guidance | `session-lifecycle/agent-guidance/` | Injects model-specific guidance files (`CLAUDE.md`, `CODEX.md`, `GEMINI.md`) based on active provider. |
| Session Recap | `session-lifecycle/session-recap/` | Shows a one-line session summary on terminal refocus. `/recap` for full recap. |
| Tab Status | `session-lifecycle/tab-status/` | Terminal tab title with status icons (done, stuck, timed out). |
| Usage Extension | `session-lifecycle/usage-extension/` | `/usage` for token/cost dashboard; `/cost` for spending reports from session logs. |
| Notifications | `session-lifecycle/notifications.ts` | Background task completion alerts (beep, focus, speech). |
| Handoff | `session-lifecycle/handoff.ts` | `/handoff <prompt>` generates a focused context summary for a new session. |
| Session Style | `session-lifecycle/session-style.ts` | AI-picked session emoji + rotating 40-color footer band. `/emoji*` and `/color*` commands. |
| Compact Config | `session-lifecycle/auto-compact/compact-config.ts` | Per-model compaction thresholds configured via interactive TUI. |
| Preset | `core-tools/preset/` | Save and switch provider/model/tool presets. `/preset` to cycle. |
| Skill Args | `session-lifecycle/skill-args/` | `$1`, `$2`, `$ARGUMENTS` substitution in skill bodies for parameterized skills. |
| Warp Notify | `session-lifecycle/warp-notify/` | Warp terminal OSC 777 structured notifications on lifecycle events. |
| Startup Header | `session-lifecycle/startup-header.ts` | Custom welcome header with ASCII art branding on session start. |
| Model Filter | `core-tools/model-filter/` | Filters available models by provider or capability. |

### Core Tools — Agent Tools

| Extension | Source | Purpose |
|-----------|--------|---------|
| Web Search | `core-tools/web-search.ts` | Exa, Tavily, or Valiyu web search. Set `EXA_API_KEY`, `TAVILY_API_KEY`, or `VALIYU_API_KEY`. |
| Todo | `core-tools/todo/` | Live overlay task list with 4-state machine, dependency tracking, and branch replay survival. `/todos` to view. |
| Calc | `core-tools/calc.ts` | Safe arithmetic expression evaluator with Math function whitelist. |
| Ask User Question | `pi-dialog` dependency | Structured multi-question UI with side-by-side markdown previews and multi-select. Provided by [pi-dialog](https://github.com/dmoreq/pi-dialog). |
| Ralph Loop | `core-tools/ralph-loop/` | Subagent loop executor with condition polling, pause/resume, and steering. |
| Plan Tracker | `core-tools/plan-tracker/` | Inline plan progress widget. `plan_tracker` tool for task status management. |
| Plan Mode | `core-tools/plan-mode.ts` | File-based plans in `.pi/plans/` with JSON frontmatter, locking, and planning mode toggle. |
| Subagent | `core-tools/subagent/` | Full subagent engine: single/chain/parallel dispatch, agents, slash commands, async jobs. Includes `/team` tool. |
| Sub-Pi | `core-tools/sub-pi/` | Subprocess pi dispatch in single, chain, or parallel modes. Auto-detects `/skill:` references. |
| BTW | `core-tools/btw/` | `/btw <question>` asks the primary model a side question with cloned context. Answer in overlay. |
| Oracle | `core-tools/oracle.ts` | `/oracle <prompt>` gets a second opinion from another model. |
| Code Actions | `core-tools/code-actions/` | `/code` picks code snippets from assistant messages to copy, insert, or run. |
| File Collector | `core-tools/file-collector/` | Collects file paths and content from tool results based on configurable regex patterns. |
| Clipboard | `core-tools/clipboard.ts` | Copies text to clipboard via OSC52 escape sequences. |

| Memory | `core-tools/memory/` | SQLite-backed persistent memory + /mem AGENTS.md instruction saving. Key-value facts, learned lessons, event audit. |
| Formatter | `core-tools/formatter/` | Auto-formats files on save/write via Biome, Prettier, Ruff, shfmt, and more. |
| Edit Session | `core-tools/edit-session/` | `/edit-turn` re-edits previous user messages via `$VISUAL` / `$EDITOR`. |
| Stash | `core-tools/stash/` | Draft stash: `Ctrl+Shift+S` to stash editor content, `Ctrl+Shift+R` to restore. |
| Thinking Steps | `core-tools/thinking-steps/` | Adds structured thinking (plan, research, implement, review) before tool calls. |

### Content Tools — File & Resource Utilities

| Extension | Source | Purpose |
|-----------|--------|---------|
| Notebook | `content-tools/notebook.ts` | Cell-level editor for Jupyter `.ipynb` files: read, edit, insert, delete. |
| Mermaid | `content-tools/mermaid.ts` | Renders Mermaid diagrams to SVG/PNG via `mmdc` CLI. |
| GitHub | `content-tools/github.ts` | GitHub API: search code, create issues/PRs, read files. Requires `GITHUB_TOKEN`. |
| Repeat | `content-tools/repeat/` | `/repeat` replays previous bash/edit/write commands with optional modifications. |
| Files Widget | `content-tools/files-widget/` | `/readfiles` TUI file browser with directory tree, diff viewer, and commenting. |
| Raw Paste | `content-tools/raw-paste/` | `/paste` inserts editable text inline for review before sending. |
| File Picker | `content-tools/file-picker/` | `/files` TUI file selector with reveal, quicklook, and editor actions. |
| Web Fetch | `content-tools/web-fetch/` | HTTP fetcher with multiple browser profiles, JS rendering, and content extraction via linkedom/Defuddle. |
| Markdown Preview | `content-tools/markdown-preview/` | Renders markdown to HTML for browser preview. Requires puppeteer-core. |

### Authoring — AI-Assisted Creation

| Extension | Source | Purpose |
|-----------|--------|---------|
| Output Artifacts | `authoring/output-artifacts/` | Saves truncated tool outputs (>8KB) to `.pi/artifacts/` with `artifact://` retrieval URLs. |
| Commit Helper | `authoring/commit-helper/` | Generates conventional commit messages from git diffs via LLM analysis. `/commit` command. |
| Skill Bootstrap | `authoring/skill-bootstrap/` | `/bootstrap-skill` auto-detects project type and generates `SKILL.md`. |

---

## Configuration

### Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `GITHUB_TOKEN` / `GH_TOKEN` | GitHub tool | GitHub API authentication |
| `EXA_API_KEY` | Web Search | Exa neural search API (preferred) |
| `TAVILY_API_KEY` | Web Search | Tavily AI-optimized search API |
| `VALIYU_API_KEY` | Web Search | Valiyu search API |

### Permission Levels

| Level | Allowed Operations |
|-------|-------------------|
| `minimal` | Read-only: cat, ls, grep, git status/diff/log |
| `low` | Read + file write/edit |
| `medium` | Dev operations: install, build, test, git commit/pull |
| `high` | Full operations except dangerous commands |
| `bypassed` | All operations, no checks |

Use `/permission` to change the level. Use `/permission-mode ask` or `/permission-mode block` to control violation handling.

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

202 tests across all layers. Coverage: permission classification, secret obfuscation, calculator safety, ralph-loop agent loading, notebook editing, token rate tracking, git checkpoint creation/restore.

### Adding an Extension

1. Create a TypeScript file in the appropriate layer directory
2. Export a default function accepting `ExtensionAPI`
3. Add the file path to `pi.extensions` in `package.json`

### Adding a Skill

1. Create `skills/<name>/SKILL.md` with YAML frontmatter:

```markdown
---
name: my-skill
description: When to use this skill
---

# Skill content
```

2. The `skills/` directory is registered automatically — no additional manifest changes needed.

---

## Credits

pi-me incorporates work from the following open-source pi packages:

| Package | Author | Contributions |
|---------|--------|---------------|
| [superpowers](https://github.com/obra/superpowers) | [Jesse Vincent](https://github.com/obra) | Workflow skills (brainstorming, writing-plans, executing-plans, TDD, debugging, code review, git-worktrees) and plan-tracker |
| [pi-hooks](https://github.com/prateekmedia/pi-hooks) | [Prateek](https://github.com/prateekmedia) | Permission system, git-checkpoint, token-rate, ralph-loop, repeat |
| [pi-extensions](https://github.com/tmustier/pi-extensions) | [Thomas Mustier](https://github.com/tmustier) | Agent-guidance, session-recap, tab-status, usage-extension, code-actions, arcade, files-widget, raw-paste |
| [richardgill/pi-extensions](https://github.com/richardgill/pi-extensions) | [Richard Gill](https://github.com/richardgill) | Extra-context-files, file-collector, files, preset, sub-pi, pi-config |
| [rhubarb-pi](https://github.com/qualisero/rhubarb-pi) | [Dave](https://github.com/qualisero) | Background-notify, session-emoji, session-color, safe-git, safe-rm, compact-config |
| [shitty-extensions](https://github.com/hjanuschka/shitty-extensions) | [hjanuschka](https://github.com/hjanuschka) | Clipboard, cost-tracker, handoff, loop, memory-mode, oracle, plan-mode, resistance, speedreading, status-widget, ultrathink, usage-bar |
| [rpiv-mono](https://github.com/juicesharp/rpiv-mono) | [juicesharp](https://github.com/juicesharp) | Todo overlay with branch replay, `/btw` side-question, skill argument substitution, ask-user-question, Warp notifications |
| [oh-my-pi](https://github.com/can1357/oh-my-pi) | [Can](https://github.com/can1357) | Early ecosystem inspiration |
| pi-dcp (inlined as context-pruning) | [zenobi-us](https://github.com/zenobi-us) | Dynamic Context Pruning — deduplication, superseded writes, error purging, recency protection |

---

## License

MIT
