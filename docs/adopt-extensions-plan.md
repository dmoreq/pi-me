# pi-extensions → pi-me Adoption Plan

## Comparison Matrix

| External Extension | pi-me Equivalent | Verdict |
|---|---|---|
| `agent-guidance` | (none) | **Adopt** — model-specific guidance switching |
| `arcade/*` (5 games) | (none) | **Adopt** — minigames, zero conflict |
| `code-actions` | (none) | **Adopt** — `/code` snippet picker |
| `files-widget` | (none) | **Adopt** — `/readfiles` TUI file browser |
| `raw-paste` | (none) | **Adopt** — `/paste` editable paste |
| `pi-ralph-wiggum` | `ralph-loop` | **Adopt** — different approach: file-based task loop vs subagent dispatch loop. Can coexist. |
| `session-recap` | (none) | **Adopt** — session recap widget on refocus |
| `tab-status` | (none) | **Adopt** — tab status indicators |
| `usage-extension` | (none) | **Adopt** — `/usage` cost/token dashboard |
| `extending-pi` skill | (none) | **Adopt** — guide for extending Pi |
| `skill-creator` skill | (none) | **Adopt** — detailed skill creation guide |
| `pi-ralph-wiggum` skill | `ralph-loop` skill | **Adopt** — different loop mechanism |

## Strategy

- **All 9 extensions adopted as-is** — zero mergers, zero deletions
- **3 skills adopted** — placed in `skills/`
- **pi-ralph-wiggum ↔ ralph-loop**: Different mechanisms (file-based task file vs subagent dispatch). Both can coexist.
- **arcade**: Minigames, low utility but zero conflict, unique.

## File Map

| Source (pi-extensions) | Destination (pi-me) |
|---|---|
| `agent-guidance/agent-guidance.ts` | `session-lifecycle/agent-guidance/agent-guidance.ts` |
| `agent-guidance/templates/` | `session-lifecycle/agent-guidance/templates/` |
| `arcade/*.ts` + `mario-not/` + `assets/` | `core-tools/arcade/` |
| `code-actions/index.ts` + `src/` | `core-tools/code-actions/` |
| `files-widget/index.ts` + all modules | `content-tools/files-widget/` |
| `raw-paste/index.ts` | `content-tools/raw-paste/` |
| `pi-ralph-wiggum/index.ts` | `core-tools/pi-ralph-wiggum/` |
| `session-recap/index.ts` | `session-lifecycle/session-recap/` |
| `tab-status/tab-status.ts` | `session-lifecycle/tab-status/` |
| `usage-extension/index.ts` | `session-lifecycle/usage-extension/` |
| `extending-pi/SKILL.md` | `skills/extending-pi/SKILL.md` |
| `extending-pi/skill-creator/SKILL.md` | `skills/skill-creator/SKILL.md` |
| `pi-ralph-wiggum/SKILL.md` | `skills/pi-ralph-wiggum/SKILL.md` |

## Dependencies

- `@sinclair/typebox` — already in pi-me's peerDeps. No change.
- All extensions use only pi APIs + Node.js builtins. Zero new npm deps.

## Extension Count

| | Before | After |
|---|---|---|
| Extensions | 20 | **29** (+9) |
| Skills | 21 | **24** (+3) |
