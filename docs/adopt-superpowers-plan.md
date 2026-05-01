# pi-superpowers → pi-me Adoption Plan

## Comparison Matrix

| External Extension | pi-me Equivalent | Verdict |
|---|---|---|
| `plan-tracker` | (none) | **Adopt as-is** — unique plan-tracking tool with TUI widget |
| 13 workflow skills | (none) | **Adopt as-is** — all unique; pi-me has only 8 operational skills |

## Strategy

- **plan-tracker**: Adopt as-is. No pi-me equivalent. Two files: `plan-tracker-core.ts` (pure logic) + `plan-tracker.ts` (extension entry point).
- **13 skills**: Adopt as-is. pi-me has 8 skills (commit-helper, skill-bootstrap, secrets, output-artifacts, permission, ralph-loop, adopt-plugin, eval). The 13 pi-superpowers skills cover an entirely different domain (workflow: brainstorm → plan → execute → verify → review → finish).
- **Zero merges** — complete category separation (operational vs workflow skills).

## File Map

| Action | Source | Destination |
|--------|--------|-------------|
| Copy | `extensions/plan-tracker-core.ts` | `core-tools/plan-tracker/plan-tracker-core.ts` |
| Copy | `extensions/plan-tracker.ts` | `core-tools/plan-tracker/plan-tracker.ts` |
| Copy | `tests/extension/plan-tracker.test.ts` | `core-tools/plan-tracker/tests/plan-tracker.test.ts` |
| Copy | `skills/brainstorming/SKILL.md` | `skills/brainstorming/SKILL.md` |
| Copy | `skills/writing-plans/SKILL.md` | `skills/writing-plans/SKILL.md` |
| Copy | `skills/executing-plans/SKILL.md` | `skills/executing-plans/SKILL.md` |
| Copy | `skills/subagent-driven-development/` | `skills/subagent-driven-development/` |
| Copy | `skills/test-driven-development/` | `skills/test-driven-development/` |
| Copy | `skills/systematic-debugging/` | `skills/systematic-debugging/` |
| Copy | `skills/verification-before-completion/` | `skills/verification-before-completion/` |
| Copy | `skills/requesting-code-review/` | `skills/requesting-code-review/` |
| Copy | `skills/receiving-code-review/` | `skills/receiving-code-review/` |
| Copy | `skills/dispatching-parallel-agents/` | `skills/dispatching-parallel-agents/` |
| Copy | `skills/using-git-worktrees/` | `skills/using-git-worktrees/` |
| Copy | `skills/finishing-a-development-branch/` | `skills/finishing-a-development-branch/` |
| Copy | `skills/writing-skills/` | `skills/writing-skills/` |
| Modify | `package.json` | Add `plan-tracker.ts` to `pi.extensions`, add test |

## Dependencies

- `@sinclair/typebox` — already a peerDep in pi-me. No change needed.
- `vitest` — pi-superpowers devDep. Not needed (pi-me uses `node:test` via `tsx`).

## Optimization Opportunities

- **plan-tracker-core.ts** — Already well-structured pure logic. No changes needed.
- **plan-tracker.ts** — Clean extension entry point. No changes needed.
- **Skills** — Already well-written with YAML frontmatter. No changes needed.
- **Test conversion** — Convert from vitest to node:test (import changes only).

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Skill name collisions | Low | Verified: zero overlap between pi-me and pi-superpowers skill names |
| `@sinclair/typebox` version mismatch | Low | Already a peerDep; both use `*` version |
| Skill cross-references broken | Low | Skills reference each other via `/skill:name`; all exist after adoption |

## Migration Steps

1. Create `adopt-superpowers` branch
2. Copy plan-tracker extension files + test to `core-tools/plan-tracker/`
3. Copy all 13 skill directories to `skills/`
4. Convert plan-tracker test from vitest to node:test
5. Add plan-tracker to `package.json` → `pi.extensions`
6. Update `package.json` test script to include plan-tracker tests
7. Run `npm test` — verify all pass
8. Commit and push
