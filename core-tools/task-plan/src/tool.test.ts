import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { TaskStore } from "./store.ts";
import { TaskExecutor } from "./executor.ts";
import { createTaskPlanTool, TaskPlanParams } from "./tool.ts";
import type { Task } from "./types.ts";

const makeTempDir = async () => fs.mkdtemp(path.join(os.tmpdir(), "task-plan-tool-"));

const makeStore = async (dir: string) => {
  const store = new TaskStore({ dir, gcEnabled: false });
  await store.init();
  return store;
};

const makeTool = async (dir: string) => {
  const store = await makeStore(dir);
  const executor = new TaskExecutor(store, {
    safetyMode: false,
    dryRun: true,
    onExecute: async (task: Task) => ({ exitCode: 0, stdout: task.text }),
  });
  const notifications: Array<{ text: string; variant: string }> = [];
  const tracks: Array<{ event: string; data?: Record<string, unknown> }> = [];
  const tool = createTaskPlanTool({
    store,
    executor,
    getSessionId: () => "session-1",
    notify: (text, variant) => notifications.push({ text, variant }),
    track: (event, data) => tracks.push({ event, data }),
  });
  return { store, executor, tool, notifications, tracks };
};

describe("TaskPlanParams", () => {
  it("includes approve in the review schema", () => {
    assert.ok(TaskPlanParams.properties.approve);
  });
});

describe("createTaskPlanTool", () => {
  it("creates a task", async () => {
    const dir = await makeTempDir();
    const { tool, store, notifications, tracks } = await makeTool(path.join(dir, "a"));
    const result = await tool.execute("1", { action: "create", title: "Task A", text: "Do thing" }, null as any, null as any, null as any);
    const saved = await store.getAll();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].title, "Task A");
    assert.equal(saved[0].executor, "none");
    assert.equal(saved[0].requiresReview, true);
    assert.ok(notifications[0]?.text.includes("Created task"));
    assert.equal(tracks[0]?.event, "task_created");
    assert.ok(result.content[0].text.includes("Task A"));
  });

  it("creates a plan with steps and requires review", async () => {
    const dir = await makeTempDir();
    const { tool, store } = await makeTool(path.join(dir, "b"));
    await tool.execute("1", { action: "create", title: "Plan A", text: "Plan A", steps: ["one", "two"] }, null as any, null as any, null as any);
    const saved = await store.getAll();
    assert.equal(saved[0].steps?.length, 2);
    assert.equal(saved[0].requiresReview, true);
  });

  it("lists task summary counts", async () => {
    const dir = await makeTempDir();
    const { tool, store } = await makeTool(path.join(dir, "c"));
    await store.save({ id: "a", text: "A", status: "pending", priority: "normal", source: "manual", createdAt: new Date().toISOString(), requiresReview: false });
    const result = await tool.execute("1", { action: "list" }, null as any, null as any, null as any);
    assert.ok(result.content[0].text.includes('"pending": 1'));
  });

  it("adds and completes a step", async () => {
    const dir = await makeTempDir();
    const { tool, store } = await makeTool(path.join(dir, "d"));
    await store.save({ id: "plan-1", title: "Plan", text: "Plan", status: "pending", priority: "normal", source: "manual", createdAt: new Date().toISOString(), steps: [{ id: 1, text: "one", done: false }], requiresReview: true });
    await tool.execute("1", { action: "add-step", id: "plan-1", stepText: "two" }, null as any, null as any, null as any);
    await tool.execute("1", { action: "complete-step", id: "plan-1", stepId: 1 }, null as any, null as any, null as any);
    const updated = await store.get("plan-1");
    assert.equal(updated?.steps?.[0].done, true);
    assert.equal(updated?.steps?.[0].status, "done");
    assert.equal(updated?.steps?.length, 2);
  });

  it("tracks current and next steps for active plans", async () => {
    const dir = await makeTempDir();
    const { tool, store } = await makeTool(path.join(dir, "steps"));
    await store.save({ id: "plan-steps", title: "Plan", text: "Plan", status: "pending", priority: "normal", source: "manual", createdAt: new Date().toISOString(), steps: [{ id: 1, text: "one", done: false }, { id: 2, text: "two", done: false }], requiresReview: true });

    await tool.execute("1", { action: "execute", id: "plan-steps" }, null as any, null as any, null as any);
    assert.equal((await store.get("plan-steps"))?.currentStepId, 1);

    const current = await tool.execute("1", { action: "current-plan", id: "plan-steps" }, null as any, null as any, null as any);
    assert.ok(current.content[0].text.includes("Current step: 1"));

    await tool.execute("1", { action: "complete-step", id: "plan-steps", stepId: 1 }, null as any, null as any, null as any);
    const next = await tool.execute("1", { action: "next-step", id: "plan-steps" }, null as any, null as any, null as any);
    assert.ok(next.content[0].text.includes("2/2"));
    assert.equal((await store.get("plan-steps"))?.currentStepId, 2);
  });

  it("claims and releases a task", async () => {
    const dir = await makeTempDir();
    const { tool, store } = await makeTool(path.join(dir, "e"));
    await store.save({ id: "task-1", text: "T", status: "pending", priority: "normal", source: "manual", createdAt: new Date().toISOString(), requiresReview: false });
    await tool.execute("1", { action: "claim", id: "task-1" }, null as any, null as any, null as any);
    assert.equal((await store.get("task-1"))?.assignedToSession, "session-1");
    await tool.execute("1", { action: "release", id: "task-1" }, null as any, null as any, null as any);
    assert.equal((await store.get("task-1"))?.assignedToSession, undefined);
  });

  it("rejects execute when assigned to another session", async () => {
    const dir = await makeTempDir();
    const { tool, store } = await makeTool(path.join(dir, "f"));
    await store.save({ id: "task-2", text: "T", status: "pending", priority: "normal", source: "manual", createdAt: new Date().toISOString(), assignedToSession: "other", requiresReview: false });
    const result = await tool.execute("1", { action: "execute", id: "task-2" }, null as any, null as any, null as any);
    assert.ok(result.content[0].text.includes("assigned to session other"));
  });

  it("does not execute text-only tasks as shell commands", async () => {
    const dir = await makeTempDir();
    const { tool, store } = await makeTool(path.join(dir, "safe"));
    await store.save({ id: "task-safe", text: "Fix the API", status: "pending", priority: "normal", executor: "none", source: "manual", createdAt: new Date().toISOString(), requiresReview: false });
    const result = await tool.execute("1", { action: "execute", id: "task-safe" }, null as any, null as any, null as any);
    assert.ok(result.content[0].text.includes("not directly executable"));
  });

  it("executes only tasks with explicit shell commands", async () => {
    const dir = await makeTempDir();
    const { tool, store } = await makeTool(path.join(dir, "cmd"));
    await store.save({ id: "task-cmd", text: "Run tests", command: "npm test", executor: "shell", status: "pending", priority: "normal", source: "manual", createdAt: new Date().toISOString(), requiresReview: false });
    const result = await tool.execute("1", { action: "execute", id: "task-cmd" }, null as any, null as any, null as any);
    assert.ok(result.content[0].text.includes("Completed"));
  });

  it("approves a task for execution", async () => {
    const dir = await makeTempDir();
    const { tool, store } = await makeTool(path.join(dir, "g"));
    await store.save({ id: "task-3", text: "T", status: "pending", priority: "normal", source: "manual", createdAt: new Date().toISOString(), requiresReview: true });
    const result = await tool.execute("1", { action: "review", id: "task-3", approve: true }, null as any, null as any, null as any);
    assert.equal((await store.get("task-3"))?.requiresReview, false);
    assert.ok(result.content[0].text.includes("Approved"));
  });

  it("lists tasks awaiting review when review has no id", async () => {
    const dir = await makeTempDir();
    const { tool, store } = await makeTool(path.join(dir, "review-list"));
    await store.save({ id: "task-review", text: "Review me", status: "pending", priority: "normal", source: "auto", createdAt: new Date().toISOString(), requiresReview: true });
    const result = await tool.execute("1", { action: "review" }, null as any, null as any, null as any);
    assert.ok(result.content[0].text.includes("Review Queue"));
    assert.ok(result.content[0].text.includes("task-review"));
  });

  it("archives and rejects review tasks", async () => {
    const dir = await makeTempDir();
    const { tool, store } = await makeTool(path.join(dir, "review-actions"));
    await store.save({ id: "task-archive", text: "Archive me", status: "pending", priority: "normal", source: "auto", createdAt: new Date().toISOString(), requiresReview: true });
    await store.save({ id: "task-reject", text: "Reject me", status: "pending", priority: "normal", source: "auto", createdAt: new Date().toISOString(), requiresReview: true });

    await tool.execute("1", { action: "review", id: "task-archive", archive: true }, null as any, null as any, null as any);
    await tool.execute("1", { action: "review", id: "task-reject", reject: true }, null as any, null as any, null as any);

    assert.equal((await store.get("task-archive"))?.status, "archived");
    assert.equal(await store.get("task-reject"), undefined);
  });

  it("bulk archives old auto-captured review tasks", async () => {
    const dir = await makeTempDir();
    const { tool, store } = await makeTool(path.join(dir, "review-bulk"));
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    await store.save({ id: "task-old", text: "Old", status: "pending", priority: "normal", source: "auto", createdAt: oldDate, requiresReview: true });
    await store.save({ id: "task-new", text: "New", status: "pending", priority: "normal", source: "auto", createdAt: new Date().toISOString(), requiresReview: true });

    const result = await tool.execute("1", { action: "review", archive: true, bulk: true, source: "auto", olderThanDays: 7 }, null as any, null as any, null as any);

    assert.ok(result.content[0].text.includes("Archived 1"));
    assert.equal((await store.get("task-old"))?.status, "archived");
    assert.equal((await store.get("task-new"))?.status, "pending");
  });

  it("previews and applies duplicate review cleanup", async () => {
    const dir = await makeTempDir();
    const { tool, store } = await makeTool(path.join(dir, "dedupe"));
    await store.save({ id: "task-dupe-1", text: "Fix API bug!", status: "pending", priority: "normal", source: "auto", createdAt: new Date().toISOString(), requiresReview: true });
    await store.save({ id: "task-dupe-2", text: "fix api bug", status: "pending", priority: "normal", source: "auto", createdAt: new Date().toISOString(), requiresReview: true });

    const preview = await tool.execute("1", { action: "dedupe", preview: true }, null as any, null as any, null as any);
    assert.ok(preview.content[0].text.includes("preview"));
    assert.equal((await store.get("task-dupe-2"))?.status, "pending");

    const applied = await tool.execute("1", { action: "dedupe", preview: false }, null as any, null as any, null as any);
    assert.ok(applied.content[0].text.includes("Archived"));
    assert.equal((await store.get("task-dupe-2"))?.status, "archived");
  });

  it("searches by query text", async () => {
    const dir = await makeTempDir();
    const { tool, store } = await makeTool(path.join(dir, "h"));
    await store.save({ id: "task-4", text: "Search me", status: "pending", priority: "normal", source: "manual", createdAt: new Date().toISOString(), requiresReview: false });
    const result = await tool.execute("1", { action: "search", query: "Search" }, null as any, null as any, null as any);
    assert.ok(result.content[0].text.includes("Search me"));
  });
});
