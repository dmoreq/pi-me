import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";

describe("subagent atomic-json", () => {
  it("writes atomic JSON synchronously", async () => {
    const { writeAtomicJson } = await import("../../shared/atomic-json.js");
    assert.equal(typeof writeAtomicJson, "function");
    const tmpFile = path.join(tmpdir(), `atomic-test-${Date.now()}.json`);
    try {
      writeAtomicJson(tmpFile, { hello: "world", num: 42 });
      const raw = fs.readFileSync(tmpFile, "utf-8");
      assert.ok(raw.includes("hello"));
      assert.ok(raw.includes("world"));
    } finally {
      try { fs.unlinkSync(tmpFile); } catch { /* cleanup */ }
    }
  });
});

describe("subagent file-coalescer", () => {
  it("creates a file coalescer with schedule/clear API", async () => {
    const { createFileCoalescer } = await import("../../shared/file-coalescer.js");
    let lastFile = "";
    const coalescer = createFileCoalescer((file) => { lastFile = file; }, 100);
    assert.equal(typeof coalescer.schedule, "function");
    assert.equal(typeof coalescer.clear, "function");
    // Schedule a write
    const tmpFile = path.join(tmpdir(), `coalescer-test-${Date.now()}.txt`);
    const scheduled = coalescer.schedule(tmpFile);
    assert.equal(scheduled, true);
    // Duplicate schedule is no-op
    assert.equal(coalescer.schedule(tmpFile), false);
    // Clear pending
    coalescer.clear();
  });
});

describe("subagent parallel-utils", () => {
  it("exports parallel utility functions", async () => {
    const utils = await import("../../runs/shared/parallel-utils.js");
    assert.ok(utils);
  });
});

describe("subagent completion-dedupe", () => {
  it("exports deduplication utilities", async () => {
    const dedupe = await import("../../runs/background/completion-dedupe.js");
    assert.ok(dedupe);
  });
});
