# Plugin Cleanup Plan

## 1. Remove greedysearch

**Files:** `core-tools/greedysearch/` (35 files, 7,049 lines)
**Skill:** `core-tools/greedysearch/skills/greedy-search/skill.md`
**Package deps:** `@puppeteer/browsers` (via greedysearch) — check if removable from root package.json

**Steps:**
```bash
git rm -r core-tools/greedysearch/
```
- Remove `./core-tools/greedysearch/index.ts` from package.json pi.extensions
- Remove `greedysearch` entry from README.md table
- Remove greedysearch section from `skills/plugin-guide/SKILL.md`
- Audit `.worktrees/` docs (not in main branch — skip)
- Run tests

**Effort:** 10 min

---

## 2. Merge crew into subagent

crew (core-tools/crew/) registers `/team` command + `team` tool.
It currently imports `discoverAgentsAll` from `../subagent/agents/agents.ts`.

**Steps:**
1. Move `team-tool.ts` → `core-tools/subagent/extension/team-tool.ts`
2. Move `team-tool.test.ts` → `core-tools/subagent/extension/team-tool.test.ts`
3. Update `team-tool.ts` import: `../subagent/agents/agents.ts` → `../agents/agents.ts`
4. Register the `/team` command from subagent's extension entry:
   - Add `import { registerTeamTool } from "./team-tool.ts";` to `core-tools/subagent/extension/index.ts`
   - Add `registerTeamTool(pi);` call in the extension entry
5. Remove `core-tools/crew/` directory:
   ```bash
   git rm core-tools/crew/index.ts core-tools/crew/team-tool.ts core-tools/crew/team-tool.test.ts
   ```
6. Update `package.json`: `./core-tools/crew/index.ts` → remove
7. Update `README.md`: "Crew" row → remove or merge into subagent description
8. Run tests

**Effort:** 20 min

---

## 3. Merge memory-mode into memory

**Important:** These do **different things** — not a direct overlap:

| Feature | memory-mode | memory |
|---------|-------------|--------|
| Command | `/mem` | `memory_store`, `memory_recall` tools |
| Backend | Appends to `AGENTS.md` / `AGENTS.local.md` | SQLite database |
| Purpose | Project instructions (prompts) | Persistent facts/lessons/events |
| AI used | Yes — integrates instruction into file | No — direct CRUD |

They're **complementary**, not redundant. If you still want to merge:

**Steps:**
1. Copy memory-mode's logic into memory's extension:
   - Add `import { registerMemoryMode } from "./memory-mode.ts";` to `core-tools/memory/index.ts`
   - Or just add `/mem` and `/remember` command registrations directly
2. Remove `core-tools/memory-mode.ts`:
   ```bash
   git rm core-tools/memory-mode.ts
   ```
3. Update `package.json`: `./core-tools/memory-mode.ts` → remove
4. Update `README.md`: merge "Memory Mode" into "Memory" description
5. Run tests

**Alternative:** Keep both — they serve different needs. `/mem` is for project-level AI instructions, `memory` is for structured data persistence.

**Effort:** 15 min (merge) or 1 min (keep)

---

## 4. Remove docparser

**Files:** `content-tools/docparser/` (11 files, 1,819 lines)
**Skill:** `content-tools/docparser/skills/parse-document/SKILL.md`
**Dep:** `@llamaindex/liteparse` (heavy native binaries — check if removable from package.json)

**Steps:**
```bash
git rm -r content-tools/docparser/
```
- Remove `./content-tools/docparser/index.ts` from package.json pi.extensions
- Remove `docparser` entry from README.md table
- Check if `@llamaindex/liteparse` is used by anything else → if not, remove from dependencies
- Run tests

**Effort:** 10 min

---

## Summary

| # | Task | Files | Effort |
|---|------|-------|--------|
| 1 | Remove greedysearch | 35 files, 7K lines | 10 min |
| 2 | Merge crew → subagent | 3 files | 20 min |
| 3 | Merge memory-mode → memory | 1 file, 462 lines | 15 min |
| 4 | Remove docparser | 11 files, 1.8K lines | 10 min |
| **Total** | | **~50 files, ~9.5K lines** | **~55 min** |
