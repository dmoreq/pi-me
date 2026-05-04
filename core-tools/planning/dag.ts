/**
 * PlanDAG — Directed Acyclic Graph for plan steps
 * Ported from task-orchestration/src/core/task.ts
 */

import type { PlanStep, PlanStepStatus } from "./types.ts";

export class PlanDAG {
  private steps: Map<string, PlanStep> = new Map();
  private adjacency: Map<string, Set<string>> = new Map(); // id → dependents

  constructor(steps: PlanStep[]) {
    for (const step of steps) {
      this.steps.set(step.id, step);
      this.adjacency.set(step.id, new Set());
    }

    // Build adjacency from dependencies
    for (const step of steps) {
      const deps = step.dependsOn ?? [];
      for (const depId of deps) {
        if (this.adjacency.has(depId)) {
          this.adjacency.get(depId)!.add(step.id);
        }
      }
    }
  }

  /**
   * Get all steps in DAG.
   */
  getAllSteps(): PlanStep[] {
    return Array.from(this.steps.values());
  }

  /**
   * Get a specific step by ID.
   */
  getStep(id: string): PlanStep | undefined {
    return this.steps.get(id);
  }

  /**
   * Get steps by status.
   */
  getByStatus(status: PlanStepStatus): PlanStep[] {
    return Array.from(this.steps.values()).filter(s => s.status === status);
  }

  /**
   * Get unblocked steps (no dependencies or all deps completed).
   */
  getUnblocked(filterStatus?: PlanStepStatus): PlanStep[] {
    const result: PlanStep[] = [];
    for (const step of this.steps.values()) {
      if (filterStatus && step.status !== filterStatus) continue;

      const deps = step.dependsOn ?? [];
      const allDone = deps.every(depId => {
        const dep = this.steps.get(depId);
        return dep && (dep.status === "completed" || dep.status === "skipped");
      });

      if (allDone) result.push(step);
    }
    return result;
  }

  /**
   * Get direct dependencies of a step.
   */
  getDependencies(stepId: string): PlanStep[] {
    const step = this.steps.get(stepId);
    if (!step || !step.dependsOn) return [];

    return step.dependsOn
      .map(id => this.steps.get(id))
      .filter((s): s is PlanStep => s !== undefined);
  }

  /**
   * Get all steps that depend on this step.
   */
  getDependents(stepId: string): PlanStep[] {
    const dependent = this.adjacency.get(stepId) ?? new Set();
    return Array.from(dependent)
      .map(id => this.steps.get(id))
      .filter((s): s is PlanStep => s !== undefined);
  }

  /**
   * Topological sort: returns batches of steps that can run in parallel.
   */
  topologicalSort(): string[][] {
    const visited = new Set<string>();
    const batches: string[][] = [];

    while (visited.size < this.steps.size) {
      // Get all unblocked steps that haven't been visited
      const unblocked: string[] = [];
      for (const step of this.steps.values()) {
        if (visited.has(step.id)) continue;

        const deps = step.dependsOn ?? [];
        const allDone = deps.every(depId => visited.has(depId));
        if (allDone) {
          unblocked.push(step.id);
        }
      }

      if (unblocked.length === 0) break; // Cycle or no progress

      batches.push(unblocked);
      unblocked.forEach(id => visited.add(id));
    }

    return batches;
  }

  /**
   * Detect cycles and throw if found.
   */
  hasCycle(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const step = this.steps.get(nodeId);
      const deps = step?.dependsOn ?? [];
      for (const depId of deps) {
        if (!visited.has(depId)) {
          if (dfs(depId)) return true;
        } else if (recursionStack.has(depId)) {
          throw new Error(`Cycle detected: ${nodeId} → ${depId}`);
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const step of this.steps.values()) {
      if (!visited.has(step.id)) {
        dfs(step.id);
      }
    }
  }
}
