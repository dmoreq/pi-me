import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderChecklist, shouldShowChecklist } from "./ui.ts";

describe("workflow ui", () => {
  it("renders active checklist", () => {
    const wf = { id: "w1", title: "Demo", status: "active" as const, priority: "normal" as const, source: "manual" as const, steps: [{ id: "1", text: "One", status: "pending" as const, executor: "manual" as const }], createdAt: "now", updatedAt: "now" };
    assert.ok(shouldShowChecklist(wf));
    assert.ok(renderChecklist(wf).includes("One"));
  });
});
