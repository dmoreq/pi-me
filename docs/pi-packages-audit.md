# Pi Packages Audit

> Generated: 2026-05-02
> Source: npm registry search `keywords:pi-package` (1968 total, top 250 analyzed)
> Branches: `adopt-tools`
> **Updated:** pi-markdown-preview, pi-studio, feynman, context-mode — all adopted 2026-05-02
> **See:** [Adoption plan](plans/2026-05-02-adopt-top-5-packages-perf-optimized.md)

## Legend

| Icon | Meaning |
|------|---------|
| ✅ Already adopted | pi-me already has this or equivalent |
| ⚠️ Partial overlap | Some overlap but different approach |
| 🔥 High value | Not in pi-me, significant capability gap |
| 👍 Good value | Not in pi-me, useful niche |

---

## Already Covered in pi-me

| Package | Version | Publisher | pi-me Equivalent |
|---------|---------|-----------|------------------|
| `pi-subagents` | 0.21.5 | nicopreme | `core-tools/subagent/` ✅ |
| `@tintinweb/pi-subagents` | 0.6.3 | tintinweb | `core-tools/subagent/` ✅ |
| `@tmustier/pi-ralph-wiggum` | 0.2.0 | tmustier | `core-tools/ralph-loop/` ✅ |
| `@phiffer/pi-subagents` | 0.2.4 | phiffer | `core-tools/subagent/` ✅ |
| `pi-faithless-subagents` | 0.1.9 | faithless | `core-tools/subagent/` ✅ |
| `pi-web-access` | 0.10.6 | nicopreme | `core-tools/web-search.ts` + `content-tools/web-fetch/` ✅ |
| `@ollama/pi-web-search` | 0.0.5 | parthollama | `core-tools/web-search.ts` + `content-tools/web-fetch/` ✅ |
| `pi-smart-fetch` | 0.2.35 | GitHub Actions | `content-tools/web-fetch/` ✅ |
| `pi-btw` | 0.3.8 | GitHub Actions | `core-tools/btw/` ✅ |
| `@juicesharp/rpiv-btw` | 1.0.14 | juicesharp | `core-tools/btw/` ✅ |
| `@juicesharp/rpiv-todo` | 1.0.14 | juicesharp | `core-tools/todo/` ✅ |
| `@juicesharp/rpiv-ask-user-question` | 1.0.14 | juicesharp | `core-tools/ask-user-question/` ✅ |
| `@juicesharp/rpiv-web-tools` | 1.0.14 | juicesharp | web-search + web-fetch ✅ |
| `@juicesharp/rpiv-advisor` | 1.0.14 | juicesharp | `core-tools/oracle.ts` (similar) ✅ |
| `@juicesharp/rpiv-pi` | 1.0.14 | juicesharp | skill-based workflow (overlap) ✅ |
| `pi-mermaid` | 0.3.0 | gurpartap | `content-tools/mermaid.ts` ✅ |
| `pi-amplike` | 1.3.6 | pasky | handoff, permission, session-lifecycle covered ✅ |
| `@pi-unipi/ask-user` | 0.1.11 | neuron-mr-white | `core-tools/ask-user-question/` ✅ |
| `pi-markdown-preview` | 0.9.7 | omacl | `content-tools/pi-markdown-preview/` ✅ |
| `pi-studio` | 0.6.9 | omacl | `content-tools/pi-studio/` ✅ |
| `@companion-ai/feynman` | 0.2.40 | GitHub Actions | `content-tools/feynman/` ✅ |
| `context-mode` | 1.0.103 | mksglu | `content-tools/context-mode/` ✅ |
| `pi-powerline-footer` | 0.4.20 | nicopreme | `session-lifecycle/tab-status` ⚠️ |
| `pi-prompt-template-model` | 0.9.3 | nicopreme | `session-lifecycle/preset` ⚠️ |
| `pi-capitals-context` | 1.5.0 | salem-malibary | `foundation/extra-context-files.ts` ⚠️ |

---

## 🔥 High Value — Worth Adopting

### 1. `pi-lens` v3.8.34 — **#1 Priority**
- **Publisher:** apmantza
- **Description:** Real-time code feedback for pi — LSP, linters, formatters, type-checking, structural analysis & booboo
- **Why:** Completely unique capability not in pi-me. Integrates biome, ast-grep, ruff, TypeScript type-coverage, knip (dead code), jscpd (copy-paste detection). Would drastically improve code quality feedback during development.
- **Keywords:** linter, biome, ast-grep, ruff, typescript, code-quality, type-coverage, jscpd, knip
- **Considerations:** Large package (3.x, actively maintained), may have many dependencies

### 2. `pi-mcp-adapter` v2.5.3 — **#2 Priority**
- **Publisher:** nicopreme
- **Description:** MCP (Model Context Protocol) adapter extension for Pi coding agent
- **Why:** Opens access to the entire MCP ecosystem (hundreds of tools/servers). pi-me has no MCP support. Essential for interoperability — MCP is the standard protocol for AI agent tools.
- **Keywords:** mcp, model-context-protocol
- **Considerations:** From same publisher as pi-subagents (nicopreme), well-maintained

### 3. `@samfp/pi-memory` v1.0.2 — **#3 Priority**
- **Publisher:** samfp
- **Description:** Persistent memory for pi — learns corrections, preferences, and patterns from sessions and injects them into future conversations
- **Why:** pi-me has no persistent cross-session memory. Learns from user corrections and automatically reinjects preferences into new sessions. Would make pi-me feel "smarter" over time.
- **Keywords:** memory, learning, preferences
- **Considerations:** Relatively new (v1.0.2), may need evaluation for stability

### 4. `pi-docparser` v1.1.1 — **#4 Priority**
- **Publisher:** maxedapps
- **Description:** Pi package that adds a document_parse tool and companion skill for parsing PDFs, Office documents, spreadsheets, and images with LiteParse
- **Why:** pi-me has no document parsing. Directly useful for parsing PDFs, .docx, .xlsx, and images in everyday coding work.
- **Keywords:** document parsing, pdf, office, spreadsheet, image
- **Considerations:** Uses LiteParse (third-party API?), check if it requires API key

### 5. `@plannotator/pi-extension` v0.19.6 — **#5 Priority**
- **Publisher:** backnotprop
- **Description:** Plannotator extension for Pi coding agent — interactive plan review with visual annotation
- **Why:** pi-me has `plan-tracker` and `plan-mode` but they're bare-bones. This is a full interactive plan review with visual annotation UI. Complements planning tools.
- **Keywords:** plannotator, plan-review, visual annotation
- **Considerations:** Well-maintained (0.19.x), active development

### 6. `pi-gsd` v2.1.4
- **Publisher:** fulgidus
- **Description:** "Get Shit Done" — Unofficial port of the renowned AI-native project-planning spec-driven toolkit
- **Why:** Spec-driven development workflow with structured milestones and phases. Different approach from current plan tools — more structured/spec-first methodology.
- **Keywords:** planning, spec-driven, milestones, phases

### 7. ~~`pi-markdown-preview`~~ ✅ ADOPTED
### 8. ~~`pi-studio`~~ ✅ ADOPTED
### 9. ~~`@companion-ai/feynman`~~ ✅ ADOPTED

### 10. ~~`context-mode`~~ ✅ ADOPTED

### 11. `context-mode` v1.0.103
- **Publisher:** mksglu
- **Description:** MCP plugin that saves 98% of your context window. Works with Claude Code, Gemini CLI, etc. Sandboxed code execution, FTS5 knowledge base, and intent-driven search.
- **Why:** Context window optimization via MCP. Could complement pi-me's own `context-window` extension. Also provides sandboxed code execution and knowledge base.
- **Considerations:** MCP-based (requires MCP adapter if pi-me doesn't natively support MCP), very active (1.0.103)

---

## 👍 Good Value / Niche

| Package | Version | Publisher | Description | Notes |
|---------|---------|-----------|-------------|-------|
| `taskplane` | 0.28.4 | henrylach | AI agent orchestration with parallel task execution & checkpoint discipline | Complements subagent |
| `@feniix/pi-notion` | 2.2.2 | feniix | Notion API — read, search, manage pages/databases | Useful if you use Notion |
| `pi-zotero` | 0.1.0 | fywang96 | Zotero library search, citation export, PDF annotation | Academic use |
| `@aliou/pi-processes` | 0.8.1 | aliou | Process management — run, monitor, background jobs | Sysadmin use |
| `pi-link` | 0.1.11 | alvivar | WebSocket inter-terminal communication | Multi-window workflows |
| `pi-formatter` | 1.1.2 | GitHub Actions | Auto-formats files on save/write | Quality-of-life |
| `pi-vim` | 0.3.2 | GitHub Actions | Vim-style modal editing for TUI editor | If you use vim keybindings |
| `@touchskyer/memex` | 0.1.32 | touchskyer | Zettelkasten-based agent memory | Alternative to pi-memory |
| `pi-thinking-steps` | 1.0.8 | fluxgear | Renders thinking steps in TUI | Visual polish |
| `pi-crew` | 0.1.41 | bom0792 | Coordinated AI teams, workflows, worktrees | Alternative subagent approach |
| `pi-mempalace-extension` | 0.2.0 | auda29 | Memory palace integration | Niche memory technique |
| `whatsapp-pi` | 1.0.43 | castelloes | WhatsApp integration | Chat integration |
| `@0xkobold/pi-gateway` | 0.6.0 | moikapy | Hermes-style messaging gateway | Multi-platform agent |
| `pi-schedule-prompt` | 0.2.0 | tintinweb | Cron-like scheduled prompts | Automation |
| `pi-dingtalkbot` | 1.0.7 | huang.xinghui | 钉钉智能机器人 (DingTalk robot) | China ecosystem |
| `pi-answer` | 0.1.4 | siddr | Interactive Q&A extraction | Specific use case |
| `pi-edit-session-in-place` | 0.1.8 | fitchmultz | Re-edit/delete earlier user messages | Session editing |
| `@fitchmultz/pi-stash` | 0.1.9 | fitchmultz | Stash draft messages, restore later | Draft management |
| `dripline` | 0.9.12 | miclivs | "Query anything, one drip at a time" | Generic query tool |
| `@spences10/pi-lsp` | 0.0.9 | spences10 | LSP diagnostics, hover, definition, references | Lighter alternative to pi-lens |
| `pi-local-agents-only` | 0.1.13 | fitchmultz | Strip global AGENTS.md/CLAUDE.md per project | Scope control |
| `@alexanderfortin/pi-loaded-tools` | 0.4.4 | GitHub Actions | List loaded tools with source provenance | Debugging |
| `pi-oracle` | 0.6.13 | fitchmultz | ChatGPT web-oracle with browser auth | Web-based AI oracle |
| `@apmantza/greedysearch-pi` | 1.8.5 | apmantza | Multi-engine AI search via browser automation | No API keys needed |
| `oh-pi` | 0.1.85 | telagod | One-click pi setup (oh-my-zsh for pi) | For new users only |
| `@leing2021/super-pi` | 0.23.4 | leing2023 | Compound Engineering package | Workflow collection |

---

## 📊 Summary

| Tier | Count | Examples |
|------|-------|---------|
| Already in pi-me | ~25 | subagents, btw, todo, web-fetch, oracle, etc. |
| 🔥 **High value to adopt** | **10** | pi-lens, pi-mcp-adapter, pi-memory, pi-docparser, plannotator, pi-gsd, pi-markdown-preview, pi-studio, feynman, context-mode |
| 👍 Good value / Niche | ~25 | taskplane, pi-notion, pi-link, pi-formatter, pi-vim, etc. |

### Recommended adoption order

1. **`pi-lens`** — Biggest day-to-day impact (code feedback)
2. **`pi-mcp-adapter`** — Ecosystem multiplier (access MCP tools)
3. **`@samfp/pi-memory`** — Persistent learning across sessions
4. **`pi-docparser`** — Parse PDFs, docs, spreadsheets
5. **`@plannotator/pi-extension`** or **`pi-gsd`** — Better planning tools

---

*End of audit*
