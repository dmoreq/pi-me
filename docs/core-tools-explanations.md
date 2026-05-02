# core-tools/ Extension Explanations

---

## Tier 1 — Agent-Critical

The agent calls these tools autonomously during normal operation. They are the tools listed in the agent's tool definitions.

---

### 1. web-search

**File:** `core-tools/web-search.ts` (181 lines)

**What it does:** Provides the `web_search` tool that the agent uses to search the internet. Supports three backends checked via environment variables in order:

| Backend | Env var | Priority |
|---------|---------|----------|
| Exa | `EXA_API_KEY` | 1st (preferred) |
| Tavily | `TAVILY_API_KEY` | 2nd |
| Valiyu | `VALIYU_API_KEY` | 3rd |

The agent calls this automatically when it needs current information from the web. Without this extension, the agent has no way to search the internet.

---

### 2. todo

**File:** `core-tools/todo/` (13 files, 1,181 lines)

**What it does:** Provides the `todo` tool that manages a live overlay task list. The tool supports four task states: `pending → in_progress → completed`, plus `deleted` as a tombstone. Features:

- Dependency tracking between tasks (`blockedBy` / `addBlockedBy`)
- Task metadata (arbitrary key-value store)
- List filtering by status, with optional `includeDeleted`
- Active form label shown while `in_progress`
- Updates appear in real-time in the TUI footer overlay

The agent uses this on almost every multi-step task to track progress. The user sees tasks rendered as a live overlay in the terminal.

---

### 3. calc

**File:** `core-tools/calc.ts` (76 lines)

**What it does:** Provides the `calc` tool that evaluates mathematical expressions. Supports:

- Basic arithmetic: `+`, `-`, `*`, `/`, `%`, `**`
- Math functions: `sin`, `cos`, `sqrt`, `log`, `abs`, `round`, `floor`, `ceil`
- Constants: `PI`, `E`
- Parentheses for grouping

The agent calls this automatically when it needs to compute something. The expression is sandboxed — no access to `require`, `process`, `fetch`, or other dangerous functions. It's a safe math evaluator, not a JS eval.

Without this, the agent would have to estimate or use a bash calculator.

---

### 4. ralph-loop

**File:** `core-tools/ralph-loop/` (6 files, 2,644 lines)

**What it does:** Provides the `ralph_loop` tool that runs subagent tasks in a loop while a condition is met. Modes:

| Mode | Behavior |
|------|----------|
| `single` | One subagent running repeatedly |
| `chain` | Sequential agents, each gets the previous output |
| `self` | In-session repeat (no subagent) |
| `parallel` | Multiple subagents concurrently |

The condition is a bash command — the loop continues while it prints "true". Supports pause/resume, steering controls, model/thinking overrides per iteration, and configurable sleep between iterations.

Used by skills like `writing-plans` and `executing-plans` for iterative refinement workflows.

---

### 5. plan-tracker

**File:** `core-tools/plan-tracker/` (4 files, 1,185 lines)

**What it does:** Provides the `plan_tracker` tool that tracks implementation plan progress. Actions:

| Action | Purpose |
|--------|---------|
| `init` | Set up a list of task names |
| `update` | Change a task's status (pending → in_progress → complete) |
| `status` | Show current state of all tasks |
| `clear` | Remove the plan |

Lighter than `todo` — designed for short-lived implementation plans rather than persistent task lists. Used in conjunction with `plan-mode` for structured development.

---

### 6. subagent

**File:** `core-tools/subagent/` (76 files, 23,769 lines)

**What it does:** Provides the `subagent` tool — the primary mechanism for dispatching child agents. By far the largest extension in pi-me. Supports:

| Mode | Description |
|------|-------------|
| `single` | One agent with a task |
| `chain` | Sequential pipeline, each step gets the prior response |
| `parallel` | Concurrent agents with fan-out |
| `async` | Background execution (non-blocking) |

Additional features:
- Agent discovery and management (create, update, delete agents)
- Slash commands (`/agent`, `/chain`, `/task`)
- Prompt template delegation bridge
- TUI rendering with widgets for multi-agent status
- Async job tracking with completion events
- Intercom bridge for agent-to-agent messaging
- Interrupt/resume for long-running agents
- Worktree isolation for parallel tasks
- Model fallback on failure
- Run history and session tokens

Also includes the merged `/team` tool (previously `crew`) for agent routing.

This is the backbone of all multi-agent workflows in pi.

---

### 7. clipboard

**File:** `core-tools/clipboard.ts` (94 lines)

**What it does:** Provides the `copy_to_clipboard` tool that copies text to the user's system clipboard via OSC52 escape sequences. Works over SSH, tmux, and local terminals that support OSC52.

The agent calls this when the user asks to copy something — code snippets, generated text, or any output. Without it, the user would have to manually select and copy text.

Very small extension (94 lines) for a very important function.

---

## Tier 2 — Frequently Used Commands

Users or skills call these regularly, but they aren't part of the agent's autonomous tool set.

---

### 8. plan-mode

**File:** `core-tools/plan-mode.ts` (902 lines)

**What it does:** Provides the `/plan` command and `plan` tool for file-based plans stored in `.pi/plans/`. Plans are markdown files with YAML frontmatter supporting:

- Steps with completion tracking
- Plan locking (prevents concurrent edits)
- Plan listing, filtering, and search
- Garbage collection of stale plans
- Planning mode (read-only exploration before implementing)
- CLI flag `--plan` to start in planning mode

Called by the `writing-plans` and `executing-plans` skills. Plans survive session restarts (unlike `todo` which is ephemeral).

---

### 9. sub-pi

**File:** `core-tools/sub-pi/` (4 files, 1,633 lines)

**What it does:** Provides the `sub_pi` tool that spawns subprocess pi instances. Like `subagent` but runs the pi CLI as a subprocess instead of using the internal agent SDK. Modes:

- `single` — one subprocess
- `chain` — sequential subprocesses
- `parallel` — concurrent subprocesses

Auto-detects `/skill:` references in task text. Useful for isolated execution with a clean context. Heavier than `subagent` (spawns a new process) but provides stronger isolation.

---

### 10. oracle

**File:** `core-tools/oracle.ts` (605 lines)

**What it does:** Provides the `/oracle` command that gets a second opinion from a different AI model. Workflow:

1. User types `/oracle <prompt>` or `/oracle -m gpt-4o <prompt>`
2. If no model specified, shows a model picker TUI
3. Queries the selected model with optional conversation context
4. Renders the response in a bottom-slot overlay

Supports 17+ models across OpenAI, Anthropic, Google, and OpenAI Codex providers. Optional `-f file.ts` flag to include file contents in the context.

Uniquely valuable as a tie-breaker when you want a second opinion without switching your primary model.

---

### 11. btw

**File:** `core-tools/btw/` (3 files, 603 lines)

**What it does:** Provides the `/btw <question>` command that asks the primary model a one-off side question. Key differences from `/oracle`:

| Aspect | `/btw` | `/oracle` |
|--------|--------|-----------|
| Model | Same as current session | Different model (you pick) |
| Context | Cloned session context | Optional context |
| Output | Bottom-slot overlay (ephemeral) | Bottom-slot overlay |
| Purpose | Quick side question | Second opinion |

The answer is rendered in an overlay that never enters the main conversation history. History persists per-session-file via in-memory storage (no disk writes).

---

### 12. code-actions

**File:** `core-tools/code-actions/` (6 files, 634 lines)

**What it does:** Provides the `/code` command that picks code snippets from assistant messages and lets you:

| Action | What it does |
|--------|-------------|
| `copy` | Copy snippet to clipboard |
| `insert` | Insert snippet into the editor |
| `run` | Execute snippet in the shell (with confirmation) |

Supports filtering by `last` (most recent assistant message) or `all` (all branch entries). Can include inline code or fenced blocks only. Used by the code review workflow.

---

### 13. thinking-steps

**File:** `core-tools/thinking-steps/` (3 files, 365 lines)

**What it does:** Adds structured thinking phases before tool calls. The agent follows a sequence:

1. **Plan** — Analyze the request and create a step-by-step plan
2. **Research** — Gather context before implementing
3. **Implement** — Write the code
4. **Review** — Check the output

Implemented as a prompt injection that prepends structured thinking instructions to the system prompt. The `/thinking-steps` command toggles it on/off. Has tests.

---

## Tier 3 — Quality of Life

Nice-to-have extensions that enhance the experience.

---

### 14. preset

**File:** `core-tools/preset/` (2 files, 352 lines)

**What it does:** Provides the `/preset` command to save and switch between model provider/tool presets. Lets you define named configurations (e.g. "fast", "cheap", "powerful") and cycle through them. Useful for switching between models without remembering exact provider/model strings.

---

### 15. model-filter

**File:** `core-tools/model-filter/index.ts` (51 lines)

**What it does:** Filters available models by provider in model selection UIs. Very small — 51 lines. Filters out models that don't match the current provider configuration.

---

### 16. memory

**File:** `core-tools/memory/` (9 files, 2,071 lines)

**What it does:** Combines two capabilities:

| Feature | Source | Purpose |
|---------|--------|---------|
| SQLite store | Original memory extension | Persistent key-value facts, lessons, events via `memory_store`/`memory_recall` tools |
| `/mem` command | Merged from memory-mode | Save instructions to `AGENTS.md` / `AGENTS.local.md` with AI-assisted integration |

Uses `node:sqlite` (experimental in Node 24). Has 48 tests covering store operations, consolidation, and injection.

---

### 17. formatter

**File:** `core-tools/formatter/` (21 files, 2,040 lines)

**What it does:** Auto-formats files on save/write. Detects the project's formatter and runs it automatically. Supports 9 runners:

| Runner | Languages | Config discovery |
|--------|-----------|-----------------|
| Biome | JS/TS/JSON/CSS | `biome.json` |
| Prettier | Universal | `.prettierrc` |
| Ruff (check) | Python | `pyproject.toml` |
| Ruff (format) | Python | `pyproject.toml` |
| shfmt | Shell | `.editorconfig` |
| clang-format | C/C++ | `.clang-format` |
| ESLint | JS/TS | `eslint.config.js` |
| markdownlint | Markdown | `.markdownlint.json` |
| cmake-format | CMake | `.cmake-format.py` |

Respects `.gitignore` and `git ls-files` to only format tracked files.

---

### 18. edit-session

**File:** `core-tools/edit-session/` (2 files, 634 lines)

**What it does:** Provides `/edit-turn` command and `Ctrl+Shift+E` shortcut to re-edit a previous user message. Opens the selected message in `$VISUAL` / `$EDITOR`, lets you edit it, then saves back. Navigates the session tree to rewind to the edited point. Handles images, deletions, and draft backup.

Useful for correcting mistakes in a previous prompt without restarting the session.

---

### 19. stash

**File:** `core-tools/stash/` (3 files, 467 lines)

**What it does:** Provides keyboard shortcuts to save and restore draft editor content:

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` | Stash current editor content |
| `Ctrl+Shift+R` | Restore most recent draft, or pick from a list |

Drafts persist via `pi.appendEntry` — they survive session branching. Also provides `/stash` and `/stash-list` commands.

---

### 20. file-collector

**File:** `core-tools/file-collector/` (2 files, 987 lines)

**What it does:** Collects file paths and content from tool results based on configurable regex patterns. Used by the agent to automatically gather context from tool outputs (read, write, edit, bash commands). Configured via `~/.pi/agent/file-collector.jsonc`.

Advanced features: bash shim commands for complex path capture, assistant citation patterns, bash output patterns. Niche — most users won't configure this.

---

## Tier 4 — Removal Candidates

These provide minimal value.

---

### 21. link

**File:** `core-tools/link/` (2 files, 1,519 lines)

**What it does:** WebSocket-based inter-terminal communication. Lets multiple pi instances on different machines share chat, broadcast prompts, and coordinate work. Implements:

- Hub/client architecture with auto-promotion
- 10 protocol message types (register, chat, prompt_request/response, etc.)
- Reconnect logic, keepalive, batching
- Commands: `/link`, `/link-name`, `/link-broadcast`, `/link-connect`, `/link-disconnect`
- Tools: `link_send`, `link_prompt`, `link_list`

**Why remove:** Requires multiple pi instances — very niche. Adds WebSocket dependency (`ws` package). 1,519 lines with 0 tests. Single-user pi workflows never need this.

---

### 22. speedreading

**File:** `core-tools/speedreading.ts` (682 lines)

**What it does:** RSVP (Rapid Serial Visual Presentation) reader triggered by `/speedread`. Displays text one word at a time at a configurable WPM (default 300) using the Spritz technique with an optimal recognition point (ORP) marker. Supports pause, rewind, speed up/down.

**Why remove:** Pure visual gimmick. The agent already outputs text at typing speed — there's no use case for an RSVP reader in a coding assistant. 0 tests.

---

### 23. ultrathink

**File:** `core-tools/ultrathink.ts` (222 lines)

**What it does:** Rainbow-colored "ultrathink" animation when the user types the word. Detects "ultrathink" as you type and shows a Knight Rider-style shimmer effect with 8 ANSI colors cycling across the letters.

**Why remove:** Pure visual gimmick. No functional purpose. 0 tests.
