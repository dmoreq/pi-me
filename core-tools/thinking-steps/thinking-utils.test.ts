import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendDelta, buildLabel, detectSteps, isValidThinkingMode, summarize } from "./thinking-utils.ts";

describe("thinking-utils", () => {
  it("appends string deltas", () => {
    assert.equal(appendDelta("a", "b"), "ab");
    assert.equal(appendDelta("a", 1), "a");
  });

  it("summarizes and truncates", () => {
    assert.equal(summarize("   - hello   world  "), "hello world");
    assert.ok(summarize("x".repeat(200)).length <= 80);
  });

  it("detects steps from structured thinking", () => {
    const steps = detectSteps("1. Inspect\n2. Refactor\n3. Test");
    assert.equal(steps.length, 3);
  });

  it("builds labels", () => {
    assert.equal(buildLabel("collapsed", "1. A\n2. B"), "Thinking (2 steps)...");
    assert.ok((buildLabel("summary", "1. A") ?? "").includes("A"));
    assert.equal(buildLabel("expanded", "1. A"), undefined);
    assert.equal(buildLabel("hidden", "1. A"), "");
  });

  it("validates modes", () => {
    assert.equal(isValidThinkingMode("summary"), true);
    assert.equal(isValidThinkingMode("nope"), false);
  });
});
