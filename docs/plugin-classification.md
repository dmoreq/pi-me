# Optional Plugins — Deep Analysis

18 extensions classified as Optional. All depend only on the pi SDK (no extra npm deps).
Analysis covers: size, overlap, tests, use frequency, removal impact.

---

## Cosmetic (should remove)

| Extension | Lines | Files | Analysis |
|-----------|-------|-------|----------|
| ~~funny-messages~~ | 95 | 1 | ✅ Removed |
| ~~flicker-corp~~ | 128 | 1 | ✅ Removed |
| **speedreading** | 682 | 1 | `/speedread` RSVP reader. 0 tests. Pure visual gimmick. |
| **ultrathink** | 224 | 1 | Rainbow "ultrathink" animation. 0 tests. Pure visual gimmick. |

**Recommendation:** Remove both — they add no functional value.

---

## Heavy (large codebase, niche value)

| Extension | Lines | Files | Tests | Analysis |
|-----------|-------|-------|-------|----------|
| **greedysearch** | 7,049 | 35 | 0 | Deep research tool (greedy_search, deep_research). **Heaviest extension in pi-me.** 0 tests. 35 JS files with browser automation. Pulls in chromium via `@puppeteer/browsers` at install time. Questionable if the agent's built-in web_search + thinking isn't sufficient. |
| **formatter** | 2,040 | 21 | 0 | Auto-formats files on save/write. 21 files with runners for 9 formatters (Biome, Prettier, Ruff, shfmt, clang-format, etc.) + cmake/markdownlint/eslint. Respectable tool but only useful if you use those specific formatters. |
| **memory** | 2,067 | 9 | 3 | SQLite persistent memory via `node:sqlite`. Has tests. Functional — stores facts/lessons/events. Overlaps conceptually with **memory-mode** (which saves to AGENTS.md). SQLite is experimental in Node 24, may break in future versions. |
| **link** | 1,519 | 2 | 0 | WebSocket inter-terminal communication. Very niche — requires multiple pi instances. Adds websocket complexity (keepalive, reconnection, batching). |
| **docparser** | 1,819 | 11 | 0 | PDF/Office/image parsing. Uses `@llamaindex/liteparse` (heavy native dep). Useful if you need document extraction, but `liteparse` adds ~200MB of native binaries. |

**Recommendations:**
- **greedysearch** → Extract or remove. 7K lines, 0 tests, browser automation bloat. The agent can already research with `web_search` + thinking.
- **formatter** → Keep (useful, well-structured, active).
- **memory** → Keep. Has tests. Useful for persistent context. But consider removing **memory-mode** (overlap).
- **link** → Remove. Very niche. WebSocket complexity not worth it for single-user pi.
- **docparser** → Extract. Heavy native dep for a rarely-used feature.

---

## Moderate (medium value, some overlap)

| Extension | Lines | Files | Tests | Analysis |
|-----------|-------|-------|-------|----------|
| **oracle** | 605 | 1 | 0 | `/oracle` queries other models. Useful tie-breaker. No overlap — `/btw` queries the *same* model, oracle queries a *different* model. |
| **btw** | 603 | 3 | 0 | `/btw` side questions to primary model. Niche but well-liked. Overlay rendering is clever. |
| **crew** | 459 | 3 | 1 | `/team` dispatches sub-agents. **Direct overlap with subagent tool.** Subagent already provides single/chain/parallel dispatch. Crew adds a specific team template on top. Has tests. |
| **edit-session** | 634 | 2 | 0 | `/edit-turn` re-edits previous messages via external editor. Useful for correction workflows. |
| **stash** | 467 | 3 | 0 | Stash/restore editor drafts via keyboard shortcuts. Simple, well-contained. |
| **memory-mode** | 462 | 1 | 0 | `/mem` saves instructions to AGENTS.md. **Direct overlap with memory** (both persist data, different backends). Simpler than memory — just appends to a markdown file. |
| **code-actions** | 634 | 6 | 0 | `/code` picks code from assistant messages. Useful utility. Well-structured (snippets, UI, actions modules). |
| **file-collector** | 987 | 2 | 0 | Collects file paths from tool results via regex. Niche — for advanced bash shim integration. |
| **compact-config** | 294 | 1 | 0 | Per-model compaction threshold TUI. Nice UI but very niche configuration. Default auto-compact settings work fine for most users. |
| **warp-notify** | 450 | 4 | 0 | Warp terminal OSC 777 notifications. Only useful in Warp terminal. Harmless but pointless in other terminals. |
| **preset** | 368 | 2 | 0 | Model presets. Useful for switching between configs. |
| **model-filter** | 32 | 1 | 0 | Filters models by provider. 32 lines. Tiny. Harmless. |
| **raw-paste** | 98 | 1 | 0 | Paste editor. 98 lines. Tiny. Useful. |

**Recommendations:**
- **crew** → Remove (overlaps with subagent tool). Subagent already does everything crew does.
- **memory-mode** → Remove or merge into **memory**. Two persistence systems is confusing.
- **oracle** → Keep. Distinct from btw. Useful feature.
- **btw** → Keep. Distinct from oracle. Well-liked.
- **edit-session**, **stash**, **code-actions**, **file-collector** → Keep. Well-contained, useful.
- **compact-config**, **preset**, **model-filter** → Keep. Small, useful.
- **warp-notify** → Keep. Small, harmless, useful if on Warp.
- **raw-paste** → Keep. 98 lines, useful.

---

## Summary Actions

| Action | Extensions | Lines removed |
|--------|------------|---------------|
| ✅ Already removed | funny-messages, flicker-corp | 223 |
| 🔴 Remove (cosmetic) | speedreading, ultrathink | 906 |
| 🔴 Remove (heavy+niche) | greedysearch, link | 8,568 |
| 🔴 Remove (overlap) | crew, memory-mode | 921 |
| 🟡 Extract (heavy dep) | docparser | 1,819 |
| 🟢 Keep | formatter, memory, oracle, btw, edit-session, stash, code-actions, file-collector, compact-config, warp-notify, preset, model-filter, raw-paste | — |

**If you remove all 8 marked red:** ~10,395 lines gone. pi-me drops from ~60K to ~50K source lines.
