/**
 * StepExecutor — Execute plan steps in parallel/sequential order
 */

import type { PlanStep, PlanStepStatus, PlanResult } from "./types.ts";
import { PlanDAG } from "./dag.ts";

export interface ExecutorOptions {
  timeoutMs?: number;
  maxParallel?: number;
  exec?: (cmd: string, args: string[]) => Promise<{ exitCode: number; stdout: string; stderr?: string }>;
}

export class StepExecutor {
  private readonly timeoutMs: number;
  private readonly maxParallel: number;
  private readonly exec: (cmd: string, args: string[]) => Promise<{ exitCode: number; stdout: string }>;

  constructor(opts: ExecutorOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? 30000;
    this.maxParallel = opts.maxParallel ?? 4;
    this.exec = opts.exec ?? (async () => ({ exitCode: 0, stdout: "" }));
  }

  /**
   * Execute all steps in a plan DAG in topological order.
   * Steps in the same batch are run in parallel.
   */
  async execute(dag: PlanDAG): Promise<PlanResult> {
    const results = new Map<string, { status: PlanStepStatus; output?: string }>();
    const startTime = Date.now();

    // Verify no cycles
    dag.hasCycle();

    // Get topological batches
    const batches = dag.topologicalSort();

    for (const batch of batches) {
      // Execute all steps in batch in parallel
      const promises = batch.map(async (stepId) => {
        const step = dag.getStep(stepId);
        if (!step) return;

        const result = await this.executeStep(step);
        results.set(stepId, result);
      });

      await Promise.all(promises);

      // Check for failures
      const failures = batch.filter(id => results.get(id)?.status === "failed");
      if (failures.length > 0) {
        // Continue but mark dependents as skipped
        for (const failedId of failures) {
          const dependents = dag.getDependents(failedId);
          for (const dep of dependents) {
            if (!results.has(dep.id)) {
              results.set(dep.id, { status: "skipped", output: `Skipped due to ${failedId} failure` });
            }
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    const completed = Array.from(results.values()).filter(r => r.status === "completed").length;
    const total = dag.getAllSteps().length;

    return {
      status: completed === total ? "succeeded" : completed > 0 ? "partial" : "failed",
      message: `${completed}/${total} steps completed in ${duration}ms`,
      results,
    };
  }

  /**
   * Execute a single step (placeholder implementation).
   */
  private async executeStep(step: PlanStep): Promise<{ status: PlanStepStatus; output?: string }> {
    try {
      // For now, simulate execution by sleeping
      await new Promise(resolve => setTimeout(resolve, 100));

      // Mark as completed
      return { status: "completed", output: `Completed: ${step.text}` };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "failed", output: `Failed: ${message}` };
    }
  }
}
