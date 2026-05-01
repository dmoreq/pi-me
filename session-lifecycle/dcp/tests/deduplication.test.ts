/**
 * Tests for DCP Deduplication Rule
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { registerRule, clearRegistry } from "../registry";
import { deduplicationRule, resetSeenHashes } from "../rules/deduplication";
import { applyPruningWorkflow } from "../workflow";
import type { DcpConfigWithPruneRuleObjects } from "../types";

const config: DcpConfigWithPruneRuleObjects = {
	enabled: true,
	debug: false,
	rules: [deduplicationRule],
	keepRecentCount: 0,
};

describe("Deduplication Rule", () => {
	before(() => {
		clearRegistry();
		registerRule(deduplicationRule);
	});

	it("should keep unique messages", () => {
		resetSeenHashes();
		const messages = [
			{ role: "user", content: "Hello" },
			{ role: "assistant", content: "Hi there" },
			{ role: "user", content: "How are you?" },
		] as any;

		const result = applyPruningWorkflow(messages, config);
		assert.equal(result.length, 3);
	});

	it("should remove duplicate assistant messages", () => {
		resetSeenHashes();
		const messages = [
			{ role: "assistant", content: "Tool output here" },
			{ role: "assistant", content: "Tool output here" }, // duplicate
			{ role: "assistant", content: "Different content" },
		] as any;

		const result = applyPruningWorkflow(messages, config);
		assert.equal(result.length, 2); // First duplicate + unique kept
	});

	it("should not prune user messages", () => {
		resetSeenHashes();
		const messages = [
			{ role: "user", content: "Hello" },
			{ role: "user", content: "Hello" },
		] as any;

		const result = applyPruningWorkflow(messages, config);
		assert.equal(result.length, 2); // Both kept (user messages skip dedup)
	});

	it("should handle tool call content for dedup", () => {
		resetSeenHashes();
		const messages = [
			{
				role: "assistant",
				content: [
					{ type: "text", text: "Reading file" },
					{ type: "toolCall", id: "call_1", name: "read", arguments: { path: "a.txt" } },
				],
			},
			// Different file — should NOT be deduplicated
			{
				role: "assistant",
				content: [
					{ type: "text", text: "Reading file" },
					{ type: "toolCall", id: "call_2", name: "read", arguments: { path: "b.txt" } },
				],
			},
		] as any;

		const result = applyPruningWorkflow(messages, config);
		assert.equal(result.length, 2); // Different args = different hashes
	});

	it("should handle empty messages array", () => {
		resetSeenHashes();
		const result = applyPruningWorkflow([], config);
		assert.equal(result.length, 0);
	});
});
