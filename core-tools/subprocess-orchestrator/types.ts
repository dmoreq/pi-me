/**
 * Subprocess Orchestration types
 */

export interface SubprocessTask {
  id: string;
  name: string;
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number; // ms
  critical?: boolean; // fail entire run if this fails
}

export interface SubprocessResult {
  taskId: string;
  status: "succeeded" | "failed" | "timeout" | "skipped";
  exitCode?: number;
  stdout: string;
  stderr?: string;
  duration: number; // ms
}

export interface SubprocessConfig {
  parallel?: boolean; // run all tasks concurrently
  stopOnError?: boolean; // stop if any critical task fails
  timeout?: number; // global timeout in ms
  retries?: number; // retry failed tasks
  env?: Record<string, string>; // default environment
}
