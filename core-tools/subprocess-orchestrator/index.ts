/**
 * Subprocess Orchestration Extension
 *
 * Registers a "subprocess" tool that pi can invoke directly.
 * Supports: single, chain, loop, bg, pi, list, status modes.
 */

import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent";
import { ExtensionLifecycle } from "../../shared/lifecycle.ts";
import { registerPackage } from "../../shared/telemetry-helpers.ts";
import { Type } from "@sinclair/typebox";
import { SubprocessExecutor } from "./executor.ts";
import { TaskNormalizer } from "./normalizer.ts";
import type { SubprocessTask, SubprocessConfig, JobHandle } from "./types.ts";

// ── Tool parameter schema ───────────────────────────────────────────────

const SubprocessParams = Type.Object({
  action: Type.String({ description: "Action: single, chain, loop, bg, pi, list, status, plan" }),
  cmd: Type.Optional(Type.String({ description: "Command to execute" })),
  args: Type.Optional(Type.Array(Type.String())),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
  critical: Type.Optional(Type.Boolean()),
  steps: Type.Optional(Type.Array(Type.Any())),
  task: Type.Optional(Type.String({ description: "Command to run each iteration" })),
  conditionCmd: Type.Optional(Type.String({ description: "Continue while this returns 'true'" })),
  maxIterations: Type.Optional(Type.Number({ default: 10 })),
  interval: Type.Optional(Type.Number({ default: 1000 })),
  label: Type.Optional(Type.String()),
  notifyOnComplete: Type.Optional(Type.Boolean()),
  prompt: Type.Optional(Type.String({ description: "Prompt for pi subprocess" })),
  skill: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  fork: Type.Optional(Type.Boolean()),
  parallel: Type.Optional(Type.Boolean({ default: false })),
});

export class SubprocessOrchestrationExtension extends ExtensionLifecycle {
  readonly name = "subprocess-orchestrator";
  readonly version = "0.6.0";
  protected readonly description = "Execute subprocess tasks: single, chain, loop, background, pi subprocess";
  protected readonly tools = ["subprocess"];
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
      tools: this.tools,
      events: this.events,
    });
  }

  /**
   * Register the subprocess tool with pi.
   */
  registerTool(): void {
    const tool: ToolDefinition<typeof SubprocessParams, any> = {
      name: "subprocess",
      label: "Subprocess Orchestrator",
      description: `Execute tasks via subprocess.

MODES (use exactly one action):
• single  - Run one command
• chain   - Sequential pipeline with context passing
• loop    - Repeat until condition is false
• bg      - Run in background, returns job ID
• pi      - Spawn isolated pi subprocess for a prompt
• list    - List active background jobs
• status  - Inspect a background job by id
• plan    - Execute pending plan steps (auto-detected from active plan)`,
      parameters: SubprocessParams,

      execute: async (id, params) => {
        return this.handleExecute(id, params);
      },

      renderCall(args: any, theme: any) {
        const { Text } = require("@mariozechner/pi-tui");
        const action = args.action || "single";
        const label = action === "chain" ? `chain (${args.steps?.length ?? 0} steps)`
          : action === "loop" ? `loop (max ${args.maxIterations ?? 10})`
          : action === "bg" ? `bg: ${args.label || args.cmd?.slice(0, 40)}`
          : action === "pi" ? `pi: ${args.prompt?.slice(0, 40)}`
          : action === "list" ? "list jobs"
          : action === "status" ? `status: ${args.id}`
          : args.cmd?.slice(0, 60) || "subprocess";
        return new (require("@mariozechner/pi-tui").Text)(
          `${theme.fg("toolTitle", theme.bold("subprocess "))}${theme.fg("accent", label)}`,
          0, 0,
        );
      },
    };

    this.pi.registerTool(tool);
  }

  private async handleExecute(id: string, params: any): Promise<any> {
    switch (params.action) {
      case "single":
        return this.executeSingle(id, params);
      case "chain":
        return this.executeChain(id, params);
      case "loop":
        return this.executeLoop(id, params);
      case "bg":
        return this.executeBackground(id, params);
      case "pi":
        return this.executePi(id, params);
      case "list":
        return { jobs: this.executor.listJobs().map(j => ({ jobId: j.jobId, status: j.status, label: j.task.label, createdAt: j.createdAt })) };
      case "status":
        return this.getJobStatus(params.id);
      case "plan":
        return this.executePlan(id);
      default:
        return { error: `Unknown action: ${params.action}` };
    }
  }

  private async executeSingle(id: string, params: any): Promise<any> {
    const task: SubprocessTask = {
      id,
      name: params.cmd.slice(0, 60),
      cmd: params.cmd,
      args: params.args,
      cwd: params.cwd,
      timeout: params.timeout,
      critical: params.critical,
    };
    const result = await this.executor.execute([task]);
    return result[0];
  }

  private async executeChain(id: string, params: any): Promise<any> {
    const result = await this.executor.executeChain(params.steps);
    return result;
  }

  private async executeLoop(id: string, params: any): Promise<any> {
    const { result, control } = await this.executor.executeLoop({
      task: params.task,
      conditionCmd: params.conditionCmd,
      maxIterations: params.maxIterations,
      interval: params.interval,
    });
    return { ...result, _controlId: result.loopId };
  }

  private async executeBackground(id: string, params: any): Promise<any> {
    const handle = await this.executor.executeBackground({
      id,
      name: params.label || params.cmd.slice(0, 60),
      cmd: params.cmd,
      args: params.args,
      label: params.label,
      notifyOnComplete: params.notifyOnComplete,
    });
    return { jobId: handle.jobId, status: handle.status, message: `Job ${handle.jobId} started in background. Use { action: "status", id: "${handle.jobId}" } to check.` };
  }

  private async executePi(id: string, params: any): Promise<any> {
    const result = await this.executor.spawnPi({
      prompt: params.prompt,
      skill: params.skill,
      model: params.model,
      fork: params.fork,
    });
    return result;
  }

  private async getJobStatus(jobId: string): Promise<any> {
    const job = this.executor.listJobs().find(j => j.jobId === jobId);
    if (!job) return { error: `Job not found: ${jobId}` };
    const result = await this.executor.watchJob(jobId);
    return { jobId: job.jobId, status: job.status, result };
  }

  private async executePlan(id: string): Promise<any> {
    // Plan execution via normalizer — called when plan exists
    // This is a hook point; actual plan execution is triggered on agent_end
    return { message: "Plan execution triggered. Use subprocess action 'single' for individual steps." };
  }

  /**
   * Auto-detect when agent finishes planning and offer to run pending steps.
   */
  async onAgentEnd(_: any, ctx: any) {
    const plan = ctx.activePlan;
    if (!plan || !plan.steps) return;

    const pendingSteps = plan.steps.filter((s: any) => s.status === "pending");
    if (pendingSteps.length === 0) return;

    const hasRecentPlan = plan.createdAt &&
      Date.now() - new Date(plan.createdAt).getTime() < 5000;

    if (hasRecentPlan) {
      this.track("auto_execute_plan", { stepCount: pendingSteps.length });
    }
  }

  /**
   * Get the underlying executor (for direct access by other extensions).
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

  /**
   * Run plan steps as subprocess tasks.
   */
  async runPlanSteps(steps: any[], cwd?: string) {
    const tasks = this.normalizer.normalizeMany(steps, cwd);

    const { TelemetryAutomation } = await import("../../shared/telemetry-automation.ts");
    const normalizeTrigger = TelemetryAutomation.tasksNormalized(tasks.length);
    TelemetryAutomation.fire(this, normalizeTrigger);

    return this.executor.execute(tasks);
  }
}

/**
 * Default export for pi-me loader.
 * Registers both the extension lifecycle AND the subprocess tool.
 */
export default function (pi: ExtensionAPI) {
  const ext = new SubprocessOrchestrationExtension(pi);
  ext.register();   // Wire lifecycle hooks + telemetry
  ext.registerTool(); // Register the "subprocess" tool for pi
}
