import { describe, it } from "node:test";
import assert from "node:assert/strict";
import thinkingSteps from "./thinking-steps.ts";

describe("thinking-steps", () => {
  it("exports a function", () => {
    assert.equal(typeof thinkingSteps, "function");
  });
});
