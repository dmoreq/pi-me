# Core Tools Layer

General-purpose tools the agent invokes directly. Includes task management, computation, user interaction,
external access, and utility operations.

---

## Extensions

### Web Search

**Source:** `core-tools/web-search.ts`
**Trigger:** Tool (`web_search`)

Searches the web via Brave, SerpAPI, or Kagi. Auto-detects which API key is available. Returns formatted
results with titles, URLs, and text snippets.

**Configuration:** `EXA_API_KEY`, `TAVILY_API_KEY`, or `VALIYU_API_KEY`

### Todo

**Source:** `core-tools/todo/index.ts`
**Trigger:** Hook (`session_start`, `session_compact`, `session_tree`, `tool_execution_end`) · Tool (`todo`) · Command (`/todos`)

Live overlay task list with a 4-state machine:

- **`pending`:** Not yet started
- **`in_progress`:** Currently active (exactly one at a time)
- **`completed`:** Finished successfully
- **`deleted`:** Soft-deleted tombstone

Features dependency tracking (`blockedBy`) with cycle detection, branch replay for survival across
`/reload` and compaction, and a persistent above-editor overlay widget with smart truncation.
The agent receives detailed `promptGuidelines` instructing it when and how to manage tasks.

### Calc

**Source:** `core-tools/calc.ts`
**Trigger:** Tool (`calc`)

Safe arithmetic expression evaluator. Whitelists `Math.*` functions and standard operators.
Blocks `eval`, `require`, `import`, and other dangerous patterns.

### Ask User Question

**Source:** `core-tools/ask-user-question/index.ts`
**Trigger:** Tool (`ask_user_question`)

Structured multi-question UI for gathering user input during agent execution. Supports:

- **Multi-question tabs:** Up to 5 questions per invocation
- **Multi-select:** Checkbox-style multiple answers per question
- **Side-by-side previews:** Markdown-rendered previews for code snippets, diagrams, and mockups
- **Free-text fallback:** "Type something" row on single-select questions
- **Escape hatch:** "Chat about this" to abandon the questionnaire

The agent receives `promptGuidelines` for when to use this tool versus proceeding autonomously.

### Ralph Loop

**Source:** `core-tools/ralph-loop/ralph-loop.ts`
**Trigger:** Tool (`ralph_loop`) · Hook (`agent_end`) · Command (`/ralph-self`, `/ralph-self-stop`, `/ralph-steer`, `/ralph-follow`, `/ralph-clear`, `/ralph-pause`, `/ralph-resume`)

Subagent loop executor supporting three modes:

- **Single:** One agent per iteration with condition polling
- **Chain:** Sequential agents passing output between iterations
- **Parallel:** Concurrent subagent dispatch for independent tasks

Pause/resume controls, steering messages to redirect agent behavior mid-loop, and usage tracking per iteration.

### Plan Tracker

**Source:** `core-tools/plan-tracker/plan-tracker.ts`
**Trigger:** Tool (`plan_tracker`)

Inline plan progress tracking with a footer widget. Actions: `init` (set task list), `update` (change status),
`status` (display progress), `clear` (remove plan). Shows `Tasks: ✓✓→○○ (2/5)` style progress indicator.

### Plan Mode

**Source:** `core-tools/plan-mode.ts`
**Trigger:** Tool (`plan`) · Hook (`tool_call`, `before_agent_start`, `session_start`, `session_switch`) · Command (`/plan`) · Shortcut (`ctrl+shift+x`)

File-based plan manager with markdown files and JSON frontmatter stored in `.pi/plans/`.
Features include session-level plan locking, read-only planning mode (`/plan on`/`/plan off`),
interactive TUI for plan browsing, and task status management.

### Sub-Pi

**Source:** `core-tools/sub-pi/index.ts`
**Trigger:** Tool (subagent dispatch) · Hook (`before_agent_start`)

Launches `pi` subprocesses as subagents with three execution modes:
- **Single:** One task, one subagent
- **Chain:** Sequential tasks with context passing
- **Parallel:** Concurrent tasks up to configured maximum

Automatically detects `/skill:name` references in user input and dispatches matching skills as subagent tasks.
Supports model and thinking level overrides per invocation.

### BTW

**Source:** `core-tools/btw/index.ts`
**Trigger:** Command (`/btw`)

Asks the primary model a one-off side question using cloned conversation context.
The answer renders in an overlay and never enters the main agent's message history.
History persists per session via in-process storage.

### Oracle

**Source:** `core-tools/oracle.ts`
**Trigger:** Command (`/oracle`)

Sends the current conversation to another AI model for a second opinion. Supports model selection
via `/oracle -m <model> <prompt>`. Includes file context from the current session.

### Code Actions

**Source:** `core-tools/code-actions/index.ts`
**Trigger:** Command (`/code`)

Extracts code blocks from assistant messages with actions to copy to clipboard, insert into the editor,
or execute the snippet. Filterable by programming language.

### Speed Reading

**Source:** `core-tools/speedreading.ts`
**Trigger:** Command (`/speedread`) · Shortcut (`ctrl+shift+s`)

RSVP (Rapid Serial Visual Presentation) reader using the Spritz technique. Displays words one at a time
with the optimal recognition point highlighted. Adjustable WPM (default: 400). Reads from text input,
files, clipboard, or the last assistant message.

### Ultrathink

**Source:** `core-tools/ultrathink.ts`
**Trigger:** Hook (`session_start`, `before_agent_start`, `agent_start`, `session_switch`) · Command (`/ultrathink`) · Shortcut (`ctrl+shift+t`)

Rainbow shimmer animation triggered by "ultrathink" keyword detection as the user types.
The `/ultrathink` command toggles manual mode; the shortcut provides quick access.

### Memory Mode

**Source:** `core-tools/memory-mode.ts`
**Trigger:** Command (`/mem`, `/remember`)

Saves instructions to project `AGENTS.md` or `AGENTS.local.md` files. Supports global
(`~/.pi/agent/AGENTS.md`) and project-local contexts. Automatically adds `.local.md` to `.gitignore`.

### File Collector

**Source:** `core-tools/file-collector/index.ts`
**Trigger:** Hook (`before_agent_start`, `tool_call`, `tool_result`, `message_end`)

Collects file paths and content from tool results based on configurable regex patterns.
Captures matching files for reuse across the session.

### Clipboard

**Source:** `core-tools/clipboard.ts`
**Trigger:** Tool (clipboard operations)

Copies text to the system clipboard using OSC52 escape sequences. Compatible with SSH sessions
and most modern terminal emulators (iTerm2, Kitty, Alacritty, WezTerm, Windows Terminal, tmux).

### Arcade

**Source:** `core-tools/arcade/`
**Trigger:** Tools (per-game)

Five terminal minigames:
- **Spice Invaders:** Space Invaders clone
- **Picman:** Pac-Man clone
- **Ping:** Pong clone
- **Tetris:** Tetris clone
- **Mario-Not:** Platformer

### Flicker Corp

**Source:** `core-tools/flicker-corp.ts`
**Trigger:** Hook (session lifecycle, TUI rendering) · Command (`/flicker-corp`, `/signature-flicker`)

Animated terminal display effect with high-speed scrolling and "glitch" artifacts.

### Resistance

**Source:** `core-tools/resistance.ts`
**Trigger:** Hook (`session_start`, `session_shutdown`) · Command (`/resistance`)

Footer display with a typewriter reveal effect and periodic glitch animations.

---

**See also:** [Architecture Overview](intro.md) · [Foundation](foundation.md) · [Session Lifecycle](session-lifecycle.md) · [Content Tools](content-tools.md) · [Authoring](authoring.md) · [Skills](skills.md)
