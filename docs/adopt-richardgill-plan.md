# richardgill/pi-extensions → pi-me Adoption Plan

## Comparison Matrix

| Extension | pi-me Equivalent | Verdict |
|---|---|---|
| `extra-context-files` | `memory-mode` | **Adopt** — complementary: auto-loads context files vs `/mem` manual save |
| `file-collector` | (none) | **Adopt** — collects files from tool results |
| `files` | `files-widget` | **Adopt** — complementary: file actions (reveal/open/edit) vs TUI browser |
| `preset` | (none) | **Adopt** — model/tool preset switching |
| `sub-pi` | `ralph-loop` | **Adopt** — complementary: general subagent tool vs looped executor |
| `sub-pi-skill` | (none) | **Adopt** — skill for sub-pi usage |
| `pi-config` | (none) | **Adopt** — shared config utility (required by others) |

## Dependencies

New npm deps:
- `zod` — schema validation
- `jsonc-parser` — JSONC config file parsing (only needed by pi-config)

## Import Path Fixes

All `@richardgill/pi-*` imports → relative paths:
- `@richardgill/pi-config` → `./pi-config.js` (placed in foundation/)
- `@richardgill/pi-file-collector` → `./index.js` (self-referencing from extension.ts → index.ts)
- `@richardgill/pi-files` → `./index.js`
- `@richardgill/pi-preset` → `./index.js`
- `@richardgill/pi-sub-pi-skill` → `./index.js`

## File Map

| Source | Destination |
|---|---|
| `extensions/extra-context-files/src/index.ts` | `foundation/extra-context-files.ts` |
| `extensions/file-collector/src/` | `core-tools/file-collector/` |
| `extensions/files/src/` | `content-tools/richard-files/` |
| `extensions/preset/src/` | `session-lifecycle/preset/` |
| `extensions/sub-pi/src/` | `core-tools/sub-pi/` |
| `extensions/sub-pi-skill/src/` | `core-tools/sub-pi-skill/` |
| `packages/pi-config/src/index.ts` | `foundation/pi-config.ts` |
