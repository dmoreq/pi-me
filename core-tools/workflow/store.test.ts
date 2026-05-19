import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WorkflowStore } from "./store.ts";

async function withStore<T>(fn: (store: WorkflowStore) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "workflow-store-"));
  const store = new WorkflowStore(dir);
  await store.init();
  try { return await fn(store); } finally { await rm(dir, { recursive: true, force: true }); }
}

describe("WorkflowStore", () => {
  it("saves and loads workflows", async () => {
    await withStore(async store => {
      const wf = { id: "w1", title: "Demo", status: "draft" as const, priority: "normal" as const, source: "manual" as const, steps: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await store.save(wf);
      const got = await store.get("w1");
      assert.equal(got?.title, "Demo");
    });
  });
});
