/**
 * Unified Task/Plan Tool — the single tool + commands for all task & plan operations.
 *
 * Merges:
 * - planning/plan-mode.ts (plan tool: list/get/create/update/add-step/complete-step/delete/claim/release/execute)
 * - task-orchestration/src/index.ts (task_control tool: skip/retry/prioritize)
 *
 * Actions: list, get, create, update, delete, add-step, complete-step,
 *          claim, release, execute, skip, retry, review (approve/reject), search
 *
 * Design: single tool with discriminated action parameter.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import type { Task, TaskStatus } from "./types.ts";
import type { TaskStore, SearchQuery } from "./store.ts";
import { TaskDAG } from "./types.ts";
import { TaskExecutor } from "./executor.ts";

// ─── Tool Parameter Schema ──────────────────────────────────────────────────

const ActionEnum = [
  "list", "get", "create", "update", "delete",
  "add-step", "complete-step",
  "claim", "release",
  "execute", "skip", "retry",
  "review", "search",
] as const;

export const TaskPlanParams = Type.Object({
  action: Type.String({
    enum: ActionEnum as unknown as [string, ...string[]],
    description: "Action to perform",
  }),
  id: Type.Optional(Type.String({ description: "Task/plan ID" })),
  title: Type.Optional(Type.String({ description: "Title (for create/update)" })),
  text: Type.Optional(Type.String({ description: "Task text (for create/update)" })),
  status: Type.Optional(Type.String({ description: "New status" })),
  steps: Type.Optional(Type.Array(Type.String(), { description: "Step texts (for create)" })),
  stepText: Type.Optional(Type.String({ description: "Step text (for add-step)" })),
  stepId: Type.Optional(Type.Number({ description: "Step ID (for complete-step)" })),
  intent: Type.Optional(Type.String({ description: "Task intent" })),
  priority: Type.Optional(Type.String({ description: "Priority: low/normal/high" })),
  tags: Type.Optional(Type.Array(Type.String())),
  force: Type.Optional(Type.Boolean({ description: "Override session assignment" })),
  query: Type.Optional(Type.String({ description: "Search query (for search action)" })),
});

type Action = (typeof ActionEnum)[number];

// ─── Tool Handler Factory ──────────────────────────────────────────────────

export interface ToolDeps {
  store: TaskStore;
  executor: TaskExecutor;
  getSessionId: () => string;
  notify: (text: string, variant: "info" | "success" | "warning" | "error") => void;
  track: (event: string, data?: Record<string, unknown>) => void;
}

export function createTaskPlanTool(deps: ToolDeps) {
  const { store, executor, getSessionId, notify, track } = deps;

  return {
    name: "task",
    label: "Task & Plan Manager",
    description:
      "Manage tasks and plans. A plan is a task with steps. " +
      "Actions: list, get, create, update, delete, add-step, complete-step, " +
      "claim, release, execute, skip, retry, review, search.",
    parameters: TaskPlanParams,
    execute: async (_toolCallId: string, params: Record<string, unknown>, _signal: unknown, _onUpdate: unknown, _ctx: unknown) => {
      const action = params.action as Action;
      const id = params.id as string | undefined;
      const sessionId = getSessionId();

      try {
        switch (action) {
          case "list": return handleList(store, sessionId);
          case "get": return handleGet(store, id);
          case "create": return handleCreate(store, id, params, sessionId, notify);
          case "update": return handleUpdate(store, id, params, notify);
          case "delete": return handleDelete(store, id, notify);
          case "add-step": return handleAddStep(store, id, params);
          case "complete-step": return handleCompleteStep(store, id, params);
          case "claim": return handleClaim(store, id, sessionId);
          case "release": return handleRelease(store, id);
          case "execute": return handleExecute(store, executor, id, sessionId, params, notify, track);
          case "skip": return handleSkip(store, executor, id, notify);
          case "retry": return handleRetry(store, executor, id, notify);
          case "review": return handleReview(store, id, params, notify);
          case "search": return handleSearch(store, params);
          default: return { content: [{ type: "text" as const, text: `Unknown action: ${action}` }] };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
      }
    },
  };
}

// ─── Action Handlers ────────────────────────────────────────────────────────

async function handleList(store: TaskStore, sessionId: string) {
  const tasks = await store.getAll();
  const summary = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === "pending").length,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    completed: tasks.filter(t => t.status === "completed").length,
    failed: tasks.filter(t => t.status === "failed").length,
    requiresReview: tasks.filter(t => t.requiresReview).length,
  };

  const list = tasks.map(t => ({
    id: t.id,
    title: t.title ?? t.text.slice(0, 60),
    status: t.status,
    intent: t.intent,
    priority: t.priority,
    steps: t.steps ? `${t.steps.filter(s => s.done).length}/${t.steps.length}` : undefined,
    assigned: t.assignedToSession === sessionId ? "current" : t.assignedToSession ? "other" : undefined,
    needsReview: t.requiresReview || undefined,
  }));

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ summary, tasks: list }, null, 2) }],
  };
}

async function handleGet(store: TaskStore, id: string | undefined) {
  if (!id) return { content: [{ type: "text" as const, text: "Error: id required" }] };
  const task = await store.get(id);
  if (!task) return { content: [{ type: "text" as const, text: `Task ${id} not found` }] };
  return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
}

async function handleCreate(
  store: TaskStore,
  id: string | undefined,
  params: Record<string, unknown>,
  sessionId: string,
  notify: (text: string, variant: "info" | "success" | "warning" | "error") => void,
) {
  const now = new Date().toISOString();
  const stepTexts = params.steps as string[] | undefined;
  const steps = stepTexts?.map((text, i) => ({ id: i + 1, text, done: false }));

  const task: Task = {
    id: id ?? `task-${Date.now()}`,
    title: params.title as string | undefined,
    text: (params.text as string) ?? (params.title as string) ?? "",
    status: (params.status as TaskStatus) ?? "pending",
    intent: params.intent as Task["intent"],
    priority: (params.priority as Task["priority"]) ?? "normal",
    steps,
    tags: params.tags as string[] | undefined,
    source: "manual",
    createdAt: now,
    assignedToSession: sessionId,
    requiresReview: Boolean(steps && steps.length > 0), // Plans require review
  };

  if (!task.text && !task.title) {
    return { content: [{ type: "text" as const, text: "Error: title or text required" }] };
  }

  await store.save(task);
  notify(`Created ${steps ? "plan" : "task"}: ${task.title ?? task.text.slice(0, 40)}`, "success");
  track("task_created", { id: task.id, type: steps ? "plan" : "task", intent: task.intent });
  return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
}

async function handleUpdate(
  store: TaskStore,
  id: string | undefined,
  params: Record<string, unknown>,
  notify: (text: string, variant: "info" | "success" | "warning" | "error") => void,
) {
  if (!id) return { content: [{ type: "text" as const, text: "Error: id required" }] };
  const task = await store.get(id);
  if (!task) return { content: [{ type: "text" as const, text: `Task ${id} not found` }] };

  if (params.title !== undefined) task.title = params.title as string;
  if (params.text !== undefined) task.text = params.text as string;
  if (params.status !== undefined) task.status = params.status as TaskStatus;
  if (params.intent !== undefined) task.intent = params.intent as Task["intent"];
  if (params.priority !== undefined) task.priority = params.priority as Task["priority"];
  if (params.tags !== undefined) task.tags = params.tags as string[];

  await store.save(task);
  notify(`Updated: ${task.title ?? task.id}`, "info");
  return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
}

async function handleDelete(
  store: TaskStore,
  id: string | undefined,
  notify: (text: string, variant: "info" | "success" | "warning" | "error") => void,
) {
  if (!id) return { content: [{ type: "text" as const, text: "Error: id required" }] };
  await store.delete(id);
  notify(`Deleted: ${id}`, "info");
  return { content: [{ type: "text" as const, text: `Deleted ${id}` }] };
}

async function handleAddStep(
  store: TaskStore,
  id: string | undefined,
  params: Record<string, unknown>,
) {
  if (!id) return { content: [{ type: "text" as const, text: "Error: id required" }] };
  const task = await store.get(id);
  if (!task) return { content: [{ type: "text" as const, text: `Task ${id} not found` }] };

  const stepText = params.stepText as string | undefined;
  if (!stepText) return { content: [{ type: "text" as const, text: "Error: stepText required" }] };

  if (!task.steps) task.steps = [];
  task.steps.push({ id: task.steps.length + 1, text: stepText, done: false });
  await store.save(task);
  return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
}

async function handleCompleteStep(
  store: TaskStore,
  id: string | undefined,
  params: Record<string, unknown>,
) {
  if (!id) return { content: [{ type: "text" as const, text: "Error: id required" }] };
  const task = await store.get(id);
  if (!task) return { content: [{ type: "text" as const, text: `Task ${id} not found` }] };

  const stepId = params.stepId as number | undefined;
  if (!stepId) return { content: [{ type: "text" as const, text: "Error: stepId required" }] };

  const step = task.steps?.find(s => s.id === stepId);
  if (!step) return { content: [{ type: "text" as const, text: `Step ${stepId} not found` }] };

  step.done = true;

  // Auto-complete the task if all steps done
  if (task.steps?.every(s => s.done)) {
    task.status = "completed";
    task.completedAt = new Date().toISOString();
  }

  await store.save(task);
  return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
}

async function handleClaim(store: TaskStore, id: string | undefined, sessionId: string) {
  if (!id) return { content: [{ type: "text" as const, text: "Error: id required" }] };
  const task = await store.get(id);
  if (!task) return { content: [{ type: "text" as const, text: `Task ${id} not found` }] };
  task.assignedToSession = sessionId;
  await store.save(task);
  return { content: [{ type: "text" as const, text: `Claimed ${id}` }] };
}

async function handleRelease(store: TaskStore, id: string | undefined) {
  if (!id) return { content: [{ type: "text" as const, text: "Error: id required" }] };
  const task = await store.get(id);
  if (!task) return { content: [{ type: "text" as const, text: `Task ${id} not found` }] };
  task.assignedToSession = undefined;
  await store.save(task);
  return { content: [{ type: "text" as const, text: `Released ${id}` }] };
}

async function handleExecute(
  store: TaskStore,
  executor: TaskExecutor,
  id: string | undefined,
  sessionId: string,
  params: Record<string, unknown>,
  _notify: (text: string, variant: "info" | "success" | "warning" | "error") => void,
  track: (event: string, data?: Record<string, unknown>) => void,
) {
  if (!id) return { content: [{ type: "text" as const, text: "Error: id required" }] };
  const task = await store.get(id);
  if (!task) return { content: [{ type: "text" as const, text: `Task ${id} not found` }] };

  if (task.assignedToSession && task.assignedToSession !== sessionId && !params.force) {
    return {
      content: [{
        type: "text" as const,
        text: `Task ${id} is assigned to session ${task.assignedToSession}. Use force=true to override.`,
      }],
    };
  }

  task.assignedToSession = sessionId;
  await store.save(task);

  // Execute
  track("task_execute", { id: task.id });

  // If the task has steps, execute each step
  if (task.steps && task.steps.length > 0) {
    const remaining = task.steps.filter(s => !s.done);
    if (remaining.length === 0) {
      return { content: [{ type: "text" as const, text: "All steps complete! Mark the task as completed." }] };
    }
    return {
      content: [{
        type: "text" as const,
        text: `Executing task ${id}. Remaining steps:\n${remaining.map(s => `${s.id}. ${s.text}`).join("\n")}`,
      }],
    };
  }

  // Single task — run through executor
  const result = await executor.executeOne(task);
  track("task_completed", { id: task.id, status: task.status, duration: task.result?.duration });

  return {
    content: [{
      type: "text" as const,
      text: result.exitCode === 0 ? `Completed: ${task.text}` : `Failed: ${task.text}\n${result.error ?? ""}`,
    }],
  };
}

async function handleSkip(
  store: TaskStore,
  executor: TaskExecutor,
  id: string | undefined,
  notify: (text: string, variant: "info" | "success" | "warning" | "error") => void,
) {
  if (!id) return { content: [{ type: "text" as const, text: "Error: id required" }] };
  const task = await store.get(id);
  if (!task) return { content: [{ type: "text" as const, text: `Task ${id} not found` }] };
  await executor.skip(task);
  notify(`Skipped: ${task.title ?? task.id}`, "info");
  return { content: [{ type: "text" as const, text: `Skipped ${id}` }] };
}

async function handleRetry(
  store: TaskStore,
  executor: TaskExecutor,
  id: string | undefined,
  notify: (text: string, variant: "info" | "success" | "warning" | "error") => void,
) {
  if (!id) return { content: [{ type: "text" as const, text: "Error: id required" }] };
  const task = await store.get(id);
  if (!task) return { content: [{ type: "text" as const, text: `Task ${id} not found` }] };
  const result = await executor.retry(task);
  notify(`Retry ${result.exitCode === 0 ? "succeeded" : "failed"}: ${task.title ?? task.id}`, result.exitCode === 0 ? "success" : "warning");
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
}

async function handleReview(
  store: TaskStore,
  id: string | undefined,
  params: Record<string, unknown>,
  notify: (text: string, variant: "info" | "success" | "warning" | "error") => void,
) {
  if (!id) return { content: [{ type: "text" as const, text: "Error: id required" }] };
  const task = await store.get(id);
  if (!task) return { content: [{ type: "text" as const, text: `Task ${id} not found` }] };

  const approve = params.approve as boolean | undefined;
  if (approve === true) {
    task.requiresReview = false;
    await store.save(task);
    notify(`Approved: ${task.title ?? task.id}`, "success");
    return { content: [{ type: "text" as const, text: `Approved ${id} for execution` }] };
  }

  // Just show review status
  return {
    content: [{
      type: "text" as const,
      text: task.requiresReview
        ? `Task ${id} requires review. Use approve=true to approve.`
        : `Task ${id} is already approved.`,
    }],
  };
}

async function handleSearch(store: TaskStore, params: Record<string, unknown>) {
  const queryStr = params.query as string | undefined;
  if (!queryStr) {
    const tasks = await store.getAll();
    return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
  }

  const query: SearchQuery = { text: queryStr };
  const results = await store.search(query);
  return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
}

// ─── Commands ──────────────────────────────────────────────────────────────

export function registerTaskPlanCommands(pi: ExtensionAPI, deps: ToolDeps) {
  const { store, getSessionId, notify } = deps;

  pi.registerCommand("tasks", {
    description: "List all tasks and plans. Usage: /tasks",
    handler: async (_args, ctx) => {
      const tasks = await store.getAll();
      const active = tasks.filter(t => ["pending", "in_progress"].includes(t.status));
      const completed = tasks.filter(t => t.status === "completed");
      const needsReview = tasks.filter(t => t.requiresReview);

      let text = "## Tasks & Plans\n\n";
      if (needsReview.length > 0) {
        text += `### ⚠️ Need Review (${needsReview.length})\n`;
        for (const t of needsReview) {
          text += `- ${t.id}: ${t.title ?? t.text.slice(0, 60)} ${t.steps ? `[${t.steps.filter(s => s.done).length}/${t.steps.length}]` : ""}\n`;
        }
        text += "\n";
      }

      text += `### Active (${active.length})\n`;
      for (const t of active) {
        const review = t.requiresReview ? " [requires review]" : "";
        const steps = t.steps ? ` [${t.steps.filter(s => s.done).length}/${t.steps.length}]` : "";
        text += `- ${t.id}: ${t.title ?? t.text.slice(0, 60)} (${t.status})${steps}${review}\n`;
      }
      text += "\n";

      text += `### Completed (${completed.length})\n`;
      for (const t of completed.slice(0, 10)) {
        text += `- ${t.id}: ${t.title ?? t.text.slice(0, 60)}\n`;
      }
      if (completed.length > 10) text += `  ... and ${completed.length - 10} more\n`;

      ctx.ui.notify(`Tasks: ${active.length} active, ${completed.length} done`, "info");
      return { content: [{ type: "text", text }] };
    },
  });

  pi.registerCommand("tasks-review", {
    description: "List tasks awaiting review. Usage: /tasks-review",
    handler: async (_args, ctx) => {
      const tasks = await store.search({ hasReview: true });
      if (tasks.length === 0) {
        ctx.ui.notify("No tasks awaiting review", "success");
        return { content: [{ type: "text", text: "No tasks awaiting review." }] };
      }
      const text = tasks.map(t => `- ${t.id}: ${t.title ?? t.text.slice(0, 60)} (${t.intent ?? "no intent"})`).join("\n");
      ctx.ui.notify(`${tasks.length} task(s) awaiting review`, "warning");
      return { content: [{ type: "text", text: `## Tasks Awaiting Review\n\n${text}` }] };
    },
  });

  pi.registerCommand("task", {
    description: "Quick task creation: /task <description>",
    handler: async (args, ctx) => {
      const text = args.join(" ");
      if (!text.trim()) {
        return { content: [{ type: "text", text: "Usage: /task <description>" }] };
      }
      const task: Task = {
        id: `task-${Date.now()}`,
        text: text.trim(),
        status: "pending",
        priority: "normal",
        source: "manual",
        createdAt: new Date().toISOString(),
        requiresReview: true,
        assignedToSession: getSessionId(),
      };
      await store.save(task);
      notify(`Task created: ${task.id}`, "success");
      return { content: [{ type: "text", text: `Created task ${task.id}: ${text.trim()}` }] };
    },
  });
}
