import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { TaskStore, acquireLock } from "./store.ts";
import type { Task } from "./types.ts";

const makeTask = (id: string): Task => ({
  id,
  text: "Task text",
  status: "pending",
  priority: "normal",
  source: "manual",
  createdAt: new Date().toISOString(),
  requiresReview: false,
});

describe("TaskStore locking", () => {
  it("acquires and releases locks", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "task-plan-lock-"));
    const release = await acquireLock(dir, "one");
    assert.ok(release);
    await release();
  });
});
