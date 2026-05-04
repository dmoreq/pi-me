/**
 * Task Orchestration v2: Renderer Tests
 * Converted from jest to node:test.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TaskRenderer } from "../../src/ui/renderer";
import { createTask } from "../../src/core/task";
import type { TaskStatus } from "../../src/types";

describe("TaskRenderer", () => {
  describe("statusIcon", () => {
    it("should return correct icon for each status", () => {
      assert.strictEqual(TaskRenderer.statusIcon(createTask({ status: "pending" as TaskStatus })), "⚫");
      assert.strictEqual(TaskRenderer.statusIcon(createTask({ status: "in_progress" as TaskStatus })), "→");
      assert.strictEqual(TaskRenderer.statusIcon(createTask({ status: "completed" as TaskStatus })), "✓");
      assert.strictEqual(TaskRenderer.statusIcon(createTask({ status: "failed" as TaskStatus })), "✕");
      assert.strictEqual(TaskRenderer.statusIcon(createTask({ status: "skipped" as TaskStatus })), "⊘");
    });
  });

  describe("formatMs", () => {
    it("should format milliseconds under 1s", () => {
      assert.strictEqual(TaskRenderer.formatMs(500), "500ms");
    });
    it("should format seconds", () => {
      assert.strictEqual(TaskRenderer.formatMs(2000), "2s");
    });
    it("should format minutes and seconds", () => {
      assert.strictEqual(TaskRenderer.formatMs(90000), "1m 30s");
    });
  });

  describe("progressBar", () => {
    it("should render progress bar of correct length", () => {
      const bar = TaskRenderer.progressBar(5, 10, 20);
      assert.strictEqual(bar.length, 20);
      assert.ok(bar.includes("█"), "should include filled chars");
      assert.ok(bar.includes("░"), "should include empty chars");
    });
    it("should render full bar when complete", () => {
      const bar = TaskRenderer.progressBar(10, 10, 20);
      assert.strictEqual(bar, "█".repeat(20));
    });
    it("should render empty bar when zero", () => {
      const bar = TaskRenderer.progressBar(0, 10, 20);
      assert.strictEqual(bar, "░".repeat(20));
    });
  });
});
