import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WorkflowExecutor } from "./executor.ts";

describe("WorkflowExecutor", () => {
  it("runs a command", async () => {
    const ex = new WorkflowExecutor();
    const result = await ex.runCommand({ id: "1", label: "echo", cmd: "node", args: ["-e", "console.log('ok')"] });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout.trim(), "ok");
  });
});
