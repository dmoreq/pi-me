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
    assert.notEqual(action.kind, "confirm");
  });

  it("number key is ignored when notesVisible is true", () => {
    const action = routeKey("1", makeState({ notesVisible: true }), makeRuntime());
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
    const action = routeKey("a", makeState(), makeRuntime());
    assert.equal(action.kind, "ignore");
  });
});
