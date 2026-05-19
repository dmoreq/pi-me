/**
 * workflow — legacy migration.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Workflow } from "./types.ts";

const OLD_DIR = ".pi/tasks";
const NEW_DIR = ".pi/workflows";
const MARKER = "migration.json";

export async function migrateTaskPlanToWorkflow(): Promise<boolean> {
  if (!existsSync(OLD_DIR)) return false;
  await mkdir(NEW_DIR, { recursive: true });
  if (existsSync(join(NEW_DIR, MARKER))) return false;

  const tasks: any[] = [];
  const entries = await readdir(OLD_DIR).catch(() => [] as string[]);
  for (const file of entries) {
    if (!file.endsWith(".json") || file === "events.json") continue;
    try {
      const raw = await readFile(join(OLD_DIR, file), "utf8");
      tasks.push(JSON.parse(raw));
    } catch {}
  }

  const workflows: Workflow[] = tasks.map(task => ({
    id: task.id,
    title: task.title ?? task.text,
    description: task.text,
    status: mapStatus(task.status),
    priority: task.priority,
    source: task.source ?? "migrated",
    requiresReview: task.requiresReview,
    assignedToSession: task.assignedToSession,
    intent: task.intent,
    steps: (task.steps?.length ? task.steps : [{ id: 1, text: task.text, done: false, status: "pending" }]).map((step: any) => ({
      id: String(step.id),
      text: step.text,
      status: step.done ? "completed" : step.status === "failed" ? "failed" : step.status === "skipped" ? "skipped" : "pending",
      executor: "manual",
      startedAt: step.startedAt,
      completedAt: step.completedAt,
    })),
    currentStepId: task.currentStepId !== undefined ? String(task.currentStepId) : undefined,
    createdAt: task.createdAt,
    updatedAt: task.startedAt ?? task.createdAt,
    completedAt: task.completedAt,
  }));

  await writeFile(join(NEW_DIR, "workflows.jsonl"), workflows.map(w => JSON.stringify(w)).join("\n") + (workflows.length ? "\n" : ""));
  await writeFile(join(NEW_DIR, MARKER), JSON.stringify({ migratedAt: new Date().toISOString(), count: workflows.length }, null, 2));
  return true;
}

function mapStatus(status: string): Workflow["status"] {
  if (status === "in_progress" || status === "active") return "active";
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  if (status === "archived") return "archived";
  return "draft";
}
