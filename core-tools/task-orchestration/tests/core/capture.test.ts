/**
 * Task Orchestration v2: TaskCapture Tests
 * Converted from jest to node:test.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { TaskCapture } from "../../src/core/capture";

describe("TaskCapture", () => {
  let capture: TaskCapture;
  beforeEach(() => { capture = new TaskCapture(); });

  describe("infer", () => {
    it("should infer single task", () => {
      const result = capture.infer([{ role: "user", content: "Fix the login bug" }]);
      assert.ok(result.tasks.length >= 1);
      assert.ok(result.tasks[0].text.toLowerCase().includes("login"));
      assert.strictEqual(result.tasks[0].intent, "fix");
    });

    it("should infer multiple tasks with 'and'", () => {
      const result = capture.infer([{ role: "user", content: "Fix login and update docs" }]);
      assert.ok(result.tasks.length >= 2);
      assert.strictEqual(result.tasks[0].intent, "fix");
    });

    it("should infer multiple tasks from comma list", () => {
      const result = capture.infer([{ role: "user", content: "Fix auth, refactor module, add tests" }]);
      assert.ok(result.tasks.length >= 3);
      assert.strictEqual(result.tasks[0].intent, "fix");
      assert.strictEqual(result.tasks[1].intent, "refactor");
      assert.strictEqual(result.tasks[2].intent, "test");
    });

    it("should handle empty message", () => {
      const result = capture.infer([{ role: "user", content: "" }]);
      assert.strictEqual(result.tasks.length, 0);
    });

    it("should ignore assistant messages", () => {
      const result = capture.infer([{ role: "assistant", content: "Doing it now" }]);
      assert.strictEqual(result.tasks.length, 0);
    });
  });

  describe("segmentMessage", () => {
    it("should segment compound message with 'and'", () => {
      const segments = capture.segmentMessage("Fix X and test Y");
      assert.ok(segments.length >= 2);
    });

    it("should return single segment for simple message", () => {
      const segments = capture.segmentMessage("Fix the bug");
      assert.strictEqual(segments.length, 1);
    });

    it("should segment by comma", () => {
      const segments = capture.segmentMessage("A, B, C");
      assert.ok(segments.length >= 3);
    });
  });
});
