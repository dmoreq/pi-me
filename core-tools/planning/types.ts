/**
 * Unified planning types (merged plan-mode + task-orchestration)
 */

export type PlanStepStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";
export type TaskIntent = "fix" | "refactor" | "test" | "docs" | "deploy" | "analyze" | "implement" | "general";

export interface PlanStep {
  id: string;
  text: string;
  intent: TaskIntent;
  status: PlanStepStatus;
  dependsOn?: string[]; // step IDs this depends on
  startedAt?: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
  result?: string; // result from execution
  topic?: string; // group related steps
  sequenceOrder?: number; // explicit ordering hint
}

export interface Plan {
  id: string;
  title: string;
  description?: string;
  status: "active" | "completed" | "archived";
  steps: PlanStep[];
  createdAt: string; // ISO timestamp
  updatedAt: string;
  assignedToSession?: string; // session ID if handoff'ed
}

export interface PlanResult {
  status: "succeeded" | "failed" | "partial";
  message?: string;
  results: Map<string, { status: PlanStepStatus; output?: string }>;
}

/**
 * Configuration for planning behavior.
 */
export interface PlanningConfig {
  enabled: boolean;
  autoCaptureTasks: boolean; // extract tasks from agent output
  persistPlans: boolean; // save plans to .pi/plans/
  plansDir: string; // default ~/.pi/plans
}
