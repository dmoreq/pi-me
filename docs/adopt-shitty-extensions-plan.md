# shitty-extensions → pi-me Adoption Plan

## Comparison Matrix

| External Extension | pi-me Equivalent | Verdict |
|---|---|---|
| `clipboard` | (none) | **Adopt** — OSC52 clipboard copy |
| `cost-tracker` | `usage-extension` | **Adopt** — different: `/cost` per-provider 30d spend vs `/usage` insights dashboard |
| `flicker-corp` | (none) | **Adopt** — terminal display animation |
| `funny-working-message` | (none) | **Adopt** — replaces "Working..." with culinary verbs |
| `handoff` | (none) | **Adopt** — `/handoff` context transfer to new session |
| `loop` | `ralph-loop`, `pi-ralph-wiggum` | **Adopt** — different: simple in-session `/loop` with breakout condition vs subagent dispatch vs file-based task loops |
| `memory-mode` | (none) | **Adopt** — `/mem` save instructions to AGENTS.md |
| `oracle` | (none) | **Adopt** — `/oracle` second opinion from other AI models |
| `plan-mode` | `plan-tracker` | **Adopt** — different: file-based plans (.pi/plans/ markdown+JSON) vs session-based inline tracking |
| `resistance` | (none) | **Adopt** — Battlestar Galactica footer quote with typewriter effect |
| `speedreading` | (none) | **Adopt** — `/speedread` RSVP speed reader |
| `status-widget` | (none) | **Adopt** — provider status indicators (Claude/OpenAI/GitHub) |
| `ultrathink` | (none) | **Adopt** — rainbow "ultrathink" animation |
| `usage-bar` | `usage-extension`, `cost-tracker` | **Adopt** — different: progress bars with reset countdowns |
| `branch-sessions` | (none) | **Skip** — not registered in pi.extensions |
| `a-nach-b` skill | (none) | **Adopt** — Austrian public transport API scripts |

## Strategy

- All 14 registered extensions adopted as-is — zero mergers, zero deletions
- 1 skill adopted
- branch-sessions.ts skipped (not registered, 87 lines)
- All overlaps are complementary (different approaches to similar problems)

## File Map

| Source | Destination |
|--------|-------------|
| `extensions/clipboard.ts` | `core-tools/clipboard.ts` |
| `extensions/cost-tracker.ts` | `session-lifecycle/cost-tracker.ts` |
| `extensions/flicker-corp.ts` | `core-tools/flicker-corp.ts` |
| `extensions/funny-working-message.ts` | `session-lifecycle/funny-working-message.ts` |
| `extensions/handoff.ts` | `session-lifecycle/handoff.ts` |
| `extensions/loop.ts` | `core-tools/loop.ts` |
| `extensions/memory-mode.ts` | `foundation/memory-mode.ts` |
| `extensions/oracle.ts` | `core-tools/oracle.ts` |
| `extensions/plan-mode.ts` | `core-tools/plan-mode.ts` |
| `extensions/resistance.ts` | `core-tools/resistance.ts` |
| `extensions/speedreading.ts` | `core-tools/speedreading.ts` |
| `extensions/status-widget.ts` | `foundation/status-widget.ts` |
| `extensions/ultrathink.ts` | `core-tools/ultrathink.ts` |
| `extensions/usage-bar.ts` | `session-lifecycle/usage-bar.ts` |
| `skills/a-nach-b/` | `skills/a-nach-b/` |

## Dependencies

- Zero new npm dependencies — all use only pi APIs + Node.js builtins
- `@sinclair/typebox` already in peerDeps

## Extension Count

| | Before | After |
|---|---|---|
| Extensions | 29 | **43** (+14) |
| Skills | 24 | **25** (+1) |
