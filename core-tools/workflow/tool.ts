/**
 * workflow — tool actions.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { WorkflowStore } from "./store.ts";
import { WorkflowExecutor } from "./executor.ts";
import { WorkflowRunner } from "./runner.ts";
import { renderChecklist, renderWorkflowSummary, shouldShowChecklist } from "./ui.ts";
import type { Workflow, WorkflowStep } from "./types.ts";

export const WorkflowParams = Type.Object({
  action: Type.String(),
  id: Type.Optional(Type.String()),
  title: Type.Optional(Type.String()),
  text: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  priority: Type.Optional(Type.String()),
  source: Type.Optional(Type.String()),
  requiresReview: Type.Optional(Type.Boolean()),
  assignedToSession: Type.Optional(Type.String()),
  intent: Type.Optional(Type.String()),
  stepId: Type.Optional(Type.String()),
  stepText: Type.Optional(Type.String()),
  executor: Type.Optional(Type.String()),
  command: Type.Optional(Type.String()),
  args: Type.Optional(Type.Array(Type.String())),
  cwd: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Number()),
  critical: Type.Optional(Type.Boolean()),
  label: Type.Optional(Type.String()),
  notifyOnComplete: Type.Optional(Type.Boolean()),
  query: Type.Optional(Type.String()),
});

export interface WorkflowToolDeps {
  store: WorkflowStore;
  executor: WorkflowExecutor;
  runner: WorkflowRunner;
  getSessionId: () => string;
  notify: (text: string, variant: "info" | "success" | "warning" | "error") => void;
  track: (event: string, data?: Record<string, unknown>) => void;
  getActiveWorkflow: () => Promise<Workflow | null>;
}

export function createWorkflowTool(deps: WorkflowToolDeps) {
  const { store, runner, getSessionId, notify } = deps;

  return {
    name: "workflow",
    label: "Workflow Manager",
    description: "Manage workflows, checklists, execution, and background jobs.",
    parameters: WorkflowParams,
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      const action = params.action as string;
      const sessionId = getSessionId();

      switch (action) {
        case "list": {
          const workflows = await store.list();
          return text(renderWorkflowSummary(workflows));
        }
        case "get": {
          const workflow = await store.get(params.id as string);
          return workflow ? text(renderChecklist(workflow), { workflow }) : text(`Workflow ${params.id} not found`);
        }
        case "create": {
          const workflow = await createWorkflow(store, params, sessionId);
          notify(`Created workflow: ${workflow.title}`, "success");
          return text(renderChecklist(workflow), { workflow });
        }
        case "update": {
          const workflow = await updateWorkflow(store, params);
          return text(renderChecklist(workflow), { workflow });
        }
        case "delete": {
          const ok = await store.delete(params.id as string);
          return text(ok ? `Deleted ${params.id}` : `Workflow ${params.id} not found`);
        }
        case "activate":
        case "pause":
        case "resume":
        case "archive": {
          const workflow = await setStatus(store, params.id as string, action === "activate" ? "active" : action === "pause" ? "paused" : action === "resume" ? "active" : "archived");
          return text(renderChecklist(workflow), { workflow });
        }
        case "add-step": {
          const workflow = await addStep(store, params);
          return text(renderChecklist(workflow), { workflow });
        }
        case "update-step": {
          const workflow = await updateStep(store, params);
          return text(renderChecklist(workflow), { workflow });
        }
        case "complete-step": {
          const workflow = await runner.completeStep(params.id as string, params.stepId as string);
          return text(renderChecklist(workflow), { workflow });
        }
        case "skip-step": {
          const workflow = await runner.skipStep(params.id as string, params.stepId as string);
          return text(renderChecklist(workflow), { workflow });
        }
        case "next-step": {
          const workflow = await store.get(params.id as string);
          const next = workflow?.steps.find(s => s.status === "pending");
          return text(next ? `${next.id}. ${next.text}` : "No next step.");
        }
        case "run-step": {
          const workflow = await runner.runStep(params.id as string, params.stepId as string);
          return text(renderChecklist(workflow), { workflow });
        }
        case "run": {
          const workflow = await runner.runWorkflow(params.id as string);
          return text(renderChecklist(workflow), { workflow });
        }
        case "run-command": {
          const workflow = await runCommandAsWorkflow(store, deps, params, sessionId);
          return text(renderChecklist(workflow), { workflow });
        }
        case "run-bg": {
          const workflow = await runBackgroundAsWorkflow(store, deps, params, sessionId);
          return text(renderChecklist(workflow), { workflow });
        }
        case "job-list": {
          const jobs = await deps.executor.listJobs();
          return text(jobs.map(job => `${job.status} ${job.id} ${job.label}`).join("\n"));
        }
        case "job-status": {
          const job = deps.executor.getJob(params.id as string);
          return text(job ? `${job.status} ${job.id} ${job.label}` : `Job ${params.id} not found`);
        }
        case "job-cancel": {
          const ok = deps.executor.cancelJob(params.id as string);
          return text(ok ? `Cancelled ${params.id}` : `Job ${params.id} not found`);
        }
        case "review": {
          const workflows = await store.search({ requiresReview: true });
          return text(renderWorkflowSummary(workflows));
        }
        case "search": {
          const workflows = await store.search({ text: params.query as string | undefined });
          return text(renderWorkflowSummary(workflows));
        }
        case "dedupe": {
          const workflows = await store.list();
          const seen = new Set<string>();
          let removed = 0;
          for (const workflow of workflows) {
            const key = `${workflow.title}::${workflow.description ?? ""}`.toLowerCase().trim();
            if (!key) continue;
            if (seen.has(key)) {
              await store.delete(workflow.id);
              removed++;
            } else {
              seen.add(key);
            }
          }
          return text(`Removed ${removed} duplicate workflow(s).`);
        }
        default:
          return text(`Unknown action: ${action}`);
      }
    },
  };
}

function text(text: string, details?: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], details };
}

async function createWorkflow(store: WorkflowStore, params: Record<string, unknown>, sessionId: string): Promise<Workflow> {
  const now = new Date().toISOString();
  const workflow: Workflow = {
    id: (params.id as string) ?? `workflow-${Date.now()}`,
    title: (params.title as string) ?? (params.text as string) ?? "Untitled workflow",
    description: params.text as string | undefined,
    status: (params.status as Workflow["status"]) ?? "draft",
    priority: (params.priority as Workflow["priority"]) ?? "normal",
    source: (params.source as Workflow["source"]) ?? "manual",
    requiresReview: params.requiresReview as boolean | undefined,
    assignedToSession: (params.assignedToSession as string) ?? sessionId,
    intent: params.intent as string | undefined,
    steps: [],
    createdAt: now,
    updatedAt: now,
  };
  await store.save(workflow);
  return workflow;
}

async function updateWorkflow(store: WorkflowStore, params: Record<string, unknown>): Promise<Workflow> {
  const workflow = await store.get(params.id as string);
  if (!workflow) throw new Error(`Workflow ${params.id} not found`);
  if (params.title !== undefined) workflow.title = params.title as string;
  if (params.text !== undefined) workflow.description = params.text as string;
  if (params.status !== undefined) workflow.status = params.status as Workflow["status"];
  if (params.priority !== undefined) workflow.priority = params.priority as Workflow["priority"];
  if (params.requiresReview !== undefined) workflow.requiresReview = params.requiresReview as boolean;
  if (params.assignedToSession !== undefined) workflow.assignedToSession = params.assignedToSession as string;
  if (params.intent !== undefined) workflow.intent = params.intent as string;
  workflow.updatedAt = new Date().toISOString();
  await store.save(workflow);
  return workflow;
}

async function setStatus(store: WorkflowStore, id: string, status: Workflow["status"]): Promise<Workflow> {
  const workflow = await store.get(id);
  if (!workflow) throw new Error(`Workflow ${id} not found`);
  workflow.status = status;
  workflow.updatedAt = new Date().toISOString();
  await store.save(workflow);
  return workflow;
}

async function addStep(store: WorkflowStore, params: Record<string, unknown>): Promise<Workflow> {
  const step: WorkflowStep = {
    id: (params.stepId as string) ?? `${Date.now()}`,
    text: (params.stepText as string) ?? "Untitled step",
    status: "pending",
    executor: (params.executor as WorkflowStep["executor"]) ?? "manual",
    command: params.command as string | undefined,
    args: params.args as string[] | undefined,
    cwd: params.cwd as string | undefined,
    timeout: params.timeout as number | undefined,
    critical: params.critical as boolean | undefined,
  };
  return store.addStep(params.id as string, step);
}

async function updateStep(store: WorkflowStore, params: Record<string, unknown>): Promise<Workflow> {
  return store.updateStep(params.id as string, params.stepId as string, {
    text: params.stepText as string | undefined,
    executor: params.executor as WorkflowStep["executor"] | undefined,
    command: params.command as string | undefined,
    args: params.args as string[] | undefined,
    cwd: params.cwd as string | undefined,
    timeout: params.timeout as number | undefined,
    critical: params.critical as boolean | undefined,
  });
}

async function runCommandAsWorkflow(store: WorkflowStore, deps: WorkflowToolDeps, params: Record<string, unknown>, sessionId: string): Promise<Workflow> {
  const workflow = await createWorkflow(store, { ...params, title: params.label ?? params.command ?? "Command run", text: params.command as string, status: "active" }, sessionId);
  const step: WorkflowStep = {
    id: "1",
    text: String(params.label ?? params.command ?? "command"),
    status: "pending",
    executor: "shell",
    command: params.command as string,
    args: params.args as string[] | undefined,
    cwd: params.cwd as string | undefined,
    timeout: params.timeout as number | undefined,
    critical: params.critical as boolean | undefined,
  };
  await store.addStep(workflow.id, step);
  return deps.runner.runWorkflow(workflow.id);
}

async function runBackgroundAsWorkflow(store: WorkflowStore, deps: WorkflowToolDeps, params: Record<string, unknown>, sessionId: string): Promise<Workflow> {
  const workflow = await createWorkflow(store, { ...params, title: params.label ?? params.command ?? "Background run", text: params.command as string, status: "active" }, sessionId);
  const step: WorkflowStep = {
    id: "1",
    text: String(params.label ?? params.command ?? "command"),
    status: "pending",
    executor: "shell",
    command: params.command as string,
    args: params.args as string[] | undefined,
    cwd: params.cwd as string | undefined,
    timeout: params.timeout as number | undefined,
    critical: params.critical as boolean | undefined,
  };
  await store.addStep(workflow.id, step);
  const job = await deps.executor.runBackground({ id: workflow.id, label: step.text, cmd: step.command ?? "", args: step.args, cwd: step.cwd, timeout: step.timeout });
  await store.saveJob(job);
  return workflow;
}
