import { TaskDAG } from './task';
import type { Task, TaskResult, ExecutorOptions, ExtensionAPI, ITaskStore } from '../types';

type EventHandler = (...args: any[]) => void;

export class TaskExecutor {
  private store: ITaskStore;
  private pi: ExtensionAPI;
  private listeners: Map<string, Set<EventHandler>>;
  private abortController: AbortController | null;

  constructor(store: ITaskStore, pi: ExtensionAPI) {
    this.store = store;
    this.pi = pi;
    this.listeners = new Map();
    this.abortController = null;
  }

  async dispatch(dag: TaskDAG, options?: ExecutorOptions): Promise<void> {
    const batches = dag.topologicalSort();
    const results: Map<string, TaskResult> = new Map();
    this.abortController = new AbortController();

    const maxRetries = options?.maxRetries ?? 3;
    const timeout = options?.timeout ?? 30000;

    for (const batch of batches) {
      if (this.abortController?.signal.aborted) break;

      const batchResults = await Promise.all(
        batch.map(taskId => {
          const task = dag.getTask(taskId);
          if (!task) return Promise.resolve(undefined);
          return this.executeTaskWithRetry(task, maxRetries, timeout);
        })
      );

      this.emit('batch_completed', batch);

      for (let i = 0; i < batch.length; i++) {
        const result = batchResults[i];
        if (result) results.set(batch[i], result);
      }
    }

    this.emit('all_completed', results);
    this.abortController = null;
  }

  private async executeTaskWithRetry(
    task: Task,
    maxRetries: number,
    timeoutMs: number
  ): Promise<TaskResult | undefined> {
    let lastError: Error | undefined;
    const backoffMs = 100;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeTask(task, timeoutMs);
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          await this.sleep(backoffMs * Math.pow(2, attempt - 1));
        }
      }
    }

    task.status = 'failed' as Task['status'];
    task.result = { error: lastError?.message || 'Unknown error' };
    task.completedAt = new Date().toISOString();
    await this.store.save(task);
    this.emit('task_failed', task, lastError);
    this.emit('task_update', task);
    return task.result;
  }

  private async executeTask(
    task: Task,
    timeoutMs: number
  ): Promise<TaskResult | undefined> {
    task.status = 'in_progress' as Task['status'];
    task.startedAt = new Date().toISOString();
    await this.store.save(task);
    this.emit('task_started', task);
    this.emit('task_update', task);

    let result: TaskResult = { exitCode: 0 };

    if (task.executor === 'none') {
      task.status = 'completed' as Task['status'];
      task.result = { exitCode: 0 };
      task.completedAt = new Date().toISOString();
      await this.store.save(task);
      this.emit('task_completed', task, task.result);
      this.emit('task_update', task);
      return task.result;
    }

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      const execPromise = Promise.resolve(
        this.pi.exec('echo', [task.text])
      ).catch((err: Error) => ({
        exitCode: 1,
        error: err.message,
      }));

      const execResult = await Promise.race([execPromise, timeoutPromise]);
      result = execResult as unknown as TaskResult;
    } catch (error) {
      result = { exitCode: 1, error: (error as Error).message || 'Execution failed' };
    }

    task.result = result;
    task.completedAt = new Date().toISOString();

    if (result.exitCode === 0) {
      task.status = 'completed' as Task['status'];
      this.emit('task_completed', task, result);
    } else {
      task.status = 'failed' as Task['status'];
      this.emit('task_failed', task, result.error || `Exit code ${result.exitCode}`);
    }

    await this.store.save(task);
    this.emit('task_update', task);
    return result;
  }

  async prioritize(taskId: string): Promise<void> {
    const task = await this.store.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.priority = 'high' as Task['priority'];
    await this.store.save(task);
    this.emit('task_update', task);
  }

  async cancel(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  once(event: string, handler: EventHandler): void {
    const onceHandler = (...args: any[]) => {
      handler(...args);
      this.off(event, onceHandler);
    };
    this.on(event, onceHandler);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(handler => {
      try {
        handler(...args);
      } catch (e) {
        console.error(`Error in ${event} handler:`, e);
      }
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
