/**
 * Tests for DCP Recency Rule
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { registerRule, clearRegistry } from "../registry";
import { deduplicationRule, resetSeenHashes } from "../rules/deduplication";
import { recencyRule } from "../rules/recency";
import { applyPruningWorkflow } from "../workflow";
import type { DcpConfigWithPruneRuleObjects } from "../types";

describe("Recency Rule", () => {
	before(() => {
		clearRegistry();
		registerRule(deduplicationRule);
		registerRule(recencyRule);
	});

	it("should protect recent messages from pruning", () => {
		resetSeenHashes();
		const messages = [
			{ role: "assistant", content: "First result" },
			{ role: "assistant", content: "Second result" },
			{ role: "user", content: "Keep me" },
			{ role: "assistant", content: "Old duplicate" },
			{ role: "assistant", content: "Old duplicate" }, // would be pruned by dedup
		] as any;

		const config: DcpConfigWithPruneRuleObjects = {
			enabled: true,
			debug: false,
			rules: [deduplicationRule, recencyRule],
			keepRecentCount: 3, // Keep last 3 messages (indices 2,3,4)
		};

		const result = applyPruningWorkflow(messages, config);
		// Dedup: [0] add hash, [1] add hash, [2] skip (user), [3] add hash, [4] duplicate → pruned
		// Recency: [2] dist 2 < 3 protected, [3] dist 1 < 3 protected, [4] dist 0 < 3 → unpruned!
		// All 5 messages kept because recency overrides dedup for recent ones
		assert.equal(result.length, 5);
	});

	it("should protect all messages when keepRecentCount is high", () => {
		resetSeenHashes();
		const messages = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hello" },
			{ role: "user", content: "Same content" },
			{ role: "assistant", content: "Same content" },
		] as any;

		const config: DcpConfigWithPruneRuleObjects = {
			enabled: true,
			debug: false,
			rules: [deduplicationRule, recencyRule],
			keepRecentCount: 100, // Protect all
		};

		const result = applyPruningWorkflow(messages, config);
		assert.equal(result.length, 4); // All protected by recency
	});

	it("should allow pruning when keepRecentCount is low and duplicates are old", () => {
		resetSeenHashes();
		const messages = [
			{ role: "assistant", content: "Same output" },
			{ role: "assistant", content: "Unique output" },
			{ role: "assistant", content: "Same output" }, // duplicate of msg 0, NOT protected
		] as any;

		const config: DcpConfigWithPruneRuleObjects = {
			enabled: true,
			debug: false,
			rules: [deduplicationRule, recencyRule],
			keepRecentCount: 0, // Don't protect any
		};

		const result = applyPruningWorkflow(messages, config);
		// Message 2 is a duplicate of message 0 and not protected by recency
		assert.equal(result.length, 2);
	});
});
