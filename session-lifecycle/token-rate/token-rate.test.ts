/**
 * Tests for token-rate status calculation logic.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("token-rate", () => {
  describe("TPS calculation", () => {
    function calculateTPS(outputTokens: number, elapsedSeconds: number): string {
      if (elapsedSeconds <= 0 || outputTokens <= 0) return "--";
      const tps = outputTokens / elapsedSeconds;
      return Number.isFinite(tps) ? tps.toFixed(1) : "--";
    }

    it("calculates simple TPS", () => {
      assert.equal(calculateTPS(100, 10), "10.0");
    });

    it("handles fractional TPS", () => {
      assert.equal(calculateTPS(100, 3), "33.3");
    });

    it("returns -- when no tokens", () => {
      assert.equal(calculateTPS(0, 10), "--");
    });

    it("returns -- when no elapsed time", () => {
      assert.equal(calculateTPS(100, 0), "--");
    });

    it("returns -- for negative inputs", () => {
      assert.equal(calculateTPS(100, -1), "--");
      assert.equal(calculateTPS(-100, 10), "--");
    });

    it("handles large values", () => {
      assert.equal(calculateTPS(1000000, 1000), "1000.0");
    });

    it("handles very small TPS", () => {
      assert.equal(calculateTPS(1, 100), "0.0");
    });
  });

  describe("cumulative stats", () => {
    function updateCumulative(
      prevTokens: number,
      prevSeconds: number,
      newTokens: number,
      newSeconds: number
    ): { tokens: number; seconds: number; tps: string } {
      const tokens = prevTokens + newTokens;
      const seconds = prevSeconds + newSeconds;
      const tps = seconds > 0 ? (tokens / seconds).toFixed(1) : "--";
      return { tokens, seconds, tps };
    }

    it("accumulates over multiple turns", () => {
      let state = updateCumulative(0, 0, 100, 5);
      assert.equal(state.tps, "20.0");

      state = updateCumulative(state.tokens, state.seconds, 200, 10);
      assert.equal(state.tokens, 300);
      assert.equal(state.seconds, 15);
      assert.equal(state.tps, "20.0");
    });

    it("ignores zero-token turns (but still tracks time)", () => {
      const state = updateCumulative(100, 5, 0, 3);
      assert.equal(state.tokens, 100);
      assert.equal(state.seconds, 8);
      assert.equal(state.tps, "12.5");
    });
  });
});
