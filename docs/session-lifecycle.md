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

### `usage-extension` — Usage Dashboard + Cost Tracker
**Trigger:** ⌨️ `/usage`, `/cost`

Detailed cost/token/message dashboard grouped by provider and model (Today/Week/AllTime). `/cost` scans session logs for spending breakdown.

### `notifications` — Background Alerts + Funny Messages
**Trigger:** 🔄 Hooks + ⌨️ `/notify-*`, `/fun-working`

Plays beep/brings terminal to front when long tasks complete in background. Rotates humorous spinner messages ("Simmering...", "Reticulating splines...").

### `handoff` — Context Handoff to New Session
**Trigger:** ⌨️ `/handoff <prompt>`

Instead of compacting (lossy), generates a focused prompt summarizing what matters for the next task and creates a new session draft.

### `session-style` — Emoji + Color Branding
**Trigger:** 🔄 Hooks + ⌨️ `/emoji*`, `/color*`

Displays an AI-picked emoji in the footer representing the conversation. Adds a colored band from a 40-color palette to visually distinguish sessions.

### `compact-config` — Per-Model Compaction Thresholds
**Trigger:** 🔄 Hook (`turn_end`, `agent_end`) + ⌨️ `/compact-config`

Allows setting custom compaction thresholds per model. When context exceeds the threshold, triggers compaction even if the built-in auto-compact wouldn't fire. Configure via an interactive TUI.

### `preset` — Model/Tool Presets
**Trigger:** ⌨️ `/preset` + 🔄 Hook (`before_agent_start`, `session_start`, `turn_start`)

Save and switch between presets that configure: provider, model, thinking level, enabled tools, and custom instructions. Presets are persisted as JSONC files. Supports cycling through presets on session start.

---


---

**See also:** [Intro](intro.md) · [Foundation](foundation.md) · [Session Lifecycle](session-lifecycle.md) · [Core Tools](core-tools.md) · [Content Tools](content-tools.md) · [Authoring](authoring.md) · [Skills](skills.md)
