import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { readExtStateSync, writeExtStateSync, getExtStatePath, ensureExtStateDir } from "./ext-state.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const testName = "__pi-me-test__";

// Clean up after all tests
process.on("beforeExit", () => {
  try { fs.unlinkSync(getExtStatePath(testName)); } catch { /* ok */ }
});

describe("ext-state", () => {
  it("returns null for missing state", () => {
    const result = readExtStateSync("__nonexistent__");
    assert.equal(result, null);
  });

  it("round-trips state to disk", () => {
    const state = { counter: 42, labels: ["a", "b"] };
    writeExtStateSync(testName, state);

    const loaded = readExtStateSync<typeof state>(testName);
    assert.notEqual(loaded, null);
    assert.equal(loaded!.counter, 42);
    assert.deepEqual(loaded!.labels, ["a", "b"]);
  });

  it("overwrites existing state", () => {
    writeExtStateSync(testName, { version: 1 });
    writeExtStateSync(testName, { version: 2 });
    const loaded = readExtStateSync<{ version: number }>(testName);
    assert.equal(loaded!.version, 2);
  });

  it("getExtStatePath returns consistent path", () => {
    const extDir = path.join(os.homedir(), ".pi", "ext-state");
    assert.equal(getExtStatePath("test-ext"), path.join(extDir, "test-ext.json"));
  });

  it("ensureExtStateDir creates directory", () => {
    const dir = path.join(os.homedir(), ".pi", "ext-state");
    // Clean up any previous test debris
    try { fs.rmSync(dir, { recursive: true }); } catch { /* ok */ }
    ensureExtStateDir();
    assert.ok(fs.existsSync(dir));
    assert.ok(fs.statSync(dir).isDirectory());
  });
});
