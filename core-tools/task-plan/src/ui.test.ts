import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import type { Task } from "./types.ts";

function formatStatus(tasks: Task[]): string | undefined {
  const active = tasks.filter(t => t.status === "active" && t.steps?.length);
  if (active.length === 0) return undefined;
  const plan = active[0];
  const done = plan.steps!.filter(s => s.done).length;
  const total = plan.steps!.length;
  return `📋 ${done}/${total}`;
}

describe("task-plan ui helpers", () => {
  it("formats active plan progress", () => {
    const tasks: Task[] = [{
      id: "p",
      text: "P",
      status: "active",
      priority: "normal",
      source: "manual",
      createdAt: new Date().toISOString(),
      requiresReview: false,
      steps: [{ id: 1, text: "one", done: true }, { id: 2, text: "two", done: false }],
    }];
    assert.equal(formatStatus(tasks), "📋 1/2");
  });
});
