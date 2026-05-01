# Foundation Layer

Always-active safety guards, diagnostics, and context management. These extensions load first and run on every session.

---

## Extensions

### Secrets

**Source:** `foundation/secrets/secrets.ts`
**Trigger:** Hook (`tool_result`, `context`, `session_start`)

Scans all tool output and context blocks for sensitive values — API keys, tokens, passwords — and obfuscates them automatically
before they reach the LLM. Loads patterns from `~/.pi/agent/secrets.yml` (global) and `.pi/secrets.yml` (project-local).

Supports two detection modes:
- **Plain text:** Exact string matching with obfuscation or replacement
- **Regex:** Pattern-based detection with configurable replacement text

### Permission

**Source:** `foundation/permission/permission.ts`
**Trigger:** Hook (`session_start`, `tool_call`) · Command (`/permission`, `/permission-mode`)

Three-layer command safety system:

1. **Hard safety nets:** Always-active patterns blocking destructive operations (`rm -rf /`, `sudo rm`, `curl | bash`)
2. **Tiered levels:** `minimal` → `low` → `medium` → `high` → `bypassed` with progressive access
3. **Enforcement mode:** `ask` (prompt user for approval) or `block` (silently reject)

Classifies every bash command by risk level before execution. In non-interactive mode, blocks all operations above the configured level.

### Context Window

**Source:** `foundation/context-window/context-window.ts`
**Trigger:** Hook (`turn_end`, `session_start`, `session_shutdown`)

Footer widget displaying context usage as a percentage. Color-coded thresholds:
- **<70%:** Normal (success color)
- **70–90%:** Warning (suggests `/compact`)
- **>90%:** Critical (strongly recommends compaction)

Recalculates after every turn.

### Safe Operations

**Source:** `foundation/safe-ops.ts`
**Trigger:** Hook (`tool_call`, `session_start`) · Command (`/safegit`, `/safegit-level`, `/safegit-status`, `/saferm`, `/saferm-toggle`, `/saferm-on`, `/saferm-off`, `/saferm-log`, `/saferm-clearlog`)

Unified protection for two categories of dangerous operations:

**Git/GitHub CLI:** Intercepts push, commit, rebase, merge, hard reset, force push, branch deletion, tag creation, and all `gh` commands. Prompts for user approval with session-level auto-approve/auto-block options. Configurable risk tiers: `high` (only force/hard-reset), `medium` (all state changes), `none` (disabled).

**File deletion:** Intercepts `rm` commands and replaces them with macOS `trash` for safe recovery. Logs all intercepted commands to a debug file.

### Status Widget

**Source:** `foundation/status-widget.ts`
**Trigger:** Hook (`session_start`, `session_shutdown`) · Command (`/status`, `/status-refresh`)

Fetches live status from Anthropic, OpenAI, and GitHub status pages. Displays indicators in the footer:
- ✅ Operational
- ⚠️ Degraded performance
- ❌ Major outage

Refreshes every 5 minutes.

### Extra Context Files

**Source:** `foundation/extra-context-files.ts`
**Trigger:** Hook (`session_start`, `before_agent_start`)

Automatically reads `AGENTS.local.md` and provider-specific guidance files from the project root and injects them into
the initial context. Zero-configuration — add the files to your project and they load on the next session.

---

## Shared Library

### pi-config

**Source:** `shared/pi-config.js`
**Trigger:** Library (no direct activation)

JSONC configuration loader used by multiple extensions (`extra-context-files`, `file-collector`, `files`, `preset`, `sub-pi`).
Reads `.jsonc` config files from the pi agent directory with schema validation and default fallback.

---

**See also:** [Architecture Overview](intro.md) · [Session Lifecycle](session-lifecycle.md) · [Core Tools](core-tools.md) · [Content Tools](content-tools.md) · [Authoring](authoring.md) · [Skills](skills.md)
