import { describe, it } from "bun:test";
import * as assert from "node:assert/strict";
import { buildCommitPrompt } from "./prompt.ts";
import type { CommitGroup } from "./types.ts";

function makeGroup(label: string, scope: string): CommitGroup {
  return {
    label,
    scope,
    files: [
      { absPath: "/repo/core-tools/memory/store.ts", relPath: "core-tools/memory/store.ts", status: "M", staged: true },
      { absPath: "/repo/core-tools/memory/index.ts", relPath: "core-tools/memory/index.ts", status: "A", staged: false },
    ],
  };
}

describe("buildCommitPrompt", () => {
  it("includes the scope in instructions when scope is present", () => {
    const prompt = buildCommitPrompt(makeGroup("core-tools/memory", "memory"), "stat", "diff", []);
    assert.ok(prompt.includes('"memory"'), "should mention scope name");
    assert.ok(prompt.includes("(memory)"), "should show scope format");
  });

  it("tells LLM to omit scope for root-level files", () => {
    const group: CommitGroup = {
      label: "root",
      scope: "",
      files: [{ absPath: "/repo/README.md", relPath: "README.md", status: "M", staged: false }],
    };
    const prompt = buildCommitPrompt(group, "stat", "diff", []);
    assert.ok(prompt.includes("omit the scope"), "should say omit scope");
  });

  it("includes file paths in the prompt", () => {
    const prompt = buildCommitPrompt(makeGroup("core-tools/memory", "memory"), "stat", "diff body", []);
    assert.ok(prompt.includes("core-tools/memory/store.ts"));
    assert.ok(prompt.includes("core-tools/memory/index.ts"));
  });

  it("labels file statuses correctly", () => {
    const prompt = buildCommitPrompt(makeGroup("core-tools/memory", "memory"), "stat", "diff", []);
    assert.ok(prompt.includes("[modified]"));
    assert.ok(prompt.includes("[added]"));
  });

  it("includes the diff body", () => {
    const prompt = buildCommitPrompt(makeGroup("core-tools/memory", "memory"), "stat", "my diff content", []);
    assert.ok(prompt.includes("my diff content"));
  });

  it("includes quality notes when formatting/fixing happened", () => {
    const quality = [
      { file: "core-tools/memory/store.ts", formatted: true, fixed: true, fixCount: 3, errors: [] },
    ];
    const prompt = buildCommitPrompt(makeGroup("core-tools/memory", "memory"), "stat", "diff", quality);
    assert.ok(prompt.includes("formatted"));
    assert.ok(prompt.includes("fixed 3 lint issue(s)"));
  });

  it("does not include quality section when nothing changed", () => {
    const quality = [
      { file: "core-tools/memory/store.ts", formatted: false, fixed: false, fixCount: 0, errors: [] },
    ];
    const prompt = buildCommitPrompt(makeGroup("core-tools/memory", "memory"), "stat", "diff", quality);
    assert.ok(!prompt.includes("Auto-quality"), "should not include empty quality section");
  });

  it("ends with instruction to call commit_message tool", () => {
    const prompt = buildCommitPrompt(makeGroup("core-tools/memory", "memory"), "stat", "diff", []);
    assert.ok(prompt.includes("commit_message tool"));
  });
});
