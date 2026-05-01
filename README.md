# pi-me

Essential extension suite for the [pi coding agent](https://github.com/mariozechner/pi-coding-agent): foundation guards, session lifecycle, developer tools, content tools, and authoring helpers.

> Inspired by [pi-extensions](https://github.com/richardgill/pi-extensions) and [rhubarb-pi](https://github.com/qualisero/rhubarb-pi).

## Quick Start

```bash
# 1. Install
pi install https://github.com/dmoreq/pi-me

# 2. Restart pi
#    All 51 extensions and 22 skills load automatically.
#    No further setup needed — everything just works.
```

**What you get out of the box:**

| You want to... | How it works |
|----------------|-------------|
| Stay safe | 🔄 Permission guards block dangerous commands, secrets get obfuscated automatically |
| Track progress | 🤖 Agent calls `plan_tracker()` to show task progress — you see a widget in the footer |
| Search the web | 🤖 Agent uses `web_search()` — set `BRAVE_API_KEY` or `SERPAPI_API_KEY` |
| Run a dev loop | 🤖 Agent uses `ralph_loop()` to dispatch subagents, or type `/loop` for simple iteration |
| Switch models | Type `/oracle` for a second opinion, or `/preset` to switch provider/model presets |
| Get work done | Load a skill — pi detects your intent from the `description` field in each SKILL.md |
| See what's new | Type `/usage` for cost dashboard, `/recap` for session recap, `/color` to tint your session |
| Have fun | Type `/speedread` for RSVP reading, or play `spice-invaders` while tests run |

**Detailed docs:** [Features](docs/intro.md) · [Skills](docs/skills.md)

---

## Prerequisites

- [pi coding agent](https://github.com/mariozechner/pi-coding-agent) installed
- Node.js ≥ 18

## Installation

```bash
pi install https://github.com/dmoreq/pi-me
```

Or add the source to `~/.pi/agent/settings.json`:

```json
{
  "packages": ["https://github.com/dmoreq/pi-me"]
}
```

Restart pi — all 51 extensions and 22 skills load automatically.

---

## Extensions

Extensions are registered automatically. Each one hooks into the pi session lifecycle.

### Foundation

| Extension | File | What it does |
|-----------|------|--------------|
| **Secrets** | `foundation/secrets/secrets.ts` | Scans tool results and context for secrets (tokens, keys, passwords) and obfuscates them. Loads from `~/.pi/agent/secrets.yml` and `.pi/secrets.yml`. |
| **Permission** | `foundation/permission/permission.ts` | Three-layer safety system: hard safety nets (always active), dangerous-command detection, and tiered permission levels (minimal → bypassed). |
| **Context Window** | `foundation/context-window/context-window.ts` | Status bar widget showing context usage %. Warns at 70%, alerts at 90%, auto-suggests `/compact`. |

### Session Lifecycle

| Extension | File | What it does |
|-----------|------|--------------|
| **Git Checkpoint** | `session-lifecycle/git-checkpoint-new/checkpoint.ts` | Auto-saves code state as git refs (`refs/pi-checkpoints/`) at the start of each turn. Offers restore on session fork/tree. |
| **Auto Compact** | `session-lifecycle/auto-compact/auto-compact.ts` | Automatically compacts context when usage exceeds 80% (configurable). |
| **Session Name** | `session-lifecycle/session-name/session-name.ts` | Names sessions from the first user message (truncated to 60 chars). |
| **Token Rate** | `session-lifecycle/token-rate/token-rate.ts` | Shows tokens-per-second output rate in the status bar. |

### Core Tools

| Extension | File | What it does |
|-----------|------|--------------|
| **Web Search** | `core-tools/web-search.ts` | Web search via Brave, SerpAPI, or Kagi backends. Set `BRAVE_API_KEY`, `SERPAPI_API_KEY`, or `KAGI_API_KEY`. |
| **Todo** | `core-tools/todo.ts` | Stateful todo list for the current session. Actions: `list`, `add`, `toggle`, `clear`. |
| **Calc** | `core-tools/calc.ts` | Safe math expression evaluator. Whitelists Math functions; blocks `eval`, `require`, etc. |
| **Ask** | `core-tools/ask.ts` | Interactive prompting: `text`, `confirm`, `choice` modes. Falls back gracefully in non-interactive mode. |
| **Ralph Loop** | `core-tools/ralph-loop/ralph-loop.ts` | Runs subagents in a loop with condition polling, pause/resume, steering, and usage tracking. |

### Content Tools

| Extension | File | What it does |
|-----------|------|--------------|
| **Notebook** | `content-tools/notebook.ts` | Cell-level editor for Jupyter `.ipynb` files: `read`, `edit`, `insert`, `delete`. |
| **Mermaid** | `content-tools/mermaid.ts` | Renders Mermaid diagrams to SVG/PNG via `mmdc` CLI. |
| **GitHub** | `content-tools/github.ts` | GitHub API client: search/create issues and PRs, read files, search code. Set `GITHUB_TOKEN` or `GH_TOKEN`. |
| **Repeat** | `content-tools/repeat/repeat.ts` | Re-runs a previous bash/edit/write command, optionally with modifications. |

### Authoring

| Extension | File | What it does |
|-----------|------|--------------|
| **Output Artifacts** | `authoring/output-artifacts/output-artifacts.ts` | Saves truncated tool outputs (>8000 chars) to `.pi/artifacts/` and provides `artifact://` URLs to retrieve the full content. |
| **Commit Helper** | `authoring/commit-helper/commit-helper.ts` | Generates conventional commit messages from staged/unstaged git diffs via LLM analysis. |
| **Skill Bootstrap** | `authoring/skill-bootstrap/skill-bootstrap.ts` | Auto-detects project type (language, framework, test runner) and generates a `SKILL.md` documentation file. |

---

## Skills

Skills are markdown files that guide the agent's behavior. They are available automatically after installation.

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `commit-helper` | When committing code | Generate conventional commit messages |
| `skill-bootstrap` | When documenting a project | Auto-generate SKILL.md |
| `secrets` | When handling credentials | Secret obfuscation rules and config |
| `output-artifacts` | When tool output is truncated | Retrieve full output via artifact:// URLs |
| `permission` | When adjusting safety levels | Permission levels and safety commands |
| `ralph-loop` | When running subagent loops | Loop controls: steer, pause, resume, stop |
| `adopt-plugin` | When adopting a new plugin | Full plugin adoption workflow |

---

## Configuration

### Environment Variables

| Variable | Extension | Purpose |
|----------|-----------|---------|
| `GITHUB_TOKEN` or `GH_TOKEN` | GitHub tool | GitHub API authentication |
| `BRAVE_API_KEY` | Web Search | Brave Search API key |
| `SERPAPI_API_KEY` | Web Search | SerpAPI key (Google backend) |
| `KAGI_API_KEY` | Web Search | Kagi Search API key |

### Permission Levels

The permission extension uses five levels:

| Level | Allowed |
|-------|---------|
| `minimal` | Read-only (cat, ls, grep, git status/diff/log) |
| `low` | Read-only + file write/edit |
| `medium` | Dev ops (install, build, test, git commit/pull) |
| `high` | Full operations except dangerous commands |
| `bypassed` | All operations (no checks) |

Use `/permission` to change the level. Use `/permission-mode ask` or `/permission-mode block` to control how violations are handled.

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

## Contributing

### Architecture

```
pi-me/
├── foundation/          # Always-on safety and diagnostics
│   ├── secrets/         # Secret detection + obfuscation
│   ├── permission/      # Command permission classification
│   └── context-window/  # Context usage display
├── session-lifecycle/   # Hooks that run at session boundaries
│   ├── git-checkpoint-new/  # Code state snapshots
│   ├── auto-compact/    # Automatic context compaction
│   ├── session-name/    # Session naming
│   └── token-rate/      # Token rate display
├── core-tools/          # General-purpose tools
│   ├── ralph-loop/      # Subagent loop executor
│   ├── web-search.ts
│   ├── todo.ts
│   ├── calc.ts
│   └── ask.ts
├── content-tools/       # File and resource tools
│   ├── notebook.ts      # Jupyter notebook editor
│   ├── mermaid.ts       # Diagram renderer
│   ├── github.ts        # GitHub API client
│   └── repeat/          # Command replay
├── authoring/           # AI-assisted authoring helpers
│   ├── output-artifacts/
│   ├── commit-helper/
│   └── skill-bootstrap/
└── skills/              # SKILL.md files for agent guidance
```

Each extension exports a default `registerX(pi: ExtensionAPI)` function. The pi runtime calls this with the extension API handle at startup.

### Extension API Primer

Extensions register with the pi runtime via event hooks:

```typescript
export default function registerMyExtension(pi: ExtensionAPI) {
  // Hook into tool results
  pi.on("tool_result", (event) => {
    // event.content, event.toolName, event.sessionId
  });

  // Hook into session end
  pi.on("agent_end", (event) => {
    // Runs after each agent turn
  });

  // Register a slash command
  pi.registerCommand("/my-command", async (args, ctx) => {
    // ctx.print(), ctx.prompt(), etc.
  });

  // Register a tool the agent can call
  pi.registerTool({
    name: "my_tool",
    description: "...",
    parameters: { /* JSON Schema */ },
    execute: async (params, ctx) => { /* return string */ },
  });
}
```

Then add the file path to the `pi.extensions` array in `package.json`.

### Running Tests

```bash
npm test
```

The test suite covers: permission classification, secret obfuscation, calculator safety, ralph-loop agent loading, notebook editing, token rate tracking, git checkpoint creation/restore.

### Adding a Skill

1. Create `skills/my-skill/SKILL.md` with YAML frontmatter:

```markdown
---
name: my-skill
description: One-line description of when to use this skill
---

# Skill content here
```

2. The `skills/` directory is already listed in `package.json` under `pi.skills` — no additional registration needed.

### Adding an Extension

1. Create your TypeScript file in the appropriate layer directory.
2. Export a default `register` function accepting `ExtensionAPI`.
3. Add the file path to the `pi.extensions` array in `package.json`.

---

## Credits

pi-me is inspired by and incorporates work from these excellent pi packages:

| Package | Author | What we adopted |
|---------|--------|-----------------|
| [superpowers](https://github.com/obra/superpowers) | [Jesse Vincent](https://github.com/obra) | Workflow skills: brainstorming, writing-plans, executing-plans, subagent-driven-development, test-driven-development, systematic-debugging, verification-before-completion, requesting-code-review, receiving-code-review, dispatching-parallel-agents, using-git-worktrees, finishing-a-development-branch, writing-skills, and plan-tracker |
| [pi-hooks](https://github.com/prateekmedia/pi-hooks) | [Prateek](https://github.com/prateekmedia) | Foundation architecture: permission system, git-checkpoint, token-rate, ralph-loop, repeat, and LSP (later removed) |
| [pi-extensions](https://github.com/tmustier/pi-extensions) | [Thomas Mustier](https://github.com/tmustier) | Session tools: agent-guidance, session-recap, tab-status, usage-extension, pi-ralph-wiggum, code-actions, arcade, files-widget, raw-paste; skills: extending-pi, skill-creator |
| [oh-my-pi](https://github.com/can1357/oh-my-pi) | [Can](https://github.com/can1357) | Early inspiration for the pi extension ecosystem |
| [richardgill/pi-extensions](https://github.com/richardgill/pi-extensions) | [Richard Gill](https://github.com/richardgill) | Config and tools: extra-context-files, file-collector, files, preset, sub-pi, sub-pi-skill, pi-config |
| [rhubarb-pi](https://github.com/qualisero/rhubarb-pi) | [Dave](https://github.com/qualisero) | Session enhancements: background-notify, session-emoji, session-color; safety: safe-git, safe-rm; compaction: compact-config |
| [shitty-extensions](https://github.com/hjanuschka/shitty-extensions) | [hjanuschka](https://github.com/hjanuschka) | Tools and widgets: clipboard, cost-tracker, flicker-corp, funny-working-message, handoff, loop, memory-mode, oracle, plan-mode, resistance, speedreading, status-widget, ultrathink, usage-bar; skill: a-nach-b |

---

## License

MIT
