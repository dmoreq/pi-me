# Adopted Plugin Inline Review

**Goal:** Evaluate each adopted npm package for potential inlining — copying the raw source code into `pi-me` directly, removing the npm dependency, and optimizing the core logic.

**Rationale:** Reduce external dependencies, eliminate `npm install` friction, enable direct code optimization, and remove the wrapper layer.

---

## How to read this document

Each plugin has a complexity tier:

| Tier | Meaning | Typical Effort |
|------|---------|---------------|
| 🟢 **Tiny** | 1–9 files, 0–1 deps | 1–2 hours |
| 🟡 **Small** | 10–60 files, 2–4 deps | 2–4 hours |
| 🟠 **Medium** | 20–200 files, 1–5 deps | 4–8 hours |
| 🔴 **Large** | 35+ files, heavy SDKs | 1–3 days |
| 🟣 **Massive** | 1000+ files, 5+ heavy deps | Not recommended |

After the details, there's a **recommendation table** with a go/no-go recommendation per plugin.

---

## 🟢 Tiny (Recommended for inlining)

### 1. `@fitchmultz/pi-stash` — Draft Stash

| Field | Value |
|-------|-------|
| **Wrappers** | `core-tools/pi-stash/index.ts` (4 lines) |
| **Source files** | `extensions/stash.ts` + `extensions/state.ts` = **2 files** |
| **Source lines** | ~500 (stash.ts: ~400 loc, state.ts: ~100 loc) |
| **npm dep** | 32K disk |
| **Dependencies** | None (uses pi-coding-agent + pi-tui peer deps) |
| **Import path** | `@fitchmultz/pi-stash/extensions/stash.ts` |

**What it does:**
- Register `ctrl+shift+s` shortcut to stash editor draft
- Register `ctrl+shift+r` to restore or pick from multiple drafts
- Register `/stash` and `/stash-list` commands
- Persist stash state via `pi.appendEntry` (survives session branching)
- Pure helpers: `isBlankDraft`, `pushDraft`, `removeDraftAt`, `previewDraft`, `hydrateState`

**Code structure:**
```
stash.ts     → extension entry: shortcuts, commands, draft picker UI (~400 loc)
state.ts     → pure helpers: stack logic, state hydration, previews (~100 loc)
```

**Inline effort:** Low. Copy both files into `core-tools/pi-stash/`, update the import paths. The state helpers are self-contained. The UI code is standard pi API calls.

---

### 2. `pi-edit-session-in-place` — Re-Edit Messages

| Field | Value |
|-------|-------|
| **Wrappers** | `core-tools/pi-edit-session/index.ts` (4 lines) |
| **Source files** | `extensions/edit-session-in-place.ts` = **1 file** |
| **Source lines** | ~615 loc |
| **npm dep** | 40K disk |
| **Dependencies** | None (peer: pi-coding-agent + pi-tui) |
| **Import path** | `pi-edit-session-in-place/extensions/edit-session-in-place.ts` |

**What it does:**
- `/edit-turn` command to pick a previous user message from branch history
- `ctrl+shift+e` hotkey in the main editor
- External editor support (`$VISUAL` / `$EDITOR`)
- Navigates session tree to rewind to the selected point
- Handles images, deletions, and draft backup

**Code structure:**
```
edit-session-in-place.ts → all logic in one file (~615 loc)
```

**Key exports (testable pure functions):**
- `resolveExternalEditorCommand(env)` — resolve `$VISUAL` / `$EDITOR`
- `parseExternalEditorCommand(command)` — shell-parse editor command
- `trimSingleTrailingNewline(text)` — clean up editor output
- `extractEditableText(content)` — extract text + image flag from message content
- `extractUserMessages(entries)` — filter & sort branch entries
- `EditableUserMessage` type — the message selector model

**Inline effort:** Low. One file, all pi API calls. Copy into `core-tools/pi-edit-session/`.

---

### 3. `pi-link` — WebSocket Inter-Terminal Communication

| Field | Value |
|-------|-------|
| **Wrappers** | `core-tools/pi-link/index.ts` (4 lines) |
| **Source files** | `index.ts` = **1 file** |
| **Source lines** | ~1,482 loc |
| **npm dep** | 128K disk |
| **Dependencies** | `ws` (WebSocket library) |
| **Import path** | `pi-link` (index.ts exports default) |

**What it does:**
- WebSocket hub/client architecture for multi-terminal pi
- Tools: `link_send`, `link_prompt`, `link_list`
- Commands: `/link`, `/link-name`, `/link-broadcast`, `/link-connect`, `/link-disconnect`
- Auto-promotion of surviving client when hub disconnects
- Reconnect logic, keepalive, batching
- Ships a `skills/` directory

**Code structure:**
```
index.ts → single file, all logic (~1,482 loc)

Protocol messages (10 types):
  register, welcome, terminal_joined, terminal_left,
  chat, prompt_request, prompt_response,
  status_update, signal, file
```

**Key complexity factors:**
- WebSocket state machine (hub vs client roles)
- Concurrent connection management
- Prompt forwarding with timeout/ceiling
- Binary protocol with batching
- Depends on `ws` (~80K, 18MB native deps) — inlining means keeping `ws` or replacing with Node's built-in `WebSocket` (Node 18+)

**Inline effort:** Medium. Single file but large. The `ws` dependency can potentially be replaced with Node's built-in `WebSocket` class, which would eliminate the only npm dependency entirely. Skills directory would need to stay.

---

### 4. `@samfp/pi-memory` — Persistent Memory

| Field | Value |
|-------|-------|
| **Wrappers** | `core-tools/pi-memory/index.ts` (26 lines with config) |
| **Source files** | `src/` = **8 files** |
| **Source lines** | ~2,024 loc |
| **npm dep** | 112K disk |
| **Dependencies** | None (uses `node:sqlite`, pi-coding-agent, typebox) |
| **Import path** | `@samfp/pi-memory` (src/index.ts exports default) |

**What it does:**
- SQLite-backed memory store using Node's built-in `node:sqlite`
- Three tables: `semantic` (key-value facts), `lessons` (learned corrections), `events` (audit log)
- FTS5 full-text search (optional, falls back to substring search)
- Selective context injection into system prompt (search-based, not prefix)
- Session consolidation: LLM-driven extraction of preferences/projects/lessons
- Tools: `memory_search`, `memory_remember`, `memory_forget`, `memory_lessons`, `memory_stats`

**Code structure:**
```
src/index.ts         → extension entry: tools, commands, lifecycle hooks (~450 loc)
src/store.ts         → MemoryStore: SQLite CRUD, search, FTS5 triggers (~650 loc)
src/injector.ts      → context block builder: selective search + lesson injection (~400 loc)
src/consolidator.ts  → LLM consolidation: extraction logic + prompt templates (~500 loc)
src/bootstrap.ts     → CLI bootstrap tool: reads session index, batch LLM calls (~200 loc)
src/store.test.ts    → store unit tests
src/injector.test.ts → injector unit tests
src/consolidator.test.ts → consolidator unit tests
```

**Inline effort:** Medium-high. 8 source files, but all are TypeScript and well-structured. Uses `node:sqlite` (built-in, no dep). The consolidation logic calls an LLM through `pi` CLI — could be optimized to use the pi SDK directly. Tests exist.

---

### 5. `pi-markdown-preview` — Markdown Rendering

| Field | Value |
|-------|-------|
| **Wrappers** | `content-tools/pi-markdown-preview/index.ts` (4 lines) |
| **Source files** | 1 TS + 2 JS files |
| **Source lines** | ~3,729 TS + ~936 JS |
| **npm dep** | 2.3M disk |
| **Dependencies** | `puppeteer-core` (Chrome/Puppeteer for rendering) |
| **Import path** | `pi-markdown-preview` |

**What it does:**
- Renders markdown + LaTeX to terminal, browser, or PDF
- Launches Chrome via puppeteer-core for full rendering
- Terminal fallback with ANSI formatting

**Key consideration:** The `puppeteer-core` dependency (~30MB with Chrome) is the bulk. Inlining the source removes the npm package reference but `puppeteer-core` must remain as a dependency unless we replace it with something lighter (e.g., `marked` + terminal renderer).

---

### 6. `pi-docparser` — Document Parsing

| Field | Value |
|-------|-------|
| **Wrappers** | `content-tools/pi-docparser/index.ts` (4 lines) |
| **Source files** | `extensions/docparser/` = **9 files** |
| **Source lines** | ~1,791 loc |
| **npm dep** | 196K disk |
| **Dependencies** | `@llamaindex/liteparse` |
| **Import path** | `pi-docparser` |

**Code structure:**
```
extensions/docparser/
  index.ts      → entry (9 lines)
  types.ts      → type definitions (99 lines)
  schema.ts     → tool parameter schemas (82 lines)
  constants.ts  → constants (62 lines)
  request.ts    → HTTP request helpers (67 lines)
  input.ts      → file input handling (230 lines)
  tool.ts       → tool registration + execution (305 lines)
  doctor.ts     → dependency check / diagnostics (353 lines)
  deps.ts       → dependency resolution + system check (584 lines)
```

**What it does:**
- Parse PDF, Office docs, spreadsheets, images via LiteParse API
- Tool: `parse_document`
- Command: `/doctor` for dependency status
- System dep check: LibreOffice, ImageMagick, Ghostscript

**Key consideration:** Depends on `@llamaindex/liteparse` for actual document parsing. Inlining the wrapper is easy but LiteParse remains as a dependency.

---

## 🟡 Small

### 7. `@apmantza/greedysearch-pi` — AI Search

| Field | Value |
|-------|-------|
| **Source files** | 10 TS files |
| **Source lines** | ~1,105 loc |
| **npm dep** | 324K |
| **Dependencies** | `jsdom`, `@mozilla/readability`, `turndown` |
| **Import path** | `@apmantza/greedysearch-pi` |

**What it does:** Multi-engine AI search via browser automation (Perplexity, Bing Copilot, Google AI Studio). No API keys needed. Uses headless browser detection with jsdom.

**Inline effort:** Medium. 10 files, but dependencies (jsdom, readability, turndown) are sizable. The browser automation logic is nuanced.

---

### 8. `pi-formatter` — Auto-Format on Save

| Field | Value |
|-------|-------|
| **Source files** | 20 TS files |
| **Source lines** | ~2,021 loc |
| **npm dep** | 124K |
| **Dependencies** | None |
| **Import path** | `pi-formatter` |

**Code structure:**
```
extensions/
  index.ts              → entry (~50 loc)
  formatter/
    config.ts            → config loading/saving
    dispatch.ts          → runner dispatch logic
    dispatcher/          → multiple runner implementations
    path.ts              → path resolution
    runners/             → formatter runners (prettier, eslint, etc.)
```

**What it does:** Auto-formats files on save/write. Has configurable runners, scope filtering, path resolution. Zero runtime dependencies (all formatting is done via CLI tools like Prettier, ESLint).

**Inline effort:** Medium-low. 20 files but all TypeScript, zero dependencies. Well-structured with clear separation.

---

### 9. `pi-studio` — Browser Workspace

| Field | Value |
|-------|-------|
| **Source files** | 1 TS + 6 JS files |
| **Source lines** | ~9,746 TS + ~13,056 JS |
| **npm dep** | 8.2M |
| **Dependencies** | `ws` (WebSocket) |
| **Import path** | `pi-studio` |

**What it does:** Two-pane browser workspace for prompt/response editing, annotations, critiques, history. Includes a full WebSocket server and browser-based UI.

**Inline effort:** Medium-high. The 13K JS lines are likely a bundled frontend. The TS source has the WebSocket server, file watcher, and pi integration.

---

## 🟠 Medium

### 10. `@touchskyer/memex` — Zettelkasten Memory

| Field | Value |
|-------|-------|
| **Source files** | 1 TS + 2 JS files |
| **Source lines** | ~1,572 TS + ~45,868 JS |
| **npm dep** | 4.6M |
| **Dependencies** | MCP SDK, commander, gray-matter, zod |
| **Import path** | `@touchskyer/memex/pi-extension/index.ts` |

**What it does:** Zettelkasten-based agent memory with bidirectional links. Heavy MCP SDK dependency.

**Inline effort:** Risky. The 45K JS lines include bundled dependencies (MCP SDK). Inlining just the 1.5K TS wrapper is easy, but the MCP SDK stays.

---

### 11. `pi-crew` — AI Teams

| Field | Value |
|-------|-------|
| **Source files** | 194 TS files |
| **Source lines** | ~20,212 loc |
| **npm dep** | 2.4M |
| **Dependencies** | cli-highlight, diff, jiti, typebox |
| **Import path** | `pi-crew` |

**What it does:** Coordinated AI teams, workflows, worktrees, async task orchestration. Considerable amount of orchestration logic.

**Inline effort:** High. 194 files, 20K lines of TypeScript. Not recommended for inlining.

---

## 🔴 Large (Not recommended for inlining)

### 12. `pi-lens` — Code Feedback (LSP)

| Field | Value |
|-------|-------|
| **Source files** | 184 TS + 5 JS |
| **Source lines** | ~51,064 TS + ~984 JS |
| **npm dep** | 3.0M |
| **Dependencies** | `typescript`, `@ast-grep/napi`, minimatch, typebox, vscode-jsonrpc |
| **Import path** | `pi-lens` |

**Why not:** Depends on the TypeScript compiler (~50MB) and ast-grep native binary. 184 files of complex LSP integration. Inlining adds massive maintenance burden.

---

### 13. `@aliou/pi-processes` — Process Management

| Field | Value |
|-------|-------|
| **Source files** | 59 TS files |
| **Source lines** | ~6,407 loc |
| **npm dep** | 352K |
| **Dependencies** | @aliou/pi-utils-settings, @aliou/pi-utils-ui, @aliou/sh, typebox |
| **Import path** | `@aliou/pi-processes` |

**Why consider:** 59 files but only 6.4K lines. Has 4 utility deps that could also be inlined. Full process lifecycle management.

**Inline effort:** Medium-high. The scope (run, list, stop bg processes) is well-defined but 59 files is significant.

---

### 14. `pi-mcp-adapter` — MCP Server Bridge

| Field | Value |
|-------|-------|
| **Source files** | 35 TS + 2 JS |
| **Source lines** | ~67,422 TS + 35,272 JS |
| **npm dep** | 11M |
| **Dependencies** | MCP SDK, ext-apps, pi-ai, typebox, open, zod |
| **Import path** | `pi-mcp-adapter` |

**Why not:** 67K lines TS + 35K lines JS. Heavy MCP SDK dependency. The MCP protocol is complex and rapidly evolving.

---

### 15. `pi-thinking-steps` — TUI Thinking Display

| Field | Value |
|-------|-------|
| **Source files** | 7 TS files |
| **Source lines** | ~59,535 loc |
| **npm dep** | 11M |
| **Dependencies** | pi-ai, pi-coding-agent, pi-tui |
| **Import path** | `pi-thinking-steps` |

**Why not:** 59K lines across 7 files — the TS source is heavily autogenerated or contains massive inline data. 11M on disk even though only 7 files.

---

### 16. `@companion-ai/feynman` — Research Agent

| Field | Value |
|-------|-------|
| **Source files** | 11 TS + 29 JS |
| **Source lines** | ~82,705 TS + ~82,850 JS |
| **npm dep** | **105M** (largest plugin) |
| **Dependencies** | alpha-hub, clack/prompts, pi-ai, pi-coding-agent, typebox, dotenv |
| **Import path** | `@companion-ai/feynman/extensions/research-tools.ts` |

**Why not:** Largest adopted plugin at 105M. 165K lines of source. 6 dependencies including alpha-hub which itself is large.

---

### 17. `@plannotator/pi-extension` — Plan Annotator

| Field | Value |
|-------|-------|
| **Source files** | 67 TS files |
| **Source lines** | ~17,496 loc |
| **npm dep** | 30M |
| **Dependencies** | @pierre/diffs, turndown, @joplin/turndown-plugin-gfm |
| **Import path** | `@plannotator/pi-extension` |

**Why consider:** 67 files / 17K lines is large but manageable. 30M is mostly bundled. Has a browser-based code review UI.

**Inline effort:** High. The UI component would need to be maintained locally, and turndown is already used by other plugins.

---

### 18. `context-mode` — MCP Context Optimization

| Field | Value |
|-------|-------|
| **Source files** | 64 TS + 59 JS |
| **Source lines** | ~61,833 TS + ~31,172 JS |
| **npm dep** | 8.0M |
| **Dependencies** | clack/prompts, domino, MCP SDK, picocolors, turndown, turndown-plugin-gfm, zod |
| **Import path** | `context-mode/build/pi-extension.js` |

**Why not:** 93K lines of source. MCP SDK + turndown + domino are heavy and cross-cutting.

---

## Recommendation Summary

| Priority | Plugin | Tier | Go? | Effort | Key Risk |
|----------|--------|------|-----|--------|----------|
| 1 | **pi-stash** | 🟢 Tiny | ✅ **Go** | ~30 min | None |
| 2 | **pi-edit-session** | 🟢 Tiny | ✅ **Go** | ~30 min | None |
| 3 | **pi-link** | 🟢 Tiny | ✅ **Go** | ~2 hrs | Replace `ws` with built-in WebSocket |
| 4 | **pi-memory** | 🟢 Tiny | ✅ **Go** | ~4 hrs | SQLite schema migration on future Node versions |
| 5 | **pi-formatter** | 🟡 Small | ✅ **Go** | ~3 hrs | 20 files to review/port |
| 6 | **pi-docparser** | 🟢 Tiny | ⏸️ Maybe | ~2 hrs | LiteParse stays as dep |
| 7 | **pi-markdown-preview** | 🟢 Tiny | ⏸️ Maybe | ~2 hrs | Puppeteer stays as dep |
| 8 | **greedysearch-pi** | 🟡 Small | ⏸️ Maybe | ~4 hrs | jsdom/readability stay as deps |
| 9 | **pi-processes** | 🟡 Small | ❌ No | ~6 hrs | 59 files, complex state mgmt |
| 10 | **pi-studio** | 🟠 Medium | ❌ No | ~2 days | 13K JS bundled frontend |
| 11 | **memex** | 🟠 Medium | ❌ No | — | MCP SDK is 99% of code |
| 12 | **pi-crew** | 🟠 Medium | ❌ No | — | 194 files, 20K lines |
| 13 | **pi-lens** | 🔴 Large | ❌ No | — | TypeScript compiler dep |
| 14 | **pi-mcp-adapter** | 🔴 Large | ❌ No | — | MCP SDK |
| 15 | **pi-thinking-steps** | 🔴 Large | ❌ No | — | 59K lines |
| 16 | **feynman** | 🟣 Massive | ❌ No | — | 105M, 165K lines |
| 17 | **plannotator** | 🔴 Large | ❌ No | — | 67 files, browser UI |
| 18 | **context-mode** | 🔴 Large | ❌ No | — | 93K lines |

### Recommended inline order

```
Round 1: pi-stash → pi-edit-session → pi-link
          (3 plugins, ~3 hours total)

Round 2: pi-memory → pi-formatter
          (2 plugins, ~7 hours total)

Round 3 (evaluate): pi-docparser → pi-markdown-preview → greedysearch-pi
          (3 plugins, ~8 hours total)
```

Each round removes the plugin from `package.json` dependencies, copies the source, updates the wrapper to point to local code, and runs the full test suite.
