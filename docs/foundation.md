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

### `safe-ops` — Git Safety + Safe Deletion
**Trigger:** 🔄 Hook (`tool_call`, `session_start`) + ⌨️ `/safegit*`, `/saferm*`

Intercepts dangerous git/gh commands (force push, hard reset, rebase) requiring approval. Replaces `rm` with macOS `trash`. Configurable risk levels.

### `pi-config` — JSONC Config Utility
**Trigger:** — (library)

Shared configuration loader used by `extra-context-files`, `file-collector`, `files`, `preset`, and `sub-pi`. Reads `.jsonc` config files from the pi agent directory.

### `extra-context-files` — Auto-Load Context Files
**Trigger:** 🔄 Hook (`session_start`, `before_agent_start`)

Reads `AGENTS.local.md` and `CLAUDE.local.md` from the project root and injects them into the initial context automatically. Zero-config — just drop those files in your project.

---


---

**See also:** [Intro](intro.md) · [Foundation](foundation.md) · [Session Lifecycle](session-lifecycle.md) · [Core Tools](core-tools.md) · [Content Tools](content-tools.md) · [Authoring](authoring.md) · [Skills](skills.md)
