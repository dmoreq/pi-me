/**
 * SubprocessExecutor — Run subprocess tasks with orchestration
 */

import type { SubprocessTask, SubprocessResult, SubprocessConfig } from "./types.ts";

export class SubprocessExecutor {
  private config: SubprocessConfig;
  private exec: (cmd: string, args: string[], opts: any) => Promise<{ exitCode: number; stdout: string; stderr?: string }>;

  constructor(
    config: SubprocessConfig = {},
    exec?: (cmd: string, args: string[], opts: any) => Promise<any>
  ) {
    this.config = {
      parallel: config.parallel ?? false,
      stopOnError: config.stopOnError ?? true,
      timeout: config.timeout ?? 300000, // 5 min
      retries: config.retries ?? 0,
      ...config,
    };
    this.exec = exec ?? (async () => ({ exitCode: 0, stdout: "" }));
  }

  /**
   * Execute all tasks sequentially or in parallel.
   */
  async execute(tasks: SubprocessTask[]): Promise<SubprocessResult[]> {
    if (this.config.parallel) {
      return this.executeParallel(tasks);
    } else {
      return this.executeSequential(tasks);
    }
  }

  /**
   * Execute tasks sequentially.
   */
  private async executeSequential(tasks: SubprocessTask[]): Promise<SubprocessResult[]> {
    const results: SubprocessResult[] = [];

    for (const task of tasks) {
      const result = await this.executeTask(task);
      results.push(result);

      if (result.status === "failed" && task.critical && this.config.stopOnError) {
        // Stop execution on critical failure
        break;
      }
    }

    return results;
  }

  /**
   * Execute tasks in parallel.
   */
  private async executeParallel(tasks: SubprocessTask[]): Promise<SubprocessResult[]> {
    const promises = tasks.map(task => this.executeTask(task));
    return Promise.all(promises);
  }

  /**
   * Execute a single task with retry logic.
   */
  private async executeTask(task: SubprocessTask): Promise<SubprocessResult> {
    const startTime = Date.now();
    const retries = this.config.retries ?? 0;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.exec(task.cmd, task.args ?? [], {
          cwd: task.cwd ?? process.cwd(),
          timeout: task.timeout ?? this.config.timeout ?? 30000,
          env: { ...process.env, ...(this.config.env || {}), ...(task.env || {}) },
        });

        const duration = Date.now() - startTime;

        return {
          taskId: task.id,
          status: result.exitCode === 0 ? "succeeded" : "failed",
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          duration,
        };
      } catch (err) {
        const duration = Date.now() - startTime;
        const message = err instanceof Error ? err.message : String(err);

        // Timeout error
        if (message.includes("timeout") || message.includes("TIMEOUT")) {
          return {
            taskId: task.id,
            status: "timeout",
            stdout: "",
            stderr: message,
            duration,
          };
        }

        // If last attempt, return failed
        if (attempt === retries) {
          return {
            taskId: task.id,
            status: "failed",
            exitCode: 1,
            stdout: "",
            stderr: message,
            duration,
          };
        }

        // Otherwise, retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // exponential backoff
      }
    }

    // Unreachable, but satisfy compiler
    return {
      taskId: task.id,
      status: "failed",
      exitCode: 1,
      stdout: "",
      duration: Date.now() - startTime,
    };
  }
}
