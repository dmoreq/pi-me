/**
 * TaskDAG — unit tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TaskDAG } from "./types.ts";
import type { Task } from "./types.ts";

function makeTask(id: string, blockedBy?: string[]): Task {
  return {
    id,
    text: `Task ${id}`,
    status: "pending",
    priority: "normal",
    createdAt: new Date().toISOString(),
    blockedBy,
  };
}

describe("TaskDAG", () => {
  it("should detect no cycle in empty DAG", () => {
    const dag = new TaskDAG([]);
    assert.strictEqual(dag.hasCycle(), false);
  });

  it("should detect no cycle in linear DAG", () => {
    const tasks = [
      makeTask("a"),
      makeTask("b", ["a"]),
      makeTask("c", ["b"]),
    ];
    const dag = new TaskDAG(tasks);
    assert.strictEqual(dag.hasCycle(), false);
  });

  it("should detect cycle", () => {
    const tasks = [
      makeTask("a", ["c"]),
      makeTask("b", ["a"]),
      makeTask("c", ["b"]),
    ];
    assert.throws(() => new TaskDAG(tasks), /cycle/i);
  });

  it("should topological sort linear DAG", () => {
    const tasks = [
      makeTask("a"),
      makeTask("b", ["a"]),
      makeTask("c", ["b"]),
    ];
    const dag = new TaskDAG(tasks);
    const batches = dag.topologicalSort();
    assert.deepStrictEqual(batches, [["a"], ["b"], ["c"]]);
  });

  it("should return parallel batches for independent tasks", () => {
    const tasks = [
      makeTask("a"),
      makeTask("b"),
      makeTask("c"),
    ];
    const dag = new TaskDAG(tasks);
    const batches = dag.topologicalSort();
    assert.strictEqual(batches.length, 1);
    assert.strictEqual(batches[0].length, 3);
  });

  it("should handle mixed parallel and sequential dependencies", () => {
    const tasks = [
      makeTask("a"),
      makeTask("b"),
      makeTask("c", ["a"]),
      makeTask("d", ["a", "b"]),
    ];
    const dag = new TaskDAG(tasks);
    const batches = dag.topologicalSort();
    // a and b in first batch, c and d in second
    assert.strictEqual(batches[0].sort().join(","), "a,b");
    assert.ok(batches[1].includes("c"));
    assert.ok(batches[1].includes("d"));
  });

  it("should return ready tasks (all deps completed)", () => {
    const tasks = [
      makeTask("a"),
      makeTask("b", ["a"]),
      makeTask("c", ["a", "b"]),
    ];
    const dag = new TaskDAG(tasks);
    // Mark a as completed
    const aTask = dag.getTask("a");
    if (aTask) aTask.status = "completed";

    const ready = dag.getReadyTasks();
    assert.strictEqual(ready.length, 1);
    assert.strictEqual(ready[0].id, "b");
  });

  it("should return empty ready when all completed", () => {
    const tasks = [
      makeTask("a"),
      makeTask("b", ["a"]),
    ];
    const dag = new TaskDAG(tasks);
    const a = dag.getTask("a");
    const b = dag.getTask("b");
    if (a) a.status = "completed";
    if (b) b.status = "completed";
    assert.strictEqual(dag.getReadyTasks().length, 0);
  });

  it("should get task by id", () => {
    const tasks = [makeTask("test1")];
    const dag = new TaskDAG(tasks);
    const t = dag.getTask("test1");
    assert.ok(t);
    assert.strictEqual(t?.id, "test1");
    assert.strictEqual(dag.getTask("nonexistent"), undefined);
  });

  it("should return all tasks", () => {
    const tasks = [makeTask("a"), makeTask("b")];
    const dag = new TaskDAG(tasks);
    assert.strictEqual(dag.getAllTasks().length, 2);
  });
});
