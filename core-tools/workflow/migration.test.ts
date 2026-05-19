import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { migrateTaskPlanToWorkflow } from "./migration.ts";

describe("workflow migration", () => {
  it("returns a boolean", async () => {
    const ok = await migrateTaskPlanToWorkflow();
    assert.equal(typeof ok, "boolean");
  });
});
