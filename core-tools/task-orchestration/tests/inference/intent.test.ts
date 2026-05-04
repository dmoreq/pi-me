/**
 * Task Orchestration v2: Intent Classification Tests
 * Converted from jest to node:test.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { RegexIntentClassifier } from "../../src/inference/intent";

describe("RegexIntentClassifier", () => {
  let classifier: RegexIntentClassifier;
  beforeEach(() => { classifier = new RegexIntentClassifier(); });

  describe("classify", () => {
    it("should classify fix intent", () => {
      assert.strictEqual(classifier.classify("Fix the login bug"), "fix");
      assert.strictEqual(classifier.classify("Debug auth flow"), "fix");
      assert.strictEqual(classifier.classify("Repair broken test"), "fix");
    });

    it("should classify refactor intent", () => {
      assert.strictEqual(classifier.classify("Refactor module"), "refactor");
      assert.strictEqual(classifier.classify("Clean up old code"), "refactor");
      assert.strictEqual(classifier.classify("Rewrite the parser"), "refactor");
    });

    it("should classify test intent", () => {
      assert.strictEqual(classifier.classify("Add unit tests"), "test");
      assert.strictEqual(classifier.classify("Write integration test"), "test");
    });

    it("should classify docs intent", () => {
      assert.strictEqual(classifier.classify("Document the API"), "docs");
      assert.strictEqual(classifier.classify("Update README"), "docs");
    });

    it("should classify deploy intent", () => {
      assert.strictEqual(classifier.classify("Deploy to staging"), "deploy");
      assert.strictEqual(classifier.classify("Release v1.0"), "deploy");
    });

    it("should classify analyze for unknown intent", () => {
      // "Implement" and "Handle" aren't covered by predefined patterns, so they default to "analyze"
      const result1 = classifier.classify("Implement auth");
      const result2 = classifier.classify("Handle it");
      assert.ok(["analyze", "implement", "general"].includes(result1));
      assert.ok(["analyze", "implement", "general"].includes(result2));
    });
  });
});
