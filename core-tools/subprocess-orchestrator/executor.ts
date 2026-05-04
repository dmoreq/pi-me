/**
 * Subprocess Executor — runs subprocess tasks with retry and timeout.
 * Supports: sequential, parallel, foreground (streaming), background (async),
 * chain, loop, and pi-spawn execution modes.
 */

import type {
  SubprocessTask,
  SubprocessResult,
  SubprocessConfig,
  ForegroundTask,
  ForegroundResult,
  BackgroundTask,
  JobHandle,
  ChainStep,
  ChainResult,
  ChainStepResult,
  LoopConfig,
  LoopResult,
  LoopIteration,
  LoopControl,
  LoopStatus,
  PiSubprocessTask,
  PiSpawnResult,
} from "./types.ts";

export class SubprocessExecutor {
  private config: SubprocessConfig;
  private exec: (cmd: string, args: string[], opts: any) => Promise<{ exitCode: number; stdout: string; stderr?: string }>;
  private childExec: (cmd: string, args: string[], opts: any, chunkCb?: (chunk: string) => void) => Promise<{ exitCode: number; stdout: string; stderr?: string }>;

  // Background job tracking
  private jobs = new Map<string, JobHandle>();
  private jobCounter = 0;

  // Loop state tracking
  private loops = new Map<string, { state: "running" | "paused" | "aborted" | "completed"; iteration: number }>();

  constructor(
    config: SubprocessConfig = {},
    exec?: (cmd: string, args: string[], opts: any) => Promise<any>,
    childExec?: (cmd: string, args: string[], opts: any, chunkCb?: (chunk: string) => void) => Promise<any>,
  ) {
    this.config = {
      parallel: config.parallel ?? false,
      stopOnError: config.stopOnError ?? true,
      timeout: config.timeout ?? 300000,
      retries: config.retries ?? 0,
      ...config,
    };
    this.exec = exec ?? (async () => ({ exitCode: 0, stdout: "" }));
    this.childExec = childExec ?? (async (cmd, args, opts) => ({ exitCode: 0, stdout: "", stderr: "" }));
  }

  // ═════════════════════════════════════════════════════════════════════
  // EXISTING: Sequential & Parallel
  // ═════════════════════════════════════════════════════════════════════

  async execute(tasks: SubprocessTask[]): Promise<SubprocessResult[]> {
    if (this.config.parallel) {
      return this.executeParallel(tasks);
    } else {
      return this.executeSequential(tasks);
    }
  }

  private async executeSequential(tasks: SubprocessTask[]): Promise<SubprocessResult[]> {
    const results: SubprocessResult[] = [];
    for (const task of tasks) {
      const result = await this.executeTask(task);
      results.push(result);
      if (result.status === "failed" && task.critical && this.config.stopOnError) break;
    }
    return results;
  }

  private async executeParallel(tasks: SubprocessTask[]): Promise<SubprocessResult[]> {
    return Promise.all(tasks.map(task => this.executeTask(task)));
  }

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

        return {
          taskId: task.id,
          status: result.exitCode === 0 ? "succeeded" : "failed",
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          duration: Date.now() - startTime,
        };
      } catch (err) {
        const duration = Date.now() - startTime;
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("timeout") || message.includes("TIMEOUT")) {
          return { taskId: task.id, status: "timeout", stdout: "", stderr: message, duration };
        }
        if (attempt === retries) {
          return { taskId: task.id, status: "failed", exitCode: 1, stdout: "", stderr: message, duration };
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    return { taskId: task.id, status: "failed", exitCode: 1, stdout: "", duration: Date.now() - startTime };
  }

  // ═════════════════════════════════════════════════════════════════════
  // NEW: Foreground execution (from subagent sync mode)
  // ═════════════════════════════════════════════════════════════════════

  async executeForeground(task: ForegroundTask): Promise<ForegroundResult> {
    const startTime = Date.now();
    const chunks: string[] = [];

    try {
      const result = await this.childExec(task.cmd, task.args ?? [], {
        cwd: task.cwd ?? process.cwd(),
        timeout: task.timeout ?? this.config.timeout ?? 30000,
        env: { ...process.env, ...(this.config.env || {}), ...(task.env || {}) },
      }, (chunk: string) => {
        chunks.push(chunk);
        task.onChunk?.(chunk);
      });

      return {
        taskId: task.id,
        status: result.exitCode === 0 ? "succeeded" : "failed",
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        duration: Date.now() - startTime,
        chunks,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        taskId: task.id,
        status: "failed",
        exitCode: 1,
        stdout: chunks.join(""),
        stderr: message,
        duration: Date.now() - startTime,
        chunks,
      };
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  // NEW: Background execution (from subagent async mode)
  // ═════════════════════════════════════════════════════════════════════

  async executeBackground(task: BackgroundTask): Promise<JobHandle> {
    const jobId = `job-${++this.jobCounter}-${Date.now()}`;

    const promise = new Promise<SubprocessResult>(async (resolve) => {
      const result = await this.executeTask(task as SubprocessTask);
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = result.status === "succeeded" ? "completed" : "failed";
      }
      resolve(result);
    });

    const handle: JobHandle = {
      jobId,
      task,
      status: "queued",
      createdAt: Date.now(),
      promise,
    };

    // Start execution (microtask to let caller get handle first)
    queueMicrotask(async () => {
      handle.status = "running";
      const result = await promise;
      // Notify if configured
      if (task.notifyOnComplete) {
        try {
          const { getTelemetry } = await import("pi-telemetry");
          const t = getTelemetry();
          t?.notify?.({
            title: `Job ${task.label ?? jobId} ${result.status === "succeeded" ? "completed" : "failed"}`,
            body: `Duration: ${result.duration}ms`,
            type: result.status === "succeeded" ? "success" : "error",
          });
        } catch { /* telemetry not available */ }
      }
    });

    this.jobs.set(jobId, handle);
    return handle;
  }

  async watchJob(jobId: string): Promise<SubprocessResult | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    return job.promise;
  }

  listJobs(): JobHandle[] {
    return Array.from(this.jobs.values());
  }

  // ═════════════════════════════════════════════════════════════════════
  // NEW: Chain execution (from subagent chain + sub-pi)
  // ═════════════════════════════════════════════════════════════════════

  async executeChain(steps: ChainStep[]): Promise<ChainResult> {
    const chainId = `chain-${Date.now()}`;
    const startTime = Date.now();
    const results: ChainStepResult[] = [];
    let context = "";

    for (const step of steps) {
      const stepStart = Date.now();
      try {
        // Build prompt: pass context from previous step if configured
        const prompt = step.passContext && context
          ? `${context}\n\n${step.prompt}`
          : step.prompt;

        const result = await this.exec("bash", ["-c", prompt], {
          timeout: step.timeout ?? 60000,
        });

        const stepResult: ChainStepResult = {
          stepId: step.id,
          status: result.exitCode === 0 ? "succeeded" : "failed",
          output: result.stdout || result.stderr || "",
          duration: Date.now() - stepStart,
          error: result.exitCode !== 0 ? result.stderr : undefined,
        };

        results.push(stepResult);

        // Pass output as context to next step
        if (step.passContext) {
          context = result.stdout || "";
        }

        if (result.exitCode !== 0) {
          return {
            chainId,
            steps: results,
            status: "failed",
            duration: Date.now() - startTime,
          };
        }
      } catch (err) {
        results.push({
          stepId: step.id,
          status: "failed",
          output: "",
          duration: Date.now() - stepStart,
          error: err instanceof Error ? err.message : String(err),
        });
        return { chainId, steps: results, status: "failed", duration: Date.now() - startTime };
      }
    }

    return { chainId, steps: results, status: "succeeded", duration: Date.now() - startTime };
  }

  // ═════════════════════════════════════════════════════════════════════
  // NEW: Loop execution (from ralph-loop)
  // ═════════════════════════════════════════════════════════════════════

  async executeLoop(config: LoopConfig): Promise<{ result: LoopResult; control: LoopControl }> {
    const loopId = `loop-${Date.now()}`;
    const maxIterations = config.maxIterations ?? 10;
    const interval = config.interval ?? 1000;
    const startTime = Date.now();
    const iterations: LoopIteration[] = [];

    const state = { state: "running" as const, iteration: 0 };
    this.loops.set(loopId, state);

    for (let i = 0; i < maxIterations; i++) {
      // Check control state
      if (state.state === "aborted") break;
      if (state.state === "paused") {
        // Wait while paused
        while (state.state === "paused") {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (state.state === "aborted") break;
      }

      state.iteration = i + 1;

      // Run the task
      const iterStart = Date.now();
      let iterOutput = "";
      let iterStatus: "succeeded" | "failed" = "succeeded";

      try {
        const result = await this.exec("bash", ["-c", config.task], { timeout: 30000 });
        iterOutput = result.stdout || result.stderr || "";
        iterStatus = result.exitCode === 0 ? "succeeded" : "failed";
      } catch (err) {
        iterOutput = err instanceof Error ? err.message : String(err);
        iterStatus = "failed";
      }

      iterations.push({
        number: i + 1,
        output: iterOutput,
        duration: Date.now() - iterStart,
        status: iterStatus,
      });

      // Check condition
      if (config.conditionCmd) {
        try {
          const condResult = await this.exec("bash", ["-c", config.conditionCmd], { timeout: 5000 });
          if (condResult.stdout.trim() !== "true") break;
        } catch {
          break; // condition failed, stop looping
        }
      }

      // Wait between iterations
      if (i < maxIterations - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    state.state = state.state === "aborted" ? "aborted" : "completed";

    const result: LoopResult = {
      loopId,
      iterations,
      totalDuration: Date.now() - startTime,
      status: state.state === "aborted" ? "cancelled" : iterations.length >= maxIterations ? "max_reached" : "completed",
    };

    const control: LoopControl = {
      pause: () => { if (state.state === "running") state.state = "paused"; },
      resume: () => { if (state.state === "paused") state.state = "running"; },
      steer: (direction: string) => { /* hook point for steering */ },
      abort: () => { state.state = "aborted"; },
      getStatus: () => ({
        loopId,
        state: state.state,
        currentIteration: state.iteration,
        lastOutput: iterations[iterations.length - 1]?.output,
      }),
    };

    return { result, control };
  }

  // ═════════════════════════════════════════════════════════════════════
  // NEW: Pi subprocess (from sub-pi)
  // ═════════════════════════════════════════════════════════════════════

  async spawnPi(task: PiSubprocessTask): Promise<PiSpawnResult> {
    const taskId = `pi-${Date.now()}`;
    const startTime = Date.now();

    try {
      // Build pi command
      const args = ["--prompt", task.prompt];
      if (task.skill) args.push("--skill", task.skill);
      if (task.model) args.push("--model", task.model);
      if (task.fork) args.push("--fork");

      const result = await this.exec("pi", args, {
        timeout: 120000, // 2 min for pi tasks
      });

      return {
        taskId,
        output: result.stdout,
        duration: Date.now() - startTime,
        status: result.exitCode === 0 ? "succeeded" : "failed",
        error: result.exitCode !== 0 ? result.stderr : undefined,
      };
    } catch (err) {
      return {
        taskId,
        output: "",
        duration: Date.now() - startTime,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async spawnPiParallel(tasks: PiSubprocessTask[], concurrency: number = 4): Promise<PiSpawnResult[]> {
    // Run in batches to limit concurrency
    const results: PiSpawnResult[] = [];
    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(t => this.spawnPi(t)));
      results.push(...batchResults);
    }
    return results;
  }
}
