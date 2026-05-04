/**
 * Task Orchestration v2: Task Model & DAG Tests
 * Converted from jest to node:test runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TaskDAG, createTask, isCompleted, isFailed, isRunning, isPending } from "../../src/core/task";
import type { TaskStatus } from "../../src/types";

describe("TaskDAG", () => {
  describe("construction", () => {
    it("should create empty DAG", () => {
      const dag = new TaskDAG([]);
      assert.strictEqual(dag.getAllTasks().length, 0);
    });
    it("should create DAG with single task", () => {
      const dag = new TaskDAG([createTask({ id: "A", text: "Task A" })]);
      assert.strictEqual(dag.getAllTasks().length, 1);
    });
    it("should create DAG with multiple tasks", () => {
      const dag = new TaskDAG([createTask({ id: "A" }), createTask({ id: "B" }), createTask({ id: "C" })]);
      assert.strictEqual(dag.getAllTasks().length, 3);
    });
    it("should preserve task order", () => {
      const dag = new TaskDAG([createTask({ id: "X" }), createTask({ id: "Y" }), createTask({ id: "Z" })]);
      assert.deepStrictEqual(dag.getAllTasks().map(t => t.id), ["X", "Y", "Z"]);
    });
  });

  describe("topologicalSort", () => {
    it("should sort single task", () => {
      const dag = new TaskDAG([createTask({ id: "A" })]);
      assert.deepStrictEqual(dag.topologicalSort(), [["A"]]);
    });
    it("should sort linear chain A→B→C", () => {
      const dag = new TaskDAG([
        createTask({ id: "A", blockedBy: [] }),
        createTask({ id: "B", blockedBy: ["A"] }),
        createTask({ id: "C", blockedBy: ["B"] }),
      ]);
      assert.deepStrictEqual(dag.topologicalSort(), [["A"], ["B"], ["C"]]);
    });
    it("should batch parallel tasks A,B → C", () => {
      const dag = new TaskDAG([
        createTask({ id: "A", blockedBy: [] }),
        createTask({ id: "B", blockedBy: [] }),
        createTask({ id: "C", blockedBy: ["A", "B"] }),
      ]);
      const sorted = dag.topologicalSort();
      assert.strictEqual(sorted.length, 2);
      assert.ok(sorted[0].includes("A") && sorted[0].includes("B"), "batch 0 should contain A and B");
      assert.deepStrictEqual(sorted[1], ["C"]);
    });
    it("should handle diamond pattern A→B,C→D", () => {
      const dag = new TaskDAG([
        createTask({ id: "A", blockedBy: [] }),
        createTask({ id: "B", blockedBy: ["A"] }),
        createTask({ id: "C", blockedBy: ["A"] }),
        createTask({ id: "D", blockedBy: ["B", "C"] }),
      ]);
      const sorted = dag.topologicalSort();
      assert.deepStrictEqual(sorted[0], ["A"]);
      assert.ok(sorted[1].includes("B") && sorted[1].includes("C"));
      assert.deepStrictEqual(sorted[2], ["D"]);
    });
    it("should handle all parallel (no deps)", () => {
      const dag = new TaskDAG([
        createTask({ id: "A", blockedBy: [] }),
        createTask({ id: "B", blockedBy: [] }),
        createTask({ id: "C", blockedBy: [] }),
      ]);
      const sorted = dag.topologicalSort();
      assert.strictEqual(sorted.length, 1);
      assert.strictEqual(sorted[0].length, 3);
    });
  });

  describe("hasCycle", () => {
    it("should detect simple 2-node cycle A→B→A", () => {
      const dag = new TaskDAG([
        createTask({ id: "A", blockedBy: ["B"] }),
        createTask({ id: "B", blockedBy: ["A"] }),
      ]);
      assert.throws(() => dag.hasCycle(), /cycle/i);
    });
    it("should detect 3-node cycle A→B→C→A", () => {
      const dag = new TaskDAG([
        createTask({ id: "A", blockedBy: ["C"] }),
        createTask({ id: "B", blockedBy: ["A"] }),
        createTask({ id: "C", blockedBy: ["B"] }),
      ]);
      assert.throws(() => dag.hasCycle(), /cycle/i);
    });
    it("should not throw for valid DAG", () => {
      const dag = new TaskDAG([
        createTask({ id: "A", blockedBy: [] }),
        createTask({ id: "B", blockedBy: ["A"] }),
      ]);
      assert.doesNotThrow(() => dag.hasCycle());
    });
    it("should not throw for single task", () => {
      const dag = new TaskDAG([createTask({ id: "A", blockedBy: [] })]);
      assert.doesNotThrow(() => dag.hasCycle());
    });
    it("should not throw for linear chain", () => {
      const dag = new TaskDAG([
        createTask({ id: "A", blockedBy: [] }),
        createTask({ id: "B", blockedBy: ["A"] }),
        createTask({ id: "C", blockedBy: ["B"] }),
      ]);
      assert.doesNotThrow(() => dag.hasCycle());
    });
    it("cycle error should include cycle path", () => {
      const dag = new TaskDAG([
        createTask({ id: "A", blockedBy: ["B"] }),
        createTask({ id: "B", blockedBy: ["A"] }),
      ]);
      assert.throws(() => dag.hasCycle(), /A|B/);
    });
  });

  describe("getUnblocked", () => {
    it("should return tasks with no dependencies", () => {
      const dag = new TaskDAG([
        createTask({ id: "A", blockedBy: [] }),
        createTask({ id: "B", blockedBy: ["A"] }),
      ]);
      const unblocked = dag.getUnblocked();
      assert.strictEqual(unblocked.length, 1);
      assert.strictEqual(unblocked[0].id, "A");
    });
    it("should return all parallel tasks", () => {
      const dag = new TaskDAG([
        createTask({ id: "A", blockedBy: [] }),
        createTask({ id: "B", blockedBy: [] }),
        createTask({ id: "C", blockedBy: ["A"] }),
      ]);
      const unblocked = dag.getUnblocked();
      assert.strictEqual(unblocked.length, 2);
      assert.ok(unblocked.map(t => t.id).includes("A"));
      assert.ok(unblocked.map(t => t.id).includes("B"));
    });
    it("should filter by status", () => {
      const dag = new TaskDAG([
        createTask({ id: "A", blockedBy: [], status: "pending" as TaskStatus }),
        createTask({ id: "B", blockedBy: [], status: "in_progress" as TaskStatus }),
      ]);
      const unblocked = dag.getUnblocked("pending" as TaskStatus);
      assert.strictEqual(unblocked.length, 1);
      assert.strictEqual(unblocked[0].id, "A");
    });
  });

  describe("Task helpers", () => {
    it("isCompleted checks completed and skipped", () => {
      assert.ok(isCompleted(createTask({ status: "completed" as TaskStatus })));
      assert.ok(isCompleted(createTask({ status: "skipped" as TaskStatus })));
      assert.ok(!isCompleted(createTask({ status: "pending" as TaskStatus })));
    });
    it("isFailed checks failed status", () => {
      assert.ok(isFailed(createTask({ status: "failed" as TaskStatus })));
      assert.ok(!isFailed(createTask({ status: "pending" as TaskStatus })));
    });
    it("isRunning checks in_progress", () => {
      assert.ok(isRunning(createTask({ status: "in_progress" as TaskStatus })));
      assert.ok(!isRunning(createTask({ status: "pending" as TaskStatus })));
    });
    it("isPending checks pending", () => {
      assert.ok(isPending(createTask({ status: "pending" as TaskStatus })));
      assert.ok(!isPending(createTask({ status: "in_progress" as TaskStatus })));
    });
  });

  describe("Task retrieval", () => {
    it("should get task by ID", () => {
      const dag = new TaskDAG([createTask({ id: "A", text: "A" })]);
      assert.strictEqual(dag.getTask("A")?.id, "A");
    });
    it("should return undefined for missing task", () => {
      const dag = new TaskDAG([createTask({ id: "A" })]);
      assert.strictEqual(dag.getTask("MISSING"), undefined);
    });
    it("should get tasks by status", () => {
      const dag = new TaskDAG([
        createTask({ id: "A", status: "pending" as TaskStatus }),
        createTask({ id: "B", status: "completed" as TaskStatus }),
      ]);
      const pending = dag.getByStatus("pending" as TaskStatus);
      assert.strictEqual(pending.length, 1);
      assert.strictEqual(pending[0].id, "A");
    });
    it("should get dependencies for task", () => {
      const dag = new TaskDAG([
        createTask({ id: "A", blockedBy: [] }),
        createTask({ id: "B", blockedBy: ["A"] }),
      ]);
      const deps = dag.getDependencies("B");
      assert.strictEqual(deps.length, 1);
      assert.strictEqual(deps[0].id, "A");
    });
    it("should get dependents for task", () => {
      const dag = new TaskDAG([
        createTask({ id: "A", blockedBy: [] }),
        createTask({ id: "B", blockedBy: ["A"] }),
        createTask({ id: "C", blockedBy: ["A"] }),
      ]);
      const dependents = dag.getDependents("A");
      assert.strictEqual(dependents.length, 2);
      assert.ok(dependents.map(t => t.id).includes("B"));
      assert.ok(dependents.map(t => t.id).includes("C"));
    });
  });
});
