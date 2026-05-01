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


---

**See also:** [Intro](intro.md) · [Foundation](foundation.md) · [Session Lifecycle](session-lifecycle.md) · [Core Tools](core-tools.md) · [Content Tools](content-tools.md) · [Authoring](authoring.md) · [Skills](skills.md)
