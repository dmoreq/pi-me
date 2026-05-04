/**
 * TaskNormalizer — unit tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TaskNormalizer } from "./normalizer.ts";
import type { PlanStep } from "../planning/types.ts";

function makeStep(id: string, text: string, intent: any = "general"): PlanStep {
  return {
    id,
    text,
    intent,
    status: "pending",
  };
}

describe("TaskNormalizer", () => {
  describe("normalize", () => {
    it("should convert plan step to subprocess task", () => {
      const step = makeStep("t1", "Run tests", "test");
      const task = TaskNormalizer.normalize(step);

      assert.strictEqual(task.id, "t1");
      assert.strictEqual(task.name, "Run tests");
      assert.ok(task.cmd);
      assert.ok(task.cwd);
      assert.ok(task.timeout);
    });

    it("should set critical=true for fix intent", () => {
      const step = makeStep("t1", "Fix bug", "fix");
      const task = TaskNormalizer.normalize(step);
      assert.strictEqual(task.critical, true);
    });

    it("should set critical=true for deploy intent", () => {
      const step = makeStep("t1", "Deploy", "deploy");
      const task = TaskNormalizer.normalize(step);
      assert.strictEqual(task.critical, true);
    });

    it("should set critical=false for general intent", () => {
      const step = makeStep("t1", "Do something", "general");
      const task = TaskNormalizer.normalize(step);
      assert.strictEqual(task.critical, false);
    });

    it("should accept custom cwd", () => {
      const step = makeStep("t1", "Test", "test");
      const task = TaskNormalizer.normalize(step, "/custom/path");
      assert.strictEqual(task.cwd, "/custom/path");
    });
  });

  describe("normalizeMany", () => {
    it("should normalize multiple steps", () => {
      const steps = [
        makeStep("t1", "Fix", "fix"),
        makeStep("t2", "Test", "test"),
      ];
      const tasks = TaskNormalizer.normalizeMany(steps);
      assert.strictEqual(tasks.length, 2);
      assert.strictEqual(tasks[0].id, "t1");
      assert.strictEqual(tasks[1].id, "t2");
    });
  });

  describe("commandForIntent", () => {
    it("should map test intent to npm", () => {
      const step = makeStep("t1", "Test", "test");
      const task = TaskNormalizer.normalize(step);
      assert.strictEqual(task.cmd, "npm");
    });

    it("should map fix intent to bash", () => {
      const step = makeStep("t1", "Fix", "fix");
      const task = TaskNormalizer.normalize(step);
      assert.strictEqual(task.cmd, "bash");
    });

    it("should map deploy intent to bash", () => {
      const step = makeStep("t1", "Deploy", "deploy");
      const task = TaskNormalizer.normalize(step);
      assert.strictEqual(task.cmd, "bash");
    });

    it("should default to bash for unknown intent", () => {
      const step = makeStep("t1", "Something", "unknown");
      const task = TaskNormalizer.normalize(step);
      assert.strictEqual(task.cmd, "bash");
    });
  });

  describe("isSpecialCase", () => {
    it("should identify deploy as special", () => {
      const step = makeStep("t1", "Deploy", "deploy");
      assert.ok(TaskNormalizer.isSpecialCase(step));
    });

    it("should identify test as special", () => {
      const step = makeStep("t1", "Test", "test");
      assert.ok(TaskNormalizer.isSpecialCase(step));
    });

    it("should not identify general as special", () => {
      const step = makeStep("t1", "Do stuff", "general");
      assert.ok(!TaskNormalizer.isSpecialCase(step));
    });
  });
});
