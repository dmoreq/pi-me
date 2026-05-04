/**
 * PlanDAG — unit tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PlanDAG } from "./dag.ts";
import type { PlanStep } from "./types.ts";

function makeStep(id: string, dependsOn: string[] = []): PlanStep {
  return {
    id,
    text: `Step ${id}`,
    intent: "general",
    status: "pending",
    dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
  };
}

describe("PlanDAG", () => {
  describe("construction", () => {
    it("should create empty DAG", () => {
      const dag = new PlanDAG([]);
      assert.strictEqual(dag.getAllSteps().length, 0);
    });

    it("should create DAG with single step", () => {
      const dag = new PlanDAG([makeStep("A")]);
      assert.strictEqual(dag.getAllSteps().length, 1);
    });

    it("should preserve step order", () => {
      const dag = new PlanDAG([makeStep("X"), makeStep("Y"), makeStep("Z")]);
      const ids = dag.getAllSteps().map(s => s.id);
      assert.ok(ids.includes("X") && ids.includes("Y") && ids.includes("Z"));
    });
  });

  describe("topologicalSort", () => {
    it("should sort linear chain A→B→C", () => {
      const dag = new PlanDAG([
        makeStep("A", []),
        makeStep("B", ["A"]),
        makeStep("C", ["B"]),
      ]);
      const sorted = dag.topologicalSort();
      assert.strictEqual(sorted.length, 3);
      assert.deepStrictEqual(sorted[0], ["A"]);
      assert.deepStrictEqual(sorted[1], ["B"]);
      assert.deepStrictEqual(sorted[2], ["C"]);
    });

    it("should batch parallel steps A,B → C", () => {
      const dag = new PlanDAG([
        makeStep("A", []),
        makeStep("B", []),
        makeStep("C", ["A", "B"]),
      ]);
      const sorted = dag.topologicalSort();
      assert.strictEqual(sorted.length, 2);
      assert.ok(sorted[0].includes("A") && sorted[0].includes("B"));
      assert.deepStrictEqual(sorted[1], ["C"]);
    });

    it("should handle diamond pattern", () => {
      const dag = new PlanDAG([
        makeStep("A", []),
        makeStep("B", ["A"]),
        makeStep("C", ["A"]),
        makeStep("D", ["B", "C"]),
      ]);
      const sorted = dag.topologicalSort();
      assert.strictEqual(sorted.length, 3);
    });
  });

  describe("hasCycle", () => {
    it("should not throw for valid DAG", () => {
      const dag = new PlanDAG([makeStep("A"), makeStep("B", ["A"])]);
      assert.doesNotThrow(() => dag.hasCycle());
    });

    it("should throw for simple cycle A→B→A", () => {
      const dag = new PlanDAG([makeStep("A", ["B"]), makeStep("B", ["A"])]);
      assert.throws(() => dag.hasCycle(), /cycle/i);
    });

    it("should throw for 3-node cycle", () => {
      const dag = new PlanDAG([
        makeStep("A", ["C"]),
        makeStep("B", ["A"]),
        makeStep("C", ["B"]),
      ]);
      assert.throws(() => dag.hasCycle(), /cycle/i);
    });
  });

  describe("getUnblocked", () => {
    it("should return steps with no dependencies", () => {
      const dag = new PlanDAG([makeStep("A"), makeStep("B", ["A"])]);
      const unblocked = dag.getUnblocked();
      assert.strictEqual(unblocked.length, 1);
      assert.strictEqual(unblocked[0].id, "A");
    });

    it("should return all parallel steps", () => {
      const dag = new PlanDAG([
        makeStep("A"),
        makeStep("B"),
        makeStep("C", ["A"]),
      ]);
      const unblocked = dag.getUnblocked();
      assert.strictEqual(unblocked.length, 2);
    });

    it("should filter by status", () => {
      const steps = [
        { ...makeStep("A"), status: "pending" as const },
        { ...makeStep("B"), status: "completed" as const },
      ];
      const dag = new PlanDAG(steps);
      const unblocked = dag.getUnblocked("pending");
      assert.strictEqual(unblocked.length, 1);
      assert.strictEqual(unblocked[0].id, "A");
    });
  });

  describe("getStep", () => {
    it("should retrieve step by ID", () => {
      const dag = new PlanDAG([makeStep("A")]);
      assert.strictEqual(dag.getStep("A")?.id, "A");
    });

    it("should return undefined for missing step", () => {
      const dag = new PlanDAG([]);
      assert.strictEqual(dag.getStep("MISSING"), undefined);
    });
  });

  describe("getByStatus", () => {
    it("should get steps by status", () => {
      const steps = [
        { ...makeStep("A"), status: "pending" as const },
        { ...makeStep("B"), status: "completed" as const },
      ];
      const dag = new PlanDAG(steps);
      const pending = dag.getByStatus("pending");
      assert.strictEqual(pending.length, 1);
      assert.strictEqual(pending[0].id, "A");
    });
  });

  describe("getDependencies", () => {
    it("should get direct dependencies", () => {
      const dag = new PlanDAG([makeStep("A"), makeStep("B", ["A"])]);
      const deps = dag.getDependencies("B");
      assert.strictEqual(deps.length, 1);
      assert.strictEqual(deps[0].id, "A");
    });

    it("should return empty for independent step", () => {
      const dag = new PlanDAG([makeStep("A")]);
      assert.strictEqual(dag.getDependencies("A").length, 0);
    });
  });

  describe("getDependents", () => {
    it("should get steps that depend on a step", () => {
      const dag = new PlanDAG([
        makeStep("A"),
        makeStep("B", ["A"]),
        makeStep("C", ["A"]),
      ]);
      const dependents = dag.getDependents("A");
      assert.strictEqual(dependents.length, 2);
    });
  });
});
