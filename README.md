# pi-me

Essential extension suite for the [pi coding agent](https://github.com/mariozechner/pi-coding-agent): foundation guards, session lifecycle, developer tools, content tools, and authoring helpers.

## Prerequisites

- [pi coding agent](https://github.com/mariozechner/pi-coding-agent) installed
- Node.js ≥ 18

## Installation

```bash
npm install pi-me
```

Then register the package in your pi config (typically `~/.pi/agent/settings.json`):

```json
{
  "packages": ["pi-me"]
}
```

Pi will automatically load all extensions and skills listed in the package.

---

## Extensions

Extensions are registered automatically. Each one hooks into the pi session lifecycle.

### Foundation

| Extension | File | What it does |
|-----------|------|--------------|
| **Secrets** | `foundation/secrets/secrets.ts` | Scans tool results and context for secrets (tokens, keys, passwords) and obfuscates them. Loads from `~/.pi/agent/secrets.yml` and `.pi/secrets.yml`. |
| **Permission** | `foundation/permission/permission.ts` | Three-layer safety system: hard safety nets (always active), dangerous-command detection, and tiered permission levels (minimal → bypassed). |
| **LSP Hook** | `foundation/lsp/lsp-hook.ts` | Runs Language Server Protocol diagnostics automatically after edits. Displays inline errors/warnings. Supports 9 languages. |
| **LSP Tool** | `foundation/lsp/lsp-tool.ts` | Exposes LSP queries as a tool: `definition`, `references`, `hover`, `signature`, `symbols`, `diagnostics`, `rename`, `codeAction`. |
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
| `lsp` | When using LSP tools | LSP actions and supported languages |
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
| `PI_LSP_AUTO_DOWNLOAD_KOTLIN_LSP` | LSP | Set to `1` to auto-download Kotlin LSP |
| `PI_LSP_KOTLIN_LSP_PATH` | LSP | Explicit path to Kotlin LSP binary |

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
│   ├── lsp/             # Language Server Protocol client
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

The test suite covers: permission classification, secret obfuscation, calculator safety, ralph-loop agent loading, notebook editing, token rate tracking, git checkpoint creation/restore, and LSP diagnostics.

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

## License

MIT
