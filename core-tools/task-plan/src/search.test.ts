import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { TaskStore } from "./store.ts";
import { TaskExecutor } from "./executor.ts";
import { createTaskPlanTool } from "./tool.ts";
import type { Task } from "./types.ts";

const makeTempDir = async () => fs.mkdtemp(path.join(os.tmpdir(), "task-plan-search-"));

const makeTool = async (dir: string) => {
  const store = new TaskStore({ dir, gcEnabled: false });
  await store.init();
  const tool = createTaskPlanTool({
    store,
    executor: new TaskExecutor(store, { safetyMode: false, dryRun: true, onExecute: async (task: Task) => ({ exitCode: 0, stdout: task.text }) }),
    getSessionId: () => "session-1",
    notify: () => undefined,
    track: () => undefined,
  });
  return { store, tool };
};

describe("task search", () => {
  it("filters by status and tags", async () => {
    const dir = await makeTempDir();
    const { store, tool } = await makeTool(dir);
    await store.save({ id: "a", text: "Alpha", status: "pending", priority: "normal", source: "manual", createdAt: new Date().toISOString(), tags: ["ui"], requiresReview: true });
    await store.save({ id: "b", text: "Beta", status: "completed", priority: "high", source: "manual", createdAt: new Date().toISOString(), tags: ["api"], requiresReview: false });

    const result = await tool.execute("1", { action: "search", query: "a", status: "pending" }, null as any, null as any, null as any);
    assert.ok(result.content[0].text.includes("Alpha"));
    assert.ok(!result.content[0].text.includes("Beta"));
  });
});
