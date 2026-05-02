# Phase 4 — Naming & Organization Design

**Date:** 2026-05-02
**Status:** Approved
**Depends on:** Phase 1 (removes 3 plugins, reducing the extension list)

## Goal

Establish and document clear layout and naming rules so future plugins land in the right shape without needing review. No files rename or move (the current layout already matches the derived rules). Two changes: extension list reordering in `package.json`, and rule documentation in `docs/intro.md`.

## Rule 1: Plugin layout — subdirectory vs. loose file

**Rule:** A plugin gets its own subdirectory when it has more than one source file OR is adopted from an external npm package. Single-file native plugins live as loose `.ts` files in their category root.

**Rationale:** Subdirectories signal "there is internal structure here" — tests, a `-core.ts` split, sub-modules. A lone `index.ts` in a directory with nothing else is noise. Adopted packages always get a directory because they will eventually need a `config.json`, a test file, or additional wrappers.

**Verification:** Current layout already complies. No files move.

| Category | Loose .ts files | Subdirectory plugins |
|---|---|---|
| `core-tools/` | calc, clipboard, flicker-corp, memory-mode, oracle, plan-mode, plan-mode-core, speedreading, ultrathink, web-search | arcade, ask-user-question, btw, code-actions, file-collector, memex, pi-*, ralph-loop, sub-pi, subagent, todo |
| `session-lifecycle/` | compact-config (moved to auto-compact/ in Phase 1), handoff, notifications, session-style, startup-header, usage-bar-core | agent-guidance, auto-compact, dcp, git-checkpoint-new, model-filter, preset, session-name, session-recap, skill-args, tab-status, token-rate, usage-extension, warp-notify |
| `content-tools/` | github, mermaid, notebook | context-mode, feynman, files-widget, pi-docparser, pi-markdown-preview, pi-studio, raw-paste, repeat, richard-files, web-fetch |

## Rule 2: Plugin naming — match the npm package name

**Rule:** The directory name for an adopted plugin matches the package name as you would type it in `npm install` (scoped packages drop the `@scope/` prefix).

| npm package | Directory name |
|---|---|
| `pi-crew` | `pi-crew/` |
| `@touchskyer/memex` | `memex/` |
| `@companion-ai/feynman` | `feynman/` |
| `context-mode` | `context-mode/` |
| `@apmantza/greedysearch-pi` | `greedysearch-pi/` |

**Verification:** All current adopted plugin directories already comply. No renames needed.

## Change 1: Reorder `package.json` extension list

### Problem

The 93-entry `pi.extensions` array in `package.json` has no consistent grouping. Adopted packages are scattered among native ones. The `session-lifecycle` block is not contiguous. `pi-web-providers/dist/index.js` appears last with no wrapper, making it visually inconsistent.

### Solution

Reorder entries to match the documented architecture layers, with adopted packages grouped at the end of their layer. Within each layer, native plugins come first (alphabetical), then adopted plugins (alphabetical).

**Layer order:**
1. `foundation/`
2. `session-lifecycle/` — native first, then adopted
3. `core-tools/` — native first, then adopted
4. `content-tools/` — native first, then adopted
5. `authoring/`
6. External dist entries (`pi-web-providers/dist/index.js`)

Load order within each layer is preserved (array position determines load sequence). The reorder only changes which plugins are adjacent, not their relative order within a layer.

### No-op verification

After reorder, run `npm test` to confirm no behavioral regression. The extension load order change is safe because pi extensions declare their own event hooks — they do not depend on other extensions having loaded first (with the one exception of `foundation/` extensions, which remain first).

## Change 2: Document rules in `docs/intro.md`

Add a "Plugin conventions" section to `docs/intro.md` covering:

1. **Layout rule** — subdirectory vs. loose file (Rule 1 above)
2. **Naming rule** — match npm package name (Rule 2 above)
3. **Layer assignment** — which category a new plugin belongs in:
   - `foundation/` — always-on safety guards (secrets, permission, context guards)
   - `session-lifecycle/` — session boundary events, state, branding, compaction
   - `core-tools/` — agent tools (tools the LLM calls), orchestration
   - `content-tools/` — file and web resource utilities
   - `authoring/` — AI-assisted content creation and commit helpers
4. **Adopted package wrapper template** — point to `registerAdoptedPackage()` from Phase 2

## Summary

| Change | Files affected | Risk |
|---|---|---|
| Reorder `package.json` extension list | `package.json` | Low — run tests to verify |
| Document rules in `docs/intro.md` | `docs/intro.md` | None |
