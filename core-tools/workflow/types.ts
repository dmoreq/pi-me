/**
 * workflow — unified task/plan/subprocess types.
 */

export type WorkflowStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "archived";

export type StepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped"
  | "blocked";

export type StepExecutor = "none" | "manual" | "shell" | "pi";

export interface WorkflowStep {
  id: string;
  text: string;
  status: StepStatus;
  executor: StepExecutor;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  retries?: number;
  critical?: boolean;
  dependsOn?: string[];
  startedAt?: string;
  completedAt?: string;
  stdout?: string;
  stderr?: string;
  error?: string;
}

export interface Workflow {
  id: string;
  title: string;
  description?: string;
  status: WorkflowStatus;
  priority: "low" | "normal" | "high";
  source: "manual" | "auto" | "migrated";
  requiresReview?: boolean;
  assignedToSession?: string;
  intent?: string;
  steps: WorkflowStep[];
  currentStepId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface WorkflowJob {
  id: string;
  workflowId?: string;
  stepId?: string;
  label: string;
  command: string;
  args?: string[];
  cwd?: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "timeout";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  duration?: number;
}

export interface WorkflowEvent {
  type: "created" | "updated" | "deleted" | "started" | "completed" | "failed" | "skipped" | "migrated";
  workflowId: string;
  stepId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowSearch {
  text?: string;
  status?: WorkflowStatus;
  priority?: Workflow["priority"];
  source?: Workflow["source"];
  requiresReview?: boolean;
  assignedToSession?: string;
  intent?: string;
}

export interface CommandTask {
  id: string;
  label: string;
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  critical?: boolean;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}
