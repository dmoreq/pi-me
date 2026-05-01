# Session Lifecycle Layer

Extensions that manage session state from initialization through compaction to shutdown. Includes session branding,
metrics, notifications, and model/preset management.

---

## Extensions

### Git Checkpoint

**Source:** `session-lifecycle/git-checkpoint-new/checkpoint.ts`
**Trigger:** Hook (`session_start`, `session_switch`, `session_fork`, `session_before_fork`, `session_before_tree`)

Creates a git reference (`refs/pi-checkpoints/`) at the start of every turn, capturing the full working tree
(tracked, staged, and untracked files). Enables state recovery when branching or forking sessions.

### Auto Compact

**Source:** `session-lifecycle/auto-compact/auto-compact.ts`
**Trigger:** Hook (`message_start`, `session_start`, `session_compact`, `turn_end`)

Automatically triggers context compaction when usage exceeds the configured threshold (default: 80%).
Uses the pi runtime's built-in compaction mechanism with customizable instructions.

### Session Name

**Source:** `session-lifecycle/session-name/session-name.ts`
**Trigger:** Hook (`session_start`, `input`, `session_shutdown`)

Names each session from the first user message, truncated to 60 characters. Displays the name in the TUI header
and persists it on shutdown.

### Token Rate

**Source:** `session-lifecycle/token-rate/token-rate.ts`
**Trigger:** Hook (`session_start`, `session_switch`, `turn_start`, `tool_call`, `turn_end`)

Measures output token rate and displays it as a live metric in the footer. Tracks cumulative statistics across
turns for accurate averaging.

### Agent Guidance

**Source:** `session-lifecycle/agent-guidance/agent-guidance.ts`
**Trigger:** Hook (`before_agent_start`)

Injects model-specific guidance files (`CLAUDE.md`, `CODEX.md`, `GEMINI.md`) into the context based on the
currently active provider. Enables tailored instructions per model without manual switching.

### Session Recap

**Source:** `session-lifecycle/session-recap/index.ts`
**Trigger:** Hook (`turn_end`, `turn_start`, `input`, `agent_start`, `session_shutdown`) · Command (`/recap`)

Displays a one-line session summary above the editor on terminal refocus or after idle periods.
The `/recap` command shows a full session activity summary.

### Tab Status

**Source:** `session-lifecycle/tab-status/tab-status.ts`
**Trigger:** Hook (session lifecycle events)

Sets the terminal tab title with status indicators for at-a-glance session state:
- ✅ Task completed
- 🚧 In progress
- 🛑 Timed out

### Usage Extension

**Source:** `session-lifecycle/usage-extension/index.ts`
**Trigger:** Command (`/usage`, `/cost`)

**`/usage`** — Token, cost, and message dashboard grouped by provider and model. Four time windows:
Today, This Week, Last Week, All Time. Expandable provider rows showing per-model breakdowns.

**`/cost`** — Scans session logs from the last 30 days and displays spending by provider and model.
Drill-down into daily spending and top models.

### Notifications

**Source:** `session-lifecycle/notifications.ts`
**Trigger:** Hook (`session_start`, `agent_start`, `tool_result`, `agent_end`) · Command (`/notify-beep`, `/notify-focus`, `/notify-say`, `/notify-threshold`, `/notify-status`, `/notify-save-global`, `/fun-working`)

**Background alerts:** Detects long-running tasks and sends notifications when the terminal is backgrounded.
Supports beep, bring-to-front (macOS), speech synthesis, and OS-level notifications. Configurable threshold
(default: 2 seconds).

**Funny messages:** Replaces the standard "Working..." spinner with a rotating set of humorous messages.
Toggle with `/fun-working`.

### Handoff

**Source:** `session-lifecycle/handoff.ts`
**Trigger:** Command (`/handoff`)

Generates a focused context summary targeting the next task and creates a new session draft.
More precise than compaction — preserves only what's relevant for the continuation.

### Session Style

**Source:** `session-lifecycle/session-style.ts`
**Trigger:** Hook (`session_start`, `session_switch`, `agent_start`) · Command (`/emoji`, `/emoji-set`, `/emoji-config`, `/emoji-history`, `/color`, `/color-set`, `/color-next`, `/color-char`, `/color-config`)

**Emoji:** AI-powered emoji selection representing the conversation theme. Three modes:
- `ai` — Analyzes recent messages and picks a contextually relevant emoji
- `random` — Selects from a curated set with 24-hour uniqueness enforcement
- `manual` — User sets via `/emoji-set`

**Color:** Sequential 40-color palette designed for maximum visual distinction between consecutive sessions.
Displays as a colored band (▁▁▁) in the footer. Adjustable block character and cycle navigation.

### Compact Config

**Source:** `session-lifecycle/compact-config.ts`
**Trigger:** Hook (`turn_end`, `agent_end`) · Command (`/compact-config`)

Per-model compaction thresholds configured via interactive TUI. Triggers compaction when context exceeds
the model-specific limit, even if the global auto-compact threshold hasn't been reached.

### Preset

**Source:** `session-lifecycle/preset/index.ts`
**Trigger:** Hook (`before_agent_start`, `session_start`, `turn_start`) · Command (`/preset`)

Save and switch between named presets that configure provider, model, thinking level, enabled tools,
and custom instructions. Presets persist as JSONC files. Supports cycling through presets with
configurable keyboard shortcuts.

### Skill Args

**Source:** `session-lifecycle/skill-args/index.ts`
**Trigger:** Hook (`input`)

Enables parameterized skills by intercepting `/skill:name arg1 arg2` syntax and substituting positional
arguments (`$1`, `$2`, `$ARGUMENTS`, `$@`, `${@:N:L}`) in skill bodies. No skill file changes required.

### Warp Notify

**Source:** `session-lifecycle/warp-notify/index.ts`
**Trigger:** Hook (`session_start`, `agent_end`, `tool_call`, `turn_end`)

Emits Warp-specific OSC 777 structured escape sequences on pi lifecycle events. Auto-detects the Warp
terminal environment — complete no-op outside Warp. Emits on `session_start`, `stop`, `idle_prompt`,
and `tool_complete` events.

---

**See also:** [Architecture Overview](intro.md) · [Foundation](foundation.md) · [Core Tools](core-tools.md) · [Content Tools](content-tools.md) · [Authoring](authoring.md) · [Skills](skills.md)
