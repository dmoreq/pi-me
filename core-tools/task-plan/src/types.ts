/**
 * task-plan — Unified types for task + plan management.
 *
 * Single type system replacing:
 * - task-orchestration/src/types.ts (Task, TaskStatus, etc.)
 * - planning/types.ts + plan-mode-core.ts (PlanRecord, PlanStep, etc.)
 * - intent/types.ts (TaskIntent, IIntentClassifier)
 *
 * Design: one Task type that works for both auto-captured tasks
 * and user-created plans. A "plan" is just a Task with steps.
 */

import type { Message } from "./types-external.ts";

// ─── Intents ────────────────────────────────────────────────────────────────

export const INTENTS = [
  "fix",
  "refactor",
  "test",
  "docs",
  "deploy",
  "analyze",
  "implement",
  "general",
] as const;

export type TaskIntent = (typeof INTENTS)[number];

// ─── Status ─────────────────────────────────────────────────────────────────

export const STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "skipped",
  "cancelled",
  "archived",
] as const;

export type TaskStatus = (typeof STATUSES)[number];

// ─── Step (for plans) ───────────────────────────────────────────────────────

export interface Step {
  id: number;
  text: string;
  done: boolean;
}

// ─── Priority ───────────────────────────────────────────────────────────────

export type Priority = "low" | "normal" | "high";

// ─── Unified Task ──────────────────────────────────────────────────────────

/**
 * Unified Task — the single model for both auto-captured tasks and plans.
 *
 * A "plan" is just a Task with steps[] and a title.
 */
export interface Task {
  id: string;
  title?: string;            // Plan title (for plans with steps)
  text: string;              // Task description (for simple tasks) or plan goal
  status: TaskStatus;
  intent?: TaskIntent;
  priority: Priority;

  // Steps (for plans)
  steps?: Step[];

  // Dependencies
  blockedBy?: string[];
  topic?: string;
  sequenceOrder?: number;

  // Assignment
  assignedToSession?: string;   // Which session owns this task/plan
  assignedToUser?: string;      // Human assignee

  // Execution
  executor?: "subprocess" | "shell" | "pi" | "none";
  result?: TaskResult;

  // Metadata
  tags?: string[];
  source?: "auto" | "manual" | "migrated";  // How it was created

  // Safety
  requiresReview?: boolean;  // If true, blocks execution until explicitly approved

  // Timestamps
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskResult {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
  duration?: number;  // ms
}

// ─── DAG ────────────────────────────────────────────────────────────────────

/**
 * Directed Acyclic Graph for dependency resolution.
 */
export class TaskDAG {
  private tasks: Map<string, Task>;
  private deps: Map<string, Set<string>>;
  private dependents: Map<string, Set<string>>;

  constructor(tasks: Task[]) {
    this.tasks = new Map(tasks.map(t => [t.id, t]));
    this.deps = new Map();
    this.dependents = new Map();

    for (const task of tasks) {
      this.deps.set(task.id, new Set(task.blockedBy || []));
      this.dependents.set(task.id, new Set());
    }

    for (const task of tasks) {
      for (const depId of task.blockedBy || []) {
        this.dependents.get(depId)?.add(task.id);
      }
    }

    // Cycle detection on construction
    const cycle = this.findCycle();
    if (cycle) {
      throw new Error(`Dependency cycle detected: ${cycle.join(" → ")}`);
    }
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Topological sort — returns batches of tasks that can run in parallel.
   */
  topologicalSort(): string[][] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const batches: string[][] = [];
    const result: string[] = [];

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      if (visiting.has(id)) return;
      visiting.add(id);
      const task = this.tasks.get(id);
      if (task) {
        for (const depId of task.blockedBy || []) {
          visit(depId);
        }
      }
      visiting.delete(id);
      visited.add(id);
      result.push(id);
    };

    for (const id of this.tasks.keys()) visit(id);

    // Build batches from sorted order
    const remaining = new Set(result);
    while (remaining.size > 0) {
      const batch: string[] = [];
      for (const id of remaining) {
        const task = this.tasks.get(id);
        const blocked = (task?.blockedBy || []).filter(d => remaining.has(d));
        if (blocked.length === 0) batch.push(id);
      }
      if (batch.length === 0) break;
      batch.forEach(id => remaining.delete(id));
      batches.push(batch);
    }

    return batches;
  }

  hasCycle(): boolean {
    return this.findCycle() !== null;
  }

  private findCycle(): string[] | null {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    for (const id of this.tasks.keys()) color.set(id, WHITE);

    const parent = new Map<string, string>();
    const result: string[] = [];

    const dfs = (id: string): boolean => {
      color.set(id, GRAY);
      const task = this.tasks.get(id);
      for (const depId of task?.blockedBy || []) {
        if (color.get(depId) === GRAY) {
          // Found cycle, reconstruct
          let cur = id;
          result.push(depId);
          while (cur !== depId) {
            result.push(cur);
            cur = parent.get(cur) || "";
          }
          result.push(depId);
          result.reverse();
          return true;
        }
        if (color.get(depId) === WHITE) {
          parent.set(depId, id);
          if (dfs(depId)) return true;
        }
      }
      color.set(id, BLACK);
      return false;
    };

    for (const id of this.tasks.keys()) {
      if (color.get(id) === WHITE && dfs(id)) return result;
    }
    return null;
  }

  /**
   * Get tasks ready to execute (all dependencies resolved).
   */
  getReadyTasks(): Task[] {
    const completed = new Set<string>();
    for (const [id, task] of this.tasks) {
      if (task.status === "completed" || task.status === "skipped") {
        completed.add(id);
      }
    }
    return Array.from(this.tasks.values()).filter(task => {
      if (task.status !== "pending") return false;
      return (task.blockedBy || []).every(d => completed.has(d));
    });
  }
}

// ─── Events ─────────────────────────────────────────────────────────────────

export interface TaskEvent {
  type: "created" | "started" | "completed" | "failed" | "updated" | "deleted" | "skipped";
  taskId: string;
  task?: Task;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ─── Intent Classifier ──────────────────────────────────────────────────────

export interface IIntentClassifier {
  classify(text: string): TaskIntent;
  classifyAsync?(text: string): Promise<{ intent: TaskIntent; source: "ai" | "manual" }>;
}

// Re-export external types
export type { Message } from "./types-external.ts";
