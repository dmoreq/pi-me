/**
 * TelemetryAutomation — unit tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TelemetryAutomation } from "./telemetry-automation.ts";

describe("TelemetryAutomation", () => {
  describe("contextDepth", () => {
    it("should trigger at 50+ messages", () => {
      const trigger = TelemetryAutomation.contextDepth(50);
      assert.ok(trigger !== null);
      assert.strictEqual(trigger?.id, "context-depth");
    });

    it("should not trigger below 50 messages", () => {
      const trigger = TelemetryAutomation.contextDepth(49);
      assert.strictEqual(trigger, null);
    });
  });

  describe("highActivityDetected", () => {
    it("should trigger at >5 tool calls", () => {
      const trigger = TelemetryAutomation.highActivityDetected(6);
      assert.ok(trigger !== null);
      assert.strictEqual(trigger?.id, "high-activity");
    });

    it("should not trigger at ≤5 tool calls", () => {
      const trigger = TelemetryAutomation.highActivityDetected(5);
      assert.strictEqual(trigger, null);
    });
  });

  describe("fileInvolvementDetected", () => {
    it("should trigger at >10 files", () => {
      const trigger = TelemetryAutomation.fileInvolvementDetected(11);
      assert.ok(trigger !== null);
      assert.strictEqual(trigger?.id, "files-involved");
    });

    it("should not trigger at ≤10 files", () => {
      const trigger = TelemetryAutomation.fileInvolvementDetected(10);
      assert.strictEqual(trigger, null);
    });
  });

  describe("planCreated", () => {
    it("should always trigger", () => {
      const trigger = TelemetryAutomation.planCreated("Test Plan");
      assert.ok(trigger !== null);
      assert.strictEqual(trigger.id, "plan-created");
      assert.ok(trigger.message.includes("Test Plan"));
    });
  });

  describe("parallelTasksDetected", () => {
    it("should trigger at ≥3 independent tasks", () => {
      const trigger = TelemetryAutomation.parallelTasksDetected(3);
      assert.ok(trigger !== null);
      assert.strictEqual(trigger?.id, "parallel-tasks");
    });

    it("should not trigger at <3 independent tasks", () => {
      const trigger = TelemetryAutomation.parallelTasksDetected(2);
      assert.strictEqual(trigger, null);
    });
  });

  describe("fileIndexed", () => {
    it("should always trigger", () => {
      const trigger = TelemetryAutomation.fileIndexed("src/app.ts");
      assert.ok(trigger !== null);
      assert.strictEqual(trigger.id, "file-indexed");
      assert.ok(trigger.message.includes("src/app.ts"));
    });
  });

  describe("tasksNormalized", () => {
    it("should always trigger with count", () => {
      const trigger = TelemetryAutomation.tasksNormalized(5);
      assert.ok(trigger !== null);
      assert.strictEqual(trigger.id, "tasks-normalized");
      assert.ok(trigger.message.includes("5"));
    });
  });

  describe("webSearched", () => {
    it("should always trigger with query", () => {
      const trigger = TelemetryAutomation.webSearched("AI trends");
      assert.ok(trigger !== null);
      assert.strictEqual(trigger.id, "web-search");
      assert.ok(trigger.message.includes("AI trends"));
    });
  });

  describe("qualityCheckRan", () => {
    it("should always trigger with file and stage", () => {
      const trigger = TelemetryAutomation.qualityCheckRan("app.ts", "format");
      assert.ok(trigger !== null);
      assert.strictEqual(trigger.id, "quality-check");
      assert.ok(trigger.message.includes("format"));
      assert.ok(trigger.message.includes("app.ts"));
    });
  });

  describe("badge variants", () => {
    it("should use warning variant for context-depth", () => {
      const trigger = TelemetryAutomation.contextDepth(50);
      assert.strictEqual(trigger?.badge.variant, "warning");
    });

    it("should use info variant for file-involvement", () => {
      const trigger = TelemetryAutomation.fileInvolvementDetected(11);
      assert.strictEqual(trigger?.badge.variant, "info");
    });

    it("should use success variant for plan-created", () => {
      const trigger = TelemetryAutomation.planCreated("Test");
      assert.strictEqual(trigger.badge.variant, "success");
    });
  });
});
