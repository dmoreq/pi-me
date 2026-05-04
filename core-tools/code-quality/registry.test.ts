/**
 * RunnerRegistry — unit tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RunnerRegistry } from "./registry.ts";
import type { CodeRunner, RunnerConfig, RunnerResult } from "./types.ts";

class MockRunner implements CodeRunner {
  readonly id: string;
  readonly type: "format" | "fix" | "analyze";
  readonly ext: string;

  constructor(id: string, type: "format" | "fix" | "analyze", ext: string) {
    this.id = id;
    this.type = type;
    this.ext = ext;
  }

  matches(filePath: string): boolean {
    return filePath.endsWith(this.ext);
  }

  async run(): Promise<RunnerResult> {
    return { status: "succeeded" };
  }
}

describe("RunnerRegistry", () => {
  it("should register a runner", () => {
    const registry = new RunnerRegistry();
    const runner = new MockRunner("test", "format", ".ts");
    registry.register(runner);
    assert.ok(registry.get("test") !== undefined);
  });

  it("should getForFile filters by type and extension", () => {
    const registry = new RunnerRegistry();
    registry.register(new MockRunner("prettier", "format", ".ts"));
    registry.register(new MockRunner("eslint", "fix", ".ts"));

    const formatters = registry.getForFile("app.ts", "format");
    assert.strictEqual(formatters.length, 1);
    assert.strictEqual(formatters[0].id, "prettier");

    const fixers = registry.getForFile("app.ts", "fix");
    assert.strictEqual(fixers.length, 1);
    assert.strictEqual(fixers[0].id, "eslint");
  });

  it("should return empty when nothing matches", () => {
    const registry = new RunnerRegistry();
    registry.register(new MockRunner("prettier", "format", ".ts"));

    const result = registry.getForFile("app.js", "format");
    assert.strictEqual(result.length, 0);
  });

  it("should overwrite duplicate IDs", () => {
    const registry = new RunnerRegistry();
    registry.register(new MockRunner("prettier-1", "format", ".ts"));
    registry.register(new MockRunner("prettier-1", "format", ".js"));

    const runner = registry.get("prettier-1");
    assert.ok(runner?.matches("app.js"));
    assert.ok(!runner?.matches("app.ts"));
  });

  it("should list all runners", () => {
    const registry = new RunnerRegistry();
    registry.register(new MockRunner("a", "format", ".ts"));
    registry.register(new MockRunner("b", "fix", ".ts"));
    registry.register(new MockRunner("c", "analyze", ".ts"));

    assert.strictEqual(registry.list().length, 3);
  });

  it("should clear all runners", () => {
    const registry = new RunnerRegistry();
    registry.register(new MockRunner("test", "format", ".ts"));
    assert.strictEqual(registry.size(), 1);

    registry.clear();
    assert.strictEqual(registry.size(), 0);
  });
});
