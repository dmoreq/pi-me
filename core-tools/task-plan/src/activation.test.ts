import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { TaskStore } from "./store.ts";
import { TaskExecutor } from "./executor.ts";
import { createTaskPlanTool } from "./tool.ts";
import type { Task } from "./types.ts";

const makeTempDir = async () => fs.mkdtemp(path.join(os.tmpdir(), "task-plan-activation-"));

const makeTool = async (dir: string) => {
  const store = new TaskStore({ dir, gcEnabled: false });
  await store.init();
  return {
    store,
    tool: createTaskPlanTool({
      store,
      executor: new TaskExecutor(store, { safetyMode: false, dryRun: true, onExecute: async (task: Task) => ({ exitCode: 0, stdout: task.text }) }),
      getSessionId: () => "session-1",
      notify: () => undefined,
      track: () => undefined,
    }),
  };
};

describe("task plan activation", () => {
  it("treats plans as activated instead of executed", async () => {
    const dir = await makeTempDir();
    const { store, tool } = await makeTool(dir);
    await store.save({ id: "plan-1", title: "Plan", text: "Plan", status: "pending", priority: "normal", source: "manual", createdAt: new Date().toISOString(), steps: [{ id: 1, text: "one", done: false }], requiresReview: true });

    const result = await tool.execute("1", { action: "execute", id: "plan-1" }, null as any, null as any, null as any);

    assert.ok(result.content[0].text.includes("Remaining steps"));
    assert.ok(!result.content[0].text.includes("Executing task"));
  });
});
