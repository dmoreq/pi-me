# Dialog Unification Design

**Date:** 2026-05-01  
**Status:** Approved

## Problem

Three systems present questions to the user but with inconsistent interaction models and visual formats:

- `core-tools/ask-user-question/` — rich TUI questionnaire (tabs, previews, multi-select). Used by the agent as a tool.
- `foundation/safe-ops.ts` — `ctx.ui.select()` with emoji-heavy option strings, verb "Approve/Block".
- `foundation/permission/permission.ts` — `ctx.ui.select()` with plain text options, verb "Allow/Cancel".

None support number-key selection (1, 2, 3). Navigation requires arrow keys only.

## Goal

- Unify all three under a single full TUI (the existing `QuestionnaireSession`).
- Add number-key selection (1–9) as the primary interaction; arrow keys remain secondary.
- Standardise option format: short label (1–5 words) + one-line description per option.
- Standardise terminology: "Allow once", "Allow always", "Block", "Cancel" across safe-ops and permission.

## Architecture

Move the full `QuestionnaireSession` TUI and all supporting files from `core-tools/ask-user-question/` into `foundation/dialog/`. `ask-user-question` becomes a thin tool-registration wrapper. `safe-ops` and `permission` become consumers of `foundation/dialog/`.

### New layout

```
foundation/
  dialog/
    state/
      questionnaire-session.ts
      state.ts
      state-reducer.ts
      key-router.ts              ← number-key support added here
      row-intent.ts
      input-buffer.ts
      build-questionnaire.ts
      selectors/
        contract.ts
        derivations.ts
        focus.ts
        projections.ts
    view/
      (all view components, moved verbatim)
    tool/
      types.ts
      validate-questionnaire.ts
      response-envelope.ts
      format-answer.ts
    index.ts                     ← exports QuestionnaireSession, confirmDialog, types

core-tools/ask-user-question/
  ask-user-question.ts           ← imports from foundation/dialog, registers tool
  index.ts
```

### New `confirmDialog` helper

```ts
// foundation/dialog/index.ts
export async function confirmDialog(
  ctx: ExtensionContext,
  question: string,
  options: Array<{ label: string; description: string }>
): Promise<string | null>
```

Wraps `ctx.ui.custom()` + `QuestionnaireSession` with a single-question call shape. Returns the selected option label, or `null` if cancelled.

## Number-key support

In `foundation/dialog/state/key-router.ts`, inside `routeKey()`, add a handler before the existing UP/DOWN/CONFIRM/CANCEL checks:

```
if digit 1–9 pressed AND not in inputMode AND not in notesVisible:
  const targetIndex = digit - 1
  if targetIndex < runtime.items.length:
    emit { kind: "nav", nextIndex: targetIndex }
    then emit confirm for that item (or let next keypress confirm)
```

Two sub-options for digit behaviour:
- **Jump-and-confirm** — pressing `2` immediately selects and submits option 2. Fastest path.
- **Jump-only** — pressing `2` moves focus to option 2; Enter confirms. Mirrors Claude Code behaviour.

Implement **jump-and-confirm** (fastest, matches user preference for number-driven flow).

## Unified option format for safe-ops and permission

### safe-ops confirmation (was emoji-string options)

```
🟡 Allow git push?
  git push origin main

  1. Allow once        — run this command, ask again next time
  2. Allow this session — approve all "push" commands until session ends
  3. Block             — skip this command
```

Note: safe-ops "Allow this session" is in-memory only (session state, never persisted).

### permission confirmation (was two-step plain-text: action → scope)

The current flow has two sequential `ctx.ui.select()` calls (action, then scope). With `confirmDialog` this becomes a single dialog with explicit scope options:

```
Requires Medium permission
  npm install

  1. Allow once         — run this command, ask again next time
  2. Allow (session)    — raise permission to Medium until session ends
  3. Allow (global)     — save Medium as default in settings.json
  4. Cancel             — skip this command
```

This eliminates the second scope dialog entirely.

### permission selector (was arrow-key list)

```
Select permission level

  1. Minimal           — read-only
  2. Low               — file ops only
  3. Medium            — dev operations  ← current
  4. High              — full operations
  5. Bypassed          — all checks disabled
```

## Migration steps

1. Create `foundation/dialog/` and move all files from `core-tools/ask-user-question/state/`, `view/`, `tool/`.
2. Update `core-tools/ask-user-question/ask-user-question.ts` to import from `foundation/dialog/`.
3. Add number-key (jump-and-confirm) to `foundation/dialog/state/key-router.ts`.
4. Add `confirmDialog()` to `foundation/dialog/index.ts`.
5. Replace all `ctx.ui.select()` calls in `foundation/safe-ops.ts` with `confirmDialog()`.
6. Replace all `ctx.ui.select()` calls in `foundation/permission/permission.ts` with `confirmDialog()`.
7. Standardise option labels and descriptions (see Unified option format above).
8. Update all imports throughout codebase.
9. Run existing tests; fix any broken imports.

## Out of scope

- Changing ask-user-question's multi-tab, preview, or multi-select behaviour.
- Changing the permission level classification logic.
- Changing safe-ops git pattern matching.
