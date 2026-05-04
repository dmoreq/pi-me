/**
 * Subprocess Orchestration Extension
 *
 * Run subprocess tasks from plans with retry, parallel execution, and monitoring.
 * Extends ExtensionLifecycle for automatic telemetry.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ExtensionLifecycle } from "../../shared/lifecycle.ts";
import { registerPackage } from "../../shared/telemetry-helpers.ts";
import { SubprocessExecutor } from "./executor.ts";
import { TaskNormalizer } from "./normalizer.ts";
import type { SubprocessTask, SubprocessConfig } from "./types.ts";

export class SubprocessOrchestrationExtension extends ExtensionLifecycle {
  readonly name = "subprocess-orchestration";
  readonly version = "0.3.0";
  protected readonly description = "Execute plan steps as subprocess tasks with orchestration";
  protected readonly tools = [];
  protected readonly events = ["agent_end"];

  private executor: SubprocessExecutor;
  private normalizer = TaskNormalizer;

  constructor(pi: ExtensionAPI, config?: SubprocessConfig) {
    super(pi);
    this.executor = new SubprocessExecutor(config);

    registerPackage({
      name: this.name,
      version: this.version,
      description: this.description,
      tools: [],
      events: this.events,
    });
  }

  /**
   * Auto-detect when agent finishes planning a task and run it.
   */
  async onAgentEnd(_: any, ctx: any) {
    // Check if there's an active plan to execute
    const plan = ctx.activePlan;
    if (!plan || !plan.steps) return;

    // Filter pending steps
    const pendingSteps = plan.steps.filter((s: any) => s.status === "pending");
    if (pendingSteps.length === 0) return;

    // Check if user has just created a plan (agent_end right after planning)
    const hasRecentPlan = plan.createdAt && 
      Date.now() - new Date(plan.createdAt).getTime() < 5000; // within 5s

    if (hasRecentPlan) {
      this.track("auto_execute_plan", { stepCount: pendingSteps.length });
      // Would auto-execute here in production
    }
  }

  /**
   * Run a subprocess task.
   */
  async runTask(task: SubprocessTask): Promise<any> {
    const results = await this.executor.execute([task]);
    return results[0];
  }

  /**
   * Run multiple subprocess tasks.
   */
  async runTasks(tasks: SubprocessTask[]): Promise<any[]> {
    return this.executor.execute(tasks);
  }

  /**
   * Normalize plan steps and run them as subprocess tasks.
   */
  async runPlan(steps: any[], cwd?: string): Promise<any[]> {
    const tasks = this.normalizer.normalizeMany(steps, cwd);

    // Fire telemetry automation trigger
    const { TelemetryAutomation } = await import("../../shared/telemetry-automation.ts");
    const normalizeTrigger = TelemetryAutomation.tasksNormalized(tasks.length);
    TelemetryAutomation.fire(this, normalizeTrigger);

    return this.runTasks(tasks);
  }

  /**
   * Get the executor (for direct access).
   */
  getExecutor(): SubprocessExecutor {
    return this.executor;
  }

  /**
   * Get the normalizer (for direct access).
   */
  getNormalizer() {
    return this.normalizer;
  }
}

/**
 * Default export for pi-me loader.
 */
export default function (pi: ExtensionAPI) {
  const ext = new SubprocessOrchestrationExtension(pi);
  ext.register();
}
