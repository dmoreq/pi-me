/**
 * Unified Task Executor — executes tasks and plans with safety and retry.
 *
 * Merges:
 * - task-orchestration/src/core/executor.ts (TaskExecutor)
 * - planning/plan-mode-core.ts (execute action in plan tool)
 *
 * Features:
 * - DAG-based batch execution (parallel within batch, sequential across)
 * - Retry with exponential backoff
 * - Timeout handling
 * - Safety mode: blocks execution for tasks requiring review
 * - Event emission for real-time UI updates
 * - Telemetry integration
 */

import type { Task, TaskResult, TaskStatus } from "./types.ts";
import { TaskDAG } from "./types.ts";
import type { TaskStore } from "./store.ts";

export type ExecutorEvent =
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "task_skipped"
  | "task_update"
  | "batch_completed"
  | "all_completed";

export type ExecutorEventHandler = (...args: unknown[]) => void;

export interface ExecutorConfig {
  maxRetries: number;
  timeoutMs: number;
  safetyMode: boolean; // If true, blocks tasks with requiresReview=true
  dryRun: boolean;     // If true, simulates execution without side effects
  onExecute: (task: Task) => Promise<TaskResult>;
}

export class TaskExecutor {
  private store: TaskStore;
  private config: ExecutorConfig;
  private listeners = new Map<string, Set<ExecutorEventHandler>>();
  private abortController: AbortController | null = null;

  constructor(
    store: TaskStore,
    config?: Partial<ExecutorConfig>,
  ) {
    this.store = store;
    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      timeoutMs: config?.timeoutMs ?? 30000,
      safetyMode: config?.safetyMode ?? true,
      dryRun: config?.dryRun ?? false,
      onExecute: config?.onExecute ?? (async task => {
        // Default: echo the task text
        const { exec } = await import("node:child_process");
        return new Promise<TaskResult>(resolve => {
          exec(`echo ${JSON.stringify(task.text)}`, { timeout: 10000 }, (err, stdout) => {
            if (err) resolve({ exitCode: 1, error: err.message });
            else resolve({ exitCode: 0, stdout: stdout.trim() });
          });
        });
      }),
    };
  }

  // ─── Dispatch ──────────────────────────────────────────────────────────

  /**
   * Execute tasks via DAG dispatch.
   * Returns only when all tasks complete or fail.
   */
  async dispatch(dag: TaskDAG): Promise<void> {
    const batches = dag.topologicalSort();
    this.abortController = new AbortController();

    for (const batch of batches) {
      if (this.abortController.signal.aborted) break;

      const batchResults = await Promise.all(
        batch.map(async taskId => {
          const task = dag.getTask(taskId);
          if (!task) return;
          return this.executeWithRetry(task);
        }),
      );

      this.emit("batch_completed", batch, batchResults);
    }

    this.emit("all_completed");
    this.abortController = null;
  }

  /**
   * Execute a single task.
   */
  async executeOne(task: Task): Promise<TaskResult> {
    return (await this.executeWithRetry(task)) ?? { exitCode: 1, error: "Execution cancelled" };
  }

  private async executeWithRetry(task: Task): Promise<TaskResult | undefined> {
    // Safety check
    if (this.config.safetyMode && task.requiresReview) {
      this.emit("task_skipped", task, "Requires review before execution");
      return { exitCode: 0, stdout: "[SAFETY] Task requires review — skipped" };
    }

    // Dry run
    if (this.config.dryRun) {
      this.emit("task_started", task);
      const dryResult: TaskResult = { exitCode: 0, stdout: `[DRY RUN] Would execute: ${task.text}` };
      this.emit("task_completed", task, dryResult);
      return dryResult;
    }

    let lastError: Error | undefined;
    const backoffMs = 100;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.executeTask(task);
        return result;
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.config.maxRetries) {
          await this.sleep(backoffMs * Math.pow(2, attempt - 1));
        }
      }
    }

    // All retries exhausted
    const errorResult: TaskResult = { exitCode: 1, error: lastError?.message ?? "Max retries exceeded" };
    await this.updateTaskStatus(task, "failed", errorResult);
    this.emit("task_failed", task, errorResult);
    return errorResult;
  }

  private async executeTask(task: Task): Promise<TaskResult> {
    await this.updateTaskStatus(task, "in_progress");
    this.emit("task_started", task);

    try {
      const result = await Promise.race([
        this.config.onExecute(task),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timed out after ${this.config.timeoutMs}ms`)), this.config.timeoutMs),
        ),
      ]);

      const status: TaskStatus = result.exitCode === 0 ? "completed" : "failed";
      await this.updateTaskStatus(task, status, result);
      this.emit(status === "completed" ? "task_completed" : "task_failed", task, result);
      return result;
    } catch (error) {
      // Re-throw so executeWithRetry can retry on transient errors
      throw error;
    }
  }

  private async updateTaskStatus(task: Task, status: TaskStatus, result?: TaskResult): Promise<void> {
    task.status = status;
    if (status === "in_progress") task.startedAt = new Date().toISOString();
    if (["completed", "failed", "skipped", "cancelled"].includes(status)) {
      task.completedAt = new Date().toISOString();
    }
    if (result) task.result = result;
    await this.store.save(task);
    this.emit("task_update", task);
  }

  // ─── Control ───────────────────────────────────────────────────────────

  async cancel(): Promise<void> {
    this.abortController?.abort();
    this.abortController = null;
  }

  async retry(task: Task): Promise<TaskResult> {
    task.status = "pending";
    task.result = undefined;
    task.startedAt = undefined;
    task.completedAt = undefined;
    await this.store.save(task);
    return this.executeOne(task);
  }

  async skip(task: Task): Promise<void> {
    await this.updateTaskStatus(task, "skipped");
    this.emit("task_skipped", task);
  }

  // ─── Event System ──────────────────────────────────────────────────────

  on(event: ExecutorEvent, handler: ExecutorEventHandler): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  off(event: ExecutorEvent, handler: ExecutorEventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event as ExecutorEvent)?.forEach(h => {
      try {
        h(...args);
      } catch (e) {
        console.error(`[TaskExecutor] Error in ${event} handler:`, e);
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
