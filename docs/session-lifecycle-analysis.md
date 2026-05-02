# session-lifecycle/ Extension Analysis

Session boundaries, state management, branding, and lifecycle hooks.
16 extensions, ranging from critical to cosmetic.

---

## 🔴 Tier 1 — Session Infrastructure (keep)

These manage session boundaries and core lifecycle. Removing any would break fundamental session behavior.

---

### 1. checkpoint (git-checkpoint)

**Files:** `session-lifecycle/git-checkpoint/` (2 TS files, 2,285 lines, 1 test file)

**What it does:** Auto-saves the working tree as git refs at each agent turn start. Creates lightweight checkpoints that enable:

- **Fork recovery** — when you `/fork`, the new session starts from the checkpoint's state
- **Branch navigation** — `/session` history can restore any checkpoint
- **Undo on crash** — if pi crashes, the last checkpoint is recoverable

**How it works:** Before each agent turn, creates a git ref `refs/pi-checkpoints/<session-id>-turn-<n>`. The ref captures:
- HEAD commit index tree
- Worktree tree (staged + unstaged changes)
- Untracked files list
- Large file exclusion (>10MB skipped)
- Large directory exclusion (>200 files skipped)

**Why it's critical:** Without this, session fork and branch navigation wouldn't work. Checkpoints are pi's safety net against data loss during long sessions.

---

### 2. context-pruning

**Files:** `session-lifecycle/context-pruning/` (24 files, 2,137 lines, 4 test files)

**What it does:** Intelligently removes obsolete messages from context before each LLM call. Prunes on the `context` event, before the context is sent to the model. Rules:

| Rule | What it does |
|------|-------------|
| **Deduplication** | Removes duplicate assistant messages (e.g. repeated tool results) |
| **Superseded writes** | Removes older edits/writes to the same file — only keeps the latest |
| **Error purging** | Removes resolved errors from context once the fix is applied |
| **Tool pairing** | Ensures tool_call + tool_result pairs stay intact (removes orphans) |
| **Recency** | Protects the last N messages from pruning |

**Why it's critical:** Without pruning, context fills up with noise (duplicate outputs, stale errors, overwritten file versions). The agent loses ability to work effectively as the session grows. context-pruning is the automated solution to context pollution.

---

### 3. auto-compact

**Files:** `session-lifecycle/auto-compact/` (2 files, 407 lines)

**What it does:** Triggers context compaction when usage exceeds a threshold (default 80%). Monitors `turn_end` events and checks context usage:

1. Waits for at least N messages (default 10) before considering compaction
2. Checks if context usage % exceeds threshold
3. Calls `ctx.compact()` with instructions to preserve recent changes and key decisions

**Config:** Threshold and message count configurable via `compact-config`.

**Relationship with context-pruning:** Complementary. context-pruning prunes individual messages. Auto-compact summarizes the remaining context into a compressed version. Both reduce token usage.

**Why it's valuable:** Without auto-compact, long sessions hit context limits and the agent loses history. Manual compaction via `/compact` is possible but easy to forget.

---

### 4. agent-guidance

**Files:** `session-lifecycle/agent-guidance/agent-guidance.ts` (147 lines) + 3 template files

**What it does:** Injects model-specific guidance files into the agent's context based on the active provider. On `session_start`, checks the current model and injects the matching file:

| Provider | File injected |
|----------|---------------|
| Anthropic | `templates/CLAUDE.md` |
| OpenAI Codex | `templates/CODEX.md` |
| Google Gemini | `templates/GEMINI.md` |

Each file contains behavior instructions tailored to that model's strengths and weaknesses.

**Why it's critical:** Different models need different instructions. Claude benefits from different prompting than Gemini. Without this, the agent uses generic guidance that doesn't optimize for the active model.

---

### 5. skill-args

**Files:** `session-lifecycle/skill-args/` (2 files, 213 lines)

**What it does:** Provides `$1`, `$2`, `$ARGUMENTS` variable substitution in skill bodies. When a skill is invoked, the arguments after `/skill:` are parsed and substituted into the skill's context.

**Before substitution:** `"Create a file called $1 with content $2"`
**After substitution:** `"Create a file called hello.txt with content world"`

**Why it's critical:** Without this, skills can't accept parameters. Every skill would be a fixed template with no user input. This is the mechanism that makes skills programmable.

---

## 🟡 Tier 2 — Session Quality of Life (keep)

These improve the session experience. Removing any would be noticeable but not breaking.

---

### 6. notifications

**Files:** `session-lifecycle/notifications.ts` (206 lines)

**What it does:** Background task completion alerts. When a long-running agent task completes while the terminal is backgrounded:

- **Beep** — plays a system sound (configurable: Tink, Basso, Pop, etc.)
- **Focus** — brings the terminal window to the front
- **Speech** — speaks a completion message via macOS `say` command (e.g. "Task completed")

**Commands:**
| Command | Effect |
|---------|--------|
| `/notify-beep` | Toggle beep |
| `/notify-focus` | Toggle auto-focus |
| `/notify-say` | Toggle speech |
| `/notify-status` | Show current settings |
| `/notify-sounds` | Pick a beep sound |
| `/notify-message` | Customize speech message |

**Pronunciations:** Loads from `~/Library/Speech/Pronunciations.plist` for correct pronunciation of technical terms.

**Why it's valuable:** Long-running tasks (minutes+) are common. Without notifications, you'd have to keep the terminal focused and watch for completion.

---

### 7. handoff

**Files:** `session-lifecycle/handoff.ts` (150 lines)

**What it does:** Provides the `/handoff <prompt>` command that generates a focused context summary for handing off to a new session. Useful when:

- Context is getting full and you want a fresh session
- You want to share context with a colleague (or another agent instance)
- You're switching to a different model and need to port context

**Output:** Creates a structured summary with:
- Project context
- Current task state
- Key decisions made
- Unresolved items
- File changes in progress

**Why it's valuable:** Long sessions accumulate context. Instead of losing everything on `/new`, you can generate a handoff summary and paste it into the new session.

---

### 8. session-name

**Files:** `session-lifecycle/session-name/session-name.ts` (51 lines)

**What it does:** Automatically names sessions from the first user message. On `session_start`, waits for the first `input` event, extracts the first meaningful line, and sets it as the session title.

**Before:** `"Session 019de18e-57f3-731c-8f77-d55228c70982"`
**After:** `"Fix login bug in auth middleware"`

**Why it's valuable:** Named sessions are recognizable in `/session` history. Without this, all sessions look identical (UUIDs).

---

### 9. token-rate

**Files:** `session-lifecycle/token-rate/` (2 files, 159 lines, 1 test file)

**What it does:** Displays tokens-per-second output rate in the footer widget. Tracks:

- Tokens generated per turn
- Elapsed time per turn
- Running average TPS across turns
- 1 test file

**Why it's valuable:** Helps the user understand model performance. Slow TPS might indicate provider congestion or a heavy model. Useful feedback without being critical.

---

### 10. usage-extension

**Files:** `session-lifecycle/usage-extension/` (3 files, 1,447 lines)

**What it does:** Token and cost tracking dashboard. Provides:

| Command | What it shows |
|---------|---------------|
| `/usage` | Dashboard: tokens used, cost, API calls per session |
| `/cost` | Spending report across sessions |
| `ctrl+u` | Quick usage toggle |

**Internals:** Parses session log files (`session.jsonl`) to extract API usage events. Tracks per-session cumulative stats and persists across sessions.

**Why it's valuable:** Without this, you have no visibility into token consumption or API costs. Essential for monitoring spending, especially with paid API providers.

---

### 11. session-recap

**Files:** `session-lifecycle/session-recap/index.ts` (570 lines)

**What it does:** Shows a one-line session summary when you refocus the terminal (switch back to it). Also provides `/recap` for a full recap.

**The one-liner includes:**
- Session name
- How many turns elapsed
- Recent tool calls
- Current task state

**Why it's valuable:** When you switch away from pi and come back, it's easy to forget where you were. The recap gives you instant context without scrolling through history.

---

## 🟢 Tier 3 — Optional (small, harmless)

These are tiny extensions that add minor convenience. None are large enough to worry about.

---

### 12. compact-config

**Files:** `session-lifecycle/auto-compact/compact-config.ts` (344 lines)

**What it does:** Provides the `/compact-config` command — an interactive TUI for configuring per-model compaction thresholds. Shows all available models with their context window sizes and lets you set custom thresholds per model.

**Why it's optional:** The default auto-compact settings (80% threshold, 10 message minimum) work fine for most users. This is a power-user configuration tool.

---

### 13. tab-status

**Files:** `session-lifecycle/tab-status/tab-status.ts` (179 lines)

**What it does:** Sets the terminal tab title to show session status. The title changes based on agent state:

| State | Tab title |
|-------|-----------|
| Idle | `pi — <session-name>` |
| Working | `pi ⏳ <session-name>` |
| Done | `pi ✅ <session-name>` |
| Stuck | `pi ❌ <session-name>` |
| Timed out | `pi ⏰ <session-name>` |

**Why it's optional:** Useful if you have many terminal tabs and want to see pi's status at a glance. Minor UX polish.

---

### 14. session-style

**Files:** `session-lifecycle/session-style.ts` (481 lines)

**What it does:** Two cosmetic features:

**Session Emoji:** Auto-assigns a random emoji to each session for visual identification in the status bar. Modes:
- `immediate` — assign on session start
- `delayed` — assign after N messages (so you can pick your own first)

**Session Color:** Assigns a distinct ANSI 256-color band to each session's footer, rotating through a 40-color palette.

**Why it's optional:** Pure visual branding. Makes sessions visually distinct at a glance. Zero functional impact.

---

### 15. startup-header

**Files:** `session-lifecycle/startup-header.ts` (383 lines)

**What it does:** Custom welcome header with ASCII art branding on session start. Replaces the default pi startup message with a styled header showing:

- pi-me ASCII logo
- Version info
- Quick command references

**Why it's optional:** Pure visual polish. The startup header has no functional effect on the session.

---

### 16. warp-notify

**Files:** `session-lifecycle/warp-notify/` (4 files, 450 lines)

**What it does:** Warp terminal-specific OSC 777 structured notifications. When running inside Warp terminal, sends structured notification escape sequences on lifecycle events (session start, agent end, errors).

**Why it's optional:** Only works in Warp terminal. In any other terminal (iTerm2, Terminal.app, tmux), it silently does nothing.

---

## Summary

| # | Extension | Lines | Tests | Tier | Keep? |
|---|-----------|-------|-------|------|-------|
| 1 | **checkpoint** | 2,285 | 1 | 🔴 Infrastructure | ✅ |
| 2 | **context-pruning** | 2,137 | 4 | 🔴 Infrastructure | ✅ |
| 3 | **auto-compact** | 407 | 0 | 🔴 Infrastructure | ✅ |
| 4 | **agent-guidance** | 147 | 0 | 🔴 Infrastructure | ✅ |
| 5 | **skill-args** | 213 | 0 | 🔴 Infrastructure | ✅ |
| 6 | **notifications** | 206 | 0 | 🟡 Quality | ✅ |
| 7 | **handoff** | 150 | 0 | 🟡 Quality | ✅ |
| 8 | **session-name** | 51 | 0 | 🟡 Quality | ✅ |
| 9 | **token-rate** | 159 | 1 | 🟡 Quality | ✅ |
| 10 | **usage-extension** | 1,447 | 0 | 🟡 Quality | ✅ |
| 11 | **session-recap** | 570 | 0 | 🟡 Quality | ✅ |
| 12 | **compact-config** | 344 | 0 | 🟢 Optional | ✅ small |
| 13 | **tab-status** | 179 | 0 | 🟢 Optional | ✅ small |
| 14 | **session-style** | 481 | 0 | ⚪ Cosmetic | ✅ small |
| 15 | **startup-header** | 383 | 0 | ⚪ Cosmetic | ✅ small |
| 16 | **warp-notify** | 450 | 0 | 🟢 Optional | ✅ small |

**Total:** 16 extensions, ~9,900 lines. All keepers — the Tier 3 ones are tiny enough that removing them saves negligible code.
