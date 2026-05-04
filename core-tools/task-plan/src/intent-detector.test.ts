/**
 * Intent Detector — unit tests
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ManualIntentDetector } from "./intent-detector.ts";

describe("ManualIntentDetector", () => {
  const detector = new ManualIntentDetector();

  it("should classify fix intent", () => {
    assert.strictEqual(detector.classify("fix login bug"), "fix");
    assert.strictEqual(detector.classify("resolve timeout issue"), "fix");
    assert.strictEqual(detector.classify("debug memory leak"), "fix");
  });

  it("should classify refactor intent", () => {
    assert.strictEqual(detector.classify("refactor auth module"), "refactor");
    assert.strictEqual(detector.classify("clean up dead code"), "refactor");
    assert.strictEqual(detector.classify("optimize query performance"), "refactor");
  });

  it("should classify test intent", () => {
    assert.strictEqual(detector.classify("test API endpoints"), "test");
    assert.strictEqual(detector.classify("add unit tests"), "test");
  });

  it("should classify docs intent", () => {
    assert.strictEqual(detector.classify("document the API"), "docs");
    assert.strictEqual(detector.classify("update README"), "docs");
  });

  it("should classify deploy intent", () => {
    assert.strictEqual(detector.classify("deploy to production"), "deploy");
    assert.strictEqual(detector.classify("release v2.0"), "deploy");
  });

  it("should classify implement intent", () => {
    assert.strictEqual(detector.classify("implement user login"), "implement");
    assert.strictEqual(detector.classify("add new feature"), "implement");
  });

  it("should default to analyze for unknown", () => {
    assert.strictEqual(detector.classify(""), "analyze");
    assert.strictEqual(detector.classify("   "), "analyze");
    assert.strictEqual(detector.classify("hello world"), "analyze");
  });

  it("should detect fix from error-related terms", () => {
    assert.strictEqual(detector.classify("there is a bug"), "fix");
    assert.strictEqual(detector.classify("fixing crash issue"), "fix");
  });
});
