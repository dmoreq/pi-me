import type { Task } from "./types.ts";

export function formatActivePlanStatus(tasks: Task[]): string | undefined {
  const active = tasks.filter(t => t.status === "active" && t.steps?.length);
  if (active.length === 0) return undefined;
  const plan = active[0];
  const done = plan.steps!.filter(s => s.done).length;
  const total = plan.steps!.length;
  return `📋 ${done}/${total}`;
}
