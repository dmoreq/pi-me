/**
 * Subprocess Orchestration types — v0.6.0 consolidated
 */

// ── Existing types ───────────────────────────────────────────────────────

export interface SubprocessTask {
  id: string;
  name: string;
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  critical?: boolean;
}

export interface SubprocessResult {
  taskId: string;
  status: "succeeded" | "failed" | "timeout" | "skipped";
  exitCode?: number;
  stdout: string;
  stderr?: string;
  duration: number;
}

export interface SubprocessConfig {
  parallel?: boolean;
  stopOnError?: boolean;
  timeout?: number;
  retries?: number;
  env?: Record<string, string>;
}

// ── Foreground execution (from subagent) ────────────────────────────────

export interface ForegroundTask extends SubprocessTask {
  /** Stream output as it comes in */
  stream?: boolean;
  /** Callback for each output chunk */
  onChunk?: (chunk: string) => void;
}

export interface ForegroundResult extends SubprocessResult {
  /** Streamed output chunks */
  chunks?: string[];
}

// ── Background execution (from subagent async) ──────────────────────────

export interface BackgroundTask extends SubprocessTask {
  /** Human-readable label for the job */
  label?: string;
  /** Notify on completion */
  notifyOnComplete?: boolean;
}

export interface JobHandle {
  jobId: string;
  task: BackgroundTask;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  createdAt: number;
  /** Resolves when job completes */
  promise: Promise<SubprocessResult>;
}

// ── Chain execution (from subagent chain + sub-pi) ──────────────────────

export interface ChainStep {
  id: string;
  /** Prompt/instruction for this step */
  prompt: string;
  /** Whether to pass previous step output as context */
  passContext?: boolean;
  /** Model override for this step */
  model?: string;
  /** Timeout per step */
  timeout?: number;
}

export interface ChainResult {
  chainId: string;
  steps: ChainStepResult[];
  status: "succeeded" | "failed" | "cancelled";
  duration: number;
}

export interface ChainStepResult {
  stepId: string;
  status: "succeeded" | "failed" | "skipped";
  output: string;
  duration: number;
  error?: string;
}

// ── Loop execution (from ralph-loop) ────────────────────────────────────

export interface LoopConfig {
  /** Prompt/task to run each iteration */
  task: string;
  /** Condition command — loop continues while this returns "true" */
  conditionCmd: string;
  /** Maximum iterations */
  maxIterations?: number;
  /** Delay between iterations (ms) */
  interval?: number;
}

export interface LoopResult {
  loopId: string;
  iterations: LoopIteration[];
  totalDuration: number;
  status: "completed" | "cancelled" | "max_reached";
}

export interface LoopIteration {
  number: number;
  output: string;
  duration: number;
  status: "succeeded" | "failed";
}

export interface LoopControl {
  pause(): void;
  resume(): void;
  steer(direction: string): void;
  abort(): void;
  getStatus(): LoopStatus;
}

export interface LoopStatus {
  loopId: string;
  state: "running" | "paused" | "aborted" | "completed";
  currentIteration: number;
  lastOutput?: string;
}

// ── Pi subprocess (from sub-pi) ────────────────────────────────────────

export interface PiSubprocessTask {
  /** Prompt or instruction for pi */
  prompt: string;
  /** Skill to invoke (optional) */
  skill?: string;
  /** Model override (provider/modelId) */
  model?: string;
  /** Fork context from parent session */
  fork?: boolean;
  /** Thinking level */
  thinking?: string;
}

export interface PiSpawnResult {
  taskId: string;
  output: string;
  duration: number;
  status: "succeeded" | "failed";
  error?: string;
}
