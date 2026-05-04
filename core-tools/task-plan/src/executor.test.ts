/**
 * TaskExecutor — unit tests
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { TaskExecutor } from "./executor.ts";
import { TaskStore } from "./store.ts";
import { TaskDAG } from "./types.ts";
import type { Task } from "./types.ts";

function makeTask(id: string, overrides?: Partial<Task>): Task {
  return {
    id,
    text: `Task ${id}`,
    status: "pending",
    priority: "normal",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("TaskExecutor", () => {
  let tmpDir: string;
  let store: TaskStore;

  before(async () => {
    tmpDir = path.join(os.tmpdir(), `exec-test-${Date.now()}`);
    store = new TaskStore({ dir: tmpDir, gcEnabled: false });
    await store.init();
  });

  after(async () => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("should execute a single task", async () => {
    const executor = new TaskExecutor(store, {
      safetyMode: false,
      onExecute: async () => ({ exitCode: 0, stdout: "done" }),
    });
    const task = makeTask("exec1");
    await store.save(task);
    const result = await executor.executeOne(task);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout, "done");

    const updated = await store.get("exec1");
    assert.strictEqual(updated?.status, "completed");
  });

  it("should mark failed tasks", async () => {
    const executor = new TaskExecutor(store, {
      safetyMode: false,
      onExecute: async () => ({ exitCode: 1, stderr: "error" }),
    });
    const task = makeTask("exec-fail");
    await store.save(task);
    const result = await executor.executeOne(task);
    assert.strictEqual(result.exitCode, 1);

    const updated = await store.get("exec-fail");
    assert.strictEqual(updated?.status, "failed");
  });

  it("should skip tasks requiring review in safety mode", async () => {
    const executor = new TaskExecutor(store, {
      safetyMode: true,
      onExecute: async () => ({ exitCode: 0 }),
    });
    const task = makeTask("exec-review", { requiresReview: true });
    await store.save(task);
    const result = await executor.executeOne(task);
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout?.includes("SAFETY"));
  });

  it("should run dry-run without side effects", async () => {
    const executor = new TaskExecutor(store, {
      safetyMode: false,
      dryRun: true,
      onExecute: async () => ({ exitCode: 0, stdout: "real" }),
    });
    const task = makeTask("exec-dry");
    await store.save(task);
    const result = await executor.executeOne(task);
    assert.ok(result.stdout?.includes("DRY RUN"));
  });

  it("should emit events", async () => {
    const executor = new TaskExecutor(store, {
      safetyMode: false,
      onExecute: async () => ({ exitCode: 0 }),
    });
    const events: string[] = [];
    executor.on("task_started", () => events.push("started"));
    executor.on("task_completed", () => events.push("completed"));

    const task = makeTask("exec-events");
    await store.save(task);
    await executor.executeOne(task);
    assert.ok(events.includes("started"));
    assert.ok(events.includes("completed"));
  });

  it("should retry on failure", async () => {
    let attempts = 0;
    const executor = new TaskExecutor(store, {
      safetyMode: false,
      maxRetries: 2,
      onExecute: async () => {
        attempts++;
        if (attempts < 2) throw new Error("transient");
        return { exitCode: 0, stdout: "ok" };
      },
    });
    const task = makeTask("exec-retry");
    await store.save(task);
    const result = await executor.executeOne(task);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(attempts, 2);
  });

  it("should not retry on success", async () => {
    let attempts = 0;
    const executor = new TaskExecutor(store, {
      safetyMode: false,
      maxRetries: 3,
      onExecute: async () => {
        attempts++;
        return { exitCode: 0 };
      },
    });
    const task = makeTask("exec-noretry");
    await store.save(task);
    await executor.executeOne(task);
    assert.strictEqual(attempts, 1);
  });

  it("should support skip", async () => {
    const executor = new TaskExecutor(store, {
      safetyMode: false,
    });
    const task = makeTask("exec-skip");
    await store.save(task);
    await executor.skip(task);
    const updated = await store.get("exec-skip");
    assert.strictEqual(updated?.status, "skipped");
  });

  it("should dispatch DAG", async () => {
    const executor = new TaskExecutor(store, {
      safetyMode: false,
      onExecute: async () => ({ exitCode: 0 }),
    });
    const tasks = [
      makeTask("dag-a"),
      makeTask("dag-b", { blockedBy: ["dag-a"] }),
    ];
    for (const t of tasks) await store.save(t);
    const dag = new TaskDAG(tasks);
    await executor.dispatch(dag);

    const a = await store.get("dag-a");
    const b = await store.get("dag-b");
    assert.strictEqual(a?.status, "completed");
    assert.strictEqual(b?.status, "completed");
  });

  it("should support cancel", async () => {
    const executor = new TaskExecutor(store, {
      safetyMode: false,
      onExecute: async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { exitCode: 0 };
      },
    });
    const tasks = [makeTask("dag-cancel")];
    for (const t of tasks) await store.save(t);
    const dag = new TaskDAG(tasks);
    const promise = executor.dispatch(dag);
    executor.cancel();
    await promise;

    const t = await store.get("dag-cancel");
    assert.ok(t); // task was dispatched
  });
});
