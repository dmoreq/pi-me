/**
 * Unified Task/Plan Tool — the single tool + commands for all task & plan operations.
 *
 * Merges:
 * - legacy plan tool actions: list/get/create/update/add-step/complete-step/delete/claim/release/execute
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
import { acquireLock } from "./store.ts";

// ─── Tool Parameter Schema ──────────────────────────────────────────────────

const ActionEnum = [
  "list", "get", "create", "update", "delete",
  "add-step", "complete-step", "current-plan", "next-step", "skip-step",
  "claim", "release",
  "execute", "skip", "retry",
  "review", "dedupe", "search",
] as const;

export const TaskPlanParams = Type.Object({
  action: Type.String({
    enum: ActionEnum as unknown as [string, ...string[]],
    description: "Action to perform",
  }),
  id: Type.Optional(Type.String({ description: "Task/plan ID" })),
  title: Type.Optional(Type.String({ description: "Title (for create/update)" })),
  text: Type.Optional(Type.String({ description: "Task text (for create/update)" })),
  command: Type.Optional(Type.String({ description: "Explicit command to execute for shell/subprocess tasks" })),
  executor: Type.Optional(Type.String({ description: "Executor: none/shell/subprocess/pi" })),
  status: Type.Optional(Type.String({ description: "New status" })),
  steps: Type.Optional(Type.Array(Type.String(), { description: "Step texts (for create)" })),
  stepText: Type.Optional(Type.String({ description: "Step text (for add-step)" })),
  stepId: Type.Optional(Type.Number({ description: "Step ID (for complete-step)" })),
  intent: Type.Optional(Type.String({ description: "Task intent" })),
  priority: Type.Optional(Type.String({ description: "Priority: low/normal/high" })),
  tags: Type.Optional(Type.Array(Type.String())),
  force: Type.Optional(Type.Boolean({ description: "Override session assignment" })),
  approve: Type.Optional(Type.Boolean({ description: "Approve task/plan for execution" })),
  reject: Type.Optional(Type.Boolean({ description: "Reject and delete a task/plan from review" })),
  archive: Type.Optional(Type.Boolean({ description: "Archive a task/plan from review" })),
  bulk: Type.Optional(Type.Boolean({ description: "Apply review action to all matching tasks" })),
  preview: Type.Optional(Type.Boolean({ description: "Preview dedupe/cleanup without applying changes" })),
  olderThanDays: Type.Optional(Type.Number({ description: "Limit bulk review action to tasks older than N days" })),
  source: Type.Optional(Type.String({ description: "Source filter: auto/manual/migrated" })),
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
          case "create": return handleCreate(store, id, params, sessionId, notify, track);
          case "update": return handleUpdate(store, id, params, notify);
          case "delete": return handleDelete(store, id, notify);
          case "add-step": return handleAddStep(store, id, params);
          case "complete-step": return handleCompleteStep(store, id, params);
          case "current-plan": return handleCurrentPlan(store, id);
          case "next-step": return handleNextStep(store, id);
          case "skip-step": return handleSkipStep(store, id, params);
          case "claim": return handleClaim(store, id, sessionId);
          case "release": return handleRelease(store, id);
          case "execute": return handleExecute(store, executor, id, sessionId, params, notify, track);
          case "skip": return handleSkip(store, executor, id, notify);
          case "retry": return handleRetry(store, executor, id, notify);
          case "review": return handleReview(store, id, params, notify);
          case "dedupe": return handleDedupe(store, params, notify);
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
    active: tasks.filter(t => t.status === "active").length,
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
  track: (event: string, data?: Record<string, unknown>) => void,
) {
  const now = new Date().toISOString();
  const stepTexts = params.steps as string[] | undefined;
  const steps = stepTexts?.map((text, i) => ({ id: i + 1, text, done: false, status: "pending" as const }));

  const task: Task = {
    id: id ?? `task-${Date.now()}`,
    title: params.title as string | undefined,
    text: (params.text as string) ?? (params.title as string) ?? "",
    status: (params.status as TaskStatus) ?? "pending",
    intent: params.intent as Task["intent"],
    priority: (params.priority as Task["priority"]) ?? "normal",
    steps,
    executor: (params.executor as Task["executor"]) ?? "none",
    command: params.command as string | undefined,
    tags: params.tags as string[] | undefined,
    source: "manual",
    createdAt: now,
    assignedToSession: sessionId,
    requiresReview: true,
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
  const release = await acquireLock(store.getDir(), id ?? "", undefined).catch(() => null);
  try {
  if (!id) return { content: [{ type: "text" as const, text: "Error: id required" }] };
  const task = await store.get(id);
  if (!task) return { content: [{ type: "text" as const, text: `Task ${id} not found` }] };

  if (params.title !== undefined) task.title = params.title as string;
  if (params.text !== undefined) task.text = params.text as string;
  if (params.status !== undefined) task.status = params.status as TaskStatus;
  if (params.intent !== undefined) task.intent = params.intent as Task["intent"];
  if (params.priority !== undefined) task.priority = params.priority as Task["priority"];
  if (params.executor !== undefined) task.executor = params.executor as Task["executor"];
  if (params.command !== undefined) task.command = params.command as string;
  if (params.tags !== undefined) task.tags = params.tags as string[];

  await store.save(task);
  notify(`Updated: ${task.title ?? task.id}`, "info");
  return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
  } finally {
    await release?.();
  }
}

async function handleDelete(
  store: TaskStore,
  id: string | undefined,
  notify: (text: string, variant: "info" | "success" | "warning" | "error") => void,
) {
  const release = await acquireLock(store.getDir(), id ?? "", undefined).catch(() => null);
  try {
  if (!id) return { content: [{ type: "text" as const, text: "Error: id required" }] };
  await store.delete(id);
  notify(`Deleted: ${id}`, "info");
  return { content: [{ type: "text" as const, text: `Deleted ${id}` }] };
  } finally {
    await release?.();
  }
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
  task.steps.push({ id: task.steps.length + 1, text: stepText, done: false, status: "pending" });
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
  step.status = "done";
  step.completedAt = new Date().toISOString();

  const next = task.steps?.find(s => !s.done && s.status !== "skipped");
  task.currentStepId = next?.id;
  if (next && task.status === "active") {
    next.status = "active";
    next.startedAt = next.startedAt ?? new Date().toISOString();
  }

  // Auto-complete the task if all steps done
  if (task.steps?.every(s => s.done)) {
    task.status = "completed";
    task.currentStepId = undefined;
    task.completedAt = new Date().toISOString();
  }

  await store.save(task);
  return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
}

async function handleCurrentPlan(store: TaskStore, id: string | undefined) {
  const task = id ? await store.get(id) : (await store.getAll()).find(t => t.status === "active" && t.steps?.length);
  if (!task) return { content: [{ type: "text" as const, text: id ? `Task ${id} not found` : "No active plan." }] };
  if (!task.steps?.length) return { content: [{ type: "text" as const, text: `Task ${task.id} has no plan steps.` }] };
  const done = task.steps.filter(s => s.done).length;
  const current = task.steps.find(s => s.id === task.currentStepId) ?? task.steps.find(s => !s.done && s.status !== "skipped");
  const lines = [`## Current Plan: ${task.title ?? task.text}`, "", `Progress: ${done}/${task.steps.length} complete`, ""];
  if (current) {
    lines.push(`Current step: ${current.id}. ${current.text}`);
    lines.push(`Complete with: action=complete-step id=${task.id} stepId=${current.id}`);
  } else {
    lines.push("No remaining steps.");
  }
  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}

async function handleNextStep(store: TaskStore, id: string | undefined) {
  const task = id ? await store.get(id) : (await store.getAll()).find(t => t.status === "active" && t.steps?.length);
  if (!task) return { content: [{ type: "text" as const, text: id ? `Task ${id} not found` : "No active plan." }] };
  if (!task.steps?.length) return { content: [{ type: "text" as const, text: `Task ${task.id} has no plan steps.` }] };
  const next = task.steps.find(s => !s.done && s.status !== "skipped");
  if (!next) return { content: [{ type: "text" as const, text: `Plan ${task.id} has no remaining steps.` }] };
  for (const step of task.steps) if (step.status === "active" && step.id !== next.id) step.status = "pending";
  task.status = "active";
  task.currentStepId = next.id;
  next.status = "active";
  next.startedAt = next.startedAt ?? new Date().toISOString();
  await store.save(task);
  const done = task.steps.filter(s => s.done).length;
  return { content: [{ type: "text" as const, text: `Next step for ${task.title ?? task.id}:\n\n${next.id}/${task.steps.length} — ${next.text}\n\nProgress: ${done}/${task.steps.length} complete` }] };
}

async function handleSkipStep(store: TaskStore, id: string | undefined, params: Record<string, unknown>) {
  if (!id) return { content: [{ type: "text" as const, text: "Error: id required" }] };
  const task = await store.get(id);
  if (!task) return { content: [{ type: "text" as const, text: `Task ${id} not found` }] };
  const stepId = params.stepId as number | undefined;
  if (!stepId) return { content: [{ type: "text" as const, text: "Error: stepId required" }] };
  const step = task.steps?.find(s => s.id === stepId);
  if (!step) return { content: [{ type: "text" as const, text: `Step ${stepId} not found` }] };
  step.status = "skipped";
  step.done = true;
  step.completedAt = new Date().toISOString();
  task.currentStepId = task.steps?.find(s => !s.done && s.status !== "skipped")?.id;
  await store.save(task);
  return { content: [{ type: "text" as const, text: `Skipped step ${stepId} for ${id}` }] };
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

  // If the task has steps, activate the plan and return remaining work
  if (task.steps && task.steps.length > 0) {
    task.status = "active";
    const current = task.steps.find(s => !s.done && s.status !== "skipped");
    if (current) {
      task.currentStepId = current.id;
      current.status = "active";
      current.startedAt = current.startedAt ?? new Date().toISOString();
    }
    await store.save(task);
    const remaining = task.steps.filter(s => !s.done && s.status !== "skipped");
    if (remaining.length === 0) {
      return { content: [{ type: "text" as const, text: "Plan activated. All steps are already complete." }] };
    }
    return {
      content: [{
        type: "text" as const,
        text: `Plan activated: ${task.title ?? task.id}. Remaining steps:\n${remaining.map(s => `${s.id}. ${s.text}`).join("\n")}`,
      }],
    };
  }

  if (!isExecutableTask(task)) {
    return {
      content: [{
        type: "text" as const,
        text: `This task is not directly executable.\n\nTask:\n${task.title ?? task.text}\n\nReason:\nNo explicit shell command is attached.\n\nSuggested:\nAsk the agent to work on it, or attach a command with action=update, executor=shell, command=\"...\".`,
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
  if (!isExecutableTask(task)) {
    return {
      content: [{
        type: "text" as const,
        text: `This task is not directly executable. Attach executor=shell and command=\"...\" before retrying.`,
      }],
    };
  }
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
  const approve = params.approve as boolean | undefined;
  const reject = params.reject as boolean | undefined;
  const archive = params.archive as boolean | undefined;
  const bulk = params.bulk as boolean | undefined;

  if (!id && bulk === true && (approve || reject || archive)) {
    const matches = filterReviewTasks(await store.getAll(), params);
    for (const task of matches) {
      if (approve) {
        task.requiresReview = false;
        await store.save(task);
      } else if (archive) {
        task.status = "archived";
        task.requiresReview = false;
        task.completedAt = new Date().toISOString();
        await store.save(task);
      } else if (reject) {
        await store.delete(task.id);
      }
    }
    const verb = approve ? "Approved" : archive ? "Archived" : "Rejected";
    notify(`${verb} ${matches.length} task(s)`, matches.length > 0 ? "success" : "info");
    return { content: [{ type: "text" as const, text: `${verb} ${matches.length} matching review task(s).` }] };
  }

  if (!id) {
    const queue = filterReviewTasks(await store.getAll(), params);
    return { content: [{ type: "text" as const, text: formatReviewQueue(queue) }] };
  }

  const task = await store.get(id);
  if (!task) return { content: [{ type: "text" as const, text: `Task ${id} not found` }] };

  if (approve === true) {
    task.requiresReview = false;
    await store.save(task);
    notify(`✅ Approved: ${task.title ?? task.id}`, "success");
    return { content: [{ type: "text" as const, text: `✅ Approved ${id}: ${task.title ?? task.text}` }] };
  }

  if (archive === true) {
    task.status = "archived";
    task.requiresReview = false;
    task.completedAt = new Date().toISOString();
    await store.save(task);
    notify(`🗄️ Archived: ${task.title ?? task.id}`, "info");
    return { content: [{ type: "text" as const, text: `🗄️ Archived ${id}: ${task.title ?? task.text}` }] };
  }

  if (reject === true) {
    await store.delete(id);
    notify(`Rejected: ${task.title ?? task.id}`, "info");
    return { content: [{ type: "text" as const, text: `Rejected and deleted ${id}: ${task.title ?? task.text}` }] };
  }

  // Just show review status
  return {
    content: [{
      type: "text" as const,
      text: task.requiresReview
        ? `Task ${id} requires review. Use approve=true to approve, archive=true to archive, or reject=true to delete.`
        : `Task ${id} is already approved.`,
    }],
  };
}

function filterReviewTasks(tasks: Task[], params: Record<string, unknown>): Task[] {
  const source = params.source as Task["source"] | undefined;
  const olderThanDays = params.olderThanDays as number | undefined;
  const query = (params.query as string | undefined)?.toLowerCase();
  const cutoff = typeof olderThanDays === "number"
    ? Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    : undefined;

  return tasks.filter(task => {
    if (!task.requiresReview) return false;
    if (task.status === "archived") return false;
    if (source && task.source !== source) return false;
    if (cutoff !== undefined) {
      const created = Date.parse(task.createdAt);
      if (!Number.isFinite(created) || created >= cutoff) return false;
    }
    if (query) {
      const haystack = `${task.id} ${task.title ?? ""} ${task.text} ${(task.tags ?? []).join(" ")}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function formatReviewQueue(tasks: Task[]): string {
  if (tasks.length === 0) return "No tasks awaiting review.";
  const lines = [`## Review Queue`, "", `${tasks.length} task(s) awaiting review.`, ""];
  for (const task of tasks.slice(0, 20)) {
    const label = task.title ?? task.text.slice(0, 80);
    const steps = task.steps ? ` — ${task.steps.filter(s => s.done).length}/${task.steps.length} steps` : "";
    lines.push(`- ${task.id}: ${label}${steps}`);
    lines.push(`  Source: ${task.source ?? "unknown"}; Intent: ${task.intent ?? "unknown"}; Status: ${task.status}`);
    lines.push(`  Actions: approve=true | archive=true | reject=true`);
  }
  if (tasks.length > 20) lines.push(`- ... and ${tasks.length - 20} more`);
  lines.push("", "Bulk cleanup example: action=review archive=true bulk=true source=auto olderThanDays=7");
  return lines.join("\n");
}

function normalizeTaskText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function handleDedupe(
  store: TaskStore,
  params: Record<string, unknown>,
  notify: (text: string, variant: "info" | "success" | "warning" | "error") => void,
) {
  const preview = params.preview !== false;
  const tasks = (await store.getAll()).filter(t => t.requiresReview && t.status !== "archived");
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = normalizeTaskText(task.title ?? task.text);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(task);
  }

  const duplicateGroups = Array.from(groups.values()).filter(group => group.length > 1);
  const duplicates = duplicateGroups.flatMap(group => group.slice(1));

  if (!preview) {
    for (const task of duplicates) {
      task.status = "archived";
      task.requiresReview = false;
      task.completedAt = new Date().toISOString();
      await store.save(task);
    }
    notify(`Archived ${duplicates.length} duplicate task(s)`, duplicates.length > 0 ? "success" : "info");
  }

  const lines = [
    preview ? "## Duplicate Review Tasks (preview)" : "## Duplicate Review Tasks Archived",
    "",
    `${duplicateGroups.length} duplicate group(s), ${duplicates.length} duplicate task(s).`,
  ];
  for (const group of duplicateGroups.slice(0, 20)) {
    const [keep, ...dupes] = group;
    lines.push("", `Keep: ${keep.id}: ${keep.title ?? keep.text}`);
    for (const duplicate of dupes) lines.push(`Archive: ${duplicate.id}: ${duplicate.title ?? duplicate.text}`);
  }
  if (duplicateGroups.length > 20) lines.push("", `... and ${duplicateGroups.length - 20} more group(s)`);
  if (preview) lines.push("", "Apply with: action=dedupe preview=false");
  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}

function isExecutableTask(task: Task): boolean {
  return task.executor === "shell" && Boolean(task.command?.trim());
}

async function handleSearch(store: TaskStore, params: Record<string, unknown>) {
  const query: SearchQuery = {
    text: params.query as string | undefined,
    status: params.status as TaskStatus | undefined,
    intent: params.intent as Task["intent"],
    priority: params.priority as Task["priority"],
    tags: params.tags as string[] | undefined,
    source: params.source as SearchQuery["source"],
    assignedToSession: params.assignedToSession as string | undefined,
    hasReview: params.hasReview as boolean | undefined,
  };

  if (!Object.values(query).some(v => v !== undefined)) {
    const tasks = await store.getAll();
    return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
  }

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
      const activePlans = tasks.filter(t => t.status === "active" && t.steps?.length);
      const active = tasks.filter(t => ["pending", "active", "in_progress"].includes(t.status));
      const completed = tasks.filter(t => t.status === "completed");
      const needsReview = tasks.filter(t => t.requiresReview && t.status !== "archived");

      let text = "## Tasks\n\n";
      text += `Active plans: ${activePlans.length}\n`;
      text += `Review queue: ${needsReview.length}\n`;
      text += `Pending/active tasks: ${active.length}\n`;
      text += `Completed: ${completed.length}\n\n`;

      if (activePlans.length > 0) {
        text += "### Active Plans\n";
        for (const t of activePlans.slice(0, 5)) {
          const current = t.steps?.find(s => s.id === t.currentStepId);
          const steps = `${t.steps!.filter(s => s.done).length}/${t.steps!.length}`;
          text += `- ${t.id}: ${t.title ?? t.text.slice(0, 60)} — ${steps}${current ? `; current: ${current.id}. ${current.text}` : ""}\n`;
        }
        text += "\n";
      }

      if (needsReview.length > 0) {
        text += `### ⚠️ Needs Review (${needsReview.length})\n`;
        for (const t of needsReview.slice(0, 10)) {
          text += `- ${t.id}: ${t.title ?? t.text.slice(0, 60)} (${t.source ?? "unknown"})\n`;
        }
        if (needsReview.length > 10) text += `- ... and ${needsReview.length - 10} more\n`;
        text += "\nCommands: /tasks-review, /plan current, /plan capture explicit\n";
      }

      ctx.ui.notify(`Tasks: ${active.length} active, ${needsReview.length} review`, "info");
      return { content: [{ type: "text", text }] };
    },
  });

  pi.registerCommand("tasks-review", {
    description: "List tasks awaiting review. Usage: /tasks-review",
    handler: async (_args, ctx) => {
      const tasks = (await store.search({ hasReview: true })).filter(t => t.status !== "archived");
      if (tasks.length === 0) {
        ctx.ui.notify("No tasks awaiting review", "success");
        return { content: [{ type: "text", text: "No tasks awaiting review." }] };
      }
      const likelyNonTasks = tasks.filter(t => /^(help me |what is|how does|explain|tell me)/i.test(t.text));
      const likelyTasks = tasks.filter(t => !likelyNonTasks.includes(t));
      let text = "## Review Queue\n\n";
      if (likelyTasks.length > 0) {
        text += "### Likely tasks\n";
        text += likelyTasks.map(t => `- ${t.id}: ${t.title ?? t.text.slice(0, 60)} (${t.intent ?? "no intent"})`).join("\n") + "\n\n";
      }
      if (likelyNonTasks.length > 0) {
        text += "### Likely non-tasks\n";
        text += likelyNonTasks.map(t => `- ${t.id}: ${t.title ?? t.text.slice(0, 60)} — recommended archive`).join("\n") + "\n\n";
      }
      text += "Suggested cleanup: task action=review archive=true bulk=true source=auto olderThanDays=7";
      ctx.ui.notify(`${tasks.length} task(s) awaiting review`, "warning");
      return { content: [{ type: "text", text }] };
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
        executor: "none",
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
