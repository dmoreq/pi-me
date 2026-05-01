# pi-me Features & Skills Reference

How every extension and skill works and what triggers it.

---

## How Extensions Activate

There are three trigger modes:

| Mode | Mechanism | Examples |
|------|-----------|----------|
| **🔄 Hook** | `pi.on("event", ...)` — fires automatically on lifecycle events | session_start, turn_end, tool_call, agent_start |
| **🤖 Tool** | `pi.registerTool(...)` — available for the agent to call via tool calls | web_search, calc, notebook, plan_tracker |
| **⌨️ Command** | `pi.registerCommand(...)` — user types `/something` in the terminal | /plan, /oracle, /mem, /color |

Many extensions use **multiple modes** (e.g., hooks run automatically while commands let the user override or configure).

---

## Foundation Layer

Always-on safety, diagnostics, and context management. Loaded first.

### `secrets` — Secret Obfuscation
**Trigger:** 🔄 Hook (`tool_result`, `context`, `session_start`)

Scans every tool result and context block for sensitive values (API keys, tokens, passwords) and obfuscates them automatically. Loads secrets from `~/.pi/agent/secrets.yml` and `.pi/secrets.yml`.

- **On `session_start`**: loads secret patterns from config files
- **On `tool_result`**: scans output, replaces matches with `***` placeholders
- **On `context`**: scans context before sending to LLM

### `permission` — Three-Layer Safety System
**Trigger:** 🔄 Hook (`session_start`, `tool_call`) + ⌨️ `/permission`, `/permission-mode`

Controls what commands the agent can run. Three layers:

1. **Hard safety nets**: always blocks dangerous patterns (`rm -rf /`, `sudo rm`, `curl | bash`)
2. **Tiered levels**: `minimal` → `low` → `medium` → `high` → `bypassed`
3. **Mode**: `ask` (prompt user) vs `block` (silently reject)

- **On `session_start`**: initializes state from saved settings
- **On `tool_call`**: intercepts bash commands, classifies risk, allows/blocks

### `context-window` — Context Usage Display
**Trigger:** 🔄 Hook (`turn_end`, `session_start`, `session_shutdown`)

Shows a percentage widget in the footer. Warns at 70%, alerts at 90%, auto-suggests `/compact`.

- **On `turn_end`**: recalculates usage and updates widget

### `memory-mode` — Save Instructions to AGENTS.md
**Trigger:** ⌨️ `/mem` or `/remember`

Opens a text input where you type an instruction. The AI integrates it into your project's `AGENTS.md`, `AGENTS.local.md`, or `~/.pi/agent/AGENTS.md`. Auto-adds `.local.md` to `.gitignore`.

### `status-widget` — Provider Status Indicators
**Trigger:** 🔄 Hook (`session_start`, `session_shutdown`) + ⌨️ `/status`, `/status-refresh`

Fetches live status from Anthropic, OpenAI, and GitHub status pages. Shows ✅ / ⚠️ / ❌ in the footer. Refreshes every 5 minutes.

### `safe-git` — Git Safety Guard
**Trigger:** 🔄 Hook (`tool_call`, `session_start`) + ⌨️ `/safegit`, `/safegit-level`, `/safegit-status`

Intercepts dangerous git/gh commands (force push, hard reset, rebase, merge). Requires explicit user approval. In non-interactive mode, blocks entirely. Categorizes commands by risk level.

### `safe-rm` — Safe Deletion
**Trigger:** 🔄 Hook (`tool_call`) + ⌨️ `/saferm`, `/saferm-toggle`, `/saferm-on`, `/saferm-off`, `/saferm-log`

Intercepts `rm` commands and replaces them with macOS `trash` command. Logs original and replacement commands to a debug log.

### `pi-config` — JSONC Config Utility
**Trigger:** — (library)

Shared configuration loader used by `extra-context-files`, `file-collector`, `files`, `preset`, `sub-pi`, and `sub-pi-skill`. Reads `.jsonc` config files from the pi agent directory. Not directly active — imported by other extensions.

### `extra-context-files` — Auto-Load Context Files
**Trigger:** 🔄 Hook (`session_start`, `before_agent_start`)

Reads `AGENTS.local.md` and `CLAUDE.local.md` from the project root and injects them into the initial context automatically. Zero-config — just drop those files in your project.

---

## Session Lifecycle Layer

Hooks that manage session state: checkpoints, compaction, naming, and metrics.

### `git-checkpoint-new` — Auto Git Snapshots
**Trigger:** 🔄 Hook (`session_start`, `session_switch`, `session_fork`, `session_before_fork`, `session_before_tree`)

Creates a git ref (`refs/pi-checkpoints/`) at the start of every turn, capturing the full working tree. Enables recovery when branching/forking sessions.

- **On `session_start`**: creates initial checkpoint
- **On `session_before_fork`**: preserves state before fork for restore

### `auto-compact` — Automatic Context Compaction
**Trigger:** 🔄 Hook (`message_start`, `session_start`, `session_compact`, `turn_end`)

Automatically compacts when context usage exceeds 80% (configurable via settings). Uses the pi runtime's built-in compaction with custom instructions.

- **On `turn_end`**: checks usage, triggers compaction if needed

### `session-name` — Auto-Named Sessions
**Trigger:** 🔄 Hook (`session_start`, `input`, `session_shutdown`)

Names the session from the first user message (truncated to 60 chars). Shows the name in the TUI header. Saves on shutdown.

### `token-rate` — Token-Per-Second Display
**Trigger:** 🔄 Hook (`session_start`, `session_switch`, `turn_start`, `tool_call`, `turn_end`)

Measures output token rate and displays it in the footer as a live metric. Tracks cumulative stats across turns.

### `agent-guidance` — Model-Specific Guidance Files
**Trigger:** 🔄 Hook (`before_agent_start`)

Injects model-specific guidance files (`CLAUDE.md`, `CODEX.md`, `GEMINI.md`) into the context based on which provider is active. Switch between Claude/Codex/Gemini and get tailored instructions.

### `session-recap` — Session Recap on Refocus
**Trigger:** 🔄 Hook (`turn_end`, `turn_start`, `input`, `agent_start`, `session_shutdown`) + ⌨️ `/recap`

Shows a one-line summary above the editor when you refocus the terminal (or after idle). Keeps you oriented when multi-sessioning.

### `tab-status` — Terminal Tab Indicators
**Trigger:** 🔄 Hook (session lifecycle events)

Sets the terminal tab title with status icons: ✅ done, 🚧 stuck, 🛑 timed out. Helps distinguish parallel sessions at a glance.

### `usage-extension` — Usage Cost Dashboard
**Trigger:** ⌨️ `/usage`

Displays a detailed cost/token/message dashboard grouped by provider and model. Shows Today, This Week, Last Week, and All Time views. Includes insights for high-cost sessions and uncached prompts.

### `cost-tracker` — Per-Provider Spending
**Trigger:** ⌨️ `/cost`

Scans session logs from the last 30 days and shows spending broken down by provider. Simpler than usage-extension — focused purely on cost.

### `funny-working-message` — Culinary Working Messages
**Trigger:** 🔄 Hook (`agent_start`, `agent_end`) + ⌨️ `/fun-working`

Replaces the standard "Working..." spinner message with culinary verbs: "Simmering...", "Julienning...", "Caramelizing...", "Braising..." etc. Rotates randomly.

### `handoff` — Context Handoff to New Session
**Trigger:** ⌨️ `/handoff <prompt>`

Instead of compacting (lossy), generates a focused prompt summarizing what matters for the next task and creates a new session draft. Great for switching context cleanly.

### `usage-bar` — Usage Progress Bars
**Trigger:** ⌨️ `/usage`

Shows AI provider usage with progress bars, provider status indicators, and reset countdowns. Shows Claude, Copilot, Gemini, and Codex rate limits.

### `background-notify` — Task Completion Notification
**Trigger:** 🔄 Hook (`session_start`, `agent_start`, `tool_result`, `agent_end`) + ⌨️ `/notify-beep`, `/notify-focus`, `/notify-say`, `/notify-threshold`, `/notify-status`

Plays a beep and optionally brings the terminal to front (macOS) when a long-running task completes while the terminal is backgrounded. Configurable threshold (default: 2s).

### `session-emoji` — AI-Powered Session Emoji
**Trigger:** 🔄 Hook (`session_start`, `session_switch`, `agent_start`) + ⌨️ `/emoji`, `/emoji-set`, `/emoji-config`, `/emoji-history`

Displays an emoji in the footer that represents the conversation. Three modes: `ai` (analyzes context to pick an emoji), `random`, or `manual`. Enforces 24-hour uniqueness.

### `session-color` — Session Color Band
**Trigger:** 🔄 Hook (`session_start`, `session_switch`) + ⌨️ `/color`, `/color-set`, `/color-next`, `/color-char`, `/color-config`

Displays a colored band (▁▁▁) in the footer to visually distinguish sessions. Picks from a 40-color palette designed for maximum visual distinction between consecutive sessions.

### `compact-config` — Per-Model Compaction Thresholds
**Trigger:** 🔄 Hook (`turn_end`, `agent_end`) + ⌨️ `/compact-config`

Allows setting custom compaction thresholds per model. When context exceeds the threshold, triggers compaction even if the built-in auto-compact wouldn't fire. Configure via an interactive TUI.

### `preset` — Model/Tool Presets
**Trigger:** ⌨️ `/preset` + 🔄 Hook (`before_agent_start`, `session_start`, `turn_start`)

Save and switch between presets that configure: provider, model, thinking level, enabled tools, and custom instructions. Presets are persisted as JSONC files. Supports cycling through presets on session start.

---

## Core Tools Layer

General-purpose tools the agent can invoke directly.

### `web-search` — Web Search
**Trigger:** 🤖 Tool (`web_search`)

Searches the web via Brave, SerpAPI, or Kagi backends. Auto-detects which API key is set. Returns formatted results with titles, URLs, and snippets.

**Config:** Set `BRAVE_API_KEY`, `SERPAPI_API_KEY`, or `KAGI_API_KEY`.

### `todo` — Session Todo List
**Trigger:** 🤖 Tool (`todo`) + 🔄 Hook (`session_start`, `session_tree`) + ⌨️ `/todos`

Stateful todo list for the current session. Persists across session tree operations. Actions: `list`, `add`, `toggle`, `clear`.

### `calc` — Safe Math Evaluator
**Trigger:** 🤖 Tool (`calc`)

Evaluates mathematical expressions. Whitelists `Math.*` functions. Blocks `eval`, `require`, and other dangerous patterns. Supports +, -, *, /, %, **, and all Math functions.

### `ask` — Interactive User Prompting
**Trigger:** 🤖 Tool (`ask`)

Prompts the user with text, confirm, or choice modes. Falls back gracefully in non-interactive mode. Used by the agent when it needs clarification.

### `ralph-loop` — Subagent Loop Executor
**Trigger:** 🤖 Tool (`ralph_loop`) + ⌨️ `/ralph-steer`, `/ralph-follow`, `/ralph-clear`, `/ralph-pause`, `/ralph-resume`

Runs subagents in a loop with condition polling. Supports single (one agent per iteration) and chain (sequential agents) modes. Features: pause/resume, steering messages, usage tracking per iteration.

**Related skill:** `skills/ralph-loop/`

### `plan-tracker` — Plan Progress Tracking
**Trigger:** 🤖 Tool (`plan_tracker`)

Tracks implementation plan progress inline. Actions: `init` (set task list), `update` (change task status), `status` (show current state), `clear` (remove plan). Shows a TUI widget: `Tasks: ✓✓→○○ (2/5)`.

**Origin:** [superpowers](https://github.com/obra/superpowers)

### `pi-ralph-wiggum` — File-Based Task Loops
**Trigger:** 🤖 Tool (`ralph_start`) + ⌨️ commands

Long-running iterative development loops using a markdown task file (`.ralph/`). Features: iteration count, reflection checkpoints, pause/resume. Different from `ralph-loop` — this works with a flat task file instead of dispatching subagents.

**Origin:** [pi-extensions](https://github.com/tmustier/pi-extensions)

### `code-actions` — Code Snippet Picker
**Trigger:** ⌨️ `/code`

Picks code blocks or inline snippets from assistant messages. Offers actions: copy to clipboard, insert into editor, or run the snippet. Filters by language.

**Origin:** [pi-extensions](https://github.com/tmustier/pi-extensions)

### `clipboard` — OSC52 Clipboard Copy
**Trigger:** 🤖 Tool (clipboard tool)

Copies text to the user's clipboard using OSC52 escape sequences. Works across SSH sessions and most modern terminal emulators (iTerm2, Kitty, Alacritty, WezTerm, Windows Terminal, tmux).

**Origin:** [shitty-extensions](https://github.com/hjanuschka/shitty-extensions)

### `flicker-corp` — Terminal Display Animation
**Trigger:** 🔄 Hook (session lifecycle, TUI rendering)

An animated terminal effect. High-speed scrolling display with occasional "glitch" artifacts. Pure entertainment.

**Origin:** [shitty-extensions](https://github.com/hjanuschka/shitty-extensions)

### `loop` — In-Session Loop with Breakout
**Trigger:** 🤖 Tool (signal_loop_success) + ⌨️ `/loop`

Repeats a prompt on turn end until the agent signals success via `signal_loop_success` tool. Three modes: `tests` (until tests pass), `custom` (until custom condition), `self` (agent decides). Shows a loop status widget.

**Origin:** [shitty-extensions](https://github.com/hjanuschka/shitty-extensions)

### `oracle` — Second Opinion from Other Models
**Trigger:** ⌨️ `/oracle <prompt>` or `/oracle -m <model> <prompt>`

Sends your conversation to another AI model (GPT-4o, Gemini, Claude Sonnet, etc.) for a second opinion. Picks from a curated model list. Includes file context optionally.

**Origin:** [shitty-extensions](https://github.com/hjanuschka/shitty-extensions)

### `plan-mode` — File-Based Plan Manager
**Trigger:** 🤖 Tool (`plan`) + 🔄 Hook (`tool_call`, `before_agent_start`, `session_start`, `session_switch`) + ⌨️ `/plan`

Full-featured plan management: file-based plans stored as markdown with JSON frontmatter in `.pi/plans/`. Features: plan locking per session, read-only planning mode (`/plan on`/`/plan off`), interactive TUI, task creation and status tracking.

**Origin:** [shitty-extensions](https://github.com/hjanuschka/shitty-extensions)

### `resistance` — Battlestar Galactica Footer Quote
**Trigger:** 🔄 Hook (`session_start`, `session_shutdown`) + ⌨️ `/resistance`

Displays "If you're listening to this, you are the resistance." with a typewriter reveal effect and periodic glitch animations. Resets on session end.

**Origin:** [shitty-extensions](https://github.com/hjanuschka/shitty-extensions)

### `speedreading` — RSVP Speed Reader
**Trigger:** ⌨️ `/speedread <text>` or `/speedread @file` or `/speedread -c`

RSVP (Rapid Serial Visual Presentation) reader using the Spritz technique: displays words one at a time with the optimal recognition point highlighted. Adjustable WPM (default: 400). Reads from text, files, clipboard, or last assistant message.

**Origin:** [shitty-extensions](https://github.com/hjanuschka/shitty-extensions)

### `ultrathink` — Rainbow Ultrathink Animation
**Trigger:** 🔄 Hook (`session_start`, `before_agent_start`, `agent_start`, `session_shutdown`, `session_switch`) + ⌨️ `/ultrathink`

Detects "ultrathink" as you type and shows a rainbow shimmer animation. Like Claude Code's ultrathink — type u-l-t-r-a-t-h-i-n-k and watch the magic.

**Origin:** [shitty-extensions](https://github.com/hjanuschka/shitty-extensions)

### `arcade` — Minigames
**Trigger:** 🤖 Tool (per-game tools)

Five arcade games playable inside the terminal while tests run:
- **spice-invaders** — Space Invaders clone
- **picman** — Pac-Man clone
- **ping** — Pong clone
- **tetris** — Tetris clone
- **mario-not** — Platformer (not Mario)

**Origin:** [pi-extensions](https://github.com/tmustier/pi-extensions)

### `file-collector` — Collect Files from Tool Results
**Trigger:** 🔄 Hook (`before_agent_start`, `tool_call`, `tool_result`, `message_end`)

Collects file paths and content from tool results based on regex patterns. Captures files matching configured rules and stores them for reuse. Configurable via JSONC config.

### `sub-pi` — General-Purpose Subagent Tool
**Trigger:** 🤖 Tool (subagent dispatch) + 🔄 Hook (`before_agent_start`)

Launches subprocesses running `pi` as a subagent. Passes the current conversation context, configures model/provider, runs the task, and returns results. More general than `ralph-loop` — single invocation, not a loop.

### `sub-pi-skill` — Skill-Aware Subagent Dispatch
**Trigger:** 🔄 Hook (`input`, `tool_call`, `turn_end`, `session_start`)

Watches for skill references like `/skill:writing-plans` in user input and automatically dispatches the skill as a subagent task. Bridges the gap between skills and subagent execution.

---

## Content Tools Layer

File and resource manipulation tools.

### `notebook` — Jupyter Notebook Editor
**Trigger:** 🤖 Tool (`notebook`)

Cell-level editor for `.ipynb` files. Supports: read, edit, insert, delete cells. Handles both code and markdown cells. Previews long outputs with truncation.

### `mermaid` — Mermaid Diagram Renderer
**Trigger:** 🤖 Tool (`render_mermaid`)

Renders Mermaid diagram source to SVG or PNG. Requires the `mmdc` CLI (`npm i -g @mermaid-js/mermaid-cli`).

### `github` — GitHub API Client
**Trigger:** 🤖 Tool (GitHub operations)

Search code, create issues, create PRs, read files from GitHub repos. Uses `GITHUB_TOKEN` or `GH_TOKEN` for auth.

### `repeat` — Command Replay
**Trigger:** ⌨️ `/repeat`

Re-runs a previous bash/edit/write command, optionally with modifications. Cycles through command history.

**Origin:** [pi-hooks](https://github.com/prateekmedia/pi-hooks)

### `files-widget` — TUI File Browser
**Trigger:** ⌨️ `/readfiles` + 🔄 Hook (`tool_result`, `session_start`, `session_switch`)

In-terminal file browser with directory tree, file viewer, diff viewer, commenting, and line selection. Navigate files without leaving pi.

**Origin:** [pi-extensions](https://github.com/tmustier/pi-extensions)

### `raw-paste` — Editable Text Paste
**Trigger:** ⌨️ `/paste` + 🔄 Hook (`session_start`)

Pastes text as editable content, not as a collapsed `[paste #1 +21 lines]` block. Supports optional keybinding for quick access. Pasted text appears inline for review before sending.

**Origin:** [pi-extensions](https://github.com/tmustier/pi-extensions)

### `richard-files` — File Actions
**Trigger:** ⌨️ `/files` (or configured command name)

File actions with TUI selector: reveal in Finder, quicklook, open in editor, edit content, add file content to prompt. Supports directory display with configurable suffix. Integrates with the system file manager.

---

## Authoring Layer

AI-assisted content creation helpers.

### `output-artifacts` — Truncated Output Storage
**Trigger:** 🔄 Hook (`session_start`, `tool_result`, `before_agent_start`, `tool_call`)

Saves tool outputs that exceed 8000 characters to `.pi/artifacts/` as text files. Provides `artifact://` URLs to retrieve the full content later. Prevents context overflow while preserving access.

### `commit-helper` — Commit Message Generator
**Trigger:** 🤖 Tool (`commit_message`) + ⌨️ `/commit`

Analyzes staged/unstaged git diffs and generates a conventional commit message (type, scope, description). Uses LLM analysis of the diff to produce meaningful messages.

### `skill-bootstrap` — Auto-Generate SKILL.md
**Trigger:** ⌨️ `/bootstrap-skill`

Auto-detects project type (language, framework, test runner) and generates a `SKILL.md` documentation file with appropriate frontmatter and guidance.

---



---

**See also:** [Skills Reference](skills.md) — detailed skill descriptions and triggers.
