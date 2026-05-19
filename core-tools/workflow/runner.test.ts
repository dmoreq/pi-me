import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WorkflowStore } from "./store.ts";
import { WorkflowExecutor } from "./executor.ts";
import { WorkflowRunner } from "./runner.ts";

async function withRunner<T>(fn: (runner: WorkflowRunner, store: WorkflowStore) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "workflow-runner-"));
  const store = new WorkflowStore(dir);
  await store.init();
  const runner = new WorkflowRunner(store, new WorkflowExecutor());
  try { return await fn(runner, store); } finally { await rm(dir, { recursive: true, force: true }); }
}

describe("WorkflowRunner", () => {
  it("runs a shell step", async () => {
    await withRunner(async (runner, store) => {
      await store.save({ id: "w1", title: "Demo", status: "draft", priority: "normal", source: "manual", steps: [{ id: "1", text: "Run", status: "pending", executor: "shell", command: "node", args: ["-e", "console.log('ok')"] }], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const wf = await runner.runStep("w1", "1");
      assert.equal(wf.status, "completed");
    });
  });
});
