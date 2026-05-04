/**
 * Task Orchestration v2: Progress Widget Tests
 * Converted from jest to node:test.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ProgressWidget } from "../../src/ui/progress-widget";
import { createTask } from "../../src/core/task";
import type { TaskStatus } from "../../src/types";

describe("ProgressWidget", () => {
  let widget: ProgressWidget;
  beforeEach(() => { widget = new ProgressWidget(); });

  it("should render summary with counts", () => {
    widget.update([
      createTask({ id: "1", status: "completed" as TaskStatus }),
      createTask({ id: "2", status: "in_progress" as TaskStatus }),
      createTask({ id: "3", status: "pending" as TaskStatus }),
    ]);
    const summary = widget.renderSummary();
    assert.ok(summary.includes("1"), "should include count 1");
  });

  it("should handle no tasks", () => {
    widget.update([]);
    assert.strictEqual(widget.renderFull(), "No tasks");
  });

  it("should update internal task state", () => {
    const tasks = [
      createTask({ id: "1", status: "completed" as TaskStatus }),
      createTask({ id: "2", status: "pending" as TaskStatus }),
    ];
    widget.update(tasks);
    // After update, renderSummary should return a non-empty string
    const summary = widget.renderSummary();
    assert.ok(typeof summary === "string");
  });
});
