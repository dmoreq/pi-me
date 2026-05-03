# foundation/ Extension Explanations

Always-on safety guards and diagnostics. These load first and run for every session.

---

### 1. secrets

**Files:** `foundation/secrets/` (5 files, ~500 lines)

**What it does:** Scans all tool output, context, and messages for credentials (API keys, tokens, passwords) and automatically obfuscates them before they reach the LLM. Prevents the agent from seeing or leaking sensitive values.

**How it works:**
- Loads patterns from `~/.pi/agent/secrets.yml` (or default patterns)
- Scans incoming text for matches against known credential patterns (e.g. `sk-...` for OpenAI keys, `ghp_...` for GitHub tokens)
- Replaces matched values with `[REDACTED]` placeholders
- Loads environment variables at startup and marks them as sensitive

**Why it's critical:** Without this, any API key or token the agent touches (in files, env, output) would be visible to the LLM and could be leaked in responses. This is the first line of defense against credential exposure.

---

### 2. permission

**Files:** `foundation/permission/` (6 files, ~1,500 lines)

**What it does:** Tiered command safety system that blocks or prompts for dangerous operations before they execute. Every bash command is classified into one of five levels:

| Level | Meaning | Examples |
|-------|---------|---------|
| `minimal` | Safe, no prompt | `cat`, `ls`, `grep`, `git status` |
| `low` | Read operations | `head`, `tail`, file reads |
| `medium` | Dev operations | `npm install`, `git commit`, `mkdir` |
| `high` | Destructive | `rm -rf`, `git push --force`, `chmod 777` |
| `bypass` | Admin override | Fully disabled by default |

**Features:**
- Pattern-based classification using regex groups (DangerousFilesystem, InsecurePermissions, PrivilegeEscalation, PipeToShell, GitDestructive, etc.)
- Path protection via glob patterns (blocks `rm -rf ~`, protects `.env` files, SSH keys, lock files)
- Per-session allowed-commands cache (approve once, skip subsequent prompts)
- Configurable via `~/.pi/agent/settings.json`

**Why it's critical:** Without this, any command the agent runs is executed blindly. A miswritten `rm` or `git push --force` could destroy work.

---

### 3. context-window

**Files:** `foundation/context-window/context-window.ts` (~150 lines)

**What it does:** Footer widget showing context usage percentage. Displays a live bar like:

```
Context: ████████░░ 78%
```

**Behavior:**
- Normal operation: shows percentage in footer
- At 70%: yellow warning
- At 90%: red alert
- At 95%+: critical

**Why it's useful:** Helps the user know when compaction is needed before the agent starts losing context. Simple but essential feedback.

---

### 5. safe-ops

**Files:** `foundation/safe-ops.ts` (~400 lines)

**What it does:** Protects against dangerous git, gh, and rm commands. Two subsystems:

**Git/gh protection:**
- Prompts for confirmation on: `push`, `commit`, `rebase`, `merge`, `reset --hard`, `clean -fd`
- Configurable prompt level: `high` (prompt on all), `medium` (prompt on destructive only), `none` (no prompts)

**rm protection:**
- Replaces `rm` with macOS `trash` command automatically
- If `trash` is not available, prompts for confirmation
- Logs all rm operations to a debug file for recovery

**Also handles:**
- Background task notifications (beep, speech, bring-to-front when long tasks complete in background)
- Terminal detection to know when the terminal is backgrounded

**Why it's critical:** `rm` accidents are irreversible. `git push --force` mistakes are painful. This is a safety net that catches the most common destructive commands.

---

### 5. extra-context-files

**Files:** `foundation/extra-context-files.ts` (~150 lines)

**What it does:** Injects additional context files into the agent's system prompt automatically. Checks for:

| File | Purpose |
|------|---------|
| `AGENTS.local.md` in project root | Project-specific agent instructions |
| `CLAUDE.md` in project root | Anthropic-specific guidance |
| `CODEX.md` in project root | OpenAI Codex-specific guidance |
| `GEMINI.md` in project root | Google Gemini-specific guidance |

Files are loaded in this priority order. The first existing file matching the current provider is injected.

**Why it's useful:** Lets users define project-level rules (e.g. "always use tabs", "never modify tests") without modifying pi's configuration. The agent reads these automatically on every session start.

---

## Summary

| # | Extension | Lines | Tests | Purpose |
|---|-----------|-------|-------|---------|
| 1 | **secrets** | ~500 | 1 | Credential obfuscation |
| 2 | **permission** | ~1,500 | 4 | Command safety tiers + path protection |
| 3 | **context-window** | ~150 | 0 | Context usage footer bar |
| 4 | **safe-ops** | ~400 | 0 | Git/gh/rm safety + background notify |
| 5 | **extra-context-files** | ~150 | 0 | Auto-inject project AGENTS.md |

All 5 are Tier 1 (Agent-Critical or Foundation). The entire `foundation/` directory is always-on security and diagnostics — nothing here is optional.
