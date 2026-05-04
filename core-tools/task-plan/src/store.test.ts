/**
 * TaskStore — unit tests
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { TaskStore, acquireLock } from "./store.ts";
import type { Task } from "./types.ts";

function makeTask(id: string, overrides?: Partial<Task>): Task {
  return {
    id,
    text: `Task ${id}`,
    status: "pending",
    priority: "normal",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("TaskStore", () => {
  let tmpDir: string;
  let store: TaskStore;

  before(async () => {
    tmpDir = path.join(os.tmpdir(), `task-store-test-${Date.now()}`);
    store = new TaskStore({ dir: tmpDir, gcEnabled: false });
    await store.init();
  });

  after(async () => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("should save and get a task", async () => {
    const task = makeTask("t1");
    await store.save(task);
    const got = await store.get("t1");
    assert.ok(got);
    assert.strictEqual(got?.id, "t1");
    assert.strictEqual(got?.text, "Task t1");
  });

  it("should return undefined for nonexistent task", async () => {
    const got = await store.get("nonexistent");
    assert.strictEqual(got, undefined);
  });

  it("should get all tasks", async () => {
    const tasks = await store.getAll();
    assert.ok(tasks.length >= 1);
  });

  it("should delete a task", async () => {
    const task = makeTask("t-delete");
    await store.save(task);
    assert.ok(await store.get("t-delete"));
    await store.delete("t-delete");
    assert.strictEqual(await store.get("t-delete"), undefined);
  });

  it("should count tasks", async () => {
    const total = await store.count();
    assert.ok(total >= 1);
  });

  it("should count by status", async () => {
    const task = makeTask("t-status", { status: "completed" });
    await store.save(task);
    const completed = await store.count("completed");
    assert.ok(completed >= 1);
  });

  it("should query by text search", async () => {
    const results = await store.search({ text: "Task t1" });
    assert.ok(results.some(t => t.id === "t1"));
  });

  it("should query by status", async () => {
    const results = await store.search({ status: "completed" });
    assert.ok(results.some(t => t.id === "t-status"));
  });

  it("should query by intent", async () => {
    const task = makeTask("t-intent", { intent: "fix" });
    await store.save(task);
    const results = await store.search({ intent: "fix" });
    assert.ok(results.some(t => t.id === "t-intent"));
  });

  it("should query by priority", async () => {
    const task = makeTask("t-pri", { priority: "high" });
    await store.save(task);
    const results = await store.search({ priority: "high" });
    assert.ok(results.some(t => t.id === "t-pri"));
  });

  it("should query by requiresReview flag", async () => {
    const results = await store.search({ hasReview: true });
    assert.ok(results.length === 0 || results.every(t => t.requiresReview));
  });

  it("should append and get events", async () => {
    const task = makeTask("t-event");
    await store.save(task);
    await store.appendEvent({
      type: "created",
      taskId: "t-event",
      task,
      timestamp: new Date().toISOString(),
    });
    const events = await store.getEvents("t-event");
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].type, "created");
  });

  it("should persist across store instances", async () => {
    const store2 = new TaskStore({ dir: tmpDir, gcEnabled: false });
    await store2.init();
    const t = await store2.get("t1");
    assert.ok(t);
    assert.strictEqual(t?.id, "t1");
  });

  it("should clear all tasks", async () => {
    const store3 = new TaskStore({ dir: path.join(os.tmpdir(), `task-clear-${Date.now()}`), gcEnabled: false });
    await store3.init();
    await store3.save(makeTask("clear1"));
    await store3.save(makeTask("clear2"));
    assert.strictEqual(await store3.count(), 2);
    await store3.clear();
    assert.strictEqual(await store3.count(), 0);
  });

  it("should garbage collect old completed tasks", async () => {
    const gcDir = path.join(os.tmpdir(), `task-gc-${Date.now()}`);
    const gcStore = new TaskStore({ dir: gcDir, gcEnabled: false });
    await gcStore.init();

    const oldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    await gcStore.save(makeTask("old-done", { status: "completed", createdAt: oldDate }));
    await gcStore.save(makeTask("recent-done", { status: "completed", createdAt: new Date().toISOString() }));
    await gcStore.save(makeTask("still-pending", { createdAt: oldDate }));

    // GC with 30-day cutoff
    const gcStore2 = new TaskStore({ dir: gcDir, gcEnabled: true, gcDays: 30 });
    await gcStore2.init();

    assert.strictEqual(await gcStore2.get("old-done"), undefined);
    assert.ok(await gcStore2.get("recent-done"));
    assert.ok(await gcStore2.get("still-pending"));
  });
});

describe("acquireLock", () => {
  let tmpDir: string;

  before(async () => {
    tmpDir = path.join(os.tmpdir(), `lock-test-${Date.now()}`);
    await fs.promises.mkdir(tmpDir, { recursive: true });
  });

  after(async () => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("should acquire and release lock", async () => {
    const release = await acquireLock(tmpDir, "test-task");
    assert.strictEqual(typeof release, "function");
    await release();
  });

  it("should reject concurrent lock", async () => {
    const release = await acquireLock(tmpDir, "concurrent");
    assert.ok(release);
    await assert.rejects(() => acquireLock(tmpDir, "concurrent"), /locked/);
    await release();
  });

  it("should allow lock after release", async () => {
    const release = await acquireLock(tmpDir, "retry-lock");
    await release();
    const release2 = await acquireLock(tmpDir, "retry-lock");
    assert.ok(release2);
    await release2();
  });
});
