/**
 * workflow — unified task/plan/subprocess extension.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { ExtensionLifecycle } from "../../shared/lifecycle.ts";
import { getTelemetry } from "pi-telemetry";
import { WorkflowStore } from "./store.ts";
import { WorkflowExecutor } from "./executor.ts";
import { WorkflowRunner } from "./runner.ts";
import { createWorkflowTool } from "./tool.ts";
import { renderCompactStatus, renderWorkflowSummary, shouldShowChecklist } from "./ui.ts";
import { migrateTaskPlanToWorkflow } from "./migration.ts";

export class WorkflowExtension extends ExtensionLifecycle {
  readonly name = "workflow";
  readonly version = "1.0.0";
  protected readonly description = "Unified workflow management for tasks, plans, subprocess execution, and checklist UI.";
  protected readonly tools = ["workflow"];
  protected readonly events = ["session_start", "agent_end", "before_agent_start", "session_shutdown", "tool_call"];

  private store!: WorkflowStore;
  private executor!: WorkflowExecutor;
  private runner!: WorkflowRunner;

  async onSessionStart(_event: unknown, ctx: ExtensionContext): Promise<void> {
    this.store = new WorkflowStore(ctx.cwd ? `${ctx.cwd}/.pi/workflows` : ".pi/workflows");
    await this.store.init();
    await migrateTaskPlanToWorkflow().catch(() => false);

    this.executor = new WorkflowExecutor();
    this.runner = new WorkflowRunner(this.store, this.executor);

    this.pi.registerTool(createWorkflowTool({
      store: this.store,
      executor: this.executor,
      runner: this.runner,
      getSessionId: () => ctx.sessionManager?.getSessionId() ?? "",
      notify: (text, variant) => this.notify(text, { severity: variant }),
      track: (_event, _data) => getTelemetry()?.heartbeat(this.name),
      getActiveWorkflow: async () => this.getActiveWorkflow(),
    }) as any);

    this.pi.registerCommand("workflow", { description: "Workflow manager alias", handler: async (args, ctx) => this.handleCommand(args, ctx) });
    this.pi.registerCommand("plan", { description: "Workflow alias", handler: async (args, ctx) => this.handleCommand(args, ctx) });
    this.pi.registerCommand("tasks", { description: "Workflow alias", handler: async (args, ctx) => this.handleCommand(args, ctx) });
  }

  private async handleCommand(args: string, ctx: ExtensionContext): Promise<void> {
    const trimmed = (args ?? "").trim();
    if (trimmed === "") {
      ctx.ui.setEditorText(await this.renderActiveSummary());
      return;
    }
    if (trimmed === "current" || trimmed === "run") {
      ctx.ui.setEditorText(await this.renderActiveSummary());
      return;
    }
    if (trimmed === "list" || trimmed === "review") {
      ctx.ui.setEditorText(renderWorkflowSummary(await this.store.list()));
      return;
    }
    ctx.ui.setEditorText(await this.renderActiveSummary());
  }

  async onBeforeAgentStart(_event: unknown, ctx: ExtensionContext): Promise<unknown> {
    const workflow = await this.getActiveWorkflow();
    if (!workflow || !shouldShowChecklist(workflow)) return;
    return { systemPrompt: ((ctx as any)?.systemPrompt ?? "") + "\n" + renderWorkflowSummary([workflow]) };
  }

  async onAgentEnd(): Promise<void> {
    const workflow = await this.getActiveWorkflow();
    if (workflow && shouldShowChecklist(workflow)) {
      this.notify(renderCompactStatus(workflow), { severity: "info" });
      getTelemetry()?.heartbeat(this.name);
    }
  }

  async onSessionShutdown(): Promise<void> {
    const workflow = await this.getActiveWorkflow();
    if (workflow && shouldShowChecklist(workflow)) this.notify(`Workflow still active: ${workflow.title}`, { severity: "warning" });
  }

  private async getActiveWorkflow() {
    const workflows = await this.store.list();
    return workflows.find(w => shouldShowChecklist(w)) ?? null;
  }

  private async renderActiveSummary(): Promise<string> {
    const workflow = await this.getActiveWorkflow();
    return workflow ? renderWorkflowSummary([workflow]) : "No active workflow.";
  }
}

export default function (pi: ExtensionAPI) { new WorkflowExtension(pi).register(); }
