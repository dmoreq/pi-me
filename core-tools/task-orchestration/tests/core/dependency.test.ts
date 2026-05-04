/**
 * Task Orchestration v2: DependencyResolver Tests
 * Converted from jest to node:test.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DependencyResolver } from "../../src/core/dependency";
import { createTask } from "../../src/core/task";

describe("DependencyResolver", () => {
  let resolver: DependencyResolver;

  beforeEach(() => { resolver = new DependencyResolver(); });

  describe("build from blockedBy", () => {
    it("should build DAG with explicit blockedBy", () => {
      const dag = resolver.build([
        createTask({ id: "A", blockedBy: [] }),
        createTask({ id: "B", blockedBy: ["A"] }),
        createTask({ id: "C", blockedBy: ["B"] }),
      ]);
      assert.deepStrictEqual(dag.topologicalSort(), [["A"], ["B"], ["C"]]);
    });

    it("should handle undefined blockedBy", () => {
      const dag = resolver.build([
        createTask({ id: "A" }),
        createTask({ id: "B", blockedBy: ["A"] }),
      ]);
      const sorted = dag.topologicalSort();
      assert.deepStrictEqual(sorted, [["A"], ["B"]]);
    });

    it("should merge blockedBy correctly", () => {
      const dag = resolver.build([
        createTask({ id: "A", blockedBy: [] }),
        createTask({ id: "B", blockedBy: ["A"] }),
        createTask({ id: "C", blockedBy: ["A", "B"] }),
      ]);
      const sorted = dag.topologicalSort();
      assert.deepStrictEqual(sorted[0], ["A"]);
      assert.deepStrictEqual(sorted[1], ["B"]);
      assert.deepStrictEqual(sorted[2], ["C"]);
    });
  });

  describe("build from topic", () => {
    it("should auto-sequence tasks by topic", () => {
      const dag = resolver.build([
        createTask({ id: "1", text: "Fix auth", topic: "auth" }),
        createTask({ id: "2", text: "Test auth", topic: "auth" }),
        createTask({ id: "3", text: "Update docs", topic: "docs" }),
      ]);
      const sorted = dag.topologicalSort();
      // Task 1 must come before task 2 (same topic, sequential)
      const index: Record<string, number> = {};
      sorted.forEach((batch, i) => batch.forEach(id => (index[id] = i)));
      assert.ok(index["1"] <= index["2"], "task 1 must be before or same batch as task 2");
    });

    it("should handle no topic (all independent)", () => {
      const dag = resolver.build([
        createTask({ id: "1" }),
        createTask({ id: "2" }),
        createTask({ id: "3" }),
      ]);
      // No ordering constraints from topic
      const all = dag.getUnblocked();
      assert.strictEqual(all.length, 3);
    });
  });

  describe("build from sequenceOrder", () => {
    it("should order by explicit sequenceOrder", () => {
      const dag = resolver.build([
        createTask({ id: "1", sequenceOrder: 2 }),
        createTask({ id: "2", sequenceOrder: 1 }),
        createTask({ id: "3", sequenceOrder: 3 }),
      ]);
      const sorted = dag.topologicalSort();
      const index: Record<string, number> = {};
      sorted.forEach((batch, i) => batch.forEach(id => (index[id] = i)));
      assert.ok(index["2"] < index["1"], "task with order 1 before order 2");
      assert.ok(index["1"] < index["3"], "task with order 2 before order 3");
    });
  });
});
