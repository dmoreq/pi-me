/**
 * TaskCapture — unit tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TaskCapture, createPlan } from "./capture.ts";
import { ManualIntentDetector } from "./intent-detector.ts";
import type { Message } from "./types-external.ts";

describe("TaskCapture", () => {
  const detector = new ManualIntentDetector();
  const capture = new TaskCapture(detector);

  it("should return empty for no messages", async () => {
    const result = await capture.capture([]);
    assert.strictEqual(result.tasks.length, 0);
  });

  it("should capture tasks from user messages", async () => {
    const messages: Message[] = [
      { role: "user", content: "fix login bug" },
      { role: "assistant", content: "I'll look into it" },
      { role: "user", content: "add tests for API" },
    ];
    const result = await capture.capture(messages);
    assert.strictEqual(result.tasks.length, 2);
    assert.strictEqual(result.tasks[0].intent, "fix");
    assert.strictEqual(result.tasks[1].intent, "test");
  });

  it("should deduplicate identical tasks", async () => {
    const messages: Message[] = [
      { role: "user", content: "fix login bug" },
      { role: "user", content: "fix login bug" },
    ];
    const result = await capture.capture(messages);
    assert.strictEqual(result.tasks.length, 1);
  });

  it("should infer priority from text", async () => {
    const messages: Message[] = [
      { role: "user", content: "fix this urgent bug" },
      { role: "user", content: "maybe add a nice-to-have feature" },
    ];
    const result = await capture.capture(messages);
    assert.strictEqual(result.tasks[0].priority, "high");
    assert.strictEqual(result.tasks[1].priority, "low");
  });

  it("should infer tags from text", async () => {
    const messages: Message[] = [
      { role: "user", content: "add API endpoint for users" },
    ];
    const result = await capture.capture(messages);
    assert.ok(result.tasks[0].tags?.includes("api"));
  });

  it("should set requiresReview=true by default", async () => {
    const messages: Message[] = [
      { role: "user", content: "fix login" },
    ];
    const result = await capture.capture(messages);
    assert.strictEqual(result.tasks[0].requiresReview, true);
  });

  it("should infer implicit dependency with then/after", async () => {
    const messages: Message[] = [
      { role: "user", content: "refactor auth" },
      { role: "user", content: "then add tests" },
    ];
    const result = await capture.capture(messages);
    assert.strictEqual(result.tasks.length, 2);
    assert.strictEqual(result.tasks[1].blockedBy?.length, 1);
    assert.strictEqual(result.tasks[1].blockedBy?.[0], result.tasks[0].id);
  });

  it("should skip short segments", async () => {
    const messages: Message[] = [
      { role: "user", content: "a" },
    ];
    const result = await capture.capture(messages);
    assert.strictEqual(result.tasks.length, 0);
  });

  it("should track classification source", async () => {
    const messages: Message[] = [
      { role: "user", content: "fix login bug" },
    ];
    const result = await capture.capture(messages);
    assert.strictEqual(result.sources.length, 1);
    assert.strictEqual(result.sources[0], "manual");
  });
});

describe("createPlan", () => {
  it("should create a plan with steps", () => {
    const plan = createPlan("Refactor auth", [
      "Read existing code",
      "Write tests",
      "Implement changes",
    ]);
    assert.strictEqual(plan.title, "Refactor auth");
    assert.strictEqual(plan.steps?.length, 3);
    assert.strictEqual(plan.status, "pending");
    assert.strictEqual(plan.source, "manual");
  });

  it("should set requiresReview=true by default", () => {
    const plan = createPlan("Test plan", ["Step 1"]);
    assert.strictEqual(plan.requiresReview, true);
  });

  it("should accept custom options", () => {
    const plan = createPlan("Test", ["Step 1"], {
      id: "my-plan",
      status: "in_progress",
      assignedToSession: "session-1",
      requiresReview: false,
    });
    assert.strictEqual(plan.id, "my-plan");
    assert.strictEqual(plan.status, "in_progress");
    assert.strictEqual(plan.assignedToSession, "session-1");
    assert.strictEqual(plan.requiresReview, false);
  });
});
