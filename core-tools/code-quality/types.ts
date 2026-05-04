/**
 * Code Quality Pipeline Types
 *
 * Format → Fix → Notify pipeline types.
 * Removed unused "analyze" stage and Snippet type.
 */

export interface CodeRunner {
  readonly id: string;
  readonly type: "format" | "fix";
  matches(filePath: string): boolean;
  run(filePath: string, config: RunnerConfig): Promise<RunnerResult>;
}

export interface RunnerConfig {
  cwd: string;
  timeoutMs: number;
  exec(cmd: string, args: string[], opts: { cwd: string; timeout: number }): Promise<ExecResult>;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr?: string;
}

export interface RunnerResult {
  status: "succeeded" | "failed" | "skipped" | "warning";
  message?: string;
  changes?: number; // issues fixed
}

export interface StageResult {
  status: "succeeded" | "failed" | "skipped";
  message?: string;
  changes?: number;
}

export interface ProcessResult {
  filePath: string;
  format: StageResult;
  fix: StageResult;
  duration: number; // ms
}
