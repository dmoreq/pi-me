import { describe, it, expect, beforeEach } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { TaskStore, acquireLock } from "./store.ts";
import type { Task } from "./types.ts";

const makeTask = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  text: "Task text",
  status: "pending",
  priority: "normal",
  source: "manual",
  createdAt: new Date().toISOString(),
  requiresReview: false,
  ...overrides,
});

describe("TaskStore", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "task-plan-store-"));
  });

  it("persists events across store instances", async () => {
    const store1 = new TaskStore({ dir: tmpDir, gcEnabled: false });
    await store1.init();
    await store1.appendEvent({ type: "created", taskId: "a", task: makeTask("a"), timestamp: new Date().toISOString() } as any);

    const store2 = new TaskStore({ dir: tmpDir, gcEnabled: false });
    await store2.init();
    const events = await store2.getEvents();

    assert.equal(events.length, 1);
  });

  it("ignores corrupt event log lines", async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(path.join(tmpDir, "events.jsonl"), "{bad json}\n", "utf8");

    const store = new TaskStore({ dir: tmpDir, gcEnabled: false });
    await store.init();
    const events = await store.getEvents();

    assert.equal(events.length, 0);
  });

  it("queries persisted events by task id", async () => {
    const store = new TaskStore({ dir: tmpDir, gcEnabled: false });
    await store.init();
    await store.appendEvent({ type: "created", taskId: "a", task: makeTask("a"), timestamp: new Date().toISOString() } as any);
    await store.appendEvent({ type: "updated", taskId: "b", task: makeTask("b"), timestamp: new Date().toISOString() } as any);

    const events = await store.getEvents("b");
    assert.equal(events.length, 1);
    assert.equal(events[0].taskId, "b");
  });
});
