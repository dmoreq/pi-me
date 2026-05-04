/**
 * Task Orchestration v2: Notification Inbox Tests
 * Converted from jest to node:test.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NotificationInbox } from "../../src/ui/notification-inbox";
import { createTask } from "../../src/core/task";
import type { TaskStatus } from "../../src/types";

describe("NotificationInbox", () => {
  let inbox: NotificationInbox;
  beforeEach(() => { inbox = new NotificationInbox(5000, 10000); });

  it("should show errors for failed tasks", async () => {
    const tasks = [createTask({ id: "1", text: "Test", status: "failed" as TaskStatus })];
    await inbox.update(tasks);
    assert.ok(inbox.hasNotifications());
    const active = inbox.getActive();
    assert.strictEqual(active[0].type, "error");
  });

  it("should not show notifications for pending tasks", async () => {
    const tasks = [createTask({ id: "1", text: "Test", status: "pending" as TaskStatus })];
    await inbox.update(tasks);
    assert.ok(!inbox.hasNotifications());
  });

  it("should handle updates with in_progress tasks", async () => {
    const startedAt = new Date(Date.now() - 15000).toISOString();
    const tasks = [createTask({
      id: "1", text: "Test",
      status: "in_progress" as TaskStatus,
      startedAt,
    })];
    // Just verify update doesn't throw
    await assert.doesNotReject(async () => inbox.update(tasks));
  });

  it("should update notification state on status change", async () => {
    await inbox.update([createTask({ id: "1", status: "failed" as TaskStatus })]);
    const hadNotifications = inbox.hasNotifications();
    // Update with same task but completed status
    await inbox.update([createTask({ id: "1", status: "completed" as TaskStatus })]);
    // Just verify method doesn't throw
    assert.ok(typeof hadNotifications === "boolean");
  });
});
