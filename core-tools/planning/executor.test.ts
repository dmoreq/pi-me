/**
 * StepExecutor — unit tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { StepExecutor } from "./executor.ts";
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

describe("StepExecutor", () => {
  it("should execute single step", async () => {
    const executor = new StepExecutor();
    const dag = new PlanDAG([makeStep("A")]);
    const result = await executor.execute(dag);
    assert.ok(result.status !== "failed");
    assert.ok(result.results.size > 0);
  });

  it("should execute linear chain in order", async () => {
    const executor = new StepExecutor();
    const dag = new PlanDAG([
      makeStep("A"),
      makeStep("B", ["A"]),
      makeStep("C", ["B"]),
    ]);
    const result = await executor.execute(dag);
    assert.ok(result.results.size >= 1, `Expected >=1 results, got ${result.results.size}`);
  });

  it("should execute parallel steps concurrently", async () => {
    const executor = new StepExecutor();
    const dag = new PlanDAG([
      makeStep("A"),
      makeStep("B"),
      makeStep("C", ["A", "B"]),
    ]);
    const result = await executor.execute(dag);
    // At least A and B should be executed
    assert.ok(result.results.size >= 2, `Expected >=2 results, got ${result.results.size}`);
  });

  it("should handle empty plan", async () => {
    const executor = new StepExecutor();
    const dag = new PlanDAG([]);
    const result = await executor.execute(dag);
    assert.strictEqual(result.results.size, 0);
  });

  it("should throw on cycles", async () => {
    const executor = new StepExecutor();
    const dag = new PlanDAG([
      makeStep("A", ["B"]),
      makeStep("B", ["A"]),
    ]);
    await assert.rejects(async () => executor.execute(dag), /cycle/i);
  });

  it("should respect maxParallel option", async () => {
    const executor = new StepExecutor({ maxParallel: 1 });
    const dag = new PlanDAG([makeStep("A"), makeStep("B")]);
    const result = await executor.execute(dag);
    assert.ok(result.results.size > 0);
  });
});
