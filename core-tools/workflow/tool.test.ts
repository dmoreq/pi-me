import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WorkflowStore } from "./store.ts";
import { WorkflowExecutor } from "./executor.ts";
import { WorkflowRunner } from "./runner.ts";
import { createWorkflowTool } from "./tool.ts";

describe("workflow tool", () => {
  it("creates checklist text on list", async () => {
    const store = new WorkflowStore();
    await store.init();
    const tool = createWorkflowTool({ store, executor: new WorkflowExecutor(), runner: new WorkflowRunner(store, new WorkflowExecutor()), getSessionId: () => "s1", notify: () => {}, track: () => {}, getActiveWorkflow: async () => null });
    const out = await tool.execute("1", { action: "list" });
    assert.ok(out.content[0].text);
  });
});
