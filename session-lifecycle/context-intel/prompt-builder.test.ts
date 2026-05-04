/**
 * PromptBuilder — unit tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PromptBuilder } from "./prompt-builder.ts";

describe("PromptBuilder", () => {
  describe("buildHandoff", () => {
    it("should include transcript in user message", () => {
      const result = PromptBuilder.buildHandoff("previous work", "new goal");
      assert.ok(result.user.includes("previous work"));
    });

    it("should include goal in user message", () => {
      const result = PromptBuilder.buildHandoff("previous work", "new goal");
      assert.ok(result.user.includes("new goal"));
    });

    it("should have context-transfer mention in system prompt", () => {
      const result = PromptBuilder.buildHandoff("", "");
      assert.ok(result.system.toLowerCase().includes("context") || result.system.toLowerCase().includes("start fresh"));
    });

    it("should return both system and user", () => {
      const result = PromptBuilder.buildHandoff("t", "g");
      assert.ok(result.system && typeof result.system === "string");
      assert.ok(result.user && typeof result.user === "string");
    });
  });

  describe("buildRecap", () => {
    it("should include transcript in user message", () => {
      const result = PromptBuilder.buildRecap("conversation history");
      assert.ok(result.user.includes("conversation history"));
    });

    it("should have recap mention in system prompt", () => {
      const result = PromptBuilder.buildRecap("");
      assert.ok(result.system.toLowerCase().includes("summar") || result.system.toLowerCase().includes("recap"));
    });

    it("should return both system and user", () => {
      const result = PromptBuilder.buildRecap("t");
      assert.ok(result.system && typeof result.system === "string");
      assert.ok(result.user && typeof result.user === "string");
    });
  });

  describe("buildCompactInstructions", () => {
    it("should return custom when provided", () => {
      const custom = "My custom instructions";
      const result = PromptBuilder.buildCompactInstructions(custom);
      assert.strictEqual(result, custom);
    });

    it("should return fallback when undefined", () => {
      const result = PromptBuilder.buildCompactInstructions(undefined);
      assert.ok(result.length > 0);
      assert.ok(result.toLowerCase().includes("summar"));
    });

    it("should return fallback when empty string passed", () => {
      const result = PromptBuilder.buildCompactInstructions("");
      assert.ok(result.length > 0);
    });
  });

  describe("buildTaskExtraction", () => {
    it("should have JSON mention in system prompt", () => {
      const result = PromptBuilder.buildTaskExtraction("");
      assert.ok(result.system.toLowerCase().includes("json"));
    });

    it("should include transcript in user message", () => {
      const result = PromptBuilder.buildTaskExtraction("my transcript");
      assert.ok(result.user.includes("my transcript"));
    });
  });

  describe("buildDependencyAnalysis", () => {
    it("should format tasks in user message", () => {
      const result = PromptBuilder.buildDependencyAnalysis(["task 1", "task 2"]);
      assert.ok(result.user.includes("task 1"));
      assert.ok(result.user.includes("task 2"));
    });

    it("should have JSON mention in system prompt", () => {
      const result = PromptBuilder.buildDependencyAnalysis([]);
      assert.ok(result.system.toLowerCase().includes("json"));
    });
  });
});
