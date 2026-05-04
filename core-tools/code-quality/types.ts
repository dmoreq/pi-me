/**
 * Code Quality Pipeline types
 */

export interface CodeRunner {
  readonly id: string;
  readonly type: "format" | "fix" | "analyze";
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
  changes?: number; // lines changed
}

export interface PipelineResult {
  filePath: string;
  format: RunnerResult[];
  fix: RunnerResult[];
  analyze: RunnerResult[];
  duration: number; // ms
}

export interface Snippet {
  id: string;
  file: string;
  startLine: number;
  endLine: number;
  language: string;
  code: string;
  description: string;
}
