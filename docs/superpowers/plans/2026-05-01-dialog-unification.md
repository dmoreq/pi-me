# Dialog Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the full QuestionnaireSession TUI from `core-tools/ask-user-question/` into `foundation/dialog/`, add number-key (1–9) selection, and migrate `safe-ops` and `permission` to use a new `confirmDialog()` helper backed by the same TUI.

**Architecture:** All dialog state/view/tool files move under `foundation/dialog/`. `ask-user-question` becomes a thin re-export wrapper. `confirmDialog()` lives in `foundation/dialog/confirm-dialog.ts` and wraps `ctx.ui.custom()` + `QuestionnaireSession` for single-question confirmation use cases. Number-key support is added to the shared `key-router.ts`.

**Tech Stack:** TypeScript, `@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, `@sinclair/typebox`, `node:test` + `tsx --test` for tests.

---

## File Map

### Created
- `foundation/dialog/state/questionnaire-session.ts` — moved from `core-tools/ask-user-question/state/`
- `foundation/dialog/state/state.ts` — moved
- `foundation/dialog/state/state-reducer.ts` — moved
- `foundation/dialog/state/key-router.ts` — moved **+ number-key support added**
- `foundation/dialog/state/row-intent.ts` — moved
- `foundation/dialog/state/input-buffer.ts` — moved
- `foundation/dialog/state/build-questionnaire.ts` — moved
- `foundation/dialog/state/selectors/contract.ts` — moved
- `foundation/dialog/state/selectors/derivations.ts` — moved
- `foundation/dialog/state/selectors/focus.ts` — moved
- `foundation/dialog/state/selectors/projections.ts` — moved
- `foundation/dialog/view/**` — all 14 view files moved verbatim
- `foundation/dialog/tool/types.ts` — moved
- `foundation/dialog/tool/validate-questionnaire.ts` — moved
- `foundation/dialog/tool/response-envelope.ts` — moved
- `foundation/dialog/tool/format-answer.ts` — moved
- `foundation/dialog/index.ts` — **new** barrel re-exporting everything + `confirmDialog`
- `foundation/dialog/confirm-dialog.ts` — **new** `confirmDialog()` + `buildConfirmItems()`
- `foundation/dialog/state/key-router.test.ts` — **new** unit tests for number-key behaviour
- `foundation/dialog/confirm-dialog.test.ts` — **new** unit tests for `buildConfirmItems`

### Modified
- `core-tools/ask-user-question/ask-user-question.ts` — update imports to `foundation/dialog`
- `core-tools/ask-user-question/index.ts` — update imports to `foundation/dialog`
- `foundation/safe-ops.ts` — replace all `ctx.ui.select()` with `confirmDialog()`
- `foundation/permission/permission.ts` — replace all `ctx.ui.select()` with `confirmDialog()`

### Deleted
- `core-tools/ask-user-question/state/` directory (all files moved)
- `core-tools/ask-user-question/view/` directory (all files moved)
- `core-tools/ask-user-question/tool/` directory (all files moved)

---

## Task 1: Move all dialog source files into foundation/dialog

**Files:**
- Create: `foundation/dialog/state/` (entire subtree via git mv)
- Create: `foundation/dialog/view/` (entire subtree via git mv)
- Create: `foundation/dialog/tool/` (entire subtree via git mv)

- [ ] **Step 1: Create destination directories**

```bash
mkdir -p foundation/dialog/state/selectors
mkdir -p foundation/dialog/view/components/preview
mkdir -p foundation/dialog/tool
```

- [ ] **Step 2: Move state files**

```bash
git mv core-tools/ask-user-question/state/questionnaire-session.ts foundation/dialog/state/questionnaire-session.ts
git mv core-tools/ask-user-question/state/state.ts foundation/dialog/state/state.ts
git mv core-tools/ask-user-question/state/state-reducer.ts foundation/dialog/state/state-reducer.ts
git mv core-tools/ask-user-question/state/key-router.ts foundation/dialog/state/key-router.ts
git mv core-tools/ask-user-question/state/row-intent.ts foundation/dialog/state/row-intent.ts
git mv core-tools/ask-user-question/state/input-buffer.ts foundation/dialog/state/input-buffer.ts
git mv core-tools/ask-user-question/state/build-questionnaire.ts foundation/dialog/state/build-questionnaire.ts
git mv core-tools/ask-user-question/state/selectors/contract.ts foundation/dialog/state/selectors/contract.ts
git mv core-tools/ask-user-question/state/selectors/derivations.ts foundation/dialog/state/selectors/derivations.ts
git mv core-tools/ask-user-question/state/selectors/focus.ts foundation/dialog/state/selectors/focus.ts
git mv core-tools/ask-user-question/state/selectors/projections.ts foundation/dialog/state/selectors/projections.ts
```

- [ ] **Step 3: Move tool files**

```bash
git mv core-tools/ask-user-question/tool/types.ts foundation/dialog/tool/types.ts
git mv core-tools/ask-user-question/tool/validate-questionnaire.ts foundation/dialog/tool/validate-questionnaire.ts
git mv core-tools/ask-user-question/tool/response-envelope.ts foundation/dialog/tool/response-envelope.ts
git mv core-tools/ask-user-question/tool/format-answer.ts foundation/dialog/tool/format-answer.ts
```

- [ ] **Step 4: Move view files**

```bash
git mv core-tools/ask-user-question/view/body-residual-spacer.ts foundation/dialog/view/body-residual-spacer.ts
git mv core-tools/ask-user-question/view/component-binding.ts foundation/dialog/view/component-binding.ts
git mv core-tools/ask-user-question/view/dialog-builder.ts foundation/dialog/view/dialog-builder.ts
git mv core-tools/ask-user-question/view/props-adapter.ts foundation/dialog/view/props-adapter.ts
git mv core-tools/ask-user-question/view/stateful-view.ts foundation/dialog/view/stateful-view.ts
git mv core-tools/ask-user-question/view/tab-components.ts foundation/dialog/view/tab-components.ts
git mv core-tools/ask-user-question/view/tab-content-strategy.ts foundation/dialog/view/tab-content-strategy.ts
git mv core-tools/ask-user-question/view/components/chat-row-view.ts foundation/dialog/view/components/chat-row-view.ts
git mv core-tools/ask-user-question/view/components/multi-select-view.ts foundation/dialog/view/components/multi-select-view.ts
git mv core-tools/ask-user-question/view/components/option-list-view.ts foundation/dialog/view/components/option-list-view.ts
git mv core-tools/ask-user-question/view/components/submit-picker.ts foundation/dialog/view/components/submit-picker.ts
git mv core-tools/ask-user-question/view/components/tab-bar.ts foundation/dialog/view/components/tab-bar.ts
git mv core-tools/ask-user-question/view/components/wrapping-select.ts foundation/dialog/view/components/wrapping-select.ts
git mv core-tools/ask-user-question/view/components/preview/markdown-content-cache.ts foundation/dialog/view/components/preview/markdown-content-cache.ts
git mv core-tools/ask-user-question/view/components/preview/preview-block-renderer.ts foundation/dialog/view/components/preview/preview-block-renderer.ts
git mv core-tools/ask-user-question/view/components/preview/preview-box-renderer.ts foundation/dialog/view/components/preview/preview-box-renderer.ts
git mv core-tools/ask-user-question/view/components/preview/preview-layout-decider.ts foundation/dialog/view/components/preview/preview-layout-decider.ts
git mv core-tools/ask-user-question/view/components/preview/preview-pane.ts foundation/dialog/view/components/preview/preview-pane.ts
```

- [ ] **Step 5: Delete now-empty source directories**

```bash
rmdir core-tools/ask-user-question/state/selectors
rmdir core-tools/ask-user-question/state
rmdir core-tools/ask-user-question/view/components/preview
rmdir core-tools/ask-user-question/view/components
rmdir core-tools/ask-user-question/view
rmdir core-tools/ask-user-question/tool
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move dialog TUI source files to foundation/dialog"
```

---

## Task 2: Create foundation/dialog/index.ts

**Files:**
- Create: `foundation/dialog/index.ts`

- [ ] **Step 1: Write the barrel file**

Create `foundation/dialog/index.ts`:

```typescript
export { QuestionnaireSession } from "./state/questionnaire-session.js";
export type { QuestionnaireSessionConfig, QuestionnaireSessionComponent } from "./state/questionnaire-session.js";
export { ROW_INTENT_META, sentinelsToAppend } from "./state/row-intent.js";
export type { RowIntentKind } from "./state/row-intent.js";
export { buildQuestionnaire } from "./state/build-questionnaire.js";
export { buildQuestionnaireResponse, buildToolResult } from "./tool/response-envelope.js";
export {
  MAX_OPTIONS,
  MAX_QUESTIONS,
  MIN_OPTIONS,
  MAX_HEADER_LENGTH,
  MAX_LABEL_LENGTH,
  QuestionParamsSchema,
  RESERVED_LABELS,
  SENTINEL_LABELS,
  isQuestionnaireResult,
} from "./tool/types.js";
export type {
  QuestionData,
  QuestionnaireResult,
  QuestionParams,
  QuestionAnswer,
  OptionData,
  QuestionnaireError,
  SentinelKind,
  SentinelLabel,
  ReservedLabel,
} from "./tool/types.js";
export { validateQuestionnaire } from "./tool/validate-questionnaire.js";
export type { WrappingSelectItem } from "./view/components/wrapping-select.js";
export { confirmDialog, buildConfirmItems } from "./confirm-dialog.js";
export type { ConfirmOption } from "./confirm-dialog.js";
```

> Note: `confirm-dialog.ts` does not exist yet — the TypeScript import will fail until Task 5. That is expected. `index.ts` is a forward declaration of intent.

- [ ] **Step 2: Commit**

```bash
git add foundation/dialog/index.ts
git commit -m "feat: add foundation/dialog/index.ts barrel"
```

---

## Task 3: Update ask-user-question to import from foundation/dialog

**Files:**
- Modify: `core-tools/ask-user-question/ask-user-question.ts`
- Modify: `core-tools/ask-user-question/index.ts`

- [ ] **Step 1: Rewrite ask-user-question.ts imports**

Replace the entire import block at the top of `core-tools/ask-user-question/ask-user-question.ts`. The old imports used relative paths like `./state/...`, `./tool/...`, `./view/...`. Replace them all:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  QuestionnaireSession,
  ROW_INTENT_META,
  sentinelsToAppend,
  buildQuestionnaireResponse,
  buildToolResult,
  MAX_OPTIONS,
  MAX_QUESTIONS,
  MIN_OPTIONS,
  validateQuestionnaire,
  QuestionParamsSchema,
  isQuestionnaireResult,
  type QuestionData,
  type QuestionnaireResult,
  type QuestionParams,
  type WrappingSelectItem,
} from "../../foundation/dialog/index.js";
```

All other code in `ask-user-question.ts` (the `buildItemsForQuestion` function and `registerAskUserQuestionTool` function body) stays unchanged.

- [ ] **Step 2: Verify index.ts needs no changes**

`core-tools/ask-user-question/index.ts` only imports from `./ask-user-question.js` — no path change needed.

- [ ] **Step 3: Run tests to verify no regressions**

```bash
npm test
```

Expected: all existing tests pass (permission, checkpoint, etc.). There are no ask-user-question unit tests currently, so this is a build-level check.

- [ ] **Step 4: Commit**

```bash
git add core-tools/ask-user-question/ask-user-question.ts
git commit -m "refactor: ask-user-question imports from foundation/dialog"
```

---

## Task 4: Add number-key (1–9) support to key-router — test first

**Files:**
- Create: `foundation/dialog/state/key-router.test.ts`
- Modify: `foundation/dialog/state/key-router.ts`

- [ ] **Step 1: Write failing tests**

Create `foundation/dialog/state/key-router.test.ts`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { routeKey } from "./key-router.js";
import type { QuestionnaireState, QuestionnaireRuntime } from "./state.js";
import type { WrappingSelectItem } from "../view/components/wrapping-select.js";

const noopKb = { matches: (_data: string, _name: string) => false };

function makeState(overrides: Partial<QuestionnaireState> = {}): QuestionnaireState {
  return {
    currentTab: 0,
    optionIndex: 0,
    inputMode: false,
    notesVisible: false,
    chatFocused: false,
    answers: new Map(),
    multiSelectChecked: new Set(),
    notesByTab: new Map(),
    focusedOptionHasPreview: false,
    submitChoiceIndex: 0,
    notesDraft: "",
    ...overrides,
  };
}

const THREE_OPTIONS: WrappingSelectItem[] = [
  { kind: "option", label: "Alpha", description: "First" },
  { kind: "option", label: "Beta",  description: "Second" },
  { kind: "option", label: "Gamma", description: "Third" },
];

function makeRuntime(overrides: Partial<QuestionnaireRuntime> = {}): QuestionnaireRuntime {
  return {
    keybindings: noopKb,
    inputBuffer: "",
    questions: [{
      question: "Pick one?",
      header: "Pick",
      options: [
        { label: "Alpha", description: "First" },
        { label: "Beta",  description: "Second" },
        { label: "Gamma", description: "Third" },
      ],
    }],
    isMulti: false,
    currentItem: THREE_OPTIONS[0],
    items: THREE_OPTIONS,
    ...overrides,
  };
}

describe("routeKey — number-key selection", () => {
  it("pressing '1' confirms the first option immediately", () => {
    const action = routeKey("1", makeState(), makeRuntime());
    assert.equal(action.kind, "confirm");
    if (action.kind !== "confirm") return;
    assert.equal(action.answer.kind, "option");
    assert.equal(action.answer.answer, "Alpha");
    assert.equal(action.answer.questionIndex, 0);
    assert.equal(action.answer.question, "Pick one?");
  });

  it("pressing '2' confirms the second option", () => {
    const action = routeKey("2", makeState(), makeRuntime());
    assert.equal(action.kind, "confirm");
    if (action.kind !== "confirm") return;
    assert.equal(action.answer.answer, "Beta");
  });

  it("pressing '3' confirms the third option", () => {
    const action = routeKey("3", makeState(), makeRuntime());
    assert.equal(action.kind, "confirm");
    if (action.kind !== "confirm") return;
    assert.equal(action.answer.answer, "Gamma");
  });

  it("pressing a digit beyond the option count returns ignore", () => {
    const action = routeKey("9", makeState(), makeRuntime());
    assert.equal(action.kind, "ignore");
  });

  it("pressing '0' is ignored (not a 1-based index)", () => {
    const action = routeKey("0", makeState(), makeRuntime());
    assert.equal(action.kind, "ignore");
  });

  it("number key is ignored when inputMode is true", () => {
    const action = routeKey("1", makeState({ inputMode: true }), makeRuntime());
    // inputMode ignores most keys — must not be confirm
    assert.notEqual(action.kind, "confirm");
  });

  it("number key is ignored when notesVisible is true", () => {
    const action = routeKey("1", makeState({ notesVisible: true }), makeRuntime());
    // notesVisible forwards to notes — must not be confirm
    assert.notEqual(action.kind, "confirm");
  });

  it("number key is ignored for multiSelect questions", () => {
    const runtime = makeRuntime({
      questions: [{
        question: "Pick many?",
        header: "Pick",
        options: [
          { label: "A", description: "a" },
          { label: "B", description: "b" },
        ],
        multiSelect: true,
      }],
    });
    const action = routeKey("1", makeState(), runtime);
    assert.notEqual(action.kind, "confirm");
  });

  it("number key is ignored when chatFocused is true", () => {
    const action = routeKey("1", makeState({ chatFocused: true }), makeRuntime());
    assert.notEqual(action.kind, "confirm");
  });

  it("non-digit key characters are unaffected by number handler", () => {
    // 'a' should not trigger number-key path
    const action = routeKey("a", makeState(), makeRuntime());
    assert.equal(action.kind, "ignore");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test 2>&1 | grep -A3 "number-key"
```

Expected: tests fail with `AssertionError` because number-key support doesn't exist yet.

- [ ] **Step 3: Implement number-key support in key-router.ts**

Open `foundation/dialog/state/key-router.ts`. Find the section after the `tabSwitchAction` guard and the `if (!q) return { kind: "ignore" }` guard, and BEFORE the `if (data === NOTES_ACTIVATE_KEY ...)` line. Insert:

```typescript
// Number key: pressing 1–9 immediately confirms that option (single-select only).
// Digit is 1-based: "1" → items[0], "2" → items[1], etc.
if (!q.multiSelect && !state.chatFocused) {
  const digit = parseInt(data, 10);
  if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
    const targetIndex = digit - 1;
    const item = runtime.items[targetIndex];
    if (item?.kind === "option") {
      return {
        kind: "confirm",
        answer: {
          questionIndex: state.currentTab,
          question: q.question,
          kind: "option",
          answer: item.label,
        },
        autoAdvanceTab: computeAutoAdvanceTab(state, runtime),
      };
    }
  }
}
```

The full context around the insertion (showing 5 lines before and after):

```typescript
  // ...existing tabSwitchAction check...
  const tab = tabSwitchAction(data, state, runtime);
  if (tab) return tab;

  const q = runtime.questions[state.currentTab];
  if (!q) return { kind: "ignore" };

  // ↓ INSERT HERE ↓
  if (!q.multiSelect && !state.chatFocused) {
    const digit = parseInt(data, 10);
    if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
      const targetIndex = digit - 1;
      const item = runtime.items[targetIndex];
      if (item?.kind === "option") {
        return {
          kind: "confirm",
          answer: {
            questionIndex: state.currentTab,
            question: q.question,
            kind: "option",
            answer: item.label,
          },
          autoAdvanceTab: computeAutoAdvanceTab(state, runtime),
        };
      }
    }
  }
  // ↑ END INSERT ↑

  if (data === NOTES_ACTIVATE_KEY && !q.multiSelect && state.focusedOptionHasPreview) {
  // ...rest of existing code...
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test 2>&1 | grep -E "(pass|fail|number-key)"
```

Expected: all number-key tests pass, no existing tests broken.

- [ ] **Step 5: Commit**

```bash
git add foundation/dialog/state/key-router.ts foundation/dialog/state/key-router.test.ts
git commit -m "feat: add number-key (1-9) jump-and-confirm to dialog key-router"
```

---

## Task 5: Add confirmDialog helper

**Files:**
- Create: `foundation/dialog/confirm-dialog.ts`
- Create: `foundation/dialog/confirm-dialog.test.ts`

- [ ] **Step 1: Write failing test for buildConfirmItems**

Create `foundation/dialog/confirm-dialog.test.ts`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildConfirmItems } from "./confirm-dialog.js";

describe("buildConfirmItems", () => {
  it("maps option array to WrappingSelectItems with kind=option", () => {
    const items = buildConfirmItems([
      { label: "Allow once", description: "Run this command once" },
      { label: "Cancel",     description: "Skip this command" },
    ]);
    assert.deepEqual(items, [
      { kind: "option", label: "Allow once", description: "Run this command once" },
      { kind: "option", label: "Cancel",     description: "Skip this command" },
    ]);
  });

  it("preserves order", () => {
    const items = buildConfirmItems([
      { label: "A", description: "first" },
      { label: "B", description: "second" },
      { label: "C", description: "third" },
    ]);
    assert.equal(items[0].label, "A");
    assert.equal(items[1].label, "B");
    assert.equal(items[2].label, "C");
  });

  it("returns empty array for empty input", () => {
    assert.deepEqual(buildConfirmItems([]), []);
  });

  it("supports more than 4 options (not limited by MAX_OPTIONS)", () => {
    const items = buildConfirmItems([
      { label: "One",   description: "" },
      { label: "Two",   description: "" },
      { label: "Three", description: "" },
      { label: "Four",  description: "" },
      { label: "Five",  description: "" },
    ]);
    assert.equal(items.length, 5);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test 2>&1 | grep -A3 "buildConfirmItems"
```

Expected: fail — `confirm-dialog.js` does not exist yet.

- [ ] **Step 3: Implement confirm-dialog.ts**

Create `foundation/dialog/confirm-dialog.ts`:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { QuestionnaireSession } from "./state/questionnaire-session.js";
import type { QuestionnaireResult } from "./tool/types.js";
import type { WrappingSelectItem } from "./view/components/wrapping-select.js";

export interface ConfirmOption {
  label: string;
  description: string;
}

/**
 * Build WrappingSelectItem list for use with QuestionnaireSession.
 * Unlike buildItemsForQuestion, this adds no sentinel rows ("Type something.", "Chat about this")
 * since confirmation dialogs don't need free-text or chat escape hatches.
 */
export function buildConfirmItems(options: ConfirmOption[]): WrappingSelectItem[] {
  return options.map((o) => ({ kind: "option" as const, label: o.label, description: o.description }));
}

/**
 * Show a structured confirmation dialog using the full QuestionnaireSession TUI.
 * Supports up to 9 options (not capped at MAX_OPTIONS=4 — that limit is for the LLM tool only).
 * Returns the selected option label, or null if cancelled or no UI.
 */
export async function confirmDialog(
  ctx: any,
  question: string,
  options: ConfirmOption[],
  header = "Confirm",
): Promise<string | null> {
  if (!ctx.hasUI) return null;

  const items = buildConfirmItems(options);

  // Cast to any: MAX_OPTIONS=4 is enforced at the LLM tool boundary (validateQuestionnaire),
  // not inside QuestionnaireSession itself. confirmDialog is not an agent tool call.
  const params = {
    questions: [{
      question,
      header: header.slice(0, 12),
      options: options.map((o) => ({ label: o.label, description: o.description })),
    }],
  } as any;

  const result = await ctx.ui.custom<QuestionnaireResult>((tui: any, theme: any, _kb: any, done: any) => {
    const session = new QuestionnaireSession({ tui, theme, params, itemsByTab: [items], done });
    return session.component;
  });

  if (!result || result.cancelled || result.answers.length === 0) return null;
  const answer = result.answers[0];
  if (!answer) return null;
  if (answer.kind === "chat") return null;
  return answer.answer;
}

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test 2>&1 | grep -E "(pass|fail|buildConfirmItems)"
```

Expected: all 4 `buildConfirmItems` tests pass.

- [ ] **Step 5: Commit**

```bash
git add foundation/dialog/confirm-dialog.ts foundation/dialog/confirm-dialog.test.ts
git commit -m "feat: add confirmDialog helper and buildConfirmItems to foundation/dialog"
```

---

## Task 6: Migrate safe-ops to use confirmDialog

**Files:**
- Modify: `foundation/safe-ops.ts`

There is one `ctx.ui.select()` call in `safe-ops.ts` (around line 326). It uses emoji-prefixed strings for both question and options. Replace it with `confirmDialog` and standardise the labels.

- [ ] **Step 1: Add import at the top of foundation/safe-ops.ts**

After the existing imports, add:

```typescript
import { confirmDialog } from "./dialog/index.js";
```

- [ ] **Step 2: Replace the ctx.ui.select call**

Find this block (around line 325–350):

```typescript
      const icon = SEVERITY_ICONS[severity];
      const choice = await ctx.ui.select(`${icon} Allow git ${action}?`, [
        `✅ Approve this once     — ${command.slice(0, 50)}`,
        `✅✅ Approve all "${action}" this session`,
        severity === "high" ? `🚫 Block this once` : `🚫 Block all "${action}" this session`,
      ]);

      if (!choice) {
        ctx.ui.notify(`Git ${action} canceled`, "info");
        return { block: true, reason: `Git ${action} canceled by user` };
      }

      if (choice.startsWith("🚫")) {
        if (choice.includes("all")) {
          gitBlocked.add(action);
          ctx.ui.notify(`🚫 All git ${action} auto-blocked this session`, "warning");
        }
        return { block: true, reason: `Git ${action} blocked by user` };
      }

      if (choice.startsWith("✅✅")) {
        gitApproved.add(action);
        ctx.ui.notify(`✅ All git ${action} auto-approved this session`, "info");
      } else {
        ctx.ui.notify(`Git ${action} approved once`, "info");
      }
```

Replace with:

```typescript
      const icon = SEVERITY_ICONS[severity];
      const blockLabel = severity === "high" ? "Block" : "Block this session";
      const choice = await confirmDialog(
        ctx,
        `${icon} Allow git ${action}?\n  ${command.slice(0, 80)}`,
        [
          { label: "Allow once",         description: "Run this command, ask again next time" },
          { label: "Allow this session",  description: `Approve all "${action}" commands until session ends` },
          { label: blockLabel,            description: "Skip this command" },
        ],
        "Safe Git",
      );

      if (!choice || choice === "Block" || choice === "Block this session") {
        if (choice === "Block this session") {
          gitBlocked.add(action);
          ctx.ui.notify(`Git ${action} blocked for this session`, "warning");
        } else {
          ctx.ui.notify(`Git ${action} canceled`, "info");
        }
        return { block: true, reason: `Git ${action} blocked by user` };
      }

      if (choice === "Allow this session") {
        gitApproved.add(action);
        ctx.ui.notify(`Git ${action} approved for this session`, "info");
      } else {
        ctx.ui.notify(`Git ${action} approved once`, "info");
      }
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add foundation/safe-ops.ts
git commit -m "feat: migrate safe-ops confirmations to confirmDialog TUI"
```

---

## Task 7: Migrate permission to use confirmDialog

**Files:**
- Modify: `foundation/permission/permission.ts`

There are 9 `ctx.ui.select()` calls to replace. Work through them one function at a time.

- [ ] **Step 1: Add import at the top of foundation/permission/permission.ts**

After the existing imports, add:

```typescript
import { confirmDialog } from "../dialog/index.js";
```

- [ ] **Step 2: Replace handlePermissionCommand — direct level set scope selector**

Find (around line 291):

```typescript
      const scope = await ctx.ui.select("Save permission level to:", [
        "Session only",
        "Global (persists)",
      ]);
      if (!scope) return;
      setLevel(state, newLevel, scope === "Global (persists)", ctx);
      const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
```

Replace with:

```typescript
      const scope = await confirmDialog(ctx, `Set permission to ${LEVEL_INFO[newLevel].label}`, [
        { label: "Session only",     description: "Takes effect now, reverts when session ends" },
        { label: "Global (persists)", description: "Saved to settings.json, applies to all sessions" },
      ], "Scope");
      if (!scope) return;
      setLevel(state, newLevel, scope === "Global (persists)", ctx);
      const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
```

- [ ] **Step 3: Replace handlePermissionCommand — level selector**

Find (around line 317):

```typescript
  const choice = await ctx.ui.select("Select permission level", options);
  if (!choice) return;

  const selectedLabel = choice.split(":")[0].trim();
  const newLevel = LEVELS.find((l) => LEVEL_INFO[l].label === selectedLabel);
  if (!newLevel || newLevel === state.currentLevel) return;

  const scope = await ctx.ui.select("Save to:", ["Session only", "Global (persists)"]);
  if (!scope) return;

  setLevel(state, newLevel, scope === "Global (persists)", ctx);
  const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
  ctx.ui.notify(`Permission: ${LEVEL_INFO[newLevel].label}${saveMsg}`, "info");
```

Replace with:

```typescript
  const levelChoice = await confirmDialog(
    ctx,
    "Select permission level",
    LEVELS.map((level) => ({
      label: LEVEL_INFO[level].label + (level === state.currentLevel ? " (current)" : ""),
      description: LEVEL_INFO[level].desc,
    })),
    "Permission",
  );
  if (!levelChoice) return;

  const chosenLabel = levelChoice.replace(" (current)", "").trim();
  const newLevel = LEVELS.find((l) => LEVEL_INFO[l].label === chosenLabel);
  if (!newLevel || newLevel === state.currentLevel) return;

  const scope = await confirmDialog(ctx, `Set permission to ${LEVEL_INFO[newLevel].label}`, [
    { label: "Session only",     description: "Takes effect now, reverts when session ends" },
    { label: "Global (persists)", description: "Saved to settings.json, applies to all sessions" },
  ], "Scope");
  if (!scope) return;

  setLevel(state, newLevel, scope === "Global (persists)", ctx);
  const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
  ctx.ui.notify(`Permission: ${LEVEL_INFO[newLevel].label}${saveMsg}`, "info");
```

- [ ] **Step 4: Replace handlePermissionModeCommand — direct mode set scope selector**

Find (around line 350):

```typescript
      const scope = await ctx.ui.select("Save permission mode to:", [
        "Session only",
        "Global (persists)",
      ]);
      if (!scope) return;
      setMode(state, newMode, scope === "Global (persists)", ctx);
      const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
```

Replace with:

```typescript
      const scope = await confirmDialog(ctx, `Set permission mode to ${PERMISSION_MODE_INFO[newMode].label}`, [
        { label: "Session only",     description: "Takes effect now, reverts when session ends" },
        { label: "Global (persists)", description: "Saved to settings.json, applies to all sessions" },
      ], "Scope");
      if (!scope) return;
      setMode(state, newMode, scope === "Global (persists)", ctx);
      const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
```

- [ ] **Step 5: Replace handlePermissionModeCommand — mode selector**

Find (around line 374):

```typescript
  const choice = await ctx.ui.select("Select permission mode", options);
  if (!choice) return;

  const selectedLabel = choice.split(":")[0].trim();
  const newMode = PERMISSION_MODES.find((m) => PERMISSION_MODE_INFO[m].label === selectedLabel);
  if (!newMode || newMode === state.permissionMode) return;

  const scope = await ctx.ui.select("Save to:", ["Session only", "Global (persists)"]);
  if (!scope) return;

  setMode(state, newMode, scope === "Global (persists)", ctx);
  const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
  ctx.ui.notify(`Permission mode: ${PERMISSION_MODE_INFO[newMode].label}${saveMsg}`, "info");
```

Replace with:

```typescript
  const modeChoice = await confirmDialog(
    ctx,
    "Select permission mode",
    PERMISSION_MODES.map((mode) => ({
      label: PERMISSION_MODE_INFO[mode].label + (mode === state.permissionMode ? " (current)" : ""),
      description: PERMISSION_MODE_INFO[mode].desc,
    })),
    "Mode",
  );
  if (!modeChoice) return;

  const chosenLabel = modeChoice.replace(" (current)", "").trim();
  const newMode = PERMISSION_MODES.find((m) => PERMISSION_MODE_INFO[m].label === chosenLabel);
  if (!newMode || newMode === state.permissionMode) return;

  const scope = await confirmDialog(ctx, `Set permission mode to ${PERMISSION_MODE_INFO[newMode].label}`, [
    { label: "Session only",     description: "Takes effect now, reverts when session ends" },
    { label: "Global (persists)", description: "Saved to settings.json, applies to all sessions" },
  ], "Scope");
  if (!scope) return;

  setMode(state, newMode, scope === "Global (persists)", ctx);
  const saveMsg = scope === "Global (persists)" ? " (saved globally)" : " (session only)";
  ctx.ui.notify(`Permission mode: ${PERMISSION_MODE_INFO[newMode].label}${saveMsg}`, "info");
```

- [ ] **Step 6: Replace handleBashToolCall — safety patterns prompt**

Find (around line 467):

```typescript
    const choice = await ctx.ui.select(
      `⚠️  Safety violation: ${categories}\n\n  ${command}\n\nReasons:\n${matchDetails}\n\nExecute anyway?`,
      ["Block", "Allow once"]
    );

    if (choice !== "Allow once") {
      return { block: true, reason: "Blocked by safety net" };
    }
```

Replace with:

```typescript
    const choice = await confirmDialog(
      ctx,
      `⚠️ Safety violation: ${categories}\n  ${command}\n\n${matchDetails}`,
      [
        { label: "Block",      description: "Skip this command (recommended)" },
        { label: "Allow once", description: "Run this command despite the safety warning" },
      ],
      "Safety",
    );

    if (choice !== "Allow once") {
      return { block: true, reason: "Blocked by safety net" };
    }
```

- [ ] **Step 7: Replace handleBashToolCall — dangerous command prompt**

Find (around line 499):

```typescript
    const choice = await ctx.ui.select(
      `⚠️ Dangerous command`,
      ["Allow once", "Cancel"]
    );

    if (choice !== "Allow once") {
      return { block: true, reason: "Cancelled" };
    }
```

Replace with:

```typescript
    const choice = await confirmDialog(
      ctx,
      `⚠️ Dangerous command\n  ${command}`,
      [
        { label: "Cancel",     description: "Skip this command (recommended)" },
        { label: "Allow once", description: "Run this dangerous command once" },
      ],
      "Danger",
    );

    if (choice !== "Allow once") {
      return { block: true, reason: "Cancelled" };
    }
```

- [ ] **Step 8: Replace handleBashToolCall — tier-based level check (collapse 2-step into 4 options)**

Find (around line 536):

```typescript
  const choice = await ctx.ui.select(
    `Requires ${requiredInfo.label}`,
    ["Allow once", `Allow all (${requiredInfo.label})`, "Cancel"]
  );

  if (choice === "Allow once") return undefined;

  if (choice === `Allow all (${requiredInfo.label})`) {
    setLevel(state, requiredLevel, true, ctx);
    ctx.ui.notify(`Permission → ${requiredInfo.label} (saved globally)`, "info");
    return undefined;
  }

  return { block: true, reason: "Cancelled" };
```

Replace with:

```typescript
  const choice = await confirmDialog(
    ctx,
    `Requires ${requiredInfo.label}\n  ${command}`,
    [
      { label: "Allow once",      description: "Run this command, ask again next time" },
      { label: "Allow (session)", description: `Raise permission to ${requiredInfo.label} until session ends` },
      { label: "Allow (global)",  description: `Save ${requiredInfo.label} as default in settings.json` },
      { label: "Cancel",          description: "Skip this command" },
    ],
    "Permission",
  );

  if (choice === "Allow once") return undefined;

  if (choice === "Allow (session)") {
    setLevel(state, requiredLevel, false, ctx);
    ctx.ui.notify(`Permission → ${requiredInfo.label} (session only)`, "info");
    return undefined;
  }

  if (choice === "Allow (global)") {
    setLevel(state, requiredLevel, true, ctx);
    ctx.ui.notify(`Permission → ${requiredInfo.label} (saved globally)`, "info");
    return undefined;
  }

  return { block: true, reason: "Cancelled" };
```

- [ ] **Step 9: Replace handleWriteToolCall — protected path prompt**

Find (around line 593):

```typescript
    const choice = await ctx.ui.select(
      `🛡️  Protected path: ${action}\n\n  → ${filePath}\n\n${detail}\n\nAllow this write?`,
      ["Block", "Allow"]
    );

    if (choice !== "Allow") {
      return { block: true, reason: "Protected path write blocked by user" };
    }
```

Replace with:

```typescript
    const choice = await confirmDialog(
      ctx,
      `🛡️ Protected path: ${action}\n  ${filePath}\n\n${detail}`,
      [
        { label: "Block", description: "Skip this write (recommended)" },
        { label: "Allow", description: "Write to this protected path anyway" },
      ],
      "Protected",
    );

    if (choice !== "Allow") {
      return { block: true, reason: "Protected path write blocked by user" };
    }
```

- [ ] **Step 10: Replace handleWriteToolCall — tier-based level check**

Find (around line 631):

```typescript
  const choice = await ctx.ui.select(
    message,
    ["Allow once", "Allow all (Low)", "Cancel"]
  );

  if (choice === "Allow once") return undefined;

  if (choice === "Allow all (Low)") {
    setLevel(state, "low", true, ctx);
    ctx.ui.notify(`Permission → Low (saved globally)`, "info");
    return undefined;
  }

  return { block: true, reason: "Cancelled" };
```

Replace with:

```typescript
  const choice = await confirmDialog(
    ctx,
    `Requires Low permission\n  ${action} ${filePath}`,
    [
      { label: "Allow once",      description: "Perform this write, ask again next time" },
      { label: "Allow (session)", description: "Raise permission to Low until session ends" },
      { label: "Allow (global)",  description: "Save Low as default in settings.json" },
      { label: "Cancel",          description: "Skip this write" },
    ],
    "Permission",
  );

  if (choice === "Allow once") return undefined;

  if (choice === "Allow (session)") {
    setLevel(state, "low", false, ctx);
    ctx.ui.notify(`Permission → Low (session only)`, "info");
    return undefined;
  }

  if (choice === "Allow (global)") {
    setLevel(state, "low", true, ctx);
    ctx.ui.notify(`Permission → Low (saved globally)`, "info");
    return undefined;
  }

  return { block: true, reason: "Cancelled" };
```

- [ ] **Step 11: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add foundation/permission/permission.ts
git commit -m "feat: migrate permission confirmations to confirmDialog TUI"
```

---

## Task 8: Final cleanup and verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Confirm no orphan imports remain**

```bash
grep -r "ctx\.ui\.select" foundation/safe-ops.ts foundation/permission/permission.ts
```

Expected: no output (all `ctx.ui.select` calls replaced).

- [ ] **Step 2: Confirm ask-user-question no longer references removed directories**

```bash
grep -r "from.*\./state\|from.*\./view\|from.*\./tool" core-tools/ask-user-question/ask-user-question.ts
```

Expected: no output (all old relative imports gone).

- [ ] **Step 3: Run full test suite one final time**

```bash
npm test
```

Expected: all tests pass with no errors.

- [ ] **Step 4: Commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore: dialog unification cleanup and final verification"
```

---

## Summary

| Task | Outcome |
|------|---------|
| 1 | All TUI source files live under `foundation/dialog/` |
| 2 | Barrel `foundation/dialog/index.ts` re-exports everything |
| 3 | `ask-user-question` is a thin wrapper over `foundation/dialog` |
| 4 | Number-key (1–9) selection works in all single-select dialogs |
| 5 | `confirmDialog()` helper for 2–9 option confirmations |
| 6 | `safe-ops` uses consistent labelled confirmations |
| 7 | `permission` uses consistent labelled confirmations, scope dialog collapsed |
| 8 | All tests pass, no `ctx.ui.select` left in safe-ops or permission |
