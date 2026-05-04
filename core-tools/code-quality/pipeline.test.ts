/**
 * CodeQualityPipeline — unit tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CodeQualityPipeline } from "./pipeline.ts";
import { RunnerRegistry } from "./registry.ts";
import type { CodeRunner, RunnerConfig, RunnerResult } from "./types.ts";

class MockRunner implements CodeRunner {
  readonly id: string;
  readonly type: "format" | "fix";
  readonly delay: number;

  constructor(id: string, type: "format" | "fix", delay: number = 0) {
    this.id = id;
    this.type = type;
    this.delay = delay;
  }

  matches(filePath: string): boolean {
    return true;
  }

  async run(): Promise<RunnerResult> {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
    return { status: "succeeded", message: `${this.id} done` };
  }
}

describe("CodeQualityPipeline", () => {
  it("should process file with no runners", async () => {
    const pipeline = new CodeQualityPipeline();
    const result = await pipeline.processFile("app.ts", "/cwd", async () => ({
      exitCode: 0,
      stdout: "",
    }));

    assert.strictEqual(result.format.length, 0);
    assert.strictEqual(result.fix.length, 0);
  });

  it("should call format runners", async () => {
    const registry = new RunnerRegistry();
    registry.register(new MockRunner("prettier", "format"));

    const pipeline = new CodeQualityPipeline(registry);
    const result = await pipeline.processFile("app.ts", "/cwd", async () => ({
      exitCode: 0,
      stdout: "",
    }));

    assert.strictEqual(result.format.length, 1);
    assert.strictEqual(result.format[0].status, "succeeded");
  });

  it("should call fix runners", async () => {
    const registry = new RunnerRegistry();
    registry.register(new MockRunner("eslint", "fix"));

    const pipeline = new CodeQualityPipeline(registry);
    const result = await pipeline.processFile("app.ts", "/cwd", async () => ({
      exitCode: 0,
      stdout: "",
    }));

    assert.strictEqual(result.fix.length, 1);
  });

  it("should call both stages", async () => {
    const registry = new RunnerRegistry();
    registry.register(new MockRunner("prettier", "format"));
    registry.register(new MockRunner("eslint", "fix"));

    const pipeline = new CodeQualityPipeline(registry);
    const result = await pipeline.processFile("app.ts", "/cwd", async () => ({
      exitCode: 0,
      stdout: "",
    }));

    assert.ok(result.format.length > 0);
    assert.ok(result.fix.length > 0);
  });

  it("should measure duration", async () => {
    const registry = new RunnerRegistry();
    registry.register(new MockRunner("test", "format", 50));
    
    const pipeline = new CodeQualityPipeline(registry);
    const result = await pipeline.processFile("app.ts", "/cwd", async () => {
      return { exitCode: 0, stdout: "" };
    });

    assert.ok(result.duration >= 50, `Expected duration >= 50ms, got ${result.duration}ms`);
  });

  it("should provide access to registry", () => {
    const registry = new RunnerRegistry();
    const pipeline = new CodeQualityPipeline(registry);
    assert.strictEqual(pipeline.getRegistry(), registry);
  });
});
