import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  handleInit,
  handleUpdate,
  handleStatus,
  handleClear,
  formatStatus,
  formatWidgetData,
  reconstructFromBranch,
  type Task,
  type BranchEntry,
} from "../plan-tracker-core.js";

// --- Action Handlers ---

describe("handleInit", () => {
  it("creates tasks from string array, all pending", () => {
    const result = handleInit(["Task A", "Task B", "Task C"]);
    assert.equal(result.error, undefined);
    assert.equal(result.tasks.length, 3);
    assert.deepEqual(result.tasks[0], { name: "Task A", status: "pending" });
    assert.deepEqual(result.tasks[1], { name: "Task B", status: "pending" });
    assert.deepEqual(result.tasks[2], { name: "Task C", status: "pending" });
  });

  it("returns error when tasks array is empty", () => {
    const result = handleInit([]);
    assert.equal(result.error, "tasks required");
    assert.deepEqual(result.tasks, []);
  });

  it("returns error when tasks is undefined", () => {
    const result = handleInit(undefined);
    assert.equal(result.error, "tasks required");
    assert.deepEqual(result.tasks, []);
  });
});

describe("handleUpdate", () => {
  const baseTasks: Task[] = [
    { name: "Task A", status: "pending" },
    { name: "Task B", status: "pending" },
    { name: "Task C", status: "pending" },
  ];

  it("sets task status to complete", () => {
    const result = handleUpdate(baseTasks, 1, "complete");
    assert.equal(result.error, undefined);
    assert.equal(result.tasks[1].status, "complete");
    // other tasks unchanged
    assert.equal(result.tasks[0].status, "pending");
    assert.equal(result.tasks[2].status, "pending");
  });

  it("sets task status to in_progress", () => {
    const result = handleUpdate(baseTasks, 0, "in_progress");
    assert.equal(result.error, undefined);
    assert.equal(result.tasks[0].status, "in_progress");
  });

  it("sets task status back to pending", () => {
    const tasks: Task[] = [{ name: "Task A", status: "complete" }];
    const result = handleUpdate(tasks, 0, "pending");
    assert.equal(result.error, undefined);
    assert.equal(result.tasks[0].status, "pending");
  });

  it("does not mutate the original tasks array", () => {
    const original: Task[] = [{ name: "Task A", status: "pending" }];
    handleUpdate(original, 0, "complete");
    assert.equal(original[0].status, "pending");
  });

  it("returns error when no plan active", () => {
    const result = handleUpdate([], 0, "complete");
    assert.equal(result.error, "no plan active");
  });

  it("returns error when index out of range (negative)", () => {
    const result = handleUpdate(baseTasks, -1, "complete");
    assert.equal(result.error, "index -1 out of range");
  });

  it("returns error when index out of range (too high)", () => {
    const result = handleUpdate(baseTasks, 5, "complete");
    assert.equal(result.error, "index 5 out of range");
  });

  it("returns error when index is undefined", () => {
    const result = handleUpdate(baseTasks, undefined, "complete");
    assert.equal(result.error, "index and status required");
  });

  it("returns error when status is undefined", () => {
    const result = handleUpdate(baseTasks, 0, undefined);
    assert.equal(result.error, "index and status required");
  });
});

describe("handleStatus", () => {
  it("returns formatted status with counts", () => {
    const tasks: Task[] = [
      { name: "Task A", status: "complete" },
      { name: "Task B", status: "in_progress" },
      { name: "Task C", status: "pending" },
    ];
    const result = handleStatus(tasks);
    assert.equal(result.error, undefined);
    assert.ok(result.text.includes("1/3 complete"));
    assert.ok(result.text.includes("1 in progress"));
    assert.ok(result.text.includes("1 pending"));
  });

  it('returns "no plan active" when empty', () => {
    const result = handleStatus([]);
    assert.equal(result.text, "No plan active.");
  });
});

describe("handleClear", () => {
  it("returns cleared message with count", () => {
    const tasks: Task[] = [
      { name: "A", status: "pending" },
      { name: "B", status: "complete" },
    ];
    const result = handleClear(tasks);
    assert.equal(result.text, "Plan cleared (2 tasks removed).");
    assert.deepEqual(result.tasks, []);
  });

  it('returns "no plan was active" when already empty', () => {
    const result = handleClear([]);
    assert.equal(result.text, "No plan was active.");
    assert.deepEqual(result.tasks, []);
  });
});

// --- Formatting ---

describe("formatStatus", () => {
  it("shows complete/total counts", () => {
    const tasks: Task[] = [
      { name: "A", status: "complete" },
      { name: "B", status: "pending" },
    ];
    const output = formatStatus(tasks);
    assert.ok(output.includes("1/2 complete"));
  });

  it("shows icon per task", () => {
    const tasks: Task[] = [
      { name: "Done", status: "complete" },
      { name: "Working", status: "in_progress" },
      { name: "Todo", status: "pending" },
    ];
    const output = formatStatus(tasks);
    assert.ok(output.includes("✓ [0] Done"));
    assert.ok(output.includes("→ [1] Working"));
    assert.ok(output.includes("○ [2] Todo"));
  });

  it("handles all-complete", () => {
    const tasks: Task[] = [
      { name: "A", status: "complete" },
      { name: "B", status: "complete" },
    ];
    const output = formatStatus(tasks);
    assert.ok(output.includes("2/2 complete"));
    assert.ok(output.includes("0 in progress"));
    assert.ok(output.includes("0 pending"));
  });

  it("handles all-pending", () => {
    const tasks: Task[] = [
      { name: "A", status: "pending" },
      { name: "B", status: "pending" },
    ];
    const output = formatStatus(tasks);
    assert.ok(output.includes("0/2 complete"));
  });

  it("handles mixed states", () => {
    const tasks: Task[] = [
      { name: "A", status: "complete" },
      { name: "B", status: "in_progress" },
      { name: "C", status: "pending" },
      { name: "D", status: "complete" },
    ];
    const output = formatStatus(tasks);
    assert.ok(output.includes("2/4 complete"));
    assert.ok(output.includes("1 in progress"));
    assert.ok(output.includes("1 pending"));
  });

  it("returns no plan active for empty list", () => {
    assert.equal(formatStatus([]), "No plan active.");
  });
});

describe("formatWidgetData", () => {
  it("returns icons string, counts, current task name", () => {
    const tasks: Task[] = [
      { name: "A", status: "complete" },
      { name: "B", status: "in_progress" },
      { name: "C", status: "pending" },
    ];
    const data = formatWidgetData(tasks);
    assert.deepEqual(data.icons, ["✓", "→", "○"]);
    assert.equal(data.complete, 1);
    assert.equal(data.total, 3);
    assert.equal(data.currentName, "B");
  });

  it("current task is first in_progress", () => {
    const tasks: Task[] = [
      { name: "A", status: "complete" },
      { name: "B", status: "in_progress" },
      { name: "C", status: "in_progress" },
    ];
    const data = formatWidgetData(tasks);
    assert.equal(data.currentName, "B");
  });

  it("current task falls back to first pending", () => {
    const tasks: Task[] = [
      { name: "A", status: "complete" },
      { name: "B", status: "pending" },
      { name: "C", status: "pending" },
    ];
    const data = formatWidgetData(tasks);
    assert.equal(data.currentName, "B");
  });

  it("returns empty when no tasks", () => {
    const data = formatWidgetData([]);
    assert.deepEqual(data.icons, []);
    assert.equal(data.complete, 0);
    assert.equal(data.total, 0);
    assert.equal(data.currentName, "");
  });

  it("currentName empty when all complete", () => {
    const tasks: Task[] = [
      { name: "A", status: "complete" },
      { name: "B", status: "complete" },
    ];
    const data = formatWidgetData(tasks);
    assert.equal(data.currentName, "");
  });
});

// --- State Reconstruction ---

describe("reconstructFromBranch", () => {
  it("returns empty when no plan_tracker entries", () => {
    const entries: BranchEntry[] = [
      { type: "message", message: { role: "user" } },
      { type: "message", message: { role: "assistant" } },
    ];
    assert.deepEqual(reconstructFromBranch(entries), []);
  });

  it("returns latest task state from multiple entries", () => {
    const entries: BranchEntry[] = [
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: "plan_tracker",
          details: {
            action: "init",
            tasks: [
              { name: "A", status: "pending" },
              { name: "B", status: "pending" },
            ],
          },
        },
      },
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: "plan_tracker",
          details: {
            action: "update",
            tasks: [
              { name: "A", status: "complete" },
              { name: "B", status: "pending" },
            ],
          },
        },
      },
    ];
    const tasks = reconstructFromBranch(entries);
    assert.equal(tasks[0].status, "complete");
    assert.equal(tasks[1].status, "pending");
  });

  it("ignores entries with errors", () => {
    const entries: BranchEntry[] = [
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: "plan_tracker",
          details: {
            action: "init",
            tasks: [{ name: "A", status: "pending" }],
          },
        },
      },
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: "plan_tracker",
          details: {
            action: "update",
            tasks: [{ name: "A", status: "pending" }],
            error: "index out of range",
          },
        },
      },
    ];
    const tasks = reconstructFromBranch(entries);
    // Should still have the init state, error entry ignored
    assert.deepEqual(tasks, [{ name: "A", status: "pending" }]);
  });

  it("ignores non-plan_tracker entries", () => {
    const entries: BranchEntry[] = [
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: "other_tool",
          details: { action: "init", tasks: [{ name: "X", status: "pending" }] },
        },
      },
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: "plan_tracker",
          details: {
            action: "init",
            tasks: [{ name: "A", status: "pending" }],
          },
        },
      },
    ];
    const tasks = reconstructFromBranch(entries);
    assert.deepEqual(tasks, [{ name: "A", status: "pending" }]);
  });

  it("handles init followed by updates", () => {
    const entries: BranchEntry[] = [
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: "plan_tracker",
          details: {
            action: "init",
            tasks: [
              { name: "A", status: "pending" },
              { name: "B", status: "pending" },
              { name: "C", status: "pending" },
            ],
          },
        },
      },
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: "plan_tracker",
          details: {
            action: "update",
            tasks: [
              { name: "A", status: "in_progress" },
              { name: "B", status: "pending" },
              { name: "C", status: "pending" },
            ],
          },
        },
      },
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: "plan_tracker",
          details: {
            action: "update",
            tasks: [
              { name: "A", status: "complete" },
              { name: "B", status: "in_progress" },
              { name: "C", status: "pending" },
            ],
          },
        },
      },
    ];
    const tasks = reconstructFromBranch(entries);
    assert.deepEqual(tasks[0], { name: "A", status: "complete" });
    assert.deepEqual(tasks[1], { name: "B", status: "in_progress" });
    assert.deepEqual(tasks[2], { name: "C", status: "pending" });
  });

  it("handles clear (returns empty)", () => {
    const entries: BranchEntry[] = [
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: "plan_tracker",
          details: {
            action: "init",
            tasks: [{ name: "A", status: "pending" }],
          },
        },
      },
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: "plan_tracker",
          details: {
            action: "clear",
            tasks: [],
          },
        },
      },
    ];
    const tasks = reconstructFromBranch(entries);
    assert.deepEqual(tasks, []);
  });

  it("ignores non-message entries", () => {
    const entries: BranchEntry[] = [
      { type: "system" },
      { type: "config" },
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: "plan_tracker",
          details: {
            action: "init",
            tasks: [{ name: "A", status: "pending" }],
          },
        },
      },
    ];
    const tasks = reconstructFromBranch(entries);
    assert.deepEqual(tasks, [{ name: "A", status: "pending" }]);
  });
});
