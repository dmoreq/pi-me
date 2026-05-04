/**
 * Task & Plan Extension — Unified task + plan management.
 *
 * Replaces: core-tools/task-orchestration/, core-tools/planning/, core-tools/intent/
 *
 * Features:
 * - Auto-capture tasks from conversation (agent_end hook)
 * - AI-powered intent classification with manual fallback
 * - DAG-based task execution with retry + timeout
 * - Plan creation with steps, locking, assignment
 * - Safety/review mode for auto-captured tasks
 * - CRUD tool (task) with 15+ actions
 * - Telemetry tracking for all operations
 * - Garbage collection for completed tasks
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { ExtensionLifecycle } from "../../../shared/lifecycle.ts";
import { getTelemetry } from "pi-telemetry";
import { TaskStore } from "./store.ts";
import { TaskCapture } from "./capture.ts";
import { TaskExecutor, type ExecutorConfig } from "./executor.ts";
import { createIntentDetector } from "./intent-detector.ts";
import {
  createTaskPlanTool,
  registerTaskPlanCommands,
  type ToolDeps,
} from "./tool.ts";

export class TaskPlanExtension extends ExtensionLifecycle {
  readonly name = "task-plan";
  readonly version = "1.0.0";
  protected readonly description = "Unified task & plan management: auto-capture, AI intents, DAG execution, plans with steps, safety/review mode";
  protected readonly tools = ["task"];
  protected readonly events = ["session_start", "agent_end", "before_agent_start", "session_shutdown", "tool_call"];

  private store!: TaskStore;
  private capture!: TaskCapture;
  private executor!: TaskExecutor;
  private safetyMode = true;

  async onSessionStart(_event: unknown, ctx: ExtensionContext): Promise<void> {
    const dir = ctx.cwd ? `${ctx.cwd}/.pi/tasks` : ".pi/tasks";
    this.store = new TaskStore({ dir });
    await this.store.init();

    const { detector, hasAI } = createIntentDetector();
    this.capture = new TaskCapture(detector);
    this.executor = new TaskExecutor(this.store, {
      safetyMode: this.safetyMode,
      onExecute: async task => {
        try {
          const result = await this.pi.exec("bash", ["-c", task.text]);
          return { exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
        } catch (err) {
          return { exitCode: 1, error: (err as Error).message };
        }
      },
    });

    const deps: ToolDeps = {
      store: this.store,
      executor: this.executor,
      getSessionId: () => ctx.sessionManager?.getSessionId() ?? "",
      notify: (text, variant) => { this.notify(text, { severity: variant }); },
      track: (_event, _data) => { getTelemetry()?.heartbeat(this.name); },
    };

    this.pi.registerTool(createTaskPlanTool(deps) as any);
    registerTaskPlanCommands(this.pi, deps);

    const taskCount = await this.store.count();
    const pendingCount = await this.store.count("pending");
    getTelemetry()?.heartbeat(this.name);

    if (pendingCount > 0) {
      this.notify(`📋 ${pendingCount} pending task(s) loaded`, { severity: "info" });
    }
  }

  async onAgentEnd(_event: unknown, ctx: ExtensionContext): Promise<void> {
    if (!this.capture || !this.store) return;
    const messages = (ctx as any)?.messages ?? [];
    if (messages.length === 0) return;

    const result = await this.capture.capture(messages);
    if (result.tasks.length === 0) return;

    for (const task of result.tasks) {
      await this.store.save(task);
      await this.store.appendEvent({
        type: "created",
        taskId: task.id,
        task,
        timestamp: new Date().toISOString(),
      });
    }

    this.notify(`📋 Captured ${result.tasks.length} task(s) from conversation`, { severity: "info" });
    getTelemetry()?.heartbeat(this.name);
  }

  async onBeforeAgentStart(_event: unknown, ctx: ExtensionContext): Promise<unknown> {
    if (!this.store) return;
    const tasks = await this.store.getAll();
    const pending = tasks.filter(t => t.status === "pending");
    const needsReview = tasks.filter(t => t.requiresReview && t.status === "pending");

    if (tasks.length === 0 || (pending.length === 0 && needsReview.length === 0)) return;

    const lines: string[] = ["\n### Active Tasks & Plans"];
    if (needsReview.length > 0) {
      lines.push(`\n⚠️ **${needsReview.length} task(s) awaiting review** — use \`task\` tool with action=review`);
      for (const t of needsReview.slice(0, 5)) {
        const steps = t.steps ? ` [${t.steps.filter(s => s.done).length}/${t.steps.length}]` : "";
        lines.push(`  - ${t.id}: ${t.title ?? t.text.slice(0, 60)}${steps}`);
      }
      if (needsReview.length > 5) lines.push(`  - ... and ${needsReview.length - 5} more`);
    }
    if (pending.length > 0) {
      lines.push(`Pending (${pending.length}):`);
      for (const t of pending.slice(0, 5)) {
        const review = t.requiresReview ? " [review]" : "";
        const steps = t.steps ? ` [${t.steps.filter(s => s.done).length}/${t.steps.length}]` : "";
        lines.push(`  - ${t.id}: ${t.title ?? t.text.slice(0, 60)}${steps}${review}`);
      }
      if (pending.length > 5) lines.push(`  - ... and ${pending.length - 5} more`);
    }

    // Use the proper pi API for injecting context
    // The before_agent_start hook returns data, not modifies systemPrompt directly
    return {
      systemPrompt: ((ctx as any)?.systemPrompt ?? "") + "\n" + lines.join("\n"),
    };
  }

  async onSessionShutdown(): Promise<void> {
    if (!this.store) return;
    const pending = await this.store.count("pending");
    const running = await this.store.count("in_progress");
    if (pending > 0 || running > 0) {
      console.warn(`[task-plan] Session ended with ${running} running, ${pending} pending tasks`);
    }
    getTelemetry()?.heartbeat(this.name);
  }

  setSafetyMode(enabled: boolean): void {
    this.safetyMode = enabled;
    this.notify(`Safety mode ${enabled ? "enabled" : "disabled"}`, { severity: "info" });
    getTelemetry()?.heartbeat(this.name);
  }
}

export default function (pi: ExtensionAPI) {
  new TaskPlanExtension(pi).register();
}

export { TaskStore } from "./store.ts";
export { TaskCapture } from "./capture.ts";
export { TaskExecutor } from "./executor.ts";
export { TaskDAG } from "./types.ts";
export type { Task, TaskStatus, TaskIntent, Step, Priority } from "./types.ts";
