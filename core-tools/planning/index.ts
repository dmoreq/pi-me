/**
 * Planning Extension
 *
 * Unified plan/task management with DAG execution, step capture, and persistence.
 * Extends ExtensionLifecycle for automatic telemetry and hook wiring.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ExtensionLifecycle } from "../../shared/lifecycle.ts";
import { registerPackage, telemetryNotify } from "../../shared/telemetry-helpers.ts";
import { PlanDAG } from "./dag.ts";
import { StepExecutor } from "./executor.ts";
import type { Plan, PlanStep, PlanStepStatus } from "./types.ts";

export class PlanningExtension extends ExtensionLifecycle {
  readonly name = "planning";
  readonly version = "0.3.0";
  protected readonly description = "Unified plan management with DAG execution and step capture";
  protected readonly tools = [];
  protected readonly events = ["agent_end"];

  private activePlan: Plan | null = null;
  private executor = new StepExecutor();

  constructor(pi: ExtensionAPI) {
    super(pi);
    registerPackage({
      name: this.name,
      version: this.version,
      description: this.description,
      tools: [],
      events: this.events,
    });
  }

  /**
   * Auto-capture tasks from agent output and add to active plan.
   */
  async onAgentEnd(_: any, ctx: any) {
    if (!this.activePlan) return;

    const messages = ctx.messages ?? [];
    if (messages.length === 0) return;

    // Look for action-oriented assistant messages
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;

      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      const actionPatterns = [/should|need to|will|let's|next/i];

      if (actionPatterns.some(p => p.test(content))) {
        // Extracted task would go here (simplified for now)
        this.track("task_auto_captured", { planId: this.activePlan.id });
      }
    }
  }

  /**
   * Create a new plan.
   */
  async createPlan(title: string, description?: string): Promise<Plan> {
    const plan: Plan = {
      id: `plan-${Date.now()}`,
      title,
      description,
      status: "active",
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.activePlan = plan;
    this.notify(`Plan created: ${title}`, { severity: "info" });
    this.track("plan_created", { title });
    return plan;
  }

  /**
   * Add a step to the active plan.
   */
  async addStep(text: string, intent: any = "general"): Promise<PlanStep> {
    if (!this.activePlan) {
      throw new Error("No active plan");
    }

    const step: PlanStep = {
      id: `step-${this.activePlan.steps.length + 1}`,
      text,
      intent,
      status: "pending",
    };

    this.activePlan.steps.push(step);
    this.activePlan.updatedAt = new Date().toISOString();
    return step;
  }

  /**
   * Execute all steps in the active plan.
   */
  async executePlan(): Promise<void> {
    if (!this.activePlan) {
      throw new Error("No active plan");
    }

    const dag = new PlanDAG(this.activePlan.steps);
    const result = await this.executor.execute(dag);

    // Update step statuses
    for (const [stepId, stepResult] of result.results) {
      const step = this.activePlan.steps.find(s => s.id === stepId);
      if (step) {
        step.status = stepResult.status;
        step.result = stepResult.output;
        if (stepResult.status === "completed" || stepResult.status === "failed") {
          step.completedAt = new Date().toISOString();
        }
      }
    }

    this.notify(`Plan execution: ${result.message}`, { severity: result.status === "succeeded" ? "success" : "warning" });
    this.track("plan_executed", { planId: this.activePlan.id, status: result.status });
  }

  /**
   * Get the active plan.
   */
  getActivePlan(): Plan | null {
    return this.activePlan;
  }

  /**
   * Set the active plan.
   */
  setActivePlan(plan: Plan | null): void {
    this.activePlan = plan;
  }
}

/**
 * Default export for pi-me loader.
 */
export default function (pi: ExtensionAPI) {
  const ext = new PlanningExtension(pi);
  ext.register();
}
