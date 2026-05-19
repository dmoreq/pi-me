/**
 * workflow — checklist UI helpers.
 */

import type { Workflow, WorkflowStep } from "./types.ts";

function icon(step: WorkflowStep): string {
  switch (step.status) {
    case "completed": return "✅";
    case "in_progress": return "🔄";
    case "failed": return "❌";
    case "skipped": return "⏭️";
    case "blocked": return "🚧";
    default: return "⏳";
  }
}

export function shouldShowChecklist(workflow?: Workflow | null): boolean {
  if (!workflow) return false;
  if (["completed", "archived", "cancelled"].includes(workflow.status)) return false;
  return workflow.steps.some(step => ["pending", "in_progress", "failed", "blocked"].includes(step.status)) || Boolean(workflow.requiresReview);
}

export function renderChecklist(workflow: Workflow): string {
  const total = workflow.steps.length;
  const done = workflow.steps.filter(step => step.status === "completed" || step.status === "skipped").length;
  const lines = [`📋 Workflow: ${workflow.title}`, `Progress: ${done}/${total}`, ""];
  for (const step of workflow.steps) {
    lines.push(`${icon(step)} ${step.id}. ${step.text}`);
  }
  return lines.join("\n");
}

export function renderCompactStatus(workflow: Workflow): string {
  const total = workflow.steps.length;
  const done = workflow.steps.filter(step => step.status === "completed" || step.status === "skipped").length;
  const current = workflow.steps.find(step => step.status === "in_progress") ?? workflow.steps.find(step => step.status === "pending");
  return current ? `📋 ${done}/${total} — ${current.text}` : `📋 ${done}/${total}`;
}

export function renderWorkflowSummary(workflows: Workflow[]): string {
  const active = workflows.filter(shouldShowChecklist);
  if (active.length === 0) return "No active workflows.";
  return active.map(renderChecklist).join("\n\n");
}
