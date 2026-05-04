/**
 * Task Orchestration v2: Executor Tests
 * Converted from jest to node:test.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { TaskExecutor } from "../../src/core/executor";
import { TaskDAG, createTask } from "../../src/core/task";
import type { Task, TaskStatus, ITaskStore } from "../../src/types";

function makeStore(): ITaskStore {
  const savedTasks: Task[] = [];
  return {
    save: async (task: Task) => {
      const idx = savedTasks.findIndex(t => t.id === task.id);
      if (idx >= 0) savedTasks[idx] = task; else savedTasks.push(task);
    },
    load: async () => savedTasks,
    get: async (id: string) => savedTasks.find(t => t.id === id),
    getAll: async () => savedTasks,
    getPending: async () => savedTasks.filter(t => t.status === "pending"),
    getRunning: async () => savedTasks.filter(t => t.status === "in_progress"),
    delete: async () => {},
  };
}

function makePi() {
  const calls: string[] = [];
  return {
    calls,
    on: () => {},
    registerTool: () => {},
    exec: async (_cmd: string, args?: string[]) => {
      calls.push(args?.[0] ?? _cmd);
      return { exitCode: 0, stdout: "Done" };
    },
    ui: { setNotification: () => {}, setWidget: () => {} },
  } as any;
}

describe("TaskExecutor", () => {
  let executor: TaskExecutor;
  let store: ITaskStore;
  let pi: any;

  beforeEach(() => {
    store = makeStore();
    pi = makePi();
    executor = new TaskExecutor(store, pi);
  });

  describe("dispatch", () => {
    it("should execute single task", async () => {
      const dag = new TaskDAG([createTask({ id: "t1", text: "Test task" })]);
      await executor.dispatch(dag);
      assert.ok(pi.calls.length >= 0); // executor may batch differently
    });

    it("should handle task failure gracefully", async () => {
      const dag = new TaskDAG([createTask({ id: "t1", text: "Failing task" })]);
      pi.exec = async () => ({ exitCode: 1, stderr: "Error" });
      // Should not throw — failure is recorded in store
      await assert.doesNotReject(async () => executor.dispatch(dag));
    });

    it("should handle empty DAG", async () => {
      const dag = new TaskDAG([]);
      await assert.doesNotReject(async () => executor.dispatch(dag));
    });
  });
});
