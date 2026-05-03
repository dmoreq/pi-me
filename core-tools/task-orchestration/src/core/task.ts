/**
 * Task Orchestration v2: Core Task Model & DAG
 *
 * Implements:
 * - Task model with unified interface
 * - TaskDAG for dependency management
 * - Topological sorting
 * - Cycle detection
 */

import type { Task, TaskStatus } from '../types';

/**
 * Directed Acyclic Graph (DAG) for task dependencies
 *
 * Supports:
 * - Topological sorting (returns execution batches)
 * - Cycle detection
 * - Unblocking (get tasks ready to execute)
 */
export class TaskDAG {
  private tasks: Map<string, Task>;
  private dependencies: Map<string, Set<string>>;  // taskId -> blockedBy set
  private dependents: Map<string, Set<string>>;    // taskId -> tasks depending on this

  constructor(tasks: Task[]) {
    this.tasks = new Map(tasks.map(t => [t.id, t]));
    this.dependencies = new Map();
    this.dependents = new Map();

    // Build dependency graph
    for (const task of tasks) {
      this.dependencies.set(task.id, new Set(task.blockedBy || []));
      this.dependents.set(task.id, new Set());
    }

    // Add reverse edges for dependents
    for (const task of tasks) {
      const blockedBy = task.blockedBy || [];
      for (const depId of blockedBy) {
        if (this.dependents.has(depId)) {
          this.dependents.get(depId)!.add(task.id);
        }
      }
    }
  }

  /**
   * Check if graph has a cycle
   * Uses DFS with white/gray/black coloring
   *
   * @throws Error with cycle path if cycle detected
   * @returns void
   */
  hasCycle(): void {
    const WHITE = 0;  // Not visited
    const GRAY = 1;   // In progress
    const BLACK = 2;  // Complete

    const colors = new Map<string, number>();
    const path: string[] = [];

    // Initialize all nodes as white
    for (const taskId of this.tasks.keys()) {
      colors.set(taskId, WHITE);
    }

    const visit = (taskId: string): void => {
      colors.set(taskId, GRAY);
      path.push(taskId);

      const deps = this.dependencies.get(taskId) || new Set();
      for (const depId of deps) {
        const color = colors.get(depId) ?? WHITE;

        if (color === GRAY) {
          // Found cycle
          const cycleStart = path.indexOf(depId);
          const cycle = path.slice(cycleStart);
          throw new Error(`Cycle detected: ${cycle.join(' → ')} → ${depId}`);
        }

        if (color === WHITE) {
          visit(depId);
        }
      }

      path.pop();
      colors.set(taskId, BLACK);
    };

    // Visit all nodes
    for (const taskId of this.tasks.keys()) {
      if (colors.get(taskId) === WHITE) {
        visit(taskId);
      }
    }
  }

  /**
   * Topological sort
   *
   * Returns execution batches where each batch can run in parallel
   * (all tasks in a batch have their dependencies satisfied by previous batches)
   *
   * @returns Array of batches, each batch is array of task IDs
   * @example [[task1], [task2, task3], [task4]]  // task1 first, then 2&3 parallel, then 4
   */
  topologicalSort(): string[][] {
    // Check for cycles first
    try {
      this.hasCycle();
    } catch (e) {
      throw new Error(`Cannot sort: ${(e as Error).message}`);
    }

    const batches: string[][] = [];
    const visited = new Set<string>();

    while (visited.size < this.tasks.size) {
      // Find all unblocked tasks (all deps satisfied)
      const batch: string[] = [];

      for (const taskId of this.tasks.keys()) {
        if (visited.has(taskId)) continue;

        const deps = this.dependencies.get(taskId) || new Set();
        const allDepsVisited = Array.from(deps).every(d => visited.has(d));

        if (allDepsVisited) {
          batch.push(taskId);
        }
      }

      if (batch.length === 0) {
        // No progress made (shouldn't happen if cycle check passed)
        throw new Error('Failed to make progress in topological sort');
      }

      batches.push(batch);
      batch.forEach(t => visited.add(t));
    }

    return batches;
  }

  /**
   * Get all unblocked tasks (ready to execute)
   *
   * @param status Optional: only return tasks with this status
   * @returns Array of unblocked tasks
   */
  getUnblocked(status?: TaskStatus): Task[] {
    const unblocked: Task[] = [];

    for (const task of this.tasks.values()) {
      if (status && task.status !== status) continue;

      const deps = this.dependencies.get(task.id) || new Set();
      if (deps.size === 0) {
        unblocked.push(task);
      }
    }

    return unblocked;
  }

  /**
   * Get all tasks by status
   */
  getByStatus(status: TaskStatus): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.status === status);
  }

  /**
   * Get task by ID
   */
  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get dependencies for a task
   */
  getDependencies(taskId: string): Task[] {
    const depIds = this.dependencies.get(taskId) || new Set();
    return Array.from(depIds)
      .map(id => this.tasks.get(id))
      .filter((t): t is Task => t !== undefined);
  }

  /**
   * Get dependents (tasks that depend on this task)
   */
  getDependents(taskId: string): Task[] {
    const depIds = this.dependents.get(taskId) || new Set();
    return Array.from(depIds)
      .map(id => this.tasks.get(id))
      .filter((t): t is Task => t !== undefined);
  }
}

/**
 * Create a task with defaults
 */
export function createTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: overrides.id || `task-${Date.now()}`,
    text: overrides.text || '',
    status: (overrides.status || 'pending') as TaskStatus,
    createdAt: overrides.createdAt || now,
    blockedBy: overrides.blockedBy,
    topic: overrides.topic,
    sequenceOrder: overrides.sequenceOrder,
    ...overrides
  };
}

/**
 * Helper to check if task is completed
 */
export function isCompleted(task: Task): boolean {
  return task.status === 'completed' || task.status === 'skipped';
}

/**
 * Helper to check if task failed
 */
export function isFailed(task: Task): boolean {
  return task.status === 'failed';
}

/**
 * Helper to check if task is running
 */
export function isRunning(task: Task): boolean {
  return task.status === 'in_progress';
}

/**
 * Helper to check if task is pending
 */
export function isPending(task: Task): boolean {
  return task.status === 'pending';
}
